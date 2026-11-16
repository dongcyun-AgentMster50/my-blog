/* ============================================================
   MedReader — 의료 사이트 북마크 화면 (spec 17-9 2 "화면" · 결정 18-D1·D2·D5)

   ── 세 자리, 그리는 장치 하나 ──────────────────────────
     · 서재 아래 접는 카드 `#libraryLinks`(열기만) — `renderLibraryLinks()` 를 서재가 부른다
     · 설정 "의료 사이트" 카드 `#settingsLinks`(추가·수정·삭제·순서·추천·되돌리기) — `initLinksSettings`·`showLinksSettings`
     · 선택 동작 줄 `[찾아보기]` — `selbar.js` 가 `lookup(text, bar)` 를 부른다(링크 하나면 바로 새 탭, 둘 이상이면 줄 위 작은 목록)
   목록은 늘 `currentLinks()` 한 길(설정 `links.medical` → 순수 `effectiveLinks` — 검사를 통과한 항목만).

   ── 지키는 것 (13절 · E7) ──────────────────────────────
   ★ 링크만 — 앱은 그 사이트에 **요청하지 않는다**(fetch·img·미리보기 0). 사용자가 누를 때 새 탭이 열릴 뿐이다.
   ★ 새 탭은 `<a>` 하나로: `target=_blank` · `rel="noopener noreferrer"` · `referrerPolicy='no-referrer'`(`armAnchor` 한 곳).
     `window.open` 을 쓰지 않는다(팝업 차단을 피하고 탭 안 사용자 동작으로 연다). 여는 주소는 다시 검사를 통과한 값만.
   ★ 링크 이름·주소·검색어는 `textContent`/`href` 속성으로만 — `innerHTML` 0. 이름은 번역하지 않는다(고유명사).
   ★ 삭제 확인은 페이지 안 `<dialog>`(서재 다시 추출과 같은 장치) — `confirm()` 금지.
   ★ 아이디·비밀번호는 받지 않는다(주소의 `user:pass@` 는 `url-userinfo` 로 거절).
   ============================================================ */

import * as settings from '../settings.js';
import { LINKS } from '../config.js';
import {
  checkLink, effectiveLinks, queryLinks, lookupPlan, homeUrl, hostOf, hasQuery,
  newLinkId, moveLink, removeLink, upsertLink
} from '../text/links.js';
import { t, applyTranslations, onLangChange, errorKey } from '../i18n/index.js';

/** 설정 키(9-3 · 9c 백업 허용 목록에 들어갈 이름). */
export const LINKS_KEY = 'links.medical';
/** 새 탭 `rel` — 여는 쪽 창(`opener`)과 보낸 쪽 주소(`Referer`)를 넘기지 않는다. */
export const LINK_REL = 'noopener noreferrer';
/** 설정 카드로 굴리는 해시(서재 카드 [편집]). */
export const SETTINGS_LINKS_HASH = '#/settings/links';

/** `checkLink` 코드 → 문구 키. */
export const ERR_KEYS = Object.freeze({
  'name-empty': 'links.err.nameEmpty', 'name-long': 'links.err.nameLong', 'url-bad': 'links.err.urlBad',
  'url-not-https': 'links.err.urlNotHttps', 'url-userinfo': 'links.err.urlUserinfo', 'url-long': 'links.err.urlLong',
  'too-many': 'links.err.tooMany'
});

/* ────────────────────────────────────────────────────────
   1. 목록 · 새 탭
   ──────────────────────────────────────────────────────── */

/** 지금 쓸 목록 — 설정값 → 기본/사용자 목록(검사 통과만). */
export function currentLinks() {
  return effectiveLinks(settings.get(LINKS_KEY));
}

/** `{q}` 링크 수 — 선택 줄이 `[찾아보기]` 를 보일지 정한다. */
export function queryLinkCount() {
  return queryLinks(currentLinks()).length;
}

/**
 * 새 탭 속성을 단다 — **한 곳**(서재 카드 링크·찾아보기·목록이 모두 이것). 요소가 아니어도 된다(node 시험이 빈 객체로 본다).
 * @template T
 * @param {T} a
 * @param {string} href
 * @returns {T}
 */
export function armAnchor(a, href) {
  a.href = href;
  a.target = '_blank';
  a.rel = LINK_REL;
  a.referrerPolicy = 'no-referrer';
  return a;
}

/**
 * 주소를 새 탭으로 — `<a>` 를 만들어 누르게 한다(사용자 동작 안에서 불러야 한다). 검사를 못 넘으면 열지 않는다.
 * @returns {boolean} 열었는가
 */
export function openExternal(href) {
  if (typeof document === 'undefined' || !href || !checkLink({ name: 'x', url: href }).ok) return false;
  const a = armAnchor(document.createElement('a'), href);
  a.hidden = true;
  (document.body || document.documentElement).appendChild(a);
  try { a.click(); } finally { a.remove(); }
  return true;
}

/* ────────────────────────────────────────────────────────
   2. `[찾아보기]` — 선택 동작 줄 (결정 18-D1 (가))
   ──────────────────────────────────────────────────────── */

let menu = null;   // {el, host, onClose, keyFn, downFn, back}

/** 목록이 떠 있는가 — 떠 있는 동안 선택 줄은 선택이 풀려도 거두지 않는다(고르거나 닫을 때까지). */
export function lookupMenuOpen() {
  return !!menu;
}

/**
 * `[찾아보기]` 를 눌렀다. 링크가 하나면 바로 새 탭, 둘 이상이면 `host`(선택 줄) 바로 위에 작은 목록.
 * @param {string} text  선택 스냅숏 글자
 * @param {Element} host  선택 줄(목록을 그 안에 단다 — 줄과 함께 숨는다)
 * @param {{back?:Element, byKey?:boolean, onClose?:Function}} [opts]  back = 닫을 때 돌아갈 단추 · byKey = 키보드로 눌렀다(첫 항목에 포커스)
 * @returns {'opened'|'menu'|'tooLong'|'none'}
 */
export function lookup(text, host, opts) {
  const o = opts || {};
  hook();
  closeLookupMenu(true);
  const plan = lookupPlan(currentLinks(), text);
  if (!plan.show) return 'none';
  if (plan.query === null) return 'tooLong';
  if (!plan.targets.length) return 'none';
  if (plan.targets.length === 1) return openExternal(plan.targets[0].href) ? 'opened' : 'none';
  if (!host || typeof document === 'undefined') return 'none';
  openMenu(host, plan, o);
  return 'menu';
}

function openMenu(host, plan, o) {
  const el = document.createElement('div');
  el.className = 'links-menu';
  el.id = 'linksMenu';
  el.setAttribute('role', 'menu');
  el.setAttribute('aria-label', t('links.menu'));
  const q = document.createElement('p');
  q.className = 'links-menu-q';
  q.setAttribute('role', 'presentation');
  q.dir = 'ltr';
  q.textContent = plan.query;
  el.appendChild(q);
  plan.targets.forEach((tg, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'links-menu-item';
    b.setAttribute('role', 'menuitem');
    b.setAttribute('data-link-i', String(i));
    b.tabIndex = i === 0 ? 0 : -1;
    b.textContent = tg.name;
    el.appendChild(b);
  });
  // 최대 높이 = 선택 줄 위 공간(안 스크롤). 항목 둘(48px)은 늘 보이게.
  try {
    const top = host.getBoundingClientRect().top;
    el.style.maxBlockSize = Math.max(96, Math.floor(top - 8)) + 'px';
  } catch (e) { /* 그대로 */ }
  el.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest ? ev.target.closest('button[data-link-i]') : null;
    if (!b) return;
    const tg = plan.targets[Number(b.getAttribute('data-link-i'))];
    closeLookupMenu(false);
    if (tg) openExternal(tg.href);
  });
  const keyFn = (ev) => onMenuKey(ev);
  const downFn = (ev) => { if (menu && !menu.host.contains(ev.target)) closeLookupMenu(false); };
  menu = { el: el, host: host, onClose: o.onClose, keyFn: keyFn, downFn: downFn, back: o.back || null };
  host.appendChild(el);
  window.addEventListener('keydown', keyFn, true);       // 탭 띠(document 캡처)·시트보다 먼저 — Esc 는 목록만 닫는다
  document.addEventListener('pointerdown', downFn, true);
  if (o.byKey) { const first = el.querySelector('button[data-link-i]'); if (first) first.focus(); }
}

function onMenuKey(ev) {
  if (!menu) return;
  if (ev.key === 'Escape' || ev.key === 'Esc') {
    if (ev.isComposing) return;
    ev.preventDefault();
    ev.stopPropagation();
    const back = menu.back;
    closeLookupMenu(false);
    if (back) { try { back.focus(); } catch (e) { /* 그대로 */ } }
    return;
  }
  if (!menu.el.contains(ev.target)) return;
  const items = Array.from(menu.el.querySelectorAll('button[data-link-i]'));
  const i = items.indexOf(ev.target);
  let j = -1;
  if (ev.key === 'ArrowDown') j = (i + 1) % items.length;
  else if (ev.key === 'ArrowUp') j = (i - 1 + items.length) % items.length;
  else if (ev.key === 'Home') j = 0;
  else if (ev.key === 'End') j = items.length - 1;
  if (j < 0) return;
  ev.preventDefault();
  items.forEach((b, k) => { b.tabIndex = k === j ? 0 : -1; });
  items[j].focus();
}

/**
 * 목록을 닫는다. `silent` 면 닫힘 알림(`onClose` — 선택 줄이 선택을 다시 본다)을 부르지 않는다(줄이 스스로 거둘 때).
 */
export function closeLookupMenu(silent) {
  if (!menu) return;
  const m = menu;
  menu = null;
  window.removeEventListener('keydown', m.keyFn, true);
  document.removeEventListener('pointerdown', m.downFn, true);
  if (m.el.parentNode) m.el.parentNode.removeChild(m.el);
  if (!silent && typeof m.onClose === 'function') { try { m.onClose(); } catch (e) { /* 그대로 */ } }
}

/* ────────────────────────────────────────────────────────
   3. 서재 아래 카드 (결정 18-D2 · D5) — 열기만
   ──────────────────────────────────────────────────────── */

/** 서재가 보일 때마다. 접힘·펼침은 건드리지 않는다(저장하지 않는다). */
export function renderLibraryLinks() {
  if (typeof document === 'undefined') return;
  hook();
  const card = document.getElementById('libraryLinks');
  const list = card && card.querySelector('#libraryLinksList');
  if (!list) return;
  const empty = card.querySelector('#libraryLinksEmpty');
  clear(list);
  let n = 0;
  for (const l of currentLinks()) {
    const href = homeUrl(l.url);
    if (!href) continue;
    const li = document.createElement('li');
    const a = armAnchor(document.createElement('a'), href);
    a.className = 'links-open';
    a.textContent = l.name;
    li.appendChild(a);
    list.appendChild(li);
    n++;
  }
  list.hidden = n === 0;
  if (empty) empty.hidden = n > 0;
}

/* ────────────────────────────────────────────────────────
   4. 설정 "의료 사이트" 카드 — 추가·수정·삭제·순서·추천·되돌리기
   ──────────────────────────────────────────────────────── */

let ed = null;        // 그릇들
let editing = null;   // null = 닫힘 · '' = 새 링크 · id = 그 링크 고치기

export function initLinksSettings() {
  if (ed || typeof document === 'undefined') return;
  const card = document.getElementById('settingsLinks');
  if (!card) return;
  const q = (id) => card.querySelector('#' + id);
  ed = {
    card: card, list: q('linksEditList'), empty: q('linksEditEmpty'), form: q('linksForm'),
    name: q('linksName'), url: q('linksUrl'), err: q('linksErr'), suggest: q('linksSuggest'),
    suggestList: q('linksSuggestList'), msg: q('linksMsg'), dlg: q('linksDelDialog'), dlgTitle: q('linksDelTitle')
  };
  if (!ed.list || !ed.form || !ed.name || !ed.url) { ed = null; return; }
  card.addEventListener('click', onCardClick);
  ed.name.addEventListener('keydown', onFieldKey);
  ed.url.addEventListener('keydown', onFieldKey);
  onLangChange(() => { if (ed) { paintList(); if (!ed.suggest.hidden) paintSuggest(); } });
}

/** 설정 화면이 보일 때마다. `tab === 'links'` 면 이 카드로 굴리고 제목에 포커스(서재 카드 [편집]). */
export function showLinksSettings(tab) {
  if (!ed) return;
  hook();
  paintList();
  if (tab === 'links') {
    try { ed.card.scrollIntoView({ block: 'start' }); } catch (e) { /* 그대로 */ }
    const h = ed.card.querySelector('h2');
    if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } }
  }
}

/** 설정 화면을 떠날 때 — 열린 칸·추천·대화를 닫는다(친 값은 남기지 않는다). */
export function leaveLinksSettings() {
  if (!ed) return;
  closeForm();
  ed.suggest.hidden = true;
  say('');
  if (ed.dlg && ed.dlg.open && typeof ed.dlg.close === 'function') ed.dlg.close();
}

function paintList() {
  const links = currentLinks();
  clear(ed.list);
  links.forEach((l, i) => ed.list.appendChild(rowOf(l, i, links.length)));
  ed.list.hidden = links.length === 0;
  if (ed.empty) ed.empty.hidden = links.length > 0;
  applyTranslations(ed.list);
}

function rowOf(l, i, n) {
  const li = document.createElement('li');
  li.className = 'links-row';
  li.setAttribute('data-id', l.id);
  const text = document.createElement('div');
  text.className = 'links-row-text';
  const name = document.createElement('span');
  name.className = 'links-row-name';
  name.textContent = l.name;
  const host = document.createElement('span');
  host.className = 'links-row-host';
  host.dir = 'ltr';
  host.textContent = hostOf(l.url);
  text.appendChild(name);
  text.appendChild(host);
  if (hasQuery(l.url)) {
    const badge = document.createElement('span');
    badge.className = 'links-badge';
    badge.setAttribute('data-i18n', 'links.queryBadge');
    text.appendChild(badge);
  }
  li.appendChild(text);
  const btns = document.createElement('div');
  btns.className = 'links-row-btns';
  btns.appendChild(btn('up', '↑', 'links.up', i === 0));
  btns.appendChild(btn('down', '↓', 'links.down', i === n - 1));
  btns.appendChild(btn('edit', null, 'links.edit', false));
  const del = btn('delete', null, 'links.delete', false);
  del.classList.add('danger');
  btns.appendChild(del);
  li.appendChild(btns);
  return li;
}

/** 줄 단추 — 글자가 없으면(수정·삭제) 문구가 글자, 있으면(↑↓) 문구는 aria 이름. */
function btn(act, glyph, key, disabled) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('data-la', act);
  if (glyph) { b.textContent = glyph; b.setAttribute('data-i18n-aria', key); }
  else b.setAttribute('data-i18n', key);
  b.disabled = !!disabled;
  return b;
}

function onFieldKey(ev) {
  if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); saveForm(); }
  else if ((ev.key === 'Escape' || ev.key === 'Esc') && !ev.isComposing) { ev.preventDefault(); closeForm(true); }
}

function onCardClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-la]') : null;
  if (!b || !ed.card.contains(b) || b.disabled) return;
  const row = b.closest('.links-row');
  const id = row ? row.getAttribute('data-id') : null;
  switch (b.getAttribute('data-la')) {
    case 'up': move(id, -1, 'up'); break;
    case 'down': move(id, 1, 'down'); break;
    case 'edit': openForm(id); break;
    case 'delete': askDelete(id); break;
    case 'add': openForm(''); break;
    case 'save': saveForm(); break;
    case 'cancel': closeForm(true); break;
    case 'suggest': toggleSuggest(); break;
    case 'suggest-add': addSuggested(); break;
    case 'suggest-cancel': ed.suggest.hidden = true; focusAct('suggest'); break;
    case 'reset': resetDefaults(); break;
    default: break;
  }
}

/** 저장 — 사용자 목록 배열(`{id,name,url}` 만). 실패하면 한 줄 안내. */
async function store(list) {
  try {
    await settings.set(LINKS_KEY, list.map((l) => ({ id: l.id, name: l.name, url: l.url })));
    return true;
  } catch (e) {
    say(t(errorKey(e && e.code)));
    return false;
  }
}

async function move(id, dir, act) {
  if (id == null) return;
  const next = moveLink(currentLinks(), id, dir);
  if (!(await store(next))) return;
  paintList();
  // 포커스는 옮긴 줄의 같은 단추로(끝에 닿아 꺼졌으면 반대 단추).
  const row = ed.list.querySelector('.links-row[data-id="' + cssId(id) + '"]');
  if (row) {
    let b = row.querySelector('button[data-la="' + act + '"]');
    if (!b || b.disabled) b = row.querySelector('button[data-la="' + (act === 'up' ? 'down' : 'up') + '"]');
    if (b && !b.disabled) b.focus();
  }
}

function openForm(id) {
  const links = currentLinks();
  const cur = id ? links.find((l) => l.id === id) : null;
  if (id && !cur) return;
  editing = cur ? cur.id : '';
  ed.suggest.hidden = true;
  ed.name.value = cur ? cur.name : '';
  ed.url.value = cur ? cur.url : '';
  showErr(null);
  say('');
  ed.form.hidden = false;
  ed.form.setAttribute('data-mode', cur ? 'edit' : 'add');
  try { ed.form.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 그대로 */ }
  ed.name.focus();
}

function closeForm(refocus) {
  const was = editing;
  editing = null;
  ed.form.hidden = true;
  ed.name.value = '';
  ed.url.value = '';
  showErr(null);
  if (refocus) {
    if (was) { const b = ed.list.querySelector('.links-row[data-id="' + cssId(was) + '"] button[data-la="edit"]'); if (b) { b.focus(); return; } }
    focusAct('add');
  }
}

async function saveForm() {
  if (editing === null) return;
  const links = currentLinks();
  const adding = editing === '';
  const c = checkLink({ name: ed.name.value, url: ed.url.value }, adding ? { count: links.length } : undefined);
  if (!c.ok) { showErr(c.code); return; }
  const id = adding ? newLinkId(links) : editing;
  if (!(await store(upsertLink(links, { id: id, name: c.name, url: c.url })))) return;
  editing = null;
  closeForm(false);
  paintList();
  say(t('links.saved'));
  const b = ed.list.querySelector('.links-row[data-id="' + cssId(id) + '"] button[data-la="edit"]');
  if (b) b.focus();
}

function showErr(code) {
  if (!ed.err) return;
  if (!code) { ed.err.hidden = true; ed.err.textContent = ''; ed.url.removeAttribute('aria-invalid'); ed.name.removeAttribute('aria-invalid'); return; }
  ed.err.textContent = t(ERR_KEYS[code] || 'links.err.urlBad');
  ed.err.hidden = false;
  const onName = code === 'name-empty' || code === 'name-long';
  (onName ? ed.name : ed.url).setAttribute('aria-invalid', 'true');
  (onName ? ed.url : ed.name).removeAttribute('aria-invalid');
}

async function askDelete(id) {
  const cur = currentLinks().find((l) => l.id === id);
  if (!cur) return;
  const ok = await confirmIn(t('links.delete.confirm', { name: cur.name }));
  if (!ok) { const b = ed.list.querySelector('.links-row[data-id="' + cssId(id) + '"] button[data-la="delete"]'); if (b) b.focus(); return; }
  if (!(await store(removeLink(currentLinks(), id)))) return;
  if (editing === id) closeForm(false);
  paintList();
  say(t('links.saved'));
  focusAct('add');
}

/** 페이지 안 확인 — 첫 초점 [취소], Esc = 취소(서재 `askReextract` 와 같은 장치). */
function confirmIn(title) {
  const dlg = ed.dlg;
  if (!dlg) return Promise.resolve(false);
  applyTranslations(dlg);
  if (ed.dlgTitle) ed.dlgTitle.textContent = title;
  return new Promise((resolve) => {
    const finish = (ok) => {
      dlg.removeEventListener('click', onClick);
      dlg.removeEventListener('cancel', onCancel);
      if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
      resolve(ok);
    };
    const onClick = (ev) => {
      const b = ev.target.closest('button[data-dialog]');
      if (b) { ev.stopPropagation(); finish(b.getAttribute('data-dialog') === 'ok'); }
    };
    const onCancel = (ev) => { ev.preventDefault(); finish(false); };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('cancel', onCancel);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const cancel = dlg.querySelector('button[data-dialog="cancel"]');
    if (cancel) cancel.focus();
  });
}

function toggleSuggest() {
  if (!ed.suggest.hidden) { ed.suggest.hidden = true; return; }
  closeForm(false);
  say('');
  paintSuggest();
  ed.suggest.hidden = false;
  const first = ed.suggest.querySelector('input[type="checkbox"]') || ed.suggest.querySelector('button');
  if (first) first.focus();
}

/** 추천 목록 — 이미 목록에 있는 주소는 빼고 체크 칸으로. `[확인 필요]`·유료는 작은 표시. */
function paintSuggest() {
  clear(ed.suggestList);
  const have = new Set(currentLinks().map((l) => l.url));
  const items = LINKS.SUGGESTED.filter((s) => !have.has(s.url));
  for (const s of items) {
    const row = document.createElement('div');
    row.className = 'consent-row links-suggest-row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'linksSug-' + s.id;
    box.value = s.id;
    const label = document.createElement('label');
    label.setAttribute('for', box.id);
    const nm = document.createElement('span');
    nm.className = 'links-row-name';
    nm.textContent = s.name;
    const host = document.createElement('span');
    host.className = 'links-row-host';
    host.dir = 'ltr';
    host.textContent = hostOf(s.url);
    label.appendChild(nm);
    label.appendChild(host);
    if (s.paid) label.appendChild(badgeOf('links.suggested.paid'));
    if (s.check === 'unverified') label.appendChild(badgeOf('links.suggested.unverified'));
    row.appendChild(box);
    row.appendChild(label);
    ed.suggestList.appendChild(row);
  }
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.setAttribute('data-i18n', 'links.suggested.none');
    ed.suggestList.appendChild(p);
  }
  const add = ed.suggest.querySelector('button[data-la="suggest-add"]');
  if (add) add.disabled = !items.length;
  applyTranslations(ed.suggest);
}

function badgeOf(key) {
  const b = document.createElement('span');
  b.className = 'links-badge';
  b.setAttribute('data-i18n', key);
  return b;
}

async function addSuggested() {
  const picked = Array.from(ed.suggestList.querySelectorAll('input[type="checkbox"]:checked')).map((b) => b.value);
  if (!picked.length) { ed.suggest.hidden = true; focusAct('suggest'); return; }
  let links = currentLinks();
  for (const sid of picked) {
    const s = LINKS.SUGGESTED.find((x) => x.id === sid);
    if (!s) continue;
    const c = checkLink(s, { count: links.length });
    if (!c.ok) { say(t(ERR_KEYS[c.code] || 'links.err.urlBad')); return; }
    links = upsertLink(links, { id: newLinkId(links), name: c.name, url: c.url });
  }
  if (!(await store(links))) return;
  ed.suggest.hidden = true;
  paintList();
  say(t('links.saved'));
  focusAct('suggest');
}

async function resetDefaults() {
  closeForm(false);
  ed.suggest.hidden = true;
  try { await settings.set(LINKS_KEY, null); } catch (e) { say(t(errorKey(e && e.code))); return; }
  paintList();
  say(t('links.saved'));
}

function focusAct(act) {
  const b = ed.card.querySelector('.links-actions button[data-la="' + act + '"]');
  if (b) b.focus();
}

function say(text) {
  if (ed && ed.msg) ed.msg.textContent = text || '';
}

/* ── 작은 도구 ─────────────────────────────────────────── */

function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

/** id 는 우리가 만든 것(영숫자·`-`·`_`)이지만 가져온 값일 수도 있다 — 선택자에 넣기 전에 가린다. */
function cssId(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

/* ── `[D]` 측정 훅 — 링크 이름·주소·검색어는 담지 않는다(수·상태만). `main.js` 가 부팅 끝에 전역 객체를 새로 만들므로
   그리는 곳마다 다시 붙인다(selbar·controls 와 같은 이유). ── */
function hook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.links && g.links.__mine) return;
  g.links = {
    __mine: true,
    state: function () {
      const l = currentLinks();
      return { count: l.length, query: queryLinks(l).length, stored: Array.isArray(settings.get(LINKS_KEY)) ? 'array' : 'null', menu: !!menu, editing: editing };
    }
  };
}
