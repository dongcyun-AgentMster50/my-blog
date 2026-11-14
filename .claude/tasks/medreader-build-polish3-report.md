# Build 보고 — 다듬기 3: 팝오버 가림 + 다듬기 2 Review 남은 항목 (2026-11-15)

지침 `.claude/tasks/medreader-build-polish3.md`. 기준 `6786cee`. **커밋하지 않았다.** 스크래치 `bp3/` = `C:/Users/YDC/AppData/Local/Temp/claude/9d924f3f16e52d8a/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/bp3/`. 막힌 명령 0.

## 1. 바꾼 파일

| 파일 | 항목 |
|---|---|
| `apps/medreader/css/reader.css` | 1 (나) 속도 단추 — 최소 폭 52px · 안 여백 4px · 사이 4px, 주석 |
| `apps/medreader/css/screens.css` | 1 (가) "번역 위치" 줄 위 여백 0 · 2 하3 주석 두 곳("48 유지" → 사실대로) |
| `apps/medreader/js/ui/settings.js` | 2 주석("가려지지 않는다" → 실측) — 코드 무변 |
| `apps/medreader/js/ui/inlinetr.js` | 3 하1 — 막힘 줄에 사유 `data-ra-code`, M1 은 같은 사유만 셈 |
| `apps/medreader/index.html` | stamp 만(모듈 61 · CSS 4) |
| `apps/medreader/tests/inlinetr-8d.test.mjs` | 4 하4(D13 한 덩이) · 새 D15(하1) · 새 D16(팝오버 CSS) |
| `apps/medreader/spec.md` | 5 하2 — 7-7-1 I5 정정 줄 · 정정 ⑩ 지금 숫자 |

손대지 않은 것: `controls.js`(속도 단추 줄은 CSS 만으로 됨)·`trband.js`·DB·algoVersion·캐시 키·`PROMPT_VERSION`·`review.md`·`dev/`.

## 2. 항목별

### 1. 팝오버 가림(중1) — **목표 달성: 412×915 band 처음 열 때 가림 0 · 스크롤 0 (ko·ar·en·fr)**

- (가) `.readalong-row .readalong-display-line { margin-block-start: 0 }`. 설정 AI 탭도 같은 함수·같은 규칙이라 함께 0(위 스위치와 바로 붙는다 — 스크린숏에서 어색하지 않음).
- (나) **운영자 결정(최소 폭 64 → 52px)만으로는 한 줄이 안 됐다.** 그래서 같은 규칙 안에서 하나를 더 했다 — 알림.
  - 실측(412, 팝오버 안 362px, 실행 중 CSS 덮어쓰기 `bp3/probe.mjs`): 글자 폭 `0.5×` 32.3 · `0.75×` 41.2 · `1.0×`(눌림·굵게) 34.3px.
  - 52px 만: 단추 기본 폭 합 + 사이 = **366.7px**(ar 364.6) > 362 → `1.8×` 가 둘째 줄(HEAD 64px 때와 같음, 424px).
  - 한 것: 최소 폭 52px + **단추 안 여백 8 → 4px · 단추 사이 8 → 4px**(`.tts-rate-panel .tts-steps`, 횟수 줄도 같은 규칙) → **332px**, 남는 30px 는 실기기 글꼴·글자 크기 몫.
  - 다른 안: 여백만 4(사이 8) → 352px(남는 10) · 사이만 4(여백 8) → 346.7px(남는 15). 실기기 여유를 보고 둘 다 줄였다. 운영자가 덜 바꾸길 원하면 둘 중 하나로 되돌릴 수 있다(한 줄 CSS).
  - 단추 높이 48px 그대로(`.typeset-choices button` 의 `--tap`), 글자 잘림 0(ko·ar·en·fr, `scrollWidth/Height` 비교).

**팝오버 실측 표**(Review p2R-5 와 같은 방식 — 처음 열 때 `scrollTop` 0, "가림" = 단추 아래변 − sticky 닫기 줄 윗변, 배너 0, headless Edge, 새 프로필 `bp3/p1`. 앞 = 변경 전(=`6786cee`, 같은 스크립트) · 뒤 = 지금)

| 크기 · 표시 | UI | 팝오버 안 스크롤 | 단추 보이는 높이 | **가림** | 속도 단추 줄 수 |
|---|---|---|---|---|---|
| 412×915 · band | ko·ar | 36 → **0** | 28.5 → **48** / 48 | 19.5 → **0** | 2 → **1** |
| 412×915 · band | en | 41 → **0** | 26 → **50.5** / 50.5 | 24.5 → **0** | 2 → **1** |
| 412×915 · band | fr | 38 → **0** | 28.5 → **50.5** / 50.5 | 22 → **0** | 2 → **1** |
| 412×915 · inline | 모두 | 0 → 0 | 다 보임 | 0 → 0 | 2 → 1 |
| 360×740 · band | ko | 211 → 199 | 0 → 0 | 194.5 → 182.5 | 2 → 2 (4+2 → 5+1) |
| 360×740 · band | ar | 289 → 277 | 0 → 0 | 272.6 → 260.6 | 2 → 2 |
| 360×740 · band | en·fr | 272 → 260 | 0 → 0 | 255.5 → 243.5 | 2 → 2 |
| 360×740 · inline | ko | 91 → 79 | 0 → 0 | 74.6 → 62.6 | 2 → 2 |
| 360×740 · inline | ar | 169 → 157 | 0 → 0 | 152.7 → 140.7 | 2 → 2 |
| 360×740 · inline | en·fr | 152 → 140 | 0 → 0 | 135.6 → 123.6 | 2 → 2 |

- 변경 전 값은 Review 표(36 · 19.5 · en 24.5 · fr 22 · 360 ko 211/194.5 · ar 289/272.6 · inline ko 91/74.6)와 같다.
- 412 band 팝오버는 64.5px 짧아졌다(위 여백 8 + 속도 둘째 줄 56 + 반올림). 위끝 73 → 101.5px.
- 360 은 목표 아님 — 12px(위 여백 8 + 속도 줄 사이 4)만 줄었고 단추는 여전히 처음 화면 밖이다.
- 속도 단추 폭(412 ko, 남는 폭을 나눠 가진 뒤): 53.7 · 62.6 · 55.6 · 62.6 · 53.8 · 53.8px. ar 도 한 줄.
- 설정 AI 탭(412·360 × ko·ar·en·fr 8가지): 모두 머리글·단추 **같은 줄**, 가로 넘침 0, 위 스위치와 사이 8 → 0. 단추 높이 ko·ar 48 · en·fr 50.5 · 360 fr 66.8(글자 세 줄 — 전과 같음).
- 모드 분절 컨트롤 단추도 en(412·360)·ar(360)에서 50.5px 다(하3 과 같은 성질 — 주석을 같이 고쳤다).
- 스크린숏: `bp3/shots/after-pop-412-band-ar.png`·`after-pop-412-band-fr.png`(비교용 `before-*` 같은 이름, 360 ko 도 있음).

### 2. 주석을 사실대로 (중1 · 하3)

- `settings.js`: "가려지지 않는다" → 다듬기 2 만으로는 19.5px(en 24.5) 가렸고, 위 여백 0 · 속도 단추 한 줄을 더해 가림 0, 360 은 여전히 스크롤.
- `screens.css` "번역 위치" 줄: "높이 48 유지" → "48 **이상**, ko·ar 48 · en·fr 50.5(360 설정 fr 66.8)" `[정정 2026-11-15 — 다듬기 3: 하3]`.
- `screens.css` 모드 분절 컨트롤의 같은 문구도 같이 고쳤다(실측 en 412·360, ar 360 에서 50.5).

### 3. 하1 M1 사유 구분

- `renderNote` 가 막힘 줄 블록에 사유 `data-ra-code`(`offline`·`exhausted`·…)를 단다. 다른 상태 줄·번역문 블록은 걷는다(`statusLine`·`renderReady`).
- 사유는 `noteFor(rec)` 가 고른다: 문구는 그대로 `noteKeyFor`(띠와 한 벌), 사유 이름만 같은 규칙의 `bandView(...).code`. `trband.js` 는 고치지 않았다.
- `quietBlocked` 는 `.ra-tr[data-state="blocked"][data-ra-code="<이 문장의 사유>"]` 가 있을 때만 참 — 다른 사유면 새 사유 줄 하나.
- 이미 있는 줄은 빼지 않는다(I4 그대로). 지나간 줄은 자기 상태가 바뀌면 `onRec` 가 같은 높이로 다시 그리고 사유도 따라 바뀐다.
- `CODE_ATTR` 를 내보냈다(테스트용 상수).

**브라우저 시나리오**(`bp3/m1.mjs` · 412×915 · ko UI · ar 대상 · inline · 오프라인으로 4문장 → 연결 → 흉내 Gemini 가 POST 1번만 답하고 그 뒤 429)

| 판 · 쪽 | 오프라인 중 | 연결 뒤(12문장) | 새 한도 줄 | I4 (프레임 · 위반 · 최대 이동) |
|---|---|---|---|---|
| HEAD(가로채기) 170쪽 | seg 0 `blocked`(오프라인) | seg 3–11 ready, 지금 문장 12–14 막힘(exhausted) | **없음** — 남은 줄은 "오프라인" | 951 · 0 · 0 |
| HEAD 180쪽 | 같음 | seg 3–12 ready, 13–14 막힘 | **없음** | 822 · 0 · 0 |
| 현재 150쪽 | seg 0 `offline` | seg 3–14 ready, 15 막힘 | **seg 15 `exhausted` 1개, 지금 줄 뒤** | 665 · 0 · 0 |
| 현재 160쪽 | 같음 | seg 3–11 ready, 12 막힘 | **seg 12 `exhausted` 1개, 지금 줄 뒤** | 902 · 0 · 0 |
| 현재 190쪽 | 같음 | seg 3–14 ready(한도는 지나간 문장 재전송에서) | 없음 — seg 0 줄이 `exhausted` 로 바뀜(같은 높이) | 541 · 0 · 0 |

- Review 가 코드로 읽은 하1 을 HEAD 에서 브라우저로 재현했고(170·180쪽), 지금 판에서 풀렸다(150·160쪽).
- 한 사유 줄 뒤 같은 사유는 쌓이지 않는다(150·160쪽: 막힘 뒤 새 줄 0).
- 연결하자마자 429 인 경우(`m1-out-a.txt`, HEAD·현재 같음): 지금 문장이 pending 을 거쳐 `exhausted` 줄 1개(두 판 모두 이 경로는 원래 됐다).
- 스크린숏 `bp3/shots/m1-reason-150-412-ko-ar.png` — 지금 문장 아래 "오늘 무료 한도를 다 썼습니다 [다시 시도]".

### 4. 하4 — D13 에 R4 공백 메움

- D13 끝에 한 덩이: 막혀 구독 중인 문장(1) → 이미 번역된 문장(2, ready)으로 넘어가면 문장 1 의 구독 0.
- R4 변이(`willShow` 가 문장이 바뀔 때 `unwatchCurrent` 를 부르지 않음)가 이제 **빨강 D13**(아래 P4).

### 5. 하2 spec

- 7-7-1 I5 아래 `[정정 2026-11-15 — 다듬기 3]` 한 줄: M1 예외(같은 사유 줄이 있으면 새 블록 없음 · 사유가 다르면 새 사유 줄 · 풀리면 지금 문장 아래 · 위에서 빼지 않음 · "번역 중…"/실패는 예외 밖).
- 정정 ⑩ 끝에 같은 표지로 지금 숫자: 36px·가림 19.5 → 스크롤 0·가림 0(ko·ar·en·fr), 360 은 여전히 스크롤(숫자).

## 3. 검증

- 전체 `node --test apps/medreader/tests/*.test.mjs` **1391/1391 × 2회**(1389 + D15·D16), fail 0, 약 9.5초. 출력 `bp3/t1.txt`·`t2.txt`.
- `stamp-importmap --check` "그대로다(모듈 61개 · CSS 4개)" 종료 0. `git diff --check` 종료 0. `.nojekyll` 있음(0바이트).
- **띠 모드 본문 DOM 무변**(`bp3/pop.mjs`, 52쪽 · 412×915 · ko · band, 재생 전 / 4초 재생 / 멈춤): 변경 전·후 `article.reflow` 해시 `68658a05`·길이 5,515, `.ra-tr` 0, `data-tr-inline` 없음, `--reader-chrome-bottom` 식·띠 위치(657·120)·큐 해시 같음.
- 콘솔 오류: `pop.mjs`(전·후)·`probe.mjs` 0. `m1.mjs` 는 흉내로 일부러 돌려준 429 의 "Failed to load resource" 만(앱 오류 아님). 페이지 오류 0 전부.
- 바깥 요청: pdf.js CDN(기존)과 가로챈 Gemini 뿐. 가짜 키만 씀.

### 변이 6개 (`bp3/mutate.mjs`, `inlinetr-8d` 범위)

| # | 변이 | 결과 |
|---|---|---|
| P1 | 하1 되돌림 — `quietBlocked` 가 사유를 보지 않음 | 빨강 D15 |
| P2 | `renderNote` 가 막힘 줄에 사유를 적지 않음 | 빨강 D13·D15 |
| P3 | `statusLine` 이 옛 사유를 걷지 않음 | 빨강 D15 |
| P4 | R4 — `willShow` 가 문장이 바뀔 때 `unwatchCurrent` 를 부르지 않음 | 빨강 D13 |
| P5 | 속도 단추 최소 폭 52 → 64px | 빨강 D16 |
| P6 | "번역 위치" 줄 위 여백 0 → `var(--sp-2)` | 빨강 D16 |

- 복원: 백업 `bp3/bak/` 에서 읽어서 쓰기, 6/6 `Buffer.compare` 같음, `cmp` 3파일 같음. `git diff` 해시가 변이 전후 같음(`6a679bb…`).
- 변이 뒤 stamp 를 다시 찍었다(주석만 바뀐 CSS 두 파일 해시) — 위 `--check` 0 은 그 뒤 값.

## 4. 정리 · 지킨 것

- 8000번 python 은 응답이 있어(200) 그대로 썼고 끄지 않았다. 8123·8124·8125 는 건드리지 않았다. **프로세스 조회·디버깅 포트 찌르기는 하지 않았다.**
- Edge 는 새 프로필 `bp3/p1` · 포트 9451(9411·9431 안 씀). 모든 실행이 `try … finally { await browser.close() }` 를 끝까지 돌았다(그 뒤 결과가 출력됨). 실행마다 `timeout 590` + 스크립트 안 9분 상한.
- 흉내 Gemini 는 OPTIONS 사전 요청에 204 + CORS 머리(Review `rp2/common.mjs` 를 본떠 `bp3/common.mjs` 로 복사 — `rp2/` 는 읽기만).
- HEAD 비교판은 `git archive 6786cee apps/medreader` → `bp3/head/`(가로채기로 내줌). `git checkout/restore/stash` 0.
- C: 남은 공간 132GB. 원서 문장은 보고서에 쓰지 않았다(seg·상태·사유·좌표만). 스크린숏에는 본문이 보인다(Review 와 같은 방식).
- 프로필 `bp3/p1` 은 `rm -rf` 금지라 남겼다. 겹치는 M1 스크린숏 2장은 파일 하나씩 지웠다.

## 5. 남은 문제 · 운영자 몫

1. **(알림) 속도 단추는 52px 만으로 한 줄이 안 된다** — 안 여백·사이를 4px 로 더 줄였다(위 1 (나)). 다른 안(둘 중 하나만)도 숫자로 적었다.
2. 위 여백 0 으로 "번역 위치" 단추가 원문 읽기 스위치와 바로 붙는다(팝오버·설정 AI 탭). 눈으로 보기엔 괜찮다. 실기기에서 잘못 누름이 있는지 볼 것.
3. 360×740 은 여전히 팝오버 안 스크롤이 필요하다(band ko 199px). 8dR-9 ①(Nour 안내 한 줄) 그대로.
4. `[M]` 실기기(Realme GT 7 Chrome): 속도 단추 한 줄(기기 글꼴·글자 크기 설정에서 남는 30px 로 버티는지), 팝오버 가림.
5. 관찰(범위 밖, 조사 안 함): 시험 순서 en·fr → ko 로 UI 를 바꾼 뒤 360 스크린숏에서 쪽 이동 줄·"Back"·하단 고지가 영어로 남아 있다. 변경 전 스크린숏에도 같다. fr 화면에서도 같은 자리가 영어다(번역 없는 키이거나 시험 경로의 언어 바꿈 탓일 수 있음).
6. 하5(`sizeBytes` +38)는 기록만 — 이번 범위 밖.

## 6. 커밋할 것(운영자가 할 때)

- 앱: `css/{reader,screens}.css`·`index.html`·`js/ui/{inlinetr,settings}.js`·`spec.md`·`tests/inlinetr-8d.test.mjs`
- `.claude/tasks/medreader-build-polish3{,-report}.md`
- 커밋하지 않을 것: `.codex/`·`AGENTS.md`·`medreader-status-2026-11-02.html`(`git add -A` 금지). `.nojekyll` 그대로.
