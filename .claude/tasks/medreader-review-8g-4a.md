# Review 지침 — 8g-4a 검색 화면과 결과로 이동

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8g-4a Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
spec 17-8-12(§4 화면·§6 8g-4 줄·§7 S15·S20–S29·§8·§9), 17-8-5·17-8-7·17-8-8. carryover `.claude/tasks/medreader-8g4-carryover.md`(4a 몫 1–7·15). 지침 `.claude/tasks/medreader-build-8g-4a.md`, Build 보고 `.claude/tasks/medreader-build-8g-4a-report.md`(spec 문안 제안·남은 문제 1–5). 변경: `git diff`(reader.js · speaker.js · controls.js · router.js · library.js · index.html · css · i18n ×4 · 테스트) + 새 `js/ui/search.js`·`tests/search-ui-8g.test.mjs`. 직전 커밋 `e01ff2c`. Build 캡처: 스크래치패드 `shots-8g4a/`.

## 확인할 것
1. **보안**: 결과 조각·검색어·책 제목이 DOM 에 들어가는 모든 길이 `textContent`/요소 조립인지(innerHTML·insertAdjacentHTML 0 — grep), XSS 검색어(`<img src=x onerror=…>`·`"><svg …>`)를 네 손으로. 검색어가 URL·`localStorage` 밖으로 새지 않는지(최근 검색은 `settings` — 의도), 콘솔 로그에 검색어 0.
2. **회귀 — 가장 중요**: 8i-1(재추출 중 지금 쪽 다시 그리기·재생 대기), 8i-3(쪽 넘김 낭독 렌더 완료 알림), 8g-3(`scheduleOutline`), 기존 낭독·번역 띠·원본 보기·퀴즈·설정. **headless 로 직접**: 리플로우·원본 보기에서 쪽 끝까지 낭독 → 다음 쪽 첫 문장 1번(8i-3 재현 절차, review.md "8i-3 Review"), 옛 판 쪽 재생 대기(8i-1 B). 기존 테스트 전부 녹색.
3. **S20–S29 를 네 스크립트로**(Build 스크립트는 참고만): 360×740·412×915, 네 언어(아랍어 RTL 특히 S22), S23 세로 중앙 ±20%, S24 낭독 멈춤·[▶] 적중 문장·[읽던 곳으로]·번역 요청 0, S25 옛 판→새 판 강조, S26 언어·뷰 전환 뒤 강조, S27 표 적중, S28 뒤로·URL, S29 빈 결과 안내.
4. **S15 실측**(데스크톱 Edge, 실제 CMDT 2026 — 가능하면 CMDT 2021 도): 백필 ≤ 2초 · 첫 검색(화면 열고 2초 뒤 입력) ≤ 300ms · 다음 ≤ 50ms · 서재(백필 끝난 뒤). 실제 IndexedDB 의 할당량·versionchange 동작은 가능한 범위에서(carryover 11).
5. **carryover 1–7·15 가 실제로 반영됐는지** 하나씩(세 통로·앞 세대 무시·바꿔 그리기·책별 진행·저장소 찬 동안·테스트 보강).
6. **Build 남은 문제 1–5 판정**: ① 360px 퀴즈 버튼 보일 때 en·fr 리더 제목 0px ② 배너(sticky)가 상단바·띠를 덮음(기존 동작) ③ `cue` 뒤 컨트롤 바 "n번째 줄" 표시 늦음 ④ 제목 묶음 첫 줄 → 띠 번호가 중간("19/82") ⑤ S25 시간이 CDN 에 따라 달라짐. 각각 심각도와 **4b 에서 고칠지 / 따로 / 그대로**.
7. **테스트의 힘**: 너만의 변이 4개 이상(화면·라우터·pauseForJump/cue·세대). 변이는 이번 변경 파일에만. 복원 → `cmp`. 백업 스크래치패드 `r8g4a/bak/`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1184 기대), `stamp --check` 0.
9. Build spec 문안 제안 판정.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 8000번 서버(PID 30808, `python -m http.server 8000 --bind 127.0.0.1`)는 쓰고 끄지 마라. 8123번 `npx http-server`(node 18040·38960)는 이 작업과 무관하니 건드리지 마라. 브라우저 프로필은 새로 만든 것만 3개까지. 진짜 API 키 금지(가짜 키·흉내 응답은 스크래치패드 `shot-tool/step2.mjs` 참고). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g4a/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 원서 문장 40자 초과 인용. PDF 는 세 의학책 경로만: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
