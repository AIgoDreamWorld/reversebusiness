import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const r=JSON.parse(fs.readFileSync(path.join(root,'reports','opportunity-review_20261121.json'),'utf8'));
const validURL=s=>{try{return new URL(s).protocol==='https:'}catch{return false}};
test('review has 10 distinct real source URLs and 3 unique strategy references',()=>{
 assert.equal(r.candidates.length,10);assert.equal(new Set(r.candidates.map(c=>new URL(c.url).hostname.replace(/^www\\./,''))).size,10);
 assert.equal(r.strategies.length,3);
 assert.deepEqual(r.strategies.map(p=>p.candidateId),r.candidates.filter(c=>c.selected).map(c=>c.id));
});
test('ranked priorities are monotonic and transparently weighted (never success probabilities)',()=>{
 let prior=1000;
 for(const c of r.candidates){
  assert.ok(c.priorityScore<=prior);prior=c.priorityScore;
  assert.equal(Object.values(c.scoreBreakdown).reduce((x,y)=>x+y,0),c.priorityScore);
  assert.ok(c.priorityScore<=100);assert.ok(c.priorityScore>=0);
  assert.equal(c.verdict,'HOLD');
 }
 assert.match(r.rubric.warning,/매출|성공/);
});
test('seven provisional axes contain source or UNKNOWN, not invented VERIFIED claims',()=>{
 for(const c of r.candidates){
  assert.equal(c.axes.length,7);
  assert.deepEqual(c.axes.map(a=>a.axis),['Who','What','Where','Market','How','Pricing','Niche']);
  for(const a of c.axes){
   assert.ok(['SOURCED','UNKNOWN'].includes(a.status));
   assert.ok(a.status==='UNKNOWN'||a.evidence.every(x=>x.sourceType==='PROVIDER'&&validURL(x.url)));
  }
  assert.equal(c.customerPaidProof,'UNKNOWN');assert.equal(c.vendorRevenue,'UNKNOWN');
  assert.equal(c.trend.searchTimeSeries,'UNKNOWN');
  assert.ok(c.sources.every(x=>validURL(x.url)));
 }
 assert.equal(r.governance.canonical7x7Located,false);
 assert.equal(r.governance.goldenUnchanged,true);
});
test('strategic reports include buyer, monetization hypothesis, evidence gaps, measurable experiments and stop condition',()=>{
 for(const p of r.strategies){
  assert.equal(p.phase.length,3);
  assert.equal(p.scenario.length,3);
  assert.ok(p.metrics.length>=4);assert.ok(p.kill.length>10);
  assert.equal(p.revenueEvidence,'UNKNOWN');
  assert.equal(p.launch,'WJ_APPROVAL_REQUIRED');
 }
 assert.equal(r.market.demandGrowth.startsWith('UNKNOWN'),true);
 assert.equal(r.quality.independentVendorRevenueVerified,0);
});
test('HTML review is linked locally and not declared as a Golden pass',()=>{
 const ui=fs.readFileSync(path.join(root,'viewer','opportunity-review.html'),'utf8');
 const home=fs.readFileSync(path.join(root,'viewer','opportunity-lab.html'),'utf8');
 const server=fs.readFileSync(path.join(root,'bin','opportunity-lab.mjs'),'utf8');
 assert.ok(home.includes('href="/review"'));
 assert.ok(server.includes("route==='/api/review'"));
 assert.ok(server.includes("route==='/review'"));
 assert.ok(ui.includes('Golden 7×7'));
 assert.ok(ui.includes('WJ 검수'));
 assert.ok(!ui.includes('WJ_APPROVED=true'));
});
