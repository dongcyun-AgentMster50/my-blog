# Build 보고 — 8c-1b: 8c-1 Review 지적 고치기 (2026-11-16)

> 지침 `.claude/tasks/medreader-build-8c1b-fix.md` · 근거 review.md "8c-1 Review"(8c1R-1~10) · 앞 지침 `medreader-build-8c1-taptr.md` 의 규칙·금지 그대로. 운영자 위임: 권장안. **커밋하지 않았다.**
> 스크래치 `…/scratchpad/b8c1b/`(Review 의 `r8c1/` 는 읽기만 — `common.mjs`·`dbg-key.mjs` 의 진짜 터치 방식을 본떠 새로 씀).

## 1. 고친 것별 결과

| # | 지적 | 고침 | 확인 |
|---|---|---|---|
| 1 | **중간 — 여러 손가락**(8c1R-9 #1) | `js/text/select.js` 에 순수 `createTapTracker()` — 누름 기록을 **`pointerId` 별 Map** 으로. 기록이 둘 이상이 되면 닿아 있는 모든 기록에 `multi` 표시(그 제스처의 어느 손가락도 탭 아님, 먼저 뗀 손가락이 지워져도 남은 손가락은 끝까지 multi). 같은 종류의 **primary** 누름이 오면 그 종류의 옛 기록(뗌을 못 받은 찌꺼기)을 지운다. `isTap(down, up, hadSel, multi)` — ⑤ 다중 터치 → 탭 아님, ⑥ **짝 없는 `pointerup`(down null) → 탭 아님**(8c-1 의 "기록 없음 = ③④만" 을 바꿈). `reader.js`·`original.js` 둘 다 같은 트래커, `pointercancel`·`lostpointercapture` 가 `drop`. I1 에 2줄(10줄), 새 I1b(트래커 순서 시나리오 7개) | node I1·I1b · 진짜 터치 아래 2절 |
| 2 | 낮음-2 동시 요청 | `readalong.requestTap` — **한 번에 하나** + **대기 한 칸**. 떠 있는 동안 새 탭은 대기 칸에, 앞 대기는 **보내지 않고 버림**(`{calls:0,sent:0,dropped:true}`). 끝나면 대기 칸을 그때의 메모리로 다시 걸러 보냄. 문서가 바뀌면 대기 칸은 버림. 이유: 띠는 마지막 탭만 보이므로 지나간 문단을 보낼 까닭이 없고, 호출 수가 설계 6절 "문단당 1" 을 넘지 않으면서 오히려 줄어든다(뒤로 줄 세우기는 지나간 문단까지 다 보내 호출이 그대로). 낭독 동반 번역의 동시 상한·요청 바이트는 손대지 않음. 429→`exhausted`(8a)는 **바꾸지 않고** crossstep 다듬기 후보로 | node I4e · headless K |
| 3 | 낮음-3 오프라인 띠 | 작은 쪽 = **한 번 다시 요청**(띠 글 "연결되면 번역이 나옵니다" 를 지키는 쪽 — [다시 시도] 를 띄우면 글과 어긋남). `trband.onRemote` 의 ready 갈래에서 `resendTapOnline(d.prev)` — 순수 `tapResendOnline(recs, prev, already)`: 직전 원격 상태가 `offline` 이고 문단에 `blocked/offline` 문장이 있고 이 탭에서 아직 안 보냈을 때만. 부르는 것은 controls 가 넘긴 `resend = ask(false)`(retry 표시 없음 — 사용자 [다시 시도]가 아니다; 파이프라인 자동 재전송 `kick` 과 같은 성격). `window` `online` 을 직접 듣지 않고 파이프라인이 offline→ready 로 바뀐 뒤의 `remote` 이벤트를 쓴다(순서가 꼬여 다시 막히지 않게) | node I7e · headless O |
| 4 | 낮음-5 접근성 | [×]·Esc 로 닫으면(`closeTapByUser`) 포커스를 **탭한 줄**로(`reader.focusLine` — 줄에 `tabindex=-1` 을 잠깐 달고 떠나면 뗌, 스크롤 없음), 줄이 없거나 원본 보기면 리더 본문 `#readerMount`. 다른 닫기(다른 줄 탭·[▶]·쪽 넘김·다음 문장)는 포커스를 건드리지 않음. **Esc**: `document` keydown **붙잡기 단계** — 순수 `escClosesTap({tapOpen, prevented, layers})`, `layers` = 보이는 `[role=dialog]`(Aa·속도 팝오버·음성 고지 카드)·`dialog[open]`·펼친 8e `[≡]`. 위 층이 있으면 손대지 않음(Aa 팝오버가 자기 Esc 로 닫힌 뒤 띠까지 닫히지 않게 — 붙잡기 단계라 그 판단이 팝오버가 닫히기 전에 일어난다). 키보드로 탭 번역을 **여는** 길은 만들지 않음(설계 밖 — crossstep 후보) | node I7e · headless E1–E3·T6 |
| 5 | 낮음-6 테스트 구멍 | (a) I4b 에 `{timeout:10000}` + 각 대기에 `within(p, 2000)`(Promise.race) — V4 가 이제 **멈춤이 아니라 2초 만에 빨강**. (b) V8: 계획을 순수 `tapPlan(units, lineId, segsWanted, translatable)`(select.js)로 떼어 controls 가 부름 → 새 I2c. V6: 선택 줄 판단을 순수 `selBarStep(hasSnap, {hidden, hiding})`(selbar.js)로 떼어 `update` 가 부름 → 새 I7d(+ `update` 배선 정규식). (c) WB1: 재시도 **호출 꼴**(`.retry(`·`then(x.retry)`) 셈 = 2, 둘 다 `onRetry` 안 | 변이 V4·V6·V8 아래 4절 |
| 낮음-4 | 띠가 새로 뜨며 선택 줄이 고른 글자를 덮음 | 작아서 고침: `openTapFor` 의 굴리기 가장자리 = 선택 줄이 보이면 `selbar.top()`(새 export), 아니면 띠 윗변 | headless L — 고른 글자 아래변 590.9 ≤ 선택 줄 윗변 595.1 − 4(전에는 띠 윗변 657 기준이라 653 까지만 굴려 595–653 의 선택 줄 밑에 깔림). 915×412 ar: 140.6 ≤ 182.7 − 4 |

덧: 측정용으로 controls 디버그 훅 `tts.readalong()` 에 `taps·tapBusy·tapWaiting`(수만) 추가, readalong `stats()` 에 `tapBusy·tapWaiting`.

## 2. 진짜 터치 측정 (CDP `Input.dispatchTouchEvent` — `run-touch.mjs`)

새 프로필 · pipe · 가짜 키 · 흉내 Gemini(OPTIONS 204 + CORS) · 흉내 음성. 412×915 ko(`p6` → `t5.json`) 와 915×412 ar(`p16` → `t10.json`) 둘 다 같은 결과.

| 손짓 | 브라우저가 만든 포인터 순서 | 결과 | 기대 |
|---|---|---|---|
| 한 손가락 60ms 탭(idle) | down#2P → up#2P → lostpointercapture#2P | 띠 열림 · POST 1 | 1 ✓ |
| **두 손가락 정지 탭**(서로 다른 문단) | down#3P → down#4 → up#3P → lost#3P → up#4 → lost#4 | 띠 안 열림 · POST 0 · 탭 요청 수 그대로 | 0 ✓(전: 2번 불림) |
| **엄지 1.5s 대고 다른 손가락 탭 → 엄지 뗌**(idle) | down#5P → down#6 → up#6 → lost#6 → up#5P → lost#5P | 손가락 뗀 뒤·엄지 뗀 뒤 모두 띠 null · POST 0 | 0 ✓ |
| 그 뒤 한 손가락 탭 | | 열림 · POST 1 | 1 ✓(다중 표시가 남지 않음) |
| 낭독 중 엄지 1.5s + 다른 손가락 | | 이동(cancel) **0 · 0** | 0 ✓(전: 엄지 뗄 때 한 번 더 이동) |
| 낭독 중 두 손가락 정지 | | 이동 0 | 0 ✓ |
| 낭독 중 한 손가락 탭 | | 이동 1 | 1 ✓ |
| 원본 보기 두 손가락 / 한 손가락 | | 띠 null / 열림 | 0 / 1 ✓ |

`lostpointercapture` 는 `pointerup` **뒤에** 온다(실측) — 기록을 먼저 지우지 않는다. 하네스 메모: CDP `touchEnd` 의 `touchPoints` 는 **뗀 점**이다(첫 실행 `t3` 에서 엄지를 먼저 떼게 짜 순서를 확인 후 고침 — 그 실행도 결과는 0).

그 밖(같은 실행): E1 [×](키보드 Enter) → 포커스 `trClose` → `line:40:41`(탭한 줄) ✓ · E2 Esc → 닫힘·포커스 탭한 줄 ✓ · E3 속도 팝오버 열린 채 Esc → 띠 그대로·팝오버 그대로 ✓, Aa 팝오버에서 Esc → 팝오버만 닫힘·띠 그대로 ✓, 가로 `[≡]` 펼친 채 Esc → 띠 그대로 ✓, 위 층이 없을 때 Esc → 띠 닫힘 ✓ · 원본 보기 Esc → 포커스 `readerMount` ✓ · K 다른 문단 셋을 150ms 간격으로(응답 지연 900ms) → **POST 2 · 동시 최대 1** · 중간에 대기 칸 있음 ✓(가로는 한 화면 문단 둘 → POST 2·동시 1) · O offline 탭 → 막힘·POST 0 → `online` → **POST 1 · ready** ✓ · 콘솔 오류 0 · pageerror 0 · 외부 요청은 pdf.js CDN 뿐.

## 3. 수용 기준 "8c-1" 다시 (앞 Build 하네스 A–D 재사용, 새 프로필)

| 시험 | 프로필 | 결과 |
|---|---|---|
| A(412×915 ko, 16단계) | `p7` → `a1.json` | 15단계 **앞 Build `b8c1/a3.json` 과 같음**(좌표 제외 비교). `13-offline` 만 POST 0 → 1: 이 하네스는 offline 스냅숏 **뒤** `online` 을 보내고 POST 를 세므로 고침 3의 다시 보내기 1건이 들어간 것(offline 동안 띠 blocked·배너 `ai.state.offline`·요청 0 은 같음) — 의도한 차이 |
| B(크기 3 × 언어 4 + 원본 보기) | `p8` → `b1.json` | 12조합 checks 전부 ✓ · 넘침 0 · 단추 48 · 원본 보기 탭 열림·낭독 중 cancel +1. 차이는 좌표 1px·새 프로필이라 원본 탭 POST 0→1(캐시 없음) |
| C(낭독이 받은 쪽 탭 0) | `p9` → `c1.json` | 앞 Build 와 **같음**(탭 3번 POST 0) |
| D(off 에서 낭독 중 [문장 번역]) | `p1` → `d1.json` | 앞 Build 와 **같음** |
| 요청 본문 바이트 | HEAD 판(`git archive` → `b8c1b/orig`, 140파일 가로채 내줌) `p10` / 작업 트리 `p11` | `[2747 B 8f301ea7…, 9426 B 1da11781…]` · 항목 [4, 58] — **HEAD 와 같음**(앞 Build·Review 와도 같은 해시) |

콘솔 오류: A 의 의도한 429·500 흉내 응답 네트워크 줄 3개뿐(앱 오류 0), 나머지 0.

## 4. 테스트 · 검사 · 변이

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs`: **1회차 1546/1546 · 2회차 1546/1546**(`full1.txt`·`full2.txt`). 8c-1 의 1541 + 새 5(I1b·I2c·I4e·I7d·I7e). 고친 기존 테스트: I1(행 추가·"기록 없음" 행 기대값 true→false — 규칙이 바뀜), I8·I8b(배선 정규식을 `tapPlan`·트래커·`lostpointercapture` 로), I4b(시간 상한), WB1(셈 확장). 다른 단계 테스트 수정 0.
- `node apps/medreader/dev/stamp-importmap.mjs` 다시 → `--check` "그대로다 (모듈 68개 · CSS 4개)". `git diff --check` 0, 새 파일 3개 줄 끝 공백 0.

변이(백업 `b8c1b/bak/` → `mut.mjs` 정확히 1곳 → 전체 테스트 → headless(`page.setCacheEnabled(false)`, 새 프로필 `pm*`) → `restore.mjs`(백업을 읽어 쓰기) → `cmp` 같음). import map 해시 시험 3개(IM2·IM6·IM7b)는 어떤 변이에도 빨강이라 셈에서 뺐다.

| # | 변이 | node | headless | 복원 cmp |
|---|---|---|---|---|
| M1 | 트래커 Map → 한 칸(`downs.clear()` 후 set) | **I1b 빨강** | 두 손가락 → 띠 열림·POST 1, 엄지+손가락 → 열림, 낭독 중 엄지+손가락 이동 1·두 손가락 이동 1, 원본 두 손가락 열림 = 빨강 | 같음 |
| M2 | "짝 없는 up 은 탭 아님" 지움(`!down` → true) | **I1·I1b 빨강** | (안 함 — 포인터별 기록이 살아 있으면 이 손짓들에서 짝 없는 up 이 생기지 않는 방어 규칙) | 같음 |
| M3 | Esc 핸들러 지움 | **I7e 빨강** | Esc 로 안 닫힘·포커스 `trClose` 그대로(E2·E3·원본) = 빨강 | 같음 |
| M4 | 동시 1 상한 지움(`false && tapBusy`) | **I4e 빨강** | K: POST 3·**동시 3** = 빨강 | 같음 |
| M5 | 연결 회복 다시 보내기 지움 | **I7e 빨강** | O: online 뒤에도 blocked·POST 0 = 빨강 | 같음 |
| V4(Review) | `requestTap` pending 거름 지움 | **I4b 빨강 2.0초**(전: 멈춤) · 전체 9.4초에 끝남 | — | 같음 |
| V6(Review) | 접혀도 거두지 않음(`hideLater:false`) | **I7d 빨강**(전: 생존) | — | 같음 |
| V8(Review) | 문단 대신 탭한 문장만(`firstUnitsOf`) | **I2c 빨강**(전: 생존) | — | 같음 |

## 5. spec · crossstep

- spec 17-7-6 8 "8c-1" 머리, 8c-1 Build 정정 줄 바로 아래에 `[정정 2026-11-16 — 8c-1b]` 한 줄(Edit 로 그 자리만).
- crossstep-notes "다음 다듬기 묶음 후보" 에 8c-1 줄 하나 덧붙임: 429 → `exhausted` 일괄 판정(pipeline 8a 몫 — RPM/일 한도 가르기), 키보드로 탭 번역 여는 길, 대기 칸은 [×] 로 닫아도 버리지 않음.

## 6. 고치지 않은 것 · 이유

1. **429 를 `exhausted` 로 읽는 파이프라인 동작** — 지침대로 바꾸지 않음(`pipeline.js` 금지). 탭은 동시 1 로 줄였지만 낭독 동반 번역과 겹치면 분당 한도 429 가 하루 막힘으로 보일 수 있다 → crossstep 후보.
2. **키보드로 탭 번역 열기** — 설계 3·4절 밖(줄은 포커스 대상이 아님). 만들지 않음 → crossstep 후보. 닫기(Esc·[×] Enter)와 포커스 되돌림만.
3. **대기 칸과 [×]** — 탭 A 가 떠 있는 동안 탭 B 가 대기 칸에 들어간 뒤 [×] 로 닫으면, A 가 끝난 뒤 B 를 보낸다(문단당 1 안, 사용자가 부른 것). 닫을 때 대기 칸을 비우는 API 를 새로 만들지 않았다(범위 최소) → crossstep 후보.
4. **연결 회복 다시 보내기는 탭 한 번에 한 번**(`resent`) — 두 번째 끊김부터는 같은 줄을 다시 탭해야 한다(blocked 는 거름 대상 아님). 띠 글과 맞추려고 넣은 최소 동작.
5. 낭독 중 [문장 번역] 띠가 offline 막힘이고 회복 순간 낭독 창(`kick`)도 같은 문장을 다시 보내려 하면, 탭 다시 보내기가 먼저 `pending` 을 걸어(같은 마이크로태스크 순서) 중복이 생기지 않을 것으로 보지만 headless 로 그 겹침을 만들지는 않았다.
6. 실기기 `[M]` 은 앞 Build 목록 그대로 + **두 손가락·엄지 대고 탭**(Nour GT 7 Chrome — `isPrimary`·`lostpointercapture` 순서가 headless 와 같은가) 한 줄.

## 7. 규칙 · 막힌 명령

- **막힌 명령 0.** 커밋 0 · `git checkout/restore/stash` 0 · npm 설치·다운로드 0 · `rm` 0 · `.nojekyll` 그대로 · 프로세스 조회·디버깅 포트 0(브라우저 pipe, `try … finally browser.close()`) · 8000 python 은 쓰기만(응답 확인 curl 1번) · 8123–8125 무관 · puppeteer-core 읽기만 · 프로필 복사 0(모두 새 폴더) · 진짜 키 0 · 모든 실행 10분 안(가장 긴 것 run-touch 첫 p3 시도 183초 — 아래) · C: 여유 129GB · 의학책 읽기만(가져오기), Downloads 목록 안 봄 · 결과 JSON 에 원서 문장 없음(줄 id·길이·해시·좌표만).
- **한 호출 한 가지 어긴 것 3번(읽기·만들기뿐, 영향 없음)**: 첫 전체 테스트를 `> 파일; tail` 로 한 호출에 · A 실행 때 `mkdir shots && node run-a` · `git archive | tar -x`(내보내기와 풀기 — 한 일로 봄). 그 밖 백업·복사(6개 각각)·복원·cmp·도장·검사는 각각 따로.
- 무효 실행: `t1`(p2 — 한 화면에 문단 둘이 없어 하네스 오류) · `t2`(p3 — 183초 뒤 대기 실패, 원인 못 봄; 오류 기록을 넓혀 p4 로 다시는 정상 52초) · `t3`/`t4`(하네스: 엄지를 먼저 뗌·`L` 띠가 안 숨음·원본 보기를 멈춤 상태에서 잼·O 가 번역 대상 없는 줄을 고름 — 앱 결과는 모두 기대대로) · `t6`–`t9`(가로: Aa 단추가 `[≡]` 안·한 화면 문단 부족 — 하네스 고침). 최종 `t5`(412 ko)·`t10`(915 ar).

## 8. 바꾼 파일

`js/text/select.js`(`isTap` 넷째 인자·⑥, `createTapTracker`, `tapPlan`) · `js/ui/reader.js`(트래커·`lostpointercapture`, `focusLine`) · `js/ui/original.js`(트래커) · `js/ai/readalong.js`(탭 동시 1·대기 한 칸, `stats` 2필드 — 탭 경로만) · `js/ui/trband.js`(`closeTapByUser`·Esc·`escClosesTap`·`tapResendOnline`·`resendTapOnline`, openTap `resend`·`focusBack`) · `js/ui/controls.js`(`tapPlan`·`resend`·`focusBack`·선택 줄 윗변 굴리기, 디버그 훅 3필드) · `js/ui/selbar.js`(`selBarStep`·`top()`) · `tests/taptr-8c.test.mjs` · `tests/trband.test.mjs`(WB1) · `index.html`(stamp) · `spec.md`(한 줄) · `.claude/tasks/medreader-crossstep-notes.md`(한 줄 덧붙임) · 이 보고서. `pipeline.js`·`provider.js`·review.md·`dev/`·i18n·css 무변.

## 9. 스크래치패드 (`…/scratchpad/b8c1b/`)

`backup.mjs`·`mut.mjs`·`restore.mjs` · `common.mjs`(b8c1 판 + 진짜 터치·지연·동시 수) · `run-touch.mjs`(인자: 프로필 크기 UI) · `run-a/b/c/d/body.mjs`·`prep.mjs`(앞 Build 복사) · 결과 `t5.json`(412 ko)·`t10.json`(915 ar)·`a1/b1/c1/d1.json`·`body-head/new.json`·`m1h/m3h/m4h/m5h.json` · 테스트 `run0.txt`·`full1.txt`·`full2.txt`·`m1–m5.txt`·`v4/v6/v8.txt` · `orig/`(HEAD 판) · `bak0/`(고치기 전)·`bak/`(변이 전) · 프로필 `p1`–`p16`·`pm1`·`pm3`–`pm5`.
