/* ============================================================
   MedReader — 낭독용 텍스트와 낭독 큐 (spec 6-1 · 6-4)

   **순수 모듈이다.** `speechSynthesis` 도 `document` 도 모른다. 5단계에서
   `node --test` 로 검증할 수 있는 가장 큰 덩어리가 여기다.

   ── 왜 이 파일이 필요한가 ───────────────────────────────
   `span.line.textContent` 를 그대로 음성 엔진에 넣으면 **"cardio 대시"** 가
   읽힌다. 하이픈 결합 줄은 끝의 `-` 를 `span.hy`(`display:none`)로 감췄을
   뿐 텍스트에는 남아 있기 때문이다(12-4). 6-1 은 "하이픈 결합 줄은 다음
   줄과 합쳐 하나의 utterance" 라고 정했고, 그 합치기를 여기서 한다.

   ── 이 모듈이 내는 것 ───────────────────────────────────
     Unit = {
       text:    string,     // 음성 엔진에 그대로 넣는 문자열
       lineIds: string[],   // 이 발화가 걸친 줄(자동 스크롤·줄 탭·쪽 넘김의 계약)
       ranges?: [{id,start,end}],  // ★ 10a — 그 줄 **안에서** 이 발화가 차지한 글자 구간
       paraId:  string|null,
       part:    number,     // 300자 초과로 쪼갠 조각 번호(0부터)
       parts:   number,     // 그 문장이 몇 조각인가
       src:     string,     // ★ 8a — normalizeSpeech 이전의 문장 원문(번역·캐시 키의 입력, 7-8-2)
       seg:     number|null,// ★ 8a — 쪽 안의 문장 번호(0부터). 조각들은 같은 seg. 표 안내·인용은 null
       kind:    string,     // ★ 8a — 문단 kind ('table-notice' 포함)
       cite?:   true,       // ★ 8h-1 — 인용·참고문헌 문장의 모든 조각(문장 모드만). 아니면 **속성 자체가 없다**
       lang?:   string      // ★ 8m — 문서 언어와 다른 글자 체계로 판별된 단위의 말할 언어('ko'·'ar'·'en').
                            //   `scriptSwitch` 를 켰을 때만, 예외인 단위에만 둔다. 아니면 **속성 자체가 없다**
     }
   `part`/`parts` 가 있어야 "쪼개진 동안 하이라이트는 유지"(6-4)를 UI 가 안다.

   ── ★ `[8a]` 분할은 한 벌 (spec 7-8-2) ───────────────────
   문장을 나누는 함수가 두 곳에서 불리면 번역이 한 문장씩 밀린다. 그래서
   **`splitSentences` 를 부르는 곳은 이 파일의 `buildUnits` 하나뿐**이다(R6 — grep).
   번역 입력은 `sentencesOf(buildUnits(paras, 'sentence'))` 에서만 만든다. `sentencesOf`
   는 **다시 나누지 않는다** — `Unit.seg` 로 묶기만 한다(나누면 R2 가 빨개진다 — R5 변이).
   표 안내 문단(`kind = 'table-notice'`)은 `seg` 를 받지 않아 앞뒤 번호를 밀지 않고,
   `sentencesOf` 가 뺀다(R4).

   ── ★ `[수정 2026-09-25 — 10a]` `ranges` (spec 6-5) ─────
   5단계에서 낭독 단위를 줄 → **문장**으로 바꿨는데 하이라이트 단위는 줄로
   남아 있었다. 문장이 줄 중간에서 시작하면 그 줄의 **앞부분까지** 칠해진다
   (`[실기기]` "두 줄·세 줄짜리 블럭"). 고칠 데이터를 새로 만들 필요는 없었다 —
   `spansIn()` 이 줄별 문자 구간을 이미 계산하고 `emit()` 이 버리고 있었을 뿐이다.

   · `start`/`end` 는 **그 줄 텍스트 안의** 오프셋이고, `joinPieces` 가 하이픈을
     뗀 **뒤** 기준이다. 줄 길이로 클램프해 범위를 벗어나지 않는다.
   · `lineIds` 는 **그대로 둔다.** `indexOfLine`·자동 스크롤·쪽 넘김이 전부 그걸 쓴다.
   · **`splitLong` 으로 발화가 쪼개지면 `ranges` 를 붙이지 않는다** —
     `normalizeSpeech`·`splitLong` 이 문자열을 바꿔 오프셋 대응이 깨진다.
     그때 UI 는 지금처럼 줄 단위로 칠한다(틀린 구간을 그리느니 넓게 칠한다).
   ============================================================ */

import { TTS, TTS_SYMBOLS, READALONG, SPEECH_MARKS, SPEECH_BLANK } from '../config.js';
import { splitSentences, endsSentence } from '../text/segment.js';
import { joinPieces, localRange } from '../text/screen.js';
// `[8h-1]` 인용·참고문헌 판별(spec 6-6-2) — 순수 모듈. 문장을 나누지 않는다(나누는 곳은 아래 buildUnits 한 곳).
import { markReferences } from '../text/cite.js';
// `[8b-1]` 번역문 발화 텍스트의 괄호 판정은 화면(bdi 격리)과 **같은 함수**를 쓴다 — 규칙이 두 벌이 되지 않게.
import { ltrRuns } from '../text/bidi.js';
// `[8m — spec 19-1-2 2-2]` 문장별 글자 체계 판별 — 순수 모듈.
import { unitLang } from '../text/lang.js';

/** 7-8-2 — 표 안내 문단의 kind. 번역 입력에서 빠지고 문장 번호를 받지 않는다. */
export const TABLE_NOTICE_KIND = 'table-notice';

/** URL·이메일. 6-1 — "link" 로 바꾼다(주소를 한 글자씩 읽으면 못 듣는다). */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;

function str(v) { return String(v == null ? '' : v); }

// `[8g-1 — spec 17-8-12 U6]` `joinPieces`·`localRange` 는 순수 모듈 `text/screen.js` 로 옮겼다 — 같은 함수 객체를 다시 export 한다.
export { joinPieces, localRange };

/**
 * `[7c — spec 6-1]` 원문 언어의 기호 표. 언어가 없으면 en(지금까지와 같다),
 * 표에 없는 언어(미지원 `und` 등)는 **빈 표** — 영어 낱말을 끼워 넣지 않는다.
 */
export function symbolsFor(lang) {
  if (lang == null || lang === '') return TTS_SYMBOLS.en;
  const k = String(lang);
  return Object.prototype.hasOwnProperty.call(TTS_SYMBOLS, k) ? TTS_SYMBOLS[k] : {};
}

/* ────────────────────────────────────────────────────────
   `[8h-1 — spec 6-6-4 C]` 각주·기호 문자 낭독 정리
   ──────────────────────────────────────────────────────── */

const MARK_SET = new Set(SPEECH_MARKS);
const OPERAND_PREV = /[\p{L}\p{N})\]]/u;
const OPERAND_NEXT = /[\p{L}\p{N}(\[]/u;
const DIGIT_OR_CLOSE = /[\p{N})]/u;
const DIGIT_OR_OPEN = /[\p{N}(]/u;
/** 지운 자리에 남은 "낱말 , 다음" 의 공백(라틴·아랍 구두점). */
const SPACE_BEFORE_MARK_PUNCT = /\s+([,.;:!?،؛؟)\]])/gu;

/**
 * ★ 발화 텍스트에서 각주 기호(∗ * † ‡ §)를 정리한다. **`src`·화면·번역 입력에는 쓰지 않는다**(캐시 키 불변).
 *   피연산자 사이 — 앞 글자가 글자·숫자·닫는 괄호이고 뒤 글자가 글자·숫자·여는 괄호(공백 없이):
 *       "HLA-B∗58:01" "STAR*D" "mg*h/L" — 또는 "숫자 공백 * 공백 숫자"
 *       → `∗`(U+2217) 는 ASCII `*` 로 바꾸고 남긴다(엔진이 "asterisk operator" 라고 읽지 않게). 지우지 않는다 —
 *         대립 유전자 이름이 바뀐다.
 *   그 밖 — 단어 끝 "Practice∗", 줄머리 "∗See chapter", 사이에 낀 "hyper- ∗ sensitivity", 따옴표 뒤 → 지운다.
 * 기호가 없으면 **입력을 그대로** 돌려준다(공백 정리도 하지 않는다 — 8h 이전과 같다).
 * 원문 발화(`normalizeSpeech` 첫 단계)와 번역문 발화(`trSpeechText` 끝 단계)가 함께 쓴다. 언어 무관.
 * @param {string} text
 * @returns {string}
 */
export function speechMarks(text) {
  const s = str(text);
  let any = false;
  for (let i = 0; i < s.length; i++) { if (MARK_SET.has(s[i])) { any = true; break; } }
  if (!any) return s;
  let out = '';
  let removed = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!MARK_SET.has(ch)) { out += ch; continue; }
    const p = i > 0 ? s[i - 1] : '';
    const n = i + 1 < s.length ? s[i + 1] : '';
    const operand = (p !== '' && n !== '' && OPERAND_PREV.test(p) && OPERAND_NEXT.test(n)) ||
      (p === ' ' && n === ' ' && DIGIT_OR_CLOSE.test(s[i - 2] || '') && DIGIT_OR_OPEN.test(s[i + 2] || ''));
    if (operand) { out += ch === '∗' ? '*' : ch; continue; }   // ∗ → *
    out += ' ';
    removed = true;
  }
  if (!removed) return out;
  return out.replace(/\s+/g, ' ').replace(SPACE_BEFORE_MARK_PUNCT, '$1').trim();
}

/* ────────────────────────────────────────────────────────
   `[8o — spec 19-1-3 §6 · 결정 L-D11 (가)]` 빈칸 낭독
   ──────────────────────────────────────────────────────── */

/** 빈칸 꼴 — 조사에서 실제로 센 것만: 하이픈 4개 이상 · 밑줄 3개 이상 · en 대시 3개 이상 · em 대시 2개 이상.
 *  `---`(3개)·`--`·`—` 하나·낱말 속 하이픈(`10-20`, `cardio-`)은 걸리지 않는다. 마침표 줄(목차 점선)은 넣지 않는다. */
const BLANK_RE = /-{4,}|_{3,}|–{3,}|—{2,}/g;
const BLANK_ANY = /-{4,}|_{3,}|–{3,}|—{2,}/;
/** 구분선·표 괘선 줄 — 줄 **전체**가 빈칸 꼴 글자·괘선 글자(`= + |`)·공백뿐. 그 줄의 꼴은 바꾸지 않는다. */
const RULE_LINE_RE = /^[\s\-_–—―=+|]+$/u;

/**
 * 빈칸 낱말 — `SPEECH_BLANK[lang]`. 언어가 없으면 en(`symbolsFor` 와 같은 규칙), **표에 없는 언어는 쉼표 하나**.
 * @param {string} [lang] 그 단위의 말할 언어(`Unit.lang` ‖ 문서 언어)
 * @returns {string}
 */
export function blankWordFor(lang) {
  if (lang == null || lang === '') return SPEECH_BLANK.en;
  const k = String(lang);
  return Object.prototype.hasOwnProperty.call(SPEECH_BLANK, k) ? SPEECH_BLANK[k] : ',';
}

/**
 * ★ 발화 텍스트의 빈칸 꼴을 낱말로 바꾼다. **`src`·화면·번역 입력·검색에는 쓰지 않는다**(캐시 키 불변).
 * `keep` 구간(구분선·괘선 줄 — `emit` 이 줄 단위로 찾는다) 안에 통째로 든 꼴과 URL·이메일 안의 꼴은 그대로 둔다.
 * 꼴이 없거나 하나도 바꾸지 않았으면 **입력을 그대로** 돌려준다(공백 정리도 하지 않는다 — 8o 이전과 같다).
 * @param {string} text
 * @param {string} word 낱말(`blankWordFor`). 비면 쉼표
 * @param {{start:number,end:number}[]} [keep] `text` 좌표의 지킬 구간
 * @returns {string}
 */
export function speechBlanks(text, word, keep) {
  const s = str(text);
  if (!BLANK_ANY.test(s)) return s;
  const w = word == null || word === '' ? ',' : String(word);
  const zones = Array.isArray(keep) ? keep.slice() : [];
  for (const m of s.matchAll(URL_RE)) zones.push({ start: m.index, end: m.index + m[0].length });
  let replaced = false;
  const out = s.replace(BLANK_RE, function (m, off) {
    for (let i = 0; i < zones.length; i++) {
      if (off >= zones[i].start && off + m.length <= zones[i].end) return m;
    }
    replaced = true;
    return ' ' + w + ' ';
  });
  if (!replaced) return s;
  return out.replace(/\s+/g, ' ').replace(SPACE_BEFORE_MARK_PUNCT, '$1').trim();
}

/**
 * 낭독용 정규화. **원서 텍스트를 바꾸지 않는다** — 사본만 바꾼다.
 *   0. `[8o]` 빈칸 꼴 → 언어별 낱말(`speechBlanks` — 원문 좌표가 살아 있을 때 먼저)
 *   0. `[8h-1]` 각주 기호 정리(`speechMarks`)
 *   1. URL·이메일 → "link"
 *   2. `TTS_SYMBOLS` 의 기호 → 낱말 (앞뒤에 공백을 둔다)
 *   3. 공백 정리
 * 연속 대문자 약어(NSAIDs)는 **건드리지 않는다**(6-1).
 * @param {{blank?:string, keep?:{start:number,end:number}[]}} [opts] `[8o]` `blank` = 빈칸 낱말(없으면 en — 기호 표 기본과 같다),
 *   `keep` = 바꾸지 않을 구분선·괘선 줄 구간(`text` 좌표)
 */
export function normalizeSpeech(text, symbols, opts) {
  const table = symbols || TTS_SYMBOLS.en;
  const blank = opts && typeof opts.blank === 'string' ? opts.blank : SPEECH_BLANK.en;
  let s = speechMarks(speechBlanks(str(text), blank, opts && opts.keep)).replace(URL_RE, 'link');
  const keys = Object.keys(table);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (s.indexOf(k) < 0) continue;
    s = s.split(k).join(' ' + table[k] + ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 6-4 — 300자를 넘는 문장은 쉼표·세미콜론에서 쪼갠다. 그 자리가 없으면
 * 공백에서 쪼갠다(끝까지 못 쪼개면 그냥 길게 둔다 — 워치독이 받는다).
 * **경계 문자는 앞 조각에 남긴다**(읽을 때 억양이 자연스럽다).
 */
export function splitLong(text, max, breaks) {
  const limit = Math.max(40, Number(max) || TTS.MAX_UTTER_CHARS);
  const s = str(text).trim();
  if (s.length <= limit) return s ? [s] : [];
  // `[8b-1]` 경계 문자는 주입할 수 있다(번역문은 `،`·`؛` 도 — RA11). 주지 않으면 지금과 같다(`;`·`,`).
  const marks = Array.isArray(breaks) && breaks.length ? breaks : [';', ','];

  const out = [];
  let rest = s;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = -1;
    for (let b = 0; b < marks.length; b++) cut = Math.max(cut, window.lastIndexOf(marks[b]));
    if (cut < limit * 0.4) cut = window.lastIndexOf(' ') - 1;   // 경계가 너무 앞이면 공백에서
    if (cut < 0) break;                                          // 쪼갤 자리가 없다
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out.filter(function (x) { return x.length > 0; });
}

/* ────────────────────────────────────────────────────────
   `[8b-1]` 번역문(`tr`) 발화 텍스트 (6-1 · 운영자 결정 2026-10-08)
   ──────────────────────────────────────────────────────── */

/** 글자(`\p{L}`)가 전부 라틴 문자인가 — 괄호 묶음 안에 대상 언어 글자가 섞였으면 거짓. */
const NON_LATIN_LETTER = /(?![\p{Script=Latin}])\p{L}/u;

/** 앞에 공백이 남으면 안 되는 구두점(라틴·아랍). 괄호를 뺀 자리에서 "낱말 ، 다음" 이 되지 않게. */
const SPACE_BEFORE_PUNCT = /\s+([،؛؟,.;:!?)\]])/gu;

/**
 * ★ 번역문 **발화 텍스트**에서 괄호 속 라틴 문자 묶음을 뺀다. 화면 표시는 그대로 둔다.
 *
 * 운영자 결정(2026-10-08): 아랍어 번역문의 "(C-reactive protein)" 같은 영어 병기를 아랍어 음성이
 * 읽으면 듣기가 깨진다. 판정은 `text/bidi.js` 의 `ltrRuns` 그대로다 — 화면이 `<bdi dir="ltr">` 로
 * 격리하는 **바로 그 괄호 묶음**만 뺀다(규칙이 두 벌이 되지 않게). 더해서 묶음 안의 글자가
 * **전부 라틴**일 때만 뺀다 — 대상 언어 글자가 섞인 괄호는 내용이 있으므로 남긴다.
 * 괄호 밖의 라틴 낱말(`mg/L` 등)은 건드리지 않는다(괄호 병기가 아니다).
 *
 * 빼고 난 자리의 이중 공백·구두점 앞 공백을 정리한다. 순수 함수.
 * 번역문에는 기호 치환(`normalizeSpeech`)을 하지 않는다(6-1). `[8h-1]` 각주 기호 정리(`speechMarks`)만 **끝 단계**에서
 * 한다 — AI 가 원문 기호를 옮겨 적은 경우("…∗")만 걸린다(spec 6-6-4).
 *
 * @param {string} text 번역문(화면에 보이는 그대로)
 * @returns {string} 음성 엔진에 넣을 문자열
 */
export function trSpeechText(text) {
  const runs = ltrRuns(str(text));
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    const paren = r.ltr && r.text.charAt(0) === '(' && r.text.charAt(r.text.length - 1) === ')';
    // 괄호 앞이 공백이면 공백으로(뒤에서 하나로 접힌다), 낱말에 붙어 있었으면 그냥 뺀다("관절염(…)은" → "관절염은").
    if (paren && !NON_LATIN_LETTER.test(r.text)) { out += /\s$/.test(out) || !out ? ' ' : ''; continue; }
    out += r.text;
  }
  return speechMarks(out.replace(/\s+/g, ' ').replace(SPACE_BEFORE_PUNCT, '$1').trim());
}

/**
 * 번역문 발화 조각들 — `trSpeechText` 다음 300자 분할(6-4). 경계에 `،`·`؛` 를 더한다(RA11).
 * @returns {string[]}
 */
export function trSpeechParts(text) {
  return splitLong(trSpeechText(text), TTS.MAX_UTTER_CHARS, READALONG.SPLIT_BREAKS_TR);
}

/** `[8b-1]` 번역문 워치독 시간 — `CHARS_PER_SEC_TR`(가정 10자/초)로 센다(6-2 `speakTr`). */
export function trWatchdogMs(text, rate) {
  const len = str(text).length;
  const r = Number(rate) > 0 ? Number(rate) : 1;
  return ((len / (READALONG.CHARS_PER_SEC_TR * r)) * 1000 + TTS.WATCHDOG_PAD_MS) * TTS.WATCHDOG_FACTOR;
}

/**
 * ★ 낭독 큐를 만든다. 6-1 의 전부가 여기 있다.
 *
 * @param {Array} paras  `reader.flowParas()` — `[{id, kind, lines:[{id,text,hyphen}]}]`
 * @param {'sentence'|'line'} unit
 * @param {{lang?:string, scriptSwitch?:boolean}} [opts] `[7c]` 원문 언어(`documents.lang`). 문장 분할 규칙과
 *   기호 표(`TTS_SYMBOLS`)를 고른다. **없거나 'en' 이면 지금까지와 한 글자도 다르지 않다.**
 *   `[8m]` `scriptSwitch: true` 면 단위마다 글자 체계로 말할 언어를 판별해 예외인 단위에 `lang` 을 둔다
 *   (`unitLangIn` — 한 곳). 주지 않으면(기본 끔) 8m 이전과 같다 — 켜고 끄는 것은 9-3 `tts.scriptSwitch` 를 읽는
 *   호출자(speaker·readalong)의 몫이다.
 * @returns {Unit[]} 읽기 순서
 *
 * `'line'` 모드에서도 **하이픈으로 이어지는 줄들은 한 발화**다(6-1). 그래서
 * "cardio-"/"vascular" 가 두 번 나뉘어 읽히지 않는다.
 * `'sentence'` 모드는 문단을 통째로 이어 붙인 뒤 `splitSentences` 로 나누고,
 * 문장이 걸친 **모든 줄**을 `lineIds` 로 돌려준다(자동 스크롤·쪽 넘김이 쓴다).
 * 하이라이트가 칠할 자리는 `ranges` 가 따로 준다(10a — 줄이 아니라 글자 구간).
 */
export function buildUnits(paras, unit, opts) {
  const list = Array.isArray(paras) ? paras : [];
  const mode = unit === 'line' ? 'line' : 'sentence';
  const lang = opts && typeof opts.lang === 'string' && opts.lang ? opts.lang : 'en';
  const symbols = symbolsFor(lang);
  const sw = !!(opts && opts.scriptSwitch === true);
  const out = [];
  // ★ 8a — 쪽 안의 문장 번호. 실제로 발화가 나온 문장만 번호를 받는다(빈 문장은 건너뛴다).
  const seq = { next: 0 };

  for (let p = 0; p < list.length; p++) {
    const para = list[p] || {};
    const lines = Array.isArray(para.lines) ? para.lines : [];
    if (!lines.length) continue;
    // `[8m]` 물려받기는 **문단 안에서만** — 문단마다 새 상태(본문·인용 meta 가 같은 것을 나눠 쓴다).
    // 표 안내(UI 언어 문장 — speaker 가 UI 언어 음성으로 읽는다)는 판별하지 않는다.
    const ls = sw && para.kind !== TABLE_NOTICE_KIND ? { doc: lang, last: null } : null;
    // `[8o]` `lang` = 문서 언어 — 빈칸 낱말의 기본(단위 예외 `Unit.lang` 이 있으면 그쪽).
    const meta = { kind: para.kind ? String(para.kind) : 'body', seq: seq, symbols: symbols, ls: ls, lang: lang };

    if (mode === 'line') {
      let group = [];
      for (let i = 0; i < lines.length; i++) {
        group.push(lines[i]);
        const hy = lines[i].hyphen || 'none';
        const last = i === lines.length - 1;
        // 하이픈으로 다음 줄과 이어지면 발화를 끊지 않는다.
        if (!last && hy !== 'none') continue;
        emit(out, joinPieces(group), para.id, undefined, undefined, meta);
        group = [];
      }
      if (group.length) emit(out, joinPieces(group), para.id, undefined, undefined, meta);
      continue;
    }

    const joined = joinPieces(lines);
    const sentences = splitSentences(joined.text, { lang: lang });
    if (!sentences.length) { emit(out, joined, para.id, undefined, undefined, meta); continue; }
    // `[8h-1 — spec 6-6-2]` 인용·참고문헌 문장(A1 ∪ A2 ∪ `[8h-2]` A3). 표 안내는 판별하지 않는다. 같은 문단 안에서만 본다
    // — A3 의 "바로 다음 식별자"도 이 문단의 다음 문장만 본다(문단을 넘지 않는다).
    const cites = meta.kind === TABLE_NOTICE_KIND ? null : markReferences(sentences);
    const citeMeta = { kind: meta.kind, seq: seq, symbols: symbols, cite: true, ls: ls, lang: lang };

    // `splitSentences` 는 공백 하나로 정확히 되붙는다(그 함수의 계약). 그래서
    // 누적 길이로 각 문장이 원문의 어느 구간인지 되찾을 수 있다.
    let cursor = 0;
    for (let s = 0; s < sentences.length; s++) {
      const sent = sentences[s];
      const start = joined.text.indexOf(sent, cursor);
      const from = start < 0 ? cursor : start;
      const to = from + sent.length;
      cursor = to + 1;
      // `[8o]` `base` = 문단 전체 글자 — 구분선 줄은 문장 조각이 아니라 **줄 전체**로 판정한다(`ruleZones`).
      emit(out, { text: sent, spans: spansIn(joined.spans, from, to), base: joined.text }, para.id, from, to, cites && cites[s] ? citeMeta : meta);
    }
  }

  return out;
}

/** `[from, to)` 구간에 조금이라도 걸치는 줄들. 빈 줄(start==end)도 포함한다. */
function spansIn(spans, from, to) {
  const out = [];
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    if (sp.start < to && sp.end > from) out.push(sp);
    else if (sp.start === sp.end && sp.start >= from && sp.start <= to) out.push(sp);
  }
  // 어디에도 안 걸리면(계산이 어긋난 병적 입력) 줄을 잃지 않도록 첫 줄에 붙인다.
  return out.length ? out : spans.slice(0, 1);
}

/**
 * `[8o]` 구분선·괘선 줄 — 줄 **전체**가 `RULE_LINE_RE` 인 줄의 구간을 발화 덩어리(`joined.text`) 좌표로.
 * 문장 모드는 `joined.base`(문단 전체)에서 줄을 판정하고 `from` 만큼 당긴다 — 문장이 줄 중간에서 끊겨도
 * "글자 있는 줄의 빈칸"을 구분선으로 잘못 보지 않는다. 줄 모드는 `joined.text` 가 곧 줄 묶음이다.
 * 빈칸 꼴이 없으면 빈 배열(일을 하지 않는다).
 */
function ruleZones(joined, from) {
  if (!BLANK_ANY.test(joined.text)) return [];
  const hasBase = typeof joined.base === 'string';
  const base = hasBase ? joined.base : joined.text;
  const off = hasBase && Number.isFinite(from) ? from : 0;
  const out = [];
  for (let i = 0; i < joined.spans.length; i++) {
    const sp = joined.spans[i];
    const line = base.slice(sp.start, sp.end);
    if (line && RULE_LINE_RE.test(line)) out.push({ start: sp.start - off, end: sp.end - off });
  }
  return out;
}

/**
 * 한 덩어리를 정규화 → 300자 분할 → Unit 들로. 빈 텍스트는 버린다.
 *
 * @param {number} [from] `joined.spans` 와 같은 좌표계의 구간 시작(문장 모드)
 * @param {number} [to]   같은 구간 끝. 주지 않으면 **덩어리 전체**(줄 모드)다.
 * @param {{kind:string, seq:{next:number}, symbols?:Object, cite?:boolean, lang?:string}} [meta] ★ 8a — 문단 kind 와 쪽 안의 문장 번호 계수기
 *   (`[7c]` `symbols` = 원문 언어의 기호 표. 없으면 en 표. `[8h-1]` `cite` = 인용 문장 — 번호를 받지 않는다.
 *   `[8o]` `lang` = 문서 언어 — 빈칸 낱말의 기본)
 */
function emit(out, joined, paraId, from, to, meta) {
  const ids = [];
  for (let i = 0; i < joined.spans.length; i++) ids.push(joined.spans[i].id);

  // ★ 8a — `src` 는 정규화(기호 → 낱말)·300자 분할 **이전**의 문장 원문이다(7-8-2).
  //   문장 모드에서는 `splitSentences` 가 낸 그 문장 = `joinPieces` 결과의 [from, to) 구간.
  const kind = meta && meta.kind ? meta.kind : 'body';
  const src = String(joined.text).replace(/\s+/g, ' ').trim();
  // ★ 8m — 말할 언어 예외. 기호 표도 그 언어 것으로(한국어 문장의 "%"를 영어 낱말로 읽지 않게).
  const ul = meta && meta.ls ? unitLangIn(src, meta.ls) : null;

  // ★ 8o — 빈칸 낱말은 그 단위의 말할 언어(`Unit.lang` ‖ 문서 언어)로. 구분선·괘선 줄은 그대로.
  const blank = blankWordFor(ul || (meta && meta.lang));
  const spoken = normalizeSpeech(joined.text, ul ? symbolsFor(ul) : meta && meta.symbols, { blank: blank, keep: ruleZones(joined, from) });
  if (!spoken) return;
  // ★ 8h-1 — 인용(`cite`)은 표 안내처럼 번호를 받지 않는다 → `sentencesOf`·번역 요청·창·readStats 에서 저절로 빠진다.
  const cite = !!(meta && meta.cite);
  let seg = null;
  if (kind !== TABLE_NOTICE_KIND && !cite && meta && meta.seq) seg = meta.seq.next++;

  const parts = splitLong(spoken, TTS.MAX_UTTER_CHARS);

  // ★ 쪼개진 발화에는 `ranges` 를 붙이지 않는다(6-5). 조각마다 어느 글자까지인지
  //   알 길이 없다 — `normalizeSpeech` 가 이미 문자열을 바꿔 놓았다.
  let ranges = null;
  if (parts.length === 1) {
    const lo = Number.isFinite(from) ? from : -Infinity;
    const hi = Number.isFinite(to) ? to : Infinity;
    ranges = [];
    for (let i = 0; i < joined.spans.length; i++) ranges.push(localRange(joined.spans[i], lo, hi));
  }

  for (let i = 0; i < parts.length; i++) {
    const u = {
      text: parts[i],
      lineIds: ids,
      paraId: paraId == null ? null : String(paraId),
      part: i,
      parts: parts.length,
      src: src,
      seg: seg,
      kind: kind
    };
    if (cite) u.cite = true;      // 아닌 단위에는 속성을 두지 않는다 — 8h 이전 큐와 JSON 이 같다(T-U)
    if (ranges) u.ranges = ranges;
    if (ul) u.lang = ul;          // ★ 8m — 예외인 단위에만(300자 조각은 같은 src 라 같은 lang). 단일 언어 문서 큐 불변(T-L2)
    out.push(u);
  }
}

/**
 * ★ `[8m — spec 19-1-2 2-3]` 단위의 말할 언어를 정하는 **한 곳**. 지금은 단위마다 전환한다.
 * 실기기 전환 간격(spec 19-1-3 §4-3 M7 — Nour 결과 대기)이 1초를 넘으면 문단 묶음으로 바꾸는 자리가 여기다.
 *   짧음(2글자 미만) → 같은 문단 앞 단위의 값을 물려받는다(없으면 문서 언어 — `null`)
 *   섞임·문서 언어와 같음 → `null`(문서 목소리 — 운영자 결정 2026-10-21)
 * @param {string} src
 * @param {{doc:string, last:(string|null)}} ls 문단 상태(문단마다 새로)
 * @returns {string|null}
 */
function unitLangIn(src, ls) {
  const r = unitLang(src, ls.doc);
  if (r.short) return ls.last;
  ls.last = r.lang;
  return r.lang;
}

/**
 * ★ 8a — 번역 입력(spec 7-8-2). `buildUnits(paras, 'sentence')` 결과에서 **문장 하나에 하나씩**.
 *
 * **다시 나누지 않는다.** `Unit.seg` 로 묶을 뿐이다 — 300자로 쪼갠 조각들은 같은 `seg`·같은 `src`
 * 라 항목 하나가 된다(R3). 표 안내(`kind = 'table-notice'`)는 뺀다(R4).
 *
 *   frag: 'head' — 쪽의 마지막 문장이고 `endsSentence(src)` 가 거짓(다음 쪽으로 이어진다)
 *         'tail' — 쪽의 첫 문장이고 첫 글자가 소문자(앞 쪽에서 이어졌다)
 *         null   — 그 밖. 한 문장뿐인 쪽이 둘 다에 해당하면 'head' 가 이긴다.
 *
 * @param {Unit[]} units 한 쪽의 낭독 큐
 * @returns {{seg:number, src:string, paraId:string|null, kind:string, frag:'head'|'tail'|null, lang?:string}[]} seg 오름차순
 *   `[8m]` `lang` 은 그 문장의 `Unit.lang` 이 있을 때만
 */
export function sentencesOf(units) {
  const list = Array.isArray(units) ? units : [];
  const bySeg = new Map();
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u || u.kind === TABLE_NOTICE_KIND || !Number.isInteger(u.seg)) continue;
    if (bySeg.has(u.seg)) continue;                       // 조각들 — 첫 조각이 대표
    const item = { seg: u.seg, src: String(u.src == null ? '' : u.src), paraId: u.paraId == null ? null : u.paraId, kind: u.kind || 'body', frag: null };
    if (typeof u.lang === 'string' && u.lang) item.lang = u.lang;   // ★ 8m — 있을 때만(번역 생략·`src` 항목 — spec 19-1-2 2-4)
    bySeg.set(u.seg, item);
  }
  const out = Array.from(bySeg.values()).sort((a, b) => a.seg - b.seg);
  if (!out.length) return out;
  const first = out[0];
  const last = out[out.length - 1];
  if (/^\p{Ll}/u.test(first.src)) first.frag = 'tail';
  if (!endsSentence(last.src)) last.frag = 'head';
  return out;
}

/**
 * 6-2 워치독 시간. `(len / (14 * rate)) * 1000 + 3000`, 발동은 그 **2배**.
 * 순수 함수 — 테스트가 이 숫자를 고정한다.
 */
export function expectedMs(text, rate) {
  const len = str(text).length;
  const r = Number(rate) > 0 ? Number(rate) : 1;
  return (len / (TTS.CHARS_PER_SEC * r)) * 1000 + TTS.WATCHDOG_PAD_MS;
}

export function watchdogMs(text, rate) {
  return expectedMs(text, rate) * TTS.WATCHDOG_FACTOR;
}

/** 6-1 — 속도는 0.5~2.0, 0.1 단계. 범위 밖·NaN 은 1.0 으로. */
export function clampRate(r) {
  const v = Number(r);
  if (!Number.isFinite(v)) return 1;
  const stepped = Math.round(v / TTS.RATE_STEP) * TTS.RATE_STEP;
  const clamped = Math.min(TTS.RATE_MAX, Math.max(TTS.RATE_MIN, stepped));
  // 0.1 단계의 부동소수 찌꺼기를 턴다(1.7000000000000002 가 화면에 나오지 않도록).
  return Math.round(clamped * 10) / 10;
}

/** 큐에서 `lineId` 가 처음 나오는 자리. 없으면 -1(줄 탭 → 그 줄부터 이동). */
export function indexOfLine(units, lineId) {
  const id = String(lineId);
  for (let i = 0; i < units.length; i++) {
    if (units[i].lineIds.indexOf(id) >= 0) return i;
  }
  return -1;
}

/**
 * `[8h-1 — spec 6-6-2]` 줄 탭 — 그 줄의 발화, 없으면(인용 줄은 큐에서 걸러졌다) **화면 줄 순서로 그 뒤의 첫 발화**.
 * @param {Unit[]} units 지금 큐
 * @param {string} lineId 탭한 줄
 * @param {string[]} order 화면의 낭독 줄 순서(`view.lineOrder()`)
 * @returns {number} 큐 번호. 그 줄 뒤에 발화가 없으면 `units.length`(쪽 끝). 줄 순서에 없는 줄이면 -1.
 */
export function indexAtOrAfterLine(units, lineId, order) {
  const list = Array.isArray(units) ? units : [];
  const direct = indexOfLine(list, lineId);
  if (direct >= 0) return direct;
  const ids = Array.isArray(order) ? order.map(String) : [];
  const at = ids.indexOf(String(lineId));
  if (at < 0) return -1;
  for (let k = at + 1; k < ids.length; k++) {
    const i = indexOfLine(list, ids[k]);
    if (i >= 0) return i;
  }
  return list.length;
}
