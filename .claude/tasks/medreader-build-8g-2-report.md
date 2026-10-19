# 8g-2 Build 보고 — 검색 엔진 (`js/search/engine.js`)

> 2026-10-19. 지침 `medreader-build-8g-2.md`. spec 17-8-12(승인 G1–G5). **커밋하지 않았다.**
> 시작 상태: HEAD `21ede92`, 전체 1103/1103. 스크래치 `b8g2/`만 썼다(원본 백업 `b8g2/orig/` + `orig-sha.txt`).
> 화면 변화 없음. 엔진을 앱에 잇는 배선만 넣었다(사용자에게 보이는 것 0).

## 0. 한눈에

| 항목 | 결과 |
|---|---|
| 새 모듈 | `js/search/engine.js` 454줄(서비스 계층, `config`·`db`·`text/*` 만 import) |
| 배선 | `js/ui/library.js` +7줄(import 1 · 추출기 `page`→`notePage` 1 · `reextract`→`invalidate` 1 · 다시 추출 뒤 1 · 삭제 뒤 1 · 주석) |
| 수용 기준 | S8–S13 `[N]` 녹색, S14 `[D]` 세 권 차이 **0**, S15 는 Node 측정으로 대신(브라우저 실측은 8g-4 Review 몫) |
| 8g-1 Review 보강 3건 | ① ENABLED=false 행동 테스트 ② 3자·약어 5자 경계값 ③ S6 2초 상한 — 셋 다 넣었고 변이로 빨강 확인 |
| 세 권 비교(S14) | 적중·쪽·묶음·순서·서재 범위 차이 **0** · 결과 쪽 다시 찾기 **7,015쪽 불일치 0**(Plan 과 같은 쪽 수) |
| 변이 | 19개 **모두 빨강**(복원 뒤 `cmp`·sha256 같음) |
| 전체 테스트 | **1117/1117 × 2회**(1103 + 새 14), `stamp --check` 0(모듈 56·CSS 4) |
| 남은 프로세스 | 내가 띄운 것 없음 |

## 1. `engine.js` 구성

공개 API (spec 17-8-5 이름·모양 그대로 + 필요한 것만 더함):

| 이름 | 하는 일 |
|---|---|
| `searchDoc(docId, query, {signal, onPartial, onProgress?, maxHits?})` | 한 책. 결과 `{docId, query, hits:[{pageNo, at, len, kind}], pagesCovered, pageCount, truncated}` (+ `error` · `cancelled` · `partial`/`preparing`) |
| `searchLibrary(query, {signal, onPartial, onProgress?, maxHits?})` | 서재 전체. 열린(캐시된) 책 먼저, 그다음 `lastOpenedAt` 내림차순. 끝난 책마다 `onPartial(책 결과)`. 다른 책은 캐시하지 않는다(읽고 접고 찾고 버림) |
| `prepareDoc(docId, {onProgress})` | 검색 화면을 여는 순간 캐시 채우기 + 백필(2-2 결정). 세대를 올리지 않는다 |
| `backfill(docId, {onProgress})` · `backfillPlan(docId)` | 백필(S9). 같은 책은 한 작업을 함께 기다린다 |
| `notePage(docId, pageNo)` · `invalidate(docId?)` | S13. 캐시 없는 책이면 읽기 0 |
| `cancel()` · `cacheInfo()` · `orderHits()` · `KIND_ORDER` | 화면 떠날 때 취소 · 진단 · 순서 규칙 |

동작 요점
- **백필**: `docId_algoVersion`(지금 ALGO 이상) 키와 `docId_sk`(`[docId, SEARCH_KEY]`) 키를 값 없이 비교 → 빠진 쪽만 `BACKFILL_BATCH`(50)쪽씩, **`pages` 읽기와 `searchText` 쓰기를 한 readwrite 트랜잭션**으로(추출기 쓰기와 엇갈리지 않음). 레코드 식은 `writePageAndSearch` 와 같다(`{docId} + searchRecordOf(fromStored(rec))`, 키 칸 `pageNo` 는 읽은 키로 못 박음). `SEARCH.ENABLED=false` 면 쓰지 않는다. 깨진 저장본은 건너뛰고 `failed` 로 센다.
- **캐시**(한 권): `READ_BATCH`(200)쪽씩 `getAll` → 원문 + 접은 글자 + heading 빈도표(`headFreq`, 쪽 단위 증감). `notePage` 로 표시된 쪽은 다음 검색 전에 그 쪽만 다시 읽는다(동시에 둘이 불러도 한 번만 — `refreshing`). 백필 묶음이 끝날 때마다 캐시에 바로 넣는다.
- **찾기**: 쪽 순서로 본문 글자 → 표 글자, 상한까지. 상한을 채운 뒤에는 "하나라도 더 있나"만 보고 `truncated`(정확히 1,000 이면 false). 묶음은 `classifyHit`(text/search.js) 그대로 — 서재 범위는 빈도표를 다 모은 뒤 같은 함수로 정한다(2단계). 결과 순서 head → body → table, 묶음 안은 쪽·오프셋.
- **세대 취소**: `searchDoc`·`searchLibrary` 가 한 세대 번호를 나눠 쓴다. 앞 세대는 `onPartial` 을 더 부르지 않고 `{cancelled:true, hits:[]}` 로 끝난다. `signal` 도 같다. 백필 작업 자체는 취소하지 않는다(다음 검색이 이어 씀) — `invalidate` 만 멈춘다.
- **백필 중 검색**: 백필할 쪽이 있으면 그 전에 이미 있는 쪽으로 찾은 결과를 `onPartial({partial:true, preparing:{done:0,total}})` 로 한 번 보낸다. 진행은 `onProgress({docId, done, total})`.
- `text/search.js` 는 **고치지 않았다**(필요한 순수 함수가 8g-1 에 이미 다 있었다).

## 2. 배선 — 바뀐 파일·줄 (`js/ui/library.js`)

| 줄 | 내용 |
|---|---|
| 47–48 | `import { notePage as searchNotePage, invalidate as searchInvalidate } from '../search/engine.js';` |
| 441 | `attach`: `ex.addEventListener('page', (e) => { searchNotePage(doc.id, …pageNo); });` |
| 442 | `attach`: `ex.addEventListener('reextract', () => { searchInvalidate(doc.id); });`(algoVersion·derivedHash 되감기) |
| 665 | `reextractDoc`: `db.resetDerived` 바로 뒤 `searchInvalidate(docId)`(RX5 순서 검사 그대로 녹색) |
| 782 | 삭제: `db.deleteDocument` 성공 뒤 `searchInvalidate(docId)` |

- `pdf/extract.js` 는 고치지 않았다(이벤트는 이미 있다). 화면에서 보이는 것 0 — 캐시가 없으면 `notePage` 는 아무것도 읽지 않는다.
- spec §6 표는 `reextractDoc 뒤 engine.invalidate` 를 8g-4 행에 두었다. 지침(최소 배선은 8g-2)에 따라 지금 넣었다 — 아래 6절 문안 제안.
- 삭제 뒤 `invalidate` 는 지침 문구("다시 추출·재추출")에 없는 한 줄이다. 지운 책 글자를 캐시가 들고 서재 검색에 내는 일을 막는다.
- `index.html` 은 stamp 로만(새 모듈 `js/search/engine.js` 표 1줄 + 해시).

## 3. 수용 기준

| 기준 | 판정 | 테스트(`tests/search-db-8g.test.mjs` 별도 표기 외) |
|---|---|---|
| S8 규칙 표 | ○ | 순수 몫은 8g-1 그대로 + 새 경계값 테스트(search-text-8g). 엔진 몫: 같은 표를 `searchDoc` 으로(MI 2·mi 3·metform·beta 세 꼴·pre-eclampsia 세 꼴·이름표 pseudo-hypo…·betablocker 0·SHORT/LONG·메타 문자·`len` = 맞은 변형 길이) |
| S9 백필 | ○ | 10쪽 중 6쪽 → **pages.get 정확히 4회**, 레코드 = 추출 레코드(JSON 필드 순서까지), 옛 algoVersion 3쪽은 만들지 않고 pagesCovered 밖. 두 번째 0회. 경첩: `searchKey(VERSION+1)`·`searchKey(VERSION,'d1:00000000')` 레코드 → 10쪽 다시, 옛 글자 0. 묶음 50쪽씩·진행 `[0,50,100,120]`·onPartial 1회 |
| S10 부분 추출 | ○ | 1,000쪽 중 300쪽 → pagesCovered 300, 결과 쪽 = 그 300쪽 |
| S11 상한·취소 | ○ | 3×400 → 1,000 · truncated · 쪽 순서 [400,400,200]. 정확히 1,000 → false. 본문으로 꽉 찬 뒤 같은 쪽 표 하나 → true. 세대: 둘째 시작 → 첫 결과 `cancelled`, 첫 onPartial 0회(대조군은 1회). signal·서재 검색도 |
| S12 묶음 | ○ | heading=head, 10번 반복 heading=body, rowhead·인용=body, 표=table, 순서 검사, 표 `at` 은 table 안 오프셋. 서재 범위(캐시 없음)가 **같은 hits**, 열린 책 먼저 |
| S13 캐시 | ○ | notePage 전엔 옛 글자(캐시 증명) → 뒤엔 새 글자만. 새 쪽 추가·다른 책 무시·없어진 쪽 빠짐. invalidate → `cacheInfo()` null → 다시 채움. 실제 Extractor 의 page 이벤트로 3쪽이 따라옴 + library.js 배선 소스 검사 |
| 계층(3-2) | ○ | engine.js 에 DOM·window·storage·fetch 0, import 는 config·db·text/* 만, import map 표에 있음 |
| S14 | ○ | 4절 |
| S15 | **대신 Node** | 5절. 데스크톱 Chrome 실측은 8g-4 Review 몫 |

fake-idb 관대함(8g-1 Review 정보 4) 대비: 백필 레코드의 `docId`·`pageNo` 를 따로 단언하고 `peek` 를 명시 키로 했다(키 칸이 undefined 면 `[docId,null]` 로 저장돼 peek 가 비어 빨강).

## 4. 8g-1 Review 보강 3건

1. **ENABLED=false 행동 테스트**(S5b): `config` 가 얼어 있어 js/ 를 임시 폴더에 복사하고 사본의 `SEARCH.ENABLED` 만 false 로 바꿔 사본 `extract.js`·`engine.js` 를 부른다(앱 코드 무수정). 꺼진 판 `writePageAndSearch` → pages 는 쓰고 그 쪽 옛 검색 글자는 지우며 다른 쪽은 그대로, 꺼진 엔진 백필은 쓰기 0. 변이 R2(지우기 제거)·E9(엔진이 스위치 무시) 모두 빨강. 임시 폴더는 `finally` 에서 지운다.
2. **경계값**(search-text-8g 새 테스트 + 엔진 S8): `the`(3자)는 there 를 안 찾고 `ther`(4자)는 찾는다, 접은 길이로 셈(`a-b`), `COPD5`(5자)는 대소문자·낱말 전체, `ABCDEF`(6자)는 아니다, `12` 는 약어 아님. R5(`<=3`→`<3`)·R9(상한 6) 빨강.
3. **S6 2초 상한**: 새 판 열기를 `Promise.race` 2초로. R7(연결 안 닫음)이 이제 **2.0초에** 원인 문구("versionchange 에서 연결을 닫지 않았다(blocked=true)")로 실패한다(예전 60초 취소).

## 5. 세 권 — 앱 엔진 비교(S14)·시간

`node --max-old-space-size=8192 apps/medreader/dev/measure-search-8g.mjs <pdf> --pdfjs <5.6.205> --json … --app`. `--app` 은 pages 저장본만 fake-idb 에 넣고 **엔진 백필**이 searchText 를 만든 뒤 시제품과 맞댄다. 결과 `b8g2/app-{harr,c26,c21}.json`. 한 권 16·54·57초, 모두 종료 0. 출력은 수치뿐.

| | Harrison 729 | CMDT 2026 1,967 | CMDT 2021 5,051 |
|---|---|---|---|
| 백필 레코드(text·table·heads) = 시제품 | 차이 0 · 빠짐 0 · 키/sk 이상 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| 검색어 26개 적중 집합 차(상한·끝까지) | 0 · 0 | 0 · 0 | 0 · 0 |
| 쪽 수·묶음 수·규칙(변형)·truncated·순서 | 0 | 0 | 0 |
| 서재 범위 vs 책 범위(4 검색어) | 0 | 0 | 0 |
| **결과 쪽 다시 찾기**(앱 함수) 쪽 / 불일치 / 빈 구간 | 1,567 / **0** / 0 | 2,433 / **0** / 0 | 3,015 / **0** / 0 |
| 두 줄에 걸친 적중 | 98 | 140 | 63 (Plan 과 같음) |
| 묶음 예 | treatment 제목 7 | treatment 제목 **308**, heart failure 표 **79** | treatment 제목 **73** (Plan U8 과 같음) |

시간(Node 24, 이 기계). "캐시 위 검색"은 순수 계산, 나머지는 fake-idb 를 지나므로 **참고값**(실제 IDB 아님).

| | Harrison | CMDT 2026 | CMDT 2021 | Plan 2-2 |
|---|---|---|---|---|
| 검색 1회, 상한 1,000 — 가장 느린 검색어 (앱 / 시제품) | 4.1 / 4.1ms | **14.0 / 13.2ms**(IL-6) | 15.5 / 13.2ms | ≤ 4.2 / 13.1 / 15.4ms |
| 검색 1회, 끝까지(상한 없음) | 10.0ms(`the`) | 40.2ms(`the` 4.2만 적중) | 26.1ms | ≤ 6.7 / 16.4 / 18.8ms |
| 다음 검색(sarcoidosis) | 2.4ms | 11ms | 8.7ms | — |
| 첫 검색(캐시 없음 → 채우기 → 검색, fake-idb) | 26ms | 192ms | 198ms | 캐시 채우기 18 / 72 / 71ms |
| 캐시 채우기만(fake-idb) | 37ms | 152ms | 211ms | |
| 백필 전권(fake-idb) | 0.50초 | 2.06초 | 1.66초 | 0.36 / 1.24 / 0.90초 |
| 서재 범위 한 권(캐시 없음, fake-idb, sarcoidosis) | 27ms | 168ms | 196ms | 세 권 합 161ms |

- 상한 1,000 검색은 시제품과 같은 수준(+0–2ms — 적중마다 묶음·길이를 정하고 정렬한다). 화면은 늘 상한으로 부르므로 S15 "다음 검색 ≤ 50ms" 에 여유가 있다.
- "끝까지"는 상한을 푼 측정 모드에서만(4.2만 적중 객체 + 정렬) 시제품의 2–3배다. 앱 경로에서는 쓰지 않는다.
- fake-idb 값(백필·채우기·서재)은 흉내가 요청마다 `setImmediate`·`structuredClone`·전체 키 정렬을 해서 Plan(역직렬화만)보다 크다. **실제 브라우저 값은 8g-4 Review 의 S15 몫**으로 남긴다.

## 6. 변이 (`b8g2/mut.mjs`, 로그 `mut.log`·`mut-out/`, 백업 `bak/`)

레포 파일 한 곳 → 전체 테스트(`--test-timeout=60000`, 상한 300초) → finally 복원 → 바이트 비교. 19개 모두 복원 같음, 끝에 대상 5파일 sha256 OK. 표의 "빨강"은 import map 해시 테스트 3개(IM2·IM6·IM7b — 파일을 바꾸면 늘 빨강)를 뺀 것.

| # | 변이 | 빨강 |
|---|---|---|
| V8 | `searchKey` 에서 DERIVED_HASH 뺌 | S9 경첩 · S5 둘 · S2 searchKey |
| V15 | 백필 범위를 옛 algoVersion 까지 | S9 백필 |
| V9 | 일반 소제목 강등 제거(classifyHit) | S12 엔진 · S12 classifyHit · headFreq |
| E1 | 백필이 모든 쪽을 다시 | S9 둘 · S5b |
| E2 | 세대 검사 제거 | S11 세대 |
| E3 | 상한 뒤 "하나 더" 보기 제거 | S11 상한 |
| E4 | 결과 정렬 제거 | S12 |
| E5 | `notePage` 무동작 | S13 셋 |
| E6 | `invalidate` 가 캐시를 안 버림 | S13 invalidate · S12(서재가 캐시를 씀) |
| E7 | 표시된 쪽 다시 읽기 생략 | S13 셋 |
| E8 | 서재 범위 묶음 2단계 생략 | S12(서재 = 책 hits) |
| E9 | 엔진 백필이 ENABLED 무시 | S5b |
| E10 | 백필 전 onPartial 생략 | S9 묶음 · S11 대조군 |
| W1 | library `page`→notePage 배선 제거 | S13 배선 |
| W2 | 다시 추출 뒤 invalidate 제거 | S13 배선 |
| R2 | ENABLED=false 의 옛 글자 지우기 제거(보강 ①) | S5b |
| R5 | 3자 낱말 전체 `<=3`→`<3`(보강 ②) | S8 엔진 · S8 경계값 |
| R9 | 대문자 약어 상한 5→6(보강 ②) | S8 엔진 · S8 경계값 |
| R7 | versionchange 에서 close 안 함(보강 ③) | S6 — **2,011ms** 에 실패(취소 0) |

spec §8 의 V11(강조 이름)·V12(`pauseForJump` 생략)는 8g-4 화면 코드(`search-hit` 레지스트리·`controls.pauseForJump`)에 대한 변이라 이번 범위에 걸 자리가 없다 — 8g-4 Build/Review 몫.

## 7. 실행·정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초): **1117/1117 × 2회**(8.5초·8.3초), fail 0, cancelled 0. 새 테스트 14개(search-db-8g 13 · search-text-8g 1).
- `node apps/medreader/dev/stamp-importmap.mjs` → `--check` "그대로다 (모듈 56개 · CSS 4개)", 종료 0.
- 남은 프로세스: 내가 띄운 node 는 모두 끝났다. 끝 `tasklist` 의 node 43840(Adobe — 이전 Review 들이 적은 것), python 29744, msedgewebview2(앱 호스트)는 내 것이 아니다. 브라우저·프로필은 쓰지 않았다.
- 권한·훅에 막힌 명령 없음. 커밋·checkout/restore/stash·`rm -rf`·npm·다운로드 하지 않았다.
- 작업 중 `.claude/tasks/medreader-survey-language-library.md` 가 새로 생겼다 — 내가 만든 것이 아니다(손대지 않음).

## 8. spec 문안 제안 (spec 은 고치지 않았다)

1. **§6 8g-2 행**: 범위에 "`ui/library.js` 배선 — 추출기 `page`→`engine.notePage`, `reextract` 이벤트·`reextractDoc`·삭제 뒤 `engine.invalidate`(화면 변화 없음)"을 더하고, 8g-4 행의 "`reextractDoc` 뒤 `engine.invalidate`"를 지운다.
2. **17-8-5 API**: `searchDoc` 결과에 `cancelled`(세대 취소)·`error`(검색어 코드)·`partial`/`preparing`(백필 전 첫 결과) 필드, 옵션 `onProgress`·`maxHits`(측정용), 함수 `prepareDoc`(검색 화면을 열 때 — 2-2 결정)·`backfill`·`notePage`·`invalidate`·`cancel` 을 적는다. `headLevel?` 은 만들지 않았다(쓰는 곳이 정해지지 않음 — 8g-4 가 필요하면 heads 의 `r` 로 더한다).
3. **서재 범위 백필**: 서재 검색은 안 연 책도 백필한다(책마다 한 번, 키 비교 뒤 빠진 쪽만). 17-8-5 는 말하지 않았다 — 하지 않으면 8g-1 전에 추출된 책은 그 책을 '이 책' 범위로 한 번 찾기 전까지 서재 결과에 안 나온다.
4. **`truncated` 정의**: "상한을 넘는 적중이 하나라도 있다"(정확히 1,000 이면 false). 시제품은 `>= 1,000` 이었다 — 세 권 26 검색어에서 둘이 갈린 적은 없다.

## 9. 남은 문제·관찰

- **S15 실측 미완**: 브라우저 IndexedDB 의 백필·첫 검색·서재 시간은 재지 않았다(화면 없음). 8g-4 Review 에서 데스크톱 Chrome·Nour 기기로.
- 백필 중 `fromStored` 가 던지는 저장본은 건너뛰고 세기만 한다 — 다음 캐시 채우기 때 그 쪽을 다시 시도한다(세 권 실측 0쪽).
- 옛 경첩(`sk`)인 레코드라도 그 쪽 `pages` 가 옛 algoVersion 이면 백필하지 않고 **있는 대로 찾는다**(U10 "있는 대로 찾고"). 레코드 모양이 깨졌으면(`text` 가 문자열 아님) 찾지 않는다.
- 같은 책에 `prepareDoc` 과 `searchDoc` 이 겹쳐도 캐시 채우기·백필·다시 읽기는 한 번씩만 돈다.

## 10. 파일

- 앱(커밋 안 함): `js/search/engine.js`(새), `js/ui/library.js`, `index.html`(stamp), `tests/search-db-8g.test.mjs`, `tests/search-text-8g.test.mjs`, `dev/measure-search-8g.mjs`(`--app` 7절)
- 스크래치 `b8g2/`: `orig/`·`orig-sha.txt`(수정 전), `app-{harr,c26,c21}.{json,out,err}`·`app-runs.log`, `full-{1,2}.log`, `mut.mjs`·`mut.log`·`mut-run1.log`(이름 추출 전 첫 회차)·`mut-out/`·`bak/`·`pre-mut-sha.txt`
