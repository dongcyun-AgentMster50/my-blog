# Build 보고 — 8h-1 낭독 정리 (인용·글머리·각주 기호)

> 지침: `.claude/tasks/medreader-build-8h-1.md` · 설계: `apps/medreader/spec.md` 6-6(6-6-2 A · 6-6-3 B · 6-6-4 C · 6-6-8 G).
> **커밋하지 않았다.** 8h-F 의 `dev/tashkeel-*` 는 건드리지 않았다. `extract.js`·`layout.js`·`blocks.js`·`pdf/*` diff 0, `algoVersion`·`DB_VERSION`·프롬프트 버전 불변, `KEEP_HYPHEN_SUFFIXES` 불변(config 는 추가만).

## 1. 바뀐 파일과 이유

| 파일 | 무엇을 | 왜 |
|---|---|---|
| `js/text/cite.js` **(새)** | `citationKind`/`isCitation`(A1) · `isIdOnly` · `referenceRuns`(A2 묶음) · `markReferences`(A1 ∪ A2 → boolean[]) · `isReferenceHead`(측정용) | 순수 모듈 — `config.js` 만 import, `document`·`window` 0(주석 포함), 문장을 나누지 않는다 |
| `js/text/segment.js` | `splitSentences` 에 B1(중간 글머리 앞) · B2(식별자 괄호 끝 뒤 + 다음 글자가 그 언어의 문장 시작 꼴·`[`·글머리) | 분할 함수는 여전히 하나(R6). 공백 하나로 되붙는 계약 유지 |
| `js/tts/text.js` | `speechMarks`(C) — `normalizeSpeech` 첫 단계·`trSpeechText` 끝 단계. `buildUnits` 가 문단마다 `markReferences` → 인용 문장의 모든 조각에 `cite:true`·`seg:null`. `indexAtOrAfterLine` | `src`·화면·번역 입력 불변(캐시 키 불변). 인용이 아닌 단위에는 `cite` **속성 자체가 없다** → 8h 이전 큐와 JSON 동일 |
| `js/tts/speaker.js` | `buildUnits` 네 곳(play·advancePage·setUnit·reload)을 `queueOf` 한 곳으로 — 설정이 꺼져 있으면 `!u.cite` 만. 인용 줄 탭 → 화면 줄 순서로 그 뒤 첫 발화(없으면 다음 쪽). 인용뿐인 쪽에서 재생 → 끝내지 않고 다음 쪽. `deps.readCitations`(함수)·`setReadCitations`·`getReadCitations` | 건너뛰기 상태를 새로 만들지 않는다. 반복·step·진행 표시·워치독·쪽 넘김 로직 수정 없음 |
| `js/config.js` | `SPEECH_MARKS`(∗ * † ‡ §) · `CITE`(MAX_UNIT_CHARS 200 · REF_MAX_FOLLOW 4 · REF_MAX_CHARS 400 · BULLETS 8개) | 숫자 출처 spec 6-6-1 |
| `js/settings.js` | `'tts.readCitations': false` | 9-3. DB_VERSION 불변(기본값으로 읽힘) |
| `js/ui/controls.js` | speaker 에 `readCitations: () => settings.get('tts.readCitations') === true`, `view.lineOrder: flowLineIds` | 아래 "의도와 다르게 한 곳" ② |
| `js/ui/settings.js` | 낭독 묶음(번역 따라가기 카드 `#settingsReadalong`) 끝에 체크박스 한 줄 + 안내 한 줄을 JS 로 만든다 | index.html 은 import map 만 고치므로 그릇을 JS 가 만든다. 카드가 없으면(반쪽 캐시) 만들지 않는다. 속도 팝오버에는 넣지 않음 |
| `js/i18n/{ar,en,fr,ko}.js` | `settings.tts.readCitations` · `.help` | 4개 언어 키 일치(i18n 테스트 통과) |
| `index.html` | `node apps/medreader/dev/stamp-importmap.mjs` 결과만(모듈 52개 — 새 `text/cite.js` 포함) | `--check` 0 |
| `tests/cite-8h.test.mjs` **(새)** | 27개: T-A1×3 · T-A2×4 · T-B×3 · T-B4 · T-C×3 · T-U×3 · T-S×6 · T-R×2 · 설정·i18n · grep | 픽스처는 전부 지어낸 문장(저자·PMID 도 지어냄) |
| `dev/measure-cite-8h.mjs` **(새)** | 앱 코드 그대로 세 권 측정 · `--page N` 단위 목록 · `--all` 오탐 검토 표본(40자 이하) | 기존 dev 파일 수정 없음 |

`js/ui/reader.js` 는 **수정하지 않았다** — 화면 줄 순서는 이미 `flowLineIds()` 로 노출돼 있어 controls 가 그것을 `view.lineOrder` 로 넘긴다.

## 2. 판별 규칙 요약

- **A1** `citationKind(src)`: 200자 이하, 식별자(`[PMID|PMCID|DOI …]`·`PMID n`·`PMCID: PMC…`·`doi:10.…`)를 `;` 로 바꾸고 `;` 로 나눈 조각마다 — 구두점만 / `AUTHORS [,] et al[.] [JOURNAL] [PUB]` / (식별자가 있었을 때만) `AUTHORS. JOURNAL [PUB]`. **하나라도 아니면 아님.** 추가로 조각에 **소문자 낱말(2자+, 숫자에 붙지 않은 것)** 이 있으면 아님(spec "PUB — 소문자 낱말 없음"; Plan 스크립트의 PUB 는 `A-Za-z` 40자를 허용해 "2019 showed benefit…" 도 받았다).
- **A2** `referenceRuns`: 머리 = A1 아님 && `^(\d{1,3}\. )?AUTHORS(,? et al[.;]|\.)\s` (**쉼표 머리 불가**). 머리 뒤 4문장·머리 포함 400자 안에서 출판 정보만(`2022;40:381.`)·식별자만 문장으로 **닫혀야** 묶음. 머리가 출판 정보로 끝나면 머리 하나. 사이에 A1 인용이 끼면 묶음 아님. 문단 안에서만.
- **B1** `공백 + 글리프 + 공백`이 문장 중간이면 글리프 앞에서 끊음(글리프는 뒤 문장 머리). **B2** 식별자 괄호 `]` (+ `. ; ,` 하나) + 공백 + 다음 글자가 `SENTENCE_START[lang]`·`[`·글머리면 끊음. 소문자 앞은 안 끊음. en dash 줄머리 규칙 없음.
- **C** `speechMarks`: 앞 글자 ∈ 글자·숫자·`)` `]` 이고 뒤 글자 ∈ 글자·숫자·`(` `[` (또는 "숫자 * 숫자") → `∗`→`*` 로만, 나머지는 지우고 공백·구두점 앞 공백 정리. 기호가 없으면 입력을 그대로 돌려준다.

## 3. 테스트

- 전체 `node --test "apps/medreader/tests/*.test.mjs"`: **978 통과 / 0 실패, 3회 연속**(기준 951 + 새 27). 디렉터리 인자는 Node 24+Windows 에서 실패하므로 glob 으로 돌렸다.
- `stamp-importmap.mjs` 실행 후 `--check` 종료 코드 0, `tests/importmap.test.mjs` 통과.
- grep: `splitSentences(` 는 `text/segment.js`(정의)·`tts/text.js`(유일한 호출) 두 파일뿐 · `cite.js` 에 `document`/`window` 0 · speaker 의 `buildUnits(` 호출 1곳(`queueOf`).
- **7c E1 은 빨개지지 않았다** — E1 코퍼스에 글머리·식별자 괄호가 없어서다(그 문장들은 지금도 7c 사본과 같다). 그래서 E1 은 그대로 두고, **T-B4** 를 `cite-8h.test.mjs` 에 따로 두었다: 7c 사본(`legacySplit`) 대비 ① 되붙인 글이 같고 ② 옛 경계가 모두 남고 ③ **새 경계는 전부 B1(뒤 조각이 글머리+공백) 또는 B2(앞 조각이 식별자 괄호[+. ; ,]로 끝남)** 이며 ④ 코퍼스 중 5개 이상이 실제로 바뀐다. 기대값을 덮어쓴 곳은 없다.
- T-U 불변 대조: 인용·글머리·기호 없는 픽스처의 `JSON.stringify(buildUnits(…))` sha256 을 **8h 이전 HEAD(740a3cd) 의 text.js 로 직접 돌려 얻어** 고정(en·fr·ko × 문장·줄 6개). 지금 코드와 같다.

### 변이 m1~m8 (각각 바뀐 문자열을 grep 으로 1건 확인 → 전체 테스트 → 스크래치패드 백업으로 복원 → `cmp` 같음)

| # | 변이 | 빨개진 테스트(IM2·IM6·IM7b 는 해시가 바뀌어 매번 함께 빨강 — 생략) |
|---|---|---|
| m1 | A2 닫힘 조건 제거(`closed<0` 이면 머리만이라도 묶음) | T-A2 "닫힘이 거리·글자 밖이면 없음…"(여기에 "Stage III. Severe…" 닫히지 않은 머리 사례 포함) · T-A2 "다른 문단에서 닫힘 → 없음" |
| m2 | 머리에 쉼표 허용 | T-A2 ★★ "Stage III, severe …" + "[PMID]" |
| m3 | `cite` 인데 `seg` 를 줌 | T-U×2 · T-S readCitations · **T-R 요청 묶음·readStats** · **T-R RA-C1** |
| m4 | speaker 거르기 제거 | T-S 5개(기본 2발화 · 설정 읽기 · 인용 줄 탭 · 인용뿐인 쪽 · 구간 반복) |
| m5 | 피연산자 자리도 지움 | T-C 각주 기호(HLA-B) · T-C 번역문 · T-C src 불변 |
| m6 | B1 제거 | T-B 글머리 · T-B4 |
| m7 | `speechMarks` 를 `src` 에 적용 | T-C ★★ src 불변(캐시 키) |
| m8 | B2 다음 글자 판정 제거 | T-B 식별자 괄호 끝("weakness") |

m1 의 spec 예상("T-A2 Stage III 빨강")은 쉼표 머리 규칙 때문에 m1 만으로는 "Stage III," 가 머리가 되지 않아 그대로는 맞지 않는다 — 대신 쉼표 없는 "Stage III. Severe …"(닫히지 않음) 사례를 같은 T-A2 에 넣어 m1 이 그것으로 빨개진다. 작업 트리에 변이 잔존 0(8개 모두 백업과 바이트 같음).

## 4. 세 권 수치 (앱 코드 — `dev/measure-cite-8h.mjs`)

"Plan 칸"은 8h 이전 분할 사본으로 만든 문장에 **앱의** `citationKind`·`splitSentences`·`referenceRuns` 를 적용해 Plan 과 같은 정의로 센 값, "앱"은 실제 `buildUnits` 큐의 `Unit.cite`.

| CMDT 2026 (1–1967쪽) | Plan(흉내) | 앱 | 차이 |
|---|---|---|---|
| 8h 이전 문장 · 글자 | 90,664 · 8,842,614 | 90,664 · 8,842,614 | 0 |
| **A1** 단위 | **1,489** (et al. 137+33) | **1,480** (et al. 128+33) | −0.6% |
| **A2** 묶음 · 조각 · 글자 | **1,700** · 5,096 · 240,816 | **1,698** · 5,090 · 240,552 | −0.1% |
| A2 닫히지 않은 머리 | 1,225 | 1,235 | |
| **B** 바뀌는 단위 → 조각 · **그중 인용** | 1,882 → 3,770 · **1,841** | 1,849 → 3,704 · **1,813** | **−1.5%** |
| B 캐시 빗나감 | 1,848 · 222,601자 | 1,815 · 219,938자(2.49%) | |
| C 기호 · 피연산자(남김) · 지움 | 90 · 15 · 75 | 88 · 15 · 73 | |
| 낭독·번역에서 빠지는 것(앱 큐 cite) | 약 8,400 · 약 298,000자(3.4%) | **8,349 · 295,411자(3.34%)** · 927쪽 | −0.6% / −0.9% |
| 30쪽 | | 표 머리·"∗See chapter…" 단위의 발화에 `∗` 0 · 저자-학술지/`[PMID]` 10단위 전부 `cite`(seg null) · 전권 발화에 `∗` 남은 단위 0 | |

**1% 넘는 차이(B) 원인 — 확인함**: Plan 스크립트의 B2 정규식 `ID_CLOSE` 가 `iu` 플래그라 `\p{Lu}` 가 **소문자에도 맞는다**(Node 24: `/\p{Lu}/iu.test('a') === true`). 그래서 Plan 은 "[PMID: n] making for primary…" 처럼 **소문자 앞에서도 끊었다** — spec 은 "소문자면 끊지 않는다"(T-B "weakness"). Plan 의 BOUNDARY 를 그대로 옮긴 스크래치 스크립트로 같은 문장을 다시 세면 인용 조각 **1,841(Plan 과 정확히 같음)**, 앱은 1,813 — 차이 28조각·35단위가 전부 이 소문자 분할이다. A1 의 −9(et al.)는 PUB 소문자 낱말 규칙, C 의 −2 는 기호 하나뿐인 문장("∗")이 발화가 비어 단위가 생기지 않게 된 것이다(소리 없음 — 의도대로).

| CMDT 2021 (5,051쪽) | spec 6-6-1(오케스트레이터) | 앱 |
|---|---|---|
| A 인용 단위 | 1,261 | 1,259 (id 1,232 · etal 14 · etal+id 13) |
| A2 묶음 · 글자 | 2,863 · 4.56% | 2,864 · 431,535자(4.56%) · 닫히지 않은 머리 853 |
| B 조각 중 인용 | 2,628 | 2,604 (같은 소문자 원인으로 추정 — 2021 은 원인 분해를 돌리지 않았다) |
| C | operand 15 · word-end 4 · lead 25 | 기호 41 · 남김 15 · 지움 26 |
| 앱 큐 cite | | **12,604 단위 · 493,538자(5.21%)** · 1,340쪽 |

| Harrison 20판 (729쪽) | spec | 앱 |
|---|---|---|
| A · A2 | 0 · 0 | **0 · 0** (cite 0 — 헛걸림 없음) |
| B | | 바뀌는 단위 10(전부 글머리) → 조각 28, 인용 0 |
| C | operand 1 · word-end 7 · lead 5 · other 24 (=37) | 기호 37 · 남김 1 · 지움 36 |

재현: `MEDREADER_PDFJS=<pdfjs> node apps/medreader/dev/measure-cite-8h.mjs <pdf> [시작] [끝] [--page N] [--all]` (CMDT 2026 전권 약 1~2분).

## 5. 의도와 다르게 한 곳

1. **7c E1 을 고치지 않았다** — 빨개지지 않았다(코퍼스에 B 대상이 없음). T-B4 를 새 파일에 따로 두었다(위 3절).
2. **설정 전달**: 처음엔 controls 에서 `speaker.setReadCitations()` 를 재생·쪽 그리기 때 부르게 했는데, 기존 배선 테스트(W2·WR1)가 `onPageRender(() => { syncSourceVoice(); speaker.reload(); …` 와 재생 핸들러의 글자 꼴을 고정하고 있어 빨개졌다. 테스트를 고치는 대신 **speaker 가 큐를 만들 때마다 주입 함수 `deps.readCitations()` 를 읽게** 했다(설정 화면에서 바꾸고 돌아오면 다음 큐부터 반영 — 재생 중 큐는 그대로). `setReadCitations` 는 주입 함수가 없을 때의 값으로 남겼다.
3. **인용뿐인 쪽에서 재생을 누르면** 원래 코드는 `finish()`(아무 소리 없이 끝)였다. spec 은 쪽 넘김 중의 빈 쪽만 말했지만, 재생 시작에서도 끝내지 않고 다음 쪽으로 가게 했다(인용을 **걸러서** 빈 경우만 — 본래 빈 쪽은 그대로 `finish`). 첫 발화가 쪽 이동(비동기) 뒤에 나가므로 "탭 핸들러 안에서 동기 speak"(6-4 (5))는 이 경우에만 지켜지지 않는다 — 실기기 확인 필요.
4. **인용 줄 탭이 쪽의 마지막 발화 뒤**이면 다음 쪽으로 넘긴다(`indexAtOrAfterLine` 이 `units.length`).
5. 설정 줄은 `button.switch` 가 아니라 같은 카드의 다른 불리언 설정(`aiOnDevice`)과 같은 **체크박스 + 안내 한 줄**로 만들었다(정적 HTML 수정 금지라 JS 로 생성).
6. A1 은 spec 의사코드대로 **`;` 로 조각을 나눈다** — 그래서 "저자 et al. 학술지. 2023;82:101. [PMID]" 가 **한 단위**면 A1 이 아니다("82:101." 조각). 실제 큐에서는 분할이 "학술지. 2023" 의 연도 앞에서 이미 끊어 이 꼴이 거의 생기지 않는다(T-A1 양성 픽스처는 연도 없는 꼴로 썼다). Plan 스크립트와 같은 동작이다.

## 6. 남은 위험

- **오탐 검토는 아직 표본·전수 눈 검토를 하지 않았다**(Review 몫). `--all` 로 A1 et al. 전부·A2 무작위 200·et al. 없는 머리 전부를 40자 이하로 뽑을 수 있다. 머리 꼴 `성 + 대문자 이니셜 + "."`은 "Vitamin D. Supplementation …" 같은 본문 문장 머리와 같은 모양이다 — **닫힘(4문장·400자 안의 출판 정보만/식별자만 문장)이 유일한 방어**다. CMDT 2021 은 빠지는 양이 가장 많으니(5.21%) 그것으로도 볼 것.
- **큰 미탐 하나(넓히지 않음 — spec 6-6-2 "이번에 넓히지 않는다")**: CMDT 2026 에서 **출판 정보만인 문장 1,311개가 여전히 읽힌다**("2024;332:957." → 연도·권·쪽 숫자 낭독). 그중 1,131개는 바로 뒤가 걸러진 `[PMID]` 이고 앞은 "JAMA." 같은 학술지명 — 머리가 4문장·400자 밖이거나 쪽을 넘어 **A2 가 닫히지 않은 문헌**(닫히지 않은 머리 1,235)의 꼬리다. 제목·학술지·연도는 들리고 PMID 만 사라진다. 다음 단계 후보: "출판 정보만 문장 + 같은 문단 바로 뒤가 식별자만" → 둘 다 인용(닫힘 조건이 붙어 있어 오탐 위험 작음). 운영자 결정 필요.
- "[PMID: n] van Dyck CH et al. …" 처럼 **소문자 성(姓) 접두사**로 시작하는 다음 문헌은 B2 가 끊지 않아 PMID 와 함께 한 문장으로 읽힌다(spec 규칙대로 — 소문자면 끊지 않음).
- B 로 `src` 가 바뀌는 본문 조각은 이미 읽은 쪽에서 한 번 다시 번역된다(CMDT 2026 1,815단위 · 2.49% — spec 예상 범위).
- 인용 단위에 `seg` 가 없어지므로 `readStats.chars` 가 8h 이전보다 작게 쌓인다(지표 단절 — 기존 누적값은 그대로).
- `readCitations` 를 켠 상태에서 speak 모드 인용 발화의 자막 띠 표시("번역 없음")와 원본 보기 띠(D)는 브라우저 확인이 필요하다 — Review 몫.
- 측정용 셸 heredoc 에서 `\b` 가 백스페이스 문자로 바뀌는 일이 두 번 있었다(segment.js·측정 스크립트). 둘 다 고쳤고, 바뀐 모든 파일에 제어 문자 0 을 grep 으로 확인했다.
