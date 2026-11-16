# Build 지침 — 8f-4b: 8f-4 Review 지적 고치기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8f-4 Review" 절(8f4R-1~9) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8f4-search-vocab.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8f4b-fix-report.md`. 스크래치패드 `b8f4b/`(`r8f4/`·`b8f4/` 는 읽기만 — 하네스·합성 PDF 재사용 가능).

## 고칠 것
1. **중간-1 — 바꾼 원어도 0건이면 안내가 사라짐**: Review 권고 **(가)** — 바꾼 검색이 0건으로 끝나면 바꿈 줄을 지우고 **원래 검색어의 17-8-7 안내 그대로**(찾지 못함 + 글자 체계 안내 + [목차로] 단추 — HEAD 와 같은 DOM)로 되돌린다. [N] 시험 하나(HEAD 판 안내와 같은 모형).
2. 낮음-2: `kickVocab` 의 낡은 결과 거르기(`S.model !== m || S.docId !== docId`)를 지키는 node 시험(순수 함수로 떼거나 흐름을 흉내).
3. 낮음-3: 단어장 읽기를 기다리는 동안 미루는 것은 "찾지 못했습니다" 한 줄뿐 — 글자 체계 안내·[목차로] 단추는 바로 보인다(또는 읽기에 상한 시간을 두고 넘으면 안내). 작은 쪽, 이유를 보고서에.
4. 낮음-4: `search-ui-8g.test.mjs` U10 제목 "47개" → "48개"(문안만).

## 검증
- Review 의 HEAD 대조 32 상태(`r8f4/run.mjs` 꼴)를 다시 — 32/32 같거나, 다른 것은 바꿈이 성공한 경우뿐.
- 변이 2개 이상(1·2 되돌림) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8f4b/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless 한 번(Edge 412×915 ar, 새 프로필 `b8f4b/p1`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **작은 합성 PDF 만**, 정적 서버는 이미 떠 있는 8000 을 쓰기만 — 새 서버를 띄우지 마라): 바꾼 원어 0건 → HEAD 안내·[목차로] 단추, 바꿈 성공은 그대로, 요청 0, 콘솔 오류 0.
- spec 17-8-9 `[정정 2026-11-16 — 8f-4 Build]` 줄 뒤에 `[정정 2026-11-16 — 8f-4b]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/ui/search.js`, `tests/search-vocab-8f4.test.mjs`, `tests/search-ui-8g.test.mjs`(U10 제목 한 줄), `index.html`(stamp), `spec.md`(한 줄), 스크래치패드 `b8f4b/`, 보고서.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. **서버를 새로 띄우지 마라**(8000 은 쓰기만). `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
