# 8i Build 보고 — 표를 행 단위로 읽기 (2026-10-13)

설계: `apps/medreader/spec.md` 4-13 (D1 (가) · D2 괘선 안 씀 · D3 열 머리 접기 · D4 주제 끝 회색 숫자 · D5 가드 추가 없음 · D6 `rowhead`).
**커밋하지 않았다.** 진짜 API 키를 쓰지 않았다. 원서 조각은 40자 이하로만 적었다.

## 1. 바뀐 파일

| 파일 | 내용 |
|---|---|
| `js/text/rowtable.js` (새) | 7b 순수 모듈. R1 띠 → R2 열(통로) → R3 판정((a)–(e), (e)=쪽 번호 열 필수) → R4 칸 → R5 행(구획·홀로·틈 없는 행·닻·위/가운데 정렬 DP) → R6 열 머리(띠 안 / 띠 바로 위) → R7 물려받기(같은 쪽, 연쇄, (a)–(e)). 줄을 열별로 다시 만들어 띠 첫 줄 자리에 행 순서로 끼운다. 행 표가 없으면 **입력 배열을 그대로** 돌려준다. 진단용 `piecesOf`·`bandsOf`·`tracksOf`·`judge`·`rowsOf` 내보냄. |
| `js/config.js` | `ROWTABLE`(ENABLED·SPAN_RATIO 0.55·CROSS_ALLOW 0.08·CH_FACTOR 0.8·PROSE_CHARS 25·SPARSE 0.6·SYNC 0.8·CELL_GAP 1.4·INH_CROSS 0.3·REQUIRE_REF·COLHEAD_MAX_CHARS 60 … 모두 비율, INT_ONLY 정규식). 되돌림 규칙 주석. |
| `js/text/layout.js` | 7단계 다음 7b 호출, 잡히면 줄 id 다시 매김, **algoVersion 10 → 11**(이력 주석·되돌림 = 12). `publicLine` 은 `rt` 가 있을 때만 단다. `buildPageLayout` 4번째 인자 `rowParams`(테스트용), `pageInfo.rowTableProbe` 진단 훅(출력·저장에 안 들어감). |
| `js/text/blocks.js` | 4-8 후보·흡수에서 `rt` 줄 제외. 4-9: 칸이 다르면 새 문단, A 칸은 한 문단, P 칸은 칸 안에서만 newParagraph. 내용이 옆에 있는 A 칸 = kind `rowhead` + `refLineIds`. `isLabelOnly` 를 export(R3 (d)가 같은 함수를 쓴다). |
| `js/text/store.js` | 줄 `rt`, 문단 `refLineIds` 저장·복원(있을 때만 — 없는 쪽은 옛 모양 그대로). `storeVersion` 1 그대로. |
| `js/ui/reader.js` | `FOLD_ROLES` 에 `colhead`. `ref` 줄: 이름표가 보여 주면 블록 없음, 아니면 접힌 줄. rowhead 블록에 `refs` → `span.rt-ref`(`.line` 아님 — 하이라이트·탭·낭독 대상 아님). |
| `css/reader.css` | `.para[data-kind="rowhead"]` 굵게 + 위 행 구분선(토큰 `--c-border`), `.rt-ref` 작은 회색(`--c-text-dim`). |
| `index.html` | `stamp-importmap` 다시 찍음(모듈 53 · CSS 4). |
| `tests/rowtable-8i.test.mjs` (새) | RT1–RT15 + 7b 순수·이동 불변·M10 계약·진단 (19개). |
| `tests/review6.test.mjs` | V9 "algoVersion 은 11" 로 갱신(그 테스트가 요구하는 대로 이력 한 줄). |
| `dev/measure-rowtable-8i.mjs` (새) | **앱 모듈로** 세 권 재측정 · `--rules` 괘선 대조 · 쪽 번호 칸 전수 · `--old` 로 행 표 없는 쪽 바이트 비교 + 행 표 쪽 글자(아이템) 보존 · `--units` 낭독 단위 점검 · 시간. |

기존 dev 파일은 고치지 않았다. `KEEP_HYPHEN_SUFFIXES`·`splitSentences` 호출 자리·`cite.js` 불변.

## 2. 테스트

- 전체 `node --test tests/*.test.mjs`: **1004 / 1004 통과 × 2회**(8i 전 985 → 새 19). `stamp-importmap --check` 그대로.
- 처음 돌렸을 때 빨간 것 2개와 처리: `D2 순수성`(내 주석에 `document`·`window` 낱말 — 주석을 고침), `V9 algoVersion 은 10`(갱신 대상 — 11 로).
- 흔들림 관찰: 변이 M2 실행 중 한 번 `pipeline-8a` "M7 같은 캐시 키 동시 요청" 이 빨갰다(부하 중 타이밍). 깨끗한 트리에서 그 파일 5회 연속 통과 — 8i 와 무관.

## 3. 변이 M1–M12 (적용 → `grep -F` 로 표지 확인 → 전체 테스트 → 스크래치패드 사본으로 복원 → `cmp`)

모두 grep 1건, 복원 후 `cmp` 같음. 아래 외에 매번 `IM2·IM6·IM7b`(import map 해시 — 파일 내용이 바뀌었으니 당연)도 빨갰다.

| # | 변이 | 빨개진 테스트 |
|---|---|---|
| M1 | 조건 (c) 제거 | RT8 |
| M2 | 라벨 가드 제거 | RT4 |
| M3 | 정렬을 늘 가운데로 | RT9(쪽 번호 열 있는 위 정렬판) |
| M4 | 열별 줄 쪼개기 생략(원래 줄 통째) | RT1 · RT2 · RT9 · RT12 · RT14 · 이동 불변 |
| M5 | R 판정 "정수 비율 ≥ 0.8" | RT8 |
| M6 | 가로지름을 칸으로 | RT7 · RT12 · RT14 |
| M7 | `describePage` 의 ref 제외 제거 | RT12 · RT14 |
| M8 | `CELL_GAP` 2.0 | RT1 · RT7 · RT12 |
| M9 | rowhead → heading | RT1 · RT2 · RT6 · RT7 · RT9 · RT12 · RT14 · RT15 |
| M10 | `ENABLED=false`, algoVersion 그대로 | **M10 계약** + RT1·2·4·6·7·9·11·12·14·15·진단 |
| M11 | R7 물려받기 제거 | RT14 |
| M12 | R7 (e) 가로지름 상한 제거 | RT15 |

## 4. 측정 — 앱 모듈 vs 시제품 (`dev/measure-rowtable-8i.mjs`, 데스크톱 Node, 이웃 쪽 없이)

| | 시제품 | 앱(8i) | 차이와 원인 |
|---|---|---|---|
| CMDT 2026 행 표 쪽 | 34(본문 표 16 포함, 조건 (e) 없음) | **18 = 21–38** | D1 (가) — (e) 로 본문 이름표 표 빠짐(`noRef` 19띠). 45·1587·1588·1653 등 **8i 전과 바이트 동일** |
| Harrison · CMDT 2021 | 5쪽 · 0 | **0 · 0** | 같은 이유(Harrison `noRef` 5띠, 57쪽 정답 걸이는 `label` 1) |
| 21–38 띠 (R7 물려받음) | 26 (6) | **26 (6)** | 같음 |
| 쪽 번호 칸(21–38) | 159 | **159** (ref 줄 159) | 같음 |
| 괘선 대조 | 832 중 821 (98.7%) | **834 중 823 (98.7%)** | 어긋난 11줄과 쪽(22·24·26·28·29·30·32·34·36) 같음. +2줄 = 33·34쪽 표 첫 내용 줄(쪽 위 6% 안 — 시제품은 빼고 앱은 넣음, 아래 5-1) — 둘 다 맞게 나뉨 |
| 열 머리 | — | 18쪽 18띠 | 21쪽은 띠 안, 나머지는 띠 바로 위 |
| 행 표 없는 쪽 옛·새 JSON(algoVersion 제외) | — | **같음 1,949 + 729 + 5,051, 다름 0** | 원칙 2 충족 |
| 행 표 쪽 글자 보존(아이템 다중 집합) | — | 잃음 0 · 늘어남 0 | |
| 21–38 낭독 단위 | (spec 4-13-1: 8i 전 1,006) | 794 — 정수만 0 · 열 머리/쪽 번호 줄 든 단위 0 · 쪽 번호 섞인 이름표 0 | |
| 원본 하이라이트(21–38, 저장본 경유) | — | 상자 1,468 중 쪽 번호 글자를 덮는 상자 0, 흐름의 ref/colhead 줄 0 | "& Pseudo- 1130" 넓은 상자 사라짐 |
| 이름표 문단(rowhead) | — | 132 = 주제 123 + "∗See chapter…" 각주 9(아래 꼬리 줄 "(continued…)"과 짝) | 홀로 선 행 9(각주 7 · 두 줄 장 제목 둘째 줄 2), 구획 행 32 |

## 5. 30쪽 낭독 단위 (`fromStored` → `describePage` → `flowParasOf` → `buildUnits`, 40자 이하)

```
rowhead  Thyroid Nodules & Multinodular Goiter
list     • Autonomously functioning thyroid nodu…
인용     Dhanasekaran M et al. J Endocr Soc. / [PMID: …]
heading  CHAPTER 30: DISORDERS OF PARATHYROID GL…
rowhead  Hypoparathyroidism & Pseudo-hypoparathy…
list     • FDA-approved in 2024 for the treatmen… / It is an option for patients with diffi…
rowhead  Osteoporosis & Osteopenia
list     • Because of the very rare but serious … (+3 문장)
인용     Black DM et al. Bone. / [PMID: …]
list     • Denosumab must be given on-schedule, … / Once started, denosumab should either b…
인용     Sølling AS et al. Curr Osteoporos Rep. / [PMID: …]
rowhead  Paget Disease of Bone (Osteitis Deforma…
list     • In some patients, biochemical remissi… / If the serum alkaline phosphatase level…
인용     Ayalon-Dangur I et al. Endocrine. / [PMID: …]
rowhead  Rickets & Osteomalacia
list     • Serum levels of 25-OHD should be moni…
인용     Demay MB et al. J Clin Endocrinol Metab. / [PMID: …]
heading  CHAPTER 31: MALE HYPOGONADISM & GYNECOM…
body     TURNER SYNDROME            (두 줄 장 제목의 둘째 줄 — spec 4-13-4 알려진 흠)
rowhead  Hirsutism & Virilization
list     • Crinecerfont, a corticotropin releasi… (+2 문장)
인용     Auchus RJ et al. N Engl J Med. / [PMID: …]
body     YRx                        (쪽 아래 로고 글자 — 8i 전에도 읽힘, 마지막 행 내용 칸 끝에 붙음)
body     See chapter for further details and ref…
```
- "1130" 같은 쪽 번호 단위 0, "& Pseudo- 1130" 섞임 0, 열 머리("Topic"/"Page Number…") 낭독 0. 이름표 끝 쪽 번호는 화면에만: Thyroid [1106] · Hypopara… [1130] · Osteoporosis [1138 · 1139] · Paget [1143] · Rickets [1142] · Hirsutism [1155].
- 8h 인용 단위(`cite`)는 P 칸 문단 안에서 그대로 잡힌다(위 "인용").

## 6. 재추출 시간 (데스크톱 Node, getTextContent + 레이아웃, DB 쓰기 제외)

| 책 | 시간 | 레이아웃 ms/쪽 (8i 전 → 후) |
|---|---|---|
| CMDT 2021 **5,051쪽** | **28.1초**(텍스트 26.7 + 레이아웃 1.5) | 0.20 → 0.29 |
| CMDT 2026 1,967쪽 | 30.5초 | 0.87 → 1.20 |
| Harrison 729쪽 | 7.4초 | 0.58 → 0.81 |

7b 비용은 쪽당 +0.1~0.3 ms(spec 의 0.14 ms 보다 크다 — 띠마다 run 텍스트를 다시 잇는 비용). 5,051쪽에 +0.5초, 폰 3–5배 추정 +2~8초.

## 7. 의도(지침·spec·시제품)와 다르게 한 곳

1. **`EDGE_ZONE` = 0 (시제품 0.06)** — 0.06 이면 33·34쪽에서 표 첫 내용 줄("• …")이 쪽 위 6% 안이라 표 밖에 남아 **표를 다 읽은 뒤** 읽혔다(문장이 갈림 — 8i 전보다 나쁨). 머리말·꼬리말·회전은 역할로, 쪽 자체 번호는 띠 맨 위·아래 pageno 제외(spec 4-13-3 의 "내용 열 범위 안일 때만"을 이렇게 구현)로 빠지므로 컷을 껐다. 결과 괘선 대조 +2줄(둘 다 정답).
2. **R6 글자 상한을 줄(조각)마다 적용** — spec "글자 ≤ 60자"를 행 합으로 보면 21쪽 "Topic"+열 이름(57자) = 62자로 열 머리를 놓친다. 띠 안 열 머리의 오른쪽 조각은 A 통로 안(x 가 A 열 경계 앞)에서 시작하는 가로지름이라 "A 조각 오른쪽에서 시작해 A 경계를 넘는 가로지름/비정수 R 조각"으로 판정한다. 위 정렬 표의 첫 행을 먹지 않게 **P 칸 조각이 섞이면 열 머리가 아니다**.
3. **R7 열 찾기를 경계 번호(k)로** — 시제품은 빈 열을 걸러낸 배열을 k 로 인덱싱해 쪽 번호가 없는 물려받을 띠를 늘 거절했다. 앱은 k 로 찾는다(21–38 결과는 같음 — 26띠·6물려받음).
4. **`rt` 를 넓힘** — spec `{t,row,cell}` 에 `k`(그 행·그 열의 칸 번호 — 칸 경계 문단 나누기에 필요)를 더하고, cell 에 `'S'`(구획)·`'H'`(열 머리)·`'X'`(A·R·P 밖의 한 조각 열이나 다른 열의 가로지름 — 잃지 않으려고 y 순으로 끼움)를 더했다. 줄 col 도 `'rS'`·`'rX'`. 띠 밖 열 머리 줄은 원래 col(0/1)에 role만 `colhead`.
5. **홀로 선 A 칸**(옆에 P 없음)은 `rowhead` 가 아니라 4-9 kind(대개 body). P 가 있는 A 칸만 rowhead.
6. R3 (b) 허용폭을 시제품의 2pt 절댓값 대신 `SYNC_TOL 0.25 × 띠 글자 크기 중앙값`으로(책 고유 값 금지). 결과 같음.
7. 정렬 모형(위/가운데)은 시제품대로 **띠마다** 고른다(spec 은 "표 단위로 한 번").
8. `buildPageLayout` 에 4번째 인자 `rowParams` 와 `pageInfo.rowTableProbe` 훅을 더했다(테스트의 "7b 없을 때"와 측정 도구용). 앱 호출부는 그대로.

## 8. 남은 위험

- **브라우저에서 보지 않았다.** CSS(`rowhead` 구분선·`.rt-ref`)와 리플로우·원본 보기 실제 화면, 폰 재추출 시간은 Review 가 실기기/브라우저로 봐야 한다. 하이라이트는 저장본 경유 순수 함수(`highlightBox`)로만 확인했다.
- 측정은 이웃 쪽을 넘기지 않는다. 앱은 이웃 저장본으로 머리말을 판정하므로 20·39쪽 등 이웃 쪽 결과가 미세하게 다를 가능성(ref·colhead 줄은 글자가 같아 영향은 작을 것) — 앱 안 재추출로 확인 필요.
- "∗See chapter…" 각주 9개가 아래 꼬리 줄 "(continued on following page)"과 짝지어 rowhead(굵게)로 보인다 — 읽기 순서·글자는 맞다(시제품과 같은 11줄 어긋남의 일부).
- 두 줄 장 제목의 둘째 줄("TURNER SYNDROME"·"IN CARDIOLOGY")은 홀로 선 행이거나 다음 이름표에 붙는다(spec 기록된 흠, 손실 없음). 쪽 아래 로고 글자("YRx")가 마지막 행 내용 끝에 붙는다(8i 전에도 읽힘).
- "이름표 | 정수만 | 산문" 꼴 데이터 표의 숫자는 읽지 않게 된다(D5 — 화면엔 보임). 새 책에서는 측정 도구의 쪽 번호 칸 전수로 볼 것.
- 7b 비용이 spec 추정보다 크다(쪽당 최대 +0.33 ms).
- 재추출 1회: 모든 책이 algoVersion 11 로 다시 뽑힌다. 21–38쪽 번역 캐시 키가 바뀐다(새 번역은 그 쪽을 다시 읽을 때만).
