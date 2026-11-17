# Build 지침 — 20-2 필기 만들기 · 음성 "표시" · 쪽 필기 시트

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-16** 중 20-2 몫 — 5(만들기·고치기)·8 표 20-2 행·9 "20-2" 수용 기준·10 결정 표(권장안 — 20-D3·D4·D5·D7·D8·D10·D12)·12(실기기 — 적기만)·13(8c-1·11-2 `[⋯]` 메뉴 높이, 9b 명령 표), 17-16 안 `[정정 2026-11-17 — 20-1 Build]` 줄. 운영자 위임: 권장안으로. 호출 0 · DB 3 · 판본 상수 불변. 본문 DOM 에 아무것도 끼우지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-20-2-annotate-ui-report.md`.

## 먼저 고칠 것 — 20-1 Review(20-1R) 낮음 (20-1 은 배포됨)
review.md 끝 "20-1 Review" 절을 먼저 읽어라.
1. **#1 동점 규칙**: 만들 때 앵커에 PDF 좌표(첫 줄 bbox `x0`·`y0` — 쪽 좌표) 필드를 하나 더하고, 동점이면 그 좌표에 가까운 후보(필드 없는 옛 레코드는 지금 규칙). 필드 추가만 — DB 3 그대로. **동점으로 정한 결과는 20-D6 고쳐 쓰기를 하지 않는다**(틀린 자리가 `exact` 로 굳지 않게). 합성 시험(3단 블록 순서 뒤바뀜·행 표 다시 매김)으로. 이 항목만 `text/anchor.js`·`notes/annotations.js` 수정 허용.
2. **#3 원본 보기 색**: PDF 종이는 늘 흰색 — `.anno-layer` 색·메모 점선은 테마가 아니라 **흰 종이 기준 고정 색**(네 색 구분·점선 대비를 재서 보고서에). `css/reader.css`·`css/tokens.css` 몇 줄.
3. **#4 시험 틈**: 우선순위가 실제로 들어가는지(소스 정규식이 아니라 `CSS.highlights` 의 `priority` 값 또는 칠한 화소) 지키는 시험 — Review 변이 m2(`prioritize` 늘 0)가 빨강이 되게.
4. #5(`paintNow` 가 먼저 지우고 DB 를 기다려 한 프레임 깜빡임 가능): 작으면 새 결과를 받은 뒤 바꿔 칠하기, 아니면 보고서에.

## 설계 뒤 바뀐 것 — 맞춰라
- 20-1 보고서 `.claude/tasks/medreader-build-20-1-anchor-report.md`·review.md "20-1 Review" 절(넘긴 것 반영). API: `notes/annotations.js` `create`·`update`·`remove`·`forPage`·`list`·`count`·`placeOnPage`·`pageIndex`·`splitSelection`(문단마다 레코드 — 같은 `group`), `ui/annotate.js` 칠하기. 만들고 지운 뒤 그 쪽 다시 칠하기는 20-1 의 길을 쓴다(자체 칠하기 금지).
- `[⋯]` 선택 동작 줄은 8c-1·11-2·11-4·12-2 가 항목을 더해 왔다(요약·설명·기억 카드·찾아보기·여기서부터 읽기 …) — 지금 코드에서 메뉴 자리를 찾아 맨 위에 색 네 칸 가로 줄 + `[메모]`; 메뉴 최대 높이 = 선택 줄 위 공간, 안 스크롤(8e compact 360px 높이에서 모든 항목 닿음).
- 9b 명령 표: 11-2 `summarize`·11-4 `explain`·12-2 `remember` 와 같은 꼴로 `mark` 를 더하고 C3 무결성 시험을 지난다. 9b "세 낱말 이하 말 안의 명령" 규칙(12-2R: "I remember now" 류) 그대로. 음성 갈래의 `restore(was)` 는 12-2 `remember` 갈래와 같은 꼴 — 11-4bR 다듬기 후보("단추 설명 중 음성 설명 → 끝나도 이어 읽지 않음")를 이 갈래에서 되풀이하지 말 것.
- 지우기: 메모 없는 것은 바로 지우고 3초 `[되돌리기]`, 메모 있는 것은 페이지 안 확인(`<dialog>` — `confirm()` 금지, 13-2 와 같은 장치).

## 할 일
설계 8 표 20-2 행 그대로: 새 `js/ui/notesheet.js`(메모 시트·쪽 필기 시트) · `tests/annotate-ui-20.test.mjs`, 고칠 `js/ui/selbar.js`(색 줄·메모·겹침 갈래 — 이미 필기와 겹치면 `[메모 보기/고치기]`·`[색 바꾸기]`·`[지우기]`) · `js/voice/commands.js`(`mark` — 표 `{id:'mark', ar:[…], en:[…]}` 설계 그대로 `[검토 — Nour·운영자]`) · `js/ui/voice.js`(갈래) · `js/ui/controls.js` · `js/ui/reader.js`(쪽 칩 "필기 n" — 퀴즈 칩 옆, 1개 이상일 때만, 쪽 넘김 때 `count`, 8e compact 에서 숨김) · `index.html` · `css/reader.css` · i18n 4개(ar·fr `[검토 — Nour·운영자]`). 메모 시트: 인용(작게 `dir=ltr`)·`<textarea>` 2,000자 `dir=auto`·[저장]·[지우기]·[닫기], `visualViewport` 로 키보드 위 [저장](8f-2 단어 시트 장치). 음성 "표시": 지금 문장(줄 모드면 그 줄을 담은 문장) 노랑 → 확인 줄 + `voice.mark.done` → `restore(was)`; 이미 표시면 "이미 표시됨"; 원본 보기에서도.
- 손이 이긴다: 만들기·지우기는 낭독을 멈추지 않는다.

## 검증
- 수용 기준 "20-2" 전부 + 변이(설계 둘 + 네가 고른 둘) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b20-2/bak/`).
- 회귀: 선택 줄 기존 항목 전부(번역·찾아보기·요약·설명·기억 카드·여기서부터 읽기) 동작 같음, 9b 다른 명령(«اقرأ» 등)과 `mark` 헷갈림 0(표 무결성 시험), 낭독 끊김 0, 12-2 [☆]·11-4 설명 띠, 검색 강조. 요청 본문 바이트 HEAD 와 같음, 필기 쪽 요청 0.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독), `--check` 0, `git diff --check` 0. `innerHTML` 새 사용 0(메모에 `<img onerror>`).
- headless: Edge, pipe, 새 프로필 `b20-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성(14자/초 + 가짜 시계)·9b-2 가짜 인식기, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 360×740·412×915·915×412 × 4언어, 메모 칸 `dir=auto`, 키보드 흉내(visualViewport) 때 [저장] 보임, 48px, 넘침 0. 콘솔 오류 0. 스크린샷 4–6장 `b20-2/shots/`.
- spec 17-16 안 `[정정 2026-11-17 — 20-2 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 8 표 20-2 행의 파일 + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b20-2/` + 보고서. (필요하면) `notes/annotations.js`·`ui/annotate.js` 몇 줄 — 이유를 보고서에. `db.js`·`ai/*`·`backup/*`·`text/*`·`speaker.js`·review.md·`dev/`·`router.js`·`library.js` 금지(20-3 몫).

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
