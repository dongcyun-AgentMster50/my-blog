# Build 지침 — 8n 마무리 (앞 Build 가 보고서 전에 끊김)

> 너는 **Build 서브에이전트**다. 원래 지침 `.claude/tasks/medreader-build-8n-es.md` 를 먼저 읽어라 — 규칙·금지는 그대로다. 앞 Build 가 2026-11-16 01:46 에 보고서를 쓰기 전에 끊겼다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8n-es-report.md`.

## 이미 된 것 (지우지 말고 이어서)
- 작업 트리의 8n 변경: `js/text/lang.js`·`segment.js`·`config.js`·i18n ×4·`index.html`(stamp)·테스트 4개 수정, 새 `tests/srclang-es-8n.test.mjs`·`tests/fixtures/srclang-8n-corpus.mjs`·`srclang-8n.golden.json`, spec 19-1-3 §5 `[정정 2026-11-16 — 8n Build]` 줄(①–⑨). `git diff` 로 보라.
- 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b8n\`: `run-es2.json`(es 판정·서재 [⋯]·낭독 큐·`es-MX` 확인, `voicePicker` 에 es 없음으로 ok:false), `run-reg2.json`(회귀 ok), `books.json`(의학책·해커스 회귀), `mutate.py`·`bak/`(변이 백업 m1–m5 — **결과 기록은 없다**), `shots/`.

## 할 일
1. **설정 > 낭독 목소리에 es 묶음 더하기** (spec 정정 ③ 이 "남은 일 — 작음"으로 적은 것 — 운영자 위임 권장안으로 이번에 넣는다): `js/ui/settings.js` `VOICE_LANGS` 끝에 `'es'`, `VOICE_SAMPLES.es`(짧은 스페인어 견본 문장 — 다른 언어 견본과 같은 꼴), `js/settings.js` 기본값 `tts.voice.es: ''`·`tts.accent.es: ''`. 설정 키를 순회·검사하는 테스트가 있으면 맞춘다. 9c 백업 허용 목록이 `tts.*` 를 키 이름으로 고정했는지 확인(고정이면 보고서에만 — 9c 는 아직 Build 전). spec 정정 ③ 끝에 `→ [정정 2026-11-16 — 8n 마무리] 넣음` 한 줄을 이어 붙여라.
2. **변이 다시**(결과 기록이 없으므로): 설계의 두 변이(es 를 `SUPPORTED_SRC` 에서 빼기 → 빨강, 판정을 3자 동시 최댓값으로 → en/fr 경계 픽스처 빨강) + `LATIN_DOC_LANGS` 에서 es 빼기 + `SENTENCE_START.es` 에서 `¿¡` 빼기 + `VOICE_LANGS` 에서 es 빼기. 변이마다 빨강 확인 → 복원(**읽어서 쓰기 + `cmp`** — 원본은 지금 작업 트리 파일을 새 백업 폴더 `b8n/bak2/` 에 먼저 복사해 두고 그것과 cmp). 시작 전에 작업 트리의 `lang.js`·`segment.js` 가 `git diff` 에 보이는 8n 판과 같은지(변이 찌꺼기 없음) 먼저 확인.
3. **전체 테스트 2회**: `node --test apps/medreader/tests/*.test.mjs` (각각 시간 상한 10분).
4. **headless 한 번 더**(새 프로필 `b8n/p2`·새 포트): 설정 > 낭독 목소리에 Español 묶음이 나오고 `es-MX` 억양을 고르면 낭독 태그가 `es-MX`, 412×915 가로 넘침 0, ko·ar UI, 콘솔 오류 0. 앞 실행의 번역 요청 지시문에 원문 언어 이름이 비어 있었다(`run-es2.json` `instr: []`) — 스페인어 문서에서 번역을 부르면 지시문이 "from Spanish" 인지 확인(가짜 키·흉내 Gemini, OPTIONS 응답 포함).
5. `stamp-importmap.mjs --check` 0, `git diff --check` 0.
6. **보고서**: 바꾼 것(앞 Build 몫 + 이번 몫), 실측 숫자(spec 정정 ⑦·⑧ 을 그대로 옮겨도 됨), 변이 표, 테스트 수, headless 결과, 한계(Sra.·es 견본 없음), 막힌 명령이 있었다면 그대로.

## 수정 범위
원래 지침 범위 + `js/ui/settings.js`·`js/settings.js`. DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변. review.md·`dev/` 금지(`dev/measure-table-8i4.mjs` 는 다른 단계 것 — 건드리지 마라).

## 규칙 (원래 지침과 같음 — 다시 적는다)
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고. `rm -rf` 금지(새 폴더 이름). 8000 python 은 쓰기만, 8123–8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
