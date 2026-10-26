# Build 보고 — 8d 문장 아래 번역(대역) (Nour 요청 1 · spec 7-7-1)

2026-10-21 · 기준 커밋 `ca2665a` · **커밋하지 않았다** · 스크래치 `b8d/`(세션 스크래치패드 `C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/b8d/`)

## 1. 바꾼 것
| 파일 | 내용 |
|---|---|
| `js/ui/inlinetr.js`(새) | I1~I7. 순수: `inlineOn`·`anchorIdOf`·`anchorsOf`(I2)·`placeBlock`(I1 — `span.line` 다음 형제, 같은 줄이면 seg 순서, 행 표 `span.rt-ref` 는 건너뜀)·`makeBlock`·`renderReady`(`appendBidiText`)·`renderNote`(`noteKeyFor`)·`renderArrived`. 화면: `initInlineTr({readalong, speaker, mount, root, lineElement, onPageRepaint, recheck})` → `sync()`(쪽 그림·표시 방식·모드·대상 언어 — I4 (i)·I7) · `willShow(u)`(I4 (ii)·I5) · 늦은 번역 → "눌러서 보기"(I4 (iii)) · `leave()`. `<html data-tr-inline="on">`. 디버그 훅 `__medreader.inlinetr.state()/queueSegs()`(글자 없음). `pipeline`·`reader.js`·`cache.js` import 0, `innerHTML` 0 |
| `js/ai/readalong.js` | 캐시 키를 `cacheKeyOf` 한 곳으로(refill `dropCached` 와 공유). 공개 API 셋: `translatable(u)`(8m 같은 언어·seg 없음 거름) · `readyNow(units)`(메모리, 동기) · `cachedFor(units)`(캐시 **읽기만** — 요청·메모리·창·readStats 무관) |
| `js/ui/trband.js` | `noteKeyFor(rec, ctx)` export 하나(= `bandView` 의 상태·문구 키·재시도 — 띠와 블록이 규칙 한 벌) |
| `js/ui/reader.js` | `sentenceExtent` 한 줄 — `.ra-tr[data-ra-current]` 상자를 잣대에 더한다(6-5 `[신설 2026-10-12]`). 그 밖 무변 |
| `js/ui/controls.js` | `view.show` 가 `showSpoken` **앞에서** `inlinetr.willShow(u)` · `initInlineTr` 배선(onPageRender 구독 뒤) · `syncReadalong()` 끝 `inlinetr.sync()` · `leaveControls` 에 `leave()` · 속도 팝오버 위임 선택자에 `[data-readalong-display]` |
| `js/ui/settings.js` | `READALONG_DISPLAYS`·`DEFAULT_READALONG_DISPLAY`·`normalizeReadalongDisplay` · `readalongState().display` · `renderReadalongRow` 에 "번역 위치: 아래 띠 / 문장 아래" 줄(같은 함수 — 팝오버·설정 AI 탭 공용) · 누르면 `medreader:readalong-display` |
| `js/settings.js` | `'readalong.display': 'band'`(9-3). DB 판 불변 |
| `js/i18n/{ko,en,ar,fr}.js` | `readalong.display.label/band/inline` · `readalong.inline.arrived` (ar·fr `[검토 — Nour·운영자]`) |
| `css/tokens.css` | `:root[data-tr-inline="on"] { --tr-band-h: 0px }` — 띠 자리 토큰 하나로 `--reader-chrome-bottom` 138px(식 한 벌) |
| `css/reader.css` | `:root[data-tr-inline="on"] .tr-band { display:none }` · `.reflow .ra-tr`(block · `overflow-anchor:none` · inline-start 3px 테두리 · 옅은 색 · `--tr-fs`/`--tr-lh` · `unicode-bidi:plaintext` · 굵기·자간 초기화) · 상태 줄 `.ra-line`(`--tap` 한 줄 고정) · `.ra-retry`(48×48) · `.ra-show` · `[data-speaking="tr"]` 테두리 색 |
| `index.html` | stamp 다시(`--check` 0, 모듈 60) |
| `tests/inlinetr-8d.test.mjs`(새, 13) · `tests/settings-7b.test.mjs`(A1·A2 기대값에 `display:'band'`) | |
| `spec.md` | 7-7-1 `[정정 2026-10-21 — 8d Build]` 한 줄(①~⑩) · 10-1 괄호 "캐시 **값**(키 아님)" + `[정정 2026-10-21 — 8p Review L1]` |

DB 버전·algoVersion·캐시 키·`PROMPT_VERSION`·`SEARCH`/`SCAN` 판 불변. review.md 손대지 않음.

### 설계와 다르게 맞춘 것(spec 7-7-1 정정 줄에 적음)
- 입력 단위 = speaker `queue` 이벤트 단위(낭독 큐 그대로 — 화면이 `buildUnits` 를 다시 부르지 않음). 키는 의사코드의 `'translate'` 가 아니라 readalong 이 실제로 쓰는 `keyFor(…, 'readalong')`(7-5 `cacheKindOf` 로 같은 `translate` 키) — 화면은 키를 만들지 않는다.
- 띠 자리: `trband.js` 범위(`noteKeyFor` 공유만)를 지키려고 `body[data-tr-band]` 를 끄는 대신 `data-tr-inline` + 토큰 0 으로 같은 효과.
- 상태 줄은 `p.ra-note` 대신 `span.ra-line`(p 안에 p 금지). 네 상태 줄 모두 48px 한 줄.
- 늦게 읽힌 캐시는 지금 문장보다 위(seg 작음)에 넣지 않는다 · 다른 쪽을 그리면 지난 쪽의 "지금 문장"을 잊는다(실측에서 돌아온 쪽에 엉뚱한 "번역 중…" 이 생기던 것을 고침).
- I2 보충: `span.rt-ref`(8i 행 표 쪽 번호, 줄 아님)를 건너뛰어 블록이 그 뒤로(CMDT 25쪽 실측).
- 탭 번역(8c)은 아직 없음 — 8c 가 띠로 열 때 `data-tr-inline` 을 떼야 한다.

## 2. 테스트·변이
- 새 `tests/inlinetr-8d.test.mjs` 13개: D1 I2 두 문장 한 줄(거꾸로 넣어도 seg 순서) · D1b rt-ref · D2 300자 분할(ranges 없음 → 마지막 조각 lineIds 끝 `4:8`)·표 안내/인용 제외 · D3 **I1**(가짜 DOM 에서 `paintCharRanges` Range 의 시작·끝 노드·오프셋 블록 전후 동일, 줄 찾기·줄 span 자식 노드 동일, 블록 부모 `p.para`, `closest('span.line')` null, 아랍어 bdi) · D4 inlineOn · D5 상태 줄 한 줄 + `noteKeyFor`=`bandView` + CSS(48px·overflow-anchor) · D6 **8m 같은 언어 단위 블록 없음**(translatable·앵커·readyNow/cachedFor) · D7 **키 함수 공유**(cachedFor 의 keyFor 인자 = refill 이 같은 문장에 부른 인자, 요청 0·메모리 불변, keyFor 호출처 1곳) · D8 **grep**(inlinetr 의 import 폐포에 `ai/pipeline·readalong·cache` 0, `innerHTML` 0, 쓰는 ra 메서드 목록 고정, retry 는 단추에서만) · D9 배선(willShow 가 showSpoken 앞, sync 가 setDoc/setContext 뒤, reader 의 `ra-tr` 은 sentenceExtent 한 줄, 토큰·띠 감추기 CSS) · D10 설정·네 언어 문구 · D11 화면 흐름(가짜 DOM + 실제 readalong: 쪽 그림 캐시 1개·요청 0, 현재 "번역 중…"·앵커 다음, 지나간 문장 상태 줄 유지, 늦은 응답 → 지나간 것 "눌러서 보기"·현재 것 채움+recheck, 누르면 펼침, 앞 문장 미리 받은 번역은 현재가 될 때까지 안 넣음, 새 DOM 동기 다시 그림, band/대상 언어/off/원본 뷰 지우기, `data-speaking="tr"`) · D12 8m 화면(같은 언어 단위가 현재여도 블록·상태 줄 없음).
- 전체 `node --test apps/medreader/tests/*.test.mjs`: **1360/1360 × 2회**(t2·t3, 1347 + 13). 그 전 t0 에서 settings-7b A1·A2 가 `display` 필드로 빨강 → 기대값 갱신.
- **변이 8개 → 모두 빨강 → 복원**(백업 읽어서 쓰기 + `filecmp`/`cmp` 같음, 4파일 sha1 전후 같음, 백업 `b8d/bak/mut/`): M1 블록을 줄 span 안에(D1·D1b·D3·D11) · M2 지나간 문장 늦은 번역 바로 펼침(D11) · M3 cachedFor 가 요청(D7·D11) · M3b inlinetr 가 pipeline import(D8) · M4 같은 언어 단위에도 블록(D6·D12) · M5 화면이 키를 따로(`'translate'`) 계산(D6·D7) · M6 showSpoken 뒤에 블록(D9) · M7 sentenceExtent 에서 블록 빠짐(D9). (M2 첫 시도는 치환이 주석을 남겨 문법 오류로 빨강 → 치환을 고쳐 다시 돌려 D11 로 빨강 확인. `mutate.json`·`mutate-1.json`.)

## 3. headless Edge 측정 (`[D]`)
조건: 새 프로필 1개 `b8d/p1`(포트 9368) · 412×915·360×740 · 글자 22 · ko(일부 ar) · 가짜 키 · 흉내 번역(운영자 캡처 꼴 아랍어 낱말로 원문 길이 ≈0.95배, 원문 숫자 보존) · 흉내 음성(문자당 25ms) · 8000번 python. 결과 `b8d/hl1.json`·`hl1b.json`·`hl2.json`·`hl3.json`. **콘솔 오류 0**(모든 실행), 가로 넘침 0(412/412 ko·ar).

측정법: 프레임마다 10a 하이라이트 첫 Range 의 첫 상자 윗변 + scrollY(문서 기준 — 프로그램 스크롤은 상쇄)를 보고, 같은 문장인데 0.5px 넘게 움직이면 위반. 블록 변이(MutationObserver)마다도 같은 판정. 편안 영역은 각 문장 마지막 프레임에서 "문장 위·아래, 현재 블록 아래변 ≤ 본문 영역 아래변 − 4px".

| 실행 | 문장 전환 | I4 위반(문서/화면) | 블록 변이 중 | 편안 영역 |
|---|---:|---|---:|---|
| 412×915 · 40쪽(첫 응답 1.5s) | 21 | **0 / 0** | 26 | 위반 1 — 문장 하나가 739px > 영역 728px |
| 412×915 · 52쪽(hl3) | 21 | **0 / 0** | 26 | 위반 1 — 들어갈 크기이나 스크롤 중 표본(안정 표본 위반 0) |
| 360×740 · 42쪽(첫 응답 6s) | 21 | **0 / 0** | 35 | 위반 5 — 첫 문장 1(쪽 이동 직후 부드러운 스크롤 중), 나머지 4 는 문장+블록 > 553px |
| 360×740 · 46쪽 **띠 기준선** | 21 | 0 / 0 | — | 0 |
| 360×740 · 46쪽 inline | 21 | **0 / 0** | — | 위반 4 — 1 은 하네스가 `scrollTo` 로 자동 스크롤을 멈춘 탓, 3 은 문장+블록 > 영역 |
| 360×740 · 40쪽 / 54쪽(hl3) | 21 / 21 | **0 / 0** | 27 | 위반 4 / 3 — **모두 문장+블록 > 영역**(들어갈 크기 안정 표본 위반 0) |
| 412×915 · 44→45쪽 쪽 넘김(8i-3, 늦은 줄 탭) | 14 | **0 / 0** | 21 | 첫 표본 1(탭 직전 스크롤 중) |
| 412×915 · 48쪽 늦은 번역(9s) | 9 | **0 / 0** | — | 지나간 블록 6개 "눌러서 보기" 모두 48px, 누르면 48→143px |

- 블록 높이(ready): 412×915 중앙값 107px·최대 285, 360×740 중앙값 71px·최대 463.
- **편안 영역 결론**: 문장+블록이 본문 영역(553/728px)에 들어갈 수 있는 경우 위반 **0**. 넘치는 경우(긴 문장 253~775px + 긴 번역)는 6-5 기존 규칙대로 문장 시작을 영역 맨 위(53px)에 두고 블록 끝이 밖으로 나간다 — 360×740 에서 20문장 중 3~4. 수용 기준 "위반 0" 은 이 크기에서는 물리적으로 불가 → **운영자 결정 필요**(5절).
- **쪽을 넘겼다 돌아오기**(40→41→40, 낭독 없이): `fetch` **0**, `usage.calls` 증가 **0**(4→4). 블록: 떠나기 전 ready 24 → 돌아와 ready 43(캐시에 있던 선행 번역까지 — I4 (i) "캐시에 있는 것 전부"). 41쪽에도 선행 번역 23개가 그려짐.
- **band ↔ inline**(속도 팝오버 줄): band → 블록 0·띠 display block·하단 크롬 258px / inline → 블록 43·띠 none·138px. 탐색 기록 1개·창 변수 그대로(새로고침 없음). 설정 AI 탭에 같은 줄(눌림 inline). 띠 모드로 낭독(8b 회귀): 띠 `ready`·rtl·블록 0.
- **원본 뷰는 늘 띠**: 원본 → `data-tr-inline` 없음·띠 보임·258px·블록 0, 리플로우로 돌아오면 블록 43·138px.
- **아랍어 bidi**: 블록 `dir=rtl lang=ar`, 괄호 묶음마다 `<bdi dir=ltr>`·괄호가 묶음 안·한 줄에 놓인 묶음은 왼→오 순서 정상(모든 표본). 긴 묶음은 줄 끝에서 "(rheumatoid" / "arthritis)" 로 접힌다 — 띠와 같은 함수·같은 모양(괄호 뒤집힘 없음). `innerHTML` 0(grep D8).
- **아랍어 UI**: 상태 줄 `dir=rtl lang=ar` 48px("번역 중…"·"눌러서 보기"), 블록 테두리 오른쪽.
- **해커스 DM plus B2(8m)** — 서재 [⋯] 에서 문서 en · 대상 ko · 2쪽: 문장 33 중 한글 단위 14(번역 대상 아님 14), 블록 16 중 **한글 단위 블록 0**, 블록 언어 ko 만, 한글 단위 발화 14번 중 현재 블록이 있던 때 **0**, 요청 2건 한글 위주 항목 0. 8o: 빈칸 낱말 발화 10, `----` 꼴 발화 0. 8m 판정 어긋남 1 — **띠 모드 기준선도 1**(같은 문서·같은 설정, 8m 섞인 단위 규칙 — 8d 무관).
- **표**(CMDT 2026, 낭독으로 번역 받은 뒤 쪽을 넘겼다 돌아와 캐시에서 다시 그림): 25쪽(8i R 표) 블록 19 — 부모 rowhead 5·list 10·heading 2·body 2; 45쪽(8i-2 2열 표) 54 — body 37·list 13·rowhead 4. 전부 `p.para` 안 `span.line` 다음 형제, `details.folded`·`figure` 안 0, 표 안내(figure) 없음. 행 표는 행마다 문단이라 번역이 그 행 아래에 붙는다. 첫 측정에서 25쪽 rowhead 4개가 **이름표와 쪽 번호(`span.rt-ref`) 사이**에 끼어 → rt-ref 뒤로 고침(재측정 rt-ref 뒤 4·앞 0).
- **회귀**: 8i-3 쪽 넘김(번역 끔, 60→61) en-US 정상·inline 비활성·속성 없음 / 8g 검색 결과로 이동 뒤 [▶] — 첫 발화에 찾은 낱말 있음, 현재 블록 있음 / 10a 하이라이트 Range 6개·글자가 발화와 일치·블록 안 Range 0 / 줄 탭 50:15 → 그 줄부터, 블록을 탭하면 아무 일 없음.
- 바깥 요청: pdf.js CDN(원본 보기)·generativelanguage(가로채 흉내 응답) 뿐.

스크린숏 `b8d/shots/`: `inline-ko-412.png`·`inline-ko-360.png`·`inline-ar-412.png`·`arrived-ko-412.png`·`arrived-ar-412.png`·`pending-ar-412.png`·`band-mode-ko-412.png`·`original-band-412.png`·`popover-display-ko-412.png`·`settings-ai-display-ko-412.png`·`table-p25-ko-412.png`·`table-p25-rtref-ko-412.png`·`table-p45-ko-412.png`·`hk-en-doc-ko-target-412.png`(`dbg-pop-*.png` 는 팝오버 진단용).

## 4. 프로세스·디스크
- 띄운 Edge(b8d/p1) 모두 닫힘, 포트 9368 닫힘, 측정·테스트 node 모두 `timeout` 상한 안에서 끝남(각 실행 ≤ 10분). 8000번 python(PID 30352) 그대로, 8123·8124 손대지 않음(8125 는 LISTEN 없음). 새 프로필 1개. C: 남은 공간 139GB. G:·D:/OCR 읽기만(해커스 PDF 를 프로필에 가져옴).

## 5. 남은 문제 · 운영자 결정
1. **편안 영역 수용 기준과 긴 문장**(결정 필요): 문장+블록이 본문 영역보다 길면 "블록 아래변 ≤ 영역 − 4px" 는 지킬 수 없다. 지금은 6-5 그대로 **문장 시작이 먼저**(블록 끝은 밖). 360×740 에서 20문장 중 3~4. 선택지: (가) 이대로 — 수용 기준을 "들어갈 수 있는 크기에서 위반 0" 으로 고침 · (나) speak 모드의 `tr` 단계(번역문 낭독)가 시작될 때 블록이 보이게 한 번 굴림 · (다) show 모드는 원문 발화가 끝날 무렵 블록 쪽으로 굴림. (나)(다)는 프로그램 스크롤이 문장당 한 번 늘어난다.
2. 속도 팝오버에 줄이 하나 늘어 412×915 에서도 팝오버 안이 52px 스크롤된다(360×740·띠 켬이면 더). 새 줄이 sticky 닫기 줄 밑에 있어 처음엔 가려져 있다 — 실기기에서 불편하면 표시 방식 줄을 위로 올리거나 설정 AI 탭에만 두는 안.
3. 아랍어 괄호 묶음이 줄 끝에서 접힌다(띠와 같은 함수·같은 결과, 순서·괄호는 정상). 접히지 않게(`bdi { white-space: nowrap }`) 하려면 긴 묶음이 넘칠 수 있어 별도 결정.
4. 탭 번역(8c) 미구현 — 8c 는 띠로 열 때 `data-tr-inline` 을 그동안 떼야 한다(정정 줄 ⑨). trband 의 디버그 `state().hidden` 은 inline 일 때도 false(감추기는 CSS) — 측정 시 `__medreader.inlinetr.state().rootAttr` 를 볼 것.
5. 문구 ar·fr `[검토 — Nour·운영자]`. `[M]` 실기기(Realme GT 7 Chrome — 스크롤 앵커·부드러운 스크롤)는 하지 않았다. 흉내 번역 길이(원문 ≈0.95배)가 실제 아랍어와 다를 수 있다.
6. 첫 문장 표본 두 개(쪽 이동 직후)의 편안 영역 밖은 부드러운 스크롤이 끝나기 전 표본 — 띠 모드에서도 같은 구조(8d 이전 동작). 하네스의 `scrollTo` 가 자동 스크롤을 멈춘 표본 1개는 측정 탓.

## 6. 스크래치 `b8d/`
`lib.mjs`(공용: Edge·흉내 음성·흉내 번역·측정 장치) · `hl1.mjs`·`hl1b.mjs`·`hl2.mjs`·`hl3.mjs`·`dbg.mjs` + 각 `.json`/`.log` · `shots/` · `mutate.py`·`mutate.json`·`mutate-1.json`·`mut-sha-before/after.txt` · `bak/orig/`(수정 전 원본) · `bak/mut/`(변이 백업) · `probe.mjs` · `t0–t3.log` · `p1/`(프로필 — 레포에 넣지 말 것). json 에는 원서 문장이 없다(문장 40자 조각은 `__spoken` 안에서만 쓰고 저장하지 않음).
