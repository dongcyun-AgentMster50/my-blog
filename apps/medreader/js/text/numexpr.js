/* ============================================================
   MedReader — 숫자 표현 덩어리(한 벌) — 15-2d `ai/grounding.js` 에서 옮김 (16-1R 중간-1 · 16-2)

   ── 순수 계층이다(3-1 · 3-2 · 16-A grep 대상) ──────────────
   아무것도 import 하지 않는다. 브라우저 전역·시계·난수를 모른다.

   ── 쓰는 곳 ─────────────────────────────────────────────
     · `ai/grounding.js`(15 근거 인용의 낱말 경계) — `numberSpans(text)` 기본 갈래. 옮기기 전과 **같은 결과**(15 하네스 바이트 같음).
     · `text/diagram.js`(16 개념도 라벨 숫자 판정) — `numberChunks(text)` = `wide` 갈래 덩어리의 비교 꼴(`chunkKey`).
       라벨 안 덩어리 **각각이** 보낸 개요 글의 어떤 덩어리와 같아야 한다(범위·비율·×·지수·± 의 한쪽 끝만 남김,
       비교 기호 뒤집힘 `≤`→`≥`·`<`→`>` 모두 버림 — 16-1R 중간-1).
   ============================================================ */

const WS = /\s/u;
const FMT = /\p{Cf}/u;
const ND = /\p{Nd}/u;
const LETTER = /\p{L}/u;
const NUM_SEP = /^[.,\u066B\u066C]$/u;                                    // 붙은 소수점·천 단위 `.`·`,`·아랍 소수점·아랍 천 단위
const NUM_JOIN = /^[-:/^x~\u00D7\u2013\u2014\u2212\uFF5E\u301C]$/u;      // 15-2d — 수 사이 이음(양옆 공백 한 칸까지) `3–5`·`10 – 20`·`1:1000`·`1.5 × 10^9` · 15-2e `3~5`·전각 물결
const THIN_SEP = /^[\u00A0\u2009\u202F]$/u;                                // 15-2e — 프랑스어 천 단위 사이(NBSP·얇은 공백·좁은 NBSP — 보통 공백은 아님)
const EXP_SIGN = /^[-+\u2212]$/u;                                           // 15-2e — `^` 바로 뒤 지수 부호 `10^-6`
const SUP_MINUS = /^\u207B$/u;                                              // 15-2e — 위첨자 빼기 `10⁻⁹`
const SUP = /^[\u00B2\u00B3\u00B9\u2070\u2074-\u2079]$/u;                // 15-2d — 수에 붙은 위첨자 숫자 `10⁹`
const SIGN = /^[-+<>~\u2212\u2013\u2014\u00B1\u2264\u2265\u2248\uFF5E\u301C]$/u;   // 수 앞 부호·비교(공백 한 칸까지) `−2.5`·`–2.5`·`< 3.0`·`≥ 75`·`≈5`
const UNIT = /^[%\u2030\u00B0\u066A]$/u;                                  // 수 뒤 단위 기호(공백 한 칸까지) `%`·`‰`·`°`·`٪`
const CMP = /^[<>~\u00B1\u2264\u2265\u2248\uFF5E\u301C]$/u;               // 16 `wide` — 글자 바로 뒤에서도 붙는 비교 기호(대시·`+` 는 아님 — `IL-6`)

/**
 * 숫자 표현 덩어리(15-2d — 15-2bR #1 · 15-2cR #1–#3 을 한 규칙으로)의 원래 [시작, 끝) 목록. 덩어리 =
 *   수(`\p{Nd}` + 붙은 위첨자 숫자)들이 이음 기호로 이어진 것 —
 *     · `.`·`,`·`٫`·`٬` 는 **붙어서만**(`7.5`·`1,500` — 띄우면 문장 끝·나열 `…was 5. 10 patients`·`5, 10 and 20` 이라 잇지 않는다)
 *     · `:`·`/`·`^`·`×`·`x`·대시(`-`·`–`·`—`·`−`)는 양옆 공백 **한 칸까지**(`10 – 20`·`1 : 500`·`1.5 × 10^9`·`4 x 10^9`)
 *   + 앞쪽 부호·비교 기호(`SIGN`, 공백 한 칸까지, 그 기호 바로 앞이 글자가 아닐 때 — `pH<7.1`·`ward—5` 는 붙이지 않음)
 *   + 뒤쪽 단위 기호(`UNIT`, 공백 한 칸까지 — `30%`·`30 %`·`39.2°`). 단위 낱말(`mg`·`L`·`C`)은 넣지 않는다(낱말 경계 규칙이 맡음).
 * 서식 글자(`\p{Cf}`)는 건너뛰고 본다. 한 문단을 여러 번 보므로 마지막 글 하나를 기억한다.
 *
 * `opts.wide`(16 개념도 라벨 판정 갈래 — 15 기본 갈래는 그대로):
 *   · 비교 기호(`CMP` — `<`·`>`·`≤`·`≥`·`±`·`≈`·`~`)는 글자 바로 뒤에서도 붙인다(`나트륨<135`·`pH<7.2`).
 *   · 앞쪽 부호를 **두 개까지**(공백 한 칸씩) 붙인다(`≤ −2.5`). 앞 덩어리에 든 글자는 넘보지 않는다.
 * @param {string} text
 * @param {{wide?:boolean}} [opts]
 * @returns {number[][]} `[[시작, 끝), …]`(UTF-16 오프셋)
 */
let spanMemo = { text: null, wide: false, spans: [] };
export function numberSpans(text, opts) {
  const wide = !!(opts && opts.wide);
  if (spanMemo.text === text && spanMemo.wide === wide) return spanMemo.spans;
  const cs = [];
  for (let k = 0; k < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(k));
    if (!FMT.test(ch)) cs.push({ ch: ch, s: k, e: k + ch.length });
    k += ch.length;
  }
  const n = cs.length;
  const dig = (j) => j >= 0 && j < n && (ND.test(cs[j].ch) || SUP.test(cs[j].ch));
  const sp = (j) => j >= 0 && j < n && WS.test(cs[j].ch);
  const nd = (j) => j >= 0 && j < n && ND.test(cs[j].ch);
  const three = (j) => nd(j) && nd(j + 1) && nd(j + 2) && !dig(j + 3);
  const spans = [];
  let prevLast = -1;
  let j = 0;
  while (j < n) {
    if (!dig(j)) { j++; continue; }
    const first = j;
    let k = j;
    for (;;) {
      while (dig(k)) k++;
      if (k < n && NUM_SEP.test(cs[k].ch) && dig(k + 1)) { k++; continue; }   // 붙은 소수점·천 단위
      if (k < n && THIN_SEP.test(cs[k].ch) && three(k + 1)) { k++; continue; } // 15-2e 프랑스어 천 단위(NBSP류 + 정확히 세 자리)
      if (k < n && SUP_MINUS.test(cs[k].ch) && dig(k + 1)) { k++; continue; }  // 15-2e 위첨자 빼기 지수
      if (k + 1 < n && cs[k].ch === '^' && EXP_SIGN.test(cs[k + 1].ch) && dig(k + 2)) { k += 2; continue; }   // 15-2e `^-6`
      let p = k;
      if (sp(p)) p++;
      if (p < n && NUM_JOIN.test(cs[p].ch)) {
        let q = p + 1;
        if (sp(q)) q++;
        if (dig(q)) { k = q; continue; }
      }
      break;
    }
    const last = k - 1;
    let a = first;
    let p = first - 1;
    if (sp(p)) p--;
    if (p >= 0 && SIGN.test(cs[p].ch) && !(p > 0 && LETTER.test(cs[p - 1].ch))) a = p;
    else if (wide && p > prevLast && CMP.test(cs[p].ch)) a = p;                 // 16 wide — 글자 뒤 비교 기호
    if (wide && a < first) {                                                      // 16 wide — 둘째 부호(`≤ −2.5`)
      let r = a - 1;
      if (sp(r)) r--;
      if (r > prevLast && SIGN.test(cs[r].ch) && (CMP.test(cs[r].ch) || !(r > 0 && LETTER.test(cs[r - 1].ch)))) a = r;
    }
    let z = last;
    let q = last + 1;
    if (sp(q)) q++;
    if (q < n && UNIT.test(cs[q].ch)) z = q;
    spans.push([cs[a].s, cs[z].e]);
    prevLast = z;
    j = last + 1;
  }
  spanMemo = { text: text, wide: wide, spans: spans };
  return spans;
}

/** 이 코드포인트가 속한 10자리 숫자 묶음 안에서의 값(0–9) — `\p{Nd}` 는 0–9 가 이어진 묶음으로만 온다. */
function digitValue(ch) {
  const c = ch.codePointAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  let z = c;
  while (z > 0 && c - z < 60 && ND.test(String.fromCodePoint(z - 1))) z--;
  return (c - z) % 10;
}

const SUP_VAL = { '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3', '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9', '\u207B': '-' };
const DASH = /^[\u2010-\u2015\u2212]$/u;
const WAVE = /^[\u2248\uFF5E\u301C]$/u;

/**
 * 덩어리 비교 꼴(15 와 같은 정규화 결) — 글자 그대로 보되 같은 표기만 접는다:
 *   공백·NBSP·서식 글자 지움 · 모든 `\p{Nd}` → 서방 숫자(아랍-인도 `٣٠` = `30`) · 위첨자 지수 → `^`(`10⁹` = `10^9`, `10⁻⁶` = `10^-6`) ·
 *   대시·빼기 → `-` · `≈`·`～`·`〜` → `~` · `٪` → `%` · `٫` → `.` · `٬` → `,` · `x` → `×` · 천 단위 쉼표(세 자리 앞) 지움.
 * 부호·비교 기호·단위 기호·이음 기호는 그대로 남는다(`<135` ≠ `>135` ≠ `135`, `3-5` ≠ `5`).
 */
export function chunkKey(s) {
  let out = '';
  let sup = false;
  for (const ch of String(s == null ? '' : s)) {
    if (WS.test(ch) || FMT.test(ch)) continue;
    if (SUP_VAL[ch] !== undefined) { if (!sup) out += '^'; sup = true; out += SUP_VAL[ch]; continue; }
    sup = false;
    if (ND.test(ch)) out += String(digitValue(ch));
    else if (DASH.test(ch)) out += '-';
    else if (WAVE.test(ch)) out += '~';
    else if (ch === '\u066A') out += '%';
    else if (ch === '\u066B') out += '.';
    else if (ch === '\u066C') out += ',';
    else if (ch === 'x') out += '\u00D7';
    else out += ch;
  }
  return out.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
}

/**
 * 글의 숫자 덩어리(`wide` 갈래) 비교 꼴 목록 — 16 개념도 라벨 판정. 같은 글 → 같은 목록.
 * @param {string} text
 * @returns {string[]}
 */
export function numberChunks(text) {
  const t = String(text == null ? '' : text);
  return numberSpans(t, { wide: true }).map((x) => chunkKey(t.slice(x[0], x[1])));
}

/* ── 16-2b(16-2R 중간-1) — 덩어리 뒤 단위 토큰 ─────────────────────
   라벨은 자유 글이라 숫자 덩어리는 맞아도 단위 **낱말**이 바뀔 수 있다(`40 mg`→`40 g`·`3–5 mg/kg`→`3–5 mg`·`40 mg/kg/일`→`40 mg`).
   언어 무관 규칙: 덩어리 바로 뒤(공백 한 칸까지)의 단위 토큰 = 글자(`\p{L}`, `µ` 포함)로 — 또는 `/` + 글자로 — 시작해
   공백·구두점(`/` 는 토큰 안)·수학 기호 앞까지(`mg/kg/일` 통째 · `ملغ` · `/L`). 비교 꼴은 소문자로만 접는다(단위 동의어 표 없음 — 안전 쪽).
   덩어리가 이름의 일부(첫 글자가 숫자이고 바로 앞이 글자 또는 글자 + 하이픈 — `CD4`·`HbA1c`·`IL-6`)면 단위를 보지 않는다(`u:null`). */

const ULETTER = /\p{L}/u;
const USTOP = /[\s\p{P}\p{Sm}]/u;
const HYPH = /^[-\u2010\u2011]$/u;

function cpAt(t, i) { return i >= 0 && i < t.length ? String.fromCodePoint(t.codePointAt(i)) : ''; }
function cpBefore(t, i) {
  if (i <= 0) return { ch: '', at: -1 };
  const lo = t.charCodeAt(i - 1);
  const w = lo >= 0xDC00 && lo <= 0xDFFF && i >= 2 && (t.charCodeAt(i - 2) & 0xFC00) === 0xD800 ? 2 : 1;
  return { ch: t.slice(i - w, i), at: i - w };
}

/** 덩어리 `[a, …)` 가 이름의 일부인가(`CD4`·`HbA1c`·`IL-6`) — 부호로 시작하는 덩어리(`pH<7.2` 의 `<7.2`)는 아니다. */
function nameDigit(t, a) {
  const c = cpAt(t, a);
  if (!(ND.test(c) || SUP.test(c))) return false;
  const p = cpBefore(t, a);
  if (ULETTER.test(p.ch)) return true;
  if (HYPH.test(p.ch)) return ULETTER.test(cpBefore(t, p.at).ch);
  return false;
}

/** 덩어리 끝 `b` 뒤의 단위 토큰(소문자) — 없으면 ''. */
function unitAfter(t, b) {
  let i = b;
  const sp = cpAt(t, i);
  const last = cpBefore(t, b).ch;
  // 공백 한 칸까지 — 줄바꿈(개요 줄 경계)은 넘지 않는다. 덩어리가 이미 단위 기호(`%`·`°`…)로 끝나면 붙은 토큰만(`38.5°C` — `30% 환자` 의 낱말은 단위가 아니다)
  if (sp && WS.test(sp) && sp !== '\n' && sp !== '\r' && !UNIT.test(last)) i += sp.length;
  const c0 = cpAt(t, i);
  const ok = ULETTER.test(c0) || (c0 === '/' && ULETTER.test(cpAt(t, i + 1)));
  if (!ok) return '';
  let u = '';
  for (let k = i; k < t.length;) {
    const ch = cpAt(t, k);
    if (FMT.test(ch)) { k += ch.length; continue; }
    if (ch !== '/' && USTOP.test(ch)) break;
    u += ch;
    k += ch.length;
  }
  return u.toLowerCase();
}

/**
 * 글의 숫자 덩어리(`wide` 갈래)마다 `{k: chunkKey, u: 단위 토큰|''|null}` — `null` = 이름의 일부(단위를 보지 않음). 16 개념도 라벨 판정.
 * @param {string} text
 * @returns {{k:string, u:(string|null)}[]}
 */
export function numberChunkUnits(text) {
  const t = String(text == null ? '' : text);
  return numberSpans(t, { wide: true }).map((x) => ({ k: chunkKey(t.slice(x[0], x[1])), u: nameDigit(t, x[0]) ? null : unitAfter(t, x[1]) }));
}
