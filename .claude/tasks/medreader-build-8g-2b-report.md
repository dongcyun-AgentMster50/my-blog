# 8g-2b Build 보고 — 검색 엔진 보강 (백필 실패 처리 · 8g2R-3 ③④ · 테스트 공백 · spec 문안)

> 2026-10-19. 지침 `medreader-build-8g-2b.md`. 시작 HEAD `c35ebbf`(1117/1117). **커밋하지 않았다.**
> 스크래치 `b8g2b/`만 썼다(수정 전 원본 `orig/` + `orig-sha.txt`, 변이 백업 `bak/`).
> 화면 변화 없음. `js/ui/library.js`·`js/text/*`·`js/pdf/*`·`js/db.js` 는 **고치지 않았다**(필요 없었다).

## 0. 한눈에

| 항목 | 결과 |
|---|---|
| 바뀐 파일 | `js/search/engine.js`(454 → 490줄), `tests/search-db-8g.test.mjs`(+9 테스트), `spec.md`(17-8-5 · 17-8-12 안 8곳), `index.html`(stamp 만) |
| 백필 실패 | **(가)** — 거절하지 않고 있는 쪽 결과 + `error`(db.ERR 코드). 다음 검색은 **다시 시도**(빠진 쪽만) |
| ③ 검색 중 invalidate | `ready()` 끝에 `stale` 이면 다시 채움(세 번까지, 넘으면 `cancelled`) |
| ④ `preparing.done` | 그때까지의 실제 진행(작업 객체의 `out.done`) |
| 새 테스트 | 9개 — 1117 → **1126** |
| 변이 | 새 7개(N1–N7) **모두 빨강** · Review M1·M6·M7·M9·M13·M20 **빨강** · M16·M17 살아남음(같은 동작 — 4절) |
| 탐침 P1·P2·P3·P8 | 기대대로 바뀜(5절) |
| CMDT 2026 `--app` | 차이 0 · 시간 칸을 뺀 앱 결과 JSON 이 Build 8g-2 판과 **항목 전부 같다** |
| 전체 테스트 | **1126/1126 × 2회**(+ 변이 전 1회), `stamp --check` 0 |

## 1. engine.js 수정

### 1-1. 백필 실패 — 운영자 결정 (가)
- `backfill()` 작업 본문을 `try/catch` 로 감쌌다. DB 오류가 나면 **거절하지 않고** `out.error = dbErrorCode(e)` 를 붙여 돌려준다. 실패한 묶음 트랜잭션은 abort 로 되돌려지고 그 앞 묶음은 커밋된 채(캐시에도 이미 들어감) 남는다.
- `dbErrorCode`: `e.code` 가 `db.ERR` 값이면 그대로(`withTx` 가 할당량을 이미 `DbError(ERR_DB_QUOTA)` 로 바꾼다), 아니면 할당량 판정(`db.isQuotaError`) → `ERR_DB_QUOTA`, 그 밖(닫힌 연결의 `InvalidStateError`, 다시 열 때 `VersionError` 를 싼 `DbError(ERR_DB_OPEN)` 등) → `ERR_DB_OPEN`. **새 코드는 만들지 않았다.**
- `ready()` 가 `{c, error}` 를 돌려주고, `searchDoc` 최종 결과·`prepareDoc` 반환·서재 범위의 안 연 책(`streamDoc`) 결과에 `error` 를 붙인다. 부분 결과(`onPartial`)는 백필 전이라 `error` 가 없다.
- 결과 `error` 는 이제 두 종류다: 검색어 코드(`ERR_SEARCH_*`, 적중 0) · DB 코드(`ERR_DB_*`, 적중이 있을 수 있음). 머리 주석·spec 17-8-5 에 적었다.

**다음 검색 동작 — 다시 시도한다(같은 오류여도 건너뛰지 않음).** 실패하면 `bfDone` 을 세우지 않는다. 이유:
1. 실패 전 묶음은 커밋되므로 다시 시도할 때마다 빠진 쪽만 남는다(테스트: 둘째 검색의 `pages.get` 이 정확히 남은 10쪽). 공간이 조금씩 생기면 그만큼 나아간다.
2. 이 오류들은 **엔진이 알 길 없이 풀린다** — 사용자가 다른 책을 지워 공간이 생기거나(그 책의 `invalidate` 만 온다), 다시 불러온다. "같은 오류면 건너뛰기"는 언제 풀렸는지 알려 줄 신호가 없어 그 탭에서 영영 백필을 못 하게 될 수 있다.
3. 시도 비용이 작다: 키 비교(값 안 읽음) + 실패하는 묶음 하나(≤ 50쪽). 그리고 부분 결과가 백필 **전에** 나가므로 사용자는 기다리지 않고 있는 쪽 결과를 먼저 본다.
4. 닫힌 연결(다른 탭이 버전을 올림)은 `main.js` 배너가 [다시 불러오기]를 이미 띄운다 — 그동안의 검색은 캐시로 찾고 `ERR_DB_OPEN` 을 붙여 빨리 끝난다(계획 단계에서 바로 실패).

### 1-2. ③ 검색 중 `invalidate`·삭제 (8g2R-3 의 3)
- `ready()` 를 세 번까지 도는 고리로: 캐시 채우기 → 백필 → 표시된 쪽 다시 읽기를 마친 뒤 **그 캐시가 `stale` 이면 다시** 채운다. 세 번 안에 못 끝내거나 `alive()` 가 거짓이면 `null` → `searchDoc` 은 `cancelled`, `prepareDoc` 은 `{pagesCovered:0, cancelled:true}`.
- `cancelled` 로 바로 끝내지 않고 다시 채운 이유: 세대가 바뀐 것이 아니므로 화면은 그 결과를 기다린다 — `cancelled` 를 주면 옛 부분 결과만 남는다. 다시 채우면 다시 추출 뒤면 새 글자로, 삭제 뒤면 적중 0 으로 끝난다.

### 1-3. ④ `preparing.done`
- 백필 작업 객체가 진행 `out` 을 들고(`job.out`), 부분 결과를 보낼 때 그 순간의 `out.done` 을 싣는다. 뜻: **그 부분 결과를 보낼 때까지 백필한 쪽 수(이미 `pagesCovered` 에 든다)**. 새로 시작한 검색이면 0(기존 S9 단언 그대로), `prepareDoc` 이 먼저 시작한 백필에 합류하면 그때까지의 값.

## 2. 새 테스트 (`tests/search-db-8g.test.mjs`, S6 앞 — DB 를 쓰는 테스트는 S6 앞이라는 파일 규칙대로)

| 테스트 | 무엇을 | 잡는 변이 |
|---|---|---|
| S9b 할당량 | 80쪽 중 20쪽 있음, 71쪽 이후 `searchText.put` 이 비동기 `QuotaExceededError`(TxStore.prototype 감쌈 — 이 책만). 결과 70적중 + `ERR_DB_QUOTA`, 부분 결과 20(코드 없음), 실패 묶음은 abort, `backfilled:false`. **둘째 검색은 `pages.get` 정확히 10회** + 같은 코드. 서재 범위 — 열린 책 결과에 코드, 서재 `onPartial` 에 `partial` 결과가 없음, 안 연 책(캐시 안 하는 길)도 코드, 다른 책은 코드 없음. 풀면 80적중·코드 없음·`backfilled` | N1·N2·N3·N4·N7·**M13**·M20 |
| S9b 닫힌 연결 | `FakeDbHandle.prototype.transaction` 이 `pages` 를 범위에 둔 트랜잭션에서 `DOMException InvalidStateError` 를 던짐(캐시는 searchText 만 읽으므로 캐시가 있던 화면의 꼴). 10적중 + `ERR_DB_OPEN`, 부분 결과 0(계획부터 실패), `prepareDoc` 도 `{pagesCovered:10, error}`. 풀면 30 | N1·N2·N7 |
| S9c ④ | 400쪽 중 20쪽, `prepareDoc` 의 `onProgress` 가 100쪽을 넘긴 순간 `searchDoc`. 부분 결과 `preparing.done ≥ 100` 이고 `pagesCovered = 20 + done` | N6 |
| S13b ③ | (a) 부분 결과 안에서 `invalidate` 만 → 최종 160적중(다시 채움) (b) 탐침 P1 그대로 `invalidate` + `deleteDocument` → 적중 0, `cancelled` 아님 | N5 |
| S13c **M7** | 610쪽 캐시 채우기 중 둘째 `getAll` 을 부를 때(첫 묶음 200쪽만 듦·`loaded:false` 를 전제로 단언) 5쪽을 추출 경로로 새로 쓰고 `notePage` → 다음 검색이 `newword` 를 5쪽에서 찾음 | **M7** |
| S13d M6 | `notePage` 뒤 `prepareDoc` 과 `searchDoc` 이 겹침 — `delayReadonlyComplete('searchText', 30)` 로 다시 읽기가 끝나기 전에 둘째가 오게 함. 둘째가 새 글자를 찾음 | M6 |
| S11b **M1** | 500+500 본문으로 1,000 이 2쪽 끝에서 정확히 차고 3쪽은 표 적중 하나뿐 → `truncated` | **M1** |
| S12b **M9** | 1쪽 heading "Plon Treatment" + 본문 1,000 → 첫 읽기 묶음 안에서 상한, 같은 heading 9개는 201–209쪽(다음 읽기 묶음). 책 범위 head 0 · 서재 범위 hits 가 책 범위와 같다 | **M9** |
| S12c **M20** | 검색 글자 없는 5쪽 책(8g-1 전 추출 꼴) — 서재 검색이 그 책 5적중을 내고 `searchText` 5개가 생기며 캐시는 안 함 | **M20** |

- 실패 주입 장치가 fake-idb 에 없어 **테스트 안에서 프로토타입을 감싸고 `finally` 로 되돌린다**(fake-idb 무수정).
- 새 테스트 파일 단독 5회 반복 33/33 — 시간 의존 테스트(S9c·S13c·S13d)도 흔들림 없음.

## 3. 변이 (`b8g2b/mut.mjs`, 로그 `mut.log`·`mut-run.out`·`mut-out/`, 백업 `bak/`)

레포 파일 한 곳 → 전체 테스트(`--test-timeout=60000`, 상한 300초) → finally 복원 → 바이트 비교. 15개 모두 **복원 같음**, 끝에 대상 3파일 sha256 OK(`pre-mut-sha.txt`). "빨강"은 import map 해시 테스트 3개(파일을 바꾸면 늘 빨강)를 뺀 것.

| # | 변이 | 빨강 |
|---|---|---|
| N1 | (가) 되돌림 — 백필 실패를 다시 던짐 | S9b 할당량 · S9b 닫힌 연결 |
| N2 | 실패하면 백필 끝으로 쳐 다시 시도 안 함 | S9b 둘 |
| N3 | 서재 안 연 책 결과에 코드 안 붙임 | S9b 할당량 |
| N4 | `DbError` 코드 무시(전부 OPEN) | S9b 할당량 |
| N5 | ③ 되돌림 — `ready` 뒤 `stale` 안 봄 | S13b |
| N6 | ④ 되돌림 — `preparing.done` 늘 0 | S9c |
| N7 | 책 범위 결과에 코드 안 붙임 | S9b 둘 |
| **M1** | 상한 뒤 "더 있나"에서 표 안 봄 | S11b |
| M6 | `refreshDirty` 가 도는 다시 읽기를 안 기다림 | S13d |
| **M7** | 채우는 중 `notePage` 버림 | S13c |
| **M9** | 서재 빈도표를 상한에서 멈춤 | S12b |
| M13 | 서재 범위에 열린 책 부분 결과가 샘 | S9b 할당량 |
| M16 | `ensureLoaded` 가 무효화된 캐시를 돌려줌 | **살아남음** |
| M17 | `invalidate` 가 백필을 안 멈춤 | **살아남음** |
| **M20** | 서재 범위가 안 연 책을 백필 안 함 | S12c · S9b 할당량 |

**M16·M17 판단 — 넣지 않았다(같은 동작):**
- M16: 이번 ③ 수정으로 `ready()` 가 끝에 `stale` 을 보고 다시 채우므로, `ensureLoaded` 가 무효화된 캐시를 돌려줘도 결과는 같고 한 바퀴 더 도는 일만 생긴다. 바깥 고리가 같은 일을 하므로 잡을 행동 차이가 없다.
- M17: Review 판단 그대로 — 멈추지 않은 백필은 지운 쪽을 읽을 것이 없거나, 새로 쓰인 쪽을 추출과 같은 식·같은 트랜잭션 규칙으로 쓴다. 무효화된 캐시에는 넣지 않는다(`!cache.stale` 검사).

## 4. 탐침 다시 (`b8g2b/probe.mjs` = Review `r8g2/probe.mjs` 사본 — P2 의 출력에 `error`·`covered` 만 더함, `probe.out`)

| 탐침 | Review 때 | 지금 |
|---|---|---|
| P1 검색 중 invalidate + 삭제 | `cancelled:false`, **20적중**(지운 책) | `cancelled:false`, **0적중**, `pagesCovered 0` |
| P2 백필 쓰기 할당량 오류 | 첫 검색·둘째 검색 **reject `ERR_DB_QUOTA`** | 첫 검색 **20적중 + `error:"ERR_DB_QUOTA"`**(부분 결과 20) · 둘째 20적중 + 같은 코드 · 풀면 80/80 |
| P3 prepareDoc 중 searchDoc | `preparing {done:0, total:380}`, 덮은 쪽 120 | `preparing {done:**100**, total:380}`, 덮은 쪽 120(= 20 + 100) |
| P8 채우는 중 notePage | `[5]`(지금 코드는 찾음 — 테스트가 없었음) | `[5]` 그대로 — 이제 S13c 가 묶는다(M7 빨강) |

P4·P6·P7 도 Review 와 같은 값(P4 불일치 0, P6 750쪽 씀, P7 부분 결과 ⊂ 최종). P5 는 시간만(취소 뒤 29ms — Review 24ms).

## 5. CMDT 2026 `--app` (S14 유지)

`node --max-old-space-size=8192 apps/medreader/dev/measure-search-8g.mjs "<CMDT 2026>" --pdfjs <5.6.205> --json b8g2b/app-c26.json --app` — 종료 0.
- 백필 1,967/1,967 · 레코드 차이 0 · 키/sk 이상 0 · 26 검색어 `agg` 전부 0 · 서재 4개 0 · 다시 찾기 2,433쪽 불일치 0 · 두 줄 적중 140.
- **Build 8g-2 판(`r8g2/build-app-c26.json`)과 시간 칸을 뺀 `app` 의 backfill·records·cacheFill·queries·refind·library·agg 가 전부 같다.** 검색 결과 불변.
- 시간(참고): 다음 검색 6.5ms, 첫 검색(fake-idb) 181ms.

## 6. spec 반영 — 17-8-5 · 17-8-12 안에서만, 모두 `[정정 2026-10-19 — 8g-2 Review]`

| 문안 | 자리 | 내용 |
|---|---|---|
| ① library 배선 | 17-8-12 §6 표 8g-2 행 | `ui/library.js` 배선(`page`→`notePage`, `reextract`·`reextractDoc`·삭제 뒤 `invalidate`) |
| ① 〃 | §6 표 8g-4 행 | "`reextractDoc` 뒤 `engine.invalidate`" → 8g-2 행으로 옮겼다고 표시 |
| ② API | 17-8-5 새 줄 | 실제 API 전부(`prepareDoc`·`backfill`·`notePage`·`invalidate`·`cancel`·`cacheInfo`, 옵션 `onProgress`·`maxHits`), `headLevel` 안 만듦 |
| ② 결과 필드 | 17-8-5 새 줄 | `error`·`cancelled`·`partial`·`preparing`, **`preparing.done` 의 뜻**, `truncated` 정의 |
| ② 오류 때 | 17-8-5 새 줄 `[… · 운영자 결정 (가)]` | 거절 안 함 + 코드, 두 종류 `error`, 다음 검색 다시 시도와 그 이유, 서재 범위도 |
| ③ 서재 백필 | 17-8-5 새 줄 | 안 연 책도 백필 · 그 비용 · **화면(8g-4)은 책별 `onProgress` 진행을 보여야** |
| ③ 〃 | §6 표 8g-4 행 | 서재 결과의 책별 백필 진행 표시 · DB 오류 코드 안내(8g-4 메모) |
| ③ S15 | §7 S15 | 서재 전체 ≤ 1초는 **백필이 끝난 뒤** |
| ④ S11 | §7 S11 | "1,000 을 **넘으면**(정확히 1,000 은 아님)" |

17-8-2 의 "서재 전체 ≤ 3초"는 지침 범위(17-8-5·17-8-12) 밖이라 고치지 않았다 — 같은 조건("백필이 끝난 뒤")이 필요하면 다음 spec 정리 때.

## 7. 실행·정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초): 변이 전 1회 + 마지막 2회 — **1126/1126**, fail 0, cancelled 0(8.8·8.1·8.9초). 로그 `b8g2b/full-pre.log`·`full-1.log`·`full-2.log`.
- `node apps/medreader/dev/stamp-importmap.mjs` → `--check` "그대로다 (모듈 56개 · CSS 4개)", 종료 0.
- 남은 프로세스: 내가 띄운 node 는 모두 끝났다. 끝 `tasklist` 의 node 43840 은 이전 보고들이 적은 것(Adobe)으로 내 것이 아니다. 브라우저·python 은 쓰지 않았다.
- 권한·훅에 막힌 명령 없음. 커밋·checkout/restore/stash·`rm -rf`·npm·다운로드 하지 않았다. PDF 는 CMDT 2026 한 경로만 읽었다. 출력은 수치뿐(원서 글자 저장·인용 없음).
- 최종 sha256: engine.js `0f4a2278…`, search-db-8g.test.mjs `93f604de…`, spec.md `550313f6…`, index.html `0b6e5bd9…`, library.js `d5ea9678…`(무변).

## 8. 남은 문제·관찰

1. **[낮음] 캐시 채우기(읽기) 자체가 실패하면 여전히 거절하고, 그 실패가 붙는다.** `ensureLoaded` 의 `c.loading` 이 거절된 프라미스로 캐시에 남아 같은 책의 다음 검색도 `invalidate`·다른 책 검색 전까지 계속 거절한다. 이번 결정은 백필 실패만이라 고치지 않았다. 실제로는 연결이 닫힌 뒤 처음 여는 검색 화면에서 생긴다(그때는 `versionchange` 배너가 다시 불러오기를 띄운다). 한 줄 수정 후보: 실패 때 `cache` 를 비워 다음 검색이 다시 시도하게. 8g-4 화면은 `searchDoc` 의 reject 도 잡아야 한다 — 8g-4 Build 지침에 넣기를 권한다.
2. 검색 중 삭제(P1)로 다시 채우면 지운 책의 **빈 캐시(0쪽)**가 남는다. 해는 없다(다른 책을 찾거나 `invalidate` 하면 바뀐다). `pageCount` 는 처음 읽은 값(160)이 남는다.
3. 검색 중 `invalidate` 가 오면 그 전에 나간 부분 결과는 옛 데이터라 최종의 부분집합이 아닐 수 있다(최종이 대신한다 — 세대가 같아 화면은 최종으로 바꾼다).
4. 할당량·닫힌 연결은 **흉내로만** 확인했다(fake-idb 프로토타입 감싸기). 실제 Chrome 에서 저장소 가득 참·두 탭 버전 올림 때의 코드·시간은 8g-4 Review(S6·S15) 몫.
5. 17-8-2 "서재 전체 ≤ 3초"(6절 끝).

## 9. 파일

- 앱(커밋 안 함): `js/search/engine.js`, `tests/search-db-8g.test.mjs`, `spec.md`, `index.html`(stamp)
- 스크래치 `b8g2b/`: `orig/`·`orig-sha.txt`(수정 전), `mut.mjs`·`mut.log`·`mut-run.out`·`mut-out/`·`bak/`·`pre-mut-sha.txt`, `probe.mjs`·`probe.out`, `app-c26.{json,out,err}`, `full-pre.log`·`full-1.log`·`full-2.log`
