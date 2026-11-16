# Review 지침 — 8c-1c 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8c-1c 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8c1c/`(`r8c1b/`·`b8c1c/` 는 읽기만 — 하네스·`small.pdf` 재사용 가능).

## 볼 것
review.md "8c-1b 재검증", 지침 `.claude/tasks/medreader-build-8c1c-fix.md`, 보고서 `.claude/tasks/medreader-build-8c1c-fix-report.md`(믿지 말고 다시 재라), spec 17-7-6 `[정정 2026-11-16 — 8c-1c]`, `git diff` 중 8c-1c 몫(`createTapTracker.release`·문서 pointerup 배선·`leaveReader` 띠 닫기·`bandShown`·`escClosesTap` editing/shown·`onPageRepaint(trband.sync)`·대기 칸 비우기·`focusLine` reveal·`liftEdge`).

## 확인할 것
1. **중간 3건 닫힘**: 마우스·펜 본문 밖 뗌 → 손가락 탭 열림, 검색 화면 진입 시 띠 닫힘·Esc 가 검색어 지움, 쪽 번호 입력 중 Esc 가 쪽을 넘기지 않음. 세로 412 ko·가로 915 ar.
2. **새 고침의 부작용**: 문서 pointerup "떼어짐 표시" 방식이 진짜 동시 터치(두 손가락·엄지 대고 탭·핀치)를 여전히 막는가. 마우스 누른 채 손가락 탭. `onPageRepaint(trband.sync)` 가 보이기/끔/문장 아래 표시 모드에서 띠를 엉뚱하게 보이거나 숨기지 않는가(검색 갔다 돌아오기·원본 보기 갔다 오기·쪽 넘김·새로고침). Esc 가 다른 입력칸(검색어·설정 키 입력·단어 입력 등)과 dialog 에서 기본 동작 그대로인가. 낮음-5 의 "키보드로 닫을 때만 굴림" 판단이 맞는가(낭독 중 키보드 닫기도 한 번).
3. 회귀: 요청 본문 바이트 HEAD 와 같음, 8c-1b 재검증 "확인된 것"(손가락 수·동시 1·연결 회복·Esc 층 순서·포커스 표시), 7-7·8d·8e·9a·9b 기본.
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 3개 이상 네가 고른 곳(Build M1–M6 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8c1c/bak/`). headless 변이 땐 `setCacheEnabled(false)`.

## 판정 기준 (기준선 = 8c-1b 재검증 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 8c-1b 재검증의 중간 3건 중 하나라도 남음, 8c-1c 가 **새로** 만든 회귀(띠 보임/숨김 틀림·두 손가락이 다시 열림·한 손가락 탭이 안 열림·Esc 가 다른 입력칸 기본 동작을 막음), 콘솔 오류.
- 그 밖(8c-1b 이전부터 있던 것·실기기 확인 거리·정보)은 **낮음** → "배포 가능", 다듬기 후보로.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프로 묶지 말 것). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout, 긴 실행은 `timeout 560`. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 큰 원서로 검색 화면에 들어가지 말 것(작은 PDF 로). 수정 범위: `review.md` 끝 절, 스크래치패드 `r8c1c/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
