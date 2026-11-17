# Build 지침 — 11-4 설명 (11a — 선택 줄 [설명] · 음성 "설명" · 띠 설명 모드)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-2-1** 중 11-4 몫 — 4-5(소리)·4-7(설명)·5 표 11-4 행·6(호출 — 미적중 1·적중 0)·7(i18n `explain.*` 약 10 + `sel.explain` + `usage.kind.explain`)·8 "11-4" 수용 기준·공통·9·10 결정 표(11-D15·D16·D20 권장안)·13(실기기 — 적기만), 17-2-1 안의 모든 `[정정 2026-11-17 …]` 줄. 운영자 위임: 권장안으로 — **11-Q2(DOC 밖 사전 뜻)는 설계 기본값 "아니다 — 규칙 1–6 그대로"**. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-11-4-explain-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- 11-2 보고서(8절 "11-4 로 넘길 것": [설명] 칸 자리 — `SEL_ACTIONS` 의 `sentence` 다음 · `ask.js` 설명 갈래 · `done`/`listen` 꼴 재사용 · explain 을 켤 때 9b 시험 C9·U9 기대 고침)·11-3 보고서·review.md 의 11-2·11-3 Review 절.
- 선택 줄: 보이는 칸 [단어 번역][문장 번역][설명] + `[⋯]`(11-D3). 360 en·fr 에서 [문장 번역] 이 이미 두 줄(11-2R) — [설명] 이 들어간 뒤 4언어 × 3크기 넘침 0·48px 를 다시 재고, 넘치면 설계 11-D3 안에서(안쪽 여백·글자 줄임 — 48 규칙은 지킴) 맞춘다.
- 띠: 8c-1 탭 모드를 "설명" 모드로 넓힘(11-D16) — 8c-1·8c-1b·8c-1c 의 닫기 조건·Esc 층·포커스 되돌림·`data-tr-inline` 떼기/붙이기 그대로 지킨다.
- 9b `explain` 명령을 켠다(`enabled:true`) — 9b 시험의 `notYet` 기대를 고친다(이유를 보고서에). 9b 말뭉치(9b Review 하네스) 결과 변화 0(새로 켜진 explain 이 기존 명령을 빼앗지 않음).
- 8c-2 사용량 화면 종류 이름 `usage.kind.explain` 한 줄(`js/ui/usage.js`).

## 할 일
설계 5 표 11-4 행 그대로: 새 `tests/explain-11a.test.mjs`, 고칠 `js/ai/prompts.js`(설명 요청·검증 — 규칙 1–6 글자 그대로·맥락 1,500자·숫자 거름 — 11-1b `cutWhole` 재사용)·`js/ai/pipeline.js`(`EXPLAIN_JOB`·`explain()` — 잘린 응답 처리는 11-1b 의 `tailOf` 꼴을 따를지 판단)·`js/ai/provider.js`(`EXPLAIN_KIND`)·`js/config.js`(`AI.EXPLAIN_KIND`·`EXPLAIN` 상수·`EXPLAIN_PROMPT_VERSION` = 1)·`js/ui/trband.js`(설명 모드)·`js/ui/selbar.js`([설명])·`js/ui/ask.js`(설명 갈래)·`js/voice/commands.js`(`explain` 켬)·`js/ui/voice.js`(갈래)·`js/ui/usage.js`(이름 한 줄)·`index.html`(띠 꼬리표·[▶])·`css/reader.css`·i18n 4개(ar·fr `[검토 — Nour·운영자]`). 설명 흐름(11-D15): 부르면 낭독 멈춤 → 띠 "준비 중" → 글 + 대상 언어 소리 한 번 → 읽던 중이었으면 그 문장부터 이어 읽기, 실패면 곧 되돌림. 캐시 키 `ctx=` 문단 해시(11-D20). DB 3·algoVersion·번역 `PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "11-4" 전부 + 공통, 변이(설계 11-4 끝 넷) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b11-4/bak/`).
- **번역·단어·요약·개요 요청 본문 바이트 HEAD 와 같음**(11-3 N8 상수·`r11-1/rdiff.mjs` 꼴), 기존 pipeline·prompts 시험 무변.
- 회귀: 8c-1 탭 띠(탭·닫기 다섯·Esc 층·손가락)·8d 문장 아래 표시·8f-2 단어 시트·11-2 요약 시트·[⋯]·음성 "요약"·18 [찾아보기]·9a·9b 전부·8e 가로 dock·8c-2 사용량 화면.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0, `grep -rn "splitSentences" js/` HEAD 와 같음.
- headless: Edge, pipe, 새 프로필 `b11-4/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS(`responseSchema` 의 `t` 로 설명 갈래), 흉내 음성·9b 가짜 인식기, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 360×740·915×412 × 4언어 선택 줄. 콘솔 오류 0. 스크린샷 3–5장 `b11-4/shots/`.
- spec 17-2-1 안 `[정정 2026-11-17 — 11-4 Build]` 줄(Edit 로 그 자리만, 필요할 때만). 7-xx 의 9b "여기 설명" 표 행에 켬 한 줄(설계가 말한 곳만).

## 수정 범위
설계 5 표 11-4 행의 파일 + `tests/`(9b `notYet` 기대 등 — 이유를 보고서에) + `index.html`(stamp 포함) + `spec.md` + 스크래치패드 `b11-4/` + 보고서. `db.js`·`notes/*`·`backup/*`·`summaries.js`·`sumsheet.js`(부르기만)·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 실물 PDF 문장·설명 글은 결과에 넣지 않는다. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
