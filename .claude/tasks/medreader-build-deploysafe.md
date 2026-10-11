# Build 지침 — 배포 안전장치 (운영자 결정 A, 2026-10-12)

> 너는 **Build 서브에이전트**다. **커밋하지 않는다.** 한국어로 쓴다.
> 동시에 Plan 서브에이전트가 `spec.md` 를 고친다(검색 설계) — **`spec.md` 는 건드리지 마라.** 필요한 spec 문구는 보고서에 적어라(오케스트레이터가 넣는다).
> 끝나면 보고서 `.claude/tasks/medreader-build-deploysafe-report.md`.

## 왜 (공개 전 묶음 Review, `apps/medreader/review.md` "공개 전 묶음 Review" 절)
GitHub Pages 는 파일을 약 10분 캐시한다. 배포 직후 옛·새 ES 모듈이 섞이면:
- 옛 `redact.js` + 새 `provider.js` → **배경색만 있는 빈 화면**(오류는 콘솔에만 — 새로고침하면 된다는 것을 알 수 없다)
- 새 `render.js` + 옛 `config.js` → 원본 뷰만 조용히 빈다
- **새 `layout.js` + 옛 `blocks.js`/`config.js` → 섞인 규칙으로 재추출한 결과가 새 `algoVersion` 으로 굳는다**(다시 추출 버튼도 없다 — 책을 지우고 다시 넣어야 한다)
**Nour 는 이미 배포본을 매일 쓴다 — 모든 푸시가 그에게 바로 배포된다.** 지금 로컬에 algoVersion 10 커밋(`f26af46`)이 푸시 대기 중이다.

## 만들 것
1. **import map 으로 배포 단위를 `index.html` 한 장으로**
   - `apps/medreader/index.html` 에 `<script type="importmap">` — `js/` 아래 **모든** 앱 모듈을 `"./js/x.js": "./js/x.js?v=<내용 해시 앞 10자>"` 로. 모듈 안의 상대 import 가 같은 절대 URL 로 풀려 이 표에 걸리는지 확인하라(키 정규화 규칙).
   - **진입점**: `<script type="module" src="js/main.js">` 의 `src` 는 import map 을 거치지 않는다 → `<script type="module">import './js/main.js';</script>` 처럼 specifier 로 바꿔 표를 타게 하라. 동적 `import()`(앱 내부 모듈)도 표를 타는지 확인. pdf.js CDN 은 그대로.
   - CSS `<link>` 도 같은 해시 `?v=` 를 붙여라(옛 CSS + 새 JS 혼합도 막는다).
   - **생성기** `apps/medreader/dev/stamp-importmap.mjs` — `js/**/*.js`·`css/*.css` 의 SHA-256 을 재서 `index.html` 의 표시된 구간(시작·끝 주석 표지 사이)만 다시 쓴다. 바뀌지 않은 파일은 해시도 같아 캐시를 그대로 쓴다.
   - **잊지 않게 하는 테스트** `tests/importmap.test.mjs`: index.html 의 표가 (a) `js/` 아래 모든 모듈을 빠짐없이 덮고 (b) 각 해시가 지금 파일 내용과 같다 — 다르면 "stamp-importmap 을 돌려라"는 메시지로 실패. **이 테스트 덕분에 표를 갱신하지 않은 커밋은 테스트에서 걸린다.**
   - 테스트 파일·`dev/`·`tests/` 는 표에 넣지 않는다.
2. **부팅 실패 안내** — 지금은 실패하면 빈 화면이다. `index.html` 에 정적 안내(기본 숨김) + 작은 고전 스크립트: 모듈 로드 오류(`error` 이벤트)나 일정 시간(상수, 근거와 함께) 안에 앱이 부팅 완료 표시(`main.js` 가 세움)를 하지 않으면 안내를 보인다. 문구는 네 언어를 함께(UI 언어 설정을 아직 못 읽을 수 있다 — 아랍어 먼저, `dir` 각각), "앱을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요." + **[다시 불러오기]**(`location.reload()`). 버튼 48px. 이 안내 자체는 모듈 시스템에 의존하지 않는다.
3. **[텍스트 다시 추출]**(spec 9-4 — 설계만 있고 버튼이 없다) — 서재 카드 [⋯] 메뉴에. 그 문서의 `pages`(그리고 그 쪽 텍스트에서 파생된 퀴즈 섹션 인덱스 등 — 무엇이 파생인지 코드에서 찾아 목록으로)를 지우고 현재 `algoVersion` 으로 다시 추출. **사용자 데이터(원문 언어·마지막 쪽·번역 캐시·단어장 예정)는 유지** — `db.patch` 를 쓴다. 확인은 페이지 안 대화상자(`confirm()` 금지). 추출 중에도 읽기 가능(기존 재추출 경로와 같게).
4. 작은 결함 둘(Review 기록): 부팅 직후 [다음 쪽] → `#/reader/null/N` 으로 갔다 서재로 튕김(`reader.js goPage` 한 줄 확인) / `err.reextract` 의 ko·fr 문구가 영어(네 언어 키 동일 유지, 한국어·프랑스어로 번역).

## 고쳐도 되는 파일
`apps/medreader/index.html`, 새 `dev/stamp-importmap.mjs`, `js/main.js`(부팅 완료 표시), `js/ui/library.js`([⋯] 다시 추출), `js/ui/reader.js`(`goPage` 만), `js/pdf/extract.js`(다시 추출 진입점이 필요하면 최소), `js/db.js`(문서별 파생 데이터 지우기가 필요하면), `js/i18n/*.js`, `css/*.css`(안내·대화상자), `tests/` 새 테스트.
**건드리지 않는 것:** `spec.md`, `js/text/*`, `js/ai/*`, `js/tts/*`, 4절, 블로그 본체(레포 루트 `index.html` 등).

## 검증
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 930), 3번 이상.
2. **혼합 상태 재현**(가장 중요): 로컬 서버에서 Review 가 했던 섞기(옛 `redact.js`+새 `provider.js` 등)를 이번엔 **옛 index.html(옛 표) / 새 index.html(새 표)** 조합으로 — 브라우저가 표의 `?v=` URL 만 요청해 섞일 수 없음을 네트워크 기록으로 보여라. 옛 표 + 새 파일만 서버에 있는 경우(옛 해시 URL 도 같은 파일을 돌려줌 — 정적 서버는 쿼리를 무시)는 어떻게 되는가 — 그 한계를 정확히 적어라(쿼리는 캐시 키를 나눌 뿐, 서버가 옛 판을 보관하지 않는다).
3. 부팅 실패 안내: 모듈 하나를 일부러 404 로 만들어(로컬에서만, 원복) 안내가 뜨고 [다시 불러오기]가 동작. 정상 부팅에서는 안내가 **절대** 안 보인다(깜빡임 포함).
4. [텍스트 다시 추출]: 가짜 문서(algoVersion 9 쪽)로 — 다시 추출 후 쪽들이 10, 원문 언어·마지막 쪽 유지.
5. 변이: 표에서 모듈 하나 빼기 → importmap 테스트 빨강, 해시 하나 바꾸기 → 빨강, 진입점을 `src=` 로 되돌리기 → 빨강(소스 검사). 적용 grep 확인 후, 스크래치패드 복사본으로 복원·cmp(`git checkout`·`restore`·`stash`·`rm -rf` 금지).
6. 브라우저 회귀(`preview_start {name:"blog"}`): 서재·리더·낭독·띠·설정·원본·퀴즈, 콘솔 0, 360px 가로 스크롤 0. 끝나면 가짜 데이터 삭제, 뷰포트 desktop.
7. 보고서에 **운영자가 매 커밋 전에 할 일**(`node apps/medreader/dev/stamp-importmap.mjs` 한 줄)과, spec 에 넣을 문구(배포 절차 — 새 절 제안)를 적어라.
8. 마지막 응답: 만든 것, 혼합 상태 재현 결과와 한계, 테스트 수, 변이, 운영자 할 일을 12줄 이내로.
