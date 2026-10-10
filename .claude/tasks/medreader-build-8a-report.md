# Build 보고서 — 8a: 번역 파이프라인·캐시·상태 기계·분할 계약

> 지침: `.claude/tasks/medreader-build-8a.md` · 커밋하지 않음 · 실제 키 사용 0 · 차단 훅에 막힌 명령 0건

## 1. 만든 것

| 파일 | 계층 | 내용 |
|---|---|---|
| `js/ai/prompts.js` (새) | 순수 | 10-1 공통 골격(`commonSystem`)·구분자 탈출(`escapeDoc`)·`LANG_NAMES`/`langName`·10-2 번역 지시(`translateInstruction`, 언어는 **이름**으로)·`buildTranslateRequest`·`TRANSLATE_SCHEMA`·`PROMPT_VERSION = 1`(`promptVersion`)·10-2 검증 `checkTranslation`(개수 누락·길이 비율·20% 청크 실패·숫자 소실·동방 숫자). **7b `TEST_PROMPT` 를 옮겨 옴** — 대상 언어별 조각(`TARGET_STYLE`·`TERM_EXAMPLES`)을 10-2 와 함께 쓰도록 조립하되 **결과 문자열은 7b 와 글자 단위로 같다**(테스트 P1 이 옛 리터럴과 대조). 요약(10-3)은 자리만(주석). |
| `js/ai/jsonrepair.js` (새) | 순수 | 10-6 `parseAIJson(text, schema)` — 펜스 → 첫`{`~끝`}` → 파싱 → 후행 쉼표 → 스마트 따옴표 → 잘린 응답 → 주석(누적) → 미니 스키마 검증(type·required·enum·minItems·maxLength, 실패 필드/항목 제거). 복구는 **문자열 밖에서만**. 잘린 응답은 **마지막 온전한 항목까지만** 살린다(반쪽 번역이 캐시에 남지 않게). 10-7: 스키마 밖 필드 버림, 문자열 속 URL 제거. 반환에 `repairs`(거친 단계 이름) 포함. |
| `js/ai/cache.js` (새) | 서비스 | 7-5 키 `keyFor(docId, text, target, kind)` = `hash.js` 의 `cacheKey`. `readalong`·`translate` 는 **둘 다 `translate` 키**(같은 `Unit.src` → 같은 키). `createCache({db, now, limitBytes})` → `getMany`/`putMany`(값에 `provider`·`model`·`promptVersion`·`repaired`·`sizeBytes`·`createdAt`)·상한 초과 시 `createdAt` 오래된 순으로 상한의 90% 까지 정리·`deleteDoc(docId)`·`stats()`. 상한은 `ai.cacheLimitMB` 를 호출마다 읽는다. |
| `js/ai/pipeline.js` (새) | 서비스 | 7-6 상태 기계 + `translate(segments, {src, target, kind, docId, retry, signal})`. 캐시 → (주입 시) 기기 내 → 원격. `MAX_REQ_CHARS`·토큰 상한으로 문장 경계 분할, 같은 키 동시 요청 Promise 공유, 30초 타임아웃(AbortController), 5xx 즉시 1회 재시도, "보내지 않은 것(blocked)" vs "보냈다가 실패한 것(failed — 키 기억, `retry:true` 만 다시 보냄)", 일일 상한(검증 제외) `capped`, `onState` 알림(바뀔 때만), `retry()`·`configChanged('key'|'model'|'provider')`·`setOnline()`. 사용량: provider 가 `calls`·`byKind` 를, 파이프라인이 `cacheHits`·`ondeviceHits`·파싱 실패 `errors` 를 기록. |
| `js/ai/ondevice.js` (새) | 서비스 | 7-4 `detect(scope)`·`translate(sentences, src, dst, scope)` — `available` 일 때만, 어디서 실패하든 `null`, 원문 언어는 인자(`'en'` 없음), 전역 주입 가능. |
| `js/tts/text.js` | 순수 | `Unit.src`(정규화·300자 분할 이전 문장 원문)·`Unit.seg`(쪽 안 문장 번호, 조각 공유, **표 안내는 `null`**)·`Unit.kind` + `sentencesOf(units)`(seg 로 묶기만 — **다시 나누지 않는다**, `frag` head/tail). `TABLE_NOTICE_KIND` export. `splitSentences` 호출은 여전히 이 파일 한 곳. |
| `js/ui/reader.js` | UI | `flowParasOf(desc)` 순수 함수 분리. `flowParas()` = `insertTableNotices(flowParasOf(state.desc), …)` — 동작 동일. |
| `js/ui/settings.js` | UI | `TEST_PROMPT` 정의 삭제 → `ai/prompts.js` 에서 import 후 **다시 export**(옛 import 호환). `parseTestPair` 가 `parseAIJson(raw, TEST_PROMPT.SCHEMA)` 사용. 그 밖 화면 동작 변경 없음. |
| `js/ai/provider.js` | 서비스 | `emptyUsageRow` 에 `charsTranslated: 0`, `bumpUsage` 가 `charsTranslated` 와 `readalong` 종류를 받음, `complete()` 의 `opts.chars` 를 호출 **시작 시** `charsTranslated` 로 기록. |
| `js/config.js` | 값 | 추가만: `AI.READALONG_KIND`, 새 `PIPELINE`(타임아웃 30s·cooldown 30/60/120s·`SERVER_RETRIES 1`·길이 비율 1/5~5·청크 실패 1/5·출력 토큰 ×3+200·temperature 0.2·캐시 200MB/정리 90%·`MAX_REQ_CHARS 6000`). 무료 티어 한도 숫자 없음. |
| `js/db.js` | — | **변경 없음.** `aiCache` 의 `docId`·`createdAt`·`kind` 인덱스가 이미 있다. `DB_VERSION` 2 그대로, 마이그레이션 없음. |

새 테스트 7개 파일 + 스텁 1개: `split-contract-8a`(12) · `prompts-8a`(10) · `jsonrepair`(10) · `cache-8a`(7) · `pipeline-8a`(25) · `ondevice-8a`(6) · `ai-layers-8a`(5) · `fixtures/ai-stubs-8a.mjs`(메모리 DB·fetch 스텁·수동 타이머).

**기존 테스트 1건 수정** — `tests/settings-7b-fix.test.mjs` J3 의 한 단언. 이 단언은 "`ui/settings.js` 에 `Modern Standard Arabic` 이 정확히 1번"이었는데, 지침대로 지시문을 `prompts.js` 로 옮기면 반드시 0 이 된다(그 테스트 주석도 "8a 의 prompts.js 로 옮겨 갈 것"이라 적어 두었다). "화면 0 · prompts.js 1 · 설정 화면이 prompts.js 를 import" 로 바꿨다. 지시문 내용 고정은 새 테스트 P1 이 7b 리터럴과 글자 단위로 한다. (지침의 "tests/ 새 테스트" 범위를 벗어나는 유일한 수정이다.)

## 2. 16-D2 항목별 결과

| 항목 | 결과 | 고정하는 테스트 |
|---|---|---|
| `[N]` 분할 계약 R1~R6 | ○ | R1·R2·R2-보조·R3·R4·R4-보조·R6 (`split-contract-8a`). R5 는 변이로 확인(아래 R5) |
| `[N]` R5 변이 — 두 번째 분할이면 R2 빨강 | ○ **R2 빨강 1** | 변이 R5: `sentencesOf` 가 약어를 무시하는 정규식으로 다시 나누게 함 → "Dr. Kim …, e.g. Temperature" 가 쪼개져 R2 만 빨강 |
| `[D]` grep: `splitSentences` 호출 `tts/text.js` 한 곳, 정의 `text/segment.js` 한 곳 | ○ | `grep -rn "splitSentences(" js/` → `text/segment.js:99`(정의)·`tts/text.js:180`(호출) 두 줄뿐. R6 테스트가 주석 제외 코드로 같은 검사를 고정 |
| `[N]` `jsonrepair.test.mjs` 코드펜스·후행 쉼표·잘린 배열·스마트 따옴표·스키마 위반 | ○ | J1·J2·J3·J4·J6 (+ J5 주석·J7 URL·J8 PARSE·J9 [시험 번역]·J10 순수성) |
| `[N]` 10-2 검증(개수 누락·비율·20%·숫자 소실·동방 숫자) | ○ | 순수: V1~V5 (`prompts-8a`), 파이프라인에서: V1~V3 (`pipeline-8a`) |
| `[N]` 상태 기계 — 429 exhausted+재시도 0 | ○ | M1(Retry-After)·M1b(다음 날 00:00) |
| 　500 → 1회 재시도 후 cooldown | ○ | M2(호출 정확히 2, 30→60→120s, 최대 3단계)·M2b(재시도 성공) |
| 　401 → no-key | ○ | M3(401·403·400 `API_KEY_INVALID`·키 없음 → 요청 0) |
| 　REGION → region(키 설정 유도 없음) | ○ | M4(400 FAILED_PRECONDITION·403 문구 둘 다, no-key 상태를 한 번도 안 거침, 키 재입력으로 안 풀림) |
| 　타임아웃 30초 → cooldown | ○ | M6(수동 타이머로 30,000ms 발화 → abort → cooldown·TIMEOUT, 호출 1) |
| 　같은 키 동시 요청 → Promise 공유(호출 1건) | ○ | M7(낭독 경로·탭 경로·같은 묶음 동시 3건 → fetch 1, 한 호출 안 중복도 1) |
| `[N]` 캐시 — 같은 `Unit.src` 는 탭·낭독에서 같은 키 | ○ | K1(키 일치)·S2(낭독이 받은 것을 탭이 네트워크 0 으로) |
| 　상한 초과 시 `createdAt` 오래된 순 정리 | ○ | K4·K5(바깥 삭제 뒤 헛정리 없음) |
| 　문서 삭제 시 `docId` 항목 전부 삭제 | ○ | K6(`cache.deleteDoc` + `db.deleteDocument` 의 CASCADE 에 `aiCache` 와 `docId` 인덱스 쓸기 확인) |
| `[N]` 프롬프트 — 언어 이름이 값에서, `ko` 지시문에 아랍어 예시 없음 | ○ | P2(아랍 문자 0·"Arabic" 0)·P3 |
| 　`grep -n "Arabic\|'ar'" js/ai/pipeline.js js/ai/readalong.js` 0건 | ○ | 직접 grep 0건(readalong.js 는 8b 라 아직 없음). P5 가 고정 |
| `[D]` 기기 내 Translator 로 탭 번역이 네트워크 없이 · 없으면 폴백·콘솔 예외 없음 | **8c 로 넘김** | 탭 화면이 8c 몫이다. 8a 는 감지·폴백만 스텁으로: D1~D6(`ondevice-8a`) + 파이프라인 O1(주입 시 fetch 0·`ondeviceHits`, `null` 이면 원격, 설정으로 끔) |

그 밖에 지침이 요구한 것: "보내지 않은 것/보냈다가 실패한 것" F1·F2, 일일 상한 F3, 사용량 `charsTranslated`·`byKind.readalong` S3·L5, 코드펜스 응답 V4, SAFETY V5, 상태 알림 1회 O2, 던지지 않음·키 미노출 O3, 계층(ai→ui·segment import 0, console 0) 3-2 테스트·L1·L2, 자동 재시도 5xx 1회뿐 L3, 한도 숫자 없음 L4.

## 3. 테스트 수

`node --test "apps/medreader/tests/*.test.mjs"` — **670 → 745**, 전부 통과(실패 0). 새 75개.

## 4. 변이 테스트 (14종, 전부 빨강)

방법: 원본 5개 파일을 스크래치패드 `build8a-mut/orig/` 에 복사 → 변이마다 문자열 치환(치환 위치가 정확히 1곳인지 확인) → **변이 표지 문자열이 작업본에 실제로 있는지 확인(적용 확인 ○)** → 해당 테스트 실행 → `orig/` 복사본으로 되돌림. 끝난 뒤 `cmp` 로 5개 파일 모두 원본과 바이트 동일 확인. `git checkout/restore/stash` 사용 안 함.

| 변이 | 빨강 | 걸린 테스트 |
|---|---|---|
| **R5** `sentencesOf` 가 두 번째 분할(약어 무시) | 1 | R2 |
| A1 429 에 자동 재시도 | 1 | M1 |
| A2 Promise 공유 빼기 | 1 | M7 |
| A3 길이 비율 검사 빼기 | 4 | prompts V2·V3, pipeline V1·V2 |
| A4 REGION → no-key | 1 | M4 |
| A5 5xx 즉시 1회 재시도 빼기 | 4 | M2·M2b·F2·L3 |
| A6 타임아웃을 cooldown 으로 안 보냄 | 1 | M6 |
| A7 실패한 문장 다시 보내기(failedKeys 무시) | 1 | F2 |
| A8 동방 숫자 변환 빼기 | 2 | prompts V4, pipeline V3 |
| A9 캐시 kind 통합 빼기(readalong 키 분리) | 4 | K1·K2·S2·M7 |
| A10 잘린 응답을 그대로 닫기(반쪽 번역 살림) | 1 | J3 |
| A11 표 안내에도 문장 번호 | 2 | R4·R4-보조 |
| A12 코드펜스 제거 빼기 | 1 | J1 |
| A13 상한 계산에서 검증 호출 안 빼기 | 1 | F3 |

관찰: A12 에서 파이프라인 V4·[시험 번역] J9 는 **초록으로 남았다** — 펜스를 안 걷어도 2단계(첫 `{` ~ 마지막 `}` 자르기)가 같은 결과를 내기 때문이다. 즉 7b 의 "코드펜스 JSON 이 한 블록으로 보임"은 1·2단계 어느 쪽으로도 풀린다. 펜스 단계 자체는 J1 이 `repairs` 로 고정한다.

## 5. 브라우저 확인 (`preview_start {name:"blog"}`, 캐시 우회)

고친 파일 11개를 `fetch(url, {cache:'reload'})` 로 다시 받은 뒤 **새 탭**·새 쿼리(`?v=8a2`)로 열었다. 모듈이 새 코드인지 확인(`parseTestPair` 안에 `parseAIJson`, 설정 화면의 `TEST_PROMPT === prompts.js 의 TEST_PROMPT`).
설정 상태(온보딩 완료·동의·UI 한국어)와 **가짜 키**(조각을 이어 만든 더미, sessionStorage)를 콘솔에서 넣고, `generativelanguage.googleapis.com` 만 가로채는 fetch 스텁을 걸었다.

| 확인 | 결과 |
|---|---|
| [시험 번역] — 평범한 JSON | 두 블록(ar `dir=rtl` · ko `dir=ltr`), ar 블록 `bdi[dir=ltr]` 3개 `(rheumatoid arthritis)`·`(C-reactive protein)`·`mg/L`. 메타 "ms · gemini-3.5-flash-lite · OK / 입력 토큰 421 · 출력 토큰 266" |
| [시험 번역] — ```` ```json … ``` ```` 코드펜스 | **이제 두 블록**(원문 한 블록 아님), bidi 동일 |
| [시험 번역] — 잘린 펜스 JSON + `MAX_TOKENS` | 원문 한 블록(`ai-tr-raw`) + 메타 "OK · MAX_TOKENS" — 잘린 번역을 닫아서 보이지 않음(의도) |
| 360×740 | 두 블록, 가로 스크롤 없음(`scrollWidth 361 = innerWidth 361`) |
| 요청 URL 에 키 / DOM 에 키 | 없음 / 없음 |
| 콘솔 | **0건** |

끝난 뒤: 가짜 키 삭제(session·local storage 비어 있음 확인), 넣었던 설정 3개 `reset`, fetch 원복, 뷰포트 **desktop 으로 되돌림**.
**리더 화면(`flowParasOf` 분리)은 브라우저에서 보지 못했다** — 미리보기 브라우저에 가져온 PDF 가 없다. 분리는 순수 함수 추출뿐이고 `split-contract-8a` 의 R4-보조(실제 `describePage` → `flowParasOf` → `insertTableNotices` 경로)와 소스 대조 테스트가 고정한다. 오케스트레이터 실PDF 재현 때 낭독 큐가 그대로인지 한 번 봐 주면 좋다.

## 6. spec 과 다르게(또는 spec 에 없어서) 정한 것

1. **`MODEL_UNAVAILABLE` → 새 원격 상태 `model`.** spec 7-6 에 없다. `no-key` 로 보내면 키 문제로 오안내(7b 의 R1 과 같은 종류), `cooldown` 이면 시간이 지나 같은 404 를 또 부른다(호출 낭비). 그래서 `region` 처럼 **끈적한** 상태로 두었다: 시간·키 재입력으로는 안 풀리고, `configChanged('model'|'provider')` 또는 [다시 시도]로 ready. 그동안 문장은 `blocked`(내용이 판정받지 않음 → 모델을 바꾸면 보낸다). M5 가 고정. UI 문구 `ai.state.model` 류는 8b/8c 가 정해야 한다.
2. **blocked / failed 분류.** spec 7-6 의 "보냈다가 실패" 목록(5xx 재시도 후·파싱·SAFETY·개수 누락)에 **타임아웃·네트워크 오류·BAD_REQUEST·밀림(비율·숫자)** 을 더했다. 반대로 **429·401/403·REGION·MODEL·오프라인 감지·호출자 abort** 로 거절된 문장은 보냈더라도 `blocked`(상태가 원인이고 내용이 판정받지 않았다 — 상태가 돌아오면 첫 전송처럼 보낸다).
3. **`cacheHits` 는 문장이 아니라 "아낀 호출" 단위**로 센다 — `translate()` 한 번이 전부 캐시로 끝나면 +1(15절 "절약된 호출 = cacheHits + ondeviceHits" 의 뜻에 맞춤). `ondeviceHits` 도 호출 단위.
4. **`byKind.readalong` 은 빈 행에 없고 처음 쓰일 때 생긴다.** spec 9-2 는 빈 행에 둔다. 7a 테스트(`provider-7a` "byKind 의 고정 키 여섯 개")가 빈 행 키 6개를 고정해 `USAGE_KINDS` 에 넣지 않고 `AI.READALONG_KIND` 로 따로 두었다. 원하면 `USAGE_KINDS` 에 넣고 그 7a 단언 한 줄을 고치면 된다. `charsTranslated` 는 빈 행에 있다(0).
5. **20% 청크 실패의 분자 = 길이 비율 + 숫자 소실**(둘 다 10-2 "밀림 방지 검사"). 개수 누락은 세지 않는다.
6. **[시험 번역]은 잘린 응답을 짝으로 치지 않는다**(`repairs` 에 `truncated` 가 있으면 원문 한 블록). 진단 버튼에서 `MAX_TOKENS` 를 가리지 않으려는 것 — 7b 테스트 J2 의 "잘린 JSON → ok:false" 도 그대로 지킨다. 파이프라인은 잘린 응답을 받되 **마지막 온전한 항목까지만**(나머지는 개수 누락 → failed).
7. `jsonrepair` 가 문자열 속 URL 을 지운다(10-7) — [시험 번역]에도 적용된다. 숫자형 문자열 `"i":"2"` 는 정수로 받아 준다(복구로 기록).
8. `frag` — 한 문장뿐인 쪽이 head·tail 둘 다에 해당하면 **head**.
9. `LANG_NAMES` 에 en·fr·ko·ar 외 de·es·fa·he·ur·ja·zh·tr 이름을 넣었다(지시문용 이름일 뿐 지원 원문 목록이 아니다). `TERM_EXAMPLES` 에 7b 지시문에 있던 **ko 예시**도 두었다(ko 대상 지시문에 아랍어가 섞이지 않는 것은 P2 가 고정).
10. 10-2 번역 지시문 끝에 대상 언어 문체 지시("Write the translation in Modern Standard Arabic (الفصحى). Use standard Arabic medical terminology.")를 붙였다 — Nour 가 좋다고 한 7b 지시문의 아랍어 문체 지시를 실제 번역에도 쓰기 위해서. 문자열 조각은 `TEST_PROMPT` 와 같은 표에서 온다(한 벌).
11. 캐시 정리는 상한을 넘으면 **상한의 90% 까지** 지운다(매 쓰기마다 한 항목씩 지우는 것을 피함). 캐시 `hits` 필드는 읽을 때 갱신하지 않는다(쓰기 비용) — 0 으로만 저장.

## 7. 8c(·8b)로 넘긴 것

- **16-D2 `[D]` 기기 내 Translator 탭 번역** — 탭 화면이 8c. 8a 는 `ondevice.js` 와 파이프라인 주입 지점(`deps.ondevice`)만. 앱 쪽 배선(파이프라인 생성 시 `ondevice.translate` 주입, `getKey = keys.readKeySecret`, 설정 변경 시 `configChanged`)은 **아직 아무도 하지 않았다** — 8a 는 UI 없음(19절).
- 80% 경고(`ai.warnAt`) 이벤트, 사용량 화면(호출당 평균 글자·1만 자당 호출·남은 쪽), 캐시 용량 표시 — 8c. `cache.stats()` 는 준비됨.
- 상태별 UI 문구(`model` 포함)·상태 바 — 8b/8c.
- 8b 의 `ai/readalong.js` 는 `pipeline.onState` 의 `ready` 전이를 듣고 창 안의 `blocked` 문장을 다시 보내면 된다(파이프라인은 실패 문장을 스스로 거른다).

## 8. 기타

- `js/text/*` 는 건드리지 않았다(`segment.js` 의 `splitSentences` 시그니처 그대로). `spec.md` 의 기존 수정(19절 7b 행, 작업 시작 전부터 있던 것)은 내 변경이 아니다.
- `ai/pipeline.js` 를 만들면 브라우저에서 `online`/`offline` 리스너를 전역에 붙인다(`deps.listen === false` 면 안 붙임 — 테스트는 끈다).
- 차단 훅에 막힌 명령: 없음.
