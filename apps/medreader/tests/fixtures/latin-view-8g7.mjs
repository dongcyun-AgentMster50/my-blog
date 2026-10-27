/* ============================================================
   tests/fixtures/latin-view-8g7.mjs — `[8g-7]` "라틴 검색어의 결과는 8g 와 같다"의 기준 만들기

   지어낸 책 하나(개요 + 쪽 글자 — 원서 문장 없음)를 흉내 IndexedDB 에 넣고, 라틴 검색어마다 **앱 엔진 결과**와
   화면 순수 함수(`groupRows`·`bandList`·`scriptMismatch`)가 만드는 결과 모형을 JSON 으로 낸다.
   `base` = 앱 `js/` 가 든 폴더의 URL — 지금 판(테스트)과 HEAD `c6352a4` 판(스크래치에 `git archive` 로 푼 것 —
   기준 JSON `latin-view-8g7.golden.json` 을 만들 때)에서 **같은 코드**로 돈다. 8g-7 에 새로 생긴 `chapterGroup` 은 있으면
   부르고 **결과가 있을 때만** `chapters` 키를 더한다 — HEAD 기준 JSON 엔 그 키가 없으므로, 라틴 검색어에 "장" 묶음이 생기면 다르다.
   ============================================================ */

/** 라틴 검색어 표본 — 진료과·장기계 사전에 든 낱말(켜짐 조건을 지우면 "장" 묶음이 생길 것)과 평범한 낱말·약어·그리스 문자. */
export const LATIN_QUERIES = Object.freeze([
  'pulmonary', 'Pulmonary', 'respiratory', 'lung', 'heart', 'cardiac', 'kidney', 'renal', 'liver', 'diabetes',
  'cancer', 'skin', 'eye', 'pain', 'infection', 'hypertension', 'blood pressure', 'blood', 'thyroid', 'stroke',
  'MI', 'β-blocker', 'beta blocker', 'quilar', 'zorvat', 'diseases', 'pneumologie', 'cœur', 'metform', 'x'
]);

/** 지어낸 개요(쪽 1–12). 실물 제목이 아니다. */
export const SYNTH_OUTLINE = Object.freeze([
  { t: 'Front Matter', p: 1, d: 1 },
  { t: '1. Lung and Respiratory Care', p: 2, d: 1 },
  { t: '2. Heart Matters', p: 5, d: 1 },
  { t: 'Kidney Notes', p: 7, d: 2 },
  { t: '3. Quilar Zorvatosis', p: 9, d: 1 },
  { t: 'Unplaced', p: null, d: 1 }
]);

let ELID = 0;
function eline(text, o) {
  const p = o || {};
  return {
    id: 'e' + (++ELID), text: text, bbox: [0, 0, 100, 10], baseline: 0, fontSize: p.fs == null ? 10 : p.fs,
    col: 0, role: p.role || 'body', hyphenJoin: false, paraId: p.para == null ? null : p.para,
    regionId: p.region == null ? null : p.region, runs: []
  };
}

function epage(docId, pageNo, paras, o, M) {
  const opt = o || {};
  const lines = [];
  const ps = [];
  paras.forEach((p, i) => {
    const pid = 'p' + pageNo + '-' + i;
    const ids = (p.lines || [p.text]).map((t) => { const l = eline(t, { para: pid, fs: p.fs }); lines.push(l); return l.id; });
    ps.push({ id: pid, lineIds: ids, kind: p.kind || 'body', bbox: [0, 0, 1, 1], continuesNext: false, continuesPrev: false });
  });
  const regions = [];
  if (opt.table && opt.table.length) {
    const ids = opt.table.map((t) => { const l = eline(t, { region: 'g' + pageNo, role: 'table' }); lines.push(l); return l.id; });
    regions.push({ id: 'g' + pageNo, kind: 'table', bbox: [0, 0, 1, 1], lineIds: ids, pageNo: pageNo });
  }
  return {
    docId: docId, pageNo: pageNo, width: 600, height: 800, algoVersion: M.ALGO_VERSION,
    storeVersion: 1, derivedHash: M.derivedHash(), lines: lines, paragraphs: ps, regions: regions,
    columns: { count: 1, gutters: [] },
    stats: { medianFontSize: 10, medianLeading: 12, bodyLeft: [], warn: null, widthFixed: 0 }, roleVersion: 1
  };
}

/** 지어낸 쪽 글자(12쪽). 원서 문장이 아니다. */
function synthPages(D, M) {
  const P = (n, paras, o) => epage(D, n, paras, o, M);
  return [
    P(1, [{ text: 'Front matter of an invented book about quilar and zorvat.' }]),
    P(2, [{ kind: 'heading', text: 'Lung and Respiratory Care', fs: 16 }, { text: 'Pulmonary rehab; respiratory therapy; lung volumes. Acute MI is not here.' }]),
    P(3, [{ text: 'Blood pressure targets; blood count; hypertension notes. Start metformin; β-blocker; beta blocker.' }], { table: ['Kidney | renal | dose', 'Liver | hepatic | dose'] }),
    P(4, [{ text: 'Skin and eye findings; pain scores; infection control. Diseases of many kinds.' }]),
    P(5, [{ kind: 'heading', text: 'Heart Matters', fs: 16 }, { text: 'Cardiac output; heart rate; stroke volume. MI after (MI).' }]),
    P(6, [{ text: 'Thyroid tests and diabetes screening. Cancer screening.' }]),
    P(7, [{ kind: 'heading', text: 'Kidney Notes', fs: 13 }, { text: 'Renal clearance and kidney size. pneumologie et cœur (mots).' }]),
    P(8, [{ text: 'Pulmonary pulmonary PULMONARY Pulmonary-artery.' }]),
    P(9, [{ kind: 'heading', text: 'Quilar Zorvatosis', fs: 16 }, { text: 'Quilar basto zorvat; quilar again.' }]),
    P(10, [{ text: 'Zorvat in diabetes and in lung disease.' }]),
    P(11, [{ text: 'Stroke unit; eye clinic; skin clinic.' }]),
    P(12, [{ text: 'Back matter.' }])
  ];
}

/**
 * @param {string|URL} base 앱 `js/` 폴더 URL(끝에 '/')
 * @returns {Promise<Array<Object>>} 검색어마다 결과 모형
 */
export async function latinViews(base) {
  const B = String(base);
  const db = await import(new URL('db.js', B));
  const { ALGO_VERSION } = await import(new URL('pdf/extract.js', B));
  const { fromStored, derivedHash } = await import(new URL('text/store.js', B));
  const { searchRecordOf } = await import(new URL('text/search.js', B));
  const engine = await import(new URL('search/engine.js', B));
  const ui = await import(new URL('ui/search.js', B));
  const M = { ALGO_VERSION, derivedHash };
  const D = 'LATIN8G7';
  await db.put('documents', { id: D, title: 'Synthetic', fileHash: 'h-' + D, pageCount: 12, lastOpenedAt: 1, lang: 'en',
    outline: SYNTH_OUTLINE.map((x) => Object.assign({}, x)), outlineV: 1 });
  const recs = synthPages(D, M);
  await db.putAll('pages', recs);
  await db.putAll('searchText', recs.map((rec) => Object.assign({ docId: D }, searchRecordOf(fromStored(rec)))));
  const out = [];
  for (const q of LATIN_QUERIES) {
    const r = await engine.searchDoc(D, q);
    const hits = (r.hits || []).map((h) => ({ pageNo: h.pageNo, at: h.at, len: h.len, kind: h.kind }));
    const view = {
      q: q,
      error: r.error || null,
      truncated: !!r.truncated,
      pageCount: r.pageCount, pagesCovered: r.pagesCovered,
      hits: hits,
      groups: ui.groupRows(hits).map((g) => ({ kind: g.kind, count: g.count, rows: g.rows.map((x) => ({ pageNo: x.pageNo, count: x.count, at: x.first.at })) })),
      band: ui.bandList(hits),
      outcome: ui.outcomeOf(r),
      mismatch: ui.scriptMismatch(q, 'en')
    };
    // `[8g-7]` "장" 묶음 — HEAD 판엔 함수가 없다. 지금 판은 **생길 때만** 키를 더한다 → 라틴 검색어에 묶음이 생기면 기준 JSON 과 달라진다.
    const ch = typeof ui.chapterGroup === 'function' ? ui.chapterGroup(q, synthToc(), { docLang: 'en' }) : null;
    if (ch) view.chapters = ch;
    out.push(view);
  }
  return out;
}

/** 지어낸 책의 목차(`tocOf` 와 같은 꼴 — 개요). */
export function synthToc() {
  return { source: 'outline', items: SYNTH_OUTLINE.map((x) => Object.assign({}, x)), pageLabels: null, outlineRead: true };
}
