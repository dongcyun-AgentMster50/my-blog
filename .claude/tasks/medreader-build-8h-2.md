# Build 지침 — 8h-2 출판 정보만인 문장 건너뛰기 (A3)

> 너는 **Build 서브에이전트**다. 운영자가 spec 6-6-2 의 **A3** 를 승인했다(2026-10-12).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8h-2-report.md`.

## 읽을 것
- `apps/medreader/spec.md` 6-6-2 의 **A3** 문단(규칙·범위 밖), 6-6-2 A1·A2, 6-6-8 테스트 방식
- `apps/medreader/review.md` "8h 낭독 다듬기 Review" 절의 8h-9 ①
- `js/text/cite.js`, `js/tts/text.js`(cite 표시가 붙는 자리), `tests/cite-8h.test.mjs`, `dev/measure-cite-8h.mjs`

## 할 일
- A3 규칙을 `js/text/cite.js`(순수 함수)와 `buildUnits` 의 cite 표시 단계에 넣는다. **좁게**: 문장 전체가 출판 정보 꼴뿐(낱말 글자 0) **그리고** 같은 문단 안 바로 다음 단위가 A1 식별자만인 cite 일 때만.
- 범위 밖(단독 저자 머리, 문단 넘김, 학술지 약어만인 문장)은 하지 않는다.
- 테스트(`tests/cite-8h.test.mjs` 에 추가, 지어낸 픽스처): 양성 — "2024;332:957." + "[PMID: n]" → 둘 다 cite · "2023;40(2):381-9." 꼴. 음성 — 뒤가 식별자가 아님 · 다른 문단의 식별자 · 낱말이 섞인 문장("In 2024;…") · 출판 정보 꼴인데 뒤 문장이 본문 · 줄 단위 모드.
- 변이 2개 이상(예: "바로 다음이 식별자" 조건 제거 → 음성 테스트 빨강, 낱말 글자 0 조건 제거 → 빨강). grep 으로 적용 확인 → 결과 → 스크래치패드 복사본으로 복원·`cmp`.
- `dev/measure-cite-8h.mjs` 가 A3 를 따로 세도록(그 파일 수정 허용). CMDT 2026·2021·Harrison 전권 수치: A3 로 새로 빠지는 문장 수(Review 실측 1,133 / 828 과 비교), 전체 cite 글자 비율.
- 끝나면 `node apps/medreader/dev/stamp-importmap.mjs` 실행, 전체 테스트 통과.

## 지킬 것
algoVersion·DB_VERSION·프롬프트 불변, 추출 파일 수정 금지, `splitSentences` 호출 한 곳 유지, 화면·`src` 불변. 원서 문장 40자 초과 금지. 커밋·`git checkout/restore/stash`·`rm -rf`·npm 설치·진짜 키 금지. PDF 는 이 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.
