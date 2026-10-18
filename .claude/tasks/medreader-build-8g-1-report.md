# 8g-1 Build 보고 — 검색 데이터 단계 (DB 3 · 검색 글자 저장 · versionchange 배너)

> 2026-10-18. 지침 `medreader-build-8g-1.md`(첫 Build) + `medreader-build-8g-1b.md`(마무리 Build). **커밋하지 않았다.**
> 첫 Build가 단계 1·2 코드와 테스트를 끝냈다. 같은 세션의 포크가 약 5분 동안 같은 작업을 겹쳐 돌리다 멈췄다. 그래서 마무리 Build가 작업 트리를 점검하고, 남은 측정·변이 재확인·브라우저 확인을 새 폴더 `b8g1b/`에서 다시 했다. 포크가 남긴 `b8g1/` 결과는 읽기만 했고 믿지 않았다.
> 스크래치패드 = `C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad`

## 0. 한눈에

| 항목 | 결과 |
|---|---|
| 작업 트리 점검 | **예상 밖 변경 없음**. 바뀐 파일 18개와 새 파일 4개가 요약과 정확히 같다. 변이 표식 0. 단계 1 이후 바뀐 파일은 단계 2 요약과 맞는다. |
| 전체 테스트 | **1100/1100** × 3회(점검 2회, 변이 복원 뒤 1회). `stamp --check` 0(모듈 55·CSS 4). |
| CMDT 2026 (1,967쪽) | searchText **19.75MB**(Plan 19.7MB, +0.3%). 저장 글자 = 화면 글자 **1,967/1,967쪽**. `pages`는 **옛 판과 값이 같다**(1,967쪽 모두). |
| CMDT 2021 (5,051쪽) | searchText **18.94MB**(Plan 18.9MB, +0.2%). 저장 글자 = 화면 글자 **5,051/5,051쪽**. `pages`는 옛 판과 값이 같다(5,051쪽 모두). |
| Harrison (729쪽) | 첫 Build: 5.65MB, 전 쪽 같음. 마무리 Build가 실제 Extractor로 다시 비교해도 `pages`가 옛 판과 값이 같았다(729쪽). |
| 변이 재확인 | V1·V5·V7·V13·V14 **모두 빨강**. 복원한 뒤 `cmp`가 같았고, 원본 sha256도 같았다. |
| 브라우저(Edge · 412px · 캐시 끔) | DB가 2 → 3으로 오른다. 문서·blob·쪽·번역 캐시·progress·진행 위치·설정이 그대로 남는다. 새로 추출한 쪽에 `searchText`가 쓰이고 화면 글자와 같다. 새 판 두 탭에서 가짜 4로 올리면 **두 탭 모두 `err.dbUpgraded` 배너와 [다시 불러오기]**가 뜬다. 버튼을 누르면 다시 불러온다. |
| 남은 프로세스 | **없다**. Edge 2회 모두 닫혔고(PID 16616·27772), node도 모두 끝났다. 8000번 서버(PID 45124)는 원래 떠 있던 것이라 그대로 두었다. |

## 1. 단계 1 — `js/text/screen.js` 옮김만

- `describePage`·`flowParasOf`·`paraBlock`·`FOLD_ROLES`·`REF_ROLE`(ui/reader.js)와 `joinPieces`·`localRange`(tts/text.js)를 새 순수 모듈 `js/text/screen.js`로 옮겼다. 원래 두 파일은 같은 함수 객체를 다시 export한다.
- **단계 1 끝 파일 6개**(스냅숏 `b8g1/step1/`, sha256은 `b8g1/step1-sha.txt`):
  `js/text/screen.js`(새), `js/ui/reader.js`, `js/tts/text.js`, `index.html`(stamp), `tests/split-contract-8a.test.mjs`, `tests/search-text-8g.test.mjs`(S3 두 개만).
  이때 테스트는 **1071/1071**이었다.
- 마무리 점검에서 스냅숏과 지금 파일을 비교했다. `screen.js`·`reader.js`·`tts/text.js`·`split-contract-8a.test.mjs`는 **sha256이 같다**. 단계 2에서 바뀐 것은 `index.html`(stamp 값과 `text/search.js` 한 줄)과 `search-text-8g.test.mjs`(S1·S2·S7·S8·S12·S17 추가)뿐이다.
- 요약 문구 하나를 바로잡는다. 첫 Build 요약은 `split-contract-8a` 수정을 단계 2 목록에도 넣었다. 그러나 실제로는 **단계 1 스냅숏에 이미 들어 있고**, 단계 2에서는 바뀌지 않았다. flowParas 본문을 자르는 범위를 고친 것으로, 옮김 때문에 생긴 수정이다.

## 2. 단계 2 — 데이터

- `js/text/search.js`(새, 순수): `searchRecordOf`·`foldText`·`parseQuery`·`findIn`·`classifyHit`·`snippetAt`·`rangesFor`·`headingToc` 등
- `config.js`: `SEARCH`(ENABLED·VERSION 1·MIN/MAX_CHARS·MAX_HITS_PER_DOC·SNIPPET·DEBOUNCE_MS·READ_BATCH·BACKFILL_BATCH·TOC_FALLBACK_MAX·REPEAT_HEADING·RECENT_MAX·COMPOUND_MIN_PREFIX)
- `db.js`: `DB_VERSION 3`(내리지 말라는 주석과 테스트 가드), `searchText` 스토어(keyPath `[docId,pageNo]`, 인덱스 `docId`·`docId_sk`), `MIGRATIONS[3]`(멱등 조정), `CASCADE_STORES`·`DERIVED_STORES`에 `searchText`, `ERR.UPGRADED`
- `extract.js`: `writePageAndSearch` — `pages`와 `searchText`를 **한 `withTx`**에 쓴다. `SEARCH.ENABLED=false`면 같은 트랜잭션에서 그 쪽의 옛 검색 글자를 지운다. `_buildAndStore`와 역할 재계산이 이 길을 지난다.
- `main.js`: `versionchange`가 오면 `err.dbUpgraded` 배너와 [다시 불러오기](`data-reload`, `location.reload()`)를 띄운다.
- i18n: `err.dbUpgraded`를 ko·en·ar·fr 네 언어에 넣었다. **spec에 없는 `common.reload` ×4**도 넣었다(버튼 이름). `ERROR_KEYS`에 `ERR_DB_UPGRADED`를 더했다.
- `settings.js`: `search.recent: []`
- `tests/fixtures/fake-idb.mjs` 보강: `getAll`, 범위 키(`IDBKeyRange` 흉내), 인덱스 `getAllKeys(range)`
- 기존 테스트 수정: db D1·D2, docs-patch DP13, reextract RX1·RX3. 새 테스트: `search-text-8g`(20)·`search-db-8g`(11). 합계 **1100/1100**.

## 3. 작업 트리 점검 (마무리 Build, 가장 먼저 함)

- `git status` 결과
  - 바뀐 파일 18개: index.html · config · db · i18n ar/en/fr/index/ko · main · extract · settings · tts/text · ui/reader · tests db/docs-patch-p1/fake-idb/reextract/split-contract-8a
  - 새 파일 4개: `js/text/screen.js`·`js/text/search.js`·`tests/search-db-8g.test.mjs`·`tests/search-text-8g.test.mjs`
  - 모두 위 요약과 정확히 같다. `git diff --stat`은 322+/280−다.
- diff를 줄 단위로 읽었다. 요약에 없는 변경은 없다.
- 변이 표식 grep(`MUT`·`/*V숫자`·`//V숫자`·`MUTANT`·`XXX`, js·tests·index.html): **0건**.
- 포크가 변이를 걸었던 파일 3개(`search.js`·`db.js`·`extract.js`)의 sha256이 포크의 백업 `b8g1/bak/V*-*` 원본과 같다. 변이가 남지 않았다.
- `screen.js`(21:42) 이후 바뀐 파일은 단계 2 목록과 `spec.md`뿐이다. `spec.md`는 오케스트레이터 커밋 `165f2b9`(22:06)로 HEAD와 같다.
- 앱 밖의 추적되지 않는 파일. 모두 Build가 만든 것이 아니며 손대지 않았다.
  - `.codex/`·`AGENTS.md`: 2026-08-27, 원래 있던 것
  - `.claude/tasks/medreader-build-8i-2c.md`: 21:39
  - `.claude/tasks/next-session-2026-10-19.md`: 22:19, 마무리 Build가 도는 중에 생겼다. 오케스트레이터 쪽 파일로 보인다.
- 스크래치패드 `b8g1/`·`b8g1/step1/`·`b8g1b/`에 빈 `NVIDIA Corporation/` 폴더가 있다. Edge나 GPU 드라이버가 작업 폴더에 만드는 셰이더 캐시이고, 스냅숏 내용과는 관계없다.

## 4. 측정 — 세 권, 실제 Extractor 전권 (마무리 Build)

**방법**(`b8g1b/extract-full.mjs`):
- 앱의 실제 `Extractor`(이웃 레이아웃 + 역할 재계산까지)로 책 전권을 fake-idb에 추출했다.
- 판을 둘로 나눠 따로 돌렸다.
  - 옛 판: 커밋 `165f2b9`의 `apps/medreader`를 `git show`로 `b8g1b/old-app/`에 꺼낸 것
  - 새 판: 작업 트리
- pdf.js는 이 기계의 pdfjs-dist **5.6.205**를 썼다(`C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`).
- `pages`는 `extractedAt`만 빼고 **값 기준 정규 문자열**(키 정렬, `-0`·NaN·undefined 구분)의 쪽별 sha256으로 비교했다. v8 직렬화 바이트가 같은 모듈로도 갈린다는 첫 Build의 관찰 때문이다.
- searchText는 다음을 확인했다.
  - 쪽마다 레코드가 있는가
  - `sk = SEARCH_KEY`인가
  - `algoVersion`이 같은가
  - `text`가 화면 글자와 **바이트로 같은가**. 화면 글자는 `flowParasOf(describePage(fromStored(page)))` → `joinPieces` → `'\n'`으로 이은 것이다.
- 크기는 레코드별 v8 직렬화 합이다. docId는 Plan과 같은 `'bench'`로 두었다.

| | Harrison 729 | CMDT 2026 1,967 | CMDT 2021 5,051 |
|---|---|---|---|
| 추출(새 판) | done · 쪽 오류 0 · 17초 | done · 0 · 68초 | done · 0 · 83초 |
| `pages` 옛 판 ↔ 새 판(값, 쪽별) | **0쪽 다름** | **0쪽 다름** | **0쪽 다름** |
| `pages` algoVersion | 12 | 12 | 12 |
| searchText 레코드 / 빠짐 / 남는 것 | 729 / 0 / 0 | 1,967 / 0 / 0 | 5,051 / 0 / 0 |
| **저장 글자 = 화면 글자** | 729/729 | **1,967/1,967** | **5,051/5,051** |
| `sk` 어긋남 · algoVersion 어긋남 | 0 · 0 | 0 · 0 | 0 · 0 |
| searchText v8 | 5.65MB (Plan 5.6) | **19.75MB** (Plan 19.7, +0.3%) | **18.94MB** (Plan 18.9, +0.2%) |
| text / table 글자 | 2,843,648 / 70,877 | 8,928,189 / 757,419 (Plan 893만 / 75.7만) | 9,551,236 / 0 (Plan 955만 / 0) |
| heads · 빈 text 쪽 · 2바이트 쪽 | 1,017 · 0 · 650 | 12,194 · 139 · 1,892 | 5,997 · 107 · 4,523 |

- 세 권 모두 Plan ±5% 안이다. Plan 표가 0.1MB 단위로 반올림되어 있어서 Harrison은 첫 Build의 정밀값 비교(+0.2%)가 더 정확하다.
- 정규 해시 전체: Harrison `19355340d0ca354a`, CMDT 2026 `1ea6cee43cb99618`, CMDT 2021 `f5523937cf299e47`. 옛 판과 새 판의 값이 같다.
- 첫 Build의 Harrison 측정(앱 모듈 경로)은 searchText 5.65MB(Plan +0.2%), 저장 글자 = 화면 글자 729쪽 전부, Plan 시제품과 0쪽 다름이었다.
- 출력에는 원서 글자가 없다(수치와 해시뿐).

## 5. 변이 재확인 (마무리 Build — 포크가 로그를 덮어써서 다시 함)

`b8g1b/mutate.mjs`는 첫 Build의 변이 표에서 다섯 개만 골랐다. 대상 테스트는 search-text-8g·search-db-8g·reextract·db·docs-patch-p1이고, 백업은 `b8g1b/bak/`에 두었다.

| 변이 | 내용 | 결과 |
|---|---|---|
| V1 | `foldText` 길이 보존 줄 제거 | 빨강 1 (S1 무작위 유니코드 1만 개 길이 보존) |
| V5 | 저장 글자를 `fromStored` 문단 text로 | 빨강 2 (S2 화면 글자 · 문단 안 빈 줄) |
| V7 | `pages`·`searchText`를 따로 쓰기(두 트랜잭션) | 빨강 2 (S5 실패 주입 · 한 withTx 소스) |
| V13 | `DERIVED_STORES`에서 `searchText` 뺌 | 빨강 4 (RX1·RX3·S4 둘) |
| V14 | `DB_VERSION` 3 → 2 | 빨강 10 (D1·DP13·S4 …) |

- 다섯 개 모두 복원한 뒤 `cmp`가 같았다. 원본 sha256 3개(`b8g1b/pre-mutate-sha.txt`)도 `sha256sum -c` OK다.
- 복원 뒤 전체 테스트는 1100/1100이다.
- 첫 Build는 변이 12개(V1–V10·V13·V14)를 모두 빨강으로 확인했다. 그 로그는 포크가 덮어써서 남지 않았고, 이번에 위 다섯 개를 다시 확인했다.

## 6. headless 브라우저 — DB 업그레이드·배너 (마무리 Build)

**환경**
- Edge headless, 412×915, 캐시 끔.
- 새 프로필만 썼다: `b8g1b/profile`(1회차), `b8g1b/profile2`(2회차). 합쳐서 2개다.
- 진짜 키는 쓰지 않았고 AI 요청도 없었다.
- 같은 출처 `http://127.0.0.1:8000`에서 열었다. 옛 판 탭은 puppeteer 요청 가로채기로 `b8g1b/old-app/`(165f2b9) 파일을 내보냈다(57개). 같은 출처라서 IndexedDB를 공유한다.
- 문서는 지어낸 글로 만든 6쪽 PDF `b8g1b/zorvat6.pdf`다(`make-pdf.mjs`).
- 1회차는 C 단계에서 뒤쪽 탭 캡처가 시간 초과로 멈췄다. 그래서 탭을 앞으로 가져오도록 고쳐 2회차를 끝까지 돌렸다. A·B·C의 배너 결과는 두 회차가 같다. 로그는 `browser-upgrade-run1.log`(1회차)와 `browser-upgrade.log`(2회차)다.

**A. 옛 판(DB 2)**
1. 앱 `DB_VERSION` 2로 PDF를 가져와 2쪽에서 읽었다. 6쪽 추출이 끝났다.
2. 번역 캐시 1개와 progress 1개를 넣었다.
3. 다시 불러와 메모리에 추출기가 없게 한 뒤, 5·6쪽 저장본을 지우고 extraction을 "4쪽까지·미완"으로 바꿨다. 중단된 추출을 흉내 낸 것이다.
4. 저장된 DB: 버전 2, 스토어 13개. documents 1 · blobs 1 · pages 4 · aiCache 1 · progress 1 · settings 2. `searchText` 스토어는 없다.

**B. 옛 탭을 연 채 새 판 탭**
- 새 탭이 607ms에 부팅했다. 앱 `DB_VERSION` 3, **저장된 DB 버전 3**, 스토어 14개.
- 레코드가 **모두 그대로**다(documents 1 · blobs 1 · pages 4 · aiCache 1 · progress 1 · settings 2). `searchText`는 0이다.
- **남은 것**
  - 진행 위치 `lastPage` 2, `lastLineId` 있음
  - 번역 캐시 값 그대로
  - progress 있음
  - `ui.lang` ko, 온보딩 완료
  - 서재 카드 1
- `searchText` 스토어: keyPath `["docId","pageNo"]`, 인덱스 `docId`·`docId_sk(["docId","sk"])`
- 새 탭이 막히지 않았다. `blocked` 배너는 없다(옛 판 db.js가 `versionchange`에서 연결을 닫는다).
- **옛 탭(165f2b9)에는 배너가 없다.** 옛 탭의 다음 DB 일은 `ERR_DB_OPEN / VersionError`로 실패한다. 배너 코드가 없는 판이라 예상대로다. 아래 S6 문안 제안의 근거다.
- 새 탭에서 문서를 열면 5·6쪽을 추출한다(done, 6쪽).
  - **`searchText`는 5·6쪽에만** 생긴다. 1–4쪽 백필은 8g-2 몫이다.
  - `sk` `1|d1:9e94752b`, algoVersion 12
  - 화면 글자와 **2/2 같다**

**C. 새 판 탭 둘 — 가짜 버전 4**
- n2가 `indexedDB.open('medreader', 4)`로 열었다. 막히지 않고(blocked=false) 성공했다.
- **n1과 n2 모두** `err.dbUpgraded` 배너가 떴다. 문구는 "앱이 새 판으로 바뀌었습니다. 다시 불러오세요." 버튼은 [다시 불러오기](`data-reload="1"`)다. n2는 자기 앱 연결도 versionchange를 받는다.
- 버튼 상자는 136×48이고 가로 넘침이 없다(scrollWidth 412 = innerWidth). 캡처: `b8g1b/banner-ko.png`
- 아랍어로 바꾸면 배너도 바뀐다. 문구 "تم تحديث التطبيق إلى إصدار جديد…", 버튼 "إعادة التحميل", `dir=rtl`. 캡처: `b8g1b/banner-ar.png`
- 버튼을 누르면 **다시 불러온다**. 그 뒤 DB가 시험용 4라서 새 판(3)은 열 수 없다. `err.dbOpen` 배너가 뜨는 것은 기대대로다. 설정을 못 읽어 기본 언어(ar)로 떴다.
- 콘솔 오류: 옛 탭에 404 하나뿐이다. `/apps/medreader/` 밖의 요청(파비콘 등)이라 서버가 404를 냈다. 새 탭 둘은 0이다.

## 7. spec 문안 제안 (spec은 고치지 않았다 — 운영자 판단)

1. **17-8-12 S6**: "옛 판 탭에 배너가 뜬다" → **"8g-1 이후 판 탭에 배너가 뜬다"**.
   - 8g-1 이전 판(165f2b9)에는 `versionchange` 배너 코드가 없다. 위 B처럼 배너 없이 다음 DB 일이 `VersionError`로 실패한다.
   - 배너를 확인할 수 있는 경우는 "8g-1 이후 판 탭 둘 중 하나가 더 높은 버전으로 여는 때"(위 C)다.
2. **§4-6 i18n 키 수 38 → 39**: `err.dbUpgraded`와 함께 **spec에 없는 `common.reload`**(ko·en·ar·fr ×4)를 더했다. [다시 불러오기] 버튼 이름이다.

## 8. 남은 문제·관찰

- 앱 코드의 결함은 찾지 못했다.
- ko의 `common.dismiss`는 원래 영어 "Dismiss"다. 새 배너 옆에 영어 버튼이 함께 보인다(캡처). 8g-1 이전부터 있던 미번역 자리표시이며 이번 범위 밖이다.
- 백필(1–4쪽처럼 8g-1 이전에 추출한 쪽의 검색 글자)은 8g-2 몫이다. 지금은 새로 추출하거나 다시 추출하는 쪽만 searchText를 얻는다.
- 실제 기기의 저장 증가량(`storage.estimate`)은 재지 않았다(Plan `[M]` 몫).

## 9. 파일

- 앱(커밋 안 함): 위 2절 목록
- 스크래치패드 `b8g1/`(첫 Build, 포크가 일부 덮어씀 — 읽기만): `step1/`·`step1-sha.txt`·`bak/`
- 스크래치패드 `b8g1b/`(마무리 Build)
  - 스크립트: `extract-full.mjs`·`mutate.mjs`·`browser-upgrade.mjs`·`make-pdf.mjs`
  - 결과: `x-{harr,c26,c21}-{old,new}.json`·`mutate.log`·`full-{1,2,3}.log`·`browser-upgrade*.log`·`banner-{ko,ar}.png`·`old-app/`·`profile/`·`profile2/`
