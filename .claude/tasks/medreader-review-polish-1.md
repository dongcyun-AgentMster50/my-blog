# Review 지침 — 다듬기 묶음 1 (8g·8l·8k Review 작은 항목 15개)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"다듬기 1 Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
지침 `.claude/tasks/medreader-build-polish-1.md`(항목 1–15와 "하지 않는 것"), Build 보고 `.claude/tasks/medreader-build-polish-1-report.md`. 근거 Review 절: review.md "8k Review"·"8l Review"·"8g-4b Review"·"8g-4b-R1 Review". 변경: `git diff` + 새 `tests/polish-1.test.mjs`. 직전 커밋 `b3c3552`.

## 확인할 것
1. **범위**: 바뀐 파일이 항목에 필요한 것뿐인지, "하지 않는 것"(부분 OCR 20쪽 넘김·`reload` 시작점·412px 제목·Android 이름 줄·기본 태그)을 건드리지 않았는지. `index.html` 에 `data-i18n-aria` 속성 2개를 더한 것(지침의 "stamp" 범위 해석)이 적절한지. DB·algoVersion·SEARCH·SCAN 버전 불변.
2. **항목별 고침이 맞는지**(코드 + headless 직접): 1 퀴즈 첫 [읽기](Harrison 퀴즈로 **첫 누름**이 고른 목소리) · 5 412·360 띠 한 줄 · 6 검색 화면이 판정 이벤트로 안내 갱신 · 7 `common.dismiss` 네 언어 · 8 목차 이동 뒤 뷰 전환이 옛 적중으로 안 끌려감(`jumpOwnsPage` 가 다른 경로를 깨지 않는지 — 결과 이동 뒤 뷰 전환 S26·F2 는 여전히 적중 기준) · 9 띠 없을 때 멈춤 안내 배너가 뜨고 [▶]·떠남에 거둬짐(배너 거두기 이벤트가 다른 배너를 잘못 거두지 않는지) · 10 접기 단추 이름 · 12 sticky 탭 목록(상단바 실제 높이 측정 — 테마·글자 크기·언어에서 겹침 없음, 360px) · 13 접근성 이름.
3. **흔들리는 테스트 M7**: 원인 분석(시작 순서)이 맞는지, 고친 테스트가 원래 지키던 성질(같은 요청 공유)을 여전히 지키는지, **50회 이상** 차례·동시 실행.
4. **2번 항목의 코드 이동**(알림 코드를 `chooseTargetLang` 으로 옮김 — "동작 같음")이 정말 같은지.
5. **회귀**(headless Edge · 412×915 · ko·ar): 8k 기본 태그·고른 목소리·번역 언어 변경, 8i-3 쪽 넘김 낭독, 8i-1 B, 8g 결과 이동·[읽던 곳으로]·S26, 8g-4a F1, 8g-4b-R1 탭 키보드, 8l 스캔본 ▶·배지·띠, 8j manifest. 콘솔 오류 0. 8000번 python(PID 30352)은 쓰고 끄지 마라. **8123번 `npx http-server`(이 작업 밖에서 떠 있음)와 8124·8125번 node 는 건드리지 마라.** 프로필은 새로 만든 것 2개까지. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
6. 테스트의 힘: 너만의 변이 3개 이상. 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `rp1/bak/`.
7. spec 정정 6곳이 17-8-12 안에만 있고 Review 들의 권고와 맞는지.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1301 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `rp1/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제. PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`, 스캔본 확인이 필요하면 `G:/01_Language/01_English/` 원본 1개(읽기만).
