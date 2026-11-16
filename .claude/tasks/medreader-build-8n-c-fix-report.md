# Build 보고 — 8n-c: 8n-b 재검증 지적 고치기 (2026-11-16)

> 지침 `.claude/tasks/medreader-build-8n-c-fix.md` · 근거 `apps/medreader/review.md` "8n-b 재검증" 8nbR-1–10. Build 서브에이전트. **커밋 0.** 스크래치 `b8nc/`(Review 의 `r8nb/`·`r8n/head/` 는 읽기만 — 스크립트는 복사해 경로만 바꿔 씀). headless 는 하지 않았다(판정 함수·분할 함수만 바뀜, 화면·낭독 연결 무변경).

## 바꾼 파일

| 파일 | 바뀜 |
|---|---|
| `js/text/lang.js` | `RE_FR_TU_ES = /(?<!\p{L})(?:tu\s+\|t['’])es(?!\p{L})/gu` 하나 더함 · `functionWordRates` 가 그 수만큼 `es` 를 빼고 `frForEs` 에 더함(`esWords`·`es` 도 뺀 값) — `fr`·`en` 그대로 · 머리·함수 주석 |
| `js/text/segment.js` | 8n-b 의 겹약어 규칙 (b)(`ES_COMPOUND_ABBREV_END`) 뺌 — `esOpenerContinues(t, j)` 는 꼬리 질문 규칙(여는 부호 뒤 소문자)만 · 주석 |
| `tests/srclang-es-8n.test.mjs` | N2 8n-b 테스트에서 `p. ej. ¿Cuándo` 안 끊김 기대 2줄을 고친 판(소문자 꼬리 질문으로) · **N2 8n-c 새 1개**(겹약어 뒤 ¿¡대문자 끊김 + M4 꼴) · **N15 새 3개**(tu es 프랑스어 11 · 스페인어 묶음 · `functionWordRates` 값) |
| `tests/fixtures/srclang-8n-corpus.mjs` | 끝에 `FR_TUES`(11 — Review 5 + Build 6)·`ES_TU`(2) **덧붙임만**. 기존 묶음·함수 글자 그대로(`b8nc/corpus-same.mjs`: ES·ES_NATURAL·FR_NATURAL·GUESS_CASES·SPLIT_CASES·SPLIT_LANGS·atLeast200 모두 같음) |
| `index.html` | stamp(`lang.js`·`segment.js` 해시 두 줄) |
| `spec.md` | 19-1-3 §5 에 `[정정 2026-11-16 — 8n-c]` 한 줄(Edit, 그 자리만 — diff 1줄 추가) |

golden `srclang-8n.golden.json` 무변경(sha1 `1ab93adb…` 시작·끝 같음, 수정 시각 01:37 그대로).

## 1. 중간 — `tu es` 프랑스어가 es 로 (`b8nc/eval-tues.mjs`)

| 묶음 | HEAD | 8n-b 판 | 지금 |
|---|---|---|---|
| `tu es` 프랑스어 Review 5(`lettre`·`enfant`·`coach`·`patient`·`tutoie-court`) | fr·1 ×5 | es 3 · fr 2 | **fr·1 ×5 — HEAD 와 lang·score·script 같음** |
| `tu es`·`t'es` 프랑스어 Build 6(`c-sms`·`c-grandmere`·`c-medecin-ami`·`c-sport`·`c-dispute`·`c-classe`, 233–254자) | fr·1 ×6 | **es 5**(0.5–1) · fr 1 | **fr·1 ×6 — HEAD 와 같음** |
| Build 6 이은 것 | fr·1 | es·0.75 | fr·1 |
| 스페인어 Review 8 · `ES_NATURAL` 10 · 말뭉치 `ES` · Build 덧 2(`t es` 수식 변수 · 소유 `tu` · `¿Tú eres?`) | fr 20 · en 1 | es ×21 | **es ×21 — 8n-b 판과 값까지 같음** |
| 프랑스어 Review 8 · `FR_NATURAL` 7 · fr 픽스처 | fr ×16 | fr ×16 | fr ×16(HEAD 와 같음) |

- 규칙: `tu` 와 `es` 사이는 공백만, `t` 와 `es` 사이는 아포스트로피(`'` `’`)만 — 쉼표가 끼거나 `t es`(스페인어 "donde t es el tiempo")는 걸리지 않는다. en·fr 두 갈래 비교의 `fr` 은 안 건드린다.
- 테스트: N15 ★★(11문단 각각 fr·`legacyLatin` 값과 같음·`esWords` 0·이어도 fr) · N15 ★★(스페인어 13 + `ES` es) · N15 ★(`functionWordRates('Tu es T’es t\'es t es tues es')` → words 10·esWords 2·es 200·frForEs 300·fr 0, `tu\n  es`·`tu, es`·`tu casa es` 경계, 8n-b 판 es·1 이던 짧은 반말 꼴 → HEAD 값).

## 2. 낮음 — 겹약어 뒤 `¿대문자` : **(나) 규칙 빼기** 를 골랐다 (`b8nc/abbrev-measure.mjs`)

같은 지은 표본 124개로 (가) 8n-b 판 그대로 / (나) 규칙만 뺀 사본(`b8nc/optB/`)을 쟀다.

| 표본 | 맞는 답 | (가) 규칙 둠 틀림 | (나) 규칙 뺌 틀림 |
|---|---|---|---|
| 문장 중간 `p. ej.`·`p.ej.`·`v. gr.` × 12틀 = 36 | 안 끊음 | 0 | **36** |
| 문장 끝 `i. v.`·`v. o.`·`s. c.`·`i. m.`(약 11틀) · `a. m.`·`p. m.`·`a.m.`·`p.m.`(시각 11틀) = 88 | 끊음 | **88** | 0 |
| **합 124** | | **88** | **36** |
| 꼴별 같은 수(중간 `p. ej.` 10 · 끝 `i. v.` 10) | | 10 | 10 → 동률 → (나) |

- 어느 쪽으로 세도 (나)(전체 36 < 88, 같은 수면 동률 → 규칙이 적은 쪽). 대조군 6개는 두 안이 같다: 겹약어 뒤 보통 대문자 낱말(`p. ej. Paracetamol`, `i. v. Luego`)은 **두 안 모두 원래 끊었다**(규칙 (b)는 `¿¡` 에만 걸렸다) — (나)는 `¿¡` 를 보통 대문자와 같게 맞춘 것. 꼬리 질문 `¿o no?`·`p. ej. ¿cuándo…?`(소문자)는 두 안 모두 안 끊음.
- 비용 차이: (나)가 틀리면 문장 중간 `p. ej.` 뒤에 짧은 쉼이 들고 번역 항목이 둘로 나뉜다(`Hay dudas, p. ej.` 가 따로 번역됨). (가)가 틀리면 두 문장이 한 낭독 단위·한 번역 항목으로 길어진다(강조·반복·건너뛰기가 두 문장 단위). 스페인어 정서법상 문장 안에 끼운 의문문은 소문자로 시작하는 것이 보통이라 (나)의 틀림 꼴(`p. ej. ¿대문자`)은 실물에서 드물 것으로 본다 `[가정]`.
- 약어 목록은 늘리지 않았다. 테스트 N2 8n-c(★): `i. v.`·`s. c.`·`a. m.`·`p.m.` 뒤 `¿¡` 끊김, `p. ej. ¿Cuándo`·`p.ej. ¡Qué`·`p. ej. Paracetamol` 끊김, **M4 꼴 `…la mano. sí. ¿Y ahora?` 끊김** — (b)를 되살리면(왼쪽 경계 있든 없든) 빨강(아래 X6·X7).

## 3. spec

19-1-3 §5 에 `[정정 2026-11-16 — 8n-c]` 한 줄: ① tu es 고침·숫자 ② 고른 안 (나)·표본 124(88 대 36, 같은 수면 10 대 10)·비용 차이 ③ 남은 한계에 더함 — 문장 중간 `p. ej. ¿대문자` 앞 끊김 · `ES_MIN_WORDS = 2` 의 영어 참고문헌·약물 표 꼴 es·1(실물 0) · 대화 줄표 `—¿` 앞 안 끊김.

## 검증

- **golden**: HEAD 모듈(`r8n/head/`)로 다시 만들어 대조(`b8nc/golden-check.mjs`) — guess 26 · split 23 × en·fr·ko: HEAD↔golden 0 · 지금↔golden 0 · 여분 키 0. sha1 시작·끝 같음.
- **무작위**(`b8nc/fuzz.mjs` = Review `r8nb/fuzz.mjs` 복사, 비교 기준을 8n-b 판으로 · `tu es`·`t’es`·`i. v.`·`s. c.`·`p.m.` 꼴 더함 / `b8nc/fuzz2.mjs` = 같은 것에 난수만 mulberry32):
  - fuzz2(서로 다른 글 **50,000**): HEAD 와 다른 8,564건 **전부 지금 es·규칙 충족, es 아닌 쪽 HEAD 와 다른 것 0**. 8n-b 판 대비: es→fr 1,570 · es→en 271(모두 HEAD 값으로 돌아감) · es 끼리 score 다름 1,304. es score 0.5–1.
  - 분할: en·fr·ko·인자 없음 30,000 × 4 = **120,000 — HEAD·8n-b 와 다른 것 0**. es 30,000: 8n-b 와 다른 10,063건 모두 `¿¡` 든 글 · 글자 불변 · 8n-b 자름 잃은 것 0 · 새 자름은 **모두 겹약어 꼴 뒤 `¿¡`**(그 밖 0). 8n 판과는 지금 자름 ⊆ 8n 자름(새로 끊는 곳 0 — 다른 것은 꼬리 질문 규칙뿐).
  - fuzz(Review 난수 그대로) 도 같은 결론(es 아닌 쪽 HEAD 와 다른 것 0 · 분할 en·fr·ko 12만 0). 덧: Review 의 LCG(`& 0x7fffffff`)는 같은 글을 되풀이 낸다(8n-b 판 es→지금 fr 사례 디버그에서 같은 글이 거듭 나옴) — 그래서 fuzz2 를 더 돌렸다.
- **의학책 3권**(`b8nc/books.mjs` = Review 것, 비교 기준 8n-b 판, 11.7초): CMDT 2026 174쪽 · CMDT 2021 149쪽 · Harrison 176쪽 = 499쪽 — 쪽별 HEAD·8n-b 와 다른 쪽 0, es 0 · 앞 30쪽 표본 세 권 en·1(HEAD 같음) · 짧은 창 15,315개(200·400·800자) es 0, es 아닌 쪽 HEAD 와 다른 것 0. 원문 미출력(숫자만).
- **테스트**: 전체 `node --test apps/medreader/tests/*.test.mjs` **2회 — 1507/1507 · 1507/1507**(1503 → 1507, 새 4개). `stamp-importmap --check` "그대로다(모듈 66 · CSS 4)" 종료 0 · `git diff --check` 종료 0 · 추적 안 된 테스트·말뭉치 끝 공백 0·CR 0.

## 변이 (`b8nc/mutate.mjs` — 원본은 `b8nc/bak/now/` 에서 읽어 한 곳 바꿔 쓰기 → 전체 `node --test` → `finally` 원본 쓰기)

IM2·IM6·IM7b(import map 해시)는 매번 함께 빨강 — 표에서 뺐다.

| # | 변이 | 빨강(IM 밖) | 판정 |
|---|---|---|---|
| X1 | **1번 되돌림**(`tuEs = 0` = 8n-b 판) | N15 ★★ 프랑스어 11 · N15 ★ 값 | 잡힘 |
| X2 | `tu es` 를 es 에서 빼기만, fr 쪽에 안 셈 | N15 ★ 값 | 잡힘 |
| X3 | `tu es` 가 en·fr 두 갈래 `fr` 로 샘 | N15 ★ 값 | 잡힘 |
| X4 | `t'es` 꼴 빼기 | N15 ★★ 프랑스어 11 · N15 ★ 값 | 잡힘 |
| X5 | `t es`(공백)까지 넓힘 | N15 ★ 값 | 잡힘 |
| X6 | **2번 되돌림**(겹약어 규칙 (b) 다시 = (가)) | N2 8n-c | 잡힘 |
| X7 | (b) 를 왼쪽 경계 없이(Review M4 꼴) | N2 8n-c | 잡힘 |

복원: `restored: true` · `cmp` `lang.js`·`segment.js` ↔ `b8nc/bak/now/` 같음. (첫 실행은 변이 스크립트의 정규식 문자열 이스케이프 실수로 X4·X5 패턴 0회·X6·X7 모듈 문법 오류였다 — 스크래치 스크립트만 `String.raw` 로 고쳐 다시 돌림, 앱 파일은 매번 복원 확인.)

## 남은 한계

- 문장 중간 `p. ej. ¿대문자…?` 는 이제 `¿` 앞에서 끊긴다(짧은 쉼 + 번역 항목 둘). 글자만으로는 문장 끝 `i. v. ¿…` 와 못 가른다.
- `ES_MIN_WORDS = 2`: 기능어 없는 짧은 영어 참고문헌·약물 표 꼴(`Del Rio C`·`Lo B`, `Con A`·`Para-`)은 es·1(실물 짧은 창 15,315 에서 0).
- 대화 줄표 `—¿…?` 앞은 끊지 않는다(기존 꼴, 대화 문단이 한 발화).
- `tu es` 규칙은 공백·아포스트로피 사이만 본다 — `tu` 와 `es` 사이에 줄 끝 하이픈·기호가 끼는 꼴은 세지 않는다(그런 프랑스어는 드묾 `[가정]`).
- 8n-b 한계 그대로: 대명사 `le`·`les` 많은 짧은 스페인어·es 기능어 0 인 짧은 스페인어는 fr · 미지원 라틴 언어 일부 es · `Sra.` 뒤 끊김 · 8m 아랍 문자 문장 묶임.

## 실행 · 정리

막힌 명령 없음. 덧: ① `node --test` 첫 실행에서 내가 쓴 테스트 기대값 하나(`tu, es` → 0 이라 씀, 실제 1 이 맞음)가 빨강 — 테스트 기대를 1 로 고침(코드 무변경) ② 변이 스크립트 이스케이프 실수(위). 커밋 0 · `git checkout/restore/stash` 0 · npm·다운로드 0 · 8000·8123–8125 사용 0 · headless 0 · 프로세스 조회 0 · 가짜 키도 안 씀 · 의학책 읽기만(숫자만). `git status` 는 시작 때와 같은 목록(+ 이 보고서).

스크래치 `b8nc/`: `bak/`(시작 때 lang·segment·8n 테스트·말뭉치·index.html·spec) · `bak/now/`(고친 뒤 lang·segment — 변이 복원용) · `v8nb/`(8n-b 판 모듈 사본) · `optB/`((나) 모의) · `start-sha1.txt`·`end-sha1.txt` · `tues-paras.mjs` · `eval-tues.mjs`(+`-out.txt`) · `abbrev-measure.mjs`(+`abbrev-out.json`) · `corpus-same.mjs` · `golden-check.mjs`(+`golden-out.json`) · `fuzz.mjs`·`fuzz2.mjs`·`fuzz-dbg.mjs`(+`fuzz-out.json`·`fuzz2-out.json`) · `books.mjs`(+`books-out.json`) · `mutate.mjs`(+`mutate-out.json`) · `full0.txt`·`full1.txt`·`full2.txt`.
