# 초안 — spec 에 붙여 넣을 것 (15 섹션 복습 묶음 · 16 그림 개념도 · 19 사례 이미지 참조 · 20 필기·하이라이트 Plan, 2026-11-16)

> 이 파일은 **초안**이다. spec.md 는 고치지 않았다. 번호는 자리표시다 — 오케스트레이터가 다른 초안(11 = 17-2-1, 12·13 = 17-9·17-10, 18 = 17-9, 9c = 17-4-1, 10 = 17-10)과 맞춰 다시 매긴다.
> 붙일 자리:
> (A) 17절 끝(다른 초안 소절들 뒤)에 **새 소절 15 · 새 소절 16 · 새 소절 19 · 새 소절 20** 넷.
> (B) 19-1 표 **15**·**16**·**19**·**20** 행 끝에 `[수정 …]` 한 줄씩(15 행은 번호 충돌 정리 포함).
> (C) 13절 표 "외부 요청"·"의료 안전" 행 끝에 한 줄씩(19).
> (D) 9-2 `questions`·`annotations` 행에 한 줄씩. (E) 3-2 import 방향에 한 줄. (F) 12-1 라우트 표 한 줄.
> 실측: 앱은 돌리지 않았다(앱 무변). 웹 조사(Open-i API 실제 응답 · CORS 헤더 · 위키미디어 공용 API)만 했다 — 출처는 새 소절 19 의 1-2.

---

## (B) 19-1 표 행 끝에 붙일 한 줄

**15 행** — `[수정 2026-11-16 — 15·16·19·20 Plan]` **번호 충돌 정리**: 19-1 표의 15 행은 "스캔본 OCR(브라우저)"이고 O-D3(승인 2026-10-19)이 "15 그대로, 시작 조건을 좁힘"으로 남겼는데, 19-1-1 3 의 "15 갱신"과 인계 10-21 표는 15 를 **섹션 종합 복습 + 복습 묶음**(17 #15 · N8)으로 쓴다. → 권장: **15 = 섹션 복습 묶음**(설계 정본 **새 소절 15**), 브라우저 OCR 은 **"15-OCR"(조건부 — O-D3 시작 조건 그대로)** 로 이름만 바꿔 남긴다(오케스트레이터 확인). 15 는 두 Build — **15-1 AI 출제 서비스(화면 없음) → 15-2 복습 묶음 화면 `#/review/:docId/:range` + 퀴즈 화면 🤖 갈래.** AI 문제는 원서 문제와 **다른 sectionId(`ai-p{a}-{b}`)** 로 섞지 않고, 입력은 그 범위의 **읽은 쪽**(13 `@read`) 문단 — 저장 요약이 있는 문단 먼저, 한 번 누름 = 최대 1호출(5문항). 다시 추출(`resetDerived`)이 AI 문제를 지우지 않게 고친다. DB 버전 3 그대로·`algoVersion` 무관. Build 합 약 5.5시간 + Review 약 3시간(옛 추정 2–3시간은 출제 검증·묶음 화면·퀴즈 갈래를 작게 셌다).

**16 행** — `[수정 2026-11-16 — 15·16·19·20 Plan]` 설계 정본 **새 소절 16**. 입력 = 저장한 개요(11c `kind:'outline'`, 3단) — 원문을 다시 보내지 않는다. 범위마다 **[개념도 그리기] 한 번 = 1호출**(관계 화살표 노드 ≤ 12·엣지 ≤ 16, 노드는 개요 요점에서만, 관계는 고정 목록 — '치료' 없음), 배치는 **외부 라이브러리 없이 층 배치(Sugiyama 축약)** 순수 함수, 그림의 글 대안 = 11c 트리 + 관계 목록. 두 Build — **16-1 요청·검증·배치(화면 없음) → 16-2 SVG 그리기·화면·내보내기.** 결과는 그 개요 레코드에 붙여 둔다(DB 버전 무관). Build 합 약 5시간 + Review 약 3시간.

**19 행** — `[수정 2026-11-16 — 15·16·19·20 Plan]` 설계 정본 **새 소절 19**. **앱이 새 외부 서버(NLM Open-i)에 검색어를 보내는 첫 기능이라 넣을지는 운영자 결정(19-Q1)**. 또 2026-11-16 조사에서 **Open-i 가 한국 IP 에서는 홈·API·이미지 모두 "점검 중" 쪽**을 냈고(다른 망에서는 API JSON 이 두 번 왔다가 끊김) — 가용성이 불안정하다. 그래서 **19-0 가용성 확인(운영자 PC·Nour 기기 VPN 켬/끔) → 19-1 Build** 순서이고, 막히면 **18 추천 링크(새 탭)로만** 둔다. Build 약 2.5시간 + Review 1시간. AI 호출 0 · 판독·진단 없음(13·18절) · 사진을 저장하지 않는다.

**20 행** — `[수정 2026-11-16 — 15·16·19·20 Plan]` 설계 정본 **새 소절 20**. `annotations` `kind:'highlight'|'note'`, 앵커는 **인용(exact + 앞뒤 32자) + 문단 해시 + 줄 id·오프셋 + 판(algoVersion)** — 줄 id 가 바뀌는 재추출(8q·8i-4 등)에도 인용으로 다시 찾는다. 리플로우는 CSS Custom Highlight, 원본은 오버레이 상자. 만들기는 선택 동작 줄 `[⋯]` → `[표시]`·`[메모]` 와 음성 "표시"(지금 문장). **문서를 지워도 남고 같은 PDF 를 다시 가져오면 다시 붙는다**(`fileHash` 사본). 세 Build — **20-1 앵커·저장·칠하기 → 20-2 만들기·음성·쪽 필기 시트 → 20-3 필기 화면 `#/notes`·내보내기·다시 붙이기.** 호출 0·DB 버전 3 그대로. Build 합 약 8시간 + Review 약 4시간. **자리 권장: 15 앞**(호출 0 먼저 — 17절 머리 6, 결정 X-D1).

---

## (A) 새 소절

### 새 소절 15. 섹션 복습 묶음 — 15 Build 설계 `[신설 2026-11-16 — 15·16·19·20 Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 15-D1–D12]`

**방침**: 17 #15(AI 문제는 `questions` `source:'ai'`, 10-4 프롬프트·grounding, 원서 문제와 섹션을 나눠 출제 — 섞지 않음)와 19-1-1 N8(복습 묶음 = 저장 요약 + 원서 문제 + AI 문제, 사진 없음)을 그대로 따른다. **새 호출은 [문제 만들기]를 누를 때만**이고 나머지(묶음 보기·풀기·카드·필기)는 호출 0 이다. 대화형 강의·사진 판독은 넣지 않는다(N8 그대로).

#### 1. 지금 코드 사실 (파일:행 — 2026-11-16 작업 트리, 8e Build 진행 중 · 8c+8f·18·9c·10·11·12·13·14 는 Plan 초안만)

| 항목 | 지금 | 근거 |
|---|---|---|
| `questions` 스토어 | 키 `id`, 인덱스 `docId`·`docId_sectionId`·`source` — 있다. 쓰는 것은 원서 파서뿐(`toQuestionRecord` → `source:'book'`, id `{docId}:{sectionId}:q{n}`) | `js/db.js:52-57` · `js/quiz/engine.js:125-132` |
| AI 출제 코드 | **없다.** `prompts.js` 에 출제 요청·스키마 0, `ai/grounding.js` 파일 없음. `USAGE_KINDS` 에 `'quiz'` 는 있다(빈 행 고정) | `js/ai/prompts.js`(grep) · `js/config.js:631` |
| 퀴즈 화면 문항 읽기 | `#/quiz/:docId/:sectionId` → `docId_sectionId` 인덱스로 **그 sectionId 의 모든 문항**(source 를 보지 않음) · 제목은 `doc.sectionIndex` 에서 sectionId 로 찾는다(없으면 비어 보임) | `js/ui/quiz.js:126-190·220-240` · `js/router.js:65-68` |
| 배지·해설 | 배지는 `📕` 고정(`gradable` 이면) · 해설은 **`q.explanation.en` 만** 보인다 | `js/ui/quiz.js:417-418·585` |
| 채점 | `isGradable` = `status==='verified'` + 정답 글자 있음 — AI 문항도 같은 꼴이면 그대로 된다 | `js/quiz/engine.js:304-310` |
| 다시 추출 | `resetDerived` 가 `DERIVED_STORES = pages·questions·sections·searchText` 를 **docId 로 전부** 지운다 → **AI 문항도 지워진다**(한도를 쓴 결과) | `js/db.js:478·498-530` |
| 문서 삭제 | `CASCADE_STORES` 에 `questions`·`attempts`·`mistakes` | `js/db.js:451-454` |
| 장 범위 | 8g `tocOf(docId)` → `{items:[{t,p,d}], pageLabels}` · `printedLabel` | `js/search/outline.js:225-242` |
| 라우트 | `SCREENS` 에 `review` 없음. 12-1 표가 `#/review/:docId/:sectionId`(P2)를 예약 | `js/router.js:13-15` · spec 12-1 |
| 읽은 쪽 · 저장 요약 · 카드 | 지금 0. 13-1 이 `progress` `@read`(쪽 범위), 11-1 이 `annotations` `summary`·`outline`, 12-1 이 `cards` `sentence` 를 만든다(초안) | 12·13 초안 17-10 4 · 11 초안 4-4 · 12 초안 4 |

#### 2. 범위와 묶음

- **범위 = 한 책의 PDF 쪽 구간 `[a, b]`**(`rangeKey = a + '-' + b`). 고르는 법은 11-3·13-2 와 같다: `[장 ▾]`(`tocOf` 깊이 0·1, 다음 항목 쪽 − 1 까지) 또는 `[쪽 a–b]`(인쇄 라벨 함께). 범위 고르기 부품은 11-3·13-2·15-2 세 화면이 쓰므로 **15-2 가 `ui/rangepick.js` 로 뺀다**(먼저 만든 쪽의 것을 옮김 — 동작 무변 시험).
- **묶음 화면 `#/review/:docId/:range`**(`range` = `a-b`, 없으면 `lastPage` 가 든 장) — 위에서 아래로, 비어 있는 칸은 숨긴다:
  1. 머리: 장 제목(개요) · "쪽 {인쇄 a}–{인쇄 b}" · `[범위 바꾸기]`.
  2. **진도**(호출 0): "읽음 x/y쪽"(13 `@read`) · `[여기서 읽기]`(첫 읽지 않은 쪽).
  3. **요약·개요**(호출 0 보기): 저장한 요약 n개 → `[모아 보기]`(11-3 의 그 범위) · 저장한 개요가 있으면 접힌 트리(11 `tree.js`) + 16 개념도가 있으면 작은 그림 · 없으면 `[개요 만들기 (호출 1)]`(11-3 의 같은 함수) · 개요가 있으면 `[개념도 (호출 1)]`(16).
  4. **원서 문제 📕**(호출 0): `doc.sectionIndex` 중 문항 쪽 범위(`startPage`–`endPage`)가 `[a,b]` 와 겹치는 섹션 → 줄마다 "섹션 III · 문항 n · 지난 점수 s/t" + `[풀기]`(지금 `#/quiz/:docId/:sectionId` 그대로). 원서 문제가 없는 책(교과서)은 칸이 없다.
  5. **AI 문제 🤖**: 저장된 수 · 지난 점수 · `[풀기]`(`#/quiz/:docId/ai-p{a}-{b}`) · `[문제 만들기 5개 (호출 1)]` + 한 줄 "읽은 쪽 문단에서 — 약 n자 · 남은 문단 m". 읽은 쪽이 범위에 없으면 단추 흐림 + "이 범위를 먼저 읽으세요(읽은 문단에서만 만듭니다)"(15-D4).
  6. **기억 카드**(호출 0): 이 책 이 범위(`pageNo ∈ [a,b]`)의 카드 "복습할 n · 전체 m" → `[복습]`(12-3 `#/cards/:docId/:range` — 12-3 라우트에 범위 칸 하나 더함, 15-2 범위).
  7. **필기**(호출 0, 20 뒤): "필기 n" → `[보기]`(`#/notes/:docId/:range`). 20 이 먼저 Build 되면(X-D1) 15-2 가 이 줄을 같이 만든다.
  8. 고지 한 줄 `review.disclaimer` "AI 문제·요약은 교육용입니다 — 근거 문장과 원문을 확인하세요."
- **입구**(15-D9): 서재 카드 `[⋯]` "복습 묶음"(`#/review/:docId`) · 11-3 모아 보기의 범위 머리 `[이 범위 복습]` · 13-2 계획 화면의 범위 줄 `[복습]`. 리더 상단바·서재 상단은 늘리지 않는다.

#### 3. AI 출제 (15-1)

##### 3-1. 입력 고르기 — 순수 `js/text/review.js`

```
passageFor({paras, readRanges, usedParaIds, summarized, budget}) → {items:[{paraId, pageNo, text}], chars, left}
  paras       = 범위 쪽들의 흐름 문단(fromStored → flowParasOf → joinPieces 글자). kind body·list 만, 60자 이상
  읽은 쪽만    = rangesHas(readRanges, pageNo)                       # 10-4 "실제로 읽은 문단"(13 @read)
  빼기         = usedParaIds(이 범위 AI 문항의 grounding paraId 들) # 같은 문단으로 또 만들지 않는다
  순서         = 저장 요약이 있는 문단(textHash 일치) 먼저 → 쪽·문단 순
  채우기       = 누적 글자 ≤ budget(AI.MAX_REQ_CHARS 6,000) — 문단을 자르지 않는다(넘치면 다음 문단)
  left         = 남은 후보 문단 수(단추 아래 "남은 문단 m")
```
- 쪽 글자는 `pages` 를 쪽마다 읽어 그 자리에서 버린다(퀴즈 `makeIo` 와 같은 커서 방식 — 장 하나 40쪽이어도 메모리에 쪽 하나).
- 문단 id 는 재추출로 바뀔 수 있다 → AI 문항에는 `paraId` 와 함께 **근거 인용(evidence)** 을 남기고, 근거로 가기는 20 의 인용 찾기(`findQuote`)를 쓴다(20 이 뒤면 쪽 처음으로).

##### 3-2. 요청 · 스키마 · 검증 (`ai/prompts.js` · `ai/grounding.js`)

- `buildQuizRequest(items, {src, target, domain, n})` — 10-4 지시 핵심 **그대로** + 언어를 값으로(7-1 원칙 5 · 11-D4 와 같다): "Explanation in {Target} AND in {Src}"(같으면 하나). `commonSystem(true, domain)` 규칙 1–6 글자 그대로. DOC = `JSON.stringify(items)`(`paraId`·`pageNo`·`text` — `escapeDoc`).
- 스키마 `QUIZ_SCHEMA`(gemini `responseSchema`): `{questions:[{stem, options:[{letter, text}] (5), answer, evidence, evidenceParaId, explanation:{tr, src?}}], notes}` — 10-4 의 `explanation{ar,en}` 를 `{tr, src}` 로(언어를 박지 않음).
- `n` = `REVIEW.QUIZ_N`(5) · `maxOutputTokens = n × 900 + 200`(아랍어 해설 팽창) · `temperature 0.2` · `QUIZ_PROMPT_VERSION = 1`(값에만). 입력 ≈ 1,500 토큰 + 출력 ≤ 4,700 → `MAX_REQ_TOKENS` 8,000 안.
- **`ai/grounding.js`**(10-4 자체 검증 1–5 그대로, 순수): evidence 정규화 부분 문자열 → 관대한 2차(공백·구두점 제거) → 실패면 `status:'rejected'`(저장, 출제 안 함) · 보기 5개·글자 A–E·중복 없음 · `evidenceParaId` 교정 · `[REDACTED]` 폐기 · **숫자 거름 더함**(11-D7 과 같은 함수 — 정답 보기·해설에 입력에 없는 숫자가 있으면 폐기). 폐기율 > 50% 면 "이 구간에서 믿을 만한 문항을 충분히 만들지 못했습니다" + 자동 재호출 0(10-4).
- 파이프라인: 8f-1/11-1 의 `runJob` 위에 **`QUIZ_JOB`**(11 의 job 셋과 같은 꼴). 상태 기계·gate·429·cooldown·상한·사용량 한 벌. 사용량 `byKind.quiz`(이미 고정 키 — 7a 빈 행 시험 무변). 키 `keyFor(docId, items 글 이음, target, 'quiz', 'n=5')` — 같은 입력이면 0회(실패 뒤 [다시 시도]에 쓰인다; 새로 누르면 `usedParaIds` 때문에 다른 입력).
- 보내는 것: 교과서 문단 글뿐(번역·요약과 같은 범주).

##### 3-3. 저장 — `questions` `source:'ai'`, DB 3 그대로

- 레코드: 9-2 필드 + `{id: docId + ':' + sectionId + ':ai' + hash8(stem), docId, sectionId: 'ai-p' + a + '-' + b, source:'ai', status:'verified'|'rejected', number(만든 순서), stem, options[], answer:{letters:[x]}, explanation:{tr, src}, langs:{tr, src}, evidence, grounding:[{quote, pageNo, paraId}], pageNo, paraIds[], hasFigure:false, promptVersion, model, provider, domain, createdAt}`. id 가 줄기 해시라 같은 응답을 다시 받아도 중복 0.
- **원서 문제와 섞지 않는다**: sectionId 접두 `ai-` 는 원서 파서 id(`sec-…`)와 겹치지 않는다(시험). 퀴즈 화면은 sectionId 하나만 읽으므로 그대로 갈린다.
- **다시 추출이 지우지 않게**(15-D6): `resetDerived` 의 `questions` 쓸기에서 `source === 'ai'` 는 건너뛴다(+5줄 — 11·12 의 연쇄 예외와 같은 꼴). 문서 삭제는 지금처럼 함께 지운다(15-D7) — 서재 삭제 확인 줄에 "AI 문제 n개도 지워집니다"(n>0, 11·12 의 `keptLine` 옆).
- 9c: `questions` `source:'ai'` 는 이미 "항상 담음"(9c 초안 2).

#### 4. 퀴즈 화면 갈래 (15-2 — `ui/quiz.js` +약 60줄)

- 배지: `q.source === 'ai'` → `🤖 AI 문제`(원서 `📕` 와 다른 색 토큰), 머리 아래 고정 한 줄 "AI 가 만든 문제 — 근거 문장을 확인하세요".
- **근거 블록**(AI 만, 늘 보임): 인용(`dir=ltr`, `lang=src`) + `[원문에서 보기]`(그 쪽 → 20 `findQuote` 로 줄 — 없으면 쪽 처음).
- 해설: `explanation.tr`(대상 언어 `translationBlockAttrs`) + 있으면 `explanation.src`(작게). 원서 문항은 지금처럼 `explanation.en`.
- 제목: `sectionIndex` 에 없는 `ai-…` 는 "AI 문제 · 쪽 {a}–{b}"(인쇄 라벨). 뒤로가기는 묶음 화면.
- `status:'rejected'` 는 읽지 않는다(`loadQuestions` 거름 한 줄).

#### 5. 고치는 파일 · import 방향

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **15-1** AI 출제 서비스 | `js/text/review.js`(순수 약 140 — `passageFor`·`rangeKey`·`aiSectionId`·`sectionsInRange`) · `js/ai/grounding.js`(순수 약 150) · `js/review/aiquiz.js`(서비스 약 150 — 쪽 읽기·저장·`usedParaIds`, `config`·`db`·`hash`·`text/*` 만) · `tests/aiquiz-15.test.mjs` · `tests/grounding-15.test.mjs` | `js/ai/prompts.js`(출제 +110) · `js/ai/pipeline.js`(`QUIZ_JOB`·`makeQuiz()` +35) · `js/config.js`(`REVIEW` +10) · `js/db.js`(`resetDerived` ai 예외 +5) |
| **15-2** 복습 묶음 화면 · 퀴즈 갈래 | `js/ui/review.js`(약 380) · `js/ui/rangepick.js`(옮김 — 11-3·13-2 것) · `tests/review-ui-15.test.mjs` | `js/router.js`(`review` + `reviewHash`) · `js/main.js`(+4) · `js/ui/quiz.js`(+60) · `js/ui/library.js`(카드 [⋯] 한 줄 · 삭제 확인 수) · `js/ui/summaries.js`·`js/ui/planner.js`(입구 한 줄씩, rangepick 으로 바꿈) · `js/ui/cards.js`(범위 칸 +8) · `index.html`(섹션) · `css/screens.css` · i18n 4개(약 30키) |

- import: `review/*` 행은 `notes/*`·`srs/*`·`plan/*` 행과 같다(`config`·`text/*`·`db`·`hash`). `ai/grounding.js` 는 순수(16-A grep 대상). 새 `js/*.js` 마다 `stamp-importmap --check` 0.

#### 6. 호출 — 언제 몇 번

| 동작 | 호출 | 사용량 |
|---|---|---|
| 묶음 화면 열기 · 범위 바꾸기 · 원서 문제 풀기 · AI 문제 풀기 · 카드 복습 · 필기 보기 | 0 | — |
| `[문제 만들기 5개]` — 새 입력 | **1**(5문항) | `byKind.quiz` |
| 같은 — 실패 뒤 `[다시 시도]`(같은 입력) | 1, 캐시에 있으면 0 | 같음 |
| `[개요 만들기]`·`[개념도]` | 11-3 · 16 의 규칙(각 1) | `summarize` · `diagram` |
| 자동 무엇이든 | **0** | — |

비용 감각: 장 하나 복습에 `[문제 만들기]` 3번 = 3회 ≈ 낭독 번역 약 1.8만 자분(CMDT 2026 약 4쪽) — 15문항.

#### 7. 수용 기준 (16절 형식)

**15-1**
- [ ] `[N]` `passageFor`: 읽지 않은 쪽 문단 0 · `usedParaIds` 빠짐 · 저장 요약 문단 먼저 · 누적 ≤ 6,000자, 문단을 자르지 않음 · 제목·문항·보기·인용·표 안내 빠짐 · `left` 정확.
- [ ] `[N]` `buildQuizRequest`: 규칙 1–6 글자 그대로 · 대상 `ko`·원문 `en` 이면 "Korean AND English", 아랍어·`Arabic` 0 · 같은 언어면 하나 · 탈출.
- [ ] `[N]` `grounding`: 인용 정확 → 통과 · 공백·구두점만 다름 → 2차 통과 · 지어낸 인용 → rejected · 보기 4개·글자 F·중복 보기 → rejected · `evidenceParaId` 틀림 → 교정 · 정답 보기에 입력 밖 숫자 → rejected · 5개 중 3개 rejected → "충분히 못 만듦" 신호, 재호출 0.
- [ ] `[N]` `makeQuiz`(가짜 provider): 1호출 · 같은 입력 다시 → 0호출 · 429·capped·no-key → 보내지 않음/막힘 · `byKind.quiz` +1 · **번역 요청 본문 바이트 불변**.
- [ ] `[N]` (fake-idb) 저장: sectionId `ai-p40-79` · id 줄기 해시로 중복 0 · 원서 문항(`sec-III`)과 `docId_sectionId` 조회가 갈림 · `resetDerived` 뒤 `source:'ai'` 남고 `book` 은 지워짐 · `deleteDocument` 뒤 둘 다 지워짐.
- 변이: `resetDerived` 의 ai 예외 지우기 · `passageFor` 의 읽은 쪽 거름 지우기 · grounding 2차 검사를 늘 통과로 · sectionId 접두를 `sec-` 로.

**15-2**
- [ ] `[D]` 흉내 Gemini: 장 고름 → 묶음 화면 칸 셋 이상 · `[문제 만들기]` → 요청 **1건**(본문에 읽은 쪽 문단만), 5문항 → `[풀기]` → 🤖 배지·근거 블록·대상 언어 해설 · 원서 섹션 `[풀기]` → 📕 그대로(문항에 AI 0).
- [ ] `[D]` 읽은 쪽 0 인 범위 → 단추 흐림·한 줄·요청 0. 429 → 막힘 한 줄, 자동 재시도 0.
- [ ] `[D]` 원서 문제 없는 책(교과서) → 📕 칸 없음 · 저장 요약 없음 → 요약 칸 "아직 저장한 요약이 없습니다" 한 줄.
- [ ] `[D]` 360×740·412×915·915×412 × 4언어 가로 넘침 0, 단추 48px, RTL 거울, `innerHTML` 새 사용 0.
- [ ] `[D]` 입구 셋(서재 [⋯]·모아 보기·계획)이 같은 범위로 연다. 범위 고르기가 11-3·13-2 에서 전과 같게 동작(옮김 회귀 0).
- 변이: 퀴즈 갈래에서 근거 블록 빼기 · AI 섹션 `[풀기]` 가 원서 sectionId 로.

#### 8. 결정 표 — 권장 (운영자 위임: 권장안으로 진행)

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 15-D1 | 나누기 | (가) **두 Build: 15-1 서비스 · 15-2 화면** · (나) 한 Build | **(가)** — 각 2.5–3시간. 출제 검증(grounding)은 화면 없이 시험이 가장 촘촘하다 |
| 15-D2 | 복습 단위 | (가) **PDF 쪽 범위(장은 개요로 고름)** · (나) 원서 섹션(sectionIndex)만 | **(가)** — 교과서(CMDT)에는 원서 섹션이 없다. 장·쪽 범위는 11-3·13-2 와 같은 말이라 묶음이 서로 이어진다 |
| 15-D3 | AI 문제와 원서 문제 | (가) **다른 sectionId(`ai-p{a}-{b}`) — 섞지 않음, 묶음에서 나란히** · (나) 한 퀴즈에 섞음 | **(가)** — 17 #15 그대로. 퀴즈 화면이 sectionId 하나로 읽어 코드가 거의 그대로다 |
| 15-D4 | 출제 입력 | (가) **읽은 쪽(13 `@read`) 문단 · 저장 요약 문단 먼저 · 쓴 문단 빼기 · 6,000자** · (나) 범위 앞에서부터(읽지 않아도) · (다) 저장 요약 글을 입력으로 | **(가)** — 10-4 "실제로 읽은 문단"·근거는 원문 인용이어야 한다((다)는 요약이라 인용 검증이 무너진다). (나)는 읽지 않은 곳 문제가 복습이 아니다 |
| 15-D5 | 한 번 누름 | (가) **1호출 · 5문항** · (나) 10문항 | **(가)** — 출력 예산 안(약 4,700 토큰), 폐기 50% 규칙이 작동하기에 충분. 더 원하면 다시 누른다(새 문단) |
| 15-D6 | 다시 추출 때 AI 문항 | (가) **남김 — `resetDerived` 예외** · (나) 지금처럼 지움 | **(가)** — 한도를 쓴 결과다. 인용·쪽이 있어 문단 id 가 바뀌어도 근거로 갈 수 있다 |
| 15-D7 | 문서 삭제 때 AI 문항 | (가) **함께 지움(지금 연쇄) + 삭제 확인에 수** · (나) 남김 | **(가)** — 퀴즈 화면·근거로 가기가 문서를 필요로 한다. 9c 백업에 남는다. (요약·카드·필기와 다르게 "문서 없이 쓸 수 있는 꼴"이 아니다) |
| 15-D8 | 해설 언어 | (가) **대상 언어 + 원문 언어(같으면 하나)** · (나) 10-4 의 ar+en | **(가)** — 7-1 원칙 5 · 11-D4 와 같다 |
| 15-D9 | 입구 | (가) **서재 카드 [⋯] · 11-3 범위 머리 · 13-2 범위 줄** · (나) 리더 상단바 단추 | **(가)** — 리더 상단바·서재 상단을 늘리지 않는다(8e·8f-3 빠듯) |
| 15-D10 | 원서 해설 [해설 요약](11-D21) | (가) **넣지 않음** · (나) 퀴즈 해설에 [요약] | **(가)** — 원서 해설은 이미 짧고(1–3문단), 호출을 하나 더 만든다. 해설 번역(5-5 "번역 버튼")이 아직 없어 그쪽이 먼저다 — 아래 "못 함" |
| 15-D11 | 범위 고르기 부품 | (가) **15-2 가 `ui/rangepick.js` 로 뺌(11-3·13-2 가 씀)** · (나) 세 벌 | **(가)** — 같은 규칙(장 = 개요 깊이 0·1, 다음 항목 −1)이 세 곳에서 어긋나지 않게 |
| 15-D12 | 묶음 상태 저장 | (가) **저장하지 않음 — 매번 스토어에서 모은다** · (나) `annotations` `kind:'review'` | **(가)** — 모든 칸이 다른 스토어의 파생이다. 새 레코드는 9c·삭제 규칙을 늘린다 |

**운영자에게 물을 것** — 없음(출제는 19-1 표 15 행 "섹션당 1회 — 부를 때만" 승인 범위, 보내는 것은 교과서 문단뿐, 13·18절 무변).

#### 9. 크기 · 시간 `[추정]`

| Build | Build | Review | 위험 |
|---|---|---|---|
| 15-1 AI 출제 서비스 | 2.5h | 1.5h | 중간 — grounding 의 관대한 2차 검사 정밀도, 출력 예산(아랍어 해설) |
| 15-2 묶음 화면 · 퀴즈 갈래 | 3h | 1.5h | 중간 — 화면 하나 + 퀴즈 화면 손질 + 부품 옮김 |
| **합** | **5.5h** | **3h** | |

#### 10. 마지막 실기기 점검 묶음 (15 몫)
- [ ] `[M]` 실제 Gemini(Nour 키·VPN 켬): 5문항이 스키마대로 오는가, 폐기율(근거 인용 실패)이 몇 %인가 — 50% 넘는 일이 잦으면 2차 검사 규칙 조정.
- [ ] `[M]` Nour 판단 10문항: 근거 문장이 정답을 정말 받치는가, 아랍어 해설이 이해되는가.
- [ ] `[M]` GT 7 세로·가로: 묶음 화면 칸이 다 보이는가, 🤖·📕 배지 구별.

#### 11. 다른 단계에 넘길 것
- **13-1**: `@read` 를 묶음이 읽는다 — `rangesHas` export.
- **11-3·13-2**: 범위 고르기를 한 함수로 쓰게 두면 15-2 의 옮김이 작다.
- **12-3**: `#/cards/:docId/:range` 범위 칸(15-2 가 더함 — 12-3 이 `queue({pages:[a,b]})` 거름을 받게 만들어 두면 +2줄).
- **20**: `findQuote(desc, quote)` 를 AI 문제 근거로 가기에 쓴다.

#### 12. 이번엔 못 함
대화형 강의(N8 (가)) · 사진 판독(N8 (나)) · 원서 해설 번역 버튼(5-5 — 따로 작은 단계) · [해설 요약] · AI 문제 고쳐 쓰기 · 섞어 풀기 · 묶음 내보내기.

---

### 새 소절 16. 그림 개념도 — 16 Build 설계 `[신설 2026-11-16 — 15·16·19·20 Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 16-D1–D12]`

**방침**: 17 #21(AI 출력 노드·엣지 JSON → 인라인 SVG, 라이브러리 없음, 범위를 골라 부를 때만, 결과 캐시)과 19-1-1 N4(11c 트리를 입력으로 받으면 출력이 작다)를 그대로 따른다. 입력은 **저장한 개요**(11c `kind:'outline'`)뿐 — 원문을 다시 보내지 않는다.

#### 1. 지금 코드 사실

| 항목 | 지금 | 근거 |
|---|---|---|
| 개요 · 트리 | 없음. 11-3 이 `annotations` `kind:'outline'` `{range, title, points(3단), cacheKey…}`, `ui/tree.js` `renderTree`(`details/summary`), 숫자 거름 `pruneForeignNumbers` 를 만든다(초안) | 11 초안 4-3·4-4·4-6 |
| SVG 그리기 | 앱 안 SVG 생성 코드 0(아이콘은 정적). 외부 그림 라이브러리 0 | grep `createElementNS` 0 |
| 글자 폭 재기 | 없음 — 캔버스 `measureText` 를 쓰는 곳 0 | grep |
| 양방향 글 | `appendBidiText`·`translationBlockAttrs`(HTML 용) | `js/ui/bididom.js` · `js/text/bidi.js` |
| 사용량 종류 | `USAGE_KINDS` 6개 고정, 그 밖 종류는 `READALONG_KIND` 처럼 따로(11-4 `EXPLAIN_KIND` 와 같은 꼴) | `js/config.js:631` · 11 초안 4-7 |

#### 2. 요청 · 스키마 · 검증 (16-1 — `ai/prompts.js`)

- 입력 = 개요 직렬화 `outlineText(outline)` — 요점마다 경로 꼬리표 `"1"`, `"1.2"`, `"1.2.3"` 를 붙인 줄들(대상 언어 그대로). 길이 ≤ 4,000자(넘으면 3단을 빼고 2단까지 — 그래도 넘으면 보내지 않음).
- `buildDiagramRequest(outlineText, {target, src, domain})`, system = `commonSystem(true, domain)`(규칙 1–6 그대로).
  TASK: "The DOC is an outline (in {Target}) of part of a medical textbook; each line starts with its path. Draw a concept map using ONLY what the outline says: at most 12 nodes and 16 relations. Each node is a short label (≤ 6 words, {Target}) taken from the outline, with `p` = the path of the line it comes from, and `src` = the original {Src} term if the line gives one in parentheses. Each relation goes from node `a` to node `b`, has `r` from the fixed list, and `p` = the path of the outline line that states it. Do not add relations the outline does not state. No treatment or dosing advice."
- **관계 목록**(고정 enum, 16-D5): `cause`(원인) · `leads`(→ 결과·이어짐) · `part`(구성) · `type`(종류) · `sign`(증상·소견) · `test`(검사로 확인) · `assoc`(관련) · `contrast`(대조). **'치료' 없음.**
- 스키마 `DIAGRAM_SCHEMA` `{title, nodes:[{id, t, src?, p}], edges:[{a, b, r, p}], notes}`(enum 강제).
- **검증 `checkDiagram(outline, value)`**(순수): `id` 중복 제거 · 노드 ≤ 12(넘으면 엣지가 적은 것부터 버림) · `p` 가 개요 경로에 없으면 그 노드·엣지 버림 · 엣지 `a`·`b` 가 있고 서로 다름, `r` ∈ 목록, 같은 (a,b,r) 중복 제거 · ≤ 16 · 라벨 ≤ 60자 자름 · **숫자 거름**(라벨 숫자 ⊆ 개요 숫자, 어긋나면 그 노드 버림) · 남은 엣지 < 2 → `failed('few-relations')`(캐시하지 않음, "이 개요에서 관계를 찾지 못했습니다").
- `maxOutputTokens 1,500`, `temperature 0.2`, `DIAGRAM_PROMPT_VERSION = 1`. 키 `keyFor(docId, outlineText, target, 'diagram')`. 사용량 `byKind.diagram`(`AI.DIAGRAM_KIND` — `USAGE_KINDS` 밖, `bumpUsage` +2줄 — 7a 빈 행 시험 무변). job = `DIAGRAM_JOB`(runJob 위).

#### 3. 배치 — 순수 `js/text/diagram.js` (16-1, 외부 라이브러리 없음)

노드 ≤ 12 라 O(n²) 로 충분하다. **같은 입력 → 같은 좌표**(시험 고정). 글자 폭은 주입 `measure(str) → px`(Node 시험은 글자 수 × 고정 폭, 브라우저는 캔버스 `measureText` — 화면과 같은 글꼴 문자열).

```
layoutDiagram({nodes, edges}, {measure, maxW, rtl, P}) → {w, h, nodes:[{id,x,y,w,h,lines[],srcLine}], edges:[{a,b,r,pts[],lx,ly,rev}], layers}
 1. 고리 끊기   DFS(노드 입력 순서) — 뒤로 가는 엣지는 방향을 뒤집어 배치하고 rev=true(화살촉은 원래 방향으로 그린다)
 2. 층         가장 긴 경로 층(원천 = 0). 엣지 없는 노드는 개요 경로 깊이로 맨 아래 "관련" 층에 모은다
 3. 가짜 노드   두 층 이상 건너는 엣지에 층마다 가짜 점(폭 0) — 꺾인 선의 경유점
 4. 순서       무게중심(barycenter) 아래·위 4번 훑기, 같은 값은 입력 순서(결정적). 교차 수를 세어 가장 적은 판을 남김
 5. 줄바꿈     라벨을 measure 로 nodeMaxW(P.NODE_MAX_W 140px) 안에서 낱말 단위로 최대 3줄(넘으면 … ), src 는 아래 작은 한 줄
 6. 좌표       층 = 행(위→아래). 행 안은 왼쪽부터 간격 P.GAP_X, 행 사이 P.GAP_Y. 행 폭 > maxW 이면 그 행을 두 줄로 접는다(같은 층, 아래 줄 들여쓰기)
               — 폰 360px 에서 한 행 최대 2–3 노드
 7. 가운데 맞춤 행마다 전체 폭 가운데로. 엣지 라벨 = 선 가운데 점(겹치면 P.LABEL_NUDGE 만큼 비킴)
 8. RTL       rtl 이면 x' = W − x − w (노드·경유점·라벨 모두) — 층 방향(위→아래)은 그대로
```
- 그림 크기 `w × h` 를 돌려주고, 그리기는 `viewBox` 로 화면 폭에 맞춘다(아래 4). 상수는 `config.js` `DIAGRAM`.

#### 4. 그리기 · 화면 (16-2 — `js/ui/diagram.js`)

- `renderDiagram(layout, {dir, lang, srcLang, labelsOf(r)}) → <figure>`: `<svg role="img" aria-labelledby="dg-t dg-d" viewBox>` + `<title>`(개요 제목) + `<desc>`("개념도 — 노드 n · 관계 m. 아래 '글로 보기'에 같은 내용"). 노드 = `<rect rx>` + `<text>`(줄마다 `<tspan>` — `textContent`), 대상 언어 줄은 `direction` 속성 = dir, src 줄은 `direction="ltr"`·`lang=src` 의 따로 된 `<text>` — **한 줄에 두 방향을 섞지 않는다**(16-D8). 엣지 = `<path>` + `<marker>` 화살촉(`orient="auto-start-reverse"`), 라벨 = 배경 `<rect>` + `<text>`(관계 이름은 i18n `diagram.rel.*` — UI 언어가 아니라 **대상 언어**로 보이게 대상 언어 사전 4개 중 그 언어 것).
- 색은 CSS 클래스(`.dg-node`·`.dg-edge`·`.dg-label`) + 토큰 — 네 테마·고대비에서 저절로. `innerHTML` 0(`createElementNS` 만).
- **크기**: 기본 "전체 보기" — `width:100%` · 글자가 실제 12px 아래로 줄어들 비율이면 자동으로 **[크게]** 상태(그림 그릇 안 가로·세로 스크롤 — 쪽 전체 가로 스크롤 0). 단추 `[전체 보기]/[크게]` 하나.
- **글 대안(접근성, 16-D7)**: 그림 바로 아래 `<details open>` "글로 보기" — 11c 트리(`renderTree`) + 관계 목록 `<ol>`: "{a} → {관계} → {b}"(대상 언어, 줄마다 개요 경로 꼬리표). 화면 읽기는 그림을 이름 하나로 건너뛰고 목록을 읽는다.
- 자리: **11-3 모아 보기**의 저장한 개요 머리에 `[개념도 그리기 (호출 1)]` → 시트(11 요약 시트와 같은 높이 식)에 그림. 그린 뒤에는 개요 머리에 작은 그림(누르면 시트). **15 묶음**의 개요 칸에도 같은 작은 그림. 단추: `[다시 그리기 (호출 1)]`(먼저 묻는다 — `force`) · `[그림 저장]`(SVG 파일 — 토큰을 계산된 색으로 박아 내보냄, `Blob` + `<a download>`, 호출 0) · `[닫기]`. 고지 한 줄 `diagram.disclaimer` "AI 가 개요에서 만든 그림 — 교육용, 원문을 확인하세요".
- **저장(16-D6)**: 받은 결과를 그 개요 레코드에 `diagram:{nodes, edges, title, basis: outline.cacheKey, target, promptVersion, model, createdAt}` 로 붙인다(`notes/summaries.saveOutline` 의 필드 하나 — DB 3 그대로, 9c 는 annotations 를 이미 담음). 개요를 다시 만들어 `cacheKey` 가 바뀌면 그림 머리에 "개요가 바뀌었습니다 — [다시 그리기]". 배치는 저장하지 않는다(화면 폭·RTL 이 바뀌면 다시 계산 — 호출 0).

#### 5. 고치는 파일

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **16-1** 요청·검증·배치 | `js/text/diagram.js`(순수 약 280 — `outlineText`·`checkDiagram`·`layoutDiagram`·`wrapLabel`·`crossings`) · `tests/diagram-16.test.mjs` | `js/ai/prompts.js`(+70) · `js/ai/pipeline.js`(`DIAGRAM_JOB`·`diagram()` +25) · `js/ai/provider.js`(`DIAGRAM_KIND` +2) · `js/config.js`(`DIAGRAM`·`AI.DIAGRAM_KIND` +15) |
| **16-2** 그리기·화면 | `js/ui/diagram.js`(약 260) · `tests/diagram-ui-16.test.mjs` | `js/notes/summaries.js`(`diagram` 필드 +10) · `js/ui/summaries.js`(단추·작은 그림 +30) · `js/ui/review.js`(15 — 작은 그림 +10) · `js/ui/usage.js`(종류 이름 한 줄) · `index.html`(시트 그릇) · `css/screens.css` · i18n 4개(약 22키 — 관계 이름 8 포함) |

#### 6. 호출

| 동작 | 호출 |
|---|---|
| `[개념도 그리기]` — 미적중 / 적중 | **1** / 0 |
| `[다시 그리기]` | 1(먼저 묻는다) |
| 열기·크게·글로 보기·회전·RTL·그림 저장 | 0 |
| 개요 없이 그리기 | 불가 — 단추가 없다(먼저 11c 개요 1호출) |

#### 7. 수용 기준

**16-1**
- [ ] `[N]` `checkDiagram`: 경로 밖 `p` → 버림 · 없는 노드를 가리키는 엣지 버림 · 자기 고리 버림 · `r:'treat'` 버림 · 13노드 → 12 · 입력 밖 숫자 라벨 버림 · 엣지 1개 남음 → failed.
- [ ] `[N]` `layoutDiagram`: 같은 입력 두 번 → 같은 좌표(깊은 같음) · 고리 A→B→C→A → 끝남, 한 엣지 `rev` · 사슬 5 → 층 5 · 두 층 건너는 엣지에 경유점 · 표본 그래프 교차 수 ≤ 기준값 · `maxW 320` 에서 한 행 폭 ≤ 320(접힘) · `rtl` → 모든 x 가 거울(`x+w` 대칭) · 노드 겹침 0(상자 교차 검사).
- [ ] `[N]` `wrapLabel`: 3줄 넘으면 … · 긴 낱말 하나는 자름 · 아랍어 글자(가짜 measure)도 같은 규칙.
- [ ] `[N]` 요청: 규칙 1–6 글자 그대로 · 입력에 원문 문단 글 0(개요 글만) · 4,000자 넘으면 3단 뺌 → 그래도 넘으면 보내지 않음 · `byKind.diagram` +1 · 번역 요청 바이트 불변.
- 변이: 고리 끊기 지우기(무한 루프 시험이 시간 초과로 빨강) · RTL 거울 지우기 · enum 검사 지우기 · 숫자 거름 지우기.

**16-2**
- [ ] `[D]` 흉내 Gemini: 저장한 개요 → `[개념도 그리기]` → 요청 1건 → 그림(노드·화살표·라벨) + 글로 보기(트리 + 관계 목록) · 닫고 다시 → 0건 · 개요 레코드에 `diagram` 필드.
- [ ] `[D]` 접근성: `svg[role=img]` 에 이름, 글로 보기 목록 항목 수 = 엣지 수, 키보드로 `[크게]`·`[글로 보기]` 접기.
- [ ] `[D]` 360×740·412×915·915×412 × 4언어(대상 ar·ko): 쪽 가로 넘침 0, 12px 아래면 [크게] 상태, ar 에서 그림 거울·src 줄 ltr.
- [ ] `[D]` 네 테마에서 선·글자 대비(토큰), `innerHTML` 0, SVG 내보내기 파일이 열리고 색이 박혀 있다.
- [ ] `[D]` 개요를 다시 만든 뒤 → "개요가 바뀌었습니다" 줄.

#### 8. 결정 표 — 권장

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 16-D1 | 나누기 | (가) **16-1 순수·요청 · 16-2 화면** · (나) 한 Build | **(가)** — 배치 알고리즘은 화면 없이 시험이 촘촘하다 |
| 16-D2 | 입력 | (가) **저장한 개요(11c)만** · (나) 범위 원문 | **(가)** — 19-1-1 N4 · 17 #21. 원문은 6,000자 상한에 장이 안 들어간다(여러 호출) |
| 16-D3 | 크기 상한 | (가) **노드 12 · 엣지 16** · (나) 20·30 | **(가)** — 360px 폰에서 읽을 수 있는 크기. 큰 장은 범위를 나눠 개요를 따로 |
| 16-D4 | 배치 방식 | (가) **층 배치(고리 끊기 → 가장 긴 경로 층 → 경유점 → 무게중심 4번) · 위→아래** · (나) 힘 기반(스프링) · (다) 방사형 | **(가)** — 결정적(같은 입력 같은 그림 — 시험 가능), 원인→결과 방향이 위→아래로 읽힌다, 세로 화면에 맞다. (나)는 매번 달라지고 반복 수가 기기 속도에 달림 |
| 16-D5 | 관계 종류 | (가) **고정 8개, '치료' 없음** · (나) 자유 글 · (다) '치료' 포함 | **(가)** — 자유 글은 검증할 수 없다. 그림의 화살표 "→ 치료" 는 처방처럼 읽히기 쉽다(13절 의료 안전 쪽으로 좁힘 — 안전을 넓히는 쪽이 아니므로 위임 범위). 치료 내용은 개요 글(트리)에 그대로 있다 |
| 16-D6 | 결과 저장 | (가) **개요 레코드의 `diagram` 필드** · (나) `annotations` `kind:'diagram'` 따로 | **(가)** — 그림은 그 개요에 딸린다. 개요를 지우면 함께, 개요가 바뀌면 `basis` 로 알아챈다. 새 kind 는 삭제·9c 규칙을 늘린다 |
| 16-D7 | 그림의 글 대안 | (가) **그림 아래 "글로 보기" — 트리 + 관계 목록, 기본 펼침** · (나) `<desc>` 에만 | **(가)** — 화면 읽기·작은 화면 모두 목록이 더 낫다. 트리는 11c 것을 재사용 |
| 16-D8 | 원어 표시 | (가) **노드 아래 작은 줄(따로 된 `<text>` ltr)** · (나) 한 줄 괄호 | **(가)** — SVG `<text>` 한 줄에 RTL + 라틴 괄호를 섞으면 양방향 배치가 엔진마다 다르다 |
| 16-D9 | 작은 화면 | (가) **전체 보기 + 12px 문턱 아래면 [크게](그릇 안 스크롤)** · (나) 늘 전체 보기 · (다) 손가락 확대 직접 구현 | **(가)** — 쪽 가로 스크롤 0 을 지키고 글을 읽을 수 있다. (다)는 코드가 크다 |
| 16-D10 | 그림 내보내기 | (가) **SVG 파일(호출 0)** · (나) PNG · (다) 없음 | **(가)** — 장치가 작다(문자열 Blob). PNG 는 캔버스 그리기가 더 필요 |
| 16-D11 | 호출 없는 "구조 그림"(개요 트리를 그림으로) | (가) **만들지 않음 — 글 트리가 이미 있다** · (나) 0호출 트리 그림 | **(가)** — 관계 화살표가 개념도의 값이다. 트리 그림은 글 트리와 정보가 같다 |
| 16-D12 | 순서 | (가) **15 뒤(15 묶음에 작은 그림 칸) · 19 앞** | **(가)** — 11-3·15-2 화면에 붙는다 |

**운영자에게 물을 것** — 없음(부를 때만 1회, 입력은 이미 받은 요약의 묶음 — 새 외부 전송 범주 없음).

#### 9. 크기 · 시간 `[추정]`

| Build | Build | Review | 위험 |
|---|---|---|---|
| 16-1 요청·검증·배치 | 2.5h | 1.5h | 중간 — 배치 품질(교차·접힘), 결정성 |
| 16-2 그리기·화면 | 2.5h | 1.5h | 중간 — SVG 글자 폭·RTL·12px 문턱 |
| **합** | **5h** | **3h** | |

#### 10. 마지막 실기기 점검 묶음 (16 몫)
- [ ] `[M]` 실제 Gemini: 개요 3개(CMDT 장)로 그림 — 관계가 개요에 실제로 있는가(지어낸 화살표), 노드가 몇 개 남는가.
- [ ] `[M]` GT 7 아랍어: 노드 글자가 잘리거나 겹치지 않는가(`measureText` 와 실제 그리기 폭 차), [크게]에서 손가락 스크롤.
- [ ] `[M]` 화면 읽기(TalkBack) 로 "글로 보기" 목록을 읽는가.

#### 11. 이번엔 못 함
노드 끌어 옮기기·편집 · PNG 내보내기 · 여러 개요를 합친 큰 그림 · 그림에서 노드를 누르면 원문으로(개요 요점 → 저장 요약 → 문단: 3단 연결이라 다음에) · 그림 속 화살표 낭독.

---

### 새 소절 19. 사례 이미지 참조 — Open-i 검색·보기(판독 없음), 19 Build 설계 `[신설 2026-11-16 — 15·16·19·20 Plan]` `[운영자 결정 필요 — 19-Q1(새 외부 요청)·19-Q2(가용성 대안)]`

**방침**: 17 #23 · 13절 "의료 안전"(Open-i 는 교육용 참조 이미지 **검색·보기만**, 판독 기능 없음, 이미지를 AI 에 보내지 않음)을 그대로 따른다. AI 호출 0. **새 것은 앱이 직접 외부 서버에 요청(fetch)을 보낸다는 점**이다 — 13절 "외부 요청"(pdf.js CDN + AI 프로바이더뿐)을 바꾸므로 넣을지는 운영자가 정한다(19-Q1). 아래 설계는 승인되면 그대로 Build 할 수 있게 쓴다.

#### 1. 조사 결과 (2026-11-16)

##### 1-1. 지금 코드 사실
| 항목 | 지금 | 근거 |
|---|---|---|
| 외부 요청 | pdf.js CDN + Gemini 뿐. `ext/` 폴더 없음 · 앱에 CSP 메타 없음 · `fetch` 에 `referrerPolicy`·`credentials` 지정 0 | `index.html`(grep) · `js/ai/adapters/gemini.js` |
| 선택 동작 줄 | 아직 없다(8c-1). 11-2 가 `[⋯]` 넘침 메뉴, 18 이 `[찾아보기]`(새 탭 `{q}` 링크) — 18 추천 목록에 Radiopaedia(`[확인 필요]`) | 8cf·11·18 초안 |
| 검색어 길이 | 8c-1 `clampSelection(≤ 6낱말·60자)` · 18 `queryText` 같은 수치 | 8cf 4-2 · 18 초안 2 |

##### 1-2. Open-i API — 실제로 본 것
- **응답 꼴**(`https://openi.nlm.nih.gov/api/search?query=sarcoidosis&m=1&n=3&it=x`, 다른 망에서 한 번 성공): 최상위 `total`(588)·`min`·`max`·`count`·`list[]`. 항목 필드: `uid`(`PMC12235296`) · `pmcid` · `imgThumb`(`/imgs/100/…png` — **상대 경로**) · `imgLarge`(`/imgs/512/…`) · `imgThumbLarge` · `imgGrid150` · `image.caption`(**`<b>` 태그가 섞인 HTML** — "(A) Stage I `<b>`sarcoidosis`</b>`. Posteroanterior chest radiograph…") · `title` · `journal_title` · `journal_date` · `pmc_url` · `pubMed_url` · `fulltext_html_url` · `licenseURL` · `ccLicense`(`by`·`byncnd` …) · `detailedQueryURL` · `MeSH` · `authors` 등.
- **이용 조건**: 항목마다 다르다. `lic=by` 를 줘도 `by-nc-nd`·**조건 없음(필드 없음)** 항목이 섞여 왔다(pneumothorax 5개 중 2개 필드 없음) → **항목마다 표시해야 하고, 거름으로 믿을 수 없다.** 이미지 저작권은 원 논문 출판사·저자에 있다 `[추정 — Open-i 이용 안내 쪽은 스크립트로 그려 읽지 못함]`.
- **`it=x`**(X-ray) 거름은 흉부 X 선 사진을 돌려줬다. 다른 값(`c` CT · `m` MRI · `u` 초음파 · `ph` 사진)은 **`[확인 필요]`** — 문서 쪽(`/services`)이 스크립트로 그려져 읽지 못했다.
- **가용성 — 불안정**: 한국 IP(운영자 PC 망, CloudFront `ICN` 거점)에서 `openi.nlm.nih.gov` 의 **첫 화면·API·이미지 모두** `200 text/html` 13,854바이트 "The web site is currently under maintenance" 쪽(헤더 `X-Cache: Error from cloudfront`, 쪽 파일 `Last-Modified: 2025-07-23`). 다른 망(웹 조회 도구)에서는 API JSON 이 두 번 왔고, 그 뒤 같은 도구에서도 검색 화면·API 가 "점검 중" 쪽을 냈다. 즉 **지역에 따라 막히거나 서비스 자체가 오락가락한다** `[미확인 — 원인]`. 시리아(Nour, VPN 사용)에서는 `[미확인]`.
- **CORS**: 한국에서는 오류 쪽만 와서 API 의 `access-control-allow-origin` 을 **확인하지 못했다** `[미확인]`. 오류 쪽은 `Vary: Origin` 만 있고 허용 헤더 없음. → 19-0 에서 확인.
- **주의**: 점검 쪽이 **`200` + `text/html`** 로 온다 — 상태 코드만 보면 성공으로 착각한다. 응답 `content-type` 이 JSON 이 아니면 "쓸 수 없음"으로 본다.

##### 1-3. 대안 — 위키미디어 공용(Commons) API (조사만)
- `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=…&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320&format=json&origin=*` — 한국 IP 에서 **`access-control-allow-origin: *`** 확인(키 없음). 파일마다 `extmetadata.LicenseShortName`·`AttributionRequired`·`Artist`.
- 단 "sarcoidosis chest radiograph" 검색 4개 중 3개가 PDF 문서(해군 의학 소식지 등), 관련 이미지는 1개("Pulmonary oedema", CC BY-SA 3.0, Frank Gaillard) — **의학 영상 검색 품질이 낮다**(`filetype:bitmap` 등 거름은 `[확인 필요]`). 새 외부 서버라 이것도 운영자 결정(19-Q2).
- 조사 중 한 번: 받은 JSON 을 Node 로 바로 넘기는 한 줄 명령이 훅("내려받은 스크립트를 검사 없이 바로 실행")에 막혔다 — 변형하지 않고 웹 조회 도구로 같은 응답을 읽었다.

출처: Open-i 검색 API 응답(위 URL, 2026-11-16) · Open-i 데이터셋 카탈로그 `https://catalog.data.gov/dataset/open-i`(API 문서 위치 `openi.nlm.nih.gov/services#searchAPIUsingGET`) · NLM 2025-07 점검 공지 `https://www.nlm.nih.gov/pubs/techbull/ja25/ja25_ncbi_website_maintenance.html` · 위키미디어 공용 API 응답(위 URL).

#### 2. 설계 (19-1 — 19-Q1 승인 · 19-0 통과 뒤)

##### 2-0. 19-0 가용성 확인 (Build 전, 운영자·Nour — 10분)
`dev/openi-check.html`(새 dev 파일, 앱 무변 — 19-1 Build 의 첫 일로 만들어 배포) 한 쪽: [확인] → API 1회(`query=pneumothorax&m=1&n=3&it=x`) → `status`·`content-type`·JSON 여부·`access-control-allow-origin` 읽힘 여부(`fetch` 가 CORS 로 던지면 "CORS 막힘")·썸네일 하나 `<img>` 로드 여부를 표로. 운영자 PC(한국)·Nour 기기(VPN 켬/끔) 결과로:
- **JSON + CORS 통과 + 이미지 로드** → 19-1 그대로.
- **CORS 막힘 · 점검 쪽 · 시간 초과** → 19-1 은 **링크만**(아래 2-4 폴백만 Build — 0.5시간)으로 줄이거나 넣지 않음(19-Q2).

##### 2-1. 서비스 `js/ext/openi.js` · 순수 `js/text/openi.js`
- `searchImages(q, {type, from, signal}) → {status:'ok'|'empty'|'unavailable'|'offline', total, items[]}`:
  `fetch(OPENI.API + '?query=' + encodeURIComponent(q) + '&m=' + from + '&n=' + OPENI.PAGE(12) + '&it=' + type, {mode:'cors', credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store', signal})` · 시간 상한 `OPENI.TIMEOUT_MS`(10초) · `content-type` 에 `json` 이 없으면 `unavailable`(점검 쪽) · 네트워크·CORS 오류 → `navigator.onLine` 이면 `unavailable`, 아니면 `offline`. **던지지 않는다.**
- 순수 `parseOpenI(json) → items[{uid, thumb, large, caption, title, journal, year, license:{code, url}|null, articleUrl}]`: 상대 경로에 `OPENI.ORIGIN` 붙임 · **경로·주소는 `https://openi.nlm.nih.gov/` 또는 `https://www.ncbi.nlm.nih.gov/`·`https://pmc.ncbi.nlm.nih.gov/` 로 시작하는 것만**(그 밖 항목은 버림) · 캡션은 **태그 제거 + 엔티티 풀기 → 순수 글자**(`stripTags` — `<b>` 등, 300자 자름) · `ccLicense` → `CC BY 4.0` 같은 짧은 이름 표(`by·by-sa·by-nc·by-nc-sa·by-nd·by-nc-nd·cc0·pd`), 모르는 값·없음 → `null`.
- import: `ext/*` 는 `config`·`text/*` 만(새 계층 — `ai/adapters/*` 와 같은 자리: 네트워크를 만지는 서비스). `ui/` 가 부른다.

##### 2-2. 입구와 검색어
- 선택 동작 줄 `[⋯]` → **`[사례 이미지]`**(19-D2) — 선택 글자 → `queryText`(18 과 같은 함수·같은 상한 6낱말·60자). **누를 때만 1요청.** 검색어는 화면 맨 위에 그대로 보이고 고칠 수 있다(`dir=ltr` 입력 칸 — 다시 검색은 [찾기] 누를 때만).
- 원본 보기·퀴즈·검색 화면에서는 입구 없음(선택이 없다). 음성 명령 없음.

##### 2-3. 이미지 시트 `js/ui/images.js`
- 11 요약 시트와 같은 높이 식의 시트. 위 → 아래: 검색어 칸 + `[찾기]` · 종류 칩 `[X선][CT][MRI][초음파][전체]`(`it` — `x` 외 값은 19-0/19-1 에서 확인, 안 되는 값은 칩을 뺀다) · **고정 고지 두 줄**(19-D4): "교육용 참조 이미지입니다 — 진단·판독에 쓰지 마세요." · "사진은 원 논문의 증례이고 MedReader 는 사진을 해석하지 않습니다."
- 격자(2열, 썸네일 `<img loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="{캡션 앞 80자}">`) — 누르면 크게(`imgLarge`) + **캡션(원문 그대로 `textContent`, `dir=ltr`)** · 논문 제목·학술지·연도 · **이용 조건**("CC BY 4.0" 링크 / 없으면 "이용 조건 표시 없음 — 원 논문에서 확인") · `[원 논문 보기]`(새 탭 `rel="noopener noreferrer"`) · "출처: Open-i (U.S. National Library of Medicine)".
- `[더 보기]`(다음 12개 — 1요청). 결과 0 → "찾은 사진이 없습니다 — 영어 용어로 찾아보세요".
- **하지 않는 것**: 사진 저장·오프라인 캐시·내려받기 단추(19-D5) · 사진을 AI 에 보내는 단추(13절 — 버튼 자체가 없다) · 내 사진 올리기 · 캡션 번역(호출 — 19-D6, "못 함").
- 낭독은 멈추지 않는다. `unavailable` → "Open-i 에 지금 연결할 수 없습니다(점검 중이거나 이 지역에서 막혔을 수 있습니다)" + 2-4 링크. `offline` → 14-2 오프라인 문구.

##### 2-4. 폴백 — 링크만
- `[Open-i 에서 열기]` → 새 탭 `https://openi.nlm.nih.gov/gridquery?q={q}&it=x`(18 `fillQuery` 와 같은 인코딩). 18 추천 링크 목록에도 한 줄 더함(`[확인 필요]` 표시 — 18 표와 같은 꼴). 이 경로는 앱의 요청이 아니다(새 탭 — 18 과 같다).

#### 3. 고치는 파일
| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **19-1** | `dev/openi-check.html`(19-0) · `js/ext/openi.js`(약 80) · `js/text/openi.js`(순수 약 110) · `js/ui/images.js`(약 260) · `tests/openi-19.test.mjs`(합성 JSON — 실제 응답 글 안 넣음) | `js/config.js`(`OPENI` +12) · `js/ui/selbar.js`(`[⋯]` 에 한 줄 +8) · `js/config.js` `LINKS` 추천 한 줄(18) · `index.html`(시트) · `css/reader.css` · i18n 4개(약 20키) |

#### 4. 호출 · 외부 요청
| 동작 | AI 호출 | 외부 요청 |
|---|---|---|
| `[사례 이미지]`·`[찾기]`·종류 칩 | 0 | **Open-i API 1회**(검색어 = 고른 낱말 ≤ 60자) |
| 썸네일 보기 | 0 | 이미지 12개(`openi.nlm.nih.gov/imgs/…` — 리퍼러 없음) |
| 크게 보기 | 0 | 큰 이미지 1개 |
| `[더 보기]` | 0 | API 1회 + 이미지 12 |
| `[원 논문 보기]`·`[Open-i 에서 열기]` | 0 | 새 탭(앱 요청 아님) |
| 그 밖 · 자동 | 0 | **0** |

보내는 것: 고른 낱말(교과서 용어)과 기기 IP·브라우저 정보(모든 웹 요청과 같음). 쿠키·리퍼러·키·문서 이름은 보내지 않는다.

#### 5. 수용 기준
- [ ] `[N]` `parseOpenI`: 상대 경로 → 절대 · 다른 호스트 주소 항목 버림 · 캡션 `<b>`·`&amp;` → 순수 글자 · `<script>` 꼴 글자는 글자로만 · `ccLicense` 표 · 없음 → null · 300자 자름.
- [ ] `[N]` `searchImages`(가짜 fetch): JSON → ok · `text/html` 200(점검 쪽) → unavailable · TypeError → unavailable/offline · 10초 → 중단 · 요청 URL 에 키·문서 id 0, `credentials:'omit'`·`referrerPolicy:'no-referrer'`.
- [ ] `[D]` 가로챈 Open-i(합성 JSON·합성 PNG): 선택 → `[⋯]`→`[사례 이미지]` → 요청 1건(검색어만) · 격자 12 · 크게 · 이용 조건 줄 · 고지 두 줄 늘 보임 · `[더 보기]` → 1건 더.
- [ ] `[D]` 점검 쪽(HTML 200) → 안내 + `[Open-i 에서 열기]` 링크(가로챈 `a.click` 의 href·rel) · 요청 수 그대로.
- [ ] `[D]` 사진을 AI·다른 곳으로 보내는 요청 0(네트워크 목록에 Gemini 0) · 시트를 닫으면 이미지 요청이 더 나가지 않는다.
- [ ] `[D]` 360×740·412×915·915×412 × 4언어 · `innerHTML` 0 · `alt` 있음 · 캡션 `dir=ltr`(ar UI).
- 변이: 호스트 검사 지우기 · content-type 검사 지우기(점검 쪽을 빈 결과로) · 캡션 태그 제거 지우기 · 고지 줄 빼기.

#### 6. 결정 표
| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 19-D1 | 순서 | (가) **19-0 가용성 확인 → 19-1, 20·15·16 뒤** · (나) 확인 없이 Build | **(가)** — 한국 IP 에서 지금 쓸 수 없다. 확인에 10분, 안 되면 Build 2.5시간을 아낀다 |
| 19-D2 | 입구 | (가) **선택 동작 줄 `[⋯]` 한 줄** · (나) 단어 시트 안 · (다) 서재 메뉴 검색 화면 | **(가)** — 읽다가 만난 용어에서 바로. 검색어를 고칠 수 있으므로 따로 화면이 필요 없다 |
| 19-D3 | 요청 방식 | (가) **앱이 API fetch + 이미지 hotlink(리퍼러·쿠키 없음)** · (나) 새 탭 링크만 | 19-Q1 에 따름 — (가)가 승인되면 (가), 아니면 (나) |
| 19-D4 | 고지 | (가) **시트 위 고정 두 줄(판독 아님 · 원 논문 증례)** · (나) 첫 사용 한 번 | **(가)** — 의료 안전(13·18절)을 강하게. 공간 두 줄 |
| 19-D5 | 저장 | (가) **저장·캐시·내려받기 없음 — 볼 때마다 Open-i 에서** · (나) 즐겨찾기(주소·캡션만) | **(가)** — 이미지 저작권은 원 논문에 있다(조건 제각각). (나)는 나중에 `annotations` 로 작게 더할 수 있다 |
| 19-D6 | 캡션 번역 | (가) **하지 않음(영어 원문 그대로)** · (나) [번역] 1호출 | **(가)** — 호출을 쓰는 새 경로이고 캡션에 진단 문장이 있다. 필요하면 캡션을 길게 눌러 8c 번역을 쓸 수 없다(시트 밖) — "못 함"에 기록 |
| 19-D7 | 이용 조건 거름 | (가) **거르지 않고 항목마다 표시(없으면 "표시 없음")** · (나) `lic=by` 로만 | **(가)** — 실측에서 `lic` 거름이 믿을 수 없었다 |

**운영자에게 물을 것**
| # | 무엇 | 지금 설계 | 바꾸면 |
|---|---|---|---|
| **19-Q1** | **앱이 새 외부 서버(Open-i, 미 국립의학도서관)에 직접 요청을 보내도 되나** — 13절 "외부 요청은 pdf.js CDN + AI 프로바이더뿐"이 바뀐다. 보내는 것: 고른 낱말(≤ 60자) + IP·브라우저 정보, 이미지도 그 서버에서 받음 | 권장: **허용하되 누를 때만·리퍼러/쿠키 없음·저장 없음**. 허용하지 않으면 2-4 링크만(새 탭) — 앱 요청 0, Build 0.5시간 | 링크만이면 사진을 앱 안에서 못 보고 Open-i 화면(영어)으로 간다 |
| **19-Q2** | Open-i 가 19-0 에서 막히면(한국·시리아) **대안 서버**를 쓰나 — 위키미디어 공용(CORS 됨, 조건 표시 좋음, 의학 영상 품질 낮음) | 권장: **대안 넣지 않음 — 링크만(Open-i·Radiopaedia 추천 링크)** | 위키미디어를 넣으면 또 하나의 외부 서버·검색 품질 측정 Plan 필요 |
| 19-Q3 | 시리아에서 미국 정부 사이트 접근 — Nour 는 VPN 을 쓴다. 앱 문구는 VPN 을 말하지 않는다(13절 "VPN") | 그대로: "연결할 수 없습니다(점검 중이거나 이 지역에서 막혔을 수 있습니다)"까지만 | — |

#### 7. 크기 · 시간 `[추정]`
19-0 확인 페이지 0.3h(19-1 안) · 19-1 Build 2.5h · Review 1h. 위험 중간 — **외부 서비스 가용성**(코드 위험은 낮음). 링크만이면 Build 0.5h · Review 0.3h. 옛 추정 1.5시간은 가용성 확인·폴백을 세지 않았다.

#### 8. 마지막 실기기 점검 묶음 (19 몫)
- [ ] `[M]` 19-0: 운영자 PC(한국)·Nour GT 7(VPN 켬/끔) `dev/openi-check.html` 결과표 — **이것이 Build 시작 조건.**
- [ ] `[M]` GT 7 모바일 데이터: 썸네일 12개 로드 시간·데이터 양(한 번에 약 수백 KB `[추정]`).
- [ ] `[M]` Nour 판단: "pneumothorax", "sarcoidosis" 결과가 공부에 쓸모 있는가(논문 그림이 많다 — 순수 증례 사진 비율).

#### 9. 이번엔 못 함
캡션 번역 · 즐겨찾기 · 이미지로 검색 · MedPix 등 다른 모음 거름(`coll` — `[확인 필요]`) · 오프라인 · 위키미디어 대안(19-Q2).

---

### 새 소절 20. 필기·하이라이트 — 20 Build 설계 `[신설 2026-11-16 — 15·16·19·20 Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 20-D1–D14]`

**방침**: 17 #17(`annotations` `anchor{pageNo, lineIds, textHash}` — 재추출로 lineId 가 바뀌어도 다시 앵커)과 요구 7("수정·추가", 17-3)을 따른다. 호출 0 · DB 버전 3 그대로. 본문 DOM 에 아무것도 끼우지 않는다(11-D22 와 같은 까닭 — 지금 문장 위치·편안 영역을 흔들지 않는다).

#### 1. 지금 코드 사실

| 항목 | 지금 | 근거 |
|---|---|---|
| `annotations` 스토어 | 키 `id`, 인덱스 `docId_pageNo`·`docId`·`kind`. **쓰는 코드 0.** `CASCADE_STORES` 에 있음. 11-1 이 `summary`·`outline` 을 연쇄에서 빼기로(초안) | `js/db.js:84-89·451-454` · 11 초안 4-4 |
| 줄 id | `pageNo + ':' + 읽기 순서 번호` — 7b 행 표가 잡히면 **다시 매긴다**. 다단 순서(8q)·표(8i-4) 규칙이 바뀌면 같은 글의 줄 id 가 바뀐다 | `js/text/layout.js:178·203` |
| 문단 id | `pageNo + ':p' + n` | `js/text/blocks.js:641` |
| 쪽 해시 | `pages.textHash` = 쪽 전체 줄 글자 해시(문단 해시 아님) | `js/pdf/extract.js:562-564` |
| 판 | `algoVersion = 12` | `js/text/layout.js:101` |
| 리플로우 DOM | `p.para[data-para-id]` > `span.line[data-line-id][data-flow="1"]`(줄 글자 = 첫 텍스트 노드) | `js/ui/reader.js:19-20·1398·1428` |
| 글자 구간 칠하기 | `charhl.paintCharRanges(name, ranges, findLine)` — CSS Custom Highlight, 미지원이면 `false` → 줄 클래스로 물러섬. 검색이 `search-hit`/`search-cur` 두 이름으로 쓴다 | `js/ui/charhl.js:38-70` · `js/ui/search.js:1794-1810` |
| 화면 글자 ↔ 줄 구간 | `screenIndex(flowParasOf(desc), joinPieces)` · `rangesOnScreen` · `rangesFor`(하이픈으로 갈린 낱말은 구간 둘) — **`ui/search.js` 안에** 있다(순수) | `js/ui/search.js:139-213` · `js/text/search.js:327-337` · `js/text/screen.js:170-235` |
| 원본 오버레이 | 낭독용 `.hl-line` 상자 **풀(최대 `HL_MAX_BOXES` 8)** — 줄 bbox + `render.charRangeX` 로 첫·끝 줄 가로 자름. 회전 줄 제외 | `js/ui/original.js:447-457·491-540` |
| 줄 다시 매핑 | 같은 쪽을 새 판으로 다시 그릴 때 옛 줄 id → 새 줄 id(글자로) `buildLineRemap` | `js/ui/reader.js:245-290·982` |
| 라우트 | `#/notes`(P2)는 12-1 표에만 | spec 12-1 · `js/router.js:13-15` |

#### 2. 데이터 — `annotations` (DB 3 그대로, 필드만)

```
{ id, kind:'highlight'|'note', docId, pageNo, fileHash(사본), docTitle(사본),
  anchor:{ pageNo, algo(만들 때 algoVersion), lineIds[], start:{lineId, off}, end:{lineId, off},
           paraId, textHash(문단 글 해시 — 11 요약과 같은 식 hashHex(normalizeForHash(문단 글))),
           quote:{ exact(≤ 400자), prefix(앞 32자), suffix(뒤 32자) } },
  color:'yellow'|'green'|'blue'|'pink'   (highlight 만),
  note:''                                (highlight 에 붙인 메모 · note 의 본문, ≤ 2,000자),
  createdAt(ms), updatedAt(ms) }
```
- `kind:'note'` = 색 없는 메모(점선 밑줄). `kind:'highlight'` 에도 메모를 붙일 수 있다(20-D3).
- 인용 글자는 **문단 결합 글자**(`joinPieces` — 하이픈 결합 뒤) 기준이라 줄바꿈이 달라져도 같다. 문단을 넘는 선택은 문단마다 레코드 하나(20-D5).
- 레코드 맨 위 `docId`·`pageNo` → `docId_pageNo` 인덱스로 쪽마다 한 번에 읽는다.

#### 3. 앵커 다시 찾기 — 순수 `js/text/anchor.js` (20-1)

```
anchorOf(idx, from, to, ctx) → anchor        # idx = screenIndex(…) — 선택 오프셋에서 인용·앞뒤·줄 구간·문단을 만든다
resolve(anchor, idx, {algo, paraHashes}) → {ranges:[{id,start,end}], how:'exact'|'para'|'page'|'fuzzy', score} | null
  1. algo 같음 + 줄 구간의 글자 == exact            → 그대로(how 'exact')
  2. 같은 textHash 문단 안에서 exact 찾기            → 여러 개면 prefix·suffix 가 가장 길게 맞는 것('para')
  3. 쪽 전체 글자에서 exact 찾기                     → 같은 고르기('page')
  4. 공백·대소문자·하이픈을 접은 글자(foldText)로 2–3 → ('fuzzy')
  5. 없음 → null (고아 — 목록에 "위치를 찾지 못함", 인용은 남음)
```
- 쪽 번호는 PDF 쪽이라 재추출로 바뀌지 않는다 — 찾기는 그 쪽 안에서만(값싸고 오탐이 적다).
- **찾은 결과로 레코드를 고쳐 쓰지 않는다**(20-D6) — 화면마다 다시 찾는다(쪽당 레코드 수십 개, 문자열 찾기 1ms 미만 `[추정]`). `algo` 가 다르고 `how ≠ 'exact'` 인 것만 그 쪽을 처음 그릴 때 한 번 `anchor.lineIds/start/end/algo` 를 새 값으로 `db.patch`(다음부터 1번에 걸리게).
- `screenIndex`·`rangesOnScreen` 은 **`text/screen.js` 로 옮긴다**(순수 — 검색·필기·15 근거 찾기가 함께 씀, 옮김만 · 검색 시험 무변). `findQuote(desc, quote)` = `resolve` 의 2–4 를 감싼 이름(15 가 쓴다).

#### 4. 칠하기 (20-1 — `js/ui/annotate.js`)

- **리플로우**: 쪽을 그릴 때(`onPageRender`) 그 쪽 레코드를 읽어(`docId_pageNo`) `resolve` → 색마다 이름 하나 `anno-yellow`·`anno-green`·`anno-blue`·`anno-pink`·`anno-note` 로 `charhl.paintCharRanges`(이름 다섯 — 검색·낭독과 이름이 다르다). 우선순위: 낭독 하이라이트·검색이 위(`Highlight.priority` — 필기는 0, 검색 1, 낭독 2). 미지원 브라우저 → 줄 클래스 `.anno-line-{color}`(줄 통째 옅은 배경 — 물러섬). 색은 토큰 `--anno-*` 네 테마·고대비마다(세피아에서 노랑이 묻히지 않게 — 20-D9).
- **원본 보기**: 오버레이에 **필기 층 하나 더**(`.anno-layer`, 낭독 상자 풀과 따로) — 쪽마다 필요한 만큼 상자(줄 bbox + `charRangeX`, 회전 줄 제외), 확대·쪽 넘김 때 다시. 상자 상한 `ANNO.MAX_BOXES_PAGE`(200) — 넘으면 줄 통째 상자로 합친다.
- **표시만**: 본문 DOM 에 아이콘·글자를 끼우지 않는다. 메모가 있는 곳은 점선 밑줄(`anno-note`)로만 보이고, 메모 글은 아래 5 의 쪽 시트·선택 줄에서 연다.
- 다시 그리기 때(`onPageRepaint` — 판이 바뀌어 다시 그림) 다시 찾는다(`buildLineRemap` 에 기대지 않는다 — 인용이 정본).

#### 5. 만들기 · 고치기 (20-2)

- **선택 동작 줄 `[⋯]`**(8c-1·11-2): 맨 위에 **색 네 칸 줄**(`[●노랑][●초록][●파랑][●분홍]` — 누르면 그 색 하이라이트) + `[메모]`(메모 시트). 선택 범위가 이미 필기와 겹치면 `[⋯]` 맨 위가 `[메모 보기/고치기]`·`[색 바꾸기]`·`[지우기]`(페이지 안 확인 없이 지우고 3초 `[되돌리기]` — 20-D10).
- **메모 시트**(`role="dialog"`, 11 시트와 같은 높이 식): 인용(작게, `dir=ltr`) · 글 칸(`<textarea>`, 2,000자, `dir=auto` — 아랍어·영어 섞임) · `[저장]`·`[지우기]`·`[닫기]`. 키보드가 올라와도 저장 단추가 보이게(`visualViewport` — 8f-2 단어 시트와 같은 장치).
- **음성 "표시"**(9b 명령 `mark` — 20-D7): 지금 문장(`speaker.getCurrent()`, 줄 모드면 그 줄을 담은 문장)을 노랑으로 → 확인 줄 + 한 마디 `voice.mark.done` → `restore(was)`(읽던 중이면 이어 읽기). 같은 문장이 이미 표시면 그대로("이미 표시됨"). 표에 `{id:'mark', ar:['علّم','علم','ظلل','ظلّل','تظليل','علّم الجملة'], en:['highlight','mark','mark this']}` `[검토 — Nour·운영자]` — 9b 표 무결성 시험(C3)을 지난다. 원본 보기에서도 된다(선택이 없어도).
- **쪽 필기 칩**: 리더 상단 줄 퀴즈 칩 자리 옆에 "필기 n" 작은 칩(그 쪽에 1개 이상일 때만) → **쪽 필기 시트**: 그 쪽 필기 목록(색 점·인용 앞부분·메모 앞부분) — 줄을 누르면 그 자리로 굴림(`revealLine`)·메모 시트. 칩은 쪽을 넘길 때 다시 센다(인덱스 `count`). 8e compact(가로)에서는 칩 숨김 — `[⋯]`·필기 화면으로.
- 손이 이긴다: 만들기·지우기는 낭독을 멈추지 않는다(선택 줄 규칙 그대로).

#### 6. 필기 화면 · 내보내기 · 다시 붙이기 (20-3 — `js/ui/notes.js`)

- 라우트 `#/notes`(전체)·`#/notes/:docId`·`#/notes/:docId/:range`(15 묶음에서). 입구: 서재 카드 `[⋯]` "필기" · 쪽 필기 시트 "이 책 필기 모두" · 15 묶음 필기 줄.
- 목록: 책 → 장(개요 깊이 0) → 쪽 순. 줄(48px+): 색 점 · 인용(`dir=ltr`) · 메모(`dir=auto`) · 쪽 라벨 · `[원문으로]`(그 쪽 → `resolve` → 굴림, 고아면 쪽 처음 + "위치를 찾지 못했습니다") · `[메모]` · `[삭제]`. 거르기 칩: 색 · 메모 있는 것만 · 위치 못 찾은 것.
- **내보내기**(호출 0): `[텍스트로 내보내기]`(Markdown 꼴 `.md` — 책 제목 `#`, 장 `##`, 줄마다 `> 인용` + 메모 + 쪽 라벨, UTF-8 BOM·CRLF — 11-3 `exportText` 와 같은 장치) + 화면 한 줄 "교과서 문장 인용이 들어 있습니다 — 공유에 주의하세요".
- **문서를 지워도 남는다 · 다시 붙는다(20-D11)**: `db.deleteDocument` 가 `annotations` 를 **아예 쓸지 않게**(`CASCADE_STORES` 에서 뺌 — 11 의 `summary`·`outline` 예외를 포함해 스토어 전체, 한 줄). 서재 삭제 확인 "남습니다" 줄에 "필기 n"(11·12 `keptLine` 에 수 하나). **같은 PDF 를 다시 가져오면**(`library` 새 문서 만들 때) `fileHash` 가 같은 고아 레코드(`docId` 가 지금 문서 목록에 없는 것)의 `docId` 를 새 id 로 바꾼다(한 트랜잭션, 요약·개요 레코드도 같은 규칙 — 11 레코드에 `fileHash` 사본 한 줄 넘김). 필기 화면에서 고아 책은 `docTitle` 묶음 + "PDF 를 다시 가져오면 다시 붙습니다".
- 9c: `annotations` 는 이미 "항상"(9c 초안 2), 병합 `updatedAt` 새로운 쪽 · 문서 없이도 넣는다(11 과 같은 규칙) — 9c 의 `docId` 바꿔 쓰기(`fileHash` 맞추기)가 그대로 맞다.

#### 7. 12 기억 카드 · 11 요약과의 관계
- **따로 둔다**(20-D12): 하이라이트는 "자리에 표시", 기억 카드는 "복습할 문장(앞·뒷면)". 같은 선택 줄 `[⋯]` 에 둘 다 있다. 하이라이트를 카드로 바꾸는 단추는 두지 않는다(카드는 문장 단위 — 하이라이트는 낱말 몇 개일 수 있다).
- 15 묶음은 범위의 필기 수를 보인다. 11 저장 요약은 `kind:'summary'` 로 같은 스토어지만 필기 화면에는 나오지 않는다(11-3 모아 보기가 정본).

#### 8. 고치는 파일

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **20-1** 앵커·저장·칠하기 | `js/text/anchor.js`(순수 약 200) · `js/notes/annotations.js`(서비스 약 180 — `create`·`update`·`remove`·`forPage`·`list`·`count`·`reattach(fileHash, newId)`) · `js/ui/annotate.js`(약 200 — 리플로우·원본 칠하기) · `tests/anchor-20.test.mjs` · `tests/annotations-20.test.mjs` | `js/text/screen.js`(`screenIndex`·`rangesOnScreen` 옮김 +70) · `js/ui/search.js`(import 바꿈 −70) · `js/ui/original.js`(필기 층 +60) · `js/ui/reader.js`(배선 +10) · `js/config.js`(`ANNO` +8) · `css/reader.css`·`css/tokens.css`(색 토큰 4테마) |
| **20-2** 만들기·음성·쪽 시트 | `js/ui/notesheet.js`(메모 시트·쪽 필기 시트 약 260) · `tests/annotate-ui-20.test.mjs` | `js/ui/selbar.js`(`[⋯]` 색 줄·메모·겹침 갈래 +50) · `js/voice/commands.js`(`mark`) · `js/ui/voice.js`(갈래 +6) · `js/ui/controls.js`(+15) · `js/ui/reader.js`(칩 +20) · `index.html` · `css/reader.css` · i18n 4개(약 22키) |
| **20-3** 필기 화면·내보내기·다시 붙이기 | `js/ui/notes.js`(약 380) · `tests/notes-ui-20.test.mjs` | `js/router.js`(`notes` + `notesHash`) · `js/main.js`(+4) · `js/db.js`(`CASCADE_STORES` 에서 `annotations` 뺌 −1) · `js/ui/library.js`(카드 [⋯] · 삭제 확인 수 · 가져오기 때 `reattach` +10) · `index.html` · `css/screens.css` · i18n 4개(약 24키) |

- import: `notes/annotations.js` 는 `notes/*` 행(11 초안 (C) — `config`·`text/*`·`db`·`hash`). `text/anchor.js` 순수. 새 `js/*.js` 마다 `stamp-importmap --check` 0.

#### 9. 수용 기준

**20-1**
- [ ] `[N]` `anchorOf`·`resolve`: 같은 판 → `exact` · **줄 id 를 모두 바꾼 판**(합성: 행 순서 뒤섞기) → `para` 로 같은 글자 · 문단 해시도 다른 판(앞 문단 글자 한 낱말 바뀜) → `page` · 같은 낱말이 쪽에 셋 → prefix·suffix 로 맞는 것 · 하이픈 줄바꿈이 바뀜("cardio-\nvascular" ↔ 한 줄) → 같은 글자 · 인용이 사라짐 → null.
- [ ] `[N]` 실물 회귀(Build 가 측정 스크립트로, 결과에 글 0): CMDT 2026 표본 20쪽에서 무작위 필기 200개를 지금 판으로 만들고, **8i 이전 판처럼 행 표를 끈 판**으로 다시 그린 쪽에서 `resolve` — 찾음 ≥ 99%, 다른 자리 0(글자 비교).
- [ ] `[N]` (fake-idb) 서비스: 쪽 인덱스로 읽기 · `algo` 다른 레코드는 처음 그릴 때 한 번만 고쳐 씀 · `reattach` 가 같은 `fileHash` 고아만 옮김.
- [ ] `[D]` 리플로우: 심어 둔 필기 3색 → `CSS.highlights` 에 이름 셋, 낭독 하이라이트가 위 · Highlight 미지원 흉내 → 줄 클래스 · 원본 보기: `.anno-layer` 상자가 줄 bbox 안, 확대 뒤 다시 맞음.
- [ ] `[D]` 검색 강조·검색 시험 전부 그대로(옮김 회귀 0).
- 변이: `resolve` 2단계(문단 해시) 지우기 → 줄 id 바뀐 판 시험 빨강 · prefix/suffix 고르기 지우기 → 셋 중 하나 시험 빨강 · 칠하기 우선순위 뒤집기.

**20-2**
- [ ] `[D]` 선택 → `[⋯]` → 노랑 → 레코드 1개·즉시 칠함 · 겹친 선택 → `[색 바꾸기]`·`[지우기]`·`[되돌리기]` · 메모 저장 → `note` · 점선 밑줄.
- [ ] `[D]` 음성 «علّم»(9b-2 가짜 인식기) 낭독 중 → 지금 문장 노랑 + 한 마디 + **이어 읽기** · 원본 보기에서도.
- [ ] `[D]` 쪽 칩 "필기 2" → 시트 → 줄 누르면 그 자리 · 8e compact 에서 칩 숨김.
- [ ] `[D]` 낭독 중 만들기·지우기 → 발화 끊김 0. 360×740·412×915·915×412 × 4언어 · 메모 칸 `dir=auto` · 키보드 올라와도 [저장] 보임(visualViewport 흉내) · `innerHTML` 0.
- 변이: 음성 경로 `restore(was)` 빼기 · 겹침 판정 지우기(같은 자리에 둘).

**20-3**
- [ ] `[D]` `#/notes/:docId` 장·쪽 순 · 거르기 · `[원문으로]` → 그 자리 편안 영역 안 · 고아 → 쪽 처음 + 한 줄.
- [ ] `[D]` 문서 삭제 → 필기 남음, 삭제 확인 줄에 수 · 같은 PDF 다시 가져오기 → 필기가 새 문서에 붙어 칠해짐 · 다른 PDF → 붙지 않음.
- [ ] `[N]` 내보내기: BOM·CRLF·인용 `>`·아랍어 메모 그대로·키 문자열 0. `[D]` Blob 가로채 줄 수.
- 변이: `reattach` 의 `fileHash` 비교 지우기(다른 책에 붙음 빨강) · `CASCADE_STORES` 에 다시 넣기.

**모든 Build 공통**: `node --test` 전부 · `stamp-importmap --check` 0 · `innerHTML` 새 사용 0 · 콘솔 오류 0 · 네트워크 요청 0(20) · 진짜 키 0.

#### 10. 결정 표 — 권장

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 20-D1 | 나누기 | (가) **세 Build: 앵커·칠하기 · 만들기·음성 · 화면·내보내기·다시 붙이기** · (나) 둘 | **(가)** — 각 2.5–3시간. 앵커는 회귀 측정이 따로 필요하다 |
| 20-D2 | 앵커 | (가) **인용(exact+앞뒤 32자) + 문단 해시 + 줄 구간 + 판** · (나) 9-2 그대로(`lineIds`+`textHash`) · (다) 쪽 글자 오프셋만 | **(가)** — 줄 id 는 읽기 순서 번호라 8q·8i-4 같은 판 올림에 바뀐다(`layout.js:178·203`). 인용은 W3C 웹 주석의 TextQuoteSelector 와 같은 생각 — 재추출을 견딘다 |
| 20-D3 | 종류 | (가) **9-2 의 둘 — `highlight`(색 + 메모 선택) · `note`(색 없는 메모)** · (나) 하나로 합침 | **(가)** — 9-2 그대로, 필드 추가만 |
| 20-D4 | 색 | (가) **넷(노랑·초록·파랑·분홍) — 의미는 사용자가** · (나) 하나 | **(가)** — 흔한 공부 습관(정의·중요·모름…). 넷이면 `[⋯]` 한 줄에 들어간다 |
| 20-D5 | 문단을 넘는 선택 | (가) **문단마다 레코드(같은 `group` id 로 함께 지움)** · (나) 한 레코드 | **(가)** — 인용 찾기가 문단 안에서 가장 정확하다 |
| 20-D6 | 다시 찾은 결과 저장 | (가) **판이 다를 때만 한 번 고쳐 씀** · (나) 늘 다시 찾기만 · (다) 매번 씀 | **(가)** — 쓰기를 최소로, 다음부터 빠른 길 |
| 20-D7 | 음성 "표시" | (가) **명령 `mark` 더함 — 지금 문장 노랑** · (나) 없음 | **(가)** — 핸즈프리(요구 1 필수)로 "여기 중요"를 남길 유일한 길. 로컬 매칭·호출 0 |
| 20-D8 | 원본 보기에서 만들기 | (가) **음성 "표시"만(선택이 없다) · 보기는 됨** · (나) 원본에서 끌어 고르기 구현 | **(가)** — 캔버스 위 선택은 큰 작업이다 |
| 20-D9 | 칠하는 법 | (가) **CSS Custom Highlight(이름 다섯) · 원본은 따로 된 상자 층 · 우선순위 낭독 > 검색 > 필기** · (나) 줄 span 쪼개기 | **(가)** — 6a 의 쪼개기 이음새 결함을 피한다(`charhl.js` 머리말). 검색·낭독과 같은 장치 |
| 20-D10 | 지우기 확인 | (가) **바로 지우고 3초 [되돌리기]** · (나) 확인 대화 | **(가)** — 자주 하는 손짓이다. 메모가 있는 것은 확인 대화(글을 잃는다) |
| 20-D11 | 문서를 지울 때 | (가) **남김 + 같은 PDF 다시 가져오면 `fileHash` 로 다시 붙음** · (나) 함께 지움(11-D8 이 적은 지금 규칙) | **(가)** — 메모는 사용자가 쓴 글이다(단어장·요약·카드와 같은 까닭). 공간을 비우려 PDF 를 지웠다 다시 넣어도 이어진다. 11-D8 의 "필기는 함께 지워지는 지금 규칙 그대로" 문구를 이 결정으로 바꾼다 |
| 20-D12 | 기억 카드와 | (가) **따로 — 같은 `[⋯]` 에 둘 다** · (나) 하이라이트 = 카드 | **(가)** — 단위(낱말 몇 개 vs 문장)·목적(자리 vs 복습)이 다르다 |
| 20-D13 | 내보내기 꼴 | (가) **Markdown `.md`** · (나) CSV · (다) 없음 | **(가)** — 인용·메모·장 구조가 그대로 읽힌다. Obsidian·메모 앱에서 열린다 |
| 20-D14 | 순서 (X-D1 과 같음) | (가) **14 뒤 첫째 — 20 → 15 → 16 → 19** · (나) 원래 15 → 16 → 19 → 20 | **(가)** — 호출 0 인 것을 먼저(17절 머리 6), 요구 7(Nour). 15 묶음이 필기 줄을 처음부터 넣고, 15 근거 찾기가 `findQuote` 를 바로 쓴다. 파일 겹침(selbar·voice·reader·library·router)은 어느 순서든 차례로 하면 문제없다 |

**운영자에게 물을 것** — 없음(호출 0 · 외부 전송 0 · 기기 안 저장 · 9c 고지 그대로).

#### 11. 크기 · 시간 `[추정]`
| Build | Build | Review | 위험 |
|---|---|---|---|
| 20-1 앵커·저장·칠하기 | 3h | 1.5h | 중간 — 인용 찾기 정확도, 원본 상자, 검색 함수 옮김 |
| 20-2 만들기·음성·쪽 시트 | 2.5h | 1.5h | 중간 — 선택 줄 갈래, 음성, 키보드 |
| 20-3 화면·내보내기·다시 붙이기 | 2.5h | 1h | 낮음~중간 |
| **합** | **8h** | **4h** | |

#### 12. 마지막 실기기 점검 묶음 (20 몫)
- [ ] `[M]` GT 7: 길게 눌러 고른 뒤 `[⋯]` 색 줄이 시스템 선택 메뉴와 겹치지 않는가, 세피아·어두운 테마에서 네 색이 보이는가.
- [ ] `[M]` 음성 «علّم» 이 다른 명령(«اقرأ» 등)과 헷갈리지 않는가.
- [ ] `[M]` 메모 쓰기 — 아랍어 키보드가 올라와도 [저장]이 보이는가, 아랍어·영어 섞인 메모 방향.
- [ ] `[M]` 판 올림(14 묶음 배포) 뒤 전에 만든 필기가 제자리에 남는가.
- [ ] `[M]` PDF 지움 → 다시 가져오기 → 필기 돌아옴.

#### 13. 다른 단계에 넘길 것
- **11-1**: `summary`·`outline` 레코드에 `fileHash` 사본 한 줄(20-3 `reattach` 가 함께 옮긴다). 연쇄 예외는 20-3 에서 스토어 전체로 넓어진다.
- **8c-1·11-2**: `[⋯]` 메뉴 맨 위에 **가로 한 줄 칸**(색 넷)을 둘 자리 — 메뉴 항목이 늘어난다(요약·기억 카드·메모·사례 이미지·찾아보기·여기서부터 읽기) → 메뉴 최대 높이 = 선택 줄 위 공간, 안 스크롤(8e compact 360px 높이).
- **9b**: 명령 표에 `mark` — 11-2 `summarize`·12-2 `remember` 와 함께 C3 시험.
- **9c**: `annotations` 문서 없이도 넣기(11 과 같은 줄).

#### 14. 이번엔 못 함
원본 보기에서 끌어 고르기 · 손글씨(펜) · 필기 검색(검색 화면에 필기 갈래) · 필기 공유·동기화 · 하이라이트 → 카드 · 표(4-8 영역 그림) 안 필기.

---

## (C) 13절 표에 붙일 한 줄

**"외부 요청" 행 끝** — `[수정 2026-11-16 — 19 Plan, 운영자 결정 19-Q1 대기]` 19 를 넣으면 **Open-i(미 국립의학도서관) 검색 API + 이미지**가 더해진다 — 사용자가 `[사례 이미지]`·`[찾기]`·`[더 보기]` 를 누를 때만, 보내는 것은 고른 낱말(≤ 60자)뿐, `credentials:'omit'`·리퍼러 없음, 받은 사진은 저장하지 않는다. 거절되면 새 탭 링크만(앱 요청 0).

**"의료 안전" 행 끝** — `[수정 2026-11-16 — 15·16·19 Plan]` 19 이미지 시트 위에 고정 두 줄(판독·진단 아님 · 원 논문 증례), 사진을 AI 로 보내는 단추 없음, 캡션 번역 없음. 15 AI 문제는 근거 인용 검증(10-4 + 숫자 거름)을 지난 것만, 🤖 배지·근거 늘 보임. 16 개념도 관계 목록에 '치료' 없음.

## (D) 9-2 에 붙일 것

- **`questions` 행 끝**: `[수정 2026-11-16 — 15 Plan]` `source:'ai'` 는 sectionId `ai-p{a}-{b}`(원서 `sec-…` 와 섞지 않음), 해설은 `explanation{tr, src}` + `langs`, `evidence`. **다시 추출(`resetDerived`)이 `source:'ai'` 를 지우지 않는다**(새 소절 15 3-3).
- **`annotations` 행 `kind` 칸**: `kind('highlight'|'note'|'summary'|'outline')` — `[수정 2026-11-16 — 20 Plan]` 필기 필드·앵커(인용 + 문단 해시 + 줄 구간 + 판)는 새 소절 20 2. `annotations` 는 **문서 삭제 연쇄에서 빠진다**(스토어 전체), `fileHash` 사본으로 같은 PDF 에 다시 붙는다. 개요 레코드의 `diagram` 필드는 새 소절 16 4.

## (E) 3-2 import 방향 — 한 줄

`[수정 2026-11-16 — 15·16·19·20 Plan]` **`review/*`** 행은 `notes/*` 행과 같다. **`ext/*`**(외부 공개 서비스 — Open-i)는 `config`·`text/*` 만 import 하는 네트워크 서비스(`ai/adapters/*` 와 같은 자리, `ui/` 가 부른다). `text/anchor.js`·`text/diagram.js`·`text/review.js`·`text/openi.js`·`ai/grounding.js` 는 순수(16-A grep 대상). `screenIndex`·`rangesOnScreen` 은 `ui/search.js` → `text/screen.js`(옮김).

## (F) 12-1 라우트 표 — 한 줄

`#/review/:docId/:sectionId`, `#/cards`, `#/notes` 행 끝: `[수정 2026-11-16 — 15·20 Plan]` 복습 묶음은 `#/review/:docId/:range`(`range` = `a-b` PDF 쪽, 없으면 읽던 장 — 새 소절 15), 필기는 `#/notes` · `#/notes/:docId` · `#/notes/:docId/:range`(새 소절 20 6).
