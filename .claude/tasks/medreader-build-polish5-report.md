# Build 보고 — 다듬기 5: 화면·문구·시험 틈 · 19 링크만 (2026-11-18)

지침 `.claude/tasks/medreader-build-polish5.md`. 기준 `12c245b`. **커밋하지 않았다.** 스크래치 `bp5/` = `C:/Users/YDC/AppData/Local/Temp/claude/9d924f3f16e52d8a/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/bp5/`. 권한 거절 0 · 백그라운드 작업 0(변이 실행 하나가 저절로 뒤로 넘어갔다가 끝남 — 그동안 앱 파일은 건드리지 않음) · 진짜 키·요청 0 · 서버 0 · AI 호출 변경 0 · DB 판·판본 상수·`algoVersion` 불변.

## 0. 한눈에

| # | 항목 | 결과 |
|---|---|---|
| 1 | 12-3 복습 키 1–4 — 아랍-인도 숫자 자판 | **고침** — `gradeKeyIndex`: `ev.key` 서방·`١`–`٤`·`۱`–`۴` → 그다음 `ev.code` `Digit1`–`4`·`Numpad1`–`4`(AZERTY `&` 도) |
| 2 | 13-2 시험일 당일 · 정렬 · ar 요일 칩 | **고침** — `viewStatus` today("오늘 시험입니다") · 정렬 오늘 = 0 · 서재 줄 today · ar 칩 `narrow`(short 가 4자 넘으면) |
| 3 | 19 링크만 | **고침** — `LINKS.SUGGESTED` Open-i 한 줄 · 설정 [추천 링크 추가] → `[찾아보기]` 새 탭(`noopener noreferrer`·리퍼러 없음) · 앱 요청 0 |
| 4 | `ranged` 사본 → `isNoTrTerm` | **고침** — `srs/cards.js` 는 이미 export 라 무변 |
| 5 | fr·ko 영어 값 · 분 한도 문구 다른 화면 · en 같은 값 표 | **부분** — fr `nav.back`·`common.cancel`·`library.card.delete`, ko 같은 셋 고침 · **분 한도 문구 5화면은 못 함**(아래) · 표는 아래 5절(나머지는 번역 묶음으로 넘김) |
| 6 | 시험 틈 5개 | **메움**(tests/ 만) — Q12 `〜`·`^+` · reattach 트랜잭션 · 내보내기 보이는 줄만 · D5 조각 순서 · 3단 퍼즈 불변 |
| 6b | 다듬기 4 넘긴 시험 틈 둘 | **메움 + 고침** — `leaveLinksSettings` 취소 길 node 시험 · 서재로 돌아오면 초점(앱 코드 `landingTarget`) |
| 7 | 서재 상태 줄 "필기·요약 n건" | **고침** — 레코드 수 → 화면 셈(묶음 + 요약 건, 붙이기 전후 차이) |
| 9 | 16 라벨 단위 토큰 글자 체계 끊기 | **고침** — `numexpr.js` `unitAfter` 몇 줄(`mg을`→`mg` · `mEq/L로`→`mEq/L` · `/` 뒤 통째) |
| 8 | 12-3 간격 단위 복수 | **고침** — `Intl.PluralRules` 범주 키(ar few·many · fr year other) |

## 1. 바꾼 파일

| 파일 | 항목 |
|---|---|
| `js/ui/cards.js` | 1 `GRADE_KEYS`·`gradeKeyIndex`(export) + `onKey` · 8 `spanText(p, tr, lang)` 범주 키 · 4 `ranged` → `isNoTrTerm`(import) · `hasKey` import |
| `js/ui/planner.js` | 2 `sortExams` `>=` · `viewStatus`(export) · 카드 `data-status`·상태 문구 `today` · `libraryExamLine` `today` · `WD_CHIP_MAX`·`dayChipLabels`(export) · `wdName(w, style, lang)` |
| `js/ui/library.js` | 2 "오늘" 줄 `library.todayExam.today` · 7 `noteUnits`·`reattachShown`(export) + `importFile` · 6b `landingTarget`(export)·`focusLanding`·`navigated` |
| `js/config.js` | 3 `LINKS.SUGGESTED` 한 줄 |
| `js/text/numexpr.js` | 9 `unitAfter` 끊기 + `SCRIPTS`·`scriptOf`(13줄) |
| `js/i18n/{ko,en,fr,ar}.js` | 새 13키(`planner.status.today` · `library.todayExam.today` · `cards.span.{min,hour,day,month,year}.{few,many}` · `cards.span.year.other`) + 5 값(fr 셋 · ko 셋) |
| `index.html` | stamp 만(모듈 106 · CSS 4) |
| `spec.md` | `[정정 2026-11-18 — 다듬기 5]` 11줄(4-14-2 8q · 11-3 i18n · 12-6 서재 · 17-9 · 17-11 · 17-12 · 17-13 · 17-14 · 17-15 머리 + 2-4 · 17-16) |
| `tests/polish-5.test.mjs` | **새** Z1–Z9(14 시험) |
| `tests/grounding-15.test.mjs` | Q12 에 문단 둘(`3〜4시간`·`10^+3`) + 끝·가운데 4꼴 · 전체 2꼴 |
| `tests/cards-ui-12.test.mjs` | K2 `spanText` 에 `'en'`(범주 키는 Z8) |
| `tests/planner-ui-13.test.mjs` | P2 정렬 기대값 `['e','b','a','c','d']`(오늘 e 가 맨 앞 — 고친 동작) |
| `tests/links-18.test.mjs` | L4 추천 id 목록에 `openi` |

손대지 않음: `srs/cards.js`(이미 export) · `ai/*`·`db.js`·`backup/*`·`speaker.js`·`text/columns.js`·`review.md`·`dev/`. 변이로만 잠깐 바꾼 범위 밖 파일(`notes/annotations.js`·`ui/notes.js`·`text/columns.js`·`ui/links.js`)은 읽어서 쓰기로 복원, `cmp`·`git status` 무변.

## 2. 항목별

### 1. 복습 키 — 고침
- `gradeKeyIndex(ev)`: `ev.key` 가 한 글자이고 `1١۱`·`2٢۲`·`3٣۳`·`4٤۴` 중 하나면 그 자리, 아니면 `ev.code` `Digit1`–`4`·`Numpad1`–`4`, 아니면 -1. key 가 숫자면 key 가 먼저(`2` + `Digit1` → 1).
- headless(360·412 × 4언어): ar `key:'١'` · fr `key:'&', code:'Digit1'` · ko·en `1` 모두 [다시](again 1·다음 카드). HEAD ar `١` → 반응 없음(10초 기다림 끝).

### 2. 시험일 당일 — 고침
- `planFor`(순수, 범위 밖)는 그대로(당일 = `past`, `calendarDays` 0). 화면이 `viewStatus` 로 `today` 를 가른다 — 필요·호출·오늘 줄은 past 와 같이 없음.
- 정렬: `sortExams` 가 당일을 "앞으로" 쪽에(오늘 = 0). 서재 "오늘" 줄 `ex.today` → `library.todayExam.today`.
- 요일 칩: `dayChipLabels(lang)` — `short` 가 모두 4자 이하면 그대로, 아니면 일곱 모두 `narrow`(ar «ح ن ث ر خ ج س» — 서로 다름). `aria-label` 은 그대로 `long`.
- headless:

| 판 | 서재 줄 시험 | 계획 카드 순서 · 당일 상태 | ar 요일 칩(412) |
|---|---|---|---|
| 지금 360·412 × 4언어 | 당일 시험 · "오늘" 문구 · data-days 0 | 당일 먼저 · `today` · 문구 = `planner.status.today` | 한 글자 · 모두 한 줄 · 넘침 0 |
| HEAD 412 ko·ar | **다음 주 시험**(당일이 밀림) | 다음 주 먼저 · **`past`**("지났습니다") | «الأربعاء»·«الخميس»·«الجمعة» **두 줄** |

### 3. 19 링크만 — 고침
- 한 줄: `{id:'openi', name:'Open-i (NLM)', url:'https://openi.nlm.nih.gov/gridquery?q={q}&it=x', check:'unverified'}`. 기본 목록(18-D3) 무변 — 설정 [추천 링크 추가]에서 넣는다.
- headless 8판형: 추천 목록에 Open-i 줄 · 호스트 `openi.nlm.nih.gov` · 배지 `links.suggested.unverified` · 넣은 뒤 리더에서 낱말 선택 → `[찾아보기]`(목록 5개) → Open-i → 가로챈 `<a>` = 호스트 `openi.nlm.nih.gov` · `_blank` · `noopener noreferrer` · `no-referrer`. 바깥 요청 0(새 탭은 열지 않고 기록만 — 하네스). 의료 안전 고지는 18 그대로(무변).
- 화면 `[⋯]` 의 `[Open-i 에서 열기]` 단추는 만들지 않았다(spec 3 표의 19-1 몫·`selbar.js` 범위 밖) — 18 `[찾아보기]` 로 연다.

### 4. `isNoTrTerm` 한 벌 — 고침
- `ranged` 의 `!(c.kind === 'term' && !clean(…))` → `!isNoTrTerm(c)`. 차이: 번역 칸이 글자가 아닌 값(숫자 0 등)이면 앞 판은 "빈 것", 이제 `queue` 와 같이 "있음"(실제 레코드에 없는 꼴).

### 5. 영어 값 — 부분
- 고침: fr `nav.back` «Retour» · `common.cancel` «Annuler» · `library.card.delete` «Supprimer»(삭제 대화가 «Annuler»/«Delete» 로 섞이지 않게 같이) · ko «뒤로»·«취소»·«삭제». fr 값 `[검토 — Nour·운영자]`. headless: 서재 삭제 대화 단추가 fr·ko 에서 그 언어(HEAD ko «Cancel»/«Delete»).
- **못 함 — 분 한도 문구 5화면**(단어장·단어 시트·저장한 요약·복습 묶음·개념도): 문구는 각 화면 JS(`ui/vocab.js`·`wordsheet.js`·`summaries.js`·`review.js`·`diagram.js`)가 상태 코드로 고른다 — 지침 수정 범위(`cards`·`planner`·`library`·`config`·`srs/cards`·i18n) 밖이라 손대지 않았다. i18n 키(`readalong.blocked.rateWait/rateReady`)는 이미 있다. 다음 묶음에서 다섯 파일을 범위에 넣으면 각 몇 줄.
- **en 과 글자가 같은 값**(고친 뒤 — `bp5/scripts/samekeys.mjs`, 전체 목록 `bp5/same-after.json`):

| 언어 | 같은 값 | 그대로 둘 것(고유명·약어·기호·주소) | 고칠 것 | 많은 묶음 |
|---|---|---|---|---|
| ko | 113(고치기 전 116) | 23 | **90** | `library.card` 10 · `reader.typeset` 9 · `library.import` 8 · `onboarding.consent` 7 · `onboarding.start` 5 · `reader.theme` 5 · `reader.page` 4 · `err.*` 7 · `about.*` 5 · `nav.*` 5 · `common.*` 3 · 그 밖 |
| fr | 154(고치기 전 153 — 새 `{n} min`·`{n} h` 범주 키 4) | 31 | **123**(단위 약어 `cards.span.min*` 3 빼면 120) | ko 와 같은 묶음 + `quiz.*` 6 · `anno.*` 4 · `notes.*` 3 · `planner.*` 3 · `diagram.*` 2 · `voice.*` 2 등 |
| ar | 7 | 7 | 0 | — |

  210여 값은 "각각 작게"를 넘어 고치지 않았다 — 번역 묶음(Nour·운영자 검토)으로 넘긴다.

### 6. 시험 틈 — 메움(tests/ 만)
| 틈 | 시험 | 변이(전엔 초록) → 지금 |
|---|---|---|
| 15-2eR W2·W4 | `grounding-15` Q12 — `편두통 … 3〜4시간 …`·`… 10^+3 per plate …`(끝 `…3`·`…10` · 가운데 시작 · 덩어리 전체 통과) | M6a `NUM_JOIN` 에서 `〜` 뺌 → **빨강 Q12** · M6b `EXP_SIGN` 에서 `+` 뺌 → **빨강 Q12** |
| 20-3R r1 | Z6a — 주입 db 로 셋째 쓰기 실패 → 하나도 안 옮김 · 정상 6 · 살아 있는 문서·다른 PDF 그대로 | M6c 옮기기를 트랜잭션 밖 `db.put` → **빨강 Z6a** |
| 20-3R r3 | Z6b — `doExport` 가 `visibleRows()`(정적) + 거르기 → 책 → Markdown 같은 길(노랑만·고아만·쪽 범위) | M6d 보이는 줄 대신 `scopedRows()` → **빨강 Z6b** |
| 20-3R r5 | Z6c — 찾히는 조각이 **앞**·사라진 조각이 뒤인 묶음 → 고아 아님 · 둘 다 사라지면 고아 | M6e 마지막 조각만으로 → **빨강 Z6c** |
| 8qbR #5 | Z6d — 3단 합성 퍼즈 400쪽(섞인 밴드 ≥ 60 · 상자 · 인용구 · 제목, 시드 고정) — 줄 수 = 아이템 수 · 아이템 글자 다중 집합 보존 · 줄 id 겹침 0 · 빈 줄 0 | M6f V4(섞인 밴드 두 단 덩어리 안 붙임) → **빨강 Z6d** + C3-15 |
| P4cR R7 | Z6e — 링크 A 삭제 대화 → `leaveLinksSettings()` → 닫힘 · `cancel` 이벤트 1 · 지움 0 · 리스너 0 · 돌아와 B → `la,lc` | M6g `cancelOpenDialog()` 뺌 → **빨강 Z6e** |

### 6b. 서재로 돌아왔을 때 초점 — 고침
- `showLibrary` 끝(`focusPending` 다음)에 `focusLanding` — 초점이 BODY 이거나 숨은 화면 안이면 첫 카드의 첫 단추([계속] · PDF 필요 카드면 [PDF 가져오기]), 카드가 없으면 서재 [PDF 가져오기]. 보이는 곳에 있으면 그대로. **앱을 연 첫 화면이 서재면 옮기지 않는다**(`hashchange` 가 한 번이라도 있어야 — 부팅 때 포커스 고리가 뜨지 않게).
- headless 8판형: 부팅 BODY(그대로) → `#/settings` → 진짜 뒤로가기 → 첫 카드 `[계속]`. HEAD → BODY.

### 7. "필기·요약 n건" — 고침
- `noteUnits(docId)` = 필기 묶음 수(`annotationStore().count`) + 요약·개요 건(`summaryStore().count`). `importFile` 이 붙이기 전후 차이를 `reattachShown(moved, before, after)` 로 — 차이 0 이하(셈 실패)면 레코드 수, 옮긴 수보다 크면 옮긴 수. `reattach`(범위 밖) 무변.
- headless(412·360 ko — 묶음 2조각 + 1조각 + 요약 = 레코드 4): 지금 "**3건**" · HEAD "4건". node Z7: 레코드 8 → 5건.

### 9. 단위 토큰 — 고침
- `unitAfter`: 앞 글자도 글자이고 둘의 글자 체계가 다르면(라틴·그리스 한 묶음 / 키릴 / 아랍 / 히브리 / 한글 / 한자·가나 / 타이 / 데바나가리, 목록 밖 −1 은 끊지 않음) 끊는다. `/` 바로 뒤는 끊지 않음(`mg/kg/일` 통째 — `mg/kg` 와 같아지면 하루 몫 빠진 라벨이 통과).
- 16-2 Review 라벨 하네스 두 벌 사본(`bp5/scripts/labels.mjs`·`labels2b.mjs` — `r16-2/` 읽기만, 앱 경로 인자):
  - labels2b(40꼴): HEAD 정당 버림 7 → **5**(조사 붙은 `mg을`·`mEq/L로` 두 꼴 통과) · **LEAK 0 → 0**.
  - labels(55꼴): HEAD 와 출력 바이트 같음 · LEAK 3 → 3(앞서부터 있던 `2,500`↔`2500` · 낱말 범위 둘 — 이번 범위 밖, 새로 생긴 통과 0).
- 15 하네스 7벌(`bp5/scripts/h15.mjs` — `r16-2/h15.mjs` 사본, HEAD = `bp5/head` git archive): **7/7 출력 바이트 같음**.

### 8. 간격 단위 복수 — 고침
- `spanText`: `Intl.PluralRules(UI 언어).select(n)` 범주 키(`cards.span.<단위>.<범주>`)가 있으면 그것, 없으면 기본 키. 4언어 같은 키 집합(I1) — ko·en 은 기본 값과 같은 값.
- ar: 3–10 `few` «دقائق·ساعات·أيام·أشهر·سنوات» · 11–99 `many` «دقيقة·ساعة·يومًا·شهرًا·سنة» · 1·2·100+ 기본 키. fr: 2 이상 `year` «ans»(1 «an»). headless ar: 단추 아래 «10 دقائق»·«4 أيام»·«8 أيام»·«10 أيام»(HEAD «… دقيقة»·«… يوم»). ar 2(dual) «2 يوم» 는 그대로 `[검토 — Nour·운영자]`.

## 3. 검증

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2065/2065 × 2회**(fail 0, 13.3 · 13.2초 — 2051 + Z 14). `bp5/test-run1.txt`·`test-run2.txt`. 고치기 전 기준 2051/2051(`test-base.txt`).
- stamp 다시(단독) → `--check` "그대로다(모듈 106개 · CSS 4개)" · `git diff --check` 0 · `.nojekyll` 있음(0바이트).
- 특수 글자 수(`bp4/chars.mjs` 그대로 — NBSP·NNBSP·ZW*·LRM/RLM·방향 제어·BOM·SHY·LSEP·제어 문자·글자 그대로의 `\u`/`\x`): 바뀐 앱·시험·spec 15파일 **모두 HEAD 와 같음** · 새 `polish-5.test.mjs` 0(줄 열쇠 구분자는 `String.fromCharCode(1)`).
- 요청 본문 바이트(`bp5/scripts/bytes.mjs` — `bp4/bytes.mjs` 사본, HEAD = `bp5/head`): 낭독 동반·탭·단어·요약·개요·설명·출제·개념도 **8종 모두 같음**.
- headless `bp5/run-ui.mjs`(Edge · pipe · 새 프로필 `bp5/pA1`·`pB1`·`pH1` 한 번에 하나 · 가짜 키 · 흉내 Gemini · 캐시 끔 · 서버 없음(가로채기) · 합성 PDF `b11-2/syn.pdf`): 360×740·412×915 × ko·en·fr·ar + HEAD 412 ko·ar 대조. 계획(당일·칩) · 서재 "오늘" 줄 · 복습(키·간격) · 링크 추천·찾아보기 · 돌아옴 초점 · 삭제 대화 · 회귀(12-3 범위 화면 `#/cards/:doc/1-2` 카드 뜸 · 20-3 필기 화면 · 내보내기 Blob 1) · 다시 가져오기 상태 줄. **Gemini POST 0 · 콘솔 오류 0 · 페이지 오류 0 · 바깥 요청 0 · 가로 넘침 0**(계획·카드·링크·서재). 결과 `bp5/ui-412.json`·`ui-360.json`·`ui-head-412.json`.
- 스크린숏(`bp5/shots/`): `planner-today-360x740-ar.png`(당일 "الامتحان اليوم.") · `planner-chips-360x740-ar.png`(한 글자 칩) · `cards-back-360x740-ar.png`(«10 دقائق»·«4 أيام») · `links-suggest-412x915-ko.png`(Open-i [확인 필요]) 외 8장.

### 변이 18개(`bp5/scripts/mut.mjs` — 정확히 1곳 · 바뀜 확인 · 전체 시험 · 백업 `bp5/bak/mut/*.orig` 를 읽어서 씀)

| # | 변이 | 빨강(stamp IM2·IM6·IM7b 는 어떤 편집에도 빨강이라 뺌) |
|---|---|---|
| M1 | 복습 키에서 아랍-인도·페르시아 숫자 뺌 | Z1 |
| M2a | 정렬을 옛 판(`>`)으로 | Z2 · P2 |
| M2b | 당일 갈래 없음 | Z2 |
| M2c | 요일 칩 늘 short | Z2 |
| M3 | Open-i 주소에서 `&it=x` 뺌 | Z3 |
| M4 | 범위 화면이 번역 빈 단어를 거르지 않음 | Z4 · V5b |
| M5 | fr `common.cancel` 영어로 | Z5 |
| M6a·M6b | W2 · W4 | Q12 · Q12 |
| M6c–M6g | r1 · r3 · r5 · V4 · R7 | Z6a · Z6b · Z6c · Z6d(+C3-15) · Z6e |
| M6h | 돌아옴 초점 늘 그대로 | Z6f |
| M7 | 상태 줄 수 = 레코드 수 | Z7 |
| M8 | 간격 복수 범주 키 안 씀 | Z8 |
| M9 | 단위 토큰 글자 체계 끊기 없음 | Z9 |

- 18/18 빨강 · 복원 18/18 `Buffer.compare` 같음 + `cmp` 10파일 같음 · 끝에 stamp `--check` 그대로.

## 4. 남은 문제 · 운영자 몫

1. **(못 함) 분 한도 문구 5화면**(단어장·단어 시트·저장한 요약·복습 묶음·개념도) — 범위 밖 파일. 다음 묶음에서 `ui/{vocab,wordsheet,summaries,review,diagram}.js` 를 범위에 넣을 것.
2. **en 과 같은 값 ko 90 · fr 120** — 번역 묶음으로(Nour·운영자 검토). 목록 `bp5/same-after.json`.
3. `[검토 — Nour·운영자]`: fr «Retour»·«Annuler»·«Supprimer»·«L’examen a lieu aujourd’hui.»·«Examen {name} : aujourd’hui» · ar «الامتحان اليوم.»·«امتحان {name}: اليوم» · ar 간격 few·many 꼴 · ar 2(dual) «2 يوم» 그대로 · fr «{n} ans».
4. 19: `[⋯]` `[Open-i 에서 열기]` 단추·사례 이미지 화면은 19-Q1 결정 뒤(19-1). 지금은 사용자가 추천에서 넣어야 보인다(기본 목록 무변 — 18-D3).
5. 16 라벨 하네스의 앞서부터 있던 통과 3꼴(`2,500`↔`2500` · `3 to 5 days`→`5 days` · `3에서 5일`→`5일`) 그대로(crossstep 16 줄).
6. (관찰 — HEAD 부터) 계획 요일 칩 줄 끝 칩이 남은 폭만큼 늘어난다(412: 마지막 한 칩 346px · 360: 두 칩 145px) — `screens.css`(범위 밖) flex 규칙. ar 칩 글자는 이제 한 글자라 꺾임은 없다.
7. (관찰 — HEAD 부터) ar 계획 카드 "0 يومًا … · 0 يوم دراسة" 등 `planner.days` 의 수 꼴은 이번 범위(12-3 간격) 밖.
8. 서재 상태 줄 "Imported: syn …" 의 ko `library.import.done` 이 영어(2번 목록 안).
9. (알림) `.claude/tasks/medreader-handoff.md` 가 작업 트리에서 바뀌어 있다(+8줄) — 내가 건드리지 않았다(오케스트레이터 쪽으로 보임). 커밋 때 따로 판단.

## 5. 커밋할 것(운영자가 할 때)

- 앱: `index.html` · `js/config.js` · `js/i18n/{ko,en,fr,ar}.js` · `js/text/numexpr.js` · `js/ui/{cards,library,planner}.js` · `spec.md` · `tests/polish-5.test.mjs`(새) · `tests/{cards-ui-12,grounding-15,links-18,planner-ui-13}.test.mjs`
- `.claude/tasks/medreader-build-polish5{,-report}.md`
- 커밋하지 않을 것: `.codex/`·`AGENTS.md`·`medreader-status-2026-11-02.html`(`git add -A` 금지). `medreader-handoff.md` 는 위 9. `.nojekyll` 그대로. 프로필 `bp5/p*` 는 `rm -rf` 금지라 남김.

## 5b. Review(P5R) 뒤 — 9번 되돌림 · 낮음-2·3 시험 틈 (2026-11-18)

review.md "다듬기 5 Review" 판정 "고친 뒤 배포"와 오케스트레이터 결정(9번 되돌림 — 안전 쪽) 뒤. 같은 범위·규칙, 커밋 0, 권한 거절 0, 백그라운드 0, 요청 0.

### 9번 되돌림(P5R 중간-1)
- `js/text/numexpr.js` 를 **12c245b 판과 바이트 같게**: `git show 12c245b:…` 로 읽어 그대로 쓰는 스크립트(`bp5/scripts/revert-numexpr.mjs` — checkout/restore 안 씀) → 쓴 뒤 `Buffer.compare` 같음 · `git diff 12c245b -- numexpr.js` 0. 고치기 전 판 백업 `bp5/bak5b/numexpr.js`.
- 이유: 붙여 쓴 비교 낱말까지 잘려 방향이 뒤집힌 라벨(`5 mm이상`→`5 mm이하` · `70 mg/dL미만`→`초과` · `5 mg以上`→`以下`)이 새로 통과했다. 정당 버림 7→5 이득보다 무겁다.
- 시험 Z9 를 "끊지 않음"으로 바꿈: 단위 토큰 `mg을`·`meq/l로`·`mm이상`·`mg以上` 그대로 · `numexpr.js` 에 끊기 코드 없음 · **세 꼴 버림** 단언 + 같은 꼴은 통과(버림이 방향 때문임) · 조사 붙은 라벨은 다시 정당 버림(보수 쪽).
- spec 17-14 정정 줄을 `[정정 2026-11-18 — 다듬기 5 · 5b 되돌림]` "되돌림(이유)" 문장으로 바꿈. 위 1절 표·2절 "9. 단위 토큰 — 고침"은 **되돌림으로 읽을 것**(커밋 목록에서 `js/text/numexpr.js` 빠짐).

### 낮음-2·3 시험 틈 — 메움(tests/ 만)
- Z1 에: `onKey` 의 입력 칸 가드(`input`·`textarea`·`select`·`isContentEditable`)가 있고 `gradeKeyIndex(ev)` 보다 **먼저** · 대화 열림 가드 · 수식 키 가드.
- Z6f 에: `focusLanding` 첫 줄이 `if (!navigated || !els || …) return;` · `let navigated = false;`.

### 하네스 · 점검
| 확인 | 결과 |
|---|---|
| `labels2b`(r16-2 사본) | 출력이 HEAD 판 출력과 **`cmp` 같음**(ok 33 · LEAK 0 · 정당 버림 7) |
| `labels`(r16-2 사본) | HEAD 출력과 **`cmp` 같음**(LEAK 3 — 앞서부터) |
| `rp5/labels5.mjs` 사본(28꼴, HEAD·지금) | head `{ok 18, leak 1, drop 9}` = wt 같음 · **새 LEAK 0** · `mm이상`·`mg以上` 단위 토큰 HEAD 와 같음(남은 LEAK 1 = 띄어 쓴 `5 mm 이상`→`이하` — HEAD 부터) |
| 15 하네스 7벌 | **7/7 출력 바이트 같음** |
| 변이 M10(P5R M3 — `onKey` 입력 칸 가드 뺌) | **빨강 Z1**(전엔 초록) |
| 변이 M11(P5R M4 — `navigated` 검사 뺌) | **빨강 Z6f**(전엔 초록) |
| 복원 | 2/2 `Buffer.compare` 같음 + `cmp` 같음 |
| 전체 시험 | **2065/2065 × 2회**(`bp5/test5b-run1.txt`·`run2.txt`) |
| stamp | 다시 찍음(단독) → `--check` "그대로다(모듈 106 · CSS 4)" |
| `git diff --check` | 0 |
| 특수 글자 | 바뀐 앱·시험·spec 파일 모두 HEAD 와 같음 · `numexpr.js` 는 HEAD 와 같아 목록에서 빠짐 · 새 시험 0 |

- 바뀐 파일(5b): `js/text/numexpr.js`(HEAD 로) · `tests/polish-5.test.mjs`(Z1·Z6f·Z9) · `spec.md`(정정 줄 하나) · `index.html`(stamp).
- (알림) 작업 트리의 `review.md`·`.claude/tasks/medreader-crossstep-notes.md`·`medreader-handoff.md`·`medreader-review-polish5.md` 변화는 내가 만든 것이 아니다.
