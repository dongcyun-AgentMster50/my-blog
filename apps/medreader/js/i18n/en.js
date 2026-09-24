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
  /* ── 원본 뷰 · 표 크롭 (12-5 · 4-8) — 6b 단계 ────── */
  'reader.view.original': 'Original',
  'reader.view.reflow': 'Text',
  'reader.original.zoomIn': 'Zoom in',
  'reader.original.zoomOut': 'Zoom out',
  'reader.original.zoom': '{percent}%',
  'reader.original.loading': 'Opening the original page…',
  'reader.original.failed': 'This page cannot be shown as the original.',
  'reader.original.canvas': 'Original page {page}',
  'reader.table.crop': 'Table image from the original page',
  'reader.table.cropFailed': 'Table (the image could not be made)',

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

  /* ── 낭독 (6-1 · 6-3 · 6-4 · 6-5 · 12-3) — 5단계 ─── */
  'reader.tts.bar': 'Read aloud',
  'reader.tts.play': 'Play',
  'reader.tts.pause': 'Pause',
  'reader.tts.prev': 'Back',
  'reader.tts.next': 'Forward',
  'reader.tts.rate': 'Speed',
  'reader.tts.rate.value': '{rate}×',
  'reader.tts.progress': 'Line {index} of {total}',
  'reader.tts.unit': 'Read by',
  'reader.tts.unit.sentence': 'Sentence',
  'reader.tts.unit.line': 'Line',
  /* 반복 재생 (5b) — 0 회는 무한이다. */
  'reader.tts.repeat': 'Repeat',
  'reader.tts.repeat.off': 'Off',
  'reader.tts.repeat.unit': 'One sentence',
  'reader.tts.repeat.range': 'A range',
  'reader.tts.repeat.count': 'How many times',
  'reader.tts.repeat.times': '{n} times',
  'reader.tts.repeat.endless': 'Until I stop',
  'reader.tts.repeat.span.label': 'Range',
  'reader.tts.repeat.span': 'Lines {from} to {to}',
  'reader.tts.repeat.from': 'Start here',
  'reader.tts.repeat.to': 'End here',
  'reader.tts.repeat.status': 'Repeat {done}/{total}',
  'reader.tts.repeat.statusEndless': 'Repeat on',
  'reader.tts.backToLine': 'Back to the current line',
  'reader.tts.waitingPage': 'Preparing the next page…',
  // 6-3 — 안내 문구는 spec 그대로. 기기 설정 경로를 그대로 적는다.
  'reader.tts.noVoice':
    'This device has no English voice. Install a language pack in Settings > System > Languages & input > Text-to-speech output > Speech Services by Google.',
  'reader.tts.notAllowed': 'The browser blocked read-aloud. Tap Play again.',
  'reader.tts.lineSkipped': 'One line could not be spoken and was skipped.',
  'reader.tts.pageTimeout': 'The next page is not ready yet. Tap Play to continue.',
  'reader.tts.wakeLock': 'The screen may turn off while reading. Increase the screen timeout in your device settings.',
  'reader.tts.unsupported': 'This browser cannot read text aloud.',
  'reader.tts.tableSkipped': 'A table is here. Please look at the screen.',
  /* ── 퀴즈 (5-5 · 16-E) — 9b 단계 ───────────────── */
  'quiz.section.fallback': 'Section {id}',
  'quiz.progress': 'Question {index} of {total}',
  'quiz.question.number': 'Question {number}',
  'quiz.badge.verified': 'Answer from the book',
  'quiz.badge.unverified': 'Answer not confirmed',
  'quiz.unverified.help': 'This question is not graded. Check the answer in the book.',
  'quiz.unverified.goToPage': 'Go to page {page}',
  'quiz.answer.correct': 'Correct',
  'quiz.answer.wrong': 'Not correct',
  'quiz.answer.expected': 'Book answer: {letters}',
  'quiz.explanation.title': 'Explanation',
  'quiz.explanation.none': 'The book gives no explanation for this question.',
  'quiz.explanation.speak': 'Read aloud',
  'quiz.explanation.stop': 'Stop',
  'quiz.next': 'Next',
  'quiz.finish': 'See the result',
  'quiz.result.title': 'Result',
  'quiz.result.score': 'Score {score} of {total}',
  'quiz.result.ungraded.one': '{n} question was not graded.',
  'quiz.result.ungraded.other': '{n} questions were not graded.',
  'quiz.result.wrong.title': 'Review these',
  'quiz.result.allCorrect': 'Every graded question was correct.',
  'quiz.result.retryWrong': 'Retry the ones I missed',
  'quiz.result.backToReader': 'Back to reading',
  'quiz.empty.title': 'No questions here yet',
  'quiz.empty.body': 'This section has no questions ready. They appear once the text is prepared.',
  'quiz.figure.alt': 'Image from the original page',
  'quiz.chip.open': 'Take the quiz for this section',
  'quiz.chip.meta.one': '{n} question',
  'quiz.chip.meta.other': '{n} questions',
  'quiz.chip.dismiss': 'Not now',
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
