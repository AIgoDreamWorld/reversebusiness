import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSearchQueries} from '../lib/opportunity-search.mjs';
import {normalizeCandidates} from '../lib/opportunity-engine.mjs';
import {composeReport,inspectEvidence,issueDecision,strategyIntegrity,reusableAssetHandoff,CLEARANCE_PHRASE} from '../lib/governed-pipeline.mjs';
const hash='sha256:'+'a'.repeat(64),other='sha256:'+'b'.repeat(64);
function item(i){
 return normalizeCandidates([{url:'https://business'+i+'.test/product',name:'Business '+i,kind:'service',summary:'A product (not validated)'}])[0];
}
function fillEvidence(c){
 const official=c.url.replace(/\/product$/,'/pricing');
 const axes=['Who','What','Where','Market','How','Pricing','Niche'];
 c.axes=Object.fromEntries(axes.map(k=>[k,{status:'VERIFIED',note:'reviewed '+k,
  evidence:[
   {url:official,note:'Supplier claim is tied to a captured official document',contentHash:hash,captureOrigin:'REVERSEBUSINESS_COLLECTOR',checkedAt:'2026-11-21'},
   {url:'https://independent'+k.toLowerCase()+'.test/research',note:'An independent capture supports this company claim',contentHash:other,captureOrigin:'REVERSEBUSINESS_COLLECTOR',checkedAt:'2026-11-21'}
 ]}]));
 c.trend={status:'VERIFIED',timeSeries:[
  {date:'2024-01-01',value:10,url:'https://stats.test/1',contentHash:hash,captureOrigin:'REVERSEBUSINESS_COLLECTOR'},
  {date:'2025-01-01',value:12,url:'https://stats.test/2',contentHash:other,captureOrigin:'REVERSEBUSINESS_COLLECTOR'}
 ]};
 c.buyerProof=[{url:'https://verifiedbuyer.test/feedback',note:'Verified buyer purchase evidence report',method:'INTERVIEW',contentHash:hash,captureOrigin:'REVERSEBUSINESS_COLLECTOR'}];
 c.competitorEvidence=[1,2,3].map(n=>({url:'https://competitor'+n+'.test/analysis',note:'Independently captured and linked competition data',contentHash:hash,captureOrigin:'REVERSEBUSINESS_COLLECTOR'}));
 c.rightsStatus='CLEAR';
 c.unitEconomicsStatus='VERIFIED';
 return c;
}
function draft(c){
 return {candidateId:c.id,customer:'Schools',problem:'Slow procurement',offer:'Verified content',competition:'Three substitutes',
 revenue:'Per-project fee',distribution:'School procurement',cost:'Measured production',risks:'Rights clearance',
 differentiation:'Linked source evidence',evidence:'Purchases + market context',
 sources:[1,2,3].map(i=>({url:'https://study'+i+'.test/doc',claim:'Document '+i}))};
}
const policy={canonical7x7:{status:'VERIFIED',origin:'immutable-golden-read-only',sha256:hash}};
test('generic queries never inject history/video niche into unrelated ideas',()=>{
 for(const type of ['auto','service','content']){
  const q=buildSearchQueries('AI-assisted crop accounting',type,'');
  assert.equal(q.length,3);
  assert.ok(q.every(s=>s.includes('AI-assisted crop accounting')));
  assert.ok(q.every(s=>!s.toLowerCase().includes('history documentary')));
  assert.ok(q.every(s=>!s.toLowerCase().includes('historical reenactment')));
 }
 assert.ok(buildSearchQueries('Korean language tutor','content').some(s=>s.includes('creator')));
 assert.throws(()=>buildSearchQueries(''));
});
test('supplier pages, self-labelled independent links, and unhashed claims never self-verify',()=>{
 const c=item(1);c.axes.What={status:'VERIFIED',note:'claimed',evidence:[
  {url:c.url,note:'Supplier page says this is effective',checkedAt:'2026-11-21'},
  {url:c.url,note:'Supplier self-claim counted again',contentHash:hash,checkedAt:'2026-11-21'}
 ]};
 const a=inspectEvidence(c);
 assert.equal(a.verifiedDimensions,0);
 assert.equal(a.verdict,'HOLD');
 assert.ok(a.problems.some(x=>x.includes('SELF_ATTESTED')));
});
test('independently linked dimensions require domain separation, capture hash, and date',()=>{
 const c=fillEvidence(item(2));
 assert.equal(inspectEvidence(c).verdict,'EVIDENCE_READY');
 c.axes.What.evidence[1].contentHash='';
 assert.equal(inspectEvidence(c).verdict,'HOLD');
 c.axes.What.evidence[1].contentHash=hash;
 c.axes.Pricing.evidence[1].url=c.url;
 assert.equal(inspectEvidence(c).verdict,'HOLD');
});
test('missing Golden canonical source blocks business approval even if evidence appears complete',()=>{
 const cs=Array.from({length:10},(_,i)=>i<3?fillEvidence(item(i+1)):item(i+1));
 const r=composeReport({idea:'unrelated businesses',round:1,candidates:cs,strategyDrafts:cs.slice(0,3).map(draft)});
 assert.equal(r.discoveryCount,10);assert.equal(r.researchPriorities.length,3);
 assert.equal(r.strategies.length,3);
 assert.equal(r.canonicalGolden7x7.verified,false);
 assert.equal(r.verdict,'HOLD');
 assert.ok(r.blockers.includes('CANONICAL_GOLDEN_7X7_NOT_VERIFIED'));
 assert.equal(issueDecision(r,{action:'APPROVE',evidenceHash:r.evidenceHash,typedConfirmation:CLEARANCE_PHRASE}).ok,false);
});
test('review-ready is not approval, and explicit WJ confirmation is necessary',()=>{
 const cs=Array.from({length:10},(_,i)=>i<3?fillEvidence(item(i+1)):item(i+1));
 const r=composeReport({idea:'test business concept',round:1,candidates:cs,strategyDrafts:cs.slice(0,3).map(draft)},policy);
 assert.equal(r.verdict,'REVIEW_READY');
 assert.equal(issueDecision(r,{action:'APPROVE',evidenceHash:r.evidenceHash,typedConfirmation:''}).reason,'EXPLICIT_WJ_CONFIRMATION_REQUIRED');
 assert.equal(issueDecision(r,{action:'APPROVE',evidenceHash:'WRONG_HASH',typedConfirmation:CLEARANCE_PHRASE}).reason,'REPORT_HASH_MISMATCH');
 const decision=issueDecision(r,{action:'APPROVE',evidenceHash:r.evidenceHash,typedConfirmation:CLEARANCE_PHRASE});
 assert.equal(decision.ok,true);
 assert.equal(decision.decision.scope,'READ_ONLY_REUSE_HANDOFF');
 assert.ok(decision.decision.notAllowed.includes('AUTO_BUILD'));
 assert.equal(reusableAssetHandoff(r,decision.decision,[]).ready,false);
 const okAsset={name:'already audited',source:'existing/asset',license:'MIT',hash:'hash-of-source',qa:'PASS',readOnly:true};
 const handoff=reusableAssetHandoff(r,decision.decision,[okAsset]);
 assert.equal(handoff.ready,true);assert.equal(handoff.execute,false);assert.equal(handoff.originalsPreserved,true);
});
test('rejection needs reason, matching digest, and does not mutate strategy report',()=>{
 const cs=Array.from({length:10},(_,i)=>item(i+1));
 const r=composeReport({idea:'sports business',round:2,candidates:cs},policy);
 const before=r.evidenceHash;
 assert.equal(issueDecision(r,{action:'REJECT',evidenceHash:before,reason:'no'}).ok,false);
 const reply=issueDecision(r,{action:'REJECT',evidenceHash:before,reason:'Insufficient paid customer evidence'});
 assert.equal(reply.ok,true);assert.equal(reply.decision.kind,'REJECTED');assert.equal(r.evidenceHash,before);
});
test('incomplete strategy is blocked, not converted into a fictitious business report',()=>{
 const c=item(1),x=strategyIntegrity({candidateId:c.id,customer:'somebody'});
 assert.equal(x.valid,false);
 assert.ok(x.missing.includes('THREE_CLAIM_LINKED_SOURCES'));
});
