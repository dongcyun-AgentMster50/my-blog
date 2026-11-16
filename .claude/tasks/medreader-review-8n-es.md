# Review 지침 — 8n 스페인어 원문 언어 (+ 설정 목소리 es 묶음)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. 앱 코드를 고치지 않는다(찾은 문제는 review.md 에 적고 심각도를 매긴다 — 수정은 오케스트레이터가 따로 맡긴다). **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **끝에** "8n Review" 절로 덧붙인다(앞 절은 건드리지 않는다).

## 볼 것
- 설계: spec 19-1-3 §5(8n 표·수용 기준·`[정정 2026-11-16 — 8n Build]`·`8n 마무리` 줄).
- Build 지침: `.claude/tasks/medreader-build-8n-es.md`, `medreader-build-8n-es-finish.md`. Build 보고서: `.claude/tasks/medreader-build-8n-es-report.md`. **보고서를 믿지 말고 스스로 다시 재라.**
- 변경: `git diff` 와 새 파일(`tests/srclang-es-8n.test.mjs`·`tests/fixtures/srclang-8n-corpus.mjs`·`srclang-8n.golden.json`). `apps/medreader/dev/measure-table-8i4.mjs` 는 다른 단계(8q Review 몫) — 보지 마라.

## 확인할 것
1. **회귀(가장 중요)**: es 가 이기지 않는 입력의 `guessLang` 결과가 8n 이전과 같은가. HEAD 판 `text/lang.js`·`segment.js` 를 `git show` 로 스크래치패드 `r8n/head/` 에 꺼내, 네가 새로 만든 무작위·경계 입력(en/fr 기능어 비율이 2배 근처인 것, 짧은 것, 기능어 0, 한글·아랍 섞임)으로 두 판을 대조. golden 픽스처가 HEAD 모듈로 만들어졌는지(8n 판으로 만든 golden 이면 회귀 검사가 아니다) 확인.
2. **es 판정 경계**: `r.es >= big*2` 인데 `big === 0` 일 때(es 기능어만 있음), es·fr 공통 낱말(`la`·`que`·`se`·`y` 를 뺀 것이 맞는가 — `es`·`lo`·`con`·`para`·`una` 가 en·fr 문서에서 얼마나 나오는지 의학책 표본으로 실측), 영어 문서에 스페인어 인용이 섞인 경우, 프랑스어 문서에 `del`·`por` 류가 있는 경우. score 식 `1 - big/r.es` 의 범위와 `LOW_SCORE` 의미가 기존과 같은가.
3. **문장 나눔**: `¿`·`¡` 앞에서 끊기는가, 문장 **중간**의 `¿`(쉼표 뒤 등)에서 잘못 끊지 않는가, en·fr·ko 분할 불변.
4. **8m 연결**: es 문서의 라틴 문장 → es, ko 문서 속 스페인어 문장 → en(가정 그대로), es 문서 속 한글 → ko.
5. **설정 > 낭독 목소리 es 묶음**(마무리 Build 가 넣음): 화면에 나오는가, 기본값·저장·다시 열기, `es-MX` 억양 → 낭독 태그, ar UI RTL 에서 깨지지 않음, 견본 문장 낭독. 9c 백업 허용 목록과의 관계(보고서에 적힌 대로인가).
6. **번역 요청 지시문**: 스페인어 문서 번역 시 "from Spanish"(원문 언어 이름) — 흉내 Gemini 로 실제 요청 본문 확인. 캐시 키·`PROMPT_VERSION` 불변.
7. **옛 서재**: `langGuess` 가 있는 옛 문서는 다시 추정하지 않는다(서재 en 문서가 es 로 바뀌지 않음).
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, `stamp-importmap.mjs --check` 0, `git diff --check` 0.
9. headless Edge(412×915, 새 프로필 `r8n/p1`·새 포트, ko·ar UI, 가짜 키, 흉내 음성): 합성 스페인어 PDF(스크래치패드에 네가 새로 만든 저작권 없는 글 — Build 의 것을 재사용하지 말 것) 가져오기 → es 판정·서재 [⋯] Español·낭독 큐 태그·문장 나눔. 회귀: CMDT 2026 낭독·번역 띠. 가로 넘침 0, 콘솔 오류 0.
10. 변이 2개 이상을 **네가 고른 곳에** 넣어 테스트가 빨개지는지(테스트 구멍 찾기) → 복원(읽어서 쓰기 + `cmp`, 백업 `r8n/bak/`). 빨개지지 않는 변이는 "테스트 구멍"으로 기록.

## 판정
review.md 절 끝에 표: 번호·심각도(높음/중간/낮음)·내용·근거(파일:행·숫자). 마지막 줄에 **배포 가능 / 고친 뒤 배포** 중 하나.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지. `try { … } finally { await browser.close() }`, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름). 8000 python 은 쓰기만, 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지(흉내 Gemini 는 OPTIONS·CORS 응답 포함). 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만(경로는 Build 지침에), Downloads 폴더 목록 보지 말 것. 수정 범위: `apps/medreader/review.md` 끝 절, 스크래치패드 `r8n/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
