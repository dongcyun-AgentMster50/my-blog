/* ============================================================
   MedReader — 문장 아래 번역(대역) (spec 7-7-1 · 6-5 · 7-6 · 14-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   9-3 `readalong.display = 'inline'` 이고 **리플로우 뷰**일 때, 이미 받은 번역(낭독 동반 번역의
   메모리·캐시)을 그 문장이 끝나는 줄 바로 아래에 `span.ra-tr` 로 그린다(권장안 (b) 누적 — 읽은 문장마다 남는다).
     · 쪽을 그릴 때(I4 (i)) — 그 쪽 문장 중 번역이 있는 것 전부를 한 번에(메모리는 동기, 캐시는 읽기만)
     · 문장이 현재가 될 때(I4 (ii)) — 블록이 없으면 넣는다. 아직이면 "번역 중…" 한 줄(I5)
     · 이미 지나간 문장의 번역이 늦게 오면(I4 (iii)) — 펼치지 않고 **같은 높이의 한 줄** "눌러서 보기"
     · 표시 방식 `band`·대상 언어 변경·유효 모드 `off` → 전부 지운다(I7)
   띠(`ui/trband.js`)는 그대로 두고, 이 모드에서는 `<html data-tr-inline="on">` 을 건다 — CSS 가 띠를 감추고
   `--reader-chrome-bottom` 을 띠 없는 값(138px)으로 돌린다(tokens.css 한 곳). 원본 뷰는 늘 띠다.

   ── 지키는 것 ──────────────────────────────────────────
   ★ I1 블록은 `p.para` 안 어떤 `span.line` 의 **다음 형제**로만 들어간다. `span.line` 의 자식(첫 텍스트 노드·`.hy`·
     이음 공백)은 건드리지 않는다 → 10a 하이라이트(`Range` 가 텍스트 노드 오프셋을 가리킴)·줄 탭·`lineElement` 불변.
     블록은 `line` 클래스·`data-line-id`·`data-flow` 를 갖지 않는다.
   ★ 현재 문장보다 **위**에서는 넣거나 빼지 않는다(7-7-1 권장 근거 1). 지나간 블록의 상태 줄은 모두 같은 높이
     (`--tap` 한 줄)라 바뀌어도 현재 문장이 움직이지 않는다.
   ★ 요청하지 않는다 — `ai/pipeline.js` 를 import 하지 않는다(서비스는 controls 가 주입한 `readalong` 객체뿐).
     캐시 키는 readalong 의 `cachedFor`(refill 과 같은 키 함수) 하나다.
   ★ 번역문은 `appendBidiText`(8b-2 와 같은 함수)·조각마다 textContent(13절). `innerHTML` 0.
   ★ 리더(`reader.js`)를 import 하지 않는다 — 줄 찾기·다시 그림 알림·편안 영역 다시 보기를 controls 가 넘긴다(3-2).
   ============================================================ */

import * as settings from '../settings.js';
import { t, getDir, getLang, onLangChange } from '../i18n/index.js';
import { normalizeTranslationLang, translationBlockAttrs, normalizeReadalongDisplay } from './settings.js';
import { appendBidiText } from './bididom.js';
import { noteKeyFor } from './trband.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — `tests/inlinetr-8d.test.mjs` 가 고정한다
   ──────────────────────────────────────────────────────── */

/** 블록 클래스. `line` 이 아니다(I1). */
export const BLOCK_CLASS = 'ra-tr';
/** 표 안내 단위(`tts/text.js` `TABLE_NOTICE_KIND`) — 앵커가 아니다(I2). */
const NOTICE_KIND = 'table-notice';
const NOTICE_ID_PREFIX = 'tablenotice:';

/**
 * 이 화면에서 문장 아래 표시가 켜지는가. 순수 함수.
 * @param {string} display  9-3 `readalong.display`
 * @param {string} mode     유효 모드(7-8-1) `off|show|speak`
 * @param {boolean} reflow  지금 리플로우 뷰인가(원본 뷰는 늘 띠 — 7-7-1)
 */
export function inlineOn(display, mode, reflow) {
  return normalizeReadalongDisplay(display) === 'inline' && (mode === 'show' || mode === 'speak') && !!reflow;
}

/**
 * I2 — 한 단위가 끝나는 줄 id. `ranges` 의 마지막 항목, 없으면(300자 분할 — 6-5) `lineIds` 의 마지막.
 * @returns {string|null}
 */
export function anchorIdOf(u) {
  if (!u) return null;
  const rs = Array.isArray(u.ranges) ? u.ranges : null;
  if (rs && rs.length) {
    const r = rs[rs.length - 1];
    if (r && r.id != null) return String(r.id);
  }
  const ids = Array.isArray(u.lineIds) ? u.lineIds : [];
  return ids.length && ids[ids.length - 1] != null ? String(ids[ids.length - 1]) : null;
}

/**
 * I2 — 큐(낭독과 같은 단위)의 문장마다 앵커 줄. 문장의 **마지막 단위**가 끝나는 줄이다. 표 안내·인용(seg 없음)·
 * `translatable` 이 거짓인 단위(`[8m]` 대상 언어와 같은 언어)는 뺀다. seg 오름차순. 순수 함수.
 * @param {Array} units
 * @param {(u:Object)=>boolean} [translatable]
 * @returns {{seg:number, anchor:string}[]}
 */
export function anchorsOf(units, translatable) {
  const list = Array.isArray(units) ? units : [];
  const last = new Map();
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u || !Number.isInteger(u.seg) || u.kind === NOTICE_KIND) continue;
    if (typeof translatable === 'function' && !translatable(u)) continue;
    last.set(u.seg, u);
  }
  const out = [];
  last.forEach((u, seg) => {
    const id = anchorIdOf(u);
    if (id != null && id.indexOf(NOTICE_ID_PREFIX) !== 0) out.push({ seg: seg, anchor: id });
  });
  return out.sort((a, b) => a.seg - b.seg);
}

/** 이 노드가 번역 블록인가. */
export function isBlock(n) {
  return !!n && n.nodeType === 1 && !!n.classList && n.classList.contains(BLOCK_CLASS);
}

function segOfBlock(n) { return Number(n.getAttribute('data-ra-seg')); }

/**
 * I1·I2 — 블록을 앵커 줄(`span.line`) **바로 다음 형제** 자리에 넣는다. 그 줄 뒤에 이미 블록이 있으면 seg 순서로 쌓는다.
 * 줄 span 안은 건드리지 않는다.
 */
export function placeBlock(anchorEl, block) {
  const parent = anchorEl && anchorEl.parentNode;
  if (!parent) return false;
  const seg = segOfBlock(block);
  // 8i 행 표 이름표 끝의 쪽 번호(`span.rt-ref` — 줄이 아니다)는 그 줄에 붙어 있게 넘어간다(실측 CMDT 25쪽 — 번역이 이름표와 쪽 번호 사이에 끼었다).
  const nx = anchorEl.nextSibling;
  let ref = nx && nx.nodeType === 1 && nx.classList && nx.classList.contains('rt-ref') ? nx.nextSibling : nx;
  while (ref && isBlock(ref) && segOfBlock(ref) < seg) ref = ref.nextSibling;
  parent.insertBefore(block, ref || null);
  return true;
}

/** 빈 블록 — `span.ra-tr[data-ra-seg][dir][lang]`. `display:block` 은 CSS 가 준다(`<p>` 안에 `<div>` 를 두지 않는다). */
export function makeBlock(doc, seg, lang) {
  const a = translationBlockAttrs(lang);
  const b = doc.createElement('span');
  b.className = BLOCK_CLASS;
  b.setAttribute('data-ra-seg', String(seg));
  b.setAttribute('dir', a.dir);
  b.setAttribute('lang', a.lang);
  return b;
}

function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

/** 번역문을 채운다(7-7-1 — `appendBidiText`, 조각마다 textContent). */
export function renderReady(block, text, lang) {
  const a = translationBlockAttrs(lang);
  const doc = block.ownerDocument;
  clearNode(block);
  block.setAttribute('data-state', 'ready');
  block.setAttribute('dir', a.dir);
  block.setAttribute('lang', a.lang);
  const tx = doc.createElement('span');
  tx.className = 'ra-text';
  appendBidiText(tx, text, a.dir);
  block.appendChild(tx);
}

/** 상태 한 줄 그릇 — UI 언어·UI 방향. 높이는 CSS 가 `--tap` 하나로 고정한다(I4 (iii) "같은 높이"). */
function statusLine(block, state) {
  const doc = block.ownerDocument;
  clearNode(block);
  block.setAttribute('data-state', state);
  const line = doc.createElement('span');
  line.className = 'ra-line';
  line.setAttribute('dir', getDir());
  line.setAttribute('lang', getLang());
  block.appendChild(line);
  return line;
}

/**
 * I5 — "번역 중…" · "번역 실패" + [다시 시도] · 막힘 사유 한 줄. 문구는 띠와 같은 규칙(`noteKeyFor`).
 * @param {{state:string, noteKey:string|null, retry:boolean}} v
 */
export function renderNote(block, v) {
  const line = statusLine(block, v.state);
  const doc = block.ownerDocument;
  const note = doc.createElement('span');
  note.className = 'ra-note';
  note.textContent = v.noteKey ? t(v.noteKey) : '';
  line.appendChild(note);
  if (v.retry) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'ra-retry';
    b.setAttribute('data-ra-action', 'retry');
    b.textContent = t('readalong.retry');
    line.appendChild(b);
  }
}

/** I4 (iii) — 지나간 문장의 번역이 늦게 왔다. 펼치지 않고 같은 높이의 한 줄(버튼). */
export function renderArrived(block) {
  const line = statusLine(block, 'arrived');
  const b = block.ownerDocument.createElement('button');
  b.type = 'button';
  b.className = 'ra-show';
  b.setAttribute('data-ra-action', 'show');
  b.textContent = t('readalong.inline.arrived');
  line.appendChild(b);
}

/* ────────────────────────────────────────────────────────
   2. 화면
   ──────────────────────────────────────────────────────── */

let els = null;
let ra = null;
let sp = null;
let findLine = null;
let recheck = null;
let active = false;
/** speaker 의 마지막 큐(낭독과 **같은 단위** — 7-8-2) 와 그 쪽 번호. */
let queue = { units: null, page: null };
/** 마지막으로 그린 것 — 같은 DOM·같은 대상 언어면 다시 그리지 않는다(I4 (ii) "현재가 될 때까지 넣지 않는다"). */
let painted = { article: null, target: null };
/** 지금 문장. `seg` 가 null 이면 번역 대상 아님(표 안내 · `[8m]` 같은 언어). */
let cur = { seg: null, page: null, src: null };
let phase = 'src';
let gen = 0;
/** 상태 줄을 단 블록 → 그 문장의 상태 구독 해제 함수. */
const watchers = new Map();
/** 블록 → 문장 원문(DOM 에 원문을 적지 않는다). */
let srcOf = new WeakMap();

/**
 * @param {{readalong:Object, speaker:Object, mount:Element, root?:Element,
 *          lineElement:(id:string)=>Element|null, onPageRepaint?:Function, recheck?:Function}} deps
 *   `recheck` — 현재 블록이 커졌을 때 6-5 편안 영역을 다시 본다(controls → `showSpoken`).
 * @returns {{sync:Function, willShow:Function, leave:Function}}
 */
export function initInlineTr(deps) {
  const d = deps || {};
  if (els || typeof document === 'undefined') return api();
  if (!d.readalong || !d.speaker || !d.mount || typeof d.lineElement !== 'function') return api();
  els = { mount: d.mount, root: d.root || null };
  ra = d.readalong;
  sp = d.speaker;
  findLine = d.lineElement;
  recheck = typeof d.recheck === 'function' ? d.recheck : null;

  // 큐는 기억만 한다 — 그리기는 `sync()`(controls 의 `syncReadalong` 끝 — 문서·유효 모드를 맞춘 **뒤**)가 한다.
  sp.addEventListener('queue', (ev) => {
    const x = ev.detail || {};
    queue = { units: Array.isArray(x.units) ? x.units : null, page: x.page == null ? null : Number(x.page) };
  });
  sp.addEventListener('phasechange', (ev) => setPhase((ev.detail || {}).phase));
  ra.addEventListener('mode', () => sync());
  document.addEventListener('medreader:readalong-display', () => sync());
  // 언어 바꿈·검색 화면에서 돌아옴 — DOM 을 새로 붙였다(쪽 알림 없이). 그린 것이 없어졌으면 다시(I4 (i)).
  if (typeof d.onPageRepaint === 'function') d.onPageRepaint(() => sync());
  onLangChange(() => relabel());
  els.mount.addEventListener('click', onClick);
  attachDebugHook();
  return api();
}

function api() { return { sync: sync, willShow: willShow, leave: leave }; }

function targetLang() { return normalizeTranslationLang(settings.get('ai.translationLang')); }

function article() { return els && els.mount ? els.mount.querySelector('article.reflow') : null; }

function pageOf(art) {
  const s = art ? art.querySelector('section.page') : null;
  const n = s ? Number(s.getAttribute('data-page')) : NaN;
  return Number.isFinite(n) ? n : null;
}

function blockOf(art, seg) {
  return art ? art.querySelector('.' + BLOCK_CLASS + '[data-ra-seg="' + seg + '"]') : null;
}

/**
 * 유효 모드·표시 방식·뷰를 읽어 켜고 끈다. controls 의 `syncReadalong()` 끝(쪽 그리기·재생·모드 줄)과
 * `mode` 이벤트·표시 방식 변경·다시 그림 알림에서 불린다.
 */
export function sync() {
  if (!els || !ra) return;
  attachDebugHook();
  const m = (ra.mode() || {}).mode || 'off';
  const art = article();
  const on = inlineOn(settings.get('readalong.display'), m, !!art);
  if (on) document.documentElement.setAttribute('data-tr-inline', 'on');
  else document.documentElement.removeAttribute('data-tr-inline');
  if (!on) {
    if (active || anyBlock()) clearAll();
    active = false;
    return;
  }
  const target = targetLang();
  if (painted.target !== null && painted.target !== target) clearAll();      // I7 — 대상 언어가 바뀌었다
  active = true;
  paint(art, target);
}

/** 리더를 떠난다 — 띠 자리 표시를 거두고 상태를 비운다(DOM 은 리더가 비운다). */
export function leave() {
  if (!els) return;
  clearAll();
  active = false;
  cur = { seg: null, page: null, src: null };
  queue = { units: null, page: null };
  document.documentElement.removeAttribute('data-tr-inline');
}

function anyBlock() { return !!(els && els.mount && els.mount.querySelector('.' + BLOCK_CLASS)); }

/** I7 — `els.mount` 안의 `.ra-tr` 전부와 구독을 지운다. */
function clearAll() {
  gen++;
  watchers.forEach((off) => { try { off(); } catch (e) { /* 이미 풀림 */ } });
  watchers.clear();
  srcOf = new WeakMap();
  if (els && els.mount) {
    const list = els.mount.querySelectorAll('.' + BLOCK_CLASS);
    for (let i = 0; i < list.length; i++) if (list[i].parentNode) list[i].parentNode.removeChild(list[i]);
  }
  painted = { article: null, target: null };
}

/**
 * ★ 7-7-1 "캐시에서 다시 그리기"(`paintInline`) — 호출 0. 쪽을 새로 그렸을 때(DOM 이 바뀜)·표시 방식을 바꿨을 때 한 번.
 * 메모리 적중은 **동기로** 넣는다(스크롤 위치를 잡기 전 — I4 (i)), 캐시 적중은 읽힌 뒤 넣되 지금 문장보다 위는 넣지 않는다.
 */
function paint(art, target) {
  if (!art) return;
  if (painted.article === art && painted.target === target) return;
  const page = pageOf(art);
  const units = queue.units;
  if (!units || queue.page !== page) return;                       // 이 쪽의 큐를 아직 모른다 — 다음 sync 가 그린다
  painted = { article: art, target: target };
  // 다른 쪽을 그렸다 — 지난 쪽의 "지금 문장"은 이 쪽 것이 아니다(돌아와도 낭독이 그 문장에 있지 않다).
  if (cur.page !== page) cur = { seg: null, page: null, src: null };
  // 버려진 DOM 의 상태 줄 구독은 거둔다(쪽을 넘기면 DOM 이 통째로 갈린다 — I7).
  Array.from(watchers.keys()).forEach((b) => { if (!art.contains(b)) unwatch(b); });
  const g = ++gen;
  const list = anchorsOf(units, (u) => ra.translatable(u));
  insertReady(art, list, ra.readyNow(units), target, false);
  // 같은 쪽을 다시 그렸다(뷰 전환·표시 방식 변경) — 지금 문장은 아직 번역 중이어도 상태 줄을 단다(I5).
  if (cur.seg !== null && cur.page === page) ensureCurrentBlock(art, { seg: cur.seg, src: cur.src });
  markCurrent(art);
  Promise.resolve()
    .then(() => ra.cachedFor(units))
    .then((hits) => {
      if (g !== gen || !active || article() !== art) return;
      insertReady(art, list, hits, target, true);
      markCurrent(art);
    })
    .catch(() => { /* 캐시 읽기 실패 — 그리지 않을 뿐 */ });
}

/** 번역이 있는 문장마다 블록을 넣는다. 이미 있으면 그대로(지금 문장의 상태 줄만 채운다). */
function insertReady(art, list, hits, target, late) {
  if (!hits || !hits.size) return;
  const curHere = cur.seg !== null && cur.page === pageOf(art) ? cur.seg : null;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const h = hits.get(it.seg);
    if (!h) continue;
    // 늦게 읽힌 캐시는 지금 문장보다 위에 넣지 않는다 — 넣으면 지금 문장이 내려간다(7-7-1 권장 근거 1).
    if (late && curHere !== null && it.seg < curHere) continue;
    const have = blockOf(art, it.seg);
    if (have) {
      if (it.seg === curHere && have.getAttribute('data-state') !== 'ready') { renderReady(have, h.text, target); unwatch(have); }
      continue;
    }
    const anchor = findLine(it.anchor);
    if (!anchor || !art.contains(anchor)) continue;
    const b = makeBlock(art.ownerDocument, it.seg, target);
    srcOf.set(b, h.src);
    renderReady(b, h.text, target);
    placeBlock(anchor, b);
  }
}

function markCurrent(art) {
  const was = art.querySelectorAll('.' + BLOCK_CLASS + '[data-ra-current]');
  for (let i = 0; i < was.length; i++) { was[i].removeAttribute('data-ra-current'); was[i].removeAttribute('data-speaking'); }
  if (cur.seg === null || cur.page !== pageOf(art)) return null;
  const b = blockOf(art, cur.seg);
  if (b) {
    b.setAttribute('data-ra-current', '');
    if (phase === 'tr') b.setAttribute('data-speaking', 'tr');
  }
  return b;
}

/**
 * ★ I4 (ii) — speaker 가 단위 `u` 를 보이기 **직전**(controls 의 `view.show` 가 `showSpoken` 앞에서 부른다).
 * 블록을 먼저 넣어야 6-5 편안 영역 판정(문장 + 현재 블록)이 그 블록을 본다.
 */
export function willShow(u) {
  if (!els || !ra || !u) return null;
  const art = article();
  if (!art) return null;
  const page = pageOf(art);
  const seg = ra.translatable(u) ? u.seg : null;
  const same = seg !== null && seg === cur.seg && page === cur.page;
  if (!same) {
    cur = { seg: seg, page: page, src: seg === null ? null : String(u.src == null ? '' : u.src) };
    phase = 'src';
  }
  // 띠 모드에서도 지금 문장은 기억한다 — 낭독 중에 `inline` 으로 바꾸면 그 문장부터 블록이 붙는다.
  if (!active) return null;
  const b = seg === null ? null : ensureCurrentBlock(art, u);
  markCurrent(art);
  return b;
}

/** 지금 문장의 블록 — 없으면 앵커 줄 다음에 만들고, 상태대로 채운다. */
function ensureCurrentBlock(art, u) {
  let b = blockOf(art, cur.seg);
  const rec = ra.get(cur.src);
  const target = targetLang();
  if (!b) {
    const id = anchorFor(cur.seg, u);
    const anchor = id != null ? findLine(id) : null;
    if (!anchor || !art.contains(anchor)) return null;
    b = makeBlock(art.ownerDocument, cur.seg, target);
    srcOf.set(b, cur.src);
    fill(b, rec, target);
    placeBlock(anchor, b);
    return b;
  }
  const st = b.getAttribute('data-state');
  if (st !== 'ready') fill(b, rec, target);                         // 상태 줄·"눌러서 보기" → 지금 문장이니 펼친다
  return b;
}

/** 이 문장의 앵커 — 큐에서(마지막 조각까지 보고), 큐가 다른 쪽 것이면 이 단위만으로. */
function anchorFor(seg, u) {
  if (Array.isArray(queue.units)) {
    const list = anchorsOf(queue.units.filter((x) => x && x.seg === seg));
    if (list.length) return list[0].anchor;
  }
  return anchorIdOf(u);
}

/** 상태대로 채운다 — ready 면 번역문, 아니면 상태 한 줄(그리고 도착을 기다린다). */
function fill(b, rec, target) {
  const r = rec || { state: 'none' };
  if (r.state === 'ready') { renderReady(b, r.text, target); unwatch(b); return; }
  renderNote(b, noteKeyFor(r, { hasSentence: true, isNotice: false, remote: safeRemote() }));
  watch(b);
}

function safeRemote() {
  try { return ra.remoteState(); } catch (e) { return null; }
}

function watch(b) {
  if (watchers.has(b)) return;
  const src = srcOf.get(b);
  if (src == null) return;
  watchers.set(b, ra.onChange(src, () => onRec(b)));
}

function unwatch(b) {
  const off = watchers.get(b);
  if (!off) return;
  watchers.delete(b);
  try { off(); } catch (e) { /* 이미 풀림 */ }
}

/** 상태 줄을 단 블록의 문장 상태가 바뀌었다. */
function onRec(b) {
  const art = article();
  if (!active || !art || !art.contains(b)) { unwatch(b); return; }
  const rec = ra.get(srcOf.get(b));
  const isCur = b.hasAttribute('data-ra-current');
  if (rec.state === 'ready') {
    unwatch(b);
    if (isCur) {
      renderReady(b, rec.text, targetLang());
      // 지금 블록이 커졌다 — 끝이 본문 영역 밖이면 6-5 가 다시 굴린다(프로그램 스크롤).
      if (recheck) { try { recheck(); } catch (e) { /* 스크롤 실패가 읽기를 막지 않는다 */ } }
    } else {
      renderArrived(b);                                             // I4 (iii) — 같은 높이 한 줄
    }
    return;
  }
  // 지나간 블록도 상태 줄은 같은 높이다(pending ↔ failed ↔ blocked).
  renderNote(b, noteKeyFor(rec, { hasSentence: true, isNotice: false, remote: safeRemote() }));
}

function setPhase(ph) {
  phase = ph === 'tr' ? 'tr' : 'src';
  const art = article();
  if (!active || !art) return;
  const b = art.querySelector('.' + BLOCK_CLASS + '[data-ra-current]');
  if (!b) return;
  if (phase === 'tr') b.setAttribute('data-speaking', 'tr');
  else b.removeAttribute('data-speaking');
}

/** 블록 안 단추 — [다시 시도](사용자 동작만 재전송 — 7-6) · "눌러서 보기"(사용자 동작이 만든 움직임 — I4 (iii)). */
function onClick(ev) {
  const btn = ev.target && ev.target.closest ? ev.target.closest('.' + BLOCK_CLASS + ' [data-ra-action]') : null;
  if (!btn || !els.mount.contains(btn)) return;
  const b = btn.closest('.' + BLOCK_CLASS);
  const act = btn.getAttribute('data-ra-action');
  if (act === 'show') {
    const rec = ra.get(srcOf.get(b));
    if (rec.state === 'ready') renderReady(b, rec.text, targetLang());
  } else if (act === 'retry') {
    if (btn.disabled) return;
    btn.disabled = true;                                           // 두 번 눌러 두 번 보내지 않게
    Promise.resolve().then(() => ra.retry()).catch(() => null).then(() => { if (b.isConnected && b.getAttribute('data-state') !== 'ready') onRec(b); });
  }
}

/** UI 언어가 바뀌었다 — 상태 줄 문구만 다시(번역문은 대상 언어라 그대로). 리더가 DOM 을 새로 그리면 `onPageRepaint` 가 sync 한다. */
function relabel() {
  if (!els || !els.mount) return;
  const list = els.mount.querySelectorAll('.' + BLOCK_CLASS);
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const st = b.getAttribute('data-state');
    if (st === 'ready') continue;
    if (st === 'arrived') renderArrived(b);
    else onRec(b);
  }
}

/* ── `[D]` 측정 훅 — 원문·번역문을 담지 않는다(16-K) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.inlinetr && g.inlinetr.__mine) return;
  g.inlinetr = {
    __mine: true,
    state: function () {
      const list = els && els.mount ? els.mount.querySelectorAll('.' + BLOCK_CLASS) : [];
      const states = {};
      for (let i = 0; i < list.length; i++) { const s = list[i].getAttribute('data-state') || '?'; states[s] = (states[s] || 0) + 1; }
      return { active: active, blocks: list.length, states: states, cur: { seg: cur.seg, page: cur.page }, watchers: watchers.size,
        rootAttr: document.documentElement.getAttribute('data-tr-inline') };
    },
    /** 지금 큐의 문장 번호·단위 언어(`[8m]` 예외만)·번역 대상 여부 — 글자는 담지 않는다. */
    queueSegs: function () {
      const out = new Map();
      for (const u of queue.units || []) {
        if (!u || !Number.isInteger(u.seg) || out.has(u.seg)) continue;
        out.set(u.seg, { seg: u.seg, lang: u.lang || null, tr: !!(ra && ra.translatable(u)) });
      }
      return { page: queue.page, segs: Array.from(out.values()) };
    }
  };
}
