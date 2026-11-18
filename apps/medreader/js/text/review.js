/* ============================================================
   MedReader — 섹션 복습 묶음의 순수 함수 (spec 17-13 2 · 3-1 — 15-1)

   ── 순수 계층이다(3-1 · 3-2) ────────────────────────────
   `config` 와 같은 순수 계층의 `plan/planner.js`(읽은 쪽 판정 `rangesHas` — 13-1 과 한 벌)만 import 한다.
   브라우저 전역(DOM·저장소·네트워크)·시계를 모른다(16-A grep 대상). 화면 문구를 만들지 않는다.

   ── 범위 ── 한 책의 PDF 쪽 구간 `[a, b]`(`rangeKey` = `a-b`). AI 문항의 섹션 id 는 `ai-p{a}-{b}` —
   원서 파서 id(`sec-…`·로마숫자)와 겹치지 않는다(15-D3 · 섞지 않는다).

   ── 출제 입력 `passageFor` (3-1 · 15-D4) ──────────────────
   범위 쪽들의 흐름 문단(`fromStored → flowParasOf → joinPieces` 글자 — 서비스가 쪽마다 읽어 넘긴다) 중
     kind body·list · 60자 이상 · 참고문헌(PMID·DOI) 아님 · **읽은 쪽(13 `@read`)** · 이미 쓴 문단 아님
   을 후보로, **보낸 횟수 적은 문단 먼저(15-1R) → 저장 요약이 있는 문단 먼저 → 읽은 쪽에 고르게(쪽마다 돌림)**로 누적 글자 ≤ budget 까지 담는다. 문단은 자르지 않는다
   (넘치면 그 문단을 건너뛰고 다음 문단). 제목·문항·보기·답·표(흐름 문단이 아님)·표 안내는 후보가 아니다.
   ============================================================ */

import { REVIEW, PIPELINE } from '../config.js';
import { rangesHas } from '../plan/planner.js';

/** 코드포인트 단위 글자 수. */
export function charCount(s) {
  let n = 0;
  for (const ch of String(s == null ? '' : s)) { if (ch) n++; }
  return n;
}

function clean(s) { return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''; }
function int(v) { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : NaN; }

/** 쪽 구간 정규화 — 정수, a ≤ b(뒤집혔으면 바꾼다), 1 이상. 꼴이 틀리면 null. */
export function rangeOf(a, b) {
  let lo = int(a);
  let hi = int(b === undefined ? a : b);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo > hi) { const t = lo; lo = hi; hi = t; }
  if (lo < 1) return null;
  return [lo, hi];
}

/** 범위 열쇠 `a-b`(라우트 `#/review/:docId/:range` 의 칸). 꼴이 틀리면 빈 문자열. */
export function rangeKey(a, b) {
  const r = rangeOf(a, b);
  return r ? r[0] + '-' + r[1] : '';
}

/** `a-b` → `[a, b]`. 꼴이 틀리면 null. */
export function parseRangeKey(s) {
  const m = /^(\d+)-(\d+)$/.exec(String(s == null ? '' : s).trim());
  return m ? rangeOf(m[1], m[2]) : null;
}

/** AI 문항의 섹션 id `ai-p{a}-{b}`(3-3). 꼴이 틀리면 빈 문자열. */
export function aiSectionId(a, b) {
  const k = rangeKey(a, b);
  return k ? REVIEW.SECTION_PREFIX + k : '';
}

/** AI 문항의 섹션 id 인가 → `[a, b]` · 아니면 null. */
export function aiRangeOf(sectionId) {
  const s = String(sectionId == null ? '' : sectionId);
  return s.startsWith(REVIEW.SECTION_PREFIX) ? parseRangeKey(s.slice(REVIEW.SECTION_PREFIX.length)) : null;
}

/**
 * 원서 문제 색인(`doc.sectionIndex`) 중 문항 쪽 범위(`startPage`–`endPage`)가 `[a, b]` 와 겹치는 섹션(색인 순서 그대로 · 사본).
 * 쪽을 모르는 줄은 뺀다. AI 섹션(`ai-…`)은 색인에 없지만 있어도 뺀다(섞지 않는다).
 */
export function sectionsInRange(sectionIndex, a, b) {
  const r = rangeOf(a, b);
  if (!r) return [];
  const out = [];
  for (const e of Array.isArray(sectionIndex) ? sectionIndex : []) {
    if (!e || aiRangeOf(e.sectionId)) continue;
    const s = int(e.startPage);
    const t = Number.isFinite(int(e.endPage)) ? int(e.endPage) : s;
    if (!Number.isFinite(s)) continue;
    const lo = Math.min(s, t);
    const hi = Math.max(s, t);
    if (hi >= r[0] && lo <= r[1]) out.push(Object.assign({}, e));
  }
  return out;
}

/** 범위 `[a, b]` 안 읽은 쪽 수(13 `@read` — `rangesHas` 한 벌). 묶음 화면 "읽음 x/y쪽" · 출제 단추 흐림(15-D4)의 재료. */
export function readPagesIn(readRanges, a, b) {
  const r = rangeOf(a, b);
  if (!r) return 0;
  let n = 0;
  for (let p = r[0]; p <= r[1]; p++) if (rangesHas(readRanges, p)) n++;
  return n;
}

/** 참고문헌 꼴(식별자) — 본문 산문에는 PMID·DOI 가 거의 없다. 참고문헌 목록 문단은 출제 입력이 아니다. */
const REF_ID = /\b(?:PMID|PMCID)\b|\bdoi\s*:?\s*10\.\d{4,9}\//i;

/** 출제 입력 후보가 될 수 있는 문단인가(읽은 쪽·쓴 문단 판정 전) — kind body·list · 60자 이상 · 참고문헌 아님. */
export function isQuizPara(p) {
  if (!p) return false;
  const text = clean(p.text);
  if (!text) return false;
  if (REVIEW.PARA_KINDS.indexOf(p.kind || 'body') < 0) return false;
  if (charCount(text) < REVIEW.PARA_MIN_CHARS) return false;
  return !REF_ID.test(text);
}

function toSet(v) {
  if (v instanceof Set) return v;
  const s = new Set();
  for (const x of Array.isArray(v) ? v : []) if (x != null && x !== '') s.add(String(x));
  return s;
}

/** 보낸 횟수 — Map 또는 `{paraId: n}` → Map(음이 아닌 정수만). */
function toCounts(v) {
  const m = new Map();
  const put = (k, n) => { const c = Math.floor(Number(n)); if (k != null && k !== '' && c > 0) m.set(String(k), c); };
  if (v instanceof Map) for (const [k, n] of v) put(k, n);
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) put(k, v[k]);
  return m;
}

/** 비트 뒤집기 값(반 데어 코르풋, 밑 2) — 쪽 번호 차례를 고르게 흩는 열쇠(0, ½, ¼, ¾, …). */
function spreadKey(i) {
  let x = i;
  let f = 0;
  let w = 0.5;
  while (x > 0) { if (x & 1) f += w; x >>= 1; w /= 2; }
  return f;
}

/**
 * 15-1R 낮음-2 — 한 무리(같은 보낸 횟수·같은 요약 여부) 안에서 **읽은 쪽 전체에 고르게**: 쪽마다 문단을 줄 세우고
 * 돌림(쪽마다 몫 한 문단씩)으로 꺼낸다. 한 돌림 안 쪽 차례 = 그 쪽에서 **지금까지 보낸 문단 수가 적은 쪽 먼저**(`load` —
 * 지난 누름이 고른 쪽을 이번엔 뒤로) → 비트 뒤집기로 흩음(앞 쪽만 몰리지 않게 — 0, ½, ¼, ¾ 자리…).
 * @param {Map<number, number>} load 쪽 → 보낸 횟수 합
 */
function spreadOrder(group, load) {
  const byPage = new Map();
  for (const c of group) {
    if (!byPage.has(c.pageNo)) byPage.set(c.pageNo, []);
    byPage.get(c.pageNo).push(c);
  }
  const pages = Array.from(byPage.keys()).sort((a, b) => a - b);
  const turn = pages.map((p, i) => [p, load.get(p) || 0, spreadKey(i), i])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[3] - b[3]).map((x) => x[0]);
  for (const p of pages) byPage.get(p).sort((a, b) => a.i - b.i);
  const out = [];
  for (let round = 0; out.length < group.length; round++) {
    for (const p of turn) { const l = byPage.get(p); if (round < l.length) out.push(l[round]); }
  }
  return out;
}

/**
 * 3-1 출제 입력 고르기.
 * @param {{paras:Array<{paraId:string, pageNo:number, kind?:string, text:string, textHash?:string}>,
 *          readRanges?:number[][], usedParaIds?:(Set|string[]), summarized?:(Set|string[]), sent?:(Map|Object), budget?:number}} o
 *   `paras` = 범위 쪽들의 흐름 문단(읽기 순서) · `readRanges` = 13 `@read` 구간 · `usedParaIds` = 이 범위 AI 문항이 쓴 문단 ·
 *   `summarized` = 저장 요약이 있는 문단의 `paraId` 또는 `textHash`(둘 중 하나가 맞으면) ·
 *   `sent` = 문단마다 **보낸 횟수**(보냈지만 근거가 안 된 문단 — 빼지 않고 뒤로) · `budget` = 누적 글자 상한(기본 `PIPELINE.MAX_REQ_CHARS`)
 * @returns {{items:{paraId:string, pageNo:number, text:string}[], chars:number, left:number, candidates:number, fresh:number}}
 *   `items` = 고른 순서 · `chars` = 담은 글자 · `left` = 담지 못한 후보 문단 수 · `candidates` = 후보 수 ·
 *   `fresh` = 담지 못한 후보 중 **아직 한 번도 보내지 않은** 문단 수(측정용 — 단추 아래 "남은 문단 m" 은 `candidates`: 아직 문항이 되지 않은 읽은 문단)
 *
 * 순서(15-1R 낮음-2 정정): **보낸 횟수 적은 문단 먼저** → 같은 횟수 안에서 저장 요약 문단 먼저 → 읽은 쪽에 고르게(`spreadOrder`).
 */
export function passageFor(o) {
  const x = o || {};
  const read = Array.isArray(x.readRanges) ? x.readRanges : [];
  const used = toSet(x.usedParaIds);
  const sum = toSet(x.summarized);
  const sent = toCounts(x.sent);
  const lim = Number.isFinite(Number(x.budget)) && Number(x.budget) > 0 ? Math.floor(Number(x.budget)) : PIPELINE.MAX_REQ_CHARS;
  const cands = [];
  const list = Array.isArray(x.paras) ? x.paras : [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p || p.paraId == null || p.paraId === '' || !isQuizPara(p)) continue;
    const pageNo = int(p.pageNo);
    if (!Number.isFinite(pageNo)) continue;
    if (!rangesHas(read, pageNo)) continue;                       // 읽은 쪽만(10-4 "실제로 읽은 문단" · 15-D4)
    const paraId = String(p.paraId);
    if (used.has(paraId)) continue;                               // 같은 문단으로 또 만들지 않는다
    const text = clean(p.text);
    const isSum = sum.has(paraId) || (typeof p.textHash === 'string' && p.textHash !== '' && sum.has(p.textHash));
    cands.push({ paraId: paraId, pageNo: pageNo, text: text, chars: charCount(text), sum: isSum, n: sent.get(paraId) || 0, i: i });
  }
  // 쪽마다 지금까지 보낸 문단 수(쓴 문단 포함 — 후보 밖 문단도 센다)
  const load = new Map();
  if (sent.size) {
    for (const p of list) {
      if (!p || p.paraId == null) continue;
      const k = sent.get(String(p.paraId));
      const pg = int(p.pageNo);
      if (k && Number.isFinite(pg)) load.set(pg, (load.get(pg) || 0) + k);
    }
  }
  // 무리 = (보낸 횟수, 요약 아님) — 작은 무리부터. 무리 안은 쪽에 고르게.
  const groups = new Map();
  for (const c of cands) {
    const k = c.n * 2 + (c.sum ? 0 : 1);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const order = [];
  for (const k of Array.from(groups.keys()).sort((a, b) => a - b)) for (const c of spreadOrder(groups.get(k), load)) order.push(c);
  const items = [];
  let total = 0;
  let fresh = 0;
  for (const c of order) {
    if (total + c.chars > lim) { if (!c.n) fresh++; continue; }  // 자르지 않는다 — 다음 문단
    items.push({ paraId: c.paraId, pageNo: c.pageNo, text: c.text });
    total += c.chars;
  }
  return { items: items, chars: total, left: cands.length - items.length, candidates: cands.length, fresh: fresh };
}
