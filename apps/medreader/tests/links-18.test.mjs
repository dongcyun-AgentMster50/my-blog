/* ============================================================
   tests/links-18.test.mjs — 18 의료 사이트 북마크 + 검색어 바로가기 (spec 17-9 4 수용 기준 `[N]`)

     L1 checkLink — https 만 · userinfo 거절 · 이름 1–60 · 주소 ≤ 2,000 · 31번째 too-many · `{q}` 두 번 ok · 호스트 안 `{q}` 거절
     L2 fillQuery — encodeURIComponent(`&`·`=`·`#`) · 아랍어·한글 · 넣은 뒤 다시 checkLink 통과 · `{q}` 없으면 그대로
     L3 queryText — 구두점·공백 정리 · 7낱말·61자 → null · 8c-1 `clampSelection` 과 **같은 상수**(SEL_LIMIT)
     L4 기본 목록 — null → LINKS.DEFAULTS · 배열 → 그 배열(빈 배열 = 목록 없음) · 기본 넷 checkLink ok·hasQuery · 이상한 항목 걸러냄
     L5 ★ 순수(16-A) — text/links.js 는 브라우저 전역 0, `URL` 은 허용 줄 둘에서만(결정 18-D6 (가))
     L6 lookupPlan — 링크 0·1·2 · 흐림 · 여는 주소는 다시 검사 통과
     L7 목록 편집 — move·remove·upsert·newLinkId · homeUrl · hostOf
     L8 ★ 새 탭 속성 한 곳 `armAnchor` — target=_blank · rel="noopener noreferrer" · referrerPolicy=no-referrer
     L9 선택 줄 — SEL_ACTIONS 넷째 `lookup`(when:'links') · selBarModel 숨김·흐림·문구 키
     L10 설정 키·화면 배선(grep) — innerHTML·window.open·confirm()·fetch 0 · [찾아보기]가 controls 보다 먼저 연다 · index.html 그릇 · i18n
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LINKS } from '../js/config.js';
import {
  checkLink, hasQuery, fillQuery, queryText, effectiveLinks, queryLinks, homeUrl, hostOf, lookupPlan,
  newLinkId, moveLink, removeLink, upsertLink, LINK_CODES
} from '../js/text/links.js';
import { SEL_LIMIT, clampSelection } from '../js/text/select.js';
import { DEFAULTS as SET_DEFAULTS, readValue, _setCacheForTest } from '../js/settings.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';

const { armAnchor, LINK_REL, currentLinks, queryLinkCount, ERR_KEYS, LINKS_KEY } = await import('../js/ui/links.js');
const { SEL_ACTIONS, selBarModel, showAction } = await import('../js/ui/selbar.js');

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('L1 checkLink — https·userinfo·이름·길이·개수·{q} 두 번', () => {
  const ok = (name, url, o) => checkLink({ name, url }, o);
  assert.deepEqual(ok('A', 'https://a.b/x?q={q}'), { ok: true, code: null, name: 'A', url: 'https://a.b/x?q={q}' });
  assert.equal(ok('A', 'http://a.b/x?q={q}').code, 'url-not-https');
  assert.equal(ok('A', 'javascript:alert(1)').code, 'url-not-https');
  assert.equal(ok('A', 'data:text/html,hi').code, 'url-not-https');
  assert.equal(ok('A', 'https://u:p@a.b/').code, 'url-userinfo');
  assert.equal(ok('A', 'https://u@a.b/').code, 'url-userinfo');
  assert.equal(ok('A', 'https://:p@a.b/').code, 'url-userinfo');
  assert.equal(ok('', 'https://a.b/').code, 'name-empty');
  assert.equal(ok('   ', 'https://a.b/').code, 'name-empty');
  assert.equal(ok('가'.repeat(60), 'https://a.b/').ok, true, '60자는 된다(코드 포인트)');
  assert.equal(ok('x'.repeat(61), 'https://a.b/').code, 'name-long');
  assert.equal(ok('😀'.repeat(60), 'https://a.b/').ok, true, '이모지 60개 = 60 코드 포인트');
  const base = 'https://a.b/?q=';
  assert.equal(ok('A', base + 'x'.repeat(2000 - base.length)).ok, true, '2,000자는 된다');
  assert.equal(ok('A', base + 'x'.repeat(2001 - base.length)).code, 'url-long');
  assert.equal(ok('A', 'https://a.b/', { count: 29 }).ok, true);
  assert.equal(ok('A', 'https://a.b/', { count: 30 }).code, 'too-many', '31번째');
  assert.equal(ok('A', 'https://a.b/x?q={q}&r={q}').ok, true, '{q} 두 번');
  assert.equal(ok('A', 'a.b/x').code, 'url-bad', '스킴 없는 주소');
  assert.equal(ok('A', '').code, 'url-bad');
  assert.equal(ok('A', 'https://a.b/\nx').code, 'url-bad', '제어 문자');
  assert.equal(ok('A', 'https://{q}.evil.example/').code, 'url-bad', '{q} 가 호스트에 — 검색어가 다른 사이트 주소가 되면 안 된다');
  assert.equal(ok('A', 'https://a.b:{q}/').code, 'url-bad', '{q} 가 포트에');
  assert.equal(ok('  A  ', '  https://a.b/  ').name, 'A', '앞뒤 공백을 뗀 값');
  assert.equal(ok('A', 'HTTPS://A.B/').ok, true, '스킴 대문자');
  assert.deepEqual(Object.values(LINK_CODES).sort(), Object.keys(ERR_KEYS).sort(), '코드마다 문구 키');
});

test('L2 fillQuery — encodeURIComponent · 아랍어·한글 · 다시 checkLink 통과 · {q} 없으면 그대로', () => {
  assert.equal(fillQuery('https://a.b/?q={q}', 'a&b=c#d'), 'https://a.b/?q=a%26b%3Dc%23d');
  assert.equal(fillQuery('https://a.b/?q={q}', 'a b'), 'https://a.b/?q=a%20b');
  assert.equal(fillQuery('https://a.b/?q={q}', 'ربو'), 'https://a.b/?q=' + encodeURIComponent('ربو'));
  assert.equal(fillQuery('https://a.b/?q={q}', '천식'), 'https://a.b/?q=%EC%B2%9C%EC%8B%9D');
  assert.equal(fillQuery('https://a.b/?q={q}&x={q}', 'k'), 'https://a.b/?q=k&x=k');
  assert.equal(fillQuery('https://a.b/home', 'k'), 'https://a.b/home', '{q} 없는 주소는 그대로');
  assert.equal(fillQuery('https://a.b/?q={q}', '\ud800'), null, '짝 잃은 서로게이트');
  for (const l of LINKS.DEFAULTS) {
    for (const q of ['a&b=c#d', 'ربو', '천식', 'rheumatoid arthritis', '../x?y']) {
      assert.equal(checkLink({ name: l.name, url: fillQuery(l.url, q) }).ok, true, l.id + ' · ' + q);
    }
  }
});

test('L3 queryText — 정리 · 6낱말·60자 경계가 8c-1 clampSelection 과 같은 상수', () => {
  assert.equal(queryText('  (sarcoidosis),  '), 'sarcoidosis');
  assert.equal(queryText('rheumatoid\n  arthritis.'), 'rheumatoid arthritis');
  assert.equal(queryText('«الربو»'), 'الربو');
  assert.equal(queryText('ﬁbrosis'), 'fibrosis', 'NFKC 합자');
  assert.equal(queryText('cardio­vascular'), 'cardiovascular', '숨은 하이픈');
  assert.equal(queryText('...'), null);
  assert.equal(queryText(''), null);
  assert.equal(queryText(null), null);
  assert.equal(queryText('a b c d e f'), 'a b c d e f');
  assert.equal(queryText('a b c d e f g'), null, '7낱말');
  assert.equal(queryText('x'.repeat(60)), 'x'.repeat(60));
  assert.equal(queryText('x'.repeat(61)), null, '61자');
  assert.equal(SEL_LIMIT.WORDS, 6); assert.equal(SEL_LIMIT.CHARS, 60);
  // 같은 상수 — 정리된 글자에서 두 함수의 판정이 같다.
  for (const s of ['a b c d e f', 'a b c d e f g', 'x'.repeat(60), 'x'.repeat(61), 'heart failure with preserved ejection fraction']) {
    assert.equal(queryText(s) === null, clampSelection(s).tooLong, s.slice(0, 20));
  }
  const t = src('../js/text/links.js');
  assert.match(t, /import \{ SEL_LIMIT \} from '\.\/select\.js';/, '★ 8c-1 상수를 읽는다(사본 숫자 아님)');
  assert.match(t, /words > SEL_LIMIT\.WORDS \|\| chars > SEL_LIMIT\.CHARS/);
});

test('L4 기본 목록 — null → DEFAULTS · 배열은 그대로(빈 배열 = 없음) · 기본 넷 ok·hasQuery · 이상한 항목 거름', () => {
  const d = effectiveLinks(null);
  assert.deepEqual(d.map((l) => l.id), ['medlineplus', 'pubmed', 'wikipedia-en', 'dailymed']);
  assert.deepEqual(d, LINKS.DEFAULTS.map((l) => ({ id: l.id, name: l.name, url: l.url })));
  assert.deepEqual(effectiveLinks(undefined).length, 4);
  assert.deepEqual(effectiveLinks([]), [], '빈 배열은 기본으로 돌아가지 않는다');
  const mine = [{ id: 'u1', name: 'Mine', url: 'https://x.example/s?q={q}' }];
  assert.deepEqual(effectiveLinks(mine), mine);
  for (const l of LINKS.DEFAULTS) {
    assert.equal(checkLink(l).ok, true, l.id);
    assert.equal(hasQuery(l.url), true, l.id);
    assert.ok(l.url.startsWith('https://'), l.id);
  }
  // 가져오기·옛 판이 넣은 이상한 값은 href 가 되지 않는다.
  const bad = [null, 'x', { id: 'a', name: 'J', url: 'javascript:alert(1)' }, { id: 'b', name: 'U', url: 'https://u:p@a.b/' },
    { id: 'c', name: '', url: 'https://a.b/' }, { id: 'c', name: 'C', url: 'https://c.example/' }, { id: 'c', name: 'C2', url: 'https://c2.example/' }];
  const got = effectiveLinks(bad);
  assert.deepEqual(got.map((l) => l.name), ['C', 'C2']);
  assert.notEqual(got[0].id, got[1].id, 'id 겹침 없음');
  assert.deepEqual(effectiveLinks({ not: 'array' }), []);
  const many = Array.from({ length: 40 }, (_, i) => ({ id: 'm' + i, name: 'M' + i, url: 'https://m' + i + '.example/' }));
  assert.equal(effectiveLinks(many).length, LINKS.MAX);
  // 추천 목록: 기본에 없다 · 모두 [확인 필요] · 유료는 UpToDate 하나 · `[다듬기 5 — 19 링크만]` Open-i 한 줄
  assert.deepEqual(LINKS.SUGGESTED.map((s) => s.id), ['msd-pro', 'radiopaedia', 'ncbi-bookshelf', 'uptodate', 'openi']);
  for (const s of LINKS.SUGGESTED) {
    assert.equal(checkLink(s).ok, true, s.id);
    assert.equal(s.check, 'unverified', s.id);
    assert.ok(!LINKS.DEFAULTS.some((x) => x.url === s.url), s.id + ' 는 기본에 없다');
  }
  assert.deepEqual(LINKS.SUGGESTED.filter((s) => s.paid).map((s) => s.id), ['uptodate']);
  // 화면 쪽 읽기도 같은 길(설정 메모리)
  _setCacheForTest({});
  assert.equal(currentLinks().length, 4);
  assert.equal(queryLinkCount(), 4);
  _setCacheForTest({ 'links.medical': [] });
  assert.equal(currentLinks().length, 0);
  assert.equal(queryLinkCount(), 0);
  _setCacheForTest({ 'links.medical': [{ id: 'h', name: 'Home', url: 'https://h.example/' }] });
  assert.equal(currentLinks().length, 1);
  assert.equal(queryLinkCount(), 0, '{q} 없는 링크만이면 [찾아보기] 없음');
  _setCacheForTest({});
});

test('L5 ★ 순수(16-A) — text/links.js 는 브라우저 전역 0 · URL 은 허용 줄에서만(결정 18-D6 (가) · spec 3-2 예외)', () => {
  const code = src('../js/text/links.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const banned = /\b(document|window|globalThis|self|navigator|fetch|XMLHttpRequest|indexedDB|localStorage|sessionStorage|location|crypto|Date)\b/;
  const hits = code.split('\n').filter((l) => banned.test(l));
  assert.deepEqual(hits, []);
  // 16-A 허용 한 줄 — `URL` 은 존재 검사와 생성, 이 둘만.
  const ALLOWED_URL_LINES = [
    "if (typeof URL !== 'function') return null;",
    'try { return new URL(String(url).split(Q).join(fill)); } catch (e) { return null; }'
  ];
  const urlLines = code.split('\n').map((l) => l.trim()).filter((l) => /\bURL\b/.test(l));
  assert.deepEqual(urlLines, ALLOWED_URL_LINES);
  const imports = code.match(/from '([^']+)'/g) || [];
  assert.deepEqual(imports, ["from '../config.js'", "from './select.js'"], 'config·text/* 만 import');
});

test('L6 lookupPlan — 링크 0·1·2 · 흐림 · 여는 주소는 다시 검사 통과', () => {
  const two = [{ id: 'a', name: 'A', url: 'https://a.example/?q={q}' }, { id: 'h', name: 'H', url: 'https://h.example/' },
    { id: 'b', name: 'B', url: 'https://b.example/s/{q}' }];
  assert.deepEqual(lookupPlan([], 'asthma'), { show: false, query: 'asthma', targets: [] });
  assert.deepEqual(lookupPlan([two[1]], 'asthma').show, false, '{q} 없는 링크만');
  const one = lookupPlan([two[0], two[1]], ' asthma, ');
  assert.equal(one.show, true);
  assert.deepEqual(one.targets, [{ id: 'a', name: 'A', href: 'https://a.example/?q=asthma' }]);
  const p = lookupPlan(two, 'a&b');
  assert.deepEqual(p.targets.map((x) => x.href), ['https://a.example/?q=a%26b', 'https://b.example/s/a%26b']);
  const long = lookupPlan(two, 'a b c d e f g');
  assert.equal(long.show, true);
  assert.equal(long.query, null);
  assert.deepEqual(long.targets, [], '흐림 — 열 곳 없음');
  assert.deepEqual(queryLinks(two).map((l) => l.id), ['a', 'b']);
});

test('L7 목록 편집 — move·remove·upsert·newLinkId · homeUrl · hostOf', () => {
  const l = [{ id: 'a', name: 'A', url: 'https://a.example/' }, { id: 'b', name: 'B', url: 'https://b.example/' }, { id: 'c', name: 'C', url: 'https://c.example/' }];
  assert.deepEqual(moveLink(l, 'b', -1).map((x) => x.id), ['b', 'a', 'c']);
  assert.deepEqual(moveLink(l, 'b', 1).map((x) => x.id), ['a', 'c', 'b']);
  assert.deepEqual(moveLink(l, 'a', -1).map((x) => x.id), ['a', 'b', 'c'], '끝이면 그대로');
  assert.deepEqual(moveLink(l, 'zz', 1).map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(l.map((x) => x.id), ['a', 'b', 'c'], '원본을 바꾸지 않는다');
  assert.deepEqual(removeLink(l, 'b').map((x) => x.id), ['a', 'c']);
  assert.deepEqual(upsertLink(l, { id: 'b', name: 'B2', url: 'https://b2.example/', extra: 1 })[1], { id: 'b', name: 'B2', url: 'https://b2.example/' });
  assert.deepEqual(upsertLink(l, { id: 'd', name: 'D', url: 'https://d.example/' }).map((x) => x.id), ['a', 'b', 'c', 'd']);
  let n = 0;
  const seq = [0.5, 0.5, 0.25];
  const id = newLinkId([{ id: newLinkId([], () => 0.5) }], () => seq[n++]);
  assert.match(id, /^u[0-9a-z]{6}$/);
  assert.notEqual(id, newLinkId([], () => 0.5), '겹치면 다시 뽑는다');
  assert.equal(homeUrl('https://pubmed.ncbi.nlm.nih.gov/?term={q}'), 'https://pubmed.ncbi.nlm.nih.gov/', '{q} 링크는 첫 화면');
  assert.equal(homeUrl('https://x.example/a/b?c=1'), 'https://x.example/a/b?c=1', '{q} 없으면 그대로');
  assert.equal(homeUrl('javascript:alert(1)'), null);
  assert.equal(hostOf(LINKS.DEFAULTS[0].url), 'vsearch.nlm.nih.gov');
  assert.equal(hostOf('nope'), '');
});

test('L8 ★ 새 탭 속성 한 곳 — armAnchor(target·rel·referrerPolicy) · window.open 0', () => {
  const a = armAnchor({}, 'https://a.example/?q=x');
  assert.deepEqual(a, { href: 'https://a.example/?q=x', target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' });
  assert.equal(LINK_REL, 'noopener noreferrer');
  const u = src('../js/ui/links.js');
  const code = u.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /window\.open\s*\(/, 'window.open 금지');
  assert.doesNotMatch(code, /\bconfirm\s*\(/, 'confirm() 금지 — 페이지 안 대화');
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML/, 'innerHTML 0');
  assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|new Image\b|sendBeacon|\.src\s*=/, '★ 앱은 그 사이트에 요청하지 않는다');
  // 새 탭을 만드는 곳은 armAnchor 를 거친다(서재 카드 링크·openExternal).
  assert.equal((code.match(/armAnchor\(document\.createElement\('a'\)/g) || []).length, 2);
  assert.doesNotMatch(code, /\.target\s*=\s*'_blank'[\s\S]*\.target\s*=\s*'_blank'/, 'target 은 armAnchor 한 곳에서만');
});

test('L9 선택 줄 — SEL_ACTIONS 끝 lookup(when:links · [⋯] 안) · selBarModel 숨김·흐림·문구 키', () => {
  // `[11-2 — 11-D3]` 줄 단추 목록이 [단어 번역][문장 번역] + [⋯](요약·여기서부터 읽기·찾아보기)로 바뀌었다 — lookup 은 넷째 → 다섯째(`more`).
  // `[11-4 — 11-D3]` 보이는 셋째 칸 [설명]이 `sentence` 다음에 들어왔다 — lookup 은 여섯째(끝 자리 `[L]` 은 그대로).
  // `[12-2 — spec 17-11 5]` `[⋯]` 안 [기억 카드](`remember`)가 [여기서부터 읽기] 다음에 들어왔다 — lookup 은 일곱째(끝 자리 그대로).
  assert.deepEqual(SEL_ACTIONS.map((a) => a.id), ['word', 'sentence', 'explain', 'summary', 'readFrom', 'remember', 'lookup']);
  const L = SEL_ACTIONS.length - 1;
  assert.equal(SEL_ACTIONS[L].when, 'links');
  assert.equal(SEL_ACTIONS[L].key, 'sel.lookup');
  assert.equal(SEL_ACTIONS[L].more, true, '[⋯] 안');
  const on = showAction(SEL_ACTIONS, 'word');
  assert.equal(on[L].when, 'links', '[단어 번역] 켜기(8f-2)가 lookup 항목을 지우지 않는다');
  const none = selBarModel(on, { text: 'asthma' }, { links: 0 });
  assert.equal(none[L].hidden, true, '{q} 링크 0 → 없음');
  assert.equal(selBarModel(on, { text: 'asthma' })[L].hidden, true, 'ctx 없으면 없음');
  const one = selBarModel(on, { text: 'asthma' }, { links: 1 });
  assert.deepEqual(one.map((m) => [m.id, m.hidden, m.disabled]), [['word', false, false], ['sentence', false, false], ['explain', false, false], ['summary', false, false], ['readFrom', false, false], ['remember', false, false], ['lookup', false, false]]);
  assert.equal(one[L].note, 'links.tooLong');
  assert.equal(one[0].note, 'sel.tooLong');
  const long = selBarModel(on, { text: 'a b c d e f g' }, { links: 2 });
  assert.equal(long[L].disabled, true, '7낱말 → 흐림');
  assert.equal(long[0].disabled, true);
  assert.equal(long[1].disabled, false);
  assert.equal(selBarModel(on, { text: '…' }, { links: 2 })[L].disabled, true, '구두점뿐 → 흐림');
  assert.equal(selBarModel(on, { text: '…' }, { links: 2 })[0].disabled, false, '[단어 번역] 판정은 8c-1 그대로');
});

test('L10 설정 키 · 화면 배선(grep) · index.html 그릇 · i18n', () => {
  assert.ok(Object.prototype.hasOwnProperty.call(SET_DEFAULTS, 'links.medical'));
  assert.equal(SET_DEFAULTS['links.medical'], null);
  assert.equal(readValue(new Map(), 'links.medical'), null);
  assert.equal(LINKS_KEY, 'links.medical');

  const sb = src('../js/ui/selbar.js');
  const i1 = sb.indexOf("if (id === 'lookup')");
  const i2 = sb.indexOf('deps.onAction(id, Object.assign({}, s))');
  assert.ok(i1 > 0 && i2 > i1, '★ 새 탭은 누름 안에서 곧바로 — controls(onAction) 보다 먼저');
  assert.match(sb, /selBarModel\(actions, s, \{ links: queryLinkCount\(\) \}\)/);
  assert.match(sb, /closeLookupMenu\(true\);\s+\/\/ `\[18\]` 목록은 줄 안에 있다/);
  assert.match(src('../js/ui/library.js'), /renderLibraryLinks\(\);/);
  const st = src('../js/ui/settings.js');
  assert.match(st, /initLinksSettings\(\);/);
  assert.match(st, /showLinksSettings\(params && params\.tab\);/);
  assert.match(st, /leaveLinksSettings\(\);/);

  const html = src('../index.html');
  const lib = html.indexOf('id="libraryLinks"');
  assert.ok(lib > 0 && lib < html.indexOf('id="storageLine"'), '서재 카드는 저장 줄 위');
  assert.match(html, /<details class="card links-card" id="libraryLinks">/, '기본 접힘(open 없음)');
  assert.match(html, /data-nav="#\/settings\/links"/);
  const sl = html.indexOf('id="settingsLinks"');
  assert.ok(sl > html.indexOf('id="settingsVoices"'), '설정 카드는 목소리 카드 아래');
  assert.match(html, /<input type="text" id="linksUrl" dir="ltr" inputmode="url"/);
  assert.match(html, /<dialog class="confirm-dialog" id="linksDelDialog"/);
  assert.doesNotMatch(html.slice(sl, html.indexOf('</section>', sl)), /type="password"/, '비밀번호 칸 없음');

  const KEYS = ['sel.lookup', 'links.tooLong', 'links.menu', 'links.card.title', 'links.card.edit', 'links.empty', 'links.settings.title',
    'links.help.query', 'links.help.account', 'links.queryBadge', 'links.up', 'links.down', 'links.edit', 'links.delete', 'links.add',
    'links.addSuggested', 'links.reset', 'links.name', 'links.url', 'links.save', 'links.cancel', 'links.saved',
    'links.err.nameEmpty', 'links.err.nameLong', 'links.err.urlBad', 'links.err.urlNotHttps', 'links.err.urlUserinfo', 'links.err.urlLong',
    'links.err.tooMany', 'links.delete.confirm', 'links.suggested.add', 'links.suggested.none', 'links.suggested.paid', 'links.suggested.unverified'];
  for (const lang of LANGS) {
    for (const k of KEYS) assert.equal(typeof BUNDLES[lang][k], 'string', lang + ' ' + k);
    assert.ok(BUNDLES[lang]['links.help.query'].includes('{q}'), lang + ' 안내에 {q}');
  }
  for (const k of Object.values(ERR_KEYS)) assert.ok(KEYS.includes(k), k);
});
