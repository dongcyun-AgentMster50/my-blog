# Build 보고 — 8n-b: 8n Review 지적 고치기 (2026-11-16)

> Build 서브에이전트. 지침 `.claude/tasks/medreader-build-8n-b-fix.md`, 근거 review.md "8n Review" 8nR-1–9. **커밋하지 않음.** 스크래치 `b8nb/`(백업 `bak/`=시작 때 8n 판 · `bak2/`=고친 판, 변이용). Review 스크래치 `r8n/` 은 읽기만(HEAD 판 모듈·`r8n-es-natural.pdf`·문단).

## 바꾼 파일
| 파일 | 내용 |
|---|---|
| `js/text/lang.js` | `FR_ES_OVERLAP = {la}` · `functionWordRates` 에 `frForEs`(la 뺀 fr 빈도)·`esWords`(es 기능어 낱말 수) 더함(기존 필드 그대로) · `GUESS.ES_MIN_WORDS = 2` · es 갈래: `r.es > 0 && esWords ≥ 2 && r.es ≥ 2·max(en, frForEs)`, score `1 − max(en, frForEs)/es`. **en·fr 두 갈래 코드는 한 글자도 안 바뀜.** 머리 주석 갱신 |
| `js/text/segment.js` | es 전용 `esOpenerContinues` — 여는 `¿¡` 앞이라도 (a) 바로 뒤가 소문자 (b) 앞이 소문자 겹약어 꼴 `/(?:^|[\s(])\p{Ll}\.\s?\p{Ll}{1,3}\.$/u`(`p. ej.`)이면 끊지 않는다. en·fr·ko 의 `SENTENCE_START` 에 `¿¡` 가 없어 그쪽은 도달 불가. 약어 목록 불변 |
| `js/ui/library.js` | 258행 주석 "(미지원이어도 셋)" → "넷" 한 곳 |
| `tests/srclang-es-8n.test.mjs` | N4 의 es 승리 단언을 새 규칙(`frForEs`·`ES_MIN_WORDS`)으로 · N2 하나 · N11 셋 · N12 둘 · N13 · N14 (+8개) · 머리 주석 |
| `tests/fixtures/srclang-8n-corpus.mjs` | 새 묶음 `ES_NATURAL`(10: Review 6 + 새 4)·`FR_NATURAL`(7: 새 5 + Review 2). **`GUESS_CASES`·`SPLIT_CASES` 와 golden 은 그대로** |
| `index.html` | stamp 다시(모듈 66 · CSS 4) |
| `spec.md` | 19-1-3 §5 에 `[정정 2026-11-16 — 8n-b]` 한 줄(Edit 로 그 자리만) |

DB·`algoVersion`·캐시 키·`PROMPT_VERSION`·review.md·`dev/`·`ui/settings.js` 무수정. golden(`srclang-8n.golden.json`) 손대지 않음(수정 시각 01:37 그대로, 재대조 다른 것 0).

## 1. 높음 — 보통 스페인어가 fr (고침)
**`le`·`les` 를 뺄지 실측**(`b8nb/measure.mjs`, 지은 스페인어 12문단): la 94 · le 4 · les 2. `le` 까지 빼면 golden 경계 `b-fr-es`(fr 3·en 1·es 2, "es 낱말 섞인 프랑스어")가 es 로 넘어간다 — 회귀라 **`la` 만** 뺐다. `les` 를 더 빼도 도움 되는 표본이 없었다(대명사 많은 `hijos` 는 la+les 로도 안 됨).

| 묶음 | HEAD | 8n 판 | 지금 |
|---|---|---|---|
| Review 스페인어 6 | fr 5 · en 1 | fr 5 · es 1 | **es 6** |
| 새 보통 꼴 스페인어 6(의학 hta·neumonia·vacuna, 일상 panaderia·hijos, 설명 fotosintesis) | fr 6 | fr 6 | **es 4**, fr 2(`hijos`: le 3·les 2 · `vacuna`: es 기능어 0) |
| 이은 것(Review 6 / 새 6) | fr / fr | fr / fr | es·1 / es·0.793 |
| 프랑스어 새 5 + Review 2 + fr 픽스처 | fr | fr | **fr 전부, score 도 8n 이전 규칙과 같음** |
| 무작위 4만(Review 생성기, `la` 더 많게) | — | — | HEAD 와 다른 7,065건 **전부 es·새 규칙 충족**, es 아닌 쪽 변화 **0** · 8n 판 대비 fr→es 399 · es score 0.537–1 |
| golden(guess 26 · split 23×3) | — | — | 다른 것 **0** |
| 의학책 3권(CMDT 2026 174쪽·CMDT 2021 149쪽·Harrison 176쪽 = 499쪽, 200자 이상) | — | — | HEAD 와 다른 쪽 **0**, es **0** · 쪽별 es/max(en,fr−la) 최대 0.143·0.016·0.014 · 앞 30쪽 표본 셋 다 en·1 |

테스트: N11 — 보통 꼴 스페인어 10문단 각각 es(score ≥ 0.5) + 8n 이전 규칙으로 fr 이던 것이 8개 이상(고침이 실제로 일하는지) + 이으면 es · 프랑스어 8개 fr 그대로·score 가 8n 이전 사본과 같음 · `frForEs` 가 la 만 뺌.

## 2. 낮음 — es 최소량 (고침)
`GUESS.ES_MIN_WORDS = 2`. **지침 예시 3 이 아닌 이유**: Review 문단 `shortfem`(266자)에 es 기능어가 `es`·`los` 둘뿐이라 3 이면 en 이 된다(지침이 요구한 "Review 6개 es" 와 충돌). 2 로 두면 포르투갈어 꼴(es 1)·약어 표 `LOS`/`DEL`(es 1)은 **en·0 으로 돌아옴**(8n 판은 es·1). 악센트 없는 베트남어(`Con`·`lo` = 2)는 es 그대로 — 한계. 테스트 N12: 1낱말 → en·0(8n 이전 사본과 같음), 2낱말 → es·1, 포르투갈어·약어 표 둘 → en·0.

## 3. 낮음 — 테스트 구멍 (메움)
- N13: es score 값 고정 — `the con el lo` → 0.667, `le la la la con el lo para` → 0.75, `the and con el lo para por` → 0.6.
- N14: `VOICE_SAMPLES.es` — 스페인어 글자(á é í ó ú ñ ¿ ¡) 있음·한글/아랍 아님·다른 견본과 다름·영어 기능어 0. (`guessLang` 은 쓸 수 없다 — 200자 미만이고 견본 "Así suena la voz de lectura." 의 es 기능어가 0 이다.)

## 4. 낮음 — 문장 나눔 (고침, es 만)
| 글(es 규칙) | 8n 판 | 지금 |
|---|---|---|
| `Es grave… ¿o no? Creo que sí.` | 3조각 | `Es grave… ¿o no?` · `Creo que sí.` |
| `Hay dudas, p. ej. ¿Cuándo empezar? …` | `p. ej.` 뒤에서 끊음 | 안 끊음 |
| `Tiene tos. ¿Desde cuándo? Hoy.` · `Es así. ¡Qué bien! …` | 끊음 | 끊음(그대로) |
| `Vino a las 9 a. m. ¿Y luego?` | 끊음 | 안 끊음(겹약어 꼴 — 한계) |

대조(`check.mjs`·`split2.mjs`): en·fr·ko·인자 없음 무작위 3만 × 4 를 HEAD·8n 판과 — 다른 것 **0**(12만×2). es 는 8n 판과 비교 10만 중 4만8,702 다름 — **전부 `¿¡` 든 글**, `¿¡` 없는 글 다른 것 0, **새로 끊는 자리 0**(자름 자리 부분집합·글자 불변).

## 5·6. spec · 주석
spec 19-1-3 §5 에 `[정정 2026-11-16 — 8n-b]` 한 줄(고친 것·실측 숫자·남은 한계, 8m 아랍 문자 문장 묶임 포함). library.js 주석 "넷".

## 변이 (`b8nb/mutate.mjs` — bak2 원본 읽어 한 곳 바꿔 쓰기 → 전체 `node --test` → bak2 읽어 쓰기 → `cmp` 두 파일 같음)
IM2·IM6·IM7b(import map 해시)는 매번 함께 빨강 — 아래 숫자에서 뺐다.

| # | 변이 | 빨강(IM 제외) |
|---|---|---|
| m1 | **1번 고침 되돌리기**(`bigEs` 에 `r.fr`) | 3 — N11 보통 꼴 스페인어 · N11 frForEs · N13 |
| m2 | **최소량 끄기**(`ES_MIN_WORDS: 1`) | 2 — N12 경계 · N12 포르투갈어·약어 표 |
| m3 | 최소량 올리기(3) | 3 — N11 ×2 · N12 경계 |
| m4 | **score 식** `1 − bigEs/(2·es)`(Review 변이 c) | 1 — N13 |
| m5 | 겹침에 `le` 더함 | 4 — N3 golden · N5 · N11 · N13 |
| m6 | ¿¡ 계속 규칙 끄기 | 1 — N2(8n-b) |
| m7 | 겹약어 규칙만 끄기 | 1 — N2(8n-b) |
| f | `VOICE_SAMPLES.es` 를 영어로(Review 변이 f) | `ui/settings.js` 는 수정 범위 밖이라 파일 변이 대신 N14 단언을 영어·프랑스어·"악센트 섞인 영어" 견본에 대어 봄(`n14-sim.mjs`): 셋 다 빨강, 실제 견본은 초록 |

복원: `cmp b8nb/bak2/{lang,segment}.js` 작업 트리와 같음(두 번 — 첫 실행은 테스트 파일 목록 펼침 실수로 테스트가 안 돌아 다시 돌렸고, 그때도 복원 cmp 같음).

## 테스트 · 검사
| 실행 | tests | pass | fail |
|---|---|---|---|
| 전체 1회 | 1503 | 1503 | 0 |
| 전체 2회 | 1503 | 1503 | 0 |

(1495 → 1503, 새 8개.) `stamp-importmap --check` "그대로다(모듈 66 · CSS 4)" 0 · `git diff --check` 0.

## headless (`b8nb/runC.mjs` — 새 프로필 `b8nb/p1` · Edge pipe · 412×915 · 가짜 키 · 흉내 Gemini OPTIONS 204+CORS · 흉내 음성, `r8n/hl.mjs` 를 복사해 경로만 바꾼 `b8nb/hl.mjs`)
| 확인 | 결과 |
|---|---|
| `r8n-es-natural.pdf` 가져오기 | **`es`·auto·`langGuess {es, 1, latin}`**(Review 때 fr·1) |
| 1쪽 낭독 11발화 | 전부 **`es-ES`**, voice 없음 |
| 번역 요청 | **"from Spanish into Arabic"** ×2, 띠 `ar`·`rtl`, 가로 넘침 0 |
| 회귀 CMDT 2026(1,967쪽) | 판정 **en**·1 · 40쪽 9발화 `en-US` · "from English into Arabic" ×2 · 띠 `ar`·`rtl` · 가로 넘침 ko 0·ar 0 · ar `dir=rtl` |
| 공통 | 콘솔 오류 0 · 페이지 오류 0 · 4xx/5xx 0 · 흉내 오류 0 · 외부 요청은 pdf.js CDN 뿐 · 16.6초 |

스크린숏 `b8nb/shots/C-natural-p1-ko.png`·`C-cmdt-p40-ar.png`.

## 남은 한계
- 대명사 `le`·`les` 가 많은 짧은 일상 스페인어(`hijos`)·es 기능어가 0 인 짧은 스페인어(`vacuna`)는 fr 그대로(8n 이전과 같은 값). 긴 문서 표본(최대 8,000자)에서는 묻힌다(새 6문단을 이으면 es).
- 미지원 라틴 언어: 악센트 없는 베트남어(es 기능어 2)·이탈리아어(es·0.8)·카탈루냐어(HEAD fr → es·0.667)는 es. 긴 포르투갈어 문서는 `por`·`para` 가 쌓이면 es 가 될 수 있다(짧은 견본은 en).
- es 분할: `a. m. ¿…` 도 겹약어 꼴로 안 끊김 · `Sra.` 뒤 끊김(약어 목록 그대로) · 식별자 괄호(B2) 뒤 `¿` 소문자 꼬리 질문은 이 규칙 밖.
- 8m: es 분할은 `?`·`.` 뒤 아랍 문자에서 끊지 않아 스페인어+아랍 한 단위가 ar 목소리 — fr 문서와 같은 기존 한계(spec 에 더함).
- 이미 fr 로 판정된 옛 서재 문서는 다시 추정하지 않는다(설계대로 — [⋯] 로 고침). 그때 받은 "from French" 번역 캐시는 남는다(7c 부터의 동작).

## 막힌 명령 · 기타
막힌 명령 없음. 변이 스크립트 첫 실행에서 `spawnSync(..., shell:true)` 로 `*.test.mjs` 를 넘겨 테스트가 돌지 않았다(결과 비어 있음) — 파일 목록을 펼쳐 다시 돌렸다(복원 cmp 는 두 번 다 같음). 프로세스 조회·디버깅 포트·npm·다운로드·커밋 0. 8000 python 사용만, puppeteer-core 읽기만, 가짜 키만. 의학책은 읽기만(숫자만 기록).

스크래치 `b8nb/`: `bak/`(시작 때 8n 판 lang·segment·config·library·테스트·말뭉치·index·spec) · `bak2/`(고친 lang·segment) · `paras.mjs` · `measure.mjs` · `check.mjs`(+`check-out.json`) · `split2.mjs` · `books.mjs`(+`books-out.json`) · `mutate.mjs`(+`mutate-out.json`) · `n14-sim.mjs` · `hl.mjs` · `runC.mjs`(+`runC-out.json`) · `full1.txt`·`full2.txt` · `shots/` · `p1/`(프로필).
