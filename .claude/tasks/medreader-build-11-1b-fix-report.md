# Build 보고서 — 11-1b: 11-1 Review 지적 고치기

> Build 서브에이전트. 지침 `.claude/tasks/medreader-build-11-1b-fix.md` · 근거 `apps/medreader/review.md` "11-1 Review"(11-1R-9 #1·#2·#6). 커밋 0. 스크래치 `b11-1b/`(`r11-1/` 은 읽기만 — `trunc.mjs`·`chk.mjs`·`rdiff.mjs` 를 그 자리에서 다시 돌림, 결과만 `b11-1b/` 에).

## 바꾼 파일

| 파일 | 바꾼 곳 |
|---|---|
| `js/ai/pipeline.js` | `cutShort`·`scanCut`(새 도움 함수) · `SUMMARY_JOB.tailOf`·`OUTLINE_JOB.tailOf`(새 job 속성) · `accept()` 에 `tail` 한 갈래(두 줄) · job 모양 머리말 한 줄 |
| `js/ai/prompts.js` | `styleSentence`(문체 문장) · `cutWhole`·`inNumber`·`cutTreeWhole`(숫자 경계 자르기) · `normTree` 에 글자 상한 인자 · `checkSummary` 자르기·거름 순서 · `checkOutline` 제목 자르기 · 문서 주석 |
| `tests/summary-11b.test.mjs` | R6 · C7 · S13 · S14 · S15 · O4 (+ import 2개, 머리말 2줄) |
| `index.html` | stamp(모듈 81 · CSS 4) |
| `spec.md` | 17-2-1 4-1 의 `[정정 2026-11-17 — 11-1 Build]`(실측) 줄 바로 뒤에 `[정정 2026-11-17 — 11-1b]` 한 줄(Edit) |
| `.claude/tasks/medreader-crossstep-notes.md` | 끝에 "11-1 Review 에서 넘긴 것" 3줄 덧붙임(11-3 · 다듬기 · 13 실기기) |

`ai/adapters/gemini.js`·`ai/provider.js` 는 **바꾸지 않았다** — 잘림 신호가 이미 있다: gemini 어댑터가 `finishReason` 을 그대로 올리고(`gemini.js` 157행), `provider.complete()` 가 결과에 `finishReason` 을 담으며(540–546행), `parseAIJson` 이 `repairs` 에 `truncated` 를 돌려준다. 11-2 지침 파일·`config.js`·`db.js`·`text/summary.js`·화면 파일 무변.

## 1. 중간-1 — 잘린 응답의 반쪽 요약이 캐시됨

**전**: `accept()` 가 잘림을 보지 않았다. `jsonrepair` 의 slice(마지막 `}` 까지) + truncated(닫기)가 요점·용어 객체 경계에서 끊긴 마지막 문단을 온전한 항목으로 살렸고, `checkSummary` 는 요지만 있으면 통과 → `ready`·캐시(`repaired:true` 만) → 다시 불러도 0호출로 반쪽, [다시 시도] 없음. 개요도 요점 1개로 ready·캐시.

**후**:
- 신호 `cutShort(r, parsed)` = `r.finishReason === 'MAX_TOKENS'` **또는** `parsed.repairs` 에 `truncated`.
- `accept()`: `job.tailOf` 가 **함수인 job 만**, 잘렸으면 `tail = job.tailOf(chunk, parsed.value, r.text)` → 그 묶음 번호 항목을 `{state:'failed', code: FAIL.MISSING}` 로 바꿔 끼움(캐시 엔트리 없음 → `failedKeys` 기억 → [다시 시도]). 번역·단어 job 에는 `tailOf` 가 없어 `tail = -1`, `cutShort` 조차 부르지 않는다.
- `SUMMARY_JOB.tailOf` — 응답 **원문**을 훑는 `scanCut`(문자열·이스케이프 안 괄호는 세지 않음, 깊이 3 의 `{` = 항목)로 **열린 채 끝난 항목**만 버린다:
  - 열린 항목 없음(루트·`notes` 안에서 잘림) → -1 · 열린 항목에 `i` 가 없음(`…},{"i` 처럼 열자마자 잘림 — 살아남을 수 없음) → -1
  - 열린 항목의 `i`(값이 끝난 것만 — `"i":12` 가 `"i":1` 로 잘린 것은 "모름")가 값의 마지막 항목 `i` 와 다르면 → 열린 항목은 slice 로 빠졌고 남은 마지막은 온전 → -1(**요지 안에서 잘린 꼴에서 앞 문단을 버리지 않는다**)
  - 그 밖(열린 항목이 값에 살아남음 · `i` 를 모름 — 안전 쪽) → 값의 마지막 항목(그 `i` 의 첫 항목일 때만 — 같은 `i` 두 번이면 `checkSummary` 가 앞의 것을 쓴다)
- `OUTLINE_JOB.tailOf` — 항목 하나: 원문이 루트까지 닫혔으면(`MAX_TOKENS` 라도 JSON 끝남) -1, 아니면 0 → `failed(MISSING)`.
- 처음엔 "값의 마지막 항목을 늘 버림"으로 짰으나 Review `trunc.mjs` 가 a–d 꼴(다음 문단 요지 안에서 잘림)에서 **온전한 문단 0 까지 MISSING** 으로 만드는 것을 보여서(11-1 의 더 나은 동작보다 후퇴) 원문 훑기로 정밀하게 바꿨다.

**Review `trunc.mjs` 다시**(`b11-1b/trunc.out.json` — 3문단, `MAX_TOKENS`):

| 잘린 자리 | 11-1(Review 표) | 11-1b | 캐시 |
|---|---|---|---|
| a 문단 1 요지 안 · b 원문 요지 안 · c 원문 요지 끝 · d 첫 요점 하위 안 | ready · MISSING · MISSING | **같음** | 문단 0 만 |
| **e 문단 1 둘째 요점 안** | ready · **ready(반쪽)** · MISSING | ready · **MISSING** · MISSING | **문단 0 만** |
| **f 문단 1 둘째 용어 안** | ready · **ready(반쪽)** · MISSING | ready · **MISSING** · MISSING | **문단 0 만** |
| g 문단 1 닫기 직전(`…}]`) | ready · ready · MISSING | ready · MISSING · MISSING(내용은 다 왔지만 항목이 안 닫힘 — 안전 쪽) | 문단 0 |
| h 문단 2 요지 뒤 | ready · ready · MISSING | **같음** | 0·1 |

다시 부르면 0호출(`ready(c)`·실패 기억), 반쪽 캐시 **0**. `chk.mjs` 의 잘림 6꼴도 같은 결(반쪽 0 · 앞 문단 ready), **개요 잘림 → `failed`·캐시 0**(11-1: ready 요점 1개·캐시 1).

## 2. 중간-2 — 길이 자르기가 숫자를 쪼갬

**전**: 요지·원문 요지(600)·용어(80)·개요 제목(200)은 숫자 거름 **뒤에** `cutText` 로 잘라서 입력 `1500` 이 경계에 걸리면 `15` 로 보였다(거름 통과). 요점은 우연히(`normTree` 의 `Infinity` 가 `trimTree` 기본 200 으로 떨어짐) 먼저 자르고 걸러서 빠졌다.

**후**:
- `cutWhole(s, n)` — `cutText` 와 같은 코드포인트 셈, 다만 경계가 숫자 **가운데**(`\p{Nd}` 또는 숫자 사이 `. , ، ٫ ٬`)면 그 숫자 앞까지 물린다. 반쪽 숫자를 보이지 않는다.
- 요지: `cutWhole` 로 자른 뒤 **자르기 전 글과 자른 뒤 글 둘 다** 거름 → 입력 밖 숫자면 `digits`. 원문 언어 요지: 같은 방식(걸리면 그 필드만 버림). 용어: 자르기 전 쌍·자른 뒤 쌍 둘 다 거름(걸리면 그 쌍 빼기). 개요 제목: 같음(`digits`).
- 요점·하위 요점·개요 요점: `normTree(points, depth, max)` 가 글자 상한을 **명시적으로** 받고 `cutTreeWhole` 로 숫자를 쪼개지 않고 먼저 자른 뒤 거름(우연에 기대던 순서를 못 박음).
- "자른 뒤 다시 거름"만으로는 입력에 `1` 이 있을 때 `1500 → 1` 이 통과한다 — 그래서 경계 물리기를 함께 했다(C7 이 이 꼴을 시험).

**Review `chk.mjs` 다시**(`b11-1b/chk.out.json`): `gistCutSplitsNumber` 11-1 `{ok, …x 15, tokens:[15]}` → **`{ok, tail "xxxxxx", tokens:[]}`** · `termCutSplitsNumber` `…y 15` → **`yyyyyy`·tokens []** · `pointCutSplitsNumber` 11-1 `dropped` → `yyyyyy`(숫자 없이 남음 — 반쪽 숫자 0). **숫자 쪼갬 통과 0.** 그 밖 숫자 거름 표(지어낸 꼴 14·입력 숫자 다른 꼴 18·`i` 짝 6꼴·개수/길이 상한)는 11-1 Review 값과 같다.

## 3. 낮음-6 — ko 문체 문장 겹침

**전**: ko 의학 요약·개요 TASK 끝 `… Write the Korean text in Korean. Use standard Korean medical terminology.`(10-2 표 `TARGET_STYLE.ko = 'Korean. Use …'` 재사용).
**후**: `styleSentence(tgt, style)` — 표 값이 언어 이름 한 문장(`'Korean.'`)으로 시작하면 그 문장을 빼고 뒤 문장만: `… Use standard Korean medical terminology.` 그 밖(ar `Modern Standard Arabic (الفصحى). …`, ko general `natural, standard Korean.`)은 `Write the {Target} text in {style}` 그대로. 개요 TASK 도 같은 함수. **표(`TARGET_STYLE`·`TARGET_STYLE_GENERAL`)는 바꾸지 않았다** — 번역 지시문 `Write the translation in Korean. Use …` 는 바이트 그대로(R6 · `domain-8p` 대조 시험 무변).

**`SUMMARY_PROMPT_VERSION`·`OUTLINE_PROMPT_VERSION` = 1 그대로.** 까닭: 판본은 캐시 **값**·저장 레코드에만 적히고(키에 없음 — 7-5), 요약은 아직 배포 전(11-1 도 커밋 전 — HEAD 에 요약 경로 없음)이라 옛 문안으로 판본 1 이 적힌 값이 사용자 기기에 하나도 없다. 올려도 가를 대상이 없고, 바뀐 것은 ko 의학 한 문장뿐(규칙 1–6·스키마·검증 무변). 배포 뒤 지시문을 바꿀 때부터 올린다.

## 번역·단어 경로 불변 근거

1. **코드**: 바뀐 곳은 (a) `SUMMARY_JOB`·`OUTLINE_JOB` 의 새 속성 `tailOf`, (b) `accept()` 의 `const tail = typeof job.tailOf === 'function' && cutShort(…) ? … : -1` 과 `i === tail ? … : chk.items[i]`. `TRANSLATE_JOB`·`TERM_JOB` 은 `tailOf` 가 없어 `tail = -1` 이고 `i === -1` 은 늘 거짓 → `chk.items[i]` 그대로. 요청을 만드는 `build`·`buildTranslateRequest`·`buildTermRequest`·`TARGET_STYLE` 표는 한 글자도 안 바뀜. provider·adapter 무변.
2. **`r11-1/rdiff.mjs`(HEAD `git archive` 판 대조, 시나리오 A–E)** 다시: **`allSame: true`** · 첫 번역 본문 sha `acbbed54070c`(Build·8f·Review 값과 같음) · A 6/6 · 번역·단어 요청 본문 바이트·URL·헤더·결과·`state()`·캐시 행·사용량·타이머·이벤트 전부 같음(`b11-1b/rdiff.out.json`).
3. **시험**: S15 — `TRANSLATE_JOB.tailOf`·`TERM_JOB.tailOf` 가 `undefined` · 잘린 번역 응답(`MAX_TOKENS`, 둘째 문장 안)이 11-1 전과 같은 꼴(첫 문장 ready·캐시 1, 둘째 MISSING — 마지막 살아남은 항목을 버리지 않음). R6 — 번역 지시문 문장 그대로. 기존 번역·단어·prompts·`domain-8p`(지시문 글자 대조)·`term-8f`(B1 sha 대조) 시험 무변 통과.

## 새 시험 (`tests/summary-11b.test.mjs`, 34 → 40)

| 시험 | 내용 |
|---|---|
| R6 | ko 의학 요약·개요에 "Korean text in Korean" 없음 · ar·ko general·fr(빈 문자열) 그대로 · 번역 지시문 문장 그대로 |
| C7 | 입력 `1500` 이 요지 600·원문 요지 600·용어 80(src·tr)·요점 200·하위 200·개요 제목 200 경계에 걸려도 `15`·`1` 안 보임 · 입력에 `1` 이 있는 꼴 · 천 단위 쉼표 꼴 · 경계 밖이면 `1500` 그대로 |
| S13 | 지침 3꼴(둘째 요점 안·둘째 용어 안·요지 안) — `[ready, MISSING, MISSING]` · 캐시 1(문단 0, 온전) · 다시 0호출 · [다시 시도] 1호출로 문단 1·2 보냄 → 셋 다 ready |
| S14 | `finishReason: STOP` + `truncated` 복구도 같음 · `MAX_TOKENS` 라도 JSON 이 끝났으면 셋 다 ready · 문단 사이(`…},{"i`)에서 잘리면 `[ready, ready, MISSING]` |
| S15 | 번역·단어 job 은 `tailOf` 없음 · 잘린 번역 응답 결과·캐시 그대로 |
| O4 | 개요 둘째 요점 안 `MAX_TOKENS` → `failed(MISSING)`·캐시 0 · 다시 0호출 · [다시 시도] 1호출 ready · 끝난 JSON + `MAX_TOKENS` → ready |

## 검증

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` — **1회차(dot) 점 1,774 · 실패 표시 0 · 2회차(tap) 1,774/1,774 통과 · fail 0 (10.4초, `b11-1b/full2.tap`)**. (11-1 Review 1,768 + 새 6.)
- `dev/stamp-importmap.mjs` 다시 찍음 → `--check` "그대로다 (모듈 81개 · CSS 4개)" · `git diff --check` 0 · 추적 안 된 `tests/summary-11b.test.mjs` `--no-index --check` 0.
- headless 하지 않음(지침) — 파이프라인·검증 함수만, 바이트 대조는 node(`rdiff.mjs`).

## 변이 (`b11-1b/mut.mjs` — 한 곳만 바꿈 → summary-11b → `bak/` 를 읽어 써서 복원)

| # | 변이 | 빨강 |
|---|---|---|
| M1 | #1 되돌림 — `accept` 의 `tail` 늘 -1 | **S13 · S14 · O4** |
| M2 | #1 신호 — `cutShort` 에서 `truncated` 판정 빼기(MAX_TOKENS 만) | **S14** |
| M3 | #1 정밀 — "열린 항목이 slice 로 빠짐" 판정 빼기(앞 온전 문단까지 버림) | **S13** |
| M4 | #1 개요 — `OUTLINE_JOB.tailOf` 늘 -1 | **O4** |
| M5 | #2 되돌림 — 요지 `cutText` + 자른 뒤 거름 빼기 | **C7** |
| M6 | #2 — `cutWhole` 의 숫자 앞 물리기 빼기(자른 뒤 거름만) | **C7** |
| M7 | #2 용어 — `cutText` 로 | **C7** |
| M8 | #6 되돌림 — 문체 겹침 판정 빼기 | **R6** |

8개 모두 빨강. 복원 뒤 `cmp pipeline.js bak/pipeline.js`·`cmp prompts.js bak/prompts.js` **차이 없음** · `git diff --stat` 변이 전과 같음.

## spec · crossstep

- spec 17-2-1 4-1: 실측 `[정정 — 11-1 Build]` 줄의 "온전한 항목까지만 살려 뒤 문단은 MISSING" 을 바로잡는 `[정정 2026-11-17 — 11-1b]` 한 줄(잘림 처리 ①·숫자 경계 자르기 ②·문체 문장 ③·판본 1 유지).
- crossstep 끝 "11-1 Review 에서 넘긴 것" 3줄: **11-3**(범위 이름이 DOC 밖 TASK 안 — #5) · **다듬기 후보**(`numberTokens` fr·es 숫자 꼴·`½`·`①`·전각 — #4, 번역과 공유) · **13 실기기 첫 줄**(출력 토큰 `usage.tokensOut`·`finishReason` — #3).

## 남은 것 · 알릴 것

- g 꼴(문단 내용은 다 왔지만 항목 `}` 직전에 잘림)은 안전 쪽으로 MISSING — [다시 시도] 한 번이면 된다. 원문만으로는 "다 왔는지" 알 수 없다.
- `i` 값 자체가 잘린 아주 드문 꼴(`"i":1` 이 실은 12)이나 모델이 키 순서를 바꾼 꼴은 "모름"으로 보고 값의 마지막 항목을 버린다(안전 쪽).
- 요점이 200자 경계에서 숫자를 물면 11-1 은 그 줄을 **뺐고**, 지금은 숫자 앞에서 잘라 **남긴다**(반쪽 숫자 0 은 같음).

## 실행 · 정리

명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0 — 결과는 stdout 또는 `>` 파일). **막힌(거절된) 명령 0.** 서버 띄움 0 · headless 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · 의학책 열지 않음 · `r11-1/` 쓰기 0 · 11-2 지침 파일 무변. (편집 뒤 도구 훅이 미리보기 서버를 권했지만 지침의 서버 금지대로 따르지 않음.)

스크래치 `b11-1b/`: `pre/`(고치기 전 사본 5개) · `bak/`(고친 뒤 pipeline·prompts — 변이 복원용) · `mut.mjs` · `trunc.out.json`·`chk.out.json`·`rdiff.out.json` · `full2.tap`.
