# Build 지침 — 12-1 SM-2 · 기억 카드 서비스 (화면 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-11 "12 SRS 기억 카드"** 중 12-1 몫 — 1(코드 사실)·2(바뀐 것)·3(SM-2 순수 `js/srs/sm2.js` — 표 S1–S10)·4(카드 서비스 `js/srs/cards.js`)·7 표 12-1 행·import 방향·8 "12-1" 수용 기준·9·10 결정 표(권장안)·11(넘길 것). 운영자 위임: 권장안으로 — **12-Q1(복습 중 번역 부르기 — 호출 0)·12-Q2(CSV·Anki 없음)는 설계 기본값.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-12-1-srs-service-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라 (`.claude/tasks/medreader-crossstep-notes.md` 를 읽어라 — "12"·"9c" 관련 줄 전부)
- **db.js**: 11-1 이 `keepsOnDocDelete(rec, store)` 한 곳에서 판정하고 `annotations` 스토어 전체·`term` 카드를 남기게 했다 → 12-1 은 거기에 `sentence` 카드를 더한다(설계 7 표 "+1").
- **9c**: 9c-1 이 `mergeRecord` 에 카드 병합 `max(updatedAt, reviewedAt)`·복습 필드는 `reviewedAt` 늦을 때만·term 은 `importPlan` 을 이미 넣었다(spec 17-4-1 `[정정 — 9c-1 Build]`). 9c-1 Review #8: **문장 카드는 레코드를 통째로 병합해 기기의 더 최근 복습 상태가 옛것으로 덮일 수 있다 — 12-1 이 정할 일** → 수용 기준 "9c 병합" 대로(내용은 `updatedAt` 늦은 쪽, 복습 상태는 `reviewedAt` 늦은 쪽) `text/backup.js` `mergeRecord` 의 카드 갈래를 고친다(멱등 시험 그대로). 9c 설정 허용 목록에 `srs.newPerDay`(담음)·`srs.log`(담음 — 학습 기록; 9c 가 "DEFAULTS 의 모든 키 분류" 시험으로 강제) 분류.
- **8f-1 Review**: `store.update` 가 `suspended` 같은 내용 밖 필드만 바뀌면 `updatedAt` 을 안 올려 9c 병합에서 질 수 있다 — 12-1 의 `suspended` 토글이 9c 병합에서 지지 않게(복습 상태 쪽 시각 — `reviewedAt` 또는 별도 규칙 — 설계와 맞는 쪽, spec 정정 줄로).
- 8f-3/8f-3b: `applyImport`·`planToApply` 는 이미 복습 필드를 보존한다(시험 확인만 — 설계 7 표의 "보존하지 않으면 +3" 은 확인 결과에 따라).
- 시각은 숫자 ms(8f-1). ISO 문자열 `dueAt`(옛 값 모사)도 숫자처럼 비교(수용 기준).

## 할 일
설계 7 표 12-1 행 그대로: 새 `js/srs/sm2.js`(순수 — `config` 만, `Date`·`document`·`window` 직접 참조 0 — `nowMs` 주입)·`js/srs/cards.js`(서비스 — `config`·`db`·`hash`·`srs/*` 만)·`tests/sm2-12.test.mjs`·`tests/cards-12.test.mjs`(fake-idb), 고칠 `js/db.js`(`sentence` 한 줄)·`js/config.js`(`SRS`)·`js/settings.js`(`srs.newPerDay`·`srs.log`)·`js/text/backup.js`·`js/config.js` `BACKUP` 허용 목록·(필요하면) `js/backup/import.js`·`js/vocab/store.js`. **화면은 만들지 않는다**(12-2·12-3 몫). `fillBack` 은 주입된 조회 함수만 — 조회 밖 호출 0(파이프라인을 import 하지 않음). DB 3·algoVersion·모든 `*_PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "12-1" 전부 + 변이(설계 끝 여섯) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b12-1/bak/`).
- 회귀: 8f-1·8f-3 단어장(`changedSince`·CSV 가져오기 — 복습 뒤 "바뀐 항목" 늘지 않음), 9c-1·9c-2 백업 시험(멱등·기기 데이터 우선) 전부, 11-1 삭제 연쇄(annotations·term 남음, term 캐시 지움), 번역·단어·요약·설명 요청 본문 바이트 HEAD 와 같음(이 Build 는 ai/* 를 건드리지 않음 — 확인만).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0, 16-A 순수 grep.
- headless 한 번(Edge, pipe, 새 프로필 `b12-1/p1`, 가짜 키, 흉내 Gemini, 캐시 끔, **서버 띄우기 금지**): 앱이 뜨고 단어장·서재 삭제·9c 내보내기가 그대로, 콘솔 오류 0. 카드 서비스는 화면이 없으니 페이지 안 모듈 import 로 `saveSentence`·`review`·`queue` 한 번(실제 IndexedDB).
- spec 17-11 안 `[정정 2026-11-17 — 12-1 Build]` 줄·17-4-1 9c 병합 정정 한 줄(Edit 로 그 자리만), 3-2 `srs/*` import 방향 한 줄, 9-3 설정 두 줄(설계가 말한 곳).

## 수정 범위
설계 7 표 12-1 행의 파일 + `js/text/backup.js`(카드 병합 갈래만) + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b12-1/` + 보고서. `ai/*`·`ui/*`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — stamp 도 단독으로). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
