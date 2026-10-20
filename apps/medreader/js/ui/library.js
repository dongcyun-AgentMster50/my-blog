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

   ── `[배포 안전장치]` [⋯] → [텍스트 다시 추출] (spec 9-4) ──────
   · 확인은 페이지 안 대화상자(`#reextractDialog`). `confirm()` 을 쓰지 않는다.
   · 순서가 곧 안전이다(`reextractDoc`): ① PDF 를 먼저 손에 쥔다(못 열면 **아무것도 지우지 않는다**)
     ② 옛 추출기를 멈추고 마지막 쓰기까지 기다린다 ③ 파생 데이터를 한 트랜잭션으로 지운다
     (`db.resetDerived` — 사용자 필드는 남는다) ④ 새 추출기를 붙인다. 그동안 `openDoc` 은 기다린다.
   · 읽기는 그동안에도 된다 — 리더가 보는 쪽이 우선순위 0 이라 지워진 쪽이 먼저 다시 생긴다(새 문서와 같은 길).
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
// `[8g-2]` 검색 엔진 캐시 배선만(화면 변화 없음) — 새로 쓰인 쪽은 다음 검색 전에 다시 읽고, 다시 추출·삭제면 버린다.
import { notePage as searchNotePage, invalidate as searchInvalidate } from '../search/engine.js';
// `[8g-4a]` 서재 [검색](서재 전체 범위) — 되돌림 스위치(17-8-12 §9)가 끄면 숨긴다.
import { SEARCH } from '../config.js';

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

  // `[8g-4a]` [검색] → `#/search`. 이동은 `data-nav` 전역 위임 하나(12-7) — 여기서는 보이기만 정한다.
  const searchBtn = root.querySelector('#librarySearchBtn');
  if (searchBtn) searchBtn.hidden = !SEARCH.ENABLED;

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

  // `[배포 안전장치]` 9-4 [텍스트 다시 추출] — 같은 [⋯] 패널, 같은 위임(`data-action`).
  const rx = el('div', 'doc-reextract');
  rx.appendChild(el('h3', 'doc-lang-title', t('library.reextract.title')));
  rx.appendChild(el('p', 'doc-lang-hint', t('library.reextract.hint')));
  const rb = el('button', null, t('library.reextract.button'));
  rb.type = 'button';
  rb.setAttribute('data-action', 'reextract');
  rx.appendChild(rb);
  panel.appendChild(rx);
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
      // `[P1 경합]` 자기 필드(쪽수가 비었을 때의 `pageCount`·`lastOpenedAt`)만 합친다.
      doc = await touchDuplicate(existing, pageCount);
      setStatus(t('library.import.duplicate'));
    } else {
      // 같은 해시의 변형이 이미 있으면 그것을 재사용한다(같은 파일을 다시 가져온 경우).
      const prior = decision.identity === fileHash ? null : await db.findByFileHash(decision.identity);
      if (prior) {
        // 예전 코드는 여기서 쪽수를 채우지 않았다 — 변형 키는 쪽수가 같아야 찾아지므로 채울 일이 없다.
        doc = await touchDuplicate(prior, null);
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
  // `[8g-2]` 검색 캐시 — 쪽이 새로 쓰이면 그 쪽만 다시 읽게, 되감기면(algoVersion·derivedHash) 버린다.
  ex.addEventListener('page', (e) => { searchNotePage(doc.id, e && e.detail && e.detail.pageNo); });
  ex.addEventListener('reextract', () => { searchInvalidate(doc.id); });
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
async function updateDocLang(docId, decide) {
  // `[P1 경합]` 같은 도우미(`db.patch`)로 통일 — 자기 필드(`lang`·`langSource`·`langGuess`)만 합친다.
  let changed = false;
  const out = await db.patch('documents', docId, (cur) => {
    const res = decide(cur);
    if (!res || !res.rec || res.rec === cur) return null;
    changed = !!res.changed;
    const part = {};
    for (const f of LANG_FIELDS) if (f in res.rec) part[f] = res.rec[f];
    return part;
  });
  return { wrote: out.wrote, changed: out.wrote && changed, rec: out.rec };
}

/** `[P1 경합]` 원문 언어 쓰기가 맡은 필드. */
const LANG_FIELDS = Object.freeze(['lang', 'langSource', 'langGuess']);

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
  // 다시 추출이 옛 추출기를 내리고 새것을 붙이는 사이에 열면, 여기서 따로 추출기를 만들어
  // 지우기 전의 `extraction` 을 읽게 된다 — 그 일이 끝나기를 기다려 새 추출기를 쓴다.
  if (reextracting.has(docId)) return reextracting.get(docId);
  if (extractors.has(docId)) return extractors.get(docId);
  const doc = await db.get('documents', docId);
  if (!doc) return null;
  const rec = await db.get('blobs', docId);
  if (!rec || !rec.blob) return null;
  // 같은 이유 — 이것은 문서를 **열 때마다** 일어난다.
  const pdfDoc = await openDocument(rec.blob);
  // `[P1 경합]` 위에서 읽은 `doc` 을 통째로 쓰지 않는다 — Blob 읽기 + PDF 파싱(큰 책은 수백 ms~초)
  // 동안 다른 곳이 쓴 필드를 되돌린다(review.md 7c8-5 의 가장 긴 창). 자기 필드만 합친다.
  const res = await touchOnOpen(docId, pdfDoc.numPages);
  // 그사이 문서가 지워졌으면 되살리지 않는다(예전에는 통째 쓰기가 다시 만들었다).
  if (!res.rec) return null;
  return attach(res.rec, pdfDoc);
}

/**
 * `[P1 경합]` 문서를 열 때의 쓰기 — **자기 필드(`pageCount`·`lastOpenedAt`)만**.
 * 저장된 쪽수가 실제와 다르면 실제를 믿는다(2차 방벽이 이 값을 쓴다).
 * @returns {Promise<{wrote:boolean, rec:Object|null}>}
 */
export function touchOnOpen(docId, numPages, now) {
  const at = Number.isFinite(now) ? now : Date.now();
  return db.patch('documents', docId, (cur) => {
    const part = { lastOpenedAt: at };
    if (cur.pageCount !== numPages) part.pageCount = numPages;
    return part;
  });
}

/**
 * `[P1 경합]` 같은 파일을 다시 가져왔을 때 — **자기 필드**만: 처음 열어 본 레코드면 `pageCount`,
 * 그리고 `lastOpenedAt`. `pageCount` 인자가 `null` 이면 쪽수는 건드리지 않는다.
 * 레코드가 그사이 사라졌으면(드묾) 찾았던 그대로 다시 만든다 — 덮을 다른 필드가 없다.
 * @param {Object} found `findByFileHash` 로 찾은 레코드
 * @returns {Promise<Object>} 지금 저장된 레코드
 */
export async function touchDuplicate(found, pageCount, now) {
  const at = Number.isFinite(now) ? now : Date.now();
  const res = await db.patch('documents', found.id, (cur) => {
    const part = { lastOpenedAt: at };
    if (pageCount !== null && pageCount !== undefined && !Number(cur.pageCount)) part.pageCount = pageCount;
    return part;
  });
  if (res.rec) return res.rec;
  const doc = Object.assign({}, found, { lastOpenedAt: at });
  if (pageCount !== null && pageCount !== undefined && !Number(doc.pageCount)) doc.pageCount = pageCount;
  await db.put('documents', doc);
  return doc;
}

/** 라우터가 리더를 떠날 때 부르지 않는다 — 추출은 계속 돈다(9-4 백그라운드). */
export function extractorFor(docId) { return extractors.get(docId) || null; }

/* ────────────────────────────────────────────────────────
   5-2. `[배포 안전장치]` 텍스트 다시 추출 (spec 9-4)
   ──────────────────────────────────────────────────────── */

/** docId → 다시 추출이 끝나면 새 추출기(또는 null)를 주는 약속. 두 번 누름도 이것으로 막는다. */
const reextracting = new Map();

/**
 * 그 문서의 파생 데이터를 지우고 지금 `algoVersion` 으로 처음부터 다시 뽑는다.
 * 사용자 데이터(원문 언어·마지막 쪽·번역 캐시·퀴즈 기록·카드)는 남는다 — `db.resetDerived` 주석의 목록.
 * @returns {Promise<Extractor|null>}
 */
export function reextractDoc(docId) {
  if (reextracting.has(docId)) return reextracting.get(docId);
  const p = (async () => {
    // ① PDF 를 먼저 손에 쥔다. 원본이 없거나 pdf.js 를 못 받으면(오프라인) 여기서 멈춘다 —
    //    쪽을 지운 뒤에 다시 뽑지 못하면 읽던 책이 빈다.
    const old = extractors.get(docId) || null;
    let pdfDoc = old && old.pdfDoc;
    if (!pdfDoc) {
      const blob = await db.get('blobs', docId);
      if (!blob || !blob.blob) { bannerKey('library.reextract.noFile'); return null; }
      pdfDoc = await openDocument(blob.blob);
    }
    // ② 옛 추출기를 내리고 **도는 중인 쪽과 마지막 저장까지** 기다린다. 기다리지 않으면
    //    지운 뒤에 옛 커서의 `extraction` 이 다시 쓰인다(review.md PR-5 ②).
    if (old) {
      extractors.delete(docId);
      await old.stopAndSettle();
    }
    unwatchLangGuess(docId);
    progressByDoc.delete(docId);
    // ③ 한 트랜잭션 — 쪽·문항·색인·extraction. 그사이 문서가 지워졌으면 아무것도 하지 않는다.
    const res = await db.resetDerived(docId);
    searchInvalidate(docId);   // `[8g-2]` 지운 검색 글자를 캐시가 들고 있지 않게
    if (!res.reset) return null;
    // ④ 새 추출기. 새 문서처럼 algoVersion 0 에서 시작하므로 "엔진이 갱신되어…" 배너는 뜨지 않는다
    //    (`attach` 는 이미 뽑아 둔 쪽이 있을 때만 그 배너를 낸다).
    const ex = await attach(res.rec, pdfDoc);
    setStatus(t('library.reextract.started', { title: res.rec.title || res.rec.fileName || '' }));
    return ex;
  })();
  const guarded = p.catch((e) => { banner(e); return null; })
    .finally(() => { reextracting.delete(docId); });
  reextracting.set(docId, guarded);
  return guarded;
}

/**
 * 페이지 안 확인 대화상자. `confirm()` 은 브라우저 문자열·모양이고 RTL 을 따르지 않는다.
 * `<dialog>` 의 `showModal` 이 없으면(아주 옛 브라우저) `open` 속성으로 띄운다.
 * @returns {Promise<boolean>}
 */
function askReextract(name) {
  const dlg = document.getElementById('reextractDialog');
  if (!dlg) return Promise.resolve(false);
  applyTranslations(dlg);
  const title = dlg.querySelector('#reextractTitle');
  if (title) title.textContent = t('library.reextract.confirmTitle', { title: name });
  return new Promise((resolve) => {
    const finish = (ok) => {
      dlg.removeEventListener('click', onClick);
      dlg.removeEventListener('cancel', onCancel);
      if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
      resolve(ok);
    };
    const onClick = (ev) => {
      const b = ev.target.closest('button[data-dialog]');
      if (b) finish(b.getAttribute('data-dialog') === 'ok');
    };
    // Esc — 기본 닫기를 막고 같은 길(취소)로 닫는다.
    const onCancel = (ev) => { ev.preventDefault(); finish(false); };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('cancel', onCancel);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    // 실수로 지우지 않게 첫 초점은 [취소].
    const cancel = dlg.querySelector('button[data-dialog="cancel"]');
    if (cancel) cancel.focus();
  });
}

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

  if (btn.getAttribute('data-action') === 'reextract') {
    if (reextracting.has(docId)) return;
    const doc = await db.get('documents', docId);
    if (!doc) return;
    const name = doc.title || doc.fileName || docId;
    if (!(await askReextract(name))) return;
    await reextractDoc(docId);
    await renderList();
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
      searchInvalidate(docId);   // `[8g-2]`
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
