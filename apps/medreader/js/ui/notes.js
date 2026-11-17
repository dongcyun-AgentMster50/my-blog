/* ============================================================
   MedReader — 필기 화면 · 내보내기 · 다시 붙이기 (spec 17-16 6 · 7 · 9 "20-3" — 20-3)

   ── 이 파일이 하는 일 ───────────────────────────────────
   `#/notes`(전체) · `#/notes/:docId`(그 책) · `#/notes/:docId/:a-b`(그 책의 쪽 범위 — 15 묶음에서). 입구: 서재 카드 [⋯] "이 책의 필기" ·
   쪽 필기 시트 "이 책 필기 모두"(20-2 시트) · (15 묶음 필기 줄).
     · 목록: 책 → 장(문서 개요 맨 위 깊이 — 11-3 `chaptersOf` 와 같은 규칙, 없으면 쪽 라벨) → 쪽 → 쪽 안 자리 순. 같은 `group`(문단을 넘는
       선택)은 한 줄 — 메모는 대표 레코드 하나(옛 중복 메모도 하나로 — 20-2R #2). 줄(48px+): 색 점 · 인용(`dir=ltr`) · 메모(`dir=auto`) ·
       쪽 라벨 · [원문으로] · [메모] · [삭제].
     · 거르기 칩: 색 넷 + 색 없는 메모 · 메모 있는 것만 · 위치 못 찾은 것(그 쪽 저장본에서 인용을 다시 찾지 못함 — 읽기만, 고쳐 쓰지 않는다).
     · [원문으로]: 그 쪽을 열고, 칠하기가 끝나면(`annotate.onPainted` — 20-1 의 찾은 결과 그대로) 그 묶음 첫 구간을 편안 영역 안으로(`revealLine`).
       못 찾으면(고아) 쪽 처음 + "위치를 찾지 못했습니다".
     · 문서가 지워진 필기(고아 책): `docTitle` 묶음 + "PDF 를 다시 가져오면 다시 붙습니다"(서재 가져오기가 `reattach` — 20-D11). [원문으로] 없음.
     · 내보내기(호출 0 · 20-D13): Markdown `.md` — 책 `#` · 장 `##` · 줄마다 `> 인용` + 메모 + 쪽 라벨. UTF-8 BOM · CRLF(11-3 내보내기와 같은
       장치 — `Blob` + `<a download>` + `revokeObjectURL`). 화면에 공유 주의 한 줄. 보이는 것(책·범위·거르기)만.
     · 지우기(20-D10): 메모 없는 것은 바로 지우고 3초 [되돌리기], 메모 있는 것은 페이지 안 `<dialog>` 확인. 메모 고치기는 페이지 안 대화.

   ── 지키는 것 ──────────────────────────────────────────
   ★ 호출 0 · 요청 0. 저장소의 필기 레코드만 읽는다(요약·개요·캐시·키를 읽지 않는다 — 11 저장 요약은 11-3 모아 보기가 정본).
   ★ 모든 글자 `textContent` — `innerHTML` 0(메모·책 제목에 `<img onerror>` 가 와도 글자). 화면 문구 안 책·장 이름은 방향 격리(`iso`).
   ★ 1절(순수)·2절(흐름 — DOM 없음)은 `tests/notes-ui-20.test.mjs` 가 잰다. 3절이 화면.
   import 방향(3-2): ui 계층 — `notes/annotations`(서비스) · `text/*`(순수) · db(읽기) · 리더·칠하기·요약 화면(같은 ui) · i18n · router.
   ============================================================ */

import { t, applyTranslations, onLangChange, formatNumber } from '../i18n/index.js';
import * as db from '../db.js';
import { ANNO } from '../config.js';
import { go, replace, notesHash, readerHash } from '../router.js';
import { annotationStore, KIND, groupKey, pageIndex, boxOfLayout } from '../notes/annotations.js';
import { resolve } from '../text/anchor.js';
import { fromStored } from '../text/store.js';
import { describePage } from '../text/screen.js';
import { algoVersion as ALGO_VERSION } from '../text/layout.js';
import { clean } from '../text/summary.js';
import { printedLabel } from '../search/outline.js';
import { chaptersOf, chapterAt, iso } from './summaries.js';
import { leaderOf, mergeGone, keyboardInset } from './notesheet.js';
import { onPainted } from './annotate.js';
import { revealLine, revealTop } from './reader.js';

/* ────────────────────────────────────────────────────────
   1. 순수 — `tests/notes-ui-20.test.mjs`
   ──────────────────────────────────────────────────────── */

/** 거르기 칩의 색 값 — 색 넷 + 색 없는 메모(`note`). */
export const FILTER_COLORS = Object.freeze(ANNO.COLORS.concat(['note']));
/** [되돌리기] 줄이 떠 있는 시간(20-D10 — 쪽 시트와 같은 3초). */
export const UNDO_MS = 3000;

function str(v) { return v == null ? '' : String(v); }
function quoteOf(r) { return str(r && r.anchor && r.anchor.quote && r.anchor.quote.exact); }

/** 앵커 첫 줄의 읽기 순서 번호(`쪽:번호`)와 오프셋 — 쪽 안 자리 순서. 모르면 큰 수. */
export function posOf(rec) {
  const s = rec && rec.anchor && rec.anchor.start;
  const id = s && s.lineId != null ? String(s.lineId) : '';
  const k = id.lastIndexOf(':');
  const n = k >= 0 ? Number(id.slice(k + 1)) : NaN;
  const off = s ? Number(s.off) : NaN;
  return { line: Number.isFinite(n) ? n : 1e9, off: Number.isFinite(off) ? off : 0 };
}

function byPos(a, b) {
  const pa = posOf(a);
  const pb = posOf(b);
  return (pa.line - pb.line) || (pa.off - pb.off) || ((Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
}

/**
 * 필기 레코드 → 줄(같은 `group` = 한 줄). 메모는 대표(id = group)의 것, 대표가 비었으면 처음 찾은 메모 하나(옛 중복 — 같은 메모가 둘이어도 한 번).
 * @param {Object[]} recs `annotationStore().list()` (요약·개요는 거른다)
 * @returns {{key:string, id:string, docId:string, docTitle:string, fileHash:string, pageNo:number, kind:string, color:?string,
 *            quote:string, note:string, ids:string[], pos:{line:number, off:number}, createdAt:number}[]}
 */
export function rowsOf(recs) {
  const by = new Map();
  for (const r of Array.isArray(recs) ? recs : []) {
    if (!r || (r.kind !== KIND.HIGHLIGHT && r.kind !== KIND.NOTE)) continue;
    const k = str(r.docId) + '\u0001' + groupKey(r);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const rows = [];
  for (const [k, list] of by) {
    const members = list.slice().sort(byPos);
    const lead = leaderOf(list) || members[0];
    const own = str(lead.note);
    const note = own.trim() ? own : str((members.find((r) => str(r.note).trim()) || {}).note);
    rows.push({
      key: k, id: String(lead.id), docId: str(lead.docId), docTitle: clean(str((list.find((r) => clean(r.docTitle)) || {}).docTitle)),
      fileHash: str((list.find((r) => r.fileHash) || {}).fileHash), pageNo: Number(lead.pageNo) || 0, kind: lead.kind,
      color: lead.kind === KIND.HIGHLIGHT ? (ANNO.COLORS.indexOf(lead.color) >= 0 ? lead.color : ANNO.COLORS[0]) : null,
      quote: members.map(quoteOf).filter((q) => q).join(' '), note: note, ids: members.map((r) => String(r.id)),
      pos: posOf(members[0]), createdAt: Number(lead.createdAt) || 0
    });
  }
  return rows;
}

/**
 * 거르기 — 색(고른 것이 없으면 모두) · 메모 있는 것만 · 위치 못 찾은 것(고아 줄 열쇠 `lost` · 문서가 지워진 책 줄) · 쪽 범위. 순수.
 * @param {Object[]} rows `rowsOf`
 * @param {{colors?:string[], memo?:boolean, lost?:boolean, range?:{from:number, to:number}}} f
 * @param {Set<string>} [lost] 고아 줄 열쇠(`row.key`)
 * @param {Set<string>} [live] 이 기기 문서 id(없는 책 = 위치를 찾을 수 없다)
 */
export function filterRows(rows, f, lost, live) {
  const x = f || {};
  const colors = Array.isArray(x.colors) ? x.colors.filter((c) => FILTER_COLORS.indexOf(c) >= 0) : [];
  const lo = x.range ? Number(x.range.from) : NaN;
  const hi = x.range ? Number(x.range.to) : NaN;
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (colors.length && colors.indexOf(r.kind === KIND.NOTE ? 'note' : r.color) < 0) return false;
    if (x.memo && !str(r.note).trim()) return false;
    if (x.lost && !(isLost(r, lost, live))) return false;
    if (Number.isFinite(lo) && Number.isFinite(hi) && (r.pageNo < lo || r.pageNo > hi)) return false;
    return true;
  });
}

/** 위치를 찾지 못한 줄인가 — 고아 열쇠에 있거나 그 책이 이 기기에 없다. */
export function isLost(row, lost, live) {
  if (lost && lost.has(row.key)) return true;
  return !!live && !live.has(String(row.docId));
}

function titleOfDoc(d) { return String((d && (d.title || d.fileName || d.id)) || ''); }

/**
 * 화면 모양 — 책(이 기기 책 먼저 제목 순, 지워진 책 뒤) → 묶음(장 머리 · 장 앞 쪽은 쪽 머리) → 줄(쪽 · 자리 순). 순수.
 * @param {Object[]} rows 거른 뒤의 줄
 * @param {Object[]} docs 이 기기 문서
 * @returns {{docId:string, title:string, gone:boolean, fileHash:string, groups:{head:{kind:'chapter'|'page', title?:string, from?:number,
 *           to?:number, page?:number}, rows:Object[]}[]}[]}
 */
export function viewBooks(rows, docs) {
  const m = new Map();
  for (const d of Array.isArray(docs) ? docs : []) if (d && d.id != null) m.set(String(d.id), d);
  const byDoc = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!byDoc.has(r.docId)) byDoc.set(r.docId, []);
    byDoc.get(r.docId).push(r);
  }
  const books = [];
  for (const [k, list] of byDoc) {
    const d = m.get(k) || null;
    const chapters = chaptersOf(d);
    const keyed = list.map((r) => {
      const c = chapterAt(chapters, r.pageNo);
      return { r: r, c: c, g: c >= 0 ? 'c' + c : 'p' + r.pageNo, gp: c >= 0 ? chapters[c].from : r.pageNo };
    });
    keyed.sort((a, b) => (a.gp - b.gp) || (a.g === b.g ? 0 : (a.c >= 0 ? -1 : 1)) || (a.r.pageNo - b.r.pageNo) ||
      (a.r.pos.line - b.r.pos.line) || (a.r.pos.off - b.r.pos.off) || (a.r.createdAt - b.r.createdAt));
    const groups = [];
    for (const x of keyed) {
      const last = groups[groups.length - 1];
      if (last && last.key === x.g) { last.rows.push(x.r); continue; }
      const head = x.c >= 0 ? { kind: 'chapter', title: chapters[x.c].title, from: chapters[x.c].from, to: chapters[x.c].to }
        : { kind: 'page', page: x.r.pageNo };
      groups.push({ key: x.g, head: head, rows: [x.r] });
    }
    const t0 = list.find((r) => r.docTitle) || {};
    books.push({ docId: k, title: d ? titleOfDoc(d) : (t0.docTitle || ''), gone: !d, fileHash: (d && d.fileHash) || (list.find((r) => r.fileHash) || {}).fileHash || '',
      groups: groups.map((g) => ({ head: g.head, rows: g.rows })) });
  }
  books.sort((a, b) => (a.gone - b.gone) || a.title.localeCompare(b.title));
  return books;
}

/**
 * 책 고르기 선택지 — 맨 앞 "모든 책(n)", 필기가 있는 이 기기 책, 지워진 책(`docTitle`). n = 줄 수(묶음 = 1). 순수.
 * @returns {{value:string, title:string, n:number, gone:boolean}[]}
 */
export function scopeOptions(rows, docs) {
  const m = new Map();
  for (const d of Array.isArray(docs) ? docs : []) if (d && d.id != null) m.set(String(d.id), d);
  const count = new Map();
  const titles = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    count.set(r.docId, (count.get(r.docId) || 0) + 1);
    if (!titles.has(r.docId) && r.docTitle) titles.set(r.docId, r.docTitle);
  }
  const out = [];
  for (const [k, n] of count) {
    const d = m.get(k);
    out.push({ value: k, title: d ? titleOfDoc(d) : (titles.get(k) || k), n: n, gone: !d });
  }
  out.sort((a, b) => (a.gone - b.gone) || a.title.localeCompare(b.title));
  return [{ value: '', title: '', n: (Array.isArray(rows) ? rows : []).length, gone: false }].concat(out);
}

/** 파일 이름 `medreader-notes-YYYYMMDD.md`(기기 날짜). */
export function exportName(nowMs) {
  const d = new Date(Number(nowMs) || 0);
  const p = (n) => String(n).padStart(2, '0');
  return 'medreader-notes-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.md';
}

/** 메모 글 → 줄들(CR·LF·U+2028·U+2029 를 줄바꿈으로, 줄 끝 공백만 걷는다 — 글자는 그대로). 앞뒤 빈 줄은 뺀다. */
export function memoLines(s) {
  const lines = str(s).split(/\r\n|\r|\n|\u2028|\u2029/).map((l) => l.replace(/[ \t]+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

/**
 * 내보낼 Markdown 글(20-D13) — UTF-8 BOM · CRLF. 책 `# 제목` → 장 `## 장 (p. a–b)` 또는 쪽 `## p. n` → 줄마다
 * `> 인용`(한 줄로 접음) · 빈 줄 · 메모(줄 그대로) · 빈 줄 · `— 쪽 라벨 · 색`. 필기 레코드의 인용·메모만 — 원문 쪽 글·캐시·키를 보지 않는다. 순수.
 * @param {Object[]} books `viewBooks`
 * @param {{untitled?:string, chapter?:(head:Object)=>string, page?:(row:Object, book:Object)=>string, pageHead?:(head:Object, book:Object)=>string,
 *          color?:(row:Object)=>string, gone?:(book:Object)=>string}} [labels] 화면 문구(이 함수는 i18n 을 모른다)
 * @returns {string}
 */
export function exportMarkdown(books, labels) {
  const L = labels || {};
  const page = typeof L.page === 'function' ? L.page : (r) => 'p. ' + r.pageNo;
  const pageHead = typeof L.pageHead === 'function' ? L.pageHead : (h) => 'p. ' + h.page;
  const chapter = typeof L.chapter === 'function' ? L.chapter : (h) => clean(h.title) + ' (p. ' + h.from + '–' + h.to + ')';
  const color = typeof L.color === 'function' ? L.color : () => '';
  const lines = [];
  for (const b of Array.isArray(books) ? books : []) {
    if (lines.length) lines.push('');
    lines.push('# ' + (clean(b.title) || clean(L.untitled) || ''));
    if (b.gone && typeof L.gone === 'function' && clean(L.gone(b))) { lines.push(''); lines.push(clean(L.gone(b))); }
    for (const g of b.groups || []) {
      lines.push('');
      lines.push('## ' + clean(g.head.kind === 'chapter' ? chapter(g.head, b) : pageHead(g.head, b)));
      for (const r of g.rows) {
        lines.push('');
        lines.push('> ' + clean(r.quote));
        const memo = memoLines(r.note);
        if (memo.length) { lines.push(''); for (const l of memo) lines.push(l); }
        lines.push('');
        const c = clean(color(r));
        lines.push('— ' + clean(page(r, b)) + (c ? ' · ' + c : ''));
      }
    }
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/* ────────────────────────────────────────────────────────
   2. 흐름 — DOM 없이(주입) · 위치 못 찾은 줄 · 메모 고치기 · 지우기·되살리기
   ──────────────────────────────────────────────────────── */

/** 저장본 → 지금 판 쪽 서술·레이아웃(리더와 같은 길 `describePage(fromStored(rec))`). 없거나 깨졌으면 null. */
export async function loadPageDesc(docId, pageNo, dbx) {
  const d = dbx || db;
  let rec = null;
  try { rec = await d.get('pages', [String(docId), Number(pageNo)]); } catch (e) { return null; }
  if (!rec) return null;
  try { const layout = fromStored(rec); return { desc: describePage(layout), layout: layout }; } catch (e) { return null; }
}

/**
 * 위치 못 찾은 줄 — 이 기기 책의 쪽마다 저장본을 읽어 지금 판에서 인용을 다시 찾는다(`resolve` — **읽기만**, 20-D6 고쳐 쓰기를 하지 않는다).
 * 줄의 조각이 하나도 안 잡히면 고아(쪽 필기 시트 `groupRows` 와 같은 판정). 아직 추출되지 않은 쪽은 모름(고아로 치지 않는다).
 * @param {Object[]} recs 필기 레코드
 * @param {Set<string>} live 이 기기 문서 id
 * @param {{load?:(docId:string, pageNo:number)=>Promise<?{desc:Object, layout?:Object}>}} [deps]
 * @returns {Promise<Set<string>>} 고아 줄 열쇠(`rowsOf` 의 `key`)
 */
export async function findLost(recs, live, deps) {
  const load = deps && typeof deps.load === 'function' ? deps.load : (docId, p) => loadPageDesc(docId, p);
  const byPage = new Map();
  for (const r of Array.isArray(recs) ? recs : []) {
    if (!r || (r.kind !== KIND.HIGHLIGHT && r.kind !== KIND.NOTE) || !live || !live.has(String(r.docId))) continue;
    const k = String(r.docId) + '\u0001' + Number(r.pageNo);
    if (!byPage.has(k)) byPage.set(k, []);
    byPage.get(k).push(r);
  }
  const found = new Map();      // 줄 열쇠 → 하나라도 찾았나
  for (const [, list] of byPage) {
    const pg = await load(String(list[0].docId), Number(list[0].pageNo));
    if (!pg || !pg.desc) continue;
    let pi = null;
    try { pi = await pageIndex(pg.desc); } catch (e) { pi = null; }
    if (!pi) continue;
    const boxOf = boxOfLayout(pg.layout);
    for (const r of list) {
      const key = String(r.docId) + '\u0001' + groupKey(r);
      let res = null;
      try { res = resolve(r.anchor, pi.idx, { algo: ALGO_VERSION, paraHashes: pi.paraHashes, boxOf: boxOf }); } catch (e) { res = null; }
      found.set(key, !!found.get(key) || !!res);
    }
  }
  const lost = new Set();
  for (const [k, ok] of found) if (!ok) lost.add(k);
  return lost;
}

/**
 * 메모 고치기·지우기 흐름(필기 화면 — 쪽 필기 시트 `createAnnoFlow` 와 같은 규칙, 레코드는 화면 목록에서).
 * @param {{store?:Object, recs:()=>Object[]}} deps
 */
export function createNotesFlow(deps) {
  const d = deps || {};
  const store = d.store || annotationStore();
  function membersOf(row) {
    const ids = new Set((row && row.ids) || []);
    return ((typeof d.recs === 'function' && d.recs()) || []).filter((r) => r && ids.has(String(r.id)));
  }
  /**
   * 메모 저장 — 묶음 대표 하나에만(다른 조각은 빈 메모 — 옛 중복도 이때 걷힌다). 색 없는 메모를 빈 글로 저장하면 지운다(되살리기 재료).
   * @returns {Promise<{ok:boolean, key:string, gone?:Object[]}>}
   */
  async function saveNote(row, text) {
    const list = membersOf(row);
    const lead = leaderOf(list);
    if (!lead) return { ok: false, key: 'anno.failed' };
    const body = str(text).slice(0, ANNO.NOTE_MAX);
    if (lead.kind === KIND.NOTE && !body.trim()) {
      let gone = [];
      try { gone = await store.remove(lead.id); } catch (e) { gone = []; }
      return { ok: gone.length > 0, key: gone.length ? 'anno.removed' : 'anno.failed', gone: gone };
    }
    for (const r of list) {
      const want = r === lead ? body : '';
      if (str(r.note) === want) continue;
      try { await store.update(r.id, { note: want }); } catch (e) { return { ok: false, key: 'anno.failed' }; }
    }
    return { ok: true, key: 'anno.note.saved' };
  }
  /** 메모가 있는 줄인가(지우기 확인 대화 — 20-D10). */
  function hasNote(row) { return membersOf(row).some((r) => str(r.note).trim()); }
  /** 지우기 — 묶음 전부. 지운 레코드(되살리기 재료). */
  async function remove(row) {
    const list = membersOf(row);
    if (!list.length) return [];
    try { return await store.remove(list[0].id); } catch (e) { return []; }
  }
  /** 되살리기 — 지운 그대로(id·만든 때). */
  async function undo(gone) {
    try { return await store.restore(gone); } catch (e) { return 0; }
  }
  return { saveNote: saveNote, hasNote: hasNote, remove: remove, undo: undo, membersOf: membersOf };
}

/* ────────────────────────────────────────────────────────
   3. 화면
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
const S = { docId: null, range: null, recs: [], rows: [], docs: [], live: new Set(), lost: new Set(), lostReady: false, seq: 0,
  filter: { colors: [], memo: false, lost: false } };
let flow = null;
/** [원문으로] — 그 쪽을 칠한 뒤 그 묶음으로(다른 쪽·다른 책이면 버린다). 60초 지나면 버린다. */
let pendingReveal = null;
let lastReveal = null;
let lastExport = null;
let memoRow = null;
let delRow = null;
let undoGone = null;
let undoTimer = null;

function store() { return annotationStore(); }

export function initNotes() {
  if (typeof document === 'undefined' || els) return;
  root = document.querySelector('[data-screen="notes"]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  els = {
    title: q('#notesTitle'), scope: q('#notesScope'), rangeRow: q('#notesRangeRow'), rangeText: q('#notesRangeText'),
    chips: q('#notesChips'), status: q('#notesStatus'), exportBtn: q('#notesExport'), share: q('#notesShare'),
    list: q('#notesList'), empty: q('#notesEmpty'), emptyText: q('#notesEmptyText'),
    undo: q('#notesUndo'), undoText: q('#notesUndoText'),
    del: q('#notesDelDialog'), memo: q('#notesMemoDialog'), memoQuote: q('#notesMemoQuote'), memoText: q('#notesMemoText'),
    memoCount: q('#notesMemoCount'), memoStatus: q('#notesMemoStatus')
  };
  flow = createNotesFlow({ recs: function () { return S.recs; } });
  root.addEventListener('click', onClick);
  els.scope.addEventListener('change', () => { replace(notesHash(els.scope.value || null)); });
  els.del.addEventListener('click', onDelClick);
  els.del.addEventListener('close', () => { if (!els.del.open) delRow = null; });
  els.memo.addEventListener('click', onMemoClick);
  els.memo.addEventListener('close', () => { if (!els.memo.open) { memoRow = null; watchKeyboard(false); } });
  els.memoText.addEventListener('input', paintMemoCount);
  els.memoText.addEventListener('focus', () => { setTimeout(fitKeyboard, 60); });
  onLangChange(() => { if (!root) return; applyTranslations(root); if (!root.hidden) render(); });
  // [원문으로] — 리더가 그 쪽을 칠한 뒤(20-1 의 찾은 결과 그대로 — DB 를 다시 읽지 않는다)
  onPainted((last) => {
    const x = pendingReveal;
    if (!x || !last) return;
    if (Date.now() - x.at > 60000) { pendingReveal = null; return; }
    if (String(last.docId) !== x.docId || Number(last.page) !== x.page) return;
    pendingReveal = null;
    const placed = Array.isArray(last.placed) ? last.placed : [];
    const run = () => { revealFor(x, placed); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0)); else setTimeout(run, 0);
  });
  attachDebugHook();
}

/** 라우터 — `#/notes` · `#/notes/:docId` · `#/notes/:docId/:a-b`. */
export async function showNotes(params) {
  if (!root) return;
  const docId = params && params.docId != null && params.docId !== '' ? String(params.docId) : null;
  S.docId = docId;
  S.range = docId && params.range ? { from: Number(params.range.from), to: Number(params.range.to) } : null;
  applyTranslations(root);
  attachDebugHook();
  await load();
  attachDebugHook();          // 이 화면으로 바로 부팅하면 main.js 가 전역을 새로 만든다 — 읽기가 끝난 뒤 한 번 더
}

/** 화면을 떠날 때 — 대화·[되돌리기] 줄을 거둔다(거르기 칩은 세션 동안 그대로). */
export function leaveNotes() {
  if (!els) return;
  closeDialog(els.del);
  closeDialog(els.memo);
  delRow = null;
  memoRow = null;
  hideUndo();
}

async function load() {
  const my = ++S.seq;
  let recs = [];
  const docs = [];
  try {
    recs = await store().list();
    await db.iterate('documents', {}, (v) => { if (v && v.id != null) docs.push(v); });
  } catch (e) {
    banner(e);
  }
  if (my !== S.seq) return;
  S.recs = recs;
  S.rows = rowsOf(recs);
  S.docs = docs;
  S.live = new Set(docs.map((d) => String(d.id)));
  S.lostReady = false;
  render();
  // 위치 못 찾은 줄 — 보이는 범위의 책만(읽기만, 쪽마다 저장본 하나). 끝나면 다시 그린다.
  let lost = new Set();
  try {
    const scope = S.docId ? recs.filter((r) => String(r.docId) === S.docId) : recs;
    lost = await findLost(scope, S.live);
  } catch (e) { lost = new Set(); }
  if (my !== S.seq) return;
  S.lost = lost;
  S.lostReady = true;
  render();
}

function docsById() {
  const m = new Map();
  for (const d of S.docs) m.set(String(d.id), d);
  return m;
}

function scopedRows() {
  return S.docId ? S.rows.filter((r) => r.docId === S.docId) : S.rows.slice();
}

function visibleRows() {
  return filterRows(scopedRows(), Object.assign({}, S.filter, { range: S.range }), S.lost, S.live);
}

/** 쪽 라벨 — 8g `pageLabels` 가 있으면 인쇄 쪽(검색·요약 화면과 같은 문구 키). */
function pageLabelOf(doc, page) {
  const p = Number(page);
  const lab = printedLabel(doc && doc.pageLabels, p);
  return lab ? t('search.pageLabeled', { label: lab, page: formatNumber(p) }) : t('search.page', { page: formatNumber(p) });
}

function chapterText(h, isoOn) {
  return t('summaries.range.chapter', { title: isoOn ? iso(h.title) : h.title, from: formatNumber(h.from), to: formatNumber(h.to) });
}

function render() {
  if (!els) return;
  const m = docsById();
  const doc = S.docId ? m.get(S.docId) : null;
  const gone = S.docId && !doc ? (S.rows.find((r) => r.docId === S.docId && r.docTitle) || {}).docTitle : '';
  els.title.textContent = S.docId ? t('notes.titleDoc', { title: iso(doc ? titleOfDoc(doc) : (gone || t('notes.untitled'))) }) : t('notes.title');
  renderScope();
  els.rangeRow.hidden = !S.range;
  if (S.range) els.rangeText.textContent = t('notes.range', { from: formatNumber(S.range.from), to: formatNumber(S.range.to) });
  renderChips();
  const rows = visibleRows();
  els.exportBtn.hidden = rows.length === 0;
  els.share.hidden = rows.length === 0;
  renderList(rows);
}

function renderScope() {
  const sel = els.scope;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  let has = false;
  for (const o of scopeOptions(S.rows, S.docs)) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = !o.value ? t('notes.scope.all', { n: formatNumber(o.n) })
      : t(o.gone ? 'notes.scope.gone' : 'notes.scope.doc', { title: iso(o.title || t('notes.untitled')), n: formatNumber(o.n) });
    if (o.value === (S.docId || '')) { op.selected = true; has = true; }
    sel.appendChild(op);
  }
  if (!has && S.docId) {
    // 필기가 없는 책(서재 카드 [⋯] 로 들어옴) — 그 책 하나를 더한다(빈 목록)
    const d = docsById().get(S.docId);
    const op = document.createElement('option');
    op.value = S.docId;
    op.textContent = t(d ? 'notes.scope.doc' : 'notes.scope.gone', { title: iso(d ? titleOfDoc(d) : S.docId), n: formatNumber(0) });
    op.selected = true;
    sel.appendChild(op);
  }
}

function renderChips() {
  for (const b of els.chips.querySelectorAll('button[data-nf]')) {
    const kind = b.getAttribute('data-nf');
    const on = kind === 'color' ? S.filter.colors.indexOf(b.getAttribute('data-color')) >= 0 : !!S.filter[kind];
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function renderList(rows) {
  const list = els.list;
  while (list.firstChild) list.removeChild(list.firstChild);
  const m = docsById();
  for (const b of viewBooks(rows, S.docs)) {
    const sec = document.createElement('section');
    sec.className = 'notes-book';
    sec.setAttribute('data-doc', b.docId);
    if (!S.docId || b.gone) {
      const h = document.createElement('h2');
      h.className = 'notes-book-title';
      const title = iso(b.title || t('notes.untitled'));
      h.textContent = b.gone ? t('notes.goneHead', { title: title }) : title;
      sec.appendChild(h);
    }
    if (b.gone) {
      const p = document.createElement('p');
      p.className = 'notes-gone';
      p.textContent = t('notes.goneHint');
      sec.appendChild(p);
    }
    const doc = m.get(b.docId) || null;
    for (const g of b.groups) {
      const h3 = document.createElement('h3');
      h3.className = 'notes-head';
      h3.textContent = g.head.kind === 'chapter' ? chapterText(g.head, true) : pageLabelOf(doc, g.head.page);
      sec.appendChild(h3);
      const ul = document.createElement('ul');
      ul.className = 'notes-items';
      for (const r of g.rows) ul.appendChild(rowEl(r, doc, b.gone));
      sec.appendChild(ul);
    }
    list.appendChild(sec);
  }
  const any = scopedRows().length > 0;
  els.empty.hidden = rows.length > 0;
  els.emptyText.textContent = rows.length ? '' : (any ? t('notes.emptyFilter') : (S.docId ? t('notes.emptyDoc') : t('notes.empty')));
}

function btn(na, key, row) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'notes-btn';
  b.setAttribute('data-na', na);
  b.setAttribute('data-key', row.key);
  b.textContent = t(key);
  return b;
}

/** 줄 하나 — 색 점 · 인용(`dir=ltr`) · 메모(`dir=auto`) · 쪽 라벨(· 위치 못 찾음) · [원문으로]·[메모]·[삭제]. */
function rowEl(r, doc, gone) {
  const li = document.createElement('li');
  li.className = 'notes-item';
  li.setAttribute('data-key', r.key);
  li.setAttribute('data-id', r.id);
  li.setAttribute('data-kind', r.kind);
  const lost = isLost(r, S.lost, S.live);
  if (lost) li.setAttribute('data-lost', '');
  const top = document.createElement('div');
  top.className = 'notes-main';
  const dot = document.createElement('span');
  dot.className = 'notes-dot nd-' + (r.color || 'note');
  dot.setAttribute('role', 'img');
  dot.setAttribute('aria-label', r.color ? t('anno.color.' + r.color) : t('anno.kind.note'));
  top.appendChild(dot);
  const body = document.createElement('div');
  body.className = 'notes-body';
  const q = document.createElement('p');
  q.className = 'notes-quote';
  q.setAttribute('dir', 'ltr');
  q.textContent = r.quote;
  body.appendChild(q);
  if (str(r.note).trim()) {
    const n = document.createElement('p');
    n.className = 'notes-memo';
    n.setAttribute('dir', 'auto');
    n.textContent = r.note;
    body.appendChild(n);
  }
  const meta = document.createElement('p');
  meta.className = 'notes-meta';
  meta.textContent = pageLabelOf(gone ? null : doc, r.pageNo) + (lost && !gone ? ' · ' + t('notes.lost') : '');
  body.appendChild(meta);
  top.appendChild(body);
  li.appendChild(top);
  const row = document.createElement('div');
  row.className = 'notes-row';
  if (!gone && doc && r.pageNo >= 1) row.appendChild(btn('goto', 'notes.goto', r));
  row.appendChild(btn('memo', 'notes.memo', r));
  row.appendChild(btn('delete', 'notes.delete', r));
  li.appendChild(row);
  return li;
}

function setStatus(key, params) { els.status.textContent = key ? t(key, params || undefined) : ''; }

function rowByKey(k) { return S.rows.find((r) => r.key === k) || null; }

/* ── 동작 ──────────────────────────────────────────── */

function onClick(ev) {
  const chip = ev.target && ev.target.closest ? ev.target.closest('button[data-nf]') : null;
  if (chip && els.chips.contains(chip)) { toggleChip(chip); return; }
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-na]') : null;
  if (!b || !root.contains(b) || b.hidden) return;
  const a = b.getAttribute('data-na');
  if (a === 'export') { doExport(); return; }
  if (a === 'all-pages') { replace(notesHash(S.docId)); return; }
  if (a === 'undo') { doUndo(); return; }
  const row = rowByKey(b.getAttribute('data-key'));
  if (!row) return;
  if (a === 'goto') { gotoSource(row); return; }
  if (a === 'memo') { openMemo(row); return; }
  if (a === 'delete') askDelete(row);
}

function toggleChip(b) {
  const kind = b.getAttribute('data-nf');
  if (kind === 'color') {
    const c = b.getAttribute('data-color');
    const i = S.filter.colors.indexOf(c);
    if (i >= 0) S.filter.colors.splice(i, 1); else S.filter.colors.push(c);
  } else if (kind === 'memo' || kind === 'lost') {
    S.filter[kind] = !S.filter[kind];
  }
  render();
}

/** [원문으로] — 그 쪽을 열고, 칠하기가 끝나면 그 묶음으로(`revealFor`). 문서가 없으면 단추가 없다. */
function gotoSource(row) {
  if (!row || !S.live.has(row.docId) || !(row.pageNo >= 1)) return;
  pendingReveal = { docId: row.docId, page: row.pageNo, ids: row.ids.slice(), at: Date.now() };
  lastReveal = null;
  go(readerHash(row.docId, row.pageNo));
}

/** 칠한 결과에서 그 묶음 첫 구간을 편안 영역 안으로. 못 찾으면 쪽 처음 + 한 줄(배너). */
function revealFor(x, placed) {
  const ids = new Set(x.ids);
  const hits = placed.filter((p) => p && p.rec && p.res && ids.has(String(p.rec.id)) && Array.isArray(p.res.ranges) && p.res.ranges.length)
    .sort((a, b) => (Number(a.res.at) || 0) - (Number(b.res.at) || 0));
  let shown = false;
  let lineId = null;
  if (hits.length) {
    const r0 = hits[0].res.ranges[0];
    lineId = String(r0.id);
    try { shown = revealLine(lineId, { start: r0.start, end: r0.end }) !== false; } catch (e) { shown = false; }
  }
  if (!shown) {
    try { revealTop(); } catch (e) { /* 쪽은 열렸다 */ }
    document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { key: 'notes.lostBanner', tone: 'warn' } }));
  }
  lastReveal = { found: shown, lost: !shown, lineId: shown ? lineId : null, n: hits.length };
}

/* ── 메모(페이지 안 대화) ───────────────────────────── */

function openMemo(row) {
  const dlg = els.memo;
  if (!dlg) return;
  memoRow = row;
  applyTranslations(dlg);
  els.memoQuote.textContent = row.quote.length > 240 ? row.quote.slice(0, 240) + '…' : row.quote;
  els.memoText.value = str(row.note).slice(0, ANNO.NOTE_MAX);
  els.memoText.maxLength = ANNO.NOTE_MAX;
  els.memoStatus.textContent = '';
  paintMemoCount();
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  watchKeyboard(true);
  fitKeyboard();
  try { els.memoText.focus(); } catch (e) { /* 그대로 */ }
}

/* ── 키보드 — `visualViewport` 로 대화 높이를 보이는 뷰포트에(20-2 메모 시트와 같은 `keyboardInset`) ── */
let vvOn = false;
function vv() { return typeof window !== 'undefined' ? window.visualViewport || null : null; }
function fitKeyboard() {
  if (!els || !els.memo || !els.memo.open) return;
  const v = vv();
  const k = keyboardInset(window.innerHeight, v);
  if (k > 0) { els.memo.setAttribute('data-kb', 'on'); els.memo.style.setProperty('--nm-vh', Math.round(Number(v.height)) + 'px'); }
  else { els.memo.removeAttribute('data-kb'); els.memo.style.removeProperty('--nm-vh'); }
}
function watchKeyboard(on) {
  const v = vv();
  if (!on && els && els.memo) { els.memo.removeAttribute('data-kb'); els.memo.style.removeProperty('--nm-vh'); }
  if (!v || typeof v.addEventListener !== 'function') return;
  if (on && !vvOn) { v.addEventListener('resize', fitKeyboard); v.addEventListener('scroll', fitKeyboard); vvOn = true; }
  if (!on && vvOn) { v.removeEventListener('resize', fitKeyboard); v.removeEventListener('scroll', fitKeyboard); vvOn = false; }
}

function paintMemoCount() {
  els.memoCount.textContent = t('anno.note.count', { n: formatNumber(els.memoText.value.length), max: formatNumber(ANNO.NOTE_MAX) });
}

async function onMemoClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-memo]') : null;
  if (!b) return;
  const a = b.getAttribute('data-memo');
  if (a === 'close') { closeDialog(els.memo); memoRow = null; return; }
  if (a !== 'save' || !memoRow) return;
  const row = memoRow;
  const r = await flow.saveNote(row, els.memoText.value);
  if (!r.ok) { els.memoStatus.textContent = t(r.key); return; }
  closeDialog(els.memo);
  memoRow = null;
  setStatus(r.key);
  if (r.gone && r.gone.length) showUndo(r.gone);
  await load();
}

/* ── 지우기 — 메모 없는 것은 바로(3초 [되돌리기]), 메모 있는 것은 페이지 안 확인 ── */

function askDelete(row) {
  if (!flow.hasNote(row)) { removeRow(row); return; }
  const dlg = els.del;
  delRow = row;
  applyTranslations(dlg);
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  const cancel = dlg.querySelector('button[data-dialog="cancel"]');
  if (cancel) { try { cancel.focus(); } catch (e) { /* 그대로 */ } }
}

async function onDelClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-dialog]') : null;
  if (!b) return;
  const row = delRow;
  const ok = b.getAttribute('data-dialog') === 'ok';
  closeDialog(els.del);
  delRow = null;
  if (ok && row) await removeRow(row);
}

async function removeRow(row) {
  const gone = await flow.remove(row);
  if (!gone.length) { setStatus('anno.failed'); return; }
  setStatus(null);
  showUndo(gone);
  await load();
  // 지운 줄은 사라졌다 — 포커스를 목록 머리(책 고르기)로(문서 끝으로 떨어지지 않게)
  try { els.scope.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ }
}

function showUndo(gone) {
  // 3초 안에 또 지우면 앞 것도 함께 되살린다(쪽 필기 시트와 같은 규칙 — 20-2R #4)
  undoGone = mergeGone(undoGone && !els.undo.hidden ? undoGone : null, gone);
  if (undoTimer !== null) clearTimeout(undoTimer);
  els.undoText.textContent = t('anno.removed');
  els.undo.hidden = false;
  undoTimer = setTimeout(hideUndo, UNDO_MS);
}

function hideUndo() {
  if (undoTimer !== null) { clearTimeout(undoTimer); undoTimer = null; }
  undoGone = null;
  if (els && els.undo) els.undo.hidden = true;
}

async function doUndo() {
  const gone = undoGone;
  hideUndo();
  if (!gone) return;
  const n = await flow.undo(gone);
  setStatus(n ? 'anno.restored' : 'anno.failed');
  await load();
}

function closeDialog(dlg) {
  if (!dlg) return;
  if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
}

/* ── 내보내기(호출 0) ─────────────────────────────── */

function exportLabels() {
  const m = docsById();
  return {
    untitled: t('notes.untitled'),
    chapter: (h) => chapterText(h, false),
    pageHead: (h, b) => pageLabelOf(b.gone ? null : m.get(b.docId) || null, h.page),
    page: (r, b) => pageLabelOf(b.gone ? null : m.get(b.docId) || null, r.pageNo),
    color: (r) => (r.color ? t('notes.filter.' + r.color) : t('notes.filter.note')),
    gone: () => t('notes.goneHint')
  };
}

function doExport() {
  const nowMs = Date.now();
  let name = '';
  try {
    const rows = visibleRows();
    const text = exportMarkdown(viewBooks(rows, S.docs), exportLabels());
    name = exportName(nowMs);
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.hidden = true;
    root.appendChild(a);
    a.click();
    root.removeChild(a);
    // 내려받기가 시작된 뒤 거둔다(바로 거두면 일부 브라우저가 받지 못한다 — 11-3 과 같은 장치)
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* 이미 거둠 */ } }, 30000);
    lastExport = { name: name, lines: text.split('\r\n').length - 1, rows: rows.length };
  } catch (e) {
    setStatus('notes.export.failed');
    return;
  }
  setStatus('notes.export.done', { name: name });
}

function banner(err) {
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { code: (err && err.code) || 'ERR_UNKNOWN', tone: 'error' } }));
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(수·키·불리언만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  g.notesScreen = {
    state: function () {
      if (!els) return null;
      const items = Array.from(els.list.querySelectorAll('.notes-item'));
      return {
        docId: S.docId, range: S.range ? Object.assign({}, S.range) : null, recs: S.recs.length, rows: S.rows.length,
        shown: items.length, books: els.list.querySelectorAll('.notes-book').length, heads: Array.from(els.list.querySelectorAll('.notes-head')).length,
        order: items.map((li) => li.getAttribute('data-id')), lost: S.lost.size, lostReady: !!S.lostReady,
        lostShown: items.filter((li) => li.hasAttribute('data-lost')).length, gone: els.list.querySelectorAll('.notes-gone').length,
        filter: { colors: S.filter.colors.slice(), memo: S.filter.memo, lost: S.filter.lost },
        goto: els.list.querySelectorAll('[data-na="goto"]').length, exportShown: !els.exportBtn.hidden, shareShown: !els.share.hidden,
        delOpen: !!(els.del && els.del.open), memoOpen: !!(els.memo && els.memo.open), undo: !els.undo.hidden,
        lastReveal: lastReveal, lastExport: lastExport, empty: !els.empty.hidden
      };
    }
  };
}
