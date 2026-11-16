# Build 지침 — 8c-1 탭 번역 · 선택 동작 줄

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-7-6 "8c + 8f Build 설계"** 중 8c-1 몫 전부 — 1(코드 사실)·2·3(손짓 최종 표)·4-1(탭 번역)·4-2(선택 동작 줄)·5 표의 8c-1 행·6(호출)·7(i18n 8c-1 키)·8(수용 기준 "8c-1")·9(headless)·10(결정 표 — 권장안)·12(실기기 묶음 — 적기만). 운영자 위임(2026-11-15): 권장안으로 끝까지 — 결정 표의 "운영자에게 물을 것"(8cf-Q1–Q3)은 **설계가 적은 기본값대로** 하고 묻지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8c1-taptr-report.md`.

## 읽을 것
- spec 17-7-6(위 항목), 17-7-1~5(배경), 7-7(띠·낭독 문장), 8d(`inlinetr`)·8e(가로 dock·`[≡]`·`data-chrome`)·9a(핸즈프리)·9b(음성 명령) 소절 중 `controls.js`·`trband.js`·`reader.js` 를 건드린 곳.
- `.claude/tasks/medreader-crossstep-notes.md` — **"8c-1" 절 세 줄을 반드시 반영**: ① 선택 줄은 "보이는 3칸 + `[⋯]`"로 바꾸기 쉽게(11 이 [설명]·`[⋯]` 안 요약·여기서부터 읽기·검색을 얹는다 — 지금은 설계대로 단추를 두되 배열·렌더를 목록 데이터로), ② 띠 머리 줄 끝에 단추 칸 둘(`[×]` + 12 의 `[☆]` 자리), ③ 문장 아래 표시(8d)일 때 탭 번역은 띠, 여는 동안 `data-tr-inline` 떼기.
- 설계 1절의 파일:행은 2026-11-16 작업 트리 기준이다 — 그 뒤 8n(`0e2b1e4`)·8g-6 이 배포됐다. 행이 어긋나면 지금 코드에 맞추고, 설계와 다르게 해야 하면 spec 17-7-6 안 `[정정 2026-11-16 — 8c-1 Build]` 줄로(Edit 로 그 자리만).

## 할 일
설계 5 표 8c-1 행 그대로: 새 `js/ui/selbar.js`·`js/text/select.js`·`tests/taptr-8c.test.mjs`, 고칠 `controls.js`·`ai/readalong.js`(`tapGate`·`requestTap`)·`tts/speaker.js`(`sentenceUnits`)·`ui/trband.js`(탭 모드)·`ui/inlinetr.js`(`suspend`)·`ui/reader.js`(`isTap` 등)·`ui/original.js`·`index.html`·`css/reader.css`·i18n 4개. `[단어 번역]` 은 마크업만 두고 `hidden`(8f-2 가 켠다). 번역 요청 바이트·캐시 키·`PROMPT_VERSION`·DB·algoVersion 불변 — 탭 번역은 **이미 있는 readalong 요청·캐시**를 쓴다(새 요청 꼴 금지). 8e 가로 화면(dock·`[≡]`)·9a 잠금 화면·9b 음성 명령·8d 문장 아래 표시와 함께 동작.

## 검증
- 수용 기준 "8c-1" 전부(`[N]` 은 테스트로, `[D]` 는 headless 로, `[M]` 은 보고서 실기기 목록에).
- 회귀: 낭독 중 띠(7-7)·8d 문장 아래 표시·8e 가로·9a·9b 기존 테스트 그대로 통과(기존 테스트를 고쳐야 하면 이유를 보고서에). 번역 요청 본문 바이트가 HEAD 와 같음(흉내 Gemini 로 요청 본문 비교).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회. `node apps/medreader/dev/stamp-importmap.mjs` 다시, `--check` 0, `git diff --check` 0.
- headless Edge(412×915 세로 + 915×412 가로, ko·ar UI, 새 프로필 `b8c1/p1`, pipe, 가짜 키, 흉내 Gemini — OPTIONS 204 + CORS, 흉내 음성): 줄 탭 → 띠에 그 문장 번역(캐시 있으면 호출 0, 없으면 요청 1), `[×]`·다른 줄 탭·[▶]·쪽 넘김으로 닫힘, `[문단 전체]`, 길게 눌러 선택 → 선택 줄(그때 탭 번역·줄 이동 없음), 8d 켬 상태에서 탭, 가로 dock 에서 띠·선택 줄이 가리지 않음, 원본 보기에서 탭, 가로 넘침 0, 콘솔 오류 0. 스크린샷 4–6장 `b8c1/shots/`.
- 변이 3개 이상(설계 9·수용 기준이 적은 것 우선 — 예: `tapGate` 순서 바꾸기, `isTap` 문턱 450→0, 띠 닫기 조건 하나 빼기, `suspend` 안 부르기) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8c1/bak/`).

## 수정 범위
설계 5 표 8c-1 행의 파일 + `index.html`(stamp 포함) + `tests/` + `spec.md`(17-7-6 정정 줄) + 스크래치패드 `b8c1/` + 보고서. 그 밖(특히 `js/text/search.js`·`lang.js`·`segment.js`·review.md·`dev/`) 금지. `dev/measure-table-8i4.mjs`(추적 안 됨)는 다른 단계 것 — 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만**(백업·복사·확인도 각각 따로 — 앞 Build 들이 묶어서 어겼다). 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지. 시험 스크립트는 `try { … } finally { await browser.close() }`(pipe), 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름). 8000 python 쓰기만, 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 의학책(읽기만, Downloads 목록 보지 말 것): `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
