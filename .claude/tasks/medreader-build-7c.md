# Build 지침 — 7c: 원문 언어를 문서 속성으로

> 너는 **Build 서브에이전트(B)**다. 아래 "고쳐도 되는 파일"만 고친다. **커밋하지 않는다.** 한국어로 쓴다.
> 동시에 다른 Build(A)가 8a 후속을 한다 — A 는 `js/ai/prompts.js`·`pipeline.js`·`provider.js`·`config.js` 의 **`PIPELINE` 블록**·`settings.js`·`i18n` 일부를 고친다. **너는 `js/ai/*` 를 건드리지 마라.** `config.js` 는 TTS 관련 부분만, `i18n` 은 7c 키만 더한다(A 도 키를 더할 수 있으니 파일을 고치기 직전에 다시 읽어라).
> 끝나면 보고서 `.claude/tasks/medreader-build-7c-report.md` 를 쓴다.

## 읽을 것
1. `.claude/tasks/medreader-handoff.md` — "반드시 지킬 것", "알려진 함정", 2026-09-28 이후 절
2. spec: **19절 7c 행**, **16-D1**(합격 기준), 9-2 의 원문 언어 문단(`documents.lang`·`langSource`·`langGuess`, 하드코딩 `'en'` 치환 목록), 12-6(서재 [⋯]), 11-3(본문 `lang = doc.lang`), 6-3(원문 음성 `pickVoice(doc.lang)`), 6-1(`TTS_SYMBOLS` 언어별)
3. 코드: `js/text/segment.js`(`splitSentences`), `js/tts/text.js`·`voices.js`·`speaker.js`(`utt.lang = docLang`), `js/ui/library.js`(`lang: 'en'`), `js/ui/reader.js`(본문 `lang`), `js/pdf/extract.js`(5쪽 추출 시점), `js/db.js`

## 만들 것 (19절 7c 행)
- `js/text/lang.js`(순수): 글자 계통 + 기능어 휴리스틱으로 `en|fr|ko` 지원, `zh|ja|ar` 은 "미지원"으로 판정. 200자 미만·동률은 `en` + 낮은 score. `LanguageDetector` 는 쓰지 않는다.
- `documents.lang`(기본 `'en'`)·`langSource`(`default|auto|user`)·`langGuess`. 본문 5쪽 추출 뒤 추정해 채운다. **`langSource === 'user'` 면 덮어쓰지 않는다.** 필드 추가라 `DB_VERSION` 은 그대로여야 한다(아니면 이유를 보고).
- 서재 카드 메타 "원문: English (자동)" + **[⋯] 메뉴 신설**(원문 언어 바꾸기만). 버튼은 48px, `data-nav`/기존 위임 한 장치.
- 하드코딩 `'en'` 치환: `library.js` 의 `lang: 'en'`, 리더 본문 `lang`, 원문 음성 `pickVoice(doc.lang)`, `utterance.lang`, `TTS_SYMBOLS` 언어별. 열린 문서의 언어를 바꾸면 **새로고침 없이** 본문 `lang`·음성·낭독 큐가 다시 만들어진다.
- `splitSentences(text, {lang})` — **영어 결과는 한 글자도 바뀌지 않아야 한다**(기존 테스트 + 새 대조 테스트). 프랑스어·한국어 규칙은 `[가정]` 수준이면 충분하고 보고서에 한계를 적는다. **분할 한 벌 계약**: `splitSentences` 호출은 여전히 `js/tts/text.js` 한 곳.
- 표 안내 발화가 원서 음성으로 읽히는 문제(spec 6-1 — UI 언어 음성으로)는 **8b 몫**이다. 건드리지 마라.

## 고쳐도 되는 파일
새 `js/text/lang.js`, `js/text/segment.js`(언어 인자만), `js/tts/text.js`·`voices.js`·`speaker.js`(언어 전달만 — 상태 기계·체이닝 변경 금지), `js/ui/library.js`, `js/ui/reader.js`, `js/pdf/extract.js`(추정 호출 시점만), `js/config.js` 의 TTS 부분, `js/i18n/*.js`(7c 키, 네 언어 키 집합 동일), `index.html`·`css/*`(카드 [⋯]), `tests/` 새 테스트.
**건드리지 않는 것:** `js/ai/*`, `js/quiz/*`, 4절 추출 알고리즘(`lines/columns/blocks/hyphen/layout.js`), `KEEP_HYPHEN_*`, `spec.md`.

## 반드시 지킬 것
- 순수 계층(`text/*`)은 브라우저 API 를 모른다. 16-A 검사는 **주석까지** grep 한다 — 주석에 그 낱말을 쓰지 마라.
- CSS 논리 속성만, `innerHTML` 은 정적 템플릿만, 모든 문자열 `textContent`.
- `algoVersion`·`storeVersion` 을 올리지 않는다(추출 결과는 바뀌지 않는다). 올려야 한다면 멈추고 보고.
- 레포에 PDF·원서 문장을 넣지 않는다. `lang.test.mjs` 발췌는 **직접 지은 문장**(언어당 2~3문장).

## 검증
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 749 — A 가 동시에 테스트를 더한다. 실패가 A 파일에서 나면 보고만).
2. 16-D1 항목별, grep 항목 포함(`pickVoice('en'`, `setAttribute('lang', 'en')`, `'en-US'` — config 언어별 표 제외 — 0건).
3. 변이: 영어 분할 결과를 바꾸면 빨개지는가, `langSource==='user'` 보호를 빼면 빨개지는가, 언어 판정의 계통 검사를 빼면. **적용 grep 확인 후** 읽고 스크래치패드 복사본으로 되돌린다(`git checkout`·`restore`·`stash` 금지).
4. 브라우저(`preview_start {name:"blog"}`, 캐시 우회): 서재 카드 [⋯]·메타 줄, 아랍어 UI RTL, 360px 가로 스크롤 0, 콘솔 0. 미리보기 브라우저에 PDF 가 없으면 서재 카드는 IndexedDB 에 가짜 문서 레코드를 넣어 확인하고 끝나면 지워라.
5. 마지막 응답: 만든 것, 16-D1 항목별, 테스트 수, 변이, 한계를 12줄 이내로.
