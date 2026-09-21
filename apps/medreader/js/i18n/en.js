/* ============================================================
   MedReader — English (spec 11-1 · 11-2)

   평범한 객체다. 빌드도 fetch 도 없다.
   **en 은 폴백 언어다.** 다른 언어에 키가 없으면 여기가 쓰인다(11-2).
   그러므로 이 파일이 키의 정본이다 — 키를 더하면 4개 파일 전부에 더한다.
   `tests/i18n.test.mjs` 가 키 집합 일치를 고정한다.

   ★ 문자열 안에 HTML 을 넣지 않는다(11-2). 링크는 {link} 자리표시자 +
     별도 URL 키로 나눈다.
   ============================================================ */

export default {
  'app.name': 'MedReader',
  'app.tagline': 'Read, listen, and study medical textbooks',

  /* 12-7 — 모든 화면에 고정. 숨길 수 없다. */
  'notice.educationOnly': 'For education only — not for clinical decisions',

  'nav.library': 'Library',
  'nav.settings': 'Settings',
  'nav.usage': 'Usage',
  'nav.about': 'About',
  'nav.back': 'Back',
  'nav.menu': 'Menu',

  'common.retry': 'Try again',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.continue': 'Continue',
  'common.dismiss': 'Dismiss',
  'common.loading': 'Loading…',

  /* ── 온보딩 (12-2) — 3화면 ───────────────────────── */
  'onboarding.progress': 'Step {step} of {total}',

  'onboarding.lang.title': 'Choose your language',
  'onboarding.lang.desc': 'You can change this later in Settings.',
  // 언어 이름은 **자국어 표기** 그대로다 — 어느 언어 파일에서도 같다(12-2).
  'onboarding.lang.ar': 'العربية',
  'onboarding.lang.en': 'English',
  'onboarding.lang.fr': 'Français',
  'onboarding.lang.ko': '한국어',

  'onboarding.consent.title': 'Before you start',
  'onboarding.consent.education.title': 'Education only',
  'onboarding.consent.education.body':
    'This app helps you read and study textbooks. Do not use it for diagnosis, treatment, or any clinical decision.',
  'onboarding.consent.privacy.title': 'Privacy',
  'onboarding.consent.privacy.body':
    'AI features send text to an external API. Never enter real patient information — names, ages, test results, or images. Free API tiers may use what you send to improve their models.',
  'onboarding.consent.check': 'I understand',
  'onboarding.consent.needCheck': 'Please confirm that you understand before continuing.',

  'onboarding.start.title': 'Open your first PDF',
  'onboarding.start.desc': 'The file stays on this device. Nothing is uploaded.',
  'onboarding.start.noKey': 'No API key needed. Reading and read-aloud work without one. You can add a key later in Settings.',
  'onboarding.start.import': 'Import a PDF',
  'onboarding.start.later': 'Later — go to my library',

  /* ── 서재 (12-6) ─────────────────────────────────── */
  'library.title': 'Library',
  'library.import': 'Import a PDF',
  'library.empty.title': 'Your library is empty',
  'library.empty.body': 'Import a PDF to start reading.',
  // 20절 — file:// 로 열면 동작하지 않는다.
  'library.empty.fileProtocol':
    'This app must be opened over http:// or https://. Opened directly from a file, the browser blocks its modules and storage.',

  'library.card.pages.one': '{n} page',
  'library.card.pages.other': '{n} pages',
  'library.card.lastRead': 'Last read: page {page}',
  'library.card.neverRead': 'Not opened yet',
  'library.card.extracting': 'Preparing text {done}/{total}',
  'library.card.extractDone': 'Text ready',
  'library.card.extractPaused': 'Paused {done}/{total}',
  'library.card.extractFailed.one': '{n} page could not be read',
  'library.card.extractFailed.other': '{n} pages could not be read',
  'library.card.continue': 'Continue reading',
  'library.card.delete': 'Delete',
  'library.card.deleteConfirm': 'Delete "{title}" and everything stored with it?',

  'library.storage': 'Storage used: {used} of {quota}',
  'library.storage.unknown': 'Storage usage is not available in this browser.',

  'library.import.reading': 'Reading the file…',
  'library.import.hashing': 'Checking whether this file is already here…',
  'library.import.opening': 'Opening the PDF…',
  'library.import.duplicate': 'This file is already in your library. Opening it.',
  // 7 — fileHash 가 같아도 pageCount 가 다르면 다른 파일이다.
  'library.import.sameHashOtherFile': 'A different file with the same fingerprint was found. Adding this one separately.',
  'library.import.notPdf': 'That is not a PDF file.',
  'library.import.done': 'Imported: {title}',

  /* ── 자리표시자 — 4~9단계가 채운다 ───────────────── */
  /* ── 리더 (12-3 · 12-4 · 16-F) — 4단계 ───────────── */
  'reader.pageLabel': 'p. {page}',
  'reader.page.nav': 'Page navigation',
  'reader.page.prev': 'Previous',
  'reader.page.next': 'Next',
  'reader.page.input': 'Page number',
  'reader.page.of': 'of {total}',
  'reader.page.empty': 'No text was found on this page.',
  'reader.page.broken': 'This page could not be read. It will be prepared again.',
  'reader.preparing': 'Preparing text {done}/{total}',
  'reader.preparing.unknown': 'Preparing text…',
  'reader.folded.summary': 'Headers, footers, and page numbers',
  'reader.table.placeholder': 'Table',
  'reader.table.viewOriginal': 'View in the original page',

  'reader.typeset.aa': 'Aa',
  'reader.typeset.open': 'Text settings',
  'reader.typeset.title': 'Reading display',
  'reader.typeset.fontSize': 'Text size',
  'reader.typeset.lineHeight': 'Line spacing',
  'reader.typeset.letterSpacing': 'Letter spacing',
  'reader.typeset.font': 'Typeface',
  'reader.typeset.font.sans': 'Sans',
  'reader.typeset.font.serif': 'Serif',
  'reader.typeset.theme': 'Theme',
  'reader.theme.system': 'System',
  'reader.theme.light': 'Light',
  'reader.theme.dark': 'Dark',
  'reader.theme.sepia': 'Sepia',
  'reader.theme.contrast': 'High contrast',
  'quiz.placeholder.title': 'Quiz',
  'quiz.placeholder.body': 'Quizzes from the book are not built yet.',
  'settings.placeholder.title': 'Settings',
  'settings.placeholder.body': 'Display, read-aloud, AI keys, and privacy settings are not built yet.',
  'usage.placeholder.title': 'Usage',
  'usage.placeholder.body': 'The usage dashboard is not built yet.',

  /* ── 정보 (12-1 #/about) ─────────────────────────── */
  'about.title': 'About MedReader',
  'about.body': 'MedReader reads PDF textbooks aloud and reflows them for comfortable reading on a phone. Your files and your reading stay on this device.',
  'about.rights': 'You are responsible for having the right to use any file you import. MedReader neither ships nor distributes any book.',
  'about.openSource': 'Text extraction uses pdf.js ({link}), loaded from a public CDN.',
  'about.openSource.url': 'https://mozilla.github.io/pdf.js/',
  'about.version': 'Version {version}',

  /* ── 14절 오류·상태 배너 ─────────────────────────── */
  // 서비스 계층은 코드만 낸다(3-2). 여기가 코드를 문장으로 바꾸는 유일한 곳이다.
  'err.pdfEngine': 'Could not load the PDF engine. Check your connection and try again.',
  'err.pdfOffline': 'You are offline, so the PDF engine could not be loaded. Pages that are already prepared can still be read.',
  'err.quota': 'This device is out of storage, so the text could not be saved. Free some space or delete a document, then try again.',
  'err.dbBlocked': 'Another tab has this app open with an older version. Close the other tabs and reload.',
  'err.dbOpen': 'Could not open local storage. Private browsing or blocked site data can cause this.',
  'err.extractStalled.one': 'Text preparation stopped with {n} page left unread.',
  'err.extractStalled.other': 'Text preparation stopped with {n} pages left unread.',
  'err.reextract': 'The text engine was updated, so this document is being prepared again.',
  'err.unknown': 'Something went wrong. Please try again.',
  'err.importFailed': 'Could not import that file: {code}',

  'storage.persisted': 'Storage is protected from automatic cleanup.',
  'storage.notPersisted': 'The browser may clear stored text if space runs low.'
};
