# Review 지침 — 8n-b 재검증 (고친 곳만)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8n-b 재검증" 절로 덧붙인다(앞 절은 건드리지 않는다). 스크래치패드 `r8nb/`(앞 Review 의 `r8n/` 은 읽기만 — 재사용 가능).

## 볼 것
- `review.md` 의 "8n Review"(8nR-1–9), Build 지침 `.claude/tasks/medreader-build-8n-b-fix.md`, 보고서 `.claude/tasks/medreader-build-8n-b-fix-report.md`(믿지 말고 다시 재라), spec 19-1-3 §5 `[정정 2026-11-16 — 8n-b]`.
- 변경: `git diff` 중 `js/text/lang.js`·`segment.js`·`ui/library.js`·8n 테스트·픽스처.

## 확인할 것
1. **높음-1 고침**: 네가 **새로** 지은 보통 꼴 스페인어 문단 6개 이상(앞 Review·Build 것과 다른 글 — 의학·뉴스·설명·대화)이 es 인가. 새로 지은 프랑스어 6개 이상이 fr 이고 score 가 8n 이전과 같은가. 특히 **`la` 가 많은 프랑스어**(여성 명사가 많은 글)가 es 로 새지 않는가.
2. **회귀**: HEAD 판과 무작위 대조(es 아닌 결과 바뀐 것 0), golden 픽스처가 그대로인지(`git diff` 에 없음), 의학책 표본(앞 Review 스크립트 재사용 가능) HEAD 와 같음.
3. **`ES_MIN_WORDS = 2`**: Build 가 지침 예시 3 대신 2 로 둔 이유가 맞는지, 2 로 생기는 오판(짧은 영어 문서 속 `con`·`por` 두 개 등)을 실측.
4. **문장 나눔**: `¿¡` 계속 규칙·겹약어 규칙이 en·fr·ko 분할에 영향 0 인지(무작위 대조), es 에서 **놓친 끊김**(정상 문장 시작 `¿` 앞인데 안 끊기는 경우)이 새로 생겼는지.
5. 보고서가 밝힌 한계(카탈루냐어 fr→es, 이탈리아어·베트남어 es)가 지원 원문 밖 문서에만 해당하는지 — 지원 언어(en·fr·ko·es) 판정에는 영향 없는지.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 2개 이상을 네가 고른 곳에(고친 코드 안) → 빨강 확인 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8nb/bak/`). 생존은 테스트 구멍으로 기록.
8. headless 는 **한 번만**(새 프로필 `r8nb/p1`, pipe, 412×915, 가짜 키, 흉내 Gemini OPTIONS 포함): 네가 지은 보통 꼴 스페인어 PDF → es·`es-ES`·"from Spanish", CMDT 2026 en 회귀, 콘솔 오류 0.

## 판정
표(번호·심각도·내용·근거) + 마지막 줄 **배포 가능 / 고친 뒤 배포**.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만(경로는 `.claude/tasks/medreader-build-8n-es.md` 지침 참고 — 없으면 `medreader-build-8g6-search-cjk.md`), Downloads 폴더 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8nb/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
