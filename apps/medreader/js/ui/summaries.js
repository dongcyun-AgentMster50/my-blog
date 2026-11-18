/* ============================================================
   MedReader — 저장한 요약 모아 보기 · 범위 개요(11c) · 내보내기 (spec 17-2-1 4-6 · 6 · 8 "11-3" — 11-3)

   ── 이 파일이 하는 일 ───────────────────────────────────
   `#/summaries`(전체) · `#/summaries/:docId`(그 책). 입구(11-D14): 서재 카드 [⋯] "이 책의 저장한 요약" · 요약 시트 링크
   "이 책의 저장한 요약 (n)". 서재 상단 줄·리더 상단바는 늘리지 않는다. 전체 목록은 책 고르기의 "모든 책".
     · 목록: 책 → 장 머리(문서 개요 맨 위 깊이 — 없으면 쪽 라벨) → 줄(`<details>` — 쪽 라벨 · 요지, 펼치면 원문 언어 요지·트리·용어 ·
       [원문으로] · [삭제]). 저장한 개요(`kind:'outline'`)는 그 범위 머리에 먼저. 문서가 지워진 요약은 `docTitle` 로 묶고 [원문으로] 없음.
     · [원문으로]: 그 쪽을 열고, 그려지면 지금 쪽 문단들의 해시로 문단을 다시 찾아(`relocate`) 첫 줄을 편안 영역 안으로(`revealLine`).
       못 찾으면(다시 추출로 문단이 바뀜) 쪽 처음 + 한 줄.
     · 범위 개요(11c · 11-D19): 책 화면 위 "범위: [장 ▾ | 쪽 a–b]" → "이 범위의 저장한 요약 n개" → [개요 만들기 (호출 1)].
       입력 = 그 범위의 **저장한 요약**(지금 대상 언어 — 원문을 다시 보내지 않는다). 결과 3단 트리 · [저장] → `kind:'outline'`.
     · 내보내기(호출 0): `.txt`(UTF-8 BOM · CRLF — `text/summary.js` `exportText`) · 요약·용어만(원문 문단 없음 — 11-Q4 기본값) ·
       화면에 공유 주의 한 줄. `Blob` + `<a download>` + `revokeObjectURL`(8f-3 단어장과 같은 장치).

   ── 지키는 것 ──────────────────────────────────────────
   ★ 호출(6절): 목록·펼침·[원문으로]·[삭제]·내보내기 **0**. [개요 만들기]만 **최대 1** — 요청은 `pipeline.outline` 하나(요약 시트가
     controls 에서 받은 **같은** 파이프라인 — `sumsheet.sumServices()`: 상태 기계·상한·사용량 한 벌). 넘치면 요지만 → 그래도 넘치면
     보내지 않고 "범위를 줄이세요"(파이프라인이 거른다). 같은 범위·같은 요약이면 캐시 — 0.
   ★ 범위 이름(PDF 장 제목)은 **요청에 싣지 않는다**(11-1R #5 — `prompts.outlineInstruction`). 화면 머리·저장 레코드 `range.label` 에만.
   ★ 내보내기는 저장소의 요약·개요 레코드만 읽는다 — 캐시(`aiCache`)·키·원문 문단 글을 읽지 않는다.
   ★ 모든 글자 `textContent`/`appendBidiText` — `innerHTML` 0(13절). 줄은 `<details>`(JS 없이 펼침 — 키보드·화면 읽기 기본 동작).
     요지는 그 레코드의 대상 언어 방향(`dirOf(target)`), 원문 언어 요지는 원문 언어 방향(아랍어 UI 에서도 `dir=ltr`).
   ★ 삭제는 페이지 안 `<dialog>`(`confirm()` 쓰지 않음 — 8f-3 단어장과 같은 장치, 리스너 한 벌 · 대상은 열 때 고정).
   ★ 1절(순수)·2절(흐름 — DOM 없음)은 `tests/summaries-ui-11c.test.mjs` 가 잰다. 3절이 화면.
   ============================================================ */

import { t, applyTranslations, onLangChange, dirOf, formatNumber } from '../i18n/index.js';
import * as db from '../db.js';
import * as settings from '../settings.js';
import { AI, OUTLINE } from '../config.js';
import { go, replace, summariesHash, readerHash, reviewHash } from '../router.js';
import { exportText, compareAnchor, clean } from '../text/summary.js';
import { buildUnits } from '../tts/text.js';
import { summaryStore, withHashes, relocate } from '../notes/summaries.js';
import { printedLabel } from '../search/outline.js';
import { chaptersOf, chapterAt } from './rangepick.js';   // `[15-2 — 15-D11]` 범위 고르기 한 벌
import { domainOf } from '../ai/prompts.js';
import { appendBidiText } from './bididom.js';
import { renderTree } from './tree.js';
import { RETRYABLE_REMOTE, TAP_BANNER_NOW, noticeBanner } from './trband.js';
import { sumServices, itemNote } from './sumsheet.js';
import { pageParasOf } from './ask.js';
import { normalizeTranslationLang } from './settings.js';
import { onPageRender, revealLine, revealTop, flowParas, sourceLang } from './reader.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

/** 범위 개요를 만들 수 있는 최소 요약 수(하나를 "개요"로 다시 부르는 것은 호출 낭비). */
export const OUTLINE_MIN = 2;

/** 파일 이름 `medreader-summaries-YYYYMMDD.txt`(기기 날짜). */
export function exportName(nowMs) {
  const d = new Date(Number(nowMs) || 0);
  const p = (n) => String(n).padStart(2, '0');
  return 'medreader-summaries-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.txt';
}

/**
 * 내보낼 파일 한 벌(순수 — 쓰지 않는다). 글은 `exportText`(BOM · CRLF · 요약·용어만).
 * @returns {{name:string, mime:string, text:string}}
 */
export function exportFile(list, labels, nowMs) {
  return { name: exportName(nowMs), mime: 'text/plain;charset=utf-8', text: exportText(list, labels) };
}

/**
 * 내보낼 레코드 — **저장소의 요약·개요만**(호출 0 · 캐시·키·원문 문단을 읽지 않는다). `docId` 를 주면 그 책만.
 * @param {{store:{list:Function}}} deps
 * @param {?string} docId
 * @returns {Promise<Object[]>}
 */
export async function collectExport(deps, docId) {
  const store = (deps && deps.store) || summaryStore();
  const o = docId == null || docId === '' ? {} : { docId: String(docId) };
  const sums = await store.list(Object.assign({ kind: 'summary' }, o));
  const outs = await store.list(Object.assign({ kind: 'outline' }, o));
  return sums.concat(outs);
}

/** 언어 코드의 기본 부분 — speaker `langKey` 와 같은 규칙(문장 분할·인용 판정의 언어). */
export function langKey(l) {
  return String(l || 'en').replace(/_/g, '-').split('-')[0].toLowerCase() || 'en';
}

/**
 * 해시를 셀 지금 쪽 문단 — 요약 시트(`ask.pageParasOf(speaker.sentenceUnits())`)와 **같은 길**: 같은 `buildUnits(…, 'sentence')`·
 * 같은 원문 언어(`langKey`)·같은 `sentencesOf`→`paraTextsOf`. 인용 단위는 번호가 없어 어느 쪽이든 문단 글에서 빠진다.
 * @param {Array} paras 리더 `flowParas()`(표 안내가 끼어도 `sentencesOf` 가 뺀다)
 * @param {string} lang 문서 원문 언어(`sourceLang()`)
 */
export function hashParasOf(paras, lang) {
  return pageParasOf(buildUnits(Array.isArray(paras) ? paras : [], 'sentence', { lang: langKey(lang) }));
}

/**
 * [원문으로] — 저장 요약의 문단을 지금 쪽 문단(해시를 채운 것)에서 다시 찾는다. 찾으면 그 문단 첫 줄, 못 찾으면 `moved`.
 * @param {Object} rec 저장 `summary` 레코드
 * @param {{paraId:string, textHash:string, lineIds:string[]}[]} paras
 * @returns {{lineId:?string, paraId:?string, moved:boolean}}
 */
export function relocateLine(rec, paras) {
  const hit = relocate(rec, paras);
  if (!hit) return { lineId: null, paraId: null, moved: true };
  const ids = Array.isArray(hit.lineIds) ? hit.lineIds : [];
  return { lineId: ids.length ? String(ids[0]) : null, paraId: String(hit.paraId), moved: !ids.length };
}

/**
 * 문서의 장(`chaptersOf` — 맨 위 깊이) · 그 쪽이 든 장(`chapterAt`) — `[15-2 — 15-D11]` `ui/rangepick.js` 로 옮김(같은 함수 —
 * 여기서는 다시 내보내기만). 장 `to` = 다음 장 앞 쪽(마지막은 문서 끝).
 */
export { chaptersOf, chapterAt };

/** 레코드의 첫 쪽(요약 = `pageNo`, 개요 = `range.from`). */
export function startPage(rec) {
  if (rec && rec.kind === 'outline' && rec.range && Number.isFinite(Number(rec.range.from))) return Number(rec.range.from);
  return Number(rec && rec.pageNo) || 0;
}

/** 범위 고르기 칸에 넣는 장 이름 상한(좁은 화면에서 `<select>` 가 앞부분을 잘라 보이지 않게). */
export const CHAPTER_LABEL_MAX = 40;

const FSI = String.fromCharCode(0x2068);
const PDI = String.fromCharCode(0x2069);
/**
 * 화면 문구 안의 책 제목·장 이름(PDF 에서 온 글 — 방향을 모른다)을 방향 격리(FSI … PDI)로 감싼다 — 아랍어 UI 의 문구 안 라틴 제목이
 * 둘레의 숫자·구두점과 뒤섞여 보이지 않게. **화면에만** — 내보내기 파일에는 넣지 않는다(`exportText` 는 이 함수를 지나지 않는다).
 */
export function iso(s) { return FSI + String(s == null ? '' : s) + PDI; }

/** 긴 이름을 코드포인트 n 자로(넘으면 … ). */
export function shortLabel(s, n) {
  const a = Array.from(clean(s));
  return a.length > n ? a.slice(0, Math.max(1, n - 1)).join('').trim() + '…' : a.join('');
}

function docMap(docs) {
  const m = new Map();
  for (const d of Array.isArray(docs) ? docs : []) if (d && d.id != null) m.set(String(d.id), d);
  return m;
}

function titleOfDoc(d) { return String((d && (d.title || d.fileName || d.id)) || ''); }

/**
 * 책 고르기 선택지 — 맨 앞 "모든 책(n)", 그다음 저장이 있는 책(이 기기 문서), 그다음 문서가 지워진 책(`docTitle`).
 * 저장이 없는 책은 넣지 않는다(서재 카드 [⋯] 로 들어오면 그 책 하나는 화면이 더한다).
 * @returns {{value:string, title:string, n:number, gone:boolean}[]}
 */
export function scopeOptions(recs, docs) {
  const list = Array.isArray(recs) ? recs.filter((r) => r && (r.kind === 'summary' || r.kind === 'outline')) : [];
  const m = docMap(docs);
  const count = new Map();
  const titles = new Map();
  for (const r of list) {
    const k = r.docId == null ? '' : String(r.docId);
    if (!k) continue;
    count.set(k, (count.get(k) || 0) + 1);
    if (!titles.has(k) && clean(r.docTitle)) titles.set(k, clean(r.docTitle));
  }
  const out = [];
  for (const [k, n] of count) {
    const d = m.get(k);
    out.push({ value: k, title: d ? titleOfDoc(d) : (titles.get(k) || k), n: n, gone: !d });
  }
  out.sort((a, b) => (a.gone - b.gone) || a.title.localeCompare(b.title));
  return [{ value: '', title: '', n: list.length, gone: false }].concat(out);
}

/**
 * 목록 화면의 모양 — 책 → 묶음(장 머리 또는 쪽) → 줄. 개요는 그 범위 머리(같은 묶음 안 맨 앞). 순수 함수.
 * @param {Object[]} recs 요약·개요 레코드
 * @param {Object[]} docs 이 기기 문서
 * @param {?string} docId 책 범위(없으면 전체)
 * @returns {{docId:string, title:string, gone:boolean, groups:{head:{kind:'chapter'|'page', title?:string, from?:number, to?:number, page?:number},
 *           items:Object[]}[]}[]}
 */
export function viewGroups(recs, docs, docId) {
  const m = docMap(docs);
  const scope = docId == null || docId === '' ? null : String(docId);
  const byDoc = new Map();
  for (const r of Array.isArray(recs) ? recs : []) {
    if (!r || (r.kind !== 'summary' && r.kind !== 'outline') || r.docId == null) continue;
    const k = String(r.docId);
    if (scope !== null && k !== scope) continue;
    if (!byDoc.has(k)) byDoc.set(k, []);
    byDoc.get(k).push(r);
  }
  const books = [];
  for (const [k, list] of byDoc) {
    const d = m.get(k) || null;
    const chapters = chaptersOf(d);
    const keyed = list.map((r) => {
      const p = startPage(r);
      const c = chapterAt(chapters, p);
      return { r: r, p: p, c: c, g: c >= 0 ? 'c' + c : 'p' + p, gp: c >= 0 ? chapters[c].from : p };
    });
    keyed.sort((a, b) => (a.gp - b.gp) || (a.g === b.g ? 0 : (a.c >= 0 ? -1 : 1)) ||
      ((a.r.kind === 'outline' ? 0 : 1) - (b.r.kind === 'outline' ? 0 : 1)) || (a.p - b.p) || compareAnchor(a.r, b.r));
    const groups = [];
    for (const x of keyed) {
      const last = groups[groups.length - 1];
      if (last && last.key === x.g) { last.items.push(x.r); continue; }
      const head = x.c >= 0 ? { kind: 'chapter', title: chapters[x.c].title, from: chapters[x.c].from, to: chapters[x.c].to }
        : { kind: 'page', page: x.p };
      groups.push({ key: x.g, head: head, items: [x.r] });
    }
    const docTitle = (list.find((r) => clean(r.docTitle)) || {}).docTitle;
    books.push({ docId: k, title: d ? titleOfDoc(d) : clean(docTitle) || '', gone: !d,
      groups: groups.map((g) => ({ head: g.head, items: g.items })) });
  }
  books.sort((a, b) => (a.gone - b.gone) || a.title.localeCompare(b.title));
  return books;
}

/** 그 범위·그 대상 언어의 저장 요약(개요 입력 — 읽기 순서는 `outlineInput` 이 맞춘다). */
export function inRange(recs, docId, range, target) {
  const r = range || {};
  const from = Number(r.from);
  const to = Number(r.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  return (Array.isArray(recs) ? recs : []).filter((x) => x && x.kind === 'summary' && String(x.docId) === String(docId) &&
    x.target === target && Number(x.pageNo) >= from && Number(x.pageNo) <= to && clean(x.gist));
}

/** 쪽 범위 기본값 — 그 책·그 대상 언어 저장 요약의 첫 쪽 ~ 끝 쪽(없으면 1–1). */
export function defaultPages(recs, docId, target) {
  const ps = (Array.isArray(recs) ? recs : []).filter((x) => x && x.kind === 'summary' && String(x.docId) === String(docId) &&
    x.target === target).map((x) => Number(x.pageNo)).filter((n) => Number.isFinite(n) && n >= 1);
  if (!ps.length) return { from: 1, to: 1 };
  return { from: Math.min.apply(null, ps), to: Math.max.apply(null, ps) };
}

/**
 * 범위 고르기 선택지 — 장마다(그 장의 지금 대상 언어 저장 요약 수) + 맨 끝 "쪽 범위 직접". 처음 고를 것(`pick`) = 요약이
 * `OUTLINE_MIN` 개 이상인 첫 장, 없으면 쪽 범위.
 * @returns {{options:{value:string, title?:string, from?:number, to?:number, n?:number}[], pick:string}}
 */
export function rangeOptions(chapters, recs, docId, target) {
  const options = [];
  let pick = null;
  (Array.isArray(chapters) ? chapters : []).forEach((c, i) => {
    const n = inRange(recs, docId, c, target).length;
    options.push({ value: 'c' + i, title: c.title, from: c.from, to: c.to, n: n });
    if (pick === null && n >= OUTLINE_MIN) pick = 'c' + i;
  });
  options.push({ value: 'p' });
  return { options: options, pick: pick || 'p' };
}

/* ────────────────────────────────────────────────────────
   2. 흐름 — 범위 개요(DOM 없이 — 테스트가 가짜 파이프라인·저장소로 잰다)
   ──────────────────────────────────────────────────────── */

function idleState() {
  return { state: 'idle', code: null, gate: false, value: null, cached: false, n: 0, chars: 0, input: null,
    saved: null, busy: false, note: null, banner: null, calls: 0, req: null };
}

/**
 * 범위 개요의 상태 기계. 한 번 누름 = 최대 1호출(`pipeline.outline` 이 넘치면 보내지 않는다). 늦게 온 결과는 버린다(`gen`).
 * @param {{outline:(recs:Object[], opts:Object)=>Promise<Object>, unblock?:()=>Promise<*>, gate?:()=>{ok:boolean, reason?:string},
 *          saveOutline:(input:Object)=>Promise<?{rec:Object}>, onChange?:(view:Object)=>void}} deps
 */
export function createOutlineFlow(deps) {
  const d = deps || {};
  let st = idleState();
  let gen = 0;

  function noteOf(s) {
    if (s.note) return s.note;
    switch (s.state) {
      case 'pending': return { key: 'summaries.outline.pending', retry: false };
      case 'too-big': return { key: 'summaries.tooBig', params: { n: s.n, m: s.chars }, retry: false };
      case 'failed': return { key: 'summaries.outline.failed', retry: true };
      case 'blocked':
      case 'skipped': {
        const n = itemNote({ state: s.state, code: s.code, gate: s.gate });
        return n ? { key: n.key, retry: !!n.retry } : null;
      }
      default: return null;
    }
  }
  function view() {
    const v = Object.assign({}, st, { req: st.req ? { n: st.req.recs.length, target: st.req.ctx.target || '',
      range: Object.assign({}, st.req.ctx.range || {}) } : null });
    v.note = noteOf(st);
    return v;
  }
  function emit() { if (typeof d.onChange === 'function') { try { d.onChange(view()); } catch (e) { /* 그리기 오류가 흐름을 막지 않는다 */ } } }
  function gateNow() { try { return typeof d.gate === 'function' ? (d.gate() || { ok: true }) : { ok: true }; } catch (e) { return { ok: true }; } }

  async function run(my, extra) {
    const r = st.req;
    st.note = null;
    st.banner = null;
    const g = gateNow();
    if (!g.ok) {
      Object.assign(st, { state: 'blocked', code: g.reason || null, gate: true, value: null });
      if (TAP_BANNER_NOW.indexOf(g.reason) >= 0) st.banner = g.reason;
      emit();
      return view();
    }
    Object.assign(st, { state: 'pending', code: null, gate: false, value: null });
    emit();
    const c = r.ctx || {};
    let out = null;
    try {
      out = await d.outline(r.recs, Object.assign({ target: c.target, docId: c.docId, domain: c.domain }, extra || {}));
    } catch (e) { out = null; }
    if (my !== gen) return view();
    st.calls += (out && Number(out.calls)) || 0;
    if (out && out.status === 'too-big') {
      Object.assign(st, { state: 'too-big', n: Number(out.n) || r.recs.length, chars: Number(out.chars) || 0 });
    } else {
      const it = out && Array.isArray(out.results) ? out.results[0] : null;
      if (it && it.state === 'ready' && it.value) Object.assign(st, { state: 'ready', value: it.value, cached: !!it.cached, input: out.input || null });
      else if (it && (it.state === 'blocked' || it.state === 'skipped')) Object.assign(st, { state: it.state, code: it.code || null });
      else Object.assign(st, { state: 'failed', code: (it && it.code) || null });
      if (st.state === 'blocked' && TAP_BANNER_NOW.indexOf(st.code) >= 0) st.banner = st.code;
    }
    emit();
    return view();
  }

  /**
   * [개요 만들기] — 그 범위의 저장 요약으로 한 번.
   * @param {{recs:Object[], ctx:{docId:string, docTitle?:string, fileHash?:string, target:string, domain?:string, provider?:string,
   *          model?:string, range:{from:number, to:number, label?:string}}}} o
   */
  async function make(o) {
    const x = o || {};
    const recs = Array.isArray(x.recs) ? x.recs.slice() : [];
    if (st.state === 'pending' || st.busy || recs.length < OUTLINE_MIN) return view();
    const my = ++gen;
    const calls = st.calls;
    st = idleState();
    st.calls = calls;
    st.req = { recs: recs, ctx: Object.assign({}, x.ctx || {}) };
    return run(my, null);
  }

  /** [다시 시도] — 막힌 원격 상태면 `pipeline.retry()` 먼저(사용자 동작만 — 자동 재시도 0). 문지기 막힘은 문지기를 다시 본다. */
  async function retry() {
    if (!st.req || st.state === 'pending' || st.state === 'ready' || st.busy) return view();
    const my = gen;
    if (st.state === 'blocked' && !st.gate && RETRYABLE_REMOTE.indexOf(st.code) >= 0 && typeof d.unblock === 'function') {
      try { await d.unblock(); } catch (e) { /* 그래도 한 번 보낸다 */ }
      if (my !== gen) return view();
    }
    return run(my, { retry: true });
  }

  /** [저장] — `kind:'outline'`(같은 범위·대상 언어면 대체 — 저장소가 한다). 호출 0. */
  async function save() {
    if (st.state !== 'ready' || !st.value || st.saved || st.busy || !st.req) return view();
    const my = gen;
    const c = st.req.ctx || {};
    st.busy = true;
    emit();
    let res = null;
    try {
      res = await d.saveOutline({
        docId: c.docId, docTitle: c.docTitle || '', fileHash: c.fileHash || '', range: c.range || {}, target: c.target,
        value: st.value, sources: st.req.recs.map((r) => String(r.id)), domain: c.domain || '',
        provider: c.provider || '', model: c.model || '', promptVersion: OUTLINE.PROMPT_VERSION
      });
    } catch (e) { res = null; }
    if (my !== gen) return view();
    st.busy = false;
    if (res && res.rec) { st.saved = res.rec; st.note = { key: 'summaries.outline.saved', retry: false }; }
    else st.note = { key: 'sum.saveFailed', retry: false };
    emit();
    return view();
  }

  /** 범위가 바뀜·화면을 바꿈 — 늦은 결과는 버린다. */
  function reset() { gen++; const calls = st.calls; st = idleState(); st.calls = calls; emit(); return view(); }

  function bannerShown() { st.banner = null; }

  return { make: make, retry: retry, save: save, reset: reset, view: view, bannerShown: bannerShown };
}

/* ────────────────────────────────────────────────────────
   3. 화면
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
const S = { docId: null, all: [], docs: [], seq: 0, range: null, from: 1, to: 1, rangeFor: null };
let flow = null;
/** [원문으로] — 그 쪽이 그려지면 문단을 다시 찾아 그 줄로(다른 쪽·다른 책이면 버린다). */
let pendingReveal = null;
/** 측정 훅 — 마지막 [원문으로]의 결과(글자 없음). */
let lastReveal = null;
/** 삭제 확인 대화의 대상 id — 열 때 고정, 어떤 닫힘에도 지운다(8f-3b 와 같은 규칙). */
let delTarget = null;
let lastExport = null;

function store() { const sv = sumServices(); return (sv && sv.store) || summaryStore(); }

export function initSummaries() {
  if (typeof document === 'undefined' || els) return;
  root = document.querySelector('[data-screen="summaries"]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  els = {
    title: q('#sumsTitle'), scope: q('#sumsScope'), status: q('#sumsStatus'),
    range: q('#sumsRange'), rangeSel: q('#sumsRangeSel'), pages: q('#sumsPages'), from: q('#sumsFrom'), to: q('#sumsTo'),
    rangeN: q('#sumsRangeN'), make: q('#sumsMake'), retry: q('#sumsRetry'), outStatus: q('#sumsOutStatus'),
    outline: q('#sumsOutline'), outTitle: q('#sumsOutTitle'), outTree: q('#sumsOutTree'), outSave: q('#sumsOutSave'),
    exportBtn: q('#sumsExport'), share: q('#sumsShare'), list: q('#sumsList'), empty: q('#sumsEmpty'), emptyText: q('#sumsEmptyText'),
    del: q('#sumsDelDialog')
  };
  flow = createOutlineFlow({
    outline: function (recs, o) { const sv = sumServices(); return sv ? sv.pipeline.outline(recs, o) : Promise.resolve(null); },
    unblock: function () { const sv = sumServices(); return sv && typeof sv.pipeline.retry === 'function' ? sv.pipeline.retry() : null; },
    // 동의 먼저(8c-1 문지기 순서의 첫 칸 — 그 밖의 막힘(키 없음·상한·오프라인)은 파이프라인 `gate` 가 보내지 않고 알린다)
    gate: function () { return settings.get('privacy.consentedAt') ? { ok: true, reason: null } : { ok: false, reason: 'consent' }; },
    saveOutline: function (input) { return store().saveOutline(input); },
    onChange: renderOutline
  });
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  els.from.addEventListener('input', onPagesInput);
  els.to.addEventListener('input', onPagesInput);
  els.del.addEventListener('click', onDelClick);
  els.del.addEventListener('cancel', (ev) => { ev.preventDefault(); closeDel(); });
  els.del.addEventListener('close', () => { if (!els.del.open) delTarget = null; });
  onLangChange(() => { if (!root) return; applyTranslations(root); if (!root.hidden) { render(); renderOutline(flow.view()); } });
  // [원문으로] — 리더가 그 쪽을 그린 뒤(구독 순서: controls 가 큐를 그 쪽 것으로 간 다음) 문단을 다시 찾아 그 줄로
  onPageRender((p) => {
    const x = pendingReveal;
    if (!x || !p) return;
    pendingReveal = null;
    if (String(p.docId) !== String(x.docId) || Number(p.page) !== Number(x.page)) return;
    const run = () => { revealFor(x.rec).catch(() => { /* 못 굴려도 쪽은 열렸다 */ }); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0)); else setTimeout(run, 0);
  });
  attachDebugHook();
}

/**
 * `[15-2]` 복습 묶음 [모아 보기] — 다음에 그 책을 열 때 범위 고르기를 이 범위로(한 번). 같은 장(맨 위 깊이)이 있으면 그 장, 아니면 쪽 a–b.
 */
let presetRangeOnce = null;
export function presetSummariesRange(docId, from, to) {
  presetRangeOnce = docId == null ? null : { docId: String(docId), from: Math.floor(Number(from)), to: Math.floor(Number(to)) };
}

/** 라우터 — `#/summaries` · `#/summaries/:docId`. */
export async function showSummaries(params) {
  if (!root) return;
  const docId = params && params.docId != null && params.docId !== '' ? String(params.docId) : null;
  if (docId !== S.docId) { S.range = null; S.rangeFor = null; if (flow) flow.reset(); }
  S.docId = docId;
  const pre = presetRangeOnce;
  presetRangeOnce = null;
  if (pre && pre.docId === docId && pre.from >= 1 && pre.to >= pre.from) {
    if (flow) flow.reset();
    S.rangeFor = docId;
    S.from = pre.from;
    S.to = pre.to;
    S.range = 'p';
    S.presetChapter = pre;                 // 장 목록은 문서를 읽은 뒤에 맞춘다(`renderRange`)
  }
  applyTranslations(root);
  attachDebugHook();          // main.js 가 부팅 끝에 `window.__medreader` 를 새로 만든다 — 화면에 들어올 때 다시 단다
  await load();
  attachDebugHook();          // 이 화면으로 바로 부팅하면 위 줄 뒤에 main.js 가 전역을 새로 만든다 — 읽기가 끝난 뒤 한 번 더
}

/** 화면을 떠날 때 — 삭제 확인을 거둔다. 목록·범위·개요 결과는 메모리에 둔다(돌아오면 그대로). */
export function leaveSummaries() {
  if (!els) return;
  closeDel();
}

async function load() {
  const my = ++S.seq;
  let all = [];
  const docs = [];
  try {
    all = await collectExport({ store: store() }, null);
    await db.iterate('documents', {}, (v) => { if (v && v.id != null) docs.push(v); });
  } catch (e) {
    banner(e);
  }
  if (my !== S.seq) return;
  S.all = all;
  S.docs = docs;
  render();
}

function docsById() { return docMap(S.docs); }

function targetNow() { return normalizeTranslationLang(settings.get('ai.translationLang')); }

function scoped() {
  return S.docId ? S.all.filter((r) => String(r.docId) === S.docId) : S.all.slice();
}

/** 쪽 라벨 — 8g `pageLabels` 가 있으면 인쇄 쪽(요약 시트·검색 화면과 같은 문구 키). */
function pageLabelOf(doc, page) {
  const p = Number(page);
  const lab = printedLabel(doc && doc.pageLabels, p);
  return lab ? t('search.pageLabeled', { label: lab, page: formatNumber(p) }) : t('search.page', { page: formatNumber(p) });
}

function rangeText(r) {
  const x = r || {};
  return t('summaries.outlineRange', { from: formatNumber(Number(x.from) || 0), to: formatNumber(Number(x.to) || 0) });
}

function render() {
  if (!els) return;
  const m = docsById();
  const doc = S.docId ? m.get(S.docId) : null;
  const goneTitle = S.docId && !doc ? (S.all.find((r) => String(r.docId) === S.docId && clean(r.docTitle)) || {}).docTitle : '';
  els.title.textContent = S.docId ? t('summaries.titleDoc', { title: iso(doc ? titleOfDoc(doc) : (goneTitle || S.docId)) }) : t('summaries.title');
  renderScope();
  const list = scoped();
  els.exportBtn.hidden = list.length === 0;
  els.share.hidden = list.length === 0;
  renderRange();
  renderList();
}

function renderScope() {
  const sel = els.scope;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  let has = false;
  for (const o of scopeOptions(S.all, S.docs)) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = !o.value ? t('summaries.scope.all', { n: formatNumber(o.n) })
      : t(o.gone ? 'summaries.scope.gone' : 'summaries.scope.doc', { title: iso(o.title), n: formatNumber(o.n) });
    if (o.value === (S.docId || '')) { op.selected = true; has = true; }
    sel.appendChild(op);
  }
  if (!has && S.docId) {
    // 저장이 없는 책(서재 카드 [⋯] 로 들어옴) — 그 책 하나를 더한다(빈 목록)
    const d = docsById().get(S.docId);
    const op = document.createElement('option');
    op.value = S.docId;
    op.textContent = t(d ? 'summaries.scope.doc' : 'summaries.scope.gone', { title: iso(d ? titleOfDoc(d) : S.docId), n: formatNumber(0) });
    op.selected = true;
    sel.appendChild(op);
  }
}

/* ── 범위 개요 ─────────────────────────────────────── */

function currentRange() {
  const doc = docsById().get(S.docId) || null;
  const chapters = chaptersOf(doc);
  if (S.range && S.range.charAt(0) === 'c') {
    const c = chapters[Number(S.range.slice(1))];
    if (c) return { from: c.from, to: c.to, label: c.title };
  }
  const a = Math.max(1, Math.floor(Number(S.from) || 1));
  const b = Math.max(1, Math.floor(Number(S.to) || 1));
  return { from: Math.min(a, b), to: Math.max(a, b), label: '' };
}

function renderRange() {
  const on = !!S.docId;
  els.range.hidden = !on;
  if (!on) return;
  const doc = docsById().get(S.docId) || null;
  const target = targetNow();
  const chapters = chaptersOf(doc);
  const ro = rangeOptions(chapters, S.all, S.docId, target);
  if (S.presetChapter) {
    // `[15-2]` [모아 보기] 로 들어옴 — 같은 범위의 장이 있으면 그 장으로(없으면 쪽 a–b 그대로)
    const pc = S.presetChapter;
    S.presetChapter = null;
    const i = chapters.findIndex((c) => c.from === pc.from && c.to === pc.to);
    if (i >= 0 && S.rangeFor === S.docId) S.range = 'c' + i;
  }
  if (S.rangeFor !== S.docId || S.range === null || !ro.options.some((o) => o.value === S.range)) {
    S.range = ro.pick;
    S.rangeFor = S.docId;
    const dp = defaultPages(S.all, S.docId, target);
    S.from = dp.from;
    S.to = dp.to;
  }
  const sel = els.rangeSel;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  for (const o of ro.options) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.value === 'p' ? t('summaries.range.pages')
      : t('summaries.range.chapter', { title: iso(shortLabel(o.title, CHAPTER_LABEL_MAX)), from: formatNumber(o.from), to: formatNumber(o.to) }) + ' · ' + formatNumber(o.n);
    if (o.value === S.range) op.selected = true;
    sel.appendChild(op);
  }
  els.pages.hidden = S.range !== 'p';
  if (String(els.from.value) !== String(S.from)) els.from.value = String(S.from);
  if (String(els.to.value) !== String(S.to)) els.to.value = String(S.to);
  const n = inRange(S.all, S.docId, currentRange(), target).length;
  els.rangeN.textContent = t('summaries.range.count', { n: formatNumber(n) });
  els.rangeN.setAttribute('data-n', String(n));
  renderOutline(flow.view());
}

/** 개요 결과 칸 — 상태 한 줄 · [개요 만들기] · [다시 시도] · 제목 + 3단 트리 + [저장]. */
function renderOutline(v) {
  if (!els || !v) return;
  if (v.banner) { raiseBanner(v.banner); flow.bannerShown(); }
  const target = targetNow();
  const n = S.docId ? inRange(S.all, S.docId, currentRange(), target).length : 0;
  const services = !!sumServices();
  els.make.hidden = !services || n < OUTLINE_MIN || v.state === 'pending';
  if (v.busy) els.make.setAttribute('aria-disabled', 'true'); else els.make.removeAttribute('aria-disabled');
  const note = v.note;
  els.outStatus.textContent = note ? t(note.key, note.params ? { n: formatNumber(note.params.n), m: formatNumber(note.params.m) } : undefined) : '';
  els.retry.hidden = !(note && note.retry) || !services;
  const ready = v.state === 'ready' && v.value;
  els.outline.hidden = !ready;
  while (els.outTree.firstChild) els.outTree.removeChild(els.outTree.firstChild);
  if (ready) {
    const req = v.req || {};
    const lang = req.target || target || '';
    const tdir = dirOf(lang);
    els.outTitle.textContent = '';
    els.outTitle.setAttribute('lang', lang);
    els.outTitle.setAttribute('dir', tdir);
    appendBidiText(els.outTitle, String(v.value.title || ''), tdir);
    const tree = renderTree(v.value.points, { dir: tdir, lang: lang, open: true });
    if (tree) els.outTree.appendChild(tree);
    els.outSave.textContent = t(v.saved ? 'sum.saved' : 'sum.save');
    if (v.saved || v.busy) els.outSave.setAttribute('aria-disabled', 'true'); else els.outSave.removeAttribute('aria-disabled');
    els.outline.setAttribute('data-from', String((req.range && req.range.from) || ''));
  }
}

async function makeOutline() {
  const doc = docsById().get(S.docId) || null;
  const target = targetNow();
  const range = currentRange();
  const recs = inRange(S.all, S.docId, range, target);
  const first = recs.find((r) => clean(r.docTitle)) || {};
  const p = settings.get('ai.provider');
  await flow.make({ recs: recs, ctx: {
    docId: S.docId, docTitle: doc ? titleOfDoc(doc) : (first.docTitle || ''), fileHash: (doc && doc.fileHash) || '',
    target: target, domain: domainOf(doc), provider: typeof p === 'string' && p ? p : AI.DEFAULT_PROVIDER,
    model: String(settings.get('ai.model') || ''), range: range
  } });
}

async function saveOutline() {
  const v = await flow.save();
  if (v && v.saved) await load();
}

/* ── 목록 ──────────────────────────────────────────── */

function renderList() {
  const list = els.list;
  while (list.firstChild) list.removeChild(list.firstChild);
  const m = docsById();
  const books = viewGroups(S.all, S.docs, S.docId);
  for (const b of books) {
    const sec = document.createElement('section');
    sec.className = 'sums-book';
    sec.setAttribute('data-doc', b.docId);
    if (!S.docId) {
      const h = document.createElement('h2');
      h.className = 'sums-book-title';
      h.textContent = b.gone ? t('summaries.goneHead', { title: iso(b.title || t('summaries.untitled')) }) : iso(b.title || t('summaries.untitled'));
      sec.appendChild(h);
    }
    const doc = m.get(b.docId) || null;
    for (const g of b.groups) {
      const h3 = document.createElement('h3');
      h3.className = 'sums-head';
      if (g.head.kind === 'chapter') {
        h3.textContent = t('summaries.range.chapter', { title: iso(g.head.title), from: formatNumber(g.head.from), to: formatNumber(g.head.to) });
      } else {
        h3.textContent = pageLabelOf(doc, g.head.page);
      }
      sec.appendChild(h3);
      const ul = document.createElement('ul');
      ul.className = 'sums-items';
      for (const r of g.items) ul.appendChild(r.kind === 'outline' ? outlineRow(r, doc, b.gone) : summaryRow(r, doc, b.gone));
      sec.appendChild(ul);
    }
    list.appendChild(sec);
  }
  const n = scoped().length;
  els.empty.hidden = n > 0;
  els.emptyText.textContent = S.docId ? t('summaries.emptyDoc') : t('summaries.empty');
}

function langSpan(cls, text, lang) {
  const s = document.createElement('span');
  s.className = cls;
  const dir = dirOf(lang || '');
  if (lang) s.setAttribute('lang', lang);
  s.setAttribute('dir', lang ? dir : 'auto');
  appendBidiText(s, String(text || ''), dir);
  return s;
}

function actionBtn(sa, id, key) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sums-btn';
  b.setAttribute('data-sa', sa);
  b.setAttribute('data-id', String(id));
  b.textContent = t(key);
  return b;
}

/** 문단 요약 한 줄 — 접힌 채: 쪽 라벨 · 요지. 펼치면 원문 언어 요지 · 트리 · 용어 · [원문으로] · [삭제]. */
function summaryRow(r, doc, gone) {
  const li = document.createElement('li');
  const det = document.createElement('details');
  det.className = 'sums-item';
  det.setAttribute('data-id', String(r.id));
  det.setAttribute('data-kind', 'summary');
  const sm = document.createElement('summary');
  sm.className = 'sums-sum';
  const pg = document.createElement('span');
  pg.className = 'sums-page';
  pg.textContent = pageLabelOf(gone ? null : doc, r.pageNo);
  sm.appendChild(pg);
  sm.appendChild(langSpan('sums-gist', r.gist, r.target));
  det.appendChild(sm);
  const body = document.createElement('div');
  body.className = 'sums-body';
  if (clean(r.gistSrc) && r.src && r.src !== r.target) {
    const gs = document.createElement('p');
    gs.className = 'sums-gist-src';
    gs.setAttribute('lang', r.src);
    gs.setAttribute('dir', dirOf(r.src));
    gs.textContent = String(r.gistSrc);
    body.appendChild(gs);
  }
  const tdir = dirOf(r.target || '');
  const tree = renderTree(r.points, { dir: tdir, lang: r.target, open: true });
  if (tree) body.appendChild(tree);
  const terms = (Array.isArray(r.terms) ? r.terms : []).filter((x) => x && clean(x.src) && clean(x.tr));
  if (terms.length) {
    const lab = document.createElement('p');
    lab.className = 'sums-label';
    lab.textContent = t('sum.terms');
    body.appendChild(lab);
    const ul = document.createElement('ul');
    ul.className = 'sums-terms';
    for (const x of terms) {
      const tl = document.createElement('li');
      tl.appendChild(langSpan('sums-term-src', x.src, r.src || 'en'));
      const sep = document.createElement('span');
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = ' — ';
      tl.appendChild(sep);
      tl.appendChild(langSpan('sums-term-tr', x.tr, r.target));
      ul.appendChild(tl);
    }
    body.appendChild(ul);
  }
  const row = document.createElement('div');
  row.className = 'sums-row';
  if (!gone && doc && Number(r.pageNo) >= 1) row.appendChild(actionBtn('goto', r.id, 'summaries.goto'));
  row.appendChild(actionBtn('delete', r.id, 'summaries.delete'));
  body.appendChild(row);
  det.appendChild(body);
  li.appendChild(det);
  return li;
}

/** 저장한 개요 한 줄 — 접힌 채: [개요] 범위 · 제목. 펼치면 3단 트리 · [삭제]. */
function outlineRow(r, doc, gone) {
  const li = document.createElement('li');
  const det = document.createElement('details');
  det.className = 'sums-item sums-outline-item';
  det.setAttribute('data-id', String(r.id));
  det.setAttribute('data-kind', 'outline');
  const sm = document.createElement('summary');
  sm.className = 'sums-sum';
  const tag = document.createElement('span');
  tag.className = 'sums-page sums-tag';
  const lab = r.range && clean(r.range.label) ? iso(clean(r.range.label)) + ' · ' + rangeText(r.range) : rangeText(r.range);
  tag.textContent = t('summaries.outline.tag') + ' · ' + lab;
  sm.appendChild(tag);
  sm.appendChild(langSpan('sums-gist', r.title, r.target));
  det.appendChild(sm);
  const body = document.createElement('div');
  body.className = 'sums-body';
  const tree = renderTree(r.points, { dir: dirOf(r.target || ''), lang: r.target, open: true });
  if (tree) body.appendChild(tree);
  const row = document.createElement('div');
  row.className = 'sums-row';
  row.appendChild(actionBtn('delete', r.id, 'summaries.delete'));
  body.appendChild(row);
  det.appendChild(body);
  li.appendChild(det);
  return li;
}

function setStatus(key, params) { els.status.textContent = key ? t(key, params || undefined) : ''; }

/* ── 동작 ──────────────────────────────────────────── */

function onClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-sa]') : null;
  if (!b || !root.contains(b) || b.hidden || b.getAttribute('aria-disabled') === 'true') return;
  const a = b.getAttribute('data-sa');
  if (a === 'outline') { makeOutline(); return; }
  if (a === 'outline-retry') { flow.retry(); return; }
  if (a === 'outline-save') { saveOutline(); return; }
  if (a === 'export') { doExport(); return; }
  // `[15-2 — 15-D9]` [이 범위 복습] — 지금 고른 범위 그대로 복습 묶음으로(호출 0)
  if (a === 'review') { if (S.docId) { const r = currentRange(); go(reviewHash(S.docId, { from: r.from, to: r.to })); } return; }
  if (a === 'goto') { gotoSource(b.getAttribute('data-id')); return; }
  if (a === 'delete') askDelete(b.getAttribute('data-id'));
}

function onChange(ev) {
  const x = ev.target;
  if (x === els.scope) {
    // 해시를 히스토리에 쌓지 않고 바꾼다(라우터가 다시 그린다)
    replace(summariesHash(els.scope.value || null));
    return;
  }
  if (x === els.rangeSel) {
    S.range = els.rangeSel.value;
    flow.reset();
    renderRange();
  }
}

function onPagesInput() {
  const a = Math.floor(Number(els.from.value));
  const b = Math.floor(Number(els.to.value));
  if (Number.isFinite(a) && a >= 1) S.from = a;
  if (Number.isFinite(b) && b >= 1) S.to = b;
  flow.reset();
  const n = inRange(S.all, S.docId, currentRange(), targetNow()).length;
  els.rangeN.textContent = t('summaries.range.count', { n: formatNumber(n) });
  els.rangeN.setAttribute('data-n', String(n));
  renderOutline(flow.view());
}

function recById(id) { return S.all.find((r) => String(r.id) === String(id)) || null; }

/** [원문으로] — 그 쪽을 열고, 그려지면 그 문단 첫 줄로(`revealFor`). 문서가 없으면 단추가 없다. */
function gotoSource(id) {
  const r = recById(id);
  if (!r || r.kind !== 'summary' || r.docId == null || !(Number(r.pageNo) >= 1) || !docsById().has(String(r.docId))) return;
  pendingReveal = { docId: String(r.docId), page: Number(r.pageNo), rec: r };
  lastReveal = null;
  go(readerHash(r.docId, r.pageNo));
}

/** 지금 그려진 쪽에서 그 요약의 문단을 다시 찾아 첫 줄을 편안 영역 안으로. 못 찾으면 쪽 처음 + 한 줄(배너). */
async function revealFor(rec) {
  let hit = { lineId: null, paraId: null, moved: true };
  try {
    const paras = await withHashes(hashParasOf(flowParas(), sourceLang()));
    hit = relocateLine(rec, paras);
  } catch (e) { hit = { lineId: null, paraId: null, moved: true }; }
  let shown = false;
  if (hit.lineId != null) { try { shown = revealLine(hit.lineId, null) !== false; } catch (e) { shown = false; } }
  if (!shown) {
    try { revealTop(); } catch (e) { /* 쪽은 열렸다 */ }
    document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { key: 'summaries.moved', tone: 'warn' } }));
  }
  lastReveal = { found: shown, moved: !shown, paraId: shown ? hit.paraId : null, lineId: shown ? hit.lineId : null };
}

/* ── 삭제(페이지 안 확인) ─────────────────────────── */

function askDelete(id) {
  const r = recById(id);
  const dlg = els.del;
  if (!r || !dlg) return;
  applyTranslations(dlg);
  delTarget = String(r.id);
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  const cancel = dlg.querySelector('button[data-dialog="cancel"]');
  if (cancel) cancel.focus();
}

function closeDel() {
  delTarget = null;
  const dlg = els && els.del;
  if (!dlg) return;
  if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
}

async function onDelClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-dialog]') : null;
  if (!b) return;
  const id = delTarget;
  const ok = b.getAttribute('data-dialog') === 'ok';
  closeDel();
  if (!ok || id == null) return;
  let done = false;
  try { done = await store().remove(id); } catch (e) { done = false; }
  setStatus(done ? 'summaries.deleted' : 'sum.saveFailed');
  await load();
  // 지운 줄은 사라졌다 — 포커스를 목록 머리(책 고르기)로(문서 끝으로 떨어지지 않게)
  try { els.scope.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ }
}

/* ── 내보내기(호출 0) ─────────────────────────────── */

function exportLabels(docs) {
  return {
    notice: t('sum.disclaimer'),
    untitled: t('summaries.untitled'),
    terms: t('sum.terms'),
    title: (r) => { const d = docs.get(String(r.docId)); return d ? titleOfDoc(d) : r.docTitle; },
    page: (r) => pageLabelOf(docs.get(String(r.docId)) || null, r.pageNo),
    range: (r) => (r.range && clean(r.range.label) ? clean(r.range.label) + ' · ' + rangeText(r.range) : rangeText(r.range))
  };
}

async function doExport() {
  const nowMs = Date.now();
  let f = null;
  try {
    const list = await collectExport({ store: store() }, S.docId);
    f = exportFile(list, exportLabels(docsById()), nowMs);
    const blob = new Blob([f.text], { type: f.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.rel = 'noopener';
    a.hidden = true;
    root.appendChild(a);
    a.click();
    root.removeChild(a);
    // 내려받기가 시작된 뒤 거둔다(바로 거두면 일부 브라우저가 받지 못한다)
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* 이미 거둠 */ } }, 30000);
    lastExport = { name: f.name, lines: f.text.split('\r\n').length - 1, records: list.length };
  } catch (e) {
    setStatus('summaries.export.failed');
    return;
  }
  setStatus('summaries.export.done', { name: f.name });
}

/* ── 작은 도구 ─────────────────────────────────────── */

/** no-key·consent — 사용자가 개요를 불렀으므로 상태 바 배너를 바로(요약 시트·탭 번역과 같은 문구). */
function raiseBanner(code) {
  const b = noticeBanner(code, '');
  if (!b) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] } }));
}

function banner(err) {
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { code: (err && err.code) || 'ERR_UNKNOWN', tone: 'error' } }));
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(수·키·불리언만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  g.summaries = {
    state: function () {
      if (!els) return null;
      const v = flow ? flow.view() : null;
      const items = Array.from(els.list.querySelectorAll('.sums-item'));
      return {
        docId: S.docId, all: S.all.length, scoped: scoped().length, books: els.list.querySelectorAll('.sums-book').length,
        heads: els.list.querySelectorAll('.sums-head').length, items: items.length,
        order: items.map((d) => d.getAttribute('data-kind') + ':' + d.getAttribute('data-id')),
        goto: els.list.querySelectorAll('[data-sa="goto"]').length, range: !els.range.hidden, rangeSel: S.range,
        rangeN: Number(els.rangeN.getAttribute('data-n')) || 0, make: !els.make.hidden, retry: !els.retry.hidden,
        outline: v ? { state: v.state, code: v.code, calls: v.calls, input: v.input, cached: v.cached, saved: !!v.saved, n: v.n, note: v.note ? v.note.key : null } : null,
        outlineShown: !els.outline.hidden, exportShown: !els.exportBtn.hidden, delOpen: !!(els.del && els.del.open),
        delTarget: delTarget != null, services: !!sumServices(), lastReveal: lastReveal, lastExport: lastExport,
        empty: !els.empty.hidden
      };
    }
  };
}
