// Reuse the EXISTING ReverseBusiness public evidence collector without altering it.
// Explicit user action only, local URL sanity + DNS protections, one page, no login, no script rendering.
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const denyHost=h=>!h||/^(localhost|metadata|metadata\.google\.internal)$/i.test(h)||/\.(local|internal|test|invalid|example)$/i.test(h);
export function publicAddress(url){
 let u;
 try{u=new URL(url)}catch{throw Error('URL_INVALID')}
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||denyHost(u.hostname))throw Error('URL_NOT_SAFE_FOR_PUBLIC_CAPTURE');
 if(u.port&&![80,443].includes(Number(u.port)))throw Error('CUSTOM_PORT_FORBIDDEN');
 if(net.isIP(u.hostname))throw Error('IP_LITERAL_FORBIDDEN');
 return u;
}
function publicIP(ip){
 if(net.isIP(ip)===6){
  const t=ip.toLowerCase();
  return !(t==='::'||t==='::1'||t.startsWith('fc')||t.startsWith('fd')||t.startsWith('fe8')||t.startsWith('fe9')||t.startsWith('fea')||t.startsWith('feb')||t.startsWith('::ffff:'));
 }
 if(net.isIP(ip)!==4)return false;
 const o=ip.split('.').map(Number);
 return !(o[0]===0||o[0]===10||o[0]===127||o[0]>=224||
   o[0]===169&&o[1]===254||o[0]===192&&o[1]===168||
   o[0]===172&&o[1]>=16&&o[1]<=31||o[0]===100&&o[1]>=64&&o[1]<=127||
   o[0]===198&&o[1]>=18&&o[1]<=19||o[0]===192&&o[1]===0&&o[2]===0);
}
export async function ensurePublicDns(url,lookup=dns.lookup){
 const u=publicAddress(url);
 const results=await lookup(u.hostname,{all:true,verbatim:true});
 if(!results.length||results.some(x=>!publicIP(x.address)))throw Error('DNS_NOT_PUBLIC');
 return u.toString();
}
export function inspectCollectorFiles(folder,candidateUrl){
 const rpt=path.join(folder,'report.json'),src=path.join(folder,'source.json'),logs=path.join(folder,'requests.json');
 if(![rpt,src,logs].every(f=>fs.existsSync(f)))throw Error('COLLECTOR_OUTPUT_MISSING');
 const a=JSON.parse(fs.readFileSync(rpt,'utf8'));
 const b=JSON.parse(fs.readFileSync(logs,'utf8'));
 if(a.schema!=='rebiz/report@1'||a.meta?.target?.url!==candidateUrl||a.meta?.draft!==true)throw Error('COLLECTOR_SOURCE_MISMATCH');
 const requests=Array.isArray(b.requests)?b.requests:[];
 if(requests.some(x=>x.method!=='GET'))throw Error('COLLECTOR_UNEXPECTED_MUTATION');
 const pageCount=Number(a.meta?.read?.chars||0);
 const contentHash=sha(fs.readFileSync(rpt));
 return {status:'PUBLIC_SUPPLIER_PAGE_CAPTURED_NOT_VERIFIED',pageCount,collectionRequests:requests.length,termsStatus:a.meta?.terms?.status||'UNKNOWN',title:a.meta?.target?.name||'UNKNOWN',contentHash,
  scope:a.meta?.scope||'',checkedAt:new Date().toISOString(),artifactFolder:folder};
}
export async function capturePublicCandidate({root,outputRoot,url,timeoutMs=55000,verifyDns=ensurePublicDns}){
 await verifyDns(url);
 const tool=path.join(root,'skill','reversebusiness','tools','collect.mjs');
 if(!fs.existsSync(tool))throw Error('EXISTING_COLLECTOR_NOT_FOUND');
 const id=createHash('sha256').update(url).digest('hex').slice(0,16);
 const out=path.join(outputRoot,'captures',id+'_'+Date.now());
 fs.mkdirSync(path.dirname(out),{recursive:true});
 const args=[tool,url,'--out',out,'--pages','1','--no-render'];
 const env={...process.env};for(const k of ['GEMINI_API_KEY','GOOGLE_API_KEY','OPENAI_API_KEY','TAVILY_API_KEY'])delete env[k];
 const child=spawn(process.execPath,args,{cwd:root,env,shell:false,windowsHide:true,stdio:['ignore','ignore','ignore']});
 const exitCode=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(Error('COLLECTOR_TIMEOUT_STOPPED'))},timeoutMs);
  child.once('error',e=>{clearTimeout(timer);reject(e)});
  child.once('exit',code=>{clearTimeout(timer);resolve(code)});
 });
 if(exitCode!==0)throw Error('COLLECTOR_STOPPED_OR_BLOCKED: '+exitCode);
 const proof=inspectCollectorFiles(out,url);
 return {...proof,artifactFolder:path.relative(root,out).replace(/\\/g,'/'),sourceId:id};
}
