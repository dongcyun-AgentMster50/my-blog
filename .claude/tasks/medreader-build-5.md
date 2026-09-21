# Build 지침 — MedReader 5단계: TTS + 컨트롤 바 + 하이라이트 + 자동 스크롤

## 배경

1~4단계 완료. **지금 PDF 를 열어 리플로우로 읽는 데까지 된다.** 이 단계가 **낭독**을 붙인다.
`[배포 완료]` https://dongcyun-agentmster50.github.io/my-blog/apps/medreader/ — HTTPS 라 Wake Lock·`crypto.subtle` 이 동작한다.

대상 PDF(729쪽)는 임시본이고 곧 **7000쪽 실제 자료**로 교체된다(형식 유사). **특정 서적 튜닝은 하지 마라.**

## 이 단계가 특별한 이유 — 데스크톱에서 검증되지 않는다

spec **6-4** 가 Android Chrome 의 Web Speech API 제약을 표로 정리해 두었다. **이 제약들은 데스크톱 Chrome 에서 재현되지 않는다.** 따라서:

- **조건부로 짜지 마라.** 6-4 의 대응을 **항상** 적용한다(`pause()` 안 쓰기, `onend` 체이닝만, utterance 참조 유지, 워치독, cancel 후 60ms). 그래야 데스크톱에서도 돌고 Android 에서도 돈다.
- **기능 감지로 분기하는 것과 혼동하지 마라.** Wake Lock·음성 목록은 감지해서 없으면 안내한다. 하지만 **버그 대응은 분기 없이 항상** 적용한다.
- 실기기 확인은 사용자가 갤럭시 Z Fold 7 에서 한다. **네가 할 수 없는 것을 했다고 쓰지 마라.**

## 먼저 읽을 것

1. `D:\01_claude_my-blog\.claude\tasks\medreader-handoff.md` — 인계 문서. 현재 상태·함정.
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **6절 전체(6-1 상태 기계, 6-2 onend 체이닝·워치독, 6-3 음성 선택, 6-4 Android 제약 ★, 6-5 하이라이트·자동 스크롤)**. 그 외 12-3(하단 컨트롤 바), 16-C(수용 기준 — 이 단계의 합격선), 16-G(터치), 16-H(RTL), 16-K, 9-3(settings 키), 11절(i18n), 3-2(의존 방향), 20절(함정).
3. `D:\01_claude_my-blog\apps\medreader\review.md` — 각 절의 "다음 단계 주의사항"
4. 소비 대상: `js/ui/reader.js`(★ 4단계가 만든 계약), `js/text/segment.js`, `js/settings.js`, `js/i18n/index.js`, `js/config.js`

## 4단계가 만든 계약 — 그대로 쓰라

```js
import { flowLineIds, lineElement, setCurrent, markDone, currentPage, describePage } from './ui/reader.js';
```

- **`flowLineIds()`** — 지금 DOM 에 있는 **그 한 쪽**의 낭독 대상 줄 id 를 읽기 순서로 준다.
  `span.line[data-flow="1"]` 이고, 머리말·꼬리말·쪽번호·회전 줄은 `data-flow="0"`(접힌 `details` 안)이라 **낭독에서 반드시 빼야 한다.** 표 줄은 아예 DOM 에 없다.
- **`setCurrent(lineId)`** — `.is-current` 를 옮긴다. **그 줄이 현재 쪽에 없으면 `false`** 를 돌려준다 → 쪽을 먼저 넘기고(`location.hash`) 그다음 부른다.
- **`markDone(lineId)`** — 이미 읽은 줄 표시(`--hl-done`).
- **`describePage()`** — `lines[i].hyphen !== 'none'` 이 "다음 줄과 이어진다"를 뜻한다(`'hidden'` = 하이픈 삭제, `'kept'` = 하이픈 유지).
- **쪽이 바뀌면 DOM 이 통째로 갈린다.** 요소 참조를 들고 있지 말고 **`lineId` 를 들고 매번 다시 찾아라.**
- 하이라이트 색은 테마별 `--hl-bg`/`--hl-text`/`--hl-done`(`tokens.css`)에 **이미 준비되어 있다.**

### ★ 함정 — `span.line.textContent` 를 그대로 음성 엔진에 넣지 마라

하이픈 결합 줄은 끝의 `-` 를 `span.hy`(`display:none`)로 **감췄을 뿐 텍스트에는 남아 있다**(12-4 요구). 그대로 읽히면 **"cardio 대시"** 가 된다. 6-1 이 "하이픈 결합 줄은 다음 줄과 합쳐 하나의 utterance" 라고 정했으니 그렇게 하고, 남는 `-` 는 반드시 털어라.

## 수정 허용 범위

```
apps/medreader/js/tts/speaker.js     신규 — 상태 기계·onend 체이닝·워치독 (6-1·6-2·6-4)
apps/medreader/js/tts/voices.js      신규 — loadVoices·pickVoice (6-3)
apps/medreader/js/tts/text.js        신규 — 낭독용 텍스트 정규화(하이픈·기호·URL)
apps/medreader/js/ui/controls.js     신규 — 하단 컨트롤 바
apps/medreader/js/ui/reader.js       수정 허용 — linechange 수신·자동 스크롤·줄 탭만
apps/medreader/css/reader.css        수정 허용 — 컨트롤 바·하이라이트·[현재 줄로] 칩
apps/medreader/index.html            수정 허용 — 리더 화면 안쪽(컨트롤 바)만
apps/medreader/js/config.js          수정 허용 — TTS_SYMBOLS 등 상수 추가만
apps/medreader/js/i18n/{en,ar,fr,ko}.js  수정 허용 — 이 단계 키 추가만 (4개 전부)
apps/medreader/tests/*.test.mjs      신규 추가
```

금지:
- **`js/text/*`·`js/db.js`·`js/hash.js`·`js/pdf/*`·`js/router.js`·`js/settings.js`·`js/ui/library.js`·`js/ui/onboarding.js`·`js/ui/typeset.js` 수정 금지.** 버그를 찾으면 고치지 말고 **보고서에 적어라.**
- **`config.js` 의 `KEEP_HYPHEN_SUFFIXES` 는 사용자가 직접 채운 값이다.** 건드리지 마라. `LAYOUT` 기존 값도 바꾸지 마라.
- `spec.md`·`dev/*` 수정 금지. 기존 205개 테스트 기대값 변경 금지.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**
- **원본 뷰(6단계)·AI(7단계)·퀴즈(9단계)를 만들지 마라.** 6-5 의 "줄 탭 → 번역"은 **7단계 몫**이므로 이 단계에서는 **낭독 중 탭 = 그 줄부터 이동**만 구현하고 번역 쪽은 자리만 남긴다.

## 구현 요구사항

### `js/tts/speaker.js` — 6-1·6-2·6-4

- 상태: `'idle' | 'speaking' | 'paused' | 'waiting-page' | 'error'`. 이벤트: `linechange`·`statechange`·`voices`·`end`·`error`.
- API: `play(fromLineId?)` · `pause()` · `resume()` · `stop()` · `next()` · `prev()` · `setRate(0.5~2.0)` · `setVoice(lang, voiceURI)`. **spec 6-1 의 전이표 그대로.**
- **낭독 큐**: 읽기 순서의 낭독 가능 줄(`flowLineIds()`). 쪽 끝에 닿으면 다음 쪽 목록을 이어 붙인다. 다음 쪽이 미추출이면 **추출 우선 요청 + 최대 5초 대기**, 그동안 `'waiting-page'` 와 UI 안내.
- **문장 모드가 기본이다**(6-1, 2026-09-21 수정). `text/segment.js` 로 문단을 문장으로 나누고, **하이라이트는 문장이 걸친 모든 줄에 준다.** 줄 모드는 설정으로 선택.
- **6-4 의 대응을 항상 적용하라**:
  - `speechSynthesis.pause()` **쓰지 마라.** 일시정지 = `cancel()` + 현재 lineId 기억. 재개 = 그 줄 처음부터.
  - **utterance 를 모듈 스코프 변수에 유지**(GC 로 `onend` 유실).
  - **워치독**: `expectedMs = (len / (14 * rate)) * 1000 + 3000`, 그 **2배**에서 `cancel()` + 다음 줄.
  - `cancel()` 직후 `speak()` 가 씹히므로 **60ms 뒤**에 speak.
  - 첫 `speak()` 는 **탭 핸들러 안에서 동기적으로** 호출(앞에 `await` 두지 마라).
  - 큐를 한 번에 `speak()` 로 쌓지 마라. **항상 utterance 1개**, `onend` 에서 다음.
  - `onstart` 가 안 오는 환경 대비: `speak()` 직후 `linechange` 를 먼저 내고 `onstart` 에서는 같은 lineId 면 무시.
  - `onerror`: `interrupted`/`canceled` 는 우리가 취소한 것 → 무시. `not-allowed` → `'error'` + `TTS_NOT_ALLOWED`. 그 외 1회 재시도 후 다음 줄 + `TTS_LINE_SKIPPED`.
  - **문장 300자 초과**면 쉼표·세미콜론에서 분할해 여러 utterance 로 읽되 하이라이트는 유지.
- **Wake Lock**: 재생 시작 시 `navigator.wakeLock.request('screen')`, `visibilitychange` 로 다시 보이면 재획득. 미지원·거부면 안내(i18n).
- **`visibilitychange` → hidden 이면 `pause()`** 로 전환하고, visible 시 **자동 재개하지 않는다**(6-4). [재생] 버튼을 보여준다.
- **서비스 계층 규칙**(3-2): `speaker` 는 **코드·이벤트만** 낸다. UI 문자열을 만들지 마라.

### `js/tts/voices.js` — 6-3

- `loadVoices()` — `getVoices()` 가 비면 `voiceschanged` 대기 + **1.5초 타임아웃**.
- `pickVoice(lang, voices, preferredURI?)` — 우선순위: `preferredURI` 일치 > `localService=true` > 이름에 `Google` > 첫 번째.
- **`voice.lang` 정규화**: Android 는 `en_US` 처럼 언더스코어가 온다.
- 언어별 가용성 `{en, ar, fr, ko}` 계산.
- **영어 음성 없음 배너**(6-3): i18n 4개 언어, 세션당 1회, 닫기 가능. 안내 문구는 spec 6-3 그대로.

### `js/tts/text.js`

- 낭독용 텍스트 정규화: **하이픈 결합 줄의 남은 `-` 제거**, URL·이메일 → `"link"`, 기호 치환(`≥ ≤ ± µ →  %`)은 `config.js` 의 **`TTS_SYMBOLS`** 표로.
- **순수 함수로 만들고 테스트하라.** 이 단계에서 `node --test` 로 검증 가능한 가장 큰 덩어리다.

### `js/ui/controls.js` — 12-3 하단 컨트롤 바

- [재생/일시정지] · [이전 줄] · [다음 줄] · 속도(0.5~2.0, 0.1 단계) · 진행 표시.
- **터치 타깃 48px 이상**(16-G). 재생 버튼은 더 크게.
- 쪽이동 바(`.pager`)와 **겹치지 않게** 배치하라 — 이미 하단에 고정돼 있다(`--pager-h`·`--notice-total` 토큰 참고). 컨트롤 바가 생기면 리더 본문 아래 여백도 그만큼 늘려야 한다.
- 모든 문구 `data-i18n`/`t()`. **하드코딩 금지.**

### `js/ui/reader.js` 수정 — 6-5

- `speaker` 의 `linechange` 를 받아 `setCurrent(lineId)`. **줄이 현재 쪽에 없으면 쪽을 먼저 넘긴다.**
- **자동 스크롤**: 현재 줄이 "편안 영역"(**상단 30%~하단 65%**) 밖일 때만 `scrollIntoView({block:'center'})`. `prefers-reduced-motion` 이면 `behavior:'auto'`. **줄마다 스크롤하지 마라 — 화면이 흔들려 눈 피로가 악화된다.**
- **사용자가 직접 스크롤하면 자동 스크롤 일시 해제** + 하단에 **[현재 줄로 돌아가기]** 칩. 칩을 누르거나 다음 문단으로 넘어가면 복구. 프로그램 스크롤과 사용자 스크롤을 **최근 800ms** 로 구분.
- **줄 탭**: 낭독 중이면 **그 줄부터 이동**. 낭독 중이 아니면 이 단계에서는 아무 것도 하지 않는다(번역은 7단계).

## CSS 규칙 — 지금 0건이다

**`left`/`right`/`margin-left`/`margin-right`/`padding-left`/`padding-right`/`border-left`/`border-right`/`text-align:left|right` 를 쓰지 마라.** 16-H 가 grep 0건을 요구한다. RTL 에서 [이전]/[다음] 아이콘은 논리 순서를 따르므로 자동으로 뒤집힌다.

## 테스트 (`node --test`)

`speechSynthesis` 는 Node 에 없다. **순수하게 떼어낼 수 있는 것을 떼어내라**:
- **`tts/text.js` 전부** — 하이픈 남은 `-` 제거, URL→link, 기호 치환, 300자 분할.
- **낭독 큐 생성** — 줄 목록 + 하이픈 결합 + 문장 분할 → utterance 단위 목록(순수 함수).
- **워치독 시간 계산**.
- **상태 전이표**(6-1) — `speechSynthesis` 를 스텁으로 주입할 수 있게 설계하고 전이를 검증하라.
- `pickVoice` 우선순위 + `en_US` 정규화.
- i18n 키 집합 일치(키를 추가하면 **4개 언어 전부**).
- 기존 205개 전부 통과.

## 스모크 테스트 (데스크톱에서 할 수 있는 것만)

`preview_start {name:"blog"}` → `http://localhost:8000/apps/medreader/index.html` (**새 탭**).

1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과.
2. 합성 문서로 재생 → **하이라이트가 줄을 따라 이동**하는지, `onend` 체이닝이 도는지.
3. 일시정지 → 재개 → **같은 줄부터** 다시 읽는지.
4. [다음 줄]/[이전 줄], 속도 변경이 **즉시** 반영되는지.
5. 쪽 끝 → **다음 쪽으로 이어지는지**.
6. 사용자가 스크롤 → 자동 스크롤 해제 + **[현재 줄로] 칩** → 누르면 복구.
7. **CSS 물리속성 grep 0건**, 375px 가로 스크롤 0, **콘솔 에러·경고 0건**.
8. `speechSynthesis` 를 스텁으로 갈아 **`onend` 가 안 오는 상황**을 만들어 **워치독이 실제로 다음 줄로 넘어가는지**. ← 이 단계에서 가장 중요한 방어 장치다.

## 완료 보고 형식

1. 생성/수정한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail).
3. 스모크 8개 각각 ○/× 와 근거. 스크린샷이 파일로 안 남으면 "세션 브라우저 패널에서 확인"이라고 정직하게 적어라. **없는 경로를 지어내지 마라.**
4. **6-4 표의 8개 제약 각각을 어떻게 대응했는지** 한 줄씩. 데스크톱에서 재현할 수 없는 것은 "코드로 대응, 실기기 미검증"이라고 정직하게 적어라.
5. spec 과 다르게 구현한 부분. 없으면 "없음". 다른 모듈에서 발견한 버그가 있으면 여기에(고치지 말고).
6. 남은 문제.
7. **사용자가 갤럭시 Z Fold 7 에서 확인할 절차** — 5줄 이내. 16-C 의 수용 기준 중 **실기기에서만 확인되는 것**(화면 꺼짐 중 낭독 지속, 음성 팩 유무, 백그라운드 전환)을 구체적으로.

**속도가 중요하다.** 테스트를 통과시키려고 spec 을 어기지 마라. 막히면 멈추고 보고하라.
