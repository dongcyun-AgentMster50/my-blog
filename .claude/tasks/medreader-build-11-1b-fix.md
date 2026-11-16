# Build 지침 — 11-1b: 11-1 Review 지적 고치기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "11-1 Review" 절 — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-11-1-summary-service.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-11-1b-fix-report.md`. 스크래치패드 `b11-1b/`(`r11-1/` 는 읽기만 — `trunc.mjs`·`chk.mjs`·`rdiff.mjs` 재사용).

## 고칠 것
1. **중간-1 — 잘린 응답의 반쪽 요약이 캐시됨**: 응답이 잘렸으면(`finishReason` `MAX_TOKENS` 또는 `jsonrepair` 가 잘린 꼬리를 복구한 경우 — 지금 코드가 이를 알 수 있는 신호를 찾아 쓰고, 없으면 provider/adapter 의 응답 파서가 넘기는 값으로) **요약·개요 job 만** 마지막 항목을 MISSING(실패·캐시 저장 0·[다시 시도])으로. **번역·단어 job 은 지금 동작 그대로**(요청 본문·결과 바이트 불변). 시험 3꼴(둘째 요점 안·둘째 용어 안·요지 안에서 잘림) + 개요 한 꼴.
2. **중간-2 — 길이 자르기가 숫자를 쪼갬**: 요지·원문 요지·용어를 자른 **뒤** 숫자 검사를 한 번 더(또는 자르기를 숫자 경계를 피해). 시험: 입력 `1500` 이 600자 경계에 걸려 `15` 가 되는 꼴 → 그 필드 실패/빠짐.
3. 낮음-6: ko 문체 문장이 "Write the Korean text in Korean" 처럼 겹치면 한 번만(작으면). 지시문 바이트가 바뀌므로 `SUMMARY_PROMPT_VERSION` 을 올릴지 판단(아직 배포 전이라 1 그대로 두어도 됨 — 이유를 보고서에).
- 낮음-3(출력 토큰)·4(`numberTokens` 한계 — 번역과 공용)·5(개요 범위 이름 — 11-3 몫)는 고치지 않는다 → crossstep 후보 줄(5 는 11-3 줄로, 4 의 fr·es 숫자 꼴은 다듬기 후보로).

## 검증
- Review `trunc.mjs`·`chk.mjs` 다시 — 잘림 꼴에서 반쪽 캐시 0, 숫자 쪼갬 통과 0.
- **번역·단어 경로 불변**: `rdiff.mjs`(HEAD 대조) `allSame:true`.
- 변이 2개 이상(1·2 각각 되돌림) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b11-1b/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0. headless 하지 않는다(파이프라인·검증 함수만 — 바이트 대조는 node).
- spec 17-2-1 4-1 의 `[정정 2026-11-17 — 11-1 Build]` 줄 뒤에 `[정정 2026-11-17 — 11-1b]` 한 줄(잘림 처리 문구 정정 포함 — Edit 로 그 자리만).

## 수정 범위
`js/ai/pipeline.js`(요약·개요 job 의 accept 갈래만)·`js/ai/prompts.js`(`checkSummary`·개요 검증·문체 문장만)·(잘림 신호가 필요하면) `js/ai/adapters/gemini.js`·`js/ai/provider.js` 의 응답 파싱 **한두 줄**(번역 결과 바이트 불변을 시험으로)·`tests/summary-11b.test.mjs`·`index.html`(stamp)·`spec.md`(한 줄)·`.claude/tasks/medreader-crossstep-notes.md`(후보 줄 덧붙이기만)·스크래치패드 `b11-1b/`·보고서. **11-2 지침 파일(`.claude/tasks/medreader-build-11-2-sumsheet.md`)은 다른 단계 것 — 건드리지 마라.**

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
