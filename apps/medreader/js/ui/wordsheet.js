/* ============================================================
   MedReader — 단어 시트 (spec 17-7-6 4-5 · 4-3 "찾는 순서" · 17-7-2 · 17-7-3 — 8f-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   선택 동작 줄 `[단어 번역]` → 아래에 붙는 시트(`role="dialog"`, `aria-modal="false"`). 고른 낱말의 번역을
   **호출 0 길부터** 찾는다(17-7-2 — 무료 한도는 하나다):
     1. 단어장에 이미 있다(`vocabStore.findTerm` — term 정규화 + 대상 언어) → 그 항목. 호출 0
     2. 그 문장의 번역(readalong 메모리 → 캐시 읽기만)의 괄호 원어에서 후보(`findInSentenceTr`) → 칸에 미리 채움. 호출 0
     3. 없으면 빈 칸 + [AI 로 번역](누를 때만 `pipeline.translateTerms` 1호출) · [번역 없이 저장](0회) + 안내 한 줄
   이미 있는 항목은 [이 문맥으로 다시 번역](1회 — 고친 항목이면 먼저 묻는다) · [문맥을 이 문장으로 바꾸기](0회).

   ── 지키는 것 ──────────────────────────────────────────
   ★ 시트를 **여는 것만으로는 요청하지 않는다**(6절 "시트 열기 0"). 새 호출은 [AI 로 번역]·[이 문맥으로 다시 번역] 누름뿐.
     누를 때는 늘 `retry:true`(사용자가 부른 것 — 한 번 실패한 단어를 다시 누르면 다시 보낸다, 8f1R-8 #5).
   ★ 보내는 것은 낱말과 그 문장(교과서 원문)뿐 — 사용자가 고친 번역·메모는 요청 항목에 넣지 않는다(13절).
   ★ 모든 글자는 `textContent`/`appendBidiText` — `innerHTML` 0. 번역 칸·번역문의 `dir`/`lang` 은 대상 언어에서.
   ★ Esc — 시트가 **가장 위 층**(8c-1c 의 Esc 층 순서): 시트가 보이면 시트만 닫는다(띠·팝오버는 그다음 Esc).
     띠는 `[role="dialog"]` 를 위층으로 세므로(trband `upperLayers`) 시트가 열린 동안 손대지 않는다.
     Tab 은 시트 안에서 돈다(포커스 가둠). 닫으면 포커스를 선택했던 줄로.
   ★ 단어장 화면 링크(`#/vocab/:docId`)는 마크업만 — 8f-3 이 켠다.
   ★ 논리(`createSheetFlow`)는 DOM 을 모른다 — `tests/wordsheet-8f.test.mjs` 가 가짜 저장소·가짜 파이프라인으로 잰다.
   ============================================================ */

import { t, applyTranslations, onLangChange, dirOf } from '../i18n/index.js';
import { normalizeTerm, findInSentenceTr } from '../text/vocab.js';
import { expandWord, clampSelection, unitAt } from '../text/select.js';
import { vocabStore } from '../vocab/store.js';
import { appendBidiText } from './bididom.js';
import { GATE_KEYS, BLOCKED_KEYS, TAP_BANNER_NOW, noticeBanner } from './trband.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

/** 시트 단추(마크업 `data-ws-action` 과 같은 이름). 보이는 칸은 `sheetButtons` 가 고른다. */
export const WS_ACTIONS = Object.freeze(['save', 'ai', 'saveBare', 'retranslate', 'useContext']);

/** 보이지 않는 글자(숨은 하이픈·폭 없는 공백·이음 제어·BOM) — 낱말에서 뺀다(`text/vocab.js` 와 같은 목록). */
const INVISIBLE = /[­​-‍⁠﻿]/g;

function trimWord(s) {
  return String(s == null ? '' : s).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
    .replace(/^[^\p{L}\p{M}\p{N}]+/u, '').replace(/[^\p{L}\p{M}\p{N}]+$/u, '');
}

/**
 * 스냅숏 → 저장할 꼴(`surface`). 17-7-1 — 낱말 경계로 넓히고, 하이픈 결합 낱말은 결합된 꼴로.
 *   · 한 줄 안 선택: `expandWord(줄 글자, start, end, 다음 줄 첫 글자(이 줄 끝이 `.hy` 일 때만), 세그멘터)`.
 *     낱말이 줄 첫머리에서 시작하고 앞 줄이 `.hy` 로 끝나면 앞 줄 끝 낱말을 앞에 잇는다(`cardio-` | `vascular` 의 뒤쪽을 골라도 같은 꼴).
 *   · 여러 줄에 걸친 선택(`multi`): 브라우저 선택 글자(`.hy` 는 `display:none` 이라 빠진다) + 시작 줄에서 낱말 앞쪽으로 넓힌 몫.
 * 순수 함수.
 * @param {{lineText:string, start:number, end:number, multi?:boolean, selText?:string, nextHead?:?string,
 *          prevTail?:?string, segFn?:?Function}} o
 * @returns {string}
 */
export function pickSurface(o) {
  const x = o || {};
  const line = String(x.lineText == null ? '' : x.lineText);
  const seg = typeof x.segFn === 'function' ? x.segFn : null;
  if (x.multi) {
    const s = Math.max(0, Math.min(line.length, Math.floor(Number(x.start) || 0)));
    const head = expandWord(line, s, s, null, seg);
    const pre = head.start < s ? line.slice(head.start, s) : '';
    return trimWord(pre + String(x.selText == null ? '' : x.selText));
  }
  const r = expandWord(line, x.start, x.end, typeof x.nextHead === 'string' && x.nextHead ? x.nextHead : null, seg);
  let w = r.word;
  if (w && r.start === 0 && typeof x.prevTail === 'string' && x.prevTail) w = x.prevTail + w;
  return trimWord(w);
}

/**
 * 17-7-2 찾는 순서 — **호출 0 길만**. 요청 함수를 받지 않는다(여기서는 부를 수 없다).
 *   1. 단어장(`findTerm(term, target)`) → `saved`
 *   2. 그 문장의 번역(`sentenceTr(unit)` — 메모리 → 캐시 읽기만)에서 괄호 원어 후보(`findInSentenceTr`) → `sentence`
 *   3. 없으면 `none`(문장 번역이 있으면 그 글은 같이 — 시트가 보인다)
 * @param {{term:string, surface:string, targetLang:string, unit:?Object}} q
 * @param {{store:{findTerm:Function}, sentenceTr:Function}} d
 * @returns {Promise<{path:'saved'|'sentence'|'none', entry:?Object, sentenceTr:?string, hit:?Object}>}
 */
export async function lookupWord(q, d) {
  const x = q || {};
  let saved = null;
  try { saved = await d.store.findTerm(x.term, x.targetLang); } catch (e) { saved = null; }
  if (saved) return { path: 'saved', entry: saved, sentenceTr: null, hit: null };
  let tr = null;
  try { tr = typeof d.sentenceTr === 'function' ? await d.sentenceTr(x.unit || null) : null; } catch (e) { tr = null; }
  const s = typeof tr === 'string' && tr ? tr : null;
  const hit = s ? findInSentenceTr(x.surface || x.term, s) : null;
  if (hit) return { path: 'sentence', entry: null, sentenceTr: s, hit: hit };
  return { path: 'none', entry: null, sentenceTr: s, hit: null };
}

/**
 * 보일 단추(논리 순서 — RTL 에서 저절로 거울). 순수 함수.
 *   · 단어장에 있는 낱말: [저장](고친 번역) · [이 문맥으로 다시 번역] · (문맥이 다르면) [문맥을 이 문장으로 바꾸기]
 *   · 그 밖: [저장] · [AI 로 번역] · [번역 없이 저장]
 *   · 닫힘·찾는 중·너무 김·같은 언어·덮어쓰기 질문 중: 없음
 */
export function sheetButtons(s) {
  const x = s || {};
  if (!x.open || !x.path || x.tooLong || x.sameLang || x.ask) return [];
  if (x.path === 'saved') {
    const out = ['save', 'retranslate'];
    const q = x.q || {};
    const e = x.entry || {};
    if (String(q.context || '') && String(q.context || '') !== String(e.context || '')) out.push('useContext');
    return out;
  }
  return ['save', 'ai', 'saveBare'];
}

/**
 * Esc 가 시트를 닫는가 — 시트가 보이고(`shown`), 다른 손이 이미 쓰지 않았고, 입력기 조합 중이 아닐 때. 순수 함수.
 * 시트는 띠·팝오버보다 **위 층**이다 — 이 판정이 참이면 그 Esc 는 시트만 닫는다(아래 층으로 퍼지지 않는다).
 */
export function sheetEsc(o) {
  const x = o || {};
  return !!x.open && x.shown !== false && !x.prevented && !x.composing;
}

/* ────────────────────────────────────────────────────────
   2. 흐름 — DOM 없이(테스트가 가짜 저장소·파이프라인으로 잰다)
   ──────────────────────────────────────────────────────── */

function blankDraft() { return { translation: '', gloss: '', pos: '', lemma: '' }; }

function closedState() {
  return { open: false, busy: false, q: null, path: null, entry: null, draft: blankDraft(), base: '', contextTr: '',
    hit: null, note: null, banner: null, ask: false, tooLong: false, sameLang: false, rev: 0, calls: 0 };
}

function clean(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }

function draftOf(e) {
  const x = e || {};
  return { translation: clean(x.translation), gloss: clean(x.gloss), pos: clean(x.pos), lemma: clean(x.lemma) };
}

/**
 * 시트의 상태 기계.
 * @param {{store:{findTerm:Function, save:Function, update:Function},
 *          translateTerms:(items:Object[], opts:Object)=>Promise<Object>,
 *          sentenceTr:(unit:?Object)=>Promise<?string>,
 *          gate?:()=>{ok:boolean, reason?:string},
 *          onChange?:(view:Object)=>void}} deps
 */
export function createSheetFlow(deps) {
  const d = deps || {};
  let st = closedState();
  let gen = 0;
  let rev = 0;

  function view() { return Object.assign({}, st, { draft: Object.assign({}, st.draft), buttons: sheetButtons(st) }); }
  function emit() { if (typeof d.onChange === 'function') { try { d.onChange(view()); } catch (e) { /* 그리기 오류가 흐름을 막지 않는다 */ } } }
  function bump() { rev++; st.rev = rev; }

  /**
   * 시트를 연다 — 찾는 순서는 `lookupWord`(호출 0). **요청하지 않는다.**
   * @param {{surface:string, srcLang:string, docLang:string, targetLang:string, context:string, unit:?Object,
   *          docId:?string, docTitle:?string, pageNo:?number, lineId:?string, domain:?string}} q
   */
  async function open(q) {
    const my = ++gen;
    const x = Object.assign({}, q || {});
    x.surface = clean(x.surface);
    x.term = normalizeTerm(x.surface);
    x.context = clean(x.context);
    st = closedState();
    st.open = true;
    st.q = x;
    bump();
    st.tooLong = !x.term || clampSelection(x.surface).tooLong;
    st.sameLang = !st.tooLong && !!x.srcLang && x.srcLang === x.targetLang;
    if (st.tooLong || st.sameLang) {
      st.note = { key: st.tooLong ? 'vs.tooLong' : 'vs.sameLang' };
      emit();
      return view();
    }
    st.busy = true;
    emit();
    const r = await lookupWord(x, d);
    if (my !== gen) return view();
    st.busy = false;
    st.path = r.path;
    st.contextTr = r.sentenceTr || '';
    if (r.path === 'saved') {
      st.entry = r.entry;
      st.draft = draftOf(r.entry);
      st.base = st.draft.translation;
      st.contextTr = clean(r.entry.contextTr);
      st.note = { key: 'vs.found.saved' };
    } else if (r.path === 'sentence') {
      st.draft = Object.assign(blankDraft(), { translation: clean(r.hit.candidate) });
      st.base = st.draft.translation;
      st.hit = { at: r.hit.at.slice(), paren: r.hit.paren.slice() };
      st.note = { key: 'vs.found.sentence' };
    } else {
      st.note = { key: 'vs.found.none' };
    }
    bump();
    emit();
    return view();
  }

  /** [AI 로 번역] — 1호출(같은 낱말 + 같은 문맥이면 캐시 0). 문지기(동의·키)·원격 상태(상한·오프라인…)가 막으면 상태 한 줄만. */
  function ai() { return askAi(false); }

  async function askAi(force) {
    if (!st.open || st.busy || st.tooLong || st.sameLang || !st.path) return view();
    st.banner = null;
    const g = typeof d.gate === 'function' ? d.gate() : { ok: true };
    // `same-lang` 은 문서 단위 판정이라 여기서는 쓰지 않는다 — 낱말의 언어(8m `Unit.lang`)는 `open` 이 보았다.
    if (g && !g.ok && g.reason !== 'same-lang') {
      st.note = { key: GATE_KEYS[g.reason] || 'readalong.failed' };
      st.banner = g.reason || null;
      emit();
      return view();
    }
    const my = gen;
    const q = st.q;
    st.busy = true;
    st.ask = false;
    st.note = { key: 'readalong.pending' };
    emit();
    let out = null;
    try {
      // ★ 항목은 낱말·문장·원문 언어뿐 — 시트의 번역 칸·메모는 넣지 않는다(13절).
      out = await d.translateTerms([{ term: q.term, surface: q.surface, context: q.context, src: q.srcLang }],
        { src: q.docLang, target: q.targetLang, docId: q.docId, domain: q.domain, retry: true, force: !!force });
    } catch (e) { out = null; }
    if (my !== gen) return view();
    st.busy = false;
    st.calls += (out && Number(out.calls)) || 0;
    const r = out && Array.isArray(out.results) ? out.results[0] : null;
    if (r && r.state === 'ready' && r.value) {
      const v = draftOf(r.value);
      if (st.path === 'saved' && st.entry) {
        // [이 문맥으로 다시 번역] — 번역·뜻·품사·기본형과 문맥을 이 문장으로(사용자 수정이 아니다 → edited 를 새로 세우지 않는다)
        let tr = st.contextTr;
        try { tr = clean(await d.sentenceTr(q.unit || null)) || ''; } catch (e) { tr = ''; }
        if (my !== gen) return view();
        let rec = null;
        try {
          rec = await d.store.update(st.entry.id, { translation: v.translation, gloss: v.gloss, pos: v.pos, lemma: v.lemma,
            origin: 'ai', context: q.context, contextTr: tr, docId: q.docId, docTitle: q.docTitle, pageNo: q.pageNo, lineId: q.lineId }, { user: false });
        } catch (e) { rec = null; }
        if (my !== gen) return view();
        if (rec) st.entry = rec;
        st.draft = draftOf(st.entry && rec ? rec : v);
        st.contextTr = tr;
      } else {
        st.path = 'ai';
        st.draft = v;
      }
      st.base = st.draft.translation;
      st.note = { key: 'vs.found.ai' };
      bump();
    } else if (r && r.state === 'blocked') {
      st.note = { key: BLOCKED_KEYS[r.code] || 'readalong.failed' };
    } else if (r && r.state === 'skipped' && r.code === 'same-lang') {
      st.note = { key: 'vs.sameLang' };
    } else {
      st.note = { key: 'vs.failed' };
    }
    emit();
    return view();
  }

  /** [이 문맥으로 다시 번역] — 고친 항목(`edited`)이면 먼저 묻는다(17-7-3 "고친 번역을 바꿀까요?"). */
  function retranslate() {
    if (!st.open || st.busy || st.path !== 'saved' || !st.entry) return Promise.resolve(view());
    if (st.entry.edited && !st.ask) {
      st.ask = true;
      st.note = { key: 'vs.overwriteAsk' };
      emit();
      return Promise.resolve(view());
    }
    return askAi(true);
  }
  function confirmAsk() { if (!st.ask) return Promise.resolve(view()); st.ask = false; return askAi(true); }
  function cancelAsk() {
    if (!st.ask) return view();
    st.ask = false;
    st.note = { key: 'vs.found.saved' };
    emit();
    return view();
  }

  /**
   * [저장] · [번역 없이 저장](`{bare:true}`). 호출 0.
   *   · 단어장에 있는 낱말이면 고친 번역만(`update(…, {user:true})` → 바뀌었을 때만 `edited`)
   *   · 새 낱말이면 `save` — `origin` 은 찾은 길(sentence·ai), 직접 친 번역·번역 없이는 `user`. 후보·AI 답을 고쳐 저장하면 `edited`.
   * @param {?string} typed  번역 칸 값(없으면 지금 초안)
   */
  async function save(typed, opts) {
    if (!st.open || st.busy || st.tooLong || st.sameLang || !st.path) return view();
    const bare = !!(opts && opts.bare);
    const tr = bare ? '' : clean(typed == null ? st.draft.translation : typed);
    const q = st.q;
    const my = gen;
    st.busy = true;
    st.ask = false;
    emit();
    try {
      if (st.path === 'saved' && st.entry) {
        const rec = await d.store.update(st.entry.id, { translation: tr }, { user: true });
        if (my !== gen) return view();
        if (rec) st.entry = rec;
        st.draft = draftOf(st.entry);
        st.base = st.draft.translation;
        st.note = { key: 'vs.saved' };
      } else {
        const fromModel = st.path === 'ai' || st.path === 'sentence';
        const origin = bare || !tr ? 'user' : st.path === 'ai' ? 'ai' : st.path === 'sentence' ? 'sentence' : 'user';
        const edited = !bare && !!tr && (fromModel ? tr !== clean(st.base) : true);
        const keep = !bare && st.path === 'ai';
        const res = await d.store.save({
          surface: q.surface, term: q.term, srcLang: q.srcLang, targetLang: q.targetLang,
          translation: tr, gloss: keep ? st.draft.gloss : '', pos: keep ? st.draft.pos : '', lemma: keep ? st.draft.lemma : '',
          context: q.context, contextTr: st.contextTr || '', docId: q.docId, docTitle: q.docTitle, pageNo: q.pageNo, lineId: q.lineId,
          origin: origin, edited: edited
        });
        if (my !== gen) return view();
        if (res && res.entry) {
          st.entry = res.entry;
          st.path = 'saved';
          st.draft = draftOf(res.entry);
          st.base = st.draft.translation;
          st.hit = null;
          st.contextTr = clean(res.entry.contextTr);
          st.note = { key: res.created ? 'vs.saved' : 'vs.found.saved' };
        } else {
          st.note = { key: 'vs.saveFailed' };
        }
      }
    } catch (e) {
      if (my !== gen) return view();
      st.note = { key: 'vs.saveFailed' };
    }
    st.busy = false;
    bump();
    emit();
    return view();
  }

  /** [문맥을 이 문장으로 바꾸기] — 호출 0(문장 번역은 메모리·캐시 읽기만). 번역 수정이 아니므로 `edited` 를 세우지 않는다. */
  async function useContext() {
    if (!st.open || st.busy || st.path !== 'saved' || !st.entry) return view();
    const q = st.q;
    const my = gen;
    st.busy = true;
    emit();
    let tr = '';
    try { tr = clean(await d.sentenceTr(q.unit || null)) || ''; } catch (e) { tr = ''; }
    let rec = null;
    try {
      rec = await d.store.update(st.entry.id, { context: q.context, contextTr: tr, docId: q.docId, docTitle: q.docTitle,
        pageNo: q.pageNo, lineId: q.lineId }, { user: false });
    } catch (e) { rec = null; }
    if (my !== gen) return view();
    st.busy = false;
    if (rec) { st.entry = rec; st.contextTr = clean(rec.contextTr); st.note = { key: 'vs.saved' }; } else st.note = { key: 'vs.saveFailed' };
    bump();
    emit();
    return view();
  }

  /** 닫기 — 늦게 온 결과는 버린다. */
  function close() { gen++; st = closedState(); return view(); }

  return { open, ai, retranslate, confirmAsk, cancelAsk, save, useContext, close, view };
}

/* ────────────────────────────────────────────────────────
   3. 화면
   ──────────────────────────────────────────────────────── */

let els = null;
let deps = null;
let flow = null;
/** 열 때 선택했던 줄 — 닫으면 포커스를 돌려놓는다. */
let openedLine = null;
let paintedRev = -1;

/**
 * @param {{pipeline:Object, readalong:Object, units:()=>Array, ctx:()=>Object, lineElement:(id:string)=>?Element,
 *          focusBack?:(lineId:string)=>void, clearSelection?:()=>void, cancelVoice?:()=>void, store?:Object}} d
 * @returns {?{open:Function, close:Function, isOpen:Function}} 마크업·의존이 없으면 null(선택 줄 [단어 번역]을 켜지 않는다)
 */
export function initWordSheet(d) {
  if (typeof document === 'undefined') return null;
  if (els) return api();
  const x = d || {};
  const sheet = document.getElementById('wordSheet');
  if (!sheet || !x.pipeline || !x.readalong || typeof x.units !== 'function' || typeof x.ctx !== 'function') return null;
  els = {
    root: document.documentElement,
    sheet: sheet,
    term: sheet.querySelector('#wsTerm'),
    status: sheet.querySelector('#wsStatus'),
    field: sheet.querySelector('#wsField'),
    input: sheet.querySelector('#wsTr'),
    glossRow: sheet.querySelector('#wsGlossRow'),
    gloss: sheet.querySelector('#wsGloss'),
    memo: sheet.querySelector('#wsMemo'),
    ctxRow: sheet.querySelector('#wsCtxRow'),
    ctx: sheet.querySelector('#wsCtx'),
    ask: sheet.querySelector('#wsAsk'),
    hint: sheet.querySelector('#wsHint')
  };
  deps = x;
  const ra = x.readalong;
  const pl = x.pipeline;
  flow = createSheetFlow({
    store: x.store || vocabStore,
    translateTerms: function (items, opts) { return pl.translateTerms(items, opts); },
    sentenceTr: sentenceTrOf,
    gate: function () { return ra.tapGate(); },
    onChange: render
  });

  sheet.addEventListener('click', onClick);
  els.input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); act('save'); }
  });
  // Esc·Tab — 붙잡기 단계(trband 의 Esc 다음에 등록된다: 띠는 시트(`role=dialog`)를 위층으로 보고 물러난다).
  document.addEventListener('keydown', onKey, true);
  onLangChange(() => { if (els) { applyTranslations(els.sheet); render(flow.view()); } });
  attachDebugHook();
  return api();
}

function api() { return { open: openSnap, close: closeSheet, isOpen: isOpen }; }

/** 문장 번역 — readalong 메모리 → 캐시 읽기만(요청하지 않는다 · 호출 0). */
async function sentenceTrOf(u) {
  if (!u || !deps || !deps.readalong) return null;
  const ra = deps.readalong;
  const m = ra.get(u);
  if (m && m.state === 'ready' && m.text) return String(m.text);
  const c = await ra.cachedFor([u]);
  const hit = c && typeof c.get === 'function' ? c.get(u.seg) : null;
  return hit && hit.text ? String(hit.text) : null;
}

function segmenterFor(lang) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  try {
    const sg = new Intl.Segmenter(lang || undefined, { granularity: 'word' });
    return (s) => Array.from(sg.segment(s));
  } catch (e) { return null; }
}

function firstText(el) {
  const f = el && el.firstChild;
  return f && f.nodeType === 3 ? f.data : '';
}

/** 스냅숏 + 줄 DOM → `pickSurface` 입력(다음 줄 첫 글자는 이 줄 끝이 `.hy` 일 때만, 앞 줄 끝 낱말은 앞 줄이 `.hy` 로 끝날 때만). */
function surfaceOf(snap, lang) {
  const line = deps.lineElement(snap.lineId);
  const text = firstText(line);
  let nextHead = null;
  let prevTail = null;
  if (line) {
    const host = line.closest('article') || line.parentNode;
    const all = host ? Array.from(host.querySelectorAll('span.line[data-flow="1"]')) : [];
    const i = all.indexOf(line);
    if (i >= 0 && line.querySelector('.hy') && all[i + 1]) nextHead = firstText(all[i + 1]);
    if (i > 0 && all[i - 1].querySelector('.hy')) {
      const m = firstText(all[i - 1]).match(/[\p{L}\p{M}\p{N}'’]+$/u);
      prevTail = m ? m[0] : null;
    }
  }
  return pickSurface({ lineText: text, start: snap.start, end: snap.end, multi: !!snap.multi, selText: snap.text,
    nextHead: nextHead, prevTail: prevTail, segFn: segmenterFor(lang) });
}

/** 선택 줄 [단어 번역] → 시트. 스냅숏만 쓴다(선택은 지운다 — 시트가 열린 동안 선택 줄은 숨는다). */
function openSnap(snap) {
  if (!els || !snap || snap.lineId == null) return;
  const c = deps.ctx() || {};
  const units = deps.units() || [];
  const unit = unitAt(units, snap.lineId, snap.start);
  const srcLang = (unit && unit.lang) || c.docLang || '';
  const surface = surfaceOf(snap, srcLang);
  if (typeof deps.clearSelection === 'function') { try { deps.clearSelection(); } catch (e) { /* 선택 없음 */ } }
  openedLine = snap.lineId;
  paintedRev = -1;
  const pageNo = Number.isFinite(Number(snap.page)) && snap.page != null ? Number(snap.page) : c.page;
  const p = flow.open({ surface: surface, srcLang: srcLang, docLang: c.docLang || srcLang, targetLang: c.target || '',
    context: unit ? unit.src : '', unit: unit, docId: c.docId == null ? null : c.docId, docTitle: c.docTitle || '',
    pageNo: pageNo, lineId: snap.lineId, domain: c.domain });
  els.sheet.hidden = false;
  els.root.setAttribute('data-word-sheet', 'on');
  attachDebugHook();
  // 처음 포커스는 원어 머리(입력 칸이 아니다 — 휴대폰 자판이 저절로 뜨지 않게)
  try { els.term.focus({ preventScroll: true }); } catch (e) { /* 포커스 못 옮겨도 시트는 열린다 */ }
  return p;
}

function isOpen() { return !!els && !els.sheet.hidden; }

/** 시트를 닫는다. `back` 이면 포커스를 선택했던 줄로(Esc·[닫기]). 리더를 떠날 때는 false. */
function closeSheet(back) {
  if (!els || els.sheet.hidden) return;
  flow.close();
  els.sheet.hidden = true;
  els.root.removeAttribute('data-word-sheet');
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
    if (!sheetEsc({ open: true, shown: shown(), prevented: ev.defaultPrevented, composing: !!ev.isComposing })) return;
    ev.preventDefault();
    ev.stopPropagation();              // 시트가 가장 위 층 — 아래 층(팝오버 패널)의 Esc 로 퍼지지 않게
    closeSheet(true);
    return;
  }
  if (ev.key === 'Tab' && els.sheet.contains(ev.target)) trapTab(ev);
}

/** 포커스 가둠 — 시트 안 단추·칸 사이에서 돈다. */
function trapTab(ev) {
  const list = Array.from(els.sheet.querySelectorAll('button, input, a[href], [tabindex="0"]'))
    .filter((el) => !el.hidden && !el.disabled && el.getClientRects().length > 0);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  if (ev.shiftKey && i <= 0) { ev.preventDefault(); list[list.length - 1].focus(); }
  else if (!ev.shiftKey && i === list.length - 1) { ev.preventDefault(); list[0].focus(); }
}

function onClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-ws-action]') : null;
  if (!b || !els.sheet.contains(b) || b.hidden || b.getAttribute('aria-disabled') === 'true') return;
  act(b.getAttribute('data-ws-action'));
}

/** 단추 하나 — 첫 줄에서 듣기를 취소한다(손이 이긴다 — 17-7-6 2절 1). */
function act(id) {
  if (!flow) return null;
  if (typeof deps.cancelVoice === 'function') { try { deps.cancelVoice(); } catch (e) { /* 듣기 없음 */ } }
  let p = null;
  if (id === 'close') { closeSheet(true); return null; }
  if (id === 'save') p = flow.save(els.input.value);
  else if (id === 'saveBare') p = flow.save(null, { bare: true });
  else if (id === 'ai') p = flow.ai();
  else if (id === 'retranslate') p = flow.retranslate();
  else if (id === 'askYes') p = flow.confirmAsk();
  else if (id === 'askNo') p = Promise.resolve(flow.cancelAsk());
  else if (id === 'useContext') p = flow.useContext();
  if (p && typeof p.then === 'function') {
    p.then((v) => { if (v && v.banner && TAP_BANNER_NOW.indexOf(v.banner) >= 0) raiseBanner(v.banner); }).catch(() => { });
  }
  return p;
}

/** no-key·consent — 사용자가 번역을 불렀으므로 상태 바 배너를 바로(탭 번역과 같은 문구 — trband `noticeBanner`). */
function raiseBanner(code) {
  const b = noticeBanner(code, '');
  if (!b) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] }
  }));
}

function setLangDir(el, lang) {
  if (!el) return;
  if (lang) { el.setAttribute('lang', lang); el.setAttribute('dir', dirOf(lang)); }
  else { el.removeAttribute('lang'); el.setAttribute('dir', 'auto'); }
}

/** 상태 → 화면. 글자는 전부 textContent/appendBidiText. */
function render(v) {
  if (!els || !v) return;
  const q = v.q || {};
  const target = q.targetLang || '';
  const tdir = dirOf(target);
  // 원어 — 원문 언어의 방향(17-7-3 "원어 칸만 dir=ltr" — 원문 언어가 라틴이면 ltr)
  els.term.textContent = q.surface || '';
  setLangDir(els.term, q.srcLang || '');
  // 상태 한 줄(덮어쓰기 질문 중에는 질문 줄이 단추 옆에 있으므로 비운다 — 같은 글이 두 번 보이지 않게)
  els.status.textContent = v.ask ? '' : v.note ? t(v.note.key, v.note.params || undefined) : (v.busy ? t('readalong.pending') : '');
  // 번역 칸 — 대상 언어 방향. 값은 흐름이 새 초안을 낼 때만 다시 넣는다(사용자가 치는 중에 덮지 않게)
  const editable = !!v.open && !!v.path && !v.tooLong && !v.sameLang;
  els.field.hidden = !editable;
  setLangDir(els.input, target);
  if (v.rev !== paintedRev) { els.input.value = v.draft.translation || ''; paintedRev = v.rev; }
  els.input.readOnly = !!v.busy;
  // 짧은 뜻(AI·단어장)
  const gloss = editable ? v.draft.gloss : '';
  els.glossRow.hidden = !gloss;
  els.gloss.textContent = '';
  if (gloss) { appendBidiText(els.gloss, gloss, tdir); setLangDir(els.gloss, target); }
  // 메모(단어장 항목 — 사용자가 친 글, 방향은 글자가 정한다)
  const memo = v.path === 'saved' && v.entry && v.entry.note ? String(v.entry.note) : '';
  els.memo.hidden = !memo;
  els.memo.textContent = memo;
  els.memo.setAttribute('dir', 'auto');
  // 문맥 문장의 번역 — 찾은 부분(`vs-hit`) 밑줄: 앞·찾은 것·뒤 세 조각을 각각 appendBidiText
  const tr = editable ? String(v.contextTr || '') : '';
  els.ctxRow.hidden = !tr;
  while (els.ctx.firstChild) els.ctx.removeChild(els.ctx.firstChild);
  if (tr) {
    setLangDir(els.ctx, target);
    const at = v.hit && Array.isArray(v.hit.at) ? v.hit.at : null;
    if (at && at[0] >= 0 && at[1] <= tr.length && at[0] < at[1]) {
      appendBidiText(els.ctx, tr.slice(0, at[0]), tdir);
      const mark = document.createElement('span');
      mark.className = 'vs-hit';
      appendBidiText(mark, tr.slice(at[0], at[1]), tdir);
      els.ctx.appendChild(mark);
      appendBidiText(els.ctx, tr.slice(at[1]), tdir);
    } else {
      appendBidiText(els.ctx, tr, tdir);
    }
  }
  // 덮어쓰기 질문
  els.ask.hidden = !v.ask;
  // 단추
  const show = v.buttons || [];
  for (const b of els.sheet.querySelectorAll('.ws-actions [data-ws-action]')) {
    const id = b.getAttribute('data-ws-action');
    b.hidden = show.indexOf(id) < 0;
    if (v.busy) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
  }
  // 안내 한 줄 — 찾지 못했을 때만(17-7-2 3)
  els.hint.hidden = !(v.open && v.path === 'none' && !v.busy);
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(길이·길·문구 키·단추만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.wordsheet && g.wordsheet.__mine) return;
  g.wordsheet = {
    __mine: true,
    state: function () {
      if (!flow || !els) return null;
      const v = flow.view();
      return { open: !els.sheet.hidden, path: v.path, note: v.note ? v.note.key : null, busy: v.busy, ask: v.ask,
        buttons: v.buttons, calls: v.calls, tooLong: v.tooLong, sameLang: v.sameLang, hit: !!v.hit,
        termLen: v.q && v.q.surface ? v.q.surface.length : 0, inputLen: els.input.value.length,
        inputDir: els.input.getAttribute('dir'), ctxLen: els.ctx.textContent.length,
        entry: v.entry ? { origin: v.entry.origin, edited: !!v.entry.edited, hasTr: !!v.entry.translation, hasCtxTr: !!v.entry.contextTr } : null };
    },
    /** 스냅숏을 바로 넣는다(선택 모사 없이 — 측정용). */
    openSnap: function (s) { return openSnap(s); }
  };
}
