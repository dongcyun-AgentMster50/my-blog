/* ============================================================
   MedReader — "부르면 묻기" 흐름: 요약 갈래 (spec 17-2-1 3 · 4-5 · 11-D11–D13 — 11-2. 설명 갈래는 11-4 가 더한다)

   ── 이 파일이 하는 일 ───────────────────────────────────
   선택 동작 줄 `[⋯] → [요약]`·음성 "요약"이 **같은 흐름**을 탄다:
     대상 문단 정하기 → 요약 가능? → 문지기(8c-1 `tapGate` 순서: consent → unsupported-lang → no-key — 요약은 같은 언어도 한다)
     → 시트 열기(그 문단 1회, 캐시 적중이면 0) → (음성이면) 요지를 대상 언어로 한 번 말하기
   · 단추로: 선택 시작 줄의 문장(`unitAt`)이 속한 문단. 낭독은 끊지 않는다(시트만 — 11-2 수용 기준).
   · 음성으로: `summaryTarget(sentenceUnits(), 지금 문장)` — 지금 문장이 문단 첫 문장이면 **바로 앞 문단**(11-D12).
     결과가 준비되면 `sayer.say(trSpeechText(요지), 대상 언어)` 를 돌려준다 — 되돌림(`restore(was)`)은 9b 흐름(`ui/voice.js`)이 한다.
     실패·막힘이면 `{ok:false, key}` — 상태 줄·한 마디·되돌림도 voice.js(9b 규칙 그대로).
   · 시트 [▶ 듣기]: 낭독 중이면 멈추고 → 요지를 말한 뒤 → 이어 읽는다(11-D15 와 같은 규칙). 듣는 중 손이 닿으면 멈춤(되돌림 없음).

   ── 지키는 것 ──────────────────────────────────────────
   ★ ui 계층 — speaker·readalong·시트·sayer·`pressPlay` 는 controls 가 **주입**한다(voice.js 는 이 파일을 import 하지 않고 주입받는다).
   ★ 문단 글은 `paraTextsOf(sentencesOf(문장 단위))` 한 길 — 한 문단 요약·쪽 요약·저장이 같은 글(같은 캐시 키 — 17-2-1 3).
   ★ 괄호 속 라틴(원어)은 소리에서만 뺀다 — `trSpeechText`(번역문 낭독과 같은 규칙). 화면 글은 그대로.
   ============================================================ */

import { sentencesOf, trSpeechText } from '../tts/text.js';
import { paraTextsOf, eligible, summaryTarget } from '../text/summary.js';
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

  return { summarize: summarize, listen: listen, canSummarize: canSummarize, gate: gate };
}
