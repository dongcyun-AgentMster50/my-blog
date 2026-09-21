# Build 지침 — MedReader 1단계: 줄 재구성 순수 모듈 + 단위 테스트 + 프로토타입 페이지

## 너의 역할

이 프로젝트의 **Build 단계 1/N** 담당이다. 승인된 설계 문서 `apps/medreader/spec.md`의 **19절 구현 순서 1번**만 구현한다.

> 1. `text/*` 순수 모듈 + `tests/` + `dev/proto-lines.html` — 4-11 통과까지. 다른 것은 만들지 않는다.

리더 UI, IndexedDB, TTS, AI 어댑터, i18n, index.html 등은 **이 단계에서 만들지 않는다.** 이 모듈이 수용 기준을 통과해야 나머지를 붙인다(spec 4-11, 19절).

## 먼저 읽을 것 (순서대로, 전부)

1. `/home/user/my-blog/CLAUDE.md`
2. `/home/user/my-blog/apps/medreader/spec.md` — 2절(파일 구조), 3절(모듈 책임·데이터 타입), **4절 전체(줄 재구성 알고리즘, 가장 중요)**, 5절 중 `isQuestionStart`/`isOptionStart` 정의(문단 kind 판정에 필요), 16-A, 16-K, 18절, 19절, 20절
3. `/home/user/my-blog/apps/2048/game.js` — 이 레포의 코드 스타일(주석 언어·구획 방식) 참고

## 수정 허용 범위

아래 경로만 **생성**한다. 그 외 어떤 파일도 만들거나 고치지 마라.

```
apps/medreader/js/config.js                 알고리즘 파라미터·pdf.js 버전 상수 (값만 export, 부작용 없음)
apps/medreader/js/text/lines.js
apps/medreader/js/text/columns.js
apps/medreader/js/text/blocks.js
apps/medreader/js/text/hyphen.js
apps/medreader/js/text/segment.js
apps/medreader/js/text/layout.js            buildPageLayout(items, pageInfo) 파이프라인, algoVersion export
apps/medreader/tests/*.test.mjs             node --test
apps/medreader/tests/fixtures/*.json        합성 픽스처만 (원서 텍스트 사용 금지 — 이 샌드박스에는 원서 PDF가 없다)
apps/medreader/dev/proto-lines.html         프로토타입 검증 페이지 (+ 필요하면 dev/proto-lines.js, dev/proto-lines.css)
```

금지:
- `apps/medreader/spec.md` 수정 금지. 설계와 다르게 구현해야 할 이유가 생기면 **구현은 spec대로 하고 보고서에 이견을 적어라.**
- 블로그 본체(`index.html`, `post.html`, `css/`, `js/`, `posts/`, `vendor/`), `apps/2048/`, `.nojekyll`, `.claude/` 수정 금지.
- PDF 파일을 레포 안에 만들거나 커밋하지 마라. 테스트용 합성 PDF는 스크래치패드(아래)에만 둔다.
- 외부 라이브러리를 `text/*`·`tests/`에 쓰지 마라. 의존성 0. `dev/proto-lines.html`만 pdf.js를 쓴다.
- 커밋·푸시하지 마라. 작업 완료 보고만 한다(커밋은 오케스트레이터가 한다).

## 기술 사실 (확인 완료, 재검증 불필요)

- Node `v22`. `node --test apps/medreader/tests/`로 테스트를 돌린다. 테스트 파일은 `.mjs`, ES modules.
- **pdf.js 버전은 `6.3.289`로 고정**한다(npm `dist-tags.latest`, 2026-09-18 확인). `config.js`의 `PDFJS_VERSION = '6.3.289'` 한 곳에만 적고, 본체·worker URL을 같은 상수에서 조립한다. `TextItem`은 `{str, dir, transform, width, height, fontName, hasEOL}`, `styles[fontName]`은 `{ascent, descent, vertical, fontFamily}`. `getTextContent({ includeMarkedContent: false, disableNormalization: false })`.
- **이 샌드박스에서는 jsDelivr·cdnjs CDN이 프록시에 막힌다(403).** 하지만 npm 레지스트리는 열려 있다. 로컬 테스트용으로 스크래치패드에 `npm pack pdfjs-dist@6.3.289`로 받아 `package/build/pdf.min.mjs`·`pdf.worker.min.mjs`를 로컬 HTTP 서버로 서빙하라. 따라서 `dev/proto-lines.html`은 pdf.js 기본 URL(CDN, `config.js`에서 import)을 쓰되 **쿼리 파라미터 `?pdfjs=<base URL>`로 로딩 경로를 바꿀 수 있어야 한다**(예: `?pdfjs=http://localhost:8000/pdfjs/`). 이 오버라이드는 dev 페이지 전용이며 앱 본체에는 넣지 않는다.
- 스크래치패드 경로는 환경마다 다르다. 세션의 system prompt에 적힌 scratchpad 디렉터리를 쓰고, 없으면 `/tmp/medreader-build/`를 만든다.
- 이 샌드박스에는 실제 원서 PDF가 없다. 따라서 spec 4-11의 **P1~P11(실제 PDF 검증)은 여기서 할 수 없고**, 사용자가 자기 기기에서 한다. 여기서는 (a) 단위 테스트 L/C/B/T/H 전부, (b) 합성 PDF로 프로토타입 페이지 스모크 테스트를 한다.
- Playwright + Chromium이 설치되어 있다(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `playwright install` 실행 금지). `node`에서 `playwright` 패키지가 없으면 스크래치패드에 `npm i playwright@latest`로 설치하고 `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' 아래의 실제 바이너리 })`로 띄운다. 레포 안에 `node_modules`·`package.json`을 만들지 마라.
- `reportlab`은 없다. 합성 PDF는 Python으로 **표준 14 폰트(Helvetica)만 쓰는 최소 PDF를 직접 써서** 만든다(폰트 임베드 불필요, xref 오프셋만 정확히). 2단 본문 + 폭 넓은 제목 + 4열 표 + 러닝 헤드 + 페이지 번호 + 위첨자 + 줄 끝 하이픈("cardio-"/"vascular") + 줄 경계 붙음 케이스("poses the least" / "cardiovascular risk")를 담은 2~3페이지짜리면 충분하다. 텍스트는 네가 지어낸 영어 문장을 써라(원서 문장 사용 금지). 이 PDF는 스크래치패드에만 둔다.

## 구현 요구사항

### `js/config.js`
- `PDFJS_VERSION`, `PDFJS_CDN_PRIMARY(v)`, `PDFJS_CDN_FALLBACK(v)`, worker URL 조립 함수 또는 상수.
- `LAYOUT` 파라미터 객체: `Y_TOL_FACTOR 0.35, Y_TOL_MIN 1.0, Y_TOL_MAX 6.0, SUPERSCRIPT_SIZE_RATIO 0.75, SUPERSCRIPT_DY_RATIO 0.6, SPACE_GAP_FACTOR 0.15, RUN_GAP_FACTOR 2.0, GUTTER_MIN_RATIO 0.55, GUTTER_BAND_LO 0.30, GUTTER_BAND_HI 0.70, SPAN_WIDTH_RATIO 0.6, MIN_BODY_LINES 8, PARA_LEADING_FACTOR 1.6, PARA_INDENT_FACTOR 0.8, PARA_SHORT_LINE_RATIO 0.70, TABLE_MIN_LINES 3, TABLE_LEADING_FACTOR 2.2, TABLE_COL_TOL_FACTOR 1.5, TABLE_ALIGN_RATIO 0.6, HEADER_ZONE 0.08, FOOTER_ZONE 0.08, PAGENO_ZONE 0.10, HEADING_SIZE_RATIO 1.15` 등 spec 4절의 모든 숫자. 4절에 있는 값을 그대로 쓰고, 4절에 없는 값이 필요하면 추가하되 주석에 근거를 적어라.
- `KEEP_HYPHEN_PREFIXES`, `ABBREVIATIONS`(e.g., i.e., vs., Dr., Fig., et al., approx., No. …).
- 값만 export. 함수는 URL 조립용 순수 함수만.

### `js/text/*` — 순수 계층 (spec 3-1·3-2·3-3 계약 준수)
- `document`, `window`, `fetch`, `indexedDB`, `pdfjsLib`, `navigator`, `localStorage`를 **참조하지 않는다**(grep 0건이 수용 기준). `Math/String/Array/Map/Set/Number/Object/JSON`만 쓴다.
- `layout.js`: `export const algoVersion = 1;` `export function buildPageLayout(rawItems, { pageNo, width, height, styles, neighborLayouts })` → spec 3-3의 `PageLayout`. `rawItems`는 pdf.js `getTextContent().items` 그대로(정규화는 내부 1단계에서). `styles`는 `getTextContent().styles`. `neighborLayouts`는 선택(없으면 이웃 반복 검사 생략).
- 각 모듈은 spec 4절의 단계와 1:1로 대응하는 함수를 export 한다: `normalizeItems`, `clusterLines`, `splitRuns`, `detectColumns`, `reassignByColumn`, `orderLines`, `joinText`, `lineBBox`, `classifyRoles`, `detectTables`, `groupParagraphs`, `joinHyphen`, `splitSentences`, `isQuestionStart`, `isOptionStart`, `endsSentence`. 이름은 이 목록을 따르라(Review가 이 이름으로 찾는다).
- **결정성**: 정렬은 안정 정렬 + 명시적 tie-breaker(`idx`). `Map`/`Set` 순회 순서에 의존하지 않는다. 같은 입력 → `JSON.stringify` 동일 출력.
- 파라미터는 함수 인자로 `params = LAYOUT`을 받아 오버라이드 가능하게(프로토타입 페이지의 슬라이더가 쓴다).
- 주석은 한국어. 각 함수 위에 spec 절 번호를 적어라(예: `// spec 4-3`).
- 성능: 페이지당 아이템 2,000개 기준 `buildPageLayout` 15ms 이하(spec P9). O(n log n) 정렬 + 선형 순회로 충분하다. O(n²) 비교를 만들지 마라.

### `tests/` — `node --test`
- spec 4-11 표의 **L1~L11, C1~C4, B1~B7, T1~T2, H1~H5 전부**를 각각 독립 테스트로 구현한다. 테스트 이름에 케이스 번호를 넣어라(`test('L6 …')`).
- 픽스처는 코드 안에서 합성하거나 `tests/fixtures/*.json`에 둔다. pdf.js items 형태(`{str, dir, transform:[a,b,c,d,e,f], width, height, fontName, hasEOL}`)를 정확히 흉내 낸다. 헬퍼 `item(str, x, y, {fontSize, width})`를 만들어 쓰면 된다.
- 추가: 결정성 테스트(같은 입력 2회 → 동일 JSON), 순수성 테스트(`text/*.js` 소스를 읽어 금지 전역 식별자 grep → 0건), 성능 테스트(2,000 아이템 합성 페이지 100회 평균 ≤ 15ms — 느린 CI를 감안해 실패 대신 경고로만 출력해도 된다).
- `H3`의 기대값은 spec대로: `"2019-" + "2020"` → `"20192020"`이 되면 실패, `"2019- 2020"` 또는 `"2019-2020"`은 허용.

### `dev/proto-lines.html` (+ js/css)
spec 4-11 "프로토타입 페이지" 항목을 전부 구현한다:
- pdf.js 로드(`config.js` CDN 기본, `?pdfjs=` 오버라이드), `<input type="file">`로 PDF 열기, 페이지 번호 입력.
- 왼쪽 canvas 렌더 + 줄 bbox 오버레이(본문 파랑, 헤더/푸터/페이지번호 회색, 표 주황, 거터 세로 점선, 위첨자 합류 아이템 표시), 오른쪽 읽기 순서 줄 목록(번호·col·role·fontSize·runs 수), 문단 경계 가로줄, 하이픈 결합 단어 굵게, `hasEOL` 불일치 노란색.
- 파라미터 슬라이더(Y 허용 계수, 공백 계수, run 계수, 거터 임계 최소 4개) → 즉시 재계산.
- [이 페이지 items JSON 내보내기] 버튼, [items JSON 불러오기](PDF 없이 픽스처로 검증) 버튼.
- 전체 문서 통계 모드: 페이지별 `{줄 수, 컬럼 수, 표 수, 헤더/푸터 수, 경고}` 표 + 이상치 강조.
- 좌표 변환은 `viewport.convertToViewportPoint` 사용(spec 4-12). 모바일에서도 열리게 뷰포트 메타·최소 반응형(데스크톱 도구지만 휴대폰에서 열어 볼 수 있어야 한다).
- 이 페이지는 `js/text/*`와 `js/config.js`를 **상대 경로로 import** 한다(`../js/text/layout.js`). 알고리즘 코드를 복사하지 마라.
- 모든 동적 텍스트는 `textContent`로 삽입.

### 스모크 테스트 (네가 직접 수행)
1. `node --test apps/medreader/tests/` 전부 통과.
2. 스크래치패드에 합성 PDF 생성 → 로컬 HTTP 서버(`python3 -m http.server`, 레포 루트에서) + pdf.js 로컬 서빙 → Playwright로 `dev/proto-lines.html?pdfjs=…` 열기 → 파일 업로드 → 페이지 렌더 → 콘솔 에러 0건 확인 → 줄 목록에서 (a) 2단이 좌→우 순서로 나오는지, (b) `"poses the least cardiovascular risk"`에 공백이 있는지, (c) 표 영역이 잡히는지, (d) 러닝 헤드·페이지 번호가 header/pageno인지, (e) `cardiovascular`가 결합되는지 확인하고 스크린샷을 스크래치패드에 저장.
3. Playwright 스크린샷 경로와 확인 결과를 보고서에 적는다.

## 완료 보고 형식

1. 생성한 파일 목록과 줄 수.
2. `node --test` 결과 요약(통과/실패 수, 실패가 있으면 케이스 번호와 원인).
3. 스모크 테스트 결과(위 a~e 각각 ○/×)와 스크린샷 경로.
4. spec 4절과 다르게 구현한 부분이 있으면 항목별로 "무엇을·왜". 없으면 "없음".
5. 사용자가 실기기·실제 PDF로 P1~P11을 돌릴 때의 절차를 5줄 이내로(어느 URL을 열고, 무엇을 보고, 무엇이 실패면 어떤 파라미터를 만지는지).
6. 다음 단계(19절 2번: db·hash·pdf/loader·pdf/extract)에 넘길 주의사항 3개 이내.
