# Review 지침 — 8i-2c (테스트만: `two` 표시를 옮기는 세 곳을 지키는 RT33–RT35)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 짧은 **"8i-2c Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
지침 `.claude/tasks/medreader-build-8i-2c.md`, Build 보고 `.claude/tasks/medreader-build-8i-2c-report.md`, review.md "8i-2b Review"(M1–M3 근거). 변경: `git diff -- apps/medreader/tests/rowtable-8i2.test.mjs` 만 있어야 한다(직전 커밋 `9d55ac3`).

## 확인할 것
1. 변경이 **테스트 파일 하나뿐**인지(`git status`), 앱 코드·index.html 이 커밋과 같은지.
2. RT33–RT35 가 각각 M1·M2·M3 을 **하나씩** 잡는지 네 손으로 변이를 걸어 확인(Review 8i-2b 의 M1–M3 정의, 스크래치패드 `r8i2b/`). 복원 → `cmp`. 백업 스크래치패드 `r8i2c/bak/`.
3. 픽스처가 지어낸 낱말만 쓰는지, "그 단계가 실제로 돌았다"는 선행 단언이 의미 있는지(단계가 안 돌아도 통과하는 헛테스트가 아닌지 — 예: R7/R2b/R6b 를 통째로 끄는 변이로 확인).
4. RT31 목록에 넣은 픽스처로 `REQUIRE_REF:true` 바이트 동일 검사가 실제로 도는지.
5. Build 발견 1(RT28 이 칸 번호 `k` 를 안 봄) — 보강이 필요한지 의견.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1103 기대), `stamp --check` 0.

## 규칙
모든 실행에 시간 상한. 앱 코드·테스트는 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8i2c/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치, `.nojekyll` 삭제.
