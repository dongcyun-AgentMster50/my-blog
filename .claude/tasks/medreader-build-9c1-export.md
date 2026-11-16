# Build 지침 — 9c-1 백업 내보내기

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-4-1 "9c 백업·옮기기"** 중 9c-1 몫 — 1(코드 사실)·2(무엇을 담나)·3(파일 형식 NDJSON+gzip)·4(설정 허용 목록)·6(화면 — 내보내기·책별 PDF·안내)·7 표 9c-1 행·import 방향·"9c-1 수용 기준"·공통·headless 방법·8 결정 표(권장안)·10(실기기 — 적기만). 순수 `js/text/backup.js` 는 설계대로 `remapRecord`·`mergeRecord`·`lineSplitter`·`readHead` 까지 이번에 만들고 시험한다(9c-2 가 가져다 쓴다). 운영자 위임(2026-11-15): 권장안으로. **9c-Q1(암호)·Q2(캐시 기본 켬)·Q3(문맥 문장)은 설계 기본값(암호 없음·캐시 켬·문맥 담음)대로 — 묻지 않는다.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9c1-export-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라 (crossstep-notes 의 "9c" 줄들 전부)
- `.claude/tasks/medreader-crossstep-notes.md` 를 읽어라 — "9c" 절, "8f-1 Review 에서 넘긴 것" 의 9c 줄, "9c (8c-2 Review 8c2R)" 줄.
- 허용 목록(설계 4)은 **명시 목록**이고 "DEFAULTS 의 모든 키가 담음/안 담음 중 하나" 시험이 있다 — 설계 뒤 생긴 키를 지금 `js/settings.js` `DEFAULTS` 에서 모두 확인해 분류하라: `tts.voice.es`·`tts.accent.es`(8n — 안 담음, 기기 몫), `links.medical`(18 — 담음; 18 이 아직 배포 전이면 키가 없을 수 있다 — 있으면 담음), `vocab.lastExportAt`(담음), `usage`·8c-2 관련 설정 키, 8f-3·8c-1 이 더한 키. 분류가 애매하면 "기기 몫·개인정보 몫은 안 담음" 원칙으로 고르고 보고서 표에.
- 12·13(SRS·계획)은 아직 없다 — `srs.*`·`reading.*`·`planner.exams` 키는 지금 없으니 목록에 넣지 않는다(12-1·13-1 이 더한다 — crossstep 그대로).
- `mergeRecord` 의 규칙에 crossstep 의 것을 반영: 카드 병합 `max(updatedAt, reviewedAt)`(12 대비), 단어장 term 은 id 다음에 `term+targetLang` 으로도 맞춤(8f1R), `usage` 같은 날 필드별 큰 값에 불리언 `capWarned` 는 OR(8c2R), `progress` `@read` 는 구간 합집합(있으면). 바뀐 규칙은 spec 17-4-1 5 표 아래 `[정정 2026-11-17 — 9c-1 Build]` 줄로(Edit 로 그 자리만).
- `cards` term 병합은 `text/vocab.js` 의 `importPlan` 규칙을 **다시 만들지 말고** 부른다(설계 5). 8f-3b 가 `importPlan` 에 충돌·정규화를 더했다 — 백업 병합에서 그 결과(충돌)를 어떻게 다룰지(백업은 미리보기에서 고르지 않음 — 기기 값 유지가 안전) 정해 정정 줄에.

## 할 일
설계 7 표 9c-1 행 그대로: 새 `js/text/backup.js`(순수)·`js/backup/export.js`·`js/ui/backup.js`(카드의 내보내기 몫)·`tests/backup-9c.test.mjs`, 고칠 `js/config.js`(`BACKUP`)·`js/settings.js`(`backup.lastExportAt`)·`js/ui/settings.js`(카드 init)·`index.html`(카드)·`css/screens.css`·i18n 4개(약 14키, ar·fr `[검토 — Nour·운영자]`). 서재 저장 줄 옆 `[백업]` 링크. `backup/*`·`text/backup.js` 는 `privacy/*`·`ai/*`·`ui/*` import 0, `localStorage`·`sessionStorage` 낱말 0. `db.js` 무변. DB 3·algoVersion·캐시 키·`PROMPT_VERSION` 불변.

## 검증
- "9c-1 수용 기준" 전부 + 순수 `remapRecord`·`mergeRecord`·`lineSplitter`·`readHead` 의 "9c-2 수용 기준" 중 `[N]` 항목(fake-idb 종단 제외).
- **키 0건**(가짜 키를 모든 저장소에 심고), 정적 import 시험.
- 합성 캐시 150MB 내보내기 힙 최댓값(+64MB 기준 — 재서 근거와 함께), 압축률 stdout.
- 회귀: 설정 화면(8c-2 `#/settings/cache`·사용량)·서재·단어장 내보내기(8f-3), 번역 요청 본문 바이트 HEAD 와 같음(앞 Review 하네스 재사용 — 읽기만).
- 변이 4개(설계 9c-1 끝) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b9c1/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless(Edge `--enable-precise-memory-info`, 새 프로필 `b9c1/p*`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버를 새로 띄우지 마라** — 8000 쓰기만 또는 요청 가로채기): 내려받기는 `URL.createObjectURL` 을 감싸 Blob 을 잡아 스크래치에만. 360×740·412×915 × 4언어 카드. 콘솔 오류 0.

## 수정 범위
설계 7 표 9c-1 행의 파일 + 서재 `[백업]` 링크(`js/ui/library.js` 몇 줄) + `index.html`(stamp 포함) + `tests/` + `spec.md`(17-4-1 정정 줄·3-2 import 방향 한 줄·9-3 `backup.lastExportAt` 한 줄 — 설계가 말한 곳만) + 스크래치패드 `b9c1/` + 보고서. `db.js`·`pipeline.js`·`vocab.js`(부르기만)·`search.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라. **18 Build 가 같은 작업 트리에서 돌고 있을 수 있다** — `git status` 로 보고, 18 의 파일(`js/text/links.js`·`js/ui/links.js`·`selbar.js` 등)이 미커밋이면 멈추고 보고(시작하지 말 것).

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤(150MB 합성 파일은 스크래치에만, 끝나면 남겨 두되 크기를 보고). 쓸 스크래치 폴더(`shots/` 등)는 먼저 만들어 둘 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
