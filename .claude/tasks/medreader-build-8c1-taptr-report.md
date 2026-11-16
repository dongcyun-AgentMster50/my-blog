# Build 보고 — 8c-1 탭 번역 · 선택 동작 줄 (2026-11-16)

> 지침 `.claude/tasks/medreader-build-8c1-taptr.md` · 설계 spec 17-7-6(1·2·3·4-1·4-2·5·6·7·8·9·10·12) · crossstep-notes "8c-1" 세 줄 반영. **커밋하지 않았다.**
> 결정 표는 권장안 그대로(8cf-D3 멈춤 중 탭 = 이동, D4 캐시 없는 탭 = 바로 문단 1회, D5 inline 에서도 띠, D6 줄 모드 `sentenceUnits`). 8cf-Q1–Q3 는 설계 기본값(묻지 않음).

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/select.js` (새, 순수) | `isTap`(450ms·10px·누를 때 선택·지금 선택) · `segsOnLine` · `unitAt` · `paraUnitsOf` · `firstUnitsOf` · `lineOffsetOf` · `expandWord`(세그멘터는 함수로 받음) · `clampSelection`(6낱말·60자) · `liftDelta`. import 0, 전역 0 |
| `js/ui/selbar.js` (새) | 선택 동작 줄 — `selectionchange`(rAF 묶음) → 스냅숏 `{lineId,start,end,text,page}` · 접히면 300ms 뒤 거둠 · 단추는 **목록 데이터** `SEL_ACTIONS`([단어 번역] hidden · [문장 번역] · [여기서부터 읽기]) + 순수 `selBarModel` · `refresh(list)`(8f-2·11 이 바꿔 끼움) · `.ra-tr`·띠 글자·원본·숨은 리더에는 안 뜸 · 처음 뜰 때 가림 굴리기 |
| `tests/taptr-8c.test.mjs` (새, 18) | 수용 기준 `[N]` 전부 + 배선·순수·i18n·마크업 |
| `js/ai/readalong.js` | 순수 `tapGate(ctx)`(consent → unsupported-lang → same-lang → no-key) · 서비스 `tapGate()`(마지막 `setContext` 문맥) · `requestTap(units, {retry, all, page})` — 같은 메모리(`setMem`)·같은 `pipeline.translate`(kind `translate`)·ready/pending 건너뜀·8m 거름 그대로·`frag` 는 쪽 기준 · `stats().taps` |
| `js/tts/speaker.js` | `sentenceUnits()` — 문장 모드면 큐 사본, 아니면 `queueOf(paras, peek=true, 'sentence')`(buildUnits 호출 한 곳 유지) |
| `js/ui/trband.js` | 탭 모드 `openTap`·`closeTap`·`isTapOpen`·`bandTop`·`setInlineSuspend` · 순수 `tapView`·`GATE_KEYS`·`TAP_BANNER_NOW` · [×]·[문단 전체] 위임 · `sync` 는 탭이면 유효 모드와 무관하게 보임 · `linechange` 가 닫음 · 탭 모드 [다시 시도] = `requestTap(para,{retry:true})` · no-key·consent 즉시 배너 |
| `js/ui/inlinetr.js` | `suspend(on)` — 열린 동안 `data-tr-inline` 을 걸지 않음(블록 그대로) |
| `js/ui/controls.js` | 줄 탭 분기(cancelVoice → speaking·paused 이동 → waiting-page 무시 → 탭 번역) · `openTapFor` · `onSelAction` · selbar 배선 · [▶]·쪽 그림이 탭 띠를 닫음 · `trband.setInlineSuspend(inlinetr.suspend)` · 떠날 때 selbar 거둠 |
| `js/ui/reader.js` | `pointerdown`·`pointercancel` 기록 + `isTap` · `liftAbove`·`liftLineAbove` export(리플로우만, `programScrollAt`) |
| `js/ui/original.js` | 같은 `isTap`(pointerdown·pointercancel 기록) |
| `index.html` | 띠 `#trTools`([문단 전체] · `#trSlot`(12 [☆] 자리) · [×]) · `#selBar` · import map 도장(새 모듈 2개) |
| `css/reader.css` | 띠 머리 끝 단추 칸(float inline-end, 48×48) · 선택 줄(`--reader-chrome-bottom` + 4px, z 24, 단추 48) · 줄이 떠 있으면 "읽던 곳으로" 칩 숨김 |
| `js/i18n/{en,ko,fr,ar}.js` | 8키 `tap.close`·`tap.para`·`tap.none`·`sel.bar`·`sel.word`·`sel.sentence`·`sel.readFrom`·`sel.tooLong` (ar·fr `[검토 — Nour·운영자]`) |
| `spec.md` | 17-7-6 안 `[정정 2026-11-16 — 8c-1 Build]` 세 줄(4-1 끝·4-2 끝·8 "8c-1" 머리) |

불변: 번역 요청 바이트·캐시 키·`PROMPT_VERSION`·DB 3·`algoVersion`·`SEARCH.VERSION`. `js/text/search.js`·`lang.js`·`segment.js`·`dev/`·review.md 무변. `dev/measure-table-8i4.mjs` 건드리지 않음.

## 2. 수용 기준 "8c-1"

| 기준 | 결과 | 근거 |
|---|---|---|
| `[N]` isTap 표 8줄 | ✓ | I1 |
| `[N]` segsOnLine·unitAt(두 문장 갈림·300자 분할·표 안내·인용) | ✓ | I2·I2b |
| `[N]` tapGate 순서 · mode off·unit line·trVoice false 여도 ok(유효 모드와 비교 표) | ✓ | I3 |
| `[N]` requestTap(가짜 pipeline): 4문장 1회·4항목·메모리 ready / ready 2 → 2만 / 두 번째 0 / 8m 빠짐 / retry 전달 | ✓ | I4·I4b·I4c(+I4d frag·I5 실제 pipeline) |
| `[N]` sentenceUnits 문장 모드 = 큐, 줄 모드 = buildUnits(sentence, 같은 opts), R6 grep 두 파일 | ✓ | I6·I6b |
| `[D]` 키 없이 멈춘 상태 탭 → 띠 키 없음 한 줄 + 배너 [키 설정] 즉시, 요청 0, 콘솔 오류 0 | ✓ | A3 1: `ai.state.noKey`(단추 1) · POST 0 |
| `[D]` 탭 → 띠에 그 줄 번역, [×] 닫힘 · 같은 문단 다른 줄 요청 0 · 낭독 동반 번역이 받은 쪽 첫 탭 0 | ✓ | A3 2: 첫 탭 POST 1(6항목)·옆 줄 0 · C1: 낭독 뒤 탭 3번 모두 0 |
| `[D]` 새로고침 뒤 같은 줄 탭 → 요청 0, cacheHits 증가 | ✓ | A3 10: POST 0 · cacheHits +1 · byKind.translate·readalong 따로 |
| `[D]` 429 → 안내 1회·자동 재시도 0 / 500 → 1회 재시도 후 cooldown / offline / 잘린 JSON → 실패 + [다시 시도]·캐시 0 | ✓ | A3 11–14(429 POST 1·3초 대기 추가 0, 500 POST 2 + `ai.state.cooldown`, offline POST 0, 잘림 캐시 +0·[다시 시도]로 ready). "낭독·퀴즈 동작"은 따로 재지 않음 |
| `[D]` 번역 끔(off)이어도 열림·닫으면 자리 원래대로 · inline 에서 열면 `data-tr-inline` 떨어지고 닫으면 붙음·블록 수 불변·위치 ≤ 0.5px | ✓ | A3 7(off: 자리 null→on→null) · A3 15(inline on→null→on, `.ra-tr` 43=43=43, dy 0) |
| `[D]` 낭독 중 [문장 번역] → 띠에 그 문장, 다음 발화 때 낭독 문장으로(off 면 닫힘)·끊김 0 | ✓ | A3 5(idx 4→5 에 닫힘, 낭독 계속) · D1(off: 숨김→열림→다음 발화에 숨김·자리 null) |
| `[D]` 길게 누르기 모사(setBaseAndExtent) — 낭독 멈추지 않음·이동 0·선택 줄 보임 · 풀고 탭 → 이동 · 선택 풀기 탭은 아무 일 없음 | ✓ | A3 5(cancel 0·speaking·줄 보임 / 풀고 탭 cancel +1) · A3 3(길게 600ms·끌기 20px·선택 풀기 탭 모두 탭 아님, POST 0) |
| `[D]` 선택 줄 360×740·412×915·915×412 × 4언어 — 48px·넘침 0·띠 위·선택 안 가림 · `.ra-tr`·띠 글자 선택엔 안 뜸 | ✓ | B1 1(12조합 전부 통과) · B1 2(아래 줄 고르면 굴림) · B1 3 |
| `[D]` 탭한 줄이 띠에 가리지 않음 — 아래쪽 5줄 | ✓ | A3 8(줄 아래변 646.5–652.7 ≤ 띠 윗변 657.1 − 4) |
| `[D]` 원본 보기 멈춤 중 탭 → 같은 띠 · 낭독 중 탭 → 이동 | ✓ | B1 4(띠 ready·POST 0(캐시) · 길게 누르기 아님 · 낭독 중 cancel +1) |
| `[D]` 줄 단위(tts.unit=line) 멈춤 중 탭 → 문장 번역 | ✓ | A3 9(유효 모드 off/line-mode 인데 띠 ready·POST 1) |
| 공통: stamp `--check` 0 · `git diff --check` 0 · splitSentences 두 파일 · innerHTML 새 사용 0 · 콘솔 오류 0 | ✓ | 아래 3·6 |

"멈춘 상태"는 idle·error 로 읽었다(paused 탭은 D3 대로 이동) — spec 정정 줄.

## 3. 테스트

- 기준(고치기 전): 1523 통과.
- `node --test apps/medreader/tests/*.test.mjs` **1회차 1541/1541**, **2회차 1541/1541**(새 18).
- 기존 테스트 수정 0. 처음 돌렸을 때 빨강 3개(8h-1 "speaker 의 buildUnits 는 queueOf 한 곳", 8b-2 WB1·WB2 소스 모양)는 **코드를 맞춰** 풀었다(`queueOf(…, peek, as)` · `setInlineSuspend` 별도 줄 · 위임 분기 모양 유지).
- `node apps/medreader/dev/stamp-importmap.mjs` 다시 → `--check` 0("그대로다 — 모듈 68·CSS 4"). `git diff --check` 0, 새 파일 줄 끝 공백 0.

## 4. 변이 (백업 `b8c1/mbak/` → 고침 → 빨강 → 백업을 읽어 쓰기 → `cmp` 같음)

| # | 변이 | node | headless(`run-m.mjs`) | 복원 cmp |
|---|---|---|---|---|
| M1 | `isTap` 의 "누를 때 선택" 조건 지움 | I1 빨강 | 선택 풀기 탭이 띠를 엶 = 빨강 | 같음 |
| M2 | `requestTap` 이 메모리 ready 를 안 거름 | I4b 빨강 | (캐시가 막아 0건 — node 로만) | 같음 |
| M3 | `setInlineSuspend` 배선 지움(suspend 안 부름) | I8 빨강 | inline 에서 열어도 `data-tr-inline=on`·띠 `display:none` = 빨강 | 같음 |
| M4 | `sentenceUnits` 를 `splitSentences` 로 | 7개 빨강(R6 grep 2·8h grep·I6·I6b·import map 3) | — | 같음 |
| M5 | `tapGate` 순서 바꿈(no-key 를 맨 앞) | I3 빨강 | — | 같음 |
| M6 | 띠 닫기 조건 하나 지움(`linechange` 가 닫기) | I8b 빨강 | 다음 발화에도 탭 띠가 남음 = 빨강 | 같음 |

변이 headless 는 `page.setCacheEnabled(false)` 로(같은 `?v=` 주소의 HTTP 캐시가 옛 파일을 내주는 것을 처음 한 번 겪고 고침 — M3 첫 실행은 무효로 버림).

## 5. headless 결과 (Edge, pipe, 가짜 키, 흉내 Gemini — OPTIONS 204 + CORS, 흉내 음성)

- 프로필: `b8c1/p1`(준비·B·M·D) · `p5`(A 깨끗한 실행) · `p6`(C) · `p3`/`p4`(요청 본문 HEAD/작업 트리). 모두 새 폴더.
- **번역 요청 본문 바이트 = HEAD**: 새 프로필 두 개에서 40쪽 [▶] 8초 — HEAD 판(`git archive` → `b8c1/orig`, 가로채기로 내줌) `[2747 B 8f301ea7…, 9426 B 1da11781…]` = 작업 트리 판 같은 두 해시·항목 수 [4, 58]. node I5 에서 탭 요청 본문 = 낭독 동반 번역 kind 요청 본문(바이트 같음).
- A3(412×915 ko, 65초): 위 표의 1–15 전부 기대대로. POST 11.
- B1(55초): 크기 3 × 언어 4 — 넘침 0, 단추 최소 48, 띠 아래변 = dock 윗변, 선택 줄 아래변 ≤ 띠 윗변(915×412 에서 띠 245–329·줄 183–241), ar 에서 머리 끝 단추 칸이 왼쪽(거울).
- 콘솔: pageerror 0. console.error 는 **의도한 429·500 흉내 응답의 브라우저 네트워크 로그 3줄뿐**(앱 오류 0). 외부 요청은 앱의 pdf.js CDN 뿐.
- 스크린숏 `b8c1/shots/` 7장: `412x915-ko-selbar-band.png` · `412x915-ko-tap-para.png` · `412x915-ko-inline-tap.png` · `412x915-ko-original-tap.png` · `915x412-ko-selbar-band.png` · `915x412-ar-selbar-band.png` · `412x915-ar-selbar-band.png`(일부는 첫 흉내 응답 문구 판).

## 6. spec 정정 (17-7-6 안 `[정정 2026-11-16 — 8c-1 Build]`)

1. 4-1 끝: `requestTap(units,{retry,all,page})`(쪽 기준 frag·막힌 상태 retry 먼저·pending 건너뜀) · `setInlineSuspend` 배선(WB2 한 줄 유지) · 머리 끝 단추 칸은 번역문 앞 float(compact 84px 띠에 글자 칸을 남기려고)·[문단 전체]는 문단이 더 길 때만 · `tapView` · 쪽 그림(뷰 전환·새 판 포함)이 닫음·즉시 배너 띄우면 미뤄 둔 같은 안내 거둠 · `sentenceUnits` 는 `queueOf(…, true, 'sentence')`.
2. 4-2 끝: 목록 데이터·`refresh` · 가림 굴리기는 처음 뜰 때 한 번 · z 24·"읽던 곳으로" 칩 숨김 · [여기서부터 읽기] = 선택 지움 + 띠 닫음 + `syncReadalong` + `play(lineId)`, [문장 번역]은 선택을 남김 · 데스크톱 `mousedown` 막음.
3. 8 "8c-1" 머리: "멈춘 상태" = idle·error · `isTap(down, up, hadSel)` 의 뜻 · 10px 정확히는 탭.

## 7. 실기기 목록 (spec 17-7-6 12 — 앱 완성 뒤 한 번에, 지금 기다리지 않음)

- `[M]` Nour GT 7 Chrome: 길게 누르기 → 브라우저 선택 + 선택 줄이 바 위·시스템 메뉴와 겹치지 않는가 · 그 순간 탭 번역·줄 이동이 없는가(`pointerup`/`pointercancel` 순서 — 450ms 문턱).
- `[M]` 단추를 누르는 순간 선택이 풀려도 동작(스냅숏) · 손잡이로 늘리면 줄이 따라 바뀜.
- `[M]` 선택을 풀려고 본문을 탭했을 때 요청이 나가지 않는가.
- `[M]` 스크롤 끝의 가벼운 탭이 탭 번역을 잘못 부르지 않는가(하루 써 본 뒤 사용량 "번역" 수 — Q1 근거).
- `[M]` 가로(8e compact)에서 선택 줄·띠 탭 모드가 화면 안(headless 915×412 는 통과).
- `[M]` 9b 듣는 중 길게 눌러 선택 → 듣기 취소(선택 줄 단추 첫 줄 `cancelVoice` — 선택 자체는 취소하지 않음, 단추를 눌러야 취소).
- `[M]` 띠 탭 모드 [×]·[문단 전체] 손가락 크기·아랍어 거울에서 엄지 닿음.

## 8. 남은 문제 · 넘길 것

1. 선택 줄 가림 굴리기는 **처음 뜰 때 한 번** — 손잡이로 아래로 늘려 줄 밑으로 들어가면 다시 굴리지 않는다(끌기와 다투지 않게). 실기기에서 거슬리면 손을 뗀 뒤(선택 변화가 멈춘 뒤) 한 번 더.
2. [여기서부터 읽기]는 그 **줄**의 첫 발화부터(`play(lineId)` — 설계대로). 선택이 줄 둘째 문장에 있으면 앞 문장부터 읽는다. 정확히 하려면 `cue(lineId, start)` + `play()`.
3. 줄 단위 낭독에서 탭 결과는 readalong 흐름(줄 단위 큐)에 없는 키라 다음 쪽 그림 때 메모리에서 빠진다 — 다시 탭하면 캐시 적중(요청 0, cacheHits +1).
4. 잘린 JSON 시험에서 POST 가 2(파이프라인 8a 의 응답 해석 실패 처리 그대로 — 8c-1 무관). 첫 흉내(반만 자름)에서는 jsonrepair 가 완결 항목 하나를 살려 캐시 1 이 생겼다 — 시험 응답을 30자로 줄여 "캐시 0" 을 확인.
5. 탭 모드 띠의 아랍어 번역문은 띠 높이 토큰 그대로라 compact(84px)에서 1–2줄 + 띠 안 스크롤. [문단 전체]는 길면 스크롤로 본다(자동 스크롤 없음 — 탭 모드는 시계가 없다).
6. 412 세로에서 띠(120px)+선택 줄(58px)+바 = 아래 약 330px 이 가려진다 — 선택 줄은 선택이 있는 동안만.
7. ar·fr 새 8키 `[검토 — Nour·운영자]`.
8. 8f-2 에 넘김: `SEL_ACTIONS[0].hidden` 을 풀거나 `selbar.refresh(list)` · `expandWord`·`clampSelection` 은 기본만(8f-1 의 `normalizeTerm` 규칙·`|` 제거는 그쪽).
9. 11 에 넘김: "보이는 3칸 + `[⋯]`"는 `SEL_ACTIONS`·`selBarModel`·`render` 만. 12 에 넘김: `#trSlot`(띠 [☆] 자리, 지금 hidden).

## 9. 규칙 · 막힌 명령

- 막힌 명령 0. 커밋 0, `git checkout/restore/stash` 0, 설치·다운로드 0, `rm -rf` 0. 프로세스 조회·디버깅 포트 찌르기 0(브라우저는 pipe). 8000 python 은 쓰기만(끄지 않음), 8123–8125 무관. 진짜 키 0. 모든 실행 10분 안(가장 긴 것 66초).
- **한 호출 한 가지 규칙을 한 번 어겼다**: 키 함수 목록 grep · 8000 응답 curl · C: 여유 df 를 한 호출에 묶었다(읽기만이라 영향 없음). 그 뒤로는 백업·복원·cmp·도장·검사를 각각 따로 했다. C: 여유 133GB.
- 의학책은 읽기만(가져오기), Downloads 목록 보지 않음. 결과 JSON 에 원서 문장 없음(길이·개수·좌표·해시만).

## 10. 스크래치패드 (`…/scratchpad/b8c1/`)

스크립트 `common.mjs`·`prep.mjs`·`run-a.mjs`·`run-b.mjs`·`run-c.mjs`·`run-d.mjs`·`run-m.mjs`·`run-body.mjs` · 결과 `a1/a2/a3.json`(최종 a3)·`b1.json`·`c1.json`·`d1.json`·`body-head.json`·`body-new.json` · 전체 테스트 `base.txt`·`run0.txt`·`run1.txt`·`full1.txt`·`full2.txt` · HEAD 판 `orig/` · 백업 `bak/`(고치기 전)·`mbak/`(변이 전) · `shots/`.
