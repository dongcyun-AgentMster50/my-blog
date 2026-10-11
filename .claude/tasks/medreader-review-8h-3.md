# Review 지침 — 8h-3 A3 넓힘 (월 약어·일, 전자 위치 e123)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "8h-3 A3 넓힘 Review" 절로 덧붙인다. **커밋하지 않는다.** 한국어로 쓴다.

## 읽을 것
- spec 6-6-2 A3 와 "A3 넓힘" 줄, Build 보고 `.claude/tasks/medreader-build-8h-3-report.md`, `git diff`(`js/text/cite.js`, `tests/cite-8h.test.mjs`, `index.html` import map — `spec.md` diff 는 오케스트레이터 기록이니 무시)
- review.md 의 "8h-2 A3 Review" 절(같은 방법·같은 비교 기준)

## 오케스트레이터가 확인한 것
테스트 985/985 · stamp `--check` 0 · `isPublicationOnly` 예문 11개 — 양성: "2021 Mar;9(3):1-9." "2020 Nov 12;383(20):1907-19." "2024;10:e123." "2021 Mar;9:e2345." / 음성: "2021 March;…" "2021 Spring;…" "2024;10:x123." "Mar 2021 data showed." "In 2021 Mar;…" "2021 Mar 123;…" "2024;10: e123.".

## 볼 것
1. **새로 빠지는 문장의 오탐 — 이번 핵심**: 세 권에서 8h-3 으로 판정이 바뀐 854문장(2026 +97, 2021 +757). 특히 **이전 Review 가 한 번도 보지 않은 "월 + e 가 한 문장에 함께 있는" CMDT 2021 70문장은 전수**, 나머지 2021 월 문장은 이전 표본과 겹치지 않는 새 무작위 100개, 2026 97개 전수 — 각 문장을 **앞 문장과 함께** 보고 본문이 빠졌는지. 기준 0.
2. **불변**: 8h-2 커밋(`6774f0d`) 대비 판정이 바뀐 문장이 넓힘 꼴뿐인지(반대 방향 0), 그 밖 문단의 단위 JSON·`src` 동일 — 세 권 전권.
3. Build 가 남긴 결정거리: 콜론 뒤 공백 `": e123"`(2026 1문장)을 받을지 — 의견만, 구현하지 말 것.
4. 테스트 3회 + Build 변이 2개 재현 + 새 변이 1개 이상, grep 적용 확인 → 스크래치패드 복사본으로 복원·`cmp`.
5. 브라우저는 생략해도 된다(8h-2 Review 가 같은 경로를 확인했고, 이번 변경은 순수 함수 판별식뿐). 대신 `cite.js` 의 순수성(`document`·`window` 0)과 `splitSentences` 호출 1곳을 grep.

## 고쳐도 되는 것
8h-3 이 바꾼 파일 안의 결함(테스트 공백 보강 포함). 고치면 `node apps/medreader/dev/stamp-importmap.mjs` 다시. `spec.md` 는 고치지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치, `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열, 원서 문장 40자 초과.
PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.

## review.md 절
결론 · 오탐(표본 크기·결과, 70문장 전수 결과 따로) · 불변 · 테스트·변이 · 고친 것 · ": e123" 의견.
