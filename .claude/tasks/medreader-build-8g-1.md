# Build 지침 — 8g-1 검색 데이터 단계 (DB 3 · 검색 글자 저장 · versionchange 배너)

> 너는 **Build 서브에이전트**다. 운영자가 spec **17-8-12** 를 승인했다(2026-10-18: G1 (가) 8g-1 먼저 배포 · G2–G5 (가) · 기술 결정 권장대로). Plan 은 커밋 `d568b8f`, 8i-2b 까지 푸시됨.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-1-report.md`.
> **화면 변화 없음** — 검색 화면·엔진·목차는 8g-2~4 다. 이번엔 데이터만.

## 읽을 것
- spec **17-8-12 전체**(특히 1절 U1–U14, 6절 Build 나누기의 **8g-1 줄**, 7절 수용 기준 **S1–S7**, 8절 테스트·변이 중 8g-1 몫, 9절 되돌림), 그리고 17-8-1~11
- Plan 보고 `.claude/tasks/medreader-plan-8g-report.md`, 측정 도구 `apps/medreader/dev/measure-search-8g.mjs`(Plan 이 쓴 `searchRecordOf` 등의 시제품 논리가 여기 있으면 옮길 원본)
- 코드: `js/db.js`, `js/pdf/extract.js`(`_buildAndStore`·`_loadStoredSet`), `js/ui/reader.js`(`describePage`·`flowParasOf`·`paraBlock`·`FOLD_ROLES`·`REF_ROLE`), `js/tts/text.js`(`joinPieces`·`localRange`), `js/main.js`(`blocked` 배너), `js/settings.js`, `js/config.js`, `js/i18n/*`, `tests/fixtures/fake-idb.mjs`, `tests/importmap.test.mjs`, `dev/stamp-importmap.mjs`

## 할 일 — 두 단계, 상태를 따로 남긴다
**단계 1 — `text/screen.js` 옮김만 (spec 6절: "다른 줄을 한 줄도 바꾸지 않는" 커밋)**
1. `describePage`·`flowParasOf`·`paraBlock`·`FOLD_ROLES`·`REF_ROLE`(ui/reader.js)과 `joinPieces`·`localRange`(tts/text.js)를 새 순수 모듈 `js/text/screen.js` 로 **옮기기만** 한다. 원래 두 파일은 **다시 export**(같은 함수 객체). 함수 본문은 한 글자도 바꾸지 않는다(import 줄 정리만).
2. stamp 다시 찍기, 전체 테스트 녹색, S3 확인(같은 함수 객체 · `document`/`window`/`indexedDB`/`fetch` 참조 없음 grep).
3. **이 시점의 변경 파일 전부를 스크래치패드 `b8g1/step1/` 에 복사**하고, 보고서에 "단계 1 끝 파일 목록 + 테스트 수"를 적는다. 오케스트레이터가 이것을 별도 커밋으로 나눈다.

**단계 2 — 데이터**
4. `js/text/search.js`(순수): `searchRecordOf(F, desc?)`·`foldText`·`parseQuery`·`findIn`·`classifyHit`·`snippetAt`·`rangesFor`·`headingToc` — spec 대로(합성어 변형 U7, 일반 소제목 강등 U8, 폴백 숫자 붙이기 U11, rowhead·cite 포함 · ref·colhead·접힌 줄 제외, G4).
5. `config.js` `SEARCH`(ENABLED·VERSION·상한 등 spec 이름대로), `db.js` `DB_VERSION 3`·`searchText` 스토어·`MIGRATIONS[3]`·`CASCADE_STORES`·`DERIVED_STORES`(U1–U3). **버전 내림 방지**.
6. `pdf/extract.js` `_buildAndStore` 가 `pages` + `searchText` 를 **한 트랜잭션**으로. `sk = SEARCH.VERSION|DERIVED_HASH` 경첩(U4). 재추출 중 백필은 지금 algoVersion 쪽만(U-항목대로). 쪽 라벨(`pageLabels`)·개요 저장이 spec 상 8g-1 몫이면 여기서.
7. `main.js` `versionchange` → 연결 닫힘 배너 + [다시 불러오기], i18n `err.dbUpgraded` **네 언어 모두**(ko·en·ar·fr — 실제 언어 목록은 코드로 확인).
8. `settings.js` `search.recent`.
9. `tests/fixtures/fake-idb.mjs` 보강(`getAll`·범위 키·인덱스 `getAllKeys(range)`).
10. 테스트(S1–S7 + spec 8절의 8g-1 몫), stamp, `--check` 0.

## 검증
- spec 8절 변이 중 8g-1 몫 → 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g1/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회.
- 세 권(앱 모듈 + 이 기계의 pdfjs-dist 5.6.205 — 경로는 `.claude/tasks/medreader-build-8i-2-report.md`)으로: `searchText` 크기(Plan 실측 ±5% 안), 저장 글자 = 화면 글자(쪽마다 `joinPieces` 결과와 같음), `pages` 저장본은 **바이트 그대로**(검색 글자 추가 외에 추출 결과가 바뀌면 안 된다 — algoVersion 12 그대로).
- **DB 업그레이드는 headless 브라우저로 한 번**: DB 2 상태(현재 `main` 앱으로 만든 새 프로필)에서 새 앱으로 열어 3 으로 오르는지, 기존 문서·번역 캐시·진행 위치가 남는지, 두 탭(옛 탭 열린 채 새 탭)에서 옛 탭에 배너가 뜨는지. 8000번 서버(`python -m http.server`)가 없으면 레포 루트에서 띄우고 켜 둔다. 프로필 복사본은 모두 합쳐 2개까지(새로 만든 프로필 포함). 진짜 API 키 금지.
- **모든 실행에 시간 상한**(`timeout`, `--test-timeout`). 띄운 Edge·node 정리, 못 끄면 PID 보고.

## 수정 범위
`js/text/screen.js`(새)·`js/text/search.js`(새), `js/ui/reader.js`·`js/tts/text.js`(옮김·다시 export 만), `js/config.js`, `js/db.js`, `js/pdf/extract.js`, `js/main.js`, `js/settings.js`, `js/i18n/*`(새 키), `tests/`(새 테스트·fake-idb), `index.html`(stamp 로만), 스크래치패드 `b8g1/`, 보고서. spec·review 는 건드리지 않는다(spec 에 고칠 것이 보이면 보고서에 문안으로).

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
