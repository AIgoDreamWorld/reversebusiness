// Evidence-first business decisions. NEVER edits the protected REA/3x3/7x7 Golden assets.
// Generic "Who/.../Niche" dimensions are provisional investigation labels, NOT canonical Golden 7x7.
import {createHash} from 'node:crypto';
const dims=Object.freeze(['Who','What','Where','Market','How','Pricing','Niche']);
const urlsafe=s=>{try{let u=new URL(s);return u.protocol==='https:'||u.protocol==='http:'}catch{return false}};
const host=s=>{try{return new URL(s).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}};
const sameOrg=(a,b)=>a===b||a.endsWith('.'+b)||b.endsWith('.'+a);
const s=v=>String(v??'').trim();
const evidenceHash=e=>/^sha256:[a-f0-9]{64}$/.test(s(e?.contentHash));
export const REQUIRED_STRATEGY_FIELDS=Object.freeze(['customer','problem','offer','competition','revenue','distribution','cost','risks','differentiation','evidence']);
export const CLEARANCE_PHRASE='WJ 전략 승인';

// Every claim is checked against an actually linked source. Two labels on the same domain
// never become two independent sources. Provider pages cannot corroborate their own claims.
export function inspectEvidence(candidate={}){
 const officialHost=host(candidate.url);
 const checks={},allIndependent=new Set(),problems=[];
 let supported=0,verified=0;
 for(const dim of dims){
  const a=candidate.axes?.[dim]||{status:'UNKNOWN',evidence:[]};
  const items=Array.isArray(a.evidence)?a.evidence:[];
  const cited=items.filter(e=>urlsafe(e.url)&&s(e.note).length>=12&&s(e.checkedAt).length>=8);
  const present=cited.filter(e=>evidenceHash(e)&&e.captureOrigin==='REVERSEBUSINESS_COLLECTOR');
  const providers=present.filter(e=>sameOrg(host(e.url),officialHost));
  const independent=present.filter(e=>!sameOrg(host(e.url),officialHost));
  const distinctIndependent=new Set(independent.map(e=>host(e.url)));
  for(const h of distinctIndependent)allIndependent.add(h);
  const sourced=cited.length>0&&['SOURCED','VERIFIED'].includes(a.status);
  const externallyVerified=a.status==='VERIFIED'&&providers.length>0&&distinctIndependent.size>=1;
  if(sourced)supported++;
  if(externallyVerified)verified++;
  if(a.status==='VERIFIED'&&!externallyVerified)problems.push(dim+': SELF_ATTESTED_OR_MISSING_INDEPENDENT_SOURCE');
  checks[dim]={claimedStatus:a.status||'UNKNOWN',sourced,externallyVerified,providerSources:providers.length,independentDomains:distinctIndependent.size};
 }
 const series=Array.isArray(candidate.trend?.timeSeries)?candidate.trend.timeSeries:[];
 const historical=series.length>=2&&series.every(x=>s(x.date)&&Number.isFinite(Number(x.value))&&urlsafe(x.url)&&evidenceHash(x)&&x.captureOrigin==='REVERSEBUSINESS_COLLECTOR');
 const buyerProof=Array.isArray(candidate.buyerProof)?candidate.buyerProof:[];
 const buyerVerified=buyerProof.some(e=>urlsafe(e.url)&&s(e.note).length>=12&&s(e.method)&&evidenceHash(e)&&e.captureOrigin==='REVERSEBUSINESS_COLLECTOR'&&!sameOrg(host(e.url),officialHost));
 const competitorEvidence=Array.isArray(candidate.competitorEvidence)?candidate.competitorEvidence:[];
 const independentlyCompared=new Set(competitorEvidence.filter(e=>urlsafe(e.url)&&s(e.note).length>=12&&evidenceHash(e)&&e.captureOrigin==='REVERSEBUSINESS_COLLECTOR'&&!sameOrg(host(e.url),officialHost)).map(e=>host(e.url)));
 const blockers=[];
 if(!urlsafe(candidate.url))blockers.push('ORIGIN_URL_MISSING');
 if(verified!==dims.length)blockers.push('SEVEN_PROVISIONAL_DIMENSIONS_NOT_INDEPENDENTLY_VERIFIED');
 if(!historical)blockers.push('TREND_TIME_SERIES_NOT_VERIFIED');
 if(!buyerVerified)blockers.push('BUYER_PAYMENT_SIGNAL_NOT_VERIFIED');
 if(independentlyCompared.size<3)blockers.push('THREE_COMPETITORS_NOT_VERIFIED');
 if(s(candidate.rightsStatus)!=='CLEAR')blockers.push('RIGHTS_NOT_CLEARED');
 if(s(candidate.unitEconomicsStatus)!=='VERIFIED')blockers.push('UNIT_ECONOMICS_NOT_VERIFIED');
 return {id:candidate.id,origin:candidate.url,name:candidate.name,sourceLevel:verified===7?'CROSSCHECKED':supported>0?'SOURCED':'DISCOVERED',verifiedDimensions:verified,sourcedDimensions:supported,independentDomains:allIndependent.size,checks,buyerVerified,historical,independentlyCompared:independentlyCompared.size,blockers,problems,verdict:blockers.length?'HOLD':'EVIDENCE_READY'};
}

const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fixtureCanonical=meta=>meta?.canonical7x7?.status==='VERIFIED'&&/^sha256:[0-9a-f]{64}$/.test(meta?.canonical7x7?.sha256||'')&&s(meta?.canonical7x7?.origin).length>0;
export function strategyIntegrity(strategy={}){
 const missing=REQUIRED_STRATEGY_FIELDS.filter(k=>!s(strategy[k]));
 const citationCount=Array.isArray(strategy.sources)?strategy.sources.filter(e=>urlsafe(e.url)&&s(e.claim)).length:0;
 if(citationCount<3)missing.push('THREE_CLAIM_LINKED_SOURCES');
 return {valid:missing.length===0,missing,citationCount};
}
export function composeReport(round={},policy={}){
 const candidates=Array.isArray(round.candidates)?round.candidates:[];
 const audit=candidates.map(inspectEvidence);
 const byId=new Map(audit.map(x=>[x.id,x]));
 const ranked=candidates.map((c,i)=>({candidateId:c.id,name:c.name,url:c.url,kind:c.kind||'unknown',summary:s(c.summary),risks:Array.isArray(c.risks)?c.risks:[],axes:c.axes||{},trend:c.trend||{},status:byId.get(c.id)?.verdict||'HOLD',audit:byId.get(c.id),originalDiscoveryIndex:i+1}))
 .sort((a,b)=>b.audit.verifiedDimensions-a.audit.verifiedDimensions||b.audit.sourcedDimensions-a.audit.sourcedDimensions||a.originalDiscoveryIndex-b.originalDiscoveryIndex);
 const top=ranked.slice(0,3).map((x,i)=>({...x,position:i+1,designation:'RESEARCH_PRIORITY_NOT_BUSINESS_RANK',why:'Provisional evidence coverage only; no profitability/growth ranking'}));
 const strategyRows=Array.isArray(round.strategyDrafts)?round.strategyDrafts:[];
 const reviewed=strategyRows.map(st=>({candidateId:st.candidateId,audit:strategyIntegrity(st),content:st}))
 .filter(x=>byId.has(x.candidateId));
 const finished=reviewed.filter(x=>x.audit.valid&&byId.get(x.candidateId)?.verdict==='EVIDENCE_READY');
 const canonical=fixtureCanonical(policy);
 const blockers=[];
 if(!canonical)blockers.push('CANONICAL_GOLDEN_7X7_NOT_VERIFIED');
 if(candidates.length!==10)blockers.push('TEN_CANDIDATES_REQUIRED');
 if(top.length!==3)blockers.push('THREE_RESEARCH_TARGETS_REQUIRED');
 if(finished.length!==3)blockers.push('THREE_INDEPENDENTLY_GROUNDED_STRATEGIES_REQUIRED');
 if(top.some(x=>x.audit.verdict==='HOLD'))blockers.push('PRIORITY_CANDIDATES_HAVE_UNRESOLVED_EVIDENCE');
 if(top.some(x=>!finished.some(f=>f.candidateId===x.candidateId)))blockers.push('PRIORITY_STRATEGIES_NOT_ALL_VERIFIED');
 const result={
  schema:'REVERSEBUSINESS_GOVERNED_REVIEW_V1',
  idea:s(round.idea),type:round.type||'auto',round:round.round||1,createdAt:new Date().toISOString(),
  canonicalGolden7x7:{verified:canonical,location:canonical?policy.canonical7x7.origin:null,unmodified:true},
  discoveryCount:candidates.length,sourceCount:audit.reduce((sum,x)=>sum+x.sourcedDimensions,0),
  candidates:ranked,researchPriorities:top,strategies:finished,
  rejectedHistory:(round.history||[]).map(x=>({round:x.round,reason:x.reason,selected:x.selected||[]})),
  excludedCount:(round.excluded||[]).length,
  blockers,verdict:blockers.length?'HOLD':'REVIEW_READY',
  warnings:['Research priority is NOT a business-success score.','Supplier claims are not independent verification.','No financial forecasts are generated without real measurements.','REA/3x3/7x7 Golden baselines have not been modified.','WJ approval is distinct from a test PASS.']
 };
 result.evidenceHash=digest({...result,evidenceHash:undefined});
 return result;
}
export function issueDecision(report={},request={},decisionHistory=[]){
 const type=s(request.action).toUpperCase();
 if(!['APPROVE','REJECT'].includes(type))return {ok:false,reason:'UNKNOWN_DECISION'};
 if(report.evidenceHash!==s(request.evidenceHash))return {ok:false,reason:'REPORT_HASH_MISMATCH'};
 if(type==='REJECT'){
  const reason=s(request.reason);
  if(reason.length<8)return {ok:false,reason:'REJECTION_REASON_REQUIRED'};
  return {ok:true,decision:{kind:'REJECTED',reportHash:report.evidenceHash,reason,at:new Date().toISOString(),priorDecisionCount:decisionHistory.length}};
 }
 if(s(request.typedConfirmation)!==CLEARANCE_PHRASE)return {ok:false,reason:'EXPLICIT_WJ_CONFIRMATION_REQUIRED'};
 if(report.verdict!=='REVIEW_READY')return {ok:false,reason:'STRATEGY_NOT_REVIEW_READY',blockers:report.blockers};
 // Local-only confirmation is not a cryptographic identity proof. It never approves a Golden revision or deployment.
 return {ok:true,decision:{kind:'WJ_STRATEGY_APPROVAL_RECORDED_LOCALLY',reportHash:report.evidenceHash,at:new Date().toISOString(),scope:'READ_ONLY_REUSE_HANDOFF',notAllowed:['GOLDEN_CHANGE','AUTO_BUILD','DEPLOY','PAYMENT','PUBLICATION'],identitySecurity:'LOCAL_ONLY_NOT_AUTHENTICATED'}};
}
export function reusableAssetHandoff(report,approval,assets=[]){
 if(approval?.kind!=='WJ_STRATEGY_APPROVAL_RECORDED_LOCALLY'||approval.reportHash!==report?.evidenceHash){
  return {ready:false,status:'BLOCKED_UNAPPROVED_STRATEGY',assets:[]};
 }
 const eligible=assets.filter(a=>s(a.qa)==='PASS'&&s(a.license)&&s(a.source)&&s(a.hash)&&a.readOnly===true);
 if(!eligible.length)return {ready:false,status:'BLOCKED_NO_VERIFIED_REUSE_ASSETS',assets:[]};
 return {ready:true,status:'READ_ONLY_HANDOFF_READY',reportHash:report.evidenceHash,assets:eligible.map(a=>({name:a.name,source:a.source,sha256:a.hash,license:a.license,qa:a.qa})),next:'Use existing rebiz report→check→build→clone-check pipeline AFTER explicit build authorization',execute:false,originalsPreserved:true};
}
