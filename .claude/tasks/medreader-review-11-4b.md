# Review 지침 — 11-4b 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "11-4b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r11-4b/`(`r11-4/`·`b11-4b/` 는 읽기만 — 하네스 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
review.md "11-4 Review", 지침 `.claude/tasks/medreader-build-11-4b-fix.md`, 보고서 `.claude/tasks/medreader-build-11-4b-fix-report.md`(믿지 말고 다시 재라), spec 17-2-1 4-7 `[정정 2026-11-17 — 11-4b]`, `git diff` 중 11-4b 몫(`ask.js` 배너·`was` 이어받기, `trband.js` `noteFailBanner`·`noteBanner`, `controls.js` `liftLineAbove`, 시험 X5·X9–X12).

## 확인할 것
1. 중간-1 닫힘: 낭독 중 단추 설명 실패(PARSE·DIGITS·MISSING·SAFETY·EMPTY 각각) → 배너 보임·`aria-live`·[다시 시도] 1호출·그 문장·끝나면 이어 읽기·배너 사라짐. 배너가 **여러 장 쌓이지 않음**(연속 실패), 다른 배너(429·capped·8c-2 80% 경고·사용량)와 겹칠 때, 화면 떠남·쪽 넘김 뒤 [다시 시도]가 엉뚱한 문서·쪽을 부르지 않음.
2. `was` 이어받기: A 진행 중 B, A 띠 닫힌 뒤 B, 음성 갈래와 섞임 — 소리 겹침 0·이어 읽기 한 번.
3. 줄 올리기: 화면 아래쪽 줄 [설명] → 덮임 0, 낭독 자동 스크롤과 다투지 않음.
4. 회귀: 요청 본문 HEAD 와 같음, 9b 말뭉치 변화 0, 8c-1 탭 띠·Esc 층·18·9a·8e.
5. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
6. 변이 2개 이상 네가 고른 곳(Build 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r11-4b/bak/`).
7. headless: Edge, pipe, 새 프로필 `r11-4b/p*`, 가짜 키, 흉내 Gemini·음성, 캐시 끔, 한 번에 하나, 서버 띄우기 금지. 콘솔 오류 0.

## 판정 기준 (기준선 = 11-4 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 중간-1 남음, 배너가 쌓이거나 엉뚱한 곳을 다시 부름, 소리 겹침·재개 두 번, 11-4b 가 새로 만든 회귀, 콘솔 오류.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r11-4b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
