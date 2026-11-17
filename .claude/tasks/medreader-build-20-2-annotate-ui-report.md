# 보고 — 20-2 Build: 필기 만들기 · 음성 "표시" · 쪽 필기 시트 (+ 20-1R 낮음 고침) (2026-11-17)

지침: `.claude/tasks/medreader-build-20-2-annotate-ui.md` · 설계: spec 17-16(5 · 8 표 20-2 행 · 9 "20-2" · 10 권장안 · 12 적기만 · 13).
**커밋하지 않았다.** 호출 0 · DB 버전 3 · 판본 상수 불변(`ANNO.*`·`PROMPT_VERSION`·algoVersion 무변) · 본문 DOM 에 아무것도 끼우지 않음.
스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b20-2\`.

## 0. 먼저 고친 것 — 20-1 Review 낮음

| # | 고침 | 확인 |
|---|---|---|
| **#1 동점** | `anchorOf` 가 `ctx.boxOf` 를 받으면 앵커에 **첫 줄 bbox PDF 좌표 `pos:{x0,y0}`**(0.1pt 반올림 — 필드 더함만, DB 3). `resolve` 의 후보 고르기를 `pick` 한 함수로 — 같은 점수가 둘 이상이면 ① 저장 좌표 + 지금 판 줄 상자(`opts.boxOf`)를 모두 알면 **좌표가 가장 가까운 후보** ② 아니면(옛 레코드·상자 모름) 옛 규칙(저장한 첫 줄 번호). 동점으로 정한 결과에 `tie: true`. 서비스 `boxOfLayout(layout)` · `create({layout})` · `placeOnPage(…, {layout})` — **`tie` 결과는 20-D6 고쳐 쓰기를 하지 않는다**. `ui/annotate.js` 가 `scr.layout` 을 넘긴다 | 합성 M1: **S2(3단 블록 순서 뒤바뀜) · S3(행 표 다시 매김) 모두 맞는 사본**(옛 규칙은 둘 다 틀림 — 물러섬만 확인) · 동점 아니면 `tie` 없음(20-1 꼴 그대로). M2(fake-idb): 동점 결과 두 번 그려도 **patch 0**·판 그대로·매번 좌표 자리, 동점 아닌 옛 판은 한 번 patch(20-1 길 그대로). headless: UI 로 만든 레코드 모두 `pos` 있음 |
| **#3 원본 색** | 원본 상자 색을 테마 토큰이 아니라 **종이 고정 토큰 `--anno-paper-*`(tokens.css :root 한 곳 — 테마에서 다시 정의 안 함)**. 값 노랑 #ffd000 · 초록 #2fbf4f · 파랑 #2b86f0 · 분홍 #ee3f8c · 메모 점선 #6b4200 | `b20-2/paper.mjs`(흰 종이 위 opacity 0.38): 네 색 가장 가까운 ΔE76 **33.5**(전: 밝음 10.6 · 어두움 9.1 · 고대비 15.6) · 덮인 검은 글자 대비 **6.8–8.1:1** · 메모 점선 흰 종이 대비 **6.7:1**(전: 밝음 4.8 · 어두움 1.8 · 고대비 1.2). 종이 ΔE 29–41. headless: 원본 노랑 상자 계산색 밝음·**어두움 모두 rgb(255,208,0)**. M5 시험이 같은 값을 다시 잰다 |
| **#4 시험 틈** | M3 — 가짜 `CSS.highlights`·`Highlight`(새 Highlight 의 priority 7)로 `paintReflow`·`prioritize` 를 실제로 돌려 **priority 값** 필기 0 · 검색 1 · 낭독 2 를 본다 | Review 변이 m2(`prioritize` 늘 0) = 내 m5 → **M3 빨강**(아래 3) |
| **#5 깜빡임** | `paintNow` 가 걷기를 **새 결과를 받은 뒤**로(`paintReflow` 가 같은 틱에 걷고 칠함 · 원본 보기는 걷고 `setAnnotations`). 칠할 쪽이 없을 때·DB 실패(그 토큰이 최신일 때)만 곧장 걷는다 | M4(소스: await 앞 걷기는 "쪽 없음" 줄 하나뿐) · headless 칠하기·검색·원본 회귀 0 |

`notes/annotations.js`·`ui/annotate.js` 를 고친 까닭: #1(좌표 넘기기·`tie` 고쳐 쓰기 막기) · #5 · 20-2 에 필요한 것 — 되살리기 `restore(recs)`(지운 레코드 그대로 다시 넣기, 필기 레코드만, 한 트랜잭션) · `placedNow()`(마지막으로 칠한 쪽의 찾은 결과 — 선택 줄 겹침·쪽 필기 시트가 DB 를 다시 읽지 않게) · `onPainted`(구독 — 지금은 쓰는 곳 없음, 아래 남은 문제 6).

## 1. 바꾼 것

| 파일 | 무엇 |
|---|---|
| 새 `js/ui/notesheet.js` | ① 순수: `screenOffsetOf`·`selectionRange`(끝 줄 포함)·`sentenceRange`·`overlapping`·`coveringHighlight`·`leaderOf`·`groupRows`(같은 group = 한 줄 · 고아 끝)·`annoStateOf`·`inheritWas`·`keyboardInset`·`preview` ② 흐름 `createAnnoFlow`(DOM 없음 — 주입): `stateFor`·`highlight`·`createNote`·`recolor`(묶음)·`saveNote`(대표 레코드 하나 — 색 없는 메모를 빈 글로 저장하면 지움)·`remove`(묶음)·`undo`·`markCurrent`(지금 문장 노랑 · 이미 덮였으면 already). 칠하기는 주입된 `paintNow` 만 ③ 화면: 메모 시트 · 쪽 필기 시트 · [되돌리기] 줄(3초) · 메모 있는 것 지우기 확인(`<dialog>`) · 칩 누름 · `visualViewport` 키보드(`data-kb` + `--ns-kb`·`--ns-vh`) · 측정 훅 `__medreader.notes.state()`(글 없음) |
| `js/ui/selbar.js` | `[⋯]` 메뉴 맨 위 **필기 줄**(`.sel-anno` — `annoRowModel` 데이터, `SEL_ACTIONS` 칸 목록 무변): 만들기 = 색 네 칸 + [메모], 겹침 = [메모 보기/고치기]·[색 바꾸기](하이라이트만)·[지우기], [색 바꾸기] → 색 네 칸(지금 색 `aria-current`). 겹침은 메뉴를 열 때 `deps.annoState(snap)`(동기). 화살표 키가 필기 줄부터. 칸 그리기가 필기 줄을 건드리지 않게(`actionButtons`). 스냅숏에 `endLineId`·`endOff` |
| `js/voice/commands.js` | `{id:'mark', ar:['علّم','علم','ظلل','ظلّل','تظليل','علّم الجملة'], en:['highlight','mark','mark this']}` 표 끝 `[검토 — Nour·운영자]` |
| `js/ui/voice.js` | `case 'mark'` → `mark(was, heard)` — 12-2 `remember` 와 같은 꼴(기다림 = 바쁨 · 칠하면 확인 줄 + 한 마디 `voice.mark.done`/`already` → `restore` · none → 한 마디 → 되돌림 · 손이 닿으면 되돌림 없음). **되돌릴 상태**: 누른 순간이 읽는 중이면 그것, 아니면 ① 마이크가 끊은 음성 요약·설명 흐름의 `was`(`askWas`) ② 주입이 돌려준 `r.was`(단추 설명 띠가 멈춰 둔 읽기). 다른 명령 동작 무변 |
| `js/ui/controls.js` | `createAnnoFlow`·`initNoteSheet` 배선, 선택 줄 `annoState`·`onAnno` → `onAnnoAction`(첫 줄 듣기 취소만 — **speaker·readalong 을 건드리지 않는다**), 음성 `onMark`(+ `inheritWas` — 설명 띠가 열려 있고 그 설명의 was 가 읽는 중이면), [설명] 누르기 전 상태 기록(`explainHeld`) |
| `js/ui/reader.js` | 쪽 칩 `#annoChip` — `notifyPage` 마다 `annotationStore().count(docId, page)`(늦게 온 옛 쪽 셈은 버림), 1 이상일 때만 · `refreshAnnoChip()` · `docFileHash()` · 떠날 때 숨김 |
| `js/ui/annotate.js` · `js/notes/annotations.js` · `js/text/anchor.js` | 0 절 |
| `index.html` | 칩 · 메모 시트 · 쪽 필기 시트 · [되돌리기] 줄 · `#annoDelDialog` · 선택 줄 주석 · stamp |
| `css/reader.css` · `css/tokens.css` | 필기 줄(색 칸 48×48) · 칩(48px, 8e compact 숨김) · 시트(요약 시트와 같은 식 · 키보드 · sticky 단추 줄) · 쪽 필기 줄 · [되돌리기] · 원본 종이 색 — 논리 속성만 |
| i18n 4개 | 31키(`anno.*` 27 · `voice.mark.*` 3 · `voice.cmd.mark`). ar·fr `[검토 — Nour·운영자]` |
| 새 `tests/annotate-ui-20.test.mjs` | 14 시험(M1–M5 · U1–U2 · F1–F3 · V1–V3 · S1) |
| `tests/voice-commands-9b.test.mjs` · `tests/remember-12.test.mjs` | 명령 id 목록에 `mark` · "remember 가 표 끝" → "끝 앞, 끝은 mark"(각 한 줄 — 12-2 가 remember 를 더할 때와 같은 손질) |
| `spec.md` | 17-16 §5 끝 `[정정 2026-11-17 — 20-2 Build]` 한 줄 |

`db.js`·`ai/*`·`backup/*`·`text/*`(anchor 빼고 — 지침 허용)·`speaker.js`·review.md·`dev/`·`router.js`·`library.js`·`config.js`·`charhl.js` 무변.

## 2. 수용 기준 "20-2"

| 기준 | 결과 |
|---|---|
| `[D]` 선택 → `[⋯]` → 노랑 → 레코드 1·즉시 칠함 | ✔ h1: 필기 줄 create(색 넷 + 메모) → 노랑 → 레코드 1(highlight·yellow·`pos`) · `anno-yellow` priority 0 · **칠한 구간 글자 = 인용** · 선택 풀림 · 칩 "1"(48px) · F1 |
| `[D]` 겹친 선택 → [색 바꾸기]·[지우기]·[되돌리기] | ✔ 같은 자리 다시 고름 → edit(edit·recolor·remove) → [색 바꾸기] → 색 넷(노랑 current) → 초록: 레코드 그대로 1 · 색 green · `anno-green` 만 · [지우기] → 레코드 0 + [되돌리기] 줄(48px, 확인 대화 없음) → [되돌리기] → 1(같은 색) · 3초 뒤 줄 거둠 · F1·F2(같은 id·만든 때·updatedAt) |
| `[D]` 메모 저장 → `note` · 점선 밑줄 | ✔ [메모] → 시트(글 칸 포커스 · `dir=auto` · maxLength 2000 · 인용 `dir=ltr` · 선택 줄 숨김) → 저장 → kind note(글 58자) · `anno-note` · **`<img onerror>` 글자 그대로 — 그 img 요소 0 · `__xss` 0** |
| `[D]` 음성 «علّم»(9b-2 가짜 인식기) 낭독 중 → 지금 문장 노랑 + 한 마디 + **이어 읽기** · 원본 보기에서도 | ✔ h1: 레코드 +1 · 확인 줄(confirm) · 다시 speaking · restores +1 · 낭독 하이라이트 priority 2 > 필기 0. 멈춘 채 다음 문장 «ظلّل» 두 번 → 새 1 + already 1(레코드 그대로) · 멈춤 그대로. **원본 보기**: 상자 3 → 4 · 레코드 +1 · 다시 speaking. V1(node) |
| `[D]` 쪽 칩 "필기 2" → 시트 → 줄 누르면 그 자리 · 8e compact 칩 숨김 | ✔ 칩 n=2 → 쪽 필기 시트 줄 2(48px · 인용 `dir=ltr` · 메모 `dir=auto`) → 쪽 끝까지 굴린 뒤 줄 누름 → 그 줄 화면 안 + 메모 시트(edit). h2: 915×412·740×360 **칩 CSS 숨김**, 세로 화면 보임 |
| `[D]` 낭독 중 만들기·지우기 → 발화 끊김 0 | ✔ 낭독 중 선택 → 파랑 → 지우기: 상태 speaking 셋 · `speechSynthesis.cancel` 추가 **0** · 발화 계속(26 → 27) · S1(onAnnoAction 에 speaker·pressPlay·readalong 0) |
| `[D]` 360×740·412×915·915×412 × 4언어 · 메모 칸 dir=auto · 키보드 [저장] 보임 · `innerHTML` 0 | ✔ h2 표(아래) — 14칸 모두: 메뉴 화면 안 · **모든 칸 닿음 9/9** · 48px · 가로 넘침 0 · `dir=auto` · [저장] 보임 · 키보드 흉내(높이 45%)에서 [저장] 보이는 뷰포트 안. 새·바뀐 줄 `innerHTML` 0(주석만) |
| 변이(설계 둘) | 아래 3 — 둘 다 빨강 |

**h2** (`b20-2/h2-out.json` — 칸: 화면 · 언어 · 방향 · 칩 · 메뉴 칸/닿음 · 최소 높이 · 키보드 뷰포트 높이 · [저장] 세로 자리):

| 화면 | 언어 | 칩 | 메뉴 | 키보드 [저장] |
|---|---|---|---|---|
| 360×740 | ar(rtl)·en·fr·ko | 보임 48 | 안 · 9/9 · 48 | vh 407 · 342–390 |
| 412×915 | ar(rtl)·en·fr·ko | 보임 48 | 안 · 9/9 · 48 | vh 503 · 438–486 |
| 915×412 (compact) | ar(rtl)·en·fr·ko | 숨김 | 안 · 9/9 · 48 · 두 열 | vh 227 · 162–210 |
| 740×360 (compact 360 높이) | ar(rtl)·ko | 숨김 | 안 · 9/9 · 48 · 두 열 + 안 굴림 | vh 198 · 133–181 |

쪽 필기 시트(세로 화면 8칸): 줄 48px · [×] 48×48 · 화면 안. 콘솔 오류 0 · 페이지 오류 0 · 외부 요청 0 · Gemini 요청 0.

## 3. 변이 (`b20-2/mut.mjs` — 정확히 1곳 → 바이트 다름 → 시험 → 백업 `b20-2/bak/m*.orig` **읽어서 씀** → 바이트 같음)

| # | 변이 | 빨강 | 복원 |
|---|---|---|---|
| m1 (설계) | 음성 경로 `restore` 빼기(한 마디 뒤 되돌림 상태가 늘 idle) | **V1 · V2** · S1 | 같음 |
| m2 (설계) | 겹침 판정 지우기(`annoStateOf` 의 겹침 = null → 같은 자리에 둘) | **F1** · U2 | 같음 |
| m3 (고름) | 동점 결과도 20-D6 고쳐 쓰기(`!res.tie` 지움 — 20-1R #1 의 굳힘) | **M2** | 같음 |
| m4 (고름) | 동점 가르기 PDF 좌표 규칙 지움(옛 첫 줄 번호만) | **M1 · M2** | 같음 |
| m5 (20-1R #4 확인) | Review m2 — `prioritize` 가 늘 0 | **M3**(전에는 살아남음) | 같음 |

## 4. 회귀 · 검사

- **전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회: 1970/1970 · 1970/1970**(13.4 · 13.1초 — `b20-2/test-run1.txt`·`test-run2.txt`). stamp 다시(단독) → `--check` "그대로다(모듈 97 · CSS 4)"(변이 복원 뒤) · `git diff --check` 0 · 새·바뀐 줄 `innerHTML`/`insertAdjacentHTML`/`outerHTML` 0(주석 셋뿐) · `confirm()` 0(h1 `__confirms` 0).
- 9b 명령 표: C3 무결성(겹침 = `SHARED_FORMS` 빈 그대로) 통과 · **V3 전수 — 다른 12 명령의 모든 동의어가 제 명령 그대로(헷갈림 0)**, mark 동의어 9개 모두 mark · «اقرأ»·«اشرح»·«احفظ»·«وقف» 그대로 · 부정 («لا علّم» · "don't highlight") null · 4낱말 이상 문장 null · C12·C13 말뭉치 결과 무변.
- headless(Edge · pipe · 새 프로필 `b20-2/p1`–`p5` · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 흉내 음성 14자/초 + 가짜 시계 · 9b-2 가짜 인식기 · 캐시 끔 · **서버 없음**(가로채기) · 합성 PDF `b11-2/syn.pdf` 읽기만 · 한 번에 하나씩):
  - **요청 본문 바이트 HEAD 와 같음**: 같은 낭독 흐름 번역 POST 2건 `ebebc395…`·`bfa9c1da…` 양쪽 동일.
  - 필기 단계(만들기·고치기·지우기·메모·칩·시트·음성 표시·원본) **Gemini 요청 0**, 외부 0, 콘솔 오류 0, 페이지 오류 0.
  - 선택 줄 기존 칸: 보이는 칸 word·sentence·explain, `[⋯]` summary·readFrom·remember·lookup 그대로 · [기억 카드] 카드 +1 + 안내 줄 · [문장 번역] 띠(탭 모드) · [여기서부터 읽기] 그 줄부터 speaking.
  - 검색 강조: search-hit·search-cur priority **1** · medreader-current **2** · anno-* **0**.
  - 칠하기: 쪽 다시 그림 뒤 이름·우선순위 그대로(`paintNow` 바뀜 회귀 0).
- 스크린샷 `b20-2/shots/`(8): `menu-create-412.png` · `menu-edit-412.png` · `page-notes-412.png` · `note-keyboard-412.png` · `original-dark-412.png` · `reflow-sepia-412.png` · `menu-ar-360.png` · `note-kb-ar-915x412.png`(지침 4–6장보다 둘 많음 — RTL·compact 확인용).
- 하네스: `b20-2/mkcommon.mjs` 가 `b20-1/common.mjs` 를 읽어 `b20-2/common.mjs` 로(스크래치 경로·가짜 키 이름만). 첫 실행(p1)은 작업 트리 설정 단계 `#/reader` 기다림 60초 초과로 멈춤 — 같은 스크립트 새 프로필 p2 부터 재현 안 됨(디버그 `dbg.mjs` 로 올리기 → 리더 이동 정상 확인, 콘솔 오류 0). p2 는 측정 훅이 부팅 뒤 사라져(`main.js` 가 전역 새로 만듦) 하네스 오류 → 쪽 그릴 때 다시 붙이게 고침(selbar·controls 와 같은 장치). p3·p4 완주.

## 5. 설계와 다른 점 (spec 17-16 §5 `[정정 2026-11-17 — 20-2 Build]` 한 줄)

① 필기 줄은 `SEL_ACTIONS` 밖 따로 그린 줄(칸 목록·11-D3 고정 시험 무변) · 겹침은 `placedNow()` 로 동기 판정 · 스냅숏 끝 줄. ② 묶음 메모는 대표 레코드 하나에만, 색 바꾸기·지우기는 묶음 전부 · 색 없는 메모 빈 글 저장 = 지우기 · 메모 있는 것도 확인 뒤 [되돌리기] 줄. ③ 쪽 칩은 퀴즈 칩 자리 **아래 줄 끝**(퀴즈 칩 마크업 무변 — 둘이 함께 뜨면 두 줄). ④ 음성 "표시" 되돌림 이어받기(11-4bR 를 되풀이하지 않게 — 위 1 voice.js). ⑤ 20-1R #1·#3·#5(0 절).

## 6. 남은 문제 · Review 에 넘길 것

1. **«علم» 오탐**(기록 — V3 가 고정): 한 낱말 «علم» 은 "과학·깃발" 뜻도 있어 3낱말 이하 말 안에서 명령이 된다(9b 결정 ①) — «علم الأمراض»(병리학) 같은 두 낱말 의학 용어가 mark. `exact` 로 돌리면 «علّم» 한 낱말 혼자만 명령이 된다 — `[검토 — Nour·운영자]`. 실기기 묶음.
2. 선택이 이미 필기와 **일부만** 겹쳐도 고치기 꼴(맨 앞 겹침의 묶음)이다 — 겹친 선택에서 새 하이라이트를 덧칠할 길은 없다(지우고 다시). 설계 "겹치면 [메모 보기/고치기]…" 글자대로.
3. 메모 시트 키보드 처리는 `visualViewport` 흉내로만 쟀다 — 실기기(Android Chrome `resizes-visual` 기본)에서 [저장]이 키보드 위에 오는지는 실기기 묶음(spec 17-16 12).
4. 동점 PDF 좌표는 **새로 만드는 레코드부터**다 — 20-1 배포 뒤 이미 만든 레코드(만들기 UI 가 없어 실제로는 0 에 가깝다)는 옛 규칙. `pos` 를 뒤에 채워 넣는 일은 하지 않았다(틀린 자리를 굳힐 수 있음).
5. 동점 결과는 고쳐 쓰지 않으므로 그 레코드는 판이 다른 동안 그릴 때마다 2–4단계를 다시 돈다(값싸다 — 20-1R 0.009–0.033ms/건).
6. `annotate.onPainted` 구독 함수는 만들었으나 쓰는 곳이 없다(칩은 설계대로 `count` 로 센다) — 20-3 필기 화면이 쓸 수 있다. 쓰지 않으면 20-3 에서 지워도 된다.
7. 실기기(spec 17-16 12 — 적기만): GT 7 길게 눌러 고른 뒤 `[⋯]` 색 줄이 시스템 선택 메뉴와 겹치지 않는가 · 세피아·어두운 테마 네 색(리플로우) · 원본 보기 종이 색 · «علّم» 이 «اقرأ» 등과 헷갈리지 않는가 · 아랍어 키보드가 올라와도 [저장] · 아랍어·영어 섞인 메모 방향 · 판 올림 뒤 필기 제자리 · PDF 지움 → 다시 가져오기(20-3).

## 7. 규칙 준수

명령 한 호출에 한 가지(`cd &&`·파이프·`;` 0 — 시험·stamp 단독, 글로브 꼴) · 서버 0 · 프로세스 조회·디버깅 포트 0 · 커밋·`git checkout/restore/stash` 0 · npm·다운로드 0 · `rm` 0 · `.nojekyll` 그대로 · 진짜 키 0 · 프로필 복사 0 · 원서 문장 인용 0 · 거절된 명령 0. 표준 입력 대기 0 · 모든 실행 10분 안(가장 긴 headless 73초).
