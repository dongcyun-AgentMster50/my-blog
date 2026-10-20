# Build 지침 — 8g-4a-fix: 숨은 리더 쪽 넘김 뒤 "떠난 쪽 결과"로 가면 다음 쪽이 열리는 문제(F1)

> 너는 **Build 서브에이전트**다. 8g-4a Review(review.md 끝 "8g-4a Review", 8g4aR-1~11)가 조건부 통과했고 운영자가 F1 을 **4b 전에 작은 수정으로** 고치기로 했다(2026-10-20). 8g-4a 는 커밋됨(`68a6c2e`, 미푸시).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-4a-fix-report.md`.

## 문제 (Review 가 headless 로 재현)
낭독 중 [🔍] 로 검색 화면을 연다 → 검색 화면 뒤(숨은 리더)에서 낭독이 61쪽 → 62쪽으로 넘어간다 → 결과 목록에서 **떠났던 61쪽의 결과**를 누른다 → **62쪽이 열린다**(해시 62, 강조 0, 안내 0, 띠만 떠 있음).
원인(Review): `js/ui/reader.js` `showReader` 의 숨은 리더 조건 `hiddenTurn && wanted === softFromPage` 가 **"뒤로 돌아옴"**(이때는 낭독이 간 쪽으로 replace 하는 것이 의도 — Build 8g-4a 의 spec 문안 2번)과 **"결과로 이동"**을 구별하지 못한다.
고칠 안(Review): 결과로 이동하기 전에 리더가 `hiddenTurn` 을 내리게 하고, 이 판정을 **순수 함수로 꺼내 테스트로 묶는다**.

## 할 일
1. F1 수정(위 안 또는 같은 효과의 더 단순한 방법 — 이유를 보고서에). "뒤로 돌아옴"의 지금 동작(낭독이 간 쪽으로 replace)은 **바꾸지 않는다**.
2. 판정을 순수 함수로(예: 숨은 리더에서 어느 쪽을 보일지 — 입력: 들어온 경로 종류·원하는 쪽·숨은 동안 넘어간 쪽) 꺼내고 표 테스트.
3. Review 의 살아남은 변이 **X1**(결과 처리의 쪽 번호 확인)·**X8**(숨은 리더 조건)·**X9**(숨은 리더 같은 쪽 판정)를 잡는 테스트(배선이 테스트에 묶이도록). Review 변이 정의: 스크래치패드 `r8g4a/mut.mjs`·`mut.log`.
4. stamp 다시, `--check` 0.

## 검증
- 고친 부분을 되돌리는 변이 + X1·X8·X9 → 모두 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g4af/bak/`.
- **headless 로 F1 재현 절차를 다시**(Review 스크립트 스크래치패드 `r8g4a/` 참고 — 판정 코드는 네가): 고친 뒤 61쪽 결과 → 61쪽·강조·띠 정상. 그리고 **뒤로 돌아옴** 경로는 지금처럼 낭독이 간 쪽. 8i-3 쪽 넘김 낭독(같은 문장 연달아 0) 한 번 회귀 확인.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1184 + 새).
- 8000번 서버(`python -m http.server 8000 --bind 127.0.0.1`, Review 가 띄운 PID 15088)가 있으면 쓰고 끄지 마라, 없으면 레포 루트에서 띄우고 켜 둔다. 8123·8124번 node 는 건드리지 마라. 브라우저 프로필은 새로 만든 것 1개. 진짜 API 키 금지(가짜 키·흉내 응답은 스크래치패드 `shot-tool/step2.mjs`).
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`js/ui/reader.js`(F1·순수 함수), 필요하면 `js/ui/search.js`(이동 전 신호 — 최소), `tests/`(새·보강), `index.html`(stamp 로만), 스크래치패드 `b8g4af/`, 보고서. 그 밖(F2·F3·①③ 등 4b 몫)은 건드리지 않는다. spec·review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 원서 문장 40자 초과 인용. PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 만.
