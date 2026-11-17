# Build 지침 — 12-1b: 12-1 Review 지적 고치기 (작음, 12-2 전)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "12-1 Review" 절(12-1R-1~9) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-12-1-srs-service.md` 의 규칙·금지는 그대로다. 운영자 위임: 권장안으로(아래 2 는 Review 권장안 채택). **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-12-1b-fix-report.md`. 스크래치패드 `b12-1b/`(`r12-1/` 는 읽기만 — `rv.test.mjs`·`tz.mjs` 재사용).

## 고칠 것
1. **중간-1 — 두 번째 복습 [쉬움] < [좋음]**: reps==1 의 easy 간격을 `max(SECOND_GOOD_DAYS + 1, 계산값)`(= 최소 7일)로. 단조성 시험(같은 상태에서 again ≤ hard ≤ good ≤ easy — reps 0·1·2·n, ease 여러 값, 무작위 수천 상태). spec 17-11 3 표·규칙 정정 줄. 기존 S1–S10 값이 바뀌면 그 이유를 정정 줄에(바뀌지 않아야 정상 — S 표에 reps==1 easy 가 없다면).
2. **중간-2 — 문장 카드 id 의 docId**: id 를 **docId 대신 문서 `fileHash`**(변형 키 `:n쪽수` 를 뗀 값 — 같은 PDF 면 같은 값)로 만든다. `saveSentence` 가 같은 id 의 옛 카드를 만나면 `docId`·`docTitle` 을 지금 문서로 고친다(내용·복습 상태는 그대로). `fileHash` 가 없는 문서(옛·특이)면 docId 로 물러섬(이유를 보고서에). 9c `remapRecord`: 문장 카드 id 는 이제 바꿀 필요가 없다 — `docId` 필드만 바뀌는 것이 맞는지 확인·시험. 시험: 두 기기 같은 PDF 따로 가져오기 → 9c 병합 → 카드 한 장, 같은 기기 문서 지우고 같은 PDF 다시 → 카드 한 장(docId 새 문서로). id 경계 시험(앞면 "a b"+"c" ≠ "a"+"b c") 그대로. `cardStore` 의 다른 함수(`keptCount`·`list({docId})`)가 docId 필드로 거르는 것은 그대로 맞는지.
3. 낮음-3: `clampNewPerDay(null)`·`('')` → 20.
4. 낮음-5: 시험 틈 — 문장 카드 병합 C6 에 "내용 묶음이 멈춤 필드를 가져가지 않음" 한 줄(변이 X2).
- 낮음-4(서머타임 가을 전환 하루 일찍)는 기록만 — crossstep 다듬기 후보.

## 검증
- Review `rv.test.mjs` R1d·R8 이 고친 뒤 기대대로(쉬움 ≥ 좋음, 카드 한 장), 나머지 R 은 그대로.
- 회귀: 12-1 시험 전부·9c 병합·멱등(K11·I5)·8f 단어장·11-1 삭제 연쇄.
- 변이 3개 이상(1·2·3 각각 되돌림 + X2) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b12-1b/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0. headless 한 번(새 프로필, 서버 띄우기 금지): 페이지 안 카드 서비스로 두 문서(같은 fileHash·다른 docId) → 카드 한 장, 콘솔 오류 0.
- spec 17-11 3·4 와 17-4-1 9c 의 `[정정 2026-11-17 — 12-1b]` 줄(Edit 로 그 자리만).

## 수정 범위
`js/srs/sm2.js`·`js/srs/cards.js`·`js/text/backup.js`(문장 카드 remap/병합에 필요한 곳만)·`js/config.js`(`SRS` 상수 한 줄이면)·`tests/sm2-12.test.mjs`·`tests/cards-12.test.mjs`·(필요하면) `tests/backup-*.test.mjs`·`index.html`(stamp)·`spec.md`·`.claude/tasks/medreader-crossstep-notes.md`(후보 줄 덧붙이기만)·스크래치패드 `b12-1b/`·보고서. **12-2 지침 파일(`.claude/tasks/medreader-build-12-2-remember.md`)은 다른 단계 것 — 건드리지 마라.**

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
