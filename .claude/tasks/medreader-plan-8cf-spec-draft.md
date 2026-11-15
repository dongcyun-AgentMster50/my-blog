# 초안 — spec 에 붙여 넣을 것 (8c + 8f Plan, 2026-11-16)

> 이 파일은 **초안**이다. spec.md 는 고치지 않았다. 붙일 자리 두 곳:
> (A) 17-7-5 바로 뒤에 새 소절 "17-7-6" 전체, (B) 19-1 표 **8c + 8f** 행 맨 끝에 `[수정 …]` 한 줄.

---

## (B) 19-1 표 8c + 8f 행 끝에 붙일 한 줄

`[수정 2026-11-16 — 8cf Plan]` 설계·나누기·수용 기준은 **17-7-6** 이 정본이다. 다섯 Build 로 나눈다 — **8c-1 탭 번역·선택 동작 줄 → 8f-1 단어장 데이터·단어 요청(화면 없음) → 8f-2 단어 시트 → 8f-3 단어장 화면·CSV → 8c-2 사용량 화면·80% 경고** (+ 선택 8f-4 아랍어 검색어 → 단어장 대응, 17-8-9 (나)). DB 버전 3 그대로·`algoVersion` 무관. 자리는 **8e 배포 뒤**(같은 `index.html`·`reader.css`·`controls.js`·i18n). Build 합 약 10–11.5시간 + Review 합 약 5.5–6.5시간(옛 추정 4~5시간은 화면 셋·CSV 왕복을 작게 셌다).

---

## (A) 새 소절

#### 17-7-6. 8c + 8f Build 설계 `[신설 2026-11-16 — 8cf Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 8cf-D1–D14]`

**방침**: 7-2·7-7·15절·16-D4·17-7-1~17-7-5 는 고치지 않는다. 그 뒤 들어온 단계(8d·8m·8p·8g-7·9a·9b·다듬기 2·3)에 맞춘 것과 Build 지시는 이 소절이 정본이다. 실기기에서만 답이 나오는 것은 끝의 **"마지막 실기기 점검 묶음"** 으로 모은다 — 기다리지 않는다.

##### 1. 지금 코드 사실 (파일:행 — 2026-11-16 작업 트리, 9b 배포 `4c57246` 뒤)

| 항목 | 지금 | 근거 |
|---|---|---|
| 줄 탭(리플로우) | `#readerMount` 의 **`pointerup`** → `closest('span.line[data-flow="1"]')`. 선택 글자가 있으면(`String(getSelection()).length > 0`) 탭이 아니다. 구독자에게 `lineId` | `js/ui/reader.js:587-602` |
| 줄 탭(원본) | 캔버스 `pointerup` → 좌표 역변환 → 같은 구독자 목록 | `js/ui/original.js:438·461-467` · `js/ui/reader.js:558-563` |
| 탭 구독자 | **첫 줄 `cancelVoice()`**(9b-2 — 듣기 취소, 손이 이긴다) → 상태가 `speaking`·`paused` 면 `speaker.play(lineId)`, **아니면 아무것도 안 한다**(`idle`·`error`·`waiting-page`) | `js/ui/controls.js:235-242` |
| 길게 누르기 | **잡는 코드 없음.** 브라우저 기본(낱말 선택)만. `selectionchange` 구독 0건. 리플로우 글자는 선택 가능(`user-select` 막지 않음, `.reflow .line { touch-action: manipulation }`) | `js/ui/reader.js:591-592` 주석 · `css/reader.css:897` |
| 낭독 상태 | `idle · speaking · paused · waiting-page · error` | `js/tts/speaker.js:61` |
| 큐 | `queueOf(paras)` = `buildUnits(paras, unit, unitOpts())` − 인용(8h-1, 켜지 않았으면). `reload()` 는 낭독 중이 아니어도 **`queue` 이벤트**를 낸다 → `readalong.onQueue`·`inlinetr` 가 기억 | `js/tts/speaker.js:736-741·1037-1064·1126-1130` · `js/ui/controls.js:220-223` · `js/ui/inlinetr.js:243-246` |
| 줄 단위 낭독 | `tts.unit = 'line'` 이면 큐가 줄 단위 → readalong 유효 모드 `off`(사유 `line-mode`) | `js/ai/readalong.js:86-99` |
| 띠 | 유효 모드가 `off` 면 **숨기고 자리도 비운다**(`data-tr-band` 뗌). [×]·[문단 전체] 마크업 **없음** — 띠는 낭독 문장만 그린다. 배너는 `medreader:banner` 이벤트 | `js/ui/trband.js:236-256·429-434` · `index.html:468-476` |
| 문장 아래(8d) | `<html data-tr-inline="on">` 이면 CSS 가 띠를 감춘다 | `js/ui/inlinetr.js:284-285·304` · `css/reader.css:551` |
| 탭 번역 서비스 | **없다.** `readalong` 의 메모리(`mem`, 키 `srcKey(src)`)·`onChange`·`cachedFor`·`translatable` 은 있다. `setDoc` 은 유효 모드와 무관하게 `target`·`domain` 을 둔다 | `js/ai/readalong.js:465-480·540-589·650-673` |
| 파이프라인 | `translate(segments, {kind:'translate'|'readalong', …})` 하나 — 요청·스키마·검증이 번역 전용(`buildTranslateRequest`·`TRANSLATE_SCHEMA`·`checkTranslation`). 상한(`overCap`, 검증 제외)·`capped` 는 **있다**. **80% 경고(`ai.warnAt`)를 읽는 코드 0건** | `js/ai/pipeline.js:205-233·268-357·360-387·474-551` · `js/settings.js:97-98` |
| 사용량 기록 | `provider.bumpUsage` — 호출이 **시작될 때** `calls`·`byKind`·`byProvider`·`charsTranslated`(readalong 만). 캐시 적중 `cacheHits`, 기기 내 `ondeviceHits`. `byKind` 는 `USAGE_KINDS`(6개 — 7a 테스트가 빈 행을 고정) + `READALONG_KIND` 만 받는다 | `js/ai/provider.js:209-283·446-449` · `js/config.js:628-638` |
| 사용량 화면 | **`ui/usage.js` 없음.** `#/usage` 라우트와 자리표시 섹션만("아직 만들지 않았습니다"). `main.js` 의 route switch 에 `usage` 없음. 입구 없음 | `js/router.js:78-79` · `index.html:758-767` · `js/main.js:269-289` |
| 상한·캐시 설정 | 설정 AI 탭에 일일 상한 입력·캐시 **항목 수**·[비우기](확인)가 이미 있다(용량 MB 표시는 없음) | `js/ui/settings.js:712-714·1515-1536·1786-1792·1886-1896` |
| `cards` | 스토어·인덱스 `docId`·`dueAt`·`term` 있음(`kind` 인덱스 없음). **쓰는 코드 0건.** `CASCADE_STORES` 에 들어 있어 문서를 지우면 함께 지워진다 | `js/db.js:70-75·451-454·531-575` |
| DB 버전 | **3**(8g `searchText`). 이번 설계는 올리지 않는다 | `js/db.js:24` |
| 캐시 키 | `cacheKey` 가 `normalizeForHash` = NFKC + **`\s+` → 공백 하나**. 17-7-2 의 `term + '\n' + context` 는 `'\n'` 이 공백이 되어 "a b"+"c" 와 "a"+"b c" 가 **같은 키**다 → 아래 4-3 에서 바로잡는다 | `js/hash.js:107-113` · `js/ai/cache.js:33-40` |
| 서재 삭제 | `confirm(t('library.card.deleteConfirm'))` → `db.deleteDocument` | `js/ui/library.js:1024-1041` |
| 서재 상단 | `[설정][정보][🔍]` 한 줄. 리더 상단바에 [⋮] 메뉴 없음(12-8-1 표) | `index.html:300-308·351-366` |
| 설정 키 | `vocab.lastExportAt` 은 9-3 에만 있고 `DEFAULTS` 에 없다 | `js/settings.js:80-110` |
| 배포 안전장치 | 새 `js/*.js` 는 `dev/stamp-importmap.mjs` 로 import map 에 넣어야 한다(커밋 전 `--check` 0) | `dev/stamp-importmap.mjs:1-30` |

##### 2. 17-7-1~5 이후 바뀐 것 — 맞춘 결과

1. **9b-2 줄 탭 첫 줄 `cancelVoice()`** — 그대로 둔다. 새 분기(탭 번역)는 그 **뒤**에 온다. 선택 동작 줄의 단추들도 첫 줄에서 `cancelVoice()`(손이 이긴다 — 같은 규칙).
2. **8d 문장 아래** — 탭 번역은 inline 에서도 **띠**(7-7-1 마지막 문단 그대로 — 결정 8cf-D5). 띠가 열린 동안 `inlinetr.suspend(true)` 가 `data-tr-inline` 을 떼고 닫으면 되돌린다(8d 남은 문제 ⑨). 이미 그려진 `.ra-tr` 블록은 지우지 않는다(본문이 움직이지 않게).
3. **8m 단위 언어** — 탭·선택이 고른 문장이 `readalong.translatable(u)` 가 거짓이면(대상 언어와 같은 언어·인용·표 안내) 요청하지 않고 띠에 짧은 한 줄(`tap.none`). 단어의 원문 언어 = `Unit.lang || doc.lang`.
4. **8p `domain`** — 탭 번역은 readalong 의 `doc.domain` 을 그대로 넘긴다(키 불변). **단어 지시문에도 넣는다**: `medical` → "standard {target} medical term", `general` → "the usual {target} word or expression". 키에는 넣지 않는다(7-5·L-D9 (가)). 캐시 값에 `domain` 기록(다듬기 2 와 같다).
5. **다듬기 2·3 (M1 막힘 줄)** — 탭 띠는 한 번에 한 장이라 쌓임이 없다. 막힘 사유 문구는 `noteKeyFor`(trband 공유) 그대로.
6. **8g-7 사전** — 단어장과 무관(장 단위 호출 0 대응). 17-8-9 (나) "단어장 대응"은 8f 뒤 작은 단계 **8f-4**(선택 — 8cf-D13).
7. **9a** — 무관(Media Session 은 손대지 않는다). **9b** — 명령 추가 없음("이 단어"는 넣지 않는다 — 17-7-1). "여기 설명"(11a)은 자리만: 선택 동작 줄은 단추 4개까지 한 줄에 들어가게 만들어 둔다(11a 가 [설명]을 더할 자리).
8. **무료 한도 원칙(17절 머리)** — 새 호출은 **사용자 동작에서만**: 캐시 없는 줄 탭(문단 1회, 7-2 승인), [문장 번역], 단어 시트 [AI 로 번역](1회), 단어장 [번역 안 된 것 모두 번역](누를 때 1회 — 최대 20개). 그 밖 전부 호출 0.
9. **8e** — 선택 동작 줄·단어 시트는 `--reader-chrome-bottom` 하나를 읽는다(8e compact 에서 저절로 83 + 띠). 8e Build 가 끝난 뒤 시작한다.

##### 3. 손짓 — 최종 표 (17-7-1 을 코드에 맞춤)

| 손짓 | `speaking`·`paused`·`waiting-page` | `idle`·`error` | 구현 |
|---|---|---|---|
| 줄 탭 | 지금 그대로(이동·재생 / `waiting-page` 는 무시) — 8cf-D3 | **탭 번역**(띠) | `controls.js` 구독자의 `return` 자리에 분기 하나 |
| 탭이 아닌 것 | ① 누름 시간 ≥ 450ms(`pointerdown`→`pointerup`) ② 움직임 > 10px ③ **누를 때 이미 선택이 있었다**(선택을 풀려고 누른 탭) ④ 지금 선택이 있다(지금 그대로) | 같음 | `reader.js` 의 `pointerup` 앞에 `pointerdown` 기록 — 리플로우·원본 같은 규칙(순수 `isTap(down, up, hadSel)`) |
| 길게 누르기 | 브라우저 낱말 선택 → **선택 동작 줄**. 낭독은 멈추지 않는다 | 같음 | `ui/selbar.js` 가 `selectionchange` 를 듣는다 |
| 선택 동작 줄 | `[단어 번역]`(8f-2부터) · `[문장 번역]` · `[여기서부터 읽기]` | 같음 | 아래 5-2 |
| 원본 보기 | 줄 탭만(선택 없음) — 같은 표 | 같음 | |

- ①②③은 **타이머가 아니다** — 브라우저 선택과 다투지 않고, 길게 눌러 선택하는 동안 `pointerup` 이 늦게 와도(또는 `pointercancel`) 탭으로 세지 않게 막는 문턱이다. 450ms 는 Android 길게 누르기(약 500ms) 바로 아래 `[가정 — 실기기]`.

##### 4. 설계

###### 4-1. 탭 번역 (8c-1) — 서비스는 readalong 한 곳

```
controls onLineTap(lineId):                          # 9b-2 의 cancelVoice() 뒤
  s ← speaker.getState()
  if s ∈ {speaking, paused}: speaker.play(lineId); return      # 지금 그대로
  if s == 'waiting-page': return
  units ← speaker.sentenceUnits()                    # 문장 모드면 지금 큐 사본, 줄 모드면 같은 buildUnits·같은 opts 로 'sentence'
  hit   ← segsOnLine(units, lineId)                  # 순수 — 그 줄과 겹치는 seg 들(ranges, 없으면 lineIds)
  para  ← 그 seg 들의 paraId 의 모든 단위
  g ← readalong.tapGate()                            # 순수 tapGate(ctx): consent → unsupported-lang → same-lang → no-key (mode·unit·voice 는 보지 않는다)
  trband.openTap({lineId, segs: hit, paraSegs: para, gate: g})
  if g.ok: readalong.requestTap(para)                # 문단 단위 1회(7-2) — 메모리·캐시 적중이면 0회
```
- **`readalong.requestTap(units, {retry})`**(새, 약 40줄): `sentencesFromUnits(page, units)`(8m 거름 그대로) → 메모리 `ready` 는 건너뜀 → `pipeline.translate(list, {kind:'translate', src: doc.lang, target: doc.target, docId, domain: doc.domain, retry})` → 결과를 **`setMem`** 으로 넣는다. 그래서 띠(`onChange`)·문장 아래(쪽을 다시 그릴 때)·이후 낭독(refill 이 메모리 `ready` 를 건너뜀)이 같은 결과를 본다. 키는 같은 `translate` 키(7-5) — 낭독 동반 번역이 받은 쪽은 첫 탭도 0회, 탭이 받은 문장은 낭독 때 0회. `charsTranslated` 는 세지 않는다(readalong 만 — 15절).
- **`speaker.sentenceUnits()`**(새, 약 8줄, 읽기만): `unit === 'sentence'` 면 `units.slice()`, 아니면 `queueOf` 와 같은 함수·같은 `unitOpts()` 로 `'sentence'`(분할 한 벌 — 7-8-2 R6). 큐·상태를 바꾸지 않는다(8cf-D6).
- **띠 탭 모드**(`trband.js` +약 110줄): `openTap(o)` · `closeTap()`. 열리면 유효 모드와 무관하게 띠를 보이고 `data-tr-band="on"`, `inlinetr.suspend(true)`. 내용 = `hit` 문장(들)의 번역(seg 순서, 둘이면 이어서), 상태는 `bandView`·`noteKeyFor` 그대로(pending "번역 중…" · failed + [다시 시도] → `requestTap(para, {retry:true})` · blocked 짧은 줄). 새 단추 둘: **[×]**(`tr-close`, 48×48)·**[문단 전체]**(`aria-pressed`, 문단 모든 문장 — 띠 안 스크롤). 닫기 = [×] · 다른 줄 탭(새 내용으로 바뀜) · [▶] · 쪽 넘김 · 리더 떠남. 낭독이 시작되면 다음 `linechange` 에서 낭독 문장으로 돌아간다(7-7) — 유효 모드가 `off` 면 띠를 닫는다.
- **탭한 줄이 띠에 가리면** 띠를 연 뒤 그 줄 아래변이 띠 윗변 − 4px 보다 아래면 그만큼 굴린다(프로그램 스크롤 — `programScrollAt` 기록, 6-5 800ms 판정과 섞이지 않게). 리플로우만(원본은 상자 안 스크롤 그대로).
- **막힘 안내**: `tapGate` 가 `no-key`·`consent` 면 띠 한 줄 + **즉시** 배너(`noticeBanner` — 재생을 기다리는 `DEFER_UNTIL_PLAY` 와 달리 사용자가 번역을 부른 것이므로). 원격 상태(`exhausted`·`capped`·`offline` …)의 긴 안내는 지금처럼 readalong `remote` → 상태 바 한 번.

###### 4-2. 선택 동작 줄 (8c-1 이 만들고 8f-2 가 [단어 번역]을 켠다)

- 새 파일 **`js/ui/selbar.js`**(약 220줄) + 순수 **`js/text/select.js`**(약 140줄 — `isTap`·`segsOnLine`·`unitAt(units, lineId, off)`·`lineOffsetOf(path)`·`expandWord(lineText, start, end, nextLineHead, segmenterFn)`·`clampSelection(words ≤ 6, chars ≤ 60)`).
- `document` 의 `selectionchange`(rAF 로 한 번에 묶음) → 범위가 `article.reflow` 안 `span.line[data-flow="1"]` 에서 **시작**하고 `.ra-tr`(8d 블록)·`.tr-band` 안이 아니면 **스냅숏**을 만든다: `{lineId, start, end, text, page}` (오프셋 = `span.line.firstChild` 글자 기준 — I1 과 같은 좌표. 시작점이 `.hy` 안이면 줄 끝). 선택이 접히면 줄을 **300ms 뒤** 거둔다(그 사이 단추 탭이 닿게) — 단추는 스냅숏만 쓴다(Android 에서 단추를 누르는 순간 선택이 풀릴 수 있다 `[가정 — 실기기]`).
- 자리: `position: fixed`, `inset-block-end: calc(var(--reader-chrome-bottom) + 4px)`(띠가 켜져 있으면 띠 위 — 토큰 하나), 높이 `--tap`(48), z 는 팝오버 아래·본문 위. 선택 상자 아래변이 줄 윗변 − 4px 보다 아래면 그만큼 굴린다(4-1 과 같은 함수).
- 단추(48×48 이상, 논리 순서 — RTL 거울):
  - `[문장 번역]` → `unitAt` 의 문장(들) → 4-1 과 같은 길(`openTap` + `requestTap(문단)`). **모든 상태에서**(낭독 중에도 — 7-7 "낭독 중 길게 누르기"의 몫).
  - `[여기서부터 읽기]` → `speaker.play(lineId)`(12-3 "멈춤 중 길게 누르기 = 여기서부터 재생"을 옮김). 선택을 지운다.
  - `[단어 번역]` → 8f-2 의 단어 시트. 8c-1 에서는 **마크업만 두고 `hidden`**.
  - 낱말 6개·60자를 넘으면 `[단어 번역]` 만 흐림(`aria-disabled`, 누르면 한 줄 안내 `sel.tooLong`).
- 원본 보기·검색 화면·퀴즈에서는 붙지 않는다(리더 리플로우만).

###### 4-3. 단어 번역 (8f-1 서비스·순수, 8f-2 화면)

- **낱말 정하기**(`text/select.js` `expandWord`): `Intl.Segmenter(lang,{granularity:'word'})` 가 있으면 그것, 없으면 `\p{L}[\p{L}\p{M}'’-]*`. 낱말이 줄 끝에 닿고 그 줄에 `.hy`(하이픈 결합)가 있으면 다음 줄 첫 낱말을 이어 **결합된 꼴**(`cardiovascular`)로. `surface` = 그 결과, `term` = `normalizeTerm(surface)`(NFKC·소문자·공백 하나·앞뒤 구두점 제거).
- **문장(문맥) 찾기**: `unitAt(units, lineId, start)` — `ranges` 의 `{id, start ≤ off < end}`, 없으면(300자 분할) `lineIds` 첫 일치. `context = Unit.src`, `seg`.
- **찾는 순서**(17-7-2 그대로 — 호출 0 먼저):
  1. `vocabStore.findTerm(term, target)` → 있으면 그 항목(호출 0).
  2. 문장 번역: `readalong.get(src)` 메모리 → 없으면 `readalong.cachedFor([unit])`(캐시 읽기만) → `findInSentenceTr(term, tr)`(순수, `text/vocab.js`) → 후보 + 문장 번역 전체(찾은 부분 밑줄), 표시 "문장 번역에서 찾음 — 확인하세요", `origin:'sentence'`.
  3. 없으면 빈 칸 + `[AI 로 번역]`(1회) · `[번역 없이 저장]`(0회) + 안내 한 줄 "읽는 중에는 저장만 하고 단어장에서 모아 번역하면 한도를 아낍니다".
- **`findInSentenceTr(term, tr)`**: `ltrRuns(tr)` 중 괄호 묶음 → `normalizeTerm(괄호 속)` 이 `term` 을 **낱말 경계로** 포함하는 첫 묶음 → 그 앞의 "대상 언어 조각"(괄호 밖, ltr 아닌 조각 — 대상이 `fr` 처럼 라틴이면 괄호 밖 낱말)에서 뒤로 최대 4낱말, `، ؛ . : , ;`·다른 괄호에서 멈춤. `{candidate, sentenceTr, at:[s,e]}` 또는 null.
- **단어 요청**(`kind:'term'`, 사용자가 누를 때만): `prompts.buildTermRequest(items, {src, target, domain})` — 10-1 골격(치료 지시 금지·DOC 블록 데이터 취급·구분자 탈출) + 17-7-2 의 TASK·SCHEMA. `TERM_PROMPT_VERSION = 1`. `maxOutputTokens = 항목 수 × 120 + 100`, `temperature 0.2`.
  - **검증** `checkTerms(input, value)`: `items.length` 와 `i` 짝(어긋나면 그 항목만 failed — 묶음 전체를 버리지 않는다), `translation` 비지 않음·≤ 200자, `gloss` ≤ 300자(넘으면 자름), `pos` 목록 밖 → `'other'`, `term` 이 입력과 다르면 입력 값을 쓴다.
  - **파이프라인**: `pipeline.translateTerms(items, {src, target, docId, domain, force})`(새). **상태 기계·`gate`·5xx 1회·429·cooldown·no-key·region·상한·사용량을 번역과 같은 한 벌로 탄다** — `sendChunk` 를 요청 만들기·응답 받기만 다른 `job` 을 받게 일반화한다(8cf-D7). 번역의 `translate()` 는 `job = TRANSLATE_JOB` 으로 바이트 단위 같은 요청을 낸다(기존 테스트 무변이 증거). 기기 내 번역은 쓰지 않는다(gloss 가 없다). 묶음은 최대 20개·누적 `MAX_REQ_CHARS` 이하 — **한 번 누름 = 최대 1호출**(남은 수는 단추 글자 `(n)` 에).
  - **키**(17-7-2 를 바로잡음): `keyFor(docId, context, target, 'term', 'w=' + term)` — 문맥은 해시, 낱말은 `extra` 로 그대로(`'|'` 는 `normalizeTerm` 이 지운다). `'\n'` 이음은 `normalizeForHash` 가 공백으로 바꿔 경계가 사라지므로 쓰지 않는다(1절 표). 값 `{translation, gloss, pos, lemma}` + `provider·model·promptVersion·domain`.
  - `force` = [이 문맥으로 다시 번역] — 캐시 읽기를 건너뛰고 덮어쓴다(7-5 "다시 생성"). 항목이 `edited` 면 화면이 먼저 묻는다("고친 번역을 바꿀까요?").
  - **사용량**: `byKind.term`(`AI.TERM_KIND` — `USAGE_KINDS` 에 넣지 않고 `READALONG_KIND` 처럼 처음 쓰일 때 생긴다. 7a 빈 행 테스트 무변). 상한에 들어간다(검증만 빠진다 — 15절).
  - **보내는 것**: 고른 낱말 + 그 문장(교과서 원문)뿐. 사용자가 친 번역·메모·뜻은 보내지 않는다(13절).

###### 4-4. 저장 (8f-1) — `cards` `kind:'term'`, DB 버전 3 그대로

- 새 서비스 **`js/vocab/store.js`**(약 220줄 — import: `config`·`db`·`text/vocab`·`hash`. `ui/`·`ai/` 를 import 하지 않는다 — 단어 요청은 화면이 파이프라인을 부르고 결과를 store 에 넘긴다): `findTerm(term, target)`(인덱스 `term` → `targetLang` 거름) · `save(entry)`(같은 `term`+`targetLang` 이면 새로 만들지 않고 기존을 돌려준다 — 화면이 열어 보이고 `[문맥을 이 문장으로 바꾸기]`만) · `update(id, patch, {user})`(사용자 수정이면 `edited:true`·`updatedAt`) · `remove(id)` · `list({docId?})`(`docId` 인덱스 또는 전체 훑기 후 `kind==='term'`) · `countByDoc(docId)` · `changedSince(iso)` · `applyImport(plan)`(한 트랜잭션).
- 필드: 9-2 `[신설 2026-10-12]` 목록 그대로(`id, kind, term, surface, srcLang, targetLang, translation, pos, lemma, gloss, context, contextTr, docId, docTitle, pageNo, lineId, origin, edited, note, createdAt, updatedAt, sm2, dueAt, suspended`).
- **문서를 지워도 남는다**: `db.deleteDocument` 의 `cards` 쓸기에서 `cur.value.kind === 'term'` 은 건너뛴다(약 4줄). 문장 카드(`kind` 없음·`'sentence'`)는 지금처럼 지운다. `resetDerived`(다시 추출)는 `cards` 를 건드리지 않는다(지금 그대로). 서재 삭제 확인 문구에 "단어장 n개는 남습니다"(n > 0 일 때만, `library.card.deleteConfirmVocab`).
- **`kind` 인덱스는 만들지 않는다** — 만들면 DB 버전 4·배포 안전장치 확인이 필요하다. 단어장은 수천 개 이하라 훑기로 충분하다 `[추정 — 5,000개 훑기 데스크톱 < 50ms]`. 12단계 SRS 가 `dueAt` 인덱스를 쓰므로 그때도 필요 없다.
- `settings.js` `DEFAULTS` 에 `'vocab.lastExportAt': null`(9-3 그대로).

###### 4-5. 단어 시트 (8f-2) — `js/ui/wordsheet.js`(새, 약 330줄)

- 선택 동작 줄 `[단어 번역]` → 시트(`role="dialog"`, `aria-modal="false"`, 팝오버와 같은 아래 붙임·높이 식 `max-block-size: max(48×3, 100dvh − --banners-h − --bar-top − --reader-chrome-bottom − 32)`, 안 스크롤, [닫기] sticky). 8e compact 에서도 같은 식.
- 내용: 원어(`dir=ltr`, `lang=srcLang`) · 상태 한 줄(찾은 길) · **번역 칸**(`<input dir=dirOf(target) lang=target>`, 후보 미리 채움) · 짧은 뜻(AI 결과일 때) · 문맥 문장의 번역(있으면 — `appendBidiText`, 찾은 부분 `<span class="vs-hit">` 밑줄: 앞·찾은 것·뒤 세 조각을 각각 `appendBidiText`) · 단추 `[저장]` `[AI 로 번역]` `[번역 없이 저장]` · 맨 아래 "이 책의 단어장 (n)" 링크(`#/vocab/:docId`, 8f-3 부터 보임).
- 이미 있는 항목: 번역·뜻·메모를 보이고 `[이 문맥으로 다시 번역]`(1회)·`[문맥을 이 문장으로 바꾸기]`(0회).
- 모든 글자 `textContent`/`appendBidiText`, `innerHTML` 0. 원격 상태가 ready 가 아니면 `[AI 로 번역]` 은 누르면 짧은 상태 한 줄(14-2 문구)만 — 보내지 않는다.
- 낭독 중에 열어도 낭독은 멈추지 않는다. 시트가 열린 동안 선택 동작 줄은 숨는다.

###### 4-6. 단어장 화면 (8f-3) — `js/ui/vocab.js`(새, 약 450줄)

- 라우트 `#/vocab`(전체)·`#/vocab/:docId`(그 책) — `router.js` 에 `vocab` + `vocabHash(docId)`, `main.js` switch 에 `showVocab`/`leaveVocab` 각 한 줄, `index.html` 섹션 하나. 입구(8cf-D8): **서재 상단 [단어장]** · 단어 시트 "이 책의 단어장 (n)" · 서재 카드 [⋯] "이 책의 단어장". 리더 상단바는 늘리지 않는다.
- 목록 줄(48px 이상): 원어(`dir=ltr`) · 번역(`dir/lang` = 대상) · 품사 · 쪽. 위: 문서 고르기(전체/책별) · 찾기 칸(로컬 거르기 — 원어·번역 모두) · 정렬(추가일/알파벳) · `[번역 안 된 것 모두 번역 (n)]`(누를 때 1호출 ≤ 20개) · `[내보내기]`(CSV/Anki 고르기) · `[가져오기]` · "마지막 내보내기 뒤 바뀐 항목 n개".
- 편집 시트: 원어(오타만) · 번역 · 짧은 뜻 · 품사(목록) · 문맥 문장(원문 + 있으면 그 번역) · 메모 · `[원문 쪽으로 가기]`(그 쪽·`lineId` 로 — 문서가 없으면 숨김) · `[삭제]`(페이지 안 확인 대화 — `confirm()` 쓰지 않음, 서재 다시 추출 대화와 같은 장치) · `[▶]` 원어=원문 음성, 번역=번역문 음성(`pickVoice` — 호출 0, 괄호 속 라틴은 낭독에서만 뺌 `trSpeechText`).
- 내보내기·가져오기: 17-7-4 그대로. 순수 `text/vocab.js` 의 `buildCsv(entries)`(UTF-8 BOM, CRLF, RFC 4180, 열 이름 고정 14개, `= + - @`·탭·CR 로 시작하는 칸 앞 `'`) · `buildAnki(entries)`(`#separator:tab`·`#html:false`·`#columns:Front	Back	Context	Note	Source`, 칸 안 탭·줄바꿈은 공백) · `parseCsv(text)`(BOM 제거, 따옴표·`""`·칸 안 줄바꿈, `'` 접두는 **뒤가 `= + - @`·탭·CR 일 때만** 제거) · `importPlan(rows, existing)`(`id` 같으면 `updated` 새로운 쪽, 없으면 `term`+`target_lang`, 없으면 새 항목 `origin:'import'` → `{add, change, same, reject}`). 2MB·5,000줄 넘으면 거절. 미리보기 "새 n · 바뀜 m · 그대로 k" → [가져오기] 확인 → `applyImport` 한 트랜잭션. 파일 이름 `medreader-vocab-YYYYMMDD.csv|.txt`, `Blob` + `<a download>` + `revokeObjectURL`. 내보내면 `vocab.lastExportAt`.
- RTL UI: 표 방향은 UI, 원어 칸만 `dir=ltr`. 가로 스크롤 0(360px).

###### 4-7. 사용량 화면·80% 경고 (8c-2)

- 새 파일 **`js/ui/usage.js`**(약 300줄): 자리표시 섹션을 바꾼다. 순수 `usageView(rows, ctx)` 가 숫자를 다 만들고(테스트 대상), 화면은 그리기만.
  - 오늘: 호출 / 상한(`ai.dailyCap`, 검증 제외) · 종류별(번역·낭독 번역·단어·검증 …, `|| 0`) · 프로바이더별 · 모델(설정 값) · 추정 토큰 입력/출력 · 캐시 적중 n · 기기 내 n · "낭독 번역 n회 · m자 → 호출당 평균 k자 · 1만 자당 x.x회"(`calls = 0` 이면 "—") · "오늘 상한까지 약 n쪽"(15절 식 — **마지막으로 연 책**의 `readStats`, 8cf-D10; `pages < 5`·평균 없음이면 숨김, 책 제목 한 줄).
  - 이번 달: 일별 막대(CSS — 라이브러리 없음, 31칸, 높이는 그날 호출/그달 최대) · 합계 · 절약된 호출(`cacheHits + ondeviceHits`) · 적중률.
  - 캐시: 항목 수 · 용량 MB(`cache.stats()` — 새, 다시 훑어 `sizeBytes` 합) · `[설정에서 비우기]`(설정 AI 탭으로 — [비우기] 장치는 한 곳, 8cf-D11).
  - "무료 티어 한도는 Google AI Studio 사용량 페이지에서" 링크 한 줄(숫자 없음 — 16-J).
  - 화면을 열 때 90일 지난 `usage` 행을 지운다(앱 시작이 아니라 — `main.js` 부팅을 건드리지 않는다, 8cf-D12).
  - 입구: 설정 AI 탭 상한 줄 아래 `[사용량 보기]`(`data-nav="#/usage"`) · `capped` 배너의 동작 단추에 `[사용량]` 하나 더.
- **80% 경고**: `pipeline` 이 호출을 보낸 뒤(`ctx.calls++` 다음) `overCap` 과 같은 행으로 `(calls − verify) ≥ ceil(cap × warnAt)` 이고 그 행에 `capWarned` 가 없으면 `onWarn` 구독자에게 한 번 알리고 `bumpUsage({capWarned:true})`(그날 행에 표시 — 새로고침해도 하루 한 번, 8cf-D9). controls 가 `medreader:banner`(`ai.capWarn` "오늘 상한의 80%를 썼습니다 ({used}/{cap})"). `warnAt` 이 0·1 이상·숫자 아님이면 경고 없음.

##### 5. 고치는 파일 · import 방향

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **8c-1** | `js/ui/selbar.js` · `js/text/select.js` · `tests/taptr-8c.test.mjs` | `js/ui/controls.js`(탭 분기·selbar·inlinetr.suspend 배선 +40) · `js/ai/readalong.js`(`tapGate`·`requestTap` +60) · `js/tts/speaker.js`(`sentenceUnits` +10) · `js/ui/trband.js`(탭 모드 +110) · `js/ui/inlinetr.js`(`suspend` +15) · `js/ui/reader.js`(`pointerdown` 기록·`isTap`·가림 굴리기 export +25) · `js/ui/original.js`(같은 `isTap` +8) · `index.html`(띠 [×]·[문단 전체], `#selBar`) · `css/reader.css` · i18n 4개(약 9키) |
| **8f-1** | `js/text/vocab.js` · `js/vocab/store.js` · `tests/vocab-8f.test.mjs` · `tests/term-8f.test.mjs` | `js/ai/prompts.js`(term 요청·스키마·검증 +90) · `js/ai/pipeline.js`(`job` 일반화 + `translateTerms` +90) · `js/ai/provider.js`(`TERM_KIND`·`capWarned` 받기 +4) · `js/config.js`(`AI.TERM_KIND`·`VOCAB` 상수) · `js/db.js`(연쇄 삭제에서 term 제외 +5) · `js/settings.js`(`vocab.lastExportAt`) |
| **8f-2** | `js/ui/wordsheet.js` · `tests/wordsheet-8f.test.mjs` | `js/ui/selbar.js`([단어 번역] 켜기) · `js/ui/library.js`(삭제 확인 한 줄) · `index.html`(시트) · `css/reader.css` · i18n 4개(약 16키) |
| **8f-3** | `js/ui/vocab.js` · `tests/vocab-ui-8f.test.mjs` | `js/router.js` · `js/main.js`(+4) · `js/ui/library.js`(상단 [단어장]·카드 메뉴) · `js/ui/wordsheet.js`(링크 켜기) · `index.html`(섹션) · `css/screens.css` · i18n 4개(약 30키) |
| **8c-2** | `js/ui/usage.js` · `tests/usage-8c.test.mjs` | `js/ai/pipeline.js`(`onWarn` +25) · `js/ai/cache.js`(`stats()` +12) · `js/ui/controls.js`(경고 배너 +6) · `js/ui/trband.js`(`capped` 배너 단추 하나) · `js/ui/settings.js`(입구 단추) · `js/main.js`(+3) · `index.html`(자리표시 → 화면) · `css/screens.css` · i18n 4개(약 25키, 자리표시 키 2개 지움) |
| (8f-4 선택) | — | `js/ui/search.js`(아랍 문자 검색어 → `vocabStore` 번역 일치 → 그 `term` 으로 한 번 더 찾기, "단어장에서 바꿈: …" 한 줄) · i18n 1키 |

- **import 방향**(3-2 에 한 줄 더함): `vocab/*` 행은 `search/*` 행과 같다 — `config`·`text/*`·`db`·`hash` 만(`ui/`·`ai/`·`pdf/`·`tts/` 금지). `text/select.js`·`text/vocab.js` 는 순수(16-A grep 대상 — `document`·`window`·`Intl.Segmenter` 직접 참조 금지: 세그먼터는 화면이 함수로 넘긴다). `ai/readalong.js` 는 `ui/` 를 계속 모른다(띠는 `onChange` 로만 안다).
- 새 `js/*.js` 마다 `dev/stamp-importmap.mjs` → `--check` 0(배포 안전장치). DB 버전·`algoVersion`·`SEARCH.VERSION`·`OUTLINE_V`·`PROMPT_VERSION`(번역) 전부 무변. `TERM_PROMPT_VERSION` 1 신설.

##### 6. 호출 — 언제 몇 번

| 동작 | 호출 | 캐시 키 | 사용량 |
|---|---|---|---|
| 멈춤 중 줄 탭(캐시·메모리 적중) | 0 | `translate` | `cacheHits +1` |
| 멈춤 중 줄 탭(미적중) | **문단당 1**(문단 > 6,000자면 나눔) — 같은 문단 다른 줄은 0 | `translate` | `byKind.translate` |
| [문장 번역] | 위와 같다 | 같음 | 같음 |
| [여기서부터 읽기] · 선택 · 시트 열기 · 단어장 보기·고치기·내보내기·가져오기 | 0 | — | — |
| 단어 시트 — 단어장·문장 번역에서 찾음 | 0 | — | — |
| [AI 로 번역] · [이 문맥으로 다시 번역] | 1(낱말 1개) | `term` | `byKind.term` |
| [번역 안 된 것 모두 번역 (n)] | **누를 때 1**(≤ 20개·≤ 6,000자) | `term` | `byKind.term` |
| 사용량 화면 | 0 | — | — |

비용 감각(17절 머리 2): 호출 1회 ≈ 낭독 번역 약 5,900자. 단어 20개 묶음 1회 = 낱말마다 부를 때의 1/20.

##### 7. i18n (4언어 같은 키 — i18n 테스트가 짝을 본다)

8c-1 `tap.close`·`tap.para`·`tap.none`·`sel.bar`(region 이름)·`sel.word`·`sel.sentence`·`sel.readFrom`·`sel.tooLong`(약 8키). 8f-2 `vs.*` 약 16(제목·찾은 길 3종·후보·뜻·저장·AI·번역 없이·다시 번역·문맥 바꾸기·고친 번역 덮어쓰기 확인·안내 한 줄·단어장 링크·같은 언어·너무 김). 8f-3 `vocab.*` 약 30. 8c-2 `usage.*` 약 25 + `ai.capWarn`. ar·fr 새 문구는 `[검토 — Nour·운영자]`. 품사 이름 7개는 UI 언어로.

##### 8. 수용 기준 (16절 형식 — 16-D4 를 나눠 붙이고 17-7-5 를 다듬음)

**8c-1 탭 번역·선택 동작 줄**
- [ ] `[N]` `isTap`: 누름 449ms·이동 9px·누를 때 선택 없음 → 탭 / 450ms 이상·10px 초과·누를 때 선택 있음·지금 선택 있음 → 탭 아님(표 8줄).
- [ ] `[N]` `segsOnLine`·`unitAt`: 한 줄에서 두 문장이 갈리는 픽스처 — 앞 문장 줄 오프셋 → 앞 seg, 뒤 → 뒤 seg, 그 줄 탭 → 두 seg 순서대로. 300자 분할(ranges 없음) → `lineIds` 로. 인용·표 안내만 있는 줄 → 빈 목록.
- [ ] `[N]` `tapGate`: consent → unsupported-lang → same-lang → no-key 순서, `mode:'off'`·`unit:'line'`·`trVoice:false` 여도 ok(effectiveMode 와 다른 점을 표로).
- [ ] `[N]` `requestTap`(가짜 pipeline): 문단 4문장 → `translate` 1회·4항목, 결과가 메모리에(`get(src)` ready). 메모리 ready 2개면 나머지 2만. 같은 문단 두 번 → 두 번째 0회. 8m 대상 언어 같은 문장은 항목에서 빠짐. `retry:true` 가 pipeline 에 전달.
- [ ] `[N]` `speaker.sentenceUnits()`: 문장 모드면 큐와 같다(깊은 비교), 줄 모드면 `buildUnits(…,'sentence', 같은 opts)` 와 같다 — `splitSentences` grep 은 여전히 두 파일(R6).
- [ ] `[D]` 키 없이 멈춘 상태에서 줄 탭 → 띠에 키 없음 한 줄 + 배너 [키 설정](즉시), `fetch` 0건, 콘솔 오류 0(16-D4).
- [ ] `[D]` 멈춘 상태 줄 탭 → 띠에 그 줄 문장 번역, [×] 로 닫힘. 같은 문단 다른 줄 탭 → **요청 0건**. 낭독 동반 번역이 받은 쪽에서는 첫 탭도 0건(16-D4).
- [ ] `[D]` 새로고침 뒤 같은 줄 탭 → 요청 0건, 그날 `usage.cacheHits` 증가(16-D4).
- [ ] `[D]` 흉내 응답 429 → 상태 바 "오늘 무료 한도…" 1회, 자동 재시도 **0건**, 낭독·퀴즈 동작. 500 → 1회 재시도 후 cooldown 안내. `offline` → 안내. 잘린 JSON → 실패 + [다시 시도], 캐시 저장 0(16-D4 — DevTools 대신 요청 가로채기).
- [ ] `[D]` 띠 탭 모드: 유효 모드 `off`(번역 끔)여도 열림·닫히면 자리(`data-tr-band`) 원래대로. `inline` 표시에서 열면 `data-tr-inline` 이 떨어지고 닫으면 붙음, 그동안 `.ra-tr` 블록 수 불변·현재 문장 화면 위치 변화 ≤ 0.5px.
- [ ] `[D]` 낭독 중 [문장 번역] → 띠에 그 문장, 다음 발화 시작 때 낭독 문장으로 돌아감(유효 모드 off 면 닫힘). 낭독 끊김 0.
- [ ] `[D]` 길게 누르기 모사(프로그램 선택 `setBaseAndExtent`) — 낭독 중: 낭독 멈추지 않음·줄 이동 0·선택 동작 줄 보임. 선택을 풀고 탭 → 지금처럼 이동(17-7-5). 선택을 풀려고 누른 탭은 번역도 이동도 아니다.
- [ ] `[D]` 선택 동작 줄: 360×740·412×915·915×412(8e compact) × 4언어 — 단추 48px 이상, 가로 넘침 0, 띠가 켜져 있으면 띠 위, 선택이 줄에 가리지 않음(가리면 굴림). `.ra-tr`·띠 글자 선택에는 안 뜸.
- [ ] `[D]` 탭한 줄이 열린 띠에 가리지 않는다(줄 아래변 ≤ 띠 윗변 − 4px) — 화면 아래쪽 줄 5개.
- [ ] `[D]` 원본 보기 멈춤 중 줄 탭 → 같은 띠. 낭독 중 탭 → 지금처럼 이동.
- [ ] `[D]` 줄 단위 낭독(`tts.unit=line`)에서 멈춤 중 탭 → 문장 번역이 뜬다(8cf-D6).
- 변이: `isTap` 의 "누를 때 선택" 조건 지우기 → 선택 풀기 탭 시험 빨강 · `requestTap` 이 메모리 ready 를 안 거르게 → 0건 시험 빨강 · `suspend` 안 부르기 → inline 시험 빨강 · `sentenceUnits` 를 `splitSentences` 로 → R6 grep 빨강.

**8f-1 단어장 데이터·단어 요청**
- [ ] `[N]` `findInSentenceTr`: "… التهاب المفاصل الروماتويدي (rheumatoid arthritis) …" 에서 `arthritis`·`rheumatoid arthritis` → 괄호 앞 아랍어 후보, 괄호 없는 번역 → null, 대소문자·NFKC 차이 무시, 다른 괄호·`،` 에서 멈춤, `ko`(“류마티스 관절염(rheumatoid arthritis)”)·`fr` 대상 각 1(17-7-5).
- [ ] `[N]` `normalizeTerm`·`expandWord`: 하이픈 결합 낱말 → 결합된 꼴, 앞뒤 구두점 제거, `|` 제거, 6낱말·60자 경계.
- [ ] `[N]` 키: 같은 낱말 + 같은 문맥 두 번 → 호출 1. "a b"+"c" 와 "a"+"b c" → **다른 키**. 묶음 20개 → 호출 1, `i` 짝 어긋남·빈 번역은 그 항목만 빈 채(17-7-5).
- [ ] `[N]` `translateTerms` 가 번역과 **같은 상태 기계**: 429 → exhausted·자동 재시도 0, 5xx → 즉시 1회 후 cooldown, no-key·capped 면 보내지 않음(blocked), `byKind.term` 증가·상한에 포함. `translate()` 의 요청 본문이 일반화 전과 바이트 단위 같다(기존 pipeline 테스트 전부 무변 통과).
- [ ] `[N]` 요청 본문에 사용자 메모·고친 번역이 없다(그 값을 가진 항목으로 요청 → 본문 grep 0). 지시문에 `domain` 따라 "medical term"/"usual word" 줄.
- [ ] `[N]` CSV: BOM 시작, CRLF, 쉼표·따옴표·줄바꿈·아랍어가 든 칸이 왕복 후 같다. `=SUM(1)` 메모 → `'=SUM(1)` → 가져오면 원래대로. `'tis` 는 그대로. Anki 머리 줄 3개·탭 구분(17-7-5).
- [ ] `[N]` `importPlan`: `id` 같고 `updated` 새로우면 바뀜·오래되면 그대로, `id` 없음 → `term`+`target_lang` 일치, 없으면 새 항목. 2MB·5,000줄 초과 → 거절.
- [ ] `[N]` 내보낸 파일에 키 문자열 0건(가짜 키를 저장소에 둔 상태 — 17-7-5).
- [ ] `[N]` (fake-idb) `deleteDocument` 뒤 그 문서의 `kind:'term'` 남고 문장 카드는 지워짐. `findTerm`·중복 저장 → 한 항목.
- 변이: 연쇄 삭제의 `kind` 검사 지우기 · `'w='+term` 대신 `'\n'` 이음 · `checkTerms` 의 `i` 짝 검사 지우기 · CSV `'` 접두 지우기 · `job` 을 번역 기본으로 되돌려 term 요청이 번역 스키마로 나가게.

**8f-2 단어 시트**
- [ ] `[D]` 문장 번역이 캐시에 있는 쪽에서 괄호 용어를 선택 → [단어 번역] → 후보가 칸에 채워지고 "문장 번역에서 찾음", **요청 0건**. [저장] → `cards` 에 `kind:'term'`·`origin:'sentence'`·`contextTr` 사본.
- [ ] `[D]` 캐시에 없음 → [번역 없이 저장] 0건 / [AI 로 번역] 정확히 1건(흉내 응답) → 번역·뜻·품사 표시, 저장하면 `origin:'ai'`. 같은 낱말 + 같은 문맥 다시 → 0건.
- [ ] `[D]` 이미 있는 낱말 → 기존 항목을 보이고 새 항목 0. 고친 항목에 [이 문맥으로 다시 번역] → 먼저 묻는다.
- [ ] `[D]` 하이픈 결합 낱말(줄 끝 `cardio-`) 선택 → `cardiovascular` 로 저장.
- [ ] `[D]` 낭독 중 시트를 열고 저장해도 발화 끊김 0. `capped`·`offline` 에서 [AI 로 번역] → 요청 0·상태 한 줄.
- [ ] `[D]` 서재에서 그 문서 삭제 확인 대화에 "단어장 n개는 남습니다", 지운 뒤 `cards` 에 term 이 남는다(17-7-5).
- [ ] `[D]` 360×740·915×412 × 4언어: 시트 위끝 ≥ 0, [닫기] 보임, 가로 넘침 0, 아랍어 번역 칸 `dir=rtl`. `innerHTML` 사용 0(grep).

**8f-3 단어장 화면·CSV**
- [ ] `[D]` `#/vocab`·`#/vocab/:docId` — 목록·찾기·정렬·책 고르기, 줄 48px 이상, 아랍어 UI 360px 가로 스크롤 0, 원어 칸 `dir=ltr`.
- [ ] `[D]` 편집 → `edited:true`·"마지막 내보내기 뒤 바뀐 항목 1개". 삭제는 페이지 안 확인.
- [ ] `[D]` [번역 안 된 것 모두 번역 (25)] → 요청 **1건**(20개), 단추가 (5) 로. 응답 일부 어긋남 → 그 항목만 빈 채.
- [ ] `[D]` 내보내기 CSV·Anki: 파일 이름·BOM·줄 수(`URL.createObjectURL` 가로채 Blob 읽기). 그 CSV 를 가져오기 → 미리보기 "새 0 · 바뀜 0 · 그대로 n". 한 칸 고친 CSV → "바뀜 1".
- [ ] `[D]` [원문 쪽으로 가기] → 그 쪽·그 줄이 편안 영역 안. 문서가 지워진 항목은 단추 없음·`docTitle` 표시.
- [ ] `[M]` 엑셀(데스크톱)에서 CSV 를 열면 아랍어가 깨지지 않는다(17-7-5).

**8c-2 사용량 화면·80% 경고**
- [ ] `[N]` `usageView`: 호출당 평균·1만 자당(소수 1자리)·`calls 0` 이면 "—"·남은 쪽이 쪽당 글자에 반비례(두 스텁 `readStats`)·`pages < 5` 숨김·월 막대 31칸·적중률·검증 제외 상한(16-D4).
- [ ] `[N]` 80% 경고: 상한 10 · `warnAt` 0.8 → 8번째 호출 뒤 한 번, 9·10번째 없음, 같은 날 새 파이프라인(새로고침)도 없음(`capWarned`), 다음 날 다시. `warnAt` 0·1.5·문자열 → 없음.
- [ ] `[D]` 사용량 화면: "낭독 번역 n회 · m자" 의 n 이 가로챈 요청 수, m 이 요청 본문 `segments[].text` 글자 수 합과 같다(16-D4). 종류별에 번역·낭독 번역·단어가 따로.
- [ ] `[D]` 상한 3으로 두고 낭독 → 3번째 호출 뒤 `capped` — 원문 낭독 계속, 이후 요청 0건(쪽을 넘겨도·탭해도), 안내 1회. 80% 경고 1회(16-D4).
- [ ] `[D]` 냉시작 1회 뒤 20,000자 넘게 연속 낭독(흉내 음성) → 호출당 평균 ≥ 4,000자(16-D4).
- [ ] `[D]` 90일 넘은 `usage` 행(심어 둠)이 화면을 연 뒤 사라진다. 캐시 수·MB 표시, [설정에서 비우기] → 설정 AI 탭.
- [ ] `[D]` 코드·spec 어디에도 무료 티어 한도 숫자가 없다(16-J grep 그대로).
- 변이: 경고의 `capWarned` 검사 지우기 → 새로고침 시험 빨강 · `usageView` 에서 검증 빼기 지우기 · 남은 쪽을 전역 상수 쪽당 글자로.

**모든 Build 공통**: `node --test tests/` 전부 통과(새 시험 포함) · `dev/stamp-importmap.mjs --check` 0 · `grep -rn "splitSentences" js/` 두 파일 · `innerHTML` 새 사용 0 · 콘솔 오류 0 · 무료 티어 숫자 0.

##### 9. headless 시험 방법

- 8d·9b-2 하네스(`lib.mjs` — Edge, 흉내 음성, 흉내 번역)와 같은 꼴. 새 프로필·새 포트, `try { … } finally { await browser.close() }`, 결과는 stdout(JSON), 시간 상한 10분. 8000번 python 정적 서버(띄워 둔 것)를 쓴다.
- **흉내 Gemini**: `page.setRequestInterception(true)` 로 `generativelanguage.googleapis.com` 을 가로챈다 — `OPTIONS` 는 204 + `access-control-allow-origin: *`·`access-control-allow-headers: *`, `POST` 는 요청 본문의 `segments`/`items` 를 읽어 짝이 맞는 JSON(번역 = 운영자 캡처 꼴 아랍어 + 괄호 원어, term = `{i, term, lemma, pos, translation, gloss}`). 429·500·잘린 JSON·`i` 어긋남은 시험별 스위치. 가짜 키(형식만 맞춘 문자열 — 진짜 키 금지). 요청 수·본문 글자는 가로채기에서 센다.
- **선택 모사**: `Selection.setBaseAndExtent(textNode, a, textNode, b)` → `selectionchange` 가 저절로 온다. 길게 누르기 자체(Android 의 `pointercancel`·시스템 메뉴)는 `[M]`.
- **탭 모사**: `pointerdown`·`pointerup` 을 시간·좌표를 달리해 보낸다(`isTap` 문턱).
- 내려받기: `URL.createObjectURL` 을 감싸 Blob 텍스트를 stdout 으로. 가져오기: `input[type=file]` `uploadFile`.
- 실물 PDF 문장은 결과 JSON 에 넣지 않는다(8d 와 같은 규칙).

##### 10. 결정 표 — 권장 (운영자 위임: 권장안으로 진행)

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 8cf-D1 | 나누기 | (가) **다섯 Build: 8c-1 · 8f-1 · 8f-2 · 8f-3 · 8c-2** · (나) 셋: 8c(탭+사용량) · 8f-1(데이터+시트) · 8f-2(화면+CSV) · (다) 둘: 8c · 8f | **(가)** — 각 Build 1.5–3시간(지침 "2–3시간 이내"). (나)·(다)는 한 Build 가 4–6시간이 되고 Review 가 화면 둘을 한 번에 본다 |
| 8cf-D2 | 순서 | (가) **8c-1 → 8f-1 → 8f-2 → 8f-3 → 8c-2** · (나) 8c-1 → 8c-2 → 8f-1 → 8f-2 → 8f-3 | **(가)** — Nour 가 직접 요청한 것(단어장)이 먼저 닿는다. 사용량 화면은 단어 요청(`byKind.term`)이 생긴 뒤에 만들어야 종류가 한 번에 맞는다. 상한 차단(`capped`)은 이미 있어 8c-2 가 늦어도 비용 보호는 그대로. 8c-2 는 다른 것과 파일이 거의 안 겹쳐 앞당겨도 된다 |
| 8cf-D3 | 멈춤(`paused`) 중 줄 탭 | (가) **지금 그대로 — 그 줄로 이동·재생**(번역은 선택 줄 [문장 번역]) · (나) 번역 | **(가)** — 이미 매일 쓰는 동작을 바꾸지 않는다(놀람 0). 6-5 의 "낭독 중" 을 `speaking`·`paused`·`waiting-page` 로 읽는다. 멈춤 중 번역은 길게 눌러 [문장 번역] 한 번 |
| 8cf-D4 | 캐시 없는 줄을 탭하면 | (가) **바로 요청 — 문단 1회(7-2·16-D4 승인 설계 그대로)** · (나) 띠에 [번역] 단추를 먼저 | **(가)** — 승인된 설계 그대로다(탭 = 사용자가 부른 것, 17절 머리 1). 잘못 누름은 `isTap` 문턱(450ms·10px·선택 풀기 탭 제외)이 줄인다. (나)로 바꾸는 것은 비용 모양을 바꾸는 선택이라 **운영자에게 물을 것**(아래 Q1)으로 따로 둔다 |
| 8cf-D5 | inline(문장 아래) 표시에서 탭 번역 자리 | (가) **띠 — 열린 동안 `data-tr-inline` 을 떼고 닫으면 되돌림** · (나) 그 문장 아래 블록 | **(가)** — 7-7-1 그대로, 원본 보기와 같은 장치. (나)는 아래 본문을 밀고 I4 규칙(지금 문장 위 금지)과 따로 놀 규칙을 새로 만든다 |
| 8cf-D6 | 줄 단위 낭독일 때 탭 번역 | (가) **`speaker.sentenceUnits()` — 같은 `buildUnits`·같은 opts 로 문장 단위를 따로 받음** · (나) "문장 단위에서만" 안내 | **(가)** — 8줄, 분할 한 벌 유지(R6), 줄 모드 사용자도 탭 번역을 쓴다. 큐·낭독은 그대로 |
| 8cf-D7 | 단어 요청 경로 | (가) **`sendChunk` 를 `job`(요청 만들기·응답 받기) 주입으로 일반화 — 상태 기계 한 벌** · (나) 단어용 사본 | **(가)** — 429·cooldown·상한·사용량이 두 벌이 되면 한쪽만 고쳐진다(10 라운드 교훈). 번역 요청 바이트 불변 + 기존 테스트 무변이 안전 증거 |
| 8cf-D8 | 단어장 입구 | (가) **서재 상단 [단어장] + 단어 시트 "이 책의 단어장 (n)" + 서재 카드 [⋯]** · (나) 리더 상단바 단추 | **(가)** — 리더 상단바는 412 세로에서 이미 빠듯하다(12-8-1 S20), 8e compact 는 [≡] 뒤로 숨는다. 읽다가 가는 길은 시트 링크 |
| 8cf-D9 | 80% 경고 "1회"의 범위 | (가) **그날 `usage` 행에 `capWarned` 표시 — 하루 한 번(새로고침해도)** · (나) 세션 메모리 · (다) 새 설정 키 | **(가)** — 하루 단위 행이 이미 있다(키·버전 무변). (나)는 새로고침마다 다시 뜬다 |
| 8cf-D10 | "오늘 상한까지 약 n쪽" 의 책 | (가) **마지막으로 연 책(`lastOpenedAt`) — 제목 표시** · (나) `#/usage/:docId` | **(가)** — 라우트·입구 무변. 사용량 화면은 대개 읽던 책에서 온다 |
| 8cf-D11 | 캐시 [비우기] 자리 | (가) **설정 AI 탭 한 곳 — 사용량 화면은 수·MB + [설정에서 비우기]** · (나) 두 곳 | **(가)** — 장치 하나. 15절의 "[비우기]" 는 이동 단추로 채운다 |
| 8cf-D12 | 90일 지난 사용량 행 정리 | (가) **사용량 화면을 열 때** · (나) 앱 시작(15절 원문) | **(가)** — `main.js` 부팅을 건드리지 않는다. 행은 하루 하나라 늦게 지워도 해가 없다 |
| 8cf-D13 | 17-8-9 (나) 아랍어 검색어 → 단어장 대응 | (가) **8f-3 뒤 작은 8f-4(호출 0, 약 1–1.5시간)** · (나) 다음 다듬기 묶음 · (다) 하지 않음 | **(가)** — 17-8-9·19-1-4 N-D1 이 "8f 뒤 붙인다"고 이미 정했다. 질환 이름(«الربو»)은 8g-7 사전 밖이라 이 길뿐이다. 범위를 8f-3 에 넣지 않는다(검색 파일 2,070줄 — Review 분리) |
| 8cf-D14 | `cards` 에 `kind` 인덱스 | (가) **만들지 않음 — 훑기, DB 3 그대로** · (나) 인덱스 + DB 4 | **(가)** — 단어장 크기에서 훑기로 충분, 버전 올림은 배포 안전장치·옛 탭 `VersionError` 위험을 다시 연다 |

**운영자에게 물을 것** (무료 한도·비용·외부 전송·개인정보 — 권장하지 않음)

| # | 무엇 | 지금 설계(승인 범위) | 바꾸면 |
|---|---|---|---|
| Q1 | 캐시 없는 줄 탭의 호출 | 탭 = 바로 요청(문단 1회) — 7-2·16-D4 승인 | 띠에 [번역] 단추를 한 번 더 — 잘못 누른 탭의 비용 0, 대신 매번 두 번 누름. Nour 의 사용량에서 "탭 번역" 이 이상하게 많으면 그때 정한다 |
| Q2 | 단어장 내보내기 파일의 문맥 문장(교과서 원문) | CSV·Anki 에 `context`·`context_translation` 포함(17-7-4 승인) | 문맥을 빼는 선택지·"파일을 남과 공유하지 마세요(교과서 문장 포함)" 한 줄. 파일은 사용자가 직접 기기 밖으로 옮긴다 |
| Q3 | 17-8-9 (라) [AI 로 영어로 바꿔 찾기] | 기본 끔 — 이번에도 넣지 않는다 | 켜면 검색 1회 ≈ 낭독 번역 5,900자분 |

##### 11. 나누기 · 크기 · 시간 `[추정]`

| Build | 크기 | Build | Review | 위험 |
|---|---|---|---|---|
| 8c-1 탭 번역·선택 동작 줄 | 중간 | 2.5h | 1.5h | 중간 — 손짓(탭/선택 경계)·띠 상태 둘(낭독/탭)·inline 전환. 실기기 손짓은 `[M]` |
| 8f-1 단어장 데이터·단어 요청 | 중간 | 2h | 1h | 중간 — pipeline `job` 일반화(번역 바이트 불변으로 지킴) |
| 8f-2 단어 시트 | 중간 | 2–2.5h | 1–1.5h | 낮음~중간 — 화면 하나, 호출 0 길 먼저 |
| 8f-3 단어장 화면·CSV | 중간~큼 | 2.5–3h | 1.5h | 중간 — 화면 둘(목록·편집)·가져오기 미리보기 |
| 8c-2 사용량·80% 경고 | 작음~중간 | 1.5h | 1h | 낮음 |
| (8f-4 선택) 아랍어 검색어 → 단어장 | 작음 | 1h | 0.5h | 낮음 |
| **합(8f-4 제외)** | | **10.5–11.5h** | **6–6.5h** | |

자리: **8e 배포 뒤**(19-1 순서 9b → 8e → 8n → 8g-6 → **8c+8f**). 8c-1 은 8e 와 같은 파일(`index.html`·`reader.css`·`controls.js`·i18n)을 고치므로 8e 와 동시에 Build 하지 않는다.

##### 12. 마지막 실기기 점검 묶음 (8c·8f 몫 — 앱 완성 뒤 한 번에)

- [ ] `[M]` Nour GT 7 Chrome: 본문 낱말 길게 누르기 → 브라우저 선택 + **선택 동작 줄**이 컨트롤 바 위에, 시스템 메뉴(복사·공유)와 겹치지 않는가. 그 순간 탭 번역·줄 이동이 **일어나지 않는가**(`pointerup`/`pointercancel` 순서 — 450ms 문턱).
- [ ] `[M]` 선택 동작 줄 단추를 누르는 순간 선택이 풀려도 동작하는가(스냅숏). 선택 손잡이로 늘리면 줄이 따라 바뀌는가.
- [ ] `[M]` 선택을 풀려고 본문을 탭했을 때 번역 요청이 나가지 않는가.
- [ ] `[M]` 손가락 스크롤 끝의 가벼운 탭이 탭 번역을 잘못 부르는 일이 없는가(하루 써 본 뒤 사용량 화면의 "번역" 수로 — Q1 판단 근거).
- [ ] `[M]` 단어 시트 번역 칸에 아랍어 키보드로 고칠 때 키보드가 칸을 가리지 않는가(세로·가로).
- [ ] `[M]` CSV 내려받기(Android 다운로드 폴더)·엑셀(데스크톱)에서 아랍어·한국어 정상·AnkiDroid 가져오기(머리 줄) — `[가정 — Anki 2.1.55+]`.
- [ ] `[M]` CSV 가져오기 — Android 파일 고르기에서 `.csv` 가 보이는가.
- [ ] `[M]` 실제 Gemini(Nour 키·VPN 켬): 단어 요청 응답이 파싱되는가(gloss 아랍어), 실제 문장 번역 10개에서 "문장 번역에서 찾음" 이 몇 번 맞는가(괄호 습관 `[가정 — 운영자 캡처 10-08]`).
- [ ] `[M]` 가로(8e compact)에서 선택 동작 줄·단어 시트·띠 탭 모드가 화면 안.
- [ ] `[M]` 9b 듣는 중에 길게 눌러 선택 → 듣기가 취소되는가(손이 이긴다).

##### 13. 이번엔 못 함 · 넘길 것

- 단어 카드 **복습**(SRS)은 12단계 — 여기서는 `sm2`·`dueAt` 기본값만 쓴다.
- 9c 백업은 `cards` 를 통째로 담으므로 단어장이 저절로 들어간다(17-7-4) — 9c Plan 에 "term 은 문서 없이도 복원" 한 줄.
- 11a "여기 설명" — 선택 동작 줄에 넷째 단추 자리만 남긴다.
- 원본 보기의 낱말 선택(캔버스) — 넣지 않음(17-7-1).
- 실측: 이번 Plan 은 앱을 돌려 재지 않았다(앱 무변). 화면 수치는 8d·8e 실측을 인용했고, 선택 동작 줄·시트의 높이는 Build 가 재서 위 `[D]` 기준으로 확인한다.
