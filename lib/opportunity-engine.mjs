// Opportunity Lab v0.1 — evidence-aware discovery, independent of immutable Golden 7x7.
export const axes=Object.freeze(['Who','What','Where','Market','How','Pricing','Niche']);
const trim=v=>String(v??'').trim().slice(0,2500);
const goodUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!['localhost','127.0.0.1'].includes(u.hostname)}catch{return false}};
const canonical=v=>{try{const u=new URL(v);return(u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')).toLowerCase()}catch{return ''}};
export function normalizeCandidates(items=[],excluded=[]){
 const blocked=new Set(excluded.map(canonical)),seen=new Set();
 return items.filter(x=>goodUrl(x?.url)).map(x=>({
 id:canonical(x.url),url:x.url,name:trim(x.name||x.title||new URL(x.url).hostname).slice(0,140),
 kind:['service','content'].includes(x.kind)?x.kind:'unknown',
 summary:trim(x.summary||x.content||''),source:trim(x.source||'manual/search-unverified'),
 checkedAt:x.checkedAt||new Date().toISOString(),
 axes:Object.fromEntries(axes.map(k=>[k,{status:'UNKNOWN',evidence:[],note:''}])),
 trend:{status:'UNKNOWN',signals:[],risk:[],timeSeries:[]},risks:[],status:'DISCOVERED'
 })).filter(x=>!blocked.has(x.id)&&!seen.has(x.id)&&seen.add(x.id)).slice(0,10);
}
export function validateCandidate(c){
 const errors=[];
 if(!c||!goodUrl(c.url))errors.push('SOURCE_URL_MISSING');
 for(const k of axes){
 const a=c?.axes?.[k];if(!a){errors.push('AXIS_'+k+'_MISSING');continue}
 if(['SOURCED','VERIFIED'].includes(a.status)&&(!a.evidence?.some(e=>goodUrl(e.url)&&e.note?.trim())))errors.push('AXIS_'+k+'_UNSUPPORTED');
 }
 if(c?.trend?.status==='VERIFIED'&&(!c.trend.timeSeries?.length||!c.trend.signals?.some(x=>goodUrl(x.url))))errors.push('TREND_EVIDENCE_MISSING');
 return errors;
}
export function evaluate(c){
 const blockers=validateCandidate(c),
 verified=axes.filter(k=>c.axes?.[k]?.status==='VERIFIED').length,
 sourced=axes.filter(k=>['SOURCED','VERIFIED'].includes(c.axes?.[k]?.status)).length;
 return {verdict:blockers.length?'FAIL':verified===7&&c.trend?.status==='VERIFIED'?'REVIEW_READY':'HOLD',
 verified,sourced,total:7,blockers,
 critical:c.axes?.Who?.status!=='VERIFIED'?'WHO_NOT_INDEPENDENTLY_VERIFIED':c.axes?.Niche?.status!=='VERIFIED'?'NICHE_NOT_INDEPENDENTLY_VERIFIED':'',
 trend:c.trend?.status||'UNKNOWN'};
}
export function selectThree(candidates=[]){
 const ranked=candidates.map(c=>({candidate:c,audit:evaluate(c)})).filter(x=>x.audit.verdict!=='FAIL')
 .sort((a,b)=>b.audit.sourced-a.audit.sourced||a.candidate.id.localeCompare(b.candidate.id));
 return ranked.slice(0,3).map((x,i)=>({...x,role:['당장 시험할 사업','성장 신호를 조사할 사업','틈새 고객을 검증할 사업'][i],status:'STRATEGY_DRAFT_NOT_APPROVED',report:strategyReport(x.candidate,['당장 시험할 사업','성장 신호를 조사할 사업','틈새 고객을 검증할 사업'][i])}));
}
export function newRound(previous=[],reason=''){
 return {excluded:previous.map(x=>({id:x.id,url:x.url,reason:trim(reason),rejectedAt:new Date().toISOString()})),
 queryAdjustment:trim(reason),nextCandidates:[],recommendations:[],status:'RESEARCH_REQUIRED'};
}
export function assertRound(r){if(r.candidates?.length>10)throw Error('MAX_TEN');if(r.recommendations?.length>3)throw Error('MAX_THREE');return true}
// Strategy is a research plan, not a forecast or WJ approval.
export function strategyReport(candidate,role){
 const audit=evaluate(candidate);
 const table=axes.map(axis=>({axis,status:candidate.axes[axis]?.status||'UNKNOWN',
  claim:candidate.axes[axis]?.note||'UNKNOWN',
  sources:(candidate.axes[axis]?.evidence||[]).filter(e=>e.url&&e.note).map(e=>({url:e.url,claim:e.note}))}));
 const unknown=table.filter(x=>x.status!=='VERIFIED').map(x=>x.axis);
 return {
  title:candidate.name,origin:candidate.url,kind:candidate.kind,role,
  verdict:audit.verdict,verifiedAxes:audit.verified,sourcedAxes:audit.sourced,axes:table,
  trend:{status:candidate.trend?.status||'UNKNOWN',evidence:candidate.trend?.signals||[],
   historicalData:candidate.trend?.timeSeries||[],risk:candidate.trend?.risk||[],
   scenarios:[
    {name:'보수적',assumption:'검색 관심이나 판매가 성장하지 않을 수 있음; 신규 투자 이전 수요 확인'},
    {name:'기준',assumption:'현재 공개 사실 유지 가정; 성장률은 증거 미확보로 미산정'},
    {name:'낙관적',assumption:'추가 수요·기술 개선 가능성 검토 대상이며 수치 예측 아님'}]},
  risks:[...(candidate.risks||[]),'증거 미확인: '+(unknown.join(', ')||'추가 독립 감사 필요')],
  revenue:{status:'UNKNOWN_UNLESS_VERIFIED',note:'실제 매출, 가격별 거래, 원가, 마진을 확인하기 전 수익률 예측 금지'},
  strategy:{
   first30Days:'정확한 구매자와 지불 이유 확인; 원본 출처 교차 확인; 경쟁 대안 최소 3개 비교',
   days31to60:'작은 MVP/샘플 제작 후 실제 사용자 행동 관찰; 비용과 품질 측정',
   days61to90:'실제 지불 의사 또는 계약 가능한 실증 후 계속/수정/중단 결정',
   launchDecision:'WJ 최종 승인 전 실행·배포·구매·비용 집행 금지'},
  missing:unknown,sourceIntegrity:'Search snippets or manually entered URLs do not independently verify claims'
 };
}
