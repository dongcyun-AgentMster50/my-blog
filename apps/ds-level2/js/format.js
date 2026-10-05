/* ============================================================
   ds-level2 — 미니 마크업 포매터 + 코드 토크나이저 (spec 3-1)

   풀 마크다운 파서는 두지 않는다. 지원: 인라인 `code`, ```lang 블록, **굵게**, 빈 줄 문단,
   줄 머리 "- " / "1. " 목록, [[term-id]] / [[term-id|표시]] 용어 버튼. 그 외는 평문.
   입력은 먼저 이스케이프되므로 콘텐츠에 HTML 이 섞여도 실행되지 않는다.
   토크나이저는 python / sql 두 언어, 토큰 5종(comment, string, number, keyword, decorator)을
   합성 정규식 하나로 1패스 스캔한다. 실패해도 평문 <pre> 가 나오므로 안전하다.
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});

  function text(v) {
    if (Array.isArray(v)) return v.map(function (s) { return s == null ? '' : String(s); }).join('\n');
    return v == null ? '' : String(v);
  }
  function escape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ────────────────────────────────────────────────────────
     토크나이저
     ──────────────────────────────────────────────────────── */
  var PY_KW = 'False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|print|len|range|lambda';
  var SQL_KW = 'select|from|where|group|by|order|having|join|left|right|inner|outer|full|cross|natural|on|using|as|and|or|not|in|is|null|like|between|case|when|then|else|end|limit|offset|distinct|union|all|insert|into|values|update|set|delete|create|table|view|with|recursive|over|partition|rows|range|row_number|rank|dense_rank|lag|lead|ntile|first_value|last_value|count|sum|avg|min|max|exists|asc|desc|cast|coalesce|nullif|ifnull|intersect|except|primary|key|drop|alter|add|index|top|nulls|first|last|filter|window|replace|substr|length|round|strftime|date|integer|text|real|varchar|int|float|boolean';
  var RE = {
    // 순서가 우선순위다: 주석 → 문자열 → 숫자 → 데코레이터 → 키워드
    python: new RegExp('(#[^\\n]*)|("""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\')|(\\b\\d+(?:\\.\\d+)?(?:e[-+]?\\d+)?j?\\b)|(^\\s*@\\w[\\w.]*)|(\\b(?:' + PY_KW + ')\\b)', 'gm'),
    sql: new RegExp('(--[^\\n]*|/\\*[\\s\\S]*?\\*/)|(\'(?:\'\'|[^\'])*\'|"(?:[^"])*")|(\\b\\d+(?:\\.\\d+)?\\b)|(^$)|(\\b(?:' + SQL_KW + ')\\b)', 'gim')
  };
  var CLASS = ['tk-comment', 'tk-string', 'tk-number', 'tk-decorator', 'tk-keyword'];

  /** 코드 문자열 → 하이라이트된 HTML(이스케이프 포함). 모르는 언어는 이스케이프만. */
  function highlight(code, lang) {
    var re = RE[lang];
    if (!re) return escape(code);
    var out = '', last = 0, m;
    re.lastIndex = 0;
    try {
      while ((m = re.exec(code))) {
        if (m[0] === '') { re.lastIndex++; continue; }
        out += escape(code.slice(last, m.index));
        var cls = null;
        for (var g = 1; g <= 5; g++) if (m[g] !== undefined) { cls = CLASS[g - 1]; break; }
        out += cls ? '<span class="' + cls + '">' + escape(m[0]) + '</span>' : escape(m[0]);
        last = m.index + m[0].length;
      }
      out += escape(code.slice(last));
      return out;
    } catch (e) {
      return escape(code);
    }
  }

  /** <pre><code> + 우상단 [복사]. 원문은 data-copy 속성에 이스케이프해 담아 둔다. */
  function codeBlock(code, lang, opts) {
    opts = opts || {};
    code = text(code).replace(/\t/g, '    ').replace(/\s+$/, '');
    lang = RE[lang] ? lang : 'text';
    var label = opts.label ? '<span class="codeblock-label">' + escape(opts.label) + '</span>' : '';
    var copy = opts.copy === false ? '' : '<button type="button" class="btn-copy" data-copy="' + escape(code) + '" aria-label="코드 복사">복사</button>';
    return '<div class="codeblock' + (opts.className ? ' ' + opts.className : '') + '">' + label + copy +
      '<pre tabindex="0"><code class="lang-' + lang + '">' + highlight(code, lang) + '</code></pre></div>';
  }

  /* ────────────────────────────────────────────────────────
     미니 마크업 → HTML
     ──────────────────────────────────────────────────────── */
  var missingTerms = {};
  function termExists(id) {
    return !!(root.DS2 && typeof root.DS2.term === 'function' && root.DS2.term(id));
  }
  function termButton(id, label) {
    var t = root.DS2 && root.DS2.term && root.DS2.term(id);
    if (!t) {
      if (!missingTerms[id]) { missingTerms[id] = 1; try { console.warn('[ds-level2] 없는 용어 링크 [[' + id + ']]'); } catch (e) { /* */ } }
      return escape(label || id);
    }
    return '<button type="button" class="term" data-term="' + escape(id) + '" aria-label="용어 ' + escape(t.ko) + ' 정의 보기">' + escape(label || t.ko) + '</button>';
  }

  function inline(s) {
    // s 는 이미 이스케이프됨. 코드 자리표시자는 \u0001n\u0001 형태로 남아 있다.
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]*))?\]\]/g, function (_, id, label) {
      return termButton(id, label ? unescapeBasic(label) : null);
    });
    return s;
  }
  function unescapeBasic(s) { // 라벨은 이스케이프된 상태 — termButton 이 다시 이스케이프하므로 원복
    return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function render(src, opts) {
    opts = opts || {};
    var raw = text(src).replace(/\r\n?/g, '\n');
    var slots = [];
    function slot(html) { slots.push(html); return '\u0001' + (slots.length - 1) + '\u0001'; }

    // 1) 코드 블록을 먼저 떼어 낸다(안의 ** 나 - 가 마크업으로 해석되면 안 된다).
    raw = raw.replace(/```([a-zA-Z]*)[ \t]*\n([\s\S]*?)\n?```/g, function (_, lang, code) {
      return '\n' + slot(codeBlock(code, lang || 'text', { copy: opts.copy !== false })) + '\n';
    });
    // 2) 인라인 코드. 내부는 이스케이프만.
    raw = raw.replace(/`([^`\n]+)`/g, function (_, code) { return slot('<code>' + escape(code) + '</code>'); });
    // 3) 나머지 이스케이프
    var esc = escape(raw);
    // 4) 블록: 빈 줄로 문단 분리, 줄 머리 "- " / "1. " 는 목록
    var blocks = esc.split(/\n\s*\n/);
    var html = blocks.map(function (b) {
      var lines = b.split('\n').filter(function (l, i, arr) { return !(l.trim() === '' && (i === 0 || i === arr.length - 1)); });
      if (!lines.length) return '';
      var onlySlot = lines.length === 1 && /^\s*\u0001\d+\u0001\s*$/.test(lines[0]);
      if (onlySlot) return lines[0].trim();
      if (lines.every(function (l) { return /^\s*-\s+/.test(l); })) {
        return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*-\s+/, '')) + '</li>'; }).join('') + '</ul>';
      }
      if (lines.every(function (l) { return /^\s*\d+\.\s+/.test(l); })) {
        return '<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*\d+\.\s+/, '')) + '</li>'; }).join('') + '</ol>';
      }
      // 문단 안에 코드 블록 슬롯이 끼어 있으면 문단을 쪼갠다
      var parts = [], cur = [];
      lines.forEach(function (l) {
        if (/^\s*\u0001\d+\u0001\s*$/.test(l)) { if (cur.length) parts.push('<p>' + inline(cur.join('<br>')) + '</p>'); cur = []; parts.push(l.trim()); }
        else cur.push(l);
      });
      if (cur.length) parts.push('<p>' + inline(cur.join('<br>')) + '</p>');
      return parts.join('');
    }).join('');
    // 5) 슬롯 복원
    return html.replace(/\u0001(\d+)\u0001/g, function (_, i) { return slots[Number(i)]; });
  }

  /** 한 줄 인라인 전용(보기 텍스트, 제목 등). 문단 태그 없이. */
  function inlineOnly(src) {
    var raw = text(src);
    var slots = [];
    raw = raw.replace(/`([^`\n]+)`/g, function (_, code) { slots.push('<code>' + escape(code) + '</code>'); return '\u0001' + (slots.length - 1) + '\u0001'; });
    var out = inline(escape(raw)).replace(/\n/g, '<br>');
    return out.replace(/\u0001(\d+)\u0001/g, function (_, i) { return slots[Number(i)]; });
  }

  /** 마크업을 떼어 낸 평문(aria-label, 목록 미리보기용) */
  function plain(src, max) {
    // 용어 링크는 코드를 벗기기 전에 치환한다 — 코드 안의 [[ (df[['a','b']]) 는 링크가 아니다
    var s = text(src).replace(/```[a-zA-Z]*\n[\s\S]*?```/g, ' [코드] ');
    var slots = [];
    s = s.replace(/`([^`\n]+)`/g, function (_, c) { slots.push(c); return '\u0001' + (slots.length - 1) + '\u0001'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[\[([a-z0-9-]+)\|([^\]]*)\]\]/g, '$2')
      .replace(/\[\[([a-z0-9-]+)\]\]/g, function (_, id) { var t = root.DS2 && root.DS2.term(id); return t ? t.ko : id; })
      .replace(/\u0001(\d+)\u0001/g, function (_, i) { return slots[Number(i)]; })
      .replace(/\s+/g, ' ').trim();
    if (max && s.length > max) s = s.slice(0, max - 1) + '…';
    return s;
  }

  E.format = { text: text, escape: escape, highlight: highlight, codeBlock: codeBlock, render: render,
    inline: inlineOnly, plain: plain, termExists: termExists, termButton: termButton };
})(typeof globalThis !== 'undefined' ? globalThis : window);
