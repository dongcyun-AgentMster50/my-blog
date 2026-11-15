# 9b Plan 보고 — 음성 명령 (2026-11-15)

> Plan 서브에이전트. 구현·커밋 없음. 바꾼 파일: `apps/medreader/spec.md` 두 곳만 — 17-1-1 다음에 **17-1-2 새 소절**(`[신설 2026-11-15 — 9b Plan, 운영자 결정 대기]`), 19-1 표 9b 행에 `[수정 2026-11-15 — 9b Plan]` 과 한 줄. 앱 코드·테스트·review.md·다른 파일 무변(작업 트리의 `js/config.js`·`js/settings.js` 수정은 9a Build 것 — 건드리지 않음). 막힌 명령 없음.
> 오케스트레이터 방침(작업 중 받음) 반영: **9b-0 실기기 진단을 Build 앞 조건으로 두지 않는다** · 기본값은 문서·폴백으로 · 실기기 확인은 "마지막 실기기 점검 묶음"으로 모아 9a-0 과 한 자리에서 · 듣기 시작 기본은 화면 마이크 단추, 이어폰 길게는 확인 뒤 켜는 설정.

## 1. 핵심 사실

**코드(`63b62c2`)**
- 음성 인식 사용 0: `js/`·`index.html` 에 `SpeechRecognition`·`webkitSpeechRecognition`·`getUserMedia`·`navigator.permissions` 없음(grep). 마이크 권한 코드도 없음.
- speaker 공개 함수: `play`·`pause`·`next`·`prev`·`setRate`(계단 `[0.5, 0.75, 1.0, 1.25, 1.5, 1.8]`) 있음. **"다시(지금 문장)" 함수는 없다** — 멈춤 + 번역 단계에서 `play()` 는 번역문을 이어 읽는다(`tts/speaker.js` 822–823). → speaker 에 `again()` 약 8줄을 권장(9b-D10).
- 번역 켜기·끄기 = 설정 `readalong.mode`(`off`·`show`·`speak`). 바꾸는 길(`onReadalongClick`·`paintAllReadalongRows`·controls `syncReadalong`)이 전부 export 되지 않았다 → `ui/settings.js` 에 `setReadalongMode()` export 하나, "끄기 전 모드" 키 `readalong.lastOn` 신설.
- 본문 손짓: 줄 `pointerup` = 탭(줄 이동), 길게 누르기는 선택·단어장(8c+8f)용 예약, 띠는 누르고 있기 → "화면 아무 곳" 손짓은 전부 겹친다.
- 하단 바 [▶] 는 56px(10b 에서 64 → 56), 바 높이 61px, 375px 에서 이미 빠듯함.
- 아랍어 접기 `foldArabic`(`text/specialty.js` 123) 이 이미 있다 → 재사용.

**Android Chrome `SpeechRecognition`(웹 조사)**
- Chrome 은 Android `SpeechRecognizer` 를 부른다. **Android 12+ 는 "Google 음성 서비스"(`com.google.android.tts`)** 가 제공자(Chromium `SpeechRecognitionImpl.java`). `EXTRA_PREFER_OFFLINE` 은 넣지 않는다.
- 서버 인식(MDN — 소리가 웹 서비스로 감). **Chrome 팀: Android·ChromeOS 는 온디바이스 Web Speech(`processLocally`) 미지원**(M150 blink-dev). 기기 언어 팩으로 오프라인 처리될 여지는 `[가정 — 실기기]`.
- `ar-SY` 는 Google Cloud 음성 언어표에 있음. Android 음성 서비스가 받는지는 미확인. 지원 안 하면 `language-not-supported`, 또는 조용히 기기 언어로 인식할 수도 `[가정]`.
- Android 오류 → 웹 오류 대응표 확보(`not-allowed` 는 권한 거부 외에 인식기 바쁨·요청 과다도 포함).
- 대안은 Android 결과 전부가 넘어오고, **확신도가 쓸 만하지 않으면 전부 1.0 으로 채운다** → 확신도 문턱은 믿을 수 없음.
- 첫 `start()` 에 권한 대화. 탭 핸들러 안에서 동기로 부르는 것이 안전(공식 문서는 못 찾음).
- 오디오 포커스 처리 없음 → 낭독 중 들으면 낭독이 마이크로 들어감 → **듣기 전에 `speaker.pause()`**. 9a 무음 오디오는 speaker 가 멈추면 같이 멈추므로 설계상 다툼 없음.
- 시리아: Gemini 는 VPN 끔 = `REGION`(실측). 음성 인식 서비스의 시리아 가용성 자료 없음 `[가정 — 실기기, VPN 켬/끔]`.

## 2. 듣기 시작 방법 — 선택지와 권장

| | 방법 | 판정 |
|---|---|---|
| (가) | **하단 바 마이크 단추**(56px, [속도] 뒤, 탭 한 번 → 말 → 저절로 끝, 다시 탭 = 취소) | **기본 — 권장** |
| (나) | 이어폰 길게 누름 | Media Session 에 길게 액션이 없고, 와도 그 안에서 `start()` 가 되는지 모른다 → **설정 `voice.earLong`(기본 끔), 실기기 점검 V-9 뒤 9b-3** |
| (다) | 이어폰 세 번 | 블루투스 이어폰은 세 번 = 이전 곡 → 9a [이전]과 겹침, 넣지 않음 |
| (라) | 화면 아무 곳 손짓 | 탭·길게·핀치·띠 누르기와 전부 겹침, 넣지 않음 |
| (마) | 볼륨 단추 | 웹으로 오지 않음 |

듣는 동안 9a 이어폰·화면 단추가 눌리면 듣기를 먼저 취소하고 단추는 평소대로("손이 이긴다").

## 3. 명령 표 요약

- 명령 9개 + 자리만 있는 1개: `play`·`pause`·`next`·`prev`·`again`·`trOn`·`trOff`·`slower`·`faster` · `explain`(꺼짐, 11a 뒤).
- 아랍어(표준 + 레반트 구어 + 화면 단추 낱말 «للأمام»·«للخلف»·«إيقاف مؤقت» + 아랍 문자 차용어 «نكست»·«ستوب»…) · 영어. 아랍어 전부 `[검토 — Nour·운영자]`. 예: 계속 «كفّي»·«كمّل», 그만 «بس»·«خلص», 다시 «عيد»·«كمان مرة», 번역 끄기 «سكّر الترجمة»·«بلا ترجمة», 느리게 «بشويش».
- 정규화: `foldArabic` + `ؤ→و`·`ئ→ي`·숫자·문장부호·소문자·군말(«من فضلك»·please…) 떼기.
- 매칭: 전체 일치 우선 → 포함 일치는 가장 긴 구가 이김, 같은 길이로 다른 명령이면 모호(무효). 짧거나 뜻이 둘인 낱말(«بس»·«يلا»·«الترجمة»)은 전체 일치만. 낱말 일부 일치·숫자("두 번 뒤로") 받지 않음.
- 대안 5개를 순서대로, 확신도 문턱 없음.
- 명령 언어 설정 `voice.cmdLang` = auto(UI 가 ar 면 아랍어, 그 밖은 영어)·ar·en. 아랍어 모드는 영어 표를 두 번째로 본다.
- 인식 태그 사다리 `ar-SY → ar-JO → ar`(같은 누름 안에서 자동, 된 태그 기억, `available()` 있으면 미리 확인).
- 뒤 상태: 명령을 실행하고 듣기 전 상태로 되돌린다(읽던 중이면 이어 읽기). `pause` 만 멈춤 유지. 멈춤 중 `next`/`prev` 는 화면 버튼처럼 하이라이트만(9-D5 와 같음).

## 4. 실패와 안내
상태 줄(14-2 방식) + 짧은 음성 한 마디(UI 언어, `voice.sayErrors` 로 끔) + 원래 상태로 되돌림. 인프라 실패(권한·서비스 없음·`network`·마이크) 문구 끝에 늘 "이어폰 버튼과 화면 버튼은 그대로 됩니다". 같은 인프라 실패 두 번째부터는 음성 없이. `network` 는 `onLine` 으로 오프라인/서버 불가를 나눔, VPN 은 말하지 않음(13절). **오프라인에서도 단추를 막지 않고 시도**(6-4 의 "비활성"을 바꿈 — 결정 9b-D9). 미지원 브라우저는 단추 없음.

## 5. 9b-0 진단 — 필요 없음, 9a-0 과 한 자리에서

- 운영자 방침대로 **9b-0 단계를 두지 않는다**. 실기기로만 답이 나오는 값(태그·VPN·지연·정확도·낭독 꼬리·이어폰 마이크·9a 와의 겹침·오프라인·길게 누름)은 모두 폴백·안내로 먼저 만든다.
- 비교: (가) 별도 9b-0 페이지 먼저 — 방침 위반, 왕복 +1 · (나) `dev/handsfree.html` 에 F 묶음 — 이미 배포된 9a-0 페이지를 다시 Build·Review·배포해야 하고, 앱 동작(정규화·되돌림·9a 겹침)은 못 봄 · **(다) 9b 배포본 설정에 [말해 보기](들은 대안 전부·맞은 명령·몇 번째 대안·태그·ms·오류, 최근 10번 [결과 복사])를 넣고, 9a·9b 배포 뒤 9a-0 페이지와 같은 자리에서 점검 묶음 V-1~V-10 을 한 번에** — 권장. Nour 에게도 아랍어 점검표 하나. [말해 보기] 결과가 동의어 표를 다듬는 재료가 된다.

## 6. 결정 표 (spec 17-1-2 12)

| # | 결정 | 권장 |
|---|---|---|
| 9b-D1 | 듣기 시작 | 화면 마이크 단추만, 이어폰 길게는 점검 뒤 9b-3(기본 끔) |
| 9b-D2 | 누르는 방식 | 탭 한 번 → 저절로 끝(다시 탭 = 취소) |
| 9b-D3 | 단추 크기·자리 | 56px, [속도] 뒤, 좁으면 진행 표시 시각적으로 숨김(17-1 원안 64px 는 바 +8px) |
| 9b-D4 | 인식 언어 | auto + `ar-SY → ar-JO → ar` 사다리, 된 태그 기억 |
| 9b-D5 | 영어 명령 | 설정 하나 + 아랍어 모드에서 차용어·라틴 영어도 받음 |
| 9b-D6 | 숫자·부분 일치 | 받지 않음, 가장 긴 구 우선, 모호하면 무효 |
| 9b-D7 | 확신도 | 문턱 없음(Android 1.0 채움) |
| 9b-D8 | 실패 안내 | 상태 줄 + 음성 한 마디 + 되돌림, 반복 금지 |
| 9b-D9 | 오프라인 단추 | 막지 않고 시도 → 실패 시 안내(6-4 갱신) |
| 9b-D10 | "다시" | speaker 에 `again()` 약 8줄 |
| 9b-D11 | "번역 켜기" | 끄기 전 모드 복원(`readalong.lastOn`) |
| 9b-D12 | 실기기 진단 | 진단 단계 없음 — [말해 보기] + 마지막 점검 묶음(9a-0 과 한 자리) |
| 9b-D13 | 나누기 | 9b-1(순수·서비스, 9a 와 병행 — 기존 파일 0) → 9b-2(화면, 9a 뒤) → 9b-3(조건부) |
| 9b-D14 | "여기 설명" | 표에 자리만(꺼짐), 11a 뒤 켬 |

## 7. 파일 경계 · 9a 와의 순서
- 새 파일: `js/voice/commands.js`(순수 — `foldArabic` 만 import) · `js/voice/listen.js`(서비스 — 인식기 생성자 주입) · `js/ui/voice.js`(UI). **`ui/handsfree.js` 는 9a 것** — 9b-2 에서 주입 2개(`isListening`·`cancel`)와 핸들러 첫 줄 취소만 더한다.
- 9b-2 가 고치는 파일: controls(약 20줄)·handsfree(약 8줄)·speaker(`again()`)·ui/settings(export 1 + 음성 묶음)·index·css·settings 기본값·config `VOICE`·i18n 22키×4.
- 고지(13절): `[가정]` → 사실("휴대폰 음성 인식 서비스, 소리가 Google 서버로 갈 수 있음, Android 는 온디바이스 강제 불가, 누를 때 한 번만, 글자는 메모리에만·AI 호출 0"). 첫 사용 고지 카드 [시작]이 탭 제스처로 듣기를 시작. 번역 동의와 별개.
- 수용 기준: `[N]` V1–V12 + 기존 테스트, `[D]` 데스크톱 Chrome(영어 명령·권한·오프라인·폭 360/375/412·RTL), `[M]` 점검 묶음 V-1~V-10. 테스트 파일 3개(가짜 인식기 클래스 + 진짜 `createSpeaker`), 변이 9종.

## 8. 예상 시간 `[추정]`
| 단계 | 시간 |
|---|---|
| 9b-1 순수·서비스(9a 와 병행 가능) | Build 1.5–2 + Review 1 |
| 9b-2 화면·배선(9a 머지 뒤) | Build 2–2.5 + Review 1.5 |
| 합 | **약 6–7시간** + 실기기 점검 한 번(9a 와 같은 자리) |
| 9b-3 이어폰 길게(조건부) | Build 0.5–1 + Review 0.5 |

10-21 인계표의 "9b 3~4시간" 보다 크다 — 이유: 진단 단계를 없앤 대신 폴백(태그 사다리)·[말해 보기]·실패 안내 음성·9a 와의 겹침 처리·speaker `again()` 이 앱 안으로 들어왔다.

## 9. 출처
- Chromium `content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java` (main)
- MDN `SpeechRecognition` · `available()` · `processLocally` · `SpeechRecognitionErrorEvent.error`
- blink-dev "Intent to Ship: Web Speech API: On-Device Recognition Quality" (`groups.google.com/a/chromium.org/g/blink-dev/c/P8P-x7AnC6I`)
- Google Cloud Speech-to-Text 언어표 (`cloud.google.com/speech-to-text/docs/languages`)
- Chrome 개발자 블로그 "Voice driven web apps" (첫 사용 권한)
- EFF 2025-06 시리아 기술 제재 완화 · Daily Sabah Google 서비스 재개 보도

## 10. 못 한 것
- 실기기 숫자 전부(위 점검 묶음).
- 아랍어 동의어의 원어민 검토 — Nour·운영자.
- `start()` 의 사용자 제스처 요구를 적은 공식 문서, Android 무음 시간 초과 값, 브라우저 쪽 `maxAlternatives` 자르기 여부.
