# Build 보고서 — 7c: 원문 언어를 문서 속성으로

> Build 서브에이전트(B), 2026-10-10. **커밋하지 않았다.** 지침: `medreader-build-7c.md`.

## 0. 먼저 알릴 것: 지침의 파일 범위와 수용 기준이 서로 맞지 않는다 (결정 필요)

16-D1 grep 항목(`pickVoice('en'`, `setAttribute('lang', 'en')`, `'en-US'` 0건)과 "원문 음성 `pickVoice(doc.lang)`"은
**고쳐도 되는 파일 밖**에 걸려 있다. 범위 밖이라 고치지 않았다(CLAUDE.md "지침에 명시된 범위만"). 남은 것:

| 파일 | 줄 | 내용 |
|---|---|---|
| `js/ui/controls.js` | 241·242·243 | `pickVoice('en', …)`, `setVoice('en', v)`, `setDocLang(… : 'en-US')` — **원문 음성을 고르는 유일한 곳** (spec 9-2 치환 목록에도 `ui/controls.js` 가 있다) |
| `js/ui/quiz.js` | 421·521·608 / 874·877 | `setAttribute('lang', 'en')` ×3, `pickVoice('en'`, `'en-US'` — 퀴즈(영어 문제집 형식) 화면 |

그래서 지금 상태는 **본문 `lang`·낭독 큐·카드·추정은 문서 언어를 따르지만, 원문 음성과 `utterance.lang` 은 아직 en** 이다.
나머지 배선은 다 해 두었다 — `controls.js` 에 아래 10줄 남짓만 들어가면 16-D1 의 `[D]` "원문 음성" 항목과 16-C 의 fr 항목이 선다.

### 제안 패치 — `js/ui/controls.js` (적용하지 않았다)

```diff
-import { loadVoices, pickVoice, availability } from '../tts/voices.js';
+import { loadVoices, pickVoice, availability, utteranceLang } from '../tts/voices.js';
 import {
   flowParas, currentPage, goToPageForSpeech, showSpoken, markDone,
-  onLineTap, onPageRender
+  onLineTap, onPageRender, sourceLang
 } from './reader.js';
@@
-  onPageRender(() => { speaker.reload(); attachDebugHook(); });
+  // 7c — 원문 언어가 바뀌었으면(서재 [⋯]·자동 추정) 음성을 먼저 다시 고르고 큐를 간다.
+  onPageRender(() => { syncSourceVoice(); speaker.reload(); attachDebugHook(); });
@@ async function refreshVoices() {
   voices = await loadVoices(synth, TTS.VOICES_TIMEOUT_MS);
-  const have = availability(voices);
-
-  // 원서 언어는 en 고정이다(문서 언어 설정은 뒤 단계).
-  const v = pickVoice('en', voices, settings.get('tts.voice.en'));
-  if (v) speaker.setVoice('en', v);
-  speaker.setDocLang(v && v.lang ? String(v.lang).replace(/_/g, '-') : 'en-US');
-
-  // 6-3 — 영어 음성이 없으면 설치 안내. 세션당 1회, 닫을 수 있다.
-  if (!have.en) notice('reader.tts.noVoice');
+  voicesLang = null;          // 목록이 새로 왔다 — 다시 고른다
+  syncSourceVoice();
+}
+
+/** 7c — 지금 음성을 고른 원문 언어. 같으면 다시 고르지 않는다. */
+let voicesLang = null;
+
+/** 7c · 6-3 — 원문 음성은 문서의 원문 언어로(`pickVoice(doc.lang)`). */
+function syncSourceVoice() {
+  if (!speaker) return;
+  const lang = sourceLang();
+  if (lang === voicesLang) return;
+  voicesLang = lang;
+  const v = pickVoice(lang, voices, settings.get('tts.voice.' + lang));
+  if (v) speaker.setVoice(lang, v);
+  speaker.setDocLang(utteranceLang(lang, v));
+  // 6-3 — 원문 음성이 없으면 설치 안내(세션당 1회). 판정은 out[doc.lang].
+  if (!availability(voices, lang)[lang]) notice('reader.tts.noVoice');
 }
```
그리고 디버그 훅(`attachDebugHook`)에 `docLang: function () { return speaker.getDocLang(); }` 한 줄을 더하면 16-C `[D]` "`utterance.lang` 이 `fr-*`" 를 콘솔에서 볼 수 있다.
`reader.tts.noVoice` 문구는 아직 "영어 음성이 없습니다" 고정이다 — `{lang}` 매개변수화(spec 6-3)는 위 패치와 함께 i18n 4개 파일을 바꿔야 해서 남겼다.
`quiz.js` 는 퀴즈가 영어 문제집 전용(5절)이라 그대로 두는 것이 맞을 수 있다 — **grep 기준에서 `ui/quiz.js` 를 뺄지** 정해 달라.

## 1. 만든 것

| 파일 | 내용 |
|---|---|
| `js/text/lang.js` (새, 순수) | `guessLang` — 글자 계통(한글·가나+한자·한자·아랍 ≥ 30%, 정수 비교) → 라틴이면 기능어 빈도(1,000낱말당, 2배 규칙). 200자 미만·동률·기능어 0 → `en` + score < 0.5. `SUPPORTED_SRC=['en','fr','ko']`, `UNSUPPORTED_LANG='und'`, `GUESS`(30쪽·본문 5쪽·200자/쪽·8,000자). 문서 필드: `docLangOf`·`langSourceOf`(옛 레코드 → `'default'`)·`shouldGuess`(한 번만)·`applyGuess`(**`'user'` 면 같은 레코드 그대로 → 쓰지 않음**)·`applyUserLang`·`collectSample`(제목 문단 제외)·`readyToGuess`. `LanguageDetector` 안 씀 |
| `js/text/segment.js` | `splitSentences(text, {lang})` — "다음 글자가 문장 시작인가" 정규식만 언어별. **en(·없음·모르는 값)은 원래 정규식 글자 그대로**. fr `\p{Lu}`, ko `\p{Lu}`+한글 `[가정]` |
| `js/tts/text.js` | `buildUnits(paras, unit, {lang})` → `splitSentences(…, {lang})`(호출은 여전히 이 파일 한 곳, R6 통과) · `symbolsFor(lang)`(없으면 en 표, 표에 없는 언어는 빈 표) |
| `js/tts/speaker.js` | 언어 전달만: `docLang` 기본값을 `TTS_LANG_REGION.en` 으로, 큐 4곳에 `{lang: langKey(docLang)}`, `langKey` 가 `und` 같은 세 글자 코드를 자르지 않게, `getDocLang()` 추가. 상태 기계·체이닝·세대 무변경 |
| `js/tts/voices.js` | `availability(voices, docLang)` — `out.en` 고정 줄 삭제, UI 언어 ∪ `SUPPORTED_SRC` ∪ docLang. `utteranceLang(lang, voice)` |
| `js/config.js` (TTS 부분만) | `TTS_SYMBOLS` → `{en:{원래 표}, fr:{}, ko:{}}`, `TTS_LANG_REGION={en:'en-US',fr:'fr-FR',ko:'ko-KR'}` (16-D1 grep 의 "언어별 기본 지역 표" 예외) |
| `js/ui/library.js` | 새 문서 `lang:'en', langSource:'default', langGuess:null`. 카드 메타 "원문: Français (자동)"/"원문: 한국어"/"원문: 지원하지 않는 언어". **[⋯]**(48×48, `data-action="more"`, `aria-expanded`) → 패널 "원문 언어"(English/Français/한국어, `aria-pressed`, 48px) — 기존 `#docList` 위임 한 장치. 자동 추정 감시(`watchLangGuess`): `attach()` 의 `prepare()` 뒤 한 번 + 30쪽 이내 `page` 이벤트마다(겹치면 한 번으로 합침), 본문 5쪽(또는 앞 30쪽 전부)이 모이면 한 번 돌고 끝. **쓰기는 `updateDocLang` — 한 트랜잭션 안에서 다시 읽고 `applyGuess`/`applyUserLang` 으로 판단해 쓴다.** 바뀌면 `medreader:doclang` 이벤트 |
| `js/ui/reader.js` | 본문 `article[lang]` = `sourceLang()`(문서 `lang`, `dir="ltr"` 유지). `medreader:doclang` 을 들어 **다시 그리지 않고** `lang` 속성만 고치고 `notifyPage()` → `controls` 의 `speaker.reload()` 로 큐 재생성. 같은 언어면 아무것도 안 함(낭독 중 문장이 처음부터 다시 나오지 않게). `export sourceLang()`(위 패치용) |
| `js/i18n/{en,ar,fr,ko}.js` | 7c 키 6개 × 4(`library.card.srcLang`·`.auto`·`.unsupported`·`library.card.more`·`library.lang.title`·`.hint`). 언어 이름은 기존 `onboarding.lang.*`(자국어 표기) 재사용. fr·ko 도 번역해 넣음 |
| `css/screens.css` | `.doc-more`(늘지 않는 48px), `.doc-lang-panel`·`-choices` — 논리 속성만 |
| `tests/lang.test.mjs` (26) · `tests/srclang-7c.test.mjs` (11) | 아래 |

`extract.js` 는 고치지 않았다 — 추정 시점은 `Extractor` 의 기존 `page` 이벤트로 잡았다. `DB_VERSION` 2 · `algoVersion` · `storeVersion` 그대로(필드 추가뿐). `js/ai/*`·`js/quiz/*`·4절 알고리즘·`KEEP_HYPHEN_*`·`spec.md`·`index.html` 무변경.

## 2. 16-D1 항목별

| 항목 | 결과 |
|---|---|
| `[N]` lang.test: en·fr·ko·zh·ja·ar, 200자 미만·동률 → en+낮은 score | **통과** (G1~G12. 발췌는 직접 지은 2~3문장, CJK·아랍은 200자 넘게 되풀이) |
| `[D]` 가져오면 본문 추출 뒤 `lang`·`langGuess` 가 채워지고 카드에 "(자동)" · [⋯] 로 바꾸면 `'user'`, 이후 추정이 덮지 않음 | **통과** — 브라우저에서 손으로 만든 1쪽 프랑스어 PDF 를 실제 가져오기 경로로 넣음 → 추출 → `lang:'fr', langSource:'auto', langGuess:{fr, 1, latin}`, 리더 `article[lang=fr]`. [⋯]→한국어 → DB `lang:'ko', langSource:'user'`, 메타 "원문: 한국어", 패널 열린 채 `aria-pressed` 갱신. "덮지 않음"은 F3·F8 + 트랜잭션 안 재판단 |
| `[D]` 열린 문서 언어 변경 → `article[lang]`·`utterance.lang`·큐 재생성(새로고침 없이) | **부분** — `article[lang]` en↔fr 이 같은 노드에서 바뀌고 큐 재생성(`__medreader.tts.index()` total 4) 확인. **`utterance.lang` 은 §0 패치 필요** (speaker 쪽은 P1·P3 로 고정) |
| `[D]` grep 0건 | **미충족** — §0 표의 controls.js·quiz.js 만 남음. 내 범위 파일은 0건 |
| `[N]` `splitSentences` 영어 불변 | **통과** — E1: 인자 없음·`{lang:'en'}`·`{}`·모르는 값·`'toString'` 이 **7c 이전 구현 사본**과 14개 지은 문장에서 같다. E2: `buildUnits` 문장·줄 모드 동일 |

브라우저(360×740, 캐시 우회 쿼리): 서재 카드 메타·[⋯]·패널, **아랍어 UI RTL**(`dir=rtl`, "لغة الأصل: Français (تلقائي)" 정상), `scrollWidth = clientWidth`(361) — 가로 스크롤 0, 화면 밖 요소 0, **콘솔 오류 0**. 넣은 가짜 문서 3개·가져온 PDF·`onboarding.done` 은 끝나고 지움(시작 때 13개 스토어 전부 0 → 끝에 전부 0, localStorage·sessionStorage 0). 뷰포트 desktop 복귀.

## 3. 테스트 · 변이

`node --test "apps/medreader/tests/*.test.mjs"` → **803/803 통과** (시작 749 → A 몫 포함 764 → 내 것 37 더해 801 + A 2).

변이(적용 grep 확인 → 실행 → 스크래치패드 `b7c/cur/` 복사본으로 되돌림, `diff -q` 동일 확인):
1. 영어 문장 시작 정규식에 `\p{Lu}` 추가 → **4 빨강**(E1·E3·P2·P3). 기존 749개는 하나도 빨개지지 않았다 — 영어 불변을 지키는 것은 새 대조 테스트뿐이다.
2. `applyGuess` 의 `'user'` 보호 줄 삭제 → **2 빨강**(F3·F8).
3. `guessLang` 의 글자 계통 검사 블록 삭제 → **5 빨강**(G3·G4·G5·G6·G12).

## 4. 한계 · 가정 · 남은 위험

- **(위험) 다른 쓰기의 "읽고-나중에-통째로 쓰기"가 사용자 선택을 되돌릴 수 있다.** 내 쓰기는 한 트랜잭션이지만, `extract.js` `_saveMeta`·`reader.saveLastPage`·`library.openDoc` 은 `db.get` 과 `db.put` 을 **다른 트랜잭션**으로 하고 레코드 전체를 쓴다. 그 사이(수 ms)에 [⋯] 선택이 끼면 옛 `lang`/`langSource` 로 덮인다. 추출 중엔 `_saveMeta` 가 10쪽·2초마다 돈다. 강제 실패 주입으로 재현하진 않았다(범위 밖 파일). 고치려면 `_saveMeta` 등을 "한 트랜잭션 안에서 `extraction` 필드만 합쳐 쓰기"로 — `extract.js` 는 "추정 호출 시점만"이라 손대지 않았다.
- `[가정]` fr·ko 분할: 다음 글자 판정만 넓혔다. 약어 목록은 영어 것(프랑스어 `p. ex.`·`M.`·`env.` 미반영), 한국어 `다.` 뒤 숫자·영문으로 시작하는 문장은 en 규칙과 같다. 실물 측정 전.
- `[가정]` 가나 판정을 "가나 존재" → "가나 있음 **그리고** 한자+가나 ≥ 30%" 로 좁혔다(영어 책에 가나 몇 글자로 낭독 동반 번역이 꺼지지 않게, G11). spec 9-2 와 다르다 — spec 반영 여부 결정 필요.
- `[가정]` "본문 쪽" = 제목이 아닌 문단 글자 ≥ 200자. 앞 30쪽에 그런 쪽이 5개 못 되고 그중 일부가 추출 실패면 추정은 기다리기만 한다(기본 en 유지).
- score 는 보정된 확률이 아니라 근거의 세기(계통 비율 / `1 − 작은 쪽/큰 쪽`).
- `und` 문서의 `article[lang]` 은 `"und"`. 낭독은 en 규칙 분할 + 빈 기호 표.
- 표 안내 발화의 음성(8b 몫)·`ondevice.translate` 의 원문 언어·프롬프트 원문 언어(`js/ai/*`)는 건드리지 않았다.
- `index.html` 133행 근처 **주석**에 "`dir="ltr" lang="en"` 고정" 문구가 남아 있다(동작 아님, 범위 밖이라 둠).
- 스크래치패드 `orig/` 폴더에 처음에 백업을 잘못 복사했다가 `b7c/` 로 옮겼다. `orig/` 에 그 이름의 옛 파일(config.js 등)이 원래 있었다면 덮어썼을 수 있다 — `orig/js/`·`f8a/` 는 건드리지 않았다.

## 추가(2026-10-10) — 오케스트레이터 결정 반영

범위 확장: `js/ui/controls.js`·`reader.tts.noVoice`·`index.html` 주석. 결정 사항: **`js/ui/quiz.js` 는 고치지 않는다**(퀴즈 파서가 영어 문제집 형식 전용 — grep 기준에서 quiz.js 를 빼는 것은 오케스트레이터가 spec 에 적는다). 저장 경합(§4 첫 항목)은 **기록만**(인계 문서 이월 결함 "documents 갱신 경합"과 같은 원인). 가나 판정 축소는 채택(spec 반영은 오케스트레이터).

| 파일 | 바뀐 것 |
|---|---|
| `js/ui/controls.js` | §0 패치 적용: `syncSourceVoice()` — `sourceLang()` → `pickVoice(lang, voices, tts.voice.<lang>)` → `setVoice(lang, v)` → `setDocLang(utteranceLang(lang, v))`. `onPageRender` 에서 **`speaker.reload()` 보다 먼저**, `refreshVoices()` 가 목록을 읽은 뒤에도 부른다. 음성 목록을 아직 안 읽었으면 배너 판정을 미룬다(`voicesLoaded`). `notice(key, tone, params, once)` — 음성 없음은 **언어마다** 세션당 1회, `{lang}` = `onboarding.lang.<lang>`(자국어 이름). `CODES.NO_VOICE` 경로도 같은 문구. 디버그 훅 `__medreader.tts.docLang()` |
| `js/i18n/*.js` | `reader.tts.noVoice` 를 `{lang}` 으로("This device has no voice for {lang}." / "لا يوجد صوت للغة {lang}…" / "Aucune voix pour {lang}…" / "이 기기에 {lang} 음성이 없습니다."). 키 집합 그대로 |
| `index.html` | 리더 주석 — `dir="ltr"` 만 고정, `lang` 은 `documents.lang` 이고 새로고침 없이 따라간다 |
| `tests/srclang-wiring-7c.test.mjs` (새, 3) | W1 16-D1 grep(주석 제외, `ui/quiz.js` 제외, config 는 `'en-US'` 1건만 허용) · W2 controls 배선(`sourceLang` 으로 고름, 음성 먼저·큐 나중) · W3 `noVoice` 4개 언어 `{lang}` + 매개변수 없는 호출 0 |

**확인**
- `node --test "apps/medreader/tests/*.test.mjs"` → **806/806 통과**.
- grep(`pickVoice('en'`·`setAttribute('lang', 'en')`·`'en-US'`, quiz.js 제외) → `js/config.js:349 en: 'en-US'`(언어별 기본 지역 표) 1건뿐 = 기준 0건.
- 변이: controls.js 를 패치 전 복사본으로 되돌림(`syncSourceVoice` 0건 grep 확인) → **3 빨강**(W1·W2·W3) → 패치본으로 복원(`diff -q` 동일).
- 브라우저(모듈 캐시를 `fetch(…, {cache:'reload'})` 로 갱신 후): 가짜 en 문서 리더 → `docLang()` `en-US`, 큐 2 · 원문 언어 fr 로 변경 → `article[lang=fr]`, `docLang()` **`fr-FR`**, 큐 3(É 에서 분할), 배너 "이 기기에 Français 음성이 없습니다…"(이 PC 에 fr 음성 없음) · ko 로 변경 → **`ko-KR`**(ko 음성 있음, 배너 없음). 새로고침 없음, 콘솔 오류 0. 가짜 데이터 삭제(13개 스토어 0, local/sessionStorage 0), 뷰포트 desktop.
- 한계: controls 배선 테스트는 DOM 때문에 **소스 검사**다(동작은 위 브라우저 확인). 음성 없음 배너는 언어마다 세션당 1회라, 같은 세션에서 언어를 여러 번 바꾸면 배너가 그 언어 문구로 갱신된다(main.js 가 같은 키의 배너 문구를 고쳐 씀).
