/* ============================================================
   MedReader — 필기 만들기·고치기 · 메모 시트 · 쪽 필기 시트 (spec 17-16 5 — 20-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   1. 순수 — 선택 스냅숏(selbar)·지금 문장(speaker 단위) → 화면 글자 오프셋(`screenIndex` — 20-1 앵커와 같은 좌표계),
      겹침 판정(지금 쪽의 찾은 필기 `placedNow()` 와 구간이 겹치나), 쪽 필기 줄 묶기(같은 `group` = 한 줄).
   2. 흐름 `createAnnoFlow` — DOM 없이(주입만): 하이라이트 만들기 · 메모 만들기 · 색 바꾸기 · 메모 고치기 · 지우기(묶음) ·
      되살리기 · 음성 "표시"(지금 문장 노랑 — 이미 덮였으면 그대로). 만들고 지운 뒤 칠하기는 **20-1 의 길**(`annotate.paintNow`)만 —
      여기서 따로 칠하지 않는다.
   3. 화면 — 메모 시트(`#noteSheet` — 인용 `dir=ltr` · `<textarea>` 2,000자 `dir=auto` · [저장]·[지우기]·[닫기], 키보드가 올라오면
      `visualViewport` 로 시트를 그 위로 — [저장]이 늘 보인다) · 쪽 필기 시트(`#pageNotes` — 줄을 누르면 그 자리로 굴리고 메모 시트) ·
      [되돌리기] 줄(`#annoToast` — 3초) · 메모 있는 것 지우기 확인(`#annoDelDialog` — 페이지 안 `<dialog>`, `confirm()` 금지) ·
      쪽 칩(`#annoChip` — 칠하기·셈은 리더 몫, 여기서는 누름만).

   ── 지키는 것 ──────────────────────────────────────────
   ★ 손이 이긴다 — 만들기·지우기는 낭독을 멈추지 않는다(speaker 는 **읽기만** — 음성 "표시"의 지금 문장).
   ★ 본문 DOM 에 아무것도 끼우지 않는다(칠하기는 20-1 의 CSS Custom Highlight·원본 필기 층). 메모 글은 시트에서만 연다.
   ★ 글자는 전부 `textContent`/`value` — `innerHTML` 0(메모에 `<img onerror>` 가 와도 글자로 보인다). 호출 0 · 요청 0.
   import 방향(3-2): ui 계층 — `notes/annotations`(서비스) · `text/anchor`(순수) · 리더·칠하기(같은 ui) · i18n.
   ============================================================ */

import { t, applyTranslations, onLangChange, formatNumber } from '../i18n/index.js';
import { ANNO } from '../config.js';
import { annotationStore, KIND } from '../notes/annotations.js';
import { indexOfDesc } from '../text/anchor.js';
import { placedNow, paintNow } from './annotate.js';
import { currentScreen, revealLine, refreshAnnoChip, onPageRender, onReaderLeave, docTitle, docFileHash } from './reader.js';
import { voiceUnit } from './remember.js';
// `[20-3 — spec 17-16 6]` 쪽 필기 시트 "이 책 필기 모두" → `#/notes/:docId`
import { notesHash } from '../router.js';

/** [되돌리기] 줄이 떠 있는 시간(20-D10 — "3초"). */
export const UNDO_MS = 3000;
/** 쪽 필기 줄의 인용·메모 앞부분 글자 수. */
export const PREVIEW_CHARS = 90;
/** 메모 시트의 인용 글자 수(그 뒤는 …). */
export const QUOTE_SHOW = 240;

/* ────────────────────────────────────────────────────────
   1. 순수 — `tests/annotate-ui-20.test.mjs`
   ──────────────────────────────────────────────────────── */

function str(v) { return v == null ? '' : String(v); }

/**
 * 줄 안 오프셋(DOM 첫 텍스트 노드 — selbar 스냅숏 좌표) → 화면 글자 오프셋. 줄을 못 찾으면 null.
 * 줄 길이로 가둔다(`'hidden'` 하이픈의 `-` 는 화면 글자에 없다 — 10a `localRange` 와 같은 태도).
 * @param {{parts:Array}} idx `screenIndex(…)`
 */
export function screenOffsetOf(idx, lineId, off) {
  if (!idx || lineId == null) return null;
  for (const p of idx.parts || []) {
    for (const sp of p.joined.spans) {
      if (String(sp.id) !== String(lineId)) continue;
      const len = Math.max(0, sp.end - sp.start);
      const o = Math.min(len, Math.max(0, Math.floor(Number(off) || 0)));
      return p.base + sp.start + o;
    }
  }
  return null;
}

/**
 * 선택 스냅숏 → 화면 글자 구간 `{from, to}`. 끝은 `endLineId`·`endOff`(여러 줄 선택 — 20-2 가 스냅숏에 더함), 없으면 같은 줄의 `end`.
 * 끝 줄이 흐름 밖(표·번역 블록)이면 시작 줄 끝까지. 빈 구간 → null.
 */
export function selectionRange(idx, snap) {
  if (!snap || snap.lineId == null) return null;
  const from = screenOffsetOf(idx, snap.lineId, snap.start);
  if (from == null) return null;
  let to = snap.endLineId != null ? screenOffsetOf(idx, snap.endLineId, snap.endOff) : null;
  if (to == null) to = screenOffsetOf(idx, snap.lineId, snap.end);
  if (to == null) return null;
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  return b > a ? { from: a, to: b } : null;
}

/**
 * 문장 단위(`speaker.sentenceUnits()` 의 하나 — `{paraId, lineIds, src}`) → 화면 글자 구간. 그 문단 안에서 첫 줄 시작 뒤의
 * 문장 글자(`src` — `joinPieces` 결과의 그 구간, 공백 접음)를 찾는다. 표 안내·흐름 밖 문단 → null.
 * @param {{parts:Array}} idx
 * @param {Array} paraIds `indexOfDesc(desc).paraIds`(idx.parts 순서)
 */
export function sentenceRange(idx, paraIds, unit) {
  if (!idx || !unit || unit.paraId == null) return null;
  const k = (Array.isArray(paraIds) ? paraIds : []).indexOf(String(unit.paraId));
  if (k < 0 || !idx.parts[k]) return null;
  const p = idx.parts[k];
  const t = p.joined.text;
  const src = str(unit.src).replace(/\s+/g, ' ').trim();
  if (!src) return null;
  const first = Array.isArray(unit.lineIds) && unit.lineIds.length ? String(unit.lineIds[0]) : null;
  let lo = 0;
  if (first !== null) { const sp = p.joined.spans.find((s) => String(s.id) === first); if (sp) lo = sp.start; }
  let at = t.indexOf(src, lo);
  if (at < 0) at = t.indexOf(src);
  if (at < 0) return null;
  return { from: p.base + at, to: p.base + at + src.length };
}

/** 찾은 필기(`placeOnPage` 결과) 중 화면 구간 [from, to) 와 겹치는 것(고아 빼고) — 앞 자리 순. */
export function overlapping(placed, from, to) {
  const out = [];
  for (const p of placed || []) {
    if (!p || !p.rec || !p.res) continue;
    const a = Number(p.res.at);
    const b = a + Number(p.res.len);
    if (a < to && b > from) out.push(p);
  }
  return out.sort((x, y) => x.res.at - y.res.at);
}

/** 구간 [from, to) 를 통째로 덮는 하이라이트(음성 "표시" — "이미 표시됨"). 없으면 null. */
export function coveringHighlight(placed, from, to) {
  for (const p of placed || []) {
    if (!p || !p.rec || !p.res || p.rec.kind !== KIND.HIGHLIGHT) continue;
    if (p.res.at <= from && p.res.at + p.res.len >= to) return p.rec;
  }
  return null;
}

/** 같은 `group` 의 레코드 중 메모를 지니는 대표(id === group, 없으면 만든 순 첫째). */
export function leaderOf(recs) {
  const list = (recs || []).filter(Boolean);
  return list.find((r) => r.group != null && r.id === r.group) || list[0] || null;
}

/** 앞부분 — 공백을 접고 `n` 자에서 자른다(…). */
export function preview(s, n) {
  const x = str(s).replace(/\s+/g, ' ').trim();
  return x.length > n ? x.slice(0, n) + '…' : x;
}

/**
 * 쪽 필기 시트의 줄 — 같은 `group` 은 한 줄(문단을 넘는 선택 · 긴 선택). 자리 순, 고아(못 찾음)는 끝에 만든 순.
 * @returns {Array<{id:string, group:string, kind:string, color:?string, quote:string, note:string, lineId:?string, range:?Object, at:number, orphan:boolean, n:number}>}
 */
export function groupRows(placed) {
  const by = new Map();
  for (const p of placed || []) {
    if (!p || !p.rec) continue;
    const g = String(p.rec.group != null ? p.rec.group : p.rec.id);
    if (!by.has(g)) by.set(g, []);
    by.get(g).push(p);
  }
  const rows = [];
  for (const [g, list] of by) {
    const recs = list.map((p) => p.rec);
    const lead = leaderOf(recs);
    const found = list.filter((p) => p.res).sort((a, b) => a.res.at - b.res.at);
    const first = found[0] || null;
    const r0 = first && first.res.ranges && first.res.ranges[0] ? first.res.ranges[0] : null;
    rows.push({
      id: String(lead.id), group: g, kind: lead.kind, color: lead.kind === KIND.HIGHLIGHT ? (lead.color || ANNO.COLORS[0]) : null,
      quote: list.slice().sort((a, b) => (Number(a.rec.createdAt) || 0) - (Number(b.rec.createdAt) || 0) || (a.res && b.res ? a.res.at - b.res.at : 0))
        .map((p) => str(p.rec.anchor && p.rec.anchor.quote && p.rec.anchor.quote.exact)).join(' '),
      note: str((recs.find((r) => str(r.note).trim()) || {}).note),
      lineId: r0 ? String(r0.id) : null, range: r0 ? { start: r0.start, end: r0.end } : null,
      at: first ? first.res.at : Infinity, orphan: !first, n: recs.length, createdAt: Number(lead.createdAt) || 0
    });
  }
  return rows.sort((a, b) => (a.at - b.at) || (a.createdAt - b.createdAt));
}

/**
 * 선택 줄 `[⋯]` 맨 위 줄의 꼴 — 선택이 이미 필기와 겹치면 고치기(`edit` — 맨 앞 겹침의 묶음), 아니면 만들기(`create`).
 * @returns {{mode:'create'}|{mode:'edit', id:string, group:string, kind:string, color:?string, hasNote:boolean}}
 */
export function annoStateOf(placed, range) {
  if (!range) return { mode: 'create' };
  const hit = overlapping(placed, range.from, range.to)[0];
  if (!hit) return { mode: 'create' };
  const g = hit.rec.group != null ? hit.rec.group : hit.rec.id;
  const members = (placed || []).filter((p) => p && p.rec && String(p.rec.group != null ? p.rec.group : p.rec.id) === String(g)).map((p) => p.rec);
  const lead = leaderOf(members) || hit.rec;
  return { mode: 'edit', id: String(lead.id), group: String(g), kind: lead.kind, color: lead.kind === KIND.HIGHLIGHT ? lead.color || null : null,
    hasNote: members.some((r) => str(r.note).trim().length > 0) };
}

/**
 * `[20-2 — 11-4bR 다듬기 후보를 되풀이하지 않는다]` 음성 "표시"가 끝난 뒤 되돌릴 상태. 마이크를 누른 순간이 "멈춤"이어도, 그 멈춤이
 * **열린 설명 띠**(단추·음성 설명)가 읽기를 멈춰 둔 것이면 그 설명의 `was`(11-4b `inherit` 와 같은 결 — 띠가 닫혔으면 잇지 않는다). 순수.
 * `[20-3 — 20-2R #1]` `bandOpen` 이 함수면 `bandOpen(held.id)` — **그 설명의 띠**가 아직 열려 있을 때만 잇는다(ask `inherit` 와 같은 꼴).
 *   "어떤 띠든 열려 있나"(불리언)로 보면 그 뒤 음성 설명이 연 다른 띠를 옛 단추 설명의 띠로 여긴다(멈춘 읽기를 다시 시작). 번호가 없으면 잇지 않는다.
 * @param {string} was  9b 가 넘긴 누른 순간의 상태
 * @param {?{id?:number, was:string}} held  마지막 단추 설명의 띠 번호·`was`
 * @param {boolean|function(number):boolean} bandOpen  그 띠가 지금 열려 있나(함수 = `trband.isNoteOpen`)
 */
export function inheritWas(was, held, bandOpen) {
  const reading = (s) => s === 'speaking' || s === 'waiting-page';
  if (reading(was) || !held || !reading(held.was)) return was;
  let open = false;
  if (typeof bandOpen === 'function') { try { open = !!held.id && !!bandOpen(held.id); } catch (e) { open = false; } } else open = !!bandOpen;
  return open ? held.was : was;
}

/**
 * `[20-3 — 20-2R #1]` 단추 [설명]의 `was` 를 **그 띠 번호와 함께** 든다(controls 한 벌). `isOpen(id)` = `trband.isNoteOpen`.
 *   `before(st)` — 누르기 직전(앞 설명 띠가 아직 열려 멈춰 둔 읽기면 그 was) · `after(id, was)` — 이번에 연 띠 번호(0 이면 들지 않음) ·
 *   `was(w)` — 음성 "표시"가 끝난 뒤 되돌릴 상태 · `clear()` — 리더를 떠남. 순수(주입만).
 */
export function createExplainHold(isOpen) {
  let held = null;
  const open = (id) => { try { return typeof isOpen === 'function' && !!isOpen(id); } catch (e) { return false; } };
  return {
    before: function (st) { return inheritWas(st, held, open); },
    after: function (id, was) { held = id ? { id: id, was: was } : null; return held; },
    was: function (w) { return inheritWas(w, held, open); },
    clear: function () { held = null; },
    held: function () { return held ? Object.assign({}, held) : null; }
  };
}

/* ────────────────────────────────────────────────────────
   2. 흐름 — DOM 없이(주입만)
   ──────────────────────────────────────────────────────── */

/**
 * @param {{store?:Object, screen:()=>?Object, placed:()=>?Array, repaint?:()=>Promise, meta?:()=>{fileHash?:string, docTitle?:string},
 *          units?:()=>Array, current?:()=>{cur:Object, idx:number, unit:string}}} deps
 *   `screen()` = 리더 `currentScreen()`(docId·page·desc·layout·view·ready) · `placed()` = `annotate.placedNow()`
 *   · `repaint()` = 20-1 칠하기 길(`annotate.paintNow`) · `units()`·`current()` = speaker 읽기만(음성 "표시")
 */
export function createAnnoFlow(deps) {
  const d = deps || {};
  const store = d.store || annotationStore();
  const stats = { created: 0, removed: 0, restored: 0, updated: 0, marks: 0, already: 0 };

  function screen() { try { const s = typeof d.screen === 'function' ? d.screen() : null; return s && s.ready && s.desc ? s : null; } catch (e) { return null; } }
  function placed() { try { return (typeof d.placed === 'function' && d.placed()) || []; } catch (e) { return []; } }
  function meta() { try { return (typeof d.meta === 'function' && d.meta()) || {}; } catch (e) { return {}; } }
  async function repaint() { try { if (typeof d.repaint === 'function') await d.repaint(); } catch (e) { /* 칠하지 못해도 레코드는 남았다 */ } }

  /** 스냅숏이 지금 화면 쪽의 것이면 그 구간. */
  function rangeOf(snap) {
    const s = screen();
    if (!s || !snap) return null;
    if (snap.page != null && Number(snap.page) !== Number(s.page)) return null;
    const { idx } = indexOfDesc(s.desc);
    return selectionRange(idx, snap);
  }

  /** 선택 줄 `[⋯]` 맨 위 줄의 꼴(동기 — 마지막으로 칠한 결과로). 화면이 없으면 null(줄을 숨긴다). */
  function stateFor(snap) {
    const r = rangeOf(snap);
    if (!r) return null;
    return annoStateOf(placed(), r);
  }

  async function make(s, r, kind, color, note) {
    const m = meta();
    const recs = await store.create({ docId: s.docId, pageNo: s.page, desc: s.desc, layout: s.layout, from: r.from, to: r.to,
      kind: kind, color: color, note: note, fileHash: m.fileHash, docTitle: m.docTitle });
    if (recs.length) { stats.created += recs.length; await repaint(); }
    return recs;
  }

  /** 선택 → 그 색 하이라이트. */
  async function highlight(snap, color) {
    const s = screen();
    const r = rangeOf(snap);
    if (!s || !r) return { ok: false, key: 'anno.failed' };
    const recs = await make(s, r, KIND.HIGHLIGHT, ANNO.COLORS.indexOf(color) >= 0 ? color : ANNO.COLORS[0], '');
    return recs.length ? { ok: true, key: 'anno.saved', recs: recs } : { ok: false, key: 'anno.failed' };
  }

  /** 선택 → 색 없는 메모(`kind:'note'`). 빈 글이면 만들지 않는다. */
  async function createNote(snap, text) {
    const body = str(text);
    if (!body.trim()) return { ok: false, key: 'anno.note.empty' };
    const s = screen();
    const r = rangeOf(snap);
    if (!s || !r) return { ok: false, key: 'anno.failed' };
    const recs = await make(s, r, KIND.NOTE, null, body.slice(0, ANNO.NOTE_MAX));
    return recs.length ? { ok: true, key: 'anno.note.saved', recs: recs } : { ok: false, key: 'anno.failed' };
  }

  /** 지금 쪽에서 그 레코드와 같은 묶음. */
  function membersOf(id) {
    const all = placed().map((p) => p.rec);
    const me = all.find((r) => String(r.id) === String(id));
    if (!me) return [];
    const g = me.group != null ? String(me.group) : String(me.id);
    return all.filter((r) => String(r.group != null ? r.group : r.id) === g);
  }

  function recById(id) {
    const m = membersOf(id);
    return m.find((r) => String(r.id) === String(id)) || null;
  }

  /** 색 바꾸기 — 묶음 전부(사용자 손 — `updatedAt` 새로). */
  async function recolor(id, color) {
    const list = membersOf(id).filter((r) => r.kind === KIND.HIGHLIGHT);
    if (!list.length) return { ok: false, key: 'anno.failed' };
    let n = 0;
    for (const r of list) { const w = await store.update(r.id, { color: color }); if (w && w.wrote) n++; }
    stats.updated += n;
    if (n) await repaint();
    return { ok: n > 0, key: n > 0 ? 'anno.recolored' : 'anno.failed' };
  }

  /**
   * 메모 고치기 — 묶음의 대표 레코드에만(묶음마다 메모 하나). 색 없는 메모(`note`)를 빈 글로 저장하면 지운다(되살리기 재료를 돌려준다).
   * @returns {Promise<{ok:boolean, key:string, gone?:Object[]}>}
   */
  async function saveNote(id, text) {
    const list = membersOf(id);
    const lead = leaderOf(list);
    if (!lead) return { ok: false, key: 'anno.failed' };
    const body = str(text).slice(0, ANNO.NOTE_MAX);
    if (lead.kind === KIND.NOTE && !body.trim()) {
      const gone = await remove(lead.id);
      return { ok: gone.length > 0, key: 'anno.removed', gone: gone };
    }
    let wrote = false;
    for (const r of list) {
      const want = r === lead ? body : '';
      if (str(r.note) === want) continue;
      const w = await store.update(r.id, { note: want });
      if (w && w.wrote) wrote = true;
    }
    if (wrote) { stats.updated++; await repaint(); }
    return { ok: true, key: 'anno.note.saved' };
  }

  /** 지우기 — 묶음 전부. 지운 레코드(되살리기 재료). */
  async function remove(id) {
    let gone = [];
    try { gone = await store.remove(id); } catch (e) { gone = []; }
    if (gone.length) { stats.removed += gone.length; await repaint(); }
    return gone;
  }

  /** 되살리기 — 지운 그대로(id·만든 때). */
  async function undo(gone) {
    let n = 0;
    try { n = await store.restore(gone); } catch (e) { n = 0; }
    if (n) { stats.restored += n; await repaint(); }
    return n;
  }

  /**
   * 음성 "표시"(20-D7) — 지금 문장(줄 모드면 그 줄을 담은 문장)을 노랑으로. 이미 하이라이트가 그 문장을 덮으면 그대로(`already`).
   * 원본 보기에서도(선택이 없어도 — 20-D8). speaker 는 읽기만.
   * @returns {Promise<{ok:boolean, key:string, already?:boolean}>}
   */
  async function markCurrent() {
    const s = screen();
    if (!s) return { ok: false, key: 'voice.mark.none' };
    let unit = null;
    try {
      const c = (typeof d.current === 'function' && d.current()) || {};
      unit = voiceUnit((typeof d.units === 'function' && d.units()) || [], c.cur, c.idx, c.unit);
    } catch (e) { unit = null; }
    const { idx, paraIds } = indexOfDesc(s.desc);
    const r = unit ? sentenceRange(idx, paraIds, unit) : null;
    if (!r) return { ok: false, key: 'voice.mark.none' };
    if (coveringHighlight(placed(), r.from, r.to)) { stats.already++; return { ok: true, already: true, key: 'voice.mark.already' }; }
    const recs = await make(s, r, KIND.HIGHLIGHT, ANNO.COLORS[0], '');
    if (!recs.length) return { ok: false, key: 'anno.failed' };
    stats.marks++;
    return { ok: true, key: 'voice.mark.done', recs: recs };
  }

  return { stateFor, rangeOf, highlight, createNote, recolor, saveNote, remove, undo, markCurrent, membersOf, recById,
    debug: function () { return Object.assign({}, stats); } };
}

/* ────────────────────────────────────────────────────────
   3. 화면 — 메모 시트 · 쪽 필기 시트 · [되돌리기] · 지우기 확인 · 쪽 칩 누름
   ──────────────────────────────────────────────────────── */

let els = null;
let flow = null;
let ui = null;          // 주입(controls): {focusBack(lineId), beforeOpen(), cancelVoice()}
let sheet = null;       // 열린 메모 시트 {mode:'draft'|'edit', snap?, id?, lineId?}
let toastTimer = null;
let toastGone = null;
let delTarget = null;
let vvOn = false;

/**
 * @param {{flow:Object, focusBack?:Function, beforeOpen?:Function, cancelVoice?:Function}} d
 * @returns {?Object} api — 마크업이 없으면 null
 */
export function initNoteSheet(d) {
  if (els || typeof document === 'undefined') return api();
  const x = d || {};
  const ns = document.getElementById('noteSheet');
  const pn = document.getElementById('pageNotes');
  if (!ns || !pn || !x.flow) return null;
  flow = x.flow;
  ui = x;
  els = {
    ns: ns, title: ns.querySelector('#nsTitle'), quote: ns.querySelector('#nsQuote'), text: ns.querySelector('#nsText'),
    count: ns.querySelector('#nsCount'), status: ns.querySelector('#nsStatus'), del: ns.querySelector('[data-ns-action="delete"]'),
    pn: pn, list: pn.querySelector('#pnList'), pnTitle: pn.querySelector('#pnTitle'), pnEmpty: pn.querySelector('#pnEmpty'),
    pnAll: pn.querySelector('#pnAll'),
    toast: document.getElementById('annoToast'), toastText: document.getElementById('annoToastText'),
    dlg: document.getElementById('annoDelDialog'), chip: document.getElementById('annoChip')
  };
  ns.addEventListener('click', onSheetClick);
  ns.addEventListener('keydown', onSheetKey);
  els.text.addEventListener('input', paintCount);
  els.text.addEventListener('focus', () => { setTimeout(fitKeyboard, 60); });
  pn.addEventListener('click', onListClick);
  pn.addEventListener('keydown', (ev) => { if ((ev.key === 'Escape' || ev.key === 'Esc') && !ev.isComposing) { ev.preventDefault(); closePage(true); } });
  if (els.toast) els.toast.addEventListener('click', onToastClick);
  if (els.dlg) {
    els.dlg.addEventListener('click', onDelClick);
    els.dlg.addEventListener('cancel', () => { delTarget = null; });
  }
  if (els.chip) els.chip.addEventListener('click', () => { openPage(); });
  onLangChange(() => { if (els) { applyTranslations(els.ns); applyTranslations(els.pn); if (sheet) paintCount(); if (!els.pn.hidden) paintList(); } });
  // 쪽이 바뀌면 시트를 닫는다(다른 쪽 필기 글이 남지 않게) — [되돌리기] 줄은 3초 그대로(지운 레코드는 쪽과 무관하게 되살린다).
  // `main.js` 가 부팅 끝에 전역 객체를 새로 만든다 — 쪽이 그려질 때 측정 훅을 다시 붙인다(있으면 그대로 — controls·selbar 와 같은 까닭).
  onPageRender(() => { close(false); closePage(false); attachDebugHook(); });
  // `[다듬기 4b — P4R 중간-1]` 메모 있는 필기 지우기 확인(`#annoDelDialog`)도 거둔다 — 리더가 숨은 채 `:modal` 로 남아 앱을 막지 않게(대상 지움 = 취소)
  onReaderLeave(() => { closeDel(); close(false); closePage(false); hideToast(); });
  attachDebugHook();
  return api();
}

function api() {
  return { openDraft: openDraft, openEdit: openEdit, openPage: openPage, close: close, closePage: closePage, toastUndo: toastUndo,
    askRemove: askRemove, note: note, isOpen: function () { return !!sheet || (!!els && !els.pn.hidden); } };
}

function root() { return document.documentElement; }

/** 한 줄 안내(시트 상태 줄 — 열려 있을 때만). */
function note(key) {
  if (!els || !els.status) return;
  els.status.textContent = key ? t(key) : '';
}

function paintCount() {
  if (!els) return;
  const n = els.text.value.length;
  els.count.textContent = t('anno.note.count', { n: formatNumber(n), max: formatNumber(ANNO.NOTE_MAX) });
}

/* ── 키보드 — `visualViewport` 로 시트를 키보드 위에(8f-2 단어 시트 자리 식 + 키보드 높이) ── */

function vv() { return typeof window !== 'undefined' ? window.visualViewport || null : null; }

/** 키보드가 가린 높이(px) — 레이아웃 뷰포트 아래변 − 보이는 뷰포트 아래변. 0 이면 키보드 없음. */
export function keyboardInset(innerH, v) {
  if (!v) return 0;
  const bottom = Number(v.height) + Number(v.offsetTop || 0);
  const k = Number(innerH) - bottom;
  return Number.isFinite(k) && k > 40 ? Math.round(k) : 0;
}

function fitKeyboard() {
  if (!els || !sheet) return;
  const v = vv();
  const k = keyboardInset(window.innerHeight, v);
  if (k > 0) {
    els.ns.setAttribute('data-kb', 'on');
    els.ns.style.setProperty('--ns-kb', k + 'px');
    els.ns.style.setProperty('--ns-vh', Math.round(Number(v.height)) + 'px');
  } else {
    els.ns.removeAttribute('data-kb');
    els.ns.style.removeProperty('--ns-kb');
    els.ns.style.removeProperty('--ns-vh');
  }
}

function watchKeyboard(on) {
  const v = vv();
  if (!v || typeof v.addEventListener !== 'function') return;
  if (on && !vvOn) { v.addEventListener('resize', fitKeyboard); v.addEventListener('scroll', fitKeyboard); vvOn = true; }
  if (!on && vvOn) { v.removeEventListener('resize', fitKeyboard); v.removeEventListener('scroll', fitKeyboard); vvOn = false; }
}

/* ── 메모 시트 ─────────────────────────────────────── */

function openSheet(state, quote, body, focusText) {
  if (!els) return false;
  closePage(false);
  if (ui && typeof ui.beforeOpen === 'function') { try { ui.beforeOpen(); } catch (e) { /* 그대로 */ } }
  sheet = state;
  applyTranslations(els.ns);
  els.quote.textContent = preview(quote, QUOTE_SHOW);
  els.text.value = str(body).slice(0, ANNO.NOTE_MAX);
  els.text.maxLength = ANNO.NOTE_MAX;
  els.del.hidden = state.mode !== 'edit';
  note(null);
  paintCount();
  els.ns.hidden = false;
  root().setAttribute('data-note-sheet', 'on');
  watchKeyboard(true);
  fitKeyboard();
  try { (focusText ? els.text : els.title).focus({ preventScroll: true }); } catch (e) { /* 그대로 */ }
  return true;
}

/** 선택 → 새 메모(색 없음). 저장하면 만든다. */
function openDraft(snap) {
  if (!snap) return false;
  return openSheet({ mode: 'draft', snap: Object.assign({}, snap), lineId: snap.lineId }, snap.text, '', true);
}

/** 이 쪽의 필기(묶음 대표 id) — 메모 보기·고치기. */
function openEdit(id, lineId) {
  const list = flow ? flow.membersOf(id) : [];
  const lead = leaderOf(list);
  if (!lead) return false;
  const quote = list.map((r) => str(r.anchor && r.anchor.quote && r.anchor.quote.exact)).join(' ');
  const body = str((list.find((r) => str(r.note).trim()) || {}).note);
  return openSheet({ mode: 'edit', id: String(lead.id), lineId: lineId || (lead.anchor && lead.anchor.start ? lead.anchor.start.lineId : null) }, quote, body, false);
}

/** 시트를 닫는다. `back` 이면 그 줄로 포커스(굴리지 않음). */
function close(back) {
  if (!els || !sheet) return;
  const s = sheet;
  sheet = null;
  els.ns.hidden = true;
  els.ns.removeAttribute('data-kb');
  root().removeAttribute('data-note-sheet');
  watchKeyboard(false);
  if (back && ui && typeof ui.focusBack === 'function' && s.lineId != null) { try { ui.focusBack(s.lineId); } catch (e) { /* 그대로 */ } }
}

async function onSheetClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-ns-action]') : null;
  if (!b || !els.ns.contains(b) || !sheet) return;
  const a = b.getAttribute('data-ns-action');
  if (a === 'close') { close(true); return; }
  if (a === 'save') { await save(); return; }
  if (a === 'delete' && sheet.mode === 'edit') { askRemove(sheet.id); }
}

function onSheetKey(ev) {
  if ((ev.key === 'Escape' || ev.key === 'Esc') && !ev.isComposing) { ev.preventDefault(); ev.stopPropagation(); close(true); }
}

async function save() {
  const s = sheet;
  if (!s) return;
  const body = els.text.value;
  let r = null;
  try {
    r = s.mode === 'draft' ? await flow.createNote(s.snap, body) : await flow.saveNote(s.id, body);
  } catch (e) { r = { ok: false, key: 'anno.failed' }; }
  if (!r || !r.ok) { note((r && r.key) || 'anno.failed'); return; }
  if (sheet !== s) return;
  close(true);
  refreshAnnoChip();
  if (r.gone && r.gone.length) toastUndo(r.gone);
}

/* ── 지우기 — 메모 없는 것은 바로(3초 [되돌리기]), 메모 있는 것은 페이지 안 확인 ── */

/**
 * @param {string} id  묶음의 아무 레코드
 * @returns {Promise<boolean|'ask'>}  지웠나 · 확인을 띄웠나
 */
async function askRemove(id) {
  const list = flow ? flow.membersOf(id) : [];
  if (!list.length) return false;
  if (list.some((r) => str(r.note).trim())) {
    const dlg = els && els.dlg;
    if (!dlg) return false;
    delTarget = String(id);
    applyTranslations(dlg);
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    const cancel = dlg.querySelector('button[data-dialog="cancel"]');
    if (cancel) { try { cancel.focus(); } catch (e) { /* 그대로 */ } }
    return 'ask';
  }
  return removeNow(id);
}

async function removeNow(id) {
  const lineId = sheet ? sheet.lineId : null;
  const gone = await flow.remove(id);
  if (!gone.length) { note('anno.failed'); return false; }
  if (sheet) { close(false); if (ui && typeof ui.focusBack === 'function' && lineId != null) { try { ui.focusBack(lineId); } catch (e) { /* 그대로 */ } } }
  refreshAnnoChip();
  toastUndo(gone);
  return true;
}

function closeDel() {
  delTarget = null;
  const dlg = els && els.dlg;
  if (!dlg) return;
  if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
}

async function onDelClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-dialog]') : null;
  if (!b) return;
  const id = delTarget;
  const ok = b.getAttribute('data-dialog') === 'ok';
  closeDel();
  if (ok && id != null) await removeNow(id);
}

/* ── [되돌리기] 줄 ─────────────────────────────────── */

/** 줄 하나 — 글(키) · [되돌리기] 보임 · `ms` 뒤 거둠. */
function showToast(key, undoable, ms) {
  if (!els || !els.toast) return;
  if (toastTimer !== null) { clearTimeout(toastTimer); toastTimer = null; }
  applyTranslations(els.toast);
  els.toastText.textContent = t(key);
  const u = els.toast.querySelector('button[data-anno-toast="undo"]');
  if (u) u.hidden = !undoable;
  els.toast.hidden = false;
  toastTimer = setTimeout(hideToast, ms);
}

function toastUndo(gone) {
  if (!Array.isArray(gone) || !gone.length) return;
  // `[20-3 — 20-2R #4]` 3초 안에 또 지우면 [되돌리기]가 앞 것까지 함께 되살린다(한 단계 되돌리기가 앞 것을 잃지 않게).
  toastGone = mergeGone(toastGone && els && els.toast && !els.toast.hidden ? toastGone : null, gone);
  showToast('anno.removed', true, UNDO_MS);
}

/** 되살릴 레코드 합치기 — 앞 것 + 새 것(같은 id 는 하나). 순수. */
export function mergeGone(prev, gone) {
  const out = [];
  const seen = new Set();
  for (const r of (Array.isArray(prev) ? prev : []).concat(Array.isArray(gone) ? gone : [])) {
    if (!r || seen.has(String(r.id))) continue;
    seen.add(String(r.id));
    out.push(r);
  }
  return out;
}

function hideToast() {
  if (toastTimer !== null) { clearTimeout(toastTimer); toastTimer = null; }
  toastGone = null;
  if (els && els.toast) els.toast.hidden = true;
}

async function onToastClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-anno-toast="undo"]') : null;
  if (!b || !toastGone) return;
  const gone = toastGone;
  hideToast();
  const n = await flow.undo(gone);
  refreshAnnoChip();
  if (n) showToast('anno.restored', false, 1500);
}

/* ── 쪽 필기 시트 ───────────────────────────────────── */

function openPage() {
  if (!els) return false;
  close(false);
  if (ui && typeof ui.beforeOpen === 'function') { try { ui.beforeOpen(); } catch (e) { /* 그대로 */ } }
  applyTranslations(els.pn);
  paintList();
  els.pn.hidden = false;
  root().setAttribute('data-note-sheet', 'on');
  try { els.pnTitle.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ }
  return true;
}

function closePage(back) {
  if (!els || els.pn.hidden) return;
  els.pn.hidden = true;
  if (!sheet) root().removeAttribute('data-note-sheet');
  if (back && els.chip && !els.chip.hidden) { try { els.chip.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } }
}

function paintList() {
  const rows = groupRows(placedNow() || []);
  const list = els.list;
  while (list.firstChild) list.removeChild(list.firstChild);
  const s = currentScreen();
  els.pnTitle.textContent = t('anno.page.title', { page: s ? formatNumber(s.page) : '' });
  els.pnEmpty.hidden = rows.length > 0;
  // `[20-3]` "이 책 필기 모두" — 그 책의 필기 화면(해시 이동 — 리더 떠남이 시트를 거둔다)
  if (els.pnAll) {
    els.pnAll.hidden = !s || s.docId == null;
    if (s && s.docId != null) els.pnAll.setAttribute('href', notesHash(s.docId));
  }
  for (const r of rows) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pn-row';
    b.setAttribute('data-pn-id', r.id);
    if (r.lineId) b.setAttribute('data-pn-line', r.lineId);
    if (r.range) { b.setAttribute('data-pn-start', String(r.range.start)); b.setAttribute('data-pn-end', String(r.range.end)); }
    const dot = document.createElement('span');
    dot.className = 'pn-dot pn-' + (r.color || 'note');
    dot.setAttribute('aria-hidden', 'true');
    b.appendChild(dot);
    const body = document.createElement('span');
    body.className = 'pn-body';
    const q = document.createElement('span');
    q.className = 'pn-quote';
    q.setAttribute('dir', 'ltr');
    q.textContent = preview(r.quote, PREVIEW_CHARS);
    body.appendChild(q);
    if (r.note.trim()) {
      const n = document.createElement('span');
      n.className = 'pn-memo';
      n.setAttribute('dir', 'auto');
      n.textContent = preview(r.note, PREVIEW_CHARS);
      body.appendChild(n);
    }
    if (r.orphan) {
      const o = document.createElement('span');
      o.className = 'pn-orphan';
      o.textContent = t('anno.orphan');
      body.appendChild(o);
    }
    b.appendChild(body);
    // 화면 낭독기 — 색 이름을 앞에(점은 aria-hidden)
    b.setAttribute('aria-label', (r.color ? t('anno.color.' + r.color) : t('anno.kind.note')) + ' — ' + preview(r.quote, PREVIEW_CHARS)
      + (r.note.trim() ? ' — ' + preview(r.note, PREVIEW_CHARS) : ''));
    li.appendChild(b);
    list.appendChild(li);
  }
}

function onListClick(ev) {
  const x = ev.target && ev.target.closest ? ev.target.closest('button[data-pn-action="close"]') : null;
  if (x) { closePage(true); return; }
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-pn-id]') : null;
  if (!b || !els.pn.contains(b)) return;
  const id = b.getAttribute('data-pn-id');
  const lineId = b.getAttribute('data-pn-line');
  const st = b.getAttribute('data-pn-start');
  if (lineId) {
    const range = st != null ? { start: Number(st), end: Number(b.getAttribute('data-pn-end')) } : null;
    try { revealLine(lineId, range); } catch (e) { /* 굴리지 못해도 시트는 연다 */ }
  }
  openEdit(id, lineId);
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(길이·수·꼴만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.notes && g.notes.__mine) return;
  g.notes = {
    __mine: true,
    state: function () {
      if (!els) return null;
      return { sheet: sheet ? { mode: sheet.mode, chars: els.text.value.length, kb: els.ns.getAttribute('data-kb') === 'on' } : null,
        page: !els.pn.hidden ? { rows: els.list.children.length } : null, toast: !!els.toast && !els.toast.hidden,
        dialog: !!els.dlg && !!els.dlg.open, flow: flow ? flow.debug() : null };
    }
  };
}

/** 리더에 다시 들어올 때 디버그 훅을 다시 붙인다(`main.js` 가 전역 객체를 새로 만든다). */
export function reattachNotes() { attachDebugHook(); }

/** 레코드에 담는 문서 사본(`fileHash` — 20-3 다시 붙이기 · 제목 — 문서를 지워도 출처). 리더 값. */
export function docMeta() { return { fileHash: docFileHash(), docTitle: docTitle() }; }
