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
       lineIds: string[],   // 이 발화가 걸친 줄(하이라이트 대상 — 6-1 문장 모드)
       paraId:  string|null,
       part:    number,     // 300자 초과로 쪼갠 조각 번호(0부터)
       parts:   number      // 그 문장이 몇 조각인가
     }
   `part`/`parts` 가 있어야 "쪼개진 동안 하이라이트는 유지"(6-4)를 UI 가 안다.
   ============================================================ */

import { TTS, TTS_SYMBOLS } from '../config.js';
import { splitSentences } from '../text/segment.js';

/** URL·이메일. 6-1 — "link" 로 바꾼다(주소를 한 글자씩 읽으면 못 듣는다). */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;

function str(v) { return String(v == null ? '' : v); }

/**
 * 줄 하나를 **다음 줄과 어떻게 이을지**에 따라 다듬는다.
 * `describePage()` 의 `hyphen` 값을 그대로 받는다(4단계 계약).
 *
 *   'hidden' — 줄바꿈 하이픈. 끝의 `-` 를 **지우고** 공백 없이 붙인다.
 *   'kept'   — 진짜 하이픈. `-` 를 살리고 공백 없이 붙인다.
 *   'none'   — 공백으로 잇는다.
 *
 * ★ `'hidden'` 의 `-` 제거가 이 단계의 핵심 함정 대응이다.
 */
export function joinPieces(lines) {
  const list = Array.isArray(lines) ? lines : [];
  let text = '';
  const spans = [];   // [{id, start, end}] — text 안에서 그 줄이 차지한 구간

  for (let i = 0; i < list.length; i++) {
    const ln = list[i] || {};
    let piece = str(ln.text).replace(/\s+/g, ' ').trim();
    const hy = ln.hyphen || 'none';
    const last = i === list.length - 1;

    if (!last && hy === 'hidden' && piece.endsWith('-')) piece = piece.slice(0, -1);

    const start = text.length;
    text += piece;
    spans.push({ id: ln.id, start: start, end: text.length });

    if (last) continue;
    // 'hidden'·'kept' 는 공백 없이 다음 줄과 붙는다(12-4 의 화면 글자와 같다).
    if (hy === 'none') text += ' ';
  }

  return { text: text, spans: spans };
}

/**
 * 낭독용 정규화. **원서 텍스트를 바꾸지 않는다** — 사본만 바꾼다.
 *   1. URL·이메일 → "link"
 *   2. `TTS_SYMBOLS` 의 기호 → 낱말 (앞뒤에 공백을 둔다)
 *   3. 공백 정리
 * 연속 대문자 약어(NSAIDs)는 **건드리지 않는다**(6-1).
 */
export function normalizeSpeech(text, symbols) {
  const table = symbols || TTS_SYMBOLS;
  let s = str(text).replace(URL_RE, 'link');
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
export function splitLong(text, max) {
  const limit = Math.max(40, Number(max) || TTS.MAX_UTTER_CHARS);
  const s = str(text).trim();
  if (s.length <= limit) return s ? [s] : [];

  const out = [];
  let rest = s;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = Math.max(window.lastIndexOf(';'), window.lastIndexOf(','));
    if (cut < limit * 0.4) cut = window.lastIndexOf(' ') - 1;   // 경계가 너무 앞이면 공백에서
    if (cut < 0) break;                                          // 쪼갤 자리가 없다
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out.filter(function (x) { return x.length > 0; });
}

/**
 * ★ 낭독 큐를 만든다. 6-1 의 전부가 여기 있다.
 *
 * @param {Array} paras  `reader.flowParas()` — `[{id, kind, lines:[{id,text,hyphen}]}]`
 * @param {'sentence'|'line'} unit
 * @returns {Unit[]} 읽기 순서
 *
 * `'line'` 모드에서도 **하이픈으로 이어지는 줄들은 한 발화**다(6-1). 그래서
 * "cardio-"/"vascular" 가 두 번 나뉘어 읽히지 않는다.
 * `'sentence'` 모드는 문단을 통째로 이어 붙인 뒤 `splitSentences` 로 나누고,
 * 문장이 걸친 **모든 줄**을 `lineIds` 로 돌려준다(하이라이트가 전부에 간다).
 */
export function buildUnits(paras, unit) {
  const list = Array.isArray(paras) ? paras : [];
  const mode = unit === 'line' ? 'line' : 'sentence';
  const out = [];

  for (let p = 0; p < list.length; p++) {
    const para = list[p] || {};
    const lines = Array.isArray(para.lines) ? para.lines : [];
    if (!lines.length) continue;

    if (mode === 'line') {
      let group = [];
      for (let i = 0; i < lines.length; i++) {
        group.push(lines[i]);
        const hy = lines[i].hyphen || 'none';
        const last = i === lines.length - 1;
        // 하이픈으로 다음 줄과 이어지면 발화를 끊지 않는다.
        if (!last && hy !== 'none') continue;
        emit(out, joinPieces(group), para.id);
        group = [];
      }
      if (group.length) emit(out, joinPieces(group), para.id);
      continue;
    }

    const joined = joinPieces(lines);
    const sentences = splitSentences(joined.text);
    if (!sentences.length) { emit(out, joined, para.id); continue; }

    // `splitSentences` 는 공백 하나로 정확히 되붙는다(그 함수의 계약). 그래서
    // 누적 길이로 각 문장이 원문의 어느 구간인지 되찾을 수 있다.
    let cursor = 0;
    for (let s = 0; s < sentences.length; s++) {
      const sent = sentences[s];
      const start = joined.text.indexOf(sent, cursor);
      const from = start < 0 ? cursor : start;
      const to = from + sent.length;
      cursor = to + 1;
      emit(out, { text: sent, spans: spansIn(joined.spans, from, to) }, para.id);
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

/** 한 덩어리를 정규화 → 300자 분할 → Unit 들로. 빈 텍스트는 버린다. */
function emit(out, joined, paraId) {
  const ids = [];
  for (let i = 0; i < joined.spans.length; i++) ids.push(joined.spans[i].id);

  const spoken = normalizeSpeech(joined.text);
  if (!spoken) return;

  const parts = splitLong(spoken, TTS.MAX_UTTER_CHARS);
  for (let i = 0; i < parts.length; i++) {
    out.push({
      text: parts[i],
      lineIds: ids,
      paraId: paraId == null ? null : String(paraId),
      part: i,
      parts: parts.length
    });
  }
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
