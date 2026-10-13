# Plan 지침 — 8i 표를 행 단위로 읽기 (CMDT 앞부분 세 열 표 등)

> 너는 **Plan 서브에이전트**다. 코드를 고치지 않는다. 결과는 `apps/medreader/spec.md` 에 새 절로 쓰고, 같은 내용의 요약을
> `.claude/tasks/medreader-plan-8i-report.md` 에 쓴다. **커밋하지 않는다.** 한국어로 쓴다. 결정이 필요한 곳은 선택지와 권장안.

## 운영자 결정 (2026-10-13, 확정)
- 표는 **행 단위**로 읽는다: 한 행의 **주제 칸을 한 덩어리**로 → 그 행의 **내용 칸** → 다음 행.
- **쪽 번호 칸(예: "Page Number" 열의 1130)은 읽지 않는다**(화면에는 그대로).
- 지금 한다(8g 검색보다 먼저). 추출 결과가 바뀌면 **재추출 1회**가 필요하다는 것을 운영자가 안다.

## 운영자가 폰에서 본 것 + 오케스트레이터가 앱 코드로 잰 것 (CMDT 2026 30쪽)
- 이 쪽에서 표로 잡힌 블록 **0**. 문단 종류는 heading/list/body.
- 낭독 단위 순서: "Topic" · "Thyroid Nodules &" · "Multinodular Goiter" · "Page NumberKey New Advances…"(U+001F 포함) · 본문 · 인용 … ·
  "Hypoparathyroidism" · **"& Pseudo- 1130"**(주제 줄과 옆 쪽 번호 칸이 한 줄로 합쳐짐) · "hypoparathyroidism" · "1138" · "Osteoporosis &" · "Osteopenia" ·
  "1139" · "Paget Disease" · "of Bone (Osteitis 1143" · "Deformans)" · "Rickets &" · "1142" · "Osteomalacia" · **그 뒤에야** 각 행의 내용("• FDA-approved…" …).
- 즉 (1) 한 주제 이름이 줄마다 끊겨 따로 번역·낭독되고 (2) 쪽 번호가 섞이고 (3) **주제 전부 → 내용 전부** 순서라 주제와 내용이 따로 논다.
- 띠에는 "및 위(Pseudo-) 1130" 같은 조각 번역이 뜬다. 그 밖(인용 건너뛰기 등)은 운영자 확인으로 정상.
- 인계 문서(`.claude/tasks/medreader-handoff.md`)의 기존 기록: CMDT 2026 앞부분(6–7, 21–38쪽)은 **세 열** — 주제(x 88~180, 11pt) | 참조 쪽 번호(x≈208~226, 9pt) | 본문(x 262~497, 8pt). 거터를 잘못 잡아 "ankle 1654 arthritis" 결함, spec 18 "3열 이상 미지원". 14단계로 미뤄 둔 항목이다.

## 읽을 것
- spec 4-x(레이아웃·단 나누기·문단), **4-8 표 영역 감지와 폴백**, 4-12(원본 뷰 하이라이트 좌표), 6-1(낭독 단위), 6-6(8h — 인용·`buildUnits`), 18(미지원 목록), 7-5(번역 캐시 키)
- `js/text/layout.js`, `js/text/blocks.js`(표 감지 — `TABLE_*` 상수가 config.js 에 있다), `js/pdf/extract.js`(algoVersion), `js/tts/text.js`, `js/ui/reader.js`(리플로우 표시·`flowLineIds`), `js/ui/original.js`(있다면 — 원본 하이라이트)
- `apps/medreader/dev/` 측정 도구(`measure-lib.mjs`, `probe-*`)

## 계획할 것
A. **이런 표가 얼마나 있나** — 세 권(CMDT 2026·2021·Harrison) 전권에서 "여러 열이 같은 높이에 나란히 있는데 표로 안 잡히는 쪽"을 세는 측정 스크립트를 `dev/` 에 새로 만들어 잰다. 30쪽 같은 세 열 표, 일반 본문 2단, 진짜 데이터 표(숫자 격자)를 구분해 수치로.
B. **감지 규칙** — 여러 권·여러 언어 원칙(책 고유 x 좌표·글꼴 크기·"Page Number" 낱말 금지). 열 정렬·행 경계(같은 행의 칸들이 세로로 겹침)·행 구분선이 있다면 pdf.js 연산자 목록에서 얻을 수 있는지(비용). 2단 본문을 표로 오인하는 위험을 막는 조건. 지금 `blocks.js` 표 감지가 30쪽을 놓친 이유.
C. **행 단위 읽기 모델** — 표 행 = 칸들의 묶음, 칸 = 여러 줄을 이은 한 덩어리(줄 끝 하이픈 처리 포함). 낭독·번역 단위가 칸 단위가 되도록 추출 결과(문단) 모양을 어떻게 바꾸나. 리플로우 화면 표시(행마다 "주제 — 내용"?)와 원본 보기 하이라이트(줄 좌표)가 깨지지 않게.
D. **쪽 번호 칸 빼기** — "읽지 않는 칸"을 무엇으로 판별하나(칸 전체가 짧은 정수뿐인 열 등 — 일반 규칙으로). 데이터 표의 숫자 열을 잘못 빼지 않게(오탐 비용).
E. 영향 — algoVersion 올림 → 재추출(5,000쪽 책 시간 추정), 번역 캐시 키 변화(표 쪽만), 8h 인용 판별(칸 끝 인용)과의 순서, 검색(8g)과의 관계, 다른 책에서 회귀(오탐 0 기준과 측정 방법).
F. 나누기·테스트·변이 목록, 되돌림 방법. 하기 어려운 부분은 "이번엔 못 함"으로 정직하게 경계를 그어라.

## 금지
코드 수정·커밋·npm 설치·`git checkout/restore/stash`·`rm -rf`. 원서 문장 40자 초과 인용 금지. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`. 측정 스크립트는 `apps/medreader/dev/` 에 새 파일로만.
