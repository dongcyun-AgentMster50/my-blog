# Build 지침 — 8f-4 아랍어 검색어 → 단어장 대응 (작음, 호출 0)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-8-9 표 (나)** "단어장 대응", 17-7-6 5 표의 `(8f-4 선택)` 행(`js/ui/search.js` — 아랍 문자 검색어 → 단어장 번역 일치 → 그 `term` 으로 한 번 더 찾기, "단어장에서 바꿈: …" 한 줄, i18n 1키), 10 결정 표 **8cf-D13 (가)**(8f-3 뒤 작은 8f-4, 호출 0), 11 크기(작음 1h). 운영자 위임(2026-11-15): 권장안으로. **(라) AI 로 바꿔 찾기는 하지 않는다**(기본 끔·설정 없음 그대로). **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8f4-search-vocab-report.md`.

## 읽을 것
- spec 17-8-7(빈 결과 안내)·17-8-9·17-7-6 5 표·10 8cf-D13, 19-1-4 N-D1(관련 줄 — grep).
- 8f-1·8f-3 보고서(`vocab/store.js` 의 `list`·찾기 API, `text/vocab.js` `normalizeTerm`·`fieldValue`), 8g-6(검색어 규칙 — `text/search.js` `parseQuery`), 8g-7(진료과 사전 — 아랍어 진료과 이름은 이미 사전이 받는다: **사전이 먼저**인지 단어장이 먼저인지 지금 코드에서 순서를 보고, 사전 결과를 바꾸지 말 것).
- `.claude/tasks/medreader-crossstep-notes.md` "8f-1 Review 에서 넘긴 것"(단어 id·정규화 메모).

## 할 일
- `js/ui/search.js`: 검색어에 아랍 문자가 있고(8g-7 사전이 받지 않은 경우) 결과가 0 이면 → 그 문서 대상 언어 단어장(없으면 전체)에서 `translation`(정규화·아랍어 접기 — `foldArabic` 재사용, 한 규칙) 이 검색어와 **같은** 항목의 `term` 으로 한 번 더 찾는다. 여러 항목이 맞으면 설계가 정한 대로(없으면 가장 최근 `updatedAt` 하나 + "그 밖 n개" — 보고서에 이유), 찾은 뒤 결과 위에 "단어장에서 바꿈: «원어»" 한 줄(i18n 1키, ar·fr `[검토 — Nour·운영자]`). 단어장에도 없으면 지금 안내(17-8-7) 그대로.
- 호출 0(어떤 경우에도 AI 요청 없음). 저장 레코드·`SEARCH.VERSION`·DB·algoVersion 불변. 사용자 검색어는 기기 밖으로 나가지 않는다.
- 2,070줄 검색 파일 — 고치는 곳은 빈 결과 갈래와 안내 한 줄만, 이유 없는 정리 금지.

## 검증
- `[N]`: 아랍어 검색어 → 단어장 일치 → 원어로 적중, 정규화(하라카트·타마르부타·알리프 꼴·앞뒤 공백), 여러 항목, 일치 없음 → 지금 안내, 라틴·한글 검색어 경로 HEAD 와 같음(8g-6 C7 고정 표 그대로 통과), 8g-7 사전이 받는 진료과 이름은 결과·안내 HEAD 와 같음.
- 호출 0: 흉내 fetch 로 검색 전 과정 요청 0.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless 한 번(Edge 412×915, ar UI, 새 프로필 `b8f4/p1`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔): **작은 영어 합성 PDF**(스크래치에 만든 저작권 없는 글 — 큰 원서로 검색 화면에 들어가지 말 것)에 단어 2–3개를 시트로 저장 → 검색에 아랍어 번역을 쳐서 "단어장에서 바꿈" 한 줄 + 적중 + 리더 강조, 요청 0, 콘솔 오류 0, 가로 넘침 0. 스크린샷 2장 `b8f4/shots/`.
- 변이 2개 이상(정규화 빼기, 사전보다 먼저 단어장, 호출 0 깨기는 흉내로) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8f4/bak/`).
- spec 17-8-9 표 아래 `[정정 2026-11-16 — 8f-4 Build]` 한 줄(넣은 규칙·여러 항목 처리·사전과의 순서 — Edit 로 그 자리만).

## 수정 범위
`js/ui/search.js`, (필요하면) `js/vocab/store.js` 에 읽기 함수 하나(이유를 보고서에), i18n 4개(1키), `tests/` 새 파일, `index.html`(stamp), `spec.md`(한 줄), 스크래치패드 `b8f4/`, 보고서. `text/search.js`·`text/specialty.js`·`pipeline.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. headless 는 한 번에 하나. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
