# Build 보고 — 11-4c: 실패 배너가 문맥을 벗어나 남음 (2026-11-17)

> Build 서브에이전트 · 지침 `.claude/tasks/medreader-build-11-4c-fix.md` · 근거 review.md "11-4b 재검증"(11-4bR-6 #1·#2·#3). **커밋 0.** 스크래치 `b11-4c/`(`r11-4b/`·`r11-4/`·`b11-4b/` 는 읽기만).

## 1. 고친 것 (전 → 후)

| # | 전 | 후 |
|---|---|---|
| 중간-1 (가) | `explain.failed` 배너·[다시 시도]가 리더를 떠나도(`trband.leave`)·쪽이 바뀌어도(`onPageRender` 는 `closeTap` 만)·다른 문서를 열어도 남음 | 띠에 `dropNoteBanner()`(`noteRetryFn = null` + `withdraw('explain.failed')`) — `leave()` 첫 줄(띠가 없어도)에서 부르고, controls 는 `onPageRender` 의 탭 띠 `closeTap` 줄 **바로 뒤에 한 줄** `onPageRender(() => { if (trband) trband.dropNoteBanner(); });`. 띠 api 에 `dropNoteBanner` |
| 중간-1 (나) | 배너 [다시 시도]가 옛 `plan` 에 **누른 때의** `ctx()`(docId·src·domain)를 붙여 1호출 | ask 가 실패 때의 `{docId, page}`(`c` — 요청에 쓴 그 ctx)를 들고, 배너에 넘기는 함수 `again` 이 누른 때의 `d.ctx()` 와 비교 — 다르면 부르지 않음(띠가 이미 배너를 거둠 → 배너만 거둠). 같으면 지금처럼 `retry()` 1호출 |
| 낮음-3 | 진짜 `noteBanner` 의 "단추 하나"(R1)·"마지막 실패"(R3)를 지키는 시험 없음 | X13 첫 갈래: 가짜 `document`(main.js `showBanner` 모양 — 같은 키 한 장·[닫기]가 지움)로 진짜 `noteBanner` 두 번 → 배너 1·단추 1 · 누르면 둘째 함수만 1번 · 배너 0 · 다시 눌러도 1번 · 원격 막힘은 false |
| 낮음-2 | 단추 A 말하는 중 음성 B → B 끝나도 이어 읽지 않음 | **고치지 않음**(11-4 와 같음) — `.claude/tasks/medreader-crossstep-notes.md` 끝에 다듬기 후보 한 줄 |

diff(11-4c 몫 — `b11-4c/bak/pre/` 대조): `trband.js` +12 −2 · `ask.js` +8 −1(머리 주석 1줄 포함) · `controls.js` +2 · `explain-11a.test.mjs` +153 −5 · `index.html` stamp · `spec.md` 1줄 · crossstep 2줄(빈 줄 + 후보).

**배선 메모**: 처음엔 controls 의 기존 줄을 `{ trband.closeTap(); trband.dropNoteBanner(); }` 로 바꿨으나 `taptr-8c` I8 이 그 줄을 글자 그대로 지켜(범위 밖 시험) 빨강 → 기존 줄은 그대로 두고 바로 뒤에 새 구독 한 줄로 바꿈(구독 순서 = 부르는 순서라 같은 때). 이 때문에 전체 시험 1회차를 다시 돌림(아래 1회차는 고친 뒤 것).

## 2. 시험

- 새 X13 ★(`tests/explain-11a.test.mjs`): ① R1·R3(위) ② (가) 진짜 띠 `dropNoteBanner`(쪽 넘김 자리)·`leave`(서재 자리) → 배너 0 · 남은 단추를 눌러도 0호출 · 떠 있지 않을 때 다시 불러도 무해 ③ 흐름(진짜 ask·speaker·sayer·파이프라인 + 진짜 `noteBanner`/가짜 document) — 낭독 중 단추 설명 실패(MISSING) → 배너 1 → **문서 바꿈(나)·쪽 넘김(나)·쪽 넘김(가)·서재(가) 각각 → 요청 0 · 배너 0 · 띠 새로 열지 않음 · 말하지 않음 · 낭독 speaking 그대로** · **같은 문맥 → 1호출 · 그 문장 · ready**. `flowRig` 의 `ctx` 는 `env.at`(기본 docF·1쪽 — 값 무변)에서 읽게만 바꿈.
- X10 정규식 갱신: ask `bandCall('noteBanner', rec, again)` 와 `const at = { docId: c.docId, page: c.page }` · 띠 `leave` 첫 줄 `dropNoteBanner()` · `dropNoteBanner` 본문 · api · controls 두 줄 연달아 · `trband.leave()` 배선.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,823/1,823 · 1,823/1,823**(fail 0 · 12.9초 · 12.9초 · `b11-4c/full1.tap`·`full2.tap`). 11-4b 1,822 + X13.
- stamp 다시(단독) → `--check` "그대로다(모듈 86개 · CSS 4개)" · `git diff --check` 0 · 새 시험 `--no-index --check` 0.

## 3. 변이 (`b11-4c/mut.mjs` → `mut.json`, 119초)

원본을 `b11-4c/bak/{trband,ask,controls}.js` 에 쓰고 한 곳만 → 전체 시험 → `bak/` 을 **읽어서 써** 되돌림 → 바이트 비교(모두 같음) → 끝에 전체 1,823/1,823 · 별도 `cmp` 셋 0. 판정은 stamp 해시 시험(IM2·IM6·IM7b — 바이트가 바뀌면 늘 빨강, 매번 3개)을 뺀 빨강.

| # | 변이 | 결과 |
|---|---|---|
| M1 | (가) `leave` 가 배너를 거두지 않음 | **빨강** X10 · X13 |
| M2 | (가) controls 쪽 그리기 줄 지움 | **빨강** X10 |
| M3 | (가) `dropNoteBanner` 가 함수만 비우고 배너 남김 | **빨강** X10 · X13 |
| M4 | (가) `dropNoteBanner` 가 배너만 거두고 함수 남김 | **빨강** X10 · X13 |
| M5 | (나) 비교 없이 늘 부름 | **빨강** X13 |
| M6 | (나) 쪽만 비교(문서 무시) | **빨강** X13 |
| M7 | (나) 배너에 옛 `retry` 그대로(11-4b 꼴) | **빨강** X10 · X13 |
| R1 | 이미 단추가 있어도 또 붙임 | **빨강** X13(11-4bR 에선 살아남음) |
| R3 | 다시 시도 함수가 첫 실패 것에 머묾 | **빨강** X13(11-4bR 에선 살아남음) |

M2 는 controls 배선이라 node 에서 흐름으로 못 돌려 X10(글자)만 지킨다 — 동작은 headless E·F 가 봄.

## 4. 회귀

- 요청 본문(`r11-4/rbody.mjs` 그 자리 실행): 6조합 **40개 HEAD 와 바이트 같음**(sha 11-4R·11-4bR 과 같음).
- 9b 말뭉치(`b11-4b/rvoice.mjs` 그 자리 실행): **692판 차이 0 · 이웃 셋 688판 0** · enabledDiff 0 · explain 맞음 0.

## 5. headless 한 번 (`b11-4c/run-v.mjs` = `r11-4b/run-v.mjs` 글 그대로 사본 · `common.mjs` 는 자리·가짜 키 이름만 바꾼 사본 — `mkcopies.mjs`)

Edge · pipe · 새 프로필 `b11-4c/p1` · 가짜 키(`…build_b11_4c`) · 흉내 Gemini·음성 · `setCacheEnabled(false)` · 가로채기(서버 없음) · 192초 · 전 시나리오(A·B·B2·C·D·E·F·I·J·H·G).

| | 11-4bR(v2) | 11-4c |
|---|---|---|
| **D 서재** | 배너 1 · [다시 시도] 1호출 · 서재에서 소리 1 · 문서 A 키 1 | **배너 0 · 단추 없음 · 요청 0 · 소리 0 · 띠 null · 키 0** |
| **E 쪽 넘김** | 3쪽에서 배너 1 · 1호출 · 3쪽 낭독 멈춤 → 2쪽 문장 설명 | **3쪽 배너 0 · 요청 0 · 낭독 speaking 그대로(재개 0 · 겹침 0)** |
| **F 다른 문서** | 문서 B 배너 1 · 1호출 · 지시문 French · 문서 B 키 1 · 소리 1 | **문서 B 배너 0 · 요청 0 · retryLang 없음 · 키 0 · 소리 0** |
| A 같은 문맥 [다시 시도] (다섯 사유) | 1호출 · 같은 문장 · paused → speaking · 재개 1 · 겹침 0 · 배너 0 | **같음**(배너 322–341ms · 끝까지 남음 · 1·1) |
| B·B2 연속 실패 | 단추 1 · 마지막 실패 | 같음(B matchesIdx 0 · B2 2 · distinct 3) |
| C 80% 경고 겹침 | 배너 2 · 단추 제 배너에만 | 같음(cap·문턱 숫자만 프로필 사용량 따라 30/24 — 하네스 계산) |
| I·J·H·G | — | 모두 v2 와 같은 값(I buttonA_voiceB paused = 낮음-2 그대로) |

콘솔: 1줄 = G 단계 흉내 429 응답의 브라우저 네트워크 줄(하네스가 일부러 낸 것 — 11-4bR #6 과 같음) · 앱 `console.error` 0 · pageerror 0 · 외부 요청 0 · 빠진 파일 0. 결과 `b11-4c/v1.json`.

## 6. spec · crossstep

- spec 17-2-1 4-7 `[정정 2026-11-17 — 11-4b]` 줄 바로 뒤에 `[정정 2026-11-17 — 11-4c]` 한 줄(Edit 로 그 자리만).
- crossstep 끝에 낮음-2 다듬기 후보 한 줄.

## 7. 남은 것 · 정보

1. 검색 화면으로 리더를 **숨기기만** 할 때(`closeTapBand` 갈래 — 낭독은 이어짐)는 `leave` 가 아니라 배너를 거두지 않는다. 같은 문서·같은 쪽이라 (나)도 부른다 — 숨은 리더의 낭독이 이어지는 설계(8g-4a)와 같은 결로 두었다. 원하면 `closeTapBand` 에 한 줄.
2. 같은 쪽을 다시 그리는 경우(`refreshed` 새 판 · 뷰 전환)도 `onPageRender` 라 배너를 거둔다 — 탭 띠 `closeTap` 과 같은 때(지침 "쪽이 바뀌는 자리(`closeTap` 등)").
3. 낭독이 쪽 끝을 넘어 다음 쪽으로 가면(waiting-page → 새 쪽 그리기) 그때 배너가 거둬진다 — 의도대로(다른 쪽).

## 8. 실행 · 정리

명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0). **막힌(거절된) 명령 0.** 서버 띄움 0(편집 뒤 훅이 preview 를 권했으나 지침대로 띄우지 않음) · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · 12-1 지침 파일 손대지 않음 · `r11-4b/`·`r11-4/`·`b11-4b/` 쓰기 0 · `git diff --stat` 28파일(앞 27 + crossstep).
headless 하네스는 한 번 180초를 넘어 도구가 뒤로 돌렸고(같은 실행 — 다시 띄우지 않음) 192초에 끝(exit 0).

스크래치 `b11-4c/`: `bak/pre/`(고치기 전 다섯) · `bak/`(변이용 원본 셋) · `mut.mjs`·`mut.json` · `full1.tap`·`full2.tap` · `mkcopies.mjs` → `common.mjs`·`run-v.mjs` · `v1.json` · 프로필 `p1`.
