# 8n Build 보고 — 스페인어 원문 언어 (F4 · L-D1)

> 지침 `.claude/tasks/medreader-build-8n-es.md` + 마무리 지침 `medreader-build-8n-es-finish.md`. 앞 Build 가 2026-11-16 01:46 에 보고서 전에 끊겨, 마무리 Build 가 이어서 끝냈다. **커밋하지 않았다.** 설계: spec 19-1-3 §5 "8n" 표 + 수용 기준. 정정은 같은 절 `[정정 2026-11-16 — 8n Build]` 줄(①–⑨)과 ③ 끝의 `[정정 2026-11-16 — 8n 마무리]`.

## 1. 바꾼 것

### 앞 Build 몫 (작업 트리에 있던 것 — 그대로 둠)
| 파일 | 내용 |
|---|---|
| `js/text/lang.js` | `SUPPORTED_SRC` 끝에 `es`(앞 셋 순서 불변) · es 기능어 10개(en·fr 와 겹치지 않는 것만 — `la`·`que`·`se`·`y` 뺌) · `functionWordRates` 가 `es` 도 셈 · `guessLang` 에 es 갈래를 **먼저**: `r.es > 0 && r.es ≥ max(en, fr) × 2` 일 때만 es, 아니면 8n 이전 규칙 그대로 · `LATIN_DOC_LANGS` 에 es(8m — 정정 ①) |
| `js/text/segment.js` | `SENTENCE_START.es` = fr 꼴 + 여는 `¿`·`¡` |
| `js/config.js` | `SPEECH_BLANK.es = 'espacio'`(8o) · `TTS_LANG_REGION.es = 'es-ES'` |
| `js/i18n/{ko,en,fr,ar}.js` | `onboarding.lang.es = 'Español'`(UI 언어 목록에는 없음 — 확인 ⑤) |
| `index.html` | stamp 만 |
| `tests/blank-8o.test.mjs` · `i18n.test.mjs` · `lang.test.mjs` · `srclang-7c.test.mjs` | es 가 생긴 데 맞춘 기대값(8o "es 는 아직 없다" → `de` 로, F9·V2·I14) |
| 새 `tests/srclang-es-8n.test.mjs` · `tests/fixtures/srclang-8n-corpus.mjs` · `srclang-8n.golden.json` | N1–N9 (판정·¿¡ 분할·7c E1 꼴 golden 회귀·무작위 3,000개 대조·경계·[⋯]·8m/8o/8k·번역·UI 목록) |
| `spec.md` | 19-1-3 §5 `[정정 2026-11-16 — 8n Build]` ①–⑨ |

### 이번(마무리) 몫
| 파일 | 내용 |
|---|---|
| `js/ui/settings.js` | `VOICE_LANGS` 끝에 `'es'`(앞 넷 순서 불변) — **`export` 로 바꿈**(테스트·변이가 볼 수 있게) · `VOICE_SAMPLES.es = 'Así suena la voz de lectura.'`(지어낸 문장, fr 견본과 같은 꼴) |
| `js/settings.js` | 기본값 `tts.voice.es: ''` · `tts.accent.es: ''` |
| `tests/srclang-es-8n.test.mjs` | **N10** 더함 — `VOICE_LANGS` 앞 넷 불변·끝 es · 모든 `SUPPORTED_SRC` 에 목소리 묶음 · 묶음 언어마다 견본·기본값 두 키 · `voiceChoiceRows('es')` 억양 es-ES·es-MX · `voicePrefFor` 저장값 |
| `tests/voice-8k.test.mjs` | K20 견본 문장 목록에 es |
| `index.html` | stamp 다시(모듈 66 · CSS 4) |
| `spec.md` | 정정 ③ 끝에 `→ [정정 2026-11-16 — 8n 마무리] 넣음(…)` 한 줄 |

- 설정 키를 순회·검사하는 테스트: `settings.test` S-1 은 9-3 키의 **부분 집합**만 보고 `KEYS = Object.keys(DEFAULTS)` 라 고칠 것 없음. 다른 곳에 언어별 tts 키를 나열한 코드 없음.
- **9c 백업 허용 목록**: 9c 는 아직 Build 전(`js/text/backup.js`·`js/backup/` 없음). spec 17-4-1 은 "담지 않는다" 목록을 `tts.voice.*`·`tts.accent.*` **무늬**로 적었다 → es 두 키도 저절로 덮인다. 다만 9c 수용 기준이 "`DEFAULTS` 의 모든 키가 담음/안 담음 목록 중 하나"이므로, 9c Build 가 무늬를 키 이름 나열로 바꿔 구현하면 `tts.voice.es`·`tts.accent.es` 를 넣어야 한다(그 테스트가 빨강으로 잡는다).
- DB·`algoVersion`·캐시 키·`PROMPT_VERSION` 불변. `review.md`·`dev/` 안 건드림(`dev/stamp-importmap.mjs` 는 실행만).

## 2. 실측 숫자 (spec 정정 ⑦·⑧ 그대로)
- 의학책·해커스 회귀(앱 추출 경로, 원문 미인용): CMDT 2026 54쪽·CMDT 2021 124쪽·Harrison 32쪽·해커스 DM B2 7쪽·Part7 B2 14쪽·bulls eye B2 8쪽 — 앞 30쪽 표본 `guessLang` 이 HEAD 와 같음(en 1 · en 1 · en 1 · ko 0.611 · 0.582 · 0.604). 문단 2,860개의 `splitSentences`(en·fr·ko·문서 언어) 다른 것 0. 낭독 큐(문장·줄 × 전환 켬/끔 × 문서 언어·en) JSON 다른 쪽 0. 의학책 표본의 es 기능어는 천 낱말당 0–0.9(en 99.9–229.5) — 2배 규칙까지 100배 넘게 멀다.
- 7c E1 꼴 회귀: HEAD 모듈로 만든 golden(`srclang-8n.golden.json` + 말뭉치)과 글자 단위 대조(N3) + 8n 이전 라틴 판정 사본과 무작위 3,000개 대조(N4).
- 앞 Build headless 회귀(`b8n/run-reg2.json`): en 의학책 낭독·번역 띠·8m 전환 `ok: true`, 콘솔 오류 0.

## 3. 변이 (마무리 Build 가 다시 — 앞 Build 는 기록 없음)
시작 전: 작업 트리 `lang.js`·`segment.js` 가 앞 백업 `b8n/bak/pristine-*`·`m1–m5` 와 `cmp` 같음(변이 찌꺼기 없음 — `git diff` 의 8n 판). 원본 세 파일을 새 `b8n/bak2/orig-*` 에 복사, 변이는 `b8n/mutate2.py`(bak2 원본을 읽어 바꿔 씀), 복원은 bak2 원본을 읽어 쓰기 → `cmp` 같음 확인. 각 변이마다 전체 `node --test`(1,495개).

| # | 변이 | 빨강(IM2·IM6·IM7b = import map 해시 어긋남, 매번 함께 빨강 — 제외하고) | 복원 cmp |
|---|---|---|---|
| 1 | `SUPPORTED_SRC` 에서 es 뺌 (설계) | 6개: F9 · N1 · N6 ×2(서재 [⋯]·자국어 이름) · N8 · V2 | 같음 |
| 2 | 판정을 en·fr·es 3자 동시 최댓값으로 (설계) | 4개: N3(golden) · N4(무작위 3,000) · N5 ×2(**en/fr 경계 픽스처** — es 섞인 영어·프랑스어) | 같음 |
| 3 | `LATIN_DOC_LANGS` 에서 es 뺌 | 1개: N7(8m — es 문서 라틴 문장) | 같음 |
| 4 | `SENTENCE_START.es` 에서 `¿¡` 뺌 | 3개: N2 ×2(분할·낭독 단위) · N7 | 같음 |
| 5 | `VOICE_LANGS` 에서 es 뺌 | 1개: N10 | 같음 |

(변이 1 fail 9 · 2 fail 7 · 3 fail 4 · 4 fail 6 · 5 fail 4 — 위 숫자 + IM 3개.)

## 4. 테스트
`node --test apps/medreader/tests/*.test.mjs` 2회 — 두 번 다 **tests 1495 · pass 1495 · fail 0**(약 9.5초). (지침 시점 1,476 + 8n 19개 = N1–N10.)
`stamp-importmap.mjs --check` → "그대로다"(종료 0). `git diff --check` → 0. 새 테스트·픽스처 파일 끝 공백 없음.

## 5. headless (마무리 — `b8n/run-p2.mjs` → `b8n/run-p2.json`, `ok: true`)
새 프로필 `b8n/p2`, Edge headless **pipe**(디버깅 포트 안 엶 — 그래서 "새 포트"는 해당 없음; 앱은 떠 있는 8000번 python 에서 읽기만), 412×915, 가짜 키, 흉내 Gemini(OPTIONS 204), 흉내 음성(es-ES·es_MX 포함). 합성 스페인어 PDF `b8n/es-synth.pdf`(앞 Build 가 만든 지어낸 글).
- 판정: `lang es`, `langSource auto`, `langGuess {es, 0.7, latin}`.
- 1쪽 낭독 12발화 모두 `es-ES`, voice 없음(휴대폰 설정 따름).
- **번역 요청 지시문**: 2건 모두 "Translate each segment from Spanish into Arabic." (33개 항목), 띠 `lang=ar` 보임. 앞 실행 `run-es2.json` 의 `instr: []` 는 **같은 프로필 p1 을 두 번째로 쓴 실행이라 번역 캐시가 맞아 요청이 0건**(`readalong.calls: 0`)이었기 때문 — 첫 실행 `run-es.json` 에도 "from Spanish" 2건이 있다.
- **설정 > 낭독 목소리**: 묶음 `en,fr,ko,ar,es`(es 끝), 머리 이름 `Español`(`lang=es`, `ltr`), 줄: 휴대폰 설정 따름 ◉ · 스페인 억양 · Fake Español España · 멕시코 억양 · Fake Español México. **화면에서** 멕시코 억양 줄을 눌러 저장값 `tts.accent.es = 'es-MX'`·`tts.voice.es = ''`, 머리 줄 "멕시코 억양". [들어 보기] → `es-MX` 로 "Así suena la voz de lectura.".
- 3쪽 낭독 태그 모두 `es-MX`(voice 없음).
- ar UI: 같은 묶음 다섯, `dir=rtl`, es-MX 줄 체크 유지("لهجة المكسيك").
- 가로 넘침 0: 리더(ko·ar)·설정(ko·ar)·서재(ar). 콘솔 오류 0 · 페이지 오류 0 · 흉내 오류 0 · 4xx/5xx 0. 외부 요청은 pdf.js CDN(웹앱 허용)뿐.
- 스크린숏: `b8n/shots/p2-settings-voice-{ko,ar}-412.png`, `p2-reader-es-{ko,ar}-412.png`.

## 6. 한계·남은 것
- **`Sra.` 뒤에서 문장이 끊긴다**(`Sr.` 는 영어 약어 목록에 있어 안 끊김). 견본 없이 약어 목록을 늘리지 않았다(정정 ⑨).
- **실물 스페인어 견본이 없다** — 판정 문턱(2배)·분할은 합성 글과 무작위 글로만 확인. 실기기(Android) 스페인어 목소리 목록도 미확인 — 실기기 확인 묶음으로.
- es 분할은 fr 꼴이라 마침표 뒤 한글에서 끊지 않는다(8m 의 en 분할 한계와 같음, 정정 ①).
- 8n 이전에 fr/en 으로 추정된 스페인어 문서는 다시 추정하지 않는다(설계대로 — 사용자가 [⋯] 에서 고침).
- `ui/library.js` 258행 주석 "(미지원이어도 셋)" 은 이제 넷(주석만 — 범위 밖, 정정 ⑥).
- 9c Build 가 허용 목록을 키 이름 나열로 구현하면 `tts.voice.es`·`tts.accent.es` 를 넣을 것(1절).
- 9b 음성 명령 `voice.cmdLang` 은 ar/en 그대로(es 명령 범위 밖).
- 작업 트리 `apps/medreader/NVIDIA Corporation/umdlogs/`(빈 폴더 — Edge/GPU 드라이버가 실행 위치에 만든 것으로 보임, 2026-09-28 에 생김 — 8n 과 무관한 옛 것)가 있다. git 은 빈 폴더를 보지 않아 커밋에 안 들어간다. `rm -rf` 금지라 지우지 않았다 — 필요하면 운영자가 지운다. 이번 실행은 스크래치패드 `b8n/` 에서 돌려 앱 폴더에 새로 생기지 않았다.

## 7. 막힌 명령
없음. (`ls -d p2` 가 "없음"으로 종료 코드 2 — 새 프로필 폴더가 아직 없음을 확인한 것이라 정상.)
