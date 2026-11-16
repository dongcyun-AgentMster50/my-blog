# Build 지침 — 8f-2 단어 시트 (선택 줄 [단어 번역] 켜기)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-7-6** 중 8f-2 몫 — 3(손짓 표)·4-2(선택 동작 줄 — [단어 번역] 켜기)·4-3(찾는 순서 — 호출 0 먼저)·4-5(단어 시트)·5 표의 8f-2 행·6(호출)·7(i18n `vs.*` 약 16키)·8 "8f-2" 수용 기준·9·10(권장안)·12(실기기 — 적기만), 그리고 17-7-6 안의 `[정정 2026-11-16 — 8c-1 Build]`·`8c-1b`·`8c-1c`·`8f-1 Build` 줄 전부. 운영자 위임(2026-11-15): 권장안으로 — 8cf-Q1–Q3 는 설계 기본값대로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8f2-wordsheet-report.md`.

## 읽을 것
- 위 spec 항목, 8f-1 보고서 `.claude/tasks/medreader-build-8f1-vocab-data-report.md`(만든 API — `vocab/store.js` `findTerm`·`save`·`update`, `text/vocab.js` `findInSentenceTr`·`normalizeTerm`, `pipeline.translateTerms`), 8f-1 Review 절(review.md 끝 "8f-1 Review" — 넘겨진 낮음이 있으면 반영).
- 8c-1 보고서들(`medreader-build-8c1-taptr-report.md` 8절 "이어받을 자리" — `SEL_ACTIONS`·`refresh`·`#trSlot`), `selbar.js`·`trband.js` 지금 코드.
- `.claude/tasks/medreader-crossstep-notes.md` — **"8f-2·11-2" 절**: 서재 삭제 확인의 "남습니다" 줄(단어장·요약·기억 카드)을 **한 함수로**(11·12 가 같은 함수에 줄을 더한다). 지금은 단어장 한 줄만.
- crossstep **"8f-1 Review 에서 넘긴 것" 의 8f-2 줄**: 실패한 단어를 사용자가 다시 누르면 `translateTerms(…, {retry:true})`.
- 8f-1 보고 남은 문제 1: `findInSentenceTr` 후보가 용어 앞 낱말(«من»·«환자는»)을 섞는다 — 시트에서 후보를 고치기 쉬운지(번역 칸 미리 채움 + 편집) 확인하고, 순수 함수에서 작게 다듬을 수 있으면 다듬되(8f-1 시험 그대로 통과) 아니면 보고서에.

## 할 일
설계 5 표 8f-2 행 그대로: 새 `js/ui/wordsheet.js`·`tests/wordsheet-8f.test.mjs`, 고칠 `js/ui/selbar.js`([단어 번역] 켜기)·`js/ui/library.js`(삭제 확인 "남습니다" 한 함수)·`index.html`(시트)·`css/reader.css`·i18n 4개(`vs.*`, ar·fr 은 `[검토 — Nour·운영자]`). 찾는 순서는 호출 0 먼저(저장된 단어 → 문장 번역에서 찾기 → [AI 로 번역] 눌렀을 때만 `translateTerms` 1호출). 시트는 RTL·가로 dock·8e `[≡]`·8d·탭 띠·9b 듣는 중과 겹치지 않게, Esc·포커스 가둠·닫으면 선택했던 곳으로 포커스(8c-1c 의 Esc 층 순서에 시트를 가장 위 층으로 더함). 번역 요청 바이트·캐시 키·DB·algoVersion·`PROMPT_VERSION` 불변. 단어장 링크(`#/vocab/:docId`)는 마크업만 두고 숨김(8f-3 이 켬).

## 검증
- 수용 기준 "8f-2" 전부(`[N]` 테스트, `[D]` headless, `[M]` 보고서 실기기 목록).
- 호출 수: 저장된 단어·문장 번역에 있는 단어 → 0, [AI 로 번역] → 1(같은 낱말·문맥 다시 → 0), 키 없음·capped·offline 표시.
- 회귀: 8c-1 탭 번역·선택 줄·Esc 층 순서·손가락 판정(앞 Review 하네스 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r8c1c\` 읽기만 — 재사용 가능), 번역 요청 본문 바이트 HEAD 와 같음, 서재 문서 삭제(term 남음).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless(Edge 412×915 세로·915×412 가로, ko·ar UI, 새 프로필 `b8f2/p*`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔): 길게 눌러 선택 → [단어 번역] → 시트(호출 0 길·AI 길·저장·번역 없이 저장·고친 번역 덮어쓰기 확인·같은 언어·너무 김), 저장 뒤 다시 열면 저장된 것, 가로 넘침 0, 48px, 콘솔 오류 0. 스크린샷 4–6장 `b8f2/shots/`.
- 변이 3개 이상(설계 9 우선 — 예: 찾는 순서에서 저장 단어 건너뛰기, 시트 열 때 자동 AI 호출, 삭제 확인 함수에서 단어장 줄 빼기, Esc 층에서 시트 빼기) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8f2/bak/`).
- spec 17-7-6 안 `[정정 2026-11-16 — 8f-2 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 5 표 8f-2 행의 파일 + (Esc 층에 시트를 더하는 데 필요하면) `js/ui/controls.js`·`js/ui/trband.js` 몇 줄(보고서에 이유) + `js/text/vocab.js`(후보 다듬기 — 할 때만) + `index.html`(stamp 포함) + `tests/` + `spec.md` + 스크래치패드 `b8f2/` + 보고서. `pipeline.js`·`prompts.js`·`provider.js`·`db.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프로 묶지 말 것**(앞 Build 들이 어겼다). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름). 8000 python 쓰기만, 끄지 마라. 8123·8124·8125 node 건드리지 마라. headless 는 한 번에 하나씩(동시에 띄우면 8000 이 연결을 거절한 적 있음). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 큰 원서로 검색 화면에 들어가지 말 것. 의학책(읽기만, Downloads 목록 보지 말 것): `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
