# Build 보고서 — 16-2 개념도: 그리기 · 화면 (+ 16-1R 고침)

- 지침: `.claude/tasks/medreader-build-16-2-diagram-ui.md` · 설계: spec **17-14** 4 · 5 표 16-2 행 · 6 · 7 "16-2" · 8(16-D6–D11 권장안) · 10
- 커밋하지 않음. 진짜 키·진짜 Gemini 요청 0(흉내 Gemini·가짜 provider 만 — 하네스 `realFetch` 0). 서버 띄우기 0(요청 가로채기). 백그라운드 작업 0.
- 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b16-2\`
- DB 3 · 판본 상수 불변(`PROMPT_VERSION` 3 · TERM/SUMMARY/OUTLINE/EXPLAIN/QUIZ/DIAGRAM 1) · 다른 요청 본문 바이트 = HEAD. **새 호출은 [개념도 그리기]·[다시 그리기](먼저 묻는다)를 누를 때만**, 자동 0.

## 0. 먼저 고친 것 — 16-1R

### 0-1. 중간-1 — 라벨 숫자 판정을 15 "숫자 표현 덩어리" 한 벌로

| 무엇 | 어떻게 |
|---|---|
| 새 순수 `js/text/numexpr.js` | `grounding.js` 의 `numberSpans`(+ 상수 `NUM_SEP`·`NUM_JOIN`·`THIN_SEP`·`EXP_SIGN`·`SUP_MINUS`·`SUP`·`SIGN`·`UNIT`)를 **그대로 옮김**. import 0. 기본 갈래 = 15 그대로 |
| `wide` 갈래(개념도만) | 비교 기호 `< > ≤ ≥ ± ≈ ~ ～ 〜` 는 글자 바로 뒤에서도 붙임(`나트륨<135`·`pH<7.2`) · 앞 부호 **둘까지**(`≤ −2.5`) · 앞 덩어리 글자는 넘보지 않음. 대시·`+` 는 글자 뒤에 붙이지 않음(`IL-6`) |
| `chunkKey` 비교 꼴 | 공백·NBSP·서식 글자 지움 · 모든 `\p{Nd}` → 서방 숫자 · 위첨자 지수 → `^`(`10⁹` = `10^9`, `10⁻⁶` = `10^-6`) · 대시·빼기 → `-` · `≈～〜` → `~` · `٪٫٬` → `%.,` · `x` → `×` · 천 단위 쉼표 지움. 부호·비교·이음·단위 기호는 남김 |
| `text/diagram.js` | `numberMarks` 지움 → `numberChunks(라벨)` 의 덩어리 **각각이** `numberChunks(보낸 개요 글)` 집합 안이어야 통과. 값 ⊆ 검사(`hasForeignNumber`)도 그대로 둠 |
| `ai/grounding.js` | 옮긴 줄만 지우고 `import { numberSpans } from '../text/numexpr.js'`(줄 번호 스크립트 `b16-2/movespans.mjs` — Edit 이스케이프 사고를 피함) |
| `ai/prompts.js` | 손대지 않음(시작 때와 `cmp` 같음) |

- **옮김 회귀 0**: 15 하네스 7개 사본(`b16-2/h15/` — `r15-1/ground` · `r15-2/ground2` · `r15-2b/bound` · `b15-2c/bound2` · `r15-2c/forms`·`forms2`·`forms3`)의 출력이 옮기기 전(`h15/before/`)과 **바이트 같음**(`diff -r` 0 — safety 만 다름, 아래). `grounding-15` 시험 전부 통과(Q9 의 import 허용 목록에 `'../text/numexpr.js'` 한 줄만 더함 — 옮긴 결과라 피할 수 없음).
- **safety 표(16-1R `r16-1/safety.mjs` 42꼴 사본, `h15/cmpsafety.mjs`)**: 바뀐 꼴 18 = "16 통과·15 버림" **14꼴 모두 버림**(범위 붙음·공백·%·물결·전각 물결·비율·× · ×위첨자 · 음수 지수 둘 · `±` 둘) + 비교 기호 뒤집힘·지움 **4꼴 모두 버림**(`나트륨<135`→`>135` · `pH<7.2`→`>7.2` · `≤ −2.5`→`≥ −2.5` · `≤ −2.5`→`−2.5`). 나머지 24꼴 무변 — 정당 꼴 7개(`< 135` · `30 %` · `3-5` · `1:1000` · `10^9`↔`10⁹` · `150000` · `٣٠٪`) 통과 그대로, "맞게 버림" 그대로. 정당 꼴이 깨진 것 0. 관계 `r` 표·라벨 낱말 표 바이트 같음.
  - 그대로 둔 "16=15 너그러움" 2꼴: NBSP 천 단위 `150 000`→`150`(15-2eR #2 결정 — 저장 때 NBSP 가 접힘) · 다른 줄 숫자 옮김(설계 — 숫자 ⊆ 개요 전체).
- 시험 **D2c**(새, `diagram-16`): 버림 25꼴 · 통과 15꼴 단언 + `numberSpans` 기본 갈래 무변 / `wide` 갈래 · `numberChunks` · `chunkKey`. D10: `text/diagram.js` import 에 `./numexpr.js` · numexpr 순수·import 0 · grounding 이 그것을 import · 두 파일에 덩어리 판정을 새로 짜지 않음.
- 변이 **R1(덩어리 비교 지움) · R2(비교 기호 무시)** → D2·D2c 빨강 · 복원 `cmp` 같음.

### 0-2. 낮음 2·3·5 (이 단계 그리기에서) · 4·6(기록만)
- 낮음-2: 층 순서 **선 → 노드 → 라벨**(노드 상자 칠이 지나는 선을 가림 — 시험 G3).
- 낮음-3: viewBox 에 **엣지 라벨 상자까지** 넣음(`viewBoxOf` — 16-1R 의 W 86 고리 꼴 단언 · 표본 7그래프 × 접힘 3 × RTL 2 = 42판 모두 안 — G2).
- 낮음-5: `diagram()` 에는 **개요 레코드의 `target`** 만(흐름 `run` — 시험 G5 · headless: 대상 언어 설정이 ar 여도 ko 개요 다시 그리기 TASK = "outline (in Korean)").
- 낮음-4(라벨 출처 낱말 검사 없음)·6(큰 장 2단): spec 정정 ⑧ 에 10 [M] 거리로만 적음.

## 1. 바꾼 파일 (16-2)

| 파일 | 무엇 |
|---|---|
| `js/ui/diagram.js`(새, 847줄 — 주석 포함. 설계 추정 약 260) | 1절 순수(`relLabelsFor` 대상 언어 사전 · `graphOf` 다시 거름 · `isStale` · `diagramField` · `fitScale`·`zoomNeeded` 12px · `edgeBoxes`·`viewBoxOf` · `relationLines` · `exportName`) / 2절 흐름 `createDiagramFlow`(open·draw·askRedraw·redraw(force)·retry·close — 늦은 결과는 저장하되 화면은 그대로) / 3절 그리기 `renderDiagram`(createElementNS 만) · `renderAlt`(글로 보기) · `browserMeasure`(캔버스 measureText — `--font-ui`/`--font-ar` + 13·12·12px) / 4절 시트(`#dgSheet` 지연 초기화 · Esc · Tab 가둠 · 주소 바뀌면 닫힘 · resize/visualViewport 다시 배치 0호출) · `diagramControl`(작은 그림 / [개념도 그리기]) · `svgFileText`(계산된 색 박기 + XMLSerializer) · 측정 훅 |
| `js/notes/summaries.js` | `saveDiagram(id, field)`(개요만 · `updatedAt` 새로) · `saveOutline` 대체 저장 때 `diagram` 잇기(`upsert` 의 `carry`) |
| `js/ui/summaries.js` | 저장한 개요 줄 몸통 머리에 `diagramControl`(원문 언어 = `docLangOf(doc)` · 저장 뒤 `load()`) |
| `js/ui/review.js` | 개요 칸(저장 개요 있을 때)에 `diagramControl` · 저장 뒤 다시 모음 · 15-2 의 "16 아직 없음" 주석 정리 |
| `js/ui/usage.js` | `SHOW_KINDS` 에 `AI.DIAGRAM_KIND`(설명과 같은 꼴 — 늘 보임) |
| `index.html` | 시트 그릇 `#dgSheet`(화면 밖 한 그릇 — 머리·상태·바뀜 줄·물음·그림 그릇·단추 줄·고지·글로 보기) · stamp(모듈 106) |
| `css/screens.css` | 16-2 절(시트 높이 식 · 그림 토큰 색 · 고대비·forced-colors · 그릇 안 스크롤 · 글로 보기 · 작은 그림 · 48px · 논리 속성만) |
| i18n 4개 | `diagram.*` 20키 + 관계 이름 8(`diagram.rel.*`) + `usage.kind.diagram` = 29키 · ar/fr `[검토 — Nour·운영자]` 표시 |
| `tests/diagram-ui-16.test.mjs`(새 7개) | G1–G7(아래) |
| 고친 시험 | `diagram-16`(D2c 새 · D10 import·호출 자리) · `grounding-15` Q9(import 목록 한 줄) · `review-ui-15` V9("16 칸 없음" 가드 → "조각 하나·파이프라인 직접 부름 0") · `usage-8c` U1(늘 보이는 종류에 diagram 0) |
| `spec.md` | 17-14 2 끝 `[정정 2026-11-18 — 16-2 Build]` 한 줄(①–⑧) |

`db.js`·`backup/*`·`text/backup.js`·`speaker.js`·`voice/*`·`selbar.js`·review.md·`dev/`·`main.js` 0.

## 2. 수용 기준 "16-2"

| 기준 | 결과 | 근거 |
|---|---|---|
| 흉내 Gemini: 저장 개요 → [개념도 그리기] → 요청 1건 → 그림(노드·화살표·라벨) + 글로 보기(트리 + 관계 목록) · 닫고 다시 0건 · 레코드에 `diagram` | 통과 | headless A: 1건(diagram 갈래만) · 노드 7·선 7·라벨 7 · 원어 줄 3 · 레코드 `diagram`(basis·target·좌표 없음·updatedAt 오름) · 닫고 작은 그림으로 다시 → 0건 · 같은 요점 다른 개요 → 0건(적중)·저장 · 시험 G5·G6 |
| 접근성: `svg[role=img]` 이름 · 글로 보기 항목 수 = 엣지 수 · 키보드로 [크게]·[글로 보기] 접기 | 통과 | A: role=img · `<title>`·`<desc>` · 글로 보기 7 = 엣지 7(L 48보기 모두 같음) · `#dgZoom` Enter → 크게 · `summary` Enter → 접힘 · Space → 펼침 · G3·G4 |
| 360×740·412×915·915×412 × 4언어(대상 ar·ko): 쪽 가로 넘침 0 · 12px 아래면 [크게] · ar 그림 거울·src 줄 ltr | 통과 | headless L: 12조합 × 대상 2 × 전체 보기/크게 = 48보기 — 넘침 최대 0 · 시트 밖 0 · 48px 미만 0(누를 것 360) · "글자 < 12px 이면 크게" 48/48 · ar 그림 rtl + 원어 줄 모두 ltr · UI ar 에서 html rtl. 크게 = 그릇 안 가로 스크롤(360·412 에서 73–125px), 쪽 넘침 0. 문턱 탐침: 그릇을 170px 로 좁히면 저절로 크게(전체 보기면 3.9px). G1 `zoomNeeded(321,320)` |
| 네 테마 선·글자 대비 · `innerHTML` 0 · SVG 내보내기 파일이 열리고 색이 박힘 | 통과 | L: light·dark·sepia·contrast 모두 — 노드 글 10.0–21 · 원어 5.7–21 · 관계 라벨 11.9–21 · 선·화살촉·노드 테두리 6.9–21 · "개요가 바뀌었습니다" 줄 7.7–16.6. `innerHTML`/`outerHTML`/`insertAdjacentHTML` 새 사용 0(주석뿐) · A 그림 저장: Blob `image/svg+xml` · `var(` 0 · `fill="rgb` 56 · `class=` 0 · DOMParser 로 열림(parsererror 0) · xmlns · title · `<a download>` = `medreader-diagram-20261118.svg` · 요청 0 |
| 개요를 다시 만든 뒤 → "개요가 바뀌었습니다" | 통과 | A: `saveOutline`(새 cacheKey) → 개요 줄 작은 그림 아래 한 줄 + 시트 머리 줄 + 그 줄의 [다시 그리기] · G6(그림은 남고 stale) |
| (호출 표) 열기·크게·글로 보기·회전·RTL·그림 저장 0 · [다시 그리기]는 묻고 1 | 통과 | A: 다시 열기·키보드·회전(915×412 ↔ 412×915) 0 · 저장 0 · 묻기만 0 → 확인 1(force) · L 전체 0 · 전체 요청 4건 모두 개념도(그리기·다시 그리기·ar·few) |
| XSS — 노드 라벨·제목에 `<img onerror>`·`<script>`(흉내 응답) | 통과 | A(ar): `window.__xss` 0 · 시트·작은 그림에 img/script 요소 0 · 라벨이 글자로 보임 · G3(가짜 DOM 이 `innerHTML` 을 쓰면 던짐) |
| few-relations | 통과 | A: 1건 → "이 개요에서 관계를 찾지 못했습니다" + [다시 시도] · 저장 0. **headless 가 잡은 버그**: 흐름이 순수 쪽 까닭 `few-relations` 를 보고 있었는데 파이프라인 코드는 `FAIL.FEW_RELATIONS = 'FEW_RELATIONS'` — `FEW_CODE` 로 고치고 G5 가 두 값이 같은지 잰다 |

## 3. 변이 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `b16-2/bak/mut/`, `b16-2/mut.mjs` · `muts.json`)

| # | 변이 | 결과 | 빨간 시험 |
|---|---|---|---|
| R1 | 라벨 덩어리 비교 지움 | 빨강 | D2 · D2c |
| R2 | 비교 꼴에서 비교 기호 무시 | 빨강 | D2 · D2c |
| U1 | **글로 보기 항목 수** — 관계 목록이 첫 엣지를 뺌 | 빨강 | G1 · G4 |
| U2 | **RTL** — 노드 글 `direction` 늘 ltr | 빨강 | G3 |
| U3 | **12px 문턱** → 11px | 빨강 | G1 |
| U4 | viewBox 가 라벨 상자를 안 봄(낮음-3) | 빨강 | G2 |
| U5 | `diagram()` 에 개요 target 을 넘기지 않음(낮음-5) | 빨강 | G5 · G7 |
| U6 | 개요 다시 저장 때 `diagram` 을 잇지 않음 | 빨강 | G6 |

모두 빨강, 각 복원 뒤 바이트 같음.

## 4. 회귀 · 바이트 · 점검

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 2,036/2,036 · 2,036/2,036**(13.6 · 13.4초 — `b16-2/test-run1.txt`·`test-run2.txt`, 2회차는 변이 복원 뒤).
- 요청 본문 바이트: 16-1R `rbody.mjs` 사본 — 6조합 × 번역·낭독·단어·요약 2·개요·설명·출제 = **48건 모두 HEAD 와 같음**, `diagram()` 을 먼저 불러도 같음 · 판본 상수·기존 스키마 9개 같음 · config 바뀐 키는 16-1 의 `AI.DIAGRAM_KIND`·`DIAGRAM` 뿐. 시험 D9(HEAD sha256) 통과.
- 회귀 headless R: 사용량 화면에 "개념도"(문구 키 그대로 나오지 않음) · 11-3 [개요 만들기] 1건(개요 갈래) → [저장] → 새 개요 줄 머리에 [개념도 그리기](트리 위) · 15 묶음 개요 칸에도 [개념도 그리기] · 요청 그 1건뿐 · 리더 요약 시트와 개념도 시트 겹침 0. 9c: G6 — 병합 put/keep 멱등 · `cleanRecord` 통과 · 내보내기 → 빈 기기 가져오기 → 다시 가져오기 = 같음(`diagram` 필드 왕복).
- stamp 단독 → `--check` "그대로다 (모듈 106개 · CSS 4개)" · `git diff --check` 0.
- 특수 글자(`b16-2/charsvs.mjs`): 고친·새 파일 20개의 NUL·CR·U+2028·U+2029·BOM·NBSP·얇은 공백·좁은 NBSP·ZWNJ·ZWJ·`\p{Cf}`·제어 글자·줄 끝 공백 수 = HEAD(새 파일 0). **사고 1건 잡음**: Write 가 `numexpr.js` 정규식의 이스케이프를 실제 글자로 넣었다(NBSP·얇은 공백·좁은 NBSP 포함) → `b16-2/escfix.mjs` 로 코드 줄만 `\uXXXX` 로 되돌림. 점검 스크립트 첫 판도 같은 사고(U+2028 실제 글자)로 문법 오류 — 코드포인트로 다시 씀.
- headless: Edge · pipe · 새 프로필(`b16-2/pA1–pA6`·`pL1–pL2`·`pR1–pR2`) · 가짜 키 · 흉내 Gemini(OPTIONS 204 + CORS, 개념도 갈래) · 캐시 끔 · 한 번에 하나씩 · 합성 PDF(`b11-2/syn.pdf`) + 저장 개요(심음). 콘솔 오류 0 · 페이지 오류 0 · 바깥 요청 0 · 없는 파일 0 (모든 실행). `pR1` 은 setup 의 PDF 올리기가 리더로 넘어가지 않는 하네스 흔들림(앞 단계들도 기록한 꼴)으로 멈춤 → `pR2` 로 통과.
- 스크린샷 6장(`…\scratchpad\b16-2\shots\`): `a-ko-412-stale.png`(바뀜 줄) · `a-ko-412-review.png`(묶음 칸 작은 그림) · `a-ar-412-sheet.png`(ar · `<img onerror>` 글자 · 원어 줄) · `l-ar-360-ar-zoom.png`(12노드 16엣지 크게 — 그릇 안 스크롤) · `l-en-915-ko-fit.png`(가로) · `l-contrast-412-ko.png`(고대비).
  - 스크린샷으로 잡은 것 1건: "개요가 바뀌었습니다" 줄을 `--c-notice-text`(어두운 고지 띠용 밝은 글자)로 칠해 밝은 테마에서 거의 안 보였다 → `--c-warn-bg`/`--c-warn-text` 로 바꾸고 L 에 대비 측정을 더함(7.7–16.6).

## 5. 설계와 달라진 점 (spec 정정 ①–⑧ 요약)

1. 숫자 판정 = `text/numexpr.js` 한 벌(`wide` 갈래 + `chunkKey`) — 위 0-1.
2. 그림은 받는 즉시 레코드에 붙임(따로 [저장] 없음) · `saveDiagram` 이 `updatedAt` 새로 · 개요 다시 만들어도 `diagram` 잇기 · 닫은 뒤 온 결과도 저장.
3. 시트는 화면 밖 그릇 하나(`#dgSheet`), 주소가 바뀌면 닫힘, [닫기] = 머리 [×]. 높이 식은 11 시트와 같되 `--notice-total` 위.
4. 글자 13·12·12px · 12px 문턱은 가장 작은 글자 기준 · 전체 보기 = 그릇 폭에 접고 줄이기만(넘치면 한 번 더 좁혀) · 크게 = 접지 않고 1:1.
5. 작은 그림 = 같은 그림을 280×140 안으로(`aria-hidden`, 단추 이름 "개념도 보기 — 노드 n · 관계 m").
6. 사용량: `SHOW_KINDS` 에 diagram(늘 보임).
7. few 문구는 `FAIL.FEW_RELATIONS` 로 고름.
8. 10 [M] 더함: 낮음-4 · 낮음-6.

## 6. 남은 문제 · 실기기 확인 거리

1. **전체 보기에서 [크게]가 저절로 켜지는 일은 드물다** — 그릇 폭으로 접어 배치하므로 48보기 중 0(그릇을 170px 로 좁힌 탐침에서만). 12px 미만으로 줄어드는 길은 지켜지지만, 접힘 때문에 교차가 느는 16-1 남은 문제 1 은 그대로다(크게 = 접지 않은 그림으로 볼 수 있다).
2. 선이 노드 상자 **사이**를 지나는 것·엣지 라벨 겹침은 남는다(노드 아래로 지나는 것만 가려짐 — 스크린샷 a-ar-412 의 왼쪽 긴 선). 라벨 비킴 7자리 다 써도 겹치면 그대로(16-1 남은 문제 2).
3. `chunkKey` 는 소수 끝 0 을 접지 않는다(`7.0` ↔ `7` 버림 — 안전 쪽) · 개요가 `10⁻⁶` 인데 라벨이 `10^-6` 이면 기존 값 검사(`numberTokens` 가 위첨자를 못 봄)가 버린다(16-1 과 같음).
4. 시트를 열면 제목에 포커스 고리가 보인다(프로그램 포커스 — 11 요약 시트와 같은 장치). 거슬리면 다듬기 거리.
5. `FEW_CODE` 는 파이프라인 상수를 import 하지 않고 같은 글자로 둠(화면 → 파이프라인 import 0 규칙) — 시험 G5 가 두 값이 같은지 잰다.
6. UI 언어 바꾸기는 다시 부팅해야 html `dir` 이 바뀐다(기존 동작 — 하네스는 다시 부팅).
7. **[M] 실기기**(spec 10 + 더함): 실제 Gemini 로 개요 3개(지어낸 화살표·남는 노드 수 · 라벨 출처 낱말 — 낮음-4) · 실제 11c 개요가 2단으로만 가는 비율(낮음-6) · GT 7 아랍어 `measureText` vs 실제 SVG 폭(잘림·겹침) · [크게]에서 손가락 스크롤 · TalkBack 이 "글로 보기" 목록을 읽는가 · ar/fr 관계 이름 8개와 문구 `[검토 — Nour·운영자]`.

## 7. 하네스 · 규칙

- 스크래치 `b16-2/`: `h15/`(15 하네스 7 + safety + rbody 사본 · `runall.mjs` · `cmpsafety.mjs` · `before/`·`after/`) · `movespans.mjs` · `escfix.mjs` · `chars.mjs` · `charsvs.mjs` · `mut.mjs`·`muts.json`·`mut-*.txt` · `mkcommon.mjs` → `common.mjs`(b15-2 읽기만) · `run-a.mjs` · `run-l.mjs` · `run-r.mjs` · `runtests.mjs` · `dg-css.txt` · `bak/` · `shots/` · `test-run1.txt`·`test-run2.txt`.
- 지킨 것: 명령은 한 호출에 한 가지(`cd &&`·파이프·`;` 0) · 권한 거절 0 · 서버·프로세스 조회·디버깅 포트 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · 진짜 키·요청 0 · 원서 글 0(합성 글만) · 백그라운드 0 · 프로필 복사 0.

## 16-2b — 16-2 Review 고침 (review.md "16-2 Review" · 판정 "고친 뒤 배포")

같은 지침·범위·규칙. 커밋 0 · 진짜 키·요청 0 · 백그라운드 0. 스크래치 `b16-2/b2/`.

### 1. 중간-1 — 라벨 단위 낱말 바뀜·뺌
- `js/text/numexpr.js` 에 `numberChunkUnits(text)` → `{k: chunkKey, u}` 를 더함. `u` = 덩어리 바로 뒤(공백 한 칸까지 — **줄바꿈은 넘지 않음**) 단위 토큰.
  - 토큰: 글자(`\p{L}`, `µ` 포함)로 — 또는 `/` + 글자로 — 시작해 공백·구두점(`/` 는 안)·수학 기호 앞까지(`mg/kg/일` 통째 · `ملغ` · `/L`). 소문자로만 접음(동의어 표 없음 — 안전 쪽).
  - 덩어리가 이미 단위 기호(`% ‰ ° ٪`)로 끝나면 **붙은** 토큰만(`38.5°C` 의 `c` — `30% 환자` 의 `환자` 는 단위 아님).
  - 이름 속 숫자(첫 글자가 숫자이고 바로 앞이 글자·글자 + 하이픈 — `CD4`·`HbA1c`·`IL-6`)는 `u:null` — 덩어리만 본다.
  - 15 기본 갈래 `numberSpans(text)` 는 손대지 않음 — `grounding.js` 는 새 함수를 부르지 않는다.
- `js/text/diagram.js`: 라벨 덩어리마다 `chunkKey ∈ 개요 덩어리`(그대로) **그리고** `u ≠ null` 이면 `k|u` 가 보낸 개요의 짝 집합 안 — 단위 바꿈·**단위 뺌** 모두 버림.
- 고치는 중 labels 사본으로 잡은 것 둘: ① 공백 한 칸 건너뛰기가 개요 줄 사이 `\n` 을 넘어 다음 줄 첫 낱말을 단위로 읽음(정당 버림 20) → 줄바꿈은 넘지 않게. ② `30% tail words` 의 `tail` 을 단위로 읽음(D2b 빨강) → 단위 기호 뒤엔 붙은 토큰만.
- **Review `r16-2/labels.mjs` 55꼴(사본 `b2/labels.mjs`, `labels-before.txt`·`labels-after.txt`)**: ok 38 → 38 · LEAK 8 → **3** · 정당 버림 9 → **14**.
  - 단위 5꼴 **모두 버림**: `40 mg`→`40 g` · `40 mcg` · `3–5 mg`→`3–5 g` · `3–5 mg/kg`→`3–5 mg` · `40 mg/kg/일`→`40 mg`. 이미 맞던 꼴 무변.
  - **정당 버림이 는 5꼴(꼴별)**: 단위 뺌 4 — `나트륨 < 135 mEq/L`→`나트륨<135` · `→저나트륨혈증<135` · `eGFR < 30 mL/min/1.73 m²`→`eGFR < 30` · `프레드니손 40 mg`→`프레드니손 40`(Review 는 "통과" 로 셌으나 지시 규칙 "단위 뺌도 버림") / 단위 글자 체계 다름 1 — `3–5 mg`→`٣–٥ ملغ`(같은 `ملغ` 끼리는 통과).
  - 남은 LEAK 3: `2,500`↔`2500`(16-2R 낮음-4) · `3 to 5 days`→`5 days` · `3에서 5일`→`5일`(낮음-3) — 범위 밖.
- 16-1R `safety.mjs` 42꼴(사본): 16-1 판 대비 바뀜 20 = 앞서의 18 + 정당 꼴 1(`< 135 mEq/L`→`< 135` — 단위 뺌 버림) + "다른 줄 숫자 옮김" `칼륨 < 135` 도 이제 버림. 관계·낱말 표 바이트 같음.
- **15 하네스 7벌 바이트 같음 다시**(`r16-2/h15.mjs` 사본 `b2/h15.mjs` — HEAD 사본 `grounding.js` 대 작업 트리): 7/7 SAME(sha 앞 16자 Review 표와 같음).
- 시험 **D2**: d6 `나트륨 < 135`(개요 `< 135 mEq/L`) → 버림(digits 4 → 5). **D2c**: 버림 10꼴(5꼴 + `40 mg`→`40` · `< 135 mEq/L`→`< 135` · `38.5°C`→`°F` · `10^9/L`→`10^9/mL` · `٤٠ ملغ`→`٤٠ غ`), 통과 10꼴(같은 단위 · `40mg` · `40 MG` · `3-5 mg/kg` · `mg/kg/일` · `٤٠ ملغ`↔`40 ملغ` · `30% 환자`→`30%` · `38.5 °C` · `CD4 수치 < 200`→`CD4 < 200` · `HbA1c ≥6.5%`) + `numberChunkUnits` 단언 4줄.

### 2. 낮음-7 — `svgFileText` 단위 시험
- 새 시험 **G8**(`diagram-ui-16`): 복제·직렬화되는 시험 전용 가짜 DOM + 클래스별 계산 스타일 흉내(글꼴 하나는 일부러 `var(`). 단언: XML 머리 · `var(` 0 · `class` 0 · 글자 5 `fill` rgb · 선 2 `stroke` rgb · 노드 칠·테두리 · 원어 줄 · 화살촉 · `var(` 값은 안 박음 · `</defs>` 바로 뒤 viewBox 전체 배경 상자 · 크기 = viewBox · `<img` 탈출 · 배경이 `var(` 면 흰색 · 화면 원본 class 그대로.
- Review M3 와 같은 변이(B4) → G8 **빨강**.

### 3. 낮음-5 — 처음 그린 시트 닫기
- `ui/diagram.js`: 연 개요 id 기억(`SH.recId`) — 닫을 때 연 단추가 다시 그려져 사라졌으면 같은 개요의 보이는 조각 단추(새 작은 그림)로 포커스.
- `ui/summaries.js`: 그림 저장 뒤 `load()` 가 끝나면 그 개요 줄 `<details>` 를 다시 펼침(`reopenRow`).
- headless F(`b2/run-f.mjs`, 프로필 `b2/pF1`): 처음 [개념도 그리기] 1건 → Esc → 닫힘 · 포커스 = 그 줄 `.dg-thumb`(body 아님) · 줄 펼침 · 콘솔 오류 0.

### 4. 변이(`b16-2/mut.mjs` · `muts.json`, 백업 읽어서 씀 → `cmp`)

| # | 변이 | 결과 | 빨간 시험 |
|---|---|---|---|
| B1 | 단위 짝 검사 지움 | 빨강 | D2 · D2c |
| B2 | 단위 토큰 늘 빈 값 | 빨강 | D2 · D2c |
| B3 | 공백 건너뛰기가 줄바꿈을 넘음 | 빨강 | D2c |
| B4 | SVG 저장에 계산된 색을 박지 않음(Review M3) | 빨강 | G8 |

각 복원 바이트 같음.

### 5. 점검
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 2,037/2,037 · 2,037/2,037**(`b2/test-run1.txt`·`test-run2.txt`, 2회차는 변이 복원 뒤).
- stamp 단독 → `--check` "그대로다 (모듈 106개 · CSS 4개)" · `git diff --check` 0.
- 특수 글자: 20파일 수 = HEAD(새 파일 0). `numexpr.js` `HYPH` 줄에 Edit 가 `‐‑` 을 실제 글자로 넣은 사고 → `escfix.mjs` 로 되돌림, 코드 줄 비 ASCII 0.
- 고친 파일: `js/text/numexpr.js` · `js/text/diagram.js` · `js/ui/diagram.js` · `js/ui/summaries.js` · `tests/diagram-16.test.mjs` · `tests/diagram-ui-16.test.mjs` · `index.html`(stamp).

### 6. 남은 것
1. 단위 규칙은 언어 무관·동의어 없음이라 정당 버림이 는다(위 5꼴 · 숫자에 붙은 조사가 다른 꼴 `135 이하`↔`135 이하인` 도 버림). 노드가 줄어 few-relations 가 늘 수 있다 — [M] "남는 노드 수".
2. 소문자만 접는다(`mL`=`ml` · `µg`↔`mcg`·`mg`↔`ملغ` 는 다름).
3. 16-2R 낮음-2·3·4·6 은 그대로(다듬기·실기기 묶음).
