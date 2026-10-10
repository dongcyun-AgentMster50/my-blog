# Build 지침 — 8b-1: 낭독 동반 번역 (서비스·낭독 순서)

> 너는 **Build 서브에이전트**다. 아래 "고쳐도 되는 파일"만 고친다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.
> 8b 는 둘로 나눈다. **너는 8b-1(서비스·발화 순서)만** 한다. 하단 자막 띠·토큰·속도 팝오버 줄 같은 **화면은 8b-2** 가 한다 — 화면은 만들지 마라. 대신 8b-2 가 붙을 **이벤트·함수 계약**을 분명히 남겨라.
> 끝나면 보고서 `.claude/tasks/medreader-build-8b1-report.md` 를 쓴다.

## 먼저 읽을 것
1. `.claude/tasks/medreader-handoff.md` — "반드시 지킬 것"·"알려진 함정", 그리고 **2026-09-28 이후 절 전부**(낭독 동반 번역·글자 수 창·운영자 결정·8a·8a 후속·7c)
2. spec: **19절 8b 행**, **16-D3 의 `[N]` RA1~RA14**(이번 합격 기준), 7-8-1~7-8-6 전부, 6-1·6-2(발화 단계 `src`·`tr-wait`·`tr`), 6-3, 6-4(Android 제약), 7-6(상태 기계 — `[수정 2026-10-10]` 포함)
3. 코드: `js/ai/pipeline.js`·`cache.js`·`prompts.js`(8a), `js/tts/speaker.js`·`text.js`(`Unit.src/seg/kind`·`sentencesOf`)·`voices.js`, `js/ui/reader.js`(`flowParasOf`), `js/text/bidi.js`(`ltrRuns`), `js/config.js` 의 `READALONG`·`PIPELINE`

## 만들 것
1. **`js/ai/readalong.js`**(서비스, 문서당 하나) — 7-8-3 의 refill 규칙 그대로: 글자 수 창(`READ_AHEAD_CHARS` 9,000), 청크(6,000자, 쪽 경계를 넘어 묶음, 캐시된 문장 건너뜀), 선행 요청 시점(덮인 거리 ≤ 3,000), 떠 있는 요청 최대 1(+냉시작 head 1), 여러 쪽 `loadParas`(UI 가 주입), **미추출 쪽에서 끊기**(기다리지 않음), 조회는 **문장 원문 키**(번호 아님), `effectiveMode`(7-8-1 표, 순수, export), `readStats` 누적(15절 글자 기준).
   - 8a 의 `pipeline` 이 내는 상태 이벤트는 성공 호출마다 `inflight → ready` 가 난다 — **다시 보낼지는 이전 상태(`prev`)로 걸러라**(8a Review 주의).
   - 상태가 `exhausted|capped|offline|region|model|no-key` 면 요청 0건, 알림은 **상태 전이 때 1번**(RA4).
2. **`js/tts/speaker.js` 의 발화 단계** — 6-1·6-2 의 `src → tr-wait → tr` 전이를 **기존 상태 기계·onend 체이닝·워치독 위에** 더한다(재작성 금지 — 5단계·10a 의 하이라이트·되감김 수정이 걸려 있다). `tr-wait` 는 워치독이 아니라 세대(gen) 달린 타이머(`TR_WAIT_MS`). `speakSource=false` 면 원문은 소리 없이 하이라이트만(RA10). 문장 반복·`markDone` 은 RA8.
   - **번역문 발화 텍스트에서 괄호 속 라틴 문자를 뺀다**(운영자 결정 2026-10-08 — "낭독 시 괄호 속 영어 빼자"). 화면 표시는 그대로 두고 **발화 텍스트만**. `text/bidi.js` 의 `ltrRuns` 와 같은 판정을 쓰거나 같은 정규식을 공유해 두 벌이 되지 않게. 괄호를 빼고 남는 이중 공백·구두점 앞 공백 정리. 순수 함수로 export 하고 테스트.
   - 번역문 300자 분할은 `،`·`؛` 에서도 끊는다(RA11).
   - 번역문 음성 = `pickVoice(ai.translationLang)`, 없으면 유효 모드 `show` + 알림 1회(RA9). 원문 음성은 7c 의 `syncSourceVoice` 경로 그대로.
   - **표 안내 발화는 UI 언어 음성으로**(6-1 — 지금은 원서 음성이 UI 언어 문장을 읽는다).
3. **[다시 시도]의 서비스 쪽** — `exhausted`(Gemini 429 에 `Retry-After` 가 거의 없어 사실상 다음 날 00:00 까지)·`cooldown`·`model` 을 **사용자 재시도가 즉시 `ready` 로** 돌리는 함수(7-6). 화면 버튼은 8b-2 가 붙인다.
4. **음성 목록을 끝까지 듣는다**(운영자 실기기 이상, 2026-10-10): Galaxy·Chrome 에서 영어·아랍어 언어팩이 설치돼 있는데 앱이 "영어 음성 없음"·아랍어 "번역문 음성: 없음"으로, 한국어만 "있음"으로 판정했다. `tts/voices.js` 의 `loadVoices` 는 **첫 `getVoices()` 가 비어 있지 않으면 그 자리에서 그 목록을 최종으로 쓴다** — Android 가 기본 언어 음성만 먼저 주고 나머지를 `voiceschanged` 로 늦게 주면 놓친다(가설 — 진단 페이지 `dev/voices.html` 결과 대기, 결과가 오면 오케스트레이터가 알려 준다).
   어느 쪽이든 맞는 수정으로: `voiceschanged` 를 **계속** 구독해 목록이 바뀔 때마다 원문 음성·번역문 음성·유효 모드·"음성 없음" 판정을 다시 한다. "음성 없음" 알림은 **목록이 안정된 뒤**(첫 응답 후 일정 시간 변화 없음, 상수로)에만, 그리고 나중에 음성이 생기면 알림을 거두고 유효 모드를 되돌린다. 음성 객체가 없어도 `utterance.lang` 만으로 발화를 시도하는 기존 경로는 유지. 설정 화면의 "번역문 음성: 있음/없음"도 같은 판정을 구독한다(설정 화면은 배선만 — 화면 요소 추가 없음). 테스트: 첫 목록에 `ko` 만 → 1초 뒤 `en`·`ar` 추가 → 판정이 "있음"으로 바뀌고 알림 0.
5. **미지원 언어(`und`) 문서**: 지금 배너가 "und 음성이 없습니다"로 나온다. `und` 면 원문 낭독 대상 언어 이름 대신 "이 문서의 언어는 낭독을 지원하지 않습니다" 류 문구(네 언어, 키 집합 동일).
6. **8b-2 에 넘길 계약**(보고서에 표로): 띠가 구독할 이벤트(현재 문장의 번역 준비/대기/없음/막힘+사유, 유효 모드 변화, 상태 알림), 띠가 부를 함수([다시 시도], 모드 변경), 데이터 모양.

## 고쳐도 되는 파일
새 `js/ai/readalong.js`, `js/tts/speaker.js`(발화 단계·번역문 음성·표 안내 음성), `js/tts/text.js`(번역문 분할·발화 텍스트 정리 함수), `js/tts/voices.js`(위 4 — 음성 목록 구독), `js/ui/settings.js`(위 4 의 판정 구독 배선만), `js/i18n/*.js`(위 5 의 문구만, 키 집합 동일), `js/ai/pipeline.js`(재시도 함수·이벤트 필드만), `js/config.js` 의 `READALONG` 블록, `js/ui/controls.js`·`js/ui/reader.js`(readalong 서비스 **배선**만 — `loadParas` 주입·생명주기. 화면 요소 추가 금지), `tests/` 새 테스트(`readalong.test.mjs`·`speaker-tr.test.mjs` 등).
**건드리지 않는 것:** `spec.md`, `js/text/*`(bidi 의 판정 재사용은 import 로), 4절 알고리즘, `gemini.js` 판정·모델 필터, `js/quiz/*`, CSS·`index.html`(8b-2 몫).

## 반드시 지킬 것
- **원문 낭독은 절대 멈추지 않는다**(7-8-4). 번역이 늦거나 막혀도.
- **자동 전체 번역 없음** — 창(9,000자) 밖은 요청하지 않는다(RA3). 자동 재시도는 8a 후속이 정한 상한만.
- 분할 한 벌 — `splitSentences` 호출은 `js/tts/text.js` 한 곳. 번역 조회는 문장 원문 키.
- 서비스(`ai/*`)는 UI 문자열을 만들지 않는다, `../ui/` import 0. 키 누출 0. 무료 한도 숫자 하드코딩 0.
- 16-A 순수성 검사는 주석까지 grep 한다.

## 검증 — 보고서에 수치로
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 806 — Review 반영 후 숫자가 다를 수 있다, 시작 수를 적어라).
2. RA1~RA14 각각 어떤 테스트가 고정하는지. RA3 의 창 경계는 20,000자 이상 연속 낭독 스텁으로.
3. **실제 책으로 한 번**: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`, `apps/medreader/dev/measure-lib.mjs` 로 CMDT 2021(쪽이 작은 책) 연속 50쪽과 CMDT 2026 연속 30쪽의 실제 문장 흐름을 readalong 에 흘려(번역은 스텁, 즉시 응답) **호출 수·청크 크기·도착 시 번역 없음** 을 재라. 9-28 시뮬레이션 기대: 1만 자당 약 1.7회, 늦음 0. PDF: `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` — **다운로드 폴더 목록을 띄우지 마라.** 원서 문장을 보고서에 옮기지 마라.
4. **변이 4개 이상**(창 경계 빼기, 떠 있는 요청 상한 빼기, `prev` 거르기 빼기, 괄호 영어 제거 빼기 등). **적용 grep 확인 후** 읽고 스크래치패드 복사본으로 되돌린 뒤 cmp(`git checkout`·`restore`·`stash` 금지).
5. 브라우저는 이번엔 회귀만: 설정 화면·리더 낭독(영어)이 그대로인지, 콘솔 0.
6. 마지막 응답: 만든 것, RA 항목별, 실제 책 측정값, 변이, 8b-2 계약 요약을 15줄 이내로.
