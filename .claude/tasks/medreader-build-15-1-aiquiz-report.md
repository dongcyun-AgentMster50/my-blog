# Build 보고서 — 15-1 AI 출제 서비스 (화면 없음)

- 지침: `.claude/tasks/medreader-build-15-1-aiquiz.md` · 설계: spec **17-13** (1 · 3 · 5 표 15-1 행 · 6 · 7 "15-1" · 8 권장안)
- 커밋하지 않음. 진짜 키·진짜 Gemini 요청 0(가짜 provider·흉내 Gemini 만). 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b15-1\`
- DB 3 · `PROMPT_VERSION`(3)·`TERM/SUMMARY/OUTLINE/EXPLAIN_PROMPT_VERSION`(1) 불변 · 새 `QUIZ_PROMPT_VERSION = 1`. **새 호출은 `makeQuiz()` 를 부를 때만**(파이프라인 안에서 스스로 부르는 곳 0 — 시험 A7).

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/review.js` (새, 순수 152줄) | `passageFor` · `rangeKey`·`parseRangeKey`·`rangeOf` · `aiSectionId`(`ai-p{a}-{b}`)·`aiRangeOf` · `sectionsInRange` · `readPagesIn` · `isQuizPara`. 읽은 쪽 판정은 `plan/planner.js` 의 `rangesHas`(13-1 과 한 벌 — 순수→순수) |
| `js/ai/grounding.js` (새, 순수 246줄) | `groundQuiz`(10-4 자체 검증 1–5 + 숫자 거름) · `findEvidence` · `normForm`/`looseForm`(원래 오프셋 지도) · `REASON` 코드. 숫자는 `prompts.numberTokens` + `text/summary.hasForeignNumber`(새로 짜지 않음) |
| `js/review/aiquiz.js` (새, 서비스 291줄) | `createAiQuiz({db, now, readRanges?})` → `passage`·`make`·`save`·`list`·`usedParaIds`·`summarized`·`loadParas`(쪽마다 커서로 읽어 버림)·`countForDoc` · `aiRecord`·`stemHash`·`questionId`. import 는 `config·db·hash·text/*` 만, 파이프라인은 주입 |
| `js/ai/prompts.js` (+138) | `QUIZ_PROMPT_VERSION` · `QUIZ_SCHEMA`/`QUIZ_SCHEMA_SAME`(요청) · `QUIZ_PARSE_SCHEMA`(해석 — 문항 필수 없음) · `quizInstruction` · `buildQuizRequest` |
| `js/ai/pipeline.js` (+95) | `QUIZ_KIND = 'quiz'` · `QUIZ_JOB`(`runJob` 위 — 최대 1호출) · `makeQuiz()` |
| `js/config.js` (+20) | `REVIEW`(QUIZ_N 5 · 900/200 · PARA_KINDS·60자 · EVIDENCE_MIN 20 · SECTION_PREFIX `ai-p` · ID_HASH_CHARS 8 · PROMPT_VERSION 1) |
| `js/db.js` (+10) | `keepsOnReset(rec, store)` + `resetDerived` 커서에서 `source:'ai'` 건너뜀(15-D6). 문서 삭제(`CASCADE_STORES`)는 그대로 함께 지움(15-D7) |
| `index.html` | stamp(모듈 101개) |
| `tests/grounding-15.test.mjs`(새 10개) · `tests/aiquiz-15.test.mjs`(새 8개) | 아래 수용 기준 |
| `spec.md` | 17-13 3-3 끝에 `[정정 2026-11-17 — 15-1 Build]` 한 줄 |

`plan/readlog.js` 는 고치지 않았다(`rangesHas` 는 `planner.js` 에 이미 export — review/* 행은 plan/* 를 import 하지 않으므로 readlog export 줄은 쓸 데가 없다). `ui/*`·`backup/*`·`text/backup.js`·`speaker.js`·`voice/*`·review.md·`dev/` 0.

## 2. 수용 기준 "15-1"

| 기준 | 결과 | 시험 |
|---|---|---|
| `passageFor`: 읽지 않은 쪽 문단 0 · `usedParaIds` 빠짐 · 저장 요약 문단 먼저(paraId·textHash) · 누적 ≤ 6,000자, 문단 안 자름 · 제목·문항·보기·인용(참고문헌)·표 안내 빠짐 · `left` 정확 | 통과 | A1 |
| `buildQuizRequest`: 규칙 1–6 글자 그대로 · ko/en → "Korean AND English", 아랍어·`Arabic` 0 · 같은 언어 → 하나 · 탈출 · 보내는 것 paraId·pageNo·text 뿐 | 통과 | Q1 |
| grounding: 정확 → 통과 · 공백·구두점만 다름 → 2차 통과 · 지어낸 인용 → rejected · 보기 4개·글자 F·중복 보기 → rejected · `evidenceParaId` 틀림 → 교정 · 정답 보기 입력 밖 숫자 → rejected · 5개 중 3 rejected → weak, 재호출 0 | 통과 | Q2–Q8 · A3b |
| `makeQuiz`(가짜 provider): 1호출 · 같은 입력 → 0호출 · 429·capped·no-key → 보내지 않음/막힘 · `byKind.quiz` +1 · **번역 요청 본문 바이트 불변** | 통과 | A3 · A4 |
| (fake-idb) 저장: `ai-p40-79` · 줄기 해시 id 중복 0 · `sec-III` 와 `docId_sectionId` 조회 갈림 · `resetDerived` 뒤 ai 남고 book 지워짐 · `deleteDocument` 뒤 둘 다 지워짐 | 통과 | A5 |

## 3. 변이 → 빨강 → 복원(읽어서 쓰기 + cmp, 백업 `b15-1/bak/cur/`)

| # | 변이 | 결과 | 빨간 시험 | 복원 cmp |
|---|---|---|---|---|
| 1 | `resetDerived` 의 ai 예외 지우기 | 빨강(2) | A5 · A7 | 같음 |
| 2 | `passageFor` 의 읽은 쪽 거름 지우기 | 빨강(2) | A1 · A6 | 같음 |
| 3 | grounding 2차 검사를 늘 통과로 | 빨강(5) | Q2 · Q3 · Q7 · Q8 · A3b | 같음 |
| 4 | sectionId 접두를 `sec-` 로 | 빨강(3) | A2 · A5 · A6 | 같음 |
| 5 | (고름) 숫자 거름 지우기 | 빨강(1) | Q6 | 같음 |

## 4. grounding 통과/폐기 표 (합성 — 지어낸 문단 6개, 갈래마다 6문항, `b15-1/precision.mjs`)

| 갈래 | 통과 | 폐기(까닭) | 비고 |
|---|---|---|---|
| 정확 인용 | 6 | 0 | |
| 공백·따옴표·대시 차이 | 6 | 0 | 1차(정규화)에서 |
| 구두점만 다름 | 6 | 0 | 5개 2차(`loose`) |
| 지어낸 인용 | 0 | 6 (evidence) | |
| 바꿔 쓴 인용 | 0 | 6 (evidence) | |
| 인용 속 숫자 바꿈(4↔3, 1,600, 75↔7.5, 30일, 2 mmol, ≥15) | 0 | 6 (evidence) | 2차도 숫자 사이 `.`·`,` 를 남긴다 |
| 정답 보기에 숫자 지어냄 | 0 | 6 (digits) | |
| 해설에 숫자 지어냄(대상·원문 언어, 동방 숫자 포함) | 0 | 6 (digits) | |
| 해설 숫자가 입력에 있음 | 6 | 0 | 오탐 0 |
| `evidenceParaId` 틀림·빈값·없는 id | 6 | 0 | 6개 모두 교정(`fixed`) |

찾은 인용은 **보낸 문단 글의 그 자리 글자**로 바꿔 저장한다 → 20 `findQuote` 가 'page' 로 다시 찾는다(시험 A6 · headless 5/5 · 다시 추출 뒤에도 5/5).

## 5. 입력 크기 — CMDT 2026 장 하나 (앱 추출 경로, 숫자만, `b15-1/measure-cmdt.mjs`)

- 책 1,967쪽 · 개요 맨 위 61항목 · 고른 장: 28번째 항목, PDF 786–815쪽(30쪽)
- 흐름 문단 744 · 148,512자 → 출제 후보(body·list · 60자↑ · 참고문헌 아님) **256문단 · 101,528자**(중앙 322자, 최대 1,611자)
- 다 읽었을 때 한 번: **19문단 · 5,999자 · 4쪽 분량** · `left` 237 · DOC 약 1,706 토큰
- 요청 전체: 입력 약 **2,290 토큰** + 출력 4,700 = **6,990 ≤ 8,000**(대상 ar), ko 6,971. 설계 어림(입력 1,500)보다 약 790 많다(지시문·system 약 9,100자 + JSON 꾸밈). 여유 약 1,000 토큰
- 앞 10쪽만 읽음: 후보 94 → 한 번 19문단 · `left` 75 · 읽지 않음: 0문단(보내지 않음)
- 장을 다 쓰려면(한 번에 문단 5개 소모 가정) 약 52번 누름 — 아래 남은 문제 3

## 6. 호출·바이트

- 가짜 provider(A3): 1호출 · 같은 입력 0호출(`cacheHits` +1) · 429 → `exhausted`, 다시 불러도 0 · capped·no-key → fetch 0 · `byKind.quiz` +1 · `USAGE_KINDS` 6키 그대로
- **번역·요약·설명 요청 본문 바이트 = HEAD**: rbody 하네스(`b15-1/rbody.mjs` — r11-4 것을 본뜸, HEAD 는 `git archive` 사본) 7조합 × 번역·낭독·단어·요약 2·개요·설명 = **54건 모두 같음**. 시험 A4 에 HEAD 판 sha256 세 개(번역·요약·설명)를 박아 둠

## 7. headless (Edge · pipe · 새 프로필 `b15-1/p1` · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 캐시 끔 · 서버 없음 · 합성 PDF 4쪽)

페이지 안에서 앱 모듈로 `readLogStore.markRead(1–2)` → `aiQuiz.make(1–4)`:
- 출제 요청 **1건** · 본문 문단 8개 전부 **쪽 1·2**(읽은 쪽) · 항목 키 `paraId,pageNo,text` 뿐 · maxOutputTokens 4,700
- verified 5 · **저장 5**(`ai-p1-4`, id 꼴 맞음, source ai) · `byKind.quiz` 1
- 같은 입력 다시 `makeQuiz` → 0건(캐시)
- 앱 `reextractDoc` → 다시 추출 끝(algo 13, 4쪽) 뒤 **AI 문항 5 남음**, 근거 인용 5/5 다시 찾음
- 콘솔 오류 0 · 페이지 오류 0 · 외부 요청 0 · 빠진 파일 0 · 11초

## 8. 그 밖 점검

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 2,002 / 2,002 통과 · 실패 0**(각 약 13.4초)
- stamp 단독 실행 → `--check` "그대로다"(모듈 101) · `git diff --check` 0
- 순수 grep(16-A): `ai/grounding.js`·`text/review.js` 에 `Date|document|window|globalThis|navigator|indexedDB|IDBKeyRange|fetch|…|crypto` 0(주석 포함) — 시험 Q9 도 같은 검사 + import 고정
- 쓴·고친 파일 11개의 NUL·CR·U+2028·U+2029·U+FEFF·NBSP 수 = HEAD(새 파일은 0)

## 9. 설계와 달라진 점 (spec 정정 줄에 적음)

1. 해설 줄은 10-4 꼴 "Explanation in {Target} AND {Src}." — 3-2 의 "AND in" 이면 수용 기준 "Korean AND English" 가 안 맞는다. 필드 대응(`tr`·`src`)은 다음 줄에서. 줄기·보기는 원문 언어로 지시.
2. 캐시 키 `extra` = `'n=5|l=ko+en'`(요약 `l=` 와 같이), 키 글 = 보내는 문단 JSON.
3. grounding 정밀도 보강: 인용 20자 미만 → `short` · 2차는 숫자 사이 구두점을 남김 · 대소문자는 접지 않음 · 문단 하나 안에서만 찾음 · 해석 스키마는 문항 필수 없음(빠진 필드 문항도 폐기로 셈).
4. `usedParaIds` = 이 범위 AI 문항의 `paraIds`(verified 근거 문단 + rejected 가 주장한 문단이 보낸 글에 있었을 때 — 나쁜 문단에 머물지 않게).
5. 상한 넘침은 `makeQuiz` 가 뒤 문단부터 뺌(넓은 글자 책 대비), 하나도 안 되면 `too-big` · 문항 0 → `failed(EMPTY)`(캐시 0) · 잘린 응답 → `MISSING`.
6. 참고문헌(PMID·PMCID·DOI) 문단은 후보 아님.

## 10. 남은 문제 · 실기기 확인 거리

1. **[M] 출력 예산** `maxOutputTokens = 5 × 900 + 200 = 4,700` — 아랍어 해설 팽창이 실제로 이 안에 드는지(11-1 요약 실측 근사와 같이 "13 실기기 첫 줄" 묶음). 넘치면 잘린 응답 → `MISSING`(캐시 0, [다시 시도]).
2. **[M] 폐기율** — 실제 Gemini 가 인용 첫 글자 대소문자를 바꾸거나, 해설에서 "3 of 10" 을 "30%"·"두 주" 를 "2주" 처럼 **계산·숫자화**하면 지금 규칙은 폐기한다(정밀 쪽). 실측 폐기율이 50% 를 자주 넘으면 2차 규칙(대소문자) · 해설 숫자 거름 범위를 조정.
3. 고르기 치우침 — 쪽·문단 순으로 6,000자를 채워 한 번에 19문단(장 앞 4쪽)이 가고, 5문항이 쓰는 문단은 최대 5개라 나머지 14문단은 다음 누름에 또 실린다. 30쪽 장을 다 쓰려면 약 52번. 15-2 에서 "보냈지만 안 쓴 문단 뒤로" 나 쪽 고르게 펴기를 볼 만하다(설계 3-1 규칙 그대로 둠).
4. 모두 폐기 + 주장한 문단 id 도 엉터리면 같은 입력 → 캐시로 같은 판정(0호출)이 되풀이된다. `make({force:true})` 길은 열어 둠 — 15-2 [다시 만들기] 여부 결정 거리.
5. 저장 요약 맞추기: `paraId` 와 `textHash` 둘 다 본다. 요약 해시는 문장 단위 글(인용 뺌)에서 만들어 문단에 인용 조각이 있으면 해시가 안 맞는다 — 재추출로 `paraId` 까지 바뀐 경우에만 영향.
6. 레코드의 `provider`·`model` 은 그때 설정 값(응답 값 아님 — `runJob` 결과에 실리지 않음).
7. 15-2 몫: 퀴즈 화면 `loadQuestions` 의 `status:'rejected'` 거름 한 줄(rejected 도 같은 sectionId 로 저장됨) · 삭제 확인 수(`countForDoc`) · `passage(…, {budget: ai.maxReqChars})` 로 사용자 상한을 넘길 것(안 넘겨도 `makeQuiz` 가 줄인다).
