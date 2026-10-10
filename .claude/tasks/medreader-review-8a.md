# Review 지침 — 8a: 번역 파이프라인·캐시·상태 기계·분할 계약

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "8a" 절로 덧붙인다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.

## 읽을 것
1. `.claude/tasks/medreader-build-8a.md`(Build 가 받은 지침), `medreader-build-8a-report.md`(Build 의 주장 — 검증 대상)
2. spec 16-D2(합격 기준), 7-5·7-6·7-8-2(R1~R6)·7-8-3·10-1·10-2·10-6, 3-2
3. `.claude/tasks/medreader-review-7b.md` — 키 누출 기계 검사·변이 테스트의 방식(같은 기준을 적용)
4. `git diff` 와 새 파일 `js/ai/{prompts,jsonrepair,cache,pipeline,ondevice}.js`

## 특히 볼 것
- **상태 기계를 직접 두드려라**(fetch 스텁): 429 → `exhausted` + 그 뒤 **요청 0건**(타이머·재시도 루프가 숨어 있지 않은지 일정 시간 기다려 확인), 500 → 정확히 1회 재시도, 401 → `no-key`, REGION → `region`, 404/MODEL_UNAVAILABLE → `model`(Build 가 새로 정함 — 이 결정이 7-6 의 원칙 "자동 재시도 없음·사용자 재시도로만 해제"와 맞는지 의견), 30초 타임아웃(가짜 시계), 같은 키 동시 요청 → 호출 1건.
- **`blocked` vs `failed` 구분**(Build 가 정함): 상태가 돌아오면 `blocked` 만 다시 보내고 `failed` 는 보내지 않는가. 이 구분이 "보내지 않은 것은 자동 전송 / 보냈다 실패한 것은 사용자 재시도만"(7-6)과 일치하는가. 무한 반복으로 이어지는 경로가 없는가.
- **10-2 검증의 오탐**: 길이 비율 `[0.2, 5]`·숫자 보존 검사가 **정상 번역을 버리지 않는가.** Nour 가 "좋다"고 한 실제 응답(운영자 캡처 — 아래)을 입력으로 넣어 보라. 아랍어는 영어 괄호가 붙어 길어지고, 숫자 `30`·`10`, 단위 `mg/L`→`ملغ/لتر` 가 있다. 단위가 번역되면 "숫자 소실"로 오판하지 않는가.
  예문: "Rheumatoid arthritis is a chronic autoimmune disease that often causes morning stiffness lasting more than 30 minutes." / "Methotrexate and adalimumab are disease-modifying drugs, and blood tests may show a C-reactive protein level above 10 mg/L."
  응답 아랍어(문장 단위로 나눠 시험): 운영자 캡처의 아랍어 블록과 같은 꼴 — 각 문장에 영어 괄호가 여러 개, 끝에 "10 ملغ/لتر".
- **jsonrepair**: 코드펜스·후행 쉼표·잘린 배열·스마트 따옴표·스키마 위반 + **악의적 입력**(거대한 문자열, 깊은 중첩, `__proto__` 키)에서 멈추거나 프로토타입이 오염되지 않는가.
- **캐시**: 키에 `provider`/`model` 이 없는가(7-5), 상한 정리가 `createdAt` 순인가, 문서 삭제 연쇄. 캐시 값에 **키 문자열이 저장되지 않는가.**
- **분할 계약**: R5 변이(두 번째 분할)를 네가 직접 적용해 R2 가 빨개지는지. `flowParasOf` 분리 전후로 낭독 큐가 같은지 — 실PDF 는 지금 쓸 수 없다(pdf.js 설치본이 사라짐, 운영자 허락 대기). **기존 픽스처·테스트로 할 수 있는 만큼** 하고 실PDF 확인은 "대기"로 적어라.
- **설정 화면 회귀**: [검증]·[시험 번역]·두 언어 블록·bidi·드롭다운 2개가 그대로인가(브라우저, fetch 스텁). 코드펜스 JSON 이 이제 두 블록인가.
- 무료 한도 숫자 하드코딩 0, `innerHTML` 0, 키 누출 0(요청 URL·콘솔·DOM·캐시 값·usage 행).
- 변이: Build 의 14종 중 3개 이상 재현 + 새것 2개 이상. **적용됐는지 grep 으로 확인 후** 결과를 읽어라. 원본은 스크래치패드 복사본으로 되돌린다(`git checkout`·`restore`·`stash` 금지).

## 고쳐도 되는 것
8a 가 만든·바꾼 파일 안의 **결함 수정**만(`js/ai/*` 새 파일, `provider.js` 의 `charsTranslated`, `config.js` 의 `PIPELINE`, `tts/text.js` 의 분할 계약 부분, `reader.js` 의 `flowParasOf`, `settings.js` 의 jsonrepair 연결, 관련 테스트). `gemini.js` 판정 순서·모델 필터·`spec.md`·`text/*` 는 고치지 않는다.

## review.md "8a" 절
결론 · 16-D2 항목별 결과와 확인 방법 · 상태 기계 실측 · 10-2 오탐 시험 결과 · 키 누출 · 변이 · 고친 것/기록만 한 것 · 실PDF 확인 대기 항목.
