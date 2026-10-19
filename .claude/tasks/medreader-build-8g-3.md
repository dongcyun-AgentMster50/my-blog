# Build 지침 — 8g-3 목차·쪽 라벨 (`js/search/outline.js`)

> 너는 **Build 서브에이전트**다. spec **17-8-12** 승인(2026-10-18 G1–G5, G5 = 인쇄 쪽 번호로 쪽 이동은 이번엔 안 함·**쪽 라벨 저장만**). 8g-1(데이터)은 푸시됨, 8g-2·2b·2c(엔진)는 커밋됨(`757b46f`·`f42f72e`·`548613e`, 미푸시). 8g-2~4 는 **함께 배포**하므로 이번엔 만들기만 한다.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-3-report.md`.
> **화면 변화 없음** — 목차 탭(S19)은 8g-4 화면 몫. 리더가 한가할 때 `outline.ensure` 를 부르는 최소 배선만(사용자에게 보이는 것 0).

## 읽을 것
- spec **17-8-6**(목차 — PDF 개요 먼저, 없으면 heading 폴백), **17-8-12** 1절(U11 숫자 항목 붙이기·U-목차 관련), 3절 목차 실측(개요 37·61·50, 깊이, CMDT 2026 쪽 라벨 −38, 폴백 품질), 6절 **8g-3 줄**, 7절 **S16–S18**(S19 는 8g-4), 8절 변이 중 8g-3 몫, 9절 되돌림, 4-13-7(폴백에 rowhead 섞지 않음)
- 8g-1·8g-2 보고서·Review 절(review.md "8g-1 Review"·"8g-2* Review") — 계층 규칙·`db.patch`·`documents` 스토어(`outline`·`pageLabels` 는 `documents` 에 둔다 — 8g-1 Review: [텍스트 다시 추출]이 지우지 않는다)
- 코드: `js/text/search.js`(`headingToc` — 8g-1 에서 이미 순수 함수로 있음, U11 확인), `js/search/engine.js`(계층·오류 코드 방식 참고), `js/db.js`(`patch`·`documents`), `js/pdf/*`(pdf.js 문서 객체를 어디서 얻는지 — `getOutline`·`getDestination`·`getPageIndex`·`getPageLabels`), `js/ui/reader.js`·`js/ui/library.js`(한가할 때 부를 자리), `dev/measure-search-8g.mjs`(목차 측정 부분)

## 할 일
1. `js/search/outline.js`(새, 서비스 계층 — DOM·window 0): `ensure(docId, pdfDoc)` — 개요를 펼쳐 항목마다 `{title, p, depth}`(이름 대상·명시 대상 해석, 대상 없음은 `p:null`, `getPageIndex` 가 던지면 `p:null` 로 예외 없이), 쪽 라벨(`getPageLabels`) 저장, 결과를 `db.patch` 로 `documents` 에. 이미 있으면 다시 하지 않음(멱등). 개요가 없으면 `headingToc`(폴백 C) — 폴백 결과를 저장할지 매번 만들지는 spec 대로(없으면 네 판단 + 이유).
2. `text/search.js` `headingToc` 가 spec U11(숫자만인 항목은 같은 쪽 다음 heading 을 붙임)·10번 반복 제목 빠짐·항목 ≤ 200·rowhead 섞지 않음을 지키는지 확인하고, 모자라면 **그 함수만** 고친다(기존 테스트 기대값 불변).
3. 최소 배선: 리더가 한가할 때(첫 렌더 뒤 `requestIdleCallback` 류 — 브라우저 API 는 UI 계층에서만) `outline.ensure` 를 한 번 부른다. 실패해도 리더에 영향 0(조용히 무시, 다음 기회에 재시도).
4. 테스트 S16·S17(가짜 pdfDoc·합성 heads) + 멱등·실패 무시.
5. `measure-search-8g.mjs` 로 S18: 세 권 폴백 C — CMDT 2021 개요 제목 45/50 이상·항목 ≤ 200, Harrison 개요 쪽 27/37 이상(Plan 실측과 같거나 낫게). 개요 해석 결과 37·61·50 항목과 쪽 대응(CMDT 2026 라벨 포함) 확인.
6. `node apps/medreader/dev/stamp-importmap.mjs`, `--check` 0.

## 검증
- spec 8절 변이 중 8g-3 몫 + 네 변이(예: `p:null` 처리 빼기, 멱등 검사 빼기, U11 빼기) → 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g3/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1128 + 새).
- pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. npm 설치·다운로드 금지.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령(`python -` 등) 금지 — 편집은 Edit 도구로. 띄운 node 정리, 못 끄면 PID 보고. 브라우저 없음.

## 수정 범위
`js/search/outline.js`(새), `js/text/search.js`(`headingToc` 만, 필요할 때), 배선 최소 줄(`js/ui/reader.js` 또는 `library.js`), `tests/`(새 테스트), `dev/measure-search-8g.mjs`(목차 측정 보강), `index.html`(stamp 로만), 스크래치패드 `b8g3/`, 보고서. spec·review 는 건드리지 않는다(고칠 것은 보고서에 문안으로). `js/search/engine.js` 는 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
운영자 PC 에서 OCR 일괄 작업이 돌고 있다(CPU 사용 — 시간 수치는 참고만, 레포와 무관).
