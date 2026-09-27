/* ============================================================
   MedReader — pdf.js 로더 (spec 2-3 · 14절)

   서비스 계층. `config.js` 외에는 아무것도 import 하지 않는다.
   **버전 문자열은 이 파일에 없다.** `config.js` 의 `PDFJS_VERSION` 한 곳에서
   본체 URL 과 worker URL 이 함께 조립된다(16-B: "latest" 금지).

   실패는 문자열이 아니라 **코드**로 알린다(3-2). 14절의 오프라인 UX 가
   `ERR_PDFJS_OFFLINE` / `ERR_PDFJS_LOAD` 를 보고 배너를 고른다.
   ============================================================ */

import { PDFJS_BASES, pdfjsMainUrl, pdfjsWorkerUrl } from '../config.js';

export const ERR_PDFJS_LOAD = 'ERR_PDFJS_LOAD';       // 모든 CDN 실패
export const ERR_PDFJS_OFFLINE = 'ERR_PDFJS_OFFLINE'; // 네트워크가 끊겨 있다

export class PdfjsLoadError extends Error {
  constructor(code, tried, cause) {
    super(code);
    this.name = 'PdfjsLoadError';
    this.code = code;
    this.tried = tried;      // 시도한 base 목록 (UI 가 아니라 로그용)
    this.cause = cause;
  }
}

/* 모듈 레벨 캐시 — 로드는 1회만 한다. */
let libPromise = null;
let loadedBase = null;

/** 마지막으로 성공한 base. 진단용. */
export function currentBase() { return loadedBase; }

/** 실패 후 다시 시도할 수 있게 캐시를 비운다(14절 [다시 시도]). */
export function resetPdfjs() {
  libPromise = null;
  loadedBase = null;
}

async function importFrom(base) {
  const lib = await import(/* @vite-ignore */ pdfjsMainUrl(base));
  // worker 는 반드시 **같은 base·같은 버전**이어야 한다. 섞이면
  // "The API version does not match the Worker version" 으로 죽는다.
  lib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl(base);
  return lib;
}

/**
 * pdf.js ESM 배포판을 동적 import 한다. `PDFJS_BASES` 순서대로 시도하고
 * 전부 실패하면 `PdfjsLoadError` 를 던진다.
 *
 * @param {string[]} [bases] 시도 순서를 바꾸고 싶을 때(테스트·진단)
 * @returns {Promise<Object>} pdf.js 모듈
 */
export function loadPdfjs(bases = PDFJS_BASES) {
  if (libPromise) return libPromise;
  libPromise = (async () => {
    const tried = [];
    let last = null;
    for (let i = 0; i < bases.length; i++) {
      const base = bases[i];
      tried.push(base);
      try {
        const lib = await importFrom(base);
        loadedBase = base;
        return lib;
      } catch (e) {
        last = e;
      }
    }
    // 캐시된 실패 프라미스를 남기지 않는다 — [다시 시도]가 되어야 한다.
    libPromise = null;
    const offline = (typeof navigator !== 'undefined') && navigator.onLine === false;
    throw new PdfjsLoadError(offline ? ERR_PDFJS_OFFLINE : ERR_PDFJS_LOAD, tried, last);
  })();
  return libPromise;
}

/**
 * PDF 문서를 연다.
 *
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<Object>} PDFDocumentProxy
 */
export async function openDocument(source) {
  const lib = await loadPdfjs();

  /* `[수정 2026-09-27]` **Blob 은 통째로 읽지 않는다.**
   *
   * `hash.js` 가 이미 경고해 둔 것을 이 경로만 못 받았다:
   *   "7000쪽 실자료는 200MB 를 넘을 수 있다. `file.arrayBuffer()` 로 전체를
   *    올리면 200MB 가 한 번에 힙에 올라오고 Android Chrome 에서 탭이 죽는다.
   *    pdf.js 가 이미 같은 버퍼를 들고 있으므로 순간 점유는 **두 배**가 된다."
   *
   * `[사용자 2026-09-27]` 실제 자료가 **100MB 를 넘는다**. 호출부가
   * `await file.arrayBuffer()` 로 우리 힙에 한 벌, pdf.js 가 또 한 벌을 들었다.
   * blob URL 을 주면 사본은 **pdf.js 것 하나뿐**이다.
   *
   * URL 은 문서를 닫을 때 푼다 — pdf.js 가 쪽을 늦게 읽을 수 있으므로
   * `.promise` 가 풀렸다고 바로 revoke 하면 안 된다.
   */
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    const url = URL.createObjectURL(source);
    let doc;
    try {
      doc = await lib.getDocument({ url: url }).promise;
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    const destroy = doc.destroy ? doc.destroy.bind(doc) : null;
    doc.destroy = function () {
      URL.revokeObjectURL(url);
      return destroy ? destroy() : Promise.resolve();
    };
    return doc;
  }

  // 이미 버퍼를 들고 있는 호출자(합성 문서·테스트)는 그대로 받는다.
  return lib.getDocument({ data: source }).promise;
}
