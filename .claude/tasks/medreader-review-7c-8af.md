# Review 지침 — 7c(원문 언어) + 8a 후속(운영자 결정 3건)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "7c + 8a 후속" 절로 덧붙인다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.

## 읽을 것
1. 지침: `.claude/tasks/medreader-build-7c.md`, `medreader-build-8a-followup.md`. 보고: `medreader-build-7c-report.md`(추가 절 포함), `medreader-build-8a-report.md` 의 "후속(2026-10-10)" 절 — **검증 대상**
2. spec: 16-D1(7c 합격 기준 — 10-10 수정: quiz.js 제외·가나 판정 축소), 9-2 원문 언어, 12-6, 7-6 의 `[수정 2026-10-10]`(응답 없는 실패는 blocked, 3단계 후 사용자만), 10-2 의 `[수정 2026-10-10]`(20자 미만 비율 생략)
3. `git diff` 와 새 파일들

## 실제 PDF 를 쓸 수 있다 (8a Review 때 대기였던 것)
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`. 측정 공용 도우미 `apps/medreader/dev/measure-lib.mjs`.
PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`. **다운로드 폴더 목록을 통째로 띄우지 마라**(개인 서류가 있다) — 이 세 파일만 쓴다. 원서 문장을 review.md 에 옮기지 마라(40자 이하 진단 조각만).
오케스트레이터가 이미 잰 것(참고, 다시 재도 된다): 세 책 3쪽 간격 2,583쪽·문장 73,467개에서 **7c 전(HEAD)과 후의 영어 문장 단위가 완전히 같다**, 같은 비교를 프랑스어 규칙으로 돌리면 Harrison 73쪽 중 54쪽이 달라진다(비교 감도 확인).

## 특히 볼 것
- **8a 때 대기였던 실PDF 항목**: `flowParasOf` 분리 전후 낭독 큐 동일성(실제 책 쪽), 쪽 경계의 R2·`frag` 판정이 실제 쪽 경계에서 맞는가(쪽 끝 문장이 다음 쪽으로 이어지는 실제 사례를 몇 개 찾아서).
- **언어 추정의 실물**: 세 책이 모두 `en` 으로 추정되는가(점수 포함). 쪽 표본 5쪽이 표지·목차·빈 쪽이면 어떻게 되는가(CMDT 2026 은 1·2쪽이 이미지 표지다).
- **경합**: Build 가 기록한 위험 — 추출기의 메타 저장·`saveLastPage`·`openDoc` 이 레코드 전체를 다른 트랜잭션으로 쓰는 사이에 [⋯] 언어 선택이 끼면 사용자 선택이 되돌아갈 수 있다. **재현을 시도하라**(지연 주입). 재현되면 심각도와 고칠 범위를 적고, 고치지는 말고 보고(이월 결함 "documents 갱신 경합"과 같은 뿌리 — 운영자 결정 필요).
- **원문 언어 바꾸기의 실동작**(브라우저): en→fr→ko 에서 본문 `lang`·`utterance.lang`·낭독 큐가 새로고침 없이 바뀌고, 음성이 없으면 "{언어} 음성이 없습니다"가 언어마다 한 번. 아랍어 UI 에서 [⋯] 패널 RTL.
- **8a 후속**: 20자 경계(19·20·21자), blocked 의 자동 전송 상한 4건(네트워크·타임아웃 공유)을 가짜 시계로, `KEY_IN_URL` 이 usage 에 0건·상태 `model`·화면 문구·빨간 테두리(오케스트레이터가 `screens.css` 에 `keyInUrl` 색을 더했다).
- 회귀: 설정 화면 [검증]·[시험 번역]·두 언어 블록·bidi·드롭다운 2개, 키 누출 0, 360px 가로 스크롤 0, 콘솔 0.
- 변이: 각 Build 의 변이 중 2개 이상 재현 + 새것 2개 이상. **적용 grep 확인 후** 읽고, 원본은 스크래치패드 복사본으로 되돌린 뒤 cmp(`git checkout`·`restore`·`stash` 금지).

## 고쳐도 되는 것
이번 두 Build 가 만든·바꾼 파일 안의 결함 수정만. 경합은 고치지 않는다(보고). `gemini.js` 판정 순서·모델 필터·`spec.md`·4절 알고리즘은 고치지 않는다. npm 설치 금지.

## review.md 절
결론 · 16-D1 항목별 · 8a 대기였던 실PDF 항목 결과 · 언어 추정 실물 · 경합 재현 결과 · 8a 후속 확인 · 키 누출·회귀 · 변이 · 고친 것/기록만.
