#!/usr/bin/env node
/* ============================================================
   8i-4-0 측정 — 일반 다열 텍스트 표: 시제품 규칙 + 정답표 채점 (spec 초안 4-14-3, 2026-11-16)

   **앱 코드를 고치지 않는다.** 앱 `buildPageLayout`(measure-lib `pageLayout`)으로 쪽 레이아웃을 만든 뒤,
   그 줄들(단 재편 전 x 좌표 그대로)을 쪽 단위 **띠**(R1 — 넓은 조각에서 자름)와 **빈 세로 통로**(R2)로 나눠
   "행 머리 → 칸 머리: 값" 표를 잡는 시제품을 돌린다(14 Plan `proto-table2` 를 옮김 + 다듬은 규칙).

   사용 (MEDREADER_PDFJS=<pdf.js 폴더 또는 pdf.mjs> 또는 --pdfjs <경로>; 플래그는 맨 뒤에):
     node measure-table-8i4.mjs scan  <pdf> [시작] [끝] [--rules 목록] [--out cand.json]
          — 쪽마다 띠 판정(kind 별 띠·쪽·글자). --out 이면 띠 목록 JSON(정답표 뽑기용 특징 포함)
     node measure-table-8i4.mjs show  <pdf> <쪽,쪽> [--rules 목록] [--all]
          — 띠마다 열 경계·행·머리(원서 조각 ≤ 16자) — 정답표를 손으로 만들 때
     node measure-table-8i4.mjs score --key <key.json> [--split dev|test|all] [--rules 목록] [--book 이름=<pdf> …] [--neg] [--v] [--feat] [--rowv] [--cellv]
          — 정답표 채점(표 판정·표 아님 오탐·행·칸·머리). --neg 면 정답표의 "표 아님 쪽 목록"도 돈다.
     --rules: base(14 Plan 시제품 그대로) · all(다듬은 규칙 전부, 기본) · 쉼표 목록(예: all,-T6 · base,G1,G2)

   규칙(이름은 spec 초안 4-14-3 을 따르되 8i-4-0 에서 다듬은 모양 — 보고서 3절):
     G1 표다움 — 줄 둘 이상 찬 열 ≥ 2 · 칸 둘 이상 찬 줄 ≥ G1_MULTI · 열 정렬 ≥ G1_ALIGN · 채움 ≥ G1_DENS · 꽉 찬 산문 열 둘 이상이면 아님
     G2 목록·그림 — 글머리표/열거 표시뿐인 열이 있으면 목록 · 조각 평균 글자 < G2_AVG 면 그림
     G3 색인 — 칸 끝이 ", 쪽번호" 인 줄 ≥ G3_INT        G4 7b 행 표(rt) 줄이 있으면 대상 아님
     G5 머리 없음 — T2 가 머리 행을 못 찾으면 표로 읽지 않음(8i-4-0 에서 더함)
     T1 띠 잇기(통로 수·위치 같은 이웃 띠) · T2 표 제목 꼬리 떼기 + 머리(글꼴이 본문과 다르면 글꼴로, 아니면 숫자 낱덩이·이음표 없는 줄)
     T3 묶음 열(시제품 그대로 — 채점 밖) · T4 행 나눔(행간 lh 의 T4_JUMP 배 넘는 간격 + 강한 앵커, 하위 행 표시)
     T5 각주 떼기(작은 글자·위첨자 표시로 시작) · T6 붙은 run 나누기(아이템 틈) + 좁은 통로 + 제 내용 없는 열 경계 버리기
     위첨자만 든 줄(작은 글자 · 조각 ≤ 6자)은 아래 줄에 붙인다(규칙과 무관 — 채점도 같은 줄 정의).

   정답표(스크래치패드에 둔다 — 원서 글은 짧은 머리 글자만): {
     books: { 이름: <pdf 경로> },
     bands: [{ id, book, p, split:'dev'|'test', table:bool, y:[아래 baseline, 위 baseline],
               cuts:[칸 경계 x…], head:[머리 줄 baseline…], headText:[칸마다 ≤16자, 'a|b' 는 대안],
               rows:[행 첫 줄 baseline…], span:[칸을 가로지르는 합친 칸 줄 baseline…], note }],
     neg: [{ book, pages:[…], split, why }] }
   채점 정의(보고서 `.claude/tasks/medreader-build-8i4-0-report.md` 2절):
     표 판정 — 정답 띠 y 범위와 겹치는 예측 표가 있으면 "표". 정밀도 = 표∧정답표 / 표, 재현율, 정확도.
     표 아님 오탐 — 정답이 표 아님인 띠 + neg 쪽에서 예측된 표 수(0 이어야 함).
     행 — 정답 표의 행마다 (첫 줄, 끝 줄)이 예측 행(또는 예측 행 + 뒤 하위 행 묶음)과 3pt 안에서 같으면 맞음. 놓친 표의 행은 틀림.
     칸 — 정답 표 범위(머리·합친 칸 줄 뺌)의 조각(아이템 틈 0.3em 로 나눔) 글자 가중: 정답 칸 k 와 예측 칸 j 가 서로 최다 짝이면 맞음,
          정답 경계를 Fm 넘게 가로지르는 조각은 틀림. 예측 칸은 예측이 쓴 단위(T6 면 조각, 아니면 앱 run) 가운데로.
     머리 — 정답 표의 칸마다 머리 글(앞 10자, 영숫자만 소문자) 같음 · 둘 다 없음이면 맞음.
   원서 조각은 진단용 16자 이하만 찍는다. 시간: 전 쪽 scan CMDT 2026 31초 · CMDT 2021 32초 · Harrison 8초, score(--neg) 반쪽 10초.
   ============================================================ */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { loadPdfjs, positional, pageLayout } from './measure-lib.mjs';

/* ---------- 상수 ---------- */
export const K = {
  // 14 Plan 시제품 그대로
  SPAN: 0.55,        // R1 — 폭 > SPAN·W 인 run 이 띠를 끊는다
  MERGE_Y: 0.35,     // 같은 baseline 줄 합치기(×Fm)
  CH_ALLOW: 0.08,    // R2 — 통로가 허용하는 덮인 줄 비율
  CH_W: 0.8,         // R2 — 통로 폭 하한(×Fm)
  ROWGAP: 1.3,       // 행 나눔 — 큰 간격 = 작은 간격 × ROWGAP
  PROSE: 25,         // 산문 열 — 칸 평균 글자
  HEAD_MAX: 3,       // 머리 행 최대
  // 8i-4-0 다듬기(규칙별 — 머리 주석)
  G1_DENS: 0.12,                         // G1 채움 하한(줄 칸 × 폭 중 글이 덮은 비율)
  G1_ALIGN: 0.65,                        // G1 열 정렬 하한(왼끝 1.5·Fm 또는 가운데 1·Fm 안에 모인 조각 비율의 최솟값)
  G1_PROSE_N: 15, G1_PROSE_FULL: 0.8,    // G1 산문 열: 줄 ≥ N · 평균 ≥ PROSE · 꽉 찬 run ≥ FULL 인 열이 둘 이상이면 산문
  G1_MULTI: 0.45,                        // G1 맞물림: 칸 둘 이상 찬 줄 비율 하한(그리고 줄 둘 이상 찬 열 ≥ 2)
  G2_AVG: 4,                             // G2 그림 가드: 조각 평균 글자 < G2_AVG
  G3_INT: 0.6,                           // 색인 가드: 쪽 번호 목록 꼬리인 줄 비율
  T1_DX: 1.0, T1_WIDE: 2,                // 띠 잇기: 통로 중심 차 ≤ T1_DX·Fm, 사이 넓은 줄 ≤ T1_WIDE
  T2_GAP: 1.3, T2_MAXLINES: 8,           // 머리: 표 제목 꼬리·구획 행을 가르는 간격(× 가장 작은 행 간격) · 머리 줄 상한
  T4_JUMP: 1.12,                         // 행 나눔: 행간 lh(간격 20 백분위)의 이 배를 넘는 간격 = 행 사이
  T5_SIZE: 0.85,                         // 각주: 글자 크기 < T5_SIZE × 표 중앙값
  T6_SPLIT: 0.3,                         // 붙은 run 나누기: 아이템 사이 틈 ≥ T6_SPLIT × 글자 크기
  T6_CH_W: 0.45, T6_SIDE: 0.5            // 좁은 통로: 폭 ≥ T6_CH_W·Fm 이고 덮인 줄 0, 양옆에 글 있는 줄 비율 ≥ T6_SIDE
};
export const RULE_NAMES = ['G1', 'G2', 'G3', 'G4', 'G5', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

export function parseRules(s) {
  const R = {};
  for (const t of String(s || 'all').split(',').map((x) => x.trim()).filter(Boolean)) {
    if (t === 'all') RULE_NAMES.forEach((n) => { R[n] = true; });
    else if (t === 'base') RULE_NAMES.forEach((n) => { R[n] = false; });
    else if (t[0] === '-') R[t.slice(1)] = false;
    else R[t] = true;
  }
  return R;
}

/* ---------- 도우미 ---------- */
const clip = (t, n = 16) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const INT_ONLY = /^\d{1,5}(?:\s*[,–\-]\s*\d{1,5})*$/;
const INDEX_TAIL = /,\s*\d{1,4}(?:[–\-]\d{1,4})?[a-z]?\s*$/;
const NUMERIC = /\d/;
// 숫자 낱덩이(앞뒤가 빈칸·구두점) — 'HbA1c'·'T2'·'DSM-5'·'(24-Hour)' 는 아니고 '65–75'·'≥ 50'·'445' 는 맞다
const NUMTOK = /(?:^|\s)[<>≤≥~±+\-–]?\d[\d.,:–\-\/×]*%?(?=\s|$|[;,)])/;
const SKIP_ROLES = new Set(['rotated', 'header', 'footer', 'pageno']);

/** 쪽의 표 대상 줄(위→아래). */
function pageLines(L, H) {
  return L.lines.filter((l) => !SKIP_ROLES.has(l.role) && l.baseline < H * 0.94 && l.baseline > H * 0.06)
    .sort((a, b) => b.baseline - a.baseline);
}

/* ---------- 조각(run) ---------- */
/** 줄 아이템 중 x 범위 안(가운데 기준) — x 순. */
function itemsIn(l, x0, x1) {
  return (l.items || []).filter((it) => { const c = it.x + (it.w || 0) / 2; return c >= x0 - 0.5 && c <= x1 + 0.5 && String(it.str).trim(); })
    .sort((a, b) => a.x - b.x);
}
/** 아이템 글 잇기(사이가 벌어지면 빈칸). */
function joinItems(its) {
  let s = ''; let end = null;
  for (const it of its) {
    const t = String(it.str);
    if (end != null && it.x - end > 0.15 * (it.fontSize || 8) && !/\s$/.test(s) && !/^\s/.test(t)) s += ' ';
    s += t; end = it.x + (it.w || 0);
  }
  return s.replace(/\s+/g, ' ').trim();
}
/** 조각 정보 — 글자 크기·위첨자 여부·글꼴(글자 수 최다, 위첨자 뺌)·위첨자 뺀 글(tn). */
function pieceOf(its, x0, x1, t, l) {
  const fs_ = its.length ? med(its.map((it) => it.fontSize)) : l.fontSize;
  const sup = its.length > 0 && its.every((it) => it.sup);
  const fc = {}; for (const it of its) if (!it.sup) fc[it.fontName] = (fc[it.fontName] || 0) + String(it.str).trim().length;
  let font = null, fv = -1; for (const f in fc) if (fc[f] > fv) { font = f; fv = fc[f]; }
  const tn = joinItems(its.filter((it) => !it.sup));
  const f0 = its[0];
  const lead = !!f0 && String(f0.str).trim().length <= 3 && (f0.sup || f0.fontSize < 0.8 * fs_);
  return { x0, x1, t, tn, fs: fs_, sup, font, lead, reg: !!l.regionId, rt: !!l.rt, cap: l.role === 'figure-caption' };
}
/** 줄의 조각들. T6: 앱 run 안에서 아이템 사이 틈 ≥ T6_SPLIT·글자 크기면 둘로 나눈다(붙은 두 칸). */
function piecesOf(l, R) {
  const out = [];
  for (const r of l.runs || []) {
    const its = itemsIn(l, r.x0, r.x1);
    if (R.T6 && its.length > 1) {
      let cur = [its[0]];
      const flush = () => { const a = cur[0].x, b = Math.max(...cur.map((it) => it.x + (it.w || 0))); out.push(pieceOf(cur, a, b, joinItems(cur), l)); };
      for (let i = 1; i < its.length; i++) {
        const prev = its[i - 1], it = its[i];
        const gap = it.x - (prev.x + (prev.w || 0));
        if (gap >= K.T6_SPLIT * (it.fontSize || l.fontSize) && !it.sup) { flush(); cur = [it]; } else cur.push(it);
      }
      if (cur.length === its.length) out.push(pieceOf(its, r.x0, r.x1, r.text, l)); else flush();
    } else out.push(pieceOf(its, r.x0, r.x1, r.text, l));
  }
  return out;
}

/** R1 — 띠: 넓은 조각이 있는 줄에서 끊는다. 띠마다 바로 앞 넓은 줄 목록(T1)도 남긴다. */
function bandsOf(lines, W) {
  const bands = []; let cur = []; let wide = [];
  for (const l of lines) {
    if (l._pc.some((r) => r.x1 - r.x0 > K.SPAN * W)) {
      if (cur.length) { bands.push({ lines: cur, wideBefore: wide }); cur = []; wide = []; }
      wide.push(l); continue;
    }
    cur.push(l);
  }
  if (cur.length) bands.push({ lines: cur, wideBefore: wide });
  return bands;
}

/** 같은 baseline 줄 합치기(2단 재편으로 갈린 run 을 쪽 단위 한 줄로). */
function mergeRows(ls, Fm) {
  const out = [];
  for (const l of ls) {
    const o = out.find((x) => Math.abs(x.b - l.baseline) <= K.MERGE_Y * Fm);
    const n = l._pc.reduce((a, r) => a + r.tn.length, 0);
    if (o) { o.runs.push(...l._pc); o.ids.push(l.id); if (n > o.n) { o.n = n; o.b = l.baseline; } } else out.push({ b: l.baseline, runs: l._pc.slice(), ids: [l.id], n });
  }
  for (const o of out) o.runs.sort((a, b) => a.x0 - b.x0);
  out.sort((a, b) => b.b - a.b);
  // 위첨자만 든 줄(작은 글자 · 조각마다 3자 이하)은 바로 아래 줄에 붙인다 — 값 옆 각주 표시가 따로 줄이 된 경우
  for (let i = out.length - 2; i >= 0; i--) {
    if (isTinyRow(out[i].runs, Fm) && out[i].b - out[i + 1].b <= 0.8 * Fm) { out[i + 1].runs.push(...out[i].runs.map((r) => Object.assign({}, r, { sup: true, tn: '' }))); out[i + 1].runs.sort((a, b) => a.x0 - b.x0); out[i + 1].ids.push(...out[i].ids); out.splice(i, 1); }
  }
  return out;
}
/** 위첨자 줄: 모든 조각이 작은 글자(≤ 0.8·Fm)이고 6자 이하(각주 표시 'c,d***' 따위). */
export function isTinyRow(runs, Fm) { return runs.length > 0 && runs.every((r) => r.fs <= 0.8 * Fm && String(r.t).replace(/\s/g, '').length <= 6); }

/** R2 — 통로(열 경계 x). T6: 덮인 줄 0 인 좁은 통로도(양옆에 글 있는 줄이 충분할 때). */
function channels(rows, Fm, R) {
  const xs = rows.flatMap((l) => l.runs);
  const x0 = Math.min(...xs.map((r) => r.x0)), x1 = Math.max(...xs.map((r) => r.x1));
  const nb = Math.ceil(x1 - x0) + 1, cov = new Uint16Array(nb + 1);
  for (const l of rows) { const seen = new Set(); for (const r of l.runs) for (let x = Math.max(0, Math.floor(r.x0 - x0)); x < Math.min(nb, Math.ceil(r.x1 - x0)); x++) if (!seen.has(x)) { seen.add(x); cov[x]++; } }
  const allow = Math.floor(K.CH_ALLOW * rows.length);
  const ch = []; let s = -1;
  for (let x = 0; x <= nb; x++) {
    const free = x < nb && cov[x] <= allow;
    if (free && s < 0) s = x;
    if (!free && s >= 0) { if (x - s >= K.CH_W * Fm && s > 0) ch.push([x0 + s, x0 + x]); s = -1; }
  }
  if (R.T6) {
    s = -1;
    for (let x = 0; x <= nb; x++) {
      const free = x < nb && cov[x] === 0;
      if (free && s < 0) s = x;
      if (!free && s >= 0) {
        const a = x0 + s, b = x0 + x;
        if (b - a >= K.T6_CH_W * Fm && s > 0 && !ch.some((c) => c[0] <= b && c[1] >= a)) {
          const both = rows.filter((l) => l.runs.some((r) => r.x1 <= a + 0.5) && l.runs.some((r) => r.x0 >= b - 0.5)).length;
          if (both >= K.T6_SIDE * rows.length) ch.push([a, b]);
        }
        s = -1;
      }
    }
    ch.sort((p, q) => p[0] - q[0]);
  }
  return ch.map((c) => (c[0] + c[1]) / 2);
}

/** 열 통계 — 표다움 판정용(G 가드). multi: 칸 둘 이상 찬 줄 비율 · full: 열 안 꽉 찬 run 비율 · align: 열 왼끝(또는 가운데) 정렬 비율. */
function colStats(dl, colOf, nc, Fm) {
  const cols = [];
  for (let k = 0; k < nc; k++) {
    const rs = dl.flatMap((l) => l.runs.filter((r) => colOf(r) === k && !r.sup && r.tn));
    if (!rs.length) { cols.push({ n: 0 }); continue; }
    const lines = dl.filter((l) => l.c[k]).length;
    const ws = rs.map((r) => r.x1 - r.x0).sort((a, b) => a - b); const w90 = ws[Math.floor(0.9 * (ws.length - 1))];
    const full = rs.filter((r) => r.x1 - r.x0 >= 0.85 * w90).length / rs.length;
    const xm = med(rs.map((r) => r.x0)), cmm = med(rs.map((r) => (r.x0 + r.x1) / 2));
    const aL = rs.filter((r) => Math.abs(r.x0 - xm) <= 1.5 * Fm).length / rs.length;
    const aC = rs.filter((r) => Math.abs((r.x0 + r.x1) / 2 - cmm) <= 1.0 * Fm).length / rs.length;
    const avg = rs.reduce((a, r) => a + r.tn.length, 0) / rs.length;
    // 목록 표시 열: 칸 글이 글머리표(•▪–…)나 열거 표시(A. 1) 따위)뿐
    const mark = rs.filter((r) => /^([•●▪■◦○·\-–—]|[A-Za-z0-9]{1,2}[.)])$/.test(r.tn)).length / rs.length;
    cols.push({ n: lines, avg: +avg.toFixed(1), full: +full.toFixed(2), align: +Math.max(aL, aC).toFixed(2), mark: +mark.toFixed(2) });
  }
  const multi = dl.filter((l) => l.c.filter(Boolean).length >= 2).length / dl.length;
  const used = cols.filter((c) => c.n >= 2);
  // 채움: 줄 칸(행간 단위) × 폭 중 조각이 덮은 비율 — 그림·흐름도는 성기다
  const pr = dl.flatMap((l) => l.runs.filter((r) => r.tn && !r.sup));
  let dens = 0;
  if (pr.length && dl.length > 1) {
    const g = []; for (let i = 1; i < dl.length; i++) g.push(dl[i - 1].b - dl[i].b); g.sort((a, b) => a - b);
    const lh = Math.max(1, g[Math.floor(0.2 * (g.length - 1))]);
    const slots = (dl[0].b - dl[dl.length - 1].b) / lh + 1;
    const bw = Math.max(...pr.map((r) => r.x1)) - Math.min(...pr.map((r) => r.x0));
    dens = pr.reduce((a, r) => a + (r.x1 - r.x0), 0) / Math.max(1, bw * slots);
  }
  return { multi: +multi.toFixed(2), used: used.length, alignMin: used.length ? Math.min(...used.map((c) => c.align)) : 0, dens: +dens.toFixed(2), cols };
}

const lineFont = (l) => { const fc = {}; for (const r of l.runs) if (r.font && !r.sup) fc[r.font] = (fc[r.font] || 0) + r.tn.length; let f = null, v = -1; for (const k in fc) if (fc[k] > v) { f = k; v = fc[k]; } return f; };
const nonEmpty = (l) => l.c.filter(Boolean).length;
const supOnly = (l) => l.runs.every((r) => r.sup || !r.tn);

/** 한 띠 분석. forcedCuts 가 있으면 통로를 재지 않는다(T1). */
function analyzeBand(bandLines, Fm, W, R, forcedCuts) {
  let rows0 = mergeRows(bandLines, Fm);
  if (rows0.length < 3) return null;
  const caption = [], foot = [];
  const rgap = (a, b) => a.b - b.b;
  const pmin0 = (rs) => { const g = []; for (let i = 1; i < rs.length; i++) g.push(rgap(rs[i - 1], rs[i])); g.sort((a, b) => a - b); return med(g.slice(0, Math.max(1, Math.ceil(g.length / 3)))); };
  if (R.T5) {
    // T5 각주 — 표 끝(아래)에서 작은 글자이거나 위첨자 표시로 시작하는 줄은 표 밖(통로 재기 전에 뗀다)
    const fsMed = med(rows0.flatMap((l) => l.runs.map((r) => r.fs)));
    while (rows0.length > 3) {
      const l = rows0[rows0.length - 1];
      const small = l.runs.every((r) => r.fs < K.T5_SIZE * fsMed);
      const mark = !!l.runs[0] && (l.runs[0].sup || l.runs[0].lead || /^[*†‡§¶]/.test(l.runs[0].t));
      if (!(small || mark)) break;
      foot.unshift(rows0.pop());
    }
  }
  if (R.T2) {
    // T2 표 제목 꼬리 — 맨 위 줄이 조각 하나(둘)이고, 아래 줄과 글꼴이 다르며, 행 간격보다 크게 떨어져 있으면 표 밖
    while (rows0.length > 3 && rows0[0].runs.length <= 2 && lineFont(rows0[0]) !== lineFont(rows0[1]) && rgap(rows0[0], rows0[1]) > K.T2_GAP * pmin0(rows0)) caption.push(rows0.shift());
  }
  // T2 머리 — 통로 재기 전에(머리·묶음 머리 줄이 통로를 막지 않게). 글꼴이 본문과 다르면 글꼴로, 아니면 숫자 낱덩이·이음표로
  let headRows = null;
  if (R.T2 && !forcedCuts) {
    for (const l of rows0) l.font = lineFont(l);
    const tail = rows0.slice(Math.min(rows0.length - 1, Math.ceil(rows0.length / 2)));   // 본문 글꼴 = 아래 절반에서 글자 수 최다
    const fc = {}; for (const l of tail) for (const r of l.runs) if (r.font && !r.sup) fc[r.font] = (fc[r.font] || 0) + r.tn.length;
    let dataFont = null, v = -1; for (const f in fc) if (fc[f] > v) { dataFont = f; v = fc[f]; }
    const p = pmin0(rows0);
    const headish = (l) => !l.runs.some((r) => r.tn && (NUMTOK.test(r.tn) || r.tn.length > 40 || /[,;\-–]$/.test(r.tn)));
    const fontMode = !!rows0[0].font && rows0[0].font !== dataFont;
    const xmin = Math.min(...rows0.flatMap((l) => l.runs.map((r) => r.x0)));
    let i = 0;
    while (i < rows0.length - 1 && i < K.T2_MAXLINES) {
      const l = rows0[i];
      if (supOnly(l)) { i++; continue; }
      if (fontMode ? l.font === dataFont : !headish(l)) break;
      const one = l.runs.filter((r) => r.tn);
      if (i > 0 && rgap(rows0[i - 1], l) > K.T2_GAP * p && one.length === 1) break;
      // 글꼴로 못 가를 때: 이미 칸 둘 이상인 머리 줄을 본 뒤 띠 왼끝에서 시작하는 칸 하나 줄 = 구획 행
      if (!fontMode && one.length === 1 && Math.abs(one[0].x0 - xmin) <= Fm && rows0.slice(0, i).some((h) => h.runs.filter((r) => r.tn).length >= 2)) break;
      i++;
    }
    while (i > 0 && supOnly(rows0[i - 1])) i--;
    headRows = rows0.length - i >= 2 ? rows0.splice(0, i) : [];
  }
  let cuts = forcedCuts || channels(rows0, Fm, R);
  if (R.T1 && !forcedCuts) {
    // 빈 가장자리 열을 만드는 경계는 버린다(이웃 띠와 통로 수를 맞추기 위해)
    const cs = rows0.concat(headRows || []).flatMap((l) => l.runs.map((r) => (r.x0 + r.x1) / 2));
    cuts = cuts.filter((c) => cs.some((x) => x < c) && cs.some((x) => x > c));
  }
  if (R.T6 && !forcedCuts) {
    // 제 칸에서 시작하는 조각이 둘 미만인 열을 만드는 경계는 버린다(긴 칸 글이 삐져나온 자리의 헛 통로)
    const rs = rows0.concat(headRows || []).flatMap((l) => l.runs).filter((r) => r.tn);
    let changed = true;
    while (changed && cuts.length) {
      changed = false;
      for (let k = 0; k < cuts.length; k++) {
        const lo = cuts[k], hi = k + 1 < cuts.length ? cuts[k + 1] : Infinity;
        const own = rs.filter((r) => r.x0 >= lo - 0.5 && (r.x0 + r.x1) / 2 < hi).length;
        if (own < 2) { cuts.splice(k, 1); changed = true; break; }
      }
    }
  }
  const nc = cuts.length + 1;
  if (nc < 2) return null;
  const colOf = (r) => { const c = (r.x0 + r.x1) / 2; let k = 0; while (k < cuts.length && c > cuts[k]) k++; return k; };
  const cellsOf = (l, f) => { const cs = new Array(nc).fill(''); for (const r of l.runs) { const k = colOf(r); const t = f(r); if (!t) continue; cs[k] = cs[k] ? cs[k] + ' ' + t : t; } return cs; };
  const mk = (l) => ({ b: l.b, c: cellsOf(l, (r) => r.t), cn: cellsOf(l, (r) => r.tn), runs: l.runs, reg: l.runs.filter((r) => r.reg).length / l.runs.length, rt: l.runs.some((r) => r.rt), cap: l.runs.some((r) => r.cap) });
  let dl = rows0.map(mk);
  for (const l of dl) l.font = lineFont(l);
  // 열 성격
  const traits = (dls) => { const tr = []; for (let k = 0; k < nc; k++) { const cs = dls.map((l) => l.c[k]).filter(Boolean); tr.push({ n: cs.length, avg: cs.length ? cs.reduce((a, s) => a + s.length, 0) / cs.length : 0, int: cs.length ? cs.filter((s) => INT_ONLY.test(s.trim())).length / cs.length : 0, num: cs.length ? cs.filter((s) => NUMERIC.test(s)).length / cs.length : 0 }); } return tr; };
  let tr = traits(dl);
  const prose = tr.filter((t) => t.avg >= K.PROSE && t.int < 0.5);
  const maxN = Math.max(...tr.map((t) => t.n));
  let kind = 'table';
  if (nc === 2 && prose.length === 2 && Math.min(tr[0].n, tr[1].n) >= 0.5 * maxN) kind = 'prose2';
  else if (nc === 3 && prose.length === 3 && Math.min(...tr.map((t) => t.n)) >= 0.4 * maxN) kind = 'prose3';
  else if (nc === 2 && tr.some((t) => t.int >= 0.8)) kind = 'numcol';
  if (dl.some((l) => l.rt)) kind = 'rowtable(8i)';
  const cstat = colStats(dl, colOf, nc, Fm);
  // ---- 가드 ----
  // G1 맞물림: 두 열 이상이 줄 둘 이상씩 차고, 칸 둘 이상 찬 줄이 G1_MULTI 이상(산문 + 그림 라벨·흐름도·한 열 목록은 칸이 맞물리지 않는다)
  if (kind === 'table' && R.G1 && (cstat.used < 2 || cstat.multi < K.G1_MULTI)) kind = 'loose';
  // G1 정렬: 칸 글이 열마다 왼끝(또는 가운데)에 모이지 않으면(흐름도·그림 라벨) 표 아님
  if (kind === 'table' && R.G1 && cstat.alignMin < K.G1_ALIGN) kind = 'loose';
  // G1 채움: 줄 칸 × 폭 중 글이 덮은 비율이 낮으면(그림·흐름도 라벨) 표 아님
  if (kind === 'table' && R.G1 && cstat.dens < K.G1_DENS) kind = 'loose';
  // G1 산문: 줄 많고 꽉 찬 긴 글 열이 둘 이상(다단 산문 + 그림)
  if (kind === 'table' && R.G1 && cstat.cols.filter((c) => c.n >= K.G1_PROSE_N && c.avg >= K.PROSE && c.full >= K.G1_PROSE_FULL).length >= 2) kind = 'prose';
  // G2 목록: 글머리표·열거 표시뿐인 열이 있으면 목록(문항 보기·글머리 목록)
  if (kind === 'table' && R.G2 && cstat.cols.some((c) => c.n >= 2 && c.mark >= 0.8)) kind = 'list';
  if (kind === 'table' && R.G2) {
    const runs = dl.flatMap((l) => l.runs);
    const avgRun = runs.reduce((a, r) => a + r.t.trim().length, 0) / Math.max(1, runs.length);
    if (avgRun < K.G2_AVG) kind = 'figure';
  }
  if (kind === 'table' && R.G3) {
    const idx = dl.filter((l) => l.c.some((c) => INDEX_TAIL.test(c))).length;
    if (idx >= K.G3_INT * dl.length) kind = 'index';
  }
  if (kind === 'table' && R.G4 && dl.some((l) => l.rt)) kind = 'rowtable(8i)';
  const headLinesT2 = headRows ? headRows.map(mk) : null;
  // G5 머리 없음: 머리 행을 못 찾은 띠는 표로 읽지 않는다(서식·이어진 조각은 지금처럼 줄 단위)
  if (kind === 'table' && R.G5 && headLinesT2 && !headLinesT2.length) kind = 'nohead';
  tr = traits(dl);
  const fill = tr.map((t) => t.n / dl.length);
  // 행 머리 열 — 왼쪽 빈 열 · 묶음 열(채움 < 0.2, 오른쪽이 두 배 이상) 건너뜀(시제품 그대로)
  let hc = 0;
  while (hc < nc - 1 && (tr[hc].n === 0 || (fill[hc] < 0.2 && fill[hc + 1] >= 2 * fill[hc]))) hc++;
  // ---- 행 나눔 ----
  const gaps = []; for (let i = 1; i < dl.length; i++) gaps.push(dl[i - 1].b - dl[i].b);
  let gapMode, thr;
  if (R.T4) {
    // 간격 두 무리: 정렬한 간격에서 가장 큰 비율 뜀(≥ T4_JUMP)을 찾는다. 작은 쪽 기준은 아주 작은 간격(위첨자 줄 등)을 뺀 값
    // 줄 간격(행간) lh = 아주 작은 간격을 뺀 간격의 20 백분위. lh × T4_JUMP 보다 큰 간격 = 행 사이 여백
    const s0 = gaps.filter((g) => g > 0).sort((a, b) => a - b);
    const s = s0.filter((g) => g >= 0.6 * med(s0));
    const lh = s.length ? s[Math.floor(0.2 * (s.length - 1))] : 0;
    thr = K.T4_JUMP * lh;
    gapMode = s.filter((g) => g > thr).length >= 2 && s.some((g) => g <= thr);
    if (!gapMode) thr = Infinity;
  } else {
    const gmin = gaps.length ? med(gaps.filter((g) => g > 0).sort((a, b) => a - b).slice(0, Math.max(1, Math.ceil(gaps.length / 3)))) : 0;
    const big = gaps.filter((g) => g > K.ROWGAP * gmin).length;
    gapMode = gaps.length >= 3 && big >= 2 && big < gaps.length * 0.85;
    thr = K.ROWGAP * gmin;
  }
  const UP = /^[^a-z(]/;
  const CONT_END = /[-–,/(]$|\b(and|or|of|with|to|in)$/;
  const rows = []; let cur = null; let group = '';
  for (let i = 0; i < dl.length; i++) {
    const l = dl[i];
    for (let k = 0; k < hc; k++) if (l.c[k]) group = l.c[k];
    const h = l.cn[hc] || '';
    const prevH = cur ? (dl[i - 1].cn[hc] || '') : '';
    const anchor = !!h && UP.test(h) && !CONT_END.test(prevH.trim());
    let start;
    if (i === 0) start = true;
    else if (gapMode) {
      start = gaps[i - 1] > thr;
      // T4 강한 앵커: 간격이 작아도 행 머리 칸이 새로 시작하고 값 칸도 모두 새로 시작(대문자·숫자·기호)하면 새 행
      if (!start && R.T4 && anchor && nonEmpty(l) >= 2 && l.cn.every((c, k) => !c || k === hc || UP.test(c)) && dl[i - 1].cn.some((c, k) => c && k !== hc)) start = true;
    } else {
      start = anchor;
      // T4: 값 칸이 모두 소문자로 이어지면 행 머리 칸이 대문자여도 이어짐
      if (start && R.T4) { const vs = l.cn.filter((c, k) => c && k !== hc); if (vs.length && vs.every((c) => /^[a-z]/.test(c))) start = false; }
    }
    if (start) { cur = { group, cells: l.c.slice(), lines: [l.b] }; rows.push(cur); }
    else { for (let k = 0; k < nc; k++) if (l.c[k]) cur.cells[k] = cur.cells[k] ? cur.cells[k] + ' ' + l.c[k] : l.c[k]; cur.lines.push(l.b); }
  }
  for (const r of rows) r.sec = r.cells.filter(Boolean).length === 1 && !!r.cells[hc] && nc > 1;
  // T4 하위 행: 행 머리 칸이 빈 행 — 앞 행 머리를 물려받아 읽는다(채점도 '앞 행 + 하위 행' 을 한 행으로 인정)
  if (R.T4) rows.forEach((r, i) => { r.sub = i > 0 && !r.cells[hc] && r.cells.some(Boolean); });
  // ---- 칸 머리 ----
  const hcells = new Array(nc).fill(''); const headLines = [];
  if (headLinesT2) {
    for (const l of headLinesT2) { headLines.push(l.b); for (let k = 0; k < nc; k++) if (l.cn[k]) hcells[k] = hcells[k] ? hcells[k] + ' ' + l.cn[k] : l.cn[k]; }
  } else {
    // 시제품: 위에서부터 숫자 없는 짧은 행(최대 3) — 위첨자 한 글자 조각은 버리고 본다
    let nh = 0;
    while (nh < K.HEAD_MAX && rows.length - nh > 2) {
      const r = rows[nh];
      const cs = r.cells.map((c) => c.split(' ').filter((w) => w.length > 1 || /[A-Z]/.test(w)).join(' '));
      if (r.sec && nh > 0) break;
      if (cs.some((c) => /\d/.test(c)) || cs.some((c) => c.length > 40) || cs.filter(Boolean).length < 1) break;
      for (let k = 0; k < nc; k++) if (cs[k]) hcells[k] = hcells[k] ? hcells[k] + ' ' + cs[k] : cs[k];
      headLines.push(...r.lines);
      nh++;
    }
    rows.splice(0, nh);
  }
  const wrap = (l) => ({ b: l.b, runs: l.runs, reg: l.runs.filter((r) => r.reg).length / l.runs.length, cap: l.runs.some((r) => r.cap) });
  const all = caption.map(wrap).concat(headLinesT2 || [], dl, foot.map(wrap));
  const regShare = all.reduce((a, l) => a + l.reg, 0) / all.length;
  const runsAll = all.flatMap((l) => l.runs);
  return {
    kind, nc, hc, gapMode, cuts: cuts.map((c) => +c.toFixed(1)), nLines: all.length, nRows: rows.length, regShare: +regShare.toFixed(2),
    tr: tr.map((t) => [t.n, Math.round(t.avg)]), head: hcells.map((h) => clip(h, 16)), headLines: headLines.map((b) => +b.toFixed(1)),
    rows: rows.map((r) => ({ b: +r.lines[0].toFixed(1), lines: r.lines.map((b) => +b.toFixed(1)), g: clip(r.group, 12), c: r.cells.map((c) => clip(c, 16)), sec: r.sec, sub: !!r.sub })),
    foot: foot.map((l) => +l.b.toFixed(1)), caption: caption.map((l) => +l.b.toFixed(1)),
    y: [+all[all.length - 1].b.toFixed(1), +all[0].b.toFixed(1)], yAll: [+all[all.length - 1].b.toFixed(1), +all[0].b.toFixed(1)],
    chars: runsAll.reduce((a, r) => a + r.t.length, 0),
    feat: {
      avgRun: +(runsAll.reduce((a, r) => a + r.t.trim().length, 0) / Math.max(1, runsAll.length)).toFixed(1),
      supHead: rows0.slice(0, 3).some((l) => l.runs.some((r) => r.sup || (r.t.trim().length === 1 && r.fs < 0.9 * Fm))),
      emptyHead: rows.filter((r) => !r.cells[hc] && r.cells.some(Boolean)).length,
      cap: all.some((l) => l.cap),
      ...cstat
    }
  };
}

/** 한 쪽 → 띠 결과 목록. T1: 넓은 줄로 갈린 이웃 표 띠의 통로가 같으면 한 표로 잇는다. */
export function analyzePage(L, W, H, R) {
  const Fm = L.stats.medianFontSize || 9;
  const lines = pageLines(L, H);
  for (const l of lines) l._pc = piecesOf(l, R);
  const bands = bandsOf(lines, W);
  const out = [];
  bands.forEach((b, i) => {
    let a; try { a = analyzeBand(b.lines, Fm, W, R); } catch (e) { a = { kind: 'err', err: String(e && e.stack || e) }; }
    if (!a) return;
    a.band = i; a.wideBefore = b.wideBefore.length; a._lines = b.lines; a._wide = b.wideBefore;
    out.push(a);
  });
  if (R.T1) {
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i], b = out[i + 1];
      if (a.kind !== 'table' || b.band !== a.band + 1 || b.kind !== 'table') continue;
      if (b.wideBefore > K.T1_WIDE || a.cuts.length !== b.cuts.length) continue;
      if (!a.cuts.every((c, k) => Math.abs(c - b.cuts[k]) <= K.T1_DX * Fm)) continue;
      // 이은 띠: 사이 넓은 줄도 넣는다(구획 행·합친 칸) — 통로는 a 의 것
      const lines2 = a._lines.concat(b._wide, b._lines);
      const j = analyzeBand(lines2, Fm, W, R, a.cuts.slice());
      if (!j || j.kind !== 'table') continue;
      j.band = a.band; j.wideBefore = a.wideBefore; j._lines = lines2; j._wide = a._wide; j.joined = (a.joined || 1) + 1;
      out.splice(i, 2, j); i--;
    }
  }
  for (const a of out) { delete a._lines; delete a._wide; }
  for (const l of lines) delete l._pc;
  return { Fm, bands: out };
}

/* ---------- 채점 ---------- */
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
const overl = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

/** 정답 띠 하나 채점. pageRes = analyzePage 결과, L = 레이아웃(칸 채점용 run). */
export function scoreBand(key, pageRes, L, H, R = {}) {
  const Fm = pageRes.Fm, tol = 1.5;
  const ky = [key.y[0] - tol, key.y[1] + tol];
  const preds = pageRes.bands.filter((a) => a.kind === 'table' && overl(a.yAll || a.y, ky) >= -0.1);
  const r = { id: key.id, table: !!key.table, pred: preds.length > 0, feat: pageRes.bands.filter((a) => overl(a.yAll || a.y, ky) >= -0.1).map((a) => a.kind + ' b' + a.band + ' nc' + a.nc + ' m' + a.feat.multi + ' u' + a.feat.used + ' al' + a.feat.alignMin + ' d' + a.feat.dens + ' h' + a.headLines.length + ' ' + a.feat.cols.map((c) => c.n ? c.n + '/' + c.avg + '/' + c.full + '/' + c.align : '-').join(' ')) };
  if (!key.table) return r;
  // ---- 행 ----
  // 위첨자만 든 줄은 줄로 치지 않는다(아래 줄에 붙음)
  const tLines = pageLines(L, H).filter((l) => !(l.fontSize <= 0.8 * Fm && (l.runs || []).every((r) => String(r.text).replace(/\s/g, '').length <= 6)))
    .map((l) => l.baseline).filter((b) => b >= ky[0] && b <= ky[1]);
  const uniq = []; for (const b of tLines) if (!uniq.some((u) => Math.abs(u - b) <= K.MERGE_Y * Fm)) uniq.push(b);
  uniq.sort((a, b) => b - a);
  const near = (a, b) => Math.abs(a - b) <= tol;
  const nearR = (a, b) => Math.abs(a - b) <= 3.0;   // 행 시작·끝: 같은 줄의 baseline 이 위첨자로 몇 pt 갈릴 수 있다(행 사이는 9pt 이상)
  const kStarts = key.rows.map((x) => (Array.isArray(x) ? x[0] : x)).sort((a, b) => b - a);
  const kEnd = (i) => { const nx = kStarts[i + 1]; const ls = uniq.filter((b) => b <= kStarts[i] + tol && (nx == null || b > nx + tol) && !(key.head || []).some((h) => near(h, b))); return ls.length ? ls[ls.length - 1] : kStarts[i]; };
  const pRows = preds.flatMap((a) => a.rows.map((x) => ({ s: x.lines[0], e: x.lines[x.lines.length - 1] })));
  // 하위 행 묶음(T4): 행 하나 + 바로 뒤 하위 행들 = 한 행으로도 맞춘다
  for (const a of preds) a.rows.forEach((x, i) => { let j = i; while (j + 1 < a.rows.length && a.rows[j + 1].sub) { j++; const y = a.rows[j]; pRows.push({ s: x.lines[0], e: y.lines[y.lines.length - 1] }); } });
  let rowOk = 0;
  kStarts.forEach((s, i) => { const e = kEnd(i); if (pRows.some((p) => nearR(p.s, s) && nearR(p.e, e))) rowOk++; });
  r.rowMiss = kStarts.filter((st, i) => !pRows.some((p) => nearR(p.s, st) && nearR(p.e, kEnd(i)))).map((b) => b.toFixed(1));
  r.rowExtra = pRows.filter((p) => p.s >= ky[0] && p.s <= ky[1] && !kStarts.some((st) => nearR(st, p.s))).map((p) => p.s.toFixed(1));
  r.rows = [rowOk, kStarts.length];
  // ---- 칸 ----
  const kc = key.cuts.slice().sort((a, b) => a - b);
  const nk = kc.length + 1;
  const runs = [];
  const spanSet = (key.span || []);
  for (const l of pageLines(L, H)) {
    if (l.baseline < ky[0] || l.baseline > ky[1]) continue;
    if (spanSet.some((b) => near(b, l.baseline))) continue;            // 칸을 가로지르는 합친 칸 줄 — 칸 채점 밖
    if ((key.head || []).some((b) => near(b, l.baseline))) continue;  // 머리 줄은 머리 채점에서
    // 채점 단위 = 규칙과 무관하게 아이템 틈(≥ 0.3 × 글자 크기)으로 나눈 조각. 예측 칸은 예측이 쓴 단위(T6 면 조각, 아니면 앱 run)의 가운데로
    for (const x of l.runs || []) {
      const its = itemsIn(l, x.x0, x.x1); const rc = (x.x0 + x.x1) / 2;
      let cur = [];
      const flush = () => { if (!cur.length) return; const a = cur[0].x, b = Math.max(...cur.map((it) => it.x + (it.w || 0))); const t = joinItems(cur); runs.push({ x0: a, x1: b, n: t.replace(/\s/g, '').length, b: l.baseline, t: t.slice(0, 12), rc }); cur = []; };
      if (!its.length) { runs.push({ x0: x.x0, x1: x.x1, n: String(x.text).trim().length, b: l.baseline, t: String(x.text).slice(0, 12), rc }); continue; }
      for (let i = 0; i < its.length; i++) { if (i && !its[i].sup && its[i].x - (its[i - 1].x + (its[i - 1].w || 0)) >= 0.3 * (its[i].fontSize || l.fontSize)) flush(); cur.push(its[i]); }
      flush();
    }
  }
  const colBy = (cuts, x) => { let k = 0; while (k < cuts.length && x > cuts[k]) k++; return k; };
  const predFor = (rn) => preds.find((a) => rn.b >= (a.yAll || a.y)[0] - tol && rn.b <= (a.yAll || a.y)[1] + tol);
  const M = Array.from({ length: nk }, () => new Map());
  const tag = runs.map((rn) => {
    const kcol = colBy(kc, (rn.x0 + rn.x1) / 2);
    const crosses = kc.some((c) => rn.x0 < c - Fm && rn.x1 > c + Fm);
    const pa = predFor(rn);
    const pcol = pa ? (pa.band + ':' + colBy(pa.cuts, R.T6 ? (rn.x0 + rn.x1) / 2 : rn.rc)) : null;
    if (pcol) M[kcol].set(pcol, (M[kcol].get(pcol) || 0) + rn.n);
    return { kcol, pcol, crosses, n: rn.n, rn };
  });
  const best = M.map((m) => { let bk = null, bv = -1; for (const [k, v] of m) if (v > bv) { bk = k; bv = v; } return bk; });
  // 예측 칸 j 의 최다 정답 칸
  const back = new Map(); for (let k = 0; k < nk; k++) for (const [j, v] of M[k]) { const o = back.get(j); if (!o || v > o.v) back.set(j, { k, v }); }
  let cOk = 0, cAll = 0;
  r.bad = [];
  for (const t of tag) { cAll += t.n; if (t.pcol && !t.crosses && best[t.kcol] === t.pcol && back.get(t.pcol).k === t.kcol) cOk += t.n; else if (r.bad.length < 8) r.bad.push(t.rn.b.toFixed(1) + ' ' + Math.round(t.rn.x0) + '-' + Math.round(t.rn.x1) + ' ' + t.rn.t + ' k' + t.kcol + '>' + t.pcol + (t.crosses ? ' X' : '')); }
  r.cells = [cOk, cAll];
  // ---- 머리 ----
  const kh = key.headText || new Array(nk).fill('');
  let hOk = 0;
  for (let k = 0; k < nk; k++) {
    let ph = '';
    if (best[k]) { const [bi, j] = best[k].split(':').map(Number); const pa = preds.find((a) => a.band === bi); if (pa) ph = pa.head[j] || ''; }
    // 정답 머리는 'a|b' 로 대안을 둘 수 있다(묶음 머리가 어느 칸에 붙든 맞음)
    const b = norm(ph);
    const ok = String(kh[k] || '').split('|').some((alt) => {
      const a = norm(alt); const n = Math.min(a.length, b.length);
      return (!a && !b) || (a && b && a.slice(0, n) === b.slice(0, n) && n >= Math.min(4, a.length));
    });
    if (ok) hOk++;
  }
  r.head = [hOk, nk];
  r.headLines = [(preds[0] ? preds[0].headLines : []).length, (key.head || []).length];
  return r;
}

/* ---------- 실행 ---------- */
async function openDoc(pdfjs, file) { return pdfjs.getDocument({ url: file, verbosity: 0 }).promise; }

async function cmdScan(argv, pdfjs, R) {
  const [, file, fromArg, toArg] = positional(argv);
  const doc = await openDoc(pdfjs, file);
  const from = Math.max(1, Number(fromArg) || 1), to = Math.min(Number(toArg) || doc.numPages, doc.numPages);
  const t0 = performance.now(); const res = [];
  for (let p = from; p <= to; p++) {
    const { L, size } = await pageLayout(doc, p);
    const pr = analyzePage(L, size.width, size.height, R);
    // 그림 쪽(표 아님 목록 뽑기용 — 측정만, 규칙에는 쓰지 않는다): 줄머리 "Figure n" / "FIGURE n"
    const figPage = L.lines.some((l) => /^\W{0,3}(Figure|FIGURE|Fig\.)\s*[0-9IVX]/.test(l.text));
    for (const a of pr.bands) res.push({ p, band: a.band, kind: a.kind, nc: a.nc, nLines: a.nLines, nRows: a.nRows, y: a.y, yAll: a.yAll, cuts: a.cuts, chars: a.chars, regShare: a.regShare, wideBefore: a.wideBefore, joined: a.joined || 0, feat: a.feat, figPage, cols: L.columns.count });
    if (!pr.bands.length) res.push({ p, band: -1, kind: 'none', figPage, cols: L.columns.count });
  }
  const by = {}; for (const a of res) { if (a.band < 0) continue; by[a.kind] = by[a.kind] || { bands: 0, pages: new Set(), chars: 0 }; by[a.kind].bands++; by[a.kind].pages.add(a.p); by[a.kind].chars += a.chars || 0; }
  for (const k in by) by[k].pages = by[k].pages.size;
  console.log(`scan ${file.split(/[\\/]/).pop()} ${from}-${to} · ${Math.round(performance.now() - t0)} ms · rules ${JSON.stringify(R)}`);
  console.log(JSON.stringify(by));
  const o = argv.indexOf('--out'); if (o >= 0) fs.writeFileSync(argv[o + 1], JSON.stringify(res));
}

async function cmdShow(argv, pdfjs, R) {
  const [, file, list] = positional(argv);
  const doc = await openDoc(pdfjs, file);
  for (const p of list.split(',').map(Number)) {
    const { L, size } = await pageLayout(doc, p);
    const pr = analyzePage(L, size.width, size.height, R);
    console.log(`\n=== p${p} W${Math.round(size.width)} H${Math.round(size.height)} Fm${pr.Fm.toFixed(1)} cols${L.columns.count}`);
    for (const a of pr.bands) {
      console.log(`-- b${a.band} ${a.kind} nc=${a.nc} hc=${a.hc} gap=${a.gapMode} y=${a.yAll} cuts=${a.cuts} rows=${a.nRows}/${a.nLines} joined=${a.joined || 0} tr=${JSON.stringify(a.tr)}`);
      if (a.kind !== 'table' && !argv.includes('--all')) continue;
      console.log('   HEAD', JSON.stringify(a.head), 'lines', JSON.stringify(a.headLines));
      a.rows.forEach((r, k) => console.log(`   R${k} ${r.b} n${r.lines.length}${r.sec ? ' [구획]' : ''}${r.g ? ' {' + r.g + '}' : ''} ${JSON.stringify(r.c)}${r.lines.length > 1 ? ' ↓' + r.lines.slice(1).map((b) => Math.round(b)).join(',') : ''}`));
      if (a.foot.length) console.log('   FOOT', JSON.stringify(a.foot));
    }
  }
}

function pct(a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '—'; }

async function cmdScore(argv, pdfjs, R) {
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const key = JSON.parse(fs.readFileSync(opt('--key'), 'utf8'));
  const split = opt('--split') || 'all';
  const books = Object.assign({}, key.books);
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--book') { const [n, ...rest] = argv[i + 1].split('='); books[n] = rest.join('='); }
  const docs = {}; const getDoc = async (b) => (docs[b] = docs[b] || await openDoc(pdfjs, books[b]));
  const cache = new Map();
  const page = async (b, p) => { const k = b + ':' + p; if (!cache.has(k)) { const { L, size } = await pageLayout(await getDoc(b), p); cache.set(k, { L, H: size.height, pr: analyzePage(L, size.width, size.height, R) }); } return cache.get(k); };
  const t0 = performance.now();
  const bands = key.bands.filter((k) => split === 'all' || k.split === split);
  const S = { tp: 0, fp: 0, fn: 0, tn: 0, rows: [0, 0], cells: [0, 0], head: [0, 0], tables: 0, perfect: 0, rowsDet: [0, 0], cellsDet: [0, 0], headDet: [0, 0] };
  const lines = [];
  for (const k of bands) {
    const { L, H, pr } = await page(k.book, k.p);
    const r = scoreBand(k, pr, L, H, R);
    if (k.table && r.pred) S.tp++; else if (k.table) S.fn++; else if (r.pred) S.fp++; else S.tn++;
    let s = `${k.id.padEnd(10)} ${k.split} ${k.table ? 'T' : '-'}→${r.pred ? 'T' : '-'}`;
    if (k.table) {
      S.tables++;
      for (const f of ['rows', 'cells', 'head']) { S[f][0] += r[f][0]; S[f][1] += r[f][1]; if (r.pred) { S[f + 'Det'][0] += r[f][0]; S[f + 'Det'][1] += r[f][1]; } }
      if (r.rows[0] === r.rows[1] && r.cells[0] === r.cells[1] && r.head[0] === r.head[1]) S.perfect++;
      s += ` 행 ${r.rows[0]}/${r.rows[1]} 칸 ${pct(r.cells[0], r.cells[1])} 머리 ${r.head[0]}/${r.head[1]}`;
    }
    if (k.note) s += '  · ' + k.note;
    if (argv.includes('--feat')) s += '\n      ' + r.feat.join('\n      ');
    if (argv.includes('--cellv') && r.bad && r.bad.length) s += ' || ' + r.bad.join(' | ');
    if (argv.includes('--rowv') && r.rowMiss && (r.rowMiss.length || r.rowExtra.length)) s += ' || 행 놓침 ' + r.rowMiss.join(',') + ' · 덧 ' + r.rowExtra.join(',');
    lines.push(s);
  }
  // 표 아님 쪽 목록
  const negHits = [];
  let negPages = 0;
  if (argv.includes('--neg')) for (const n of key.neg || []) {
    if (split !== 'all' && n.split !== split) continue;
    for (const p of n.pages) {
      negPages++;
      const { pr } = await page(n.book, p);
      for (const a of pr.bands) if (a.kind === 'table') negHits.push(`${n.book} p${p} b${a.band} (${n.why}) y=${a.yAll} nc=${a.nc}` + (argv.includes('--feat') ? ` m${a.feat.multi} u${a.feat.used} al${a.feat.alignMin} d${a.feat.dens} rows${a.nRows}/${a.nLines} head${a.headLines.length} ` + a.feat.cols.map((c) => c.n ? c.n + '/' + c.avg + '/' + c.full + '/' + c.align : '-').join(' ') : ''));
      if (cache.size > 60) cache.clear();
    }
  }
  if (argv.includes('--v')) console.log(lines.join('\n'));
  const prec = S.tp / Math.max(1, S.tp + S.fp), rec = S.tp / Math.max(1, S.tp + S.fn), acc = (S.tp + S.tn) / Math.max(1, bands.length);
  const fpAll = S.fp + negHits.length;
  const pass = prec >= 0.95 && fpAll === 0 && S.rows[0] >= 0.95 * S.rows[1] && S.cells[0] >= 0.95 * S.cells[1] && S.head[0] >= 0.90 * S.head[1];
  console.log(`\n[${split}] 띠 ${bands.length} (표 ${S.tables}) · rules ${Object.entries(R).filter(([, v]) => v).map(([k]) => k).join(',') || 'base'} · ${Math.round(performance.now() - t0)} ms`);
  console.log(`표 판정  정밀도 ${pct(S.tp, S.tp + S.fp)} (${S.tp}/${S.tp + S.fp}) · 재현율 ${pct(S.tp, S.tp + S.fn)} · 정확도 ${pct(S.tp + S.tn, bands.length)}  [문턱 정밀도 ≥ 95%]`);
  console.log(`표 아님 오탐  띠 ${S.fp} + 표 아님 쪽 ${negHits.length}${argv.includes('--neg') ? ` (쪽 ${negPages})` : ' (--neg 안 돎)'}  [문턱 0]`);
  console.log(`행 ${pct(S.rows[0], S.rows[1])} (${S.rows[0]}/${S.rows[1]}) · 칸 ${pct(S.cells[0], S.cells[1])} · 머리 ${pct(S.head[0], S.head[1])} (${S.head[0]}/${S.head[1]})  [문턱 95·95·90 — 놓친 표 포함]`);
  console.log(`  잡힌 표만: 행 ${pct(S.rowsDet[0], S.rowsDet[1])} · 칸 ${pct(S.cellsDet[0], S.cellsDet[1])} · 머리 ${pct(S.headDet[0], S.headDet[1])} · 완전한 표 ${S.perfect}/${S.tables}`);
  if (negHits.length) console.log('  표 아님 쪽 오탐:\n   ' + negHits.slice(0, 40).join('\n   '));
  console.log(`문턱 ${pass ? '통과' : '못 넘음'}`);
}

async function main() {
  const argv = process.argv;
  const cmd = argv[2];
  const ri = argv.indexOf('--rules');
  const R = parseRules(ri >= 0 ? argv[ri + 1] : 'all');
  const pdfjs = await loadPdfjs(argv);
  if (cmd === 'scan') return cmdScan(argv, pdfjs, R);
  if (cmd === 'show') return cmdShow(argv, pdfjs, R);
  if (cmd === 'score') return cmdScore(argv, pdfjs, R);
  console.error('사용: measure-table-8i4.mjs scan|show|score … (머리 주석)'); process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
