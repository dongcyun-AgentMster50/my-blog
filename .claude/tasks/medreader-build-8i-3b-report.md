# Build 보고 — 8i-3b 쪽 넘김 판정식을 순수 함수로 꺼냄 (2026-10-16)

> 지침: `.claude/tasks/medreader-build-8i-3b.md`. 커밋하지 않았다. 앱 동작은 바꾸지 않았다(리팩터 + 테스트 보강).
> 작업 폴더: 스크래치패드 `b8i3b/`(백업 `bak/` = 시작 전 `reader.js`·`config.js`·`pageturn-8i3.test.mjs`·`index.html`,
> 변이 기준본 `cur/reader.js`, 변이 스크립트 `scripts/mut.py`·`scripts/run-mut.sh`, 변이 출력 `mut/X*.txt`, 로그 `base.log`·`full-1.log`·`full-2.log`).

## 1. 꺼낸 함수 (`apps/medreader/js/ui/reader.js`, 모두 export · 순수)

| 함수 | 쓰는 곳 | 뜻 |
|---|---|---|
| `speechPageReady(st, target, fresh)` | `goToPageForSpeech` 바로 풀기 · `pageTurnCheck` 안 | `st.page === target && !!st.desc && !!fresh` |
| `pageTurnCheck(st, fresh, r, docId, target)` | `goToPageForSpeech` 의 `renderDone.wait` check | 다른 문서·다른 쪽 렌더 끝 → `undefined`, `speechPageReady` 면 `true`, 아니면 `undefined` |
| `freshWaitCheck(st, fresh, docId, page)` | `whenCurrentPageReady` 의 `renderDone.wait` check | 문서·쪽을 떠났으면 `false`, `fresh` 면 `true`, 아니면 `undefined` |

`fresh` 는 부르는 쪽이 `pageFresh(state)` 로 재서 넘긴다. 함수 안에서 `pageFresh` 를 부르지 않은 까닭: `tests/refresh-8i1.test.mjs` RF23(수정 범위 밖)이
`goToPageForSpeech`·`whenCurrentPageReady` 소스에 `pageFresh(state)` 가 **각 2번** 있는지 센다("준비 판정 세 곳은 pageFresh"). 이 모양이면 RF23 을 건드리지 않고
초록이고, RF23 은 호출 자리에서 `pageFresh(state)` 를 빼는 변이(X8)를 계속 잡는다.

### 판정 결과가 같다는 근거 (`git diff js/ui/reader.js`)
- **바로 풀기**: 전 `if (state.page === target && state.desc && pageFresh(state))` → 후 `if (speechPageReady(state, target, pageFresh(state)))`.
  같은 세 항의 논리곱이고 `if` 조건이라 참·거짓만 본다(`!!` 로 불리언이 된 것 외 차이 없음). `pageFresh` 는 순수라 먼저 재도(단락 평가가 사라져도) 부수 효과가 없다.
- **쪽 넘김 렌더 끝 판정**: 전 `(r) => { if (r.docId !== docId || r.page !== target) return undefined; if (<위 식>) return true; return undefined; }`
  → 후 `(r) => pageTurnCheck(state, pageFresh(state), r, docId, target)` — 같은 순서·같은 반환값(`true`/`undefined`). `docId` 는 전처럼 `go()` 앞에서 잡은 값.
  `r` 이 null 이면 전에도 후에도 `r.docId` 에서 던져 `createRenderDone` 이 `false` 로 푼다(실제로 `settled` 는 늘 객체로 불린다).
- **새 판 대기 판정**: 전 `() => { if (state.docId !== docId || state.page !== page) return false; if (pageFresh(state)) return true; return undefined; }`
  → 후 `() => freshWaitCheck(state, pageFresh(state), docId, page)` — 같은 순서·같은 반환값(`false`/`true`/`undefined`).
- 앞 단계 바로 풀기(`whenCurrentPageReady` 첫 줄 `if (pageFresh(state))`)·상한(`TTS.PAGE_WAIT_MS`·`ms`)·`go(readerHash(...))` 순서는 그대로.

## 2. 테스트 (`apps/medreader/tests/pageturn-8i3.test.mjs`)

**배선만 바꾼 것(기대값 그대로)**
- 흉내 `harness` 의 `goToPage`·legacy 폴링·`whenReady` 가 복사한 판정식 대신 `speechPageReady`·`pageTurnCheck`·`freshWaitCheck` 를 **import** 해 쓴다 → PT2–PT8b 가 실제 판정식을 돌린다.
  (흉내 전체를 실제 `goToPageForSpeech` 로 대체하지는 않았다 — 라우터·db·state 모듈 전역에 묶여 있어 "판정식 꺼내기만" 범위를 넘는다.)
- PT2·PT4 의 `TTS.PAGE_POLL_MS` → 파일 지역 상수 `LEGACY_POLL_MS = 200`(값 같음).
- PT9: 옛 문자열 검사 2개(`/r\.page !== target/` in go, `/state\.docId !== docId \|\| state\.page !== page\) return false/` in wr)는 판정식이 함수로 옮겨 가
  **새 호출 모양**(`if (speechPageReady(state, target, pageFresh(state))) …`, `renderDone.wait((r) => pageTurnCheck(state, pageFresh(state), r, docId, target), TTS.PAGE_WAIT_MS);`,
  `return renderDone.wait(() => freshWaitCheck(state, pageFresh(state), docId, page), ms);`)과 **함수 본문**(`pageTurnCheck` 의 `r.docId !== docId || r.page !== target`,
  `freshWaitCheck` 의 `st.docId !== docId || st.page !== page) return false`) 검사로 옮겼다. "폴링 안 함" 검사는 그대로 두고 `setTimeout` 도 금지 목록에 더했다
  (`!/setInterval|setTimeout|PAGE_POLL_MS/` — config 에서 지워도 누가 폴링을 다시 넣으면 잡힌다).

**새 테스트 5개**
- PT12 ★ 쪽 넘김 판정식 표 — 정상 → 풀림 / 자리표시자(desc 없음)·다른 문서·다른 쪽 렌더 끝·리더가 다른 쪽·옛 판(stale)·다시 그리는 중(refreshing)·떠난 알림 → 안 풀림. 바로 풀기(`speechPageReady`)도 같은 표로.
- PT12b 새 판 대기 판정식 표 — 다른 문서·다른 쪽 → false, 최신 → true, stale/refreshing → 계속 기다림, 자리표시자는 막지 않음(전과 같음).
- PT13 ★ 다음 쪽이 자리표시자면 그 렌더 끝에 풀리지 않고 상한(PAGE_WAIT_MS)까지 `waiting-page` → 상한 뒤 paused + `TTS_PAGE_TIMEOUT`, 33쪽으로 건너뛰지 않음.
- PT13b 자리표시자 렌더 끝에는 안 풀림 → 추출 뒤 그 쪽 렌더(그리기·notifyPage) 끝에 풀려 첫 문장 1번, 끊김 0.
- PT14 `TTS.PAGE_POLL_MS` 는 앱 설정에 없다(undefined), 대조 상수는 200.

## 3. `PAGE_POLL_MS` 정리
- grep: 앱(`js/`·`index.html`·`dev/`)에서 쓰는 곳은 `js/config.js` 정의 한 줄뿐(나머지는 `review.md` 기록과 이 테스트 파일). → `config.js` 에서 한 줄 삭제.
- 테스트 쓰임 5곳은 `LEGACY_POLL_MS` 로. PT9 의 "폴링 안 함" 검사는 유지(위).

## 4. import map
`node apps/medreader/dev/stamp-importmap.mjs` → "index.html 을 다시 썼다 (모듈 53개 · CSS 4개)". `--check` → "그대로다", 종료 0. `index.html` 은 stamp 구간만 바뀜(2줄: `config.js`·`reader.js` 해시).

## 5. 검증

### 전체 테스트 (`timeout 500 node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs`)
- 변경 전 기준: 1043/1043.
- 변경 후 2회: **1048/1048 × 2**(1043 + 새 5개), fail 0, cancelled 0.

### 변이 (`b8i3b/scripts/run-mut.sh` — 정확히 1회 일치 → `MUT-Xn` 표식 1건 → 전체 테스트(`timeout 300`, `--test-timeout=20000`) → `cur/reader.js` 로 복원 → `cmp` 같음, 7개 모두)
해시 테스트 IM2·IM6·IM7b 는 `reader.js` 가 바뀌면 매번 빨강이라 표에서 뺐다.

| # | 변이 | 빨개진 테스트(IM 제외) | 결과 |
|---|---|---|---|
| X2 (Review 재변이) | `pageTurnCheck` 의 렌더 끝 판정에서 `desc` 뺌(`st.page === target && fresh`) | PT12 · PT13 · PT13b | **잡힘** (전엔 살아남음) |
| X2b | `speechPageReady` 에서 `!!st.desc` 뺌(바로 풀기까지) | PT12 · PT13 · PT13b | 잡힘 |
| X4 (Review 재변이) | `pageTurnCheck` 에서 `r.docId !== docId` 뺌 | PT12 · PT9 | **잡힘** (전엔 살아남음) |
| X5 (새) | `freshWaitCheck` 에서 `st.docId !== docId` 뺌 | PT12b · PT9 | 잡힘 |
| X6 (새) | `speechPageReady` 에서 `!!fresh` 뺌 | PT12 · PT8 | 잡힘 |
| X7 (새) | `pageTurnCheck` 끝 `return undefined` → `return false` | PT12 · PT13 · PT13b · PT8 | 잡힘 |
| X8 (새) | `goToPageForSpeech` 호출 자리 `pageFresh(state)` → `true` | PT9 · RF23 | 잡힘(소스 검사) |

X4 는 흉내(동작)로는 잡지 않고 표(PT12)·소스(PT9)로 잡는다 — Review 판단대로 앱 영향이 작아(문서를 바꾸면 speaker 는 이미 멈춤) 흉내 시나리오는 더하지 않았다.

## 6. 프로세스
띄운 프로세스 없음(서버·브라우저 안 씀). 테스트·변이 실행은 모두 종료 코드를 받고 끝났다. 끝에 `tasklist` 의 node.exe 는 PID 25148 하나 — Adobe Creative Cloud 의 것(내 것 아님).
8i-3 Review 가 남긴 PID 47980·50268 은 지금 목록에 없다.

## 7. 수정한 파일
- `apps/medreader/js/ui/reader.js` — 판정식 3개 꺼냄(+30/−8 남짓, 동작 불변)
- `apps/medreader/js/config.js` — `PAGE_POLL_MS: 200,` 한 줄 삭제
- `apps/medreader/tests/pageturn-8i3.test.mjs` — 배선·지역 상수·PT9 소스 검사 갱신·새 테스트 5개
- `apps/medreader/index.html` — stamp 구간 2줄
- 이 보고서

## 8. 남은 문제
- 없음(차단 없음). 참고: 흉내 자체(라우터·렌더 순서)는 여전히 복사본이고 실제 순서는 PT9 소스 검사로만 묶인다 — 판정식은 이제 실제 함수다.
- `review.md` 4128·4175 줄의 `PAGE_POLL_MS` 언급은 기록이라 건드리지 않았다(수정 범위 밖).
