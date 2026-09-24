/* ============================================================
   MedReader — 한국어 (spec 11-1 · 19절 3번)

   ★ 이 파일은 **아직 번역되지 않았다.** spec 19절 3번이 "fr·ko 는 키만
     복사하고 값은 영어로 둔다"고 정했고(번역 완성은 10단계), 그래야
     키 집합 일치 테스트(11-2)가 지금부터 의미를 갖는다.

   // TODO: 번역 — 이 파일의 모든 값. 언어 이름 4개(onboarding.lang.*)와
   //               URL 키는 그대로 두고 나머지를 옮긴다.
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
  'common.close': '닫기',
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
  'reader.view.original': '원본',
  'reader.view.reflow': '본문',
  'reader.original.zoomIn': '확대',
  'reader.original.zoomOut': '축소',
  'reader.original.zoom': '{percent}%',
  'reader.original.loading': '원본 쪽을 여는 중…',
  'reader.original.failed': '이 쪽은 원본으로 보여 줄 수 없습니다.',
  'reader.original.canvas': '원본 {page}쪽',
  'reader.table.crop': '원본 쪽에서 잘라 낸 표 그림',
  'reader.table.cropFailed': '표 (그림을 만들지 못했습니다)',

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

  /* ── 낭독 (6-1 · 6-3 · 6-4 · 6-5 · 12-3) ─── */
  'reader.tts.bar': '낭독',
  'reader.tts.play': '재생',
  'reader.tts.pause': '일시정지',
  'reader.tts.prev': '이전',
  'reader.tts.next': '다음',
  'reader.tts.rate': '속도',
  'reader.tts.rate.value': '{rate}×',
  'reader.tts.progress': '{total}중 {index}번째 줄',
  'reader.tts.unit': '낭독 단위',
  'reader.tts.unit.sentence': '문장',
  'reader.tts.unit.line': '줄',
  /* 반복 재생 (5b) — 0 회는 무한이다. */
  'reader.tts.repeat': '반복',
  'reader.tts.repeat.off': '끔',
  'reader.tts.repeat.unit': '한 문장',
  'reader.tts.repeat.range': '구간',
  'reader.tts.repeat.count': '횟수',
  'reader.tts.repeat.times': '{n}회',
  'reader.tts.repeat.endless': '끌 때까지',
  'reader.tts.repeat.span.label': '구간',
  'reader.tts.repeat.span': '{from}번째 줄부터 {to}번째 줄까지',
  'reader.tts.repeat.from': '여기부터',
  'reader.tts.repeat.to': '여기까지',
  'reader.tts.repeat.status': '반복 {done}/{total}',
  'reader.tts.repeat.statusEndless': '반복 중',
  'reader.tts.backToLine': '현재 줄로 돌아가기',
  'reader.tts.waitingPage': '다음 쪽 준비 중…',
  'reader.tts.noVoice':
    '이 기기에 영어 음성이 없습니다. 설정 > 시스템 > 언어 및 입력 > 텍스트 음성 변환 출력에서 Speech Services by Google 언어 팩을 설치하세요.',
  'reader.tts.notAllowed': '브라우저가 낭독을 막았습니다. 재생을 다시 누르세요.',
  'reader.tts.lineSkipped': '한 줄을 읽지 못해 건너뛰었습니다.',
  'reader.tts.pageTimeout': '다음 쪽이 아직 준비되지 않았습니다. 재생을 눌러 이어가세요.',
  'reader.tts.wakeLock': '낭독 중 화면이 꺼질 수 있습니다. 기기 설정에서 화면 시간 제한을 늘리세요.',
  'reader.tts.unsupported': '이 브라우저는 낭독을 지원하지 않습니다.',
  'reader.tts.tableSkipped': '표입니다. 화면을 확인하세요.',
  /* ── 퀴즈 (5-5 · 16-E) — 9b 단계 ───────────────── */
  'quiz.section.fallback': '섹션 {id}',
  'quiz.progress': '문항 {index}/{total}',
  'quiz.question.number': '{number}번 문항',
  'quiz.badge.verified': '책의 정답',
  'quiz.badge.unverified': '정답 미확인',
  'quiz.unverified.help': '이 문항은 채점하지 않습니다. 원문에서 정답을 확인하세요.',
  'quiz.unverified.goToPage': '{page}쪽으로 이동',
  'quiz.answer.correct': '정답',
  'quiz.answer.wrong': '오답',
  'quiz.answer.expected': '책의 정답: {letters}',
  'quiz.explanation.title': '해설',
  'quiz.explanation.none': '이 문항에는 해설이 없습니다.',
  'quiz.explanation.speak': '해설 낭독',
  'quiz.explanation.stop': '낭독 멈춤',
  'quiz.next': '다음',
  'quiz.finish': '결과 보기',
  'quiz.result.title': '결과',
  'quiz.result.score': '{total}문항 중 {score}문항 정답',
  'quiz.result.ungraded.one': '{n}문항은 채점하지 않았습니다.',
  'quiz.result.ungraded.other': '{n}문항은 채점하지 않았습니다.',
  'quiz.result.wrong.title': '다시 볼 문항',
  'quiz.result.allCorrect': '채점된 문항을 모두 맞혔습니다.',
  'quiz.result.retryWrong': '오답만 다시',
  'quiz.result.backToReader': '읽기로 돌아가기',
  'quiz.empty.title': '아직 문항이 없습니다',
  'quiz.empty.body': '이 섹션에는 준비된 문항이 없습니다. 텍스트 준비가 끝나면 나타납니다.',
  'quiz.figure.alt': '원본 쪽에서 잘라 낸 그림',
  'quiz.chip.open': '이 섹션 퀴즈 풀기',
  'quiz.chip.meta.one': '{n}문항',
  'quiz.chip.meta.other': '{n}문항',
  'quiz.chip.dismiss': '나중에',
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
