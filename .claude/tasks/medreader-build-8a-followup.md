# Build 지침 — 8a 후속: 운영자 결정 3건 (2026-10-10)

> 너는 **Build 서브에이전트(A)**다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.
> 동시에 다른 Build(B)가 7c(원문 언어)를 한다 — B 는 `js/text/*`·`js/tts/*`·`js/ui/library.js`·`js/ui/reader.js`·`config.js` 의 TTS 부분을 고친다. **너는 그 파일들을 건드리지 마라.**
> 끝나면 `.claude/tasks/medreader-build-8a-report.md` 끝에 "후속(2026-10-10)" 절을 덧붙인다.

## 읽을 것
- `apps/medreader/review.md` 의 "8a" 절(범위 밖 결함 1·2·4 — 이번에 고칠 것)
- spec 10-2 의 `[수정 2026-10-10]` 문단, 7-6 상태 기계의 `[수정 2026-10-10]` 네 줄, 16-D2 의 10-2 항목

## 고칠 것
1. **짧은 문장은 길이 비율을 보지 않는다** — 원문(`Unit.src`) 20자 미만이면 `[0.2, 5]` 검사 생략, 숫자 보존 검사는 그대로. 상수는 `config.js` 의 **`PIPELINE` 블록 안에만** 더한다(`SHORT_SRC_CHARS: 20`). 테스트: `ECG.` → 아랍어 풀어쓰기(5배 초과) = ok, 20자 이상의 정상 문장 비율 검사 그대로, 짧아도 숫자를 빼면 `failed digits`.
2. **네트워크 오류는 `blocked`** — 응답 없이 실패한(fetch 예외·CORS 구별 불가) 문장은 `failed` 가 아니라 `blocked`. `cooldown` 의 `until` 이 지난 뒤 다음 refill 때 다시 보낸다. **3단계(30→60→120초)를 다 쓰면 그 뒤는 사용자 [다시 시도]로만** — 무한 반복이 없음을 테스트로 고정(가짜 시계로 몇 시간을 돌려도 요청 수가 상한을 넘지 않는다). 응답을 받고 실패한 것(파싱·검증·4xx)은 계속 `failed`.
3. **`assertNoKeyInUrl` 거절은 네트워크 오류가 아니다** — 지금은 모델 칸에 키를 넣으면 `cooldown`·`failed/NETWORK` 로 기억되고 usage 호출 수가 1 오른다. 별도 코드(예: `KEY_IN_URL`)로 구별하고, **요청이 나가지 않았으므로 usage `calls` 에 넣지 않는다.** 상태는 사용자가 설정을 고쳐야 풀리는 쪽으로(키·모델 문제). 설정 화면 문구가 필요하면 네 언어에 더한다(키 집합 동일).

## 고쳐도 되는 파일
`js/ai/prompts.js`, `js/ai/pipeline.js`, `js/ai/provider.js`, `js/config.js` 의 **`PIPELINE` 블록만**, `js/ui/settings.js`(3 의 문구 연결만), `js/i18n/*.js`(3 의 문구만), `tests/` 의 8a 테스트·새 테스트.
**건드리지 않는 것:** 위에 적은 B 의 파일들, `gemini.js` 판정 순서, `spec.md`.

## 검증
- `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 749 — B 가 동시에 테스트를 더할 수 있으니 실패가 B 파일에서 나면 보고만).
- 변이: 1(20자 조건 빼기)·2(3단계 상한 빼기 → 요청 수 상한 테스트가 빨개지는가)·3(usage 에 넣기) 각각. **적용 grep 확인 후** 결과를 읽고, 원본은 스크래치패드 복사본으로 되돌린다(`git checkout`·`restore`·`stash` 금지).
- 마지막 응답: 고친 것·테스트 수·변이 결과를 8줄 이내로.
