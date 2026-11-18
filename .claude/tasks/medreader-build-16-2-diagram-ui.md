# Build 지침 — 16-2 개념도: 그리기 · 화면

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-14** 중 16-2 몫 — 4(그리기·화면·저장)·5 표 16-2 행·6(호출)·7 "16-2" 수용 기준·8 결정 표(권장안 — 16-D6·D7·D8·D9·D10·D11)·10(실기기 — 적기만), 17-14 안 `[정정 … — 16-1 Build]` 줄. 운영자 위임: 권장안으로. **새 호출은 `[개념도 그리기]`·`[다시 그리기]`(먼저 묻는다) 를 누를 때만**, 자동 0. DB 3 · 판본 상수 불변 · 다른 요청 본문 바이트 불변. **`innerHTML` 0 — `createElementNS` 만.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-16-2-diagram-ui-report.md`.

## 먼저 고칠 것 — 16-1 Review(16-1R) (16-1 은 아직 배포 전 — 16-2 와 함께 배포한다)
review.md 끝 "16-1 Review" 절을 먼저 읽어라. 아래 항목에 한해 `js/ai/grounding.js`·`js/text/diagram.js`·`js/ai/prompts.js`·새 순수 파일 하나·시험 수정 허용.
1. **중간-1 — 라벨 숫자 판정이 15 보다 너그러움**(범위·비율·`×`·지수·`±` 한쪽 끝만 남음, 비교 기호 뒤집힘 `≤`→`≥`·`<`→`>`): 15 의 "숫자 표현 덩어리"(`grounding.js` `numberSpans` — 부호·비교 기호·단위 기호 포함)를 **새 순수 `js/text/numexpr.js` 로 옮겨 한 벌**로 두고, `grounding.js` 와 `text/diagram.js` 가 함께 쓴다. 개념도 라벨 규칙: **라벨 안 숫자 덩어리 각각이 (붙은 비교·부호 기호까지 포함한 글자 그대로) 보낸 개요 글의 어떤 덩어리와 같아야 한다** — 아니면 그 노드 버림. 덩어리 비교는 공백·NBSP 접기와 아랍-인도 숫자 ↔ 서방 숫자 같게(15 와 같은 정규화). Review `r16-1/safety.mjs` 42꼴(읽기만, 사본)에서 "16 통과·15 버림" 꼴과 비교 기호 뒤집힘 꼴 모두 버림, "맞게 버림"·정당 꼴 무변.
   - **옮김 회귀 0(가장 중요)**: 15 하네스 — `r15-1/ground.mjs`·`r15-2/ground2.mjs`·`r15-2b/bound.mjs`·`b15-2c/bound2.mjs`·`r15-2c/forms.mjs`·`forms2.mjs`·`forms3.mjs`(모두 읽기만, 사본으로) 출력이 옮기기 전과 **바이트 같음**, `grounding-15` 시험 전부 그대로.
   - 시험 D2 에 위 꼴 단언, 변이 둘(덩어리 비교 지움·비교 기호 무시) 빨강.
2. 낮음-2(엣지가 노드 상자를 지남)·3(라벨 겹침)은 이 단계 그리기에서: 선을 노드 아래 층에 그리고, 엣지 라벨이 그림 밖으로 나가지 않게 viewBox 여백. 낮음-5: `diagram()` 에는 개요 레코드의 `target` 만 넘긴다. 낮음-4(라벨 출처 낱말 검사 없음)·6(큰 장 2단)은 실기기 줄에 기록만.

## 설계 뒤 바뀐 것 — 맞춰라
- 16-1 보고서 `.claude/tasks/medreader-build-16-1-diagram-report.md`(API: `layoutDiagram`·`checkDiagram`·`diagram()`·저장 꼴).
- **15 배포됨**: 15 묶음 화면(`ui/review.js`) 칸 3 개요 칸에 작은 그림 + `[개념도 (호출 1)]` 자리(15-2 가 주석으로 남겼다). 11-3 모아 보기 개요 머리에도.
- 11-3 `ui/tree.js` `renderTree` 재사용(글로 보기). 11 시트 높이 식·`visualViewport` 장치.
- 관계 이름은 **대상 언어**(UI 언어 아님) — 대상 언어 사전 4개 중 그 언어 것, ar·fr `[검토 — Nour·운영자]`.
- 사용량 화면(`ui/usage.js`) 종류 이름 한 줄(`EXPLAIN_KIND` 와 같은 꼴).
- SVG 내보내기: 토큰을 계산된 색으로 박아 `Blob` + `<a download>`(11-3 `exportText` 장치와 같은 꼴), 호출 0.
- Write/Edit 도구가 `\u…` 이스케이프를 실제 글자로 넣는 사고가 여러 번 있었다 — 쓴 뒤 특수 글자 수 점검.

## 할 일
설계 5 표 16-2 행 그대로: 새 `js/ui/diagram.js`·`tests/diagram-ui-16.test.mjs`, 고칠 `js/notes/summaries.js`(`diagram` 필드)·`js/ui/summaries.js`(단추·작은 그림)·`js/ui/review.js`(작은 그림)·`js/ui/usage.js`·`index.html`(시트 그릇)·`css/screens.css`·i18n 4개. 그리기: `<svg role="img" aria-labelledby>`+`<title>`+`<desc>`, 노드 `<rect>`+`<text>`/`<tspan>`(`textContent`), 대상 언어 줄 `direction`=dir, src 줄 따로 된 `<text direction="ltr" lang=src>`(한 줄에 두 방향 섞지 않음), 엣지 `<path>`+`<marker orient="auto-start-reverse">`, 라벨 배경 rect. 크기: 전체 보기 / 12px 문턱 아래면 [크게](그릇 안 스크롤, 쪽 가로 스크롤 0). 글로 보기 `<details open>` 트리 + 관계 `<ol>`. 개요 `cacheKey` 가 바뀌면 "개요가 바뀌었습니다 — [다시 그리기]". 고지 `diagram.disclaimer`. 배치는 저장하지 않음(화면 폭·RTL 바뀌면 다시 계산 — 호출 0). 브라우저 `measure` = 캔버스 `measureText`(화면과 같은 글꼴 문자열).

## 검증
- 수용 기준 "16-2" 전부 + 변이(네가 고른 셋 이상 — 글로 보기 항목 수·RTL·12px 문턱 포함) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b16-2/bak/`).
- 회귀: 11-3 모아 보기·개요 트리·요약 시트, 15 묶음 화면, 사용량 화면, 9c(`annotations` 의 `diagram` 필드 멱등). 번역·요약·설명·출제 요청 본문 바이트 HEAD 와 같음. 열기·크게·글로 보기·회전·RTL·그림 저장 요청 0.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독), `--check` 0, `git diff --check` 0. `innerHTML` 새 사용 0(노드 라벨·개요 제목에 `<img onerror>`·`<script>` 꼴 — 흉내 Gemini 응답).
- headless: Edge, pipe, 새 프로필 `b16-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS(개념도 응답 흉내), 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF + 저장 개요. 360×740·412×915·915×412 × 4언어(대상 ar·ko), 네 테마 + 고대비 선·글자 대비, 48px, 넘침 0, SVG 내보내기 파일(Blob 가로채 — 색이 박혀 있고 `var(` 0). 콘솔 오류 0. 스크린샷 4–6장 `b16-2/shots/`.
- spec 17-14 안 `[정정 … — 16-2 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 5 표 16-2 행의 파일 + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b16-2/` + 보고서. 위 "먼저 고칠 것" 의 파일(그 항목만) — 이유를 보고서에. `db.js`·`backup/*`·`text/backup.js`·`speaker.js`·`voice/*`·`selbar.js`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
