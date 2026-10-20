# Build 지침 — 8g-4b-R1: 키보드로 목차 탭에 갈 수 없는 문제 (배포 전 마지막)

> 너는 **Build 서브에이전트**다. 8g-4b Review(review.md 끝 "8g-4b Review", 8g4bR-1–12)가 통과·"배포해도 된다"였고, 운영자가 **R1 을 배포 전에 고친 뒤 푸시**하기로 했다(2026-10-20). 8g-4b 는 커밋됨(`2ce489e`, 미푸시).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-4b-r1-report.md`.

## 문제 (Review R1, 중간·접근성)
검색 화면의 탭(찾기 · 목차)에서 안 고른 탭이 `tabindex=-1` 인데 **화살표 키 처리가 없다**. 그래서 Tab 순서에 목차 탭이 한 번도 나오지 않고, → 를 눌러도 그대로다(Review 기록: 스크래치패드 `r8g4b/rv-kbd.json`). 터치·TalkBack 은 된다.

## 할 일 (최소 수정)
1. `js/ui/search.js` 의 탭 목록에 **ARIA tabs 키보드 패턴**: ←/→(아랍어 RTL 에서는 **방향이 뒤집힘** — 시각적으로 왼쪽 키가 시각적 왼쪽 탭으로), Home/End, 포커스 이동과 함께 탭 선택(자동 선택 방식). 고른 탭만 `tabindex=0` 은 그대로. `role="tablist"`·`role="tab"`·`aria-selected`·`aria-controls` 가 이미 맞는지 확인하고 모자라면 채운다.
2. 테스트: 탭 키 처리(→·←·Home·End, RTL 뒤집힘, 끝에서 넘어가기 규칙)를 순수 함수로 꺼내 표 테스트 + 배선 확인.
3. stamp 다시, `--check` 0.

## 검증
- 고친 부분을 되돌리는 변이 → 새 테스트 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8g4br1/bak/`.
- **headless 로 직접**(Edge · 412×915 · ko 와 ar): Tab 으로 탭 목록에 들어가 → / ← 로 목차 탭으로 옮겨 목차가 보이는지, 다시 찾기로. 터치(클릭) 동작 그대로. 8i-3 쪽 넘김 낭독 한 번 회귀(같은 문장 연달아 0).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1228 + 새).
- 8000번 python(PID 15088)은 쓰고 끄지 마라(없으면 레포 루트에서 띄우고 켜 둠). 8123·8124·8125번 node 는 건드리지 마라. 브라우저 프로필은 새로 만든 것 1개. 진짜 API 키 금지. PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 만.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`js/ui/search.js`(탭 키보드 처리만), 필요하면 `index.html`(탭 마크업 ARIA 속성만 — stamp 포함), `tests/`(새·보강), 스크래치패드 `b8g4br1/`, 보고서. 그 밖(R2–R5 등)은 건드리지 않는다. spec·review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제.
