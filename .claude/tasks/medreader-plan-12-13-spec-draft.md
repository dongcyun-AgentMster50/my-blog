# 초안 — spec 에 붙여 넣을 것 (12 핵심 기억(SRS) · 13 마감 전 검토 Plan, 2026-11-16)

> 이 파일은 **초안**이다. spec.md 는 고치지 않았다. 붙일 자리:
> (A) 17-8 끝(17-8-12 11 뒤) 다음에 새 소절 **"17-9"**(12) · **"17-10"**(13) 전체.
> (B) 19-1 표 **12** 행 끝, **13** 행 끝에 `[수정 …]` 한 줄씩.
> (C) 3-2 import 방향 표 아래 규칙에 `srs/*`·`plan/*` 한 줄.
> (D) 9-2 `cards` 행 · `[신설 2026-10-12]` 단어장 문단 끝 · `progress` 행에 한 줄씩. (E) 9-3 설정 키 4개. (F) 12-1 라우트 표 한 줄. (G) 17절 표 #14·#16·#20 행 끝에 정정 한 줄씩.
> 17 #14·#16·#20 · 16절 · 15절 · 17-7 본문은 고치지 않는다 — 이 두 소절이 그 위에 덮이는 정본이다(8cf·11 초안과 같은 방침).

---

## (B) 19-1 표 행 끝에 붙일 한 줄

**12 행** — `[수정 2026-11-16 — 12·13 Plan]` 설계·나누기·수용 기준은 **17-9** 가 정본이다. 세 Build — **12-1 SM-2·카드 서비스(화면 없음) → 12-2 기억 단추(띠 [☆] · 선택 줄 [⋯] [기억 카드] · 음성 "기억") → 12-3 복습 화면 `#/cards` · 카드 목록 · 서재 "오늘" 줄.** 문장 카드는 `cards` `kind:'sentence'`, id 는 문장에서 정해지는 값(중복 0), 번역문·설명을 **복사**하고 번역이 없으면 앞면만 저장해 복습 때 캐시에서 채운다(호출 0). 단어장 `kind:'term'` 과 **한 복습 줄**에 섞는다(거르기 칩). 문장 카드도 **문서를 지워도 남는다**(9-2 바꿈 — 12-D8). 복습은 `reviewedAt`·`sm2`·`dueAt` 만 쓰고 `updatedAt` 은 건드리지 않는다(8f "바뀐 항목"·9c 병합). DB 버전 3 그대로. 호출 0. 자리는 **11-4 뒤**(`trband.js`·`selbar.js`·`voice/commands.js`·`ui/voice.js`·`controls.js`·`library.js`·i18n 이 겹친다). Build 합 약 6.5–7.5시간 + Review 약 3.5–4시간(옛 추정 4시간은 화면 둘·입구 셋·병합 규칙을 작게 셌다).

**13 행** — `[수정 2026-11-16 — 12·13 Plan]` 설계·나누기·수용 기준은 **17-10** 이 정본이다. 두 Build — **13-1 낭독 기록·읽은 쪽·계획 계산(화면 없음) → 13-2 계획 화면 `#/planner` · 서재 "오늘" 줄 넓힘.** 낭독 속도는 **이 기기의 실측**(낭독 중인 시간 대비 원문 글자 — 모드별·최근 14일), 실측이 30분 미만이면 모드별 기본 추정 `[가정]`. 1만 자당 호출은 **내 사용량**(15절 `byKind.readalong`·`charsTranslated`, 최근 30일 3만 자 이상) — 없으면 1.7(7-8-3 실측). 읽은 쪽 = 그 쪽을 끝까지 낭독한 쪽 + 손으로 고친 쪽(`progress` `sectionId:'@read'`). 점수는 약속하지 않는다. 순수 계산·호출 0·DB 버전 3 그대로. 자리는 **12 뒤**. Build 합 약 4.5–5.5시간 + Review 약 2.5–3시간(옛 추정 2시간은 측정 기록·읽은 쪽 저장을 셈에 넣지 않았다).

---

## (A) 새 소절 둘

### 17-9. 핵심 기억(SRS) — 12 Build 설계 `[신설 2026-11-16 — 12·13 Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 12-D1–D18 · 물을 것 12-Q1–Q2 따로]`

**방침**: 17 #16(카드 원천 = 번역·설명된 문장, 번역문 복사, 호출 0)과 17-7-3(단어장 = `cards` `kind:'term'`, 12 가 이어받음)은 그대로다. 그 뒤 들어온 단계(8c-1 띠 탭 모드·선택 동작 줄, 8d 문장 아래, 8f 단어장, 9b 음성 명령, 9c 백업, 11 요약·설명)에 맞춘 것과 Build 지시는 이 소절이 정본이다. **새 호출은 0** — 카드 만들기·복습·뒷면 채우기 모두 메모리·캐시만 읽는다. 실기기에서만 답이 나오는 것은 끝의 "마지막 실기기 점검 묶음"으로 모은다.

#### 1. 지금 코드 사실 (파일:행 — 2026-11-16 작업 트리, 9b 배포 `4c57246` 뒤 · 8e Build 진행 중 · 8c+8f·18·9c·10·11 은 Plan 초안만)

| 항목 | 지금 | 근거 |
|---|---|---|
| `cards` 스토어 | 키 `id`, 인덱스 `docId`·`dueAt`·`term`(**`kind` 인덱스 없음**). **쓰는 코드 0건** | `js/db.js:70-75` |
| 연쇄 삭제 | `CASCADE_STORES` 에 `cards`·`progress`·`annotations` — 문서를 지우면 `docId` 인덱스로 전부 지운다. 8f-1 이 `kind:'term'` 을, 11-1 이 `annotations` `summary`·`outline` 을 빼기로 했다(초안) | `js/db.js:451-454·538-575` · 8cf 초안 4-4 · 11 초안 4-4 |
| DB 버전 | **3**. 이번 설계는 올리지 않는다 | `js/db.js:24` |
| `db.patch` | 레코드가 **없으면 쓰지 않는다**(없을 수 있는 레코드는 `withTx` 로 읽고 합쳐 쓴다 — `readalong` 의 `defaultSaveReadStats` 꼴) | `js/db.js:341-364` · `js/ai/readalong.js:679-701` |
| 9-2 `cards` 행 | `term, definition{en, ar}, context, pageNo, sm2{ease:2.5, interval:0, reps:0, lapses:0}, dueAt, createdAt, suspended` — 초판. 8f 가 term 항목 필드를 다시 정했다(`translation`·`targetLang`…, `dueAt = createdAt`) — **`dueAt` 의 형(숫자 ms / ISO)은 아직 아무 데도 정해지지 않았다** | spec 9-2 · 8cf 초안 4-4 |
| SRS 코드 | `js/srs/` 폴더 **없음**. `sm2`·복습·카드 화면 0건. 라우트 `#/cards` 는 12-1 표에만(P2) | `js/router.js:13-15` · spec 12-1 |
| 지금 문장·번역 | `speaker.getCurrent()` = 지금 단위(`src`·`seg`·`lineIds`·`lang`). 번역은 `readalong.get(src)` 메모리 → 없으면 `readalong.cachedFor([unit])`(캐시 읽기만, 호출 0) | `js/tts/speaker.js:1209` · `js/ai/readalong.js:540-589·650-673` |
| 띠 | 낭독 문장만 그린다. 8c-1 이 탭 모드(`openTap`·[×]·[문단 전체]), 11-4 가 설명 모드(`openNote`·[▶ 다시 듣기])를 더한다(초안). 단추는 띠 하나의 위임 리스너(`data-tr-action`) | `js/ui/trband.js:1-60·209` · `index.html:468-476` |
| 문장 아래(8d) | `<html data-tr-inline="on">` 이면 띠를 감춘다 — 그 동안 띠 단추는 보이지 않는다 | `js/ui/inlinetr.js` · `css/reader.css` |
| 선택 동작 줄 | 아직 없다. 8c-1 이 만들고 11-2 가 `[⋯]` 넘침 메뉴(요약·여기서부터 읽기·검색 바로가기)를 둔다(초안) | 8cf 초안 4-2 · 11 초안 11-D3 |
| 음성 명령 | 표 `RAW` 9개 + `explain`(`enabled:false`). 표 무결성 시험(공유 꼴 0 — C3). 실행은 주입 함수만, 성공·실패 한 마디 `say(key, was)` → `restore(was)`(꺼짐 스위치 `voice.sayErrors`) | `js/voice/commands.js:125-175` · `js/ui/voice.js:186-232·300-330` |
| 해시 | `hashHex`(비동기 — SHA-256 또는 FNV) · `normalizeForHash`(NFKC·공백 접기) | `js/hash.js:87·107` |
| 서재 상단 | 제목 + `[설정][정보][🔍]` — 8f-3 이 `[단어장]` 을 더한다(412 에서 빠듯 — 8cf-D8 · 18-D2) | `index.html:301-309` |
| 9c 병합(초안) | `cards` — term 은 8f `importPlan`, 문장 카드는 id 로 **`updatedAt` 새로운 쪽**. `settings` 는 허용 목록 키만 | 18·9c·10 초안 17-4-1 2·3 |
| 8f 단어장(초안) | "마지막 내보내기 뒤 바뀐 항목 n개" = `updatedAt` 비교. CSV 가져오기 `applyImport` — 기존 항목을 바꿀 때 **필드만 바꾸는지 통째로 쓰는지는 초안에 없다** | 8cf 초안 4-4·4-6 |

#### 2. 17 #16 · 17-7-3 이후 바뀐 것 — 맞춘 결과

1. **8f 단어장이 먼저 `cards` 를 쓴다** — 12 는 그 위에 `kind:'sentence'` 를 더하고, 복습 상태(`sm2`·`dueAt`·`reviewedAt`)만 두 kind 에 같은 규칙으로 쓴다. 단어 항목의 내용(번역·뜻·메모)은 단어장 화면이 고친다(12-D17).
2. **`updatedAt` 은 내용 수정만** — 복습이 `updatedAt` 을 올리면 8f 의 "바뀐 항목 n개"가 복습할 때마다 늘고(내보내기 알림이 쓸모없어짐) 9c 가 내용 대신 복습 시각으로 이긴 쪽을 고른다. 그래서 복습은 **`reviewedAt`** 을 따로 쓴다(12-D9). 9c 병합은 `max(updatedAt, reviewedAt)` 으로 한 줄 바꾼다(12-1 범위 — 9c 가 먼저 Build 된다).
3. **8c-1 띠 탭 모드 · 11-4 설명 모드** — `[☆ 기억]` 은 띠의 세 모드(낭독·탭·설명)에 **같은 단추 하나**로 붙는다. 설명 모드에서 누르면 설명 글도 카드에 복사한다(17 #16 "설명된 문장").
4. **8d 문장 아래** — 그 동안 띠가 숨으므로 `[☆]` 이 없다. 문장 아래 블록(`.ra-tr`)에는 단추를 넣지 않는다(본문 위치를 흔들지 않는다 — 11-D22 와 같은 까닭). 그래서 **선택 동작 줄 `[⋯]` → `[기억 카드]`** 와 **음성 "기억"** 을 둔다(12-D5).
5. **8m 단위 언어** — 카드의 원문 언어 = `Unit.lang || doc.lang`(`srcLang`). 앞면 [▶] 은 그 언어 음성.
6. **9b** — 명령 `remember` 하나를 더한다(로컬 매칭, AI 해석 없음). 11-2 의 `summarize` 처럼 표 무결성 시험을 지난다.
7. **9c** — `cards` 는 이미 "학습 기록"으로 늘 담긴다. 새 설정 키(`srs.*`)를 허용 목록에 더한다.
8. **무료 한도 원칙(17절 머리)** — 카드 만들기·복습·뒷면 채우기 전부 **호출 0**. 뒷면이 없을 때 복습 화면에서 번역을 부르는 단추는 두지 않는다(12-Q1).

#### 3. SM-2 — 순수 `js/srs/sm2.js` (12-1)

`Date` 를 읽지 않는다 — 시각은 인자로 받는다(3-2 순수 규칙). 상태 `sm2 = {ease, interval(일), reps, lapses}`, 기본 `{2.5, 0, 0, 0}`.

```
next(sm2, grade, {nowMs, dayStartMs}) → {sm2, dueAt}
  grade ∈ 'again' | 'hard' | 'good' | 'easy'             # 화면 단추 넷 — Anki 식 4단추 SM-2 변형(12-D4)
  again: reps←0, lapses+1, ease←max(1.3, ease−0.20), interval←0, dueAt ← nowMs + SRS.AGAIN_MS(10분)
  hard : ease←max(1.3, ease−0.15); interval ← reps==0 ? 1 : max(interval+1, round(interval×1.2)); reps+1
  good : interval ← reps==0 ? 1 : reps==1 ? 6 : max(interval+1, round(interval×ease)); reps+1
  easy : ease←ease+0.15; interval ← reps==0 ? 4 : max(interval+1, round(interval×ease×1.3)); reps+1
  interval ← min(interval, SRS.MAX_INTERVAL_DAYS(365))
  interval > 0 이면 dueAt ← dayStartMs + interval × DAY_MS          # 그날 0시 — "그날 복습할 것"
isDue(card, dayEndMs)   = !card.suspended && dueMs(card) < dayEndMs
isNew(card)             = !card.reviewedAt && (card.sm2?.reps|0) === 0
dueMs(card)             = 숫자면 그대로, 문자열이면 Date.parse 결과를 호출자가 넘김 → 순수 쪽은 숫자만 받는다(12-D10)
previewLabels(sm2, ctx) = 네 단추 아래 "10분 · 1일 · 3일 · 1개월" — next() 를 네 번 돌린 결과
```

**시험 표**(`tests/sm2-12.test.mjs` — ease 소수 둘째 자리):

| # | 입력 `{ease, interval, reps}` | 단추 | 기대 `{interval, reps, ease}` · dueAt |
|---|---|---|---|
| S1 | 새 `{2.5,0,0}` | good | `{1, 1, 2.5}` · 내일 0시 |
| S2 | `{2.5,1,1}` | good | `{6, 2, 2.5}` |
| S3 | `{2.5,6,2}` | good | `{15, 3, 2.5}` |
| S4 | `{2.5,6,2}` | hard | `{7, 3, 2.35}` |
| S5 | `{2.5,6,2}` | easy | `{21, 3, 2.65}`(6 × 2.65 × 1.3 = 20.67 → 21 — 아래 주) |
| S6 | `{2.5,15,3}` | again | `{0, 0, 2.3}` lapses+1 · now+10분 |
| S7 | `{1.3,15,3}` | again | ease 1.3 그대로(바닥) |
| S8 | `{2.5,300,6}` | good | `{365, 7}`(상한) |
| S9 | 새 | easy | `{4, 1, 2.65}` |
| S10 | 새 | hard | `{1, 1, 2.35}` |

주: ease 를 바꾸는 단추(easy)는 **바꾼 뒤** 값으로 곱한다 — S5 = `round(6 × 2.65 × 1.3) = 21`. hard 는 ease 를 곱하지 않는다(×1.2). 표 값과 위 규칙이 어긋나면 규칙이 이긴다 — Build 가 규칙으로 다시 계산해 시험에 고정한다.

#### 4. 카드 — 서비스 `js/srs/cards.js` (12-1)

- **문장 카드 레코드**(`kind:'sentence'`): `{id, kind:'sentence', front(= Unit.src 사본), back(번역문 사본 — 없으면 ''), explain(설명 사본 — 11-4 설명 띠에서 저장했을 때만), srcLang, targetLang, docId, docTitle(사본), pageNo, lineId, paraId, origin('band'|'tap'|'explain'|'select'|'voice'), domain, note(''), createdAt(ms), updatedAt(ms), reviewedAt(null), introducedAt(null), sm2{2.5,0,0,0}, dueAt(= createdAt), suspended(false)}`. `term` 필드는 두지 않는다(인덱스 `term` 에 섞이지 않게).
- **id = `'sc:' + hashHex(targetLang + '\u0001' + docId + '\u0001' + normalizeForHash(front))`**(12-D7) — 같은 책·같은 문장·같은 대상 언어면 같은 id → 중복 0(두 번 누르면 "이미 있음"), 9c 로 두 기기를 합쳐도 같은 카드. `'\u0001'` 은 `normalizeForHash` 가 공백으로 접지 않는다(8cf 1 표의 `'\n'` 결함과 다르다 — 시험으로 고정).
- **시각은 숫자 ms**(12-D10). 8f-1 term 항목의 `createdAt`·`dueAt` 이 ISO 문자열이면 읽을 때 `Date.parse` 로 받는다(`dueMsOf(card)`) — **8f-1 Build 에 "숫자 ms 로 쓴다" 한 줄을 넘긴다**(아래 11).
- 공개:
  - `saveSentence(input)` → `{card, created}`: `input = {front, back?, explain?, srcLang, targetLang, docId, docTitle, pageNo, lineId, paraId, origin, domain}`. 있으면 새로 만들지 않고, 기존 카드의 `back` 이 비었고 입력에 `back` 이 있으면 **채운다**(`updatedAt` 올림 — 내용 수정). `explain` 도 같다.
  - `removeIfFresh(id)` — `reviewedAt` 이 없을 때만 지운다(띠 [★] 를 다시 눌러 되돌리기 — 12-D5). 복습한 카드는 목록에서만 지운다.
  - `get(id)` · `remove(id)` · `update(id, patch)`(사용자 수정 — `back`·`note`·`suspended`, `updatedAt` 올림).
  - `list({kind?, docId?})` — **전체 훑기**(cursor) 후 거름(12-D10 · 8cf-D14 와 같은 까닭 — `kind` 인덱스가 없고, 수천 장이면 데스크톱 < 50ms `[추정]`).
  - `queue({nowMs, dayStartMs, dayEndMs, newPerDay, kinds, docId})` → `{due:[…], fresh:[…], counts:{due, fresh, noBack, noTr}}`: 복습할 것(`!isNew && isDue`, `dueAt` 오름차순) + 새 카드(`isNew`, `createdAt` 오름차순, `newPerDay − log[오늘].new` 장까지). 빼는 것: `suspended` · **번역 빈 term**(`translation` 빈 값 — `counts.noTr`, 12-D15). 뒷면 빈 문장 카드는 넣고 `counts.noBack` 에 센다(복습 때 채움).
  - `review(id, grade, {nowMs, dayStartMs, ms})` — **한 트랜잭션**에서 읽고 `sm2`·`dueAt`·`reviewedAt`·(처음이면)`introducedAt` 만 바꿔 쓴다(`updatedAt` 무변 — 12-D9). 하루 기록 `settings['srs.log'][오늘]` 에 `{n+1, ms+…, new+(처음이면 1)}`(60일만 남김).
  - `fillBack(card, lookup)` — 뒷면이 비었으면 `lookup(front, docId, targetLang)`(화면이 주입 — 메모리 → `readalong.cachedFor` → 없으면 `aiCache` `translate` 키 읽기)로 찾아 채우고 저장. **호출 0**. 못 찾으면 그대로.
  - `keptCount(docId)` — 문서 삭제 확인 문구용(아래).
- **import**: `config`·`db`·`hash`·`srs/sm2` 만(`ui/`·`ai/`·`tts/` 금지 — 번역 조회는 주입). `vocab/*`·`notes/*` 행과 같다.
- **문서를 지워도 남는다(12-D8)**: 8f-1 이 `db.deleteDocument` 의 `cards` 쓸기에 둔 `kind === 'term'` 예외를 **`kind === 'term' || kind === 'sentence'`** 로 넓힌다(1줄). `kind` 가 없는 옛 레코드는 없다(쓰는 코드 0건 — 위 표) — 그래도 `kind` 없음은 지금처럼 지운다. 서재 삭제 확인의 "남습니다" 줄은 8f-2(단어장)·11-2(요약)와 **한 줄로 합친다**: "단어장 n · 기억 카드 m · 저장한 요약 k 는 남습니다"(0 인 것은 뺀다, `library.card.deleteKeeps`) — 셋을 세는 함수는 `library.js` 한 곳.
- **9c 병합 한 줄**(12-1 범위, 9c 의 `backup/import.js`): `cards` 문장 카드 — `max(updatedAt, reviewedAt)` 이 큰 쪽(같으면 기기 것). term 은 8f `importPlan` 그대로 두되 **기존 항목의 `sm2`·`dueAt`·`reviewedAt`·`introducedAt` 은 파일 쪽이 더 늦게 복습했을 때만 가져온다**. 허용 목록에 `srs.newPerDay`·`srs.log` 더함.
- **8f CSV 가져오기와 복습 상태(12-D18)**: CSV 에는 복습 상태가 없다. `applyImport` 가 기존 term 을 고칠 때 **내용 필드만 바꾸고 `sm2`·`dueAt`·`reviewedAt`·`introducedAt` 을 남기는지** 12-1 이 시험 하나로 확인한다 — 통째로 쓰고 있으면 그 함수에서 네 필드를 옮겨 담게 고친다(+3줄).

#### 5. 카드 만들기 — 입구 셋 (12-2)

| 입구 | 언제 보이나 | 무엇을 저장 | 호출 |
|---|---|---|---|
| **띠 `[☆ 기억]`**(낭독 모드) | 띠가 보일 때(유효 모드 `show`·`speak`, 표시 `band`) · 지금 문장이 있고 표 안내·인용이 아닐 때 | 지금 문장(`linechange` 의 `src`) + `readalong.get(src)` 가 ready 면 번역 | 0 |
| 띠 `[☆]`(탭 모드 — 8c-1) | 탭 띠가 열렸을 때 · `[문단 전체]` 보기에서는 숨김 | 탭한 줄의 문장(들) — 둘이면 카드 둘 | 0 |
| 띠 `[☆]`(설명 모드 — 11-4) | 설명이 ready 일 때 | 그 문장 + 설명 사본 + 있으면 번역 | 0 |
| **선택 줄 `[⋯]` → `[기억 카드]`** | 선택 동작 줄이 있을 때(문장 아래 표시·번역 끔에서도) | 선택 시작 줄의 문장(`unitAt` — 8c-1) + 메모리·캐시의 번역 | 0 |
| **음성 "기억"**(9b 명령 `remember`) | 리더에서 마이크 | 지금 문장(`speaker.getCurrent()`, 줄 모드면 `sentenceUnits()` 에서 지금 줄을 담은 문장) + 번역 | 0 |

- **번역이 아직 없으면 앞면만 저장한다**(12-D6) — 손 없이 쓸 때 "기억"이 실패하지 않게. 뒷면은 그 문장 번역이 메모리에 들어오면(`readalong.onChange`) **그 자리에서** 채우고(같은 리더 세션 동안만 듣는다 — `pendingBacks` 집합), 아니면 복습 때 `fillBack`(호출 0)이 채운다.
- 띠 단추 상태: 이 문장의 카드가 있으면 `[★]`(`aria-pressed="true"`, 이름 "기억 카드에 있음"). `[★]` 를 다시 누르면 **아직 복습하지 않은 카드만** 지운다(잘못 누름 되돌리기 — `removeIfFresh`), 복습한 카드면 한 줄 "복습 중인 카드입니다 — 목록에서 지우세요". 카드 유무는 `get(id)` 한 번(문장이 바뀔 때 — id 계산은 해시 하나).
- 단추는 48×48, 띠의 머리 줄 inline-end(8c-1 의 `[×]` 옆, 낭독 모드에서는 홀로). 누르면 낭독은 **멈추지 않는다**. 띠를 만진 것으로 보지 않는다(띠 안 굴림 멈춤(7-7)은 띠 본문을 만질 때만 — 단추는 제외).
- **음성 "기억"**: 표에 한 줄 `{id:'remember', ar:['احفظ','احفظها','احفظ الجملة','تذكر','ذكرني'], en:['remember','remember this','save this','keep this'], exact:['save']}` `[검토 — Nour·운영자]`. 실행 = 주입 함수 `deps.onRemember(was)` → 저장 → 확인 줄 "기억 카드에 넣음" + 한 마디 `voice.remember.done`(«تم الحفظ» 꼴, `say(key, was)` — `voice.sayErrors` 가 꺼져 있으면 말하지 않고 곧장 되돌림) → `restore(was)`(읽던 중이면 이어 읽기). 지금 문장이 없거나 표 안내면 `voice.remember.none` 한 마디. 9b 의 "손이 이긴다"·확인 줄 규칙 그대로.
- 모든 글자 `textContent`/`appendBidiText`, `innerHTML` 0.

#### 6. 복습 화면 `#/cards` · `#/cards/:docId` (12-3 — `js/ui/cards.js`)

- 라우트: `router.js` `SCREENS` 에 `cards` + `cardsHash(docId)`, `main.js` switch 에 `showCards`/`leaveCards` 한 줄씩, `index.html` 섹션 하나. 탭 둘 — **[복습]**(기본) · **[목록]**.
- **입구(12-D14)**: 서재 본문 맨 위 **"오늘" 줄**(`#libraryToday` — 카드가 1장 이상일 때만 보임): "복습할 카드 n장 · 새 카드 m장 [복습 시작]"(13-2 가 같은 줄에 시험 줄을 더한다) · 단어장 화면(8f-3) 머리 `[복습 (n)]` · 서재 카드 `[⋯]` "이 책 복습"(`#/cards/:docId`). 서재 상단 줄과 리더 상단바는 늘리지 않는다.
- **[복습] 흐름** — 한 번에 카드 하나:
  1. 머리: "남은 n · 새 m" + 거르기 칩 `[전체][문장][단어]`(12-D3 — 세션 동안만, 저장하지 않음) + 책 범위(`:docId` 면 그 책 제목).
  2. **앞면** — 문장: `front`(`dir=ltr`·`lang=srcLang`) + `[▶]`(원문 음성 — 8k `resolveSpeech(srcLang)`). 단어: 원어 크게 + 문맥 문장(낱말에 밑줄 — `appendBidiText` 세 조각, 8f-2 와 같은 장치) + `[▶]`. 출처 한 줄 "책 제목 · 쪽 라벨"(`printedLabel`).
  3. `[답 보기]`(48px, 키보드 Space) → **뒷면** — 문장: `back`(대상 언어 `translationBlockAttrs`·`appendBidiText`) · 있으면 설명(작은 글자, 꼬리표 "설명") · `[▶]`(번역문 음성, `trSpeechText` — 괄호 속 라틴은 소리에서만 뺌). 단어: 번역 + 짧은 뜻 + 문맥 번역(`contextTr`). 뒷면이 비었으면 `fillBack` 을 먼저 시도하고, 그래도 없으면 "번역 없음 — 이 쪽을 열어 줄을 탭하면 번역됩니다" + `[쪽으로 가기]`(호출은 리더에서 사용자가 탭할 때 — 12-Q1). 고지 한 줄 "AI 번역 — 교육용"(11-D18 과 같은 결).
  4. 단추 넷 `[다시][어려움][좋음][쉬움]`(각 48px 이상, 아래에 `previewLabels`, 키보드 1–4, RTL 거울) → `review()` → 다음 카드. `ms` = 앞면을 보인 때부터 단추까지(상한 `SRS.MAX_REVIEW_MS` 60초 — 자리를 비운 시간을 세지 않음).
  5. **"다시"** 는 이번 세션 줄에서 **3장 뒤**에 다시 넣는다(남은 카드가 적으면 끝에) — `dueAt` 은 10분 뒤로 저장(12-D12).
  6. 끝: "오늘 복습 n장 끝 · 내일 m장" + `[목록]` `[서재]`. 중간에 떠나도 그때까지 매긴 것은 이미 저장돼 있다.
- **[목록]**: 문장 카드만(단어는 "단어장에서 고치세요" 링크 — 8f-3 편집 시트가 정본, 12-D17). 줄(48px 이상): 앞면 앞부분 · 뒷면 있음/없음 · 다음 복습일 · 책. 거르기(책) · 정렬(만든 날/다음 복습). 줄을 누르면 편집 시트(8f-3 과 같은 높이 식): 앞면(읽기 전용) · 뒷면(고침) · 설명(읽기 전용) · 메모 · `[멈춤/다시 켬]`(`suspended`) · `[쪽으로 가기]`(그 쪽·`lineId` — 문서가 없으면 숨김) · `[삭제]`(페이지 안 확인 — `confirm()` 쓰지 않음).
- 설정: 복습 화면 머리 `[⚙]` 에 "하루 새 카드 수"(`srs.newPerDay`, 0–100, 기본 20) 한 줄. 설정 화면은 늘리지 않는다.
- 낭독(speaker)과 무관 — 리더를 떠나 있으므로 낭독은 이미 멈춰 있다(`leaveReader`). `[▶]` 는 화면 안의 작은 말하기(11-2 `tts/say.js` 의 sayer 재사용 — 없으면 같은 꼴로 `ui/cards.js` 안에 20줄).
- 360×740·412×915·915×412 × 4언어 가로 넘침 0, 단추 48px, 아랍어 UI 에서 원문 칸만 `dir=ltr`.

#### 7. 고치는 파일 · import 방향

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **12-1** SM-2·카드 서비스 | `js/srs/sm2.js`(순수 약 120) · `js/srs/cards.js`(서비스 약 240) · `tests/sm2-12.test.mjs` · `tests/cards-12.test.mjs`(fake-idb) | `js/db.js`(연쇄 삭제 예외에 `sentence` +1) · `js/config.js`(`SRS` 상수 +12) · `js/settings.js`(`srs.newPerDay`·`srs.log` +2) · `js/backup/import.js`(9c — 카드 병합 +6)·9c 허용 목록(+2) · `js/vocab/store.js`(8f — `applyImport` 가 복습 필드를 보존하지 않으면 +3) |
| **12-2** 기억 단추·음성 | `js/ui/remember.js`(약 110 — 세 입구의 입력 모으기·뒷면 대기·단추 상태) · `tests/remember-12.test.mjs` | `js/ui/trband.js`(`[☆]` 세 모드 +45) · `js/ui/selbar.js`(`[⋯]` 에 `[기억 카드]` +10) · `js/voice/commands.js`(`remember` 줄) · `js/ui/voice.js`(`exec` 갈래 +6) · `js/ui/controls.js`(배선 +15) · `js/ui/library.js`(삭제 확인 "남습니다" 한 줄로 합침 +15) · `index.html`(띠 단추) · `css/reader.css` · i18n 4개(약 10키) |
| **12-3** 복습 화면·목록·"오늘" 줄 | `js/ui/cards.js`(약 480) · `tests/cards-ui-12.test.mjs` | `js/router.js` · `js/main.js`(+4) · `js/ui/library.js`("오늘" 줄 +45 · 카드 `[⋯]` 한 줄) · `js/ui/vocab.js`(8f-3 — `[복습 (n)]` +6) · `index.html`(섹션·"오늘" 줄 자리) · `css/screens.css` · i18n 4개(약 32키) |

- **import 방향**(3-2 에 한 줄 더함): `srs/sm2.js` 는 **순수**(config 만 — 16-A grep 대상: `document`·`window`·`Date` 직접 참조 금지), `srs/cards.js` 는 `vocab/*`·`notes/*` 행과 같다(`config`·`db`·`hash`·`srs/*` 만). `ui/remember.js`·`ui/cards.js` 는 ui 계층. `ai/*` 는 계속 `ui/` 를 모른다.
- 새 `js/*.js` 마다 `dev/stamp-importmap.mjs` → `--check` 0. DB 버전·`algoVersion`·`SEARCH.VERSION`·모든 `*_PROMPT_VERSION` 무변.

#### 8. 수용 기준 (16절 형식)

**12-1 SM-2·카드 서비스**
- [ ] `[N]` `sm2.next`: 3 의 표 S1–S10(주의 규칙대로 확정한 값) · `dueAt` = `dayStartMs + interval×DAY_MS`, again 은 `nowMs + 10분` · 순수 grep(`Date`·`document`·`window` 0).
- [ ] `[N]` `previewLabels` 네 칸이 `next()` 결과와 같다(분·일·개월 단위 고르기 포함).
- [ ] `[N]` (fake-idb) `saveSentence` 두 번 → 한 카드(`created:false`) · 대상 언어가 다르면 둘 · 앞면만 저장 뒤 `back` 을 주면 채워지고 `updatedAt` 오름 · id 의 경계: 앞면 "a b"+문서 "c" 와 "a"+"b c" 가 다른 id.
- [ ] `[N]` `review`: `sm2`·`dueAt`·`reviewedAt`·`introducedAt`(처음만) 바뀌고 **`updatedAt` 그대로**, 다른 필드(번역·메모) 그대로 · `srs.log[오늘]` 의 n·ms·new.
- [ ] `[N]` `queue`: 복습할 것 `dueAt` 순 → 새 카드 `createdAt` 순 · 오늘 이미 새 카드 18장이면 `newPerDay 20` 에서 2장만 · `suspended`·번역 빈 term 빠짐(`noTr` 셈) · 뒷면 빈 문장 카드는 들어감(`noBack` 셈) · ISO 문자열 `dueAt`(8f 옛 값 모사)도 숫자처럼 비교.
- [ ] `[N]` `fillBack`: 주입 조회가 번역을 주면 채움·저장, 없으면 그대로 · **조회 함수 밖의 호출 0**(가짜 pipeline 이 불리지 않음).
- [ ] `[N]` (fake-idb) `deleteDocument` 뒤 그 문서의 `term`·`sentence` 카드 남음, `kind` 없는 가짜 레코드는 지워짐 · `keptCount`.
- [ ] `[N]` 9c 병합: 기기 카드 `reviewedAt` 이 파일보다 늦으면 기기 것 · 파일이 내용 수정(`updatedAt`)만 늦으면 내용은 파일, 복습 상태는 늦은 쪽 · term CSV 가져오기(8f `applyImport`)로 번역을 고쳐도 `sm2`·`dueAt` 그대로.
- [ ] `[N]` 8f "마지막 내보내기 뒤 바뀐 항목"(`changedSince`)이 복습 뒤에 늘지 않는다.
- 변이: easy 보너스 지우기(S5·S9 빨강) · ease 바닥 지우기(S7) · `review` 가 `updatedAt` 을 올림(changedSince 시험 빨강) · id 를 uuid 로(중복 시험 빨강) · 연쇄 삭제 예외에서 `sentence` 빼기 · 새 카드 상한이 `srs.log` 를 안 봄.

**12-2 기억 단추·음성**
- [ ] `[D]` 흉내 음성·흉내 Gemini 로 speak 모드 낭독 → 띠 `[☆]` → `cards` 1장(`kind:'sentence'`·`front`=그 문장·`back`=띠 번역문·`origin:'band'`), 단추 `[★]`·`aria-pressed=true`, **요청 0건 증가**, 낭독 끊김 0(다음 `linechange` 가 예정대로).
- [ ] `[D]` 번역이 아직 pending 인 문장에서 `[☆]` → 앞면만 저장 → 번역이 도착하면 같은 카드에 `back` 채워짐(요청 수는 낭독 동반 번역 몫만).
- [ ] `[D]` `[★]` 다시 → 카드 지워짐(복습 전) · 복습한 카드(`reviewedAt` 심어 둠)면 안 지워지고 한 줄 안내.
- [ ] `[D]` 탭 띠(8c-1)·설명 띠(11-4)에서 `[☆]` → `origin:'tap'`·`'explain'`, 설명 모드는 `explain` 사본. `[문단 전체]` 보기에서는 `[☆]` 없음.
- [ ] `[D]` 문장 아래 표시(8d)·번역 끔에서 선택 → `[⋯]` → `[기억 카드]` → 그 문장 카드(캐시에 번역이 있으면 `back` 도), 요청 0.
- [ ] `[D]` 음성(가짜 인식기 — 9b-2 하네스) «احفظ» 낭독 중 → 카드 1장 · 확인 줄 · 한 마디(흉내 음성 utterance 1) · **읽기 재개** · `voice.sayErrors=false` 면 한 마디 없이 재개. 표 안내 위에서 → `none` 한 마디, 카드 0.
- [ ] `[N]` 명령 표 무결성(C3) — `remember` 의 꼴이 다른 명령과 공유 0. `save` 는 `exact`(혼자 말할 때만).
- [ ] `[D]` 서재 삭제 확인: 단어장 2·기억 카드 3·요약 0 → "단어장 2 · 기억 카드 3 는 남습니다"(0 은 빠짐), 지운 뒤 다섯 장 남음.
- [ ] `[D]` 띠 `[☆]` 360×740·412×915·915×412(8e compact) × 4언어 — 48px, 띠 글자와 겹침 0, RTL 거울. `innerHTML` 새 사용 0.
- 변이: 띠 단추 누름이 띠 굴림 멈춤으로 새어 감 · 뒷면 대기(`pendingBacks`) 지우기 · `removeIfFresh` 가 복습 카드도 지움 · 음성 경로 `restore(was)` 빼기.

**12-3 복습 화면·목록·"오늘" 줄**
- [ ] `[D]` 카드 6장 심음(문장 3·단어 3, 하나는 번역 빈 term, 하나는 내일 due) → 서재 "오늘" 줄 "복습할 카드 n · 새 m" 이 `queue().counts` 와 같다 · 카드 0장이면 줄 없음.
- [ ] `[D]` [복습 시작] → 앞면 → Space → 뒷면 → 4(쉬움) → 다음 · 끝 화면 숫자 · 매긴 카드의 `dueAt` 이 `previewLabels` 와 같다 · 요청 0건.
- [ ] `[D]` "다시" → 같은 카드가 3장 뒤에 다시 나옴 · `dueAt` = now+10분.
- [ ] `[D]` 거르기 칩 [단어] → term 만 · [문장] → sentence 만 · `#/cards/:docId` → 그 책만.
- [ ] `[D]` 뒷면 빈 문장 카드: 캐시에 그 문장 번역을 심어 두면 뒷면에 채워지고 저장됨 · 캐시에도 없으면 "번역 없음" + [쪽으로 가기] → 그 쪽·그 줄이 편안 영역 안 · 어느 쪽이든 요청 0.
- [ ] `[D]` 날짜 넘김(가짜 시계 23:59 → 00:01): 내일 due 카드가 나타나고 "오늘 새 카드" 셈이 0 으로.
- [ ] `[D]` [목록]: 편집으로 뒷면 고침 → `updatedAt` 오름 · 멈춤 → 복습 줄에서 빠짐 · 삭제는 페이지 안 확인.
- [ ] `[D]` 360×740·412×915·915×412 × 4언어: 가로 넘침 0, 단추 48px, 아랍어 UI 에서 앞면 `dir=ltr`·뒷면 `dir=rtl`. 키보드만으로 한 세션(Tab·Space·1–4).
- 변이: "다시" 재삽입 지우기 · 날짜 경계를 UTC 로 · 거르기가 term 을 안 거름 · `fillBack` 이 저장하지 않음.

**모든 Build 공통**: `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과 · `dev/stamp-importmap.mjs --check` 0 · `grep -rn "splitSentences" js/` 두 파일 · `innerHTML` 새 사용 0 · 콘솔 오류 0 · 무료 티어 숫자 0 · **새 원격 요청 0**(가로챈 요청 수가 낭독 동반 번역 몫과 같다) · 진짜 API 키 0.

#### 9. headless 시험 방법

- 8d·8cf·9b-2·11 하네스와 같은 꼴: Edge, 새 프로필·새 포트, `try { … } finally { await browser.close() }`, 결과는 stdout(JSON), 실행마다 시간 상한 10분, 띄워 둔 8000번 정적 서버(끄지 않는다).
- 카드 심기: `page.evaluate` 에서 `import('./js/db.js')` → `put('cards', …)`. **가짜 시계**: `evaluateOnNewDocument` 로 `Date.now` 를 바꿀 수 있게(날짜 넘김 시험).
- 흉내 Gemini(번역)·흉내 음성·가짜 인식기는 기존 하네스 그대로. 요청 수는 가로채기에서 센다.
- 실물 PDF 문장·번역은 결과 JSON 에 넣지 않는다(8d 규칙) — 카드 수·필드 유무·길이만.

#### 10. 결정 표 — 권장 (운영자 위임: 권장안으로 진행)

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 12-D1 | 나누기 | (가) **셋: 12-1 서비스 · 12-2 기억 단추·음성 · 12-3 복습 화면** · (나) 둘: 서비스+단추 · 화면 · (다) 하나 | **(가)** — 각 2–3시간. (나)는 띠·선택 줄·음성 셋과 병합 규칙이 한 Review 에 몰린다 |
| 12-D2 | 자리 | (가) **11-4 뒤, 13 앞** · (나) 11 앞 | **(가)** — 띠 설명 모드·`[⋯]`·`voice.js` 갈래가 11 에서 생긴다. 11 이 늦어지면 12-2 는 설명 모드 줄만 빼고 할 수 있다(그때 결정) |
| 12-D3 | 단어 카드와 문장 카드 | (가) **한 복습 줄에 섞음 + 거르기 칩(세션 동안)** · (나) 화면 둘 | **(가)** — 하루 할 일이 한 숫자("복습할 카드 n")라 습관이 쉽다. 같은 스토어·같은 SM-2. 칩으로 따로도 볼 수 있다 |
| 12-D4 | 알고리즘 | (가) **SM-2 + Anki 식 4단추 변형(다시 10분·어려움 ×1.2·쉬움 ×1.3, ease 바닥 1.3, 최대 365일)** · (나) 원전 SM-2(0–5점) · (다) FSRS · (라) 라이트너 상자 | **(가)** — spec 이 SM-2 로 정했다(17 #16). 단추 넷이 0–5점보다 쉽고 어려움/좋음이 실제로 갈린다. FSRS 는 매개변수·학습이 필요해 작은 앱에 과하다. 순수 함수·시험 표 |
| 12-D5 | 만들기 입구 | (가) **띠 `[☆]`(세 모드) + 선택 줄 `[⋯]` `[기억 카드]` + 음성 "기억"** · (나) 띠만 · (다) 선택 줄만 | **(가)** — 띠는 읽다가 한 번에, 문장 아래·번역 끔에서는 선택 줄, 화면을 안 보면 음성(요구 1). 셋 다 같은 `saveSentence` |
| 12-D6 | 번역이 없을 때 | (가) **앞면만 저장 → 같은 세션에 번역이 오면 채움, 아니면 복습 때 캐시에서(호출 0)** · (나) 번역 ready 일 때만 저장 가능 | **(가)** — 음성 "기억"이 실패하지 않는다(번역 끔·pending). 뒷면 없는 카드도 원문 듣기 복습은 된다 |
| 12-D7 | 카드 id | (가) **`sc:` + 해시(대상 언어·문서·정규화 앞면)** · (나) uuid + 조회 | **(가)** — 중복 0을 저장소가 보장, 9c 두 기기 병합이 같은 카드를 맞춘다. 인덱스 추가 없음 |
| 12-D8 | 문서를 지울 때 문장 카드 | (가) **남김 — 9-2 의 "문장 카드는 함께 지운다"를 바꿈** · (나) 9-2 그대로 지움 | **(가)** — 카드는 앞·뒷면 사본이라 PDF 없이 완결되고, 단어장(8f)·저장 요약(11-D8)과 같은 까닭(공간을 비워도 공부 기록은 남는다). 확인 대화에 숫자 |
| 12-D9 | 복습 시각 필드 | (가) **`reviewedAt` 따로 — `updatedAt` 은 내용 수정만, 9c 는 `max` 로 비교** · (나) 복습도 `updatedAt` | **(가)** — (나)는 8f "바뀐 항목 n개"를 무의미하게 만들고 9c 가 내용 수정을 복습 시각으로 덮을 수 있다 |
| 12-D10 | `dueAt` 형·조회 | (가) **숫자 ms, ISO 도 읽음, 목록은 전체 훑기** · (나) `dueAt` 인덱스 범위 조회 | **(가)** — 형이 섞이면 IndexedDB 는 숫자와 문자열을 다른 구간에 둬 범위 조회가 조용히 빠뜨린다. 수천 장은 훑기로 충분(8cf-D14) |
| 12-D11 | 하루 새 카드 | (가) **20장(`srs.newPerDay`, 0–100)** · (나) 상한 없음 | **(가)** — 하루에 단어 40개를 저장한 날 다음 날 복습이 폭발하는 것을 막는다. 남은 새 카드는 다음 날로 |
| 12-D12 | "다시" | (가) **세션 안 3장 뒤 다시 + `dueAt` 10분 뒤** · (나) 내일 | **(가)** — 틀린 카드를 같은 자리에서 한 번 더 보는 것이 SRS 의 요점. 세션을 떠나도 10분 뒤 due |
| 12-D13 | 손 없는 복습(듣기 자동 넘김·음성 채점) | (가) **이번엔 `[▶]` 듣기만 — Nour 가 써 본 뒤 작은 단계로** · (나) 지금 음성 채점 명령 넷 | **(가)** — 9b 명령표가 9 → 13 개가 되고 «صعب/سهل» 같은 일상어 오인식 위험. 화면 복습이 먼저 쓰이는지 본다 |
| 12-D14 | 복습 입구 | (가) **서재 "오늘" 줄(카드 있을 때만) + 단어장 `[복습 (n)]` + 서재 카드 `[⋯]`** · (나) 서재 상단 단추 | **(가)** — 상단은 412 에서 이미 꽉 찼다(8cf-D8·18-D2). "오늘" 줄은 13-2 가 시험·오늘 목표를 더하는 자리 |
| 12-D15 | 번역 빈 단어 | (가) **복습에서 빼고 "번역 없는 단어 n — 단어장에서 번역" 한 줄** · (나) 앞면만으로 복습 | **(가)** — 단어 카드의 답이 없다. 번역은 단어장 `[번역 안 된 것 모두 번역]`(사용자가 부를 때만) |
| 12-D16 | 단어 카드 앞·뒷면 | (가) **앞: 원어 + 문맥 문장(밑줄) · 뒤: 번역 + 짧은 뜻 + 문맥 번역** · (나) 앞: 원어만 | **(가)** — 의학 용어는 문맥이 뜻을 가른다. 8f 가 문맥을 이미 저장한다 |
| 12-D17 | 카드 고치기 | (가) **문장 카드는 목록에서(뒷면·메모·멈춤·삭제), 단어는 단어장 편집으로 링크** · (나) 복습 화면에서 둘 다 | **(가)** — 단어 편집 장치는 8f-3 하나로. 복습 화면은 매기기에 집중 |
| 12-D18 | CSV 가져오기와 복습 상태 | (가) **내용 필드만 바꾸고 복습 필드 보존 — 12-1 이 시험으로 확인·필요하면 고침** · (나) CSV 가 덮게 둠 | **(가)** — 엑셀에서 번역 하나 고쳐 넣었다고 몇 달 복습 이력이 0 이 되면 안 된다 |

**운영자에게 물을 것** (무료 한도·비용·외부 전송 — 권장하지 않음)

| # | 무엇 | 지금 설계 | 바꾸면 |
|---|---|---|---|
| 12-Q1 | 뒷면이 없는 카드의 번역을 **복습 화면에서** 부르기 | 없음 — 복습은 호출 0, `[쪽으로 가기]` 뒤 사용자가 줄을 탭(8c-1 승인 경로) | `[번역 받기]`(카드 1장 = 호출 1, 묶으면 20장에 1) — 편하지만 복습이 한도를 쓰는 첫 경로가 된다(17절 머리 6 "SRS 복습은 호출 0" 을 바꿈) |
| 12-Q2 | 기억 카드 **내보내기**(CSV·Anki) | 없음 — 9c 백업에만 들어간다 | 단어장처럼 CSV/Anki — 교과서 원문 문장 + AI 번역이 파일로 기기 밖에 나간다(8cf Q2 와 같은 결). 넣으면 12-3 +1시간 |

#### 11. 다른 단계에 넘길 것

- **8f-1**: term 항목의 `createdAt`·`updatedAt`·`dueAt` 은 **숫자 ms** 로 쓴다(12-D10). `applyImport` 는 기존 항목의 `sm2`·`dueAt`·`reviewedAt`·`introducedAt` 을 덮지 않는다(12-D18). 8f-1 Build 지침에 한 줄씩.
- **8f-2 · 11-2**: 서재 삭제 확인의 "남습니다" 줄을 한 함수(`keptLine(counts)`)로 만들어 두면 12-2 가 숫자 하나만 더한다.
- **8c-1**: 띠 머리 줄 inline-end 에 단추 칸을 둘(`[×]` + 하나) 들어가게 — `[☆]` 자리.
- **9c**: `cards` 문장 카드 병합 `max(updatedAt, reviewedAt)` · term 복습 필드 늦은 쪽 · 허용 목록 `srs.*` — 9c 가 먼저 Build 되면 12-1 이 고친다(위 4).
- **13**: 서재 "오늘" 줄·`srs.log`(하루 복습 장수·시간)를 13-2 가 읽는다.

#### 12. 크기 · 시간 `[추정]`

| Build | 크기 | Build | Review | 위험 |
|---|---|---|---|---|
| 12-1 SM-2·카드 서비스 | 중간 | 2h | 1h | 낮음~중간 — 9c·8f 파일에 작은 손(병합·가져오기 보존) |
| 12-2 기억 단추·음성 | 중간 | 2–2.5h | 1–1.5h | 중간 — 띠 세 모드·선택 줄·음성 세 입구, 뒷면 대기 |
| 12-3 복습 화면·목록·"오늘" 줄 | 중간~큼 | 2.5–3h | 1.5h | 중간 — 화면 둘(복습·목록), 날짜 경계 |
| **합** | | **6.5–7.5h** | **3.5–4h** | |

옛 추정(인계 10-21 표 16번: 4시간)은 입구 셋·병합 규칙·목록 화면을 작게 셌다.

#### 13. 마지막 실기기 점검 묶음 (12 몫 — 앱 완성 뒤 한 번에)

- [ ] `[M]` Nour GT 7: 낭독 중 띠 `[☆]` 을 엄지로 누르기 쉬운가, 잘못 눌러 줄 이동·띠 굴림 멈춤이 생기지 않는가(세로·가로).
- [ ] `[M]` 음성 «احفظ» 가 시리아 말씨로 잡히는가, 다른 명령(«اقرأ»·«وقف» …)과 헷갈리지 않는가, 한 마디 «تم الحفظ» 뒤 낭독이 이어지는가.
- [ ] `[M]` 복습 화면 `[▶]` — 원문(영어)·번역문(아랍어) 목소리가 휴대폰 설정 따름(8k)으로 나는가, 괄호 속 원어가 소리에서 빠지는가.
- [ ] `[M]` 자정 넘김(시리아 시간): 다음 날 아침 "오늘" 줄 숫자가 맞는가.
- [ ] `[M]` 하루 써 본 뒤: 하루 새 카드 20 이 알맞은가, "다시" 3장 뒤가 너무 이른가(Nour 말).
- [ ] `[M]` 9c 백업 → 새 기기 가져오기 뒤 카드·복습 일정이 이어지는가.

#### 14. 이번엔 못 함

- 손 없는 복습·음성 채점(12-D13) · 기억 카드 내보내기(12-Q2) · 복습 화면에서 번역 부르기(12-Q1) · 카드 통계 그래프(하루 기록 `srs.log` 는 남긴다 — 13-2 가 "오늘 n장"만 쓴다) · 요약(11) 용어를 카드로(문맥 문장이 없다 — 11 초안 14 와 같은 까닭) · 원본 보기의 선택(캔버스 — 띠·음성은 됨) · 알림(푸시 — 서비스 워커 없음).
- 실측: 이번 Plan 은 앱을 돌려 재지 않았다(앱 무변). 화면 수치는 Build 가 재서 위 `[D]` 로 확인한다.

---

### 17-10. 마감 전 검토 — 계획과 진도, 13 Build 설계 `[신설 2026-11-16 — 12·13 Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 13-D1–D15 · 물을 것 13-Q1–Q2 따로]`

**방침**: 17 #20(시험일과 범위 → "남은 글자 ÷ 남은 날 ÷ 낭독 속도(실측) = 하루 낭독 시간", "남은 글자 × 1만 자당 호출(실측) 대 `ai.dailyCap`", 순수·호출 0, 하루 시간은 사용자가 정함)과 17 #14(진도)를 그대로 따른다. **점수를 예측·약속하지 않는다**(19-1-1 N12). 계산은 순수 함수, 측정은 기기 안에만. 실기기에서만 답이 나오는 것은 끝의 점검 묶음으로.

#### 1. 지금 코드 사실 (파일:행)

| 항목 | 지금 | 근거 |
|---|---|---|
| **진도 스토어** | `progress` `[docId, sectionId]`, 인덱스 `docId`·`updatedAt` — **쓰는 코드 0건.** 17 #14 의 "`speaker` 의 `linechange` 가 이미 `readLineCount` 를 갱신" 은 **사실이 아니다**(grep: `progress` 를 쓰는 `put`·`patch` 없음) | `js/db.js:47-51` · `js/ui/controls.js:214-218` |
| 읽던 자리 | `documents.lastPage`·`lastLineId` — 쪽을 그릴 때마다 `db.patch`(자기 필드만). 쪽 안 위치는 낭독 중에도 저장하지 않는다 | `js/ui/reader.js:806-807·1577-1601` |
| 읽은 표시 | 화면만 — `speaker.finishSentence` → `view.markDone(unit)`(`--hl-done`). 저장하지 않는다 | `js/tts/speaker.js:676-687` · `js/ui/reader.js:1745` |
| 쪽 끝 | `advancePage` 가 쪽 끝에서 다음 쪽을 부른다(빈 쪽 최대 20 넘김), 마지막 쪽이면 `finish()` → `end`. **"이 쪽을 끝까지 읽었다" 이벤트는 없다** | `js/tts/speaker.js:755-790` |
| speaker 이벤트 | `statechange`·`phasechange`·`repeatchange`·`linechange{lineId, index, total, page, seg, src}`·`queue`·`end`·`error` · 공개 `getState`·`getRate`·`getRepeat`·`getCurrent` | `js/tts/speaker.js:229-236·704-711·1150-1231` |
| **낭독 속도** | **실측 0.** `TTS.CHARS_PER_SEC 14`(영어 워치독 `[가정]`) · `READALONG.CHARS_PER_SEC_TR 10`(번역문 워치독 `[가정]` — "8b 실기기에서 잰다"가 아직 안 됐다) | `js/config.js:362-365·709-711` |
| 책의 쪽당 글자 | `documents.readStats{pages, chars}` — 낭독 동반 번역이 처음 문장 목록을 만든 쪽마다(모드 `off` 면 세지 않음) 번역 대상 문장 글자를 더함 | `js/ai/readalong.js:207-215·679-701` |
| 쪽별 글자 | `searchText` `{docId, pageNo, sk, algoVersion, text, table, heads}` — 흐름 문단 글자(`text`). 추출이 같이 쓰고, 그 전 쪽은 검색을 처음 열 때 백필(`backfillPlan`·`prepareDoc` — 호출 0) | `js/db.js:91-99` · `js/search/engine.js:193-200·394-398` |
| 장(章) 범위 | `tocOf(docId)` → `{source:'outline'|'fallback', items:[{t, p, d}], pageLabels}` · `printedLabel(pageLabels, p)` | `js/search/outline.js:225-242` |
| 1만 자당 호출 | `usage` 행의 `byKind.readalong`·`charsTranslated`(15절). 화면은 8c-2 `ui/usage.js` 의 순수 `usageView`(초안) — 지금은 자리표시 | `js/ai/provider.js:209-283` · `index.html:776-786` · 8cf 초안 4-7 |
| 설정 키 | `planner.*`·`reading.*`·`srs.*` **없음** | `js/settings.js:26-111` |
| 라우트 | `SCREENS` 에 `planner` 없음(12-1 표에 `#/planner` P3) | `js/router.js:13-15` |

#### 2. 숫자의 출처 — 어디서 얻나

| 숫자 | 출처(권장) | 없을 때 | 표시 |
|---|---|---|---|
| **낭독 속도**(원문 글자/분) | **이 기기 실측** — 13-1 `plan/readlog.js` 가 `speaking` 상태로 보낸 시간과 그동안 시작한 단위의 원문 글자(`linechange.src` 길이)를 하루·**모드 갈래**별로 쌓는다. 갈래: `src`(번역 끔·`show`) · `both`(`speak` + 원문도 읽음) · `tr`(`speak` + 원문 안 읽음). 최근 14일 합이 **30분 이상**이면 `Σ글자 ÷ Σ분`, 지금 속도(`tts.rate`)와 잴 때 평균 속도의 비로 고친다 | 기본 추정 `[가정]` — `src` 840(14자/초 × 60) · `both` 370(원문 1,000자 71초 + 번역문 약 900자 90초) · `tr` 660, × `tts.rate` | "실측 · 최근 14일 n시간" / "추정 — 하루 써 보면 실측으로 바뀝니다" |
| **남은 글자** | 범위 쪽 중 **읽지 않은 쪽**의 `searchText.text` 길이 합 | 그 쪽 레코드가 없으면 범위 안 있는 쪽의 평균, 범위에 하나도 없으면 `readStats.chars/pages`, 그것도 없으면 `PLAN.DEFAULT_PAGE_CHARS`(3,000 `[가정]`) | "글자 수를 센 쪽 n/m" + `[정확히 세기]`(검색 백필 — 호출 0, 추출된 쪽만) |
| **1만 자당 호출** | **내 사용량** — 최근 30일 `Σ byKind.readalong ÷ Σ charsTranslated × 10,000`(`charsTranslated` 합 3만 자 이상일 때) — 8c-2 `usageView` 의 같은 식을 화면이 넘긴다 | 1.7(`[실측 2026-09-28]` 7-8-3 · 8b-1 500쪽 1.70) | "최대 약 n회" — 이미 번역된(캐시) 쪽을 빼지 않으므로 위로 잡은 값. 번역 끔(`src` 갈래)이면 0 |
| **남은 날** | 오늘(포함) ~ 시험 전날, **공부하는 요일만**, 끝에서 "복습만 할 날" k일 뺌 | — | "공부할 날 n일" |
| **오늘 복습** | 12 `queue().counts` + 장당 시간 = `srs.log` 최근 14일 `ms ÷ n` | 장당 8초 `[가정]` | "복습 n장 ≈ m분" |

- 낭독 기록에서 빼는 시간: 문장 반복(`getRepeat()` 켜짐) 동안 · `linechange` 사이가 `PLAN.MAX_GAP_MS`(120초)를 넘는 몫(멈춘 엔진·자리 비움). 표 안내(`src` null)는 시간은 세고 글자는 0(실제로 그만큼 걸린다).
- 측정 단위 차이: 속도는 **낭독 단위 원문**(인용 빼고)이고 남은 글자는 **검색 글자**(인용·제목 포함)라 남은 시간이 조금 크게 나온다(안전 쪽) `[추정 — 인용은 CMDT 2026 문단 글자의 수 % 미만]`. 13-1 Build 가 표본 20쪽으로 두 값의 비를 재서 5% 를 넘으면 `PLAN.TEXT_TO_SPOKEN` 계수를 둔다.
- **예시**(설계 감각 — CMDT 2026 쪽당 약 4,511자 `[실측 2026-09-28]`, `both` 기본 370자/분, 1만 자당 1.7): 한 장 40쪽 ≈ 18만 자 → 약 8.1시간, 10일이면 하루 49분, 호출 약 31회(하루 3회 — 상한 100 에 한참 못 미침). 책 전체 약 900만 자를 45일 → 하루 약 9시간 — **대개 막히는 것은 호출이 아니라 시간**이다. 그래서 화면은 시간을 먼저, 호출을 다음에 보인다.

#### 3. 계획 계산 — 순수 `js/plan/planner.js` (13-1)

`Date` 를 읽지 않는다 — 날짜는 `'YYYY-MM-DD'` 문자열로 받고 일수는 그레고리력 일련번호(`dayNum`)로 센다(시간대 없음).

```
dayNum('YYYY-MM-DD') → 정수 · weekdayOf(n) → 0(일)…6(토)
studyDays(today, exam, {weekdays:[0..6], reserve}) → 오늘 ≤ d < 시험일 중 공부 요일 수 − reserve (≥ 0)
rangesUnion(ranges) · rangesHas(ranges, p) · rangesAdd / rangesRemove        # 읽은 쪽 [[a,b]…] 정규화
remainingOf(targets, pageChars, readRanges) → {total, read, remaining, counted, pages}   # 쪽 글자 없는 쪽은 평균으로
planFor({today, exam, weekdays, reserve, minutesPerDay, reviewMinToday, speed, callsPer10k, cap, targets…})
  → { days, remaining, needMinPerDay = remaining ÷ speed ÷ days,
      readMinPerDay = max(0, minutesPerDay − reviewMinToday),            # 하루 시간에서 오늘 복습 몫을 뺀다(13-D13)
      finishDay     = 오늘부터 공부 요일로 ceil(remaining ÷ (speed × readMinPerDay)) 번째 날,
      slackDays     = days − 필요한 날 (음수면 모자람),
      calls         = remaining × callsPer10k ÷ 10,000,
      callsPerDay   = speed × readMinPerDay × callsPer10k ÷ 10,000,
      overCap       = callsPerDay > cap × PLAN.CAP_SHARE(0.8)            # 탭·단어·요약 몫을 남긴다
      status        = 'done' | 'ok' | 'tight'(slack < 2) | 'short' | 'past' }
todayRange(targets, pageChars, readRanges, dayChars) → 다음 읽지 않은 쪽부터 dayChars 가 찰 때까지 [{docId, from, to}]
```

- 시험일이 오늘이거나 지났으면 `past`(계산 없이 "시험일이 지났습니다 — 날짜를 고치세요"), 남은 글자 0 이면 `done`.
- `callsPer10k` 는 `src` 갈래(번역 끔)면 0 — 호출 줄을 숨긴다.
- **시험 표**(`tests/planner-13.test.mjs`): 윤년 2월 넘김 · 시험일 당일 제외 · 공부 요일 금 빼기 · reserve 2 · 남은 날 0 → `short`·`needMinPerDay` 무한 대신 "—" · 읽은 쪽 겹침 합치기 · 글자 없는 쪽 평균 · `overCap` 경계(0.8) · `callsPer10k` 0 · 예시(위 2) 숫자 재현.

#### 4. 낭독 기록 · 읽은 쪽 — 서비스 `js/plan/readlog.js` (13-1)

- `attach(speaker, {docIdOf, bucketOf, now})` — controls 가 리더 들어올 때 붙이고 떠날 때 뗀다. `bucketOf()` = 지금 유효 모드(`readalong` `effectiveMode` 결과)·`readalong.speakSource` 로 `src|both|tr`.
- 듣는 것: `statechange`(`speaking` 들어감·나감 시각) · `linechange`(새 단위의 `src` 길이 — 같은 index 재시작은 세지 않음) · `repeatchange`(켜지면 쉼) · **새 `pagedone{page}`**.
- **speaker `pagedone`**(+6줄): `advancePage` 가 **빈 쪽 넘김이 아닐 때**(`hop === 0`) 다음 쪽을 부르기 전에, 그리고 마지막 쪽 끝에서 `finish()` 직전에 `emit('pagedone', {page})`. 쪽 중간에서 시작해도 끝까지 읽으면 그 쪽은 읽음이다(13-D3).
- **저장**:
  - 하루 낭독 — `settings['reading.log'] = {v:1, days:{'YYYY-MM-DD': {src:{ms, chars, rateMs}, both:{…}, tr:{…}, pages}}}`(최근 60일만). 쓰기는 **60초마다·멈춤·떠남·`visibilitychange` hidden** 에 한 번(낭독 중 IndexedDB 쓰기를 줄인다).
  - 읽은 쪽 — `progress` 스토어 `{docId, sectionId:'@read', ranges:[[a,b]…], pages(합), updatedAt}`. 없을 수 있으므로 `withTx` 한 트랜잭션에서 읽고 합쳐 쓴다(`db.patch` 는 없으면 안 쓴다). `sectionId` 는 퀴즈 파서의 로마숫자·`sec-none` 과 겹치지 않는다. 문서를 지우면 함께 지워진다(지금 연쇄 그대로 — 그 PDF 의 진도라서).
  - 손으로 고침 — `markRead(docId, a, b, on)`(계획 화면 `[읽음으로]`/`[안 읽음으로]` — 눈으로 읽은 쪽, 잘못 센 쪽).
- `reading.track`(기본 켬 — 13-Q2) 이 꺼져 있으면 `attach` 가 아무것도 하지 않는다(읽은 쪽 자동 표시도 없음, 손으로 고침은 됨).
- import: `config`·`db`·`plan/planner`(ranges)만. speaker 는 주입(`ui` 가 넘김) — `tts/*` 를 import 하지 않는다.

#### 5. 계획 화면 `#/planner` (13-2 — `js/ui/planner.js`)

- 라우트 `#/planner` — `router.js` `SCREENS` 에 `planner`, `main.js` 한 줄, `index.html` 섹션 하나. **입구**: 서재 "오늘" 줄(12-3)에 시험 줄 + `[계획]` · "오늘" 줄은 카드도 시험도 없으면 `[시험 계획 세우기]` 작은 링크 하나만(13-D14).
- **시험 목록**(최대 5개, 가까운 날 먼저): 이름(60자) · 날짜(`<input type="date">`) · 범위들 · 하루 시간(분, 기본 60, 10–600) · 공부 요일(칩 7개, 기본 매일) · 복습만 할 날(0–14, 기본 0). 저장 `settings['planner.exams'] = [{id, name, date, minutesPerDay, weekdays, reserve, targets:[{docId, from, to, label}], createdAt, updatedAt}]`.
- **범위 고르기**: 책(서재 문서) → `[장 ▾]`(`tocOf` — 깊이 0·1 항목, 다음 항목 쪽 − 1 까지) 또는 `[쪽 a–b]`(인쇄 라벨을 함께 — `printedLabel`). 범위 여러 개, 같은 책 겹침은 합친다(`rangesUnion`).
- **한 시험의 결과 카드**(위 → 아래):
  1. "시험까지 n일 · 공부할 날 m일"(쉬는 요일·복습만 할 날을 뺀 수).
  2. **진도**: 전체 막대 "읽음 a% (쪽 x/y · 약 n만 자 남음)" + 범위(장)별 작은 막대. `[정확히 세기]`(글자 수를 센 쪽이 범위의 95% 미만일 때만 — `engine.prepareDoc`, 호출 0, 진행 표시).
  3. **하루 필요**: "하루 약 n분 낭독하면 시험 전날까지 끝납니다" · "지금 하루 m분(복습 k분 포함)이면 {날짜}에 끝 — {여유 s일 / s일 모자람}". 속도 출처 한 줄(실측/추정).
  4. **번역 호출**(`src` 갈래가 아닐 때): "남은 범위 번역 최대 약 c회 · 하루 약 d회 / 상한 {ai.dailyCap}". `overCap` 이면 한 줄 "하루 상한에 가깝습니다 — 이미 아는 장은 번역을 끄고 읽으면 호출이 0 입니다"(설정을 바꾸지 않는다 — 13-D10). 상한을 올리라고 권하지 않는다(13-Q1).
  5. **오늘**: "오늘 읽을 곳: {책} 쪽 a–b(약 n분)" + `[여기서 읽기]`(`readerHash(docId, a)`) · "오늘 낭독 x분 / 목표 y분"(`reading.log` 오늘) · "복습 n장 [복습 시작]"(12).
  6. **읽은 쪽 고치기**(접힘): 쪽 a–b `[읽음으로]` `[안 읽음으로]`.
  7. 고지 한 줄 `planner.disclaimer` "읽기 분량 계획입니다 — 점수나 합격을 예측하지 않습니다."
- 모든 숫자는 `planFor` 결과 그대로(화면이 계산하지 않는다 — 시험 대상). `textContent` 만. 360×740·412×915·915×412 × 4언어, 단추 48px, RTL 거울, 숫자는 UI 언어 표기(`formatNumber`).

#### 6. 고치는 파일 · import 방향

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **13-1** 기록·계산 | `js/plan/planner.js`(순수 약 220) · `js/plan/readlog.js`(서비스 약 200) · `tests/planner-13.test.mjs` · `tests/readlog-13.test.mjs`(가짜 speaker·가짜 시계·fake-idb) | `js/tts/speaker.js`(`pagedone` +6) · `js/ui/controls.js`(`readlog.attach`/`detach` +10) · `js/config.js`(`PLAN` 상수 +12) · `js/settings.js`(`reading.log`·`reading.track`·`planner.exams` +3) · 9c 허용 목록(+3) |
| **13-2** 계획 화면 | `js/ui/planner.js`(약 450) · `tests/planner-ui-13.test.mjs` | `js/router.js` · `js/main.js`(+4) · `js/ui/library.js`("오늘" 줄에 시험 줄·입구 +30) · `index.html`(섹션) · `css/screens.css` · i18n 4개(약 38키) |

- **import 방향**(3-2 에 한 줄): `plan/planner.js` 는 **순수**(config 만 — `Date` 금지), `plan/readlog.js` 는 `vocab/*`·`srs/cards` 행과 같다(`config`·`db`·`plan/*` — speaker 는 주입). `ui/planner.js` 는 `search/outline`(`tocOf`·`printedLabel`)·`search/engine`(`prepareDoc`)·`ui/usage`(`usageView` 의 1만 자당 식)·`srs/cards`(`queue` 셈)를 import 한다(ui 계층 — 허용).
- `dev/stamp-importmap.mjs --check` 0. DB 버전·`algoVersion`·판본 상수 무변.

#### 7. 수용 기준 (16절 형식)

**13-1 기록·계산**
- [ ] `[N]` `planner`: 3 의 시험 표 전부 · 예시(2) 재현 — 18만 자 · 370자/분 · 10일 → 하루 49분, 호출 31 · 순수 grep(`Date`·`document`·`window` 0).
- [ ] `[N]` `readlog`(가짜 speaker·가짜 시계): `speaking` 60초 동안 단위 넷(글자 합 400) → 그날 `both.ms 60000`·`chars 400` · `paused` 동안 시간 0 · 반복 켜짐 동안 0 · `linechange` 사이 5분 → 120초만 · 같은 index 재시작 글자 0 · 60초·멈춤·hidden 에서만 쓰기(쓰기 횟수).
- [ ] `[N]` `pagedone`: 쪽 끝 자동 넘김에서 한 번(`hop 0`), 빈 쪽 넘김에서는 그 빈 쪽 없음, 마지막 쪽 끝에서 한 번 · 사용자 [다음] 누름·`stop` 에서는 없음.
- [ ] `[N]` (fake-idb) 읽은 쪽 — 없던 `@read` 레코드를 만들고, `[[3,5]]` + 6 → `[[3,6]]`, 손으로 4 안 읽음 → `[[3,3],[5,6]]` · 퀴즈 `progress` 레코드와 섞이지 않음 · `deleteDocument` 뒤 없음.
- [ ] `[N]` `reading.track:false` → 기록 0, `markRead` 는 됨.
- [ ] `[N]` 속도: 실측 29분 → 기본 추정 · 31분 → 실측 · 잴 때 평균 1.0, 지금 1.25 → ×1.25 · 갈래가 다르면(실측은 `both`, 지금 `src`) 그 갈래의 기본.
- 변이: `pagedone` 를 빈 쪽 넘김에서도 · 반복 쉼 지우기 · 시험일 당일 포함 · 쉬는 요일 무시 · `MAX_GAP_MS` 자르기 지우기 · `callsPer10k` 실측 문턱 무시.

**13-2 계획 화면**
- [ ] `[D]` 시험 하나(오늘 + 10일, 매일, 하루 60분) · 범위 = 심은 책의 장 하나(`tocOf`) → 결과 카드 숫자가 같은 입력의 `planFor` 와 같다(화면 글자에서 숫자를 읽어 비교).
- [ ] `[D]` 흉내 음성으로 그 장 첫 두 쪽을 끝까지 낭독 → 계획 화면 진도에 두 쪽 읽음, "오늘 낭독 n분" 이 가짜 시계 경과와 같다(±1분), 오늘 읽을 곳이 셋째 쪽부터.
- [ ] `[D]` `[여기서 읽기]` → 그 쪽 · `[읽음으로]`/`[안 읽음으로]` → 진도 바뀜 · `[정확히 세기]` → 센 쪽 늘어남, **원격 요청 0**.
- [ ] `[D]` 상한 3 · 1만 자당 1.7 · 하루 300분 → `overCap` 줄 보임, 설정 값(`ai.dailyCap`·`readalong.mode`) **무변**.
- [ ] `[D]` 시험일 어제 → `past` 한 줄 · 범위 다 읽음 → `done` · 사용량 행 심음(`readalong 34회 · 200,000자`) → "1만 자당 1.7(실측)".
- [ ] `[D]` 서재 "오늘" 줄: 시험 둘 → 가까운 것 · 시험·카드 없음 → `[시험 계획 세우기]` 링크만.
- [ ] `[D]` 360×740·412×915·915×412 × 4언어: 가로 넘침 0, 단추 48px, 날짜 칸·요일 칩 RTL. 고지 한 줄 있음. 화면 어디에도 "점수"·"합격 가능성" 문구 없음(i18n grep).
- 변이: 화면이 `planFor` 대신 자체 계산 · 복습 분을 빼지 않음 · `overCap` 이 설정을 바꿈.

**모든 Build 공통**: 12 와 같음(새 원격 요청 0 포함).

#### 8. headless 시험 방법

- 12 와 같은 하네스. 흉내 음성은 utterance 마다 `onend` 를 글자 수 ÷ 14자/초로 늦게 부르게(가짜 시계와 함께) — 속도 기록을 숫자로 맞춘다.
- 책은 합성 PDF 또는 띄워 둔 서버의 표본(결과 JSON 에 글자는 넣지 않는다 — 쪽 번호·글자 수만).

#### 9. 결정 표 — 권장 (운영자 위임: 권장안으로 진행)

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 13-D1 | 나누기 | (가) **둘: 13-1 기록·계산(화면 없음) · 13-2 화면** · (나) 하나 | **(가)** — 13-1 은 speaker 를 건드리므로 낭독 회귀를 따로 본다. 각 2–3시간 |
| 13-D2 | 낭독 속도 출처 | (가) **실측(모드 갈래별·최근 14일·30분 이상) + 없으면 기본 추정** · (나) 상수 · (다) 사용자가 입력 | **(가)** — 17 #20 "실측 글자/분". 번역문 낭독 여부로 속도가 두 배 갈리므로 갈래를 나눈다. 하루 쓰면 실측이 된다 |
| 13-D3 | 읽은 쪽 | (가) **그 쪽을 끝까지 낭독(`pagedone`) + 손으로 고침** · (나) `lastPage` 위치 앞을 전부 읽음 · (다) 섹션 `readLineCount` | **(가)** — Nour 는 검색·목차로 건너뛴다(8g) — (나)는 건너뛴 쪽까지 읽음으로 센다. (다)는 섹션이 퀴즈 파서 단위라 본문 대부분에 없다 |
| 13-D4 | 읽은 쪽 저장 자리 | (가) **`progress` `sectionId:'@read'` 레코드(쪽 구간 배열)** · (나) `documents.readPages` · (다) 설정 | **(가)** — 진도 스토어가 이미 있고 비어 있다. `documents` 는 쓰는 곳이 많아 덮어쓰기 경합(공개 전 묶음 교훈)이 다시 생긴다. 7000쪽도 구간 몇 개 |
| 13-D5 | 쪽 글자 | (가) **`searchText.text` 길이 + 없는 쪽 평균 + `[정확히 세기]`(백필, 호출 0)** · (나) `pages` 를 읽어 조립 | **(가)** — `pages` 는 쪽당 약 12KB 역직렬화·문단 조립(7000쪽에 수 초). 검색 글자는 이미 흐름 문단 글자다 |
| 13-D6 | 1만 자당 호출 | (가) **내 사용량(최근 30일 3만 자 이상) · 없으면 1.7 · "최대"로 표시** · (나) 1.7 고정 | **(가)** — 15절이 이미 같은 지표를 사용자에게 보인다(8c-2). 캐시 몫을 빼지 않아 위로 잡는다(안전) |
| 13-D7 | 시험 수 | (가) **최대 5개, 가까운 것 먼저** · (나) 하나 | **(가)** — 과목·책별 마감이 따로일 수 있다. 저장은 설정 키 하나 |
| 13-D8 | 날 세기 | (가) **오늘 포함·시험일 제외 · 공부 요일 칩 · 복습만 할 날(기본 0)** · (나) 달력 날 그대로 | **(가)** — 17 #20 "주 5일 전제는 버리고 사용자가 정한다"를 요일로. 시험 당일은 공부 날이 아니다 |
| 13-D9 | 범위 단위 | (가) **장(목차) 또는 쪽 a–b, 여러 개** · (나) 쪽만 | **(가)** — 시험 범위는 대개 장이다. 8g 목차(`tocOf`)가 이미 있다. 인쇄 쪽 라벨을 함께 보여 책 쪽 번호로 고를 수 있다 |
| 13-D10 | 호출이 상한에 가까울 때 | (가) **한 줄 안내만 — 아무 설정도 바꾸지 않음** · (나) 번역 끔을 자동 제안 단추 | **(가)** — 계획 화면은 보이기만. 바꾸는 것은 사용자가 설정에서 |
| 13-D11 | 점수 | (가) **없음 — 고지 한 줄** | 19-1-1 N12 · 지침 "점수 약속 없음" |
| 13-D12 | 오늘 목표 | (가) **다음 읽지 않은 쪽부터 하루 글자만큼 "쪽 a–b" + `[여기서 읽기]`** · (나) 분만 | **(가)** — 바로 시작할 수 있다. 하루 글자 = 속도 × 낭독 몫 분 |
| 13-D13 | 복습 시간 | (가) **하루 시간에 복습 포함 — 낭독 몫 = 하루 시간 − 오늘 복습 예상** · (나) 따로 | **(가)** — 사용자가 정하는 것은 "하루 공부 시간" 하나다(긴 근무). 복습이 늘면 낭독 몫이 줄어든 것이 보인다 |
| 13-D14 | 입구 | (가) **서재 "오늘" 줄(12-3)에 시험 줄 + `[계획]`, 없으면 작은 링크** · (나) 서재 상단 단추 · (다) 설정 안 | **(가)** — 12-D14 와 같은 자리·같은 까닭 |
| 13-D15 | 측정 기록 쓰기 | (가) **60초마다·멈춤·떠남·숨김 때 한 번, 60일만** · (나) 문장마다 | **(가)** — 낭독 중 IndexedDB 쓰기를 문장마다 하면 폰에서 쓸데없는 일. 잃어도 최대 1분 |

**운영자에게 물을 것** (무료 한도·비용·개인정보 — 권장하지 않음)

| # | 무엇 | 지금 설계 | 바꾸면 |
|---|---|---|---|
| 13-Q1 | 계획이 상한을 넘을 때 **"상한 올리기"** 를 권하기 | 권하지 않는다 — 안내는 "번역 끄고 읽기·시간·범위"만, 상한은 사용자의 안전장치(15절) | 상한을 올리라는 문구·단추 — 무료 티어를 넘겨 429 가 잦아지고, 유료 키(17-6 B)를 넣었다면 돈이 든다 |
| 13-Q2 | **낭독 기록**(하루 낭독 분·글자·읽은 쪽)을 남기기 | 남긴다 — **기기 안에만**, 9c 백업에 들어감, 끄는 스위치 `reading.track`(설정 낭독 묶음 한 줄, 기본 켬) | 기본 끔(계획 화면을 열 때 켜기를 묻기) — 공부 습관 기록이 개인정보에 가깝다고 보면. 끄면 속도가 늘 추정이다 |

#### 10. 다른 단계에 넘길 것

- **8c-2**: `usageView` 의 "1만 자당 호출" 식을 날짜 범위를 받는 작은 순수 함수(`callsPer10k(rows)`)로 떼어 export — 13-2 가 같은 식을 쓴다.
- **9c**: 허용 목록에 `reading.log`·`reading.track`·`planner.exams` · `progress` `sectionId:'@read'` 는 `updatedAt` 새로운 쪽 대신 **구간 합집합**(두 기기에서 읽은 쪽을 다 남긴다 — +5줄). 9c 가 먼저 Build 되면 13-1 이 고친다.
- **8b 남은 실측**: `CHARS_PER_SEC_TR` 은 여전히 `[가정]` — 13-1 의 `tr`·`both` 갈래 기록이 그 값을 재는 첫 실측이 된다(워치독 상수는 이번에 바꾸지 않는다 — 기록만 보고 다음 다듬기에서).
- **15 복습 묶음**: 범위 = 이 계획의 시험 범위를 고를 수 있게(입력 하나 더) — 15 Plan.

#### 11. 크기 · 시간 `[추정]`

| Build | 크기 | Build | Review | 위험 |
|---|---|---|---|---|
| 13-1 기록·계산 | 중간 | 2–2.5h | 1–1.5h | 중간 — speaker 이벤트 하나(낭독 회귀 시험 전부 무변이 증거), 시간 재기 |
| 13-2 계획 화면 | 중간 | 2.5–3h | 1.5h | 낮음~중간 — 입력이 많은 화면 하나, 날짜 칸 RTL |
| **합** | | **4.5–5.5h** | **2.5–3h** | |

옛 추정(인계 10-21 표 17번: 2시간)은 화면 하나만 셌다 — 진도 저장이 없다는 사실(1 표)과 속도 실측 기록이 더해졌다.

#### 12. 마지막 실기기 점검 묶음 (13 몫 — 앱 완성 뒤 한 번에)

- [ ] `[M]` 하루 낭독 뒤 "실측" 속도가 Nour 의 실제 느낌과 맞는가(초시계로 10분 재서 비교) — `both`·`src` 갈래 각각.
- [ ] `[M]` 화면을 끄고(잠금, 9a) 듣는 동안에도 낭독 시간·읽은 쪽이 쌓이는가.
- [ ] `[M]` Android 날짜 고르기(`<input type="date">`)가 아랍어 UI 에서 쓸 만한가, 시험일이 시리아 날짜로 맞게 저장되는가.
- [ ] `[M]` 장 고르기 — CMDT 목차에서 원하는 장을 찾기 쉬운가(412 세로).
- [ ] `[M]` 일주일 쓴 뒤: "하루 필요 분"과 실제가 크게 어긋나지 않는가, 상한 줄이 쓸데없이 뜨지 않는가.

#### 13. 이번엔 못 함

- 점수·합격 예측(13-D11) · 알림(푸시 — 서비스 워커 없음) · 장 안의 절 단위 진도(8g-5 조건부와 함께) · 눈으로 읽은 쪽 자동 인식(스크롤로 추정하지 않는다 — 손으로 고침만) · 여러 기기 실시간 동기(9c 파일로만) · 그래프(하루 기록은 남겨 둔다).
- 실측: 이번 Plan 은 앱을 돌려 재지 않았다(앱 무변). 예시 숫자는 spec 의 기존 실측(4,511자/쪽 · 1.7회/1만 자)과 워치독 가정값으로 계산한 것이다.

---

## (C) 3-2 import 방향 — 규칙 끝에 붙일 한 줄

`[수정 2026-11-16 — 12·13 Plan]` **`srs/sm2.js`·`plan/planner.js` 는 순수 계층**(`config` 만 — `Date` 도 쓰지 않는다, 시각·날짜는 인자). **`srs/cards.js`·`plan/readlog.js`** 행은 `vocab/*`·`notes/*`·`search/*` 행과 같다: `config`·`text/*`·`db`·`hash`·같은 폴더만(`ui/`·`ai/`·`pdf/`·`tts/` 금지 — 번역 조회·speaker 는 주입).

## (D) 9-2 에 붙일 것

- **`cards` 행 주요 필드 칸 끝**: `[수정 2026-11-16 — 12 Plan]` 위 필드는 초판이다. 문장 카드(`kind:'sentence'`)·단어(`kind:'term'`)의 정본 필드와 복습 필드(`sm2`·`dueAt`(숫자 ms)·`reviewedAt`·`introducedAt`)는 17-9 4. `updatedAt` 은 내용 수정만.
- **`[신설 2026-10-12]` 단어장 문단 끝 "문장 카드(`kind:'sentence'`)는 지금처럼 함께 지운다"** 뒤에: `[수정 2026-11-16 — 12-D8]` → 문장 카드도 남긴다(앞·뒷면 사본으로 완결). 연쇄 삭제 예외 = `kind ∈ {term, sentence}`.
- **`progress` 행 끝**: `[수정 2026-11-16 — 13 Plan]` 지금 쓰는 코드 0건. 13-1 이 `sectionId:'@read'` 레코드(`ranges`·`pages`·`updatedAt`)로 그 문서의 읽은 쪽을 둔다(17-10 4). 섹션별 `readLineCount` 는 쓰지 않는다.

## (E) 9-3 설정 키에 더할 것

```
srs.newPerDay (number, 기본 20, 0–100)                       [신설 2026-11-16 — 12] 17-9 6 · 12-D11
srs.log ({'YYYY-MM-DD': {n, ms, new}}, 60일)                  [신설 2026-11-16 — 12] 하루 복습 장수·시간·새 카드 수
reading.track (bool, 기본 true)                               [신설 2026-11-16 — 13] 17-10 4 · 13-Q2
reading.log ({v, days:{'YYYY-MM-DD': {src|both|tr:{ms, chars, rateMs}, pages}}}, 60일)   [신설 2026-11-16 — 13]
planner.exams ([{id, name, date, minutesPerDay, weekdays, reserve, targets[]…}], 최대 5)  [신설 2026-11-16 — 13]
```

## (F) 12-1 라우트 표

`#/review/:docId/:sectionId`, `#/cards`, `#/notes` 행과 `#/lang/*`, `#/planner` 행 끝에: `[수정 2026-11-16 — 12·13 Plan]` `#/cards`·`#/cards/:docId`(12-3)·`#/planner`(13-2) 는 Phase 2 로 당겨졌다 — 17-9 6 · 17-10 5.

## (G) 17절 표 정정 한 줄씩

- **#14 진도 추적** 끝: `[정정 2026-11-16 — 12·13 Plan]` "`linechange` 가 이미 `readLineCount` 를 갱신" 은 사실이 아니다 — `progress` 를 쓰는 코드는 0건이다. 진도는 쪽 단위 `@read` 레코드로 13-1 이 만든다(17-10).
- **#16 오답 노트·SRS** 끝: `[수정 2026-11-16 — 12 Plan]` 설계 정본 17-9. 문장 카드도 문서 삭제 때 남긴다(12-D8).
- **#20 학습 플래너** 끝: `[수정 2026-11-16 — 13 Plan]` 설계 정본 17-10. 낭독 속도는 13-1 이 재기 시작한다(지금 실측 0).
