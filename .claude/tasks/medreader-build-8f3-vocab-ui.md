# Build 지침 — 8f-3 단어장 화면 · CSV 내보내기/가져오기

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-7-6** 중 8f-3 몫 — 4-6(단어장 화면)·5 표의 8f-3 행·6(호출)·7(i18n `vocab.*` 약 30키)·8 "8f-3" 수용 기준·9·10(권장안)·12(실기기 — 적기만), 그리고 17-7-6 안의 모든 `[정정 2026-11-16 …]` 줄(특히 `8f-1 Build` 의 4-6 정정 "같은 `updated` 에 내용이 다르면 바뀜", `8f-2 Build`). 운영자 위임(2026-11-15): 권장안으로 — 8cf-Q2(CSV 문맥 문장 — 공유 주의 한 줄)는 설계 기본값대로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8f3-vocab-ui-report.md`.

## 읽을 것
- 위 spec 항목, 8f-1·8f-2 보고서(`.claude/tasks/medreader-build-8f1-vocab-data-report.md`·`medreader-build-8f2-wordsheet-report.md`), review.md 의 "8f-1 Review"·"8f-2 Review" 절.
- `.claude/tasks/medreader-crossstep-notes.md` — **"8f-1 Review 에서 넘긴 것" 의 8f-3 줄을 반드시 반영(시작 전 반드시)**:
  ① `importPlan` 에서 파일 `updated` 칸이 비었거나 못 읽는 꼴(`dd/mm/yyyy` 등 스프레드시트가 바꾼 꼴)이면 **충돌**(미리보기에서 사용자가 고름) — 기기 쪽을 조용히 덮지 않는다.
  ② `store.update`·`importPlan` 비교 전에 값 공백을 같은 규칙으로 정규화 — 방금 내보낸 CSV 를 그대로 가져오면 "그대로 n", `edited`·`updatedAt` 불변.
  ③ 실패 단어 다시 누름 `retry:true`.
- **8f-2 Review(8f2R) 낮음 — 이 단계에서 `wordsheet.js` 를 고치므로 함께**: ② 단추 세트가 바뀔 때(키보드 Enter 로 [이 문맥으로 다시 번역]·[AI]·[번역 없이 저장]) 포커스가 BODY 로 빠짐 → 시트 안 다음 알맞은 단추로 ③ 덮어쓰기 질문이 낭독기에 안 들림(`#wsAsk` 에 live, 상태 줄 비우지 말 것) ④ 질문 중 `retranslate()` 재호출이 묻지 않고 force 1호출 → 질문 중엔 무시 ⑤⑥ 시험 구멍(흐름의 [AI] 연타 막기, 문맥 바꾸기 patch 의 `docId`) ⑦ 915×412 에서 [저장]·[AI] 가 긴 문장 번역 아래 — 단추를 위로 또는 고정 ⑧ `vs.hint` 가 이제 생기는 단어장 화면과 맞는지 ⑩ 여러 줄 선택 끝이 낱말 가운데면 넓히기(작으면).
- 8f-2 보고 남은 문제 2·3: 다시 번역 뒤에도 `edited` 가 남음(`store.update` 가 내리지 못함) — 이 단계에서 규칙을 정한다(다시 번역을 사용자가 받아들이면 `edited:false`, spec 정정 줄로). 이미 있는 항목의 뜻·메모 편집은 이 단계의 편집 화면에서.

## 할 일
설계 5 표 8f-3 행 그대로: 새 `js/ui/vocab.js`·`tests/vocab-ui-8f.test.mjs`, 고칠 `js/router.js`·`js/main.js`(+4)·`js/ui/library.js`(상단 [단어장]·카드 메뉴)·`js/ui/wordsheet.js`(단어장 링크 켜기)·`index.html`(섹션)·`css/screens.css`·i18n 4개(`vocab.*`, ar·fr 은 `[검토 — Nour·운영자]`). 위 ①② 를 위해 `js/text/vocab.js`·`js/vocab/store.js` 를 고칠 수 있다(8f-1 시험은 뜻이 바뀌는 곳만 고치고 이유를 보고서에). 화면: 목록(문서별·전체, 찾기, 정렬)·편집(번역·뜻·메모·문맥)·삭제·CSV/Anki 내보내기·CSV 가져오기 미리보기(새 n·바뀜 n·그대로 n·충돌 n·거절 n과 사유, 고르기). 호출은 설계 6절대로(목록·편집·내보내기·가져오기 0). 번역 요청 바이트·캐시 키·DB 3·algoVersion·`PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "8f-3" 전부(`[N]` 테스트, `[D]` headless, `[M]` 실기기 목록). 특히 "한 칸 고친 CSV → 바뀜 1", "그대로 가져오기 → 그대로 n·변화 0", `updated` 를 `dd/mm/yyyy`·빈칸으로 바꾼 CSV → 충돌로 표시·기기 값 그대로(고르기 전), 엑셀식 BOM·CRLF·따옴표·수식 접두.
- 내보낸 파일에 키 문자열 0, 문맥 문장 공유 주의 한 줄.
- 회귀: 8f-2 시트·8c-1 선택 줄/탭 띠·Esc 층, 서재(목록·삭제 확인 "남습니다"), 번역 요청 본문 바이트 HEAD 와 같음.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless(Edge 412×915·915×412, ko·ar UI, 새 프로필 `b8f3/p*`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**): 단어 몇 개 저장 → 단어장 화면 → 편집·삭제 → 내보내기(다운로드는 headless 의 `Browser.setDownloadBehavior` 로 스크래치 폴더에 — 사용자 Downloads 금지) → 고쳐서 가져오기 미리보기 → 적용. 가로 넘침 0, 48px, RTL, 콘솔 오류 0. 스크린샷 4–6장 `b8f3/shots/`.
- 변이 3개 이상(① 못 읽는 `updated` 를 파일 승으로, ② 정규화 빼기, 수식 접두 방어 빼기, 미리보기 없이 바로 적용) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8f3/bak/`).
- spec 17-7-6 안 `[정정 2026-11-16 — 8f-3 Build]` 줄(Edit 로 그 자리만).

## 수정 범위
설계 5 표 8f-3 행의 파일 + `js/text/vocab.js`·`js/vocab/store.js`(①② 와 `edited` 규칙만) + `index.html`(stamp 포함) + `tests/` + `spec.md` + 스크래치패드 `b8f3/` + 보고서. `pipeline.js`·`prompts.js`·`provider.js`·`db.js`·`readalong.js`·`trband.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름). 8000 python 쓰기만, 끄지 마라. 8123·8124·8125 node 건드리지 마라. headless 는 한 번에 하나씩. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 큰 원서로 검색 화면에 들어가지 말 것. 의학책(읽기만, Downloads 목록 보지 말 것): `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
