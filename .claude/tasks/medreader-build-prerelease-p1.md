# Build 지침 — 공개 전 묶음 P1: 저장 경합 · 원본 해상도 · 키 형식·가리기(보안)

> 너는 **Build 서브에이전트(P1)**다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.
> 동시에 Build P2 가 **`js/text/*`·`algoVersion`·`config.js` 의 `LAYOUT` 블록·`tests/review6.test.mjs`** 를 고친다(CMDT 러닝 헤드). **너는 그 파일·블록을 건드리지 마라.** `config.js` 는 `ORIGINAL`·`REDACT_PATTERNS`·(필요하면) `AI` 키 형식 블록만.
> 끝나면 보고서 `.claude/tasks/medreader-build-prerelease-p1-report.md`.

## 읽을 것
- `.claude/tasks/medreader-handoff.md` — "반드시 지킬 것", **이월 결함 "documents 갱신 경합"**, 2026-10-10 "7c + 8a 후속"(경합 재현: 읽기 트랜잭션 3초 지연 → 사용자가 고른 언어가 2.6초 뒤 옛 값으로 덮임), 2026-10-12 절들(원본 뭉개짐 원인, 보안 항목)
- `apps/medreader/review.md` 의 "7c + 8a 후속 Review" 절(경합 재현 방법·5곳 목록), "8b" 절
- spec: 9-1·9-2(documents 스토어), 9-4(추출 재개 — `_saveMeta`), 12-5(원본 뷰), 4-8(표 크롭 `scale = 2 × dpr`, 상한 3), **8-4 `[수정 2026-10-12]`**(키 형식 진단·패턴 완화 방향), 13절(키 노출 금지), 18절 해당 행

## 고칠 것
### ① documents 부분 갱신 (경합)
- `js/db.js` 에 **한 트랜잭션 안에서 읽고 → 자기 필드만 합쳐 → 쓰는** 도우미(예: `patch(store, id, fn|partial)`). 레코드를 통째로 쓰는 5곳을 이 도우미로: `extract._saveMeta`, `reader.saveLastPage`, quiz 색인 저장, `library.openDoc`, 가져오기 중복 경로. **각자 자기 필드만** 쓴다(어느 필드가 누구 것인지 표로 보고서에).
- 7c 의 원문 언어 저장(이미 한 트랜잭션)과 같은 도우미로 통일할 수 있으면 통일.
- 테스트: Review 가 쓴 재현(읽기 트랜잭션 지연 주입)을 그대로 테스트로 — 고치기 전 빨강, 고친 뒤 초록. 5곳 각각 "다른 필드를 덮지 않는다".
- `DB_VERSION` 은 올리지 않는다(스키마 불변). 올려야 하면 멈추고 보고.

### ② 원본 캔버스 해상도
- `config.js` `ORIGINAL.DPR_MAX: 2` 고정 상한 → **캔버스 픽셀 수 예산**: `ratio = min(dpr, sqrt(MAX_PIXELS / (cssW × cssH)))`(1 미만으로 내려가지 않게). `MAX_PIXELS` 는 저사양 보호 근거와 함께(옛 주석: "3.0× 줌 × dpr 3 이면 한 변 5000px 을 넘어 저사양 기기에서 할당 실패"). 표 크롭(4-8)도 같은 기준을 쓰는지 판단해 맞춘다.
- 수용: Nour 캡처 조건(CMDT 2026 31쪽, 원본 66%, dpr 3) → canvas 실제 픽셀/CSS 픽셀 = 3. 3.0× 확대에서는 예산 안으로 떨어진다. 테스트로 고정.
- 8b-2 의 원본 뷰 세로 예산(B3 — canvas 아래변 ≤ 띠 윗변)이 그대로인지 브라우저 확인.

### ③ 키 형식 경고 · 키 가리기 (보안)
- **사실(오케스트레이터 재현)**: `REDACT_PATTERNS` 의 `AQ\.[0-9A-Za-z_\-]{20,}` 은 키 몸통에 `.`·`~` 등이 있으면 **키 전체를 놓친다**(부분이 아니라 통째로 안 지워짐). Nour 키는 "형식이 낯섭니다" 경고가 떴다 — 그런 글자가 들어 있을 가능성이 높다. provider 주요 경로는 실제 키 값으로도 지우지만(`keys:[key]`), **`ProviderError` 생성(`provider.js` 의 `redactString(message)` — keys 없음)** 은 패턴만 쓴다.
- 고칠 것: (가) 신형 키 패턴과 `REDACT_PATTERNS` 를 spec 8-4 `[수정 2026-10-12]` 대로 넓힌다(`AQ\.` 뒤 출력 가능 ASCII — 공백·따옴표·꺾쇠에서 끊김). 두 곳이 **같은 상수에서** 나오게(두 벌 금지). (나) 키를 가리는 **모든** 호출 경로가 저장된 실제 키 값도 함께 쓰게 — `ProviderError` 포함. 실제 키를 알 수 없는 경로는 목록으로 보고. (다) 형식 경고는 키를 드러내지 않고 "길이 n · 허용 밖 글자 종류" 정도만(8-4 고칠 방향 (가)).
- 테스트: 몸통에 `.`·`~`·`+`·`/`·`=` 가 든 가짜 키(실행 중에 이어 붙여 만들 것 — 소스에 한 덩어리로 두지 않기, GitHub 비밀 스캐너)가 콘솔·오류 메시지·토스트·`ProviderError.message`·usage 행 어디에도 남지 않는다. 기존 7a·7b 키 누출 테스트 전부 통과. 패턴 확장으로 정상 문장(예: "AQ.1 level")이 잘못 지워지지 않는지(20자 하한).

## 고쳐도 되는 파일
`js/db.js`, `js/pdf/extract.js`(`_saveMeta` 만), `js/ui/reader.js`(`saveLastPage` 만), `js/quiz/*` 중 색인 저장 부분만, `js/ui/library.js`(`openDoc`·가져오기 중복 경로만), `js/pdf/render.js`, `js/ui/original.js`(해상도 배선만), `js/privacy/redact.js`, `js/ai/provider.js`, `js/ui/settings.js`(형식 경고 문구 배선만), `js/config.js`(위 블록만), `js/i18n/*.js`(형식 진단 문구 — 네 언어 키 동일), `tests/` 새 테스트·관련 기존 테스트 기대값(바꾸면 이유를 보고서에).

## 검증
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 882 — P2 가 동시에 테스트를 더한다. 실패가 P2 파일이면 보고만). **3번 이상 돌려** 간헐 실패 없음.
2. 변이: 도우미 대신 통째 쓰기로 되돌리기, 픽셀 예산 대신 2 고정, 패턴을 옛것으로, `ProviderError` 에서 keys 빼기 — 각각 빨개지는가. 적용 grep 확인 후, 스크래치패드 복사본으로 복원·cmp(`git checkout`·`restore`·`stash` 금지).
3. 브라우저(`preview_start {name:"blog"}`, 캐시 우회): 설정 화면 회귀(검증·시험 번역·두 블록·드롭다운 2개), 원본 뷰 해상도(가능하면 가짜 문서로), 콘솔 0. 끝나면 가짜 데이터·키 삭제, 뷰포트 desktop.
4. 마지막 응답: ①②③ 결과, 테스트 수, 변이, 키를 알 수 없는 가리기 경로 목록을 10줄 이내로.
