# Review 지침 — 15-2 복습 묶음 화면 · 퀴즈 AI 갈래 (+ 15-1 · 15-1R 고침, 함께 배포 전)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "15-2 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지 — 덧붙인 뒤 U+2028·U+2029·U+FEFF·NUL·CR 수 점검). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r15-2\`(먼저 만들 것). `b15-2/`·`r15-1/`·`b15-1/` 은 읽기만 — 하네스 재사용 가능.

## 볼 것
spec 17-13 전부(+ 정정 줄 15-1·15-2), review.md "15-1 Review" 절, 지침 `.claude/tasks/medreader-build-15-2-review-ui.md`(앞 "먼저 고칠 것" 포함), 보고서 `.claude/tasks/medreader-build-15-2-review-ui-report.md`(믿지 말고 다시 재라), `git diff`(15-1 + 15-2 함께 미커밋, 기준선 HEAD a3cad4c) + 새 파일.

## 확인할 것
1. **15-1R 중간-1 닫힘(가장 중요)**: `r15-1/ground.mjs` 다시 + **네가 새로 짠 지어낸 인용 꼴 6개 이상**(Build·15-1R 이 안 쓴 것 — 단위 바뀜 `mg`→`g`, 부정어 빠짐 `not`, `<`↔`>`, 낱말 하나 바꿈, 순서 바꿈, 아랍-인도 숫자 바꿈)이 폐기되는가, 정당한 2차 통과는 그대로인가. 틀린 근거 통과 1건이라도 = 중간.
2. **분배·되풀이**: `sentParaIds` — 9c 내보내기/가져오기 멱등, 다시 추출 뒤 문단 id 가 바뀌면 보낸 횟수 셈이 어떻게 되는가(망가지지 않고 퇴화만인가), 문항이 rejected 일 때도 셈. Build 표(3번 누름 문항 쪽 15쪽, 되풀이 1.00배)를 CMDT 2026 다른 장 하나로 다시(읽기만 — `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, Downloads 목록 보지 말 것, pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`; 숫자만).
3. **묶음 화면**: 칸 1–7 빈 칸 숨김, 진도 = `@read`, 원서 섹션 겹침, AI 문항 수·지난 점수, 카드 범위 수 = 12-3 범위 화면 수, 필기 n = 20-3 범위 화면 줄 수, 고지 줄, 입구 셋 같은 범위. 열기·범위 바꾸기·풀기 요청 0.
4. **퀴즈 화면 회귀**: 원서 📕 퀴즈(채점·해설·진도·`mistakes`) HEAD 와 같음, AI 문항 섞임 0, rejected 거름, 🤖 배지·근거 블록·`[원문에서 보기]`(원본 보기에서는 쪽만 — 남은 3), `quiz.ai.expected` 문구.
5. **rangepick 옮김 회귀**: 11-3(깊이 0 만 — 남은 1 결정 거리: 그대로 둘지 0·1 로 맞출지 권장안)·13-2 화면이 HEAD 와 같음.
6. **파일 손상**: Build 가 `ui/quiz.js` CRLF 사고·Write 이스케이프 사고(`\u2068`·`\u2069`·`\u00AD`)를 되돌렸다고 한다 — 바뀐 모든 파일의 CR·NUL·U+2028·U+2029·U+FEFF·U+2066–2069·U+00AD 수를 HEAD 와 견줘라. `router.test.mjs` NUL 그대로.
7. 요청 본문 바이트 HEAD 와 같음(번역·낭독·요약·설명), 출제 요청 본문에 읽은 쪽 문단만, 콘솔 오류 0(하네스 429 네트워크 줄 제외), `innerHTML` 새 사용 0(AI 줄기·보기·해설·근거 `<img onerror>`).
8. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
9. 변이 3개 이상 네가 고른 곳(Build M1–M4·R1–R3 와 다르게 — grounding 하나·묶음 화면 숫자 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r15-2/bak/`). 변이 적용 확인은 `cmp`·Read 로.
10. headless: Edge, pipe, 새 프로필 `r15-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF(원서 문제 있는 것·없는 것). 3크기 × 4언어, 48px, 넘침 0, RTL.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 지어낸·틀린 근거가 통과, 원서 퀴즈 회귀·AI 섞임, 읽지 않은 쪽 글이 보내짐, 자동 호출·요청 늘어남, 번역 등 요청 본문 바뀜, 화면 숫자 ≠ 원천, 9c 멱등 깨짐, 파일 손상, XSS, 콘솔 오류, 테스트 손상.
- **낮음**(→ "배포 가능"): 문안·실기기 확인 거리·11-3 깊이 결정 거리·fr 기존 영어 문구.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지 — 시험도 절대 경로로 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. 원서 글은 옮기지 말 것(숫자만). 수정 범위: `review.md` 끝 절, 스크래치패드 `r15-2/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
