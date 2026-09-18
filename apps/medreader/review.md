# Review — MedReader 1단계 (줄 재구성 모듈)

- 검증일: 2026-09-18
- 검증 대상 커밋: `edf64dd MedReader Build 1단계: 줄 재구성 순수 모듈` (브랜치 `claude/medreader-spec-planning-i8ge24`)
- 검증 환경: Windows 10 Pro 19045 / Node **v24.14.0** / Chromium(내장 브라우저 패널, `python -m http.server 8000`)
- 기준 문서: `apps/medreader/spec.md` 4절·4-11·16-A·16-K, `.claude/tasks/medreader-build-1.md`

---

## 종합 판정

**조건부 통과** — 차단 문제 0건, 경미 3건, 제안 6건.

→ **2단계(spec 19절 2번: `config.js`·`db.js`·`hash.js`·`pdf/loader.js`·`pdf/extract.js`)로 진행해도 되는가: 예.**

근거:
- 단위 테스트 L1~L11·C1~C4·B1~B7·T1~T2·H1~H5 **29개 전부 존재**하고 전부 통과하며, 상수를 의도적으로 깨뜨렸을 때 **해당 케이스가 실제로 실패**한다(§1-3). 통과가 우연이 아니다.
- spec 4-2~4-10의 모든 단계 함수가 지정된 이름으로 존재하고, `config.js`의 파라미터 값이 spec 4절 숫자와 **전부 일치**한다(§3).
- 순수성·결정성·데이터 타입·성능(2.8~3.1ms/2,000아이템, 목표 15ms)이 실측으로 확인된다(§2, §6).
- Build가 신고한 spec 이탈 5건은 **4건이 "그대로 구현하면 spec 자신의 수용 기준이 깨지는" 자리**였고, 내가 spec 원문대로 되돌려 실패를 재현했다(§1-4). 나머지 1건도 무해하다.
- 발견한 경미 문제 중 하나(프로토타입 페이지의 모바일 레이아웃)는 내가 고쳤고, 나머지는 2단계를 막지 않는다.

**단, P1~P11(실제 원서 PDF)은 이 기기에서 검증 불가**다(§7). 사용자 검증 전에는 리더 UI(19절 4번 이후)로 넘어가지 않는 것이 spec 4-11의 요구다. 2단계(추출·저장)는 오히려 P1~P11 검증에 필요한 전제이므로 진행 가능하다고 판단한다.

---

## 1. 단위 테스트

### 1-1. `node --test` 실행

지침에 적힌 `node --test apps/medreader/tests/`(디렉터리 인자)는 **이 환경에서 동작하지 않는다**(Node v24 + Windows가 디렉터리를 모듈로 해석). 글로브 형태를 썼다. Build의 결함이 아니라 환경 사실이다.

검증 대상 커밋 그대로(내 테스트 추가 전):

```
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 520.7462
평균 2.92ms / 페이지 (2,000 아이템)
```

내가 회귀 테스트 4건을 더한 뒤(§9):

```
$ node --test "apps/medreader/tests/*.test.mjs"
✔ B1 상단 "SECTION I INTRODUCTION" + 하단 "23" → header, pageno. 본문에서 제외
✔ B2 이웃 페이지에 같은 러닝 헤드(숫자 치환 동일) → header 확정
✔ B3 행간 1.6×Lm 초과 → 문단 분리
✔ B4 들여쓰기 0.8×Fm + 앞 줄 마침표 → 문단 분리
✔ B5 들여쓰기 있지만 앞 줄이 "e.g." 로 끝남 → 분리 안 함
✔ B6 "12. Which of the following" → kind=question 문단 시작
✔ B7 "A. Checklists to ensure" → kind=option
✔ B8 [Review 추가] "N. The answer is X" 는 question 이 아니라 answer
✔ B9 [Review 추가] 러닝 헤드 바로 아래 첫 본문 줄을 heading 으로 오판하지 않는다
✔ T1 4 run × 4줄 열 정렬 → table region 1개, role=table, 문단에 미포함
✔ T2 run 2개짜리 줄 1개만 → 표 아님
✔ C1 2단 합성 페이지(좌 20줄·우 20줄, 거터 0.5W) → count=2, 좌 20줄 → 우 20줄
✔ C2 C1 + 중앙에 폭 0.8W 제목 1줄 → 제목 위 좌·우 → 제목 → 제목 아래 좌·우
✔ C3 1단 페이지 + 4열 표 6줄 → count=1 (표를 2단으로 오판하지 않는다)
✔ C5 [Review 추가] 거터에 폭 있는 공백 아이템이 끼어 있어도 2단으로 잡힌다
✔ C4 줄 7개뿐인 페이지 → count=1 (정보 부족)
✔ H1 "cardio-" + "vascular" → "cardiovascular"
✔ H2 "anti-" + "inflammatory" → "anti-inflammatory"
✔ H3 "2019-" + "2020" → 하이픈 유지, 공백 없이 결합하지 않는다
✔ H4 "gram-" + "negative" → "gram-negative"
✔ H5 대시("—")로 끝나면 공백 결합
✔ H1~H5 문단 단위 결합과 Line.hyphenJoin 표시
평균 3.07ms / 페이지 (2,000 아이템)
✔ F1 합성 2단 픽스처: 컬럼·읽기 순서·표·역할·하이픈·공백
✔ D1 결정성 — 같은 입력 2회 처리 결과가 JSON 기준 동일
✔ D2 순수성 — text/* 가 브라우저 전역을 참조하지 않는다
✔ D3 성능 — 2,000 아이템 페이지 레이아웃 평균 시간 (15ms 초과 시 경고)
✔ L1 같은 baseline(±0.5pt)의 아이템 5개 → 줄 1개, X 순서대로 결합
✔ L2 baseline 차 = 0.3×fontSize 인 두 아이템 → 같은 줄
✔ L3 baseline 차 = 0.5×fontSize 인 두 본문 아이템 → 다른 줄
✔ L4 본문 10pt + 6pt 위첨자(baseline +4) → 같은 줄, bbox y1 불변
✔ L5 20pt 제목 두 줄, 행간 22pt → 두 줄 (Y 허용 상한 6pt)
✔ L5b [Review 추가] 40pt 제목 두 줄, 행간 13pt → 두 줄 (Y 허용 상한 6pt가 실제로 작동)
✔ L6 "poses the least" / "cardiovascular risk" → 줄 2개, 문단은 공백으로 이어짐
✔ L7 한 줄 안 gap = 0.1×fontSize → 공백 없음
✔ L8 한 줄 안 gap = 0.3×fontSize → 공백 삽입
✔ L9 pdf.js식 공백 아이템이 있어도 공백은 하나만
✔ L10 동일 문자열이 gap = −0.9×fontSize 로 겹치면 하나만 남는다
✔ L11 회전 아이템(transform b≠0) → role rotated, 본문·문단에서 제외
ℹ tests 38
ℹ pass 38
ℹ fail 0
```

### 1-2. spec 4-11 표 29개 케이스 대조

"기대값이 spec과 일치하는가"는 테스트 본문을 읽고 판정했다. "주장하는가"는 §1-3의 의도적 파손으로 **실측 확인**했다.

| # | 존재 | 통과 | spec 기대값과 일치 | 실제로 주장하는가(파손 시 실패) |
|---|---|---|---|---|
| L1 | ○ | ✔ | ○ X 순서 결합까지 검증 | ○ (`SPACE_GAP_FACTOR` 0.50 → 실패) |
| L2 | ○ | ✔ | ○ | ○ (간접: Y_TOL 계열) |
| L3 | ○ | ✔ | ○ "**다른 줄**"을 `length===2`로 주장 | ○ (`Y_TOL_FACTOR` 0.60, `Y_TOL_MIN` 5.0 → 실패) |
| L4 | ○ | ✔ | ○ 같은 줄 **+ bbox y1 불변**(`bb.y1===708`)까지 | ○ (위첨자 상수 4종·`absorbSmallLines` 제거·bbox 규칙 제거 모두 → 실패) |
| L5 | ○ | ✔ | △ "두 줄"은 주장하나 **"상한 6pt"는 주장하지 못함** (§8 #4) | × → **L5b 추가로 보강** |
| L6 | ○ | ✔ | ○ 문단 text에 공백 있음 + `leastcardiovascular` 부재 명시 | ○ |
| L7 | ○ | ✔ | ○ | ○ (`SPACE_GAP_FACTOR` 0.02 → 실패) |
| L8 | ○ | ✔ | ○ | ○ (`SPACE_GAP_FACTOR` 0.50 → 실패) |
| L9 | ○ | ✔ | △ 결과는 맞지만 **구조적으로 실패할 수 없음** (§8 #5) | × |
| L10 | ○ | ✔ | ○ | ○ (`OVERLAP_FACTOR` 5.0 → 실패) |
| L11 | ○ | ✔ | ○ role + 문단·본문 제외까지 | ○ |
| C1 | ○ | ✔ | ○ count=2 + 거터 x + 좌20→우20 순서 | ○ (`GUTTER_BAND_LO`·`MIN_BODY_LINES`·`RUN_GAP_FACTOR` → 실패) |
| C2 | ○ | ✔ | ○ 밴드 순서 41줄 전부 대조 | ○ (`SPAN_WIDTH_RATIO`·`GUTTER_MIN_RATIO` → 실패) |
| C3 | ○ | ✔ | ○ 4열 표 6줄 + 1단 본문 12줄 → count=1 | ○ |
| C4 | ○ | ✔ | ○ 7줄 → count=1 | ○ (`MIN_BODY_LINES` 30 → C1/C2 실패로 임계 작동 확인) |
| B1 | ○ | ✔ | ○ header/pageno + 문단 제외 | ○ (`HEADER_ZONE`·`PAGENO_ZONE` → 실패) |
| B2 | ○ | ✔ | ○ **이웃 없을 때 header가 아님**까지 대조(좋은 설계) | ○ (`HEADER_ZONE` → 실패) |
| B3 | ○ | ✔ | ○ | ○ (`PARA_LEADING_FACTOR` 5.0 → 실패) |
| B4 | ○ | ✔ | ○ | ○ (`PARA_INDENT_FACTOR` 5.0 → 실패) |
| B5 | ○ | ✔ | ○ 문단 1개(분리 안 함) | ○ |
| B6 | ○ | ✔ | ○ kind=question + 다음 줄 동일 문단 | ○ |
| B7 | ○ | ✔ | ○ A·B 둘 다 option | ○ |
| T1 | ○ | ✔ | ○ region 1개·role=table·문단 미포함 **+ run 텍스트 보존** | ○ (`TABLE_*` 4종 → 실패) |
| T2 | ○ | ✔ | ○ region 0개 | ○ |
| H1 | ○ | ✔ | ○ | ○ |
| H2 | ○ | ✔ | ○ | ○ |
| H3 | ○ | ✔ | ○ `"20192020"` 금지 + 두 허용형 모두 인정 | ○ |
| H4 | ○ | ✔ | ○ | ○ |
| H5 | ○ | ✔ | ○ em/en dash·`--` 3종 | ○ |

추가 테스트(spec 표 밖, Build 작성): D1 결정성 · D2 순수성 · D3 성능 · F1 합성 픽스처 종합. 모두 실제 단언을 갖는다.

### 1-3. 의도적 파손 테스트

31개 상수/코드 지점을 하나씩 바꿔 돌리고 **매번 원본으로 되돌렸다**(스크립트가 `readFileSync` → 변형 → 테스트 → 원본 write). 각 행은 그 상수를 바꿨을 때 실패한 테스트다.

| 바꾼 것 | 값 | 실패한 테스트 |
|---|---|---|
| `Y_TOL_FACTOR` | 0.35→0.60 | L3, C2 |
| `Y_TOL_MIN` | 1.0→5.0 | L3, L4, F1 |
| `Y_TOL_MAX` | 6.0→30.0 | **없음** → L5b 추가 후 L5b |
| `SUPERSCRIPT_SIZE_RATIO` | 0.75→0.40 | L4, F1 |
| `SUPERSCRIPT_DY_RATIO` | 0.6→0.1 | L4, F1 |
| `SUPERSCRIPT_WIDTH_RATIO` | 0.35→0.01 | L4 |
| `SUPERSCRIPT_MAX_WIDTH_EM` | 2.5→0.05 | L4, F1 |
| `SPACE_GAP_FACTOR` | 0.15→0.50 | L1, L8 |
| `SPACE_GAP_FACTOR` | 0.15→0.02 | L7 |
| `OVERLAP_FACTOR` | 0.5→5.0 | L10 |
| `RUN_GAP_FACTOR` | 2.0→20.0 | C1, C2, T1, F1 |
| `RUN_GAP_FACTOR` | 2.0→0.05 | **없음** (§8 #6) |
| `GUTTER_MIN_RATIO` | 0.55→0.99 | C2 |
| `GUTTER_BAND_LO` | 0.30→0.49 | C1 |
| `SPAN_WIDTH_RATIO` | 0.6→0.95 | C2 |
| `MIN_BODY_LINES` | 8→30 | C1, C2, F1 |
| `GUTTER_MAD_FACTOR` | 3→0 | **없음** (§8 #7) |
| `PARA_LEADING_FACTOR` | 1.6→5.0 | B3 |
| `PARA_INDENT_FACTOR` | 0.8→5.0 | B4 |
| `PARA_SHORT_LINE_RATIO` | 0.70→0.01 | **없음** (§8 #8) |
| `TABLE_MIN_LINES` | 3→10 | T1, F1 |
| `TABLE_LEADING_FACTOR` | 2.2→0.1 | T1, F1 |
| `TABLE_COL_TOL_FACTOR` | 1.5→60 | T1, F1 |
| `TABLE_ALIGN_RATIO` | 0.6→1.5 | T1, F1 |
| `TABLE_MIN_LINES_RELAXED` | 2→1 | **없음** (기본 임계 3이 먼저 걸러 T2는 유지된다 — 동작은 옳다) |
| `HEADER_ZONE` | 0.08→0.01 | B1, B2, F1 |
| `PAGENO_ZONE` | 0.10→0.01 | B1, F1 |
| `HEADING_SIZE_RATIO` | 1.15→3.0 | **없음** (§8 #9) |
| `HEADING_GAP_FACTOR` | 1.5→0.01 | B3, B4, B5, B6, B7, T1, F1 |
| `HEADER_UPPER_RATIO` | 0.6→1.5 | **없음** (B1이 `/^SECTION/` 경로로 통과) |
| `DEFAULT_ASCENT` | 0.8→1.6 | L4 |
| (코드) `joinText` 의 `!cur.str.startsWith(' ')` 가드 제거 | — | **없음** → L9가 무엇도 주장하지 못함 |
| (코드) `absorbSmallLines` 2차 통과 제거 | — | L4, F1 |
| (코드) `lineBBox` 의 위첨자 제외 제거 | — | L4, F1 |
| (코드) `splitRuns` 기준을 spec 원문 `items[i-1]` 로 되돌림 | — | **없음** → C5 추가 후 C5 |
| (코드) `paragraphKind` 에서 question 을 answer 보다 먼저 | — | **없음** → B8 추가 후 B8 |
| (코드) heading 여백 기준을 직전 줄(역할 무관)로 | — | **없음** → B9 추가 후 B9 |

**원상복구 확인**

```
$ git status --porcelain
?? .codex/
?? AGENTS.md
$ git diff --stat
(출력 없음)
```

`.codex/`·`AGENTS.md`는 세션 시작 시점부터 있던 미추적 파일이다(내 작업물이 아니다). 검증 대상 파일은 전부 원본과 바이트 동일했다. (이후 §9의 수정을 적용했다.)

### 1-4. Build 신고 5건에 대한 나의 판정

Build의 설명을 옮기지 않고, spec 원문대로 되돌린 코드를 직접 돌려 판정했다.

---

#### ① `absorbSmallLines` 2차 통과 추가 — **타당**

**(i) 정말 필요한가: 그렇다.** spec 4-3 의사코드를 그대로 두면 L4가 실제로 깨진다. 내가 `absorbSmallLines` 호출만 제거하고 돌린 결과 **L4·F1 실패**. 이유도 Build의 주장과 같다: 정렬이 y 내림차순이므로 위첨자(y가 더 큼)가 **먼저** 나와 홀로 새 줄을 열고, `ref = min(line.fontSize, item.fontSize)` = 위첨자 크기라 허용오차가 좁아져 뒤따르는 본문이 합류하지 못한다(10pt 본문 + 6pt 위첨자 dy=4 → tol=2.1, 위첨자 예외는 `item.fontSize <= 0.75*line.fontSize` 가 10 ≤ 4.5 로 거짓). **예외가 한 번도 발동할 수 없는 구조**다. spec 쪽 결함이며 보강이 옳다.

**(ii) spec 취지를 바꾸지 않는가: 바꾸지 않는다.** 결과(위첨자가 본문 줄에 합류하되 baseline·bbox를 끌어올리지 않음)가 spec 4-3·4-6과 같다. 흡수된 아이템에 `sup = true`가 붙어 `lineBBox`의 y1 제외와 baseline 가중치 0이 그대로 적용된다(L4가 `bb.y1 === 708`로 고정).

**(iii) 부작용: 실측으로 반례를 찾지 못했다.** 직접 만든 반례:

| 시나리오 | 결과 |
|---|---|
| 각주 영역 전체가 7pt(행간 8pt) 3줄 | 흡수 없음 ○ — `L.fontSize(7) > 0.75×T.fontSize(5.25)` 에서 걸린다. 같은 크기끼리는 원리적으로 흡수되지 않는다 |
| 같은 각주를 행간 5pt로 극단화 | 흡수 없음 ○ |
| 10pt 본문 줄 바로 아래 7pt 각주 줄(폭 150) | 흡수 없음 ○ — 폭 가드에서 걸린다 |
| 2단 페이지에서 좌측 6pt 조각 + 우측 10pt 본문(dy=3) | 흡수 없음 ○ — X 범위 가드(`slack = 2×fontSize`)에서 걸린다 |
| 6pt 참고문헌 번호 `12,13`(폭 14) 이 10pt 본문 baseline+4 | 흡수됨 ○ (의도한 동작, 놓치지 않는다) |

흡수가 일어나는 필요조건은 `L.fontSize ≤ 0.75×T.fontSize` **그리고** `폭(L) ≤ 0.35×폭(T)` **그리고** `폭(L) ≤ 2.5×T.fontSize` **그리고** `dy ≤ 0.6×T.fontSize` 전부다. 10pt 본문 조각이 잘못 빨려들려면 이웃이 13.4pt 이상이고, 조각 폭이 33pt 이하이며, baseline 차가 8pt 이하여야 한다(14pt 제목 기준 실측 경계: 폭 ≤35pt, dy ≤8.4pt). 14pt 제목과 다음 본문 줄의 baseline 차가 8pt 이하인 조판은 시각적으로 겹치는 상태라 실제 책에서는 나오지 않는다. **위험은 존재하나 도달 불가에 가깝다.** P1·P7에서 사용자가 실제 PDF로 재확인할 항목으로 §7에 남긴다.

---

#### ② 위첨자 폭 가드 2개 추가 (`SUPERSCRIPT_WIDTH_RATIO 0.35`, `SUPERSCRIPT_MAX_WIDTH_EM 2.5`) — **타당**

- **근거 주석과 함께 `config.js`에 있다** — `config.js:70-77`. 두 값 모두 "왜 필요한가"가 한국어 주석으로 붙어 있다(제목 줄에 본문 한 줄이 통째로 빨려드는 것 차단).
- **없으면 안 되는가: 그렇다.** ①의 2차 통과는 "이웃 줄의 0.75배 이하 폰트"만으로 후보를 고르는데, 14pt 제목 옆 10pt 본문은 그 조건을 통과한다(10 ≤ 10.5). 폭 가드가 없으면 본문 한 줄이 제목에 흡수된다. 두 가드 각각을 극단값으로 바꾸면 L4가 실패하므로 **죽은 코드도 아니다**.
- **긴 위첨자를 놓치는가: 놓치지 않는다.** 10pt 본문 기준 상한은 `2.5 × 10 = 25pt`. 6pt 폰트에서 25pt는 약 8자에 해당한다. 실측으로 `12,13`(폭 14pt)은 정상 흡수됐다. `a,b`·`12,13`·`†‡` 급은 전부 여유 안이다. 25pt를 넘는 "위첨자"는 조각이 아니라 별개 줄로 보는 편이 옳다.
- 참고: 두 가드는 `joinKind()`(1차 통과)에도 `SUPERSCRIPT_MAX_WIDTH_EM`만 반영돼 있고 `SUPERSCRIPT_WIDTH_RATIO`는 2차 통과 전용이다. 1차 통과에서는 비교 대상 줄의 폭이 아직 확정되지 않으므로 합리적인 선택이다.

---

#### ③ run 분할 간격 기준을 "직전 비공백 아이템"으로 변경 — **타당 (오히려 필수)**

- **spec 4-2와 충돌하지 않는다.** 4-2는 공백 아이템을 *버리지 말라*고 했을 뿐 간격 계산에 쓰라고 하지 않았다. 4-2의 공백 아이템 보존 목적은 "줄 내 공백 삽입 판정"이고, 그 판정은 `joinText()`가 여전히 `items[i-1]`(공백 포함) 기준으로 한다. 즉 **4-2의 용도는 그대로 살아 있다.**
- **없으면 spec 자신의 P2가 깨진다.** 거터 한가운데에 폭 50pt짜리 공백 아이템이 놓인 2단 페이지(좌 72~272, 공백 280~330, 우 340~540)를 만들어 `items[i-1]` 기준으로 되돌려 돌린 결과:

  ```
  [spec 원문 items[i-1]]  blank-in-gutter=false → columns.count=2, 줄 40개
                          blank-in-gutter=true  → columns.count=1, 줄 20개
                          첫 줄 = "left body line number 1 right body line number 1"
  [현재 구현 lastSolid]   두 경우 모두 count=2, 줄 40개
  ```

  spec 4-11 P2("컬럼 병합 0건")와 20절 "2단 페이지가 한 줄로 병합" 함정에 **정면으로 걸리는 회귀**다.
- **L7·L8·L9 부작용 없음.** `joinText`는 이 변경과 무관하고(공백 삽입은 여전히 물리적 직전 아이템 기준), L7/L8/L9가 전부 통과한다. 공백 아이템은 `extendRun`에서 run 폭(`x0`/`x1`)에 기여하지 않으므로 거터 계산도 오염되지 않는다.
- **다만 회귀 테스트가 0건이었다** → C5를 추가했다(§9).

---

#### ④ heading의 "위쪽 여백" 기준을 같은 컬럼의 직전 **흐름** 줄로 한정 — **조건부 타당**

- **없으면 정말 오판하는가: 그렇다.** 러닝 헤드(y=770) + 짧고 종결부호 없는 첫 본문 줄(y=700) + 본문 8줄 + 페이지 번호로 페이지를 만들고 기준을 spec 원문(직전 줄, 역할 무관)으로 되돌린 결과:

  ```
  [현재 구현]      첫 본문 줄 role = body    | 문단 1개
  [spec 원문]      첫 본문 줄 role = heading | 문단 2개 (본문이 제목으로 잘려 나감)
  ```

  spec 4-11 **P4("본문 줄이 헤더로 오판된 경우 0건")** 와 P7(문단)에 직접 걸린다. 머리말·꼬리말·페이지 번호는 본문 흐름에서 제외되는 줄인데 여백 계산의 기준으로 쓰면 컬럼 첫 줄의 여백이 **항상** 1.5×Lm을 넘는다. 보강이 옳다.
- **진짜 제목을 놓치는가: 컬럼 맨 위의 "본문과 같은 크기" 제목은 놓친다.** 실측:

  ```
  "Pathophysiology"(10pt, 페이지 첫 줄) + 본문 8줄
    → role = body, 문단 1개, 문단 text = "Pathophysiology body line number 1 of ..."
  "Pathophysiology"(10pt, 페이지 중간, 위 여백 20pt)
    → role = heading ○
  ```

  폰트 크기 규칙(≥1.15×Fm)은 그대로 살아 있으므로 **크기가 큰 제목은 위치와 무관하게 잡힌다**. 문제가 되는 것은 "본문과 같은 크기 + 컬럼 맨 위"인 제목뿐이고, 이때 제목이 뒤 문단에 흡수된다.
- **판정**: 오탐(본문→제목)은 P4의 명시적 실패 조건이고 미탐(제목→본문)은 수용 기준에 없다. 보수적 선택이 맞다. 다만 미탐이 "제목이 문단 텍스트에 섞여 낭독된다"는 실사용 품질 문제로 남으므로 §8 #2에 경미로 기록하고, 사용자가 P1·P7을 돌린 뒤 판단하도록 §7·§10에 넘긴다.
- 회귀 테스트가 0건이었다 → B9를 추가했다(§9).

---

#### ⑤ 문단 kind 판정에서 `answer`를 `question`보다 먼저 검사 — **타당**

- **spec 4-9·5-3과 모순되지 않는다.** 4-9는 kind 목록을 나열할 뿐 우선순위를 정하지 않았고, 5-3의 정답 정규식 `^(\d{1,3})\.\s+the answers? (is|are)\s+[A-E]` 는 문항 시작 `^\d{1,3}\.\s+\S` 의 **진부분집합**이다. 더 구체적인 패턴을 먼저 보는 것은 두 규칙이 모두 성립할 때의 유일하게 옳은 해석이며, 순서를 뒤집으면 `answer`가 **영원히 만들어지지 않는다**(코드에서 question을 먼저 검사하도록 바꿔 확인: 모든 해설이 `question`이 된다).
- **변형도 처리된다.** 실측:

  ```
  "1. The answer is A."                       → kind = answer
  "1. The answers are A and C"                → kind = answer
  "3. The answer is E. This patient has ..."  → kind = answer
  "12. Which of the following is correct"     → kind = question
  ```

  `isAnswerStart`는 `/^\s*\d{1,3}\.\s+the\s+answers?\s+(is|are)\s+[A-E]\b/i` 로 spec 5-3과 같다(다중 정답 `A and C`의 첫 글자에서 매칭 성립).
- **5절 파서(2단계 이후)가 이 순서를 전제해도 되는가: 된다.** 다만 전제가 테스트로 고정돼 있지 않았다 → B8을 추가했다(§9). 파서는 `kind`만 믿지 말고 spec 5-3의 정규식으로 번호·정답 글자를 **직접 재추출**하는 편이 안전하다(§10).

---

#### (부수) 4-8 블록 최소 길이 — **spec과 동일. 문제 없음**

코드 실제 경로(`blocks.js:295, 308-309`):

```js
if (block.length < P.TABLE_MIN_LINES_RELAXED) continue;      // 2 미만은 즉시 제외 (싼 선거름)
...
const minLines = signals >= P.TABLE_SIGNAL_MIN ? P.TABLE_MIN_LINES_RELAXED : P.TABLE_MIN_LINES;
if (block.length < minLines) continue;                        // 신호 2개 이상이면 2, 아니면 3
```

즉 **신호 <2 → 3줄 이상, 신호 ≥2 → 2줄 이상**으로 spec 4-8과 정확히 같다. 295행은 두 경우 모두에서 걸러지는 1줄 블록을 미리 쳐내는 선거름이라 판정을 바꾸지 않는다(`TABLE_MIN_LINES_RELAXED`를 1로 바꿔도 T2가 그대로 통과하는 것으로 확인). "항상 2줄 이상으로 강화"라는 Build의 표현은 이 선거름을 가리킨 것으로 보이며, **실제 동작은 spec 그대로**다.

---

## 2. 순수성·결정성

### 2-1. 금지 전역 참조 (16-A, 16-K)

```
$ grep -rnE "\b(document|window|fetch|indexedDB|pdfjsLib|navigator|localStorage)\b" apps/medreader/js/text/
(출력 없음 · exit 1)

$ grep -rn "from '\.\./ui/" apps/medreader/js/
(출력 없음 · exit 1)

$ grep -rnE "\.\./\.\./|['\"]/css/|['\"]/vendor/|['\"]/js/" apps/medreader/js/ apps/medreader/tests/ apps/medreader/dev/
(출력 없음 · exit 1)          # apps/medreader 경계를 넘는 참조 0건

$ grep -rnE "from '[^.]" apps/medreader/js/ apps/medreader/tests/ apps/medreader/dev/*.js
tests/*.test.mjs:  node:test, node:assert/strict, node:fs, node:url  (4파일)
                   # 그 외 0건 → text/*·dev/ 외부 라이브러리 의존 0
```

`dev/proto-lines.js`가 `../js/text/layout.js`·`../js/config.js`를 import 하는 것은 `/apps/medreader/` **안**이며 spec 4-11이 요구하는 정상 동작이다(위반 아님). pdf.js는 `dev/` 에서만 동적 `import()` 한다.

### 2-2. 결정성 — "우연히 같은 것"과 "결정적인 것"의 구분

실행 확인:

```
$ node scratchpad/determ.mjs
결정성 (3회 JSON.stringify 동일): true
입력 배열이 훼손되지 않았는가: true
```

소스를 읽고 확인한 것(자동 테스트가 못 보는 부분):

| 자리 | 확인 결과 |
|---|---|
| `clusterLines` 정렬 | `y desc → x asc → idx asc`. **비교 함수가 0을 반환할 수 있는 자리에 `idx` tie-breaker 있음** ○ |
| 줄 내 `items.sort` | `x asc → idx asc` ○ (`lines.js:236`, `columns.js:126`) |
| `byReadingY` | `baseline desc → lineX0 asc → lineMinIdx asc` ○ |
| `alignedColumns`의 `pts.sort` | `(a.x-b.x) || (a.line-b.line)` ○ |
| `median` 내부 `sort` | 숫자 비교, 동률은 값이 같으므로 무해 ○ |
| `detectColumns` band 선택 | `sum` 동률이면 `start`가 작은 쪽 — 명시적 ○ |
| `columnMetrics` 출력 정렬 | col 번호(숫자 아니면 1e6). 비숫자 col은 `'span'` 하나뿐이라 동률 없음. ES2019+ 안정 정렬로도 보장 ○ |
| `modeOf` | `Map`을 쓰지만 **키를 정렬한 뒤** 최빈값을 고르고 동률이면 작은 값 → 순회 순서 무의존 ○ |
| `Set`/`Map` 사용처 | `marked`(has/add), `neighborKeys`(has), `clusters[].lines`(size), `index`(삽입 순서=읽기 순서) — **순회 결과를 출력에 쓰는 곳 없음** ○ |

→ 결정성은 우연이 아니라 설계다. spec P10의 성질을 합성 데이터 범위에서 만족한다.

### 2-3. spec 3-3 데이터 타입 충족 (실제 출력 객체)

```
PageLayout 키: pageNo, width, height, algoVersion, lines, paragraphs, regions, columns, stats
  algoVersion = 1 (layout.js 의 export 와 동일)
  columns = {"count":2,"gutters":[306]}
  stats   = {"medianFontSize":10,"medianLeading":12,"bodyLeft":[72,340],"warn":null}
Line 키: id, text, bbox, baseline, fontSize, col, role, hyphenJoin, paraId, regionId, runs, items
  예: {"id":"23:13","text":"Aspirin 650 PO q4h","bbox":{...},"col":0,"role":"table","runs":4}
Paragraph 키: id, lineIds, kind, bbox, text, continuesNext, continuesPrev
  kind 분포(픽스처): {"body":2,"question":1,"option":5}   ※ answer/heading/list 는 별도 케이스로 확인
Region 키: id, kind, bbox, lineIds, pageNo
role 분포: {"header":1,"body":36,"table":4,"pageno":1}   (+ rotated 는 L11에서 확인)
```

spec 3-3의 필드가 **전부** 채워진다. `stats.warn`(4-5의 `multi-gutter`), `regionId`, `continuesNext/Prev`(4-9)는 spec 본문이 요구하는 추가 필드이고 3-3 목록의 누락은 없다.

---

## 3. spec 일치

### 3-1. 단계 함수 이름 대조 (spec 4-2 ~ 4-10, Build 지침 목록)

| 요구 이름 | 위치 | | 요구 이름 | 위치 |
|---|---|---|---|---|
| `normalizeItems` | lines.js ○ | | `lineBBox` | lines.js ○ |
| `clusterLines` | lines.js ○ | | `classifyRoles` | blocks.js ○ |
| `splitRuns` | lines.js ○ | | `detectTables` | blocks.js ○ |
| `detectColumns` | columns.js ○ | | `groupParagraphs` | blocks.js ○ |
| `reassignByColumn` | columns.js ○ | | `joinHyphen` | hyphen.js ○ |
| `orderLines` | columns.js ○ | | `splitSentences` | segment.js ○ |
| `joinText` | lines.js ○ | | `isQuestionStart`/`isOptionStart`/`endsSentence` | segment.js ○ |

16개 전부 존재. 추가 export(`sameLine`, `joinKind`, `newParagraph`, `pageMetrics`, `columnMetrics`, `bodyCandidates`, `normalizeRepeatKey`, `isAnswerStart`, `endsWithAbbrev`, `median`, `mad`, `clamp`, `isBlankItem`, `lineX0`, `lineMinIdx`, `joinParagraphText`)는 단계별 테스트를 가능하게 하는 것들로 spec 4-1의 요구("각 단계는 별도 함수(export)")에 부합한다.

### 3-2. `config.js` 파라미터 대조

| 파라미터 | spec 값 | 실제 값 | |
|---|---|---|---|
| `Y_TOL_FACTOR` | 0.35 | 0.35 | ○ |
| `Y_TOL_MIN` | 1.0 | 1.0 | ○ |
| `Y_TOL_MAX` | 6.0 | 6.0 | ○ |
| `SUPERSCRIPT_SIZE_RATIO` | 0.75 | 0.75 | ○ |
| `SUPERSCRIPT_DY_RATIO` | 0.6 | 0.6 | ○ |
| `SPACE_GAP_FACTOR` | 0.15 | 0.15 | ○ |
| `RUN_GAP_FACTOR` | 2.0 | 2.0 | ○ |
| `GUTTER_MIN_RATIO` | 0.55 | 0.55 | ○ |
| `GUTTER_BAND_LO` | 0.30 | 0.30 | ○ |
| `GUTTER_BAND_HI` | 0.70 | 0.70 | ○ |
| `SPAN_WIDTH_RATIO` | 0.6 | 0.6 | ○ |
| `MIN_BODY_LINES` | 8 | 8 | ○ |
| `PARA_LEADING_FACTOR` | 1.6 | 1.6 | ○ |
| `PARA_INDENT_FACTOR` | 0.8 | 0.8 | ○ |
| `PARA_SHORT_LINE_RATIO` | 0.70 | 0.70 | ○ |
| `TABLE_MIN_LINES` | 3 | 3 | ○ |
| `TABLE_LEADING_FACTOR` | 2.2 | 2.2 | ○ |
| `TABLE_COL_TOL_FACTOR` | 1.5 | 1.5 | ○ |
| `TABLE_ALIGN_RATIO` | 0.6 | 0.6 | ○ |
| `HEADER_ZONE` | 0.08 | 0.08 | ○ |
| `FOOTER_ZONE` | 0.08 | 0.08 | ○ |
| `PAGENO_ZONE` | 0.10 | 0.10 | ○ |
| `HEADING_SIZE_RATIO` | 1.15 | 1.15 | ○ |

**불일치 0건.** spec 4절에 없지만 4절 본문에서 유도된 값들은 전부 근거 주석과 함께 `LAYOUT`에 있다: `OVERLAP_FACTOR 0.5`(4-6의 `-0.5×fontSize`), `GUTTER_BINS 100`(4-5 "pageWidth/100"), `GUTTER_BAND_MIN_WIDTH_FACTOR 1.2`, `GUTTER_MIN_STARTS 4`, `GUTTER_MAD_FACTOR 3`, `BODY_FONT_LO/HI 0.7/1.4`, `LEADING_FALLBACK_FACTOR 1.2`, `TABLE_MIN_LINES_RELAXED 2`, `TABLE_SIGNAL_MIN 2`, `TABLE_FONT_LO/HI 0.8/0.95`, `HEADER_MAX_LEN 80`, `HEADER_FONT_RATIO 1.1`, `HEADER_UPPER_RATIO 0.6`, `FOOTER_MAX_LEN 120`, `FOOTER_FONT_RATIO 0.85`, `HEADING_MAX_LEN 60`, `HEADING_GAP_FACTOR 1.5`, `ROTATE_EPS 0.01`, `DEFAULT_ASCENT/DESCENT 0.8/-0.2`, `FALLBACK_FONT_SIZE 10`. spec 4절에 **없는** 것은 `SUPERSCRIPT_WIDTH_RATIO`·`SUPERSCRIPT_MAX_WIDTH_EM` 둘뿐이며 §1-4 ②에서 판정했다.

### 3-3. 하드코딩 검사

`text/*`에서 `config.js`를 거치지 않는 수치 파라미터 3곳을 찾았다(전부 **제안** 수준, §8 #10). 4-11이 요구한 슬라이더 4종(Y 허용·공백·run·거터)은 전부 `params` 인자로 흐르며 **프로토타입에서 실제로 재계산에 반영된다**(§4-3에서 실측).

### 3-4. pdf.js 버전

```
$ grep -rn "6\.3\.289" apps/medreader/ --include=*.js --include=*.html --include=*.mjs --include=*.css
apps/medreader/js/config.js:15:export const PDFJS_VERSION = '6.3.289';
```

버전 문자열은 **한 곳뿐**이고, 본체(`pdfjsMainUrl`)·worker(`pdfjsWorkerUrl`)·jsDelivr/cdnjs 두 base가 모두 그 상수에서 조립된다. 16-K 충족.

---

## 4. 프로토타입 페이지

### 4-1. 콘솔 (16-K: 에러·경고 0건)

`preview_start {name:"blog"}`는 포트 8000이 이미 `python.exe`(PID 32656)로 점유돼 있어 새로 띄우지 않고 그 서버를 그대로 썼다(`launch.json` 미수정).

**새 탭에서 `http://localhost:8000/apps/medreader/dev/proto-lines.html?items=/apps/medreader/tests/fixtures/synth-2col.json` 를 열었을 때 `read_console_messages` 결과: `No console logs.`** 재로드·슬라이더 조작·모바일 전환 후에도 동일하게 0건이었다. **실제 PDF 경로(§4-6: pdf.js CDN 로드 + canvas 렌더 + 전체 문서 통계 + items 내보내기)에서도 0건**이었다.

> 주의(오해 방지): **기존에 열려 있던 탭**에서는 `TypeError: Cannot read properties of undefined (reading 'addEventListener')` (proto-lines.js:419)가 2건 남아 있었다. 그 탭은 Build 세션이 남긴 것으로, 최종 커밋 이전 버전의 스크립트가 로드된 상태였다. 같은 URL을 **새 탭**으로 열고, 서버가 실제로 내려주는 `proto-lines.js` 419행이 `el.importItems.addEventListener(...)`이며 `document.getElementById('importItems')`가 정상 반환되는 것을 확인했다. **현재 커밋의 코드에는 이 오류가 없다.**

### 4-2. spec 4-11 프로토타입 요구 체크리스트

| 요구 | 확인 방법 | 결과 |
|---|---|---|
| PDF 파일 열기 | `<input type=file id=fileInput>` + `openBuffer` (같은 `openBuffer`를 `?pdf=`로 실행) | ○ §4-6 |
| 페이지 번호 입력 | `<input type=number id=pageNo>` + ◀▶ | ○ |
| canvas 렌더 | `page.render` + dpr 스케일 | ○ §4-6 (canvas 653×845 실렌더) |
| bbox 오버레이 — 본문 파랑 | `.hl{border:var(--body) #2563eb}` · 화면 확인 | ○ |
| — 헤더/푸터/페이지번호 회색 | `.hl.role-header/footer/pageno` `--meta #98a2b3` · DOM 2개 | ○ |
| — 표 주황 | `.hl.role-table` `--table #ea8c00` · DOM 4개 | ○ |
| — 거터 세로 점선 | `.hlGutter{border-left:2px dashed #dc2626}` · DOM 1개 | ○ |
| (추가) 위첨자 합류 표시 | `.hlSup` 보라 · DOM 1개 | ○ |
| 읽기 순서 줄 목록(번호·col·role·fontSize·runs) | `#0 col=0 header fs=9.0 runs=1` 형식 실측 | ○ |
| 문단 경계 가로줄 | `li.paraStart{border-top:2px solid}` · 8개 = 문단 8개와 일치 | ○ |
| 하이픈 결합 굵게 | `.hy{font-weight:700}` · `cardio-` 에만 적용 | ○ |
| `hasEOL` 불일치 노란색 | `li.eolMismatch{background:#fde68a}` — 힌트가 있는 문서에서만 켜짐 | ○ §4-6 (합성 PDF에서 힌트 감지 → 노란 줄 2개 표시) |
| 파라미터 슬라이더 4개 이상 | Y 허용·공백·run·거터 + [기본값] | ○ (4개) |
| items JSON 내보내기 | Blob + `a.download` | ○ §4-6 (`items-p1.json` 다운로드 완료. 레포 안에 생기지 않는다) |
| items JSON 불러오기 | `<input type=file id=importItems>` + `?items=` | ○ (실측) |
| 전체 문서 통계 모드 | `runStats()` 페이지별 {줄·컬럼·표·헤더/푸터·경고} + `tr.outlier` 강조 | ○ §4-6 (2쪽 순회 완료) |
| `../js/text/layout.js` import(복사 금지) | `import { buildPageLayout } from '../js/text/layout.js'` | ○ 알고리즘 복사 0줄 |
| 동적 텍스트 `textContent` | `grep innerHTML|insertAdjacentHTML|outerHTML|document.write` → **0건** | ○ |

### 4-3. 픽스처 실동작 (지침 15번)

`?items=/apps/medreader/tests/fixtures/synth-2col.json` 로 확인. 요약 줄: `p23 · 줄 42 · 컬럼 2 · 문단 8 · 표 1 · Fm 10.0 · Lm 12.0 · 1.3ms`

| 확인 항목 | 결과 |
|---|---|
| 2단이 좌→우 순서로 나오는가 | ○ 좌 컬럼 전부(#1~#20대) 뒤에 우 컬럼. `col=0` 마지막 인덱스 < `col=1` 첫 인덱스 |
| `"poses the least cardiovascular risk"` 에 공백이 있는가 | ○ 줄은 `"poses the least"` / `"cardiovascular risk"` 2줄, 문단 텍스트에 공백 결합. `leastcardiovascular` 0건 |
| 표 영역이 orange로 잡히는가 | ○ `.hl.role-table` 4개, 목록에서 `Aspirin 650 PO q4h` 등 4줄이 주황, region 1개(`23:t0`) |
| 러닝 헤드·페이지 번호가 header/pageno인가 | ○ `SECTION I PRINCIPLES OF CLINICAL MEDICINE` → header, `23` → pageno (둘 다 회색, 문단에서 제외) |
| `"cardio-" + "vascular"` → `cardiovascular` | ○ `cardio-` 줄이 굵게 표시되고 문단 텍스트는 `cardiovascular disease remains ...` |

**스크린샷: 파일로 저장하지 않았다.** 내장 브라우저 도구에는 파일 저장 기능이 없다. **세션 브라우저 패널에서 직접 확인**했으며(데스크톱 1200×900, 모바일 375×812 두 가지), 위 표의 각 항목은 DOM 실측값으로 뒷받침된다.

### 4-4. 슬라이더 실동작 (지침 16번 = 11번의 진짜 판정)

먼저 Node에서 픽스처에 대한 파라미터 민감도를 훑어 **눈에 보이는 변화가 생기는 값**을 찾았다(`RUN_GAP_FACTOR = 5` → 표 0개·문단 7개·runs 합 42). 그 값을 브라우저 슬라이더로 넣었다:

```
before   p23 · 줄 42 · 컬럼 2 · 문단 8 · 표 1   runs합 54, 주황 박스 4개
run 계수 = 5.0 →
after    p23 · 줄 42 · 컬럼 2 · 문단 7 · 표 0   runs합 42, 주황 박스 0개
[기본값] →
reset    p23 · 줄 42 · 컬럼 2 · 문단 8 · 표 1   runs합 54, 주황 박스 4개
```

Node 예측값과 **정확히 일치**한다. 슬라이더 → `currentParams()` → `buildPageLayout(..., params)` → 목록·오버레이 재그리기 경로가 실제로 동작한다. (나머지 세 슬라이더는 이 픽스처가 "한 줄 = 아이템 1개" 구조라 결과가 바뀌지 않는다 — 배선이 아니라 픽스처의 한계다. §8 #11)

### 4-6. 합성 PDF로 실제 pdf.js 경로 검증 (추가 확인)

Build가 스크래치패드에 남긴 합성 PDF(`scratchpad/synth.pdf`, 표준 14폰트 Helvetica 2쪽, **레포 밖**)가 아직 남아 있고 같은 스크래치패드의 CORS 서버(127.0.0.1:8010)가 떠 있어, `?pdf=http://localhost:8010/synth.pdf` 로 **PDF 경로 전체를 직접 태웠다**. 이것은 원서 PDF가 아니므로 P1~P11을 대신하지 못한다(§7).

- pdf.js **CDN(jsDelivr) 로드 성공** → `2쪽` 인식 → canvas **653×845 실렌더** → 레이아웃 1.5ms. **콘솔 0건.**
- 요약: `p1 · 줄 36 · 컬럼 2 · 문단 8 · 표 1 · Fm 10.0 · Lm 12.0`
- 역할 분포: `{header:1, heading:1, figure-caption:1, body:28, table:4, pageno:1}` — **`heading`·`figure-caption` 이 실제 문서에서 나오는 것을 처음 확인**했다(픽스처에는 없었다).
- 읽기 순서 앞부분(실측):

  ```
  #0  col=0    header         "SECTION I PRINCIPLES OF CLINICAL MEDICINE"
  #1  col=span heading        "CHAPTER 1 THE PRACTICE OF CLINICAL MEDICINE TODAY"
  #2  col=0    body           "Errors in the delivery of health"
  ...
  #7  col=0    body           "poses the least"
  #8  col=0    body           "cardiovascular risk1"      ← 위첨자 1 이 줄에 합류(.hlSup 1개)
  #11 col=0    body           "older patients with cardio-"
  #12 col=0    body           "vascular disease stays modest"
  #16 col=0    figure-caption "TABLE 1-1 Common Analgesic Doses"
  #17 col=0    table  runs=4  "Aspirin 650 PO q4h"
  ```

- 문단 텍스트 검사: `"poses the least cardiovascular risk"` **공백 있음 ○**, `leastcardiovascular` **0건 ○**, `"cardiovascular disease"` 하이픈 결합 ○, `Choose` 정상 / `whoose`·`wlinical` 0건(다만 이 PDF는 CID 서브셋이 아니라 Helvetica라 **P11의 근거로는 약하다**).
- **`hasEOL` 불일치 노란색이 실제로 켜졌다** — 이 PDF에는 pdf.js가 EOL 힌트를 붙이고, 클러스터링 결과와 어긋나는 줄 2개가 노란 배경으로 표시됐다(픽스처로는 확인할 수 없던 항목).
- **전체 문서 통계 모드 실행**: `통계 완료: 2쪽`, 표 출력 `1 | 36 | 2 | 1 | 2 |` / `2 | 36 | 2 | 1 | 2 |`, 이상치 0행.
- **items JSON 내보내기 실행**: `items-p1.json` 다운로드 성공(브라우저 다운로드 폴더. 레포 안에는 생기지 않는다 — §5의 `git status`로 확인).

스크린샷은 파일로 저장하지 않았다(내장 브라우저 도구에 저장 기능 없음). **세션 브라우저 패널에서 직접 확인**했고, 위 값들은 전부 DOM/객체 실측이다.

### 4-5. 모바일 375px — **결함 발견, 내가 고침**

`resize_window {preset:"mobile"}` (375×812)로 확인:

- 가로 스크롤: **없음** (`scrollWidth 375 === clientWidth 375`, 넘치는 요소 0개) ○
- 그러나 **읽기 순서 줄 목록이 통째로 보이지 않았다.** `.paneRight` 의 `clientHeight = 0`, `scrollHeight = 1983`.
  원인: `.pane{flex:1 1 0}` + `.paneRight{overflow:auto}` 조합에서 `@media (max-width:900px){.panes{flex-direction:column}}`로 주축이 세로가 되면, `overflow:auto` 때문에 `min-height:auto`의 자동 최소 크기가 0이 되어 높이가 0으로 접힌다. **900px 이하 모든 화면**에서 프로토타입의 오른쪽 절반(줄 목록 = 이 페이지의 핵심 출력)이 사라진다.
- 수정(§9): 미디어 쿼리에서 `.paneRight`에 `overflow: visible; flex: 0 0 auto;` 추가.
- 수정 후 재확인: 375px에서 `clientHeight 1983`, 가로 스크롤 여전히 없음, 줄 목록 42줄이 세로로 이어져 보이고 주황 표 줄·굵은 하이픈·문단 구분선이 정상 표시. 1200px 데스크톱은 종전대로 좌우 2단 + `max-height:80vh` 스크롤(영향 없음).

---

## 5. 구조·위생 (16-K)

```
$ git status --porcelain          # 검증 시작 시점
?? .codex/
?? AGENTS.md                      # 둘 다 세션 시작 전부터 있던 미추적 파일

$ git show --stat --oneline edf64dd
 apps/medreader/dev/proto-lines.{css,html,js}
 apps/medreader/js/config.js
 apps/medreader/js/text/{blocks,columns,hyphen,layout,lines,segment}.js
 apps/medreader/tests/{blocks,columns,hyphen,layout,lines}.test.mjs
 apps/medreader/tests/fixtures/synth-2col.json
 16 files changed, 3759 insertions(+)
```

- **허용 범위 밖 수정 0건.** Build 커밋은 `apps/medreader/` 안만 건드렸다. 블로그 본체(`index.html`, `post.html`, `css/`, `js/`, `posts/`, `vendor/`)·`apps/2048/`·`.claude/` 미수정.
- `spec.md`는 Build 커밋이 아니라 **지침 커밋 `aaa622d`**(pdf.js 버전 확정, 오케스트레이터 작업)에서만 바뀌었다. Build 에이전트의 spec 수정 0건.
- `.nojekyll` **존재**(0바이트, 2025-08-27). 삭제되지 않았다.
- 레포 안 `*.pdf` / `node_modules` / `package.json`: `git ls-files` 및 파일 시스템 검색 모두 **0건**.
- `text/*`·`tests/` 외부 라이브러리 의존 0건(§2-1).
- 오탐 주의(지침 24번): `dev/proto-lines.js` → `../js/text/layout.js` 는 `/apps/medreader/` 안이므로 정상이며 요구사항이다. 위반으로 세지 않았다.

---

## 6. 성능

방법: 2,000 아이템(100행 × 20아이템, 2단 배치) 합성 페이지를 워밍업 20회 후 100회 호출한 평균.

```
성능: 2,000 아이템 평균 2.75 ms/페이지     ← spec P9 목표 15ms
스케일링 (O(n²) 탐지):
  n=  500 → 0.63 ms
  n= 1000 → 1.30 ms
  n= 2000 → 2.76 ms
  n= 4000 → 5.24 ms
  n= 8000 → 12.21 ms
```

n이 16배가 되는 동안 시간은 약 19배 — **거의 선형**(O(n log n)). O(n²) 경로 없음. 테스트 러너 안에서도 2.9~3.1ms로 재현된다. 병목 없음.

> 참고: `detectTables`의 "표 사이에 낀 1-run 줄 포함" 루프는 블록마다 `colLines` 전체를 훑어 형식상 O(블록수 × 줄수)다. 표가 여러 개인 페이지에서도 블록 수가 작아 실측에 나타나지 않지만, 표가 수십 개인 병적 페이지에서는 유일한 2차 후보다(§8 #12, 제안).

---

## 7. P1~P11 (실제 PDF) — 사용자 검증 대기

**이 기기에 원서 PDF가 없다.** 합성 PDF(Helvetica 2쪽, §4-6)로 pdf.js 경로 자체는 태웠지만, 그것은 원서의 Type0 CID 서브셋 폰트·실제 조판·729쪽 분량을 대신하지 못한다. 아래는 "내가 합성 데이터로 확인한 범위"와 "사용자가 실제 PDF로 확인해야 할 것"의 구분이다. 못 한 것을 했다고 적지 않았다.

| P | 내가 합성 데이터로 확인한 것 | 사용자가 실제 PDF로 확인할 것 |
|---|---|---|
| P1 줄 수 정확도 | 합성 페이지에서 예상 줄 수와 정확히 일치(C1 40줄, C2 41줄, 픽스처 42줄). 컬럼 맨 위 제목이 본문에 흡수되는 경우가 있음(§1-4 ④) | 무작위 10페이지 눈으로 센 줄 수와 ±2줄/합계 3% |
| P2 컬럼 병합 0건 | **C1·C2·C5·F1로 확인.** 특히 C5(거터 공백 아이템)는 spec 원문대로면 병합이 일어나는 케이스 | 실제 2단 페이지 10장 |
| P3 단어 붙음 0건 | **L6·F1.** `leastcardiovascular` 0건을 단언으로 고정 | 10페이지 문단 텍스트에 `[a-z][A-Z]`·20자 이상 미등재 단어 grep |
| P4 헤더·푸터·페이지번호 | B1·B2·B9·F1. **B9가 "본문이 header/heading으로 오판되지 않음"을 고정** | 10페이지 러닝 헤드·페이지 번호 제외 + 본문 오판 0건 |
| P5 표 | T1·T2·C3·F1(4열 약물 용량 표 감지, 표 없는 페이지 오탐 0) | 실제 `Acetylsalicylic acid` 표 + 크롭 잘림 없음 + 본문 10페이지 오탐 0건. **run 과분할이 표 오탐을 부르는지도 함께 볼 것**(§8 #6) |
| P6 읽기 순서 | C1·C2·F1(밴드 순서 41줄 전수 대조) | 2단 페이지 3장에서 문항 번호가 1,2,3… 순으로 |
| P7 문단 | B3~B7·B8(문항/보기/정답 kind) | 문항 1개 = 질문 1 + 보기 5, 해설이 문장 중간에서 갈리지 않음 |
| P8 하이픈 | H1~H5 + 문단 단위 결합 | 10페이지에서 오결합 ≤1건 |
| P9 성능 | **평균 2.75ms/페이지(목표 15ms), 선형 스케일링** — 레이아웃 계산분은 충족 | 729p 전체 순회 ≤90초(추출 포함), 실기기 ≤5분·첫 페이지 ≤3초 |
| P10 결정성 | **D1 + 3회 반복 + 정렬/Map·Set 소스 감사**(§2-2) | 같은 페이지 2회 처리 JSON 동일 |
| P11 글리프 | **사실상 검증 불가** — §4-6에서 pdf.js `getTextContent()` 경로를 실제로 태워 `Choose` 정상·`whoose`/`wlinical` 0건을 봤지만, 그 PDF는 **표준 Helvetica**라 CID 뒤섞임이 애초에 일어날 수 없다. 코드가 직접 파싱을 전혀 하지 않는 것은 확인 | `Choose`/`Clinical` 정상, `whoose`/`wlinical` 0건 — **원서(Type0 CID 서브셋)로만 의미 있음** |

**사용자 실행 절차** (5줄):
1. 레포 루트에서 `python -m http.server 8000` → `http://localhost:8000/apps/medreader/dev/proto-lines.html` 을 데스크톱 Chrome으로 연다.
2. [PDF 열기]로 원서를 고르고 페이지 번호를 옮겨 가며 오른쪽 줄 목록과 왼쪽 오버레이를 비교한다(P1·P2·P4·P6).
3. [전체 문서 통계]로 한 바퀴 돌려 `tr.outlier`(줄 수 0·컬럼 판정 튐·경고)를 먼저 본다.
4. P2 실패 → `run 계수`를 낮춘다 / `거터 임계`를 낮춘다. P3 실패 → `공백 계수`를 낮춘다. 줄이 갈라지면 `Y 허용 계수`를 올린다.
5. 문제 페이지에서 [items JSON 내보내기] → `tests/fixtures/`에 넣어 회귀 테스트로 굳힌다(원서 텍스트 분량 1~2페이지 제한).

---

## 8. 발견한 문제

| # | 심각도 | 위치 | 문제 | 근거 | 조치 |
|---|---|---|---|---|---|
| 1 | **경미** | `dev/proto-lines.css:105-107` | 900px 이하에서 `.paneRight`가 높이 0으로 접혀 **읽기 순서 줄 목록이 보이지 않는다**. 프로토타입의 핵심 출력이 모바일에서 사라진다 | 375px에서 `clientHeight 0 / scrollHeight 1983`. `flex:1 1 0` + `overflow:auto` 로 자동 최소 크기가 0 | **내가 고침** (§9) |
| 2 | 경미 | `js/text/blocks.js:150-210` | 컬럼/페이지 맨 위의 "본문과 같은 폰트 크기" 제목이 heading으로 잡히지 않고 다음 문단에 흡수된다 | 실측: `"Pathophysiology"`(10pt) 가 페이지 첫 줄이면 role=body, 문단 텍스트가 `"Pathophysiology body line number 1 ..."` | 보류 — 반대편(본문→heading 오판)이 P4 위반이라 현재 선택이 더 안전하다. P1·P7 사용자 검증 후 판단 |
| 3 | 경미 | `js/text/lines.js:255-296` | `absorbSmallLines`가 이론상 "큰 제목 + 바로 아래 짧은 본문 조각"을 흡수할 수 있다 | 14pt 제목 기준 실측 경계: 조각 폭 ≤35pt **그리고** baseline 차 ≤8.4pt. 실제 조판에서 도달하기 어렵다 | 보류 — 반례를 만들지 못했다. P1에서 재확인 |
| 4 | 제안 | `tests/lines.test.mjs` L5 | L5가 "상한 6pt 적용 확인"을 주장하지 못한다. 20pt·행간 22pt는 상한이 없어도(0.35×20=7pt) 갈라진다 | `Y_TOL_MAX`를 30으로 바꿔도 34개 전부 통과 | **내가 고침** — L5b 추가(§9) |
| 5 | 제안 | `tests/lines.test.mjs` L9 / `js/text/lines.js:398` | L9가 구조적으로 실패할 수 없다. `joinText` 말미의 `replace(/\s+/g,' ')` 가 이중 공백을 무조건 접기 때문 | `!cur.str.startsWith(' ')` 가드를 제거해도 L9 통과 | 보류 — **동작은 옳다**(공백 하나만 나온다). 가드는 방어적 중복. 테스트를 의미 있게 고치려면 `joinText` 계약을 바꿔야 해서 손대지 않았다 |
| 6 | 제안 | `tests/` 전반 | run **과분할**(간격 임계가 너무 작을 때)을 잡는 테스트가 없다. `RUN_GAP_FACTOR`를 0.05로 낮춰도 38개 전부 통과 | 픽스처가 대부분 "한 줄 = 아이템 1개"라 내부 간격이 없다 | 보류 — 실제 PDF(P5)에서 확인. 과분할은 본문 줄을 표로 오탐시킨다 |
| 7 | 제안 | `js/text/columns.js:110-112` | spec 4-5 (d)의 MAD 좌변 정렬 검사가 어떤 테스트에도 걸리지 않는다. `GUTTER_MAD_FACTOR`를 0으로 해도 전부 통과(합성 컬럼은 MAD가 정확히 0) | 파손 테스트 | 보류 — 실제 PDF에서 이 가드가 C3류 오탐을 막는 최후 방어선이다 |
| 8 | 제안 | `js/text/blocks.js:388` | spec 4-9의 "짧은 마지막 줄" 문단 분리 규칙에 테스트가 0건. `PARA_SHORT_LINE_RATIO`를 0.01로 해도 전부 통과 | 파손 테스트 | 보류 — P7에서 확인 |
| 9 | 제안 | `js/text/blocks.js:196` | spec 4-7의 `fontSize ≥ 1.15×Fm → heading` 규칙에 직접 테스트가 0건. `HEADING_SIZE_RATIO`를 3.0으로 해도 전부 통과 | 파손 테스트. C2의 14pt 제목은 읽기 순서만 검증하고 role은 보지 않는다 | 보류 — spec 4-11 표에 heading 케이스가 없다. 런타임 동작 자체는 §4-6에서 확인했다(`CHAPTER 1 …` → `heading`, `TABLE 1-1 …` → `figure-caption`). 2단계 이후 리플로우 뷰가 role을 쓰기 시작할 때 테스트 추가 권장 |
| 10 | 제안 | `lines.js:279`, `blocks.js:64`, `blocks.js:329` | `config.js`를 거치지 않는 수치: 흡수 X범위 여유 `2 * T.fontSize`, 행간 이상치 상한 `5 * Fm`, 표 bbox 포함 여유 `±1`(pt) | 소스 읽기 | 보류 — 슬라이더 4종에는 포함되지 않는 내부 상수다. 튜닝이 필요해지면 `LAYOUT`으로 올릴 것 |
| 11 | 제안 | `tests/fixtures/synth-2col.json` | 픽스처가 "한 줄 = 아이템 1개" 구조라 Y 허용·공백 계수 슬라이더가 결과를 바꾸지 못한다(민감도 0) | Node 스윕: 4개 슬라이더 중 run 계수만 결과를 바꾼다 | 보류 — 실제 PDF 픽스처가 들어오면 자연히 해소된다 |
| 12 | 제안 | `js/text/blocks.js:326-334` | 표 블록마다 컬럼 전체 줄을 훑는 루프(형식상 O(블록수×줄수)). 현재 실측에는 나타나지 않음 | 성능 스케일링 측정 | 보류 |
| 13 | 제안 | `dev/proto-lines.js:479` | `window.__proto = state`. spec 16-K는 전역 노출을 `window.__medreader` 하나로 제한한다 | grep | 보류 — dev 전용 페이지이고 앱 본체가 아니며 키를 노출하지 않는다. 앱 본체에는 넣지 말 것(§10) |

**차단 문제: 0건.**

"문제 없음"으로 판단한 것과 그 근거는 §2(순수성·결정성: grep + 소스 감사 + 3회 반복), §3(파라미터 23개 1:1 대조 + 버전 문자열 유일성 grep), §5(커밋 파일 목록 + `git ls-files` 금지 패턴 검색), §6(스케일링 5점 측정)에 각각 명령과 출력으로 적었다.

**프로세스 관찰(문제 아님, 기록용)**: Build 지침은 "설계와 다르게 구현해야 할 이유가 생기면 구현은 spec대로 하고 보고서에 이견을 적어라"였는데, Build는 5건을 구현 단계에서 보강하고 신고했다. 다만 그중 4건은 **spec대로 구현하면 spec 자신의 수용 기준(L4·P2·P4)이 깨지는** 자리였음을 내가 재현으로 확인했다. 결과적으로 옳은 판단이었고, spec 4-3·4-4·4-7을 다음 개정에서 이 내용으로 갱신할 것을 §10에 제안한다(spec 수정은 사용자 승인 사항이라 손대지 않았다).

---

## 9. 내가 고친 것

### (1) `apps/medreader/dev/proto-lines.css` — 모바일에서 줄 목록이 사라지는 결함

```css
@media (max-width: 900px) {
  .panes { flex-direction: column; }
  /* 세로로 쌓일 때 .pane 의 flex:1 1 0 과 overflow:auto 가 만나면
     자동 최소 높이가 0이 되어 줄 목록이 통째로 잘린다(높이 0).
     내용 높이를 그대로 쓰도록 되돌린다. */
  .paneRight { max-height: none; width: 100%; overflow: visible; flex: 0 0 auto; }
}
```

이유: §4-5. 375px에서 `clientHeight 0 → 1983`으로 복구, 가로 스크롤 없음, 1200px 데스크톱 레이아웃은 영향 없음(미디어 쿼리 안에서만 바뀐다).

### (2) `apps/medreader/tests/lines.test.mjs` — `L5b` 추가

L5가 "Y 허용 상한 6pt"를 주장하지 못한다(§8 #4). 40pt 제목 두 줄·행간 13pt는 상한이 없으면(0.35×40=14pt) 한 줄로 합쳐진다. 추가 후 `Y_TOL_MAX`를 30으로 바꾸면 **L5b가 실패**하는 것을 확인했다.

### (3) `apps/medreader/tests/columns.test.mjs` — `C5` 추가

Build 이탈 ③(run 간격 기준)이 spec 4-11 P2를 지키는 핵심인데 회귀 테스트가 0건이었다(§1-4 ③). 거터에 폭 있는 공백 아이템이 낀 2단 페이지를 넣어 `columns.count === 2` 와 "좌·우가 한 줄로 병합되지 않음"을 고정했다. `splitRuns`를 spec 원문 `items[i-1]`로 되돌리면 **C5가 실패**한다.

### (4) `apps/medreader/tests/blocks.test.mjs` — `B8`, `B9` 추가

- **B8**: Build 이탈 ⑤(answer > question 우선순위)에 테스트가 0건이었다. `"1. The answer is A. ..."`·`"2. The answers are A and C ..."` → `answer`, `"12. Which of the following ..."` → `question` 을 고정. 순서를 뒤집으면 **B8이 실패**한다. 2단계 이후 5절 파서가 이 전제 위에 서기 때문에 반드시 고정돼야 한다.
- **B9**: Build 이탈 ④(heading 여백 기준)에 테스트가 0건이었다. 러닝 헤드 아래 첫 본문 줄이 `body`로 남고 문단이 쪼개지지 않음을 고정. 기준을 spec 원문(직전 줄, 역할 무관)으로 되돌리면 **B9가 실패**한다.

알고리즘 코드(`js/`)는 **한 줄도 고치지 않았다.** 취향 리팩터링·이름 변경·스타일 통일도 하지 않았다. 최종 상태: `node --test "apps/medreader/tests/*.test.mjs"` → **tests 38 / pass 38 / fail 0**. 커밋·푸시하지 않았다.

---

## 10. 2단계에 넘길 주의사항

1. **`pages` 스토어에 `line.items`를 저장하지 말 것.** `buildPageLayout`의 출력 `Line`에는 `items`가 그대로 들어 있다(spec 3-3의 계약대로다). spec 18절은 "아이템 미저장, 줄·문단만"으로 용량 5~8배 차이를 든다. `pdf/extract.js`가 IndexedDB에 넣기 전에 `items`를 떼어내되, **원본 뷰 오버레이·표 AI 재구성에 필요한 `runs`(x0/x1/text)와 `bbox`는 반드시 남겨야** 한다. `algoVersion`(현재 1)과 `roleVersion`도 같이 저장해 재추출 판단에 쓴다.

2. **`neighborLayouts`는 "이미 저장된 PageLayout"을 그대로 넣으면 된다.** `classifyRoles`는 이웃의 `lines[].{text, role, baseline}` 과 `height`만 읽고, `groupParagraphs`는 이웃의 `paragraphs[].{kind, continuesNext}` 와 `pageNo`만 읽는다(항목을 떼어낸 축소본으로 충분). 이웃 없이 먼저 추출한 페이지는 header/footer가 "대문자 비율·SECTION/CHAPTER" 경로로만 판정되므로, spec 4-7대로 **이웃이 생긴 뒤 역할만 재계산해 `roleVersion`을 올리는 경로**를 2단계에서 반드시 넣어야 한다(B2가 이 동작을 고정하고 있다).

3. **5절 파서는 `paragraph.kind`만 믿지 말 것.** `kind`는 문단 **첫 글자열** 한 줄로 판정되며, 정답/문항 판정 순서(answer 우선)는 지금 B8이 고정하고 있다. 파서는 spec 5-3의 정규식으로 번호·정답 글자를 직접 재추출하고 **번호 연속성**으로 검증해야 한다. 또한 컬럼 맨 위의 같은 크기 제목이 본문 문단에 섞여 들어올 수 있으므로(§8 #2), 섹션 경계 판정에서 `heading` role에만 의존하지 말고 `header` 텍스트 변화도 함께 볼 것.

4. (부수) 앱 본체의 전역 노출은 `window.__medreader` **하나**로 제한할 것(16-K). `dev/proto-lines.js`의 `window.__proto`는 dev 페이지 전용이며 본체로 옮기지 말 것.
