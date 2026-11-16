# Build 지침 — 8c-2 사용량 화면 · 80% 경고

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-7-6** 중 8c-2 몫 — 4-7(사용량 화면·80% 경고)·5 표의 8c-2 행·6(호출)·7(i18n `usage.*` 약 25 + `ai.capWarn`, 자리표시 키 2개 지움)·8 "8c-2" 수용 기준·9·10(권장안)·12(실기기 — 적기만), 17-7-6 안 모든 `[정정 2026-11-16 …]` 줄. 운영자 위임(2026-11-15): 권장안으로. **무료 한도 원칙·비용·외부 전송을 바꾸는 선택은 하지 말고 보고서의 "운영자에게 물을 것"으로.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8c2-usage-report.md`.

## 읽을 것
- 위 spec 항목, 8a(파이프라인·상한 `capped`·사용량 행), 7-5(캐시), 8f-1 보고서(사용량 `byKind.term`·`capWarned` 받기 — `provider.js` 가 이미 받는다).
- `.claude/tasks/medreader-crossstep-notes.md` — **"8c-2" 절 두 줄을 반드시 반영**: ① "1만 자당 호출" 식을 **순수 함수로 떼어 export**(13 학습 계획이 씀) ② 80% 경고는 그날 사용량 행 `capWarned` 로 **하루 한 번**. 그리고 "8c-1(Review 8c1R…)" 줄의 **429 → `exhausted`** 문제: 사용량 화면이 "오늘 한도 소진"을 보일 때 분당 제한(RPM) 429 를 하루 소진으로 잘못 보이게 되는지 확인하고, 설계 범위 안에서 화면 문구로 오해를 줄일 수 있으면 하되 **`pipeline.js` 의 판정 자체는 바꾸지 말 것**(보고서·crossstep 후보로).

## 할 일
설계 5 표 8c-2 행 그대로: 새 `js/ui/usage.js`·`tests/usage-8c.test.mjs`, 고칠 `js/ai/pipeline.js`(`onWarn` +25 — 80% 경고 신호만, 번역 요청 바이트·오류 판정 불변)·`js/ai/cache.js`(`stats()` +12)·`js/ui/controls.js`(경고 배너 +6)·`js/ui/trband.js`(`capped` 배너 단추 하나)·`js/ui/settings.js`(입구 단추)·`js/main.js`(+3)·`index.html`(자리표시 → 화면)·`css/screens.css`·i18n 4개. 화면: 오늘·지난 며칠 사용량(종류별 — 번역·단어 `term`·이후 11 의 요약 자리), 상한까지 남은 것, 캐시 크기·히트, "1만 자당 호출" 어림. 호출 0(화면은 기기 안 숫자만). DB 3·algoVersion·캐시 키·`PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "8c-2" 전부(`[N]` 테스트, `[D]` headless, `[M]` 실기기 목록).
- 80% 경고: 하루 한 번(같은 날 여러 번 넘어도 1번, 날 바뀌면 다시), 낭독·탭·단어 요청 어느 쪽으로 넘어도 같은 경고, 상한 도달 `capped` 배너 단추 → 사용량 화면.
- 번역 요청 본문 바이트·사용량 행 꼴·오류 처리 HEAD 와 같음(흉내 fetch 로 node 대조 — 8f-1 Review `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r8f1\diff.mjs` 꼴 재사용 가능, 읽기만).
- 회귀: 8c-1 탭 띠·8f-2 시트·8f-3 단어장·설정 화면·Esc 층.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless(Edge 412×915·915×412, ko·ar UI, 새 프로필 `b8c2/p*`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**): 사용량을 쌓아(흉내 응답) 80% 경고 → 화면 숫자 → 상한 → `capped` 배너 단추 → 화면, 가로 넘침 0, 48px, RTL 숫자 방향, 콘솔 오류 0. 스크린샷 3–5장 `b8c2/shots/`.
- 변이 3개 이상(하루 한 번 조건 빼기, `onWarn` 이 번역 요청을 바꾸게, 1만 자당 식 바꾸기, `stats()` 가 캐시를 읽으며 지우기 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8c2/bak/`).
- spec 17-7-6 안 `[정정 2026-11-16 — 8c-2 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 5 표 8c-2 행의 파일 + `index.html`(stamp 포함) + `tests/` + `spec.md` + `.claude/tasks/medreader-crossstep-notes.md`(후보 줄 덧붙이기만) + 스크래치패드 `b8c2/` + 보고서. `prompts.js`·`provider.js`·`db.js`·`readalong.js`·`wordsheet.js`·`vocab.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프로 묶지 말 것**(앞 Build 들이 첫 테스트에서 자주 어겼다 — 작업 폴더는 이미 저장소 뿌리다). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름). 8000 python 쓰기만, 끄지 마라. 8123·8124·8125 node 건드리지 마라. headless 는 한 번에 하나씩. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
