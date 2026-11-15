# 초안 — spec 에 붙여 넣을 것 (11 Plan: 11b 문단 요약 + 저장 · 11c 요약 개요(글 트리) · 11a 이 문장 설명, 2026-11-16)

> 이 파일은 **초안**이다. spec.md 는 고치지 않았다. 붙일 자리:
> (A) 17-2 바로 뒤에 새 소절 **"17-2-1"** 전체.
> (B) 19-1 표 **11b** 행 끝, **11a** 행 끝에 `[수정 …]` 한 줄씩.
> (C) 3-2 import 방향 표에 `notes/*` 한 줄(아래 (A) 5 끝의 문장).
> (D) 9-2 `annotations` 행 `kind` 칸에 값 둘(아래 (A) 4-4 첫 줄).
> 7-3 · 10-3 · 16-D5 · 17-2 본문은 고치지 않는다 — 이 소절이 그 위에 덮이는 정본이다(8cf 초안과 같은 방침).

---

## (B) 19-1 표 행 끝에 붙일 한 줄

**11b 행** — `[수정 2026-11-16 — 11 Plan]` 설계·나누기·수용 기준은 **17-2-1** 이 정본이다(11c 포함). 세 Build — **11-1 요약 서비스·저장(화면 없음) → 11-2 요약 시트·글 트리·선택 줄 [요약]·음성 "요약" → 11-3 저장한 요약 모아 보기·범위 개요(11c)·내보내기.** 요약 언어는 `ai.summaryLangs` 가 아니라 **대상 언어 + 문서 원문 언어**(7-1 원칙 5), 출력은 처음부터 계층(요지 + 요점 2단) — 트리는 호출 추가 0. 저장은 `annotations` `kind:'summary'`, **문서를 지워도 남는다**. DB 버전 3 그대로·`algoVersion`·번역 `PROMPT_VERSION` 무변. 자리는 **10 뒤**(8c+8f·18·9c·10 과 `pipeline.js`·`prompts.js`·`selbar.js`·`controls.js`·i18n 이 겹친다). Build 합 약 8–8.5시간 + Review 약 4.5시간.

**11a 행** — `[수정 2026-11-16 — 11 Plan]` 설계는 **17-2-1** 이 정본이다. 한 Build **11-4**(11-3 뒤): 선택 동작 줄 [설명] · 9b "여기 설명" 명령 켜기(`enabled:true`) · 결과는 띠(8c-1 탭 모드를 "설명" 모드로 넓힘) + 대상 언어 음성 한 번. 부르면 낭독을 멈추고 설명을 들려준 뒤, 읽던 중이었으면 이어 읽는다(11-D15). 지시문은 10-1 규칙 1–6 **그대로**(DOC 밖 사실·치료 지시 금지) — 사전 수준 낱말 뜻을 DOC 밖에서 더할지는 운영자 결정(11-Q2). Build 약 2.5시간 + Review 1.5시간.

---

## (A) 새 소절

### 17-2-1. 11 Build 설계 — 11b 요약·저장 · 11c 글 트리·모아 보기 · 11a 설명 `[신설 2026-11-16 — 11 Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 11-D1–D22 · 물을 것 11-Q1–Q4 따로]`

**방침**: 17-2(설명 먼저·부를 때만)와 19-1-1 결정 E5(11b+11c 를 11a 앞으로)는 그대로다. 7-3·10-3·16-D5 의 보존 설계는 이 소절이 그 뒤 들어온 단계(8a 파이프라인·8d·8m·8p·8c+8f 선택 동작 줄·8f-1 `job` 주입·9b·10)에 맞춘 것으로 **대체**한다. 새 호출은 전부 **사용자가 부를 때만** 나간다 — 자동 요약은 만들지 않는다(11-Q1). 실기기에서만 답이 나오는 것은 끝의 "마지막 실기기 점검 묶음"으로 모은다.

#### 1. 지금 코드 사실 (파일:행 — 2026-11-16 작업 트리, 9b 배포 `4c57246` 뒤 · 8e Build 진행 중 · 8c+8f·18·9c·10 은 Plan 초안만)

| 항목 | 지금 | 근거 |
|---|---|---|
| 요약·설명 경로 | **없다.** `prompts.js` 끝에 "요약 프롬프트는 후순위 — `buildSummaryRequest` 가 여기에 온다" 주석만. `explain` 문자열은 음성 명령 표에만 | `js/ai/prompts.js:386-387` · `js/voice/commands.js:138-144` |
| 지시문 골격 | `commonSystem(withNotes, domain)` — 규칙 1–6, `domain==='general'` 이면 ROLE 한 줄만 바뀜. `escapeDoc`(구분자 탈출). `LANG_NAMES`·`langName` | `js/ai/prompts.js:104-140·52-71` |
| 판본 | `PROMPT_VERSION = 3`(번역 전용 — 값에만 기록, 키 아님) | `js/ai/prompts.js:29` |
| 파이프라인 | `translate()` 하나 — 요청·스키마·검증이 번역에 박혀 있다(`sendChunk` 가 `buildTranslateRequest`, `accept` 가 `TRANSLATE_SCHEMA`·`checkTranslation`, 캐시 결과를 `typeof result === 'string'` 으로 본다). 상태 기계·`gate`(오프라인·상한·키)·5xx 1회·429·cooldown·진행 중 공유(`inflight`)·실패 기억(`failedKeys`)은 이 함수 안에 있다. **8f-1 이 `sendChunk` 를 `job` 주입으로 일반화한다**(8cf 초안 4-3, 결정 8cf-D7) | `js/ai/pipeline.js:244-357·379-410·472-555` |
| 캐시 키 | `keyFor(docId, text, target, kind, extra)` → `kind|target|docId|hash(normalize(text))|extra`. `cacheKindOf` 는 `translate`·`readalong` 만 접고 나머지 `kind` 는 그대로(`summarize`·`explain` 그대로 쓸 수 있다). `normalizeForHash` 는 NFKC + 공백 접기 | `js/ai/cache.js:33-40` · `js/hash.js:107-128` |
| 사용량 종류 | `USAGE_KINDS = ['translate','summarize','quiz','grade','table','verify']`(빈 행 고정 — 7a 시험). `bumpUsage` 는 이 목록 + `READALONG_KIND` 만 `byKind` 에 센다(8f-1 이 `TERM_KIND` 를 더한다) | `js/config.js:631-643` · `js/ai/provider.js:262-266` |
| 기기 내 요약 | `ondevice.detect()` 가 `Summarizer` 존재만 본다 — 쓰는 곳 0 | `js/ai/ondevice.js:26-34` |
| `annotations` 스토어 | 있다: 키 `id`, 인덱스 `docId_pageNo`(`['docId','pageNo']` — **레코드 맨 위에 `docId`·`pageNo` 가 있어야 잡힌다**)·`docId`·`kind`. **쓰는 코드 0건.** `CASCADE_STORES` 에 있어 문서를 지우면 함께 지워진다. 다시 추출(`resetDerived`)은 건드리지 않는다 | `js/db.js:84-89·451-454·472-476` |
| DB 버전 | **3**. 이번 설계는 올리지 않는다 | `js/db.js:24` |
| 설정 키 | `tts.autoSummarize: false`·`ai.summaryLangs: ['ar','en']` — 둘 다 **읽는 코드 0건** | `js/settings.js:59·95` |
| 문단 id | `pageNo + ':p' + n`(쪽 안 순번) — `algoVersion` 이 올라 다시 추출하면 바뀔 수 있다. 문단 kind: `answer·question·option·heading·list·body`(+ 8i 행 표 `rowhead`) | `js/text/blocks.js:599-608·641` |
| 문장 목록 | `sentencesOf(units)` → `{seg, src, paraId, kind, frag}` — 표 안내·인용 단위는 빠진다(R3·R4). 분할은 `buildUnits` 한 벌(7-8-2 R6) | `js/tts/text.js:472-505` |
| 지금 문장 | `speaker.getCurrent()` = `units[index]`(줄 모드면 줄 단위). 8c-1 이 `speaker.sentenceUnits()`(문장 단위 사본)를 더한다 | `js/tts/speaker.js:1209` · 8cf 초안 4-1 |
| 띠 | 낭독 문장만 그린다(`bandView`·`noteKeyFor`). 넘치면 발화 경과 비율로 띠 안을 굴린다(`startRoll`). 8c-1 이 **탭 모드**(`openTap`·`closeTap`·[×]·[문단 전체])를 더한다 | `js/ui/trband.js:61-120·380-427` · 8cf 초안 4-1 |
| 선택 동작 줄 | **아직 없다.** 8c-1 이 `ui/selbar.js` 를 만든다(`[단어 번역]·[문장 번역]·[여기서부터 읽기]`, "넷째 자리는 11a [설명]"). 18 이 `[검색: 이름]` 을 더한다(조건부 — `{q}` 링크가 있을 때) — 18 초안: "11a Plan 이 좁으면 `[⋯]` 로 접기를 정한다" | 8cf 초안 4-2 · 18 초안 2 |
| 음성 명령 | `explain` 은 표에 자리만(`enabled:false`) → 흐름이 "아직 없는 기능" 안내 + 한 마디. 명령 실행은 speaker 공개 함수·주입 함수만 부른다. 실패 안내 한 마디 `say(key, was)` → 끝나면 `restore(was)`(읽던 중이었으면 [▶] 와 같은 함수) | `js/voice/commands.js:138-144` · `js/ui/voice.js:186-226·307-311` |
| 한 마디 음성 | `voice.js` `say` 는 **i18n 키**만 말한다(UI 언어). 대상 언어 글을 말하는 도우미는 없다 — 퀴즈 해설은 자기 speaker 를 따로 만든다 | `js/ui/voice.js:194-220` · `js/ui/quiz.js:851-880` |
| 9c 백업(초안) | `annotations` 를 "필기·11b 저장 요약"으로 **항상** 담고 가져오기는 `updatedAt` 새로운 쪽 | 18·9c·10 초안 17-4-1 2·5 |

#### 2. 7-3 · 10-3 · 16-D5 이후 바뀐 것 — 맞춘 결과

1. **언어는 값이다(7-1 원칙 5)** — 10-3 의 `langs: ['ar','en']`·`ai.summaryLangs` 는 언어를 박는다. 요약 언어 = **대상 언어(`ai.translationLang`) + 문서 원문 언어(`doc.lang`)**, 같으면 하나(11-D4). `ai.summaryLangs` 키는 읽지 않는다(지우지도 않는다 — 옛 기기 값 무해).
2. **계층 출력(19-1-1 N4)** — 10-3 의 평문 1–3문장 대신 요지 + 요점 2단을 한 호출로 받는다(11-D5). 11c 글 트리는 그 응답을 그리는 것 — 호출 추가 0.
3. **8a 파이프라인·8f-1 `job` 주입** — 요약·범위 개요·설명은 번역과 **같은 상태 기계 한 벌**을 탄다(11-D9). 기기 내 `Summarizer` 는 쓰지 않는다(11-D6).
4. **8p `domain`** — 요약·설명 지시문도 `domain` 을 받는다(`commonSystem(…, domain)` ROLE 한 줄 + 용어 문장). 키에는 넣지 않는다(7-5 · L-D9 (가)) — 캐시 **값**에 `domain` 기록(다듬기 2 와 같다).
5. **8m 단위 언어** — 요약 입력은 `sentencesOf` 의 `src` 를 문단별로 이은 글이다. 단위마다의 `lang` 은 지시문에 넣지 않는다(문단 요약은 문서 언어 기준 — 혼합 문단은 드물다 `[추정]`).
6. **8c-1 선택 동작 줄 · 띠 탭 모드** — [요약]·[설명] 은 그 줄에 붙는다. 단추가 5–6개가 되므로 `[⋯]` 를 둔다(11-D3). 설명 결과는 띠 탭 모드를 넓힌 **설명 모드**(11-D16).
7. **8d 문장 아래** — 설명 띠가 열린 동안은 8c-1 과 같은 `inlinetr.suspend(true)`. 요약은 시트라 무관.
8. **9b** — `explain` 을 켜고(9b-D14 의 "11a 결정 뒤 켬"), **`summarize` 명령 하나를 더한다**(11-D11). 손이 이긴다·`restore(was)` 규칙 그대로.
9. **9c** — 저장 요약(`annotations`)은 이미 백업 범위. 문서가 지워진 뒤 남은 요약도 가져오기에서 **문서 없이 넣는다**(단어장 `term` 과 같은 규칙 — 9c Build 에 한 줄, 아래 11).
10. **10 다른 무료 서비스 이어 쓰기** — 요약·설명은 번역과 같은 파이프라인이라 사슬도 같이 탄다. 새 서비스로 책 문단을 보내는 범위가 넓어지므로 운영자 결정(11-Q3).
11. **8c-2 사용량 화면** — `byKind.summarize`(이미 고정 키)·`byKind.explain`(새) 이름 한 줄씩. 상한·80% 경고에 들어간다.

#### 3. 대상 정하기 — 어느 문단·어느 문장인가 (순수 `text/summary.js`)

| 입구 | 요약 대상 문단 | 설명 대상 문장 |
|---|---|---|
| 선택 동작 줄 | 선택 시작 줄의 문장(`unitAt` — 8c-1)이 속한 문단 | 그 문장(`Unit`) |
| 음성 "요약"·"설명" | **`summaryTarget(units, i)`**: 지금 문장 `i` 가 그 문단의 **첫 문장**이고 앞 문장이 있으면 → **바로 앞 문단**(방금 다 읽은 문단), 아니면 지금 문단(11-D12) | 지금 문장(줄 모드면 `sentenceUnits()` 에서 지금 줄을 담은 문장) |
| 원본 보기 | 음성만(선택이 없다 — 8cf 4-2). 같은 규칙 | 같음 |

- **요약 가능한 문단**(`eligible(p)`): kind `body`·`list` · 문장 2개 이상 · 글자 60자 이상(`SUMMARY.MIN_CHARS`, `MIN_SENTENCES` — 7-3 그대로). 제목·문항·보기·정답·행 표 칸·표 안내·인용은 아니다. 아니면 [요약] 은 흐림(`aria-disabled`, 누르면 한 줄 `sum.notEligible`), 음성은 같은 한 줄 + 한 마디.
- **문단 글**(`paraTextsOf(sentences)`): `sentencesOf(units)` 를 `paraId` 로 묶어 `src` 를 공백 하나로 잇는다 → `{paraId, text, n(문장 수), chars, kind, frag}`. **한 문단 요약·쪽 요약·저장이 같은 함수**를 지난다 — 그래서 키가 같다. 쪽을 넘는 문단은 조각마다 따로(7-2 와 같은 태도 — 조각이 짧으면 요약 대상이 아니다).
- 설명은 표 안내·인용 단위면 하지 않는다(`readalong.translatable` 과 같은 거름에서 "같은 언어" 조건만 뺀 `explainable(u)`).

#### 4. 설계

##### 4-1. 요약 요청 (11-1 — `ai/prompts.js`)

`buildSummaryRequest(paras, {src, target, domain})` — `paras = [{text}]`(문단 글), 요청 항목은 `{i, text: escapeDoc(text)}`.

```
system: commonSystem(true, domain)                       # 규칙 1–6 글자 그대로(16-D2 와 같은 대조 시험)
user:   TASK + '\n' + SCHEMA 한 줄 + '\n<<<DOC\n' + JSON.stringify(items) + '\n>>>'

TASK(medical):
  For each paragraph i write, using ONLY what that paragraph says:
  - "gist": 1 to 3 short sentences in {Target} that summarize the paragraph.
  - "gistSrc": the same gist in simple {Src} (for a reader with B1-level {Src}).      ← src == target 이면 이 줄과 필드 없음
  - "points": up to 4 key points in {Target}, in the paragraph's own order; each point may have up to 3 short "sub" points.
  - "terms": up to 5 key terms as {"src": the term exactly as written in the paragraph, "tr": the standard {Target} medical term}.
  Write medical terms as the standard {Target} term with the original {Src} term in parentheses on first use{example}.
  Keep numbers, units and drug names exactly as written. Do not add causes, treatments, doses or advice that the paragraph does not state.
  Output exactly one item per input i.
TASK(general): 위와 같고 "medical term" 문장 대신 GENERAL_STYLE_LINE 과 같은 결("usual {Target} words").
{example}: 10-2 의 TERM_EXAMPLES[target] 그대로(표에 없으면 빈 문자열 — ar 을 박지 않는다).
```

- **스키마** `SUMMARY_SCHEMA`(gemini `responseSchema` — 재귀 없음, 깊이 고정):
  `{items:[{i:INTEGER, gist:STRING, gistSrc?:STRING, points:[{t:STRING, sub:[STRING]}], terms:[{src:STRING, tr:STRING}]}], notes:STRING}` — 필수 `items`·`i`·`gist`.
- **검증** `checkSummary(input, value)` — 항목마다(묶음 전체를 버리지 않는다):
  - `i` 짝이 맞고 `gist` 가 비지 않음. 없거나 비면 그 문단만 `failed(missing)`.
  - 상한으로 **자른다**(실패 아님): `gist`·`gistSrc` ≤ 600자, `points` ≤ 4, `sub` ≤ 3, 각 `t` ≤ 200자, `terms` ≤ 5(`src`·`tr` ≤ 80자).
  - **숫자 거름(11-D7)**: 출력 글의 숫자 토큰(`numberTokens` + `westernDigits` — 10-2 와 같은 함수)이 그 문단 입력에 없으면 — `gist` 면 그 항목 `failed(digits)`(캐시하지 않음), 요점·하위 요점·용어면 **그 줄만 뺀다**.
  - `gistSrc` 는 src ≠ target 일 때만 받는다(같으면 버림).
- `maxOutputTokens` = 문단 수 × `SUMMARY.OUT_TOKENS_PER_PARA`(700) + 200, `temperature 0.2`. 묶음 자르기는 8f-1 의 `job` 이 주는 예산 검사(`exceedsRequestBudget` — 입력 + 출력 ≤ `MAX_REQ_TOKENS` 8,000)와 `MAX_REQ_CHARS`(6,000)로 — CMDT 2026 한 쪽(약 4,500자)이면 **1–2호출** `[추정 — 11-1 Build 가 표본 10쪽으로 문단 수·실제 출력 토큰을 잰다]`.
- `SUMMARY_PROMPT_VERSION = 1`(새, 값에만). 번역 `PROMPT_VERSION` 3 무변.

##### 4-2. 파이프라인 · 캐시 · 사용량 (11-1)

- **`job` 셋**(8f-1 일반화 위 — 11-D9): `SUMMARY_JOB`(위 요청·스키마·검증, 결과 = 객체), `OUTLINE_JOB`(4-6), `EXPLAIN_JOB`(4-7, 11-4). 각 `job` 은 `{kind, build(items, ctx), schema, accept(items, value) → [{state, result|code}], isResult(rec.result), promptVersion}`. 캐시 읽기·진행 중 공유·실패 기억·`gate`·5xx 1회·429·cooldown·상한·`usage` 는 **번역과 같은 코드**를 지난다. 8f-1 이 `translateTerms` 를 사본으로 만들었다면 11-1 의 첫 일은 그것을 `runJob(job, items, opts)` 하나로 접는 것(번역 요청 바이트 불변 + 기존 시험 무변이 증거).
- 공개: `pipeline.summarize(paras, {src, target, docId, domain, force, retry})` → `{status, calls, results[]}`(입력 순서, 던지지 않음). `force` = [다시 요약] — 캐시 읽기를 건너뛰고 덮어쓴다(7-5 "다시 생성").
- **같은 언어도 요약한다** — `translate()` 의 `same-lang` 건너뛰기를 쓰지 않는다(요약은 번역이 아니다). 언어 이름이 없으면(`langName` null) `unsupported-lang`.
- **키**: `keyFor(docId, 문단 글, target, 'summarize', 'l=' + langs.join('+'))` — 예 `summarize|ar|<doc>|s256:…|l=ar+en`. 한 문단 요약과 쪽 요약이 같은 키(같은 `paraTextsOf`) → [이 쪽 전체 요약] 뒤 개별 문단은 0회(16-D5 그대로). `domain`·판본은 키에 없다.
- **캐시 값**: `{kind:'summarize', result:{gist, gistSrc?, points, terms}, langs, src, target, domain, provider, model, promptVersion, repaired}`.
- **사용량**: `byKind.summarize`(이미 고정 키 — 7a 빈 행 시험 무변), 상한·80% 경고에 들어간다. 기기 내 경로 없음. `charsTranslated` 는 세지 않는다(낭독 번역만 — 15절).
- **보내는 것**: 교과서 문단 글뿐(지금 번역과 같은 범주·같은 프로바이더). 저장 요약의 메모·제목은 보내지 않는다.

##### 4-3. 요약 시트와 글 트리 (11-2 — `ui/sumsheet.js`·`ui/tree.js`)

- **시트**(`role="dialog"`, `aria-modal="false"`): 8f-2 단어 시트와 **같은 자리·높이 식**(`max-block-size: max(48×3, 100dvh − --banners-h − --bar-top − --reader-chrome-bottom − 32)`, 안 스크롤, [닫기] sticky). 8e compact 에서도 같은 식. 시트가 열린 동안 선택 동작 줄은 숨는다. 낭독은 멈추지 않는다(음성으로 부른 때만 4-5 흐름).
- 내용(위 → 아래):
  1. 머리: "문단 요약 · {쪽 라벨}"(8g `pageLabels` 가 있으면 인쇄 쪽) + [×].
  2. 상태 한 줄: 요약 중… / 실패 + [다시 시도](`retry:true`) / 막힘(8c-1 과 같은 `noteKeyFor` 문구) / 요약 대상 아님.
  3. **요지**(대상 언어 — `dir`·`lang` 은 `translationBlockAttrs` 로, 라틴 괄호는 `appendBidiText`) · **원문 언어 요지**(작은 글자, `dir=ltr`, `lang=src`).
  4. **글 트리**(11c): `ui/tree.js` `renderTree(points, {dir, lang})` — 하위 요점이 있는 요점은 `<details open><summary>요점</summary><ul><li>…</li></ul></details>`, 없으면 `<li>`. **JS 없이 접기**(11-D17), 키보드·화면 읽기 기본 동작. [모두 접기]/[모두 펼치기] 한 단추. 깊이 3까지 그린다(범위 개요가 3단).
  5. 용어: "원어 — 대상 말" 줄(`dir` 각각).
  6. 고지 한 줄 `sum.disclaimer` "AI 요약 — 교육용입니다. 원문을 확인하세요."(11-D18).
  7. 단추(48px 이상, 논리 순서): `[저장]`(저장되어 있으면 `[저장됨 ✓]` — 누르면 "저장을 지울까요?" 페이지 안 확인) · `[▶ 듣기]`(요지를 대상 언어 음성으로 — 4-5 의 sayer. 낭독 중이면 멈추고 말한 뒤 이어 읽는다 — 설명과 같은 규칙 11-D15) · `[이 쪽 전체 요약 (문단 n · 호출 k)]` · `[다시 요약]`(호출 1 — 누르면 먼저 묻는다) · 링크 "이 책의 저장한 요약 (n)"(11-3 부터 보임, `#/summaries/:docId`).
- **[이 쪽 전체 요약]**: 지금 쪽의 요약 가능한 문단 전부(`eligible`) → 캐시에 없는 것만 `summarize` 한 번(k = 같은 자르기 함수로 미리 센 호출 수 — 보통 1–2). 결과 화면 = 문단 순서대로 요지 + 접힌 트리 + 문단마다 [저장] + 위에 `[모두 저장 (n)]`. 문단 요지를 누르면 본문의 그 문단으로 굴린다(`revealLine(첫 줄)`).
- 모든 글자 `textContent`/`appendBidiText`, `innerHTML` 0(13절 — Review grep).

##### 4-4. 저장 (11-1 서비스 `notes/summaries.js` · 11-2 단추)

- **9-2 `annotations` `kind` 에 값 둘**: `'summary'`(문단 요약 한 개) · `'outline'`(11c 범위 개요 한 개). 필드 추가뿐 — DB 3 그대로, `kind` 인덱스는 이미 있다.
- `summary` 레코드: `{id, kind:'summary', docId, pageNo, docTitle(사본), anchor:{pageNo, lineIds, paraId, textHash}, target, src, langs, gist, gistSrc, points, terms, domain, cacheKey, provider, model, promptVersion, createdAt, updatedAt}`. `textHash` = 캐시 키와 같은 문단 글 해시(`hashHex(normalizeForHash(text))`). 원문 문단 글은 **저장하지 않는다**(크기·사본 — 원문 쪽으로 가면 본다).
- `outline` 레코드: `{id, kind:'outline', docId, pageNo(범위 첫 쪽), docTitle, range:{from, to, label}, target, title, points(3단), sources:[summaryId…], cacheKey, …, createdAt, updatedAt}`.
- 서비스 **`js/notes/summaries.js`**(약 200줄 — import: `config`·`db`·`hash`·`text/summary`. `ui/`·`ai/` 금지, 화면이 파이프라인 결과를 넘긴다): `save(rec)`(같은 `docId`+`textHash`+`target` 이 있으면 **대체** — `updatedAt` 만 새로, 11-D10) · `findFor(docId, textHash, target)` · `list({docId?, kind})`(`kind` 인덱스 → `docId` 거름, 쪽·문단 순 정렬) · `count(docId)` · `remove(id)` · `saveOutline(rec)` · `relocate(rec, paras)`(순수 쪽 — 지금 쪽 문단들의 `textHash` 로 문단을 다시 찾는다: 같은 해시 → 그 문단, 없으면 `null` = "문단 위치가 바뀜, 쪽 처음으로").
- **문서를 지워도 남는다(11-D8)**: `db.deleteDocument` 의 `annotations` 쓸기에서 `kind === 'summary' || kind === 'outline'` 은 건너뛴다(약 4줄 — 8f-1 의 `cards` `term` 예외와 같은 꼴). 서재 삭제 확인에 "저장한 요약 n개는 남습니다"(n > 0 일 때만 — 8f-2 의 단어장 줄과 같은 자리). 다시 추출은 `annotations` 를 건드리지 않는다(지금 그대로).

##### 4-5. 음성으로 부르기와 소리 (11-2 · 11-4)

- 새 명령 **`summarize`**(`voice/commands.js` 표 — 11-D11): ar `لخص · لخّص · ملخص · تلخيص · لخص الفقرة` · en `summarize · summary · sum up`. `[검토 — Nour·운영자]`. 9b 표 무결성 시험(의도된 공유 0 — C3)을 지난다.
- **`explain` 켜기**(11-4): `enabled:true`. 칸은 9b 그대로(`اشرح · شرح · فسر · وضح · اشرح هنا` · `explain · explain this`).
- `ui/voice.js` `exec` 에 두 갈래 — **주입 함수만** 부른다(`deps.onSummarize(was)`·`deps.onExplain(was)`; voice.js 는 파이프라인을 모른다 — 지금 import 방향 그대로). 확인 줄은 지금처럼 `confirm(id, heard)`.
- **흐름**(새 `ui/ask.js` — controls 가 speaker·pipeline·readalong·sheet·band 를 주입):
  ```
  askSummary({via:'voice'|'button', was}):
    target ← (button) 선택 문장의 문단 | (voice) summaryTarget(sentenceUnits(), 지금 문장)
    if !eligible → 상태 한 줄 + (voice) 한 마디 → restore(was); return
    gate ← aiGate({allowSameLang:true})          # 8c-1 tapGate 와 같은 순서: consent → unsupported-lang → no-key
    sheet.open(target, pending) ; r ← pipeline.summarize([target]…)
    sheet.show(r)
    if via == 'voice' && r ready: sayer.say(trSpeechText(r.gist), target) → 끝나면 restore(was)   # 11-D13
    if via == 'voice' && !ready: 막힘·실패 한 마디(sayErrors) → restore(was)
  askExplain({via, was}): 4-7
  ```
- **sayer**(`tts/say.js` 새, 약 90줄 — 서비스, `synth`·`makeUtterance`·`speechOf(lang)` 주입): `say(text, lang) → Promise<'end'|'stopped'>` · `stop()` · `busy()`. 글이 길면 `splitLong` 으로 300자 조각을 이어 말하고 조각마다 `trWatchdogMs` 감시(6-2 와 같은 이유 — onend 를 잃으면 멈춤). 목소리는 8k `langSpeechOf(target)`(번역문 음성과 같은 해석 — 휴대폰 설정 따름). 괄호 속 라틴(원어)은 `trSpeechText` 로 소리에서만 뺀다(번역문 낭독과 같다). **손이 이긴다**: [▶]·이전·다음·9a 단추·줄 탭·마이크 → `sayer.stop()`(되돌림 없음) — voice.js `cancel()` 과 같은 자리에서 부른다.
- 음성 흐름 동안 "요약 중…/설명 준비 중…" 상태 줄은 9b 상태 줄(`status`) 하나를 쓴다.

##### 4-6. 저장한 요약 모아 보기 · 범위 개요(11c) · 내보내기 (11-3 — `ui/summaries.js`)

- 라우트 `#/summaries`(전체)·`#/summaries/:docId`(그 책) — `router.js` `summaries` + `summariesHash(docId)`, `main.js` switch 에 `showSummaries`/`leaveSummaries` 한 줄씩, `index.html` 섹션 하나. **입구**(11-D14): 서재 카드 [⋯] "저장한 요약" · 요약 시트 링크 "이 책의 저장한 요약 (n)". 서재 상단 줄(8f-3 이 [단어장]을 더한다)과 리더 상단바는 늘리지 않는다. 전체 목록(`#/summaries`)은 책별 화면 위 "전체 보기" 로 간다.
- 목록: 책 고르기(전체/책별) · 쪽 순서 묶음(장 머리 = `documents.outline` 깊이 0 항목, 없으면 쪽 라벨) · 줄(48px 이상): 쪽 라벨 · 요지(대상 언어) · 펼치면 원문 언어 요지·트리·용어 · `[원문으로]`(그 쪽 열기 → `relocate` → 문단 첫 줄 `revealLine`, 못 찾으면 쪽 처음 + 한 줄) · `[삭제]`(페이지 안 확인 — `confirm()` 쓰지 않음). 문서가 지워진 요약은 `docTitle` 로 묶고 `[원문으로]` 숨김.
- **범위 개요(11c, 11-D19)**: 책 화면 위 "범위: [장 ▾ | 쪽 a–b]" → "저장한 요약 n개 · `[개요 만들기 (호출 1)]`". 입력 = 그 범위의 **저장한 요약**(요지 + 요점, 대상 언어 — 원문을 다시 보내지 않는다). `buildOutlineRequest(summaries, {target, domain, label})`:
  - TASK: "The DOC contains paragraph summaries from {label} of one book, in reading order. Merge them into ONE outline in {Target}: a short title, up to 8 top points, each with up to 4 sub points, each sub with up to 3 sub points. Use ONLY what the summaries say. Keep numbers and terms as written." 시스템 = 규칙 1–6 그대로.
  - 스키마 `OUTLINE_SCHEMA` `{title:STRING, points:[{t, sub:[{t, sub:[STRING]}]}], notes}`(깊이 3 고정). 검증: `title`·`points` 비지 않음, 상한 자름, **숫자 거름**(입력 = 요약들 글).
  - 입력이 `MAX_REQ_CHARS` 를 넘으면 요점을 빼고 요지만 → 그래도 넘으면 **보내지 않고** "범위를 줄이세요(요약 n개 · 약 m자)" — 한 번 누름 = 최대 1호출.
  - 키 `keyFor(docId, 입력 글(요약 id 순 + 요지·요점), target, 'summarize', 'outline')` → 같은 범위·같은 요약이면 0회. 사용량 `byKind.summarize`.
  - 결과는 트리(같은 `tree.js`, 3단)로 보이고 `[저장]` → `annotations` `kind:'outline'`(같은 범위·대상 언어면 대체). 저장한 개요는 그 범위 머리에 먼저 보인다. 16 그림 개념도가 나중에 이것을 입력으로 받는다(17 #21).
- **내보내기**(호출 0): `[텍스트로 내보내기]` → 순수 `exportText(list, labels)` — UTF-8 BOM, CRLF, 책 제목 → 쪽 라벨 → 요지 / 원문 언어 요지 / 요점(들여쓰기 2칸) / 용어, 저장한 개요는 범위 머리에. 파일 이름 `medreader-summaries-YYYYMMDD.txt`(`Blob` + `<a download>` + `revokeObjectURL` — 8f-3 와 같은 장치). 화면에 고지 한 줄 "교과서 내용의 요약이 들어 있습니다 — 공유에 주의하세요"(13절 "단어장 내보내기" 와 같은 결).

##### 4-7. 설명 (11-4 — 11a)

- **요청** `buildExplainRequest({sentence, context}, {src, target, domain})`:
  - 입력: 대상 문장(`Unit.src`) + 맥락 = 그 문단 글(`paraTextsOf`) — 문장을 가운데 두고 앞뒤로 잘라 **최대 1,500자**(`EXPLAIN.CONTEXT_CHARS`, 11-D15). 항목 `{sentence, context}` 모두 `escapeDoc`.
  - TASK(medical): "Explain the SENTENCE to a medical trainee who reads {Src} as a second language. Write in {Target}, at most 3 short sentences: say plainly what the sentence states, break long structure into simple statements, and say what its abbreviations and terms mean **as used in the CONTEXT**. Write terms as the standard {Target} term with the original {Src} term in parentheses. Use ONLY information in the SENTENCE and CONTEXT — do not add facts, causes, numbers, treatments or advice. If the sentence cannot be understood without information that is not in the CONTEXT, say so in one short sentence." general: 같은 결, 의학 문장 대신 GENERAL_STYLE_LINE 결.
  - 시스템 = `commonSystem(true, domain)` — **규칙 1–6 글자 그대로**(규칙 4 "DOC 밖 의학 사실 금지" 를 그대로 둔다 — 사전 수준 낱말 뜻을 DOC 밖에서 더하는 것은 11-Q2).
  - 스키마 `EXPLAIN_SCHEMA` `{t:STRING, terms:[{src, tr}], notes:STRING}` — 필수 `t`. 검증 `checkExplain`: `t` 비지 않음 · **숫자 거름**(입력 = 문장 + 맥락; 어긋난 숫자가 든 **문장만** 빼고, 남은 게 없으면 `failed(digits)`) · 문장 경계에서 `EXPLAIN.MAX_CHARS`(400)까지 자름(실패 아님) · `terms` ≤ 3.
  - `maxOutputTokens` 600, `temperature 0.2`, `EXPLAIN_PROMPT_VERSION = 1`.
- **키** `keyFor(docId, Unit.src, target, 'explain', 'ctx=' + 문단 해시 앞 12자)`(11-D20) — 같은 문장·같은 문단이면 0회. 사용량 **`byKind.explain`**: `AI.EXPLAIN_KIND = 'explain'` 을 `READALONG_KIND` 처럼 `USAGE_KINDS` 밖에 두고 `bumpUsage` 가 받게(+2줄 — 7a 빈 행 시험 무변). 상한·80% 경고에 들어간다.
- **같은 언어도 설명한다**(원문 = 대상이어도 쉬운 말 풀이는 뜻이 있다).
- **띠 설명 모드**(`trband.js` — 8c-1 탭 모드를 넓힘, +약 80줄): `openNote({kind:'explain', lineId, state, text, retry})`. 머리에 작은 꼬리표 "설명"(`tr-kind`)으로 번역과 구별. 상태 pending "설명 준비 중…" · ready(글 — `appendBidiText`) · failed + [다시 시도] · blocked 짧은 줄(`noteKeyFor` 그대로). 단추: [×] · [▶ 다시 듣기]. 열린 동안 8c-1 처럼 `data-tr-band="on"`·`inlinetr.suspend(true)`. 말하는 동안 발화 경과 비율로 띠 안을 굴린다(기존 `startRoll` — 장치 하나). 닫기 = [×] · 다른 줄 탭 · 쪽 넘김 · 리더 떠남 · 낭독 재개 뒤 다음 `linechange`(8c-1 규칙).
- **흐름(11-D15)**:
  ```
  askExplain({via, was}):
    u ← (button) 선택 문장 | (voice) 지금 문장
    if !explainable(u) → 한 줄(+voice 한 마디) → restore(was); return
    if 읽는 중: speaker.pause()                        # 버튼으로 불러도 멈춘다 — 설명을 소리로 듣게
    band.openNote(pending) ; r ← pipeline.explain(u, ctx)   # 캐시 적중이면 즉시
    ready  → band.show(r.t) ; sayer.say(trSpeechText(r.t), target) → 끝나면 restore(was)
    아니면 → band 실패/막힘 한 줄 ; (voice 이고 sayErrors) 한 마디 → restore(was)
  ```
  `was` 는 버튼이면 누른 순간의 상태, 음성이면 9b 흐름의 `was`. 듣는 중 손이 닿으면 `sayer.stop()` — 되돌림 없음(9b 규칙).
- 선택 동작 줄 `[설명]` 은 **보이는 셋째 칸**(11-D3). `[문장 번역]` 과 같은 선택 스냅숏을 쓴다.

#### 5. 고치는 파일 · import 방향

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **11-1** 요약 서비스·저장 | `js/text/summary.js`(순수 약 220 — `paraTextsOf`·`eligible`·`summaryTarget`·`explainable`·`trimTree`·`pruneForeignNumbers`·`outlineInput`·`exportText`·`relocate`) · `js/notes/summaries.js`(약 200) · `tests/summary-11b.test.mjs` · `tests/summary-store-11b.test.mjs` | `js/ai/prompts.js`(요약·개요 요청·스키마·검증 +170) · `js/ai/pipeline.js`(`SUMMARY_JOB`·`OUTLINE_JOB`·`summarize()`·`outline()` +60 — 8f-1 `job` 위) · `js/config.js`(`SUMMARY`·`OUTLINE` 상수 +15) · `js/db.js`(연쇄 삭제 예외 +4) |
| **11-2** 요약 시트·트리·음성 | `js/ui/sumsheet.js`(약 330) · `js/ui/tree.js`(약 90) · `js/ui/ask.js`(약 160 — 요약 갈래) · `js/tts/say.js`(약 90) · `tests/sumsheet-11b.test.mjs` · `tests/say-11.test.mjs` | `js/ui/selbar.js`(`[⋯]` 넘침 메뉴 + `[요약]`, 18 의 `[검색: …]` 을 `[⋯]` 로 +50) · `js/voice/commands.js`(`summarize` 줄) · `js/ui/voice.js`(`exec` 두 갈래·`cancel` 에서 `sayer.stop` +20) · `js/ui/controls.js`(ask·sayer·sheet 배선 +25) · `js/ui/library.js`(삭제 확인 한 줄) · `index.html`(시트·`[⋯]` 메뉴) · `css/reader.css` · i18n 4개(약 24키) |
| **11-3** 모아 보기·범위 개요·내보내기 | `js/ui/summaries.js`(약 420) · `tests/summaries-ui-11c.test.mjs` | `js/router.js` · `js/main.js`(+4) · `js/ui/library.js`(카드 [⋯] 한 줄) · `js/ui/sumsheet.js`(링크 켜기) · `index.html`(섹션) · `css/screens.css` · i18n 4개(약 26키) |
| **11-4** 설명 | `tests/explain-11a.test.mjs` | `js/ai/prompts.js`(설명 +80) · `js/ai/pipeline.js`(`EXPLAIN_JOB`·`explain()` +25) · `js/ai/provider.js`(`EXPLAIN_KIND` 받기 +2) · `js/config.js`(`AI.EXPLAIN_KIND`·`EXPLAIN` 상수) · `js/ui/trband.js`(설명 모드 +80) · `js/ui/selbar.js`([설명] +10) · `js/ui/ask.js`(설명 갈래 +60) · `js/voice/commands.js`(`explain` 켬) · `js/ui/voice.js`(갈래 +5) · `js/ui/usage.js`(종류 이름 한 줄 — 8c-2 파일) · `index.html`(띠 꼬리표·[▶]) · `css/reader.css` · i18n 4개(약 12키 + `voice.notYet` 은 남김) |

- **import 방향**(3-2 에 한 줄 더함): **`notes/*` 행은 `vocab/*`·`search/*` 행과 같다** — `config`·`text/*`·`db`·`hash` 만(`ui/`·`ai/`·`pdf/`·`tts/` 금지). `text/summary.js` 는 순수(16-A grep 대상 — `document`·`window` 금지). `tts/say.js` 는 서비스(`synth` 주입 — `window` 를 직접 읽지 않는다, speaker.js 와 같다). `ui/ask.js` 는 ui 계층(서비스 import 가능, `voice.js` 는 ask 를 import 하지 않고 주입받는다). `ai/*` 는 계속 `ui/` 를 모른다.
- 새 `js/*.js` 마다 `dev/stamp-importmap.mjs` → `--check` 0(배포 안전장치). DB 버전·`algoVersion`·`SEARCH.VERSION`·`OUTLINE_V`·번역 `PROMPT_VERSION`·`TERM_PROMPT_VERSION` 전부 무변. 새 판본 상수 셋(`SUMMARY_`·`OUTLINE_`·`EXPLAIN_PROMPT_VERSION` = 1).

#### 6. 호출 — 언제 몇 번 (17절 머리 2: 호출 1회 ≈ 낭독 번역 약 5,900자)

| 동작 | 호출 | 캐시 키 | 사용량 |
|---|---|---|---|
| [요약] · 음성 "요약" — 캐시 적중 | 0 | `summarize` | `cacheHits +1` |
| 같은 — 미적중 | **문단 1개 = 1** | `summarize` | `byKind.summarize` |
| [이 쪽 전체 요약] | 미적중 문단만 묶어 **1–2**(누르기 전에 수를 보인다) — 이후 그 쪽 문단 [요약] 은 0 | 같은 키 | 같음 |
| [다시 요약] | 1(먼저 묻는다) | 덮어씀 | 같음 |
| [저장] · [저장됨 ✓] 지우기 · 모아 보기 · 트리 접기 · [▶ 듣기] · 내보내기 · [원문으로] | 0 | — | — |
| [개요 만들기] (11c 범위) | **1**(입력 = 저장한 요약, 넘치면 보내지 않음) — 같은 범위·같은 요약이면 0 | `summarize`+`outline` | `byKind.summarize` |
| [설명] · 음성 "설명" — 미적중 / 적중 | 1 / 0 | `explain` | `byKind.explain` / `cacheHits` |
| 낭독·쪽 넘김·자동 무엇이든 | **0** — 자동 요약·자동 설명 없음 | — | — |

비용 감각: 하루 요약 10번 + 설명 10번 ≈ 20회 ≈ 낭독 번역 약 11.8만 자분(CMDT 2026 약 26쪽). [이 쪽 전체 요약]은 문단을 하나씩 부를 때보다 쪽당 호출이 1/5–1/10 `[추정]`.

#### 7. i18n (4언어 같은 키 — i18n 시험이 짝을 본다)

11-2 `sum.*` 약 20(제목·요약 중·실패·대상 아님·막힘은 `noteKeyFor` 재사용·저장·저장됨·저장 지우기 확인·듣기·이 쪽 전체 요약(문단 n · 호출 k)·모두 저장·다시 요약 확인·모두 접기/펼치기·용어·원문 언어 요지·고지·책의 저장한 요약 링크) + `sel.more`·`sel.summary` + `voice.cmd.summarize` + 서재 `library.card.deleteConfirmSummaries`. 11-3 `summaries.*` 약 26(제목·전체/책별·장/쪽 범위·개요 만들기(호출 1)·범위가 큼·개요 저장·원문으로·위치 바뀜·삭제 확인·내보내기·내보내기 고지·빈 목록·문서 없음 묶음). 11-4 `explain.*` 약 10(꼬리표·준비 중·실패·대상 아님·다시 듣기·고지) + `sel.explain` + `usage.kind.explain`. ar·fr 새 문구는 `[검토 — Nour·운영자]`. 음성 명령 낱말도 `[검토 — Nour·운영자]`.

#### 8. 수용 기준 (16절 형식 — 16-D5 를 대체)

**11-1 요약 서비스·저장**
- [ ] `[N]` `buildSummaryRequest`: system 이 `commonSystem(true, domain)` 과 글자 단위 같다(규칙 1–6) · 대상 `ko` 로 바꾸면 지시문에 아랍어 예시·`Arabic` 0(16-D2 와 같은 꼴) · src = target 이면 `gistSrc` 줄·필드 없음 · `domain:'general'` 이면 ROLE·용어 줄만 다름 · DOC 안 `<<<`·`>>>` 탈출.
- [ ] `[N]` `checkSummary`: 항목 3개 중 `i` 하나 빠짐 → 그 문단만 failed, 나머지 ready · `gist` 빈 값 → failed · 요점 6개·하위 5개·긴 `t` → 4·3·200자로 자름 · 입력에 없는 숫자("500 mg")가 든 요점 → 그 요점만 빠짐 · 같은 것이 `gist` 에 → 그 문단 failed · 아랍-인도 숫자 `٥٠٠` 은 `500` 으로 비교.
- [ ] `[N]` `paraTextsOf`·`eligible`: 인용·표 안내 빠짐 · 문장 1개·59자·제목·문항·보기 → 대상 아님 · 한 문단 요약과 쪽 요약이 같은 글 → **같은 키** · 문장 분할은 `buildUnits` 한 벌(`grep splitSentences` 두 파일 그대로).
- [ ] `[N]` `summaryTarget`: 문단 첫 문장(앞 문장 있음) → 앞 문단 · 문단 가운데 → 지금 문단 · 쪽 첫 문장(앞 문장 없음) → 지금 문단 · 표 안내 위 → 가장 가까운 앞 본문 문단.
- [ ] `[N]` `pipeline.summarize`(가짜 provider): 문단 3개 → 1호출 · 다시 → 0호출(`cacheHits`) · 그중 1개 → 0호출 · 429 → `exhausted`·자동 재시도 0·`blocked` · 5xx → 1회 즉시 뒤 cooldown · `capped`·`no-key` → 보내지 않음 · `force` → 1호출·덮어씀 · `byKind.summarize` 증가·상한에 포함 · 같은 언어 → 보냄(skip 아님). **`translate()` 요청 본문이 이 Build 전과 바이트 단위 같다**(기존 pipeline·prompts 시험 무변).
- [ ] `[N]` 출력 예산: 문단 12개(각 400자) → 자르기가 `exceedsRequestBudget` 안으로 2묶음 · 미리 센 호출 수 k 가 실제 호출 수와 같다.
- [ ] `[N]` (fake-idb) `notes/summaries`: 같은 문단·같은 대상 두 번 저장 → 한 레코드(`updatedAt` 만 새로) · 대상 언어가 다르면 둘 · `list({docId, kind})` 쪽·문단 순 · `deleteDocument` 뒤 `summary`·`outline` 남고 다른 `annotations`(가짜 `highlight`)는 지워짐 · `relocate`: 같은 해시 → 그 문단, 없으면 null · 레코드가 `docId_pageNo` 인덱스로 잡힌다.
- [ ] `[N]` 요청 본문에 저장 요약의 메모·문서 제목이 없다.
- 변이: `checkSummary` 숫자 거름 지우기 · 키의 `l=` 빼기(대상·원문 언어를 바꿔도 같은 키) · 연쇄 삭제 예외 지우기 · `summarize` 가 same-lang 에서 skip · `save` 대체 대신 추가.

**11-2 요약 시트·글 트리·음성**
- [ ] `[D]` 흉내 Gemini: 본문 문단 길게 눌러 선택 → `[⋯]` → `[요약]` → 시트에 요지(ar `dir=rtl`)·원문 언어 요지(`dir=ltr`)·트리·용어·고지, 요청 **1건**. 닫고 같은 문단 다시 → **0건**.
- [ ] `[D]` 트리: 하위 요점 있는 요점은 `details` 로 접히고 펼쳐진다(키보드 Enter·Space) · [모두 접기]/[모두 펼치기] · `innerHTML` 새 사용 0(grep).
- [ ] `[D]` [저장] → `annotations` 1건 `kind:'summary'`·`docId`·`pageNo`·`anchor.textHash` · [저장됨 ✓] 누르면 페이지 안 확인 → 지움. 저장해도 요청 0.
- [ ] `[D]` [이 쪽 전체 요약 (문단 n · 호출 k)] → 가로챈 요청 수 = k · 결과 n문단 · [모두 저장] → n건 · 그 뒤 아무 문단 [요약] → 0건.
- [ ] `[D]` 짧은 문단·제목 선택 → [요약] 흐림·누르면 한 줄, 요청 0. 키 없음 → 시트에 한 줄 + 배너 [키 설정] 즉시(8c-1 과 같음), 요청 0. 429·`capped`·`offline` → 막힘 한 줄, 자동 재시도 0. 잘린 JSON → 실패 + [다시 시도], 캐시 0.
- [ ] `[D]` 음성(가짜 인식기, 9b-2 하네스) «لخص» — 낭독 중·문단 둘째 문장에서 → 지금 문단 요약, 시트 열림, 요지를 대상 언어 음성으로(흉내 음성의 utterance `lang`) 말한 뒤 **읽기 재개**. 문단 첫 문장에서 → 앞 문단. 멈춤 상태에서 → 말한 뒤 멈춘 채. 말하는 중 [▶] → 말하기 멈춤·되돌림 없음.
- [ ] `[D]` 낭독 중 선택 → [요약] → 낭독 끊김 0(시트만 열림).
- [ ] `[D]` 시트·`[⋯]` 메뉴: 360×740·412×915·915×412(8e compact) × 4언어 — 시트 위끝 ≥ 0, [닫기] 보임, 가로 넘침 0, 단추 48px 이상. 선택 동작 줄 보이는 칸이 넘치지 않는다(18 의 `[검색: …]` 링크를 넣은 상태 포함 — `[⋯]` 안).
- [ ] `[D]` 서재 삭제 확인에 "저장한 요약 n개는 남습니다"(n>0), 지운 뒤 `annotations` 에 남는다.
- 변이: `summaryTarget` 의 앞 문단 규칙 지우기 · 시트 [▶ 듣기]가 `trSpeechText` 를 안 거치게(괄호 원어 소리 시험 빨강) · `[⋯]` 를 빼고 단추를 다 한 줄에(412 ar 넘침 시험 빨강) · 음성 경로에서 `restore(was)` 빼기.

**11-3 모아 보기·범위 개요·내보내기**
- [ ] `[D]` `#/summaries/:docId`: 쪽 순서·장 머리(개요 깊이 0) · 펼침 · [원문으로] → 그 쪽·그 문단 첫 줄이 편안 영역 안 · 문단 위치가 바뀐 레코드(해시 불일치 심어 둠) → 쪽 처음 + 한 줄 · 문서를 지운 요약은 `docTitle` 묶음·[원문으로] 없음.
- [ ] `[D]` 범위 개요: 장 하나 고름 → "저장한 요약 n개 · 개요 만들기 (호출 1)" → 요청 **1건**, 본문에 원문 문단 글 0(요약 글만), 결과 3단 트리 · [저장] → `kind:'outline'` 1건 · 같은 범위 다시 → 0건 · 입력이 너무 큰 범위(합성 요약 60개) → 요지만으로 1건, 그래도 크면 **0건** + "범위를 줄이세요".
- [ ] `[N]` `exportText`: BOM·CRLF·들여쓰기·RTL 글 그대로·키 문자열 0(가짜 키를 저장소에 둔 상태). `[D]` 내보내기 → `createObjectURL` 가로채 Blob 읽기 — 파일 이름·줄 수.
- [ ] `[D]` 360×740·915×412 × 4언어: 가로 스크롤 0, 줄 48px 이상, 아랍어 UI 에서 원문 언어 요지 `dir=ltr`.
- 변이: 범위 개요가 입력 초과에서도 보냄 · `outlineInput` 이 원문 문단 글을 넣음 · 내보내기가 `aiCache` 를 읽음.

**11-4 설명**
- [ ] `[N]` `buildExplainRequest`: 규칙 1–6 글자 그대로 · 맥락 1,500자 자름(문장이 가운데) · 대상 `ko` 면 아랍어 예시 0 · `domain` · 탈출.
- [ ] `[N]` `checkExplain`: 4문장·500자 → 3문장·400자 이하로 문장 경계 자름 · 입력에 없는 숫자가 든 문장만 빠짐 · 다 빠지면 failed · `t` 빈 값 failed.
- [ ] `[N]` 키: 같은 문장 + 같은 문단 → 0호출 · 같은 문장 + 다른 문단 → 다른 키 · `byKind.explain` 증가(빈 행 키 6개 시험 무변)·상한 포함.
- [ ] `[D]` 멈춘 상태 선택 → [설명] → 띠 "설명" 꼬리표 + 준비 중 → 글 · 대상 언어 음성 1회 · 끝나도 멈춘 채 · 요청 1 · 다시 → 0.
- [ ] `[D]` 낭독 중 [설명] → 낭독 멈춤 → 설명 말함 → **그 문장부터 이어 읽기** · 다음 `linechange` 에서 띠가 낭독 문장으로(유효 모드 off 면 닫힘).
- [ ] `[D]` 음성 «اشرح» → "아직 없는 기능" 이 아니라 설명 흐름(9b 시험의 `notYet` 기대를 고친다) · 실패(429) → 띠 막힘 줄 + 한 마디 → 되돌림.
- [ ] `[D]` inline(문장 아래) 표시에서 설명 띠 → `data-tr-inline` 떨어짐·닫으면 붙음·`.ra-tr` 수 불변.
- [ ] `[D]` 인용·표 안내 단위 → 설명 안 함·한 줄. 원본 보기에서 음성 "설명" → 같은 띠.
- [ ] `[D]` 선택 동작 줄: [단어 번역][문장 번역][설명][⋯] 360×740·915×412 × 4언어 넘침 0.
- 변이: 설명 흐름에서 `speaker.pause()` 빼기(낭독과 설명 음성이 겹치는 시험 빨강) · 키의 `ctx=` 빼기 · 숫자 거름 지우기 · `explain` `enabled:false` 로 되돌림.

**모든 Build 공통**: `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과 · `dev/stamp-importmap.mjs --check` 0 · `grep -rn "splitSentences" js/` 두 파일 · `innerHTML` 새 사용 0 · 콘솔 오류 0 · 무료 티어 숫자 0(16-J) · 지시문 안전 규칙 1–6 대조 시험 통과 · 진짜 API 키 0.

#### 9. headless 시험 방법

- 8d·8cf·9b-2 하네스와 같은 꼴: Edge, 새 프로필·새 포트, `try { … } finally { await browser.close() }`, 결과는 stdout(JSON), 실행마다 시간 상한 10분. 정적 서버는 띄워 둔 8000번을 쓴다(끄지 않는다).
- **흉내 Gemini**: `generativelanguage.googleapis.com` 가로채기 — `OPTIONS` 204 + `access-control-allow-origin: *`·`access-control-allow-headers: *`. `POST` 는 본문 `generationConfig.responseSchema` 의 속성 이름으로 갈래를 고른다(`segments` 번역 · `items`+`gist` 요약 · `title`+`points` 개요 · `t` 설명) → 짝이 맞는 JSON(아랍어 요지 + 괄호 원어, 요점 2단, 숫자는 입력에서만). 429·500·잘린 JSON·`i` 어긋남·지어낸 숫자는 시험별 스위치. 가짜 키(형식만). 요청 수·본문은 가로채기에서 센다.
- 선택 모사는 `setBaseAndExtent`(8cf 9), 음성은 9b-2 가짜 인식기(`result` 이벤트), 소리는 흉내 `speechSynthesis`(utterance `lang`·글·`onend` 기록).
- 실물 PDF 문장·요약 글은 결과 JSON 에 넣지 않는다(8d 규칙). 11-1 의 출력 토큰 측정은 합성 문단 + CMDT 2026 표본 쪽의 **문단 수·글자 수만** 기록(글 없음).

#### 10. 결정 표 — 권장 (운영자 위임: 권장안으로 진행)

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 11-D1 | 나누기 | (가) **네 Build: 11-1 서비스·저장 · 11-2 시트·트리·음성 "요약" · 11-3 모아 보기·범위 개요·내보내기 · 11-4 설명** · (나) 둘: 11b+11c · 11a · (다) 셋: 11b · 11c · 11a | **(가)** — 각 2.5–3시간(지침 "2–3시간 이내"). (나)는 11b+11c 가 7시간이 되고 Review 가 화면 셋을 한 번에 본다. (다)는 트리가 시트에 이미 필요해 11b·11c 경계가 파일과 어긋난다 |
| 11-D2 | 순서 | (가) **11-1 → 11-2 → 11-3 → 11-4, 10 뒤** · (나) 11-4 를 11-2 뒤로 당김 | **(가)** — E5(요약·저장이 Nour 의 직접 요청) 그대로. 11-4 는 11-2 가 만든 `ask.js`·`say.js`·`[⋯]` 위에 얹혀 작아진다. 8c+8f·18·9c·10 과 같은 파일(`pipeline.js`·`prompts.js`·`selbar.js`·`controls.js`·`provider.js`·i18n)이라 동시에 Build 하지 않는다 |
| 11-D3 | 선택 동작 줄이 넘칠 때 | (가) **보이는 칸 고정: [단어 번역][문장 번역][설명] + [⋯](요약·여기서부터 읽기·검색 바로가기)** · (나) 폭을 재서 넘치는 것만 [⋯] · (다) 한 줄 가로 스크롤 | **(가)** — 장치 하나, 언어별 폭 측정에 기대지 않는다(10b 결함 교훈). 번역·설명은 문장마다, 요약은 문단마다라 덜 잦다. [여기서부터 읽기]는 낭독 중 줄 탭과 같은 일이라 두 번 눌러도 된다. 11-2 가 `[⋯]` 를 만들고(요약·여기서부터·검색), 11-4 가 셋째 칸에 [설명] |
| 11-D4 | 요약 언어 | (가) **대상 언어 + 문서 원문 언어(같으면 하나), `ai.summaryLangs` 읽지 않음** · (나) `ai.summaryLangs`(['ar','en']) · (다) 대상 언어만 | **(가)** — 7-1 원칙 5(언어는 값). 원문 언어 요지는 영어 공부(Nour B1)에 쓸모 있고 호출 수는 같다(출력 토큰만 약간). (나)는 아랍어·영어를 박는다 |
| 11-D5 | 출력 꼴 | (가) **요지 + 원문 언어 요지 + 요점 2단 + 용어, 한 호출** · (나) 10-3 평문(1–3문장) + 트리는 따로 부름 | **(가)** — 19-1-1 N4 "호출 추가 0". gemini 스키마는 재귀가 없어 깊이를 고정한다(문단 2단, 범위 개요 3단) |
| 11-D6 | 기기 내 `Summarizer` | (가) **쓰지 않음** · (나) 7-3 대로(영어 기기 요약 → 기기 번역) | **(가)** — Android Chrome 에 없다 `[가정]`, 영어 출력만, 트리를 못 만든다, 경로가 두 벌이 된다. 지금 번역의 기기 내 경로와 무관 |
| 11-D7 | 숫자 거름 | (가) **출력 숫자 ⊆ 입력 숫자 — 어긋난 요점·문장만 빼고, 요지(설명은 전부)가 어긋나면 실패** · (나) 검사 없음 | **(가)** — 10-2 숫자 검사와 같은 값싼 경계(함수 재사용). 지어낸 용량·수치를 거른다. 안전 쪽으로만 바꾸는 것이라 13·18절 변경이 아니다 |
| 11-D8 | 문서를 지울 때 저장 요약 | (가) **남김 — `summary`·`outline` 연쇄 삭제 예외, `docTitle` 사본, 삭제 확인에 한 줄** · (나) 함께 지움(지금 연쇄) | **(가)** — 단어장과 같은 까닭(PDF 를 지워 공간을 비워도 공부 기록은 남아야 한다). 요약은 작다. 필기·하이라이트(20단계)는 PDF 와 함께 지워지는 지금 규칙 그대로 |
| 11-D9 | 파이프라인 길 | (가) **8f-1 `job` 주입 위에 SUMMARY·OUTLINE·EXPLAIN job — 상태 기계 한 벌** · (나) 요약용 사본 | **(가)** — 8cf-D7 과 같은 이유(429·cooldown·상한·사용량이 두 벌이면 한쪽만 고쳐진다). 번역 요청 바이트 불변이 증거 |
| 11-D10 | 같은 문단 다시 저장 | (가) **대체 — 문단(해시)·대상 언어 하나에 하나** · (나) 판을 쌓음 | **(가)** — 목록이 쌓이지 않는다. [다시 요약] 뒤 [저장]이면 새 것으로 |
| 11-D11 | 음성 "요약" 명령 | (가) **`summarize` 명령 하나 더함(ar·en)** · (나) 음성 없이 단추만 | **(가)** — N3 "문단을 읽은 뒤 요약"과 핸즈프리(요구 1). 로컬 매칭 그대로(AI 의도 해석 없음), 보내는 것 늘지 않음 |
| 11-D12 | 음성 "요약" 대상 | (가) **지금 문장이 문단 첫 문장이면 바로 앞 문단, 아니면 지금 문단** · (나) 늘 지금 문단 | **(가)** — 문단을 다 듣고 말하면 낭독은 이미 다음 문단 첫 문장에 있다. 확인 줄에 "앞 문단 요약" 을 보여 헷갈림을 줄인다 |
| 11-D13 | 음성으로 부른 요약의 결과 | (가) **시트 + 요지를 대상 언어로 한 번 말하고, 읽던 중이었으면 이어 읽기(시트는 열린 채)** · (나) 시트만(소리 없음) | **(가)** — 9b 의 `restore(was)` 와 같은 규칙. 화면을 안 보는 사용(핸즈프리) |
| 11-D14 | 저장·입구 | (가) **[저장]을 누를 때만 · 모아 보기 입구는 서재 카드 [⋯] + 시트 링크** · (나) 부른 요약을 자동 저장 · (다) 서재 상단에 [요약] 칸 | **(가)** — 목록이 원하지 않은 요약으로 차지 않는다. 다시 부르면 캐시 0회라 나중에 저장해도 된다. 서재 상단은 8f-3 [단어장]으로 이미 빠듯 |
| 11-D15 | 설명 흐름·맥락·길이 | (가) **부르면 낭독 멈춤 → 띠 "준비 중" → 글 + 소리 → 읽던 중이었으면 이어 읽기 · 맥락 = 문장 + 그 문단(최대 1,500자) · 결과 ≤ 3문장·400자(약 20–30초)** · (나) 기다리는 동안 계속 읽고 도착하면 끊고 설명 · (다) 소리 없이 띠만 | **(가)** — 17-2 "띠 + 소리 내어 읽기"의 소리는 낭독과 함께 낼 수 없다. 캐시 적중이면 멈춤이 순간이다. (나)는 엉뚱한 문장 중간에 끊기고 재개 위치가 어긋난다. 17-2 의 "낭독은 설명을 기다리지 않는다" 는 **설명이 실패·지연돼도 낭독이 막히지 않는다**로 읽는다 — 실패하면 곧 되돌린다 |
| 11-D16 | 설명 결과 자리 | (가) **띠(8c-1 탭 모드를 "설명" 모드로 넓힘)** · (나) 요약 시트 | **(가)** — 17-2 결정 그대로. 짧은 글(≤ 400자)이고 띠 안 굴림이 이미 있다 |
| 11-D17 | 트리 그리기 | (가) **`<details>/<summary>` 중첩 — JS 없이 접기** · (나) 직접 만든 `role="tree"` | **(가)** — 키보드·화면 읽기 기본 동작, 코드 작음. RTL 에서 펼침 표시가 저절로 거울 |
| 11-D18 | 결과 고지 | (가) **시트·띠·모아 보기·내보내기에 "AI 요약/설명 — 교육용, 원문 확인" 한 줄** · (나) 없음(12-7 고정 고지만) | **(가)** — 안전 쪽으로만 더함. 13절 의료 안전 고지와 같은 결 |
| 11-D19 | 범위 개요(11c) 입력 | (가) **저장한 요약에서만, 장·쪽 범위, 1회 — 넘치면 요지만, 그래도 넘치면 보내지 않음** · (나) 범위의 원문을 다시 요약(여러 호출) | **(가)** — 19-1-1 표 그대로("입력 = 저장한 요약 — 짧다"). 한 번 누름 = 최대 1호출 |
| 11-D20 | 설명 캐시 키 | (가) **문장 + `ctx=` 문단 해시 앞 12자** · (나) 문장만(번역과 같은 꼴) | **(가)** — 설명은 맥락에 따라 달라진다("See Table 1" 같은 반복 문장). 값싸다 |
| 11-D21 | 문항·보기 문단의 [해설 요약](7-3) | (가) **이번엔 넣지 않음 — 15 복습 묶음 Plan 에서** · (나) 11-2 에 | **(가)** — 퀴즈 화면(`ui/quiz.js` 1,063줄)이 따로 있고 15 가 같은 자료를 묶는다 |
| 11-D22 | 7-3 "문단 끝 [요약 보기] 칩" | (가) **만들지 않음 — 선택 동작 줄 [요약] + 음성 "요약"** · (나) 7-3 그대로 칩 | **(가)** — 칩은 본문 DOM 에 끼어 지금 문장 위치(6-5 자동 스크롤·8d 편안 영역)를 흔든다. 호출은 어느 쪽이든 누를 때만이라 비용은 같다 |

**운영자에게 물을 것** (무료 한도·비용·외부 전송·의료 안전 — 권장하지 않음)

| # | 무엇 | 지금 설계(승인 범위) | 바꾸면 |
|---|---|---|---|
| 11-Q1 | 자동 요약(`tts.autoSummarize`, 16-D5 "켜면 경고") | **만들지 않는다** — 키는 `false` 그대로, 화면 없음. 요약은 부를 때만(17-2 라 비권장) | 켜면 낭독이 문단을 끝낼 때마다 호출 1회 — 본문 쪽 하나에 약 8–14회 `[추정]`, 한도를 낭독 번역보다 빨리 쓴다 |
| 11-Q2 | 설명이 DOC 밖 **사전 수준 낱말 뜻**을 더해도 되나(규칙 4 예외) | **아니다** — 규칙 1–6 그대로, "맥락 안에서의 뜻"만, 모르면 "맥락에 없다"고 말한다 | "임상 사실·수치·치료는 여전히 금지, 낱말의 일반 사전 뜻만 허용" 한 줄을 설명 지시문에 — 설명이 더 쓸모 있어지지만 DOC 밖 내용이 들어오는 첫 경로다(13·18절 경계) |
| 11-Q3 | 10 의 다른 무료 서비스 사슬을 요약·설명도 타나 | 10 을 넣으면 **같은 파이프라인이라 저절로 탄다**(설계상) | 요약·설명만 Gemini 로 묶어 두는 선택 — 새 서비스로 가는 책 문단의 양이 준다(외부 전송). 10-Q1 결정 때 함께 |
| 11-Q4 | 저장 요약 내보내기 파일 | `.txt` 에 요약·용어만(원문 문단 없음) + 공유 주의 한 줄 | 내보내기를 빼거나, 원문 문단까지 넣는 선택(교과서 글이 파일로 나간다) |

#### 11. 다른 단계에 넘길 것

- **8c-1**(선택 동작 줄): "단추 4개까지 한 줄"을 "보이는 칸 3 + `[⋯]`" 로 바꿀 수 있게 만들어 두면 11-2 가 작아진다(마크업 순서·`hidden` 만). 8c-1 Plan 확정본에 한 줄.
- **8f-1**(`job` 주입): `runJob(job, items, opts)` 한 함수로 일반화하고 `job.isResult(rec.result)`(결과가 문자열이 아닐 수 있다)를 받게 — 11-1 이 사본을 접지 않아도 되게.
- **18**: `[검색: 이름]` 은 11-2 에서 `[⋯]` 로 옮겨진다(18 초안 2 "11a Plan 이 정한다"의 답).
- **9c**: 가져오기에서 `annotations` `kind:'summary'|'outline'` 은 **문서가 없어도 넣는다**(`term` 과 같은 규칙) — 9c 수용 기준 한 줄.
- **8c-2**: 사용량 화면 종류별에 `summarize`·`explain` 이름(`|| 0`) — 8c-2 가 `byKind` 를 열거하면 11-4 는 이름 키 하나만.
- **15**(복습 묶음): 입력 = 저장한 요약(`notes/summaries.list`) + 저장한 개요. [해설 요약](11-D21)은 15 Plan.
- **16**(그림 개념도): 입력 = 저장한 개요(`kind:'outline'`, 3단 트리) — 출력이 작다.

#### 12. 크기 · 시간 `[추정]`

| Build | 크기 | Build | Review | 위험 |
|---|---|---|---|---|
| 11-1 요약 서비스·저장 | 중간 | 2.5h | 1.5h | 중간 — 8f-1 `job` 위 얹기(번역 바이트 불변으로 지킴), 출력 토큰 예산 실측 |
| 11-2 시트·트리·음성 "요약" | 중간~큼 | 3h | 1.5h | 중간 — `[⋯]` 로 선택 줄 재배치, 음성 흐름(되돌림·손이 이긴다), sayer |
| 11-3 모아 보기·범위 개요·내보내기 | 중간 | 2.5–3h | 1.5h | 낮음~중간 — 화면 하나 + 호출 하나 |
| 11-4 설명 | 중간 | 2.5h | 1.5h | 중간 — 낭독 멈춤·재개와 띠 모드 셋(낭독·탭·설명) |
| **합** | | **10.5–11h** | **6h** | |

옛 추정(인계 10-21 표: 11b+11c 3시간 · 11a 2시간)은 시트·모아 보기·음성 두 갈래·띠 설명 모드·`[⋯]` 를 작게 셌다. 자리: **10 뒤**(19-1 순서 … 8c+8f → 18 → 9c → 10 → **11-1 → 11-2 → 11-3 → 11-4** → 12 …).

#### 13. 마지막 실기기 점검 묶음 (11 몫 — 앱 완성 뒤 한 번에)

- [ ] `[M]` 실제 Gemini(Nour 키·VPN 켬): 요약 응답이 스키마대로 오는가(아랍어 요지·요점 2단·용어), [이 쪽 전체 요약]이 잘리지 않는가(`truncated` 복구가 몇 번 — 출력 예산), 숫자 거름이 정상 요약을 버리는 일이 잦은가.
- [ ] `[M]` 설명 품질 10문장(Nour 판단): "맥락 안의 뜻"만으로 쓸모 있는가 — 11-Q2 판단 근거.
- [ ] `[M]` Nour GT 7: 음성 «لخص»·«اشرح» 가 시리아 말씨로 잡히는가, 다른 명령과 헷갈리지 않는가(«اشرح» ↔ «اقرأ»).
- [ ] `[M]` 대상 언어 음성으로 요지·설명 말하기 — Realme 의 아랍어 목소리(목록 없음 → 태그만, 8k), 괄호 원어가 소리에서 빠지는가, 400자 설명이 중간에 끊기지 않는가(조각 이어 말하기).
- [ ] `[M]` 이어폰·잠금 화면(9a)에서 설명을 듣는 중 재생 단추 → 설명이 멈추고 낭독 단추로 동작하는가(손이 이긴다).
- [ ] `[M]` 선택 동작 줄 `[⋯]` 메뉴가 시스템 선택 메뉴(복사·공유)와 겹치지 않는가 — 세로·가로(8e compact).
- [ ] `[M]` 요약 시트의 트리 접기·펼치기를 손가락으로(아랍어 RTL), 시트 높이가 가로에서 화면 안.
- [ ] `[M]` 요약 내보내기 `.txt` 를 Android 파일·메모 앱에서 열 때 아랍어·한국어 정상.
- [ ] `[M]` PDF 를 지운 뒤 저장한 요약이 남고, 9c 백업 → 새 기기 가져오기 뒤에도 보이는가.

#### 14. 이번엔 못 함

- 자동 요약(11-Q1) · 문항 [해설 요약](11-D21) · 문단 끝 칩(11-D22) · 저장 요약 고쳐 쓰기·메모(20 필기 때) · 요약 용어를 단어장에 바로 넣기(문맥 문장이 없다 — 8f 단어장은 문장 문맥이 필수) · 쪽을 넘는 문단 이어 붙여 요약 · 본문에 "저장된 문단" 표시(`reader.js` 를 건드리지 않는다) · 그림 개념도(16).
- 실측: 이번 Plan 은 앱을 돌려 재지 않았다(앱 무변). 출력 토큰·쪽당 문단 수는 11-1 Build 가 표본으로 잰다.

---

## (C) 3-2 import 방향 표에 붙일 한 줄

`[수정 2026-11-16 — 11 Plan]` **`notes/*`**(저장 요약·개요 — 나중 필기도) 행은 `vocab/*`·`search/*` 행과 같다: `config`·`text/*`·`db`·`hash` 만 import 한다(`ui/`·`ai/`·`pdf/`·`tts/` 금지). `tts/say.js` 는 `tts/*` 행 그대로(`synth` 주입).

## (D) 9-2 `annotations` 행 `kind` 칸

`kind('highlight'|'note'|'summary'|'outline')` — `[수정 2026-11-16 — 11 Plan]` `summary`·`outline` 은 17-2-1 4-4(레코드 맨 위 `docId`·`pageNo`, 문서 삭제 연쇄에서 빠짐). 필드 추가라 DB 버전 3 그대로.
