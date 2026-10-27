# Review 지침 — 8g-7 아랍어 진료과 이름으로 장 찾기 (Nour R1)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8g-7 Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 19-1-4 전부(2-4 설계 뼈대·결정 N-D1–N-D3)와 이번 `[정정 2026-10-27 — 8g-7 Build]` 단락, 17-8(특히 17-8-6 폴백·17-8-9). 지침 `.claude/tasks/medreader-build-8g7.md`, Build 보고 `.claude/tasks/medreader-build-8g7-report.md`(남은 문제 1–8), Plan 보고 `.claude/tasks/medreader-plan-nour-1026-report.md` §3(사전 원본). 변경: `git diff` + 새 `js/text/specialty.js`·`tests/specialty-8g7.test.mjs`·`tests/fixtures/latin-view-8g7.*`. 비교 기준 커밋 `c6352a4`(그 뒤 `746eb56` 은 `.claude/tasks/` 만).

## 반드시 따질 것
1. **영어 검색 무변**: 라틴 검색어면 결과·화면·DOM 이 `c6352a4` 와 같은지 — Build 의 golden 이 HEAD 로 만들어졌는지 직접 확인(골든을 지금 코드로 만들었다면 무의미하다), 네 표본(세 권, Build 와 다른 검색어 20개 이상)으로 재현.
2. **틀린 장으로 가지 않음**: 사전 표제어·별칭이 Plan 표와 같은지(옮기며 빠지거나 바뀐 것), 아랍어 질의(네가 만든 것 포함 — 정관사 ال·접두 و/ب/ل·여성형·복수·쌍수·철자 변이 ة/ه·ى/ي·أ/إ/ا) × 세 권 실물 개요에서 **틀린 장 0**. 형용사꼴 어미 접기가 오탐을 만들지 않는지.
3. **켜짐 조건**: `scriptMismatch` 일 때만, `domain === 'general'` 이면 묶음·흐린 이름 없음, UI = 책 언어면 흐린 이름 없음. 한국어·프랑스어 UI·검색어도.
4. **Build 남은 문제 2–5 의견**(운영자 결정 재료): 어근 바뀌는 형용사꼴(كلوية 류), 짧은 검색어의 넓은 대응(فيروس → 여러 장), `general` 에서 [«الفهرس» 로] 단추, `scriptHint` 언어 이름이 네 UI 모두 바뀐 것(한국어 "English 원서" → "영어 원서").

## 확인할 것
5. 화면: 아랍어 UI 412×915·360×740 — "장" 묶음 맨 위, 줄 ≥ 48px, 가로 스크롤 0, 제목 `dir=ltr`, "사전으로 찾음" 줄, 누르면 그 장 첫 쪽, [«الفهرس» 로] 단추, 목차 탭 흐린 이름(RTL 정렬). **개요 없는 책(폴백 목차)** 하나로 브라우저 확인(Build 남은 문제 6 — 해커스 견본 등, 8m 보고서 경로 읽기만; 의학 domain 으로 둔 채).
6. headless Edge(새 프로필 3개까지, 프로필 복사 금지, 가짜 키). 회귀: 영어 검색·제목 묶음·결과 이동 뒤 [▶](8g), 목차 탭, 8d 블록, 띠, 8p 문체 메뉴. 콘솔 오류 0. 8000번 python 은 지금 **PID 45964**(Build 가 레포 루트에서 띄움) — 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
7. 너만의 변이 2개 이상(Build M1–M5 와 다른 것). 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8g7/bak/`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1374 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지. C: 남은 공간이 5GB 아래면 멈추고 보고. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g7/` 만. 띄운 Edge·node 정리. 금지: 커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드` 또는 `git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. 해커스 경로는 `.claude/tasks/medreader-build-8m-report.md`(읽기만). pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
