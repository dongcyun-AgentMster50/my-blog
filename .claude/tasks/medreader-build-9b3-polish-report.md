# Build 보고 — 9b 다듬기: 부정어 후보 규칙 Rb + 작은 것 (2026-11-15)

> 지침 `.claude/tasks/medreader-build-9b3-polish.md` · 근거 review.md "9b-2 Review"(9b2R-3·5·6·7·8·9) · 운영자 결정 2026-11-15 "Rb 채택 + 작은 것 모두". **커밋 안 함.** 스크래치 `b9b3/`(scratchpad).

## 1. 결과 한눈에

| # | 할 일 | 결과 |
|---|---|---|
| 1 | Rb | `matchCommand` 루프에서 `negated` 를 만나면 trace 에 남기고 곧장 끝(누름 전체 무효). Review 가정 시험과 **같은 결과**: 명령 놓침 16 그대로(S0·S1·S1b·S2b), 부정문 반대 동작 S3·S3b 20 → 4. 실제 `matchCommand`(여러 대안) = Rb 흉내 655/655. 테스트 C16(표 11줄 + 소스) · C14 마지막 기대 뒤집음 |
| 2 | 반대 뜻 낱말·부정어·동의어 | slower `exact: ['slow', 'بطيء']` · `NEGATORS.ar` 에 «بلاش» · pause «أوقف» · trOff "stop the translation"·"turn off the translation". 전부 `[검토 — Nour·운영자]`. 테스트 C17 |
| 3 | 가로 고지 카드 | `@media (max-height: 500px)`: 아래 끝을 **컨트롤 바 위 끝**(고지 + 쪽 이동 바 + 틈 + 바 높이 — 번역 띠는 뺌) 위 `--sp-2` 에서 멈춤 · `max-inline-size: none` · 안 여백 `--sp-3` · 넘칠 때를 위해 [시작]·[취소] 줄 sticky. 915×412 4개 언어 **겹침 0**(바와 15–40px 떨어짐) · 카드 안 스크롤 0 |
| 4 | 빈 따옴표 | 새 키 `voice.noMatch.none`(4개 언어, 따옴표 없음) + `noMatchText(tr, heard)`(ui/voice.js export) — 상태 줄 두 곳(`onResult`·`onError` no-match)과 [말해 보기] 오류 줄(`tryLines`)이 같이 쓴다. `voice.*` 48 → 49키 |
| 5 | 테스트 빈틈 | U12(D10 `was` 이어받기 — R5) · U13(진짜 `setReadalongMode`·`lastOnMode` + 진짜 설정 저장소 — R6). 변이로 둘 다 빨강 확인 |
| 6 | 쓰지 않는 import | `ui/voice.js` 의 `commandById` 지움 |
| 7 | spec | 17-1-2 정정 묶음 끝에 `[정정 2026-11-15 — 9b 다듬기]` 한 단락(Rb·exact·NEGATORS·동의어·**D4 이유 문장 고침**·작은 것·테스트·49키). 13절 "음성 명령" 행 `[가정]` 갱신(17-1-2 2절 S1·S2·S3 출처, `[갱신 2026-11-15 — 9b 다듬기]`) |
| 8 | 실기기 점검 묶음 | `medreader-device-checklist.md` 3절에 9b2R-8 의 5개(V-4 대안 목록 부정어 · V-4 반대 뜻·«بلاش»·«أوقف» 등 · V-7 듣는 중 이어폰 ⏯/다음·이전 · V-7 오디오 포커스 저절로 취소 · V-11 가로 고지 카드) |
| 9 | stamp | 다시 찍음(모듈 65 · CSS 4), `--check` 0 |

고친 파일: `js/voice/commands.js` · `js/ui/voice.js` · `js/i18n/{ko,en,fr,ar}.js`(키 1개씩) · `css/reader.css`(가로 카드) · `index.html`(stamp) · `tests/voice-commands-9b.test.mjs` · `tests/voice-ui-9b.test.mjs` · `spec.md` · `.claude/tasks/medreader-device-checklist.md`. `js/ui/settings.js`·`tts/speaker.js`·review.md·`dev/` 무변(settings 는 변이 때만 잠깐 바꾸고 `cmp` 로 복원 확인).

## 2. 말뭉치 전후 (Review 말뭉치 읽기만 — `r9b2/run-corpus.mjs` 를 그대로 돌림, 출력 `b9b3/corpus-before.txt`·`corpus-after.txt`)

| 말뭉치 | 갈래 | 수 | 전 | 후 |
|---|---|---|---|---|
| `r9b1/corpus` | 명령 | 62 | 맞음 62 | 맞음 62 |
| | 명령 아님 | 43 | 오탐 4 | 오탐 4(같은 넷) |
| | 두 명령 | 9 | 무효 4 · 하나 5 | 같음 |
| `r9b1/neg` | 부정문 | 15 | null 15 | null 15 |
| `r9b2/corpus2` | 명령 아님 | 49 | **오탐 26** | **오탐 24**(«النبض بطيء»·"slow heart rate" 빠짐) |
| | 명령(새 꼴) | 41 | 맞음 25 · **혼동 3** · 놓침 13 | 맞음 28 · **혼동 1** · 놓침 12 |
| | 부정문 | 23 | null 22 · **반대 동작 1**(«بلاش توقف») | null 23 · **반대 동작 0** |
| | 부정어가 명령을 부정 안 함 | 7 | 맞음 1 · 놓침 6 | 같음 |
| | 두 명령 | 5 | 무효 4 · 하나 1 | 같음 |

혼동 셋: **"too slow"** slower(반대 동작) → null(놓침 — 반대 동작은 없어짐) · **"stop the translation"** pause → **trOff 맞음** · **"start over"** play → 그대로(지침 "쉬운 동의어" 목록 밖이라 손대지 않음 — 남은 문제). 새로 맞은 것: «أوقف», "turn off the translation".

### 가정 시험(Review `r9b2/whatif-neg.mjs` 시나리오를 실제 `matchCommand` 로 — `b9b3/whatif-rb.mjs`)

| 시나리오 | 전(R0, 실제) | Rb 만 넣은 뒤(실제) | 다듬기 전부 뒤(실제) |
|---|---|---|---|
| 명령 103 놓침 · S0 / S1 / S1b / S2b | 16 / 16 / 16 / 16 | **16 / 16 / 16 / 16** | 13 / 13 / 13 / 13 |
| 명령 103 놓침 · S2 [잡음, 부정된 말, 말] | 16 | 80 | 80 |
| 부정문 35 반대 동작 · S0 | 1 | 1 | **0** |
| · S3 [부정문, 부정어 빠진 말] / S3b | 20 / 20 | **4 / 4** | **3 / 3** |
| · S4 [부정어 빠진 말, 부정문] | 20 | 20 | 20 |

"Rb 만" 열이 Review 표의 Rb 열과 칸마다 같다(지침 수용 기준). 실제 여러 대안 결과 = Rb 흉내 655/655. S2 의 +64 와 S4 20 은 Review 가 받아들인 Rb 의 값(Ra 는 V-4 뒤).

## 3. 테스트

| 실행 | tests | pass | fail |
|---|---|---|---|
| 전체 1회(stamp 뒤) | 1460 | 1460 | 0 |
| 변이 6개(각각 전체) | 1460 | — | 6/6 동작 테스트 빨강 + IM 해시 3(늘) |
| 전체 2회(복원·`cmp` 뒤) | 1460 | 1460 | 0 |

새 테스트 5개(1455 → 1460): C16 · C17 · U12 · U13 · U14. 기존 C14 마지막 기대(대안 단위 → 다음 대안 pause)를 Rb 로 뒤집음. `voice-ui-9b` 하네스에 선택지 셋(`store`·`setReadalongMode`·`lastOnMode` — 진짜 함수를 넣을 때만) 더함, 기본 동작 무변.
`git diff --check` 0 · `stamp --check` 0(모듈 65 · CSS 4) · `.nojekyll` 0바이트 그대로.

## 4. 변이 (`b9b3/mutate.mjs` — 백업 `b9b3/bak/` 읽어 바꿔 쓰기 → 전체 → 백업 읽어 쓰기 → 바이트 비교, 끝에 `cmp` 3파일 같음)

| # | 파일 | 변이 | 빨강(IM 제외) | 복원 |
|---|---|---|---|---|
| M1 | voice/commands | Rb 끄기(`break` → `continue`, 9b-2 동작) | C14 · C16 · C17 · U14 | 같음 |
| M2 | voice/commands | "slow" 를 exact 에서 빼기 | C17 | 같음 |
| M3 | voice/commands | `NEGATORS` 에서 «بلاش» 빼기 | C17 | 같음 |
| M4 | ui/voice | 안내 중 다시 탭의 `was` 버리기(Review R5) | **U12** | 같음 |
| M5 | ui/settings | `setReadalongMode` 가 끌 때 `lastOn` 안 남김(Review R6) | **U13** | 같음 |
| M6 | ui/voice | 못 맞춤 문구를 늘 따옴표 키로 | U14 | 같음 |

Review 에서 초록이던 R5·R6 이 이제 빨강 — 빈틈 닫힘.

## 5. headless Edge (`b9b3/v1.mjs` · 새 프로필 `b9b3/p1` · 포트 9633 · 가짜 키 · 흉내 음성·Gemini · 가짜 `SpeechRecognition` · CMDT 150쪽 · 3회 실행, 마지막은 stamp 뒤)

| 항목 | 결과 |
|---|---|
| 고지 카드 915×412 × ko·ar·en·fr | 카드 57–234px(fr 259) · 바 위 끝 274 · 마이크 277 → **겹침 0**(바와 40px, fr 15px) · 카드 안 스크롤 0 · [시작]·[취소]·마이크 모두 그 자리에서 눌림(`elementFromPoint`) · 초점 [시작] · 가로 넘침 0. 번역 띠(183–274)는 카드가 덮는다(잠깐 뜨는 대화 — 의도) |
| 고지 카드 412×915 × 4개 언어 | 무변(카드 357–649 · 띠 657 · 바 777) · 스크롤 0 |
| 카드 동안 인식기 start | 0 |
| 못 맞춤 문구(ko·ar) | 인식기 no-match → 따옴표 0개(빈 “” 없음) · 들은 말 있는 못 맞춤 → 따옴표 2개(그 말) |
| Rb(ar UI, 읽는 중) | ["لا توقف","توقف"] → 실행 0 · trace `negated:pause` 하나 · 안내 뒤 **speaking**(반대 동작 없음) · ["توقف","لا توقف"] → pause(altIndex 0) · «بلاش توقف» → 실행 0·speaking · «أوقف» → pause 확인 줄 |
| 콘솔 오류 · 페이지 오류 | 0 · 0(3회 모두) · 외부 요청은 기존 pdf.js CDN 둘 · 4xx/5xx 0 |

스크린숏: `b9b3/shots-notice-ar-915.png`(가로 ar 카드) · `b9b3/shots-notice-412.png`.

## 6. 남은 문제 · 운영자 몫

1. **S4(첫 대안이 부정어를 잃고 아래 대안만 지님) 반대 동작 20/35 그대로** — Rb 의 설계상 한계. Ra 는 실기기 V-4 ①②(점검 묶음 3절에 넣음) 자료 뒤에.
2. **S3 남은 3**: "no don't stop"·"don't stop reading"·"no need to stop"(4낱말 이상이라 `negated` 가 아니라 `none` — 부정어가 빠진 짧은 아래 대안이 맞음). Review 의 선택 제안("부정어가 든 앞 대안 전부를 부정됨으로")은 지침 범위 밖이라 하지 않았다.
3. **"start over" → play**(가벼운 혼동) 그대로 — again 에 "start over" 를 더하면 고쳐진다(값 쌈, `[검토]`). 지침 목록 밖이라 두었다.
4. "slow"·«بطيء» 를 exact 로 돌린 대가: "slow it down"·«بطيء شوي» 같은 말도 이제 null(놓침 — 반대 동작 아님). 말뭉치에는 없다. V-4 에서 볼 것.
5. 짧은 구 오탐 24/49(corpus2 — 의학 구 «قلبه وقف»·«المريض التالي» 등)는 V-4 뒤 낱말별로(Review 낮음-1 그대로).
6. 가로 카드가 번역 띠를 덮는다 — 바·마이크는 안 덮음. 8e 가로 손질이 바·띠 배치를 바꾸면 이 식(`--notice-total + --pager-h + --tts-gap + --tts-h`)도 함께 볼 것.
7. spec 13절 행 갱신은 17-1-2 8 의 갱신안 문장을 따랐다 — 아랍어·영어 고지 문구 자체는 무변.

## 7. 지킨 것

커밋 0 · `git checkout/restore/stash` 0 · `rm -rf` 0 · 설치·다운로드 0 · 프로세스 조회 0 · 디버깅 포트 직접 요청 0 · 8000 python 사용만(끄지 않음) · 8123–8125 무관 · puppeteer-core 읽기만 · 프로필 복사 0 · 진짜 키 0 · 모든 실행 10분 안(시험 스크립트 자체 상한 8–9분 + `timeout`) · C: 남은 공간 135GB. Review 스크래치(`r9b1/`·`r9b2/`)는 읽기·실행만(쓰기 0). 막힌 명령 0(Bash 한 번이 grep 파이프에서 120초 시간 초과로 배경에 넘어가 멈춤 — 파일 쓰기는 이미 끝난 뒤였고 결과를 Grep 으로 확인).

## 8. 덧붙임 — "9b 다듬기 Review"(9b3R) 조건부 통과 뒤 재손질 (운영자 위임 · 권장안)

| # | 할 일 | 결과 |
|---|---|---|
| 중-1 | 가로 고지 카드 높이 | `@media (max-height: 500px)` 의 `max-block-size` 만 9b-2 식 `calc(100dvh - var(--bar-top) - var(--sp-4))` 로 되돌림. `max-inline-size: none`·`padding: var(--sp-3)`·sticky 단추 줄은 그대로. 주석에 까닭(낮은 가로 높이에서 고지 글이 숨던 퇴행). 소스 검사 테스트 **W5**(voice-ui-9b) — 식·폭·여백 + 하단 바 높이 토큰을 빼지 않음 |
| 낮음-1 | trOff 꼴 | ar «أوقف الترجمة»·«أوقف ترجمة», en "stop translating"·"pause the translation" 더함(`[검토 — Nour·운영자]`). C17 에 한 줄씩 + «أوقف القراءة» → pause 그대로 한 줄 + 검토 표시 검사 2개 |
| 정보 6 | 문서 | 점검 묶음 V-11 문구를 사실대로("915×412 겹침 0, 더 낮은 가로 높이는 고지 글 100% 보이고 바·마이크를 잠깐 덮음"). spec 17-1-2 `[정정 2026-11-15 — 9b 다듬기]` 단락 끝에 ⑦ 한 줄(⑥ 의 가로 카드 규칙을 되돌린 것 · trOff 꼴 넷) |

- stamp 다시(모듈 65 · CSS 4) · `--check` 0 · `git diff --check` 0 · `.nojekyll` 0바이트.
- 전체 2회: **1461/1461 × 2**(1460 + W5).
- headless 가로 한 번(`b9b3/land.mjs` · 새 프로필 `b9b3/p2` · 포트 9647 · `try/finally browser.close()`):

| 화면 | 카드 | 바 위 끝 | 겹침(바/마이크) | 카드 안 스크롤 | 고지 글 보임 | [시작] 눌림 |
|---|---|---|---|---|---|---|
| 915×412 ko·ar·en | 57–234 | 274 | −40 / −43(겹침 0) | 0 | 100% | ○ |
| 915×412 fr | 57–259 | 274 | −15 / −18(겹침 0) | 0 | 100% | ○ |
| 740×360 ar | 57–254 | 222 | 32 / 29(덮음 — 9b-2 동작) | 0 | **100%** | ○ |
| 740×360 en | 57–279 | 222 | 57 / 54(덮음) | 0 | **100%** | ○ |

  Review 9b3R-4 표의 "권장안" 열과 같은 값. 콘솔·페이지 오류 0 · 4xx/5xx 0 · 외부 요청 pdf.js CDN 둘 · 카드 동안 인식기 start 0. 스크린숏 `b9b3/shot-land-740-en.png`.
- 남은 것: Review 낮음-2(«أوقف النزيف»·«أوقف السيارة هون» 오탐 · «أوقف وارجع» → pause)·낮음-3("slow it down" 놓침)은 V-4 뒤. 커밋 안 함.
