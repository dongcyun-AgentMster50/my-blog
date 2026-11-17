# Review 지침 — 13-2 계획 화면 (+ 13-1 · 13-1R 고침, 함께 배포 전)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "13-2 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r13-2/`(Build 의 `b13-2/`·`b13-1/`·`r13-1/` 은 읽기만 — `chk.mjs`·하네스 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-12 전부(+ `[정정 2026-11-17 — 13-1 Build]`·`13-2 Build`), review.md "13-1 Review"(중간-1·낮음 2–7), 지침 `.claude/tasks/medreader-build-13-2-planner-ui.md`(앞부분 "먼저 고칠 것" 포함), 보고서 `.claude/tasks/medreader-build-13-2-planner-ui-report.md`(믿지 말고 다시 재라), `git diff`(13-1 + 13-2 함께 미커밋) + 새 파일(`js/plan/*`·`js/ui/planner.js`·시험들).

## 확인할 것
1. **13-1R 닫힘**: `r13-1/chk.mjs` 를 다시 — 긴 문장 3조각 글자 = 실제, 속도 바꿈·자정 걸침 나눔, 같은 쪽 `pagedone` 한 번. 새 부작용: `unitKey`(문서·쪽·첫 줄·src)가 같은 줄 두 문장·줄 탭 되돌아가 다시 읽기·반복 모드에서 바르게 세는가(보고서 남은 4 "같은 첫 줄·같은 글자 두 문장" 판단).
2. **낭독 회귀**: `speaker.js`·`controls.js` 는 13-1 판에서 무변이라 했다 — HEAD(배포된 12-3) 대비 13-1 이 더한 배선이 낭독을 바꾸지 않는가(13-1 Review 의 회귀 하네스 다시).
3. **계획 화면**: 결과 카드 숫자 = `planFor`(화면 글자에서 읽어 — 네가 새로 짠 시험 둘·셋), 쉬는 요일·하루 분·장/쪽 범위(장 끝 규칙 정정 — `tocOf` 깊이), `tight`/`past`/`done`/`overCap`(설정 무변), 진도(읽음/안 읽음/정확히 세기 — POST 0), `fileHash` 로 찾기(9c 로 다른 id 기기), 고지 문구(금지 문구 grep 0 — "점수"·"합격"·"score"·"pass"·"predict" 류 4언어).
4. **서재 "오늘" 줄**: 이제 늘 보임(12-3 에서 바뀐 동작) — 12-3 수용 기준("카드 0장이면 줄 없음")과 13-D14 중 무엇이 맞는지 판단, aria 이름 빈 글(남은 6).
5. **데이터·9c**: `planner.exams` 저장·편집·삭제(페이지 안 확인), 9c 내보내기/가져오기 `planner.exams`·`reading.log`·`@read`·`reading.track` 멱등.
6. **성능**: 계획 화면을 열 때 범위 책 `searchText` 전체 훑기(CMDT 약 10MB — 보고서 남은 3) — 큰 합성 또는 CMDT 2026(읽기만)으로 시간 재기, 1초 넘으면 보고.
7. **화면**: 3크기 × 4언어, 날짜 칸·요일 칩 RTL, 48px, 넘침 0, `innerHTML` 0(시험 이름에 `<img onerror>`).
8. 회귀: 12-3 복습 화면·"오늘" 줄 카드 셈, 11-3 요약 화면·라우터, 8c-2 사용량·설정, 요청 본문 바이트 HEAD 와 같음, AI 요청 0.
9. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0, `router.test.mjs` NUL 바이트 편집(바뀐 곳 바이트 비교).
10. 변이 3개 이상 네가 고른 곳(Build M1–M11 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r13-2/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
11. headless: Edge, pipe, 새 프로필 `r13-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성(14자/초 + 가짜 시계), 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF(의학책은 성능 측정에만 — 읽기만, Downloads 목록 보지 말 것). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 13-1R 중간-1 남음·새로 세기 틀림, 낭독 회귀, 화면 숫자 ≠ `planFor`, 설정을 바꿈, 금지 문구, 데이터 손실·멱등 깨짐, AI 요청이 생김, 화면 여는 데 수 초 멈춤(실기기 수준), XSS, 콘솔 오류, 테스트 파일 손상.
- **낮음**(→ "배포 가능"): 문안·배치·실기기 확인 거리·보고서 "남은 문제" 꼴.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 원서 글은 옮기지 말 것(숫자만). 수정 범위: `review.md` 끝 절, 스크래치패드 `r13-2/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
