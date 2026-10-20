# Build 보고서: 8g-4a-fix (F1: 숨은 리더가 쪽을 넘긴 뒤 "떠난 쪽 결과"를 누르면 다음 쪽이 열림)

> 지침: `.claude/tasks/medreader-build-8g-4a-fix.md`. 시작 HEAD `2a8da10`(8g-4a `68a6c2e` 뒤)에서 작업했다. **커밋하지 않았다.**
> 스크래치패드: `b8g4af/`. 원본 백업은 `bak-orig/`, 고친 뒤 백업은 `bak/`, headless 스크립트는 `lib.mjs`·`setup.mjs`·`f1.mjs`, 변이 스크립트는 `mut.mjs`·`mut.log`·`mut/`에 있다.

## 1. 고친 방법과 이유

- **원인(Review 진단과 같다):** `showReader`의 숨은 리더 조건 `hiddenTurn && wanted === softFromPage && page !== wanted`는 해시만 본다. 그런데 "뒤로 돌아옴"과 "결과로 이동"은 둘 다 `#/reader/D/61`로 같은 해시다. 라우터는 `hashchange`만 받으므로 둘을 가를 수 없다. 그래서 결과로 이동했을 때도 낭독이 간 62쪽으로 replace했다.
- **고침:** Review가 낸 안을 따랐다. 다만 `hiddenTurn`을 내리는 대신, 어느 길로 들어왔는지(`softEntry`)를 리더 상태에 명시적으로 둔다.
  - `search.beginJump`는 해시를 바꾸기 **직전**(`!same` 갈래, `env.clear()` 뒤이고 `env.go/replace` 앞)에 `env.mark()`를 부른다. 진짜 env인 `JUMP_ENV.mark`는 리더의 `noteSearchJump()`다.
  - `noteSearchJump()`는 리더가 숨어 있을 때만 `state.softEntry = 'jump'`로 바꾼다.
  - `showReader`는 판정을 순수 함수 `softReturnPlan({...})` 하나에 맡긴다. 판정 직후 `softEntry`를 `'back'`으로 되돌린다. `leaveReader`는 검색 화면으로 숨길 때와 정말로 떠날 때 모두 `softEntry`를 `'back'`으로 둔다(지난 이동 표시가 남지 않도록).
- **`hiddenTurn`을 내리는 방법 대신 길을 명시한 이유:** 지침은 판정을 "들어온 경로 종류, 원하는 쪽, 숨은 동안 넘어간 쪽"을 입력으로 받는 순수 함수로 꺼내라고 했다. 길이 입력에 있으면 표 테스트에 "뒤로 돌아오면 follow, 이동하면 원하는 쪽"이 그대로 드러난다. 결과는 같다. 이동이면 follow하지 않는다.
- **"뒤로 돌아옴"은 바꾸지 않았다.** `entry`가 `'back'`(기본값)이면 조건이 예전과 똑같다. follow로 replace한 뒤 다시 불릴 때도 예전처럼 reshow다. headless로 확인했다(§4).
- [읽던 곳으로](`backToSpot`)도 `beginJump(JUMP_ENV, …)`를 거치므로 이동(jump)으로 취급한다. 명시적으로 가는 이동이라 원하는 쪽이 맞다.

## 2. 꺼낸 순수 함수

`js/ui/reader.js`:

```js
export function softReturnPlan(o)   // → 'follow' | 'reshow' | 'render'
//  o = {soft, sameDoc, entry:'back'|'jump', wanted, fromPage, page, hiddenTurn, hasDom, stalePaint}
//  !soft || !sameDoc → 'render'
//  entry !== 'jump' && hiddenTurn && wanted === fromPage && page !== wanted → 'follow'
//  page === wanted && hasDom && !stalePaint → 'reshow'
//  그 밖 → 'render'
export function noteSearchJump()    // 숨어 있으면 softEntry = 'jump'
```

`js/ui/search.js`에서 바꾼 것은 신호 하나뿐이다(최소 변경). import에 `noteSearchJump`를 넣고, `JUMP_ENV`에 `mark: () => noteSearchJump()`를 넣고, `beginJump`에 `env.mark();` 한 줄을 넣고, 주석의 env 목록을 고쳤다.

## 3. 테스트

- **새 파일 `tests/search-jump-8g4afix.test.mjs`(22개):**
  - **FX1** `softReturnPlan` 표 17줄과 빈 입력·순수성. 표에는 F1, 뒤로 돌아옴의 follow, X8, follow 뒤 reshow, 같은 해시로 replace를 되풀이하지 않는 경우, 다른 책, DOM 없음, 원본 보기 stalePaint 등이 들어 있다.
  - **FX2** `beginJump`
    - 숨은 리더는 같은 쪽이라도 "같은 쪽"으로 치지 않는다(X9). 이때 mark를 하고 go한다. 띠에서 눌렀어도 go다.
    - F1 순서: mark가 go보다 앞이다.
    - 보이는 같은 쪽이면 mark가 없다.
  - **FX3** 배선(소스 고정)
    - `showReader`가 `softReturnPlan`에 넘기는 입력 칸 9개
    - follow면 `replace(readerHash(docId, state.page))`, reshow면 `reshowReader`
    - 옛 `state.hiddenTurn &&` 조건이 남아 있지 않음
    - `noteSearchJump` 본문, `leaveReader` 두 갈래의 `softEntry='back'`, `JUMP_ENV.mark = noteSearchJump`
    - `beginJump(JUMP_ENV, …)` 호출이 2곳
    - **X1** `onReaderPage`의 pending 조건 `pend.pageNo === scr.page`
- **보강 `tests/search-ui-8g.test.mjs` U9:** 스텁 env에 `mark`를 넣었다. 기대 순서를 `pause → clear → mark → go/replace`로 바꿨다.
- **전체 테스트:** `node --test apps/medreader/tests/*.test.mjs`를 **3회 돌렸고 모두 1206/1206**이다(1184 + 새 22). 2회는 고친 직후, 1회는 변이 복원 뒤다.
- **stamp:** 다시 찍었다(`index.html`의 표 2줄, reader.js와 search.js 해시). `--check` 종료 코드 0이다.

## 4. headless 확인(Edge, 새 프로필 `b8g4af/pf` 1개)

- 8000번 서버(PID 15088)는 이미 떠 있어서 그대로 썼다.
- `pf` 프로필에는 CURRENT 2026 하나만 가져왔다. 추출은 54초 만에 1967/1967을 끝냈다.
- 음성과 번역은 Review lib의 흉내를 복사해 썼다. 진짜 키와 진짜 요청은 없다.

| 단계 | 고치기 전 | 고친 뒤 |
|---|---|---|
| **f1**: 61쪽 끝 무렵 낭독 → [🔍] → 숨은 리더가 62쪽으로 넘어감 → 61쪽 결과 클릭 | 해시 62, 쪽 62, hit 0, cur 0, 띠만 보임(재현됨) | **해시 61, 쪽 61, hit 1, cur 1**("Progressive"), 띠 3/394, 멈춤, 가운데에서 -10.7%(±20% 안). 뒤로 한 번 누르면 결과 목록. 판정 OK |
| **back**: 같은 절차 뒤 `history.back()` | 해시 62로 따라감, 낭독 계속 | **그대로다.** 해시 62, 쪽 62, speaking, 62쪽 문장이 이어서 나옴(4개), 같은 문장 연달아 0. 판정 OK |
| **turn**(8i-3 회귀, 리플로우): 30쪽부터 36쪽까지 낭독 | 해당 없음 | 발화 168개, 30–36쪽, **같은 문장 연달아 0**. 판정 OK |

- 캡처: `b8g4af/shots/f1-before.png`, `f1-after.png`, `back-after.png`
- 결과 파일: `f1-*.json`
- 콘솔 오류는 404 하나뿐이다. 고치기 전에도 있었고 Review 실행에도 있던 것이다.
- 로컬 밖 요청은 pdf.js CDN 2개뿐이다(웹앱 CDN 허용 범위).

## 5. 변이(`b8g4af/mut.mjs`)

변이마다 정확히 1곳이 일치하는지 확인하고, 바꾸고, 전체 테스트를 돌리고, `b8g4af/bak`에서 복원한 뒤 바이트를 비교했다. 아래 "빨강"은 IM(해시 표) 테스트를 뺀 것이다.

| id | 변이 | 결과 |
|---|---|---|
| R1 | 고침 되돌림(리더): `entry !== 'jump'` 제거, 즉 옛 조건 | 빨강 1 (FX1 F1 줄) |
| R2 | 고침 되돌림(검색): `env.mark()` 제거 | 빨강 4 (FX2 ×2, FX3, U9) |
| R3 | `JUMP_ENV.mark`가 아무것도 안 함 | 빨강 1 (FX3 검색 배선) |
| R4 | `noteSearchJump` 본문 제거 | 빨강 1 (FX3) |
| R5 | `showReader`가 `entry: 'back'` 고정 | 빨강 1 (FX3 showReader) |
| R6 | 숨길 때 `softEntry='back'` 제거 | 빨강 1 (FX3) |
| R7 | follow에서 `page !== wanted` 제거 | 빨강 1 (FX1) |
| R8 | follow에서 `hiddenTurn` 제거 | 빨강 1 (FX1) |
| R9 | follow가 원하는 쪽으로 replace | 빨강 1 (FX3) |
| **X1** | Review X1과 같은 글자: pending 쪽 번호 확인 제거 | **빨강 1** (FX3 검색 배선) |
| **X8** | Review X8의 새 자리: follow 조건에서 `wanted === fromPage` 제거 | **빨강 1** (FX1 X8 줄) |
| **X9** | Review X9와 같은 글자: same 판정에서 `visible` 제거 | **빨강 1** (FX2 X9) |

- 12개 모두 빨강이고 모두 복원됐다(`restored true`).
- 마지막에 bak과 파일 5개를 `cmp`해서 같음을 확인했다. `--check` 0, 전체 1206/1206이다.
- Review X8의 원래 글자(`if (state.hiddenTurn && wanted === state.softFromPage …`)는 이번 정리로 코드에서 없어졌다. 같은 뜻의 변이를 순수 함수 쪽에 다시 정의했다.
- 첫 변이 실행에서 두 가지 문제가 있었다.
  - 집계 정규식이 TAP 형식 `not ok`를 찾았는데 실제 출력은 spec 형식(`✖`)이었다. 그래서 빨강을 0으로 잘못 셌다. R1.tap에는 실제로 FX1이 빨강으로 찍혀 있었다.
  - R2를 복원할 때 Windows `copyFile`이 UNKNOWN으로 실패해 search.js에 변이가 남았다. Edit 도구로 한 줄을 되돌리고 bak과 `cmp`해서 같음을 확인했다. 그 뒤 스크립트의 복원을 "읽어서 쓰기 + 재시도 5회 + 실패하면 종료"로 바꾸고 집계를 `✖` 기준으로 고쳐 12개를 다시 돌렸다(위 표).
  - Review의 `r8g4a/mut.mjs` 집계도 같은 정규식을 쓴다. 다만 Review 기록의 통과 수(1181/1184, 실패 3 = IM 3)로 보면 살아남은 판정 자체는 맞았다.

## 6. 바꾼 파일

- `apps/medreader/js/ui/reader.js`: `softEntry` 상태, `softReturnPlan`, `noteSearchJump`, `showReader`의 판정, `leaveReader`의 되돌림
- `apps/medreader/js/ui/search.js`: import, `beginJump`의 `env.mark()`, `JUMP_ENV.mark`, 주석
- `apps/medreader/tests/search-jump-8g4afix.test.mjs`(새 파일), `apps/medreader/tests/search-ui-8g.test.mjs`(U9)
- `apps/medreader/index.html`: stamp만
- spec, review, 그 밖의 파일은 건드리지 않았다.

## 7. 남은 프로세스

- 내가 띄운 Edge와 node는 모두 닫혔다. 남은 것은 다음과 같다.
  - 8000번 python(PID 15088): 지침대로 켜 둠
  - 8123번 node(19520), 8124번 node(9980): 건드리지 않음
  - 8125번 http-server, Adobe와 codex의 node: 내 것이 아님
  - 명령줄이 보이지 않는 msedge 하나(46716, 180K): 내 프로필이 아님
- 프로필 `b8g4af/pf`(53 MB)는 스크래치패드에 남아 있다.

## 8. 남은 문제(4b 몫 또는 기록)

- **X1은 소스 고정으로만 묶였다.** `onReaderPage`가 모듈 상태와 DOM을 쓰기 때문이다. 행동 테스트로 묶으려면 pending 판정을 순수 술어로 꺼내야 하는데, search.js는 "이동 전 신호, 최소"로 범위가 정해져 있어 하지 않았다. 4b에서 검토하길 권한다.
- 검색 화면의 앱 안 [뒤로](`goBack`)가 쓰는 대체 경로 `go(readerHash(spot 쪽))`(직전 화면이 reader나 library가 아닐 때)는 mark를 하지 않으므로 "뒤로 돌아옴"으로 취급된다. 의미상 맞다고 보고 바꾸지 않았다.
- 콘솔 404 하나는 이번 수정 전부터 있었다.
- F2, F3, ① ③ 등 4b 몫은 건드리지 않았다.
