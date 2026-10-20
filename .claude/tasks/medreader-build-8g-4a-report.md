# 8g-4a Build 보고 — 검색 화면·결과·결과로 이동 (목차 탭 제외)

> 지침 `.claude/tasks/medreader-build-8g-4a.md` · spec 17-8-12 §4·§6·§7(S20–S29)·§8·§9 · carryover 1–7·15. 시작 HEAD `e01ff2c`(전체 1158/1158).
> 커밋하지 않았다. spec·review 는 고치지 않았다(문안 제안은 7절). 스크래치: `b8g4a/`(스크립트·로그·프로필 `prof1`·백업 `bak/`·`mut-bak/`), `shots-8g4a/`.

## 1. 바뀐 파일 (증감 줄)

| 파일 | 줄 | 내용 |
|---|---|---|
| `js/ui/search.js` (새) | 1,201 | 검색 화면(이 책·서재)·최근 칩·결과 묶음·조각 지연 읽기·띠·결과로 이동·강조. 순수 부분 export(묶기·띠·화면 글자·다시 찾기·세 통로·세대·`beginJump`·`snipOf`) |
| `js/ui/reader.js` | +220 −5 | `initSearch`(initControls 뒤) · 검색 화면으로는 **숨기기만**(`leaveReader` 검색 갈래) · 돌아오면 다시 그리지 않고 보이기(`reshowReader`) · 숨은 채 낭독 쪽 넘김(`turnHidden`) · `onPageRepaint`·`onReaderLeave` · `readingSpot`·`currentScreen`·`revealLine`·`revealRegion`·`revealTop` · `bodyArea` 가 띠 아래부터 · 숨은 리더는 창을 굴리지 않음 |
| `js/ui/controls.js` | +39 | `pauseForJump`(=순수 `pauseSpeakerForJump`)·`cueAt`·`speechState`·`onSpeechChange` |
| `js/tts/speaker.js` | +52 | `cue(lineId, start)` + `cuedPastEnd`(인용 뒤 발화가 없으면 다음 [▶] 가 다음 쪽부터) |
| `js/router.js` | +11 −1 | `#/search`·`#/search/:docId`, `searchHash`, `SCREENS` 에 search |
| `js/ui/library.js` | +6 | 서재 [검색] 보이기(`SEARCH.ENABLED`) |
| `index.html` | +66 −11 | 리더 [🔍]·검색 띠·서재 [검색]·검색 화면 섹션(목차 탭 자리 숨김) · import map 도장 |
| `css/reader.css` | +111 | [🔍]·띠(sticky, 상단바 아래)·`::highlight(search-hit|search-cur)`·미지원 줄 클래스·표 테두리 |
| `css/screens.css` | +174 | 검색 화면(범위 분절·검색 칸·칩·결과 줄 ≥48·서재 책 묶음) |
| `js/i18n/{ar,en,fr,ko}.js` | +36 ×4 | 검색 키 34개(4절) |
| `tests/search-ui-8g.test.mjs` (새) | 594 | 22 테스트(U1–U10) |
| `tests/search-db-8g.test.mjs` | +79 | carryover 6·7 (S13g·S13h) |
| `tests/search-toc-8g3b.test.mjs` | +21 | carryover 15 (S33b·S34b) |
| `tests/router.test.mjs` | +4 | R1 에 search 화면(파일에 NUL 글자가 있어 바이트로 고침) |

`js/search/engine.js`·`js/search/outline.js`·`js/text/search.js` 는 **고치지 않았다**(시작 해시와 같음). `main.js` 도 범위 밖이라 고치지 않았다 — 검색 화면은 퀴즈처럼 섹션의 `hidden` 토글을 스스로 본다(MutationObserver + hashchange).

## 2. carryover 반영

| # | 어떻게 |
|---|---|
| 1 세 통로 | `outcomeOf`: `ERR_SEARCH_*` → 검색어 안내(적중 0, 목록 없음) / `ERR_DB_*` → **결과를 그리고** 상태 줄에 저장소 안내(`errorKey`) / reject → `rejectKey`(DbError 코드 문구, 아니면 `err.unknown`). 서재 범위는 책마다 같은 판정(책 묶음 안 안내 줄) |
| 2 앞 세대 reject 무시 | `createSearchRun` — 부를 때마다 세대를 올리고 partial·final·progress·**reject** 모두 지금 세대만 그린다. `cancelled` 결과도 버린다. 화면을 떠나면 `run.cancel()`+`engine.cancel()` |
| 3 바꿔 그리기 | `applyEvent('partial')` 은 결과를 **바꾼다**, 그리기는 늘 모형 전체를 다시 그린다. 서재는 책별로 바꿔 쓴다 |
| 4 서재 책별 진행 | `onProgress({docId})` → 책별 "검색 준비 중 n/N" 칸(결과가 오면 그 책 묶음으로 바뀐다). headless: 0/400 → 150/400 → 300/400 확인 |
| 5 저장소 찬 동안 | 엔진 동작 그대로(빠진 쪽 재시도). 화면은 결과 + `err.quota` 줄. 이 책 범위는 250ms 멈춤 뒤에만 찾으므로 글자마다 실패 묶음을 되풀이하지 않는다. 폰 지연은 S15m(Review/M) |
| 6 `cache === c` | S13g — A 채우기 요청을 빈 요청으로 늘인 채 B 를 다 채워 쉬게 한 뒤 A 실패 → B 캐시·"열린 책 먼저" 유지. 변이 RC 빨강 |
| 7 표시 되돌림 | S13h — 다시 읽기 실패 요청이 걸린 순간 다른 쪽 `notePage` → 표시 2개, 다음 검색이 두 쪽 새 글자. 변이 RD 빨강 |
| 15 (a)(b) | S33b `Is it ok? Yes it is` → multi(M2 빨강) · S34b 누적 = max 층 포함, max 4 → 4항목(M4 빨강) |

## 3. S20–S29 headless (Edge · 새 프로필 `b8g4a/prof1` · 캐시 끔 · 흉내 음성 · 가짜 키 + 흉내 번역 응답)

CMDT 2026 가져오기 → 1,967쪽 추출 약 45초(이 기계). 합성 둘째 책 `b8g4a/pdf/zorvat-handbook.pdf`(12쪽, 지어낸 글자 — 다운로드 아님). 결과 JSON `b8g4a/run-*.json`, 캡처 `shots-8g4a/`.

| S | 결과 | 캡처 |
|---|---|---|
| S20 | 360×740·412×915 × ar/en/fr/ko × 퀴즈 버튼 보임/숨김 = 16 조합: 리더 상단바 버튼 전부 ≥48×48·한 줄·화면 안·가로 스크롤 0, 띠(4버튼) 같음, 검색 화면 상단바·검색 칸 같음, 결과 줄 ≥48. **단 360px + 퀴즈 버튼 보임에서 제목 폭 en·fr 0px, ar 5px, ko 15px**(제목만 줄어든다는 규칙대로지만 사실상 안 보임 — 6절) | `S20-reader-360-{ar,fr}-quiz.png`·`S20-search-360-{ar,en,fr,ko}.png` |
| S21 | 묶음 head → body → table("sarcoidosis" 제목 3·본문 71·표 8), 줄 ≥48, 조각 `<mark>` textContent, 인쇄 쪽 "p. 222 (PDF 260)", `<img src=x onerror=alert(1)>` 는 글자로(img 0·대화상자 0), "the" → 상한 문구, 1자 → 두 글자 안내 | `S21-sarcoidosis-412.png`·`S21-xss-412.png`·`S21-cap-412.png` |
| S22 | 아랍어: html rtl, 조각 dir=ltr lang=en(계산 방향 ltr), 쪽 "ص. 1165 (PDF 1,203)", 빈 결과 문구의 검색어 `<bdi dir=auto>`, 글자 체계 안내, 띠 ‹ 가 오른쪽(prev x 300 > next x 192) · 글리프 거울 | `S22-ar-results.png`·`S22-ar-empty-scripthint.png`·`S22-ar-band.png` |
| S23 | 고른 적중 중심이 본문 영역(띠 아래~하단 크롬 위) 가운데 **−1.6%**, 레지스트리 search-hit 5·search-cur 1·medreader-current 1 동시. 검색 글자만 고친 쪽(가짜 낱말) → 쪽 맨 위(scrollY 0) + "정확한 위치를 찾지 못했습니다" | `S23-S24-jump-paused.png`·`S23-mismatch-notOnPage.png` |
| S24 | 낭독 중(번역 요청 2회 나간 상태) 검색 → 결과 → 멈춤 + `search.paused` 한 번, 그 뒤 2.5초 번역 요청 **0**, [▶] 첫 발화 = 적중 문장, [▶] 하면 검색 강조 지움(띠는 남음). [읽던 곳으로] → 원래 쪽, [▶] 첫 발화 = 검색 전 읽던 문장(같음). **쪽 넘김 대기(waiting-page) 중** 검색 화면에서 결과 누름 → 멈춤·이동·안내 같음 | `S24-back-to-spot.png` |
| S25 | 400쪽 저장본 algoVersion 을 11 로 → (리더를 열지 않고 검색 화면 딥링크) 결과 → 옛 판에 칠함 → 재추출 저장 → 새 DOM(쪽 section 2개째)에 다시 칠함(Range 살아 있음). 추적 `11:1:1:live → 12:1:2:live`. pdf.js 를 CDN 에서 받는 시간 때문에 재추출까지 실행마다 0.5초~수십 초 | `S25-old-version-repaint.png` |
| S26 | 언어 fr 로 바꾼 뒤 cur 1·hit 1 · 원본 보기 → 줄 오버레이 보임·스크롤 상자 안 · 리플로우로 돌아와 cur 1·hit 1 | `S26-original-overlay.png` |
| S27 | "metformin" 표 묶음 → 1135쪽 표 크롭(`figure.search-cur-fig`, 상단 121px), "표 안에서 찾았습니다", [원본으로 보기]·크롭 그림 있음 | `S27-table-hit.png` |
| S28 | 결과 목록을 900px 내린 뒤 결과 → 리더 → `history.back()`: 해시 `#/search/:docId`(검색어 없음), 검색어·67줄·scrollY 900 그대로 | `S28-back-results.png` |
| S29 | 아랍 문자 검색어 → `search.scriptHint`(S22) · 합성 책 6/12쪽(부분 추출 흉내) → "12쪽 중 6쪽에서 찾았습니다 — 텍스트 준비 중" + [이 책 텍스트 준비 계속](안 연 책) → 누르면 12/12 · 서재는 입력만으로 찾지 않음([찾기]/Enter), 서재에서 들어오면 범위 분절 숨김 | `S29-library-progress.png`·`S29-library-results.png` |
| 그 밖 | 검색 화면 뒤에서 낭독이 쪽을 넘김: 해시는 검색 그대로·목록 스크롤 600 그대로, 뒤로 → `#/reader/…/62`(replace)·계속 낭독·반복 0 · §9 `SEARCH.ENABLED=false`(응답에서 config 한 줄만 바꿔 흉내): [🔍]·[검색]·띠 숨김, `#/search/…` → `#/library` | `hidden-turn-back.png`·`S9-off-reader-360.png` |

콘솔 오류는 `/favicon.ico` 404 하나뿐(서버 로그 확인, 기존).

**S15 대략**(headless Edge 데스크톱, Review 가 정식으로 잰다): 이 책 첫 검색(화면 열고 2초 뒤, 그리기 포함) 195ms · 다음 23ms · 엔진만 12–20ms · 서재 첫 검색(CMDT 400쪽 백필 포함, 두 권) 693ms · 서재 다음 483ms.

## 4. 8i-1·8i-3 경로 영향

- 결과 이동은 `goToPageForSpeech`·`renderDone` 을 쓰지 않는다(보통 쪽 이동). 처리는 `onPageRender` — initReader 가 `initControls()` **다음에** `initSearch()` 를 불러 controls 의 `speaker.reload` 구독 뒤에 등록된다(U10 소스 단언 + 변이 UG 빨강).
- `renderPage` 본문은 고치지 않았다(PT9·RF23 의 순서·`renderDone.settled` 4곳 그대로). `goToPageForSpeech` 는 `renderDone.wait` 뒤에 `state.soft` 면 `turnHidden`, 아니면 기존 `go(readerHash(…))`.
- `tests/pageturn-8i3.test.mjs`·`refresh-8i1.test.mjs` 녹색. headless `turn.mjs`: 리더가 보이는 평소 낭독 쪽 넘김 70 → 71, 리플로우·원본 모두 해시가 다음 쪽·계속 낭독·반복 0. S25 의 새 판 다시 그리기(`refreshed`) 뒤 다시 칠함·다시 cue 확인.

## 5. 검증 수치

- 새 i18n 키 **34개 × 4언어**: spec 4-6 의 `search.*` 37 중 목차 탭 4개(`search.toc.*`)를 뺀 33 + **`search.tooLong`**(새 — 61자 이상 `ERR_SEARCH_LONG` 안내, 입력 칸 `maxlength=60` 이라 보통은 안 보임). `common.reload`·`err.dbUpgraded` 는 이미 있음(확인). ar 이 en 복사가 아님(I14·U10).
- 변이 14개(`b8g4a/mut.mjs`, 로그 `b8g4a/mut.json`): V11 · V12 · V12b(waiting-page 안 멈춤) · UA(onPartial 덧붙임) · UB(앞 세대 그림) · UC(cue 가 ranges 무시) · UD(cue 가 낭독 중에도) · UE(순번 폴백 없음) · RC · RD · M2 · M4 · UF(검색 화면으로 갈 때 낭독 멈춤) · UG(구독 순서) — **14/14 빨강**, 각각 의도한 테스트가 잡음, 복원 후 6개 파일 sha256 같음(`mut-sha-before/after.txt` cmp 0).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회: **1184/1184**(1158 + 26), fail 0, cancelled 0, 약 8.3초·8.2초(`b8g4a/full-1.tap`·`full-2.tap`). `stamp-importmap --check` "그대로다(모듈 58개 · CSS 4개)", 종료 0.
- 앱 파일 해시 비교(`b8g4a/sha-before.txt` ↔ `sha-after.txt`): 바뀐 것은 1절 표의 파일뿐. `.nojekyll` 있음.

## 6. 남은 문제 · 관찰

1. **360px 상단바 제목이 사라진다**: 퀴즈 버튼이 보이면 en·fr 제목 폭 0px(ar 5·ko 15). 버튼은 모두 48 이상·한 줄·가로 스크롤 0 이라 S20 문구는 지키지만 제목이 안 보인다. [🔍] 이 48px 를 더 가져갔다. 줄일 거리: [⧉] 글자("Original")를 아이콘으로, 또는 360px 에서 제목 숨김을 받아들임 — 운영자 판단.
2. **배너가 상단바·띠를 덮는다(기존)**: `.banners` 가 sticky top(z 30)이라 본문을 내린 상태에서 배너(예: 화면 꺼짐 안내)가 뜨면 상단바 [🔍] 와 띠 위를 덮는다. headless 에서 이것 때문에 [🔍] 누름이 배너 [닫기]로 갔다. 이번 범위 밖(14절 배너) — 기록만.
3. **cue 뒤 진행 표시**: `speaker.cue` 는 `linechange` 를 내지 않으므로(낭독 동반 번역 커서를 건드리지 않으려고) 컨트롤 바의 "n번째 줄"이 이동 전 값으로 남는다. [▶] 하면 바로 맞는다. 작다.
4. 띠 순서는 **쪽 순서**(쪽 안 본문 글자 → 표)라, 결과 목록의 제목 묶음 첫 줄을 누르면 "19/82" 처럼 중간 번호가 나온다. ‹ › 가 쪽을 따라 걷게 한 의도된 선택 — spec 문안 7-3.
5. S25 재추출 시간은 pdf.js CDN 받기에 달려 있다(0.5초~수십 초). 그동안은 옛 판 글자에 칠해져 있다(문구 없음).
6. `formatNumber` 가 쪽 번호에 천 단위 구분을 넣는다("PDF 1,203", fr "1 203") — 리더 쪽 칸(`reader.page.of`)과 같은 규칙이라 그대로 뒀다.

## 7. spec 문안 제안 (17-8-12 — 고치지 않았다)

1. §4-6 i18n: "8g-4a 는 `search.*` 33 + `search.tooLong`(새 — 61자 이상) = 34, 목차 탭 4개는 8g-4b" `[정정 — 8g-4a Build]`.
2. §4-3·§4-5 표에 한 줄: "**리더 → 검색 화면은 리더를 숨기기만 한다**(DOM·낭독 유지 — `main.js` 가 아니라 `reader.leaveReader` 의 검색 갈래). 숨은 동안 낭독이 쪽 끝에 닿으면 해시를 바꾸지 않고 숨은 리더에서 다음 쪽을 그린다(검색 화면이 리더로 튀지 않게). 떠났던 쪽 해시로 돌아오면(뒤로) 해시를 낭독이 간 쪽으로 바꾼다(replace). 같은 쪽으로 돌아오면 다시 그리지 않는다(읽던 문장을 처음부터 다시 읽지 않게)."
3. §4-3: "띠의 ‹ ›·[읽던 곳으로]는 히스토리를 **바꿔 쓴다**(replace) — ‹ › 를 여러 번 눌러도 뒤로 한 번 = 결과 목록. 결과 목록에서 누른 이동만 쌓는다." · "읽던 자리는 띠가 없을 때 [🔍] 를 누를 때만 기억한다(검색을 이어 가는 동안 처음 자리를 지킨다). ✕ 가 지운다."
4. §4-1: "띠의 ‹ › 순서 = 쪽 순서(쪽 안 본문 글자 → 표), i/n 도 그 순서" (6-4).
5. §4-5 낭독 행: "`cue` 는 멈춤뿐 아니라 **처음 상태(idle)** 에서도 시작점을 둔다(칠하지 않음) — 낭독을 안 하던 사람도 [▶] 가 적중 문장부터." · "인용 줄 적중이고 그 쪽에 뒤 발화가 없으면 다음 [▶] 가 다음 쪽부터."
6. §4-5 표 적중 행: "원본 보기에서는 `original.scrollToRegion`." (구현 그대로)
7. 17-8-5 조각: "말줄임 '…' 은 문단 안에서 잘린 쪽에만"(`snipOf`).

## 8. 4b 로 넘길 것

- carryover **8–14·16–18** 그대로(목차 탭 · `tocOf` 폴백 문구 E5 · `search.toc.*` 키 · spec 문구 8–10 · S19 · 배선 행동 테스트 13 · R2 약어 예외 16 · `measure-search-8g.mjs --toc` 18).
- 자리: `index.html` 의 `#searchTabs`(찾기·목차 탭, 지금 `hidden`)·`#searchToc`(숨김), `search.tab.toc` 키는 이미 있다. 서재 범위에서는 목차 탭 없음(spec). 목차 항목 누름 → `go(readerHash(docId, p))` — 읽던 자리(`S.spot`)·띠 규칙과 맞출 것.
- 6절 1·2·3(제목 0px · 배너 덮음 · cue 뒤 진행 표시)을 4b 에서 다룰지 운영자 결정.
- S15·S15m·S30 실측(Review/M), Nour 기기 Gboard 음성 입력.
- 2–4 배포는 4b 뒤 함께(G1).

## 9. 실행 · 정리

- 모든 명령에 시간 상한(`timeout`). 표준 입력을 기다리는 명령 없음. 막힌 명령·훅 없음.
- 브라우저 프로필은 새로 만든 `b8g4a/prof1` 하나만 썼다. 띄운 Edge 는 모두 닫혔다(남은 msedge 중 이 프로필 0).
- **켜 둔 것**: 8000번 정적 서버 `python -m http.server 8000 --bind 127.0.0.1`(PID 30808, 레포 루트) — 지침대로 켜 둠. `localhost:8000` 대신 `127.0.0.1:8000` 으로 묶었다.
- 내 것이 아닌 node: 43840(Adobe), 18040·38960(`npx http-server -p 8123`, 00:01 시작 — 이 작업 전) — 건드리지 않았다.
- 스크래치: `b8g4a/`(lib·setup·run·dbg·dbg2·dbg3·off·turn·mut·mkpdf·i18n-add 스크립트, 로그·JSON, `bak/` 시작 백업, `mut-bak/`), `shots-8g4a/`(23장).
