# Build 보고서 — 7b: 설정 AI 탭과 실제 호출

> Build 서브에이전트 작성 · 2026-10-03 · **커밋하지 않았다.** 실제 API 키는 어디에도 넣지 않았다.

## 1. 바꾼 파일

| 파일 | 한 줄 요약 |
|---|---|
| `js/ai/provider.js` | `CODES.REGION` 추가. `verifyKey` 에 `REGION` 분기 명시(`{ok:false, code:'REGION', canSave:true}`). 실패 갈래에 **실제 키로 지운** 서버 메시지 `message` 를 붙인다(8-2 `dev.debug` 표시용) |
| `js/ai/adapters/gemini.js` | **고치지 않았다.** 사용자 작성 `REGION` 분기(방법 B) 그대로. `git diff` 는 시작 때와 같은 11줄 |
| `js/ui/settings.js` (새 파일) | 설정 AI 탭 전체 + [검증]·[시험 번역] + 다섯 갈래 문구 + 동의 관문 + 번역 따라가기 줄의 **공용 그리기 함수** `renderReadalongRow` + 순수 함수들(테스트 대상) |
| `js/ui/notice.js` (새 파일) | `piiWarning()` — 아랍어 줄이 항상 먼저, UI 가 아랍어가 아니면 현재 언어 줄을 하나 더. `textContent` 만 |
| `js/settings.js` | 9-3 키 `readalong.mode`(기본 `'speak'`)·`readalong.speakSource`(기본 `true`) 추가, `ai.cacheLimitMB` 50 → **200**(9-3 `[수정 2026-09-28]`) |
| `js/ui/controls.js` | 속도 팝오버를 열 때 `renderReadalongRow(#ttsReadalongRow)` 호출(6줄). `speaker` 는 건드리지 않는다(저장만) |
| `js/main.js` | 설정 화면 init/show/leave 배선. 배너가 `detail.actions:[{key, nav}]` 를 **`data-nav` 버튼**으로 그린다(키 없음 안내의 [키 설정]) |
| `index.html` | `data-screen="settings"` 섹션 교체(자리표시자 → AI 탭), 서재 상단바 [설정], 속도 팝오버의 번역 따라가기 그릇 + [번역 설정] |
| `css/screens.css` | 설정 화면·결과 상자·경고·스위치·번역 따라가기 줄 스타일. **논리 속성만** |
| `js/i18n/{ar,en,fr,ko}.js` | 새 키 63개(네 파일 같은 집합). `settings.placeholder.*` 2개는 대체되어 삭제. ar·en·fr·ko 모두 실제 번역 |
| `tests/settings-7b.test.mjs` (새 파일) | 37개 테스트 |

## 2. 16-D0 항목별 결과

| 항목 | 결과 | 확인 방법 |
|---|---|---|
| `[D][사용자]` 한국 PC 실제 키로 [검증]·[시험 번역], preflight·200·URL 에 키 없음 | **사용자 확인 대기** | 실제 키 필요. 절차는 4절 |
| `[M][사용자]` Nour 기기·시리아 네트워크 | **사용자 확인 대기** | 실제 키·실기기 필요. 절차는 4절 |
| `[N]` errorParser 다섯 줄 + `verifyKey` REGION | **통과** | `node --test` R1~R7(400+FAILED_PRECONDITION·403+지역 문구·400+지역 문구·대소문자·403 문구 없음→AUTH·400 INVALID_ARGUMENT→BAD_REQUEST·429), P1~P5(`CODES.REGION`, `verifyKey` 400/403 → `{ok:false, code:'REGION', canSave:true}`, `complete` → `ProviderError.code==='REGION'`, 되비친 키가 결과에 없음) |
| `[D]` 다섯 갈래가 서로 다른 문구, 지역 제한에 [키 설정] 없음 | **통과** | 브라우저: `window.fetch` 스텁 6종(valid·401·429·400 FAILED_PRECONDITION·403 지역 문구·TypeError) → `data-outcome` valid/invalid/limited/region/region/unknown, 문구 다섯 가지 모두 다름, 결과 상자 안 `[data-nav]`·링크 0개. 메타 줄 예 `2 ms · REGION · HTTP 400`. node: V1~V3(네 언어 모두 다섯 문구가 서로 다름, `ai.state.region`·`settings.ai.verify.region` 에 [키 설정] 글자 없음) |
| `[D]` 형식: `AIza…`·`AQ.…` 경고 없음, 다른 형식은 경고만 하고 저장 | **통과** | 브라우저: 구형·신형 더미 입력 시 경고 숨김, 낯선 형식은 입력 중·저장 후 경고가 보이고 `sessionStorage` 에 저장됨("Key saved."). node: F1 |
| `[D]` 설정 탭과 속도 팝오버가 한 값, 기본 표시+낭독·원문 읽기 켜짐 | **통과** | 브라우저: 기본 `speak`·원문 읽기 켜짐 확인 → 설정 탭에서 [끔] → 팝오버를 열면 [끔] 눌림·원문 읽기 비활성 → 팝오버에서 [표시+낭독]·원문 읽기 끔 → 설정 탭을 다시 열면 같은 값, IndexedDB 행도 같음. node: A1~A3(두 곳이 `renderReadalongRow` 하나를 부른다, HTML 에는 빈 그릇 2개뿐) |
| `[D]` "번역 언어: العربية", "번역문 음성: 있음/없음" | **통과** | 브라우저: `speechSynthesis.getVoices = () => []` → "not available" + [설치 방법](펼치면 `العربية` 음성 설치 경로), `ar_SA` 음성 스텁 → "available"·[설치 방법] 숨김. node: A4 |
| `[D]` 동의 전 [검증]·[시험 번역] → 동의 카드 | **통과** | 브라우저: `privacy.consentedAt=null` 에서 두 버튼 모두 fetch 호출 0회, 동의 카드가 보이고 제목에 포커스. 체크 없이 [동의] → 안내, 체크 후 [동의] → `consentedAt` 기록·카드 닫힘. node: C1 |
| `[D]` URL·콘솔·토스트·에러 문자열에 키 없음 | **통과** | 브라우저: (1) `ai.model` 에 더미 키 → [시험 번역] fetch 0회, "refused: key would travel in the URL"(7a `assertNoKeyInUrl`), (2) 서버가 키를 되비추는 스텁 + `dev.debug` 켬 → 표시 `bad request, key=[KEY]`, (3) `document.documentElement.outerHTML` 에 키 0건(모델 선택칸의 `value` 속성 포함), (4) 콘솔 로그 0건, usage 행에 키 없음, 모든 요청 URL 에 키 없음·헤더 `x-goog-api-key` 로만 감. node: T4·T5·P5·C5 |

그 밖에 브라우저에서 본 것: 입구 세 곳(서재 [설정] → `#/settings/ai`, 팝오버 [번역 설정] → `#/settings/ai`, `ai.state.noKey` 배너의 [키 설정] → `#/settings/ai`; `ai.state.region` 배너에는 [닫기]뿐), "이 기기에 기억" 켜면 경고 + 키가 `localStorage` 로 옮겨지고 끄면 `sessionStorage` 로 돌아감, [키 지우기]로 양쪽 비움, 검증 통과 후 원격 모델 목록(임베딩 모델은 걸러짐), [시험 번역] 결과 `lang="ar" dir="rtl"`, usage `byKind.translate` 증가. **콘솔 에러 0.**
**360×800**: 영어·아랍어 모두 `scrollWidth = 360`(가로 스크롤 없음), 화면 밖으로 나간 요소 0. 아랍어에서 상단바 [뒤로]가 오른쪽, 모드 버튼이 오른쪽부터, 확인란이 오른쪽으로 거울 배치. 키 입력칸 안은 `dir=ltr`. 48px 미만 조작 요소는 24px 확인란 둘뿐이고, 라벨 줄 전체를 48px 누를 곳으로 넓혔다.

## 3. 테스트 수와 변이 테스트

- `node --test "apps/medreader/tests/*.test.mjs"`: **594 → 631** (새 파일 37개), 전부 통과.
- 변이 테스트(레포 파일은 건드리지 않고 스크래치패드 사본에서):

| 변이 | 빨개진 테스트 |
|---|---|
| ① `REGION` 두 줄을 AUTH·RATE_LIMIT **뒤로**(AUTH 먼저) | 5개 — R2, R4, P3, P5, T3 |
| ② `REGION` 두 줄을 BAD_REQUEST 뒤(맨 끝)로 | 10개 — R1~R4, P2~P5, T3, V1 |
| ③ `REGION` 두 줄 삭제 | 10개 — ②와 같음 |
| ④ `provider.js` `REGION` 의 `canSave:true` → `false` | 2개 — P2, P3 |

헛도는 테스트가 아니다. (사본 전체 실행에서 `profile.test.mjs` 도 실패로 나왔는데 `dev/` 를 복사하지 않아서이고 변이와 무관하다.)

## 4. 사용자가 할 일 — 실제 키로 [검증]·[시험 번역]

**준비**: 오케스트레이터가 커밋·푸시한 뒤 배포본(https)에서 한다. 캐시 때문에 처음 한 번은 새로고침을 두세 번 한다(반쪽 캐시 교훈).

### ① 한국 PC (Chrome) — 먼저
1. 배포본 `…/apps/medreader/index.html` → (온보딩을 마쳤으면) 서재 상단바 **[설정]**. DevTools(F12) → Network 탭을 연다(`Preserve log` 켬).
2. API 키 칸에 본인 키 붙여넣기(직접 입력) → **[검증]**.
   기록: 결과 문구, 메타 줄(`… ms · OK · HTTP 200` 같은 것), Network 의 `models?pageSize=1` 요청 — `OPTIONS` preflight 상태와 응답 헤더 `access-control-allow-origin`, 본 요청 상태, **요청 URL 에 키가 없는지**, 요청 헤더 `x-goog-api-key` 가 있는지.
3. **[시험 번역]**. 기록: 아랍어 번역문이 보이는지, 걸린 시간(ms), 메타 줄, Network 의 `…:generateContent` `OPTIONS`·`POST` 상태, URL 에 키 없음.
4. 결과를 `apps/medreader/review.md` 에 적는다(지연 ms 포함).

### ② Nour 기기 (Android Chrome, 시리아 네트워크)
1. **Nour 본인 키 먼저.** 키 발급에서 막히면 운영자 키로 1회만 시험하고, 끝나면 **[키 지우기]** 를 누른 뒤 탭을 닫는다. "이 기기에 기억"은 **끈 채로** 둔다(기본값).
2. **VPN 은 끈 상태로** 하고, 켬/끔을 반드시 기록한다(VPN 이 켜져 있으면 시리아 네트워크 결과가 아니다).
3. [검증] → [시험 번역] 순서로 누르고 **두 결과를 따로** 적는다(모델 목록은 통과하고 생성만 막히는 경우를 가르기 위해). 각각 화면 문구 + 메타 줄(예 `REGION · HTTP 400`)을 스크린샷.
4. 셋 중 하나로 기록: **통과** / **지역 제한**(문구가 "이 지역에서는 … 키 문제가 아닙니다", [키 설정] 유도 없음) / **그 밖**(메타 줄의 코드·HTTP 상태).
5. (선택, 원격 디버깅이 될 때만) 콘솔에서 `__medreader.settings.set('dev.debug', true)` 후 다시 누르면 서버 메시지가 **키를 지운 채** 결과 아래에 보인다. `REGION` 판정 문구(`[가정]`)를 실물로 확정하는 데 쓴다.
6. 결과가 `REGION` 이면 8a 로 가기 전에 19절 "지역 제한 시 대안"(무료 티어만)으로 간다.

## 5. spec 과 다르게 한 것 · 발견한 것

1. **gemini `errorParser` 방법 B 와 spec 8-2 정규식의 차이 — 고치지 않았다(지침).** 16-D0 `[N]` 다섯 줄과는 **어긋나지 않는다**(전부 통과). 다만 8-2 원문 `(400||403) && /user location|not supported.*(location|region|country)/i` 와 비교하면:
   - (a) 상태 코드를 보지 않는다 — 429·500 이라도 메시지에 두 낱말이 있으면 `REGION`(RATE_LIMIT·SERVER 보다 먼저 본다).
   - (b) `location` 이 없는 지역 문구(예 "not supported in your country")는 `REGION` 이 아니다 → 403 이면 `AUTH` 로 떨어진다.
   - (c) 무관한 400 메시지에 두 낱말이 우연히 같이 있으면(예 필드 이름 `location`) `REGION` 으로 오판한다.
   Nour 기기 실물 응답을 받으면 다시 볼 자리다.
2. **`ai.state.region` 의 [다시 시도]는 붙이지 않았다.** 다시 시도할 대상(파이프라인)이 8a 몫이다. `stateNotice('REGION')` 는 `actions: []` 이고, 8a 가 [다시 시도]를 더한다. [키 설정]이 없다는 것은 테스트로 고정했다.
3. **키 없음 안내의 [키 설정]은 장치만 있다.** `main.js` 배너가 `actions` 를 `data-nav` 버튼으로 그리고 `stateNotice('NO_KEY')` 가 그 모양을 준다. 7b 에서 이 배너를 실제로 띄우는 곳은 없다. 띄우는 쪽은 8b(`effectiveMode` 의 키 없음 줄)다.
4. **캐시 줄은 "저장된 번역 N개 · 상한 200 MB"** 다(용량 MB 계산·상한 집행은 8c). [비우기]는 `aiCache` 스토어를 실제로 비운다(확인 대화상자 있음).
5. **[시험 번역]은 일일 상한(`ai.dailyCap`)에 막히지 않는다.** 상한 집행은 8c 다. usage 에는 `kind:'translate'` 로 남는다(12-7).
6. **검증이 통과하면 `listModels` 가 `GET /models` 를 한 번 더 부른다**(드롭다운용). 7a 의 `listModels` 는 usage 에 기록하지 않으므로 이 호출은 대시보드에 안 잡힌다.
7. **입력칸에 친 키는 [검증]·[시험 번역] 결과가 `AUTH` 가 아니면 저장된다**(8-4 `canSave` 를 따름). 저장 직후·화면을 떠날 때 입력칸의 원문을 지운다.
8. `verifyKey` 실패 갈래에 `message`(실제 키로 지운 서버 메시지)를 더했다 — 8-2 "판정 근거를 `dev.debug` 일 때 키를 지운 채 표시". 결과 객체 모양이 7a 보다 넓어졌을 뿐 기존 테스트는 그대로 통과한다.
9. 모델 칸에 키처럼 보이는 값이 저장돼 있으면, 선택칸에 `[KEY]` 로 보이고 `<option value>` 에도 원문을 넣지 않는다(`__redacted__`).
10. 브라우저 확인 중 고친 결함 2개: 언어를 바꿔도 캐시 줄·키 알림 줄이 옛 언어로 남던 것(값을 들고 있다가 다시 쓰게 함).
11. **`spec.md` 가 작업 중에 다른 곳에서 바뀌었다(내가 고친 것이 아니다).** `git status` 에 `spec.md` 수정과 `.claude/tasks/medreader-plan-roadmap*.md` 가 새로 보인다(2026-10-03 로드맵 Plan 으로 보임). 16-D0 에 "VPN 켬/끔 기록" 한 줄이 더해졌고 13절에 "REGION 문구는 VPN·우회를 언급하지 않는다"가 생겼다. 내 지역 제한 문구는 VPN 을 언급하지 않으므로 맞는다. 4절 절차에 VPN 기록을 넣었다.
12. **명령 차단 훅**: 변이 테스트용 스크래치 폴더를 만들기 전에 넣은 `rm -rf` 가 "rm -r (폴더 재귀 삭제)"로 막혔다. 우회하지 않았다. 삭제가 필요 없어서 새 폴더 이름(`mut1`~`mut4`)으로 진행했다. 이 사본 넷은 레포 밖 스크래치패드에 남아 있다.
13. `fr.js`·`ko.js` 의 기존 키는 여전히 영어 복사본이다(10단계 몫). 이번에 더한 63개만 실제 번역이다.

---

## Review 반영 (2026-10-03, `review.md` 7b 절 R1~R3)

Review 가 고친 `js/i18n/ar.js` 문구와 테스트 C8·V8 은 건드리지 않았다. 커밋하지 않았고 실제 키는 쓰지 않았다.
테스트: **633 → 638**(K1~K5 추가), 전부 통과.

### R1 — 무효 키(400 `INVALID_ARGUMENT` + `API_KEY_INVALID`)가 "확인 불가"로 저장되던 것 → **고침**
- `js/ai/adapters/gemini.js` `errorParser`: **사용자 REGION 두 줄 바로 아래**, 기존 판정 위에 AUTH 판정을 더했다 — `error.details` 의 어떤 항목이든 `reason === 'API_KEY_INVALID'` 이거나, 소문자 메시지에 `api key not valid` 가 있으면 `'AUTH'`. REGION 두 줄은 그대로.
- 테스트(`settings-7b.test.mjs`): K1 위 형태(어느 항목이든) → AUTH, K2 `details` 없이 메시지만(대소문자 무시) → AUTH, K3 400 `INVALID_ARGUMENT` + 다른 메시지·다른 reason → BAD_REQUEST, K4 지역 문구가 섞인 400(무효 키 표지가 함께 있어도)·`FAILED_PRECONDITION` → REGION(순서 고정), K5 `verifyKey` → `AUTH`·`canSave:false`, `runVerify`·`runTestTranslation` → "무효".
- **변이**: 새 AUTH 판정 삭제 → 빨강 4(K1·K2·K5 + 7a 되비춤 테스트). 새 판정을 REGION 앞으로 → 빨강 1(K4).
- **범위 밖 1줄 수정 — 알린다**: `tests/provider-7a.test.mjs` 의 "서버가 키를 되비춰 줘도…" 테스트는 메시지 `API key not valid: …` 에 `err.code === BAD_REQUEST` 를 단언하고 있었다. 지시된 새 규칙대로면 이 응답은 AUTH 가 맞다. 그 테스트의 요지는 키 지우기여서 기대 코드 한 줄만 `CODES.AUTH` 로 바꾸고 주석을 달았다(지우기 단언은 그대로).
- 브라우저(fetch 스텁, 위 응답 그대로): [검증] → `data-outcome="invalid"`, "The key was rejected…", 메타 `AUTH · HTTP 400`, **키 저장 안 됨**(session·local 모두 null, "No key is saved."). [시험 번역]도 "무효", `AUTH · HTTP 400`.

### R2 — 360×740 속도 팝오버가 길어져 [번역 설정]·[닫기]가 스크롤 뒤로 가던 것 → **고침(닫기는 늘 보임, 전체 무스크롤은 아님)**
- 모드 세 개를 **한 줄짜리 분절 컨트롤**로(`.readalong-modes` — `nowrap`, `flex:1 1 0`, 13px, 붙은 테두리). 공용 그리기 함수 `renderReadalongRow` 와 설정 탭 공유 계약은 그대로다(CSS 만 바뀜, 설정 탭도 같은 모양: 360 에서 세 버튼 99·98·98×51 한 줄).
- [번역 설정]·[닫기]를 한 줄(`.tts-rate-foot`)로 묶어 **팝오버 아래에 sticky** 로 붙였다(Aa 팝오버의 sticky 닫기와 같은 방식). `#ttsRateClose` id 는 그대로라 `controls.js` 결선 불변.
- 수치(360×740, 패널 73–594, 보이는 높이 519px):

| | 전 | 후 |
|---|---|---|
| 내용 높이 `scrollHeight` (영어) | 717 | **612** |
| 내용 높이 (아랍어) | 736 (Review 실측) | **632** |
| 번역 따라가기 줄 | 184 | 131 (아랍어 150 — 스위치 글이 두 줄) |
| [번역 설정]+[닫기] | 48 + 48 (두 줄) | 73 (한 줄, 버튼 48) |
| [닫기] 위치 | 727–775 — **패널 밖, 스크롤 필요** | **529–577 — 스크롤 맨 위·맨 끝 모두 보임** |
| 48px 미만 버튼 | 0 | 0 |

- 전체가 스크롤 없이 들어가지는 않는다(영어 93px·아랍어 113px 남음). 남은 높이의 대부분은 7b 이전부터 있던 속도 계단(128)·반복(128) 줄이 360px 에서 두 줄로 접히는 데서 온다. 그 두 줄(5b)은 이번 범위가 아니라 손대지 않았다. 목표 중 "[닫기]가 스크롤 없이 보일 것"은 충족.

### R3 — 배너가 있으면 팝오버가 상단바를 덮던 것(이월 결함 3) → **고침**
- `js/main.js` `watchBannerHeight()`: `#banners` 의 실제 높이를 `--banners-h` 로 내보낸다(MutationObserver + ResizeObserver). `css/reader.css` 의 Aa·속도 팝오버 `max-block-size` 가 그만큼 빼고, 하한 `var(--tap) × 3` 을 둔다.
- 실측 중 발견: ResizeObserver 하나만으로는 **그리기가 멈춘 탭**(이 미리보기 창)에서 값이 0 에 머물렀다 → 배너가 붙고·떨어지고·언어가 바뀌는 순간에 도는 MutationObserver 를 함께 건다.
- 수치(360×740, 영어 `ai.state.region` 배너 0–149):

| | 전 | 후 |
|---|---|---|
| 속도 팝오버 top / 상단바 bottom / 덮은 양 | 73 / 206 / **133** | 222 / 206 / **0** |
| Aa 팝오버 | 73 / 206 / 133 | 222 / 206 / **0** |
| 배너 2개(영어, 0–248) | 덮음 232 | 322 / 305 / **0** |
| 배너 2개(아랍어, 0–323) | 덮음 307 | 396 / 380 / **0**, 보이는 높이 196, [닫기] 보임 |
| 배너 닫은 뒤 | — | `--banners-h: 0px`, 73–594 로 복귀 |

- 콘솔 메시지 0. 가로 스크롤 없음(360).

바꾼 파일(이번 절): `js/ai/adapters/gemini.js`(지시된 한 곳), `tests/settings-7b.test.mjs`(K1~K5 추가), `tests/provider-7a.test.mjs`(기대 코드 1줄 — 위에 알림), `index.html`(팝오버 아래 줄 묶음), `css/screens.css`, `css/reader.css`(두 줄), `js/main.js`.
