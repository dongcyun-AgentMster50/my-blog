# Review 지침 — 다듬기 2 (8d·8p Review 남은 항목)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"다듬기 2 Review"** 절로 덧붙인다(앞 절은 고치지 않는다). **배포 판정**까지.

## 왜 이번 Review 가 무거운가
Build 의 브라우저 확인·변이·테스트 2회째가 없다 — 결과 파일을 읽고 디버깅 포트를 curl 로 보는 명령이 권한 분류기에 막혔다(사유 "Undermining Oversight"). 운영자가 2026-11-15 "Review 가 자기 시험으로"를 골랐다. 그 뒤 Build 가 `cache.js` 한 줄·M1 `model` 을 더했고 테스트 1회(1389)만 돌렸다.

**하지 말 것**: 프로세스 조회(어떤 형태든), 디버깅 포트를 curl·fetch 로 찌르기. 시험 스크립트는 `try { … } finally { await browser.close() }` 로 짜고, 결과는 스크립트가 stdout 으로 바로 출력하게 해서 따로 파일을 읽는 단계를 줄여라. 명령은 한 호출에 한 가지 일만. **어떤 명령이든 막히면 변형을 찾지 말고 그 자리에서 멈춰 보고한다.** Build 가 쓴 포트 9411·프로필 `bp2/p1` 은 쓰지 마라(남아 있을 수 있다) — 새 포트·새 프로필 `rp2/p1`.

## 읽을 것
지침 `.claude/tasks/medreader-build-polish2.md`, Build 보고 `.claude/tasks/medreader-build-polish2-report.md`(4-1 덧붙임 포함), review.md "8d Review"(8dR-8·8dR-9)·"8p Review"(8pR-8·8pR-9), spec 7-7-1 수용 기준·19-1-3 §7 의 새 정정 줄. 변경: `git diff`(기준 `fc79473`). Build 스크래치 `bp2/`(읽기만 — `hl.mjs` 84행 흉내 Gemini 가 예외를 던졌다).

## 확인할 것
1. **번역 요청·캐시 키 무변**: 의학책(CMDT 2026) × ar·ko 로 요청 본문·캐시 **키**·청크 경계가 `fc79473` 과 같고, 값에 `domain` 만 더해지는지. 옛 캐시 레코드(필드 없음)로 재요청 0.
2. **띠 모드(기본) 무변**: DOM·`--reader-chrome-bottom`·낭독 큐가 HEAD 와 같음 — Nour 는 띠로 쓴다.
3. **M1**: 오프라인·`exhausted`·`model` 등으로 20문장 — 새 상태 줄 1개, 현재 문장 윗변 불변(I4), 풀리면 그 문장 아래 블록.
4. **팝오버 "번역 위치" 줄**: 412×915 band 에서 처음 열었을 때 단추가 sticky 닫기 줄에 가리는지 실측(가리면 몇 px — 운영자 결정은 "가리면 위 여백 0", 너는 숫자와 의견만), 360×740 도. 설정 AI 탭 같은 줄.
5. **L1**: ar 대상·ko UI 에서 상태 줄은 UI 방향, 번역문 블록은 rtl.
6. **L2·L3·P8-9·P8-10**: `setDocDomain` 정규화 비교, 리더 `onDocDomain` 효과, `cache.js` 값 기록.
7. 회귀: 8d 블록·쪽 넘김, 8m, 8o, 8g 검색·8g-7 "장" 묶음, 8p 메뉴. 콘솔 오류 0.
8. 너만의 변이 3개 이상(Build 는 하나도 안 했다) → 빨강 → 복원 **읽어서 쓰기 + `cmp`**, 백업 `rp2/bak/`.
9. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1389 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정.**

## 규칙
8000번 python 은 Build 가 다시 띄웠다(PID 모름) — 있으면 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지, 새 프로필 2개까지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 앱·테스트·spec 은 고치지 않는다(변이는 되돌린다). 스크래치패드는 `rp2/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
