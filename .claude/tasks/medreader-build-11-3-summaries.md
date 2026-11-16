# Build 지침 — 11-3 저장한 요약 모아 보기 · 범위 개요(11c) · 내보내기

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-2-1** 중 11-3 몫 — 4-6(모아 보기·범위 개요·내보내기)·5 표 11-3 행·6(호출 — [개요 만들기] 1, 같은 범위·같은 요약 0)·7(i18n `summaries.*` 약 26)·8 "11-3" 수용 기준·공통·9·10 결정 표(11-D14·11-D19 권장안)·13(실기기 — 적기만), 17-2-1 안의 모든 `[정정 2026-11-17 …]` 줄. 운영자 위임: 권장안으로 — 11-Q4(내보내기 `.txt` 에 요약·용어만 + 공유 주의 한 줄)는 설계 기본값. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-11-3-summaries-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- 11-1·11-2 보고서와 review.md 의 "11-1 Review"·"11-1b 재검증"·"11-2 Review" 절(넘긴 것 반영).
- crossstep **11-3 줄(11-1R #5)**: **개요 범위 이름(PDF 장 제목)이 DOC 밖 TASK 안에 들어간다** — 이름을 DOC 데이터 쪽으로 옮기거나(구분자 탈출 그대로) TASK 에는 쪽 숫자만. 지시문 바이트가 바뀌면 `OUTLINE_PROMPT_VERSION` 판단(개요 캐시는 아직 배포된 화면에서 만들어진 적 없음 — 이유를 보고서에). 인젝션 꼴(줄바꿈·`>>>`·지시문 꼴 80자) 시험.
- 11-1 의 `exportText` 꼴은 이 단계에서 다듬어도 된다(BOM·CRLF·RTL·키 0 수용 기준).
- 서재 카드 `[⋯]` 메뉴(8f-3 "이 책의 단어장"·18 이후 꼴)에 "이 책의 저장한 요약" 한 줄, 11-2 요약 시트의 링크 켜기.
- 9c 백업: `annotations` 는 이미 담김 — 화면만.
- **11-2 Review(11-2R) 낮음 — `sumsheet.js` 를 이번에 고치므로 함께(작음)**: ① 음성 요약의 요지를 말하는 중 Esc 로 시트를 닫으면 말하기·낭독 재개가 이어짐 — [×]와 같게 `cancelVoice` 경로로 ③ 시트 `run()` 의 `my !== gen`(닫은 뒤 늦은 결과 버림)을 지키는 node 시험(변이 X2) ⑥ 쪽이 바뀐 뒤 시트의 "이 쪽 전체 요약" 이름이 지금 보이는 쪽과 다름 — "p.N 전체 요약"처럼 쪽 번호를 넣거나 쪽이 바뀌면 그 단추를 숨김(작은 쪽). ②(마이크 재탭 `stopAsk` 시험 — 변이 X6)는 `voice.js` 범위 밖이면 crossstep 후보로.

## 할 일
설계 5 표 11-3 행 그대로: 새 `js/ui/summaries.js`·`tests/summaries-ui-11c.test.mjs`, 고칠 `js/router.js`·`js/main.js`(+4)·`js/ui/library.js`(카드 [⋯] 한 줄)·`js/ui/sumsheet.js`(링크 켜기)·`index.html`(섹션)·`css/screens.css`·i18n 4개(약 26키, ar·fr `[검토 — Nour·운영자]`). 위 범위 이름 고침을 위해 `js/ai/prompts.js`(개요 요청 빌더만)·`js/text/summary.js`(`outlineInput`·`exportText`)를 고칠 수 있다 — **번역·단어·요약(문단) 요청 바이트 불변**을 시험으로. 호출은 설계 6절대로. DB 3·algoVersion·번역 `PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "11-3" 전부(`[D]` headless — 흉내 Gemini `responseSchema` 로 개요 갈래, `createObjectURL` 가로채 내보내기 Blob 읽기 — 사용자 Downloads 금지), 변이(설계 11-3 끝 셋) + 범위 이름 인젝션 변이 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b11-3/bak/`).
- 회귀: 11-2 시트·[⋯]·음성, 8f-3 단어장 화면·라우터(`#/vocab`), 서재 카드 메뉴, 8c-2 사용량, 번역·단어·요약 요청 본문 바이트 HEAD 와 같음.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless: Edge, pipe, 새 프로필 `b11-3/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF(`b11-2/syn.pdf` 읽기만 또는 새로). 360×740·915×412 × 4언어. 콘솔 오류 0. 스크린샷 3–5장 `b11-3/shots/`.
- spec 17-2-1 안 `[정정 2026-11-17 — 11-3 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 5 표 11-3 행의 파일 + `js/ai/prompts.js`(개요 빌더만)·`js/text/summary.js`(위 둘) + `index.html`(stamp 포함) + `tests/` + `spec.md` + 스크래치패드 `b11-3/` + 보고서. `pipeline.js`·`db.js`·`notes/*`(부르기만)·`backup/*`·`selbar.js`·`voice/*`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 실물 PDF 문장·요약 글은 결과에 넣지 않는다. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
