# Build 보고서 — 9c-1 백업 내보내기 (spec 17-4-1)

> Build 서브에이전트 · 2026-11-17 · 직전 배포 18 `434435a` 위. **커밋하지 않음.** 운영자 위임(2026-11-15) — 9c-Q1(암호 없음)·Q2(캐시 기본 켬)·Q3(문맥 담음)은 설계 기본값 그대로.
> 호출 0 · 업로드·동기화 없음(기기에 저장만) · 키 0건. DB 3·`algoVersion`(12)·캐시 키·`PROMPT_VERSION` 무변 · `db.js`·`pipeline.js`·`vocab.js`·`search.js`·`dev/`·review.md 무변.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/backup.js` **새**(순수, 531줄) | `docForBackup` · `settingsForBackup`·`settingAllowed` · `headLine`·`recLine`·`endLine`·`parseLine` · `readHead` · `lineSplitter` · `remapRecord` · `mergeRecord`(+`unionRanges`·`sameValue`) · `backupAge`·`backupFileName` · `scrubText`·`hasKeyShape`. import 는 `config`·`text/vocab.js`(`importPlan` **부르기만**) |
| `js/backup/export.js` **새**(서비스, 235줄) | `exportBackup`(1,000줄 `getAll` 묶음 → 조각 Blob → gzip 조각) · `cacheSize` · `pdfList` · `pdfBlob`. import 는 `db`·`config`·`hash`·`text/layout`·`text/backup` 만 |
| `js/ui/backup.js` **새**(246줄) | 설정 카드 — 마지막 백업 줄(30일 넘으면 주의 색+짧은 글자) · `☑ 저장된 번역 포함(약 n)` · [내보내기]·진행 막대(`aria-live`, 1초마다) · `<a download>` · `backup.lastExportAt` · 접는 "PDF 원본 따로 받기" · `#/settings/backup` 굴림·제목 포커스 |
| `tests/backup-9c.test.mjs` **새** | K1–K14 (25 시험 — 2절) |
| `js/config.js` | `BACKUP` {FORMAT 1 · BATCH 1000 · IMPORT_BATCH 500 · STALE_DAYS 30 · STORES 10 · DOC_FIELDS 20 · SETTINGS_KEYS 37 · SETTINGS_SKIP 18} |
| `js/settings.js` | `'backup.lastExportAt': null` |
| `js/ui/settings.js` | import 1 + `initBackupCard()`·`showBackupCard(tab)`·`leaveBackupCard()` (+6줄) |
| `index.html` | `#settingsBackup` 카드(동의 카드 다음·**AI 카드 위**) · 서재 저장 줄을 `.storage-row` 로 감싸 옆에 `[백업]`(`data-nav="#/settings/backup"` — **`library.js` 무변**) · stamp |
| `css/screens.css` | `.storage-row`·`.backup-*`(논리 속성, 48px, `overflow-wrap:anywhere`, 주의 색, `scroll-margin-block-start` — 붙박이 상단바 밑에 제목이 숨지 않게) |
| i18n ko·en·fr·ar | 29키(`backup.*` — ar·fr `[검토 — Nour·운영자]`) |
| `spec.md` | 3-2 `backup/*` 행 한 줄 · 9-3 `backup.lastExportAt` 한 줄 · 17-4-1 5 표 아래 `[정정 2026-11-17 — 9c-1 Build]` 묶음 |

### 설정 허용 목록 분류 (`DEFAULTS` 55키 전부 — K2 가 지킴)

| 담음 (37) | 안 담음 (18) — 까닭 |
|---|---|
| `ui.lang`·`ui.theme` · `reader.*` 7(view·fontSize·lineHeight·letterSpacing·font·showDone·autoScroll) · `tts.rate`·`tts.unit`·`tts.repeat.count`·`tts.autoSummarize`·`tts.wakeLock`·`tts.readCitations`·`tts.scriptSwitch`·`tts.mediaKeys` · `voice.enabled`·`voice.cmdLang`·`voice.sayErrors` · `readalong.*` 4(mode·speakSource·display·**lastOn** — 9b) · `search.recent` · **`vocab.lastExportAt`** · **`links.medical`**(18) · `ai.provider`·`ai.model`·`ai.translationLang`·`ai.summaryLangs`·`ai.useOnDevice`·`ai.dailyCap`·`ai.warnAt`·`ai.cacheLimitMB`·`ai.maxReqChars` · `privacy.piiCheck` | `tts.voice.en/ar/fr/ko/**es**`·`tts.accent.en/ar/fr/ko/**es**`(8k·8n — 기기 음성 URI·억양: **기기 몫**) · `voice.tag`(기기 인식 태그) · `voice.noticeAt`(마이크 고지 — 새 기기에서 다시) · `privacy.consentedAt`(**AI 전송 동의는 새 기기에서 다시** — 9c-D5) · `privacy.rememberKey`(키 위치) · `onboarding.done` · `dev.debug` · `ai.proxyUrl` · **`backup.lastExportAt`**(기기마다) |

- 8c-1·8c-2·8f-3 이 더한 **설정 키는 없다**(8c-2 `capWarned` 는 `usage` 행 필드 — 설정 아님). `srs.*`·`reading.*`·`planner.exams` 는 아직 키가 없어 넣지 않음(12-1·13-1 몫).
- 키 모양 값(`REDACT_PATTERNS`)은 허용 키라도 **행째 뺀다**(예: `ai.model` 에 붙여 넣은 키, 주소에 키가 든 `links.medical`).

## 2. 수용 기준 (17-4-1 "9c-1" + 순수 함수의 "9c-2" `[N]`)

| 기준 | 결과 | 근거 |
|---|---|---|
| `[N]` docForBackup — 사용자 몫만·extraction/sectionIndex*/모르는 필드 없음 | ✔ | K1 · K3(내보낸 documents 줄 필드 ⊂ DOC_FIELDS) |
| `[N]` settingsForBackup — DEFAULTS 모든 키가 담음/안 담음 **하나에만**(겹침·DEFAULTS 밖 이름도 빨강) · 동의·키 기억·목소리·태그·dev 없음 | ✔ | K2·K2b |
| `[N]` 줄 꼴 — 머리→rec→끝, 줄마다 JSON, 날 줄바꿈·CR 없음, 순서 고정, 머리 counts = 끝 counts = 실제 | ✔ | K3·K3b(2,007개 — 묶음 경계 겹침·빠짐 0, 키 순서) |
| `[N]` ★ 키 0건 — 가짜 키(AQ.·AIza·sk-·Bearer)를 가짜 세션/로컬 저장소·설정(허용·허용 밖·모르는 키)·필기·제목·캐시 결과에 심고 gzip 풀어서 · REDACT_PATTERNS·KEY_SHAPES 일치 0 | ✔ | K4(gzip·평문 둘 다) · headless run-x `keyHits 0`·`redact 0` |
| `[N]` 정적 — `backup/*`·`text/backup.js` import 에 privacy/·ai/·ui/ 0, `localStorage`·`sessionStorage` 낱말 0 | ✔ | K5(+ 서비스 import 는 config·db·hash·text/* 만) |
| `[D]` 150MB 내보내기 힙 | ✔(기준 조정 — 4절) | 읽기·줄 단계 **+14.6MB**(두 번 같음) · 끝난 뒤 남는 양 **+0.3MB** · 전체 최댓값 +78.8MB(압축 흐름 조각 — 기록만) |
| `[D]` 캐시 끄기 → aiCache 줄 0 · lastExportAt 갱신 · "마지막 백업: 오늘" | ✔ | run-x f2·x1 · K6 |
| `[D]` 360×740·412×915 × 4언어 — 가로 넘침 0 · 48px · 진행 막대 `aria-live` | ✔ | run-l(pl2) 8조합 전부 · RTL ar · 서재 [백업] 48px |
| `[N]` lineSplitter — 줄 가운데·UTF-8 다바이트 가운데(디코더 몫)·`\r\n` 경계·끝 줄바꿈 없음 | ✔ | K7(모든 바이트 위치 자르기)·K7b(실제 파일 20번 무작위) |
| `[N]` remapRecord — 캐시 키 셋째 칸만(해시·`w=` 그대로) · `{docId}:` 접두만 · 다른 문서 무변 | ✔ | K9 |
| `[N]` mergeRecord 표 전부 + **멱등**(전 스토어 깊은 비교) | ✔ | K10a–h · K11(빈 기기·값이 다른 기기 각각 두 번 = 한 번) |
| `[N]` 잘린 파일·`format:2` 거절 | ✔(순수 몫) | K8(`readHead` newer·not-backup · `parseLine` 반쪽 줄 bad). 흐름·묶음 쓰기는 9c-2 |
| fake-idb 종단(9c-2) | — | 지시대로 제외 |
| 공통 — innerHTML 새 사용 0 · 콘솔 오류 0 · 무료 티어 숫자 0 · stamp | ✔ | K13 · headless 전부 console 0·pageerror 0 |

## 3. 시험

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1702/1702 · 1702/1702**(HEAD 1677 + K 25). `stamp-importmap --check` "그대로다(모듈 78·CSS 4)" · `git diff --check` 0.
- 처음 전체에서 **8d D8 빨강 1** — `ui/settings.js` → `ui/backup.js` → `ai/cache.js` 가 inlinetr 의 import 고리에 캐시를 끌어옴. → `ai/cache.js` 대신 `backup/export.js` `cacheSize()`(같은 `sizeBytes` 합 — K12b 가 `cache.stats()` 와 같음을 잼), `ui/backup.js` 의 `ai/*` import 금지를 K13 에 더함.

### 변이 (읽어서 쓰기 백업 `b9c1/bak/` → 시험 → 되돌림 → `cmp` 0)

| # | 변이 | 빨강 |
|---|---|---|
| M1 | 허용 목록에 `privacy.consentedAt` | K2·K2b·K3·K10a |
| M2 | `docForBackup` 가 `extraction` 남김 | K1·K3 |
| M3 | 줄 묶음 대신 스토어 통째로(묶음 1e9) | K3b + **힙: 읽기 단계 +502MB**(기준 +64MB 빨강) |
| M4 | `export.js` 에 `privacy/keys.js` import | K5 |
| M5 | 설정 키 모양 값 검사 지움 | K2b·K4 |
| M6 | 줄 글자 지우개(`[KEY]`) 지움 | K4 |
| M7 | usage 불리언 OR → 기기 값 우선 | K10c (처음엔 살아남음 → `false`/`true` 경우를 더해 빨강) |
| M8 | 문장 카드 `max(updatedAt, reviewedAt)` → `updatedAt` 만 | K10h |
| M9 | lineSplitter `\r` 떼기 지움 | K7 |
| M10 | 캐시 키 셋째 칸 바꿔 쓰기 지움 | K9 |
| M11 | term 병합 `edited` 파일 값 덮기 지움 | K10f |
| M12 | 묶음 한 번만 읽기 | K3b |

`cmp`(되돌린 파일 = bak): `js/backup/export.js`·`js/text/backup.js`·`js/config.js` 모두 차이 없음(+ 돌리기 스크립트가 12개 전부 바이트 비교).

## 4. 힙 측정 (Edge `--enable-precise-memory-info` · `--expose-gc` · 프로필 `b9c1/ph1` · 합성 캐시 15만 개)

- 합성: 지어낸 아랍어 낱말 69개 의사 난수 · 레코드당 약 1.1KB · 캐시 크기 줄 "약 214 MB"(`sizeBytes` = UTF-16 셈) · 평문 **162.5MB(170,396,733 B, 150,012 줄)** → gzip **21.7MB(22,785,377 B), 압축률 0.134**. `[주의]` 낱말 69개로 지은 글이라 실제 번역보다 잘 눌린다 — 실제 아랍어는 더 클 것(실기기 `[M]`).
- 화면 경로([내보내기] 클릭) 두 번: **읽기·줄 단계 최댓값 +14.6MB · 전체 최댓값 +78.8MB · 끝난 뒤 gc 3번 남는 양 +0.3MB** · 7.3초.
- 처음 꼴(커서 `iterate` · `join` · `Response(…).blob()`)은 **+84MB → 같은 코드가 +27–140MB 로 흔들렸다**. 진단(b9c1 `run-diag*.mjs`):
  1. 문자열로 만든 Blob·압축 결과 Blob 은 힙에 남지 않음(gc 뒤 +0.3).
  2. 묶음 글자 `join` → 묶음 쓰레기 45→30MB(diag2). 커서 1,000 걸음 → 묶음 객체가 늙은 영역으로 올라가 V8 한도까지 쌓임 → **`getAll(범위, 1000)` 한 요청**으로(diag8–11: 읽기 단계 26–29 → 14.6MB, 흔들림 없음).
  3. `new Response(흐름).blob()` 은 압축 결과 조각을 다 쥠(+35MB) → 1MB 마다 Blob 조각으로.
  4. 남은 +64MB 쯤은 **압축 단계의 `blob.stream()` 64KB 조각**: `usedJSHeapSize` 가 **ArrayBuffer 내용을 센다**(50MB 버퍼 → +50MB, diag12), 150MB 평문을 **읽기만** 해도(앱 코드 없이) +91MB. V8 의 바깥 메모리 GC 문턱(약 64MB)까지 쌓였다 걷힌다 — 데이터 크기와 무관한 상한이고 남지 않는다.
- **기준 조정**(설계가 허용 — "Build 가 재서 조정 가능, 근거 남김", spec 17-4-1 정정 ⑦): (가) 읽기·줄 단계 ≤ +64MB(실측 14.6, M3 502) · (나) 끝난 뒤 남는 양 ≤ +4MB(실측 0.3) · 압축 포함 전체는 기록만(+78.8). 9c-2 의 `file.stream()` 도 같은 성질이라 같은 둘로 잴 것.
- 합성 파일: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b9c1\dl\h-150k.jsonl.gz`(22,785,377 B) — 남겨 둠. `b9c1/` 전체 452MB(대부분 프로필 `ph1` 의 IndexedDB).

## 5. headless (Edge · 새 프로필 `b9c1/p*` · pipe · 가짜 키 세션+로컬 · 흉내 Gemini OPTIONS 204 + CORS · 캐시 끔 · 한 번에 하나 · 서버 새로 띄우지 않음 — 8000 쓰기만)

- 내려받기: `URL.createObjectURL` 을 감싸 Blob 을 잡고 `<a>.click` 은 기록만(실제 내려받기·이동 0). Node 로는 조각 base64 로 옮겨 **`b9c1/dl/` 에만** 씀. 앱 출처·흉내 Gemini·pdf.js CDN(body 비교만 — 앱이 원래 쓰는 라이브러리) 말고 모든 요청 abort → **외부 0**.
- **run-x**(px2, ko 412×915, 합성 서재·캐시 50) 전부 ✔: 서재 [백업] 48px·저장 줄과 한 줄 → `#/settings/backup` · 제목 포커스 · **제목이 붙박이 상단바 밑에 숨지 않음**(h2 74 ≥ 바 57 — 처음엔 카드 top 0 으로 숨었음 → `scroll-margin` 고침) · 카드가 AI 위 · "아직 백업하지 않았습니다" · "저장된 번역 포함 (약 9.8 KB)" 기본 켬 · 내보내기 → gzip Blob 1·`<a download>` 1(`medreader-backup-YYYYMMDD-HHmm.jsonl.gz`) · 풀어서 62줄 머리/끝·counts 일치·키 0·`note with [KEY]` · 설정 줄은 `ai.translationLang`·`ai.useOnDevice`·`ui.lang` 셋(동의·온보딩·키 모양 `ai.model`·`ai.proxyUrl` 없음) · "마지막 백업: 오늘"·lastExportAt 숫자 · 캐시 끔 → aiCache 0 · PDF 목록 1(blob 있는 책만)·48px·`aria-label`·크기 `<bdi dir=ltr>` → 4,096B `application/pdf` `syn-a.pdf` · 40일 전 → 주의 색 + 짧은 글자 · Gemini 요청 0.
- **run-l**(pl2) 8조합 가로 넘침 0·48px·`aria-live` · ar RTL · 진행 막대 보임(ar 412) · 스크린샷 `b9c1/shots/card-360x740-ar.png`·`card-360x740-fr.png`·`card-412x915-ko.png`·`card-412x915-en.png`·`card-412x915-ar-done.png`·`x-ko-412-stale.png`.
- **run-r**(pr1) 회귀 ✔: 8c-2 `#/settings/cache` [비우기] 포커스 · 설정 카드 다섯(백업·AI·번역·목소리·의료 사이트) · 사용량 화면(오늘·30일 막대·캐시) · 서재(카드 2·저장 줄·의료 사이트·[백업]·단어장) · **8f-3 단어장 CSV 내보내기**(잡은 Blob `text/csv`·3줄·`medreader-vocab-YYYYMMDD.csv`·lastExportAt 숫자 — Blob.text() 가 BOM 을 떼므로 BOM 은 8f-3 의 U15 몫).
- **번역 요청 본문 HEAD 와 같음**(run-body, 실물 PDF·같은 프로필 pb1·`aiCache` 비우고 40쪽 [▶] 8초): HEAD 판(`git show HEAD` → `b9c1/head`, 27파일 가로채 내줌) POST 2개 `8f301ea7584678d4`(2747B)·`1da11781b23e9ac3`(9426B) = 지금 판 같은 둘(18 보고서 값과도 같음).
- 모든 실행 콘솔 오류 0 · pageerror 0 · 새 탭 0 · 외부 0.

## 6. spec 정정 (Edit 로 그 자리만)
- 3-2 규칙 목록: `backup/*` 행(= vocab/search 행, privacy/ai/ui import 0 — K5) · `ui/backup.js` 도 `ai/*` 금지(8d D8).
- 9-3: `backup.lastExportAt (ms, 기본 null)` 한 줄.
- 17-4-1 5 표 아래 `[정정 2026-11-17 — 9c-1 Build]`: `mergeRecord` 반환 꼴 · cards(문장 카드 `max(updatedAt, reviewedAt)` · term 은 importPlan **그대로** — 충돌·거절은 **기기 값 유지**(백업은 고르기 없음), `edited` 는 파일 값, 복습 필드는 `reviewedAt` 늦을 때만, id 다음 term+targetLang 찾기는 9c-2 몫) · usage(객체 안까지 큰 값·`capWarned` OR) · progress `@read` 구간 합집합 · documents(`lastOpenedAt` 함께·`outlineV`·`columnsHint`·`docReset` 인자) · settings/questions/annotations · ① DOC_FIELDS 에 `outlineV` ② 키 모양 지우기 두 겹 ③ `cacheSize()` ④ 메모리 꼴(getAll·join 없음·gzip 조각) ⑤ 9c-1 동안 안내 문구 ⑥ i18n 29키 ⑦ **힙 기준 조정**.

## 7. 실기기 목록 (`[M]` — 마지막 점검 묶음, 17-4-1 10 그대로 + 이번에 생긴 것)
- [ ] Nour GT 7(또는 운영자 Fold 7) 실제 데이터로 [내보내기] — 걸린 시간·파일 크기·앱이 죽지 않는가(큰 캐시). 압축 단계 메모리(합성 +79MB — 폰 Chrome 의 바깥 메모리 문턱).
- [ ] 실제 아랍어 번역 캐시의 압축률(합성 0.134 는 낱말 69개라 낙관적).
- [ ] 내려받은 `.jsonl.gz` 가 Android "다운로드" 에 보이고 WhatsApp/텔레그램 **문서**로 보내지는가(이름·`.gz` 막힘).
- [ ] `[PDF 내려받기]` 받은 PDF 가 원본과 같은 크기인가 · 이름이 `fileName` 그대로인가.
- [ ] 메신저 안 브라우저에서 내려받기 막힘 — 가이드 "Chrome 으로 여세요".
- [ ] 360 폰에서 [백업] → 카드 제목이 상단바 밑에 숨지 않는가(헤드리스 ✔ — 실기기 주소창 높이 변화).
- [ ] ar·fr 29키 `[검토 — Nour·운영자]`(ar 복수형 "قبل {n} يوم/يومًا").
- (9c-2·9c-3 몫은 17-4-1 10 의 가져오기·PDF 가져오기 줄 그대로.)

## 8. 남은 문제
1. **안내 줄**(`backup.howto`)은 "이 판에는 아직 가져오기가 없습니다" — 9c-2 가 6절 문구("가져온 뒤 같은 PDF 를 서재에서…")로 바꿔야 한다.
2. 진행 글자는 1초에 한 번·묶음 이름이 바뀔 때만 바뀐다(낭독기 소음 줄이기) — 작은 스토어는 "0/n" 으로 보였다 사라진다(막대는 매 묶음). 원하면 끝난 스토어 수를 한 번 더.
3. 설정 화면을 열 때마다 `cacheSize()` 가 캐시 전체를 훑는다(15만 개 ≈ 3초, 그동안 "저장된 번역 포함" 만 보임). 8c-2 사용량 화면과 같은 비용 — 커지면 크기 셈을 `cache.js` 의 `total` 과 나누는 길(8d D8 때문에 import 불가 — 이벤트·설정 메모리로)을 생각할 것.
4. 9c-2 몫으로 넘김: ① term 은 **id 다음 `term` 인덱스 + `targetLang`** 으로 기기 항목을 찾아 `mergeRecord` 에 넘길 것(순수 함수는 넘긴 한 항목만 본다 — 원어를 고친 항목이 다른 기기 항목과 겹치는 `dup` 은 importPlan 이 한 항목만 보고는 못 잡는다 → 가져오기가 `term` 인덱스로 겹침을 확인) ② documents 는 `db.patch` 의 함수 안에서 `mergeRecord('documents', cur, theirs)` 를 다시 불러 경합을 피할 것 ③ `links.medical` 항목 id 꼴 검사(crossstep 18R-8) ④ 힙은 4절의 두 기준으로.
5. HEAD 부터(9c 무관): `showLinksSettings('links')` 도 같은 `scrollIntoView({block:'start'})` 라 18 카드 제목이 붙박이 상단바 밑에 숨을 수 있다(이번에 백업 카드에서 발견 — 18 카드는 고치지 않음, 범위 밖).

## 9. 막힌 명령 · 규칙
- 막힌 명령 없음.
- 한 호출 한 가지: 결과는 `>` 로 파일에 쓰고 따로 읽음(파이프·`&&`·`;` 묶음 없음). 환경 변수 접두(`B9C1_HEAD=1 node …`) 한 번.
- 변이는 `mutrun.mjs` 한 실행이 12개를 차례로(적용 → 시험 → 되돌림 → 바이트 비교) — 그 뒤 `cmp` 로 세 파일 따로 확인.
- 서버 새로 띄우지 않음(8000 쓰기만) · 프로세스 조회·디버깅 포트 없음 · 외부 사이트 0 · 진짜 키 없음 · 프로필 복사 없음 · 커밋·checkout/restore/stash 없음 · `.nojekyll` 무변 · `dev/measure-table-8i4.mjs` 손대지 않음 · 새로 생긴 `.claude/tasks/medreader-build-9c2-import.md`(다른 쪽이 씀) 손대지 않음 · C: 남은 공간 94GB.
