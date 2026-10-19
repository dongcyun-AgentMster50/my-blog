# Review 지침 — 8g-2c 검색 엔진: 읽기 실패가 캐시에 붙는 문제 (두 줄 + 테스트)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 짧은 **"8g-2c Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
지침 `.claude/tasks/medreader-build-8g-2c.md`, Build 보고 `.claude/tasks/medreader-build-8g-2c-report.md`, review.md "8g-2b Review"(남은 문제 1·P9·P10). 변경: `git diff`(engine.js · tests/search-db-8g.test.mjs · index.html stamp). 직전 커밋 `f42f72e`.

## 확인할 것
1. 변경이 지침 범위뿐인지(`git status` · `git diff --stat`).
2. ⓐ `ensureLoaded` 실패 시 캐시 비움 — `cache === c` 검사가 경쟁(다른 책으로 바뀐 뒤 늦게 온 실패)에서 맞게 도는지, 실패한 그 검색 말고 동시에 기다리던 다른 검색들은 어떻게 되는지. ⓑ `rereadDirty` 실패 시 표시 되돌림 — 되돌리는 동안 새로 들어온 `notePage` 와 섞여 표시가 빠지거나 겹치지 않는지. `dbFailure` 가 이미 `DbError` 인 오류·`AbortError`·검색어 오류를 잘못 감싸지 않는지.
3. 새 테스트 S13e·S13f 가 고친 동작을 실제로 묶는지 — 네 손으로 ⓐ·ⓑ 를 되돌리는 변이 + 너만의 변이 1–2개(예: `cache === c` 검사 빼기, 되돌릴 때 기존 표시를 덮어쓰기). 복원 → `cmp`. 백업 스크래치패드 `r8g2c/bak/`.
4. Review 탐침(스크래치패드 `r8g2b/probe.mjs`)을 다시 돌려 P9·P10 이 고쳐지고 나머지(P1·P1b·P2·P3·P8·P11·P12·P13)는 그대로인지.
5. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1128 기대), `stamp --check` 0.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 변이는 engine.js·테스트 파일에만. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g2c/` 만. 운영자 PC 에서 OCR 일괄 작업이 돌고 있다(레포와 무관). 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제.
