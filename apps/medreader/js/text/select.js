/* ============================================================
   MedReader — 탭·선택 → 문장 (spec 17-7-6 4-2 · 3절 손짓 표 · 17-7-1)

   ── 순수 부분이다(16-A) ─────────────────────────────────
   화면 객체·전역 객체·세그멘터를 직접 부르지 않는다 — 낱말 세그멘터가 필요하면 화면이 **함수로** 넘긴다
   (`expandWord` 의 `segmenterFn`). import 0. `tests/taptr-8c.test.mjs` 가 고정한다.

   좌표: 줄 안 오프셋 = `span.line` 의 **첫 텍스트 노드** 글자 기준 — 10a `Unit.ranges` 와 같은 좌표(I1).
   ============================================================ */

/**
 * 탭 문턱(3절 표 ①②). **타이머가 아니다** — 브라우저 낱말 선택(길게 누르기)과 다투지 않고, 늦게 온 `pointerup` 을
 * 탭으로 세지 않게 막는 문턱이다. 450ms 는 Android 길게 누르기(약 500ms) 바로 아래 `[가정 — 실기기]`.
 */
export const TAP = Object.freeze({ MAX_MS: 450, MAX_MOVE: 10 });

/** 선택 동작 줄 [단어 번역] 의 한계(17-7-1 — 한 문단 안, 최대 6낱말·60자). */
export const SEL_LIMIT = Object.freeze({ WORDS: 6, CHARS: 60 });

/** 표 안내 단위(`tts/text.js` `TABLE_NOTICE_KIND`) — 번역 대상 문장이 아니다. */
const NOTICE_KIND = 'table-notice';

/**
 * 3절 — 이 누름이 **탭**인가.
 *   ① 누름 시간 ≥ 450ms ② 움직임 > 10px ③ 누를 때 이미 선택이 있었다(선택을 풀려고 누른 탭) ④ 지금 선택이 있다 → 탭 아님.
 *   `[8c-1b]` ⑤ 누름 동안 다른 손가락이 닿았다(동시 포인터 ≥ 2 — `multi`) ⑥ 짝 없는 `pointerup`(누름 기록 없음 — `down` null) → 탭 아님.
 *   ⑥ 이전에는 "기록 없음 = ③④만"이었는데, 두 손가락에서 둘째 누름이 첫째 기록을 덮어 첫째의 `pointerup` 이 ①②를 건너뛰고
 *   탭이 됐다(8c-1 Review 8c1R-9 #1). 누름 기록은 포인터별(`createTapTracker`)이고 짝 없는 up 은 탭이 아니다.
 * @param {?{t:number, x:number, y:number}} down  `pointerdown` 시각(ms)·좌표
 * @param {?{t:number, x:number, y:number, sel?:boolean}} up  `pointerup` 시각·좌표·그때 선택이 있는가
 * @param {boolean} [hadSel]  누를 때 선택이 있었는가
 * @param {boolean} [multi]  이 누름 동안 동시 포인터가 둘 이상이었는가(다중 터치)
 * @returns {boolean}
 */
export function isTap(down, up, hadSel, multi) {
  if (hadSel) return false;
  if (up && up.sel) return false;
  if (multi) return false;
  if (!down) return false;
  if (!up) return true;
  const dt = Number(up.t) - Number(down.t);
  if (Number.isFinite(dt) && dt >= TAP.MAX_MS) return false;
  const dx = Number(up.x) - Number(down.x);
  const dy = Number(up.y) - Number(down.y);
  if (Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx, dy) > TAP.MAX_MOVE) return false;
  return true;
}

/**
 * `[8c-1b]` 누름 기록 — **포인터별**(`pointerId` → 기록). 리더·원본 두 뷰가 같은 규칙을 쓴다. 화면은 이벤트에서 숫자만 골라 넘긴다.
 *   · `down(p)` — `{id, t, x, y, sel, primary, type}`. 같은 종류의 **primary** 누름이 오면 그 종류의 옛 기록은 남은 찌꺼기다
 *     (그 종류의 다른 포인터가 닿아 있으면 primary 가 아니다 — Pointer Events) → 지운다. 기록이 둘 이상이 되면 **닿아 있는 모든
 *     기록**에 `multi` 를 붙인다 — 그 제스처의 어느 손가락도 탭이 아니다(먼저 뗀 손가락이 이미 지워졌어도, 남은 손가락은 끝까지 multi).
 *   · `up(id)` — 그 포인터 기록을 꺼내 지운다(없으면 null = 짝 없는 up → `isTap` 이 탭 아님).
 *   · `drop(id)` — `pointercancel`·`lostpointercapture`.
 *   · `[8c-1c]` `release(id)` — 화면 맨 위(붙잡기 단계)의 `pointerup` 이 먼저 부른다: 기록을 **지우지 않고** "떼어짐" 표시만
 *     한다(같은 이벤트가 곧 본문에 닿으면 `up` 이 그대로 꺼내 탭을 판정한다). 본문 밖에서 뗀 마우스·펜(암묵 캡처가 없다)은
 *     본문 `up` 이 오지 않아 표시된 채 남는다 → 다음 누름이 오면 **종류와 무관하게** 지운다(8c-1b 재검증 8c1bR-8 #1 —
 *     남은 마우스 기록이 다음 손가락 탭을 "여러 손가락"으로 만들었다). 진짜 동시 누름(아직 안 뗀 손가락)은 표시가 없어 그대로 센다.
 * @returns {{down:Function, up:Function, drop:Function, release:Function, size:Function}}
 */
export function createTapTracker() {
  const downs = new Map();
  const keyOf = (id) => String(id == null ? '' : id);
  return {
    down(p) {
      const x = p || {};
      for (const [k, r] of Array.from(downs.entries())) {
        if (r.released || (x.primary === true && r.type === x.type)) downs.delete(k);
      }
      downs.set(keyOf(x.id), { t: x.t, x: x.x, y: x.y, sel: !!x.sel, type: x.type, multi: false, released: false });
      if (downs.size >= 2) for (const r of downs.values()) r.multi = true;
    },
    up(id) {
      const k = keyOf(id);
      const r = downs.get(k) || null;
      downs.delete(k);
      return r;
    },
    drop(id) { downs.delete(keyOf(id)); },
    release(id) { const r = downs.get(keyOf(id)); if (r) r.released = true; },
    size() { return downs.size; }
  };
}

function isSentence(u) {
  return !!u && Number.isInteger(u.seg) && u.kind !== NOTICE_KIND;
}

function touchesLine(u, id) {
  const rs = Array.isArray(u.ranges) ? u.ranges : null;
  if (rs && rs.length) return rs.some((r) => r && String(r.id) === id);
  const ids = Array.isArray(u.lineIds) ? u.lineIds : [];
  return ids.some((x) => String(x) === id);
}

/**
 * 4-1 — 그 줄과 겹치는 문장 번호들(단위 순서 = 읽기 순서). `ranges` 가 있으면 그것으로, 없으면(300자 분할) `lineIds` 로.
 * 표 안내·인용(seg 없음)은 빠진다 — 그런 줄만 있으면 빈 목록.
 * @param {Array} units  문장 단위(`speaker.sentenceUnits()`)
 * @param {string} lineId
 * @returns {number[]}
 */
export function segsOnLine(units, lineId) {
  const id = String(lineId == null ? '' : lineId);
  const out = [];
  for (const u of Array.isArray(units) ? units : []) {
    if (!isSentence(u) || !touchesLine(u, id)) continue;
    if (out.indexOf(u.seg) < 0) out.push(u.seg);
  }
  return out;
}

/**
 * 4-2 — 줄 안 오프셋 `off` 의 글자가 든 문장 단위. ① 그 글자를 품은 `ranges` ② 없으면(문장 사이 공백) 그 줄에서
 * 오프셋 뒤에 시작하는 첫 구간 ③ 그것도 없으면 그 줄의 마지막 구간 ④ `ranges` 가 없는 단위(300자 분할)는 `lineIds` 로.
 * @returns {?Object} 단위 또는 null
 */
export function unitAt(units, lineId, off) {
  const id = String(lineId == null ? '' : lineId);
  const o = Number(off);
  const list = (Array.isArray(units) ? units : []).filter(isSentence);
  let after = null;
  let before = null;
  for (const u of list) {
    const rs = Array.isArray(u.ranges) ? u.ranges : [];
    for (const r of rs) {
      if (!r || String(r.id) !== id) continue;
      if (Number.isFinite(o) && o >= r.start && o < r.end) return u;
      if (Number.isFinite(o) && r.start >= o && !after) after = u;
      before = u;
    }
  }
  if (after) return after;
  if (before) return before;
  for (const u of list) {
    if (Array.isArray(u.ranges) && u.ranges.length) continue;
    if (touchesLine(u, id)) return u;
  }
  return null;
}

/**
 * 문장 번호들 → 그 문장들의 **문단 전체** 단위(읽기 순서). 탭 번역은 문단 단위로 1회 요청한다(7-2).
 * @returns {Array}
 */
export function paraUnitsOf(units, segs) {
  const list = Array.isArray(units) ? units : [];
  const want = new Set(Array.isArray(segs) ? segs : []);
  const paras = new Set();
  for (const u of list) if (isSentence(u) && want.has(u.seg)) paras.add(u.paraId == null ? null : String(u.paraId));
  return list.filter((u) => isSentence(u) && paras.has(u.paraId == null ? null : String(u.paraId)));
}

/**
 * 문장 번호마다 첫 단위(조각이면 첫 조각이 대표 — `sentencesOf` 와 같은 규칙). `segs` 순서를 지킨다.
 * @returns {Array}
 */
export function firstUnitsOf(units, segs) {
  const list = Array.isArray(units) ? units : [];
  const out = [];
  for (const s of Array.isArray(segs) ? segs : []) {
    const u = list.find((x) => isSentence(x) && x.seg === s);
    if (u) out.push(u);
  }
  return out;
}

/**
 * `[8c-1b]` 4-1 탭 번역 계획 — 그 줄(또는 고른 문장들)에서 **띠에 보일 문장**과 **요청할 문단 단위**를 고른다. 순수 함수.
 *   · `hit` — 탭한 줄과 겹치는 문장(또는 `segsWanted`)의 대표 단위 `{seg, src}` — 번역 대상만(`translatable`)
 *   · `paraUnits` — 그 문장들의 **문단 전체** 단위(요청은 문단 단위 1회 — 7-2 · 17-7-6 6절 "문단당 1")
 *   · `para` — `paraUnits` 의 대표 단위 `{seg, src}`(번역 대상만 — [문단 전체])
 * @param {Array} units  문장 단위(`speaker.sentenceUnits()`)
 * @param {string} lineId
 * @param {?number[]} segsWanted  선택 줄 [문장 번역] 이 고른 문장 번호들(null 이면 그 줄과 겹치는 문장 전부)
 * @param {?Function} [translatable]  번역 대상 판정(8m·표 안내·인용 — `readalong.translatable`)
 * @returns {{hit:{seg:number, src:string}[], paraUnits:Array, para:{seg:number, src:string}[]}}
 */
export function tapPlan(units, lineId, segsWanted, translatable) {
  const ok = typeof translatable === 'function' ? translatable : () => true;
  const segs = Array.isArray(segsWanted) ? segsWanted : segsOnLine(units, lineId);
  const pick = (us) => firstUnitsOf(units, Array.from(new Set(us.map((u) => u.seg))))
    .filter((u) => ok(u))
    .map((u) => ({ seg: u.seg, src: u.src }));
  const hit = pick(firstUnitsOf(units, segs));
  const paraUnits = paraUnitsOf(units, hit.map((s) => s.seg));
  return { hit: hit, paraUnits: paraUnits, para: pick(paraUnits) };
}

/**
 * 선택 시작·끝점 → 줄 안 오프셋. 화면이 DOM 에서 "어디에 있나"만 골라 넘긴다:
 *   `at:'text'`   — 줄의 첫 텍스트 노드 안(`offset` 그대로, 길이로 자름)
 *   `at:'before'` — 첫 텍스트 앞(0)
 *   `at:'after'`  — `.hy`(숨긴 하이픈)·이음 공백·그 밖 뒤쪽 자식 안(줄 끝)
 * @param {{at:string, offset?:number, len:number}} p
 * @returns {number}
 */
export function lineOffsetOf(p) {
  const x = p || {};
  const len = Math.max(0, Math.floor(Number(x.len) || 0));
  if (x.at === 'text') {
    const o = Math.floor(Number(x.offset));
    return Number.isFinite(o) ? Math.min(len, Math.max(0, o)) : 0;
  }
  if (x.at === 'before') return 0;
  return len;
}

/** 낱말 글자(기본 규칙 — 17-7-1 `\p{L}[\p{L}\p{M}'’-]*` 의 한 글자 판정). 숫자도 낱말에 넣는다(용어 `CD4`·`HbA1c`). */
const WORD_CH = /[\p{L}\p{M}\p{N}'’-]/u;

/**
 * 17-7-1 — 선택을 낱말 경계로 넓힌다. 줄 끝 하이픈 결합(`cardio-` + 다음 줄 `vascular`)은 결합된 꼴로.
 * `segmenterFn(text)` 를 주면(화면이 낱말 단위 세그멘터를 감싸 넘김 — 17-7-1) 그 경계를 쓴다 —
 * `[{index, segment, isWordLike}]` 를 돌려주는 함수. 없으면 위 글자 규칙.
 * @param {string} lineText    줄의 첫 텍스트 노드 글자
 * @param {number} start
 * @param {number} end
 * @param {?string} [nextLineHead]  줄 끝이 하이픈 결합이면 다음 줄 첫 글자들(아니면 null)
 * @param {?Function} [segmenterFn]
 * @returns {{start:number, end:number, word:string, joined:boolean}}
 */
export function expandWord(lineText, start, end, nextLineHead, segmenterFn) {
  const s = String(lineText == null ? '' : lineText);
  let a = Math.max(0, Math.min(s.length, Math.floor(Number(start) || 0)));
  let b = Math.max(a, Math.min(s.length, Math.floor(Number(end) || 0)));
  if (typeof segmenterFn === 'function') {
    let segs = null;
    try { segs = segmenterFn(s); } catch (e) { segs = null; }
    if (Array.isArray(segs) && segs.length) {
      for (const g of segs) {
        if (!g || !g.isWordLike) continue;
        const gs = g.index;
        const ge = g.index + String(g.segment).length;
        if (gs < a && ge > a) a = gs;
        if (gs < b && ge > b) b = ge;
      }
    }
  } else {
    while (a > 0 && WORD_CH.test(s[a - 1])) a--;
    while (b < s.length && WORD_CH.test(s[b])) b++;
  }
  // 앞뒤 구두점·공백·하이픈·아포스트로피를 걷는다(낱말 **안**의 것은 둔다).
  while (a < b && !/[\p{L}\p{M}\p{N}]/u.test(s[a])) a++;
  while (b > a && !/[\p{L}\p{M}\p{N}]/u.test(s[b - 1])) b--;
  let word = s.slice(a, b);
  let joined = false;
  // 줄 끝 하이픈 결합 — `.hy`(숨긴 하이픈)는 첫 텍스트 노드 밖이라 `lineText` 끝에 없다. 낱말이 줄 끝까지 가면 다음 줄 첫 낱말을 잇는다.
  const head = typeof nextLineHead === 'string' ? nextLineHead : '';
  if (head && word && /^[\s\-‐‑]*$/u.test(s.slice(b))) {
    const m = head.match(/^[\p{L}\p{M}\p{N}'’]+/u);
    if (m) { word = word + m[0]; joined = true; }
  }
  return { start: a, end: b, word: word, joined: joined };
}

/**
 * 17-7-1 — 선택이 [단어 번역] 한계 안인가. 낱말 수는 공백으로 가른 덩어리 수, 글자 수는 코드 포인트.
 * @returns {{words:number, chars:number, tooLong:boolean}}
 */
export function clampSelection(text) {
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  const words = s ? s.split(' ').length : 0;
  const chars = Array.from(s).length;
  return { words: words, chars: chars, tooLong: words > SEL_LIMIT.WORDS || chars > SEL_LIMIT.CHARS };
}

/**
 * 4-1·4-2 가림 굴리기 — 아래변 `bottom` 이 가림 윗변 `edge` − `gap` 보다 아래면 그 차이(px)만큼 굴린다. 아니면 0.
 * @returns {number}
 */
export function liftDelta(bottom, edge, gap) {
  const b = Number(bottom);
  const e = Number(edge);
  const g = Number.isFinite(Number(gap)) ? Number(gap) : 4;
  if (!Number.isFinite(b) || !Number.isFinite(e)) return 0;
  const d = b - (e - g);
  return d > 0 ? Math.ceil(d) : 0;
}

/**
 * `[8c-1c]` 4-1 가림 굴리기의 가장자리 — 선택 줄이 떠 있으면(띠가 새로 나타나며 그 위로 올라간) **선택 줄 윗변**, 아니면 띠 윗변
 * (8c-1 Review 8c1R-9 #4 · 8c-1b 재검증 8c1bR-8 #7 — node 가 지키게 순수 함수로 뗐다). 둘 다 없으면 null(굴리지 않음).
 * @param {?number} selTop  선택 줄 윗변(px) — 안 보이면 null
 * @param {?number} bandTop  띠 윗변(px) — 안 보이면 null
 * @returns {?number}
 */
export function liftEdge(selTop, bandTop) {
  if (selTop != null && Number.isFinite(Number(selTop))) return Number(selTop);
  if (bandTop != null && Number.isFinite(Number(bandTop))) return Number(bandTop);
  return null;
}

/**
 * `[8c-1c]` 줄 상자(`top`·`bottom`)가 본문 영역(`areaTop`..`areaBottom`) 밖으로 **조금이라도** 나갔는가 — [×]·Esc 로 띠를 닫고
 * 포커스를 돌려놓을 줄이 화면 밖이면 가장 가까운 쪽으로 굴린다(8c1bR-8 #5). 값이 수가 아니면 false(굴리지 않음).
 * @returns {boolean}
 */
export function outOfView(top, bottom, areaTop, areaBottom) {
  const t = Number(top); const b = Number(bottom); const a = Number(areaTop); const z = Number(areaBottom);
  if (![t, b, a, z].every(Number.isFinite)) return false;
  return t < a || b > z;
}
