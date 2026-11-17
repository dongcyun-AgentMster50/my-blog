# Build 지침 — 13-1 학습 계획: 낭독 기록 · 읽은 쪽 · 계획 계산 (화면 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-12 "마감 전 검토 — 계획과 진도"** 중 13-1 몫 — 1(코드 사실)·2(숫자의 출처)·3(계획 계산 — 순수 `js/plan/planner.js`)·4(낭독 기록·읽은 쪽 — `js/plan/readlog.js`)·6 표 13-1 행·import 방향·7 "13-1" 수용 기준·8·9 결정 표(권장안)·10(넘길 것). 운영자 위임: 권장안으로 — **13-Q1(상한 올리기 권하기 — 안 함)·13-Q2(낭독 기록 — 기기 안, 기본 켬)는 설계 기본값.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-13-1-planner-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라 (`.claude/tasks/medreader-crossstep-notes.md` 의 "9c"·"8c-2"·"12-2·12-3·13-2" 줄)
- **8c-2**: "1만 자당 호출" 은 `js/ui/usage.js` 의 순수 `callsPer10k(rows, {minChars})` 로 이미 export 됐다 — 13-1 계산이 그 값(숫자)을 입력으로 받게(planner 는 순수라 usage 를 import 하지 말고 값으로 받음 — 13-2 화면이 이어 줌).
- **9c**: 9c-1 이 `progress` 병합에 `@read` 구간 합집합을 이미 넣었다(`text/backup.js` — 확인만, 꼴이 설계 4 와 다르면 맞추고 정정 줄). 설정 허용 목록에 `reading.log`·`reading.track`·`planner.exams` 분류(9c 의 "DEFAULTS 의 모든 키 분류" 시험이 강제) — `reading.log` 는 학습 기록(담음), `reading.track` 담음, `planner.exams` 담음. `reading.log` 가 `srs.log` 처럼 서비스가 DB 에 직접 쓰는 꼴이면 9c 가져오기에서 덮지 말고 날짜 합집합(`srs.log` 의 `unionSetting` 꼴 재사용).
- **12-3**: 서재 "오늘" 줄에 13-2 자리 `#libraryTodayExtra`(이 단계는 화면 없음 — 자리만 확인). 새 카드 셈은 `cards.readLog()`.
- **speaker `pagedone`**: 8e·9a·11-2·11-4·12-2 가 `controls.js`·`speaker.js` 에 배선을 더했다 — `pagedone` 은 쪽 끝 자동 넘김에서만(사용자 [다음]·`stop`·설명/요약 말하기로 인한 멈춤·재개에서는 없음). 9a 이어폰·9b 음성 재개와 겹쳐도 한 번.
- 시각은 숫자 ms, 지역 날짜(`dayKeyOf` 꼴 — 12-1 의 것을 재사용할지 판단, 순수 계층 규칙 지킴).

## 할 일
설계 6 표 13-1 행 그대로: 새 `js/plan/planner.js`(순수 — `config` 만, `Date` 금지)·`js/plan/readlog.js`(서비스 — `config`·`db`·`plan/*`, speaker 는 주입)·`tests/planner-13.test.mjs`·`tests/readlog-13.test.mjs`(가짜 speaker·가짜 시계·fake-idb), 고칠 `js/tts/speaker.js`(`pagedone`)·`js/ui/controls.js`(`readlog.attach`/`detach`)·`js/config.js`(`PLAN`·9c 허용 목록)·`js/settings.js`(`reading.log`·`reading.track`·`planner.exams`)·(필요하면) `js/backup/import.js`(`reading.log` 합치기). **화면은 만들지 않는다**(13-2). AI 호출 0. DB 3·algoVersion·모든 판본 상수 불변.

## 검증
- 수용 기준 "13-1" 전부 + 변이(설계 끝 여섯) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b13-1/bak/`).
- 회귀: 낭독(speaker 시험 전부·쪽 넘김·반복·hidden 멈춤 6-4)·9a 미디어 키·9b 음성·11-2/11-4 말하기 뒤 재개·12-2 띠·퀴즈 `progress`(읽은 쪽 레코드와 섞이지 않음)·9c 병합·멱등(설정 세 키 포함)·11-1/12-1 삭제 연쇄(`@read` 는 문서 삭제 뒤 없음 — 설계 4). 요청 본문 바이트 HEAD 와 같음.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0, 순수 grep(`plan/planner.js` 에 `Date`·`document`·`window` 0).
- headless 한 번(Edge, pipe, 새 프로필 `b13-1/p1`, 가짜 키, 흉내 Gemini, 흉내 음성 — utterance `onend` 를 글자 수 ÷ 14자/초로 가짜 시계와 함께, 캐시 끔, **서버 띄우기 금지**, 합성 PDF): 두 쪽 끝까지 낭독 → `reading.log` 오늘 ms·chars, `@read` 두 쪽, `pagedone` 두 번, POST 는 낭독 동반 번역 몫만, 콘솔 오류 0.
- spec 17-12 안 `[정정 2026-11-17 — 13-1 Build]` 줄(Edit 로 그 자리만), 3-2 `plan/*` 한 줄, 9-3 설정 세 줄(설계가 말한 곳).

## 수정 범위
설계 6 표 13-1 행의 파일 + `js/backup/import.js`(`reading.log` 합치기만, 필요할 때) + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b13-1/` + 보고서. `ai/*`·`ui/*`(controls 배선 말고)·`db.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독. 앞 Build 들이 첫 시험에서 자주 어겼다). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
