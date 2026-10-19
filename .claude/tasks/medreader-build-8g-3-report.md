# Build 보고 — 8g-3 목차·쪽 라벨 (`js/search/outline.js`)

> 지침 `medreader-build-8g-3.md`. 커밋하지 않았다. 화면 변화 없음(목차 탭은 8g-4). 스크래치패드 `b8g3/`.

## 1. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `js/search/outline.js` (새, 서비스) | `ensure`·`readOutline`·`tocOf`·`printedLabel`·`isOutlineCurrent`·`OUTLINE_V`(1)·`OUTLINE_MAX_ITEMS`(5000)·`OUTLINE_ERR`. import 는 `config`·`db`·`text/search.js` 뿐, DOM·`window`·타이머 0 |
| `js/ui/reader.js` | import 1줄 + `wireExtractor` 끝에 `scheduleOutline(docId, ex)` 1줄 + `scheduleOutline` 함수(약 18줄) |
| `tests/search-outline-8g.test.mjs` (새) | 15개 — S16(8)·S16b tocOf(1)·S17 보강(2)·배선·계층·정리 |
| `dev/measure-search-8g.mjs` | `--toc` 8절(앱 목차와 시제품 비교) + 6절이 변형 C 목록을 `R._takeC` 로 남김(끝에서 지움) |
| `index.html` | stamp 로만(`outline.js` 줄 추가, `reader.js` 해시) |

`js/text/search.js` `headingToc` 는 **고치지 않았다**(2절). `engine.js`·spec·review 는 손대지 않았다.

## 2. `headingToc` 확인 — 고칠 것 없음

| 요구 | 지금 코드 | 확인 |
|---|---|---|
| U11 숫자만 → 같은 쪽 바로 다음 heading 을 붙임 | `DIGITS_ONLY` + `all[all.indexOf(h)+1]`, `nx.p === h.p` 일 때만 | 기존 S17 + 새 S17(쪽 끝 숫자는 그대로) · 변이 G3·G4 빨강 |
| 10번 반복 제목 빠짐 | `freq.get(k) < REPEAT_HEADING` | 새 S17(정확히 10번 빠짐, 9번 남음) · G8 빨강 |
| 항목 ≤ 200 (층 단위로 끊음) | 층을 내려가며 `nx.length > max` 에서 멈춤 | 새 S17(150+9 → 159, 다음 층 300 은 안 들어감) · G9 빨강 |
| rowhead 섞지 않음 | heads 는 `searchRecordOf` 가 kind `heading` 만 넣음(구조로 0) | V10 빨강(S2·S12·S17) · 실측 행 표 쪽 항목 0 |

관찰(고치지 않음 — 기존 S17 기대값이 이 동작을 고정한다): 숫자만인 항목에 붙인 장 제목이 **같은 층에도 있으면 따로 한 번 더** 나온다("12 Title" + "Title"). CMDT 2021 12개(98 중), CMDT 2026 1개, Harrison 0. → 7절 제안 2.

## 3. `outline.js` 구성

- **`ensure(docId, pdfDoc)`** — 거절하지 않고 `{status}` 를 돌려준다: `saved{items, labels}` · `cached` · `missing` · `off`(`SEARCH.ENABLED=false`) · `error{code}`.
  - 순서: `documents` 읽기 → `isOutlineCurrent`(`outlineV === 1` && `outline` 배열)이면 **PDF 를 부르지 않고** `cached` → 쪽 수 확인(`doc.pageCount` 와 `pdfDoc.numPages` 가 다르면 `ERR_OUTLINE_MISMATCH`, 쓰지 않음) → `readOutline` → `db.patch`(트랜잭션 안에서 다시 `isOutlineCurrent` 면 덮지 않음, 문서가 지워졌으면 되살리지 않음 → `missing`).
  - **멱등**: 저장 표시 `outlineV`, 같은 책 동시 호출은 진행 중 작업 하나를 함께 기다림(`jobs` 맵).
  - **저장**: `outline:[{t, p, d}]`(제목 앞뒤 공백 다듬음, 깊이 최상위 1 — 8g-1 S4 시드·측정 스크립트와 같은 꼴), `outlineV:1`, `pageLabels`(있고 하나라도 `String(p)` 와 다를 때만, 문자열로). 개요가 없는 PDF 는 `outline:[]` + `outlineV` — 다음부터 PDF 를 안 본다. `documents` 에 두므로 `resetDerived` 가 지우지 않는다(테스트로 확인).
- **쪽 해석**(`pageOfDest`): 문자열 → `getDestination` → 배열, `[0]` 이 정수면 쪽 순번, 객체면 `getPageIndex`. 대상 없음(URL)·이름 없음·**`getDestination`/`getPageIndex` 가 던짐**·범위 밖 → 그 항목만 `p:null`(예외 없음). 개요 트리는 스택으로 앞 순서(깊은 트리 안전), 항목 5,000 상한.
- **실패 처리**: `getOutline`·`getPageLabels` 자체가 던지면 `ERR_OUTLINE_READ`, **저장하지 않음** → 다음 호출이 다시 읽는다(반쯤 읽은 것을 `outlineV` 로 굳히지 않는다). DB 실패는 `db.ERR` 코드.
- **폴백 — 저장하지 않고 그때마다**(`tocOf(docId)`): 개요가 있으면 `{source:'outline', items, pageLabels, outlineRead:true}`, 없거나 아직 못 읽었으면 `searchText`(인덱스 `docId`) 를 커서로 돌며 **heading 줄만 남긴 작은 레코드**로 `headingToc` → `{source:'fallback', items:[{t,p,d:1}], pageLabels, outlineRead}`. `outlineRead:false` = 화면 `search.toc.unavailable`. 이유: spec 17-8-12 §3 이 폴백을 "searchText 만 쓰므로 오프라인 ○"로 두었고, `heads` 는 추출·백필이 진행되며 늘어나 저장하면 덜 된 목록이 굳는다(테스트: 새 쪽이 들어오면 폴백이 따라 는다).
- `printedLabel(labels, p)` — 화면 "p. {라벨} (PDF {p})" 용(같거나 없으면 null).

## 4. 배선 (`js/ui/reader.js`)

- import: 61줄 `import { ensure as ensureOutline, isOutlineCurrent } from '../search/outline.js';`
- `wireExtractor` 끝(1387줄, `catchUpStale();` 다음) `scheduleOutline(docId, ex);` — `wireExtractor` 는 `showReader` 의 `await renderPage()`·`saveLastPage()` **뒤에** 불린다(첫 그리기 뒤).
- `scheduleOutline`(1389–1408줄): `isOutlineCurrent(state.doc)`(매 `showReader` 마다 새로 읽은 레코드)이거나 이미 예약됐으면 그만 → `requestIdleCallback(run, {timeout:5000})`(없으면 `setTimeout 1500`) → 그때 다른 책이면 그만 → `ensureOutline(docId, ex.pdfDoc).catch(() => {})`. 실패는 조용히, 다음에 그 책을 그릴 때 다시. 사용자에게 보이는 것 0, pdf.js 를 새로 불러오지 않는다(이미 붙은 추출기의 `pdfDoc` 만).

## 5. 측정 — S18 (`--toc`, pdf.js 5.6.205, Node, 결과 `b8g3/toc-{harr,c26,c21}.json`, 세 권 종료 0)

| | Harrison 729쪽 | CMDT 2026 1,967쪽 | CMDT 2021 5,051쪽 |
|---|---|---|---|
| 앱 `readOutline` 항목 / 해석 | 37 / 37 | 61 / 61 | 50 / 50 |
| 시제품(1절) 대비 쪽·제목 차이 | 0 · 0 | 0 · 0 | 0 · 0 |
| 깊이 분포 (1절과 같음) | 1:17 · 2:20 | 1:61 | 1:50 |
| 쪽 라벨 저장 | 안 함(없음) | **1,967개** — PDF−라벨 38 이 1,704쪽, 166 이 97쪽 · 개요 61항목 전부 인쇄 쪽 ≠ PDF 쪽 | 안 함(없음) |
| `ensure` 첫 호출 / PDF 호출 / 두 번째 | saved · 39 · **cached, PDF 0** | saved · 63 · **cached, PDF 0** | saved · 52 · **cached, PDF 0** |
| 저장 크기 outline / pageLabels (JSON) | 1.5KB / — | 3.5KB / 12.7KB | 2.6KB / — |
| 앱 `headingToc` = 변형 C (항목 집합 차) | 154 = 154 (0) | 106 = 106 (0) | 98 = 98 (0) |
| 폴백: 개요 쪽(±1)에 항목 | **27/37** | 52/61 | 47/50 |
| 폴백: 개요 제목 일치 | 13/37 | 5/61 | **45/50** |
| 폴백: 행 표 쪽 항목 · 남은 숫자만 항목 | 0 · 0 | 0 · 0 | 0 · 0 |
| 폴백: 붙인 제목이 따로 또 나옴 | 0 | 1 | 12 |
| `tocOf`(heading 줄만 읽는 경로) = `headingToc` | 같음 154 | 같음 106 | 같음 98 |

→ 기준 충족: CMDT 2021 45/50 ≥ 45 · 항목 98 ≤ 200, Harrison 27/37 ≥ 27 — Plan 실측과 **같다**. 시간(참고, OCR 일괄 작업 중): `readOutline` 0.9 / 3.3 / 1.3ms — **CMDT 2026 의 3.3ms 는 1절이 같은 문서에서 이름 대상을 먼저 해석한 뒤라 따뜻한 값**이다(Plan 의 처음 값 218ms 가 맞는 기준). `headingToc` 8.7 / 110 / 42ms, `tocOf`(흉내 IDB) 24 / 161 / 162ms. pdf.js 가 Harrison 에서 "Unable to read page labels" 경고를 내지만 던지지 않고 null 이다(저장 안 함 — 맞음).

## 6. 검증

- **변이 16개 전부 빨강 → 복원 → 바이트 같음**(`b8g3/mut.mjs`, 로그 `b8g3/mut.log`, 백업 `b8g3/bak/`, 끝에 대상 3파일 sha256 OK). 관련 테스트 3파일(`search-outline-8g`·`search-text-8g`·`search-db-8g`)로 돌림.
  - spec V10(heads 에 rowhead) → fail 4(S2·S12×2·S17)
  - G1 `p:null` 처리 빼기 → 6 · G2 멱등 검사 빼기 → 2 · G3 U11 빼기 → 3 · G4 U11 같은 쪽 조건 빼기 → 1 · G5 라벨 늘 저장 → 1 · G6 동시 호출 묶기 빼기 → 1 · G7 라벨 읽기 실패 삼킴 → 1 · G8 반복 제목 빼기 없앰 → 3 · G9 200 상한 없앰 → 2 · G10 깊이 0부터 → 5 · G11 리더 배선 빼기 → 1 · G12 리더가 실패를 안 삼킴 → 1 · G13 patch 대신 put(지운 문서 되살림) → 1 · G14 폴백이 다른 책 레코드도 씀 → 1 · G15 범위 밖 쪽 받음 → 4
- `node apps/medreader/dev/stamp-importmap.mjs` → 모듈 57개, `--check` 0.
- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초) **1143/1143 × 2회**(8.0초·8.0초), fail 0, cancelled 0. (1128 + 새 15)
- 남은 프로세스: 내가 띄운 node 없음(남은 node.exe 1개는 Adobe Creative Cloud 의 것, PID 43840). 브라우저 확인 없음(지침 — S19 는 8g-4).

## 7. spec 문안 제안 (spec 은 고치지 않았다)

1. **17-8-6 첫 항목 / 17-8-12 §3 "개요 읽기 시점"** 끝에 `[정정 — 8g-3 Build]`:
   "`outline` 항목 `{t, p, d}` — `t` 는 앞뒤 공백을 다듬은 제목, `d` 는 최상위 1부터(Harrison 1·2). 대상이 없거나(URL 항목) 이름 대상이 없거나 `getDestination`·`getPageIndex` 가 던지거나 범위 밖이면 그 항목만 `p:null`. 개요가 없는 PDF 는 `outline:[]` + `outlineV` 를 저장해 다시 읽지 않는다. `getOutline`·`getPageLabels` 자체가 던지면 저장하지 않는다(다음 열기에 다시). 넘겨받은 pdf 문서의 쪽 수가 `documents.pageCount` 와 다르면 쓰지 않는다. 항목 상한 5,000. API(8g-3 이 만든 그대로): `ensure(docId, pdfDoc)` → `{status:'saved'|'cached'|'missing'|'off'|'error', code?}`(거절하지 않음) · `readOutline(pdfDoc)` · `tocOf(docId)` → `{source:'outline'|'fallback', items, pageLabels, outlineRead}` · `printedLabel(labels, p)` · `isOutlineCurrent(doc)`. `SEARCH.ENABLED=false` 면 `ensure` 는 PDF 를 보지 않는다(`off`)."
2. **17-8-6 "개요가 없는 책의 폴백"** 에 한 줄: "폴백은 저장하지 않고 목차를 열 때마다 `searchText.heads` 에서 만든다(`tocOf`) — 추출·백필이 진행되면 heads 가 늘고, pdf.js 없이도 된다." 그리고 **기록**: "숫자만인 항목에 붙인 장 제목이 같은 층에 있으면 따로 한 번 더 나온다(CMDT 2021 98항목 중 12). 붙인 제목을 목록에서 빼면 겹침이 없어지나 기존 S17 기대값(36항목)이 바뀌므로 운영자 판단 — 폴백은 세 권 모두 실제로 쓰이지 않는다."
3. **17-8-12 §2 개요 표의 CMDT 2026 "읽기+해석 2 + 218ms"** 옆: "8g-3 측정의 3.3ms 는 같은 문서에서 이름 대상을 이미 해석한 뒤(pdf.js 캐시) 값 — 처음 열기 기준은 218ms 그대로."
4. **8g-4 지침에 넣을 것**(S19): 목차 탭은 `outline.tocOf(docId)` 를 부른다 — `source:'fallback'` 이면 `search.toc.fallback` 머리, `outlineRead:false` 면 `search.toc.unavailable` 한 줄, 항목 0 이면 `search.toc.empty`. 폴백은 `searchText` 에 있는 쪽만 보므로 8g-1 전에 추출된 책은 `engine.prepareDoc` 뒤에 부르는 것이 낫다. 쪽 표시는 `printedLabel`. `p:null` 항목은 흐리게·누를 수 없게.

## 8. 남은 문제

- **실제 브라우저 미확인**: `requestIdleCallback` 경로·실제 IndexedDB 의 `ensure` 저장은 Node(fake-idb)로만 봤다. 사용자에게 보이는 변화가 없어 8g-4 Review(S19)에서 함께 본다.
- 개요는 **리더를 연 책만** 읽는다(서재에서 열기만 한 책은 아직 없음) — 목차 탭은 리더에서 들어가므로(이 책 범위) 실제로는 문제없을 것.
- `tocOf` 폴백은 그 책 `searchText` 전부를 커서 하나로 읽는다(CMDT 2021 5,051쪽 — 흉내 IDB 162ms, 실제 폰 미측정). 개요가 없는 책에서만 쓰인다.
- 폴백 겹침(2절·7-2) — 운영자 판단 대기.
