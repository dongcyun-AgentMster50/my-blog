# Build 지침 — MedReader 2b단계: 아이템 폭 위생 + 저장본 축소

## 배경

대상 PDF(729쪽)는 **임시본**이고 며칠 내로 **7000쪽 실제 자료**(같은 형식의 텍스트 PDF)로 교체된다. **특정 서적 지표 튜닝은 하지 마라.** 이 작업은 둘 다 **어떤 PDF에서도 성립하는 구조 문제**다.

`dev/profile.mjs`(2a)가 드러낸 것:

1. **pdf.js `item.width`의 2.13%가 깨져 있다** — 페이지 폭 초과 또는 음수. 그 결과 줄 **4.7%(2,347/49,692)**의 bbox가 페이지 밖으로 나간다(최대 줄 폭 9,337pt, 페이지 폭 612pt).
2. **저장본이 쪽당 32.4KB** — spec 9-2 초판 추정(5~10KB)의 3~7배. 7000쪽 환산 **221MB**.

## 너의 역할

spec **4-2(폭 위생)**와 **9-2(저장본 축소 규칙 1·2·3)**를 구현한다. **그것만 한다.**

`db.js`·`extract.js`는 **만들지 마라**(2단계 작업이다). 이 단계에서는 **순수 계층의 출력**을 고치고, 저장본을 만드는 **순수 함수**를 제공하는 데까지다.

## 먼저 읽을 것

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **4-2와 9-2가 2026-09-20에 수정되었다. 현재 파일을 읽어라.** 그 외 3-3(데이터 타입), 4-4(run 분할), 4-5(거터), 4-6(bbox), 4-8(표 run 텍스트 소비자), 4-10(하이픈), 4-12(하이라이트), 2-4.
3. `D:\01_claude_my-blog\apps\medreader\review.md` — bbox 이탈이 **이월 항목**으로 기록되어 있다.
4. 대상 코드: `js/text/lines.js`(`normalizeItems`·`lineBBox`), `js/text/layout.js`(`publicLine`·`publicRun`), `js/text/hyphen.js`(`joinParagraphText` — import 전용)

## 수정 허용 범위

```
apps/medreader/js/text/lines.js        normalizeItems 의 폭 위생, 필요하면 lineBBox
apps/medreader/js/text/layout.js       algoVersion, 좌표 반올림, 저장본 함수
apps/medreader/js/text/store.js        신규(권장) — 저장본 생성·복원 순수 함수
apps/medreader/tests/*.test.mjs        신규 추가 + lines/layout 테스트에 케이스 추가
```

금지:
- **`js/db.js`·`js/pdf/*` 를 만들지 마라.** 2단계 작업이다.
- **`config.js` 의 `KEEP_HYPHEN_SUFFIXES` 는 사용자가 직접 채운 값이다.** 건드리지 마라.
- `columns.js`·`blocks.js`·`segment.js`·`hyphen.js` **수정 금지**. import 해서 쓰기만 하라.
- `spec.md`·`dev/*` 수정 금지. 이견은 보고서에.
- 기존 80개 테스트의 **기대값을 바꾸지 마라.**
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라.**

## 구현 요구사항

### A. 아이템 폭 위생 (spec 4-2)

`normalizeItems` 에서:
- `w < 0` → 0 (기존)
- **`w`가 NaN이거나 페이지 폭을 넘으면 `str.length × fontSize × 0.5` 로 추정 대체**
- **원본 `str` 은 건드리지 마라.** 위생은 좌표·폭에만.
- `normalizeItems` 가 페이지 폭을 알아야 한다 — 현재 시그니처에 없으면 `pageInfo`·`params` 경유로 받되 **기존 호출부를 깨지 않게** 하라(선택 인자).
- **몇 개를 고쳤는지 셀 수 있게** 하라(`stats.widthFixed` 같은 필드). 7000쪽에서 이 수가 튀면 새 자료가 더 심하다는 신호다.

### B. 저장본 축소 (spec 9-2 규칙 1·2·3)

**순수 함수**로 만들어라. 2단계 `extract.js` 가 저장 직전에 호출한다.

```
toStored(pageLayout)   → 저장용 객체   // 규칙 1·2·3 적용
fromStored(stored)     → 읽기용 객체   // 문단 text 를 lineIds 로 재조립
```

1. **`paragraphs[].text` 를 저장하지 않는다.** `fromStored` 가 `lineIds` + `joinParagraphText`(4-10)로 조립한다.
   **`toStored` → `fromStored` 왕복 후 문단 text 가 원본과 바이트 단위로 같아야 한다.** 이게 이 작업의 핵심 테스트다.
2. **`runs[].text` 는 표 region 에 속한 줄에만 저장한다.** `runs[].x0`·`x1` 은 전 줄에 유지.
3. **좌표는 소수 둘째 자리로 반올림**한다(bbox 4값, baseline, fontSize, run x0·x1).
   반올림은 **결정적**이어야 한다(같은 입력 → 같은 출력).

- `algoVersion` 을 올려라(5 → 6) + 사유 주석.
- `fromStored` 는 **저장본만으로 동작**해야 한다(원본 items 없이).

### C. 테스트

- **왕복 테스트**: 합성 `PageLayout` → `toStored` → `fromStored` → 문단 text 가 원본과 동일. 하이픈 결합(`cardio-`+`vascular`), 하이픈 보존(`anti-`+`inflammatory`)이 섞인 문단으로 검증하라.
- **표 안/밖 run 텍스트**: 표 region 줄은 `runs[].text` 유지, 표 밖은 제거되고 `x0`·`x1` 은 남는다.
- **반올림**: 좌표가 소수 2자리 이하, 결정적.
- **폭 위생**: `w`가 페이지 폭 초과·NaN·음수인 아이템 각각 → 추정 대체·0, 그리고 **그 줄의 bbox가 페이지 안에 들어온다.** **수정 전 실패해야 한다.**
- 기존 80개 전부 통과.

## 실제 PDF 하네스

`C:\Users\YDC\AppData\Local\Temp\claude\D--01-claude-my-blog\ba4903bd-caaf-4b72-9d02-05694b9269f5\scratchpad\diag\` 에 `pdfjs-dist@5.4.149` 와 스크립트(`size.mjs`, `size2.mjs`, `bbox.mjs`, `v1e.mjs`, `verify.mjs`)가 있다.
- **Node 에서는 `pdfjs-dist/legacy/build/pdf.mjs` 를 import 하라.**
- 레포 모듈은 `import(pathToFileURL('D:/01_claude_my-blog/apps/medreader/js/...').href)`.
- `apps/medreader/dev/profile.mjs` 도 쓸 수 있다(`MEDREADER_PDFJS` 환경변수로 pdf.js 경로 지정).
- 대상 PDF: `C:\Users\YDC\Downloads\ILMA_2021_20th_ed_Harrison.pdf` (729쪽).
- **하네스와 PDF는 스크래치패드/원래 위치에만 둔다.**

## 스모크 테스트

1. `node --test "apps/medreader/tests/*.test.mjs"` — 기존 80개 + 신규 전부 통과.
2. 729쪽 전수 전/후 대조:
   - **bbox 이탈 줄** (현재 2,347줄 / 495쪽 → 기대: 크게 감소. **0이 되지 않을 수 있다** — 회전 줄 847개가 포함되어 있다. 성격별로 나눠 보고하라)
   - **저장본 쪽당 KB** (현재 32.4KB → 기대 20KB 근처)
   - **폭 위생이 고친 아이템 수**
   - **알고리즘 지표 회귀 없음**: 2단 **232쪽**, 표 region **252**, 손상 3종 **0건**, kind 분포(`option` 6264 / `question` 1392 / `answer` 1187 / `heading` 1009), P7 66.3%, ms/쪽
3. **폭 위생이 알고리즘을 바꿀 수 있다** — `splitRuns` 의 gap 계산에 들어가기 때문이다. 위 지표가 움직이면 **좋아진 것인지 나빠진 것인지 판정하고 근거를 대라.** 2단 검출이 늘면 좋은 신호일 수 있다.
4. 왕복 검증을 **실제 PDF 로도** 하라: 100쪽을 `toStored`→`fromStored` 해서 문단 text 가 전부 일치하는지.

## 완료 보고 형식

1. 수정/생성한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail).
3. 729쪽 전/후 대조표(위 2번 전부). 알고리즘 지표가 움직였으면 **판정과 근거**.
4. 왕복 검증 결과(합성 + 실제 100쪽).
5. spec 과 다르게 구현한 부분. 없으면 "없음".
6. 남은 문제. bbox 이탈이 0이 되지 않으면 **남은 것의 성격**(회전 줄·진짜 넓은 줄·여전한 결함)을 분류하라.
7. **2단계(db·extract)에 넘길 주의사항 3개 이내.** 특히 `toStored`/`fromStored` 의 계약과, `navigator.storage.estimate()` 로 **실제 IndexedDB 점유량을 재야 한다**는 것(spec 9-2 의 `[미확정]`).

테스트를 통과시키려고 spec 을 어기거나 기대값을 낮추지 마라. 막히면 멈추고 보고하라.
