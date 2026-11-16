/* ============================================================
   MedReader — 하단 컨트롤 바와 낭독 배선 (spec 12-3 · 6-3 · 6-4 · 6-5)

   ── 이 파일이 하는 일 ───────────────────────────────────
   `tts/speaker.js` 는 **코드와 이벤트만** 낸다(3-2). 그것을 화면·문장·설정에
   잇는 곳이 여기다.
     · 버튼과 속도 팝오버(12-3)
     · `speaker` 이벤트 → `reader` 하이라이트·자동 스크롤(6-5)
     · 음성 목록·"영어 음성 없음" 배너(6-3)
     · `visibilitychange` · Wake Lock(6-4)

   ── 기능 감지와 버그 대응을 섞지 않는다 ─────────────────
   **기능 감지로 분기하는 것**: Wake Lock 유무, 음성 팩 유무, `speechSynthesis`
   자체의 유무. 없으면 안내한다.
   **버그 대응**: `speaker.js` 안에 있고 **분기 없이 늘** 돈다. 데스크톱에서
   재현되지 않는다고 빼면 실기기에서만 깨지는 코드가 된다(6-4).
   ============================================================ */

import * as settings from '../settings.js';
import { t, applyTranslations, formatNumber, onLangChange, getLang } from '../i18n/index.js';
import { TTS, AI } from '../config.js';
import { createSpeaker, CODES } from '../tts/speaker.js';
import { sharedVoiceWatch, resolveSpeech, speechPref, languageVoices } from '../tts/voices.js';
import {
  flowParas, currentPage, goToPageForSpeech, showSpoken, markDone,
  onLineTap, onPageRender, sourceLang, docDomain, loadFlowParas, flowLineIds,
  // `[8i-1]` 판 바뀜 재추출 중 지금 쪽을 새 판으로(spec 4-13-9)
  setSpeechState, currentPageReady, whenCurrentPageReady, remapLineId, setCurrentLines,
  // `[8l]` 스캔본 문서의 ▶ 갈래(spec 17-5-1 3)
  docScanVerdict,
  // `[8d]` 문장 아래 번역(spec 7-7-1) — 줄 찾기·DOM 을 새로 붙인 알림
  lineElement, onPageRepaint,
  // `[9a]` 이어폰·잠금 화면 알림의 제목(spec 17-1-1 5)
  docTitle,
  // `[8c-1]` 탭한 줄·선택이 띠·선택 줄에 가리면 굴린다(spec 17-7-6 4-1·4-2)
  liftAbove, liftLineAbove, focusLine
} from './reader.js';
// `[8c-1 — spec 17-7-6 4-1·4-2]` 줄 → 문장(순수) · 선택 동작 줄.
import { unitAt, tapPlan, liftEdge } from '../text/select.js';
import { initSelBar } from './selbar.js';
import { blocksPlay } from '../text/scan.js';
// 7b — 번역 따라가기 줄. 설정 AI 탭과 **같은 그리기 함수**를 쓴다(12-3 · 16-D0).
import { renderReadalongRow } from './settings.js';
// `[8b-1]` 유효 모드 계산에 쓰는 값 읽기 — 설정 AI 탭과 같은 함수.
import { readalongState, normalizeTranslationLang } from './settings.js';
// `[8b-1]` 낭독 동반 번역 서비스 배선(7-8). 화면 요소는 8b-2(자막 띠)가 붙인다 — 여기는 배선만.
import { createPipeline } from '../ai/pipeline.js';
import { createReadalong } from '../ai/readalong.js';
import * as keys from '../privacy/keys.js';
import { hashHexSync } from '../hash.js';
import { SUPPORTED_SRC } from '../text/lang.js';
// `[8b-2]` 하단 자막 띠(7-7) — 8b-1 계약 8절: controls 가 만든 readalong·speaker 를 넘기는 한 줄.
import { initTrBand } from './trband.js';
// `[8d]` 문장 아래 번역(7-7-1) — 같은 readalong·speaker 를 넘긴다(요청하지 않는 화면 — pipeline 을 모른다).
import { initInlineTr } from './inlinetr.js';
// `[9a]` 이어폰·잠금 화면 버튼(Media Session — spec 17-1-1). speaker 공개 함수와 `pressPlay()` 만 부른다.
import { createHandsfree } from './handsfree.js';
// `[9b — spec 17-1-2]` 음성 명령 — 마이크 단추·흐름(`ui/voice.js`). speaker 공개 함수·`pressPlay()`·`syncReadalong()`·`paintRate()` 를 주입한다.
import { createVoice, mountVoice, recognitionOf } from './voice.js';
// `[9b]` 번역 켜기·끄기 — 설정 화면 단추와 같은 길(저장 + 끄기 전 모드 기억 + 줄 다시 그리기).
import { setReadalongMode, lastOnMode } from './settings.js';

let els = null;
let speaker = null;
let voices = [];
/** `[8b-1]` 파이프라인(8a)과 낭독 동반 번역 서비스 — 리더 컨트롤이 하나씩 갖는다. */
let pipeline = null;
let readalong = null;
/** `[8b-2]` 자막 띠 — `sync()`(유효 모드 → 자리) · `leave()`(리더를 떠남). */
let trband = null;
/** `[8d]` 문장 아래 번역 — `sync()` · `willShow(u)`(보이기 직전) · `leave()`. */
let inlinetr = null;
/** `[9a]` 이어폰·잠금 화면 버튼 — `arm()`(쪽이 그려질 때) · `disarm()`(리더를 떠남) · `refreshMeta()` · `debug()`. */
let handsfree = null;
/** `[9b]` 음성 명령 — `press()`·`cancel()`·`arm()`·`leave()`·`isListening()`·`debug()`. 인식기가 없으면 단추가 없다. */
let voice = null;
/** `[8c-1]` 선택 동작 줄 — `hide()`·`clear()`·`refresh()`. */
let selbar = null;
/** `[8d]` 마지막으로 보인 단위 — 현재 블록이 커지면 6-5 편안 영역을 다시 본다. */
let lastShown = null;
/** 키·모델·프로바이더 지문(원문 키를 들고 있지 않는다). 바뀌면 `pipeline.configChanged`. */
let lastConfigFp = null;
/** `[8b-1]` 음성 목록 감시 구독(한 번). */
let voicesSub = null;
/** 마지막 진행 값 — 언어를 바꾸면 이 문장도 다시 만들어야 한다(16-H). */
let lastProgress = { index: 0, total: 0 };
/** 6-3 — 배너는 **세션당 1회**다. 닫고 나면 이 세션에서는 다시 뜨지 않는다. */
const noticedOnce = new Set();

/* ────────────────────────────────────────────────────────
   1. 배선
   ──────────────────────────────────────────────────────── */

export function initControls() {
  if (els) return;
  const root = document.querySelector('[data-screen="reader"]');
  if (!root) return;

  els = {
    root: root,
    bar: root.querySelector('#ttsBar'),
    play: root.querySelector('#ttsPlay'),
    glyph: root.querySelector('#ttsGlyph'),
    prev: root.querySelector('#ttsPrev'),
    next: root.querySelector('#ttsNext'),
    rate: root.querySelector('#ttsRate'),
    ratePanel: root.querySelector('#ttsRatePanel'),
    rateSteps: root.querySelector('#ttsRateSteps'),
    rateOut: root.querySelector('#ttsRateOut'),
    unitRow: root.querySelector('#ttsUnitRow'),
    repeatRow: root.querySelector('#ttsRepeatRow'),
    repeatOut: root.querySelector('#ttsRepeatOut'),
    countRow: root.querySelector('#ttsCountRow'),
    countChoices: root.querySelector('#ttsCountChoices'),
    spanRow: root.querySelector('#ttsSpanRow'),
    spanChoices: root.querySelector('#ttsSpanChoices'),
    spanOut: root.querySelector('#ttsSpanOut'),
    rateClose: root.querySelector('#ttsRateClose'),
    readalongHost: root.querySelector('#ttsReadalongRow'),
    progress: root.querySelector('#ttsProgress')
  };
  if (!els.bar) { els = null; return; }

  /* `[8b-1]` 7-8 — 파이프라인·낭독 동반 번역. 키는 호출마다 저장소에서 읽는다(13절 — 들고 있지 않는다).
     `loadParas` 는 리더가 주입한다(서비스가 화면 계층을 import 하지 않게 — 3-2). */
  pipeline = createPipeline({ getKey: () => keys.readKeySecret(providerId()) || '' });
  readalong = createReadalong({ pipeline: pipeline, loadParas: loadFlowParas, getSetting: settings.get });

  speaker = createSpeaker({
    synth: (typeof window !== 'undefined' && window.speechSynthesis) || null,
    makeUtterance: makeUtterance,
    translation: readalong,
    view: {
      paras: flowParas,
      page: function () { const p = currentPage(); return { page: p.page, pageCount: p.pageCount }; },
      goToPage: goToPageForSpeech,
      // `[8d]` 문장 아래 표시면 지금 문장의 블록을 **먼저** 넣는다 — 6-5 편안 영역 판정이 그 블록까지 본다(7-7-1).
      // `[다듬기 2 — 8dR-8 L3]` 보조 화면(블록)의 오류가 하이라이트·스크롤(`showSpoken`)을 막지 않게 감싼다.
      show: function (u) { lastShown = u || null; if (inlinetr) { try { inlinetr.willShow(u); } catch (e) { /* 블록 없이 읽기는 계속 */ } } return showSpoken(u); },
      markDone: function (u) {
        const ids = u.lineIds || [];
        for (let i = 0; i < ids.length; i++) markDone(ids[i], true);
      },
      // `[8h-1]` 걸러진 인용 줄을 탭하면 화면 순서로 그 뒤의 첫 발화로 간다(spec 6-6-2).
      lineOrder: flowLineIds,
      // `[8i-1]` 지금 쪽이 옛 판이면 재생이 새 판을 기다린다 · 새 판으로 다시 그린 뒤 줄 id 대응 · 멈춘 자리 다시 칠하기
      ready: currentPageReady,
      whenReady: function () { return whenCurrentPageReady(); },
      remapLine: remapLineId,
      highlight: function (u) { return setCurrentLines(u.lineIds || [], u.ranges); }
    },
    requestWakeLock: requestWakeLock,
    // `[8h-1 — spec 6-6-2]` 9-3 `tts.readCitations`(기본 false). speaker 가 **큐를 만들 때마다** 읽는다 —
    // 설정 화면에서 바꾸고 돌아오면 다음 큐(재생·쪽 넘김·다시 그리기)부터 따른다. 동기(캐시 읽기)다.
    readCitations: function () { return settings.get('tts.readCitations') === true; },
    // `[8m — spec 19-1-2 2-3 · 2-5]` 9-3 `tts.scriptSwitch`(기본 켬) — 큐를 만들 때마다 읽는다(다음 큐부터).
    scriptSwitch: function () { return settings.get('tts.scriptSwitch') !== false; },
    // 전환한 단위의 음성 — 8k 해석 함수 그대로(사용자 고르기·억양). 동기(목록·설정 캐시 읽기).
    langSpeech: function (lang) { return langSpeechOf(lang, voices, settings.get); }
  });

  // `[8b-2]` 띠가 같은 두 객체의 이벤트를 듣는다(띠는 speaker 를 조작하지 않는다).
  trband = initTrBand({ readalong: readalong, speaker: speaker });
  // `[8c-1]` 탭 모드가 열린 동안 문장 아래 표시의 `data-tr-inline` 을 뗀다(8cf-D5 — 띠가 보이게). inlinetr 는 아래에서 만든다.
  trband.setInlineSuspend(function (on) { if (inlinetr) inlinetr.suspend(on); });

  /* ── 버튼 ──────────────────────────────────────────
     ★ 6-4 (5) — 재생은 **핸들러 안에서 동기적으로** `speak()` 까지 간다.
     `play()` 앞에 `await` 를 두면 안드로이드에서 소리가 나지 않는다.
     `[9a]` 본문은 `pressPlay()` — 이어폰·알림의 재생도 같은 함수를 부른다(spec 17-1-1 4). */
  els.play.addEventListener('click', pressPlay);
  // `[9b]` 듣는 중이면 듣기를 먼저 취소하고 평소대로(손이 이긴다 — 17-1-2 3절).
  els.prev.addEventListener('click', () => { cancelVoice(); speaker.prev(); });
  els.next.addEventListener('click', () => { cancelVoice(); speaker.next(); });

  els.rate.addEventListener('click', () => toggleRatePanel());
  els.rateClose.addEventListener('click', () => toggleRatePanel(false));

  /* ── 속도 (5b) — 계단 버튼. 연속 슬라이더를 걷어냈다 ──
     ★ 화면에 쓰는 일은 **전부 `paintRate()`** 한 곳이다. 어긋남의 원인이
       "바꾼 쪽이 자기 쪽만 다시 그렸다" 였다(보고서 4번 참조). */
  els.rateSteps.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-rate]');
    if (!btn) return;
    speaker.setRate(btn.getAttribute('data-rate'));
    paintRate();
    settings.set('tts.rate', speaker.getRate()).catch(() => { /* 저장 실패가 낭독을 막지 않는다 */ });
  });

  els.unitRow.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-unit]');
    if (!btn) return;
    const u = btn.getAttribute('data-unit');
    speaker.setUnit(u);
    settings.set('tts.unit', speaker.getUnit()).catch(() => { });
    syncReadalong();                     // 8b-1 — 줄 단위면 낭독 동반 번역이 쉰다(7-8-1)
    paintRatePanel();
  });

  /* ── 반복 (5b) ────────────────────────────────────── */
  els.repeatRow.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-repeat]');
    if (!btn) return;
    speaker.setRepeat(btn.getAttribute('data-repeat'));
    paintRepeat();
  });
  els.countChoices.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-count]');
    if (!btn) return;
    const n = Number(btn.getAttribute('data-count'));
    speaker.setRepeat(speaker.getRepeat().mode, n);
    settings.set('tts.repeat.count', speaker.getRepeat().count).catch(() => { });
    paintRepeat();
  });
  els.spanChoices.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-edge]');
    if (!btn) return;
    speaker.setRepeatEdge(btn.getAttribute('data-edge'));
    paintRepeat();
  });

  /* ── speaker → 화면 ───────────────────────────────── */
  speaker.addEventListener('linechange', (ev) => {
    const d = ev.detail || {};
    paintProgress(d.index, d.total);
    readalong.onProgress(d.page, d.seg);          // 8b-1 — 커서만 옮기고 refill(7-8-3)
  });
  // 8b-1 — 쪽 큐를 새로 만들었다(play·쪽 넘김·reload) → 그 쪽 문장을 흐름에 넣는다(7-8-3 onQueue).
  speaker.addEventListener('queue', (ev) => {
    const d = ev.detail || {};
    readalong.onQueue(d.page, d.units, d.seg);
  });
  speaker.addEventListener('statechange', () => {
    setSpeechState(speaker.getState());          // 8i-1 — 낭독 중이면 지금 쪽 다시 그리기를 미룬다
    paintBar();
    readalong.setActive(speaker.getState() === 'speaking');   // 낭독 중일 때만 요청한다
    // `[8g-4a]` 검색 띠 — [▶] 를 누르면 검색 강조를 지운다(17-8-8). 구독자 예외가 낭독을 막지 않는다.
    for (const fn of speechListeners) { try { fn(speaker.getState()); } catch (e) { /* 구독자 예외 */ } }
  });
  speaker.addEventListener('repeatchange', () => { paintRepeat(); paintProgress(lastProgress.index, lastProgress.total); });
  speaker.addEventListener('end', () => { paintBar(); paintProgress(0, 0); });
  speaker.addEventListener('error', (ev) => onSpeakerError((ev.detail || {}).code, ev.detail || {}));

  /* ── 6-5 줄 탭 — 낭독 중(`speaking`·`paused`)이면 그 줄부터(8cf-D3 — 지금 그대로). 쪽 넘김 대기면 무시.
     `[8c-1 — spec 17-7-6 4-1]` 그 밖(`idle`·`error`)이면 **탭 번역** — 그 줄 문장의 번역을 띠에(문단 1회 요청). ── */
  onLineTap((lineId) => {
    cancelVoice();                       // `[9b]` 듣는 중 줄 탭도 손이 이긴다
    const s = speaker.getState();
    if (s === 'speaking' || s === 'paused') { speaker.play(lineId); return; }
    if (s === 'waiting-page') return;
    openTapFor(lineId, null);
  });

  /* ── `[8c-1 — spec 17-7-6 4-2]` 선택 동작 줄 — 길게 눌러 고른 글자 위 동작. 단추는 스냅숏만 쓴다. ── */
  selbar = initSelBar({
    root: root,
    onAction: onSelAction,
    lift: function (bottom, edge) { liftAbove(bottom, edge); }
  });
  // `[8c-1]` 쪽이 바뀌면(쪽 넘김·뷰 전환·새 판) 탭 띠를 닫는다 — 다른 쪽 문장의 번역이 남지 않게.
  onPageRender(() => { if (trband) trband.closeTap(); });
  // `[8c-1c]` 숨긴 리더를 다시 보이면(검색 화면에서 돌아옴 — 다시 그리지 않는다) 띠 자리를 다시 잡는다: 떠날 때 `closeTapBand` 가
  // 숨은 화면 기준으로 띠를 숨겼다(보이기 모드의 낭독 띠가 돌아와서도 숨은 채 남지 않게).
  onPageRepaint(() => { if (trband) trband.sync(); });

  /* 쪽이 새로 그려지면 큐를 그 쪽 것으로 갈아 끼운다.
     `[7c]` 원문 언어가 바뀌었으면(서재 [⋯]·자동 추정 — 리더가 `medreader:doclang` 을 듣고
     여기를 부른다) **음성을 먼저** 다시 고르고 큐를 간다. 순서가 바뀌면 새 큐가 옛 언어로 나뉜다. */
  onPageRender(() => { syncSourceVoice(); speaker.reload(); syncReadalong(); attachDebugHook(); });
  // `[8i-1]` `refreshed` — 같은 쪽을 새 판으로 다시 그렸다(멈춘 채). 위 구독자가 큐를 새 판으로 갈았다(줄 id 는
  // `view.remapLine` 으로 옮김) — 멈춘 자리(다음 재생 시작점)를 스크롤 없이 다시 칠한다. 구독 순서 = 부르는 순서.
  onPageRender((p) => { if (p && p.refreshed) speaker.reshow(); });

  // `[8d]` 문장 아래 번역(7-7-1). 그리기는 `syncReadalong()` 끝의 `inlinetr.sync()`(문서·유효 모드를 맞춘 뒤)가 한다.
  inlinetr = initInlineTr({
    readalong: readalong,
    speaker: speaker,
    mount: root.querySelector('#readerMount'),
    root: root,
    lineElement: lineElement,
    onPageRepaint: onPageRepaint,
    // 현재 블록에 번역이 늦게 도착해 커졌다 — 읽는 중이면 같은 단위로 6-5 를 다시(하이라이트 같음 · 편안 영역 밖일 때만 굴림).
    recheck: function () { if (lastShown && speaker.getState() === 'speaking') showSpoken(lastShown); }
  });

  /* ── 6-4 백그라운드 ────────────────────────────────
     hidden 이면 일시정지로 **상태를 분명히 하고**, 다시 보일 때
     **자동 재개하지 않는다**. 어디까지 들었는지 사용자가 확인하게. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (speaker.getState() === 'speaking') speaker.pause();
    } else if (speaker.getState() === 'speaking') {
      speaker.requestWakeLock();          // 화면이 꺼졌다 돌아오면 다시 잡는다
    }
  });

  /* ── `[9a — spec 17-1-1]` 이어폰·잠금 화면 버튼 ─────────────
     기능 감지(`'mediaSession' in navigator`)는 여기 한 번 — 없으면 handsfree 가 전부 no-op. 위 6-4 hidden 핸들러는
     그대로다(바꾸지 않는다). 숨김 중 액션은 handsfree 가 무시하고, 숨겨지면 멈춤 유지 잠금만 푼다(아래 줄).
     걸기는 쪽이 그려질 때(리더 들어옴·쪽·문서 바뀜 — 메타데이터 "쪽 n / m"), 풀기는 `leaveControls()`. */
  handsfree = createHandsfree({
    mediaSession: (typeof navigator !== 'undefined' && 'mediaSession' in navigator) ? navigator.mediaSession : null,
    MediaMetadata: (typeof window !== 'undefined' && typeof window.MediaMetadata === 'function') ? window.MediaMetadata : null,
    makeAudio: makeSilentAudio,
    isHidden: function () { return document.visibilityState === 'hidden'; },
    speaker: speaker,
    pressPlay: pressPlay,
    meta: function () { const p = currentPage(); return { title: docTitle(), page: p.page, pageCount: p.pageCount }; },
    // 멈춤 유지(9-D3) — handsfree 가 **자기 sentinel** 로 쥔다(speaker 의 wakeLock 과 섞지 않는다). `tts.wakeLock` 검사는 양쪽에.
    holdWakeLock: function () { return requestWakeLock(); },
    getSetting: settings.get,
    // `[9b]` 듣는 중(또는 실패 안내 뒤 되돌림 대기)이면 액션 첫 줄에서 취소 — 그 단추는 평소대로.
    isListening: function () { return !!voice && voice.isListening(); },
    cancel: cancelVoice
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') handsfree.onHidden(); });
  onPageRender(() => { handsfree.arm(); });
  onLangChange(() => { handsfree.refreshMeta(); });

  /* ── `[9b — spec 17-1-2]` 음성 명령 ─────────────────────────
     기능 감지(`SpeechRecognition`·`webkitSpeechRecognition`)는 여기 한 번 — 없으면 단추를 그리지 않는다(5절 "미지원").
     단추 탭은 **동기**로 `speaker.pause()` → `recognition.start()` 까지 간다(S5). 숨겨지면 듣기를 취소한다(되돌림 없음). */
  const Rec = recognitionOf(typeof window !== 'undefined' ? window : null);
  const mounted = mountVoice({ root: root, bar: els.bar, after: els.rate });
  voice = createVoice({
    Recognition: Rec,
    available: Rec && typeof Rec.available === 'function' ? function (o) { return Rec.available(o); } : undefined,
    permissions: (typeof navigator !== 'undefined' && navigator.permissions) || null,
    speaker: speaker,
    pressPlay: pressPlay,
    syncReadalong: syncReadalong,
    paintRate: paintRate,
    setReadalongMode: setReadalongMode,
    lastOnMode: lastOnMode,
    getSetting: settings.get,
    setSetting: settings.set,
    uiLang: getLang,
    onLine: function () { return typeof navigator === 'undefined' || navigator.onLine !== false; },
    synth: (typeof window !== 'undefined' && window.speechSynthesis) || null,
    makeUtterance: makeUtterance,
    // 안내 한 마디 = UI 언어 문장 — 표 안내와 같은 해석(8k `langSpeechOf`).
    sayVoice: function (lang) { return langSpeechOf(lang, voices, settings.get); },
    vibrate: function (ms) { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms); },
    view: mounted ? mounted.view : null
  });
  if (mounted) mounted.button.addEventListener('click', () => voice.press());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') voice.onHidden(); });
  onPageRender(() => { voice.arm(); });

  onLangChange(() => { paintBar(); paintRatePanel(); paintProgress(lastProgress.index, lastProgress.total); syncNoticeVoice(); });
  // `[8k]` 설정 > 낭독 목소리를 바꿨다 — 세 경로를 다시 고른다(settings.js 가 저장한 뒤 보낸다).
  document.addEventListener('medreader:voicepref', onVoicePref);

  /* `[8b-2]` 속도 팝오버의 "번역 따라가기" 줄(7b 에서 저장만 되던 것)이 이제 실제로 동작한다.
     저장은 settings.js 가 그 줄(`[data-readalong-host]`)에 건 위임이 한다. 여기서는 **팝오버(조상)의 버블 단계**에서
     들어 그 저장이 끝난 뒤에 유효 모드를 다시 계산한다 — DOM 전파 순서가 보장하므로 타이머가 필요 없다
     (`settings.set` 은 캐시를 먼저 고친다). 띠는 `syncReadalong()` 끝의 `trband.sync()` 로 따라온다. */
  els.ratePanel.addEventListener('click', (ev) => {
    const hit = ev.target && ev.target.closest ? ev.target.closest('[data-readalong-mode], [data-readalong-source], [data-readalong-display]') : null;
    if (hit && els.ratePanel.contains(hit)) syncReadalong();
  });

  attachDebugHook();

  restoreSettings();
  paintBar();
  paintRatePanel();
}

/**
 * 16-C `[D]` — DevTools 에서 워치독을 시험하는 훅. 키를 담지 않는다(16-K).
 *
 * ★ `main.js` 의 `boot()` 는 `initReader()`(→ `initControls()`) **뒤에**
 *   `window.__medreader = {…}` 를 통째로 새로 만든다. 그래서 한 번만 붙이면
 *   지워진다. 쪽이 그려질 때마다 다시 붙여 둔다(idempotent).
 */
function attachDebugHook() {
  if (typeof window === 'undefined' || !speaker) return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.voice !== voiceDebug) g.voice = voiceDebug;          // `[9b]` 17-1-2 9 `[D]`
  if (g.tts && g.tts.__mine) return;
  g.tts = {
    __mine: true,
    simulateStall: function () { speaker.simulateStall(); },
    state: function () { return speaker.getState(); },
    index: function () { return { index: speaker.getIndex(), total: speaker.getTotal() }; },
    current: function () { return speaker.getCurrent(); },
    // 7c — 원문 발화의 `utterance.lang`(16-C `[D]` "fr 문서면 fr-*").
    docLang: function () { return speaker.getDocLang(); },
    voices: function () { return voices.map((v) => ({ lang: v.lang, name: v.name, local: v.localService })); },
    // 8b-1 — 발화 단계·낭독 동반 번역 상태(키·원문 문장을 담지 않는다).
    phase: function () { return speaker.getPhase(); },
    // 8m — 음성 실패로 이 세션 동안 문장별 전환을 끈 언어들.
    switchOff: function () { return speaker.getSwitchOff(); },
    readalong: function () {
      const st = readalong.stats();
      return { mode: readalong.mode(), remote: readalong.remoteState(), calls: st.calls, chars: st.chars, maxInflight: st.maxInflight,
        taps: st.taps, tapBusy: st.tapBusy, tapWaiting: st.tapWaiting };   // `[8c-1b]` 탭 요청 수·떠 있음·대기 칸
    },
    // `[9a]` 이어폰·잠금 화면 버튼 — 걸림·상태·무시 수·focusFights(키·원문·제목 없음).
    handsfree: function () { return handsfree ? handsfree.debug() : null; }
  };
}

/** `[9b]` `__medreader.voice()` — 최근 기록(글자·명령·태그·ms)·상태. 키 없음. `attachDebugHook` 이 붙인다. */
function voiceDebug() { return voice ? voice.debug() : null; }

/* ────────────────────────────────────────────────────────
   `[8g-4a — spec 17-8-12 §4-5]` 검색 결과로 이동 — 리더·검색 화면은 speaker 를 import 하지 않는다(3-2).
   ──────────────────────────────────────────────────────── */

/**
 * 결과로 가기 **전에** — 낭독 중·쪽 넘김 대기(`waiting-page`)·새 판 대기면 멈춘다(`speaker.pause()` — 세대가 올라
 * `advancePage`·`waitFresh` 의 대기가 스스로 물러난다). 멈춤은 `statechange` 로 `readalong.setActive(false)` 까지 간다 —
 * 그 뒤 [▶] 전까지 번역 요청 0(17-8-8 결정 (2)).
 * @returns {boolean} 이 호출이 낭독을 멈췄는가(화면이 `search.paused` 를 한 번 보인다)
 */
export function pauseForJump() { return pauseSpeakerForJump(speaker); }

/** `pauseForJump` 의 판정 — **순수**(speaker 를 받는다 · tests/search-ui-8g.test.mjs 가 실제 `createSpeaker` 로 잰다). */
export function pauseSpeakerForJump(sp) {
  if (!sp) return false;
  const s = sp.getState();
  if (s !== 'speaking' && s !== 'waiting-page') return false;
  sp.pause();
  return sp.getState() === 'paused';
}

/**
 * 결과 쪽을 그린 뒤 — 다음 [▶] 의 시작점을 적중이 든 문장으로(`speaker.cue`). 낭독 중이면 아무것도 하지 않는다.
 * @returns {boolean}
 */
export function cueAt(lineId, start) {
  return cueSpeakerAt(speaker, lineId, start, paintProgress);
}

/**
 * `cueAt` 의 몸통 — **순수**(speaker·그리기를 받는다 · tests/search-toc-8g4b.test.mjs).
 * `[8g-4b — 8g-4a Review ③]` `speaker.cue` 는 `linechange` 를 내지 않는다(낭독 동반 번역 커서를 건드리지 않으려고) — 그래서
 * 컨트롤 바의 "n번째 줄"이 [▶] 전까지 이동 전 값이었다. 시작점을 정했으면 **진행 칸만** 새 자리로 다시 그린다(번역 커서·큐 이벤트 없음).
 */
export function cueSpeakerAt(sp, lineId, start, paint) {
  if (!sp || typeof sp.cue !== 'function') return false;
  const ok = !!sp.cue(lineId, start);
  if (ok && typeof paint === 'function') paint(sp.getIndex(), sp.getTotal());
  return ok;
}

/** 지금 낭독 상태(`idle`·`speaking`·`paused`·`waiting-page`·`error`). speaker 가 없으면 `'idle'`. */
export function speechState() { return speaker ? speaker.getState() : 'idle'; }

/** `[8g-4a]` 낭독 상태가 바뀔 때마다 `fn(state)`. 해제 함수를 돌려준다. */
const speechListeners = new Set();
export function onSpeechChange(fn) { speechListeners.add(fn); return () => speechListeners.delete(fn); }

/**
 * `[8l — spec 17-5-1 3]` ▶ 갈래 — **재생 시작 지점에서만.** 스캔본·글자 없음(`scan`·`notext`) 문서에서 지금 쪽의 큐가
 * 비면 `play()` 를 부르지 않는다(쪽을 넘기지 않는다). 깨짐(`garbled`)·텍스트 문서는 그대로(L-D10). **순수**(speaker 를 받는다 —
 * tests/scan-8l.test.mjs 가 실제 `createSpeaker` 로 잰다).
 */
export function scanPlayBlocked(sp, verdict) {
  if (!sp) return false;
  if (!blocksPlay(verdict, { state: sp.getState(), empty: true })) return false;   // 갈래가 아니면 큐를 보지도 않는다
  return blocksPlay(verdict, { state: sp.getState(), empty: typeof sp.isQueueEmptyHere === 'function' && sp.isQueueEmptyHere() });
}

/**
 * `[9a — spec 17-1-1 4]` [▶] 의 본문 — 화면 버튼과 이어폰·알림(`ui/handsfree.js` 의 `play`·`pause` 토글)이 **같은 함수**를 부른다.
 * ★ 6-4 (5) — **동기**로 `speaker.play()` 까지 간다(앞에 `await` 없음).
 */
function pressPlay() {
  cancelVoice();                                 // `[9b]` 듣는 중이면 먼저 취소(9a 이어폰 play 도 이 함수 — 17-1-2 3절)
  if (trband) trband.closeTap();                 // `[8c-1]` [▶] 는 탭 번역 띠를 닫는다(낭독 문장으로 — 7-7)
  const s = speaker.getState();
  if (s === 'speaking') speaker.pause();
  else if (scanPlayBlocked(speaker, docScanVerdict())) noReadNotice();   // `[8l]` 스캔본 — 넘기지 않고 안내, idle 그대로
  else { syncReadalong(); speaker.play(); }     // 8b-1 — 설정값을 동기적으로 다시 읽고(await 없음) 곧장 재생
}

/** `reader.scan.noRead` 한 번 — 누를 때마다(닫은 뒤 다시 누르면 다시). 세션당 1회 규칙(`notice`)을 타지 않는다. */
function noReadNotice() {
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { key: 'reader.scan.noRead', tone: 'warn' } }));
}

/** `[9b]` 듣기·실패 안내 취소(되돌림 없음). 듣는 중이 아니면 아무 일도 없다. */
function cancelVoice() { if (voice) voice.cancel(); }

/** 리더를 떠날 때 — 소리를 멈춘다. 서재에서 낭독이 계속되면 안 된다. */
export function leaveControls() {
  if (!speaker) return;
  if (voice) voice.leave();              // `[9b]` 듣기·안내·고지 카드·상태 줄을 거둔다(멈추기 전 — 되돌림이 끼어들지 않게)
  speaker.stop();
  if (handsfree) handsfree.disarm();     // `[9a]` 핸들러·알림·무음 오디오·멈춤 유지 잠금을 거둔다
  if (readalong) readalong.setActive(false);
  if (trband) trband.leave();
  if (inlinetr) inlinetr.leave();
  if (selbar) selbar.hide();             // `[8c-1]` 선택 동작 줄을 거둔다
  lastShown = null;
  toggleRatePanel(false);
}

/**
 * `[8c-1c]` 리더를 숨기기만 하고 떠날 때(검색 화면 — `reader.leaveReader` 의 검색 갈래) 탭 띠를 닫는다. 포커스는 건드리지 않는다
 * (숨은 줄로 옮기지 않게). 낭독·낭독 띠는 그대로다(숨긴 리더의 낭독은 이어진다 — 8g-4a).
 */
export function closeTapBand() {
  if (trband) trband.closeTap();
}

/* ────────────────────────────────────────────────────────
   `[8c-1 — spec 17-7-6 4-1·4-2]` 탭 번역 · 선택 동작 줄 — 서비스는 readalong 한 곳(같은 메모리·캐시·요청)
   ──────────────────────────────────────────────────────── */

/**
 * 그 줄(또는 고른 문장들)의 번역을 띠에 연다. 문지기(`tapGate`)를 지나면 **문단 단위 1회** 요청(메모리·캐시 적중이면 0회).
 * 줄 → 문장은 `speaker.sentenceUnits()`(줄 단위 낭독이어도 같은 `buildUnits` 로 문장 단위 — 8cf-D6).
 * @param {string} lineId
 * @param {?number[]} segsWanted  선택 동작 줄 [문장 번역] 이 고른 문장 번호들(null 이면 그 줄과 겹치는 문장 전부)
 */
function openTapFor(lineId, segsWanted) {
  if (!speaker || !readalong || !trband) return;
  syncReadalong();                                           // 키·동의·언어를 지금 값으로(문지기가 같은 문맥을 읽는다)
  const units = speaker.sentenceUnits();
  // `[8c-1b]` 띠에 보일 문장·요청할 문단 단위는 순수 `tapPlan`(문단 단위 1회 — node 테스트가 고정한다)
  const plan = tapPlan(units, lineId, segsWanted, (u) => readalong.translatable(u));
  const hit = plan.hit;
  const paraUnits = plan.paraUnits;
  const gate = readalong.tapGate();
  const page = currentPage().page;
  const ask = function (retry) { return readalong.requestTap(paraUnits, { all: units, page: page, retry: !!retry }); };
  trband.openTap({ lineId: lineId, segs: hit, paraSegs: plan.para, gate: gate, retry: function () { return ask(true); },
    resend: function () { return ask(false); }, focusBack: function (reveal) { focusLine(lineId, reveal); } });
  // `[8c-1b]` 가림 굴리기 가장자리 — 선택 줄이 떠 있으면(띠가 새로 나타나 위로 올라간) 그 윗변, 아니면 띠 윗변(8c1R-9 #4).
  // `[8c-1c]` 고르는 규칙은 순수 `liftEdge`(node 가 지킨다 — 8c1bR-8 #7)
  liftLineAbove(lineId, liftEdge(selbar ? selbar.top() : null, trband.bandTop()));
  if (gate.ok && hit.length) ask(false).catch(() => { /* 결과는 띠가 onChange 로 본다 */ });
}

/** 선택 동작 줄 단추. 첫 줄에서 듣기를 취소한다(손이 이긴다 — 17-7-6 2절 1). */
function onSelAction(id, snap) {
  cancelVoice();
  if (!snap || snap.lineId == null) return;
  if (id === 'sentence') {
    // 선택 시작·끝 글자의 문장(들) — 모든 낭독 상태에서(낭독 중에도 — 다음 문장에서 띠가 낭독 문장으로 돌아간다).
    const units = speaker.sentenceUnits();
    const a = unitAt(units, snap.lineId, snap.start);
    const b = unitAt(units, snap.lineId, Math.max(snap.start, snap.end - 1));
    const segs = [];
    for (const u of [a, b]) if (u && Number.isInteger(u.seg) && segs.indexOf(u.seg) < 0) segs.push(u.seg);
    openTapFor(snap.lineId, segs);
  } else if (id === 'readFrom') {
    // 12-3 "멈춤 중 길게 누르기 = 여기서부터 재생"을 옮겼다. 선택을 지운다.
    if (selbar) selbar.clear();
    if (trband) trband.closeTap();
    syncReadalong();
    speaker.play(snap.lineId);
  }
  // 'word' — 8f-2 가 단어 시트를 연다(8c-1 에서는 단추가 숨어 있다).
}

/* ────────────────────────────────────────────────────────
   2. 설정과 음성 (9-3 · 6-3)
   ──────────────────────────────────────────────────────── */

async function restoreSettings() {
  // 5b — 옛 연속 슬라이더 시절 값(0.7 같은)은 `snapRate` 가 가장 가까운
  // 계단(0.75)으로 맞춘다. 맞춰진 값을 **되저장하지는 않는다** — 사용자가
  // 속도를 건드리지 않았는데 설정이 바뀌어 있으면 이상하다.
  speaker.setRate(settings.get('tts.rate'));
  speaker.setRepeat('off', settings.get('tts.repeat.count'));

  // 6-1 — 기본 단위는 문장이다. settings.js 의 DEFAULTS 가 그렇게 말하므로
  // 여기서는 그냥 읽는다(사용자가 고른 값이 있으면 그것이 온다).
  speaker.setUnit(settings.get('tts.unit'));

  paintRatePanel();
  await refreshVoices();
}

/** `[7c]` 음성 목록을 한 번이라도 읽었는가(1.5초 타임아웃으로 빈 목록이 와도 참). */
let voicesLoaded = false;

/**
 * `[8b-1]` 음성 목록을 **끝까지** 듣는다 — 목록이 바뀔 때마다 원문 음성·번역문 음성·표 안내 음성·유효 모드를
 * 다시 고른다(`sharedVoiceWatch` — 설정 화면과 같은 감시자). 옛 `loadVoices` 는 첫 응답(또는 1.5초 타임아웃의
 * 빈 목록)을 최종으로 썼다 — 그 빈 목록으로 "영어 음성 없음"을 판정한 것이 운영자 폰 오경고의 경로다(보고서).
 */
async function refreshVoices() {
  const synth = (typeof window !== 'undefined' && window.speechSynthesis) || null;
  if (!synth) { notice('reader.tts.unsupported'); return; }

  const watch = sharedVoiceWatch(synth);
  if (!voicesSub) voicesSub = watch.subscribe(applyVoices);
  const snap = watch.snapshot();
  voices = snap.voices;
  voicesLoaded = snap.loaded;
  voicesLang = null;          // 목록이 새로 왔다 — 다시 고른다
  syncSourceVoice();
  syncTrVoice();
  syncNoticeVoice();
}

/** 음성 목록이 바뀌었다(늦게 온 음성 포함). */
function applyVoices(snap) {
  voices = snap.voices;
  voicesLoaded = snap.loaded;
  voicesLang = null;
  syncSourceVoice();
  syncTrVoice();
  syncNoticeVoice();
}

/** `[7c]` 지금 음성을 고른 원문 언어. 같으면 다시 고르지 않는다(쪽마다 불린다). */
let voicesLang = null;

/* ────────────────────────────────────────────────────────
   `[8k — spec 19-1-2 3절 3]` 세 낭독 경로(원문·번역문·표 안내)가 **같은 해석 함수** `resolveSpeech` 를 쓴다
   (퀴즈는 `ui/quiz.js` 의 `applyQuizSpeech` — 같은 함수). 고른 것이 없으면 voice 없이 태그만 = 휴대폰 설정 따름.
   speaker 를 받는 작은 함수로 둔다 — `tests/voice-8k.test.mjs` 가 실제 `createSpeaker` 로 잰다.
   ──────────────────────────────────────────────────────── */

/** 원문 경로. 음성이 없으면 **지운다**(`setVoice(lang, null)`) — 설정에서 "휴대폰 설정 따름"으로 돌아온 경우. */
export function applySourceSpeech(sp, lang, list, get) {
  const r = resolveSpeech(lang, list, speechPref(get, lang));
  sp.setVoice(lang, r.voice);
  sp.setDocLang(r.tag);
  return r;
}

/** 번역문 경로. 목록에 그 언어 음성이 있으면 실패로 껐던 tr 을 다시 허락한다(옛 "음성이 생겼다"와 같은 조건). */
export function applyTrSpeech(sp, lang, list, get) {
  const r = resolveSpeech(lang, list, speechPref(get, lang));
  sp.setTrVoice(r.tag, r.voice, languageVoices(lang, list).length > 0);
  return r;
}

/**
 * `[8m — spec 19-1-2 2-3]` 문장별 언어 전환 경로 — 단위의 `lang` 으로 같은 해석 함수(`resolveSpeech`).
 * speaker 가 발화마다 부른다(`deps.langSpeech`). 순수 — 목록·설정 읽기만.
 * @returns {{tag:string, voice:?Object}}
 */
export function langSpeechOf(lang, list, get) {
  const r = resolveSpeech(lang, list, speechPref(get, lang));
  return { tag: r.tag, voice: r.voice };
}

/** 표 안내 경로(UI 언어 문장 — 6-1). */
export function applyNoticeSpeech(sp, lang, list, get) {
  const r = resolveSpeech(lang, list, speechPref(get, lang));
  sp.setNoticeVoice(r.tag, r.voice);
  return r;
}

/** `[8k]` 설정 화면에서 목소리를 바꿨다(`medreader:voicepref`) — 세 경로를 다시 고른다. 다음 발화부터. */
function onVoicePref() {
  voicesLang = null;
  syncSourceVoice();
  syncTrVoice();
  syncNoticeVoice();
}

/**
 * `[7c]` 6-3 — 원문 음성은 **문서의 원문 언어**로 고른다.
 * `[8k]` 고르기는 `resolveSpeech`(`applySourceSpeech`) — 고른 것이 없으면 voice 없이 그 언어 태그만.
 * 음성이 없으면 설치 안내 — 언어마다 세션당 1회, 문구에 그 언어의 자국어 이름.
 */
function syncSourceVoice() {
  if (!speaker) return;
  const lang = sourceLang();
  if (lang === voicesLang) return;
  voicesLang = lang;
  applySourceSpeech(speaker, lang, voices, settings.get);
  const v = languageVoices(lang, voices).length > 0;
  // `[8b-1 — 오케스트레이터 결정 2026-10-10]` **목록만으로 "음성 없음"을 말하지 않는다.** 목록에 그 언어가
  // 없어도 `utterance.lang` 만으로 소리가 나는 기기가 있다(운영자 폰 — 목록에 아랍어 0개인데 lang 으로 발화됨).
  // "음성 없음"은 실제 발화 오류(`CODES.NO_VOICE`)로만 낸다. 미지원 언어(`und` 등)는 따로 안내한다.
  if (SUPPORTED_SRC.indexOf(lang) < 0) { notice('reader.tts.unsupportedLang', 'warn'); return; }
  // 나중에 음성이 목록에 생겼다 — 오류로 띄웠던 "음성 없음" 배너를 거둔다.
  if (v) withdrawNotice('reader.tts.noVoice', 'reader.tts.noVoice:' + lang);
}

/** `[7c]` "음성 없음" 배너 — `{lang}` 은 원문 언어의 자국어 이름(`onboarding.lang.*`). */
function noVoiceNotice(lang) {
  // `[8b-1]` 미지원 언어 문서(`und`)는 "und 음성이 없습니다"가 아니라 "이 문서의 언어는 낭독을 지원하지 않습니다".
  if (SUPPORTED_SRC.indexOf(lang) < 0) { notice('reader.tts.unsupportedLang', 'warn'); return; }
  const k = 'onboarding.lang.' + lang;
  const name = t(k) === k ? String(lang) : t(k);
  notice('reader.tts.noVoice', 'warn', { lang: name }, 'reader.tts.noVoice:' + lang);
}

/** `[8m]` "{lang} 음성이 없어 그 문장들을 원서 언어로 읽습니다" — `{lang}` 은 그 언어의 자국어 이름. */
function switchNoVoiceNotice(lang) {
  const l = typeof lang === 'string' && lang ? lang : '';
  const k = 'onboarding.lang.' + l;
  const name = !l ? '' : t(k) === k ? l : t(k);
  notice('reader.tts.switchNoVoice', 'warn', { lang: name }, 'reader.tts.switchNoVoice:' + l);
}

/**
 * `[8b-1]` 띄웠던 배너를 거둔다(음성이 나중에 생겼다). 배너의 닫기 단추가 `main.js` 의 기록까지 지우므로
 * 그것을 누른다 — 배너 장치를 두 벌로 만들지 않는다. 다시 필요해지면 다시 뜰 수 있게 "한 번" 기록도 지운다.
 */
function withdrawNotice(key, once) {
  const id = once || key;
  if (!noticedOnce.has(id)) return;
  noticedOnce.delete(id);
  const bar = document.querySelector('#banners .banner[data-key="' + key + '"]');
  const close = bar ? bar.querySelector('button.banner-close') : null;
  if (close) close.click();
}

/* ────────────────────────────────────────────────────────
   `[8b-1]` 낭독 동반 번역 배선 (7-8) — 화면 없이 서비스·speaker 만 잇는다.
   띠·상태 바 문구는 8b-2 가 `readalong` 의 `mode`·`notice`·`remote`·`change` 이벤트에 붙인다.
   ──────────────────────────────────────────────────────── */

function providerId() {
  const p = settings.get('ai.provider');
  return typeof p === 'string' && p ? p : AI.DEFAULT_PROVIDER;
}

function targetLang() { return normalizeTranslationLang(settings.get('ai.translationLang')); }

/** 번역문 음성 — `[8k]` `resolveSpeech(target)`(`applyTrSpeech`). 고른 것이 없거나 목록에 없으면 voice 없이 태그만. */
function syncTrVoice() {
  if (!speaker) return;
  const target = targetLang();
  const was = speaker.isTrDisabled();
  applyTrSpeech(speaker, target, voices, settings.get);
  if (was && !speaker.isTrDisabled()) syncReadalong();     // 음성이 생겼다 — 유효 모드를 되돌린다
}

/** 6-1 — 표 안내는 UI 언어 문장이다. UI 언어로 읽는다(`[8k]` `applyNoticeSpeech`). */
function syncNoticeVoice() {
  if (!speaker) return;
  applyNoticeSpeech(speaker, getLang(), voices, settings.get);
}

/**
 * 유효 모드(7-8-1)를 다시 계산해 서비스와 speaker 에 준다. **동기** — 재생 탭 핸들러 안에서 불린다(6-4 (5)).
 * 번역문 음성은 **실제 발화 오류**(speaker 의 `TR_VOICE_FAILED`)일 때만 "없음"이다 — 목록만으로 내리지 않는다.
 */
function syncReadalong() {
  if (!speaker || !readalong) return;
  const st = readalongState();
  const page = currentPage();
  const src = sourceLang();
  const target = targetLang();
  const pid = providerId();
  const key = String(keys.readKeySecret(pid) || '').trim();
  // 키·모델·프로바이더가 바뀌었으면 파이프라인의 막힌 상태(no-key·model·region)를 풀 기회를 준다(7-6).
  const fp = hashHexSync(pid + '|' + String(settings.get('ai.model') || '') + '|' + key);
  if (lastConfigFp !== null && fp !== lastConfigFp) {
    pipeline.configChanged('provider');
    pipeline.configChanged('model');
    pipeline.configChanged('key');
  }
  lastConfigFp = fp;
  // `[8p]` 문서의 번역 문체 — 재생·쪽 그리기마다 다시 읽는다. 바뀌었으면 readalong 이 다음 요청부터 쓴다.
  readalong.setDoc({ docId: page.docId, lang: src, target: target, pageCount: page.pageCount, domain: docDomain() });
  const em = readalong.setContext({
    mode: st.mode,
    consented: !!settings.get('privacy.consentedAt'),
    srcLang: src,
    supportedSrc: SUPPORTED_SRC,
    targetLang: target,
    unit: speaker.getUnit(),
    hasKey: !!key,
    trVoice: speaker.isTrDisabled() ? false : null
  });
  speaker.setReadalong({ mode: em.mode, speakSource: st.speakSource });
  // `[8b-2]` 띠 자리 — 값이 같아 `mode` 이벤트가 없어도(리더에 다시 들어옴) 여기서 맞춘다.
  if (trband) trband.sync();
  // `[8d]` 문장 아래 표시 — 띠 자리(`data-tr-inline`)와 블록. 문서·대상 언어·유효 모드를 위에서 맞춘 뒤라야 캐시 키가 맞다.
  if (inlinetr) inlinetr.sync();
}

/** 6-4 Wake Lock — 여기만이 기능 감지로 분기하는 곳이다. */
function requestWakeLock() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return Promise.resolve(null);
  if (settings.get('tts.wakeLock') === false) return Promise.resolve(null);
  return navigator.wakeLock.request('screen');
}

/**
 * `[9a — spec 17-1-1 6]` 세션 잡기용 무음 오디오. 바이트는 handsfree 의 `silentWav` — 파일 없이, 외부 요청 없이.
 * 주소(`blob:`)는 이 탭 동안 하나를 같이 쓴다(80 KB — 리더를 오갈 때마다 다시 만들지 않는다).
 */
let silentUrl = null;
function makeSilentAudio(bytes) {
  if (typeof Audio !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined' || !URL.createObjectURL) return null;
  if (!silentUrl) silentUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  return new Audio(silentUrl);
}

function makeUtterance(text) {
  return new window.SpeechSynthesisUtterance(text);
}

/* ────────────────────────────────────────────────────────
   3. 그리기 — 문구는 전부 i18n 이다(11절). 하드코딩 0건.
   ──────────────────────────────────────────────────────── */

function paintBar() {
  if (!els) return;
  const s = speaker.getState();
  const speaking = s === 'speaking';
  els.play.setAttribute('aria-pressed', speaking ? 'true' : 'false');
  els.play.setAttribute('aria-label', t(speaking ? 'reader.tts.pause' : 'reader.tts.play'));
  els.glyph.textContent = speaking ? '⏸' : '▶';
  els.bar.setAttribute('data-state', s);
  paintRate();

  if (s === 'waiting-page') {
    // `[8i-1]` 지금 쪽 새 판을 기다릴 때는 "다음 쪽"이 아니다 — 리더 자리표시자와 같은 문구(새 키 없음).
    els.progress.textContent = t(speaker.isWaitingFresh() ? 'reader.preparing.unknown' : 'reader.tts.waitingPage');
  }
}

/** 12-3 — 본문을 두 번 읽지 않는다. "줄 12/58" 만 알린다. */
function paintProgress(index, total) {
  if (!els) return;
  lastProgress = { index: Number(index) || 0, total: Number(total) || 0 };
  const rep = repeatText();
  if (!total) { els.progress.textContent = rep; return; }
  const line = t('reader.tts.progress', {
    index: formatNumber(Number(index) + 1),
    total: formatNumber(total)
  });
  // 반복 표시를 **앞에** 둔다 — 375px 에서는 이 칸이 좁아 뒤가 잘린다.
  // 반복 중일 때 잘려도 되는 것은 줄 번호 쪽이다.
  els.progress.textContent = rep ? rep + ' · ' + line : line;
}

/**
 * 5b — 반복 중임을 **컨트롤 바에서** 알 수 있어야 한다("2/3회").
 * 버튼을 늘리지 않고 진행 표시에 붙인다(375px 에서 바가 넘치면 안 된다).
 */
function repeatText() {
  const r = speaker.getRepeat();
  if (r.mode === 'off') return '';
  if (r.count === 0) return t('reader.tts.repeat.statusEndless');
  return t('reader.tts.repeat.status', {
    done: formatNumber(Math.min(r.pass + 1, r.count)),
    total: formatNumber(r.count)
  });
}

/**
 * 계단 값 글자. `0.75` 를 `0.8` 로 뭉개면 안 되고 `1` 은 `1.0` 으로 보여야
 * 한다(단계가 있다는 것이 숫자에서 보이도록).
 */
function rateText(r) {
  const n = Number(r);
  if (!Number.isFinite(n)) return '1.0';
  return Math.round(n * 100) % 10 === 0 ? n.toFixed(1) : n.toFixed(2);
}

function toggleRatePanel(force) {
  if (!els) return;
  const open = force === undefined ? els.ratePanel.hidden : !!force;
  els.ratePanel.hidden = !open;
  els.rate.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) paintRatePanel();
}

function paintRatePanel() {
  if (!els) return;
  // ★ `applyTranslations` 가 먼저다. 그것은 `data-i18n` 만 덮어쓰므로,
  //   매개변수가 들어간 글자(속도·횟수·구간)는 그 뒤에 우리가 쓴다.
  applyTranslations(els.ratePanel);
  paintRate();
  paintUnit();
  paintRepeat();
  // 7b — 열 때마다 설정값에서 다시 그린다. 설정 AI 탭에서 바꾼 값이 여기에 그대로 보인다.
  if (els.readalongHost) renderReadalongRow(els.readalongHost);
}

/**
 * ★ 5b — **속도 글자를 만드는 유일한 곳.** 컨트롤 바 버튼과 팝업 숫자와
 * 계단 버튼의 눌림 상태를 `speaker.getRate()` 한 값에서 함께 그린다.
 * (어긋남의 원인은 4번 보고 항목에.)
 */
function paintRate() {
  if (!els) return;
  const r = speaker.getRate();
  const label = t('reader.tts.rate.value', { rate: rateText(r) });
  els.rate.textContent = label;
  els.rateOut.textContent = label;

  // 계단 버튼은 `TTS.RATE_STEPS` 를 읽어 한 번만 만든다.
  if (!els.rateSteps.firstChild) {
    for (let i = 0; i < TTS.RATE_STEPS.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-rate', String(TTS.RATE_STEPS[i]));
      els.rateSteps.appendChild(b);
    }
  }
  const btns = els.rateSteps.querySelectorAll('button[data-rate]');
  for (let i = 0; i < btns.length; i++) {
    const v = Number(btns[i].getAttribute('data-rate'));
    btns[i].textContent = t('reader.tts.rate.value', { rate: rateText(v) });
    btns[i].setAttribute('aria-pressed', v === r ? 'true' : 'false');
  }
}

function paintUnit() {
  if (!els) return;
  const u = speaker.getUnit();
  const btns = els.unitRow.querySelectorAll('button[data-unit]');
  for (let i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-unit') === u ? 'true' : 'false');
  }
}

/** 반복 — 팝업 안의 세 줄과 컨트롤 바의 표시를 **한 값에서** 그린다. */
function paintRepeat() {
  if (!els) return;
  const rep = speaker.getRepeat();

  const modes = els.repeatRow.querySelectorAll('button[data-repeat]');
  for (let i = 0; i < modes.length; i++) {
    modes[i].setAttribute('aria-pressed', modes[i].getAttribute('data-repeat') === rep.mode ? 'true' : 'false');
  }

  if (!els.countChoices.firstChild) {
    for (let i = 0; i < TTS.REPEAT_COUNTS.length; i++) {
      const n = TTS.REPEAT_COUNTS[i];
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-count', String(n));
      // 0 = 무한. `data-i18n` 을 주면 `applyTranslations` 가 언어 전환 때
      // 알아서 다시 쓴다(`data-i18n-n` 이 {n} 을 채운다).
      b.setAttribute('data-i18n', n === 0 ? 'reader.tts.repeat.endless' : 'reader.tts.repeat.times');
      if (n !== 0) b.setAttribute('data-i18n-n', String(n));
      els.countChoices.appendChild(b);
    }
    applyTranslations(els.countChoices);
  }
  const counts = els.countChoices.querySelectorAll('button[data-count]');
  for (let i = 0; i < counts.length; i++) {
    counts[i].setAttribute('aria-pressed',
      Number(counts[i].getAttribute('data-count')) === rep.count ? 'true' : 'false');
  }

  els.countRow.hidden = rep.mode === 'off';
  els.spanRow.hidden = rep.mode !== 'range';
  els.repeatOut.textContent = repeatText();
  els.spanOut.textContent = rep.mode === 'range'
    ? t('reader.tts.repeat.span', { from: formatNumber(rep.from + 1), to: formatNumber(rep.to + 1) })
    : '';

  // 팝업을 닫아도 반복 중임이 보여야 한다(바 버튼에 표시가 붙는다).
  els.bar.setAttribute('data-repeat', rep.mode);
}

/* ────────────────────────────────────────────────────────
   4. 코드 → 문장 (3-2) — `speaker` 는 코드만 냈다.
   ──────────────────────────────────────────────────────── */

const CODE_KEYS = Object.freeze({
  [CODES.NOT_ALLOWED]: 'reader.tts.notAllowed',
  [CODES.LINE_SKIPPED]: 'reader.tts.lineSkipped',
  [CODES.PAGE_TIMEOUT]: 'reader.tts.pageTimeout',
  [CODES.NO_VOICE]: 'reader.tts.noVoice',
  [CODES.WAKELOCK_UNAVAILABLE]: 'reader.tts.wakeLock',
  [CODES.SWITCH_NO_VOICE]: 'reader.tts.switchNoVoice'
});

function onSpeakerError(code, detail) {
  // `[8b-1]` 첫 번역문 발화가 실패 — 번역문 음성 불가(7-8-5). 유효 모드가 show 로 내려가고 서비스가
  // `notice` 를 한 번 낸다(문구는 8b-2). 원문 낭독은 그대로 이어진다.
  if (code === CODES.TR_VOICE_FAILED) { syncReadalong(); return; }
  const key = CODE_KEYS[code];
  if (!key) return;
  // 건너뛴 줄 하나로 배너를 띄우지 않는다 — 시끄럽고, 워치독이 이미 이었다.
  if (code === CODES.LINE_SKIPPED) return;
  // 7c — 음성 없음 문구는 원문 언어 이름을 받는다.
  if (code === CODES.NO_VOICE) { noVoiceNotice(sourceLang()); return; }
  // `[8m]` 문장별 전환 언어의 음성이 없다 — 그 언어는 이 세션 동안 문서 언어로 읽는다(언어마다 한 번).
  if (code === CODES.SWITCH_NO_VOICE) { switchNoVoiceNotice(detail && detail.lang); return; }
  notice(key, code === CODES.NOT_ALLOWED ? 'error' : 'warn');
}

/**
 * 세션당 1회. 닫기는 배너 자신이 갖고 있다(`main.js`).
 * `[7c]` `once` 는 "한 번"을 세는 이름 — 기본은 키. 음성 없음은 언어마다 따로 센다.
 */
function notice(key, tone, params, once) {
  const id = once || key;
  if (noticedOnce.has(id)) return;
  noticedOnce.add(id);
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { key: key, tone: tone || 'warn', params: params || null }
  }));
}
