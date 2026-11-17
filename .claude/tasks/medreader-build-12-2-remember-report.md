# Build 보고서 — 12-2 기억 카드 만들기: 띠 [☆] 세 모드 · 선택 줄 [기억 카드] · 음성 "기억"

> 지침: `.claude/tasks/medreader-build-12-2-remember.md` · 설계: spec **17-11** 5·7·8·10·13 + 4 의 삭제 확인 한 줄 · 12-1 보고서·review.md 12-1 계열 절·crossstep "12-2". 직전 배포 12-1 `71e9258`.
> 커밋하지 않았다. 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b12-2\`.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/remember.js` **새**(282줄, ui 계층 — import `srs/cards`·`text/summary`·`text/select`·`./ask.js`(순수 `sentenceIndexOf`)) | 순수 `cardInput`·`unitsFor`·`selectionUnit`·`voiceUnit`·`starPressed` · 서비스 `createRemember({readalong, speaker, units, ctx})` → `stateFor`·`toggle`(띠) · `fromSelection` · `fromVoice` · `leave` · `debug`. 뒷면 = 메모리 → `cachedFor`(캐시 읽기), 없으면 앞면만 + `pendingBacks`(onChange → `fillBack` 한 번). **pipeline 없음** |
| `js/ui/trband.js` | 순수 `starTarget`(세 모드)·`touchHolds` · `[☆]` 배선(`setRemember`·`refreshStar`·`syncStar`·`paintStar`·`onStar`·`flash`) · 낭독 모드 머리 칸 = [☆] 홀로([×] 등 숨김, 탭·설명에서 [×] 다시 보임) · `openNote` 가 문장 단위를 물음(`noteUnit`) · 굴림 멈춤은 `touchHolds` · 디버그 `star` |
| `js/ui/selbar.js` | `SEL_ACTIONS` `[⋯]` 안 `remember`([여기서부터 읽기] 다음) · `note(key)` 한 줄 |
| `js/voice/commands.js` | 표 끝 `remember` 한 줄(설계 표 그대로 + exact `save` 를 en 칸에도 — 표 무결성 규칙 "exact 는 표 안") |
| `js/ui/voice.js` | `exec` 갈래 `remember` + `remember(was, heard)`(askFor 밖 · `askJob` 으로 손이 이김 · 되돌림은 `say`→`restore(was)` 한 곳) · deps 문서 |
| `js/ui/controls.js` | `createRemember` 배선(pipeline 안 넘김) · `trband.setRemember` · voice `onRemember` · 선택 줄 `remember` 갈래 · `noteUnitFor`(설명 띠 문장 단위 — `explainSnap`·음성 지금 문장·줄별 기억) · `leaveControls` 에서 `remember.leave()` |
| `js/ui/library.js` | `deleteKeepLines` 에 `cards` 조각 · `deleteKeepCounts` 에 `cards`(`cardStore.keptCount`, 1 이상만) · `deleteConfirmText` 가 조각을 **한 줄**(`library.card.deleteKeeps`) |
| `index.html` | `#trSlot` 안 `#trStar`(+ 글리프 `#trStarGlyph`) · 주석 · stamp(모듈 89) |
| `css/reader.css` | `.tr-star` 48×48 · 눌림 · busy(논리 속성만) |
| i18n 4개 | 13키(아래 6) · 기존 `deleteConfirmVocab`·`deleteConfirmSummaries` 값을 조각 문구로 · ar·fr `[검토 — Nour·운영자]` |
| `tests/remember-12.test.mjs` **새**(13) | R1–R13 |
| `tests/` 기대 변경 5파일 | 7절 |
| `spec.md` | 17-11 5 끝 `[정정 2026-11-17 — 12-2 Build]` ①–⑧ · 17-1-2 명령 표 `remember` 한 줄 |

**`js/ui/ask.js` 무변** — 음성 "기억"은 AI 호출이 없어 `askFor` 흐름(기다림 문구·요지 말하기)을 탈 까닭이 없어 voice.js 안 따로 갈래로 두었다(되돌림 규칙은 같은 `say`/`restore`). 설명 띠의 문장 단위도 ask 를 고치지 않고 controls 가 같은 규칙으로 고른다(spec 정정 ④). `srs/*`·`ai/*`·`db.js`·`backup/*`·`config.js`·review.md·`dev/` 무변(`git diff --stat` 에 없음). 추적 안 된 `dev/measure-table-8i4.mjs` 손대지 않음. DB 3·`algoVersion`·모든 `*_PROMPT_VERSION` 무변.

## 2. 수용 기준 "12-2"

| 기준 | 결과 | 근거 |
|---|---|---|
| `[D]` speak 낭독 → 띠 `[☆]` → 카드 1(`sentence`·front=그 문장·back=띠 번역문·`band`) · `[★]`·`aria-pressed=true` · 요청 0 증가 · 낭독 끊김 0 | ○ | headless A1: 카드 1 · front·back 일치 · ★/"기억 카드에 있음 — 다시 누르면 뺍니다" · 누름 구간 POST 0 · 표본 44 중 speaking 아닌 것 0 · 다음 linechange 0→1 · 손가락 탭 뒤 `held` false(대조: 띠 본문 탭 → true) |
| `[D]` 번역 pending 에서 `[☆]` → 앞면만 → 도착하면 같은 카드에 back | ○ | A2(번역 6초 지연): 저장 때 back 0자 → 도착 뒤 같은 카드 33자(그 문장의 흉내 번역과 일치) · `updatedAt` 오름 · translate POST 2(낭독 동반 몫) · 다른 POST 0 · node R5 |
| `[D]` `[★]` 다시 → 지움 · 복습한 카드면 남고 한 줄 | ○ | A3(멈춘 채): 저장 1 → 지움 0 → 다시 저장 → `reviewedAt` 심고 누름 → 카드 1 남음·[★] 그대로·한 줄 `remember.reviewed` · node R4 |
| `[D]` 탭(8c-1)·설명(11-4) `[☆]` → `tap`·`explain`, 설명 사본 · [문단 전체]에서 없음 | ○ | A4 탭: 카드 1 `tap`(back 94자) · 칸 `[문단 전체]·[☆]·[×]` · [문단 전체] 보기 [☆] 숨김 → 되돌리면 보임. 두 문장 줄은 합성 PDF 4쪽에 없어 node R6(카드 둘) · A5 설명: 단추·[다시 시도] 뒤·음성 «اشرح» 모두 `explain`·설명 91자·**앞면 = 설명 요청의 문장**(해시 비교) · 실패 동안 [☆] 숨김 |
| `[D]` 문장 아래 표시·번역 끔에서 선택 → `[⋯]` → `[기억 카드]` → 카드(캐시에 번역 있으면 back) · 요청 0 | ○ | A6(번역 끔): 메뉴에 칸 · 캐시 번역으로 back 95자 · 이미 있는 문장은 "이미 기억 카드에 있습니다." · POST 0 · A6b(`data-tr-inline=on`): 카드 1 · POST 0 · node R8 |
| `[D]` 음성 «احفظ» 낭독 중 → 카드 1·확인 줄·한 마디(utterance 1)·재개 · sayErrors=false → 한 마디 없이 재개 · 표 안내 위 → none 한 마디·카드 0 | ○ | A7: paused → 카드 1 `voice`(front=지금 문장) · 확인 줄 · ko-KR 한 마디 1 → speaking 같은 번호 · 꺼짐: 한 마디 0 → speaking 같은 번호 · `restores` 2. 표 안내 위는 합성 PDF 에 표 안내가 없어 node R9(fromVoice none·카드 0)·R10(none 한 마디 → 되돌림) |
| `[N]` 명령 표 무결성(C3) — 공유 0 · `save` 는 exact | ○ | voice-commands-9b C3·C4(기대 id 목록에 remember) · R11(«احفظ»·«من فضلك احفظ»·"please save" → remember · "save the patient"·"don't save this"·«لا احفظ»·"I remember the patient" → 무효 · 기존 명령 그대로) |
| `[D]` 서재 삭제 확인: 단어장 2·기억 카드 3·요약 0 → "단어장 2 · 기억 카드 3 는 남습니다" · 지운 뒤 다섯 장 | ○ | A8: ko 정확히 그 줄(머리 + 한 줄) · en/fr/ar 한 줄 · 지운 뒤 term 2 + sentence 3 |
| `[D]` 띠 `[☆]` 360×740·412×915·915×412 × 4언어 — 48px·겹침 0·RTL 거울 · `innerHTML` 새 0 | ○ | L(pL2): 12조합 × 세 모드 모두 48×48 · 머리 칸 단추끼리 겹침 0 · 번역문·상태 줄 글자와 겹침 0 · ar 왼쪽/그 밖 오른쪽 · 화면 안 · 가로 넘침 0 · `[⋯]` [기억 카드] 칸 48px·화면 안. `innerHTML` 추가 0(diff grep) |
| 공통: 전체 시험 · `--check` 0 · splitSentences 3파일 · 콘솔 오류 0 · 무료 티어 숫자 0 · 새 원격 요청 0 · 진짜 키 0 | ○ | 5절 |

## 3. 호출 0 근거

- **구조**: `remember.js` 는 pipeline 을 import·주입받지 않는다(R13 정적: import 4개 · `pipeline|requestTap|fetch` 0) · controls 의 `createRemember({…})` 인자에 pipeline 없음(R13). readalong 은 `get`·`cachedFor`(캐시 IndexedDB 읽기만 — readalong 주석 "요청하지 않는다")·`onChange` 만.
- **node**: `remember-12` 파일 전체에서 가짜 `fetch` 호출 0, 가짜 readalong 의 `requestTap`·`retry` 0(R4–R9).
- **headless**: 흉내 Gemini 가로채기 — 띠 [☆] 누름 구간 POST 0(A1) · 선택 줄 번역 끔 POST 0(A6) · 문장 아래 표시 POST 0(A6b) · pending 흐름은 낭독 동반 번역 몫(translate 2)만 · 전체 POST 종류는 translate(낭독·탭)·explain(설명 단추·음성 — 사용자 호출)뿐.
- **본문 바이트**: `r11-4/rbody.mjs`(읽기만, 그 자리 실행) 6조합 40본문 **HEAD 와 같음** · `ai/*` git diff 0.

## 4. 띠 세 모드 · 선택 줄 · 음성

- **낭독**: [☆] 홀로(문장일 때만 — 표 안내·인용·재생 전 숨김). 문장이 바뀌면 `stateFor` 한 번(해시 + get). 누르면 저장/지움, 상태 줄에 2.5초 한 줄.
- **탭**: [문단 전체]·[☆]·[×] — 탭한 문장들(둘이면 카드 둘 · [★] 은 모두 있을 때). [문단 전체] 보기에서 숨김.
- **설명**: 꼬리표·[☆]·[▶ 다시 듣기]·[×] — ready 일 때만. 설명 사본 + 있으면 번역. 설명 없는 기존 카드는 [☆] 로 보이고 누르면 설명을 채움(지우지 않음).
- **선택 줄**: `[⋯]` = [요약]·[여기서부터 읽기]·[기억 카드]·[찾아보기]. 토글 아님("이미 있음"). 저장 뒤 띠 `refreshStar`.
- **음성**: «احفظ» 등 → 저장 → 확인 줄 + 한 마디(UI 언어 — ar «تم الحفظ») → `restore(was)`. 저장 기다리는 사이 손 → 되돌림 없음(R10).

## 5. 시험 · 점검

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,866/1,866 · 1,866/1,866**(`b12-2/full1.tap`·`full2.tap`). 새 13개.
- stamp 다시(단독) → `--check` "그대로다(모듈 89 · CSS 4)" · `git diff --check` 0 · 새 파일 둘 `--no-index --check` 0.
- `grep -rln splitSentences js/` = `text/cite.js`·`text/segment.js`·`tts/text.js`(HEAD 와 같음).
- **9b 말뭉치**(`b12-2/rvoice.mjs` — HEAD `commands.js` 사본(git show) vs 작업 트리, 말뭉치 r9b1·r9b2·r9b3 읽기만): **692판 결과 객체 차이 0 · 이웃 셋 묶음 688판 차이 0 · enabled 차이 0 · 말뭉치 안 remember 적중 0** · 기존 11행 표 그대로.
- 회귀(node): 8c-1 taptr · 11-2 sumsheet · 11-4 explain · 18 links · 9a·9b voice · 8f-2 wordsheet · 서재 삭제 확인 전부 통과.

## 6. 변이 (전부 빨강 → 복원: `b12-2/bak/cur/` 사본을 읽어 쓰기 + `cmp` 다섯 파일 0)

| # | 변이 | 빨강 |
|---|---|---|
| M1 | 띠 단추 누름이 굴림 멈춤으로 새어 감(hold 가 `touchHolds` 안 봄) | R13 |
| M1b | `touchHolds` 늘 참 | R3 |
| M2 | 뒷면 대기(`pendingBacks`) 지우기 | R5 |
| M3 | `removeIfFresh` → `remove`(복습 카드도 지움) | R4 · R13 |
| M4 | 음성 경로 `restore(was)` 빼기(성공 한 마디) | R10 · R13 |
| M4b | 음성 none 경로 `restore` 빼기 | R10 |
| M5 | "save" exact 빼기 | R11 |
| M6 | 삭제 확인을 한 줄로 합치지 않음 | R12 · K13 · W13 |
| M7 | 설명 모드 [★] 가 설명 사본을 안 봄 | R7 |
| M8 | [문단 전체] 보기에서도 [☆] | R3 |
| M9 | 삭제 확인이 기억 카드를 안 셈 | R12 · W13 |

## 7. 기존 시험 기대를 바꾼 곳(이유)

- `links-18` L9 · `taptr-8c` I7b · `sumsheet-11b` K10 · `wordsheet-8f` W14 — **선택 줄 id 목록**에 `remember`(`[⋯]` 안, [여기서부터 읽기] 다음 — 설계 5 표).
- `voice-commands-9b` C3 — **명령 id 목록** 끝에 `remember`(17-11 5).
- `wordsheet-8f` W13 · `sumsheet-11b` K13 — 삭제 확인 문장이 **한 줄**(`library.card.deleteKeeps` 안 조각 — 설계 4 "한 줄로 합친다") · W13 의 `deleteKeepCounts('docDel')` 가 문장 카드 1 을 셈(`{vocab:2, cards:1}` — W13 주석이 "확인 줄은 12-2 몫"이라 적어 둔 그 몫). `deleteKeepLines` 꼴(키·n)은 그대로.

## 8. headless (Edge · pipe · 새 프로필 `b12-2/p*` · 가짜 키 `…build_b12_2` · 흉내 Gemini OPTIONS 204 + CORS · 흉내 음성 · 9b 가짜 인식기 · 캐시 끔 · **서버 없음**(가로채기) · 합성 PDF `b11-2/syn.pdf` 읽기만 · 한 번에 하나)

| 실행 | 프로필 | 시간 | 결과 | 콘솔 오류·pageerror·외부·없는 파일 |
|---|---|---|---|---|
| `run-a.mjs`(수용 기준 A1–A8) | pA4(마지막) · pA1–pA3(하네스 손질) | 53초 | 2절 표 | 0·0·0·0 |
| `run-l.mjs`(배치 12조합 × 세 모드 + `[⋯]`) | pL2 | 72초 | 나쁨 0 | 0·0·0·0 |
| `run-t.mjs`(b11-4b 사본 — 8c-1 탭 띠·닫기 다섯·손가락 탭·inline 떼기) | pT1 | 26초 | 11-4b 와 같은 값(탭 요청 1 · `inlineSeq on,null,null,null,on`) | 0 |
| `run-r.mjs`(b11-4b 사본 — 18·Esc 층 셋·손가락·9a·9b·8e dock) | pR1 | 29초 | r11-4 `r1.json` 과 같음 — **다른 것 하나: 915×412 `[⋯]` 메뉴 top 24→5·높이 162→181**(칸 하나 늘어남, 여전히 바 위·화면 안) | 0 |
| `run-v.mjs`(b11-4c 사본 — 설명 실패 사유 다섯·배너·[다시 시도]·이어 읽기·쪽/문서 바뀜·was 이어받기·429·상한) | pV1 | 190초 | b11-4c `v1.json` 과 같음(배너 뜬 시각 ms 흔들림 2곳만) | 의도한 흉내 429 한 줄(11-4c 와 같음) · 그 밖 0 |

- 첫 `run-l` 1회(pL1)는 준비 단계(합성 PDF 올린 뒤 리더 주소 대기 60초)에서 시간 초과 — 12-2 단계 전, 콘솔 오류 0. 새 프로필 pL2 로 다시 돌려 통과(재현 안 됨 — 기록).
- 스크린샷 `b12-2/shots/`: `b1-band-ko-412.png`(낭독 [☆] 홀로) · `b2-tap-ar-360.png`(탭 — RTL 거울 [×][☆][문단 전체]) · `b3-explain-fr-360.png`(설명) · `b4-band-ko-915x412.png`(가로 dock) · `b5-selmenu-en-412.png`(`[⋯]` 메뉴 [기억 카드]) · (`run-r` 사본이 찍은 `10-dock-menu-ko-915x412.png` — 가로 `[⋯]` 메뉴 넷 칸).

## 9. spec 정정 (그 자리만 Edit)

1. **17-11 5 끝** `[정정 2026-11-17 — 12-2 Build]` ①–⑧: 한 길·호출 0·pendingBacks · 띠 단추 자리·낭독 모드 홀로·`starTarget`·`touchHolds`·`flash` · 설명 모드 [★] = 설명 사본까지 · 설명 띠 문장 단위는 controls(`noteUnitFor`, ask 무변 — 남는 틈) · 선택 줄 순서·토글 아님 · 음성 따로 갈래·두 낱말 구 · 삭제 확인 한 줄(키 조각화) · i18n 13키.
2. **17-1-2 명령 표** `remember` 한 줄(`[신설 2026-11-17 — 12-2 Build]`).

## 10. 실기기 점검 (spec 17-11 13 — 적기만, 앱 완성 뒤 한 번에)

- [ ] `[M]` Nour GT 7: 낭독 중 띠 [☆] 을 엄지로 누르기 쉬운가 · 잘못 눌러 줄 이동·띠 굴림 멈춤이 생기지 않는가(세로·가로). 탭·설명 띠에서 [☆]·[×] 를 헷갈리지 않는가.
- [ ] `[M]` 음성 «احفظ» 가 시리아 말씨로 잡히는가 · «اقرأ»·«وقف» 등과 헷갈리지 않는가 · 한 마디 «تم الحفظ» 뒤 낭독이 이어지는가.
- [ ] `[M]` (12-3 뒤) 복습 화면 [▶] 원문·번역문 목소리 · 괄호 속 원어가 소리에서 빠지는가.
- [ ] `[M]` 자정 넘김(시리아 시간) "오늘" 줄 숫자 — 12-3.
- [ ] `[M]` 하루 써 본 뒤 하루 새 카드 20 · "다시" 3장 뒤(Nour 말) — 12-3.
- [ ] `[M]` 9c 백업 → 새 기기 가져오기 뒤 카드·복습 일정이 이어지는가.
- [ ] `[M]`(12-2 더함) ar 이름 «بطاقات المراجعة»·fr «fiches de révision» 이 자연스러운가 · 서재 삭제 확인 한 줄(ar «سيبقى ما يلي: …») 읽힘.

## 11. 남은 문제 · 넘길 것

1. **설명 띠 문장 단위의 남는 틈(낮음)** — 한 줄에 두 문장이 있고 둘 다 설명한 뒤, 앞 문장의 **배너** [다시 시도](11-4b — 낭독이 이어져 띠가 닫힌 뒤)를 누르면 [☆] 가 뒤 문장 단위를 잡는다(controls 가 줄 id 별 마지막 단위를 기억). ask 가 `openNote` 에 단위를 넘기면 없어진다(ask.js 한 줄 — 이번 범위 밖이라 두었다).
2. **두 낱말 구의 포함 일치(낮음·9b 규칙 그대로)** — "save this one"·"keep this in mind" 처럼 긴 영어 말 안의 "save this"·"keep this"·"remember this" 도 remember(“speed up” 과 같은 동작). 말뭉치 적중 0. `[검토 — Nour·운영자]`.
3. **915×412 `[⋯]` 메뉴** 칸이 넷(링크 있을 때)이 되어 높이 181px·윗변 5px — 화면 안이지만 여유가 없다. 칸이 더 늘면(20 등) 메뉴 안 굴림이 생긴다(`maxBlockSize` 는 이미 있음).
4. **[★] 의 옛 상태** — 띠는 문장이 바뀔 때만 묻는다. 다른 화면(12-3 목록)에서 카드를 지우고 같은 문장에 돌아오면 [★] 가 남을 수 있으나, 누르면 저장소의 실제 상태로 판단해 저장한다(지우지 않음). 선택 줄·음성 저장 뒤에는 `refreshStar`.
5. 탭 띠의 [☆] 은 "번역 대상 문장"(8c-1 `tapPlan`)만 — 원문 = 대상 언어인 문장은 탭 띠에 문장이 없어 [☆] 도 없다(선택 줄·음성으로는 만들 수 있다).
6. 상태 줄 한 줄(`flash`)은 2.5초 동안 띠의 상태 문구("번역 중…" 등)를 가린다.
7. 12-3 몫(넘김): 카드 `origin`·`explain`·`srcLang` 이 채워져 있음 · 뒷면 빈 카드는 복습 때 `fillBack` · `keptCount` 는 docId 기준(crossstep "지우고 다시 가져온 문서" 틈 그대로).

## 12. 막힌 명령 · 규칙

- 막힌(거절된) 명령 없음. 백그라운드로 넘어간 것 둘: 처음의 i18n `grep`(결과는 앞부분만 쓰고 다른 도구로 다시 봄) · `run-v` 190초(끝까지 기다림 — 그동안 다른 headless·변이 0).
- 명령은 한 호출에 한 가지(묶음 0) · 서버 띄우기 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · 설치·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · 프로필 복사 0 · `.nojekyll` 그대로 · 원서 열지 않음(합성 PDF·지어낸 문장만) · 앞 하네스(`r9b*`·`r11-4`·`b11-4b`·`b11-4c`)는 읽기·사본만.
