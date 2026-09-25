# Build 지침 — MedReader 10a단계: 하이라이트를 낭독 문장에 정확히 맞춘다

## 왜 지금 하는가 — 실기기 결함

`[실기기 · 갤럭시 Z Fold 7]` 사용자 보고 그대로:

> "읽는 부분 이전에서 오버레이가 되거든, 문장의 첫시작과 마지막을 가리키지 않고
> **두 줄, 세 줄의 블럭**을 가리키면서 읽는 경향이 있어. 오버레이와 낭독부분이
> 일치하지 않음. **원본도, 본문도 둘 다** 그래!"

`[실기기 캡처]` "resolved in the past 5 days. His mobility is limited, and the pain
improves with lying down. The pain is localized to" — 한 문장을 읽는데 **앞뒤 문장 조각까지**
칠해져 있다. 진행 표시는 `84중 57번째 줄`.

## 원인 (오케스트레이터가 코드에서 확인함 — 다시 조사하지 마라)

**단위가 어긋났다.** 5단계에서 낭독 단위를 줄 → **문장**으로 바꿨는데
**하이라이트 단위는 줄로 남겨** 뒀다. `js/tts/text.js:120` 주석이 그대로 말한다:

> "문장이 걸친 **모든 줄**을 `lineIds` 로 돌려준다(하이라이트가 전부에 간다)."

문장이 줄 중간에서 시작하면 그 줄의 **앞부분까지** 칠해진다. 그게 사용자가 본 것이다.

**고칠 데이터는 만들 필요가 없다.** `text.js` 의 `spansIn()` 이 줄별 문자 구간을
**이미 계산**하고, `emit()` 이 `lineIds` 만 남기고 `start`/`end` 를 버린다.

## 먼저 읽을 것

1. `apps/medreader/spec.md` — **6-5 의 `[수정 2026-09-25 — 10a]`** (하이라이트 단위 ★),
   **4-12 의 `[수정 2026-09-25 — 10a]`** (원본 오버레이 다중 상자 ★), 6-1, 6-4
2. `.claude/tasks/medreader-handoff.md` — 환경·함정
3. 대상 코드: `js/tts/text.js`(`joinPieces`·`spansIn`·`emit`),
   `js/ui/reader.js`(`setCurrentLines`), `js/ui/original.js`(`moveOverlay`·`unionBox`),
   `js/pdf/render.js`(`viewportRect`), `css/reader.css`

## 만들 것 셋

### ① `Unit.ranges` — 문자 구간을 버리지 말고 들고 나온다

```
Unit.ranges: [{ id, start, end }]   // start/end 는 **그 줄 텍스트 안의** 오프셋
```

`lineIds` 는 **그대로 둔다** — 기존 호출부(`indexOfLine`·`goToPageForSpeech`·자동 스크롤)가
전부 그걸 쓴다. `ranges` 는 더하기만 한다.

- 줄 로컬 오프셋 = `max(sp.start, from) - sp.start` ~ `min(sp.end, to) - sp.start`
- **`splitLong` 으로 발화가 쪼개지면(`parts.length > 1`) `ranges` 를 붙이지 마라.**
  `normalizeSpeech`·`splitLong` 이 문자열을 바꿔 오프셋 대응이 깨진다.
  그때는 지금처럼 줄 단위로 칠한다 — **틀린 구간을 그리느니 넓게 칠하는 편이 낫다.**
- `joinPieces` 가 하이픈을 떼는 줄(`hyphen === 'hidden'`)이 있다. 오프셋은 **뗀 뒤** 기준이다.
  줄 텍스트 길이로 **클램프**해서 범위를 벗어나지 않게 하라.

### ② 리플로우 뷰 — CSS Custom Highlight API

`CSS.highlights` + `Range` 로 칠한다. **DOM 을 건드리지 마라** — 줄 span 을 쪼개면
6a 에서 한 번 데었던 이음새 문제가 돌아온다(하이라이트가 단어를 자르던 그 건).

- `::highlight(medreader-current)` 로 스타일. 색은 기존 `--hl-bg`/`--hl-text` 를 쓴다.
- **`CSS.highlights` 가 없으면 지금의 줄 단위 `.is-current` 로 물러선다.** 기능 손실 없음.
  (확인됨: 이 세션 Chromium 152 지원. 사용자 기기는 최신 Android Chrome.)
- 이미 읽은 줄(`--hl-done`)은 **줄 단위 그대로 둔다.** 그건 "어디까지 왔나"지
  "지금 어디를 읽나"가 아니다.

### ③ 원본 뷰 — 합집합 상자 대신 줄마다 상자

지금 `moveOverlay()` 가 `unionBox()` 로 **하나의 큰 상자**를 만든다. 그래서
줄 사이 여백과 문장 밖 글자까지 덮인다.

- 상자를 **풀에서 재사용**한다. 상한 `HL_MAX_BOXES`(기본 8) — `config.js` 에 새 키로.
- **첫 줄·마지막 줄은 가로로 자른다.** `ranges` 의 문자 오프셋을 그 줄의 `runs` 경계에
  대응시켜 x 를 구하고, run 안에서는 **글자 수 비례**로 보간한다(근사치지만 줄 전체보다 훨씬 맞다).
- 가운데 줄들은 통째로 덮는다.
- 회전 줄은 여전히 제외.
- `ranges` 가 없으면 줄 통째 상자로 돌아간다.

## 수정 허용 범위

```
apps/medreader/js/tts/text.js       ranges 생성 (lineIds 계약은 유지)
apps/medreader/js/ui/reader.js      리플로우 하이라이트 + ranges 전달
apps/medreader/js/ui/original.js    다중 상자 오버레이
apps/medreader/js/pdf/render.js     x 보간 헬퍼가 필요하면 (순수 함수로)
apps/medreader/js/config.js         HL_MAX_BOXES 등 새 키만 (LAYOUT·KEEP_HYPHEN_* 금지)
apps/medreader/css/reader.css       ::highlight 규칙 + 오버레이 상자 스타일
apps/medreader/tests/*.test.mjs     신규 추가
```

금지:
- **`js/tts/speaker.js` 수정 금지.** spec 6-4 Android 대응이 거기 있다.
  `ranges` 는 `text.js` 가 만들고 `speaker` 는 `units[i]` 를 그대로 넘기면 된다.
  꼭 고쳐야 하면 **멈추고 보고하라.**
- **`js/text/*`·`js/quiz/*`·`js/db.js`·`js/pdf/extract.js`·`js/router.js`·`js/main.js`·
  `js/ui/quiz.js`·`js/ui/library.js`·`js/ui/controls.js` 수정 금지.** 버그는 보고만.
- `spec.md`·`dev/*` 수정 금지. 기존 **407개** 테스트 기대값 변경 금지.
- **`algoVersion` 을 건드리지 마라.** 이 단계는 저장본을 바꾸지 않는다.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 수정 금지. 커밋·푸시 금지.
- 레포에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**
- **10b(바 높이·스크롤 분리)를 건드리지 마라.** 다음 단계에서 따로 한다.

## 테스트

`node --test "apps/medreader/tests/*.test.mjs"` — **디렉터리 인자는 Node 24+Windows 에서 실패한다.**

`text.js` 는 순수하니 **전수로 덮인다**:
1. 문장이 줄 중간에서 시작할 때 `ranges` 가 **그 문장만** 가리킨다.
2. 문장이 세 줄에 걸칠 때 첫/가운데/마지막 줄의 `start`/`end` 가 각각 맞다.
3. 하이픈으로 이어진 줄에서 오프셋이 줄 길이를 넘지 않는다.
4. **`splitLong` 으로 쪼개지면 `ranges` 가 없다**(붙이지 않는다).
5. `lineIds` 계약이 **바뀌지 않았다** — 기존 테스트가 이걸 이미 본다.
6. x 보간이 순수 함수로 떨어져 있고, run 경계·run 안쪽·범위 밖에서 각각 맞다.
7. 기존 407개 전부 통과.

**변이 테스트**: ①의 오프셋 클램프와 ③의 x 보간을 각각 망가뜨렸을 때
**어떤 테스트가 빨개지는지** 확인하고 보고하라. 안 빨개지면 헛도는 테스트다.

## 스모크 테스트

`preview_start {name:"blog"}` → **`http://localhost:8000/...`** 을 **새 탭**으로.
**패널이 숨겨져 있으면 `window.innerHeight` 가 0 이고 pdf.js 렌더가 끝나지 않는다** —
스크린샷을 한 번 찍어 패널을 띄운 뒤 측정하라. 모듈 캐시 전례가 있으니
고친 파일이 실제로 반영됐는지 `fetch('./js/tts/text.js?t='+Date.now())` 로 확인하라.

브라우저에 실물 PDF 를 넣는 것은 막혀 있다. **합성 문서를 심어라**(우회 금지).
합성 PDF 는 **한 문장이 줄 중간에서 시작하도록** 길게 만들어야 증상이 재현된다.

1. `node --test` 전부 통과.
2. **리플로우** — 하이라이트가 읽는 문장의 **첫 글자에서 시작해 마지막 글자에서 끝난다.**
   앞 문장 꼬리·뒤 문장 머리가 칠해지지 않는다. ← **이 단계의 핵심**
3. **원본** — 같은 성질. 줄 사이 여백이 통째로 덮이지 않는다.
4. 문장이 여러 줄에 걸칠 때 가운데 줄은 통째, 양 끝 줄은 잘려서 칠해진다.
5. `CSS.highlights` 를 일부러 가려도(`delete` 또는 스텁) 줄 단위로 칠해지며 **죽지 않는다.**
6. 자동 스크롤·줄 탭·반복 재생이 **그대로 동작**한다(`lineIds` 계약 유지 확인).
7. 콘솔 에러·경고 0건. CSS 물리속성은 기존 `.hl-line` 1건 외 0건.

## 완료 보고 형식 (한국어로)

1. 생성/수정한 파일과 줄 수.
2. `node --test` **실제 출력**(tests/pass/fail).
3. 스모크 7개 각각 ○/× 와 근거. **2·3번은 측정값으로** — 하이라이트 사각형의
   좌표와 기대 문자 구간을 비교해 보여라. 스크린샷이 파일로 안 남으면 정직하게 적어라.
4. 변이 테스트 결과.
5. x 보간을 어떻게 했고 **오차가 얼마나 되는지**(run 경계에서 몇 px).
6. spec 과 다르게 구현한 부분. 없으면 "없음".
7. 다른 모듈에서 발견한 버그 (**고치지 말고** 보고). 남은 문제 3줄 이내.

**속도가 중요하다.** 테스트를 통과시키려고 spec 을 어기지 마라. 막히면 멈추고 보고하라.
**추측을 사실처럼 쓰지 마라** — 확인 못 한 것은 "확인 못 함"이라고 적어라.
