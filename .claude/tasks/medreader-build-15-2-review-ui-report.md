# Build 보고서 — 15-2 복습 묶음 화면 `#/review` · 퀴즈 AI 갈래 · 범위 고르기 부품 (+ 15-1R 고침)

- 지침: `.claude/tasks/medreader-build-15-2-review-ui.md` · 설계: spec **17-13** 2 · 4 · 5 표 15-2 행 · 6 · 7 "15-2" · 8 권장안(15-D2·D3·D9·D11·D12) · 10 · 11
- **커밋하지 않음.** 진짜 키·진짜 Gemini 요청 0(흉내 Gemini·가짜 provider 만). 서버 0(가로채기). 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b15-2\`
- DB 3 · 판본 상수(`PROMPT_VERSION` 3 · TERM/SUMMARY/OUTLINE/EXPLAIN/QUIZ 1) 불변 · 번역·요약·설명 요청 본문 바이트 = HEAD. **새 호출은 [문제 만들기 5개]·[개요 만들기]를 누를 때만**(자동 0).

## 0. 15-1R 고침 (15-1 은 15-2 와 함께 배포)

### 중간-1 — 2차(관대한) 근거 검사 (`js/ai/grounding.js` `looseForm`)
Review 사본(`r15-1/alt/` — 읽기만)의 규칙 그대로: 구두점만 지우고 **공백은 한 칸으로 접음** · 숫자 앞 `-`·`+`·`±`·`.`(앞이 숫자 아닐 때; `−` 는 `normForm` 이 `-` 로) · 숫자 뒤 `%`·`‰` · `?`·`!` 남김 · 숫자 사이 구두점은 전처럼 남김.

**★ 폐기 표** — Review 하네스 `r15-1/ground.mjs`(읽기만)를 고친 앱 파일에 그대로:

| 갈래 | n | 통과 | 폐기 | Review 때(고치기 전) |
|---|---|---|---|---|
| ★ 부호 빠짐(`−2.5`→`2.5`) | 1 | **0** | 1 | 1 통과 |
| ★ 낱말 붙임(`a symptomatic`→`asymptomatic` · `an inactive`→`aninactive`) | 2 | **0** | 2 | 2 통과 |
| ★ `%` 빠짐 | 1 | **0** | 1 | 1 통과 |
| ★ 앞 소수점(`.5`)·`?`→`.` | 2 | **0** | 2 | 1 통과 |
| 앞뒤 잘림 · 리가처 · 하이픈 결합(2차) · 공백·JSON 찌꺼기 · 동방 숫자 | 5·3·4·3·2 | **5·3·4·3·2** | 0 | 같음 |
| 해설 숫자화 · 대소문자 · 20자 미만 · 두 문단 · 줄임표 · 기호/숫자 바꿈 | 3·5·5·2·1·3 | 2·0·0·1·0·0 | (digits 1 · evidence 5 · short 5 · …) | 같음 |

→ 뜻 바뀐 지어냄 **6/6 폐기**, 정당한 2차 통과 그대로. 시험 **Q11**(`grounding-15`): ★ 6꼴 rejected(evidence) + 정당한 11꼴 verified(원문 그 자리 인용) + `looseForm` 꼴 넷.

### 낮음-2 — 앞쏠림·되풀이 (`js/text/review.js` `passageFor` · `js/review/aiquiz.js`)
- 순서: **보낸 횟수 적은 문단 먼저**(보냈지만 근거가 안 된 문단은 빼지 않고 뒤로) → 같은 횟수 안 저장 요약 먼저 → **읽은 쪽에 고르게**(쪽마다 한 문단씩 돌림 · 지난 누름이 보낸 쪽은 이번 돌림 뒤로 · 같은 몫이면 비트 뒤집기로 흩음).
- 보낸 기록: 기존 저장(캐시 키는 해시 · 사용량은 수뿐)으로는 셀 수 없음 → **AI 문항 레코드에 `sentParaIds` 한 칸**(그 누름에 실제로 실은 문단 = `makeQuiz` 의 `sent`). 같은 목록은 한 번으로 셈(같은 입력 = 캐시 0호출). 새 스토어·DB 판 0. `aiquiz.history()` 가 `used`·`sent` 를 한 번에 모음.
- 시험 **A8**(+ A1·A6 기대 순서 갱신).

**CMDT 2026 다시 잼**(Review 와 같은 장 둘 · 앱 추출 길 · `b15-2/measure.mjs` · 숫자만):

| 장 | 후보 | 한 번 누름 | 3번 누름(15문항)의 문항 쪽 | 문항 쪽 사분위(앞→뒤) | 모든 문단을 한 번씩 보내는 누름 | 장을 다 씀(근거 5문단/번) |
|---|---|---|---|---|---|---|
| 237–277 (41쪽) | 361 · 169,454자 | 15문단 · 5,977자 · **15쪽** | **15쪽**(1–37쪽) · Review **4쪽** | 4·4·3·4 | **29번**(되풀이 1.00배) | 73번 · 2.50배 |
| 1439–1478 (40쪽) | 393 · 151,241자 | 19문단 · 5,970자 · **19쪽** | **15쪽**(1–40쪽) · Review **4쪽** | 5·5·1·4 | **26번**(1.00배) | 79번 · 2.99배 |

(모델이 앞 5문단을 고른다고 해도 237–277 15쪽·1439–1478 15쪽. 근거 3문단/번이면 8·9쪽. "다 씀" 배수는 문항이 근거 문단을 5개씩만 쓰는 한 줄지 않는다 — 다만 **되풀이는 모든 문단을 한 번씩 보낸 뒤에야** 시작한다.)

### 낮음-3 — 캐시 키 언어 칸 시험
A3 에 "대상 ko 그대로·원문 언어만 fr → 1호출(다른 키)" 단언. 변이 R1(`l=` 뺌) → **A3 빨강**.

### 낮음-4·5 — 고치지 않음(실기기 줄)
- **실기기**: 대소문자 바뀐 진짜 인용 5/5 폐기 · 20자 미만 진짜 인용 5/5 폐기(낮음-4) · 숫자 거름 허용 범위가 보낸 문단 전체(낮음-5) — Nour 키 폐기율을 보고 "인용 첫 글자만 접기"·근거 문단 숫자로 좁히기 판단.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/review.js` (새) | 묶음 화면 칸 1–7(비어 있는 칸 숨김) · 순수 `aiNote`·`aiQuizHash`·`firstUnread`·`notesInRange`·`cardsInRange`·`cellsOf` · [문제 만들기]·[다시 시도](누를 때만) · [개요 만들기](11-3 `createOutlineFlow`) · [원문에서 보기] 처리기(저장본 쪽 → 20 `findQuote` → `revealLine`, 못 찾으면 쪽 처음) |
| `js/ui/rangepick.js` (새) | 13-2 `chapterRanges`·11-3 `chaptersOf`/`chapterAt` **옮김**(글자 그대로) · `defaultRange`·`chapterOfRange`·`normPages`·`printedRange`·`chapterOptionText` · `createRangePick`([범위 바꾸기] 칸 — 13-2 와 같은 문구·CSS) |
| `tests/review-ui-15.test.mjs` (새, 9개) | V1–V9 (아래 수용 기준) |
| `js/router.js` | `review` 화면 · `reviewHash` · `#/cards/:docId/:a-b` · `cardsHash(docId, range)` |
| `js/main.js` | init/show/leave 배선 |
| `js/ui/quiz.js` | 🤖 배지(다른 색 토큰) + 고정 한 줄 · 근거 블록(AI 만·늘 보임 · 원문 언어 `lang`/`dir`) + [원문에서 보기] · 해설 `tr`(대상 언어 lang/dir) + `src`(작게) · AI 정답 줄 `quiz.ai.expected` · `ai-…` 제목(인쇄 라벨) · 뒤로가기·돌아가기 = 묶음 · `rejected` 거름 한 줄 · AI 섹션은 원서 색인 만들기 안 함. 원서 📕 길은 바이트 그대로 |
| `js/ui/library.js` | [⋯] "복습 묶음" · 삭제 확인 "AI 문제 n개도 지워집니다"(`deleteKeepLines` 의 `gone` 조각 → 머리 다음 따로 한 줄, `confirm()` 그대로) · `deleteKeepCounts` 에 `aiQuiz.countForDoc` |
| `js/ui/summaries.js` | 범위 함수는 rangepick 에서(다시 내보내기) · [이 범위 복습] · `presetSummariesRange`([모아 보기] → 그 범위) |
| `js/ui/planner.js` | `chapterRanges` 는 rangepick 에서(다시 내보내기) · 장 줄 글·인쇄 라벨 = rangepick · 범위 줄 [복습] |
| `js/ui/cards.js` | 범위 칸 — `createReviewFlow({pages})`: 복습할 것은 `queue` 를 범위로 거름, 새 카드는 오늘 몫을 **범위 안에서** 다시 채움(`srs/cards.js` 무변) · 제목에 "쪽 a–b" |
| `index.html` | `#/review` 섹션 · `#sumsReview` · stamp(모듈 103) |
| `css/screens.css` | `.rv-*`·`.rp-*`·`.quiz-badge-ai`·`.quiz-evidence*`·`.quiz-explanation-src` (논리 속성 · 48px) |
| i18n 4개 | 45키(`review.*`·`quiz.ai.*`·`quiz.badge.ai`·`library.card.review/deleteConfirmAi`·`summaries.review`·`planner.review`) · ar·fr `[검토 — Nour·운영자]` |
| 15-1R: `js/ai/grounding.js` · `js/text/review.js` · `js/review/aiquiz.js` | 위 0절 (`ai/pipeline.js` 무변 — 캐시 키 시험만) |
| 시험 | `grounding-15`(Q11) · `aiquiz-15`(A3 한 줄 · A8 · A1/A6 기대 순서) · `planner-ui-13`(P7 import 목록에 `./rangepick.js`) · `router.test.mjs`(R1 에 review 도달 3줄 — NUL 1개 든 파일이라 바이트 스크립트로 넣음: 앵커 1곳 · NUL 1→1 · CR 0 · 앞뒤 바이트 같음) |
| `spec.md` | 17-13 4 끝에 `[정정 2026-11-17 — 15-2 Build]` 한 줄 |

`aiquiz.js`·`text/review.js` 를 고친 이유 = 15-1R(지침 허용). `db.js`·`backup/*`·`text/backup.js`·`speaker.js`·`voice/*`·`selbar.js`·review.md·`dev/`·`srs/cards.js` 0.

## 2. 수용 기준 "15-2"

| 기준 | 결과 | 근거 |
|---|---|---|
| `[D]` 장 고름 → 칸 셋 이상 · [문제 만들기] → 요청 **1건**(읽은 쪽 문단만) · 5문항 → [풀기] → 🤖·근거·대상 언어 해설 · 원서 [풀기] → 📕 그대로(AI 0) | 통과 | run-a: 열기 칸 4 · 요청 0 → 만들기 **1건** · 본문 문단 10 전부 쪽 1·2(읽은 쪽) · 키 `paraId,pageNo,text` · "Arabic AND English" · 키·제목 0 · 흉내(정확 4 + 지어냄 1) → 저장 5(verified 4·rejected 1 · `sentParaIds` 5) · 퀴즈 총 **4**(rejected 안 읽음) · 🤖·고정 줄·근거(`lang=en dir=ltr`) · 해설 tr `ar/rtl` + src `en` · 제목 "AI 문제 · 쪽 1–3" · 뒤로 `#/review/D/1-3`. run-b: AI 4 만든 뒤 📕 `sec-I` 카드 7장(문항·채점 5·결과) outerHTML 해시 **HEAD 와 7/7 같음** · 📕 화면 AI 요소 0 |
| `[D]` 읽은 쪽 0 범위 → 흐림·한 줄·요청 0 · 429 → 막힘 한 줄, 자동 재시도 0 | 통과 | run-a: 4–5 → `disabled`·"이 범위를 먼저 읽으세요"·눌러도 0 · 429 → `readalong.blocked.exhausted` + [다시 시도] · 4초 기다려도 추가 0 · [다시 시도](사용자) → 1건 |
| `[D]` 원서 문제 없는 책 → 📕 칸 없음 · 요약 없음 → "아직 저장한 요약이 없습니다" | 통과 | run-a(교과서) 칸 = 머리·진도·요약·AI · V4 |
| `[D]` 360×740·412×915·915×412 × 4언어 넘침 0 · 48px · RTL · `innerHTML` 새 사용 0 | 통과 | run-l: 12칸 × (묶음·범위 칸 열림·AI 퀴즈 채점 뒤) — 가로 넘침 0 · 화면 밖 요소 0 · 48px 미만 0(누를 것 444) · ar `rtl`·나머지 `ltr` · diff 에 innerHTML/insertAdjacentHTML/outerHTML 더한 줄 0 · XSS(흉내 줄기·보기·해설에 `<img onerror>`·`<b>`) → AI 8문항 풀어도 `__xss` 0·img 0 |
| `[D]` 입구 셋이 같은 범위 · 11-3·13-2 범위 고르기 전과 같음 | 통과 | run-a: 서재 [⋯] → 읽던 장 1–3 · 모아 보기 [이 범위 복습] → 고른 범위 · 계획 [복습] → 4–6 · 요청 0. run-r: 11-3 범위 칸(장 줄·셈·쪽 직접·장 바꿈)·13-2 폼(장 줄 4·쪽 모드·범위 더하기) 글·값 **HEAD 와 같음** · headcmp: 무작위 개요 3,000 × `chapterRanges`/`chaptersOf`, 24,000 × `chapterAt` HEAD 와 다른 것 0 |
| 호출 표(6절) | 통과 | 열기·범위 바꾸기·풀기·복습·보기·[모아 보기] 0 · run-o: [개요 만들기] 1건(범위 이름 본문 0) → [저장] → 다시 열면 접힌 개요·요청 그대로 · [모아 보기] → 11-3 `c0`(같은 범위 장) |

## 3. 변이 → 빨강 → 복원(백업 `b15-2/bak/` 를 읽어서 씀 · `cmp`)

| # | 변이 | 빨간 시험(stamp IM2·IM6·IM7b 뺌) | 복원 cmp |
|---|---|---|---|
| M1 (설계) | 퀴즈 갈래에서 근거 블록 빼기 | V6 | 같음 |
| M2 (설계) | AI [풀기]가 원서 sectionId(`sec-I`)로 | V3 | 같음 |
| M3 (고름 — rangepick 옮김) | 장 끝을 "다음 항목 −1"(정정 ④ 이전)로 | P2(planner-ui-13) · V2 | 같음 |
| M4 (고름) | 12-3 범위 거름 끔 | V8 | 같음 |
| R1 (15-1R) | 캐시 키 `l=` 뺌 | A3 | 같음 |
| R2 (15-1R) | 2차가 공백을 지움(옛 규칙) | Q11 | 같음 |
| R3 (15-1R) | 보낸 횟수 무시 | 처음엔 **살아남음**(쪽 몫 돌림이 같은 결과) → A8 에 "같은 쪽 안 보낸 문단 뒤로" 단언 더함 → **A8** | 같음 |

끝에 7파일 모두 백업과 바이트 같음 · `pipeline.js` 는 15-2 시작 전 사본과도 같음.

## 4. 시험 · 점검
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 2,013 / 2,013 · 2,013 / 2,013**(13.3 · 13.4초 — `b15-2/test-run1.txt`·`test-run2.txt`)
- stamp 단독 → `--check` "그대로다(모듈 103 · CSS 4)" · `git diff --check` 0
- 번역·낭독·단어·요약 2·개요·설명 본문: Review 하네스 `r15-1/rbody.mjs`(읽기만) **58/58 = HEAD**, `makeQuiz` 뒤에도 58/58 · commonSystem 4꼴 같음 · A4 sha256 통과
- 특수 글자(NUL·CR·U+2028·U+2029·U+FEFF·NBSP·FSI/PDI·SHY) HEAD 대비: **Edit 뒤 `ui/quiz.js` 가 통째로 CRLF(1,178)가 된 것을 발견 → LF 로 되돌림**(이후 Edit 에서는 재발 0 · `ls-files --eol` w/lf) · Write 가 `ui/review.js` 의 `'\u2068'`·`'\u2069'` 와 시험의 `\u00AD` 를 실제 글자로 넣음 → 이스케이프 글로 되돌림. 최종 모든 고친 파일 HEAD 와 같은 수(새 파일 0)

## 5. headless (Edge · pipe · 새 프로필 `b15-2/pA1–3·pB1–3·pR1–2·pL1–2·pO1` · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 캐시 끔 · 서버 없음 · 한 번에 하나)
- 합성 PDF 둘(`b15-2/make-pdf.mjs`): `text.pdf`(원서 문제 없음 · 6쪽 · 개요 장 3 + 절 1) · `quiz.pdf`(SECTION I 5문항·정답 · 본문 2쪽 · 개요)
- run-a 14초 · run-b cur/head 6·18초 · run-r cur/head 6·17초 · run-l 19초 · run-o 5초 — **콘솔 오류 = 흉내 429 응답의 네트워크 줄 1개뿐**(run-a, 하네스가 낸 것) · pageerror 0 · 외부 요청 0 · 빠진 파일 0
- 스크린샷 `b15-2/shots/`: `ko-360-review.png` · `ar-360-review.png` · `ar-412-quiz.png` · `fr-915-pick.png` · `en-412-quiz.png`

## 6. 설계와 달라진 점(spec 정정 줄)
① 15-1R 규칙·`sentParaIds`·"남은 문단 m" = 아직 문항이 되지 않은 읽은 문단 수 ② 11-3 의 고르기는 맨 위 깊이 그대로(옮기기만 — 넓히면 11-3 동작이 바뀜), 묶음·13-2 는 `chapterRanges` · 기본 범위 = 읽던 쪽이 든 깊이 0 장 ③ 12-3 범위의 새 카드 몫은 범위 안에서 다시 채움(ui 쪽) ④ AI 인용·줄기 `dir` 은 원문 언어 방향(en 이면 ltr) · 정답 줄 `quiz.ai.expected` · AI 해설 [읽기] 없음 ⑤ 삭제 확인 AI 줄은 따로 한 줄 ⑥ 개념도 칸 없음.

## 7. 남은 문제
1. **11-3 범위 고르기 깊이**: 11-3 은 맨 위 깊이(장만), 13-2·묶음은 깊이 0·1. 한 규칙으로 맞추려면 11-3 화면 동작이 바뀐다(목록 머리·셈) — 운영자/다음 다듬기 결정 거리.
2. 묶음 화면을 열 때마다 범위 쪽을 커서로 읽어 후보를 센다(호출 0). 40쪽 장의 실기기 체감은 실기기 묶음(node 측정은 PDF 추출 포함 장당 약 2초 — 저장본 읽기만은 더 짧을 것).
3. [원문에서 보기]는 리플로우 줄(`revealLine`) 기준 — 원본 보기(그림 화면)에서는 쪽만 연다.
4. AI 해설 낭독 없음(원서 영어 해설 낭독 장치 그대로). 대상 언어 해설 낭독은 다음 단계 거리.
5. 문항을 다 쓴 범위에서도 [문제 만들기]는 눌리고 "더 쓸 문단이 없습니다"(0호출).
6. 같은 줄기 문항이 다른 누름에서 다시 오면 레코드를 덮어 앞 누름의 `sentParaIds` 한 벌이 사라질 수 있다(그 누름의 다른 문항이 남아 있으면 셈 그대로) — 순서만 조금 달라질 뿐.
7. fr 의 `nav.back`·`common.cancel` 이 영어("Back"·"Cancel") — 15-2 와 무관한 기존 값(스크린샷에서 봄).
8. 서재 삭제 확인은 여전히 `confirm()`(다듬기 묶음 몫 — 지침대로 바꾸지 않음).
9. **실기기(spec 17-13 10 · 적기만)**: 실제 Gemini 5문항 스키마·폐기율(낮음-4 대소문자·20자 미만 · 낮음-5 숫자 허용 범위 함께) · Nour 10문항(근거가 정답을 받치는가·아랍어 해설) · GT 7 세로·가로 칸·🤖/📕 구별.

## 8. 하네스 · 규칙
스크래치 `b15-2/`: `pre/`(15-1 상태 사본) · `measure.mjs` · `headcmp.mjs` · `edit-router-test.mjs` · `charcheck.mjs`·`fixchars.mjs` · `make-pdf.mjs`·`text.pdf`·`quiz.pdf`·`synprobe.mjs` · `mkcommon.mjs`·`common.mjs`(b15-1 것을 읽어 만듦) · `run-a/b/r/l/o.mjs` · `mut.mjs`·`bak/`·`mut-*.txt` · `test-run1/2.txt` · `shots/` · 프로필 `p*`. `r15-1/`·`b15-1/` 는 읽기만.
명령은 한 호출에 한 가지 · 권한 거절 0 · 서버·프로세스 조회·디버깅 포트 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · 진짜 키 0 · 프로필 복사 0 · 원서 글 옮김 0(숫자만) · 백그라운드 작업 1(CMDT 측정 — 끝남) · 가장 긴 실행 약 1분.
