# Review 지침 — 8g-4b-R1: 검색 화면 탭 키보드 (배포 직전)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 짧은 **"8g-4b-R1 Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 바로 **배포**한다 — 배포 판정까지.

## 읽을 것
지침 `.claude/tasks/medreader-build-8g-4b-r1.md`, Build 보고 `.claude/tasks/medreader-build-8g-4b-r1-report.md`, review.md "8g-4b Review"(R1). 변경: `git diff`(search.js +41 · index.html stamp) + 새 `tests/search-tabs-8g4br1.test.mjs`. 직전 커밋 `2ce489e`.

## 확인할 것
1. 변경 범위가 지침대로인지(`git diff --stat`), `tabKeyTarget` 이 ARIA tabs 권고와 맞는지(←/→ 시각 방향 · RTL 뒤집힘 · Home/End · 끝에서 넘어감 · 수식 키 무시 · 탭 아닌 키 -1), `onTabsKey` 가 목차 탭을 못 쓰는 범위(서재 범위 등)에서 아무것도 안 하는지, `preventDefault` 가 처리하는 키에만 걸리는지(입력 칸·목차 항목에서 화살표·Home/End 가 먹지 않게 되는 부작용 없음 — **직접 확인**).
2. **headless 로 직접**(Edge · 412×915 · ko·ar): Tab 으로 탭 목록 → 화살표로 목차 → 다시 찾기, 터치·클릭 그대로, 입력 칸 안에서 ←/→/Home/End 가 커서를 움직이는지(탭이 바뀌면 안 됨), 8i-3 쪽 넘김 낭독 한 번.
3. Build 남은 문제 1(목차 탭으로 옮기면 "지금 항목으로 굴림" 때문에 초점 간 탭이 화면 위로 벗어남 — 클릭도 같음) 심각도와 배포 전/다음 판정.
4. 네 변이 1개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `r8g4br1/bak/`.
5. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1234 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음.
6. **배포 판정**: 로컬 커밋 15개 + 이번 변경을 배포해도 되는지.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 8000번 python(PID 15088)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. 브라우저 프로필은 새로 만든 것 1개. 진짜 API 키 금지. PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 만. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g4br1/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제.
