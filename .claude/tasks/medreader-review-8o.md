# Review 지침 — 8o 빈칸 낭독 (F5a)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8o Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 19-1-3 §6(8o)·L-D11 과 이번 정정 줄. 지침 `.claude/tasks/medreader-build-8o.md`, Build 보고 `.claude/tasks/medreader-build-8o-report.md`. 변경: `git diff`(text.js · config.js · index.html stamp · spec) + 새 `tests/blank-8o.test.mjs`. 직전 커밋 `48bf203`.

## 확인할 것
1. **불변**: 화면 글자·`ranges`·번역 요청 본문·캐시 키·검색 글자가 HEAD 와 같은지(네 스크립트 — 의학책 3권 + 해커스 표본). `speechBlanks` 가 낭독 사본에만 쓰이는지.
2. **의학책 영향**: CMDT 2026 한 쪽(운동 부하 점수 서식 "= ______" 3칸 → "blank")이 **유일한** 변화인지 세 권 전권으로 재현. spec §6 은 "의학책에서 0 이 아니면 Plan 으로" — 이 한 쪽이 진짜 빈칸 칸이라 "blank" 로 읽는 것이 맞는지 판단(운영자에게도 같은 질문이 가 있다).
3. **오탐 규칙**: 구분선(줄 전체가 꼴·`= + |`·공백뿐), URL·이메일, `---`·`--`·`—` 하나·`––`·`__`·범위·낱말 속 하이픈·줄 끝 하이픈 결합·목차 점선·`- - - -` 를 바꾸지 않는지(경계 표 직접). 해커스 오탐 의심 1개(Part 7 가격표 채움 기호) 판단.
4. **언어 선택**: 8m `Unit.lang` 우선·없으면 문서 언어·없으면 en·표에 없는 언어는 쉼표 — 해커스 한·영 단위에서 실제로.
5. headless Edge(412×915 · ko · 흉내 음성 · 새 프로필): 해커스 견본 "빈칸"/"blank" 발화와 목소리, 화면 꼴 그대로, 번역 요청 꼴 그대로. 회귀: 의학책 낭독·번역 띠, 8m 전환, 8i-3 쪽 넘김, 8k 목소리. 8000번 python(PID 30352)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
6. 너만의 변이 2개 이상. 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8o/bak/`.
7. Build 남은 문제 1–5 판정(특히 5: "------- 를" → "빈칸 를" 조사).
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1338 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8o/` 만(Build 의 `b8o/*samples.txt` 원문 조각은 레포에 옮기지 마라). 금지: 커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 해커스 경로는 8m 보고서(`.claude/tasks/medreader-build-8m-report.md`)에 있다(읽기만).
