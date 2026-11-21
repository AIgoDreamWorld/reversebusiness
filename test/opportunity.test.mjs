import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCandidates,evaluate,selectThree,newRound,validateCandidate,assertRound,axes} from '../lib/opportunity-engine.mjs';
const sample=n=>Array.from({length:n},(_,i)=>({url:'https://example'+i+'.org/',name:'Candidate '+i,summary:'Result from search'}));
test('URL discovery caps at 10 and does not fabricate candidates',()=>{
 assert.equal(normalizeCandidates([],[]).length,0);
 assert.equal(normalizeCandidates(sample(14),[]).length,10);
});
test('reject invalid/duplicate/non-http URLs',()=>{
 const a=normalizeCandidates([{url:'javascript:alert(1)'},{url:'http://localhost/'},{url:'https://www.example.org/'},{url:'https://example.org'}]);
 assert.equal(a.length,1);
});
test('search snippets do not become verified claims',()=>{
 const c=normalizeCandidates(sample(1))[0];const e=evaluate(c);
 assert.equal(e.verdict,'HOLD');assert.equal(e.verified,0);assert.equal(e.sourced,0);
 assert.equal(c.axes.Who.status,'UNKNOWN');
});
test('source URL and note are necessary but not sufficient for independent verification',()=>{
 const c=normalizeCandidates(sample(1))[0];
 c.axes.Who={status:'SOURCED',note:'Customer listed on site',evidence:[{url:'https://example.org/customer',note:'Company claim'}]};
 assert.equal(evaluate(c).verdict,'HOLD');assert.equal(evaluate(c).sourced,1);
});
test('unsupported verified statements fail',()=>{
 const c=normalizeCandidates(sample(1))[0];c.axes.Niche={status:'VERIFIED',note:'niche',evidence:[]};
 assert.ok(validateCandidate(c).includes('AXIS_Niche_UNSUPPORTED'));
 assert.equal(evaluate(c).verdict,'FAIL');
});
test('recommendations are max 3 and are drafts even with 10 candidates',()=>{
 const s=selectThree(normalizeCandidates(sample(10)));assert.equal(s.length,3);
 assert.ok(s.every(x=>x.status==='STRATEGY_DRAFT_NOT_APPROVED'));
 assert.ok(s.every(x=>x.audit.verdict==='HOLD'));
});
test('rejection preserves prior candidates and excludes reruns',()=>{
 const c=normalizeCandidates(sample(3)),r=newRound(c,'insufficient evidence');
 assert.equal(r.excluded.length,3);assert.equal(r.nextCandidates.length,0);
 assert.equal(normalizeCandidates([...sample(3),...sample(4).slice(3)],r.excluded.map(x=>x.url)).length,1);
});
test('round integrity checks',()=>{
 assert.throws(()=>assertRound({candidates:sample(11)}),/MAX_TEN/);
 assert.throws(()=>assertRound({recommendations:sample(4)}),/MAX_THREE/);
 assert.equal(axes.length,7);
});
test('three recommendations contain seven-axis report and bounded 90-day strategy',()=>{
 const rec=selectThree(normalizeCandidates(sample(3)));
 assert.equal(rec.length,3);
 for(const x of rec){
  assert.equal(x.report.axes.length,7);
  assert.equal(x.report.trend.status,'UNKNOWN');
  assert.equal(x.report.missing.length,7);
  assert.equal(x.report.trend.scenarios.length,3);
  assert.ok(x.report.strategy.days61to90);
  assert.equal(x.report.verdict,'HOLD');
 }
});
