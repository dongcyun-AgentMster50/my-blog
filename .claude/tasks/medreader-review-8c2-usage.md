# Review 지침 — 8c-2 사용량 화면 · 80% 경고

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8c-2 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8c2/`(Build 의 `b8c2/`·앞 Review 의 `r8f1/`·`r8f3b/` 는 읽기만 — 하네스 재사용 가능).

## 볼 것
spec 17-7-6(4-7·5 표 8c-2 행·6·7·8 "8c-2"·9·10, `[정정 2026-11-16 — 8c-2 Build]`), 16-J(상한·경고 숫자), 8a(파이프라인 상한·사용량 행), `.claude/tasks/medreader-crossstep-notes.md` "8c-2"·"8c-1(Review 8c1R…)" 줄, 지침 `.claude/tasks/medreader-build-8c2-usage.md`, 보고서 `.claude/tasks/medreader-build-8c2-usage-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/ui/usage.js`·`tests/usage-8c.test.mjs`).

## 확인할 것
1. **파이프라인 불변(가장 중요)**: `pipeline.js` +44 가 번역·탭·단어 요청 본문·URL·헤더·사용량 행(새 `capWarned` 필드 말고)·캐시 레코드·결과·상태 이벤트·오류 판정·상한 판정(`overCap` 이 export 함수로 바뀐 뒤에도 같은 경계 — 상한 1·3·10·소수·0·음수·문자열)을 바꾸지 않았는가. **네가 새로 짠** 시나리오로 HEAD 판(`git archive`)과 대조(Build 16개와 다르게 — 날 바뀜 경계(자정 전후, 기기 시간대), 상한 직전 동시 요청 셋, 경고 구독자가 예외를 던짐, 구독자가 둘, capped 뒤 키 바꿈).
2. **경고**: 하루 한 번(앱 다시 열기·탭 둘·파이프라인 둘 — 같은 날 1번), 다음 날 다시, 문턱 `ceil(cap×warnAt−1e-9)` 경계, 구독자 없으면 DB 읽기·쓰기 0, 사용량 행 `capWarned` 가 9c 백업·다른 코드의 사용량 읽기와 충돌하지 않음.
3. **데이터 지우기**: 사용량 화면을 열 때 90일 지난 `usage` 행을 지운다 — 설계가 정한 것인지(4-7·수용 기준), 경계(정확히 90일·시간대), 다른 스토어·오늘 행을 건드리지 않는지, 13 학습 계획·`callsPer10k` 가 쓸 기간보다 짧지 않은지.
4. **`cache.stats()`**: 읽기만인지(레코드 수·`updatedAt` 불변), 큰 캐시(수천 개)에서 시간, `bytes` 셈이 설계대로.
5. **화면**: 360×740·412×915·915×412 × ko·ar(+en·fr 한 번), 숫자 꼴(`Intl`)·RTL 막대·미터 방향, 빈 사용량(첫날)·키 없음·capped 상태, 가로 넘침 0, 48px, `innerHTML` 0, 단추 셋 배너 줄바꿈이 다른 배너(단추 1–2개)를 바꾸지 않음, `#/settings/cache` 이동과 뒤로 가기, AI Studio 링크(`rel="noopener"`·새 탭·외부 요청은 누를 때만).
6. **회귀**: 8c-1 탭 띠·8f-2 시트·8f-3 단어장·설정 화면·Esc 층(앞 하네스), 번역 요청 본문 바이트 HEAD 와 같음.
7. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
8. 변이 3개 이상 네가 고른 곳(Build M1–M8 과 다르게 — 예: `overCap` 경계 `>=`→`>`, 90일 지우기를 30일로, 구독자 예외가 파이프라인을 멈추게, `capWarned` 를 다른 날 행에 쓰기) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8c2/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
9. headless: Edge, pipe, 새 프로필 `r8c2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔, **한 번에 하나씩**. 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 요청·상한 판정·사용량 행의 HEAD 대비 변화(설계된 `capWarned` 제외), 설계보다 많은 호출, 경고가 하루 여러 번 또는 0번, 사용자 데이터(오늘 행·다른 스토어) 지움, 구독자 오류가 번역을 멈춤, 8c-1·8f 대비 회귀, XSS, 콘솔 오류.
- **낮음**(→ "배포 가능", 다듬기 후보로): 문안, 실기기 확인 거리, 보고서 "남은 문제" 꼴.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 웹(AI Studio 등) 열지 말 것. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8c2/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
