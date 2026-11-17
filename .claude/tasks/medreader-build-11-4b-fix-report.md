# Build 보고서 — 11-4b: 11-4 Review 지적 고치기

> 지침 `.claude/tasks/medreader-build-11-4b-fix.md` · 근거 review.md "11-4 Review"(11-4R-9 #1–#5) · 앞 지침 `medreader-build-11-4-explain.md` 규칙 그대로. **커밋하지 않았다.**
> 스크래치 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b11-4b\` (`r11-4/` 는 읽기만).

## 1. 고친 것 (전 → 후)

| # | 전(11-4R) | 후 | 곳 |
|---|---|---|---|
| 1 중간 | 낭독 중 단추 설명이 PARSE·DIGITS 등으로 실패 → 띠 실패 줄 **0ms**, 배너 0. 같은 문장 다시 → 실패 기억 0호출·표시 0 | 11-D15 "곧 되돌림" 그대로 + 되돌린 뒤 상태 바 `explain.failed` 한 줄 + **[다시 시도]**(누르면 배너 거두고 그 문장 `retry:true` 1호출 — 실패 기억을 넘어). headless: 실패 후 **320–327ms** 에 배너, 2.5초 표본 끝까지 남음 · 다시 누름(0호출)에도 배너 한 장 · [다시 시도] → **1호출 · 같은 문장(해시) · ready · 말하는 동안 paused → 이어 읽기 speaking** · 클릭 뒤 배너 0. 원격 막힘(429)·멈춘 상태 실패·음성 갈래는 배너 없음(지금 그대로) | `ask.js`(되돌린 뒤 `bandCall('noteBanner', rec, retry)` — 단추·읽던 중만) · `trband.js`(순수 `noteFailBanner` + `noteBanner` — `medreader:banner` 를 낸 뒤 `main.js` 배너에 `button.banner-action[data-i18n="readalong.retry"]` 를 [닫기] 앞에 붙임) |
| 2 낮음 | 설명 A(기다리는·말하는 중) → 다른 문장 B → B 끝나도 paused(presses 0) | B 는 A 의 `was` 를 이어받음 → B 뒤 **speaking**(presses 1). A 띠가 이미 닫혔으면(재개·[×]·쪽 넘김) 잇지 않음. node `rexplain` chain: `afterBState` paused → **speaking**, `pendingThenB_State` paused → **speaking** · headless S7 기다리는·말하는 갈래 둘 다 after `speaking` · 요청 2 · A 늦은 응답은 말하지 않음 | `ask.js`(`held = {id, was}` · `inherit(was)` — 열린 설명 띠의 `isNoteOpen(id)` 로 판단) |
| 3 낮음 | [설명] 줄을 띠 위로 안 올림 — 줄 아래끝 669 · 띠 윗변 667(2px 덮임) | 줄 568–663 · 띠 667 → **덮임 0**([문장 번역] 506–601 그대로) | `controls.js` 선택 줄 `explain` 갈래에 `liftLineAbove(snap.lineId, liftEdge(selbar ? selbar.top() : null, trband.bandTop()))` 한 줄 |
| 4 낮음 | V2·V6 를 지키는 시험 없음 | X10: createAsk 블록의 `focusBack: function (lineId, reveal) { focusLine(lineId, reveal); }` · X9: 기다리는 사이 `band.userClose()` → 한 마디 0·되돌림 0·paused | `tests/explain-11a.test.mjs` |
| 5 낮음 | 띠 `aria-live` 없음 | 그대로 — 실패는 #1 배너로 알림. 배너 상자 `#banners` = `role="status"`·`aria-live="polite"` 확인(headless `hostRole status`·`hostLive polite` · X10 정규식) | — |

i18n 새 키 **0**(`explain.failed`·`readalong.retry` 재사용 — 4언어 이미 있음). `main.js` 는 손대지 않음(배너 `actions` 가 이동·다시 불러오기만 받아서 단추는 띠가 DOM 으로 붙임 — `withdraw` 와 같은 결).

## 2. 시험

- `tests/explain-11a.test.mjs` 10 → **12**: X5 에 `noteFailBanner` 표(실패 6 사유 + `ABORTED` → 배너 · 원격 막힘 8 + `NETWORK`/remote offline → null) · X9 에 V6 · X10 에 V2·#3·`noteBanner` 모양·ask 배선·`#banners` aria · **X11**(#1 — PARSE·DIGITS 각각: 곧 되돌림 · 배너 1 · 다시 누름 0호출 배너 2 · 배너 retry 1호출·같은 문장·`pipeline.retry()` 0·ready·말하는 동안 paused·이어 읽기 같은 idx · 429 배너 0 · 멈춘 상태 띠 줄 남고 배너 0 · 음성 배너 0) · **X12**(#2 — A 기다리는 중 → B · A 말하는 중 → B · A 를 손으로 닫은 뒤 B 는 안 이음 · 멈춘 A → B 멈춘 채). 가짜 띠 `pressPlay` 가 띠를 닫게 함(controls `pressPlay` → `trband.closeTap` 과 같게).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,822/1,822 · 1,822/1,822**(fail 0 · 10.5초 · 10.6초 · `b11-4b/full1.tap`·`full2.tap`).
- stamp 다시(단독 명령 — "다시 썼다 모듈 86 · CSS 4") → `--check` "그대로다" · `git diff --check` 0 · 새 시험 `--no-index --check` 0 · spec 를 읽는 `scan-8l` 다시 16/16.

## 3. 변이 (`b11-4b/mut.mjs` — 원본을 `bak/` 에 쓰고 한 곳만 → 시험 10파일 166건 → `bak/` 를 읽어서 씀 → 바이트 비교 · 끝에 `cmp` 4파일 0)

| # | 변이 | 결과 |
|---|---|---|
| M1 | ask — 되돌린 뒤 실패 배너 빼기 | **빨강** X10 · X11 |
| M1b | ask — 배너 조건에서 "읽던 중" 빼기(멈춘 상태에도) | **빨강** X10 · X11 |
| M1c | trband — 원격 막힘도 실패 배너 | **빨강** X5 · X11 |
| M2 | ask — `was` 이어받기 빼기 | **빨강** X12 |
| M2b | ask — A 띠가 닫혔는지 안 보고 이어받기 | **빨강** X12 |
| M3 | controls — [설명] 줄 띠 위로 빼기 | **빨강** X10 |
| V2 | controls — 설명 띠 포커스 `reveal` 버림(Review V2) | **빨강** X10 |
| V6 | voice.js — 음성 갈래 `cancelled` 무시(Review V6) | **빨강** X9 |

기준선 166/166 → 변이 뒤 166/166 · 매 변이 뒤 복원 바이트 같음 · `cmp` ask·trband·controls·voice ↔ `bak/` 0(voice.js 는 변이용으로만 잠깐 바꾸고 원본 그대로).

## 4. Review 하네스 다시

- `r11-4/rbody.mjs`(그 자리에서 실행 — 쓰기 없음): 6조합 **본문 40개 HEAD 와 바이트 같음**.
- `r11-4/rexplain.mjs`(쓰기 없음): req·ctx·digits·cut·calls·flow·voice 값 11-4R 과 같음(1,494 · −1 · 1,499 · 12꼴 빠짐 · PARSE/MISSING/SAFETY/EMPTY 캐시 0 · 연타 1 · `byKind.explain` 1 · 키 4 …) · **chain 만 바뀜**(#2 기대대로: `afterBState` speaking · `presses` 1 · `pendingThenB_State` speaking).
- `b11-4b/rvoice.mjs`(r11-4 사본 — r11-4 head 에 쓰지 않고 Review 가 만든 `commands-r.mjs` 를 import, HEAD `commands.js` 와 같은 글인지 확인): **692판 diff 0 · 이웃 셋 688판 0** · explain 행만 enabled false→true.

## 5. headless (Edge · pipe · 새 프로필 `b11-4b/p*` · 가짜 키 `…build_b11_4b` · 흉내 Gemini OPTIONS 204 + CORS · 흉내 음성·9b 가짜 인식기 · 캐시 끔 · 서버 없음(가로채기) · 합성 PDF `b11-2/syn.pdf` 읽기만 · 한 번에 하나)

| 실행 | 프로필 | 시간 | 결과 | 콘솔 오류 · pageerror · 외부 · 없는 파일 · 흉내 오류 |
|---|---|---|---|---|
| `run-x.mjs`(Review 사본 + S3 확장 + S7) | pX1 | 75초 | S1·S4·S5·S6 = Review `x2.json` 과 같은 값 · S2 #3 덮임 0 · S3 #1(위 표) · S7 #2 | 0 · 0 · 0 · 0 · 0 |
| `run-t.mjs`(Review 사본 — 8c-1 탭 띠 회귀·inline 바꿔 끼우기) | pT1 | 26초 | 설명 뒤 [문장 번역] 꼬리표·[▶] 숨음·[문단 전체]·"번역 닫기" · 탭 요청 1 · 닫기 다섯 · `inlineSeq on,null,null,null,on` — 11-4R 과 같음 | 0 |
| `run-r.mjs`(Review 사본 — 18·Esc 층 셋·손가락 탭·9a·9b·8e) | pR1 | 29초 | 메뉴 top 468 · Esc 층 포커스 순서 · 9a stops 1 → speaking · 9b idx 1 · dock 329/390 등 `r11-4/r1.json` 과 같은 값 | 0 |

스크린샷 `b11-4b/shots/`: `b1-explain-lift-ko-412.png`(줄이 띠 위) · `b2-fail-banner-ko-412.png`("설명을 받지 못했습니다." [다시 시도] [닫기] — 48px).

## 6. spec

17-2-1 4-7 의 `[정정 2026-11-17 — 11-4 Build]` 줄: ⑤ 의 "실패 한 줄은 잠깐만 보인다" → "재개와 같은 틱에 닫혀 **보이지 않는다**(11-4R 측정 0ms — 아래 11-4b 가 상태 바 배너로 알린다)"(Edit 로 그 자리만) · 그 줄 바로 뒤에 `[정정 2026-11-17 — 11-4b]` 한 줄(①–④).

## 7. 남은 것 · 판단

1. 설명 A 진행 중 B 가 **대상 아님·문지기 막힘**이면 B 는 띠 한 줄만 내고 멈추지 않는 갈래라 스스로 이어 읽지 않는다(A 는 띠가 바뀌어 cancelled — 낭독은 멈춘 채, [▶] 한 번이면 그 자리부터). 대신 B 띠가 A 의 `was` 를 들고 있어, 그다음 정상 [설명] C 는 이어받는다. 이 갈래를 B 가 곧 이어 읽게 바꾸면 "설명하지 않음" 줄이 #1 처럼 바로 사라져 그대로 둠.
2. 실패 배너는 [다시 시도]·[닫기] 를 누를 때까지 남는다(다른 문장 설명이 성공해도 거두지 않음 — 그 문장의 실패는 여전히 사실). 다른 문장이 또 실패하면 같은 키라 한 장, [다시 시도]는 **마지막 실패** 문장.
3. 배너 [다시 시도]는 단추 갈래로 다시 부른다(그 순간 읽는 중이면 멈추고 설명한 뒤 이어 읽기). 원격 막힘이 그사이 생겼으면 띠 규칙대로 `pipeline.retry()` 먼저(사용자 동작).
4. 실기기 목록(11-4 보고 12절)의 "단추 설명이 낭독 중 실패할 때 까닭을 알아채는가" 항목은 이제 "배너가 시스템 선택 메뉴·상단바와 겹치지 않는가 · 화면 읽기(TalkBack)가 배너를 읽는가"로 바꿔 보면 된다.

## 8. 실행 · 정리

- **막힌(거절된) 명령 0.** 명령은 한 호출에 한 가지(파이프·`; echo`·`cd … &&` 0 — 첫 시험·stamp 도 단독). 실패 1회: `sed … -o 파일`(GNU sed 에 `-o` 없음 — 오류 종료, 아무것도 안 씀) → `Write` 로 사본을 만듦(변형 찾기 아님 — 같은 내용을 도구로).
- 서버 띄움 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · `r11-4/` 쓰기 0(하네스는 사본·`rexplain`·`rbody` 는 그 자리에서 읽기만 실행) · `.claude/tasks/medreader-build-12-1-srs-service.md` 손대지 않음 · 원서 열지 않음(합성 PDF·지어낸 글만, 결과에 글 0).
- 수정 파일: `js/ui/ask.js` · `js/ui/trband.js` · `js/ui/controls.js`(배선 2줄) · `tests/explain-11a.test.mjs` · `index.html`(stamp) · `spec.md`(그 자리 + 한 줄) · 이 보고서. i18n 4개 무변.
- 스크래치 `b11-4b/`: `mut.mjs`·`bak/` · `mkcommon.mjs` → `common.mjs`·`run-t.mjs`·`run-r.mjs`(사본) · `run-x.mjs` · `rvoice.mjs` · `full1.tap`·`full2.tap` · `shots/` · 프로필 `pX1`·`pT1`·`pR1`.
