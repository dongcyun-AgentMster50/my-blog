# Review 지침 — 8g-7b (8g-7 Review 수정 + 별칭 6개)

> 너는 **Review 서브에이전트**다(8g-7 Build·Review·8g-7b Build 와 다른 새 에이전트). 직접 확인한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8g-7b Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 8g-7 + 8g-7b 를 한 번에 배포한다 — **배포 판정**까지.

## 읽을 것
review.md "8g-7 Review"(8g7R-1–11 — 특히 중1·중2·중3·하·테스트 공백), 지침 `.claude/tasks/medreader-build-8g7b.md`, Build 보고 `.claude/tasks/medreader-build-8g7b-report.md`(9절 별칭 6개 추가·부수 효과 3개 포함), spec 19-1-4 2-4 의 8g-7·8g-7b 정정 줄. 변경: `git diff` 전체(8g-7 + 8g-7b, 기준 `c6352a4`). 8g-7 Review 의 질의·하네스는 스크래치패드 `r8g7/`(읽기만).

## 확인할 것
1. **중1·중2·중3 해결**: 8g-7 Review 의 질의 153개(`r8g7/ar-out.txt`)와 네가 새로 만든 질의(접두 و/ب/ل·정관사·ة/ه·ى/ي·أ/إ/ا·복수·쌍수·두 낱말 순서 바꿈 — 30개 이상) × 세 권 실물 개요에서 **틀린 장 0**. 모호한 접은 꼴 규칙(`معد`)이 사전에서 자동 계산되는지, 새 별칭이 생기면 따라가는지.
2. **잃은 것**: 첫 낱말 규칙·`FALLBACK_MAX = 1` 로 "맞음 → 없음"이 된 질의 목록이 Build 보고와 같은지, 부수 효과 3개(«القلب والأوعية» → 심장+혈관, «فيروس» → Viral, «فيروس نقص المناعة» → 바이러스+면역)가 받아들일 만한지 의견.
3. **조각 캐시(중3)**: 검색어를 바꾸면 앞 검색어 조각·`<mark>` 가 남지 않는지(같은 책·같은 쪽 줄, 빠르게 연달아 바꾸기 포함), 첫 검색 화면·라틴 결과 JSON 은 HEAD 와 같은지.
4. **폴백 머리 안내**, R1(`emptyNotice`) 출력 불변.
5. 영어 검색 무변: 세 권 표본 + 라틴 검색어(8g-7 Review 와 다른 것 20개 이상)로 HEAD(`c6352a4`)와 `cmp`.
6. headless Edge(아랍어 UI 412×915 · 새 프로필 2개까지 · 가짜 키): 1·3·4 화면 확인, 콘솔 오류 0. 8000번 python 은 **PID 45964** — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 진짜 API 키 금지. Edge 는 `browser.close()` 로 닫고 디버깅 포트가 닫혔는지 확인.
7. 너만의 변이 2개 이상(Build M1–M8 과 다른 것) → 복원 **읽어서 쓰기 + `cmp`**, 백업 `r8g7b/bak/`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1384 기대), `stamp --check` 0, `git diff --check`, js/ 에 제어 문자 0(Build 보고 5 — heredoc 사고), `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지. C: 남은 공간 5GB 아래면 멈추고 보고. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g7b/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive` 로 스크래치패드에), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
