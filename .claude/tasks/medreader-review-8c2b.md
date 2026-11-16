# Review 지침 — 8c-2b 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8c-2b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8c2b/`(`r8c2/`·`b8c2b/` 는 읽기만 — `rdiff.mjs` 재사용 가능).

## 볼 것
review.md "8c-2 Review", 지침 `.claude/tasks/medreader-build-8c2b-fix.md`, 보고서 `.claude/tasks/medreader-build-8c2b-fix-report.md`(믿지 말고 다시 재라), spec 17-7-6 4-7 `[정정 2026-11-16 — 8c-2b]`, `git diff`(8c-2 + 8c-2b 함께 미커밋 — 8c-2b 몫은 `checkWarn` 시계 한 번 읽기·구독자 `Promise.resolve().catch`·`pruneUsage`).

## 확인할 것
1. 중간-1 닫힘: 자정 직전·직후·읽기 사이 자정(여러 시간대, DST 날 포함) — 날마다 경고 정확히 1번, `capWarned` 는 그 날 행에만.
2. 새 고침 부작용: 구독자 호출이 동기 예외·비동기 거절 모두 번역을 멈추지 않고 다른 구독자에게 전달됨, 구독자 순서 그대로. `pruneUsage` 가 8c-2 판 `load()` 와 같은 행만 지움(무작위 행 묶음으로 대조).
3. 회귀: `rdiff.mjs` 10 시나리오 HEAD 대조(요청 본문·사용량 행(`capWarned` 제외)·이벤트), 상한 경계 504회.
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 2개 이상 네가 고른 곳(Build BM1–BM3 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8c2b/bak/`).
6. headless 하지 않는다.

## 판정 기준 (기준선 = 8c-2 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 중간-1 남음, 8c-2b 가 새로 만든 요청·사용량 행·경고 횟수 변화, 콘솔·처리 안 된 거절.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 서버 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8c2b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
