# Build 지침 — MedReader 6b단계: 원본 뷰 + 하이라이트 오버레이 + 표 크롭 폴백

## 배경

1~5단계(+5b) 완료·배포됨. **6a 가 방금 끝났다** — 줄 `bbox` 가 이제 페이지 사각형 안에
있다(`badLines` 1,074 → 0). 네가 그리는 오버레이는 그 값을 쓴다.

**곧 7000쪽 실제 자료로 교체된다**(형식 유사). 특정 서적 튜닝은 하지 마라.

## 만들 것 (spec 19절 6단계)

1. **`js/pdf/render.js`** — 페이지를 canvas 로 렌더, 영역 크롭
2. **`js/ui/original.js`** — 원본 뷰 + 하이라이트 오버레이 + 줌 + 페이지 이동
3. **리플로우 ↔ 원본 뷰 전환** (`reader.view` 설정 키는 9-3 에 이미 있다)
4. **표 크롭 폴백** — 리플로우 뷰의 표 자리에 canvas 크롭 `<img>`
5. **낭독이 표에 닿았을 때 안내** — `reader.tts.tableSkipped` 를 **한 번** 말하고 넘어간다

## 먼저 읽을 것

1. `apps/medreader/spec.md` — **4-12(좌표 변환·오버레이 구조 ★)**, **12-5(원본 뷰)**,
   4-8 의 "폴백" 절(표 크롭), 2-3(pdf.js 로딩·실패 UX), 12-3, 16-C·16-G·16-H·16-K,
   9-3(`reader.view`), 11절(i18n), 3-2, **4-6 의 `[수정 2026-09-23 — 6a]`**
2. `.claude/tasks/medreader-handoff.md` — 환경·함정
3. 대상 코드: `js/ui/reader.js`(5단계 계약 전부), `js/pdf/loader.js`, `js/text/store.js`

## 반드시 지킬 것

### 오버레이는 줄마다 만들지 않는다 (4-12)

`.hl-line` **하나**를 현재 줄 bbox 로 옮긴다(`transform: translate()` + `width/height`).
줄 수만큼 DOM 을 만들면 7000쪽에서 죽는다.

### 회전된 줄에는 오버레이를 그리지 마라

6a 가 bbox 를 페이지 안으로 클립했지만 **회전 자체는 여전히 반영되지 않는다.**
`role === 'rotated'` 인 줄의 bbox 는 가로 상자라서 세로로 인쇄된 글과 겹치지 않는다.
그런 줄은 오버레이를 **숨겨라**(엉뚱한 자리에 그리는 것보다 낫다).

### 좌표 변환은 직접 짜지 마라

`viewport.convertToViewportPoint` / `convertToPdfPoint` 를 쓴다. 행렬 곱을 손으로 짜면
회전(rotation ≠ 0) 페이지에서 틀린다.

### pdf.js 는 원본 뷰를 요청할 때 동적 로드 (2-3)

추출이 끝난 페이지는 pdf.js 없이 리플로우로 읽을 수 있어야 한다 — 그게 오프라인 읽기다.
**두 CDN 모두 실패해도 앱이 죽으면 안 된다.** 원본 뷰 버튼을 비활성으로 표시하고
리플로우는 계속 돌아간다. `loader.js` 에 이미 폴백이 있다.

### 크롭 이미지는 IndexedDB 에 저장하지 마라

메모리 LRU 20개만. 저장하면 25MB 문서에서 용량이 두 배가 된다(4-8 폴백).

### CSS 논리 속성

`left`/`right`/`margin-left`/`margin-right`/`padding-left`/`padding-right`/
`border-left`/`border-right`/`text-align:left|right` **0건**(16-H).
**예외는 spec 1494 가 명시한 딱 하나** — `original.js` 와 `.hl-line` 의 오버레이 좌표
`left`/`top`. 그 밖에서는 예외를 만들지 마라.

### 그 밖

- 문구는 전부 `data-i18n`/`t()`. 키를 추가하면 **4개 언어 전부**(`tests/i18n.test.mjs` 가 검사).
- **서비스 계층은 UI 문자열을 만들지 않는다**(3-2).
- 터치 타깃 48px 이상(16-G). **접은 화면 375px 에서 넘치면 안 된다.**
  하단에 컨트롤 바·쪽 이동 바·고지 바가 이미 쌓여 있다(`--pager-h`·`--notice-total`·`--tts-gap`).
- **spec 6-4 의 Android TTS 제약을 깨지 마라.** 뷰를 바꿔도 낭독이 끊기면 안 된다.
  `speechSynthesis.pause()` 금지, `cancel()` 후 60ms, 세대(`gen`) 검사 유지.

## ★ 한 가지는 구현하지 마라 — `TODO(human)`

**`pickAnchorLine(ctx)` 은 사람이 채운다.** 뷰를 바꿀 때 새 뷰가 **어느 줄로 착지할지**
고르는 함수다. 16-C 체크리스트의 "원본 뷰 ↔ 리플로우 전환 시 같은 줄 위치가 유지된다"가
이 함수에 달려 있고, 정답이 하나가 아니다.

```js
/**
 * @param {Object} ctx
 *   speaking            {boolean}       낭독 중인가
 *   currentLineId       {string|null}   낭독이 지금 읽는 줄
 *   visibleLineIds      {string[]}      화면에 보이는 줄들 (읽기 순서)
 *   viewportCenterLineId{string|null}   화면 세로 중앙에 가장 가까운 줄
 *   lastTappedLineId    {string|null}   사용자가 마지막으로 탭한 줄
 * @returns {string|null} 착지할 줄 id. null 이면 호출자가 페이지 첫 줄로 간다.
 */
export function pickAnchorLine(ctx) {
  // TODO(human)
}
```

**이 함수의 본문만 비워 둔다.** 파일·JSDoc·export·호출부는 전부 네가 만들고,
`null` 이 와도 호출부가 깨지지 않게(페이지 첫 줄로 폴백) 짜라.
이 함수의 **테스트는 쓰지 마라** — 사람이 채운 뒤에 붙인다.
`pickAnchorLine` 은 순수 함수로 두어라(`document`·`window` 금지). 어느 파일에 둘지는
네가 정하되 **순수하게 떼어낼 수 있는 자리**에 둬라.

## 수정 허용 범위

```
apps/medreader/js/pdf/render.js      신규
apps/medreader/js/ui/original.js     신규
apps/medreader/js/ui/reader.js       뷰 전환 위임 + 표 크롭 삽입 + 표 안내
apps/medreader/js/settings.js        reader.view 관련만 (기존 기본값 변경 금지)
apps/medreader/css/reader.css        원본 뷰·오버레이·뷰 전환 버튼 스타일
apps/medreader/index.html            리더 화면 안쪽만
apps/medreader/js/i18n/{en,ar,fr,ko}.js  이 단계 키 추가만 (4개 전부)
apps/medreader/tests/*.test.mjs      신규 추가
```

금지:
- **`js/text/*` 수정 금지.** 6a 가 방금 끝난 자리다. 버그를 찾으면 고치지 말고 보고하라.
- `js/db.js`·`js/hash.js`·`js/pdf/extract.js`·`js/router.js`·`js/ui/library.js`·
  `js/ui/onboarding.js`·`js/ui/typeset.js`·`js/ui/controls.js`·`js/tts/*`·`js/main.js`
  **수정 금지.** 버그는 보고만.
- `js/config.js` 의 `LAYOUT`·`KEEP_HYPHEN_*` **수정 금지**(사용자가 채운 값이 있다).
  원본 뷰 상수가 필요하면 새 키만 추가하라.
- `spec.md`·`dev/*` 수정 금지. 기존 **291개** 테스트 기대값 변경 금지.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**
- **[AI로 표 재구성] 버튼을 만들지 마라** — 7·8단계다. 크롭 이미지만.
- 퀴즈(9단계)·번역(8단계)을 만들지 마라.

## 테스트

`node --test "apps/medreader/tests/*.test.mjs"` — **디렉터리 인자는 Node 24+Windows 에서 실패한다.**

canvas·pdf.js 는 Node 에 없다. **순수하게 떼어낼 수 있는 것을 떼어내라**:
- bbox → 오버레이 사각형 계산(`viewport` 는 스텁을 주입). 줌 0.8·1.5·3.0 에서 각각.
- 탭 좌표 → 줄 찾기(역변환 후 bbox 포함 판정). 경계·겹침·빈 페이지.
- 크롭 영역 계산(여백 6pt 포함), LRU 20 축출 순서.
- `role === 'rotated'` 줄은 오버레이 대상에서 빠진다.
- 표 안내가 **한 번만** 나간다(같은 표에 다시 닿아도 반복하지 않는다).
- 기존 291개 전부 통과.

**변이 테스트**: 여백 6pt 를 0 으로, LRU 20 을 1 로 일부러 망가뜨렸을 때
**어떤 테스트가 빨개지는지** 확인하고 보고하라. 안 빨개지면 테스트가 헛돌고 있다.

## 스모크 테스트

`preview_start {name:"blog"}` → `http://127.0.0.1:8000/apps/medreader/index.html`
**`localhost` 대신 `127.0.0.1` 을 써라** — `localhost` 모듈 HTTP 캐시가 옛 파일을 물고
놓지 않은 전례가 있다. **새 탭**으로 열어라.

브라우저로 실물 PDF 를 넣는 것은 막혀 있다. **합성 문서를 `toStored` → `db.put` 으로
심어라**(우회 금지). `pickAnchorLine` 이 비어 있으므로 뷰 전환은 페이지 첫 줄로 착지한다 —
그게 지금 맞는 동작이다.

1. `node --test` 전부 통과.
2. 뷰 전환 버튼이 보이고, 원본 뷰로 바뀐다. 새로고침 후에도 유지된다(`reader.view`).
3. 오버레이가 낭독 줄과 겹친다. **줌 0.8× · 1.5× · 3.0× 에서 각각** 확인(16-C).
4. 줄을 탭하면 그 줄로 낭독이 옮겨간다.
5. 표가 있는 페이지의 리플로우 뷰에 크롭 이미지가 보인다.
6. **pdf.js 로드를 일부러 실패시켰을 때** 원본 뷰 버튼이 비활성이고 **리플로우는 계속 읽힌다.**
   ← **가장 중요하다.** 오프라인 읽기가 이 앱의 전제다.
7. CSS 물리속성 grep — `original.js`·`.hl-line` 예외 말고 0건.
   **375px 에서 가로 넘침 0**, 콘솔 에러·경고 0건.

## 완료 보고 형식

1. 생성/수정한 파일과 줄 수.
2. `node --test` **실제 출력**(tests/pass/fail).
3. 스모크 7개 각각 ○/× 와 근거. 스크린샷이 파일로 안 남으면 "세션 브라우저 패널에서
   확인"이라고 정직하게 적어라.
4. 변이 테스트 결과 — 어느 테스트가 빨개졌는가.
5. `pickAnchorLine` 을 **어느 파일에 두었고** 호출부가 `null` 을 어떻게 다루는지.
6. **원본 뷰와 테마의 관계** — 세피아·다크·고대비에서 흰 종이 canvas 가 어떻게 보이는가.
   spec 에 규정이 없다. **고치지 말고 관찰한 것만 보고하라.**
7. spec 과 다르게 구현한 부분. 없으면 "없음". 다른 모듈에서 발견한 버그(고치지 말고).
8. 남은 문제 · 사용자가 실기기에서 확인할 것 3줄 이내.

**속도가 중요하다.** 테스트를 통과시키려고 spec 을 어기지 마라. 막히면 멈추고 보고하라.
