# Build 보고 — 8c-1c: 8c-1b 재검증 지적 고치기

> 지침 `.claude/tasks/medreader-build-8c1c-fix.md`. 근거 `apps/medreader/review.md` "8c-1b 재검증"(8c1bR-8 #1–#5·#7). 커밋 0.
> 스크래치 `b8c1c/`(Review `r8c1b/` 는 읽기만 — 하네스는 `prep.mjs`·`prep-r.mjs` 로 **읽어서** 옮겨 씀, `small.pdf` 는 그 자리에서 읽기만).

## 1. 고친 것

| # | 지적 | 고침 | 파일 |
|---|---|---|---|
| 1 | 중간-1 본문 밖에서 뗀 마우스·펜 기록이 다음 손가락 탭을 "여러 손가락"으로 | `createTapTracker` 에 `release(id)` — 문서 **붙잡기 단계** `pointerup` 이 그 기록에 "떼어짐" 표시만 한다(지우면 같은 이벤트의 본문 `up` 이 짝 없는 up 이 돼 모든 탭이 죽는다 — 붙잡기 단계가 본문보다 먼저 온다). 문서 붙잡기 단계 `pointercancel` 은 지운다. 다음 누름이 오면 **종류와 무관하게** 떼어진 기록을 지운다(같은 종류 primary 규칙은 그대로). 아직 누르고 있는 포인터(표시 없음)는 지우지 않으므로 두 손가락·엄지·마우스를 누른 채 손가락은 여전히 다중 | `text/select.js` · `ui/reader.js`(2줄) · `ui/original.js`(이름 있는 함수 2개 — 원본을 다시 열어도 한 번만 걸림) |
| 2 | 중간-2 검색 화면(리더 숨김)에서 Esc 가 숨은 띠를 닫고 검색어 지우기를 막음 | ① `reader.leaveReader` 의 검색 갈래(숨기기만)에서 `controls.closeTapBand()` → `trband.closeTap()`(포커스 되돌림 없음). 라우트 전환은 이미 `main.js` `onRoute` → `leaveReader()` 가 받으므로 **`main.js`·`router.js` 무변**. ② `onEscKey` 는 `bandShown()`(띠 `hidden` + 리더 화면 섹션 `hidden` + `getClientRects()`)일 때만. ③ **덧 고침(내가 만든 회귀)**: 닫을 때 `sync()` 가 숨은 화면 기준으로 띠를 숨겨, 보이기(show) 모드 낭독 띠가 검색에서 돌아와도 숨은 채 남았다(실측 `x6-after` backBand hidden true) → controls 에 `onPageRepaint(() => trband.sync())` 한 줄(다시 보이기·언어 바꿈 때 띠 자리 다시 잡음) | `ui/reader.js` · `ui/controls.js` · `ui/trband.js` |
| 3 | 중간-3 쪽 번호 고치던 중 Esc 가 쪽을 넘김 | `escClosesTap` 에 `editing`·`shown` 입력 — Esc 대상이 `input`·`textarea`·`select`·`[contenteditable]`(`isContentEditable` 포함)이면 손대지 않음(기본 동작 그대로). 띠 안 단추([×] 등)에 포커스면 그대로 닫힘 | `ui/trband.js` |
| 4 | 낮음-4 마지막 탭의 문단이 떠 있거나 받은 문단이면 대기 칸을 안 버림 | `requestTap` 의 "보낼 것 없음" 갈래에서도 대기 칸을 `{dropped:true}` 로 비움 | `ai/readalong.js`(탭 경로만) |
| 5 | 낮음-5 Esc·[×] 뒤 포커스가 화면 밖 줄로 | `focusLine(lineId, reveal)` — 줄이 본문 영역(`bodyArea`) 밖이면(`outOfView` 순수) `programScrollAt` 세우고 `scrollIntoView({block:'nearest'})`(상·하단 바는 기존 `scroll-padding` 이 비킴). **지침과 다른 점**: 굴림은 **키보드로 닫을 때만**(Esc · [×] 를 Enter/Space — `click.detail === 0`). 손가락·마우스 [×] 는 굴리지 않는다 — 처음 판(둘 다 굴림)으로 재 보니 띠를 연 뒤 읽으며 굴려 둔 사람이 손가락으로 [×] 를 누르면 화면이 탭했던 줄로 끌려 올라갔다(run-g G1b 가 이것 때문에 달라짐 — 아래 4절). 포커스 표시가 필요한 건 키보드 사용자뿐이라 그쪽만 | `ui/trband.js`·`ui/controls.js`·`ui/reader.js`·`text/select.js` |
| 6 | 낮음-7 R5(선택 줄 윗변 기준 굴리기) 생존 | 순수 `liftEdge(selTop, bandTop)` 로 떼고 controls 는 `liftLineAbove(lineId, liftEdge(selbar ? selbar.top() : null, trband.bandTop()))`. node: I7f(순수 표·굴림량이 실제로 달라짐) + I8 배선 정규식 | `text/select.js`·`ui/controls.js` |

낭독 위치와의 충돌(5): 탭 띠는 idle 이 보통이고 낭독 중엔 선택 줄 [문장 번역] 으로만 열린다. 그때 키보드로 닫고 줄이 화면 밖이면 그 줄로 가까운 쪽만 굴리며 프로그램 스크롤로 표시하므로 6-5 "사용자 스크롤 → 자동 스크롤 멈춤"이 켜지지 않는다 — 다음 문장에서 자동 스크롤이 다시 낭독 줄로 데려간다. 실측은 idle 만(낭독 중 키보드 닫기는 재지 않음).

## 2. 재현 전/후 (`b8c1c/repro.mjs` — 새 프로필·pipe·가짜 키·흉내 Gemini·흉내 음성, Review `ds1`·`e3s`·`e4b`·`e5l`·K3 꼴)

| 항목 | 고치기 전(`x1-before`·`x2-before`·`x3-before`) | 고친 뒤(`x11-after` 412 ko · `x12-after` 915 ar · `x7-after`/`x13-after` 검색) |
|---|---|---|
| X1 마우스로 글자 끌어 고르다 본문 밖에서 뗌 → 손가락 탭 2번 (412 ko) | 탭1 0(선택 풀기 — 맞음) · **탭2 0** · POST 0 | 탭1 0(선택 풀기) · **탭2 열림** · POST 1 |
| X1 펜을 본문에서 대고 본문 밖에서 뗌 → 손가락 탭 2번 (412 ko) | **0 · 0** | **열림 · 열림** · POST 2 |
| (청소 없이 이어 간 첫 실행 `x0-before`) | X1 뒤 **모든 손가락 탭이 끝까지 0**(X4·X5·X3·X2 전부 무효) | — |
| X1b 두 손가락 | 0 | 0(그대로) |
| X2 탭 띠 연 채 검색 화면 → 검색어 칸 Esc | 띠 `data-tap` **on** · 검색어 **안 지워짐**("zq") · `defaultPrevented` **true** | 검색 화면에 들어설 때 띠 **닫힘** · 검색어 지워짐 · `defaultPrevented` false · 돌아오면 낭독 띠(show) 보임·탭 다시 열림 |
| X3 띠 연 채 쪽 번호 고치던 중 Esc (412 ko) | `defaultPrevented` true · 띠 닫힘 · 포커스 `BODY` · **41쪽으로 넘어감** | false · **띠 그대로** · 포커스 입력칸 · **쪽 그대로**(고친 값은 칸에 남음 — 띠 없을 때와 같음) |
| X3 (915 ar) | 띠 닫힘 · 포커스가 입력칸에서 줄로 빠짐 | 띠 그대로 · 포커스 입력칸 · 쪽 그대로 |
| X3a [×] 에 포커스 두고 Esc | 닫힘 · 포커스 줄 | 같음 |
| X4 A(문단 P) → B(Q) → A'(P 다른 줄), 응답 1.5s | 중간 대기 있음 · **POST 2** · 띠 = P | 중간 대기 **없음** · **POST 1** · 띠 = P |
| X5 띠 연 뒤 1400px 굴리고 Esc | 포커스 줄 **화면 밖**(top −374) · 굴림 0 | 포커스 줄 보임(완전히) · 가장 가까운 쪽으로 굴림 |
| X5 굴린 뒤 손가락 [×] | — | 굴림 0(읽던 자리 그대로) · 포커스 줄(화면 밖, 표시 없음) |
| X5 굴린 뒤 [×] 에 포커스 두고 Enter | — | 줄 보임 · 굴림 |
| 원본 보기(`run-r.mjs pr3 orig`) | — | 한 손가락 열림 · 두 손가락 0 · 700ms 0 · Esc → `readerMount` · **마우스 쪽 밖 뗌 뒤 손가락 탭 2번 열림·열림** |

콘솔 오류 0 · pageerror 0(모든 재현 실행).

## 3. 8c-1b 재검증 "확인된 것" 그대로 (Review 하네스를 옮겨 새 프로필로 · `cmplaps.mjs` 로 Review 결과와 비교 — 좌표·포인터 id·표식 칸 뺌)

| 하네스 | 결과 | Review 대비 다른 곳 |
|---|---|---|
| `run-g` 412 ko(`g3.json`) — 손가락 수·핀치·같은 id·짝 없는 up·cancel·마우스·펜·낭독 중 | 한 손가락 1 · 600ms·20px 0 · 두/세 손가락·엄지·핀치 0 · 마우스·펜 그대로 | **G10b·G10c·G11 tap2·tap3 이 0 → 열림**(고침 1 — 의도) · 낭독 중 한 손가락 0 → 1(Review g2 의 0 은 그쪽 실행에서만 — Review 표 8c1bR-1 은 1·1·1, 기대 1) · pev 문자열(대상 태그) 뿐 |
| `run-k` 412 ko(`k1.json`) — 동시 1·대기·순서 뒤바꿈·[×] 대기·연결 회복 O1–O5 | K1 POST 2·동시 최대 1 · K2 띠 = C · K4·K5 다시 안 열림 · O1 1회 · O2 0 · O3 1 · O4 B 만 · O5 낭독 창 2 | **K3 POST 2 → 1**(고침 4 — 의도)과 그에 따른 누적 `taps` 셈 −1 뿐. 콘솔은 의도한 offline 네트워크 줄 3개(Review 와 같음) |
| `run-e2` 412 ko 책(`e4b.json`) — Aa·속도·선택 줄·띠 없음 Esc · 쪽 입력칸 | Aa 팝오버만 → 둘째 Esc 띠 · 속도 그대로 · 선택 줄 그대로·포커스 줄 · 띠 없이 Esc 무변 | **E3c(쪽 고치던 중 Esc) 띠 닫힘·41쪽 → 띠 그대로·40쪽·포커스 입력칸**(고침 3 — 의도) |
| `run-e2` 915 ar 책(`e5l.json`) — 위 + 가로 `[≡]` | 같음 | E3c 만 같은 꼴로 다름(의도) |
| `run-e2` 검색(`e3s.json`, 작은 PDF) | 띠 없음 기준 그대로 | **E4b 띠 닫힘·검색어 지워짐·`defaultPrevented` false**(고침 2 — 의도) |
| `b-run-body` 요청 본문 바이트(`pbody1`) | `[2747 B 8f301ea7…, 9426 B 1da11781…]` · 항목 [4, 58] | **HEAD 와 같음**(Review `body-head.json` 값) |
| `run-r` 9a·멈춤 탭(`pr1`) | 핸들러 5개 · 이어폰 play → 띠 닫힘·speaking · pause → paused · 멈춤 중 줄 탭 이동(cancel 1)·띠 없음 | Review `r2.json` 과 같음 |

포커스 표시(`:focus-visible`·외곽선)는 CSS 무변이라 다시 재지 않았다.

## 4. 테스트 · 검사

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs`: **1회차 1549/1549 · 2회차 1549/1549**(`b8c1c/full1.txt`·`full2.txt`; 8c-1b 1546 + 새 3개). 변이 복원 뒤 한 번 더 1549/1549(`full3-after-restore.txt`).
- 새·바꾼 테스트(`tests/taptr-8c.test.mjs`): **I1c**(본문 밖 뗌 — 마우스·펜 뒤 손가락 탭 1, 붙잡기 단계 표시가 본문 판정을 막지 않음, 아직 누른 마우스+손가락·두 손가락·엄지는 그대로 다중) · **I4f**(A→B→A' = 1회, 대기 B 는 dropped, ready 문단도 같음) · **I7f**(`liftEdge`·`outOfView`) · I7e(숨은 띠·편집 칸 행, `bandShown`·`isEditable`·`closeTapBand`·`onPageRepaint` 배선, Esc=`closeTapByUser(true)`·[×]=`ev.detail === 0`, `focusLine(lineId, reveal)`) · I8(`liftEdge` 배선) · I8b(두 뷰 문서 붙잡기 단계 배선, reader import 줄).
- `stamp-importmap.mjs` 다시 찍음 → `--check` "그대로다 (모듈 68개 · CSS 4개)"(마지막·변이 복원 뒤) · `git diff --check` 0 · 새 파일(`select.js`·`taptr-8c.test.mjs`) 줄 끝 공백 0.
- spec 17-7-6 8절 `[정정 2026-11-16 — 8c-1c]` 한 줄(8c-1b 정정 바로 아래, Edit 로 그 자리만).

## 5. 변이 (백업 `b8c1c/bak/`(`backup.mjs bak`) → `mut.mjs`(백업을 읽어 찾을 글자가 정확히 1곳일 때만 씀) → 전체 테스트 → headless(새 프로필, `setCacheEnabled(false)` — common 의 launch) → `restore.mjs`(백업을 읽어 씀) → `cmp` 같음)

import map 해시 시험 3개(IM2·IM6·IM7b)는 어떤 변이에도 빨강이라 셈에서 뺐다(Review 와 같음).

| # | 변이 | node | headless | 복원 cmp |
|---|---|---|---|---|
| M1 | 고침 1 되돌림 — 떼어진 기록을 안 지움(같은 종류 primary 만) | **I1c 빨강** | `m1h`: X1 마우스 탭2 0 · 펜 0·0 = 빨강 | 같음 |
| M1b | 고침 1 배선 — 리더의 문서 붙잡기 `pointerup` 지움 | **I8b 빨강** | `m1bh`: X1 마우스·펜 모두 0 = 빨강 | 같음 |
| M2 | 고침 2 — 검색으로 숨길 때 `closeTapBand()` 지움 | **I7e 빨강** | `m2h`: 검색 화면에서 띠 `on` 그대로·돌아와도 열림 = 빨강(Esc 는 `bandShown` 이 막아 검색어는 지워짐) | 같음 |
| M2b | 고침 2 Esc 쪽 — 화면 섹션 `hidden` 거름 지움 (+M2 함께 headless) | **I7e 빨강** | `m2bh`: 검색어 여전히 지워짐 — `getClientRects()` 거름이 숨은 섹션 안 띠도 0 으로 잡는다(겹 방어). headless 로는 생존 | 같음 |
| M3 | 고침 3 — `editing: false` | **I7e 빨강** | `m3h`: `defaultPrevented` true · 띠 닫힘 · 포커스 BODY · **43쪽으로 넘어감** = 빨강 | 같음 |
| M4 | 낮음-4 — 일찍 돌아가는 갈래의 대기 비우기 지움 | **I4f 빨강**(2.0초) | 생략(고치기 전 판 X4·K3 POST 2 가 같은 코드) | 같음 |
| M5 | 낮음-5 — 화면 밖 줄 굴림 끔 | **I7e 빨강** | 생략 | 같음 |
| M6 | 낮음-7 = Review R5 — `liftEdge(null, …)`(선택 줄 윗변 안 넘김) | **I8 빨강**(R5 이제 잡힘) | 생략 | 같음 |

변이 뒤 `git diff --stat`·`stamp --check`·`git diff --check` 처음과 같음.

## 6. 고치지 않은 것 · 남은 것

- 고침 1 의 남은 틈: 마우스를 **창 밖**에서 뗀 경우처럼 문서에도 `pointerup` 이 오지 않으면 기록에 표시가 없어 남는다 → 같은 종류(마우스) primary 누름이 올 때까지 다음 손가락 탭이 다중으로 셈. headless 로 재지 않음. 지침 문구("이미 떼어진 옛 기록")대로 표시 있는 것만 지웠다 — 표시 없는 다른 종류 기록까지 지우면 "마우스 누른 채 손가락 탭"이 탭이 된다.
- 지침 1 의 "primary 누름이 오면"을 **모든 누름**으로 넓혔다(떼어진 기록은 그 이벤트가 끝난 뒤엔 언제나 찌꺼기라서 primary 가 아니어도 안전) — 보고서에만.
- 고침 5 를 키보드 닫기로 좁힌 것(1절 표) — Review 가 다르게 보면 되돌리기 쉬움(`focusLine` 의 `if (!reveal) return;` 한 줄).
- 8c1bR-8 #6(정보 — 동시 1 의 체감 지연 `[M]`)·키보드로 탭 번역을 **여는** 길(설계 밖) — 손대지 않음. 429 → `exhausted` 파이프라인 동작 무변.
- 손가락·마우스 [×] 뒤 포커스는 여전히 화면 밖 줄로 갈 수 있다(굴리지 않으므로) — 포인터 사용자에겐 포커스 표시가 없어 보이는 문제는 없음.

## 7. 실행 · 정리

- 명령은 한 호출에 한 가지(테스트·도장·검사·백업·변이·복원·`cmp`·headless 각각). `cd … &&`·파이프 0. 긴 headless 는 `timeout 560 node …`(한 명령 상한).
- 막힌 명령 0. 서버 새로 띄움 0(8000 응답 확인 curl 1번) · 8123–8125 무관 · 프로세스 조회·디버깅 포트 0(pipe, `try … finally browser.close()`) · 프로필 복사 0(모두 새 `b8c1c/p*`) · 진짜 키 0 · npm·다운로드 0 · puppeteer-core 읽기만 · 큰 원서로 검색 화면 0(검색은 `small.pdf`) · 결과 JSON 에 원서 문장 없음 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `pipeline.js`·`provider.js`·review.md·`dev/`·`main.js`·`router.js` 무변.
- 대조 실행: `run-g` G1b 차이(POST 1 → 0)를 가르려고 앱 파일을 `bak-pre`(고치기 전)로 **잠시** 되돌려 `g0-pre`(Review 와 0곳 다름)를 잰 뒤 `bak-post1` 로 되돌렸다(읽어서 쓰기). 원인은 처음 판 고침 5(손가락 [×] 도 굴림) — 하네스가 다음 줄 좌표를 잰 뒤 [×] 로 닫자 화면이 앞 줄로 굴러 같은 문단을 다시 탭했다 → 고침 5 를 키보드 닫기로 좁힘(1절).
- 하네스 손질: `b8c1c/common.mjs` 의 `closeBand` 를 `b.click()`(detail 0 = 키보드 누름) 대신 `MouseEvent('click', {detail:1})`(손가락·마우스 누름)로 — 시험 사이 "띠 치우기"가 화면을 굴리지 않게. 
- 무효·고친 실행: `x0-before`(X1 찌꺼기가 뒤 시험을 전부 막음 — 청소 단계 넣어 `x1-before`) · `x10-after`(쪽 입력칸 keydown 을 기다리는 Promise 가 안 풀려 180초 `callFunctionOn` 시간 초과 — 전역 변수로 바꿔 `x11-after`) · `x4/x9-after` 의 X5(쪽 끝이라 굴림이 안 됨 — 방향 고름) · `all` 모드의 작은 PDF 첫 탭이 가끔 안 열림(`x1-before`·`x12-after` — 고치기 전에도 같음, `x13-after`·검색 단독 실행에선 열림 → 하네스 시점 문제로 봄) · `run-r pr1`(9a 와 함께 돌리면 원본 줄 찾기 실패 — Review `r2` 와 같음, `orig` 인자로 `pr3`) · `run-r pr2`(설정 단계 `waitForFunction` 실패 180초 — 새 프로필 `pr3` 로 다시, 정상).
- 가장 긴 실행 약 229초(`x10-after`), 나머지 15–120초.

스크래치 `b8c1c/`: `prep.mjs`·`prep-r.mjs`(옮겨 쓰기) · `common.mjs`·`common-b.mjs`·`run-g/k/e2/r.mjs`·`b-run-body.mjs` · `repro.mjs`·`dbg-g1b.mjs`·`cmplaps.mjs` · `backup/mut/restore.mjs` · `bak-pre/`·`bak-post1/`·`bak/` · 결과 `x0–x3-before`·`x4–x13-after`·`g0-pre`·`g1–g3`·`k1`·`e3s/e4b/e5l`·`m1h/m1bh/m2h/m2bh/m3h`(.json) · 테스트 `full1/full2/full3-after-restore.txt`·`m1/m1b/m2/m2b/m3/m4/m5/m6.txt` · 프로필 `p*`.
