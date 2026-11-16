# Build 보고 — 8n-e: 대문자 고유명사 거르기 (P3) + 숫자 바로잡기

> Build 서브에이전트. 지침 `.claude/tasks/medreader-build-8n-e-fix.md`, 근거 review.md "8n-d 재검증"(8ndR-1–7). 커밋 0 · headless 0 · 서버 0. 스크래치 `b8ne/`(`r8nd/`·`b8nd/` 는 읽기·가져오기만 — 그 폴더에 쓴 것 0).

## 1. P3 — 대문자 es 기능어는 다음 낱말이 소문자일 때만

`js/text/lang.js` 에 `countEsWords(text)` 를 두고 `functionWordRates` 의 `es`·`esWords` 를 그것으로 센다.

- **원문 글자꼴**에서 낱말(`\p{L}+`)을 뽑는다. es 기능어(9개)가 **대문자로 시작하고 모두 대문자는 아니면**(`Los`·`El`·`Del`·`Con`…) 바로 다음 낱말이 `\p{Ll}` 로 시작할 때만 센다. 다음 낱말이 없으면(글 끝) 안 센다. "다음 낱말" 은 다음 글자 덩이라 숫자·기호·문장부호는 건너뛴다(`Los «pacientes»`·`Con 20 mg` 셈, `Los 3 Reyes` 안 셈). 대소문자 없는 글자(한글)로 시작하면 안 셈.
- **모두 대문자(`LOS`·`DEL`)·소문자는 그대로 센다** — 지침대로. 바꾸지 않은 이유: 표·약어 꼴(N12 `LOS 4 days`)은 `ES_MIN_WORDS` 가 이미 막고, 모두 대문자 제목(`EL PACIENTE…`)은 진짜 스페인어일 수 있다.
- en·fr·`frForEs`·`words` 는 지금처럼 소문자로 바꾼 글에서 센다 — **한 글자도 안 바뀜**. 원문 낱말은 소문자 글 낱말과 1:1(ASCII 기능어)이고 세는 쪽만 줄어드므로 es 셈은 늘 8n-d 이하 → es 갈래가 서지 않는 글은 결과가 그대로 HEAD.
- 머리말·`functionWordRates` 주석에 `[8n-e]`.

### 측정 (`b8ne/eval.mjs` — HEAD = `r8nd/head`, 8n-d = `b8ne/bak/lang.js`, 지금 = 앱. 200자 미만만 숫자 채움)

| 묶음 | n | 8n-d es | 지금 es | 비고 |
|---|---|---|---|---|
| 스페인어 앞 모음(b8nd) | 39 | 35 | 35 | **잃음 0** |
| 스페인어 `ES_SHORT` | 12 | 8 | 8 | 잃음 0 |
| 스페인어 `ES_NATURAL`+`ES_TU` | 12 | 11 | 11 | 잃음 0 |
| 스페인어 r8nd | 13 | 6 | 6 | 잃음 0 |
| 프랑스어 앞 모음 · `FR_ES_FORMS` | 46 · 17 | 0 · 0 | 0 · 0 | |
| 프랑스어 r8nd(고유명사 8 + `tu es` 섞음 8 + être 8) | 24 | 3 | **1** | 남은 하나 `b-cours-espagnol`(es·0.5) — 프랑스어 문장 속 **소문자** 스페인어 낱말 목록, 두 언어가 진짜 섞인 글 |
| 영어 r8nd(고유명사 8 + 참고문헌 9) | 17 | 5 | **0** | `e-refs-delrio`·`e-refs-conA`·`ref-hisp2/3/6` → en·1 = HEAD |
| 그 밖(b8nd) | 44 | 8 | 5 | 남은 다섯: 포르투갈어·베트남어 둘·이탈리아어·카탈루냐어 — 미지원 라틴(8n-b 한계 그대로) |

**Review 스페인어 64(39+12+13) 잃음 0.** 앱 ↔ Review 모의 P3(`r8nd/sim.mjs` 식) 224글 다른 것 0 · es 아닌데 HEAD 와 다른 것 0. 이은 글: 프랑스어 r8nd fr·1 · 영어 en·1 · 스페인어 r8nd es·0.569(8n-d 0.577).

**문장 틀 퍼징**(`b8ne/fuzz-fr.mjs` — r8nd 의 틀·고유명사·생성기, 씨앗 r8nd 것 + 새 씨앗 하나, 4,000 × 비율 5 × 2언어 × 2씨앗):

| p | 프랑스어 8n-d es | 프랑스어 지금 | 영어 8n-d | 영어 지금 |
|---|---|---|---|---|
| 0.1 | 3.7% · 4.98% | **0** · 0 | 0.1% · 0.05% | 0 · 0 |
| 0.2 | 12.1% · 12.7% | **0** · 0 | 0.33% · 0.28% | 0 · 0 |
| 0.35 | 27.6% · 27.4% | 0 · 0 | 0.48% · 0.53% | 0 · 0 |
| 0.5 | 40.8% · 40.3% | 0 · 0 | 0.38% · 0.35% | 0 · 0 |
| 1 | 71.3% · 70.4% | 0 · 0 | 0.2% · 0.23% | 0 · 0 |

모든 칸 es 아닌데 HEAD 와 다른 것 0.

## 2. 숫자 바로잡기 (낮음-2)

- `tests/fixtures/srclang-8n-corpus.mjs` 끝에 `padTo200(s)` — 200자 이상이면 글 그대로, 미만이면 **숫자 `0`** 으로 200자까지. 숫자는 낱말·글자 계통 셈에 들지 않아 기능어 수·비율·score 가 글 그대로. `atLeast200` 은 그대로 둠(golden `GUESS_CASES` 가 쓴다 — 바꾸면 golden 이 달라짐).
- 테스트의 묶음 판정(N11·N15·N16, 8곳)을 `padTo200` 으로. 영향은 `ES_SHORT` 의 `z-casa`(205자)·`z-migrana`(216자)뿐 → `ES_LIGHT` 에 더함, N16 ★ "12 중 10 es" → **8 es**(`light` 2 → 4). FR 묶음의 200–219자 다섯은 원래 8n 이전 값이라 결과 같음.
- 8n-d 측정 다시 재기(`b8ne/remeasure.mjs` — `b8nd/measure.mjs` 의 모의·말뭉치 그대로, 채움만 바꿈):

| 숫자 | 8n-d 보고·spec | 바른 값 |
|---|---|---|
| 합친 말뭉치 스페인어 A k=2 | 39/45 | **37/45** |
| 어려운 꼴 스페인어 A | 4/6 | **2/6** |
| 그 밖 es(A k=2 · B · 8n-c) | 9 | **8**(`short-es` 22자가 되풀이로 es 이던 것) |
| 그 밖 es A k=3 | 4 | 3 |
| 대가 목록 | 45 중 4(`r-shortfem`·`es-anemia`·`z-gripe`·`z-ciudad`) | 45 중 **8** — + `hijos`·`vacuna`(8n-d 때도 놓쳤으나 줄에 안 적힘) + `z-casa`·`z-migrana` |
| 말뭉치 `ES_SHORT` es | 12 중 10 | **12 중 8** |
| 본 말뭉치(표 1) 스페인어 · B 43/45 · 프랑스어 → es · k=1 43/45·그 밖 14 · k=3 32/45 | | 그대로 |

**결정 A·`ES_MIN_WORDS` 2 는 바뀌지 않는다**(B 는 여전히 프랑스어 → es 3, k=1 은 그 밖 14).
spec 은 8n-d 줄을 고치지 않고 새 8n-e 줄 ②에 "39/45 → 37/45 …" 로 적었다.

## 3. 테스트 (1509 → 1513)

말뭉치 끝에 덧붙임(앞 26,309바이트 = 백업, `b8ne/corpus-check.mjs`):
- `PROPER_FR` 9 — r8nd `f-los-angeles`·`f-el-nino`·`f-vegas-delrio`·`f-por-favor`·`f-hospital-del-mar`·`f-itineraire`·`f-lakers`·`f-biblio` + `b-roadtrip`
- `PROPER_EN` 11 — r8nd `e-*` 8 + `ref-hisp2`·`ref-hisp3`·`ref-hisp6`(r8nd `mix()` 결과를 펼쳐 적음)
- 위 20 은 Review 글과 **글자 같음 20/20**.
- `ES_CAPS` 5 — 이 Build 가 지음. 앞 셋(`e-resultados`·`e-guardia`·`e-agenda`)은 소문자 es 기능어 ≤ 1 이라 문장 첫머리 대문자 꼴을 세야 es, 뒤 둘(`e-prima`·`e-nino`)은 `Los Ángeles`·`El Niño`·`El Paso` 가 섞인 스페인어.

| 테스트 | 내용 |
|---|---|
| N11·N15·N16 | `atLeast200` → `padTo200` · `ES_LIGHT` + `z-casa`·`z-migrana` · N16 ★ 8 es, light 4 · `padTo200` 이 200자 이상 글에 손대지 않고 짧은 글의 기능어 셈을 바꾸지 않음 |
| **N17 ★★ 새** | `PROPER_FR` 9·`PROPER_EN` 11 각각 fr/en · 8n 이전 값 · 이으면 fr·1/en·1 · 8n-d 에서 es 이던 일곱은 대문자 es 기능어 ≥ 3(전제)인데 esWords < 2 |
| **N17 ★★ 새** | `ES_CAPS` 5 각각 es·≥0.5 · 앞 셋 소문자 es 기능어 < 2(전제) · 이으면 es·1 |
| **N17 ★ 새** | `functionWordRates` 경계 — 다음 낱말 소문자(`Los pacientes`·`Los ángeles`·`Los «pacientes»`·`Con 20 mg`) 셈 · 대문자(`Los Angeles`·`Los Ángeles`·`Del Rio C`·`Con A`·`El Niño`·`Los 3 Reyes`)·한글 안 셈 · 글 끝(`Los`·`paciente Del`·`… Lo`) 안 셈 · 문장 첫머리(`El paciente`·`… ¿Lo sabes?`) 셈 · `LOS DEL`·`LOS`·`los Angeles`·`con` 그대로 셈 · en·fr·frForEs·words 는 글자꼴 무관 |
| **N17 ★ 새** | `guessLang` 경계 — 대문자 + 대문자 낱말·글 끝은 en·0 = 8n 이전 · `Los pacientes Del grupo`·`… Los pacientes`·`LOS DEL` 은 es·1 |

## 4. 검증

| 항목 | 결과 |
|---|---|
| golden(`b8ne/golden-check.mjs` = r8nd 것, HEAD 모듈로 통째 재생성) | `regenDeepEqual` true · 95 항목 HEAD↔golden 0 · 지금↔golden 0 · sha1 `1ab93adb…0129` 시작·끝 같음 |
| 무작위(`b8ne/fuzz.mjs` = r8nd 생성기, 새 씨앗 `0x8e1d2826`(r8nd 기본 `0x2545f491` 과 다름), 비교 대상 8n-d) | **서로 다른 글 50,000/50,000** · HEAD 와 다른 8,878건 전부 es(score 0.5–1) · **es 아닌데 HEAD 와 다른 것 0** · 8n-d 대비 다른 11,913: es→fr 7,795 · es→en 2,252 · es→es(score) 1,866 · **새 es 0** · 분할 en·fr·ko·인자 없음 200,000 HEAD 와 0 |
| 의학책 3권(`b8ne/books.mjs` = r8nd 것, 비교 대상 8n-d, 11.4초, 숫자만) | CMDT 2026 174쪽 · CMDT 2021 149쪽 · Harrison 176쪽 = 499쪽 — HEAD·8n-d 와 다른 쪽 0 · es 0 · 분할 0/499 · 앞 30쪽 표본 세 권 en·1(HEAD 같음) · 짧은 창 15,315 es 0, es 아닌 쪽 HEAD 와 다른 것 0 |
| 전체 `node --test apps/medreader/tests/*.test.mjs` 1회 · 2회 | 1513 / 1513 / 0 · 1513 / 1513 / 0 |
| stamp | `lang.js?v=8dfb27b32d → d65a608780` 한 줄 · `--check` "그대로다 (모듈 66개 · CSS 4개)" 종료 0 |
| `git diff --check` | 종료 0 · 추적 안 된 테스트·말뭉치 CR 0·끝 공백 0 |

### 변이 (`b8ne/mutate.mjs` — `b8ne/bak/lang.fixed.js` 를 읽어 한 곳 바꿔 쓰기 → 전체 `node --test` → `finally` 원본 쓰기)

IM2·IM6·IM7b(import map 해시)는 lang.js 가 바뀌면 늘 함께 빨강 — 아래에서 뺐다.

| # | 변이 | 빨강(IM 밖) | 판정 |
|---|---|---|---|
| M1 | P3 끄기(대문자 es 기능어도 늘 셈 = 8n-d) | 3 — N17 ★★ 고유명사 · N17 경계 ×2 | 잡힘 |
| M2 | "다음 낱말 소문자" → "대문자" 로 뒤집기 | 5 — N16 ★ · N17 ★★ ×2 · N17 경계 ×2 | 잡힘 |
| M3 | 글 끝이면 셈 | 2 — N17 경계 ×2 | 잡힘 |
| M4 | 모두 대문자에도 규칙 적용 | 2 — N17 경계 ×2 | 잡힘 |
| M5 | P1(대문자 es 기능어 아예 안 셈) | 4 — N16 ★ · N17 ★★ `ES_CAPS` · N17 경계 ×2 | 잡힘 |

복원: `restored: true` · `cmp lang.js b8ne/bak/lang.fixed.js` 같음. 끝 sha1 `b8ne/end-sha1.txt`(segment.js·golden·review.md 는 시작과 같음).

## 5. 바꾼 파일

| 파일 | 바꾼 것 |
|---|---|
| `js/text/lang.js` | `countEsWords`·`RE_LOWER_START`·`RE_UPPER_START` · `functionWordRates` 의 es 셈 · 주석 `[8n-e]` |
| `tests/fixtures/srclang-8n-corpus.mjs` | 끝에 덧붙임만: `padTo200` · `PROPER_FR` 9 · `PROPER_EN` 11 · `ES_CAPS` 5 |
| `tests/srclang-es-8n.test.mjs` | 위 3절 |
| `index.html` | stamp 한 줄 |
| `spec.md` | 19-1-3 §5 `[정정 2026-11-16 — 8n-e]` 한 줄(Edit, 8n-d 줄 바로 뒤) |

`segment.js`·golden·review.md 무수정.

## 6. 남은 한계

- 두 언어가 진짜 섞인 짧은 글(`b-cours-espagnol` — 프랑스어 문장 속 소문자 스페인어 낱말 목록)은 es·0.5. 맞는 답이 모호하고, 소문자라 P3 와 무관.
- 대문자 es 기능어 + 대문자 고유명사로 시작하는 스페인어(`Los Ángeles es…`)의 그 낱말은 안 셈 — 실측 스페인어 64 + `ES_CAPS` 에서 잃음 0(다른 기능어가 넉넉함).
- 대문자 es 기능어 + 숫자 + 소문자(`Con 20 mg`)는 셈 — "다음 낱말" 이 숫자를 건너뛰므로. Review 모의는 숫자에서 멈췄지만 지금 묶음에서 결과 차이 0.
- 미지원 라틴(포르투갈어·베트남어·이탈리아어·카탈루냐어)이 es — 8n-b 한계 그대로(그 밖 44 중 5).
- 8n-d 의 대가(es 기능어 하나뿐인 짧은 스페인어 → fr = HEAD)는 바른 숫자로 45 중 8.

## 7. 실행 · 정리

막힌 명령 없음. headless 0 · 서버 0 · 프로세스 조회 0 · 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0. 의학책은 r8nd 스크립트의 파일 경로만 열고 숫자만(Downloads 목록 안 봄). `git status` 는 시작 때와 같다(+ 이 보고서). 덧: "한 호출에 한 가지 일" 을 몇 번 어겼다 — 시작 때 백업 폴더 만들기·복사·sha1 기록을 한 줄로, `sed` 치환 뒤 `grep` 확인을 한 줄로, Review 스크립트 세 개 복사를 한 줄로 묶었다(모두 스크래치·읽기, 앱 파일 쓰기는 `sed -i` 로 테스트 파일의 `atLeast200(` → `padTo200(` 한 번).

스크래치 `b8ne/`: `bak/`(시작 판 7파일 + `lang.fixed.js`) · `start-sha1.txt`·`end-sha1.txt` · `remeasure.mjs`(+`-all.txt`) · `missed.mjs` · `eval.mjs`(+`-out.txt`) · `fuzz-fr.mjs`(+`-out.txt`) · `corpus-check.mjs`(+`-out.txt`) · `golden-check.mjs`(+`golden-out.json`) · `fuzz.mjs`(+`-out.json`) · `books.mjs`(+`-out.json`) · `mutate.mjs`(+`-out.json`) · `t8n-1.txt`·`t8n-2.txt`·`full0.txt`·`full1.txt`·`full2.txt`.
