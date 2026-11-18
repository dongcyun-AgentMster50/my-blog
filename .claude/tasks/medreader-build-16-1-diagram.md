# Build 지침 — 16-1 개념도: 요청 · 검증 · 배치 (화면 없음)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-14** 중 16-1 몫 — 1(지금 코드 사실 — 옛 사실이 섞임, 아래 "바뀐 것")·2(요청·스키마·검증)·3(배치 — 순수, 외부 라이브러리 없음)·5 표 16-1 행·6(호출)·7 "16-1" 수용 기준·8 결정 표(권장안 — 16-D2·D3·D4·D5·D8). 운영자 위임: 권장안으로. **새 호출은 `diagram()` 을 부를 때만**(자동 0). 입력은 **저장한 개요만**(원문 다시 보내지 않음). DB 3 · 기존 판본 상수 불변 — 새 `DIAGRAM_PROMPT_VERSION = 1`. **번역 요청 본문 바이트 불변.** **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-16-1-diagram-report.md`.

## 설계 뒤 바뀐 것 — 맞춰라
- 11-3 은 배포됨: 개요는 `annotations` `kind:'outline'`(`notes/summaries.js` `saveOutline`), 트리 `ui/tree.js` `renderTree`, 숫자 거름(`pruneForeignNumbers`/`numberTokens`) — 실제 레코드 꼴(`points` 깊이·`cacheKey`·`range`)을 코드에서 읽어 `outlineText` 를 맞춘다.
- **범위 이름(장 제목)을 TASK 문장에 넣지 않는다**(11-1R #5 — PDF 장 제목이 지시문 꼴일 수 있다). 제목이 필요하면 DOC 안 데이터로만, 아니면 빼라. 개요 요점 글도 DOC(데이터) 안에만, `escapeDoc`.
- 11-4 `EXPLAIN_KIND` 처럼 `USAGE_KINDS` 밖 종류 — `AI.DIAGRAM_KIND`·`bumpUsage` +2줄(7a 빈 행 시험 무변). 11-1 `runJob` 위 `DIAGRAM_JOB` — 상태 기계·gate·429·cooldown·상한 한 벌.
- 15-1R 교훈: 숫자 거름은 "보낸 개요 숫자 ⊆" 로, 관대한 비교에서 부호(`−`·`±`)·`%` 를 지우지 말 것.
- 8c-1 이후 pipeline 의 429→exhausted 판정 문제(crossstep 8c-1 줄)는 이 단계 밖 — 바꾸지 않음.

## 할 일
설계 5 표 16-1 행 그대로: 새 `js/text/diagram.js`(순수 — `outlineText`·`checkDiagram`·`layoutDiagram`·`wrapLabel`·`crossings`; 같은 입력 같은 좌표, `measure` 주입) · `tests/diagram-16.test.mjs`. 고칠 `js/ai/prompts.js`(`buildDiagramRequest`·`DIAGRAM_SCHEMA` 관계 enum 8개 — **'치료' 없음**) · `js/ai/pipeline.js`(`DIAGRAM_JOB`·`diagram()`) · `js/ai/provider.js`(`DIAGRAM_KIND`) · `js/config.js`(`DIAGRAM`·`AI.DIAGRAM_KIND`). 실패 `few-relations` 는 캐시하지 않음.

## 검증
- 수용 기준 "16-1" 전부 + 변이(설계 넷 + 네가 고른 하나 — 경로 `p` 검사) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b16-1/bak/`). 고리 끊기 변이는 시험 시간 상한으로 빨강이 되게(무한 루프가 전체 시험을 막지 않게 — 그 시험만 `timeout` 옵션).
- 배치 품질: 합성 그래프 10개(사슬·나무·고리·두 층 건너기·엣지 없는 노드·12노드 16엣지 꽉 참)로 교차 수·`maxW 320` 접힘·노드 겹침 0·RTL 거울 표. 결정성(두 번 깊은 같음).
- 가짜 provider 만(진짜 키·진짜 요청 0): 1호출·같은 입력 0호출·429/capped/no-key 막힘·`byKind.diagram` +1. **번역·요약·설명·출제 요청 본문 바이트 HEAD 와 같음**(rbody 하네스 — `r15-1/`·`b15-1/` 읽기만).
- 입력 크기: 저장 개요 꼴의 합성 3단 개요(요점 수 많은 것)로 4,000자 넘김 → 3단 뺌 → 그래도 넘으면 보내지 않음.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독), `--check` 0, `git diff --check` 0. `text/diagram.js` 순수 grep.
- spec 17-14 안 `[정정 2026-11-17 — 16-1 Build]` 줄(Edit 로 그 자리만, 필요할 때만).

## 수정 범위
설계 5 표 16-1 행의 파일 + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b16-1/` + 보고서. `ui/*`·`notes/*`·`db.js`·`backup/*`·`text/backup.js`·`speaker.js`·`voice/*`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. **Write 도구가 `\u2028`·`\u2029`·`\uFEFF` 같은 이스케이프를 실제 글자로 바꿔 넣는 일이 있었다 — 그런 글자를 쓰는 파일은 쓴 뒤 HEAD 대비 그 글자·NUL·CR 수를 점검.** 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
