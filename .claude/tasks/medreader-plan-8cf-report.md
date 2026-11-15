# 보고서 — 8c + 8f Plan (탭 번역·사용량 + 단어장)

2026-11-16 · 기준 커밋 `4c57246`(9b 다듬기 뒤) · **앱 코드·테스트·spec·review.md 무변 · 커밋하지 않았다** · 측정 실행 0(앱을 돌리지 않음 — 코드 읽기만)

산출물:
- 초안 `.claude/tasks/medreader-plan-8cf-spec-draft.md` — spec 에 그대로 붙일 꼴: (A) 새 소절 **17-7-6**(17-7-5 뒤), (B) 19-1 표 8c + 8f 행 끝 `[수정 2026-11-16 — 8cf Plan]` 한 줄.
- 이 보고서.

## 1. 핵심 사실 (파일:행)

1. **줄 탭**: 리플로우 `pointerup`(`js/ui/reader.js:587-602`, 선택 글자가 있으면 탭 아님), 원본은 캔버스 `pointerup` 좌표 역변환(`js/ui/original.js:438·461-467`) — 같은 구독자 목록. 구독자(`js/ui/controls.js:235-242`)는 **첫 줄 `cancelVoice()`(9b-2)** 뒤 `speaking`·`paused` 면 `speaker.play(lineId)`, 그 밖(`idle`·`error`·`waiting-page`)은 **아무것도 안 한다** — 탭 번역 미구현.
2. **길게 누르기·선택**: 잡는 코드 0건, `selectionchange` 구독 0건. 리플로우 글자는 선택 가능.
3. **`cards` 스토어**: 인덱스 `docId`·`dueAt`·`term`(kind 인덱스 없음), **쓰는 코드 0건**, `CASCADE_STORES` 에 들어 있어 문서 삭제 때 함께 지워진다(`js/db.js:70-75·451-454`). **DB 버전 3**(`js/db.js:24`) — 이번 설계는 **올리지 않는다**(필드 추가 + 연쇄 삭제에서 term 제외만).
4. **`ui/usage.js` 없음.** `#/usage` 라우트와 자리표시 섹션만(`js/router.js:78-79` · `index.html:758-767`), `main.js` switch 에 case 없음, 입구 없음.
5. **사용량 기록**: `provider.bumpUsage`(`js/ai/provider.js:243-283`) — 호출 **시작 때** `calls`·`byKind`·`byProvider`, `charsTranslated` 는 readalong 만, `byKind` 는 고정 6개 + `readalong`. **상한 차단(`capped`)은 있다**(`js/ai/pipeline.js:205-233`), **80% 경고(`ai.warnAt`)를 읽는 코드는 0건**. 설정 AI 탭에 상한 입력·캐시 항목 수·[비우기]는 이미 있다(`js/ui/settings.js:1515-1536·1886-1896`).
6. **띠**는 유효 모드가 `off` 면 숨기고 자리도 비우며 [×]·[문단 전체] 마크업이 없다(`js/ui/trband.js:236-256` · `index.html:468-476`) — 탭 모드를 새로 넣어야 한다. 8d 문장 아래는 `data-tr-inline` 이 띠를 감춘다(`js/ui/inlinetr.js:284`).
7. **파이프라인은 번역 전용**(`buildTranslateRequest`·`TRANSLATE_SCHEMA`·`checkTranslation` 고정, `js/ai/pipeline.js:268-387·474-551`) — 단어 요청(`kind:'term'`)은 경로가 없다.
8. **스펙 결함 하나**: 17-7-2 의 term 캐시 키 `normalize(term) + '\n' + normalize(context)` 는 `normalizeForHash` 가 `\s+` 를 공백 하나로 바꾸므로(`js/hash.js:107-113`) 낱말·문맥 경계가 사라져 "a b"+"c" 와 "a"+"b c" 가 같은 키다 → 초안 4-3 에서 `keyFor(docId, context, target, 'term', 'w=' + term)` 으로 바로잡음.
9. **줄 단위 낭독**이면 큐가 줄 단위라 문장을 바로 못 얻는다(readalong 도 `line-mode` 로 꺼짐) → `speaker.sentenceUnits()`(같은 `buildUnits`·같은 opts) 8줄로 해결.
10. **잘못 누름 위험**: 지금 탭 판정은 "pointerup 때 선택이 있나" 하나뿐이다. 탭 번역이 호출을 부르게 되면 (a) 선택을 풀려고 누른 탭, (b) 길게 눌러 선택하는 도중의 늦은 `pointerup` 이 번역 요청이 될 수 있다 → 순수 `isTap`(누름 < 450ms · 이동 ≤ 10px · 누를 때 선택 없음) 문턱. 타이머가 아니라 브라우저 선택과 다투지 않는다.
11. 그 밖: `vocab.lastExportAt` 이 9-3 에만 있고 `settings.js` `DEFAULTS` 에 없다. 리더 상단바에 [⋮] 없음(12-8-1). 새 `js/*.js` 는 `dev/stamp-importmap.mjs` 로 import map 에 넣어야 한다.

## 2. 나누기와 순서 (권장 — 8cf-D1·D2)

**8e 배포 뒤** 시작(같은 `index.html`·`reader.css`·`controls.js`·i18n). 각 Build 1.5–3시간.

1. **8c-1 탭 번역·선택 동작 줄** — `readalong.tapGate`·`requestTap`(서비스 한 곳 — 결과를 readalong 메모리에 넣어 띠·문장 아래·이후 낭독이 같은 결과를 봄), 띠 탭 모드([×]·[문단 전체], 유효 모드 off 여도 열림, inline 이면 열린 동안 `data-tr-inline` 뗌), `speaker.sentenceUnits`, `ui/selbar.js` + 순수 `text/select.js`([문장 번역]·[여기서부터 읽기], [단어 번역]은 숨김), `isTap` 문턱.
2. **8f-1 단어장 데이터·단어 요청(화면 없음)** — 순수 `text/vocab.js`(`findInSentenceTr`·CSV/Anki·가져오기 계획), 서비스 `vocab/store.js`, `prompts` term 요청·검증, `pipeline` 의 `sendChunk` 를 `job` 주입으로 일반화 + `translateTerms`(상태 기계 한 벌), `db.deleteDocument` 에서 term 제외.
3. **8f-2 단어 시트** — [단어 번역] → 단어장 → 문장 번역에서 찾기(호출 0) → [AI 로 번역](1회)/[번역 없이 저장], 서재 삭제 확인 "단어장 n개는 남습니다".
4. **8f-3 단어장 화면·CSV** — `#/vocab`·`#/vocab/:docId`, 편집 시트, [번역 안 된 것 모두 번역 (n)](누를 때 1호출 ≤ 20개), CSV/Anki 내보내기, CSV 가져오기(미리보기).
5. **8c-2 사용량 화면·80% 경고** — `ui/usage.js`(순수 `usageView`), 80% 경고는 그날 `usage` 행 `capWarned` 로 하루 한 번, 캐시 MB 표시.
6. (선택) **8f-4** 아랍어 검색어 → 단어장 번역 일치 → 영어 term 으로 찾기(17-8-9 (나), 호출 0).

## 3. 결정 표

**권장(운영자 위임에 따라 이대로 진행)**

| # | 쟁점 | 권장 |
|---|---|---|
| 8cf-D1 | 나누기 | 다섯 Build(8c-1·8f-1·8f-2·8f-3·8c-2) |
| 8cf-D2 | 순서 | 8c-1 → 8f-1 → 8f-2 → 8f-3 → 8c-2 (단어장이 먼저 Nour 에게, 사용량은 `term` 종류가 생긴 뒤) |
| 8cf-D3 | 멈춤(`paused`) 중 줄 탭 | 지금 그대로 이동·재생. 번역은 탭이 `idle`·`error` 일 때와 선택 줄 [문장 번역] |
| 8cf-D4 | 캐시 없는 줄 탭 | 바로 요청 — 문단 1회(7-2·16-D4 승인 설계 그대로) |
| 8cf-D5 | 문장 아래 표시에서 탭 번역 자리 | 띠(열린 동안 `data-tr-inline` 떼기) |
| 8cf-D6 | 줄 단위 낭독일 때 | `speaker.sentenceUnits()` 로 문장 단위를 따로 |
| 8cf-D7 | 단어 요청 경로 | `sendChunk` 에 `job` 주입 — 상태 기계 한 벌, 번역 요청 바이트 불변 |
| 8cf-D8 | 단어장 입구 | 서재 상단 [단어장] + 단어 시트 링크 + 서재 카드 [⋯] (리더 상단바 무변) |
| 8cf-D9 | 80% 경고 1회 | 그날 `usage` 행에 `capWarned` — 하루 한 번 |
| 8cf-D10 | 남은 쪽의 책 | 마지막으로 연 책 |
| 8cf-D11 | 캐시 [비우기] | 설정 한 곳 — 사용량 화면은 수·MB + 이동 단추 |
| 8cf-D12 | 90일 사용량 행 정리 | 사용량 화면을 열 때(`main.js` 부팅 무변) |
| 8cf-D13 | 아랍어 검색어 → 단어장(17-8-9 나) | 8f-3 뒤 작은 8f-4 |
| 8cf-D14 | `cards` `kind` 인덱스 | 만들지 않음 — DB 3 그대로 |

**운영자에게 물을 것(권장하지 않음 — 비용·외부 전송)**

| # | 쟁점 | 지금(승인 범위) | 바꾸면 |
|---|---|---|---|
| Q1 | 캐시 없는 줄 탭 | 바로 요청(문단 1회) | 띠에 [번역] 단추 한 번 더 — 잘못 누름 비용 0, 매번 두 번 누름. Nour 사용량 보고 판단 |
| Q2 | 내보낸 CSV·Anki 의 교과서 문맥 문장 | 포함(17-7-4) | 빼는 선택지 또는 "공유하지 마세요" 한 줄 |
| Q3 | 17-8-9 (라) AI 검색어 번역 | 끔 그대로 | 켜면 검색 1회 ≈ 낭독 번역 5,900자분 |

## 4. 예상 시간 `[추정]`

| Build | Build | Review |
|---|---|---|
| 8c-1 | 2.5h | 1.5h |
| 8f-1 | 2h | 1h |
| 8f-2 | 2–2.5h | 1–1.5h |
| 8f-3 | 2.5–3h | 1.5h |
| 8c-2 | 1.5h | 1h |
| (8f-4 선택) | 1h | 0.5h |
| **합(8f-4 제외)** | **10.5–11.5h** | **6–6.5h** |

**약 16.5–18시간**(Review 수정 시 단계당 +30분~1시간). 인계 문서 10-21 표의 "8c+8f 4~5시간"은 화면 셋(단어 시트·단어장·사용량)과 CSV 왕복을 작게 셌다.

## 5. 실기기 점검 묶음 (초안 12절 — 요약)

길게 누르기 → 선택 동작 줄과 시스템 메뉴 겹침·그 순간 탭/이동 없음 · 단추 누를 때 선택이 풀려도 동작(스냅숏) · 선택 풀기 탭이 요청을 안 부름 · 스크롤 끝 가벼운 탭의 오발(사용량 "번역" 수로 Q1 판단) · 아랍어 키보드와 시트 · CSV 다운로드/엑셀/AnkiDroid · CSV 가져오기 파일 고르기 · 실제 Gemini 단어 응답과 "문장 번역에서 찾음" 적중 · 가로(8e) 화면 안 · 9b 듣는 중 선택 → 듣기 취소.

## 6. 남은 위험 · 확인 필요

- Android Chrome 의 길게 누르기 때 `pointerup`/`pointercancel` 순서, 선택 중 단추 탭 시 선택 해제 시점 — `[가정]`, 450ms 문턱·300ms 늦춤·스냅숏으로 대비했고 실기기 묶음에 넣음.
- 모델이 문장 번역에서 의학 용어마다 괄호 원어를 다는 습관(호출 0 경로의 적중률) — 운영자 캡처 10-08 근거의 `[가정]`. 적중이 낮으면 단어 시트가 [AI 로 번역] 쪽으로 기울 뿐 기능은 그대로.
- `job` 일반화는 낭독 동반 번역의 핵심 경로를 건드린다 — "번역 요청 본문 바이트 불변 + 기존 pipeline 테스트 무변 통과 + 변이"로 지키게 했다.
- 8e Build 가 같은 작업 트리에서 진행 중일 수 있다(`.claude/tasks/medreader-build-8e-landscape.md` 미추적) — 8c-1 은 8e 배포 뒤.

## 7. 막힌 것

없음. 명령이 훅·권한에 막힌 일 없음. 프로세스 조회·포트 접근·headless 실행은 하지 않았다.
