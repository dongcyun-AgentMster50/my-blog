# Review 지침 — 8m 영한 혼합: 문장별 글자 체계로 목소리 전환 (O2)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8m Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 19-1-2 2절(O2·2-6)·19-1-3 §4 와 이번 정정 줄, 결정 O-D4–O-D6·L-D7, **운영자 결정 2026-10-21**("섞인 단위는 문서 목소리, 10% 기준은 확인 완료로 넘어감"). 지침 `.claude/tasks/medreader-build-8m.md`, Build 보고 `.claude/tasks/medreader-build-8m-report.md`(남은 문제 1–9). 변경: `git diff` + 새 `js/text/lang.js`·`tests/mixlang-8m.test.mjs`. 직전 커밋 `e9e2336`.

## 반드시 따질 것 (가장 중요)
1. **`PROMPT_VERSION` 1 → 2 의 영향**: spec 7-5 번역 캐시 키에 프롬프트 판이 들어가는지 코드로 확인. 들어간다면 **이번 배포로 Nour·운영자의 기존 번역 캐시가 전부 무효**가 되어 다시 읽을 때 무료 한도를 다시 쓴다 — Build 는 "캐시 키 불변"이라고 했다. 사실인지, 판 올림이 `src` 항목에만 걸리는지, **`src` 없는 기존 요청의 프롬프트 글자가 1바이트도 안 바뀌는지**(캐시 적중·요청 본문 비교). 문제가 있으면 심각도 높음.
2. **단일 언어 책 무변**: 의학책 세 권 표본 쪽에서 켬/끔 큐 JSON 동일(Build 주장)을 **네 스크립트로**, 그리고 번역 요청 본문·캐시 키가 HEAD 와 같은지.
3. **미지원 원문(und) 문서의 라틴 문장이 이제 en 목소리**(Build 남은 문제 6) — 이전 동작과 무엇이 달라졌는지, 사용자가 겪을 변화(나빠지는 경우 있는지), spec 결정과 맞는지.
4. **readStats 에서 대상 언어와 같은 문장이 빠짐**(남은 문제 7) — 읽은 양·진도·한도 표시 등 다른 화면에 영향.

## 확인할 것
5. 판별 `unitLang`(순수) 규칙이 spec 과 시제품(`dev/measure-mixlang-o2.mjs`)과 같은지 — 87개 파일 일치 주장 표본 재현.
6. speaker 전환·실패 되돌리기(`SWITCH_NO_VOICE` 한 번, 세션 동안 끔, 같은 단위 문서 언어로 다시), 8k `resolveSpeech` 공유, 번역문 단계 없음 띠 표시.
7. **headless Edge**(412×915 · ko·ar · Nour 모양 음성 · 가짜 키·흉내 번역): 해커스 견본(`G:/01_Language/01_English/` — 읽기만, Build 보고서의 경로) 한·영 전환, 설정 끔, 번역 요청 생략·`src`. 회귀: 의학책 낭독·번역 띠·**번역 캐시 적중**(이미 번역한 문장을 다시 읽을 때 요청 0인지 — 판 올림 영향 확인), 8k 목소리, 8i-3 쪽 넘김, 8g 결과 이동 뒤 [▶], 8l 스캔본 ▶. 콘솔 오류 0. **새 프로필로 매 시나리오**(Build 의 두 번째 실행 오판 원인). 8000번 python(PID 30352)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 3개까지. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
8. 테스트의 힘: 너만의 변이 3개 이상. 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8m/bak/`.
9. spec 정정 줄, Build 남은 문제 1–9 판정.
10. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1322 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8m/` 만. 원서 문장 40자 초과 인용 금지(스크래치패드 `b8m/s1–s4.json` 은 원문 예시가 있으니 레포에 옮기지 마라). 금지: 커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
