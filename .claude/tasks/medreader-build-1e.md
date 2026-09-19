# Build 지침 — MedReader 1e단계: 표 후보 라벨 가드 (4-8 오탐)

## 배경 — 이 프로젝트의 우선순위가 바뀌었다

대상 PDF(`ILMA_2021_20th_ed_Harrison.pdf`, 729쪽)는 **임시본**이다. 며칠 내로 **7000쪽짜리 실제 자료**(같은 형식의 텍스트 PDF)로 교체되고 작업은 그것을 기준으로 다시 진행된다.

따라서 **특정 서적의 지표를 끌어올리는 튜닝은 하지 마라.** 이 작업을 하는 이유는 하나다: **표 오탐은 줄을 문단에서 지워 파서가 복원할 수 없는 손실을 만들고, 그 원인(행잡이 들여쓰기)은 어떤 문제집에서도 나타난다.**

## 너의 역할

`spec.md` 4-8에 방금 추가된 **라벨 가드**를 구현한다. 그것만 한다.

## 먼저 읽을 것

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **4-8이 2026-09-19에 수정되었다. 현재 파일을 읽어라.** 4-7, 4-9, 4-11, 16-A.
3. `D:\01_claude_my-blog\apps\medreader\review.md` — **1c·1d 절의 "A. 표 오탐 판정"** 이 진단과 검증된 패치 내용을 담고 있다. 반드시 읽어라.
4. 대상 코드: `apps/medreader/js/text/blocks.js` (`detectTables`), `js/text/segment.js`(패턴 함수, import 전용)

## 진단 (Review가 좌표·run 단위로 확인 완료 — 재조사 불필요)

p33·p34는 표가 아니라 **문항 `I-123.`의 보기 A·B·C**다. 보기 라벨 `"A."` 뒤 **21pt 행잡이 들여쓰기**가 run을 둘로 쪼개 `runs.length ≥ 2`를 만들고, 보기들이 같은 x에서 시작해 `alignedColumns = 2`, 보기 3개로 `block.length = 3` — **최소 조건을 전부 아슬아슬하게** 충족한다.

결과: 보기 A·B·C는 region, D·E는 문단으로 **한 문항이 찢어진다.**

전수 영향: 문항·보기 줄이 표로 먹힌 것 **46줄 / 13쪽**. (1c 시점 36줄/11쪽 — 1d가 만든 게 아니라 넓힌 것이다.)

Review가 검증한 패치 효과: region 262 → **252**, 먹힌 줄 46 → **10**, **`TABLE X-n` 캡션 150쪽의 표 감지 101 → 101 불변**, `option` 6228 → **6264**, 나머지 kind 전부 불변.

## 수정 허용 범위

```
apps/medreader/js/text/blocks.js       detectTables 의 후보 선정에 가드 추가
apps/medreader/js/text/layout.js       algoVersion 만 (4 → 5)
apps/medreader/tests/blocks.test.mjs   T3~ 추가 (기존 케이스 수정 금지)
```

금지:
- **`config.js`·`columns.js`·`lines.js`·`hyphen.js`·`segment.js` 수정 금지.** `segment.js`의 패턴 함수는 **import 해서 쓰기만** 하라 — 정규식을 복제하지 마라.
- **`config.js`의 `KEEP_HYPHEN_SUFFIXES`는 사용자가 직접 채운 값이다.** 건드리지 마라.
- `spec.md` 수정 금지. 이견은 보고서에.
- `dev/*` 수정 금지.
- 기존 56개 테스트의 **기대값을 바꾸지 마라.**
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라**(픽스처 문장은 지어내라).

## 구현 요구사항

1. **`detectTables`의 후보(`cand`) 선정에서 "첫 run이 번호·글머리 라벨뿐인 줄"을 제외**한다. spec 4-8 수정본의 정의 그대로:
   - `isQuestionStart(text) || isOptionStart(text) || isAnswerStart(text)` 이고
   - **첫 run의 텍스트가 라벨 자체**(`"A."`, `"I-42."`, `"12."`)로만 이루어진 줄
2. **판정 기준을 "첫 run이 라벨뿐"으로 좁게 유지하라.** "문항·보기 패턴이면 무조건 제외"로 넓히면 **진짜 표 안에 A·B·C 행 라벨이 있는 경우**를 놓친다. 넓히고 싶으면 근거를 보고서에 적고 수치로 보여라.
3. **`algoVersion` 4 → 5** 와 사유 주석.

## 회귀 테스트

- `T3` — 보기 4줄(`"A."` + 행잡이 들여쓰기로 run 2개, 같은 x 정렬) → **표가 아니다**(region 0개, 줄 role 은 table 이 아님). **수정 전 실패해야 한다.**
- `T4` — 진짜 표: 첫 run 이 라벨이 아닌 실제 셀 텍스트(`"Acetylsalicylic acid"` 형태) 4 run × 4줄 → **여전히 표로 감지**. 가드가 진짜 표를 죽이지 않음을 고정.
- `T5` — 진짜 표인데 **첫 열이 A·B·C 행 라벨**인 경우(`"A."` + 같은 줄에 셀 3개 더) → 판정을 네가 정하고 **spec 4-8 문구와 일치하는지** 보고서에 적어라. 2번 주의사항과 연결된다.

**픽스처 영어 문장은 지어내라.**

## 실제 PDF 하네스

`C:\Users\YDC\AppData\Local\Temp\claude\D--01-claude-my-blog\ba4903bd-caaf-4b72-9d02-05694b9269f5\scratchpad\diag\` 에 `pdfjs-dist@5.4.149` 와 스크립트(`v1d2.mjs`, `cmp1d.mjs`, `p7cat.mjs`, `verify.mjs`, `diag.mjs`, `look.mjs`)가 있다.
- **Node 에서는 `pdfjs-dist/legacy/build/pdf.mjs` 를 import 하라**(일반 빌드는 `DOMMatrix` 없음으로 죽는다).
- 레포 모듈은 `import(pathToFileURL('D:/01_claude_my-blog/apps/medreader/js/...').href)`.
- 대상 PDF: `C:\Users\YDC\Downloads\ILMA_2021_20th_ed_Harrison.pdf` (1회 순회 약 30초).
- **하네스와 PDF는 스크래치패드/원래 위치에만 둔다.**

## 스모크 테스트

1. `node --test "apps/medreader/tests/*.test.mjs"` — 기존 56개 + 신규 전부 통과.
2. 729쪽 전수 전/후 대조:
   - 표 region 수 (기대: 262 → 252 근처)
   - **문항·보기 줄이 표로 먹힌 수** (기대: 46 → 10 근처)
   - **`TABLE X-n` 캡션이 있는 쪽의 표 감지 수** (기대: 101 → 101 불변) ← **이게 가장 중요한 안전 지표다**
   - kind 분포 (`option` 6228 → 6264 근처, 나머지 불변)
   - P7, 2단 232쪽, 손상 3종 0건, ms/쪽
3. `T3`이 **수정 전에 실패**하는 것을 먼저 확인하고 나서 고쳐라.

## 완료 보고 형식

1. 수정한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail).
3. 729쪽 전/후 대조표(위 2번 전부). **`TABLE` 캡션 감지 수가 줄었다면 그건 회귀다** — 원인을 밝혀라.
4. `T3` 수정 전 실패 확인 방법과 실제 출력. `T5`의 판정과 근거.
5. spec 과 다르게 구현한 부분. 없으면 "없음".
6. 남은 문제. 표로 먹힌 줄이 0이 되지는 않는다 — 남은 10줄의 성격을 분류하라.
7. **다음 작업에 넘길 주의사항** — 다음은 (a) 하네스를 `dev/profile.mjs` 로 승격, (b) 책별 관례를 `BOOK_PROFILE` 로 분리, (c) 2단계 db·extract 다. 네가 코드를 만지며 본 것 중 이 셋에 도움이 될 관찰을 3개 이내로 적어라. 특히 **`blocks.js`·`segment.js` 에서 "이 책에만 맞는 상수·패턴"이 어디에 박혀 있는지** 목록으로 주면 (b)에 직접 쓰인다.

테스트를 통과시키려고 spec 을 어기거나 기대값을 낮추지 마라. 막히면 멈추고 보고하라.
