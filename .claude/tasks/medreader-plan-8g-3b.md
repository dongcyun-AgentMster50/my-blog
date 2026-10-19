# Plan 지침 — 8g-3b 폴백 목차 품질 · 쓰레기 개요 판정

> 너는 **Plan 서브에이전트**다. 앱 코드를 고치지 않는다. 결과는 `apps/medreader/spec.md` **17-8-12** 끝에 새 소절 **"11. 8g-3b 폴백 목차 품질·쓰레기 개요"** 로 쓴다(기존 소절은 고치지 않는다 — 17-8-12 §3 "폴백은 실제로 쓰이지 않는다"의 정정은 새 소절에서 "§3 정정"으로). 요약은 `.claude/tasks/medreader-plan-8g-3b-report.md`. **커밋하지 않는다.** 한국어. 결정이 필요한 곳은 선택지와 권장안.

## 배경 (review.md 끝 "8g-3 Review" 절 — 반드시 읽는다)
- 운영자가 2026-10-19 자기 어학 교재를 PC 에서 OCR 했다(`D:/OCR/01_English/` 아래 ` [OCR].pdf` 약 92개). 8g-3 Review 가 그중 32권을 보니 **개요 없음 23 · 쓰레기 개요 6 · 진짜 개요 3** → 폴백 목차가 **주 경로**(29/32).
- **쓰레기 개요**: 스캐너가 쪽마다 붙인 파일 이름(`SAVE###.JPG` ×299, `###.bmp` ×201, `###.tif` ×163, `###.jpg` ×72, `Untitled-#.jpg` ×26).
- **폴백 품질**(제목다운 항목 비율, Review 표본): English Grammar in Use 3판 195항목 약 70% · Longman Grammar Practice 184 약 38% · Grammar in Use 2판 158 약 20% · Harry Potter 2 75 **0%**(대화 문장만, 장 제목 안 잡힘) · 스피쿠스 unit1(6쪽) 41 섞임(본문보다 작은 r 0.36 까지).
- 폴백 겹침(숫자 항목에 붙인 장 제목 중복)은 OCR 6권 0 → 고치지 않음(운영자 확인).
- 8g-3 은 커밋됨(`7dda130`, 미푸시 — 8g-2~4 와 함께 배포). `tocOf(docId)` 가 열 때마다 `searchText` heads 로 `headingToc` 를 부른다(저장 안 함). 원본 개요는 `documents.outline` 에 저장돼 있다.

## 운영자 결정 (2026-10-19)
- **쓰레기 개요 = (나)**: 개요 항목의 **80% 이상**(정확한 문턱은 실측으로 정해 제안)이 파일 이름 꼴이면 개요 전체를 버리고 폴백으로. 판정은 **`tocOf` 에서**(저장된 원본은 그대로 — `OUTLINE_V` 를 올리지 않는다).
- **폴백 품질 개선을 8g-4 전에 작은 Plan·Build 로** 한다(이 Plan).

## 계획할 것
A. **파일 이름 꼴 규칙**: 일반 규칙(확장자 목록 jpg·jpeg·bmp·tif·tiff·png·gif, `Untitled-#`, 숫자만 + 확장자 등)과 문턱. 오탐 0 확인 — 세 의학책 개요(37·61·50)·진짜 개요 3권은 버려지면 안 된다.
B. **폴백 일반 규칙 후보**(Review 가 제안 — **책별 튜닝 금지**, 메모리 원칙 "여러 권·여러 언어"): ① 본문보다 작은 글자 층(r<1) 빼기 ② 문장꼴(끝 부호 . ? ! " ’ 로 끝남·긴 줄·소문자 시작) 빼기 ③ 짧은 책의 층 상한 ④ 그 밖에 실측으로 보이는 것(예: 대화 따옴표, 쪽마다 반복되는 머리말). 각 후보를 켜고 껐을 때 **OCR 교재 여러 권 + 의학책 세 권**의 결과를 잰다:
   - 의학책: S18 기준 회귀 0(CMDT 2021 개요 제목 45/50 이상 · 항목 ≤ 200, Harrison 개요 쪽 27/37 이상, CMDT 2026 은 기록).
   - OCR 교재: **정답이 없다** — 진짜 개요가 있는 3권은 정답으로 쓰고, 나머지는 "제목다운 항목 비율"을 사람이 볼 수 있게 표본 출력(처음 15항목, 원서 40자 이하로 자름)으로. Grammar in Use 류는 "Unit N" 꼴 장 제목이 있을 것 — 그것을 잡는지가 핵심 지표가 될 수 있다(일반 규칙으로만).
C. Harry Potter 같은 소설(장 제목이 본문과 같은 글자 크기·"CHAPTER ONE" 꼴)은 폴백으로 무엇을 할 수 있는지 — 못 하면 "이번엔 못 함"으로 정직하게, 목차 탭에 "제목을 찾지 못했다" 안내.
D. 변경 위치: `text/search.js` `headingToc`(순수) 와 `search/outline.js` `tocOf`(쓰레기 판정). 테스트·변이 목록, 수용 기준(16절 형식), 되돌림.
E. 운영자 결정 필요 사항.

## 측정 규칙
- 스크립트는 **스크래치패드 `p8g3b/`** 에 새로(레포 `dev/` 에 쓰려면 새 파일 `dev/measure-toc-8g3b.mjs` 하나만). 앱 모듈은 import 만.
- PDF: 세 의학책 경로 + `D:/OCR` 아래(**읽기만**, 교재 이름은 보고서에 그대로 적어도 됨). Review 의 원자료 스크래치패드 `r8g3/`(`ocr2-*.json`·`olt-all.txt`)를 먼저 쓴다.
  의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
- pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
- 모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 원서 문장 40자 초과 인용 금지.

## 금지
앱 코드 수정, 커밋, npm 설치·다운로드, `git checkout/restore/stash`, `rm -rf`, `.nojekyll` 삭제, `D:/OCR`·G: 수정.
