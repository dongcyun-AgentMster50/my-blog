/* ============================================================
   MedReader — 문단 요약·범위 개요의 순수 함수 (spec 17-2-1 3 · 4-1 · 4-4 · 4-6 — 11-1)

   ── 순수 계층이다(3-1 · 3-2) ────────────────────────────
   `config.js` 만 import 한다. 브라우저 전역(DOM·저장소·네트워크)을 모른다(16-A grep 대상).
   **문장을 나누지 않는다** — 문장은 `tts/text.js` `sentencesOf(units)`(분할 한 벌 — 7-8-2 R6)가 낸 것을 받기만 한다.
   화면 문구를 만들지 않는다(내보내기 머리말도 호출자가 `labels` 로 준다).

   ── 한 문단 요약 · 쪽 요약 · 저장이 같은 글을 지난다 ─────
   `paraTextsOf(sentencesOf(쪽 단위))` 의 `text` 가 요청 글이자 캐시 키 글이자 저장 해시(`textHash`) 글이다.
   그래서 [이 쪽 전체 요약] 뒤 개별 문단 [요약]은 같은 키 → 0회(16-D5 · 17-2-1 6).
   ============================================================ */

import { SUMMARY } from '../config.js';

/** `tts/text.js` `TABLE_NOTICE_KIND` 와 같은 값(이 계층은 tts 를 import 하지 않는다 — 시험이 둘을 대조한다). */
export const TABLE_NOTICE = 'table-notice';

/** 코드포인트 단위 글자 수. */
export function charCount(s) {
  let n = 0;
  for (const ch of String(s == null ? '' : s)) { if (ch) n++; }
  return n;
}

/** 공백을 하나로 접고 앞뒤를 자른다. 문자열이 아니면 빈 문자열. */
export function clean(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

/** 코드포인트 단위로 앞 n 글자(넘으면 자르고 끝 공백을 걷는다). */
export function cutText(s, n) {
  const a = Array.from(String(s == null ? '' : s));
  return a.length > n ? a.slice(0, n).join('').trim() : String(s == null ? '' : s);
}

/* ────────────────────────────────────────────────────────
   1. 대상 정하기 (17-2-1 3)
   ──────────────────────────────────────────────────────── */

/**
 * 문장 목록(`sentencesOf(units)`) → 문단 글. `paraId` 가 같은 이웃 문장의 `src` 를 공백 하나로 잇는다.
 * 인용·표 안내는 `sentencesOf` 에서 이미 빠졌다(R3·R4). `paraId` 가 없는 문장은 문단으로 묶지 않는다(버린다).
 * 쪽을 넘는 문단은 그 쪽 조각만 — 조각이 짧으면 `eligible` 이 거른다(7-2 와 같은 태도).
 *
 * @param {{seg:number, src:string, paraId:string|null, kind?:string, frag?:string|null}[]} sentences
 * @returns {{paraId:string, text:string, n:number, chars:number, kind:string, frag:('head'|'tail'|null)}[]} 쪽 안 순서
 */
export function paraTextsOf(sentences) {
  const list = Array.isArray(sentences) ? sentences : [];
  const out = [];
  let cur = null;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s || s.paraId == null || s.paraId === '') { cur = null; continue; }
    const pid = String(s.paraId);
    const src = clean(s.src);
    if (!cur || cur.paraId !== pid) {
      cur = { paraId: pid, parts: [], n: 0, kind: s.kind || 'body', frag: null };
      out.push(cur);
    }
    if (src) { cur.parts.push(src); cur.n++; }
    if (s.frag === 'head' || s.frag === 'tail') cur.frag = cur.frag === 'head' ? 'head' : s.frag;
  }
  return out.filter((p) => p.n > 0).map((p) => {
    const text = p.parts.join(' ');
    return { paraId: p.paraId, text: text, n: p.n, chars: charCount(text), kind: p.kind, frag: p.frag };
  });
}

/** 요약할 수 있는 문단인가(17-2-1 3) — kind `body`·`list`, 문장 2개 이상, 글자 60자 이상. */
export function eligible(p) {
  if (!p || typeof p.text !== 'string') return false;
  if (SUMMARY.KINDS.indexOf(p.kind || 'body') < 0) return false;
  const n = Number.isFinite(p.n) ? p.n : 0;
  const chars = Number.isFinite(p.chars) ? p.chars : charCount(p.text);
  return n >= SUMMARY.MIN_SENTENCES && chars >= SUMMARY.MIN_CHARS;
}

/** 문장 단위(번호 `seg` 가 있다 — 표 안내·인용 아님)인가. */
function isSentence(u) {
  return !!u && Number.isInteger(u.seg) && u.kind !== TABLE_NOTICE && !u.cite;
}

/**
 * 음성 "요약"의 대상 문단(11-D12). `units` = 문장 단위 큐(`sentenceUnits()`), `i` = 지금 단위 번호.
 *   - 지금 문장이 그 문단의 **첫 문장**이고 앞 문장이 있으면 → 바로 앞 문단(방금 다 읽은 문단)
 *   - 문단 가운데 · 쪽 첫 문장(앞 문장 없음) → 지금 문단
 *   - 지금 단위가 표 안내·인용이면 → 가장 가까운 앞 문장의 문단(없으면 null)
 * 300자로 쪼갠 조각(같은 `seg`)은 한 문장이다.
 * @returns {string|null} paraId
 */
export function summaryTarget(units, i) {
  const list = Array.isArray(units) ? units : [];
  const at = Math.floor(Number(i));
  if (!Number.isFinite(at) || at < 0 || at >= list.length) return null;
  const u = list[at];
  if (!isSentence(u)) {
    for (let k = at - 1; k >= 0; k--) if (isSentence(list[k]) && list[k].paraId != null) return String(list[k].paraId);
    return null;
  }
  const pid = u.paraId == null ? null : String(u.paraId);
  for (let k = at - 1; k >= 0; k--) {
    const v = list[k];
    if (!isSentence(v) || v.seg === u.seg) continue;
    const prev = v.paraId == null ? null : String(v.paraId);
    return prev !== null && prev !== pid ? prev : pid;
  }
  return pid;
}

/** 설명할 수 있는 단위인가(11-4) — 문장 번호가 있고(표 안내·인용 아님) 글이 있다. 같은 언어여도 된다. */
export function explainable(u) {
  return isSentence(u) && clean(u.src) !== '';
}

/* ────────────────────────────────────────────────────────
   2. 응답 다듬기 — 트리 상한 · 숫자 거름 (4-1 · 4-6 · 11-D7)
   ──────────────────────────────────────────────────────── */

/**
 * 트리를 상한으로 **자른다**(실패 아님). 깊이마다 항목 수 `limits[d]`, 글자 `max`. 마지막 깊이는 문자열 배열.
 * 빈 글은 버린다. 깊이 0 에 문자열이 오면 `{t, sub:[]}` 로 받는다.
 * @param {*} points
 * @param {number[]} limits 예: 요약 [4, 3] · 개요 [8, 4, 3]
 * @param {number} max 한 줄 글자 상한
 * @returns {Array} 요약: `[{t, sub:[string]}]` · 개요: `[{t, sub:[{t, sub:[string]}]}]`
 */
export function trimTree(points, limits, max) {
  const lim = Array.isArray(limits) && limits.length ? limits : [SUMMARY.MAX_POINTS, SUMMARY.MAX_SUB];
  const cap = Number.isFinite(max) && max > 0 ? max : SUMMARY.POINT_MAX;
  function level(arr, d) {
    const out = [];
    const list = Array.isArray(arr) ? arr : [];
    const last = d === lim.length - 1;
    for (let k = 0; k < list.length && out.length < lim[d]; k++) {
      const node = list[k];
      const t = cutText(clean(typeof node === 'string' ? node : node && node.t), cap);
      if (!t) continue;
      if (last) out.push(t);
      else out.push({ t: t, sub: level(node && typeof node === 'object' ? node.sub : [], d + 1) });
    }
    return out;
  }
  return level(points, 0);
}

/** 글에 `allowed` 밖의 숫자 토큰이 있는가. `tokensOf` = 10-2 의 `numberTokens`(호출자가 준다 — 같은 함수). */
export function hasForeignNumber(text, allowed, tokensOf) {
  if (typeof tokensOf !== 'function') return false;
  const ok = allowed instanceof Set ? allowed : new Set(allowed || []);
  for (const n of tokensOf(String(text == null ? '' : text))) if (!ok.has(n)) return true;
  return false;
}

/**
 * 11-D7 숫자 거름 — 입력에 없는 숫자가 든 **줄만** 뺀다(그 아래 하위 줄도 함께). 깊이는 상관없다.
 * @returns {{points:Array, dropped:number}}
 */
export function pruneForeignNumbers(points, allowed, tokensOf) {
  let dropped = 0;
  function level(arr) {
    const out = [];
    for (const node of Array.isArray(arr) ? arr : []) {
      const t = typeof node === 'string' ? node : node && node.t;
      if (hasForeignNumber(t, allowed, tokensOf)) { dropped++; continue; }
      if (typeof node === 'string') out.push(node);
      else out.push(Object.assign({}, node, { sub: level(node.sub) }));
    }
    return out;
  }
  const out = level(points);
  return { points: out, dropped: dropped };
}

/* ────────────────────────────────────────────────────────
   3. 범위 개요 입력 (4-6 · 11-D19) — 저장한 요약에서만, 원문 문단 글은 넣지 않는다
   ──────────────────────────────────────────────────────── */

/** 저장 레코드의 읽기 순서 비교 — 쪽 → 쪽 안 문단 번호(`3:p12` 의 12) → 만든 시각. */
export function compareAnchor(a, b) {
  const pa = Number(a && a.pageNo) || 0;
  const pb = Number(b && b.pageNo) || 0;
  if (pa !== pb) return pa - pb;
  const na = paraNo(a);
  const nb = paraNo(b);
  if (na !== nb) return na - nb;
  return (Number(a && a.createdAt) || 0) - (Number(b && b.createdAt) || 0);
}

function paraNo(rec) {
  const pid = rec && rec.anchor && rec.anchor.paraId != null ? String(rec.anchor.paraId) : '';
  const m = pid.match(/:p(\d+)$/);
  return m ? Number(m[1]) : (rec && rec.kind === 'outline' ? -1 : Number.MAX_SAFE_INTEGER);
}

/**
 * 범위 개요의 DOC 항목·키 글. 입력 = 저장한 요약(대상 언어 요지 + 요점)뿐 — **원문 문단 글은 넣지 않는다**
 * (레코드에 원문이 있어도 읽지 않는다). 읽기 순서로 정렬한다.
 * @param {Object[]} list 저장한 `summary` 레코드
 * @param {{points?:boolean}} [opts] `points:false` 면 요지만(입력 초과 때 — 4-6)
 * @returns {{items:{i:number, gist:string, points?:Array}[], text:string, plain:string, ids:string[]}}
 *   `text` = 캐시 키 글(요약 id + 보낼 항목 — 같은 범위·같은 요약이면 같은 키), `plain` = 보낼 요지·요점 글만(글자 상한·숫자 거름의 기준 —
 *   id·번호의 숫자가 섞이지 않게)
 */
export function outlineInput(list, opts) {
  const withPoints = !(opts && opts.points === false);
  const recs = (Array.isArray(list) ? list : []).filter((r) => r && clean(r.gist)).slice().sort(compareAnchor);
  const items = [];
  const ids = [];
  const plain = [];
  const flat = (arr) => {
    for (const n of Array.isArray(arr) ? arr : []) {
      plain.push(typeof n === 'string' ? n : n.t);
      if (n && typeof n === 'object') flat(n.sub);
    }
  };
  for (let k = 0; k < recs.length; k++) {
    const r = recs[k];
    const it = { i: k, gist: clean(r.gist) };
    plain.push(it.gist);
    if (withPoints) { it.points = trimTree(r.points, [SUMMARY.MAX_POINTS, SUMMARY.MAX_SUB], SUMMARY.POINT_MAX); flat(it.points); }
    items.push(it);
    ids.push(String(r.id == null ? '' : r.id));
  }
  return { items: items, text: JSON.stringify({ ids: ids, items: items }), plain: plain.join('\n'), ids: ids };
}

/* ────────────────────────────────────────────────────────
   4. 다시 찾기 · 내보내기 (4-4 · 4-6)
   ──────────────────────────────────────────────────────── */

/**
 * 저장 요약의 문단을 지금 쪽 문단들에서 다시 찾는다 — 같은 `textHash` → 그 문단(같은 해시가 여럿이면 같은 `paraId` 를 먼저),
 * 없으면 `null`("문단 위치가 바뀜, 쪽 처음으로"). `paras` 의 각 항목에 `textHash` 가 있어야 한다(서비스가 채운다).
 * @param {{anchor:{textHash:string, paraId?:string}}} rec
 * @param {{paraId:string, textHash:string}[]} paras
 * @returns {Object|null}
 */
export function relocate(rec, paras) {
  const h = rec && rec.anchor && rec.anchor.textHash;
  if (!h) return null;
  const list = Array.isArray(paras) ? paras : [];
  const same = list.filter((p) => p && p.textHash === h);
  if (!same.length) return null;
  const pid = rec.anchor.paraId == null ? null : String(rec.anchor.paraId);
  return same.find((p) => String(p.paraId) === pid) || same[0];
}

/**
 * 저장한 요약·개요 → `.txt` 글(호출 0 — 4-6). UTF-8 BOM, CRLF, 책 제목 → (개요는 범위 머리에) → 쪽 라벨 → 요지 / 원문 언어 요지 /
 * 요점(들여쓰기 2칸씩) / 용어 "원어 — 대상 말". 화면 문구는 `labels` 로 받는다(이 계층은 i18n 을 모른다).
 * ★ 레코드의 요약 필드만 읽는다 — 원문 문단 글·캐시·키를 보지 않는다.
 * @param {Object[]} list `summary`·`outline` 레코드
 * @param {{page?:(rec:Object)=>string, range?:(rec:Object)=>string, untitled?:string, terms?:string}} [labels]
 * @returns {string}
 */
export function exportText(list, labels) {
  const L = labels || {};
  const page = typeof L.page === 'function' ? L.page : (r) => 'p. ' + (r.pageNo == null ? '?' : r.pageNo);
  const range = typeof L.range === 'function' ? L.range : (r) => (r.range && r.range.label) || page(r);
  const books = new Map();
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || (r.kind !== 'summary' && r.kind !== 'outline')) continue;
    const title = clean(r.docTitle) || L.untitled || '';
    const k = String(r.docId == null ? '' : r.docId) + '\u0001' + title;
    if (!books.has(k)) books.set(k, { title: title, recs: [] });
    books.get(k).recs.push(r);
  }
  const lines = [];
  const tree = (arr, depth) => {
    for (const n of Array.isArray(arr) ? arr : []) {
      const t = typeof n === 'string' ? n : n && n.t;
      if (clean(t)) lines.push('  '.repeat(depth) + '- ' + clean(t));
      if (n && typeof n === 'object') tree(n.sub, depth + 1);
    }
  };
  for (const b of books.values()) {
    if (lines.length) lines.push('');
    lines.push(b.title);
    const recs = b.recs.slice().sort((x, y) => {
      const fx = x.kind === 'outline' ? Number(x.range && x.range.from) || Number(x.pageNo) || 0 : Number(x.pageNo) || 0;
      const fy = y.kind === 'outline' ? Number(y.range && y.range.from) || Number(y.pageNo) || 0 : Number(y.pageNo) || 0;
      if (fx !== fy) return fx - fy;
      if (x.kind !== y.kind) return x.kind === 'outline' ? -1 : 1;      // 개요는 범위 머리에
      return compareAnchor(x, y);
    });
    for (const r of recs) {
      lines.push('');
      if (r.kind === 'outline') {
        lines.push('[' + range(r) + ']');
        if (clean(r.title)) lines.push(clean(r.title));
        tree(r.points, 1);
        continue;
      }
      lines.push('[' + page(r) + ']');
      if (clean(r.gist)) lines.push(clean(r.gist));
      if (clean(r.gistSrc)) lines.push(clean(r.gistSrc));
      tree(r.points, 1);
      const terms = (Array.isArray(r.terms) ? r.terms : []).filter((t) => t && clean(t.src) && clean(t.tr));
      if (terms.length) {
        if (L.terms) lines.push(L.terms);
        for (const t of terms) lines.push('  ' + clean(t.src) + ' — ' + clean(t.tr));
      }
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
