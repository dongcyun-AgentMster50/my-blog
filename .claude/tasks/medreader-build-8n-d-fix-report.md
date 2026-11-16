# Build 보고 — 8n-d: 프랑스어 `es` 겹침을 뿌리에서

> Build 서브에이전트. 지침 `.claude/tasks/medreader-build-8n-d-fix.md`, 근거 review.md "8n-c 재검증"(8ncR-1–7). 커밋 0 · headless 0 · 서버 0. 스크래치 `b8nd/`(앞 Review·Build 폴더는 읽기만).

## 고른 안 — (A) 뿌리

es 기능어 묶음에서 `es` 를 뺐다(`el·los·las·del·por·para·con·una·lo` 9개). 8n-c 의 `RE_FR_TU_ES` 와 `tuEs` 셈은 지웠다. `ES_MIN_WORDS` 는 2 그대로. `FR_ES_OVERLAP`(`la`) 는 그대로.

### 측정 (`b8nd/measure.mjs`·`pooled.mjs` — 판정 규칙을 그대로 옮긴 모의 함수. 모의 = 8n-c 앱 258건 다른 것 0, 모의 A k=2 = 고친 앱 284건 다른 것 0)

말뭉치: 앞 Review·Build 의 모든 스페인어·프랑스어 문단(r8n `es-variants` · r8nb `paras`·`fr-tues-texts` · b8nb `paras` · b8nc `tues-paras` · r8nc `paras`·`es-other`·`survivors`) + 말뭉치 `ES`·`ES_NATURAL`·`ES_TU`·`FR`·`FR_NATURAL`·`FR_TUES` + 8n-d 새 문단. 글자 같은 것은 하나로. 그 밖(영어 짧은 목록·표, 미지원 라틴, `GUESS_CASES`) 44 는 es 가 되면 안 되는 쪽.

**표 1 — 본 말뭉치(스페인어 39 · 프랑스어 46, 새 문단 6+6 포함)**

| 안 | 스페인어 es | 프랑스어 오판 | 프랑스어 HEAD 와 값 다름 | 그 밖 es(/44) |
|---|---|---|---|---|
| 지금(8n-c) | 37 | 4(r8nc `x-*` 넷 → es) | 4 | 9 |
| **A k=2** | 35(`r-shortfem`·`es-anemia` → fr = HEAD) | **0** | 0 | 9 |
| A k=1 | 37 | 0 | 0 | 14 |
| A k=3 | 31 | 0 | 0 | 4 |
| B | 37 | **0** | 0 | 9 |

본 말뭉치만 보면 B 가 이긴다(프랑스어 둘 다 0 → 스페인어 37 > 35). 그러나 **새 프랑스어 6·스페인어 6 은 어느 안도 가르지 못했다**(세 판 모두 같은 결과 — 프랑스어 6은 Review 꼴 밖의 `n'y es`·`qu'es-tu`·`qui es`·`t'en es`·`l'es` 를 넣었지만 `le`·`les`·`et` 가 넉넉했다). 그래서 각 안의 약한 쪽을 같은 방식으로 지은 "어려운 꼴" 6+6 을 더 쟀다(`b8nd/supp.mjs` — 두 묶음을 한 번에 짓고 잰 것, 고친 것 없음): 프랑스어는 fr 기능어가 적은 짧은 반말 + B 꼴 밖(`tu n'y es`·`toi qui es`·`t'en es`·`tu l'es`·`n'en es`), 스페인어는 `la` 가 많고 `es` 밖 es 기능어가 하나 안팎인 짧은 글.

**표 2 — 합친 말뭉치(스페인어 45 · 프랑스어 52) — 결정 근거**

| 안 | 스페인어 es | 놓친 스페인어 중 HEAD 와 다른 것 | 프랑스어 → es | 프랑스어 fr 아님 | 프랑스어 HEAD 와 값 다름 | 그 밖 es |
|---|---|---|---|---|---|---|
| 지금(8n-c) | 43 | 0 | 8 | 8 | 8 | 9 |
| **A k=2** | **39** | 0 | **0** | 2(`s-quies`·`s-nenes` en·0 = HEAD 값) | **0** | 9 |
| A k=1 | 43 | 0 | 0 | 2 | 0 | 14 |
| A k=3 | 32 | 0 | 0 | 2 | 0 | 4 |
| B | 43 | 0 | **3**(`s-quies`·`s-tenes`·`s-nenes`) | 3 | 3 | 9 |

어려운 꼴만: 프랑스어 6 — A 는 es 0(넷 fr · 둘 en·0 = HEAD), B 는 es 3(이으면 es·0.5) · 스페인어 6 — A 4(`z-gripe`·`z-ciudad` → fr = HEAD), B 6.

**결정**: 기준 "프랑스어 오판 0 이 먼저" — 합친 말뭉치에서 B 는 프랑스어 → es 가 3(모두 HEAD 와 다른 새 오판), A 는 0(fr 아닌 둘은 HEAD 자체가 en·0 인 글, es 갈래와 무관). 그래서 **A**. A 의 놓친 스페인어는 전부 HEAD 값(fr)으로 떨어진 것이고 B 의 프랑스어 오판은 새로 만든 es 다. ⚠ 판단 표시: 지침의 말뭉치(표 1)만으로는 B 가 이긴다 — 내가 새로 지은 첫 6+6 이 두 안을 가르지 못해 어려운 꼴 6+6 을 더해 합쳐 쟀고, 그 합에서 A 가 이겼다. B 로 바꾸려면 8n-c 판(`b8nd/bak/lang.js`)에 정규식 한 줄(아래 X4)만 바꾸면 된다.

**`ES_MIN_WORDS`**: 1 이면 스페인어 +4(43/45) 지만 그 밖 es 9 → 14(영어 `en-cities1`·`en-heading`·약어 표·포르투갈어·카탈루냐어 — 8n Review 낮음-2·N12 를 되돌림), 3 이면 스페인어 32/45. 2 그대로.

## 바꾼 파일

| 파일 | 바꾼 것 |
|---|---|
| `js/text/lang.js` | es 묶음에서 `es` 뺌 · `RE_FR_TU_ES`·`tuEs` 셈 지움 · 머리말·`ES_MIN_WORDS`·묶음 주석 `[8n-d]` |
| `tests/fixtures/srclang-8n-corpus.mjs` | 끝에 덧붙임만(8,200바이트, 기존 바이트 백업과 같음): `FR_ES_FORMS` 17 = r8nc `es-other` 5(글자 그대로) + 8n-d 프랑스어 12 · `ES_SHORT` 12 = 8n-d 스페인어 12 (원본과 글자 같음 — `b8nd/corpus-same.mjs`) |
| `tests/srclang-es-8n.test.mjs` | 아래 표 |
| `index.html` | stamp — `lang.js?v=897d8d942e → 8dfb27b32d` 한 줄 |
| `spec.md` | 19-1-3 §5 `[정정 2026-11-16 — 8n-d]` 한 줄(Edit, 8n-c 줄 바로 뒤) |

`segment.js` 무수정(sha1 시작·끝 같음). golden 무수정.

### 테스트 바꾼 것 (1507 → 1509)

| 테스트 | 바꾼 것 · 이유 |
|---|---|
| N1 겹치지 않는 묶음 | 9낱말 → es 1000 · 10낱말(`es` 포함) → esWords 9, es 900 · `es ES Es` → 0 |
| N11 ★★ ES_NATURAL | `r-shortfem`(`es` 밖 es 기능어 `los` 하나)은 8n 이전 값과 같아야 함(전제: esWords = `ES_MIN_WORDS − 1`) · 나머지 9 es · "대가는 하나" 고정 |
| N13 score | 기존 세 값 그대로(입력에 `es` 없음). **다시 고정**: `the con el lo es es` → 0.667(8n-c 판 0.8), `the con el es es es` → 0.5(8n-c 판 0.8) — 기존 세 값만으로는 `es` 를 되돌려도 안 잡혀서, 낱말 `es` 가 셈 밖임을 값으로 묶었다 |
| N15 ★★ FR_TUES 11 | **기대 그대로**(fr · 8n 이전 값 · esWords 0 · 이어도 fr) — 머리말만 `[8n-d]` |
| N15 ★★ 스페인어 묶음 | `r-shortfem` 은 8n 이전 값, 나머지 es |
| N15 ★ functionWordRates | `tu es`·`t’es`… 를 frForEs 로 옮기던 기대 → esWords 0·frForEs 0 · 사이 글자·도치·생략·`espíritu es` 8꼴 모두 esWords 0 · `tu espalda es con el` → 2(`es` 밖 낱말은 셈) · 짧은 반말 경계(fr = 8n 이전) 그대로 |
| **N16 ★★ 새** | `FR_ES_FORMS` 17 각각 es 아님·8n 이전 값·esWords 0 · r8nc 다섯 각각 fr, 이으면 fr·1 · 17 이으면 fr |
| **N16 ★ 새** | `ES_SHORT` 12 — 10 es(score ≥ 0.5), `z-gripe`·`z-ciudad` 8n 이전 값(대가 고정), 이으면 es |

(B 를 고르지 않았으므로 Review 정보-2 의 정규식 경계 테스트는 해당 없음 — 정규식이 없어졌다. 대신 N15 ★ 가 `espíritu es`·`tu espalda` 꼴이 es 셈에 영향 없음을 묶는다.)

## 검증

| 항목 | 결과 |
|---|---|
| 전체 `node --test apps/medreader/tests/*.test.mjs` 1회 | **1509 / 1509**, fail 0 |
| 같은 것 2회 | **1509 / 1509**, fail 0 |
| `stamp-importmap --check` | "그대로다 (모듈 66개 · CSS 4개)" 종료 0 |
| `git diff --check` | 종료 0 · 추적 안 된 테스트·말뭉치 끝 공백 0·CR 0 |
| golden (`b8nd/golden-check.mjs` — r8nc/head = `git show HEAD:` 와 `cmp` 같음) | sha1 `1ab93adb…0129` 시작·끝 같음 · HEAD 로 통째 재생성 = golden(`regenDeepEqual` true) · 95 항목 HEAD↔golden 0 · 지금↔golden 0 |
| 무작위 서로 다른 글 50,000 (`b8nd/fuzz.mjs` — xorshift32, Review 와 다른 생성기, `qui es`·`n'y es`·`t'en es`·`l'es`·`es‐tu` 등 섞음) | HEAD 와 다른 7,576건 **전부 es** · **es 아닌데 HEAD 와 다른 것 0** · es score 0.5–1 · 8n-c 대비 다른 4,877: es→en 988 · es→fr 952 · es→es(score) 1,979 · fr→es 790 · en→es 168 |
| 분할 en·fr·ko·인자 없음 50,000 × 4 | **200,000 — HEAD 와 다른 것 0** |
| 의학책 3권(`b8nd/books.mjs`, 11.3초, 숫자만) | CMDT 2026 174쪽 · CMDT 2021 149쪽 · Harrison 176쪽 = 499쪽 — `guessLang` HEAD·8n-c 와 다른 쪽 0, es 0 · 분할 HEAD 와 다른 쪽 0/499 · 앞 30쪽 세 권 en·1(HEAD 같음) · 짧은 창 15,315(200·400·800자) es 0, es 아닌 쪽 HEAD 와 다른 것 0 |

### 변이 (`b8nd/mutate.mjs` — `bak/lang.8nd.js` 를 읽어 한 곳 바꿔 쓰기 → 전체 테스트 → `finally` 원본 쓰기)

IM 3개(import map 해시)는 매번 함께 빨강 — 아래 수에서 뺐다.

| # | 변이 | 빨강(IM 밖) | 판정 |
|---|---|---|---|
| X1 | `es` 를 es 묶음에 되돌림 | 8 — N1 · N11 ★★ · N13 · N15 ×3(FR_TUES 포함) · N16 ×2 | 잡힘 |
| X2 | `ES_MIN_WORDS` 2 → 1 | 5 — N11 ★★ · N12 ×2 · N15 ★★ · N16 ★ | 잡힘 |
| X3 | 8n-c 판 통째(`tu es` 규칙) | 7 — N1 · N11 · N13 · N15 ×2 · N16 ×2 | 잡힘 |
| X4 | 안 B(8n-c + `es-tu`·`n'es`·`tu en/y es`) | 7 — N16 ★★(`s-quies` 등) 포함 | 잡힘 |
| X5 | es 갈래 fr 에서 `la` 빼기 없앰 | 5 — N11 ×2 · N13 · N15 ★★ · N16 ★ | 잡힘 |
| X6 | es 묶음에서 `lo` 빼기 | 4 — N1 · N5 · N13 · N16 ★ | 잡힘 |

복원: `restored: true` · `cmp lang.js ↔ b8nd/bak/lang.8nd.js` 같음.

## 남은 한계

1. **`es` 밖의 es 기능어가 하나뿐인 짧은 스페인어**(`la` 많은 여성 명사 글)는 es 가 아니라 8n 이전 값(fr) — 지은 것 45 중 4(`r-shortfem`·`es-anemia`·`z-gripe`·`z-ciudad`). 새 오판이 아니라 8n-b 이전과 같은 쪽 틀림이고, 앱이 쓰는 긴 표본(최대 8,000자)에서는 묻힌다. `ES_MIN_WORDS` 를 1 로 내리면 풀리지만 영어 목록·표 꼴이 es 로 간다(그 밖 9 → 14).
2. **프랑스어+스페인어 기능어가 섞인 글**: 8n-c 는 `tu es` 를 fr 쪽에 더했으므로, 스페인어 기능어(`con`·`el`)가 둘 이상 섞이고 `la` 밖 fr 기능어가 적은 글은 지금이 8n-c 보다 es 로 가기 쉽다 — 무작위 낱말 섞음 5만 중 8n-c fr/en → 지금 es 958(실제 지은 문단에서는 0). HEAD 와 비교한 "es 아닌 결과 불변" 은 그대로.
3. fr 기능어가 거의 없는 짧은 반말 프랑스어(`s-quies`·`s-nenes`)는 HEAD 처럼 en·0 — es 와 무관한 기존 한계.
4. 8n-c 목록의 한계(`p. ej. ¿대문자` 앞 끊김 · 영어 참고문헌·약물 표 꼴 es·1 · 대화 줄표 `—¿`)는 그대로.

## 막힌 명령 · 정리

막힌 명령 없음. 프로세스 조회 0 · 서버 0 · headless 0 · 키 0 · npm·다운로드 0 · 의학책은 Review 스크립트의 파일 경로만 열고 숫자만(Downloads 목록 안 봄) · 원서 문장 인용 0 · 커밋 0 · `git checkout/restore/stash` 0. `git status` 는 시작 때와 같다(+ 이 보고서).

스크래치 `b8nd/`: `bak/`(시작 원본 7파일 + `lang.8nd.js`) · `start-sha1.txt`·`end-sha1.txt` · `paras.mjs`(새 6+6) · `corpus.mjs`(측정 말뭉치 모음) · `measure.mjs`(+`-out.txt`) · `supp.mjs`(어려운 꼴 6+6, +`supp-out.txt`) · `pooled.mjs`(+`-out.txt`) · `corpus-same.mjs` · `golden-check.mjs`(+`golden-out.json`) · `fuzz.mjs`(+`-out.json`) · `books.mjs`(+`-out.json`) · `mutate.mjs`(+`-out.json`) · `full1.txt`·`full2.txt`.
