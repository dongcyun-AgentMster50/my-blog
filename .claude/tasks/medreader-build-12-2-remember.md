# Build 지침 — 12-2 기억 카드 만들기 — 띠 [☆] 세 모드 · 선택 줄 [기억 카드] · 음성 "기억"

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-11** 중 12-2 몫 — 4(카드 — "문서를 지워도 남는다"의 삭제 확인 한 줄 합치기)·5(카드 만들기 — 입구 셋, 번역 없으면 앞면만, `pendingBacks`, `[★]` 되돌리기, 음성 "기억" 표·실행)·7 표 12-2 행·import 방향·8 "12-2" 수용 기준·공통·9·10 결정 표(권장안)·13(실기기 — 적기만), 17-11 안의 `[정정 2026-11-17 — 12-1 Build]` ①–⑦. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-12-2-remember-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- 12-1 보고서 `.claude/tasks/medreader-build-12-1-srs-service-report.md`·review.md "12-1 Review" 절(넘긴 것 반영). API: `cardStore.saveSentence`·`get`·`removeIfFresh`·`fillBack`·`keptCount`, **id 는 `cardStore.idFor({front, targetLang, docId})`**(12-1b — 문서 칸이 fileHash 바탕 `sentenceDocKey` 라 `sentenceIdOf(tl, docId, front)` 를 직접 부르면 다른 id 가 나온다 — 띠 `[★]` 상태는 반드시 `idFor`). **`srs.log` 읽기는 `cards.readLog()`**(crossstep "12-2·12-3·13-2").
- **띠**: 8c-1 이 머리 줄 끝에 단추 칸 둘을 두었다(`[×]` + `[☆]` 자리 — `#trSlot`/`#trTools`). 11-4 가 탭 모드를 **설명 모드**로 넓혔다(`[▶ 다시 듣기]`·`[×]`·꼬리표) — 세 모드(낭독·탭·설명)의 `[☆]` 자리·크기·RTL 이 기존 단추와 겹치지 않게. 11-4b/c 의 실패 배너·`dropNoteBanner`·Esc 층·포커스 되돌림 그대로.
- **선택 줄**: 11-2 이후 보이는 칸 [단어 번역][문장 번역][설명] + `[⋯]`(요약·여기서부터 읽기·찾아보기) — `[기억 카드]` 는 `[⋯]` 안에(설계 5 표).
- **음성**: 9b 명령 표에 `remember` 줄(ar·en `[검토 — Nour·운영자]`). 11-2/11-4 가 `askFor(ASK_KINDS)` 한 흐름으로 묶었다 — "기억"은 AI 호출이 없는 갈래라 그 흐름을 쓸지·따로 둘지 판단(되돌림 규칙 `restore(was)` 한 곳). 9b 말뭉치(9b Review 하네스) 변화 0(새 낱말이 기존 명령을 빼앗지 않음 — 특히 «احفظ» 류와 기존 명령).
- **서재 삭제 확인**: `deleteKeepLines` 한 함수에 "기억 카드 m"(`keptCount`) — 설계 4 "한 줄로 합친다"(`library.card.deleteKeeps` — 0 인 것은 뺌). 11-2 가 "저장한 요약 n" 을 더했다.

## 할 일
설계 7 표 12-2 행 그대로: 새 `js/ui/remember.js`·`tests/remember-12.test.mjs`, 고칠 `js/ui/trband.js`(`[☆]` 세 모드)·`js/ui/selbar.js`(`[⋯]` 에 `[기억 카드]`)·`js/voice/commands.js`(`remember`)·`js/ui/voice.js`(갈래)·`js/ui/controls.js`(배선)·`js/ui/library.js`(삭제 확인 한 줄로 합침)·`index.html`(띠 단추)·`css/reader.css`·i18n 4개(약 10키, ar·fr `[검토 — Nour·운영자]`). **호출 0**(카드 만들기는 어떤 경로도 AI 요청 없음 — 번역은 메모리·캐시에서만). 낭독을 멈추지 않음. DB 3·algoVersion·모든 `*_PROMPT_VERSION` 불변.

## 검증
- 수용 기준 "12-2" 전부 + 변이(설계 끝) 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b12-2/bak/`).
- 호출 0: 흉내 Gemini 가로채기로 카드 만들기 전 경로 POST 0. 요청 본문 바이트 HEAD 와 같음(앞 Review 하네스 읽기만).
- 회귀: 8c-1 탭 띠·Esc 층·손가락, 11-2 요약 시트·[⋯]·음성 "요약", 11-4 설명 띠·실패 배너·이어 읽기, 18 [찾아보기], 9a·9b 전부(말뭉치 692판), 8e 가로 dock, 8f-2 시트, 서재 삭제 확인 4언어.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독 명령), `--check` 0, `git diff --check` 0.
- headless: Edge, pipe, 새 프로필 `b12-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성·9b 가짜 인식기, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 360×740·412×915·915×412 × 4언어(띠 세 모드의 `[☆]`·선택 줄 `[⋯]`). 콘솔 오류 0. 스크린샷 3–5장 `b12-2/shots/`.
- spec 17-11 안 `[정정 2026-11-17 — 12-2 Build]` 줄(Edit 로 그 자리만, 필요할 때만), 17-1-2 9b 명령 표에 `remember` 한 줄(설계가 말한 곳).

## 수정 범위
설계 7 표 12-2 행의 파일 + `js/ui/ask.js`(음성 흐름을 묶을 때만 — 이유를 보고서에) + `index.html`(stamp 포함) + `tests/`(선택 줄·명령 id 목록 기대 — 이유를 보고서에) + `spec.md` + 스크래치패드 `b12-2/` + 보고서. `srs/*`(부르기만)·`ai/*`·`db.js`·`backup/*`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 실물 PDF 문장은 결과에 넣지 않는다. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
