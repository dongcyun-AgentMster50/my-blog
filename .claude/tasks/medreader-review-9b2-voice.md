# Review 지침 — 9b 음성 명령 (9b-1 손질 + 9b-2 화면·배선) — 배포 전 최종

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"9b-2 Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 9b-1 + 9b-2 를 한 번에 배포한다 — **배포 판정**까지.

## 읽을 것
spec 17-1-2 전부(결정 9b-D1–D14)와 끝의 `[정정 2026-11-15 — 9b-1·9b-2 Build]` 묶음. 지침 `.claude/tasks/medreader-build-9b2-voice.md`, Build 보고 `.claude/tasks/medreader-build-9b2-voice-report.md`(5절 D1–D15·6절 실기기 점검·남은 문제 1–5), review.md "9b-1 Review". 운영자 결정(2026-11-15): ① 한 낱말 동의어 포함 일치는 말 전체 3낱말 이하일 때만 ② 맞은 구 밖에 부정어면 그 대안 무효. 변경: `git diff`(기준 `344aada`) + 새 `js/voice/*`·`js/ui/voice.js`·`tests/voice-*`.

## 반드시 따질 것
1. **잘못된 동작이 나지 않는지**(가장 중요): Review 말뭉치(`r9b1/corpus.mjs`·`neg.mjs` — 읽기만) + **네가 새로 만든 발화 60개 이상**(Build 가 본 적 없는 것 — 레반트 일상어·의학 문장·영어 대화·부정문·두 명령·군말)로 오탐·혼동·부정문 반대 동작 수. Build 가 남긴 오탐 4개(«رح ارجع عالبيت» 등) 의견.
2. **남은 문제 1 — 운영자 결정 재료**: 결정 ② 를 대안마다 적용하면 첫 대안 "don't stop" 은 무효인데 둘째 대안 "stop" 으로 멈춘다. "**부정된 대안이 하나라도 있으면 그 누름 전체 무효**"로 바꿀 때 놓침이 얼마나 느는지(말뭉치로 계산 — 앱은 고치지 말고 가정 시험) 숫자와 권장.
3. **기존 동작 무변**: `tts/speaker.js` 는 `again()` 하나만, 9a 핸들러·[▶]·[이전]·[다음]·줄 탭이 듣지 않을 때는 9b 전과 같은지, `voice.enabled=false` 면 마이크 단추 0·9b 전과 같은지, AI 호출 0.
4. **D1–D15**(Build 가 설계에서 정한 것) 각각 타당한지 — 특히 statechange 그물(다른 길로 읽기가 시작되면 듣기 취소), 9a 에 주는 `isListening` 에 안내 대기 포함, 쪽 끝 next.

## 확인할 것
5. headless Edge(412×915·375·360·915×412 · ko·ar·en·fr · 가짜 `SpeechRecognition` 주입 · 흉내 음성·흉내 Gemini(OPTIONS 처리) · 새 프로필 `r9b2/p1`·새 포트): 마이크 단추 56px·ar 거울 배치·넘침 0·좁은 바(`data-bar-tight`), 고지 카드 처음 한 번(가로 915×412 에서 화면 안), 명령 9개·이어 읽기·실패 안내·[말해 보기]·[결과 복사], 듣는 중 [▶]·9a·hidden 취소, 띠·8d·8i-3 회귀, 콘솔 오류 0.
6. 고지(13절): 음성이 Google 서버로 갈 수 있다는 것이 처음 쓸 때 보이고, 문구가 사실과 맞는지.
7. 너만의 변이 3개 이상(Build 10개와 다른 것) → 복원 **읽어서 쓰기 + `cmp`**, 백업 `r9b2/bak/`.
8. 실기기 점검 묶음(보고서 6절)이 빠진 것 없는지.
9. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1455), `stamp --check` 0, `git diff --check`, `.nojekyll`. **배포 판정.**

## 규칙
**명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 이전에 쓴 포트·프로필 쓰지 마라. 8000번 python 은 떠 있다 — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 앱·테스트·spec 은 고치지 않는다(변이는 되돌린다). 스크래치패드는 `r9b2/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
