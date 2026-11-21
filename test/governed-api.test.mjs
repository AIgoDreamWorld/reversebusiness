import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sleep=t=>new Promise(resolve=>setTimeout(resolve,t));
async function choosePort(){
 const listener=net.createServer();
 await new Promise((resolve,reject)=>listener.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=listener.address().port;
 await new Promise(resolve=>listener.close(resolve));
 return port;
}
test('end-to-end local business workflow is evidence-gated without external API or changing production state',async t=>{
 const temp=fs.mkdtempSync(path.join(root,'experiments','governed-api-test-'));
 const port=await choosePort();
 const env={...process.env,OPPORTUNITY_PORT:String(port),OPPORTUNITY_DATA_DIR:temp};
 // No paid credentials are needed; take them away from test process explicitly.
 delete env.GEMINI_API_KEY;delete env.GOOGLE_API_KEY;delete env.OPENAI_API_KEY;delete env.TAVILY_API_KEY;
 const child=spawn(process.execPath,['bin/opportunity-lab.mjs'],{cwd:root,env,stdio:'ignore'});
 t.after(async()=>{child.kill();await sleep(150);try{fs.rmSync(temp,{recursive:true,force:true})}catch{}});
 const base='http://127.0.0.1:'+port;
 let ready=false;
 for(let n=0;n<80;n++){
  if(child.exitCode!==null)break;
  try{const r=await fetch(base+'/api/state');if(r.ok){ready=true;break}}catch{}
  await sleep(80);
 }
 assert.ok(ready,'local server must start');
 const post=async(endpoint,data)=>{
  const res=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  return {status:res.status,body:await res.json()};
 };
 const urls=Array.from({length:10},(_,i)=>({url:'https://company'+(i+1)+'.example.org/product',name:'Provider '+(i+1),summary:'A public landing page, business unverified'}));
 const discovery=await post('discover',{idea:'robotic Korean language tutor',type:'service',candidates:urls});
 assert.equal(discovery.status,200);assert.equal(discovery.body.candidates.length,10);
 const unauthorizedCapture=await post('capture',{id:discovery.body.candidates[0].id,confirm:'no'});
 assert.equal(unauthorizedCapture.status,403);
 assert.equal(unauthorizedCapture.body.error,'EXPLICIT_PUBLIC_CAPTURE_CONFIRMATION_REQUIRED');
 const raw=await fetch(base+'/');
 assert.equal(raw.status,200);assert.ok((await raw.text()).includes('WJ STRATEGY WORKBENCH'));
 const report=await post('analyze',{});
 assert.equal(report.status,200);
 assert.equal(report.body.report.verdict,'HOLD');assert.equal(report.body.report.discoveryCount,10);
 assert.equal(report.body.report.researchPriorities.length,3);assert.equal(report.body.report.strategies.length,0);
 assert.ok(report.body.report.blockers.includes('CANONICAL_GOLDEN_7X7_NOT_VERIFIED'));
 const approve=await post('approve',{typedConfirmation:'WJ 전략 승인',evidenceHash:report.body.report.evidenceHash});
 assert.equal(approve.status,409);assert.equal(approve.body.error,'STRATEGY_NOT_REVIEW_READY');
 const asset=await fetch(base+'/api/assets').then(r=>r.json());
 assert.equal(asset.assets.length,6);assert.equal(asset.assets.filter(x=>x.verifiedForProduction).length,0);
 const handoff=await fetch(base+'/api/handoff').then(r=>r.json());
 assert.equal(handoff.ready,false);assert.equal(handoff.status,'BLOCKED_UNAPPROVED_STRATEGY');
 const reject=await post('reject',{reason:'Insufficient verified buyers and historic market measurements'});
 assert.equal(reject.status,200);assert.equal(reject.body.round,2);assert.equal(reject.body.excluded.length,10);
 assert.equal(reject.body.decisionHistory.at(-1).kind,'REJECTED');
 const rediscovery=await post('discover',{idea:'robotic Korean language tutor',type:'service',candidates:urls});
 assert.equal(rediscovery.status,200);assert.equal(rediscovery.body.candidates.length,0,'rejected sources cannot recur');
 const state=await fetch(base+'/api/state').then(r=>r.json());
 assert.equal(state.approval,null);assert.equal(state.candidates.length,0);assert.equal(state.status,'INSUFFICIENT_RESULTS');
 assert.equal(state.gemini.groundingEnabled,false);
});
