/* ============================================================
   MedReader — 의료 사이트 북마크 · 검색어 바로가기 (spec 17-9 · 13절 · 결정 E7)

   ── 순수 부분이다(16-A) ─────────────────────────────────
   화면 객체·전역 객체를 부르지 않는다. 예외 하나 — 주소 검사에 **`URL`**(Node·브라우저 공통 내장)을 쓴다
   (결정 18-D6 (가) · spec 3-2 예외 줄 — `hash.js` 의 `globalThis.crypto` 처럼 **존재 검사 후**). 없으면 주소는 모두 `url-bad`.
   `tests/links-18.test.mjs` 가 고정하고, 같은 시험의 grep 이 `URL` 말고 다른 전역이 없음을 본다.

   ★ 링크만 — 앱은 그 사이트에 아무것도 요청하지 않는다. 사용자가 누르면 새 탭이 열릴 뿐이다(화면 `ui/links.js`).
   ★ 검색어 길이는 8c-1 `clampSelection` 과 **같은 상수**(`SEL_LIMIT` — 6낱말·60자)를 읽는다(17-9 4 수용 기준).
   ============================================================ */

import { LINKS } from '../config.js';
import { SEL_LIMIT } from './select.js';

/** checkLink 가 내는 코드(i18n `links.err.*` 와 짝). */
export const LINK_CODES = Object.freeze({
  NAME_EMPTY: 'name-empty', NAME_LONG: 'name-long', URL_BAD: 'url-bad', URL_NOT_HTTPS: 'url-not-https',
  URL_USERINFO: 'url-userinfo', URL_LONG: 'url-long', TOO_MANY: 'too-many'
});

const Q = LINKS.QUERY;
/** 제어 문자(줄바꿈·탭 포함) — 주소 칸에 있으면 거절(`URL` 은 조용히 지운다 — 보이는 값과 여는 값이 달라지지 않게). */
const CTRL = /[\u0000-\u001f\u007f]/;

/** 주소 → `URL` 객체(없거나 못 읽으면 null). `{q}` 자리는 `x` 로 바꿔 본다. */
function parse(url, fill) {
  if (typeof URL !== 'function') return null;
  try { return new URL(String(url).split(Q).join(fill)); } catch (e) { return null; }
}

/**
 * 링크 하나를 검사한다. 이름 1–60자(앞뒤 공백 뗌) · 주소 ≤ 2,000자 · `{q}` → `x` 로 바꿔 `URL` 이 되고 `https:` ·
 * 사용자 정보(`user:pass@`) 없음 · 호스트 있음 · `{q}` 가 호스트에 있으면 안 됨(검색어가 다른 사이트 주소가 되지 않게).
 * 새로 더할 때는 `opts.count`(지금 목록 수)를 넘긴다 — 이미 `LINKS.MAX` 개면 `too-many`.
 * @param {{name?:string, url?:string}} link
 * @param {{count?:number}} [opts]
 * @returns {{ok:boolean, code:?string, name:string, url:string}}  name·url 은 앞뒤 공백을 뗀 값
 */
export function checkLink(link, opts) {
  const x = link || {};
  const name = String(x.name == null ? '' : x.name).trim();
  const url = String(x.url == null ? '' : x.url).trim();
  const fail = (code) => ({ ok: false, code: code, name: name, url: url });
  const count = opts && Number.isFinite(Number(opts.count)) ? Number(opts.count) : 0;
  if (count >= LINKS.MAX) return fail(LINK_CODES.TOO_MANY);
  if (!name) return fail(LINK_CODES.NAME_EMPTY);
  if (Array.from(name).length > LINKS.NAME_MAX) return fail(LINK_CODES.NAME_LONG);
  if (url.length > LINKS.URL_MAX) return fail(LINK_CODES.URL_LONG);
  if (!url || CTRL.test(url)) return fail(LINK_CODES.URL_BAD);
  const u = parse(url, 'x');
  if (!u) return fail(LINK_CODES.URL_BAD);
  if (u.protocol !== 'https:') return fail(LINK_CODES.URL_NOT_HTTPS);
  if (u.username || u.password) return fail(LINK_CODES.URL_USERINFO);
  if (!u.hostname) return fail(LINK_CODES.URL_BAD);
  if (url.includes(Q)) {
    const v = parse(url, 'y');
    if (!v || v.origin !== u.origin) return fail(LINK_CODES.URL_BAD);
  }
  return { ok: true, code: null, name: name, url: url };
}

/** 주소에 검색어 자리 `{q}` 가 있는가. */
export function hasQuery(url) {
  return String(url == null ? '' : url).includes(Q);
}

/**
 * `{q}` 자리마다 검색어를 `encodeURIComponent` 로 넣는다(`&`·`=`·`#` 도 글자로). `{q}` 가 없으면 주소 그대로.
 * 넣을 수 없는 글자(짝 잃은 서로게이트)면 null.
 * @returns {?string}
 */
export function fillQuery(url, q) {
  const s = String(url == null ? '' : url);
  if (!s.includes(Q)) return s;
  let enc;
  try { enc = encodeURIComponent(String(q == null ? '' : q)); } catch (e) { return null; }
  return s.split(Q).join(enc);
}

/**
 * 고른 글자 → 검색어. NFKC · 숨은 하이픈·폭 없는 공백 지움 · 공백 하나로 · 앞뒤 구두점(글자·숫자가 아닌 것) 뗌.
 * **6낱말·60자**(`SEL_LIMIT` — 8c-1 `clampSelection` 과 같은 상수)를 넘거나 비면 null.
 * @returns {?string}
 */
export function queryText(sel) {
  let s = String(sel == null ? '' : sel);
  try { s = s.normalize('NFKC'); } catch (e) { /* 그대로 */ }
  s = s.replace(/[­​﻿]/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}\p{M}]+$/u, '');
  if (!s) return null;
  const words = s.split(' ').length;
  const chars = Array.from(s).length;
  if (words > SEL_LIMIT.WORDS || chars > SEL_LIMIT.CHARS) return null;
  return s;
}

/**
 * 저장값 → 쓸 목록. `null`·`undefined`(손대지 않음) → 기본 목록 사본. 배열 → 그 배열(빈 배열 = 목록 없음, 기본으로 돌아가지 않음).
 * 배열 안의 항목은 **검사를 통과한 것만**(가져오기·옛 판이 넣은 이상한 값이 `href` 가 되지 않게), 최대 `LINKS.MAX` 개, id 겹침 없음.
 * @param {*} stored  설정 `links.medical`
 * @param {ReadonlyArray} [defaults]  기본 목록(시험용 — 없으면 `LINKS.DEFAULTS`)
 * @returns {{id:string, name:string, url:string}[]}
 */
export function effectiveLinks(stored, defaults) {
  const src = stored == null ? (Array.isArray(defaults) ? defaults : LINKS.DEFAULTS) : stored;
  if (!Array.isArray(src)) return [];
  const out = [];
  const seen = new Set();
  for (const it of src) {
    if (out.length >= LINKS.MAX) break;
    if (!it || typeof it !== 'object') continue;
    const c = checkLink(it);
    if (!c.ok) continue;
    let id = typeof it.id === 'string' && it.id ? it.id : 'l' + out.length;
    while (seen.has(id)) id = id + '_';
    seen.add(id);
    out.push({ id: id, name: c.name, url: c.url });
  }
  return out;
}

/** 검색어 바로가기(`{q}` 있는 링크)만. */
export function queryLinks(list) {
  return (Array.isArray(list) ? list : []).filter((l) => l && hasQuery(l.url));
}

/**
 * 서재 카드에서 누를 주소(결정 18-D5 (가)) — `{q}` 링크는 검색어가 없으니 그 사이트 첫 화면(`origin + '/'`), 아니면 주소 그대로.
 * 못 읽으면 null.
 * @returns {?string}
 */
export function homeUrl(url) {
  const s = String(url == null ? '' : url);
  if (!hasQuery(s)) return checkLink({ name: 'x', url: s }).ok ? s : null;
  const u = parse(s, 'x');
  return u && u.protocol === 'https:' ? u.origin + '/' : null;
}

/** 설정 목록에 작게 보일 호스트 이름(`{q}` → `x`). 못 읽으면 ''. */
export function hostOf(url) {
  const u = parse(url, 'x');
  return u ? u.hostname : '';
}

/**
 * `[찾아보기]` 계획 — 검색어와 갈 곳. 여는 주소는 **넣은 뒤 다시 검사를 통과한 것만**.
 * @param {ReadonlyArray} list  쓸 목록(`effectiveLinks`)
 * @param {string} selText  선택 스냅숏 글자
 * @returns {{show:boolean, query:?string, targets:{id:string, name:string, href:string}[]}}
 *   show = `{q}` 링크가 하나 이상 · query null = 흐림(너무 김·빈 글자) · targets 0 이면 열 곳 없음
 */
export function lookupPlan(list, selText) {
  const ql = queryLinks(list);
  const query = queryText(selText);
  const targets = [];
  if (query !== null) {
    for (const l of ql) {
      const href = fillQuery(l.url, query);
      if (href && checkLink({ name: l.name, url: href }).ok) targets.push({ id: l.id, name: l.name, href: href });
    }
  }
  return { show: ql.length > 0, query: query, targets: targets };
}

/* ── 목록 편집(설정 카드) — 모두 새 배열을 돌려준다 ─────────── */

/** 짧은 무작위 id — 목록 안에서 겹치지 않게. `rand` 는 [0,1) 수를 주는 함수(시험이 넘긴다 — 기본 `Math.random`). */
export function newLinkId(list, rand) {
  const r = typeof rand === 'function' ? rand : Math.random;
  const used = new Set((Array.isArray(list) ? list : []).map((l) => l && l.id));
  for (let i = 0; i < 50; i++) {
    const id = 'u' + Math.floor(r() * 2176782336).toString(36).padStart(6, '0');
    if (!used.has(id)) return id;
  }
  let n = used.size;
  while (used.has('u' + n)) n++;
  return 'u' + n;
}

/** 한 칸 위(-1)·아래(+1)로. 끝이면 그대로(같은 내용의 새 배열). */
export function moveLink(list, id, dir) {
  const a = (Array.isArray(list) ? list : []).slice();
  const i = a.findIndex((l) => l && l.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= a.length) return a;
  const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  return a;
}

/** 지우기. */
export function removeLink(list, id) {
  return (Array.isArray(list) ? list : []).filter((l) => l && l.id !== id);
}

/** 고치기(같은 id 자리) 또는 끝에 더하기. 값은 이미 `checkLink` 를 통과한 것. */
export function upsertLink(list, link) {
  const a = (Array.isArray(list) ? list : []).slice();
  const i = a.findIndex((l) => l && l.id === link.id);
  const v = { id: link.id, name: link.name, url: link.url };
  if (i >= 0) a[i] = v; else a.push(v);
  return a;
}
