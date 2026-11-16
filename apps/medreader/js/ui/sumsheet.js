/* ============================================================
   MedReader — 요약 시트 (spec 17-2-1 4-3 · 4-4 · 6 — 11-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   선택 동작 줄 `[⋯] → [요약]`·음성 "요약"(`ui/ask.js` 가 대상 문단을 정해 연다) → 아래에 붙는 시트
   (`role="dialog"`, `aria-modal="false"`). 8f-2 단어 시트와 **같은 자리·높이 식**.
     · 머리 "문단 요약 · {쪽 라벨}" + [×](sticky — 가로 compact 에서도 늘 보인다)
     · 상태 한 줄(요약 중… · 실패 + [다시 시도] · 막힘(8c-1 `noteKeyFor` 문구) · 요약 대상 아님)
     · 요지(대상 언어 — `dir`·`lang`, 라틴 괄호 `appendBidiText`) · 원문 언어 요지(작은 글자, 원문 언어 방향)
     · 글 트리(`ui/tree.js` — `<details>` 중첩, JS 없이 접힘) · 용어 "원어 — 대상 말" · 고지 한 줄(11-D18)
     · 단추: [저장]/[저장됨 ✓](누르면 페이지 안 확인 → 지움) · [▶ 듣기] · [이 쪽 전체 요약 (문단 n · 호출 k)] · [다시 요약](먼저 묻는다) ·
       [모두 접기]/[모두 펼치기] · 링크 "이 책의 저장한 요약 (n)"(11-3 이 켠다 — 지금은 마크업만)
   [이 쪽 전체 요약] = 그 쪽 요약 가능한 문단 전부를 **한 번의** `summarize`(캐시에 있는 것은 0 — k 는 누르기 전에 `planSummary` 로 센다).
   결과 = 문단 순서대로 요지(누르면 본문의 그 문단으로) + 접힌 트리 + 문단마다 [저장] + 위에 [모두 저장 (n)].

   ── 지키는 것 ──────────────────────────────────────────
   ★ 호출은 **부를 때만**(17-2 · 11-Q1): 시트를 여는 것 = 그 문단 1회(캐시 적중이면 0) · [이 쪽 전체 요약] k · [다시 요약] 1 ·
     [다시 시도] 1. [저장]·[저장됨 ✓]·접기·[▶ 듣기]는 0. 요청은 `pipeline.summarize` 하나(상태 기계 한 벌 — 11-D9).
   ★ 모든 글자는 `textContent`/`appendBidiText` — `innerHTML` 0(13절). AI 응답을 HTML 로 해석하지 않는다.
   ★ Esc — 시트가 **가장 위 층**(8f-2 시트와 같은 꼴): 보이면 시트만 닫는다(붙잡기 단계 · 퍼지지 않음). 띠는 `[role="dialog"]` 를
     위층으로 세어 물러난다. Tab 은 시트 안에서 돈다. 닫으면 포커스를 그 문단 줄로.
   ★ 낭독은 멈추지 않는다(시트만 열림 — 음성으로 부른 때만 `ask.js` 의 소리 흐름).
   ★ 논리(`createSumFlow`)는 DOM 을 모른다 — `tests/sumsheet-11b.test.mjs` 가 가짜 파이프라인·저장소로 잰다.
   ============================================================ */

import { t, applyTranslations, onLangChange, dirOf, formatNumber } from '../i18n/index.js';
import { SUMMARY } from '../config.js';
import * as db from '../db.js';
import { eligible } from '../text/summary.js';
import { summaryStore, textHashOf } from '../notes/summaries.js';
import { printedLabel } from '../search/outline.js';
import { appendBidiText } from './bididom.js';
import { renderTree, setAllOpen, anyOpen, treeShape } from './tree.js';
import { GATE_KEYS, RETRYABLE_REMOTE, TAP_BANNER_NOW, noteKeyFor, noticeBanner } from './trband.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

/** 시트 단추(마크업 `data-sum-action` 과 같은 이름). 보이는 칸은 `sumButtons` 가 고른다. */
export const SUM_ACTIONS = Object.freeze(['save', 'unsave', 'listen', 'retry', 'pageAll', 'saveAll', 'redo', 'fold']);

/**
 * 문단 하나의 상태 → 한 줄 문구 키·[다시 시도] 여부. 막힘은 8c-1 과 같은 `noteKeyFor`(띠와 같은 문구). 순수 함수.
 * @param {{state:string, code?:string, gate?:boolean}} it
 * @returns {?{key:string, retry:boolean}}
 */
export function itemNote(it) {
  const x = it || {};
  switch (x.state) {
    case 'ready': return null;
    case 'pending': return { key: 'sum.pending', retry: false };
    case 'failed': return { key: 'sum.failed', retry: true };
    case 'blocked':
      // 문지기(동의·언어·키 — 보내지 않음): 8c-1 탭과 같은 한 줄. 설정을 고친 뒤 [다시 시도]가 문지기를 다시 본다(호출은 그때만).
      if (x.gate) return { key: GATE_KEYS[x.code] || 'readalong.failed', retry: true };
      {
        const v = noteKeyFor({ state: 'blocked', code: x.code }, { hasSentence: true });
        return { key: v.noteKey || 'readalong.failed', retry: RETRYABLE_REMOTE.indexOf(x.code) >= 0 };
      }
    case 'skipped': return { key: x.code === 'unsupported-lang' ? 'readalong.unsupportedLang' : 'sum.notEligible', retry: false };
    default: return { key: 'sum.notEligible', retry: false };
  }
}

/**
 * 보일 단추(논리 순서 — RTL 에서 저절로 거울). 순수 함수. `fold` 는 트리에 접히는 줄이 있을 때(`v.foldable`).
 *   · 문단 모드 · 준비됨: [저장]|[저장됨 ✓] · [▶ 듣기] · [이 쪽 전체 요약](쪽에 요약 가능 문단 ≥ 2, 호출 수를 센 뒤) · [다시 요약] · [모두 접기]
 *   · 문단 모드 · 실패/막힘(다시 시도 가능): [다시 시도] · [이 쪽 전체 요약]
 *   · 쪽 모드: [모두 저장 (n)](저장 안 한 준비됨 n ≥ 1) · [모두 접기] — 문단마다 [저장]·[다시 시도]는 본문 안
 *   · 닫힘·대상 아님·확인 질문 중·바쁨: 없음
 */
export function sumButtons(v) {
  const x = v || {};
  if (!x.open || x.ask || !Array.isArray(x.items) || !x.items.length) return [];
  const out = [];
  if (x.mode === 'page') {
    if (x.items.some((it) => it.state === 'ready' && !it.saved)) out.push('saveAll');
    if (x.foldable) out.push('fold');
    return out;
  }
  const it = x.items[0];
  const page = !!x.plan && x.plan.n >= 2 && Number.isFinite(x.plan.calls);
  if (it.state === 'ready') {
    out.push(it.saved ? 'unsave' : 'save', 'listen');
    if (page) out.push('pageAll');
    out.push('redo');
    if (x.foldable) out.push('fold');
    return out;
  }
  const n = itemNote(it);
  if (n && n.retry) out.push('retry');
  if (page && it.state !== 'pending') out.push('pageAll');
  return out;
}

/** Esc 가 시트를 닫는가 — 보이고(`shown`), 다른 손이 이미 쓰지 않았고, 입력기 조합 중이 아닐 때(8f-2 `sheetEsc` 와 같은 규칙). */
export function sumEsc(o) {
  const x = o || {};
  return !!x.open && x.shown !== false && !x.prevented && !x.composing;
}

/* ────────────────────────────────────────────────────────
   2. 흐름 — DOM 없이(테스트가 가짜 파이프라인·저장소로 잰다)
   ──────────────────────────────────────────────────────── */

function closedState() {
  return { open: false, mode: null, ctx: null, items: [], pageParas: [], plan: null, langs: null, busy: false,
    ask: null, note: null, banner: null, calls: 0, rev: 0 };
}

function itemOf(p) {
  return { para: p, state: 'pending', value: null, code: null, cached: false, gate: false, saved: null, hash: null };
}

/**
 * 요약 시트의 상태 기계.
 * @param {{summarize:(paras:Object[], opts:Object)=>Promise<Object>, planSummary:(paras:Object[], opts:Object)=>Promise<Object>,
 *          unblock?:()=>Promise<*>, gate?:()=>{ok:boolean, reason?:string},
 *          store:{findFor:Function, save:Function, remove:Function}, hashOf?:(text:string)=>Promise<string>,
 *          onChange?:(view:Object)=>void}} deps
 */
export function createSumFlow(deps) {
  const d = deps || {};
  const hashOf = typeof d.hashOf === 'function' ? d.hashOf : textHashOf;
  let st = closedState();
  let gen = 0;
  let rev = 0;

  function view() {
    return Object.assign({}, st, {
      ctx: st.ctx ? Object.assign({}, st.ctx) : null,
      items: st.items.map((it) => Object.assign({}, it, { note: itemNote(it) })),
      buttons: sumButtons(Object.assign({}, st, { foldable: st.items.some((it) => it.state === 'ready' && it.value && treeShape(it.value.points).foldable > 0) }))
    });
  }
  function emit() { if (typeof d.onChange === 'function') { try { d.onChange(view()); } catch (e) { /* 그리기 오류가 흐름을 막지 않는다 */ } } }
  function bump() { rev++; st.rev = rev; }
  function opts(extra) {
    const c = st.ctx || {};
    return Object.assign({ src: c.src, target: c.target, docId: c.docId, domain: c.domain }, extra || {});
  }

  function apply(it, r) {
    it.code = null;
    it.cached = false;
    if (r && r.state === 'ready' && r.value) { it.state = 'ready'; it.value = r.value; it.cached = !!r.cached; return; }
    if (r && r.state === 'blocked') { it.state = 'blocked'; it.code = r.code || null; return; }
    if (r && r.state === 'skipped') { it.state = 'skipped'; it.code = r.code || null; return; }
    it.state = 'failed';
    it.code = (r && r.code) || null;
  }

  /** 문단들을 한 번의 `summarize` 로(캐시에 있는 것은 0 호출 — 파이프라인이 거른다). */
  async function run(idx, extra) {
    const my = gen;
    for (const i of idx) { const it = st.items[i]; it.state = 'pending'; it.code = null; it.gate = false; }
    st.busy = true;
    bump();
    emit();
    let out = null;
    try { out = await d.summarize(idx.map((i) => ({ text: st.items[i].para.text })), opts(extra)); } catch (e) { out = null; }
    if (my !== gen) return false;
    st.busy = false;
    st.calls += (out && Number(out.calls)) || 0;
    if (out && Array.isArray(out.langs)) st.langs = out.langs.slice();
    idx.forEach((i, k) => apply(st.items[i], out && Array.isArray(out.results) ? out.results[k] : null));
    for (const i of idx) {
      const it = st.items[i];
      if (it.state === 'blocked' && TAP_BANNER_NOW.indexOf(it.code) >= 0) st.banner = it.code;
    }
    bump();
    return true;
  }

  /** 저장 여부를 다시 본다(호출 0 — 저장소 읽기만). */
  async function refreshSaved(idx) {
    const my = gen;
    const c = st.ctx || {};
    for (const i of idx) {
      const it = st.items[i];
      if (!it || it.state !== 'ready') continue;
      try {
        if (!it.hash) it.hash = await hashOf(it.para.text);
        const rec = await d.store.findFor(c.docId, it.hash, c.target);
        if (my !== gen) return;
        it.saved = rec || null;
      } catch (e) { if (my === gen) it.saved = null; }
    }
  }

  /** [이 쪽 전체 요약]의 k — 보내지 않고 센다(같은 키·같은 캐시 읽기·같은 자르기). */
  async function refreshPlan() {
    const my = gen;
    if (st.pageParas.length < 2) { st.plan = null; return; }
    let p = null;
    try { p = await d.planSummary(st.pageParas.map((x) => ({ text: x.text })), opts()); } catch (e) { p = null; }
    if (my !== gen) return;
    st.plan = { n: st.pageParas.length, calls: p && Number.isFinite(Number(p.calls)) ? Number(p.calls) : null };
  }

  function gateNow() { try { return typeof d.gate === 'function' ? (d.gate() || { ok: true }) : { ok: true }; } catch (e) { return { ok: true }; } }

  /**
   * 문단 하나 요약 — 열면서 1회(캐시 적중이면 0). 대상 아님이면 한 줄만(요청 0). 문지기가 막으면 한 줄만(요청 0).
   * @param {{para:?{paraId:string, text:string, n:number, chars:number, kind:string, lineIds?:string[]},
   *          pageParas?:Object[], ctx:{docId:string, page:number, src:string, target:string, domain?:string, docTitle?:string,
   *          fileHash?:string, provider?:string, model?:string}, gate?:{ok:boolean, reason?:string}}} o
   */
  async function open(o) {
    const x = o || {};
    const my = ++gen;
    st = closedState();
    st.open = true;
    st.mode = 'para';
    st.ctx = Object.assign({}, x.ctx || {});
    st.pageParas = (Array.isArray(x.pageParas) ? x.pageParas : []).filter(eligible);
    if (!x.para || !eligible(x.para)) {
      st.note = { key: 'sum.notEligible' };
      bump();
      emit();
      return view();
    }
    st.items = [itemOf(x.para)];
    const g = x.gate && typeof x.gate.ok === 'boolean' ? x.gate : gateNow();
    if (!g.ok) {
      Object.assign(st.items[0], { state: 'blocked', code: g.reason || null, gate: true });
      if (TAP_BANNER_NOW.indexOf(g.reason) >= 0) st.banner = g.reason;
      await refreshPlan();
      if (my !== gen) return view();
      bump();
      emit();
      return view();
    }
    if (!(await run([0]))) return view();
    await refreshSaved([0]);
    if (my !== gen) return view();
    await refreshPlan();
    if (my !== gen) return view();
    bump();
    emit();
    return view();
  }

  /** [다시 시도] — 문지기를 다시 보고, 막힌 원격 상태면 `pipeline.retry()` 먼저(사용자 동작만 — 자동 재시도 0). */
  async function retry(i) {
    const k = Number.isInteger(i) ? i : 0;
    const it = st.items[k];
    if (!st.open || st.busy || !it || it.state === 'ready' || it.state === 'pending') return view();
    const my = gen;
    st.note = null;
    st.banner = null;
    if (it.gate || it.state === 'blocked') {
      const g = gateNow();
      if (!g.ok) {
        Object.assign(it, { state: 'blocked', code: g.reason || null, gate: true });
        if (TAP_BANNER_NOW.indexOf(g.reason) >= 0) st.banner = g.reason;
        bump();
        emit();
        return view();
      }
    }
    if (it.state === 'blocked' && !it.gate && RETRYABLE_REMOTE.indexOf(it.code) >= 0 && typeof d.unblock === 'function') {
      try { await d.unblock(); } catch (e) { /* 그래도 한 번 보낸다 */ }
      if (my !== gen) return view();
    }
    if (!(await run([k], { retry: true }))) return view();
    await refreshSaved([k]);
    if (my !== gen) return view();
    if (st.mode === 'para') await refreshPlan();
    if (my !== gen) return view();
    bump();
    emit();
    return view();
  }

  /** [다시 요약] — 먼저 묻는다(호출 1). */
  function redo() {
    const it = st.items[0];
    if (!st.open || st.busy || st.mode !== 'para' || !it || it.state !== 'ready') return view();
    st.ask = { kind: 'redo', i: 0 };
    st.note = null;
    bump();
    emit();
    return view();
  }

  /** [저장됨 ✓] — 지울까요? 먼저 묻는다(호출 0). */
  function unsave(i) {
    const k = Number.isInteger(i) ? i : 0;
    const it = st.items[k];
    if (!st.open || st.busy || !it || !it.saved) return view();
    st.ask = { kind: 'unsave', i: k };
    st.note = null;
    bump();
    emit();
    return view();
  }

  function cancelAsk() {
    if (!st.ask) return view();
    st.ask = null;
    bump();
    emit();
    return view();
  }

  async function confirmAsk() {
    const a = st.ask;
    if (!a || st.busy) return view();
    st.ask = null;
    const my = gen;
    const it = st.items[a.i];
    if (!it) { bump(); emit(); return view(); }
    if (a.kind === 'redo') {
      // force — 캐시를 건너뛰고 덮어쓴다(7-5 "다시 생성"). 저장 레코드는 옛 글이다 → [저장]으로 보인다(누르면 대체 — 11-D10).
      if (!(await run([a.i], { force: true }))) return view();
      it.saved = null;
      if (it.state === 'ready' && !it.hash) { try { it.hash = await hashOf(it.para.text); } catch (e) { it.hash = null; } }
      if (my !== gen) return view();
      bump();
      emit();
      return view();
    }
    if (a.kind === 'unsave' && it.saved) {
      st.busy = true;
      emit();
      let ok = false;
      try { ok = await d.store.remove(it.saved.id); } catch (e) { ok = false; }
      if (my !== gen) return view();
      st.busy = false;
      if (ok) { it.saved = null; st.note = { key: 'sum.removed' }; } else st.note = { key: 'sum.saveFailed' };
      bump();
      emit();
    }
    return view();
  }

  /** [저장] — 호출 0. 같은 문단·같은 대상 언어면 대체(11-D10 — 저장소가 한다). 원문 글은 해시만(저장하지 않는다). */
  async function save(i) {
    const k = Number.isInteger(i) ? i : 0;
    const it = st.items[k];
    if (!st.open || st.busy || !it || it.state !== 'ready' || it.saved) return view();
    const my = gen;
    st.busy = true;
    st.ask = null;
    emit();
    const ok = await saveOne(it);
    if (my !== gen) return view();
    st.busy = false;
    st.note = { key: ok ? 'sum.savedNote' : 'sum.saveFailed' };
    bump();
    emit();
    return view();
  }

  async function saveOne(it) {
    const c = st.ctx || {};
    const p = it.para || {};
    try {
      if (!it.hash) it.hash = await hashOf(p.text);
      const res = await d.store.save({
        docId: c.docId, pageNo: c.page, docTitle: c.docTitle || '', fileHash: c.fileHash || '',
        para: { paraId: p.paraId, lineIds: Array.isArray(p.lineIds) ? p.lineIds : [], text: p.text },
        textHash: it.hash, target: c.target, src: c.src,
        langs: st.langs || (c.src && c.src !== c.target ? [c.target, c.src] : [c.target]),
        value: it.value, domain: c.domain || '', provider: c.provider || '', model: c.model || '',
        promptVersion: SUMMARY.PROMPT_VERSION
      });
      if (res && res.rec) { it.saved = res.rec; return true; }
    } catch (e) { /* 아래 */ }
    return false;
  }

  /** [모두 저장 (n)] — 쪽 모드의 준비된·저장 안 한 문단. 호출 0. */
  async function saveAll() {
    if (!st.open || st.busy || st.mode !== 'page') return view();
    const my = gen;
    st.busy = true;
    st.ask = null;
    emit();
    let ok = 0;
    let bad = 0;
    for (const it of st.items) {
      if (it.state !== 'ready' || it.saved) continue;
      if (await saveOne(it)) ok++; else bad++;
      if (my !== gen) return view();
    }
    st.busy = false;
    st.note = { key: bad ? 'sum.saveFailed' : 'sum.savedAll', params: { n: ok } };
    bump();
    emit();
    return view();
  }

  /**
   * [이 쪽 전체 요약] — 그 쪽 요약 가능한 문단 전부를 **한 번의** `summarize`(캐시에 있는 문단은 0 — 미리 센 k 와 같다).
   * 이미 준비된 문단(지금 문단)은 다시 보내지 않는다.
   */
  async function pageAll() {
    if (!st.open || st.busy || st.pageParas.length < 1) return view();
    const my = gen;
    const had = new Map(st.items.map((it) => [String(it.para.paraId), it]));
    st.mode = 'page';
    st.ask = null;
    st.note = null;
    st.items = st.pageParas.map((p) => {
      const old = had.get(String(p.paraId));
      return old && old.state === 'ready' ? old : itemOf(p);
    });
    const idx = [];
    st.items.forEach((it, i) => { if (it.state !== 'ready') idx.push(i); });
    const g = gateNow();
    if (!g.ok) {
      for (const i of idx) Object.assign(st.items[i], { state: 'blocked', code: g.reason || null, gate: true });
      if (TAP_BANNER_NOW.indexOf(g.reason) >= 0) st.banner = g.reason;
      bump();
      emit();
      return view();
    }
    if (idx.length && !(await run(idx))) return view();
    await refreshSaved(st.items.map((_, i) => i));
    if (my !== gen) return view();
    st.plan = null;
    bump();
    emit();
    return view();
  }

  /** 닫기 — 늦게 온 결과는 버린다. */
  function close() { gen++; st = closedState(); return view(); }

  /** 배너를 한 번 띄웠다(화면이 부른다). */
  function bannerShown() { st.banner = null; }

  return { open, retry, redo, unsave, cancelAsk, confirmAsk, save, saveAll, pageAll, close, view, bannerShown };
}

/* ────────────────────────────────────────────────────────
   3. 화면
   ──────────────────────────────────────────────────────── */

let els = null;
let deps = null;
let flow = null;
/** 열 때의 문단 첫 줄 — 닫으면 포커스를 돌려놓는다. */
let openedLine = null;
let labelSeq = 0;
let pageLabel = '';
let lastView = null;

/**
 * @param {{pipeline:Object, gate:()=>{ok:boolean, reason?:string}, listen:(text:string, lang:string)=>*,
 *          revealLine?:(lineId:string)=>*, focusBack?:(lineId:string)=>void, cancelVoice?:()=>void, store?:Object}} d
 * @returns {?{open:Function, close:Function, isOpen:Function, view:Function}} 마크업·의존이 없으면 null
 */
export function initSumSheet(d) {
  if (typeof document === 'undefined') return null;
  if (els) return api();
  const x = d || {};
  const sheet = document.getElementById('sumSheet');
  if (!sheet || !x.pipeline || typeof x.pipeline.summarize !== 'function') return null;
  const q = (id) => sheet.querySelector('#' + id);
  els = {
    root: document.documentElement, sheet: sheet, title: q('sumTitle'), status: q('sumStatus'), body: q('sumBody'),
    ask: q('sumAsk'), askQ: q('sumAskQ'), askYes: q('sumAskYes'), askNo: q('sumAskNo'), actions: q('sumActions'), link: q('sumLink')
  };
  deps = x;
  const pl = x.pipeline;
  const store = x.store || summaryStore();
  flow = createSumFlow({
    summarize: function (paras, o) { return pl.summarize(paras, o); },
    planSummary: function (paras, o) { return typeof pl.planSummary === 'function' ? pl.planSummary(paras, o) : Promise.resolve({ calls: null }); },
    unblock: function () { return typeof pl.retry === 'function' ? pl.retry() : null; },
    gate: function () { return typeof x.gate === 'function' ? x.gate() : { ok: true }; },
    store: store,
    onChange: render
  });
  sheet.addEventListener('click', onClick);
  // 트리를 손으로 접고 펴면 [모두 접기]/[모두 펼치기] 글자를 맞춘다(toggle 은 거품이 없다 — 붙잡기 단계).
  els.body.addEventListener('toggle', paintFold, true);
  document.addEventListener('keydown', onKey, true);
  onLangChange(() => { if (els && flow) { applyTranslations(els.sheet); paintLabel(); render(flow.view()); } });
  attachDebugHook();
  return api();
}

function api() { return { open: openSheet, close: closeSheet, isOpen: isOpen, view: function () { return flow ? flow.view() : null; } }; }

/**
 * 시트를 열고 그 문단을 요약한다(`ask.js` 가 대상·문지기·쪽 문단을 넘긴다). 돌려주는 약속은 요약이 끝난 뒤의 상태.
 * @returns {Promise<?Object>}
 */
function openSheet(o) {
  if (!els || !flow) return Promise.resolve(null);
  const x = o || {};
  const p = x.para || null;
  openedLine = p && Array.isArray(p.lineIds) && p.lineIds.length ? p.lineIds[0] : (x.lineId != null ? x.lineId : null);
  pageLabel = '';
  const c = x.ctx || {};
  paintLabelFor(c.docId, c.page);
  const run = flow.open(x);
  els.sheet.hidden = false;
  els.root.setAttribute('data-sum-sheet', 'on');
  attachDebugHook();
  try { els.title.focus({ preventScroll: true }); } catch (e) { /* 포커스 못 옮겨도 시트는 열린다 */ }
  return run;
}

function isOpen() { return !!els && !els.sheet.hidden; }

/** 시트를 닫는다. `back` 이면 포커스를 그 문단 줄로(Esc·[×]). 리더를 떠날 때·다른 시트를 열 때는 false. */
function closeSheet(back) {
  if (!els || els.sheet.hidden) return;
  flow.close();
  els.sheet.hidden = true;
  els.root.removeAttribute('data-sum-sheet');
  clear(els.body);
  const line = openedLine;
  openedLine = null;
  if (back && line != null && typeof deps.focusBack === 'function') { try { deps.focusBack(line); } catch (e) { /* 줄이 없어도 닫혔다 */ } }
}

/** 시트가 정말 보이는가 — 자신의 `hidden` 과 리더 화면 섹션의 숨김(검색 화면 뒤 숨은 리더)까지. */
function shown() {
  if (!els || els.sheet.hidden) return false;
  const reader = els.sheet.closest('[data-screen="reader"]');
  if (reader && reader.hidden) return false;
  return els.sheet.getClientRects().length > 0;
}

function onKey(ev) {
  if (!els || els.sheet.hidden) return;
  if (ev.key === 'Escape' || ev.key === 'Esc') {
    if (!sumEsc({ open: true, shown: shown(), prevented: ev.defaultPrevented, composing: !!ev.isComposing })) return;
    ev.preventDefault();
    ev.stopPropagation();              // 시트가 가장 위 층 — 아래 층(띠·팝오버)의 Esc 로 퍼지지 않게
    closeSheet(true);
    return;
  }
  if (ev.key === 'Tab' && els.sheet.contains(ev.target)) trapTab(ev);
}

/** 포커스 가둠 — 시트 안 단추·요약(트리)·링크 사이에서 돈다. */
function trapTab(ev) {
  const list = Array.from(els.sheet.querySelectorAll('button, summary, a[href], [tabindex="0"]'))
    .filter((el) => !el.hidden && !el.disabled && el.getClientRects().length > 0);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  if (ev.shiftKey && i <= 0) { ev.preventDefault(); list[list.length - 1].focus(); }
  else if (!ev.shiftKey && i === list.length - 1) { ev.preventDefault(); list[0].focus(); }
}

function onClick(ev) {
  const go = ev.target && ev.target.closest ? ev.target.closest('[data-sum-goto]') : null;
  if (go && els.sheet.contains(go)) {
    const it = lastView && lastView.items[Number(go.getAttribute('data-sum-goto'))];
    const first = it && it.para && Array.isArray(it.para.lineIds) ? it.para.lineIds[0] : null;
    if (first != null && typeof deps.revealLine === 'function') { try { deps.revealLine(first); } catch (e) { /* 못 굴려도 시트는 그대로 */ } }
    return;
  }
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-sum-action]') : null;
  if (!b || !els.sheet.contains(b) || b.hidden || b.getAttribute('aria-disabled') === 'true') return;
  const i = b.hasAttribute('data-i') ? Number(b.getAttribute('data-i')) : 0;
  act(b.getAttribute('data-sum-action'), i);
}

/** 단추 하나 — 첫 줄에서 듣기·말하기를 취소한다(손이 이긴다 — 17-7-6 2절 1). [▶ 듣기]는 그다음 새로 말한다. */
function act(id, i) {
  if (!flow) return null;
  if (typeof deps.cancelVoice === 'function') { try { deps.cancelVoice(); } catch (e) { /* 듣기 없음 */ } }
  let p = null;
  switch (id) {
    case 'close': closeSheet(true); return null;
    case 'save': p = flow.save(i); break;
    case 'unsave': p = Promise.resolve(flow.unsave(i)); break;
    case 'retry': p = flow.retry(i); break;
    case 'redo': p = Promise.resolve(flow.redo()); break;
    case 'askYes': p = flow.confirmAsk(); break;
    case 'askNo': p = Promise.resolve(flow.cancelAsk()); break;
    case 'pageAll': p = flow.pageAll(); break;
    case 'saveAll': p = flow.saveAll(); break;
    case 'fold': setAllOpen(els.body, !anyOpen(els.body)); paintFold(); return null;
    case 'listen': {
      const v = flow.view();
      const it = v.items[0];
      if (it && it.state === 'ready' && it.value && typeof deps.listen === 'function') {
        try { p = Promise.resolve(deps.listen(it.value.gist, v.ctx && v.ctx.target)); } catch (e) { p = null; }
      }
      return p;
    }
    default: return null;
  }
  return p;
}

/** no-key·consent — 사용자가 요약을 불렀으므로 상태 바 배너를 바로(탭 번역·단어 시트와 같은 문구 — trband `noticeBanner`). */
function raiseBanner(code) {
  const b = noticeBanner(code, '');
  if (!b) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] }
  }));
}

/** 쪽 라벨 — 8g `pageLabels` 가 있으면 인쇄 쪽(검색 화면과 같은 문구 키). 읽기만(호출 0). */
function paintLabelFor(docId, page) {
  const my = ++labelSeq;
  const p = Number(page);
  pageLabel = Number.isFinite(p) ? t('search.page', { page: formatNumber(p) }) : '';
  paintLabel();
  if (docId == null || !Number.isFinite(p)) return;
  Promise.resolve(db.get('documents', docId)).then((doc) => {
    if (my !== labelSeq || !els) return;
    const lab = printedLabel(doc && doc.pageLabels, p);
    if (lab) { pageLabel = t('search.pageLabeled', { label: lab, page: formatNumber(p) }); paintLabel(); }
  }).catch(() => { });
}

function paintLabel() {
  if (!els || !flow) return;
  const v = flow.view();
  els.title.textContent = t(v.mode === 'page' ? 'sum.titlePage' : 'sum.title', { page: pageLabel });
}

function setLangDir(el, lang) {
  if (!el) return;
  if (lang) { el.setAttribute('lang', lang); el.setAttribute('dir', dirOf(lang)); }
  else { el.removeAttribute('lang'); el.setAttribute('dir', 'auto'); }
}

function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

/** 상태 → 화면. 글자는 전부 textContent/appendBidiText. */
function render(v) {
  if (!els || !v) return;
  lastView = v;
  if (v.banner) { raiseBanner(v.banner); flow.bannerShown(); }
  const c = v.ctx || {};
  const target = c.target || '';
  const tdir = dirOf(target);
  paintLabel();
  // 상태 한 줄 — 문단 모드는 그 문단의 상태(대상 아님·막힘·실패·요약 중), 그다음 시트 안내(저장했습니다…)
  const first = v.items[0];
  let status = '';
  if (v.mode === 'para' && first && first.note) status = t(first.note.key);
  else if (v.mode === 'page' && v.busy) status = t('sum.pending');
  else if (!first && v.note) status = t(v.note.key, v.note.params || undefined);
  if (!status && v.note) status = t(v.note.key, v.note.params || undefined);
  els.status.textContent = status;
  // 본문
  const had = els.sheet.contains(document.activeElement) ? document.activeElement : null;
  clear(els.body);
  if (v.mode === 'para' && first && first.state === 'ready' && first.value) paintPara(first, c, tdir);
  else if (v.mode === 'page') paintPage(v, c, tdir);
  // 확인 질문(페이지 안 — confirm() 쓰지 않음)
  els.ask.hidden = !v.ask;
  if (v.ask) {
    els.askQ.textContent = t(v.ask.kind === 'redo' ? 'sum.redoAsk' : 'sum.unsaveAsk');
    els.askYes.textContent = t(v.ask.kind === 'redo' ? 'sum.redo' : 'sum.unsaveYes');
    els.askNo.textContent = t(v.ask.kind === 'redo' ? 'common.cancel' : 'sum.keep');
  }
  // 단추
  const show = v.buttons || [];
  for (const b of els.actions.querySelectorAll('[data-sum-action]')) {
    const id = b.getAttribute('data-sum-action');
    b.hidden = show.indexOf(id) < 0;
    if (v.busy) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
  }
  const pa = els.actions.querySelector('[data-sum-action="pageAll"]');
  if (pa && v.plan) pa.textContent = t('sum.pageAll', { n: formatNumber(v.plan.n), k: formatNumber(v.plan.calls == null ? 0 : v.plan.calls) });
  const sa = els.actions.querySelector('[data-sum-action="saveAll"]');
  if (sa) sa.textContent = t('sum.saveAll', { n: formatNumber(v.items.filter((it) => it.state === 'ready' && !it.saved).length) });
  paintFold();
  // 포커스 — 질문이 뜨면 [취소]/[그대로 두기]로(실수로 다시 요약·지우지 않게), 단추가 숨어 포커스를 잃었으면 머리로
  if (v.ask) { try { els.askNo.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } }
  else if (had && (had.hidden || !els.sheet.contains(had) || had.getClientRects().length === 0)) {
    const next = Array.from(els.actions.querySelectorAll('[data-sum-action]')).find((b) => !b.hidden) || els.title;
    try { next.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ }
  }
}

/** 문단 모드 — 요지 · 원문 언어 요지 · 트리 · 용어. */
function paintPara(it, c, tdir) {
  const val = it.value || {};
  const gist = document.createElement('p');
  gist.className = 'sum-gist';
  setLangDir(gist, c.target);
  appendBidiText(gist, String(val.gist || ''), tdir);
  els.body.appendChild(gist);
  const src = c.src || '';
  if (val.gistSrc && src && src !== c.target) {
    const gs = document.createElement('p');
    gs.className = 'sum-gist-src';
    setLangDir(gs, src);
    gs.textContent = String(val.gistSrc);
    els.body.appendChild(gs);
  }
  const tree = renderTree(val.points, { dir: tdir, lang: c.target, open: true });
  if (tree) els.body.appendChild(tree);
  const terms = (Array.isArray(val.terms) ? val.terms : []).filter((x) => x && x.src && x.tr);
  if (terms.length) {
    const lab = document.createElement('p');
    lab.className = 'sum-label';
    lab.textContent = t('sum.terms');
    els.body.appendChild(lab);
    const ul = document.createElement('ul');
    ul.className = 'sum-terms';
    for (const x of terms) {
      const li = document.createElement('li');
      const a = document.createElement('span');
      a.className = 'sum-term-src';
      setLangDir(a, src || 'en');
      a.textContent = String(x.src);
      const sep = document.createElement('span');
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = ' — ';
      const b = document.createElement('span');
      b.className = 'sum-term-tr';
      setLangDir(b, c.target);
      appendBidiText(b, String(x.tr), tdir);
      li.appendChild(a);
      li.appendChild(sep);
      li.appendChild(b);
      ul.appendChild(li);
    }
    els.body.appendChild(ul);
  }
}

/** 쪽 모드 — 문단 순서대로 요지(누르면 그 문단으로) + 접힌 트리 + 문단마다 [저장]/[다시 시도]. */
function paintPage(v, c, tdir) {
  v.items.forEach((it, i) => {
    const box = document.createElement('div');
    box.className = 'sum-item';
    box.setAttribute('data-i', String(i));
    if (it.state === 'ready' && it.value) {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'sum-goto';
      go.setAttribute('data-sum-goto', String(i));
      setLangDir(go, c.target);
      appendBidiText(go, String(it.value.gist || ''), tdir);
      box.appendChild(go);
      const tree = renderTree(it.value.points, { dir: tdir, lang: c.target, open: false });
      if (tree) box.appendChild(tree);
      const row = document.createElement('div');
      row.className = 'sum-row';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sum-btn';
      b.setAttribute('data-sum-action', it.saved ? 'unsave' : 'save');
      b.setAttribute('data-i', String(i));
      b.textContent = t(it.saved ? 'sum.saved' : 'sum.save');
      if (v.busy) b.setAttribute('aria-disabled', 'true');
      row.appendChild(b);
      box.appendChild(row);
    } else {
      const n = it.note || { key: 'sum.pending', retry: false };
      const p = document.createElement('p');
      p.className = 'sum-item-note';
      p.textContent = t(n.key);
      box.appendChild(p);
      if (n.retry && !v.busy) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sum-btn';
        b.setAttribute('data-sum-action', 'retry');
        b.setAttribute('data-i', String(i));
        b.textContent = t('readalong.retry');
        box.appendChild(b);
      }
    }
    els.body.appendChild(box);
  });
}

/** [모두 접기]/[모두 펼치기] — 한 단추, 글자는 지금 트리 상태에서. */
function paintFold() {
  if (!els) return;
  const b = els.actions.querySelector('[data-sum-action="fold"]');
  if (!b) return;
  b.textContent = t(anyOpen(els.body) ? 'sum.foldAll' : 'sum.unfoldAll');
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(길이·방향·상태·단추만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.sumsheet && g.sumsheet.__mine) return;
  g.sumsheet = {
    __mine: true,
    state: function () {
      if (!flow || !els) return null;
      const v = flow.view();
      const gist = els.body.querySelector('.sum-gist');
      const gs = els.body.querySelector('.sum-gist-src');
      return {
        open: !els.sheet.hidden, mode: v.mode, busy: v.busy, ask: v.ask ? v.ask.kind : null, note: v.note ? v.note.key : null,
        calls: v.calls, plan: v.plan, buttons: v.buttons, status: els.status.textContent.length,
        items: v.items.map((it) => ({ paraId: it.para ? it.para.paraId : null, state: it.state, code: it.code, cached: it.cached, saved: !!it.saved, note: it.note ? it.note.key : null,
          gistLen: it.value && it.value.gist ? it.value.gist.length : 0 })),
        gist: gist ? { dir: gist.getAttribute('dir'), lang: gist.getAttribute('lang'), bdi: gist.querySelectorAll('bdi').length } : null,
        gistSrc: gs ? { dir: gs.getAttribute('dir'), lang: gs.getAttribute('lang') } : null,
        details: els.body.querySelectorAll('details').length, detailsOpen: els.body.querySelectorAll('details[open]').length,
        treeLi: els.body.querySelectorAll('.sum-tree li').length, terms: els.body.querySelectorAll('.sum-terms li').length,
        disclaimer: !!els.sheet.querySelector('.sum-disclaimer') && !els.sheet.querySelector('.sum-disclaimer').hidden,
        title: els.title.textContent.length,
        focus: (function () { const a = document.activeElement; return !a ? null : a === document.body ? 'BODY'
          : a.getAttribute('data-sum-action') || a.id || a.tagName; })()
      };
    }
  };
}
