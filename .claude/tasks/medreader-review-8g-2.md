# Review 지침 — 8g-2 검색 엔진 (`js/search/engine.js` + library.js 배선)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **맨 끝**에 **"8g-2 Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
- spec **17-8-12**(6절 8g-2 줄, 7절 S8–S15, 8절 변이, 9절 되돌림), 17-8-5(검색 흐름)
- 지침 `.claude/tasks/medreader-build-8g-2.md`, Build 보고 `.claude/tasks/medreader-build-8g-2-report.md`, review.md "8g-1 Review"(보강 3건의 근거)
- 변경: `git diff`(library.js +7 · index.html stamp · 테스트) + 새 `js/search/engine.js`, 새 테스트 파일들, `dev/measure-search-8g.mjs` 변경. 직전 커밋 `21ede92`.

## 확인할 것
1. **spec 대로인가**: 백필(지금 algoVersion 만 · `sk` 다르면 다시 · 빠진 쪽만 · `pages` 읽기와 `searchText` 쓰기 한 트랜잭션 · `SEARCH.ENABLED=false` 면 0), 캐시(열린 책 하나), 상한 1,000·`truncated` 정의, 묶음 순서, 세대 취소(`signal`·`onPartial` 순서), 서재 범위, `notePage`/`invalidate`, 계층 규칙(engine 은 DOM·window 0).
2. **코드 문제**: 백필 중 추출기가 같은 쪽을 쓰는 경쟁(트랜잭션 순서·덮어쓰기), 백필 중 취소·리더 떠남, 50쪽 묶음의 큰 트랜잭션이 폰에서 오래 잡는 위험, 삭제·다시 추출 직후 진행 중 검색, 캐시 메모리(CMDT 2021 원문 + 접은 글자 크기 — 폰 메모리), `onPartial` 이 백필 전 결과를 한 번 보낸 뒤 최종 결과와 중복·순서, 서재 범위가 안 연 책까지 백필하는 결정의 비용(Build 문안 제안 3).
3. **측정 재현(네 스크립트)**: 최소 CMDT 2026 한 권 — 앱 엔진 결과(검색어 10개 이상: 흔한 낱말·약어·합성어·하이픈·여러 낱말)를 시제품과 비교 차이 0, 결과 쪽 다시 찾기 불일치 0, 검색 시간(Node). pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
4. **보강 3건**이 실제로 무엇을 묶는지: ENABLED=false 사본 테스트가 앱 코드 경로를 정말 타는지(사본이 옛 판을 부르지 않는지), 경계값, S6 2초 상한.
5. **테스트의 힘**: 너만의 변이 3개 이상(Build 의 E1–E10·W1–W2 가 안 한 곳). 변이는 **`js/search/engine.js`·`js/ui/library.js`·테스트 파일에만** 건다 — `js/text/*`·`js/pdf/*` 는 다른 조사 에이전트가 import 중이니 건드리지 마라. 복원 → `cmp`. 백업 스크래치패드 `r8g2/bak/`.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1117 기대), `stamp --check` 0.
7. Build 의 spec 문안 제안 4건(보고서 8절)이 맞는지 판정.
8. 브라우저는 하지 않는다(화면이 없다 — 8g-4 Review 몫). 다만 실제 IndexedDB 에서만 드러날 위험(fake-idb 가 관대한 점)이 보이면 적어라.

## 실행 규칙
모든 실행에 시간 상한(`timeout` · `--test-timeout`). 표준 입력을 기다리는 명령(`python -` 등) 금지. 띄운 node 정리, 못 끄면 PID 보고. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g2/` 만.

## 동시 작업 주의
다른 조사 에이전트가 `G:/01_Language` 를 읽으며 레포의 `dev/measure-lib.mjs`·`dev/measure-scan-o1.mjs`·`js/text/*` 를 import 한다. 그 파일들은 건드리지 않는다.

## 금지
앱 코드·테스트·spec 수정(변이는 되돌린다), 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
