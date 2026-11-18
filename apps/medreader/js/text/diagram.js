/* ============================================================
   MedReader — 그림 개념도의 순수 함수: 입력 줄 · 응답 검증 · 배치 (spec 17-14 2 · 3 — 16-1)

   ── 순수 계층이다(3-1 · 3-2 · 16-A grep 대상) ──────────────
   `config.js` 와 같은 순수 계층 `text/summary.js`(`clean`·`charCount`·`hasForeignNumber`)·`text/numexpr.js`(숫자 표현 덩어리 —
   15 `ai/grounding.js` 와 한 벌, 16-1R 중간-1)만 import 한다.
   브라우저 전역·시계·난수를 모른다. **같은 입력 → 같은 좌표**(시험 고정). 글자 폭은 주입 `measure(str, kind) → px`
   (Node 시험은 글자 수 × 고정 폭, 브라우저는 캔버스 `measureText` — 화면과 같은 글꼴 문자열; `kind` = 'label'|'src'|'edge').
   숫자 토큰은 10-2 의 `numberTokens` 를 **주입받는다**(`opts.tokensOf` — `ai/prompts.js` 가 넘긴다, 한 벌).

   ── 입력(16-D2) ────────────────────────────────────────
   저장한 개요(11c `kind:'outline'` 의 `points` — `[{t, sub:[{t, sub:[문자열]}]}]`)만. 요점마다 경로 꼬리표 `1`·`1.2`·`1.2.3`.
   레코드의 범위 이름(`range.label` — PDF 장 제목)·책 제목·개요 제목은 **읽지 않는다**(11-1R #5 — 지시문 자리 0).

   ── 배치(16-D4) ────────────────────────────────────────
     1. 고리 끊기   DFS(노드 입력 순서) — 뒤로 가는 엣지는 뒤집어 배치하고 `rev:true`(점은 위 → 아래 순 — 화살촉은 `rev` 면 첫 점 쪽)
     2. 층         가장 긴 경로 층(원천 = 0). 엣지 없는 노드는 맨 아래 "관련" 층에 개요 경로 깊이 순으로
     3. 가짜 노드   두 층 이상 건너는 엣지에 층마다 경유점(폭 0)
     4. 순서       무게중심 아래·위 번갈아 `SWEEPS` 번, 같은 값은 입력 순서. 교차 수가 가장 적은 판을 남김
     5. 줄바꿈     `wrapLabel` — 글 폭 ≤ NODE_MAX_W − 2·PAD_X, 낱말 단위 최대 3줄(넘으면 …), 원어는 아래 작은 한 줄
     6. 좌표       층 = 행(위 → 아래). 행 폭이 `maxW` 를 넘으면 같은 층 안에서 접는다(아래 줄 들여쓰기)
     7. 가운데 맞춤 행마다 가운데로. 엣지 라벨 = 선 길이의 가운데 점(겹치면 LABEL_NUDGE 씩 위·아래로 비킴)
     8. RTL       x' = W − x − w(노드) · W − x(점·라벨) — 층 방향은 그대로
   ============================================================ */

import { DIAGRAM } from '../config.js';
import { clean, charCount, hasForeignNumber } from './summary.js';
import { numberChunks, numberChunkUnits } from './numexpr.js';

/** 16-D5 관계 목록(고정 8개 — '치료' 없음). */
export const RELS = DIAGRAM.RELS;
/** 남은 관계가 `MIN_EDGES` 보다 적을 때의 실패 까닭(캐시하지 않는다 — 화면 "이 개요에서 관계를 찾지 못했습니다"). */
export const FEW_RELATIONS = 'few-relations';

const PATH_RE = /^\d+(?:\.\d+){0,2}$/;
const DIGIT = /\p{Nd}/u;
// 결합 부호 + ZWNJ(U+200C)·ZWJ(U+200D) — 보이지 않는 글자를 소스에 그대로 두지 않으려고 코드로 만든다.
const MARK = new RegExp('[\\p{M}' + String.fromCharCode(0x200C, 0x200D) + ']', 'u');

function arr(v) { return Array.isArray(v) ? v : []; }

/** id — 글자면 앞뒤 공백을 떼고, 정수면 글자로(모델이 `1` 처럼 줄 때). 그 밖은 빈 값. */
function idOf(v) {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isInteger(v)) return String(v);
  return '';
}

/** 경로 — `"1.2"`·`"[1.2]"`·`"1.2)"` → `"1.2"`. 정수 `1` → `"1"`(소수 `1.10` 은 받지 않는다 — `1.1` 과 구별이 안 된다). */
function pathOf(v) {
  let s = '';
  if (typeof v === 'string') s = v.trim().replace(/^[[(]+/, '').replace(/[\]).:]+$/, '');
  else if (typeof v === 'number' && Number.isInteger(v)) s = String(v);
  return PATH_RE.test(s) ? s : '';
}

/* ────────────────────────────────────────────────────────
   1. 입력 — 저장한 개요 → 경로 꼬리표 줄 (2)
   ──────────────────────────────────────────────────────── */

/**
 * 개요 직렬화. 줄 = `경로 + ' ' + 요점 글`(대상 언어 그대로). `depth` 2 면 3단 요점을 뺀다(입력 초과 때).
 * ★ `outline.points` 만 읽는다 — 범위 이름·책 제목·개요 제목·원문은 보지 않는다.
 * @param {{points?:Array}} outline 저장한 개요 레코드(또는 `{points}`)
 * @param {{depth?:1|2|3}} [opts]
 * @returns {{text:string, plain:string, lines:{p:string, t:string, d:number}[], paths:string[], depth:number, chars:number}}
 *   `text` = DOC 글(캐시 키 글) · `plain` = 요점 글만(숫자 거름의 기준 — 경로 꼬리표의 숫자가 섞이지 않게)
 */
export function outlineText(outline, opts) {
  const o = opts || {};
  const depth = o.depth === 1 || o.depth === 2 ? o.depth : 3;
  const lines = [];
  const walk = (list, prefix, d) => {
    const a = arr(list);
    for (let k = 0; k < a.length; k++) {
      const node = a[k];
      const t = clean(typeof node === 'string' ? node : node && typeof node === 'object' ? node.t : '');
      const p = prefix ? prefix + '.' + (k + 1) : String(k + 1);
      if (t) lines.push({ p: p, t: t, d: d });
      if (d < depth && node && typeof node === 'object') walk(node.sub, p, d + 1);
    }
  };
  walk(outline && outline.points, '', 1);
  const text = lines.map((l) => l.p + ' ' + l.t).join('\n');
  return {
    text: text, plain: lines.map((l) => l.t).join('\n'), lines: lines, paths: lines.map((l) => l.p),
    depth: depth, chars: charCount(text)
  };
}

/* ────────────────────────────────────────────────────────
   2. 응답 검증 (2 — 숫자 거름은 "보낸 개요 숫자 ⊆", 부호·% 를 지우지 않는다)
   ──────────────────────────────────────────────────────── */

// 16-1R 중간-1 고침 — 숫자 판정은 15 의 "숫자 표현 덩어리"(`text/numexpr.js` — `ai/grounding.js` 와 한 벌)로 한다.
// 라벨 안 덩어리 **각각이**(붙은 부호·비교 기호·이음·지수·단위 기호까지 글자 그대로) 보낸 개요 글의 어떤 덩어리와 같아야 한다.
// 그래서 범위·비율·×·지수·± 의 한쪽 끝만 남긴 라벨(`3–5 mg`→`5 mg` · `1:1000`→`1000` · `10^-6`→`10`)과
// 비교 기호 뒤집힘(`≤ −2.5`→`≥ −2.5` · `나트륨<135`→`나트륨>135`)·부호·% 지움(`< 135`→`135` · `30%`→`30`)은 모두 버린다.
// 비교 꼴(`chunkKey`)은 공백·NBSP 를 지우고 아랍-인도 숫자를 서방 숫자로, 위첨자 지수를 `^` 꼴로, 대시를 `-` 로만 접는다.
// 16-2b(16-2R 중간-1): 덩어리 바로 뒤 단위 토큰(`mg/kg/일`·`ملغ`·`/L`)까지 짝으로 본다 — `40 mg`→`40 g`·`3–5 mg/kg`→`3–5 mg`·
// 단위 뺌(`< 135 mEq/L`→`< 135`)도 버린다(소문자만 접음 · 동의어 표 없음 — 안전 쪽).

/** 코드포인트 j 가 숫자의 일부인가(숫자 · 숫자 사이 구분점). */
function inNum(a, j) {
  if (j < 0 || j >= a.length) return false;
  if (DIGIT.test(a[j])) return true;
  return /^[.,٫٬]$/u.test(a[j]) && j > 0 && j + 1 < a.length && DIGIT.test(a[j - 1]) && DIGIT.test(a[j + 1]);
}

/** 앞 n 글자로 자르되 경계가 숫자 가운데면 그 숫자 앞까지 물린다(반쪽 숫자를 보이지 않는다 — 11-1b `cutWhole` 과 같은 규칙). */
function cutLabel(s, n) {
  const a = Array.from(String(s == null ? '' : s));
  if (a.length <= n) return a.join('');
  let k = n;
  if (inNum(a, k) && inNum(a, k - 1)) { while (k > 0 && inNum(a, k - 1)) k--; }
  return a.slice(0, k).join('').trim();
}

/**
 * 응답 검증(순수). 순서: 노드(id 중복 — 첫 것만 · 빈 라벨 · 경로 밖 `p` · 숫자 거름 → 그 노드 버림, 라벨 ≤ 60자) →
 * 엣지(없는 노드 · 자기 고리 · `r` ∉ 목록 · 경로 밖 `p` · 같은 (a,b,r) → 버림) → 노드 > 12 면 엣지가 적은 것부터(같으면 뒤 것부터) 버림 →
 * 엣지 > 16 이면 앞 16 → 남은 엣지 < 2 → `failed('few-relations')`.
 * 원어(`src`)는 `withSrc` 일 때만, 입력 밖 숫자면 그 원어만 뺀다. 제목은 입력 밖 숫자면 빈 값.
 * @param {Object} input `outlineText` 결과(보낸 줄 — 깊이를 뺐으면 뺀 것) 또는 개요 레코드(그러면 3단 전부로 본다)
 * @param {*} value `jsonrepair` 가 돌려준 값 `{title, nodes:[{id,t,src?,p}], edges:[{a,b,r,p}]}`
 * @param {{tokensOf?:Function, withSrc?:boolean, rels?:string[]}} [opts] `tokensOf` = 10-2 `numberTokens`(없으면 숫자가 든 라벨은 모두 버린다 — 안전 쪽)
 * @returns {{state:'ok', value:{title:string, nodes:Object[], edges:Object[]}, dropped:Object}|{state:'failed', reason:string, dropped:Object}}
 */
export function checkDiagram(input, value, opts) {
  const o = opts || {};
  const src = input && Array.isArray(input.lines) ? input : outlineText(input);
  const paths = new Set(src.lines.map((l) => l.p));
  const plain = typeof src.plain === 'string' ? src.plain : src.lines.map((l) => l.t).join('\n');
  const tokensOf = typeof o.tokensOf === 'function' ? o.tokensOf : null;
  const withSrc = o.withSrc !== false;
  const rels = Array.isArray(o.rels) ? o.rels : RELS;
  const allowed = tokensOf ? tokensOf(plain) : new Set();
  const chunks = new Set(numberChunks(plain));
  // 16-2b — "덩어리 + 단위 토큰" 짝도 개요에 같은 꼴로 있어야 한다(단위 바꿈·뺌 모두 버림). 이름 속 숫자(`CD4`)는 덩어리만.
  const pairs = new Set(numberChunkUnits(plain).filter((x) => x.u !== null).map((x) => x.k + '|' + x.u));
  const foreign = (s) => {
    if (!tokensOf) return DIGIT.test(s);
    if (hasForeignNumber(s, allowed, tokensOf)) return true;
    for (const x of numberChunkUnits(s)) {
      if (!chunks.has(x.k)) return true;
      if (x.u !== null && !pairs.has(x.k + '|' + x.u)) return true;
    }
    return false;
  };
  const dropped = { nodes: 0, edges: 0, why: {} };
  const drop = (what, why) => { dropped[what]++; dropped.why[why] = (dropped.why[why] || 0) + 1; };
  const v = value && typeof value === 'object' ? value : {};

  const nodes = [];
  const seen = new Set();
  for (const raw of arr(v.nodes)) {
    const x = raw && typeof raw === 'object' ? raw : {};
    const id = idOf(x.id);
    if (!id || seen.has(id)) { drop('nodes', 'id'); continue; }
    seen.add(id);
    const full = clean(x.t);
    if (!full) { drop('nodes', 'empty'); continue; }
    const p = pathOf(x.p);
    if (!p || !paths.has(p)) { drop('nodes', 'path'); continue; }
    const t = cutLabel(full, DIAGRAM.LABEL_MAX);
    if (!t || foreign(full) || foreign(t)) { drop('nodes', 'digits'); continue; }
    const node = { id: id, t: t, p: p };
    if (withSrc) {
      const sf = clean(x.src);
      const sc = sf ? cutLabel(sf, DIAGRAM.LABEL_MAX) : '';
      if (sc && !foreign(sf) && !foreign(sc)) node.src = sc;
    }
    nodes.push(node);
  }

  const have = new Set(nodes.map((n) => n.id));
  let edges = [];
  const seenE = new Set();
  for (const raw of arr(v.edges)) {
    const x = raw && typeof raw === 'object' ? raw : {};
    const a = idOf(x.a);
    const b = idOf(x.b);
    const r = typeof x.r === 'string' ? x.r.trim() : '';
    const p = pathOf(x.p);
    if (!have.has(a) || !have.has(b)) { drop('edges', 'node'); continue; }
    if (a === b) { drop('edges', 'self'); continue; }
    if (rels.indexOf(r) < 0) { drop('edges', 'rel'); continue; }
    if (!p || !paths.has(p)) { drop('edges', 'path'); continue; }
    const key = a + '\u0001' + b + '\u0001' + r;
    if (seenE.has(key)) { drop('edges', 'dup'); continue; }
    seenE.add(key);
    edges.push({ a: a, b: b, r: r, p: p });
  }

  let kept = nodes;
  if (nodes.length > DIAGRAM.MAX_NODES) {
    const deg = new Map(nodes.map((n) => [n.id, 0]));
    for (const e of edges) { deg.set(e.a, deg.get(e.a) + 1); deg.set(e.b, deg.get(e.b) + 1); }
    const order = nodes.map((n, i) => ({ id: n.id, i: i, d: deg.get(n.id) }));
    order.sort((x, y) => x.d - y.d || y.i - x.i);
    const gone = new Set(order.slice(0, nodes.length - DIAGRAM.MAX_NODES).map((x) => x.id));
    kept = nodes.filter((n) => !gone.has(n.id));
    for (let k = 0; k < gone.size; k++) drop('nodes', 'cap');
    const before = edges.length;
    edges = edges.filter((e) => !gone.has(e.a) && !gone.has(e.b));
    for (let k = edges.length; k < before; k++) drop('edges', 'node');
  }
  if (edges.length > DIAGRAM.MAX_EDGES) {
    for (let k = DIAGRAM.MAX_EDGES; k < edges.length; k++) drop('edges', 'cap');
    edges = edges.slice(0, DIAGRAM.MAX_EDGES);
  }
  const tf = clean(v.title);
  const tc = tf ? cutLabel(tf, DIAGRAM.TITLE_MAX) : '';
  const title = tc && !foreign(tf) && !foreign(tc) ? tc : '';
  if (edges.length < DIAGRAM.MIN_EDGES) return { state: 'failed', reason: FEW_RELATIONS, dropped: dropped };
  return { state: 'ok', value: { title: title, nodes: kept, edges: edges }, dropped: dropped };
}

/* ────────────────────────────────────────────────────────
   3. 줄바꿈
   ──────────────────────────────────────────────────────── */

/** 글자 묶음(결합 부호·ZWJ/ZWNJ 는 앞 글자에 붙인다 — 아랍어 하라카트를 떼어 자르지 않는다). */
function clusters(s) {
  const out = [];
  for (const ch of String(s)) {
    if (out.length && MARK.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

function widthOf(measure, s, kind) {
  const w = Number(measure(String(s), kind));
  return Number.isFinite(w) && w > 0 ? w : 0;
}

/** 끝에 `…` 를 붙여 `maxW` 안에 들게 — 들 때까지 끝 글자 묶음을 뗀다(다 떼면 `…` 만). */
function withEllipsis(s, measure, maxW, kind, ell) {
  const c = clusters(s);
  let k = c.length;
  while (k > 0 && widthOf(measure, c.slice(0, k).join('').trimEnd() + ell, kind) > maxW) k--;
  return c.slice(0, k).join('').trimEnd() + ell;
}

/** 한 줄 안에 맞게 — 넘으면 끝을 줄이고 `…`. */
function fitLine(s, measure, maxW, kind, ell) {
  if (widthOf(measure, s, kind) <= maxW) return s;
  return withEllipsis(s, measure, maxW, kind, ell);
}

/**
 * 라벨 줄바꿈 — `measure` 로 `maxW` 안에서 낱말 단위, 최대 `maxLines` 줄(넘으면 마지막 줄 끝 `…`).
 * 혼자 `maxW` 보다 긴 낱말은 글자 묶음 단위로 끊어 다음 줄로 잇는다(줄 수 상한은 같다). 같은 입력 → 같은 줄.
 * @param {string} text
 * @param {{measure:(s:string, kind?:string)=>number, maxW:number, maxLines?:number, kind?:string, ellipsis?:string}} opts
 * @returns {string[]}
 */
export function wrapLabel(text, opts) {
  const o = opts || {};
  const measure = typeof o.measure === 'function' ? o.measure : (s) => charCount(s) * DIAGRAM.LAYOUT.CHAR_W;
  const maxW = Number(o.maxW) > 0 ? Number(o.maxW) : Infinity;
  const maxLines = Number.isInteger(o.maxLines) && o.maxLines > 0 ? o.maxLines : DIAGRAM.LAYOUT.MAX_LINES;
  const kind = o.kind || 'label';
  const ell = typeof o.ellipsis === 'string' ? o.ellipsis : DIAGRAM.LAYOUT.ELLIPSIS;
  const w = (s) => widthOf(measure, s, kind);
  const words = clean(text).split(' ').filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    if (w(word) > maxW) {
      if (cur) { lines.push(cur); cur = ''; }
      let piece = '';
      for (const c of clusters(word)) {
        if (piece && w(piece + c) > maxW) { lines.push(piece); piece = c; } else piece += c;
      }
      cur = piece;
      continue;
    }
    const cand = cur ? cur + ' ' + word : word;
    if (!cur || w(cand) <= maxW) cur = cand;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, maxLines - 1);
  head.push(withEllipsis(lines[maxLines - 1], measure, maxW, kind, ell));
  return head;
}

/* ────────────────────────────────────────────────────────
   4. 교차 수 · 배치
   ──────────────────────────────────────────────────────── */

function orient(a, b, c) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function polyCross(p, q) {
  for (let i = 0; i + 1 < p.length; i++) {
    for (let j = 0; j + 1 < q.length; j++) {
      if (orient(p[i], p[i + 1], q[j]) * orient(p[i], p[i + 1], q[j + 1]) < 0 &&
        orient(q[j], q[j + 1], p[i]) * orient(q[j], q[j + 1], p[i + 1]) < 0) return true;
    }
  }
  return false;
}

/**
 * 배치 결과의 교차 수 — 끝 노드를 함께 쓰지 않는 엣지 둘의 꺾은선이 **제대로 가로지르면**(끝점 닿음·겹침 아님) 1.
 * @param {{edges:{a:string, b:string, pts:number[][]}[]}} layout
 * @returns {number}
 */
export function crossings(layout) {
  const es = layout && Array.isArray(layout.edges) ? layout.edges : [];
  let c = 0;
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const x = es[i];
      const y = es[j];
      if (x.a === y.a || x.a === y.b || x.b === y.a || x.b === y.b) continue;
      if (polyCross(arr(x.pts), arr(y.pts))) c++;
    }
  }
  return c;
}

function boxHit(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * 층 배치. 노드 ≤ 12 라 O(n²) 로 충분하다. 같은 입력 → 같은 좌표.
 * @param {{nodes:{id:string, t:string, src?:string, p?:string}[], edges:{a:string, b:string, r:string}[]}} graph `checkDiagram` 의 값
 * @param {{measure?:Function, maxW?:number, rtl?:boolean, P?:Object, labelOf?:(r:string)=>string}} [opts]
 *   `maxW` = 그림 폭 상한(행이 넘으면 접는다 — 없으면 접지 않음) · `P` = `DIAGRAM.LAYOUT` 덮어쓰기 · `labelOf` = 엣지 라벨 글(폭 재기용)
 * @returns {{w:number, h:number, nodes:{id:string,x:number,y:number,w:number,h:number,lines:string[],srcLine:(string|null)}[],
 *           edges:{a:string,b:string,r:string,pts:number[][],lx:number,ly:number,rev:boolean}[], layers:string[][], related:number}}
 *   `pts` 는 위 → 아래 순(배치 방향). `rev` 면 원래 방향은 아래 → 위(화살촉을 첫 점 쪽에). `related` = 엣지 없는 노드 층 번호(없으면 −1).
 */
export function layoutDiagram(graph, opts) {
  const o = opts || {};
  const P = Object.assign({}, DIAGRAM.LAYOUT, o.P || {});
  const measure = typeof o.measure === 'function' ? o.measure : (s) => charCount(s) * P.CHAR_W;
  const maxW = Number(o.maxW) > 0 ? Number(o.maxW) : Infinity;
  const rtl = !!o.rtl;
  const labelOf = typeof o.labelOf === 'function' ? o.labelOf : (r) => String(r);
  const g = graph || {};

  const nodes = [];
  const index = new Map();
  for (const raw of arr(g.nodes)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = idOf(raw.id);
    if (!id || index.has(id)) continue;
    index.set(id, nodes.length);
    nodes.push({ id: id, t: clean(raw.t), src: clean(raw.src), p: typeof raw.p === 'string' ? raw.p : '' });
  }
  const n = nodes.length;
  const edges = [];
  for (const raw of arr(g.edges)) {
    if (!raw || typeof raw !== 'object') continue;
    const a = idOf(raw.a);
    const b = idOf(raw.b);
    if (!index.has(a) || !index.has(b) || a === b) continue;
    edges.push({ a: a, b: b, r: String(raw.r == null ? '' : raw.r), ai: index.get(a), bi: index.get(b) });
  }

  // 1. 고리 끊기 — DFS(노드 입력 순서, 엣지 입력 순서). 쌓인 노드로 돌아가는 엣지를 뒤집는다 → DAG.
  const outs = nodes.map(() => []);
  edges.forEach((e, k) => outs[e.ai].push(k));
  const state = new Array(n).fill(0);
  const rev = edges.map(() => false);
  const dfs = (u) => {
    state[u] = 1;
    for (const k of outs[u]) {
      const w = edges[k].bi;
      if (state[w] === 1) rev[k] = true;
      else if (state[w] === 0) dfs(w);
    }
    state[u] = 2;
  };
  for (let u = 0; u < n; u++) if (state[u] === 0) dfs(u);
  const from = edges.map((e, k) => (rev[k] ? e.bi : e.ai));
  const to = edges.map((e, k) => (rev[k] ? e.ai : e.bi));

  // 2. 층 — 가장 긴 경로(원천 0). 고리가 남아 있으면 끝나지 않는다(그래서 1 이 먼저다).
  const layer = new Array(n).fill(0);
  for (let changed = true; changed;) {
    changed = false;
    for (let k = 0; k < edges.length; k++) {
      if (layer[to[k]] < layer[from[k]] + 1) { layer[to[k]] = layer[from[k]] + 1; changed = true; }
    }
  }
  const deg = new Array(n).fill(0);
  for (const e of edges) { deg[e.ai]++; deg[e.bi]++; }
  let L = 0;
  for (let i = 0; i < n; i++) if (deg[i] > 0) L = Math.max(L, layer[i] + 1);

  // 3. 가짜 노드 — items: {node:i|-1, edge:k|-1, rank}
  const items = [];
  const rows = [];
  for (let l = 0; l < L; l++) rows.push([]);
  const itemOf = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (deg[i] === 0) continue;
    itemOf[i] = items.length;
    items.push({ node: i, edge: -1, rank: i });
    rows[layer[i]].push(itemOf[i]);
  }
  const chain = edges.map(() => []);
  for (let k = 0; k < edges.length; k++) {
    chain[k].push(itemOf[from[k]]);
    for (let l = layer[from[k]] + 1; l < layer[to[k]]; l++) {
      const it = items.length;
      items.push({ node: -1, edge: k, rank: n + k });
      rows[l].push(it);
      chain[k].push(it);
    }
    chain[k].push(itemOf[to[k]]);
  }
  const up = items.map(() => []);
  const down = items.map(() => []);
  const segs = rows.map(() => []);
  const rowOf = new Array(items.length).fill(-1);
  rows.forEach((r, l) => r.forEach((it) => { rowOf[it] = l; }));
  for (const c of chain) {
    for (let j = 0; j + 1 < c.length; j++) {
      down[c[j]].push(c[j + 1]);
      up[c[j + 1]].push(c[j]);
      segs[rowOf[c[j]]].push([c[j], c[j + 1]]);
    }
  }

  // 4. 순서 — 무게중심 훑기, 교차가 가장 적은 판
  const pos = new Array(items.length).fill(0);
  const setPos = () => rows.forEach((r) => r.forEach((it, x) => { pos[it] = x; }));
  const count = () => {
    let c = 0;
    for (const s of segs) {
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          if ((pos[s[i][0]] - pos[s[j][0]]) * (pos[s[i][1]] - pos[s[j][1]]) < 0) c++;
        }
      }
    }
    return c;
  };
  const reorder = (l, nb) => {
    const key = new Map();
    for (const it of rows[l]) {
      const ns = nb[it];
      key.set(it, ns.length ? ns.reduce((s, x) => s + pos[x], 0) / ns.length : pos[it]);
    }
    rows[l].sort((x, y) => key.get(x) - key.get(y) || items[x].rank - items[y].rank);
    rows[l].forEach((it, x) => { pos[it] = x; });
  };
  setPos();
  let best = rows.map((r) => r.slice());
  let bestC = count();
  for (let s = 0; s < P.SWEEPS && bestC > 0; s++) {
    if (s % 2 === 0) { for (let l = 1; l < L; l++) reorder(l, up); } else { for (let l = L - 2; l >= 0; l--) reorder(l, down); }
    const c = count();
    if (c < bestC) { bestC = c; best = rows.map((r) => r.slice()); }
  }
  for (let l = 0; l < L; l++) rows[l] = best[l];

  // 엣지 없는 노드 — 맨 아래 "관련" 층(개요 경로 깊이 → 입력 순서)
  const lone = [];
  for (let i = 0; i < n; i++) if (deg[i] === 0) lone.push(i);
  const depthOf = (p) => (p ? p.split('.').length : 9);
  lone.sort((x, y) => depthOf(nodes[x].p) - depthOf(nodes[y].p) || x - y);
  let related = -1;
  if (lone.length) {
    related = rows.length;
    rows.push(lone.map((i) => { itemOf[i] = items.length; items.push({ node: i, edge: -1, rank: i }); return itemOf[i]; }));
  }

  // 5. 줄바꿈 · 상자 크기
  const textMax = Math.max(1, P.NODE_MAX_W - 2 * P.PAD_X);
  const boxes = nodes.map((nd) => {
    const lines = wrapLabel(nd.t, { measure: measure, maxW: textMax, maxLines: P.MAX_LINES, ellipsis: P.ELLIPSIS });
    const srcLine = nd.src ? fitLine(nd.src, measure, textMax, 'src', P.ELLIPSIS) : null;
    let tw = 0;
    for (const l of lines) tw = Math.max(tw, widthOf(measure, l, 'label'));
    if (srcLine) tw = Math.max(tw, widthOf(measure, srcLine, 'src'));
    return {
      lines: lines, srcLine: srcLine,
      w: Math.max(P.MIN_NODE_W, Math.ceil(tw) + 2 * P.PAD_X),
      h: lines.length * P.LINE_H + (srcLine ? P.SRC_LINE_H : 0) + 2 * P.PAD_Y
    };
  });
  const wOf = (it) => (items[it].node >= 0 ? boxes[items[it].node].w : 0);
  const hOf = (it) => (items[it].node >= 0 ? boxes[items[it].node].h : 0);
  const gap = (x, y) => (items[x].node >= 0 && items[y].node >= 0 ? P.GAP_X : P.DUMMY_GAP);

  // 6. 좌표 — 행을 maxW 안으로 접는다(같은 층, 아래 줄 들여쓰기)
  const avail = maxW === Infinity ? Infinity : Math.max(1, maxW - 2 * P.MARGIN);
  const subs = [];
  let y = P.MARGIN;
  let lastBottom = P.MARGIN;
  for (let l = 0; l < rows.length; l++) {
    const mine = [];
    for (const it of rows[l]) {
      const cur = mine[mine.length - 1];
      if (cur) {
        const add = gap(cur.items[cur.items.length - 1], it) + wOf(it);
        if (cur.indent + cur.width + add <= avail) { cur.items.push(it); cur.width += add; continue; }
      }
      mine.push({ items: [it], indent: mine.length ? P.FOLD_INDENT : 0, width: wOf(it) });
    }
    if (!mine.length) continue;
    for (let k = 0; k < mine.length; k++) {
      const sr = mine[k];
      sr.h = Math.max(0, ...sr.items.map(hOf));
      sr.top = y;
      lastBottom = y + sr.h;
      y = lastBottom + (k + 1 < mine.length ? P.FOLD_GAP_Y : P.GAP_Y);
      subs.push(sr);
    }
  }
  const Wc = subs.reduce((m, s) => Math.max(m, s.indent + s.width), 0);
  const W = Wc + 2 * P.MARGIN;
  const H = lastBottom + P.MARGIN;
  const at = items.map(() => ({ x: 0, y: 0, cx: 0, cy: 0 }));
  for (const sr of subs) {
    let x = Math.round(P.MARGIN + (Wc - sr.indent - sr.width) / 2) + sr.indent;
    for (let j = 0; j < sr.items.length; j++) {
      const it = sr.items[j];
      const w = wOf(it);
      const h = hOf(it);
      at[it] = { x: x, y: sr.top + (sr.h - h) / 2, cx: x + w / 2, cy: sr.top + sr.h / 2 };
      if (j + 1 < sr.items.length) x += w + gap(it, sr.items[j + 1]);
    }
  }

  // 7. 꺾은선 · 라벨(선 길이 가운데 — 겹치면 비킴)
  const placed = nodes.map((nd, i) => {
    const a = at[itemOf[i]];
    return { x: a.x, y: a.y, w: boxes[i].w, h: boxes[i].h };
  });
  const outEdges = edges.map((e, k) => {
    const c = chain[k];
    const pts = c.map((it, j) => {
      const a = at[it];
      if (items[it].node < 0) return [a.cx, a.cy];
      return j === 0 ? [a.cx, a.y + hOf(it)] : [a.cx, a.y];
    });
    let total = 0;
    for (let j = 0; j + 1 < pts.length; j++) total += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]);
    let half = total / 2;
    let mid = pts[0];
    for (let j = 0; j + 1 < pts.length; j++) {
      const len = Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]);
      if (half <= len || j + 2 === pts.length) {
        const f = len > 0 ? Math.min(1, half / len) : 0;
        mid = [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
        break;
      }
      half -= len;
    }
    const lw = Math.ceil(widthOf(measure, labelOf(e.r), 'edge')) + 2 * P.LABEL_PAD_X;
    const lh = P.LABEL_H;
    const lx = Math.round(mid[0]);
    let ly = Math.round(mid[1]);
    const steps = [0, 1, -1, 2, -2, 3, -3];
    for (const s of steps) {
      const box = { x: lx - lw / 2, y: ly + s * P.LABEL_NUDGE - lh / 2, w: lw, h: lh };
      if (!placed.some((b) => boxHit(box, b))) { ly += s * P.LABEL_NUDGE; break; }
    }
    placed.push({ x: lx - lw / 2, y: ly - lh / 2, w: lw, h: lh });
    return { a: e.a, b: e.b, r: e.r, pts: pts, lx: lx, ly: ly, rev: rev[k] };
  });

  // 8. RTL 거울 — 층 방향(위 → 아래)은 그대로
  const outNodes = nodes.map((nd, i) => {
    const a = at[itemOf[i]];
    const w = boxes[i].w;
    return { id: nd.id, x: rtl ? W - a.x - w : a.x, y: a.y, w: w, h: boxes[i].h, lines: boxes[i].lines.slice(), srcLine: boxes[i].srcLine };
  });
  if (rtl) {
    for (const e of outEdges) {
      e.pts = e.pts.map((p) => [W - p[0], p[1]]);
      e.lx = W - e.lx;
    }
  }
  return {
    w: W, h: H, nodes: outNodes, edges: outEdges,
    layers: rows.map((r) => r.filter((it) => items[it].node >= 0).map((it) => nodes[items[it].node].id)),
    related: related
  };
}
