/* ============================================================
   MedReader — 범위 고르기 부품 (spec 17-13 2 · 15-D11 — 15-2)

   ── 하는 일 ─────────────────────────────────────────────
   한 책의 PDF 쪽 구간 `[a, b]` 를 고르는 규칙과 칸을 **한 곳**에 둔다. 11-3(요약 모아 보기)·13-2(학습 계획)·15-2(복습 묶음)가 쓴다.
     · `chapterRanges(toc, pageCount)` — **13-2 에서 옮김**(동작 무변): `tocOf` 의 위 두 깊이(깊이 0·1) 항목, 장 끝 = **같거나 얕은 깊이의**
       다음 항목 쪽 − 1(13-2 정정 ④ — "다음 항목"을 그대로 쓰면 장의 끝이 첫 절 앞이 된다), 마지막·쪽이 뒤로 가는 폴백은 문서 끝.
       13-2 계획 폼과 15-2 묶음 화면이 쓴다.
     · `chaptersOf(doc)`·`chapterAt` — **11-3 에서 옮김**(동작 무변): 문서 개요(`documents.outline`)의 맨 위 깊이만 — 11-3 모아 보기의
       장 머리·범위 개요 고르기가 쓴다. (11-3 의 고르기를 깊이 0·1 로 넓히는 것은 11-3 동작이 바뀌므로 이번엔 하지 않는다 — 보고서.)
     · `printedRange` — 인쇄 쪽 라벨(8g `pageLabels`) 한 쌍 · `chapterOptionText` — 장 고르기 줄 글(13-2 와 같은 꼴).
     · `createRangePick` — 15-2 묶음 화면의 [범위 바꾸기] 칸(장 ▾ | 쪽 a–b + 인쇄 라벨). 13-2 폼의 칸과 같은 문구·같은 CSS.
   **AI 호출 0 · 저장 0.** 글자는 textContent 로만.
   ============================================================ */

import { t, formatNumber } from '../i18n/index.js';
import { printedLabel, isOutlineCurrent, isJunkOutline } from '../search/outline.js';
import { clean } from '../text/summary.js';

/* ────────────────────────────────────────────────────────
   1. 순수 — 규칙 (tests/review-ui-15.test.mjs · planner-ui-13 · summaries-ui-11c)
   ──────────────────────────────────────────────────────── */

/** 장 이름 상한(13-2 `LABEL_MAX` 와 같은 값). */
export const CHAPTER_TITLE_MAX = 80;

const cut = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * 장 고르기 목록 — `tocOf` 의 위 두 깊이(쪽 있는 항목). 장 `to` = 다음 항목(같거나 얕은 깊이) 쪽 − 1, 마지막은 문서 끝.
 * (13-2 `ui/planner.js` 에서 옮김 — 글자 그대로.)
 * @returns {{title:string, from:number, to:number, d:number}[]}
 */
export function chapterRanges(toc, pageCount) {
  const items = (toc && Array.isArray(toc.items) ? toc.items : []).filter((x) => x && Number.isInteger(x.p) && x.p >= 1 && cut(x.t, 1));
  if (!items.length) return [];
  let top = Infinity;
  for (const x of items) top = Math.min(top, Number(x.d) || 1);
  const end = Number(pageCount) > 0 ? Math.floor(Number(pageCount)) : 0;
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const d = Number(items[i].d) || 1;
    if (d > top + 1) continue;
    const from = items[i].p;
    let to = Math.max(from, end);
    for (let j = i + 1; j < items.length; j++) {
      if ((Number(items[j].d) || 1) <= d && items[j].p > from) { to = items[j].p - 1; break; }
    }
    out.push({ title: cut(items[i].t, CHAPTER_TITLE_MAX), from: from, to: Math.max(from, to), d: d - top });
  }
  return out;
}

/**
 * 문서의 장 — `documents.outline`(8g) 의 **맨 위 깊이** 항목(쪽이 있는 것)을 쪽 순서로. 개요를 아직 못 읽었거나·없거나·
 * 파일 이름뿐인 쓰레기 개요면 빈 배열(그러면 쪽 라벨로 묶는다). 장 `to` = 다음 장 앞 쪽(마지막은 문서 끝).
 * (11-3 `ui/summaries.js` 에서 옮김 — 글자 그대로.)
 * @returns {{title:string, from:number, to:number}[]}
 */
export function chaptersOf(doc) {
  if (!doc || !isOutlineCurrent(doc) || !doc.outline.length || isJunkOutline(doc.outline)) return [];
  const items = doc.outline.filter((x) => x && Number.isInteger(x.p) && x.p >= 1 && clean(x.t));
  if (!items.length) return [];
  let top = Infinity;
  for (const x of items) top = Math.min(top, Number(x.d) || 1);
  const heads = items.filter((x) => (Number(x.d) || 1) === top).sort((a, b) => a.p - b.p);
  const out = [];
  for (const h of heads) {
    if (out.length && out[out.length - 1].from === h.p) continue;      // 같은 쪽에서 시작하는 장 — 앞 것
    out.push({ title: clean(h.t), from: h.p, to: h.p });
  }
  const end = Number(doc.pageCount) > 0 ? Math.floor(Number(doc.pageCount)) : 0;
  for (let i = 0; i < out.length; i++) {
    out[i].to = i + 1 < out.length ? Math.max(out[i].from, out[i + 1].from - 1) : Math.max(out[i].from, end);
  }
  return out;
}

/** 그 쪽이 든 장 번호(없으면 -1 — 첫 장 앞 쪽 등). (11-3 에서 옮김.) */
export function chapterAt(chapters, page) {
  const p = Number(page);
  const list = Array.isArray(chapters) ? chapters : [];
  for (let i = 0; i < list.length; i++) if (p >= list[i].from && p <= list[i].to) return i;
  return -1;
}

/** 쪽 구간 정규화 — 정수 · 거꾸로면 바로잡음 · 1 이상 · 문서 끝(`pageCount` > 0 이면) 안. 꼴이 틀리면 null. */
export function normPages(a, b, pageCount) {
  let x = Math.floor(Number(a));
  let y = Math.floor(Number(b === undefined || b === '' ? a : b));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x > y) { const k = x; x = y; y = k; }
  const end = Number(pageCount) > 0 ? Math.floor(Number(pageCount)) : Infinity;
  if (x < 1 || y > end) return null;
  return [x, y];
}

/**
 * 범위가 없을 때 고를 범위(15-2 — "읽던 장"): `chapterRanges` 중 그 쪽이 든 **맨 위 깊이(d 0)** 장, 없으면 든 것 중 가장 좁은 것,
 * 그것도 없으면(목차 없음) 그 쪽 하나.
 * @returns {[number, number]}
 */
export function defaultRange(chapters, page, pageCount) {
  const end = Number(pageCount) > 0 ? Math.floor(Number(pageCount)) : Infinity;
  const p = Math.min(Math.max(1, Math.floor(Number(page)) || 1), end);
  const has = (Array.isArray(chapters) ? chapters : []).filter((c) => c && p >= c.from && p <= c.to);
  const top = has.filter((c) => !c.d);
  const pick = top[0] || has.slice().sort((x, y) => (x.to - x.from) - (y.to - y.from))[0] || null;
  return pick ? [pick.from, pick.to] : [p, p];
}

/** 정확히 그 범위인 장(제목 머리) — 없으면 null. 같은 범위가 여럿이면 얕은 것. */
export function chapterOfRange(chapters, a, b) {
  const list = (Array.isArray(chapters) ? chapters : []).filter((c) => c && c.from === Number(a) && c.to === Number(b));
  list.sort((x, y) => (Number(x.d) || 0) - (Number(y.d) || 0));
  return list[0] || null;
}

/** 인쇄 쪽 라벨 한 쌍 — 둘 다 없으면 null(그때는 PDF 쪽만 보인다). */
export function printedRange(labels, a, b) {
  const la = printedLabel(labels, Math.floor(Number(a)));
  const lb = printedLabel(labels, Math.floor(Number(b)));
  if (!la && !lb) return null;
  return { a: la || String(a), b: lb || String(b) };
}

/** 장 고르기 줄 글 — 13-2 폼과 같은 꼴(깊이 1 이면 앞에 "— "). */
export function chapterOptionText(c) {
  return (c.d > 0 ? '— ' : '') + c.title + ' (' + t('planner.range.pages', { a: formatNumber(c.from), b: formatNumber(c.to) }) + ')';
}

/* ────────────────────────────────────────────────────────
   2. 칸 — [범위 바꾸기] (15-2 묶음 화면)
   ──────────────────────────────────────────────────────── */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

let seq = 0;

/**
 * 범위 고르기 칸 하나를 `host` 에 그린다(이전 내용은 지운다). [보기]를 누르면 `onPick([a, b])` · [취소]는 `onCancel()`.
 * @param {HTMLElement} host
 * @param {{chapters:Object[], labels:?Array, pageCount:number, value:[number, number], onPick:Function, onCancel?:Function}} o
 * @returns {{mode:()=>string, value:()=>?[number, number]}}
 */
export function createRangePick(host, o) {
  const x = o || {};
  while (host.firstChild) host.removeChild(host.firstChild);
  const id = 'rp' + (++seq);
  const chapters = Array.isArray(x.chapters) ? x.chapters : [];
  const cur = Array.isArray(x.value) ? x.value : [1, 1];
  const box = el('div', 'rp-box');
  box.setAttribute('data-rp', '1');

  const modeLab = el('label', 'pl-label', t('planner.form.mode'));
  modeLab.htmlFor = id + 'm';
  const mode = el('select', 'pl-input rp-mode');
  mode.id = id + 'm';
  for (const [v, k] of [['chapter', 'planner.form.mode.chapter'], ['pages', 'planner.form.mode.pages']]) {
    const op = el('option', '', t(k));
    op.value = v;
    mode.appendChild(op);
  }
  box.appendChild(modeLab);
  box.appendChild(mode);
  const noToc = el('p', 'muted rp-notoc', t('planner.form.noToc'));
  box.appendChild(noToc);

  const chRow = el('div', 'pl-field rp-chrow');
  const chLab = el('label', 'pl-label', t('planner.form.chapter'));
  chLab.htmlFor = id + 'c';
  const ch = el('select', 'pl-input rp-chapter');
  ch.id = id + 'c';
  let selIdx = -1;
  chapters.forEach((c, i) => {
    const op = el('option', '', chapterOptionText(c));
    op.value = String(i);
    ch.appendChild(op);
    if (selIdx < 0 && c.from === cur[0] && c.to === cur[1]) selIdx = i;
  });
  if (selIdx >= 0) ch.value = String(selIdx);
  chRow.appendChild(chLab);
  chRow.appendChild(ch);
  box.appendChild(chRow);

  const grid = el('div', 'pl-grid rp-pages');
  const mk = (suffix, key, v) => {
    const f = el('div', 'pl-field');
    const lab = el('label', 'pl-label', t(key));
    lab.htmlFor = id + suffix;
    const inp = el('input', 'pl-input rp-' + suffix);
    inp.id = id + suffix;
    inp.type = 'number'; inp.min = '1'; inp.step = '1'; inp.inputMode = 'numeric';
    if (Number(x.pageCount) > 0) inp.max = String(Math.floor(Number(x.pageCount)));
    inp.value = String(v);
    f.appendChild(lab);
    f.appendChild(inp);
    grid.appendChild(f);
    return inp;
  };
  const from = mk('from', 'planner.form.from', cur[0]);
  const to = mk('to', 'planner.form.to', cur[1]);
  const printed = el('p', 'muted pl-printed rp-printed');
  grid.appendChild(printed);
  box.appendChild(grid);

  const err = el('p', 'rp-err');
  err.setAttribute('role', 'status');
  box.appendChild(err);
  const row = el('div', 'pl-row rp-actions');
  const ok = el('button', 'primary', t('review.range.apply'));
  ok.type = 'button';
  ok.setAttribute('data-rp-act', 'apply');
  const cancel = el('button', '', t('common.cancel'));
  cancel.type = 'button';
  cancel.setAttribute('data-rp-act', 'cancel');
  row.appendChild(ok);
  row.appendChild(cancel);
  box.appendChild(row);
  host.appendChild(box);

  const paintPrinted = () => {
    const pr = printedRange(x.labels, from.value, to.value);
    printed.textContent = pr ? t('planner.range.printed', { a: pr.a, b: pr.b }) : '';
  };
  const paintMode = () => {
    const hasCh = chapters.length > 0;
    mode.querySelector('option[value="chapter"]').disabled = !hasCh;
    if (!hasCh) mode.value = 'pages';
    const c = mode.value === 'chapter';
    chRow.hidden = !c;
    grid.hidden = c;
    noToc.hidden = hasCh;
    paintPrinted();
  };
  const value = () => {
    if (mode.value === 'chapter') { const c = chapters[Number(ch.value)]; return c ? [c.from, c.to] : null; }
    return normPages(from.value, to.value, x.pageCount);
  };
  mode.value = chapters.length && selIdx >= 0 ? 'chapter' : (chapters.length && !(cur[0] && cur[1]) ? 'chapter' : 'pages');
  mode.addEventListener('change', paintMode);
  from.addEventListener('input', paintPrinted);
  to.addEventListener('input', paintPrinted);
  ok.addEventListener('click', () => {
    const v = value();
    if (!v) { err.textContent = t('planner.err.pages'); return; }
    err.textContent = '';
    if (typeof x.onPick === 'function') x.onPick(v);
  });
  cancel.addEventListener('click', () => { if (typeof x.onCancel === 'function') x.onCancel(); });
  paintMode();
  return { mode: () => mode.value, value: value };
}
