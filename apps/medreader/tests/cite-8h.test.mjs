/* ============================================================
   tests/cite-8h.test.mjs — 8h-1 낭독 정리: 인용·참고문헌(A) · 글머리·식별자 경계(B) · 각주 기호(C)
   (spec 6-6-2 · 6-6-3 · 6-6-4 · 6-6-8 테스트 T-A1 · T-A2 · T-B · T-B4 · T-C · T-U · T-S · T-R · grep)

   ★ 픽스처는 전부 **지어낸 문장**이다(저자·학술지·PMID 번호도 지어냈다). 원서 문장을 옮기지 않는다.
   ★ 오탐(본문을 건너뜀)이 미탐보다 비싸다 — 음성(negative) 픽스처가 양성만큼 중요하다.
   ============================================================ */

// 캐시 키 해시의 끝나는 시점을 실제 시계에서 떼어 낸다(readalong 이 키를 만든다). 맨 먼저.
import './fixtures/sync-digest.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { isCitation, citationKind, isIdOnly, markReferences, isPublicationOnly, publicationTails } from '../js/text/cite.js';
import { splitSentences, endsSentence } from '../js/text/segment.js';
import {
  buildUnits, sentencesOf, speechMarks, normalizeSpeech, trSpeechText, indexAtOrAfterLine
} from '../js/tts/text.js';
import { createSpeaker } from '../js/tts/speaker.js';
import { createReadalong } from '../js/ai/readalong.js';
import { STATES } from '../js/ai/pipeline.js';
import { keyFor } from '../js/ai/cache.js';
import { CITE } from '../js/config.js';
import * as settings from '../js/settings.js';
import en from '../js/i18n/en.js';
import ar from '../js/i18n/ar.js';
import fr from '../js/i18n/fr.js';
import ko from '../js/i18n/ko.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const JS = join(HERE, '..', 'js');

const ln = (id, text, hyphen) => ({ id: id, text: text, hyphen: hyphen || 'none' });
const para = (id, lines, kind) => ({ id: id, kind: kind || 'body', lines: lines });

/* ══ T-A1 isCitation ═══════════════════════════════════ */

test('T-A1 ★ 양성 — 식별자만 · 성 이니셜 et al. 학술지 · [PMID]; 저자 · 학술지 뒤 [PMID] · 하이픈 이니셜 · doi · PMCID', () => {
  const pos = [
    ['[PMID: 31234567]', 'id'],
    ['PMID 31234567.', 'id'],
    ['Garcia LM et al. J Clin Hypertens.', 'etal'],
    ['Okafor N, Brandt KE et al. Ann Rheum Dis.', 'etal'],
    ['[PMID: 31234567]; Okafor N et al. Ann Rheum Dis.', 'etal+id'],
    ['Okafor N et al. Ann Rheum Dis. [PMID: 31234567]', 'etal+id'],
    ['Chen GC-Y et al. Clin Rheumatol.', 'etal'],
    ['doi:10.1000/xyz123', 'id'],
    ['PMCID: PMC1234567', 'id'],
    ['[DOI: 10.1000/abc.12]', 'id'],
    ['Lindqvist PA. J Endocr Soc. [PMID: 31234567]', 'id'],   // et al. 없는 저자 + 학술지 — 식별자가 있을 때만
    ['Garcia LM et al. J Clin Hypertens. 2024', 'etal'],      // 연도까지(분할은 "Hypertens. 2024;…" 의 연도 앞에서 이미 끊는다)
    ['• [PMID: 31234567]', 'id']
  ];
  for (const [s, kind] of pos) {
    assert.equal(citationKind(s), kind, s);
    assert.equal(isCitation(s), true, s);
  }
});

test('T-A1 ★ 음성 — 본문 문장·표 머리·다른 언어 산문·200자 초과·소문자 낱말이 낀 출판 정보는 인용이 아니다', () => {
  const neg = [
    'Smith et al. showed that the drug works.',          // 이니셜 없음·소문자 산문
    'Smith AB et al. showed that the drug works.',        // 이니셜은 있으나 산문
    'PMID numbers are unique identifiers.',
    'Clinical Practice',
    'Clinical Practice∗',
    'Dupont et al. ont montré un effet.',
    'Dupont JP et al. ont montré un effet net.',
    'Smith AB et al. 2019 showed benefit in adults.',    // PUB 자리에 소문자 낱말(spec "소문자 낱말 없음")
    'Lindqvist PA. J Endocr Soc. 2024;8:12.',            // 식별자 없는 저자. 학술지 — A1 아님(A2 가 본다)
    'Weekly dosing was safer [PMID: 31234567]',          // 본문 + 식별자
    'Stage III, severe disease',
    '',
    '. ; ,'
  ];
  for (const s of neg) assert.equal(isCitation(s), false, JSON.stringify(s));
  // 200자 초과는 인용으로 보지 않는다 — 같은 꼴 11번(187자)은 인용, 12번(204자)은 아님.
  const ids = (n) => Array(n).fill('[PMID: 31234567]').join(' ');
  assert.ok(ids(11).length <= CITE.MAX_UNIT_CHARS && ids(12).length > CITE.MAX_UNIT_CHARS);
  assert.equal(isCitation(ids(11)), true);
  assert.equal(isCitation(ids(12)), false);
  // 비라틴 문자 인용은 어느 꼴에도 맞지 않는다 → 읽는다(미탐 — spec 6-6-2).
  assert.equal(isCitation('كيم ج وآخرون. مجلة الطب.'), false);
});

test('T-A1 isIdOnly — 식별자만인 문장', () => {
  assert.equal(isIdOnly('[PMID: 31234567]'), true);
  assert.equal(isIdOnly('PMID 31234567.'), true);
  assert.equal(isIdOnly('Okafor N et al. [PMID: 31234567]'), false);
  assert.equal(isIdOnly('. ;'), false, '식별자가 없으면 아니다');
});

/* ══ T-A2 markReferences ═══════════════════════════════ */

const HEAD = 'Okafor N et al. Steroid tapering trial.';
const TITLE = 'A randomized study of older adults.';
const JOUR = 'Ann Rheum Dis.';
const PUBL = '2023;82:101.';

test('T-A2 ★ [머리, 제목, 학술지, 출판] 닫힘 → 넷 다 · [머리, 제목, 학술지, [PMID]] → 넷 다', () => {
  assert.deepEqual(markReferences([HEAD, TITLE, JOUR, PUBL]), [true, true, true, true]);
  assert.deepEqual(markReferences([HEAD, TITLE, JOUR, '[PMID: 31234567]']), [true, true, true, true]);
  // et al. 없는 머리 "성 이니셜. 제목…"
  assert.deepEqual(markReferences(['Lindqvist PA. Thyroid nodules in youth.', JOUR, PUBL]), [true, true, true]);
  // 머리 자신이 출판 정보로 끝나면 머리 하나
  assert.deepEqual(markReferences(['Okafor N et al. Steroid tapering in adults. Ann Rheum Dis. 2023;82:101.', 'Rest helps.']), [true, false]);
  // 앞뒤의 본문은 건드리지 않는다
  assert.deepEqual(markReferences(['Rest is advised.', HEAD, JOUR, PUBL, 'Fever resolved.']), [false, true, true, true, false]);
});

test('T-A2 ★ 닫힘이 거리·글자 밖이면 없음 · 사이에 et al. 인용이 끼면 묶음 아님 · 닫히지 않으면 읽는다', () => {
  // 머리 + 4문장 안에서 닫힘 → 묶음, 5문장째에서 닫힘 → 없음(REF_MAX_FOLLOW).
  const f = (n) => Array.from({ length: n }, (_, i) => 'Filler sentence number ' + i + '.');
  assert.equal(CITE.REF_MAX_FOLLOW, 4);
  assert.deepEqual(markReferences([HEAD, ...f(3), PUBL]), [true, true, true, true, true]);
  assert.deepEqual(markReferences([HEAD, ...f(4), PUBL]), [false, false, false, false, false, false]);
  // 400자 밖
  const long = 'A long title ' + 'with many plain words '.repeat(17) + 'here.';
  assert.ok(HEAD.length + long.length + PUBL.length > CITE.REF_MAX_CHARS);
  assert.deepEqual(markReferences([HEAD, long, PUBL]), [false, false, false]);
  // 사이에 다른 인용(A1 의 et al. 꼴) — 그 인용만 A1 로 빠지고 머리·출판은 읽는다
  assert.deepEqual(markReferences([HEAD, 'Lee K et al. Lancet.', PUBL]), [false, true, false]);
  // 닫히지 않음 — 머리 꼴이어도 읽는다
  assert.deepEqual(markReferences([HEAD, TITLE, JOUR]), [false, false, false]);
  assert.deepEqual(markReferences(['Stage III. Severe disease needs early care.', 'Treat with rest.']), [false, false]);
});

test('T-A2 ★★ "Stage III, severe …" + "[PMID]" → 머리가 쉼표로 끝나 묶음이 아니다(반례, spec 6-6-1)', () => {
  const out = markReferences(['Stage III, severe disease needs early care.', '[PMID: 31234567]']);
  assert.deepEqual(out, [false, true], '본문은 읽고, 식별자만 A1 로 빠진다');
  const out2 = markReferences(['Stage III, severe disease.', JOUR, PUBL]);
  assert.deepEqual(out2, [false, false, false]);
});

test('T-A2 다른 문단에서 닫힘 → 없음 (buildUnits 는 문단마다 판별한다)', () => {
  const paras = [para('a', [ln('a1', HEAD), ln('a2', TITLE)]), para('b', [ln('b1', PUBL), ln('b2', 'Rest is advised.')])];
  const units = buildUnits(paras, 'sentence');
  assert.ok(units.every((u) => !u.cite), units.filter((u) => u.cite).map((u) => u.src).join(' | '));
});

/* ══ T-A3 출판 정보만 + 바로 뒤 식별자 (8h-2 · spec 6-6-2 A3) ═════════ */

const PMID = '[PMID: 31234567]';

test('T-A3 isPublicationOnly — "연도;권(호):쪽[-쪽]." 꼴뿐 · 낱말 글자 0', () => {
  for (const s of ['2024;332:957.', '2023;40(2):381-9.', '2022; 17: 101–9', '2021;5(3-4):12–19.']) {
    assert.equal(isPublicationOnly(s), true, s);
  }
  for (const s of [
    'In 2024;332:957.',          // 낱말이 섞인 문장
    '2024;8:bvae033.',           // 전자 위치 — 글자가 있다
    '2021 March;12(3):45.',      // 월 전체 철자 — 넓힘(8h-3)은 약어 12개뿐
    '2023;10(Suppl 1):12.',      // 보충호 — 글자가 있다
    '2024;332.',                 // 쪽이 없다
    '2024:332:957.',             // 세미콜론이 없다
    'Rest is advised.', ''
  ]) {
    assert.equal(isPublicationOnly(s), false, s);
  }
});

test('T-A3 ★ 양성 — "2024;332:957." + "[PMID: n]" → 둘 다 cite · "2023;40(2):381-9." 꼴', () => {
  assert.deepEqual(markReferences(['Rest is advised.', '2024;332:957.', PMID]), [false, true, true]);
  assert.deepEqual(markReferences(['2023;40(2):381-9.', 'PMID 31234567.']), [true, true]);
  assert.deepEqual(publicationTails(['Rest is advised.', '2024;332:957.', PMID, 'Fever resolved.']), [1]);
  // buildUnits 에서도 — 번호를 받지 않고, 앞뒤 본문은 그대로
  const units = buildUnits([para('p', [ln('1', 'Rest is advised. 2024;332:957.'), ln('2', PMID + ' Fever resolved.')])], 'sentence');
  assert.deepEqual(units.map((u) => [u.src, !!u.cite, u.seg]), [
    ['Rest is advised.', false, 0],
    ['2024;332:957.', true, null],
    [PMID, true, null],
    ['Fever resolved.', false, 1]
  ]);
});

test('T-A3 ★ 음성 — 뒤가 식별자가 아님 · 식별자가 앞 · 사이가 떨어짐 · 뒤가 et al.+식별자', () => {
  // 출판 정보 꼴인데 뒤 문장이 본문 — 읽는다
  assert.deepEqual(markReferences(['2024;332:957.', 'Doses were halved.']), [false, false]);
  assert.deepEqual(publicationTails(['2024;332:957.', 'Doses were halved.']), []);
  // 문단 끝(뒤 문장이 없다)
  assert.deepEqual(markReferences(['Rest is advised.', '2024;332:957.']), [false, false]);
  // 식별자가 앞에 있다 — "바로 다음"만 본다
  assert.deepEqual(markReferences([PMID, '2024;332:957.']), [true, false]);
  // [Review 8h-2] 식별자가 앞에 있고 뒤가 본문 — 출판 정보가 문단 끝이 아니어도 "앞" 방향은 닫힘이 아니다
  assert.deepEqual(markReferences([PMID, '2024;332:957.', 'Doses were halved.']), [true, false, false]);
  // 사이에 본문 하나
  assert.deepEqual(markReferences(['2024;332:957.', 'Rest.', PMID]), [false, false, true]);
  // 뒤가 인용이지만 식별자만은 아니다(A1 et al.+식별자) — A3 의 닫힘은 식별자만
  assert.deepEqual(markReferences(['2024;332:957.', 'Lee K et al. Lancet. ' + PMID]), [false, true]);
});

test('T-A3 ★ 음성 — 낱말이 섞인 문장("In 2024;…") · 글자 있는 출판 정보는 식별자 앞이어도 읽는다', () => {
  assert.deepEqual(markReferences(['In 2024;332:957.', PMID]), [false, true]);
  assert.deepEqual(markReferences(['2024;8:bvae033.', PMID]), [false, true]);
  assert.deepEqual(markReferences(['2021 March;12(3):45.', PMID]), [false, true]);
});

/* ── 8h-3 A3 넓힘 (spec 6-6-2 "A3 넓힘" — 운영자 승인 2026-10-12) ── */

test('T-A3w ★ 양성 — 연도 뒤 월 약어(+일) · 콜론 바로 뒤 e+숫자, 뒤에 식별자 → 둘 다 cite', () => {
  for (const s of [
    '2021 Mar;9(3):1-9.', '2020 Nov 12;383(20):1907-19.', '2024;10:e123.',
    '2019 Jan. 5;12:45.', '2022 Sep;7:e38–360.', '2018 Dec 1;4(2):e11.'
  ]) {
    assert.equal(isPublicationOnly(s), true, s);
  }
  // [Review 8h-3] 월 약어 12개가 모두 받혀야 한다(하나가 빠져도 빨강)
  for (const m of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) {
    assert.equal(isPublicationOnly('2019 ' + m + ' 5;12(3):45–9.'), true, m);
  }
  assert.deepEqual(markReferences(['JAMA.', '2021 Mar;9(3):1-9.', PMID]), [false, true, true]);
  assert.deepEqual(markReferences(['Lancet.', '2020 Nov 12;383(20):1907-19.', 'PMID 31234567.', 'Fever resolved.']), [false, true, true, false]);
  assert.deepEqual(markReferences(['Cureus.', '2024;10:e123.', PMID]), [false, true, true]);
  const units = buildUnits([para('p', [ln('1', 'Rest is advised. 2024;10:e123.'), ln('2', PMID + ' Fever resolved.')])], 'sentence');
  assert.deepEqual(units.map((u) => [u.src, !!u.cite, u.seg]), [
    ['Rest is advised.', false, 0],
    ['2024;10:e123.', true, null],
    [PMID, true, null],
    ['Fever resolved.', false, 1]
  ]);
});

test('T-A3w ★ 음성 — 전체 철자·계절·다른 글자·월이 앞·월 꼴인데 뒤가 본문·낱말이 앞', () => {
  for (const s of [
    '2021 March;9(3):1-9.',      // 전체 철자 — 약어 12개만
    '2021 Spring;9(3):1-9.',     // 계절
    '2021 Mar 123;9(3):1-9.',    // 일이 3자리
    '2021 Mar;9(3):Mar.',        // 월 약어는 연도 바로 뒤에서만
    '2021;9(3):1-9 Mar.',
    '2024;10:x123.',             // e 말고 다른 글자
    '2024;10:E123.',             // 대문자 E
    '2024;10:e.',                // e 뒤 숫자 없음
    '2024;10:ee123.',
    '2024;e10:123.',             // 콜론 바로 뒤가 아니다(권 자리)
    '2024;10:e38–e360.',         // 범위 끝의 e 는 걷지 않는다
    '2024;10: e123.',            // 콜론 "바로" 뒤가 아니다
    '2024 e;10:123.',
    '2021 mar;9(3):1-9.',        // [Review 8h-3] 소문자 — 약어 12개의 정확한 꼴만
    '2021 MAR;9(3):1-9.',
    '2021 Mar5;9(3):1-9.'        // [Review 8h-3] 월과 일 사이 공백 필수
  ]) {
    assert.equal(isPublicationOnly(s), false, s);
  }
  assert.deepEqual(markReferences(['2021 March;9(3):1-9.', PMID]), [false, true]);
  assert.deepEqual(markReferences(['2021 Spring;9(3):1-9.', PMID]), [false, true]);
  assert.deepEqual(markReferences(['2024;10:x123.', PMID]), [false, true]);
  assert.deepEqual(markReferences(['Mar 2021 data showed a rise.', PMID]), [false, true]);
  assert.deepEqual(markReferences(['In 2021 Mar;9(3):1-9.', PMID]), [false, true]);
  // 월 꼴·전자 위치 꼴인데 뒤가 본문 — 닫힘 조건 그대로
  assert.deepEqual(markReferences(['2021 Mar;9(3):1-9.', 'Doses were halved.']), [false, false]);
  assert.deepEqual(markReferences(['2024;10:e123.', 'Doses were halved.']), [false, false]);
  assert.deepEqual(markReferences([PMID, '2020 Nov 12;383(20):1907-19.', 'Doses were halved.']), [true, false, false]);
});

test('T-A3 ★ 음성 — 다른 문단의 식별자 · 줄 단위 모드', () => {
  const two = [para('a', [ln('a1', 'Rest is advised. 2024;332:957.')]), para('b', [ln('b1', PMID + ' Fever resolved.')])];
  const units = buildUnits(two, 'sentence');
  assert.deepEqual(units.filter((u) => u.cite).map((u) => u.src), [PMID], '식별자만 A1 로 빠지고 출판 정보는 읽는다');
  const one = [para('p', [ln('1', 'Rest is advised.'), ln('2', '2024;332:957.'), ln('3', PMID)])];
  assert.deepEqual(buildUnits(one, 'sentence').filter((u) => u.cite).map((u) => u.src), ['2024;332:957.', PMID]);
  const lineUnits = buildUnits(one, 'line');
  assert.ok(lineUnits.length === 3 && lineUnits.every((u) => !('cite' in u)), '줄 모드는 판별하지 않는다');
});

/* ══ T-B splitSentences ═══════════════════════════════ */

test('T-B ★ 글머리(B1) — 중간 글머리 → 둘(글머리는 뒤 문장 머리) · 문단 첫 글머리 → 그대로 · 뒤 공백 없으면 그대로', () => {
  assert.deepEqual(splitSentences('Dosing was weekly • Doses were lower'), ['Dosing was weekly', '• Doses were lower']);
  assert.deepEqual(splitSentences('Rest helped. ▪ Fluids helped too.'), ['Rest helped.', '▪ Fluids helped too.']);
  assert.deepEqual(splitSentences('• Weekly dosing helps.'), ['• Weekly dosing helps.']);
  assert.deepEqual(splitSentences('Use a •bullet here.'), ['Use a •bullet here.']);
  for (const g of CITE.BULLETS) assert.equal(splitSentences('One ' + g + ' two').length, 2, g);
});

test('T-B ★ 식별자 괄호 끝(B2) — 대문자·[·글머리 앞은 끊고, 소문자 앞은 끊지 않는다', () => {
  assert.deepEqual(splitSentences('[PMID: 31234567] • Weekly dosing helps.'), ['[PMID: 31234567]', '• Weekly dosing helps.']);
  assert.deepEqual(splitSentences('[PMID: 31234567] Foley L et al. Lancet.'), ['[PMID: 31234567]', 'Foley L et al. Lancet.']);
  assert.deepEqual(splitSentences('[PMID: 31234567]; Foley L et al.'), ['[PMID: 31234567];', 'Foley L et al.']);
  assert.deepEqual(splitSentences('[PMID: 31234567] [PMID: 32345678]'), ['[PMID: 31234567]', '[PMID: 32345678]']);
  assert.deepEqual(splitSentences('[PMID: 31234567] weakness was noted.'), ['[PMID: 31234567] weakness was noted.']);
  // 식별자가 아닌 괄호는 그대로(8h 이전과 같다)
  assert.deepEqual(splitSentences('[Note] Values vary.'), ['[Note] Values vary.']);
});

test('T-B fr·ko 표로도 같은 결과 · 공백 하나로 되붙는 계약', () => {
  const cases = [
    'Dosing was weekly • Doses were lower',
    '[PMID: 31234567] • Weekly dosing helps.',
    '[PMID: 31234567] Foley L et al. Lancet.',
    '[PMID: 31234567] weakness was noted.'
  ];
  for (const s of cases) {
    const base = splitSentences(s);
    assert.deepEqual(splitSentences(s, { lang: 'fr' }), base, 'fr: ' + s);
    assert.deepEqual(splitSentences(s, { lang: 'ko' }), base, 'ko: ' + s);
    assert.equal(base.join(' '), s);
  }
});

/* 7c 이전(=8h 이전)의 `splitSentences` — 글자 그대로의 사본(tests/srclang-7c.test.mjs 의 legacySplit 과 같다). 바꾸지 마라. */
function legacySplit(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = [];
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    let j = i + 1;
    while (j < t.length && '"”\')]'.indexOf(t[j]) >= 0) j++;
    if (j >= t.length) break;
    if (t[j] !== ' ') continue;
    const head = t.slice(start, j);
    if (!endsSentence(head)) continue;
    const next = t[j + 1];
    if (!next) break;
    if (!/[A-Z0-9(\[«"“']/.test(next)) continue;
    out.push(head.trim());
    start = j + 1;
  }
  const tail = t.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** 문장 목록 → 경계(다음 문장의 시작 오프셋) 집합. 공백 하나로 되붙는다는 계약 위에서. */
function cuts(parts) {
  const out = new Set();
  let at = 0;
  for (let i = 0; i < parts.length - 1; i++) { at += parts[i].length + 1; out.add(at); }
  return out;
}

const ID_END = /\[\s*(?:PMID|PMCID|DOI)\b[^\[\]]*\][.;,]?$/i;

test('T-B4 ★★ E1 대조 — 8h 이전 사본 대비 바뀐 문장은 전부 B1·B2 경계를 품는다(경계를 더하기만 한다)', () => {
  const corpus = [
    // 7c E1 코퍼스(바뀌면 안 된다)
    'Fever was noted in 3 of 10 cases. It resolved.',
    'Dr. Kim saw the patient at 9 a.m. today. The rash was gone.',
    'The dose was 2.5 mg. (See Table 4.) Repeat in 6 h.',
    'J. R. Smith et al. described it. The cohort was small.',
    'Lower case after period. and it continues. «Quoted» start. [Bracket] start.',
    // B 가 바꾸는 것
    'Weekly dosing helped. [PMID: 31234567] • Weekly use was safer.',
    'Okafor N et al. Ann Rheum Dis. 2023;82:101. [PMID: 31234567] Foley L et al. Steroid use.',
    'Items: • first item • second item • third.',
    '[PMID: 31234567]; Okafor N et al. [PMID: 32345678] weakness noted.',
    'Rest helped [DOI: 10.1000/x1] [PMID: 31234567]. Then fluids.',
    '• Leading bullet stays. ■ But a middle one splits.'
  ];
  let changed = 0;
  for (const s of corpus) {
    const t = s.replace(/\s+/g, ' ').trim();
    const old = legacySplit(s);
    const now = splitSentences(s);
    assert.equal(now.join(' '), t, '되붙기: ' + s);
    const oc = cuts(old);
    const nc = cuts(now);
    for (const c of oc) assert.ok(nc.has(c), '옛 경계가 사라졌다 @' + c + ': ' + s);
    if (nc.size !== oc.size) changed++;
    for (const c of nc) {
      if (oc.has(c)) continue;
      const before = t.slice(0, c - 1);
      const after = t.slice(c);
      const b1 = CITE.BULLETS.indexOf(after[0]) >= 0 && after[1] === ' ';
      const b2 = ID_END.test(before);
      assert.ok(b1 || b2, '새 경계가 B1·B2 가 아니다 @' + c + ': …' + before.slice(-20) + ' | ' + after.slice(0, 20));
    }
  }
  assert.ok(changed >= 5, 'B 픽스처가 실제로 경계를 더한다: ' + changed);
});

/* ══ T-C speechMarks ══════════════════════════════════ */

test('T-C ★ 각주 기호 — 지울 자리와 피연산자 자리', () => {
  assert.equal(speechMarks('Clinical Practice∗'), 'Clinical Practice');
  assert.equal(speechMarks('∗See chapter 12.'), 'See chapter 12.');
  assert.equal(speechMarks('gonorrhea,∗ syphilis'), 'gonorrhea, syphilis');
  assert.equal(speechMarks('hyper- ∗ sensitivity'), 'hyper- sensitivity');
  assert.equal(speechMarks('the “flare”† pattern'), 'the “flare” pattern');
  assert.equal(speechMarks('Data from trials.‡'), 'Data from trials.');
  assert.equal(speechMarks('See § 4 below.'), 'See 4 below.');
  assert.equal(speechMarks('HLA-B∗58:01'), 'HLA-B*58:01');
  assert.equal(speechMarks('HLA-B∗58:01 carriers'), 'HLA-B*58:01 carriers');
  assert.equal(speechMarks('STAR*D'), 'STAR*D');
  assert.equal(speechMarks('2 * 3'), '2 * 3');
  assert.equal(speechMarks('mg*h/L'), 'mg*h/L');
  assert.equal(speechMarks('no marks here  at all'), 'no marks here  at all', '기호가 없으면 입력 그대로(공백도)');
  // 원문 발화 첫 단계
  assert.equal(normalizeSpeech('Clinical Practice∗'), 'Clinical Practice');
  assert.equal(normalizeSpeech('HLA-B∗58:01 ≥ 2'), 'HLA-B*58:01 greater than or equal to 2');
});

test('T-C ★ 번역문 발화 끝 단계 — 아랍어 번역문 끝의 ∗ 를 지운다(화면 글은 그대로)', () => {
  assert.equal(trSpeechText('الممارسة السريرية∗'), 'الممارسة السريرية');
  assert.equal(trSpeechText('النمط HLA-B∗58:01 مهم'), 'النمط HLA-B*58:01 مهم');
  assert.equal(trSpeechText('التهاب (C-reactive protein)∗ مرتفع'), 'التهاب مرتفع');
});

test('T-C ★★ src 불변 — 캐시 키를 앞뒤로 계산해 같다(기호는 발화 사본에서만 정리한다)', async () => {
  const raw = 'Key advances in Clinical Practice∗';
  const raw2 = 'Testing for HLA-B∗58:01 is advised.';
  const units = buildUnits([para('p', [ln('1', raw), ln('2', raw2)])], 'sentence');
  assert.equal(units.length, 1, '마침표가 없어 한 문장');
  const u = units[0];
  const src = raw + ' ' + raw2;
  assert.equal(u.src, src, 'src 는 화면 글자 그대로');
  assert.ok(u.src.indexOf('∗') >= 0);
  assert.equal(u.text, 'Key advances in Clinical Practice Testing for HLA-B*58:01 is advised.');
  assert.equal(await keyFor('doc', u.src, 'ar', 'readalong'), await keyFor('doc', src, 'ar', 'translate'));
  const s = sentencesOf(units);
  assert.equal(s[0].src, src);
});

/* ══ T-U buildUnits ═══════════════════════════════════ */

test('T-U ★ 인용 단위는 cite:true · seg:null — 앞뒤 본문 번호는 당겨진다', () => {
  const paras = [para('p1', [
    ln('1:1', 'Weekly dosing helped. [PMID: 31234567]'),
    ln('1:2', '• Fluids helped too.'),
    ln('1:3', HEAD + ' ' + TITLE + ' ' + JOUR + ' ' + PUBL),
    ln('1:4', 'Rest is advised.')
  ])];
  const units = buildUnits(paras, 'sentence');
  const view = units.map((u) => [u.src, !!u.cite, u.seg]);
  assert.deepEqual(view, [
    ['Weekly dosing helped.', false, 0],
    ['[PMID: 31234567]', true, null],
    ['• Fluids helped too.', false, 1],
    [HEAD, true, null],
    [TITLE, true, null],
    [JOUR, true, null],
    [PUBL, true, null],
    ['Rest is advised.', false, 2]
  ]);
  for (const u of units) if (!u.cite) assert.ok(!('cite' in u), '인용이 아닌 단위에는 속성이 없다');
  // 번역 입력에서 빠진다
  assert.deepEqual(sentencesOf(units).map((s) => s.src), ['Weekly dosing helped.', '• Fluids helped too.', 'Rest is advised.']);
});

test('T-U 300자 조각으로 나뉜 인용 문장 — 조각 전부 cite · 줄 모드에는 cite 가 없다', () => {
  const longTitle = 'A ' + 'very long and plain descriptive title, '.repeat(8) + 'end.';
  assert.ok(longTitle.length > 300 && HEAD.length + longTitle.length + PUBL.length <= CITE.REF_MAX_CHARS);
  const paras = [para('p', [ln('a', HEAD), ln('b', longTitle), ln('c', PUBL)])];
  const units = buildUnits(paras, 'sentence');
  const parts = units.filter((u) => u.src === longTitle);
  assert.ok(parts.length >= 2, '조각 ' + parts.length);
  assert.ok(units.every((u) => u.cite === true && u.seg === null));
  assert.equal(sentencesOf(units).length, 0);
  const lineUnits = buildUnits(paras, 'line');
  assert.ok(lineUnits.length > 0 && lineUnits.every((u) => !('cite' in u)), '줄 모드는 판별하지 않는다');
  // 표 안내 문단은 판별하지 않는다
  const notice = buildUnits([para('tablenotice:1:r0', [ln('n', '[PMID: 31234567]')], 'table-notice')], 'sentence');
  assert.ok(notice.every((u) => !('cite' in u)));
});

test('T-U ★★ 불변 대조 — 인용·글머리·기호가 없는 픽스처는 8h 전과 JSON 이 같다(8h 이전 HEAD 출력의 지문)', () => {
  // 지문은 8h 이전 `js/tts/text.js`(커밋 740a3cd)로 같은 픽스처를 돌려 얻은 sha256(JSON.stringify(buildUnits(…))).
  const LONG = 'The committee compared several regimens across many centers, including older agents, newer biologic agents, and combined approaches, while tracking laboratory markers, imaging findings, functional scores, and the frequency of adverse events over a follow-up period that, in some cohorts, extended well beyond the original window.';
  const paras = [
    para('p1', [ln('1:1', 'continued from before. Dr. Kim reviewed the'), ln('1:2', 'chart, e.g. Temperature and pulse, and noted a cardio-', 'hidden'), ln('1:3', 'vascular risk of ≥ 20% in 3 of 10 cases.')]),
    para('p2', [ln('2:1', LONG)]),
    para('p3', [ln('3:1', 'Treatment Options')], 'heading'),
    para('p4', [ln('4:1', 'See www.example.org for more. Smith et al. showed'), ln('4:2', 'that rest helps (Lee, 2020). [Note] Values vary.')]),
    para('tablenotice:5:r0', [ln('n1', 'Table skipped.')], 'table-notice'),
    para('p5', [ln('5:1', 'The final sentence continues on the')])
  ];
  const WANT = {
    'en sentence': 'ab3e62c7c1e1b741dd8fe1aff93d4d24ae06bc70c45363445e7e45fe7f9f4ff6',
    'en line': 'c936b39e9cb872f4a87bfd2fbba2032a3d3008a3cc1f8323b7d50515b94f0e9b',
    'fr sentence': '64db5fee6b51bddc689013f7e7c0634409d93a707a5c7e9be89e979da90f62e5',
    'fr line': '0e522db2aa538c096434e19a44d6bcb5d485bce9ea179b5f55d65c6845ff0d5b',
    'ko sentence': '64db5fee6b51bddc689013f7e7c0634409d93a707a5c7e9be89e979da90f62e5',
    'ko line': '0e522db2aa538c096434e19a44d6bcb5d485bce9ea179b5f55d65c6845ff0d5b'
  };
  for (const lang of ['en', 'fr', 'ko']) {
    for (const unit of ['sentence', 'line']) {
      const j = JSON.stringify(buildUnits(paras, unit, { lang: lang }));
      assert.equal(createHash('sha256').update(j).digest('hex'), WANT[lang + ' ' + unit], lang + ' ' + unit);
    }
  }
});

/* ══ T-S speaker ═══════════════════════════════════════ */

function fakeTimers() {
  let now = 0;
  let seq = 1;
  const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null; let key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key); now = pick.at; pick.fn();
      }
      now = target;
    }
  };
}

function fakeSynth() {
  const s = {
    speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    texts() { return s.utt.map((u) => u.text); }
  };
  return s;
}

const A = 'Alpha is first here.';
const C = '[PMID: 31234567]';
const B = 'Bravo comes second.';
const pageABC = () => [para('p1', [ln('1:0', A), ln('1:1', C), ln('1:2', B)])];

/** 쪽 여러 개를 가진 화면 스텁. `pages[n]` = 그 쪽 문단. */
function makeView(pages) {
  let page = 1;
  const v = {
    shown: [],
    paras: () => pages[page] || [],
    page: () => ({ page: page, pageCount: Object.keys(pages).length }),
    goToPage: (n) => { if (!pages[n]) return Promise.resolve(false); page = n; return Promise.resolve(true); },
    show: (u) => { v.shown.push(u.src); return true; },
    markDone: () => { },
    lineOrder: () => (pages[page] || []).flatMap((p) => p.lines.map((l) => l.id))
  };
  return v;
}

function fakeTr(initial) {
  const m = new Map(Object.entries(initial || {}));
  return { get: (u) => Object.assign({}, m.get(u.src) || { state: 'none' }), onChange: () => () => { } };
}

function rigSpeaker(o) {
  const opts = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const view = makeView(opts.pages || { 1: pageABC() });
  let readCites = !!opts.readCitations;
  const sp = createSpeaker({
    synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }), view: view,
    translation: opts.tr || null, requestWakeLock: () => Promise.resolve(null),
    readCitations: () => readCites
  });
  const queues = [];
  sp.addEventListener('queue', (ev) => queues.push(ev.detail));
  sp.setDocLang('en-US');
  sp.setTrVoice('ar-SA', null);
  sp.setReadalong({ mode: opts.mode || 'off' });
  return { sp, synth, timers, view, queues, setRead: (v) => { readCites = v; } };
}

const flush = async (n) => { for (let i = 0; i < (n || 10); i++) await new Promise((r) => setImmediate(r)); };

test('T-S ★ 기본 — 큐 [본문, 인용, 본문] 에서 발화 2개(인용 없음), 진행 표시 분모도 2', () => {
  const h = rigSpeaker();
  h.sp.play();
  assert.equal(h.sp.getTotal(), 2);
  h.synth.finish(); h.synth.finish();
  assert.deepEqual(h.synth.texts(), [A, B]);
  assert.ok(h.view.shown.indexOf(C) < 0, '인용 줄은 칠하지 않는다');
  assert.equal(h.sp.getReadCitations(), false);
});

test('T-S ★ readCitations=true — 발화 3개, 인용은 원서 언어, 번역문 단계 없음(speak 모드)', () => {
  const tr = fakeTr({ [A]: { state: 'ready', text: 'ترجمة أ' }, [B]: { state: 'ready', text: 'ترجمة ب' }, [C]: { state: 'ready', text: 'لا' } });
  const h = rigSpeaker({ readCitations: true, mode: 'speak', tr: tr });
  h.sp.play();
  for (let i = 0; i < 5; i++) h.synth.finish();
  assert.deepEqual(h.synth.texts(), [A, 'ترجمة أ', C, B, 'ترجمة ب']);
  const citeUtt = h.synth.utt[2];
  assert.equal(citeUtt.lang, 'en-US');
  assert.equal(h.sp.getReadCitations(), true);
});

test('T-S 설정은 큐를 만들 때마다 읽는다 — 다음 재생부터 따른다', () => {
  const h = rigSpeaker();
  h.sp.play();
  assert.equal(h.sp.getTotal(), 2);
  h.sp.stop();
  h.setRead(true);
  h.sp.play();
  assert.equal(h.sp.getTotal(), 3);
});

test('T-S ★ 인용 줄 탭 → 그 뒤의 첫 본문부터 · 쪽 끝 인용 줄 탭 → 다음 쪽', async () => {
  const h = rigSpeaker();
  h.sp.play();
  h.sp.pause();
  h.sp.play('1:1');                              // 인용 줄
  assert.equal(h.synth.current.text, B);
  assert.equal(indexAtOrAfterLine([{ lineIds: ['x'] }], 'zz', ['x']), -1, '줄 순서에 없는 줄은 -1');

  const pages = { 1: [para('p1', [ln('1:0', A), ln('1:1', C)])], 2: [para('p2', [ln('2:0', B)])] };
  const g = rigSpeaker({ pages: pages });
  g.sp.play();
  g.sp.pause();
  g.sp.play('1:1');                              // 쪽의 마지막 줄이 인용
  await flush();
  assert.equal(g.synth.current && g.synth.current.text, B);
  assert.equal(g.view.page().page, 2);
});

test('T-S ★ 인용뿐인 쪽 → 다음 쪽 (재생 시작에서도, 쪽 넘김 중에도)', async () => {
  const pages = {
    1: [para('p1', [ln('1:0', A)])],
    2: [para('p2', [ln('2:0', C), ln('2:1', 'Okafor N et al. Ann Rheum Dis.')])],
    3: [para('p3', [ln('3:0', B)])]
  };
  const h = rigSpeaker({ pages: pages });
  h.sp.play();
  h.synth.finish();                              // A 끝 → 2쪽(인용뿐) → 3쪽
  await flush();
  assert.equal(h.view.page().page, 3);
  assert.deepEqual(h.synth.texts(), [A, B]);

  const pages2 = { 1: [para('p1', [ln('1:0', C)])], 2: [para('p2', [ln('2:0', B)])] };
  const g = rigSpeaker({ pages: pages2 });
  g.sp.play();                                   // 인용뿐인 쪽에서 재생 → 끝내지 않고 넘긴다
  await flush();
  assert.equal(g.view.page().page, 2);
  assert.deepEqual(g.synth.texts(), [B]);
});

test('T-S ★ 구간 반복이 인용을 밟지 않는다', () => {
  const h = rigSpeaker();
  h.sp.play();
  h.sp.setRepeat('range', 2);
  h.sp.setRepeatEdge('from');
  h.synth.finish();                              // A 끝 → B
  h.sp.setRepeatEdge('to');
  h.synth.finish();                              // B 끝 → 구간 처음(A)
  h.synth.finish(); h.synth.finish();
  assert.deepEqual(h.synth.texts(), [A, B, A, B]);
  assert.ok(h.synth.texts().indexOf(C) < 0);
});

/* ══ T-R readalong ═════════════════════════════════════ */

function autoPipeline() {
  const calls = [];
  const fns = new Set();
  return {
    calls: calls,
    state: () => STATES.READY,
    onState: (fn) => { fns.add(fn); return () => fns.delete(fn); },
    retry: async () => STATES.READY,
    translate: (segs, ctx) => {
      calls.push({ segs: segs.map((s) => s.text), ctx: ctx });
      return Promise.resolve({ status: STATES.READY, calls: 1, results: segs.map((s) => ({ state: 'ready', text: 'TR(' + s.text + ')' })) });
    }
  };
}

function rigRa() {
  const pipeline = autoPipeline();
  const ra = createReadalong({
    pipeline: pipeline,
    cache: { getMany: async () => new Map() },
    getSetting: (k) => (k === 'ai.maxReqChars' ? 6000 : undefined),
    saveReadStats: async () => { },
    loadParas: async () => null
  });
  ra.setDoc({ docId: 'doc1', lang: 'en', target: 'ar', pageCount: 1 });
  ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr', 'ko'], targetLang: 'ar', unit: 'sentence', hasKey: true });
  ra.setActive(true);
  return { ra, pipeline };
}

const RA_PAGE = () => [para('p1', [
  ln('1:0', 'Weekly dosing helped most adults. [PMID: 31234567]'),
  ln('1:1', HEAD + ' ' + TITLE + ' ' + JOUR + ' ' + PUBL),
  ln('1:2', 'Garcia LM et al. J Clin Hypertens. Rest is advised for all.')
])];

test('T-R ★ 요청 묶음에 인용 src 0 · readStats 글자에 인용 없음', async () => {
  const units = buildUnits(RA_PAGE(), 'sentence');
  const cites = units.filter((u) => u.cite).map((u) => u.src);
  assert.ok(cites.length >= 5, '픽스처에 인용이 있다: ' + cites.length);
  const { ra, pipeline } = rigRa();
  ra.onQueue(1, units, 0);
  await flush(30);
  const sent = pipeline.calls.flatMap((c) => c.segs);
  assert.ok(sent.length >= 2, '본문은 요청된다');
  for (const s of sent) assert.ok(cites.indexOf(s) < 0, '인용이 요청에 들어갔다: ' + s);
  const bodyChars = sentencesOf(units).reduce((n, s) => n + [...s.src].length, 0);
  assert.deepEqual(ra.readStats(), { pages: 1, chars: bodyChars });
});

test('T-R ★ RA-C1 — 거른 큐와 안 거른 큐의 onQueue 흐름이 같다(sentencesOf 가 같다)', async () => {
  const all = buildUnits(RA_PAGE(), 'sentence');
  const filtered = all.filter((u) => !u.cite);
  assert.deepEqual(sentencesOf(filtered), sentencesOf(all));
  const r1 = rigRa();
  const r2 = rigRa();
  r1.ra.onQueue(1, all, 0);
  r2.ra.onQueue(1, filtered, 0);
  await flush(30);
  assert.deepEqual(r2.pipeline.calls.map((c) => c.segs), r1.pipeline.calls.map((c) => c.segs));
  assert.deepEqual(r2.ra.readStats(), r1.ra.readStats());
});

/* ══ 설정 · i18n · grep ════════════════════════════════ */

test('설정 tts.readCitations — 기본 false, 4개 언어 문구', () => {
  assert.equal(settings.defaultFor('tts.readCitations'), false);
  assert.ok(settings.KEYS.indexOf('tts.readCitations') >= 0);
  for (const dict of [en, ar, fr, ko]) {
    assert.equal(typeof dict['settings.tts.readCitations'], 'string');
    assert.equal(typeof dict['settings.tts.readCitations.help'], 'string');
  }
});

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('grep ★ splitSentences 호출은 여전히 tts/text.js 한 곳 · text/cite.js 는 순수(주석 포함 document·window 0)', () => {
  const callers = walk(JS).filter((p) => /\bsplitSentences\s*\(/.test(readFileSync(p, 'utf8')))
    .map((p) => p.slice(JS.length + 1).replace(/\\/g, '/')).sort();
  assert.deepEqual(callers, ['text/segment.js', 'tts/text.js']);
  const cite = readFileSync(join(JS, 'text', 'cite.js'), 'utf8');
  assert.ok(!/\b(document|window)\b/.test(cite), 'cite.js 에 document·window 가 있다');
  assert.ok(!/\bsplitSentences\s*\(/.test(cite) && !/from '\.\/segment\.js'/.test(cite), 'cite.js 는 문장을 나누지 않는다');
  // speaker 는 buildUnits 를 queueOf 한 곳에서만 부른다(네 곳이 거르기를 함께 지난다)
  const sp = readFileSync(join(JS, 'tts', 'speaker.js'), 'utf8');
  assert.equal((sp.match(/\bbuildUnits\s*\(/g) || []).length, 1);
});
