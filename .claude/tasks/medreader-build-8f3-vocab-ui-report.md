# Build 보고 — 8f-3 단어장 화면 · CSV 내보내기/가져오기

> Build 서브에이전트, 2026-11-16. 지침 `.claude/tasks/medreader-build-8f3-vocab-ui.md`, 설계 spec 17-7-6(4-6·5 8f-3 행·6·7·8 "8f-3"·9·10·12 + 그 안의 `[정정 …]` 줄 — 특히 4-6 의 `8f-1 Build` ①·4-5 의 `8f-2 Build`), 8f-1·8f-2 보고서, review.md "8f-1 Review"·"8f-2 Review", crossstep "8f-1 Review 에서 넘긴 것". 운영자 위임(권장안 — 8cf-Q2 는 설계 기본값: 공유 주의 한 줄). **커밋하지 않았다.** 직전 배포 `50d73ee`(8f-2).

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/vocab.js` (새, 915줄 — 설계 추정 약 450의 두 배: 주석·DOM 없는 흐름 2개·측정 훅) | 1절 순수: `scopeEntries`·`viewRows`(찾기·정렬)·`bulkSrc`·`bulkCount`·`bulkPlan`·`changedCount`·`exportName`·`exportFile`·`importCounts`·`rejectSummary`·`rowList`·`editPatch`·`scopeOptions` · 2절 흐름(DOM 없음): `createImportFlow`(read = 계획만 · pick · apply = 고른 것만 한 트랜잭션) · `runBulk`(1호출·`retry:true`·`edited:false`) · 3절 화면: `initVocab`·`showVocab`·`leaveVocab` — 목록·책 고르기·찾기·정렬·[더 보기]·[번역 안 된 것 모두 번역 (n)]·내보내기 고르기(CSV/Anki + 공유 주의 줄)·가져오기 미리보기(새·바뀜·그대로·충돌·거절 + 사유·충돌 고르기)·편집 `<dialog>`·삭제 확인 `<dialog>`·[▶] 원어/번역·[원문 쪽으로 가기]·측정 훅 `__medreader.vocab` |
| `tests/vocab-ui-8f.test.mjs` (새, 18) | 아래 4절 |
| `js/text/vocab.js` | `fieldValue`(내용 값 정규화 한 규칙 — ②) · `fileTimeOf`(CSV 시각 — 이 앱이 쓴 꼴만 — ①) · `importPlan` 이 비교를 양쪽 `fieldValue` 로 · 시각을 못 읽으면 `conflict[]` · `planToApply`(고른 충돌만 change 로) · 메모 정규화에 줄 끝 LF |
| `js/vocab/store.js` | `update` 가 내용 값을 `fieldValue` 로 정규화해 비교·저장(②) · 사용자 수정이 아닐 때 patch 의 `edited`(참/거짓)를 받음(8f-2 남은 문제 2) |
| `js/ui/wordsheet.js` | 단어장 링크 켜기(`#/vocab/:docId`, `countByDoc` 읽기만) · `termServices()`(단어장 화면이 같은 파이프라인을 씀) · 다시 번역 받아들임 → `edited:false` · 8f2R ②(`keepFocus`)·③(상태 줄 안 비움·`#wsAsk` live)·④(질문 중 `retranslate` 무시)·⑩(`wordTailAt`·`endTail`) · 측정 훅에 `link`·`focus` |
| `js/router.js` | `SCREENS` 에 `vocab` · `#/vocab`·`#/vocab/:docId` · `vocabHash` |
| `js/main.js` (+4) | import · `initVocab()` · `leaveVocab()` · `case 'vocab'` |
| `js/ui/library.js` | 카드 [⋯] "이 책의 단어장"(`data-action="vocab"` → `go(vocabHash(docId))`) |
| `index.html` | 서재 상단 [단어장](`data-nav="#/vocab"`) · `<section data-screen="vocab">`(도구 줄·내보내기 판·미리보기 판·목록·편집 `<dialog>`·삭제 `<dialog>`) · 단어 시트: 질문 줄·단추 줄을 번역 칸 바로 아래로(⑦), `#wsAsk` `role=group`·`aria-live`·`aria-labelledby=wsAskQ` · import map 도장(모듈 72) |
| `css/screens.css` (+166) | 단어장 화면(논리 속성만·48px·`overflow-wrap:anywhere`) · 아랍어 UI 에서 원어 칸을 UI 쪽 가장자리로(`:root[dir=rtl] … text-align:end`) · 시트 링크 `.ws-vocab` 48px |
| `js/i18n/{ko,en,fr,ar}.js` | `vocab.*` 76 + `library.card.vocab`(ar·fr `[검토 — Nour·운영자]`) |
| `tests/router.test.mjs` | R1 에 `#/vocab` 도달 한 줄(`SCREENS` 에 `vocab` 을 더해 "모든 화면에 가는 해시"가 하나 늘었다). 파일에 NUL 바이트 1개(R8 의 지어낸 해시)가 있어 Edit 가 거절 → `b8f3/edit-router-test.mjs` 가 바이트를 그대로 두고 그 한 곳만 바꿈(NUL 1개 그대로) |
| `spec.md` | 17-7-6 4-6 끝 `[정정 2026-11-16 — 8f-3 Build]` 한 줄(Edit, 그 자리만) |

불변: `pipeline.js`·`prompts.js`·`provider.js`·`db.js`·`readalong.js`·`trband.js`·`controls.js`·`selbar.js`·`reader.css`·review.md·`dev/`(추적 안 된 `dev/measure-table-8i4.mjs` 포함). 번역 요청 바이트·캐시 키·DB 3·algoVersion·`PROMPT_VERSION` 3·`TERM_PROMPT_VERSION` 1 그대로. **8f-1·8f-2 시험은 한 줄도 고치지 않았다**(뜻이 바뀐 곳 없음 — 기존 1601 그대로 통과).

## 2. 수용 기준 "8f-3"

| 기준 | 결과 | 근거 |
|---|---|---|
| `[D]` `#/vocab`·`#/vocab/:docId` — 목록·찾기·정렬·책 고르기, 줄 48px 이상, 아랍어 UI 360px 가로 스크롤 0, 원어 칸 `dir=ltr` | ✔ | A1(시트 링크 → `#/vocab/:docId`)·A2(412 ko 줄 64px·조작 48px·넘침 0·원어 ltr·번역 rtl ar) · B 412/915/360 ar(넘침 0·화면 밖 요소 0·줄 64px·조작 48px·`html dir=rtl`·원어 ltr 이 오른쪽) · C4(책 고르기 → 해시 바뀜·그 책 목록) · node U16(찾기 NFKC·번역으로도·정렬·지운 책 선택지) |
| `[D]` 편집 → `edited:true`·"마지막 내보내기 뒤 바뀐 항목 1개" · 삭제는 페이지 안 확인 | ✔ | A4(편집 저장 → edited·겹공백 정규화·changed 0 → **1**) · A4-delete(`<dialog>` 열림·첫 초점 [취소]·지움) · node U10 · `confirm(` 0(U17) |
| `[D]` [번역 안 된 것 모두 번역 (25)] → 요청 **1건**(20개), 단추 (5) · 응답 일부 어긋남 → 그 항목만 빈 채 | ✔ | A2(n 25 → term 요청 1·항목 20 → n **5**, 사용자 메모 본문 0) · 어긋남은 node U7(가짜 — 2개 빈 채 → (7) → 다시 누름 1호출 7개)·U9(실제 파이프라인 + 흉내 Gemini — `i` 하나 빠짐 → 그 항목만 안 씀) |
| `[D]` 내보내기 CSV·Anki: 파일 이름·BOM·줄 수 · 그 CSV 를 가져오기 → "새 0 · 바뀜 0 · 그대로 n" · 한 칸 고친 CSV → "바뀜 1" | ✔ | A3(`medreader-vocab-20261116.csv|.txt` 를 **스크래치 `b8f3/dl-*`** 에 받음 — 파일 바이트 EF BB BF·CRLF 27줄(머리+26)·맨 LF 0 · Anki 머리 3줄 + 26 · 키 0) · A5(한 칸 고침 → 새 1·**바뀜 1**·그대로 23·충돌 1·거절 0) · A6(지금 내보낸 것 그대로 → **0·0·26·0·0**, 레코드 변화 0) · node U5·U15 |
| `[D]` [원문 쪽으로 가기] → 그 쪽·그 줄이 편안 영역 안 · 문서가 지워진 항목은 단추 없음·`docTitle` 표시 | ✔(쪽 첫머리 줄은 아래 주) | A7b(쪽 아래쪽 줄 → 화면 높이 0.39, 편안 영역 0.30–0.65 안) · A7(쪽 첫머리 근처 줄 → 굴릴 수 없어 scrollY 0, 보임) · C3(지운 책 → 단추 숨김·출처 줄 `docTitle`) |
| `[M]` 엑셀(데스크톱)에서 CSV 를 열면 아랍어가 깨지지 않는다 | 실기기 목록(8절) | BOM 은 파일 바이트로 확인 |
| 지침: `updated` 를 `dd/mm/yyyy`·빈칸으로 바꾼 CSV → 충돌·기기 값 그대로(고르기 전) | ✔ | node U2·U3(dd/mm·미국식·`2026-11-16 09:00`·빈칸·열 지움 → 충돌, 고르기 전 적용해도 레코드 깊은 비교 같음, 고른 것만 바뀜) · A5(실물 화면 — 충돌 1, 체크 기본 꺼짐, 적용 전후 기기 값 그대로) · B3(ar) |
| 지침: 엑셀식 BOM·CRLF·따옴표·수식 접두 | ✔ | U5(모든 칸 따옴표·`'=SUM(1)`·`'@risk, ""high""` → 그대로 n · 메모 `=SUM(1)` 왕복) |
| 지침: 내보낸 파일에 키 문자열 0 · 문맥 문장 공유 주의 한 줄 | ✔ | U15(가짜 키를 저장소에 둔 채 CSV·Anki 0) · A3(키 0 · 판에 주의 줄) · 4언어 문구 |
| 지침: 호출(6절) — 목록·편집·내보내기·가져오기 0 | ✔ | A 전체 term 요청 2(시트 [AI] 1 + bulk 1)·번역 요청 0 · B 요청 0 · C 요청 0 |
| 공통: stamp `--check` 0 · `git diff --check` 0 · `innerHTML` 새 사용 0 · 콘솔 오류 0 | ✔ | 4·6절 |

## 3. 8f-1 Review · 8f-2 Review 넘김 처리

| 넘김 | 처리 | 근거 |
|---|---|---|
| crossstep ① 못 읽는 `updated` → 충돌(미리보기에서 고름), 기기 쪽 조용히 덮지 않음 | `fileTimeOf`(이 앱이 쓴 꼴만) + `importPlan.conflict` + `planToApply` | U2·U3·A5·B3 · 변이 M1 |
| crossstep ② `store.update`·`importPlan` 같은 정규화 → 그대로 가져오기 = 그대로 n, `edited`·`updatedAt` 불변 | `fieldValue` 한 규칙 — `update` 비교·저장, `importPlan` 양쪽 | U4(정규화 전 옛 레코드도 그대로)·U5·A6 · 변이 M2·M3 |
| crossstep ③ 실패 단어 다시 누름 `retry:true` | bulk 늘 `retry:true`(시트는 8f-2 부터) | U7(다시 누름 → 실패 2개 다시 보냄) · 변이 M6 |
| 8f-2 남은 문제 2 — 다시 번역 뒤 `edited` 남음 | 규칙: 사용자가 받아들인 AI 번역 = `edited:false`(시트 [이 문맥으로 다시 번역]·bulk) — `store.update` 가 비사용자 patch 의 `edited` 를 받음 | U11 · 변이 M8 · spec 정정 ③ |
| 8f-2 남은 문제 3 — 뜻·메모·품사 편집 | 단어장 편집 대화 | A4·U10 |
| 8f2R ② 단추 세트가 바뀔 때 포커스 BODY | `keepFocus` — 질문 → [그대로 두기], 아니면 보이는 첫 단추, 없으면 원어 머리 | A8(Enter → `askNo`, 다시 Enter → `save`)·U14 |
| 8f2R ③ 질문이 낭독기에 안 들림 | 상태 줄 안 비움("단어장에 있는 낱말"), `#wsAsk` `role=group`·`aria-live=polite`·`aria-labelledby`(글은 보일 때 넣음) + 포커스 [그대로 두기] | A8(상태 13자·질문 12자·live)·U14 |
| 8f2R ④ 질문 중 `retranslate()` 재호출 → 묻지 않고 force | 질문 중에는 아무것도 안 함 | U12(호출 0·질문 그대로) · 변이 M7 |
| 8f2R ⑤ 시험 구멍 — [AI] 연타 | 진행 중 공유 없는 가짜로 3연타 → 1번 | U12 |
| 8f2R ⑥ 시험 구멍 — 문맥 바꾸기 patch `docId` | 다른 책 문장 → patch `docId`·`pageNo`·`lineId` | U12 |
| 8f2R ⑦ 915×412 에서 단추가 긴 문장 번역 아래 | 질문 줄·단추 줄을 번역 칸 바로 아래로(위로). **남음**: compact 시트(213px)에서 단추 줄 바닥 231 > sticky [닫기] 윗변 188 — 43px 가림(안 스크롤 한 번). 마저는 `reader.css`(범위 밖) | A9·`b8f3/run-p.mjs` 실측 · 남은 문제 1 |
| 8f2R ⑧ `vs.hint` 와 단어장 화면 | 화면([번역 안 된 것 모두 번역])이 생겨 문구와 맞음 — 그대로 | U14 |
| 8f2R ⑩ 여러 줄 선택 끝이 낱말 가운데 | `wordTailAt` + `endTail`(아직 남아 있는 선택에서만 — 스냅숏엔 끝 줄이 없고 selbar 는 범위 밖) | U13 |

## 4. 테스트

- 고치기 전 기준 1601/1601. 새 시험 18(`vocab-ui-8f` U1–U18) + router R1 한 줄.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **1회차 1619/1619 · 2회차 1619/1619**(`b8f3/full1.txt`·`full2.txt`, 각 약 9.7초).
- `dev/stamp-importmap.mjs` 다시 찍음 → `--check` "그대로다(모듈 72개 · CSS 4개)" · `git diff --check` 0 · 새 파일 줄 끝 공백 0.
- U1 라우트·입구 셋·main 배선 · U2 `fileTimeOf` · U3 ★충돌 · U4 ★정규화·그대로 n · U5 ★바뀜 1·엑셀식 · U6 ★미리보기 먼저 · U7 ★bulk 25→1호출 20→(5)·어긋남·다시 누름 · U8 bulk 문지기·묶음 · U9 bulk 실제 파이프라인 · U10 편집·바뀐 항목 1 · U11 ★edited 규칙 · U12 8f2R ④⑤⑥ · U13 ⑩ · U14 ②③⑦⑧·링크·termServices · U15 ★내보내기·키 0·공유 주의 · U16 목록 순수 · U17 마크업·CSS · U18 i18n·위생·호출 길 하나.

## 5. 변이 (백업 `b8f3/bak/` — `mut.mjs backup` 읽어서 씀 → `apply`(백업을 읽어 찾을 글이 정확히 1곳일 때만) → 전체 시험 → `restore`(백업을 읽어 씀) → `cmp` 0)

import map 해시 시험 3개(IM2·IM6·IM7b)는 어떤 변이에도 빨강이라 셈에서 뺐다(앞 Build·Review 와 같음).

| # | 변이 | 빨강 | 복원 cmp |
|---|---|---|---|
| M1 | ① 못 읽는 `updated` 를 파일 승으로(충돌 없이 바뀜) | **U3** | 0 |
| M2 | ② 정규화 빼기 — `importPlan` 비교 | **U4·U5** | 0 |
| M3 | ② 정규화 빼기 — `store.update` | **U4** | 0 |
| M4 | 수식 접두 방어 빼기 | **C2(8f-1)·U5** | 0 |
| M5 | 미리보기 없이 바로 적용(`read` 가 곧바로 씀) | **U6** | 0 |
| M6 | bulk `retry:false` | **U7** | 0 |
| M7 | 8f2R ④ 질문 중 `retranslate` 옛 동작 | **U12** | 0 |
| M8 | 받아들인 다시 번역에 `edited:false` 빼기 | **U11** | 0 |

8/8 빨강. 마지막 복원 뒤 네 파일 `cmp` 0 → 도장 `--check` 0 → 전체 2회.

## 6. headless (Edge · pipe · 새 프로필 · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 흉내 음성 · 캐시 끔 · 한 번에 하나)

- **A** `run-a.mjs`(412×915 ko, 최종 `a5.json` 47초 — 앞 `pa1`·`pa2` 는 하네스 오류(측정 훅이 부팅 뒤 덮임 → 화면 진입 때 다시 달도록 앱 고침 · Blob 가로채기가 pdf.js Blob 까지 잡음 → 하네스만 고침), `pa3`·`pa4` 는 같은 결과). 단어 시트 [AI] 1호출 → [저장] → 링크 `#/vocab/:docId`(n 1 → [번역 없이 저장] 뒤 2) → 링크로 단어장 → 지어낸 24개 → bulk(25 → 1호출·20 → 5) → 내보내기 CSV·Anki(내려받기 `Browser.setDownloadBehavior` → `b8f3/dl-pa*`) → 편집(edited·바뀐 항목 0 → 1)·삭제(페이지 안 확인) → 고친 CSV(바뀜 1·충돌 1·새 1 — 충돌 기본 꺼짐·적용 전후 기기 값 그대로) → 그대로 가져오기(0·0·26·0·0·변화 0) → [원문 쪽으로 가기](아래쪽 줄 0.39) → 시트 키보드(②③) → 915×412 시트(⑦). 콘솔 오류 0 · pageerror 0 · 4xx 0 · 외부 요청은 pdf.js CDN 둘(기존) · 사용자 글 본문 누출 0.
- **B** `run-b.mjs`(ar UI, PDF 없이 지운 책 항목 12, `b2.json` 12초): 412×915·915×412·360×740 모두 가로 넘침 0·화면 밖 요소 0·줄 64px·조작 48px·`dir=rtl`·원어 ltr(오른쪽 가장자리)·편집 대화 화면 안(915·360 은 대화 안 스크롤)·Esc 로 닫으면 포커스 그 줄 · 미리보기 새 1·충돌 1·거절 2 · 서재 360 [단어장] 48px·넘침 0 → `#/vocab`.
- **C** `run-c.mjs`(서재 회귀 12초): 카드 [⋯] "이 책의 단어장" 48px → `#/vocab/:docId` · 서재 삭제 확인(브라우저 `confirm`) 2줄·"3" 포함 → 문서 0·term 3 남음·문장 카드 지워짐 · 지운 뒤 단어장: "이 기기에 없음" 선택지·[원문 쪽으로 가기] 숨김·출처 줄.
- **회귀**(8f-2 하네스를 `prep.mjs` 로 **읽어** `b8f3/r/` 에 옮겨 씀): `b-run-body`(40쪽 [▶] 8초) 본문 `[2747 B 8f301ea7584678d4, 9426 B 1da11781b23e9ac3]`·항목 [4, 58] — **HEAD 값과 같다** · `run-e2`(412×915 ko — Esc 층·입력칸·Aa·속도·선택 줄·[≡]·검색 화면(작은 PDF)) 8f-2 `e412.json` 과 **0곳 다름**.
- 스크린숏 `b8f3/shots/` 10장: `412x915-ko-{list,edit,import-preview,sheet-saved,gone-book}.png` · `915x412-ko-sheet.png` · `412x915-ar-{list,edit,import-preview}.png` · `915x412-ar-edit.png`(지침 4–6장보다 많음 — 지우지 않음).
- 결과 JSON 에 원서 문장 없음(길이·개수·키·불리언). 지어낸 낱말·흉내 번역만.

## 7. spec 정정 (17-7-6 4-6 끝, Edit 로 그 자리만)

`[정정 2026-11-16 — 8f-3 Build]` 한 줄: ① 못 읽는 `updated` = 충돌(`fileTimeOf` 꼴·`conflict[]`·`planToApply`, 8f-1 정정 ① 은 그대로) ② 정규화 한 규칙 `fieldValue`(네 곳) ③ `edited` 규칙(받아들인 AI 번역 = false, `update` 가 비사용자 patch 의 `edited` 를 받음) ④ bulk 묶음(추가 순·같은 대상·같은 책·≤ 20·`retry:true`·동의 문지기·(n) 세는 법)·같은 파이프라인(`termServices`) ⑤ 화면(목록·200줄·정렬·찾기·책 고르기 `replace`·지운 책·편집 `<dialog>`·원어 겹침 거절·삭제 `<dialog>`) ⑥ 내보내기 = 늘 단어장 전체·공유 주의·revoke 30초·`lastExportAt` ms ⑦ 미리보기 다섯 수·줄 번호·충돌 목록·`createImportFlow`·2MB 먼저 ⑧ [원문 쪽으로 가기](`onPageRender` 한 번 → `revealLine`, 쪽 첫머리 한계) ⑨ 입구 셋·`SCREENS`·router R1 ⑩ 8f2R ②③④⑦(43px 남음)⑧⑩ ⑪ i18n 77키(설계 "약 30"보다 많음).

## 8. 실기기 목록 (spec 17-7-6 12 몫 — 앱 완성 뒤 한 번에, 기다리지 않음)

- `[M]` CSV 내려받기(Android 다운로드 폴더)·엑셀(데스크톱)에서 아랍어·한국어 정상(BOM) · AnkiDroid 가져오기 머리 줄(`[가정 — Anki 2.1.55+]`).
- `[M]` 엑셀(지역 설정별)이 `updated`·`added` 칸을 날짜로 바꿔 저장하는가 — 바꾸면 고친 행마다 "충돌"(고르기 필요). 실제로 몇 개가 충돌로 뜨는지·"모두 파일 것으로"가 편한지(Nour·운영자).
- `[M]` CSV 가져오기 — Android 파일 고르기에서 `.csv` 가 보이는가(`accept` 에 `text/csv`·`text/comma-separated-values`·`text/plain`).
- `[M]` 편집 대화에서 아랍어 자판이 칸·[저장]을 가리지 않는가(세로·가로 — 대화는 `100dvh − 32px`, 안 스크롤).
- `[M]` [▶ 원어 듣기]·[▶ 번역 듣기] — 아랍어 음성 목록이 0개인 기기에서 `ar-SA` 태그로 소리가 나는가(8b-1 실측과 같은 길), 괄호 속 라틴이 빠지는가.
- `[M]` 시트 "이 책의 단어장 (n)" → 단어장 → Android 뒤로 제스처 → 리더(읽던 쪽)로 돌아오는가.
- `[M]` [원문 쪽으로 가기] — 그 줄이 보기 좋은 자리인가(쪽 첫머리 줄은 쪽 맨 위).
- `[M]` 가로(8e compact) 단어 시트 — 단추 줄이 [닫기]에 43px 가리는 정도가 쓸 만한가(남은 문제 1).
- `[M]` 메신저 내장 브라우저에서 내려받기가 막히는가("Chrome 으로 여세요" — 가이드 몫).

## 9. 남은 문제 · 넘길 것

1. **⑦ 가로 compact 시트**: 단추 줄을 번역 칸 바로 아래로 올렸으나 213px 시트에서 원어(26)·상태(20)·번역 칸(라벨 20 + 칸 48)·단추(48)가 231px 까지 내려와 sticky [닫기](188–236)에 43px 가린다 — 안 스크롤 한 번이면 닿는다(전에는 긴 문장 번역 아래). 다 보이게 하려면 compact 에서 라벨을 칸 옆으로·[닫기]를 단추 줄 끝으로 등 `reader.css` 고침이 필요 — 다듬기 후보(범위 밖).
2. 내보내기는 **늘 단어장 전체**다(책 범위에서 눌러도) — `vocab.lastExportAt` 이 하나라 책별 내보내기는 "바뀐 항목 n개"를 흐린다. 판 문구 "단어장 전체 n개" 로 알린다. 책별 내보내기가 필요하면 Nour 반응 뒤.
3. bulk 는 한 누름에 **첫 항목의 책·대상 언어 묶음**만 보낸다(term 키에 책 id 가 들어 시트와 캐시를 나누려고). 전체 범위에서 여러 책 낱말이 섞이면 누름 수가 늘어난다(누름당 1호출은 그대로).
4. i18n 77키(설계 7절 "약 30") — 거절 사유·오류·품사 8·충돌 문구를 따로 둠. ar·fr 78줄 `[검토 — Nour·운영자]`. ar `vocab.scope.doc` 은 en 과 같은 꼴이라 앞에 RLM 을 둠(괄호 수가 RTL 에서 제자리 — I14 "ar 은 en 복사가 아니다" 통과).
5. `js/ui/vocab.js` 915줄(설계 약 450) — DOM 없는 흐름 둘(가져오기·bulk)을 따로 둬 node 로 잰 몫.
6. 8f2R ⑩ 끝 넓히기는 **아직 남아 있는** 브라우저 선택에서만(스냅숏에 끝 줄이 없고 `selbar.js` 는 범위 밖) — Android 에서 단추를 누를 때 선택이 풀리면 예전처럼 끝을 넓히지 않는다. 스냅숏에 끝 줄·오프셋을 더하는 것은 selbar 다듬기.
7. [▶] 는 `speechSynthesis` 를 직접 부른다(리더 낭독기와 따로 — 단어장 화면에 오면 리더는 이미 멈췄다). 첫 누름에 음성 목록이 비어도 `resolveSpeech` 태그로 말한다.
8. 8f1R-8 #4(라틴 약어 `LANG`)·#7(터키어 `İ`)·#8·#9(시험 구멍 RM5·RM6)·#10(`runJob` 기본 인자) 은 그대로 — 8f-3 범위 밖(crossstep 다듬기 후보).
9. ko·fr 의 `nav.back` 등 기존 영어 값은 그대로(기존 다듬기 후보).

## 10. 규칙 · 막힌 명령

- 막힌 명령 0. 진짜 키·외부 호출 0(흉내 Gemini 만). C: 남은 공간 101GB.
- **규칙 어김 1건(자진 보고)**: 첫 전체 시험(`b8f3/run0.txt`)을 `cd /d/01_claude_my-blog && timeout 560 node --test …` 로 묶어 돌렸다(읽기만·결과 정상). 그 뒤로는 절대 경로로 한 호출에 한 가지만(테스트·도장·검사·백업·변이 각각·복원 각각·`cmp` 각각·headless 각각). 파이프 0.
- 커밋 0 · `git checkout/restore/stash` 0 · npm·다운로드 0(앱의 내려받기는 headless 가 스크래치 `b8f3/dl-*` 로만 — 사용자 Downloads 안 씀) · `rm` 0 · `.nojekyll` 그대로 · 8000 python 쓰기만 · 8123–8125 무관 · 프로세스 조회·디버깅 포트 0(pipe, `try … finally browser.close()`) · 프로필 복사 0(모두 새 폴더 `pa1–pa5`·`pb1`·`pb2`·`pc1`·`pp1`·`r/pbody1`·`r/pe1`) · puppeteer-core 읽기만 · `b8f2/`·`b8f2/r/`·`r8c1b/small.pdf` 는 읽기만 · 의학책 읽기만(가져오기)·Downloads 목록 안 봄 · 큰 원서로 검색 화면 0(e2 의 검색은 작은 PDF) · 결과에 원서 문장 없음 · review.md·`dev/` 안 건드림.

## 11. 스크래치패드 (`…/scratchpad/b8f3/`)

`prep.mjs`(앞 하네스 옮겨 씀) · `common.mjs` · `run-a.mjs`·`run-b.mjs`·`run-c.mjs`·`run-p.mjs` · 결과 `a1–a5.json`·`b1–b2.json` · `imp1.csv`·`imp2.csv`·`impb.csv` · `dl-pa*/`(내려받은 CSV·txt) · `edit-router-test.mjs` · `mut.mjs`·`bak/` · 시험 `run0.txt`·`u1.txt`·`base.txt`·`m1–m8.txt`·`full1.txt`·`full2.txt` · `r/`(회귀 하네스·`e412.json`) · `shots/`(10장) · 프로필 `pa1–pa5`·`pb1`·`pb2`·`pc1`·`pp1`·`r/pbody1`·`r/pe1`.
