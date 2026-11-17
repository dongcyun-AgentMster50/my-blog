/* ============================================================
   MedReader — 낭독 기록 · 읽은 쪽 (spec 17-12 4 — 13-1)

   ── 서비스 계층이다(3-2 — `plan/readlog.js` 행은 `vocab/*`·`srs/cards` 행과 같다) ──
   `config`·`db`·`plan/planner` 만 import 한다. **speaker 는 주입**(controls 가 리더에 들어올 때 `attach`, 떠날 때 `detach`) —
   `tts/*`·`ui/*`·`ai/*` 를 모른다. 설정 값은 `getSetting` 주입(`reading.track`). 호출 0, 기기 안에만(13-Q2).

   ── 하루 낭독 `settings['reading.log']` ─────────────────
   `{v:1, days:{'YYYY-MM-DD'(지역 날짜): {src|both|tr:{ms, chars, rateMs}, pages}}}` · 60일.
   · 시간: `speaking` 상태에서만 센다. `linechange` 사이가 `PLAN.MAX_GAP_MS` 를 넘는 몫은 빼고(멈춘 엔진·자리 비움),
     문장 반복이 켜진 동안은 쉰다. 표 안내(`src` null)는 시간은 세고 글자는 0.
   · 글자: 새 문장의 원문(`linechange.src`) 길이 — 같은 문장(문서·쪽·첫 줄·원문 — `unitKey`)의 재시작(멈춤 뒤 재개·반복)과
     300자 넘는 문장의 둘째 조각부터는 세지 않는다(`[13-1R #1]`).
   · `rateMs` = Σ(그 구간의 `speaker.getRate()` × ms) — 잴 때 평균 속도 = rateMs ÷ ms(planner `speedOf` 가 지금 속도로 고친다).
     속도를 바꾸면 바꾸기 전까지를 옛 속도로 먼저 센다(#2). 자정을 걸친 구간은 두 날로 나눈다(#3). 그날 같은 쪽 `pagedone` 은 pages 한 번(#4).
   · 쓰기: 메모리에 모았다가 **60초마다 · 멈춤(speaking 을 떠남) · 떠남(`detach`) · 숨김(`onHidden`)** 에 한 번(13-D15).
     `srs.log` 처럼 **DB 에 직접** 쓴다(한 트랜잭션에서 읽고 더해 쓰기) — `settings.js` 메모리 맵은 옛 값, 읽기는 `readLog()`.

   ── 읽은 쪽 `progress {docId, sectionId:'@read', ranges:[[a,b]…], pages, updatedAt}` ──
   speaker `pagedone{page}`(쪽 끝 자동 넘김에서만 — 13-D3) · 손으로 고침 `markRead`. 문서 레코드가 없으면 쓰지 않는다
   (지운 문서를 되살리지 않는다). 문서를 지우면 함께 지워진다(`db.deleteDocument` 연쇄 그대로).
   ============================================================ */

import * as realDb from '../db.js';
import { PLAN } from '../config.js';
import { bucketFor, cleanLog, logAdd, logTrim, rangesAdd, rangesRemove, rangesUnion, rangesCount } from './planner.js';

export const LOG_KEY = 'reading.log';
export { bucketFor };

function rq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 그 시각이 속한 날(지역 시간)의 키 `YYYY-MM-DD` — `srs/cards.js` `dayKeyOf` 와 같은 규칙(서비스끼리 import 하지 않으려고 한 벌 더). */
export function dayKeyOf(ms) {
  const d = new Date(Number(ms) || 0);
  const z = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

/** `[13-1R #3]` 그 시각 다음의 지역 자정(ms) — 자정을 걸친 낭독 구간을 두 날로 나눌 때. */
export function nextMidnight(ms) {
  const d = new Date(Number(ms) || 0);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/**
 * `[13-1R #1]` "같은 문장"의 열쇠 — 300자 넘는 문장은 speaker 가 조각마다 `linechange` 를 내는데(`index` 만 다르고
 * `src` 는 문장 전체), 조각들은 같은 첫 줄(`lineId`)·같은 `src` 다. 그래서 문서·쪽·첫 줄·원문으로 가린다(조각 둘째부터 글자 0,
 * 멈춘 뒤 첫 조각부터 다시 읽어도 0). `lineId` 가 없는 사건(옛 꼴)은 전처럼 `index` 로.
 */
export function unitKey(docId, x) {
  const e = x || {};
  const who = e.lineId != null && e.lineId !== '' ? 'L' + e.lineId + '|' + (typeof e.src === 'string' ? e.src : '') : 'i' + e.index;
  return (docId || '') + '|' + e.page + '|' + who;
}

/**
 * 기록기 하나. 앱은 `readLog`(기본 인스턴스)를 쓰고, 테스트는 `db`·`now`·`timers`·`getSetting` 을 주입한다.
 * @param {{db?:Object, now?:()=>number, timers?:{setTimeout:Function, clearTimeout:Function}, getSetting?:(k:string)=>*}} [deps]
 */
export function createReadLog(deps) {
  const d = deps || {};
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();
  const timers = d.timers || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (k) => clearTimeout(k) };
  const getSetting = typeof d.getSetting === 'function' ? d.getSetting : () => undefined;

  let sp = null;            // 붙은 speaker
  let opts = null;          // {docIdOf, bucketOf}
  let subs = [];            // [type, fn]
  let speaking = false;
  let live = false;         // speaking 또는 waiting-page(쪽 넘김 대기)
  let repeatOn = false;
  let anchor = null;       // 마지막 기준 시각(speaking 들어감·linechange·반복 꺼짐) — 여기서 MAX_GAP 까지만 센다
  let segBucket = 'src';  // 지금 구간(기준 시각부터)의 갈래 — 구간이 시작할 때의 모드(중간에 바꾸면 다음 단위부터)
  let segRate = 1;          // `[13-1R #2]` 지금 구간의 속도 — 속도를 바꾸면 바꾸기 전까지를 옛 속도로 먼저 센다
  let counted = null;       // 이미 센 끝 시각(null = 세는 중 아님)
  let lastKey = null;       // 마지막으로 글자를 센 문장 — `unitKey`
  let donePages = new Set();  // `[13-1R #4]` 그날 이미 센 쪽 `day|docId|page` — 같은 쪽 `pagedone` 두 번(쪽 넘김 실패 뒤 다시 재생)은 pages 한 번
  let pend = {};            // {day: {bucket: {ms, chars, rateMs}, pages}} — 아직 안 쓴 것
  let timer = null;
  let writing = Promise.resolve();
  const st = { writes: 0, pagesDone: 0, markWrites: 0 };

  function trackOn() { return getSetting('reading.track') !== false; }
  function rateNow() { try { const r = Number(sp && sp.getRate && sp.getRate()); return r > 0 ? r : 1; } catch (e) { return 1; } }
  function bucketNow() {
    let b = 'src';
    try { b = opts && typeof opts.bucketOf === 'function' ? opts.bucketOf() : 'src'; } catch (e) { b = 'src'; }
    return PLAN.BUCKETS.indexOf(b) >= 0 ? b : 'src';
  }
  function docIdNow() {
    try { const v = opts && typeof opts.docIdOf === 'function' ? opts.docIdOf() : null; return v == null || v === '' ? null : String(v); } catch (e) { return null; }
  }

  function addPend(day, bucket, a) {
    const dd = pend[day] || (pend[day] = {});
    if (bucket) {
      const b = dd[bucket] || (dd[bucket] = { ms: 0, chars: 0, rateMs: 0 });
      b.ms += a.ms || 0; b.chars += a.chars || 0; b.rateMs += a.rateMs || 0;
    }
    if (a.pages) dd.pages = (dd.pages || 0) + a.pages;
  }

  /**
   * 세는 중이면 지금까지(기준 + MAX_GAP 까지만)를 메모리에 더한다. 쓰지 않는다.
   * `[13-1R #3]` 자정을 걸친 구간은 지역 자정에서 나눠 두 날에 더한다. 속도는 구간의 속도(`segRate` — #2).
   */
  function settle(at) {
    if (counted === null || anchor === null) return;
    const end = Math.min(at, anchor + PLAN.MAX_GAP_MS);
    let from = counted;
    while (end > from) {
      const cut = Math.min(end, nextMidnight(from));
      const ms = cut - from;
      addPend(dayKeyOf(from), segBucket, { ms: ms, rateMs: ms * segRate });
      from = cut;
    }
    if (end > counted) counted = end;
  }

  function startCount(at) { anchor = at; counted = at; segBucket = bucketNow(); segRate = rateNow(); }
  function stopCount(at) { settle(at); anchor = null; counted = null; }
  function counting() { return speaking && !repeatOn; }

  function armTimer() {
    if (timer !== null) return;
    timer = timers.setTimeout(function tick() {
      timer = null;
      if (!sp) return;
      if (counting()) settle(now());
      flush();
      if (speaking) armTimer();
    }, PLAN.FLUSH_MS);
  }
  function clearTimer() { if (timer !== null) { timers.clearTimeout(timer); timer = null; } }

  function onState() {
    const s = sp.getState();
    const at = now();
    const was = speaking;
    const wasLive = live;
    // `[13-1R #2]` 속도 바꿈(`setRate` 의 statechange{rate}) — 바꾸기 전까지를 옛 속도로 먼저 센다
    if (counted !== null) { const r = rateNow(); if (r !== segRate) { settle(at); segRate = r; } }
    speaking = s === 'speaking';
    // 쪽 넘김 대기(`waiting-page` — 몇 초)는 세지 않을 뿐 쓰지 않는다. 멈춤·끝·오류(그 밖 상태)로 나갈 때 한 번 쓴다.
    live = speaking || s === 'waiting-page';
    if (speaking && !was) {
      if (!repeatOn) startCount(at);
      armTimer();
    } else if (!speaking && was && counted !== null) stopCount(at);
    if (wasLive && !live) { clearTimer(); flush(); }
  }

  function onLine(ev) {
    const x = (ev && ev.detail) || {};
    if (!counting()) return;
    const at = now();
    settle(at);
    anchor = at;
    segBucket = bucketNow();
    segRate = rateNow();
    counted = at;
    const key = unitKey(docIdNow(), x);
    if (key === lastKey) return;                 // 같은 문장 다시 시작·같은 문장의 다음 조각 — 글자 0
    lastKey = key;
    const n = typeof x.src === 'string' ? x.src.length : 0;   // 표 안내(src null) — 글자 0
    if (n) addPend(dayKeyOf(at), segBucket, { chars: n });
  }

  function onRepeat() {
    let on = false;
    try { const r = sp.getRepeat(); on = !!r && r.mode !== 'off'; } catch (e) { on = false; }
    if (on === repeatOn) return;
    const at = now();
    if (on) { if (counted !== null) stopCount(at); repeatOn = true; }
    else { repeatOn = false; if (speaking) startCount(at); }
  }

  function onPageDone(ev) {
    const x = (ev && ev.detail) || {};
    const page = Math.floor(Number(x.page));
    const docId = docIdNow();
    if (!docId || !(page >= 1)) return;
    st.pagesDone++;
    const day = dayKeyOf(now());
    const k = day + '|' + docId + '|' + page;
    if (!donePages.has(k)) {                     // `[13-1R #4]` 그날 같은 쪽은 pages 한 번(읽은 쪽 표시는 그대로 — 같으면 안 씀)
      if (donePages.size > 2000) donePages = new Set();
      donePages.add(k);
      addPend(day, null, { pages: 1 });
    }
    markRead(docId, page, page, true).catch(() => { /* 기록 실패가 낭독을 막지 않는다 */ });
  }

  /**
   * 리더에 들어올 때. `reading.track` 이 꺼져 있으면 아무것도 하지 않는다(13-Q2 — 읽은 쪽 자동 표시도 없음).
   * @param {Object} speaker `addEventListener`·`removeEventListener`·`getState`·`getRate`·`getRepeat`
   * @param {{docIdOf:()=>string, bucketOf:()=>('src'|'both'|'tr'), track?:()=>boolean}} o  `track` 이 없으면 `getSetting('reading.track')`
   * @returns {boolean} 붙었는가
   */
  function attach(speaker, o) {
    if (sp) detachNow();
    const x = o || {};
    const on = typeof x.track === 'function' ? x.track() !== false : trackOn();
    if (!speaker || typeof speaker.addEventListener !== 'function' || !on) return false;
    sp = speaker;
    opts = x;
    speaking = false;
    live = false;
    repeatOn = false;
    anchor = null;
    counted = null;
    lastKey = null;
    subs = [['statechange', onState], ['linechange', onLine], ['repeatchange', onRepeat], ['pagedone', onPageDone]];
    for (const [t, f] of subs) sp.addEventListener(t, f);
    onRepeat();
    onState();
    return true;
  }

  function detachNow() {
    if (!sp) return;
    if (counted !== null) stopCount(now());
    clearTimer();
    for (const [t, f] of subs) { try { sp.removeEventListener(t, f); } catch (e) { /* 이미 없음 */ } }
    subs = [];
    sp = null;
    opts = null;
    speaking = false;
    live = false;
    repeatOn = false;
  }

  /** 리더를 떠날 때 — 떼고 모은 것을 쓴다. */
  function detach() {
    detachNow();
    return flush();
  }

  /** 화면이 숨겨질 때(`visibilitychange` hidden) — 지금까지를 쓴다. */
  function onHidden() {
    if (counting()) settle(now());
    return flush();
  }

  /** 모은 것을 한 트랜잭션으로 더해 쓴다. 모은 것이 없으면 쓰지 않는다. 순서대로(겹친 쓰기가 서로 지우지 않게). */
  function flush() {
    const days = Object.keys(pend);
    if (!days.length) return writing;
    const batch = pend;
    pend = {};
    const today = dayKeyOf(now());
    writing = writing.catch(() => { }).then(() => db.withTx(['settings'], 'readwrite', async (tx, s) => {
      const row = await rq(s.settings.get(LOG_KEY));
      let log = cleanLog(row && row.value);
      for (const day of Object.keys(batch)) {
        const dd = batch[day];
        for (const b of PLAN.BUCKETS) if (dd[b]) log = logAdd(log, day, b, dd[b]);
        if (dd.pages) log = logAdd(log, day, null, { pages: dd.pages });
      }
      log = logTrim(log, today);
      await rq(s.settings.put({ key: LOG_KEY, value: log }));
      st.writes++;
      return log;
    })).catch(() => { /* 쓰기 실패 — 그 몫은 잃는다(최대 1분, 13-D15) */ });
    return writing;
  }

  /** 하루 낭독 기록 — DB 에서 바로 읽는다(`{v, days}` 꼴). */
  async function readLog() {
    const row = await db.get('settings', LOG_KEY);
    return cleanLog(row && row.value);
  }

  /** 그 문서의 읽은 쪽 구간. 없으면 `[]`. */
  async function readRanges(docId) {
    const rec = await db.get('progress', [String(docId), PLAN.READ_SECTION]);
    return rec ? rangesUnion(rec.ranges) : [];
  }

  /**
   * 읽은 쪽 고치기 — `on` 이면 a–b 를 더하고, 아니면 뺀다(계획 화면 `[읽음으로]`/`[안 읽음으로]` · `pagedone`). 한 트랜잭션에서
   * 문서가 있는지 보고 `@read` 를 읽어 합쳐 쓴다(없으면 만든다). `reading.track` 과 무관하게 된다.
   * @returns {Promise<number[][]|null>} 쓴 뒤 구간(문서가 없으면 null)
   */
  function markRead(docId, a, b, on) {
    const id = docId == null ? '' : String(docId);
    const lo = Math.floor(Number(a));
    const hi = Math.floor(Number(b === undefined ? a : b));
    if (!id || !Number.isFinite(lo) || !Number.isFinite(hi)) return Promise.resolve(null);
    const at = now();
    return db.withTx(['documents', 'progress'], 'readwrite', async (tx, s) => {
      const doc = await rq(s.documents.get(id));
      if (!doc) return null;
      const cur = await rq(s.progress.get([id, PLAN.READ_SECTION]));
      const was = cur ? rangesUnion(cur.ranges) : [];
      const ranges = on === false ? rangesRemove(was, lo, hi) : rangesAdd(was, lo, hi);
      if (!cur && !ranges.length) return ranges;
      if (cur && JSON.stringify(ranges) === JSON.stringify(was)) return ranges;
      await rq(s.progress.put(Object.assign({}, cur || {}, {
        docId: id, sectionId: PLAN.READ_SECTION, ranges: ranges, pages: rangesCount(ranges), updatedAt: at
      })));
      st.markWrites++;
      return ranges;
    });
  }

  return {
    attach: attach,
    detach: detach,
    onHidden: onHidden,
    flush: flush,
    readLog: readLog,
    readRanges: readRanges,
    markRead: markRead,
    isAttached: function () { return !!sp; },
    /** 걸린 쓰기가 끝날 때까지(새로 쓰지 않는다 — 시험·떠나기 전 기다림). */
    whenWritten: function () { return writing; },
    /** 진단 — 쓰기 횟수·센 쪽·지금 상태(글자·문서 없음). */
    stats: function () {
      return { writes: st.writes, markWrites: st.markWrites, pagesDone: st.pagesDone, attached: !!sp, speaking: speaking, repeatOn: repeatOn,
        pendingDays: Object.keys(pend).length };
    }
  };
}

/** 앱 기본 인스턴스(`js/db.js`) — controls 가 붙이고(`track` 은 attach 때 넘김), 13-2 계획 화면이 같은 것을 읽는다. */
export const readLogStore = createReadLog();
