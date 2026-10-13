# Build 지침 — 8i 표를 행 단위로 읽기 (행 표 · 쪽 번호 칸 · rowhead)

> 너는 **Build 서브에이전트**다. 운영자가 spec **4-13** 과 4-13-9 D1–D6 권장안을 승인했다(2026-10-13).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8i-report.md`.

## 읽을 것
- `apps/medreader/spec.md` **4-13 전부**(4-13-4 규칙 R1–R7, 4-13-6 쪽 번호 `ref`, 4-13-7 영향, 4-13-8 나누기·테스트 RT1–RT15·변이 M1–M12·되돌림, 4-13-9 승인) — 설계 문서다. 4-5(거터), 4-8(표 감지), 4-12(원본 하이라이트 좌표), 6-1, 6-6(8h 인용) 도 필요한 만큼.
- `.claude/tasks/medreader-plan-8i-report.md`, 시제품 `apps/medreader/dev/proto-rowtable-8i.mjs`(R7 포함 — **규칙을 옮길 기준이자 수치 대조 기준**), `dev/measure-tables-8i.mjs`
- `js/text/layout.js`, `js/text/blocks.js`, `js/pdf/extract.js`(algoVersion), `js/db.js`·store 쪽, `js/ui/reader.js`, CSS, `js/config.js`

## 할 일 (spec 4-13-8 순서 그대로, Build 한 번)
1. 새 순수 모듈 `js/text/rowtable.js`(`document`·`window` 0) + `config.ROWTABLE`(끄는 스위치 `ENABLED`, `INH_CROSS` 0.3 등 spec 상수) + 단위 테스트.
2. `layout.js` 새 단계(역할 판정 다음·표 감지 앞), 줄 id 재부여, **algoVersion 10 → 11**. `blocks.js` · 저장 경로.
3. `reader.js` + CSS: `rowhead` 문단, `ref` 줄은 낭독·번역 제외, 리플로우에서 주제 끝 작은 회색 숫자(D4), 열 머리 행 접기(D3). 원본 보기 하이라이트가 행 표 쪽에서도 맞는 줄을 칠하는지.
4. `dev/measure-rowtable-8i.mjs`: **앱 모듈로** 세 권 재측정 · 21–38쪽 괘선 대조(시제품 98.7%, 832줄 중 821 과 비교) · 쪽 번호 칸 전수(시제품 159칸/21–38쪽) · **행 표가 안 잡힌 쪽은 8i 전(HEAD)과 추출 결과가 바이트 단위로 같음**.
5. `node apps/medreader/dev/stamp-importmap.mjs`, 전체 테스트 통과.

## 반드시 지킬 것
- 여러 권·여러 언어 원칙: 책 고유 x 좌표·글자 크기·"Page Number" 같은 낱말 금지(spec 규칙 그대로).
- D1 (가): 쪽 번호 열(R)이 있는 행 표만. 본문 이름표 2열 표(CMDT 45·1587·1588·1653, Harrison 125 등)는 **잡지 않는다** — 이 쪽들이 8i 전과 같아야 한다.
- 30쪽 확인: 낭독 단위가 Thyroid Nodules & Multinodular Goiter(한 덩어리) → 그 내용 → … → Hirsutism & Virilization → 내용 순서이고, "1130" 같은 쪽 번호 단위·"& Pseudo- 1130" 섞임이 0, 열 머리 행 낭독 0. 8h 인용 건너뛰기(cite)는 그대로.
- `KEEP_HYPHEN_SUFFIXES` 손대지 않음. `splitSentences` 호출 한 곳 유지. 8h 의 `cite.js` 동작 불변.
- 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치, `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열, 원서 문장 40자 초과. 기존 dev 파일은 수정하지 말고 새 파일로(단 4번 측정 스크립트는 새 파일).
- PDF 는 세 경로만: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.

## 검증 (보고서에 숫자로)
테스트 2회 이상 · 변이 M1–M12 각각 grep 으로 적용 확인 → 빨개지는 테스트 → 스크래치패드 복사본으로 복원·`cmp` · 4번 측정 결과(시제품 대비 차이와 원인) · 30쪽 단위 목록(40자 이하) · 재추출 시간(데스크톱, 5,051쪽 책) · 바뀐 파일 · 의도와 다르게 한 곳 · 남은 위험.
