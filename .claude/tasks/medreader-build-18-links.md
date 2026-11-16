# Build 지침 — 18 의료 사이트 북마크 + 검색어 바로가기

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-9 "의료 사이트 북마크 + 검색어 바로가기"** 전부(1 코드 사실·2 설계·3 파일·4 수용 기준·5 headless·6 결정 표 18-D1–D7 권장안·8 실기기 — 적기만). 운영자 위임(2026-11-15): 권장안으로. **링크만 — 스크래핑·응답 읽기·계정 정보·앱의 외부 요청 0**(13절·E7). **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-18-links-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
설계 1절은 8e Build 중 작업 트리 기준이다. 그 뒤 배포: 8c-1(`selbar.js`·`select.js` 생김 — `SEL_ACTIONS` 목록 데이터·`refresh`·`showAction`, `clampSelection` 6낱말·60자), 8f-2(`[단어 번역]` 켜짐 — 보이는 단추 셋), 8f-3(서재 상단 `[단어장]`·카드 메뉴), 8c-2(설정 [사용량 보기]·`#/settings/cache`), 8f-4(검색 화면 — 그 단계가 이 단계보다 먼저 배포되면). 행 번호가 어긋나면 지금 코드에 맞추고, 설계와 다르게 해야 하면 spec 17-9 안 `[정정 2026-11-16 — 18 Build]` 줄로(Edit 로 그 자리만).
- `.claude/tasks/medreader-crossstep-notes.md` **"18" 줄**: `[찾아보기]` 는 나중에 11 이 `[⋯]` 안으로 옮긴다 — 지금은 설계대로 넷째 자리(보이는 단추)에 두되 `SEL_ACTIONS` 의 한 항목으로(11 이 옮기기 쉽게). **"9c" 줄**: `links.medical` 은 9c 백업 허용 목록에 들어간다(9c Build 몫 — 보고서에 키 이름만).
- `queryText` 의 6낱말·60자는 8c-1 `clampSelection` 과 **같은 상수**를 읽는다(설계 4 수용 기준).
- 설계 2 "추천 추가 목록"의 `[확인 필요]` 셋(MSD·Radiopaedia·Bookshelf)은 **웹을 열어 확인하지 마라**(이 Build 는 외부 사이트 접속 없음) — 추천 목록에 설계대로 두고 표시 `[확인 필요]` 를 보고서·실기기 목록에.

## 할 일
설계 3 표 그대로: 새 `js/text/links.js`(순수 — 18-D6 (가) `URL` 존재 검사 예외, 16-A grep 허용 한 줄)·`js/ui/links.js`·`tests/links-18.test.mjs`, 고칠 `js/config.js`(`LINKS`)·`js/settings.js`(`'links.medical': null`)·`js/ui/selbar.js`(`[찾아보기]`)·`js/ui/library.js`(카드 자리)·`js/ui/settings.js`(카드·`#/settings/links` 굴리기)·`index.html`·`css/screens.css`·i18n 4개(약 18키, ar·fr `[검토 — Nour·운영자]`). 열기는 `<a>` + `target=_blank` + `rel="noopener noreferrer"` + `referrerPolicy='no-referrer'`(`window.open` 금지). 삭제 확인은 페이지 안(`confirm()` 금지). 번역 요청 바이트·캐시 키·DB 3·algoVersion·`PROMPT_VERSION` 불변.

## 검증
- 수용 기준 4 전부(`[N]` 테스트, `[D]` headless, `[M]` 보고서 실기기 목록), 변이 4개(설계 4 끝) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b18/bak/`).
- 회귀: 8c-1 선택 줄·탭 띠·Esc 층·손가락 판정, 8f-2 시트(앞 하네스 — `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r8f3b\`·`r8c1c\` 읽기만), 서재·설정 화면, 번역 요청 본문 바이트 HEAD 와 같음.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless(설계 5 — Edge, 새 프로필 `b18/p*`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**): `HTMLAnchorElement.prototype.click` 가로채 실제 이동 막음, 앱 탭 요청 수 셈(18 동작으로 0). 360×740·412×915·915×412 × ko·ar(+en·fr 한 번). 콘솔 오류 0. 스크린샷 4–6장 `b18/shots/`.

## 수정 범위
설계 3 표의 파일 + `index.html`(stamp 포함) + `tests/`(16-A grep 허용 줄이 있는 시험 포함) + `spec.md`(17-9 정정 줄, 3-2 순수 계층 예외 한 줄 — 설계가 말한 곳만) + 스크래치패드 `b18/` + 보고서. `pipeline.js`·`prompts.js`·`db.js`·`wordsheet.js`·`vocab.js`·`search.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. headless 는 한 번에 하나. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. **외부 사이트(MedlinePlus·PubMed 등) 접속 금지** — 가로채서 주소만 본다. 모든 실행 10분 이내, 표준 입력 대기 금지. 큰 원서로 검색 화면에 들어가지 말 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
