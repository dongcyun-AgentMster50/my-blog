/* ============================================================
   MedReader — 서재 (spec 12-6 최소)

   문서 카드(제목·쪽수·추출 진행·마지막 읽은 위치) + [PDF 가져오기]
   + [이어 읽기] + [삭제] + 저장 공간.

   ── 이 파일이 책임지는 두 가지 방벽 ────────────────────
   1. **중복 생성 금지** — `fileHash` 가 같으면 기존 문서를 연다(16-B).
   2. **`pageCount` 2차 비교** — Review 가 해시 충돌을 실제로 만들었다.
      표본 해시는 파일의 13.22% 만 읽으므로 `fileHash` 가 같아도 다른
      파일일 수 있다. `hash.js` 주석이 "가져오기 단계에서 `pageCount` 를
      함께 비교한다"고 약속했는데 그 코드가 여기(3단계) 몫이었다.
      → `identityFor()` 가 그 판단을 하고, 테스트가 그것을 고정한다.

   UI 계층이다. `loader`·`db`·`Extractor` 가 내는 **코드**를 배너로 넘긴다 —
   서비스 계층에 문자열을 되돌려 넣지 않는다(3-2).

   ── `[7c]` 원문 언어 (9-2 · 12-6) ───────────────────────
   · 카드 메타 줄 "원문: English (자동)" 과 [⋯] → "원문 언어" 하나뿐인 패널.
   · 자동 추정은 추출이 앞 30쪽에서 본문 쪽을 5쪽 모으면 **한 번** 돈다(`watchLangGuess`).
     판정은 순수 `text/lang.js`, 여기는 읽고 쓰기만 한다.
   · ★ 쓰기는 **한 트랜잭션 안에서 다시 읽고** 쓴다(`updateDocLang`). 추정이 도는 사이
     사용자가 [⋯] 에서 고르면 `langSource = 'user'` 가 먼저 들어가 있고, 추정은 그것을
     보고 물러난다 — 미리 읽어 둔 레코드로 판단하면 사용자 선택을 덮어쓴다.
   · 바뀌면 `medreader:doclang` 이벤트를 낸다 — 열린 리더가 본문 `lang` 과 낭독 큐를 갈아 끼운다.
   ============================================================ */

import * as db from '../db.js';
import * as settings from '../settings.js';
import { fileIdentityHash } from '../hash.js';
import { openDocument } from '../pdf/loader.js';
import { Extractor, STATUS } from '../pdf/extract.js';
import { t, applyTranslations, formatBytes, formatNumber } from '../i18n/index.js';
import { go, readerHash } from '../router.js';
import { fromStored } from '../text/store.js';
import {
  SUPPORTED_SRC, GUESS, guessLang, applyGuess, applyUserLang, shouldGuess,
  collectSample, readyToGuess, docLangOf, langSourceOf
} from '../text/lang.js';

/* ────────────────────────────────────────────────────────
   1. 동일성 판단 — **순수 함수**. tests/library.test.mjs 가 고정한다.
   ──────────────────────────────────────────────────────── */

/**
 * `fileHash` 로 찾은 기존 레코드를 **재사용해도 되는가**를 정한다.
 *
 * 표본 해시(`hash.js`)는 8MB 초과 파일의 13.22% 만 읽는다. 크기가 같고
 * 표본 밖만 다른 두 파일은 **같은 `fileHash`** 를 낸다(Review 가 실제로
 * 만들어 보였다). 그래서 쪽수를 2차 방벽으로 쓴다.
 *
 * - 기존 레코드가 없다 → 새 문서.
 * - 기존 `pageCount` 가 0 이다 → 아직 열어 본 적 없는 레코드다. 채워 쓴다.
 * - 기존 `pageCount` 가 새 파일과 같다 → **같은 파일.** 재사용(중복 생성 금지).
 * - 다르다 → **다른 파일.** 새 문서를 만들되, `fileHash` 인덱스가 unique 라
 *   같은 값을 두 번 쓸 수 없으므로 쪽수를 덧붙인 변형 키를 쓴다. 이 키는
 *   결정적이므로 같은 파일을 다시 가져오면 그 변형이 다시 찾아진다.
 *
 * @param {Object|null} existing  `findByFileHash` 결과
 * @param {string} fileHash
 * @param {number} pageCount      **지금 연 PDF 의** 실제 쪽수
 * @returns {{reuse:boolean, identity:string, reason:string}}
 */
export function identityFor(existing, fileHash, pageCount) {
  const n = Number(pageCount) || 0;
  if (!existing) return { reuse: false, identity: fileHash, reason: 'new' };

  const old = Number(existing.pageCount) || 0;
  if (old === 0) return { reuse: true, identity: fileHash, reason: 'adopt' };
  if (old === n) return { reuse: true, identity: fileHash, reason: 'same' };

  // 해시는 같은데 쪽수가 다르다 — 다른 파일이다.
  return { reuse: false, identity: variantIdentity(fileHash, n), reason: 'pagecount-mismatch' };
}

/** 쪽수를 덧붙인 변형 키. 결정적이어야 한다 — 같은 파일이 늘 같은 키를 얻는다. */
export function variantIdentity(fileHash, pageCount) {
  return String(fileHash) + ':n' + (Number(pageCount) || 0);
}

/* ────────────────────────────────────────────────────────
   2. 상태
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
/** docId → Extractor. 화면이 바뀌어도 추출은 계속 돈다. */
const extractors = new Map();
/** docId → 마지막 progress detail. 카드를 다시 그릴 때 쓴다. */
const progressByDoc = new Map();

export function initLibrary() {
  root = document.querySelector('[data-screen="library"]');
  if (!root) return;
  els = {
    importBtn: root.querySelector('#libraryImport'),
    file: root.querySelector('#fileInput'),
    status: root.querySelector('#importStatus'),
    list: root.querySelector('#docList'),
    empty: root.querySelector('#libraryEmpty'),
    fileProto: root.querySelector('#fileProtoNote'),
    storage: root.querySelector('#storageLine')
  };

  els.importBtn.addEventListener('click', openFilePicker);
  els.file.addEventListener('change', async () => {
    const f = els.file.files && els.file.files[0];
    // 같은 파일을 다시 골라도 change 가 오도록 값을 비운다.
    els.file.value = '';
    if (f) await importFile(f);
  });

  els.list.addEventListener('click', onListClick);

  // 20절 — file:// 로 열렸으면 빈 서재에 안내를 띄운다.
  if (location.protocol === 'file:') els.fileProto.hidden = false;
}

/** 온보딩 3화면의 [PDF 가져오기]가 이것을 부른다. */
export function openFilePicker() {
  if (els && els.file) els.file.click();
}

/* ────────────────────────────────────────────────────────
   3. 그리기 — 전부 textContent (13절 XSS)
   ──────────────────────────────────────────────────────── */

export async function showLibrary() {
  if (!root) return;
  await renderList();
  await renderStorage();
}

async function renderList() {
  const docs = [];
  try {
    await db.iterate('documents', { index: 'lastOpenedAt', direction: 'prev' }, (v) => { docs.push(v); });
  } catch (e) {
    banner(e);
    return;
  }

  clear(els.list);
  els.empty.hidden = docs.length > 0;

  for (let i = 0; i < docs.length; i++) els.list.appendChild(docCard(docs[i]));
}

function docCard(doc) {
  const card = el('div', 'card doc-card');
  card.setAttribute('data-doc-id', doc.id);

  const title = el('h2', 'doc-title');
  title.textContent = doc.title || doc.fileName || doc.id;
  card.appendChild(title);

  const meta = el('div', 'doc-meta');
  meta.appendChild(el('span', null, t('library.card.pages', { n: Number(doc.pageCount) || 0 })));
  meta.appendChild(el('span', null, formatBytes(Number(doc.size) || 0)));
  meta.appendChild(el('span', null, Number(doc.lastPage) > 1
    ? t('library.card.lastRead', { page: formatNumber(doc.lastPage) })
    : t('library.card.neverRead')));
  // 7c — "원문: English (자동)"
  meta.appendChild(el('span', 'doc-src-lang', srcLangText(doc)));
  card.appendChild(meta);

  card.appendChild(extractRow(doc));

  const actions = el('div', 'doc-actions');
  const cont = el('button', 'primary', t('library.card.continue'));
  cont.type = 'button';
  cont.setAttribute('data-action', 'continue');
  const delBtn = el('button', 'danger', t('library.card.delete'));
  delBtn.type = 'button';
  delBtn.setAttribute('data-action', 'delete');
  // 7c — [⋯]. 지금은 "원문 언어" 하나뿐이다(12-6). 같은 위임(`data-action`)을 탄다.
  const panelId = 'docLang-' + String(doc.id);
  const more = el('button', 'doc-more', '⋯');
  more.type = 'button';
  more.setAttribute('data-action', 'more');
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-controls', panelId);
  more.setAttribute('aria-label', t('library.card.more'));
  actions.appendChild(cont);
  actions.appendChild(delBtn);
  actions.appendChild(more);
  card.appendChild(actions);

  card.appendChild(langPanel(doc, panelId));

  return card;
}

/* ── 7c 원문 언어 ─────────────────────────────────────── */

/** 카드 메타 줄의 글자. 언어 이름은 자국어 표기(`onboarding.lang.*`)를 그대로 쓴다. */
function srcLangText(doc) {
  const lang = docLangOf(doc);
  if (SUPPORTED_SRC.indexOf(lang) < 0) return t('library.card.srcLang.unsupported');
  const name = t('onboarding.lang.' + lang);
  return t(langSourceOf(doc) === 'auto' ? 'library.card.srcLang.auto' : 'library.card.srcLang', { lang: name });
}

/** [⋯] 패널 — "원문 언어" 선택 하나. 선택지는 `SUPPORTED_SRC` 에서 만든다(미지원이어도 셋). */
function langPanel(doc, panelId) {
  const panel = el('div', 'doc-lang-panel');
  panel.id = panelId;
  panel.hidden = true;
  const titleId = panelId + '-t';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-labelledby', titleId);

  const h = el('h3', 'doc-lang-title', t('library.lang.title'));
  h.id = titleId;
  panel.appendChild(h);
  panel.appendChild(el('p', 'doc-lang-hint', t('library.lang.hint')));

  const choices = el('div', 'doc-lang-choices');
  for (let i = 0; i < SUPPORTED_SRC.length; i++) {
    const code = SUPPORTED_SRC[i];
    const b = el('button', null, t('onboarding.lang.' + code));
    b.type = 'button';
    b.setAttribute('data-action', 'set-lang');
    b.setAttribute('data-lang', code);
    b.setAttribute('lang', code);
    choices.appendChild(b);
  }
  panel.appendChild(choices);
  paintLangChoices(panel, doc);
  return panel;
}

function paintLangChoices(panel, doc) {
  const lang = docLangOf(doc);
  const btns = panel.querySelectorAll('button[data-lang]');
  for (let i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-lang') === lang ? 'true' : 'false');
  }
}

/** 카드 하나의 원문 언어 부분만 다시 그린다 — 패널을 연 채로 둔다. */
function paintLangBits(doc) {
  if (!els || !els.list || !doc) return;
  const card = els.list.querySelector('[data-doc-id="' + cssEscape(doc.id) + '"]');
  if (!card) return;
  const line = card.querySelector('.doc-src-lang');
  if (line) line.textContent = srcLangText(doc);
  const panel = card.querySelector('.doc-lang-panel');
  if (panel) paintLangChoices(panel, doc);
}

/** 추출 진행 — **"312/7000" 이 여기에 그려진다**(9-4 · 12-3). */
function extractRow(doc) {
  const row = el('div', 'extract-row');
  const label = el('span', 'extract-label');
  const track = el('div', 'progress-track');
  const fill = el('div', 'progress-fill');
  track.appendChild(fill);
  row.appendChild(label);
  row.appendChild(track);

  const live = progressByDoc.get(doc.id);
  const ex = live || (doc.extraction || {});
  const total = Number(live ? live.pageCount : doc.pageCount) || 0;
  const done = Number(ex.pagesDone) || 0;
  const failed = Array.isArray(ex.failed) ? ex.failed.length : 0;

  if (ex.done) {
    label.textContent = t('library.card.extractDone');
  } else if (live && live.status === STATUS.RUNNING) {
    label.textContent = t('library.card.extracting', { done: formatNumber(done), total: formatNumber(total) });
  } else if (total > 0) {
    label.textContent = t('library.card.extractPaused', { done: formatNumber(done), total: formatNumber(total) });
  } else {
    label.textContent = t('library.card.extractPaused', { done: '0', total: '—' });
  }
  if (failed > 0) {
    label.textContent += ' · ' + t('library.card.extractFailed', { n: failed });
  }

  fill.style.inlineSize = (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0) + '%';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(total || 0));
  track.setAttribute('aria-valuenow', String(done));
  return row;
}

async function renderStorage() {
  try {
    const e = await db.estimate();
    if (!e.supported) {
      els.storage.textContent = t('library.storage.unknown');
      return;
    }
    let line = t('library.storage', { used: formatBytes(e.usage), quota: formatBytes(e.quota) });
    // 16-B — 온보딩이 persist() 를 불렀는지 사용자에게 보인다.
    if (navigator.storage && navigator.storage.persisted) {
      const p = await navigator.storage.persisted();
      line += ' · ' + t(p ? 'storage.persisted' : 'storage.notPersisted');
    }
    els.storage.textContent = line;
  } catch (e) {
    els.storage.textContent = '';
  }
}

/* ────────────────────────────────────────────────────────
   4. 가져오기 (12-6)
   ──────────────────────────────────────────────────────── */

async function importFile(file) {
  // 확장자·MIME 중 하나라도 맞으면 시도한다. 둘 다 아니면 pdf.js 를 부르지 않는다.
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!looksPdf) {
    setStatus(t('library.import.notPdf'));
    return;
  }

  try {
    setStatus(t('library.import.hashing'));
    const fileHash = await fileIdentityHash(file);

    setStatus(t('library.import.opening'));
    // pdf.js 를 먼저 열어야 쪽수를 안다 — 2차 방벽이 쪽수를 요구한다.
    // `[수정 2026-09-27]` 파일을 **통째로 올리지 않는다.**
    // 전에는 `await file.arrayBuffer()` 로 우리 힙에 한 벌, pdf.js 가 또 한 벌을
    // 들어 100MB 자료가 순간 200MB 가 됐다(`hash.js` 가 경고해 둔 그것).
    // `openDocument` 가 Blob 을 받으면 blob URL 로 넘겨 사본이 하나가 된다.
    const pdfDoc = await openDocument(file);
    const pageCount = pdfDoc.numPages;

    const existing = await db.findByFileHash(fileHash);
    const decision = identityFor(existing, fileHash, pageCount);

    let doc;
    if (decision.reuse) {
      doc = existing;
      // 처음 열어 본 레코드면 쪽수를 채운다.
      if (!Number(doc.pageCount)) doc.pageCount = pageCount;
      doc.lastOpenedAt = Date.now();
      await db.put('documents', doc);
      setStatus(t('library.import.duplicate'));
    } else {
      // 같은 해시의 변형이 이미 있으면 그것을 재사용한다(같은 파일을 다시 가져온 경우).
      const prior = decision.identity === fileHash ? null : await db.findByFileHash(decision.identity);
      if (prior) {
        doc = prior;
        doc.lastOpenedAt = Date.now();
        await db.put('documents', doc);
        setStatus(t('library.import.duplicate'));
      } else {
        doc = newDocument(file, decision.identity, pageCount);
        await db.put('documents', doc);
        await db.put('blobs', { docId: doc.id, blob: file });
        setStatus(decision.reason === 'pagecount-mismatch'
          ? t('library.import.sameHashOtherFile')
          : t('library.import.done', { title: doc.title }));
      }
    }

    await attach(doc, pdfDoc);
    await renderList();
    await renderStorage();
    go(readerHash(doc.id, doc.lastPage || 1));
  } catch (e) {
    banner(e);
    setStatus(t('err.importFailed', { code: (e && e.code) || 'ERR' }));
  }
}

function newDocument(file, identity, pageCount) {
  return {
    id: uuid(),
    // PDF 메타의 Title 은 4단계에서 채운다. 지금은 파일명이 제목이다(12-6).
    title: stripExt(file.name) || t('app.name'),
    fileName: file.name,
    size: file.size,
    pageCount: pageCount,
    fileHash: identity,
    addedAt: Date.now(),
    lastOpenedAt: Date.now(),
    lastPage: 1,
    lastLineId: null,
    // 7c — 기본값으로 남고, 본문 5쪽 추출 뒤 추정이 덮는다(`langSource` 가 'user' 가 아니면).
    lang: 'en',
    langSource: 'default',
    langGuess: null,
    extraction: { done: false, pagesDone: 0, cursor: 1, failed: [], algoVersion: 0 },
    columnsHint: null,
    sectionIndex: []
  };
}

/* ────────────────────────────────────────────────────────
   5. 추출 배선 — `Extractor` 의 이벤트 7종을 전부 받는다.
   (Review 3단계 주의사항 3: progress·page·pageerror·done·stalled·fatal·reextract)
   ──────────────────────────────────────────────────────── */

async function attach(doc, pdfDoc) {
  const old = extractors.get(doc.id);
  if (old) { old.stop(); extractors.delete(doc.id); }
  unwatchLangGuess(doc.id);

  const ex = new Extractor({ docId: doc.id, pdfDoc: pdfDoc, pageCount: pdfDoc.numPages });
  ex.setCurrentPage(doc.lastPage || 1);

  ex.addEventListener('progress', (e) => {
    progressByDoc.set(doc.id, e.detail);
    paintCard(doc.id);
  });
  ex.addEventListener('fatal', (e) => {
    // 지금은 ERR_DB_QUOTA 하나뿐이다.
    banner({ code: e.detail.code });
  });
  ex.addEventListener('stalled', (e) => {
    const n = (e.detail.failed || []).length;
    if (n > 0) bannerKey('err.extractStalled', { n: n });
  });
  // 'reextract' 는 algoVersion·derivedHash 가 올라 되감겼다는 뜻이다. 방금 만든
  // 문서는 algoVersion 0 이라 **항상** 되감기므로, 이미 뽑아 둔 것이 있을 때만
  // 사용자에게 알린다 — 새 문서에 "다시 추출합니다"는 거짓말이다.
  const hadPages = Number(doc.extraction && doc.extraction.pagesDone) > 0;
  ex.addEventListener('reextract', () => { if (hadPages) bannerKey('err.reextract'); });
  // 'pageerror' 와 'page' 는 배너로 올리지 않는다 — 쪽 하나의 실패는
  // 9-4 가 failed[] 로 들고 재시도하며, 사용자를 부를 일이 아니다.

  extractors.set(doc.id, ex);
  await ex.prepare();
  // 7c — 이미 뽑아 둔 쪽으로 곧바로 한 번, 모자라면 쪽이 생길 때마다 다시 본다.
  watchLangGuess(doc.id, ex);
  await ex.start();
  return ex;
}

/* ────────────────────────────────────────────────────────
   5-1. `[7c]` 원문 언어 — 자동 추정과 저장 (spec 9-2)
   ──────────────────────────────────────────────────────── */

/** docId → 추정 감시자. 추정이 한 번 끝나면 지운다. */
const langWatch = new Map();

function watchLangGuess(docId, ex) {
  unwatchLangGuess(docId);
  const w = { busy: false, again: false, done: false, off: null };
  const onPage = (e) => {
    const n = Number(e && e.detail && e.detail.pageNo);
    if (n >= 1 && n <= GUESS.MAX_PAGE) runLangGuess(docId, w);
  };
  ex.addEventListener('page', onPage);
  w.off = () => ex.removeEventListener('page', onPage);
  langWatch.set(docId, w);
  runLangGuess(docId, w);
}

function unwatchLangGuess(docId) {
  const w = langWatch.get(docId);
  if (!w) return;
  w.done = true;
  if (w.off) w.off();
  langWatch.delete(docId);
}

/** 쪽 이벤트가 몰려도 한 번에 하나만 돈다. 도는 중에 온 것은 한 번으로 합친다. */
async function runLangGuess(docId, w) {
  if (w.done) return;
  if (w.busy) { w.again = true; return; }
  w.busy = true;
  try {
    let outcome = 'wait';
    do {
      w.again = false;
      outcome = await tryLangGuess(docId);
    } while (outcome === 'wait' && w.again && !w.done);
    if (outcome !== 'wait' && langWatch.get(docId) === w) unwatchLangGuess(docId);
  } catch (e) {
    // 추정 실패는 조용히 — 기본 en 이 남고, 다음 쪽 이벤트에서 다시 본다.
  } finally {
    w.busy = false;
  }
}

/**
 * @returns {Promise<'skip'|'wait'|'done'>}
 *   skip — 돌 필요가 없다(사용자가 골랐다·이미 추정했다·문서가 없다)
 *   wait — 본문 쪽이 아직 모자라다
 *   done — 추정해 저장했다(또는 그 사이 사용자가 골라 물러났다)
 */
async function tryLangGuess(docId) {
  const doc = await db.get('documents', docId);
  if (!doc || !shouldGuess(doc)) return 'skip';
  const pageCount = Number(doc.pageCount) || 0;
  const last = Math.min(GUESS.MAX_PAGE, pageCount);
  const pages = [];
  let seen = 0;
  for (let n = 1; n <= last; n++) {
    const rec = await db.get('pages', [docId, n]);
    if (!rec) continue;
    seen++;
    let layout = null;
    try { layout = fromStored(rec); } catch (e) { continue; }   // 깨진 저장본은 표본에서 뺀다
    pages.push({ pageNo: n, paragraphs: layout.paragraphs });
  }
  const sample = collectSample(pages);
  if (!readyToGuess(sample.bodyPages, seen, pageCount)) return 'wait';

  const guess = guessLang(sample.text);
  // ★ 판단은 트랜잭션 **안에서** 다시 읽은 레코드로 한다(`applyGuess` 가 'user' 를 지킨다).
  const res = await updateDocLang(docId, (rec) => applyGuess(rec, guess));
  if (res.wrote) announceLang(res.rec, res.changed);
  return 'done';
}

/**
 * ★ 원문 언어 쓰기 — **한 트랜잭션 안에서 읽고, 판단하고, 쓴다.**
 * `decide(rec)` 는 `{changed, rec}` 를 돌려준다. 같은 레코드를 돌려주면(사용자 선택 보호)
 * 쓰지 않는다.
 * @returns {Promise<{wrote:boolean, changed:boolean, rec:Object|null}>}
 */
function updateDocLang(docId, decide) {
  return db.withTx('documents', 'readwrite', (tx, s) => new Promise((resolve, reject) => {
    const store = s.documents;
    const req = store.get(docId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cur = req.result || null;
      const res = cur ? decide(cur) : null;
      if (!res || !res.rec || res.rec === cur) { resolve({ wrote: false, changed: false, rec: cur }); return; }
      const put = store.put(res.rec);
      put.onerror = () => reject(put.error);
      put.onsuccess = () => resolve({ wrote: true, changed: !!res.changed, rec: res.rec });
    };
  }));
}

/** 카드를 고치고, 열린 리더에 알린다(`ui/reader.js` 가 듣는다). */
function announceLang(rec, changed) {
  if (!rec) return;
  paintLangBits(rec);
  document.dispatchEvent(new CustomEvent('medreader:doclang', {
    detail: { docId: rec.id, lang: docLangOf(rec), langSource: langSourceOf(rec), changed: !!changed }
  }));
}

/** [⋯] 에서 고른 원문 언어. `langSource = 'user'` — 이후 추정이 덮어쓰지 않는다. */
async function setUserLang(docId, lang) {
  const res = await updateDocLang(docId, (rec) => applyUserLang(rec, lang));
  if (!res.wrote) return;
  // 사용자가 골랐으니 이 문서의 추정 감시는 더 필요 없다.
  unwatchLangGuess(docId);
  announceLang(res.rec, res.changed);
}

/** 서재·리더가 문서를 열 때. 이미 추출기가 붙어 있으면 그것을 쓴다. */
export async function openDoc(docId) {
  if (extractors.has(docId)) return extractors.get(docId);
  const doc = await db.get('documents', docId);
  if (!doc) return null;
  const rec = await db.get('blobs', docId);
  if (!rec || !rec.blob) return null;
  // 같은 이유 — 이것은 문서를 **열 때마다** 일어난다.
  const pdfDoc = await openDocument(rec.blob);
  // 저장된 쪽수가 실제와 다르면 실제를 믿는다(2차 방벽이 이 값을 쓴다).
  if (doc.pageCount !== pdfDoc.numPages) {
    doc.pageCount = pdfDoc.numPages;
  }
  doc.lastOpenedAt = Date.now();
  await db.put('documents', doc);
  return attach(doc, pdfDoc);
}

/** 라우터가 리더를 떠날 때 부르지 않는다 — 추출은 계속 돈다(9-4 백그라운드). */
export function extractorFor(docId) { return extractors.get(docId) || null; }

function paintCard(docId) {
  if (!els || !els.list) return;
  const card = els.list.querySelector('[data-doc-id="' + cssEscape(docId) + '"]');
  if (!card) return;
  const oldRow = card.querySelector('.extract-row');
  if (!oldRow) return;
  const d = progressByDoc.get(docId) || {};
  const fresh = extractRow({ id: docId, pageCount: d.pageCount, extraction: d });
  card.replaceChild(fresh, oldRow);
}

/* ────────────────────────────────────────────────────────
   6. 카드 조작
   ──────────────────────────────────────────────────────── */

async function onListClick(ev) {
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const card = btn.closest('[data-doc-id]');
  if (!card) return;
  const docId = card.getAttribute('data-doc-id');

  if (btn.getAttribute('data-action') === 'continue') {
    const doc = await db.get('documents', docId);
    go(readerHash(docId, (doc && doc.lastPage) || 1));
    // 이동한 뒤에 추출을 되살린다 — pdf.js 로드가 화면 전환을 붙잡지 않도록.
    openDoc(docId).catch(banner);
    return;
  }

  if (btn.getAttribute('data-action') === 'more') {
    const panel = card.querySelector('.doc-lang-panel');
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    return;
  }

  if (btn.getAttribute('data-action') === 'set-lang') {
    try {
      await setUserLang(docId, btn.getAttribute('data-lang'));
    } catch (e) {
      banner(e);
    }
    return;
  }

  if (btn.getAttribute('data-action') === 'delete') {
    const doc = await db.get('documents', docId);
    const name = (doc && (doc.title || doc.fileName)) || docId;
    // 12-6 — 연쇄 삭제 확인. confirm 은 브라우저 문자열이 아니라 우리 문장을 쓴다.
    if (!confirm(t('library.card.deleteConfirm', { title: name }))) return;
    const ex = extractors.get(docId);
    if (ex) { ex.stop(); extractors.delete(docId); }
    unwatchLangGuess(docId);
    progressByDoc.delete(docId);
    try {
      await db.deleteDocument(docId);
    } catch (e) {
      banner(e);
      return;
    }
    await renderList();
    await renderStorage();
  }
}

/* ────────────────────────────────────────────────────────
   7. 작은 도구들
   ──────────────────────────────────────────────────────── */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function setStatus(text) {
  if (els && els.status) els.status.textContent = text || '';
}

function stripExt(name) {
  const s = String(name || '');
  const i = s.lastIndexOf('.');
  return i > 0 ? s.slice(0, i) : s;
}

function uuid() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return 'x' + Date.now().toString(16) + Math.random().toString(16).slice(2);
}

/** `querySelector` 에 넣을 값. uuid 라 보통 안전하지만 지어낸 id 도 있을 수 있다. */
function cssEscape(s) {
  if (globalThis.CSS && typeof CSS.escape === 'function') return CSS.escape(s);
  return String(s).replace(/["\\]/g, '\\$&');
}

/** 예외의 **코드**를 배너로 넘긴다. 문자열은 배너가 i18n 으로 만든다(3-2). */
function banner(err) {
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { code: (err && err.code) || 'ERR_UNKNOWN', tone: 'error' }
  }));
}

function bannerKey(key, params) {
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { key: key, params: params || null, tone: 'warn' }
  }));
}

/** 언어가 바뀌면 카드의 문장도 다시 만든다. */
export function relabel() {
  applyTranslations(root || undefined);
  if (root && !root.hidden) showLibrary();
}
