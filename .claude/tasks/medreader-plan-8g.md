# Plan 지침 — 8g 검색 (키워드·제목·목차로 찾기) 단계 Plan

> 너는 **Plan 서브에이전트**다. 앱 코드를 고치지 않는다. 결과는 `apps/medreader/spec.md` **17-8** 에 새 소절 **"17-8-12. 8g 단계 Plan"** 으로 쓰고(기존 17-8-1~11 은 고치지 않는다 — 바뀐 전제는 새 소절에서 "17-8-x 갱신"으로 적는다), 같은 내용의 요약을 `.claude/tasks/medreader-plan-8g-report.md` 에 쓴다. **커밋하지 않는다.** 한국어로 쓴다. 결정이 필요한 곳은 선택지와 권장안.

## 운영자 결정
- 2026-10-12: 검색을 넣는다 — spec 17-8(방식 (i-b) 쪽별 검색 글자 + 열린 책 메모리 캐시, `searchText` 스토어, 목차는 PDF 개요 먼저·없으면 heading 폴백, 낭독 중 결과로 이동하면 멈춤, AI 호출 0·오프라인).
- 2026-10-18: 8i 행 표 일이 끝났으니 **지금 8g 를 한다.**

## 17-8 을 쓴 뒤(2026-10-12) 바뀐 것 — 반드시 반영
- 배포 안전장치가 들어갔다: import map 도장(`dev/stamp-importmap.mjs`), `db.js` `DERIVED_STORES`·`db.resetDerived`([텍스트 다시 추출]). 17-8-10 끝 메모 참고.
- **algoVersion 은 지금 12**(8i = 11, 8i-2 = 12). 행 표: 새 문단 종류 `rowhead`(주제·이름표 칸), 쪽 번호 줄 role `ref`(흐름 밖), 열 머리 `colhead`(접힘). spec 4-13-7 에 "8g 목차 폴백에 rowhead 를 섞지 않는다" 류의 한 줄이 있다 — 확인하고 따른다. 검색 대상에 rowhead·ref·colhead 를 넣을지 정한다(spec 원칙: 리플로우가 보이는 글자 + 표 줄, 접힌 줄 제외 — ref 는 화면에 회색 숫자로 보인다).
- 8h: 인용·참고문헌(cite) 단위는 낭독·번역에서 빠지지만 화면에는 있다 — 검색 대상인가.
- 8i-1·8i-3: 재추출 중 지금 쪽 다시 그리기, 쪽 넘김 렌더 완료 알림(`createRenderDone`), `goToPageForSpeech`. 검색 결과로 이동(17-8-8: 강조·스크롤·낭독 멈춤·적중 문장을 다음 [▶] 시작점)이 이 경로들과 어떻게 맞물리는지.
- 재추출 중(옛 판 쪽)에 검색하면 — `searchText` 는 언제 채우고 판이 바뀌면 어떻게 무효화하나(`DERIVED_STORES` 와 algoVersion).
- DB 버전: 17-8-3 은 "DB 버전 3" 이라 했다 — 지금 `db.js` 의 실제 버전과 맞춘다.

## 읽을 것
spec 17-8 전체, 16절(수용 기준 형식), 4-13-7, 6-6(8h cite), 7-8(번역 단위), 9절(저장소), 12-x(리더 화면), 18·19절의 검색 줄. 코드: `js/db.js`(또는 `js/store/*`), `js/pdf/extract.js`, `js/text/layout.js`(algoVersion), `js/ui/reader.js`(`goPage`·`goToPageForSpeech`·하이라이트), `js/ui/controls.js`, `js/tts/text.js`(`buildUnits`·`ranges`), `js/i18n/*`(네 언어: ko·en·ar·fr — 확인), `index.html`, `dev/stamp-importmap.mjs`. 17-8-1 실측에 쓴 dev 도구가 있으면 그것도.

## 계획할 것
A. **17-8 을 지금 코드에 맞춰 갱신** — 위 "바뀐 것" 항목마다 결정 또는 선택지.
B. **실측 다시**(세 권, 앱 모듈로): 쪽별 검색 글자 크기 합(저장소 증가량), 색인 구축 시간(데스크톱 → 폰 ×3–5 추정), 검색어 몇 개(예: 흔한 낱말·드문 낱말·여러 낱말·하이픈 낱말·약어)의 검색 시간과 적중 수. 측정 스크립트는 `apps/medreader/dev/` 에 새 파일로.
C. **목차**: 세 권의 PDF 개요(outline) 유무·깊이·쪽 대응(인쇄 쪽 vs PDF 쪽 38쪽 어긋남 포함), heading 폴백의 품질(8i 의 rowhead·colhead 가 섞이지 않는지).
D. **화면**(`ui/search.js`): 412px 모바일, 키보드 없이 쓰는 경로(최근 검색·목차 탭), 네 언어 i18n 키 목록(새 키는 네 언어 모두), 아랍어 RTL. 결과 목록 → 이동 → `[읽던 곳으로]`.
E. **16절 형식 수용 기준**(17-8-11 뼈대를 다듬어), Build 나누기(가능하면 데이터 → 엔진 → 목차 → 화면 순으로 작게), 테스트·변이 목록, 되돌림. 하기 어려운 부분은 "이번엔 못 함"으로 정직하게.

## 측정 실행 규칙
- 모든 실행에 시간 상한(`timeout`). 띄운 프로세스는 정리하고, 못 끄면 PID 보고.
- pdf.js: 스크래치패드 `pdfjs/` 는 없어졌다. 8i-2 Build·Review 가 쓴 이 기계의 pdfjs-dist 5.6.205 경로를 `.claude/tasks/medreader-build-8i-2-report.md` 에서 찾아 쓴다(앱은 CDN 5.4.149 — 수치에 영향이 있을 만한 곳은 적어 둔다). npm 설치·다운로드 금지.
- 큰 출력은 스크래치패드 `p8g/` 에. 브라우저·프로필 복사는 필요 없다.
- 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고한다.

## 동시 작업 주의
다른 Build(8i-2b)가 동시에 `js/text/rowtable.js`·`tests/rowtable*`·`index.html` 을 고친다. 너는 그 파일들을 읽기만 하고, spec 은 17-8 새 소절과 목차 표시만 고친다.

## 금지
앱 코드 수정, 커밋, npm 설치·다운로드, `git checkout/restore/stash`, `rm -rf`, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
