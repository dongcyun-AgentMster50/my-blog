# Build 지침 — 11-4b: 11-4 Review 지적 고치기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "11-4 Review" 절 — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-11-4-explain.md` 의 규칙·금지는 그대로다(범위: `ask.js`·`controls.js`(배선)·`trband.js`·시험). **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-11-4b-fix-report.md`. 스크래치패드 `b11-4b/`(`r11-4/` 는 읽기만 — 하네스 재사용).

## 고칠 것
1. **중간-1 — 낭독 중 단추 설명 실패가 보이지 않음**: Review 권고 **ⓐ**(설계 11-D15 "실패면 곧 되돌림"은 유지) — 되돌린 뒤 `medreader:banner` 꼴로 `explain.failed` 한 줄 + [다시 시도](누르면 그 문장 설명을 `retry` 로 1호출 — 실패 기억을 넘어). 원격 막힘(429·capped·offline·no-key)은 지금 배너 그대로. 멈춘 상태에서의 실패는 지금처럼 띠 실패 줄. i18n 키가 새로 필요하면 4언어(ar·fr `[검토]`). 시험 + headless(낭독 중 PARSE·DIGITS 실패 → 배너 보임 → [다시 시도] 1호출 → 설명).
2. 낮음-2: 설명 A 진행 중 다른 문장 [설명] B → B 가 끝나면 A 때의 `was`(읽던 중이었음)를 이어받아 이어 읽기.
3. 낮음-3: [설명]도 [문장 번역]처럼 고른 줄을 띠 위로(`liftLineAbove` 배선 한 줄).
4. 낮음-4: 시험 틈 — 설명 띠 포커스 `reveal`(V2)·음성 갈래 `cancelled`(V6) 각 한 줄.
- 낮음-5(띠 `aria-live`)는 1번 배너로 실패가 알려지므로 그대로 — 배너가 `aria-live` 인지 확인만.

## 검증
- Review 하네스(`r11-4/run-x.mjs`·`rexplain.mjs`·`rvoice.mjs`) 다시 — 1–4 고친 뒤 기대대로, 나머지 값은 11-4 Review 와 같음.
- 요청 본문 바이트 HEAD 와 같음(`rbody.mjs`), 9b 말뭉치 변화 0, 8c-1 탭 띠·Esc 층 회귀 0.
- 변이 3개 이상(1·2·3 각각 되돌림 + V2·V6) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b11-4b/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0.
- headless: Edge, pipe, 새 프로필 `b11-4b/p*`, 가짜 키, 흉내 Gemini, 흉내 음성, 캐시 끔, 한 번에 하나, 서버 띄우기 금지. 콘솔 오류 0.
- spec 17-2-1 4-7 의 `[정정 2026-11-17 — 11-4 Build]` 줄 뒤에 `[정정 2026-11-17 — 11-4b]` 한 줄(정정 ⑤ "잠깐만 보인다" 문구 바로잡기 포함 — Edit 로 그 자리만).

## 수정 범위
`js/ui/ask.js`·`js/ui/controls.js`(배선)·`js/ui/trband.js`·i18n 4개(새 키가 필요할 때만)·`tests/explain-11a.test.mjs`·`index.html`(stamp)·`spec.md`(한 줄)·스크래치패드 `b11-4b/`·보고서. **12-1 지침 파일(`.claude/tasks/medreader-build-12-1-srs-service.md`)은 다른 단계 것 — 건드리지 마라.**

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험도 단독으로). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
