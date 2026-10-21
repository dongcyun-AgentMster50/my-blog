# Build 보고 — 8p 번역 문체: 문서 속성 `domain` (F6 · L-D4 · L-D9 (가))

2026-10-21 · 기준 커밋 `baa358c` · **커밋하지 않았다** · 스크래치 `b8p/`

## 0. 먼저 — spec 10-1 정정 (8m Review L3)
- 10-1 끝 줄을 "캐시 **값**(`extra` — 키 아님)과 `questions.promptVersion`에 기록" 으로 바꾸고 `[정정 2026-10-21 — 8m Review L3]` 를 달았다. 키는 `kind|target|docId|hash(text)`(`ai/cache.js` `keyFor`), 판을 키에 넣으면 판을 올릴 때마다 캐시가 전부 무효가 된다는 이유까지 적었다. 판을 올리기 전에 고쳤다.

## 1. 바꾼 것
| 파일 | 내용 |
|---|---|
| `js/ai/prompts.js` | `PROMPT_VERSION` 2 → **3**(값에만 기록). `DOMAINS`·`DEFAULT_DOMAIN`·`normalizeDomain`(`'general'` 만 일반, 없음·빈 값·모르는 값은 `medical`)·`domainOf(rec)`. `TARGET_STYLE_GENERAL = {ar:'Modern Standard Arabic (الفصحى).', ko:'natural, standard Korean.'}`, `GENERAL_STYLE_LINE`. `commonSystem(withNotes, domain)` — general 이면 ROLE 한 줄만 다름. `translateInstruction(src, target, domain)`·`buildTranslateRequest(…, {src, target, domain})`. 아랍어 문체 머리는 `AR_MSA` 한 조각을 두 표가 같이 쓴다(7b J3 "지시문 한 곳" 테스트 그대로 통과 · 의학 문자열 불변). `TEST_PROMPT` 그대로 |
| `js/ai/pipeline.js` | `opts.domain` → `ctx.domain`(정규화) → `chunksOf`·`sendChunk` 의 `buildTranslateRequest` 에만. `keyFor` 호출 그대로 |
| `js/ai/readalong.js` | `setDoc({…, domain})` — `domain` 만 바뀌면 메모리를 비우지 않는다. `send` 가 보내는 순간의 `doc.domain` 을 `pipeline.translate` 에 넘긴다 |
| `js/ui/reader.js` | `docDomain()`(= `domainOf(state.doc)`) · `medreader:docdomain` 을 듣고 레코드 값만 고침(큐·화면 그대로) |
| `js/ui/controls.js` | `syncReadalong` 의 `readalong.setDoc` 에 `domain: docDomain()` 한 줄(재생·쪽 그리기마다) |
| `js/ui/library.js` | [⋯] 패널: 원문 언어 단추 아래·[텍스트 다시 추출] 위에 "번역 문체" 제목(h3) + `role=group` 단추 둘(`aria-pressed`). `DOMAIN_FIELDS = ['domain']`·`setDocDomain`(`db.patch`, 같은 값·모르는 값은 안 씀) · `medreader:docdomain` 알림. 새 문서는 `domain` 을 쓰지 않음(자동 추정 없음) |
| `js/i18n/{ko,en,ar,fr}.js` | `library.domain.title/medical/general` (ar·fr `[검토 — Nour·운영자]`) |
| `css/screens.css` | `.doc-domain` 위 여백 한 줄 |
| `index.html` | stamp 다시(`--check` 0) |
| `tests/domain-8p.test.mjs`(새, 9) · `mixlang-8m`(판 기대 `>= 2`) · `pipeline-8a`(값 판 3) | |
| `spec.md` | 10-1 정정 · 19-1-3 §7 끝에 `[정정 2026-10-21 — 8p Build]` 한 줄 |

`db.js` 는 고치지 않았다 — `domain` 은 파생 필드가 아니라 `resetDerived` 가 남기고, 9c 백업은 레코드 통째라 저절로 들어간다. DB 판(3)·algoVersion·캐시 키·`SEARCH`/`SCAN` 판 불변.

**탭 번역 경로**: `pipeline.translate` 를 부르는 곳은 앱 전체에서 `readalong` 하나다(줄 탭은 낭독 이동이지 번역 호출이 아니다 — grep). 그래서 "탭 번역 호출부" = 리더 → controls → readalong 한 길이다.

## 2. 지시문 차이 (지시문 원문은 영어 지시라 인용함)
- medical·없음·모르는 값: `translateInstruction`·`commonSystem(true/false)`·`buildTranslateRequest` 가 `baa358c` 출력과 **글자 단위로 같다**(en>ar·en>ko·fr>ko·en>fr × 값 9종 — P8-1).
- general: system 은 첫 줄만 `…inside a book reader used for EDUCATION ONLY.`(안전 규칙 1–6 그대로), user 는 작업 지시 한 줄만 — "Medical terminology: …(e.g. …)." 대신 `Translate naturally and faithfully; keep proper nouns as written; do not add explanations.` + `Write the translation in {일반 문체}`(표에 없는 대상은 없음). 스키마·DOC·`maxOutputTokens`·`temperature` 같음. 8m `SRC_LINE` 은 그대로 붙는다.

## 3. 캐시·요청 실측 (8m Review 방식 — 실제 readalong + 실제 pipeline + fetch 흉내, HEAD = `git archive baa358c`)
의학책 3권 × 대상 ar·ko (`b8p/cmp.mjs` → `books.jsonl`):

| 책 | 대상 | 쪽 | 요청 HEAD/현재/medical/general | 본문 HEAD=현재=medical | 키 수 · HEAD=현재=medical=general | 판 값 | general 차이 줄 | HEAD 캐시로 재요청(없음/general) |
|---|---|---|---|---|---|---|---|---|
| CMDT 2026 | ar | 15 | 13/13/13/13 | 같음(113,849B) | 658 · 같음 | 2 → 3 | sys[0]·user[0] | **0 / 0** |
| CMDT 2026 | ko | 15 | 13 ×4 | 같음 | 658 · 같음 | 2 → 3 | sys[0]·user[0] | 0 / 0 |
| CMDT 2021 | ar | 17 | 6 ×4 | 같음(48,355B) | 239 · 같음 | 2 → 3 | sys[0]·user[0] | 0 / 0 |
| CMDT 2021 | ko | 17 | 6 ×4 | 같음 | 239 · 같음 | 2 → 3 | sys[0]·user[0] | 0 / 0 |
| Harrison | ar | 17 | 12 ×4 | 같음(109,014B) | 767 · 같음 | 2 → 3 | sys[0]·user[0] | 0 / 0 |
| Harrison | ko | 17 | 12 ×4 | 같음 | 767 · 같음 | 2 → 3 | sys[0]·user[0] | 0 / 0 |

→ **medical(없음)에서 요청 바이트 동일 · 캐시 키 동일 · HEAD 가 채운 캐시(판 2)로 재요청 0**, domain 을 general 로 바꿔 읽어도 재요청 0(키 불변). general 의 Medical terminology 줄 0.

해커스 견본 3개(문서 ko) × 대상 ar·en (`hk.jsonl`): 6건 모두 HEAD=현재=medical 본문 같음·키 같음. general 차이는 4건이 sys[0]·user[0] 한 곳뿐. 나머지 2건(bulls eye ko→ar, Part7 ko→en)은 **청크 경계가 1–2항목 옮겨** 줄이 밀린 것 — readalong 이 보낸 묶음(10h·84·77·81·70)은 medical·general 같고, `pipeline.chunksOf` 의 토큰 상한(`exceedsRequestBudget`)이 지시문이 짧은 general 에서 한두 항목을 더 담았다(요청 수·키 같음). Part7 ko→ar 의 HEAD 캐시 재요청 2는 **HEAD 판끼리도 2**(흉내 응답이 검증에 걸려 캐시되지 않은 항목) — 8p 무관.

## 4. 테스트·변이
- 새 `tests/domain-8p.test.mjs` 9개: P8-1 옛 문자열 동일 · P8-2 general 한 곳 차이 · P8-3 값 해석·판 3 · P8-4 캐시 키 무관(medical 로 받은 것을 general 이 재요청 0, 새 문장만 general 지시문, 다시 medical 이면 fetch 0) · P8-4b 본문 바이트·`keyFor` 모양·소스 grep · P8-5 readalong 이 domain 을 넘김 · P8-6 중간 변경(떠 있는 요청 그대로·재전송 0·받은 번역 유지·다음 요청부터 general) · P8-7 `setDocDomain` P1 경합(fake-idb 지연, 남의 필드 보존)·같은 값/모르는 값 안 씀·DB 판 3 · P8-8 화면 자리·문구 ×4·새 문서 domain 없음·리더 배선.
- 변이 6 → 모두 빨강 → 복원(읽어서 쓰기 + `cmp` same, 백업 `b8p/bak/mut/`): M1 medical 에서도 general 문장(P8-1·2) · M2 domain 을 캐시 키에(P8-4·4b) · M3 readalong 이 넘기지 않음(P8-5·6) · M4 바꾸면 메모리 비움(P8-6) · M5 같은 값도 씀(P8-7) · M6 general 이 안전 규칙도 바꿈(P8-2).
- 전체 `node --test apps/medreader/tests/*.test.mjs`: **1347/1347 × 2회**(t3·t4, 1338 + 9). 그 전 한 번(t2)은 P8-6 이 고정 횟수 flush 로 흔들려 1 실패 → 조건 대기(`until`)로 고친 뒤 단독 5회·전체 2회 초록, 변이 다시 6/6 빨강.
- stamp 다시, `--check` 0.

## 5. headless Edge (412×915 · 새 프로필 `b8p/p1` · 포트 9358 · 가짜 키 · 흉내 번역 응답 · 8000번 python)
`b8p/hl.json`, 스크린샷 `b8p/shots/`. 콘솔 오류 0, 가로 넘침 0(412/412).
- [⋯] 자리(ko): 순서 원문 언어 → **번역 문체** → 다시 추출, 단추 48px 둘, 필드 없는 문서는 "의학" 눌림, `aria-labelledby` 이어짐. ar: 제목 أسلوب الترجمة, 패널 rtl(단추 순서 뒤집힘), fr·en 문구 정상.
- CMDT 2026 40쪽(필드 없음): 요청 2건 모두 의학 ROLE·Medical terminology, 띠 `ar · rtl · ready`, 원문 en-US·번역 ar-SA.
- [⋯] 에서 일반 → DB `domain:'general'`, 눌림 갱신. 같은 쪽 다시 낭독: **이미 받은 문장 재요청 0**(첫 번역 3개까지 요청 0 — 캐시 적중), 뒤로 읽어 나간 새 요청 2건(102항목)은 모두 일반 ROLE·`Translate naturally…`·Medical terminology 0.
- 회귀: 해커스 DM plus B2(일반으로 바꿈) 2쪽 — 8m 전환 어긋남 0·`src` 항목 11·SRC 줄 있음·요청 일반 문체, 8o 빈칸 낱말(en 2·ko 13)·꼴 그대로 발화 0, 언어 분포 8o 때와 같음(ko-KR 43·en-US 11·ar-SA 2). 8i-3 쪽 넘김 60→61 en-US 정상.

## 6. 남은 프로세스
- 띄운 Edge(b8p 프로필) 0, 포트 9358 닫힘, 측정·테스트 node 모두 끝남(`timeout` 상한). 8000번 python(PID 30352) 그대로, 8123·8124 손대지 않음(8125 는 이번에 LISTEN 이 보이지 않았다 — 내가 건드리지 않았다). G:·D:/OCR 읽기만.

## 7. 남은 문제
1. **캐시 값에 `domain` 을 기록하지 않았다**(§7 표 "값에 domain 을 기록(진단)") — `ai/cache.js` `putMany` 가 필드를 골라 적고, 수정 범위 밖이다. 하려면 cache.js 레코드에 `domain` 한 줄 + pipeline 의 두 `entries` 에 `domain: ctx.domain`(키 무관).
2. general 의 짧은 지시문이 토큰 상한 판정에서 청크 경계를 1–2항목 옮길 수 있다(위 실측). 요청 수는 늘지 않았고 키도 같다 — 기록만.
3. 문안(`GENERAL_STYLE_LINE`·`TARGET_STYLE_GENERAL`·ROLE)은 `[문안 검토 — 운영자]`, ar·fr 화면 문구는 `[검토 — Nour·운영자]`. `[M]` 운영자 실키 비교(영어 교재 한 쪽 일반·의학)는 하지 않았다(진짜 키 금지).
4. 열린 리더에서 서재로 가면 낭독이 멈추는 구조라, 문체 변경은 다음 ▶/쪽 그리기에서 `setDoc` 으로 들어간다. 리더가 떠 있는 채 다른 길로 `domain` 이 바뀌는 경로는 지금 없다.

스크래치 `b8p/`: `cmp.mjs`(+진단 `cmp2/3.mjs`)·`books.jsonl`·`hk.jsonl`·`old-strings.mjs`·`mutate.py`·`mutate*.log`·`hl.mjs`·`hl.json`·`shots/`·`t0–t4.log`·`head/`(git archive)·`bak/orig`·`bak/mut`. hl.json 에는 원문 조각이 없다(요청 문장은 스크립트 안에서만 비교). `head/` 는 레포 사본이라 레포에 넣지 말 것.
