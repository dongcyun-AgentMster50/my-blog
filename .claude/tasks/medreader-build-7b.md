# Build 지침 — 7b: 설정 AI 탭과 실제 호출

> 너는 **Build 서브에이전트**다. 아래 "고쳐도 되는 파일"만 고친다. **커밋하지 않는다.**
> 끝나면 보고서 `.claude/tasks/medreader-build-7b-report.md` 를 쓴다. 모든 산출물·보고는 **한국어**.

## 먼저 읽을 것

1. `.claude/tasks/medreader-handoff.md` — 맨 끝 "2026-09-28" 절, 그리고 "반드시 지킬 것"·"알려진 함정"·"3차 실기기 확인 — 이 라운드에서 배운 것"
2. `apps/medreader/spec.md` — **19절의 7b 행**, **16-D0**(합격 기준 — 이게 끝의 정의다), 12-7, 8-2(`REGION`), 8-3, 8-4(검증 다섯 갈래), 14-2(`ai.state.region`), 9-3(`readalong.*`), 6-3(`pickVoice`), 13절
3. 7a 코드: `js/ai/provider.js`·`js/ai/adapters/gemini.js`·`js/privacy/keys.js`·`js/privacy/redact.js`·`js/ai/tokens.js`와 그 테스트(`tests/*-7a.test.mjs`, `tests/key-url-guard.test.mjs`)

## 만들 것 (19절 7b 행의 ①~⑤)

1. **(가장 먼저) [검증]·[시험 번역]** — 사용자가 실제 키로 누를 수 있는 상태를 가장 먼저 만든다.
   [시험 번역]은 **지어낸 고정 예문 2문장**(코드 안 상수. PDF·원서 문장 금지)을 `provider.complete()` 로 1회 보내고 결과 문자열(`textContent`), **걸린 시간 ms**, 결과 코드를 보인다. JSON 파싱은 8a 몫이다.
2. **`REGION` 코드** — `provider.js` `CODES` 에 추가, `verifyKey` 가 `{ok:false, code:'REGION', canSave:true}`, 검증 결과 다섯 갈래 문구(유효/무효/한도/지역 제한/확인 불가), `ai.state.region` 문구(**[키 설정] 링크 없음**).
   ⚠ **`gemini.js` 의 `errorParser` 안 `REGION` 판정(두 줄)은 사용자가 고른 방식(B: 대소문자 무시, `location`·`not supported` 둘 다 포함)으로 이미 들어가 있다.** 그 분기를 고치거나 다시 쓰지 마라. 동작이 16-D0 `[N]` 항목과 어긋나면 고치지 말고 **보고서에 적어라.** 테스트는 16-D0 대로 써라(오케스트레이터가 10가지 경우를 이미 확인했다 — 네 테스트는 그것을 `tests/` 에 고정하는 일이다). `CODES` 에 `REGION` 을 더하고 `provider.js` 가 이 코드를 그대로 흘려보내는지는 네가 확인한다.
3. 12-7 나머지 — 프로바이더 선택, 키 입력(`type=password`·표시 토글·붙여넣기), "이 기기에 기억"(켜면 경고), 모델 드롭다운(`listModels` 실패 시 정적 목록), 일일 상한, 기기 내 AI 사용, 캐시 용량·비우기 자리, 키 입력창 옆 `piiWarning()`(아랍어 우선).
4. **번역 따라가기** `readalong.mode`(`off|show|speak`, 기본 `speak`) + "원문도 소리 내어 읽기" `readalong.speakSource`(기본 `true` — **사용자 확정**). **리더 속도 팝오버의 같은 줄과 같은 그리기 함수**를 쓴다. 7b 에서는 **저장만** 하고 동작은 8b 가 붙인다. "나중에 켜집니다" 같은 문구를 보이지 않는다.
   "번역 언어: العربية"(`ai.translationLang` 의 자국어 이름, 읽기 전용) + "번역문 음성: 있음/없음"(`pickVoice(target)`).
5. 입구 — 서재 상단바 [설정], 리더 속도 팝오버의 [번역 설정], 키 없음 안내의 [키 설정].

## 고쳐도 되는 파일

- `js/ai/provider.js`, `js/ai/adapters/gemini.js`(**`errorParser` 의 사용자 작성 분기 제외**)
- 새 파일 `js/ui/settings.js`(설정 화면), `js/ui/notice.js`(`piiWarning()`)
- `js/settings.js`(기본값 `readalong.*` 등 9-3 키), `js/ui/controls.js`(속도 팝오버의 모드 줄), `js/ui/library.js`(설정 입구), `js/main.js`(화면 배선)
- `index.html` 의 `data-screen="settings"` 섹션과 입구 버튼, `css/*.css`
- `js/i18n/{ar,en,fr,ko}.js` — **네 파일 키 집합이 같아야 한다.** ar·en 은 실제 번역, fr·ko 도 채운다
- `tests/` 에 새 테스트 파일(`*-7b.test.mjs`)

**건드리지 않는 것:** `js/text/*`, `js/quiz/*`, `js/pdf/*`, `js/tts/speaker.js`(8b 몫), `spec.md`, `config.js` 의 `KEEP_HYPHEN_*`, 블로그 본체 파일.

## 반드시 지킬 것 (지금까지 실제로 데인 것들)

- **키가 URL·콘솔·토스트·에러 문자열에 나가지 않는다.** 7a 의 `assertNoKeyInUrl`·`redact` 위에 얹는다(재구현 금지). 설정 화면 표시는 `maskKey`.
- **테스트에 넣는 가짜 키는 진짜 키 형식 문자열을 한 덩어리로 쓰지 마라** — GitHub 비밀 스캐너가 잡는다(`1f4ce7b` 에서 사용자가 쪼개 고쳤다). 기존 7a 테스트가 쓰는 방식을 따른다.
- **실제 키를 어디에도 넣지 않는다.** 실제 호출이 필요한 16-D0 `[사용자]`·`[M]` 항목은 네가 할 수 없다 — 보고서에 "사용자 확인 대기"로 남겨라.
- 서비스 계층(`provider.js`)은 UI 문자열을 만들지 않는다 — 코드만 낸다. UI 가 i18n 키로 바꾼다(3-2).
- `innerHTML` 은 정적 템플릿에서만. 모든 AI 응답·사용자 입력은 `textContent`.
- CSS 는 논리 속성만(`left/right/margin-left…` 0건).
- 버튼 동작은 **`data-nav` 전역 위임 한 가지 장치**로(JS `onclick` 과 섞지 마라 — 반쪽 캐시 상태에서 죽은 버튼이 된다. 인계 문서 3차 확인 교훈 2).
- 동의(`privacy.consentedAt`) 전에는 [검증]·[시험 번역]이 동의 카드로 연결된다.
- 무료 티어 한도 숫자를 코드·문구에 쓰지 않는다.
- 모든 조작 버튼 48×48px 이상.

## 검증 — 네가 하고 보고서에 수치로 적을 것

1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(디렉터리 인자는 Windows 에서 실패한다). 시작 전 594개.
2. 16-D0 의 `[N]`·`[D]` 항목을 하나씩 — 항목마다 어떻게 확인했는지.
3. **변이 테스트**: `REGION` 판정 순서를 일부러 깨면(AUTH 를 먼저 보게) 빨개지는 테스트가 있는가. 없으면 그 테스트는 헛돈다.
4. 브라우저: `preview_start {name:"blog"}` → `http://localhost:8000/apps/medreader/index.html#/settings/ai`. fetch 스텁으로 다섯 갈래 문구를 확인. 콘솔 에러 0.
   **캐시 주의**: `python -m http.server` 는 `Cache-Control` 을 안 보낸다. 고친 파일을 `fetch(url,{cache:'reload'})` 로 다시 받고 쿼리를 바꿔 navigate 하라.
5. 360×800 에서 설정 화면이 가로 스크롤 없이 보이는가, 아랍어 UI(RTL)에서 거울 배치되는가.

## 보고서 `.claude/tasks/medreader-build-7b-report.md`

1. 바꾼 파일과 한 줄 요약
2. 16-D0 항목별 결과(통과/사용자 확인 대기/실패)와 확인 방법
3. 테스트 수(전·후), 변이 테스트 결과
4. 사용자가 할 일 — 배포본에서 실제 키로 [검증]·[시험 번역]을 누르는 절차(한국 PC → Nour 기기), 무엇을 기록해야 하는지
5. spec 과 다르게 한 것과 이유, 발견한 결함
