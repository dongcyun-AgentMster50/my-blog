# Build 지침 — 20-1 필기: 앵커 · 저장 · 칠하기 (만들기 화면 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-16** 중 20-1 몫 — 1(지금 코드 사실)·2(데이터)·3(앵커 다시 찾기)·4(칠하기)·8 표 20-1 행·import 줄·9 "20-1" 수용 기준·10 결정 표(권장안 — 20-D2·D5·D6·D9)·12(실기기 — 적기만). 운영자 위임: 권장안으로. 호출 0 · DB 버전 3 · `PROMPT_VERSION` 등 판본 상수 불변. **본문 DOM 에 아무것도 끼우지 않는다.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-20-1-anchor-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- `algoVersion` 은 이제 **13**(14 = 8q 3단 본문 배포). 설계 1 표의 "12" 는 옛 값 — 코드에서 읽어라(상수를 박지 말 것).
- 설계 1 표의 줄 번호는 옛 것일 수 있다 — `js/ui/search.js` 의 `screenIndex`·`rangesOnScreen`, `js/ui/charhl.js`, `js/ui/original.js` 상자 풀, `js/ui/reader.js` `onPageRender`/다시 그리기 자리를 직접 찾아라.
- `db.js` `CASCADE_STORES` 는 **20-3 몫** — 이 단계에서 건드리지 말 것(문서 삭제 시 필기 지워지는 지금 규칙 유지).
- 12 기억 카드는 `sentenceDocKey`(fileHash 바탕) — 필기와 따로(20-D12). 이 단계는 만들기 UI 없음: 시험·측정은 서비스 `create` 로 심는다.

## 할 일
설계 8 표 20-1 행 그대로: 새 `js/text/anchor.js`(순수 — `anchorOf`·`resolve`·`foldText`·`findQuote`) · `js/notes/annotations.js`(서비스 — `create`·`update`·`remove`·`forPage`·`list`·`count`·`reattach(fileHash, newId)`; `group` id 로 문단 넘는 선택 함께 지움) · `js/ui/annotate.js`(리플로우 Custom Highlight 이름 다섯 `anno-yellow/green/blue/pink/note`, 우선순위 필기 0 < 검색 1 < 낭독 2, 미지원 → `.anno-line-{color}`; 원본 보기 `.anno-layer` 상자 층 — 낭독 풀과 따로, `ANNO.MAX_BOXES_PAGE` 200 넘으면 줄 통째로 합침, 회전 줄 제외, 확대·쪽 넘김 때 다시) · 시험 `tests/anchor-20.test.mjs`·`tests/annotations-20.test.mjs`. 고칠 것: `js/text/screen.js`(`screenIndex`·`rangesOnScreen` **옮김만** — 검색 시험 무변) · `js/ui/search.js`(import 바꿈) · `js/ui/original.js`(필기 층) · `js/ui/reader.js`(배선) · `js/config.js`(`ANNO`) · `css/reader.css`·`css/tokens.css`(`--anno-*` 네 테마 + 고대비 — 세피아에서 노랑이 묻히지 않게, 대비를 재서 보고서에).
- 다시 찾은 결과는 `algo` 가 다르고 `how ≠ 'exact'` 일 때만 그 쪽 처음 그릴 때 한 번 `db.patch`(20-D6). 고아(null)는 레코드를 지우지 않는다.

## 검증
- 수용 기준 "20-1" 전부. **실물 회귀**: CMDT 2026(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` — 읽기만, Downloads 목록 보지 말 것, pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`) 표본 20쪽(행 표가 있는 쪽 포함 — 고른 기준을 적을 것)에서 무작위 필기 200개를 지금 판으로 만들고, **행 표를 끈 판**(측정 스크립트 안에서만 설정을 바꿔 — 앱 코드 무변)으로 다시 그린 쪽에서 `resolve` — 찾음 ≥ 99%, 다른 자리 0(글자 비교). 결과에 원서 글 0(숫자만). 덤으로 HEAD~1(algoVersion 12) 사본 대 지금(13) 도 같은 측정(SciAm 3단 쪽 표본이 있으면 — 14 Plan 보고서 경로, 읽기만).
- 변이(설계 셋) + 네가 고른 둘 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b20-1/bak/`).
- 회귀: **검색 강조·검색 시험 전부 그대로**(옮김), 낭독 하이라이트가 필기 위, 원본 보기 낭독 상자 무변, 11-3/12-3 화면, 요청 본문 바이트 HEAD 와 같음, 네트워크 요청 0.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0. `innerHTML` 새 사용 0.
- headless(Edge, pipe, 새 프로필 `b20-1/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF): 심어 둔 필기 3색 → `CSS.highlights` 이름 셋, 낭독 중 낭독이 위, Highlight 미지원 흉내 → 줄 클래스, 원본 보기 `.anno-layer` 상자가 줄 bbox 안·확대 뒤 맞음, 네 테마 스크린샷 2–4장 `b20-1/shots/`. 콘솔 오류 0.
- spec 17-16 안 `[정정 2026-11-17 — 20-1 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 8 표 20-1 행의 파일 + `index.html`(stamp) + `spec.md` + 스크래치패드 `b20-1/` + 보고서. `db.js`·`ai/*`·`backup/*`·`text/backup.js`·`text/columns.js`·`text/layout.js`·`speaker.js`·`selbar.js`·`voice/*`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
