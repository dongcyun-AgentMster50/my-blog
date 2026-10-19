# Review 지침 — 8g-3 목차·쪽 라벨 (`js/search/outline.js` + reader.js 배선)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8g-3 Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
spec 17-8-6, 17-8-12(1절·3절 목차 실측·6절 8g-3 줄·7절 S16–S18·8절·9절), 4-13-7. 지침 `.claude/tasks/medreader-build-8g-3.md`, Build 보고 `.claude/tasks/medreader-build-8g-3-report.md`(7절 spec 문안 · 남은 문제). 변경: `git diff`(reader.js · measure-search-8g.mjs · index.html stamp) + 새 `js/search/outline.js`·`tests/search-outline-8g.test.mjs`. 직전 커밋 `fc82150`.

## 확인할 것
1. **spec 대로인가**: 개요 펼침·쪽 해석(이름 대상·명시 대상·정수·대상 없음·예외 → `p:null`), 쪽 라벨 저장 조건, `documents` 에 `db.patch`(다른 필드 보존 · 지워진 문서 되살리지 않음), 멱등(`outlineV`), 동시 호출 묶기, 실패 시 저장 안 함, 쪽 수 불일치 가드, 폴백을 저장하지 않고 `tocOf` 로 만드는 Build 결정의 타당성, 계층 규칙(outline.js DOM·window 0, 배선의 `requestIdleCallback` 은 UI 계층).
2. **배선**: `scheduleOutline` 이 리더 성능·쪽 넘김·8i-1/8i-3 경로에 영향이 없는지(한가할 때 · 다른 책으로 가면 중단 · 실패 조용히). [텍스트 다시 추출]·책 삭제·재추출 때 `outline`·`outlineV`·`pageLabels` 가 어떻게 되는지(8g-1 Review: `resetDerived` 는 `documents` 의 이 필드를 안 지운다 — 의도와 맞는지).
3. **측정 재현(네 스크립트)**: 세 권 개요 37·61·50 해석, CMDT 2026 라벨(PDF−38 1,704쪽), 폴백 S18 기준. pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
4. **개요 없는 실물 책에서 폴백**(새로 중요해짐): 운영자가 오늘 OCR 한 어학 교재(`D:/OCR/01_English/` 아래 ` [OCR].pdf` — **읽기만**) 가운데 2–3권(예: Grammar in Use 계열 하나, Harry Potter, 스피쿠스 unit 하나)에 개요가 있는지, 없으면 앱 레이아웃(`dev/measure-lib.mjs` `pageLayout`)으로 heads 를 만들어 `headingToc` 결과가 쓸 만한지(항목 수·처음 10개 제목 — 원서 문장 40자 이하로 잘라서). Build 남은 문제 "폴백 겹침"(숫자 항목에 붙인 장 제목이 같은 층에 또 나옴)이 이 책들에서 얼마나 나오는지 — 고칠지 판정 근거.
5. **테스트의 힘**: 너만의 변이 3개 이상(Build 의 G1–G15·V10 이 안 한 곳). 변이는 outline.js·reader.js 배선·테스트 파일에만. 복원 → `cmp`. 백업 스크래치패드 `r8g3/bak/`.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1143 기대), `stamp --check` 0.
7. Build spec 문안 제안 4건 판정.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). `D:/OCR` 는 읽기만. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g3/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 의학책 경로와 `D:/OCR` 아래만.
