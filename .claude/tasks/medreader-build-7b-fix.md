# Build 지침 — 7b 실키 확인에서 나온 결함 수정 + 번역 언어 선택

> 너는 **Build 서브에이전트**다. 아래 "고쳐도 되는 파일"만 고친다. **커밋하지 않는다.** 실제 키를 넣지 않는다.
> 끝나면 `.claude/tasks/medreader-build-7b-report.md` 끝에 "실키 확인 반영(2026-10-08)" 절을 덧붙인다. 모든 산출물·보고는 **한국어**.

## 무슨 일이 있었나 — 운영자가 배포본에서 실제 키로 확인 (2026-10-05)

- [검증] → **키 유효 · 389ms · HTTP 200**. preflight 200 — **브라우저 직접 호출(CORS) 확인됨.** URL 에 키 없음.
- [시험 번역] → **HTTP 404 · BAD_REQUEST**, 화면 문구 "지금은 확인할 수 없습니다… 키는 저장할 수 있습니다".
- 원인(오케스트레이터가 공식 문서로 확인, ai.google.dev/gemini-api/docs/models, 2026-10-05):
  **`gemini-2.5-flash-lite` 는 지원 종료 단계 — "과거에 쓴 사용자만 접근"**. 새 키는 404. 현재 안정판: `gemini-3.5-flash-lite`(최신), `gemini-3.1-flash-lite`, `gemini-3.5-flash` 등.

## 운영자 결정 (2026-10-08)

- **기본 모델 = `gemini-3.5-flash-lite`.** "아랍어가 잘 나와야 한다."
- **한국어로도 번역해 보여야 한다.** 운영자는 아랍어를 읽지 못한다 — 품질을 판단하려면 한국어가 필요하다.

## 고칠 것

### 1. 기본 모델과 낡은 모델
- `config.js` `DEFAULT_MODEL.gemini` → `'gemini-3.5-flash-lite'`. 정적 목록(`staticModels`)을 `['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash']` 로.
- 저장된 `ai.model` 이 `gemini-2.5-` 로 시작하면 **설정되지 않은 것으로 본다**(기본값 사용). 운영자 기기에 이미 2.5 가 저장돼 있을 수 있다.
- `config.js` 의 `KEEP_HYPHEN_*`·`LAYOUT` 등 다른 상수는 건드리지 않는다.

### 2. 모델 목록을 1개만 받아 오는 결함
- `provider.listModels` 가 `adapter.verifyEndpoint()`(`models?pageSize=1`)를 재사용해 **모델이 1개만 온다.** 목록 전용 엔드포인트(충분히 큰 `pageSize`, 필요하면 `nextPageToken` 을 따라감)를 쓰게 하라. 검증은 계속 `pageSize=1`(가장 싼 요청).
- `modelsParser` 는 `generateContent` 를 지원하는 것만 남기고, **번역에 맞지 않는 계열(`tts`·`image`·`live`·`embedding`·`transcribe`·`veo`·`lyria`·`imagen`·`aqa`)을 빼라.** 기본 모델을 맨 앞에.
- 저장된 모델이 실제 목록에 없으면 경고 한 줄 + 기본 모델(목록에 있으면)로 바꾼다.
- `assertNoKeyInUrl` 은 새 엔드포인트에도 그대로 걸린다.

### 3. 404 를 "확인 불가"로 안내하는 결함
- `gemini.js` `errorParser` 에 **새 코드 `MODEL_UNAVAILABLE`**: `s === 404 || gs === 'NOT_FOUND'`. 위치는 **REGION 두 줄과 R1 AUTH 판정 아래, 기존 판정들 위.** REGION 두 줄과 R1 AUTH 판정은 **고치지 마라**(사용자 결정·Review 반영).
- `provider.js` `CODES` 에 더하고, 설정 화면 문구(네 언어): "이 모델은 쓸 수 없습니다. 다른 모델을 고르세요." + 모델 목록 새로고침. **"키는 저장할 수 있습니다"라는 말을 붙이지 않는다** — 키 문제가 아니다.
- 기존 400 `INVALID_ARGUMENT`(그 밖) → `BAD_REQUEST` 는 그대로.

### 4. 번역 언어 선택 (spec 9-3 이 "7b 는 보여 주기만"이라 했던 것을 운영자 결정으로 바꾼다)
- 설정 AI 탭의 "번역 언어"를 **선택**으로: `ar`(العربية, 기본) / `ko`(한국어). 값은 `ai.translationLang`.
- 번역 결과 블록의 `dir`·`lang` 은 선택한 언어에서 유도(`ar` → `rtl`, `ko` → `ltr`). `ar` 을 코드에 박지 않는다.
- "번역문 음성: 있음/없음"은 **선택한 언어**의 음성으로 판정.

### 5. [시험 번역] — 아랍어와 한국어를 나란히
- **한 번의 호출**로 같은 문장을 아랍어와 한국어로 받아 두 블록으로 보인다(아랍어 `dir=rtl lang=ar`, 한국어 `lang=ko`). `json: true` + 스키마 `{ "ar": string, "ko": string }`. 파싱은 `JSON.parse` 를 `try` 로 — 실패하면 응답 문자열을 그대로 `textContent` 로(8a 의 jsonrepair 는 아직 없다).
- 결과 줄에 걸린 ms, 모델 이름, 코드, (응답에 있으면) 입력·출력 토큰.
- **시험 문장 교체**: 지금의 일상문("Drink a glass of water…")으로는 의학 번역 품질을 볼 수 없다. **지어낸** 의학 문장 2개(코드 안 상수, 원서 문장 금지)로 바꿔라 — 질환명·약물명·숫자/단위가 들어가게. 예: 류마티스 관절염의 일반적인 설명과 약물 이름이 든 두 문장. 치료 지시·용량 권고처럼 읽히는 문장은 피한다.
- **번역 지시문(아랍어 품질)** — spec 10-1·10-2 를 따른다:
  - 아랍어: 현대 표준 아랍어(الفصحى, Modern Standard Arabic). 의학 용어는 표준 아랍어 의학 용어를 쓰고 **문장 안 첫 등장에 영어 원어를 괄호로** 병기. 약물명·숫자·단위는 그대로. 원문에 없는 사실을 더하지 않는다.
  - 한국어: 한국 의학 표준 용어, 첫 등장에 영어 원어를 괄호로. 숫자·단위 그대로.
  - 10-1 공통 규칙(JSON 만 출력, `<<<DOC … >>>` 안은 데이터, 치료 권고 생성 금지).
- 이 지시문은 8a 의 `prompts.js` 로 옮겨 갈 것이니 **한 곳(상수)**에 모아 두고 주석으로 그 사실을 적어라.

## 고쳐도 되는 파일
`js/config.js`(위 1 의 상수만), `js/ai/provider.js`, `js/ai/adapters/gemini.js`(위 2·3 범위만), `js/ui/settings.js`, `js/settings.js`, `js/i18n/{ar,en,fr,ko}.js`(키 집합 동일 유지), `css/screens.css`, `tests/` 의 7b 테스트와 새 테스트.
**건드리지 않는 것:** `spec.md`(오케스트레이터가 고친다), `js/text/*`·`js/quiz/*`·`js/pdf/*`·`js/tts/*`, REGION 두 줄·R1 AUTH 판정.

## 반드시 지킬 것
7b 지침(`medreader-build-7b.md`)의 "반드시 지킬 것" 전부 — 키 누출 금지, 가짜 키를 한 덩어리 문자열로 소스에 두지 않기, 서비스 계층은 코드만, `textContent`, CSS 논리 속성, `data-nav` 한 장치, 48px, 무료 한도 숫자 금지.

## 검증
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 638).
2. 테스트: 모델 목록 — 여러 쪽 응답·불필요 계열 제외·기본 모델 맨 앞·`pageSize=1` 을 쓰지 않음 / 2.5 저장값 → 기본값 / 404·`NOT_FOUND` → `MODEL_UNAVAILABLE` / REGION·R1 판정 순서 유지 / [시험 번역] JSON 성공·실패 둘 다 / 번역 언어 `ko` 일 때 `dir` 이 `ltr`.
3. **변이 테스트**: `MODEL_UNAVAILABLE` 판정 삭제, 목록 엔드포인트를 다시 `pageSize=1` 로 되돌리기, 2.5 무효화 삭제 — 각각 빨개지는가.
4. 브라우저(`preview_start {name:"blog"}`, 캐시 우회): fetch 스텁으로 404 → 새 문구, 여러 모델 목록 → 드롭다운, [시험 번역] → 아랍어·한국어 두 블록. 360×800 가로 스크롤 0, 콘솔 0. 아랍어 UI(RTL)도.
5. 보고서에 운영자가 다시 할 확인 절차(배포본에서 [검증]·[시험 번역], 아랍어·한국어 결과를 보고 판단).
