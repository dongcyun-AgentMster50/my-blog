/* ============================================================
   MedReader — 방어적 JSON 파싱 (spec 10-6 · 10-7)

   ── 순수 계층이다(3-1) ──────────────────────────────────
   아무것도 import 하지 않는다. 문자열 → 값.

   ── 왜 필요한가 ─────────────────────────────────────────
   모델은 "코드펜스 없이 JSON 만"이라는 지시(10-1 규칙 1)를 자주 어긴다.
   `[실측 7b Review]` [시험 번역] 응답이 ```json … ``` 로 감싸여 와서 `JSON.parse` 가
   실패했고, 화면에 **원문 한 블록**으로 보였다. 여기서 그것을 걷어 낸다.

   ── 단계 (10-6, 순서대로, 각 단계 뒤 재파싱 — 누적) ──────
     1. 코드펜스 제거
     2. 첫 `{`/`[` 부터 마지막 `}`/`]` 까지
     3. `JSON.parse`
     4. 실패 시  a. 후행 쉼표  b. 스마트 따옴표  c. 잘린 응답  d. 주석
     5. 스키마 검증(미니) — 실패 필드 제거, required 누락이면 실패
     6. `{ok:true, value, repaired, repairs}` 또는 `{ok:false, code:'PARSE'|'SCHEMA'}`

   ── ★ 복구는 전부 "문자열 밖"에서만 ──────────────────────
   정규식 한 줄로 `//` 주석을 지우면 번역문 속 `https://…` 가 잘린다. 후행 쉼표·주석·
   스마트 따옴표는 **문자열 안인지 밖인지를 세는 훑기**로만 고친다.

   ── ★ 잘린 응답은 "온전한 데까지"만 살린다 ─────────────────
   마지막 항목이 반쯤 온 번역(`"t":"العلاج با`)을 닫아서 살리면 **반쪽 번역이
   캐시에 눌러앉는다.** 그래서 문자열 한가운데·키 뒤·숫자 끝에서 잘렸으면
   마지막 쉼표까지 되돌아가 그 뒤를 버리고 닫는다. 버려진 항목은 개수 누락이 된다(10-2).
   ============================================================ */

/* ────────────────────────────────────────────────────────
   1·2. 펜스와 바깥 텍스트
   ──────────────────────────────────────────────────────── */

/** ```json … ``` 또는 ``` … ``` 의 안쪽. 닫는 펜스가 없으면(잘림) 여는 펜스 뒤 전부. */
function stripFence(text) {
  const s = String(text);
  const open = s.indexOf('```');
  if (open < 0) return { text: s, changed: false };
  let start = s.indexOf('\n', open);
  // 같은 줄에 바로 내용이 오는 경우(```{"a":1}```)도 받는다 — 언어 표지(json)만 건너뛴다.
  const sameLine = s.slice(open + 3).match(/^[A-Za-z]*/);
  const afterTag = open + 3 + (sameLine ? sameLine[0].length : 0);
  if (start < 0 || /\S/.test(s.slice(afterTag, start))) start = afterTag;
  const close = s.indexOf('```', start);
  const inner = close < 0 ? s.slice(start) : s.slice(start, close);
  return { text: inner, changed: true };
}

/** 첫 `{`/`[` 부터 마지막 `}`/`]` 까지. 닫는 괄호가 없으면 끝까지(잘린 응답 — 4c 가 받는다). */
function sliceJson(text) {
  const s = String(text);
  const a = s.search(/[{[]/);
  if (a < 0) return { text: s, changed: false };
  const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  const out = b > a ? s.slice(a, b + 1) : s.slice(a);
  return { text: out, changed: out !== s };
}

/* ────────────────────────────────────────────────────────
   문자열 밖을 아는 훑기
   ──────────────────────────────────────────────────────── */

const OPEN_SMART = '“';   // U+201C
const CLOSE_SMART = '”';  // U+201D

/**
 * 한 번 훑으며 `fn(i, ch, ctx)` 를 부른다. `ctx.inString` 이 참이면 문자열 안이다.
 * `fn` 이 숫자를 돌려주면 그만큼 건너뛴다(주석 지우기에 쓴다).
 * 문자열 구분자는 `"` 이고, `smart` 가 참이면 문자열 **밖**의 `“`·`”` 도 구분자로 본다.
 */
function walk(text, smart, fn) {
  const s = String(text);
  let inString = false;
  let quote = '';
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (esc) { esc = false; fn(i, ch, { inString: true, quote: quote }); continue; }
      if (ch === '\\') { esc = true; fn(i, ch, { inString: true, quote: quote }); continue; }
      const closes = quote === '"' ? ch === '"' : (ch === CLOSE_SMART || ch === OPEN_SMART || ch === '"');
      if (closes) { inString = false; fn(i, ch, { inString: false, closing: true, quote: quote }); continue; }
      fn(i, ch, { inString: true, quote: quote });
      continue;
    }
    if (ch === '"' || (smart && (ch === OPEN_SMART || ch === CLOSE_SMART))) {
      inString = true;
      quote = ch;
      fn(i, ch, { inString: false, opening: true, quote: ch });
      continue;
    }
    const skip = fn(i, ch, { inString: false });
    if (typeof skip === 'number' && skip > 0) i += skip;
  }
  return { inString: inString };
}

/** 4a — 문자열 밖의 `,` 뒤에 공백만 있고 `}`/`]` 가 오면 그 쉼표를 지운다. */
function dropTrailingCommas(text) {
  const s = String(text);
  const drop = new Set();
  walk(s, false, (i, ch, ctx) => {
    if (ctx.inString || ch !== ',') return;
    let j = i + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] === '}' || s[j] === ']') drop.add(i);
  });
  if (!drop.size) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) if (!drop.has(i)) out += s[i];
  return out;
}

/** 4b — 문자열 **구분자로 쓰인** 스마트 따옴표만 `"` 로. `"` 로 연 문자열 안의 “인용”은 그대로 둔다. */
function fixSmartQuotes(text) {
  const s = String(text);
  let out = '';
  walk(s, true, (i, ch, ctx) => {
    if (ctx.opening || ctx.closing) { out += '"'; return; }
    out += ch;
  });
  return out;
}

/** 4d — 문자열 밖의 `// …` 줄 주석과 `/* … *\/` 블록 주석을 지운다. */
function dropComments(text) {
  const s = String(text);
  let out = '';
  walk(s, false, (i, ch, ctx) => {
    if (ctx.inString || ctx.opening || ctx.closing) { out += ch; return; }
    if (ch === '/' && s[i + 1] === '/') {
      const nl = s.indexOf('\n', i);
      return (nl < 0 ? s.length : nl) - i - 1;
    }
    if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      return (end < 0 ? s.length : end + 2) - i - 1;
    }
    out += ch;
  });
  return out;
}

/**
 * 4c — 잘린 응답 닫기.
 *
 * 열린 `[`·`{` 를 스택으로 센다. 끝이 **온전한 값**(`}`·`]`·값 자리의 닫힌 문자열·
 * 완결 리터럴)이면 그대로 닫고, 아니면(문자열 한가운데·키 뒤·`:` 뒤·숫자 끝)
 * **문자열 밖의 마지막 쉼표**까지 되돌아가 그 뒤를 버린 다음 닫는다.
 * 숫자 끝을 믿지 않는 이유: `"i": 12` 가 `"i": 1` 로 잘렸을 수 있다.
 */
function closeTruncated(text) {
  const s = String(text);
  const scan = scanStructure(s);
  if (!scan.stack.length && !scan.inString) return { text: s, changed: false };

  let body = s;
  if (scan.inString || !scan.endsWithValue) {
    // 문자열 밖의 마지막 쉼표 — 없으면 마지막 여는 괄호 바로 뒤까지.
    const cut = scan.lastComma >= 0 ? scan.lastComma : scan.lastOpen + 1;
    body = s.slice(0, Math.max(0, cut));
  }
  body = body.replace(/[\s,:]+$/, '');
  const again = scanStructure(body);
  let closers = '';
  for (let i = again.stack.length - 1; i >= 0; i--) closers += again.stack[i] === '{' ? '}' : ']';
  return { text: body + closers, changed: true };
}

/** 4c 의 훑기 — 스택·마지막 쉼표·끝이 온전한 값인지. */
function scanStructure(text) {
  const s = String(text);
  const stack = [];
  const expectKey = [];       // 객체 깊이마다 "지금 키 자리인가"
  let lastComma = -1;
  let lastOpen = -1;
  let lastValueEnd = -1;      // 온전한 값이 끝난 위치
  let stringIsKey = false;
  const res = walk(s, false, (i, ch, ctx) => {
    if (ctx.opening) {
      const top = stack[stack.length - 1];
      stringIsKey = top === '{' && expectKey[expectKey.length - 1] === true;
      return;
    }
    if (ctx.closing) { if (!stringIsKey) lastValueEnd = i; return; }
    if (ctx.inString) return;
    if (ch === '{' || ch === '[') {
      stack.push(ch); expectKey.push(ch === '{'); lastOpen = i; return;
    }
    if (ch === '}' || ch === ']') {
      stack.pop(); expectKey.pop(); lastValueEnd = i; return;
    }
    if (ch === ',') {
      lastComma = i;
      if (stack[stack.length - 1] === '{') expectKey[expectKey.length - 1] = true;
      return;
    }
    if (ch === ':') { expectKey[expectKey.length - 1] = false; return; }
    // true/false/null 이 끝까지 왔는가
    if (/[el]/.test(ch) && /(?:true|false|null)$/.test(s.slice(0, i + 1))) lastValueEnd = i;
  });
  const trimmedEnd = s.replace(/\s+$/, '').length - 1;
  return {
    stack: stack,
    inString: res.inString,
    lastComma: lastComma,
    lastOpen: lastOpen,
    endsWithValue: !res.inString && trimmedEnd >= 0 && lastValueEnd === trimmedEnd
  };
}

function tryParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false }; }
}

/* ────────────────────────────────────────────────────────
   5. 스키마 미니 검증 (type · required · enum · minItems · maxLength)
   gemini `responseSchema` 꼴(대문자 type)과 JSON Schema 꼴(소문자) 둘 다 읽는다.
   ──────────────────────────────────────────────────────── */

/** 10-7 — 출력 문자열 안의 URL 은 지운다(피싱 링크 방지). */
const URL_RE = /https?:\/\/[^\s"'<>)]+/gi;
const HAS_URL = /https?:\/\//i;

const DROP = Symbol('drop');

function typeOf(schema) {
  return schema && typeof schema.type === 'string' ? schema.type.toLowerCase() : '';
}

function check(value, schema, flags) {
  if (!schema || typeof schema !== 'object') return value;
  const type = typeOf(schema);

  if (Array.isArray(schema.enum) && schema.enum.indexOf(value) < 0) return DROP;

  if (type === 'string') {
    if (typeof value !== 'string') return DROP;
    let v = value;
    if (flags.stripUrls && HAS_URL.test(v)) {
      v = v.replace(URL_RE, '').replace(/\s{2,}/g, ' ').trim();
      flags.changed = true;
    }
    if (Number.isFinite(schema.maxLength) && v.length > schema.maxLength) return DROP;
    return v;
  }
  if (type === 'integer' || type === 'number') {
    let v = value;
    // 모델이 번호를 "0" 처럼 문자열로 줄 때가 있다 — 숫자 모양이면 받는다(복구로 친다).
    if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim())) { v = Number(v.trim()); flags.changed = true; }
    if (typeof v !== 'number' || !Number.isFinite(v)) return DROP;
    if (type === 'integer' && !Number.isInteger(v)) return DROP;
    return v;
  }
  if (type === 'boolean') return typeof value === 'boolean' ? value : DROP;
  if (type === 'array') {
    if (!Array.isArray(value)) return DROP;
    const out = [];
    for (let i = 0; i < value.length; i++) {
      const v = check(value[i], schema.items, flags);
      if (v === DROP) { flags.changed = true; continue; }   // 실패 항목은 제거(→ 개수 누락)
      out.push(v);
    }
    if (Number.isFinite(schema.minItems) && out.length < schema.minItems) return DROP;
    return out;
  }
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return DROP;
    if (!schema.properties) return value;
    const props = schema.properties;
    const out = {};
    const names = Object.keys(props);
    for (let i = 0; i < names.length; i++) {
      const k = names[i];
      if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
      const v = check(value[k], props[k], flags);
      if (v === DROP) { flags.changed = true; continue; }    // 실패 필드는 제거
      out[k] = v;
    }
    // 10-7 — 스키마 밖 필드는 채택하지 않는다.
    if (Object.keys(value).some((k) => !Object.prototype.hasOwnProperty.call(props, k))) flags.changed = true;
    const req = Array.isArray(schema.required) ? schema.required : [];
    for (let i = 0; i < req.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(out, req[i])) return DROP;
    }
    return out;
  }
  return value;
}

/**
 * 스키마로 거른다. 루트가 실패하면 `{ok:false}`.
 * @returns {{ok:boolean, value?:*, changed?:boolean}}
 */
export function validateSchema(value, schema, opts) {
  const flags = { changed: false, stripUrls: !(opts && opts.stripUrls === false) };
  const v = check(value, schema, flags);
  if (v === DROP) return { ok: false };
  return { ok: true, value: v, changed: flags.changed };
}

/* ────────────────────────────────────────────────────────
   공개 함수
   ──────────────────────────────────────────────────────── */

/**
 * 10-6 `parseAIJson(text, schema)`.
 *
 * @param {string} text 모델 응답 원문
 * @param {Object} [schema] 있으면 5단계 검증
 * @returns {{ok:true, value:*, repaired:boolean, repairs:string[]} | {ok:false, code:'PARSE'|'SCHEMA', repairs:string[]}}
 *   `repairs` 는 실제로 거친 복구 단계 이름들(`fence`·`slice`·`trailingComma`·`smartQuotes`·`truncated`·`comments`·`schema`).
 *   호출자가 "잘린 응답은 받지 않는다" 같은 판단을 할 수 있게 돌려준다.
 */
export function parseAIJson(text, schema, opts) {
  const repairs = [];
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, code: 'PARSE', repairs: repairs };

  let s = text.trim();
  // `[Review 8a]` 그대로 파싱되면 펜스·자르기를 하지 않는다 — 번역문 속 ``` 를 펜스로 잘못 알고
  // 멀쩡한 JSON 을 잘라 PARSE 실패로 만들던 경로를 막는다.
  let parsed = tryParse(s);
  if (!parsed.ok) {
    const f = stripFence(s);
    if (f.changed) { s = f.text.trim(); repairs.push('fence'); }
    const sl = sliceJson(s);
    if (sl.changed) { s = sl.text; repairs.push('slice'); }
    parsed = tryParse(s);
  }
  const steps = [
    ['trailingComma', dropTrailingCommas],
    ['smartQuotes', fixSmartQuotes],
    ['truncated', (x) => closeTruncated(x).text],
    ['comments', dropComments]
  ];
  for (let k = 0; k < steps.length && !parsed.ok; k++) {
    const next = steps[k][1](s);
    if (next !== s) { s = next; repairs.push(steps[k][0]); }
    parsed = tryParse(s);
  }
  // 주석이 잘린 응답의 구조 판단을 흐렸을 수 있다 — 주석을 지운 뒤 한 번 더 닫아 본다.
  if (!parsed.ok && repairs.indexOf('comments') >= 0) {
    const c = closeTruncated(s);
    if (c.changed) { s = c.text; if (repairs.indexOf('truncated') < 0) repairs.push('truncated'); parsed = tryParse(s); }
  }
  if (!parsed.ok) return { ok: false, code: 'PARSE', repairs: repairs };

  let value = parsed.value;
  if (schema) {
    const v = validateSchema(value, schema, opts);
    if (!v.ok) return { ok: false, code: 'SCHEMA', repairs: repairs };
    value = v.value;
    if (v.changed) repairs.push('schema');
  }
  return { ok: true, value: value, repaired: repairs.length > 0, repairs: repairs };
}
