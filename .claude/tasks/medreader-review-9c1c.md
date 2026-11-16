# Review 지침 — 9c-1c 재검증 (아주 짧게, 마지막)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "9c-1c 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r9c1c/`(`r9c1b/`·`b9c1c/` 는 읽기만 — `probe.mjs`·`corpus.mjs` 재사용).

## 볼 것
review.md "9c-1b 재검증", 지침 `.claude/tasks/medreader-build-9c1c-fix.md`, 보고서 `.claude/tasks/medreader-build-9c1c-fix-report.md`, `git diff` 의 `js/config.js` `BACKUP.KEY_PATTERNS`·`tests/backup-9c.test.mjs` K4b.

## 확인할 것
1. 중간-1 닫힘: `%XX`·글자 그대로 이스케이프 뒤 진짜 길이 `sk-` 키 → 지움. Bearer 새 조건(숫자 든 12자+ 또는 20자+, 대소문자, `%20`·`:`).
2. **알려진 남은 것(받아들임)**: 영숫자·하이픈에 바로 붙은 `…sk-` 꼴은 합성어와 구별 불가 — 판정에서 중간으로 세지 않는다(낮음 기록). 근거: 키는 설정·DB 에 저장되지 않으므로(키는 `sessionStorage`/`localStorage` — 백업이 읽지 않음) 이 지우개는 사용자가 글자로 붙여 넣은 키에 대한 두 번째 방어선이다.
3. 새 조건이 만든 **정상 글 오탐**: Bearer 대소문자 무시·`:` 갈래가 의학·일반 글("pallbearer", "Bearer: …", "bearer-dependent")에서 지우는 것이 있는가 — 지어낸 글 20개 이상 + CMDT 덤프 걸림 수(원문 옮기지 말 것).
4. `REDACT_PATTERNS`·`js/privacy/` 무변, 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 1개 이상 네가 고른 곳 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r9c1c/bak/`). headless 하지 않는다.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 중간-1 남음(이스케이프·`%XX` 뒤 키), 새 조건이 정상 의학 글을 흔히(CMDT 에서 걸림 > 0) 지움, `REDACT_PATTERNS` 변화.
- 그 밖(위 2 포함)은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r9c1c/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
