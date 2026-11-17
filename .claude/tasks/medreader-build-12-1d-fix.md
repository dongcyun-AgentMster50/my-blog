# Build 지침 — 12-1d: 세 기기 수렴 — 같은 시각·다른 값의 결정 규칙 (아주 작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "12-1c 재검증" 절 — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-12-1c-fix.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-12-1d-fix-report.md`. 스크래치패드 `b12-1d/`(`r12-1c/` 는 읽기만 — `rv3.test.mjs`·세 기기 시뮬레이션 재사용).

## 고칠 것
1. **중간-1**: `mergeSentence` 내용 묶음에서 두 카드의 꼴·시각이 같은데(같으면 기기 규칙이 걸리는 자리) 글자 칸이 **둘 다 비지 않고 값이 다르면**, 기기·순서와 무관한 **정해진 규칙**으로 하나를 고른다(예: 유니코드 문자열 비교로 큰 쪽 — 이유를 보고서에). 결과: 어떤 교환 순서든 모든 기기가 같은 값으로 수렴, 멱등, 데이터를 잃는 칸 없음(지는 값은 원래도 진 쪽). 세 기기 무작위 시뮬레이션(Review 와 같은 3,000번 + 옛 파일 없는 170 꼴) → 갈라짐 0, 두 기기 전수 6,400쌍 → 12-1c 결과와 같음(지워짐 0·고친 쪽 잃음 0).
2. 낮음-3: C11 에 "빈 값 건너뜀은 `back`·`note`·`explain` 만"을 고정하는 한 줄(변이 X3).
- 낮음-2(자동 채움이 `updatedAt` 을 올려 손으로 쓴 뒷면을 덮을 수 있음)·정보-4 는 기록 — crossstep 12-3 결정 후보 줄에 덧붙임.

## 검증
- Review `rv3.test.mjs` W2·W3·W3e 가 고친 뒤 수렴(기대 뒤집은 사본으로), 나머지는 그대로. 12-1·12-1b·12-1c 시험, 9c 병합·멱등.
- 변이 2개 이상(1 되돌림 → 수렴 시험 빨강, X3) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b12-1d/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0. headless 하지 않는다.
- spec 17-4-1 `[정정 2026-11-17 — 12-1c]` 줄 뒤에 `[정정 2026-11-17 — 12-1d]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/text/backup.js`(`mergeSentence` 한 곳)·`tests/cards-12.test.mjs`·`index.html`(stamp)·`spec.md`(한 줄)·`.claude/tasks/medreader-crossstep-notes.md`(덧붙이기만)·스크래치패드 `b12-1d/`·보고서. **12-2 지침 파일은 건드리지 마라.**

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
