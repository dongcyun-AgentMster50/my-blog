# Build 지침 — 11-4c: 실패 배너가 문맥을 벗어나 남음 (아주 작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "11-4b 재검증" 절 — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-11-4b-fix.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-11-4c-fix-report.md`. 스크래치패드 `b11-4c/`(`r11-4b/` 는 읽기만 — `run-v.mjs` 재사용).

## 고칠 것
1. **중간-1**: `explain.failed` 배너·[다시 시도]가 리더를 떠나도·쪽을 넘겨도·다른 문서를 열어도 남아, 누르면 옛 문장을 지금 문서의 정보로 보낸다. **두 겹으로**: (가) `trband.leave()`·쪽이 바뀌는 자리(`closeTap` 등)에서 그 배너를 거두고 `noteRetryFn = null`; (나) [다시 시도]가 실패 때의 `docId`·쪽(`pageNo`)을 들고 있다가 지금과 다르면 부르지 않음(배너만 거둠). 시험: 문서 바꿈·서재·쪽 넘김 각각 → 요청 0·배너 없음.
2. 낮음-3: 시험 틈 — 진짜 `noteBanner` 의 "단추 하나"(R1)·"마지막 실패 문장"(R3) 한 줄씩.
- 낮음-2(단추 A 말하는 중 음성 B → B 끝나도 이어 읽지 않음)는 11-4 때와 같음 → crossstep 다듬기 후보 줄.

## 검증
- Review `run-v.mjs` 의 D·E·F(다른 문서·서재·쪽 넘김) 다시 → 요청 0·배너 없음, 나머지 값은 11-4b 재검증과 같음.
- 요청 본문 HEAD 와 같음(`r11-4/rbody.mjs`), 9b 말뭉치 변화 0.
- 변이 2개 이상(1(가)·(나) 각각 되돌림) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b11-4c/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0.
- headless 한 번(Edge, pipe, 새 프로필 `b11-4c/p1`, 가짜 키, 흉내 Gemini·음성, 캐시 끔, 서버 띄우기 금지): D·E·F + 같은 문맥 [다시 시도] 1호출. 콘솔 오류 0.
- spec 17-2-1 4-7 `[정정 2026-11-17 — 11-4b]` 줄 뒤에 `[정정 2026-11-17 — 11-4c]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/ui/trband.js`·`js/ui/ask.js`·`js/ui/controls.js`(배선 한두 줄)·`tests/explain-11a.test.mjs`·`index.html`(stamp)·`spec.md`(한 줄)·`.claude/tasks/medreader-crossstep-notes.md`(후보 줄 덧붙이기만)·스크래치패드 `b11-4c/`·보고서. **12-1 지침 파일은 건드리지 마라.**

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
