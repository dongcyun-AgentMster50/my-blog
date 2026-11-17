# Build 지침 — 12-1c: 합쳐진 문장 카드의 내용이 빈 값으로 덮임 (아주 작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "12-1b 재검증" 절 — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-12-1b-fix.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-12-1c-fix-report.md`. 스크래치패드 `b12-1c/`(`r12-1b/` 는 읽기만 — `rv2.test.mjs` 재사용).

## 고칠 것
1. **중간-1**: 9c 문장 카드 병합(`text/backup.js` `mergeSentence` 내용 묶음)에서 — Review 의 ①과 ② 둘 다: ① 파일 쪽 `back`·`note`·`explain`(내용 필드)이 **비었으면** 기기의 비지 않은 값을 덮지 않는다(필드별), ② 만든 뒤 고치지 않은 카드(`updatedAt == createdAt`, 또는 내용 수정 시각이 따로 없으면 그 뜻)는 고친 카드의 내용을 이기지 못한다. 결과는 여전히 멱등이고 기기 데이터를 잃지 않는다. 시험: A→B·B→A 양방향, 두 번 가져오기 = 한 번, 둘 다 고친 경우는 늦은 쪽(지금 규칙), 한쪽만 빈 필드. **Build C10b 의 `back === ''` 기대**는 이 고침에 맞게 바꾼다(이유를 보고서에).
- 낮음-2(다른 PDF 변형 키 합침)·정보-3(지우고 다시 가져온 문서의 나머지 카드 docId)은 기록 — crossstep 12-2/12-3 줄에 정보-3 한 줄("이 책 복습"·`keptCount` 가 옛 docId 카드를 못 잡음 — 12-3 에서 fileHash 로 묶을지).

## 검증
- Review `rv2.test.mjs` V5 가 고친 뒤 기대대로(뒷면·메모 지켜짐), 나머지 V 는 그대로.
- 회귀: 12-1·12-1b 시험 전부, 9c 병합·멱등(K11·I5), 8f, 11-1.
- 변이 2개 이상(①·② 각각 되돌림) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b12-1c/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령 — `text/backup.js` 가 바뀌므로), `--check` 0, `git diff --check` 0. headless 하지 않는다.
- spec 17-4-1 의 `[정정 2026-11-17 — 12-1b]` 줄 뒤에 `[정정 2026-11-17 — 12-1c]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/text/backup.js`(문장 카드 내용 묶음만)·`tests/cards-12.test.mjs`·(필요하면) `tests/backup-*.test.mjs`·`index.html`(stamp)·`spec.md`(한 줄)·`.claude/tasks/medreader-crossstep-notes.md`(덧붙이기만)·스크래치패드 `b12-1c/`·보고서. **12-2 지침 파일은 건드리지 마라.**

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
