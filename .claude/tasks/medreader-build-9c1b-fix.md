# Build 지침 — 9c-1b: 백업 키 지우개 과잉 일치 고치기 (작음, 배포 전)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "9c-1 Review" 절(9c1R-0~10) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-9c1-export.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9c1b-fix-report.md`. 스크래치패드 `b9c1b/`(`r9c1/`·`b9c1/` 는 읽기만).

## 고칠 것
1. **#1 — 지우개가 키가 아닌 글자를 지움**: 백업 줄 지우개(모든 글자 값에 `REDACT_PATTERNS` 를 그대로 씀)가 하이픈 합성어(`low-risk-to-moderate-risk` → `low-ri[KEY]`)·일반 낱말("Bearer of …")을 지운다. 고침: 백업 지우개는 **키 꼴에만** 걸리게 — `sk-` 에 왼쪽 경계(`(?<![A-Za-z0-9-])`)와 키 글자 집합·최소 길이, `Bearer` 는 뒤 토큰이 키 꼴(최소 길이·글자 집합 — 낱말이 아닌 것)일 때만, Google 꼴(`AIza…`·`AQ.…`)은 그대로. **`REDACT_PATTERNS` 자체(다른 곳 — 로그·요청 검사)를 바꿀지**는 그것을 쓰는 곳을 모두 보고 판단 — 다른 곳의 동작이 바뀌면 백업 전용 패턴을 따로 두고 이유를 보고서에. 가짜 키 4종은 여전히 0건(K4)이고, 합성어·"Bearer of"·`sk-learn`·`task-sk-1234567890abcdef` 꼴 정상 글은 그대로(시험 한 줄씩). `search.recent` 행이 통째로 빠지는 것도 같은 원인 — 정상 검색어로는 빠지지 않게.
2. **#1 후반 — term 병합 "시각이 같으면 파일"**: 백업 병합(`mergeRecord` 의 term 갈래)에서 `updatedAt` 이 같으면 **기기 값 유지**(문장 카드·필기·문서와 같게). `importPlan`(CSV) 규칙은 바꾸지 말고 백업 갈래에서만(이유: 백업은 같은 기기 왕복이 흔함). K10f 에 시험 한 줄.
3. #2 — spec 17-4-1 ⑦ 의 "압축 단계 메모리는 데이터 크기와 무관" 문구를 Review 실측(¼ +41 · ½ +59 · 전체 +124MB, gc 뒤 0 — 크기에 비례)으로 고치는 정정 한 줄.
4. #6 — 13절 백업 파일 행 "`privacy.*` 없음"에 `privacy.piiCheck` 예외 한 줄(정정 표시).
- 나머지(#3·#4·#5·#7·#8·#9·#10)는 고치지 않는다 — crossstep 다듬기·9c-2 후보 줄로 덧붙인다(#10 `lineSplitter` 줄 길이 상한은 **9c-2** 줄로).

## 검증
- 변이 2개 이상(1 의 경계 빼기 → 합성어 시험 빨강, 2 를 "같으면 파일" 로 → K10f 빨강) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b9c1b/bak/`).
- 키 0건 시험(K4)·정적 import(K5) 그대로 통과. `REDACT_PATTERNS` 를 건드렸다면 그것을 쓰는 다른 시험 전부 통과.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0. headless 하지 않는다(순수 함수만).
- spec 17-4-1 `[정정 2026-11-17 — 9c-1b]` 한 줄 + 13절 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/text/backup.js`(+ 필요하면 `js/config.js` 의 백업 전용 패턴), `tests/backup-9c.test.mjs`, `index.html`(stamp), `spec.md`(두 줄), `.claude/tasks/medreader-crossstep-notes.md`(후보 줄 덧붙이기만), 스크래치패드 `b9c1b/`, 보고서. `REDACT_PATTERNS` 를 정의한 파일을 고쳐야 하면 이유와 영향 범위를 보고서에(다른 곳 동작이 바뀌면 고치지 말고 백업 전용으로).

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
