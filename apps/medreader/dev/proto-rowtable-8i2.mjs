/* ============================================================
   8i-2 Plan 시제품 — 본문 "이름표 | 설명" 2열 표 행 나누기 (spec 4-13-10) (2026-10-17)

   **앱 코드가 아니다.** `js/text/rowtable.js`(8i, 커밋 246e392 시점)를 그대로 복사한 뒤, spec 4-13-10 의
   제안 규칙을 **R.X8I2 옵션**으로 켜고 끌 수 있게 덧붙였다(옵션이 없으면 앱과 같은 동작). 측정은
   `dev/measure-rowtable-8i2.mjs --proto` 가 이 모듈의 `buildPageLayout8i2`(layout.js 의 파이프라인 사본)로 한다.
     X8I2 = { hidden(R3 f), grow(R1c·R1d·R7 좁힌 통로), split·rowGap(R5b), head·headFont(R6b), cap·secRole(역할),
              figBreak(R1b), xsplit(R2b) }   — 규칙 이름은 spec 4-13-10 3절. 모두 R 없는 표(2열)에만 걸린다.
   바꾼 곳은 `[8i-2 시제품]` 표시. 책 고유 x 좌표·글자 크기 절댓값·낱말을 쓰지 않는다.
   ============================================================ */

/* ============================================================
   MedReader — 7b 단계: 행 표("이름표 | (쪽 번호) | 산문")를 행 단위로 읽기 (spec 4-13)

   순수 모듈. 브라우저 전역(DOM·창)·전역 상태를 모른다. 입력은 7단계(`classifyRoles`)를 마친
   **내부 줄**(runs 가 items 를 든 것)이고, 출력은 그 줄 배열을 다시 짠 새 배열이다.

   ── 왜 ──────────────────────────────────────────────────
   4-5 는 거터를 하나만 고르고 왼쪽 단 전부 → 오른쪽 단 전부로 읽는다. "주제 | 쪽 번호 | 내용"
   세 열 표에서는 주제를 전부 읽은 뒤에야 내용을 읽고, 쪽 번호가 주제나 내용 줄에 붙는다
   ("& Pseudo- 1130"). 4-7 은 큰 글자 주제 줄을 줄마다 heading 으로 만들어 주제가 줄마다 끊긴다.
   4-8 은 조밀한 격자를 찾는 규칙이라 이 모양을 원리상 못 잡는다(4-13-1).

   ── 규칙 (spec 4-13-3 ~ 4-13-6 — 이름도 같다) ─────────────
     R1 띠      폭 > SPAN_RATIO×W 인 조각에서 띠를 끊는다.
     R2 열      띠 안 조각들이 비워 둔 세로 통로로 열을 나눈다. 통로 하나를 통째로 덮는 조각 = 가로지름.
     R3 판정    산문 열 P · 그 왼쪽 이름표 열 A · 전부 정수인 열 R. (a)–(e) 를 모두 만족해야 행 표.
     R4 칸      열마다 이웃 줄 간격 > CELL_GAP×행간이면 새 칸.
     R5 행      가로지름 = 단단한 경계(구획 행), P 없는 A 칸 = 홀로 선 행, 틈 없는 행 자르기,
                닻 사이 칸은 위 정렬(앞 닻으로) / 가운데 정렬(DP).
     R6 열 머리 표 맨 윗줄 바로 위(또는 띠 맨 윗줄)의 한 줄짜리 줄이 A 와 그 오른쪽 열 시작에 걸치면 열 머리.
     R7 물려받기 행 표 띠와 이웃한 띠를 그 열 경계로 다시 나눠, 같은 표의 행이면 행 표로 본다(같은 쪽 안, 연쇄).
   **책 고유 x 좌표·글자 크기 절댓값·머리 낱말을 쓰지 않는다.** 상수는 `config.ROWTABLE`(비율)뿐이다.
   시제품 `dev/proto-rowtable-8i.mjs` 의 규칙을 옮겼다 — 수치 대조는 `dev/measure-rowtable-8i.mjs`.

   ── 출력 (4-13-5) ───────────────────────────────────────
   행 표 띠의 줄을 **열별 줄**로 다시 만들어(4-5 `reassignByColumn` 의 일반화) 읽기 순서 배열의
   **띠 첫 줄 자리에 행 순서로** 끼운다:
     [열 머리] → 행마다 { A 칸 줄 → R 칸 줄 → P 칸 줄 } (구획 행·홀로 선 행은 제자리)
   새 줄: col 'rA'|'rR'|'rP'(구획 'rS', 그 밖 'rX'), role A·P→'body' · R→'ref' · 열 머리→'colhead' · 구획→'heading',
          rt = { t: 표 번호, row: 행 번호(표 안), cell: 'A'|'R'|'P'|'S'(구획)|'H'(열 머리)|'X'(그 밖), k: 그 행의 그 열 칸 번호 }
   줄 id 는 부르는 쪽(`layout.js`)이 다시 매긴다. **행 표가 없으면 입력 배열을 그대로 돌려준다**
   (한 바이트도 바뀌지 않는다 — 4-13 원칙 2).
   ============================================================ */

import { LAYOUT, ROWTABLE } from '../js/config.js';
import { joinText, lineBBox, normalizeItems, clusterLines, splitRuns } from '../js/text/lines.js';
import { detectColumns, reassignByColumn, orderLines } from '../js/text/columns.js';
import { classifyRoles, detectTables, groupParagraphs, columnMetrics } from '../js/text/blocks.js';
import { isLabelOnly } from '../js/text/blocks.js';
import { algoVersion } from '../js/text/layout.js';
import { endsSentence } from '../js/text/segment.js';

/* 시제품과 같은 중앙값(짝수 개면 위쪽) — 수치 대조가 어긋나지 않게 lines.js 의 평균형 중앙값을 쓰지 않는다. */
function med(a) {
  if (!a.length) return 0;
  const s = a.slice().sort(function (x, y) { return x - y; });
  return s[s.length >> 1];
}
const r10 = function (y) { return Math.round(y * 10) / 10; };
const trimLen = function (p) { return String(p.text).trim().length; };

/* ── 조각 ─────────────────────────────────────────────── */

/** 7단계를 마친 줄 → run 조각. 머리말·꼬리말·회전 줄과 쪽 위·아래 EDGE_ZONE 안의 줄은 뺀다. */
export function piecesOf(lines, pageInfo, R = ROWTABLE, P = LAYOUT) {
  const H = Number(pageInfo && pageInfo.height) || 0;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.role === 'rotated' || l.role === 'header' || l.role === 'footer') continue;
    if (H > 0 && (l.baseline > H * (1 - R.EDGE_ZONE) || l.baseline < H * R.EDGE_ZONE)) continue;
    const runs = l.runs || [];
    for (let k = 0; k < runs.length; k++) {
      const run = runs[k];
      out.push({
        x0: run.x0, x1: run.x1, y: l.baseline, fs: l.fontSize,
        text: run.text != null ? String(run.text) : joinText({ items: run.items || [] }, P),
        line: l, run: run, li: i, ri: k, pageno: l.role === 'pageno',
        cap: l.role === 'figure-caption'   // [8i-2 시제품] figBreak
      });
    }
  }
  out.sort(function (a, b) { return (b.y - a.y) || (a.x0 - b.x0) || (a.li - b.li) || (a.ri - b.ri); });
  return out;
}

/* R1 — 띠. 폭 > SPAN_RATIO×W 인 조각은 띠 경계이고 어느 띠에도 들지 않는다.
 * 4-13-3: pageno 줄은 표의 세로 범위 안에 있을 때만 넣는다 — 띠의 맨 위·맨 아래(다른 조각보다 바깥)에 있는
 * pageno 조각은 뺀다(쪽 자체의 쪽 번호). */
export function bandsOf(ps, W, R = ROWTABLE) {
  const out = [];
  let cur = [];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const X = R.X8I2 || {};
    const wide = W > 0 && p.x1 - p.x0 > R.SPAN_RATIO * W;
    // [8i-2 시제품] grow: 2열 표의 P 열 안에서 시작하는 넓은 조각은 띠를 끊지 않는다(R.KEEP_WIDE 가 판정) · figBreak: 캡션 줄은 띠를 끊는다
    if ((wide && !(R.KEEP_WIDE && R.KEEP_WIDE(p))) || (X.figBreak && p.cap)) { if (cur.length) out.push(cur); cur = []; continue; }
    cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out.map(function (b) {
    const ys = b.filter(function (p) { return !p.pageno; }).map(function (p) { return p.y; });
    if (!ys.length) return { ps: b.filter(function (p) { return !p.pageno; }) };
    const hi = Math.max.apply(null, ys), lo = Math.min.apply(null, ys);
    return { ps: b.filter(function (p) { return !p.pageno || (p.y < hi && p.y > lo); }) };
  });
}

/* R2·R4 — 열(통로)과 칸. `forced` 가 있으면 통로를 재지 않고 그 경계를 쓴다(R7). */
export function tracksOf(ps, forced, R = ROWTABLE) {
  const fs = med(ps.map(function (p) { return p.fs; })) || 8;
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < ps.length; i++) { if (ps[i].x0 < minX) minX = ps[i].x0; if (ps[i].x1 > maxX) maxX = ps[i].x1; }
  const cuts = forced ? forced.map(function (c) { return c.slice(); }) : [];
  if (!forced) {
    const n = Math.ceil(maxX - minX) + 1;
    const cover = new Uint16Array(Math.max(0, n));
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k];
      const a = Math.max(0, Math.floor(p.x0 - minX)), b = Math.min(n - 1, Math.ceil(p.x1 - minX));
      for (let i = a; i <= b; i++) cover[i]++;
    }
    const allow = Math.floor(R.CROSS_ALLOW * new Set(ps.map(function (p) { return p.line; })).size);
    let s = -1;
    for (let i = 0; i <= n; i++) {
      const e = i < n && cover[i] <= allow;
      if (e && s < 0) s = i;
      if (!e && s >= 0) { if (i - s >= R.CH_FACTOR * fs) cuts.push([minX + s, minX + i]); s = -1; }
    }
  }
  const T = cuts.concat([[Infinity, Infinity]]).map(function (c, k) {
    return { k: k, lo: k ? cuts[k - 1][1] : -Infinity, hi: c[0], ps: [], cross: [] };
  });
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    // 통로 하나를 통째로 덮는 조각 = 가로지름(구획 행) — 시작 열에 표시. 그 밖은 중심이 든 열.
    if (cuts.some(function (c) { return p.x0 < c[0] && p.x1 > c[1]; })) {
      T.find(function (t) { return p.x0 < t.hi; }).cross.push(p);
      continue;
    }
    const c = (p.x0 + p.x1) / 2;
    T.find(function (t) { return c < t.hi; }).ps.push(p);
  }
  for (let j = 0; j < T.length; j++) {
    const t = T[j];
    const ys = Array.from(new Set(t.ps.map(function (p) { return r10(p.y); }))).sort(function (a, b) { return b - a; });
    t.lines = ys.length;
    t.chars = t.ps.length ? t.ps.reduce(function (a, p) { return a + trimLen(p); }, 0) / t.ps.length : 0;
    t.intOnly = t.ps.length ? t.ps.filter(function (p) { return R.INT_ONLY.test(String(p.text).trim()); }).length / t.ps.length : 0;
    t.fs = med(t.ps.map(function (p) { return p.fs; })) || fs;
    const d = [];
    for (let i = 1; i < ys.length; i++) d.push(ys[i - 1] - ys[i]);
    t.lead = Math.min(med(d) || 1.2 * t.fs, R.LEAD_CAP * t.fs);
    t.cells = [];
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      const c = t.cells[t.cells.length - 1];
      const row = t.ps.filter(function (p) { return r10(p.y) === y; }).sort(function (a, b) { return a.x0 - b.x0; });
      if (c && c.bot - y <= R.CELL_GAP * t.lead) { c.bot = y; c.rows.push(row); }
      else t.cells.push({ top: y, bot: y, rows: [row] });
    }
    for (let i = 0; i < t.cells.length; i++) {
      const c = t.cells[i];
      c.yTop = c.top + R.ASC * t.fs; c.yBot = c.bot - R.DESC * t.fs;
    }
  }
  const res = T.filter(function (t) { return t.ps.length || t.cross.length; });
  res.fs = fs;                       // 띠 글자 크기 중앙값(R3 (b) 허용폭·R6 간격이 쓴다)
  return res;
}

/* R3 — 판정. 행 표면 { A, P, R }, 아니면 { why }. */
export function judge(T, R = ROWTABLE) {
  let P = null;
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t.chars >= R.PROSE_CHARS && t.intOnly < R.PROSE_INT_MAX && t.lines >= R.MIN_PROSE_LINES) P = t;   // 맨 오른쪽
  }
  if (!P) return { why: 'noP' };
  const As = T.filter(function (t) {
    return t.k < P.k && t.intOnly < R.LABEL_INT_MAX && t.chars < R.PROSE_CHARS && t.lines >= 1 && t.lines < R.SPARSE * P.lines;
  });
  if (!As.length) return { why: 'noA' };
  const A = As[0];
  if (!A.cells.length || !P.cells.length) return { why: 'noA' };
  // (b) 행 동기
  const tol = R.SYNC_TOL * (T.fs || P.fs);
  const pTop = P.cells[0].yTop, pBot = P.cells[P.cells.length - 1].yBot;
  const sync = A.cells.filter(function (c) { return c.yBot <= pTop + tol && c.yTop >= pBot - tol; }).length / A.cells.length;
  if (sync < R.SYNC) return { why: 'sync' };
  // (d) 번호 이름표 가드 — 4-8 라벨 가드와 같은 함수(blocks.js isLabelOnly)
  const lab = A.cells.filter(function (c) { return isLabelOnly(c.rows[0][0].text); }).length;
  if (lab >= R.LABEL_GUARD * A.cells.length) return { why: 'label' };
  // R6(4-13-6) 쪽 번호 열 — 칸 수·자릿수·값은 묻지 않는다
  const Rs = T.filter(function (t) { return t !== A && t !== P && t.intOnly >= R.REF_INT_MIN; });
  // (c) 그 밖에 조각이 2개 이상인 열이 없다(있으면 일반 다열 표 — 4-8 의 몫)
  const other = T.filter(function (t) { return t !== A && t !== P && Rs.indexOf(t) < 0 && t.ps.length > 1; });
  if (other.length) return { why: 'multi' };
  // (e) [D1 (가)] 쪽 번호 열이 있어야 한다
  if (R.REQUIRE_REF && !Rs.length) return { why: 'noRef' };
  // [8i-2 시제품] (f) 숨은 열 가드 — 2열 표(R 없음)에서 P 열 줄의 X.hidden 이상이 조각(run) 둘 이상이면 다열 표
  const X = R.X8I2 || {};
  if (!Rs.length) {
    const byY = new Map();
    for (const p of P.ps) { const k = r10(p.y); byY.set(k, (byY.get(k) || 0) + 1); }
    let multi = 0; for (const v of byY.values()) if (v >= 2) multi++;
    const ratio = byY.size ? multi / byY.size : 0;
    if (X.hidden && ratio >= X.hidden) return { why: 'hidden', hiddenRatio: ratio };
    return { A: A, P: P, R: Rs, sync: sync, hiddenRatio: ratio };
  }
  return { A: A, P: P, R: Rs, sync: sync };
}

/* ── R5 행 ────────────────────────────────────────────── */

const ov = function (c, d) { return Math.min(c.yTop, d.yTop) - Math.max(c.yBot, d.yBot); };
const ctr = function (top, bot) { return (top + bot) / 2; };
const fsOf = function (c) { return c.rows[0][0].fs || 8; };

function solve(ac, pc, R) {
  const empty = function (r) { return { mid: { rows: r }, top: { rows: r }, aligned: 0, anchors: 0 }; };
  if (!pc.length) return empty(ac.map(function (c) { return { a: [c], p: [], alone: true }; }));
  if (!ac.length) return empty([{ a: [], p: pc }]);
  // 0. 옆에 P 글이 전혀 없는 이름표 칸 = 홀로 선 행 — 닻이 아니다
  const alone = ac.filter(function (c) { return !pc.some(function (d) { return ov(c, d) > 0; }); });
  if (alone.length && alone.length < ac.length) {
    const sub = solve(ac.filter(function (c) { return alone.indexOf(c) < 0; }), pc, R);
    const ins = function (rows) {
      const out = rows.slice();
      for (let i = 0; i < alone.length; i++) {
        const c = alone[i];
        let k = out.findIndex(function (r) { return r.p.length ? r.p[0].top < c.top : r.a.length && r.a[0].top < c.top; });
        if (k < 0) k = out.length;
        out.splice(k, 0, { a: [c], p: [], alone: true });
      }
      return out;
    };
    return { mid: { rows: ins(sub.mid.rows) }, top: { rows: ins(sub.top.rows) }, aligned: sub.aligned, anchors: sub.anchors };
  }
  // 1. 틈 없는 행 — P 칸 하나 안에서 이름표 둘 이상이 시작하면 이름표 첫 줄 높이에서 P 칸을 자른다
  const cells = [];
  for (let j = 0; j < pc.length; j++) {
    const d = pc[j];
    const starts = ac.filter(function (c) {
      return c.top <= d.top + R.ALIGN_TOL * fsOf(c) && c.top >= d.bot - R.ALIGN_TOL * fsOf(c);
    }).sort(function (x, y) { return y.top - x.top; });
    if (starts.length < 2) { cells.push(d); continue; }
    let cur = [];
    const flush = function () {
      if (cur.length) {
        cells.push({ rows: cur, top: cur[0][0].y, bot: cur[cur.length - 1][0].y,
          yTop: cur[0][0].y + R.ASC * cur[0][0].fs, yBot: cur[cur.length - 1][0].y - R.DESC * cur[0][0].fs });
      }
      cur = [];
    };
    for (let i = 0; i < d.rows.length; i++) {
      const row = d.rows[i];
      if (cur.length && starts.some(function (c) {
        return (c !== starts[0] && Math.abs(row[0].y - c.top) <= R.ALIGN_TOL * fsOf(c)) ||
               (c !== starts[0] && row[0].y < c.top && cur[cur.length - 1][0].y > c.top);
      })) flush();
      cur.push(row);
    }
    flush();
  }
  // 2. 닻 — 이름표 칸마다 겹치는 P 칸 범위(없으면 가장 가까운 P 칸). 겹치는 닻은 합친다
  let blocks = ac.map(function (c) {
    const hit = [];
    for (let k = 0; k < cells.length; k++) if (ov(c, cells[k]) > 0) hit.push(k);
    let f, l;
    if (hit.length) { f = Math.min.apply(null, hit); l = Math.max.apply(null, hit); }
    else {
      let best = 0, bd = Infinity;
      for (let k = 0; k < cells.length; k++) {
        const d = cells[k];
        const dist = Math.min(Math.abs(d.yBot - c.yTop), Math.abs(c.yBot - d.yTop));
        if (dist < bd) { bd = dist; best = k; }
      }
      f = l = best;
    }
    return { a: [c], f: f, l: l };
  }).sort(function (x, y) { return (x.f - y.f) || (y.a[0].top - x.a[0].top); });
  const merged = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const m = merged[merged.length - 1];
    if (m && b.f <= m.l) { m.a.push.apply(m.a, b.a); m.l = Math.max(m.l, b.l); }
    else merged.push({ a: b.a.slice(), f: b.f, l: b.l });
  }
  blocks = merged;
  // 정렬 증거: 이름표 하나짜리 닻에서 이름표 첫 줄 = 첫 P 칸 첫 줄
  let aligned = 0, anchors = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.a.length === 1) { anchors++; if (Math.abs(b.a[0].top - cells[b.f].top) <= R.ALIGN_TOL * fsOf(b.a[0])) aligned++; }
  }
  const aTop = function (b) { return b.a[0].yTop; };
  const aBot = function (b) { return b.a[b.a.length - 1].yBot; };
  const n = blocks.length;
  // 3a. 가운데 정렬 — DP: 닻 사이 칸 묶음을 어디서 나눌지(이름표 중심 ≈ 행 P 범위 중심)
  const segLen = [];
  for (let i = 0; i < n - 1; i++) segLen.push(blocks[i + 1].f - blocks[i].l - 1);
  const costMid = function (i, sPrev, sNext) {
    const top = i === 0 ? cells[0].yTop : cells[blocks[i].f - (segLen[i - 1] - sPrev)].yTop;
    const bot = i === n - 1 ? cells[cells.length - 1].yBot : cells[blocks[i].l + sNext].yBot;
    return Math.abs(ctr(aTop(blocks[i]), aBot(blocks[i])) - ctr(top, bot));
  };
  let dp = new Map([[0, { c: 0, path: [] }]]);
  for (let i = 0; i < n; i++) {
    const nd = new Map();
    const kNext = i < n - 1 ? segLen[i] : 0;
    for (let sn = 0; sn <= kNext; sn++) {
      let best = null;
      dp.forEach(function (v, sp) {
        const c = v.c + costMid(i, sp, i < n - 1 ? sn : 0);
        if (!best || c < best.c) best = { c: c, path: v.path.concat([sn]) };
      });
      nd.set(sn, best);
    }
    dp = nd;
  }
  const mid = Array.from(dp.values()).sort(function (x, y) { return x.c - y.c; })[0];
  const midRows = [];
  let start = 0;
  blocks.forEach(function (b, i) {
    const end = i < n - 1 ? b.l + mid.path[i] + 1 : cells.length;
    midRows.push({ a: b.a, p: cells.slice(start, end) });
    start = end;
  });
  // 3b. 위 정렬 — 닻 사이 칸은 앞 닻으로, 맨 앞 칸들은 이름표 없는 행(앞 쪽에서 이어진 행)
  const topRows = [];
  if (blocks[0].f > 0) topRows.push({ a: [], p: cells.slice(0, blocks[0].f) });
  blocks.forEach(function (b, i) { topRows.push({ a: b.a, p: cells.slice(b.f, i < n - 1 ? blocks[i + 1].f : cells.length) }); });
  return { mid: { rows: midRows }, top: { rows: topRows }, aligned: aligned, anchors: anchors };
}

/** R5 — 한 띠의 행들. 가로지름(A·P 의 구획 조각)은 단단한 경계, 정렬 모형은 띠마다 한 번 고른다. */
/* [8i-2 시제품] R5b — 2열 표(R 없음)의 이름표 칸을 행 시작에서 자른다.
 * 이름표 칸의 둘째 줄 이후가 P 줄과 같은 높이이고, 그 P 줄이 P 칸 첫 줄이거나 바로 위 P 줄과의 간격이
 * X.rowGap × P 행간을 넘으면 거기서 새 이름표 칸. 옆에 P 줄이 없는 이름표 줄(묶음 제목)은 다음 줄이 행 시작이면
 * 그 자체로 한 칸이 되어 solve 의 "홀로 선 행"이 된다. */
function mkCell(rows, R) {
  const f = rows[0][0], l = rows[rows.length - 1][0];
  return { rows: rows, top: f.y, bot: l.y, yTop: f.y + R.ASC * (f.fs || 8), yBot: l.y - R.DESC * (f.fs || 8) };
}
function splitLabels(A, P, R) {
  const X = R.X8I2 || {};
  const pl = [];
  for (const c of P.cells) c.rows.forEach(function (row, i) { pl.push({ y: row[0].y, first: i === 0 }); });
  pl.sort(function (a, b) { return b.y - a.y; });
  const isStart = function (row) {
    const fs = row[0].fs || 8;
    const k = pl.findIndex(function (q) { return Math.abs(q.y - row[0].y) <= R.ALIGN_TOL * fs; });
    if (k < 0) return false;
    if (pl[k].first) return true;
    return k > 0 && pl[k - 1].y - pl[k].y > X.rowGap * P.lead;
  };
  const out = [];
  let nSplit = 0;
  for (const c of A.cells) {
    let cur = [];
    for (let i = 0; i < c.rows.length; i++) {
      if (i > 0 && isStart(c.rows[i])) { out.push(mkCell(cur, R)); cur = []; nSplit++; }
      cur.push(c.rows[i]);
    }
    if (cur.length) out.push(mkCell(cur, R));
  }
  return { cells: out, nSplit: nSplit };
}

export function rowsOf(det, R = ROWTABLE) {
  let A = det.A;
  const P = det.P;
  const X8 = R.X8I2 || {};
  if (X8.split && !det.R.length) {
    const sp = splitLabels(A, P, R);
    A = Object.assign({}, A, { cells: sp.cells });
    det.nSplit = sp.nSplit;
  }
  const crossPs = A.cross.concat(P.cross);
  const secs = Array.from(new Set(crossPs.map(function (p) { return p.y; }))).sort(function (x, y) { return y - x; });
  const bounds = [Infinity].concat(secs, [-Infinity]);
  const parts = [];
  for (let i = 1; i < bounds.length; i++) {
    const hi = bounds[i - 1], lo = bounds[i];
    const sec = i > 1 ? crossPs.filter(function (p) { return p.y === hi; }).sort(function (a, b) { return a.x0 - b.x0; }) : [];
    const pc = P.cells.filter(function (c) { return c.top < hi && c.top > lo; });
    const ac = A.cells.filter(function (c) { return c.top < hi && c.top > lo; });
    parts.push({ sec: sec, r: solve(ac, pc, R) });
  }
  let al = 0, an = 0;
  for (let i = 0; i < parts.length; i++) { al += parts[i].r.aligned; an += parts[i].r.anchors; }
  const useTop = an > 0 && al >= R.TOP_ALIGN_RATIO * an;
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const x = parts[i];
    if (x.sec.length) rows.push({ section: true, a: [], p: [], sec: x.sec });
    const rr = useTop ? x.r.top.rows : x.r.mid.rows;
    for (let k = 0; k < rr.length; k++) rows.push(rr[k]);
  }
  return {
    rows: rows.filter(function (r) { return r.section || r.a.length || r.p.length; }),
    align: useTop ? 'top' : 'mid'
  };
}

/* ── R7 물려받기 ──────────────────────────────────────── */

function inheritFrom(parent, ps, R) {
  const T0 = parent.T, d0 = parent.det;
  const cuts = [];
  for (let k = 0; k < T0.length - 1; k++) cuts.push([T0[k].hi, T0[k + 1].lo]);
  // [8i-2 시제품] 2열 부모: 통로를 오른쪽 끝(P 시작)으로 좁힌다 — 부모 띠의 이름표가 짧아 통로가 넓게 잡혔을 때
  // 더 긴 이름표("…leukemia (ALL)")가 중심으로 P 열에 들어가지 않게. 가로지름 = P 시작을 넘어 걸친 조각.
  if ((R.X8I2 || {}).grow && !d0.R.length) for (let k = 0; k < cuts.length; k++) cuts[k] = [cuts[k][1] - 0.01, cuts[k][1]];
  const T = tracksOf(ps, cuts, R);
  // 열은 k(경계 번호)로 찾는다 — 빈 열이 걸러져 배열 자리가 밀려도 같은 열을 가리키게
  const byK = function (k) { return T.find(function (t) { return t.k === k; }) || null; };
  const A = byK(d0.A.k), P = byK(d0.P.k);
  const Rs = d0.R.map(function (r) { return byK(r.k); }).filter(Boolean);
  // (b) A 조각 ≥ 1, P 조각 ≥ 1
  if (!A || !P || !A.ps.length || !P.ps.length) return { why: 'empty' };
  // (a) 모든 조각이 A·R·P 영역 안이거나 가로지름
  const others = T.filter(function (t) { return t !== A && t !== P && Rs.indexOf(t) < 0 && t.ps.length; });
  if (others.length) return { why: 'outside' };
  // (c) R 영역 조각은 전부 정수 꼴
  if (Rs.some(function (r) { return r.ps.some(function (q) { return !R.INT_ONLY.test(String(q.text).trim()); }); })) return { why: 'refText' };
  // (d) 옆에 P 가 있는 A 칸 중 줄 평균 < PROSE_CHARS 인 칸이 하나 이상
  const shortLabel = A.cells.some(function (c) {
    if (!P.cells.some(function (d) { return ov(c, d) > 0; })) return false;
    const len = c.rows.reduce(function (x, row) { return x + row.map(function (q) { return q.text; }).join(' ').trim().length; }, 0);
    return len / c.rows.length < R.PROSE_CHARS;
  });
  if (!shortLabel) return { why: 'noLabel' };
  // (e) 가로지름 조각 ≤ INH_CROSS × 띠 줄 수
  const nCross = T.reduce(function (a, t) { return a + t.cross.length; }, 0);
  const nLines = new Set(ps.map(function (q) { return q.line; })).size;
  if (nCross > R.INH_CROSS * nLines) return { why: 'cross' };
  return { T: T, det: { A: A, P: P, R: Rs, sync: 1 } };
}

/* [8i-2 시제품] 표 끝 자르기 — 부모 표의 열 경계로 볼 때 통로를 가로지르는 줄이 **두 줄 연달아** 나오면
 * 거기부터는 표가 아니다(표 아래·위 산문). dir: 'mid'(부모 조각이 든 구간) · 'below'(첫 연속 가로지름 앞까지) · 'above'(끝 연속 가로지름 뒤부터). */
function tailCut(parent, ps, R, dir) {
  const T0 = parent.T;
  const cuts = [];
  for (let k = 0; k < T0.length - 1; k++) cuts.push([T0[k].hi, T0[k + 1].lo]);
  const ys = Array.from(new Set(ps.map(function (p) { return r10(p.y); }))).sort(function (a, b) { return b - a; });
  const cy = new Set(ps.filter(function (p) { return cuts.some(function (c) { return p.x0 < c[0] && p.x1 > c[1]; }); }).map(function (p) { return r10(p.y); }));
  const run2 = ys.map(function (y, i) { return cy.has(y) && ((i > 0 && cy.has(ys[i - 1])) || (i + 1 < ys.length && cy.has(ys[i + 1]))); });
  let keepY;
  if (dir === 'below') { const f = run2.indexOf(true); keepY = new Set(f < 0 ? ys : ys.slice(0, f)); }
  else if (dir === 'above') { const l = run2.lastIndexOf(true); keepY = new Set(l < 0 ? ys : ys.slice(l + 1)); }
  else {
    const segs = []; let cur = [];
    for (let i = 0; i < ys.length; i++) { if (run2[i]) { if (cur.length) segs.push(cur); cur = []; } else cur.push(ys[i]); }
    if (cur.length) segs.push(cur);
    const pset = new Set(parent.ps);
    let bn = -1; keepY = new Set();
    for (const sg of segs) {
      const set = new Set(sg);
      const n = ps.filter(function (p) { return pset.has(p) && set.has(r10(p.y)); }).length;
      if (n > bn) { bn = n; keepY = set; }
    }
  }
  return { keep: ps.filter(function (p) { return keepY.has(r10(p.y)); }), rest: ps.filter(function (p) { return !keepY.has(r10(p.y)); }) };
}

/* [8i-2 시제품] R6b — 2열 표의 열 머리 행: 띠 맨 윗줄이 (1) P 조각과 P 밖 조각을 함께 가지고 (2) 조각마다 ≤ COLHEAD_MAX_CHARS,
 * P 글이 문장 끝이 아니고 (3) 바로 아래 P 줄이 행 시작(이름표 줄과 같은 높이이거나 간격 > rowGap×P 행간)이며
 * (4) [headFont 일 때] P 조각 글꼴이 아래 P 줄의 가장 흔한 글꼴과 다르다. */
function colheadTwo(band, R) {
  const X = R.X8I2 || {};
  const det = band.det;
  // 맨 윗 **P 줄**(그 위 이름표 열의 홀로 선 줄 — 캡션 둘째 줄 등 — 은 건너뛴다)
  let top = -Infinity;
  for (const p of det.P.ps) if (p.y > top) top = p.y;
  // P 줄 위에 이름표 열·구획(가로지름) 밖 조각이 있으면 아니다
  const crossAll = band.T.reduce(function (a, t) { return a.concat(t.cross); }, []);
  for (const p of band.ps) if (p.y > top && det.A.ps.indexOf(p) < 0 && crossAll.indexOf(p) < 0) return null;
  const G = band.ps.filter(function (p) { return Math.abs(p.y - top) < 0.5; });
  // P 조각 = P 열 안이고 P 열 왼끝(통로 끝) 이후에서 시작. 통로 안에서 시작하는 조각(가운데 둔 "Maneuver" 등)은 P 밖으로 본다.
  const tolX = R.ALIGN_TOL * (det.P.fs || 8);
  const inPcol = function (p) { return det.P.ps.indexOf(p) >= 0 && p.x0 >= det.P.lo - tolX; };
  const inP = G.filter(inPcol);
  const notP = G.filter(function (p) { return !inPcol(p); });
  if (!inP.length || !notP.length) return null;
  if (G.some(function (p) { return trimLen(p) > R.COLHEAD_MAX_CHARS; })) return null;
  const pText = inP.map(function (p) { return String(p.text).trim(); }).join(' ');
  if (endsSentence(pText)) return null;
  const below = det.P.ps.filter(function (p) { return p.y < top - 0.5; }).map(function (p) { return p.y; });
  if (!below.length) return null;
  const y1 = Math.max.apply(null, below);
  const aAt = det.A.ps.some(function (p) { return p.y < top - 0.5 && Math.abs(p.y - y1) <= R.ALIGN_TOL * (p.fs || 8); });
  if (!aAt && !(top - y1 > X.rowGap * det.P.lead)) return null;
  if (X.headFont) {
    const fontOf = function (p) { return ((p.run && p.run.items) || [])[0] ? p.run.items[0].fontName : null; };
    const cnt = new Map();
    for (const p of det.P.ps) if (p.y < top - 0.5) { const f = fontOf(p); cnt.set(f, (cnt.get(f) || 0) + 1); }
    const major = Array.from(cnt).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    if (inP.every(function (p) { return fontOf(p) === major; })) return null;
  }
  return G;
}

/* ── R6 열 머리 ───────────────────────────────────────── */

/* 띠 안: 띠 맨 윗줄이 (1) A 열의 한 줄짜리 칸 조각과 (2) A 열 오른쪽에서 시작하는 **산문 칸이 아닌** 조각
 * (통로를 덮는 가로지름이거나 정수가 아닌 R 열 조각)으로만 되어 있고 (3) 조각마다 글자 ≤ COLHEAD_MAX_CHARS(열 머리 칸 하나의 길이 — 합이 아니다: "Topic"+긴 열 이름 62자가 21쪽에서 실측).
 * 산문 칸 조각을 열 머리로 보지 않으므로 위 정렬 표의 첫 행(이름표 + 내용 첫 줄)을 먹지 않는다. */
function colheadInBand(band, R) {
  const det = band.det, T = band.T;
  let top = -Infinity;
  for (let i = 0; i < band.ps.length; i++) if (band.ps[i].y > top) top = band.ps[i].y;
  const G = band.ps.filter(function (p) { return Math.abs(p.y - top) < 0.5; });
  if (G.length < 2) return null;
  if (G.some(function (p) { return trimLen(p) > R.COLHEAD_MAX_CHARS; })) return null;
  const firstA = det.A.cells[0];
  let aRight = -Infinity;
  for (let i = 0; i < G.length; i++) if (det.A.ps.indexOf(G[i]) >= 0 && G[i].x1 > aRight) aRight = G[i].x1;
  let hasA = false, hasRight = false;
  for (let i = 0; i < G.length; i++) {
    const p = G[i];
    const inA = det.A.ps.indexOf(p) >= 0;
    const isCross = T.some(function (t) { return t.cross.indexOf(p) >= 0; });
    const inR = det.R.some(function (t) { return t.ps.indexOf(p) >= 0; });
    if (inA) { if (!firstA || firstA.rows.length !== 1 || firstA.rows[0].indexOf(p) < 0) return null; hasA = true; continue; }
    // A 조각 오른쪽에서 시작해 A 열 경계를 넘어가는 조각(통로를 덮는 가로지름 — A 통로 안에서 시작할 수 있다)
    // 이거나 정수가 아닌 R 열 조각. 산문(P) 칸 조각·정수 칸 조각이 섞이면 표의 첫 행이다.
    if (p.x0 > aRight && p.x1 > det.A.hi && (isCross || (inR && !R.INT_ONLY.test(String(p.text).trim())))) { hasRight = true; continue; }
    return null;
  }
  return hasA && hasRight ? G : null;
}

/* 띠 밖: 표 맨 윗줄 **바로 위** baseline 줄 묶음(사이에 다른 줄 없음)이 A 열 안에서 끝나는 run 과
 * A 열 오른쪽에서 시작하는 run 을 함께 가지고, 줄마다 글자 ≤ COLHEAD_MAX_CHARS, 간격 ≤ COLHEAD_GAP×글자 크기. */
function colheadAbove(lines, used, band, R) {
  const det = band.det;
  let top = -Infinity;
  for (let i = 0; i < band.ps.length; i++) if (band.ps[i].y > top) top = band.ps[i].y;
  let near = Infinity;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (used.has(l) || !(l.baseline > top)) continue;
    if (l.baseline < near) near = l.baseline;
  }
  if (!Number.isFinite(near) || near - top > R.COLHEAD_GAP * (band.T.fs || 8)) return null;
  const G = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (used.has(l) || Math.abs(l.baseline - near) > R.ALIGN_TOL * (l.fontSize || 8)) continue;
    if (l.role === 'rotated' || l.role === 'header' || l.role === 'footer' || l.role === 'pageno') return null;
    G.push(l);
  }
  let chars = 0, hasA = false, hasRight = false;
  for (let i = 0; i < G.length; i++) {
    chars = Math.max(chars, String(G[i].text || "").trim().length);
    const runs = G[i].runs || [];
    for (let k = 0; k < runs.length; k++) {
      if (runs[k].x1 <= det.A.hi) hasA = true;
      else if (runs[k].x0 >= det.A.hi) hasRight = true;
      else return null;                                // A 열 경계를 가로지르는 run — 열 머리 모양이 아니다
    }
  }
  if (chars > R.COLHEAD_MAX_CHARS || !hasA || !hasRight) return null;
  return G;
}

/* ── 줄 다시 만들기 ───────────────────────────────────── */

/* 4-5 makeLine 과 같은 규칙: items 는 x(같으면 idx) 순, fontSize 는 가장 넓은 아이템의 것. */
function makeLine(src, runs, col, role, rt, P) {
  const items = [];
  for (let i = 0; i < runs.length; i++) for (let k = 0; k < (runs[i].items || []).length; k++) items.push(runs[i].items[k]);
  items.sort(function (p, q) { return (p.x - q.x) || (p.idx - q.idx); });
  let fs = src.fontSize, maxW = -Infinity, maxIdx = Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.w > maxW || (it.w === maxW && it.idx < maxIdx)) { maxW = it.w; maxIdx = it.idx; fs = it.fontSize; }
  }
  const line = {
    items: items, baseline: src.baseline, fontSize: fs, col: col, role: role, runs: runs.slice(),
    text: '', bbox: null, hyphenJoin: false, paraId: null, regionId: null
  };
  line.text = joinText(line, P);
  line.bbox = lineBBox(line);
  if (rt) line.rt = rt;
  return line;
}

/* 조각 묶음 → 줄들(원래 줄이 같은 조각끼리 한 줄, 위→아래, 왼→오). */
function linesFromPieces(ps, col, role, rt, P) {
  const groups = [];
  const byLine = new Map();
  const sorted = ps.slice().sort(function (a, b) { return (b.y - a.y) || (a.x0 - b.x0) || (a.li - b.li) || (a.ri - b.ri); });
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (!byLine.has(p.line)) { byLine.set(p.line, groups.length); groups.push({ src: p.line, runs: [] }); }
    groups[byLine.get(p.line)].runs.push(p.run);
  }
  return groups.map(function (g) {
    return makeLine(g.src, g.runs, col, typeof role === 'function' ? role(g.src) : role, Object.assign({}, rt), P);
  });
}
const cellPieces = function (c) { const o = []; for (let i = 0; i < c.rows.length; i++) for (let k = 0; k < c.rows[i].length; k++) o.push(c.rows[i][k]); return o; };

/** 행의 세로 범위(A·P 칸의 합). 칸이 없으면 null. */
function rowSpan(r) {
  const cs = r.a.concat(r.p);
  if (!cs.length) return null;
  let top = -Infinity, bot = Infinity;
  for (let i = 0; i < cs.length; i++) { if (cs[i].yTop > top) top = cs[i].yTop; if (cs[i].yBot < bot) bot = cs[i].yBot; }
  return { top: top, bot: bot };
}

/* 띠 하나 → 새 줄 목록(행 순서). rowBase 는 표 안 행 번호의 시작. */
function emitBand(band, t, rowBase, colhead, P, R) {
  const det = band.det, T = band.T;
  const head = new Set(colhead || []);
  const out = [];
  const keep = function (ps) { return ps.filter(function (p) { return !head.has(p); }); };
  // 열 머리 조각을 뺀 칸만 남긴다(열 머리는 표 맨 위 한 줄짜리 A 칸이라 닻이 아니다 — 행 구성에 영향 없음)
  const rowsInfo = rowsOf(det, R);
  const rows = rowsInfo.rows.filter(function (r) {
    if (r.section) return keep(r.sec).length > 0;     // 열 머리 조각뿐인 구획(A 통로에서 시작한 열 머리 가로지름)은 뺀다
    const a = r.a.filter(function (c) { return keep(cellPieces(c)).length; });
    return a.length || r.p.length;
  });
  if (colhead && colhead.length) {
    for (const l of linesFromPieces(colhead, 'rX', 'colhead', { t: t, row: -1, cell: 'H', k: 0 }, P)) out.push({ y: Infinity, line: l });
  }
  // 쪽 번호 줄 → 행(세로로 든 행, 없으면 가장 가까운 행). 구획 행은 받지 않는다.
  const refByRow = new Map();
  const spans = rows.map(rowSpan);
  for (let j = 0; j < det.R.length; j++) {
    for (const c of det.R[j].cells) {
      for (const row of c.rows) {
        const y = row[0].y;
        let best = -1, bd = Infinity;
        for (let i = 0; i < rows.length; i++) {
          const s = spans[i];
          if (!s || rows[i].section) continue;
          const d = y <= s.top && y >= s.bot ? 0 : Math.min(Math.abs(y - s.top), Math.abs(y - s.bot));
          if (d < bd) { bd = d; best = i; }
        }
        if (best < 0) continue;
        if (!refByRow.has(best)) refByRow.set(best, []);
        for (const p of row) refByRow.get(best).push(p);
      }
    }
  }
  const placed = new Set();
  let rowNo = rowBase;
  const rowLines = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nr = rowNo++;
    const ls = [];
    if (r.section) {
      // [8i-2 시제품] secRole: 2열 표의 구획 줄은 7단계 역할을 지킨다(표 제목 'TABLE …' 이 heading 이 되지 않게)
      const secRole = ((R.X8I2 || {}).secRole && !det.R.length) ? function (s) { return s.role === 'heading' || s.role === 'figure-caption' ? s.role : 'body'; } : 'heading';
      for (const l of linesFromPieces(keep(r.sec), 'rS', secRole, { t: t, row: nr, cell: 'S', k: 0 }, P)) ls.push(l);
      keep(r.sec).forEach(function (p) { placed.add(p); });
    } else {
      r.a.forEach(function (c, k) {
        const ps = keep(cellPieces(c));
        ps.forEach(function (p) { placed.add(p); });
        // [8i Review] 홀로 선 이름표 칸(옆에 내용 없음 — 표 안에 든 짧은 장 제목 "CHAPTER 44: …" 등)은 7단계 역할이
        // heading 이면 heading 으로 둔다(8i 전과 같은 화면·목차). 내용이 있는 이름표 칸은 body(→ 문단 kind rowhead).
        const role = r.alone ? function (s) { return s.role === 'heading' || ((R.X8I2 || {}).cap && !det.R.length && s.role === 'figure-caption') ? s.role : 'body'; } : 'body';
        for (const l of linesFromPieces(ps, 'rA', role, { t: t, row: nr, cell: 'A', k: k }, P)) ls.push(l);
      });
      const refs = refByRow.get(i) || [];
      refs.forEach(function (p) { placed.add(p); });
      for (const l of linesFromPieces(refs, 'rR', 'ref', { t: t, row: nr, cell: 'R', k: 0 }, P)) ls.push(l);
      r.p.forEach(function (c, k) {
        const ps = cellPieces(c);
        ps.forEach(function (p) { placed.add(p); });
        for (const l of linesFromPieces(ps, 'rP', 'body', { t: t, row: nr, cell: 'P', k: k }, P)) ls.push(l);
      });
    }
    const s = spans[i];
    const y = r.section ? r.sec[0].y : (s ? s.top : -Infinity);
    rowLines.push({ y: y, lines: ls });
  }
  // 그 밖 조각(A·R·P 밖의 한 조각짜리 열, A·P 밖 열의 가로지름) — 잃지 않는다. 제자리(y 순)에 끼운다.
  const stray = [];
  for (let j = 0; j < band.ps.length; j++) {
    const p = band.ps[j];
    if (placed.has(p) || head.has(p)) continue;
    stray.push(p);
  }
  const strayRows = [];
  if (stray.length) {
    const byY = new Map();
    for (const p of stray) { const k = r10(p.y); if (!byY.has(k)) byY.set(k, []); byY.get(k).push(p); }
    for (const [y, ps] of byY) {
      const isCross = ps.every(function (p) { return T.some(function (t) { return t.cross.indexOf(p) >= 0; }); });
      strayRows.push({ y: y, lines: linesFromPieces(ps, 'rX', isCross ? 'heading' : 'body', { t: t, row: rowNo++, cell: 'X', k: 0 }, P) });
    }
  }
  // 행 순서는 rowsOf 그대로, 그 밖 조각은 y 로 끼운다
  const seq = rowLines.slice();
  strayRows.sort(function (a, b) { return b.y - a.y; });
  for (const s of strayRows) {
    let k = seq.findIndex(function (r) { return r.y < s.y; });
    if (k < 0) k = seq.length;
    seq.splice(k, 0, s);
  }
  for (const o of out) seq.unshift({ y: Infinity, lines: [o.line] });
  const lines = [];
  for (const s of seq) for (const l of s.lines) lines.push(l);
  return { lines: lines, rows: rowNo - rowBase, align: rowsInfo.align };
}

/* ── 7b 진입점 ────────────────────────────────────────── */

/**
 * spec 4-13 — 7b 단계. 행 표가 있으면 새 줄 배열을, 없으면 **입력 배열 그대로**를 돌려준다.
 *
 * @param {Array}  lines    7단계를 마친 읽기 순서 줄(내부 줄 — runs 가 items 를 든다)
 * @param {Object} pageInfo { width, height }
 * @param {Object} params   LAYOUT (joinText 에 쓴다)
 * @param {Object} R        ROWTABLE
 * @returns {{lines:Array, tables:Array}} tables: 진단(띠마다 { t, inherited, rows, refCells, align, colhead })
 */
export function detectRowTables(lines, pageInfo = {}, params = LAYOUT, R = ROWTABLE) {
  const P = params || LAYOUT;
  const src = Array.isArray(lines) ? lines : [];
  const none = { lines: src, tables: [], reject: [] };
  if (!R || !R.ENABLED || !src.length) return none;
  const W = Number(pageInfo && pageInfo.width) || 0;
  const ps = piecesOf(src, pageInfo, R, P);
  if (!ps.length) return none;
  const reject = [];
  // 1차 — 띠마다 R3
  const BS = bandsOf(ps, W, R).map(function (b) {
    if (b.ps.length < R.MIN_PIECES) return { ps: b.ps, det: null };
    const T = tracksOf(b.ps, null, R);
    if (T.length < 2) return { ps: b.ps, T: T, det: null };
    const j = judge(T, R);
    if (!j.A) { reject.push(j.why); return { ps: b.ps, T: T, det: null }; }
    return { ps: b.ps, T: T, det: j };
  });
  if (!BS.some(function (b) { return b.det; })) return Object.assign({}, none, { reject: reject });
  const X = R.X8I2 || {};
  const judgeBand = function (b) {
    if (b.ps.length < R.MIN_PIECES) return { ps: b.ps, det: null };
    const T = tracksOf(b.ps, null, R);
    if (T.length < 2) return { ps: b.ps, T: T, det: null };
    const j = judge(T, R);
    if (!j.A) { reject.push(j.why); return { ps: b.ps, T: T, det: null }; }
    return { ps: b.ps, T: T, det: j };
  };
  const topY = function (b) { let t = -Infinity; for (const p of b.ps) if (p.y > t) t = p.y; return t; };
  // [8i-2 시제품] grow — 2열 표가 있으면 그 표의 P 열 안에서 시작하는 넓은 조각은 띠를 끊지 않게 하여 띠를 다시 만든다.
  // 합쳐진 띠는 그 2열 표의 열 경계로 다시 나누고(R7 과 같은 검사) 표 끝 자르기를 한다. 실패하면 1차 띠 그대로.
  if (X.grow) {
    const ends = [];
    for (const b of BS) if (b.det && !b.det.R.length) { const k = b.T.indexOf(b.det.A); if (b.T[k + 1]) ends.push(b.T[k + 1].lo); }
    if (ends.length) {
      const fsAll = med(ps.map(function (p) { return p.fs; })) || 8;
      const R2 = Object.assign({}, R, { KEEP_WIDE: function (p) { return ends.some(function (e) { return p.x0 >= e - R.ALIGN_TOL * fsAll; }); } });
      const B2 = bandsOf(ps, W, R2);
      const old = BS.slice();
      const pieceBand = new Map();
      old.forEach(function (b, i) { b.ps.forEach(function (p) { pieceBand.set(p, i); }); });
      const out = [];
      const pushOld = function (idx) { for (const i of idx) if (out.indexOf(old[i]) < 0) out.push(old[i]); };
      for (const nb of B2) {
        const idx = Array.from(new Set(nb.ps.map(function (p) { return pieceBand.get(p); }).filter(function (i) { return i != null; }))).sort(function (a, b) { return a - b; });
        const extra = nb.ps.some(function (p) { return !pieceBand.has(p); });
        const par = idx.map(function (i) { return old[i]; }).find(function (b) { return b.det && !b.det.R.length; });
        if (!par || (idx.length <= 1 && !extra)) { pushOld(idx); continue; }
        const seg = tailCut(par, nb.ps, R, 'mid');
        const got = seg.keep.length ? inheritFrom(par, seg.keep, R) : { why: 'empty' };
        if (!got.det) { pushOld(idx); continue; }
        out.push({ ps: seg.keep, T: got.T, det: got.det, grown: true });
        if (seg.rest.length) for (const rb of bandsOf(seg.rest, W, R)) out.push(judgeBand(rb));
      }
      // 1차 띠 중 새 띠 어디에도 들지 않은 것(조각이 모두 넓은 띠 경계였던 경우는 없다 — 방어)
      for (const b of old) if (out.indexOf(b) < 0 && !b.ps.some(function (p) { return out.some(function (o) { return o.ps.indexOf(p) >= 0; }); })) out.push(b);
      out.sort(function (a, b) { return topY(b) - topY(a); });
      BS.length = 0;
      for (const b of out) BS.push(b);
    }
  }
  // 2차 — R7 물려받기(같은 쪽 안, 연쇄)
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < BS.length; i++) {
      if (BS[i].det) continue;
      for (const j of [i - 1, i + 1]) {
        const par = BS[j];
        if (!par || !par.det) continue;
        // [8i-2 시제품] 2열 부모면 표 끝 자르기 뒤에 물려받는다 — 남은 조각은 표 밖 띠로 둔다
        let cand = BS[i].ps, rest = [];
        if (X.grow && !par.det.R.length) { const sg = tailCut(par, cand, R, j < i ? 'below' : 'above'); cand = sg.keep; rest = sg.rest; }
        const got = cand.length ? inheritFrom(par, cand, R) : { why: 'empty' };
        if (!got.det) { if (got.why === 'cross') reject.push('inheritCross'); continue; }
        BS[i] = { ps: cand, T: got.T, det: got.det, inherited: true, parent: par };
        if (rest.length) BS.splice(j < i ? i + 1 : i, 0, { ps: rest, det: null });
        changed = true;
        break;
      }
    }
  }
  // 표 번호: R3 로 잡힌 띠마다 새 표, 물려받은 띠는 부모의 표
  let tNext = 0;
  for (const b of BS) if (b.det && !b.inherited) b.t = tNext++;
  for (let guard = 0; guard < BS.length; guard++) for (const b of BS) if (b.det && b.inherited && b.t == null && b.parent.t != null) b.t = b.parent.t;

  // [8i-2 시제품] xsplit — 2열 표에서 P 시작을 넘어 걸친 run(이름표와 설명이 한 run 으로 붙은 줄)을 아이템 경계에서 둘로 나눈다.
  // 아이템 하나가 P 시작 이후에서 시작하고 바로 앞 아이템이 P 시작 전에 끝나면 거기서 자른다. 열(칸)은 다시 만든다.
  if (X.xsplit) {
    for (const b of BS) {
      if (!b.det || b.det.R.length) continue;
      const P0 = b.det.P, lo = P0.lo;
      if (!Number.isFinite(lo)) continue;
      const tolX = R.ALIGN_TOL * (P0.fs || 8);
      let changed = false;
      const nps = [];
      for (const p of b.ps) {
        const its = (p.run.items || []).slice().sort(function (u, v) { return (u.x - v.x) || (u.idx - v.idx); });
        let cut = -1;
        if (p.x0 < lo - tolX && p.x1 > lo) {
          for (let i = 1; i < its.length; i++) if (its[i].x >= lo - tolX && its[i - 1].x + (its[i - 1].w || 0) <= lo) { cut = i; break; }
        }
        if (cut < 0) { nps.push(p); continue; }
        const mk = function (items) {
          let x0 = Infinity, x1 = -Infinity;
          for (const it of items) { if (it.x < x0) x0 = it.x; if (it.x + (it.w || 0) > x1) x1 = it.x + (it.w || 0); }
          const run = { x0: x0, x1: x1, items: items };
          run.text = joinText({ items: items }, P);
          return Object.assign({}, p, { x0: x0, x1: x1, run: run, text: run.text, origRun: p.run });
        };
        nps.push(mk(its.slice(0, cut)), mk(its.slice(cut)));
        changed = true;
      }
      if (!changed) continue;
      const cuts = [];
      for (let k = 0; k < b.T.length - 1; k++) cuts.push([b.T[k].hi, b.T[k + 1].lo]);
      const T = tracksOf(nps, cuts, R);
      const ia = b.T.indexOf(b.det.A), ip = b.T.indexOf(b.det.P);
      const A = T.find(function (t) { return t.k === ia; }), P2 = T.find(function (t) { return t.k === ip; });
      if (A && P2 && A.ps.length && P2.ps.length) { b.ps = nps; b.T = T; b.det = Object.assign({}, b.det, { A: A, P: P2, R: [] }); b.xsplit = true; }
    }
  }
  const tableBands = BS.filter(function (b) { return b.det; });
  const used = new Set();
  for (const b of tableBands) for (const p of b.ps) used.add(p.line);
  // R6 열 머리 — 띠 안 맨 윗줄, 아니면 띠 바로 위 줄
  const headAbove = new Map();
  for (const b of tableBands) {
    b.colhead = colheadInBand(b, R);
    // [8i-2 시제품] R6b — 2열 표 열 머리. 머리 조각을 뺀 조각으로 열(칸)을 다시 만든다.
    if (!b.colhead && X.head && !b.det.R.length && !b.inherited) {
      const G = colheadTwo(b, R);
      if (G) {
        const gs = new Set(G);
        const cuts = [];
        for (let k = 0; k < b.T.length - 1; k++) cuts.push([b.T[k].hi, b.T[k + 1].lo]);
        const T = tracksOf(b.ps.filter(function (p) { return !gs.has(p); }), cuts, R);
        const ia = b.T.indexOf(b.det.A), ip = b.T.indexOf(b.det.P);
        const A = T.find(function (t) { return t.k === ia; }), P2 = T.find(function (t) { return t.k === ip; });
        if (A && P2 && A.ps.length && P2.ps.length) { b.T = T; b.det = Object.assign({}, b.det, { A: A, P: P2, R: [] }); b.colhead = G; b.head2 = true; }
      }
    }
    if (!b.colhead) {
      const G = colheadAbove(src, used, b, R);
      if (G) { headAbove.set(b, G); for (const l of G) used.add(l); }
    }
  }
  // 띠마다 새 줄
  const rowBase = new Map();
  const diag = [];
  const emitted = new Map();
  for (const b of tableBands) {
    const base = rowBase.get(b.t) || 0;
    const e = emitBand(b, b.t, base, b.colhead, P, R);
    rowBase.set(b.t, base + e.rows);
    const G = headAbove.get(b);
    const heads = G ? G.map(function (l) {
      const c = Object.assign({}, l, { role: 'colhead', rt: { t: b.t, row: -1, cell: 'H', k: 0 } });
      return c;
    }) : [];
    emitted.set(b, heads.concat(e.lines));
    diag.push({
      t: b.t, inherited: !!b.inherited, rows: e.rows, align: e.align,
      refCells: b.det.R.reduce(function (a, r) { return a + r.cells.length; }, 0),
      colhead: !!(b.colhead || G), lines: e.lines.length,
      nSplit: b.det.nSplit || 0, grown: !!b.grown, head2: !!b.head2, hiddenRatio: b.det.hiddenRatio
    });
  }
  // 읽기 순서 배열 다시 짜기: 띠가 쓴 원래 줄은 빼고, 띠 첫 줄 자리에 새 줄을 끼운다.
  // 띠 조각이 아닌 run 이 남은 줄(가로지르는 span 조각 등)은 남은 run 으로 제자리에 다시 만든다.
  const consumedRuns = new Map();      // line → Set(run)
  const firstIdx = new Map();          // band → 처음 나오는 원래 줄 자리
  const idxOf = new Map();
  src.forEach(function (l, i) { idxOf.set(l, i); });
  for (const b of tableBands) {
    let f = Infinity;
    for (const p of b.ps) {
      if (!consumedRuns.has(p.line)) consumedRuns.set(p.line, new Set());
      consumedRuns.get(p.line).add(p.run);
      if (p.origRun) consumedRuns.get(p.line).add(p.origRun);   // [8i-2 시제품] xsplit 으로 나눈 run 의 원래 run
      f = Math.min(f, idxOf.get(p.line));
    }
    const G = headAbove.get(b);
    if (G) for (const l of G) f = Math.min(f, idxOf.get(l));
    firstIdx.set(b, f);
  }
  const headLines = new Set();
  for (const G of headAbove.values()) for (const l of G) headLines.add(l);
  const at = new Map();
  for (const b of tableBands) {
    const f = firstIdx.get(b);
    if (!at.has(f)) at.set(f, []);
    at.get(f).push(b);
  }
  // 원래 줄 → 내보낼 줄(그대로 · 띠가 쓰고 남은 run 으로 다시 만든 줄 · 없음)
  const outOf = new Map();
  for (let i = 0; i < src.length; i++) {
    const l = src[i];
    if (headLines.has(l)) { outOf.set(l, null); continue; }
    const cons = consumedRuns.get(l);
    if (!cons) { outOf.set(l, l); continue; }
    const rest = (l.runs || []).filter(function (r) { return !cons.has(r); });
    outOf.set(l, rest.length ? makeLine(l, rest, l.col, l.role, null, P) : null);
  }
  // [8i Review] 이웃한 두 행 표 띠 **사이**(R1 이 끊은 자리)의 줄 — 가로지르는 장 제목 등 — 은 아래 띠 바로 앞에 둔다.
  // 원래 자리(4-5 읽기 순서)에 두면, 그 줄이 오른쪽 단으로 분류된 쪽(CMDT 2026 31쪽 "CHAPTER 34…")에서
  // 아래 띠(그 장의 첫 행)와 쪽 끝 꼬리 줄을 다 읽은 **뒤에** 읽혔다.
  const before = new Map();            // 아래 띠 → 그 앞에 둘 원래 줄들(위→아래)
  const moved = new Set();
  for (let k = 1; k < BS.length; k++) {
    const up = BS[k - 1], lo = BS[k];
    if (!up.det || !lo.det) continue;
    let yUp = Infinity, yLo = -Infinity;
    for (const p of up.ps) if (p.y < yUp) yUp = p.y;
    for (const p of lo.ps) if (p.y > yLo) yLo = p.y;
    const got = [];
    for (const l of src) {
      if (moved.has(l) || !outOf.get(l)) continue;
      if (l.role === 'rotated' || l.role === 'header' || l.role === 'footer' || l.role === 'pageno') continue;
      if (l.baseline < yUp && l.baseline > yLo) got.push(l);
    }
    if (!got.length) continue;
    got.sort(function (a, b) { return (b.baseline - a.baseline) || (idxOf.get(a) - idxOf.get(b)); });
    for (const l of got) moved.add(l);
    before.set(lo, got);
  }
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const bs = at.get(i);
    if (bs) {
      for (const b of bs) {
        for (const m of before.get(b) || []) out.push(outOf.get(m));
        for (const l of emitted.get(b)) out.push(l);
      }
    }
    const l = src[i];
    if (moved.has(l)) continue;
    const o = outOf.get(l);
    if (o) out.push(o);
  }
  return { lines: out, tables: diag, reject: reject };
}

/* ── [8i-2 시제품] layout.js buildPageLayout 사본 — 7b 만 이 파일의 것으로 ───────── */

// 출력용 Run — 내부 items 참조를 떼고 좌표·텍스트만 남긴다(spec 4-8 표 재구성이 run 텍스트를 쓴다).
function publicRun(run, params) {
  return {
    x0: run.x0,
    x1: run.x1,
    text: joinText({ items: run.items }, params)
  };
}

// 출력용 Line — 내부 누적값(_wsum 등)을 제거한다(결정성·직렬화 크기).
function publicLine(line, params) {
  const runs = (line.runs || []).map(function (r) { return publicRun(r, params); });
  const out = {
    id: line.id,
    text: line.text,
    bbox: line.bbox,
    baseline: line.baseline,
    fontSize: line.fontSize,
    col: line.col,
    role: line.role,
    hyphenJoin: !!line.hyphenJoin,
    paraId: line.paraId,
    regionId: line.regionId || null,
    runs: runs,
    items: (line.items || []).map(function (it) {
      return {
        str: it.str, x: it.x, y: it.y, w: it.w, h: it.h,
        fontSize: it.fontSize, fontName: it.fontName,
        ascent: it.ascent, descent: it.descent,
        rotated: it.rotated, hasEOL: it.hasEOL, sup: it.sup, idx: it.idx
      };
    })
  };
  // [8i] 행 표 줄만 rt 를 단다 — 행 표가 없는 쪽의 출력은 한 바이트도 바뀌지 않는다(4-13 원칙 2).
  if (line.rt) out.rt = { t: line.rt.t, row: line.rt.row, cell: line.rt.cell, k: line.rt.k };
  return out;
}

/**
 * spec 4-1 — 10단계 파이프라인.
 *
 * @param {Array} rawItems getTextContent().items 그대로
 * @param {Object} pageInfo { pageNo, width, height, styles, neighborLayouts }
 * @param {Object} params 알고리즘 파라미터(기본 LAYOUT). 프로토타입 페이지가 일부만 덮어쓴다.
 * @param {Object} rowParams 7b 행 표 상수(기본 config ROWTABLE). 테스트가 `ENABLED:false` 로 "7b 없을 때"를 만든다.
 * @returns {Object} PageLayout
 */
export function buildPageLayout8i2(rawItems, pageInfo = {}, params = LAYOUT, rowParams = ROWTABLE) {
  const P = params || LAYOUT;
  const pageNo = pageInfo.pageNo != null ? pageInfo.pageNo : 0;
  const width = Number(pageInfo.width) || 0;
  const height = Number(pageInfo.height) || 0;
  const info = {
    pageNo: pageNo,
    width: width,
    height: height,
    neighborLayouts: pageInfo.neighborLayouts || []
  };

  // 1단계 — 정규화 (회전 아이템 분리, 폭 위생 — spec 4-2 수정 2026-09-20)
  const norm = normalizeItems(rawItems, pageInfo.styles || {}, P, info);

  // 2·3단계 — Y 클러스터링 → run 분할
  let lines = clusterLines(norm.items, P);
  for (let i = 0; i < lines.length; i++) splitRuns(lines[i], P);

  // 4단계 — 컬럼 판별 → 컬럼별 줄 재편
  const columns = detectColumns(lines, info, P);
  lines = reassignByColumn(lines, columns, info, P);

  // 5단계 — 읽기 순서
  let ordered = orderLines(lines, columns, info);

  // 6단계 — 텍스트 결합과 bbox
  for (let i = 0; i < ordered.length; i++) {
    ordered[i].id = pageNo + ':' + i;
    ordered[i].text = joinText(ordered[i], P);
    ordered[i].bbox = lineBBox(ordered[i]);
  }

  // 회전 줄은 본문 파이프라인 밖에서 따로 묶는다 (spec 4-2, 4-7)
  const rotLines = clusterLines(norm.rotated, P);
  for (let i = 0; i < rotLines.length; i++) {
    const l = rotLines[i];
    splitRuns(l, P);
    l.id = pageNo + ':r' + i;
    l.text = joinText(l, P);
    l.bbox = lineBBox(l);
    l.role = 'rotated';
    l.col = -1;
  }

  // 7단계 — 역할 판정
  const metrics = classifyRoles(ordered, info, P, info.neighborLayouts);

  // 7b단계 — 행 표 (spec 4-13). 잡히면 줄을 열별로 다시 만들어 행 순서로 끼우고 줄 id 를 다시 매긴다
  // (7단계까지는 id 를 저장하지 않는다). 안 잡히면 줄 배열이 그대로다.
  const rowTables = detectRowTables(ordered, info, P, rowParams || ROWTABLE);   // [8i-2 시제품] 이 파일의 detectRowTables
  if (rowTables.tables.length) {
    ordered = rowTables.lines;
    for (let i = 0; i < ordered.length; i++) ordered[i].id = pageNo + ':' + i;
  }
  // dev 측정 도구용 진단 훅(저장·출력에 들어가지 않는다)
  if (typeof pageInfo.rowTableProbe === 'function') pageInfo.rowTableProbe(rowTables);

  // 8단계 — 표 영역
  const regions = detectTables(ordered, info, P, metrics);

  // 9단계 — 문단
  const paragraphs = groupParagraphs(ordered, Object.assign({}, info), P, metrics);

  const bodyLeft = columnMetrics(ordered, P).map(function (c) { return c.left; });

  // 마지막 — 페이지 사각형으로 bbox 클립 (spec 4-6 `[수정 2026-09-23 — 6a]`)
  //
  // **여기가 파이프라인의 끝이라서 여기다.** 위의 4·5·7·8·9 단계와 bodyLeft 는 모두
  // 클립 전 bbox 를 읽는다 — detectColumns/splitRuns 는 items·run 좌표를 직접 보고,
  // columnMetrics(4-9 ctx.colLeft/colWidth, bodyLeft)·newParagraph(들여쓰기·짧은 마지막 줄)
  // ·detectTables(영역 bbox 합집합)는 line.bbox 를 읽는다. 클립된 값을 먹이면
  // 오른쪽 끝이 전부 W 로 뭉개져 컬럼·문단 판정이 무너진다.
  //
  // width/height 가 0 이면 넘기지 않는다 — 0 으로 클립하면 모든 bbox 가 0 이 된다.
  const pageRect = (width > 0 && height > 0) ? { width: width, height: height } : null;
  let bboxDegenerate = 0;
  if (pageRect) {
    const all = ordered.concat(rotLines);
    for (let i = 0; i < all.length; i++) {
      const l = all[i];
      const before = l.bbox;
      const after = lineBBox(l, pageRect);
      l.bbox = after;
      // 클립이 결함을 가리지 않게: 클립 **때문에** 넓이가 0 이 된 줄을 센다.
      // (원래부터 폭 0 인 줄 — 예: 전부 공백인 줄 — 은 페이지 밖 신호가 아니다.)
      if (before &&
          ((before.x1 - before.x0 > 0 && after.x1 - after.x0 <= 0) ||
           (before.y1 - before.y0 > 0 && after.y1 - after.y0 <= 0))) {
        bboxDegenerate++;
      }
    }
  }

  return {
    pageNo: pageNo,
    width: width,
    height: height,
    algoVersion: algoVersion,
    lines: ordered.concat(rotLines).map(function (l) { return publicLine(l, P); }),
    paragraphs: paragraphs,
    regions: regions,
    columns: { count: columns.count, gutters: columns.gutters.slice() },
    stats: {
      medianFontSize: metrics.medianFontSize,
      medianLeading: metrics.medianLeading,
      bodyLeft: bodyLeft,
      warn: columns.warn || null,
      // spec 4-2 — 폭 위생이 고친 아이템 수. 새 책을 넣었을 때 이 수가 튀면
      // pdf.js 가 주는 폭 정보가 그 책에서 더 심하게 깨져 있다는 신호다.
      widthFixed: norm.stats.widthFixed,
      // spec 4-6 — 클립 후 넓이가 0 이 된 줄 수. 페이지 밖에 통째로 있는 줄이라는
      // 뜻이며, 클립이 진짜 결함을 덮고 있다는 신호다. 줄은 버리지 않는다.
      // 실측: 전수 729쪽에서 25건(1·226·655쪽) — 전부 페이지 **왼쪽** 밖이고 다수가 표지·책등의 회전 줄이다.
      bboxDegenerate: bboxDegenerate
    }
  };
}
