# Build 지침 — 8g-4a 검색 화면과 결과로 이동 (목차 탭 제외)

> 너는 **Build 서브에이전트**다. spec **17-8-12** 승인(2026-10-18 G1–G5). 8g-2·2b·2c(엔진)·8g-3·3b(목차 데이터)는 커밋됨(미푸시). 운영자가 8g-4 를 **두 번에 나누기**로 했다(2026-10-19): **8g-4a = 검색 화면·결과·이동**(이 지침), 8g-4b = 목차 탭·마무리. 8g-2~4 는 **4b 가 끝난 뒤 함께 배포**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-4a-report.md`.

## 반드시 읽을 것
1. **`.claude/tasks/medreader-8g4-carryover.md` 전부** — 지난 Review 다섯 번이 화면에 넘긴 18개 항목. 이번 4a 몫: **1–5**(엔진 결과 세 통로·앞 세대 reject 무시·`onPartial` 바꿔 그리기·서재 책별 진행·저장소 찬 동안), **6–7**(엔진 테스트 보강), **15**(테스트 보강 2개 — `text/search.js`). 나머지(8–14, 16–18)는 4b 몫 — 건드리지 않는다(단 화면 구조가 목차 탭을 나중에 붙일 수 있게 자리만).
2. spec **17-8-12**: §4 화면(412px 배치·키보드 없는 길·아랍어 RTL·결과로 이동 표 — 8i-1·8i-3 경로와의 맞물림·`pauseForJump`·`speaker.cue`·`onPageRepaint`), §6 **8g-4 줄**, §7 **S20–S29**(S19·S30 은 4b), §8 변이 V11·V12 등 화면 몫, §9 되돌림(`SEARCH.ENABLED=false` → 입구 숨김), i18n 키 목록(39개 × 4 — `common.reload` 포함, 이미 있는 것 확인). 17-8-5(엔진 API·결과 필드·오류), 17-8-7·17-8-8.
3. 코드: `js/search/engine.js`(API — 고치지 않는다, 6–7 테스트 보강만), `js/search/outline.js`(읽기만), `js/text/search.js`(`snippetAt`·`rangesFor` — 화면이 쓴다), `js/ui/reader.js`(8i-1·8i-3·8g-3 배선 — `renderPage`·`createRenderDone`·`goToPageForSpeech`·`scheduleOutline`), `js/ui/controls.js`, `js/tts/speaker.js`, `js/router.js`, `js/ui/library.js`, `index.html`, `css/*`, `js/i18n/*`.
4. review.md 끝 8g 계열 Review 절들(특히 "8g-2b"·"8g-2c" 의 화면 몫 메모).

## 할 일
- `js/ui/search.js`(새): 검색 화면(책 범위·서재 범위), 입력·최근 검색 칩 5개(`settings.search.recent`)·음성 입력은 OS 키보드에 맡김, 결과 묶음(제목 → 본문 → 표, 줄 ≥ 48px, 조각 `<mark>` 는 `textContent` 조각으로 — innerHTML 금지), 진행·부분 결과(같은 세대는 **바꿔 그림**)·`truncated`·오류 안내(carryover 1: `ERR_SEARCH_*` / `ERR_DB_*` 적중과 함께 / reject 일반 안내, 2: 앞 세대 reject 무시), 서재 범위 책별 백필 진행(4), 빈 결과 안내(S29).
- `router.js`: `#/search`·`#/search/:docId`. 검색어는 URL 에 넣지 않는다(S28). Android 뒤로 = 결과 목록·검색어·스크롤 유지.
- `ui/reader.js`: 상단바 [🔍] 입구(48×48, 한 줄 — S20), 검색 띠 `‹ i/n › [읽던 곳으로] ✕`, `onPageRepaint`(언어·뷰 전환·옛 판 → 새 판 다시 그리기 뒤 강조 다시 칠함 — S25·S26), `readingSpot()`, `revealLine`/`revealRegion`(적중을 본문 세로 중앙 ±20% — S23, 표 적중은 크롭으로 S27). 8i-1·8i-3 경로(다시 그리기·렌더 완료 알림·쪽 넘김 낭독)를 **깨지 않는다**.
- `ui/controls.js` `pauseForJump`·`cueAt`, `tts/speaker.js` `cue`: 낭독 중 결과로 → 멈춤, `search.paused` 한 번, [▶] 가 적중 문장부터(인용 적중이면 그 뒤 첫 발화) — S24. 그사이 번역 요청 0. [읽던 곳으로] 는 원래 문장을 시작점으로(G3).
- `ui/library.js`: 서재 [검색](서재 범위).
- `index.html`·`css/*`: 상단바·띠·결과 줄, `::highlight(search-hit)`·`::highlight(search-cur)`(CSS Custom Highlight API 미지원 브라우저 대체), 세피아 등 기존 테마와 어울림.
- `i18n/*` ×4: 이번 화면에 필요한 `search.*` 키(목차 탭 몫 키는 4b — 단 이미 spec 목록에 있으면 지금 넣어도 됨), 아랍어 RTL(S22).
- `SEARCH.ENABLED=false` 면 입구가 모두 숨는다.
- carryover 6·7·15 테스트 보강.

## 검증
- 단위·통합 테스트(화면 순수 부분 · 라우터 · `pauseForJump`/`cue` · 오류 세 통로 · 바꿔 그리기 · 앞 세대 무시) + spec 변이 V11·V12 등 화면 몫 + 네 변이 → 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g4a/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1158 + 새). `stamp` 다시, `--check` 0.
- **headless 브라우저**(Edge · 360×740 · 412×915 · 캐시 끔 · 흉내 음성 · 가짜 키): 새 프로필에 CMDT 2026 을 넣어 S20–S29 를 한 번씩 돌려 보고 캡처 몇 장(스크래치패드 `shots-8g4a/`). 8000번 서버(`python -m http.server`)가 없으면 레포 루트에서 띄우고 켜 둔다. 프로필은 모두 합쳐 2개까지. 진짜 API 키 금지(가짜 키·흉내 응답은 스크래치패드 `shot-tool/step2.mjs` 참고). 실측 S15(시간)는 Review 몫이지만 대략값을 적어라.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리, 못 끄면 PID 보고.

## 수정 범위
위 "할 일"의 파일들, `tests/`(새·보강), 스크래치패드 `b8g4a/`·`shots-8g4a/`, 보고서. `js/search/engine.js`·`js/search/outline.js`·`js/text/search.js` 는 **테스트 보강(6·7·15)에 필요한 것 말고는 고치지 않는다** — 엔진 동작을 바꿀 필요가 보이면 멈추고 보고. spec·review 는 건드리지 않는다(고칠 문안은 보고서에).

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`(와 필요하면 나머지 두 의학책 경로)만.
pdf.js(Node 측정이 필요하면) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
