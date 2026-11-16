# Build 보고 — 8c-2b: 8c-2 Review 지적 고치기 (2026-11-16)

> Build 서브에이전트 · 지침 `.claude/tasks/medreader-build-8c2b-fix.md` · 근거 `apps/medreader/review.md` "8c-2 Review"(8c2R-1~10) · 대상: 작업 트리(HEAD `da0b3f4` 위 8c-2 Build, 커밋 전) · **커밋하지 않음** · 스크래치 `b8c2b/`(Review `r8c2/` 는 읽기만 — `rdiff.mjs` 를 그대로 실행, `r8c2/head` 를 HEAD 판으로 읽음).

## 고친 것

| # | Review | 고침 | 시험 |
|---|---|---|---|
| 1 | 중간-1 자정 경계 | `pipeline.js` `checkWarn`: `const t = now(); const day = localDay(t);` 로 시계를 한 번 읽고 표시는 `bumpUsage({capWarned:true}, {db, now: t})` | **W10** — `checkWarn` 이 그날 행을 읽은 직후 시계를 D+1 00:00:00.010 으로 → 경고 D 한 번·`capWarned` 는 D 행·D+1 행 없음 → D+1 09:00 에 7번째까지 0, 8번째 뒤 한 번(`day` D+1) |
| 2 | 낮음-3 비동기 구독자 | `onWarn` 구독자 호출을 `try { Promise.resolve(fn(ev)).catch(() => {}); } catch (e) {}` — 동기 예외·비동기 거절 둘 다 삼키고 기다리지 않음 | **W11** — `async` 구독자가 던짐 + 둘째 구독자: 번역 9번 모두 ready, 둘째가 `used 8` 한 번, `unhandledRejection` 0 |
| 3 | 낮음-5 90일 시험 틈(RM2) | `ui/usage.js` 에 export `pruneUsage(rows, today, del)`(`staleDays(…, KEEP_DAYS)` + 지우기 + 남는 행) — `load()` 는 이것만 부른다(동작 같음: 지우기 실패는 화면에서만 빼고 셈에 안 넣음) | **U7** — 91·90·89·30·0일 전 + `not-a-day` → 91일 전만 지움, 지우기 실패 행 처리, `null` 입력 |
| 4 | 낮음-4 ① 상한 1–4 경고 | **고치지 않음(보고만)** — 아래 | — |

### 재현 전 / 후 (Review `rdiff.mjs short`, HEAD = `r8c2/head`)

| 시나리오 | 고치기 전(`b8c2b/rdiff-before2.txt`) | 고친 뒤(`rdiff-after.txt`) |
|---|---|---|
| 경고 행을 읽은 직후 자정 | 경고 D 한 번 · `capWarned` 행 **2026-11-17(calls 9)만** · D+1 경고 0 | 경고 D 한 번 + **D+1 한 번** · `capWarned` 행 2026-11-16(calls 8)·2026-11-17(calls 9) |
| 비동기 구독자 거절 | `unhandled ["async boom"]` | `unhandled []` |
| 나머지 9 시나리오 | — | 경고·`capWarned` 행·usage IO 횟수까지 고치기 전과 한 글자도 같음(`diff` 로 확인 — 바뀐 줄은 위 둘뿐) |
| 요청 본문·URL·헤더·사용량 행(`capWarned` 제외)·이벤트·결과·타이머·base | — | 10 시나리오 모두 HEAD 와 같음(무구독·구독 둘 다 diff `[]`) · **allSame true** |
| 상한 경계 전수 | 504 차이 0 | 504 차이 0 |
| `warnThreshold` 손 계산 20 | 오류 0 | 오류 0 |

- 자정 시나리오의 usage IO(구독) 55 → 64 는 D+1 경고 확인·표시가 이제 일어나서 생긴 읽기·쓰기다(무구독 51/51 은 HEAD 와 같음).
- 시간대 `Asia/Damascus` 로 고친 뒤 다시: allSame true · 504 차이 0 · unhandled 0 · 자정 시나리오 같은 결과(`rdiff-after-damascus.txt`).
- **흔들림 한 번(이번 고침과 무관)**: 고치기 **전** 첫 실행(`rdiff-before.txt`)에서 `concurrent-three-seed7` 이 **무구독**인데도 HEAD 와 본문·결과 순서가 달랐다(셋 동시 + 흉내 fetch 의 setImmediate 틱 — 동시 요청 셋의 완료 순서가 실행마다 갈림). 같은 판 둘째 실행은 같음, 고친 뒤 2번(기본·다마스쿠스)도 같음. 하네스의 동시성 순서 흔들림으로 보이며 앱 동작 판정은 아니다.

### 4 — 상한 작을 때 80% 경고(고치지 않은 까닭)
설계 4-7 의 `[정정 2026-11-16 — 8c-2 Build]` ② 가 "상한 3 이면 **3번째 호출 뒤**(capped 와 같은 때, 8절 `[D]` 그대로)"로 정했고, 8절 수용 기준 "8c-2" `[D]` 가 "상한 3으로 두고 낭독 → 3번째 호출 뒤 `capped` … **80% 경고 1회**(16-D4)"를 요구한다(기존 시험 W5 도 이것을 지킨다). 문턱 = 상한이면 경고를 빼는 것은 이 수용 기준과 어긋나므로 **설계 뜻과 맞지 않음** → 동작은 그대로, 문구("80%를 썼습니다(3/3회)") 다듬기만 crossstep 후보에 적었다.

## 검증

- **전체 시험 2회**: `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` → **1회차 1653/1653(9.86초) · 2회차 1653/1653(9.89초)**(`b8c2b/full1.txt`·`full2.txt`). 8c-2 의 1650 + 새 3(U7·W10·W11).
- `node apps/medreader/dev/stamp-importmap.mjs` 다시 찍음(모듈 73 · CSS 4) → `--check` "그대로다" · `git diff --check` 0 · 추적 안 된 `js/ui/usage.js`·`tests/usage-8c.test.mjs` 줄 끝 공백 0.
- headless 하지 않음(지침 — 파이프라인 경고 경로·순수 함수만).

### 변이 (`b8c2b/mut.mjs` — 처음 한 번 `b8c2b/bak/mut/` 에 백업 → 찾을 글이 정확히 1곳일 때만 바꿈 → 전체 시험 → 백업을 **읽어서 써서** 복원 → 바이트 비교 + `cmp`)

| # | 변이 | 결과(IM2·IM6·IM7b 해시 시험 3개는 어떤 변이에도 빨강이라 셈에서 뺌) |
|---|---|---|
| BM1 | 고침 1 되돌림 — 표시 쓰기 `now: t` → `now: now()` | **빨강** W10 |
| BM2 | 고침 2 되돌림 — `Promise.resolve(fn(ev)).catch(…)` → `fn(ev)` | **빨강** W11 |
| BM3 | Review RM2 — `pruneUsage` 의 `KEEP_DAYS` → `30` | **빨강** U7 |

3/3 빨강. 복원 뒤 바이트 같음(스크립트) + `cmp pipeline.js`·`cmp usage.js` 차이 0.

## 바꾼 파일
- `apps/medreader/js/ai/pipeline.js` — `checkWarn` 만(시계 한 번 + 구독자 호출 + 주석 2줄).
- `apps/medreader/js/ui/usage.js` — `pruneUsage` export 추가, `load()` 가 그것을 부르게(지우기 루프를 옮김).
- `apps/medreader/tests/usage-8c.test.mjs` — U7·W10·W11 + import 에 `pruneUsage`.
- `apps/medreader/index.html` — stamp(import map 구간만).
- `apps/medreader/spec.md` — 17-7-6 4-7 의 `[정정 2026-11-16 — 8c-2 Build]` 줄 바로 뒤에 `[정정 2026-11-16 — 8c-2b]` 한 줄(Edit, 그 자리만).
- `.claude/tasks/medreader-crossstep-notes.md` — "다음 다듬기 묶음 후보"에 8c-2 줄 하나 덧붙임.
- 고치기 전 판 백업: `b8c2b/bak/`(pipeline.js·usage.js·usage-8c.test.mjs·index.html·spec.md·crossstep-notes.md).

## 고치지 않은 것 (다듬기 후보 — crossstep 에 적음)
- 낮음-2 두 탭이 같은 읽기 창 안에서 함께 문턱을 넘으면 탭마다 한 번(탭 사이 잠금 없음).
- 낮음-4 ① 상한 1–4 의 경고 문구(동작은 spec 대로 유지 — 위) · ② 2단추 경고 배너 360 ar 글 폭 101px·5줄.
- 낮음-7 ar 수 꼴(복수형).
- (새로 본 것) `onState` 구독자 호출(`notify`)도 같은 `try { fn(ev) }` 꼴이라 비동기 거절은 못 잡는다 — 지금 구독자(`readalong.js`)는 동기라 영향 0. 지침 범위("구독자 호출" = Review #3 의 `onWarn`)만 고쳤다.
- 낮음-6(9c `capWarned` OR 합치기)은 이미 crossstep 9c 줄에 있음.

## 실행 · 정리
명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0). **막힌 명령 0** — 다만 첫 `sed … -o /dev/null` 시도가 잘못된 옵션으로 실패(내 실수, 아무 파일도 쓰지 않음; 그 뒤 rdiff 는 복사 없이 Review 것을 그대로 실행). 프로세스 조회·디버깅 포트 0 · 서버 건드림 0 · headless 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관.

스크래치 `b8c2b/`: `rdiff-before.txt`(흔들림 회)·`rdiff-before2.txt`·`rdiff-after.txt`·`rdiff-after-damascus.txt` · `mut.mjs` · `bak/`(고치기 전)·`bak/mut/`(변이용) · `full1.txt`·`full2.txt`.
