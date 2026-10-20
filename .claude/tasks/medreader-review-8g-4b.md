# Review 지침 — 8g-4b 목차 탭과 검색 마무리 (8g 마지막 — 통과하면 8g-2~4 배포)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8g-4b Review"** 절로 덧붙인다(앞 절은 고치지 않는다).
> 이 Review 가 통과하면 오케스트레이터가 8g-2 부터 쌓인 커밋을 **한 번에 배포**한다 — **배포 판정**까지 내려라.

## 읽을 것
spec 17-8-12(§4 화면·§7 S19·§11·§9 되돌림)와 이번 정정 줄 12개(`[정정 2026-10-20 — 8g-4b …]`), 17-8-5. carryover `.claude/tasks/medreader-8g4-carryover.md`(8–25). 지침 `.claude/tasks/medreader-build-8g-4b.md`, Build 보고 `.claude/tasks/medreader-build-8g-4b-report.md`(7절 spec 제안·9절 실기기 목록·남은 문제 1–6). 변경: `git diff` + 새 `tests/search-toc-8g4b.test.mjs`. 직전 커밋 `c36e8e4`. Build 캡처: 스크래치패드 `shots-8g4b/`.

## 확인할 것
1. **S19 를 네 스크립트로**(headless Edge · 360×740 · 412×915 · 네 언어): 세 의학책 목차(37·61·50, Harrison 깊이 2 들여쓰기, CMDT 2026 "p. {인쇄} (PDF {쪽})", `p:null` 흐리게·못 누름), 쓰레기 개요 교재(Essential Grammar 2판 — `D:/OCR` 읽기만)는 폴백 + 머리 문구 + 파일 이름 0, 폴백 교재 1권, 지금 쪽 항목 표시, 누르면 그 쪽 맨 위, 뒤로 = 탭·스크롤 유지, 낭독 중 목차 이동 → 멈춤·번역 0·[▶] 그 쪽 첫 줄. pdf.js 를 못 받는 경우(`unavailable`).
2. **4a 작은 문제 고침**: ① 360px 퀴즈 버튼 보일 때 제목 폭·[⧉] 글리프(48×48·한 줄·가로 스크롤 0 유지) ③ 이동 직후 진행 칸 · F2 원본 → 리플로우 복귀 적중 위치·[▶] · F3 다른 책 결과 → `leaveReaderNow` 정리(낭독 상태·번역 0·빈 띠가 서재에서 연 것과 같은지).
3. **회귀 — 배포 전 마지막이라 넓게**: 8i-3 쪽 넘김 낭독(리플로우·원본), 8i-1 B(옛 판 재생 대기)·다시 그리기, 4a 의 S20–S29 중 이번 변경이 닿은 것(S23·S24·S26·S28 등), F1(8g-4a-fix) 재현 절차, 퀴즈·설정·번역 띠 기본 동작. 기존 테스트 전부 녹색.
4. **R2 약어 변경**: 앱과 기준 정의가 글자 그대로 같은지, S36 을 **네가 다시**(94권 — 의학 3 + `D:/OCR` ` [OCR].pdf` 91, 읽기만): 차이 0, 의학책 S18 회귀 0, 빠진 항목이 한글 문장 끝 150개뿐이고 새로 들어온 항목 0.
5. **spec 정정 12줄**이 17-8-5·17-8-12 안에만 있고 carryover·Review 판정과 맞는지. Build 7절 제안(목차 탭 세부·F2·①)을 spec 에 넣을지 의견.
6. **Build 남은 문제 1–6 판정**: ① speaker `reload` 시작점 밀림(검색과 무관, 범위 밖) ② 목차 이동 멈춤 안내가 띠 없으면 안 보임 ③ 한 쪽 여러 항목 중 마지막이 "지금" ④ "p. Cover (PDF 1)" ⑤ 412px 에서는 ① 고침이 적용 안 됨(Nour 기기 412px) ⑥ 스피쿠스 한글 목차 `lang=en`. 각각 심각도와 **배포 전 / 다음 단계 / 그대로**.
7. **테스트의 힘**: 너만의 변이 3개 이상(이번 변경 파일에만). 복원은 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8g4b/bak/`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1228 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음.
9. **배포 판정**: 8g-2~4b 전체(로컬 커밋들 + 이번 변경)를 배포해도 되는지, 배포 전에 꼭 고칠 것이 있으면 무엇인지.

## 규칙
모든 실행에 시간 상한(94권은 전체 상한). 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 8000번 python(PID 15088)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. 브라우저 프로필은 새로 만든 것 2개까지. 진짜 API 키 금지(가짜 키·흉내 응답은 스크래치패드 `shot-tool/step2.mjs`). `D:/OCR` 는 읽기만. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g4b/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
