# Build 보고서 — 8b-1: 낭독 동반 번역 (서비스·발화 순서)

> Build 서브에이전트. 커밋하지 않았다. 실제 키를 넣지 않았다. 화면(자막 띠·토큰·CSS·index.html)은 만들지 않았다 — 8b-2 몫.
> 작업 중 오케스트레이터 지시(운영자 폰 음성 진단 결과)를 받아 **음성 판정 규칙을 바꿨다**(4절).

## 1. 테스트 수

| | 수 |
|---|---|
| 시작 | **808** (전부 통과) |
| 끝 | **866** (전부 통과) — 새 58개: `tests/readalong.test.mjs` 28 · `tests/speaker-tr.test.mjs` 30 |

`node --test "apps/medreader/tests/*.test.mjs"` → `tests 866 · pass 866 · fail 0`. 기존 테스트는 하나도 고치지 않았다(기존 grep 테스트 A3·S13·W2·W3·G2 가 요구하는 모양을 지키도록 코드를 맞췄다).

## 2. 만든 것·고친 것

| 파일 | 내용 |
|---|---|
| **새 `js/ai/readalong.js`** | 문서당 서비스. 7-8-3 refill 그대로 — 글자 수 창(`maxReqChars × 1.5` = 9,000), 청크(6,000자, 쪽 경계를 넘어 묶음, 캐시 적중·`pending`·`failed` 건너뜀), 선행 요청(덮인 거리 ≤ 3,000), 떠 있는 요청 정규 1 + 냉시작 head 1, 여러 쪽 `loadParas`(주입), 미추출 쪽에서 끊기(기다리지 않음, 다음 refill 에 다시 물음), **문장 원문 키 조회**(`normalizeForHash(src)`), `effectiveMode`(순수·export), `readStats` 누적(쪽마다 한 번, 문서 레코드에 **한 트랜잭션 안에서** get+put — 다른 필드를 옛 값으로 덮지 않음). 원격 상태 이벤트는 **`prev` 가 막힌 상태일 때만** 회복으로 본다. 막힌 상태면 요청 0·알림은 전이 때 1번. `retry()`(사용자 [다시 시도]) — 파이프라인 `retry()` 로 즉시 ready + 창 안 `failed` 를 `retry:true` 로 한 청크씩 |
| `js/tts/speaker.js` | 기존 상태 기계·onend 사슬·워치독·세대 **위에** 발화 단계 `src → tr-wait → tr` 를 더함(재작성 없음). `tr-wait` 은 세대 달린 `TR_WAIT_MS` 타이머 + 도착 구독. 반복·`markDone` 은 번역문까지 끝난 뒤(300자 분할 원문은 조각을 다 읽고 tr). `speakSource=false` 면 원문은 소리 없이 하이라이트만, 번역 없는 문장(실패·대기 초과)은 원문으로. `pause/resume`·`setRate`·뷰 전환(`reload`)이 단계를 지킴. 표 안내는 UI 언어 음성(`setNoticeVoice`). 새 이벤트 `queue`·`phasechange`, `linechange` 에 `page·seg·src`. 새 코드 `TR_SKIPPED`·`TR_VOICE_FAILED`·`TR_LAGGING`. **원문 `NO_VOICE` 를 실제 발화 오류로 처음 냄**(전에는 정의만 있고 아무도 안 냈다) |
| `js/tts/text.js` | `splitLong(text, max, breaks)`(경계 주입 — 기본은 그대로), `trSpeechText`(번역문 **발화** 텍스트에서 괄호 속 라틴 묶음 제거 — 판정은 `text/bidi.js` 의 `ltrRuns` 를 import 해 그대로 씀, 묶음 글자가 전부 라틴일 때만, 이중 공백·구두점 앞 공백 정리), `trSpeechParts`(`،`·`؛` 경계), `trWatchdogMs` |
| `js/tts/voices.js` | `createVoiceWatch`/`sharedVoiceWatch` — `voiceschanged` 를 **계속** 구독, 첫 응답 뒤 `VOICES_SETTLE_MS`(3초) 동안 안 바뀌면 "안정". `voiceVerdict`(세 갈래), `speechLang`, `VOICE_ERRORS`. `loadVoices` 는 남김(퀴즈 화면이 씀 — 범위 밖) |
| `js/ui/controls.js` | 배선: 파이프라인·readalong 생성, `loadParas` 주입, speaker `queue`/`linechange`/`statechange` → readalong, 재생 탭에서 유효 모드를 **동기로** 다시 계산(await 없음), 키·모델·프로바이더 지문이 바뀌면 `configChanged`. 음성 목록 감시 구독(원문·번역문·표 안내 음성 재선택). **목록만으로 "음성 없음" 배너를 내지 않음**, 음성이 나중에 생기면 배너를 거둠(배너 자신의 닫기 단추를 누름 — `main.js` 안 건드림). 미지원 언어 문서는 `reader.tts.unsupportedLang`. 화면 요소 추가 0 |
| `js/ui/reader.js` | `loadFlowParas(n)` = `flowParasOf(describePage(fromStored(rec)))`, 미추출·깨짐·범위 밖이면 null. 추출 우선순위 안 건드림 |
| `js/ui/settings.js` | "번역문 음성" **세 갈래**(있음 / 목록에 없음 — [들어 보기] / 안 됨) + [들어 보기] 시험 발화(지어낸 짧은 문장, 탭 핸들러 안에서 동기 `speak`, 결과 `localStorage` `medreader.voiceTest.<lang>` 에 기억). 버튼은 JS 가 한 번 만들고 기존 `data-action` 위임(`voice-test`)이 받음. 기본 button 48px |
| `js/config.js` | `READALONG` 블록(7-8-6 + `CHARS_PER_SEC_TR`·`MAX_EMPTY_PAGES`·`VOICES_SETTLE_MS`·`TR_LANG_REGION {ar:'ar-SA'}`). 한도 숫자 0 |
| `js/i18n/*.js` | 네 언어 같은 키 3개: `reader.tts.unsupportedLang`, `settings.readalong.voice.unlisted`, `settings.readalong.voice.test` |
| `js/ai/pipeline.js` | **고치지 않았다** — `retry()` 가 이미 `exhausted·cooldown·region·model` 을 즉시 ready 로 돌린다. 실제 파이프라인으로 세 경우를 테스트(RT)로 고정했다 |

범위 메모: 지침 4(음성 목록)·5(und 문구)는 `controls.js` 의 원문 음성 경로를 고쳐야 해서 "readalong 배선" 밖의 몇 줄을 고쳤다(화면 요소는 없음). `spec.md`·`.claude/tasks/medreader-handoff.md` 의 작업 트리 변경은 내가 한 것이 아니다.

## 3. RA 항목별 — 무엇이 고정하나

| RA | 테스트 | 비고 |
|---|---|---|
| RA1 | `readalong` RA1(표 각 줄 + 조건을 겹쳐 놓고 하나씩 푸는 순서 검사), RA1b(창·문턱) | `trVoice:null`(목록에 없음)은 speak 유지 |
| RA2 | RA2 — 테스트가 진행 **직전** 덮인 거리를 따로 셈: >3,000 동안 0건(문턱 위 확인 ≥10회), 이하 첫 진행에서 정확히 1건, 응답 전 진행 5번 더 → 1건 | |
| RA3 | RA3 — 14쪽 > 20,000자 연속 낭독, 응답 지연: 모든 요청 문장 `dist < 9,000`, `loadParas` 스파이(테스트가 따로 센 그 쪽 첫 문장 거리) < 9,000, 떠 있는 요청 ≤ 2·2는 head 직후뿐. RA3b — 떠 있는 정규 요청 너머로 건너뛰어도 정규 1 + head 1 | |
| RA4 | RA4 × 6(exhausted·capped·offline·region·model·no-key): 10쪽 지나 translate 0건·알림 1건·창 끝 문장 `blocked`. RA4b — 성공 호출마다 오는 inflight→ready 로 알림 0건(prev 거르기) | |
| RA5 | RA5 — offline 동안 0건 → online(prev offline) 에 보내지 않은 것만 한 번씩, 실패 2문장은 안 보냄, 알림 `offline,ready` → `retry()` 로 실패 2문장만 `retry:true` | |
| RA6 | RA6 — 쪽 중간 냉시작: head 는 커서 문장부터·합 ≤ 600, 둘째 호출은 head 바로 다음, 겹침 0, 이때 떠 있음 2 | |
| RA7 | `speaker-tr` RA7a(src,tr 교대·lang)·b(1초 뒤 도착 → tr)·c(4초 → 다음 src, 늦게 와도 안 읽음, 구독 해제)·d(failed·blocked·none 대기 0)·e(tr 중 pause→resume 같은 tr)·f(stop/pause 뒤 도착 무시)·f2(pause→resume 뒤 옛 타이머·알림 겹침 0)·g(show·off 면 단계 0)·h(lagging 1회) | |
| RA8 | RA8([src,tr,src,tr] 뒤 다음, markDone 두 번째 tr 뒤 1회), RA8b(300자 분할 원문) | |
| RA9 | **결정 반영**: RA9a 목록에 ar 없음 + 번역문 발화 성공 → speak 유지·알림 0, `lang='ar-SA'`·voice 없음. RA9b 목록에 ar 없음 + 첫 tr 오류 → show + 알림 1, 이후 tr 0건. RA9c 첫 성공 뒤 오류는 그 발화만 건너뜀, 목록에 음성 생기면 다시 허락 | 실제 readalong + speaker 를 controls 와 같은 이벤트로 이어 시험 |
| RA10 | RA10(원문 발화 0·하이라이트 문장마다 1·번역 없는 문장 원문), RA10b(대기 초과도 원문, 다시 칠하지 않음) | |
| RA11 | RA11(`،`·`؛` 에서 분할, 원문 분할 규칙은 불변) | |
| RA12 | RA12a(1,900×3쪽 → 1회, 세 쪽에 걸침)·b(6,800 → 2회)·c(8,000 중 3,000 캐시 → 1회, 캐시 문장 요청에 없음, 도착 때 ready)·d(미추출에서 끊고 기다리지 않음, 데이터가 오면 다음 진행에서 p+1) | head 0 |
| RA13 | RA13 — 실제 파이프라인 + 메모리 캐시: 6,000 → 2,000 으로 다시 낭독 시 네트워크 0·translate 0·캐시 키 목록 동일(66개) | |
| RA14 | RA14 — 쪽 경계 head·tail 이 이웃 segment 로, 합쳐지지 않음 | |
| 그 밖 | RT×3([다시 시도]: 429·5xx·404 를 즉시 ready + 재전송), RS(readStats), RK(원문 키), RM(사유 안내 1회·거두기), RE(빈 쪽 냉시작 회귀), RL(위생 grep — 주석 포함 `Arabic`·`'ar'` 0, ui·i18n import 0, console 0, setInterval 0), TX·TX2(괄호 제거·같은 판정·화면 텍스트 불변), TN(표 안내 UI 언어), NV(원문 음성 없음은 발화 오류로만), VW1~VW5(음성 목록), WR1~WR4(배선 grep) | |

## 4. 오케스트레이터 결정 반영 — 음성 판정 (2026-10-10 진단)

**진단 수치**(운영자 폰 Galaxy · Chrome 154): 첫 `getVoices()` 0개 → **9ms 뒤 `voiceschanged` 로 92개**(전부 기기 엔진). 영어 5(en_AU·GB·IN·NG·US)·ko_KR·fr_FR·fr_CA, **아랍어 0개**. 그런데 voice 없이 `utterance.lang='ar-SA'` 로 아랍어가 실제로 소리 남.

**결정**: 목록에 없음 ≠ 말할 수 없음.
- 번역문: 목록에 없으면 voice 없이 `speechLang(target)`(ar → `ar-SA`)로 시도. **첫 tr 발화 오류**(`interrupted`·`canceled` 외)만 `TR_VOICE_FAILED` → 유효 모드 show + 알림 1회. 첫 tr 이 성공한 뒤의 오류는 그 발화만 건너뜀.
- 원문: 목록 판정 배너를 없앰. 원문 발화가 재시도 뒤에도 실패하고 (오류가 `language-unavailable`·`voice-unavailable`·`synthesis-unavailable` 이거나 이 세션에 원문 발화가 한 번도 끝까지 간 적이 없으면) `NO_VOICE` → 기존 배너.
- 설정: 있음(목록에 있음 또는 시험 성공) / 목록에 없음 — [들어 보기] / 안 됨(시험 오류). 결과는 기기별 `localStorage` 에 언어 코드와 ok·fail 만.

**영어 "음성 없음" 오경고의 경로**: 그 배너를 내는 곳은 `controls.js` `syncSourceVoice` 의 `voicesLoaded && !availability(voices, lang)[lang]` **한 곳**이었다(`CODES.NO_VOICE` 는 정의·매핑만 있고 speaker 가 한 번도 내지 않았다). `voices` 는 `loadVoices` 한 번의 결과다. `loadVoices` 는 첫 목록이 비면 `voiceschanged` 를 기다리되 **1.5초에 포기하고 빈 목록을 최종으로** 돌려주고, 그 뒤 목록이 와도 다시 읽지 않는다. → 엔진이 1.5초 안에 목록을 못 주면(부팅 직후 엔진 바인딩 등) 빈 목록으로 "영어 없음"이 굳는다. 진단에서는 9ms 였으나(그때는 엔진이 이미 깨어 있었을 수 있다) 앱 부팅 직후 첫 호출의 지연은 재지 못했다 — **원인 경로는 코드로 확정, 실기기의 지연 시간은 미확인**(`dev/voices.html` 에 "페이지 로드 직후 첫 응답까지 ms" 를 재면 확정된다). 재현 테스트: VW2(옛 `loadVoices` 는 1.5초 넘게 늦은 목록에 `[]` 를 최종으로 줌 · 감시자는 늦은 목록을 받아 en "있음"), VW1(0개 → 9ms 뒤 92개: 그 사이 판정은 "확인 중", 뒤에 en 있음·ar "목록에 없음"으로 "없음"이 아님). 이제 그 경로 자체가 없다(WR1: controls 에 `availability(`·`loadVoices(` 0, `syncSourceVoice` 에서 `noVoiceNotice` 호출 0). 같은 구조의 설정 화면 판정도 감시자로 바꿨다.

## 5. 실제 책 측정 (번역 스텁·즉시 응답, `dev/measure-lib.mjs` + 스크래치패드 `b81/measure-ra.mjs`)

실제 문장 흐름 = `flowParasOf(describePage(fromStored(toStored(L))))` → `buildUnits`·`sentencesOf` → readalong(`onQueue`/`onProgress`). 원서 문장은 출력하지 않았다.

| 구간 | 문장 | 글자 | 호출(head) | 1만 자당 | 청크 중앙값/최대 | 도착 시 번역 없음 | 최대 떠 있음 | 최대 dist |
|---|---:|---:|---:|---:|---|---:|---:|---:|
| CMDT 2021 1000–1049 (50쪽) | 846 | 107,675 | 20 (1) | 1.86 | 5,896 / 5,981 | **0** | 2 | 8,898 |
| CMDT 2026 500–529 (30쪽) | 1,613 | 151,376 | 27 (1) | **1.78** | 5,928 / 5,992 | **0** | 2 | 8,998 |
| (추가) CMDT 2021 1000–1499 (500쪽) | 9,061 | 957,539 | 163 (1) | **1.70** | 5,931 / 6,000 | **0** | 2 | 8,994 |

- **대조**: 같은 구간을 레포의 `dev/sim-readahead.mjs`(독립 구현)로 돌리면 20회·1.85 / 27회·1.78, 늦음 0 — 호출 수가 **일치**. 50쪽 구간의 1.86 은 처음 head·끝 경계 몫이고, 500쪽에서 9-28 기대값 1.7 과 같다.
- **측정이 찾은 결함(고침)**: 첫 측정에서 CMDT 2021 의 head 가 **3번** 나갔다 — 문장 없는 쪽(표·그림뿐)에 커서가 서면 "커서 문장 없음 = 냉시작"으로 봤다. 커서 쪽이 비면 흐름의 다음 문장으로 판정하게 고쳤고(→ head 1, 22→20회) 회귀 테스트 RE 를 넣었다.

## 6. 변이 (적용 grep 확인 → 전체 테스트 → 스크래치패드 복사본으로 되돌림 → cmp)

| 변이 | 적용 확인 | 빨강 | 빨개진 테스트 | 복원 cmp |
|---|---|---:|---|---|
| M1 창 경계 빼기(`dist >= readAhead` 두 곳) | ○ | 1 | RA3 | 같음 |
| M2 떠 있는 요청 상한 빼기 | ○ | 1 | RA3b | 같음 |
| M3 `prev` 거르기 빼기 | ○ | 2 | RA4b·RA5 | 같음 |
| M4 괄호 영어 제거 빼기 | ○ | 2 | TX·TX2 | 같음 |
| M5 tr-wait 세대 검사만 빼기 | ○ | **0** | — | 같음 |
| M5c 세대 검사 + cancel 의 대기 해제 둘 다 빼기 | ○ | 1 | RA7f2 | 같음 |
| M6 빈 쪽 냉시작(옛 판정) | ○ | 1 | RE | 같음 |
| M7 첫 tr 실패 → 음성 불가 빼기 | ○ | 2 | RA9b·RA9c | 같음 |
| M8 덮인 거리 문턱 빼기 | ○ | 2 | RA2·RA5 | 같음 |
| M9 음성 목록 안정 시계 재설정 빼기 | ○ | 1 | VW5 | 같음 |

M5 가 살아남는 이유: `cancelSynth()` 가 tr-wait 의 타이머·구독을 먼저 풀어(두 겹 방어) 세대 검사 한 겹만 빼면 도달 경로가 없다. 두 겹을 함께 빼면 RA7f2 가 빨개진다. 처음엔 M2·M5c·M6·M9 가 살아남아 RA3b·RA7f2·RE(쪽 크기 키움)·VW5 를 보강했다.

## 7. 브라우저 회귀 (`preview_start blog`, 새 쿼리 + 바뀐 파일 `cache:'reload'`)

- 새 프로필이라 온보딩을 거친 뒤 **지어낸 2쪽 문서**를 앱 모듈(`buildPageLayout`·`toStored`)로 DB 에 넣어 리더를 열었다.
- 리더 낭독(영어): 재생 → `speaking`, 1쪽 문장 진행, **2쪽으로 자동 넘김**, 일시정지 정상, 단계 `src`. 키 없음 → 유효 모드 `off`(no-key)·translate 0·원격 ready. 음성 목록 7개(영어 3) — "영어 음성 없음" 배너 **없음**(배너는 이 환경의 기존 `reader.tts.wakeLock` 하나).
- 설정 AI 탭: 아랍어 "목록에 없음 — 들어 보기"(버튼 48px), 한국어로 바꾸면 "있음"·버튼 숨김, 되돌리면 다시 목록에 없음. [들어 보기] → "확인 중…" → **이 데스크톱 Chrome 에서도 voice 없이 아랍어 발화가 끝까지 가서 "있음"**. 375px 에서 가로 스크롤 0(scrollWidth 375).
- 콘솔 오류 **0**. 끝난 뒤: 가짜 문서·쪽 삭제(`db.deleteDocument` 후 조회 null), `medreader.voiceTest.*` 지움, 뷰포트 desktop. (온보딩 완료·UI 언어 English·번역 언어 `ar` 저장값은 미리보기 프로필에 남음.)

## 8. 8b-2 에 넘기는 계약

**만드는 곳**: `ui/controls.js` 가 `pipeline`·`readalong`·`speaker` 를 하나씩 만든다(모듈 변수). 띠(`ui/trband.js`)가 붙으려면 controls 가 그것을 넘기는 한 줄(예: `initTrBand({readalong, speaker})`)이 필요하다.

### 띠가 구독할 이벤트

| 출처 · 이벤트 | `detail` | 뜻 |
|---|---|---|
| `speaker` `linechange` | `{lineId, lineIds, paraId, index, total, onPage, page, seg, src}` | 지금 문장. 띠는 `readalong.get(src)` 로 그 문장의 번역을 읽는다(동기). `seg:null` = 표 안내(번역 없음) |
| `speaker` `phasechange` | `{phase:'src'|'tr-wait'|'tr', index, seg, part}` | `data-speaking` 전환·경과 비율 스크롤(`tr` 이면 번역문 발화 시간). 하이라이트는 원문 문장에 머문다(6-5 — `show` 를 다시 부르지 않음) |
| `readalong` `change` | `{key, src, page, seg, state, text, code}` | 한 문장의 상태가 바뀜 — 지금 문장이면 띠를 다시 그린다. `state`: `pending`(번역 중) · `ready`(text) · `failed`(+code: PARSE·RATIO·DIGITS·MISSING·SERVER·TIMEOUT·NETWORK·SAFETY…) · `blocked`(+code = 원격 상태 이름) |
| `readalong` `mode` | `{mode:'off'|'show'|'speak', prev, reason}` | 유효 모드 변화 — `off` 면 띠가 자리를 잡지 않는다 |
| `readalong` `notice` | `{code, lang}` code ∈ `consent·unsupported-lang·same-lang·line-mode·no-key·no-voice` | 사유당 한 번 — 상태 바 문구(`readalong.*`·`ai.state.noKey`) 키는 8b-2 가 만든다(이번엔 i18n 에 넣지 않음) |
| `readalong` `notice-clear` | `{code}` | 그 사유에서 벗어남(예: 번역문 음성 생김) — 알림을 거둔다 |
| `readalong` `remote` | `{state, prev, code, until}` | 원격 상태 전이 — 막힌 상태 진입 때 1번(`exhausted·capped·offline·region·model·no-key·cooldown`), 회복 때 `state:'ready'`. 문구는 `ai.state.*` |
| `speaker` `error` | `code ∈ TTS_TR_SKIPPED · TTS_TR_VOICE_FAILED · TTS_TR_LAGGING` | LAGGING → `readalong.lagging` 한 번. VOICE_FAILED 는 controls 가 이미 유효 모드를 내린다 |

### 띠가 부를 함수

| 함수 | 반환 | 용도 |
|---|---|---|
| `readalong.get(unitOrSrc)` | `{state:'ready'|'pending'|'failed'|'blocked'|'none', text?, code?}` | 동기 조회(문장 원문 키) |
| `readalong.onChange(unitOrSrc, fn)` | 되돌림 함수 | 한 문장만 구독 |
| `readalong.retry()` | `Promise<{state, resent}>` | **[다시 시도]** — 원격 막힘(exhausted·cooldown·region·model)을 즉시 ready 로, 창 안 failed 를 재전송. 자동으로는 아무도 부르지 않는다 |
| `readalong.mode()` · `remoteState()` · `readStats()` · `stats()` | | 그리기·사용량 |
| 모드 변경 | — | 설정값(`readalong.mode`·`readalong.speakSource`)을 저장한 뒤 controls 의 `syncReadalong()` 을 부르게 한다(지금은 속도 팝오버 줄 클릭 후 한 박자 뒤 자동). 띠가 직접 speaker 를 건드리지 않는다 |

### 데이터 모양

- 문장(서비스 안): `{page, seg, src, frag:'head'|'tail'|null, key, chars, dist}` — 키는 `normalizeForHash(src)`.
- 번역문 화면 텍스트는 `text` 그대로(괄호 포함). **발화에서만** `trSpeechText` 가 괄호 속 라틴 묶음을 뺀다. 띠는 `ltrRuns(text)` 로 `<bdi dir="ltr">` 격리(10-08 결정).

## 9. 남은 것·주의

1. **실기기 미확인**: 번역문 발화 순서·`TR_WAIT_MS`(4초)·`CHARS_PER_SEC_TR`(10, 가정)·[들어 보기] — 8b-2 와 함께 실기기에서.
2. 오경고 원인 경로는 코드로 확정했으나 **부팅 직후 첫 목록 지연(ms)은 미측정** — `dev/voices.html` 에 "로드 직후 첫 응답까지" 항목을 더하면 확정된다(이번 범위 밖 파일).
3. `ui/quiz.js` 의 해설 낭독은 아직 `loadVoices`(첫 응답 최종)를 쓴다 — 범위 밖. 같은 오판 가능성.
4. 설정의 [들어 보기] 결과는 설정 화면 표시에만 쓴다. 리더의 유효 모드는 **그 세션의 실제 발화 오류**로만 내린다(기억된 'fail' 이 낡을 수 있어서).
5. readalong 의 캐시 선조회(적중은 요청에 넣지 않음)는 `usage.cacheHits` 를 올리지 않는다 — 15절 "절약된 호출" 표시는 8c 에서 정할 것.
6. `readStats` 쓰기는 한 트랜잭션 get+put(자기 필드만)이라 10-10 운영자 결정(documents 부분 갱신)의 방향과 같다. 다만 다른 다섯 곳이 통째로 쓰면 증분이 덮일 수 있다 — 그 도우미가 생기면 그것으로 옮길 것.
7. 음성이 나중에 생겼을 때 원문 "음성 없음" 배너를 거두는 방법은 배너의 닫기 단추를 누르는 것이다(`main.js` 범위 밖). 8b-2 에서 배너 거두기 이벤트를 정식으로 둘지 정할 것.
8. Bash 차단 훅에 막힌 명령 없음. npm 설치 없음(스크래치패드의 기존 `pdfjs/` 사용).
