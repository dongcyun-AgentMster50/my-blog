/* ============================================================
   MedReader — 러닝 헤드(쪽 머리말) 판정: 머리말 띠 · 글자 크기 · 쪽 번호 진행
   (spec 4-7 [수정 2026-10-10 — 공개 전 P2])

   `[실측]` CMDT 2026 표본 201쪽 중 196쪽에서 쪽 머리말이 낭독에 남았다 — 머리말이 본문보다
   큰 글자(Fm 의 1.33배)라 4-7 의 "fontSize ≤ 1.1×Fm" 에서 떨어졌다. 반대로 띠 없이 상단 8%
   영역만 보던 규칙은 영역 안의 본문(참고문헌 줄·문항 라벨 등)을 머리말로 빼고 있었다.

   좌표·문장은 전부 지어낸 것이다(원서 문장 아님). 쪽 규격·글자 크기·간격만 실측 비율을 따른다:
   쪽 517×720, 본문 9pt·행간 10.5, 머리말 12pt, 머리말 아래 간격 ≈ 2.8×Lm.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageLayout } from '../js/text/layout.js';
import { LAYOUT } from '../js/config.js';

const W = 517;
const H = 720;
const LEAD = 10.5;

function item(str, x, y, o = {}) {
  const fs = o.fontSize == null ? 9 : o.fontSize;
  const w = o.width == null ? str.length * fs * 0.5 : o.width;
  return { str, dir: 'ltr', transform: [fs, 0, 0, fs, x, y], width: w, height: fs, fontName: 'g_d0_f1', hasEOL: false };
}

// 1단 본문 n줄 (x=50, 폭 400, 9pt, 행간 10.5) — 지어낸 문장
function body(n, top = 671, first = null) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i === 0 && first ? first : 'the invented passage continues with plain words line ' + (i + 1);
    out.push(item(s, 50, top - LEAD * i, { width: 400 }));
  }
  return out;
}

function layout(items, pageNo = 40, neighbors = []) {
  return buildPageLayout(items, { pageNo, width: W, height: H, neighborLayouts: neighbors });
}

function lineOf(L, needle) { return L.lines.find((l) => l.text.indexOf(needle) === 0) || null; }
function spoken(L, needle) { return L.paragraphs.some((p) => p.text.indexOf(needle) >= 0); }

// 이웃 저장본 모양(앱은 앞뒤 쪽 저장본을 넘긴다) — 띠 줄 하나 + 그 아래 본문
function neighbor(pageNo, headText, headY = 700, bodyTop = 671) {
  const lines = [{ text: headText, baseline: headY, role: 'body', fontSize: 12 }];
  for (let i = 0; i < 10; i++) lines.push({ text: 'neighbor body line ' + i, baseline: bodyTop - LEAD * i, role: 'body', fontSize: 9 });
  return { pageNo, height: H, lines, paragraphs: [], stats: { medianFontSize: 9, medianLeading: LEAD } };
}

/* ── 머리말이 빠진다 ─────────────────────────────────────── */

test('H1 본문보다 큰(1.33×Fm) 대문자 머리말 → header, 낭독에서 빠진다', () => {
  const L = layout([item('76 IMAGINARY HANDBOOK 2030 CHAPTER 5', 50, 700, { fontSize: 12 }), ...body(12)]);
  assert.equal(lineOf(L, '76 IMAGINARY').role, 'header');
  assert.ok(!spoken(L, 'IMAGINARY'), '머리말이 낭독 문단에 남으면 안 된다');
  // 본문은 그대로 — 첫 본문 줄도 문단에 있다
  assert.ok(spoken(L, 'line 1') && spoken(L, 'line 12'));
});

test('H2 대소문자 섞인 머리말 — 앞뒤 쪽 머리말과 쪽 번호가 1씩 나아가면 header', () => {
  const items = [item('76 Imaginary Handbook 2030 Chapter 5', 50, 700, { fontSize: 12 }), ...body(12)];
  // 이웃 없이는 증거가 없다(대문자 비율 < 0.6, 접두 없음, 반복 없음)
  assert.notEqual(lineOf(layout(items, 40), '76 Imaginary').role, 'header');
  // 짝·홀 쪽 머리말 글자가 서로 달라도(앞뒤 1쪽) 쪽 번호가 75 → 76 → 77 로 나아간다
  const nbs = [neighbor(39, 'Invented Topics Imaginary Handbook 2030 75'), neighbor(41, 'Invented Topics Imaginary Handbook 2030 77')];
  const L = layout(items, 40, nbs);
  assert.equal(lineOf(L, '76 Imaginary').role, 'header');
  assert.ok(!spoken(L, 'Imaginary Handbook'));
});

test('H2b 띠가 두 줄로 나뉜 홀수 쪽 머리말(장 제목 | 책 이름 쪽번호) — 같은 띠의 두 줄이 모두 header', () => {
  // 실물(2단 쪽)에서는 장 제목과 "책 이름 쪽번호"가 서로 다른 줄로 나온다. 여기서는 높이를
  // 4pt 어긋나게 해 같은 줄로 합쳐지지 않게 한다(줄 허용폭 3.5 < 4 ≤ 띠 허용폭 0.5×Fm = 4.5).
  // 쪽 번호가 없는 장 제목 줄도 같은 띠라서 머리말이다.
  const items = [
    item('Invented Topics', 50, 700, { fontSize: 10 }),
    item('Imaginary Handbook 2030 77', 330, 704, { fontSize: 12 }),
    ...body(12)
  ];
  const nbs = [neighbor(40, '76 Imaginary Handbook 2030 Chapter 5'), neighbor(42, '78 Imaginary Handbook 2030 Chapter 5')];
  const L = layout(items, 41, nbs);
  assert.equal(lineOf(L, 'Invented Topics').role, 'header');
  assert.equal(lineOf(L, 'Imaginary Handbook').role, 'header');
});

/* ── 본문은 빠지지 않는다 (반례) ──────────────────────────── */

test('H3 머리말 아래 상단 영역 안의 대문자 본문 줄은 header 가 아니다(띠 밖)', () => {
  // 671 은 상단 8% 영역(> 662.4) 안이고 대문자 비율이 높다 — 옛 규칙은 이 줄을 머리말로 뺐다
  const L = layout([
    item('76 IMAGINARY HANDBOOK 2030 CHAPTER 5', 50, 700, { fontSize: 12 }),
    ...body(12, 671, 'REF ABC. 2030;12:345. [PMID: 9876543]')
  ]);
  assert.equal(lineOf(L, '76 IMAGINARY').role, 'header');
  const ref = lineOf(L, 'REF ABC');
  assert.ok(ref.baseline > H * (1 - LAYOUT.HEADER_ZONE), '전제: 이 줄은 상단 영역 안이다');
  assert.notEqual(ref.role, 'header');
  assert.ok(spoken(L, 'PMID: 9876543'), '본문 줄이 낭독에서 빠지면 안 된다');
});

test('H3b 머리말 없는 쪽의 첫 줄(문항 라벨·대문자) — 아래와 행간만큼 붙어 있으면 header 가 아니다', () => {
  // 쪽 맨 위가 곧 본문 덩어리 맨 위다(머리말 없는 문제집). 첫 줄이 상단 영역 안이라도 본문이다.
  const L = layout(body(12, 700, 'IV-12. A MADE-UP CASE OF AN INVENTED DISEASE'));
  const lab = lineOf(L, 'IV-12.');
  assert.ok(lab.baseline > H * (1 - LAYOUT.HEADER_ZONE));
  assert.notEqual(lab.role, 'header');
  const q = L.paragraphs.find((p) => p.text.indexOf('IV-12.') === 0);
  assert.ok(q, '문항 라벨이 문단에 있어야 한다');
  assert.equal(q.kind, 'question');
});

test('H4 머리말 없는 책 — 쪽 맨 위 표 제목이 이웃 쪽 맨 윗줄과 같은 높이라도 쪽 번호 진행이 없으면 header 가 아니다', () => {
  // 그림·표가 쪽 맨 위에 오면 맨 윗줄도 아래와 떨어져 "띠"가 된다. 자리만 같다고 머리말이 아니다.
  const items = [item('TABLE II-11 Invented caption about a made-up survey', 50, 700, { fontSize: 9 }), ...body(12, 600)];
  const nbs = [neighbor(39, 'Made-up figure label', 700, 640), neighbor(41, 'Another invented caption line', 700, 640)];
  const L = layout(items, 40, nbs);
  assert.notEqual(lineOf(L, 'TABLE II-11').role, 'header');
  assert.ok(spoken(L, 'Invented caption'));
});

test('H5 쪽 맨 위의 큰 대문자 표제(장 첫 쪽, 2.5×Fm)는 header 가 아니다 — 글자 크기 상한', () => {
  const L = layout([item('INVENTED CHAPTER TITLE', 50, 690, { fontSize: 22.5 }), ...body(12, 640)]);
  assert.notEqual(lineOf(L, 'INVENTED CHAPTER').role, 'header');
  assert.ok(spoken(L, 'INVENTED CHAPTER TITLE'));
});

test('H6 끝 숫자가 쪽 차이만큼 나아가지 않으면 쪽 번호 진행이 아니다', () => {
  // 40쪽 "… 3" / 41쪽 "… 7" — 같은 자리, 끝 숫자도 있지만 3 − 7 ≠ 40 − 41.
  // (글자는 서로 다르게 둔다 — 숫자만 다른 같은 글이면 4-7 의 원래 "이웃 반복"이 맞는다.)
  const items = [item('Invented stage summary 3', 50, 700, { fontSize: 10 }), ...body(12, 660)];
  const L = layout(items, 40, [neighbor(41, 'Other made-up overview 7', 700, 660)]);
  assert.notEqual(lineOf(L, 'Invented stage').role, 'header');
});

test('H6b 쪽 번호가 맞아도 이웃 띠 줄이 다른 높이면 쪽 번호 진행이 아니다', () => {
  const items = [item('76 Imaginary Handbook 2030 Chapter 5', 50, 700, { fontSize: 12 }), ...body(12)];
  // 이웃의 맨 윗줄이 상단 영역 안이지만 머리말 자리(700)가 아니라 32pt 아래(668)에 있다
  const L = layout(items, 40, [neighbor(41, 'Invented Topics Imaginary Handbook 2030 77', 668, 640)]);
  assert.notEqual(lineOf(L, '76 Imaginary').role, 'header');
});

test('H7 머리말이 빠진 뒤에도 바로 아래 첫 본문 줄은 heading 으로 오판되지 않는다(B9 와 같은 원칙)', () => {
  const L = layout([item('76 IMAGINARY HANDBOOK 2030 CHAPTER 5', 50, 700, { fontSize: 12 }), ...body(12, 671, 'a short opening line')]);
  assert.equal(lineOf(L, 'a short opening').role, 'body');
  assert.equal(L.paragraphs.length, 1);
});

test('H8 표가 많아 Fm 이 작은 쪽 — 머리말이 상한(1.6×Fm)을 넘어도 쪽 번호 진행이 맞으면 header', () => {
  // 본문 대신 6.75pt 표 글자가 쪽을 채우면 Fm 이 6.75 가 되어 12pt 머리말은 1.78×Fm 이다.
  const rows = [];
  for (let i = 0; i < 14; i++) rows.push(item('invented cell text in a made-up table row ' + i, 50, 671 - 8 * i, { fontSize: 6.75, width: 400 }));
  const items = [item('80 IMAGINARY HANDBOOK 2030 CHAPTER 5', 50, 700, { fontSize: 12 }), ...rows];
  assert.ok(12 > LAYOUT.HEADER_FONT_RATIO * 6.75, '전제: 글자 크기 상한을 넘는다');
  // 쪽 번호 진행 없이는 상한에 걸린다(대문자만으로는 부족)
  assert.notEqual(lineOf(layout(items, 44), '80 IMAGINARY').role, 'header');
  const L = layout(items, 44, [neighbor(43, 'INVENTED TOPICS IMAGINARY HANDBOOK 2030 79'), neighbor(45, 'INVENTED TOPICS IMAGINARY HANDBOOK 2030 81')]);
  assert.equal(lineOf(L, '80 IMAGINARY').role, 'header');
});
