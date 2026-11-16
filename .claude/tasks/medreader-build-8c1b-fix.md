# Build 지침 — 8c-1b: 8c-1 Review 지적 고치기

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8c-1 Review" 절(8c1R-1~10) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8c1-taptr.md` 의 규칙·금지·수정 범위는 그대로다. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8c1b-fix-report.md`. 스크래치패드 `b8c1b/`(Review 의 `r8c1/` 는 읽기만 — 진짜 터치 하네스 `dbg-key.mjs`·`dbg-inline.mjs` 재사용 가능).

## 고칠 것 (순서대로 — 1 은 반드시, 2–5 는 각각 작으면)
1. **중간 — 여러 손가락**: `ui/reader.js`·`ui/original.js` 의 누름 기록을 `pointerId` 별 Map 으로. 짝 없는 `pointerup`(기록 없음)은 **탭이 아니다**. 누름 동안 다른 손가락이 하나라도 닿았으면(동시 포인터 ≥ 2를 본 제스처) 그 제스처의 어느 손가락도 탭이 아니다. `pointercancel`·`lostpointercapture` 에서 기록을 지운다. `isTap` 순수 함수에 "다중 터치였음" 입력을 더하고 I1 에 줄을 더한다. 진짜 터치(CDP `Input.dispatchTouchEvent`)로: 두 손가락 정지 탭 → 번역 0·이동 0, 엄지 1.5s 대고 다른 손가락 탭 후 엄지 뗌 → 0, 한 손가락 보통 탭 → 그대로 1.
2. **낮음-2 — 동시 요청**: 탭 번역 요청은 한 번에 하나(새 탭이 오면 앞 대기 중 요청은 보내지 않고 버리거나 뒤로 — 설계 6절 호출 수와 맞는 쪽, 이유를 보고서에). 낭독 동반 번역의 동시 상한·요청 바이트는 건드리지 않는다. 429 를 `exhausted` 로 읽는 파이프라인(8a) 동작은 **바꾸지 말고** 보고서·crossstep 후보로만.
3. **낮음-3 — 오프라인 띠**: 탭 띠가 offline 상태일 때 `online` 이벤트가 오면 그 탭을 한 번 다시 요청(또는 [다시 시도] 단추를 보이기 — 더 작은 쪽).
4. **낮음-5 — 접근성**: 띠 `[×]` 로 닫으면 포커스를 탭했던 줄(없으면 리더 본문)로 되돌린다. 탭 띠가 열려 있을 때 Esc 로 닫힘(다른 Esc 동작 — 팝오버·시트·8e `[≡]` — 과 순서가 엉키지 않게, 가장 위의 것 하나만). 키보드로 탭 번역을 여는 길은 설계 밖 — 만들지 말고 보고서에.
5. **낮음-6 — 테스트 구멍**: I4b 가 실패 시 멈추지 않게 시간 상한(`t.timeout` 또는 `Promise.race`). 선택 줄 접힘(V6)·문단 단위 요청(V8)을 node 에서 잡는 테스트(가짜 DOM 이 어렵다면 순수 함수로 떼어 시험). WB1 의 `.retry()` 셈이 새 경로(`then(tap.retry)`)도 세게.
- 낮음-4(띠가 새로 뜨며 선택 줄이 고른 글자를 덮음)는 고치지 않아도 된다 — 작게 고칠 수 있으면 고치고, 아니면 다듬기 후보로 보고.

## 검증
- 수용 기준 "8c-1" 이 그대로 통과(앞 Build 의 headless 시험 A–D 를 새 프로필로 다시 — 하네스 재사용), 번역 요청 본문 바이트 HEAD 와 같음.
- 변이 3개 이상(1번 Map → 한 칸 되돌림, "짝 없는 up 은 탭 아님" 지움, Esc 핸들러 지움, 동시 1 상한 지움) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8c1b/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless: 새 프로필 `b8c1b/p*`, pipe, 412×915·915×412, ko·ar, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성. 콘솔 오류 0.
- spec 17-7-6 안 `[정정 2026-11-16 — 8c-1b]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/ui/reader.js`·`js/ui/original.js`·`js/text/select.js`·`js/ui/trband.js`·`js/ui/controls.js`·`js/ai/readalong.js`(탭 요청 경로만)·`js/ui/selbar.js`, `tests/`(8c 테스트·WB1 이 있는 테스트), `index.html`(stamp), `spec.md`(한 줄), `.claude/tasks/medreader-crossstep-notes.md`(다듬기 후보 줄 덧붙이기만), 스크래치패드 `b8c1b/`, 보고서. `js/ai/pipeline.js`·`provider.js`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만**(grep·curl·df·백업·복사·확인도 각각). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책 읽기만, Downloads 목록 보지 말 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
