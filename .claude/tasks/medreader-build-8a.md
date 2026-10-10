# Build 지침 — 8a: 번역 파이프라인·캐시·상태 기계·분할 계약

> 너는 **Build 서브에이전트**다. 아래 "고쳐도 되는 파일"만 고친다. **커밋하지 않는다.** 실제 키를 넣지 않는다.
> 끝나면 보고서 `.claude/tasks/medreader-build-8a-report.md` 를 쓴다. 모든 산출물·보고는 **한국어**.

## 먼저 읽을 것

1. `.claude/tasks/medreader-handoff.md` — "반드시 지킬 것", "알려진 함정", 그리고 **2026-09-28 이후 절 전부**(낭독 동반 번역·글자 수 단위·7b 실키 확인·bidi·운영자 결정)
2. `apps/medreader/spec.md` — **19절 8a 행**, **16-D2**(합격 기준 — 끝의 정의), 7-1·7-2·7-5·7-6·7-8-2(분할 한 벌 계약 R1~R6)·7-8-3(청크·창 — 8b 가 쓰지만 8a 의 캐시·파이프라인이 받쳐야 한다), 8-1·8-2, 10-1·10-2·10-6(jsonrepair)·10-7, 3-2(import 방향)
3. 기존 코드: `js/ai/provider.js`·`js/ai/adapters/gemini.js`·`js/ai/tokens.js`, `js/ui/settings.js` 의 **`TEST_PROMPT`**(8a 의 `prompts.js` 로 옮겨 올 지시문 — **Nour 가 아랍어 품질 "좋다"고 확인했다. 내용을 바꾸지 마라**), `js/tts/text.js`(`buildUnits`), `js/text/segment.js`(`splitSentences`), `js/ui/reader.js`(`flowParas`·`insertTableNotices`), `js/text/bidi.js`, `js/db.js`(`aiCache`·`usage` 스토어)

## 만들 것 (19절 8a 행)

1. **`js/ai/prompts.js`** — 10-1 공통 골격 + 10-2 번역. 원문·대상 언어 **이름이 값에서** 들어간다(`ar` 을 박지 않는다 — 운영자가 `ko` 로도 쓴다). 지금 `settings.js` 의 `TEST_PROMPT` 를 이리로 옮기고 설정 화면은 이것을 import 한다(지시문 한 벌). `promptVersion` 상수. 요약 프롬프트(10-3)는 후순위 — 자리만.
2. **`js/ai/jsonrepair.js`** — 10-6. 코드펜스·후행 쉼표·잘린 배열·스마트 따옴표·스키마 위반. 7b Review 가 기록한 "코드펜스로 감싼 JSON 이 원문 한 블록으로 보인다"를 이것이 해결해야 한다(설정 화면 [시험 번역]도 이 파서를 쓰게).
3. **`js/ai/cache.js`** — 7-5 캐시 키(`kind|target|docId|hash(normalize(text))`), `getMany`/`putMany`, 상한(`ai.cacheLimitMB` 200) 초과 시 `createdAt` 오래된 순 정리, 문서 삭제 시 `docId` 항목 전부 삭제. 캐시 값에 `provider`·`model`·`promptVersion` 저장(키에는 넣지 않음).
4. **`js/ai/pipeline.js`** — 7-6 상태 기계: `ready|inflight|cooldown|exhausted|no-key|offline|capped|region`. 429 → `exhausted`(자동 재시도 0), 5xx → **1회** 재시도 후 `cooldown`, 401·AUTH → `no-key`, `REGION` → `region`(키 설정 유도 없음), `MODEL_UNAVAILABLE` 도 상태로 다뤄라(7b-fix 가 만든 코드 — spec 7-6 에 없으니 네가 정하고 보고서에 적어라), 타임아웃 30초 → `cooldown`, 같은 캐시 키 동시 요청 → Promise 공유. **"보내지 않은 것"(상태 복귀 시 전송) vs "보냈다가 실패한 것"(사용자 재시도만)** 구분(7-6). 사용량 기록(15절, 글자 기준 지표 `charsTranslated`). 일일 상한 `capped`.
5. **10-2 검증** — 개수 누락이면 있는 것만 채택, 길이 비율 `[0.2, 5]` 밖이면 그 항목 `failed`, 청크의 20% 초과면 청크 전체 파싱 실패, 숫자 소실이면 `failed`, 동방 숫자(`٣`)는 `3` 과 같다.
6. **분할 한 벌 계약(7-8-2 R1~R6)** — `tts/text.js` 에 `Unit.src/seg/kind` + `sentencesOf`, `ui/reader.js` 의 `flowParas` 에서 순수 부분 `flowParasOf` 를 분리(서비스가 import 할 수 있게). **`splitSentences` 호출은 `js/tts/text.js` 한 곳뿐**이어야 한다(grep). 표 안내 문단(`table-notice`)은 번역 입력에서 뺀다.
7. **`js/ai/ondevice.js`** — 7-4 기능 감지와 `translate(sentences, src, dst)`. 실패는 `null`(예외가 위로 가지 않는다). 원문 언어는 `'en'` 을 박지 말고 인자로. 16-D2 의 `[D]` "줄을 탭해 네트워크 없이 번역"은 **탭 화면이 있는 8c 몫**이다 — 8a 에서는 감지·폴백 로직을 스텁으로 검증만 하고 보고서에 "8c 로 넘김"이라 적어라.

## 고쳐도 되는 파일
새 파일 `js/ai/prompts.js`·`jsonrepair.js`·`cache.js`·`pipeline.js`·`ondevice.js`, `js/ai/provider.js`(필요한 만큼), `js/tts/text.js`(분할 계약 부분), `js/ui/reader.js`(`flowParasOf` 분리만 — 동작 변경 금지), `js/ui/settings.js`(`TEST_PROMPT` 를 `prompts.js` 로 옮기고 [시험 번역]이 `jsonrepair` 를 쓰게 — 그 밖의 화면 동작 변경 금지), `js/config.js`(AI 상수 추가만), `js/db.js`(스토어·인덱스가 부족하면 — 그 경우 `DB_VERSION` 과 마이그레이션을 보고서에 명시), `tests/` 새 테스트.
**건드리지 않는 것:** `spec.md`, `js/text/*`(단, `segment.js` 의 `splitSentences` 시그니처는 그대로 — 7c 가 `{lang}` 을 더한다), `js/quiz/*`, `js/pdf/*`, `js/tts/speaker.js`(8b 몫), `gemini.js` 의 오류 판정(REGION·R1·MODEL_UNAVAILABLE 순서), 모델 목록 필터.

## 반드시 지킬 것
- 키 누출 금지(`assertNoKeyInUrl`·`redact` 위에 얹는다). 가짜 키는 소스에 한 덩어리로 두지 않는다(GitHub 비밀 스캐너).
- 서비스 계층(`ai/*`)은 UI 문자열을 만들지 않는다 — 코드·상태만. `ai/*` 에서 `../ui/` import 0건(3-2). `ai/*` 는 `text/segment` 를 직접 쓰지 않는다 — 분할은 `tts/text.js` 의 결과만 받는다(3-2 `[수정 2026-09-28]`).
- **자동 재시도 금지**(5xx 1회 예외만). **무료 티어 한도 숫자 하드코딩 금지.**
- 순수 계층 검사(16-A)는 **주석까지** grep 한다 — `text/*` 주석에 `document`·`window` 를 쓰지 마라.
- 7b 의 화면 동작(설정 탭·[검증]·[시험 번역]의 두 언어 블록·bidi)이 그대로여야 한다.

## 검증 — 보고서에 수치로
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 670).
2. 16-D2 의 `[N]` 항목 전부, 각각 어떤 테스트가 고정하는지.
3. **변이 테스트**: R5(두 번째 분할을 일부러 만들면 R2 가 빨개진다)는 spec 이 요구한다. 그 밖에 최소 4개(자동 재시도 넣기·Promise 공유 빼기·길이 비율 검사 빼기·`REGION` 을 `no-key` 로 보내기 등). **변이가 실제로 적용됐는지 grep 으로 확인한 뒤** 결과를 읽어라(인계 문서 10-08 — 적용 안 된 변이로 "0 빨강"을 읽을 뻔했다). 원본은 스크래치패드에 복사 후 복사본으로 되돌린다(`git checkout`·`restore`·`stash` 금지).
4. 브라우저(`preview_start {name:"blog"}`, 캐시 우회): 설정 화면 [시험 번역]이 fetch 스텁으로 여전히 두 블록·bidi, 코드펜스 JSON 이 이제 두 블록으로 보이는지. 콘솔 0.
5. 보고서: 만든 것, 16-D2 항목별 결과, 테스트 수(전→후), 변이 결과, spec 과 다르게 정한 것(`MODEL_UNAVAILABLE` 상태 처리 등)과 이유, 8c 로 넘긴 것.
