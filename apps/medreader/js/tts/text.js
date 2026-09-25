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
       parts:   number      // 그 문장이 몇 조각인가
     }
   `part`/`parts` 가 있어야 "쪼개진 동안 하이라이트는 유지"(6-4)를 UI 가 안다.

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
 * 문장이 걸친 **모든 줄**을 `lineIds` 로 돌려준다(자동 스크롤·쪽 넘김이 쓴다).
 * 하이라이트가 칠할 자리는 `ranges` 가 따로 준다(10a — 줄이 아니라 글자 구간).
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
      emit(out, { text: sent, spans: spansIn(joined.spans, from, to) }, para.id, from, to);
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
 * ★ 10a — 줄 span 하나를 **그 줄 안의 오프셋**으로 접는다.
 *
 * **export 하는 이유**: `emit` 을 거치면 `Math.max`/`Math.min` 과 아래 `e <= s`
 * 폴백이 이미 값을 가둬서 클램프가 **한 번도 시험되지 않는다**(변이를 넣어도
 * 아무 테스트가 빨개지지 않았다). 클램프는 `spansIn` 이 어긋난 span 을 돌려주는
 * 병적 경로의 마지막 방어선이므로, 그 경계를 테스트가 직접 고정한다.
 *
 * `from`/`to` 는 문단을 이어 붙인 텍스트 안의 문장 구간이고, `sp.start`/`sp.end`
 * 는 같은 좌표계의 줄 구간이다. 둘의 교집합을 줄 시작점 기준으로 옮긴다.
 *
 * 줄 길이로 **클램프**한다 — `joinPieces` 가 `'hidden'` 하이픈의 `-` 를 떼므로
 * 여기 길이는 화면 글자 수보다 1 작을 수 있고, 계산이 어긋나면 DOM 오프셋이
 * 범위를 벗어나 `Range` 가 던진다.
 *
 * 교집합이 비면(병적 입력 — `spansIn` 의 폴백 경로) **줄 통째**로 돌려준다.
 * 빈 구간을 그리는 것보다 넓게 칠하는 쪽이 낫다(이 단계의 일관된 판단).
 */
export function localRange(sp, from, to) {
  const len = Math.max(0, sp.end - sp.start);
  if (len === 0) return { id: sp.id, start: 0, end: 0 };
  // 줄 시작점 기준으로 옮기고 **줄 길이로 클램프**한다. 클램프가 교집합을
  // 겸한다 — `max`/`min` 을 한 번 더 두면 클램프가 죽은 코드가 되고, 그러면
  // 어떤 테스트도 이 경계를 지키지 못한다(변이로 확인했다).
  const cl = (v) => Math.min(len, Math.max(0, v));
  let s = cl(from - sp.start);
  let e = cl(to - sp.start);
  if (e <= s) { s = 0; e = len; }
  return { id: sp.id, start: s, end: e };
}

/**
 * 한 덩어리를 정규화 → 300자 분할 → Unit 들로. 빈 텍스트는 버린다.
 *
 * @param {number} [from] `joined.spans` 와 같은 좌표계의 구간 시작(문장 모드)
 * @param {number} [to]   같은 구간 끝. 주지 않으면 **덩어리 전체**(줄 모드)다.
 */
function emit(out, joined, paraId, from, to) {
  const ids = [];
  for (let i = 0; i < joined.spans.length; i++) ids.push(joined.spans[i].id);

  const spoken = normalizeSpeech(joined.text);
  if (!spoken) return;

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
      parts: parts.length
    };
    if (ranges) u.ranges = ranges;
    out.push(u);
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
