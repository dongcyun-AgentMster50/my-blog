# Review 지침 — 8g-1 검색 데이터 단계 (text/screen.js 옮김 · DB 3 · searchText · versionchange 배너)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **맨 끝**에 **"8g-1 Review"** 절로 덧붙인다. 앞 절은 고치지 않는다.

## 읽을 것
- spec **17-8-12**(1절 U1–U14, 6절 8g-1 줄, 7절 S1–S7, 8절 변이, 9절 되돌림, 10절 못 함), 17-8-1~11
- 지침 `.claude/tasks/medreader-build-8g-1.md`·`-8g-1b.md`, Build 보고 `.claude/tasks/medreader-build-8g-1-report.md`
- 변경: `git diff`(18개 파일) + 새 `js/text/screen.js`·`js/text/search.js`·`tests/search-text-8g.test.mjs`·`tests/search-db-8g.test.mjs`. 직전 커밋 `165f2b9`. 단계 1 스냅숏: 스크래치패드 `b8g1/step1/`(sha256 `b8g1/step1-sha.txt`).
- 배경: 이 Build 도중 같은 세션의 포크가 약 5분 같은 작업을 동시에 했다가 멈췄다. 마무리 Build 가 작업 트리를 점검해 섞인 것이 없다고 보고했다 — **너도 독립적으로 확인한다.**

## 확인할 것
1. **단계 1 = 옮김만인가**: `b8g1/step1/` 의 `screen.js`·`reader.js`·`tts/text.js` 를 `165f2b9` 판과 비교해, 옮긴 함수 본문이 **한 글자도 바뀌지 않았는지**(정렬 비교 · 함수별 비교), 다시 export 가 같은 함수 객체인지, `screen.js` 가 `document`·`window`·`indexedDB`·`fetch` 를 참조하지 않는지. `split-contract-8a` 테스트 수정이 검사 내용을 약하게 하지 않았는지. 단계 1 스냅숏만으로 전체 테스트가 녹색인지(스크래치패드에 레포 사본을 만들어 돌려도 된다).
2. **spec 대로인가**: `search.js` 여덟 함수, U7 합성어·U8 소제목 강등·U11 숫자 붙이기, 검색 대상(rowhead·cite 포함 · ref·colhead·접힌 줄 제외 — G4), `config.SEARCH`, `db.js` v3·`MIGRATIONS[3]`·`CASCADE/DERIVED`·**버전 내림 방지**, `extract.js` 한 트랜잭션(`pages`+`searchText`)·`sk = SEARCH.VERSION|DERIVED_HASH`·`SEARCH.ENABLED=false` 길, `main.js` versionchange 배너, i18n 네 언어(+ spec 에 없는 `common.reload` — 적절한지), `settings.js` `search.recent`.
3. **코드 문제**: 트랜잭션 실패 시 `pages` 만 써지는 갈래가 없는지, `_recomputeRoles` 경로, 재추출·[텍스트 다시 추출](`resetDerived`)과 `searchText` 의 일관성, `sk` 무효화, 마이그레이션 멱등(2→3 두 번), 빈 검색어·합성어 변형의 경계, `fake-idb` 보강이 실제 IndexedDB 의미와 다르게 관대해 테스트가 헛통과할 여지.
4. **측정 재현(네 스크립트)**: 세 권 중 **최소 한 권(CMDT 2026)** 을 `165f2b9` 와 작업 트리로 뽑아 `pages` 값 비교 0, `searchText` 크기 Plan ±1%, 저장 글자 = 화면 글자 전 쪽. pdf.js 는 이 기계의 pdfjs-dist 5.6.205(경로는 `.claude/tasks/medreader-build-8i-2-report.md`). 값 비교로 판정(v8 직렬화 바이트는 불안정하다는 Build 관찰 — 맞는지도 한 번 확인).
5. **브라우저(Edge headless · 412px · 캐시 끔 · 127.0.0.1:8000 — PID 45124 python 서버가 있으면 쓰고 끄지 마라)**: DB 2(165f2b9 판) → 3 업그레이드 후 문서·번역 캐시·진행 위치 유지, 새 쪽 추출 때 `searchText` 기록, 새 판 두 탭 가짜 버전 올림 → 배너·[다시 불러오기]·아랍어 RTL. Build 스크립트(`b8g1b/`)는 참고만, 판정 코드는 직접. 프로필은 새로 만든 것만 2개까지.
6. **테스트의 힘**: 너만의 변이 3개 이상(Build 가 안 한 곳 — 예: 트랜잭션 분리, 버전 내림 방지 제거, `sk` 비교 제거, 검색 대상에 ref 포함) → 빨강 확인 → 복원 → `cmp`. 백업 `r8g1b/bak/`.
7. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1100 기대), `stamp --check` 0.
8. Build 의 spec 문안 제안 두 개(S6 "8g-1 이후 판 탭", §4-6 키 수 38→39)가 맞는지 판정.

## 실행 규칙
모든 실행에 시간 상한(`timeout` · `--test-timeout`). 띄운 Edge·node 정리, 끝에 `tasklist` 확인, 못 끄면 PID 보고. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 새 폴더 `r8g1b/` 만 쓴다(첫 Review 가 PC 종료로 중단돼 `r8g1/` 에 반쯤 된 결과가 있다 — 무시).

## 수정 범위
**앱 코드·테스트·spec 은 고치지 않는다**(변이는 되돌린다). 쓰는 곳: review.md 끝 절, 스크래치패드 `r8g1b/`.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
