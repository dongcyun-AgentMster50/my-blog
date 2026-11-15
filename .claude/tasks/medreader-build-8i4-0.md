# Build 지침 — 8i-4-0 일반 다열 텍스트 표: 정답표 + 측정 (앱 무변)

> 너는 **Build 서브에이전트**다. 근거: 14 Plan 초안 `.claude/tasks/medreader-plan-14-spec-draft.md`(새 소절 4-14 — 8i-4-0 부분) · 보고서 `.claude/tasks/medreader-plan-14-report.md`(측정 (b)·결함 갈래·문턱). 운영자 위임(2026-11-15): 권장안으로 진행 — 14-D2 "8i-4 는 측정 Build 먼저". **앱 무변**: `apps/medreader/js/`·`css/`·`index.html`·`tests/` 기존 파일을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8i4-0-report.md`.

## 할 일
1. **정답표 55띠**: 세 의학책(CMDT 2026·Harrison 중심, 색인 쪽 제외)에서 4-13 7b 띠 후보와 Plan 이 본 결함 갈래(표 안 넓은 줄로 띠 끊김·위첨자 머리 행·좁은 통로로 붙은 두 칸·하위 행)를 고루 담게 뽑는다(시드 고정, 뽑는 규칙을 보고서에). 띠마다 표 여부·행 묶음·칸 경계·머리 행을 **네가 PNG 를 보고 판정**해 JSON 으로 — 원서 글은 40자 넘게 옮기지 말고 줄 id·좌표·짧은 머리 글자만. **절반은 시험용으로 따로 두고**(규칙 다듬기에 쓰지 않음) 어느 것인지 기록.
2. **측정 도구** `apps/medreader/dev/measure-table-8i4.mjs`(새 파일 하나 — dev 만): Plan 시제품 규칙("행 머리 → 칸 머리")을 정답표에 돌려 표 판정·"표 아님" 오탐·행·칸·머리 정확도를 낸다. 규칙 개선은 다듬기용 절반에서만, 최종 숫자는 시험용 절반에서.
3. **판정**: 문턱(표 판정 ≥ 95% · 표 아님 쪽 오탐 0 · 행 ≥ 95% · 칸 ≥ 95% · 머리 ≥ 90%)을 시험용 절반에서 넘는지. 넘으면 8i-4a·8i-4b 로 갈 규칙 초안(상수·단계), 못 넘으면 무엇이 모자란지와 "8q 단독으로 algoVersion 13" 권장.

## 규칙
측정 스크립트는 시간 상한(하나 10분 이내 — 큰 책은 나눠서), 결과는 stdout·파일. 정답표·PNG 는 스크래치패드 `b8i40/` 에(레포에는 측정 도구 하나와 보고서만 — 정답표 JSON 을 레포에 둘지는 보고서에 의견만, 원서 글이 들어가면 두지 않는다). headless 가 필요하면 `try { … } finally { await browser.close() }`. **명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지.** 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름을 써라). 같은 작업 트리에서 8e Review 와 Plan 에이전트가 돈다 — 앱 파일·spec·review.md·다른 초안은 건드리지 마라. 서버 건드리지 마라(8000 은 쓰기만). 진짜 API 키 금지. 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 14 Plan 측정 스크립트 `p14/`(스크래치패드 — 읽기만, 재사용 가능).
