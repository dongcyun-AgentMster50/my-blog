# Build 지침 — 8k 낭독 목소리: 휴대폰 설정 따름 + 언어별 고르기 + 억양(O3)

> 너는 **Build 서브에이전트**다. 운영자가 8k 를 지금 진행하기로 했다(2026-10-21). 승인된 설계: spec **19-1-1 E1 (가)**(기본 = 휴대폰 설정 따름 — voice 지정 없이 lang 만, + 언어별 고르기 목록 + [들어 보기]) · **19-1-2 3절 "8k 범위에 더할 것"**(O3 — 언어 → 억양 → 이름, "억양만" 선택지, 성별 표시 없음 + 휴대폰 설정 안내, `resolveSpeech`, 지침 문안 1–6 — **그대로 따른다**) · O-D7 (가). 8j·8l 은 배포됨.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8k-report.md`.
> Nour 의 실기기 결과(점검표 2 — 어느 단추가 휴대폰 목소리와 같은지·전환 간격)는 **아직 오지 않았다** — 설계는 E1 (가) 그대로 가고, 결과가 다르면 기본값만 바꿀 수 있게(설정 한 곳) 만든다.

## 반드시 읽을 것
1. **`.claude/tasks/medreader-8k-carryover.md`** — Nour Realme 실기기 사실(2026-10-21): Chrome 음성 92개 · **아랍어 음성 목록 없음**(그래도 voice 없이 `ar-SA` 로 소리 남) · **지금 앱이 영어를 `en_AU`, 프랑스어를 `fr_CA` 로 읽고 있었다**(알파벳 첫 음성) · `lang` 이 **밑줄 + 스크립트 꼬리표** 꼴(`en_AU`, `zh_HK_#Hans`, `bs_BA_#Latn`) — 앱은 `_`→`-` 만 바꾸고 `#Hans` 류는 남는다.
2. spec **19-1-1**(N2 분석: `settings.js` `tts.voice.{en,ar,fr,ko}` 기본 '' · 쓰는 화면 없음 · `pickVoice` 규칙 · `speaker.js` 373·560행 `utt.voice` 지정 · 3절 **8k 줄**과 "2 의 최소 변경 (1)–(3)") + **19-1-2 3절**(지침 문안 1–6, `resolveSpeech(lang, voices, {uri, accent}) → {voice|null, tag}` 다섯 갈래, `tts.accent.{lang}`, 수용 기준) + 6-3(목소리·`getVoices` 빈 배열 1.5초).
3. 코드: `js/tts/voices.js`, `js/tts/speaker.js`, `js/ui/controls.js`(`sync*`), `js/ui/quiz.js`(퀴즈 낭독), `js/ui/settings.js`(설정 화면), `js/settings.js`, `js/i18n/*`, `dev/voices.html`(8k-0 — 8j Review: [앱이 고른 음성]을 새 규칙 `resolveSpeech` 에 맞출지 여기서 정함 → **맞춘다**, 옛 `pickVoice` 단추는 비교용으로 남겨도 됨).

## 할 일
1. `tts/voices.js`: `resolveSpeech` (spec 다섯 갈래) + 억양 묶음 만들기(목록의 `voice.lang` 지역으로만 — 밑줄·`#스크립트` 꼬리표 정규화, 꼬리표 있는 음성은 지역을 어떻게 볼지 정하고 이유를 보고서에). 기본(고른 것 없음) = **voice 지정 없이 그 언어의 lang 만**(휴대폰 설정 따름). 아랍어는 목록이 비어도 지금처럼 voice 없이.
2. 원문·번역문·표 안내·퀴즈 낭독이 **모두 같은 `resolveSpeech`** 를 쓰게(spec 문안). 8m(O2 문장별 언어) 이 나중에 같은 함수를 쓸 수 있게.
3. 설정 화면: 언어별 [목소리] — "휴대폰 설정 따름"(기본) / 억양 묶음(머리 줄 = "억양만" 선택) / 그 아래 목소리 이름 그대로, 각 줄 [들어 보기], 성별은 표시하지 않고 "남녀 목소리는 휴대폰 설정 > 텍스트 음성 변환에서" 안내 한 줄. 412·360px, 네 언어, 아랍어 RTL. 저장 `tts.voice.{lang}`(uri)·`tts.accent.{lang}`.
4. 저장한 음성이 사라졌을 때(기기 바뀜·엔진 바뀜) — spec 갈래대로 accent → 휴대폰 설정 따름으로 내려가고 조용히(설정 화면에는 "사라짐" 표시).
5. `dev/voices.html`: [앱이 고른 음성] 을 `resolveSpeech` 기준으로(옛 `pickVoice` 단추는 "이전 규칙" 이름으로 남김), 억양 묶음 표시.
6. 테스트(spec 수용 기준: `resolveSpeech` 다섯 갈래 · 억양 묶음이 목록 지역에서만 · 밑줄·꼬리표 정규화 · Nour 실기기 목록 모양을 본뜬 픽스처(92개 중 en 5·fr 2·ko 1·ar 0, `en_AU` 가 알파벳 첫째) → 기본은 voice 없음 · 저장 uri 사라짐 · 네 경로가 같은 함수) + 화면 테스트.
7. stamp 다시, `--check` 0.

## 검증
- 변이 4개 이상(기본을 첫 음성으로 되돌리기 = 옛 버그, 꼬리표 정규화 빼기, 사라진 uri 를 그대로 쓰기, 한 경로만 옛 규칙 쓰기 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8k/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1260 + 새).
- **headless Edge**(412×915 · ko·ar · 흉내 음성 — Nour 목록 모양을 흉내 낸 `getVoices`): 기본에서 `utt.voice` 가 null·`utt.lang` 이 언어 태그인지, 설정에서 억양·목소리 고르면 낭독·번역 띠·퀴즈 낭독이 그 음성을 쓰는지, [들어 보기], 사라진 음성. 회귀: 8i-3 쪽 넘김 낭독, 8g 결과 이동 뒤 [▶], 8l 스캔본 ▶ 안내. 8000번 python(PID 15088)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 2개까지. 진짜 API 키 금지.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`js/tts/voices.js`, `js/tts/speaker.js`(음성 지정 자리만), `js/ui/controls.js`, `js/ui/quiz.js`(낭독 음성 자리만), `js/ui/settings.js`, `js/settings.js`(새 키 `tts.accent.*` 기본값), `js/i18n/*`, `index.html`(stamp·설정 자리), `css/*`, `dev/voices.html`, `tests/`, `spec.md`(19-1-1·19-1-2 안 정정 줄만), 스크래치패드 `b8k/`, 보고서. DB 버전·algoVersion·번역 캐시 키 불변. review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제. PDF 가 필요하면 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 만.
