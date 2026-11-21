# ReverseBusiness — 실사 10개·전략 3개 독립 QA 기록
- 일시: 2026-11-21 KST
- 브랜치: feat/opportunity-lab-v1
- 원본: AIgoDreamWorld/reversebusiness 기존 main, Golden Workflow / 3×3 / Golden 7×7 — 변경하지 않음
- 배포/유료 검색/유료 AI API/고객 연락/외부 게시/결제: NOT_EXECUTED
- WJ 승인: NOT_EXECUTED

## 실행 증거
| 확인 항목 | 실측/검수 결과 | 판정 |
|---|---|---|
| 공식 사이트·요금표 원본 URL | 후보 10개, 서비스 도메인 10개 고유, 가격 출처 첨부 | PASS(링크 기록) |
| 시장 신호 구분 | TALIS 한국 2024 43%/OECD 36%; 미국 별도 Gallup 2025~26 59%는 일반 AI 업무 사용, 역사영상 수요와 분리 | PASS |
| 실제 업체 매출, 유료 고객, 다년 시장 성장 | 공개 원문·독립 거래 자료를 확보하지 못함 | UNKNOWN/HOLD |
| 전략 분석 | 서로 다른 구매자·수익모델·차별화·실험지표·중단 기준·30/60/90일 3개 작성 | PASS(초안 구조) |
| 원본 7×7 승인 기준 적용 | 49개 공식 문항과 승인 정본을 확보하지 못함; 임시 Who/What/Where/Market/How/Pricing/Niche 원본 변경 없이 별도 사용 | HOLD |
| API 키/비용 | Gemini/OpenAI 키 읽기와 무관한 공개 웹자료 조회만 사용; 유료 API 호출 없음 | PASS |
| 인터랙티브 브라우저 UI | Edge headless 실제 1440×1800 렌더 캡처, 첫 화면에 10·3·0·10과 출처 및 필터 표시 | PASS(렌더) |
| 웹 API | GET /review HTTP 200, GET /api/review JSON, 후보 10·전략 3·시장 신호 2 | PASS |
| 전체 회귀테스트 | npm test: 90 PASS, 0 FAIL, 11 SKIP | PASS_WITH_WARNINGS |
| 7개 조사축 주장 검증 | SOURCED는 업체 설명에 불과하고 VERIFIED/사업성 PASS로 승격하지 않음 | PASS |
| 사업 최종 승인 | WJ 승인 이전 | HOLD |

## 왜 HOLD인가
- 후보별 가격·기능은 주로 공급사의 자기소개이며 고객 지불·성과 데이터를 독립 측정한 것이 아니다.
- 설문 수치(TALIS, Gallup)는 교육 전반의 AI 활용 현황만 가리킨다. 시기·국가·표본이 달라 수요 성장률 비교에 사용하지 않았다.
- YouTube의 반복 대량생산 영상 수익화 제한과 합성 콘텐츠 공개 의무를 준수해야 한다.
- 역사 자료를 AI로 재현할 때 사료 출처·권리·인물 발언·실제/재현 장면을 구분해야 한다.
- WJ 공식 Golden 7×7의 승인된 49개 문항 원본이 아직 확인되지 않았으므로 7×7 PASS로 표시 금지.

## 증거 파일
- `reports/opportunity-review_20261121.json`: 10개 후보 근거·연구 우선순위 가설 점수·3개 전략·UNKNOWN
- `reports/opportunity-review_20261121.md`: 원본 출처와 전략을 모두 포함한 한국어 보고서
- `viewer/opportunity-review.html`: 필터·원본 클릭·증거 펼치기·전략 3개·검수 메모·JSON 내보내기
- `reports/evidence/review-ui_20261121.png`: Windows Edge 실제 브라우저 화면
- `test/opportunity-review.test.mjs`: 신규 구조·근거 분리·권한 보존 검사
- `scripts/render-opportunity-review.mjs`: JSON → 보고서 재생성 (외부 네트워크 사용 안 함)

## 재실행
```powershell
cd C:\Users\admin\AppData\Local\Temp\aiba-rebiz-fork-dev-20261121
node scripts\render-opportunity-review.mjs
npm test
node bin\opportunity-lab.mjs
# Windows 브라우저: http://127.0.0.1:4178/review
```

## 최종 상태
**RESEARCH_DRAFT_WITH_WARNINGS / 10 × HOLD / STRATEGY_3_DRAFT / WJ_PENDING**.

다음 의사결정 한 가지: 1순위 Fliz 벤치마킹 방향의 사료검증형 역사 교육 영상에 대해, 저작권이 확인된 2분 비공개 샘플과 구매자 10명 인터뷰를 수행할지 WJ가 승인한다. 본 보고서 생성은 고객 연락·유료 제작·외부 배포 승인이 아니다.
