# Build 지침 — 15-1 AI 출제 서비스 (화면 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-13** 중 15-1 몫 — 1(지금 코드 사실 — 옛 줄 번호, 코드에서 다시 찾아라)·3(AI 출제 3-1 입력·3-2 요청·스키마·검증·3-3 저장)·5 표 15-1 행·import 줄·6(호출)·7 "15-1" 수용 기준·8 결정 표(권장안 — 15-D3·D4·D5·D6·D7·D8). 운영자 위임: 권장안으로. **새 호출은 `makeQuiz()` 를 부를 때만**(자동 0). 보내는 것은 교과서 문단 글뿐. DB 3 · `PROMPT_VERSION`·`TERM/SUMMARY/OUTLINE/EXPLAIN_PROMPT_VERSION` 불변 — 새 `QUIZ_PROMPT_VERSION = 1`. **번역 요청 본문 바이트 불변.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-15-1-aiquiz-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- 11-1 이 `runJob(job, items, keys, opts)` 위에 TRANSLATE/TERM/SUMMARY/OUTLINE/EXPLAIN job 을 만들었다 — `QUIZ_JOB` 은 같은 꼴. 상태 기계·gate·429·cooldown·상한·사용량 한 벌(`byKind.quiz` 는 이미 고정 키).
- 숫자 거름은 11-1 의 `numberTokens`(10-2 번역 검사와 공유) — 새로 짜지 말고 재사용. 그 함수의 알려진 한계(fr·es 숫자 꼴 — crossstep "11-1R #4")는 바꾸지 않는다(바꾸면 번역 쪽 시험 영향).
- 13-1 `plan/readlog.js` 의 `@read` 구간·`rangesHas`(없으면 export 한 줄) — "읽은 쪽" 판정은 이것.
- 11 저장 요약(`annotations` `kind:'summary'`, 문단 `textHash`) — "요약 문단 먼저" 정렬에 쓴다.
- 20 `text/anchor.js` `findQuote` 가 이미 있다 — 근거 인용(evidence)은 그것으로 다시 찾을 수 있게 정규화 규칙을 맞춘다(문단 결합 글자 기준).
- `resetDerived` 의 `DERIVED_STORES` 가 `questions` 를 통째로 지운다 → `source === 'ai'` 건너뛰기(15-D6). 문서 삭제(`CASCADE_STORES`)는 지금처럼 함께 지움(15-D7).
- 출력 토큰: `maxOutputTokens = n × 900 + 200`(설계) — 11-1 요약 실측 근사(crossstep "13 실기기 첫 줄")와 같이 실기기 확인 거리로 적기.

## 할 일
설계 5 표 15-1 행 그대로: 새 `js/text/review.js`(순수 — `passageFor`·`rangeKey`·`aiSectionId`·`sectionsInRange`) · `js/ai/grounding.js`(순수 — 10-4 자체 검증 1–5 + 숫자 거름, 폐기율 > 50% 신호) · `js/review/aiquiz.js`(서비스 — 쪽마다 읽어 버리는 커서, 저장, `usedParaIds`) · 시험 `tests/aiquiz-15.test.mjs`·`tests/grounding-15.test.mjs`. 고칠 `js/ai/prompts.js`(`buildQuizRequest` — `commonSystem(true, domain)` 규칙 1–6 글자 그대로, "Explanation in {Target} AND in {Src}", `QUIZ_SCHEMA` `{tr, src}`) · `js/ai/pipeline.js`(`QUIZ_JOB`·`makeQuiz()`) · `js/config.js`(`REVIEW`) · `js/db.js`(`resetDerived` ai 예외). 레코드는 설계 3-3 그대로(id = `docId:sectionId:ai` + 줄기 해시 8, sectionId `ai-p{a}-{b}`, `status:'verified'|'rejected'`).

## 검증
- 수용 기준 "15-1" 전부 + 변이(설계 넷 + 네가 고른 하나 — 숫자 거름) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b15-1/bak/`).
- 가짜 provider 만(진짜 키·진짜 요청 0): 1호출·같은 입력 다시 0호출·429/capped/no-key 막힘·`byKind.quiz` +1. **번역·요약·설명 요청 본문 바이트 HEAD 와 같음**(앞 Review 의 rbody 하네스 재사용 가능 — `r11-*`·`r20-2/` 읽기만).
- 입력 크기: CMDT 2026(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` — 읽기만, Downloads 목록 보지 말 것, pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`) 장 하나로 `passageFor` 결과 글자·문단 수·토큰 어림(숫자만, 글 옮기지 말 것). 요청 프롬프트 전체 크기 ≤ `MAX_REQ_TOKENS`.
- grounding 정밀도: 합성 응답(정확 인용·공백 차이·지어낸 인용·바꿔 쓴 인용·숫자 지어냄) 각 여러 개로 통과/폐기 표.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독), `--check` 0, `git diff --check` 0. `ai/grounding.js` 순수 grep(16-A).
- headless 한 번(Edge, pipe, 새 프로필 `b15-1/p1`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **서버 띄우기 금지**(가로채기), 합성 PDF): 화면이 없으니 페이지 안에서 `makeQuiz` 를 불러 요청 1건·본문에 읽은 쪽 문단만·저장 5건, 다시 추출 뒤 AI 문항 남음. 콘솔 오류 0.
- spec 17-13 안 `[정정 2026-11-17 — 15-1 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 5 표 15-1 행의 파일 + (필요하면) `plan/readlog.js` export 한 줄 + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b15-1/` + 보고서. `ui/*`·`backup/*`·`text/backup.js`·`speaker.js`·`voice/*`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. **Write 도구가 ` `·` `·`﻿` 같은 이스케이프를 실제 글자로 바꿔 넣는 일이 있었다 — 그런 글자를 쓰는 파일은 쓴 뒤 HEAD 대비 그 글자·NUL·CR 수를 점검.** 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
