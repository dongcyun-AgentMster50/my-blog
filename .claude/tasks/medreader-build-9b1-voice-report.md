# Build 보고서 — 9b-1 음성 명령: 순수 매칭 + 인식 서비스 (화면 변화 0)

> 지침: `.claude/tasks/medreader-build-9b1-voice.md` · 설계: spec 17-1-2(9b-D1–D14 권장안). 2026-11-15. **커밋하지 않음.**
> 9a Build 와 같은 작업 트리 — **새 파일만** 만들었다. 기존 파일은 한 글자도 고치지 않았다(`git status` 의 `M` 목록은 시작 때와 같고, 전부 9a 몫). stamp 를 찍지 않았다.

## 1. 만든 파일 (4개)

| 파일 | 줄(약) | 내용 |
|---|---|---|
| `apps/medreader/js/voice/commands.js` | 330 | **순수.** `VOICE_COMMANDS`(명령 10 = 9 + explain 자리 `enabled:false`) · `normalizeUtterance`/`normalizeBase` · `matchCommand(alternatives, lang)` · `resolveCmdLang(setting, uiLang)` · `stepRate(current, dir)` · `SHARED_FORMS`(의도된 공유 — 지금 `{}`) · `FILLERS` · `MAX_ALTS = 5` · `commandById` · `tablesFor`. import: `text/specialty.js` 의 `foldArabic`(고치지 않음) · `config.js` 의 `TTS.RATE_STEPS` |
| `apps/medreader/js/voice/listen.js` | 330 | **서비스.** `createListener({Recognition, timers, available, onLine, micState, loadTag, saveTag, now, opts})` → `start(lang)`·`abort()`·`isListening()`·`isSupported()`·`preflight(lang)`·`skipped()`·이벤트. 순수 도우미 `classify(raw, ctx)`·`tagsFor(lang, remembered, skip)`·`alternativesOf(ev, max)`·`isInfra(code)` · `CODES` · `LISTEN_DEFAULTS`. import: `config.js` 의 `TTS_LANG_REGION`(영어 태그) 하나 |
| `apps/medreader/tests/voice-commands-9b.test.mjs` | 300 | C1–C11 (12 test) |
| `apps/medreader/tests/voice-listen-9b.test.mjs` | 420 | L1–L13 (13 test) — 가짜 인식기 클래스 · 가짜 시계(now 포함) |

### listen.js 이벤트 계약 (9b-2 `ui/voice.js` 가 쓴다)

한 누름 = 끝 이벤트 **정확히 하나**(`result` | `error` | `cancel`) + 그 뒤 `end` 한 번. 끝난 뒤 늦게 오는 인식기 콜백은 세대 번호로 무시.

| 이벤트 | detail |
|---|---|
| `result` | `{alternatives:[{transcript, confidence}] (≤5, 빈 글자 뺌), tag, ms, tried:[태그…]}` |
| `error` | `{code, raw, tag, ms, tried}` — `code` ∈ `CODES` |
| `cancel` | `{tag, ms, tried}` — `abort()` |
| `fallback` | `{from, to}` — 사다리 한 칸 내려감(UI: "다시 말해 주세요") |
| `end` | `{outcome:'result'|'error'|'cancel'}` |

## 2. 설계에서 9b-1 이 정한 것 · 달라진 것 (Review 가 볼 곳)

| # | 무엇 | 설계 | 이번 구현 · 이유 |
|---|---|---|---|
| B1 | 사다리 다시 시작 시점 | "같은 누름 안에서 곧장 다시 `start()`" | **앞 인식기의 `end` 를 기다린 뒤**(상한 `RETRY_WAIT_MS` 300ms — 안 오면 앞 것을 `abort()` 하고 시작). 앞 인식기가 살아 있을 때 새로 시작하면 Android 가 `RECOGNIZER_BUSY` → `not-allowed` 로 돌려줄 수 있다(S7) — 그러면 "권한 거부"로 잘못 안내. 제스처는 어차피 오류 콜백 안이라 잃는다(둘 다 같음) `[가정 — 실기기 V-1]` |
| B2 | `available()` 이 **전부** `'unavailable'` | "`'unavailable'` 만 건너뛴다" | 하나라도 남으면 그대로 건너뛴다. **전부**면 그 답을 믿지 않고 사다리 전부를 시도(`tagsFor`). Android 의 `available()` 신뢰도를 모르므로 음성 명령이 통째로 죽는 길을 막는다. 비용은 오류 1–3번 |
| B3 | 기억한 태그가 끝까지 실패 | 언급 없음 | 기억한 태그(`ar-JO`/`ar`)부터 끝까지 `language-not-supported` 면 `saveTag('')` — 다음 누름은 사다리 맨 위부터 |
| B4 | `not-allowed` 의 두 뜻 | 5절 표엔 "권한 거부" 한 줄 | `classify` 가 **`permission`/`busy`** 로 가른다: 주입한 `micState()` 가 `'denied'` → permission, `'granted'` → busy; 모르면 이번 시도에서 `onstart`/`onaudiostart` 가 왔거나 이 서비스에서 결과를 한 번이라도 받았으면 busy, 아니면 permission. **busy 는 5절 표에 없는 새 행** → i18n 키 `voice.err.busy` 제안(아래 4) |
| B5 | 분류 코드 | 5절 표 | 표의 갈래 + `busy`·`aborted`(우리가 부르지 않은 중단 — Android `CLIENT`, 다른 앱이 오디오를 가져감 등)·`unsupported`(생성자 없음). 결과 없이 `end` → `noSpeech`, 인식기 `no-match`/`onnomatch`/대안 0 → `noMatch`, `bad-grammar`·`phrases-not-supported`·모르는 값 → `service` |
| B6 | 앱 상한 | `LISTEN_MAX_MS` 8000 | **시도마다** 새로 잰다(언어 불가는 듣기 전에 오므로). 최악 = 사다리 3칸 × 8초 |
| B7 | "가장 긴 구"의 길이 | "가장 긴 동의어" | **낱말 수**로 잰다. 글자 수로 재면 «next previous» 가 previous(8자)로 가 버려 모호 판정이 안 된다 |
| B8 | `exact` 낱말 | 예: «بس»·«يلا»·«الترجمة» | 이 셋 + «خلص»·«لحظة»·«استنى»(군말처럼 문장 앞에 붙는 "그만/잠깐") + 영어 `go`·`wait`. 효과: «خلص التالي» → next, «wait go back» → prev, «go now» → 무시 `[검토 — Nour·운영자]` |
| B9 | 영어 동의어 | 표 그대로 | `'read again'`(again) 하나 더함 — 없으면 read(play)·again 이 같은 길이로 모호 |
| B10 | 아랍어 모드의 영어 표 | "두 번째로 본다" | 아랍어 표에 **후보가 하나도 없을 때만** 영어 표. 아랍어 표에서 모호면 그 대안은 무효(영어 표로 넘어가지 않음) |
| B11 | `EN_TAG` | `VOICE.EN_TAG: 'en-US'` | `TTS_LANG_REGION.en` 을 읽는다 — `'en-US'` 를 박으면 기존 `tests/srclang-wiring-7c.test.mjs` W1("지역 태그는 config 한 곳")이 빨갛게 된다(실제로 처음 전체 실행에서 걸렸고 고쳤다) |
| B12 | commands.js 의 import | 7절 본문 "`foldArabic` 만 import" | `config.js` 의 `TTS.RATE_STEPS` 도(`stepRate`). 7절 import 방향 행("`config`·`text/*` 만")에는 맞는다. 계단을 두 곳에 적지 않으려고 |
| B13 | 정규화 문장부호 | `.,!?؟،؛…"'«»-` | 그 목록 + 유니코드 문장부호 전부(`\p{P}`) |

## 3. 검증

### 3-1. 네 테스트 두 파일 (`node --test tests/voice-commands-9b.test.mjs tests/voice-listen-9b.test.mjs`)

| 회 | tests | pass | fail |
|---|---|---|---|
| 1 | 25 | 25 | 0 |
| 2 | 25 | 25 | 0 |

(W1 고친 뒤 다시 2회 — 같은 결과.)

설계 9절 `[N]` 중 9b-1 몫: **V1**(C1·C2) · **V2**(C3·C4·C5) · **V3**(C6) · **V4**(C7) · **V5**(L3·L4·L5·L6) · **V6**(L7·L8) 전부. 더해서 동기 시작(L1 — V7 의 서비스 쪽 절반), 한 번에 하나(L9 — V11 의 서비스 쪽), 취소(L10), 미지원(L11 — V12 의 서비스 쪽), 오프라인 시도(L12 — 9b-D9), import 방향(C11·L13), 명령 표 무결성(C3 — 같은 정규화 꼴이 두 명령에 있으면 실패, 의도된 공유는 `SHARED_FORMS` 목록과 정확히 같아야), 정규화 표(C1 28줄).

### 3-2. 전체 `node --test apps/medreader/tests/*.test.mjs` (1회 + W1 고친 뒤 1회)

| 실행 | tests | pass | fail |
|---|---|---|---|
| 첫 실행 | 1435 | 1429 | 6 — `importmap` 5 + `srclang-wiring-7c` W1 |
| W1 고친 뒤 | 1435 | 1430 | **5 — 전부 `importmap.test.mjs`(IM1·IM2·IM5·IM6·IM7b)** |

- **남은 5개는 내 탓이다**: 새 모듈 `js/voice/commands.js`·`listen.js` 가 import map 에 없다(IM1 "표에 없는 모듈", IM2 해시 목록도 이 두 파일**만** 나온다 → 9a 파일 탓은 없음). stamp 금지라 그대로 둔다 — **9b-2(또는 오케스트레이터)가 `node apps/medreader/dev/stamp-importmap.mjs` 를 돌리면 풀린다**. 앱 화면은 이 두 모듈을 아직 아무 데서도 import 하지 않으므로 배포해도 무해(9b-1 = 화면 변화 0).
- W1(`'en-US'` 문자열)은 내 `listen.js` 탓이었고 `TTS_LANG_REGION.en` 으로 고쳤다(B11).
- 9a 진행 중 파일 탓 실패: 이번 두 실행에서는 **없음**.

### 3-3. 변이 (새 파일만 · 백업 `b9b1/bak/` · 복원 = 백업을 읽어서 쓰기 + `cmp`)

| # | 변이 | 결과 | 복원 cmp |
|---|---|---|---|
| M1 | 가장 긴 구 우선 끄기(첫 후보 길이 고정) | 빨강 C6 | 같음 |
| M2 | `exact` 조건 지우기 | 빨강 C5 | 같음 |
| M3 | `foldArabic` 대신 따로 만든 접기 | 빨강 C1·C2 | 같음 |
| M4 | 숫자 떼기 끄기 | 빨강 C6 | 같음 |
| M5 | 사다리 기억(저장) 끄기 | 빨강 L2·L3 | 같음 |
| M6 | 사다리 기억(읽기) 끄기 | 빨강 L3·L5 | 같음 |
| M7 | 사다리 한 칸 내려가기 끄기 | 빨강 L3·L4·L5·L9·L10 | 같음 |
| M8 | `not-allowed` 바쁨 구분 지우기 | 빨강 L7·L8 | 같음 |
| M9 | `rec.start()` 를 타이머 뒤로(비동기) | 빨강 L1·L3·L8·L9·L12 | 같음 |
| M10 | `unavailable` 건너뛰기 끄기 | 빨강 L5·L6 | 같음 |

10/10 빨강 → 복원 → 네 파일 모두 백업과 `cmp` 같음. 변이 스크립트: 스크래치패드 `b9b1/mutate.mjs`.

## 4. 9b-2 에 넘길 것

1. **stamp** — `js/voice/*.js` 두 모듈이 import map 에 없다(IM 5개 빨강). 9b-2 의 다른 변경과 함께 `stamp-importmap` 한 번.
2. **상수 옮기기** — `commands.js` 의 `MAX_ALTS`, `listen.js` 의 `LISTEN_DEFAULTS` → `config.js` `VOICE`. 주의:
   - `VOICE.EN_TAG` 는 **`TTS_LANG_REGION.en` 을 가리키게** 할 것. `'en-US'` 를 config 에 한 번 더 쓰면 W1(config 허용 1회)이 빨갛게 된다.
   - `RETRY_WAIT_MS: 300` 을 `VOICE` 에 더한다(B1).
   - `listen.js` 는 `createListener({opts: VOICE})` 로 받거나 config 를 직접 import(3-2 서비스 행 = config 허용). L13 은 import 가 `../config.js` 하나인지만 본다.
3. **배선**(`ui/voice.js`): `Recognition = window.SpeechRecognition || window.webkitSpeechRecognition`(없으면 단추 없음) · `onLine: () => navigator.onLine` · `micState`: 리더 진입 때 `navigator.permissions?.query({name:'microphone'})` 를 try/catch 로 물어 캐시하고 `onchange` 로 갱신 · `loadTag/saveTag` = 설정 `voice.tag` · 리더 진입 때(제스처 밖) `listener.preflight(lang)` · 결과 → `matchCommand(detail.alternatives, lang)` → `id`/`enabled`/`altIndex`/`heard`/`trace` 로 실행·안내·디버그 기록(최근 `HISTORY` 10, 메모리만) · `lang = resolveCmdLang(settings.get('voice.cmdLang'), uiLang)` · 속도는 `stepRate(speaker.getRate(), ±1)` → `edge` 면 `voice.rate.min/max`.
4. **분류 코드 → 안내** (5절 표 + 새 행):

| `CODES` | 인프라(`isInfra`) | 제안 키 | 비고 |
|---|---|---|---|
| `unsupported` | — | `voice.unsupported` | 단추 숨김(설정 줄 한 줄) |
| `permission` | ○ | `voice.err.permission` | |
| `busy` | ○ | **`voice.err.busy`(새)** | "음성 인식을 다른 곳에서 쓰고 있습니다 — 잠시 뒤 다시 누르세요" + 이어폰 문구 |
| `service` | ○ | `voice.err.service` | |
| `network` | ○ | `voice.err.network` | |
| `offline` | ○ | `voice.err.offline` | |
| `mic` | ○ | `voice.err.mic` | |
| `lang` | ○ | `voice.err.lang` | |
| `noSpeech` | — | `voice.noSpeech` | 음성 없음, 되돌림 |
| `noMatch` | — | `voice.noMatch` + `voice.noMatch.say` | 인식기가 못 알아들은 경우(`heard` 빈 글자) — 매칭 nomatch 와 같은 안내 |
| `aborted` | — | (문구 없음 제안) | 우리가 부르지 않은 중단 — 사용자 취소처럼 조용히, **되돌림은 함** 제안 |
| (cancel 이벤트) | — | 없음 | 사용자 취소 — 되돌림 없음(흐름 3-6) |
| (fallback 이벤트) | — | **`voice.retry`(새)** | "다시 말해 주세요"(사다리 한 칸) — `voice.noMatch.say` 와 같은 문장이면 그 키를 다시 써도 된다 |

5. **i18n 키 이름(값은 9b-2 가 4개 언어로)** — 설계 7절 "약 22키"의 이름 제안:
   `voice.btn`(단추 aria-label) · `voice.listening`("말하세요…") · `voice.heard`(«{text}») · `voice.cmd.play|pause|next|prev|again|trOn|trOff|slower|faster`(확인 줄 9) · `voice.notYet`(explain — "아직 없는 기능") · 위 표의 오류 키 + `voice.err.busy`·`voice.retry` · `voice.earphoneOk`("이어폰 버튼과 화면 버튼은 그대로 됩니다") · `voice.rate.min`·`voice.rate.max` · 고지 카드 `voice.notice.title|body|start`(취소는 기존 공용 키) · 설정 줄 `voice.set.enabled|cmdLang|sayErrors|try|list` · [말해 보기] 결과 복사 `voice.try.copy`. 아랍어 문구 `[검토 — Nour·운영자]`.
6. **3-2 import 방향 표**에 두 줄(spec): `voice/commands.js` 순수(`text/specialty.js`·`config`) · `voice/listen.js` 서비스(`config`).
7. 흐름 쪽(V7–V12)은 `tests/voice-ui-9b.test.mjs` 몫. listen 의 `start()` 가 동기라는 것은 L1·M9 가 지키니, ui 쪽은 "`speaker.pause()` 다음 같은 호출 안에서 `listener.start()`"만 보면 된다.

## 5. 마지막 실기기 점검 묶음 (17-1-2 9절 V-1~V-10 과 맞춤 — 9b-1 이 더한 것 ★)

| # | 볼 것 | 9b-1 에서 걸린 곳 |
|---|---|---|
| V-1 | 쓰인 태그(`tried`·`tag`)·사다리 어디까지 · 조용한 언어 바뀜(S4) · ★ `language-not-supported` 가 **듣기 전에** 오나 · ★ 사다리 재시작이 `end` 대기(B1)로 매끄러운가, 300ms 상한이 걸리나 · ★ `available()` 이 Android 에 있나, 답이 무엇인가(B2) | `listen.js` `tagsFor`·`onerror`·`preflight` |
| V-2 | VPN 켬/끔 — 성공 / `network` | `classify('network')` |
| V-3 | 누름 → 결과 ms(`detail.ms`) 중앙값 | `LISTEN_MAX_MS` |
| V-4 | 9개 × 2번 — 맞은 비율 · `altIndex` · 못 맞춘 말(`trace`) · ★ 확신도 값이 실제로 1.0 으로 채워지나(S8 — 문턱 재검토 재료) · ★ `exact` 낱말(B8)이 혼자 말할 때 잡히나 | `commands.js` 표 |
| V-5 | 낭독 꼬리가 인식 글자에 섞이나 | (9b-2 흐름) |
| V-6 | 이어폰 마이크 | — |
| V-7 | 9a 무음 오디오 뒤 알림·이어폰 단추 | — |
| V-8 | 첫 권한 대화 · 거부 뒤 안내 · 비행기 모드 · ★ 권한 거부가 `not-allowed` + `onstart` 없이 오나(그래야 `permission` 으로 분류 — B4) · ★ 다른 앱이 마이크를 쓰는 중(통화 녹음기 등)에 누르면 `busy`/`mic` 중 무엇이 오나 | `classify` |
| V-9 | 이어폰 길게 | — |
| V-10 | 듣는 중 화면 끄기 → 조용한 취소 · ★ 그때 인식기가 `aborted` 를 보내도 `cancel` 하나로 끝나나 | `abort()` 세대 무시 |

## 6. spec 정정 줄 초안 (spec 은 고치지 않았다)

- 17-1-2 4절 "매칭" 1의 예 «التالي والسابق»: 같은 절의 "낱말 일부 일치는 하지 않는다" 때문에 «والسابق»(و 붙음)은 후보가 아니다 → 실제 결과는 **`next`**(C6 이 고정). 모호의 예는 «التالي السابق»·«التالي و السابق» 로 바꾼다.
- 17-1-2 4절 "가장 긴 동의어": "**낱말 수**가 가장 많은 동의어"로(B7).
- 17-1-2 4절 아랍어 태그 사다리: "곧장 다시 `start()`" → "앞 인식기의 `end`(상한 `VOICE.RETRY_WAIT_MS` 300ms) 뒤 다시 `start()` — 앞 것이 살아 있으면 `not-allowed`(바쁨)가 올 수 있다(S7)". 덧붙여 "`available()` 이 사다리 전부를 `'unavailable'` 이라 하면 믿지 않고 전부 시도" · "기억한 태그부터 끝까지 실패하면 기억을 지운다"(B2·B3).
- 17-1-2 5절 표: 행 **"인식기 바쁨"** 추가 — 감지 `not-allowed` + (마이크 권한 `granted` 또는 듣기 시작 뒤 또는 이번 세션에 결과를 받은 적 있음) → `voice.err.busy` + 이어폰 문구, 단추 남김. 행 **"시스템 중단"**(`aborted`, 우리가 부르지 않음) → 문구 없음·되돌림.
- 17-1-2 7절 `config.js` 행: `VOICE` 에 `RETRY_WAIT_MS: 300` 추가, `EN_TAG` 는 `TTS_LANG_REGION.en`(값을 다시 적지 않음 — W1).
- 17-1-2 7절 새 파일 행: `voice/commands.js` 는 `foldArabic` + `config` 의 `TTS.RATE_STEPS`(`stepRate`) · `voice/listen.js` 는 `config`(`TTS_LANG_REGION`) — "import 0" 아님. `createListener` 의존성에 `onLine`·`micState`·`loadTag`·`saveTag`·`now` 추가, 이벤트에 `cancel`·`fallback`·`end{outcome}` 추가(1절 계약 표).
- 17-1-2 4절 명령 표: `exact` 낱말 목록(B8)과 영어 `read again`(B9)을 표에 반영 `[검토 — Nour·운영자]`.

## 7. 남은 문제 · 위험

- **IM 5개 빨강** — stamp 전까지(위 4-1). 이 상태로 커밋하면 `importmap.test` 가 빨갛다 → 9b-1 을 따로 커밋하려면 stamp 를 같이 해야 한다(9a 의 stamp 와 순서 조율 필요 — 오케스트레이터 판단).
- 아랍어 동의어·군말·`exact` 선택 전부 `[검토 — Nour·운영자]`. 특히 «ترجمة»(관사 없음)는 `exact` 로 두지 않았다 — «وقف ترجمة» 는 pause·trOn 이 같은 길이라 **모호(아무 일 없음)**. trOff 로 가게 하려면 «وقف ترجمة» 같은 꼴을 동의어로 더해야 한다(V-4 자료로).
- 정규화는 spec 목록만 접는다 — 페르시아 글자 `ی`·`ک`(→ ي·ك)는 접지 않는다(아랍어 인식기는 표준 글자를 낸다고 봄 `[가정]`).
- `busy`/`permission` 구분은 휴리스틱(B4) — 첫 사용에서 인식기가 바빠 `onstart` 전에 `not-allowed` 가 오면 permission 으로 잘못 안내될 수 있다. `micState` 를 9b-2 가 채우면 대부분 풀린다(Chrome Android 의 `permissions.query({name:'microphone'})` 지원은 V-8 에서 확인).
- 이 단계는 브라우저를 쓰지 않았다(화면 변화 0 — 지침). 실제 `SpeechRecognition` 과의 동작은 9b-2 의 `[D]` 데스크톱 확인과 위 실기기 묶음에서.
