# Review 지침 — 다듬기 4 (동작·안전)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "다듬기 4 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지 — 덧붙인 뒤 특수 글자 수 점검). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\rp4\`(먼저 만들 것). `bp4/` 는 읽기만.

## 볼 것
지침 `.claude/tasks/medreader-build-polish4.md`, 보고서 `.claude/tasks/medreader-build-polish4-report.md`(믿지 말고 다시 재라), `git diff`(기준선 HEAD 2c9370e) + 새 시험 `tests/polish-4.test.mjs`.

## 오케스트레이터 결정 (보고서 남은 1·5)
- 분 한도 cooldown 은 [다시 시도]를 누를 때까지 안 풀림(자동 재시도 0) — **그대로**(전에는 분 한도도 exhausted 로 같은 막힘이었다 — 나빠지지 않음). 이 결정이 맞는지가 아니라 구현이 맞는지를 본다.
- 검사에 떨어진 문장 세션마다 다시 보냄 — 이번엔 고치지 않음(최종 보고 제안).

## 확인할 것
1. **429 판정(가장 중요)**: 합성 Gemini 429 본문 꼴(분·일·둘 다·quotaId 없음·`details` 없음·JSON 아님·`retryDelay` "30s"/"1.5s"/없음/이상한 값) → cooldown/exhausted 갈래, 기다림 시각. **어떤 꼴에서도 자동 요청 0**(cooldown 끝난 뒤 10초 더 기다려도 POST 수 그대로 — 낭독 창·탭·요약·설명·출제·개념도 각각). fetch 감싸개가 `clone()` 만 읽어 응답 본문을 소비하지 않는가, 429 아닌 응답·네트워크 오류에서 동작 같음, 요청 본문 바이트 HEAD 와 같음.
2. **화면 가림**: 원본 보기 → 검색·요약 시트·설정·서재 등 다른 화면으로 옮길 때 리더가 가리지 않음(3크기 × ko·ar), 원본 보기 자체 배치 HEAD 와 같음(돌아왔을 때).
3. **대화 둘**: 서재 삭제 `<dialog>` — 문구 조각(지워짐·남음 수) = 실제 결과, Esc·취소·확인·초점, 연속 삭제·대화 열린 채 다른 화면, `window.confirm` 0. 18 되돌리기 대화 — 배열일 때만.
4. **cssId `CSS.escape`**: 이상한 id(`"`·`\`·줄바꿈·`]`) 에서 예외 0.
5. 5번(다음 세션 재요청) 원인 판단이 맞는가 — 숫자를 돌려주는 흉내로 두 세션 요청 0 재확인.
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0, 바뀐 파일 특수 글자 수 HEAD 와 같음.
7. 변이 3개 이상 네가 고른 곳(Build M1–M6d 와 다르게 — 429 갈래 하나·대화 수 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `rp4/bak/`).
8. headless: Edge, pipe, 새 프로필 `rp4/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔(5번만 켬), **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 콘솔 오류 0(흉내 429 네트워크 줄 제외).

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 자동 요청이 생김·요청 늘어남, 일 한도를 분 한도로 잘못 읽음(한도 넘는 재시도 유도), 응답 본문 소비로 기존 오류 처리 깨짐, 요청 본문 바뀜, 대화 수 ≠ 실제·데이터 잃음, 화면 가림 남음·새로 생김, 콘솔 오류, 테스트 손상.
- **낮음**(→ "배포 가능"): 문구가 덜 들어간 화면, 실물 429 꼴 실기기 확인, 문안.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지 — 시험도 절대 경로로 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `rp4/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
