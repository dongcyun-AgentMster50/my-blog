# Review 지침 — 8i-2b (D10 구멍 막기 + 테스트 보강, 실물 출력 불변)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **맨 끝**에 짧은 **"8i-2b Review"** 절로 덧붙인다. 앞 절은 고치지 않는다.
> **`spec.md` 는 건드리지 않는다**(다른 Plan 이 동시에 고친다).

## 읽을 것
지침 `.claude/tasks/medreader-build-8i-2b.md`, Build 보고 `.claude/tasks/medreader-build-8i-2b-report.md`, review.md "8i-2 Review"(8i2R-6 B·8i2R-7). 변경: `git diff -- apps/medreader/js/text/rowtable.js apps/medreader/tests apps/medreader/index.html`. 직전 커밋 `b37c21f`.

## 확인할 것
1. **D10**: `det.two`·`isTwo` 로 바뀐 9곳을 줄 단위로 읽고, R 표에서 물려받은 띠가 어떤 경우에도 2열 경로에 들지 않는지, `REQUIRE_REF:true` 에서 2열 경로가 완전히 닫히는지. 8i2R-6 B 의 네 합성 재현(스크래치패드 `r8i2/repro.mjs`)을 다시 돌려 이제 8i 와 바이트 같은지.
2. **실물 불변**: 세 권 전권을 **네 스크립트로** `b37c21f` 의 rowtable.js(`git show b37c21f:경로 > 스크래치패드`)와 지금 판에서 뽑아 바이트 비교 → 다른 쪽 0. `REQUIRE_REF:true` 대 8i(`246e392`) 도 0인지. pdf.js 는 8i-2 Review 와 같은 5.6.205(경로는 8i-2 Build 보고서). npm 설치·다운로드 금지.
3. **테스트의 힘**: V2–V6 과 D10 변이를 네 손으로 다시 걸어 Build 표와 같은지. V2·D10f 가 "닿을 수 없는 방어"라는 Build 주장이 맞는지 판정. 너만의 변이 1개 이상. 복원 → `cmp`. 백업은 스크래치패드 `r8i2b/bak/`.
4. 새 테스트가 원서 문장을 쓰지 않는지(지어낸 낱말), RT31 목록에 넣은 픽스처가 적절한지.
5. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1069 기대), `node apps/medreader/dev/stamp-importmap.mjs --check` 0.

## 실행 규칙
모든 실행에 시간 상한(`timeout` · `--test-timeout`). 띄운 프로세스는 정리, 못 끄면 PID 보고. 브라우저·프로필 복사 없음. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 동시에 8g Plan 이 `apps/medreader/dev/measure-search-8g.mjs`·spec.md 를 만지고 있다 — 건드리지 않는다.

## 수정 범위
**앱 코드·테스트는 고치지 않는다**(변이는 되돌린다). 쓰는 곳: review.md 끝 절, 스크래치패드 `r8i2b/`.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
