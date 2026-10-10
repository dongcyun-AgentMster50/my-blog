# Build 보고서 — 공개 전 묶음 P1 (저장 경합 · 원본 해상도 · 키 형식·가리기)

> Build 서브에이전트(P1). 커밋하지 않았다. 실제 키를 넣지 않았다(가짜 키는 실행 중에 이어 붙여 만들었다).
> P2 파일(`js/text/*`·`config.js` 의 `LAYOUT`·`review6.test.mjs`)은 건드리지 않았다.

## 결과 요약

| 항목 | 결과 |
|---|---|
| ① documents 경합 | `db.patch(store, key, partial|fn)` — 한 readwrite 트랜잭션에서 읽고 → 자기 필드만 합쳐 → 쓴다. 다섯 곳 + 7c 원문 언어를 이 도우미로 통일. `DB_VERSION` 2 그대로 |
| ② 원본 캔버스 해상도 | `DPR_MAX` 삭제 → `MAX_CANVAS_PIXELS 8,388,608`·`MAX_CANVAS_SIDE 4096` 예산. Nour 조건(CMDT 66%·dpr 3) 비율 **3**, 3.0× 는 **1.582**(8.385MP). 표 크롭도 같은 예산 |
| ③ 키 형식·가리기 | 형식 검사와 지우개가 **같은 상수(`KEY_SHAPES`)**에서 나온다. 신형 몸통 = 출력 가능 ASCII − 따옴표·꺾쇠·백틱. `redact` 가 **저장된 실제 키**를 늘 함께 지운다(공급자 방식) — `ProviderError` 포함. 경고 옆 진단 한 줄(길이·낯선 시작·보통 밖 글자 종류×개수) |
| 테스트 | 시작 882 → **930**(P1 새 테스트 37 + P2 11). 순차 3회 이상 전부 통과, 간헐 실패 0 |
| 변이 | 6종 전부 빨강(아래) |
| 브라우저 | 설정 회귀·원본 해상도(가짜 PDF)·B3·실제 IndexedDB 경합 재현 확인, MedReader 콘솔 오류 0. 가짜 데이터·키 삭제, 뷰포트 desktop |

## ① documents 부분 갱신

### 도우미 — `js/db.js` `patch(storeName, key, change)`
- `change` 가 객체면 그 필드만 얕게 덮고, 함수면 **트랜잭션 안에서 읽은 현재 레코드**를 받아 덮을 필드를 돌려준다. `null`·빈 객체면 쓰지 않는다.
- 레코드가 없으면 쓰지 않는다(지워진 문서를 되살리지 않는다). 함수가 던지면 트랜잭션을 되돌리고 던진다.
- 돌려주는 값 `{wrote, rec}` — `rec` 는 합친 전체 레코드.

### 필드 주인 표

| 곳 | 파일 | 자기 필드 |
|---|---|---|
| `Extractor._saveMeta` | `pdf/extract.js` | `extraction` |
| `saveLastPage` → `writeLastPage`(export) | `ui/reader.js` | `lastPage`·`lastLineId`(같으면 안 씀) |
| 퀴즈 색인 저장 `saveSectionIndex`(export) | `ui/quiz.js` | `sectionIndex` |
| 색인 완료 표시 `markSectionIndexDone`(export) | `ui/quiz.js` | `sectionIndexDone`·`sectionIndexVersion` |
| `openDoc` → `touchOnOpen`(export) | `ui/library.js` | `pageCount`(실제와 다를 때)·`lastOpenedAt` |
| 가져오기 중복 경로 → `touchDuplicate`(export) | `ui/library.js` | `pageCount`(비었을 때만)·`lastOpenedAt` |
| 7c `updateDocLang`(통일) | `ui/library.js` | `lang`·`langSource`·`langGuess` |

남은 documents 통째 쓰기: 새 문서 만들기 1곳, `touchDuplicate` 에서 "찾은 레코드가 그사이 사라졌을 때" 되살리기 1곳(덮을 남의 필드가 없다). `DP12` 가 grep 으로 고정.

### 동작 변화(의도)
- `openDoc` 이 Blob 읽기·PDF 파싱 사이에 문서가 지워졌으면 `null` 을 돌려준다(예전에는 통째 쓰기가 지운 문서를 되살렸다).
- `saveLastPage` 는 `state.docId` 가 그대로일 때만 `state.doc` 을 바꾼다(다른 문서로 옮겨 간 뒤 옛 문서로 덮던 것 방지).
- `showReader` 의 늦은 읽기(review 7c8-5 "리더 쪽 증상" — 그 세션에만 옛 `lang` 으로 그림)는 `reader.js` 의 `saveLastPage` 밖이라 **고치지 않았다**. DB 에는 더 이상 남지 않는다.

### 테스트 — `tests/docs-patch-p1.test.mjs`(14) + `tests/fixtures/fake-idb.mjs`
- Node 에 IndexedDB 가 없어 **최소 흉내**를 만들었다(범위가 겹치는 readwrite 직렬화, 자동 커밋, 커밋 뒤 요청은 `TransactionInactiveError`, abort 되돌리기). 7c8-5 장치 그대로: `documents` 읽기 전용 트랜잭션의 `oncomplete` 를 늦춘다(150ms).
- 각 곳: 모든 필드에 표지 → 그 곳이 쓰는 동안 **그 곳 몫이 아닌 필드 전부**를 바꾸는 쓰기가 끼어듦 → 남의 필드는 끼어든 값이어야 한다.
- 고치기 전 빨강: 원래 코드 복사본에서 DP2~DP12 빨강. `_saveMeta`(DP5)는 실제로 "남의 필드 title 를 옛 값으로 덮었다". 나머지는 export 가 없어 빨강 → 의미상 빨강은 변이 M1 이 보인다.
- DP1 은 장치가 실제로 경합을 만드는지(옛 get→put 꼴이 끼어든 언어를 되돌림) 고정한다.

### 브라우저(실제 IndexedDB, 7c8-5 장치 3초)
낡은 읽기를 걸어 둔 채 `writeLastPage`·`touchOnOpen` 실행 → 서재 카드 [⋯] 한국어 클릭(위임 경로) → 3초 뒤 낡은 읽기 완료. 최종 `ko/user`·`lastLineId` 유지(덮임 0). 새 PDF 가져오기에서 `extraction`(patch)·자동 추정 `langSource:auto`(통일된 updateDocLang) 정상.

## ② 원본 캔버스 해상도

- `render.canvasRatio(dpr, cssW, cssH) = max(1, min(dpr, √(MAX_CANVAS_PIXELS/(cssW×cssH)), 4096/cssW, 4096/cssH))`. 크기를 모르면 dpr 그대로. `renderPageInto` 가 CSS 크기를 먼저 구해 넘긴다. `original.js` 는 바꿀 것이 없었다(배선이 `renderPageInto` 안에 있다).
- 표 크롭(4-8): 해상도 규칙(`cropScale = min(3, 2×dpr)`)은 **그대로** — 절대 배율이고 리플로우 폭에 맞춰 보이므로 충분(480pt 표: 1440px ≥ 360×3). 다만 크롭은 **쪽 전체**를 그린 뒤 자르므로 그 캔버스에 같은 예산을 건다(`cropRenderScale`). CMDT·Letter 쪽은 3 그대로, A3 같은 큰 쪽만 깎인다.
- 테스트 `tests/canvas-budget-p1.test.mjs`(9): 가짜 pdf.js 쪽으로 `renderPageInto` 를 그대로 돌림 — 341×475@dpr3 → 비율 3, 1551×2160 → 2454×3417(8,385,318px ≤ 예산), spec 12-5 수치, 하한 1, `DPR_MAX` 부재, 크롭.
- 브라우저(가짜 PDF 517×720pt, dpr 3 덮어씀, 실제 pdf.js): 66% 직접 렌더 1023×1425 = **3.000**, 폭 맞춤 736px → 3, 3.0× → **1.582**(8.385MP), 0.8× → 3. 375×812 + 띠 켬: 원본 상자 아래변 554.52 ≤ 띠 윗변 554.54 — **B3 그대로**, 가로 스크롤 0.

## ③ 키 형식 경고 · 키 가리기

- (가) `config.js` `KEY_SHAPES.GOOGLE_AQ = 'AQ\.[\x21\x23-\x26\x28-\x3B\x3D\x3F-\x5F\x61-\x7E]{20,}'` — `AI_KEY_PATTERNS.gemini` 와 `REDACT_PATTERNS` 둘 다 이 상수에서 만든다. spec 의 `[\x21-\x7E]` 에서 `" ' \` < >` 만 뺐다(지침 "공백·따옴표·꺾쇠에서 끊김" — 두 벌 금지라 형식 검사도 같은 집합).
- (나) `redact.js` 에 `setSecretSource(fn)`(공급자 주입 — 이 파일은 여전히 저장소를 모름). `provider.js` 가 `keys.readKeySecret` 으로 만든 공급자를 꽂는다 → **모든** `redact`·`redactString` 호출이 저장된 실제 키도 지운다. 실제 키 값은 패턴보다 **먼저**, 긴 것부터, 앞뒤 공백 뗀 꼴도 함께. `ProviderError` 생성자는 `info.keys`(이 호출에 쓴 키)도 받는다(오류 객체에 달지 않음). `complete`·`wrap`·`assertNoKeyInUrl`·SAFETY 경로가 넘긴다.
- (다) `provider.diagnoseKey(key)` → `{length, knownHead, odd:[{label,count}]}` — 위치·보통 글자 없음, ASCII 밖은 `U+200B` 꼴. 설정 화면이 경고 옆에 한 줄로 그린다("Details (the key itself is not shown): length 29 · unusual characters: U+200B×1", 목록은 `bdi dir=ltr`). 문구 키 5개 × 네 언어. 경고 칸의 정적 `data-i18n` 은 init 에서 뗐다(index.html 은 고치지 않음).
- 테스트 `tests/key-shape-p1.test.mjs`(14): `.`·`~`·`+`·`/`·`=`·섞음 가짜 키 → 경고 없음, 패턴만으로 8글자 조각까지 0(문장·JSON·HTML·따옴표 안), `ProviderError.message`·`toJSON`·`complete` 400 되비춤·fetch 예외·usage 행·`verifyKey`·`runVerify`·`runTestTranslation` 결과·console 어디에도 조각 0. 20자 하한("AQ.1 level" 등 4문장 그대로). 패턴이 못 잡는 모양(몸통에 따옴표·완전히 다른 모양)은 저장된 키 그물이 잡음.
- 브라우저: 점 든 키 경고 없음 / U+200B 키 경고+진단(아랍어 UI 에서도, `bdi ltr`) / `sk-` 모양 "낯선 시작". 가짜 키 저장 → [검증] "The key works." · [시험 번역] 두 블록 `ar/rtl`(bdi 1)·`ko/ltr`, 드롭다운 2개(aiProvider·aiModel). 요청 URL·DOM·localStorage 의 키 조각 0.

### 실제 키를 알 수 없는 가리기 경로(패턴만 걸림)
1. `js/main.js:289` `console.error('[medreader] boot failed', e)` — **지우개를 아예 안 거친다**(범위 밖 파일). `redact(e)` 로 감싸기를 권한다.
2. 어댑터가 없는 프로바이더(openai·mistral·openrouter) 키 — 공급자는 `ADAPTERS` 만 돈다. `sk-`·`Bearer` 패턴뿐.
3. 지웠거나 바꾼 **예전** 키 — 저장소에 없으므로 패턴만.
4. 저장 안 된 채 `keys` 를 넘기지 않는 새 호출 경로가 생기면 — 지금은 없음(설정 화면은 `x.key`, provider 는 `key` 를 넘김).
5. 몸통에 `" ' \` < >`·비 ASCII 가 든 키가 1·3 의 경우에 겹치면 그 글자 앞까지만 지워진다.

## 변이 (스크래치패드 `p1/mut/mutate.py` — 찾을 문자열 정확히 1곳 → 표지 `MUT_*` 확인 → 전체 테스트 → 직전 복사본으로 복원 → `cmp`)

| 변이 | 빨강 | 걸린 테스트 |
|---|---:|---|
| M1 `db.patch` 를 get→put 두 트랜잭션으로 | 7 | DP2·DP5·DP6·DP7·DP8·DP9·DP10 |
| M1b `writeLastPage` 만 통째 쓰기로 | 2 | DP6·DP12 |
| M2 픽셀 예산 대신 `min(2, dpr)` 고정 | 7 | CB1·CB2·CB3·CB4·CB5·CB7·R3 |
| M3 신형 패턴을 옛것(`[0-9A-Za-z_\-]`)으로 | 4 | KS2·KS3·KS4·KS9 |
| M4 `ProviderError` 에서 `keys` 빼기 | 1 | KS7 |
| M4b 저장된 키 공급자 등록 빼기 | 3 | KS6·KS8·KS9 |

전부 복원 `cmp` 같음, `grep MUT_` 0건. `git checkout`·`restore`·`stash` 쓰지 않음. (M1 첫 실행에서 DP10 이 살아남아 — 테스트가 지연된 `get` 을 먼저 해 둔 탓 — DP10 을 "미리 읽어 둔 레코드"를 직접 넘기게 고친 뒤 빨강.)

## 바꾼 기존 테스트(이유)
- `tests/render.test.mjs` R3: `canvasRatio(3) === DPR_MAX(2)` → `=== 3`. 고정 상한이 없어졌고 크기를 모르면 dpr 그대로(예산은 CB* 가 고정).
- `tests/redact-7a.test.mjs` "URL 쿼리 … 나머지는 남긴다": 신형 키 몸통이 `&` 를 포함하게 넓어져 신형 키 뒤 쿼리가 함께 지워진다(안전한 방향, 키가 URL 에 실리는 것 자체는 `assertNoKeyInUrl` 이 막음). 키 누출 단언은 그대로 두고, "나머지 보존"은 구형 `AIza` 키로 계속 고정.
- `tests/extract.test.mjs` E28: 소스에서 찾는 표지 `doc.extraction = {` → `_saveMeta` 안의 `extraction: {`(통째 쓰기가 patch 로 바뀜). 키 집합 검사는 그대로, 실제 쓰인 레코드로는 DP5 가 다시 본다.

## 범위·지침 해석
- 지침의 "`js/quiz/*` 중 색인 저장 부분" — 색인 저장 코드는 실제로 `js/ui/quiz.js`(`makeIo.saveIndex`·`ensureSectionIndex` 의 완료 표시)에 있다. `js/quiz/*` 에는 DB 접근이 없다. 지침이 다섯 곳 중 하나로 명시했으므로 `ui/quiz.js` 의 그 두 부분만 고쳤다.
- `ui/library.js` 의 `updateDocLang` 은 "openDoc·가져오기 중복 경로만" 밖이지만, 지침 ①의 "7c 원문 언어 저장과 같은 도우미로 통일할 수 있으면 통일"에 따라 바꿨다.

## 기록만
- **모듈 반쪽 캐시**: 브라우저 첫 로드에서 새 `provider.js` + 캐시된 옛 `redact.js` 조합으로 `Uncaught SyntaxError: … does not provide an export named 'setSecretSource'` 가 한 번 났다(캐시 우회 전, 내 검증 순서 탓). 새로고침 뒤 0. 배포 후 사용자 기기에서도 같은 혼합이 일어날 수 있다(`index.html` 의 `js/main.js` 에 판 번호 쿼리 없음) — 새 export 를 더하는 모든 단계에 해당. 범위 밖.
- 콘솔의 `[ds-level2]` 경고 2줄은 같은 탭에서 앞서 연 다른 앱의 것(7c8-7 과 같음).
- 미리보기 창이 숨김일 때 pdf.js 렌더가 rAF 에 묶여 멈췄다 — 측정 동안 rAF 를 `setTimeout(16ms)` 로 바꿨다가 되돌렸다.
- Bash 차단 훅에 막힌 명령 없음. npm 설치 없음.

## 정리
가짜 PDF 문서(documents·blobs·pages `deleteDocument`), usage·aiCache(시작 때 0) 비움, 가짜 키 `clearKey`(sessionStorage·localStorage 0), `settings` 8행이 시작과 같음(`reader.view=reflow` 등), fetch·rAF·devicePixelRatio 덮어쓰기 해제 후 새로고침, 뷰포트 desktop.

## 바꾼 파일
`js/db.js`, `js/pdf/extract.js`(`_saveMeta`), `js/ui/reader.js`(`saveLastPage`·`writeLastPage`), `js/ui/quiz.js`(색인 저장 두 곳), `js/ui/library.js`(`openDoc`·중복 경로·`updateDocLang`), `js/pdf/render.js`, `js/privacy/redact.js`, `js/ai/provider.js`, `js/ui/settings.js`(형식 경고 배선), `js/config.js`(`ORIGINAL` 끝·`KEY_SHAPES`·`AI_KEY_PATTERNS`·`REDACT_PATTERNS`), `js/i18n/{en,ko,fr,ar}.js`(5키씩), 테스트 새 파일 3 + 픽스처 1, 기존 테스트 3.
