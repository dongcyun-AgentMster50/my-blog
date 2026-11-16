# Review 지침 — 11-1b 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "11-1b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r11-1b/`(`r11-1/`·`b11-1b/` 는 읽기만 — `trunc.mjs`·`chk.mjs`·`rdiff.mjs` 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
review.md "11-1 Review", 지침 `.claude/tasks/medreader-build-11-1b-fix.md`, 보고서 `.claude/tasks/medreader-build-11-1b-fix-report.md`(믿지 말고 다시 재라), spec 17-2-1 4-1 `[정정 2026-11-17 — 11-1b]`, `git diff` 중 11-1b 몫(`accept()` 의 `tailOf` 갈래·`SUMMARY_JOB.tailOf`·`scanCut`·`OUTLINE_JOB.tailOf`·`cutWhole`·`normTree` 상한·`styleSentence`).

## 확인할 것
1. **중간 2건 닫힘**: 네가 새로 만든 잘림 꼴(문자열 안 이스케이프 `\"` 직후·유니코드 서로게이트 가운데·숫자 안·`terms` 배열 안·`i` 키 안·키 순서가 바뀐 항목·여러 문단 중 가운데 문단 직후)에서 반쪽 요약이 `ready`·캐시되지 않고, 온전한 앞 문단은 살아남는가. 숫자 쪼갬: `1500`·`1,500`·`1.5`·`٫`·`٬`·아랍-인도 숫자가 600·80·200자 경계에 걸릴 때.
2. **새 고침 부작용**: `scanCut` 이 잘리지 않은 정상 응답(finishReason STOP)에서 항목을 버리지 않는가(무작위 정상 응답 수천 개 — 0 이어야 함). `cutWhole` 이 숫자가 없는 글·RTL 글·이모지에서 길이 상한을 지키는가(상한 넘지 않음).
3. **번역·단어 경로 불변**: `rdiff.mjs` HEAD 대조 `allSame:true`, 잘린 번역 응답(MAX_TOKENS)의 결과·캐시가 11-1 판·HEAD 와 같음.
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 2개 이상 네가 고른 곳(Build M1–M8 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r11-1b/bak/`).
6. headless 하지 않는다.

## 판정 기준 (기준선 = 11-1 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 중간 2건 중 하나라도 남음, 정상 응답에서 항목을 버림, 길이 상한 깨짐, 번역·단어 경로 변화.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r11-1b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
