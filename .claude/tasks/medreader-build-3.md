# Build 지침 — MedReader 3단계: `index.html` 골격 + `router.js` + i18n + 온보딩 + 서재

## 배경 — 속도가 중요하다

대상 PDF(729쪽)는 임시본이고 곧 **7000쪽 실제 자료**로 교체된다(형식 유사). 사용자는 **빨리 전달 가능한 물건**을 원한다.

**3·4·5단계까지가 "쓸 수 있는 물건"이다** — PDF 열기 → 리플로우로 읽기 → 낭독. 이 단계는 그 뼈대다.

**완벽을 노리지 마라. 다음 단계가 얹힐 구조를 정확히 세우고, 지금 필요 없는 것은 만들지 마라.**

1·2단계는 완료·Review 통과했다. `js/text/*`, `js/db.js`, `js/hash.js`, `js/pdf/loader.js`, `js/pdf/extract.js` 는 **소비만** 한다.

## 먼저 읽을 것

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **11절 전체(i18n)**, **12-1(라우트)·12-2(온보딩)·12-6(서재)**, 2-1(파일 구조), 3-1·3-2(계층·의존 방향), 9-2·9-3(스토어·settings 키), 13절(프라이버시), 14절(오프라인), 16-H(i18n·RTL)·16-I(프라이버시)·16-K(코드·구조), 19절, 20절
3. `D:\01_claude_my-blog\apps\medreader\review.md` — 각 절의 "다음 단계 주의사항"
4. 소비 대상: `js/config.js`, `js/db.js`, `js/hash.js`, `js/pdf/loader.js`, `js/pdf/extract.js`, `js/text/store.js`, `dev/proto-extract.js`(추출 붙이는 법의 실작동 예)

## 수정 허용 범위

```
apps/medreader/index.html              신규 — 화면 골격 (모든 <section data-screen>)
apps/medreader/css/app.css             신규 (+ 필요하면 분할)
apps/medreader/js/main.js              신규 — 부팅·배선
apps/medreader/js/router.js            신규 — 해시 라우터
apps/medreader/js/i18n/index.js        신규 — setLang·t()·누락 키 폴백
apps/medreader/js/i18n/{en,ar,fr,ko}.js 신규 — 언어 파일
apps/medreader/js/ui/onboarding.js     신규
apps/medreader/js/ui/library.js        신규 — 서재(12-6 최소)
apps/medreader/js/settings.js          신규 — settings 스토어 래퍼 (9-3 키)
apps/medreader/tests/i18n.test.mjs     신규 — 키 집합 일치 (11-2 요구)
apps/medreader/tests/*.test.mjs        신규 추가
```

금지:
- **`js/text/*`·`js/db.js`·`js/hash.js`·`js/pdf/*` 수정 금지.** Review 통과했다. 버그를 찾으면 고치지 말고 **보고서에 적어라.**
- **`config.js`의 `KEEP_HYPHEN_SUFFIXES`는 사용자가 직접 채운 값이다.** 건드리지 마라. `config.js` 자체는 3단계 상수 추가만 허용.
- `spec.md`·`dev/*`·기존 `tests/*` 수정 금지. 기존 140개 기대값 변경 금지.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**
- **이 단계에서 만들지 않는 것**: 리플로우 뷰 본체(4단계), TTS(5단계), 원본 뷰(6단계), AI·키 설정(7단계), 퀴즈(9단계). 해당 라우트는 **빈 화면 + "준비 중" 자리표시자**로 둔다.

## 구현 요구사항

### `index.html`
- **모든 화면을 `<section data-screen="...">` 로 한 파일에** 둔다(12-1). 라우터가 `hidden` 토글.
- 화면: `onboarding`, `library`, `reader`, `quiz`, `settings`, `usage`, `about`. 리더·퀴즈·설정·사용량은 **자리표시자**로 둔다(4~9단계가 채운다).
- `<html lang>` · `dir` 은 i18n 이 런타임에 바꾼다.
- **`file://` 로 열면 동작하지 않는다**는 주석과, 서재 빈 화면에 안내 문구(20절).
- 모든 정적 문구에 `data-i18n` / `data-i18n-aria`. **문자열을 HTML에 하드코딩하지 마라.**
- 뷰포트 메타. 모바일 세로 기준(12-3).

### `js/router.js`
- `hashchange` 기반. `#/library`, `#/reader/:docId/:page`, `#/quiz/:docId/:sectionId`, `#/settings`, `#/usage`, `#/about`, `#/onboarding`.
- 파라미터 파싱은 **순수 함수로 분리**해 테스트하라(`parseRoute(hash)` → `{name, params}`).
- 알 수 없는 해시 → 서재. 빈 해시 → 온보딩 완료 여부에 따라 온보딩/서재.
- 브라우저 뒤로가기가 그대로 동작해야 한다(Android 뒤로 제스처).

### `js/i18n/`
- `export default {}` 평범한 객체(11-1). **4개 언어 전부 정적 import.**
- `t(key, params)` — `{name}` 치환, 복수형은 `Intl.PluralRules`로 `key.one`/`key.other`.
- **누락 키: 현재 언어 → `en` → 키 문자열 자체. 앱은 절대 죽지 않는다**(11-2).
- `setLang(lang)`: `documentElement.lang`·`dir` 설정, 모든 `[data-i18n]` 의 `textContent`, `[data-i18n-aria]` 의 `aria-label` 갱신.
- 초기 언어: `settings.ui.lang` → `navigator.languages` 중 `ar/en/fr/ko` → **`ar`**(11-3).
- **`en` 과 `ar` 은 실제로 번역하라. `fr`·`ko` 는 키만 복사하고 값은 영어로 두되 `// TODO: 번역` 표시**(19절 3번이 그렇게 정했다).
- **문자열 안에 HTML 금지.** 링크는 `{link}` 자리표시자 + 별도 URL 키.

### RTL — 16-H 가 grep 으로 검사한다
- **CSS 는 논리 속성만**: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`.
- **`left`/`right`/`margin-left`/`margin-right` 가 0건**이어야 한다(11-3). 원본 뷰 오버레이 예외는 6단계 것이고 이 단계에는 해당 없다.
- 폰트 스택은 11-4 그대로. **웹폰트 다운로드 금지.**

### `js/ui/onboarding.js` — 12-2, 3화면
1. 언어 4개 버튼(각 언어 **자국어 표기**: `العربية / English / Français / 한국어`), 큰 터치 타깃.
2. 고지 카드 2개 — (a) 교육 목적·임상 사용 금지, (b) 프라이버시(실제 환자 정보 입력 금지, 무료 API 가 입력을 학습에 쓸 수 있음) + 체크박스 "이해했습니다" → [계속]. **`privacy.consentedAt` 저장**(9-3).
3. [PDF 가져오기] 큰 버튼 + "API 키는 나중에. 낭독·읽기는 키 없이 됩니다" 문구.
- **마지막에 `db.requestPersist()` 를 반드시 부를 것**(16-B·9-2). 7000쪽 64MB 가 쿼터 압박에 날아가면 전체 재추출이다. Review 가 "아무도 부르지 않는다"고 신고한 자리다.

### `js/ui/library.js` — 12-6 최소
- 문서 카드: 제목·쪽수·**추출 진행(`pagesDone/pageCount`)**·마지막 읽은 위치. [이어 읽기], [삭제].
- **[PDF 가져오기]**: 파일 선택 → `hash.js` 로 `fileHash` → **기존 문서 있으면 재사용**(중복 생성 금지) → `documents`·`blobs` 저장 → `extract.js` 시작 → 리더로 이동.
- **`pageCount` 2차 비교**: Review 가 해시 충돌을 실제로 만들었다(표본이 파일의 13.22%). `fileHash` 가 같아도 **`pageCount` 가 다르면 다른 파일로 본다.** `hash.js` 주석이 "있다"고 적어 둔 방벽인데 코드에 없다.
- 빈 서재: `file://` 안내 + [PDF 가져오기].
- 추출 진행 표시는 `Extractor` 의 `progress` 이벤트를 구독한다. **"312/7000"** 이 그려져야 한다.

### `js/settings.js`
- `settings` 스토어 래퍼. **9-3 의 키 목록대로.** 읽기는 기본값 폴백, 쓰기는 즉시 저장.
- 이 단계에서 필요한 것만: `ui.lang`, `privacy.consentedAt`, `onboarding.done`. 나머지 키는 **기본값만 정의**하고 화면은 만들지 마라.

### 오류 표시 — 14절
- `loader.js`·`db.js`·`Extractor` 는 **코드·이벤트만** 낸다(`ERR_PDFJS_LOAD`, `ERR_DB_QUOTA`, `fatal`, `stalled` …). **이 단계가 그 코드를 i18n 키에 매핑**한다. 서비스 계층에 문자열을 되돌려 넣지 마라(3-2).
- 최소: pdf.js 로드 실패, 쿼터 초과, 추출 멈춤 세 가지 배너.

## 테스트

- **`tests/i18n.test.mjs` — 4개 언어의 키 집합이 정확히 같은가**(11-2 가 Review 항목으로 지정). 누락 키 폴백 3단계(현재 → en → 키 자체)도.
- `parseRoute(hash)` 순수 함수 — 정상·파라미터·알 수 없는 해시·빈 해시.
- `settings` 기본값 폴백.
- 기존 140개 전부 통과.

## 스모크 테스트

`preview_start {name:"blog"}` → `http://localhost:8000/apps/medreader/index.html` (이전 탭이 있으면 **새 탭**으로 — 모듈 캐시).

1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과.
2. 온보딩 3화면 → 동의 → 서재 도달. 새로고침하면 **온보딩을 다시 묻지 않는다.**
3. **실제 PDF 가져오기**(`C:\Users\YDC\Downloads\ILMA_2021_20th_ed_Harrison.pdf`) → 추출 진행이 서재 카드에 보인다 → 같은 파일 다시 가져오면 **중복 생성 안 됨.**
4. 4개 언어 전환 — 아랍어에서 `dir="rtl"` 이 되고 레이아웃이 깨지지 않는다.
5. **CSS 에 `left`/`right`/`margin-left`/`margin-right` grep 0건**(16-H).
6. 브라우저 뒤로가기로 화면이 되돌아간다.
7. **콘솔 에러·경고 0건**(16-K). 모바일 375px 가로 스크롤 없음.
8. `navigator.storage.persist()` 가 온보딩 후 실제로 호출되는지(`navigator.storage.persisted()` 로 확인).

## 완료 보고 형식

1. 생성/수정한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail).
3. 스모크 테스트 8개 각각 ○/× 와 근거. 스크린샷이 파일로 안 남으면 "세션 브라우저 패널에서 확인"이라고 정직하게 적어라. **없는 경로를 지어내지 마라.**
4. `pageCount` 2차 비교가 실제로 도는지 — 어떻게 확인했는가.
5. spec 과 다르게 구현한 부분. 없으면 "없음". `js/text/*`·`js/db.js`·`js/pdf/*` 에서 발견한 버그가 있으면 여기에(고치지 말고).
6. 남은 문제.
7. **4단계(리플로우 뷰 + `Aa` + 테마)에 넘길 주의사항 3개 이내.** 특히 리더 화면 자리표시자에 무엇을 남겼는지, `fromStored` 로 읽은 문단을 어디에 그리면 되는지.

**속도가 중요하다.** 자리표시자로 둘 것은 자리표시자로 두고, 이 단계의 뼈대를 정확히 세우는 데 집중하라. 테스트를 통과시키려고 spec 을 어기지 마라. 막히면 멈추고 보고하라.
