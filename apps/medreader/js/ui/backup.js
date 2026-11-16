/* ══════════════════════════════════════════════════════════════════════
   ui/backup.js — 설정 "백업·옮기기" 카드 (spec 17-4-1 6 — 9c-1 내보내기 몫, 가져오기는 9c-2)

   UI 계층이다. 파일은 **기기에 저장만** 한다 — `<a download>`(업로드·동기화·호출 0). 내보내기 본체는 `backup/export.js`.
   - "마지막 백업: n일 전"(`backup.lastExportAt`) · 30일 넘으면 그 줄만 주의 색 + 짧은 글자(9c-D8 — 배너 없음)
   - `☑ 저장된 번역 포함(약 n MB)` 기본 켬(9c-Q2) — n 은 `backup/export.js` `cacheSize()`(8c-2 `cache.stats()` 와 같은 `sizeBytes` 합)
   ★ `ai/*` 를 import 하지 않는다 — `ui/settings.js` 가 이 파일을 import 하므로 inlinetr 의 import 고리에 캐시가 들어가면 안 된다(8d D8).
   - `[내보내기]` → 진행 막대(묶음 이름·n/총, `aria-live`) → 내려받기 → `backup.lastExportAt` = 지금
   - 접는 목록 "PDF 원본 따로 받기" — blob 이 있는 책마다 `[PDF 내려받기]`(원본 Blob 그대로, 이름 = `fileName`)
   ★ 글자는 전부 `textContent`·`data-i18n`(HTML 문자열로 넣는 곳 0). 동작은 카드 하나의 위임 리스너(`data-ba`).
   ══════════════════════════════════════════════════════════════════════ */

import * as settings from '../settings.js';
import { t, applyTranslations, formatBytes, formatNumber, onLangChange } from '../i18n/index.js';
import { exportBackup, pdfList, pdfBlob, cacheSize } from '../backup/export.js';
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
let msg = null;                  // {key, params} — 언어가 바뀌면 다시 쓴다
let prog = null;                 // 마지막 진행 {store, done, total, phase}
let saidAt = 0;
let saidPart = '';

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
  card.addEventListener('click', onClick);
  onLangChange(() => { if (el) { paintAll(); refreshPdfs(); } });
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
  if (!el || busy) return;
  msg = null;
  paintMsg();
}

function paintAll() {
  paintLast();
  paintCacheLabel();
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
  } catch (e) {
    cacheBytes = null;
  }
  if (el) paintCacheLabel();
}

function paintMsg() {
  if (!el.msg) return;
  el.msg.textContent = msg ? t(msg.key, msg.params) : '';
}

function setMsg(key, params) {
  msg = key ? { key: key, params: params } : null;
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
  if (busy) return;
  busy = true;
  el.btn.disabled = true;
  el.cache.disabled = true;
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
      paintProgress(true);
      paintLast();
    }
  }
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
}
