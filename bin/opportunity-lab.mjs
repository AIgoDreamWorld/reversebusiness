#!/usr/bin/env node
// ReverseBusiness local evidence-governed prototype. NEVER auto-deploy, buy, publish, alter Golden, or run paid AI.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeCandidates,newRound,validateCandidate,assertRound} from '../lib/opportunity-engine.mjs';
import {searchCandidates} from '../lib/opportunity-search.mjs';
import {composeReport,issueDecision,reusableAssetHandoff,strategyIntegrity} from '../lib/governed-pipeline.mjs';
import {listKnownReusableAssets,mapAssetsToHandoff} from '../lib/reuse-index.mjs';
import {exportResearchMarkdown} from '../lib/strategy-report.mjs';
import {capturePublicCandidate} from '../lib/source-capture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=process.env.OPPORTUNITY_DATA_DIR?path.resolve(process.env.OPPORTUNITY_DATA_DIR):path.join(root,'experiments','opportunity-lab');
const ui=path.join(root,'viewer','business-pipeline.html');
const legacy=path.join(root,'viewer','opportunity-lab.html');
const reviewUi=path.join(root,'viewer','opportunity-review.html');
const reviewJson=path.join(root,'reports','opportunity-review_20261121.json');
const port=Number(process.env.OPPORTUNITY_PORT||4178);
const policy={canonical7x7:{status:'MISSING',origin:null,sha256:null}}; // Protected canonical document not loaded. NEVER invent.
fs.mkdirSync(dir,{recursive:true});
let state={idea:'',type:'auto',candidates:[],recommendations:[],excluded:[],round:1,status:'EMPTY',history:[],strategyDrafts:[],analysis:null,approval:null,decisionHistory:[]};
const snapshots=fs.readdirSync(dir).filter(n=>/^round_\d+_\d+_\d+\.json$/.test(n)).sort();
if(snapshots.length)try{
 const data=JSON.parse(fs.readFileSync(path.join(dir,snapshots.at(-1)),'utf8'));
 if(data&&Array.isArray(data.candidates)&&Array.isArray(data.excluded)&&Array.isArray(data.history))state={...state,...data,analysis:null,approval:null};
}catch(e){console.error('Snapshot recovery skipped:',e.message)}
// Prior approvals never silently survive a server restart. Real WJ approval requires a fresh evidence hash match.

const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const body=async(req)=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>250000)throw Error('INPUT_TOO_LARGE')}return JSON.parse(s||'{}')};
const save=()=>{const ts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).replace(/[^0-9]/g,'');const suffix=String(state.round).padStart(2,'0');const file=path.join(dir,'round_'+ts+'_'+suffix+'_'+String(Date.now())+'.json');fs.writeFileSync(file,JSON.stringify({...state,approval:null},null,2)+'\n');return path.relative(root,file)};
const searchEnabled=fs.existsSync(path.join(root,'node_modules','@tavily','core','package.json'));
const geminiCredentialLoaded=Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY);
async function tavily(idea,type,reason,excluded=[]){
 if(!searchEnabled)throw Error('SEARCH_SDK_NOT_INSTALLED: npm install --no-save --no-package-lock --ignore-scripts @tavily/core');
 return await searchCandidates(idea,type,reason,null,excluded);
}
function invalidate(){state.analysis=null;state.approval=null;state.status='EVIDENCE_CHANGED_RECHECK_REQUIRED'}
function report(){if(!state.analysis)state.analysis=composeReport(state,policy);return state.analysis}
async function act(req,res,route){
 try{
  if(route==='/api/state')return send(res,200,{...state,searchEnabled,searchProvider:searchEnabled?'Tavily SDK (keyless free limit)':'Not installed',gemini:{credentialLoaded:geminiCredentialLoaded,authenticationVerified:false,groundingEnabled:false,reason:'PAID_API_NOT_AUTHORIZED'},approvalGate:'CANONICAL_7X7_AND_BUSINESS_EVIDENCE_REQUIRED'});
  if(route==='/api/assets')return send(res,200,{assets:listKnownReusableAssets(root),readOnly:true,eligibleForProduction:0});
  if(route==='/api/report')return send(res,200,{report:state.analysis||null,status:state.analysis?.verdict||'NOT_ANALYZED'});
  if(route==='/api/handoff'){
   const assets=listKnownReusableAssets(root);
   return send(res,200,{...reusableAssetHandoff(state.analysis,state.approval,mapAssetsToHandoff(assets)),existingAssets:assets,productionExecuted:false,identityStatus:'NOT_AUTHENTICATED'});
  }
  const x=await body(req);
  if(route==='/api/discover'){
   const idea=String(x.idea||'').trim().slice(0,350);
   if(!idea)return send(res,400,{error:'IDEA_REQUIRED'});
   const type=['auto','service','content'].includes(x.type)?x.type:'auto';
   const search=Array.isArray(x.candidates)?null:await tavily(idea,type,state.history.length?state.history.at(-1).reason.slice(0,180):'',state.excluded.map(x=>x.url));
   const raw=search?search.candidates:x.candidates;
   const candidates=normalizeCandidates(raw,state.excluded.map(y=>y.url));
   state={...state,idea,type,candidates,recommendations:[],strategyDrafts:[],analysis:null,approval:null,searchStats:search?.stats||{provider:'MANUAL_URLS_UNVERIFIED',selected:candidates.length},status:candidates.length?'DISCOVERED':'INSUFFICIENT_RESULTS'};
   assertRound(state);
   return send(res,200,{...state,saved:save()});
  }
  if(route==='/api/capture'){
   if(x.confirm!=='공개 페이지 수집')return send(res,403,{error:'EXPLICIT_PUBLIC_CAPTURE_CONFIRMATION_REQUIRED'});
   const target=state.candidates.find(c=>c.id===x.id);
   if(!target)return send(res,404,{error:'CANDIDATE_NOT_FOUND'});
   const proof=await capturePublicCandidate({root,outputRoot:dir,url:target.url});
   target.sourceCapture=proof;
   target.axes.What={status:'SOURCED',note:'Existing REBiz collector observed a public supplier page. This does not verify customer demand or company claims.',evidence:[{url:target.url,note:'The existing REBiz collector captured the public supplier landing page; independent verification not done.',checkedAt:proof.checkedAt,contentHash:proof.contentHash,captureOrigin:'REVERSEBUSINESS_COLLECTOR',sourceType:'PROVIDER'}]};
   invalidate();
   return send(res,200,{candidate:target,proof,saved:save()});
  }
  if(route==='/api/update'){
   const target=state.candidates.find(c=>c.id===x.id);
   if(!target)return send(res,404,{error:'CANDIDATE_NOT_FOUND'});
   if(x.axis&&target.axes[x.axis]){
    const evidence=Array.isArray(x.evidence)?x.evidence.slice(0,6).filter(e=>typeof e.url==='string').map(e=>({
      url:String(e.url).slice(0,1000),note:String(e.note||'').slice(0,1000),checkedAt:String(e.checkedAt||new Date().toISOString()),
      contentHash:'',captureOrigin:'USER_SUBMITTED_UNVERIFIED',sourceType:String(e.sourceType||'USER_SUBMITTED_UNVERIFIED')
    })):[];
    target.axes[x.axis]={status:['VERIFIED','SOURCED'].includes(x.status)?x.status:'UNKNOWN',note:String(x.note||'').slice(0,1500),evidence};
   }
   if(x.trend)target.trend={status:x.trend.status==='VERIFIED'?'VERIFIED':'UNKNOWN',signals:Array.isArray(x.trend.signals)?x.trend.signals:[],risk:Array.isArray(x.trend.risk)?x.trend.risk:[],timeSeries:Array.isArray(x.trend.timeSeries)?x.trend.timeSeries:[]};
   if(Array.isArray(x.buyerProof))target.buyerProof=x.buyerProof.slice(0,10);
   if(Array.isArray(x.competitorEvidence))target.competitorEvidence=x.competitorEvidence.slice(0,10);
   if(Array.isArray(x.risks))target.risks=x.risks.slice(0,12);
   // User-submitted labels are NEVER silently promoted to verified provenance.
   invalidate();
   return send(res,200,{candidate:target,issues:validateCandidate(target),auditStatus:'USER_SUBMITTED_NOT_INDEPENDENTLY_REVIEWED',saved:save()});
  }
  if(route==='/api/strategy-draft'){
   const st=x.strategy;
   if(!st||!state.candidates.some(c=>c.id===st.candidateId))return send(res,400,{error:'UNKNOWN_STRATEGY_CANDIDATE'});
   const assessment=strategyIntegrity(st);
   if(!assessment.valid)return send(res,422,{error:'STRATEGY_FIELDS_OR_CITATIONS_MISSING',missing:assessment.missing});
   const drafts=(state.strategyDrafts||[]).filter(s=>s.candidateId!==st.candidateId);
   drafts.push(st);state.strategyDrafts=drafts.slice(0,10);
   invalidate();return send(res,200,{acceptedAs:'UNVERIFIED_DRAFT',saved:save()});
  }
  if(route==='/api/analyze'||route==='/api/recommend'){
   const r=composeReport(state,policy);state.analysis=r;state.recommendations=r.strategies.map(x=>x.content);
   state.status=r.verdict==='REVIEW_READY'?'REVIEW_READY':'EVIDENCE_HOLD';
   return send(res,200,{report:r,saved:save()});
  }
  if(route==='/api/reject'){
   const reason=String(x.reason||'').trim();
   if(reason.length<8)return send(res,400,{error:'REJECTION_REASON_TOO_SHORT'});
   const current=report();
   const result=issueDecision(current,{action:'REJECT',evidenceHash:current.evidenceHash,reason},state.decisionHistory||[]);
   if(!result.ok)return send(res,409,{error:result.reason});
   state.decisionHistory=[...(state.decisionHistory||[]),result.decision];
   state.history.push({round:state.round,idea:state.idea,reason,selected:current.researchPriorities.map(y=>y.candidateId),candidateCount:state.candidates.length});
   const next=newRound(state.candidates,reason);
   state={...state,round:state.round+1,candidates:[],recommendations:[],strategyDrafts:[],analysis:null,approval:null,excluded:[...state.excluded,...next.excluded],status:'RESEARCH_REQUIRED'};
   return send(res,200,{...state,saved:save()});
  }
  if(route==='/api/approve'){
   if(!state.analysis)return send(res,409,{error:'ANALYSIS_REQUIRED'});
   const result=issueDecision(state.analysis,{action:'APPROVE',evidenceHash:x.evidenceHash,typedConfirmation:x.typedConfirmation},state.decisionHistory||[]);
   if(!result.ok)return send(res,409,{error:result.reason,blockers:result.blockers||state.analysis.blockers});
   state.approval=result.decision;state.decisionHistory=[...(state.decisionHistory||[]),result.decision];state.status='LOCAL_STRATEGY_APPROVAL_RECORDED';
   return send(res,200,{approval:state.approval,handoff:reusableAssetHandoff(state.analysis,state.approval,mapAssetsToHandoff(listKnownReusableAssets(root))),saved:save()});
  }
  return send(res,404,{error:'NO_ROUTE'});
 }catch(e){send(res,400,{error:String(e.message||e)})}
}
const server=http.createServer((req,res)=>{
 const route=new URL(req.url||'/', 'http://localhost').pathname;
 const serveHtml=file=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return fs.createReadStream(file).pipe(res)};
 if(req.method==='GET'&&route==='/')return serveHtml(ui);
 if(req.method==='GET'&&route==='/legacy')return serveHtml(legacy);
 if(req.method==='GET'&&route==='/review')return serveHtml(reviewUi); // historical example, not dynamic research
 if(req.method==='GET'&&route==='/api/review'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return fs.createReadStream(reviewJson).pipe(res)}
 if(req.method==='GET'&&route==='/api/report.md'){
  if(!state.analysis)return send(res,409,{error:'ANALYSIS_REQUIRED'});
  const result=exportResearchMarkdown(state.analysis);
  res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="business-strategy-review.md"','Cache-Control':'no-store'});
  return res.end(result);
 }
 if((req.method==='GET'&&['/api/state','/api/assets','/api/report','/api/handoff'].includes(route))||(req.method==='POST'&&route.startsWith('/api/')))return void act(req,res,route);
 return send(res,404,{error:'NOT_FOUND'});
});
server.listen(port,'127.0.0.1',()=>console.log('ReverseBusiness governed lab http://127.0.0.1:'+port+' keylessSearch='+searchEnabled));
