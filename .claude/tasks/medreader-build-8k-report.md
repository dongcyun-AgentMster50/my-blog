# Build 보고서 — 8k 낭독 목소리: 휴대폰 설정 따름 + 언어별 고르기 + 억양(O3)

> 2026-10-21 · Build 서브에이전트 · 지침 `.claude/tasks/medreader-build-8k.md` · 커밋하지 않음.
> 설계: spec 19-1-1 E1 (가) · 19-1-2 3절 지침 문안 1–6 · O-D7 (가). Nour 점검표 2 결과는 아직 없음 → 기본값은 설정 한 곳(`SPEECH_DEFAULT`)에서 바꿀 수 있게 했다.

## 1. 바꾼 파일 (모두 `apps/medreader/` 안)

| 파일 | 바뀜 |
|---|---|
| `js/tts/voices.js` | `SPEECH_DEFAULT`(기본 동작 한 곳) · `parseVoiceLang`(밑줄·`#스크립트` → BCP 47) · `languageVoices` · `defaultSpeechTag` · `voiceTag` · `normalizeAccent` · `speechPref` · **`resolveSpeech`** · `accentGroups` · `regionName`. 옛 `pickVoice`·`utteranceLang`·`speechLang` 은 그대로 둠(목록 유무 판정·진단 페이지 "이전 규칙"용) |
| `js/tts/speaker.js` | 음성 지정 자리만: `setTrVoice(lang, voice, listed)` 세 번째 인자 — voice 가 없어도(기본) "목록에 그 언어 음성이 생겼다"면 실패로 꺼진 tr 을 다시 허락(옛 조건 "고른 음성이 있다"와 같은 뜻) |
| `js/ui/controls.js` | `applySourceSpeech`·`applyTrSpeech`·`applyNoticeSpeech`(export, speaker 를 받는 작은 함수) — 세 `sync*` 가 이것을 부른다. `medreader:voicepref` 를 들으면 세 경로를 다시 고름. `pickVoice`·`utteranceLang`·`speechLang` import 0 |
| `js/ui/quiz.js` | `applyQuizSpeech`(export) — 만들 때·음성 목록이 온 뒤·**[읽기]를 누를 때마다** 같은 함수로. 옛 `if (v) setVoice` 대신 늘 `setVoice(lang, r.voice)`(지움 포함) |
| `js/ui/settings.js` | 낭독 목소리 카드(아래 4). 번역문 [들어 보기](`runVoiceTest`)도 `resolveSpeech`. `voiceStatus` 는 `languageVoices`(목록 유무만). 번역 언어를 바꾸면 `medreader:voicepref` |
| `js/settings.js` | `tts.accent.{en,ar,fr,ko}` 기본 `''` |
| `js/i18n/{ko,en,fr,ar}.js` | 새 키 13개(`settings.tts.voice.*` 12 + `settings.tts.voiceHint`) |
| `index.html` | 설정 화면에 `#settingsVoices` 카드(그릇 `#ttsVoiceLangs` + 안내 한 줄) · stamp 다시 |
| `css/screens.css` | `.voice-lang`·`.voice-row` 등(끝에 추가) |
| `dev/voices.html` | 아래 7 |
| `tests/voice-8k.test.mjs` (새, 25개) · `tests/srclang-wiring-7c.test.mjs` W2 | W2 는 옛 `pickVoice`/`utteranceLang` 문자열 고정 → `applySourceSpeech`→`resolveSpeech` 고정으로 |
| `spec.md` | 19-1-1·19-1-2 안 정정 줄 2개(아래 9) |

DB 버전·`algoVersion`·번역 캐시 키 불변. 무료 한도 0.

## 2. `resolveSpeech` 갈래 · 억양 묶음 · 꼬리표

`resolveSpeech(lang, voices, {uri, accent}, policy?) → {voice|null, tag, via, missing}`
1. uri 가 목록(그 언어)에 있다 → 그 음성, 태그 = 그 음성의 정규화 태그 (`via:'voice'`)
2. uri 가 사라졌고 accent 가 있다 → `{null, accent}` · `missing:true`
3. accent 만 → `{null, accent}`
4. 둘 다 없다 → `{null, 기본 태그}` (`via:'phone'` = 휴대폰 설정 따름)
5. 목록이 비었다(늦게 옴·아랍어 0개) → uri 는 찾을 수 없으니 2·4 처럼 voice 없이

- 기본 태그 = `READALONG.TR_LANG_REGION` → `TTS_LANG_REGION` → 언어 코드: en-US · fr-FR · ko-KR · ar-SA. 네 경로가 같다(옛 원문/번역문 경로 구분 없어짐).
- accent 는 목록으로 거르지 않는다(태그일 뿐 — 목록이 늦게 오는 동안에도 같은 소리). 다른 언어의 uri·accent 는 무시.
- **억양 묶음**(`accentGroups`)은 목록 음성의 `voice.lang` 지역에서만 — 코드에 지역 0. 처음 나온 순서, 지역 없는 음성(`ko` 꼴)은 맨 뒤 "지역 표시 없음"(고를 수 없는 머리 줄).
- **꼬리표 처리 결정**: `parseVoiceLang` 이 `en_AU`→en-AU, `zh_HK_#Hans`→zh-Hans-HK, `bs_BA_#Latn`→bs-Latn-BA, `en-us-x-sfg`→en-US(사설 꼬리 버림). **억양 = 언어-지역만**(`zh-HK`) — 이유: 스크립트(#Hans/#Hant/#Latn)는 글자 체계이지 발음(억양)이 아니고, Android 엔진은 언어+국가로 그 지역 목소리를 찾는다. 같은 지역의 #Hans·#Hant 음성은 한 묶음(그 아래 이름 줄 둘), `sr_RS_#Cyrl`·`sr_RS_#Latn` 도 `sr-RS` 하나. 목소리를 직접 고르면 그 음성 자신의 태그(스크립트 포함, 옛 `zh-HK-#Hans` 같은 깨진 태그가 아님).
- 저장: 목소리 = `tts.voice.{l}=uri` + `tts.accent.{l}=그 음성의 억양`(사라지면 같은 억양으로 물러서게) · 억양만 = uri `''` + accent · 휴대폰 설정 = 둘 다 `''`.

## 3. 기본 동작(voice 없음) 확인

- node K1·K11·K11b: Nour 모양 픽스처(92개, en 5·fr 2·ko 1·ar 0, `en_AU` 가 알파벳 첫째 — N0 에서 옛 `pickVoice` 가 en_AU·fr_CA 를 고름을 재현)에서 고른 것이 없으면 원문·번역문(ar·ko 대상)·표 안내·퀴즈 발화 모두 `utt.voice` 없음, `utt.lang` = en-US / ar-SA / ko-KR.
- headless A·F: 리더 ▶ → 원문 `[en-US, null]`, 번역문 `[ar-SA, null]`.

## 4. 네 낭독 경로 통일

원문(`applySourceSpeech`) · 번역문(`applyTrSpeech`) · 표 안내(`applyNoticeSpeech`) · 퀴즈(`applyQuizSpeech`) — 모두 `resolveSpeech(lang, list, speechPref(get, lang))`. 설정의 번역문 [들어 보기]·목소리 [들어 보기]도 같은 함수. 화면 코드(`controls`·`quiz`·`settings`)에 `pickVoice`·`utteranceLang`·`speechLang` 호출 0(K16). 8m 은 speaker 의 `voiceFor[lang]`·`setDocLang` 자리에 같은 함수 결과를 넣으면 된다(`resolveSpeech` 는 순수, 언어 하나씩).

## 5. 설정 화면

설정 > "낭독 목소리" 카드(낭독 동반 번역 카드 아래). 언어마다 접는 묶음(en·fr·ko·ar 순, 머리 = 자국어 이름 + 지금 고른 것 + "사라짐" 표시). 안은 라디오 무리 하나:
- ◉ 휴대폰 설정 따름(기본) → ○ "{지역} 억양 — 목소리는 휴대폰이 고름"(`Intl.DisplayNames(UI 언어)`) → ○ 목소리 이름 그대로(`bdi` 격리, 길면 말줄임, 전체 이름은 title) + 기기/온라인. 줄마다 [들어 보기](`settings.readalong.voice.test` 재사용).
- 목록 0개 언어(Nour 아랍어): 휴대폰 설정 한 줄 + "이 기기 목록에 العربية 목소리가 없습니다. 휴대폰 설정 목소리로 읽습니다."
- 카드 아래 안내 한 줄 `settings.tts.voiceHint`(성별 표시·추정 없음 — K17 이 Female/Male/성별 글자 0 을 고정).
- 고르면 즉시 저장 + `medreader:voicepref` → 리더 세 경로가 다음 발화부터. `change` 와 `click` 둘 다 듣는다(아래 6의 결함 때문). innerHTML 0.
- headless: 412·360px 가로 스크롤 0(ko·ar 둘 다 412/412·360/360), 줄 높이 48–74px, [들어 보기] 48px, 아랍어 `dir=rtl`(줄 방향 rtl), 지역 이름 아랍어("لهجة المملكة المتحدة …"). 억양 줄은 뜻이 잘리지 않게 줄바꿈(한국어 `keep-all`), 목소리 이름만 말줄임.

## 6. 사라진 음성

- 낭독: `resolveSpeech` 가 조용히 억양 → 휴대폰 설정(오류·배너 없음 — headless E: `urn:old-device-voice`+en-GB → `[en-GB, null]`, 억양 지우면 `[en-US, null]`, 배너 0).
- 설정 화면: 목록이 **안정된 뒤에만**(늦게 오는 목록을 사라짐으로 오해하지 않게) 머리에 "사라짐" + "저장한 목소리를 이 기기에서 찾을 수 없습니다. 지금은 다음으로 읽습니다: 영국 억양". 체크는 실제로 읽는 쪽(억양/휴대폰 설정). 저장한 억양이 목록에 없으면 "{지역} 억양 — 이 기기 목록에 없음" 줄을 체크된 채 보임.
- **headless 에서 찾아 고친 결함 2개**: (가) 사라진 상태에서는 "휴대폰 설정 따름"이 이미 체크돼 있어 눌러도 `change` 가 안 와 사라진 uri 가 지워지지 않았다 → `click` 도 듣고 저장값과 같으면 아무것도 하지 않음. (나) **8b-1 부터 있던 결함**: 설정에서 번역 언어를 바꿔도 리더의 번역문 태그·음성은 음성 목록이 바뀔 때까지 옛 언어 것(ko 로 바꿔도 ar-SA 로 읽음 — HEAD 의 `syncTrVoice` 는 init·목록 변화 때만) → `onTargetLang` 이 `medreader:voicepref` 를 보냄.

## 7. `dev/voices.html`

[앱이 고른 음성] = `resolveSpeech`(앱 설정을 읽지 않으므로 "고른 것 없음" = 휴대폰 설정 따름 소리). 옛 `pickVoice` 단추는 **[이전 규칙 · Old rule]** 로 언어마다 남김(Nour 영상의 [앱이 고른 음성]이 이것). 언어마다 목록에서 만든 **[억양 xx-YY]** 단추(voice 없이 그 태그 — 앱 "억양만"과 같은 소리). 요약 표 칸: 앱이 고를 음성(resolveSpeech) · 앱이 쓸 lang · 이전 규칙(pickVoice) · 억양 묶음. [결과 복사]에도 이전 규칙·억양 묶음 포함. 동적 import 는 여전히 `../js/tts/voices.js` 하나, 저장소·네트워크 0(MF10 통과). headless 확인: 앱 en `[en-US, null]`, 이전 규칙 en `[en-AU, urn:en_AU]`·fr `[fr-CA, urn:fr_CA]`(옛 버그 재현), 억양 en-GB `[en-GB, null]`, 앱 ar `[ar-SA, null]`.

## 8. 테스트 · 변이

- 전체 `node --test apps/medreader/tests/*.test.mjs` **2회 1285/1285**(1260 + 새 25). `stamp-importmap --check` 0.
- 새 `tests/voice-8k.test.mjs`: N0 픽스처 · K1 기본 · K2 `SPEECH_DEFAULT` · K3 다섯 갈래 · K4 uri 사라짐 → 휴대폰 설정 · K5 다른 언어 값 무시 · K6 꼬리표 정규화 · K7 억양은 목록 지역에서만 · K8 #Hans/#Hant 한 묶음 · K9 지역 이름 · K10 설정 키 · K11/K11b/K12/K13/K14/K15 실제 `createSpeaker` 로 네 경로 voice·lang · K16 같은 함수(소스) · K17–K20 설정 화면 순수 부분 · K21 i18n · K22 index.html 카드 · K23 진단 페이지.
- 변이 9개 → 모두 빨강 → 복원(읽어서 쓰기 + `Buffer.compare` = cmp, 백업 `scratchpad/b8k/bak/`), 기록 `scratchpad/b8k/mut.log`:

| 변이 | 빨강 |
|---|---|
| M1 기본을 첫 음성으로(옛 버그, `SPEECH_DEFAULT.voice='pick'`) | K1·K2·K3·K4·K5·K11·K11b·K13·K14 |
| M2 `#스크립트` 꼬리표 정규화 빼기 | K6 |
| M3 사라진 uri 를 붙들기(그 언어 첫 음성) | K3·K4·K5·K14·K19 |
| M4 퀴즈 경로만 옛 규칙 | K11·K13·K16 |
| M5 번역문 경로만 옛 규칙 | K11b·K16 |
| M6 원문 경로가 음성을 안 지움(옛 `if (v) setVoice`) | K13 |
| M7 억양 묶음을 스크립트+지역으로 | K8 |
| M8 사라짐을 목록 안정 전에도 | K19 |
| M9 표 안내 경로만 옛 규칙 | K11·K16 |

## 9. headless Edge (412×915, 흉내 음성 = Nour 목록 모양, 흉내 키·흉내 번역 응답 — 진짜 키 없음)

새 프로필 2개(`b8k/p1` — 첫 실행이 아래 실행기 문제로 중간에 끊김, `b8k/p2` — 본 실행). 8000번 python 사용. 결과 `scratchpad/b8k/hl.json`, 스크린샷 `scratchpad/b8k/shots/`.
- A 기본: ▶ → 원문 `[en-US, null]` · 번역문 `[ar-SA, null]` ✔
- B 설정(ko): en 11줄(휴대폰 1 + 억양 5 + 이름 5, "오스트레일리아/영국/인도/나이지리아/미국 억양"), ar 1줄 + 빈 목록 안내, 안내 한 줄 = ko 키 ✔. [들어 보기] 억양 en-GB `[en-GB, null]` · 목소리 en_GB `[en-GB, urn:en_GB]` · 휴대폰 `[en-US, null]` · ar `[ar-SA, null]` ✔
- C 고르기 뒤: en 목소리 en_GB + 번역 언어 ko + ko 억양만 → 원문 `[en-GB, urn:en_GB]` · 번역 띠 낭독 `[ko-KR, null]` ✔ · ko 목소리 고름 → 번역문 `[ko-KR, urn:ko_KR]` ✔
- D 퀴즈: 앱의 `applyQuizSpeech`(import map 으로 같은 모듈) + 앱 설정 → `[en-GB, urn:en_GB]` ✔ (CMDT 에 퀴즈 문항이 없어 퀴즈 화면 단추는 못 누름 — 배선은 K16 소스 고정)
- E 사라진 음성 ✔(위 6) · F 휴대폰 설정으로 되돌림 → 저장 `''`, 원문 `[en-US, null]`·번역문 `[ar-SA, null]` ✔
- G 아랍어 UI: `rtl ar`, 412/412 · 360/360, 안내 한 줄 = ar 키 ✔; ko 360 도 360/360 ✔
- 회귀: **8i-3** 60쪽 ▶ → 61쪽 발화 계속(`[en-US, null]`) ✔ · **8g** "fever" 검색 → 59쪽 결과 이동 → ▶ → 59쪽에서 speaking ✔ · **8l** 글자 없는 PDF(▶ 안내) → `idle`·발화 0·`reader.scan.noRead`·쪽 그대로 ✔. 앱 콘솔 오류 0. (8l 회귀 PDF 는 CMDT 만 쓰라는 지침에 따라 스크래치패드에서 손으로 만든 3쪽 빈 PDF `b8k/blank-3p.pdf` — 판정 `notext` → 스캔본과 같은 ▶ 갈래.)
- 표 안내 경로는 headless 에서 표 쪽을 따로 찾지 않았다 — node K11·K12 가 실제 speaker 로 고정.

실행기 메모: Edge 실행 파일이 곧바로 넘겨주고 끝나는 상태(대기 중 갱신 155.0.4283.62)라 `puppeteer.launch` 가 "code 0" 으로 실패하고 브라우저만 남았다 → 그 브라우저(내 프로필, PID 42204)는 `taskkill` 로 정리, 이후 Edge 를 직접 띄우고(고정 포트 9337) `puppeteer.connect`. puppeteer-core 는 예전 `scratchpad/shot-tool` 이 없어져 `C:/Users/YDC/product-builder-lesson/node_modules/puppeteer-core`(이미 설치된 것)를 **읽기만** 했다(설치·다운로드 없음). 스크래치패드의 `rm -rf p1`(빈 폴더 정리용, 불필요)이 훅에 막혀 그 줄을 빼고 진행했다 — 변형 명령은 쓰지 않았다.

## 10. spec 정정 줄

- 19-1-1 "8k 수용 기준" 아래 `[정정 2026-10-21 — 8k Build]`: 기본 태그 네 경로 공통 · `SPEECH_DEFAULT` 한 곳 · 2절 근거 행 번호 → 새 함수 이름 · `setTrVoice` 세 번째 인자 · 번역 언어 변경 재선택(8b-1 결함).
- 19-1-2 3절 "크기 영향" 아래 `[정정 2026-10-21 — 8k Build]`: `resolveSpeech` 반환(`via`·`missing`) · accent 비여과 · 꼬리표 정규화와 억양 = 언어-지역 · 목소리 고르면 억양도 저장 · [들어 보기] 키 재사용 · 새 i18n 키 13개.

## 11. 남은 프로세스

내가 띄운 Edge 0(명령줄에 `b8k` 가 든 프로세스 없음 확인). node 0. **8000번 python 은 이번에 내가 레포 루트에서 띄웠다(PID 15088 이 없었음) — 지금 PID 30352, 끄지 않고 켜 둠.** 8123·8124·8125 손대지 않음(시작 때도 떠 있지 않았음).

## 12. Nour 결과(점검표 2)가 오면 바꿀 수 있는 자리

- `js/tts/voices.js` **`SPEECH_DEFAULT`** 한 줄:
  - "voice 없이"가 휴대폰 목소리와 다르고 [이전 규칙]이 맞으면 → `voice: 'pick'`(E1 (나) — 기기 내장 음성 먼저). 테스트 K1·K2 등의 기대값을 함께 바꾼다.
  - 지역 없는 `en` 이 휴대폰 목소리와 같고 `en-US` 는 다르면 → `tag: 'bare'`.
  - 언어별로 지역 태그만 바꿀 일이면 `config.js` `TTS_LANG_REGION`·`READALONG.TR_LANG_REGION`(이번 범위 밖 — 다음 Build 에서).
- "억양만"(`en-GB` 태그)이 Android 에서 실제로 그 억양이 아니면: 설정 화면에서 억양 머리 줄을 숨기는 것은 `voiceChoiceRows` 의 accent 줄 생성 한 곳(8k Review 에서 정함, spec 19-1-2 3절 5 `[M]`).

## 13. 남은 문제 · 확인 못 한 것

- `[M]` 실기기(Realme·Galaxy): 휴대폰 TTS 설정에서 목소리를 바꾸면 앱 낭독도 바뀌는가, "억양만"이 실제 억양인가 — 점검표.
- 퀴즈 해설 [읽기] 단추를 화면에서 누르는 확인은 못 함(CMDT 2026 에 퀴즈 문항 없음) — 함수는 headless·node, 배선은 소스 테스트.
- `js/ui/reader.js` 686행 주석이 아직 "`pickVoice(sourceLang())`"라고 쓴다 — 이번 수정 범위 밖이라 두었다(동작 무관).
- 설정 카드는 `speechSynthesis` 가 없는 브라우저에서도 보인다(언어마다 "목록에 없음" 안내만) — 리더의 `reader.tts.unsupported` 배너와 따로 논다.
- 아랍어·프랑스어 새 문구는 Nour·운영자 검토 전.
- 시험 프로필 `b8k/p1`(중간에 끊긴 첫 실행)·`b8k/p2` 가 스크래치패드에 남아 있다(CMDT 2026 한 권씩, p2 에 빈 PDF 두 개).
