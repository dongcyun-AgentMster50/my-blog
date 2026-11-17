/* ============================================================
   MedReader — "부르면 묻기" 흐름: 요약 갈래 (spec 17-2-1 3 · 4-5 · 11-D11–D13 — 11-2) · 설명 갈래 (4-7 · 11-D15·D16·D20 — 11-4)

   ── 이 파일이 하는 일 ───────────────────────────────────
   선택 동작 줄 `[⋯] → [요약]`·음성 "요약"이 **같은 흐름**을 탄다:
     대상 문단 정하기 → 요약 가능? → 문지기(8c-1 `tapGate` 순서: consent → unsupported-lang → no-key — 요약은 같은 언어도 한다)
     → 시트 열기(그 문단 1회, 캐시 적중이면 0) → (음성이면) 요지를 대상 언어로 한 번 말하기
   · 단추로: 선택 시작 줄의 문장(`unitAt`)이 속한 문단. 낭독은 끊지 않는다(시트만 — 11-2 수용 기준).
   · 음성으로: `summaryTarget(sentenceUnits(), 지금 문장)` — 지금 문장이 문단 첫 문장이면 **바로 앞 문단**(11-D12).
     결과가 준비되면 `sayer.say(trSpeechText(요지), 대상 언어)` 를 돌려준다 — 되돌림(`restore(was)`)은 9b 흐름(`ui/voice.js`)이 한다.
     실패·막힘이면 `{ok:false, key}` — 상태 줄·한 마디·되돌림도 voice.js(9b 규칙 그대로).
   · 시트 [▶ 듣기]: 낭독 중이면 멈추고 → 요지를 말한 뒤 → 이어 읽는다(11-D15 와 같은 규칙). 듣는 중 손이 닿으면 멈춤(되돌림 없음).
   `[11-4]` 선택 줄 `[설명]`·음성 "설명"이 **같은 흐름**(`explain`)을 탄다(11-D15):
     대상 문장(단추 = 선택 시작 줄·오프셋의 문장 `unitAt` · 음성 = 지금 문장) → 설명할 수 있나(`explainable` — 표 안내·인용 아님) →
     문지기(요약과 같은 `gate` — 같은 언어도 한다) → 읽는 중이면 `speaker.pause()`(단추로 불러도 — 설명을 소리로 듣게) →
     띠 설명 모드 "준비 중"(`band.openNote`) → `pipeline.explain({문장, 그 문단 글})`(캐시 적중이면 즉시) →
     준비되면 띠에 글 + `sayer.say(trSpeechText(글), 대상 언어)` 한 번 → (단추) 끝나면 읽던 중이었으면 [▶] 와 같은 함수로 이어 읽기 ·
     (음성) `{ok, done}` 을 돌려주고 되돌림은 9b 흐름(voice.js `restore(was)`) · 실패·막힘이면 띠 한 줄 → 곧 되돌림(음성은 한 마디 뒤).
     `[11-4b]` 단추·읽던 중의 실패(원격 막힘 아님)는 재개와 함께 띠가 닫히므로 상태 바 `explain.failed` + [다시 시도](띠 `noteBanner`) ·
     설명 A 가 열린 채 다른 문장 [설명] B → B 는 A 의 `was` 를 이어받는다.
     `[11-4c]` 그 [다시 시도]는 실패 때의 문서·쪽이 지금과 다르면 부르지 않는다(띠가 리더를 떠날 때·쪽이 바뀔 때 배너를 거두는 것과 두 겹).
     띠 [×]·Esc → 말하기 멈춤(되돌림 없음 — 손이 이긴다) · [다시 시도] · [▶ 다시 듣기](= [▶ 듣기] 규칙).

   ── 지키는 것 ──────────────────────────────────────────
   ★ ui 계층 — speaker·readalong·시트·sayer·`pressPlay` 는 controls 가 **주입**한다(voice.js 는 이 파일을 import 하지 않고 주입받는다).
   ★ 문단 글은 `paraTextsOf(sentencesOf(문장 단위))` 한 길 — 한 문단 요약·쪽 요약·저장이 같은 글(같은 캐시 키 — 17-2-1 3).
   ★ 괄호 속 라틴(원어)은 소리에서만 뺀다 — `trSpeechText`(번역문 낭독과 같은 규칙). 화면 글은 그대로.
   ============================================================ */

import { sentencesOf, trSpeechText } from '../tts/text.js';
import { paraTextsOf, eligible, summaryTarget, explainable, clean } from '../text/summary.js';
import { unitAt } from '../text/select.js';

/** "읽는 중" — speaking·waiting-page(9a·9b `isReading` 과 같은 뜻). */
function isReading(state) { return state === 'speaking' || state === 'waiting-page'; }

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — `tests/sumsheet-11b.test.mjs`
   ──────────────────────────────────────────────────────── */

/**
 * 쪽의 문단 글 + 그 문단의 줄 id(읽기 순서·중복 없음 — 저장 `anchor.lineIds`·[원문으로]·"그 문단으로 굴리기"의 재료).
 * @param {Array} units  문장 단위(`speaker.sentenceUnits()`)
 * @returns {{paraId:string, text:string, n:number, chars:number, kind:string, frag:?string, lineIds:string[]}[]}
 */
export function pageParasOf(units) {
  const list = Array.isArray(units) ? units : [];
  const lines = new Map();
  for (const u of list) {
    if (!u || u.paraId == null) continue;
    const k = String(u.paraId);
    if (!lines.has(k)) lines.set(k, []);
    const arr = lines.get(k);
    for (const id of Array.isArray(u.lineIds) ? u.lineIds : []) if (arr.indexOf(String(id)) < 0) arr.push(String(id));
  }
  return paraTextsOf(sentencesOf(list)).map((p) => Object.assign({}, p, { lineIds: lines.get(String(p.paraId)) || [] }));
}

/**
 * 음성 "요약"의 지금 문장 번호 — 문장 단위 목록에서. 문장 모드면 낭독 큐 번호 그대로(`sentenceUnits()` 가 큐 사본),
 * 줄 모드면 지금 줄(`cur.lineIds[0]`)을 담은 첫 문장. 못 찾으면 0.
 * @param {Array} sentUnits  `speaker.sentenceUnits()`
 * @param {?Object} cur  `speaker.getCurrent()`
 * @param {number} idx  `speaker.getIndex()`
 * @param {string} unit  `speaker.getUnit()`
 */
export function sentenceIndexOf(sentUnits, cur, idx, unit) {
  const list = Array.isArray(sentUnits) ? sentUnits : [];
  if (unit !== 'line') return Number.isInteger(idx) && idx >= 0 && idx < list.length ? idx : 0;
  const id = cur && Array.isArray(cur.lineIds) && cur.lineIds.length ? String(cur.lineIds[0]) : null;
  if (id === null) return 0;
  for (let i = 0; i < list.length; i++) if (list[i] && Array.isArray(list[i].lineIds) && list[i].lineIds.map(String).indexOf(id) >= 0) return i;
  return 0;
}

/**
 * 요약 대상 — 단추(`snap` — 선택 시작 줄·오프셋의 문장 문단) 또는 음성(`index` — 11-D12 앞 문단 규칙). 순수 함수.
 * @param {Array} sentUnits
 * @param {{snap?:{lineId:string, start:number}, index?:number}} at
 * @returns {{para:?Object, paras:Object[], prev:boolean}} `prev` = 지금 문장의 문단이 아니라 앞 문단(음성 확인 줄 "앞 문단 요약")
 */
export function summaryPlan(sentUnits, at) {
  const list = Array.isArray(sentUnits) ? sentUnits : [];
  const a = at || {};
  const paras = pageParasOf(list);
  let pid = null;
  let here = null;
  if (a.snap && a.snap.lineId != null) {
    const u = unitAt(list, a.snap.lineId, a.snap.start);
    pid = u && u.paraId != null ? String(u.paraId) : null;
    here = pid;
  } else {
    const i = Number.isInteger(a.index) ? a.index : 0;
    pid = summaryTarget(list, i);
    const u = list[i];
    here = u && u.paraId != null ? String(u.paraId) : null;
  }
  const para = pid === null ? null : paras.find((p) => String(p.paraId) === pid) || null;
  return { para: para, paras: paras, prev: !!para && here !== null && here !== pid };
}

/**
 * `[11-4 — 17-2-1 3 · 4-7]` 설명 대상 — 단추(`snap` — 선택 시작 줄·오프셋의 문장) 또는 음성(`index` — 지금 문장). 순수 함수.
 * `context` = 그 문장의 문단 글(`pageParasOf` — 요약·저장과 같은 `paraTextsOf` 한 길), 문단이 없으면 문장만.
 * @param {Array} sentUnits  문장 단위(`speaker.sentenceUnits()`)
 * @param {{snap?:{lineId:string, start:number}, index?:number}} at
 * @returns {{unit:?Object, ok:boolean, sentence:string, context:string, lineId:?string}}
 *   `ok` = 설명할 수 있는 문장(`explainable` — 표 안내·인용·빈 글 아님) · `lineId` = 띠를 닫은 뒤 포커스를 돌려놓을 줄
 */
export function explainPlan(sentUnits, at) {
  const list = Array.isArray(sentUnits) ? sentUnits : [];
  const a = at || {};
  let u = null;
  if (a.snap && a.snap.lineId != null) {
    u = unitAt(list, a.snap.lineId, a.snap.start) || null;
    // 문장이 아닌 줄(표 안내·인용)을 골랐다 — `unitAt` 은 문장만 본다. 그 줄의 단위를 찾아 "설명하지 않음" 한 줄로(없음과 구별).
    if (!u) {
      const id = String(a.snap.lineId);
      u = list.find((x) => x && Array.isArray(x.lineIds) && x.lineIds.map(String).indexOf(id) >= 0) || null;
    }
  } else {
    const i = Number.isInteger(a.index) ? a.index : 0;
    u = i >= 0 && i < list.length ? list[i] || null : null;
  }
  const ok = explainable(u);
  const sentence = u ? clean(u.src) : '';
  let context = sentence;
  if (ok && u.paraId != null) {
    const p = pageParasOf(list).find((x) => String(x.paraId) === String(u.paraId));
    if (p && p.text) context = p.text;
  }
  const lineId = a.snap && a.snap.lineId != null ? String(a.snap.lineId)
    : (u && Array.isArray(u.lineIds) && u.lineIds.length ? String(u.lineIds[0]) : null);
  return { unit: u, ok: ok, sentence: sentence, context: context, lineId: lineId };
}

/* ────────────────────────────────────────────────────────
   2. 흐름
   ──────────────────────────────────────────────────────── */

/**
 * @param {{speaker:Object, readalong:{tapGate:Function}, sheet:{open:Function, isOpen?:Function},
 *          sayer:{say:Function, stop:Function, busy:Function}, units:()=>Array, ctx:()=>Object, pressPlay:()=>void,
 *          beforeOpen?:()=>void}} deps
 *   `ctx()` = `{docId, page, src, target, domain, docTitle, provider, model}`(리더 값) · `beforeOpen` = 단어 시트·선택 줄 거두기
 */
export function createAsk(deps) {
  const d = deps || {};
  const sp = d.speaker;
  function state() { try { return sp ? sp.getState() : 'idle'; } catch (e) { return 'idle'; } }

  /** 문지기 — 8c-1 `tapGate` 그대로, 단 요약은 같은 언어도 한다(같은 언어면 키 확인은 파이프라인 `gate` 가 — 보내지 않음). */
  function gate() {
    let g = { ok: true, reason: null };
    try { g = d.readalong && typeof d.readalong.tapGate === 'function' ? d.readalong.tapGate() : g; } catch (e) { g = { ok: true, reason: null }; }
    if (!g || g.ok || g.reason === 'same-lang') return { ok: true, reason: null };
    return { ok: false, reason: g.reason || null };
  }

  /** 선택 줄 [요약] 이 흐린가 — 그 선택의 문단이 요약 가능한가(호출 0 · 읽기만). */
  function canSummarize(snap) {
    try {
      const p = summaryPlan(d.units(), { snap: snap });
      return !!p.para && eligible(p.para);
    } catch (e) { return false; }
  }

  /**
   * 요약 한 번. `via:'button'` → `snap` 의 문단 · `via:'voice'` → 지금 문장(11-D12).
   * @param {{via:'button'|'voice', snap?:Object, alive?:()=>boolean}} o  `alive` — 음성 흐름이 아직 살아 있나(9b 가 넘긴다)
   * @returns {Promise<{ok:boolean, key?:string, prev?:boolean, done?:Promise<'end'|'stopped'>}>}
   */
  async function summarize(o) {
    const x = o || {};
    const units = d.units() || [];
    let plan;
    if (x.via === 'voice') {
      const cur = sp && typeof sp.getCurrent === 'function' ? sp.getCurrent() : null;
      const idx = sp && typeof sp.getIndex === 'function' ? sp.getIndex() : 0;
      const unit = sp && typeof sp.getUnit === 'function' ? sp.getUnit() : 'sentence';
      plan = summaryPlan(units, { index: sentenceIndexOf(units, cur, idx, unit) });
    } else {
      plan = summaryPlan(units, { snap: x.snap });
    }
    const ok = !!plan.para && eligible(plan.para);
    if (typeof d.beforeOpen === 'function') { try { d.beforeOpen(); } catch (e) { /* 거두지 못해도 연다 */ } }
    const g = ok ? gate() : { ok: true, reason: null };
    const c = (typeof d.ctx === 'function' ? d.ctx() : null) || {};
    const v = await d.sheet.open({ para: ok ? plan.para : null, pageParas: plan.paras, ctx: c, gate: g,
      lineId: x.snap ? x.snap.lineId : null });
    if (!ok) return { ok: false, key: 'sum.notEligible', prev: plan.prev };
    const it = v && Array.isArray(v.items) ? v.items[0] : null;
    if (!it || it.state !== 'ready' || !it.value) {
      return { ok: false, key: (it && it.note && it.note.key) || 'sum.failed', prev: plan.prev };
    }
    if (x.via !== 'voice') return { ok: true, prev: plan.prev };
    // 기다리는 사이 손이 닿았다(9b `cancel` — [▶]·줄 탭·마이크…) — 말하지 않는다(되돌림도 없음).
    if (typeof x.alive === 'function' && !x.alive()) return { ok: false, key: null, prev: plan.prev, cancelled: true };
    // 11-D13 — 음성으로 불렀으면 요지를 대상 언어 음성으로 한 번(시트는 열린 채). 되돌림은 9b 흐름(voice.js)이 이 약속 뒤에.
    return { ok: true, prev: plan.prev, done: d.sayer.say(trSpeechText(it.value.gist), (v.ctx && v.ctx.target) || c.target || '') };
  }

  /**
   * 시트 [▶ 듣기] — 낭독 중이면 멈추고 말한 뒤 이어 읽는다. 손이 닿아 끊기면('stopped') 되돌리지 않는다.
   * @returns {Promise<'end'|'stopped'>}
   */
  function listen(text, lang) {
    const was = state();
    if (isReading(was) && sp) sp.pause();
    const p = d.sayer.say(trSpeechText(text), lang || '');
    return Promise.resolve(p).then((how) => {
      if (how === 'end' && isReading(was) && !isReading(state()) && typeof d.pressPlay === 'function') d.pressPlay();
      return how;
    });
  }

  /* ── `[11-4 — spec 17-2-1 4-7 · 11-D15·D16]` 설명 갈래 ── */

  /** 띠(설명 모드) — controls 가 주입한 `trband`. 없으면 띠 없이(소리·결과만). */
  const band = d.band || null;
  function bandCall(name) {
    const args = Array.prototype.slice.call(arguments, 1);
    try { return band && typeof band[name] === 'function' ? band[name].apply(band, args) : null; } catch (e) { return null; }
  }
  /** 이 설명 띠가 아직 열려 있나(손이 [×]·다른 줄 탭·[▶]·쪽 넘김으로 닫았으면 거짓). 띠가 없으면 늘 참. */
  function noteAlive(id) { return !band || !id || typeof band.isNoteOpen !== 'function' ? true : !!bandCall('isNoteOpen', id); }
  /** 실패·막힘의 한 줄 키 — 띠와 같은 규칙(`trband.noteView`). 음성 흐름의 상태 줄·한 마디가 쓴다. */
  function noteKeyOf(rec) {
    const v = bandCall('noteView', rec, null);
    return v && v.noteKey ? v.noteKey : 'explain.failed';
  }

  /** 설명 글을 대상 언어 음성으로 한 번 — 말하는 동안 띠를 굴린다. `'end'|'stopped'`. */
  let sayTok = 0;
  function sayNote(id, text, lang) {
    const tok = ++sayTok;                      // [▶ 다시 듣기]가 앞 말하기를 끊으면('stopped') 앞 것의 끝이 새 굴림을 멈추지 않게
    bandCall('noteRoll', id, true);
    let p;
    try { p = Promise.resolve(d.sayer.say(trSpeechText(text), lang || '')); } catch (e) { p = Promise.resolve('stopped'); }
    const off = () => { if (tok === sayTok) bandCall('noteRoll', id, false); };
    return p.then((how) => { off(); return how; }, () => { off(); return 'stopped'; });
  }

  /** 단추 갈래의 되돌림 — 읽던 중이었고 지금 멈춰 있으면 [▶] 와 같은 함수로 그 문장부터. */
  function resumeIf(was) {
    if (isReading(was) && !isReading(state()) && typeof d.pressPlay === 'function') d.pressPlay();
  }

  /**
   * `[11-4b — 11-4R #2]` 마지막으로 연 설명 띠의 번호와 그 누름의 `was`. 설명 A 가 열린 채(기다리는·말하는 중 — A 가 낭독을 멈췄다)
   * 다른 문장 [설명] B 를 누르면 B 는 A 의 `was` 를 이어받는다 — B 가 끝나면 A 때 읽던 대로 이어 읽기
   * (9b-3 D10 "안내 중 다시 탭은 그 누름의 was 를 이어받는다"와 같은 결). A 의 띠가 이미 닫혔으면(재개·[×]·쪽 넘김) 잇지 않는다.
   */
  let held = { id: 0, was: 'idle' };
  function inherit(was) {
    if (isReading(was) || !held.id || !isReading(held.was)) return was;
    return bandCall('isNoteOpen', held.id) ? held.was : was;
  }

  /**
   * 설명 한 번. `via:'button'` → `snap` 의 문장 · `via:'voice'` → 지금 문장. `retry` = 띠 [다시 시도](사용자 동작).
   * 단추 갈래는 되돌림까지 여기서(`was` = 누른 순간), 음성 갈래는 `{ok, key, done}` 만 — 되돌림은 9b 흐름(voice.js).
   * @param {{via:'button'|'voice', snap?:Object, was?:string, alive?:()=>boolean, retry?:boolean, plan?:Object}} o
   * @returns {Promise<{ok:boolean, key?:?string, done?:Promise<'end'|'stopped'>, cancelled?:boolean}>}
   */
  async function explain(o) {
    const x = o || {};
    const voice = x.via === 'voice';
    let plan = x.plan || null;
    if (!plan) {
      const units = d.units() || [];
      if (voice) {
        const cur = sp && typeof sp.getCurrent === 'function' ? sp.getCurrent() : null;
        const idx = sp && typeof sp.getIndex === 'function' ? sp.getIndex() : 0;
        const unit = sp && typeof sp.getUnit === 'function' ? sp.getUnit() : 'sentence';
        plan = explainPlan(units, { index: sentenceIndexOf(units, cur, idx, unit) });
      } else {
        plan = explainPlan(units, { snap: x.snap });
      }
    }
    // 단추 = 누른 순간의 상태 — 단, 앞 설명이 열린 채 낭독을 멈춰 두었으면 그 `was`(11-4b #2). 음성 = 9b 가 넘긴 것.
    const was = voice ? x.was : inherit(state());
    if (typeof d.beforeOpen === 'function') { try { d.beforeOpen(); } catch (e) { /* 거두지 못해도 연다 */ } }
    const c = (typeof d.ctx === 'function' ? d.ctx() : null) || {};
    const focusBack = plan.lineId != null && typeof d.focusBack === 'function'
      ? function (reveal) { d.focusBack(plan.lineId, reveal); } : null;
    const stopSaying = function () { try { d.sayer.stop(); } catch (e) { /* 이미 끝남 */ } };
    // 대상 아님(표 안내·인용·빈 줄) — 띠 한 줄, 멈추지 않는다(음성은 한 마디 → 되돌림).
    if (!plan.ok) {
      const key = plan.unit ? 'explain.notExplainable' : 'explain.noSentence';
      held = { id: bandCall('openNote', { lineId: plan.lineId, rec: { state: 'none', key: key }, focusBack: focusBack, onClose: stopSaying }) || 0, was: was };
      return { ok: false, key: key };
    }
    // 문지기(동의·언어·키) — 막혔으면 보내지 않고 멈추지 않는다. no-key·consent 는 상태 바 배너도 즉시(탭과 같은 규칙).
    const g = gate();
    if (!g.ok) {
      const rec = { state: 'blocked', code: g.reason };
      held = { id: bandCall('openNote', { lineId: plan.lineId, rec: rec, gate: g, focusBack: focusBack, onClose: stopSaying }) || 0, was: was };
      return { ok: false, key: noteKeyOf(rec) };
    }
    // 11-D15 — 단추로 불러도 낭독을 멈춘다(설명을 소리로 듣게). 음성 갈래는 9b 가 이미 멈췄다.
    if (isReading(state()) && sp) sp.pause();
    let id = 0;
    let lastText = '';
    const retry = function () {
      return Promise.resolve(id && pipe() && remoteBlocked() ? pipe().retry() : null).catch(() => null)
        .then(() => explain({ via: 'button', plan: plan, retry: true }));
    };
    const replay = function () {
      const w = state();
      if (isReading(w) && sp) sp.pause();
      return sayNote(id, lastText, c.target || '').then((how) => { if (how === 'end') resumeIf(w); return how; });
    };
    id = bandCall('openNote', { lineId: plan.lineId, rec: { state: 'pending' }, retry: retry, replay: replay,
      focusBack: focusBack, onClose: stopSaying }) || 0;
    held = { id: id, was: was };
    const p = pipe();
    let res = null;
    if (p && typeof p.explain === 'function') {
      try {
        const r = await p.explain({ sentence: plan.sentence, context: plan.context },
          { src: c.src, target: c.target, docId: c.docId, domain: c.domain, retry: !!x.retry });
        res = r && Array.isArray(r.results) ? r.results[0] : null;
      } catch (e) { res = null; }
    }
    // 기다리는 사이 띠가 닫혔다(손 — [×]·줄 탭·[▶]·쪽 넘김) 또는 음성 흐름이 끊겼다 — 말하지 않고 되돌리지 않는다.
    if (!noteAlive(id) || (typeof x.alive === 'function' && !x.alive())) return { ok: false, key: null, cancelled: true };
    if (res && res.state === 'ready' && res.value && res.value.t) {
      lastText = res.value.t;
      bandCall('updateNote', id, { state: 'ready', text: lastText });
      const done = sayNote(id, lastText, c.target || '');
      if (voice) return { ok: true, done: done };
      done.then((how) => { if (how === 'end') resumeIf(was); });
      return { ok: true, done: done };
    }
    const rec = !res ? { state: 'failed', code: null }
      : res.state === 'blocked' ? { state: 'blocked', code: res.code || null } : { state: 'failed', code: res.code || null };
    bandCall('updateNote', id, rec);
    // 실패·막힘 — 곧 되돌린다(11-D15 "설명이 실패·지연돼도 낭독이 막히지 않는다"). 음성은 voice.js 가 한 마디 뒤 되돌린다.
    if (!voice) resumeIf(was);
    // `[11-4b — 11-4R #1]` 읽던 중이었으면 띠 실패 줄은 재개(`pressPlay`)와 함께 곧 닫힌다 — 상태 바에 `explain.failed` 한 줄 +
    // [다시 시도](그 문장을 `retry` 로 1호출 — 실패 기억을 넘어). 원격 막힘(429·상한·offline·키 없음)은 이미 상태 바 배너라 띠가 거른다.
    // `[11-4c — 11-4bR #1]` 배너의 [다시 시도]는 실패 때의 문서·쪽을 들고 있다 — 누른 때와 다르면 부르지 않는다(띠가 배너만 거둔다).
    const at = { docId: c.docId, page: c.page };
    const again = function () {
      const n = (typeof d.ctx === 'function' ? d.ctx() : null) || {};
      return n.docId === at.docId && n.page === at.page ? retry() : null;
    };
    if (!voice && isReading(was)) bandCall('noteBanner', rec, again);
    return { ok: false, key: noteKeyOf(rec) };
  }

  /** 파이프라인 — controls 가 주입한 것(요약 시트·탭 번역과 같은 하나 — 상태 기계 한 벌). */
  function pipe() { return d.pipeline || null; }
  /** 원격 상태가 [다시 시도]로 바로 풀리는 막힘인가(8a `retry()` — 사용자 동작일 때만 부른다). */
  function remoteBlocked() {
    try { const s = pipe() && typeof pipe().state === 'function' ? pipe().state() : null; return REMOTE_RETRY.indexOf(s) >= 0; } catch (e) { return false; }
  }

  return { summarize: summarize, listen: listen, canSummarize: canSummarize, gate: gate, explain: explain };
}

/** `[11-4]` [다시 시도]가 먼저 `pipeline.retry()` 로 풀 원격 상태 — trband `RETRYABLE_REMOTE` 와 같은 목록(ask 는 trband 를 import 하지 않는다 — 시험이 둘을 대조). */
export const REMOTE_RETRY = Object.freeze(['exhausted', 'cooldown', 'region', 'model']);
