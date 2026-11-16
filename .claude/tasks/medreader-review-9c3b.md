# Review 지침 — 9c-3b 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "9c-3b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r9c3b/`(`r9c3/`·`b9c3b/` 는 읽기만 — 스크립트 재사용).

## 볼 것
review.md "9c-3 Review", 지침 `.claude/tasks/medreader-build-9c3b-fix.md`, 보고서 `.claude/tasks/medreader-build-9c3b-fix-report.md`(믿지 말고 다시 재라), spec 17-4-1 `[정정 2026-11-17 — 9c-3b]`, `git diff` 중 9c-3b 몫(`docTimesFor`·`cleanRecord`·리더·퀴즈 `from` 위치·N5·I18).

## 확인할 것
1. 중간-1 닫힘: 미래 시각 문서 — 같은 id·같은 fileHash 두 갈래 모두, 다른 now 로 2·3번 = 한 번, 그사이 기기 진도 앞섬 → 유지, 새 문서는 지금으로 자름. **새 부작용**: 미래 시각 파일이면 `lastPage`·`lastLineId` 를 빼는데, 기기 쪽이 **진짜로 더 옛** 진도(기기 시계가 뒤처진 경우·파일이 정당하게 더 앞섬)일 때 파일 진도를 영영 못 받는가 — 설계 문구(단어장 8f-3b 와 같은 결)와 맞는지 판단(데이터를 잃는 게 아니라 기기 값 유지라 낮음일 수 있음).
2. 리더·퀴즈 `from` — 경합 시 머묾, 경합 없을 때 서재 그 카드 초점, 뒤로 가기.
3. 회귀: 9c-2·9c-3 시험·두 프로필 종단 요약(`r9c3/run-e2e.mjs` 재사용 — 번역 POST 0), 번역 요청 본문 바이트 HEAD 와 같음.
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 오류 0(quiz CRLF 경고만).
5. 변이 2개 이상 네가 고른 곳(Build M1–M4 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r9c3b/bak/`).
6. headless 한 번(새 프로필, pipe, 가짜 키, 흉내 Gemini, 캐시 끔, 서버 띄우기 금지). 콘솔 오류 0.

## 판정 기준 (기준선 = 9c-3 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 중간-1 남음, 9c-3b 가 새로 만든 데이터 손실·멱등 깨짐·회귀·콘솔 오류.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r9c3b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
