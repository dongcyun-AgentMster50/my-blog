# Build 지침 — MedReader 2c단계: `db.js` · `hash.js` · `pdf/loader.js` · `pdf/extract.js`

> spec 19절 구현 순서 2번. **이전 초안 `medreader-build-2.md`를 대체한다** — 그 문서는 "25MB / 729쪽" 가정 위에 쓰였다.

## 배경 — 위험이 "형식"에서 "규모"로 옮겨갔다

대상 PDF(729쪽)는 임시본이고 며칠 내로 **7000쪽 실제 자료**로 교체된다. `[사용자 확인 2026-09-20]` **새 자료는 현재 PDF와 형식이 유사하다.** 따라서 대비할 것은 미지의 형식이 아니라 **10배 규모**다.

| | 729쪽 실측 | 7000쪽 환산 |
|---|---:|---:|
| `pages` 저장 (2b 축소 후) | 15.9MB | **150MB** |
| 추출 시간(레이아웃만) | ~7초 | **~70초** |
| PDF 파일 자체 | 22.7MB | **200MB+ 가능** |
| 중단 재개 | 있으면 좋음 | **필수** |

**150MB는 IndexedDB에서 만만한 숫자가 아니다.** 브라우저는 쿼터 압박 시 저장소를 통째로 비울 수 있고, 주 기기인 Android Chrome은 데스크톱보다 빡빡하다.

## 너의 역할 — 첫 작업이 정해져 있다

spec 19절 2번을 구현하되 **가장 먼저 실제 IndexedDB 점유량을 측정**한다.

spec 9-2의 용량 수치는 `JSON.stringify` 바이트이고 `[미확정]`으로 표시돼 있다. **IndexedDB는 구조화 복제(structured clone)라 인코딩이 다르다** — 수치가 8바이트 double로 들어가므로 2b의 좌표 반올림 효과가 사라질 수 있고, 키 이름 중복 비용도 다르다.

**측정 없이 나머지를 만들지 마라.** 150MB가 감당 못 할 숫자면 데이터 모델을 다시 짜야 하고, 그러면 이 단계의 나머지가 전부 바뀐다.

## 먼저 읽을 것

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **9절 전체(특히 9-2 저장 규칙·9-4 재개 모델. 둘 다 2026-09-20에 수정됨)**, 2-1·2-3·2-4, 3-1·3-2·3-3, 4-2, 7-5, 13절, 14절, 16-B·16-K, 18절, 19절, 20절
3. `D:\01_claude_my-blog\apps\medreader\review.md` — 1·1b·1c·1d 검증 보고서. **각 절의 "다음 단계 주의사항"을 전부 읽어라.**
4. 소비 대상: `js/config.js`, `js/text/layout.js`(`buildPageLayout`·`algoVersion`), **`js/text/store.js`(`toStored`/`fromStored`/`storeVersion` — 2b 산출물)**, `dev/profile.mjs`

## 수정 허용 범위

```
apps/medreader/js/db.js                신규
apps/medreader/js/hash.js              신규
apps/medreader/js/pdf/loader.js        신규
apps/medreader/js/pdf/extract.js       신규
apps/medreader/js/config.js            2c 상수 추가만 (LAYOUT 기존 값 변경 금지)
apps/medreader/tests/*.test.mjs        신규 추가
apps/medreader/dev/proto-extract.html  신규 (+ .js/.css)
```

금지:
- **`js/text/*` 수정 금지.** Review를 통과했다. 버그를 발견하면 고치지 말고 **보고서에 적어라.**
- **`config.js`의 `KEEP_HYPHEN_SUFFIXES`는 사용자가 직접 채운 값이다.** 건드리지 마라.
- `spec.md`·`dev/proto-lines.*`·`dev/profile*.mjs`·기존 `tests/*` 수정 금지. 기존 91개 테스트 기대값 변경 금지.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**
- UI 본체(`index.html`·`router.js`·리플로우 뷰·i18n·TTS·AI·`pdf/render.js`)를 만들지 마라. **`dev/proto-extract.html`은 개발 도구다.**

## 작업 순서 — 이 순서를 지켜라

### 0단계. 용량 실측 (다른 것보다 먼저, 끝나면 멈춰서 보고)

최소한의 `db.js`(스토어 하나면 된다)와 `dev/proto-extract.html`만 먼저 만들어, **실제 PDF 200쪽 이상을 IndexedDB에 넣고** `navigator.storage.estimate()` 전후 차이를 재라.

측정할 것:

| 항목 | 왜 |
|---|---|
| **쪽당 실제 점유 바이트** | `JSON.stringify` 21.9KB와 얼마나 다른가 |
| 2b 축소 규칙 3종의 **구조화 복제에서의 개별 효과** | 문단 text 제거 / 표 밖 run text 제거 / 좌표 반올림. **반올림은 효과가 0일 수 있다** — 그러면 그렇다고 보고하라 |
| **줄 레코드를 배열 튜플로 저장하면** 얼마나 주는가 | 키 이름 중복 제거 효과. 한 번 재고 수치만 보고하라(채택 여부는 나중) |
| 7000쪽 환산값 | |
| `navigator.storage.estimate()`의 `quota` | 이 기기에서 쓸 수 있는 총량 |

**이 결과를 보고하고 멈춰라.** 7000쪽 환산이 **100MB를 넘으면** 나머지를 진행하기 전에 오케스트레이터 판단을 받아라. 100MB 이하면 계속 진행해도 된다.

### 1단계. `hash.js`

- `sha256Hex` — `crypto.subtle` 사용, 비보안 컨텍스트(LAN http)에서 **FNV-1a 64 폴백**(spec 18절). 접두사로 구분(`s256:` / `fnv:`).
- `globalThis.crypto?.subtle` 존재 검사만 허용(16-K 예외).
- 7-5의 캐시 키 조립 함수.
- **대용량 해시**: 7000쪽 PDF는 200MB를 넘을 수 있다. 전체를 `arrayBuffer()`로 올리지 마라. 목적은 **파일 동일성 판별**이므로 전략(예: 크기 + 앞·중간·뒤 샘플 청크)을 정하고 **근거와 충돌 위험 평가를 주석·보고서에 적어라.**

### 2단계. `db.js`

- DB 이름 `medreader`, 버전 `1`. **spec 9-2의 스토어를 전부** 만든다(Phase 2·3 포함 — 9-1 결정). 인덱스도 표대로. `fileHash` unique.
- `MIGRATIONS = { 1: fn, … }` 사다리, 각 fn 멱등(`objectStoreNames.contains`).
- `blocked` / `versionchange` 처리.
- get / put / delete / iterate + 트랜잭션 헬퍼 + `navigator.storage.estimate()`.
- **`navigator.storage.persist()`** 요청 경로(spec 9-2). 7000쪽에서 저장소가 비워지면 추출을 처음부터 다시 해야 한다.
- **`QuotaExceededError` 처리**: 추출 중 터지면 조용히 죽지 말고 **호출자가 구분할 수 있는 신호**를 내고 `extraction`에 상태를 남겨라.
- 순수 계층이 아니다. `indexedDB`·`navigator` 사용은 정상. `document`·`window` DOM 조작과 `ui/` import는 금지(3-2).

### 3단계. `pdf/loader.js`

- pdf.js ESM **동적 `import()`**, 버전 고정(`config.js`의 `PDFJS_VERSION` = `5.4.149`), `GlobalWorkerOptions.workerSrc`를 **같은 base·같은 버전**으로.
- jsDelivr → cdnjs 폴백(`PDFJS_BASES`). 둘 다 실패하면 **호출자가 구분할 수 있는 실패 코드**를 던져라(14절 오프라인 UX가 쓴다). UI 문자열을 하드코딩하지 마라.
- 로드는 **1회만** 하고 캐시(모듈 레벨 프라미스).
- **버전 문자열이 코드에 두 번 이상 나타나면 결함이다.**
- `dev/proto-lines.html`의 `?pdfjs=` 오버라이드를 **여기로 옮기지 마라** — 개발 전용이다.

### 4단계. `pdf/extract.js`

- spec **9-4 전체**. 우선순위 큐(0: 현재±1, 1: 현재±2~±5, 2: 1쪽부터 순차), `requestIdleCallback`(없으면 `setTimeout(0)`) 사이사이 한 쪽씩, 낭독 중 priority 2를 초당 1쪽으로 제한하는 스로틀 훅.
- 각 쪽: `getPage` → `getTextContent(PDF_TEXT_CONTENT_OPTIONS)` → `buildPageLayout` → **`toStored`**(2b) → `pages.put` → **`page.cleanup()`** → `extraction` 갱신.
- 방어: `typeof item.str !== 'string'` 버린다(4-0).
- **재개 모델은 9-4의 "명시적 커서 + 실패 페이지 목록"**:
  - `documents.extraction = { done, pagesDone, cursor, failed[], algoVersion }`
  - **재개는 `cursor`를 따른다. `pagesDone`으로 판단하지 마라** — 우선순위 큐가 순서를 건너뛴다.
  - 이미 `pages`에 있는 쪽은 건너뛴다.
  - **한 쪽이 던져도 전체를 멈추지 마라.** `failed`에 넣고 다음으로. `cursor`가 끝에 닿으면 `failed`를 **한 번 더** 재시도하고, 그래도 실패하면 남긴 채 `done`을 세우지 않는다.
  - `algoVersion`이 오르면 `cursor ← 1`, `failed ← []`. 쪽별로는 `pages[i].algoVersion < ALGO_VERSION`인 것만 재계산.
- **7000쪽 메모리**: 페이지 결과를 배열에 쌓지 마라. `page.cleanup()`을 `finally`에서 호출하라. `pdfDoc.cleanup()`도 주기적으로 고려하라.
- **역할 재계산 경로(`roleVersion`)**: `classifyRoles`는 `neighborLayouts`가 없으면 이웃 반복 검사를 생략한다(4-7). 이웃이 나중에 추출되면 **그 쪽만** 다시 돌려 `roleVersion`을 올려라. **전체 재추출 금지.** `neighborLayouts`에는 저장본(아이템 없음)으로 충분하다.
- 진행 상태를 **관찰 가능하게** 노출(콜백/이벤트). "312/7000"을 그릴 수 있어야 한다.
- **`stats.widthFixed`를 로그에 남겨라**(2b 산출). 7000쪽에서 이 비율이 2.13%를 크게 넘으면 새 자료의 폭 정보가 더 심하게 깨져 있다는 신호다.

### 5단계. `dev/proto-extract.html`

- `<input type="file">` → `documents`·`blobs` 저장 → 추출 시작.
- 진행 표시(`pagesDone / pageCount`, `cursor`, `failed[]`), 일시정지 / 재개.
- **[중단 후 새로고침] 시 `cursor`에서 이어지는지** 눈으로 확인 — 이 단계의 핵심 검증이다.
- 쪽 번호 입력 → `pages`에서 읽은 저장본 표시(줄 수·역할 분포·문단 수·표 수·`roleVersion`·`algoVersion`·`storeVersion`).
- **저장본에 `items`가 없음을 화면에서 증명**(키 목록과 바이트 크기).
- **`fromStored` 왕복 확인** — 저장본에서 조립한 문단 text를 화면에 보여라(2b 계약이 실제로 도는지).
- `navigator.storage.estimate()` 표시, [이 문서 삭제], [DB 비우기].
- 모든 동적 텍스트 `textContent`. 뷰포트 메타.

## 테스트 (`node --test`)

`db`·`extract`는 브라우저 API 의존이라 통으로 못 돌린다. **순수하게 떼어낼 수 있는 것을 떼어내라**:

- `hash.js`의 FNV-1a 64 경로(알려진 입력 → 알려진 출력, 접두사 구분).
- **재개 커서 계산**(`cursor`·`failed`·이미 저장된 쪽 집합 → 다음 쪽)을 순수 함수로 분리해 테스트. **9-4 재개 모델의 핵심이다.**
- 우선순위 큐 순서 생성(현재 쪽 → 인접 → 순차).
- `MIGRATIONS[1]` 멱등성(`objectStoreNames` 스텁).
- 기존 91개 전부 통과.

## 스모크 테스트

1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과.
2. **실제 PDF**(`C:\Users\YDC\Downloads\ILMA_2021_20th_ed_Harrison.pdf`, 729쪽)로:
   - 가져오기 → 추출 → `pages` 저장
   - **추출 도중 새로고침 → `cursor`에서 이어짐** ← 핵심
   - 저장본에 `items` 없음, **표 region 줄에만** `runs[].text` 있음
   - `fromStored` 왕복 문단 text 일치
   - 같은 파일 두 번 → `fileHash` unique로 중복 생성 안 됨
   - **`navigator.storage.estimate()` 전후 차이 = 쪽당 실제 점유**
   - 콘솔 에러·경고 **0건**(16-K)
3. **강제 실패 주입**: 특정 쪽에서 예외를 던지게 해 `failed`에 들어가고 추출이 **계속되는지**, 끝에서 재시도되는지.
4. **쿼터 압박**(가능하면): 저장이 `QuotaExceededError`로 실패할 때 조용히 죽지 않는지.
5. 브라우저 확인은 `preview_start {name:"blog"}` → `http://localhost:8000/apps/medreader/dev/proto-extract.html`. **launch.json 수정 금지.**

## 완료 보고 형식

1. **0단계 용량 실측 결과** — 제일 중요하다. 쪽당 실제 점유, `JSON.stringify` 바이트와의 차이, 축소 규칙별 효과, 배열 튜플 효과, 7000쪽 환산, `quota`.
2. 생성/수정한 파일과 줄 수.
3. `node --test` **실제 출력**(pass/fail).
4. 스모크 테스트 각 항목 ○/× 와 근거. 스크린샷이 파일로 안 남으면 "세션 브라우저 패널에서 확인"이라고 정직하게 적어라. **없는 경로를 지어내지 마라.**
5. 대용량 해시 전략과 근거(충돌 위험 평가 포함).
6. spec과 다르게 구현한 부분. 없으면 "없음". `js/text/*`에서 발견한 버그가 있으면 여기에(고치지 말고).
7. **사용자가 7000쪽 실자료로 확인할 절차** 5줄 이내.
8. 3단계(19절 3번: `index.html` 골격 + `router.js` + i18n + 온보딩)에 넘길 주의사항 3개 이내.

테스트를 통과시키려고 spec을 어기거나 기대값을 낮추지 마라. 막히면 멈추고 보고하라.
