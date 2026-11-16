# Build 지침 — 8f-1 단어장 데이터 · 단어 요청 (화면 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-7-6** 중 8f-1 몫 — 1(코드 사실)·2·4-3(단어 번역 — 서비스·순수 부분, 찾는 순서)·4-4(저장 — `cards` `kind:'term'`, DB 버전 3 그대로)·5 표의 8f-1 행·6(호출)·8 "8f-1" 수용 기준·9·10 결정 표(권장안). 운영자 위임(2026-11-15): 권장안으로 — 8cf-Q1–Q3 는 설계 기본값대로, 묻지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8f1-vocab-data-report.md`.

## 읽을 것
- spec 17-7-6 위 항목 + `[정정 2026-11-16 — 8c-1 Build]` 줄들(8c-1 이 바로 앞 단계 — 커밋 상태는 `git log`/`git status` 로 확인), 17-7-2(단어 번역 원 설계), 8a 파이프라인·캐시(7-5)·`PROMPT_VERSION` 소절, 8p `domain`.
- `.claude/tasks/medreader-crossstep-notes.md` — **"8f-1" 절 세 줄을 반드시 반영**:
  ① pipeline 을 `runJob` 한 함수로 일반화하고 **문자열이 아닌 결과도** 받게(11 이 요약·개요·설명 job 을 얹는다). **번역 요청 바이트 불변**.
  ② 시각은 **숫자 ms**(`dueAt`·`createdAt`·`updatedAt`). `applyImport` 가 `sm2`·`dueAt`·`reviewedAt`·`introducedAt` 을 덮지 않게(12 기억 카드).
  ③ term 캐시 키는 `keyFor(docId, context, target, 'term', 'w='+term)` — spec 17-7-2 의 '\n' 잇기는 해시 정규화로 경계가 사라지는 결함이 있다. 이 결정을 spec 정정 줄로 남겨라.
- 같은 파일 `.claude/tasks/medreader-crossstep-notes.md` 의 "9c" 절(카드 병합 `max(updatedAt, reviewedAt)`)도 읽어 데이터 꼴이 그 병합과 맞게.

## 할 일
설계 5 표 8f-1 행 그대로: 새 `js/text/vocab.js`(순수)·`js/vocab/store.js`(서비스)·`tests/vocab-8f.test.mjs`·`tests/term-8f.test.mjs`, 고칠 `js/ai/prompts.js`(term 요청·스키마·검증)·`js/ai/pipeline.js`(`runJob` 일반화 + `translateTerms`)·`js/ai/provider.js`(`TERM_KIND`·`capWarned` 받기)·`js/config.js`(`AI.TERM_KIND`·`VOCAB` 상수)·`js/db.js`(연쇄 삭제에서 term 제외)·`js/settings.js`(`vocab.lastExportAt`). **화면은 만들지 않는다**(8f-2·8f-3 몫). DB 버전 3·algoVersion 불변. `PROMPT_VERSION` 은 **번역 요청에 대해서는 불변** — term 요청은 새 kind 라 기존 번역 캐시를 건드리지 않는다(설계가 term 에 별도 버전을 두면 그대로).

## 검증
- 수용 기준 "8f-1" 전부.
- **번역 요청 바이트 불변**: `runJob` 일반화 전후로 번역·낭독 동반 번역·탭 번역 요청 본문이 HEAD 와 바이트까지 같다(node 로 pipeline 을 흉내 provider 에 물려 비교 + headless 한 번으로 실제 요청 본문 대조 — HEAD 판은 `git archive`).
- 캐시: 기존 번역 캐시 키 불변(같은 입력의 키가 HEAD 와 같음), term 키는 '\n' 경계 결함이 없음(`'a\nb'+'c'` vs `'a'+'b\nc'` 꼴이 다른 키).
- DB: 문서 삭제 시 term 카드가 남는다(설계대로), 다른 카드 연쇄 삭제는 그대로.
- 흉내 Gemini 로 term 요청 → 스키마 검증 통과·실패(잘린 JSON·빈 뜻·다른 언어)·429·offline 처리, 호출 수(설계 6절).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless 한 번(Edge 412×915, 새 프로필 `b8f1/p1`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS): 앱이 뜨고 낭독 동반 번역·탭 번역이 그대로이며 요청 본문 바이트가 HEAD 와 같음, 콘솔 오류 0. 화면이 없으니 term 경로는 node 시험으로.
- 변이 3개 이상(설계 9 우선 — 예: term 키를 '\n' 잇기로, `applyImport` 가 `dueAt` 덮기, 연쇄 삭제에 term 포함, `runJob` 이 문자열만 받기) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8f1/bak/`).

## 수정 범위
설계 5 표 8f-1 행의 파일 + `index.html`(stamp) + `tests/` + `spec.md`(17-7-6 안 `[정정 2026-11-16 — 8f-1 Build]` 줄 — Edit 로 그 자리만) + 스크래치패드 `b8f1/` + 보고서. 그 밖(8c-1 이 만든 `selbar.js`·`trband.js`·`controls.js` 등 화면 파일, review.md, `dev/`) 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만**(백업·복사·확인·grep·curl 도 각각 따로 — 앞 Build 들이 묶어서 어겼다). 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지. 시험 스크립트는 `try { … } finally { await browser.close() }`(pipe), 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지 — 새 폴더 이름). 8000 python 쓰기만, 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
