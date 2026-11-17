# Review 지침 — 12-1d 재검증 (아주 짧게, 마지막)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "12-1d 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r12-1d/`(`r12-1c/`·`b12-1d/` 는 읽기만 — 시뮬레이션 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
review.md "12-1c 재검증", 지침 `.claude/tasks/medreader-build-12-1d-fix.md`, 보고서 `.claude/tasks/medreader-build-12-1d-fix-report.md`(7절 덧붙임 포함), spec 17-4-1 `[정정 2026-11-17 — 12-1d]`, `git diff` 중 `mergeSentence` 같은 시각 큰 글자 규칙·C11·C11c·`backup-9c.test.mjs` K10h 기대 변경(오케스트레이터 승인 — 새 규칙을 따라감).

## 확인할 것
1. 수렴: 세 기기·네 기기 무작위(네가 새로 짠 씨앗) 갈라짐 0, 두 기기 전수 결과가 12-1c 와 같음(지움 0·고친 쪽 잃음 0), 멱등·교환·결합.
2. 큰 글자 규칙이 시각·꼴이 다를 때 끼지 않는가, `updatedAt` 을 올리지 않는가, 복습·멈춤 묶음·term 병합 무변.
3. K10h 기대 변경이 새 규칙과 맞는가(다른 단정이 약해지지 않았는가).
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 1개 이상 네가 고른 곳 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r12-1d/bak/`). headless 하지 않는다.

## 판정 기준 (기준선 = 12-1c 재검증 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 갈라짐 남음, 지움·고친 쪽 잃음이 새로 생김, 멱등 깨짐, 12-1d 가 새로 만든 회귀.
- 그 밖은 **낮음** → "배포 가능". (옛 레코드 `createdAt` 차이·둘 다 빈 값끼리 공백 차이는 Build 가 밝힌 기록 — 낮음/정보.)
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r12-1d/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
