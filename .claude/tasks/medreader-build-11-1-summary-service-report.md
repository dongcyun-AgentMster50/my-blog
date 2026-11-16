# Build 보고서 — 11-1 요약 서비스 · 저장 (화면 없음)

> 지침: `.claude/tasks/medreader-build-11-1-summary-service.md` · 설계: spec **17-2-1**(11-1 몫) · crossstep-notes "11" 줄. 직전 배포 9c-3 `b6a344a`.
> 커밋하지 않았다. 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b11-1\`.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/summary.js` **새**(308줄, 순수 — import `config` 만) | `paraTextsOf`·`eligible`·`summaryTarget`·`explainable`·`trimTree`·`hasForeignNumber`·`pruneForeignNumbers`·`compareAnchor`·`outlineInput`(→ `{items, text, plain, ids}`)·`relocate`·`exportText`(BOM·CRLF, 문구는 `labels`) |
| `js/notes/summaries.js` **새**(250줄, 서비스 — `db`·`hash`·`text/summary` 만) | `createSummaryStore({db, now})` → `save`(같은 `docId`+`textHash`+`target` 이면 대체 — 한 트랜잭션)·`saveOutline`(같은 범위·대상이면 대체)·`findFor`·`list({docId, kind})`·`count(docId, kind?)`·`remove(id)`(요약·개요만)·`relocate` · `textHashOf`·`withHashes`·`summaryStore()` |
| `js/ai/prompts.js` | `summaryInstruction`·`buildSummaryRequest`·`SUMMARY_SCHEMA`·`SUMMARY_SCHEMA_SAME`·`checkSummary` · `outlineInstruction`·`buildOutlineRequest`·`OUTLINE_SCHEMA`·`checkOutline`·`outlinePayload` · `SUMMARY_PROMPT_VERSION`·`OUTLINE_PROMPT_VERSION`. 번역·단어 지시문·스키마 한 글자도 안 바꿈 |
| `js/ai/pipeline.js` | `SUMMARY_JOB`·`OUTLINE_JOB`(8f-1 job 꼴 그대로)·`summarize()`·`planSummary()`·`outline()` · `STATUS.TOO_BIG`·`SUMMARY_KIND` · **`runJob` 넷째 인자 기본 `{}`**(crossstep 8f1R) |
| `js/config.js` | `SUMMARY`·`OUTLINE` 상수(추가만) — `PROMPT_VERSION` 둘 다 1 |
| `js/db.js` | `keepsOnDocDelete(rec, store)` — 스토어 인자 더함(빼면 `cards`), **`annotations` 는 스토어 전체 남김**, 연쇄 삭제가 이 한 곳으로 판정 |
| `index.html` | stamp(판 번호 구간만 — 4줄 바뀜 + 새 모듈 2줄) |
| `tests/summary-11b.test.mjs` **새**(34) · `tests/summary-store-11b.test.mjs` **새**(7) | 아래 표 |
| `spec.md` | `[정정 2026-11-17 — 11-1 Build]` 7곳(3-2 한 줄 · 4-1 실측 · 4-2 job·공개 함수 · 4-2 캐시 값·지시문 결정 · 4-4 연쇄 · 8 수용 기준 뒤집기 · 10 11-D8 칸) |

화면 파일(`ui/*`)·`selbar.js`·`voice/*`·`review.md`·`dev/`·`ai/cache.js`·`ai/provider.js`·i18n 무변. 추적 안 된 `dev/measure-table-8i4.mjs` 손대지 않음. DB 3·`algoVersion` 12·`SEARCH.VERSION` 1·`OUTLINE_V` 1·번역 `PROMPT_VERSION` 3·`TERM_PROMPT_VERSION` 1 무변(S12 시험).

## 2. 수용 기준 "11-1" + 공통

| 기준 | 결과 | 근거 |
|---|---|---|
| `buildSummaryRequest`: system = `commonSystem(true, domain)` 글자 그대로(규칙 1–6) · ko 대상에 아랍어 예시·`Arabic` 0 · src = target 이면 `gistSrc` 줄·필드 없음 · general 은 ROLE·용어 줄만 다름 · `<<<`·`>>>` 탈출 | ○ | R1–R4 |
| `checkSummary`: `i` 하나 빠짐 → 그 문단만 · 빈 `gist` → failed · 요점 6·하위 5·긴 `t` → 4·3·200 · "500 mg" 요점만 빠짐 · `gist` 면 문단 failed · `٥٠٠` = `500` | ○ | C1–C6 |
| `paraTextsOf`·`eligible`: 인용·표 안내 빠짐 · 1문장·59자·제목·문항·보기 대상 아님 · 한 문단 = 쪽 요약 같은 키 · 분할은 `buildUnits` 한 벌 | ○ | T1·T2·T5(splitSentences 파일 목록 = HEAD 와 같은 3개 — `text/cite.js`(주석)·`text/segment.js`·`tts/text.js`) |
| `summaryTarget`: 첫 문장 → 앞 문단 · 가운데 → 지금 · 쪽 첫 문장 → 지금 · 표 안내 위 → 가까운 앞 문단 | ○ | T3(300자 조각·인용도) |
| `pipeline.summarize`: 3문단 1호출 · 다시 0(`cacheHits`) · 그중 1개 0 · 429 → exhausted·재시도 0·blocked · 5xx → 즉시 1회 뒤 cooldown · capped·no-key·offline 보내지 않음 · force 1호출·덮어씀 · `byKind.summarize`·상한 포함 · 같은 언어 보냄 · **번역 요청 바이트 불변** | ○ | S1–S9·S11 + 아래 3절 |
| 출력 예산: 12문단(각 400자) → `exceedsRequestBudget` 안 2묶음 · 미리 센 k = 실제 호출 | ○ | S10(9 + 3, 하나 더 담으면 넘음) |
| (fake-idb) 같은 문단·대상 두 번 → 한 레코드 · 대상 다르면 둘 · `list` 쪽·문단 순 · 삭제 뒤 `summary`·`outline` 남음 · `relocate` · `docId_pageNo` 인덱스 | ○ | N1–N5·D1 |
| ↳ "다른 `annotations`(가짜 `highlight`)는 지워짐" | **뒤집음** `[정정]` | D1: 20-D11 방향으로 **남는다**(counts.annotations 0) · term 캐시는 지움(RM5) |
| 요청 본문에 저장 요약의 메모·문서 제목 없음 | ○ | R5 · headless(`secretInBody:false`) |
| 9c: `summary`·`outline` 레코드가 문서 없이 들어간다 | ○(고칠 것 없음) | B1: 문서 없는 상태에서 내보내기 → 빈 기기 가져오기 → 레코드 그대로·문서 0·두 번째 가져오기 멱등 |
| 공통: 전체 시험 · stamp `--check` 0 · splitSentences · `innerHTML` 새 사용 0 · 콘솔 오류 0 · 무료 티어 숫자 0 · 규칙 1–6 대조 · 진짜 키 0 | ○ | 5절 · 새 파일에 `innerHTML` 0(화면 없음) · 가짜 키만 |

## 3. 번역 요청 바이트 불변 — 근거 셋

1. **node 대조**(`b11-1/rdiff.mjs`): HEAD 판(`git archive HEAD` → `b11-1/head/`)과 작업 트리를 같은 흉내 fetch·메모리 DB·시계로 — 번역(탭·낭독·frag·src 항목·general·70문장 여러 청크·캐시·same-lang·모르는 언어) · 단어(1개·25개 = 20 + MORE·src·빈 낱말·force) · 오류(5xx→cooldown→retry·429·no-key·상한 6) · 동시 공유. **요청 본문·URL·헤더·사용량 행·캐시 레코드·결과·상태 이벤트·타이머·base 전부 같음**(`allSame:true`, POST 17/17). 첫 본문 sha `acbbed54070c…` = `term-8f` B1 의 HEAD `2570a94` 값. 작업 트리에서만 **요약을 먼저 부른 뒤**(같은 파이프라인) 번역·단어 → 번역·단어 본문 HEAD 와 같음.
2. **기존 시험 무변**: `term-8f` B1(sha256 4건)·`pipeline-8a*`·`prompts-8a`·`domain-8p`·`mixlang-8m` 등 그대로 통과(1,768 중 기존 1,727 손대지 않음).
3. **headless**: 아래 4절 — 탭·단어·낭독 동반 번역 본문 sha·길이가 HEAD 출처와 같음.

## 4. headless 한 번 (`b11-1/run-h.mjs` → `h1.json`, 49초)

Edge 412×915 · 새 프로필 `b11-1/p1` · pipe · 가짜 키 · 흉내 Gemini(OPTIONS 204 + CORS, POST 는 `responseSchema` 속성으로 갈래) · 캐시 끔 · **서버 없음**(9c-3 하네스처럼 가로채 내줌: `127.0.0.1:8000` = 작업 트리, `127.0.0.2:8000` = HEAD `git show` — 출처가 달라 IndexedDB 따로).

- 같은 흐름(합성 PDF `b9c2/syn.pdf` 읽기만, 3쪽): 낱말 선택 → [문장 번역] → 다른 낱말 → [단어 번역] → [AI 로 번역] → [▶] 7초. **단계별 본문 HEAD = 작업 트리**: 탭 1(2,624B `d7e08bab…`) · 단어 1(2,543B `fdbdf49b…`) · 낭독 1(6,196B `33e4d546…`). `bodiesSame:true`.
- 요약 경로(작업 트리, 모듈 import): `planSummary` 1 → `summarize` **요청 1**(summary 갈래) → 다시 **0**(전부 cached) → `planSummary` 0 · `langs ['ar','en']` · `byKind.summarize` 1 · 항목에 끼운 책 제목 본문에 0 · **실제 IndexedDB** 저장 1 → 같은 문단 다시 저장 = 대체(같은 id) → `db.deleteDocument` 뒤 저장 요약 남음(`counts.annotations` 0) · 원문 글 저장 0.
- 콘솔 오류 0 · 페이지 오류 0 · 외부 요청 0(pdf.js CDN 만) · 없는 파일 0.

## 5. 시험·점검

- 전체 `node --test --test-timeout=60000 "apps/medreader/tests/*.test.mjs"` **2회: 1,768/1,768 통과 · 1,768/1,768 통과**(`full1.txt`·`full2.txt`).
- `dev/stamp-importmap.mjs` 다시 찍음 → `--check` "그대로다(모듈 81 · CSS 4)" · `git diff --check` 0 · 새 파일 4개 `--no-index --check` 0.
- `grep -rln splitSentences js/` = HEAD 판과 같은 3파일.

## 6. 출력 토큰 예산 — 실측(문단 수·글자 수만, 글 없음)

**CMDT 2026**(1,967쪽) 표본 10쪽(6–87% 고르게, 앱과 같은 길: 레이아웃 → `toStored/fromStored` → `describePage` → `flowParasOf` → `buildUnits` → `sentencesOf` → `paraTextsOf` → `eligible` → `planSummary`):

| 쪽 | 문단 | 요약 가능 | 그 글자 | 문단 최대 | 호출 k | 입력 토큰(한 묶음으로 볼 때) |
|---|---|---|---|---|---|---|
| 118 | 20 | 11 | 4,749 | 1,103 | 2 | 1,739 |
| 295 | 19 | 7 | 2,623 | 1,011 | 1 | 1,189 |
| 472 | 18 | 7 | 5,034 | 1,144 | 1 | 1,792 |
| 649 | 24 | 7 | 4,290 | 1,072 | 1 | 1,606 |
| 826 | 24 | 7 | 3,070 | 1,219 | 1 | 1,301 |
| 1003 | 13 | 3 | 553 | 351 | 1 | 654 |
| 1180 | 27 | 11 | 4,123 | 670 | 2 | 1,583 |
| 1357 | 36 | 9 | 1,970 | 455 | 1 | 1,035 |
| 1534 | 27 | 8 | 3,140 | 983 | 1 | 1,323 |
| 1711 | 32 | 7 | 2,444 | 820 | 1 | 1,145 |

→ 쪽당 요약 가능 문단 평균 **7.7**(전체 문단의 약 1/3 — 한 문장짜리 목록·제목이 많다), [이 쪽 전체 요약] **쪽당 1.2호출** — 설계 "1–2호출" 맞음. 합성 12문단(각 400자) = 2묶음(9 + 3).

**출력 토큰**(실제 모델 없이 잴 수 없다 — 앱의 근사 `estimateTokens`, 아랍어 2자/토큰, 합성 응답 `b11-1/outtok.mjs`): 문단 하나 보통(요지 250·원문 요지 200·요점 3×(100 + 2×60)·용어 4) **≈ 741**, 많음(요지 400·원문 요지 300·요점 4×(150 + 3×100)·용어 5) **≈ 1,524**, 상한 꽉 **≈ 2,737** — 설계값 **700/문단을 넘는다**. 7문단 "많음" ≈ 10,602 대 상한 5,100. 값은 설계대로 700 에 두었다(아래 남은 문제 1).

## 7. 변이 (전부 빨강 → 복원: `bak/` 사본을 읽어 쓰기 + `cmp` 0)

| # | 변이 | 빨강 | 복원 cmp |
|---|---|---|---|
| M1 | `checkSummary` 숫자 거름 지우기(요지·요점·용어) | C3·C4·S9 | 같음 |
| M2 | 키의 `l=` 빼기 | S2·S3 | 같음 |
| M3 | 연쇄 삭제 예외(`annotations`) 지우기 | D1 | 같음 |
| M4 | `summarize` 가 same-lang 에서 skip | S4 | 같음 |
| M5 | `save` 대체 대신 추가 | N1·N4 | 같음 |
| M6(더) | `runJob` 넷째 인자 기본값 빼기 | S11 | 같음 |
| M7(더) | 범위 개요가 입력 초과에서도 보냄 | O2 | 같음 |

## 8. spec 정정 (`[정정 2026-11-17 — 11-1 Build]`, 그 자리만 Edit)

1. **3-2**: 실제 import — `notes/summaries` → `db`·`hash`·`text/summary`, `ai/prompts`(순수) → `text/summary`(순수, 표 첫 행), `ai/pipeline` 은 `text/*` 직접 import 없음(`prompts.outlinePayload`).
2. **4-1**: CMDT 표본 10쪽 실측 + 출력 토큰 근사가 700 을 넘는다는 것 + 넘칠 때의 동작 + 13 점검에서 `usage.tokensOut` 으로 확인.
3. **4-2 job**: 8f-1 이 이미 `runJob(job, items, keys, opts)` 한 벌 — 실제 job 꼴(`check`·`accepts`·`toResult`…) · `planSummary` 추가 · `outline` 의 `too-big`·`input` · 판본 값 위치.
4. **4-2 캐시 값**: `cache.js` 가 `langs`·`src` 를 담지 않음(범위 밖) — 키 `l=`·결과 `langs`·저장 레코드로. 지시문 결정 다섯(대상 언어 문체 문장 · 같은 언어 "Keep medical terms as written." · `gistSrc` 숫자 → 그 필드만 · 거름 먼저 자르기 나중 · 요청/검증 스키마).
5. **4-4**: `annotations` 스토어 전체(20-D11) · `keepsOnDocDelete(rec, store)` 한 곳 · `fileHash` 사본 · `count`·`remove`·`withHashes`·`exportText(labels)`.
6. **8 수용 기준**: "가짜 highlight 지워짐" → 남는다로 뒤집어 시험.
7. **10 11-D8 칸**: "필기는 지금 규칙 그대로" → 20-D11 이 바꿨다(남는다).

## 9. 남은 문제 · 넘길 것

1. **출력 토큰 700/문단이 모자랄 수 있다**(6절 근사 741–1,524). 넘치면 Gemini `MAX_TOKENS` → `jsonrepair` 가 온전한 항목까지 → 뒤 문단 `MISSING`(실패 기억, [다시 시도]로만). 선택지: (가) 지금(700) 두고 13 실기기 첫 줄에서 `usage.tokensOut`/호출로 확인 — **기록한 방향** (나) 1,200 으로 — 묶음 약 5문단, CMDT 쪽당 약 2호출 `[추정]` (다) 지시문에서 요점·하위 길이를 낱말 수로 묶기. 근사(아랍어 2자/토큰)가 실제 Gemini 보다 비관적일 수 있다 `[추정]`. → **오케스트레이터/Review 판단**(비용 모양이 바뀌는 값이라 Build 가 정하지 않음).
2. 캐시 값에 `langs`·`src` 없음(cache.js 범위 밖) — 진단만의 손실.
3. 요약 TASK 에 대상 언어 문체 한 문장(`TARGET_STYLE` — ar 이면 MSA·표준 의학 용어)을 더했다 — 설계 틀에는 없던 줄(10-2 번역과 같은 표, 16-D2 그대로). Review 확인 바람.
4. `summaryTarget` 의 "표 안내 위 → 가장 가까운 앞 문단"은 앞 **문장**의 문단(요약 가능 여부는 보지 않음 — 11-2 가 `eligible` 로 흐림 처리).
5. 개요 TASK 의 범위 이름(장 제목 — PDF 에서 온 글)은 한 줄·80자·구분자 탈출·큰따옴표 바꿈 뒤 TASK 에 들어간다(설계 그대로 TASK 자리). DOC 밖이라 인젝션 여지가 아주 작게 있다 — 11-3 Review 가 보면 좋다.
6. `planSummary` 의 k 는 원격 상태가 ready 일 때의 수(막혀 있으면 실제 0).
7. `exportText` 꼴은 11-3 이 i18n `labels` 를 넘기며 다듬을 수 있다(지금은 시험 X3 의 꼴).
8. 서재 삭제 확인 "저장한 요약 n개는 남습니다" 줄·`deleteKeepLines` 는 11-2 몫(손대지 않음). 20-3 의 "`CASCADE_STORES` 에서 `annotations` 뺌"은 이번 `keepsOnDocDelete` 로 이미 같은 결과 — 20-3 이 둘 중 하나로.
9. 8c-2 사용량 화면 `usage.kind.summarize` 이름 키는 이미 4언어에 있다 — 할 일 없음.

## 10. 막힌 명령 · 규칙

- 막힌(거절된) 명령 없음.
- 규칙 어긋남 하나를 알린다: 처음 문법 확인 한 번을 `cd D:/01_claude_my-blog && node -e …` 로 묶어 돌렸다(지침 "묶지 말 것" 위반 — 결과에는 영향 없음, 이후 묶지 않음).
- `tar -xf C:/…` 가 드라이브 문자를 원격 호스트로 읽어 실패 → `--force-local` 로 다시(같은 일, 거절 아님).
- 서버 띄우기 0 · 프로세스 조회 0 · 진짜 키 0 · 설치·다운로드 0 · 원서 문장 인용 0(결과에는 수만).
