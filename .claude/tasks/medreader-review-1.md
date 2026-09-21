# Review 지침 — MedReader 1단계: 줄 재구성 모듈

## 너의 역할

이 프로젝트의 **Review 단계 1/N** 담당이다. Build 1단계가 구현한 줄 재구성 순수 모듈·단위 테스트·프로토타입 페이지를 **독립적으로** 검증하고 `apps/medreader/review.md`를 작성한다.

**너는 구현자가 아니다.** Build 에이전트의 완료 보고를 믿지 마라. "테스트 전부 통과"라고 적혀 있어도 **네가 직접 `node --test`를 돌려 출력을 대조하라.** 구현자는 자기 코드의 문제를 보지 못한다 — 그래서 네가 따로 존재한다.

## 먼저 읽을 것 (순서대로)

1. `D:\01_claude_my-blog\CLAUDE.md` — 프로젝트 규칙
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — 승인된 설계 문서.
   **4절 전체(알고리즘)**, **4-11(수용 기준 표 L/C/B/T/H + P1~P11)**, **16-A**, **16-K**, 3-3(데이터 타입), 19절, 20절.
   16-A와 16-K가 너의 체크리스트다.
3. `D:\01_claude_my-blog\.claude\tasks\medreader-build-1.md` — Build가 받은 지침(허용 범위·요구사항 확인용)
4. 검증 대상 코드: `apps/medreader/js/config.js`, `apps/medreader/js/text/*.js`, `apps/medreader/tests/*`, `apps/medreader/dev/proto-lines.*`

## 수정 허용 범위

- **생성**: `apps/medreader/review.md` (검증 보고서)
- **수정 허용**: `apps/medreader/js/config.js`, `js/text/*.js`, `tests/*`, `dev/proto-lines.*` — **검증에서 실제 문제를 발견한 경우에만.** 취향에 따른 리팩터링·이름 변경·스타일 통일은 하지 마라. 고쳤다면 무엇을 왜 고쳤는지 review.md에 기록하라.
- **금지**: `apps/medreader/spec.md` 수정, 블로그 본체(`index.html`, `post.html`, `css/`, `js/`, `posts/`, `vendor/`) 수정, `apps/2048/` 수정, `.nojekyll` 삭제, `.claude/` 수정, git 커밋·푸시.
- 레포 안에 `node_modules`·`package.json`·`*.pdf`를 만들지 마라. 임시 파일은 스크래치패드에만 두고 검증 후 지워라.

## 검증 환경

- Windows. 레포 루트 `D:\01_claude_my-blog`. Node v24.14.0, `python`(3.14.3 — `python3` 아님).
- 브라우저 확인은 `preview_start {name: "blog"}`(launch.json의 기존 설정, `python -m http.server 8000`) → `http://localhost:8000/apps/medreader/dev/proto-lines.html`. **launch.json을 수정하지 마라.** 끝나면 `preview_stop`.
- jsDelivr·cdnjs 모두 열려 있다(HTTP 200 확인). pdf.js는 `6.3.289` 고정.
- **실제 원서 PDF는 이 기기에 없다.** 따라서 spec 4-11의 **P1~P11은 여기서 검증 불가**다. 사용자가 자기 기기에서 돌린다. review.md에는 "사용자 검증 대기"로 남기고, **네가 할 수 있는 것을 P 항목별로 대신 확인하라**(합성 픽스처로 P2·P3·P6·P10에 해당하는 성질을 확인하는 식). 못 한 것을 했다고 쓰지 마라.

## 검증 항목

### A. 단위 테스트 (16-A `[N]`) — 가장 중요

1. `node --test apps/medreader/tests/` 를 **직접 실행**하고 출력 전문을 review.md에 인용하라(pass/fail/skip 수).
2. spec 4-11 표의 **L1~L11, C1~C4, B1~B7, T1~T2, H1~H5 (총 29개)** 가 **전부** 독립 테스트로 존재하는지 케이스 번호로 대조하라. 빠진 번호가 있으면 그 자체가 결함이다.
3. **테스트가 spec의 기대값을 실제로 검증하는지 읽어라.** 통과하는 테스트가 아무것도 주장하지 않는 경우(assert 없음, 너무 느슨한 기대값, spec과 다른 기대값)를 찾아라. 특히:
   - `L3`(baseline 차 0.5×fontSize → **다른** 줄), `L5`(20pt 제목 2줄 → 상한 6pt로 **분리**) 처럼 "합쳐지면 안 된다"를 주장하는 케이스가 실제로 그걸 주장하는가.
   - `L4`: 같은 줄로 합쳐지는 것뿐 아니라 **줄 bbox y1이 위첨자 때문에 커지지 않는지**까지 확인하는가.
   - `L6`: 문단 text에 **공백이 있는지**(`"poses the least cardiovascular risk"`). `leastcardiovascular`가 나오면 실패.
   - `H3`: `"2019-" + "2020"` → `"20192020"`이면 실패, `"2019- 2020"`·`"2019-2020"`은 허용.
   - `C3`: 4열 표가 있는 1단 페이지를 **2단으로 오판하지 않는지**.
   - `T2`: run 2개짜리 줄 1개는 표가 **아님**.
4. 테스트를 **의도적으로 깨뜨려 보라**: `js/text/*.js`에서 상수 하나(예: `Y_TOL_FACTOR`)를 잠깐 바꿔 해당 테스트가 실제로 실패하는지 확인하고 **반드시 원상복구**하라. 상수를 바꿔도 전부 통과한다면 그 테스트는 가짜다. (원상복구 확인은 `git diff`로.)

### B. 순수성·결정성 (16-A `[D]`, 16-K `[D]`)

5. `apps/medreader/js/text/` 전체에서 `document`·`window`·`fetch`·`indexedDB`·`pdfjsLib`·`navigator`·`localStorage` 참조 **0건**을 grep으로 확인하고 명령과 결과를 기록하라.
6. `js/text/`에서 `from '../ui/` 류의 상위 계층 import 0건.
7. **결정성**: 같은 입력으로 `buildPageLayout`을 2회 호출해 `JSON.stringify`가 동일한지 직접 스크립트로 확인하라. 더해 **`Map`/`Set` 순회 순서나 불안정 정렬에 의존하는 코드가 있는지 소스를 읽어라** — 우연히 같은 결과가 나오는 것과 결정적인 것은 다르다. `sort()` 비교 함수가 0을 반환할 수 있는 자리에 `idx` tie-breaker가 있는가.
8. spec 3-3의 `PageLayout`·`Line`·`Paragraph`·`Region` 필드가 전부 채워지는지 실제 출력 객체로 확인하라(`algoVersion`, `columns.gutters`, `stats.medianFontSize/medianLeading/bodyLeft`, `line.runs`, `line.hyphenJoin`, `paragraph.kind` 등).

### C. 알고리즘과 spec의 일치

9. spec 4-2 ~ 4-10의 각 단계가 지정된 함수로 존재하는지 이름으로 확인하라:
   `normalizeItems`, `clusterLines`, `splitRuns`, `detectColumns`, `reassignByColumn`, `orderLines`, `joinText`, `lineBBox`, `classifyRoles`, `detectTables`, `groupParagraphs`, `joinHyphen`, `splitSentences`, `isQuestionStart`, `isOptionStart`, `endsSentence`.
10. `config.js`의 파라미터 값이 spec 4절 본문의 숫자와 **일치**하는지 하나씩 대조하라(`Y_TOL_FACTOR 0.35`, `Y_TOL_MIN 1.0`, `Y_TOL_MAX 6.0`, `SUPERSCRIPT_SIZE_RATIO 0.75`, `SUPERSCRIPT_DY_RATIO 0.6`, `SPACE_GAP_FACTOR 0.15`, `RUN_GAP_FACTOR 2.0`, `GUTTER_MIN_RATIO 0.55`, `GUTTER_BAND_LO 0.30`, `GUTTER_BAND_HI 0.70`, `SPAN_WIDTH_RATIO 0.6`, `MIN_BODY_LINES 8`, `PARA_LEADING_FACTOR 1.6`, `PARA_INDENT_FACTOR 0.8`, `PARA_SHORT_LINE_RATIO 0.70`, `TABLE_MIN_LINES 3`, `TABLE_LEADING_FACTOR 2.2`, `TABLE_COL_TOL_FACTOR 1.5`, `TABLE_ALIGN_RATIO 0.6`, `HEADER_ZONE 0.08`, `FOOTER_ZONE 0.08`, `PAGENO_ZONE 0.10`, `HEADING_SIZE_RATIO 1.15`). 다른 값이 있으면 "spec 위반"으로 적되, 코드에 근거 주석이 있으면 그 근거도 함께 적어라.
11. 하드코딩 검사: `text/*`에서 파라미터가 `config.js`를 거치지 않고 함수 안에 숫자로 박혀 있는 곳을 찾아라. spec은 프로토타입 슬라이더가 `params` 인자로 오버라이드하기를 요구한다 — **슬라이더를 움직였을 때 실제로 재계산에 반영되는지**가 이 항목의 진짜 판정이다(D절에서 확인).
12. `PDFJS_VERSION`이 `6.3.289`이고, 본체·worker URL이 **그 상수 한 곳에서** 조립되는지(버전 문자열이 두 번 이상 나타나면 결함).

### D. 프로토타입 페이지 (16-A `[D]`, 16-K `[D]`)

13. 브라우저로 `dev/proto-lines.html`을 열고 **콘솔 에러·경고 0건**(16-K)을 `read_console_messages`로 확인하라.
14. spec 4-11 "프로토타입 페이지" 요구가 전부 있는지: 파일 열기, 페이지 번호 입력, canvas + bbox 오버레이(본문 파랑·헤더/푸터/페이지번호 회색·표 주황·거터 점선), 읽기 순서 줄 목록(번호·col·role·fontSize·runs 수), 문단 경계 가로줄, 하이픈 결합 굵게, `hasEOL` 불일치 노란색, **파라미터 슬라이더 4개 이상**, items JSON 내보내기/불러오기, 전체 문서 통계 모드.
15. **items JSON 불러오기로 실제 동작을 확인하라.** 합성 픽스처(2단 + 표 + 러닝 헤드 + 하이픈 케이스)를 넣고 줄 목록이 spec대로 나오는지 눈으로 검증하고 스크린샷을 남겨라. 최소한 이것들:
    - 2단이 좌→우 순서로 나오는가
    - `"poses the least cardiovascular risk"`에 공백이 있는가
    - 표 영역이 orange로 잡히는가
    - 러닝 헤드·페이지 번호가 header/pageno로 분류되는가
    - `"cardio-" + "vascular"` → `cardiovascular`로 결합되는가
16. **슬라이더를 실제로 움직여** 줄 목록이 즉시 바뀌는지 확인하라(11번의 판정).
17. `dev/proto-lines.html`이 알고리즘 코드를 **복사하지 않고** `../js/text/layout.js`를 import 하는지 확인하라.
18. 모바일: `resize_window {preset:"mobile"}`로 375px에서 페이지가 열리고 가로 스크롤이 생기지 않는지.
19. 동적 텍스트가 전부 `textContent`로 들어가는지(`innerHTML` 사용처를 grep해 사용자 입력·PDF 텍스트가 들어가는 자리가 있으면 결함).

### E. 구조·위생 (16-K)

20. `git status`로 **블로그 본체·`apps/2048/`·`spec.md`·`.claude/`가 수정되지 않았는지** 확인하라. Build가 허용 범위 밖 파일을 건드렸다면 그 자체가 결함이다.
21. `.nojekyll`이 여전히 존재하는지.
22. 레포에 `*.pdf`·`node_modules`·`package.json`이 생기지 않았는지.
23. `text/*`·`tests/`에 **외부 라이브러리 의존 0건**.
24. **주의 — 오탐하지 마라**: 16-K의 "`../` 0건"은 **`/apps/medreader/` 바깥을 참조하지 않는다**는 뜻이다. `dev/proto-lines.html`이 `../js/text/layout.js`를 import 하는 것은 `/apps/medreader/` 안이므로 **정상이며 오히려 요구사항**이다(17번). 이것을 위반으로 적지 마라. 위반은 `apps/medreader/` 경계를 넘는 참조(`../../`, `/css/`, `/vendor/` 등)다.

### F. 성능 (P9 일부)

25. 2,000 아이템 합성 페이지로 `buildPageLayout` 평균 시간을 직접 측정하라(100회). spec 목표는 **≤ 15ms**. 넘으면 O(n²) 비교가 있는지 소스에서 찾아 지목하라. 이 기기의 측정값이 목표를 넘더라도 **실패로 단정하지 말고** 실측치와 병목 위치를 적어라(사용자 기기에서 재확인).

## review.md 작성 형식

```markdown
# Review — MedReader 1단계 (줄 재구성 모듈)

검증일 / 검증 대상 커밋 / 검증 환경(OS·Node·브라우저)

## 종합 판정
통과 / 조건부 통과(경미한 문제 N건, 목록) / 미통과(차단 문제 N건, 목록)
→ 2단계(19절 2번)로 진행해도 되는가: 예 / 아니오 + 이유

## 1. 단위 테스트
`node --test` 출력 전문 인용. L/C/B/T/H 29개 케이스 존재 여부 표(케이스 번호 · 있음/없음 · 통과/실패 · 기대값이 spec과 일치하는가).
의도적 파손 테스트 결과.

## 2. 순수성·결정성
grep 명령과 결과. 결정성 확인 스크립트와 결과. 데이터 타입 충족 여부.

## 3. spec 일치
함수 이름 대조표. config 파라미터 대조표(spec 값 vs 실제 값). 불일치 목록.

## 4. 프로토타입 페이지
콘솔 출력. 요구 기능 체크리스트. 스크린샷 경로. 슬라이더 동작 확인.

## 5. 구조·위생
`git status` 출력. 금지 파일 검사 결과.

## 6. 성능
측정값과 방법. 병목(있으면).

## 7. P1~P11 (실제 PDF) — 사용자 검증 대기
각 항목에 대해 "내가 합성 데이터로 확인한 범위"와 "사용자가 실제 PDF로 확인해야 할 것"을 구분해 적어라.

## 8. 발견한 문제
| # | 심각도(차단/경미/제안) | 위치(파일:줄) | 문제 | 근거 | 조치(내가 고침/Build에 반환/보류) |

## 9. 내가 고친 것
파일·변경 내용·이유. 없으면 "없음".

## 10. 2단계에 넘길 주의사항
```

## 규칙

- **근거 없는 "통과"를 쓰지 마라.** 각 항목에 네가 실행한 명령과 그 출력, 또는 네가 본 것을 적어라.
- 문제를 찾지 못했다면 "문제 없음"이라고 쓰되, **네가 무엇을 어떻게 확인했는지**가 그 문장을 뒷받침해야 한다.
- 차단 문제와 취향 문제를 섞지 마라. 심각도를 반드시 붙여라.
- spec과 구현이 다르면 **spec이 기준**이다. 다만 spec 쪽이 틀렸다고 판단되면 고치지 말고 review.md의 "제안"으로 남겨라(spec 수정은 사용자 승인 사항).
- 막히면 멈추고 보고하라. 추측으로 채우지 마라.
