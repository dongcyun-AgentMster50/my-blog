# Build 지침 — 8g-6 검색: CJK·한국어 조사 (F7)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **19-1-3 §8 "8g-6 — 검색: CJK·한국어 조사"** 표 전부 + "Build 첫 단계에서 잴 것" + 수용 기준 뼈대(L-D 승인 2026-10-19, 운영자 위임 2026-11-15: 권장안으로 끝까지). 직전: 8n(스페인어)이 같은 작업 트리에 아직 커밋 전일 수 있다 — `git status` 로 보고 그 파일들(`text/lang.js`·`segment.js`·`config.js`·i18n·`settings.js`·`ui/settings.js`·8n 테스트)은 **건드리지 마라.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8g6-search-cjk-report.md`.

## 읽을 것
spec 19-1-3 §8, 17-8-4(길이 보존·3자 이하 낱말 전체 일치), 17-8-12(측정 스크립트), 8g-7 진료과 사전(`text/specialty.js` — 검색 함수를 부르는지), `.claude/tasks/medreader-crossstep-notes.md`(이 단계 줄은 없음 — 순서만 확인).

## 설계 뒤 바뀐 것 — 맞춰라
8g-7(진료과 사전 `specialty.js` 가 `foldText`·`parseQuery`·`findIn` 을 쓰면 아랍어·라틴 결과 불변을 테스트로), 8m(혼합 문서 — 한글 문장과 라틴 문장이 한 문서에 섞임: 한글 규칙은 **검색어 글자**로만 정한다, 문서 언어로 정하지 않는다), 8n(es — 라틴 규칙 그대로). 바꿀 것이 생기면 spec 19-1-3 §8 안 `[정정 2026-11-16 — 8g-6 Build]` 줄로.

## 할 일
1. **먼저 잴 것**(설계 그대로): 세 의학책의 `U+FF01–FF5E`·`U+3000` 개수, 그리고 `dev/measure-search-8g.mjs` 기존 검색어 묶음의 결과 수 — **HEAD 와 8g-6 판이 하나도 다르지 않아야** 한다(라틴 경로 불변). dev 스크립트는 고치지 말고, 필요하면 스크래치패드 `b8g6/` 에 복사해 import 경로만 바꿔 돌려라. HEAD 판은 `git show`·`git archive` 로 스크래치패드에.
2. `text/search.js` — 표 그대로: 한글로 끝나는 검색어는 뒤 경계 열기(앞 경계 그대로), 한자·가나로 시작/끝나면 그쪽 경계 검사 생략, 최소 길이 한자·가나 1자 허용(한글 1자는 그대로 짧음), 전각→반각 1:1 치환(`U+FF01–FF5E` → `U+0021–007E`, `U+3000` → 공백 — NFKC 쓰지 마라). 저장 레코드·`SEARCH.VERSION`·`searchKey`·백필·DB 불변(접기는 읽을 때 메모리). `derivedHash` 같은 것이 검색 함수 내용에 묶여 있다면 그 결과가 바뀌는지 확인해 보고(바뀌면 재색인이 일어나는지 — 일어나면 멈추고 보고).
3. 짧음 오류 문구 등 i18n 이 바뀌어야 하면 이 단계에서 하지 말고 보고서에만(8n 이 i18n 을 쥐고 있을 수 있다). 지금 문구로 맞으면 그대로.
4. 테스트: 새 `tests/search-cjk-8g6.test.mjs` — 수용 기준 `[N]` 전부(`학교`→"학교에"·"학교는" 적중, "대학교" 아님 · `学校` 가 `我们学校很大` 안에서 적중 · `学` 1자 허용, `학` 1자 짧음 · `ＡＢＣ`↔`abc` · `　`(U+3000) ↔ 공백 · 무작위 유니코드 길이 보존 · 라틴 3자 이하 낱말 전체 일치·4자 접두·약어 대소문자 그대로 · 아랍어 검색 그대로). 기존 검색 테스트는 하나도 고치지 않고 통과해야 한다(고쳐야 하면 왜인지 보고서에).
5. 브라우저(headless Edge, 412×915, 새 프로필 `b8g6/p1`·새 포트, 가짜 키): 한글 견본 PDF(해커스 견본 — 8m 보고서 경로, 읽기만 — 또는 스크래치패드에서 만든 저작권 없는 한글·한자 PDF)를 가져와 검색 화면에서 `학교`류 조사 적중·하이라이트 위치가 맞는지, 의학책(CMDT 2026) 라틴 검색 결과 수가 HEAD 와 같은지, ko·ar UI, 콘솔 오류 0. 스크린샷 2–3장 `b8g6/shots/`.
6. 변이 2개 이상(한글 뒤 경계를 다시 닫기 → 빨강, 전각 치환을 NFKC 로 → 길이 보존 빨강, 한자 1자 허용 끄기 → 빨강) → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8g6/bak/`).
7. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회. `node apps/medreader/dev/stamp-importmap.mjs` 다시, `--check` 0, `git diff --check` 0.
8. 보고서: 잰 숫자(전각 수, 기존 검색어 결과 수 비교 표), 바꾼 것, 테스트 수, 변이 표, headless 결과, 한계(붙여 쓴 합성어 앞 경계·한자 부분 일치 오탐 가능성), spec 정정 줄.

## 수정 범위
`js/text/search.js`(필요하면 검색 화면 `js/ui/` 의 검색 파일 — 꼭 필요한 곳만, 보고서에 이유), `tests/` 새 파일, `index.html`(stamp), `spec.md`(19-1-3 §8 정정 줄 — **Edit 도구로 그 한 줄만**, 파일 통째 쓰기 금지), 스크래치패드 `b8g6/`, 보고서. DB·algoVersion·`SEARCH.VERSION`·캐시 키·`PROMPT_VERSION` 불변. review.md·`dev/` 금지.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지. 시험 스크립트는 `try { … } finally { await browser.close() }`(가능하면 pipe), 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름). 8000 python 은 쓰기만, 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지(흉내 Gemini 는 OPTIONS·CORS 응답 포함). 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`(읽기만, Downloads 폴더 목록 보지 말 것).

## 금지
커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
