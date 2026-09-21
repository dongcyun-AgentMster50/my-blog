# Build 지침 — MedReader 1c단계: 문단 kind 판정 수정 (P7 결함)

## 너의 역할

이 프로젝트의 **Build 단계 1c** 담당이다. 1단계·1b단계는 완료·Review 통과·커밋되었다. 실제 원서 729쪽 검증에서 **P7(문항 → 보기 구조)이 1.1%로 실패**했다. 그 수정만 한다.

**2단계(db·pdf/extract)는 시작하지 않는다.**

## 먼저 읽을 것 (순서대로)

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **4-9·5-3이 2026-09-18에 수정되었다. 현재 파일을 읽어라.** 4-7(역할 판정), 4-10, 4-11, 16-A, 20절.
3. `D:\01_claude_my-blog\apps\medreader\review.md` — 1단계·1b 검증 보고서
4. 대상 코드: `apps/medreader/js/text/segment.js`, `js/text/blocks.js`, `js/config.js`

## 진단 결과 (오케스트레이터가 실제 PDF로 확인 완료 — 재조사 불필요)

**결함 ① 문항 번호 형식.** spec 5-3 초판은 `/^(\d{1,3})\.\s+\S/` 만 문항 시작으로 봤는데, 대상 서적은 **섹션 로마숫자 + 하이픈 + 번호**를 쓴다.

| 형태 | 개수 (표본 56쪽) |
|---|---|
| `IV-62.` | **177** |
| `62.` | 11 |
| `IV-62. The answer is …` | **76** |

그 결과 729쪽 전체에서 `question` 문단이 **93개**만 잡혔고 `answer` 는 사실상 0개다.

**결함 ② kind 우선순위.** `heading` 이 `question`·`option` 보다 먼저 검사된다(`blocks.js` 의 `paragraphKind`). 보기 `"A. Primary"`·`"A. Herpes zoster"` 와 문항 stem `"I-42. An 18-year-old boy presents to"` 가 짧고 문장 종결 부호가 없어 4-7 heading 규칙에 먼저 걸린다.

`[실측]` 1~60쪽: 문단 1,345개 → `heading 300 / body 411 / option 627 / question 4 / list 3`. 보기 형태 문단은 735개인데 `option` 은 627개 — **108개가 `heading` 으로 샜다.**

**현재 전수 지표 (수정 전):** P7 정상 1.1%(93개 중 1개), P6 측정 가능 쪽 13곳뿐(문항을 못 잡아 셀 수가 없다).

## 수정 허용 범위

```
apps/medreader/js/text/segment.js      isQuestionStart / isAnswerStart 패턴
apps/medreader/js/text/blocks.js       paragraphKind 우선순위
apps/medreader/js/config.js            필요하면 패턴 상수 (LAYOUT 기존 값 변경 금지)
apps/medreader/js/text/layout.js       algoVersion 만 (2 → 3)
apps/medreader/tests/blocks.test.mjs   B10~ 추가 (기존 케이스 수정 금지)
apps/medreader/tests/hyphen.test.mjs   필요시 추가만
```

금지:
- **`config.js` 의 `KEEP_HYPHEN_SUFFIXES` 를 채우지 마라.** 사용자가 직접 채우는 `TODO(human)` 자리다. 빈 `Set` 과 주석을 그대로 두어라.
- **`js/text/columns.js`·`lines.js`·`hyphen.js` 수정 금지.** 1b가 Review 통과했다. 버그를 발견하면 고치지 말고 보고서에 적어라.
- `spec.md` 수정 금지. 이견은 보고서에.
- `dev/proto-lines.*` 수정 금지.
- 기존 43개 테스트의 **기대값을 바꾸지 마라.** 하나라도 깨지면 회귀다.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 텍스트를 레포에 기록하지 마라**(픽스처는 네가 지어낸 문장으로 만들어라).

## 구현 요구사항

1. **`isQuestionStart`** — spec 5-3의 새 패턴 `/^\s*(?:([IVXLC]{1,5})-)?(\d{1,3})\.\s+\S/`. 로마숫자는 **선택적 캡처**다(`12.` 형태도 계속 지원).
   - 번호 연속성 검사가 쓸 수 있도록 **섹션 부분과 번호 부분을 분리해 돌려주는 함수**를 함께 export 하라(예: `parseQuestionNumber(text)` → `{section, number}` 또는 `null`). 5절 파서(9단계)가 쓴다.
2. **`isAnswerStart`** — 같은 방식으로 로마숫자 접두를 받게 하라. spec 5-3의 정답 정규식과 일치시켜라.
3. **`paragraphKind` 우선순위** — spec 4-9 수정본 그대로: `answer → question → option → heading → list → body`.
   - `heading` 을 뒤로 옮기면 **진짜 제목이 문항·보기로 오판될 수 있는지** 확인하라. `"A. Primary"` 같은 보기는 살아나야 하고, `"SECTION I INTRODUCTION"` 같은 제목은 여전히 `heading` 이어야 한다.
   - 주의: `paragraphKind` 의 `allHeading` 검사는 **줄 role** 기반이다. 우선순위만 바꾸고 role 판정(4-7)은 건드리지 마라.
4. **`algoVersion` 2 → 3** 과 사유 주석.

## 회귀 테스트 (케이스 번호를 테스트 이름에 넣어라)

- `B10` — `"I-42. An 18-year-old boy presents to"` → kind `question`. **수정 전 실패해야 한다.**
- `B11` — `"IV-62. The answer is C. (Chap. 42)"` → kind `answer`. **수정 전 실패해야 한다.**
- `B12` — `"A. Primary"`(짧고 마침표 없음, heading 규칙에 걸리는 형태) → kind `option`. **수정 전 실패해야 한다.**
- `B13` — `"SECTION I INTRODUCTION TO CLINICAL MEDICINE"`(진짜 제목) → kind `heading`. 우선순위 변경의 오탐 방지.
- `B14` — `"12. Which of the following"`(로마숫자 없는 기존 형태) → kind `question`. **기존 동작 유지**(spec B6와 중복이 아니라 새 정규식이 옛 형태를 깨지 않았다는 가드).
- `parseQuestionNumber` 단위 테스트: `"IV-62. …"` → `{section:'IV', number:62}`, `"12. …"` → `{section:null, number:12}`, `"Hello."` → `null`.

**픽스처의 영어 문장은 네가 지어내라.** 원서 문장을 그대로 옮기지 마라.

## 실제 PDF 하네스

`<스크래치패드>` 에 `pdfjs-dist@5.4.149` 와 스크립트가 있다(`verify.mjs`, `kinds.mjs`, `qfmt.mjs`, `p67.mjs`, `diag.mjs`).
- **Node 에서는 `pdfjs-dist/legacy/build/pdf.mjs` 를 import 하라**(일반 빌드는 `DOMMatrix` 없음으로 죽는다).
- 레포 모듈은 `import(pathToFileURL('D:/01_medreader…').href)` 형태 — 기존 스크립트를 보고 따라 하라.
- 대상 PDF: `<다운로드>\ILMA_2021_20th_ed_Harrison.pdf` (729쪽).
- **하네스와 PDF는 스크래치패드/원래 위치에만 둔다.**

## 스모크 테스트 (네가 직접 수행)

1. `node --test "apps/medreader/tests/*.test.mjs"` — 기존 43개 + 신규 전부 통과.
2. **수정 전/후 729쪽 전수 대조.** 최소 이 수치:
   - 문단 kind 분포 (`question`/`option`/`answer`/`heading`/`body`/`list`)
   - P7: `question` 문단 뒤에 연속 `option` 이 2~5개 붙은 비율
   - P6: 문항 3개 이상인 쪽 수와 번호 순서가 깨진 쪽 수
   - 평균 `buildPageLayout` ms/쪽 (spec P9 ≤15ms)
3. **2단 검출·표 region·손상 3종이 1b 수준에서 회귀하지 않았는지** 확인하라(2단 232쪽, 표 region 259, 손상 0건). kind 변경이 여기에 영향을 주면 안 된다.
4. `B10`·`B11`·`B12`가 **수정 전에 실패**하는 것을 먼저 확인하고 나서 고쳐라. 순서를 지키고 보고서에 적어라.

## 완료 보고 형식

1. 수정/생성한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail). 오케스트레이터가 재실행해 대조한다.
3. 수정 전/후 729쪽 대조표(위 2번 전부) + 1b 지표 회귀 없음(3번).
4. `B10`·`B11`·`B12`가 수정 전 실패함을 어떻게 확인했는가.
5. spec과 다르게 구현한 부분. 없으면 "없음".
6. 남은 문제. 특히 **P7이 100%가 되지는 않을 것**이다 — 보기가 페이지 경계에 걸리거나 그림 문항이 섞인다. **진짜 결함과 구조적 한계를 구분해서** 보고하라.
7. 다음 단계(2단계)에 넘길 주의사항 3개 이내.

테스트를 통과시키려고 spec을 어기거나 기대값을 낮추지 마라. 막히면 멈추고 보고하라.
