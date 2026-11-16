# Build 지침 — 8c-1c: 8c-1b 재검증 지적 고치기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8c-1b 재검증" 절 — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8c1b-fix.md` 의 규칙·금지·수정 범위는 그대로다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8c1c-fix-report.md`. 스크래치패드 `b8c1c/`(`r8c1b/` 는 읽기만 — 하네스·`small.pdf` 재사용 가능).

## 고칠 것
1. **중간-1 — 남은 누름 기록**: 본문 밖에서 뗀 누름 기록이 남아 다음 손가락 탭을 "여러 손가락"으로 만든다. `document` 수준(붙잡기 단계)의 `pointerup`·`pointercancel` 에서도 그 `pointerId` 기록을 지운다. 그리고 primary 누름이 오면 **종류와 무관하게** 이미 떼어진 옛 기록을 지운다(지금은 같은 종류만). 진짜 동시 터치 판정(두 손가락)은 그대로여야 한다.
2. **중간-2 — 리더를 떠나도 띠가 남음**: 설계 4-1 의 닫기 조건 "리더 떠남"이 숨김 전환(검색 화면 등)에서 빠졌다. 라우트가 리더 밖으로 바뀌면 탭 띠를 닫는다(포커스 되돌림 없이). 그리고 `onEscKey` 는 리더 화면이 실제로 보일 때만 동작한다(`els.band.hidden` 만 보지 말 것 — 화면 섹션의 숨김까지).
3. **중간-3 — 편집 칸의 Esc**: Esc 의 대상(`event.target`)이 `input`·`textarea`·`select`·`[contenteditable]` 이면 띠 Esc 처리를 하지 않는다(기본 동작 그대로 — 쪽 번호 `change` 가 불리지 않게). 띠 안의 단추에 포커스가 있을 때는 그대로 닫힌다.
4. 낮음-4: 마지막 탭의 문단이 이미 요청 중이거나 받은 문단이면 대기 칸을 비운다(마지막이 아닌 탭을 보내지 않음).
5. 낮음-5: Esc·[×] 뒤 포커스를 옮길 때 그 줄이 화면 밖이면 `scrollIntoView({block:'nearest'})`(낭독 위치와 충돌하면 보고서에).
6. 낮음-7: 변이 R5(선택 줄 윗변 기준 굴리기)를 잡는 node 테스트 — 순수 함수로 뗄 수 있으면.

## 검증
- 위 1–3 각각 재현 → 고친 뒤 0(Review 하네스 `ds1`·`e3s`·`e4b`·`e5l` 꼴을 새 프로필로). 8c-1b 재검증의 "확인된 것" 전부 그대로(손가락 수·동시 1·연결 회복·Esc 층 순서·포커스 표시·요청 본문 바이트 HEAD 와 같음).
- 변이 3개 이상(1·2·3 각각 되돌림) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8c1c/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- spec 17-7-6 안 `[정정 2026-11-16 — 8c-1c]` 한 줄(Edit 로 그 자리만).

## 수정 범위
앞 지침 범위 안에서 `js/text/select.js`·`js/ui/reader.js`·`js/ui/original.js`·`js/ui/trband.js`·`js/ui/controls.js`·`js/ai/readalong.js`(탭 경로)·`js/ui/selbar.js`, 라우트 전환을 받을 곳이 필요하면 `js/main.js` 또는 `js/router.js` **한두 줄**(이유를 보고서에), `tests/`, `index.html`(stamp), `spec.md`(한 줄), 스크래치패드 `b8c1c/`, 보고서. `pipeline.js`·`provider.js`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … && …`·파이프로 묶지 말 것**(앞 Build·Review 가 어겼다). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 큰 원서로 검색 화면에 들어가지 말 것(검색 준비가 오래 걸림 — 작은 PDF 로). 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
