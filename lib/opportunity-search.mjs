// Generic keyless Tavily search; returns discovered URLs, NEVER claims independent business verification.
const blocked=new Set(['reddit.com','quora.com','substack.com','medium.com','wikipedia.org','linkedin.com','facebook.com','pinterest.com','x.com','twitter.com','news.google.com','pbs.org','nytimes.com','theguardian.com','forbes.com','techcrunch.com']);
const newsPath=/\/(blog|blogs|news|article|articles|press|learn|guide|guides|tutorial|tutorials|compare|comparison|alternatives|review|reviews|newshour|list|lists|roundup)(\/|$)/i;
const safeHost=x=>{try{return new URL(x).hostname.toLowerCase().replace(/^www\./,'')}catch{return null}};
const clean=s=>String(s||'').trim().replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').slice(0,240);
export function buildSearchQueries(idea,type='auto',reason=''){
 const q=clean(idea);if(!q)throw Error('IDEA_REQUIRED');
 const reject=clean(reason);
 const tail=reject?' niche alternative different from rejected examples '+reject.slice(0,90):'';
 if(type==='content')return [
  q+' creator channel content publisher official website'+tail,
  q+' independent content business paid members subscribers media company',
  q+' creator studio channel video podcast newsletter monetization official site'
 ];
 if(type==='service')return [
  q+' software service company product pricing official site'+tail,
  q+' commercial SaaS startup competing products customer plans',
  q+' B2B service platform providers subscription pricing'
 ];
 return [
  q+' service company products and content creators official sites'+tail,
  q+' business model customer pricing SaaS app platform',
  q+' media creators publishers paid subscription content business'
 ];
}
export function filterBusinessResults(rows,type='auto'){
 const seen=new Set();
 return rows.filter(row=>{
  let u;try{u=new URL(row.url)}catch{return false}
  const h=safeHost(row.url);
  if(!['https:','http:'].includes(u.protocol)||!h)return false;
  if(blocked.has(h)||[...blocked].some(b=>h.endsWith('.'+b)))return false;
  if(newsPath.test(u.pathname)||/\/best[-_]|\/top[-_]|\/ugc\/en\/list\//i.test(u.pathname))return false;
  if(['youtube.com','m.youtube.com','youtu.be'].includes(h)){
   if(type==='service')return false;
   if(!/^\/(?:@|channel\/|c\/|user\/)/.test(u.pathname))return false;
  }
  if(/\.(pdf|jpg|png|webp|mp4)$/i.test(u.pathname))return false;
  if(seen.has(h)&&!h.includes('youtube.com'))return false;
  if(seen.has(h+u.pathname))return false;
  seen.add(h);seen.add(h+u.pathname);return true;
 }).map(x=>({...x,kind:type==='auto'?'unknown':type,source:'Tavily search — discovery only (unverified)',foundAt:new Date().toISOString()}));
}
export async function searchCandidates(idea,type='auto',reason='',clientOverride=null,excluded=[]){
 const blockedUrls=new Set(excluded.map(x=>String(x||'').replace(/\/$/,'').toLowerCase()));
 const allowed=items=>filterBusinessResults(items,type).filter(x=>!blockedUrls.has(x.url.replace(/\/$/,'').toLowerCase()));
 let client=clientOverride;
 if(!client){
  let sdk;try{sdk=await import('@tavily/core')}catch{throw Error('TAVILY_SDK_NOT_INSTALLED: npm install --no-save --no-package-lock --ignore-scripts @tavily/core')}
  client=sdk.tavily();
 }
 const raw=[],log=[];
 for(const query of buildSearchQueries(idea,type,reason)){
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
  if(allowed(raw).length>=10)break;
 }
 const candidates=allowed(raw).slice(0,10);
 return {candidates,stats:{provider:'Tavily official SDK keyless',attempts:log,rawCount:raw.length,eligibleCount:allowed(raw).length,selected:candidates.length,fullyVerified:0,ranking:'DISCOVERY_ONLY'}};
}
