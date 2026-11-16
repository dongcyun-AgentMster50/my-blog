/* ============================================================
   MedReader — 한 번 말하기(sayer) (spec 17-2-1 4-5 — 11-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   요약 요지(11-2)·설명(11-4)을 **대상 언어 음성으로 한 번** 말한다. 낭독(`speaker.js`)과 따로 — 큐·하이라이트·
   낭독 동반 번역을 건드리지 않는다. 부르는 쪽(`ui/ask.js`)이 말하기 전에 낭독을 멈추고, 끝나면 되돌린다.
     · `say(text, lang)` → `Promise<'end'|'stopped'>` — 다 말했으면 'end', 손이 끊었으면(`stop()`·엔진 취소) 'stopped'
     · `stop()` — 말하기를 거둔다(되돌림 없음 — 손이 이긴다). 말하는 중이 아니면 아무 일도 없다
     · `busy()` — 말하는 중인가

   ── 지키는 것 ──────────────────────────────────────────
   ★ 서비스다 — `synth`·`makeUtterance`·`speechOf(lang)` 를 **주입**받는다(`window` 를 직접 읽지 않는다 — speaker.js 와 같다).
   ★ 300자를 넘으면 `splitLong`(번역문과 같은 경계 `،`·`؛` — RA11)으로 조각을 이어 말하고, 조각마다 워치독(`trWatchdogMs` —
     6-2 와 같은 이유: onend 를 잃으면 멈춘다). 워치독이 울리면 다음 조각으로 간다.
   ★ 괄호 속 라틴(원어)을 빼는 일(`trSpeechText`)은 **부르는 쪽**이 한다(번역문 낭독과 같은 규칙 — 여기서 두 번 하지 않는다).
   ★ 목소리는 `speechOf(lang)` — controls 가 8k `langSpeechOf`(번역문 음성과 같은 해석 — 휴대폰 설정 따름)를 넘긴다.
   ★ utterance 를 job 에 붙들어 둔다(GC 로 onend 를 잃지 않게 — 6-4 (2)).
   ============================================================ */

import { TTS, READALONG } from '../config.js';
import { splitLong, trWatchdogMs } from './text.js';

/** 엔진이 "취소됨"으로 알리는 오류(stop·다른 발화가 끊음) — 'stopped' 로 끝낸다(되돌림 없음). */
const CANCEL_ERRORS = Object.freeze(['canceled', 'cancelled', 'interrupted']);

/**
 * @param {{synth:?Object, makeUtterance:(text:string)=>Object, speechOf?:(lang:string)=>{tag?:string, voice?:Object},
 *          timers?:{setTimeout:Function, clearTimeout:Function}, rate?:()=>number}} deps
 * @returns {{say:(text:string, lang:string)=>Promise<'end'|'stopped'>, stop:()=>boolean, busy:()=>boolean, stats:()=>Object}}
 */
export function createSayer(deps) {
  const d = deps || {};
  // ★ 브라우저 `setTimeout` 은 this 가 window 여야 한다 — 감싸서 부른다(speaker.js 와 같은 함정).
  const timers = d.timers || {
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (id) { return clearTimeout(id); }
  };
  const stats = { says: 0, parts: 0, stops: 0, watchdogs: 0, errors: 0, lastLang: null, lastTag: null };
  let job = null;

  function rate() { const r = typeof d.rate === 'function' ? Number(d.rate()) : 1; return r > 0 ? r : 1; }

  function finish(j, how) {
    if (job !== j) return;
    job = null;
    if (j.timer !== null) { timers.clearTimeout(j.timer); j.timer = null; }
    j.resolve(how);
  }

  function speakPart(j) {
    if (job !== j) return;
    if (j.k >= j.parts.length) { finish(j, 'end'); return; }
    const text = j.parts[j.k];
    let u = null;
    try {
      u = d.makeUtterance(text);
      const sv = typeof d.speechOf === 'function' ? (d.speechOf(j.lang) || {}) : {};
      if (sv.tag) u.lang = sv.tag;
      if (sv.voice) u.voice = sv.voice;
      stats.lastTag = u.lang || null;
      u.rate = rate();
    } catch (e) { finish(j, 'end'); return; }
    j.u = u;                                   // ★ 붙들어 둔다
    const k = j.k;
    const next = function () {
      if (job !== j || j.k !== k) return;      // 이미 다음 조각·끝
      if (j.timer !== null) { timers.clearTimeout(j.timer); j.timer = null; }
      j.k++;
      speakPart(j);
    };
    u.onend = next;
    u.onerror = function (ev) {
      if (job !== j || j.k !== k) return;
      const code = ev && ev.error ? String(ev.error) : '';
      if (CANCEL_ERRORS.indexOf(code) >= 0) { finish(j, 'stopped'); return; }   // 다른 손이 엔진을 끊었다
      stats.errors++;
      next();
    };
    j.timer = timers.setTimeout(function () { if (job === j && j.k === k) { stats.watchdogs++; next(); } }, trWatchdogMs(text, rate()));
    stats.parts++;
    try { d.synth.speak(u); } catch (e) { stats.errors++; next(); }
  }

  /**
   * 글을 대상 언어 음성으로 한 번 말한다. 말하는 중이면 앞 것을 끊고('stopped') 새로 말한다.
   * 엔진이 없거나 글이 비면 곧장 'end'(부르는 쪽은 되돌림으로 간다 — 막히지 않는다).
   */
  function say(text, lang) {
    stop();
    const parts = splitLong(String(text == null ? '' : text), TTS.MAX_UTTER_CHARS, READALONG.SPLIT_BREAKS_TR);
    if (!d.synth || typeof d.synth.speak !== 'function' || typeof d.makeUtterance !== 'function' || !parts.length) {
      return Promise.resolve('end');
    }
    stats.says++;
    stats.lastLang = lang || null;
    let resolve = null;
    const p = new Promise(function (r) { resolve = r; });
    const j = { parts: parts, k: 0, lang: lang || '', u: null, timer: null, resolve: resolve };
    job = j;
    speakPart(j);
    return p;
  }

  /** 말하기를 거둔다(되돌림 없음). @returns {boolean} 말하는 중이었는가 */
  function stop() {
    const j = job;
    if (!j) return false;
    stats.stops++;
    finish(j, 'stopped');
    try { if (d.synth && typeof d.synth.cancel === 'function') d.synth.cancel(); } catch (e) { /* 이미 끝남 */ }
    return true;
  }

  return {
    say: say,
    stop: stop,
    busy: function () { return !!job; },
    /** 측정용(글자 없음 — 수·태그만). */
    stats: function () { return Object.assign({ busy: !!job }, stats); }
  };
}
