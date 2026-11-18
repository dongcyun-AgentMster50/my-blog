/* ============================================================
   tests/diagram-ui-16.test.mjs — 16-2 개념도: 그리기 · 흐름 · 저장 · 정적 (spec 17-14 4 · 5 표 16-2 행 · 6 · 7 "16-2" · 16-D6–D11)

   G1  순수 — 관계 이름은 **대상 언어** 사전 · `graphOf`(파일에서 온 값 다시 거름 — treat·없는 노드·자기 고리 버림) · `isStale` ·
       `diagramField`(배치 없음) · 12px 문턱(`fitScale`·`zoomNeeded`) · `relationLines`(엣지 수 · RTL ←) · 파일 이름
   G2  ★ viewBox — 노드·선·**엣지 라벨 상자**가 모두 viewBox 안(16-1R 낮음-3 — 좁은 그림의 라벨이 잘리지 않음) · 표본 그래프 × 접힘 × RTL
   G3  ★ `renderDiagram` — createElementNS 만(`innerHTML` 쓰면 가짜 DOM 이 던진다) · 층 순서 선 → 노드 → 라벨(16-1R 낮음-2) ·
       `role=img` + `aria-labelledby` → `<title>`·`<desc>` · 화살촉 `auto-start-reverse` · `rev` 는 marker-start · 대상 언어 줄 direction ·
       원어 줄은 따로 된 `<text direction=ltr lang=src>` · `<img onerror>`·`<script>` 라벨은 글자 그대로 · 작은 그림은 aria-hidden · RTL 거울
   G4  ★ 글로 보기 — `<details open>` · 트리(11c) · 관계 `<ol>` 항목 수 = 엣지 수 · 줄마다 경로 꼬리표
   G5  ★ 흐름 — 그림 있음 → 0호출 · [그리기] 1호출 → 저장(`diagram` 필드) → 닫고 다시 0 · [다시 그리기]는 묻고 나서 force 1 ·
       `target` = 개요 레코드의 것(16-1R 낮음-5) · few-relations · too-big · 동의 없음 → 0 · 늦은 결과는 저장하되 화면은 그대로
   G6  ★ 저장 — `saveDiagram`(updatedAt 새로 · 개요만) · 개요를 다시 만들어도 `diagram` 은 남고 stale · 9c 병합·백업 왕복 멱등
   G7  정적 — `innerHTML` 0 · 호출 자리 한 곳 · 시트 마크업 · 48px · i18n 4언어(관계 8 · 사용량 종류) · ar/fr 검토 표시 · 사용량 늘 보이는 종류
   지어낸 개요·그래프만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

let realFetchCalls = 0;
globalThis.fetch = async () => { realFetchCalls++; throw new Error('호출 금지'); };

const UI = await import('../js/ui/diagram.js');
const D = await import('../js/text/diagram.js');
const { DIAGRAM, AI } = await import('../js/config.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');
const db = await import('../js/db.js');
const S = await import('../js/notes/summaries.js');
const B = await import('../js/text/backup.js');
const { exportBackup } = await import('../js/backup/export.js');
const IM = await import('../js/backup/import.js');
const { SHOW_KINDS } = await import('../js/ui/usage.js');
const { GRAPHS, CYCLIC } = await import('./fixtures/diagram-graphs-16.mjs');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const T0 = new Date(2026, 10, 18, 12, 0, 0).getTime();
const measure = UI.charMeasure;

/* ── 가짜 DOM — createElement·createElementNS·createTextNode. `innerHTML` 을 쓰면 던진다 ── */
function fakeDoc() {
  const doc = {};
  function el(tag, ns) {
    const n = {
      tagName: ns ? String(tag) : String(tag).toUpperCase(), localName: String(tag), namespaceURI: ns || 'http://www.w3.org/1999/xhtml',
      children: [], attrs: {}, _t: '', open: false, dir: '', className: '', ownerDocument: doc, nodeType: 1,
      appendChild(c) { n.children.push(c); c.parentNode = n; return c; },
      setAttribute(k, v) { n.attrs[k] = String(v); if (k === 'class') n.className = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(n.attrs, k) ? n.attrs[k] : null; },
      get firstChild() { return n.children[0] || null; },
      set textContent(v) { n.children = []; n._t = String(v); },
      get textContent() { return n._t + n.children.map((c) => c.textContent).join(''); },
      set innerHTML(v) { throw new Error('innerHTML 금지'); },
      querySelectorAll(sel) {
        const out = [];
        const m = (c) => (sel.charAt(0) === '.' ? String(c.getAttribute && (c.getAttribute('class') || c.className) || '').split(/\s+/).indexOf(sel.slice(1)) >= 0
          : c.localName && c.localName.toLowerCase() === sel);
        (function walk(x) { for (const c of x.children || []) { if (c.nodeType === 1 && m(c)) out.push(c); walk(c); } })(n);
        return out;
      }
    };
    return n;
  }
  doc.createElement = (t) => el(t, null);
  doc.createElementNS = (ns, t) => el(t, ns);
  doc.createTextNode = (t) => ({ textContent: String(t), nodeType: 3 });
  return doc;
}

const OUTLINE = Object.freeze({
  id: 'out:1', kind: 'outline', docId: 'D16', pageNo: 40, target: 'ko', title: '저나트륨혈증 개요', cacheKey: 'ck-1', domain: 'medical',
  range: { from: 40, to: 79, label: 'Chapter 5' },
  points: [{ t: '저나트륨혈증: 혈청 나트륨 < 135', sub: [{ t: '원인: SIADH', sub: [] }, { t: '증상: 혼돈', sub: [] }] }, { t: '평가: 혈청 삼투압', sub: [] }]
});
const VALUE = Object.freeze({
  title: '저나트륨혈증',
  nodes: [{ id: 'n1', t: '저나트륨혈증', src: 'hyponatremia', p: '1' }, { id: 'n2', t: 'SIADH', p: '1.1' }, { id: 'n3', t: '혼돈', p: '1.2' }, { id: 'n4', t: '혈청 삼투압', p: '2' }],
  edges: [{ a: 'n2', b: 'n1', r: 'cause', p: '1.1' }, { a: 'n1', b: 'n3', r: 'sign', p: '1.2' }, { a: 'n1', b: 'n4', r: 'test', p: '2' }]
});
const withDiagram = (rec, over) => Object.assign({}, rec, { diagram: Object.assign(UI.diagramField(VALUE, { basis: rec.cacheKey, target: rec.target, promptVersion: 1, model: 'm' }, T0), over || {}) });

/* ══ G1 순수 ═════════════════════════════════════════════ */

test('G1 순수 — 관계 이름(대상 언어) · graphOf · isStale · diagramField · 12px 문턱 · relationLines · 파일 이름', () => {
  // 관계 이름은 UI 언어가 아니라 대상 언어 사전 — 없는 언어는 en
  assert.equal(UI.relLabelsFor('ko')('cause'), '원인');
  assert.equal(UI.relLabelsFor('ar')('cause'), BUNDLES.ar['diagram.rel.cause']);
  assert.equal(UI.relLabelsFor('ar-EG')('sign'), BUNDLES.ar['diagram.rel.sign']);
  assert.equal(UI.relLabelsFor('es')('test'), BUNDLES.en['diagram.rel.test'], '사전 없는 대상 언어 → en');
  for (const lang of LANGS) for (const r of DIAGRAM.RELS) assert.ok(BUNDLES[lang]['diagram.rel.' + r], lang + ' ' + r);
  assert.ok(!DIAGRAM.RELS.includes('treat'));
  // graphOf — 파일(9c)에서 온 값도 다시 거른다
  assert.equal(UI.graphOf(OUTLINE), null);
  const g = UI.graphOf(withDiagram(OUTLINE));
  assert.deepEqual(g.nodes.map((n) => n.id), ['n1', 'n2', 'n3', 'n4']);
  assert.equal(g.edges.length, 3);
  const dirty = withDiagram(OUTLINE, {
    nodes: VALUE.nodes.concat([{ id: 'n1', t: '중복' }, { id: 7, t: '수 id' }, { id: 'e', t: '   ' }, null]),
    edges: VALUE.edges.concat([{ a: 'n1', b: 'n2', r: 'treat' }, { a: 'n1', b: 'zz', r: 'assoc' }, { a: 'n1', b: 'n1', r: 'assoc' }, { a: 'n1', b: '7', r: 'part' }])
  });
  const g2 = UI.graphOf(dirty);
  assert.deepEqual(g2.nodes.map((n) => n.id), ['n1', 'n2', 'n3', 'n4', '7']);
  assert.deepEqual(g2.edges.map((e) => e.r), ['cause', 'sign', 'test', 'part'], '★ treat·없는 노드·자기 고리 버림');
  // stale — basis ≠ cacheKey
  assert.equal(UI.isStale(withDiagram(OUTLINE)), false);
  assert.equal(UI.isStale(Object.assign(withDiagram(OUTLINE), { cacheKey: 'ck-2' })), true);
  assert.equal(UI.isStale(OUTLINE), false, '그림이 없으면 아님');
  // diagramField — 배치(좌표) 없음 · 필드
  const f = UI.diagramField(VALUE, { basis: 'ck-1', target: 'ko', promptVersion: 1, model: 'gm', provider: 'gemini' }, T0);
  assert.deepEqual(Object.keys(f).sort(), ['basis', 'createdAt', 'edges', 'model', 'nodes', 'promptVersion', 'target', 'title']);
  assert.ok(!JSON.stringify(f).includes('"x"') && !JSON.stringify(f).includes('pts'), '배치는 저장하지 않는다');
  // 12px 문턱 — 가장 작은 글자(12px)가 줄어들면 [크게]
  assert.equal(Math.min(UI.DG_FONT.label, UI.DG_FONT.src, UI.DG_FONT.edge), UI.MIN_FONT_PX);
  assert.equal(UI.fitScale(200, 320), 1, '키우지 않는다');
  assert.equal(UI.fitScale(640, 320), 0.5);
  assert.equal(UI.zoomNeeded(320, 320), false);
  assert.equal(UI.zoomNeeded(321, 320), true, '★ 12px 아래 → 크게');
  assert.equal(UI.zoomNeeded(150, 320), false);
  // relationLines — 엣지 수 · 경로 · RTL 은 ←
  const lines = UI.relationLines(g, UI.relLabelsFor('ko'), 'ltr');
  assert.equal(lines.length, g.edges.length);
  assert.deepEqual(lines[0], { p: '1.1', text: 'SIADH → 원인 → 저나트륨혈증' });
  assert.ok(UI.relationLines(g, UI.relLabelsFor('ar'), 'rtl')[0].text.includes(' ← '));
  assert.equal(UI.exportName(T0), 'medreader-diagram-20261118.svg');
});

/* ══ G2 viewBox ════════════════════════════════════════════ */

test('G2 ★ viewBox — 노드·선·엣지 라벨 상자가 모두 안(16-1R 낮음-3) · 표본 그래프 × 접힘 × RTL · 좁은 그림 오른쪽 끝 라벨', () => {
  const labelOf = UI.relLabelsFor('ar');
  const inside = (vb, x0, y0, x1, y1) => x0 >= vb.x - 1e-6 && y0 >= vb.y - 1e-6 && x1 <= vb.x + vb.w + 1e-6 && y1 <= vb.y + vb.h + 1e-6;
  let n = 0;
  for (const { name, graph } of GRAPHS) {
    if (CYCLIC.has(name)) continue;
    for (const maxW of [Infinity, 320, 200]) {
      for (const rtl of [false, true]) {
        const lay = D.layoutDiagram(graph, { measure: measure, maxW: maxW, rtl: rtl, labelOf: labelOf });
        const boxes = UI.edgeBoxes(lay, measure, labelOf);
        const vb = UI.viewBoxOf(lay, boxes, 2);
        assert.ok(vb.x <= 0 && vb.y <= 0 && vb.x + vb.w >= lay.w && vb.y + vb.h >= lay.h, name + ' 그림 전체');
        for (const nd of lay.nodes) assert.ok(inside(vb, nd.x, nd.y, nd.x + nd.w, nd.y + nd.h), name + ' 노드');
        for (const e of lay.edges) for (const p of e.pts) assert.ok(inside(vb, p[0], p[1], p[0], p[1]), name + ' 선');
        for (const b of boxes) assert.ok(inside(vb, b.x, b.y, b.x + b.w, b.y + b.h), name + ' 라벨 상자 ' + maxW + (rtl ? ' rtl' : ''));
        n++;
      }
    }
  }
  assert.ok(n >= 40, String(n));
  // 16-1R 이 잰 꼴 — 좁은 그림(W 86)의 되돌림 엣지 라벨이 오른쪽 끝을 넘음 → viewBox 가 넓어진다
  const lay = { w: 86, h: 120, nodes: [{ id: 'a', x: 8, y: 8, w: 70, h: 28 }, { id: 'b', x: 8, y: 80, w: 70, h: 28 }],
    edges: [{ a: 'a', b: 'b', r: 'contrast', pts: [[78, 36], [78, 80]], lx: 82, ly: 58, rev: true }] };
  const boxes = UI.edgeBoxes(lay, measure, labelOf);
  assert.ok(boxes[0].x + boxes[0].w > lay.w, '전제: 라벨이 그림 밖으로 나간다');
  const vb = UI.viewBoxOf(lay, boxes, 2);
  assert.ok(vb.x + vb.w >= boxes[0].x + boxes[0].w, '★ 라벨이 viewBox 안');
});

/* ══ G3 renderDiagram ══════════════════════════════════════ */

function flat(node, out) {
  const o = out || [];
  for (const c of node.children || []) { if (c.nodeType === 1) { o.push(c); flat(c, o); } }
  return o;
}

test('G3 ★ renderDiagram — createElementNS 만 · 층 순서 · 이름 · 화살촉 · rev · 방향 · 원어 줄 ltr · 위험 글자는 글자 · 작은 그림 · RTL 거울', () => {
  const doc = fakeDoc();
  const evil = { nodes: [{ id: 'x', t: '<img src=x onerror=alert(1)>', p: '1' }, { id: 'y', t: '<script>alert(2)</script>', src: 'Hyponatremia', p: '1.1' },
    { id: 'z', t: '셋째 노드', p: '2' }], edges: [{ a: 'x', b: 'y', r: 'cause' }, { a: 'x', b: 'z', r: 'sign' }] };
  const lay = D.layoutDiagram(evil, { measure: measure, maxW: 320, labelOf: UI.relLabelsFor('ko') });
  const r = UI.renderDiagram(lay, { doc: doc, dir: 'ltr', lang: 'ko', srcLang: 'en', labelOf: UI.relLabelsFor('ko'), measure: measure, title: '제목 <b>x</b>', desc: '설명' });
  const svg = r.svg;
  assert.equal(svg.namespaceURI, UI.SVG_NS);
  assert.ok(flat(svg).every((e) => e.namespaceURI === UI.SVG_NS), '★ 모두 createElementNS');
  assert.equal(svg.getAttribute('role'), 'img');
  const [tid, did] = svg.getAttribute('aria-labelledby').split(' ');
  const title = flat(svg).find((e) => e.localName === 'title');
  const desc = flat(svg).find((e) => e.localName === 'desc');
  assert.equal(title.getAttribute('id'), tid);
  assert.equal(desc.getAttribute('id'), did);
  assert.equal(title.textContent, '제목 <b>x</b>', '제목도 글자 그대로');
  assert.match(svg.getAttribute('viewBox'), /^-?\d+ -?\d+ \d+ \d+$/);
  // 층 순서 — 선(g.dg-edges) → 노드 → 라벨
  const groups = svg.children.filter((c) => c.localName === 'g').map((c) => c.getAttribute('class'));
  assert.deepEqual(groups, ['dg-edges', 'dg-nodes', 'dg-labels'], '★ 선이 노드 아래(16-1R 낮음-2)');
  const marker = flat(svg).find((e) => e.localName === 'marker');
  assert.equal(marker.getAttribute('orient'), 'auto-start-reverse');
  const paths = svg.querySelectorAll('.dg-edge');
  assert.equal(paths.length, 2);
  for (const p of paths) assert.equal(p.getAttribute('marker-end'), 'url(#' + marker.getAttribute('id') + ')');
  // 위험 글자는 글자 그대로(tspan textContent)
  const texts = svg.querySelectorAll('.dg-node-t');
  assert.equal(texts.length, 3);
  assert.ok(texts.every((t) => t.getAttribute('direction') === 'ltr' && t.getAttribute('text-anchor') === 'middle'));
  const all = texts.map((t) => t.textContent).join('|');
  assert.ok(all.includes('<img') || all.includes('onerror'), '글자로 들어감(태그가 아니라)');
  assert.ok(flat(svg).every((e) => !['img', 'script', 'foreignObject'].includes(e.localName)), '★ 요소가 생기지 않는다');
  // 원어 줄 — 따로 된 <text direction=ltr lang=src>
  const src = svg.querySelectorAll('.dg-src');
  assert.equal(src.length, 1);
  assert.equal(src[0].getAttribute('direction'), 'ltr');
  assert.equal(src[0].getAttribute('lang'), 'en');
  assert.equal(src[0].textContent, 'Hyponatremia');
  assert.equal(svg.querySelectorAll('.dg-label').length, 2);
  assert.equal(svg.querySelectorAll('.dg-label-bg').length, 2);
  assert.deepEqual(svg.querySelectorAll('.dg-label').map((x) => x.textContent), ['원인', '소견'], '관계 이름 = 대상 언어');
  // rev 엣지 — 화살촉은 marker-start(원래 방향을 가리킨다)
  const revLay = { w: 100, h: 120, nodes: lay.nodes.slice(0, 2), edges: [{ a: 'x', b: 'y', r: 'leads', pts: [[50, 30], [50, 90]], lx: 50, ly: 60, rev: true }] };
  const rr = UI.renderDiagram(revLay, { doc: doc, measure: measure, title: 't', desc: 'd' }).svg;
  const rp = rr.querySelectorAll('.dg-edge')[0];
  assert.ok(rp.getAttribute('marker-start') && !rp.getAttribute('marker-end'), '★ rev → marker-start');
  // 작은 그림 — 이름 없음(aria-hidden), title·desc 없음
  const th = UI.renderDiagram(lay, { doc: doc, measure: measure, thumb: true }).svg;
  assert.equal(th.getAttribute('aria-hidden'), 'true');
  assert.equal(th.getAttribute('role'), null);
  assert.ok(!flat(th).some((e) => e.localName === 'title'));
  // 아랍어 — direction rtl · 글꼴 클래스 · RTL 거울(같은 그래프 ltr 과 x 대칭)
  const arLay = D.layoutDiagram(evil, { measure: measure, maxW: 320, rtl: true, labelOf: UI.relLabelsFor('ar') });
  const ltrLay = D.layoutDiagram(evil, { measure: measure, maxW: 320, rtl: false, labelOf: UI.relLabelsFor('ar') });
  for (let i = 0; i < arLay.nodes.length; i++) assert.equal(arLay.nodes[i].x, ltrLay.w - ltrLay.nodes[i].x - ltrLay.nodes[i].w, '거울');
  const ar = UI.renderDiagram(arLay, { doc: doc, dir: 'rtl', lang: 'ar', srcLang: 'en', labelOf: UI.relLabelsFor('ar'), measure: measure, title: 't', desc: 'd' }).svg;
  assert.ok(ar.querySelectorAll('.dg-node-t').every((t) => t.getAttribute('direction') === 'rtl' && /dg-f-ar/.test(t.getAttribute('class'))));
  assert.ok(ar.querySelectorAll('.dg-src').every((t) => t.getAttribute('direction') === 'ltr' && !/dg-f-ar/.test(t.getAttribute('class'))), '★ 원어 줄은 ltr');
  assert.equal(ar.getAttribute('lang'), 'ar');
  // 같은 입력 → 같은 그림(결정적)
  const a1 = JSON.stringify(UI.renderDiagram(lay, { doc: fakeDoc(), measure: measure, title: 't', desc: 'd' }).svg, (k, v) => (k === 'parentNode' || k === 'ownerDocument' ? undefined : v));
  const a2 = JSON.stringify(UI.renderDiagram(lay, { doc: fakeDoc(), measure: measure, title: 't', desc: 'd' }).svg, (k, v) => (k === 'parentNode' || k === 'ownerDocument' ? undefined : v));
  assert.equal(a1.replace(/dg\d+/g, 'dgN'), a2.replace(/dg\d+/g, 'dgN'));
});

/* ══ G4 글로 보기 ══════════════════════════════════════════ */

test('G4 ★ 글로 보기 — details open · 트리 · 관계 ol 항목 수 = 엣지 수 · 경로 꼬리표 · RTL', () => {
  const doc = fakeDoc();
  const rec = withDiagram(OUTLINE);
  const g = UI.graphOf(rec);
  const det = UI.renderAlt(rec, g, { doc: doc });
  assert.equal(det.localName, 'details');
  assert.equal(det.open, true, '★ 기본 펼침(16-D7)');
  assert.equal(det.children[0].localName, 'summary');
  assert.equal(det.querySelectorAll('.sum-tree').length, 1, '11c 트리 재사용');
  const ol = det.querySelectorAll('ol')[0];
  assert.equal(ol.children.length, g.edges.length, '★ 항목 수 = 엣지 수');
  assert.deepEqual(ol.children.map((li) => li.children[0].textContent), ['1.1', '1.2', '2'], '줄마다 경로 꼬리표');
  assert.equal(ol.children[1].children[1].textContent, '저나트륨혈증 → 소견 → 혼돈');
  const arRec = Object.assign({}, rec, { target: 'ar' });
  const ar = UI.renderAlt(arRec, g, { doc: doc });
  const ol2 = ar.querySelectorAll('ol')[0];
  assert.equal(ol2.getAttribute('dir'), 'rtl');
  assert.ok(ol2.textContent.includes(' ← '));
});

/* ══ G5 흐름 ═════════════════════════════════════════════ */

function fakeDeps(replies) {
  const calls = [];
  const saves = [];
  const q = replies.slice();
  return {
    calls: calls, saves: saves,
    deps: {
      diagram: async (rec, o) => { calls.push({ rec: rec, o: o }); const r = q.shift(); return typeof r === 'function' ? r() : r; },
      save: async (id, field) => { saves.push({ id: id, field: field }); return { rec: Object.assign({}, OUTLINE, { id: id, diagram: field, updatedAt: T0 + 1 }) }; },
      gate: () => ({ ok: true }), now: () => T0
    }
  };
}
const READY = { status: 'ok', calls: 1, results: [{ state: 'ready', value: VALUE, cached: false }], basis: 'ck-1', target: 'ko', promptVersion: 1, model: 'gm', depth: 3 };

test('G5 ★ 흐름 — 그림 있음 0호출 · 그리기 1 → 저장 · 다시 0 · 다시 그리기는 묻고 force 1 · target = 개요 것 · 실패·막힘 · 늦은 결과', async () => {
  // 그림이 이미 있으면 열기·[그리기] 모두 0
  const a = fakeDeps([]);
  const f1 = UI.createDiagramFlow(a.deps);
  assert.equal(f1.open(withDiagram(OUTLINE), { src: 'en' }).state, 'ready');
  await f1.draw();
  assert.equal(a.calls.length, 0, '★ 열기 0호출');
  // 그림 없음 → [그리기] 1호출 → 저장 → ready
  const b = fakeDeps([READY]);
  const f2 = UI.createDiagramFlow(b.deps);
  f2.open(Object.assign({}, OUTLINE, { target: 'ko' }), { src: 'en' });
  const v = await f2.draw();
  assert.equal(b.calls.length, 1, '★ 1호출');
  assert.equal(v.state, 'ready');
  assert.equal(v.calls, 1);
  assert.equal(v.saved, true);
  assert.deepEqual(b.calls[0].o, { target: 'ko', src: 'en', docId: 'D16', domain: 'medical' }, '★ 개요 레코드의 target 만(16-1R 낮음-5) · force 없음');
  assert.equal(b.saves.length, 1);
  assert.equal(b.saves[0].id, 'out:1');
  assert.deepEqual([b.saves[0].field.basis, b.saves[0].field.target, b.saves[0].field.createdAt], ['ck-1', 'ko', T0]);
  // 닫고 다시 열기 → 저장한 레코드(그림 있음) → 0
  f2.close();
  f2.open(v.rec, { src: 'en' });
  await f2.draw();
  assert.equal(b.calls.length, 1, '★ 닫고 다시 → 0건');
  // [다시 그리기] — 묻기만으로는 0 · 취소 0 · 확인하면 force 1
  const c = fakeDeps([READY]);
  const f3 = UI.createDiagramFlow(c.deps);
  f3.open(withDiagram(OUTLINE), {});
  assert.equal(f3.askRedraw().asking, true);
  assert.equal(c.calls.length, 0, '묻기만으로는 0');
  assert.equal(f3.cancelAsk().asking, false);
  await f3.redraw();
  assert.equal(c.calls.length, 0, '물음 없이(취소 뒤) redraw 는 0');
  f3.askRedraw();
  const v3 = await f3.redraw();
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].o.force, true, '★ force');
  assert.equal(v3.state, 'ready');
  // few-relations → 다시 시도 가능 · 캐시·저장 0
  const { FAIL } = await import('../js/ai/pipeline.js');
  assert.equal(UI.FEW_CODE, FAIL.FEW_RELATIONS, '화면이 보는 코드 = 파이프라인 실패 코드');
  const d = fakeDeps([{ status: 'ok', calls: 1, results: [{ state: 'failed', code: FAIL.FEW_RELATIONS }] }]);
  const f4 = UI.createDiagramFlow(d.deps);
  f4.open(OUTLINE, {});
  const v4 = await f4.draw();
  assert.deepEqual([v4.state, v4.note.key, v4.note.retry, d.saves.length], ['failed', 'diagram.few', true, 0]);
  // too-big → 0호출 결과 · 다시 시도 없음
  const e = fakeDeps([{ status: 'too-big', calls: 0, results: [{ state: 'skipped', code: 'too-big' }] }]);
  const f5 = UI.createDiagramFlow(e.deps);
  f5.open(OUTLINE, {});
  const v5 = await f5.draw();
  assert.deepEqual([v5.state, v5.note.key, v5.note.retry, v5.calls], ['too-big', 'diagram.tooBig', false, 0]);
  // 동의 없음 → 파이프라인 0
  const g = fakeDeps([READY]);
  g.deps.gate = () => ({ ok: false, reason: 'consent' });
  const f6 = UI.createDiagramFlow(g.deps);
  f6.open(OUTLINE, {});
  const v6 = await f6.draw();
  assert.deepEqual([v6.state, g.calls.length], ['blocked', 0]);
  assert.equal(v6.banner, 'consent');
  // 늦은 결과 — 닫은 뒤 도착: 저장은 한다(사용자가 부른 값) · 화면 상태는 그대로
  let release;
  const h = fakeDeps([() => new Promise((res) => { release = () => res(READY); })]);
  const f7 = UI.createDiagramFlow(h.deps);
  f7.open(OUTLINE, {});
  const p = f7.draw();
  assert.equal(f7.view().state, 'pending');
  f7.close();
  f7.open(Object.assign({}, OUTLINE, { id: 'out:2' }), {});
  release();
  await p;
  assert.equal(h.saves.length, 1, '받은 그림은 저장');
  assert.equal(h.saves[0].id, 'out:1');
  assert.equal(f7.view().state, 'idle', '다른 개요 화면은 그대로');
  assert.equal(realFetchCalls, 0);
});

/* ══ G6 저장 · 9c ═══════════════════════════════════════ */

async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); }
async function all(name) { const out = []; await db.iterate(name, {}, (v) => { out.push(v); }); return out; }

test('G6 ★ 저장 — saveDiagram · 개요를 다시 만들어도 diagram 남음 → stale · 요약 레코드엔 붙지 않음 · 9c 병합·왕복 멱등', async () => {
  await reset();
  const clock = { t: T0 };
  const store = S.createSummaryStore({ now: () => clock.t });
  const base = { docId: 'D16', range: { from: 40, to: 79, label: 'Ch' }, target: 'ko', value: { title: '개요', points: OUTLINE.points }, cacheKey: 'ck-1' };
  const o1 = (await store.saveOutline(base)).rec;
  clock.t = T0 + 10;
  const field = UI.diagramField(VALUE, { basis: 'ck-1', target: 'ko', promptVersion: 1, model: 'gm' }, T0 + 5);
  const r1 = (await store.saveDiagram(o1.id, field)).rec;
  assert.deepEqual(r1.diagram, field);
  assert.equal(r1.updatedAt, T0 + 10, '★ updatedAt 새로(9c 가 그림 붙은 쪽을 고른다)');
  assert.equal(r1.createdAt, o1.createdAt);
  assert.equal(UI.isStale(r1), false);
  assert.equal(db.DB_VERSION, 3, 'DB 3 그대로');
  // 개요를 다시 만들기(같은 범위·대상) → 대체 저장 · diagram 은 남고 basis ≠ 새 cacheKey → stale
  clock.t = T0 + 20;
  const o2 = (await store.saveOutline(Object.assign({}, base, { cacheKey: 'ck-2', value: { title: '개요 2', points: OUTLINE.points } }))).rec;
  assert.equal(o2.id, o1.id);
  assert.deepEqual(o2.diagram, field, '★ 그림은 남는다');
  assert.equal(UI.isStale(o2), true, '★ "개요가 바뀌었습니다"');
  // 요약 레코드·없는 id → null
  assert.equal(await store.saveDiagram('nope', field), null);
  const s1 = (await store.save({ docId: 'D16', pageNo: 40, para: { paraId: 'p', lineIds: ['l'], text: 'Some synthetic paragraph text here.' }, target: 'ko', value: { gist: '요지' } })).rec;
  assert.equal(await store.saveDiagram(s1.id, field), null);
  assert.equal((await db.get('annotations', s1.id)).diagram, undefined);
  // 9c — 순수 병합: 그림이 붙은(새) 쪽이 이김 · 같은 것 두 번 = keep
  const mine = Object.assign({}, o1);
  assert.equal(B.mergeRecord('annotations', mine, r1).op, 'put');
  assert.equal(B.mergeRecord('annotations', r1, r1).op, 'keep', '★ 멱등');
  assert.equal(IM.cleanRecord('annotations', r1), r1, '꼴 검사 통과(diagram 필드 그대로)');
  // 왕복 — 내보내기 → 빈 기기에 가져오기 → 다시 가져오기
  const out = await exportBackup({ now: T0 + 30 });
  await reset();
  const res = await IM.importBackup(new File([out.blob], out.name), { now: T0 + 40 });
  assert.ok(!res.error, JSON.stringify(res.error || null));
  const got = await all('annotations');
  const back = got.find((x) => x.id === o1.id);
  assert.deepEqual(back.diagram, field, '★ diagram 필드 왕복');
  const res2 = await IM.importBackup(new File([out.blob], out.name), { now: T0 + 50 });
  assert.ok(!res2.error);
  assert.deepEqual(await all('annotations'), got, '★ 두 번 = 한 번');
});

/* ══ G8 그림 저장 글(16-2R 낮음-7) ═══════════════════════ */

/** 복제·직렬화까지 되는 작은 가짜 DOM(시험 전용). */
function richDoc() {
  const doc = {};
  function mk(tag, ns) {
    const n = {
      localName: String(tag), tagName: String(tag), namespaceURI: ns || null, nodeType: 1, attrs: new Map(), children: [], parentNode: null, ownerDocument: doc, _t: '',
      appendChild(c) { c.parentNode = n; n.children.push(c); return c; },
      insertBefore(c, ref) { c.parentNode = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
      setAttribute(k, v) { n.attrs.set(k, String(v)); }, getAttribute(k) { return n.attrs.has(k) ? n.attrs.get(k) : null; }, removeAttribute(k) { n.attrs.delete(k); },
      get firstChild() { return n.children[0] || null; },
      get nextSibling() { const p = n.parentNode; if (!p) return null; return p.children[p.children.indexOf(n) + 1] || null; },
      set textContent(v) { n.children = []; n._t = String(v); }, get textContent() { return n._t + n.children.map((c) => c.textContent).join(''); },
      set innerHTML(v) { throw new Error('innerHTML 금지'); },
      cloneNode(deep) { const c = mk(n.localName, n.namespaceURI); for (const [k, v] of n.attrs) c.attrs.set(k, v); c._t = n._t; if (deep) for (const ch of n.children) c.appendChild(ch.cloneNode(true)); return c; },
      querySelectorAll(sel) { const out = []; (function w(x) { for (const c of x.children) { if (sel === '*' || c.localName === sel) out.push(c); w(c); } })(n); return out; },
      querySelector(sel) { return n.querySelectorAll(sel)[0] || null; }
    };
    return n;
  }
  doc.createElementNS = (ns, t) => mk(t, ns);
  doc.createElement = (t) => mk(t, null);
  return doc;
}
const esc = (s, q) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(q ? /"/g : /$^/, '&quot;');
function serialize(n) {
  const at = Array.from(n.attrs).map(([k, v]) => ' ' + k + '="' + esc(v, true) + '"').join('');
  return '<' + n.localName + at + '>' + esc(n._t) + n.children.map(serialize).join('') + '</' + n.localName + '>';
}

test('G8 ★ 그림 저장 글 — 계산된 칠·선·글꼴을 박음 · class 0 · var( 0 · 배경 상자 · 크기 = viewBox · 위험 글자 탈출', () => {
  const doc = richDoc();
  const g = { nodes: [{ id: 'a', t: '<img src=x onerror=alert(1)>', src: 'Term A', p: '1' }, { id: 'b', t: '둘째', p: '1.1' }, { id: 'c', t: '셋째', p: '2' }],
    edges: [{ a: 'a', b: 'b', r: 'cause' }, { a: 'a', b: 'c', r: 'sign' }] };
  const lay = D.layoutDiagram(g, { measure: measure, maxW: 320, labelOf: UI.relLabelsFor('ko') });
  const { svg, vb } = UI.renderDiagram(lay, { doc: doc, dir: 'ltr', lang: 'ko', srcLang: 'en', labelOf: UI.relLabelsFor('ko'), measure: measure, title: '제목', desc: '설명' });
  // 화면 CSS 를 흉내 낸 계산 값(클래스마다) — 글꼴은 일부러 `var(` 를 섞어 걸러지는지 본다
  const COL = {
    'dg-node': { fill: 'rgb(242, 239, 234)', stroke: 'rgb(90, 85, 80)', 'stroke-width': '1.25px' },
    'dg-node-t': { fill: 'rgb(26, 26, 26)', 'font-family': 'system-ui', 'font-size': '13px' },
    'dg-src': { fill: 'rgb(90, 85, 80)', 'font-family': 'system-ui', 'font-size': '12px' },
    'dg-edge': { fill: 'none', stroke: 'rgb(90, 85, 80)', 'stroke-width': '1.5px' },
    'dg-arrow': { fill: 'rgb(90, 85, 80)', stroke: 'none' },
    'dg-label-bg': { fill: 'rgb(255, 255, 255)', stroke: 'rgb(217, 211, 203)' },
    'dg-label': { fill: 'rgb(26, 26, 26)', 'font-family': 'var(--font-ui)', 'font-size': '12px' }
  };
  const saved = { gcs: globalThis.getComputedStyle, xs: globalThis.XMLSerializer };
  globalThis.getComputedStyle = (el) => {
    const cls = String(el.getAttribute('class') || '').split(/\s+/);
    const m = Object.assign({ fill: 'rgb(0, 0, 0)' }, ...cls.map((c) => COL[c] || {}));
    return { getPropertyValue: (p) => m[p] || '' };
  };
  globalThis.XMLSerializer = class { serializeToString(n) { return serialize(n); } };
  let text;
  let text2;
  try {
    text = UI.svgFileText(svg, 'rgb(255, 255, 255)');
    text2 = UI.svgFileText(svg, 'var(--c-surface)');
  } finally {
    globalThis.getComputedStyle = saved.gcs;
    globalThis.XMLSerializer = saved.xs;
  }
  assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg'));
  assert.equal((text.match(/var\(/g) || []).length, 0, '★ var( 0');
  assert.equal((text.match(/ class="/g) || []).length, 0, 'class 지움');
  assert.equal((text.match(/<text[^>]*fill="rgb\(26, 26, 26\)"/g) || []).length, 3 + 2, '★ 노드 글 3 · 관계 라벨 2 — 계산된 글자색이 박힘');
  assert.equal((text.match(/<path[^>]*stroke="rgb\(90, 85, 80\)"[^>]*>/g) || []).length, 2, '★ 선 2 — 계산된 선 색');
  assert.equal((text.match(/<rect[^>]*fill="rgb\(242, 239, 234\)"[^>]*stroke="rgb\(90, 85, 80\)"/g) || []).length, 3, '노드 상자 칠·테두리');
  assert.ok(/<text[^>]*fill="rgb\(90, 85, 80\)"[^>]*font-size="12px"[^>]*>Term A/.test(text), '원어 줄');
  assert.ok(/<path[^>]*fill="rgb\(90, 85, 80\)"[^>]*stroke="none"/.test(text), '화살촉 칠');
  assert.ok(!/font-family="var/.test(text) && /<text[^>]*font-family="system-ui"/.test(text), 'var( 값은 박지 않는다');
  // 배경 상자 — defs 바로 뒤, viewBox 전체 · 크기 = viewBox
  const bg = '<rect x="' + vb.x + '" y="' + vb.y + '" width="' + vb.w + '" height="' + vb.h + '" fill="rgb(255, 255, 255)">';
  assert.ok(text.indexOf('</defs>' + bg) > 0, '★ 배경 상자');
  assert.ok(new RegExp('<svg [^>]*width="' + vb.w + '" height="' + vb.h + '"').test(text));
  assert.ok(text.includes('&lt;img') && text.includes('&gt;') && !/<img/.test(text), '위험 글자는 탈출(라벨은 줄바꿈되어 tspan 여럿)');
  assert.ok(text2.includes('fill="#ffffff">') && !text2.includes('var('), '배경이 var( 면 흰색');
  // 화면 SVG 는 그대로(복제에만 박는다)
  assert.ok(svg.querySelectorAll('*').some((e) => e.getAttribute('class')), '원본 class 그대로');
});

/* ══ G7 정적 ═════════════════════════════════════════════ */

test('G7 정적 — innerHTML 0 · 호출 한 곳 · 시트 마크업 · 48px · i18n 4언어 · 검토 표시 · 사용량 종류', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const ui = read('../js/ui/diagram.js');
  const code = strip(ui);
  for (const f of ['../js/ui/diagram.js', '../js/ui/summaries.js', '../js/ui/review.js']) {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|DOMParser/.test(strip(read(f))), f + ' — HTML 쓰기 0');
  }
  assert.ok(/createElementNS\(SVG_NS/.test(code));
  assert.equal((code.match(/pipeline\.diagram\(/g) || []).length, 1, '★ 파이프라인 요청 자리 한 곳(시트의 흐름 의존)');
  assert.equal((code.match(/\bd\.diagram\(/g) || []).length, 1, '흐름 안에서도 run() 한 곳');
  assert.equal((code.match(/\.diagram\(/g) || []).length, 2);
  assert.ok(!/from '\.\.\/ai\/pipeline\.js'/.test(ui), '파이프라인을 import 하지 않는다(sumServices 주입)');
  assert.ok(/target: str\(rec && rec\.target\)/.test(code), '개요 레코드의 target');
  assert.ok(/XMLSerializer/.test(code) && /getComputedStyle/.test(code), 'SVG 내보내기 — 계산된 색 + 직렬화');
  // 그 화면들은 조각 하나만 쓴다
  assert.equal((strip(read('../js/ui/summaries.js')).match(/diagramControl\(/g) || []).length, 1);
  assert.equal((strip(read('../js/ui/review.js')).match(/diagramControl\(/g) || []).length, 1);
  // 시트 마크업
  const html = read('../index.html');
  assert.match(html, /<div class="dg-sheet" id="dgSheet" role="dialog" aria-modal="false" aria-labelledby="dgHead" hidden>/);
  for (const id of ['dgHead', 'dgStatus', 'dgStale', 'dgAsk', 'dgFig', 'dgZoom', 'dgRedraw', 'dgExport', 'dgRetry', 'dgAlt']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /data-i18n="diagram\.disclaimer"/);
  assert.match(html, /id="dgZoom" data-dg="zoom" aria-pressed="false"/);
  // CSS — 48px · 그릇 안 스크롤 · 토큰
  const css = read('../css/screens.css');
  assert.ok(/\.dg-row > button \{[^}]*min-block-size: var\(--tap\)/.test(css), '48px');
  assert.ok(/\.dg-fig \{[^}]*overflow: auto/.test(css), '그릇 안 스크롤');
  assert.ok(/\.dg-sheet \{[^}]*overflow-x: hidden/.test(css));
  assert.ok(/\.dg-svg \.dg-edge \{[^}]*stroke: var\(--c-text-dim\)/.test(css), '선 = 토큰');
  assert.ok(!/(margin|padding)-(left|right)|[^-]left:|[^-]right:/.test(css.slice(css.indexOf('[16-2'))), '논리 속성만');
  // i18n — 4언어 같은 키 · 관계 8 · 사용량 종류 · ar/fr 검토 표시
  const keys = Object.keys(BUNDLES.ko).filter((k) => k.startsWith('diagram.'));
  assert.ok(keys.length >= 27, String(keys.length));
  for (const lang of LANGS) {
    for (const k of keys.concat(['usage.kind.diagram'])) assert.ok(typeof BUNDLES[lang][k] === 'string' && BUNDLES[lang][k], lang + ' ' + k);
  }
  for (const f of ['../js/i18n/ar.js', '../js/i18n/fr.js']) assert.ok(/16-2 — spec 17-14 4[^\n]*\[검토 — Nour·운영자\]/.test(read(f)), f);
  assert.ok(/\{n\}/.test(BUNDLES.ar['diagram.open']) && /\{m\}/.test(BUNDLES.ar['diagram.open']));
  // 사용량 화면 — 설명과 같은 꼴(늘 보이는 종류)
  assert.ok(SHOW_KINDS.includes(AI.DIAGRAM_KIND));
});
