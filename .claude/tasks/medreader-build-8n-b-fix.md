# Build 지침 — 8n-b: 8n Review 지적 고치기

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8n Review" 절(8nR-1–9) — 먼저 읽어라. 원래 지침 `.claude/tasks/medreader-build-8n-es.md`·`medreader-build-8n-es-finish.md` 의 규칙·금지는 그대로다. 운영자 위임(2026-11-15): 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8n-b-fix-report.md`. Review 스크래치패드 `r8n/`(읽기만 — 재현 PDF·스크립트 재사용 가능), 네 스크래치패드는 `b8nb/`.

## 고칠 것
1. **높음 — 보통 스페인어가 fr 로 판정**(Review 권고안): es 갈래를 비교할 때만 fr 쪽 세기에서 스페인어와 겹치는 낱말(`la` — Review 가 본 것. `le`·`les` 도 겹치는지 실측해 정하되, 스페인어 `le`·`les` 는 대명사로 흔하다)을 빼고 센다. **en·fr 두 갈래 비교(아래 규칙)는 한 글자도 바꾸지 않는다** — "es 가 이기지 않으면 8n 이전과 같다" 성질 유지. 확인: Review 의 스페인어 문단 6개(+ 네가 새로 지은 보통 꼴 스페인어 4개 이상 — 의학·일상·설명문)가 es, 프랑스어 실물 꼴 문단(네가 지은 것 4개 이상 + 기존 fr 픽스처)이 fr 그대로, 의학책 3권 표본 HEAD 와 같음, 무작위 대조에서 es 아닌 결과 바뀐 것 0. **테스트에 보통 꼴 스페인어 문단 묶음을 더한다**(지금 말뭉치 `ES` 는 es/fr 5배로 쏠려 이 문제를 못 잡았다).
2. **낮음 — es 최소량**: en·fr 기능어가 0 일 때 es 낱말 하나로 es·1 이 되는 것. es 갈래에 최소 개수 문턱(예: es 기능어 낱말 수 ≥ 3, 상수는 `GUESS` 안에 이름 붙여)을 두고, 경계 바로 위·아래를 고정하는 테스트(변이 d 를 잡게). 포르투갈어 꼴·약어 표(`LOS`·`DEL`) 예는 en 으로 남아야 한다.
3. **낮음 — 테스트 구멍**: es score 식 값을 고정(변이 c), `VOICE_SAMPLES.es` 가 스페인어인지(`guessLang` 또는 글자 확인 — 변이 f).
4. **낮음 — 문장 나눔**: `p. ej.` 뒤 `¿` 와 문장 중간 `… ¿o no?` 꼴. 고치기 쉽고 en·fr·ko 분할에 영향이 0 이면 고치고(예: 앞 낱말이 소문자로 끝나는 약어 꼴이면 끊지 않기 — 견본 없이 약어 목록을 늘리지는 마라), 아니면 한계로 spec 에 적는다. 어느 쪽이든 en·fr·ko 분할 불변을 다시 대조.
5. **spec**: 19-1-3 §5 에 `[정정 2026-11-16 — 8n-b]` 한 줄(고친 것·실측 숫자·남은 한계 — 8m 아랍 문자 문장 묶임(Review 4)을 한계에 더함). **Edit 도구로 그 자리만** — 파일 통째 쓰기 금지.
6. **정보**: `js/ui/library.js` 258행 근처 주석 "(미지원이어도 셋)" → 넷 (주석 한 곳만).

## 검증
- 변이 2개 이상(1번 고침 되돌리기 → 새 보통 꼴 스페인어 테스트 빨강, 최소량 문턱 끄기 → 빨강, score 식 바꾸기 → 빨강) → 복원(읽어서 쓰기 + `cmp`, 백업 `b8nb/bak/`).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless(새 프로필 `b8nb/p1`, pipe, 412×915, 가짜 키, 흉내 Gemini OPTIONS 포함): Review 의 `r8n-es-natural.pdf` 가 es·`es-ES`·"from Spanish", CMDT 2026 회귀 en, 콘솔 오류 0.

## 수정 범위
`js/text/lang.js`, `js/text/segment.js`, `js/ui/library.js`(주석 한 줄), `tests/`(8n 테스트·픽스처), `index.html`(stamp), `spec.md`(§5 정정 한 줄), 스크래치패드 `b8nb/`, 보고서. golden 픽스처(`srclang-8n.golden.json`)는 HEAD 모듈로 만든 것이므로 **바꾸지 마라**(바뀌어야 한다면 회귀다 — 멈추고 보고). DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변. review.md·`dev/` 금지.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 읽기만. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
