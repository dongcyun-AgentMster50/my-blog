/* ============================================================
   MedReader — 그림 개념도: 그리기 · 시트 · 작은 그림 · 내보내기 (spec 17-14 4 · 6 · 7 "16-2" · 16-D6–D11 — 16-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
     · 자리: 11-3 모아 보기의 **저장한 개요** 줄과 15 복습 묶음의 개요 칸 — `diagramControl(rec, ctx)` 하나가
       그림이 없으면 [개념도 그리기 (호출 1)], 있으면 작은 그림(누르면 시트)을 낸다.
     · 시트 `#dgSheet`(index.html — 화면 밖 한 그릇, 11 요약 시트와 같은 높이 식): 그림(`<figure>` 안 SVG) · [크게]/[전체 보기] ·
       [다시 그리기 (호출 1)](먼저 묻는다 — `force`) · [그림 저장](SVG 파일 — 호출 0) · 고지 · "글로 보기"(`<details open>` 트리 + 관계 `<ol>`).
     · 저장(16-D6): 받은 그림은 그 개요 레코드의 `diagram` 필드(`notes/summaries.saveDiagram` — DB 3 그대로). 배치는 저장하지 않는다
       (화면 폭·RTL 이 바뀌면 다시 계산 — 호출 0). 개요를 다시 만들어 `cacheKey` 가 바뀌면 "개요가 바뀌었습니다 — [다시 그리기]".

   ── 지키는 것 ──────────────────────────────────────────
   ★ 호출(6절): [개념도 그리기] 미적중 1 / 적중 0 · [다시 그리기] 1(먼저 묻는다) · 열기·크게·글로 보기·회전·RTL·그림 저장 **0**. 자동 0.
     요청은 `pipeline.diagram` 하나(요약 시트가 controls 에서 받은 **같은** 파이프라인 — `sumsheet.sumServices()`).
     `diagram()` 에는 개요 레코드의 `target` 만 넘긴다(16-1R 낮음-5 — 개요 언어와 TASK 언어가 어긋나지 않게).
   ★ `innerHTML` 0 — SVG 는 `createElementNS` 만, 글자는 `textContent`(노드 라벨·제목은 AI 글 — `<img onerror>` 꼴도 글자로만 보인다).
   ★ 그리기 순서: 선(엣지) → 노드 → 엣지 라벨 — 선이 노드 상자 **아래**로 지나 가려진다(16-1R 낮음-2). viewBox 는 라벨 상자까지 넣어
     라벨이 그림 밖으로 잘리지 않는다(낮음-3).
   ★ 대상 언어 줄은 `direction` = dir, 원어(src) 줄은 따로 된 `<text direction="ltr" lang=src>` — 한 줄에 두 방향을 섞지 않는다(16-D8).
     관계 이름은 UI 언어가 아니라 **대상 언어** 사전의 `diagram.rel.*`(없으면 en).
   ★ 글자 폭 `measure` = 캔버스 `measureText`(화면과 같은 글꼴 문자열 — `--font-ui`/`--font-ar` + 아래 `DG_FONT` 크기).
   ★ 크기(16-D9): 기본 "전체 보기"(그릇 폭에 접어 배치 · 줄이기만). 가장 작은 글자가 실제 12px 아래로 줄어들 비율이면 [크게]
     (접지 않고 1:1 — 그릇 안 가로·세로 스크롤, 쪽 가로 스크롤 0).
   ★ 1절(순수)·2절(흐름 — DOM 없음)·3절(그리기 — `doc` 주입)은 `tests/diagram-ui-16.test.mjs` 가 잰다. 4절이 시트.
   ============================================================ */

import { t, dirOf, formatNumber, BUNDLES, applyTranslations, onLangChange } from '../i18n/index.js';
import * as settings from '../settings.js';
import { DIAGRAM } from '../config.js';
import { layoutDiagram } from '../text/diagram.js';
import { renderTree } from './tree.js';
import { appendBidiText } from './bididom.js';
import { sumServices, itemNote } from './sumsheet.js';
import { summaryStore } from '../notes/summaries.js';
import { RETRYABLE_REMOTE, TAP_BANNER_NOW, noticeBanner } from './trband.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

export const SVG_NS = 'http://www.w3.org/2000/svg';
/** 그림 글자 크기(px) — 배치 상수(`DIAGRAM.LAYOUT` 줄 높이 16·13·라벨 14)에 맞춘 값. 캔버스 measure 도 이 크기로 잰다. */
export const DG_FONT = Object.freeze({ label: 13, src: 12, edge: 12 });
/** 이보다 작게 줄어들면 [크게](16-D9). */
export const MIN_FONT_PX = 12;
/** 작은 그림 상자(px) — 이 안으로 줄인다(글자는 읽히지 않아도 된다 — 누르면 시트). */
export const THUMB = Object.freeze({ W: 280, H: 140 });

function arr(v) { return Array.isArray(v) ? v : []; }
function str(v) { return typeof v === 'string' ? v : ''; }

/** 언어 코드의 기본 부분(`ar-EG` → `ar`). */
function baseLang(l) { return String(l || '').replace(/_/g, '-').split('-')[0].toLowerCase(); }

/**
 * 관계 이름 — **대상 언어** 사전(4개 중 그 언어 — 없으면 en)의 `diagram.rel.*`. 목록 밖 값은 그대로(그리기 전에 `graphOf` 가 거른다).
 * @param {string} lang 대상 언어
 * @returns {(r:string)=>string}
 */
export function relLabelsFor(lang) {
  const b = BUNDLES[baseLang(lang)] || null;
  const en = BUNDLES.en || {};
  return (r) => {
    const k = 'diagram.rel.' + String(r);
    if (b && typeof b[k] === 'string') return b[k];
    return typeof en[k] === 'string' ? en[k] : String(r);
  };
}

/**
 * 저장한 개요의 그림(`rec.diagram`) → 그릴 그래프. 파일(9c 백업)에서 온 값일 수도 있어 다시 거른다: id·라벨이 글자인 노드,
 * 있는 노드를 잇는 목록 안 관계(`DIAGRAM.RELS`)만. 그릴 것이 없으면 null.
 * @returns {?{title:string, nodes:{id:string,t:string,src?:string,p:string}[], edges:{a:string,b:string,r:string,p:string}[]}}
 */
export function graphOf(rec) {
  const d = rec && rec.diagram && typeof rec.diagram === 'object' ? rec.diagram : null;
  if (!d) return null;
  const nodes = [];
  const ids = new Set();
  for (const n of arr(d.nodes)) {
    if (!n || typeof n !== 'object') continue;
    const id = typeof n.id === 'string' ? n.id : (Number.isInteger(n.id) ? String(n.id) : '');
    const tt = str(n.t).replace(/\s+/g, ' ').trim();
    if (!id || !tt || ids.has(id)) continue;
    ids.add(id);
    const x = { id: id, t: tt, p: str(n.p) };
    const s = str(n.src).replace(/\s+/g, ' ').trim();
    if (s) x.src = s;
    nodes.push(x);
  }
  const edges = [];
  for (const e of arr(d.edges)) {
    if (!e || typeof e !== 'object') continue;
    const a = typeof e.a === 'string' ? e.a : String(e.a);
    const b = typeof e.b === 'string' ? e.b : String(e.b);
    if (!ids.has(a) || !ids.has(b) || a === b || DIAGRAM.RELS.indexOf(e.r) < 0) continue;
    edges.push({ a: a, b: b, r: e.r, p: str(e.p) });
  }
  if (!nodes.length) return null;
  return { title: str(d.title).replace(/\s+/g, ' ').trim(), nodes: nodes, edges: edges };
}

/** 그림을 그린 뒤 개요가 바뀌었는가(그림의 `basis` ≠ 개요 `cacheKey`). 그림이 없으면 false. */
export function isStale(rec) {
  if (!rec || !rec.diagram || typeof rec.diagram !== 'object') return false;
  return str(rec.diagram.basis) !== str(rec.cacheKey);
}

/**
 * 파이프라인 결과 → 개요 레코드에 붙일 `diagram` 필드(16-D6). 배치(좌표)는 담지 않는다.
 * @param {{title:string, nodes:Array, edges:Array}} value `checkDiagram` 이 거른 값
 * @param {{basis?:string, target?:string, promptVersion?:number, model?:string}} out `pipeline.diagram` 의 반환
 */
export function diagramField(value, out, nowMs) {
  const v = value || {};
  const o = out || {};
  return {
    nodes: JSON.parse(JSON.stringify(arr(v.nodes))), edges: JSON.parse(JSON.stringify(arr(v.edges))), title: str(v.title),
    basis: str(o.basis), target: str(o.target), promptVersion: Number.isFinite(Number(o.promptVersion)) ? Number(o.promptVersion) : null,
    model: str(o.model) || null, createdAt: Number(nowMs) || 0
  };
}

/** 줄임 비율 — 그릇 폭에 맞추되 키우지 않는다. */
export function fitScale(vbW, availW) {
  const w = Number(vbW);
  const a = Number(availW);
  if (!(w > 0) || !(a > 0)) return 1;
  return Math.min(1, a / w);
}

/** 그 비율이면 가장 작은 글자가 12px 아래인가(→ [크게]). */
export function zoomNeeded(vbW, availW) {
  const min = Math.min(DG_FONT.label, DG_FONT.src, DG_FONT.edge);
  return min * fitScale(vbW, availW) < MIN_FONT_PX - 1e-9;
}

/**
 * 엣지 라벨 상자 — 배치와 같은 식(`ceil(measure) + 2·LABEL_PAD_X` × `LABEL_H`, 가운데 `(lx, ly)`).
 * @returns {{x:number, y:number, w:number, h:number}[]}
 */
export function edgeBoxes(layout, measure, labelOf, P) {
  const p = Object.assign({}, DIAGRAM.LAYOUT, P || {});
  return arr(layout && layout.edges).map((e) => {
    const w = Math.ceil(Number(measure(labelOf(e.r), 'edge')) || 0) + 2 * p.LABEL_PAD_X;
    return { x: e.lx - w / 2, y: e.ly - p.LABEL_H / 2, w: w, h: p.LABEL_H };
  });
}

/** viewBox — 그림 `[0, 0, w, h]` 에 노드·선·라벨 상자를 모두 넣고 둘레 여백(16-1R 낮음-3: 라벨이 잘리지 않게). */
export function viewBoxOf(layout, boxes, pad) {
  const L = layout || {};
  const m = Number.isFinite(Number(pad)) ? Number(pad) : 2;
  let x0 = 0;
  let y0 = 0;
  let x1 = Number(L.w) || 0;
  let y1 = Number(L.h) || 0;
  const take = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const n of arr(L.nodes)) { take(n.x, n.y); take(n.x + n.w, n.y + n.h); }
  for (const e of arr(L.edges)) for (const pt of arr(e.pts)) take(pt[0], pt[1]);
  for (const b of arr(boxes)) { take(b.x, b.y); take(b.x + b.w, b.y + b.h); }
  const fx = Math.floor(x0 - (x0 < 0 ? m : 0));
  const fy = Math.floor(y0 - (y0 < 0 ? m : 0));
  return { x: fx, y: fy, w: Math.ceil(x1 + (x1 > (Number(L.w) || 0) ? m : 0)) - fx, h: Math.ceil(y1 + (y1 > (Number(L.h) || 0) ? m : 0)) - fy };
}

/**
 * 관계 목록(글로 보기 — 16-D7) 줄 — "{a} → {관계} → {b}"(대상 언어, RTL 이면 ←), 줄마다 개요 경로 꼬리표 `p`. 엣지 수와 같다.
 * @returns {{p:string, text:string}[]}
 */
export function relationLines(graph, labelOf, dir) {
  const g = graph || {};
  const name = new Map(arr(g.nodes).map((n) => [n.id, n.t]));
  const ar = dir === 'rtl' ? ' ← ' : ' → ';
  return arr(g.edges).map((e) => ({ p: str(e.p), text: String(name.get(e.a) || '') + ar + labelOf(e.r) + ar + String(name.get(e.b) || '') }));
}

/** 파일 이름 `medreader-diagram-YYYYMMDD.svg`(기기 날짜). */
export function exportName(nowMs) {
  const d = new Date(Number(nowMs) || 0);
  const p = (n) => String(n).padStart(2, '0');
  return 'medreader-diagram-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.svg';
}

/** 글자 수 × 7px — 캔버스가 없을 때(시험·옛 브라우저)의 measure. */
export function charMeasure(s, kind) {
  const n = Array.from(String(s == null ? '' : s)).length;
  return n * (kind === 'src' || kind === 'edge' ? 6.5 : 7);
}

/* ────────────────────────────────────────────────────────
   2. 흐름 — 그리기 · 다시 그리기(DOM 없음)
   ──────────────────────────────────────────────────────── */

/** 파이프라인 `FAIL.FEW_RELATIONS` 의 값(화면은 파이프라인을 import 하지 않는다 — 시험 G5 가 두 값이 같은지 잰다). */
export const FEW_CODE = 'FEW_RELATIONS';

/**
 * 개념도 하나의 상태 기계. 한 번 누름 = 최대 1호출(`pipeline.diagram`). 늦게 온 결과는 화면에 쓰지 않는다(`gen`) — 받은 그림은 저장한다
 * (사용자가 부른 호출의 값이다).
 * @param {{diagram:(rec:Object, opts:Object)=>Promise<Object>, save:(id:string, field:Object)=>Promise<?{rec:Object}>,
 *          unblock?:()=>Promise<*>, gate?:()=>{ok:boolean, reason?:string}, onChange?:(v:Object)=>void, now?:()=>number}} deps
 */
export function createDiagramFlow(deps) {
  const d = deps || {};
  const now = typeof d.now === 'function' ? d.now : () => Date.now();
  let st = { state: 'idle', code: null, gate: false, rec: null, graph: null, src: '', calls: 0, asking: false, note: null, banner: null, saved: false };
  let gen = 0;

  function noteOf(s) {
    if (s.note) return s.note;
    switch (s.state) {
      case 'pending': return { key: 'diagram.pending', retry: false };
      case 'too-big': return { key: 'diagram.tooBig', retry: false };
      case 'failed': return { key: s.code === FEW_CODE ? 'diagram.few' : 'diagram.failed', retry: true };
      case 'skipped': return { key: s.code === 'empty' ? 'diagram.empty' : (itemNote({ state: 'skipped', code: s.code }) || {}).key || 'diagram.failed', retry: false };
      case 'blocked': {
        const n = itemNote({ state: 'blocked', code: s.code, gate: s.gate });
        return n ? { key: n.key, retry: !!n.retry } : null;
      }
      default: return null;
    }
  }
  function view() {
    return {
      state: st.state, code: st.code, rec: st.rec, graph: st.graph, calls: st.calls, asking: st.asking, saved: st.saved,
      stale: isStale(st.rec), note: noteOf(st), banner: st.banner
    };
  }
  function emit() { if (typeof d.onChange === 'function') { try { d.onChange(view()); } catch (e) { /* 그리기 오류가 흐름을 막지 않는다 */ } } }
  function gateNow() { try { return typeof d.gate === 'function' ? (d.gate() || { ok: true }) : { ok: true }; } catch (e) { return { ok: true }; } }

  /** 시트를 연다 — 저장한 그림이 있으면 그것(호출 0), 없으면 빈 채. */
  function open(rec, ctx) {
    gen++;
    const calls = st.calls;
    const g = graphOf(rec);
    st = { state: g ? 'ready' : 'idle', code: null, gate: false, rec: rec || null, graph: g, src: str(ctx && ctx.src), calls: calls,
      asking: false, note: null, banner: null, saved: !!g };
    emit();
    return view();
  }

  async function run(my, extra) {
    const rec = st.rec;
    st.note = null;
    st.banner = null;
    st.asking = false;
    const g = gateNow();
    if (!g.ok) {
      Object.assign(st, { state: 'blocked', code: g.reason || null, gate: true });
      if (TAP_BANNER_NOW.indexOf(g.reason) >= 0) st.banner = g.reason;
      emit();
      return view();
    }
    const keep = st.graph;
    Object.assign(st, { state: 'pending', code: null, gate: false });
    emit();
    let out = null;
    try {
      // ★ 개요 레코드의 `target` 만(16-1R 낮음-5). 원문 언어(`src`)는 원어 칸 몫 — 대상과 같으면 파이프라인이 뺀다.
      out = await d.diagram(rec, Object.assign({ target: str(rec && rec.target), src: st.src, docId: rec && rec.docId, domain: str(rec && rec.domain) }, extra || {}));
    } catch (e) { out = null; }
    const calls = (out && Number(out.calls)) || 0;
    const it = out && Array.isArray(out.results) ? out.results[0] : null;
    let saved = null;
    let field = null;
    if (it && it.state === 'ready' && it.value && rec && rec.id != null) {
      field = diagramField(it.value, out, now());
      try { saved = await d.save(String(rec.id), field); } catch (e) { saved = null; }
    }
    if (my !== gen) { st.calls += calls; return view(); }
    st.calls += calls;
    if (field) {
      const r2 = saved && saved.rec ? saved.rec : Object.assign({}, rec, { diagram: field });
      Object.assign(st, { state: 'ready', rec: r2, graph: graphOf(r2), saved: !!(saved && saved.rec) });
      if (!st.saved) st.note = { key: 'sum.saveFailed', retry: false };
    } else if (out && out.status === 'too-big') {
      Object.assign(st, { state: 'too-big', code: 'too-big', graph: keep });
    } else if (it && (it.state === 'blocked' || it.state === 'skipped')) {
      Object.assign(st, { state: it.state, code: it.code || null, graph: keep });
      if (st.state === 'blocked' && TAP_BANNER_NOW.indexOf(st.code) >= 0) st.banner = st.code;
    } else {
      Object.assign(st, { state: 'failed', code: (it && it.code) || null, graph: keep });
    }
    emit();
    return view();
  }

  /** [개념도 그리기] — 저장한 그림이 있으면 그것을 보인다(호출 0). */
  async function draw() {
    if (!st.rec || st.state === 'pending') return view();
    if (st.graph) return view();
    return run(++gen, null);
  }
  /** [다시 그리기] — 먼저 묻는다(호출 1이 든다). */
  function askRedraw() {
    if (!st.rec || st.state === 'pending') return view();
    st.asking = true;
    emit();
    return view();
  }
  function cancelAsk() { st.asking = false; emit(); return view(); }
  /** 물음에 [다시 그리기] — `force`(캐시를 건너뛰고 1호출). */
  async function redraw() {
    if (!st.rec || st.state === 'pending' || !st.asking) return view();
    return run(++gen, { force: true });
  }
  /** [다시 시도] — 막힌 원격 상태면 `unblock` 먼저(사용자 동작만 — 자동 재시도 0). */
  async function retry() {
    if (!st.rec || st.state === 'pending' || st.state === 'ready') return view();
    const my = ++gen;
    if (st.state === 'blocked' && !st.gate && RETRYABLE_REMOTE.indexOf(st.code) >= 0 && typeof d.unblock === 'function') {
      try { await d.unblock(); } catch (e) { /* 그래도 한 번 보낸다 */ }
      if (my !== gen) return view();
    }
    return run(my, { retry: true });
  }
  function close() { gen++; st.asking = false; }
  function bannerShown() { st.banner = null; }

  return { open: open, draw: draw, askRedraw: askRedraw, cancelAsk: cancelAsk, redraw: redraw, retry: retry, close: close, view: view, bannerShown: bannerShown };
}

/* ────────────────────────────────────────────────────────
   3. 그리기 — `<svg>`(createElementNS 만 · textContent 만)
   ──────────────────────────────────────────────────────── */

let uidSeq = 0;

function svgEl(doc, tag, attrs, cls) {
  const n = doc.createElementNS(SVG_NS, tag);
  if (cls) n.setAttribute('class', cls);
  for (const k of Object.keys(attrs || {})) n.setAttribute(k, String(attrs[k]));
  return n;
}
function r1(v) { return Math.round(Number(v) * 10) / 10; }

/**
 * 배치 → `<svg>`. 층: 선(엣지) → 노드 → 엣지 라벨(선이 노드 아래로 — 가려진다).
 * @param {Object} layout `layoutDiagram` 결과
 * @param {{doc?:Document, dir?:string, lang?:string, srcLang?:string, labelOf?:(r:string)=>string, measure?:Function, title?:string,
 *          desc?:string, thumb?:boolean, scale?:number, P?:Object}} [opts]
 * @returns {?{svg:Element, vb:{x:number,y:number,w:number,h:number}, uid:string}}
 */
export function renderDiagram(layout, opts) {
  const o = opts || {};
  const doc = o.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc || !layout) return null;
  const P = Object.assign({}, DIAGRAM.LAYOUT, o.P || {});
  const dir = o.dir === 'rtl' ? 'rtl' : 'ltr';
  const lang = str(o.lang);
  const srcLang = str(o.srcLang) || 'en';
  const labelOf = typeof o.labelOf === 'function' ? o.labelOf : (r) => String(r);
  const measure = typeof o.measure === 'function' ? o.measure : charMeasure;
  const arCls = (l) => (baseLang(l) === 'ar' ? ' dg-f-ar' : '');
  const uid = 'dg' + (++uidSeq);
  const boxes = edgeBoxes(layout, measure, labelOf, P);
  const vb = viewBoxOf(layout, boxes, 2);
  const scale = Number(o.scale) > 0 ? Number(o.scale) : 1;
  const svg = svgEl(doc, 'svg', {
    viewBox: vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h,
    width: Math.max(1, Math.round(vb.w * scale)), height: Math.max(1, Math.round(vb.h * scale))
  }, 'dg-svg' + (o.thumb ? ' dg-svg-thumb' : ''));
  if (lang) svg.setAttribute('lang', lang);
  if (o.thumb) {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  } else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', uid + '-t ' + uid + '-d');
    const ti = svgEl(doc, 'title', { id: uid + '-t' });
    ti.textContent = str(o.title);
    svg.appendChild(ti);
    const de = svgEl(doc, 'desc', { id: uid + '-d' });
    de.textContent = str(o.desc);
    svg.appendChild(de);
  }
  const defs = svgEl(doc, 'defs');
  const mk = svgEl(doc, 'marker', { id: uid + '-m', viewBox: '0 0 8 8', refX: 8, refY: 4, markerWidth: 8, markerHeight: 8,
    markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
  mk.appendChild(svgEl(doc, 'path', { d: 'M0,0 L8,4 L0,8 Z' }, 'dg-arrow'));
  defs.appendChild(mk);
  svg.appendChild(defs);

  // 1) 선 — 노드 아래 층
  const ge = svgEl(doc, 'g', null, 'dg-edges');
  for (const e of arr(layout.edges)) {
    const pts = arr(e.pts);
    if (pts.length < 2) continue;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + r1(p[0]) + ',' + r1(p[1])).join(' ');
    const path = svgEl(doc, 'path', { d: d, fill: 'none' }, 'dg-edge');
    path.setAttribute(e.rev ? 'marker-start' : 'marker-end', 'url(#' + uid + '-m)');
    path.setAttribute('data-a', String(e.a));
    path.setAttribute('data-b', String(e.b));
    ge.appendChild(path);
  }
  svg.appendChild(ge);

  // 2) 노드 — 상자 + 대상 언어 줄(tspan) + 원어 줄(따로 된 <text> ltr)
  const gn = svgEl(doc, 'g', null, 'dg-nodes');
  for (const n of arr(layout.nodes)) {
    const g = svgEl(doc, 'g', null, 'dg-node-g');
    g.setAttribute('data-id', String(n.id));
    g.appendChild(svgEl(doc, 'rect', { x: r1(n.x), y: r1(n.y), width: r1(n.w), height: r1(n.h), rx: 6 }, 'dg-node'));
    const cx = r1(n.x + n.w / 2);
    const tx = svgEl(doc, 'text', { x: cx, 'text-anchor': 'middle', direction: dir }, 'dg-node-t' + arCls(lang));
    arr(n.lines).forEach((line, k) => {
      const ts = svgEl(doc, 'tspan', { x: cx, y: r1(n.y + P.PAD_Y + (k + 1) * P.LINE_H - 4) });
      ts.textContent = String(line);
      tx.appendChild(ts);
    });
    g.appendChild(tx);
    if (n.srcLine) {
      const sy = n.y + P.PAD_Y + arr(n.lines).length * P.LINE_H + P.SRC_LINE_H - 2;
      const sx = svgEl(doc, 'text', { x: cx, y: r1(sy), 'text-anchor': 'middle', direction: 'ltr', lang: srcLang }, 'dg-src' + arCls(srcLang));
      sx.textContent = String(n.srcLine);
      g.appendChild(sx);
    }
    gn.appendChild(g);
  }
  svg.appendChild(gn);

  // 3) 엣지 라벨 — 배경 상자 + 글(대상 언어 방향)
  const gl = svgEl(doc, 'g', null, 'dg-labels');
  arr(layout.edges).forEach((e, i) => {
    const b = boxes[i];
    gl.appendChild(svgEl(doc, 'rect', { x: r1(b.x), y: r1(b.y), width: r1(b.w), height: r1(b.h), rx: 3 }, 'dg-label-bg'));
    const tl = svgEl(doc, 'text', { x: r1(e.lx), y: r1(e.ly + 4), 'text-anchor': 'middle', direction: dir }, 'dg-label' + arCls(lang));
    tl.textContent = labelOf(e.r);
    gl.appendChild(tl);
  });
  svg.appendChild(gl);
  return { svg: svg, vb: vb, uid: uid };
}

/**
 * 글로 보기(16-D7) — `<details open>` "글로 보기": 11c 트리(`renderTree`) + 관계 `<ol>`(줄마다 경로 꼬리표). 화면 읽기는 그림을
 * 이름 하나로 건너뛰고 이 목록을 읽는다.
 */
export function renderAlt(rec, graph, opts) {
  const o = opts || {};
  const doc = o.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  const lang = str(rec && rec.target);
  const dir = dirOf(lang);
  const det = doc.createElement('details');
  det.className = 'dg-alt';
  det.open = true;
  const sm = doc.createElement('summary');
  sm.textContent = t('diagram.alt');
  det.appendChild(sm);
  const tree = renderTree(rec && rec.points, { dir: dir, lang: lang, open: true, doc: doc });
  if (tree) det.appendChild(tree);
  const h = doc.createElement('p');
  h.className = 'dg-alt-h';
  h.textContent = t('diagram.rels');
  det.appendChild(h);
  const ol = doc.createElement('ol');
  ol.className = 'dg-rels';
  if (lang) ol.setAttribute('lang', lang);
  ol.setAttribute('dir', dir);
  for (const x of relationLines(graph, typeof o.labelOf === 'function' ? o.labelOf : relLabelsFor(lang), dir)) {
    const li = doc.createElement('li');
    const p = doc.createElement('span');
    p.className = 'dg-path';
    p.setAttribute('dir', 'ltr');
    p.textContent = x.p;
    li.appendChild(p);
    const s = doc.createElement('span');
    s.className = 'dg-rel-t';
    appendBidiText(s, x.text, dir);
    li.appendChild(s);
    ol.appendChild(li);
  }
  det.appendChild(ol);
  return det;
}

/* ── 브라우저 measure — 캔버스 measureText, 화면과 같은 글꼴 문자열 ── */
let canvasCtx = null;
function fontFamilyOf(lang) {
  try {
    const cs = getComputedStyle(document.documentElement);
    const v = (baseLang(lang) === 'ar' ? cs.getPropertyValue('--font-ar') : cs.getPropertyValue('--font-ui')).trim();
    return v || 'sans-serif';
  } catch (e) { return 'sans-serif'; }
}
/** @returns {(s:string, kind?:string)=>number} */
export function browserMeasure(lang, srcLang) {
  if (typeof document === 'undefined') return charMeasure;
  if (!canvasCtx) {
    try { canvasCtx = document.createElement('canvas').getContext('2d'); } catch (e) { canvasCtx = null; }
  }
  if (!canvasCtx) return charMeasure;
  const fonts = {
    label: DG_FONT.label + 'px ' + fontFamilyOf(lang),
    edge: DG_FONT.edge + 'px ' + fontFamilyOf(lang),
    src: DG_FONT.src + 'px ' + fontFamilyOf(srcLang || 'en')
  };
  return (s, kind) => { canvasCtx.font = fonts[kind] || fonts.label; return canvasCtx.measureText(String(s)).width; };
}

/** 그 개요의 그림 한 판(배치 + SVG). `availW` 를 주면 그 폭에 접는다(라벨 여백까지 넘치면 한 번 더 좁혀 다시). */
function drawFor(rec, graph, o) {
  const lang = str(rec && rec.target);
  const dir = dirOf(lang);
  const labelOf = relLabelsFor(lang);
  const measure = o.measure || browserMeasure(lang, o.srcLang);
  const mk = (maxW) => layoutDiagram(graph, { measure: measure, maxW: maxW, rtl: dir === 'rtl', labelOf: labelOf });
  let lay = mk(o.maxW);
  let boxes = edgeBoxes(lay, measure, labelOf);
  let vb = viewBoxOf(lay, boxes, 2);
  if (Number(o.maxW) > 0 && vb.w > o.maxW) {
    lay = mk(Math.max(DIAGRAM.LAYOUT.NODE_MAX_W + 2 * DIAGRAM.LAYOUT.MARGIN, o.maxW - (vb.w - o.maxW)));
    boxes = edgeBoxes(lay, measure, labelOf);
    vb = viewBoxOf(lay, boxes, 2);
  }
  const scale = o.thumb ? Math.min(1, THUMB.W / vb.w, THUMB.H / vb.h) : (o.fit ? fitScale(vb.w, o.availW) : 1);
  const r = renderDiagram(lay, {
    dir: dir, lang: lang, srcLang: o.srcLang, labelOf: labelOf, measure: measure, thumb: !!o.thumb, scale: scale,
    title: graph.title || str(rec && rec.title) || t('diagram.title'),
    desc: t('diagram.desc', { n: formatNumber(graph.nodes.length), m: formatNumber(graph.edges.length) })
  });
  return r ? Object.assign(r, { layout: lay, scale: scale, dir: dir }) : null;
}

/* ────────────────────────────────────────────────────────
   4. 시트 · 작은 그림
   ──────────────────────────────────────────────────────── */

const SH = { els: null, flow: null, ctx: null, zoom: false, picked: false, opener: null, recId: null, last: null, lastExport: null, raf: 0 };

function initSheet() {
  if (SH.els || typeof document === 'undefined') return !!SH.els;
  const sheet = document.getElementById('dgSheet');
  if (!sheet) return false;
  const q = (id) => sheet.querySelector('#' + id);
  SH.els = {
    root: document.documentElement, sheet: sheet, head: q('dgHead'), status: q('dgStatus'), stale: q('dgStale'), ask: q('dgAsk'),
    fig: q('dgFig'), zoom: q('dgZoom'), redraw: q('dgRedraw'), exportBtn: q('dgExport'), retry: q('dgRetry'), alt: q('dgAlt')
  };
  SH.flow = createDiagramFlow({
    diagram: function (rec, o) { const sv = sumServices(); return sv && typeof sv.pipeline.diagram === 'function' ? sv.pipeline.diagram(rec, o) : Promise.resolve(null); },
    save: function (id, field) { const sv = sumServices(); return ((sv && sv.store) || summaryStore()).saveDiagram(id, field); },
    unblock: function () { const sv = sumServices(); return sv && typeof sv.pipeline.retry === 'function' ? sv.pipeline.retry() : null; },
    gate: function () { return settings.get('privacy.consentedAt') ? { ok: true, reason: null } : { ok: false, reason: 'consent' }; },
    onChange: onFlow
  });
  sheet.addEventListener('click', onSheetClick);
  document.addEventListener('keydown', onKey, true);
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => closeSheet(false));
    const relayout = () => {
      if (!isOpen() || SH.raf) return;
      const go = () => { SH.raf = 0; if (isOpen()) paint(SH.flow.view()); };
      SH.raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(go) : setTimeout(go, 16);
    };
    window.addEventListener('resize', relayout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
  }
  onLangChange(() => { if (SH.els && isOpen()) { applyTranslations(SH.els.sheet); paint(SH.flow.view()); } });
  attachDebugHook();
  return true;
}

function isOpen() { return !!SH.els && !SH.els.sheet.hidden; }

/** 그린 뒤 화면(모아 보기·묶음)이 작은 그림을 다시 그리도록 — 저장한 레코드를 넘긴다. */
let lastSavedRec = null;
function onFlow(v) {
  if (v.banner) { raiseBanner(v.banner); SH.flow.bannerShown(); }
  if (v.saved && v.rec && v.rec !== lastSavedRec && v.rec.diagram && SH.ctx && typeof SH.ctx.onSaved === 'function') {
    lastSavedRec = v.rec;
    try { SH.ctx.onSaved(v.rec); } catch (e) { /* 화면 새로 그리기 실패가 시트를 막지 않는다 */ }
  }
  if (isOpen()) paint(v);
}

/**
 * 시트를 연다. `draw` 면 그림이 없을 때 바로 그린다(사용자가 [개념도 그리기]를 눌렀다 — 최대 1호출).
 * @param {Object} rec 저장한 개요 레코드
 * @param {{src?:string, draw?:boolean, opener?:Element, onSaved?:(rec:Object)=>void}} [ctx]
 */
export function openDiagram(rec, ctx) {
  if (!rec || !initSheet()) return Promise.resolve(null);
  const c = ctx || {};
  SH.ctx = c;
  SH.opener = c.opener || null;
  SH.recId = rec.id == null ? null : String(rec.id);
  SH.picked = false;
  SH.zoom = false;
  lastSavedRec = rec;
  SH.flow.open(rec, { src: c.src });
  SH.els.sheet.hidden = false;
  SH.els.root.setAttribute('data-dg-sheet', 'on');
  applyTranslations(SH.els.sheet);
  paint(SH.flow.view());
  try { SH.els.head.focus({ preventScroll: true }); } catch (e) { /* 포커스 못 옮겨도 열린다 */ }
  attachDebugHook();
  if (c.draw && !SH.flow.view().graph) return SH.flow.draw();
  return Promise.resolve(SH.flow.view());
}

function closeSheet(back) {
  if (!isOpen()) return;
  SH.flow.close();
  SH.els.sheet.hidden = true;
  SH.els.root.removeAttribute('data-dg-sheet');
  clear(SH.els.fig);
  clear(SH.els.alt);
  const op = SH.opener;
  SH.opener = null;
  if (!back) return;
  // 16-2R 낮음-5 — 처음 그린 뒤에는 화면이 목록을 다시 그려(작은 그림) 연 단추가 사라진다 → 같은 개요의 새 조각 단추로
  let to = op && op.isConnected ? op : null;
  if (!to && SH.recId != null) {
    const ctl = Array.from(document.querySelectorAll('.dg-ctl[data-id]'))
      .find((x) => x.getAttribute('data-id') === SH.recId && x.getClientRects().length > 0);
    to = ctl ? ctl.querySelector('button') : null;
  }
  if (to) { try { to.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } }
}

function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

/** 시트 그리기 — 상태 줄 · 바뀜 줄 · 물음 · 그림 · 단추 · 글로 보기. 호출 0. */
function paint(v) {
  const e = SH.els;
  const rec = v.rec || {};
  const g = v.graph;
  const lang = str(rec.target);
  const tdir = dirOf(lang);
  // 머리 — "개념도 · {제목}"(제목은 AI 글 — 대상 언어 방향)
  clear(e.head);
  e.head.appendChild(document.createTextNode(t('diagram.title')));
  const ttl = (g && g.title) || str(rec.title);
  if (ttl) {
    e.head.appendChild(document.createTextNode(' · '));
    const s = document.createElement('span');
    s.className = 'dg-head-t';
    if (lang) s.setAttribute('lang', lang);
    s.setAttribute('dir', tdir);
    appendBidiText(s, ttl, tdir);
    e.head.appendChild(s);
  }
  const note = v.note;
  e.status.textContent = note ? t(note.key) : '';
  e.stale.hidden = !(g && v.stale) || v.state === 'pending';
  e.ask.hidden = !v.asking;
  const services = !!sumServices();
  e.redraw.hidden = !g || !services || v.state === 'pending' || v.asking;
  e.retry.hidden = !(note && note.retry) || !services || v.state === 'pending';
  e.exportBtn.hidden = !g;
  e.zoom.hidden = !g;
  clear(e.fig);
  clear(e.alt);
  SH.last = null;
  if (!g) return;
  const avail = Math.max(120, Math.floor(e.fig.clientWidth || (e.sheet.clientWidth - 32) || 320));
  const srcLang = str(SH.ctx && SH.ctx.src);
  let r = null;
  if (!SH.zoom) {
    r = drawFor(rec, g, { maxW: avail, availW: avail, fit: true, srcLang: srcLang });
    // 가장 작은 글자가 12px 아래로 줄어들면 [크게](사용자가 단추로 고르기 전까지만 저절로)
    if (r && !SH.picked && zoomNeeded(r.vb.w, avail)) { SH.zoom = true; r = null; }
  }
  if (!r) r = drawFor(rec, g, { srcLang: srcLang });
  if (!r) return;
  e.fig.classList.toggle('dg-zoom', SH.zoom);
  const fig = document.createElement('figure');
  fig.className = 'dg-figure';
  fig.appendChild(r.svg);
  e.fig.appendChild(fig);
  e.zoom.textContent = t(SH.zoom ? 'diagram.fit' : 'diagram.zoom');
  e.zoom.setAttribute('aria-pressed', SH.zoom ? 'true' : 'false');
  const alt = renderAlt(rec, g);
  if (alt) e.alt.appendChild(alt);
  SH.last = { layout: r.layout, vb: r.vb, scale: r.scale, avail: avail, dir: r.dir, svg: r.svg };
}

function onSheetClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-dg]') : null;
  if (!b || !SH.els.sheet.contains(b) || b.hidden || b.getAttribute('aria-disabled') === 'true') return;
  const a = b.getAttribute('data-dg');
  if (a === 'close') { closeSheet(true); return; }
  if (a === 'zoom') { SH.zoom = !SH.zoom; SH.picked = true; paint(SH.flow.view()); try { SH.els.zoom.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } return; }
  if (a === 'redraw-ask') { SH.flow.askRedraw(); focusIn('[data-dg="redraw-yes"]'); return; }
  if (a === 'redraw-yes') { SH.flow.redraw(); return; }
  if (a === 'redraw-no') { SH.flow.cancelAsk(); focusIn('#dgRedraw'); return; }
  if (a === 'retry') { SH.flow.retry(); return; }
  if (a === 'export') doExport();
}

function focusIn(sel) {
  const x = SH.els.sheet.querySelector(sel);
  if (x && !x.hidden) { try { x.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } }
}

function onKey(ev) {
  if (!isOpen()) return;
  if ((ev.key === 'Escape' || ev.key === 'Esc') && !ev.defaultPrevented && !ev.isComposing) {
    ev.preventDefault();
    ev.stopPropagation();
    if (SH.flow.view().asking) { SH.flow.cancelAsk(); return; }
    closeSheet(true);
    return;
  }
  if (ev.key === 'Tab' && SH.els.sheet.contains(ev.target)) {
    const list = Array.from(SH.els.sheet.querySelectorAll('button, summary, [tabindex="0"]'))
      .filter((x) => !x.hidden && !x.disabled && x.getClientRects().length > 0);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    if (ev.shiftKey && i <= 0) { ev.preventDefault(); list[list.length - 1].focus(); }
    else if (!ev.shiftKey && i === list.length - 1) { ev.preventDefault(); list[0].focus(); }
  }
}

/**
 * 개요 줄·칸에 붙는 조각 — 그림이 있으면 작은 그림 단추(누르면 시트 — 호출 0), 없으면 [개념도 그리기 (호출 1)]
 * (파이프라인이 없으면 없음). 개요가 바뀌었으면 작은 그림 아래 한 줄.
 * @param {Object} rec 저장한 개요 레코드
 * @param {{src?:string, onSaved?:(rec:Object)=>void}} [ctx]
 * @returns {?Element}
 */
export function diagramControl(rec, ctx) {
  if (typeof document === 'undefined' || !rec || rec.kind !== 'outline') return null;
  const c = ctx || {};
  const wrap = document.createElement('div');
  wrap.className = 'dg-ctl';
  wrap.setAttribute('data-id', String(rec.id));
  const g = graphOf(rec);
  if (g) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dg-thumb';
    b.setAttribute('aria-label', t('diagram.open', { n: formatNumber(g.nodes.length), m: formatNumber(g.edges.length) }));
    try {
      const r = drawFor(rec, g, { thumb: true, maxW: 320, srcLang: c.src });
      if (r) b.appendChild(r.svg);
    } catch (e) { b.textContent = t('diagram.title'); }
    b.addEventListener('click', () => { openDiagram(rec, Object.assign({}, c, { opener: b, draw: false })); });
    wrap.appendChild(b);
    if (isStale(rec)) {
      const p = document.createElement('p');
      p.className = 'dg-stale-note';
      p.textContent = t('diagram.stale');
      wrap.appendChild(p);
    }
    return wrap;
  }
  if (!sumServices()) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'dg-draw';
  b.textContent = t('diagram.draw');
  b.addEventListener('click', () => { openDiagram(rec, Object.assign({}, c, { opener: b, draw: true })); });
  wrap.appendChild(b);
  return wrap;
}

/* ── 그림 저장(SVG 파일 — 호출 0). 토큰(CSS 변수)을 계산된 색으로 박아 내보낸다 ── */

const PAINT_PROPS = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight'];

/**
 * 화면의 `<svg>` → 혼자 열리는 SVG 파일 글. 요소마다 계산된 칠·선·글꼴을 속성으로 박고 `class` 를 지운다(파일에 `var(` 0).
 * 맨 앞에 배경 상자(시트 바탕색). 글자는 `XMLSerializer` 가 탈출한다(`innerHTML` 0).
 */
export function svgFileText(svg, bg) {
  const clone = svg.cloneNode(true);
  const src = [svg].concat(Array.from(svg.querySelectorAll('*')));
  const dst = [clone].concat(Array.from(clone.querySelectorAll('*')));
  for (let i = 0; i < src.length && i < dst.length; i++) {
    let cs = null;
    try { cs = getComputedStyle(src[i]); } catch (e) { cs = null; }
    if (cs) {
      for (const p of PAINT_PROPS) {
        const v = String(cs.getPropertyValue(p) || '').trim();
        if (v && v.indexOf('var(') < 0) dst[i].setAttribute(p, v);
      }
    }
    dst[i].removeAttribute('class');
    dst[i].removeAttribute('style');
  }
  const vb = String(clone.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
  clone.setAttribute('width', String(vb[2]));
  clone.setAttribute('height', String(vb[3]));
  const back = clone.ownerDocument.createElementNS(SVG_NS, 'rect');
  back.setAttribute('x', String(vb[0]));
  back.setAttribute('y', String(vb[1]));
  back.setAttribute('width', String(vb[2]));
  back.setAttribute('height', String(vb[3]));
  back.setAttribute('fill', bg && String(bg).indexOf('var(') < 0 ? String(bg) : '#ffffff');
  const defs = clone.querySelector('defs');
  clone.insertBefore(back, defs ? defs.nextSibling : clone.firstChild);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

function doExport() {
  const s = SH.last;
  if (!s || !s.svg) return;
  const name = exportName(Date.now());
  try {
    const bg = getComputedStyle(SH.els.sheet).backgroundColor;
    const text = svgFileText(s.svg, bg);
    const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.hidden = true;
    SH.els.sheet.appendChild(a);
    a.click();
    SH.els.sheet.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* 이미 거둠 */ } }, 30000);
    SH.lastExport = { name: name, bytes: text.length, hasVar: text.indexOf('var(') >= 0 };
    SH.els.status.textContent = t('diagram.export.done', { name: name });
  } catch (e) {
    SH.els.status.textContent = t('diagram.export.failed');
  }
}

function raiseBanner(code) {
  const b = noticeBanner(code, '');
  if (!b) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] } }));
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(수·키·불리언만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const gl = window.__medreader || (window.__medreader = {});
  gl.diagram = {
    state: function () {
      if (!SH.els) return { init: false };
      const v = SH.flow.view();
      const svg = SH.els.fig.querySelector('svg');
      const s = SH.last;
      return {
        init: true, open: isOpen(), state: v.state, code: v.code, note: v.note ? v.note.key : null, calls: v.calls, asking: v.asking,
        stale: v.stale && !SH.els.stale.hidden, saved: v.saved,
        nodes: v.graph ? v.graph.nodes.length : 0, edges: v.graph ? v.graph.edges.length : 0,
        zoom: SH.zoom, picked: SH.picked, scale: s ? s.scale : null, avail: s ? s.avail : null, vbW: s ? s.vb.w : null, vbH: s ? s.vb.h : null,
        fontPx: s ? Math.min(DG_FONT.label, DG_FONT.src, DG_FONT.edge) * s.scale : null, dir: s ? s.dir : null,
        svgRole: svg ? svg.getAttribute('role') : null, svgName: !!(svg && svg.querySelector('title') && svg.querySelector('title').textContent),
        svgNodes: svg ? svg.querySelectorAll('.dg-node').length : 0, svgEdges: svg ? svg.querySelectorAll('.dg-edge').length : 0,
        svgLabels: svg ? svg.querySelectorAll('.dg-label').length : 0, srcLtr: svg ? Array.from(svg.querySelectorAll('.dg-src')).every((x) => x.getAttribute('direction') === 'ltr') : null,
        srcN: svg ? svg.querySelectorAll('.dg-src').length : 0,
        altOpen: !!(SH.els.alt.querySelector('details') || {}).open, altItems: SH.els.alt.querySelectorAll('.dg-rels > li').length,
        treeItems: SH.els.alt.querySelectorAll('.sum-tree li').length, lastExport: SH.lastExport
      };
    }
  };
}
