# Review 지침 — 8h 낭독 다듬기 (8h-1 낭독 정리 + 8h-F 발음 기호 시험 페이지)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "8h 낭독 다듬기" 절로 덧붙인다. **커밋하지 않는다.** 한국어로 쓴다.

## 읽을 것
- 설계: `apps/medreader/spec.md` 6-6 전부(특히 6-6-2 오탐 기준, 6-6-5 D, 6-6-8 테스트·변이·실제 책 확인)
- Build 보고: `.claude/tasks/medreader-build-8h-1-report.md`, `.claude/tasks/medreader-build-8h-F-report.md` (검증 대상)
- `git diff` + 새 파일 `js/text/cite.js`, `tests/cite-8h.test.mjs`, `dev/measure-cite-8h.mjs`, `dev/tashkeel-*`

## 오케스트레이터가 이미 독립 확인한 것 (다시 해도 되지만 중복보다 아래 빈칸에 힘을 써라)
테스트 978/978 · stamp `--check` 0 · 추출 파일 diff 0 · 버전 상수 불변 · `splitSentences` 호출 1곳 · 앱 `buildUnits` 로 CMDT 2026 전권 cite 8,352단위/295,486자 · 30쪽 저자·PMID 가 cite · `speechMarks` 예문 6개 정상 · tashkeel 파일에 키 꼴 0·외부 주소 0.

## 특히 볼 것
1. **오탐(본문을 건너뜀) 눈 검토 — 이 Review 의 핵심.** `dev/measure-cite-8h.mjs --all` 로 CMDT 2026 과 **CMDT 2021**(빠지는 양 5.2%로 가장 많음) 각각: A1 et al. 전부, A2 묶음 무작위 200, et al. 없는 A2 머리 전부를 40자 이하로 보고 **본문 문장이 cite 로 빠진 사례**를 센다. 표본을 스스로도 하나 더 뽑아라(예: cite 단위 중 소문자 낱말 비율이 높은 것, 길이 상위 50). 기준: 오탐 0(6-6-2). 하나라도 있으면 원인 규칙과 고칠 방향.
2. **Harrison C "other" 24곳**(Plan 스크립트 분류) — 앱의 `speechMarks` 가 그 자리에서 무엇을 하는지, 본문 뜻을 바꾸는 곳이 있는지.
3. **브라우저 실동작**(로컬 정적 서버, 360px 포함): 문서를 넣고 30쪽(또는 인용이 있는 아무 쪽)에서 낭독 — 인용 줄이 발화 큐에 없고 하이라이트가 그 줄을 건너뛰는가, 설정 "인용도 읽기"를 켜면 원서 언어로만 읽고 번역 단계가 없는가, 인용뿐인 쪽에서 재생 → 다음 쪽으로 넘어가 첫 발화가 나오는가(Build 가 실기기 미확인이라 한 비동기 경로), 구간 반복이 인용을 밟지 않는가. 진짜 API 키 금지 — 번역이 필요한 확인은 가짜 키(실행 중 조각을 이어 만든 값)로 실패 상태에서 하거나 디버그 훅으로 큐·요청 묶음을 본다(요청 묶음에 cite `src` 0).
4. **D — 원본 보기에서 자막 띠 미표시 재현**(6-6-5). speak/show 모드에서 원본 보기로 바꿔 띠가 보이는가. 재현되면 원인과 최소 수정(`css/reader.css` 또는 `ui/controls.js`) — 고쳐도 된다. 재현 안 되면 "판 섞임(옛 index.html 에 `#trBand` 없음)" 가설이 맞는지 옛 커밋(`8b` 이전 index.html + 8b 모듈)으로 재현해 본다.
5. **8h-F 페이지**: 360px·RTL·48px·콘솔 0·외부 요청 0, 자리표시일 때 안내, 눈가림(화면에 ②③ 글이 안 보임, 섞은 순서가 결과에 기록), 결과 복사 문자열. `tashkeel-make.mjs` 의 키 경로(헤더만·URL 검사·출력에 키 없음)를 코드로 다시 읽어 확인. 실제 생성은 하지 않는다.
6. **회귀**: 서재·리더·낭독(문장/줄 단위)·띠(8b)·원본·설정·퀴즈, 콘솔 0, 360px 가로 스크롤 0, 키 누출 0. 기존 번역 캐시 키(문장 `src`)가 인용·기호가 없는 문단에서 8h 전과 같은가.
7. 테스트 3회 이상 + 동시 실행. 변이 m1~m8 중 3개 이상 재현 + 새 변이 2개 이상(예: cite 판별의 길이 상한 제거, speaker 가 `readCitations=true` 일 때 tr 단계를 거르지 않게). 적용을 grep 으로 확인한 뒤 결과를 읽고, 스크래치패드 복사본으로 복원·`cmp`.

## 기록만 할 것 (고치지 말 것 — 운영자 결정 필요)
- Build 가 제안한 "출판 정보만인 문장(예: '2024;332:957.') + 바로 뒤 식별자" 규칙(CMDT 2026 에서 1,311개가 아직 읽힘) — 네 표본에서 그런 문장이 실제로 얼마나 거슬리는지 의견.
- 표 머리 "Affecting" 의 ff 자리가 제어 문자 U+001F 로 들어온다(추출). TTS 가 그 자리를 어떻게 읽을지 의견만.

## 고쳐도 되는 것
8h-1·8h-F 가 바꾼/만든 파일 안의 결함, D 의 최소 수정. 고치면 `node apps/medreader/dev/stamp-importmap.mjs` 를 다시 돌린다. `spec.md` 는 고치지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치, `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열(PDF 는 아래 세 경로만), 원서 문장 40자 초과 인용. 서버를 띄웠으면 끝나고 정리.
PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.

## review.md 절
결론(통과/조건부/불통과) · 오탐 검토(두 책, 표본 크기·결과) · Harrison 기호 · 브라우저 실동작 · D 재현 결과 · 8h-F 페이지 · 회귀 · 테스트·변이 · 고친 것 / 기록만 · 운영자 결정 필요 사항.
