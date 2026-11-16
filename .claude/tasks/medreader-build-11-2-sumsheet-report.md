# Build 보고서 — 11-2 요약 시트 · 글 트리 · 선택 줄 [⋯]·[요약] · 음성 "요약"

> 지침: `.claude/tasks/medreader-build-11-2-sumsheet.md` · 설계: spec **17-2-1**(11-2 몫) · 11-1 보고서 · review.md "11-1 Review"·"11-1b 재검증" · crossstep-notes. 직전 배포 11-1 `53edc19`.
> 커밋하지 않았다. 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b11-2\`.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/sumsheet.js` **새**(814줄 — 설계 약 330 보다 큼: 흐름·화면·측정 훅이 한 파일) | 순수 `itemNote`·`sumButtons`·`sumEsc`·`SUM_ACTIONS` · DOM 없는 흐름 `createSumFlow`(open·retry·redo·unsave·confirmAsk·cancelAsk·save·saveAll·pageAll·close) · 화면 `initSumSheet`(머리 sticky [×] · 상태 한 줄 · 요지·원문 언어 요지·트리·용어 · 고지 · 질문 줄 · 단추 · Esc 가장 위 층 · Tab 가둠 · 쪽 라벨 8g `pageLabels`) |
| `js/ui/tree.js` **새**(101) | `renderTree`(`<details open>` 중첩 — JS 없이 접힘, 깊이 3, `appendBidiText`) · `setAllOpen` · `anyOpen` · `treeShape` |
| `js/ui/ask.js` **새**(173 — 요약 갈래) | 순수 `pageParasOf`(문단 글 + 줄 id)·`sentenceIndexOf`(줄 모드)·`summaryPlan`(단추 = 선택 문장의 문단 · 음성 = `summaryTarget`) · 흐름 `createAsk`(`summarize`·`listen`·`canSummarize`·`gate`) |
| `js/tts/say.js` **새**(121) | `createSayer({synth, makeUtterance, speechOf, timers, rate})` → `say(text, lang)`→`'end'|'stopped'` · `stop()` · `busy()` · `stats()` — 300자 조각(`splitLong` + `،`)·조각마다 `trWatchdogMs` |
| `js/ui/selbar.js` | `SEL_ACTIONS` = word·sentence(보이는 칸) + summary·readFrom·lookup(`more:true`) · `selBarModel` 에 `more` · 순수 `withSummary`·`moreVisible` · `[⋯]` 메뉴(열기·닫기·창 붙잡기 Esc·화살표·바깥 누름) · 메뉴 안 [찾아보기]는 목록 닫을 때 포커스 `[⋯]` · 메뉴/목록이 떠 있는 동안 거두기 예약 취소 · 줄이 뜰 때 측정 훅 다시 붙임 |
| `js/voice/commands.js` | `summarize` 줄(explain 앞) — ar `لخص · لخّص · ملخص · تلخيص · لخص الفقرة` · en `summarize · summary · sum up` `[검토 — Nour·운영자]` |
| `js/ui/voice.js` | `exec` 갈래 `summarize` → 주입 `deps.onSummarize` · `askJob`·`sayer` 를 "바쁨"에 · `cancel`·마이크 다시 탭에서 `stopAsk()`(= `sayer.stop()`) · 디버그 `asking`·`sayer` (import 무변) |
| `js/ui/controls.js` | sayer·sumsheet·ask 배선(+약 50) · 선택 줄 `canSummarize` · `[요약]` 갈래 · 단어 시트 열 때 요약 시트 닫기 · `cancelVoice()` = `voice.cancel()` + `sayer.stop()` · 떠날 때 거둠 · 디버그 `tts.sayer()` |
| `js/ui/library.js` | crossstep "8f-2·11-2": `deleteKeepLines` 에 `library.card.deleteConfirmSummaries` · `deleteKeepCounts` 가 `summaryStore().count`(요약 + 개요 — 1개 이상일 때만 결과에 `summaries`, 8f-2 의 `{vocab}` 꼴 유지) |
| `index.html` | 선택 줄에 `#selMoreBtn`(`aria-haspopup="menu"`·`aria-expanded`·`aria-controls`)·`#selMore`(`role="menu"`) · 요약 시트 마크업(단어 시트 앞) · stamp(모듈 81 → 85) |
| `css/reader.css` | `.sel-actions` flex `1 1 0` · `[⋯]` 48 정사각 · 메뉴(18 목록과 같은 자리) · `.sum-sheet` 전부(단어 시트와 같은 아래 붙임·높이 식, z 36, 머리 sticky, 48px, 논리 속성만) · compact 폭 880 |
| i18n 4개 | 31키(`sum.*` 26 · `sel.more`·`sel.summary` · `voice.cmd.summarize`·`summarizePrev` · `library.card.deleteConfirmSummaries`) + `library.card.deleteConfirm` 4언어 고침(ko 영어였음·"everything" 아님 — 11-1R #8). ar·fr `[검토 — Nour·운영자]` |
| `tests/sumsheet-11b.test.mjs` **새**(15) · `tests/say-11.test.mjs` **새**(8) | 아래 표 |
| 옛 시험 기대값 4곳 | `links-18` L9 · `taptr-8c` I7b · `wordsheet-8f` W14 — **선택 줄 단추 목록**(넷 → 다섯, lookup 자리 넷째 → 끝, `more`) · `voice-commands-9b` C3 — **명령 id 목록**에 `summarize`(표 무결성 규칙·나머지 9b 시험은 그대로). 이유: 11-D3 재배치·11-D11 새 명령이 바꾸는 바로 그 목록 |
| `spec.md` | `[정정 2026-11-17 — 11-2 Build]` 3줄(4-3 · 4-5 · 7) |

손대지 않음: `pipeline.js`·`prompts.js`·`db.js`·`config.js`·`notes/*`·`backup/*`·`trband.js`·`links.js`·review.md·`dev/`(추적 안 된 `measure-table-8i4.mjs` 포함). DB 3·`algoVersion`·번역 `PROMPT_VERSION`·캐시 키 무변.

## 2. 수용 기준 "11-2" + 공통

| 기준 | 결과 | 근거 |
|---|---|---|
| 선택 → `[⋯]` → `[요약]` → 요지(ar `dir=rtl`)·원문 언어 요지(`dir=ltr`)·트리·용어·고지, 요청 **1** · 닫고 같은 문단 다시 → **0** | ○ | headless B `first`(요청 1 · gist rtl/ar · bdi 1 · gistSrc ltr/en · details 1 · 용어 2 · 고지) · `again`(0 · cached) · node K2 |
| 트리 `details` 접기·펼치기(Enter·Space) · [모두 접기]/[모두 펼치기] · `innerHTML` 새 사용 0 | ○ | B `tree`(1→0→1 · 0 · 1 · 글자 바뀜) · K9 · grep(새 4파일 0, diff 의 `innerHTML` 은 index.html 주석 글자뿐) |
| [저장] → annotations 1건(kind summary·docId·pageNo·anchor.textHash) · [저장됨 ✓] → 페이지 안 확인 → 지움 · 요청 0 | ○ | B `save`(lines 3·paraId·원문 0 · 질문 줄·포커스 [그대로 두기] · 지움 0 · 요청 0) · K5(fake-idb) |
| [이 쪽 전체 요약 (문단 n · 호출 k)] → 요청 = k · 결과 n · [모두 저장] n · 그 뒤 아무 문단 0 | ○ | B `pageAll`(n 4 · k 1 → 1 · 4 ready · 4 저장 · 뒤 0) · K6(12문단: 1 + **k 2 → 2**) |
| 짧은 문단·제목 → [요약] 흐림·누르면 한 줄·요청 0 · 키 없음 → 한 줄 + 배너 즉시·0 · 429·capped·offline → 막힘·자동 재시도 0 · 잘린 JSON → 실패 + [다시 시도]·캐시 0 | ○ | B `notEligible`·`blocked`(noKey 0 · 배너 `ai.state.noKey` · capped 0 · offline 0 · 429 1·3초 동안 0·[다시 시도] 1 · cut 1 → 다시 열어도 0·실패 → [다시 시도] 1·ready) · K3·K4 |
| 음성 «لخص» — 문단 둘째 문장 → 지금 문단 · 대상 언어 음성 · **읽기 재개** · 문단 첫 문장 → 앞 문단 · 멈춤 → 멈춘 채 · 말하는 중 [▶] → 멈춤·되돌림 없음 | ○ | headless V(아래 4절) · K11·K11b |
| 낭독 중 선택 → [요약] → 낭독 끊김 0 | ○ | B `reading`(speaking 유지 · 발화 계속) |
| 시트·`[⋯]` 메뉴 360×740·412×915·915×412 × 4언어 — 시트 위끝 ≥ 0 · [닫기] 보임 · 가로 넘침 0 · 48px · 보이는 칸 안 넘침(18 링크 포함) | ○ | headless L 12조합 판정 전부 참(아래 5절) |
| 서재 삭제 확인 "저장한 요약 n개는 남습니다"(n>0) · 지운 뒤 annotations 남음 | ○ | B `deleteConfirm`(4 · 머리 ko · "everything" 0 · 문서 지움 · 4 남음) · K13 |
| 공통: 전체 시험 · stamp `--check` 0 · splitSentences 두(세) 파일 그대로 · innerHTML 0 · 콘솔 오류 0 · 무료 티어 숫자 0 · 진짜 키 0 | ○ | 6절 · 콘솔은 7절 주 |

## 3. 호출 — 설계 6절 그대로

[요약] 미적중 1 · 적중 0 · [이 쪽 전체 요약] k(누르기 전 `planSummary` 로 보임 — 실제와 같음) · [다시 요약] 1(먼저 묻는다) · [다시 시도] 1(막힌 원격 상태면 `pipeline.retry()` 먼저 — 사용자 동작만) · [저장]·[저장됨 ✓]·접기·[▶ 듣기]·삭제 확인 0 · 낭독·쪽 넘김·자동 0. headless 요약 POST: B 7(첫 1·잘림 1·[다시 시도] 1·429 1·[다시 시도] 1·낭독 중 1·쪽 1) · V 1 · L 1. 요청은 전부 `pipeline.summarize` 한 길(상태 기계 한 벌).

## 4. 선택 줄 재배치 · 음성 흐름

- **선택 줄**(11-D3 (가)): 보이는 칸 [단어 번역][문장 번역] + `[⋯]` — 12조합 모두 3칸·한 줄·48px 이상·넘침 0. 셋째 칸 [설명]은 11-4 가 `SEL_ACTIONS` 의 `sentence` 다음에 한 줄(`{id:'explain', key:'sel.explain'}`)로 끼우면 된다(주석). `[⋯]` 안 [요약]·[여기서부터 읽기]·[찾아보기](링크 0개면 숨김 그대로).
- **18 남은 1(360 ko·fr 단추 넷 접힘)**: ko·ar 은 360 에서 모든 칸 한 줄(48px) — **풀림**. en·fr 360 은 [문장 번역] 한 칸만 두 줄(56px, 넘침 0 — "Traduire la phrase"/"Translate sentence"가 약 124px 글 폭보다 김). 412·915 는 모두 한 줄.
- **18 회귀**(headless R): [⋯] → [찾아보기] 링크 둘 → 목록이 줄 위(항목 2) · Esc → 목록만 닫힘·포커스 `[⋯]` · 항목 → 새 탭 `target=_blank`·`rel="noopener noreferrer"`·`no-referrer` · 링크 하나 → 목록 없이 바로 같은 속성.
- **Esc 층**(R): 띠 탭 + `[⋯]` → Esc 1 메뉴만(포커스 `[⋯]`) → Esc 2 띠 · 띠 + 단어 시트 → 시트 → 띠 · 띠 + 요약 시트 → 시트 → 띠. 시트가 열린 동안 선택 줄 `display:none`. 단어 시트 위에서 음성 «لخص» → 단어 시트 닫히고 요약 시트(한 번에 하나).
- **음성 흐름**(headless V · 412 ko UI · 명령 ar): ① [여기서부터 읽기]로 문단 둘째 문장(줄 `2:2`) 낭독 중 «لخص» → 시트 문단 `2:p1`(지금) · 요청 1 · 말하는 동안 낭독 paused · 발화 `ar-SA` 1회(괄호·라틴 0) · 확인 줄 "문단 요약" · 끝나면 **speaking, 같은 문장(idx 2)** · restores 1. ② 문단 첫 문장(`2:4`) → 앞 문단 `2:p1` · 확인 줄 "앞 문단 요약" · 요청 0(캐시) · 끝나면 speaking idx 4. ③ 멈춤 → 말한 뒤 paused. ④ 말하는 중 [▶] → sayer 멈춤(stops 1)·`asking` false·restores 그대로(2→2)·[▶] 자신은 재생. 인식 태그 `ar-SY`. "아직 없는 기능" 0.
- **9a 미디어 키**(R): 시트 [▶ 듣기] 말하는 중 `play` 액션 → sayer 멈춤 → 재생(그 단추는 평소대로). **9b**: «التالي» idx 0→1 speaking · «توقف» paused.

## 5. headless (Edge · pipe · 새 프로필 · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 흉내 음성·인식기 · 캐시 끔 · 서버 없음 — 가로채기)

| 실행 | 프로필 | 무엇 | 결과 |
|---|---|---|---|
| `run-a.mjs` → `a1.json`(47초) | pA | HEAD(127.0.0.2) vs 작업 트리(127.0.0.1) — `b9c2/syn.pdf` 탭·단어·낭독 | **`bodiesSame:true`** — 탭 2,624B `d7e08bab` · 단어 2,543B `fdbdf49b` · 낭독 6,196B `33e4d546`(11-1 값과 같음) |
| `run-b.mjs` → `b2.json`(33초) | pB2 | 요약 시트 수용 기준(합성 PDF `b11-2/syn.pdf` — 4쪽, 줄 = 문장) | 2절 표 |
| `run-v.mjs` → `v1.json`(16초) | pV1 | 음성 "요약" | 4절 |
| `run-l.mjs` → `l1.json`(30초) | pL1 | 3 화면 × 4언어 | 12조합: 보이는 칸 3·한 줄·48·넘침 0 · 메뉴 위끝 ≥ 0·48·화면 안 · 시트 위끝 ≥ 0(세로 73 · 가로 24)·[×] 보임(elementFromPoint)·가로 넘침 0·단추 48·summary 48 · 요지 rtl/원문 요지 ltr · 첫 조합 뒤 요청 0 |
| `run-r.mjs` → `r3.json`(28초) | pR3 | 회귀(4절) · 8e 가로 dock: 선택 줄 → 띠 → dock 위아래 겹침 0 · [≡] 보임 · 가로 스크롤 0 | 전부 맞음 |
| (진단) `dbg-r4.mjs` | pD1 | R 1차 실패 원인 — 시험 순서 오류(단어 시트가 열린 동안 선택 줄은 숨는다 → `[⋯]` 를 못 누름, 앱 동작 맞음) | 시험을 음성 경로로 고침 |

콘솔 오류 0 · pageerror 0 · 외부 요청 0 · 없는 파일 0 · 흉내 오류 0. **주**: B 에 콘솔 한 줄 `Failed to load resource: 429` — 흉내 429 응답을 브라우저가 찍는 네트워크 줄(의도한 429 시험), 앱 오류 아님.
스크린샷 10장 `b11-2/shots/`: 1 메뉴 ko 412 · 2 시트 ko 412 · 3 쪽 요약 · 4 낭독 중 시트 · 5 음성 시트 · 6 메뉴 fr 360 · 7 시트 ar 915×412 · 8 시트 ar 412 · 9 메뉴 ar 360 · 10 가로 dock + 메뉴.

## 6. 시험 · 점검

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,797/1,797 · 1,797/1,797**(`full1.tap`·`full2.tap` — 기존 1,774 + 새 23).
- `stamp-importmap --check` "그대로다(모듈 85 · CSS 4)" · `git diff --check` 0 · 새 파일 여섯 `--no-index --check` 0.
- `grep splitSentences js/` = HEAD 와 같은 3파일(`text/cite.js` 주석·`text/segment.js`·`tts/text.js`).

| 새 시험 | 무엇 |
|---|---|
| K1 | 대상(단추·음성 앞 문단·쪽 첫 문장)·줄 id·줄 모드 번호·문지기(같은 언어 통과)·`canSummarize` |
| K2–K7 | 진짜 파이프라인 + 흉내 Gemini + fake-idb 저장소: 요청 1·다시 0 · 대상 아님 0 · 문지기·no-key·429·오프라인·잘린 JSON · 저장/지우기 · 쪽 요약(k = 실제) · 다시 요약 |
| K8–K10 | 순수 표 · 트리(가짜 DOM) · 선택 줄 모델·마크업·CSS |
| K11·K11b | 진짜 speaker + voice + ask + sayer(가짜 인식기·엔진): 지금/앞 문단 · 대상 언어 · 되돌림 · 멈춤 · 손이 이긴다 · 기다리는 중 손 · 막힘 한 마디 |
| K12–K14 | 명령 표(ar·en·부정·일상 문장) · 삭제 확인 · 배선·계층·i18n |
| Y1–Y8 | sayer 조각·stop·워치독·엔진 오류 · [▶ 듣기] 괄호 원어 빼기·되돌림 · 계층 |

## 7. 변이 (원본 바이트를 `b11-2/bak/` 에 쓰고 한 곳만 바꿈 → 시험 → `bak/` 를 읽어 되씀 → 바이트 비교) — `mut.mjs`·`mut.json`

| # | 변이 | 빨강 | 복원 |
|---|---|---|---|
| M1 | `summaryTarget` 앞 문단 규칙 지우기 | T3 · K1 · K11 | 같음 |
| M2 | 시트 [▶ 듣기]가 `trSpeechText` 안 거침 | Y7 · Y8 | 같음 |
| M3 | `[⋯]` 빼고 단추를 다 한 줄에 | K10 · I7b · **headless 412 ar**(`mut-m3h.mjs` → `m3h.json`: 보이는 칸 5, 그중 셋이 두 줄 — `barVisibleAlways3:false`) | 같음 |
| M4 | 음성 경로에서 `restore(was)` 빼기 | K11 | 같음 |
| M5(더) | [요약] 흐림 판정 무시 | K10 | 같음 |
| M6(더) | 9b `cancel` 이 요약 흐름을 안 거둠 | K11b | 같음 |
| M7(더) | 삭제 확인 "요약 n개" 줄 빼기 | K13 | 같음 |
| M8(더) | 요약 문지기가 같은 언어를 막음 | K1 | 같음 |
| M9(더) | [다시 시도]가 막힌 원격 상태를 먼저 안 풂 | K4 | 같음 |

## 8. spec 정정 (`[정정 2026-11-17 — 11-2 Build]`, 그 자리만)

1. **4-3**: 닫기 = 위 sticky 머리 [×](아래 [닫기] 대신 — compact 에서 단추를 덮지 않게) · [모두 접기] 조건 · [이 쪽 전체 요약]은 요약 가능 문단 ≥ 2·k 를 센 뒤 · 쪽 결과에 [▶ 듣기]·[다시 요약] 없음 · 질문 줄 포커스 · 쪽이 바뀌어도 시트 유지 · [요약] 흐림은 메뉴 열 때 · 시트는 한 번에 하나.
2. **4-5**: 되돌림은 9b 흐름 한 곳(ask 가 `{ok, prev, done}`, voice.js 가 `done` 뒤 `restore(was)`) · `alive()` · sayer 를 9b "바쁨"에 · `cancelVoice` = voice.cancel + sayer.stop · [▶ 듣기] = `ask.listen` · 11-4 가 같은 꼴을 쓰면 됨.
3. **7**: 실제 31키 · `voice.cmd.summarizePrev` · 삭제 확인 머리 4언어 고침.

## 9. 마지막 실기기 점검 묶음에 더할 것 (적기만)

- [ ] `[M]` Realme(아랍어 목소리 목록 없음 → 태그만): 음성 «لخص» 뒤 요지가 아랍어로 나오는가 · 괄호 원어가 소리에서 빠지는가 · 긴 요지(300자↑)가 조각 사이에서 끊기지 않는가 · 끝난 뒤 낭독이 그 문장부터 이어지는가.
- [ ] `[M]` Nour GT 7: «لخص»·«ملخص»·«تلخيص» 가 시리아 말씨로 잡히는가 · 다른 명령과 헷갈리지 않는가 · 영어 "sum up" 이 긴 문장 안에서 잡히는 경우(2낱말 동의어는 포함 일치 — 9b 규칙 ①) `[검토]`.
- [ ] `[M]` 손가락으로 `[⋯]` 를 누를 때 선택이 풀려도 메뉴가 남는가(거두기 예약 취소 — `[가정 — 실기기]`) · `[⋯]` 메뉴가 시스템 선택 메뉴(복사·공유)와 겹치지 않는가(세로·가로).
- [ ] `[M]` 요약 시트 트리를 손가락으로 접고 펴기(아랍어 RTL) · 가로(시트 약 219px)에서 머리 [×]·단추에 닿는가.
- [ ] `[M]` 이어폰 재생 단추를 요지 말하는 중에 → 말하기 멈춤 + 낭독 단추 동작.
- [ ] `[M]` 360 fr·en 에서 [문장 번역] 두 줄(56px)이 읽기 편한가.

## 10. 남은 문제 · 넘길 것

1. **360 en·fr 의 [문장 번역] 두 줄**(56px, 넘침 0) — ko·ar 은 한 줄. 18R #2 는 "넷 접힘 → 한 칸 두 줄"로 줄었다. 더 줄이려면 단추 안쪽 여백 4px·`[⋯]` 40px(48 규칙 위반) 같은 선택 — Review 판단.
2. `[⋯]` 메뉴가 선택 글자를 일부 가릴 수 있다(18 목록과 같은 자리 — 18R "목록이 고른 낱말 가림"과 같은 결).
3. 쪽이 바뀌어도 요약 시트를 닫지 않는다(설계 문장 없음 — 정정 줄에 적음). 다른 쪽에서 [이 쪽 전체 요약]은 **연 때의 쪽** 문단이다(머리에 쪽 라벨).
4. `deleteKeepCounts` 는 요약이 1개 이상일 때만 `summaries` 를 담는다(8f-2 시험 `{vocab}` 꼴 유지). 필기(20)를 같은 줄로 셀지는 20 몫.
5. 쪽 요약 화면의 문단별 [다시 시도]는 그 문단만 1호출씩(묶지 않는다).
6. 요지 소리 속도 = 낭독 속도(`speaker.getRate()`).
7. 2낱말 동의어 "sum up" 은 긴 문장 안에서도 포함 일치(9b 규칙 ① 은 한 낱말만 막음) — `[검토 — Nour·운영자]`.
8. `sumsheet.js` 814줄(설계 약 330) — 흐름·화면·훅이 한 파일. 11-3 이 링크를 켤 때 같은 파일.
9. 11-4 로: [설명] 칸 자리(`SEL_ACTIONS` sentence 다음) · `ask.js` 에 설명 갈래 · `done`/`listen` 꼴 재사용 · voice `explain` `enabled:true` 때 C9·U9 기대 고침.

## 11. 막힌 명령 · 규칙

- 막힌(거절된) 명령 없음.
- 처음 i18n 세 파일 `grep` 한 번이 120초 제한을 넘겨 뒤로 넘어갔다(결과는 다 나왔음 — 거절 아님, 이후 Grep 도구 사용).
- 명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0) · 서버 띄우기 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · 프로필 복사 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · 원서(CMDT) 열지 않음(합성 PDF·지어낸 글만) · headless 한 번에 하나 · 앱 파일은 변이 뒤 바이트 비교로 원본과 같음.
