# Build 지침 — 8h-3 A3 넓힘 (월 약어·일, 전자 위치 e123)

> 너는 **Build 서브에이전트**다. 운영자가 spec 6-6-2 의 **A3 넓힘**을 승인했다(2026-10-12).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8h-3-report.md`.

## 읽을 것
- `apps/medreader/spec.md` 6-6-2 의 **A3** 문단과 그 아래 **"A3 넓힘"** 줄
- `apps/medreader/review.md` 끝 "8h-2 A3 Review" 절(특히 넓히는 두 안 — Review 가 쓴 정확한 꼴과 수치: 2021 +686, 2026 +2 / 2026 +96, 2021 +1)
- `js/text/cite.js`(`isPublicationOnly`, `publicationTails`, `PUB_ONLY` — A2 닫힘 꼴이 이미 월·일을 받는다면 그 정의와 어긋나지 않게), `tests/cite-8h.test.mjs`, `dev/measure-cite-8h.mjs`

## 할 일
- `isPublicationOnly` 를 넓힌다: (가) 연도 뒤 월 약어 12개(Jan–Dec, 마침표 선택) + 선택적 일 (나) 쪽 자리에 콜론 바로 뒤 `e` + 숫자. **그 밖의 글자는 계속 불허**. "바로 뒤 식별자만인 cite" 조건은 그대로.
- 테스트 추가(지어낸 픽스처): 양성 — "2021 Mar;9(3):1-9." · "2020 Nov 12;383(20):1907-19." · "2024;10:e123." (각각 뒤에 식별자). 음성 — "2021 March;…"(전체 철자) 또는 Review 가 정한 대로 · "2021 Spring;…" · "2024;10:x123." · "Mar 2021 data showed…" · 월 꼴인데 뒤가 본문 · "In 2021 Mar;…".
- 변이 2개 이상(월 목록을 아무 낱말로 넓힘 → 음성 빨강, `e` 를 아무 글자로 → 음성 빨강). grep 으로 적용 확인 → 결과 → 스크래치패드 복사본으로 복원·`cmp`.
- 세 권 전권 수치를 `dev/measure-cite-8h.mjs` 로: 넓힘으로 새로 빠지는 문장 수(Review 수치와 비교 — 차이 있으면 원인), 전체 cite 글자 비율. 판정이 바뀐 문장이 넓힘 대상 꼴뿐인지.
- 끝나면 `node apps/medreader/dev/stamp-importmap.mjs`, 전체 테스트 통과.

## 지킬 것
algoVersion·DB_VERSION·프롬프트 불변, 추출 파일 수정 금지, `splitSentences` 호출 한 곳, 화면·`src` 불변. 원서 문장 40자 초과 금지. 커밋·`git checkout/restore/stash`·`rm -rf`·npm 설치·진짜 키 금지. PDF 는 이 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.
