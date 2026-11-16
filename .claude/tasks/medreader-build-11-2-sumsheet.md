# Build 지침 — 11-2 요약 시트 · 글 트리 · 선택 줄 [⋯]·[요약] · 음성 "요약"

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-2-1** 중 11-2 몫 — 3(대상)·4-3(요약 시트와 글 트리)·4-4(저장 단추)·4-5(음성으로 부르기와 소리)·5 표 11-2 행·import 방향·6(호출)·7(i18n `sum.*` 등)·8 "11-2" 수용 기준·공통·9(headless)·10 결정 표(권장안 — 특히 11-D3 `[⋯]`·11-D11–D13·11-D17·11-D18·11-D22)·13(실기기 — 적기만), 17-2-1 안의 `[정정 2026-11-17 — 11-1 Build]` 줄들. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-11-2-sumsheet-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- 11-1 보고서 `.claude/tasks/medreader-build-11-1-summary-service-report.md`·review.md "11-1 Review" 절(넘긴 것 반영). 11-1 이 만든 API: `pipeline.summarize`·`planSummary`, `notes/summaries`(`save`·`list`·`relocate`·대체), `text/summary.js`(`summaryTarget`·`eligible`·`paraTextsOf`).
- **선택 동작 줄**: 지금(8c-1·8f-2·18 뒤) `SEL_ACTIONS` = `[단어 번역][문장 번역][여기서부터 읽기][찾아보기]`. 11-D3 대로 **보이는 칸 = [단어 번역][문장 번역] + `[⋯]`**(셋째 칸 [설명]은 11-4 가 넣는다 — 그 자리는 비워 두거나 11-4 가 끼우기 쉽게), `[⋯]` 안 = [요약]·[여기서부터 읽기]·[찾아보기](18 — 링크 0개면 숨김 규칙 그대로). 18 Review 남은 1(360 ko·fr 단추 넷 접힘)이 이로써 풀리는지 확인. 18 의 목록 Esc 층·`armAnchor` 그대로.
- crossstep **"8f-2·11-2"**: 서재 삭제 확인 `deleteKeepLines` 한 함수에 "저장한 요약 n개는 남습니다" 줄을 더한다(11-1 이 `annotations` 스토어 전체를 남기게 했다 — 필기(20)도 같은 줄로 셀지는 20 몫, 지금은 요약·개요만 센다).
- 11-1 Review(범위 밖 HEAD 부터): 서재 삭제 확인 머리 문장 `library.card.deleteConfirm` 이 ko 에서 영어이고 "everything" 이라 이제 `annotations` 가 남는 것과 어긋난다 — 위 "남습니다" 줄과 함께 4언어 문구를 맞춘다(ar·fr `[검토]`).
- 9b 음성: `voice/commands.js` 에 `summarize` 줄(ar·en — 낱말은 `[검토 — Nour·운영자]`), `ui/voice.js` `exec` 갈래·`cancel` 에서 `sayer.stop`. 9b 다듬기 규칙(3낱말·부정어·Rb) 그대로 — 새 낱말이 기존 명령과 오탐을 만들지 않는지 9b 시험 무변 + 새 시험.
- 8c-1 탭 띠·8f-2 시트·18 목록과 **Esc 층 순서**: 요약 시트를 가장 위 층으로(8f-2 시트와 같은 꼴).

## 할 일
설계 5 표 11-2 행 그대로: 새 `js/ui/sumsheet.js`·`js/ui/tree.js`(`<details>` 중첩 — 11-D17)·`js/ui/ask.js`(요약 갈래)·`js/tts/say.js`(서비스 — `synth` 주입)·`tests/sumsheet-11b.test.mjs`·`tests/say-11.test.mjs`, 고칠 `js/ui/selbar.js`·`js/voice/commands.js`·`js/ui/voice.js`·`js/ui/controls.js`·`js/ui/library.js`·`index.html`·`css/reader.css`·i18n 4개(약 24키, ar·fr `[검토 — Nour·운영자]`). 호출은 설계 6절대로(부를 때만, 캐시 적중 0, [이 쪽 전체 요약]은 누르기 전 호출 수 표시). 시트 [▶ 듣기]는 `trSpeechText` 를 거침(괄호 원어 소리). 결과 고지 한 줄(11-D18). 번역 요청 바이트·캐시 키·DB 3·algoVersion·번역 `PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "11-2" 전부(`[D]` headless — 흉내 Gemini 가 `responseSchema` 로 번역/요약 갈래, 9b-2 가짜 인식기, 흉내 `speechSynthesis`), 변이(설계 11-2 끝 넷) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b11-2/bak/`).
- 회귀: 8c-1 탭 띠·선택 줄(손가락 판정·Esc 층)·8f-2 단어 시트·18 [찾아보기](목록·새 탭 속성)·9b 음성 명령 전부·9a 미디어 키·8e 가로 dock·서재 삭제 확인, 번역 요청 본문 바이트 HEAD 와 같음(앞 Review 하네스 읽기만 — `r8c1c/`·`r8f3b/`·`r18/`).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0, `grep -rn "splitSentences" js/` HEAD 와 같음.
- headless: Edge, pipe, 새 프로필 `b11-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기). 360×740·412×915·915×412 × 4언어(시트·`[⋯]` 메뉴). 콘솔 오류 0. 스크린샷 4–6장 `b11-2/shots/`.
- spec 17-2-1 안 `[정정 2026-11-17 — 11-2 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 5 표 11-2 행의 파일 + (Esc 층에 필요하면) `js/ui/trband.js` 몇 줄 + `js/ui/links.js`(18 목록을 `[⋯]` 안에서 여는 데 꼭 필요한 곳만) + `index.html`(stamp 포함) + `tests/`(선택 줄 단추 수를 고정한 옛 시험 기대값 — 이유를 보고서에) + `spec.md` + 스크래치패드 `b11-2/` + 보고서. `pipeline.js`·`prompts.js`·`db.js`·`notes/*`(11-1 — 부르기만)·`backup/*`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 큰 원서로 검색 화면에 들어가지 말 것. 실물 PDF 문장·요약 글은 결과 JSON 에 넣지 않는다. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
