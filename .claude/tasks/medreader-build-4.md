# Build 지침 — MedReader 4단계: 리플로우 뷰 + `Aa` 설정 + 테마

## 배경 — 속도

대상 PDF(729쪽)는 임시본이고 곧 **7000쪽 실제 자료**로 교체된다(형식 유사). 사용자는 **빨리 전달 가능한 물건**을 원한다.

**3·4·5단계까지가 "쓸 수 있는 물건"이다** — PDF 열기 → 리플로우로 읽기 → 낭독. 3단계(골격·라우터·i18n·온보딩·서재)는 끝났고 **이 단계가 실제로 읽히게 만든다.**

**완벽을 노리지 마라.** TTS(5단계)·원본 뷰(6단계)·AI(7단계)·퀴즈(9단계)는 건드리지 않는다. 다만 **5단계가 얹힐 자리(하이라이트 훅)는 정확히 만들어라.**

## 먼저 읽을 것

1. `D:\01_claude_my-blog\.claude\tasks\medreader-handoff.md` — **인계 문서. 현재 상태·함정이 전부 여기 있다.**
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **12-3(리더 레이아웃)·12-4(리플로우 뷰 DOM)**, 16-F(눈 피로·리플로우·테마)·16-G(모바일 UI·터치)·16-H(i18n·RTL)·16-K, 4-10(하이픈), 9-3(settings 키), 11-3·11-4(RTL·폰트), 6-5(하이라이트·자동 스크롤 — **5단계가 쓸 계약만 확인**), 3-2(의존 방향)
3. `D:\01_claude_my-blog\apps\medreader\review.md` — 각 절의 "다음 단계 주의사항"
4. 소비 대상: `js/text/store.js`(`fromStored`), `js/db.js`, `js/settings.js`, `js/i18n/index.js`, `js/main.js`(`showReaderPlaceholder`·`applyTheme`), `index.html`(`#readerMount`)

## 3단계가 넘긴 주의사항 (그대로 따르라)

1. **리더 자리표시자는 `index.html`의 `<section data-screen="reader">` 안 `#readerMount` 하나다.** 그 div 를 비우고 12-4 의 `article.reflow[dir=ltr][lang=en]` 을 넣는다. 상단바(`#readerTitle`)와 `[data-nav="#/library"]` 뒤로 버튼은 이미 동작한다.
   진입점은 `main.js` 의 `showReaderPlaceholder(params)` — **`ui/reader.js` 로 옮기고 `onRoute` 의 `case 'reader'` 만 바꿔라.** `params.docId`·`params.page` 가 이미 파싱돼 온다.
2. **문단을 그리는 길**: `db.get('pages', [docId, pageNo])` → `fromStored(rec)` → `layout.paragraphs[i].text`.
   **저장본에 `paragraphs[].text` 가 없고 `fromStored` 가 조립해 준다** — `lines[].text` 를 직접 이어 붙이지 마라(4-10 하이픈 결합이 빠진다).
3. **`Aa` 설정 키는 `js/settings.js` 에 기본값이 이미 정의돼 있다** — `reader.fontSize`(22), `reader.lineHeight`(1.7), `reader.letterSpacing`(0), `reader.font`, `ui.theme`. **새 키를 지어내지 마라.** 테마는 `main.js` 의 `applyTheme()` 가 `:root[data-theme]` 를 세운다. `tokens.css` 에 light/dark 만 있으니 **sepia·고대비를 거기 추가**하라.

## 수정 허용 범위

```
apps/medreader/js/ui/reader.js       신규 — 리플로우 뷰 본체
apps/medreader/js/ui/typeset.js      신규(선택) — Aa 팝오버
apps/medreader/css/reader.css        신규
apps/medreader/css/tokens.css        수정 허용 — 테마 토큰 추가만(sepia·고대비)
apps/medreader/js/main.js            수정 허용 — 리더 라우트 배선만
apps/medreader/index.html            수정 허용 — 리더 화면 안쪽만
apps/medreader/js/i18n/{en,ar,fr,ko}.js  수정 허용 — 이 단계 키 추가만
apps/medreader/tests/*.test.mjs      신규 추가
```

금지:
- **`js/text/*`·`js/db.js`·`js/hash.js`·`js/pdf/*`·`js/router.js`·`js/settings.js`·`js/ui/library.js`·`js/ui/onboarding.js` 수정 금지.** 버그를 찾으면 고치지 말고 **보고서에 적어라.**
- **`config.js` 의 `KEEP_HYPHEN_SUFFIXES` 는 사용자가 직접 채운 값이다.** 건드리지 마라.
- `spec.md`·`dev/*` 수정 금지. 기존 189개 테스트 기대값 변경 금지.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**
- **TTS·원본 뷰·AI·퀴즈를 만들지 마라.**

## 구현 요구사항

### `js/ui/reader.js` — 리플로우 뷰 (12-4)

- **DOM 구조는 spec 12-4 그대로.** 문단마다 `<p data-para-id>`, 줄마다 `<span class="line" data-line-id>`.
  **`span.line` 이 5단계 하이라이트의 앵커다**(6-5 가 `.is-current` 를 토글한다). 줄 경계를 잃지 마라.
- **본문 컨테이너는 `dir="ltr" lang="en"` 고정**(11-3). UI 가 아랍어여도 영어 본문은 LTR 이다.
- 문단 `kind` 별 스타일: `heading`·`question`·`option`·`answer`·`list`·`body`.
- `role` 이 `header`·`footer`·`pageno`·`rotated` 인 줄은 **`details` 로 접어** 옅게 표시하고, 탭하면 펼쳐진다(4-7 의 오판 복구 수단).
- **표 region** 은 이 단계에서 크롭 이미지를 만들지 않는다(6단계). **"표입니다 — 원본으로 보기"** 자리표시자로 두되, `region.id` 를 `data-region-id` 로 남겨 6단계가 찾을 수 있게 하라.
- **쪽 이동**: 이전/다음 쪽, 쪽 번호 입력. 라우트(`#/reader/:docId/:page`)와 동기화 — 쪽을 넘기면 해시가 바뀌고, 뒤로가기가 동작해야 한다.
- **아직 추출되지 않은 쪽**: `pages` 에 없으면 "텍스트 준비 중" + 진행률(`Extractor` 의 `progress` 를 구독하거나 `documents.extraction` 을 읽어라). **빈 화면을 보여주지 마라.**
- **마지막 읽은 위치 저장**: `documents.lastPage`·`lastLineId`(9-2). 서재의 [이어 읽기]가 이미 이 필드를 읽는다.
- **7000쪽 메모리**: 한 번에 한 쪽만 DOM 에 둔다. 쪽을 넘길 때 이전 DOM 을 버려라.

### `Aa` 팝오버 (12-3, 16-F)

- 글자 크기·행간·자간·글꼴(sans/serif)·테마. **`settings.get/set` 만 쓴다.**
- 바꾸면 **즉시** 반영(새로고침 없이). CSS 변수로 적용하라 — 개별 요소를 순회하지 마라.
- **테마 4종**: light·dark·sepia·고대비. `tokens.css` 에 토큰을 추가하고 `applyTheme()` 가 세우는 `:root[data-theme]` 를 그대로 쓴다.
- 16-F 가 요구하는 것: 눈 피로를 줄이는 기본값, 큰 글자에서도 레이아웃이 깨지지 않음.

### RTL·접근성

- **CSS 에 `left`/`right`/`margin-left`/`margin-right`/`padding-left`/`padding-right`/`border-left`/`border-right`/`text-align:left|right` 를 쓰지 마라.** 16-H 가 grep 0건을 요구하고 **지금 0건이다.**
- 모든 문구는 `data-i18n` / `t()`. **하드코딩 금지.** i18n 문자열 안에 HTML 금지.
- 터치 타깃 44px 이상(16-G). 모바일 375px 가로 스크롤 0.
- 동적 텍스트는 `textContent`. **`innerHTML` 에 문서 텍스트를 넣지 마라.**

## 테스트

- **순수하게 떼어낼 수 있는 것을 떼어내라**: 문단 → DOM 기술(記述) 변환, `Aa` 설정값 → CSS 변수 매핑, 쪽 번호 클램프(1..pageCount).
- i18n 키 집합 일치 테스트가 이미 있다(`tests/i18n.test.mjs`) — **키를 추가하면 4개 언어에 전부 넣어야 통과한다.**
- 기존 189개 전부 통과.

## 스모크 테스트

`preview_start {name:"blog"}` → `http://localhost:8000/apps/medreader/index.html` (**새 탭**으로 — 모듈 캐시).

1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과.
2. PDF 가져오기 → 리더 진입 → **문단이 실제로 읽힌다.** 문항·보기가 구분돼 보인다.
3. **하이픈 결합 확인**: 문단 텍스트에 `methicillin-resistant` 처럼 하이픈이 살아 있고, `cardiovascular` 처럼 결합된 낱말이 붙어 있다(`fromStored` 를 거쳤다는 증거).
4. 쪽 이동 → 해시 변경 → **뒤로가기 동작.**
5. `Aa` 로 글자 크기·행간·글꼴·테마 4종 전환 — **즉시 반영**, 새로고침 후에도 유지.
6. 머리말·꼬리말·쪽번호 줄이 접혀 있고 탭하면 펼쳐진다.
7. 아직 추출 안 된 쪽으로 가면 "텍스트 준비 중 N/M".
8. **CSS 논리속성 grep 0건.** 375px 가로 스크롤 0. 콘솔 에러·경고 0건.
9. `span.line[data-line-id]` 가 실제로 존재하는지 — **5단계 하이라이트가 이걸 찾는다.**

## 완료 보고 형식

1. 생성/수정한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail).
3. 스모크 테스트 9개 각각 ○/× 와 근거. 스크린샷이 파일로 안 남으면 "세션 브라우저 패널에서 확인"이라고 정직하게 적어라. **없는 경로를 지어내지 마라.**
4. spec 과 다르게 구현한 부분. 없으면 "없음". 다른 모듈에서 발견한 버그가 있으면 여기에(고치지 말고).
5. 남은 문제.
6. **5단계(TTS + 컨트롤 바 + 하이라이트 + 자동 스크롤)에 넘길 주의사항 3개 이내.** 특히 **하이라이트가 붙을 DOM 앵커와 줄 순회 방법**을 정확히 적어라 — 5단계는 실기기 확인이 필수라 시행착오를 줄여야 한다.

**속도가 중요하다.** 테스트를 통과시키려고 spec 을 어기지 마라. 막히면 멈추고 보고하라.
