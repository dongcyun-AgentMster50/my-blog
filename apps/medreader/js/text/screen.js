/* ============================================================
   MedReader — 화면 글자 (순수 모듈 · spec 17-8-12 U6)

   리플로우가 보이는 글자·낭독 큐·검색 글자가 **같은 함수**를 지나게 하려고
   `ui/reader.js` 의 `describePage`·`flowParasOf`·`paraBlock`·`FOLD_ROLES`·`REF_ROLE` 과
   `tts/text.js` 의 `joinPieces`·`localRange` 를 **줄 그대로** 옮겨 왔다(8g-1 단계 1 — 옮김만).
   두 파일은 같은 함수 객체를 다시 export 한다 — 동작·기존 import 경로 불변.

   브라우저 전역(DOM·저장소·네트워크)을 모른다 — 16-A grep(tests/layout.test.mjs D2)이 지킨다.
   ============================================================ */

import { joinHyphen } from './hyphen.js';

/**
 * 4-7 의 비본문 역할. 이 줄들은 문단에 들어가지 않고 `details` 로 접힌다
 * (4-7 오판의 복구 수단 — 본문이 머리말로 잘못 판정돼도 사용자가 펼쳐 볼 수 있다).
 *
 * ★ `rotated` 줄의 `bbox` 는 신뢰할 수 없다(Review 주의사항 5 — `lineBBox` 가
 *   90° 회전 아이템의 `width` 를 수평 폭으로 더한다). 그래서 이 뷰는 어떤
 *   줄의 좌표도 쓰지 않는다. **텍스트만** 그린다.
 */
export const FOLD_ROLES = Object.freeze(['header', 'footer', 'pageno', 'rotated', 'colhead']);

/* `[8i — spec 4-13-5 · D3 · D4]` 행 표의 쪽 번호 줄(role 'ref'). 이름표(rowhead) 문단이 그 행의 쪽 번호를
 * `refLineIds` 로 들고 있으면 이름표 끝에 작은 회색 숫자로 보여 준다(`span.rt-ref` — `.line` 이 아니다 →
 * 하이라이트·탭·낭독 대상 아님). 이름표가 없는 행의 쪽 번호 줄만 접힌 줄로 간다 — 잃어버리지 않는다.
 * 열 머리 행(role 'colhead')은 늘 접는다(위 FOLD_ROLES). */
export const REF_ROLE = 'ref';

/**
 * `fromStored` 로 되살린 `PageLayout` → **DOM 기술(記述)**. 순수 함수다.
 *
 * 블록 셋:
 *   { type:'para',   id, kind, lines:[{id, text, hyphen:'none'|'hidden'|'kept'}] }
 *   { type:'table',  regionId, kind }
 *   { type:'folded', lines:[{id, text, role}] }
 *
 * 순서는 **읽기 순서**다 — `lines` 는 4-5 가 이미 컬럼 순서로 정렬해 두었으므로
 * 줄을 훑으며 처음 만나는 문단·표를 그 자리에 낸다. 접히는 줄은 모아서 맨 뒤에
 * 한 덩어리로 둔다(12-4 의 `details.folded`).
 *
 * `hyphen` 은 **줄 사이를 어떻게 이을지**다:
 *   'hidden' — 하이픈을 지우고 붙인다(`cardio-` + `vascular` → cardiovascular).
 *              끝의 `-` 를 `span.hy` 로 감춰 시각만 결합한다.
 *   'kept'   — 하이픈을 살려 붙인다(`methicillin-` + `resistant`).
 *   'none'   — 공백으로 잇는다.
 * 판정은 `fromStored` 가 문단 텍스트를 만들 때 쓴 것과 **같은 함수**(`joinHyphen`)다.
 * 그래서 화면 글자와 `paragraphs[].text` 가 어긋날 수 없다(테스트가 고정한다).
 */
export function describePage(layout) {
  const L = layout || {};
  const lines = Array.isArray(L.lines) ? L.lines : [];
  const paragraphs = Array.isArray(L.paragraphs) ? L.paragraphs : [];
  const regions = Array.isArray(L.regions) ? L.regions : [];

  const lineById = new Map();
  for (let i = 0; i < lines.length; i++) lineById.set(lines[i].id, lines[i]);

  const paraById = new Map();
  for (let i = 0; i < paragraphs.length; i++) paraById.set(paragraphs[i].id, paragraphs[i]);

  const regionById = new Map();
  const regionOfLine = new Map();
  for (let i = 0; i < regions.length; i++) {
    const g = regions[i];
    regionById.set(g.id, g);
    const ids = Array.isArray(g.lineIds) ? g.lineIds : [];
    for (let k = 0; k < ids.length; k++) regionOfLine.set(ids[k], g.id);
  }

  const foldSet = new Set(FOLD_ROLES);
  // [8i] 이름표 문단이 보여 주는 쪽 번호 줄 — 블록으로 내지 않는다(rowhead 블록의 refs 가 보여 준다)
  const refShown = new Set();
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (p.kind !== 'rowhead' || !Array.isArray(p.refLineIds)) continue;
    for (let k = 0; k < p.refLineIds.length; k++) if (lineById.has(p.refLineIds[k])) refShown.add(p.refLineIds[k]);
  }
  const blocks = [];
  const folded = [];
  const doneParas = new Set();
  const doneRegions = new Set();

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const regionId = regionOfLine.get(l.id) || l.regionId || null;

    if (regionId) {
      if (!doneRegions.has(regionId)) {
        doneRegions.add(regionId);
        const g = regionById.get(regionId);
        blocks.push({ type: 'table', regionId: regionId, kind: (g && g.kind) || 'table' });
      }
      continue;
    }

    if (foldSet.has(l.role)) {
      folded.push({ id: l.id, text: textOf(l), role: l.role });
      continue;
    }

    // [8i] 쪽 번호 줄은 흐름 밖이다 — 이름표 끝에 보이거나(refShown), 아니면 접힌 줄로. 절대 낭독 문단이 되지 않는다.
    if (l.role === REF_ROLE) {
      if (!refShown.has(l.id)) folded.push({ id: l.id, text: textOf(l), role: l.role });
      continue;
    }

    if (l.paraId && paraById.has(l.paraId)) {
      if (!doneParas.has(l.paraId)) {
        doneParas.add(l.paraId);
        blocks.push(paraBlock(paraById.get(l.paraId), lineById));
      }
      continue;
    }

    // 문단에 속하지 않은 본문 줄 — 잃어버리지 않는다. 한 줄짜리 문단으로 낸다.
    if (textOf(l)) blocks.push({ type: 'para', id: null, kind: 'body', lines: [{ id: l.id, text: textOf(l), hyphen: 'none' }] });
  }

  // 줄 목록에 없는 문단(저장본이 깨진 경우) — 조용히 버리지 않고 뒤에 붙인다.
  for (let i = 0; i < paragraphs.length; i++) {
    if (!doneParas.has(paragraphs[i].id)) {
      const b = paraBlock(paragraphs[i], lineById);
      if (b.lines.length) blocks.push(b);
    }
  }

  if (folded.length) blocks.push({ type: 'folded', lines: folded });

  return { pageNo: L.pageNo, blocks: blocks };
}

function paraBlock(p, lineById) {
  const out = [];
  const ids = Array.isArray(p.lineIds) ? p.lineIds : [];
  for (let i = 0; i < ids.length; i++) {
    const l = lineById.get(ids[i]);
    if (!l) continue;                        // 저장본이 깨진 줄은 건너뛴다(fromStored 와 같은 태도)
    out.push({ id: l.id, text: textOf(l), hyphen: 'none' });
  }
  for (let i = 0; i < out.length - 1; i++) {
    const r = joinHyphen(out[i].text, out[i + 1].text);
    out[i].hyphen = r.hyphenJoin ? 'hidden' : (r.keptHyphen ? 'kept' : 'none');
  }
  const block = { type: 'para', id: p.id, kind: p.kind || 'body', lines: out };
  // [8i — D4] 이름표 문단: 그 행의 쪽 번호 글자들(화면 표시만 — flowLineIdsOf·flowParasOf 는 lines 만 본다)
  if (p.kind === 'rowhead' && Array.isArray(p.refLineIds)) {
    const refs = [];
    for (let i = 0; i < p.refLineIds.length; i++) {
      const l = lineById.get(p.refLineIds[i]);
      if (l && textOf(l)) refs.push(textOf(l));
    }
    if (refs.length) block.refs = refs;
  }
  return block;
}

function textOf(l) { return String((l && l.text) || '').trim(); }

/**
 * ★ `[8a]` spec 7-8-2 원칙 2 — `flowParas()` 의 **순수 부분**. 표 안내를 끼우기 전의 문단들.
 *
 * 지금 쪽(`flowParas()`)과 그 뒤의 쪽들(UI 가 낭독 동반 번역에 주입할
 * `loadParas(n) = flowParasOf(describePage(fromStored(rec)))`)이 **같은 함수**를 지나게 하려고
 * 떼어 냈다. 동작은 그대로다 — `flowParas()` 가 이것에 표 안내만 더한다.
 *
 * @param {{blocks?:Array}} desc `describePage()` 결과
 * @returns {{id:string|null, kind:string, lines:Array}[]} 읽기 순서
 */
export function flowParasOf(desc) {
  const blocks = (desc && desc.blocks) || [];
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== 'para') continue;
    out.push({ id: blocks[i].id, kind: blocks[i].kind, lines: blocks[i].lines });
  }
  return out;
}

function str(v) { return String(v == null ? '' : v); }

/**
 * 줄 하나를 **다음 줄과 어떻게 이을지**에 따라 다듬는다.
 * `describePage()` 의 `hyphen` 값을 그대로 받는다(4단계 계약).
 *
 *   'hidden' — 줄바꿈 하이픈. 끝의 `-` 를 **지우고** 공백 없이 붙인다.
 *   'kept'   — 진짜 하이픈. `-` 를 살리고 공백 없이 붙인다.
 *   'none'   — 공백으로 잇는다.
 *
 * ★ `'hidden'` 의 `-` 제거가 이 단계의 핵심 함정 대응이다.
 */
export function joinPieces(lines) {
  const list = Array.isArray(lines) ? lines : [];
  let text = '';
  const spans = [];   // [{id, start, end}] — text 안에서 그 줄이 차지한 구간

  for (let i = 0; i < list.length; i++) {
    const ln = list[i] || {};
    let piece = str(ln.text).replace(/\s+/g, ' ').trim();
    const hy = ln.hyphen || 'none';
    const last = i === list.length - 1;

    if (!last && hy === 'hidden' && piece.endsWith('-')) piece = piece.slice(0, -1);

    const start = text.length;
    text += piece;
    spans.push({ id: ln.id, start: start, end: text.length });

    if (last) continue;
    // 'hidden'·'kept' 는 공백 없이 다음 줄과 붙는다(12-4 의 화면 글자와 같다).
    if (hy === 'none') text += ' ';
  }

  return { text: text, spans: spans };
}

/**
 * ★ 10a — 줄 span 하나를 **그 줄 안의 오프셋**으로 접는다.
 *
 * **export 하는 이유**: `emit` 을 거치면 `Math.max`/`Math.min` 과 아래 `e <= s`
 * 폴백이 이미 값을 가둬서 클램프가 **한 번도 시험되지 않는다**(변이를 넣어도
 * 아무 테스트가 빨개지지 않았다). 클램프는 `spansIn` 이 어긋난 span 을 돌려주는
 * 병적 경로의 마지막 방어선이므로, 그 경계를 테스트가 직접 고정한다.
 *
 * `from`/`to` 는 문단을 이어 붙인 텍스트 안의 문장 구간이고, `sp.start`/`sp.end`
 * 는 같은 좌표계의 줄 구간이다. 둘의 교집합을 줄 시작점 기준으로 옮긴다.
 *
 * 줄 길이로 **클램프**한다 — `joinPieces` 가 `'hidden'` 하이픈의 `-` 를 떼므로
 * 여기 길이는 화면 글자 수보다 1 작을 수 있고, 계산이 어긋나면 DOM 오프셋이
 * 범위를 벗어나 `Range` 가 던진다.
 *
 * 교집합이 비면(병적 입력 — `spansIn` 의 폴백 경로) **줄 통째**로 돌려준다.
 * 빈 구간을 그리는 것보다 넓게 칠하는 쪽이 낫다(이 단계의 일관된 판단).
 */
export function localRange(sp, from, to) {
  const len = Math.max(0, sp.end - sp.start);
  if (len === 0) return { id: sp.id, start: 0, end: 0 };
  // 줄 시작점 기준으로 옮기고 **줄 길이로 클램프**한다. 클램프가 교집합을
  // 겸한다 — `max`/`min` 을 한 번 더 두면 클램프가 죽은 코드가 되고, 그러면
  // 어떤 테스트도 이 경계를 지키지 못한다(변이로 확인했다).
  const cl = (v) => Math.min(len, Math.max(0, v));
  let s = cl(from - sp.start);
  let e = cl(to - sp.start);
  if (e <= s) { s = 0; e = len; }
  return { id: sp.id, start: s, end: e };
}
