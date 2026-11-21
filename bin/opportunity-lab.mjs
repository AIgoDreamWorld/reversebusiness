#!/usr/bin/env node
// Localhost-only interactive prototype. API search requires explicit configured key.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {normalizeCandidates,selectThree,newRound,validateCandidate,assertRound} from '../lib/opportunity-engine.mjs';
import {searchCandidates} from '../lib/opportunity-search.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'experiments','opportunity-lab');
const ui=path.join(root,'viewer','opportunity-lab.html');
const port=Number(process.env.OPPORTUNITY_PORT||4178);
fs.mkdirSync(dir,{recursive:true});
let state={idea:'',type:'auto',candidates:[],recommendations:[],excluded:[],round:1,status:'EMPTY',history:[]};
const snapshots=fs.readdirSync(dir).filter(n=>/^round_\d+_\d+_\d+\.json$/.test(n)).sort();
if(snapshots.length){try{
 const data=JSON.parse(fs.readFileSync(path.join(dir,snapshots.at(-1)),'utf8'));
 if(data&&Array.isArray(data.candidates)&&Array.isArray(data.excluded)&&Array.isArray(data.history))state=data;
}catch(e){console.error('snapshot recovery skipped:',e.message)}}

const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const body=async(req)=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>250000)throw Error('INPUT_TOO_LARGE')}return JSON.parse(s||'{}')};
const save=()=>{const ts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).replace(/[^0-9]/g,'');const suffix=String(state.round).padStart(2,'0');const file=path.join(dir,'round_'+ts+'_'+suffix+'_'+String(Date.now())+'.json');fs.writeFileSync(file,JSON.stringify(state,null,2)+'\n');return path.relative(root,file)};
const searchEnabled=fs.existsSync(path.join(root,'node_modules','@tavily','core','package.json'));
async function tavily(idea,type,reason){
 if(!searchEnabled)throw Error('SEARCH_SDK_NOT_INSTALLED: npm install --no-save --no-package-lock --ignore-scripts @tavily/core');
 return await searchCandidates(idea,type,reason);
}
async function act(req,res,route){
 try{
 if(route==='/api/state')return send(res,200,{...state,searchEnabled,searchProvider:searchEnabled?'Tavily official SDK (keyless, limited)':'Not installed'});
 const x=await body(req);
 if(route==='/api/discover'){
 const idea=String(x.idea||'').trim().slice(0,350);
 if(!idea)return send(res,400,{error:'IDEA_REQUIRED'});
 const type=['auto','service','content'].includes(x.type)?x.type:'auto';
 const search=Array.isArray(x.candidates)?null:await tavily(idea,type,state.history.length?state.history.at(-1).reason.slice(0,180):'');
 const raw=search?search.candidates:x.candidates;
 const candidates=normalizeCandidates(raw,state.excluded.map(y=>y.url));
 state={...state,idea,type,candidates,recommendations:[],searchStats:search?.stats||null,status:candidates.length?'DISCOVERED':'INSUFFICIENT_RESULTS'};
 assertRound(state);return send(res,200,{...state,saved:save()});
 }
 if(route==='/api/update'){
 const target=state.candidates.find(c=>c.id===x.id);
 if(!target)return send(res,404,{error:'CANDIDATE_NOT_FOUND'});
 if(x.axis&&target.axes[x.axis]){
  target.axes[x.axis]={status:x.status==='VERIFIED'?'VERIFIED':'UNKNOWN',note:String(x.note||'').slice(0,1500),
   evidence:Array.isArray(x.evidence)?x.evidence.filter(e=>typeof e.url==='string').slice(0,6):[]};
 }
 if(x.trend)target.trend={status:x.trend.status==='VERIFIED'?'VERIFIED':'UNKNOWN',signals:x.trend.signals||[],risk:x.trend.risk||[],timeSeries:x.trend.timeSeries||[]};
 target.risks=Array.isArray(x.risks)?x.risks.slice(0,12):target.risks;
 return send(res,200,{candidate:target,issues:validateCandidate(target),saved:save()});
 }
 if(route==='/api/recommend'){
 state.recommendations=selectThree(state.candidates);
 state.status=state.recommendations.length?'DRAFT_THREE':'INSUFFICIENT_EVIDENCE';
 assertRound(state);return send(res,200,{...state,saved:save()});
 }
 if(route==='/api/reject'){
 const reason=String(x.reason||'').trim();if(!reason)return send(res,400,{error:'REJECTION_REASON_REQUIRED'});
 state.history.push({round:state.round,idea:state.idea,reason,selected:state.recommendations.map(r=>r.candidate.id),candidateCount:state.candidates.length});
 const result=newRound(state.candidates,reason);
 state={...state,round:state.round+1,candidates:[],recommendations:[],excluded:[...state.excluded,...result.excluded],status:'RESEARCH_REQUIRED'};
 return send(res,200,{...state,saved:save()});
 }
 if(route==='/api/approve')return send(res,409,{error:'WJ_APPROVAL_NOT_AUTOMATED: MVP planning only, no production approval'});
 send(res,404,{error:'NO_ROUTE'});
 }catch(e){send(res,400,{error:String(e.message||e)})}
}
const server=http.createServer((req,res)=>{
 const route=new URL(req.url||'/', 'http://localhost').pathname;
 if(req.method==='GET'&&route==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return fs.createReadStream(ui).pipe(res)}
 if(req.method==='GET'&&route==='/api/state'||req.method==='POST'&&route.startsWith('/api/'))return void act(req,res,route);
 send(res,404,{error:'NOT_FOUND'});
});
server.listen(port,'127.0.0.1',()=>console.log('Opportunity Lab http://127.0.0.1:'+port+' search='+searchEnabled+' provider=Tavily-keyless'));
