// Human-readable WJ review memo. It never writes an approval or fabricates quantitative forecasts.
const tidy=x=>String(x??'UNKNOWN').replace(/\r?\n/g,' ').replace(/\|/g,'/').slice(0,1800);
const link=x=>{try{const u=new URL(x);return ['https:','http:'].includes(u.protocol)?u.toString():'UNKNOWN'}catch{return 'UNKNOWN'}};
export function exportResearchMarkdown(r){
 if(!r||r.schema!=='REVERSEBUSINESS_GOVERNED_REVIEW_V1')throw Error('GOVERNED_REPORT_REQUIRED');
 const out=[],put=s=>out.push(s);
 put('# ReverseBusiness — 사업 기회 근거 검증 보고서');
 put('분야: '+tidy(r.idea));
 put('검토 회차: '+r.round+' | 생성 시각: '+r.createdAt+' | 보고서 SHA-256: '+r.evidenceHash);
 put('');
 put('## 최종 판정: '+r.verdict);
 put('**이 문서는 시장 성공 보증이 아니라 검증된 것/미검증을 구분하는 전략 감사 기록입니다.**');
 put('승인된 Golden 7×7 정본: '+(r.canonicalGolden7x7.verified?'READ_ONLY_LINKED':'NOT_VERIFIED / HOLD'));
 put('');
 put('### WJ 전략 승인 전 차단 사유');
 for(const b of r.blockers)put('- '+tidy(b));
 if(!r.blockers.length)put('- 검증 보고 준비 완료. 이것이 WJ 최종 승인이라는 의미는 아님.');
 put('');
 put('## 발견된 사업 10개 (검토 근거순, 사업 성공률 순위 아님)');
 put('| 검색/검토 순서 | 사업 후보 | 공급자 URL | 잠정 판정 | 근거 입력 | 독립 확인 |');
 put('|---:|---|---|---|---:|---:|');
 for(const [i,c] of r.candidates.entries()){
  put('| '+(i+1)+' | '+tidy(c.name)+' | '+link(c.url)+' | '+tidy(c.status)+' | '+c.audit.sourcedDimensions+'/7 | '+c.audit.verifiedDimensions+'/7 |');
 }
 put('');
 put('## 후보별 사실·미확인·자료 원본');
 for(const [i,c] of r.candidates.entries()){
  put('### '+(i+1)+'. '+tidy(c.name));
  put('**원본 URL:** '+link(c.url));
  put('**검색 단계 설명 (미검증):** '+tidy(c.summary));
  put('**검증 상태:** '+c.audit.verdict+' / 출처가 있는 임시 조사축 '+c.audit.sourcedDimensions+'/7 / 독립 근거 확인 축 '+c.audit.verifiedDimensions+'/7');
  for(const [axis,e] of Object.entries(c.axes||{})){
   put('- **'+tidy(axis)+'** '+tidy(e.status)+' — '+tidy(e.note));
   for(const x of e.evidence||[])put('  - '+link(x.url)+' / '+tidy(x.note)+' / 원문 스냅샷 SHA-256: '+tidy(x.contentHash||'NOT_CAPTURED'));
  }
  put('**실제 구매·성장·생산비 증거 부족 시:** HOLD');
  for(const b of c.audit.blockers)put('- 검증 부족: '+tidy(b));
  for(const b of c.audit.problems)put('- 근거 문제: '+tidy(b));
  if(c.risks?.length)for(const b of c.risks)put('- 기타 위험: '+tidy(b));
  put('');
 }
 put('## 검토 우선 대상 3개 (사업 추천 아님)');
 for(const c of r.researchPriorities){
  put('- '+c.position+'. '+tidy(c.name)+' — '+tidy(c.status)+' / '+tidy(c.why)+' / '+link(c.url));
 }
 put('');
 put('## 증거 기준을 통과한 전략 보고서');
 if(!r.strategies.length)put('**0개 — 현재 근거로는 사업 전략 3개를 승인 가능한 형태로 만들 수 없음.**');
 for(const row of r.strategies){
  const s=row.content;
  put('### '+tidy(row.candidateId));
  for(const field of ['customer','problem','offer','competition','revenue','distribution','cost','risks','differentiation','evidence']){
   put('- '+field+': '+tidy(s[field]));
  }
  for(const source of s.sources||[])put('- 사업 주장 '+tidy(source.claim)+': '+link(source.url));
 }
 put('');
 put('## WJ 결론 / REA 독립 제작 인계');
 put('- WJ 승인 없이 생산·배포·구매·코드 변경 자동 실행: 금지');
 put('- 기존 기술 우선: rebiz CLI / REA 수집기 / 내 버전 생성기 / 원본과의 중복 검사');
 put('- 기술 자산 인계: 승인 보고서 해시 일치 + 검증된 자산 QA와 원본 라이선스 필요');
 put('- 결과가 HOLD이면 고객 수요 검증과 독립 근거 확보부터 진행');
 put('- 승인된 Golden 7×7 원본은 변경·대체하지 않음');
 put('');
 return out.join('\n')+'\n';
}
