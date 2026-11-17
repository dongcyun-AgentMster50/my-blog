# Build 지침 — 14 = 8q 3단 본문 (algoVersion 13, 8i-4 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **4-14-2 "8q — 3단 본문"**(규칙 C0–C4·`reassignByColumn`·`orderLines`/`pushBand`·되돌림·수용 기준 1–3·테스트 C3-1–C3-8·변이·측정 도구)·4-14-5(나누기 — **8q 단독**)·4-14-6 결정(14-D1 (가)·14-D6 (가) "못 넘으면 8q 단독으로 13"·14-D10 (가))·4-14-7(실기기 — 적기만). **14 결정(crossstep "14 결정")**: 8i-4-0 측정이 문턱을 못 넘어 **8i-4 넣지 않음** — 이 Build 는 8q 만, `algoVersion` 12 → **13** 한 번. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8q-cols3-report.md`.

## 읽을 것
- spec 4-14 전부(4-14-1 측정 — SciAm 7권 목록·시제품), 4-5(단 판정 지금 규칙), 4-13-8(되돌림 규칙과 같은 꼴).
- 14 Plan 보고서 `.claude/tasks/medreader-plan-14-report.md`(SciAm 7권 파일 경로·3단 쪽 목록·시제품 `p14/`), 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\p14\`(읽기만 — 시제품·측정 재사용 가능).
- 8i-4-0 보고서 `.claude/tasks/medreader-build-8i4-0-report.md` 와 `apps/medreader/dev/measure-table-8i4.mjs`(추적 안 됨 — **이 Build 는 고치지 말고**, 이 단계 Review 가 측정 결론을 다시 본 뒤 함께 커밋한다).
- `.claude/tasks/medreader-crossstep-notes.md` "14 결정" 절.

## 할 일
설계 4-14-5 표 8q 행 그대로: `js/text/columns.js`(`detectColumns` C1–C4 — **C0 결과를 먼저 계산하고 하나라도 실패하면 바이트 같게 돌려줌**, `reassignByColumn` count 3, `orderLines`·`pushBand` col 0→1→2)·`js/config.js`(LAYOUT `COL3_*`·`COL3_ENABLED`)·`js/text/layout.js`(이력·`algoVersion` 13)·테스트(C3-1–C3-8 합성 픽스처 — 원서 문장 금지)·새 `dev/measure-cols3-8q.mjs`(HEAD 사본 `git archive` 대 지금 코드 전 쪽 비교 + 3단 쪽 목록 + 표 글자 비율). `GUTTER_BAND_LO/HI` 넓히지 않음. `algoVersion` 13 은 Nour 기기 재추출을 한 번 일으킨다(설계가 받아들임 — 14-D6·14-D10). DB 버전·저장본 필드·캐시 키·`PROMPT_VERSION` 불변.

## 검증
- **수용 기준 1(가장 중요)**: 세 의학책 전 쪽 — HEAD 와 새 코드 PageLayout JSON(`algoVersion` 뺌) **바이트 같음, 바뀐 쪽 0**. 책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`(읽기만, Downloads 목록 보지 말 것). pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 큰 책은 나눠서(실행마다 10분 이내).
- **수용 기준 2**: SciAm 7권(14 Plan 보고서 경로 — 읽기만) 3단 판정 쪽 = 115 ± 10, 그 쪽 표 영역 글자 비율 ≤ 10%, 무작위 15쪽 단 순서 확인(원본 PNG 와 낭독 순서 — 글 옮기지 말고 단 번호·줄 수만).
- **수용 기준 3**: 3단 쪽 원본 보기 하이라이트가 한 단 안(headless 한 쪽).
- 해커스·영어 교재 견본(8m 보고서 경로 — 있으면 읽기만) 바뀐 쪽 수 기록.
- 변이(설계 넷 + C4) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8q/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0.
- headless 한 번(Edge, pipe, 새 프로필 `b8q/p1`, 가짜 키, 흉내 Gemini, 캐시 끔, **서버 띄우기 금지**): 옛 판(12) 저장본이 있는 상태에서 앱을 열면 재추출이 일어나고(쪽 우선·재개), 의학책 쪽 낭독이 같고, SciAm 3단 쪽(합성으로 대신해도 됨) 낭독 순서 col0→1→2, 콘솔 오류 0. 번역 요청 본문 바이트는 의학책에서 HEAD 와 같음(문장 불변).
- spec 4-14-2 안 `[정정 2026-11-17 — 8q Build]` 줄(Edit 로 그 자리만, 필요할 때만), 4-5 의 "3단 이상 미지원" 줄에 한 줄.

## 수정 범위
설계 표 8q 행의 파일(`text/columns.js`·`config.js` LAYOUT·`text/layout.js`·`tests/`·`dev/measure-cols3-8q.mjs`) + `index.html`(stamp) + `spec.md` + 스크래치패드 `b8q/` + 보고서. `dev/measure-table-8i4.mjs`·다른 `dev/` 파일·`ui/*`·`ai/*`·`db.js`·review.md 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`(큰 책은 쪽 범위를 나눔). 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
