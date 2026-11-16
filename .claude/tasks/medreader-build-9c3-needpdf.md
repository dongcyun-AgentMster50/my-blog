# Build 지침 — 9c-3 "PDF 필요" 상태 · 같은 PDF 재사용 경로

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-4-1** 중 9c-3 몫 — 1 표의 "같은 PDF 다시 가져오기"·"PDF 없는 문서 열기" 행·6 화면의 "서재 PDF 필요 상태"·"서재 가져오기 재사용 경로 고침"·7 표 9c-3 행·"9c-3 수용 기준"·공통·8 결정 9c-D9(권장안)·10(실기기 — 적기만), 17-4-1 안의 모든 `[정정 2026-11-17 …]` 줄. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9c3-needpdf-report.md`.

## 읽을 것
- 위 spec, 9c-2 보고서 `.claude/tasks/medreader-build-9c2-import-report.md`("남은 문제" 1·2), review.md 의 "9c-2 Review" 절(넘긴 것이 있으면 반영).
- `.claude/tasks/medreader-crossstep-notes.md` — "9c" 줄("같은 PDF 다시 가져오기가 `blobs` 를 안 씀·PDF 없는 문서 열면 빈 화면 — 9c-3 이 고친다").
- **9c-2 Review(9c2R) 낮음 — 이 단계에서 함께(작음, `js/backup/import.js`·`js/ui/backup.js` 를 이번엔 고쳐도 된다)**: ② 설정 가져오기가 `links.medical`(사용자 목록)·`search.recent` 를 파일 값으로 통째 덮음 → **합집합**(링크는 주소로 겹침 제거·30개 상한·기기 순서 먼저, 최근 검색어는 기기 먼저·상한), 그 밖 설정은 그대로 덮기 ③ 가져온 값 타입·범위 — 설정은 `DEFAULTS` 와 같은 타입일 때만, 문서 시각은 지금으로 자름, `term` 없는 term 카드 거절 ① 가져오기 뒤 다시 불러오기 전 [내보내기]가 눌려도 아무 일 없음 → 끄거나 한 줄 안내 ⑤ 모르는 스토어 줄이면 빈 괄호 문구 생략 ⑧ gzip 꼬리만 잘린 파일 문구 ⑥ 시험 틈 R2·R3·R5 한 줄씩. ④(쓰기 실패 문구·quota)는 작으면.
- **`lastLineId`**: 9c-2 Review 판정 **낮음** — 이 값을 읽는 코드가 없고 `lastPage` 는 지켜짐. 고치지 않는다. 대신 spec 17-4-1 "9c-2 수용 기준"의 "p.3·같은 줄" 을 "p.3(줄 이어 읽기는 리더 기능 밖 — 9c2R-9)"로 정정 한 줄. crossstep 다듬기 후보에 "리더가 쪽을 열 때 `lastLineId` 를 첫 줄/null 로 덮음 — 줄 단위 이어 읽기를 넣을 때 함께" 한 줄.
- (아래 옛 줄은 무시) 9c-2 Review 가 "이웃 쪽 추출 전에 연 쪽에서 리더가 `lastLineId` 를 null 로 덮는다"(HEAD 결함)를 어떻게 판정했는지 — **중간 이상이면** 이 단계에서 함께 고친다(`reader.js` 의 진도 저장이 null 로 덮지 않게 — 작은 고침, 시험 하나). 낮음이면 crossstep 후보로.

## 할 일
설계 7 표 9c-3 행 그대로: `js/ui/library.js`(blob 없는 문서 카드 — "PDF 필요" 배지 + `[PDF 가져오기]`, `[계속]` 없음, 고른 파일의 `fileIdentityHash`·쪽수가 맞으면(`identityFor` reuse) blob 넣고 추출 시작·맞지 않으면 한 줄 안내·문서 무변; 서재 [가져오기] 재사용 경로 — `fileHash` 맞는 기존 문서에 blob 이 없으면 그 자리에서 `put`)·`js/ui/reader.js`·`js/ui/search.js`·`js/ui/quiz.js`(blob 없는 문서를 열면 리더 대신 서재로 와서 그 카드에 초점 — 조용한 빈 화면 0)·`css/screens.css`·i18n 4개(약 6키, ar·fr `[검토 — Nour·운영자]`). `db.js` 무변. DB 3·algoVersion·캐시 키·`PROMPT_VERSION` 불변.

## 검증
- "9c-3 수용 기준" 전부 + 9c-2 의 두 프로필 종단을 **PDF 필요 배지 경로로** 다시(B: 가져오기 → 다시 불러오기 → 배지 → `[PDF 가져오기]` 같은 PDF → 같은 쪽·같은 줄·3쪽 낭독 동반 번역 요청 0). 다른 PDF → 문서 무변. 서재 [가져오기]로 같은 PDF → blob 생기고 이어짐(새로 불러온 뒤에도 — 9c-2 남은 2). 검색·퀴즈·리더 주소로 blob 없는 문서 → 서재 그 카드 초점.
- 회귀: 서재 가져오기(새 PDF·중복 PDF·다른 판), 9c-1·9c-2, 8f-3 단어장·18 링크 카드·8c-2, 리더·검색·퀴즈 보통 열기, 번역 요청 본문 바이트 HEAD 와 같음.
- 변이 2개 이상(설계 9c-3 끝 — 재사용 경로 blob 검사 지우기 + 하나 더) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b9c3/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless: Edge, pipe, 새 프로필 `b9c3/p*`(둘 이상), 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기). 360·412 × ko·ar, 넘침 0·48px·RTL·`innerHTML` 0, 콘솔 오류 0. 작은 합성 PDF 우선(9c-2 의 `b9c2/` 것 읽기만).
- spec 17-4-1 안 `[정정 2026-11-17 — 9c-3 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 7 표 9c-3 행의 파일 + (위 조건이면) `reader.js` 진도 저장 한 곳 + `index.html`(stamp) + `tests/` + `spec.md` + `.claude/tasks/medreader-crossstep-notes.md`(후보 줄 덧붙이기만) + 스크래치패드 `b9c3/` + 보고서. `db.js`·`pipeline.js`·review.md·`dev/` 금지(`backup/import.js`·`ui/backup.js` 는 위 9c2R 항목만). 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 앞 Build 들이 첫 시험에서 자주 어겼다). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
