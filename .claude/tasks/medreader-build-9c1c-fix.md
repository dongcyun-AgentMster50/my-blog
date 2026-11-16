# Build 지침 — 9c-1c: `sk-` 왼쪽 경계 틈 막기 (아주 작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "9c-1b 재검증" 절(9c1bR-0~8) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-9c1b-fix.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9c1c-fix-report.md`. 스크래치패드 `b9c1c/`(`r9c1b/` 는 읽기만 — `probe`·`fixa`·`corpus` 스크립트 재사용 가능).

## 고칠 것
1. **중간-1**: `BACKUP.KEY_PATTERNS` 의 `sk-` 꼴을 Review 의 (a)안으로 — 앞 글자가 영숫자·하이픈이 아니거나, **URL 인코딩 `%XX` 뒤**, **글자 그대로 적힌 이스케이프(`\n`·`\t`·`\r`·`\b`·`\f`·`\"`·`\'`·`\/`·`\uXXXX`) 뒤**면 지운다. K4b 에 `%20sk-…`·글자 그대로 `\nsk-…`·`\u0022sk-…` 한 줄씩.
2. 낮음-2: `Bearer` 토큰 조건을 "숫자 하나 이상 **또는** 20자 이상"으로(12자 하한 유지). 시험 한 줄(숫자 없는 32자 → 지움).
3. 낮음-4(선택 — 작으면): `bearer`/`BEARER` 대소문자 무시, `Bearer%20`·`Bearer:` 뒤 토큰. 정상 글 보존 시험(K4b 의 "Bearer of"·"bearer bonds" 등)이 그대로면 넣고, 아니면 보고서에만.
- 낮음-3 은 1번으로 함께 막힌다(확인만).

## 검증
- Review `r9c1b/probe.mjs`·`corpus.mjs`(있으면) 를 다시 — 가짜 키 2,700 조합 중 9c-1 판이 막던 것은 모두 막힘(남는 것은 영숫자·하이픈에 바로 붙은 꼴뿐), 정상 글 61개 중 9c-1b 판과 같은 수 이상 보존, CMDT 걸림 0.
- `REDACT_PATTERNS`·`js/privacy/` 무변(바이트).
- 변이 2개(1 의 `%XX` 갈래 빼기, 2 의 "또는 20자" 빼기) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b9c1c/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0. headless 하지 않는다.
- spec 17-4-1 `[정정 2026-11-17 — 9c-1b]` 줄 뒤에 `[정정 2026-11-17 — 9c-1c]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/config.js`(`BACKUP.KEY_PATTERNS` 만), `tests/backup-9c.test.mjs`, `index.html`(stamp), `spec.md`(한 줄), 스크래치패드 `b9c1c/`, 보고서.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책 덤프는 걸린 횟수만(원문 옮기지 말 것). 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
