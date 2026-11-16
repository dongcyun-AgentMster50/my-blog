# Build 지침 — 9c-3b: 9c-3 Review 지적 고치기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "9c-3 Review" 절(9c3R-0~10) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-9c3-needpdf.md` 의 규칙·금지는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9c3b-fix-report.md`. 스크래치패드 `b9c3b/`(`r9c3/` 는 읽기만 — `fix9c2.mjs`·`future-cmp.mjs` 재사용 가능).

## 고칠 것
1. **중간-1 — 미래 시각 자르기가 멱등을 깸**: 파일 문서의 `lastOpenedAt` 이 이 기기 지금보다 미래면, **기존 문서 병합 비교에서 기기 값을 유지**(단어장 8f-3b 의 미래 시각 = 충돌/기기 유지와 같은 결). **새 문서일 때만** 지금으로 자른다. I18 에 "다른 now 로 두 번 가져오기 = 한 번(두 번째 keep)" 한 줄, 그사이 기기 진도가 앞선 경우 되돌아가지 않음 한 줄.
2. 낮음-2: `reader.js`·`quiz.js` 입구가 `from = location.hash` 를 첫 `await` **앞**에서 잡게(검색과 같게) — 그사이 사용자가 다른 화면으로 가면 서재로 끌지 않고 `replace` 도 하지 않는다.
3. 낮음-3: `tests/needpdf-9c3.test.mjs` N5 에 `replace(libraryHash())` 단정 한 줄(변이 R3 를 잡게).

## 검증
- Review `fix9c2.mjs` i3·i4·`future-cmp.mjs` 를 다시 — 미래 시각 파일 두 번 = 한 번, 진도 되돌아감 0.
- 변이 2개 이상(1 되돌림, 2 의 `from` 을 await 뒤로) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b9c3b/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0. `quiz.js` 줄 끝 CRLF 섞임 0.
- headless 한 번(Edge, pipe, 새 프로필 `b9c3b/p1`, 가짜 키, 흉내 Gemini, 캐시 끔, 서버 띄우기 금지): 원본 없는 책 리더 주소 → 다음 틱에 `#/usage` → 서재로 끌리지 않음, 콘솔 오류 0.
- spec 17-4-1 `[정정 2026-11-17 — 9c-3 Build]` 줄 뒤에 `[정정 2026-11-17 — 9c-3b]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/backup/import.js`, `js/ui/reader.js`, `js/ui/quiz.js`, `tests/needpdf-9c3.test.mjs`, `tests/backup-import-9c.test.mjs`, `index.html`(stamp), `spec.md`(한 줄), 스크래치패드 `b9c3b/`, 보고서. **11-1 지침 파일(`.claude/tasks/medreader-build-11-1-summary-service.md`)은 다른 단계 것 — 건드리지 마라.**

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것.** 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
