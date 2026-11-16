# Build 보고 — 8f-2 단어 시트 (선택 줄 [단어 번역] 켜기)

> Build 서브에이전트, 2026-11-16. 지침 `.claude/tasks/medreader-build-8f2-wordsheet.md`, 설계 spec 17-7-6(3·4-2·4-3·4-5·5 8f-2 행·6·7·8 "8f-2"·9·10·12 + 그 안의 `[정정 — 8c-1 Build]`·`8c-1b`·`8c-1c`·`8f-1 Build` 줄), 8f-1 보고서·review.md "8f-1 Review", 8c-1·8c-1c 보고서, crossstep "8f-2·11-2"·"8f-1 Review 에서 넘긴 것". 운영자 위임(권장안 — 8cf-Q1–Q3 설계 기본값). **커밋하지 않았다.** 직전 배포 `89a8965`(8f-1).

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/wordsheet.js` (새, 663줄 — 설계 추정 약 330줄의 두 배: 주석·DOM 없는 흐름을 따로 둔 몫) | 순수 `pickSurface`(하이픈 결합 앞·뒤·여러 줄 선택) · `lookupWord`(★ 호출 0 길만 — 단어장 → 문장 번역 메모리·캐시) · `sheetButtons` · `sheetEsc` · DOM 없는 흐름 `createSheetFlow`(open·ai·retranslate·confirmAsk·cancelAsk·save·useContext·close) · 화면 `initWordSheet`(시트 그리기·Esc·Tab 가둠·포커스 되돌림·즉시 배너·측정 훅 `__medreader.wordsheet`) |
| `tests/wordsheet-8f.test.mjs` (새, 17) | 아래 3절 |
| `js/ui/selbar.js` | 순수 `showAction(list, id)`(한 칸 켠 사본) · 스냅숏에 `multi`(선택이 다음 줄까지) · 머리말 |
| `js/ui/controls.js` (+20) | `initWordSheet(…)` 배선 · 시트가 준비되면 `selbar.refresh(showAction(SEL_ACTIONS, 'word'))` · `onSelAction` 'word' → `wordsheet.open(snap)` · `leaveControls` 가 시트를 거둠. **이유**: 시트가 쓰는 pipeline·readalong·speaker·리더 값이 controls 에만 있고 선택 줄 동작을 받는 곳도 controls 하나라 다른 길이 없다(지침 "필요하면 controls 몇 줄"). Esc 층에는 controls·trband 고침이 필요 없었다 — trband `upperLayers` 가 이미 보이는 `[role="dialog"]` 를 위층으로 센다 |
| `js/ui/library.js` (+50) | `deleteKeepLines(counts)`(순수) · `deleteKeepCounts(docId)`(읽기만) · `deleteConfirmText` — 삭제 확인이 이 한 벌을 거친다(crossstep "8f-2·11-2": 11·12 가 셈·줄을 여기에 더함). `vocab/store.js` import |
| `index.html` | `#wordSheet`(role=dialog, aria-modal=false, aria-labelledby=원어 머리, 단추 `data-ws-action`, 덮어쓰기 질문 줄, 단어장 링크 **hidden** — 8f-3) · import map 도장(모듈 71) |
| `css/reader.css` (+130) | `.word-sheet` — 팝오버와 같은 아래 붙임·높이 식(`--banners-h`·`--bar-top`·`--reader-chrome-bottom`·`--sp-6`), 안 스크롤, [닫기] sticky, z 36, 단추·칸 48px, 논리 속성만, `vs-hit` 밑줄, `:root[data-word-sheet="on"]` 이 선택 줄·"읽던 곳으로" 칩 숨김 |
| `js/i18n/{ko,en,fr,ar}.js` | `vs.*` 22키 + `library.card.deleteConfirmVocab`(ar·fr `[검토 — Nour·운영자]`) |
| `spec.md` | 17-7-6 4-5 끝 `[정정 2026-11-16 — 8f-2 Build]` 한 줄(Edit, 그 자리만) |

불변(손대지 않음): `pipeline.js`·`prompts.js`·`provider.js`·`db.js`·`readalong.js`·`speaker.js`·`trband.js`·`text/vocab.js`·`text/select.js`·`vocab/store.js`·review.md·`dev/`(추적 안 된 `dev/measure-table-8i4.mjs` 포함). 번역 요청 바이트·캐시 키·DB 3·algoVersion·`PROMPT_VERSION` 3·`TERM_PROMPT_VERSION` 1 그대로.

## 2. 수용 기준 "8f-2"

| 기준 | 결과 | 근거 |
|---|---|---|
| `[D]` 문장 번역이 캐시에 있는 쪽에서 괄호 용어 선택 → [단어 번역] → 후보가 칸에·"문장 번역에서 찾음"·**요청 0건** · [저장] → `kind:'term'`·`origin:'sentence'`·`contextTr` 사본 | ✔ | A `sentencePath`(경로 sentence·입력 9자·밑줄 1·새 요청 0/0) · `sentenceSave`(origin sentence·contextTr 있음·요청 0) · node W4·W5 |
| `[D]` 캐시에 없음 → [번역 없이 저장] 0건 / [AI 로 번역] 정확히 1건 → 번역·뜻·품사 · 저장 `origin:'ai'` · 같은 낱말 + 같은 문맥 다시 → 0건 | ✔ | A `aiPath`(none·안내 줄 보임 → AI term 1 · 뜻 보임 → 다시 열어 AI 0 → 저장 ai) · `saveBare`(0·user·번역 빈 채) · node W6 |
| `[D]` 이미 있는 낱말 → 기존 항목·새 항목 0 · 고친 항목에 [이 문맥으로 다시 번역] → 먼저 묻는다 | ✔ | A `savedReopen`(saved → 고쳐 저장 edited → 다시 번역 = 질문 줄·요청 0 → [바꾸기] term 1·origin ai) · node W5·W9 |
| `[D]` 하이픈 결합 낱말(줄 끝 `cardio-`) → 결합된 꼴로 저장 | ✔ | A `hyphen`(40쪽 `.hy` 줄 끝 조각 선택 → 원어 11자 = 두 조각 합, 하이픈·공백 없음) · node W1(앞·뒤 조각 둘 다) |
| `[D]` 낭독 중 시트를 열고 저장해도 발화 끊김 0 · `capped`·`offline` 에서 [AI 로 번역] → 요청 0·상태 한 줄 | ✔ | A `speaking`(열기·저장 동안 speaking·cancel 0·발화 계속) · `blocked`(capped → `readalong.blocked.capped`, offline → `readalong.blocked.offline`, 요청 0/0) · node W8(키 없음·동의 포함) |
| `[D]` 서재 삭제 확인에 "단어장 n개는 남습니다", 지운 뒤 `cards` 에 term 남음 | ✔ | A `delete`(confirm 2줄·"단어장 5개는 남습니다" → 문서 0·term 5 그대로) · node W13 |
| `[D]` 360×740·915×412 × 4언어: 위끝 ≥ 0·[닫기] 보임·가로 넘침 0·아랍어 번역 칸 `dir=rtl` · `innerHTML` 0 | ✔ | B 9조합(아래 5절) · node W16·W17 |
| 지침: 찾는 순서 호출 0 먼저 · [AI] 누를 때만 1호출 | ✔ | node W2·W4(세 길 모두 열기 0) · 변이 M1·M2 |
| 지침: 실패 단어 다시 누름 = `retry:true`(crossstep 8f-1 Review) | ✔ | node W7 · 변이 M5 |
| 지침: RTL·가로 dock·8e `[≡]`·8d·탭 띠·9b 와 겹치지 않음 | ✔ | B — 시트 아래변 ≤ 띠 윗변·하단 바 윗변(모든 조합), `--bar-top` 을 빼서 [≡] 상단바 밑에서 멈춤, 9b 는 단추 첫 줄 `cancelVoice()` |
| 지침: Esc·포커스 가둠·닫으면 선택했던 곳으로 · Esc 층 맨 위 | ✔ | A `escClose`(포커스 그 줄) · `escLayers`(띠+시트 → 첫 Esc 시트만·띠 그대로 → 둘째 Esc 띠, Tab 15번 시트 안) · 회귀 e2 0곳 다름 · 변이 M4 |
| 지침: 단어장 링크 마크업만·숨김 | ✔ | A `vocabLinkHidden: true` · node W16 |
| 지침: 번역 요청 바이트·캐시 키·DB·algoVersion·PROMPT_VERSION 불변 | ✔ | 아래 6절 |
| 공통: stamp `--check` 0 · `git diff --check` 0 · `innerHTML` 새 사용 0 · 콘솔 오류 0 | ✔ | 4·5절 |

## 3. 호출 수 (6절 — headless A 가로채기에서 셈)

| 동작 | 단어 요청 | 번역 요청 |
|---|---|---|
| 시트 열기 — 단어장에 있는 낱말 | 0 | 0 |
| 시트 열기 — 문장 번역에 있는 낱말(괄호 원어) | 0 | 0 |
| 시트 열기 — 찾지 못함 | 0 | 0 |
| [AI 로 번역] | **1** | 0 |
| 같은 낱말 + 같은 문맥으로 다시 [AI 로 번역] | 0(캐시) | 0 |
| [저장] · [번역 없이 저장] · [문맥을 이 문장으로 바꾸기] | 0 | 0 |
| 고친 항목 [이 문맥으로 다시 번역] → 질문 / [바꾸기] | 0 / **1**(force) | 0 |
| `capped` · `offline` 에서 [AI 로 번역] | 0 + `readalong.blocked.capped`·`.offline` | 0 |
| 키 없음·동의 없음 | 0 + 띠와 같은 한 줄 + 즉시 배너(node W8) | 0 |

A 전체: 번역 2(줄 탭 1 + [▶] 낭독 동반 1) · 단어 2 · 사용자 글(USERFIX) 본문 누출 0.

## 4. 테스트

- 기준(고치기 전) 1584/1584. 새 시험 17(`wordsheet-8f`), 기존 시험 수정 0.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **1회차 1601/1601 · 2회차 1601/1601**(`b8f2/full1.txt`·`full2.txt`).
- `dev/stamp-importmap.mjs` 다시 찍음 → `--check` "그대로다(모듈 71개 · CSS 4개)" · `git diff --check` 0 · 새 파일 줄 끝 공백 0.
- 새 시험: W1 pickSurface · W2 lookupWord 순서 · W3 단추·Esc 판정 · W4 열기 요청 0 · W5 저장 origin·contextTr·edited(fake-idb) · W6 AI 1·캐시 0·보내는 것(실제 파이프라인+흉내 Gemini) · W7 실패 뒤 다시 누름 · W8 문지기·capped·offline·키 없음 · W9 덮어쓰기 질문·force · W10 고친 번역 저장·문맥 바꾸기 · W11 너무 김·빈 낱말·같은 언어 · W12 늦은 결과 버림 · W13 삭제 확인 한 함수·term 남음 · W14 선택 줄 켜기·controls 배선 · W15 Esc 층·Tab·포커스 · W16 마크업·CSS · W17 i18n·위생·import 방향.

## 5. 변이 (백업 `b8f2/bak/` — `mut.mjs backup` 읽어서 씀 → `apply`(백업을 읽어 찾을 글이 정확히 1곳일 때만) → 전체 시험 → `restore`(백업을 읽어 씀) → `cmp` 같음)

import map 해시 시험 3개(IM2·IM6·IM7b)는 어떤 변이에도 빨강이라 셈에서 뺐다(앞 Build·Review 와 같음).

| # | 변이 | node | headless | 복원 cmp |
|---|---|---|---|---|
| M1 | 찾는 순서에서 저장 단어 건너뛰기 | **W2·W4·W5·W9·W10 빨강** | — | 같음 |
| M2 | 시트를 열 때 저절로 AI 호출 | **W4·W5·W6·W7·W8·W9·W10 빨강** | `m2h`: 열기만으로 단어 요청 **1** = 빨강 | 같음 |
| M3 | 삭제 확인 함수에서 단어장 줄 빼기 | **W13 빨강** | — | 같음 |
| M4 | Esc 층에서 시트 빼기(시트가 Esc 를 받지 않음) | **W15 빨강** | `m4h`: 띠+시트에서 Esc → 시트 그대로·띠 그대로 = 빨강 | 같음 |
| M5 | 다시 누름에 `retry` 안 넘김 | **W7 빨강** | — | 같음 |

복원 뒤 `cmp` 두 파일(wordsheet.js·library.js) 같음 → 그 뒤 stamp 다시·전체 2회.

## 6. 요청 바이트·회귀 (8c-1)

- **번역 요청 본문 = HEAD**: Review 하네스 `b-run-body`(r8c1c 를 **읽어** `b8f2/r/` 로 옮겨 씀 — `prep-r.mjs`)를 새 프로필로 → 40쪽 [▶] 8초: `[2747 B 8f301ea7584678d4, 9426 B 1da11781b23e9ac3]`·항목 [4, 58] — 8c-1 보고서의 HEAD 값과 같다. node term-8f B1(4 본문 sha256) 통과. pipeline·prompts·readalong·cache·hash 무변.
- **Esc 층·입력칸**(`run-e2` 412×915 ko, Aa·속도·선택 줄·[≡]·쪽 번호 칸·검색 화면): Review `e412.json` 과 **0곳 다름**.
- **손가락 판정**(`run-g`): Review `g1.json` 대비 2곳 — 대상 태그 문자열(pev, 좌표 차이)과 낭독 중 한 손가락 0 → **1**(Review 가 적은 그 하네스의 흔들림 칸 — 기대값 1).
- **동시 1·대기·연결 회복**(`run-k`): Review `k1.json` 과 **0곳 다름**(콘솔은 의도한 offline 네트워크 줄 3개 — Review 와 같음).
- **서재 문서 삭제**: term 남음(A `delete` · node W13).

## 7. headless (Edge · pipe · 새 프로필 `b8f2/p*`·`pb1`·`pm*`·`r/p*` · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 흉내 음성 · 캐시 끔 · 한 번에 하나)

- **A** `run-a.mjs`(412×915 ko, 최종 `a4.json` 41초): 위 2·3절 전부. 콘솔 오류 0 · pageerror 0 · 4xx 0 · 외부 요청은 pdf.js CDN 둘(기존). 앞 실행 `a1`(하네스 오류 — selbar 측정 훅 없음)·`a2`(다른 문단 줄 못 찾음)는 하네스만 고쳐 새 프로필로 다시(`a3`·`a4` 같은 결과).
- **B** `run-b.mjs`(`b1.json` 40초) — 9조합. 모두: 위끝 ≥ 0 · 아래변 ≤ 띠 윗변·하단 바 윗변 · [닫기] 보임(안 스크롤 끝까지 굴려도) · 단추 최소 48px · 가로 넘침 0 · 시트 안 가로 넘침 0 · 번역 칸 `dir=rtl lang=ar` · 원어 `dir=ltr` · 열린 동안 선택 줄 숨김 · Esc 로 닫힘.

| 크기 · UI | 길 | 시트 위끝–아래변 | 띠 윗변 · 바 윗변 | 안 스크롤 |
|---|---|---|---|---|
| 412×915 ar | AI(뜻 보임) | 168–649 | 657 · 777 | 없음 |
| 915×412 ar (띠 탭 모드 켬) | sentence | 24–237 | 245 · 329 | 있음([닫기] sticky) |
| 915×412 ko · en · fr | sentence | 24–237 | 245 · 329 | 있음 |
| 360×740 ko · en · fr · ar(띠 켬) | sentence | 73–474 | 482 · 602 | 있음 |

- 스크린숏 `b8f2/shots/` 5장: `412x915-ko-sentence.png` · `412x915-ko-overwrite-ask.png` · `412x915-ar-ai.png` · `915x412-ar-sentence-band.png` · `915x412-ko-none.png`(그 크기에서는 다른 문단 줄이 화면에 없어 sentence 길로 찍힘).
- 결과 JSON 에 원서 문장 없음(길이·개수·불리언·문구 키만). 흉내 번역은 원문 라틴 낱말을 괄호에 넣는 지어낸 꼴.

## 8. spec 정정 (17-7-6 4-5 끝, Edit 로 그 자리만)

`[정정 2026-11-16 — 8f-2 Build]` 한 줄: ① [단어 번역]은 `showAction`+`refresh`(기본 목록 그대로)·스냅숏 `multi`·controls 배선 몇 줄 ② `lookupWord`(호출 0 길만)·`createSheetFlow`(DOM 없음)·**늘 `retry:true`**·문지기는 consent·unsupported-lang·no-key 만(같은 언어는 낱말 언어로)·원격 막힘은 `translateTerms` 결과 blocked 코드로(capped 는 gate 안에서만 드러남) ③ 이미 있는 항목 [저장](고친 번역 `user:true`)·[이 문맥으로 다시 번역]은 문맥까지 이 문장으로·`edited` 는 남음 ④ 새 저장 origin·edited 규칙·뜻은 AI 길만·`contextTr` ⑤ `pickSurface`(앞 줄 `.hy` 잇기·여러 줄)·너무 김은 넓힌 원어로 ⑥ Esc 붙잡기 단계·보일 때만·조합 중 제외·stopPropagation·Tab 가둠·원어 머리 첫 포커스·`data-word-sheet` 로 선택 줄 숨김·z 36·덮어쓰기 질문은 시트 안 줄 ⑦ 삭제 확인 한 벌(`deleteKeepLines`·`deleteKeepCounts`·`deleteConfirmText`) ⑧ i18n 22 + 1 ⑨ `findInSentenceTr` 는 다듬지 않음(8f-1 시험이 후보 꼴을 고정).

## 9. 실기기 목록 (spec 17-7-6 12 몫 — 앱 완성 뒤 한 번에, 기다리지 않음)

- `[M]` Nour GT 7: 낱말 길게 누르기 → 선택 줄 [단어 번역] → 시트. 단추를 누르는 순간 선택이 풀려도 열리는가(스냅숏).
- `[M]` 시트 번역 칸을 아랍어 자판으로 고칠 때 자판이 칸·[저장]을 가리지 않는가(세로·가로 — 가로 compact 는 시트가 약 213px, 안 스크롤).
- `[M]` 처음 포커스(원어 머리)에 테두리가 손가락 사용에서도 보이는가(headless 는 `:focus-visible` 로 보임 — 거슬리면 다듬기).
- `[M]` 실제 Gemini: "문장 번역에서 찾음" 후보에 앞 낱말(«من» 등)이 얼마나 섞이는가 — 칸에서 지우기가 편한가(Nour 반응 → 후보 다듬기 여부).
- `[M]` 실제 Gemini 단어 응답의 뜻(gloss)·품사가 시트에 맞게 나오는가 · 라틴 약어(MRI 등)가 늘 `LANG` 실패로 "번역 실패"가 되는가(8f1R-8 #4).
- `[M]` 9b 듣는 중 [단어 번역]·시트 단추 → 듣기가 취소되는가(단추 첫 줄 `cancelVoice`).
- `[M]` 가로(8e compact)에서 [≡] 로 상단바를 펼친 채 시트 — 상단바 밑에서 멈추는가.
- `[M]` 서재 삭제 확인(브라우저 `confirm`) 둘째 줄 "단어장 n개는 남습니다"가 Android Chrome 대화에 줄바꿈으로 보이는가.

## 10. 남은 문제 · 넘길 것

1. **후보에 앞 낱말 섞임**(8f-1 남은 문제 1): `findInSentenceTr` 를 다듬지 않았다 — 8f-1 시험 F1·F2 가 «من التهاب المفاصل الروماتويدي»·«ثم …»·«يظهر …»·«souffre de …» 를 **정확한 기대값**으로 고정해 어떤 다듬기도 "8f-1 시험 그대로 통과" 조건을 깬다. 대신 시트가 후보를 번역 칸에 미리 채우고(편집 가능, Enter = 저장) 문장 번역 전체에 찾은 부분을 밑줄로 보인다. 다듬는다면 8f-1 시험 기대값을 함께 바꾸는 단계로(예: 아랍어 전치사·접속사 «من في على إلى عن ثم و» 와 한국어 조사 붙은 낱말에서 멈춤).
2. **다시 번역 뒤 `edited` 가 남는다**: `store.update` 의 고칠 수 있는 필드에 `edited` 가 없어(store.js 는 이번 범위 밖) AI 로 덮어쓴 항목도 `edited:true` — 다음 [이 문맥으로 다시 번역]도 다시 묻는다(안전한 쪽). 8f-3(편집 화면)에서 `update` 에 `edited` 내리기를 넣을지 정할 것.
3. 이미 있는 항목의 시트 [저장]은 번역 칸만 고친다 — 뜻·메모·품사 편집은 8f-3 편집 시트 몫.
4. 문서 언어 = 대상 언어인데 그 문장만 다른 언어(8m)인 드문 경우, `tapGate` 가 same-lang 에서 멈춰 no-key 를 보지 않는다 → 시트는 same-lang 을 무시하고 보내려 하고, 키가 없으면 파이프라인이 막아 한 줄(`readalong.blocked.noKey`)만 — 즉시 배너는 없다.
5. 시트는 쪽 넘김에 닫히지 않는다(질의가 쪽·줄·문장 사본을 들고 있어 저장은 맞다). 검색 화면으로 리더를 숨기면 시트도 숨은 채 남았다가 돌아오면 보인다(Esc 는 보일 때만 — 검색 Esc 를 막지 않음, 회귀 e2 0곳 다름).
6. 8f1R-8 #4(라틴 약어 `LANG` 실패)·#6(판본 키)·#7(터키어 `İ`)는 그대로 — 시트에서는 "번역 실패 — 다시 누르면 다시 보냅니다" + 다시 누르면 다시 1호출(retry).
7. 시트 제목 키(`vs.title`)는 두지 않았다 — 원어가 대화 이름(`aria-labelledby`). 설계 7절 "약 16키"의 "제목" 대신.
8. ko·fr `library.card.deleteConfirm` 머리 문장이 영어인 것은 기존 그대로(새 둘째 줄만 그 언어).
9. ar·fr 새 문구 23개 `[검토 — Nour·운영자]`.
10. 8f-3 에 넘김: 시트 링크 `#wsVocab`(hidden, `vs.vocabLink` "({n})") 켜기 · `library.deleteKeepCounts` 에 셈 더하는 자리는 11·12.

## 11. 규칙 · 막힌 명령

- 막힌 명령 0. 명령은 한 호출에 한 가지(`cd … &&`·파이프 0 — 테스트·도장·검사·백업·변이 각각·복원·`cmp` 각각·headless 각각). 긴 실행 `timeout 560`(가장 긴 headless 41초, 전체 시험 약 10초).
- 커밋 0 · `git checkout/restore/stash` 0 · npm·다운로드 0 · `rm` 0 · `.nojekyll` 그대로 · 8000 python 쓰기만(curl 응답 확인 1번) · 8123–8125 무관 · 프로세스 조회·디버깅 포트 0(pipe, `try … finally browser.close()`) · 프로필 복사 0(모두 새 폴더) · 진짜 키 0 · puppeteer-core 읽기만 · Review 스크래치 `r8c1c/` 는 읽기만(옮겨 쓴 곳은 `b8f2/r/`) · 의학책 읽기만(가져오기)·Downloads 목록 안 봄 · 큰 원서로 검색 화면 0(e2 의 검색은 Review `small.pdf`) · C: 남은 공간 106GB.

## 12. 스크래치패드 (`…/scratchpad/b8f2/`)

`common.mjs`·`run-a.mjs`·`run-b.mjs`·`run-m.mjs`·`sum-a.mjs`·`sum-b.mjs` · `mut.mjs`·`bak/` · `prep-r.mjs`·`r/`(옮겨 쓴 Review 하네스·결과 `e412`·`g1`·`k1`·`body1.json`) · 결과 `a1–a4.json`·`b1.json`·`m2h.json`·`m4h.json` · 시험 `base.txt`·`run0.txt`·`ws1/ws2.txt`·`m1–m5.txt`·`full1/full2.txt` · `shots/`(5장) · 프로필 `p1–p4`·`pb1`·`pm2`·`pm4`·`r/p*`.
