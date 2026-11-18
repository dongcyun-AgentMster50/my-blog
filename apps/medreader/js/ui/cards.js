/* ============================================================
   MedReader — 기억 카드 화면: 복습 · 목록 (spec 17-11 6 — 12-3)

   ── 이 파일이 하는 일 ───────────────────────────────────
   `#/cards`(전체) · `#/cards/:docId`(그 책 — "이 책 복습"). 탭 둘:
   · **[복습]**(기본) — 한 번에 카드 하나. 앞면 → [답 보기]/Space → 뒷면 + 단추 넷 [다시][어려움][좋음][쉬움](아래에 다음 간격
     `previewLabels`, 키 1–4) → `cardStore.review` → 다음. "다시"는 이번 줄에서 **3장 뒤**에 다시(남은 카드가 적으면 끝 — 12-D12).
     거르기 칩 [전체][문장][단어](세션 동안만 — 12-D3). 끝: "오늘 복습 n장 끝 · 내일 m장". 자정을 넘기면 줄·셈을 새로 만든다.
   · **[목록]** — 문장 카드만(단어는 단어장 편집이 정본 — 12-D17). 줄 = 앞면 앞부분 · 뒷면 있음/없음 · 다음 복습 · 책.
     편집(뒷면·메모 고침 · 멈춤/다시 켬 · [쪽으로 가기] · 삭제 — 페이지 안 확인).

   ── 지키는 것 ──────────────────────────────────────────
   ★ **호출 0**(17-11 2 의 8 · 12-Q1 기본값) — pipeline 을 모른다. 뒷면이 빈 문장 카드는 `fillBack` 에 **번역 캐시 읽기**(`aiCache`
     의 `translate` 키 — `ai/cache.js` `keyFor` 로 키만 만들고 `db.get`)를 주입한다. 없으면 "번역 없음" + [쪽으로 가기]
     (번역은 리더에서 사용자가 줄을 탭할 때 — 8c-1 승인 경로).
   ★ `updatedAt` 은 사람이 고친 뒷면·메모만(`cardStore.update`). 복습은 `reviewedAt`, 멈춤은 `suspendedAt`(12-1). 자동 채움은 시각을
     올리지 않는다(12-3 결정 — `srs/cards.js` 머리말). 하루 기록은 `cardStore.readLog()`(설정 메모리 값은 옛것 — 12-1 ③).
   ★ 시각은 `Date.now()` 하나(`now` 주입) — 날 경계는 **지역 날짜**(`dayStartOf`·`dayKeyOf`). 가짜 시계 시험이 이것을 바꾼다.
   ★ 모든 글자 `textContent`/`appendBidiText` — `innerHTML` 0. 앞면 칸 `dir=ltr`(원문), 뒷면 칸은 대상 언어 방향, 표 방향은 UI.
   ★ 1절(순수)·2절(흐름 — DOM 없음)은 `tests/cards-ui-12.test.mjs` 가 잰다. 3절이 화면.
   import 방향(3-2): ui 계층 — `srs/cards`(서비스) · `srs/sm2`(순수) · `ai/cache` 의 순수 `keyFor`(키 문자열만) · `tts/*` · `ui/reader`(쪽 이동).
   ============================================================ */

import { t, applyTranslations, onLangChange, dirOf, formatNumber, getLang, hasKey } from '../i18n/index.js';
import * as db from '../db.js';
import * as settings from '../settings.js';
import { SRS } from '../config.js';
import { go, replace, cardsHash, readerHash, vocabHash } from '../router.js';
import { cardStore, dayStartOf, dayKeyOf, dueMsOf, timeMs, clampNewPerDay, isNoTrTerm } from '../srs/cards.js';
import { previewLabels, isNew } from '../srs/sm2.js';
import { keyFor } from '../ai/cache.js';
import { clean, cutText } from '../text/summary.js';
import { printedLabel } from '../search/outline.js';
import { createSayer } from '../tts/say.js';
import { resolveSpeech, speechPref } from '../tts/voices.js';
import { trSpeechText } from '../tts/text.js';
import { appendBidiText } from './bididom.js';
import { onPageRender, revealLine } from './reader.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

/** 거르기 칩(12-D3 — 세션 동안만, 저장하지 않는다). */
export const CHIPS = Object.freeze(['all', 'sentence', 'term']);
/** "다시" — 이번 줄에서 이만큼 뒤에 다시(12-D12). */
export const AGAIN_GAP = 3;
/** 목록 정렬 — 만든 날(새것 먼저) · 다음 복습(이른 것 먼저). */
export const LIST_SORTS = Object.freeze(['created', 'due']);
/** 목록 한 번에 그리는 줄 수(넘으면 [더 보기] — 수천 장을 한꺼번에 DOM 에 두지 않는다). */
export const LIST_PAGE = 200;
/** 목록 줄의 앞면 앞부분(글자). */
export const LIST_FRONT_CHARS = 120;
/** 날짜 넘김을 보는 가장 긴 간격(ms) — 자정 직후에 맞춰 깨되, 기기가 잠들었다 깨어도 이 안에 알아챈다. */
export const DAY_POLL_MS = 30000;

/** 칩 → `queue` 의 `kinds`. 모르는 값은 전체. */
export function kindsOf(chip) {
  return chip === 'sentence' ? ['sentence'] : chip === 'term' ? ['term'] : ['sentence', 'term'];
}

/**
 * "다시" — 지금 카드(줄 맨 앞)를 빼고 `gap` 장 뒤에 다시 넣는다. 남은 카드가 `gap` 보다 적으면 끝에. 순수 함수(새 배열).
 * @param {string[]} line  지금 줄(맨 앞 = 지금 카드)
 * @param {string} id
 * @param {number} [gap]
 */
export function requeue(line, id, gap) {
  const rest = (Array.isArray(line) ? line : []).slice(1).filter((x) => x !== id);
  const g = Number.isFinite(gap) ? Math.max(0, Math.floor(gap)) : AGAIN_GAP;
  rest.splice(Math.min(g, rest.length), 0, id);
  return rest;
}

/**
 * 간격 한 칸 → 글자("10분"·"4일"). `p` = `previewLabels` 한 칸 `{n, unit}`.
 * `[다듬기 5 — 12-3R]` 수에 따른 꼴 — `Intl.PluralRules(UI 언어)` 범주 키(`cards.span.day.few` 등)가 있으면 그것, 없으면 기본 키
 * (ar «10 دقائق»·«4 أيام» · fr «2 ans»). `lang` 은 시험이 넣는다(없으면 UI 언어).
 */
export function spanText(p, tr, lang) {
  const tt = typeof tr === 'function' ? tr : t;
  const x = p || {};
  const n = Number(x.n) || 0;
  const base = 'cards.span.' + (['min', 'hour', 'day', 'month', 'year'].indexOf(x.unit) >= 0 ? x.unit : 'day');
  let key = base;
  try {
    const cat = new Intl.PluralRules(lang || getLang()).select(n);
    if (hasKey(base + '.' + cat, lang || getLang())) key = base + '.' + cat;
  } catch (e) { key = base; }
  return tt(key, { n: formatNumber(n) });
}

/**
 * `[다듬기 5 — 12-3R]` 복습 키 → 단추 자리(0–3 = 다시·어려움·좋음·쉬움, 아니면 -1). 순수.
 * `ev.key` 의 서방 숫자 `1`–`4` · 아랍-인도 숫자 `١`–`٤` · 동방 아랍-인도(페르시아) 숫자 `۱`–`۴`, 그다음 자판 배치와 상관없는
 * `ev.code`(`Digit1`–`Digit4` · `Numpad1`–`Numpad4` — AZERTY 처럼 윗줄이 숫자가 아닌 자판도).
 */
export const GRADE_KEYS = Object.freeze(['1١۱', '2٢۲', '3٣۳', '4٤۴']);
export function gradeKeyIndex(ev) {
  const e = ev || {};
  const k = typeof e.key === 'string' && Array.from(e.key).length === 1 ? e.key : '';
  if (k) for (let i = 0; i < GRADE_KEYS.length; i++) if (GRADE_KEYS[i].indexOf(k) >= 0) return i;
  const m = /^(?:Digit|Numpad)([1-4])$/.exec(typeof e.code === 'string' ? e.code : '');
  return m ? Number(m[1]) - 1 : -1;
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * 문맥 문장 안 낱말 자리 — `[앞, 낱말, 뒤]`(대소문자 무시 · 첫 자리). 없으면 null(밑줄 없이 문장 그대로). 순수 함수.
 * @returns {?string[]}
 */
export function markParts(context, word) {
  const c = String(context == null ? '' : context);
  const w = clean(word);
  if (!c || !w) return null;
  let m = null;
  try { m = new RegExp(escapeRe(w), 'iu').exec(c); } catch (e) { m = null; }
  if (!m) return null;
  return [c.slice(0, m.index), m[0], c.slice(m.index + m[0].length)];
}

/**
 * 카드 → 앞·뒷면 모양(글자 + 언어). 문장(`front`·`back`·`explain`) / 단어(원어 + 문맥 · 번역 + 짧은 뜻 + 문맥 번역 — 12-D16). 순수 함수.
 */
export function faceOf(card) {
  const c = card || {};
  if (c.kind === 'term') {
    const word = clean(c.surface) || clean(c.term);
    return { kind: 'term', front: word, srcLang: String(c.srcLang || ''), context: clean(c.context), mark: word,
      back: clean(c.translation), gloss: clean(c.gloss), contextTr: clean(c.contextTr), explain: '', targetLang: String(c.targetLang || '') };
  }
  return { kind: 'sentence', front: clean(c.front), srcLang: String(c.srcLang || ''), context: '', mark: '',
    back: clean(c.back), gloss: '', contextTr: '', explain: clean(c.explain), targetLang: String(c.targetLang || '') };
}

/** 목록 줄 — 문장 카드만, 정렬(만든 날 새것 먼저 / 다음 복습 이른 것 먼저 — 날짜를 모르면 맨 앞). 순수 함수(새 배열). */
export function listRows(cards, sort) {
  const rows = (Array.isArray(cards) ? cards : []).filter((c) => !!c && c.kind === 'sentence');
  const created = (c) => timeMs(c.createdAt) || 0;
  if (sort === 'due') {
    const due = (c) => { const d = dueMsOf(c); return Number.isFinite(d) ? d : -Infinity; };
    rows.sort((a, b) => (!!a.suspended - !!b.suspended) || due(a) - due(b) || created(a) - created(b));
  } else {
    rows.sort((a, b) => created(b) - created(a));
  }
  return rows;
}

/**
 * 목록 책 고르기 — 전체 + 이 기기의 책(카드가 있는 책 먼저 제목 순) + 지워진 책(카드만 남음 — `docTitle`). 순수 함수.
 * @returns {{value:string, title:string, n:number, gone:boolean}[]}
 */
export function bookOptions(cards, docs) {
  const list = (Array.isArray(cards) ? cards : []).filter((c) => !!c && c.kind === 'sentence');
  const m = new Map();
  for (const d of Array.isArray(docs) ? docs : []) if (d && d.id != null) m.set(String(d.id), d);
  const count = new Map();
  const gone = new Map();
  for (const c of list) {
    const k = c.docId == null ? '' : String(c.docId);
    if (!k) continue;
    count.set(k, (count.get(k) || 0) + 1);
    if (!m.has(k) && !gone.has(k)) gone.set(k, c.docTitle || k);
  }
  const titleOf = (d) => String(d.title || d.fileName || d.id);
  const live = Array.from(m.values()).map((d) => ({ value: String(d.id), title: titleOf(d), n: count.get(String(d.id)) || 0, gone: false }))
    .sort((a, b) => (b.n > 0) - (a.n > 0) || a.title.localeCompare(b.title));
  const dead = Array.from(gone.entries()).map(([k, title]) => ({ value: k, title: String(title), n: count.get(k) || 0, gone: true }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [{ value: '', title: '', n: list.length, gone: false }].concat(live, dead);
}

/** 오늘(지역 날짜)의 경계 — `now` 한 값에서. */
export function dayOf(nowMs) {
  const n = Number(nowMs) || 0;
  const ds = dayStartOf(n);
  return { nowMs: n, dayStartMs: ds, dayEndMs: ds + SRS.DAY_MS, key: dayKeyOf(ds) };
}

/* ────────────────────────────────────────────────────────
   2. 복습 흐름 — DOM 없이(시험이 fake-idb 저장소·가짜 시계로 잰다)
   ──────────────────────────────────────────────────────── */

/**
 * @param {{store?:Object, now?:()=>number, lookup?:Function, newPerDay?:()=>*}} deps
 *   `store` = `cardStore`(queue·review·fillBack·readLog·list) · `lookup(front, docId, targetLang)` = 번역 **캐시 읽기**(호출 0)
 */
export function createReviewFlow(deps) {
  const d = deps || {};
  const store = d.store || cardStore;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();
  const st = { chip: 'all', docId: null, line: [], byId: new Map(), face: 'front', shownAt: 0, reviewed: 0, again: 0,
    dayKey: '', noTr: 0, done: null, busy: false, last: null, started: false, pages: null };

  function npd() { return clampNewPerDay(typeof d.newPerDay === 'function' ? d.newPerDay() : undefined); }
  function day() { return dayOf(now()); }
  function begin() { st.face = 'front'; st.shownAt = now(); }
  /** `[15-2]` 쪽 범위(`#/cards/:docId/:a-b`) 안 카드인가 — 범위가 없으면 모두. 쪽을 모르는 카드(단어 카드 등)는 범위 밖. */
  function inPages(c) { const p = st.pages; if (!p) return true; const n = Number(c && c.pageNo); return n >= p[0] && n <= p[1]; }
  /**
   * `[15-2 — spec 17-13 2 칸 6]` 범위 거름 — 복습할 것은 `queue` 결과를 거르고, 새 카드는 오늘 몫(`newPerDay` − 오늘 새로 본 수)을
   * **범위 안에서** 다시 채운다(책 전체 몫에서 거르면 범위 안 새 카드가 몫 밖으로 밀린다). 범위가 없으면 `queue` 그대로.
   */
  async function ranged(q, x) {
    if (!st.pages) return q;
    let room = npd();
    try { const lg = await store.readLog(); const td = lg && lg[x.key]; room = Math.max(0, room - Math.max(0, Number(td && td.new) || 0)); } catch (e) { /* 몫 그대로 */ }
    const ks = kindsOf(st.chip);
    // `[다듬기 5 — 15-2bR #5]` 번역 빈 단어 카드 판정은 `queue` 와 한 함수(`isNoTrTerm` — 사본 없음)
    const fresh = (await store.list({ docId: st.docId || undefined })).filter((c) => ks.indexOf(c.kind) >= 0 && !c.suspended && isNew(c) && inPages(c) &&
      !isNoTrTerm(c)).slice(0, room);
    const due = q.due.filter(inPages);
    return { due: due, fresh: fresh, counts: Object.assign({}, q.counts, { due: due.length, fresh: fresh.length }) };
  }

  /** 오늘 줄을 새로 — 복습할 것(dueAt 순) → 새 카드(createdAt 순). `keep` 이면 보이던 카드가 새 줄에도 있을 때 맨 앞에 둔다. */
  async function load(keep) {
    const x = day();
    const q = await ranged(await store.queue({ nowMs: x.nowMs, dayStartMs: x.dayStartMs, dayEndMs: x.dayEndMs, newPerDay: npd(),
      kinds: kindsOf(st.chip), docId: st.docId || undefined }), x);
    const cur = keep && st.line.length ? st.line[0] : null;
    const all = q.due.concat(q.fresh);
    st.byId = new Map(all.map((c) => [c.id, c]));
    let ids = all.map((c) => c.id);
    const kept = !!cur && st.byId.has(cur);
    if (kept) ids = [cur].concat(ids.filter((i) => i !== cur));
    st.line = ids;
    st.dayKey = x.key;
    st.noTr = q.counts.noTr;
    st.done = null;
    return kept;
  }

  /** 줄이 비었다 — 끝 화면 숫자: 오늘 복습한 장수(하루 기록 — `readLog`) · 내일 복습할 것. 카드가 하나도 없으면 `total:0`. */
  async function finishUp() {
    const x = day();
    let log = {};
    try { log = await store.readLog(); } catch (e) { log = {}; }
    const today = log && log[x.key];
    let tomorrow = 0;
    try {
      const tq = await ranged(await store.queue({ nowMs: x.dayEndMs, dayStartMs: x.dayEndMs, dayEndMs: x.dayEndMs + SRS.DAY_MS, newPerDay: npd(),
        kinds: kindsOf(st.chip), docId: st.docId || undefined }), dayOf(x.dayEndMs));
      tomorrow = tq.counts.due + tq.counts.fresh;
    } catch (e) { tomorrow = 0; }
    let total = null;
    if (!st.reviewed) {
      try {
        const ks = kindsOf(st.chip);
        total = (await store.list({ docId: st.docId || undefined })).filter((c) => ks.indexOf(c.kind) >= 0 && inPages(c)).length;
      } catch (e) { total = null; }
    }
    st.done = { today: today ? Math.max(0, Number(today.n) || 0) : 0, tomorrow: tomorrow, total: total };
  }

  async function settle() { if (!st.line.length) await finishUp(); }

  /** 세션 시작(또는 범위가 바뀜) — 칩·책. 매긴 수는 0 부터. */
  async function start(o) {
    const x = o || {};
    st.chip = CHIPS.indexOf(x.chip) >= 0 ? x.chip : 'all';
    st.docId = x.docId == null || x.docId === '' ? null : String(x.docId);
    st.pages = st.docId && Array.isArray(x.pages) && x.pages.length === 2 ? [Number(x.pages[0]), Number(x.pages[1])] : null;   // `[15-2]`
    st.reviewed = 0;
    st.again = 0;
    st.last = null;
    st.started = true;
    await load(false);
    begin();
    await settle();
    return view();
  }

  /** 칩 바꿈 — 줄을 새로(매긴 것은 이미 저장돼 있다). */
  async function setChip(chip) {
    st.chip = CHIPS.indexOf(chip) >= 0 ? chip : 'all';
    await load(false);
    begin();
    await settle();
    return view();
  }

  /** 다시 읽기(목록에서 고친 뒤·화면에 돌아옴·설정 바꿈) — 보이던 카드가 아직 줄에 있으면 그대로(면·시각 유지). */
  async function reload() {
    if (!st.started) return start({ chip: st.chip, docId: st.docId, pages: st.pages });
    const kept = await load(true);
    if (!kept) begin();
    await settle();
    return view();
  }

  /** `[D]` 날짜 넘김 — 지역 날짜가 바뀌었으면 줄·셈을 새로(내일 due 카드가 나타나고 오늘 새 카드 셈이 0 부터). */
  async function rollover() {
    if (!st.started || day().key === st.dayKey) return false;
    const kept = await load(true);
    if (!kept) begin();
    await settle();
    return true;
  }

  /** [답 보기]/Space — 뒷면. 뒷면이 빈 문장 카드는 먼저 `fillBack`(주입 조회 = 캐시 읽기, 호출 0). */
  async function reveal() {
    const id = st.line[0];
    if (!id || st.face !== 'front') return view();
    let c = st.byId.get(id);
    if (c && c.kind === 'sentence' && !clean(c.back) && typeof d.lookup === 'function') {
      try { const f = await store.fillBack(c, d.lookup); if (f) { c = f; st.byId.set(id, f); } } catch (e) { /* 뒷면 없이 */ }
    }
    if (st.line[0] === id) st.face = 'back';
    return view();
  }

  /**
   * 단추 넷(1–4) — `review`(한 트랜잭션 · `updatedAt` 무변) → 다음 카드. "다시"는 `AGAIN_GAP` 장 뒤에 다시.
   * `ms` = 앞면을 보인 때부터(상한 60초는 서비스가 자른다).
   * @returns {Promise<?{view:Object, rec:?Object}>}
   */
  async function grade(g) {
    const id = st.line[0];
    if (!id || st.face !== 'back' || SRS.GRADES.indexOf(g) < 0 || st.busy) return null;
    st.busy = true;
    try {
      const x = day();
      const rec = await store.review(id, g, { nowMs: x.nowMs, dayStartMs: x.dayStartMs, ms: x.nowMs - st.shownAt });
      if (!rec) {
        st.line = st.line.slice(1);              // 그사이 지워진 카드 — 줄에서 뺀다
      } else {
        st.byId.set(id, rec);
        st.reviewed++;
        st.last = { grade: g, dueAt: rec.dueAt };
        if (g === 'again') { st.again++; st.line = requeue(st.line, id, AGAIN_GAP); } else st.line = st.line.slice(1);
      }
      begin();
      await settle();
      return { view: view(), rec: rec };
    } finally {
      st.busy = false;
    }
  }

  /** 화면이 그릴 모양 — 글자를 담은 카드 레코드 포함(디버그 훅은 따로 수만 꺼낸다). */
  function view() {
    const id = st.line[0] || null;
    const card = id ? st.byId.get(id) || null : null;
    const fresh = st.line.filter((i) => { const r = st.byId.get(i); return !!r && isNew(r); }).length;
    const x = day();
    const state = card ? 'card' : st.done && st.done.total === 0 ? 'empty' : 'done';
    return {
      state: state, id: id, card: card, face: card ? st.face : null, left: st.line.length, fresh: fresh,
      reviewed: st.reviewed, again: st.again, chip: st.chip, docId: st.docId, noTr: st.noTr, done: st.done, dayKey: st.dayKey,
      previews: card && st.face === 'back' ? previewLabels(card.sm2, { nowMs: x.nowMs, dayStartMs: x.dayStartMs }) : null,
      last: st.last
    };
  }

  return {
    start: start, setChip: setChip, reload: reload, rollover: rollover, reveal: reveal, grade: grade, view: view,
    line: () => st.line.slice(), started: () => st.started
  };
}

/**
 * 번역 캐시 읽기(호출 0) — `aiCache` 의 `translate` 키(낭독 동반·탭 번역이 쓰는 바로 그 키 — 7-5)를 그 카드의 문서 → 지금 화면의 책
 * 순으로 본다. 문서를 지우면 그 문서의 캐시도 지워지므로(`deleteDocument`) 다시 가져온 책의 docId 로도 본다.
 * @param {{get:Function}} dbx  `js/db.js` 꼴
 * @returns {Function} `(front, docId, targetLang) → Promise<string>`
 */
export function cacheLookup(dbx, extraDocId) {
  return async function (front, docId, targetLang) {
    const ids = [];
    for (const x of [docId, typeof extraDocId === 'function' ? extraDocId() : extraDocId]) {
      if (x != null && x !== '' && ids.indexOf(String(x)) < 0) ids.push(String(x));
    }
    for (const id of ids) {
      let rec = null;
      try { rec = await dbx.get('aiCache', await keyFor(id, front, targetLang, 'translate')); } catch (e) { rec = null; }
      if (rec && typeof rec.result === 'string' && clean(rec.result)) return clean(rec.result);
    }
    return '';
  };
}

/* ────────────────────────────────────────────────────────
   3. 화면
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
const S = { docId: null, pages: null, tab: 'review', listSort: 'created', listShown: LIST_PAGE, all: [], scoped: [], docs: [], editId: null,
  seq: 0, dayTimer: null, sayer: null, busy: false, perf: null };
let flow = null;
/** 단어장 [복습 (n)] 이 열 때 고르는 칩(한 번). */
let presetChip = null;
/** [쪽으로 가기] — 그 쪽이 그려지면 그 줄을 본문 가운데로(편안 영역 안). */
let pendingReveal = null;
/** 삭제 확인 대상 — 열 때 고정, 어떤 닫힘에도 지운다(8f-3b 와 같은 장치). */
let delTarget = null;
let editFrom = null;

/** `[12-3]` 단어장 화면 머리 [복습 (n)] — 다음에 이 화면을 열 때 [단어] 칩으로. */
export function presetCardsChip(chip) { presetChip = CHIPS.indexOf(chip) >= 0 ? chip : null; }

export function initCards() {
  if (typeof document === 'undefined' || els) return;
  root = document.querySelector('[data-screen="cards"]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  els = {
    title: q('#cardsTitle'), gear: q('#cardsGear'), settingsBox: q('#cardsSettings'), npd: q('#cardsNewPerDay'),
    tabs: q('#cardsTabs'), status: q('#cardsStatus'), review: q('#cardsReview'), chips: q('#cardsChips'), left: q('#cardsRemain'),
    noTr: q('#cardsNoTr'), card: q('#cardsCard'), src: q('#cardsSrc'), front: q('#cardsFrontText'), ctx: q('#cardsCtx'),
    playSrc: q('#cardsPlaySrc'), show: q('#cardsShow'), back: q('#cardsBack'), backText: q('#cardsBackText'), gloss: q('#cardsGloss'),
    ctxTr: q('#cardsCtxTr'), explain: q('#cardsExplain'), explainText: q('#cardsExplainText'), noBack: q('#cardsNoBack'),
    gotoNoBack: q('#cardsGotoNoBack'), playTr: q('#cardsPlayTr'), grades: q('#cardsGrades'), done: q('#cardsDone'), doneText: q('#cardsDoneText'),
    listPanel: q('#cardsListPanel'), scope: q('#cardsScope'), sort: q('#cardsSort'), count: q('#cardsCount'), list: q('#cardsList'),
    more: q('#cardsMore'), listEmpty: q('#cardsListEmpty'), listEmptyText: q('#cardsListEmptyText'),
    edit: q('#cardsEdit'), form: q('#cardsEditForm'), head: q('#cardsEditHead'), editSrc: q('#cardsEditSrc'), editBack: q('#cardsEditBack'),
    editExplainRow: q('#cardsEditExplainRow'), editExplain: q('#cardsEditExplain'), editNote: q('#cardsEditNote'), editState: q('#cardsEditState'),
    suspend: q('#cardsSuspend'), goto: q('#cardsGoto'), editStatus: q('#cardsEditStatus'), del: q('#cardsDelDialog')
  };
  flow = createReviewFlow({ store: cardStore, now: () => Date.now(), lookup: cacheLookup(db, () => S.docId),
    newPerDay: () => settings.get('srs.newPerDay') });

  root.addEventListener('click', onClick);
  els.scope.addEventListener('change', () => { replace(cardsHash(els.scope.value || null)); });
  els.npd.addEventListener('change', onNewPerDay);
  els.form.addEventListener('submit', (ev) => { ev.preventDefault(); saveEdit(); });
  els.edit.addEventListener('close', () => { S.editId = null; focusRow(editFrom); });
  els.del.addEventListener('click', onDelClick);
  els.del.addEventListener('cancel', (ev) => { ev.preventDefault(); closeDel(); });
  els.del.addEventListener('close', () => { if (!els.del.open) delTarget = null; });
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && root && !root.hidden) dayTick(); });
  onLangChange(() => { if (!root) return; applyTranslations(root); if (!root.hidden) renderAll(); });
  onPageRender((p) => {
    const x = pendingReveal;
    if (!x || !p) return;
    pendingReveal = null;
    if (String(p.docId) !== String(x.docId) || Number(p.page) !== Number(x.page) || x.lineId == null) return;
    const run = () => { try { revealLine(x.lineId, null); } catch (e) { /* 줄이 없으면 쪽 맨 위 그대로 */ } };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0)); else setTimeout(run, 0);
  });
  attachDebugHook();
}

/** 라우터 — `#/cards` · `#/cards/:docId`. 같은 범위로 돌아오면 세션을 이어 간다(보이던 카드·"다시" 줄 그대로). */
export async function showCards(params) {
  if (!root) return;
  const t0 = nowPerf();
  const docId = params && params.docId != null && params.docId !== '' ? String(params.docId) : null;
  // `[15-2]` 쪽 범위(`#/cards/:docId/:a-b`) — 복습 줄만 거른다(목록 탭은 그 책 전체 그대로)
  const pages = docId && params.range ? [Number(params.range.from), Number(params.range.to)] : null;
  const pk = pages ? pages.join('-') : '';
  const scopeChanged = docId !== S.docId || pk !== (S.pages ? S.pages.join('-') : '') || !flow.started();
  if (scopeChanged) S.listShown = LIST_PAGE;
  S.docId = docId;
  S.pages = pages;
  applyTranslations(root);
  attachDebugHook();
  await loadDocs();
  if (presetChip) {
    const chip = presetChip;
    presetChip = null;
    S.tab = 'review';
    await flow.start({ chip: chip, docId: docId, pages: pages });
  } else if (scopeChanged) {
    await flow.start({ chip: flow.view().chip, docId: docId, pages: pages });
  } else {
    await flow.reload();
  }
  const t1 = nowPerf();
  if (S.tab === 'list') await loadList();
  renderAll();
  S.perf = { open: Math.round(nowPerf() - t0), queue: Math.round(t1 - t0) };
  attachDebugHook();          // 부팅 첫 화면이면 main.js 가 그사이 `window.__medreader` 를 새로 만들었다 — 다시 단다
  watchDay();
}

/** 화면을 떠날 때 — 대화·[▶]·자정 시계를 거둔다. 매긴 것은 이미 저장돼 있다(세션 줄은 메모리에 둔다 — 돌아오면 이어서). */
export function leaveCards() {
  if (!els) return;
  closeDel();
  closeDialog(els.edit);
  stopSpeech();
  if (S.dayTimer) { clearTimeout(S.dayTimer); S.dayTimer = null; }
}

function nowPerf() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }

async function loadDocs() {
  const docs = [];
  try { await db.iterate('documents', {}, (v) => { if (v && v.id != null) docs.push(v); }); } catch (e) { banner(e); }
  S.docs = docs;
}

function docById(id) { return id == null ? null : S.docs.find((x) => String(x.id) === String(id)) || null; }

/** 카드의 책 — 살아 있는 그 문서, 없고 "이 책" 화면이면(지워진 같은 PDF 의 카드) 지금 책. */
function liveDocOf(c) {
  const own = c ? docById(c.docId) : null;
  if (own) return own;
  return S.docId ? docById(S.docId) : null;
}

function renderAll() {
  renderTitle();
  renderTabs();
  renderReview();
  if (S.tab === 'list') renderList();
}

function renderTitle() {
  const doc = S.docId ? docById(S.docId) : null;
  const gone = S.docId && !doc ? ((S.scoped[0] || S.all.find((c) => String(c.docId) === S.docId) || {}).docTitle || '') : '';
  els.title.textContent = (S.docId ? t('cards.titleDoc', { title: doc ? (doc.title || doc.fileName || '') : gone }) : t('cards.title')) +
    (S.docId && S.pages ? ' · ' + t('planner.range.pages', { a: formatNumber(S.pages[0]), b: formatNumber(S.pages[1]) }) : '');   // `[15-2]`
}

function renderTabs() {
  for (const b of els.tabs.querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', b.getAttribute('data-tab') === S.tab ? 'true' : 'false');
  els.review.hidden = S.tab !== 'review';
  els.listPanel.hidden = S.tab !== 'list';
}

function setStatus(key, params) { els.status.textContent = key ? t(key, params || undefined) : ''; }

/** 쪽 라벨 — 8g `pageLabels` 가 있으면 인쇄 쪽(검색·요약 화면과 같은 문구 키). */
function pageLabelOf(doc, page) {
  const p = Number(page);
  if (!Number.isFinite(p) || p < 1) return '';
  const lab = printedLabel(doc && doc.pageLabels, p);
  return lab ? t('search.pageLabeled', { label: lab, page: formatNumber(p) }) : t('search.page', { page: formatNumber(p) });
}

function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

/** 대상 언어 글 칸 — `lang`·`dir`(대상 언어) + `appendBidiText`(괄호 속 라틴 고립). */
function paintTarget(el, text, lang) {
  clearNode(el);
  if (lang) { el.setAttribute('lang', lang); el.setAttribute('dir', dirOf(lang)); } else { el.removeAttribute('lang'); el.setAttribute('dir', 'auto'); }
  appendBidiText(el, text, dirOf(lang));
}

function renderReview() {
  const v = flow.view();
  for (const b of els.chips.querySelectorAll('[data-chip]')) b.setAttribute('aria-pressed', b.getAttribute('data-chip') === v.chip ? 'true' : 'false');
  els.left.textContent = v.state === 'card' ? t('cards.left', { n: formatNumber(v.left), m: formatNumber(v.fresh) }) : '';
  els.noTr.hidden = !(v.noTr > 0);
  els.noTr.textContent = v.noTr > 0 ? t('cards.noTr', { n: formatNumber(v.noTr) }) : '';
  els.noTr.setAttribute('data-nav', vocabHash(S.docId));
  els.card.hidden = v.state !== 'card';
  els.done.hidden = v.state === 'card';
  if (v.state !== 'card') {
    const d = v.done || { today: 0, tomorrow: 0 };
    els.doneText.textContent = v.state === 'empty' ? t('cards.empty') : t('cards.done', { n: formatNumber(d.today), m: formatNumber(d.tomorrow) });
    return;
  }
  paintCard(v);
}

function paintCard(v) {
  const c = v.card;
  const f = faceOf(c);
  const doc = liveDocOf(c);
  const title = doc ? (doc.title || doc.fileName || '') : (c.docTitle || '');
  const page = pageLabelOf(doc, c.pageNo);
  els.src.textContent = [title, page].filter(Boolean).join(' · ');
  els.card.setAttribute('data-kind', f.kind);
  // 앞면 — 원문(ltr · 원문 언어)
  els.front.textContent = f.front;
  if (f.srcLang) els.front.setAttribute('lang', f.srcLang); else els.front.removeAttribute('lang');
  clearNode(els.ctx);
  els.ctx.hidden = !(f.kind === 'term' && f.context);
  if (!els.ctx.hidden) {
    if (f.srcLang) els.ctx.setAttribute('lang', f.srcLang);
    const parts = markParts(f.context, f.mark);
    if (parts) {
      els.ctx.appendChild(document.createTextNode(parts[0]));
      const u = document.createElement('u');
      u.textContent = parts[1];
      els.ctx.appendChild(u);
      els.ctx.appendChild(document.createTextNode(parts[2]));
    } else {
      els.ctx.textContent = f.context;
    }
  }
  const back = v.face === 'back';
  els.show.hidden = back;
  els.back.hidden = !back;
  if (!back) return;
  // 뒷면 — 대상 언어 방향
  els.backText.hidden = !f.back;
  if (f.back) paintTarget(els.backText, f.back, f.targetLang); else clearNode(els.backText);
  els.gloss.hidden = !f.gloss;
  if (f.gloss) paintTarget(els.gloss, f.gloss, f.targetLang);
  els.ctxTr.hidden = !f.contextTr;
  if (f.contextTr) paintTarget(els.ctxTr, f.contextTr, f.targetLang);
  els.explain.hidden = !f.explain;
  if (f.explain) paintTarget(els.explainText, f.explain, f.targetLang);
  els.noBack.hidden = !!f.back;
  els.gotoNoBack.hidden = !(doc && c.pageNo);
  els.playTr.hidden = !f.back;
  const spans = els.grades.querySelectorAll('.cards-grade-span');
  const pv = v.previews || [];
  for (let i = 0; i < spans.length; i++) spans[i].textContent = pv[i] ? spanText(pv[i]) : '';
}

/* ── 동작 ──────────────────────────────────────────── */

function onClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-ca]') : null;
  if (!b || !root.contains(b) || b.getAttribute('aria-disabled') === 'true') return;
  const a = b.getAttribute('data-ca');
  if (a === 'tab') { setTab(b.getAttribute('data-tab')); return; }
  if (a === 'chip') { chip(b.getAttribute('data-chip')); return; }
  if (a === 'show') { reveal(); return; }
  if (a === 'grade') { grade(b.getAttribute('data-grade')); return; }
  if (a === 'play-src' || a === 'play-tr') { play(a === 'play-tr'); return; }
  if (a === 'goto') { gotoCard(flow.view().card); return; }
  if (a === 'gear') { toggleGear(); return; }
  if (a === 'sort') { S.listSort = LIST_SORTS.indexOf(b.getAttribute('data-sort')) >= 0 ? b.getAttribute('data-sort') : 'created'; S.listShown = LIST_PAGE; renderList(); return; }
  if (a === 'more') { S.listShown += LIST_PAGE; renderList(); return; }
  if (a === 'edit') { openEdit(b.getAttribute('data-id')); return; }
  if (a === 'edit-save') { saveEdit(); return; }
  if (a === 'edit-delete') { askDelete(); return; }
  if (a === 'edit-close') { closeDialog(els.edit); return; }
  if (a === 'suspend') { toggleSuspend(); return; }
  if (a === 'goto-edit') { gotoCard(cardById(S.editId), true); }
}

/** 키보드(복습 탭): Space = 답 보기 · 1–4 = 다시·어려움·좋음·쉬움. 입력칸·대화·단추 위 Space(단추가 스스로 누름)는 건드리지 않는다. */
function onKey(ev) {
  if (!root || root.hidden || S.tab !== 'review' || ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  if ((els.edit && els.edit.open) || (els.del && els.del.open)) return;
  const tg = ev.target;
  const tag = tg && tg.tagName ? tg.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || (tg && tg.isContentEditable)) return;
  const v = flow.view();
  if (v.state !== 'card') return;
  if (ev.key === ' ' || ev.key === 'Spacebar') {
    if (tag === 'button' || tag === 'a' || tag === 'summary') return;
    if (v.face === 'front') { ev.preventDefault(); reveal(); }
    return;
  }
  const k = gradeKeyIndex(ev);   // `[다듬기 5]` 아랍-인도 숫자 자판·ev.code 도
  if (k >= 0 && v.face === 'back') { ev.preventDefault(); grade(SRS.GRADES[k]); }
}

async function setTab(tab) {
  const next = tab === 'list' ? 'list' : 'review';
  if (next === S.tab && next === 'list') return;
  S.tab = next;
  setStatus(null);
  stopSpeech();
  renderTabs();
  if (next === 'list') { await loadList(); renderList(); }
  else { await flow.reload(); renderReview(); }
}

async function chip(c) {
  if (S.busy) return;
  S.busy = true;
  stopSpeech();
  try { await flow.setChip(c); } catch (e) { banner(e); }
  S.busy = false;
  renderReview();
}

async function reveal() {
  if (S.busy) return;
  S.busy = true;
  try { await flow.reveal(); } catch (e) { banner(e); }
  S.busy = false;
  renderReview();
  if (!els.back.hidden) { try { els.back.focus({ preventScroll: false }); } catch (e) { /* 포커스 못 옮겨도 그대로 */ } }
}

async function grade(g) {
  if (S.busy) return;
  S.busy = true;
  stopSpeech();
  let r = null;
  try { r = await flow.grade(g); } catch (e) { banner(e); }
  S.busy = false;
  renderReview();
  const v = flow.view();
  try {
    if (v.state === 'card') els.show.focus({ preventScroll: true });
    else els.doneText.focus({ preventScroll: false });
  } catch (e) { /* 그대로 */ }
  return r;
}

async function onNewPerDay() {
  const v = clampNewPerDay(els.npd.value);
  els.npd.value = String(v);
  try { await settings.set('srs.newPerDay', v); } catch (e) { banner(e); }
  await flow.reload();
  renderReview();
}

function toggleGear() {
  const open = els.settingsBox.hidden;
  els.settingsBox.hidden = !open;
  els.gear.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) els.npd.value = String(clampNewPerDay(settings.get('srs.newPerDay')));
}

/* ── [쪽으로 가기] — 그 쪽을 열고, 그려지면 그 줄을 본문 가운데로(`revealLine` — 6-5 편안 영역) ── */

function gotoCard(c, fromEdit) {
  const doc = liveDocOf(c);
  if (!c || !doc || !c.pageNo) return;
  pendingReveal = { docId: String(doc.id), page: Number(c.pageNo), lineId: c.lineId == null ? null : String(c.lineId) };
  if (fromEdit) { editFrom = null; closeDialog(els.edit); }
  go(readerHash(doc.id, c.pageNo));
}

/* ── [▶] 원문 = 원문 음성 · 번역 = 번역문 음성(괄호 속 라틴은 소리에서만 뺌) — 11-2 sayer 재사용, 호출 0 ── */

function sayer() {
  if (S.sayer) return S.sayer;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth || typeof SpeechSynthesisUtterance !== 'function') return null;
  S.sayer = createSayer({
    synth: synth,
    makeUtterance: (text) => new SpeechSynthesisUtterance(text),
    speechOf: (lang) => {
      let voices = [];
      try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
      const r = resolveSpeech(lang, voices, speechPref(settings.get, lang));
      return { tag: r.tag, voice: r.voice || null };
    }
  });
  return S.sayer;
}

function play(tr) {
  const v = flow.view();
  if (!v.card) return;
  const f = faceOf(v.card);
  const sy = sayer();
  if (!sy) return;
  const text = tr ? trSpeechText(f.back) : f.front;
  const lang = tr ? f.targetLang : f.srcLang || 'en';
  if (!text || !lang) return;
  sy.say(text, lang);
}

function stopSpeech() { if (S.sayer) S.sayer.stop(); }

/* ── [목록] ─────────────────────────────────────────── */

async function loadList() {
  const my = ++S.seq;
  let all = [];
  let scoped = [];
  try {
    all = await cardStore.list({ kind: 'sentence' });
    scoped = S.docId ? await cardStore.list({ kind: 'sentence', docId: S.docId }) : all;
  } catch (e) { banner(e); }
  if (my !== S.seq) return;
  S.all = all;
  S.scoped = scoped;
}

function renderScope() {
  const sel = els.scope;
  clearNode(sel);
  let has = false;
  for (const o of bookOptions(S.all, S.docs)) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = !o.value ? t('vocab.scope.all', { n: formatNumber(o.n) }) : t(o.gone ? 'vocab.scope.gone' : 'vocab.scope.doc', { title: o.title, n: formatNumber(o.n) });
    if (o.value === (S.docId || '')) { op.selected = true; has = true; }
    sel.appendChild(op);
  }
  if (!has && S.docId) {
    const op = document.createElement('option');
    op.value = S.docId;
    op.textContent = t('vocab.scope.gone', { title: S.docId, n: formatNumber(S.scoped.length) });
    op.selected = true;
    sel.appendChild(op);
  }
}

function renderList() {
  renderScope();
  for (const b of els.sort.querySelectorAll('[data-sort]')) b.setAttribute('aria-pressed', b.getAttribute('data-sort') === S.listSort ? 'true' : 'false');
  const rows = listRows(S.scoped, S.listSort);
  clearNode(els.list);
  const x = dayOf(Date.now());
  const n = Math.min(rows.length, S.listShown);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) frag.appendChild(rowEl(rows[i], x));
  els.list.appendChild(frag);
  els.more.hidden = rows.length <= n;
  els.more.textContent = rows.length > n ? t('vocab.more', { n: formatNumber(rows.length - n) }) : '';
  els.count.textContent = rows.length ? t('cards.list.count', { n: formatNumber(rows.length) }) : '';
  els.listEmpty.hidden = rows.length > 0;
  els.listEmptyText.textContent = t('cards.list.empty');
}

function fmtDate(ms) {
  try { return new Intl.DateTimeFormat(getLang(), { month: 'short', day: 'numeric' }).format(new Date(ms)); } catch (e) { return dayKeyOf(ms); }
}

/** 다음 복습 문구 — 멈춤 · 새 카드 · 오늘(지났거나 모름) · 날짜. */
function dueText(c, x) {
  if (c.suspended) return t('cards.list.suspended');
  if (isNew(c)) return t('cards.list.new');
  const d = dueMsOf(c);
  if (!Number.isFinite(d) || d < x.dayEndMs) return t('cards.list.dueToday');
  return t('cards.list.due', { date: fmtDate(d) });
}

function rowEl(c, x) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cards-row';
  b.setAttribute('data-ca', 'edit');
  b.setAttribute('data-id', String(c.id));
  if (c.suspended) b.setAttribute('data-suspended', '1');
  const front = document.createElement('span');
  front.className = 'cards-row-front';
  front.setAttribute('dir', 'ltr');
  if (c.srcLang) front.setAttribute('lang', c.srcLang);
  front.textContent = cutText(clean(c.front), LIST_FRONT_CHARS);
  const meta = document.createElement('span');
  meta.className = 'cards-row-meta';
  const bits = [clean(c.back) ? t('cards.list.back') : t('cards.list.noBack'), dueText(c, x)];
  if (!S.docId) { const d = docById(c.docId); bits.push(d ? (d.title || d.fileName || '') : (c.docTitle || '')); }
  meta.textContent = bits.filter(Boolean).join(' · ');
  b.appendChild(front);
  b.appendChild(meta);
  li.appendChild(b);
  return li;
}

function cardById(id) { return (S.scoped.find((c) => String(c.id) === String(id)) || S.all.find((c) => String(c.id) === String(id))) || null; }

/* ── 편집 ──────────────────────────────────────────── */

function openEdit(id) {
  const c = cardById(id);
  if (!c || !els.edit) return;
  S.editId = String(c.id);
  editFrom = String(c.id);
  paintEdit(c);
  els.editBack.value = clean(c.back);
  els.editNote.value = String(c.note || '');
  els.editStatus.textContent = '';
  applyTranslations(els.edit);
  if (typeof els.edit.showModal === 'function') { if (!els.edit.open) els.edit.showModal(); } else els.edit.setAttribute('open', '');
  try { els.head.focus({ preventScroll: true }); } catch (e) { /* 대화는 열린다 */ }
}

/** 편집 대화의 읽기 칸·멈춤 단추(고친 칸은 건드리지 않는다). */
function paintEdit(c) {
  const doc = liveDocOf(c);
  els.head.textContent = clean(c.front);
  if (c.srcLang) els.head.setAttribute('lang', c.srcLang); else els.head.removeAttribute('lang');
  els.editSrc.textContent = doc ? t('vocab.edit.source', { title: doc.title || doc.fileName || '', page: c.pageNo ? formatNumber(c.pageNo) : '—' })
    : c.docTitle ? t('vocab.edit.sourceGone', { title: c.docTitle }) : '';
  const tl = c.targetLang || '';
  if (tl) { els.editBack.setAttribute('lang', tl); els.editBack.setAttribute('dir', dirOf(tl)); } else { els.editBack.removeAttribute('lang'); els.editBack.setAttribute('dir', 'auto'); }
  els.editExplainRow.hidden = !clean(c.explain);
  if (clean(c.explain)) paintTarget(els.editExplain, clean(c.explain), tl);
  els.suspend.textContent = t(c.suspended ? 'cards.edit.resume' : 'cards.edit.suspend');
  els.suspend.setAttribute('aria-pressed', c.suspended ? 'true' : 'false');
  els.editState.textContent = c.suspended ? t('cards.edit.paused') : '';
  els.goto.hidden = !(doc && c.pageNo);
}

function replaceCard(rec) {
  if (!rec) return;
  for (const arr of [S.all, S.scoped]) {
    const i = arr.findIndex((c) => String(c.id) === String(rec.id));
    if (i >= 0) arr[i] = rec;
  }
}

async function saveEdit() {
  const c = cardById(S.editId);
  if (!c) return;
  const patch = { back: els.editBack.value, note: els.editNote.value };
  if (clean(patch.back) === clean(c.back) && clean(patch.note) === clean(c.note)) { els.editStatus.textContent = t('vocab.edit.unchanged'); return; }
  let rec = null;
  try { rec = await cardStore.update(c.id, patch); } catch (e) { rec = null; }
  if (!rec) { els.editStatus.textContent = t('vs.saveFailed'); return; }
  replaceCard(rec);
  closeDialog(els.edit);
  setStatus('vs.saved');
  renderList();
  focusRow(String(c.id));
}

async function toggleSuspend() {
  const c = cardById(S.editId);
  if (!c) return;
  let rec = null;
  try { rec = await cardStore.update(c.id, { suspended: !c.suspended }); } catch (e) { rec = null; }
  if (!rec) { els.editStatus.textContent = t('vs.saveFailed'); return; }
  replaceCard(rec);
  paintEdit(rec);
  els.editStatus.textContent = '';
  renderList();
}

/** 페이지 안 확인(`confirm()` 쓰지 않음) — 대상은 열 때 고정, 첫 초점 [취소]. */
function askDelete() {
  const c = cardById(S.editId);
  const dlg = els.del;
  if (!c || !dlg) return;
  applyTranslations(dlg);
  delTarget = String(c.id);
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  const cancel = dlg.querySelector('button[data-dialog="cancel"]');
  if (cancel) cancel.focus();
}

function closeDel() {
  delTarget = null;
  closeDialog(els && els.del);
}

async function onDelClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-dialog]') : null;
  if (!b) return;
  const id = delTarget;
  const ok = b.getAttribute('data-dialog') === 'ok';
  closeDel();
  if (!ok || id == null) return;
  let done = false;
  try { done = await cardStore.remove(id); } catch (e) { done = false; }
  if (!done) { els.editStatus.textContent = t('vs.saveFailed'); return; }
  editFrom = null;
  closeDialog(els.edit);
  S.all = S.all.filter((c) => String(c.id) !== id);
  S.scoped = S.scoped.filter((c) => String(c.id) !== id);
  setStatus('cards.deleted');
  renderList();
}

function closeDialog(dlg) {
  if (!dlg) return;
  if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
}

function focusRow(id) {
  if (id == null || !els || root.hidden || S.tab !== 'list') return;
  const b = els.list.querySelector('.cards-row[data-id="' + cssEscape(id) + '"]');
  if (b) { try { b.focus({ preventScroll: false }); } catch (e) { /* 줄이 없으면 그대로 */ } }
}

/* ── 날짜 넘김(자정) — 화면이 보이는 동안만. 자정 직후에 깨고, 늦어도 `DAY_POLL_MS` 안에 알아챈다(기기 잠듦·시계 바뀜) ── */

function watchDay() {
  if (S.dayTimer) { clearTimeout(S.dayTimer); S.dayTimer = null; }
  if (!root || root.hidden) return;
  const n = Date.now();
  const ms = dayStartOf(n) + SRS.DAY_MS - n + 250;
  S.dayTimer = setTimeout(dayTick, Math.max(250, Math.min(ms, DAY_POLL_MS)));
}

async function dayTick() {
  if (S.dayTimer) { clearTimeout(S.dayTimer); S.dayTimer = null; }
  if (!root || root.hidden || !flow) return;
  let changed = false;
  try { changed = await flow.rollover(); } catch (e) { changed = false; }
  if (changed) {
    renderReview();
    if (S.tab === 'list') renderList();
  }
  watchDay();
}

/* ── 작은 도구 ─────────────────────────────────────── */

function cssEscape(s) {
  if (globalThis.CSS && typeof CSS.escape === 'function') return CSS.escape(s);
  return String(s).replace(/["\\]/g, '\\$&');
}

function banner(err) {
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { code: (err && err.code) || 'ERR_UNKNOWN', tone: 'error' } }));
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(수·키·불리언·id 머리만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  g.cards = {
    state: function () {
      if (!els || !flow) return null;
      const v = flow.view();
      const c = v.card;
      return {
        docId: S.docId, tab: S.tab, state: v.state, face: v.face, left: v.left, fresh: v.fresh, reviewed: v.reviewed, again: v.again,
        chip: v.chip, noTr: v.noTr, done: v.done, dayKey: v.dayKey, last: v.last, kind: c ? c.kind : null, id: c ? c.id : null,
        line: flow.line(), hasBack: c ? !!faceOf(c).back : null, noBackShown: !els.noBack.hidden && !els.back.hidden,
        gotoShown: !els.gotoNoBack.hidden && !els.back.hidden, previews: v.previews ? v.previews.map((p) => ({ grade: p.grade, n: p.n, unit: p.unit, dueAt: p.dueAt })) : null,
        listRows: els.list.children.length, listAll: S.scoped.length, editOpen: !!(els.edit && els.edit.open), delOpen: !!(els.del && els.del.open),
        perf: S.perf, timer: !!S.dayTimer, sayer: S.sayer ? S.sayer.stats() : null
      };
    },
    tick: dayTick,
    perf: async function () {
      const t0 = nowPerf();
      await flow.reload();
      const t1 = nowPerf();
      await loadList();
      const t2 = nowPerf();
      renderList();
      const t3 = nowPerf();
      return { queue: Math.round(t1 - t0), list: Math.round(t2 - t1), draw: Math.round(t3 - t2), rows: els.list.children.length };
    }
  };
}
