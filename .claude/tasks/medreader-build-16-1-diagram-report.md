# Build 보고서 — 16-1 개념도: 요청 · 검증 · 배치 (화면 없음)

- 지침: `.claude/tasks/medreader-build-16-1-diagram.md` · 설계: spec **17-14** (1 · 2 · 3 · 5 표 16-1 행 · 6 · 7 "16-1" · 8 권장안 16-D2·D3·D4·D5·D8)
- 커밋하지 않음. 진짜 키·진짜 Gemini 요청 0(가짜 provider·흉내 Gemini 만 — 하네스 `realFetch` 0). 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b16-1\`
- DB 3 · 기존 판본(`PROMPT_VERSION` 3 · TERM/SUMMARY/OUTLINE/EXPLAIN/QUIZ 1) 불변 · 새 `DIAGRAM_PROMPT_VERSION = 1`. **새 호출은 `diagram()` 을 부를 때만** — 앱 `js/` 어디에도 `.diagram(` 부름 0(시험 D10).
- 입력은 **저장한 개요의 `points` 만**(원문·범위 이름·책 제목·개요 제목 0). 백그라운드 작업 띄운 것 없음.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/diagram.js` (새, 순수 약 620줄 — 머리말·주석 포함) | `outlineText`(경로 꼬리표 줄 · 깊이 2/3) · `checkDiagram`(숫자 토큰 주입) · `wrapLabel` · `crossings`(꺾은선 기하 교차) · `layoutDiagram`(고리 끊기 → 가장 긴 경로 층 → 경유점 → 무게중심 4번 → 줄바꿈 → 좌표·접기 → 가운데·라벨 비킴 → RTL 거울) · `RELS` · `FEW_RELATIONS`. import = `config`·`text/summary`(`clean`·`charCount`·`hasForeignNumber`)만 |
| `js/ai/prompts.js` (+129) | `DIAGRAM_PROMPT_VERSION` · `DIAGRAM_RELS` · `DIAGRAM_SCHEMA`/`_SAME`(요청 — 관계 `enum` 8개, '치료' 없음) · `DIAGRAM_PARSE_SCHEMA`(해석 — enum·항목 필수 없음) · `diagramInstruction` · `diagramPayload` · `buildDiagramRequest` · `checkDiagramReply`(= `checkDiagram` + `numberTokens`) |
| `js/ai/pipeline.js` (+91) | `FAIL.FEW_RELATIONS` · `DIAGRAM_JOB`(runJob 위 — 최대 1호출, `tailOf` 개요 꼴) · `diagram(outline, {target, src, docId, domain, force, retry, signal})` |
| `js/ai/provider.js` (+2) | `bumpUsage` 가 `AI.DIAGRAM_KIND` 도 받음(`USAGE_KINDS` 밖 — 7a 빈 행 무변) |
| `js/config.js` (+34) | `AI.DIAGRAM_KIND = 'diagram'` · `DIAGRAM`(12·16·2 · RELS · 60/120자 · INPUT_MAX 4,000 · OUT_TOKENS 1,500 · PROMPT_VERSION 1 · `LAYOUT` 배치 상수) |
| `index.html` | stamp(모듈 104개) |
| `tests/diagram-16.test.mjs`(새 13개) · `tests/fixtures/diagram-graphs-16.mjs`(새 — 합성 그래프 10개) | 아래 |
| `spec.md` | 17-14 2 끝에 `[정정 2026-11-17 — 16-1 Build]` 한 줄(①–⑦) |

`ui/*`·`notes/*`·`db.js`·`backup/*`·`text/backup.js`·`speaker.js`·`voice/*`·review.md·`dev/` 0.

## 2. 수용 기준 "16-1"

| 기준 | 결과 | 시험 |
|---|---|---|
| `checkDiagram`: 경로 밖 `p` → 버림 · 없는 노드를 가리키는 엣지 버림 · 자기 고리 버림 · `r:'treat'` 버림 · 13노드 → 12(엣지 적은 것부터, 동점은 뒤 것) · 입력 밖 숫자 라벨 버림 · 엣지 1개 남음 → failed(`few-relations`) | 통과 | D2 · D2b |
| `layoutDiagram`: 같은 입력 두 번 → 깊은 같음 · 고리 A→B→C→A → 끝남, 한 엣지 `rev` · 사슬 5 → 층 5 · 두 층 건너는 엣지에 경유점 · 표본 교차 ≤ 기준값 · `maxW 320` 에서 행 폭 ≤ 320(접힘) · `rtl` → 모든 x 거울(`x+w` 대칭, 점·라벨 포함) · 노드 겹침 0 | 통과 | D4 · D4b · D5 |
| `wrapLabel`: 3줄 넘으면 … · 긴 낱말 하나는 자름 · 아랍어(가짜 measure — 하라카트 폭 0, 글자 묶음 단위)도 같은 규칙 | 통과 | D3 |
| 요청: 규칙 1–6 글자 그대로(`commonSystem(true, domain)` — HEAD 와 같음) · 입력에 원문 문단 글 0(개요 요점 줄만) · 4,000자 넘으면 3단 뺌 → 그래도 넘으면 보내지 않음 · `byKind.diagram` +1 · 번역 요청 바이트 불변 | 통과 | D6 · D7 · D8 · D9 |
| 가짜 provider: 1호출 · 같은 입력 0호출(`cacheHits`) · 429 → exhausted, 다시 불러도 0 · capped·no-key → fetch 0 · `few-relations` 캐시 0(실패 기억 — `retry`/`force` 로만) · 잘린 응답 → MISSING | 통과 | D7 · D7b |

## 3. 변이 → 빨강 → 복원 (읽어서 쓰기 + `cmp`, 백업 `b16-1/bak/diagram.js`, `b16-1/mutall.mjs`)

| # | 변이 | 결과 | 빨간 시험 | 복원 |
|---|---|---|---|---|
| 1 | 고리 끊기 지우기(`rev` 안 세움) | 빨강 — **시간 초과**(워커 8초 상한, 파일 전체 8.4초에 끝남 · 다른 시험은 통과) | D5 | 같음 |
| 2 | RTL 거울 지우기 | 빨강 | D4 · D5 | 같음 |
| 3 | enum 검사 지우기 | 빨강 | D2 · D7b(해석 스키마에 enum 이 없어 `treat` 가 파이프라인 끝까지 와서 ready 가 됨 — 해석 스키마를 따로 둔 까닭) | 같음 |
| 4 | 숫자 거름 지우기 | 빨강 | D2 · D2b | 같음 |
| 5 | (고름) 노드 경로 `p` 검사 지우기 | 빨강 | D2 · D2b | 같음 |

고리 배치는 시험에서 **워커 스레드**로만 돌린다(`layoutInWorker` — 끝나지 않으면 워커를 끊고 그 시험만 실패, 그 시험만 `timeout: 30000`). 본 스레드의 배치 시험은 고리 없는 그래프만.
마지막 변이 묶음은 diagram.js 의 마지막 판(아래 7 의 보이지 않는 글자 고침 뒤)으로 다시 돌린 결과다. 각 복원 뒤 `cmp` 0.

## 4. 배치 품질 표 (합성 10개 · 글자 7px · `b16-1/quality.mjs`)

| 그래프 | 노드·엣지 | 층 | 교차(접지 않음) | 교차(320) | 폭 ∞ → 320 | 접힌 층 | 겹침 ∞/320 | RTL 거울 | 결정성 | 경유점 | rev |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 사슬 5 | 5·4 | 5 | 0 | 0 | 144 → 144 | 0 | 0/0 | 예 | 예 | 0 | 0 |
| 나무 10 | 10·9 | 3 | 0 | 5 | 743 → 280 | 2 | 0/0 | 예 | 예 | 0 | 0 |
| 고리 3 | 3·3 | 3 | 0 | 0 | 156 → 156 | 0 | 0/0 | 예 | 예 | 1 | 1 |
| 고리 + 꼬리 | 5·5 | 5 | 0 | 0 | 144 → 144 | 0 | 0/0 | 예 | 예 | 1 | 1 |
| 두 층 건너기 | 4·5 | 4 | 0 | 0 | 156 → 156 | 0 | 0/0 | 예 | 예 | 3 | 0 |
| 엣지 없는 노드(3+3) | 6·2 | 3(관련 층 1) | 0 | 0 | 378 → 275 | 1 | 0/0 | 예 | 예 | 0 | 0 |
| 12노드 16엣지 꽉 참 | 12·16 | 7 | 0 | 4 | 429 → 265 | 2 | 0/0 | 예 | 예 | 7 | 0 |
| 마름모 | 4·4 | 3 | 0 | 0 | 219 → 219 | 0 | 0/0 | 예 | 예 | 0 | 0 |
| 엇갈린 두 줄(입력 순서면 교차 6) | 8·5 | 2 | 0 | 0 | 516 → 288 | 2 | 0/0 | 예 | 예 | 0 | 0 |
| 섞임(고리·양방향·건너기) | 12·16 | 7 | 1 | 4 | 334 → 287 | 1 | 0/0 | 예 | 예 | 6 | 3 |

- 접지 않은 배치의 교차는 기준값(사슬·나무·…·0, 섞임 1)으로 시험 D4·D5 에 박았다. 모든 그림 폭 ≤ 320, 노드 상자 ≤ 140px, 노드는 그림 안.
- 접으면 교차가 는다(나무 5 · 꽉 참 4 · 섞임 4): 접힌 둘째 줄 노드로 가는 선이 첫 줄 사이를 지난다 — 아래 남은 문제 1.

## 5. 입력 크기 (저장 개요 꼴 합성 3단 — 위 8 · 아래 4 · 그 아래 3 = 136줄)

- 한 줄 60·60·40자: 3단 전부 **7,364자 > 4,000** → 2단 **2,652자**로 1호출(요청 system+user 4,728자, 토큰 상한 안) — DOC 에 3단 경로 0 (시험 D8)
- 한 줄 110·110·40자: 2단도 **4,703자 > 4,000** → `too-big`, 호출 0 · `ai.maxReqChars` 1,000 이면 60자 개요도 `too-big`
- 숫자 거름 기준 = **보낸** 줄: 3단을 뺐으면 3단에만 있던 숫자(`30%`)·경로(`1.1.1`)는 입력 밖(D2b)

## 6. 호출 · 바이트

- 가짜 provider(D7): 1호출 · 같은 입력 0호출 · 대상·원문 언어가 다르면 다른 키(`'l=' + 대상(+원문)`) · 429·capped·no-key 막힘 · `byKind.diagram` +1 · `USAGE_KINDS` 6키·빈 행 그대로
- **번역·낭독·단어·요약·개요·설명·출제 요청 본문 바이트 = HEAD**: rbody 하네스(`b16-1/rbody.mjs` — r15-1 것을 본떠 새로 씀, HEAD 는 `git archive` 사본 `b16-1/head`) 8조합 × 9 = **66건 모두 같음**, 같은 파이프라인에서 `diagram()` 을 먼저 불러도 같음. `commonSystem` 4가지 domain 모두 HEAD 와 같고 개념도 system 도 그것. 시험 D9 에 HEAD 판 sha256 다섯(번역·요약·개요·설명·출제)을 박음

## 7. 그 밖 점검

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 2,028 / 2,028 통과 · 실패 0**(각 약 13.3·13.5초)
- stamp 단독 실행 → `--check` "그대로다"(모듈 104) · `git diff --check` 0
- 순수 grep: `text/diagram.js` 에 `Date|document|window|globalThis|navigator|indexedDB|IDBKeyRange|fetch|localStorage|sessionStorage|performance|setTimeout|crypto|random` 0(주석 포함) — 시험 D10 도 같은 검사 + import 고정 + 숫자 토큰 새로 짜지 않음
- 쓴·고친 파일 7개의 NUL·CR·U+2028·U+2029·U+FEFF·NBSP 수 = HEAD(새 파일 0), 보이지 않는 글자(`\p{Cf}` 등) 0. **Write 도구가 `\u200C\u200D`·`\u0600-\u06FF` 이스케이프를 실제 글자로 바꿔 넣은 것을 찾아 고쳤다**(ZWNJ·ZWJ → `String.fromCharCode` 로 만듦, 시험의 아랍어 범위 → `\p{Script=Arabic}`). 부호·단위 기호(`− – — ٪ ٫ ٬`)는 보이는 글자로 두고 코드포인트를 주석에 적었다.

## 8. 설계와 달라진 점 (spec 정정 줄 ①–⑦)

1. 개요 제목·범위 이름 보내지 않음(DOC = `points` 경로 줄뿐), `title` 은 모델이 짓고 숫자 거름.
2. TASK 에 관계 고정 목록 줄 — 방향 a → b 를 위 → 아래(`part`·`type`·`sign`·`test` 는 b 가 a 의 부분·종류·소견·검사). 원어 문장은 원문 언어 이름이 있고 대상과 다를 때만.
3. 키 `extra` = `'l=' + 대상(+원문)`.
4. 요청 스키마 enum 강제(+`format:'enum'`), 해석 스키마는 enum 없음(버림을 `checkDiagram` 이 셈).
5. `checkDiagram` 은 `text/diagram.js`(숫자 토큰 주입) — 파이프라인은 `prompts` 의 `checkDiagramReply`·`diagramPayload` 로. 숫자 거름 = `numberTokens` 값 ⊆ **그리고** 부호·단위 꼴 ⊆(15-1R 교훈 — `< 135`→`135`, `30%`→`30`, `−135` 모두 버림; 범위·이름 대시는 부호 아님). `grounding.js` 의 `numberSpans` 는 내보내지 않고(범위 밖 파일) `text/` 는 `ai/` 를 import 하지 않아 같은 결의 작은 판을 새로 둠.
6. `FAIL.FEW_RELATIONS` · 잘린 응답 MISSING · `diagram()` 반환에 `depth·chars·basis·target·provider·model·promptVersion·key`.
7. 배치: `NODE_MAX_W` = 상자 폭(글 폭 124) · 훑기 4번(아래·위 번갈아, 교차가 0 이면 멈춤) · 접기는 필요한 만큼 여러 줄 · `pts` 위 → 아래(`rev` 면 화살촉 첫 점 쪽) · 라벨 위·아래 ±3번 비킴.

## 9. 남은 문제 · 16-2 · 실기기 확인 거리

1. **접힌 행의 교차** — 360px 에서 한 층 노드가 3개를 넘으면 둘째 줄로 접혀 교차가 는다(나무 0→5). 접힘 순서는 무게중심 순서를 그대로 잘라 쓴다. 16-2 에서 `[크게]`(접지 않음 + 그릇 안 스크롤)와 함께 보면 될 것 — 접힘 때 줄마다 다시 훑기는 이번엔 안 함.
2. **엣지 라벨 겹침** — 라벨은 노드·앞 라벨과 겹치면 위·아래로 비키지만 7자리를 다 써도 겹치면 그대로 둔다(품질 표에 라벨 겹침 열은 없음). 관계 이름 글자 폭은 `labelOf` 로 16-2 가 대상 언어 문구를 넘겨야 맞다.
3. **숫자 거름의 엄격함** — 개요가 `< 135` 인데 모델이 라벨에 `135` 만 쓰면 버린다(부호 지움). 실제 Gemini 에서 노드가 몇 개 남는지 — 10 [M] "노드가 몇 개 남는가" 묶음.
4. **[M] 입력 크기 실측** — 실제 11c 저장 개요(CMDT 장)의 3단 DOC 가 4,000자를 얼마나 넘는지, 2단으로 내려가는 비율은 재지 않았다(합성만).
5. `measure` 는 시험에서 글자 수 × 7px. 브라우저 `measureText` 와 실제 SVG 그리기 폭 차(특히 아랍어 결합)는 16-2·실기기(GT 7) 몫.
6. 고리 끊기는 DFS 입력 순서라 노드 순서가 바뀌면 다른 엣지가 `rev` 가 된다(결정적이지만 "의미상 되먹임" 을 고르지는 않음).
7. 16-2 몫: `notes/summaries.saveOutline` 의 `diagram` 필드(16-D6) · `ui/usage.js` 종류 이름(`diagram`) · i18n `diagram.rel.*` 8개 · `FEW_RELATIONS` 문구 "이 개요에서 관계를 찾지 못했습니다".
