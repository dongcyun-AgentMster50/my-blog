# Build 지침 — 9b-2 음성 명령: 화면·배선 + 오탐 규칙 (9b-1 과 함께 배포)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-1-2** 전부(특히 3·4·5·7·8·9절) + 결정 **9b-D1–9b-D14 권장안**. 9a 는 배포됨(`af7689d`). 9b-1(`js/voice/commands.js`·`listen.js`·테스트 2개)은 작업 트리에 있고 **아직 커밋 전** — 이번 Build 와 한 번에 배포한다. **운영자 방침: 실기기 확인을 기다리지 않는다**(실기기 항목은 보고서의 "마지막 실기기 점검 묶음"에).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9b2-voice-report.md`.

## 운영자 결정 (2026-11-15, 9b-1 Review 중-1·중-2)
1. **한 낱말 동의어의 포함 일치는 말 전체가 3낱말 이하일 때만**(전체 일치는 그대로).
2. **부정어가 맞은 구 밖에 있으면 그 대안을 무효**(don't·not·never, لا·ما·مش·مو 등 — 목록은 표로, `[검토 — Nour·운영자]`). «بلا ترجمة» 처럼 부정어가 동의어 안에 든 것은 그대로.

## 할 일
1. **9b-1 손질** (`commands.js`·`listen.js` — 근거 review.md "9b-1 Review"(9b1R-1~9), Build 보고 `.claude/tasks/medreader-build-9b1-voice-report.md` 4절): 위 결정 1·2, 동의어 표 손질(Review 의 `r9b1/alt/commands-alt.mjs` 참고 — 놓침 13→4, «ترجمة»·«ترجم» exact, 관사 없는 «وقف ترجمة» 를 trOff 에, «شغل»·«بعده» 같은 두 뜻 낱말 exact), listen 낮음-3(`emit('fallback')` 뒤 `if (press !== p) return;`)·낮음-4(`onresult` 의 `loadTag()` try 안으로), `MAX_ALTS` 한 곳(`VOICE.MAX_ALTS`). **Review 말뭉치**(`r9b1/corpus.mjs`·`neg.mjs` — 읽기만)를 테스트로 옮겨 "명령 아님 → null"·"부정문 → null"·"명령 → 맞는 명령"을 고정(원문 낱말은 짧은 발화라 그대로 써도 된다). 결과 표(오탐·혼동·놓침·부정문)를 보고서에.
2. **9b-2 배선** — 설계 7절 "고치는 파일" 전부: `js/ui/voice.js`(새 — 마이크 단추 56px [속도] 뒤, 상태, 고지 카드(13절 — 음성이 Google 서버로 갈 수 있음), 명령 실행, 실패 시 상태 줄 + 음성 한 마디 + 되돌림, 설정의 [말해 보기] + [결과 복사]), `ui/controls.js`(배선·`leaveControls` 에서 `voice.cancel()`·[▶]·[이전]·[다음] 첫 줄 취소), `ui/handsfree.js`(주입 2개·액션 첫 줄 취소), `tts/speaker.js` **`again()` 하나만**(약 8줄), `ui/settings.js`(`setReadalongMode` export·`readalong.lastOn`·"음성 명령" 묶음), `config.js` `VOICE`(**`EN_TAG` 는 `TTS_LANG_REGION.en` 을 가리킴** — `'en-US'` 를 다시 적으면 W1 이 빨개진다, `RETRY_WAIT_MS: 300`), `settings.js` 설정 키(9-3), i18n 약 22키 × 4(ar·fr `[검토]`, **fr·ko 는 실제 번역**). UI 계약: 상태는 이벤트로 그림, `end` 는 그 누름의 끝, 핸들러 안에서 `abort()`·`start()` 부르지 않기.
3. **stamp 다시**(voice 모듈이 import map 에 들어감 — IM 5개 풀림), `--check` 0.
4. 9a 무변: 9a 테스트·동작 그대로(듣는 중 9a 단추·화면 단추는 듣기 먼저 취소 후 평소대로).

## spec
**이번 Build 동안 `spec.md` 를 고치지 마라** — 같은 작업 트리에서 8e Plan 이 spec 을 쓰고 있다. 정정할 것(9b-1 Build 보고 6절 초안 + Review 의 더할 것: 4절 exact 목록·5절 `busy`·`aborted` 행·"둘째 동사에 و" 한 줄·«التالي والسابق» 예, 3-2 import 표 `voice/*` 두 줄, 9-3 설정 키, 위 운영자 결정 1·2)은 보고서의 "spec 정정 줄 초안" 절에 붙여 넣을 수 있는 꼴로.

## 검증
- 설계 9절 수용 기준 `[N]` 전부 + 새 말뭉치 테스트. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1435 + 새, IM 5개 풀려야 함). `stamp --check` 0, `git diff --check`.
- headless Edge(412×915 · ko·ar · 가짜 키 · 흉내 음성 · **가짜 `SpeechRecognition`**(페이지에 주입) · 새 프로필 `b9b2/p1`·새 포트): 마이크 단추 크기·자리·가로 넘침 0(360×740 도), 고지 카드 처음 한 번, 명령 9개 실행(낭독 상태가 맞게), 듣는 중 낭독 멈춤 → 명령 뒤 이어 읽기, 실패 안내, [말해 보기], 9a 핸들러와 겹침, 띠·8d·8i-3 회귀, 콘솔 오류 0. 스크린숏 2–3장 `b9b2/shots/`.
- 변이 3개 이상(3낱말 제한 끄기, 부정어 무효 끄기, `again()` 이 phase 를 안 되돌림, 듣는 중 [▶] 취소 빼기 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `b9b2/bak/`.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로. 흉내 Gemini 는 OPTIONS(CORS) 처리. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 이전에 쓴 포트·프로필(`b*`·`r*`·`p8e`) 쓰지 마라.
- 8000번 python 은 떠 있다 — 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125 node 건드리지 마라. 프로필 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`js/voice/*`, `js/ui/voice.js`(새), `js/ui/controls.js`, `js/ui/handsfree.js`, `js/tts/speaker.js`(`again()` 만), `js/ui/settings.js`, `js/config.js`, `js/settings.js`, `js/i18n/*`, `css/*`, `index.html`(stamp·마이크 단추 자리가 정적 HTML 이면), `tests/`, 스크래치패드 `b9b2/`, 보고서. **`spec.md`·`review.md`·`dev/` 금지.** DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변. AI 호출 0.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
