// A read-only lookup of existing fork assets. Does NOT copy third-party sources or claim end-to-end QA.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const known=Object.freeze([
 {id:'original-rebiz-cli',name:'기존 ReverseBusiness 실행·분석 CLI',source:'bin/rebiz.mjs',usage:'URL 연구/검증/내 버전 제작 명령 라우팅'},
 {id:'grounded-collector',name:'공개 웹 근거 수집',source:'skill/reversebusiness/tools/collect.mjs',usage:'robots 및 공개 페이지 제한에 따르는 근거 수집'},
 {id:'rea-import',name:'REA Evidence 가져오기',source:'skill/reversebusiness/tools/from-rea.mjs',usage:'기존 복원 결과와 증거 자료 연결'},
 {id:'site-starter',name:'독립 페이지 출발점',source:'skill/reversebusiness/tools/make-site.mjs',usage:'WJ 승인 후 원본과 구분되는 첫 페이지 만들기'},
 {id:'clone-audit',name:'독창성 중복 검사',source:'skill/reversebusiness/tools/check-clone.mjs',usage:'원본 문구/브랜드/자산 무단 복제 방지'},
 {id:'apply-plan',name:'기존 프로젝트에 적용 계획',source:'skill/reversebusiness/tools/apply-plan.mjs',usage:'기존 프로젝트 차이만 뽑는 변경 계획'}
]);
export function listKnownReusableAssets(root){
 return known.map(x=>{
  const f=path.resolve(root,x.source);
  if(!f.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(f))return {...x,status:'MISSING',sha256:null,license:'MIT_REPO',qa:'HOLD',readOnly:true};
  const buf=fs.readFileSync(f);
  return {...x,status:'SOURCE_PRESENT',sha256:createHash('sha256').update(buf).digest('hex'),license:'MIT_REPO',qa:'UNIT_TESTS_ONLY',readOnly:true,verifiedForProduction:false};
 });
}
export function mapAssetsToHandoff(list){
 return (Array.isArray(list)?list:[]).map(a=>({
  name:a.name,source:a.source,hash:a.sha256,license:a.license,qa:a.qa==='PASS'?'PASS':'HOLD',readOnly:a.readOnly===true
 }));
}
