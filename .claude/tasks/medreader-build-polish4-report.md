# Build 보고 — 다듬기 4: 화면 가림 · 확인 없는 지움 · 429 판정 · 캐시 · 백업 입력 (2026-11-18)

지침 `.claude/tasks/medreader-build-polish4.md`. 기준 `2c9370e`. **커밋하지 않았다.** 스크래치 `bp4/` = `C:/Users/YDC/AppData/Local/Temp/claude/9d924f3f16e52d8a/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/bp4/`. 권한 거절 0.

## 0. 한눈에

| # | 항목 | 결과 |
|---|---|---|
| 1 | 원본 보기 → 검색에서 숨긴 리더가 가림 · 요약 시트 링크 | **고침** — `:not([hidden])` 둘 · screens.css 임시 줄 뺌 · 15화면 전수 탐침 HEAD 1 → 0 |
| 2 | [기본 목록으로 되돌리기] 확인 없음 | **고침** — 배열일 때만 같은 `<dialog>`(확인 단추 = [되돌리기]) |
| 3 | 서재 삭제 `confirm()` | **고침** — 페이지 안 `<dialog>`(지워집니다·남습니다 줄 따로) |
| 4 | 429 를 모두 "오늘 한도"로 | **고침** — 분 → cooldown(`RATE_MINUTE`, 끝나도 ready 로 안 감 = 자동 재시도 0) · 일·모름 → exhausted |
| 5 | 다음 세션 캐시 적중 없이 2건 | **고치지 않음(설계)** — 원인: 8q Review 흉내 응답이 숫자를 안 돌려줘 10-2 `DIGITS` 실패 → 캐시 안 함 + 실패 기억은 세션 메모리 |
| 6 | 백업 가져오기 입력 안전 | 줄 상한·속성 이름·id 꼴은 **9c-2 에 이미 있음**(변이로 지킴 확인) · **`cssId` → `CSS.escape` 만 고침** |

## 1. 바꾼 파일

| 파일 | 항목 |
|---|---|
| `css/reader.css` | 1 — 원본 보기 리더 규칙 두 선택자 `:not([hidden])` · `.sum-sheet .sum-link:not([hidden])` |
| `css/screens.css` | 1 — `.sum-sheet .sum-link[hidden]` 임시 줄 제거 · 3 — `#docDelDialog` 줄바꿈·굵게·`[hidden]` 3줄 |
| `js/ui/links.js` | 2 — `resetDefaults` 확인 · `confirmIn(title, okKey)` · 6 — `cssId` export + `CSS.escape` |
| `js/ui/library.js` | 3 — `askDelete`(대화 DOM 으로 한 번 만듦) · `deleteConfirmParts`(`deleteConfirmText` 가 이것을 이음) · 취소/삭제 뒤 초점 |
| `js/ai/pipeline.js` | 4 — `RATE_MINUTE`·`RATE_MINUTE_DEFAULT_SEC`·`peekingFetch`·`enterRateLimited` · `refresh` 분 한도 예외 |
| `js/ai/adapters/gemini.js` | 4 — `rateLimitInfo(json)`(429 해석만) |
| `js/ui/trband.js` | 4 — `RATE_KEYS`·`RATE_CODE`·`noteRemoteRate`·`rateView`·`onRateChange` · `bandView`/`noteView`/`tapView`/`remoteBanner` 분 한도 문구 · 기다림 끝 타이머 |
| `js/ui/inlinetr.js` | 4 — `onRateChange` 구독(막힘 줄 다시 그림) |
| `js/ui/usage.js` | 4 — 머리 주석(문구 키는 i18n) |
| `js/i18n/{ko,en,fr,ar}.js` | 새 5키(`links.reset.confirm` · `readalong.blocked.rateWait/rateReady` · `ai.state.rateWait/rateReady`) + `usage.blocked429` 값 — ar·fr 줄 끝 `[검토 — Nour·운영자]` |
| `index.html` | stamp 만(모듈 106 · CSS 4) |
| `spec.md` | `[정정 2026-11-18 — 다듬기 4]` 6줄(7-5 · 7-6 · 12-5 · 12-6 · 17-9 · 17-4-1 9c-2 정정 아래) |
| `tests/polish-4.test.mjs` | **새** Q1–Q6(10 시험) |
| `tests/{wordsheet-8f,sumsheet-11b,review-ui-15}` | 삭제 확인 줄 정규식 `confirm(` → `askDelete(`(+ confirm() 0) |
| `tests/summaries-ui-11c` | 링크 규칙 위치(screens → reader) · `tests/trband` BUD4 선택자 · `tests/inlinetr-8d` D8 import 줄 |

손대지 않은 것: `provider.js`(범위 밖 — 아래 4 참고) · `readalong.js` · `db.js` 판 · `speaker.js` · `text/columns.js`·`layout.js` · `js/backup/*`·`js/text/backup.js`(이미 됨) · `review.md` · `dev/`. 판본 상수·`algoVersion`·`PROMPT_VERSION`·캐시 키 불변.

## 2. 항목별

### 1. 화면 가림 — 고침
- `body:has(.original) .screen[data-screen="reader"]`·`body[data-reader-view="original"] …` 에 `:not([hidden])`. `.sum-sheet .sum-link` 도 `reader.css` 에서 `:not([hidden])` 로, 11-3 의 screens.css 한 줄은 뺐다.
- headless(Edge·pipe·새 프로필·합성 PDF, 원본 보기에서 `#viewToggle` → `#/search/:doc`):

| 판 | 리더 display·높이 | 검색 칸 위치 · 가운데 누름이 칸에 닿나 |
|---|---|---|
| HEAD(412 ko) | flex · 667px | 746px · **아니오** |
| 지금(412·360 × ko·ar) | none · 0 | 79px · 예 |

- **css 전체 표(동적 전수)** — `bp4/run-hid.mjs`: 15상태(서재·리더·선택 줄 [⋯]·요약 시트·원본 보기·검색·설정·링크·단어장·요약·카드·계획·필기·복습 묶음·사용량)에서 요소마다 잠깐 `hidden` 을 켜 계산된 display 를 보고, 그것을 앱이 **실제로 `hidden` 을 쓰는 요소**(MutationObserver + 정적 `[hidden]`, 164개)와 겹쳤다. `display` 규칙을 가진 요소 95종.

| 판 | 겹침(가릴 수 있는 것) | 규칙 |
|---|---|---|
| HEAD | **1** — 리더 `section.screen` | `reader.css` 원본 보기 두 규칙 `{display:flex}` (sum-link 은 screens.css 임시 줄이 막고 있었음) |
| 지금 | **0** | — |

  나머지 95종은 `hidden` 을 쓰지 않는 요소이거나 같은 특이성의 `[hidden]{display:none}` 이 뒤에서 이긴다(고칠 것 없음). 전체 목록 `bp4/hid-pH2.json`·`hid-pH3.json`.
- 요약 시트 링크: 보일 때 `display:flex` 그대로, `hidden` 을 켜면 `none`(4판형 모두).

### 2. [기본 목록으로 되돌리기] — 고침
- 사용자 목록이 **배열**일 때만 삭제와 같은 `#linksDelDialog` 로 묻는다(제목 `links.reset.confirm` "직접 만든 목록(링크 n개)이 지워집니다", 확인 단추 문구를 `links.reset` 으로 바꿔 씀 — 삭제 때는 다시 `links.delete`). `null`(기본 목록)이면 묻지 않음. `confirm()` 0.
- headless 4판형(360·412 × ko·ar) 모두: 열림 · 첫 초점 [취소] · Esc → 배열 그대로·초점 [되돌리기] · [취소] 같음 · 확인 → `null`·기본 4줄·초점 [되돌리기] · `null` 에서 누르면 대화 없음 · 링크 삭제 대화는 [삭제] 문구 그대로 · 가로 넘침 0. HEAD 는 누르자마자 지움(재현).

### 3. 서재 삭제 확인 — 고침
- `askDelete` — `<dialog class="confirm-dialog" id="docDelDialog">` 를 처음 물을 때 서재 화면 안에 DOM 으로 만든다(`index.html` 은 stamp 범위라 마크업을 넣지 않음). 머리 · "지워집니다" 줄(AI 문제 n, 굵게) · "남습니다" 줄(흐리게) — `deleteConfirmParts` 한 함수(`deleteConfirmText` 는 이것을 이어 붙임 — 기존 시험 문구 그대로 통과).
- headless(합성 — AI 문제 3 · 단어장 2 · 필기 1): 4판형 모두 열림 · 줄 = `deleteKeepLines` 기대값 그대로(ko "AI 문제 3개도 지워집니다." / "단어장 항목 2건 · 필기 1건은 남습니다", ar rtl) · 첫 초점 [취소] · Esc·[취소] → 문서 남음·초점 그 카드 [삭제] · 확인 → 문서·AI 문제 지워짐, 단어장·필기 남음, 초점 [PDF 가져오기] · `window.confirm` 호출 0 · 대화 폭 322/374px·넘침 0. 스크린숏 `bp4/shots/del-360-ar-cur.png`.

### 4. 429 판정 — 고침(자동 재시도 0)
- 어댑터 `rateLimitInfo`: `error.details` 의 `QuotaFailure.violations[].quotaId` — `PerDay` 하나라도 → `day`(보수), 아니고 `PerMinute` → `minute`, 그 밖 null · `RetryInfo.retryDelay`("41s"·"7.2s" → 올림, 1–3600 밖은 무시).
- 파이프라인: 분 → `cooldown`(코드 `RATE_MINUTE`, until = retryDelay → Retry-After → 60초), 일·모름 → `exhausted`(지금과 같음). ★ **분 한도 cooldown 은 until 이 지나도 ready 로 돌아가지 않고 until 만 0** — ready 로 돌아가면 `readalong` 이 막힌 창을 저절로 다시 보낸다(자동 재시도). 사용자 [다시 시도](`retry()`)만 ready.
- 본문 읽기: `provider.js` 는 범위 밖이라, 파이프라인이 넘기는 `fetch` 를 `peekingFetch` 로 감싸 **429 응답의 사본(`clone()`)** 만 들여다본다(요청 주소·머리·본문은 그대로 넘김 · 사본이 없는 스텁 응답은 "못 읽음" → exhausted). provider 를 고칠 수 있다면 오류 객체에 `quota` 를 싣는 쪽이 더 곧다(운영자 몫).
- 화면: 띠·문장 아래 줄 — 기다리는 중 "분당 요청 한도 — 잠시 기다려 주세요"([다시 시도] 없음), 끝나면 "… 이제 다시 시도할 수 있습니다" + [다시 시도] · 상태 바 `ai.state.rateWait`({s}초) → `rateReady` · 요약 시트는 문구만 같은 규칙(`noteKeyFor`) — 그 시트의 [다시 시도] 단추는 자기 규칙(`RETRYABLE_REMOTE`)이라 기다리는 중에도 보인다. 풀린 뒤 지나간 문장 아래 남은 막힘 줄은 "응답 없음"이 아니라 "기다림 끝" 문구로 둔다. 사용량 화면 문구는 "분당·오늘 한도를 함께 센다"로. **ko 문구에 숫자 금지(시험 C4 — 8-4)** 라 "1분" 대신 "분당".
- 흉내 응답은 Gemini 오류 꼴을 합성(QuotaFailure·Help·RetryInfo — 진짜 요청 0). headless(retryDelay 4초, 처음 2건 429):

| 판 · 꼴 · 표시 | 기다리는 중(1.5s) | 지난 뒤(4.9s) | +3초 | [다시 시도] 뒤 |
|---|---|---|---|---|
| 지금 · 분 · 띠 412 ko | cooldown · rateWait · 단추 없음 · 배너 rateWait(초 있음) · POST 2 | rateReady · 단추 · 배너 rateReady · POST 2 | POST **2** | ready · 번역 · POST 4 |
| 지금 · 분 · 띠 360 ar | 같음 | 같음 | POST **2** | 같음 |
| 지금 · 분 · 문장 아래 360 ar | 줄 rateWait 단추 0 | 줄 rateReady 단추 1 | POST **2** | 2줄 번역 + 지난 줄 rateReady |
| 지금 · 일 · 띠 412 ko | exhausted · 오늘 한도 | 같음 | POST 2 | ready · POST 4 |
| 지금 · 모름 · 띠 360 ar | exhausted · 오늘 한도 | 같음 | POST 2 | ready · POST 4 |
| HEAD · 분 · 띠 412 ko | exhausted · 오늘 한도(재현) | 같음 | POST 2 | ready · POST 4 |

  콘솔 오류: 흉내로 일부러 준 429 의 "Failed to load resource" 2건만(앱 오류 0) · 페이지 오류 0 · 가로 넘침 0.
- **요청 본문 바이트 HEAD 대조**(`bp4/bytes.mjs` — `git archive HEAD` 판과 지금 판 파이프라인에 같은 입력): 낭독 동반 번역·탭 번역·단어·요약·개요·설명·출제·개념도 **8종 모두 주소·방법·머리·본문·signal 같음**.

### 5. 다음 세션 재요청 — 원인 확인, 고치지 않음(설계)
- 재현(`bp4/run5.mjs` — 같은 프로필 두 세션, HTTP 캐시 켬, 흉내 Gemini, 합성 4쪽, [▶] 6초):

| 판 · 흉내 | 세션 1 요청·항목·캐시됨 | 세션 2 요청 · 항목 = 세션 1 의 무엇 |
|---|---|---|
| HEAD · 숫자 돌려줌 | 2 · 45 · 45 | **0** |
| HEAD · 숫자 안 돌려줌(8q Review `r8q/hcommon.mjs` 와 같은 꼴) | 2 · 45 · **41** | **1 · 4항목 = 세션 1 에서 캐시 안 된 4개 전부**(새 글 0 · 캐시된 것 0) |
| 지금 · 숫자 돌려줌 · 1쪽 | 2 · 45 · 45 | **0** |
| 지금 · 숫자 돌려줌 · 2쪽(쪽 넘김 조각) | 2 · 34 · 34 | **0** |

- 원인: 8q Review 흉내 번역이 숫자를 돌려주지 않아 숫자 든 문장이 10-2 검사(`DIGITS`)에 떨어짐 → 실패 결과는 캐시하지 않고(10-2), "보냈다가 실패" 기억은 세션 메모리(7-6) → 다음 세션에 다시 보냄. 캐시 키·저장 시점·읽기 순서 문제 아님. Harrison 94–100쪽처럼 숫자 많은 쪽이면 실패 문장이 head·일반 두 묶음 → "요청 2건".
- 설계대로라 고치지 않음. 실기기에서도 검사에 떨어지는 문장(숫자 빠짐 등)은 세션마다 다시 보낸다 — 실패 기억을 세션 너머로 둘지는 **운영자 결정**(DB 판 무변 원칙과 함께).

### 6. 백업 가져오기 입력 — 대부분 이미 있음
- `lineSplitter` 줄 상한(`BACKUP.MAX_LINE_CHARS` 8M · 첫 줄 전 넘으면 `not-backup`), 속성 이름 `KEY_PATTERNS` 검사(`dropKeyNames`), `links.medical` id 꼴(`cleanLinkIds` `[A-Za-z0-9_-]{1,64}` · 겹침 → 결정적 새 id)는 **9c-2 Build 에 이미 들어 있었다**(spec 17-4-1 9c-2 정정 ⑥⑦). 시험 I1·I2·I9·I10 이 지키는지 변이로 확인(아래 M6b–M6d 빨강).
- 남은 한 가지 `ui/links.js` `cssId` → `CSS.escape`(없으면 옛 방식)만 고쳤다(export — 시험 Q6).

## 3. 검증

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2047/2047 × 2회**(fail 0, 약 13초). 출력 `bp4/test-run1.txt`·`test-run2.txt`.
- stamp 다시(단독) → `--check` "그대로다(모듈 106 · CSS 4)" 종료 0 · `git diff --check` 0 · `.nojekyll` 있음(0바이트).
- 특수 글자 수(`bp4/chars.mjs` — NBSP·NNBSP·ZW*·LRM/RLM·방향 제어·BOM·SHY·제어 문자·글자 그대로의 `\u`/`\x` 이스케이프): 바뀐 21파일 **모두 HEAD 와 같음**, 새 시험 파일 0.
- 회귀: 원본 보기·검색·요약 시트(1) · 18 링크 설정(2) · 서재 삭제 남는/지워지는 수(3) · 요청 본문 8종 HEAD 같음(4) · 9c 내보내기/가져오기 멱등(K11·I5·I17·B1·D6·L8·G6 — 전체 시험 안).
- headless: Edge · pipe · 새 프로필 `bp4/p*`(한 번에 하나) · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 캐시 끔(5번만 켬) · **서버 없음**(가로채기 — 작업 트리 / HEAD `git show`) · 합성 PDF(`b11-2/syn.pdf`). 360×740·412×915 × ko·ar. 앱 콘솔 오류 0 · 페이지 오류 0 · 바깥 요청은 pdf.js CDN 과 가로챈 Gemini 뿐. 모든 실행 `try … finally { browser.close() }` 끝까지, 백그라운드 작업 0.

### 변이 10개 (`bp4/mut.mjs` — 백업 `bp4/bak/`, 읽어서 쓰기로 복원)

| # | 변이 | 결과 |
|---|---|---|
| M1 | reader.css 원본 보기 규칙에서 `:not([hidden])` 뺌 | 빨강 Q1 · BUD4 |
| M2 | 되돌리기 확인 조건 `if (false)` | 빨강 Q2 |
| M3 | 지워지는 줄을 남는 줄에 섞음 | 빨강 Q3 · V7(review-ui-15) |
| M4a | 분 한도 cooldown 이 시간이 지나면 ready(자동 재전송 길) | 빨강 Q4b |
| M4b | 어댑터가 `PerDay` 를 분으로 | 빨강 Q4a · Q4d |
| M4c | 기다리는 중에도 [다시 시도] | 빨강 Q5 |
| M6a | `cssId` 의 `CSS.escape` 뺌 | 빨강 Q6 |
| M6b | 속성 이름 키 모양 검사 끔(`import.js`) | 빨강 I2 |
| M6c | `lineSplitter` 상한 무한 | 빨강 I1 · I9 |
| M6d | 링크 id 꼴 아무 글자나 | 빨강 I2 · I10 |

- 복원 10/10 `Buffer.compare` 같음 + `cmp` 8파일 같음. 5번은 고친 코드가 없어 변이 없음.

## 4. 남은 문제 · 운영자 몫

1. **(결정) 분 한도 cooldown 은 사용자가 [다시 시도]를 누를 때까지 풀리지 않는다** — 그동안 요약·설명·탭 번역도 막힘(같은 파이프라인). 지침의 "자동 재시도 0 — 끝나면 [다시 시도]로 바뀔 뿐" 그대로다. 낭독 창만 막고 새 사용자 요청(탭·요약)은 보내게 하려면 `readalong.js`(범위 밖)가 "분 한도에서 돌아옴"을 회복으로 보지 않게 해야 한다.
2. 분 한도 문구는 띠·문장 아래·상태 바·요약 시트(문구만 — 단추는 기다리는 중에도 보임)까지. 단어장·단어 시트·저장한 요약·복습 묶음·개념도 화면은 여전히 `cooldown` 문구("서비스 응답이 없습니다" + [다시 시도])다 — 기다리는 중 누르면 바로 다시 보내 또 429 일 수 있다.
3. `[M]` 실물 Gemini 429 본문 꼴(`quotaId` 이름·`retryDelay`)은 실기기 확인 전 — 다르면 "못 읽음 → exhausted"(지금과 같음)로 떨어진다. 시간 단위(`PerHour` 등)도 exhausted.
4. `provider.js` 를 범위 밖이라 건드리지 않고 fetch 감싸개로 본문 사본을 읽었다. provider 가 오류에 `quota` 를 싣는 편이 더 곧다.
5. 5번 — 검사 실패 결과는 세션마다 다시 보낸다(설계). 무료 한도를 아끼려면 실패 기억을 남길지 결정.
6. ko 대화 단추가 영어("Cancel"·"Delete") — `common.cancel`·`library.card.delete` ko 값이 영어(HEAD 부터 — crossstep "ko·fr 값 영어" 묶음).
7. ar·fr 새 문구 `[검토 — Nour·운영자]`.
8. (알림) 처음 테스트를 돌릴 때 한 번 `… ; echo "exit=$?"` 로 두 일을 묶어 실행했다(지침 위반 — 결과에는 영향 없음, 그 뒤로는 한 호출 한 일).

## 5. 커밋할 것(운영자가 할 때)

- 앱: `css/{reader,screens}.css` · `index.html` · `js/ai/{pipeline.js,adapters/gemini.js}` · `js/i18n/{ko,en,fr,ar}.js` · `js/ui/{inlinetr,library,links,trband,usage}.js` · `spec.md` · `tests/polish-4.test.mjs`(새) · `tests/{inlinetr-8d,review-ui-15,summaries-ui-11c,sumsheet-11b,trband,wordsheet-8f}.test.mjs`
- `.claude/tasks/medreader-build-polish4{,-report}.md`
- 커밋하지 않을 것: `.codex/`·`AGENTS.md`·`medreader-status-2026-11-02.html`·`medreader-build-polish5.md`(`git add -A` 금지). `.nojekyll` 그대로. 프로필 `bp4/p*` 는 `rm -rf` 금지라 남김.

## 4b. Review(P4R) 뒤 고침 — 중간-1 · 낮음-2·3 (2026-11-18)

review.md "다듬기 4 Review" 판정 "고친 뒤 배포" 뒤. 같은 지침·범위·규칙, 커밋 0, 권한 거절 0, 백그라운드 0.

### 중간-1 — 확인 대화가 열린 채 화면을 떠나면 숨은 `:modal` 이 앱을 막음 → 고침
- 서재: `initLibrary` 가 `hashchange` 에서 경로가 서재가 아니면 `cancelLibraryDialogs()` — `#docDelDialog`·`#reextractDialog` 를 `cancelDialog`(export)로 닫는다. `cancel` 이벤트(Esc 와 같은 길)를 보내 기다리던 물음이 `false` 로 끝나고 리스너도 떼어진다(데이터 무변). `main.js` 는 범위 밖이라 라우터 leave 대신 이 자리.
- 같은 꼴 grep(`showModal` 12곳 · `index.html` `<dialog>` 12개):

| 대화 | 떠날 때 | 4b |
|---|---|---|
| 서재 삭제 `#docDelDialog`(4 새) | 안 닫힘 → 숨은 modal | **고침**(hashchange → 취소) |
| 서재 다시 추출 `#reextractDialog`(HEAD 부터) | 안 닫힘 | **고침**(같은 자리) |
| 리더 메모 지우기 `#annoDelDialog`(20-2) | 안 닫힘(`onReaderLeave` 가 시트만 닫음) | **고침** — `onReaderLeave` 에 `closeDel()`(대상 지움 = 취소) |
| 링크 삭제·되돌리기 `#linksDelDialog`(18) | `leaveLinksSettings` 가 `close()` — 닫히지만 **기다리던 `confirmIn` 리스너가 남아** 다음 대화의 [확인]이 옛 대상까지 실행 | **고침** — 취소 길(`cancel` 이벤트)로. HEAD 재현: A 삭제 대화 → 떠남 → 돌아와 B 삭제 확인 → **A·B 둘 다 지워짐** |
| 단어장 편집·삭제 · 요약 삭제 · 카드 편집·삭제 · 계획 시험 삭제 · 필기 삭제·메모 | `leave*` 가 닫고 대상(`delTarget`·`S.delId`·`delRow`)을 지움 · 리스너는 init 한 벌 | 무변(문제 없음) |
| 개념도 다시 그리기 확인(16) | `<dialog>` 아님(띠 안 단추) | 해당 없음 |

- headless `bp4/run-nav.mjs`(새 프로필 · 서버 없음 · 합성 PDF): 열린 대화 → 떠남 뒤 `open` · `:modal` 수 · 새 화면 첫 단추 초점·누름.

| 경우 | 지금 412 ko · 360 ar | HEAD 412 ko |
|---|---|---|
| N1 서재 삭제 → 진짜 뒤로가기(설정) | 닫힘 · modal 0 · 초점·누름 됨 · 문서 그대로 · 서재로 돌아와도 대화 없음 | (`confirm()` 길 — 대화 없음) |
| N2 다시 추출 → 주소(단어장) | 닫힘 · modal 0 · 초점·누름 됨 · 추출 기록 그대로 | **열린 채 modal 1 · 초점·누름 안 됨** |
| N3 링크 A 삭제 대화 → 뒤로 → B 삭제 확인 | 닫힘 · 남은 링크 `la,lc`(B 만 지워짐) | 떠난 뒤 modal 1 · 남은 `lc`(**A 도 지워짐**) |
| N4 메모 지우기(열린 상태를 `showModal` 로 만듦 — 실제 필기 만들기는 생략) → 서재 | 닫힘 · modal 0 · 초점·누름 됨 | 열린 채 modal 2 · 막힘 |

  콘솔·페이지 오류 0.

### 낮음-2·3 — 시험 빈틈 → 메움
- 낮음-3: 대화 세 칸 채우기를 `fillDeleteDialog(nodes, parts)`(export, `textContent`·`hidden` 만)로 떼고 `askDelete` 가 부른다. **Q7** — 지워집니다 줄 있으면 보임·없으면 숨김, 연속 삭제에 앞 줄 안 남음.
- 낮음-2: **Q8** — `peekingFetch` 뒤 원본 `Response.bodyUsed === false`·provider 가 원본을 그대로 읽음·사본으로 retryDelay · 200 은 안 봄 · 같은 init 객체 · **429 + 지역 문구 → REGION**(분 한도로 읽지 않음).
- **Q9** — `cancelDialog`(cancel 이벤트로 false · 듣는 이 없으면 그냥 닫음 · 닫힌 것 그대로) · 서재 hashchange · 링크 leave 취소 길 · notesheet `closeDel`.

### 변이 6개(`bp4/mut4b.mjs` — 백업 `bp4/bak4b/`, 읽어서 쓰기 복원)

| # | 변이 | 결과 |
|---|---|---|
| R2 | 감싸개가 사본 대신 원본 본문을 읽음 | **빨강 Q8**(전엔 초록) |
| R3 | "지워집니다" 줄 늘 숨김 | **빨강 Q7**(전엔 초록) |
| B1 | 서재 hashchange 취소 끔 | 빨강 Q9 |
| B2 | `cancelDialog` 가 cancel 이벤트 안 보냄 | 빨강 Q9 |
| B3 | 링크 leave 가 그냥 `close()` | 빨강 Q9 |
| B4 | 리더 떠남에 `closeDel()` 뺌 | 빨강 Q9 |

- 복원 6/6 `Buffer.compare` 같음 + `cmp` 4파일 같음.

### 점검
- 전체 시험 **2050/2050 × 2회**(fail 0 — Q7·Q8·Q9 더함). `bp4/test4b-run1.txt`·`test4b-run2.txt`.
- stamp 다시 → `--check` "그대로다(모듈 106 · CSS 4)" · `git diff --check` 0 · 특수 글자 바뀐 파일 모두 HEAD 와 같음(`notesheet.js` 포함, 새 시험 0).
- spec 12-6 에 `[정정 2026-11-18 — 다듬기 4b]` 한 줄.
- 바뀐 파일(4b): `js/ui/library.js`(`parseRoute` import · hashchange · `cancelDialog` · `cancelLibraryDialogs` · `fillDeleteDialog`) · `js/ui/links.js`(`leaveLinksSettings`) · `js/ui/notesheet.js`(`onReaderLeave`) · `tests/polish-4.test.mjs`(Q7–Q9) · `spec.md` · `index.html`(stamp). 커밋 목록에 `js/ui/notesheet.js` 를 더할 것.

### 남은 것(4b)
- N4 는 대화를 `showModal` 로 직접 열어 "떠날 때 닫힘"만 쟀다(메모 있는 필기를 앱 길로 만들어 여는 경로는 재지 않음 — 닫는 코드는 같은 `closeDel`).
- 대화가 취소로 끝난 뒤 초점 되돌림(카드 [삭제]·줄 단추)은 이미 숨은 화면이라 효과 없음 — 새 화면 초점은 그 화면 몫(누름·초점 됨 확인).
- P4R 낮음-4~9 는 그대로(범위 밖 · 운영자 몫).

## 4c. Review(P4bR) 뒤 고침 — 중간-1(링크 대화 · 설정 안 이동) (2026-11-18)

review.md "다듬기 4b Review" 판정 "고친 뒤 배포" 뒤. 같은 범위·규칙, 커밋 0, 권한 거절 0, 백그라운드 0.

### 고침
- 규칙: **대화를 연 칸(화면·탭)을 라우터가 다시 그리거나 숨기면 열린 확인 대화는 취소 길로 닫는다.**
- `js/ui/links.js`: `cancelOpenDialog()`(`cancel` 이벤트 → `confirmIn` 의 `finish(false)` · 리스너 뗌 · 그래도 열려 있으면 `close()`)를 하나로 묶었다.
  - `showLinksSettings(tab)` 맨 앞에서 부른다. 이 함수는 라우터(`showSettings`)만 부른다 — `#/settings/links` → `#/settings` 뒤로가기·다른 설정 탭(`#/settings/voice` 등)은 같은 화면이라 `leaveSettings` 를 거치지 않던 길이다.
  - `leaveLinksSettings` 도 같은 함수를 쓴다(4b 동작 그대로).
- 바뀐 파일(4c): `js/ui/links.js` · `tests/polish-4.test.mjs`(Q10) · `spec.md`(12-6 `[정정 2026-11-18 — 다듬기 4c]` 한 줄) · `index.html`(stamp).

### 같은 꼴 찾기 — 대화는 어느 칸 안에 있나(`index.html` 조상 사슬 + `#docDelDialog` 는 서재 화면에 JS 로)

| 대화 | 바로 위 칸 | 그 칸이 숨거나 다시 그려지는 길 | 결과 |
|---|---|---|---|
| 링크 `#linksDelDialog` | 설정 화면 안 `#settingsLinks` 카드(카드는 숨지 않음) | 설정 안 주소 바뀜(탭·뒤로가기) → `showLinksSettings` | **고침(4c)** |
| 서재 삭제·다시 추출 | 서재 화면 | 떠날 때 `hashchange` | 4b 그대로 |
| 리더 메모 지우기 | 리더 화면 | `onReaderLeave` | 4b 그대로 |
| 단어장 편집·삭제 · 요약 삭제 · 카드 편집·삭제 · 필기 삭제·메모 · 계획 삭제 | 각 화면 바로 아래(하위 탭·패널 안이 아님) | 떠날 때 `leave*` 가 닫고 대상 지움 · 같은 화면 안 주소 바뀜(`#/vocab/:id` → `#/vocab` 등)은 대화가 보이는 채 남지만 대상이 열 때 고정·리스너 한 벌이라 [확인]은 대화에 적힌 그 대상만 | 무변(문제 없음) |
| 설정의 다른 카드 | 확인 대화 없음(캐시 비우기는 `window.confirm` — HEAD 부터) | — | 해당 없음 |

### 시험
- **Q10(node, 작은 가짜 DOM)** — 링크 A 삭제 대화 → `showLinksSettings(undefined)`(설정 안 뒤로가기와 같은 부름) → 대화 닫힘 · 아무것도 안 지움 → 돌아와 B 삭제 확인 → **`la,lc`(B 만)** · 대화 리스너 0.
- headless `bp4/run-links.mjs`(새 프로필 · 서버 없음 · 합성 PDF · 진짜 `page.goBack()`):

| 경우 | 지금 412 ko · 360 ar | HEAD 412 ko |
|---|---|---|
| L1 A 삭제 대화 → 뒤로가기 `#/settings` | 닫힘 · `:modal` 0 · 설정 단추 초점·누름 됨 · 링크 그대로 | 열린 채 modal 1 · 초점·누름 안 됨 |
| L1 → `#/settings/links` 로 돌아와 B 삭제 확인 | 남은 링크 `la,lc` | **`lc`(A 도 지워짐)** |
| L2 되돌리기 대화 → `#/settings/voice` | 닫힘 · modal 0 · 값 그대로 | (HEAD 는 묻지 않고 바로 되돌림) |

  콘솔·페이지 오류 0.

### 변이 2개(`bp4/mut4c.mjs` — 백업 `bp4/bak4c/`, 읽어서 쓰기 복원)

| # | 변이 | 결과 |
|---|---|---|
| C1 | `showLinksSettings` 에서 `cancelOpenDialog()` 뺌 | **빨강 Q10** |
| C2 | `cancelOpenDialog` 가 `cancel` 이벤트 없이 `close()` 만 | **빨강 Q9 · Q10** |

- 복원 2/2 `Buffer.compare` 같음 + `cmp` 같음.

### 점검
- 전체 시험 **2051/2051 × 2회**(fail 0). `bp4/test4c-run1.txt`·`test4c-run2.txt`.
- stamp 다시 → `--check` "그대로다(모듈 106 · CSS 4)" · `git diff --check` 0 · 특수 글자 바뀐 파일 모두 HEAD 와 같음(새 시험 파일 0).

### 남은 것
- P4bR 낮음-2(서재로 돌아왔을 때 초점 BODY)·P4R 낮음-4~9 그대로(운영자 몫).
- 진행 중 한 번 heredoc 이 셸 따옴표 문제로 실패했다(파일 무변 — 내용을 스크래치 파일로 써서 붙였다).
