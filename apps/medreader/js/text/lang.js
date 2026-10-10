/* ============================================================
   MedReader — 원문 언어 추정과 문서의 언어 필드 (spec 9-2 · 19절 7c)

   **순수 모듈이다.** 브라우저 전역도 저장소도 모른다. 값을 받아 값을 낸다.
   저장(트랜잭션)과 화면은 `ui/library.js` 가 한다.

   ── 왜 휴리스틱 하나인가 ────────────────────────────────
   온디바이스 언어 감지 API 는 쓰지 않는다(Android Chrome 미지원 `[가정]`).
   지원 원문은 en·fr·ko 셋뿐이고 이 셋은 **글자 계통 + 기능어 빈도**로 충분히
   갈린다. 경로가 둘이면 기기마다 결과가 달라진다 — 하나로 둔다.

   ── 판정 순서 (spec 9-2) ────────────────────────────────
     1. 글자 계통 — 글자(\p{L}) 중 한글 ≥ 30% → ko
                    가나가 있고 한자+가나 ≥ 30% → ja (미지원)
                    한자 ≥ 30% → zh (미지원) · 아랍 문자 ≥ 30% → ar (미지원)
     2. 라틴이면 기능어 빈도(낱말 1,000개당) — en 묶음 vs fr 묶음.
        큰 쪽이 작은 쪽의 2배 이상이면 그 언어, 아니면 en + 낮은 score.
     · 200자 미만이면 판단하지 않는다 — en + score 0.

   `[가정]` "가나 존재 → ja" 를 "가나가 있고 한자+가나 ≥ 30%" 로 좁혔다.
   영어 본문에 가나 한 글자(그림 설명 등)가 섞였다고 책 전체를 미지원으로
   돌리면 낭독 동반 번역이 꺼진다 — 틀린 쪽의 비용이 훨씬 크다.

   ── score ───────────────────────────────────────────────
   0~1 의 **근거의 세기**다(보정된 확률이 아니다).
     · 글자 계통 판정: 그 계통의 비율
     · 기능어 판정: `1 − 작은 쪽 / 큰 쪽` — 2배 규칙을 넘으면 늘 ≥ 0.5
     · 짧음·동률·기능어 없음: < 0.5 (`LOW_SCORE` 미만)
   ============================================================ */

/** spec 9-2 — 고를 수 있는 원문 언어. `en` 은 필수. 순서가 서재 [⋯] 의 순서다. */
export const SUPPORTED_SRC = Object.freeze(['en', 'fr', 'ko']);

/** 미지원 문자 계통을 본 문서의 `lang`. BCP 47 의 "정해지지 않음". */
export const UNSUPPORTED_LANG = 'und';

/** 이 값 미만의 score 는 "확신 없음"이다(짧음·동률). */
export const LOW_SCORE = 0.5;

/** `langSource` 가 가질 수 있는 값. 옛 레코드(필드 없음)는 `'default'` 로 읽는다. */
export const LANG_SOURCES = Object.freeze(['default', 'auto', 'user']);

/** spec 9-2 — 추정을 언제·얼마나 읽고 돌리는가. */
export const GUESS = Object.freeze({
  /* 앞 30쪽 안에서만 모은다 — 표지·차례 뒤 본문이 시작되는 범위. */
  MAX_PAGE: 30,
  /* 본문 쪽이 이만큼 모이면 한 번 돈다. */
  MIN_BODY_PAGES: 5,
  /* 본문 쪽 판정 — 제목이 아닌 문단 글자가 이만큼은 있어야 한다 `[가정]`. */
  MIN_PAGE_CHARS: 200,
  /* 표본 상한. 넘으면 자른다. */
  MAX_CHARS: 8000,
  /* 이보다 짧으면 판단하지 않는다(spec 16-D1). */
  MIN_CHARS: 200,
  /* 글자 계통 임계 — 분수로 둔다(0.3 은 이진 부동소수에 정확히 담기지 않는다). */
  SCRIPT_NUM: 3,
  SCRIPT_DEN: 10,
  /* 기능어 — 큰 쪽이 작은 쪽의 이 배수 이상이어야 그 언어다. */
  WORD_FACTOR: 2
});

/* spec 9-2 의 기능어 묶음. 소문자로만 비교한다. */
const FUNCTION_WORDS = Object.freeze({
  en: new Set(['the', 'and', 'of', 'to', 'is', 'in', 'with', 'for']),
  fr: new Set(['le', 'la', 'les', 'des', 'est', 'et', 'une', 'du', 'pour', 'dans'])
});

const RE_LETTER = /\p{L}/u;
const RE_HANGUL = /\p{Script=Hangul}/u;
const RE_KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const RE_HAN = /\p{Script=Han}/u;
const RE_ARABIC = /\p{Script=Arabic}/u;
const RE_LATIN = /\p{Script=Latin}/u;
const RE_WORD = /\p{L}+/gu;

function str(v) { return String(v == null ? '' : v); }

/** 정수 비교로 "비율 ≥ num/den" 을 판정한다(부동소수 경계 흔들림 없음). */
function atLeast(part, whole, num, den) {
  return whole > 0 && part * den >= whole * num;
}

function round3(x) { return Math.round(x * 1000) / 1000; }

/**
 * 글자 계통별 개수. 글자가 아닌 것(숫자·기호·공백)은 세지 않는다.
 * @returns {{letters:number, hangul:number, kana:number, han:number, arabic:number, latin:number}}
 */
export function scriptCounts(text) {
  const c = { letters: 0, hangul: 0, kana: 0, han: 0, arabic: 0, latin: 0 };
  for (const ch of str(text)) {
    if (!RE_LETTER.test(ch)) continue;
    c.letters++;
    if (RE_HANGUL.test(ch)) c.hangul++;
    else if (RE_KANA.test(ch)) c.kana++;
    else if (RE_HAN.test(ch)) c.han++;
    else if (RE_ARABIC.test(ch)) c.arabic++;
    else if (RE_LATIN.test(ch)) c.latin++;
  }
  return c;
}

/**
 * 기능어 빈도 — 낱말 1,000개당.
 * @returns {{words:number, en:number, fr:number}}
 */
export function functionWordRates(text) {
  const words = str(text).toLowerCase().match(RE_WORD) || [];
  let en = 0;
  let fr = 0;
  for (let i = 0; i < words.length; i++) {
    if (FUNCTION_WORDS.en.has(words[i])) en++;
    if (FUNCTION_WORDS.fr.has(words[i])) fr++;
  }
  const n = words.length;
  return { words: n, en: n ? (en * 1000) / n : 0, fr: n ? (fr * 1000) / n : 0 };
}

/** 가장 많은 계통의 이름 — `langGuess.script` 에 남는다(사람이 읽는 기록). */
function dominantScript(c) {
  const order = ['latin', 'hangul', 'han', 'kana', 'arabic'];
  let best = 'none';
  let max = 0;
  for (let i = 0; i < order.length; i++) {
    if (c[order[i]] > max) { max = c[order[i]]; best = order[i]; }
  }
  return best;
}

/**
 * ★ spec 9-2 `guessLang(text) → {lang, score, script}`.
 *
 * `lang` 은 `en|fr|ko` 또는 미지원 `zh|ja|ar`. 미지원을 `'und'` 로 바꾸는 일은
 * `langFromGuess` 가 한다 — 추정 기록(`langGuess`)에는 본 그대로 남긴다.
 */
export function guessLang(text) {
  const t = str(text).replace(/\s+/g, ' ').trim();
  const c = scriptCounts(t);
  const script = dominantScript(c);
  const G = GUESS;

  if (t.length < G.MIN_CHARS) {
    // 짧으면 판단하지 않는다(16-D1) — 기본 en, score 0. 계통 기록은 남긴다.
    return { lang: 'en', score: 0, script: script };
  }

  // 1. 글자 계통.
  let lang = null;
  let ratio = 0;
  if (atLeast(c.hangul, c.letters, G.SCRIPT_NUM, G.SCRIPT_DEN)) {
    lang = 'ko'; ratio = c.hangul / c.letters;
  } else if (c.kana > 0 && atLeast(c.kana + c.han, c.letters, G.SCRIPT_NUM, G.SCRIPT_DEN)) {
    lang = 'ja'; ratio = (c.kana + c.han) / c.letters;
  } else if (atLeast(c.han, c.letters, G.SCRIPT_NUM, G.SCRIPT_DEN)) {
    lang = 'zh'; ratio = c.han / c.letters;
  } else if (atLeast(c.arabic, c.letters, G.SCRIPT_NUM, G.SCRIPT_DEN)) {
    lang = 'ar'; ratio = c.arabic / c.letters;
  }

  if (lang) return { lang: lang, score: round3(ratio), script: script };

  // 2. 라틴(또는 그 밖) — 기능어.
  const r = functionWordRates(t);
  const big = Math.max(r.en, r.fr);
  const small = Math.min(r.en, r.fr);
  if (big === 0) return { lang: 'en', score: 0, script: script };
  const score = round3(1 - small / big);
  if (big >= small * G.WORD_FACTOR) {
    return { lang: r.fr > r.en ? 'fr' : 'en', score: score, script: script };
  }
  // 동률 근처 — 기본 en, score 는 2배 규칙 미달이라 저절로 < 0.5 다.
  return { lang: 'en', score: score, script: script };
}

/** 추정 결과 → 문서의 `lang`. 지원 밖이면 `'und'`. */
export function langFromGuess(guess) {
  const l = guess && guess.lang;
  return SUPPORTED_SRC.indexOf(l) >= 0 ? l : UNSUPPORTED_LANG;
}

/** 레코드의 원문 언어. 없거나 이상하면 `'en'`(9-2 기본값). */
export function docLangOf(rec) {
  const l = rec && rec.lang;
  if (typeof l !== 'string' || !l) return 'en';
  return l;
}

/** 레코드의 `langSource`. 옛 레코드(필드 없음)는 `'default'`(9-2). */
export function langSourceOf(rec) {
  const s = rec && rec.langSource;
  return LANG_SOURCES.indexOf(s) >= 0 ? s : 'default';
}

/**
 * 자동 추정을 돌려야 하는가 — **한 번만** 돈다(spec 9-2).
 * 사용자가 고른 문서와 이미 추정한 문서는 다시 돌지 않는다.
 */
export function shouldGuess(rec) {
  if (!rec) return false;
  if (langSourceOf(rec) === 'user') return false;
  return !(rec.langGuess && typeof rec.langGuess === 'object');
}

/**
 * ★ 추정 결과를 레코드에 합친다. **`langSource === 'user'` 면 손대지 않는다.**
 * 원본을 바꾸지 않고 새 객체를 돌려준다.
 *
 * @returns {{changed:boolean, rec:Object}} `changed` 는 `lang` 이 실제로 바뀌었는가
 */
export function applyGuess(rec, guess) {
  if (!rec) return { changed: false, rec: rec };
  if (langSourceOf(rec) === 'user') return { changed: false, rec: rec };
  const g = guess || { lang: 'en', score: 0, script: 'none' };
  const next = Object.assign({}, rec);
  const before = docLangOf(rec);
  next.lang = langFromGuess(g);
  next.langSource = 'auto';
  next.langGuess = { lang: str(g.lang), score: Number(g.score) || 0, script: str(g.script) };
  return { changed: next.lang !== before, rec: next };
}

/**
 * 사용자가 [⋯] 에서 고른 원문 언어. 지원 밖 값은 받지 않는다(`null`).
 * @returns {{changed:boolean, rec:Object}|null}
 */
export function applyUserLang(rec, lang) {
  if (!rec || SUPPORTED_SRC.indexOf(lang) < 0) return null;
  const next = Object.assign({}, rec);
  const before = docLangOf(rec);
  next.lang = lang;
  next.langSource = 'user';
  return { changed: lang !== before, rec: next };
}

/**
 * 추정 표본 모으기. 쪽들의 문단에서 **제목이 아닌** 글자를 쪽 순서대로 잇는다.
 *
 * @param {{pageNo:number, paragraphs:{kind:string, text:string}[]}[]} pages
 * @returns {{text:string, bodyPages:number}} `bodyPages` = 글자가 `MIN_PAGE_CHARS` 이상인 쪽 수
 */
export function collectSample(pages) {
  const list = (Array.isArray(pages) ? pages : [])
    .filter((p) => p && Number(p.pageNo) >= 1 && Number(p.pageNo) <= GUESS.MAX_PAGE)
    .slice()
    .sort((a, b) => Number(a.pageNo) - Number(b.pageNo));
  let text = '';
  let bodyPages = 0;
  for (let i = 0; i < list.length; i++) {
    const paras = Array.isArray(list[i].paragraphs) ? list[i].paragraphs : [];
    let page = '';
    for (let k = 0; k < paras.length; k++) {
      const p = paras[k] || {};
      if (p.kind === 'heading') continue;
      const s = str(p.text).replace(/\s+/g, ' ').trim();
      if (s) page += (page ? ' ' : '') + s;
    }
    if (page.length >= GUESS.MIN_PAGE_CHARS) bodyPages++;
    if (page && text.length < GUESS.MAX_CHARS) text += (text ? ' ' : '') + page;
  }
  if (text.length > GUESS.MAX_CHARS) text = text.slice(0, GUESS.MAX_CHARS);
  return { text: text, bodyPages: bodyPages };
}

/**
 * 지금 모은 것으로 추정을 돌려도 되는가.
 * 본문 쪽이 5쪽 모였거나, 앞 30쪽(쪽수가 적으면 전부)이 다 모였으면 돈다 —
 * 짧은 문서가 영영 추정되지 않는 일을 막는다.
 */
export function readyToGuess(bodyPages, pagesSeen, pageCount) {
  if (bodyPages >= GUESS.MIN_BODY_PAGES) return true;
  const n = Math.floor(Number(pageCount)) || 0;
  const need = Math.min(GUESS.MAX_PAGE, n);
  return need > 0 && pagesSeen >= need;
}
