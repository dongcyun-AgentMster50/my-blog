# Build 보고 — 8c-2 사용량 화면 · 80% 경고

> Build 서브에이전트 · 2026-11-16 · 지침 `.claude/tasks/medreader-build-8c2-usage.md` · 설계 spec 17-7-6 4-7·5(8c-2 행)·6·7·8 "8c-2"·9·10·12 · 직전 배포 8f-3(+8f-3b) `da0b3f4`. **커밋하지 않았다.**

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/usage.js` (새, 364줄) | 순수 `usageView(rows, ctx)` · **`callsPer10k(rows, {minChars})`**(crossstep ① — 13-2 가 씀) · `readalongStats` · `pagesLeft` · `monthBars` · `staleDays`·`dayShift` + 화면(`initUsage`·`showUsage`) — 호출 0, 열 때 90일 지난 `usage` 행 지움, 마지막으로 연 책 `readStats`, `createCache().stats()`(읽기만), `textContent` 만, `__medreader.usage` 측정 훅(숫자만) |
| `tests/usage-8c.test.mjs` (새, 22시험) | U1–U6 순수 · W1–W9(+W7b) 80% 경고 · K1 `stats()` · S1–S5 배선·i18n·16-J |
| `js/ai/pipeline.js` (+44) | 순수 export `dailyCapOf`·`capUsedOf`·`warnThreshold`(`overCap` 이 같은 것을 씀 — 의미 불변) · `checkWarn()` — `ctx.calls++` 다음, 구독자 있을 때만, 그날 행 `capWarned` 로 하루 한 번 + 파이프라인 안 `warnedDay` · `onWarn(fn)` |
| `js/ai/cache.js` (+16) | `stats()` → `{count, bytes, byKind, oldestAt}`(다시 훑기, 읽기만) |
| `js/ui/controls.js` (+6) | `pipeline.onWarn` → `medreader:banner` `ai.capWarn`(`{pct, used, cap}`) + [사용량 보기] |
| `js/ui/trband.js` (+1 단추) | `remoteBanner('capped')` 동작 단추에 `{usage.open, #/usage}` |
| `js/ui/settings.js` (+7) | `#/settings/cache` 면 캐시 줄을 가운데로·[비우기] 포커스(사용량 화면 [설정에서 비우기] 받기 — 장치는 한 곳) |
| `js/main.js` (+3) | import · `initUsage()` · `case 'usage'` |
| `index.html` | 자리표시 섹션 → 사용량 화면 마크업 · 설정 AI 탭 상한 줄 아래 [사용량 보기] · stamp |
| `css/screens.css` (+70) | 사용량 화면(논리 속성, 막대 31칸 CSS, 48px) · **단추 셋 이상 배너만 줄바꿈**(`:has(> button:nth-of-type(3))` — 아래 3절 headless 실측 사유) |
| i18n 4개 | `usage.*` 31키 + `ai.capWarn`, `usage.placeholder.title/body` 지움, ar·fr `[검토 — Nour·운영자]` |
| `spec.md` | 17-7-6 4-7 끝에 `[정정 2026-11-16 — 8c-2 Build]` 한 줄 |
| `.claude/tasks/medreader-crossstep-notes.md` | 후보 줄 하나 덧붙임 |

건드리지 않음: `prompts.js`·`provider.js`·`db.js`·`readalong.js`·`wordsheet.js`·`vocab.js`·`router.js`·review.md·`dev/`(추적 안 된 `dev/measure-table-8i4.mjs` 포함). DB 3·`algoVersion`·캐시 키·`PROMPT_VERSION` 무변.

## 2. 수용 기준 (spec 17-7-6 8 "8c-2")

| 기준 | 결과 | 근거 |
|---|---|---|
| `[N]` `usageView`: 호출당 평균·1만 자당(소수 1자리)·calls 0 "—"·남은 쪽 반비례(두 스텁 readStats)·pages<5 숨김·월 막대 31칸·적중률·검증 제외 상한 | ✔ | U1–U5 |
| `[N]` 80% 경고: 상한 10·0.8 → 8번째 뒤 한 번, 9·10 없음, 같은 날 새 파이프라인 없음, 다음 날 다시, warnAt 0·1.5·문자열 → 없음 | ✔ | W1–W3 (+1·NaN·null·음수) |
| `[D]` "낭독 번역 n회 · m자" n = 가로챈 요청 수, m = 본문 `segments[].text` 글자 합, 종류별 따로 | ✔ | A4: n 6 = 6, m 30,211 = 30,211, 번역 1·낭독 6·단어 1 = 가로챈 탭 1·낭독 6·단어 1 |
| `[D]` 상한 3 낭독 → 3번째 뒤 capped, 원문 낭독 계속, 이후 요청 0(쪽 넘김·탭), 안내 1회, 80% 경고 1회 | ✔ | B1: 요청 3 뒤 15초 0건, 발화 85→198·쪽 61→64, 배너 capWarn 1·capped 1 · B2: 다른 쪽 탭(띠 blocked, 탭 2문장) 0건 |
| `[D]` 냉시작 1회 뒤 20,000자 넘게 연속 낭독 → 호출당 평균 ≥ 4,000 | ✔ | A1: 562 · 5,914 · 5,997 · 5,801 · 5,969 · 5,968 → 평균 5,035 |
| `[D]` 90일 넘은 행(심음)이 화면을 연 뒤 사라짐 · 캐시 수·MB · [설정에서 비우기] → 설정 AI 탭 | ✔ | A4: 100일 행 지움·30일 행 남음·"1일치를 지웠습니다" · 270개·266 KB(번역 269·단어 1) · A5: `#/settings/cache`, [비우기] 포커스·화면 안 |
| `[D]` 무료 티어 한도 숫자 없음(16-J) | ✔ | S5 grep(usage.js·pipeline.js·i18n 4·index.html) |
| 지침: 하루 한 번(같은 날 여러 번 넘어도 1, 날 바뀌면 다시) | ✔ | W1·W2·W7(동시 3호출)·W7b(표시 저장 실패) · C1/C2(새로고침 뒤 9번째 경고 0) |
| 지침: 낭독·탭·단어 요청 어느 쪽으로 넘어도 같은 경고 | ✔ | W6(세 길) · B1(낭독) · C1(탭) · C3(단어 [AI 로 번역]) |
| 지침: `capped` 배너 단추 → 사용량 화면 | ✔ | S1 · B3(배너 [사용량 보기] 48px → `#/usage` 3/3·남은 0·막대 꽉 참) |
| 공통: `--check` 0 · `git diff --check` 0 · innerHTML 새 사용 0 · 콘솔 오류 0 | ✔ | 아래 5절 |
| `[M]` | 적기만 — 7절 |

## 3. 요청 바이트·사용량 행·오류 처리 불변 근거

- **node 대조**(`b8c2/diff.mjs` — 8f-1 Review `r8f1/diff.mjs` 를 읽어 본뜸, HEAD `da0b3f4` 를 `git archive` → `b8c2/head`): 같은 흉내 fetch·메모리 DB·시계로 16 시나리오(Review 14 + 새 둘: 상한 10 에서 낭독 6·탭 3·단어 1·뒤 2 / 상한 3 에서 5xx 재시도·`retry()`)를 HEAD 와 작업 트리에 돌림 → **요청 본문·URL·헤더·사용량 행·캐시 레코드·결과·상태 이벤트 순서·타이머·base 전부 같음 `allSame: true`**. `warn` 인자로 작업 트리 쪽에 구독자를 붙여도 같고(차이는 사용량 행의 `capWarned:true` 한 필드 — 떼어 비교), 경고는 `8/10`·`3/3` 한 번씩. 예: mixlang `2bf4a37f08ad4020` · 5xx 청크 `813090f7…/99ecdc50…` · domain `2b571537…/9d76225e…/ee3f999a…` 양쪽 같음.
- 시험: W8(구독자 있음/없음 10호출 — 본문·URL 바이트 같음, 행은 `capWarned` 만 다름) · 기존 `term-8f` B1(번역 본문 sha256 고정)·`pipeline-8a` 전부 무변 통과.
- 설계: `checkWarn` 은 `sendChunk` 가 끝나고 `ctx.calls++` 한 **뒤**에만 돈다 — 요청 만들기·오류 분류·상태 전이·실패 기억과 닿지 않는다. 구독자가 없으면 DB 를 읽지도 쓰지 않는다. `overCap` 은 같은 식을 export 함수로 옮겼을 뿐.

## 4. 테스트 2회 · 변이

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,650 / 1,650 통과 · 1,650 / 1,650 통과**(`b8c2/full2.txt`·`full3.txt`). 새 시험 22.

| 변이 | 결과 | 잡은 시험 |
|---|---|---|
| M1 하루 한 번 조건(행 `capWarned`) 빼기 | 빨강 1 | W2 |
| M2 읽은 뒤 `warnedDay` 확인 빼기 | 빨강 1 | W7 |
| M2b 읽기 전 `warnedDay` 확인 빼기 | 초록 — **동등 변이**(읽은 뒤 확인이 같은 일을 함, 앞 확인은 DB 읽기를 아끼는 것뿐) | — |
| M2c 기억 둘 다 빼기 | 빨강 2 | W7 · W7b |
| M3 `onWarn` 구독자가 있으면 번역 요청 바꾸기 | 빨강 1 | W8 |
| M4 1만 자당 식 → 1천 자당 | 빨강 2 | U2 · U3 |
| M5 `usageView` 검증 빼기 지우기 | 빨강 2 | U1 · U4 |
| M6 남은 쪽을 전역 상수 쪽당 글자로 | 빨강 1 | U4 |
| M7 `stats()` 가 읽으며 지우기 | 빨강 1 | K1 |
| M8 문턱 ceil → floor | 빨강 2 | W3 · W5 |

복원은 모두 `b8c2/bak/` 를 읽어 쓰기 + 바이트 비교 "같음"(`b8c2/mut.mjs`·`mutrun.mjs`).

## 5. headless (Edge, pipe, 새 프로필 `b8c2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, 한 번에 하나)

| 실행 | 화면 | 결과 |
|---|---|---|
| A `pa1` ko 412×915 | 연속 낭독 → 탭 → 단어 → 사용량 → 설정 | 2절 표 · 사용량 화면 가로 넘침 0 · 단추·링크 최소 48px · 막대 31 · 설정 [사용량 보기] 48px → 돌아옴 · 46초 |
| B `pb2` ar 412×915 상한 3 | 낭독 → capped → 탭 → 배너 → 사용량 | 2절 표 · **RTL**: `dir=rtl`, 1일 막대가 오른쪽, 미터 채움이 오른쪽에서, 숫자는 앱 다른 곳과 같은 `Intl('ar')` 꼴(이 Edge 는 서양 숫자) · capped 배너(단추 셋) 화면 안·넘침 0·글 폭 380px · 38초 |
| C `pc3` 915×412 ko→ar 상한 10, 오늘 7 심음 | 탭 8번째 → 경고 1 · 새로고침 뒤 다른 문단 탭 9번째 → 경고 0 · 7 로 되돌려 새로고침 → 단어 [AI 로 번역] 8번째 → 경고 1 · 사용량 ko·ar | 가로 넘침 0·48px·ar 1일 오른쪽 · 25초 |

콘솔 오류 0 · page error 0 · 앱 4xx/5xx 0 · 외부 요청은 pdf.js CDN 둘뿐(기존). 스크린숏 5장 `b8c2/shots/`: `412x915-ko-usage.png` · `412x915-ar-usage.png` · `412x915-ar-capped-banner.png` · `915x412-ko-usage.png` · `915x412-ar-usage.png`.

headless 가 찾아 고친 것 두 가지: ① B 첫 실행(`pb1`)에서 capped 배너가 단추 셋이 되자 412px 아랍어에서 글이 낱말 하나 폭으로 좁아지고 [إخفاء] 가 화면 밖으로 밀림 → `screens.css` 에 단추 셋 이상 배너만 글 첫 줄 전체·단추 다음 줄(1–2단추 배너 무변) → `pb2` 에서 화면 안. ② `#/usage` 로 바로 부팅하면 `main.js` 가 `window.__medreader` 를 새로 만들어 측정 훅이 사라짐 → 읽기 끝에 다시 단다(사용자 화면 무관).

## 6. spec 정정

17-7-6 4-7 의 80% 경고 줄 뒤 `[정정 2026-11-16 — 8c-2 Build]` 한 줄(①–⑧): 상한 셈 한 벌 export · 구독자 없으면 읽기·쓰기 0 · `warnedDay` · 문턱 `ceil(cap × warnAt − 1e-9)` · 문구 `{pct}` · 16-J "2.4→3회째 전" 표기와 달리 3번째 호출 뒤가 정본 · 화면 "오늘 호출"(검증 포함)과 상한 줄(검증 제외) · 늘 보이는 종류 · 남은 쪽은 오늘 호출당 평균 · `callsPer10k` 서명 · `stats()` 모양·별도 인스턴스 · `#/settings/cache` · 429 줄 · AI Studio 주소 · i18n 31 + 1.

## 7. 운영자에게 물을 것 (무료 한도 원칙·비용·외부 전송은 바꾸지 않았다)

1. **AI Studio 링크 주소** — 지금 `https://aistudio.google.com/docs/rate-limits`(spec 출처 줄에 2026-11-16 열람으로 적힌 주소). spec 의 "사용량 페이지"가 다른 주소면 알려 주세요(이 Build 는 웹을 열지 않았다).
2. **429 를 하루 소진으로 읽는 판정**(crossstep 8c-1 줄) — 사용량 화면은 "1분 한도일 수도 — 잠시 뒤 [다시 시도]" 로 오해만 줄였다. 띠·상태 바 문구와 `pipeline.js` 판정(`RetryInfo`·`quotaId`)은 8a 몫으로 남김 — 다듬기 묶음에 넣을지.
3. (기존 8cf-Q1) 사용량 화면의 "번역(탭·문장)" 수가 Q1 판단 근거가 된다 — 실기기 하루 뒤 그 수를 보고 정하기.

## 8. 마지막 실기기 점검 묶음에 더할 것 `[M]` (적기만)

- Nour GT 7: 사용량 화면 아랍어 — 숫자 꼴(서양/아랍-인도)·막대 방향·가로 넘침, 상한 도달 배너(단추 셋) 줄바꿈.
- 80% 경고가 하루 한 번만 뜨는가(앱을 닫았다 열어도), 다음 날 다시.
- AI Studio 링크가 VPN 켠 상태에서 열리는가(새 탭).
- [설정에서 비우기] → 설정 캐시 줄 → Android 뒤로 제스처로 사용량 화면 복귀.
- 하루 써 본 뒤 "낭독 번역 n회 · 호출당 평균"이 4,000자 이상인가(실제 Gemini 응답).

## 9. 남은 문제

- 상태 바 배너는 화면을 옮겨도 남는다(기존 설계) — 사용량 화면 위에 경고·capped 배너가 겹쳐 보인다(스크린숏 `412x915-ar-usage.png`).
- 경고·capped 배너의 숫자는 띄울 때의 UI 언어 숫자로 고정(언어를 바꾸면 문구만 바뀜 — `ai.state.capped` 와 같은 꼴).
- "오늘 상한까지 약 n쪽" 은 **오늘** 낭독 번역 호출당 평균을 쓴다 — 그날 첫 낭독 전에는 숨는다(15절 그대로). 최근 30일 평균으로 넓힐지는 13-2 와 함께.
- 사용량 화면은 열 때만 읽는다(떠 있는 동안 새로 세지 않음 — 리더를 떠나면 낭독도 멈춰 새 호출이 없다).
- 설정 [비우기]는 `db.clearStore` 를 바로 불러 공유 캐시 인스턴스의 크기 셈이 다음 정리 때까지 옛 값(HEAD 부터 — 정리 때 다시 셈).
- `grep splitSentences js/` 는 세 파일(`text/segment.js`·`tts/text.js`·`text/cite.js`) — HEAD 그대로, 이 Build 무관(R6 시험 통과).
- M2b 동등 변이(앞 `warnedDay` 확인은 최적화).

## 10. 막힌 명령

권한으로 막힌 명령 없음. 실수 둘(변형 아님): `node --test apps/medreader/tests/`(폴더 인자 — 이 Node 는 받지 않음, 지침의 `*.test.mjs` 꼴로 다시) · `tar -xf C:/…`(GNU tar 가 `C:` 를 원격 호스트로 읽음 → `--force-local`).
