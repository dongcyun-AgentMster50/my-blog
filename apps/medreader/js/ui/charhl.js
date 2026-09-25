/* ============================================================
   MedReader — 문자 구간 하이라이트 (spec 6-5 `[수정 2026-09-25 — 10a]`)

   ── 왜 따로 빼는가 ──────────────────────────────────────
   10a 가 리플로우 뷰에 넣은 장치를 **퀴즈 해설 낭독도 그대로 써야** 한다.
   복사하면 규칙이 두 벌이 되고, 두 벌이 되면 언젠가 어긋난다
   (6a 에서 `lineBBox` 와 `extendRun` 이 그랬다). 화면에 기대는 조각은
   `findLine` 하나뿐이니 그것만 호출자가 준다.

   ── CSS Custom Highlight API ───────────────────────────
   DOM 을 건드리지 않고 `Range` 로 칠한다. 줄 span 을 쪼개지 않으므로
   6a 에서 데었던 이음새 문제(하이라이트가 단어를 자르던 것)가 돌아오지 않는다.
   미지원 브라우저에서는 `false` 를 돌려주고, 호출자가 줄 단위로 물러선다.

   ── 3-2 ────────────────────────────────────────────────
   UI 보조 계층이다. 문구를 만들지 않는다 — 좌표와 boolean 만 다룬다.
   ============================================================ */

/** 이 브라우저가 문자 구간 하이라이트를 할 수 있는가. */
export function highlightsSupported() {
  return typeof CSS !== 'undefined' && !!CSS && !!CSS.highlights && typeof Highlight === 'function';
}

/** 레지스트리에서 지운다. 지원하지 않으면 할 일이 없다. */
export function clearCharRanges(name) {
  if (!highlightsSupported()) return;
  try { CSS.highlights.delete(String(name)); } catch (e) { /* 레지스트리 접근 실패는 치명적이지 않다 */ }
}

/**
 * `ranges` 를 `Range` 로 바꿔 레지스트리에 올린다.
 *
 * @param {string} name      `::highlight(<name>)` 의 이름
 * @param {Array<{id,start,end}>} ranges  줄 안의 **글자 오프셋**(10a `Unit.ranges`)
 * @param {(id:string)=>Element|null} findLine  줄 id → 그 줄의 요소
 * @returns {boolean} 하나라도 칠했는가. false 면 호출자가 줄 단위로 물러선다.
 */
export function paintCharRanges(name, ranges, findLine) {
  if (!highlightsSupported() || typeof findLine !== 'function') return false;
  const list = Array.isArray(ranges) ? ranges : [];
  const out = [];

  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || r.id == null) continue;
    const node = findLine(String(r.id));
    if (!node) continue;
    const tn = node.firstChild;
    if (!tn || tn.nodeType !== 3) continue;         // 텍스트 노드가 아니면 건너뛴다
    const len = tn.length;
    const s = Math.min(len, Math.max(0, Math.floor(Number(r.start))));
    const e = Math.min(len, Math.max(0, Math.floor(Number(r.end))));
    if (!(e > s)) continue;
    try {
      const rg = document.createRange();
      rg.setStart(tn, s);
      rg.setEnd(tn, e);
      out.push(rg);
    } catch (x) { /* 이 줄만 건너뛴다 */ }
  }

  if (!out.length) { clearCharRanges(name); return false; }
  try {
    CSS.highlights.set(String(name), new Highlight(...out));
  } catch (x) {
    clearCharRanges(name);
    return false;
  }
  return true;
}
