# Build 지침 — 12-3 복습 화면 `#/cards` · 목록 · 서재 "오늘" 줄

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-11** 중 12-3 몫 — 6(복습 화면 — 라우트·입구·복습 흐름·목록·키보드)·7 표 12-3 행·import 방향·8 "12-3" 수용 기준·공통·9(headless — 카드 심기·가짜 시계)·10 결정 표(권장안)·13(실기기 — 적기만), 17-11 안의 `[정정 2026-11-17 — 12-1 Build]`·`12-1b`·`12-2 Build` 줄들, 17-4-1 의 `12-1c`·`12-1d` 줄. 운영자 위임: 권장안으로 — 12-Q1(복습 중 번역 부르기)은 설계 기본값 "호출 0". **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-12-3-review-screen-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라 (`.claude/tasks/medreader-crossstep-notes.md` 의 "12-2·12-3·13-2" 줄·"12-3 결정 후보"·"12-1(Review …)" 줄 전부)
- **`srs.log` 읽기는 `cards.readLog()`**(settings 메모리 값은 옛것). 멈춤은 `suspendedAt`. `srs.log` 기본값은 얼린 `{}` — 받아서 고치지 말 것.
- **"이 책" 묶음**: 문장 카드 id 는 fileHash 바탕이지만 `docId` 필드는 옛 문서 id 로 남을 수 있다(지우고 다시 가져온 책 — 12-1bR 정보-3). `#/cards/:docId`·"이 책 복습"·`keptCount` 가 그 문서의 **fileHash** 로도 묶는지 정하고(권장: 묶는다 — 같은 PDF 의 카드), spec 정정 줄로.
- **12-3 결정 후보**(crossstep): ① 자동 채움(`fillBack`·`saveSentence` 채움)이 `updatedAt` 을 올려 다른 기기의 손으로 쓴 뒷면을 덮을 수 있음 · ② 일부러 비운 뒷면·메모가 다른 기기 값으로 다시 참 — 이 단계의 [목록] 편집이 뒷면을 비울 수 있게 하는지에 따라 정한다. 권장: **자동 채움은 `updatedAt` 을 올리지 않는다**(내용 수정 시각은 사람의 편집만), 비우기는 편집에서 허용하되 9c 에서 다시 찰 수 있음을 기록(9c 규칙을 이 단계에서 바꾸지 않음). 판단과 이유를 spec 정정 줄로 — `srs/cards.js` 를 고쳐야 하면 범위에 넣어도 된다(시험으로 12-1 시험 무변을 확인).
- **12-2 Review(12-2R) — i18n 을 이번에 고치므로 함께(작음)**: ⑤ en "1 memory cards"(n=1 복수) · ko "기억 카드 3 는"(숫자 뒤 조사 — "기억 카드 3장은" 꼴) · `remember.reviewed` 의 "목록에서 지우세요"는 이 단계에서 목록이 생기므로 그대로 맞는지 확인. ① **915×412 가로에서 선택 줄 `[⋯]` 메뉴가 눌려 [찾아보기]가 약 30px 가려짐**(`selbar.js`·`reader.css` — 이 단계 범위에 더해도 된다: 메뉴 최대 높이·자리를 넓혀 넷 다 보이게, 세로 두 크기 그대로).
- 카드 수천 장 훑기 시간(`queue`·목록) — 이 단계에서 잰다(합성 5,000장).
- 8f-3 단어장 화면 머리에 `[복습 (n)]`, 서재 카드 `[⋯]` "이 책 복습", 서재 맨 위 "오늘" 줄(카드 1장 이상일 때만 — 13-2 가 시험 줄을 더할 자리).

## 할 일
설계 7 표 12-3 행 그대로: 새 `js/ui/cards.js`·`tests/cards-ui-12.test.mjs`, 고칠 `js/router.js`·`js/main.js`(+4)·`js/ui/library.js`("오늘" 줄·카드 `[⋯]` 한 줄)·`js/ui/vocab.js`(`[복습 (n)]`)·`index.html`(섹션·"오늘" 줄 자리)·`css/screens.css`·i18n 4개(약 32키, ar·fr `[검토 — Nour·운영자]`). 복습 흐름: 앞면 → [뒷면 보기]/Space → 네 단추(다시·어려움·좋음·쉬움 — `previewLabels` 간격 표시, 1–4 키) → 다음, "다시"는 3장 뒤 다시, 끝 화면 숫자, 거르기 칩(전체·단어·문장), 뒷면 빈 문장 카드는 캐시에서 `fillBack`(호출 0) 또는 "번역 없음" + [쪽으로 가기]. 날짜 넘김(자정)에 줄·셈 갱신. [목록]: 편집(뒷면·메모)·멈춤·삭제(페이지 안 확인). **호출 0**. DB 3·algoVersion·모든 `*_PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "12-3" 전부 + 변이(설계 끝 넷) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b12-3/bak/`).
- 호출 0(흉내 Gemini 가로채기), 요청 본문 바이트 HEAD 와 같음(앞 Review 하네스 읽기만).
- 성능: 합성 카드 5,000장에서 화면 열기·`queue`·목록 그리기 시간(기록 — 1초 넘으면 보고).
- 회귀: 12-2 띠 [☆]·선택 줄·음성 "기억", 8f-3 단어장 화면·CSV, 서재(목록·삭제 확인 한 줄), 9c 백업(카드 포함), 11-3 요약 화면·라우터.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0.
- headless: Edge, pipe, 새 프로필 `b12-3/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **가짜 시계**(`evaluateOnNewDocument` 로 `Date.now`), **한 번에 하나씩**, **서버 띄우기 금지**(가로채기). 360×740·412×915·915×412 × 4언어, 키보드만으로 한 세션. 콘솔 오류 0. 스크린샷 4–6장 `b12-3/shots/`.
- spec 17-11 안 `[정정 2026-11-17 — 12-3 Build]` 줄(Edit 로 그 자리만).

## 수정 범위
설계 7 표 12-3 행의 파일 + (위 결정에 필요하면) `js/srs/cards.js` 몇 줄 + `js/ui/selbar.js`·`css/reader.css`(위 ① 메뉴 높이만) + `index.html`(stamp 포함) + `tests/` + `spec.md` + 스크래치패드 `b12-3/` + 보고서. `ai/*`·`db.js`·`backup/*`·`text/backup.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
