// Official Tavily JavaScript SDK (keyless, rate-limited). Optional install: npm install --no-save --no-package-lock --ignore-scripts @tavily/core
const blocked=new Set(['reddit.com','quora.com','substack.com','medium.com','wikipedia.org','linkedin.com','facebook.com','pinterest.com','x.com','twitter.com','news.google.com','pbs.org','nytimes.com','theguardian.com','forbes.com','techcrunch.com']);
const newsPath=/\/(blog|blogs|news|article|articles|press|learn|guide|guides|tutorial|tutorials|compare|comparison|alternatives|review|reviews|newshour|list|lists|roundup)(\/|$)/i;
const id=x=>{try{return new URL(x).hostname.toLowerCase().replace(/^www\./,'')}catch{return null}};
export function filterBusinessResults(rows,type='auto'){
 const seen=new Set();
 return rows.filter(row=>{
  let u;try{u=new URL(row.url)}catch{return false}
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(!['https:','http:'].includes(u.protocol))return false;
  if(blocked.has(host)||[...blocked].some(b=>host.endsWith('.'+b)))return false;
  if(newsPath.test(u.pathname)||/\/best[-_]|\/top[-_]|\/ugc\/en\/list\//i.test(u.pathname))return false;
  if(host==='youtube.com'||host==='m.youtube.com'||host==='youtu.be'){
   if(type==='service')return false;
   if(!/^\/(?:@|channel\/|c\/|user\/)/.test(u.pathname))return false;
  }
  if(/\.(pdf|jpg|png|webp|mp4)$/i.test(u.pathname))return false;
  if(seen.has(host)&&!host.includes('youtube.com'))return false;
  if(seen.has(host+u.pathname))return false;
  seen.add(host);seen.add(host+u.pathname);return true;
 }).map(x=>({...x,kind:type==='auto'?'unknown':type,source:'Tavily search (unverified company/content page)',foundAt:new Date().toISOString()}));
}
const variants=(idea,type,reason)=>[
 `${idea} ${type==='content'?'YouTube creator historical videos documentary channel':'AI history documentary video generator production software platform official site'} ${reason}`,
 `${idea} ${type==='content'?'history education creators channel original videos':'AI video makers historical education storytelling video tools SaaS official products'} alternative platforms`,
 `${idea} ${type==='content'?'history documentary creator channel audience':'AI historical reenactment video generator online tool startup'} services`
];
export async function searchCandidates(idea,type='auto',reason='',clientOverride=null){
 let client=clientOverride;
 if(!client){
  let sdk;try{sdk=await import('@tavily/core')}catch{throw Error('TAVILY_SDK_NOT_INSTALLED: npm install --no-save --no-package-lock --ignore-scripts @tavily/core')}
  client=sdk.tavily();
 }
 const raw=[],log=[];
 for(const query of variants(idea,type,reason)){
  try{
   const result=await client.search(query,{maxResults:10,searchDepth:'basic',safeSearch:true});
   const rows=(result.results||[]).map(r=>({url:r.url,name:r.title,summary:r.content,score:r.score,query}));
   raw.push(...rows);
   log.push({query,returned:rows.length,requestId:result.requestId||null});
  }catch(e){
   log.push({query,error:String(e?.message||e),name:e?.name||'ERROR'});
   if(raw.length===0)throw Error('SEARCH_FAILED: '+String(e?.message||e));
   break;
  }
  if(filterBusinessResults(raw,type).length>=10)break;
 }
 const candidates=filterBusinessResults(raw,type).slice(0,10);
 return {candidates,stats:{provider:'Tavily official SDK keyless',attempts:log,rawCount:raw.length,eligibleCount:filterBusinessResults(raw,type).length,selected:candidates.length,fullyVerified:0}};
}
