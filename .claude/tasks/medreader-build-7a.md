# Build 지침 — MedReader 7a단계: AI 프로바이더 + Gemini 어댑터 + 키 저장 + redact

## 배경

1~6·9·10 일부가 배포됐다. 테스트 **470개 통과**. 지금까지는 **네트워크 없이** 도는
기능만 만들었다(읽기·낭독·원본 뷰·퀴즈). 7단계부터 AI 가 붙는다.

이 단계는 **서비스·순수 계층만** 만든다. 설정 화면(UI)은 7b 다.

**곧 7000쪽 실제 자료로 교체된다**(형식 유사).

## ★ 절대 규칙 — 키는 새지 않는다 (13절)

이것이 이 단계의 전부다. 나머지는 부차적이다.

1. **요청 URL 에 키를 넣지 마라.** 헤더만 쓴다.
   Gemini 는 `?key=` 쿼리도 받지만 **쓰지 마라** — URL 은 로그·리퍼러·히스토리에 남는다.
   `x-goog-api-key` 헤더를 쓴다(spec 8-2 가 명시).
2. **`redact.js` 를 통과하지 않은 문자열을 밖으로 내지 마라.**
   `provider.js` 는 예외를 **그대로 던지지 않는다** — `{code, status, message: redact(...)}` 로 감싼다.
3. **`console.*` 에 키가 닿을 수 있는 것을 찍지 마라.** `dev.debug` 여도 마찬가지다.
4. **키를 `settings` 스토어에 저장하지 마라**(9-3 이 명시). `sessionStorage` 가 기본,
   "이 기기에 기억"이 켜졌을 때만 `localStorage`.
5. **테스트·코드·주석에 진짜처럼 보이는 키를 쓰지 마라.** 픽스처는 `AIza` + 뻔한 더미로.

## ★ 너는 실제 API 를 호출할 수 없다

**진짜 API 키를 요구하지도, 어딘가에서 찾지도 마라.** 사용자 키는 사용자 기기에만 있다.
`fetch` 를 **주입 가능하게** 만들어 스텁으로 전수 검증하라 — 그게 이 계층을 순수하게
테스트하는 유일한 길이고, `speaker` 가 `synth` 를 주입받는 것과 같은 방식이다.

실제 호출 검증은 **사용자가 자기 키로 실기기에서** 한다.

## 먼저 읽을 것

1. `apps/medreader/spec.md` — **8절 전체(8-1 인터페이스 · 8-2 어댑터 선언 · 8-3 CORS ·
   8-4 키 검증 · 8-5 토큰 추정)**, **13절(프라이버시·보안 ★)**, 9-3(설정 키),
   9절 `usage` 스토어, 14-1(오프라인 매트릭스), 3-1·3-2(계층)
2. `.claude/tasks/medreader-handoff.md` — 환경·함정·일하는 방식
3. 본보기로 삼을 코드: `js/tts/speaker.js`(주입으로 테스트 가능하게 만든 예),
   `js/db.js`, `js/settings.js`, `js/config.js`

## 만들 것

```
js/privacy/redact.js        키·Bearer 토큰을 [KEY] 로 치환
js/privacy/keys.js          세션/로컬 저장, 마스킹 표시값
js/ai/provider.js           공통 complete() · verifyKey() · 오류 매핑 · usage 기록
js/ai/adapters/gemini.js    spec 8-2 의 선언 객체 6함수
js/ai/tokens.js             estimateTokens (8-5)
```

### `redact.js` — 가장 먼저, 가장 꼼꼼히

- 모든 어댑터의 `keyPattern` 과 `Bearer \S+` 를 `[KEY]` 로 바꾼다.
- **문자열뿐 아니라 객체도 받아라** — 에러 객체를 통째로 넘겨도 안전해야 한다.
- 순환 참조가 있어도 죽지 않아야 한다.
- `redact` 가 **빠뜨리는 경우**를 테스트로 찾아라: 키가 문장 가운데 있을 때,
  URL 쿼리에 있을 때, JSON 문자열 안에 있을 때, 여러 개가 있을 때.

### `keys.js`

- 기본 `sessionStorage['medreader.key.{provider}']`. `privacy.rememberKey` 가 켜졌을 때만 `localStorage`.
- **저장 위치를 바꾸면 이전 위치의 값을 지워라** — 기억을 끄면 `localStorage` 에서 사라져야 한다.
- 표시용 마스킹: `AQ.Ab…6l` 꼴(앞 5자 + … + 뒤 2자). **원문을 돌려주는 함수와 이름이
  헷갈리지 않게** 하라.
- `sessionStorage` 가 막힌 환경(프라이빗 모드 등)에서 던지지 마라.

### `provider.js`

- `complete(req, {key, model, signal, fetch})` — 어댑터의 6함수를 엮는다.
- 상태 코드 → `errorParser` → `{code, status, message}`. **429 는 `Retry-After` 를 읽어 넘긴다.**
- **`AbortSignal` 을 존중하라.** 파이프라인(8단계)이 취소한다.
- `verifyKey(key, model)` — spec 8-4 대로 **가장 싼 요청**(gemini: `GET /v1beta/models?pageSize=1`).
  200 → ok · 401/403 → `AUTH` · 429 → **ok 이되 한도 표시** · 네트워크 실패 → `UNKNOWN`(저장은 허용).
- **검증 호출도 `usage` 에 `kind: 'verify'` 로 기록한다**(8-4 — 대시보드 투명성).
- **CORS 실패와 네트워크 실패는 구별이 안 된다**(8-3). 코드로 구분하려 들지 말고
  `UNKNOWN` 으로 두되 호출자가 안내 문구를 고를 수 있게 하라. **문구는 만들지 마라**(3-2).

### `gemini.js`

spec 8-2 표의 gemini 행 그대로. `systemInstruction` · `contents[{role:'user',parts:[{text}]}]` ·
`generationConfig.responseMimeType='application/json'` · `usageMetadata` ·
`finishReason: 'SAFETY'` → `SAFETY` 코드.

`keyPattern = /^(AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_-]{20,})$/`
**패턴 불일치는 경고만** — 저장을 막지 마라(8-4: 형식이 또 바뀔 수 있다).

## 수정 허용 범위

```
apps/medreader/js/privacy/redact.js    신규
apps/medreader/js/privacy/keys.js      신규
apps/medreader/js/ai/provider.js       신규
apps/medreader/js/ai/adapters/gemini.js 신규
apps/medreader/js/ai/tokens.js         신규
apps/medreader/js/config.js            AI 상수만 추가 (LAYOUT·KEEP_HYPHEN_*·TTS·QUIZ 금지)
apps/medreader/js/settings.js          9-3 의 ai.* · privacy.* 키 추가만 (기존 기본값 변경 금지)
apps/medreader/tests/*.test.mjs        신규 추가
```

금지:
- **UI 를 만들지 마라** — 설정 화면은 7b 다. `index.html`·`css/*`·`js/ui/*` 수정 금지.
- **파이프라인·프롬프트·번역·요약을 만들지 마라** — 8단계다.
- `js/text/*`·`js/quiz/*`·`js/tts/*`·`js/pdf/*`·`js/db.js`·`js/router.js`·`js/main.js`
  수정 금지. `db.js` 에 `usage` 스토어는 **이미 있다**(9절). 버그는 보고만.
- `spec.md`·`dev/*` 수정 금지. 기존 **470개** 테스트 기대값 변경 금지.
- `algoVersion`·`parserVersion` 건드리지 마라.
- 커밋·푸시 금지. 레포에 PDF·`node_modules`·`package.json` 금지.
- **진짜 API 키를 요구하거나 찾거나 적지 마라.**

## 테스트

`node --test "apps/medreader/tests/*.test.mjs"` — **디렉터리 인자는 Node 24+Windows 에서 실패한다.**

`fetch` 를 주입하므로 **전부 단위 테스트로 덮인다**. 최소한:

1. **★ 키가 URL 에 안 들어간다** — 스텁이 받은 URL 을 검사해 키 문자열이 없음을 확인.
2. **★ `redact` 가 키를 지운다** — 문장 가운데·URL 쿼리·JSON 안·여러 개·객체·순환 참조.
3. **★ `provider` 가 던지는 오류 메시지에 키가 없다** — 어댑터가 키를 포함한 오류를
   돌려줘도 밖으로 새지 않아야 한다.
4. 상태 코드 매핑 — 200·401·403·429(+`Retry-After`)·500·`TypeError`(네트워크).
5. `verifyKey` 의 네 갈래(ok·AUTH·429=ok+한도·UNKNOWN)와 **`usage` 에 `verify` 기록**.
6. `AbortSignal` 로 취소된다.
7. `keys.js` — 세션↔로컬 이동 시 **이전 위치가 비워진다**, 저장소가 막혀도 안 던진다, 마스킹.
8. `estimateTokens` — 라틴/아랍어·한글 비율 30% 경계.
9. 기존 470개 전부 통과.

**변이 테스트**: `redact` 의 치환을 없애고, 키를 URL 에 넣도록 바꿨을 때
**어떤 테스트가 빨개지는지** 확인하고 보고하라. **안 빨개지면 그 테스트는 헛돌고 있다** —
이 프로젝트에서 실제로 그런 일이 세 번 있었다(픽스처가 대칭이거나, 죽은 코드를 재거나,
좁아진 정규식으로 그 정규식을 검사했다).

## 완료 보고 형식 (한국어로)

1. 생성/수정한 파일과 줄 수.
2. `node --test` **실제 출력**(tests/pass/fail).
3. **키 누출 점검** — 다음을 각각 어떻게 막았고 어떤 테스트가 지키는가:
   URL · 오류 메시지 · `console` · `settings` 스토어 · 저장소 이동.
4. 변이 테스트 결과.
5. `verifyKey` 의 네 갈래를 어떻게 갈랐고, CORS 실패를 어떻게 다뤘는가.
6. spec 과 다르게 구현한 부분. 없으면 "없음".
7. 다른 모듈에서 발견한 버그(**고치지 말고** 보고). 남은 문제 3줄 이내.

**키가 새는 것보다 기능이 없는 편이 낫다.** 막히면 멈추고 보고하라.
**추측을 사실처럼 쓰지 마라** — 확인 못 한 것은 "확인 못 함"이라고 적어라.
