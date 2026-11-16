# Review 지침 — 8c-1b 재검증 (고친 곳만)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8c-1b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8c1b/`(`r8c1/`·`b8c1b/` 는 읽기만 — 진짜 터치 하네스 재사용 가능).

## 볼 것
review.md "8c-1 Review"(8c1R-1~10), 지침 `.claude/tasks/medreader-build-8c1b-fix.md`, 보고서 `.claude/tasks/medreader-build-8c1b-fix-report.md`(믿지 말고 다시 재라), spec 17-7-6 `[정정 2026-11-16 — 8c-1b]`, `git diff`(8c-1 + 8c-1b 가 함께 미커밋 — 8c-1b 몫은 `createTapTracker`·탭 요청 동시 1·연결 회복·Esc/포커스·`tapPlan`·`selBarStep`·`selbar.top()` 굴리기).

## 확인할 것
1. **여러 손가락**(진짜 터치 CDP): 두 손가락 정지 탭·엄지 대고 탭·세 손가락·두 손가락 핀치(확대 흉내)·한 손가락 끝난 직후 다른 한 손가락 탭(겹치지 않음 — 탭이어야 함)·같은 `pointerId` 재사용·`pointercancel` 뒤 탭. 한 손가락 보통 탭과 길게 누르기 판정이 8c-1 과 같은가(회귀). 마우스·펜(`pointerType`) 탭도 그대로인가.
2. **동시 1·대기 1**: 대기 탭을 버리는 규칙이 "띠는 마지막 탭" 과 맞는가 — 띠 내용이 마지막 탭 문단인지, 버린 탭이 나중에 띠를 덮어쓰지 않는지(응답 순서 뒤바꿈 흉내). `[×]` 로 닫은 뒤 대기 요청이 보내지는 것(보고서 한계)이 띠를 다시 여는지.
3. **연결 회복**: offline→online 한 번만, 띠가 닫힌 뒤 online 이면 보내지 않는지(보내면 낮음 — 호출 1).
4. **Esc·포커스**: 위 층(팝오버·음성 카드·dialog·`[≡]`·8f 이후 시트 자리)과의 순서, 입력칸(검색어 등)에 포커스가 있을 때 Esc 가 엉뚱한 것을 닫지 않는지, 포커스가 돌아간 줄이 화면에 보이는지(스크롤), 낭독기용 포커스 표시.
5. 회귀: 요청 본문 바이트 HEAD 와 같음, 8c-1 수용 시험(하네스 재사용), 7-7 띠·8d·8e·9a·9b·원본 보기 기본 동작.
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 3개 이상 네가 고른 곳(Build M1–M5 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8c1b/bak/`). headless 변이 땐 `setCacheEnabled(false)`.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 8c-1 대비 회귀, 탭이 아닌 손짓이 번역·이동을 부름, 한 손가락 탭이 탭으로 안 셈, 띠에 마지막 탭이 아닌 문단, 닫은 띠가 저절로 다시 열림, Esc 가 엉뚱한 층을 닫음, 콘솔 오류.
- 그 밖은 **낮음**(→ "배포 가능", 다듬기 후보로).
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(파이프·`&&` 로 묶지 말 것). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책 읽기만(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`), Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8c1b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
