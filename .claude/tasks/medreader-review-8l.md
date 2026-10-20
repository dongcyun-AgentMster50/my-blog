# Review 지침 — 8l 스캔본·글자 깨짐 감지와 안내

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8l Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 17-5-1 전체, 19-1-3 §3, 이번 정정 줄 4개. carryover `.claude/tasks/medreader-8l-carryover.md`. 지침 `.claude/tasks/medreader-build-8l.md`, Build 보고 `.claude/tasks/medreader-build-8l-report.md`(남은 문제 1–6). 변경: `git diff` + 새 `js/text/scan.js`·`tests/scan-8l.test.mjs`. 직전 커밋 `a4c8cfe`.

## 확인할 것
1. **판정 규칙이 spec 대로인가**(`scan.js` 줄 단위): 표본(10–90%·12칸 가운데·12쪽 이하 전부), 글자 0 판정 먼저, 75% 문턱, 이미지 확인 2쪽, `garbled` 5%·500자, 깨진 글자 정의(FFFD·PUA 두 구간·제어 — 공백 류 제외·서로게이트 쌍), `textOps`. 순수성(pdf.js·DOM 0).
2. **실물 판정을 네 스크립트로**(앱 `scanPdf` 또는 같은 순수 함수 + pdf.js 5.6.205): 의학책 3 → text · `G:/01_Language/01_English/` 원본 스캔본 2권 이상 → scan · 스피쿠스 원본 unit 2개 → garbled · Harry Potter 2 원본 → notext + textOps > 0 · `D:/OCR/01_English/` ` [OCR].pdf` 3권 이상 → text. (`G:`·`D:/OCR` **읽기만**.)
3. **저장·경첩**: `db.patch` 로 `scan` 필드만(다른 필드 보존 — 8g-3 `outline`·`pageLabels`, 7c 언어 필드 등), `SCAN.VERSION` 같으면 다시 안 돎, 표본 실패 시 저장 안 함, 판정 시작 시점(첫 쪽 뒤 또는 1.5초)이 리더 첫 화면을 늦추지 않는지.
4. **안내와 ▶**: 세 자리 문구·문서당 한 번(`noticed`)·[원본 보기], ▶ 갈래(`scan`/`notext` 시작 쪽 비면 play 안 함·쪽 그대로·noRead; `garbled` 는 막지 않음), 빈 쪽 안내 `reader.page.noText` 가 **모든 문서**에 나오는 것이 의학책의 빈 쪽(표지·그림 쪽)에서 거슬리지 않는지 — 의학책 실제 빈 쪽 몇 개로 확인.
5. **회귀**(headless Edge · 412×915 · ko·ar): 의학책 리더·낭독·번역 띠·검색·목차, 8i-3 쪽 넘김 낭독, 8i-1 B, 8g-4a F1. 콘솔 오류 0.
6. **speaker.js 변경**이 읽기 전용 `isQueueEmptyHere()` 하나뿐인지.
7. Build 남은 문제 1–6 판정(특히 1: 부분 OCR 문서에서 글자 있는 쪽 끝 → 빈 쪽 20쪽 넘김 — 별도 결정 필요한지; 3: 412px 띠 [닫기] 둘째 줄).
8. 테스트의 힘: 너만의 변이 3개 이상. 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8l/bak/`.
9. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1260 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 8000번 python(PID 15088)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 2개까지. 진짜 API 키 금지. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8l/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
