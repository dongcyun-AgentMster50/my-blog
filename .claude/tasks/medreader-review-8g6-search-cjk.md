# Review 지침 — 8g-6 검색: CJK·한국어 조사

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8g-6 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8g6/`(Build 의 `b8g6/` 는 읽기만).

## 볼 것
spec 19-1-3 §8(표·수용 기준·`[정정 2026-11-16 — 8g-6 Build]`), 17-8-4, 지침 `.claude/tasks/medreader-build-8g6-search-cjk.md`, 보고서 `.claude/tasks/medreader-build-8g6-search-cjk-report.md`(믿지 말고 다시 재라), `git diff`(`js/text/search.js`·`index.html`·spec) + 새 `tests/search-cjk-8g6.test.mjs`. `dev/measure-table-8i4.mjs` 는 다른 단계 — 보지 마라.

## 확인할 것
1. **라틴·아랍 경로 불변(가장 중요)**: HEAD 판 `search.js`(`git show` → `r8g6/head/`)와 지금 판을 **네가 새로 만든** 검색어 묶음(라틴 3자 이하·4자 이상·약어 대소문자·구·하이픈·숫자 섞임·아랍어·악센트 프랑스어/스페인어, 무작위 서로 다른 검색어 수천)과 무작위 본문으로 `parseQuery`·`findIn`·`hitLength`·`foldText` 결과 대조 — 라틴·아랍 검색어에서 다른 것 0. 전각 글자가 없는 본문에서 `foldText` 결과가 HEAD 와 같은가.
2. **길이 보존**(17-8-4): 무작위 유니코드(전각·U+3000·서로게이트·결합 문자 포함)에서 `foldText(s).length === s.length` 와 적중 위치 → 원문 하이라이트 위치가 맞는가.
3. **한글 규칙**: 검색어 **끝** 글자만 보는가 — `학교` ✓ "학교에", ✗ "대학교"; 한글+숫자/라틴 섞인 검색어(`비타민D`·`2형 당뇨`·`COVID 백신`)의 경계가 이치에 맞는가; 공백 낀 한글 구.
4. **CJK 규칙**: `学` 1자 허용·`학` 1자 짧음, 가나·`ー`, 한자+라틴 섞임. 1자 검색어가 결과 상한(1,000)·속도에 미치는 영향(큰 한자 문서가 없으면 합성으로 — 시간 실측).
5. **ui 연결**: 보고서 한계 3(한자 1자 검색어가 최근 검색어에 남지 않음 — `ui/search.js` `recentWith`)이 사실인지, 그 밖에 `ui/search.js` 가 글자 수·경계로 따로 판정하는 곳(짧음 안내·하이라이트·조각)이 새 규칙과 어긋나는지.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 2개 이상 네가 고른 곳 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8g6/bak/`). 생존은 테스트 구멍으로.
8. headless 한 번(Edge 412×915, 새 프로필 `r8g6/p1`, pipe, 가짜 키): **네가 새로 만든** 한글·한자 합성 PDF(저작권 없는 글) → `학교`류 조사 적중·하이라이트 위치, `学` 1자, 전각 검색, ko·ar UI, 콘솔 오류 0. 의학책 큰 가져오기는 하지 않아도 된다(1번 대조로 갈음) — 하려면 CMDT 2026 하나만.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 라틴·아랍 검색 결과·위치 회귀, 길이 보존 깨짐, 하이라이트 위치 어긋남, 한글 검색어가 수용 기준과 다르게 동작, 콘솔 오류.
- **낮음**(→ "배포 가능", 한계로): 설계가 한계로 적은 것(합성어 앞 경계·한자 부분 일치), 최근 검색어·안내 문구 같은 ui 다듬기, 실물 견본 없음.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(백업·복사·확인도 각각). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만(경로는 Build 지침), Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8g6/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
