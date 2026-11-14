# Review 지침 — 다듬기 3 (팝오버 가림 · M1 사유 구분)

> 너는 **Review 서브에이전트**다(다듬기 3 Build 와 다른 새 에이전트). 직접 확인한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"다듬기 3 Review"** 절로 덧붙인다(앞 절은 고치지 않는다). **배포 판정**까지.

## 읽을 것
지침 `.claude/tasks/medreader-build-polish3.md`, Build 보고 `.claude/tasks/medreader-build-polish3-report.md`, review.md "다듬기 2 Review"(팝오버 실측 표·중1·하1~하4). 변경: `git diff`(기준 `6786cee`). Build 스크래치 `bp3/`(읽기만 — 네 시험은 `rp3/`).

## 확인할 것
1. **팝오버**: 412×915 band·inline × ko·ar·en·fr 에서 처음 열었을 때 "번역 위치" 가림 0·스크롤 0, 속도 단추 한 줄·높이 ≥ 48px·글자 잘림 없음, 설정 AI 탭. 360×740 숫자. **운영자 결정 재료**: Build 는 최소 폭 52px 만으로는 한 줄이 안 돼(합 366.7 > 안 폭 362) 같은 규칙에서 안 여백·사이를 8→4px 로 함께 줄였다(남는 폭 30px). 대안 "여백만 4px(남는 10)"·"사이만 4px(남는 15)". 큰 글자 설정·안드로이드 글꼴 확대(예: 글자 크기 115–130% 흉내 — `font-size` 를 키워서)에서 각 안이 한 줄로 남는지 재고 권장을 적어라. 단추 사이 4px 에서 잘못 누를 위험(터치 목표 간격) 의견.
2. **M1 사유 구분**: 오프라인 → 연결 → 한도(429) 에서 지금 문장 아래 `exhausted` 줄 하나, 같은 사유는 쌓이지 않음, I4 위반 0. 같은 쪽에서 사유가 여러 번 바뀌는 경우(오프라인 → 한도 → 오프라인)도.
3. **무변**: 띠 모드(기본) 본문 DOM·`--reader-chrome-bottom`·낭독 큐, 번역 요청 본문·캐시 키(의학책 한 권 × ar, 몇 쪽).
4. **범위 밖 관찰 확인(Build 남은 문제 5)**: fr UI 에서 쪽 이동 줄·"Back"·하단 고지가 영어로 나온다는 것 — 진짜 번역 누락인지(i18n 키), 시험 순서 탓인지 원인만 밝혀라(고치지 마라). 배포본에도 있는 문제면 심각도를 적어라.
5. 변이 2개 이상(Build P1–P6 와 다른 것) → 복원 **읽어서 쓰기 + `cmp`**, 백업 `rp3/bak/`.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1391), `stamp --check` 0, `git diff --check`, `.nojekyll`. **배포 판정.**

## 규칙
**명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로 바로. 흉내 Gemini 는 OPTIONS 사전 요청 처리. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 포트 9411·9431·9451 과 프로필 `bp2/p1`·`rp2/p1`·`bp3/p1` 은 쓰지 마라 — 새 포트·새 프로필 `rp3/p1`. 8000번 python 은 떠 있다 — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 앱·테스트·spec 은 고치지 않는다(변이는 되돌린다). 스크래치패드는 `rp3/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`.
