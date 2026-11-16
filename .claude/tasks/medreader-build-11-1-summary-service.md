# Build 지침 — 11-1 요약 서비스 · 저장 (화면 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-2-1** 중 11-1 몫 — 1(코드 사실)·2·3(대상 정하기 — 순수 `text/summary.js`)·4-1(요약 요청)·4-2(파이프라인·캐시·사용량)·4-4(저장)·5 표 11-1 행·import 방향·6(호출)·8 "11-1" 수용 기준·공통·9(headless 방법)·10 결정 표(권장안)·11(넘길 것). 운영자 위임(2026-11-15): 권장안으로. **11-Q1–Q4 는 설계 기본값(자동 요약 없음·규칙 1–6 그대로·10 사슬은 해당 없음·내보내기는 요약·용어만)대로 — 묻지 않는다.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-11-1-summary-service-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- `.claude/tasks/medreader-crossstep-notes.md` 를 읽어라 — "11" 관련 줄 전부: **`pipeline.runJob(job, items, keys, opts)` 를 넷째 인자 없이 부르면 TypeError — 기본값 `{}` 를 넣거나 늘 넘긴다**(8f1R), "8f-2·11-2" 삭제 확인 한 함수(`deleteKeepLines` — 11-2 가 줄을 더함), **"20-D11 이 11-D8 문구를 바꾼다(필기는 남김) — 11 Build 때 이 방향으로"**: 9-2 표 `annotations` 행은 이미 "**문서 삭제 연쇄에서 빠진다(스토어 전체)**" 로 정정돼 있다 → 11-1 의 `db.js` 연쇄 삭제 예외는 `summary`·`outline` 만이 아니라 **`annotations` 스토어 전체**로(수용 기준의 "다른 annotations(가짜 highlight)는 지워짐" 은 이 방향으로 뒤집어 시험 — spec 17-2-1 안 `[정정 2026-11-17 — 11-1 Build]` 줄로 적어라). 8f-1 의 `keepsOnDocDelete` 한 곳에서 판정하는 꼴을 따른다.
- 8f-1 `runJob`(`TRANSLATE_JOB`·`TERM_JOB`, 결과 `{text}`/`{value}`)·8c-2 `onWarn`·상한 셈(`dailyCapOf`·`capUsedOf`) 위에 `SUMMARY_JOB`·`OUTLINE_JOB` 을 얹는다 — **상태 기계 한 벌**. 사용량 `byKind.summarize`(8c-2 사용량 화면이 이름을 열거하면 `usage.kind.summarize` 이름 키도 — 11-4 몫이면 남겨라).
- 9c 백업: `annotations` 는 이미 담고 가져온다(9c-1·9c-2) — `kind:'summary'|'outline'` 레코드가 문서 없이도 들어가는지 9c 쪽 시험으로 확인만(고칠 일이 있으면 보고서에).
- 8n·8m: 원문 언어 요지(`gistSrc`)의 언어는 **문서 원문 언어**(es 포함), 같으면 생략.

## 할 일
설계 5 표 11-1 행 그대로: 새 `js/text/summary.js`(순수)·`js/notes/summaries.js`(서비스 — `config`·`text/*`·`db`·`hash` 만)·`tests/summary-11b.test.mjs`·`tests/summary-store-11b.test.mjs`, 고칠 `js/ai/prompts.js`(요약·개요 요청·스키마·검증 — `commonSystem(true, domain)` 규칙 1–6 글자 그대로)·`js/ai/pipeline.js`(`SUMMARY_JOB`·`OUTLINE_JOB`·`summarize()`·`outline()`)·`js/config.js`(`SUMMARY`·`OUTLINE` 상수, `SUMMARY_PROMPT_VERSION`·`OUTLINE_PROMPT_VERSION` = 1)·`js/db.js`(연쇄 삭제 예외 — 위). **화면은 만들지 않는다**(11-2·11-3 몫). DB 3·algoVersion·`SEARCH.VERSION`·`OUTLINE_V`·번역 `PROMPT_VERSION`·`TERM_PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "11-1" 전부 + 공통. 특히 **`translate()`·`translateTerms()` 요청 본문이 이 Build 전과 바이트 단위 같음**(HEAD 판 `git archive` 와 흉내 fetch 로 대조 — 8f-1 Review `r8f1/diff.mjs`·8c-2 Review `r8c2/rdiff.mjs` 꼴 재사용, 읽기만), 기존 pipeline·prompts·term 시험 무변.
- 출력 토큰 예산: 합성 문단 + CMDT 2026 표본 쪽의 **문단 수·글자 수만** 기록(글 없음).
- 변이(설계 11-1 끝 다섯) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b11-1/bak/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0, `grep -rn "splitSentences" js/` 결과가 HEAD 와 같은 파일들.
- headless 한 번(Edge 412×915, 새 프로필 `b11-1/p1`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS — POST 는 `responseSchema` 속성으로 번역/요약 갈래, 캐시 끔, **서버 띄우기 금지**): 앱이 뜨고 낭독 동반 번역·탭 번역·단어 번역 요청 본문이 HEAD 와 같음, 콘솔 오류 0. 요약 경로는 화면이 없으니 node 시험으로(필요하면 페이지 안에서 모듈을 import 해 `summarize()` 한 번 — 요청 1·캐시 뒤 0).
- spec 17-2-1 안 `[정정 2026-11-17 — 11-1 Build]` 줄(Edit 로 그 자리만), 3-2 `notes/*` import 방향 한 줄(설계가 말한 곳).

## 수정 범위
설계 5 표 11-1 행의 파일 + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b11-1/` + 보고서. 화면 파일(`ui/*`)·`selbar.js`·`voice/*`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 의학책 읽기만(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`), Downloads 목록 보지 말 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
