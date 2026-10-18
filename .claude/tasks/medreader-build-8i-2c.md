# Build 지침 — 8i-2c 테스트만 보강 (`two` 표시 옮기기 세 곳)

> 너는 **Build 서브에이전트**다. 8i-2b Review(review.md 끝 "8i-2b Review" 절)의 권장을 따른다. 8i-2b 는 커밋·푸시됨(`549c9df`).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8i-2c-report.md`.
> **앱 코드는 고치지 않는다 — 테스트만.** algoVersion·실물 출력 불변.

## 문제
8i-2b 가 2열 표시를 `det.two` 로 뺐다. det 를 다시 만드는 세 곳 — `inheritFrom` 의 2열 가지, R2b 와 R6b 의 `Object.assign` — 이 `two` 를 옮겨 준다. 지금 코드는 맞지만, 셋 중 하나를 지우는 변이(Review M1·M2·M3)가 테스트 1069개를 모두 통과한다. 그때 실물은 바뀐다(M1: CMDT 2026 6쪽, M2: Harrison 75 + CMDT 2026 2쪽, M3: Harrison 2쪽 + CMDT 2026 9쪽). 합성 재현: 물려받은 띠의 구획 줄이 body 대신 heading, 다음 행 이름표가 앞 행에 붙음.

## 할 일
1. review.md "8i-2b Review" 절과 스크래치패드 `r8i2b/`(`mut.mjs`·`probe.mjs`·`mut/<id>/`)에서 M1–M3 변이와 합성 재현을 읽는다.
2. `tests/rowtable-8i2.test.mjs` 에 픽스처 3개(지어낸 낱말, 원서 문장 금지) — M1·M2·M3 각각을 빨갛게 만든다. 이름은 이어지는 번호로(예: RT33–RT35).
3. M1–M3 을 레포 `js/text/rowtable.js` 에 하나씩 걸어 새 테스트가 빨강인지 → 복원 → `cmp`. 백업 스크래치패드 `b8i2c/bak/`.
4. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회.

## 실행 규칙
모든 실행에 시간 상한(`timeout`, `--test-timeout`). 브라우저·프로필 없음. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고.

## 작업 트리 주의
작업 트리에 8g-1 Build 의 커밋 안 된 변경이 있을 수 있다(`js/text/screen.js`·`search.js`·`db.js` 등). 그것은 건드리지 않는다. 너는 **`tests/rowtable-8i2.test.mjs` 만** 고치고, 변이는 `js/text/rowtable.js` 에만 잠깐 걸었다 반드시 되돌린다.

## 금지
앱 코드 수정(변이는 되돌린다), 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 원서 문장 인용.
