# Build 보고 — 8f-1 단어장 데이터 · 단어 요청 (화면 없음)

> Build 서브에이전트, 2026-11-16. 지침 `.claude/tasks/medreader-build-8f1-vocab-data.md`, 설계 spec 17-7-6(4-3·4-4·5 8f-1 행·6·8 "8f-1"·9·10), crossstep-notes "8f-1" 세 줄 + "9c" 절. 운영자 위임(권장안). **커밋하지 않았다.** 직전 배포 `2570a94`(8c-1).

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/vocab.js` (새, 순수) | `normalizeTerm` · `findInSentenceTr` · `newTermEntry`(9-2 필드 + `reviewedAt`·`introducedAt`, 시각 숫자 ms) · `TERM_CONTENT_FIELDS`·`TERM_REVIEW_FIELDS` · `buildCsv`(BOM·CRLF·RFC 4180·수식 접두) · `buildAnki` · `parseCsv`(2MB UTF-8 바이트·5,000행·열 이름 맞춤) · `importPlan` · `csvCell`·`unFormula`·`msOf`·`normalizePos`·`utf8Bytes` |
| `js/vocab/store.js` (새, 서비스) | `createVocabStore({db, now})` / `vocabStore`: `findTerm` · `save`(찾기+쓰기 한 트랜잭션, 중복이면 기존) · `update`(EDITABLE 만, 내용 바뀔 때만 `updatedAt`, 사용자면 `edited`) · `remove` · `list({docId})` · `countByDoc` · `changedSince(ms|ISO|null)` · `applyImport`(한 트랜잭션, 복습 필드 보존) · `termIdOf`. import 는 `db`·`hash`·`text/vocab` 뿐(`config` 는 text/vocab 이 읽음) |
| `js/ai/pipeline.js` | `runJob(job, items, keys, opts)` 일반화 — `translate()` 는 `TRANSLATE_JOB` 으로, 새 `translateTerms()` 는 `TERM_JOB` 으로 같은 함수를 탄다. `chunksOf`·`sendChunk`·`accept`·`sendAll` 이 job 을 받는다. `FAIL.EMPTY/LONG/LANG`, `MORE`, `TRANSLATE_JOB`·`TERM_JOB` export. 객체에 `translateTerms`·`runJob` |
| `js/ai/prompts.js` | `TERM_PROMPT_VERSION = 1` · `TERM_SCHEMA` · `TERM_POS` · `TERM_SRC_LINE` · `termInstruction`(domain 줄) · `buildTermRequest` · `TARGET_SCRIPT` · `checkTerms`. 번역 쪽 한 글자도 안 바꿈(`PROMPT_VERSION` 3 그대로) |
| `js/ai/provider.js` | `bumpUsage` 가 `kind:'term'`(`AI.TERM_KIND`) 받기 · `capWarned:true` 받기(+4) |
| `js/config.js` | `AI.TERM_KIND` · `VOCAB` 상수(묶음 20·토큰 120/100·검증 상한·품사·후보 4낱말·가져오기 상한·CSV 열·`CSV_COL`·Anki 머리·origin) |
| `js/db.js` | `keepsOnDocDelete(rec)`(export) — `deleteDocument` 의 `cards` 쓸기에서 `kind:'term'` 건너뜀. DB 버전 3 그대로 |
| `js/settings.js` | `'vocab.lastExportAt': null` |
| `index.html` | stamp 만(import map — 모듈 70개) |
| `tests/vocab-8f.test.mjs` (새, 19) · `tests/term-8f.test.mjs` (새, 16) | 아래 표 |
| `spec.md` | 17-7-6 4-3·4-4·4-6 끝에 `[정정 2026-11-16 — 8f-1 Build]` 각 한 줄(Edit, 그 자리만) |

화면 파일·`selbar.js`·`trband.js`·`controls.js`·review.md·`dev/`·`dev/measure-table-8i4.mjs` 손대지 않음. `text/select.js` 도 안 고침(`expandWord`·`clampSelection` 은 8c-1 것을 시험만).

## 2. 수용 기준 "8f-1"

| 기준 | 결과 | 시험 |
|---|---|---|
| `[N]` findInSentenceTr: 아랍어 `arthritis`·`rheumatoid arthritis` → 괄호 앞 아랍어 후보, 괄호 없음 → null, 대소문자·NFKC 무시, 다른 괄호·`،` 에서 멈춤, ko·fr 각 1 | ✔ | vocab F1·F2·F3 |
| `[N]` normalizeTerm·expandWord: 하이픈 결합 → 결합 꼴, 앞뒤 구두점·`|` 제거, 6낱말·60자 경계 | ✔ | vocab N1·N2 |
| `[N]` 키: 같은 낱말+문맥 두 번 → 호출 1 · "a b"+"c" ≠ "a"+"b c" · 묶음 20 → 호출 1, `i` 어긋남·빈 번역은 그 항목만 | ✔ | term R1·R2·R3 |
| `[N]` translateTerms 같은 상태 기계: 429 → exhausted·재시도 0, 5xx → 1회 후 cooldown, no-key·capped(·offline) → blocked, `byKind.term`·상한 포함 · translate() 본문 바이트 불변(기존 pipeline 시험 무변 통과) | ✔ | term M1·M2·M3·B1, 기존 1,549 시험 |
| `[N]` 요청 본문에 사용자 메모·고친 번역 0 · domain 따라 "medical term"/"usual word" | ✔ | term P3·P2 |
| `[N]` CSV: BOM·CRLF·쉼표·따옴표·줄바꿈·아랍어 왕복 · `=SUM(1)` → `'=SUM(1)` → 원래대로 · `'tis` 그대로 · Anki 머리 3줄·탭 | ✔ | vocab C1·C2·C3 |
| `[N]` importPlan: id 같고 updated 새로우면 바뀜·오래되면 그대로 · id 없음 → term+target_lang · 없으면 새 항목 · 2MB·5,000줄 초과 거절 | ✔ | vocab I1·I2·I3 |
| `[N]` 내보낸 파일에 키 문자열 0(가짜 키를 저장소에 둔 상태) | ✔ | vocab K1 |
| `[N]` (fake-idb) deleteDocument 뒤 term 남고 문장 카드 지워짐 · findTerm·중복 저장 → 한 항목 | ✔ | vocab D1·S1 |
| 지침 추가: 흉내 Gemini term 요청 — 스키마 통과·실패(잘린 JSON·빈 뜻·다른 언어)·429·offline·호출 수(6절) | ✔ | term P4·M4·M1·M3·R3 |
| crossstep ② 시각 숫자 ms · applyImport 가 sm2·dueAt·reviewedAt·introducedAt 안 덮음 | ✔ | vocab S1·S2·S4·S5 |
| crossstep ① runJob · 문자열 아닌 결과 · 번역 바이트 불변 | ✔ | term R1(값 객체)·B1·U2 |
| crossstep ③ term 키 `'w='+term` + spec 정정 줄 | ✔ | term R2, spec 4-3 정정 ① |
| 9c 병합 `max(updatedAt, reviewedAt)` 과 맞는 꼴 | ✔ | vocab S5 |
| DB 버전 3·algoVersion·번역 PROMPT_VERSION 3 무변, TERM_PROMPT_VERSION 1 | ✔ | vocab D1·term B1 |

해석 둘: "빈 뜻" = **빈 번역**(그 항목만 실패 `EMPTY`)으로 읽었다 — 짧은 뜻(gloss)이 빈 것은 실패로 보지 않는다. "다른 언어" = 대상 언어 글자 체계 검사(비라틴 대상만 — ar·fa·ur·he·ko·ja·zh, 라틴 대상끼리는 못 가름).

## 3. 요청 바이트 · 캐시 키 불변 근거

- **node 대조** (`b8f1/cmp-bytes.mjs` — HEAD 판 `git archive HEAD apps/medreader` → `b8f1/orig`): 같은 흉내 fetch·memDb·시계로 10 시나리오(번역 ar · 낭독 frag head/tail · general ko · medical ko · mixlang `src` fr/en · `<<<`/`>>>` 탈출 · 청크 3개(maxReqChars 2500) · es→fr · 5xx 재시도(본문 2개) · 기기 내 끔)를 HEAD·작업 트리에 돌림 → **요청 본문·URL·usage 행·캐시 레코드(createdAt 제외)·결과 모두 같음**(`allSame: true`). 예: 번역 ar `acbbed54070c41ed`, 낭독 frag `d047e87f6c807868`, 청크 `57be5030…/5e467e88…/53e8ac99…` 양쪽 같음.
- **캐시 키**: `keyFor` 4경우(translate·readalong 같은 키·공백/줄바꿈 정규화·extra) HEAD 와 같음. `cache.js`·`hash.js` 는 손대지 않았다.
- **시험에 고정**: term-8f B1 이 4 본문의 sha256(HEAD 로 잰 값)을 고정 + `TRANSLATE_JOB.build` ≡ `buildTranslateRequest`. 기존 pipeline·readalong·taptr·domain·mixlang 시험 무변 통과.
- **headless** (아래 5): 탭 번역 본문 1 + 낭독 동반 번역 본문 1 이 HEAD 판과 sha256·길이·항목 수 같음.
- **term 키 경계**: `keyFor('d','c','ar','term','w=a b')` ≠ `keyFor('d','b c','ar','term','w=a')`. 옛 이음 `keyFor('d','a b\nc',…)` = `keyFor('d','a\nb c',…)`(결함 재현 — R2).

## 4. 테스트

- 전체 `node --test apps/medreader/tests/*.test.mjs` **2회: 1584/1584 · 1584/1584**(실패 0, `b8f1/full1.txt`·`full2.txt`). 새 시험 35(vocab 19 + term 16).
- `dev/stamp-importmap.mjs` 다시 찍음(모듈 70개), `--check` → "그대로다"(0). `git diff --check` 0. 새 파일 줄 끝 공백 0.

## 5. 변이 (백업 `b8f1/bak/` — 읽어서 쓰기, 복원도 읽어서 쓰기 + `cmp` 0)

| # | 변이 | 빨강 | 복원 cmp |
|---|---|---|---|
| V1 | term 키를 17-7-2 의 `term + '\n' + context` 로 | term R1·R2·R4 | 0 |
| V2 | `applyImport` 가 기존 레코드를 새 레코드로 통째 덮음(sm2·dueAt…) | vocab S4 | 0 |
| V3 | 연쇄 삭제에 term 포함(`keepsOnDocDelete` → false) | vocab D1 | 0 |
| V4 | `runJob` 이 문자열만 받음(결과를 `text` 로만) | term R1·R4·M4 | 0 |
| V5 | `checkTerms` 의 `i` 짝 검사 지움(응답 순서로 짝) | term R3 | 0 |
| V6 | CSV 수식 접두 `'` 지움 | vocab C2 | 0 |
| V7 | 단어 job 을 번역 기본(build·schema)으로 되돌림 | term R1·R3·R4·R5·M4·U2 | 0 |

## 6. headless (한 번)

`b8f1/run-h.mjs` — Edge 412×915 · 새 프로필 `b8f1/p1` · pipe · 가짜 키 · 흉내 Gemini(OPTIONS 204 + CORS) · 흉내 음성. 한 브라우저에 컨텍스트 둘(HEAD 판을 가로채 내줌 144 파일 / 작업 트리), 같은 동작: 서재 → PDF 가져오기 → 40쪽 → 멈춘 상태 줄 탭(40:5) → [×] → [▶] 8초 → 멈춤. 34.6초.

| | HEAD | 작업 트리 |
|---|---|---|
| 부팅·콘솔 오류·페이지 오류·4xx | ok · 0 · 0 · 0 | ok · 0 · 0 · 0 |
| 탭 번역 | 요청 1 · 띠 tap=on · ready · 번역 보임 | 같음 |
| 낭독 동반 번역 | 요청 1 · 띠 번역 보임 | 같음 |
| 본문 | `f78368153ff7f538`(2981) · `cb9dbda32d673545`(9486), 항목 6·57 | **같음**(`sameBodies`·`sameItems` true) |
| usage | calls 2 · translate 1 · readalong 1 · chars 5999 | 같음 |

term 경로는 화면이 없어 node 시험으로(지침대로). 외부 요청은 pdf.js CDN 둘뿐(기존).

## 7. spec 정정 (17-7-6 안, Edit 로 그 자리만)

- **4-3 끝** `[정정 2026-11-16 — 8f-1 Build]` ① term 키 `keyFor(docId, context, target, 'term', 'w='+term)` 확정(17-7-2 '\n' 결함) ② `runJob(job, items, keys, opts)` 모양·`{text}`/`{value}` 결과·바이트 불변 근거 ③ 한 번 부름 = 최대 1호출(`MORE`)·항목별 same-lang/empty·`force` 는 실패 기억도 지움 ④ `checkTerms(…, target)` 다른 언어 검사·EMPTY/LONG·스키마 필수는 i·translation 만·pos enum 안 씀·캐시 값 `{translation, gloss, pos, lemma}` ⑤ 요청 term 은 `surface` 우선 ⑥ `findInSentenceTr` 멈춤에 `? ! ؟`·글자 체계 바뀜 추가, 반환 `at`·`paren`.
- **4-4 끝** ① id = `'vt:'+hashHex(target+U+0001+term)`(9-2 "uuid" 대신) ② 시각 숫자 ms · `reviewedAt`·`introducedAt` null 로 처음부터 · 복습 필드 안 덮음(17-11 의 "+3줄" 불필요) ③ save 한 트랜잭션 ④ changedSince ms·ISO ⑤ `db.keepsOnDocDelete` 한 곳(12-1 이 sentence 더함) ⑥ 내용/복습 필드 목록 export.
- **4-6 끝** importPlan·CSV 를 8f-1 이 만듦 ① **같은 시각 + 내용 다름 → 바뀜**(엑셀에서 칸만 고친 CSV 가 8f-3 수용 "바뀜 1"이 되려면 "updated 더 새로운 쪽"만으로는 안 됨) ② 다른 기기 id → term 으로 맞춤, 새 항목은 파일 id 유지 ③ 없는 열은 안 바꿈·거절 사유 ④ patch 모양 ⑤ 머리 줄·UTF-8 바이트·접두 규칙 `^'*[…]`/`^'+[…]` ⑥ Anki Back/Source ⑦ `docs` 로 docId 잇기.

## 8. 남은 문제 · 다음 단계에 넘길 것

1. `findInSentenceTr` 후보는 "뒤에서 최대 4낱말"이라 용어 앞 낱말(아랍어 «من», 한국어 «환자는»)이 섞인다(설계대로 "후보 — 확인하세요"). 낱말 수를 원어 낱말 수에 맞춰 줄이는 것은 8f-2 실기기에서 Nour 반응을 보고(다듬기 후보).
2. 단어 지시문의 설계 밖 문장(“copy `i` and `term`…”, “`translation` = … TERM only”, lemma·pos 정의) — `[문안 검토 — 운영자]`. 실키 품질은 마지막 실기기 점검 묶음.
3. 스키마 필수를 `i`·`translation` 로 좁혔다 — 실제 Gemini 가 gloss·pos 를 빠뜨리는 빈도는 실키로만(`[M]`).
4. 8a 의 "429 를 모두 exhausted 로 읽음"(crossstep 8c-1 줄)은 단어 요청에도 그대로 — 같은 상태 기계라 고칠 때 한 곳.
5. `vocab/store.js` 는 아직 앱 어디서도 import 하지 않는다(8f-2 가 붙임) — import map 에는 들어 있음(해 없음).
6. 문서를 지우면 그 문서의 `aiCache` term 캐시는 함께 지워진다(캐시라 정상 — 단어장 항목은 남음). 문서 없는 항목의 [이 문맥으로 다시 번역]은 `docId` 빈 키로 간다.
7. 12-1: `keepsOnDocDelete` 에 `sentence` 한 줄. 9c: `TERM_CONTENT_FIELDS`·`TERM_REVIEW_FIELDS`·`importPlan` 재사용.

## 9. 막힌 명령 · 규칙

- 막힌 명령 없음. 진짜 키·외부 호출 없음(흉내 Gemini 만). C: 남은 공간 107G.
- **규칙 어김 2건(자진 보고)**: "한 호출에 한 가지 일" — ① `prompts.js` 작은 치환을 `cd … && node -e …` 로 묶어 돌렸다(결과는 정상, 그 뒤 Edit 로 확인) ② 테스트 출력을 `2>&1 | tail -15` 로 파이프했다(읽기만). 그 뒤로는 하나씩만 했다.
- 커밋·checkout/restore/stash·npm·다운로드·프로필 복사·포트 찌르기·프로세스 조회 없음. 8000 python 은 읽기만, 8123–8125 무관.
