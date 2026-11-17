/* ============================================================
   MedReader — 기억 카드 만들기: 세 입구 (spec 17-11 5 · 12-D5·D6 — 12-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   띠 `[☆]`(낭독·탭·설명 세 모드 — `ui/trband.js`) · 선택 줄 `[⋯] → [기억 카드]`(`ui/selbar.js`) · 음성 "기억"(`ui/voice.js`)이
   **같은 길**로 `cardStore.saveSentence`(12-1)에 닿는다:
     문장 단위(`speaker.sentenceUnits()` — 탭 번역·설명과 같은 단위) → 카드 입력(`cardInput` — 앞면·원문 언어(8m `Unit.lang`)·문서·쪽·
     줄·문단·출처) → 뒷면 = 그 문장의 번역(메모리 `readalong.get` → 캐시 읽기 `readalong.cachedFor`) → 저장.
   · 번역이 아직 없으면 **앞면만** 저장하고(12-D6 — 음성 "기억"이 실패하지 않게) 그 문장 번역이 메모리에 들어오면(`readalong.onChange`)
     그 자리에서 채운다(`fillBack`). 리더 세션 동안만 듣는다(`pendingBacks` — 리더를 떠나면 `leave()` 가 거둔다). 못 채운 뒷면은
     복습 때 `fillBack`(12-3).
   · 띠 `[★]` = 그 문장(들)의 카드가 모두 있다(설명 모드면 설명 사본까지). id 는 `cardStore.idFor`(책 칸이 문서 fileHash 바탕 — 12-1b,
     `sentenceIdOf(tl, docId, front)` 를 직접 부르지 않는다). 다시 누르면 아직 복습하지 않은 카드만 지운다(`removeIfFresh`) ·
     복습한 카드는 남기고 한 줄(`remember.reviewed`).

   ── 지키는 것 ──────────────────────────────────────────
   ★ **AI 요청 0** — pipeline 을 모른다(주입도 받지 않는다). readalong 은 `get`·`cachedFor`(캐시 읽기만)·`onChange`(구독)만.
   ★ 낭독을 멈추지 않는다 — speaker 는 **읽기만**(`getCurrent`·`getIndex`·`getUnit` — 음성 "기억"의 지금 문장). 음성 갈래의
     멈춤·한 마디·되돌림(`restore(was)`)은 9b 흐름(`ui/voice.js`).
   ★ DOM 0 — 그리기는 띠·선택 줄·음성 상태 줄이 한다. 글자를 담는 디버그 값 없음(수·상태만).
   import 방향(3-2): ui 계층 — `srs/cards`(서비스, 부르기만) · `text/*`(순수) · `ui/ask.js` 의 순수 export(`sentenceIndexOf` — 요약·설명과 같은 "지금 문장").
   ============================================================ */

import { cardStore as defaultStore } from '../srs/cards.js';
import { explainable, clean } from '../text/summary.js';
import { unitAt } from '../text/select.js';
import { sentenceIndexOf } from './ask.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — `tests/remember-12.test.mjs`
   ──────────────────────────────────────────────────────── */

/**
 * 문장 단위 하나 → `saveSentence` 입력. 문장이 아니면(표 안내·인용·빈 글 — `explainable`) 또는 문서·대상 언어가 없으면 null.
 * @param {Object} unit  `{src, seg, lineIds, paraId, lang?}`
 * @param {{docId:string, docTitle?:string, page?:number, target:string, docLang?:string, domain?:string}} ctx  리더 값
 * @param {string} origin  'band'|'tap'|'explain'|'select'|'voice'
 * @param {{back?:string, explain?:string}} [extra]
 * @returns {?Object}
 */
export function cardInput(unit, ctx, origin, extra) {
  if (!explainable(unit)) return null;
  const c = ctx || {};
  const x = extra || {};
  const front = clean(unit.src);
  if (!front || !c.docId || !c.target) return null;
  const page = Number(c.page);
  return {
    front: front,
    back: clean(x.back),
    explain: clean(x.explain),
    srcLang: String(unit.lang || c.docLang || ''),
    targetLang: String(c.target),
    docId: String(c.docId),
    docTitle: String(c.docTitle == null ? '' : c.docTitle),
    pageNo: Number.isFinite(page) ? page : null,
    lineId: Array.isArray(unit.lineIds) && unit.lineIds.length ? String(unit.lineIds[0]) : null,
    paraId: unit.paraId == null ? null : String(unit.paraId),
    origin: origin,
    domain: String(c.domain == null ? '' : c.domain)
  };
}

/**
 * 띠 단추 대상 → 문장 단위들. `unit`(설명 모드)이 있으면 그것 하나, 아니면 `segs`(낭독 문장·탭한 문장 — `{seg, src}`)마다
 * seg·글이 같은 단위(없으면 글이 같은 첫 단위). 문장이 아닌 것·겹치는 것은 뺀다. 순수 함수.
 * @param {Array} units  `speaker.sentenceUnits()`
 * @param {{unit?:Object, segs?:{seg:number, src:string}[]}} target
 * @returns {Object[]}
 */
export function unitsFor(units, target) {
  const list = Array.isArray(units) ? units : [];
  const t = target || {};
  if (t.unit) return explainable(t.unit) ? [t.unit] : [];
  const out = [];
  for (const s of Array.isArray(t.segs) ? t.segs : []) {
    if (!s || typeof s.src !== 'string' || !s.src) continue;
    const u = list.find((x) => !!x && x.seg === s.seg && x.src === s.src) || list.find((x) => !!x && x.src === s.src) || null;
    if (u && explainable(u) && out.indexOf(u) < 0) out.push(u);
  }
  return out;
}

/**
 * 선택 줄 [기억 카드] — 선택 시작 줄·오프셋의 문장(`unitAt` — [문장 번역]·[설명]과 같은 규칙). 없으면 null. 순수 함수.
 * @param {Array} units
 * @param {{lineId:string, start:number}} snap
 */
export function selectionUnit(units, snap) {
  if (!snap || snap.lineId == null) return null;
  return unitAt(Array.isArray(units) ? units : [], snap.lineId, snap.start) || null;
}

/**
 * 음성 "기억" — 지금 문장(문장 모드 = 낭독 큐 번호, 줄 모드 = 지금 줄을 담은 첫 문장 — 요약·설명과 같은 `sentenceIndexOf`).
 * 낭독한 적이 없으면(`cur` 없음) null. 표 안내 위면 그 단위(문장 아님 → 부르는 쪽이 `none`). 순수 함수.
 */
export function voiceUnit(units, cur, idx, unitMode) {
  const list = Array.isArray(units) ? units : [];
  if (!cur || !list.length) return null;
  return list[sentenceIndexOf(list, cur, idx, unitMode)] || null;
}

/** `[★]` — 문장마다 "카드 있음"이 모두 참이고 하나 이상일 때. 순수 함수. */
export function starPressed(flags) {
  return Array.isArray(flags) && flags.length > 0 && flags.every((f) => f === true);
}

/* ────────────────────────────────────────────────────────
   2. 서비스 — 주입만(DOM 0)
   ──────────────────────────────────────────────────────── */

/**
 * @param {{store?:Object, readalong?:Object, speaker?:Object, units:()=>Array, ctx:()=>Object}} deps
 *   `store` = `cardStore`(시험은 가짜) · `readalong` = `get`·`cachedFor`·`onChange` · `speaker` = 읽기만(`getCurrent`·`getIndex`·`getUnit`)
 *   · `units()` = 문장 단위(`speaker.sentenceUnits()`) · `ctx()` = `{docId, docTitle, page, target, docLang, domain}`
 */
export function createRemember(deps) {
  const d = deps || {};
  const store = d.store || defaultStore;
  const ra = d.readalong || null;
  /** 뒷면을 기다리는 카드 id → 구독 해제 함수(`readalong.onChange`). 리더 세션 동안만. */
  const pendingBacks = new Map();
  const stats = { saved: 0, created: 0, removed: 0, kept: 0, filled: 0, lastKey: null };

  function units() { try { return (typeof d.units === 'function' && d.units()) || []; } catch (e) { return []; } }
  function ctx() { try { return (typeof d.ctx === 'function' && d.ctx()) || {}; } catch (e) { return {}; } }

  /** 그 문장의 번역 — 메모리 → 캐시 읽기(호출 0). 없으면 ''. */
  async function backFor(u) {
    if (!ra) return '';
    try {
      const r = typeof ra.get === 'function' ? ra.get(u.src) : null;
      if (r && r.state === 'ready' && clean(r.text)) return clean(r.text);
    } catch (e) { /* 캐시로 */ }
    try {
      if (typeof ra.cachedFor === 'function') {
        const m = await ra.cachedFor([u]);
        const hit = m && typeof m.get === 'function' ? m.get(u.seg) : null;
        if (hit && hit.src === u.src && clean(hit.text)) return clean(hit.text);
      }
    } catch (e) { /* 앞면만 */ }
    return '';
  }

  function dropPending(id) {
    const off = pendingBacks.get(id);
    if (!off) return;
    pendingBacks.delete(id);
    try { off(); } catch (e) { /* 이미 풀림 */ }
  }

  /** `[12-D6]` 앞면만 저장한 카드 — 그 문장 번역이 메모리에 들어오면 그 자리에서 채운다(한 번, 호출 0). */
  function waitBack(card, u) {
    if (!ra || typeof ra.onChange !== 'function' || !card || !card.id || pendingBacks.has(card.id)) return;
    const id = card.id;
    let off = null;
    try {
      off = ra.onChange(u.src, (rec) => {
        const text = rec && rec.state === 'ready' ? clean(rec.text) : '';
        if (!text || !pendingBacks.has(id)) return;
        dropPending(id);
        Promise.resolve()
          .then(() => store.fillBack(card, () => text))
          .then((c) => { if (c && clean(c.back)) stats.filled++; }, () => null);
      });
    } catch (e) { off = null; }
    if (typeof off === 'function') pendingBacks.set(id, off);
  }

  /** 단위들을 카드로 — 하나씩(같은 id 는 저장소가 한 장으로). */
  async function saveUnits(list, origin, extra) {
    const c = ctx();
    const out = { saved: 0, created: 0 };
    for (const u of list) {
      const input = cardInput(u, c, origin, extra);
      if (!input) continue;
      input.back = await backFor(u);
      const r = await store.saveSentence(input);
      if (!r || !r.card) continue;
      out.saved++;
      if (r.created) out.created++;
      if (!clean(r.card.back)) waitBack(r.card, u);
    }
    stats.saved += out.saved;
    stats.created += out.created;
    return out;
  }

  /** 단위들의 카드 id 와 "모두 있음" — 설명 모드(`needExplain`)면 설명 사본까지 있어야 `[★]`(없으면 눌러 채운다). */
  async function stateOf(list, needExplain) {
    const c = ctx();
    const ids = [];
    for (const u of list) {
      const id = await store.idFor({ front: clean(u.src), targetLang: c.target, docId: c.docId });
      if (id) ids.push(id);
    }
    if (!ids.length || ids.length !== list.length) return { ids: ids, pressed: false };
    const have = await Promise.all(ids.map((id) => Promise.resolve(store.get(id)).then(
      (x) => !!x && x.kind === 'sentence' && (!needExplain || !!clean(x.explain)), () => false)));
    return { ids: ids, pressed: starPressed(have) };
  }

  /** 띠 `[☆]`/`[★]` 의 상태(문장이 바뀔 때 한 번). */
  async function stateFor(target) {
    const t = target || {};
    const list = unitsFor(units(), t);
    if (!list.length) return { pressed: false };
    try { return { pressed: (await stateOf(list, t.origin === 'explain')).pressed }; } catch (e) { return { pressed: false }; }
  }

  /**
   * 띠 단추 누름 — `[☆]` 면 저장(뒷면은 메모리·캐시 · 설명 모드는 설명 사본) · `[★]` 면 복습 전 카드만 지움.
   * @returns {Promise<{pressed:boolean, key:string}>} 누른 뒤 상태 · 띠 한 줄 키
   */
  async function toggle(target) {
    const t = target || {};
    const list = unitsFor(units(), t);
    if (!list.length) return done({ pressed: false, key: 'voice.remember.none' });
    const needExplain = t.origin === 'explain';
    const st = await stateOf(list, needExplain);
    if (st.pressed) {
      let kept = 0;
      for (const id of st.ids) {
        dropPending(id);
        if (await store.removeIfFresh(id)) stats.removed++;
        else kept++;
      }
      stats.kept += kept;
      const after = kept ? await stateOf(list, needExplain) : { pressed: false };
      return done({ pressed: after.pressed, key: kept ? 'remember.reviewed' : 'remember.removed' });
    }
    const r = await saveUnits(list, t.origin, { explain: needExplain ? t.explain : '' });
    if (!r.saved) return done({ pressed: false, key: 'remember.failed' });
    const after = await stateOf(list, needExplain);
    return done({ pressed: after.pressed, key: 'remember.saved' });
  }

  function done(r) { stats.lastKey = r.key || null; return r; }

  /**
   * 선택 줄 `[⋯] → [기억 카드]` — 선택 시작 줄의 문장을 카드로(문장 아래 표시·번역 끔에서도). 지우지 않는다(토글 아님).
   * @returns {Promise<{ok:boolean, created?:boolean, key:string}>}
   */
  async function fromSelection(snap) {
    const u = selectionUnit(units(), snap);
    if (!explainable(u)) return done({ ok: false, key: 'voice.remember.none' });
    const r = await saveUnits([u], 'select', null);
    if (!r.saved) return done({ ok: false, key: 'remember.failed' });
    return done({ ok: true, created: r.created > 0, key: r.created ? 'remember.saved' : 'remember.exists' });
  }

  /**
   * 음성 "기억" — 지금 문장. 문장이 없거나 표 안내면 `{ok:false, key:'voice.remember.none'}`(카드 0).
   * @returns {Promise<{ok:boolean, created?:boolean, key:string}>}
   */
  async function fromVoice() {
    const sp = d.speaker || null;
    let u = null;
    try {
      u = voiceUnit(units(), sp && typeof sp.getCurrent === 'function' ? sp.getCurrent() : null,
        sp && typeof sp.getIndex === 'function' ? sp.getIndex() : 0, sp && typeof sp.getUnit === 'function' ? sp.getUnit() : 'sentence');
    } catch (e) { u = null; }
    if (!explainable(u)) return done({ ok: false, key: 'voice.remember.none' });
    const r = await saveUnits([u], 'voice', null);
    if (!r.saved) return done({ ok: false, key: 'remember.failed' });
    return done({ ok: true, created: r.created > 0, key: r.created ? 'remember.saved' : 'remember.exists' });
  }

  /** 리더를 떠남 — 뒷면 기다림을 거둔다(다른 문서·세션의 번역으로 채우지 않는다). */
  function leave() { for (const id of Array.from(pendingBacks.keys())) dropPending(id); }

  return {
    stateFor: stateFor,
    toggle: toggle,
    fromSelection: fromSelection,
    fromVoice: fromVoice,
    leave: leave,
    /** `[D]` 측정 — 수·마지막 키만(글자·id 없음). */
    debug: function () { return Object.assign({ pending: pendingBacks.size }, stats); }
  };
}
