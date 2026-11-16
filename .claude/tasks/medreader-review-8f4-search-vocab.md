# Review 지침 — 8f-4 아랍어 검색어 → 단어장 대응

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8f-4 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8f4/`(Build 의 `b8f4/` 는 읽기만 — 합성 PDF·하네스 재사용 가능).

## 볼 것
spec 17-8-7·17-8-9(`[정정 2026-11-16 — 8f-4 Build]`)·17-7-6 10 8cf-D13, 8g-7(진료과 사전 — 장 묶음), 지침 `.claude/tasks/medreader-build-8f4-search-vocab.md`, 보고서 `.claude/tasks/medreader-build-8f4-search-vocab-report.md`(믿지 말고 다시 재라), `git diff`(`js/ui/search.js` +158·i18n·`tests/search-ui-8g.test.mjs` 고정값 47→48) + 새 `tests/search-vocab-8f4.test.mjs`.

## 확인할 것
1. **검색 경로 불변(가장 중요)**: 라틴·한글·한자 검색어, 아랍어 검색어 중 적중이 있는 것, 8g-7 사전이 받는 진료과 이름, 스캔본 "글자 없음", 서재 전체 범위 — 결과·조각·안내·최근 검색어·띠가 HEAD 와 같은가(HEAD 판 `git archive` 와 같은 데이터로 대조). `paintModel`·`loadChapToc` 에 들어간 변경(`kickVocab`·`my.wait`)이 검색 화면의 다른 흐름(검색어 바꿈 중 이전 결과 늦게 도착·화면 떠남·다른 책으로 바꿈)에서 낡은 결과를 그리거나 상태를 엉키게 하지 않는가.
2. **단어장 대응**: 켜지는 조건(이 책 범위·적중 0·아랍 문자·책 글자 체계와 다름), 정규화(하라카트·ة/ه·알리프 꼴·타트윌·앞뒤 공백), 여러 항목 고르기(책 언어·대상 언어 우선 → 최근 `updatedAt`), 바꾼 원어도 0 이면 안내, 단어장 비었음·IDB 실패·매달림.
3. **호출 0**: 어떤 경로에서도 요청 0(흉내 fetch·headless), 검색어가 기기 밖으로 나가지 않음.
4. **범위 밖 1줄**: `search-ui-8g.test.mjs` 의 47→48 이 승인된 i18n 1키 때문뿐인지(다른 키가 몰래 늘지 않았는지), 시험 제목 "47개" 가 남은 것이 문제인지.
5. **화면**: 바꿈 줄이 RTL·LTR 섞임에서 바르게 보임(`bdi`), 360×740·412×915 ar·ko, 가로 넘침 0, `innerHTML` 0(단어장 원어·번역에 `<img onerror>` 넣어 확인).
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 2개 이상 네가 고른 곳(Build M1–M4 와 다르게 — 예: 켜지는 조건에서 "적중 0" 빼기, 낡은 결과 거르기 토큰 빼기) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8f4/bak/`).
8. headless 한 번: Edge, pipe, 새 프로필 `r8f4/p1`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **작은 합성 PDF 만**(큰 원서로 검색 화면에 들어가지 말 것). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 기존 검색 결과·안내·최근 검색어의 HEAD 대비 변화, 낡은 결과가 그려짐, 호출이 생김, XSS, 콘솔 오류, 승인 밖 i18n 키.
- **낮음**(→ "배포 가능"): 보고서 "남은 문제" 꼴(관사·여러 뜻 불일치 등), 문안.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8f4/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
