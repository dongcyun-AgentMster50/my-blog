# 보고 — 20-3 Build: 필기 화면 `#/notes` · 내보내기 · 다시 붙이기 (+ 20-2R 고침) (2026-11-17)

지침: `.claude/tasks/medreader-build-20-3-notes-screen.md` · 설계: spec 17-16(6 · 7 · 8 표 20-3 행 · 9 "20-3" · 10 권장안 20-D11·D12·D13 · 12 적기만 · 13).
**커밋하지 않았다.** 호출 0 · DB 버전 3 · 판본 상수 불변(`ANNO.*`·`algoVersion`·`PROMPT_VERSION` 무변).
스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b20-3\`.

## 0. 먼저 고친 것 — 20-2 Review

| # | 고침 | 확인 |
|---|---|---|
| **#1** 음성 "표시"가 묵은 설명 `was` 로 재개 | `notesheet.createExplainHold(isOpen)` — 단추 [설명]의 `was` 를 **그 띠 번호와 함께** 든다(`before(st)` → ask 가 연 띠 번호 → `after(id, was)`). `inheritWas` 는 셋째 인자가 함수면 `isOpen(held.id)` — **그 띠가 열려 있을 때만** 잇는다(ask `inherit` 와 같은 꼴, 번호 없으면 잇지 않음). controls 는 `trband.openNote` 를 만든 자리에서 감싸 연 번호만 엿본다(띠 동작 무변 · ask 주입 `band: trband` 그대로) | 새 V2 시험 = Review 재현 장면(읽는 중 [설명] → 재개 → 손 멈춤 → 음성 «اشرح»(다른 띠 열림) → «علّم» → **paused**). 옛 꼴(불리언)이면 speaking 이었음을 같은 시험이 단언. 변이 m5 → V2 빨강 |
| **#2** 문단 넘는 선택의 메모 중복 | 서비스 `create` 가 메모를 **대표(첫 레코드 = group)에만**, 다른 조각은 빈 메모. 옛 중복은 필기 화면 `rowsOf` 가 하나로(대표 → 없으면 처음 찾은 메모 한 번), 쪽 시트 `groupRows` 는 원래 하나 | headless: 문단 3개에 걸친 메모 → 레코드 3 · 메모 1(대표) · 필기 화면에 그 메모 1번. D3 · 변이 m4 → D3 빨강 |
| **#3** 쪽 칩 셈 | `count` 가 **묶음 수**(같은 group = 1, 고아 포함 — 시트와 같음). 칩·삭제 확인 "필기 n"·필기 화면 줄이 같은 셈 | headless: 레코드 6 · 칩 "3" · 시트 줄 3. D3(`count(doc, page) === groupRows(placed).length`, 고아 포함) · 변이 m3 → D3 빨강 |
| **#7** «علم» 오탐 | 표 `exact: ['علم', 'mark']`(Review 권장 + "question mark"·"mark twain" 같은 까닭으로 영어 "mark" 도) `[검토 — Nour·운영자]` | V3: «علم الأمراض»·«علم الأدوية»·«علم التشريح»·«علم وظائف الأعضاء»·"question mark"·"mark twain" → null · «علّم»·«علم»·«علّم الجملة»·«علّم من فضلك»·«ظلل»·«ظلّل الجملة»·«تظليل»·"mark"·"mark this"·"Mark." → mark · 9b 전수(다른 12 명령 동의어 그대로) · C3 무결성 통과 |
| #4 되돌리기 한 단계 (작아서 함께) | `mergeGone` — 3초 안에 또 지우면 [되돌리기]가 앞 것까지 함께 되살린다(쪽 시트 · 필기 화면 같은 규칙) | D4 |
| #5 선택 줄 기존 칸 시험 (작아서 함께) | `selbar.paintButtons` 를 내보내고(동작 무변) 가짜 DOM(필기 줄이 첫 자식)으로 숨김·흐림·안내가 제 칸에 가는지 | SB · **Review 변이 r1 → SB 빨강**(전에는 살아남음) |

## 1. 설계 뒤 바뀐 것 — 판단

- **20-1R #6 / db.js**: 지금 `keepsOnDocDelete(rec, 'annotations')` 가 **스토어 전체 true** — 이미 남김. 설계 "`CASCADE_STORES` 에서 뺌 −1" 은 옛 사실이라 **db.js 는 고치지 않고** 시험으로 고정(D1: 문서 삭제 → 필기 3 + 요약 1 모두 남음, 연쇄 `pages` 는 지워짐). spec 에 그대로 적음.
- **11 요약·개요 `fileHash`**: `notes/summaries.js:89·183` 에 이미 사본(있을 때만) → `reattach` 가 요약·개요도 함께 옮긴다(D2 — 요약 레코드도 새 문서로). 남은 문제 없음.
- 12-3 `keptLine`: `deleteKeepLines` 에 "필기 n" 조각(요약 다음), `deleteKeepCounts` 에 `notes`(묶음 수). 확인 문장 "… · 필기 n건은 남습니다".
- 라우터 꼴: 13-2·12-3·11-3 와 같은 `notesHash` · 새로고침·뒤로 그대로(headless). 서재 카드 `[⋯]` "이 책의 필기"(이 책 복습 다음).
- 20-2 쪽 필기 시트에 "이 책 필기 모두"(`#pnAll` — href 를 그 책으로).
- 내보내기는 11-3 과 같은 장치(BOM · CRLF · `clean` · Blob + `<a download>` + 30초 뒤 `revokeObjectURL`). `exportText` 자체는 요약·개요 종류만 받아 그대로 쓰지 않고 Markdown 함수(`exportMarkdown`)를 따로 — 화면 한 줄 "교과서 문장 인용이 들어 있습니다 — 공유에 주의하세요".

## 2. 바꾼 것

| 파일 | 무엇 |
|---|---|
| 새 `js/ui/notes.js` | ① 순수: `rowsOf`(묶음 한 줄 · 대표 메모) · `posOf` · `filterRows`(색 넷 + 색 없는 메모 · 메모 있는 것 · 위치 못 찾은 것 · 쪽 범위) · `isLost` · `viewBooks`(책 → 장(11-3 `chaptersOf` — 개요 맨 위 깊이) → 쪽 → 쪽 안 자리) · `scopeOptions` · `exportMarkdown`·`memoLines`·`exportName` ② 흐름: `loadPageDesc`·`findLost`(쪽 저장본 → `resolve` **읽기만**, 20-D6 고쳐 쓰기 없음) · `createNotesFlow`(메모 저장 대표만 · 색 없는 메모 빈 글 = 지움 · 지우기·되살리기) ③ 화면: 책 고르기 · 범위 줄 · 거르기 칩 7 · 줄(색 점 · 인용 `dir=ltr` · 메모 `dir=auto` · 쪽 라벨(· 위치 못 찾음) · [원문으로]·[메모]·[삭제]) · 고아 책 `docTitle` 묶음 + "PDF 를 다시 가져오면 다시 붙습니다" · [원문으로] = `annotate.onPainted`(20-2 남은 6 의 구독을 씀) → `revealLine`, 못 찾으면 `revealTop` + 배너 · 메모 대화(위에 붙임 · 단추 줄 sticky · `visualViewport` 키보드) · 삭제 확인 `<dialog>` · [되돌리기] 3초 · 내보내기 · 측정 훅 `__medreader.notesScreen.state()`(글 없음) |
| 새 `tests/notes-ui-20.test.mjs` | 13 시험(R1 · P1–P3 · E1 · D1–D6 · SB · S1) |
| `js/router.js` | `notes` 화면 · `#/notes[/:docId[/:a-b]]` · `notesHash(docId, range)` |
| `js/main.js` | `initNotes`·`showNotes`·`leaveNotes` 배선(+4) |
| `js/ui/library.js` | 카드 `[⋯]` "이 책의 필기" · 삭제 확인 "필기 n" · 가져오기 끝에서 `annotationStore().reattach(doc.fileHash, doc.id)`(documents 읽고 annotations 고치는 한 트랜잭션 — 세 갈래 공통, 붙은 수를 상태 줄에) |
| `js/notes/annotations.js` | #2 대표에만 메모 · #3 `count` 묶음 수 · `groupKey` |
| `js/ui/notesheet.js` | #1 `inheritWas`(띠 번호)·`createExplainHold` · #4 `mergeGone` · "이 책 필기 모두" href(router import) |
| `js/ui/controls.js` | #1 `explainHold`·`lastNoteId`(openNote 감쌈) — 다른 동작 무변 |
| `js/ui/selbar.js` | #5 `paintButtons` 내보냄(본문 무변) |
| `js/voice/commands.js` | #7 `exact: ['علم', 'mark']` |
| `index.html` | 필기 화면 섹션 · 쪽 시트 `#pnAll` · stamp |
| `css/screens.css` | 필기 화면 · `.page-notes .pn-all` — 논리 속성만, 48px, 낮은 화면 인용 높이 |
| i18n 4개 | 37키(`notes.*` 33 · `anno.page.all` · `library.card.notes` · `library.card.deleteConfirmNotes` · `library.import.reattached`). ar·fr `[검토 — Nour·운영자]` |
| `tests/annotate-ui-20.test.mjs` | S1 notesheet import 목록에 `../router.js` · V2 재현 장면 시험 1개 더함 · V3 exact·오탐 닫힘 단언(옛 "남는 오탐" 단언 1줄을 바꿈) |
| `tests/router.test.mjs` | R1 도달 목록에 `notes`(파일 안 NUL 글자 — 의도된 시험 입력 — 때문에 Edit 대신 `b20-3/edit-router-test.mjs` 로 정확히 한 곳만 바꿈, NUL 보존) |
| `spec.md` | 17-16 §6 끝 `[정정 2026-11-17 — 20-3 Build]` 한 줄(20-1R #6 사실 · 11-D8 문구 → 20-D11 · 셈 · 읽기만 고아 판정 · 내보내기 범위 · 라우트 · 20-2R 고침) |

`db.js`·`ai/*`·`backup/*`·`text/*`·`speaker.js`·`reader.js`·`voice.js`·`annotate.js`·review.md·`dev/` 무변.

## 3. 수용 기준 "20-3"

| 기준 | 결과 |
|---|---|
| `[D]` `#/notes/:docId` 장·쪽 순 · 거르기 · [원문으로] → 편안 영역 안 · 고아 → 쪽 처음 + 한 줄 | ✔ h1(412×915 ko): 쪽 시트 "이 책 필기 모두"(48px · href 그 책) → `#/notes/:docId` · 줄 5 · 장 머리 2(Part A p.1–2 · Part B p.3–) · 쪽 순 [2,2,2,2,3] · 고아 1 표시. 칩: 노랑 1 · 노랑+분홍 2 · 색 없는 메모 1 · 메모 있는 것 2 · 위치 못 찾은 것 1(aria-pressed) · 모두 5 · `#/notes/:id/3-3` → 1 + 범위 줄 → [모든 쪽] 5. [원문으로](파랑) → 리더 그 줄 **top 345·bottom 440 · 본문 영역 49–777 안 · 중심 비율 0.47**. 고아 → `scrollY 0` + 배너 `notes.lostBanner` |
| `[D]` 문서 삭제 → 필기 남음 · 확인 줄 수 · 같은 PDF 다시 → 붙어 칠해짐 · 다른 PDF → 안 붙음 | ✔ 서재 [삭제] → 확인 문장에 "필기 5건"(묶음 수와 같음) · 레코드 8 → 8 · 문서 없음 · 필기 화면: 고아 책 1 묶음 + 안내 · [원문으로] 0 · 줄 5 모두 "위치 못 찾음". **같은 PDF 다시** → 새 문서에 7 레코드(남은 1 = 시험이 `fileHash` 없이 심은 고아 — 설계대로 안 붙음) · 2쪽 `anno-yellow` 2 · `anno-blue` 1 · `anno-note` 3 칠함 · 칩 3. **다른 PDF** → 그 문서 0, 새 문서 7 그대로 |
| `[N]` 내보내기 BOM·CRLF·`>`·아랍어 메모 그대로·키 0 · `[D]` Blob 줄 수 | ✔ E1(BOM · 외톨이 LF 0 · `#`/`##` · `> 인용` 한 줄 · 인용 다음 빈 줄(게으른 이어짐 막음) · 아랍어 여러 줄 그대로 · 설정의 가짜 키 문자열 0). headless Blob: `text/markdown;charset=utf-8` · BOM 바이트 EF BB BF · CRLF 29 · 외톨이 LF 0 · 줄 29 = 측정 훅 29 · `> ` 줄 5 = 보이는 줄 5 · `##` 2 · 아랍어 메모 있음 · 키 0 · 이름 `medreader-notes-20261117.md` · 공유 주의 줄 보임 |
| 변이(설계 둘 + 고른 것) | 아래 4 — 모두 빨강 |

## 4. 변이 (`b20-3/mut.mjs` — 정확히 1곳 → `cmp` 다름 → 전체 시험 → 백업 `b20-3/bak/m*.orig` **읽어서 씀** → `cmp` 같음)

| # | 변이 | 빨강(뜻 시험) | 복원 |
|---|---|---|---|
| m1 (설계) | `reattach` 의 `fileHash` 비교 지우기(다른 책에 붙음) | **N5 · D2** | 같음 |
| m2 (설계) | "연쇄에 annotations 다시 넣기" — 이미 `CASCADE_STORES` 에 있으므로 같은 뜻의 변이: `keepsOnDocDelete` 의 annotations 남김 줄 지움(db.js — 변이 뒤 복원) | **D1 · D2 · 11-1 D1 · K13** | 같음 |
| m3 (고름) | `count` 를 레코드 수로(20-2R #3 되돌림) | **D3** · D1 | 같음 |
| m4 (고름) | 묶음 메모를 모든 조각에(20-2R #2 되돌림) | **D3** | 같음 |
| m5 (고름) | 띠 번호 안 보고 이어받기(20-2R #1 되돌림) | **V2(새)** | 같음 |
| m6 (고름) | 칸 그리기 `now[i]` → `host.children[i]`(Review r1) | **SB** | 같음 |
| m7 (고름) | 내보내기 LF | **E1** | 같음 |

(모든 변이에서 import map 해시 시험 IM2·IM6·IM7b 도 빨강 — 파일 바이트가 바뀌므로.) 7/7 복원 `cmp` 같음.

## 5. 회귀 · 검사

- **전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회: 1984/1984 · 1984/1984**(13.3 · 13.3초 — `b20-3/test-run1.txt`·`test-run2.txt`. 기준선 1970 + 새 14).
- stamp 다시(단독) → `--check` "그대로다(모듈 98 · CSS 4)" · `git diff --check` 0 · 새·바뀐 줄 `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`confirm(` 0(주석 3뿐).
- 회귀(headless h1): 서재 삭제·가져오기(같은 PDF·다른 PDF) · 12-3 `keptLine`(확인 문장 한 줄에 "필기 n") · 11-3 `#/summaries`·12-3 `#/cards`·13-2 `#/planner`·20-3 `#/notes` 라우트 · 새로고침(같은 책·같은 줄 수) · 뒤로 · 20-2 만들기(색·메모·칩·시트) 그대로. 9c `annotations` 문서 없는 것도 넣기 + 같은 파일 두 번 = 한 번(D6 — fake-idb 종단, `exportBackup`·`importBackup` 무변).
- **h2**(360×740 · 412×915 · 915×412 × ar·en·fr·ko × 전체·책 = 24칸): 가로 넘침 0(scrollWidth 차 0 · 밖 요소 0) · 누를 것 최소 48px · 칩 7 모두 보임·화면 안 · 인용 `dir=ltr`·메모 `dir=auto` · ar 은 `dir=rtl` · 메모 대화 화면 안 · [저장] 48 보임 · **키보드 흉내(보이는 뷰포트 55%) `data-kb` on · [저장] 보이는 뷰포트 안 24/24** · `<img onerror>` 메모·책 제목 → img 0 · `__xss` 없음 · 쪽 시트 "이 책 필기 모두" 48px 화면 안.
- headless 공통: Edge · pipe · 새 프로필 `b20-3/p1`(h1)·`p2`·`p3`(h2 — p2 는 대화 클래스 겹침을 찾은 첫 실행) · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 캐시 끔 · **서버 없음**(가로채기) · 합성 PDF `b11-2/syn.pdf`·`b9c2/syn.pdf`(읽기만) · 한 번에 하나씩. **콘솔 오류 0 · 페이지 오류 0 · 외부 요청 0 · Gemini 요청 0**(h1 41초 · h2 47초).
- 스크린샷 `b20-3/shots/`(6): `notes-ko-412.png` · `notes-all-ar-360.png` · `notes-all-en-360.png` · `notes-fr-915x412.png` · `notes-memo-kb-ar-412.png` · `pn-all-ko-412.png`.
- 하네스: `b20-3/mkcommon.mjs` 가 `r20-2/common.mjs`(25초 다시 올리기 포함)를 읽어 `b20-3/common.mjs` 로(경로·가짜 키 이름만).
- h2 첫 실행에서 찾아 고친 것: ① 메모 대화 클래스 `notes-memo` 가 줄 메모 문단 클래스와 같아 CSS(여백)·측정이 겹침 → `notes-memo-dlg` ② 915×412 에서 [저장]이 대화 안 굴림 아래 → 단추 줄 sticky + 낮은 화면 인용 높이 3em + `visualViewport` 키보드 높이.

## 5-1. 설계와 다른 점 (spec 17-16 §6 `[정정 2026-11-17 — 20-3 Build]`)

① db.js 무변(이미 남김 — 20-1R #6). ② `reattach` 는 가져오기 세 갈래 끝에서 한 번(새 문서만이 아니라 — 9c 로 온 같은 문서를 다시 쓸 때도 고아가 있으면 붙인다). ③ 셈은 묶음 수. ④ "위치 못 찾은 것"은 쪽 저장본으로 읽기만 판정(고쳐 쓰기 없음 — 쓰기는 리더가 그릴 때만), 문서 없는 책은 모두 "못 찾음". ⑤ 내보내기는 **보이는 줄**(책·범위·거르기)만이고 쪽 라벨 뒤에 색 이름. ⑥ 메모 고치기는 리더의 메모 시트가 아니라 필기 화면 안 `<dialog>`(같은 규칙 — 대표에만 · 색 없는 메모 빈 글 = 지움). ⑦ 영어 "mark" 도 `exact`.

## 6. 남은 문제 · Review 에 넘길 것

1. **`fileHash` 없는 필기는 다시 붙지 않는다** — 20-2 부터 만든 레코드는 모두 사본이 있으나, 20-1 배포~20-2 사이 서비스로 만든 레코드(만들기 UI 가 없어 실제로는 0 에 가깝다)·직접 넣은 레코드는 고아로 남는다(화면에 고아 책 묶음으로 보이고 지울 수 있다).
2. "위치 못 찾은 것" 판정은 필기 화면을 열 때마다 **필기가 있는 쪽마다 저장본 하나**를 읽는다(합성 PDF 로만 잼). CMDT 처럼 필기가 수백 쪽에 흩어지면 느릴 수 있다 — 실물 측정 안 함(먼저 그리고 판정 뒤 다시 그리므로 화면은 바로 뜬다).
3. 내보내기 범위(보이는 줄만) · 색 이름 덧붙임은 Build 판단 — 설계 문구는 범위를 정하지 않았다.
4. 키보드는 `visualViewport` 흉내로만 쟀다 — 실기기(아랍어 키보드)에서 필기 화면 메모 대화 [저장]이 보이는지는 실기기 묶음(spec 17-16 12 "메모 쓰기" 줄에 함께).
5. 15 묶음 필기 줄 입구는 15 몫(라우트 `#/notes/:docId/:a-b` 만 준비 — 시험됨).
6. «علم»·"mark" `exact` 로 잃는 꼴: «علّم هذه»·«علم هنا»·"mark it" 같은 두 낱말 꼴(쓰일 꼴이면 표에 낱말로 더하면 된다) `[검토 — Nour·운영자]`.
7. 20-2R #6(740×360 compact 에서 `[⋯]` 9칸 중 2칸 메뉴 안 굴림)은 손대지 않음 — 실기기 몫 그대로.
8. 서재 삭제 확인은 여전히 `window.confirm`(12-6 이후 기존 길 — 이 단계 밖, 시험이 그 꼴을 고정).
9. 도구 주의(다음 Build 용): Write 도구가 문자열 안 `\u2028`·`\u2029`·`\uFEFF` 이스케이프를 실제 글자로 바꿔 넣었다(정규식이 깨짐) — `b20-3/fix-escapes.mjs` 로 되돌렸다. 마지막 점검에서 이 스크립트를 spec.md 에도 돌려 **기존 BOM 글자 두 곳(435·4818 줄 — 이 단계와 무관)을 이스케이프 글자로 바꿨다가**, `b20-3/restore-spec-lines.mjs` 로 그 두 줄을 HEAD 줄 그대로 되돌렸다(검사: 되돌린 줄 = HEAD 줄, `git diff --stat` spec.md 는 정정 한 줄 +1 뿐).
10. 실기기(spec 17-16 12 — 적기만): PDF 지움 → 다시 가져오기 → 필기 돌아옴 · 필기 화면 아랍어 메모 대화 키보드 · «علّم» 혼자/문장 속 판정.

## 7. 규칙 준수

명령 한 호출에 한 가지(`cd &&`·파이프·`;` 0 — 시험·stamp 단독, 글로브 꼴) · 서버 0 · 프로세스 조회·디버깅 포트 0 · 커밋·`git checkout/restore/stash` 0 · npm·다운로드 0 · `rm` 0 · `.nojekyll` 그대로 · 진짜 키 0 · 프로필 복사 0 · 원서 문장 인용 0 · 거절된 명령 0 · 표준 입력 대기 0 · 모든 실행 10분 안(가장 긴 것 변이 7개 약 100초) · 백그라운드 작업 0.
