/* ============================================================
   tests/scan-8l.test.mjs — 8l 스캔본·글자 깨짐 감지와 안내 (spec 17-5-1 · 19-1-3 §3)

   · 표본 고르기(`probePages`) 경계 · `garbleCount` 경계 · 판정 표(`scanVerdict`) — **실물 수치 픽스처**
     (2026-10-20 Build 실측: 앱 `scanPdf` + pdf.js 5.6.205 — 숫자만, 원서 문장 없음)
   · 저장: `db.patch` 로 `scan` 만(P1 경합 꼴) · 한 번만 돈다(`scan.v`) · 실패는 조용히·다음에 다시
   · `scanPdf`: 이미지 확인은 75% 이상 글자 0 일 때만, 최대 2쪽
   · 안내: 배지·띠(문서당 한 번)·검색 줄 · ▶ 갈래(실제 `createSpeaker`) · i18n 네 언어가 spec 문안 그대로
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

const db = await import('../js/db.js');
const { SCAN } = await import('../js/config.js');
const S = await import('../js/text/scan.js');
const { scanPdf, runScan, writeScan, markScanNoticed } = await import('../js/ui/library.js');
const { scanPlayBlocked } = await import('../js/ui/controls.js');
const { createSpeaker } = await import('../js/tts/speaker.js');
const { BUNDLES } = await import('../js/i18n/index.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ══ 1. 표본 고르기 ═══════════════════════════════════════ */

function checkProbe(n) {
  const p = S.probePages(n);
  for (let i = 1; i < p.length; i++) assert.ok(p[i] > p[i - 1], n + ': 오름차순·중복 없음');
  for (const x of p) assert.ok(Number.isInteger(x) && x >= 1 && x <= n, n + ': 1..N 안');
  assert.ok(p.length <= SCAN.PROBE, n + ': 많아야 PROBE 쪽');
  return p;
}

test('SC1 probePages 경계 — N=1·5·12 는 전부, 13·307·5051 은 10–90% 구간 12등분', () => {
  assert.deepEqual(S.probePages(0), []);
  assert.deepEqual(checkProbe(1), [1]);
  assert.deepEqual(checkProbe(5), [1, 2, 3, 4, 5]);
  assert.deepEqual(checkProbe(12), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const p13 = checkProbe(13);
  assert.ok(p13.length >= 8 && p13[0] >= 2 && p13[p13.length - 1] <= 12, '13쪽: 첫·끝 쪽을 피한다');
  // 실물 — Advanced Grammar 원본 307쪽(Build 실측과 같은 쪽: 앞붙이 1–30쪽을 피한다)
  assert.deepEqual(checkProbe(307), [41, 61, 82, 102, 123, 143, 164, 184, 205, 225, 246, 266]);
  assert.deepEqual(checkProbe(341), [45, 68, 91, 114, 136, 159, 182, 205, 227, 250, 273, 296]);
  const p5051 = checkProbe(5051);
  assert.equal(p5051.length, 12);
  assert.ok(p5051[0] > 0.10 * 5051 && p5051[11] < 0.90 * 5051, 'CMDT 2021 — 앞붙이(2–27쪽)에 표본이 없다');
});

/* ══ 2. garbleCount ═══════════════════════════════════════ */

test('SC2 ★ garbleCount — FFFD·PUA 두 구간·C0·DEL·C1 각각 bad 1, 공백류는 어디에도 없음, 서로게이트 쌍은 한 글자', () => {
  const one = (ch) => S.garbleCount(ch);
  for (const cp of [0xFFFD, 0xE000, 0xF8FF, 0xF0000, 0x10FFFD, 0x0000, 0x0001, 0x001C, 0x001F, 0x007F, 0x0080, 0x0085, 0x009F]) {
    assert.deepEqual(one(String.fromCodePoint(cp)), { chars: 1, bad: 1 }, 'U+' + cp.toString(16));
  }
  for (const cp of [0x0009, 0x000A, 0x000D, 0x0020, 0x00A0, 0x3000, 0xFEFF]) {
    assert.deepEqual(one(String.fromCodePoint(cp)), { chars: 0, bad: 0 }, '공백 U+' + cp.toString(16));
  }
  for (const cp of [0x0041, 0x00A1, 0xD7FF, 0xF900, 0xE000 - 1, 0xFFFC, 0xEFFFF, 0x1F600, 0xAC00]) {
    assert.deepEqual(one(String.fromCodePoint(cp)), { chars: 1, bad: 0 }, '정상 U+' + cp.toString(16));
  }
  assert.equal('\u{F0000}'.length, 2, '서로게이트 쌍');
  assert.deepEqual(S.garbleCount('a\u{F0000}b \t\u0001'), { chars: 4, bad: 2 });
  assert.deepEqual(S.garbleCount(''), { chars: 0, bad: 0 });
  assert.deepEqual(S.garbleCount(null), { chars: 0, bad: 0 });
  // 아이템 묶음 — str 만 본다
  assert.deepEqual(S.countItems([{ str: 'ab c' }, { str: '�' }, { width: 3 }, null, { str: ' ' }]), { chars: 4, bad: 1 });
});

/* ══ 3. 판정 표 ═══════════════════════════════════════════ */

const z = (n) => Array.from({ length: n }, () => 0);
/** chars 배열 → 표본. imgs/ops 는 앞의 글자 0 쪽부터(이미지 확인을 한 쪽) */
function samples(chars, imgs, ops) {
  const out = chars.map((c, i) => ({ pageNo: i + 1, chars: c, bad: 0 }));
  if (imgs) {
    const empty = out.filter((s) => s.chars === 0);
    imgs.forEach((n, i) => { empty[i].imgs = n; empty[i].textOps = ops ? ops[i] : 0; });
  }
  return out;
}

test('SC3 ★ scanVerdict 문턱 — 12 중 9 글자 0 → 후보(이미지 ≥1 scan · 전부 0 notext), 8 이면 text(경계)', () => {
  const nine = [100, 200, 300].concat(z(9));
  assert.equal(S.scanVerdict(samples(nine, [1, 0])).verdict, 'scan');
  assert.equal(S.scanVerdict(samples(nine, [0, 1])).verdict, 'scan', '확인한 쪽 중 하나라도');
  const nt = S.scanVerdict(samples(nine, [0, 0], [3, 4]));
  assert.equal(nt.verdict, 'notext');
  assert.equal(nt.textOps, 7);
  const eight = [100, 200, 300, 400].concat(z(8));
  const r8 = S.scanVerdict(samples(eight));
  assert.equal(r8.verdict, 'text');
  assert.equal(r8.textOps, null, '이미지 확인을 안 했다');
  assert.deepEqual(S.imageCheckPages(samples(eight)), [], '8/12 — 이미지 확인 없음');
  assert.deepEqual(S.imageCheckPages(samples(nine)), [4, 5], '9/12 — 글자 0 쪽 앞의 2쪽만');
  // 짧은 문서: 4 중 3 = 75% → 후보
  assert.equal(S.scanVerdict(samples([50, 0, 0, 0], [1])).verdict, 'scan');
  assert.equal(S.scanVerdict([]).verdict, 'text', '표본 0 → 판단하지 않음');
  assert.equal(S.textlessEnough(0, 0), false);
});

/* 실물 수치(2026-10-20 Build 실측 — `scanPdf` 결과의 표본 쪽 글자 수, 이미지 확인 쪽의 이미지·텍스트 연산 수) */
const REAL = {
  harrison: [2996, 4034, 2946, 2646, 3891, 1852, 3797, 3968, 3277, 3123, 3754, 3595],
  cmdt2026: [3987, 4021, 4278, 4512, 5479, 3828, 4183, 4670, 1070, 4935, 4775, 5545],
  cmdt2021: [1512, 2311, 2169, 2362, 1145, 1979, 1951, 1109, 2051, 1295, 1757, 2476],
  /* CMDT 2021 앞 30쪽(1쪽부터) — 2–27쪽이 글자 0(3쪽 이미지 1·2쪽 이미지 0) */
  cmdt2021Front30: [24].concat(z(26), [1755, 2033, 83]),
  grammarScan: { chars: z(12), imgs: [1, 1], ops: [0, 0] },
  testOcr: { chars: [2742].concat(z(11)), imgs: [1, 1], ops: [0, 0] },
  harryPotter: { chars: z(12), imgs: [0, 0], ops: [84, 66] }
};

test('SC4 ★ 실물 표 — 의학책 세 권 text · Grammar 원본·test-OCR scan · Harry Potter 2 notext + 텍스트 연산 > 0', () => {
  for (const k of ['harrison', 'cmdt2026', 'cmdt2021']) {
    const r = S.scanVerdict(samples(REAL[k]));
    assert.equal(r.verdict, 'text', k);
    assert.equal(r.textless, 0, k);
  }
  const g = S.scanVerdict(samples(REAL.grammarScan.chars, REAL.grammarScan.imgs, REAL.grammarScan.ops));
  assert.deepEqual([g.verdict, g.textless, g.img, g.textOps], ['scan', 12, 2, 0]);
  const o = S.scanVerdict(samples(REAL.testOcr.chars, REAL.testOcr.imgs, REAL.testOcr.ops));
  assert.deepEqual([o.verdict, o.textless], ['scan', 11], 'OCR 한 6쪽(40–45) 중 41쪽이 표본 — 그래도 scan');
  const h = S.scanVerdict(samples(REAL.harryPotter.chars, REAL.harryPotter.imgs, REAL.harryPotter.ops));
  assert.deepEqual([h.verdict, h.img, h.textOps], ['notext', 0, 150], '★ carryover 세 번째 꼴 — 그리기 명령은 있는데 글자 0');
});

test('SC5 ★ 변이 꼴 — 옛 "앞쪽 12쪽" 규칙이면 CMDT 2021 이 scan 으로 틀린다(지금 규칙은 앞붙이를 피한다)', () => {
  // 앞 12쪽 표본(17-5 (c) 원안): 1쪽 글자 있음 + 2–12쪽 글자 0 → 11/12 → 2·3쪽 확인(3쪽 이미지 1) → scan
  const front = REAL.cmdt2021Front30.slice(0, 12).map((c, i) => ({ pageNo: i + 1, chars: c, bad: 0 }));
  assert.deepEqual(S.imageCheckPages(front), [2, 3]);
  front[1].imgs = 0; front[2].imgs = 1;
  assert.equal(S.scanVerdict(front).verdict, 'scan', '옛 규칙은 텍스트 책을 스캔본으로 본다');
  // 지금 규칙: 5051쪽의 10–90% 구간 표본은 앞붙이에 닿지 않는다
  assert.ok(S.probePages(5051).every((p) => p > 27));
  assert.equal(S.scanVerdict(samples(REAL.cmdt2021)).verdict, 'text');
});

test('SC6 ★ garbled — 스피쿠스 최저·최고 → garbled, 정상 최대 → text, 경계 Σbad·20 = Σchars, Σchars 499, 순서(글자 0 먼저)', () => {
  const one = (chars, bad) => S.scanVerdict([{ pageNo: 1, chars: chars, bad: bad }]).verdict;
  // 19-1-3 §3-1 조사 원값(표본 쪽 합)
  assert.equal(one(5982, 1143), 'garbled', '스피쿠스 최저 19.1%');
  assert.equal(one(7942, 2063), 'garbled', '스피쿠스 최고 26.0%');
  assert.equal(one(17309, 13), 'text', '정상 최대 0.075%(English Pronunciation In Use)');
  // Build 실측(앱 `scanPdf`, 표본 쪽 전부 — 조사는 쪽당 6,000자에서 잘랐다)
  assert.equal(one(5599, 1209), 'garbled', 'unit1 21.6%');
  assert.equal(one(8286, 2058), 'garbled', 'unit10 24.8%');
  assert.equal(one(1000, 50), 'garbled', '경계 Σbad·20 = Σchars');
  assert.equal(one(1000, 49), 'text', '1 적으면 text');
  assert.equal(one(499, 499), 'text', 'Σchars 499 — 판단하지 않음');
  assert.equal(one(500, 25), 'garbled', 'Σchars 500 — 판단한다');
  // 여러 쪽 합으로 본다
  const multi = [{ pageNo: 1, chars: 300, bad: 0 }, { pageNo: 2, chars: 300, bad: 30 }];
  assert.equal(S.scanVerdict(multi).verdict, 'garbled', '600자 중 30 = 5%');
  // 순서 — 글자 0 이 75% 이상이면 bad 를 보지 않는다
  const sc = [{ pageNo: 1, chars: 900, bad: 900 }].concat([2, 3, 4].map((n) => ({ pageNo: n, chars: 0, bad: 0, imgs: n === 2 ? 1 : undefined })));
  assert.equal(S.scanVerdict(sc).verdict, 'scan');
});

/* ══ 4. 레코드·경첩·안내 키 ══════════════════════════════════ */

test('SC7 scanRecord · needsScan — v 경첩, 같은 갈래면 noticed 를 지킨다, textOps 는 확인했을 때만', () => {
  const r = S.scanVerdict(samples(REAL.harryPotter.chars, REAL.harryPotter.imgs, REAL.harryPotter.ops));
  const rec = S.scanRecord(r, null, 123);
  assert.deepEqual(rec, { v: SCAN.VERSION, verdict: 'notext', probed: 12, textless: 12, img: 0, chars: 0, bad: 0, at: 123, textOps: 150 });
  const t = S.scanRecord(S.scanVerdict(samples(REAL.harrison)), null, 1);
  assert.ok(!('textOps' in t), 'text 판정에는 textOps 없음');
  assert.equal(S.scanRecord(r, { verdict: 'scan', noticed: true }, 1).noticed, true, 'scan → notext 같은 안내');
  assert.ok(!('noticed' in S.scanRecord(r, { verdict: 'garbled', noticed: true }, 1)), '갈래가 바뀌면 다시 안내');
  assert.equal(S.needsScan({}), true);
  assert.equal(S.needsScan({ scan: { v: SCAN.VERSION - 1 } }), true, '옛 판');
  assert.equal(S.needsScan({ scan: { v: SCAN.VERSION, verdict: 'text' } }), false);
  assert.equal(S.needsScan(null), false);
});

test('SC8 안내 키 — 배지·띠(문서당 한 번)·검색 줄·▶ 갈래(순수)', () => {
  const d = (verdict, noticed) => ({ scan: { v: 1, verdict: verdict, noticed: noticed } });
  assert.equal(S.badgeKey(d('scan')), 'library.card.scan');
  assert.equal(S.badgeKey(d('notext')), 'library.card.scan');
  assert.equal(S.badgeKey(d('garbled')), 'library.card.garbled');
  assert.equal(S.badgeKey(d('text')), null);
  assert.equal(S.badgeKey({}), null);
  assert.equal(S.bandKey(d('scan')), 'reader.scan.notice');
  assert.equal(S.bandKey(d('garbled')), 'reader.scan.garbled');
  assert.equal(S.bandKey(d('scan', true)), null, '닫았으면 다시 안 뜬다');
  assert.equal(S.bandKey(d('text')), null);
  assert.deepEqual(S.searchNotice('scan', { final: true, hits: 0 }), { key: 'reader.scan.noSearch', replace: true });
  assert.deepEqual(S.searchNotice('notext', { final: true, hits: 0 }), { key: 'reader.scan.noSearch', replace: true });
  assert.equal(S.searchNotice('scan', { final: false, hits: 0 }), null, '아직 다 안 찾았다');
  assert.equal(S.searchNotice('scan', { final: true, hits: 3 }), null, '찾은 것이 있으면(OCR 몇 쪽) 그대로');
  assert.deepEqual(S.searchNotice('garbled', { final: true, hits: 5 }), { key: 'reader.scan.garbledSearch', replace: false });
  assert.deepEqual(S.searchNotice('garbled', { final: false, hits: 0 }), { key: 'reader.scan.garbledSearch', replace: false });
  assert.equal(S.searchNotice('text', { final: true, hits: 0 }), null);
  // ▶
  assert.equal(S.blocksPlay('scan', { state: 'idle', empty: true }), true);
  assert.equal(S.blocksPlay('notext', { state: 'paused', empty: true }), true);
  assert.equal(S.blocksPlay('scan', { state: 'idle', empty: false }), false, 'OCR 된 쪽은 읽는다');
  assert.equal(S.blocksPlay('scan', { state: 'speaking', empty: true }), false, '재생 시작 지점에서만');
  assert.equal(S.blocksPlay('scan', { state: 'waiting-page', empty: true }), false);
  assert.equal(S.blocksPlay('garbled', { state: 'idle', empty: true }), false, '★ L-D10 — 깨짐은 막지 않는다');
  assert.equal(S.blocksPlay('text', { state: 'idle', empty: true }), false, '텍스트 문서는 그대로');
  assert.equal(S.blocksPlay(null, { state: 'idle', empty: true }), false);
});

/* ══ 5. scanPdf — 가짜 pdfDoc 으로 pdf.js 호출 수를 센다 ═════════════ */

const OPS = { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageMaskXObject: 83, showText: 44, showSpacedText: 45, nextLineShowText: 46, nextLineSetSpacingShowText: 47, setFont: 37 };

function fakePdf(n, pageFn) {
  const calls = { text: [], ops: [], cleanup: 0 };
  const doc = {
    numPages: n,
    calls: calls,
    async getPage(p) {
      const spec = pageFn(p);
      return {
        async getTextContent() { calls.text.push(p); if (spec.throwText) throw new Error('x'); return { items: (spec.str || []).map((s) => ({ str: s })) }; },
        async getOperatorList() { calls.ops.push(p); return { fnArray: spec.fn || [] }; },
        cleanup() { calls.cleanup++; return true; }
      };
    }
  };
  return doc;
}

test('SC9 ★ scanPdf — 표본 12쪽 글자만, 75% 이상 글자 0 일 때만 최대 2쪽 이미지 연산 · 텍스트 연산도 센다', async () => {
  const scan = fakePdf(307, () => ({ str: [], fn: [85, 37, 44] }));
  const r = await scanPdf(scan, OPS);
  assert.deepEqual(scan.calls.text, S.probePages(307));
  assert.deepEqual(scan.calls.ops, [41, 61], '★ 최대 2쪽');
  assert.equal(scan.calls.cleanup, 2);
  assert.deepEqual([r.verdict, r.img, r.textOps], ['scan', 2, 2]);

  const hp = fakePdf(341, () => ({ str: [' '], fn: [37, 44, 44, 45, 46, 47] }));
  const h = await scanPdf(hp, OPS);
  assert.deepEqual([h.verdict, h.textOps], ['notext', 10]);

  const text = fakePdf(729, (p) => ({ str: ['Page ' + p + ' text here'] }));
  const t = await scanPdf(text, OPS);
  assert.equal(t.verdict, 'text');
  assert.deepEqual(text.calls.ops, [], '★ 텍스트 책은 getOperatorList 0 번(이미지를 풀지 않는다)');

  const garb = fakePdf(6, () => ({ str: ['\u0001'.repeat(30) + 'x'.repeat(90)] }));
  assert.equal((await scanPdf(garb, OPS)).verdict, 'garbled');
});

/* ══ 6. 저장 — 자기 필드만 · 한 번만 · 실패는 조용히 ═══════════════ */

function seedDoc(id, extra) {
  return Object.assign({
    id: id, title: 'T', fileName: 'f.pdf', size: 1, fileHash: 'h-' + id, pageCount: 307,
    addedAt: 1, lastOpenedAt: 1, lastPage: 1, lastLineId: null,
    lang: 'en', langSource: 'default', langGuess: null,
    extraction: { done: false, pagesDone: 0, cursor: 1, failed: [], algoVersion: 0 }, sectionIndex: []
  }, extra || null);
}

test('SC10 ★ P1 경합 — 판정이 도는 사이 다른 곳이 lang·lastPage 를 써도 덮지 않는다(scan 만 쓴다)', async () => {
  idb.delayReadonlyComplete('documents', 0);
  await db.put('documents', seedDoc('s10'));
  // 표본 읽기 도중(첫 getTextContent)에 끼어드는 쓰기
  let intruded = false;
  const pdf = fakePdf(307, () => ({ str: [], fn: [85] }));
  const orig = pdf.getPage.bind(pdf);
  pdf.getPage = async (p) => {
    const pg = await orig(p);
    if (!intruded) {
      intruded = true;
      await db.patch('documents', 's10', { lang: 'fr', langSource: 'user', lastPage: 77, lastLineId: 'p77-l3' });
    }
    return pg;
  };
  const out = await runScan('s10', pdf, OPS);
  assert.equal(out.verdict, 'scan');
  const rec = idb.peek('medreader', 'documents', 's10');
  assert.deepEqual([rec.lang, rec.langSource, rec.lastPage, rec.lastLineId], ['fr', 'user', 77, 'p77-l3'], '★ 끼어든 쓰기를 되돌리지 않았다');
  assert.equal(rec.scan.verdict, 'scan');
  assert.equal(rec.scan.v, SCAN.VERSION);
  // writeScan 이 돌려주는 부분 = SCAN_FIELDS 뿐
  assert.deepEqual(S.SCAN_FIELDS, ['scan']);
});

test('SC11 ★ 한 번만 돈다 — scan.v 가 같으면 pdf 를 건드리지 않는다 · 옛 판이면 다시 · 실패는 조용히·쓰지 않음·다음에 다시', async () => {
  await db.put('documents', seedDoc('s11'));
  const pdf = fakePdf(20, () => ({ str: ['hello world text'] }));
  assert.equal((await runScan('s11', pdf, OPS)).verdict, 'text');
  const n1 = pdf.calls.text.length;
  assert.equal(await runScan('s11', pdf, OPS), null, '이미 판정했다');
  assert.equal(pdf.calls.text.length, n1, '★ 두 번째는 쪽을 읽지 않았다');
  // 옛 판 → 다시
  await db.patch('documents', 's11', { scan: { v: SCAN.VERSION - 1, verdict: 'text' } });
  assert.equal((await runScan('s11', pdf, OPS)).verdict, 'text');
  assert.ok(pdf.calls.text.length > n1);
  // 실패 — 던지지 않고, 쓰지 않는다
  await db.put('documents', seedDoc('s11b'));
  const bad = fakePdf(20, (p) => ({ str: ['x'], throwText: p === 5 }));
  assert.equal(await runScan('s11b', bad, OPS), null);
  assert.ok(!('scan' in idb.peek('medreader', 'documents', 's11b')), '실패하면 아무것도 쓰지 않는다');
  const ok = fakePdf(20, () => ({ str: ['x y z'] }));
  assert.equal((await runScan('s11b', ok, OPS)).verdict, 'text', '다음에 다시 — 이번엔 된다');
  // 지워진 문서는 되살리지 않는다
  assert.equal(await runScan('nope', ok, OPS), null);
  assert.equal(idb.peek('medreader', 'documents', 'nope'), undefined);
});

test('SC12 ★ writeScan · markScanNoticed — scan 만, 다른 필드는 그대로 · noticed 는 판정 값을 지킨다', async () => {
  await db.put('documents', seedDoc('s12', { lastPage: 9 }));
  const before = idb.peek('medreader', 'documents', 's12');
  const res = S.scanVerdict(samples(REAL.grammarScan.chars, REAL.grammarScan.imgs, REAL.grammarScan.ops));
  const w = await writeScan('s12', res, 5);
  assert.equal(w.wrote, true);
  const after = idb.peek('medreader', 'documents', 's12');
  for (const k of Object.keys(before)) assert.deepEqual(after[k], before[k], k);
  assert.deepEqual(Object.keys(after).filter((k) => !(k in before)), ['scan']);
  assert.equal((await writeScan('s12', res, 6)).wrote, false, '같은 판이면 다시 쓰지 않는다');
  const m = await markScanNoticed('s12');
  assert.equal(m.wrote, true);
  const n = idb.peek('medreader', 'documents', 's12');
  assert.deepEqual(n.scan, Object.assign({}, after.scan, { noticed: true }));
  assert.equal(n.lastPage, 9);
  assert.equal((await markScanNoticed('s12')).wrote, false, '이미 닫았다');
  await db.put('documents', seedDoc('s12b'));
  assert.equal((await markScanNoticed('s12b')).wrote, false, '판정이 없으면 쓰지 않는다');
});

test('SC13 판정 저장은 DB 버전·algoVersion·derivedDocReset 과 무관하다(17-5-1 2)', async () => {
  assert.equal(db.DB_VERSION, 3);
  assert.ok(!('scan' in db.derivedDocReset()), '[텍스트 다시 추출]이 판정을 지우지 않는다');
  await db.put('documents', seedDoc('s13', { scan: { v: SCAN.VERSION, verdict: 'scan', noticed: true } }));
  const r = await db.resetDerived('s13');
  assert.equal(r.reset, true);
  assert.deepEqual(idb.peek('medreader', 'documents', 's13').scan, { v: SCAN.VERSION, verdict: 'scan', noticed: true });
});

/* ══ 7. ▶ 갈래 — 실제 speaker ══════════════════════════════ */

function rig(pages) {
  let pg = 1;
  const spoken = [];
  const synth = {
    speaking: false, pending: false,
    speak(u) { spoken.push(u.text); }, cancel() { }, pause() { }, resume() { }
  };
  const timers = { setTimeout: () => 1, clearTimeout: () => { }, now: () => 0 };
  const turns = [];
  const view = {
    paras: () => pages[pg] || [],
    page: () => ({ page: pg, pageCount: Object.keys(pages).length }),
    goToPage: (n) => { turns.push(n); pg = n; return Promise.resolve(true); },
    show: () => true, markDone: () => { }
  };
  const sp = createSpeaker({ synth, timers, makeUtterance: (text) => ({ text }), view, translation: null,
    requestWakeLock: () => Promise.resolve(null), readCitations: () => false });
  return { sp, spoken, turns, setPage: (n) => { pg = n; } };
}
const ln = (id, text) => ({ id: id, text: text, hyphen: 'none' });

test('SC14 ★ ▶ — 스캔본 빈 쪽이면 막는다(쪽이 움직이지 않음·idle) · 깨짐은 막지 않는다 · OCR 된 쪽·텍스트 문서는 그대로', async () => {
  const pages = { 1: [], 2: [], 3: [{ id: 'p3', kind: 'body', lines: [ln('3:0', 'Some text here.')] }] };
  const h = rig(pages);
  assert.equal(h.sp.isQueueEmptyHere(), true);
  assert.equal(scanPlayBlocked(h.sp, 'scan'), true, '★ 막는다 → reader.scan.noRead');
  assert.equal(scanPlayBlocked(h.sp, 'notext'), true);
  assert.equal(scanPlayBlocked(h.sp, 'garbled'), false, '★ L-D10');
  assert.equal(scanPlayBlocked(h.sp, 'text'), false);
  assert.equal(scanPlayBlocked(h.sp, null), false);
  assert.equal(scanPlayBlocked(null, 'scan'), false);
  assert.equal(h.sp.getState(), 'idle');
  assert.equal(h.sp.getTotal(), 0, 'isQueueEmptyHere 는 큐를 바꾸지 않는다');
  assert.deepEqual(h.turns, []);
  // 글자가 있는 쪽(OCR 한 몇 쪽)에서는 막지 않는다
  h.setPage(3);
  assert.equal(h.sp.isQueueEmptyHere(), false);
  assert.equal(scanPlayBlocked(h.sp, 'scan'), false);
  h.sp.play();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(scanPlayBlocked(h.sp, 'scan'), false, '낭독 중이면 갈래가 아니다(재생 시작 지점에서만)');
  // 지금(갈래 없음): 빈 쪽에서 ▶ → 조용히 idle — 쪽은 넘기지 않는다(기존 S22 와 같은 길)
  const g = rig(pages);
  g.sp.play();
  await sleep(0);
  assert.equal(g.sp.getState(), 'idle');
  assert.deepEqual(g.turns, []);
});

test('SC15 배선 — controls ▶ 는 scanPlayBlocked 뒤에 play · library attach 다음 판정 · 서재 배지 · reader 띠·빈 쪽 안내 · search 한 줄', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const c = strip(read('../js/ui/controls.js'));
  const click = c.slice(c.indexOf("els.play.addEventListener('click'"), c.indexOf("els.prev.addEventListener('click'"));
  // 줄 끝 주석을 지우고 본다
  const code = click.replace(/\/\/[^\n]*/g, '');
  assert.match(code, /if \(s === 'speaking'\) speaker\.pause\(\);\s*else if \(scanPlayBlocked\(speaker, docScanVerdict\(\)\)\) noReadNotice\(\);\s*else \{ syncReadalong\(\); speaker\.play\(\); \}/);
  assert.match(c, /key: 'reader\.scan\.noRead'/);
  const l = strip(read('../js/ui/library.js'));
  const at = l.slice(l.indexOf('async function attach('), l.indexOf('const scanBusy'));
  assert.ok(at.indexOf('await ex.start();') < at.indexOf('scheduleScan(doc.id, pdfDoc, ex)'), '★ 추출을 시작한 뒤에');
  assert.match(at, /if \(needsScan\(doc\)\) scheduleScan/);
  assert.match(l, /card\.appendChild\(scanBadge\(doc\)\)/);
  const r = strip(read('../js/ui/reader.js'));
  assert.match(r, /if \(!blocks\.length\) section\.appendChild\(noTextNotice\(\)\);/);
  assert.match(r, /noticeBlock\('reader\.page\.noText'\)/);
  assert.ok(!/noticeBlock\('reader\.page\.empty'\)/.test(r), 'reader.page.empty 는 쓰지 않는다');
  assert.match(r, /markScanNoticed\(docId\)/);
  const sr = strip(read('../js/ui/search.js'));
  assert.match(sr, /searchNotice\(sd && sd\.scan && sd\.scan\.verdict/);
  const html = read('../index.html');
  for (const id of ['scanNotice', 'scanNoticeText', 'scanNoticeOriginal', 'scanNoticeClose']) assert.match(html, new RegExp('id="' + id + '"'));
});

/* ══ 8. i18n — 네 언어, spec 문안 그대로 ═══════════════════════ */

test('SC16 ★ 새 키 8개가 네 언어 모두 spec 표 문안 그대로다(17-5-1 3 · 19-1-3 §3-3)', () => {
  const spec = read('../spec.md');
  const keys = ['library.card.scan', 'reader.scan.notice', 'reader.page.noText', 'reader.scan.noRead', 'reader.scan.noSearch',
    'library.card.garbled', 'reader.scan.garbled', 'reader.scan.garbledSearch'];
  for (const k of keys) {
    const row = spec.split('\n').find((x) => x.startsWith('| `' + k + '` |'));
    assert.ok(row, 'spec 에 ' + k + ' 행');
    const cells = row.split(' | ').map((x) => x.trim());
    // | `key` | ko | en | ar | fr |
    const want = { ko: cells[1], en: cells[2], ar: cells[3], fr: cells[4].replace(/ \|$/, '') };
    for (const lang of ['ko', 'en', 'ar', 'fr']) assert.equal(BUNDLES[lang][k], want[lang], lang + '.' + k);
  }
  for (const lang of ['ko', 'en', 'ar', 'fr']) assert.equal(typeof BUNDLES[lang]['reader.page.empty'], 'string', '옛 키는 남긴다');
});
