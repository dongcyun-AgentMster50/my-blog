# Build 지침 — MedReader 9b단계: 퀴즈 엔진 + 섹션 인덱스 + 퀴즈 화면

## 배경

1~6단계(+5b) 배포됨. **9a 가 방금 끝났다** — `js/quiz/parser.js` 가 순수 계층으로 완성됐고
729쪽 전수에서 **섹션 14 · 문항 1,233 · verified 93.6% · 퀴즈 칩 자격 섹션 10개**를 낸다.
너는 그 결과를 **사용자가 실제로 풀 수 있게** 만든다.

**곧 7000쪽 실제 자료로 교체된다**(형식 유사). 특정 서적 튜닝은 하지 마라.
7000쪽이면 문항이 **약 12,000개**다. 그 수를 머리에 두고 짜라.

## 만들 것

1. **`js/quiz/engine.js`** — 진행 상태 기계(문항 순서·응답·채점·`attempts` 기록). 서비스 계층.
2. **`js/ui/quiz.js`** — 퀴즈 화면. `index.html` 의 `data-screen="quiz"` 자리표시자를 대체.
3. **섹션 인덱스** — 파싱 결과를 `questions` 스토어와 `documents.sectionIndex` 에 저장.
4. **리더 제안 칩** — `[이 섹션 퀴즈 풀기]`(5-4·5-5).

## 먼저 읽을 것

1. `apps/medreader/spec.md` — **5-4(매칭과 상태) · 5-5(퀴즈 UX ★)**, 9절 `questions`·
   `attempts`·`mistakes` 스토어 스키마와 `documents.sectionIndex`,
   3-1·3-2(계층 · **서비스는 UI 문자열을 만들지 않는다**), 12-7, 16-E·16-G·16-H·16-K
2. `.claude/tasks/medreader-handoff.md` — 환경·함정
3. 대상 코드: **`js/quiz/parser.js`(계약 ★)**, `js/db.js`, `js/router.js`(`quizHash`·
   `#/quiz/:docId/:sectionId` 는 **이미 있다**), `js/ui/reader.js`, `js/pdf/render.js`(크롭),
   `js/pdf/extract.js`(`done` 이벤트가 **이미 있다**)

## 반드시 지킬 것

### 퀴즈는 오프라인·무료로 완전히 돈다 (5-5)

**API 없이 전부 동작해야 한다.** 번역 버튼(8단계)·AI 출제(P2)를 만들지 마라.
해설 낭독은 기존 `speaker` 를 쓰되, 낭독이 리더의 큐를 망가뜨리지 않게 하라.

### `unverified` 문항은 채점하지 않는다 (5-4)

- 📕 배지를 주지 않고 **"정답 미확인"** 라벨.
- 풀 수는 있되 **채점하지 않고** "원문에서 정답을 확인하세요" + **[해당 페이지로 이동]**.
- `[실측]` 1,233문항 중 **79개**가 여기 해당한다. 드문 경우가 아니다.

### 제안 칩은 기준을 넘을 때만 (5-4)

`verified / questions >= 0.6` **이고** `questions >= 5`. 파서에 `isQuizWorthy` 가 **이미 있다.**
그 미만이면 칩을 띄우지 않는다. `[실측]` 14섹션 중 **10개**만 자격이 있다.

### 7000쪽 — 한 번에 다 파싱하지 마라

9a Build 가 경고했다: 파서 자체는 가볍지만(7000쪽 환산 173ms) **호출자가 `PageLayout`
7000개를 동시에 들면 2GB 급이다.** `sectionId` 가 로마숫자라 **쪽 범위를 잘라 파싱해도
id 가 변하지 않는다** — 섹션 단위로 잘라라.

문항 12,000개를 **DOM 에 한꺼번에 올리지 마라.** 화면에는 한 문항씩이다.

### 파서가 실패해도 리더는 살아 있어야 한다 (5-4 마지막 줄)

파싱은 리더 렌더 경로 **밖에서** 비동기로 돈다. 예외는 삼키고 칩을 안 띄우면 그만이다.
추출이 끝나는 시점은 `Extractor` 의 `done` 이벤트로 알 수 있다.
**부분 추출 상태에서도 파싱이 의미 있어야 한다** — 해설이 아직이면 `unverified` 이고,
나중에 재파싱하면 `verified` 로 승격된다(5-4). 재파싱은 같은
`(docId, sectionId, number)` 를 덮어쓴다.

### 그 밖

- 문구는 전부 `data-i18n`/`t()`. 키를 추가하면 **4개 언어 전부**(`tests/i18n.test.mjs` 가 검사).
- **서비스 계층은 UI 문자열을 만들지 않는다**(3-2). `engine` 은 코드·이벤트만 낸다.
- CSS **논리 속성만**(16-H). 예외는 `original.js`·`.hl-line` 뿐이고 여기선 해당 없다.
- 터치 타깃 48px 이상(16-G). **접은 화면 375px 에서 보기 버튼 A~E 가 넘치면 안 된다.**
- `hasFigure` 문항은 원본 크롭을 함께 보인다(5-3). `js/pdf/render.js` 의 크롭을 **재사용**하라.
  pdf.js 가 없으면(오프라인) 크롭 없이 문항만 보이고 **퀴즈는 계속 돌아야 한다.**

## ★ 한 가지는 구현하지 마라 — `TODO(human)`

**`planQuizOrder(ctx)` 은 사람이 채운다.** 퀴즈를 열었을 때 **어떤 문항을 어떤 순서로
낼지** 정하는 함수다. 정답이 하나가 아니다.

```js
/**
 * 이 퀴즈 세션에서 낼 문항을 고르고 순서를 정한다.
 *
 * @param {Object} ctx
 *   questions    {Array}   이 섹션의 문항 (파서 순서 = 원서 번호 순)
 *   lastAttempt  {Object|null} 같은 섹션의 가장 최근 attempt
 *                             { items:[{questionId, chosen, correct}], at, score, total }
 *   mode         {'all'|'wrong-only'}  'wrong-only' 는 결과 화면의 [오답만 다시]
 *   unverified   {number}  questions 안의 unverified 개수 (채점 불가 문항)
 * @returns {Array} 낼 문항 배열. ctx.questions 의 부분집합이어야 하고,
 *                  빈 배열이면 호출자가 "풀 문항이 없다"고 처리한다.
 */
export function planQuizOrder(ctx) {
  // TODO(human)
}
```

**이 함수의 본문만 비워 둔다.** 파일·JSDoc·export·호출부는 전부 네가 만들고,
**빈 배열이나 `undefined` 가 와도 호출부가 깨지지 않게**(그때는 `ctx.questions` 를
원서 순서 그대로 쓰는 것으로 폴백) 짜라. 이 함수의 **테스트는 쓰지 마라** — 사람이 채운 뒤에 붙인다.
**순수 함수로 두어라**(`document`·`window`·`db` 금지). 어느 파일에 둘지는 네가 정하되
순수하게 떼어낼 수 있는 자리에 둬라.

## 수정 허용 범위

```
apps/medreader/js/quiz/engine.js      신규
apps/medreader/js/ui/quiz.js          신규
apps/medreader/js/ui/reader.js        제안 칩만
apps/medreader/js/settings.js         이 단계 키 추가만 (기존 기본값 변경 금지)
apps/medreader/js/config.js           퀴즈 상수만 추가 (LAYOUT·KEEP_HYPHEN_* 금지)
apps/medreader/css/screens.css        퀴즈 화면
apps/medreader/css/reader.css         제안 칩만
apps/medreader/index.html             quiz 화면 안쪽 + 리더의 칩 자리
apps/medreader/js/i18n/{en,ar,fr,ko}.js  이 단계 키 추가만 (4개 전부)
apps/medreader/tests/*.test.mjs       신규 추가
```

금지:
- **`js/quiz/parser.js` 수정 금지.** 9a 가 방금 끝났고 전수 검증됐다. 결함을 찾으면 보고하라.
- **`js/text/*` 수정 금지.** `js/db.js`·`js/hash.js`·`js/pdf/*`·`js/router.js`·
  `js/ui/library.js`·`js/ui/onboarding.js`·`js/ui/typeset.js`·`js/ui/controls.js`·
  `js/ui/original.js`·`js/tts/*`·`js/main.js` **수정 금지.** 버그는 보고만.
- `spec.md`·`dev/*` 수정 금지. 기존 **369개** 테스트 기대값 변경 금지.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**
  테스트 픽스처는 **네가 지어낸 문장**으로 써라.
- 번역·요약(8단계)·AI 출제(P2)·오답 노트 화면(P2)을 만들지 마라.
  `mistakes` 는 **스토어 저장까지만**이다(5-5).

## 테스트

`node --test "apps/medreader/tests/*.test.mjs"` — **디렉터리 인자는 Node 24+Windows 에서 실패한다.**

`engine` 은 db·DOM 을 주입받게 짜서 **순수하게 테스트되도록** 하라. 최소한:

1. 채점 — 정답/오답, 복수 정답(`['B','D']`)은 어떻게 판정하는가.
2. **`unverified` 문항은 채점되지 않는다** — 점수·`total` 에 어떻게 반영되는가.
3. `attempts` 레코드 모양이 9절 스키마와 맞는다(`items[]`·`score`·`total`·`durationMs`).
4. 오답이 `mistakes` 에 기록된다.
5. `isQuizWorthy` 경계 — 0.6 과 5문항 **정확히 그 값**에서 어떻게 되는가.
6. 섹션 인덱스 저장·재파싱 — 같은 `(docId, sectionId, number)` 를 덮어쓴다.
7. **unverified → verified 승격**이 재파싱으로 일어난다.
8. 기존 369개 전부 통과.

**변이 테스트**: 채점 규칙과 `isQuizWorthy` 임계를 각각 일부러 망가뜨렸을 때
**어떤 테스트가 빨개지는지** 확인하고 보고하라. 안 빨개지면 그 테스트는 헛돌고 있다.
(9a Review 에서 자기 이름의 규칙을 검증 못 하는 테스트가 실제로 나왔다.)

## 스모크 테스트

`preview_start {name:"blog"}` 로 띄운 뒤 **`http://127.0.0.1:8000/...`** 을 **새 탭**으로
(`localhost` 는 모듈 캐시 전례가 있다). **브라우저 패널이 숨겨져 있으면 `window.innerHeight`
가 0 이고 pdf.js 렌더가 끝나지 않는다** — 스크린샷을 한 번 찍어 패널을 띄운 뒤 측정하라.

브라우저에 실물 PDF 를 넣는 것은 막혀 있다. **합성 문서를 심어라**(우회 금지).
`planQuizOrder` 가 비어 있으므로 문항은 원서 순서 그대로 나온다 — 지금은 그게 맞는 동작이다.

1. `node --test` 전부 통과.
2. 리더에 **[이 섹션 퀴즈 풀기]** 칩이 뜨고(자격 있는 섹션에서만), 누르면 퀴즈 화면.
3. 보기 탭 → 즉시 채점(정답 초록/오답 빨강) → 해설 펼침 → [다음].
4. **`unverified` 문항**은 배지 대신 "정답 미확인", 채점되지 않고 [해당 페이지로 이동]이 동작.
5. 종료 시 점수·오답 목록·[오답만 다시]. `attempts`·`mistakes` 가 실제로 저장된다.
6. **pdf.js 없이도 퀴즈가 끝까지 돌아간다**(크롭만 빠진다). ← 오프라인 전제.
7. CSS 물리속성 grep 0건, **375px 에서 가로 넘침 0**, 콘솔 에러·경고 0건.

## 완료 보고 형식 (한국어로)

1. 생성/수정한 파일과 줄 수.
2. `node --test` **실제 출력**(tests/pass/fail).
3. 스모크 7개 각각 ○/× 와 근거. 스크린샷이 파일로 안 남으면 "세션 브라우저 패널에서
   확인"이라고 정직하게 적어라.
4. 변이 테스트 결과 — 무엇을 망가뜨렸고 무엇이 빨개졌는가.
5. `planQuizOrder` 를 **어느 파일에 두었고** 호출부가 빈 값을 어떻게 다루는지.
6. **7000쪽·문항 12,000개에서 어떻게 되는가** — 섹션 단위 파싱을 어떻게 했고,
   화면에 DOM 이 몇 개나 올라가는지. 측정값으로.
7. spec 과 다르게 구현한 부분. 없으면 "없음".
8. 다른 모듈에서 발견한 버그 (**고치지 말고** 보고). 남은 문제 3줄 이내.

**속도가 중요하다.** 테스트를 통과시키려고 spec 을 어기지 마라. 막히면 멈추고 보고하라.
**추측을 사실처럼 쓰지 마라** — 확인 못 한 것은 "확인 못 함"이라고 적어라.
