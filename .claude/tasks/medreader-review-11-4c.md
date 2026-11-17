# Review 지침 — 11-4c 재검증 (아주 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "11-4c 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r11-4c/`(`r11-4b/`·`b11-4c/` 는 읽기만 — `run-v.mjs` 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
review.md "11-4b 재검증", 지침 `.claude/tasks/medreader-build-11-4c-fix.md`, 보고서 `.claude/tasks/medreader-build-11-4c-fix-report.md`, `git diff` 중 11-4c 몫(`dropNoteBanner`·`leave()`·controls `onPageRender` 한 줄·`ask.js` `{docId, page}` 비교·X13).

## 확인할 것
1. 중간-1 닫힘: 서재·쪽 넘김·다른 문서·뒤로 가기·검색 화면 갔다 옴(보고서 남은 1 — 같은 문서·같은 쪽이라 다시 시도가 맞는지 판단) → 엉뚱한 문맥 요청 0. 같은 문맥 [다시 시도] 1호출·이어 읽기.
2. 부작용: 같은 쪽 다시 그리기(새 판·뷰 전환·글자 크기)에서 배너가 거둬지는 것이 사용자에게 문제인지, 다른 배너(429·capped·80%)는 거둬지지 않는지.
3. 회귀: 요청 본문 HEAD 와 같음, 9b 말뭉치, 8c-1 탭 띠·Esc 층.
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 1개 이상 네가 고른 곳 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r11-4c/bak/`).
6. headless 한 번(Edge, pipe, 새 프로필, 가짜 키, 흉내 Gemini·음성, 캐시 끔, 서버 띄우기 금지). 콘솔 오류 0.

## 판정 기준 (기준선 = 11-4b 재검증 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 엉뚱한 문맥 요청이 남음, 다른 배너를 거둠, 11-4c 가 새로 만든 회귀, 콘솔 오류.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r11-4c/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
