# Build 지침 — 다듬기 4 (동작·안전: 화면 가림 · 확인 없는 지움 · 429 판정 · 캐시 · 백업 입력)

> 너는 **Build 서브에이전트**다. 배포된 단계들의 Review "낮음" 중 사용자에게 실제로 해가 되는 것을 모아 고친다. 출처는 `.claude/tasks/medreader-crossstep-notes.md` "다음 다듬기 묶음 후보"·"운영자에게 물을 것"(알림 줄)과 review.md 각 절. 운영자 위임: 권장안으로. **AI 호출 수를 늘리는 변경 금지**(자동 재시도 0). DB 3 · 판본 상수·`algoVersion` 불변. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-polish4-report.md`. 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\bp4\`(먼저 만들 것).

## 고칠 것 (각각 작게 — 하나가 커지면 멈추고 보고서에 "못 함 + 이유")
1. **원본 보기 → 검색 화면에서 숨긴 리더가 검색 화면을 가림**(8c-1cR — HEAD 부터): `css/reader.css` `body:has(.original) .screen[data-screen="reader"]{display:flex}` 가 `[hidden]` 을 이긴다 → `:not([hidden])`. 같은 꼴 `.sum-sheet .sum-link{display:flex}`(11-3 이 `screens.css` 한 줄로 막아 둠)도 `reader.css` 쪽에서 바로 고치고 `screens.css` 임시 줄 제거. `display:` 가 `[hidden]` 을 이기는 규칙을 css 전체에서 grep 해 같은 꼴을 표로(고칠 것만 고침).
2. **[기본 목록으로 되돌리기]가 확인 없이 사용자 목록을 지움**(18R 1순위): 사용자 목록이 배열일 때만 페이지 안 `<dialog>` 확인(13-2·20-2 와 같은 장치, `confirm()` 금지).
3. **서재 문서 삭제 확인이 `confirm()`**(20-3 남은 8·15-2 남은 3): 같은 `<dialog>` 로 — "남습니다" 줄(단어장·요약·카드·필기)과 "지워집니다" 줄(AI 문제 n)을 그대로 담기. 취소·확인·Esc·초점 돌아옴.
4. **429 를 모두 "오늘 한도"로 읽음**(8c-1R·8c-2 — `js/ai/pipeline.js`·어댑터): Gemini 429 응답의 `error.details` 안 `QuotaFailure.violations[].quotaId`(예: `…PerMinute…`·`…PerDay…`)와 `RetryInfo.retryDelay` 로 — 분 한도 → `cooldown`(재시도 가능 시각 = retryDelay, 없으면 60초) · 일 한도 → `exhausted` · 못 읽음 → 지금처럼 `exhausted`(보수). **자동 재시도 0** — cooldown 이 끝나면 띠·상태 바가 "[다시 시도]" 로 바뀔 뿐. 띠(`readalong.blocked.*`)·상태 바(`ai.state.*`)·사용량 화면 문구 4언어(ar·fr `[검토 — Nour·운영자]`). 흉내 응답은 Gemini 문서의 오류 꼴을 합성(진짜 요청 금지) — 꼴을 확신할 수 없으면 판정을 "못 읽음 → exhausted" 로 남기고 보고서에 "실기기 확인".
5. **낭독 동반 번역이 다음 세션에서 캐시 적중 없이 요청 2건을 다시 냄**(8qR-6a — HEAD 끼리도): 원인을 찾아라(캐시 키에 세션마다 바뀌는 값? 쓰기 전에 떠남? 읽기 순서?). headless 두 세션(같은 프로필, 흉내 Gemini)으로 재현 → 고침 → 두 번째 세션 요청 0. 고침이 번역 요청 **본문 바이트**를 바꾸면 안 된다(캐시 키·저장 시점만). 원인이 설계상 의도(예: 만료)면 고치지 말고 보고서에.
6. **백업 가져오기 입력 안전**(9c-2 — 9c1R #10·#3·18R-8): `lineSplitter` 줄 길이 상한(예: 8MB — 첫 줄 전에 넘으면 `not-backup`) · 가져오기 때 객체 **속성 이름**도 `BACKUP.KEY_PATTERNS` 검사 · `links.medical` 항목 `id` 꼴 검사 + `ui/links.js` `cssId` 를 `CSS.escape` 로(없으면 지금 방식).

## 검증
- 항목마다 시험(node 또는 headless)과 변이 하나 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `bp4/bak/`).
- 회귀: 원본 보기·검색·요약 시트, 18 링크 설정, 서재 삭제(남는 것·지워지는 것 수), 낭독 동반 번역·탭 번역·단어·요약·설명·출제·개념도 **요청 본문 바이트 HEAD 와 같음**, 9c 내보내기/가져오기 멱등(정상 파일).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독), `--check` 0, `git diff --check` 0. 바뀐 파일 특수 글자 수 HEAD 와 같음(Write/Edit 이스케이프 사고 주의).
- headless: Edge, pipe, 새 프로필 `bp4/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔(5번 재현은 캐시 켬·같은 프로필 두 세션), **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 360×740·412×915 × ko·ar. 콘솔 오류 0.
- spec 해당 절에 `[정정 2026-11-18 — 다듬기 4]` 줄(Edit 로 그 자리만).

## 수정 범위
`css/reader.css`·`css/screens.css`·`js/ui/links.js`·`js/ui/settings.js`(18 되돌리기 자리면)·`js/ui/library.js`·`js/ai/pipeline.js`·`js/ai/adapters/*`(429 해석만)·`js/ui/*` 상태 문구 자리·`js/backup/*`·`js/text/backup.js`·캐시 원인 파일(5번 — 이유를 보고서에)·i18n 4개·`index.html`(stamp)·`tests/`·`spec.md`·스크래치패드·보고서. `db.js` 버전·`speaker.js` 낭독 동작·`text/columns.js`·`text/layout.js`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**. 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
