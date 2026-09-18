# Build 지침 — MedReader 1b단계: 컬럼 검출 수정 (P2 차단 결함)

## 너의 역할

이 프로젝트의 **Build 단계 1b** 담당이다. 1단계는 이미 완료·Review 통과·커밋되었으나, **실제 원서 PDF로 검증하니 P2(컬럼 병합)가 전면 실패**했다. 그 수정만 한다.

**2단계(db·pdf/extract)는 시작하지 않는다.** spec 4-11이 P2 실패 시 다음 작업을 금지한다.

## 먼저 읽을 것 (순서대로)

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **4-4·4-5·4-10은 2026-09-18에 수정되었다. 반드시 현재 파일을 읽어라.** 4-11(수용 기준), 16-A, 20절.
3. `D:\01_claude_my-blog\apps\medreader\review.md` — 1단계 검증 보고서
4. 대상 코드: `apps/medreader/js/text/columns.js`, `js/text/lines.js`, `js/config.js`, `js/text/hyphen.js`

## 진단 결과 (오케스트레이터가 실제 PDF로 확인 완료 — 재조사 불필요)

대상 PDF `C:\Users\YDC\Downloads\ILMA_2021_20th_ed_Harrison.pdf` (729쪽). 결함은 **둘이 연달아** 작용한다.

**① `RUN_GAP_FACTOR 2.0`이 크다.** 이 책 거터는 **15pt**(왼쪽 x≈306 끝, 오른쪽 x≈321 시작), 본문 10pt이므로 임계 20pt > 15pt → **거터가 run 경계로 인식되지 않는다.** 히스토그램에 넣을 간격 자체가 안 생긴다.

**② 거터 비율의 분모가 틀렸다.** 초판은 `0.55 * body.length`인데, **한쪽 컬럼에만 있는 줄은 거터를 가로지르지 않아 끊길 수가 없다.** 이 책은 좌·우 baseline이 어긋나는 문제집 조판이라 그런 줄이 절반을 넘어 비율이 구조적으로 희석된다.

실측(표본 40쪽, `RUN_GAP 1.2` 기준):

| 쪽 | 본문줄 | 가로지름 | peak | 현재비율 | 새비율 | 실제 |
|---|---|---|---|---|---|---|
| 20 | 59 | 17 | 17 | 0.29 | **1.00** | 2단 |
| 31 | 69 | 18 | 18 | 0.26 | **1.00** | 2단 |
| 174 | 70 | 31 | 31 | 0.44 | **1.00** | 2단 |
| 207 | 46 | 10 | 10 | 0.22 | **1.00** | 2단 |
| 42 | 47 | 45 | 15 | 0.32 | 0.33 | **1단**(해설, 전폭) |
| 130 | 44 | 41 | 3 | 0.07 | 0.07 | **1단**(해설, 전폭) |

결과가 `1.00`과 `≤0.35`로 뚜렷이 갈린다. **`GUTTER_MIN_RATIO 0.55`는 그대로 둔다.** 임계를 낮추는 방식은 이미 시도했고 오탐만 늘었다(2단 검출 4→18쪽인데 붙음후보 137→142로 증가).

## 수정 허용 범위

```
apps/medreader/js/config.js          RUN_GAP_FACTOR 값과 근거 주석
apps/medreader/js/text/columns.js    거터 비율 분모 수정
apps/medreader/js/text/lines.js      필요한 경우에만 (run x0/x1 노출 등)
apps/medreader/tests/columns.test.mjs  회귀 테스트 추가 (기존 케이스 수정 금지)
apps/medreader/tests/hyphen.test.mjs   H6 추가 (기존 케이스 수정 금지)
apps/medreader/tests/fixtures/*.json   실제 페이지 items 픽스처 추가
```

금지:
- **`config.js`의 `KEEP_HYPHEN_SUFFIXES` 내용을 채우지 마라.** 사용자가 직접 채우는 `TODO(human)` 자리다. **주석과 빈 Set을 그대로 두어라.** 배선(`hyphen.js`가 그 집합을 쓰는 것)은 이미 되어 있다.
- `spec.md` 수정 금지. 이견은 보고서에.
- `dev/proto-lines.*`, `js/text/blocks.js`, `js/text/segment.js` 수정 금지(필요하면 보고서에 근거를 적고 물어라).
- 기존 38개 테스트의 기대값을 바꾸지 마라. **하나라도 깨지면 그건 회귀다.**
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지.

## 구현 요구사항

1. **`RUN_GAP_FACTOR` → `1.2`.** 근거를 주석에 적어라(실측 거터 15pt, 단어 간격 상한 1.0em, 그 사이 값).
2. **거터 비율 분모 수정.** 후보 bin 의 X 를 가로지르는 본문 줄 수를 분모로 쓴다:
   `crossing(X) = body 중 runs[0].x0 < X && runs[last].x1 > X 인 줄 수`
   - 분모가 0이거나 너무 작으면(예: `MIN_BODY_LINES` 미만) 1단으로 본다 — **가로지르는 줄이 3개뿐인데 3개가 다 끊긴다고 2단으로 판정하면 안 된다.** 이 하한을 `config.js` 상수로 두고 근거를 적어라.
   - 결정성을 지켜라(안정 정렬, `idx` tie-breaker, `Map`/`Set` 순회 의존 금지).
3. **회귀 테스트**(케이스 번호를 테스트 이름에 넣어라):
   - `C6` — 좌·우 baseline이 어긋난 2단 문항 페이지(한쪽 컬럼에만 있는 줄이 과반) → `count=2`. **현재 코드로는 실패해야 하고 수정 후 통과해야 한다.**
   - `C7` — 전폭 본문 1단 페이지(해설 구간 모사) → `count=1`. 오탐 방지.
   - `C8` — 거터 폭이 1.5em인 2단 페이지 → `count=2`. `RUN_GAP_FACTOR` 회귀 방지(2.0으로 되돌리면 실패해야 한다).
   - `H6` — `joinHyphen`에 접미사 집합을 **인자로 주입**해 하이픈이 보존되는지. 예: `joinHyphen('methicillin-', 'resistant', new Set(), new Set(['resistant']))` → `'methicillin-resistant'`. **`config.js`의 빈 집합에 의존하지 마라**(사용자가 채우는 중이다).
4. **실제 페이지 픽스처.** 합성 픽스처의 거터는 spec대로 넓게 만들어져 이 결함을 잡지 못했다. **실제 PDF에서 뜬 items JSON**을 `tests/fixtures/`에 넣어 회귀를 고정하라. 2단 문항 페이지 1장 + 1단 해설 페이지 1장이면 충분하다.
   - 저작권: **1~2쪽 분량만.** 문항 텍스트가 길게 들어가지 않게 하라.
   - PDF 자체는 절대 레포에 넣지 마라.

## 실제 PDF로 검증하는 방법 (하네스가 준비되어 있다)

스크래치패드에 Node 하네스가 있다: `C:\Users\YDC\AppData\Local\Temp\claude\D--01-claude-my-blog\ba4903bd-caaf-4b72-9d02-05694b9269f5\scratchpad\diag\`
- `pdfjs-dist@5.4.149` 설치 완료. **Node에서는 `legacy/build/pdf.mjs`를 써라**(일반 빌드는 `DOMMatrix` 없음으로 죽는다).
- `diag.mjs`(페이지별 줄 덤프), `sweep2.mjs`(파라미터 스윕), `denom.mjs`(분모 비교), `look.mjs`(줄 확인)가 있다. 참고하거나 고쳐 써라.
- 레포 모듈은 `import(pathToFileURL('D:/01_claude_my-blog/apps/medreader/js/...').href)`로 불러온다.
- **이 하네스는 스크래치패드에만 둔다. 레포에 넣지 마라.**

## 스모크 테스트 (네가 직접 수행)

1. `node --test "apps/medreader/tests/*.test.mjs"` — 기존 38개 + 신규 전부 통과.
2. **수정 전/후를 실제 PDF 729쪽 전수로 대조하라.** 최소 이 수치를 표로 내라:
   - 2단으로 판정된 쪽 수
   - 문단 텍스트의 `[a-z][A-Z]` 붙음후보 수
   - 20자 이상 낱말 수
   - 표 region 수 (오탐 급증 감시)
   - 페이지당 평균 `buildPageLayout` 시간 (spec P9: ≤15ms)
3. **손상 3종이 사라졌는지 직접 확인**: `examinatrocardiographic`(343쪽), `myocarelectrocardiogram`(349쪽), `echocardioechocardiography`(355쪽) → 수정 후 각각 `electrocardiographic`·`examination` 등으로 정상 분리되어야 한다.
4. `algoVersion`을 올려라(알고리즘이 바뀌었다 — spec 3-3).

## 완료 보고 형식

1. 수정/생성한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail). 오케스트레이터가 재실행해 대조한다.
3. 수정 전/후 729쪽 전수 대조표(위 2번 항목 전부).
4. 손상 3종 전/후 텍스트(위 3번). 실제 문자열을 인용하라.
5. `C6`·`C7`·`C8`이 **수정 전에는 실패**함을 확인했는가? 어떻게 확인했는지 적어라.
6. spec과 다르게 구현한 부분. 없으면 "없음".
7. 남은 문제(붙음후보가 0이 되지는 않을 것이다 — `dL`·`mL`·`pH` 같은 정상 단위가 패턴에 걸린다). **진짜 결함과 패턴 오탐을 구분해서** 보고하라.

테스트를 통과시키려고 spec을 어기거나 기대값을 낮추지 마라. 막히면 멈추고 보고하라.
