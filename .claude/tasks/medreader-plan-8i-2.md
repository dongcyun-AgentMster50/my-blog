# Plan 지침 — 8i-2 본문 이름표·설명 2열 표를 행 단위로 읽기

> 너는 **Plan 서브에이전트**다. 앱 코드를 고치지 않는다. 결과는 `apps/medreader/spec.md` 4-13 아래 **새 소절 "4-13-10. 8i-2 본문 이름표 2열 표"**로 쓰고(기존 절은 고치지 않는다, 목차 4번 줄에 표시만), 같은 내용의 요약을 `.claude/tasks/medreader-plan-8i-2-report.md` 에 쓴다. **커밋하지 않는다.** 한국어로 쓴다. 결정이 필요한 곳은 선택지와 권장안.

## 운영자 결정 (2026-10-17)
- 8i 에서 미뤄 둔 spec 4-13-9 D1 **(나)** 를 지금 한다: 본문의 **이름표·설명 2열 표**(예: 진찰 소견 이름표 | 설명)도 30쪽 표처럼 **행 단위**(이름표 한 덩어리 → 그 행의 설명 → 다음 행)로 읽는다.
- 8i(`8bc61de`)·8i-1·8i-3·8i-3b 는 커밋·푸시됐고 운영자가 폰에서 확인했다(30쪽 표 주제가 한 덩어리로 읽히고 번역됨).

## 이미 알려진 것 (spec 4-13, `.claude/tasks/medreader-plan-8i-report.md`, review.md "8i 행 표 Review")
- 8i 시제품이 행 표로 잡던 본문 2열 표: **CMDT 2026 16쪽**(45·1587·1588·1653·1681 등) + **Harrison 5쪽**(75·125·403·412·542), CMDT 2021 0. R7 뒤 띠 +5·+1.
- 지금 결함: 이름표 전부 → 설명 전부 순서로 읽힘.
- 8i 때 (나)를 미룬 이유: **위 정렬** 표라 행 사이 틈이 없고, **머리 행**이 첫 행에 붙거나 **이름표 둘이 붙는** 흠, 괘선 정답이 없어 눈으로만 잼. spec 이 제시한 방향: "이름표 첫 줄 = P 줄 baseline 으로 칸 쪼개기" + 머리 행 판별 → 16+5쪽 눈 검토.
- 8i 알려진 흠 중 이번에 같이 풀릴 수 있는 것: 29쪽 이름표 둘 붙음(1행), "∗See chapter…" 각주가 굵은 이름표로 들어감(9개), 두 줄 장 제목 둘째 줄이 홀로(22·30쪽). 같이 풀 수 있으면 계획에 넣고, 아니면 "이번엔 못 함"으로.

## 읽을 것
spec 4-13 전체(특히 4-13-3 규칙 R1–R7, 4-13-8 테스트·변이, 4-13-9 결정), 4-8, 6-6(8h 인용), 7-5(번역 캐시 키), 18. `js/text/rowtable.js`, `js/text/layout.js`, `js/text/blocks.js`, `js/config.js`(`ROWTABLE`), `js/pdf/extract.js`(algoVersion — 지금 11), `js/ui/reader.js`(rowhead 표시), `apps/medreader/dev/measure-tables-8i.mjs`·`proto-rowtable-8i.mjs`·`measure-rowtable-8i.mjs`.

## 계획할 것
A. **대상 전수** — 세 권 전권에서 지금 규칙(조건 e: 쪽 번호 열 필요)을 풀면 새로 잡히는 띠·쪽을 앱 모듈로 다시 잰다(16+5 가 지금 코드에서도 맞는지). 쪽마다 표 꼴(위 정렬/가운데 정렬, 머리 행 유무, 이름표 여러 줄 여부, 행 수)을 표로. 2단 본문·색인·문항·숫자 격자 오탐 0 확인.
B. **행 나누기 규칙** — 위 정렬 표에서 행 경계를 무엇으로 잡나(이름표 첫 줄 baseline 이 P 줄 baseline 과 맞는 곳, 글머리, 굵기 등 — 책 고유 x 좌표·글자 크기·낱말 금지, 여러 권·여러 언어 원칙). 붙은 이름표 둘을 가르는 조건. 가운데 정렬(30쪽 류)과 섞일 때 표마다 정렬을 고르는 기존 방식과의 관계.
C. **머리 행 판별** — 열 머리("Finding | Description" 류)를 colhead 로 접을지, 첫 행에 붙지 않게 하는 조건.
D. **정답과 채점** — 괘선이 있는 쪽은 dev 채점 정답으로 쓸 수 있는지, 없으면 눈 검토 절차(쪽마다 "이름표 → 설명" 짝을 출력해 사람이 보는 형식). 8i 의 98.7% 같은 수치 기준을 정할 수 있으면 정한다.
E. **영향** — algoVersion 11 → 12(재추출 한 번 더; 8i-1 경로가 지금 쪽을 새 판으로 바꿔 줌), 바뀌는 쪽 외 바이트 동일(Review 기준), 번역 캐시 키 변화 범위, 8h 인용과의 순서, 리플로우·원본 보기 표시(rowhead·행 구분선 재사용), 30쪽 류(21–38쪽) 회귀 0.
F. 나누기·테스트·변이 목록, 되돌림 방법(`ROWTABLE` 설정 · algoVersion 은 앞으로만). 어려운 부분은 "이번엔 못 함"으로 정직하게.

## 측정 실행 규칙
- 측정 스크립트는 `apps/medreader/dev/` 에 **새 파일**로만(예: `measure-rowtable-8i2.mjs`). 기존 dev 도구는 읽기만.
- 모든 실행에 시간 상한(`timeout`)을 둔다. 띄운 프로세스는 정리하고, 못 끄면 PID 를 보고한다.
- 큰 출력은 스크래치패드 `p8i2/` 에. C: 여유가 수 GB 뿐이다 — 쓰기 전 `df -h /c`, 2 GB 아래면 멈추고 보고. 브라우저 프로필은 이번에 필요 없다(복사 금지).

## 금지
앱 코드 수정, 커밋, npm 설치, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), `.nojekyll` 삭제. 원서 문장 40자 초과 인용 금지. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.
