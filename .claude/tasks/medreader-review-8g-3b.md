# Review 지침 — 8g-3b 폴백 목차 품질 · 쓰레기 개요 판정

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8g-3b Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
spec 17-8-12 **§11**(승인 E1–E6, R1–R10, S31–S37, T1–T15), Plan 보고 `.claude/tasks/medreader-plan-8g-3b-report.md`, 지침 `.claude/tasks/medreader-build-8g-3b.md`, Build 보고 `.claude/tasks/medreader-build-8g-3b-report.md`. 변경: `git diff`(config.js · text/search.js · search/outline.js · tests/search-outline-8g.test.mjs · index.html) + 새 `tests/search-toc-8g3b.test.mjs`. 직전 커밋 `67eb4a9`. 기준 정의: `apps/medreader/dev/measure-toc-8g3b.mjs`(`protoJunk`·`protoToc`·`dropReason`).

## 확인할 것
1. **기준 정의와 같은가**: 정규식·예외가 글자 그대로인지, Build 가 넣은 **빠른 길 두 개**(`SENT_END` 는 끝 글자가 부호일 때만, `MULTI` 는 `[.!?]` 있을 때만)가 **모든 입력에서** 결과를 바꾸지 않는지(차등 테스트 — 94권 heading 전부 + 합성 경계 입력), "상한을 넘는 층에서 멈춤"이 기준과 같은 결과를 내는지.
2. **S36 을 네 스크립트로**(또는 `measure-toc-8g3b.mjs` 를 네가 돌려): 94권(의학책 3 + `D:/OCR` 아래 ` [OCR].pdf` 91 — **읽기만**) 앱 ≡ 기준 차이 0, 쓰레기 판정 94/94, 의학책 S18 회귀 0.
3. **기존 테스트 기대값 변경이 한 곳뿐**인지(`git diff tests/search-outline-8g.test.mjs`), 그 변경이 spec 이 말한 R9 그대로인지.
4. **시간**(Build 남은 문제 1): 첫 호출이 8g-3 보다 1–3ms 느린 OCR 두 권 — 사용자 체감(목차 탭 열기) 기준에서 의미가 있는지 판정하고 S36 시간 기준을 어떻게 읽을지 의견.
5. **T5**(R2 말줄임 예외가 효과 없음 — `SENT_END` 와 `ELLIPSIS_END` 가 함께 맞을 수 없음): 맞는지 확인하고, spec 에서 그 예외를 지울지 의견.
6. **테스트의 힘**: T1–T15 중 몇 개를 네 손으로 다시 + 너만의 변이 2개 이상(빠른 길 조건을 틀리게 바꾸기 등). 변이는 search.js·outline.js·테스트 파일에만. 복원 → `cmp`. 백업 스크래치패드 `r8g3b/bak/`.
7. 눈 검토: OCR 교재 3–4권(Grammar in Use 3판 · Longman Grammar Practice · Harry Potter 2 · 스피쿠스 unit 하나)의 새 폴백 처음 15항목을 보고 Plan 의 눈 판정과 맞는지(원서 40자 이하로).
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1158 기대), `stamp --check` 0.

## 규칙
모든 실행에 시간 상한(94권 측정은 전체 상한을 두고). 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). `D:/OCR` 는 읽기만. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g3b/` 만. pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 원서 문장 40자 초과 인용.
