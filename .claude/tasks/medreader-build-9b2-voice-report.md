# Build 보고서 — 9b-2 음성 명령: 화면·배선 + 오탐 규칙 (9b-1 손질 포함, 함께 배포)

> 지침: `.claude/tasks/medreader-build-9b2-voice.md` · 설계: spec 17-1-2(9b-D1–D14 권장안) + 운영자 결정 2026-11-15(①·②). 2026-11-15.
> **커밋하지 않음.** `spec.md`·`review.md`·`dev/` 무변(review.md 의 `M` 은 9b-1 Review 몫 — 손대지 않음). 스크래치 `b9b2/`.
> 오케스트레이터 중간 지시 2건 반영: 좁은 바 = **속성 하나**(`data-bar-tight`) · 915×412 가로 측정(아래 4-2).

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/voice/commands.js` | 결정 ①(한 낱말 동의어 포함 일치는 말 ≤ `VOICE.PART_MAX_WORDS`=3) · 결정 ②(`NEGATORS` — 맞은 구 **밖** 부정어 → 그 대안 무효, trace `negated`) · 표 손질(아래 2) · `MAX_ALTS = VOICE.MAX_ALTS` |
| `js/voice/listen.js` | `LISTEN_DEFAULTS = VOICE`(config 한 곳) · 낮음-3(`emit('fallback')` 뒤 `if (press !== p) return;`) · 낮음-4(`onresult` 의 `loadTag()` 를 try 안으로) · UI 계약 주석 |
| `js/ui/voice.js` **(새)** | 흐름 `createVoice`(전역 0 — 주입만) · `mountVoice`(마이크 단추 56px [속도] 뒤 · 상태 줄 · 고지 카드) · `createTry`/`buildVoiceSettings`(설정 "음성 명령" 묶음·[말해 보기]·[결과 복사]·명령 목록) · 최근 기록(메모리 10) · `barTight()` |
| `js/ui/controls.js` | 배선(`createVoice` 1회 — speaker·`pressPlay`·`syncReadalong`·`paintRate`·`setReadalongMode`·`lastOnMode` 주입) · `pressPlay()` 첫 줄 `cancelVoice()`([▶]·9a play 공통) · [이전]·[다음]·줄 탭 첫 줄 취소 · `leaveControls` 에서 `voice.leave()`(stop 앞) · hidden → `voice.onHidden()` · `onPageRender` → `voice.arm()` · `__medreader.voice()` · 9a 에 `isListening`·`cancel` 주입 |
| `js/ui/handsfree.js` | 주입 2개(`isListening`·`cancel`) + `handle()` 첫 줄 취소(4줄) |
| `js/tts/speaker.js` | **`again()` 하나**(본문 7줄 + 공개 1줄) |
| `js/ui/settings.js` | `setReadalongMode` export(저장 + `readalong.lastOn` + 줄 다시 그리기 — 화면 단추도 이 길) · `lastOnMode` export · "음성 명령" 카드 배선(`els.voiceCmd`) · `showSettings` 의 `#/settings/voice` |
| `js/config.js` | `VOICE`(아래 3) — `EN_TAG: TTS_LANG_REGION.en`, `RETRY_WAIT_MS: 300` |
| `js/settings.js` | 9-3 키 6개: `voice.enabled`·`voice.cmdLang`·`voice.tag`·`voice.noticeAt`·`voice.sayErrors`·`readalong.lastOn` |
| `js/i18n/{en,ko,fr,ar}.js` | `voice.*` 48키 × 4 — fr·ko 실제 번역, ar 전부 `[검토 — Nour·운영자]` |
| `css/reader.css` · `css/screens.css` | 마이크 단추·듣는 중 맥박(움직임 줄이기 = 정지 테두리)·`[data-bar-tight="on"]`·상태 줄·고지 카드(세로 ≤ 500px 이면 상단 바 아래로)·설정 카드 |
| `index.html` | stamp 만(정적 그릇 0 — 단추·카드·설정 묶음은 JS 가 만든다, 반쪽 캐시 대비) |
| `tests/voice-commands-9b.test.mjs` | C12–C15 더함(말뭉치·부정문·결정 ①) |
| `tests/voice-listen-9b.test.mjs` | L14 더함(낮음-3·4·MAX_ALTS 한 곳) |
| `tests/voice-ui-9b.test.mjs` **(새)** | U1–U11 · W1–W4 (15 test) |

`ai/readalong.js`·`ui/trband.js`·`ui/inlinetr.js`·`ui/reader.js`·퀴즈·6-4 hidden 핸들러 무변. DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변. AI 호출 0.

## 2. 매칭 — 오탐·부정문 결과 (9b-1 Review 말뭉치 `r9b1/corpus.mjs` 114 + `neg.mjs` 15, 한 대안씩)

| 갈래 | 수 | 9b-1(Review) | **9b-2 지금** |
|---|---|---|---|
| 명령 의도 — 맞음 | 62 | 49 | **62** |
| 명령 의도 — 혼동(다른 명령) | | 0 | **0** |
| 명령 의도 — 놓침 | | 13 | **0** |
| 명령 아님 — **오탐** | 43 | 22 | **4** |
| 두 명령 한 문장 — 무효 / 하나 고름 | 9 | 3 / 6 | 4 / 5 |
| 부정문 — **반대 뜻** | 15 | 8 | **0**(15 모두 null) |

- 남은 오탐 4(전부 3낱말 이하 + 뜻이 둘인 한 낱말 — `C13` 이 목록 그대로 고정, `[검토 — Nour]`): «رح ارجع عالبيت»→prev · «توقف القلب المفاجئ»→pause · «القصة المرضية السابقة»→prev · «خفف الجرعة»→slower.
- 표 손질(Review `alt` + 몇 개): pause «استنى شوي»·"wait a second/minute" · again «عيدها»·"read it again"·"one more time"·"say again" · trOn «شغل ترجمة»·«افتح ترجمة»·"turn on translation" · trOff **«وقف ترجمة»**·«سكر ترجمة»·«طفي ترجمة»·«شيل الترجمة»·"turn off translation" · prev «رجعني» · faster «زيد السرعة»·"speed it up" · slower «نزل السرعة». **exact 더함**: «شغل»(=شغّل)·«تابع»·«بعده»·«بعدها»·«قدام»·«ورا»·«ترجمة»·«ترجم»·«بسرعة». 겹침 0(C3)·전수 일치(C4) 그대로.
- 부정어(`NEGATORS`, `[검토]`): en `not·never·dont·don't·do not·doesn't·didn't·won't·can't·cannot` · ar `لا·ما·مش·مو`. 동의어 낱말과 겹치지 않음(C14 가 검사). «بلا ترجمة»·"no translation" 은 동의어 안이라 trOff 그대로.

## 3. `config.js` `VOICE`

`LISTEN_MAX_MS 8000 · SAY_MAX_MS 4000 · MAX_ALTS 5 · AR_TAGS [ar-SY, ar-JO, ar] · EN_TAG = TTS_LANG_REGION.en · RETRY_WAIT_MS 300 · HISTORY 10 · CONFIRM_MS 2000` + Build 가 더한 셋: **`NOTICE_MS 8000`**(실패 안내 줄 유지 시간) · **`PART_MAX_WORDS 3`**(결정 ①) · **`BAR_TIGHT_MEDIA '(max-width: 400px)'`**(좁은 바 조건 — 8e 가 조건만 더해 다시 쓸 자리).

## 4. 검증

### 4-1. 수용 기준(17-1-2 9절 `[N]`)

| 기준 | 결과 | 테스트 |
|---|---|---|
| V1 정규화·foldArabic 한 벌 | ○ | C1·C2 |
| V2 표 전수·겹침·exact | ○ | C3·C4·C5·C15 |
| V3 가장 긴 구·모호·숫자 | ○ | C6·C15 |
| V4 대안 순서·nomatch | ○ | C7·C14 |
| V5 사다리 | ○ | L3–L6 |
| V6 오류 분류 | ○ | L7·L8 |
| V7 같은 동기 호출 안 pause → start · next | ○ | U1·U2 (+ 변이 M5) |
| V8 되돌림 · pause 유지 · hidden | ○ | U3 |
| V9 again 원문부터 | ○ | U4·U11 |
| V10 trOff/trOn(lastOn)·syncReadalong 1회·속도 | ○ | U5 |
| V11 겹침([▶]·9a·두 번째 탭·start 재호출) | ○ | U6 (진짜 `createHandsfree`) |
| V12 반복 안내 금지·미지원 | ○ | U7 |
| 기존 테스트 전부(tts-speaker·speaker-tr·pageturn-8i3·handsfree-9a) | ○ | 전체 |
| 새: 말뭉치 명령/명령 아님/부정문 고정 | ○ | C12·C13·C14 |

### 4-2. 실행

| 실행 | tests | pass | fail |
|---|---|---|---|
| 시작 전 전체 | 1435 | 1430 | 5(IM — 9b-1 몫) |
| 전체 1회 | **1455** | **1455** | **0** |
| 전체 2회 | 1455 | 1455 | 0 |
| 마지막 CSS 손질 뒤 전체 | 1455 | 1455 | 0 |

새 20 = C12–C15(4) + L14(1) + U1–U11·W1–W4(15). **IM 5개 풀림**(stamp — 모듈 65). `stamp --check` 0 · `git diff --check` 0 · 새 파일 끝 공백 0.

**headless Edge**(`b9b2/v.mjs` · 새 프로필 `b9b2/p1` · 포트 9492 · 가짜 키 · 흉내 음성 · 흉내 Gemini(OPTIONS 처리) · **가짜 `SpeechRecognition` 페이지 주입** · CMDT 150쪽 · 결과 stdout `run3.json`(+ 마지막 `run4.json`)):

| 항목 | 결과 |
|---|---|
| 마이크 크기·자리 | 56×56 · ko/en/fr 오른쪽 끝, **ar 왼쪽 끝(거울)** · 바 높이 61 그대로 |
| 가로 넘침 | 412·375·360 × ko·ar·en·fr 12칸 전부 바 `scrollWidth−clientWidth` 0 · 문서 0 · 단추 전부 화면 안. 412 = `tight off`(진행 표시 42–80px 보임), 375·360 = `tight on`(진행 시각적 숨김, aria-live 남음, 버튼 48–66px) |
| **915×412 가로**(오케스트레이터) | 마이크 56×56 @(256,277)–(312,333) 화면 안 · 고지 카드 512×222 @(202,57)–(714,279) 화면 안·카드 안 스크롤 0 · [시작] 66×48 화면 안 · 가로 넘침 0. (처음 실행에서는 카드가 바 위 118px 에 끼어 안 스크롤 104px → 세로 ≤ 500px 이면 상단 바 아래로 띄우게 고침) |
| 고지 카드 처음 한 번 | 낭독 중 첫 탭 → 카드만(인식 start 0, 낭독 그대로) → [시작] → 그 탭 안에서 start 1(`en-US`·max 5·continuous false·interim false, 그 순간 speaker `paused`) · `voice.noticeAt` 기록 · 다음부터 카드 없음 |
| 명령 9개 | next 1→2 speaking · prev 3→2 · again 3→3 · pause → paused 유지 · play(멈춤에서) → speaking · slower 1.0→0.75 저장 · faster →1.0 · trOff show→off(lastOn show) · trOn → show(띠 보임 `ready`) · 멈춤에서 next → 하이라이트만(paused@4) · explain → "아직 없는 기능" |
| 듣는 중 낭독 멈춤 → 명령 뒤 이어 읽기 | 위 전부 탭 순간 `paused`, 명령 뒤 `speaking` |
| 실패 안내 | network → 상태 줄(이어폰 문구 포함) + 한 마디(ko-KR, UI 언어) → 끝나자 speaking@다음 · 같은 network 두 번째 → UI 언어 한 마디 0, 곧장 되돌림 · nomatch → [명령 보기] 보임 → 되돌림 · "don't stop" → 실행 0 → 되돌림 |
| 9a 겹침 | 듣는 중 [▶] → abort 1·speaking · 듣는 중 Media Session `play` 핸들러 → abort 1·speaking · 두 번째 마이크 탭 → abort 1·paused(되돌림 없음) · hidden → abort·paused |
| 아랍어 UI | 첫 태그 `ar-SY` · «التالي من فضلك» → next · `voice.tag`=ar-SY 기억 |
| [말해 보기] | `#/settings/voice` → 카드로 굴림·명령 목록 열림 · start 1 → 대안 3줄 + "다음 문장 · 2번째 대안 · en-US · 71ms" · 실행 0 |
| 회귀 | 띠(band) `ready` · 8d 문장 아래 블록 58개 · 8i-3 쪽 끝 "next"(읽는 중) → 150→151쪽 speaking |
| 콘솔 오류 · 페이지 오류 | **0 · 0**(첫 실행에서 `els.voice` 이름 충돌 1건 → `els.voiceCmd` 로 고침) · 외부 요청 = pdf.js CDN 둘(기존) |

스크린숏 `b9b2/shots/`: `1-notice-ko-412.png`(고지 카드) · `2-listening-ko-412.png`(듣는 중) · `3-error-ko-412.png`(실패 안내) · `4-ar-412.png` · `5-landscape-915.png` · `6-settings-try-ko.png`.

### 4-3. 변이 (`b9b2/mutate.mjs` · 백업 `b9b2/bak/` · 복원 = 백업 읽어 쓰기 + 바이트 비교)

| # | 변이 | 결과 | 복원 |
|---|---|---|---|
| M1 | 결정 ① 3낱말 제한 끄기 | 빨강 C13·C15 | cmp 같음 |
| M2 | 결정 ② 부정어 무효 끄기 | 빨강 C14·U9 | 같음 |
| M3 | `again()` 이 phase 를 안 되돌림 | 빨강 U4·U11 | 같음 |
| M4 | 듣는 중 [▶] 취소 빼기(pressPlay 첫 줄) | 빨강 W1 | 같음 |
| M5 | start 를 pause 앞으로 | 빨강 U1 | 같음 |
| M6 | 안내 반복 금지 끄기 | 빨강 U7 | 같음 |
| M7 | 되돌림 삭제 | 빨강 U3·U4·U5·U7·U9 | 같음 |
| M8 | handsfree 첫 줄 취소 빼기 | 빨강 U6·W2 | 같음 |
| M9 | listen fallback 가드 빼기(낮음-3) | 처음 **초록** → L14 더함 → 빨강 | 같음 |
| M10 | loadTag 를 try 밖으로(낮음-4) | 빨강 L14 | 같음 |

10/10 빨강 · 끝난 뒤 앱 파일 6개 백업과 `cmp` 다시 같음.

## 5. 설계에서 정한 것 · 달라진 것 (Review 가 볼 곳)

| # | 무엇 | 이번 구현 · 이유 |
|---|---|---|
| D1 | 정적 HTML | 마이크·상태 줄·고지 카드·설정 묶음 **전부 JS 가 만든다**(index.html 은 stamp 만) — 기능 감지가 참일 때만 단추, 반쪽 캐시(옛 HTML+새 JS) 안전. spec 7 "index.html — 바에 단추 1개·고지 카드 자리"와 다름 |
| D2 | [▶] 첫 줄 취소 | `els.play` 의 `pressPlay` 줄은 9a 테스트(W1·SC15)가 고정 → **`pressPlay()` 본문 첫 줄**에 `cancelVoice()`. 9a 이어폰 play 도 같은 함수라 한 줄로 둘 다 |
| D3 | 줄 탭 | 지침 목록 밖이지만 듣는 중 줄 탭이 `speaker.play(lineId)` 로 읽기를 시작해 TTS 가 마이크로 들어간다 → 첫 줄 취소 더함. 그리고 **speaker `statechange` 가 읽는 중이 되면 듣기 취소**(다른 모든 길의 그물) |
| D4 | `isListening()` 의 뜻 | 9a 에 주는 `isListening` = 듣는 중 **또는 실패 안내 뒤 되돌림 대기**. 안내 중 이어폰으로 멈췄는데 4초 뒤 되돌림이 읽기를 다시 켜는 일을 막는다 |
| D5 | 읽던 중 next 가 쪽 끝 | 멈춘 채 `next()` 는 쪽을 넘기지 않는다(9-D5) → `was` 가 읽는 중이고 인덱스가 그대로·마지막이면 `pressPlay()` 후 `next()`(화면 [다음] 과 같은 길 — 8i-3 쪽 넘김). 그 순간 지금 문장 발화가 곧장 취소된다(실기기 V-5) |
| D6 | trOn/trOff 의 syncReadalong | 읽던 중이면 되돌림의 `pressPlay()` 안에서 한 번, 아니면 직접 한 번 — 어느 쪽이든 1회(V10) |
| D7 | 안내 한 마디 문장 | 상태 줄 문장은 길다(4초 상한에 잘림) → 말은 짧은 키: 인프라 `voice.say.fail` · 못 맞춤 `voice.noMatch.say` · 속도 끝 `voice.rate.min/max` · explain `voice.notYet`. 목소리 = `langSpeechOf(uiLang)`(8k) |
| D8 | 안내 반복 금지 | 세션 동안 **같은 인프라 코드**는 두 번째부터 음성 없이(다른 코드는 첫 번째 취급) |
| D9 | `aborted`(우리가 안 부른 중단) | 문구 없이 되돌림(9b-1 B5 제안) · `fallback` = 상태 줄 "다시 말해 주세요", 소리 없음(마이크에 들어간다) |
| D10 | 안내 중 다시 탭 | 한 마디를 거두고 그 누름의 `was` 를 이어받아 다시 듣는다 |
| D11 | 고지 카드 [취소] | 듣지 않고 닫음. 카드가 떠 있는 동안 낭독은 그대로(멈추지 않음) |
| D12 | [명령 보기] | `#/settings/voice` — 라우터가 이미 tab 을 넘긴다. 설정에 카드로 굴리고 목록 열기 |
| D13 | 설정 "음성 명령" 자리 | 낭독 목소리 카드(`#settingsVoices`) 바로 뒤 카드 하나(`#settingsVoice`). 명령 언어 단추 = auto·العربية·English(기존 `onboarding.lang.*` 키) |
| D14 | i18n 수 | spec "약 22키" → 48키(오류 7·명령 10·설정 11·[말해 보기] 3·고지 4 …) |
| D15 | `voice.noticeAt` 저장 값 | `Math.max(1, now())` — 0 은 "아직" |

## 6. 마지막 실기기 점검 묶음 (17-1-2 9 V-1~V-10 + 9b-1 ★ + 9b-2 ◆)

| # | 볼 것 | 어디서 |
|---|---|---|
| V-1 | 쓰인 태그(`tried`·`tag`)·사다리 · 조용한 언어 바뀜 · ★ language-not-supported 가 듣기 전에 오나 · ★ 300ms 상한 · ★ `available()` 유무·답 | [말해 보기] [결과 복사] |
| V-2 | VPN 켬/끔 성공 / `network` (Nour) | [말해 보기] |
| V-3 | 누름 → 결과 ms 중앙값 | [말해 보기] |
| V-4 | 9개 × 2번 — 맞은 비율·대안 번호·못 맞춘 말 · ★ 확신도 1.0 채움 · ★ exact 낱말 혼자 · ◆ **부정문**("don't stop"·«لا توقف»·«ما بدي ترجمة») · ◆ **두 뜻 낱말**(«شغل»·«بعده»·«ارجع»·«توقف»·«السابقة»·«خفف») · ◆ 부정어가 첫 대안에만 있고 둘째 대안에서 빠지는가(아래 7-1) | [말해 보기] [결과 복사] |
| V-5 | 낭독 꼬리가 인식 글자에 섞이나 · 명령 뒤 이어 읽기 · ◆ 쪽 끝 "next" 때 짧은 소리 튐(D5) · ◆ 실패 안내 한 마디(UI 언어 목소리)가 들리고 끝나면 이어 읽나 | 리더 |
| V-6 | 이어폰 마이크 | 리더 |
| V-7 | 9a 무음 오디오 뒤 알림·이어폰 단추 · ◆ 듣는 중 이어폰 ⏯ → 듣기 취소 후 재생 | 리더 |
| V-8 | 첫 권한 대화·거부 뒤 안내·비행기 모드 · ★ 권한 거부가 onstart 없이 오나 · ★ 다른 앱 마이크 사용 중 busy/mic · ★ 사이트 허용 + Chrome 앱 마이크 끔 → busy 오안내? · ◆ 고지 카드 [시작] 뒤 곧장 권한 대화가 뜨나(제스처 유지) | 리더 |
| V-9 | 이어폰 길게 누름 | 9a-0 · 리더 |
| V-10 | 듣는 중 화면 끄기 → 조용한 취소 · ★ aborted 와 겹쳐도 cancel 하나 | 리더 |
| ◆V-11 | Fold 7 접은 화면(≈ 360–375px)·펼친 화면에서 바 한 줄 · 좁은 바(`data-bar-tight`)가 켜지는 폭이 맞나(`BAR_TIGHT_MEDIA`) · 가로 화면 고지 카드 | 리더 |

## 7. 남은 문제 · 위험

1. **부정문과 대안 순서(결정 ② 글자 그대로)** — "그 대안을 무효"라 첫 대안 "don't stop" 이 무효면 **둘째 대안 "stop" 이 맞으면 멈춤**(C14 가 이 동작을 고정·기록). 인식기가 둘째 대안에서 부정어를 떨어뜨리면 반대 뜻이 된다. 대안: "부정된 대안이 하나라도 있으면 그 누름 전체 무효" — 운영자 결정 거리(V-4 자료로).
2. 남은 오탐 4(2절) — 3낱말 이하 한 낱말 동의어. «ارجع»·«توقف»·«السابقة»·«خفف» 를 exact 로 하면 막히지만 «ارجع ٣ جمل»·«خفف السرعة» 같은 명령이 놓친다 — Nour 발화로 정할 것.
3. 아랍어 동의어·부정어·군말·i18n 아랍어 문구 전부 `[검토 — Nour·운영자]`.
4. `busy`/`permission` 휴리스틱(9b-1 B4) 그대로 — 9b-2 가 `navigator.permissions.query({name:'microphone'})` 를 리더 진입 때 물어 `micState` 를 채운다(Chrome Android 지원은 V-8).
5. 3회째 headless 뒤 CSS 한 줄(`word-break: keep-all` — 한국어 고지 카드 줄바꿈)을 더했고, 전체 테스트·stamp·headless 4회째(`run4.json`)를 다시 돌려 같은 결과(넘침 0 · 가로 카드 안 스크롤 0 · 두 번째 network 한 마디 0 · 쪽 넘김 · 콘솔·페이지 오류 0)를 확인했다. 스크린숏은 4회째 것.
6. 9b-3(이어폰 길게)·`voice.earLong` 키는 넣지 않았다(조건부 단계).

## 8. spec 정정 줄 초안 (spec 은 고치지 않았다 — 8e Plan 이 쓰는 중)

붙여 넣을 꼴:

- **17-1-2 3절 "마이크 단추의 크기·자리"** 끝에: "`[9b-2 Build]` 단추·상태 줄·고지 카드는 `ui/voice.js` 가 JS 로 만든다(정적 HTML 그릇 없음 — 기능 감지 참일 때만). 좁은 바는 속성 하나 `.tts-bar[data-bar-tight="on"]`(진행 표시 시각적 숨김 + 버튼 여백 축소), 켜는 조건은 `VOICE.BAR_TIGHT_MEDIA`(`(max-width: 400px)`) + 마이크 보임 — 실측 412 off · 375·360 on, 12칸 넘침 0."
- **3절 "9a 단추와의 관계"**: "[▶]·9a play 는 `pressPlay()` 첫 줄 · [이전]·[다음]·줄 탭은 핸들러 첫 줄 · 9a 는 `handle()` 첫 줄에서 `voice.isListening()`(듣는 중 **또는 실패 안내 뒤 되돌림 대기**)이면 `cancel()`. 그 밖의 길로 읽기가 시작되면(statechange → 읽는 중) 듣기를 스스로 취소한다."
- **4절 "매칭" 1** 에 더함: "**`[운영자 결정 2026-11-15 ①]`** 한 낱말 동의어의 포함 일치는 말 전체(군말·숫자 뗀 뒤)가 `VOICE.PART_MAX_WORDS`(3) 낱말 이하일 때만 — 전체 일치는 그대로. **`[결정 ②]`** 맞은 구(같은 명령 같은 길이 꼴 전부)가 덮은 자리 **밖**에 부정어(`NEGATORS` — en not·never·dont·don't·do not·doesn't·didn't·won't·can't·cannot / ar لا·ما·مش·مو `[검토]`)가 있으면 그 대안 무효(trace `negated`, 다음 대안으로). «بلا ترجمة»·"no translation" 처럼 부정어가 동의어 안이면 그대로."
- **4절 "가장 긴 동의어"** → "**낱말 수**가 가장 많은 동의어"(9b-1 B7).
- **4절 예 «التالي والسابق»** → 실제 결과 `next`(낱말 일부 일치 없음 — «والسابق» 은 후보 아님). 모호의 예는 «التالي السابق»·«التالي و السابق». 한 줄 더함: "두 명령이 한 문장이면 같은 길이 = 모호(무효), **둘째 동사에 و 가 붙으면 처음 것**(«وقف وارجع» → pause)."
- **4절 아랍어 태그 사다리**: "곧장 다시 `start()`" → "앞 인식기의 `end`(상한 `VOICE.RETRY_WAIT_MS` 300ms) 뒤 다시 `start()`". 덧붙여 "`available()` 이 전부 `'unavailable'` 이면 믿지 않고 전부 시도" · "기억한 태그부터 끝까지 실패하면 기억을 지운다"(9b-1 B1–B3).
- **4절 명령 표 · exact 목록**: `exact` = «يلا»·go·«شغل»(شغّل)·«تابع» / «بس»·«خلص»·«لحظة»·«استنى»·wait / «بعده»·«بعدها»·«قدام» / «ورا» / «الترجمة»·«ترجمة»·«ترجم» / «بسرعة». 더한 동의어: pause «استنى شوي»·wait a second·wait a minute · next — · prev «رجعني» · again «عيدها»·read again·read it again·one more time·say again · trOn «شغل ترجمة»·«افتح ترجمة»·turn on translation · trOff «وقف ترجمة»·«سكر ترجمة»·«طفي ترجمة»·«شيل الترجمة»·turn off translation · slower «نزل السرعة» · faster «زيد السرعة»·speed it up. 전부 `[검토 — Nour·운영자]`.
- **5절 표** 행 더함: "**인식기 바쁨** | `not-allowed` + (마이크 권한 granted · 듣기 시작 뒤 · 이번 세션에 결과 받은 적 있음) | `voice.err.busy` + 이어폰 문구 | 한 마디 | 남김" · "**시스템 중단** | `aborted`(우리가 부르지 않음) | 없음 | 없음 | 되돌림". "말 없음" 행 감지에 "결과 없이 `end`" 더함.
- **5절 "음성 한 마디"**: "말은 짧은 키 — 인프라 `voice.say.fail` · 못 맞춤 `voice.noMatch.say` · 속도 끝 `voice.rate.min/max` · explain `voice.notYet`(상태 줄 문장은 길어 4초 상한에 잘린다). 반복 금지는 **같은 인프라 코드** 기준(세션)."
- **3-2 import 방향 표** 두 줄: "`voice/commands.js` — 순수 · `text/specialty.js`(`foldArabic`)·`config.js`(`TTS.RATE_STEPS`·`VOICE`)" · "`voice/listen.js` — 서비스 · `config.js`(`VOICE`)". ui 행에 `ui/voice.js`(config·i18n·settings·voice/*).
- **7절 새 파일 행**: `voice/commands.js` 는 "`foldArabic` 만" → "`foldArabic` + `config`(`TTS.RATE_STEPS`·`VOICE`)". `createListener` 의존성에 `onLine`·`micState`·`loadTag`·`saveTag`·`now`, 이벤트에 `cancel`·`fallback`·`end{outcome}`.
- **7절 `config.js` 행**: `VOICE = { LISTEN_MAX_MS 8000, SAY_MAX_MS 4000, MAX_ALTS 5, AR_TAGS, EN_TAG: TTS_LANG_REGION.en(값을 다시 적지 않는다 — W1), RETRY_WAIT_MS 300, HISTORY 10, CONFIRM_MS 2000, NOTICE_MS 8000, PART_MAX_WORDS 3, BAR_TIGHT_MEDIA '(max-width: 400px)' }`.
- **7절 "고치는 파일"**: `index.html` → "stamp 만(그릇은 JS)". `ui/settings.js` → "`setReadalongMode`·`lastOnMode` export — 화면 단추도 같은 길" · "음성 명령 카드는 `ui/voice.js` 의 `buildVoiceSettings`(낭독 목소리 카드 뒤)".
- **7절 i18n 행**: "약 22키" → "48키(`voice.*`)".
- **9-3 설정 키**: `voice.enabled: true` · `voice.cmdLang: 'auto'` · `voice.tag: ''` · `voice.noticeAt: 0` · `voice.sayErrors: true` · `readalong.lastOn: 'speak'`(모드를 고를 때마다 켜진 모드를 기억 — 화면 단추·음성 명령 공통). (`voice.earLong` 은 9b-3)
- **9절 점검 묶음**: V-4·V-5·V-7·V-8 에 6절의 ◆ 항목, 새 행 V-11(접은·펼친·가로 화면 바·카드).
- **10절 테스트**: `voice-commands-9b` C12–C15(말뭉치·부정문·결정 ①) · `voice-listen-9b` L14 · `voice-ui-9b` U1–U11·W1–W4.
- **6-4 표 마지막 행**: "오프라인이면 버튼 비활성" → "9b 는 막지 않고 시도 → 실패 시 안내(9b-D9)".
