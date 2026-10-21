# Review 지침 — 8p 번역 문체: 문서 속성 `domain` (F6 · L-D4)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8p Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 19-1-3 §7·L-D4·L-D9, 10-1(이번 정정 — promptVersion 은 캐시 **값**), 7-5. 지침 `.claude/tasks/medreader-build-8p.md`, Build 보고 `.claude/tasks/medreader-build-8p-report.md`(남은 문제 1–4). review.md "8m Review"(캐시 실측 방법). 변경: `git diff` + 새 `tests/domain-8p.test.mjs`. 직전 커밋 `baa358c`.

## 반드시 따질 것
1. **Nour 의 의학 번역 무변**: domain 이 없거나 `medical` 이면 system·user 지시문이 `baa358c` 와 **1바이트도 다르지 않은지**, 요청 본문·캐시 키·청크 경계까지 같은지 — 의학책 3권 × 대상 ar·ko 를 **네 스크립트로**. HEAD 가 채운 캐시로 **재요청 0**.
2. **캐시 키 불변**: domain 이 키에 들어가지 않는지(코드 + 실측), general 로 바꿔도 옛 번역 적중.
3. **general 지시문**: 바뀐 곳이 ROLE 한 줄과 작업 지시 한 줄뿐인지, **안전 규칙 1–6 그대로**(의료 안전 13절), 스키마·토큰 상한 같은지. 문안이 일반 교재 번역에 맞는지 의견(운영자 검토용).
4. **spec 10-1 정정**이 7-5·코드와 맞는지.
5. **Build 남은 문제 1**: §7 의 "캐시 값에 domain 기록(진단)" 미구현 — 지금 넣어야 하는지(나중에 넣으면 그 전 캐시엔 기록이 없다는 것 말고 손해가 있는지) 판정.

## 확인할 것
6. 데이터·화면: `documents.domain` 기본 `medical`, `db.patch` 자기 필드만(다른 필드 — `scan`·`outline`·언어 — 보존), 서재 [⋯] 단추 네 언어·RTL·`aria-pressed`, 같은 값/모르는 값 쓰지 않음.
7. headless Edge(412×915 · ko·ar · 가짜 키·흉내 응답 · 새 프로필): 의학 → 일반 전환, 다음 요청 지시문, 옛 캐시 적중. 회귀: 8m 전환·`src`, 8o 빈칸, 8i-3 쪽 넘김, 8k 목소리, 번역 띠. 8000번 python(PID 30352)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
8. 너만의 변이 2개 이상. 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8p/bak/`. Build 가 고친 흔들림(P8-6 조건 대기)이 안정적인지 반복 실행.
9. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1347 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8p/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. 해커스 경로는 `.claude/tasks/medreader-build-8m-report.md`(읽기만). pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
