# Review 지침 — 9b 다듬기 (Rb · 낱말 손질 · 가로 고지 카드)

> 너는 **Review 서브에이전트**다(9b 다듬기 Build 와 다른 새 에이전트). 직접 확인한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"9b 다듬기 Review"** 절로 덧붙인다(앞 절은 고치지 않는다, 짧게). **배포 판정**까지. 운영자 위임(2026-11-15): 권장안으로 끝까지 진행 — 판정에 필요한 결정이 있으면 권장안을 적어라.

## 읽을 것
지침 `.claude/tasks/medreader-build-9b3-polish.md`, Build 보고 `.claude/tasks/medreader-build-9b3-polish-report.md`, review.md "9b-2 Review"(9b2R-1~10). 변경: `git diff`(기준 `89755f0`). Review 말뭉치·가정 시험 `r9b1/`·`r9b2/`(읽기만 — 네 시험은 `r9b3/`).

## 확인할 것
1. **Rb**: Review 가정 시험(`r9b2/whatif-neg.mjs`)과 같은 결과인지 네 스크립트로 — 명령 놓침 16 그대로, 부정문 반대 20 → 4. 새 발화 30개 이상(Build·이전 Review 가 쓰지 않은 것)으로 오탐·혼동·부정문 반대 수.
2. 낱말 손질("slow"·«بطيء» exact, «بلاش», «أوقف», "stop/turn off the translation")이 다른 명령을 빼앗지 않는지.
3. 가로 915×412 고지 카드 겹침 0(ko·ar·en·fr), 412×915 무변, 빈 따옴표 없음, U12·U13 이 진짜로 지키는지.
4. 기존 동작 무변(듣지 않을 때 [▶]·9a·띠·8d), AI 호출 0, 콘솔 오류 0.
5. 너만의 변이 2개 이상 → 복원 **읽어서 쓰기 + `cmp`**, 백업 `r9b3/bak/`.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1460), `stamp --check` 0, `git diff --check`, `.nojekyll`. **배포 판정.**

## 규칙
**명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로. 오래 걸리는 명령은 시간 상한을 넉넉히 주고 백그라운드로 넘기지 마라. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 이전에 쓴 포트·프로필 쓰지 마라 — 새 프로필 `r9b3/p1`. 8000번 python 은 떠 있다 — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. 앱·테스트·spec 은 고치지 않는다(변이는 되돌린다). 스크래치패드는 `r9b3/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
