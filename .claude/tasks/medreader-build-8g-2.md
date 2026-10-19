# Build 지침 — 8g-2 검색 엔진 (`js/search/engine.js`)

> 너는 **Build 서브에이전트**다. spec **17-8-12** 승인(2026-10-18 G1–G5). 8g-1(데이터)은 커밋·푸시됨(`963e7ad`·`9d55ac3`). 8g-2~4 는 **함께 배포**하므로 이번엔 만들기만 한다.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-2-report.md`.
> **화면 변화 없음** — 검색 화면(8g-4)·목차(8g-3)는 다음 단계. 엔진을 앱에 연결하는 최소 배선(추출기 이벤트 → `notePage`, 다시 추출 → `invalidate`)이 spec 상 8g-2 몫이면 넣되 사용자에게 보이는 것은 없어야 한다.

## 읽을 것
- spec **17-8-12** 전체 — 특히 6절 Build 나누기의 **8g-2 줄**, 7절 수용 기준 **S8–S15**, 8절 변이 중 8g-2 몫(V11·V12 등), 9절 되돌림, 2절 실측(검색 시간·백필 수치)
- `review.md` 끝 **"8g-1 Review"** — 8g-2 Build 에 넣기로 한 **테스트 보강 3건**: ① `SEARCH.ENABLED=false` 일 때 옛 검색 글자를 지우는 길을 실제로 묶는 테스트(지금은 소스에 이름만 보는 검사) ② 3자 낱말 전체 맞춤 경계(`<=3`)·대문자 약어 상한(5) **경계값 테스트** ③ S6 versionchange 테스트에 **짧은 시간 상한**(연결을 안 닫는 변이가 60초 시간 초과로만 잡히던 것)
- 8g-1 보고서 `.claude/tasks/medreader-build-8g-1-report.md`, 8g Plan 보고 `.claude/tasks/medreader-plan-8g-report.md`
- 코드: `js/text/search.js`(순수 함수 — 엔진이 쓴다), `js/text/screen.js`, `js/db.js`(`searchText` 스토어·인덱스 `docId`·`docId_sk`), `js/pdf/extract.js`(`writePageAndSearch`·`page` 이벤트·`_loadStoredSet`·algoVersion), `js/config.js`(`SEARCH`), `dev/measure-search-8g.mjs`(시제품 — `--app` 모드가 있으면 앱 함수와 비교)

## 할 일
1. `js/search/engine.js`(새): 백필(지금 algoVersion 의 `pages` 중 `searchText` 가 없거나 `sk` 가 다른 쪽만 만든다 — S9), 열린 책 메모리 캐시, `searchDoc`·`searchLibrary`, 세대 취소(S11), 상한 1,000·`truncated`, 묶음 head → body → table(S12), `notePage`/`invalidate`(S13), 부분 추출(S10). spec 의 이름·모양 그대로. DOM·`window` 참조 없음(서비스 계층 — spec 3-2 계층 규칙 확인).
2. 최소 배선: 추출기 `page` 이벤트 → `notePage`, [텍스트 다시 추출]·재추출 → `invalidate`. 사용자에게 보이는 변화 0.
3. 테스트 S8–S13 + 8g-1 Review 보강 3건. `tests/fixtures/fake-idb.mjs` 가 실제 IndexedDB 보다 관대한 점(키 한 칸 undefined 허용 — 8g-1 Review 정보 4)을 이용해 헛통과하지 않게 주의.
4. `dev/measure-search-8g.mjs` 에 앱 엔진 비교(S14): 세 권에서 시제품 규칙과 앱 함수의 적중·쪽·묶음 차이 0, 결과 쪽 다시 찾기 불일치 0. 검색 시간(Node) 기록 — Plan 2절 수치와 비교.
5. `node apps/medreader/dev/stamp-importmap.mjs`, `--check` 0.

## 검증
- spec 8절 변이 중 8g-2 몫 + 보강 3건에 대응하는 변이 → 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g2/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1103 + 새 테스트).
- S15(데스크톱 Chrome 실측)는 화면이 없으니 이번엔 **Node 측정으로 대신** 하고, 브라우저 실측은 8g-4 Review 몫으로 보고서에 남긴다.
- pdf.js 는 이 기계의 pdfjs-dist 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. npm 설치·다운로드 금지.
- **모든 실행에 시간 상한**(`timeout`, `--test-timeout`). 띄운 node 정리, 못 끄면 PID 보고. 브라우저·프로필 없음.

## 수정 범위
`js/search/engine.js`(새), 배선에 필요한 최소 줄(`js/pdf/extract.js`·`js/ui/*` 중 spec 이 정한 곳), `js/text/search.js`(엔진에 필요한 순수 함수 보강만 — 기존 함수 동작 불변), `tests/`(새 테스트·보강), `dev/measure-search-8g.mjs`(앱 비교 모드), `index.html`(stamp 로만), 스크래치패드 `b8g2/`, 보고서. spec·review 는 건드리지 않는다(고칠 것은 보고서에 문안으로).

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
