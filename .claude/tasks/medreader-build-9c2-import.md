# Build 지침 — 9c-2 백업 가져오기

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-4-1** 중 9c-2 몫 — 5(가져오기 — 문서 맞추기·`docId` 바꿔 쓰기·스토어별 충돌 규칙·한도·순서·미리보기·메모리)·6(화면 — 가져오기 몫)·7 표 9c-2 행·"9c-2 수용 기준"·공통·headless 방법·8 결정 표(권장안), 그리고 17-4-1 안의 `[정정 2026-11-17 — 9c-1 Build]` 줄들(9c-1 이 순수 `remapRecord`·`mergeRecord`·`lineSplitter`·`readHead` 를 이미 만들고 시험했다 — **다시 만들지 말고 쓴다**). 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9c2-import-report.md`.

## 읽을 것
- 위 spec, 9c-1 보고서 `.claude/tasks/medreader-build-9c1-export-report.md`, review.md 의 "9c-1 Review" 절(넘긴 것이 있으면 반영).
- `.claude/tasks/medreader-crossstep-notes.md` — "9c" 절, "8f-1 Review 에서 넘긴 것"의 9c 줄(단어 id 가 다르면 `term+targetLang` 으로도 맞춤, `suspended` 같은 내용 밖 필드), "9c (8c-2 Review)"(`capWarned` OR), **"9c-2 (18R-8)"**: `links.medical` 항목 `id` 꼴 검사(줄바꿈·제어 문자 — `ui/links.js` `cssId` 가 `"`·`\` 만 가림).
- **9c-1 보고서 "남은 문제" 4 — 9c-2 로 넘긴 것**: term 은 id 다음에 `term` 인덱스 + `targetLang` 으로 기기 항목을 찾고 겹침(dup)도 거기서 · documents 는 `db.patch` 의 함수 안에서 `mergeRecord` 를 다시 부름(적용 순간의 기기 값으로) · `links.medical` id 꼴 검사 · 힙은 9c-1 정정 ⑦ 의 두 기준(읽기 단계 ≤ +64MB, 남는 양 ≤ +4MB)으로. 그리고 남은 문제 1: `backup.howto` 안내 문구를 설계 6절 문구로 바꾼다(가져오기가 생겼으므로).
- **9c-1c 재검증(9c1cR) 낮음 — 이번에 함께(작음)**: `BACKUP.KEY_PATTERNS` `sk-` 경계에 Review 의 lookbehind 5개 추가(`\x22`·8진 `\012`·`%u0022`·이중 인코딩 `%2522`·QP `=3D` 뒤 — Review `r9c1c/fp.mjs` 에 시험안), Bearer 에 왼쪽 경계 `(?<![A-Za-z\-])`(`standard-bearer` 류 오탐). 정상 글 61개·CMDT 걸림 0 유지, K4b 에 줄 추가. 그리고 `lineSplitter` 줄 길이 상한(9c-1R #10 — 줄바꿈 없는 큰 파일).
- 8f-3b 의 데이터 안전 원칙(기기 데이터를 조용히 덮지 않음·`updatedAt` 뒤로 가지 않음·적용 순간 다시 읽기)을 가져오기 병합에도 지킨다.

## 할 일
설계 7 표 9c-2 행 그대로: 새 `js/backup/import.js`·`tests/backup-import-9c.test.mjs`(fake-idb 종단), 고칠 `js/ui/backup.js`(미리보기·진행·다시 불러오기)·i18n 4개(약 12키, ar·fr `[검토 — Nour·운영자]`). 흐름 읽기(`file.stream()` → gzip 이면 `DecompressionStream` → `TextDecoderStream`(엄격 — 깨진 UTF-8 은 거절·줄 단위 처리 중 어느 쪽인지 정해 보고) → `lineSplitter` → 500줄 트랜잭션). 끝나면 다시 불러오기. 가져오는 동안 화면 떠나기 확인. `db.js` 무변, DB 3·algoVersion·캐시 키·`PROMPT_VERSION` 불변. `backup/*` 는 `privacy/*`·`ai/*`·`ui/*` import 0.

## 검증
- "9c-2 수용 기준" 전부 — 특히 **두 프로필 종단**(A 내보내기 → 빈 B 가져오기 → PDF 다시 넣으면 p.3·같은 줄·번역 요청 0)과 **기기 B 에 같은 책이 다른 id** 경우(번역 요청 0 — 캐시 키 바꿔 쓰기), 멱등(같은 파일 두 번 = 한 번, 전 스토어 깊은 비교), 잘린 파일, `format: 2` 거절, 합성 150MB 가져오기 힙 +64MB 이하.
- 9c-1 이 만든 파일(스크래치 `b9c1/` — 읽기만)과 9c-1 Review 파일도 가져와 본다.
- 데이터 안전: 기기 쪽이 더 새로운 레코드(진도·단어·카드·필기)가 파일로 덮이지 않음, 복습 필드 불변, 지운 항목이 되살아나는 경우가 설계대로인지(병합만 — 지움 없음이니 "기기에서 지운 단어가 파일에 있으면 다시 생긴다"는 설계 결과 — 미리보기에 그 수를 보이는지 보고).
- 회귀: 9c-1 내보내기, 설정·서재·단어장, 번역 요청 본문 바이트 HEAD 와 같음.
- 변이 4개(설계 9c-2 끝) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b9c2/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless: Edge `--enable-precise-memory-info`, **프로필 둘**(새 `b9c2/pA`·`b9c2/pB`), pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(8000 쓰기만 또는 가로채기). 파일 넘기기는 `uploadFile` 로 스크래치 파일만. 콘솔 오류 0.
- spec 17-4-1 안 `[정정 2026-11-17 — 9c-2 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 7 표 9c-2 행의 파일 + `js/text/backup.js`(9c-1 순수 함수에 꼭 필요한 고침만 — 이유를 보고서에) + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b9c2/` + 보고서. `db.js`·`pipeline.js`·`library.js`(9c-3 몫)·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 쓸 스크래치 폴더는 먼저 만들 것. 의학책 읽기만(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` — 작은 합성 PDF 를 우선), Downloads 목록 보지 말 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
