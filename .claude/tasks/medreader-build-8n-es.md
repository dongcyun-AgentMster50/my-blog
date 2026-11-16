# Build 지침 — 8n 스페인어 원문 언어 (F4 · L-D1)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **19-1-3 §5 "8n — 스페인어 원문 언어"** 표 전부(결정 L-D1 승인 2026-10-19) + 수용 기준 뼈대. 운영자 위임(2026-11-15): 권장안으로 끝까지. 직전 커밋 `b767dd7`(8e 배포 `59ed3f0`). **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8n-es-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
8m(`text/lang.js` `unitLang` — 문장별 글자 체계 전환, 라틴 문장의 언어), 8o(`SPEECH_BLANK` — es 한 줄), 8k(억양 고르기 — es 지역 목록 `es-ES`·`es-MX` 등이 8k 화면에 나오는지), 9b(`voice.cmdLang` 은 ar/en 만 — es 명령은 범위 밖, 그대로), 8p(`domain` 무관), 8g-7(진료과 사전 — es 별칭은 넣지 않음, 그대로). 바꿀 것이 생기면 19-1-3 §5 안 `[정정 2026-11-16 — 8n Build]` 줄로.

## 할 일
설계 표 그대로: `text/lang.js`(`SUPPORTED_SRC` 뒤에 es, 기능어 es, "es 가 en·fr 중 큰 쪽의 2배 이상일 때만 es" — 아니면 지금 규칙 그대로), `text/segment.js`(`SENTENCE_START.es` ¿¡), `config.js`(`TTS_LANG_REGION.es`, `SPEECH_BLANK.es`), i18n ×4 `onboarding.lang.es`(UI 언어 목록엔 넣지 않음 — 확인). 옛 문서(`langGuess` 있음) 다시 추정 안 함. stamp 다시, `--check` 0.

## 검증
- 수용 기준 `[N]` 전부, 특히 **7c E1 꼴 회귀 — 기존 en·fr·ko 픽스처의 `guessLang`·`splitSentences` 결과가 한 글자도 같다**. 의학책 세 권·해커스 견본(8m 보고서 경로, 읽기만) 표본 쪽의 판정·문장 나눔·낭독 큐가 HEAD 와 같은지(언어 판정이 es 로 새지 않음).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1476 + 새).
- headless Edge(412×915 · ko·ar UI · 가짜 키 · 흉내 음성 · 새 프로필 `b8n/p1`·새 포트): 합성 스페인어 PDF(스크래치패드에 만든 것 — 저작권 없는 글) 가져오기 → es 판정·서재 [⋯] Español·es 목소리 태그·문장 나눔·번역 요청의 원문 언어 이름. 회귀: en 의학책 낭독·번역 띠, 8m 전환. 콘솔 오류 0.
- 변이 2개 이상(설계의 두 변이) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `b8n/bak/`.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`(가능하면 pipe 로 실행), 결과는 stdout. 오래 걸리는 명령은 시간 상한을 넉넉히(백그라운드로 넘기지 말 것). 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름을 써라). 같은 작업 트리에서 8i-4-0 측정 Build 가 `dev/measure-table-8i4.mjs`·스크래치패드에 쓴다 — 그 파일은 건드리지 마라. 8000번 python 은 떠 있다 — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`js/text/lang.js`, `js/text/segment.js`, `js/config.js`, `js/i18n/*`, `index.html`(stamp), `tests/`, `spec.md`(19-1-3 §5 정정 줄), 스크래치패드 `b8n/`, 보고서. DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변. review.md·`dev/` 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
