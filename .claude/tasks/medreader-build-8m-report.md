# 8m Build 보고 — 영한 혼합: 문장별 글자 체계로 목소리 전환 (2026-10-21)

**경과**: 첫 단계 측정에서 M3 멈춤 조건(섞인 단위 > 10%)이 걸려 앱을 고치지 않고 보고했다(1차 보고). **운영자 결정(2026-10-21)**: 8m 을 설계대로 진행 — 섞인 단위(10.06%)는 문서 목소리, 10% 기준은 확인 완료로 넘어감, 줄 경계 분할·단위 안 쪼개기·문턱 변경은 하지 않음(기록만). 이어서 할 일 2–7·검증을 끝냈다. **커밋하지 않았다.** 전체 테스트 **1322/1322**(1301 + 새 21) × 3회, stamp `--check` 0, 변이 7개 모두 빨강 → 복원(cmp 같음), headless Edge 통과.

## 1. 측정 M1–M7 (첫 단계 — 앱 추출 경로 + 판별 규칙, 원문 미인용)

| 견본 | 쪽 | M1 bad/chars | M2 | 단위 | 예외 en | 같음 | 짧음 | **섞임** | M4 보기 | M6 `-{4,}`/`_{3,}` |
|---|---|---|---|---|---|---|---|---|---|---|
| DM B2 정답 및 해설 | 7 | 0 / 10,168 | ko 0.611 | 175 | 17 | 118 | 21 | **19 = 10.86%** | 0 | 6 / 2 |
| Part7 R.T. B2 해설 | 14 | 0 / 23,528 | ko 0.582 | 647 | 113 | 383 | 50 | **101 = 15.61%** | 106: en 7·문서 97·섞임 2 | 1 / 0 |
| bulls eye B2 해설 | 8 | 0 / 18,677 | ko 0.604 | 347 | 32 | 220 | 52 | **43 = 12.39%** | 11: 문서 8·섞임 3 | 7 / 0 |
| 천2 Day8 사진 | 12 | 0 / **39** | en 0 | 12 | 0 | 2 | 10 | 0 | 0 | 0 / 0 |

- **M1** 0. **M2** 앞 셋 ko, 넷째 en. **넷째 견본은 쓸 수 없다**(12쪽 글자 39자 — 본문이 그림). **en+ko 방향 견본은 사실상 없다**(87개 중 문서 en 은 `해커스_토플_리스닝_베이직.pdf` 2쪽 하나).
- **M3** 해커스 영한 텍스트 PDF **87개 397쪽 14,729단위 — 섞임 1,482 = 10.06%**(파일 중앙 8.4%, 최대 16.2%, 10% 초과 32개), 예외 en 1,593 · ko 5. 섞임의 꼴: **줄 경계 24%**(356 — 줄 조각마다는 한 체계) · **머리표 동률 20%**(302 — `[정답] (A)` 꼴, 무해) · 나머지는 한 줄 안 영한 교재 문형(어휘 목록·풀이 속 영어 인용·`영어 구 (한국어 풀이)`). 섞임의 79%(1,169)는 글자 수로 라틴이 더 많다 → 문서(ko) 목소리가 영어 낱말을 읽는다(운영자 결정으로 받아들임).
- **M4** 영어 보기 → en. ko 로 간 보기는 한국어 번역 보기·보기 해설이라 맞음. **M5** 2단 21쪽 흐름 순서 모두 왼 단 → 오른 단(구조 수치만, 사람 눈 3쪽은 못 함). **M6** 셋 합 14 / 2, 87개 289 / 23. **M7** Nour 결과 대기.
- 앱 함수(`text/lang.js` `unitLang`)로 87개를 다시 돌린 값이 시제품과 **파일마다 같다**(예외·섞임·짧음 모두).

## 2. 판별 규칙 (`js/text/lang.js` — 순수)
- `unitLang(src, docLang) → {lang, short, mixed}`: 한글·아랍·라틴 **덩어리** 다수결. 셀 글자 < 2 → `short`(같은 문단 앞 단위 물려받기, 없으면 문서 언어). 최다 체계 동률 또는 < 3/5 → `mixed`(문서 언어). 한글 → ko, 아랍 → ar, 라틴 → 문서가 en·fr 이면 문서 언어, 아니면 en. 그리스·한자·가나는 중립(세지 않음). 결과가 문서 언어면 `lang: null`.
- 문턱 상수 `SCRIPT_SWITCH {MIN_LETTERS 2, SHARE_NUM 3, SHARE_DEN 5}` — `config.js` 는 수정 범위 밖이라 `text/lang.js` 에 뒀다.
- 시제품과 다른 점 하나: 결합 부호(`\p{M}` — 아랍 타슈킬)는 덩어리를 끊지 않는다(시제품은 끊어 한 낱말을 여럿으로 셌다). 해커스 87개 판정에는 차이 없음.
- 단위 언어를 정하는 곳은 `tts/text.js` 의 `unitLangIn` **한 곳**(물려받기 포함) — M7 이 1초를 넘으면 문단 묶음으로 바꾸는 자리.

## 3. 바뀐 것
| 파일 | 내용 |
|---|---|
| `js/text/lang.js` | `SCRIPT_SWITCH`·`scriptRuns`·`unitLang` |
| `js/tts/text.js` | `buildUnits(…, {scriptSwitch})`(함수 기본 끔) — 예외인 단위에만 `Unit.lang`, 기호 표도 그 언어(`symbolsFor`), 문단 안 물려받기(본문·인용 meta 공유), 표 안내 문단 제외. `sentencesOf` 항목에 `lang`(있을 때만) |
| `js/tts/speaker.js` | `deps.scriptSwitch`(큐 만들 때마다 읽음, 기본 켬)·`setScriptSwitch` · `deps.langSpeech(lang)` 로 단위마다 `utt.lang`·`voice`(없으면 voice 없이 `defaultSpeechTag`) · 전환 단위 `VOICE_ERRORS`(재시도 뒤) → `SWITCH_NO_VOICE {lang}` 한 번 + 세션 동안 `switchOff[lang]` + 같은 단위를 문서 언어로 · 전환 단위의 다른 오류는 건너뛰되 `NO_VOICE` 없음 · 전환 단위 성공은 `srcEverOk` 에 세지 않음 · 대상 언어와 같은 단위는 `trActive` 거짓 + `linechange.seg = null`(띠 "이 문장은 번역 없음", 번역 커서 그대로) · `getSwitchOff` |
| `js/ui/controls.js` | `scriptSwitch`·`langSpeech` 배선(`langSpeechOf` — 8k `resolveSpeech`·`speechPref` 그대로) · `SWITCH_NO_VOICE` → 배너 `reader.tts.switchNoVoice {lang}`(언어마다 한 번) · 디버그 훅 `switchOff()` |
| `js/ai/readalong.js` | 대상 언어와 같은 문장은 흐름에서 뺌(요청·창·readStats) · 문서 언어와 다른 문장은 `src` 항목 · 다음 쪽 큐도 `tts.scriptSwitch` 를 읽어 같은 규칙 |
| `js/ai/pipeline.js` | 항목 `src` 를 요청까지 넘김 · **기기 내 번역은 `src` 없는 항목만**(언어 쌍 하나 — `src` 항목은 원격) |
| `js/ai/prompts.js` | 항목 `src`(문서 언어와 다르고 이름이 있을 때만) + `SRC_LINE` 한 줄(그때만 — 없으면 8m 이전 요청과 같음) · `PROMPT_VERSION` 1 → 2(캐시 키 무관) |
| `js/settings.js` | `tts.scriptSwitch: true` |
| `js/ui/settings.js`·`index.html` | 설정 > 낭독 목소리 카드에 토글 한 줄 + 설명(`#ttsScriptSwitch`, 반쪽 캐시면 그리지 않음) · stamp 다시 |
| `js/i18n/{ko,en,ar,fr}.js` | 키 3개 × 4: `settings.tts.scriptSwitch`·`.help`·`reader.tts.switchNoVoice`(ar·fr 문안 `[검토 — Nour·운영자]`) |
| `tests/mixlang-8m.test.mjs`(새, 21) · `tests/pipeline-8a.test.mjs`(promptVersion 기대 1 → 2 한 줄) | |
| `spec.md` | 19-1-2 2-6 끝·19-1-3 §4-3 끝 정정 줄 2개 |

DB 버전·`algoVersion`·캐시 키·`SEARCH`/`SCAN` 버전 불변. 원본 보기·하이라이트·검색·8g·8i 경로 무변. `SAME_LANG` 유지(O-D4 (가)).

**범위 메모**: 지침의 `js/translate/*` 는 레포에 없다 — spec 2-6 이 적은 `ai/readalong.js`·`ai/prompts.js` 로 읽었고, `src` 를 요청까지 나르려면 `ai/pipeline.js` 도 고쳐야 해 함께 고쳤다(같은 언어 생략·`src` 만). 띠(`ui/trband.js`)는 범위 밖이라 고치지 않고 speaker 의 `seg` 비우기로 "번역 없음"을 보이게 했다.

## 4. 단일 언어 문서 큐 바이트 동일
- 실물(스크래치 `b8m/bytes.mjs`, 앱 경로, 문장·줄 모드 켬/끔 JSON 비교): CMDT 2026 50쪽(2,086단위·1.79MB) · CMDT 2021 127쪽(2,367·2.09MB) · Harrison 19쪽(857·0.64MB) · Grammar in Use [OCR] 40쪽(825·0.39MB) — **다른 쪽 0, `lang` 속성 0**.
- 테스트 T-L2: 8h T-U 픽스처(en·fr, 문장·줄)·합성 2단 쪽(실제 레이아웃 → 저장본 → 화면 문단) 켬/끔 바이트 같음. ko 로 표시된 영어 픽스처는 켜면 영어 문장이 en 예외가 된다(의도 — 다른 속성은 그대로) — 기존 T-U 지문 테스트는 옵션을 주지 않아(함수 기본 끔) 그대로 통과.

## 5. 테스트·변이
- 새 21개: T-L1(합성 18 + 이모지·숫자만·"COVID-19 환자"·타슈킬·3/5 경계·중립 체계) · T-L2 ×3 · T-L3 ×2(물려받기·기호 표 ko·줄 모드·300자 조각·`sentencesOf` 의 `lang`) · T-L4 ×4(단위마다 lang·voice, 표 안내 불변, 설정 끔, `langSpeechOf`=8k 해석, 대상 언어 단위 tr 없음·seg 비움) · T-L5 ×2(전환 실패 되돌리기·안내 1회·이후 전환 끔 / 다른 오류는 NO_VOICE 없음, 문서 언어 오류는 그대로 NO_VOICE) · T-L6(대상 ko → ko 문장 요청에 없음, 줄어든 글자 = ko 문장, 끄면 8m 이전) · T-L7 ×3(readalong `src`, `buildTranslateRequest` 불변·`SRC_LINE`, 실제 파이프라인 요청 본문·기기 내 번역 분리) · 설정·문구·화면 자리 · 기록 ×3(띄어진/붙은 한글, en 분할 한계, 실측 숫자).
- 전체 `node --test apps/medreader/tests/*.test.mjs` **1322/1322 × 3회**.
- 변이(`b8m/mutate.py`, 백업 `b8m/bak/mut/`, 복원 = 백업을 읽어 쓰기 + `cmp`): ① 다수결 문턱 3/5 → 0 → 1 빨강 ② 물려받기 빼기 → T-L3 빨강 ③ 단일 언어에도 lang → 8 빨강(T-L1·T-L2 포함) ④ 같은 언어 번역 생략 빼기 → T-L6·T-L7 빨강 ⑤ speaker 가 `u.lang` 무시 → T-L4·T-L5 3 빨강 ⑥ 전환 실패 되돌리기 빼기 → T-L5 빨강 ⑦ `src` 항목 빼기 → T-L6·T-L7 빨강. 7개 모두 복원 cmp 같음.

## 6. headless Edge (412×915 · ko·ar · Nour 모양 음성 92개 · 흉내 키·흉내 번역 · 새 프로필 `b8m/p1` 하나 · 8000번 python 그대로)
**1회차(새 프로필) 전부 ok**, 콘솔 오류 0:
- **A** DM B2(문서 ko 자동 0.611, 대상 ko → `same-lang`, 요청 0): 2쪽 20발화 — ko-KR 19 · en-US 1, 판정 어긋남 0. **설정 끔** → 20발화 전부 ko-KR. ko 목소리 `urn:ko_KR` 를 고르면 ko 단위가 그 음성, 영어 단위는 voice 없음.
- **B** 같은 견본을 서재 [⋯] 에서 문서 en 으로: 대상 ko — 요청 2건 40항목 중 **한글 위주 항목 0**, ko 단위 뒤 번역문 0(2회차 정밀 측정: ko 단위 띠 상태 `none`만, 영어 단위 `ready`). 대상 ar — 요청 3건 39항목 중 20개 `src:'ko'`, 지시문에 `SRC_LINE`.
- **C** ko-KR 발화를 `language-unavailable` 로 실패시킴: ko 시도 2회(재시도 포함) → 같은 문장을 en-US 로 다시, 배너 `reader.tts.switchNoVoice` 하나("한국어 음성을 쓸 수 없어 …"), `reader.tts.noVoice` 없음, `switchOff = ['ko']`, 이후 ko 단위 en-US.
- **D** 설정 토글: ko·ar 문구, 기본 체크, 누르면 저장 false → true, ar `dir=rtl`, 가로 스크롤 412·360 모두 0.
- **회귀**(CMDT 2026): 40쪽 원문 en-US·voice 없음, 번역문 ar-SA, 띠 `lang=ar dir=rtl`(태그 그대로) · 8k en_GB 고르기 → `en-GB`·`urn:en_GB` · 8i-3 60 → 61쪽 넘김 · 8g "fever" 결과(59쪽) 이동 뒤 [▶] 가 59쪽 en-US · 8l 글자 없는 PDF ▶ → idle·발화 0·`reader.scan.noRead`·쪽 그대로.
- 2회차는 같은 프로필을 다시 써서(문서 언어가 1회차 끝의 en 으로 남고 번역이 캐시됨) A_off·B_ko 의 판정 조건이 맞지 않았다(실패가 아니라 시험 조건 차이 — 띠 정밀 수치만 썼다). 바깥 요청은 pdf.js CDN·흉내 응답한 Gemini 주소뿐.
- 스크린샷 `b8m/shots/`(hk-ko-412-reader · hk-en-doc-ko-target · hk-switch-novoice · ko/ar-412·ar-360-settings-switch).

## 7. 띄어진 한글 꼴 (carryover 8l)
스피쿠스 OCR 판 60개 384쪽: "가 나 다 라" 꼴 **2회(2파일)** 뿐, 띄어쓰기가 지워진 붙은 꼴(한글 12음절 이상 공백 없음) **1,747회**. 띄어진 꼴은 한글 덩어리를 부풀려 ko 쪽, 붙은 꼴은 줄여 라틴 쪽으로 기운다 — 60개 섞임 2.88%(10% 초과 0)라 판별이 깨지지 않았다. 고치지 않음, 기록 테스트로 남김. 같은 교재 안에서 문서 언어가 ko 32 · en 28 로 갈린다(`guessLang` 30% 근처 — 범위 밖).

## 8. spec 정정 줄 (2개)
- 19-1-2 2-6 끝 `[정정 2026-10-21 — 8m Build]`: 운영자 결정 + 구현이 설계와 다른 점 ①–⑦(반환 모양·문턱 위치·결합 부호, `buildUnits` 함수 기본 끔·`unitLangIn` 한 곳, 전환 실패 갈래, `seg` 비우기·readStats, 기기 내 번역 분리·`PROMPT_VERSION` 2, en 분할 한계, `CHARS_PER_SEC_BY_LANG` 미실시).
- 19-1-3 §4-3 끝 `[실측 2026-10-21 — 8m Build 첫 단계]`: M1–M7 수치, 87개 10.06%·원인 24%·20%·나머지 교재 문형, 단일 언어 책 섞임 0·바이트 같음, **en+ko 견본 없음**, 띄어진/붙은 한글, **운영자 결정**.

## 9. 프로세스
띄운 headless Edge(포트 9338, `b8m/p1`)는 매 실행 끝에 `browser.close()` — 남은 `b8m` Edge 0. 측정·테스트 node 는 모두 끝남(`timeout` 상한). 8000번 python(PID 30352)·8123·8124·8125 손대지 않음. G:·D:/OCR 읽기만.

## 10. 남은 문제
1. **en 문서의 분할 한계**: en·fr 문서에서 "영어 문장. 한국어 문장." 이 한 단위(마침표 뒤 한글·아랍을 문장 시작으로 안 봄) → 섞임 → 문서 목소리. en+ko 실물이 오면 볼 것(분할을 바꾸면 7-8-2·캐시 키).
2. **en+ko 방향 실물 없음**(넷째 견본은 그림).
3. **M7**(전환 간격, Nour)·**M5** 사람 눈 확인 남음. 실기기에서 ko 단위는 voice 없이 `ko-KR` 태그(Realme 목록에 ko_KR 있음).
4. 섞임의 79% 는 영어 낱말이 많은데 문서(ko) 목소리 — 결정으로 받아들임(기록).
5. 워치독 `CHARS_PER_SEC_BY_LANG`(한국어 300자 조각 ≈ 46초 vs 48.9초) 안 함.
6. 문서 언어 `und`(미지원 원문) 문서의 라틴 문장은 이제 en 목소리로 바뀐다(규칙대로 — 기록).
7. readStats 에서 대상 언어와 같은 문장이 빠진다(번역하지 않으므로).
8. ar·fr 새 문구 3개 검토(Nour·운영자).
9. 스피쿠스 OCR 판의 문서 언어가 교재마다 ko/en 으로 갈림(`guessLang` — 범위 밖).

스크래치 `b8m/`: `measure.mjs`·`all-hk*.sh`·`hk-*.jsonl`·`sp-*.jsonl`·`spaced.mjs`·`bytes.mjs`·`mutate.py`·`hl.mjs`·`hl.json`·`shots/`·`bak/`(원본 `bak/orig/`, 변이 백업 `bak/mut/`) · `s1–s4.json` 에는 40자 이하 진단 예시가 있어 레포에 넣지 말 것.
