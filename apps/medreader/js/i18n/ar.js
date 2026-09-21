/* ============================================================
   MedReader — العربية (spec 11-1 · 11-3)

   الأساسية — 주 사용자의 언어다(11-3: 감지 실패 시 기본값이 ar).
   키 집합은 en.js 와 정확히 같아야 한다(tests/i18n.test.mjs).

   ★ 문자열 안에 HTML 없음. 링크는 {link} + 별도 URL 키.
   ============================================================ */

export default {
  'app.name': 'MedReader',
  'app.tagline': 'اقرأ الكتب الطبية واستمع إليها وذاكرها',

  'notice.educationOnly': 'للأغراض التعليمية فقط — لا يُستخدم في القرارات السريرية',

  'nav.library': 'المكتبة',
  'nav.settings': 'الإعدادات',
  'nav.usage': 'الاستهلاك',
  'nav.about': 'حول التطبيق',
  'nav.back': 'رجوع',
  'nav.menu': 'القائمة',

  'common.retry': 'أعد المحاولة',
  'common.cancel': 'إلغاء',
  'common.close': 'إغلاق',
  'common.continue': 'متابعة',
  'common.dismiss': 'إخفاء',
  'common.loading': 'جارٍ التحميل…',

  /* ── التهيئة الأولى (12-2) ───────────────────────── */
  'onboarding.progress': 'الخطوة {step} من {total}',

  'onboarding.lang.title': 'اختر لغتك',
  'onboarding.lang.desc': 'يمكنك تغييرها لاحقًا من الإعدادات.',
  // أسماء اللغات تُكتب بلغتها الأصلية في كل الملفات (12-2).
  'onboarding.lang.ar': 'العربية',
  'onboarding.lang.en': 'English',
  'onboarding.lang.fr': 'Français',
  'onboarding.lang.ko': '한국어',

  'onboarding.consent.title': 'قبل أن تبدأ',
  'onboarding.consent.education.title': 'للتعليم فقط',
  'onboarding.consent.education.body':
    'يساعدك هذا التطبيق على قراءة الكتب الدراسية ومذاكرتها. لا تستخدمه في التشخيص أو العلاج أو أي قرار سريري.',
  'onboarding.consent.privacy.title': 'الخصوصية',
  'onboarding.consent.privacy.body':
    'ترسل ميزات الذكاء الاصطناعي النص إلى خدمة خارجية. لا تُدخل أبدًا معلومات مريض حقيقية — الأسماء أو الأعمار أو نتائج الفحوص أو الصور. قد تستخدم الخدمات المجانية ما ترسله لتحسين نماذجها.',
  'onboarding.consent.check': 'فهمت ذلك',
  'onboarding.consent.needCheck': 'يرجى تأكيد فهمك قبل المتابعة.',

  'onboarding.start.title': 'افتح أول ملف PDF',
  'onboarding.start.desc': 'يبقى الملف على هذا الجهاز. لا يُرفع شيء إلى الإنترنت.',
  'onboarding.start.noKey': 'لا حاجة إلى مفتاح API. القراءة والقراءة الصوتية تعملان بدونه، ويمكنك إضافة مفتاح لاحقًا من الإعدادات.',
  'onboarding.start.import': 'استيراد ملف PDF',
  'onboarding.start.later': 'لاحقًا — اذهب إلى المكتبة',

  /* ── المكتبة (12-6) ──────────────────────────────── */
  'library.title': 'المكتبة',
  'library.import': 'استيراد ملف PDF',
  'library.empty.title': 'مكتبتك فارغة',
  'library.empty.body': 'استورد ملف PDF لتبدأ القراءة.',
  'library.empty.fileProtocol':
    'يجب فتح هذا التطبيق عبر ‎http://‎ أو ‎https://‎. إذا فُتح من ملف مباشرةً فسيمنع المتصفح وحداته وتخزينه.',

  'library.card.pages.one': 'صفحة واحدة',
  'library.card.pages.other': '{n} صفحة',
  'library.card.lastRead': 'آخر قراءة: صفحة {page}',
  'library.card.neverRead': 'لم يُفتح بعد',
  'library.card.extracting': 'تجهيز النص {done}/{total}',
  'library.card.extractDone': 'النص جاهز',
  'library.card.extractPaused': 'متوقف مؤقتًا {done}/{total}',
  'library.card.extractFailed.one': 'تعذّرت قراءة صفحة واحدة',
  'library.card.extractFailed.other': 'تعذّرت قراءة {n} صفحة',
  'library.card.continue': 'متابعة القراءة',
  'library.card.delete': 'حذف',
  'library.card.deleteConfirm': 'هل تريد حذف «{title}» وكل ما هو مخزَّن معه؟',

  'library.storage': 'المساحة المستخدمة: {used} من {quota}',
  'library.storage.unknown': 'معلومات المساحة غير متاحة في هذا المتصفح.',

  'library.import.reading': 'جارٍ قراءة الملف…',
  'library.import.hashing': 'جارٍ التحقق مما إذا كان الملف موجودًا…',
  'library.import.opening': 'جارٍ فتح ملف PDF…',
  'library.import.duplicate': 'هذا الملف موجود في مكتبتك. سيُفتح الآن.',
  'library.import.sameHashOtherFile': 'وُجد ملف مختلف ببصمة مطابقة. ستُضاف هذه النسخة على حدة.',
  'library.import.notPdf': 'هذا ليس ملف PDF.',
  'library.import.done': 'تم الاستيراد: {title}',

  /* ── شاشات قيد الإنشاء ──────────────────────────── */
  'reader.placeholder.title': 'القارئ',
  'reader.placeholder.body': 'عرض القراءة المنسَّق لم يُنشأ بعد.',
  'reader.placeholder.doc': 'المستند: {docId}، صفحة {page}',
  'quiz.placeholder.title': 'الاختبار',
  'quiz.placeholder.body': 'أسئلة الكتاب لم تُنشأ بعد.',
  'settings.placeholder.title': 'الإعدادات',
  'settings.placeholder.body': 'إعدادات العرض والقراءة الصوتية والمفاتيح والخصوصية لم تُنشأ بعد.',
  'usage.placeholder.title': 'الاستهلاك',
  'usage.placeholder.body': 'لوحة الاستهلاك لم تُنشأ بعد.',

  /* ── حول التطبيق ────────────────────────────────── */
  'about.title': 'حول MedReader',
  'about.body': 'يقرأ MedReader كتب PDF بصوت مسموع ويعيد تنسيقها لقراءة مريحة على الهاتف. تبقى ملفاتك وقراءاتك على هذا الجهاز.',
  'about.rights': 'أنت مسؤول عن امتلاك حق استخدام أي ملف تستورده. لا يوزّع MedReader أي كتاب ولا يحتوي عليه.',
  'about.openSource': 'يستخدم استخراج النص مكتبة pdf.js ‏({link}) المحمَّلة من شبكة توزيع عامة.',
  'about.openSource.url': 'https://mozilla.github.io/pdf.js/',
  'about.version': 'الإصدار {version}',

  /* ── 14 — الأخطاء وأشرطة الحالة ─────────────────── */
  'err.pdfEngine': 'تعذّر تحميل محرك PDF. تحقّق من الاتصال ثم أعد المحاولة.',
  'err.pdfOffline': 'أنت غير متصل، لذا تعذّر تحميل محرك PDF. يمكنك قراءة الصفحات المجهَّزة مسبقًا.',
  'err.quota': 'لا توجد مساحة كافية على الجهاز، فلم يُحفظ النص. أفرِغ بعض المساحة أو احذف مستندًا ثم أعد المحاولة.',
  'err.dbBlocked': 'التطبيق مفتوح في تبويب آخر بإصدار أقدم. أغلق التبويبات الأخرى ثم أعد التحميل.',
  'err.dbOpen': 'تعذّر فتح التخزين المحلي. قد يحدث هذا في التصفح الخاص أو عند حظر بيانات الموقع.',
  'err.extractStalled.one': 'توقّف تجهيز النص وبقيت صفحة واحدة دون قراءة.',
  'err.extractStalled.other': 'توقّف تجهيز النص وبقيت {n} صفحة دون قراءة.',
  'err.reextract': 'جرى تحديث محرك النص، لذا يُعاد تجهيز هذا المستند.',
  'err.unknown': 'حدث خطأ ما. يرجى إعادة المحاولة.',
  'err.importFailed': 'تعذّر استيراد الملف: {code}',

  'storage.persisted': 'التخزين محمي من التنظيف التلقائي.',
  'storage.notPersisted': 'قد يمسح المتصفح النص المخزَّن إذا قلّت المساحة.'
};
