/* ============================================================
   MedReader — 글 트리 (spec 17-2-1 4-3 4 · 11-D17 — 11-2 · 11c)

   요약의 요점(2단)·범위 개요(3단 — 11-3)를 **`<details>/<summary>` 중첩**으로 그린다.
     · 하위 요점이 있는 요점 → `<li><details open><summary>요점</summary><ul><li>…</li></ul></details></li>`
     · 없으면 `<li>요점</li>`
   ★ JS 없이 접힌다(11-D17) — 키보드(Enter·Space)·화면 읽기는 브라우저 기본 동작. RTL 에서 펼침 표시가 저절로 거울.
   ★ 글자는 전부 `appendBidiText`(대상 언어가 RTL 이면 라틴 괄호를 `<bdi dir=ltr>` 로) — `innerHTML` 0(13절).
   ★ 깊이 3까지(범위 개요가 3단). 그보다 깊은 줄은 그리지 않는다.
   ============================================================ */

import { appendBidiText } from './bididom.js';

/** 그리는 깊이 상한(범위 개요 3단 — 4-6). */
export const TREE_MAX_DEPTH = 3;

function textOf(node) {
  const t = typeof node === 'string' ? node : node && typeof node === 'object' ? node.t : '';
  return typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '';
}

function subOf(node) {
  return node && typeof node === 'object' && Array.isArray(node.sub) ? node.sub : [];
}

/**
 * 트리 모양 셈 — 그릴 줄 수·접히는 줄(하위가 있는 줄) 수. 순수 함수(그리기와 같은 규칙: 빈 줄 버림 · 깊이 3).
 * @param {Array} points
 * @returns {{lines:number, foldable:number}}
 */
export function treeShape(points) {
  let lines = 0;
  let foldable = 0;
  (function walk(arr, depth) {
    for (const n of Array.isArray(arr) ? arr : []) {
      if (!textOf(n)) continue;
      lines++;
      const sub = depth < TREE_MAX_DEPTH ? subOf(n).filter((x) => !!textOf(x)) : [];
      if (sub.length) { foldable++; walk(sub, depth + 1); }
    }
  })(points, 1);
  return { lines: lines, foldable: foldable };
}

/**
 * 요점 트리 → `<ul class="sum-tree">`. 빈 트리면 null.
 * @param {Array} points  `[{t, sub:[string]}]`(요약 2단) 또는 `[{t, sub:[{t, sub:[string]}]}]`(개요 3단). 문자열 줄도 받는다
 * @param {{dir?:string, lang?:string, open?:boolean, doc?:Document}} [opts]  `open:false` 면 접힌 채(쪽 요약 화면)
 * @returns {?Element}
 */
export function renderTree(points, opts) {
  const o = opts || {};
  const doc = o.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  const dir = o.dir === 'rtl' ? 'rtl' : 'ltr';
  const open = o.open !== false;
  function line(el, text) { appendBidiText(el, text, dir); }
  function level(arr, depth) {
    const ul = doc.createElement('ul');
    ul.className = depth === 1 ? 'sum-tree' : 'sum-tree-sub';
    for (const n of Array.isArray(arr) ? arr : []) {
      const t = textOf(n);
      if (!t) continue;
      const li = doc.createElement('li');
      const sub = depth < TREE_MAX_DEPTH ? subOf(n).filter((x) => !!textOf(x)) : [];
      if (sub.length) {
        const det = doc.createElement('details');
        if (open) det.open = true;
        const sm = doc.createElement('summary');
        line(sm, t);
        det.appendChild(sm);
        det.appendChild(level(sub, depth + 1));
        li.appendChild(det);
      } else {
        line(li, t);
      }
      ul.appendChild(li);
    }
    return ul;
  }
  const root = level(points, 1);
  if (!root.firstChild) return null;
  if (o.lang) root.setAttribute('lang', o.lang);
  root.setAttribute('dir', dir);
  return root;
}

/** 트리 안 `<details>` 전부를 열거나 닫는다([모두 접기]/[모두 펼치기]). @returns {number} 바꾼 수 */
export function setAllOpen(root, open) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let n = 0;
  for (const d of root.querySelectorAll('details')) { if (d.open !== !!open) { d.open = !!open; n++; } }
  return n;
}

/** 열린 `<details>` 가 하나라도 있는가(한 단추의 글자 — 열린 게 있으면 [모두 접기]). */
export function anyOpen(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return false;
  for (const d of root.querySelectorAll('details')) if (d.open) return true;
  return false;
}
