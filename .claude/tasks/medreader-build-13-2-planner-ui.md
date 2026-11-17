# Build 지침 — 13-2 학습 계획 화면 `#/planner` · 서재 "오늘" 줄 시험 줄

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-12** 중 13-2 몫 — 2(숫자의 출처)·5(계획 화면)·6 표 13-2 행·import 방향·7 "13-2" 수용 기준·8·9 결정 표(권장안)·12(실기기 — 적기만), 17-12 안의 `[정정 2026-11-17 — 13-1 Build]` ①–⑧. 운영자 위임: 권장안으로 — 13-Q1(상한 올리기 권하기 — 안 함: `overCap` 줄은 사실만 보이고 설정을 바꾸지 않음)·13-Q2(낭독 기록 기본 켬, 끌 수 있음) 설계 기본값. **고지: 화면 어디에도 "점수"·"합격 가능성" 문구 없음**(의료·교육 안전). **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-13-2-planner-ui-report.md`.

## 먼저 고칠 것 — 13-1 Review(13-1R) (13-1 은 아직 배포 전 — 13-2 와 함께 배포한다)
review.md 끝 "13-1 Review" 절을 먼저 읽어라.
1. **중간-1 — 300자 넘는 문장을 조각마다 다시 셈**: speaker 가 긴 문장을 `MAX_UTTER_CHARS` 조각으로 나눠 조각마다 `linechange` 를 낸다(`src` 는 문장 전체, `index` 만 다름) → readlog 의 "같은 단위" 키(`docId|page|index`)로 n배. 고침: `linechange` 에 `part`(조각 번호)를 넣고 `part > 0` 이면 글자 0 — 또는 키를 문장 정체(`docId|page|lineId|src` 해시)로. **실제 `createSpeaker` 로 긴 문장(3조각 이상)을 읽히는 시험**(Review `r13-1/chk.mjs` 재사용 — 읽기만)을 더해 글자 = 실제. `speaker.js` 를 고치면 낭독 동작 무변을 시험으로(이 항목만 `speaker.js` 수정 허용).
2. 낮음-2: 속도 바꿈 앞 구간은 옛 속도로(구간을 나눠 셈). 낮음-3: 자정을 걸친 구간은 두 날로 나눔. 각각 작으면, 아니면 보고서에.
3. 낮음-4: 쪽 넘김 실패(`PAGE_TIMEOUT`) 뒤 다시 재생에서 `pagedone` 두 번 → 그날 `pages` 한 번만(같은 쪽 두 번 세지 않음).
4. 낮음-5: controls 배선(붙이기·떼기·숨김)을 동작으로 지키는 node 시험(가짜 controls 꼴이 어려우면 headless 한 줄로).
- 낮음-6(`planner.exams` docId — 9c)·7(`[안 읽음으로]` 가 9c 합집합으로 되살아남 — 계획 화면에 고지 한 줄)은 아래 13-2 몫으로 함께.

## 설계 뒤 바뀐 것 — 맞춰라
- 13-1 보고서 `.claude/tasks/medreader-build-13-1-planner-report.md`·review.md "13-1 Review" 절(넘긴 것 반영). API: `planner.planFor`·`remainingOf`·`todayRange`·`speedOf`·`callsRateOf`·`reviewMinutes`, `readLogStore`(`markRead`·`unmark`·읽기).
- 13-1 남은 1 — **`PLAN.TEXT_TO_SPOKEN`(설계 2 "표본 20쪽 낭독 글자 ÷ 검색 글자")를 이 단계에서 잰다**: 책 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`(읽기만, Downloads 목록 보지 말 것), pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`, 앱 추출 경로(`buildUnits`/`searchText`) — 숫자만 기록(글 옮기지 말 것), 측정 스크립트는 스크래치. 값을 `config.js` `PLAN` 에 넣고 spec 정정 줄에 근거.
- 13-1 남은 2 — `planner.exams` 의 `targets[].docId` 가 9c 에서 안 옮겨짐: 저장할 때 `fileHash` 도 함께 두고, 화면이 docId 로 못 찾으면 fileHash 로 찾기(9c 무변 — 읽기에서 해결). 9c 가져오기를 고쳐야 하면 이유를 보고서에.
- 12-3: 서재 "오늘" 줄 자리 `#libraryTodayExtra` 에 가까운 시험 줄(시험 둘이면 가까운 것, 시험·카드 없으면 `[시험 계획 세우기]` 링크만). 새 카드 셈은 `cards.readLog()`.
- 8c-2 `callsPer10k`(usage.js)·`usageView` 를 그대로 쓴다. 설정 화면에 `reading.track` 스위치(13-1 남은 6) 한 줄.

## 할 일
설계 6 표 13-2 행 그대로: 새 `js/ui/planner.js`·`tests/planner-ui-13.test.mjs`, 고칠 `js/router.js`·`js/main.js`(+4)·`js/ui/library.js`("오늘" 줄 시험 줄·입구)·`index.html`(섹션)·`css/screens.css`·i18n 4개(약 38키, ar·fr `[검토 — Nour·운영자]`) + `js/ui/settings.js`(`reading.track` 스위치) + `js/config.js`(`PLAN.TEXT_TO_SPOKEN`). 화면: 시험 추가·편집·삭제(이름·날짜·하루 분·쉬는 요일·범위 = 책 + 장/쪽 `tocOf`), 결과 카드(하루 필요 분·남은 쪽·끝나는 날·하루 호출 어림·복습 분·상태 `tight`/`past`/`done`/`overCap`), 진도(읽은 쪽·[여기서 읽기]·[읽음으로]/[안 읽음으로]·[정확히 세기] — 원격 0), 고지 한 줄. 화면 숫자는 **반드시 `planFor` 결과**(자체 계산 금지). AI 호출 0. DB 3·algoVersion·판본 상수 불변.

## 검증
- 수용 기준 "13-2" 전부 + 변이(설계 끝 셋) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b13-2/bak/`).
- 호출 0(흉내 Gemini), 요청 본문 바이트 HEAD 와 같음. `overCap` 이 설정(`ai.dailyCap`·`readalong.mode`)을 바꾸지 않음. i18n grep "점수"·"합격"·"score"·"pass chance" 류 0.
- 회귀: 12-3 서재 "오늘" 줄·복습 화면, 11-3 요약 화면·라우터, 8c-2 사용량·설정, 9c 백업(`planner.exams` 포함), 낭독(13-1 기록 배선).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0.
- headless: Edge, pipe, 새 프로필 `b13-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성(`onend` 글자 수 ÷ 14자/초 + 가짜 시계), 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 360×740·412×915·915×412 × 4언어(날짜 칸·요일 칩 RTL). 콘솔 오류 0. 스크린샷 4–6장 `b13-2/shots/`.
- spec 17-12 안 `[정정 2026-11-17 — 13-2 Build]` 줄(Edit 로 그 자리만).

## 수정 범위
설계 6 표 13-2 행의 파일 + `js/ui/settings.js`(스위치 한 줄) + `js/config.js`(`PLAN.TEXT_TO_SPOKEN`) + (필요하면) `js/plan/*` 몇 줄 + `index.html`(stamp 포함) + `tests/` + `spec.md` + 스크래치패드 `b13-2/` + 보고서. `ai/*`·`db.js`·`backup/*`·`text/backup.js`·review.md·`dev/` 금지(`speaker.js`·`controls.js`·`plan/readlog.js` 는 위 "먼저 고칠 것" 만). 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
