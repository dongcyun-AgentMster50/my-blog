# Build 지침 — MedReader 1d단계: heading 규칙 가드 (P7 잔여 결함)

## 너의 역할

이 프로젝트의 **Build 단계 1d** 담당이다. 1·1b·1c는 완료·커밋되었다. 1c가 P7을 1.1% → 14.5%로 올렸으나, 남은 실패의 주원인이 **문항 stem 문단 분할**로 밝혀졌다. 그 한 가지만 고친다.

**2단계(db·pdf/extract)는 시작하지 않는다.**

## 먼저 읽을 것 (순서대로)

1. `D:\01_claude_my-blog\CLAUDE.md`
2. `D:\01_claude_my-blog\apps\medreader\spec.md` — **4-7이 2026-09-18에 수정되었다. 현재 파일을 읽어라.** 4-9(문단 그룹핑·kind 우선순위), 5-3, 4-11, 16-A, 20절.
3. `D:\01_claude_my-blog\apps\medreader\review.md`
4. 대상 코드: `apps/medreader/js/text/blocks.js` (`classifyRoles` 의 `shortNoStop`), `js/text/segment.js`(패턴 함수)

## 진단 결과 (1c Build 가 측정, 오케스트레이터가 재현 — 재조사 불필요)

4-7의 짧은 줄 규칙은 **약한 신호 세 개**(길이 ≤ 60자 + 종결 부호 없음 + 위 여백 ≥ 1.5×Lm)로만 제목을 판정한다. 문항 stem 첫 줄 `"I-42. An 18-year-old boy presents to"` 와 보기 `"A. Primary"` 가 정확히 그 모양이다.

그러면 4-9의 `newParagraph` 가 `prev.role === 'heading'` 조건으로 **다음 줄을 새 문단으로 떼어낸다.** 결과:

- `question` 문단 1,393개 중 **1,012개가 줄 1개짜리**
- 그중 **953개는 첫 줄 role 이 `heading`**
- P7 비정상 1,191건 중 **977건**이 이 원인

1c Build 가 스크래치패드 사본에서 가드를 실험한 결과(레포 미반영):

| | 현재(1c) | 가드 적용 |
|---|---:|---:|
| **P7** | 14.5% | **66.2%** |
| heading (1~60쪽) | 86 | 86 (불변) |
| 2단 / 표 region / 손상 3종 | 232 / 259 / 0 | 232 / 262 / 0 |
| ms/쪽 | 0.62 | 0.62 |

## 수정 허용 범위

```
apps/medreader/js/text/blocks.js       classifyRoles 의 shortNoStop 에 가드 추가
apps/medreader/js/text/layout.js       algoVersion 만 (3 → 4)
apps/medreader/tests/blocks.test.mjs   B17~ 추가 (기존 케이스 수정 금지)
```

금지:
- **`js/text/columns.js`·`lines.js`·`hyphen.js`·`segment.js` 수정 금지.** `segment.js` 의 패턴 함수는 **import 해서 쓰기만** 한다(1c가 Review 대상이다).
- **`config.js` 수정 금지.** 특히 `KEEP_HYPHEN_SUFFIXES` 는 사용자가 채운 값이다. 건드리지 마라.
- `spec.md` 수정 금지. 이견은 보고서에.
- `dev/proto-lines.*` 수정 금지.
- 기존 50개 테스트의 **기대값을 바꾸지 마라.** 하나라도 깨지면 회귀다.
- 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/` 수정 금지. 커밋·푸시 금지.
- 레포 안에 PDF·`node_modules`·`package.json` 금지. **원서 문장을 레포에 기록하지 마라**(픽스처 문장은 네가 지어내라).

## 구현 요구사항

1. **`classifyRoles` 의 `shortNoStop` 에 가드 한 항을 추가**한다 — spec 4-7 수정본 그대로:
   `isQuestionStart(text) || isOptionStart(text) || isAnswerStart(text)` 이면 **짧은 줄 경로로는 heading 이 되지 않는다.**
2. **`fontSize >= HEADING_SIZE_RATIO * Fm` 경로(`bigger`)는 건드리지 마라.** 진짜 큰 제목은 계속 `heading` 이어야 한다. 가드는 **약한 신호 경로에만** 건다.
3. `segment.js` 의 기존 export 를 import 해서 쓴다. 정규식을 `blocks.js` 에 복제하지 마라.
4. **`algoVersion` 3 → 4** 와 사유 주석.

## 회귀 테스트

- `B17` — 문항 stem 첫 줄(짧고·마침표 없고·위 여백 큼, `"I-88. A 52-year-old presents with"` 형태) → role `body`, 그리고 **다음 줄이 같은 문단에 남는다**(`question` 문단이 줄 2개 이상). **수정 전 실패해야 한다.**
- `B18` — 보기 첫 줄(`"A. Primary"` 형태, 짧고 마침표 없음) → role `body`, kind `option`. **수정 전 실패해야 한다.**
- `B19` — **큰 폰트 제목**(`fontSize ≥ 1.15×Fm`)이 문항 번호처럼 생겼더라도 `heading` 유지 → `bigger` 경로가 살아 있음을 고정.
- `B20` — 번호·글머리 패턴이 **없는** 짧은 제목(`"Clinical Manifestations"` 형태, 위 여백 큼) → 여전히 `heading`. **가드가 일반 제목을 망가뜨리지 않음**을 고정.

**픽스처의 영어 문장은 네가 지어내라.**

## 실제 PDF 하네스

`<스크래치패드>` 에 `pdfjs-dist@5.4.149` 와 스크립트(`v1c.mjs`, `all.mjs`, `p67.mjs`, `kinds.mjs`, `verify.mjs`, `diag.mjs`)가 있다.
- **Node 에서는 `pdfjs-dist/legacy/build/pdf.mjs` 를 import 하라.**
- 레포 모듈은 `import(pathToFileURL('D:/01_claude_my-blog/apps/medreader/js/...').href)`.
- 대상 PDF: `<다운로드>\ILMA_2021_20th_ed_Harrison.pdf` (729쪽).
- **하네스와 PDF는 스크래치패드/원래 위치에만 둔다.**

## 스모크 테스트

1. `node --test "apps/medreader/tests/*.test.mjs"` — 기존 50개 + 신규 전부 통과.
2. **수정 전/후 729쪽 전수 대조**:
   - P7 비율 (목표: 14.5% → 60%대)
   - 문단 kind 분포 — 특히 **`heading` 총수가 급감하지 않는지**
   - `question` 문단 중 줄 1개짜리 비율 (현재 1,012/1,393)
   - P6 (문항 3개 이상 쪽 수·순서 깨진 쪽)
   - ms/쪽 (spec P9 ≤15ms)
3. **1b·1c 지표 회귀 없음**: 2단 **232쪽**, 표 region **259**, 손상 3종 **0건**, `option` **6237**, `answer` **1187**. 표 region 은 소폭(≤5) 변동 가능하나 이유를 적어라.
4. `B17`·`B18`이 **수정 전에 실패**하는 것을 먼저 확인하고 나서 고쳐라.

## 완료 보고 형식

1. 수정/생성한 파일과 줄 수.
2. `node --test` **실제 출력**(pass/fail).
3. 수정 전/후 729쪽 대조표 + 1b·1c 회귀 없음.
4. `B17`·`B18`의 수정 전 실패 확인 방법과 실제 출력.
5. spec 과 다르게 구현한 부분. 없으면 "없음".
6. 남은 문제. **P7은 100%가 되지 않는다** — 쪽 경계 문항 15건, 컬럼 경계 보기 73건, 해설 속 번호 열거 81건, 그림 문항은 구조적 한계다(1c 보고). **진짜 결함과 구조적 한계를 구분**하라.
7. 2단계에 넘길 주의사항 3개 이내.

테스트를 통과시키려고 spec 을 어기거나 기대값을 낮추지 마라. 막히면 멈추고 보고하라.
