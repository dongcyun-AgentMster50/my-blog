# Review 지침 — 8f-4b 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8f-4b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8f4b/`(`r8f4/`·`b8f4b/` 는 읽기만 — 하네스·`srv/head`·합성 PDF 재사용 가능).

## 볼 것
review.md "8f-4 Review", 지침 `.claude/tasks/medreader-build-8f4b-fix.md`, 보고서 `.claude/tasks/medreader-build-8f4b-fix-report.md`(믿지 말고 다시 재라), spec 17-8-9 `[정정 2026-11-16 — 8f-4b]`, `git diff`(8f-4 + 8f-4b 함께 미커밋 — 8f-4b 몫은 `vocabFallback`·`nm.orig`·`vocabSettle`·안내 미루기 범위·U10 제목).

## 확인할 것
1. 중간-1 닫힘: 바꾼 원어 0건(이 책에 없는 낱말·바꾼 검색 실패·다른 책 낱말) → 원래 검색어 안내 DOM 이 HEAD 와 같음. 바꿈 성공은 그대로.
2. 새 고침 부작용: `nm.orig` 를 쥔 모형이 최근 검색어·띠·뒤로 가기·다시 검색에서 원래 검색어/원어를 섞지 않는가. `vocabSettle` 다섯 값이 모든 경로를 덮는가(읽기 중 화면 떠남·다른 책·검색어 지움·읽기 실패·사전 묶음 늦게 생김). 안내가 먼저 보였다 바꿈 성공으로 사라질 때 낭독기 알림(`aria-live`)이 두 번 엉뚱하게 읽히지 않는가.
3. 회귀: HEAD 대조 32 상태(+3) — 너도 새 상태 몇 개를 더해(검색어 바꿈 직후 엔터 두 번, 바꿈 성공 뒤 같은 검색어 다시) 대조.
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 2개 이상 네가 고른 곳(Build V1–V5 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8f4b/bak/`).
6. headless 한 번(Edge 412×915 ar, 새 프로필 `r8f4b/p1`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, 작은 합성 PDF 만). **서버를 새로 띄우지 마라** — 8000 출처는 요청 가로채기로 스크래치에서 내준다(Build 와 같은 방식). 콘솔 오류 0.

## 판정 기준 (기준선 = 8f-4 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 중간-1 남음, 8f-4b 가 새로 만든 검색 결과·안내·최근 검색어의 HEAD 대비 변화, 낡은 결과 그려짐, 호출, 콘솔 오류.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8f4b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
