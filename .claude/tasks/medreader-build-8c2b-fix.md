# Build 지침 — 8c-2b: 8c-2 Review 지적 고치기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8c-2 Review" 절(8c2R-1~10) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8c2-usage.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8c2b-fix-report.md`. 스크래치패드 `b8c2b/`(Review 의 `r8c2/` 는 읽기만 — `rdiff.mjs` 재사용 가능).

## 고칠 것
1. **중간-1 — 자정 경계**: `checkWarn` 이 시계를 두 번 읽는다. `const t = now(); const day = localDay(t);` 로 한 번 읽고 행 읽기·`bumpUsage(…, {now: t})` 에 같은 `t` 를 쓴다. 시계가 읽기 사이에 자정을 넘는 시험 하나(Review "경고 행을 읽은 직후 자정" 재현 → 고친 뒤 다음 날 경고 1번).
2. 낮음-3: 비동기 구독자의 거절도 잡는다(`Promise.resolve(fn(…)).catch(…)` 꼴 — 번역 흐름은 기다리지 않음). 시험 하나.
3. 낮음-5: 90일 지우기 경계를 가르는 시험(89·90·91일 행 — 30일로 바꾸는 변이 RM2 가 빨강이 되게).
4. 낮음-4 ①: 상한이 작아 80% 문턱이 상한과 같아지면(예: 3/3) 80% 경고를 띄우지 않는다(상한 도달 안내만) — 설계 4-7 의 뜻과 맞는지 보고 맞으면, 아니면 보고서에만.
- 낮음-2(두 탭 동시)·4②(360 ar 배너 줄 수)·7(아랍어 복수)은 다듬기 후보 — 고치지 않는다.

## 검증
- Review `rdiff.mjs` 시나리오 10개를 HEAD·작업 트리로 다시 — 요청 본문·사용량 행(`capWarned` 제외)·이벤트 HEAD 와 같음, 자정 시나리오만 의도대로 바뀜.
- 변이 3개(1·2·3 각각 되돌림) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8c2b/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0. headless 는 하지 않는다(파이프라인 경고 경로·순수 함수만).
- spec 17-7-6 4-7 의 `[정정 2026-11-16 — 8c-2 Build]` 줄 뒤에 `[정정 2026-11-16 — 8c-2b]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/ai/pipeline.js`(`checkWarn`·구독자 호출만), `js/ui/usage.js`(필요하면), `tests/usage-8c.test.mjs` 또는 새 시험 파일, `index.html`(stamp), `spec.md`(한 줄), `.claude/tasks/medreader-crossstep-notes.md`(다듬기 후보 줄 덧붙이기만), 스크래치패드 `b8c2b/`, 보고서.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 서버 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
