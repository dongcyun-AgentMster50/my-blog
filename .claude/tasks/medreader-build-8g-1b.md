# Build 지침 — 8g-1 마무리 (작업 트리 점검 · 남은 측정 · 브라우저 DB 업그레이드 확인 · 보고서)

> 너는 **Build 서브에이전트**다. 원래 지침은 `.claude/tasks/medreader-build-8g-1.md` — 먼저 읽어라.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-1-report.md`(새로 쓴다).

## 무슨 일이 있었나
첫 8g-1 Build 가 단계 1·2 코드와 테스트를 끝냈다(전체 1100/1100 × 2, 변이 12개 빨강). 그런데 **같은 세션의 포크가 실수로 같은 작업을 약 5분 동시에 재개**했다가 멈췄다(22:0x 무렵). 포크는 스크래치패드 `b8g1/` 의 `mutate.mjs`·`mutate.log`·`measure-8g1.mjs` 를 덮어썼고, 변이를 걸었다 되돌렸으며, CMDT 측정과 `browser-upgrade.mjs` 작성을 하다 멈췄다. 첫 Build 는 충돌을 피하려고 아래를 남기고 멈췄다:
- CMDT 2026·2021 측정, headless 브라우저 DB 업그레이드·두 탭 확인, 보고서.

첫 Build 의 요약(오케스트레이터가 받은 것):
- 단계 1 스냅숏: 스크래치패드 `b8g1/step1/`(sha256 은 `b8g1/step1-sha.txt`), 끝 파일 6개 — `js/text/screen.js`(새), `js/ui/reader.js`, `js/tts/text.js`, `index.html`, `tests/split-contract-8a.test.mjs`, `tests/search-text-8g.test.mjs`(S3 두 개만). 그때 1071/1071.
- 단계 2: `js/text/search.js`(새), `config.js` `SEARCH`, `db.js` v3·`searchText`·`MIGRATIONS[3]`·`CASCADE/DERIVED`·`ERR.UPGRADED`, `extract.js` `writePageAndSearch`(한 트랜잭션), `main.js` versionchange 배너, i18n `err.dbUpgraded` + **spec 에 없는 `common.reload` ×4**, `settings.js` `search.recent`, `fake-idb.mjs` 보강, 기존 테스트 수정(db D1·D2, docs-patch DP13, reextract RX1·RX3, split-contract-8a), 새 테스트 `search-text-8g`(20)·`search-db-8g`(11). 1100/1100.
- Harrison 측정: searchText 5.65MB(Plan +0.2%), 저장 글자 = 화면 글자 729쪽 전부, `pages` 는 **값 기준** HEAD 와 같음(v8 직렬화 바이트는 같은 모듈로도 갈림 → 값 비교로 판정).
- spec 문안 제안 두 개: S6 "옛 판 탭" → "8g-1 이후 판 탭"(8g-1 이전 탭엔 배너 코드가 없다), §4-6 i18n 키 수 38 → 39.

## 할 일
1. **작업 트리 점검(가장 먼저)**: 포크가 섞어 놓은 것이 없는지. `git status`·`git diff` 의 파일 목록이 위 요약과 정확히 같은지, 예상 밖 파일·줄이 없는지. 변이 표식(`MUT`·`/*V` 등)이 남지 않았는지 grep. 단계 1 스냅숏과 지금 `screen.js` 등을 비교해 단계 1 이후 바뀐 것이 단계 2 요약과 맞는지. 전체 테스트 2회(1100 기대), `stamp --check` 0. **이상이 있으면 고치지 말고 멈춰서 보고**한다.
2. **남은 측정**: CMDT 2026·2021 — Harrison 과 같은 항목(searchText 크기 vs Plan, 저장 글자 = 화면 글자 전 쪽, `pages` 값 기준 HEAD 와 같음). 포크가 남긴 `b8g1/m-c2*.json`·`x-*.json` 은 믿지 말고 **새 스크래치 폴더 `b8g1b/`** 에서 네 스크립트로 다시 잰다. pdf.js 는 이 기계의 pdfjs-dist 5.6.205(경로는 `.claude/tasks/medreader-build-8i-2-report.md`).
3. **변이 재확인**: 포크가 변이 로그를 덮어썼으니, 원래 지침의 8g-1 몫 변이 중 적어도 V1·V5·V7·V13·V14 를 다시 걸어 빨강 → 복원 → `cmp`. 백업 `b8g1b/bak/`.
4. **headless 브라우저(Edge · 412px · 캐시 끔)**: DB 2 상태(커밋 `165f2b9` 의 앱 — `git show` 로 `apps/medreader` 를 스크래치패드 `b8g1b/old-app/` 에 꺼내 다른 경로로 서빙하거나, 같은 출처에서 열어야 IndexedDB 를 공유한다는 점에 주의 — 같은 출처 `http://127.0.0.1:8000` 에서 옛 판 경로와 새 판 경로를 나란히 두는 방법 등)로 문서를 하나 넣은 뒤 새 앱으로 열어 3 으로 오르는지, 기존 문서·번역 캐시·진행 위치가 남는지, 새 쪽 추출 때 `searchText` 가 쓰이는지. 두 탭: **새 판 탭 둘**에서 DB 버전을 강제로 올리는 시험(가짜 4)으로 배너가 뜨는지(옛 판 탭엔 배너 코드가 없다 — S6 문안). 8000번 서버(`python -m http.server`)가 떠 있으면 쓰고 끄지 마라. 프로필은 새로 만든 것만, 모두 합쳐 2개까지. 진짜 API 키 금지. 포크가 쓴 `b8g1/browser-upgrade.mjs` 는 참고만.
5. 보고서: 첫 Build 요약 + 위 결과를 합쳐 하나로. spec 문안 제안(S6, 키 수)은 보고서에 그대로 둔다.

## 실행 규칙
모든 실행에 시간 상한(`timeout`, `--test-timeout`). 띄운 Edge·node 정리, 못 끄면 PID 보고. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드의 옛 `b8g1/` 은 읽기만.

## 수정 범위
**앱 코드·테스트는 고치지 않는다**(변이는 되돌린다). 점검에서 문제가 보이면 보고만. 쓰는 곳: 스크래치패드 `b8g1b/`, 보고서.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
