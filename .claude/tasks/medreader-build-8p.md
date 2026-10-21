# Build 지침 — 8p 번역 문체: 문서 속성 `domain` (F6 · L-D4)

> 너는 **Build 서브에이전트**다. 운영자가 권장 순서대로 진행하기로 했다(2026-10-21). 승인된 설계: spec **19-1-3 §7 "8p — 번역 문체"**(표 전부 — 데이터·`ai/prompts.js`·부르는 곳·캐시·화면 자리·수용 기준) + 결정 **L-D4**(문서 속성 `domain` — 기본 의학, 어학 교재는 일반) · **L-D9 (가)**(domain 을 바꿔도 **캐시 키 불변** — 옛 번역은 그대로, 새 요청부터 새 문체). 8o 는 배포됨(`baa358c`).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8p-report.md`.

## 먼저 할 일 — spec 문구 정정 (8m Review L3)
spec 10-1 끝 근처(약 2502행) "`promptVersion` 상수를 `prompts.js`에 두고 캐시 `extra`와 `questions.promptVersion`에 기록한다" 는 7-5(1874행 근처 — "캐시 값에 저장하되 **키에는 넣지 않는다**")와 실제 코드(`ai/cache.js` `keyFor` — 키는 `kind|target|docId|hash(text)`, `PROMPT_VERSION` 은 `pipeline.js` 에서 **값에만** 기록)와 어긋난다. 글자 그대로 구현하면 판을 올릴 때마다 캐시가 전부 무효가 된다. → 그 줄을 "캐시 **값**(키 아님)" 으로 바로잡고 `[정정 2026-10-21 — 8m Review L3]`. **8p 가 판을 올리기 전에** 한다.

## 읽을 것
spec 19-1-3 §7 전체, 7-5(캐시 키), 10-1·10-2(지시문), 8m 의 `src`/`SRC_LINE`(19-1-2 2절 정정 줄), 결정 L-D4·L-D9. 코드: `js/ai/prompts.js`(`translateInstruction`·`buildTranslateRequest`·`PROMPT_VERSION`), `js/ai/readalong.js`·`js/ai/pipeline.js`·`js/ai/cache.js`, 탭 번역 경로, `js/db.js`(`documents`·`patch`), 문서 속성 화면(spec §7 이 정한 자리 — 서재 카드 메뉴 또는 문서 설정), `js/i18n/*`. review.md "8m Review"(캐시 키 실측 방법 — 이번에도 같은 방식으로 확인).

## 할 일
1. 데이터: `documents.domain ∈ {'medical','general'}`, **없으면 `medical`**(Nour 문서 전부 그대로), `db.patch` 로 자기 필드만. DB 버전 불변.
2. 지시문: `medical`(또는 없음)이면 **옛 지시문 문자열과 1바이트도 다르지 않게**, `general` 이면 spec 대로(의학 용어 문장 없음 · ROLE 한 곳만 다름 · 스키마 같음). `PROMPT_VERSION` 은 spec 대로 올리되(값에만 기록), **캐시 키 불변**.
3. 부르는 곳: readalong·탭 번역이 문서의 `domain` 을 넘김. 문서 중간에 바꾸면 다음 요청부터.
4. 화면: spec §7 이 정한 자리에 domain 고르기(네 언어 문구 — 아랍어·프랑스어 `[검토 — Nour·운영자]`). 어학 교재를 넣을 때 기본값을 자동으로 바꾸지는 **않는다**(spec 에 자동 추정이 없다면) — 있으면 spec 대로.
5. 테스트: spec §7 수용 기준(medical·없음 → 옛 문자열 동일, general → 차이 한 곳, 캐시 키 불변, domain 바꿔도 옛 캐시 적중, 다음 요청부터 새 문체).
6. stamp 다시, `--check` 0.

## 검증
- **캐시·요청 실측**(8m Review 방식): 의학책 3권 × 대상 ar·ko 로 HEAD(`baa358c`)와 현재의 요청 본문·캐시 키 비교 — medical(없음)에서 **요청 바이트 동일·캐시 키 동일·HEAD 가 채운 캐시로 재요청 0**. 해커스 견본에서 general 로 바꾼 뒤 지시문 차이가 정해진 한 곳뿐인지.
- 변이 3개 이상(medical 에서도 general 문장, domain 을 캐시 키에, 바꾼 뒤 떠 있는 요청까지 바꿈 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8p/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1338 + 새).
- headless Edge(412×915 · ko·ar · 가짜 키·흉내 번역 응답 · 새 프로필): domain 고르기 화면, 바꾼 뒤 다음 요청의 지시문, 옛 번역 캐시 적중. 회귀: 의학책 번역 띠(ar·rtl), 8m 전환·`src`, 8o 빈칸, 8i-3 쪽 넘김. 8000번 python(PID 30352)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`js/ai/prompts.js`·`readalong.js`·`pipeline.js`(domain 전달만)·탭 번역 경로, `js/db.js`(필요하면 `domain` 필드 목록만), 문서 속성 화면(`js/ui/*` 중 spec 이 정한 곳), `js/i18n/*`, `index.html`(stamp·자리), `css/*`, `tests/`, `spec.md`(10-1 문구 정정 + 19-1-3 §7 안 정정 줄), 스크래치패드 `b8p/`, 보고서. DB 버전·algoVersion·캐시 키·`SEARCH`/`SCAN` 버전 불변. review 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. 해커스 경로는 `.claude/tasks/medreader-build-8m-report.md`(읽기만). pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
