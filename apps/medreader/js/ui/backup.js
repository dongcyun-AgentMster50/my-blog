/* ══════════════════════════════════════════════════════════════════════
   ui/backup.js — 설정 "백업·옮기기" 카드 (spec 17-4-1 6 — 9c-1 내보내기 몫, 가져오기는 9c-2)

   UI 계층이다. 파일은 **기기에 저장만** 한다 — `<a download>`(업로드·동기화·호출 0). 내보내기 본체는 `backup/export.js`.
   - "마지막 백업: n일 전"(`backup.lastExportAt`) · 30일 넘으면 그 줄만 주의 색 + 짧은 글자(9c-D8 — 배너 없음)
   - `☑ 저장된 번역 포함(약 n MB)` 기본 켬(9c-Q2) — n 은 `backup/export.js` `cacheSize()`(8c-2 `cache.stats()` 와 같은 `sizeBytes` 합)
   ★ `ai/*` 를 import 하지 않는다 — `ui/settings.js` 가 이 파일을 import 하므로 inlinetr 의 import 고리에 캐시가 들어가면 안 된다(8d D8).
   - `[내보내기]` → 진행 막대(묶음 이름·n/총, `aria-live`) → 내려받기 → `backup.lastExportAt` = 지금
   - 접는 목록 "PDF 원본 따로 받기" — blob 이 있는 책마다 `[PDF 내려받기]`(원본 Blob 그대로, 이름 = `fileName`)
   - `[9c-2]` `[가져오기]` → 파일 고르기(`accept` 비움 — Android 가 `.gz`·`.jsonl` 을 흐리게 할 수 있다) → 미리보기(머리 줄·문서 목록만) →
     `☑ 설정도 가져오기` → `[이 파일 가져오기]` → 진행 막대 → "가져오기 끝 — 새로 불러옵니다" + `[다시 불러오기]`(9c-D7).
     가져오는 동안 화면을 떠나려 하면 확인(떠나면 지금 묶음 뒤 멈추고 새로 불러온다 — 같은 파일로 다시 하면 이어진다). 끝난 뒤
     다시 불러오기 전에 다른 화면으로 가면 그 화면에서 새로 불러온다(설정·캐시 크기·파이프라인 메모리가 옛 값이므로).
     가져오기 그릇은 이 파일이 만든다(`index.html` 은 9c-1 카드 그대로 — 글자는 `textContent`).
   ★ 글자는 전부 `textContent`·`data-i18n`(HTML 문자열로 넣는 곳 0). 동작은 카드 하나의 위임 리스너(`data-ba`).
   ══════════════════════════════════════════════════════════════════════ */

import * as settings from '../settings.js';
import { t, applyTranslations, formatBytes, formatNumber, onLangChange, getLang } from '../i18n/index.js';
import { exportBackup, pdfList, pdfBlob, cacheSize } from '../backup/export.js';
import { previewBackup, importBackup, EST_CACHE_REC_BYTES } from '../backup/import.js';
import { backupAge } from '../text/backup.js';

/** 스토어 → 진행 줄의 묶음 이름(i18n `backup.part.*`). */
export const PART_OF = Object.freeze({
  documents: 'books', settings: 'settings', usage: 'usage', progress: 'quiz', attempts: 'quiz', mistakes: 'quiz',
  questions: 'quiz', cards: 'vocab', annotations: 'notes', aiCache: 'cache'
});

/**
 * "마지막 백업" 한 줄의 i18n 키·값(순수 — 시험이 잰다).
 * @returns {{key:string, params?:Object, stale:boolean}}
 */
export function lastLine(lastMs, nowMs) {
  const a = backupAge(lastMs, nowMs);
  if (a.state === 'never') return { key: 'backup.never', stale: false };
  if (a.state === 'today') return { key: 'backup.last.today', stale: false };
  return { key: 'backup.last.days', params: { n: a.days }, stale: a.stale };
}

/** 진행 줄 다시 쓰기 간격(ms) — 낭독기가 묶음마다 읽지 않게. 묶음 이름이 바뀔 때는 바로. */
const SAY_EVERY_MS = 1000;
/** 내려받은 주소를 거두기까지(큰 파일은 브라우저가 늦게 읽는다). */
const REVOKE_AFTER_MS = 120000;

let el = null;
let busy = false;
let cacheBytes = null;           // number | null(아직·실패)
let cacheCount = 0;
let msg = null;                  // {key, params} 또는 그 목록 — 언어가 바뀌면 다시 쓴다
let prog = null;                 // 마지막 진행 {store, done, total, phase}
let saidAt = 0;
let saidPart = '';
/* `[9c-2]` 가져오기 */
let pick = null;                 // {file, preview} — 미리보기 중인 파일
let importing = null;            // {signal:{aborted}, leaveTo:string|null} — 가져오는 동안
let needReload = false;          // 가져오기가 DB 를 바꿨다 — 메모리(설정 맵·캐시 크기·파이프라인)가 옛 값
let reloading = false;
let guarded = false;

export function initBackupCard() {
  if (el || typeof document === 'undefined') return;
  const card = document.getElementById('settingsBackup');
  if (!card) return;
  const q = (id) => card.querySelector('#' + id);
  el = {
    card: card, last: q('backupLast'), lastText: q('backupLastText'), stale: q('backupStale'), cache: q('backupCache'),
    cacheLabel: q('backupCacheLabel'), btn: q('backupExport'), prog: q('backupProgress'), bar: q('backupBar'),
    fill: q('backupBarFill'), progText: q('backupProgressText'), msg: q('backupMsg'), pdfs: q('backupPdfs'),
    pdfList: q('backupPdfList'), pdfEmpty: q('backupPdfEmpty')
  };
  // 반쪽 캐시(옛 index.html + 새 JS) — 그릇이 없으면 조용히 물러난다
  if (!el.btn || !el.lastText || !el.cache || !el.cacheLabel || !el.pdfList) { el = null; return; }
  buildImport(card);
  card.addEventListener('click', onClick);
  if (el.file) el.file.addEventListener('change', onFilePicked);
  onLangChange(() => { if (el) { paintAll(); refreshPdfs(); } });
}

/** `[9c-2]` 가져오기 그릇 — 고지 줄 앞에 둔다(내보내기 묶음 다음). 모두 `createElement`·`textContent`. */
function buildImport(card) {
  const before = card.querySelector('p[data-i18n="backup.notice"]') || null;
  const mk = (tag, props) => Object.assign(document.createElement(tag), props || {});
  const btn = mk('button', { type: 'button', id: 'backupImport', className: 'big' });
  btn.setAttribute('data-ba', 'import');
  const input = mk('input');
  input.type = 'file';             // accept 는 비워 둔다(17-4-1 6 — Android 파일 고르기)
  input.id = 'backupFile';
  input.hidden = true;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  const box = mk('div', { id: 'backupPreview', className: 'backup-preview' });
  box.hidden = true;
  const list = mk('ul', { id: 'backupPreviewList', className: 'backup-preview-list' });
  // `.consent-row` 는 display:flex 라 `hidden` 이 먹지 않는다 — 감싸는 div 를 숨긴다
  const row = mk('div');
  const inner = mk('div', { className: 'consent-row' });
  const chk = mk('input', { type: 'checkbox', id: 'backupWithSettings', checked: true });
  const lab = mk('label', { id: 'backupWithSettingsLabel' });
  lab.htmlFor = 'backupWithSettings';
  inner.appendChild(chk);
  inner.appendChild(lab);
  row.appendChild(inner);
  const acts = mk('div', { className: 'row' });
  const go = mk('button', { type: 'button', id: 'backupImportGo', className: 'primary' });
  go.setAttribute('data-ba', 'import-go');
  const no = mk('button', { type: 'button', id: 'backupImportCancel' });
  no.setAttribute('data-ba', 'import-cancel');
  acts.appendChild(go);
  acts.appendChild(no);
  box.appendChild(list);
  box.appendChild(row);
  box.appendChild(acts);
  const reload = mk('button', { type: 'button', id: 'backupReload', className: 'primary big' });
  reload.setAttribute('data-ba', 'reload');
  reload.hidden = true;
  for (const n of [btn, input, box, reload]) card.insertBefore(n, before);
  Object.assign(el, { imp: btn, file: input, pv: box, pvList: list, withSettings: chk, withSettingsRow: row,
    withSettingsLabel: lab, go: go, no: no, reload: reload });
}

/** 설정 화면이 보일 때마다. `tab === 'backup'` 이면 이 카드로 굴리고 제목에 포커스(서재 [백업]). */
export function showBackupCard(tab) {
  if (!el) return;
  paintAll();
  refreshCacheSize();
  refreshPdfs();
  if (tab === 'backup') {
    try { el.card.scrollIntoView({ block: 'start' }); } catch (e) { /* 그대로 */ }
    const h = el.card.querySelector('h2');
    if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } }
  }
}

/** 설정 화면을 떠날 때 — 내보내는 중이면 그대로 끝까지 간다(파일은 끝나면 내려받아진다). 끝난 알림은 지운다. */
export function leaveBackupCard() {
  if (!el || busy || needReload) return;
  msg = null;
  paintMsg();
}

function paintAll() {
  paintLast();
  paintCacheLabel();
  paintImport();
  paintMsg();
  paintProgress();
}

function paintLast() {
  const l = lastLine(settings.get('backup.lastExportAt'), Date.now());
  el.lastText.textContent = t(l.key, l.params);
  el.last.classList.toggle('backup-stale', !!l.stale);
  if (el.stale) el.stale.hidden = !l.stale;
}

function paintCacheLabel() {
  el.cacheLabel.textContent = cacheBytes === null
    ? t('backup.includeCache.plain')
    : t('backup.includeCache', { size: formatBytes(cacheBytes) });
}

async function refreshCacheSize() {
  try {
    const st = await cacheSize();
    cacheBytes = Number(st && st.bytes) || 0;
    cacheCount = Number(st && st.count) || 0;
  } catch (e) {
    cacheBytes = null;
  }
  if (el) { paintCacheLabel(); if (pick) paintPreview(); }
}

function paintMsg() {
  if (!el.msg) return;
  const parts = !msg ? [] : Array.isArray(msg) ? msg : [msg];
  el.msg.textContent = parts.map((m) => t(m.key, m.params)).join(' ');
}

function setMsg(key, params) {
  msg = Array.isArray(key) ? key : key ? { key: key, params: params } : null;
  paintMsg();
}

function paintProgress(force) {
  if (!el.prog) return;
  if (!busy || !prog) { el.prog.hidden = true; return; }
  el.prog.hidden = false;
  const total = Math.max(1, Number(prog.total) || 0);
  const done = Math.min(total, Number(prog.done) || 0);
  if (el.bar) {
    el.bar.setAttribute('aria-valuemax', String(total));
    el.bar.setAttribute('aria-valuenow', String(done));
  }
  if (el.fill) el.fill.style.inlineSize = (prog.phase === 'compress' ? 100 : Math.round(done * 100 / total)) + '%';
  if (!el.progText) return;
  const part = prog.phase === 'compress' ? 'compress' : PART_OF[prog.store] || '';
  const now = Date.now();
  // 낭독기가 묶음마다 읽지 않게 — 묶음 이름이 바뀌거나 1초가 지났을 때만 글자를 바꾼다
  if (!force && part === saidPart && now - saidAt < SAY_EVERY_MS) return;
  saidAt = now;
  saidPart = part;
  el.progText.textContent = prog.phase === 'compress'
    ? t('backup.compress')
    : t('backup.progress', { part: t('backup.part.' + part), done: formatNumber(done), total: formatNumber(Number(prog.total) || 0) });
}

/** Blob 을 기기에 저장(내려받기). 주소는 늦게 거둔다. */
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.hidden = true;
  el.card.appendChild(a);
  a.click();
  el.card.removeChild(a);
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* 이미 거둠 */ } }, REVOKE_AFTER_MS);
}

async function onExport() {
  if (busy || needReload) return;
  busy = true;
  el.btn.disabled = true;
  el.cache.disabled = true;
  if (el.imp) el.imp.disabled = true;
  setMsg(null);
  prog = { store: 'documents', done: 0, total: 0, phase: 'read' };
  saidPart = '';
  paintProgress(true);
  try {
    const r = await exportBackup({
      includeCache: !!el.cache.checked,
      onProgress: (p) => { prog = p; paintProgress(false); }
    });
    download(r.blob, r.name);
    await settings.set('backup.lastExportAt', Date.now());
    setMsg('backup.done', { name: r.name, size: formatBytes(r.bytes) });
  } catch (e) {
    setMsg('backup.failed');
  } finally {
    busy = false;
    prog = null;
    if (el) {
      el.btn.disabled = false;
      el.cache.disabled = false;
      if (el.imp) el.imp.disabled = false;
      paintProgress(true);
      paintLast();
    }
  }
}

/* ────────────────────────────────────────────────────────
   `[9c-2]` 가져오기 — 미리보기 · 진행 · 떠나기 확인 · 다시 불러오기
   ──────────────────────────────────────────────────────── */

const PREVIEW_ERR = Object.freeze({ newer: 'backup.newer', 'not-backup': 'backup.notBackup', quota: 'backup.import.quota' });

function onPickFile() {
  if (busy || needReload || !el.file) return;
  el.file.value = '';
  el.file.click();
}

async function onFilePicked() {
  const f = el.file.files && el.file.files[0];
  if (!f || busy) return;
  pick = null;
  paintImport();
  setMsg('backup.import.reading');
  let p;
  try { p = await previewBackup(f); } catch (e) { p = { ok: false, code: 'read' }; }
  if (!el) return;
  if (!p.ok) { setMsg(PREVIEW_ERR[p.code] || 'backup.import.failed'); return; }
  pick = { file: f, preview: p };
  el.withSettings.checked = true;
  setMsg(null);
  paintImport();
  try { el.go.focus(); } catch (e) { /* 그대로 */ }
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso || '—');
  try { return new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(d); } catch (e) { return d.toISOString(); }
}

/** 미리보기 줄(17-4-1 5) — 머리 줄 개수·문서 목록만. 들어올 캐시 크기는 머리 줄에 없어 **어림**(이 기기 평균 또는 레코드당 약 1.5KB). */
function previewLines(p) {
  const c = p.counts || {};
  const n = (k) => Number(c[k]) || 0;
  const out = [];
  out.push({ key: 'backup.preview.made', params: { date: fmtDate(p.createdAt) } });
  out.push({ key: 'backup.preview.books', params: { n: formatNumber(p.docs.total), k: formatNumber(p.docs.existing), m: formatNumber(p.docs.fresh) } });
  out.push({ key: 'backup.preview.records', params: { vocab: formatNumber(n('cards')), quiz: formatNumber(n('attempts')), notes: formatNumber(n('annotations')) } });
  if (p.include.cache && n('aiCache') > 0) {
    const avg = cacheCount > 0 && cacheBytes ? cacheBytes / cacheCount : EST_CACHE_REC_BYTES;
    const est = Math.round(n('aiCache') * avg);
    out.push({ key: 'backup.preview.cache', params: { n: formatNumber(n('aiCache')), size: formatBytes(est) } });
    const limit = (Number(settings.get('ai.cacheLimitMB')) || 0) * 1024 * 1024;
    if (limit > 0 && (cacheBytes || 0) + est > limit) out.push({ key: 'backup.preview.cacheOver', params: { limit: formatBytes(limit) } });
  } else {
    out.push({ key: 'backup.preview.noCache' });
  }
  out.push({ key: p.include.settings && n('settings') > 0 ? 'backup.preview.settings.yes' : 'backup.preview.settings.no' });
  if (p.hashMismatch) out.push({ key: 'backup.hashMismatch' });
  if (p.truncated === true) out.push({ key: 'backup.truncated' });
  return out;
}

function paintPreview() {
  const list = el.pvList;
  while (list.firstChild) list.removeChild(list.firstChild);
  if (!pick) return;
  for (const l of previewLines(pick.preview)) {
    const li = document.createElement('li');
    li.dir = 'auto';
    li.textContent = t(l.key, l.params);
    if (l.key === 'backup.truncated' || l.key === 'backup.hashMismatch' || l.key === 'backup.preview.cacheOver') li.className = 'warn-note';
    list.appendChild(li);
  }
  const hasSettings = pick.preview.include.settings && Number(pick.preview.counts.settings) > 0;
  el.withSettingsRow.hidden = !hasSettings;
}

function paintImport() {
  if (!el || !el.imp) return;
  el.imp.textContent = t('backup.import');
  el.go.textContent = t('backup.import.go');
  el.no.textContent = t('backup.cancel');
  el.withSettingsLabel.textContent = t('backup.withSettings');
  el.reload.textContent = t('common.reload');
  el.pv.hidden = !pick || !!importing;
  el.reload.hidden = !needReload;
  el.imp.disabled = busy || needReload;
  // `[9c-3 — 9c2R #1]` 가져온 뒤 다시 불러오기 전에는 [내보내기]도 끈다(메모리가 옛 값 — 눌러도 아무 일 없던 단추를 남기지 않는다)
  if (needReload) { el.btn.disabled = true; el.cache.disabled = true; }
  paintPreview();
}

function leaves(hash) {
  return !/^#\/settings(?:[/?]|$)/.test(String(hash || ''));
}

function askLeave() {
  try { return window.confirm(t('backup.import.leave')); } catch (e) { return false; }
}

/** 새로 불러온다(9c-D7) — `to` 가 있으면 그 화면에서. */
function reloadAt(to) {
  if (reloading) return;
  reloading = true;
  if (to && location.hash !== to) location.hash = to;
  location.reload();
}

/** 떠나려 한다 — 가져오는 중이면 확인 뒤 멈춤(멈춘 뒤 새로 불러온다), 끝난 뒤면 그 화면에서 새로 불러온다. */
function leaveTo(to) {
  if (importing) {
    if (importing.signal.aborted) return true;
    if (!askLeave()) return false;
    importing.leaveTo = to;
    importing.signal.aborted = true;
    setMsg('backup.import.stopping');
    return true;
  }
  if (needReload) reloadAt(to);
  return true;
}

function onBeforeUnload(ev) {
  if (!importing) return;
  ev.preventDefault();
  ev.returnValue = '';
}

/** 화면 이동 단추·주소 링크(누르기 전 — 붙잡는 단계에서). 카드 안 단추는 상관없다. */
function onNavClick(ev) {
  if (!importing && !needReload) return;
  const n = ev.target && ev.target.closest ? ev.target.closest('[data-nav], a[href^="#"]') : null;
  if (!n || (el && el.card.contains(n))) return;
  const to = n.getAttribute('data-nav') || n.getAttribute('href') || '';
  if (!leaves(to)) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  leaveTo(to);
}

/** 뒤로 가기·음성 명령처럼 단추 없이 해시가 바뀐 경우. */
function onHashChange() {
  if ((!importing && !needReload) || !leaves(location.hash)) return;
  if (!importing) { reloadAt(null); return; }
  if (importing.signal.aborted) return;
  if (askLeave()) {
    importing.leaveTo = location.hash;
    importing.signal.aborted = true;
    setMsg('backup.import.stopping');
  } else {
    location.hash = '#/settings/backup';        // 머문다
  }
}

function guard(on) {
  if (on === guarded || typeof window === 'undefined') return;
  guarded = on;
  const f = on ? 'addEventListener' : 'removeEventListener';
  window[f]('beforeunload', onBeforeUnload);
  window[f]('click', onNavClick, true);
  window[f]('hashchange', onHashChange);
}

function sumOps(ops) {
  const s = { add: 0, changed: 0, kept: 0, skipped: 0 };
  for (const k of Object.keys(ops || {})) {
    const o = ops[k];
    s.add += o.add || 0;
    s.changed += (o.put || 0) + (o.patch || 0);
    s.kept += o.keep || 0;
    s.skipped += o.skip || 0;
  }
  return s;
}

async function onImportGo() {
  if (busy || !pick || needReload) return;
  const file = pick.file;
  const c = pick.preview.counts || {};
  const withSettings = !!el.withSettings.checked && !el.withSettingsRow.hidden;
  busy = true;
  importing = { signal: { aborted: false }, leaveTo: null };
  guard(true);
  el.btn.disabled = true;
  el.cache.disabled = true;
  setMsg(null);
  let total = 0;
  for (const k of Object.keys(c)) if (PART_OF[k] && (k !== 'settings' || withSettings)) total += Number(c[k]) || 0;
  prog = { store: 'documents', done: 0, total: total, phase: 'import' };
  saidPart = '';
  paintImport();
  paintProgress(true);
  let r = null;
  try {
    r = await importBackup(file, {
      withSettings: withSettings,
      defaults: settings.DEFAULTS,               // `[9c-3 — 9c2R #3]` 설정은 기본값과 같은 꼴일 때만
      signal: importing.signal,
      onProgress: (p) => { prog = { store: p.store || (prog && prog.store) || 'documents', done: p.done, total: p.total, phase: 'import' }; paintProgress(false); }
    });
  } catch (e) {
    r = { ok: false, code: 'write', records: 0 };
  }
  const stop = importing;
  busy = false;
  importing = null;
  prog = null;
  pick = null;
  if (r && Number(r.records) > 0) needReload = true;
  if (stop.signal.aborted && stop.leaveTo !== null) { reloadAt(stop.leaveTo); return; }
  if (!needReload) guard(false);
  if (!el) return;
  el.btn.disabled = needReload;
  el.cache.disabled = needReload;
  paintProgress(true);
  if (r && r.head && !r.code) {
    const s = sumOps(r.ops);
    const parts = [{ key: 'backup.imported' },
      { key: 'backup.import.result', params: { add: formatNumber(s.add), changed: formatNumber(s.changed), kept: formatNumber(s.kept), skipped: formatNumber(s.skipped) } }];
    // `[9c-3 — 9c2R #8]` gzip 꼬리(트레일러)만 잘렸고 끝 줄까지 들어왔으면 알리지 않는다 — 실제로 빠진 것이 없다
    if (r.truncated || (r.broken && !r.ended)) parts.push({ key: 'backup.import.broken' });
    if (r.mismatch && r.mismatch.length) {
      // `[9c-3 — 9c2R #5]` 이 앱이 모르는 스토어 줄(손댄 파일)은 이름이 없다 — 이름이 하나도 없으면 빈 괄호 문구를 내지 않는다
      const names = Array.from(new Set(r.mismatch.map((m) => PART_OF[m.store]).filter(Boolean)));
      if (names.length) parts.push({ key: 'backup.import.countsDiffer', params: { parts: names.map((p) => t('backup.part.' + p)).join(', ') } });
    }
    setMsg(parts);
  } else {
    setMsg(PREVIEW_ERR[r && r.code] || 'backup.import.failed');
  }
  paintImport();
  if (needReload) { try { el.reload.focus(); } catch (e) { /* 그대로 */ } }
}

function onImportCancel() {
  if (busy) return;
  pick = null;
  setMsg(null);
  paintImport();
  try { el.imp.focus(); } catch (e) { /* 그대로 */ }
}

async function refreshPdfs() {
  let list = [];
  try { list = await pdfList(); } catch (e) { list = []; }
  if (!el) return;
  while (el.pdfList.firstChild) el.pdfList.removeChild(el.pdfList.firstChild);
  for (const p of list) {
    const li = document.createElement('li');
    li.className = 'backup-pdf-row';
    const text = document.createElement('div');
    text.className = 'backup-pdf-text';
    const name = document.createElement('span');
    name.className = 'backup-pdf-name';
    name.dir = 'auto';
    name.textContent = p.title || p.fileName;
    const size = document.createElement('span');
    size.className = 'backup-pdf-size';
    const sz = document.createElement('bdi');      // "4.0 KB" — 아랍어 화면에서 "KB 4.0" 으로 뒤집히지 않게
    sz.dir = 'ltr';
    sz.textContent = formatBytes(p.size);
    size.appendChild(sz);
    text.appendChild(name);
    text.appendChild(size);
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-ba', 'pdf');
    b.setAttribute('data-id', p.id);
    b.textContent = t('backup.pdf.download');
    b.setAttribute('aria-label', t('backup.pdf.downloadFor', { title: p.title || p.fileName }));
    li.appendChild(text);
    li.appendChild(b);
    el.pdfList.appendChild(li);
  }
  el.pdfList.hidden = list.length === 0;
  if (el.pdfEmpty) el.pdfEmpty.hidden = list.length > 0;
  applyTranslations(el.pdfs);
}

async function onPdf(id) {
  try {
    const got = await pdfBlob(id);
    if (!got) { setMsg('backup.pdf.failed'); return; }
    download(got.blob, got.name);
  } catch (e) {
    setMsg('backup.pdf.failed');
  }
}

function onClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-ba]') : null;
  if (!b || !el.card.contains(b)) return;
  const act = b.getAttribute('data-ba');
  if (act === 'export') onExport();
  else if (act === 'pdf') onPdf(b.getAttribute('data-id'));
  else if (act === 'import') onPickFile();
  else if (act === 'import-go') onImportGo();
  else if (act === 'import-cancel') onImportCancel();
  else if (act === 'reload') reloadAt(null);
}
