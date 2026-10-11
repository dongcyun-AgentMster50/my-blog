# Review 지침 — 8h-2 출판 정보만인 문장 건너뛰기 (A3)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "8h-2 A3 Review" 절로 덧붙인다. **커밋하지 않는다.** 한국어로 쓴다.

## 읽을 것
- spec 6-6-2 **A3** 문단, Build 보고 `.claude/tasks/medreader-build-8h-2-report.md`, `git diff`(8h-2 변경 — `js/text/cite.js`, `js/tts/text.js` 주석, `tests/cite-8h.test.mjs`, `dev/measure-cite-8h.mjs`, `index.html` import map). `spec.md` 의 diff 는 오케스트레이터 기록이니 무시.
- 이전 Review 절 "8h 낭독 다듬기 Review"(같은 파일) — 방법을 따라라.

## 오케스트레이터가 확인한 것
테스트 983/983 · stamp `--check` 0 · `isPublicationOnly` 예문: "2024;332:957."·"2023;40(2):381-9." true / "2021 Mar;9(3):1-9."·"2024;10:e123."·"In 2024;…"·"Stage III."·"2024." false.

## 볼 것
1. **오탐**: CMDT 2026 의 A3 로 새로 빠지는 984문장 전부(40자 이하)와 그 **앞 문장**을 함께 보고, 본문 문맥(표·수치 문장 등)에서 빠진 것이 있는지. CMDT 2021 29문장도 전부. 기준 0.
2. **불변**: A3 가 없는 문단의 단위 JSON·`src` 가 8h-2 전(HEAD `2fa52c8`)과 같은가 — 전권. A1·A2 판정 수가 그대로인가.
3. **브라우저**(로컬 정적 서버, 실제 CMDT 2026, 진짜 키 금지): 출판 정보 줄 + PMID 가 있는 쪽 하나에서 그 두 줄의 발화 0, 하이라이트 건너뜀, 번역 요청 묶음에 그 `src` 0. 콘솔 0, 360px 가로 스크롤 0. 이전 Review 가 브라우저 패널 저장소에 넣은 문서가 남아 있으면 그것을 써도 된다(새로 넣지 말 것 — 106MB).
4. 테스트 3회 + Build 변이 2개 재현 + 새 변이 1개 이상, grep 적용 확인 → 복원 `cmp`.
5. **운영자 결정 자료(구현하지 말 것)** — 넓히는 두 안의 오탐 위험을 숫자로:
   (가) 월 이름 허용("2021 Mar;9(3):1-9." — CMDT 2021 약 800곳): 월 약어 12개만 허용하고 나머지 조건(바로 뒤 식별자)은 그대로일 때, 두 책에서 새로 빠질 문장 수와 그 표본 100개 눈 검토 결과.
   (나) 전자 위치 `e123` 허용(CMDT 2026 약 92곳): 같은 방식.
   각 안에 "채택 권장/비권장"과 근거.

## 고쳐도 되는 것
8h-2 가 바꾼 파일 안의 결함. 고치면 `node apps/medreader/dev/stamp-importmap.mjs` 다시. `spec.md` 는 고치지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치, `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열, 원서 문장 40자 초과. 서버를 띄웠으면 정리.
PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.

## review.md 절
결론 · 오탐 검토 · 불변 · 브라우저 · 테스트·변이 · 고친 것 · 넓히는 두 안(숫자·표본·권장).
