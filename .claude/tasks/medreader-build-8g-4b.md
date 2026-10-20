# Build 지침 — 8g-4b 목차 탭과 검색 마무리 (8g 마지막 단계)

> 너는 **Build 서브에이전트**다. spec **17-8-12** 승인(G1–G5) + §11(8g-3b, E1–E6). 운영자가 8g-4 를 둘로 나눴다(2026-10-19): 4a(검색 화면·이동 — 커밋 `68a6c2e`, F1 수정 `3105226`)에 이어 **4b = 목차 탭과 마무리**(이 지침). 4b 가 끝나면 **8g-2~4 를 한 번에 배포**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-4b-report.md`.

## 반드시 읽을 것
1. **`.claude/tasks/medreader-8g4-carryover.md` 전부.** 이번 4b 몫:
   - **8–10** spec 문구 정리(17-8-5 versionchange 뒤 reject · `onPartial` 두 번 가능 · 17-8-2 "서재 ≤ 3초"는 백필 뒤 기준)
   - **11** 브라우저 실측은 4a Review 가 끝냄 — 4b 는 S19 몫만
   - **12** 목차 탭(`tocOf` 의 `source`·`outlineRead`·`outlineIgnored`·빈 목록 → 문구, 폴백 전 `engine.prepareDoc`, `printedLabel` "p. {인쇄} (PDF {쪽})", `p:null` 흐리게·못 누름)
   - **13** 배선 행동 테스트(가짜 `requestIdleCallback` 으로 `scheduleOutline`, `SEARCH.ENABLED=false` 의 `off`)
   - **14** 쓰레기 개요·폴백 품질은 8g-3b 결과를 그대로 씀
   - **16** R2 약어 예외를 **대소문자가 있는 글자에만** — `text/search.js` 와 **기준 정의 `dev/measure-toc-8g3b.mjs` 를 함께** 고치고 S36(94권 차이 0)을 다시 돌림, spec §11 R2 정정 줄
   - **17** 폴백 머리 문구(E5, 한 문구, 네 언어 — 쓰레기 개요를 버린 책도 같은 문구)
   - **18** `dev/measure-search-8g.mjs --toc` 안내(옛 폴백과 맞대므로 차이가 0 아님 — S18 은 `measure-toc-8g3b.mjs` 로)
   - **19–23** 8g-4a Review 작은 문제: ① 360px 퀴즈 버튼 보일 때 리더 제목 0px ③ `cue` 뒤 "n번째 줄" 표시 늦음 · F2 원본 보기 → 리플로우 복귀 때 적중 화면 밖 · F3 서재 범위에서 다른 책 결과로 가면 빈 번역 띠(리더 떠남 정리) — spec §4-5 에 처리 방식 · spec 문안(Build 8g-4a 제안 6개 그대로 + 2번 "뒤로 돌아올 때만" + ④ 띠 번호가 쪽 순서)
   - **25** (낮음) X1 행동 테스트(`onReaderPage` pending 판정을 순수 함수로)
   - **24** 실기기 확인 목록은 보고서에 그대로 옮겨 운영자에게 넘긴다.
2. spec **17-8-12** §4(화면 — 목차 탭 배치·412px·키보드 없는 길·RTL), §6 8g-4 줄, §7 **S19**(목차 탭: 37·61·50 항목, Harrison 깊이 2 들여쓰기, 누르면 그 쪽 맨 위, 지금 쪽이 든 항목 표시, CMDT 2026 "p. {인쇄} (PDF {쪽})") + §11 의 S19 보강(쓰레기 개요 책 확인), §9 되돌림, i18n 키(목차 키 4개 `search.toc.*`).
3. 코드: `js/ui/search.js`(4a — `#searchTabs`·`#searchToc` 자리 숨김, `search.tab.toc` 키 있음), `js/search/outline.js`(`tocOf`·`printedLabel`), `js/search/engine.js`(`prepareDoc`), `js/text/search.js`, `js/ui/reader.js`, `js/ui/controls.js`, `index.html`, `css/*`, `js/i18n/*`.
4. review.md 끝 "8g-3*"·"8g-4a*" Review 절.

## 할 일
- 목차 탭(S19 + carryover 12·14·17), 4a 작은 문제(19–22), 테스트 보강(13·25), R2 약어 규칙(16, 기준 정의 함께 + S36 재실행), `measure-search-8g.mjs --toc` 안내(18).
- **spec 정리**(carryover 8–10·16·22·23): **17-8-5·17-8-12 안에서만**, 각 줄에 `[정정 2026-10-20 — 8g-4b]`. 다른 절 금지.
- stamp 다시, `--check` 0.

## 검증
- 테스트(S19 순수 부분·목차 모형·폴백 문구 갈래·R2 약어·13·25) + 네 변이 → 빨강 → 복원(**읽어서 쓰기 + `cmp`** — Windows `copyFile` 이 실패한 적 있다). 백업 스크래치패드 `b8g4b/bak/`.
- **S36 재실행**: `measure-toc-8g3b.mjs` 94권(의학책 3 + `D:/OCR` 아래 ` [OCR].pdf` 91 — **읽기만**) 앱 ≡ 기준 차이 0, 의학책 S18 회귀 0. 바뀐 R2 로 OCR 교재(특히 스피쿠스)의 한국어 문장 항목이 얼마나 빠지는지 기록.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1206 + 새).
- **headless**(Edge · 360×740 · 412×915 · 네 언어 · 캐시 끔 · 흉내 음성 · 가짜 키): S19 를 세 의학책 + 쓰레기 개요 교재 1권 + 폴백 교재 1권(`D:/OCR` 에서 — 읽기만)으로, 4a 작은 문제 고침 확인, 8i-3 쪽 넘김 낭독 한 번 회귀. 캡처 스크래치패드 `shots-8g4b/`. 8000번 python(PID 15088)은 쓰고 끄지 마라(없으면 레포 루트에서 띄우고 켜 둠). 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 2개까지. 진짜 API 키 금지(가짜 키·흉내 응답은 스크래치패드 `shot-tool/step2.mjs`).
- **모든 실행에 시간 상한**(94권 측정은 전체 상한). 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리, 못 끄면 PID 보고.

## 수정 범위
`js/ui/search.js`, `js/ui/reader.js`, `js/ui/controls.js`(③), `js/text/search.js`(R2 만), `js/search/outline.js`(필요할 때만 최소), `dev/measure-toc-8g3b.mjs`(R2 기준 정의만), `dev/measure-search-8g.mjs`(`--toc` 안내만), `index.html`, `css/*`, `js/i18n/*`, `tests/`, `spec.md`(17-8-5·17-8-12 안), 스크래치패드 `b8g4b/`·`shots-8g4b/`, 보고서. `js/search/engine.js`·`js/db.js`·`js/pdf/*` 는 건드리지 않는다(필요해 보이면 멈추고 보고). review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책 PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
