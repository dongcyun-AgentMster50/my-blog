# Build 지침 — MedReader 2단계: db · hash · pdf/loader · pdf/extract

## 너의 역할

이 프로젝트의 **Build 단계 2/N** 담당이다. 승인된 설계 문서 `apps/medreader/spec.md`의 **19절 구현 순서 2번**만 구현한다.

> 2. `config.js`, `db.js`(스키마 v1 전부), `hash.js`, `pdf/loader.js`, `pdf/extract.js` — 가져오기 → 추출 → `pages` 저장까지 콘솔로 확인.

**1단계(`js/text/*`, `tests/`, `dev/proto-lines.*`)는 이미 완료·커밋되어 있다.** 그 코드를 고치지 마라 — 소비만 한다.

이 단계에서 만들지 않는 것: `index.html`, `router.js`, 리플로우 뷰, i18n, TTS, AI 어댑터, 퀴즈 파서, `pdf/render.js`. **UI는 없다.** "콘솔로 확인"이 이 단계의 완료 조건이다.

## 먼저 읽을 것 (순서대로, 전부)

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — 2-1(파일 구조), 2-3(pdf.js CDN 로딩), 3-1·3-2(계층·의존 방향), 3-3(데이터 타입), **9절 전체(IndexedDB 스키마 — 가장 중요, 특히 9-2 스토어 정의와 9-4 추출 전략·재개 모델)**, 7-5(캐시 키 — `hash.js` 용도), 13절(프라이버시), 14절(오프라인), 16-B·16-K, 18절, 19절, 20절
3. `D:\01_claude_my-blog\apps\medreader\review.md` — 1단계 검증 보고서. **10절 "2단계에 넘길 주의사항"을 반드시 읽어라.**
4. 1단계 산출물(소비 대상): `apps/medreader/js/config.js`, `js/text/layout.js`(특히 `buildPageLayout` 시그니처와 `algoVersion`)

> `spec.md`는 2026-09-18에 4-3·4-4·4-9·9-4가 **수정**되었다. 반드시 현재 파일을 읽어라. 1단계 보고서나 오래된 기억이 아니라 파일이 기준이다.

## 수정 허용 범위

아래만 **생성/수정**한다. 그 외 어떤 파일도 만들거나 고치지 마라.

```
apps/medreader/js/config.js          수정 허용 — 2단계에 필요한 상수 추가만 (기존 LAYOUT 값 변경 금지)
apps/medreader/js/db.js              신규
apps/medreader/js/hash.js            신규
apps/medreader/js/pdf/loader.js      신규
apps/medreader/js/pdf/extract.js     신규
apps/medreader/tests/*.test.mjs      신규 추가 (기존 테스트 파일 수정 금지)
apps/medreader/dev/proto-extract.html  신규 — 2단계 확인용 페이지 (+ 필요하면 .js/.css)
```

금지:
- **`js/text/*` 수정 금지.** 1단계는 Review 통과했다. 버그를 발견하면 고치지 말고 **보고서에 적어라**.
- `apps/medreader/spec.md` 수정 금지. 설계와 다르게 구현해야 할 이유가 생기면 **구현은 spec대로 하고 보고서에 이견을 적어라.** (1단계에서 이 방식으로 spec 결함 3건이 교정되었다.)
- `dev/proto-lines.*`, `tests/lines|columns|blocks|hyphen|layout.test.mjs` 수정 금지.
- 블로그 본체(`index.html`, `post.html`, `css/`, `js/`, `posts/`, `vendor/`), `apps/2048/`, `.nojekyll`, `.claude/`, `launch.json` 수정 금지.
- PDF를 레포 안에 만들거나 커밋하지 마라. 합성 PDF는 스크래치패드에만.
- 레포 안에 `node_modules`·`package.json`을 만들지 마라.
- 커밋·푸시하지 마라. 완료 보고만 한다.

## 환경 (확인 완료, 재검증 불필요)

- 레포 루트 `D:\01_claude_my-blog` (Windows). Bash 도구에서는 `/d/01_claude_my-blog`.
- Node **v24.14.0**. Python은 `python` (`python3` 없음).
- **테스트 실행은 `node --test "apps/medreader/tests/*.test.mjs"`.** 디렉터리 인자(`node --test apps/medreader/tests/`)는 Node 24 + Windows에서 디렉터리를 모듈로 해석해 **실패한다**. 글로브 형태를 쓰고, 문서에도 그렇게 적어라.
- jsDelivr·cdnjs **모두 열려 있다**(HTTP 200). pdf.js **`5.4.149`** 고정(`config.js`의 `PDFJS_VERSION`). 6.3.289는 목표 기기에서 죽는다 — spec 2-3·18 참조.
- 브라우저 확인: `preview_start {name:"blog"}`(기존 `python -m http.server 8000`) → `http://localhost:8000/apps/medreader/dev/proto-extract.html`. **launch.json 수정 금지.** 끝나면 `preview_stop`.
- 스크래치패드: `C:\Users\YDC\AppData\Local\Temp\claude\D--01-claude-my-blog\ba4903bd-caaf-4b72-9d02-05694b9269f5\scratchpad`
- **실제 원서 PDF는 이 기기에 없다.** 합성 PDF로 검증하고, 실제 PDF 검증 절차는 사용자에게 넘긴다.

## 1단계에서 넘어온 주의사항 (반드시 반영)

1. **`buildPageLayout`의 출력은 아이템까지 포함한다.** spec 9-2는 `pages`에 아이템을 저장하지 않기로 했다(5~8배 용량 차이). `extract.js`가 **저장 직전에 `lines[].items`를 떼고**
   `{id, text, bbox, baseline, fontSize, col, role, hyphenJoin, paraId, runs[{x0,x1,text}], regionId}`만 남겨야 한다.
   **`runs[].text`는 반드시 유지하라** — 4-8의 AI 표 재구성 입력이다. 떼어내는 함수는 순수 함수로 분리하고 테스트하라.
2. **역할 재계산 경로가 필요하다.** `classifyRoles`는 `pageInfo.neighborLayouts`가 없으면 이웃 반복 검사를 생략한다(4-7). 이웃 페이지가 나중에 추출되면 **그 페이지만** `buildPageLayout`을 다시 돌려 `pages.roleVersion`을 올려야 4-11의 B2(러닝 헤드 확정)가 실제로 살아난다. **전체 재추출은 하지 마라.**
   `neighborLayouts`에는 `lines[].text/role/baseline`과 `height`만 있으면 된다 — 저장본(아이템 없음)으로 충분하다.
3. **pdf.js 로딩·워커는 `config.js` 함수만 쓴다.** `pdfjsMainUrl(base)`/`pdfjsWorkerUrl(base)`가 같은 base에서 조립하고, `PDFJS_BASES`가 jsDelivr→cdnjs 폴백 순서다. 버전 문자열이 코드에 두 번 이상 나타나면 결함이다.
   **`dev/proto-lines.html`의 `?pdfjs=` 오버라이드를 `loader.js`로 옮기지 마라** — 개발 전용이다.

## 구현 요구사항

### `js/hash.js`
- `sha256Hex(ArrayBuffer|string)` — `crypto.subtle` 사용. **비보안 컨텍스트(LAN http)에서는 `crypto.subtle`이 없다**(spec 18절). 그때 FNV-1a 64로 폴백한다.
- 두 알고리즘 결과를 **접두사로 구분**한다(예: `s256:...` / `fnv:...`). 캐시 키는 보안 목적이 아니라 동일성 판별이다(spec 18절).
- `globalThis.crypto?.subtle` 존재 검사만 허용된다(16-K가 이것만 예외로 둔다).
- 7-5의 캐시 키 조립 함수도 여기에 둔다.
- 대용량 파일 해시: 25MB Blob 전체를 한 번에 `arrayBuffer()`로 올리는 비용을 생각하라. 파일 동일성 판별이 목적이므로 **spec이 요구하는 범위 안에서** 전략을 정하고, 무엇을 골랐는지 근거를 주석과 보고서에 적어라.

### `js/db.js`
- DB 이름 `medreader`, 버전 `1`. **spec 9-2의 13개 스토어를 전부** 만든다(Phase 2·3 스토어 포함 — 9-1의 결정).
- 인덱스도 9-2 표대로 전부. `fileHash`는 unique.
- `MIGRATIONS = { 1: fn, … }` 사다리. 각 fn은 **멱등**(`objectStoreNames.contains` 검사).
- `blocked`/`versionchange` 이벤트 처리(다른 탭 안내).
- get/put/delete/iterate + 트랜잭션 헬퍼 + `navigator.storage.estimate()` 용량 추정.
- **순수 계층이 아니다.** `indexedDB`·`navigator` 사용은 정상이다. 다만 `document`·`window` DOM 조작과 `ui/` import는 금지(3-2 의존 방향).

### `js/pdf/loader.js`
- pdf.js ESM **동적 `import()`**, 버전 고정, `GlobalWorkerOptions.workerSrc` 설정(같은 base·같은 버전).
- jsDelivr 실패 시 cdnjs 폴백(`PDFJS_BASES` 순서). 둘 다 실패하면 **호출자가 구분할 수 있는 실패 신호**를 던져라(14절 오프라인 UX가 이걸 쓴다). 메시지 문자열을 UI에 하드코딩하지 말고 코드/종류를 반환하라.
- 로드는 **1회만** 하고 캐시한다(모듈 레벨 프라미스).

### `js/pdf/extract.js`
- spec **9-4 전체**를 구현한다. 우선순위 큐(0: 현재±1, 1: 현재±2~±5, 2: 1페이지부터 순차), `requestIdleCallback`(없으면 `setTimeout(0)`) 사이사이 한 페이지씩, 낭독 중 priority 2는 초당 1페이지로 제한할 수 있는 스로틀 훅.
- 각 페이지: `getPage` → `getTextContent({ includeMarkedContent: false, disableNormalization: false })` → `buildPageLayout` → **아이템 제거** → `pages.put` → `page.cleanup()` → `extraction` 갱신.
- 방어: `typeof item.str !== 'string'`인 아이템은 버린다(4-0).
- **재개 모델은 9-4의 "명시적 커서 + 실패 페이지 목록"이다** `[2026-09-18 결정]`:
  - `documents.extraction = { done, pagesDone, cursor, failed[], algoVersion }`.
  - **재개는 `cursor`를 따른다. `pagesDone`으로 판단하지 마라** — 우선순위 큐가 순서를 건너뛰며 채우므로 `pagesDone`은 "어디까지"를 나타내지 못한다.
  - 이미 `pages`에 있는 페이지는 건너뛴다.
  - **페이지 하나가 던져도 전체를 멈추지 마라.** `failed`에 번호를 넣고 다음으로 간다. `cursor`가 끝에 닿으면 `failed`를 한 번 더 재시도하고, 그래도 실패하면 `failed`에 남긴 채 `done`을 세우지 않는다.
  - `algoVersion`이 오르면 `cursor ← 1`, `failed ← []`로 되돌리되, 페이지별로는 `pages[i].algoVersion < ALGO_VERSION`인 것만 실제로 재계산한다.
- 진행 상태를 **관찰 가능하게** 노출하라(콜백/이벤트). UI는 없지만 dev 페이지와 나중의 리더가 "312/729"를 그린다.
- `roleVersion` 재계산 경로(위 주의사항 2번).

### `dev/proto-extract.html`
2단계의 "콘솔로 확인"을 **눈으로 확인**할 수 있게 만든다. UI 본체가 아니라 개발 도구다.
- `<input type="file">`로 PDF 열기 → `documents`·`blobs` 저장 → 추출 시작.
- 진행 표시(`pagesDone/pageCount`, `cursor`, `failed[]`), 일시정지/재개, [중단 후 새로고침] 시 이어서 되는지 눈으로 확인.
- 페이지 번호 입력 → `pages`에서 읽어 온 저장본을 그대로 표시(줄 수·역할 분포·문단 수·표 수·`roleVersion`·`algoVersion`).
- 저장 용량 표시(`navigator.storage.estimate()`), [이 문서 삭제], [DB 비우기].
- **저장본에 `items`가 없음을 화면에서 증명하라** (예: 저장 레코드의 키 목록과 바이트 크기 표시).
- 모든 동적 텍스트는 `textContent`. 모바일에서도 열리게 뷰포트 메타.

### `tests/`
`db`·`extract`는 브라우저 API에 의존하므로 `node --test`에서 통으로 돌릴 수 없다. **순수하게 떼어낼 수 있는 것을 떼어내 테스트하라**:
- `hash.js`의 FNV-1a 64 경로(알려진 입력 → 알려진 출력, 접두사 구분).
- **아이템 제거 함수**(주의사항 1번) — 입력 `PageLayout` → 저장본. `items`가 없고 `runs[].text`가 남는지. 이게 가장 중요한 테스트다.
- 우선순위 큐 순서 생성 로직(현재 페이지 → 인접 → 순차)을 순수 함수로 분리해 테스트.
- 재개 커서 계산(`cursor`·`failed`·이미 저장된 페이지 집합 → 다음에 할 페이지)을 순수 함수로 분리해 테스트. **이 함수가 9-4 재개 모델의 핵심이다.**
- `MIGRATIONS[1]`의 멱등성(가능하면 fake-indexeddb 없이 `objectStoreNames` 스텁으로).
- 기존 38개 테스트가 **계속 통과**해야 한다.

## 스모크 테스트 (네가 직접 수행)

1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(기존 38 + 신규).
2. 합성 PDF(스크래치패드, 1단계 것을 재사용하거나 더 긴 것을 만들어라 — 재개를 보려면 **20쪽 이상**이 낫다)로:
   - 가져오기 → 추출 진행 → `pages` 저장 확인
   - **추출 도중 새로고침** → `cursor`에서 이어지는지 확인 (이게 이 단계의 핵심 검증이다)
   - 저장본에 `items`가 없고 `runs[].text`가 있는지 확인
   - 같은 파일을 두 번 가져오면 `fileHash` unique 인덱스로 중복 생성되지 않는지
   - 콘솔 에러·경고 **0건**(16-K)
3. 강제 실패 주입: 특정 페이지에서 예외를 던지게 해 **`failed`에 들어가고 추출이 계속되는지**, 끝에서 재시도되는지 확인하라.
4. `read_page`/`get_page_text`/`read_console_messages`로 검증하고 마지막에 스크린샷 1장.

## 완료 보고 형식

1. 생성/수정한 파일 목록과 줄 수.
2. `node --test` **실제 출력**(pass/fail 수). 요약만 쓰지 마라 — 오케스트레이터가 직접 재실행해 대조한다.
3. 스모크 테스트 결과(위 2·3의 각 항목 ○/×와 근거). 스크린샷은 파일로 저장되지 않으면 "세션 브라우저 패널에서 확인"이라고 정직하게 적어라. **없는 경로를 지어내지 마라.**
4. 저장 용량 실측: 합성 PDF N쪽의 `pages` 총 바이트와 페이지당 평균. spec 9-2의 목표는 **페이지당 5~10KB**다. 넘으면 무엇이 큰지 적어라.
5. spec과 다르게 구현한 부분이 있으면 항목별로 "무엇을·왜". 없으면 "없음". `js/text/*`에서 발견한 버그가 있으면 여기에(고치지 말고).
6. 사용자가 실제 원서 PDF(25MB·729p)로 확인할 절차를 5줄 이내로. 특히 **16-B의 "첫 페이지 3초 이내"**와 전체 추출 시간을 어떻게 재는지.
7. 3단계(19절 3번: `index.html` 골격 + `router.js` + i18n + 온보딩)에 넘길 주의사항 3개 이내.

테스트가 실패하면 **숨기지 말고 케이스와 원인을 그대로 보고하라.** 통과시키려고 spec을 어기거나 기대값을 낮추지 마라.
