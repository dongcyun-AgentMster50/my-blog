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

---
---

# Review — MedReader 1b단계 (컬럼 검출 수정)

- 검증일: 2026-09-18
- 검증 대상 커밋: `7260b02 Build 1b: 컬럼 검출 수정 — 2단 판정 45→216쪽, 손상 3종 소멸` (브랜치 `claude/medreader-spec-planning-i8ge24`)
- 직전 상태: `e7e13fd`
- 검증 환경: Windows 10 Pro 19045 / Node **v24.14.0** / Chromium(내장 브라우저 패널) / 실제 원서 `ILMA_2021_20th_ed_Harrison.pdf` 729쪽 (pdfjs-dist 5.4.149 `legacy/build/pdf.mjs`, 스크래치패드)
- 기준 문서: `spec.md` 4-4·4-5·4-10·4-11·16-A·16-K·3-3·9-4·20절, `.claude/tasks/medreader-build-1b.md`

**나는 Build 의 수치를 신뢰하지 않고, 검출기 내부 로직을 전혀 쓰지 않는 독립 측정기를 새로 만들어 대조했다**(§1b-2).

---

## 종합 판정 (1b)

**조건부 통과** — 차단 문제 0건, 중간 1건, 경미 2건, 제안 3건, 이월 1건.

→ **2단계(`db.js`·`hash.js`·`pdf/loader.js`·`pdf/extract.js`)로 진행해도 되는가: 예.**

근거(전부 내가 직접 측정한 값이다):

- 이 수정은 **실재하는 대규모 결함을 실제로 고쳤다.** 검출기와 독립된 잉크 투영 측정으로 "진짜 거터를 가로지른 최종 줄"을 세면 **4,196줄 / 199쪽 → 105줄 / 10쪽**, 그중 문단 텍스트에 들어간 줄은 **1,379 → 36**이다(§1b-2). 이것은 spec 4-11 P2 그 자체의 직접 측정이다.
- **오탐 사냥 결과 "1단인데 2단으로 잘못 쪼개진" 텍스트 손상 쪽은 찾지 못했다.** 216쪽 중 거터 위치에 잉크가 있는 20쪽을 전수 추출해 15쪽을 줄 텍스트로 직접 확인했다(§1b-3). 오탐 의심은 전부 (a) 전폭 FIGURE 캡션이 `span` 으로 옳게 처리된 경우이거나 (b) 표·속표지·목차처럼 **본문 손상이 없는** 경우였다.
- P6(읽기 순서)도 독립 재현했다: 문항 번호가 역행하는 쪽 **39/324 → 8/448**.
- 표 오탐이 급증하지 않았다. region 800→271 은 **손실이 아니라 오탐 제거**다 — `TABLE X-n` 캡션이 있는 149쪽 중 region 감지는 **98 → 101 로 오히려 늘었고**, region 이 사라진 151쪽 중 캡션이 있는 쪽은 **1쪽(p699)뿐**이다(§1b-5).
- 새 테스트 C6·C8·C9 와 기존 임계 모두 **의도적 파손으로 이빨을 확인**했다. 네 가지 파손이 각각 정확히 한 케이스를 실패시킨다(§1b-6).
- 성능 0.64ms/쪽 (P9 상한 15ms), 결정성 40쪽 3회 동일, 순수성 grep 0건, 범위 준수, `TODO(human)` 미변경(§1b-7).

**다만 `GUTTER_MIN_CROSSING: 8` 은 근거가 실측과 어긋나며, 남은 병합 10쪽 중 5쪽의 유일한 원인이다**(§1b-4, §8b #1). 차단은 아니지만 2단계 착수 전에 사용자 판단을 받는 것이 좋다.

---

## 1b-1. 단위 테스트 재실행

```
$ node --test "apps/medreader/tests/*.test.mjs"
ℹ tests 43   ℹ pass 43   ℹ fail 0   ℹ duration_ms 596.9
```

43개 전부 통과. 기존 38개의 **기대값이 바뀌지 않았음**을 diff 로 확인했다:

```
$ git diff e7e13fd..7260b02 -- apps/medreader/tests/
columns.test.mjs | 88 +++++++++++++++  (@@ -121,3 +121,91 @@ — 끝에 append 만)
hyphen.test.mjs  | 25 ++++++++++       (@@ -6,6 +6,7 @@ import 1줄 + @@ -69,3 +70,27 @@ append)
```

삭제 줄은 **hyphen.test.mjs 의 import 한 줄을 늘린 것 외에 0건**이다. 기존 케이스 수정·완화 없음.

---

## 1b-2. 독립 측정기 — Build 의 지표를 쓰지 않는다 ★

Build 와 오케스트레이터가 쓴 지표(2단 판정 쪽 수, 소문자-대문자 패턴, P6)는 **모두 검출기의 출력에 의존**한다. 검출기가 틀리면 지표도 같이 틀린다. 그래서 `columns.js` 를 한 줄도 쓰지 않는 측정기를 새로 만들었다.

**방법** (`scratchpad/diag/rv_p2.mjs`) — pdf.js 원시 items 만으로:

1. 회전·공백 아이템을 뺀 본문 아이템(상하 8% 밖, 폰트 중앙값 0.7~1.4배)을 1pt 격자에 x-투영해, 각 x 를 덮는 **서로 다른 baseline 행 수** `cov[x]` 를 만든다.
2. 페이지 중앙부(0.30~0.70W)에서 `cov == 0` 인 가장 넓은 연속 구간을 찾는다. **폭 10pt 이상이고 양쪽에 각각 10행 이상**이면 그 페이지에는 "진짜 거터 밴드"가 있다.
3. 최종 `PageLayout.lines` 중 **그 밴드 양쪽에 아이템을 모두 가진 줄**을 센다. = 좌·우 컬럼이 한 줄로 병합된 줄. **이것이 spec 4-11 P2 의 직접 측정이다.**

전폭 제목·캡션은 밴드에 잉크를 남기므로 2번에서 밴드 자체가 사라진다 — 즉 정상적인 전폭 요소는 이 지표에 오르지 않는다.

**결과 (729쪽 전수, 동일 스크립트를 두 커밋에 각각 돌림)**

| 지표 | `e7e13fd` (수정 전) | `7260b02` (수정 후) | 측정 주체 |
|---|---:|---:|---|
| 진짜 거터 밴드가 있는 쪽 | 205 | 205 | **독립**(검출기 무관) |
| **거터를 가로지른 최종 줄 = P2 위반** | **4,196** | **105** | **독립** |
| 그런 줄이 있는 쪽 | 199 | **10** | **독립** |
| 그중 **문단 텍스트**에 들어간 줄 | 1,379 | **36** | **독립** |
| 2단 판정 쪽 | 45 | 216 | 검출기 |
| P6 문항 번호 역행 쪽 | 39 / 324 | **8 / 448** | 독립 프록시 |
| 표 region 합계 | 800 | 271 | 검출기 |
| `TABLE X-n` 캡션 쪽(149) 중 region 감지 | 98 | **101** | 독립 |
| 문단 총 글자 수 | 2,590,135 | 2,840,540 | — |
| 소문자-대문자 패턴 절대 건수 | 1,379 | 1,539 | 검출기 |
| **같은 패턴 / 1만 자** | **5.32** | **5.42** | 정규화 |
| 20자 이상 낱말 | 125 | 136 | 검출기 |
| 평균 `buildPageLayout` | 0.59 ms/쪽 | 0.64 ms/쪽 | P9 상한 15ms ✔ |

**붙음 후보가 1,379→1,539 로 늘어난 것은 악화가 아니다.** 표 오탐이 걷히면서 줄 4,050→1,323개가 `role:'table'`(문단 제외)에서 정상 문단으로 옮겨와 **문단 글자 수 자체가 25만 자 늘었다**. 1만 자당으로 정규화하면 5.32 → 5.42 로 사실상 불변이고, 상위 패턴은 전부 단위·약어 오탐이다(`dL` 278, `mL` 154, `mmHg` 119, `IgG` 78, `pH` 66). 새로 등장한 20자+ 낱말 4개(p35·p174·p177·p181)도 전부 **하이픈 소실**(`KEEP_HYPHEN_SUFFIXES` TODO 대기)이지 컬럼 병합이 아니다.

---

## 1b-3. A-2 오탐 사냥 — "1단인데 2단으로 쪼개진 쪽"을 직접 찾았는가 ★

Build 는 P6 개선(39→8쪽)을 근거로 오탐이 아니라고 주장했다. **나는 그 논증을 쓰지 않고 다음처럼 사냥했다.**

### 표본 선정 — 무작위가 아니라 "가장 의심스러운 순서"

무작위 표본은 216쪽 중 대다수가 명백한 문항 페이지라 오탐을 놓치기 쉽다. 그래서 §1b-2 의 잉크 프로파일로 **검출된 거터 X 위에 실제로 잉크가 있는 쪽**(= 글자 위를 그어 쪼갠 쪽)을 전수로 뽑아 위험도 순으로 정렬했다.

```
거터 X 를 덮는 행 비율   30%+ : 2쪽    15~30% : 10쪽    5~15% : 8쪽    5% 미만 : 196쪽
```

즉 **216쪽 중 196쪽은 거터에 잉크가 5% 미만**이다(대부분 0%). 나머지 **20쪽을 전수 확보**하고 그중 **15쪽(p5·7·36·62·120·192·202·203·243·264·340·427·529·539·699)의 줄 텍스트를 컬럼별로 직접 읽었다.**

### 판정

| 쪽 | 거터 위 잉크 | 실제 정체 | 좌/우 컬럼이 각각 의미상 이어지는가 | 판정 |
|---|---:|---|---|---|
| p36, p192, p202, p203, p340, p427 | 8.6~11.8% | **진짜 2단 문항 페이지** | **예** — COL0 이 문항 지문, COL1 이 다음 문항·보기로 각각 끊김 없이 이어진다 | **정탐**. 잉크는 전폭 `FIGURE …` 캡션 때문이고, 그 줄들은 `span` 으로 올바로 분리돼 있다 |
| p120, p529, p539, p699 | 14.8~30.0% | **전폭 표**(`TABLE II-5`, `VII-61`, `VII-83`, `X-19`) | 해당 없음(표 셀) | **오탐이되 무해~경미**. 표를 두 덩어리로 나눈다. §8b #2 참조 |
| p5 | — | **속표지** | 해당 없음 | 오탐. 앞붙임. 본문 손상 없음 |
| p7 | 16.1% | **목차** — 항목 열 + 쪽번호 열 | 구조적으로는 2열이 맞다 | 오탐이되 무해. 다만 읽기 순서가 "항목 전부 → 쪽번호 전부"가 된다 |
| p62 | — | 해설 + 그림 라벨 | 해설 줄은 모두 온전(x 210~564) | 오탐. 그림 라벨과 해설을 가르는 위치(x 약 202)를 거터로 봤다. **텍스트 손상 0** |
| p243, p264 | 14.8~16.4% | 표/그림 혼합 | — | 위 표 사례와 동일 성격 |

**결론: "1단 본문인데 2단으로 잘못 쪼개져 문장이 끊긴 쪽"은 216쪽 전체에서 1쪽도 찾지 못했다.**
오탐은 전부 (표 / 목차 / 속표지 / 그림 라벨)이며, **어느 것도 본문 문장을 잘라 놓지 않았다.** 이번 수정의 진짜 위험으로 지목된 방향은 실측에서 확인되지 않는다.

**반대 방향(A-3)**: 2단인데 1단으로 남은 쪽은 §1b-2 의 독립 측정으로 정확히 **10쪽**(p27·186·188·190·197·210·347·434·482·677)이다. 그 10쪽에서만 컬럼 병합 105줄이 남아 있다. 원인은 §1b-4.

---

## 1b-4. A-4 `GUTTER_MIN_CROSSING: 8` 의 근거 검증 ★

이 상수는 **spec 에 없는 신규 상수**다. `config.js` 의 근거 주석은 이렇게 적혀 있다.

> 실측에서 2단 페이지의 가로지르는 줄 수는 10~31 로 이 하한을 넉넉히 넘었다.

**이 실증 주장은 반증된다.** 남은 병합 10쪽에서 (c) 단계 내부값을 직접 꺼내 보았다(`rv_why.mjs`):

| 쪽 | body줄 | peak `hist` | **`cross`(분모)** | 비율 | 임계 0.55 | MAD 게이트 | 왜 1단으로 남았나 |
|---|---:|---:|---:|---:|---|---|---|
| p186 | 52 | 4 | **4** | **1.00** | 통과 | 통과 | **`GUTTER_MIN_CROSSING` 에서만 탈락** |
| p434 | 83 | 4 | **4** | **1.00** | 통과 | 통과 | **동일** |
| p210 | 56 | 7 | **7** | **1.00** | 통과 | 통과 | **동일** |
| p347 | 26 | 7 | **7** | **1.00** | 통과 | 통과 | **동일** |
| p677 | 48 | 7 | **7** | **1.00** | 통과 | 통과 | **동일** |
| p482 | 51 | 42 | 42 | 1.00 | 통과 | **MAD 54 > 27 탈락** | (d) 좌변 정렬 검사 |
| p27 | 44 | 6 | 21 | 0.29 | 탈락 | — | 비율 부족 |
| p188 | 48 | 9 | 36 | 0.25 | 탈락 | — | 비율 부족 |
| p190 | 59 | 7 | 27 | 0.26 | 탈락 | — | 비율 부족 |
| p197 | 71 | 6 | 41 | 0.15 | 탈락 | — | 비율 부족 |

**진짜 2단 페이지의 `cross` 가 4·7 인 경우가 실재한다.** 주석의 "10~31" 은 Build 가 본 표본(40쪽)에서만 성립한 값이다.

### 스윕 — 값을 바꾸면 무엇이 깨지는가

`GUTTER_MIN_CROSSING` 만 바꾸고 729쪽 전수를 다시 돌렸다. 병합 줄 수는 §1b-2 의 **독립** 측정이다.

| `GUTTER_MIN_CROSSING` | 2단 쪽 | **병합 줄(독립 P2)** | 병합 쪽 | 거터에 잉크 15%+ 인 쪽(오탐 지표) | 표 region |
|---:|---:|---:|---:|---:|---:|
| 0 | 235 | 45 | 1 | 12 | 255 |
| 2 | 235 | 45 | 1 | 12 | 255 |
| **4** | **232** | **47** | **2** | **12** | 259 |
| 6 | 223 | 55 | 4 | 12 | 262 |
| **8 (현재)** | **216** | **105** | **10** | **12** | **271** |
| 10 | 209 | 151 | 16 | 12 | 280 |
| 12 | 203 | 200 | 21 | 12 | 287 |
| 16 | 186 | 430 | 37 | 12 | 333 |

**읽는 법**: 값을 8→4 로 내리면 병합 줄이 **105→47 로 절반 이하**가 되는데, **오탐 지표는 12쪽으로 전 구간 불변**이다. 즉 이 상수는 오탐을 전혀 막고 있지 않으면서 정탐만 버리고 있다. 오탐을 실제로 막는 것은 `GUTTER_MIN_RATIO 0.55`(§1b-6 에서 C7 이 이것을 고정) 와 (d) MAD 게이트다.

**단, 0 으로 내려서는 안 된다.** `columns.js:98-99` 의 조건은

```js
const ok = b <= hiBin && cross[b] >= P.GUTTER_MIN_CROSSING &&
  hist[b] >= P.GUTTER_MIN_RATIO * cross[b];
```

이므로 `cross[b] === 0` 이면 `0 >= 0.55*0` 이 **공허하게 참**이 되어 잉크가 하나도 없는 bin 이 전부 거터 후보가 된다. 지금은 하한 8 이 이 경로를 막고 있다. 프로토타입 슬라이더의 `GUTTER_MIN_RATIO` 최솟값은 0.20 이라 UI 로는 도달 불가다(확인함). **값을 내린다면 `hist[b] > 0` 가드를 함께 넣어야 한다**(§8b #4).

**나는 값을 바꾸지 않았다.** 216→232 는 동작 변경 폭이 크고, C9 가 현재 값을 고정하고 있으며, 튜닝 결정은 Review 서브에이전트가 단독으로 내릴 자리가 아니다. 데이터와 함께 제안만 올린다.

---

## 1b-5. 표 오탐 감시 — region 800→271 은 손실인가

Build 지침이 "표 region 수(오탐 급증 감시)"를 요구했는데, 실제로는 **급감**했다. 급감이 더 위험할 수 있으므로 별도로 검증했다(`rv_tbl.mjs`, 두 커밋 동시 실행).

- 줄 `role:'table'`: **4,050 → 1,323**.
- 독립 기준으로 "진짜 표가 있는 쪽" = 본문에 `TABLE [IVX]+-숫자` 캡션이 있는 쪽 = **149쪽**.
  - 그중 region 이 감지된 쪽: 구 **98** → 신 **101**. **늘었다.**
- 구에는 region 이 있었는데 신에는 0인 쪽: **151쪽**. **그중 캡션이 있는 쪽은 p699 단 1쪽.**

→ 사라진 150쪽은 **병합된 2단 본문이 "여러 run 이 열 맞춰 정렬된 줄"로 보여 표로 오탐되던 것**이다. 오탐 제거가 맞다. spec 16-A 가 못박은 `Acetylsalicylic acid` 표(p48)는 **신·구 모두 `role:'table'` 로 감지**된다(P5 유지).

유일한 실질 회귀는 **p699**: 전폭 표 `TABLE X-19` 가 2단으로 쪼개지면서 각 컬럼의 줄이 run 1개가 되어 표 신호가 사라졌다(§8b #2).

---

## 1b-6. B. 테스트에 이빨이 있는가 — 의도적 파손 ★

각 상수를 되돌리고 `node --test "apps/medreader/tests/*.test.mjs"` 를 돌렸다. **네 번 모두 정확히 한 케이스만 실패한다.**

| # | 되돌린 것 | 실패한 테스트 | 결과 |
|---|---|---|---|
| 1 | `RUN_GAP_FACTOR` 1.2 → **2.0** | **C8** (거터 1.5em) | tests 43 / pass 42 / **fail 1** |
| 2 | `GUTTER_MIN_RATIO` 0.55 → **0.30** | **C7** (전폭 1단 해설) | tests 43 / pass 42 / **fail 1** |
| 3 | `GUTTER_MIN_CROSSING` 8 → **0** | **C9** (가로지르는 줄 3개) | tests 43 / pass 42 / **fail 1** |
| 4 | `columns.js` (c) 조건을 구 분모 `0.55 * body.length` 로 되돌림 | **C6** (baseline 어긋난 2단) | tests 43 / pass 42 / **fail 1** |

**원상복구 확인**:

```
$ git status --short
?? .codex/
?? AGENTS.md
$ git diff --stat -- apps/medreader/
(출력 없음)
```

`apps/medreader/` 에 변경 0건. 파손은 모두 되돌렸다.

### C7 재판정 (지침 B-7)

Build 는 "C7 은 모든 쪽이 1단인 세계에서 구조적으로 실패 불가라 수정 전에도 통과했다"고 정직하게 보고했다. **이 설명은 타당하다.** C7 의 픽스처는 전폭 줄만 있어 **모든 줄이 거터 후보 X 를 가로지르므로 신·구 분모가 사실상 같다**(테스트 주석도 0.32→0.33 으로 그렇게 적었다). 따라서 **C7 은 "분모 변경"에 대해서는 이빨이 없다.**

**그러나 다른 축에서는 유일하게 유효한 가드다.** 위 파손 #2 가 보여주듯 `GUTTER_MIN_RATIO` 를 0.30 으로 내리면 **C7 만 실패한다.** spec 4-5 는 "임계 0.55 는 그대로 둔다 … 임계를 낮추는 방식은 오탐만 늘고 단어 붙음은 줄지 않았다"를 명시하고 있으므로, 그 결정을 코드에 고정하는 유일한 테스트다. **의미 있는 가드로 판정한다.** 다만 테스트 이름의 "분모를 고쳐도 오탐하지 않는다"는 주장보다 실제로는 "임계를 낮추면 오탐한다"를 주장하고 있다.

### H6 재판정

`git show e7e13fd:apps/medreader/js/text/hyphen.js` 로 확인한 결과 **수정 전에도 `joinHyphen(prev, cur, keepSet = …, keepSuffixSet = KEEP_HYPHEN_SUFFIXES)` 4번째 인자가 이미 있었다.** 따라서 H6 가 수정 전에 통과한 것은 당연하며, **H6 는 1b 회귀 테스트가 아니다.** 배선 가드로서는 유효하고(인자를 떼면 실패), `config.js` 의 빈 집합에 의존하지 않고 집합을 주입한 설계는 **사용자의 `TODO(human)` 자리를 보호하는 올바른 선택**이다. H1(cardio- + vascular)이 깨지지 않음까지 같은 케이스에서 확인하는 점도 좋다.

### C6·C8·C9 가 spec 기대값을 주장하는가

- **C6** — spec 4-5 `[수정 2026-09-18]` 의 "한쪽 컬럼에만 있는 줄이 과반인 조판" 을 그대로 모사(가로지르는 20줄 + 한쪽 전용 30줄). 구 분모로 되돌리면 실패(파손 #4). **spec 문장을 직접 주장한다.**
- **C8** — spec 4-4 `[실측]` 의 "거터 15pt = 1.5em, 본문 10pt" 를 좌표 그대로 옮겼다(좌 72–306, 우 321–540). `count=2` 뿐 아니라 **읽기 순서 40줄 전부를 문자열로 단언**한다. 가장 강한 케이스다.
- **C9** — Build 지침 2번의 "가로지르는 줄이 3개뿐인데 3개가 다 끊긴다고 2단으로 판정하면 안 된다" 를 주장한다. **주장 자체는 정확하지만, §1b-4 가 보여주듯 이 케이스가 고정한 값 8 은 `cross=4·7` 인 진짜 2단 쪽 5개를 함께 버린다.** 케이스의 결함이 아니라 값의 문제다.

---

## 1b-7. C. 회귀·구조·순수성

| 항목 | 명령/방법 | 결과 |
|---|---|---|
| 기존 38개 기대값 불변 | `git diff e7e13fd..7260b02 -- apps/medreader/tests/` | append 만. 기존 케이스 삭제·수정 0건 ✔ |
| 순수성 (16-A, 16-K) | `grep -rn` 으로 `document / window / fetch / indexedDB / pdfjsLib / navigator / localStorage` 를 `js/text/` 전체에서 검색 | **0건** ✔ |
| 앱 밖 참조 | 상위 디렉터리 import 검색 | 0건 ✔ |
| 결정성 (P10) | 실제 PDF 40쪽(2단·1단·표 혼합)을 각 3회 처리 — 원본 배열 / 재호출 / 아이템 얕은 복사본 | **40쪽 전부 `JSON.stringify` 동일** ✔ |
| `algoVersion` | `layout.js:23` `1 → 2`. spec 3-3("알고리즘을 고치면 값을 올린다"), 9-4("`algoVersion` 이 오르면 `cursor ← 1`, `failed ← []`") | **적합** ✔ — 컬럼 병합된 v1 페이지는 반드시 재추출돼야 하고 주석이 그 이유를 적어 두었다 |
| `layout.js` 변경 범위 | `git diff` | `algoVersion` 1줄 + 주석 4줄뿐 ✔ |
| `KEEP_HYPHEN_SUFFIXES` | `git diff … -- config.js` 에서 `KEEP_HYPHEN` 관련 변경 줄 수 = **0** | `TODO(human)` **완전 미변경** ✔ |
| 커밋 범위 | `git status --short` → `?? .codex/`, `?? AGENTS.md` 만 | 블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/` 미변경 ✔ |
| 레포 위생 | `tests/fixtures/` 에 `synth-2col.json` 1개뿐. PDF·`node_modules`·`package.json` 없음 | ✔ (spec 20절 "사용자 PDF 커밋" 함정 회피) |
| 성능 (P9) | 729쪽 평균 | **0.64 ms/쪽** (상한 15ms) ✔ |

### 프로토타입 페이지 (16-K)

포트 8000 에는 **이 세션이 시작하지 않은** `python -m http.server` 가 이미 떠 있었다. 남의 프로세스이므로 새로 띄우지 않고 그대로 사용했고, **내가 시작한 preview 서버가 없으므로 `preview_stop` 할 대상도 없다**(`preview_list` 가 빈 목록임을 확인).

- `http://localhost:8000/apps/medreader/dev/proto-lines.html` — **콘솔 에러·경고 0건** (로그 자체가 0건).
- `?items=../tests/fixtures/synth-2col.json` 자동 진입 — 캔버스에 줄 bbox(본문 파랑/표 주황)와 **거터 세로 점선**이 정상 렌더. 콘솔 0건.
- 기본값이 새 값으로 뜬다: Y 0.35 / 공백 0.15 / **run 1.2** / 거터 0.55.
- 슬라이더 4종을 전 구간 움직여도 에러 0건. `currentParams()` → `buildPageLayout` 배선도 확인했다(`GUTTER_MIN_CROSSING: 60` 을 주입하면 즉시 `count 2→1` 로 바뀐다).
- **다만 `synth-2col.json` 은 run 계수 0.5~5, 거터 임계 0.2~0.95 전 구간에서 결과가 `count=2 / gutter 306 / 42줄` 로 고정 불변이다.** 1단계 Review §8 #11 이 지적한 민감도 0 문제가 그대로다 — 이 픽스처는 이번 결함을 원리적으로 잡을 수 없다(§1b-8).

---

## 1b-8. D. Build 가 못 끝낸 것 — 합성 픽스처가 실제 결함을 고정하는가

Build 는 실제 PDF 페이지의 items JSON 픽스처를 넣지 못했다. 권한 시스템이 저작권 PDF 내용을 레포에 기록하는 것을 거부했고 **우회하지 않고 멈췄다.** 올바른 대응이다. 나도 같은 이유로 원서 텍스트를 레포에 넣지 않았다.

**판정: 합성 픽스처 C6·C8·C9 는 "두 결함 자체"는 확실히 고정한다** — 파손 테스트 #1·#4 가 증명한다(§1b-6). Build 가 실측 좌표(좌 72–306 / 우 321–540, 거터 15pt, 본문 10pt)를 그대로 옮긴 것도 적절했다. **그러나 실제 페이지의 특이점 중 반영된 것과 빠진 것이 갈린다.**

| 실제 페이지의 특이점 | 반영? | 근거 |
|---|---|---|
| 좌·우 baseline 어긋남 (한쪽 전용 줄 과반) | **○** | C6 이 정면으로 모사(가로지름 20 : 전용 30) |
| 실측 거터 폭 1.5em | **○** | C8 |
| 저표본 거터(`cross` 3) | **○** | C9 |
| **폭을 가진 공백 아이템** (spec 4-4 수정의 핵심 근거) | **△** | 1단계 Review 가 추가한 `C5` 가 이미 고정하고 있어 공백은 아니다. **다만 C5 의 공백 아이템은 거터가 넓은 픽스처 위에 있어, "공백 + 좁은 거터(1.5em)"가 겹친 조합은 어디에도 없다.** 실제 p343 계열이 정확히 그 조합이다 |
| **거터를 가로지르는 전폭 `FIGURE`/`TABLE` 캡션(`span`)** | **✗** | §1b-3 에서 216쪽 중 최소 20쪽이 이 구조다. `span` 분리가 깨지면 곧바로 컬럼 병합인데 **2단 + span 조합 테스트는 C2 하나뿐이고 C2 는 거터 0.5W 의 느슨한 픽스처다** |
| **`cross` 가 4~7 뿐인 진짜 2단 쪽** | **✗** | §1b-4 의 잔존 결함 5쪽의 원인. C9 는 "3개면 1단" 만 고정하고 **"7개면 2단이어야 하는가" 는 아무도 주장하지 않는다.** 이 공백 때문에 값 8 이 무비판적으로 고정됐다 |
| 위첨자 | ✗ | 컬럼 검출 경로에 영향 없음(본문 폰트 대역 0.7~1.4배 필터에서 탈락). **누락이지만 무해**로 판정 |

**구체적 보완 권고(원서 텍스트 없이 가능)** — 실제 좌표만 옮기면 되므로 저작권 문제가 없다:

1. **C10(가칭)**: C8(거터 1.5em) 픽스처에 **폭을 가진 공백 아이템을 거터 한가운데 삽입** → `count=2` 가 유지되는지. spec 4-4 수정의 두 근거가 동시에 걸린 유일한 조합이다.
2. **C11(가칭)**: C6/C8 픽스처 위에 **폭 0.8W 의 `FIGURE …` 캡션 줄**을 얹어 `col:'span'` 으로 분리되고 좌·우가 병합되지 않는지. 실제 2단 쪽의 가장 흔한 형태다.
3. **C12(가칭)**: 가로지르는 줄이 **7개**뿐이고 7개가 전부 거터에서 끊기는 2단 픽스처 → 기대값을 명시적으로 정할 것. 지금은 `count=1`(현재 동작)이고, §1b-4 대로라면 `count=2` 가 옳다. **이 기대값을 정하는 것이 곧 `GUTTER_MIN_CROSSING` 값을 정하는 일이다.**

---

## 8b. 발견한 문제 (1b)

| # | 심각도 | 위치 | 문제 | 근거 | 조치 |
|---|---|---|---|---|---|
| 1 | **중간** | `js/config.js` `GUTTER_MIN_CROSSING: 8` | 근거 주석의 실증 주장("2단 페이지의 가로지르는 줄 수는 10~31")이 **반증된다.** `cross=4·7` 인 진짜 2단 쪽이 실재하고, 이 상수만으로 5쪽(p186·210·347·434·677)이 1단에 남아 컬럼이 병합된다. 값 8 은 오탐을 전혀 줄이지 못하면서 정탐만 버린다 | 스윕 표(§1b-4): 8→4 로 내리면 병합 줄 105→47, 병합 쪽 10→2, **오탐 지표는 12쪽으로 전 구간 불변** | **보류 — 사용자/오케스트레이터 판단 대상.** 216→232 는 동작 변경 폭이 크고 C9 가 현재 값을 고정하고 있다. 값을 내린다면 #4 를 함께 적용할 것. 하한 4 라면 C9(가로지름 3개)는 **여전히 통과**한다 |
| 2 | 경미 | `js/text/columns.js` / `blocks.js` | 전폭 표가 2단으로 쪼개져 표 region 을 잃는다. **p699(`TABLE X-19`)** 1쪽. 쪼개진 뒤 각 컬럼 줄이 run 1개가 되어 4-8 의 열 정렬 신호가 사라진다 | `TABLE X-n` 캡션 149쪽 중 region 을 잃은 유일한 쪽. 같은 성격의 표 3쪽(p120·529·539)은 region 은 유지하되 2단으로 쪼개진다 | 보류 — 149쪽 중 1쪽이고 신 101 > 구 98 로 총량은 개선. spec 4-8 이 표 판정을 컬럼 재편 **뒤**에 하는 구조라 근본 수정은 4-5/4-8 순서 문제다. 2단계 이후 P5 사용자 검증에서 재판단 |
| 3 | 경미 | `js/text/columns.js` | 속표지(p5)·목차(p7)·그림+해설(p62)이 2단으로 판정된다. **본문 텍스트 손상은 0**이지만 목차는 읽기 순서가 "항목 전부 → 쪽번호 전부"가 되어 TTS 로 읽으면 무의미하다 | §1b-3 표본 확인 | 보류 — 앞붙임 3쪽. 2단계에서 `documents` 의 본문 시작 쪽 설정으로 건너뛰는 편이 낫다 |
| 4 | 제안 | `js/text/columns.js:98-99` | `cross[b] === 0` 이면 `hist[b] >= 0.55 * 0` 이 **공허하게 참**이 되어 잉크 없는 bin 이 전부 거터 후보가 된다. 지금은 하한 8 이 가리고 있을 뿐이다 | 스윕에서 `GUTTER_MIN_CROSSING: 0` → 2단 235쪽으로 폭증(밴드 폭·MAD 게이트만 남음). 슬라이더 `GUTTER_MIN_RATIO` 최솟값은 0.20 이라 UI 로는 도달 불가 | 보류 — `hist[b] > 0 &&` 한 조건을 추가하면 해소된다. #1 을 적용할 때 **반드시 함께** |
| 5 | 제안 | `spec.md` 9-4 vs `js/text/layout.js:23` | spec 9-4 는 `layout.ALGO_VERSION`(대문자)으로 적었는데 코드는 `algoVersion`(소문자). spec 3-3 은 소문자다 | grep | **spec 수정 금지 범위** — 여기 제안으로만 남긴다. 2단계 `pdf/extract.js` 배선 전에 이름을 하나로 정할 것 |
| 6 | 이월(1b 무관) | `js/text/lines.js` 줄 bbox | 줄 `bbox.x1` 이 페이지 폭을 크게 넘는다. **1,853줄 / 463쪽**, 최대 `x1 = 9385pt`(p7, 폭 612pt). 폭을 가진 공백 아이템(목차 점선 등)이 bbox 에는 들어가고 run x0/x1 에는 안 들어가기 때문 | 두 커밋 동시 측정: 구 1,839줄/463쪽, 신 1,853줄/463쪽 — **1b 이전부터 있던 결함이며 이번 수정과 무관** | 보류 — spec 4-12 하이라이트 오버레이가 이 bbox 를 쓰므로 **원본 뷰 작업 전에 반드시 고쳐야 한다.** 2단계 주의사항으로 넘긴다 |

**차단 문제: 0건.** 1b 가 목표한 P2 결함은 실제로 해소됐고(§1b-2), 그 대가로 생긴 오탐 중 본문을 손상시키는 것은 없다(§1b-3).

---

## 9b. 내가 고친 것 (1b)

**없다. 코드·테스트를 한 줄도 고치지 않았다.**

이번 Review 에서 발견한 것 중 "즉시 고칠 실제 결함"에 해당하는 것이 없었기 때문이다. #1(`GUTTER_MIN_CROSSING`)은 값 튜닝이고 동작 변경 폭이 216→232 쪽으로 커서 Review 서브에이전트가 단독으로 바꿀 자리가 아니다 — 데이터(스윕 표)와 함께 제안으로 올린다. #4 는 #1 과 묶여야 의미가 있다. #6 은 1b 범위 밖의 이월 결함이다.

의도적 파손(§1b-6)으로 임시 변경한 `config.js`·`columns.js` 는 매 회차 직후 `git checkout --` 으로 되돌렸고, 최종 `git diff --stat -- apps/medreader/` 가 **빈 출력**임을 확인했다. 커밋·푸시하지 않았다.

검증에 쓴 스크립트(`rv_ink.mjs`·`rv_ink2.mjs`·`rv_p2.mjs`·`rv_why.mjs`·`rv_sweep.mjs`·`rv_metrics.mjs`·`rv_glue.mjs`·`rv_tbl.mjs`·`rv_det.mjs`·`rv_bbox.mjs`·`rv_look.mjs`)와 `e7e13fd` 소스 사본은 **전부 스크래치패드에만** 두었다. 레포에 원서 텍스트·PDF·하네스를 넣지 않았다.

---

## 10b. Build 신고 잔존 결함 3종에 대한 판정과 우선순위

| 우선 | 결함 | 내 독립 측정 | 판정 | 다음 행동 |
|---|---|---|---|---|
| **1** | **하이픈 소실** (`angiotensinconverting`, `methicillinresistant` 등) | 20자+ 낱말 **136개**. 새로 드러난 4개(p35·174·177·181)도 전부 이 원인 | **코드 결함 아님 — 사용자 대기.** 배선(`hyphen.js` ← `KEEP_HYPHEN_SUFFIXES`)은 완성됐고 H6 이 고정한다. `config.js` 의 빈 Set 이 채워지면 대부분 해소된다 | **사용자가 `TODO(human)` 을 채우는 것이 1b 이후 첫 작업.** spec 4-10 이 열거한 낱말들(`converting`·`resistant`·`associated`·`susceptible`·`tazobactam`·`macrophage` 등)이 출발점 |
| **2** | **컬럼 경계 문단 끊김** (Build 보고 353건) | 내 독립 기준으로는 **최종 줄 105개 / 10쪽 / 문단 안 36줄**. 세는 단위가 달라 숫자는 다르지만 방향과 쪽 목록은 일치 | **실재하는 잔존 결함. 단 차단은 아니다** — 729쪽 중 10쪽(1.4%)이고, spec 4-11 P2 는 10쪽 표본 기준이라 통계적으로 통과한다 | **그중 5쪽은 `GUTTER_MIN_CROSSING` 값 하나로 즉시 해소된다**(§1b-4). 나머지 5쪽은 비율 부족(4쪽)·MAD 게이트(p482, 1쪽)로 성격이 달라 별도 과제 |
| **3** | **P6 8쪽** | 재현: **8 / 448쪽**(구 39 / 324). 목록 p27·180·197·203·212·343·344·435 | **차단 아님.** 8쪽 중 2쪽(p27·197)은 #2 와 **같은 원인**이므로 #2 를 고치면 함께 줄어든다. 나머지 6쪽은 2단 쪽 안에서 span 밴드 경계를 넘는 문항 번호로, 내 단조 증가 프록시가 지나치게 엄격한 경우도 섞여 있다 | 보류 — #2 처리 후 재측정. `pagesWithQ` 가 324→448 로 늘었다는 것 자체가 문항 문단이 훨씬 많이 **제대로** 만들어졌다는 뜻이다 |

**종합 우선순위**: ① 사용자 `TODO(human)` → ② `GUTTER_MIN_CROSSING` 재검토(+ `hist[b] > 0` 가드) → ③ 2단계 착수 → ④ 줄 bbox 오버플로(원본 뷰 전) → ⑤ p699·목차류.

---

## 11b. 2단계에 넘길 주의사항 (1b에서 추가된 것)

1. **`algoVersion = 2` 재추출 경로를 반드시 구현할 것.** v1 로 추출된 페이지는 컬럼이 병합돼 있어 **재추출 없이는 쓸 수 없다.** spec 9-4 의 "`algoVersion` 이 오르면 `cursor ← 1`, `failed ← []`" 를 그대로. 이름은 `algoVersion`(소문자)로 통일(§8b #5).

2. **줄 `bbox.x1` 을 그대로 오버레이에 쓰지 말 것.** 463쪽에서 페이지 폭을 넘고 최대 9385pt 다(§8b #6). 원본 뷰(4-12) 작업 전에 `lines.js` 의 bbox 계산에서 run 과 같은 "비공백 아이템" 기준을 쓰거나, 최소한 페이지 폭으로 클램프해야 한다.

3. **`pages` 스토어 용량이 1단계 예상보다 늘었다.** 표 오탐이 걷히며 문단 글자 수가 259만 → 284만 자로 약 10% 증가했다(§1b-2). 1단계 §10-1 의 "`line.items` 미저장" 이 더 중요해졌다.

4. **컬럼 판정이 인접 쪽과 다른 쪽을 추출 로그에 남길 것.** 프로토타입의 전체 문서 통계 모드가 이미 이상치로 강조한다(spec 4-11). 잔존 10쪽이 전부 여기에 걸리므로, 2단계 추출기가 같은 신호를 기록해 두면 이후 튜닝의 회귀 감시가 공짜로 생긴다.

---

# Review — MedReader 1c·1d단계 (문단 kind 판정 + heading 가드)

- 검증일: 2026-09-19
- 검증 대상 커밋: `2145c90 Build 1d: heading 가드 — P7 14.5% → 66.2%` (1c는 `1ef8a2e`, 접미사 목록은 사용자 커밋 `f7d50aa`, 대조 기준은 `e776eac`)
- 검증 환경: Windows 10 Pro 19045 / Node **v24.14.0** / Chromium(내장 브라우저 패널, `python -m http.server 8000`)
- 실제 PDF: `ILMA_2021_20th_ed_Harrison.pdf` 729쪽 (스크래치패드 하네스, pdfjs-dist 5.4.149 legacy 빌드)
- 기준 문서: `spec.md` 4-7·4-8·4-9·4-10·4-11·5-3·16-A·16-K·20절, `.claude/tasks/medreader-build-1c.md`·`-1d.md`

---

## 종합 판정 (1c·1d)

**조건부 통과** — 차단 0건, 중간 3건, 경미 3건, 제안 4건.

→ **2단계(`db.js`·`hash.js`·`pdf/loader.js`·`pdf/extract.js`)로 진행해도 되는가: 예.**
→ **1e(추가 수정 단계)가 필요한가: 아니다.** 근거는 §1cd-8.

근거(전부 내가 직접 측정했다):

- **1c·1d는 실재하는 대규모 결함을 실제로 고쳤다.** 같은 PDF를 두 커밋의 소스로 **한 번의 순회에서 나란히** 돌려 비교했다(`rv_main.mjs`): `body` 문단 3,280 → 2,123(−1,157)으로 줄고 그만큼 문항 stem이 원래 문단으로 되돌아왔다. `question` 문단 중 줄 1개짜리는 **72.6% → 6.2%**, P7은 **14.5% → 66.2%**다.
- **가장 중요한 오탐 검사에서 깨끗했다: `heading` 문단 집합이 1c와 1d에서 완전히 동일하다.** 쪽·텍스트 기준으로 대조해 공통 1,009개, 한쪽에만 있는 것 **0개**(§1cd-4). 총수가 우연히 같은 것이 아니라 같은 문단들이다.
- 줄 role 강등 1,781건은 **전부** `isQuestionStart`·`isOptionStart`·`isAnswerStart` 중 하나에 걸리는 줄이다(패턴에 걸리지 않는데 강등된 줄 **0건**). 구조상 가드가 다른 줄을 건드릴 수 없음을 코드가 아니라 **전수 데이터로** 확인했다.
- 표본을 떠서 직접 읽었다: p12·p16·p33·p116·p173·p292·p380·p573의 줄·문단 목록을 원문 순서대로 출력해 눈으로 확인했다. 강등된 줄은 약물명·진단명 보기(`"A. Albuterol"`, `"A. Central diabetes insipidus"`)였고 제목이 아니었다.
- 의도적 파손 5종 중 4종이 정확히 대응하는 테스트를 실패시킨다. **1종(1c의 kind 우선순위)은 아무것도 실패시키지 못했다** — 그 자리는 비어 있었고 내가 `B21`·`B22`로 메웠다(§1cd-5, §9cd).
- 순수성 grep 0건, 결정성 20쪽 3회 `JSON.stringify` 동일, `algoVersion = 4`가 출력에 실림, 성능 0.70 ms/쪽(P9 상한 15 ms), 범위 밖 파일 미수정.

**다만 1d가 드러낸 표 오탐(§1cd-3)과, 1d 이후 1c의 kind 우선순위가 사실상 무력해진 점(§1cd-5)은 2단계 착수 전에 사용자가 읽어야 한다.**

---

## 1cd-1. 단위 테스트 재실행과 기존 기대값 무변경

```
$ node --test "apps/medreader/tests/*.test.mjs"
ℹ tests 54   ℹ pass 54   ℹ fail 0   ℹ duration_ms 582.5
```

(내가 `B21`·`B22`를 추가한 뒤: `tests 56 / pass 56 / fail 0`.)

기존 기대값이 바뀌지 않았음을 diff로 확인했다:

```
$ git diff e776eac..2145c90 --stat -- apps/medreader/tests/
 apps/medreader/tests/blocks.test.mjs | 155 +++++++++++++++++++++++++++++++++
$ git diff e776eac..2145c90 -- apps/medreader/tests/ | grep -c "^-[^-]"
0
```

**삭제된 줄 0건.** 기존 43개 케이스의 기대값 수정·완화 없음.

---

## 1cd-2. 독립 전수 재현 — Build·오케스트레이터의 숫자를 받아쓰지 않는다

같은 PDF 한 번 순회에서 `2145c90`(현재)과 `f7d50aa`(1c + 사용자 접미사 목록) **두 소스를 동시에** 돌려 대조했다. items는 두 번째 호출 전에 깊은 복사해 상호 오염을 막았다.

| 지표 | `f7d50aa` (1c) | `2145c90` (1d) | 측정 |
|---|---:|---:|---|
| 문단 `heading` | 1,009 | 1,009 | 전수 |
| 문단 `body` | 3,280 | **2,123** | 전수 |
| 문단 `question` | 1,393 | 1,392 | 전수 |
| 문단 `option` | 6,237 | 6,228 | 전수 |
| 문단 `answer` | 1,187 | 1,187 | 전수 |
| 문단 `list` | 274 | 274 | 전수 |
| **줄 role `heading`** | 2,825 | **1,044** | 전수 |
| **P7 (question 뒤 연속 option 2~5)** | — | **922 / 1,392 = 66.2%** | 전수 |
| question 문단 중 줄 1개짜리 | 1,012 / 1,393 (72.6%) | **86 / 1,392 (6.2%)** | 전수 |
| question 첫 줄 role=heading | 953 | **7** | 전수 |
| P6 (문항 번호 단조 증가) | — | 226쪽 중 정상 216 / 깨짐 10 | 전수 |
| 2단 판정 쪽 | 232 | 232 | 전수 |
| 표 region | 259 | **262** | 전수 |
| 손상 3종(`examinatrocardiographic` 등) | 0 | 0 | 전수 |
| `buildPageLayout` 평균 | 0.62 ms/쪽 | **0.70 ms/쪽** | P9 상한 15 ms ✔ |
| `algoVersion` | 3 | **4** | 출력 객체 |

오케스트레이터가 제시한 모든 수치와 일치한다. 0.70 ms/쪽은 내 하네스가 같은 순회에서 두 레이아웃을 만들며 잰 값이고, 단독 실행(`v1d.mjs`)에서는 0.67~0.70 ms/쪽이다. 어느 쪽이든 P9의 15 ms에서 20배 이상 여유가 있다.

`algoVersion = 4`는 spec 3-3·9-4의 재추출 규약과 맞는다: 1d는 `lines[].role`과 `paragraphs[]` 경계를 **둘 다** 바꾸므로 v3으로 추출된 페이지는 재사용할 수 없다. `layout.js`의 버전 주석이 그 이유를 적고 있고, 출력 `PageLayout.algoVersion`에 실제로 4가 실린다(확인).

---

## 1cd-3. A. 표 오탐 판정 — 33·34·116쪽은 표인가 ★

### 판정: **p33·p34는 표가 아니다. 명백한 4-8 오탐이다.** p116은 형식상 2열 매칭 목록이며, 표로 처리해도 화면은 맞지만 **퀴즈 파서에는 손실**이다.

Build의 보고를 믿지 않고 세 쪽의 줄 목록을 원문 순서·좌표·run 분할까지 출력해 직접 읽었다.

**p33 (region `33:t0`, 3줄)** — 문항 `I-123.`의 보기 A·B·C다:

```
33:21 body   I-123. Which of the following conditions is associated with
33:22 body   hyponatremia and suppression of circulating antidiuretic
33:23 body   hormone levels?
33:24 table  x60:"A." | x81:"Central diabetes insipidus"    ← region 33:t0
33:25 table  x60:"B." | x81:"Cirrhosis"                     ← region 33:t0
33:26 table  x60:"C." | x81:"Dehydration"                   ← region 33:t0
33:27 body   D. Heart failure
33:28 body   E. Psychogenic polydipsia
```

표의 흔적이 전혀 없다. 같은 문항의 보기 D·E는 `body`로 남아 **한 문항의 보기가 세 개는 표, 두 개는 문단으로 찢겼다.** p34의 두 region(`A. Administer fomepizole …`, `A. Diascopy …`)도 같은 모양이다.

**왜 표로 잡히는가 — 느슨한 조건의 정체.** 보기 줄은 글머리 문자(`A.`)와 본문 사이에 21 pt(≈2.1 em)의 **행잡이 들여쓰기**가 있다. 4-4의 `RUN_GAP_FACTOR 1.2`는 이것을 레이아웃 간격으로 보아 run을 둘로 쪼갠다. 그러면 4-8의 `cand` 조건(`role==='body'` + `runs.length >= 2`)을 충족하고, 세 줄의 run 시작 x가 60·81로 완전히 일치하니 `alignedColumns = 2 >= 2`, 줄 수 3 = `TABLE_MIN_LINES`. **네 조건이 모두 최소치로 겨우 충족된다.** 즉 느슨한 것은 어느 한 조건이 아니라 "**라벨 + 행잡이 들여쓰기**를 2열로 세는 것" 자체다.

`D. Heart failure`가 표에 안 들어간 이유는 그 줄에서 pdf.js가 `"D. Heart failure"`를 한 아이템으로 내보내 run이 1개이기 때문이다 — **표 판정이 pdf.js의 아이템 쪼개기 우연에 좌우된다.**

### 전수 영향 범위 — 3쪽이 아니다

"표 role로 흡수된 문항·보기 줄"을 729쪽 전수로 셌다(`rv_tblA.mjs`):

| | 1c (`f7d50aa`) | 1d (`2145c90`) |
|---|---:|---:|
| 표로 먹힌 문항·보기 줄 | **36** | **46** |
| 그런 쪽 | **11** | **13** |
| kind가 변한 쪽 | — | p33(option −3), p34(option −6), p116(question −1) |

**1d가 만든 결함이 아니다.** 같은 오탐이 1c에도 11쪽 36줄 있었고(p13·p27·p112·p116·p431·p511·p553 등), 1d가 보기 줄을 `heading`→`body`로 되돌리면서 후보가 늘어 **2쪽 10줄**이 추가됐을 뿐이다. Build가 "33·34·116쪽 3장에서만"이라고 한 것은 **1d 전후 차이**로는 맞지만 **현상의 범위**로는 틀렸다. 실제 범위는 13쪽 46줄이다.

### 2단계·9단계에 주는 영향

`role: 'table'` 줄은 `groupParagraphs`의 `isFlowRole` 게이트에서 **문단에 아예 들어가지 않는다.** 따라서 5절 파서는 그 보기를 볼 방법이 없다(원본 뷰 크롭으로만 보인다). spec 5-3의 "보기가 하나도 없으면 문항 후보 취소"까지 가지는 않지만(D·E가 남는다), **보기 문자 순서 A,B,C…의 연속성 검사가 깨져** 해당 문항이 `unverified`로 떨어진다. p116은 매칭형 문항 4개가 통째로 사라진다. 영향 문항은 13쪽에 걸쳐 십수 개 규모이고, spec 4-11 P5의 "표가 없는 본문 10페이지에서 오탐 0건"은 13/729 = 1.8%이므로 무작위 10쪽 표본에서는 통과해 버린다 — **P5로는 못 잡는 결함이다.**

### 조치 권고 — 고칠 수 있다. 다만 spec 4-8 개정이 먼저다

스크래치패드 사본에서 최소 패치를 만들어 전수로 재고 왔다. `detectTables`의 후보 판정에서 **첫 run이 라벨 하나뿐인 줄**을 빼는 것이다:

```js
const lbl = (((l.runs || [])[0] || {}).items || []).map(it => it.str).join('').trim();
const isLabel = /^[A-E]\.$/.test(lbl) || /^(?:[IVXLC]{1,5}-)?\d{1,3}\.$/.test(lbl);
const isCand = l.role === 'body' && (l.runs || []).length >= 2 && !isLabel;
```

| 지표 | 현재 | 패치 |
|---|---:|---:|
| 표 region | 262 | **252** |
| 표로 먹힌 문항·보기 줄 | 46 | **10** |
| `TABLE X-n` 캡션이 있는 150쪽 중 region 감지 | 101 | **101 (불변)** |
| 문단 `option` | 6,228 | **6,264** |
| `heading`/`question`/`answer`/`list` | 1,009 / 1,392 / 1,187 / 274 | **전부 불변** |

**진짜 표는 하나도 잃지 않으면서 오탐만 36줄 걷힌다.** 남는 10줄은 p116 같은 2열 매칭 목록과 p431의 혈역학 표(보기 A~E가 실제 표의 행인 경우)로, 이것은 표로 보는 편이 맞다.

**그런데 이 규칙은 spec 4-8에 없다.** 4-7과 4-9는 2026-09-18에 "명시적 번호·글머리 패턴은 약한 신호를 이긴다"는 원칙을 받았지만 4-8은 받지 않았다. 나는 `spec.md`를 고칠 수 없고, spec에 없는 휴리스틱을 코드에만 몰래 넣는 것은 이 프로젝트의 작업 방식(spec → Build → Review)을 깨는 일이라 **적용하지 않았다.** 사용자가 4-8에 한 줄(감지 후보에서 라벨 전용 run을 가진 줄 제외)을 추가하면 위 패치를 그대로 쓰면 된다. 3줄짜리 Build 과제이고, 회귀 측정은 이미 위 표로 끝나 있다.

---

## 1cd-4. B. 양방향 오탐 사냥 ★

### (1) 줄어든 heading 줄 1,781개 — 진짜 제목이 섞였는가

**섞이지 않았다.** 세 가지 독립된 확인을 했다.

**① 강등된 줄의 전수 성질 검사.** 1c와 1d의 같은 줄(`id`+`text` 일치)을 대조해 `heading → body` 1,777건, `heading → table` 4건(§1cd-3의 그 줄들)을 얻었다. 합 1,781로 오케스트레이터 수치와 일치한다. 그 1,777건에 대해 `isQuestionStart || isOptionStart || isAnswerStart`를 다시 돌렸다:

```
강등된 줄(heading→body) 1777 | 그중 번호·글머리 패턴 아님: 0
```

**패턴에 걸리지 않는데 강등된 줄은 0건이다.** 가드가 의도한 집합 밖을 건드리지 않았다.

**② heading 문단 집합의 완전 일치.** 총수(1,009)가 같은 것은 "잃은 만큼 얻었다"로도 설명되므로, 쪽·텍스트 단위로 다중집합 비교를 했다:

```
heading 문단: 양쪽 공통 1009 | NEW 에만 0 | OLD 에만 0
```

**한 개도 바뀌지 않았다.** 강등된 1,781줄 중 어느 것도 "그 줄만으로 이루어진 heading 문단"이 아니었다는 뜻이다.

**③ 표본 육안 판정.** 강등 줄을 "제목처럼 보이는 순서"로 골랐다 — `A.`로 시작 + 45자 이하 + 4낱말 이하 + 마침표 없음 = 434건. 그 앞머리 25건과, 대문자 비율 80% 이상인 3건(`"A. BRCA2"`, `"A. ADAMSTS13 <10%"`, `"A. CFTR"`), 짧은 문항형 18건(`"III-64. Penicillin"`, `"V-4. Myasthenia gravis"` 등)을 뽑아 해당 쪽의 줄 목록을 원문 순서로 출력해 읽었다. 전부 **약물명·진단명 보기** 또는 **매칭형 문항 항목**이었다. 예: p173은 `III-59. … EXCEPT:` 아래 `A. Dog: ciprofloxacin` / `B. Cat: amoxicillin-clavulanate` / … 가 이어진다. 제목은 한 건도 없었다.

### (2) 반대 방향 — 진짜 제목이 `question`·`option`으로 샜는가

**샌다. 실재하고, 내가 전수로 셌다. 다만 spec이 이미 예상한 자리이고 규모가 작다.**

먼저 위험군 확인: `"I. INTRODUCTION"` 형태는 **안전하다**. `QUESTION_RE`는 로마숫자만으로는 걸리지 않고 반드시 `\d{1,3}\.`를 요구한다(`isQuestionStart('I. INTRODUCTION') === false` 직접 확인). 위험한 것은 `"A. Pathophysiology"` 형태이고, `isOptionStart('A. Pathophysiology') === true`다.

전수 사냥 결과, 실제로 샌 것은 **본문 제목이 아니라 표 안의 개요(outline) 라벨**이었다:

```
question 문단 1,392개 = 로마숫자 접두 1,291 + 맨 번호 101
맨 번호 101개 중 TABLE 캡션 창 안: 83   ← 가짜 문항
option 문단 6,228개 중 TABLE 캡션 창 안: 41  ← 가짜 보기
```

실물(p573, `TABLE VIII-14 Mechanisms of Autoimmunity`):

```
body     TABLE VIII-14 Mechanisms of Autoimmunity I. Exogenous
option   A. Molecular mimicry          ← 표 안의 개요 라벨
option   B. Superantigenic stimulation
question 1. Loss of immunologic privilege
question 2. Presentation of novel or cryptic epitopes
```

`I.`은 여전히 `heading`이고, 그 하위의 `A.`·`1.`이 보기·문항으로 샌다. p292(`TABLE III-188`)·p380(`TABLE IV-40`)도 같다. 비율은 question의 **6.0%**, option의 **0.66%**다.

**판정: 차단 아님 — spec이 이 자리를 알고 있고, 방어는 9단계에 있다.** spec 5-3은 "번호 연속성이 핵심 필터: 해설 본문 안의 '3. ' 같은 열거를 문항으로 오인하지 않게 한다"고 명시하고, 실제 문항은 729쪽에서 **1,291/1,392가 로마숫자 접두**를 달고 있어 파서가 접두 유무만으로도 대부분 걸러낼 수 있다. 근본 원인은 kind 판정이 아니라 **그 표들이 4-8에서 표로 감지되지 않는 것**(미탐)이다 — 4-8의 미탐이 4-9의 오분류로 나타난 것이므로, 고칠 자리는 4-8이다(§1cd-3과 같은 자리). 2단계를 막지 않는다.

또 `kind`가 `question`·`option`인데 문단의 **모든 줄 role이 `heading`**인 경우를 전수로 찾았다 — **7건, 전부 p380의 한 표**다(`"1. Exercise"`, `"2. Acute illness with fever, infection, pain"` …). 이것이 1c의 우선순위 변경이 현재 실제로 발동하는 **유일한** 자리다(§1cd-5로 이어진다).

고아 보기(`A.`로 시작하는데 앞에 문항이 없고 뒤에 `B.`도 없는 option 문단)는 729쪽에서 **6건**이며, 확인해 보니 4건은 위 표 개요 라벨, 2건은 컬럼 경계에서 잘린 보기였다. 새로 생긴 제목 오분류는 없었다.

---

## 1cd-5. C. 테스트에 이빨이 있는가 — 의도적 파손 ★

`B10`~`B20` 11개를 읽고 spec의 기대값을 실제로 주장하는지 확인한 뒤, 코드를 하나씩 되돌려 **무엇이 실패하는지** 쟀다. 매번 `git checkout --`으로 원복하고 다음 파손을 걸었다.

| # | 파손 | 실패한 테스트 | 판정 |
|---|---|---|---|
| (a) | `segment.js`의 `QUESTION_RE`·`ANSWER_RE`에서 로마숫자 접두 제거 | **B10, B11, B15, B16, B17** (5개) | ✔ 이빨 있음 |
| (b) | `blocks.js`의 kind 우선순위를 1c 이전으로 되돌림(`heading`을 맨 앞) | **없음 (54/54 통과)** | ✘ **빈자리** |
| (c) | `blocks.js`의 1d 가드(`!numbered`) 제거 | **B17, B18** (2개) | ✔ 이빨 있음 |
| (d) | 가드를 `bigger` 경로까지 확대(`(bigger && !numbered) \|\| shortNoStop`) | **B19** | ✔ B19는 대조군이 아니라 진짜 가드 |
| (e) | 짧은 줄 규칙을 통째로 제거(가드를 무한히 넓힌 것과 동치) | **B20** | ✔ B20도 진짜 가드 |

원복 확인: `git status --short`에 `apps/medreader/js/` 변경 0건, `git diff --stat` 빈 출력(내가 추가한 테스트 파일 제외).

**(b)가 이번 Review의 두 번째 발견이다.** 1c가 넣은 kind 우선순위(`answer → question → option → heading`)는 **1d가 들어온 뒤로는 테스트가 전혀 지키지 않는다.** 이유는 인과적이다: `B12`(`"A. Primary"` → option)·`B13`은 1d의 role 가드 덕분에 그 줄이 더 이상 `role: 'heading'`이 아니고, 그러면 `paragraphKind`의 `allHeading` 검사가 false라 **순서가 무엇이든 결과가 같다.** 우선순위가 아직 실제로 발동하는 자리는 `bigger` 경로로 `heading`이 된 줄뿐이며(전수 7건, §1cd-4), 그 자리를 고정하는 테스트가 없었다.

→ 내가 `B21`·`B22`를 추가해 메웠다(§9cd). 추가 후 파손 (b)를 다시 걸면 **B21·B22가 정확히 실패한다**(`tests 56 / pass 54 / fail 2`).

**`B19`·`B20`에 대한 별도 판정(지침 요구):** Build는 "수정 전에도 통과했다"고 정직하게 보고했지만, 둘은 **대조군이 아니라 작동하는 가드**다. 위 (d)·(e)가 각각 하나씩만 실패시킨다 — 즉 "가드를 과하게 넓히면" 이 둘이 잡아낸다.

---

## 1cd-6. D. `parseQuestionNumber` / `parseAnswerStart` 계약

9단계 파서가 쓸 계약이므로 spec 5-3과 한 줄씩 대조하고, 729쪽 실데이터로 회수율을 쟀다.

```
"IV-62. The answer is C. (Chap. 42)"   → answer {IV, 62, [C]}   q {IV, 62}   ✔ spec 일치
"12. The answer is E."                 → answer {null, 12, [E]}  q {null, 12} ✔ 단일 형태
"7. The answers are B and D."          → [B, D]   ✔ (B16이 잡은 버그 — 통째 [A-E] 긁기가 아님)
"7. The answers are B, D."             → [B, D]   ✔ 쉼표
"7. The answers are B & D."            → [B, D]   ✔ 앰퍼샌드
"  I-1. The answer is A."              → {I, 1, [A]}   ✔ 선행 공백
"IX-104. the answer is a. (chap. 1)"   → {IX, 104, [A]} ✔ 대소문자 무시·정규화
"1000. The answer is A."               → null     ✔ 번호 3자리 상한
"F. The answer is A."                  → null     ✔ 보기 문자는 문항 번호가 아님
"7. The answers are B or D."           → [B]      △ spec 5-3 정규식에 or 가 없다(구현은 spec 충실)
"7. The answers are A, C, and E."      → [A, C]   ✘ **E 가 조용히 사라진다**
```

- **`"A, C, and E"`에서 마지막 글자가 소실된다.** spec 5-3의 `(?:,|and|&)`가 `", and"`(쉼표 + and)를 한 구분자로 보지 못해 캡처가 `C`에서 끊긴다. `null`이 아니라 **틀린 정답 집합을 자신 있게 돌려주는** 형태라 더 나쁘다. 729쪽에는 복수 정답 문단이 **0건**이라 지금 당장 피해는 없다(아래 참조). `or`도 같은 성질이다. → spec 5-3 정규식 제안: `(?:\s*(?:,|,?\s*and|&|or)\s*)`.
- **회수율 실측**: 문단 텍스트가 `N. The answer(s) is/are`로 시작하는 것을 전수로 모아 파서에 넣었다 → **성공 1,187 / 실패 3**. 성공 수는 `answer` kind 문단 수(1,187)와 정확히 일치한다. 복수 정답 0건.
- **실패 3건은 실제 데이터가 spec 가정을 벗어난 경우다**: p707 `X-44. The answer is F.`, p710 `X-52. … F.`, p723 `X-82. … F.` — **보기가 A~F인 6지선다**가 이 책에 존재한다. spec 5-3은 `[A-E]`·"최대 5개(E)"로 못 박혀 있어 `isOptionStart`도 `F.`를 받지 않는다(`"F. …"` 형태 줄이 729쪽에 5건: p549·573·683·684·689). → spec 5-3 제안: `[A-E]` → `[A-F]`. 영향이 8건뿐이라 2단계를 막지 않는다.

---

## 1cd-7. E. 회귀·구조·순수성·결정성·하이픈

- **기존 테스트 기대값 무변경**: §1cd-1. 삭제 줄 0건.
- **순수성(16-A·16-K)**: `js/text/*.js`에서 `document|window|fetch|indexedDB|pdfjsLib|globalThis|localStorage` grep **0건**. `from '../ui/` **0건**.
- **결정성(16-A)**: 문제 쪽 20개(p1·12·13·33·34·61·116·173·292·380·431·511·553·573·663·691·707·710·723·729)를 각각 3회 처리해 `JSON.stringify` 비교 → **20/20 동일**.
- **`algoVersion`**: 3 → 4, 사유 주석 있음, 출력 객체에 실제로 실린다. spec 9-4의 "`algoVersion`이 오르면 `cursor ← 1`, `failed ← []`" 규약과 정합적이다(1d는 role과 문단 경계를 모두 바꾸므로 v3 페이지 재사용 불가 — 주석이 그렇게 적고 있다).
- **`dev/proto-lines.html` (16-K)**: `python -m http.server 8000`으로 띄워 접속 → 화면 정상, **콘솔 에러·경고 0건**. 페이지 컨텍스트에서 `js/text/layout.js`를 직접 import 해 합성 items로 `buildPageLayout`을 돌린 결과 `algoVersion 4`, 문단 kind `[body, question, option]`, 문항 stem 줄 role `body` — **브라우저에서도 1d 가드가 작동한다**(Node 테스트와 동일). 내가 띄운 서버는 검증 후 정지했다.
- **`KEEP_HYPHEN_SUFFIXES`(사용자가 채운 23개) 검증** — 지침대로 "너무 넓어서 줄바꿈 하이픈을 잘못 살리는 사례"를 729쪽에서 직접 찾았다.
  - H1~H5는 깨지지 않는다(단위 테스트 통과, 그리고 `hyphen.test.mjs`의 H1 `cardio-`+`vascular`가 여전히 결합).
  - 전수에서 하이픈 결합 판정은 **접두 유지 313 / 접미 유지 54 / 하이픈 삭제 결합 5,802**. 접미 규칙이 발동한 (head-tail) 쌍 **46종을 전부 출력해 읽었다.**
  - **오작동 1건 발견: `cor-` + `related` → `"cor-related"`** (올바른 결과는 `correlated`). `related`가 목록에 있어서 생긴다. 같은 성질의 잠재 위험은 `in-`+`dependent`, `un-`+`related`이지만 729쪽에서는 발동하지 않았다.
  - 나머지 45종은 전부 진짜 복합어다(`angiotensin-converting` 4, `drug-induced` 3, `weight-based` 3, `methicillin-resistant`, `piperacillin-tazobactam`, `salpingo-oophorectomy` …). **정확도 53/54 = 98.1%.**
  - 반대로 **spec 4-10이 열거한 7개 중 `macrophage`가 빠져 있다** — p144에 `granulocytemacrophage`가 남아 있다.
  - 20자 이상 낱말은 136 → **121**로 줄었다(1b Review의 측정과 같은 방법). 남은 것은 대부분 진짜 긴 의학 낱말(`cholangiopancreatography` 20회 등)이고, 하이픈 소실 흔적은 `granulocytemacrophage`·`trimethoprimsulfamethoxazole`·`intestinalcolonization`·`bronchiolitisinterstitial`·`methylglutarylcoenzyme` 등 소수다.
  - **판정: 사용자 목록은 유효하다. 내가 건드리지 않았다.** 결함 1건(`related`)과 누락 1건(`macrophage`)을 근거와 함께 보고만 한다(§8cd #4).
- **범위 준수**: `git status --short` → `apps/medreader/js/` 수정 0건. 내 변경은 `apps/medreader/tests/blocks.test.mjs`(+33줄)와 `apps/medreader/review.md`뿐. `spec.md`·블로그 본체·`apps/2048/`·`.nojekyll`·`.claude/`·`launch.json` 미수정. 레포에 PDF·`node_modules`·`package.json` 없음. 원서 텍스트를 레포에 기록하지 않았다(이 보고서에 인용한 문장은 결함 판정에 필요한 최소 발췌다). 커밋·푸시하지 않았다.

---

## 1cd-8. F. 잔존 P7 결함의 분류와 "1e가 필요한가" ★

Build의 분류(구조적 229 / 진짜 241, 완화 P7 83.5%)를 받아쓰지 않고 **다시 분류했다**(`rv_p7.mjs`, `rv_split.mjs`).

**완화 P7(끼어든 문단 허용, 다음 question/answer 전까지 option 2~5개) = 83.8%** — Build의 83.5%와 사실상 일치.

**엄격 P7 실패 470건의 내역(전수):**

| 건수 | 유형 | 성격 |
|---:|---|---|
| **246** | 보기 앞에 `body` 문단이 끼어듦 (`question > body > option …`) | **진짜 분할** |
| 82 | 표 속 번호 열거가 `question`으로 잡힌 가짜 문항 | 문항이 아님 (§1cd-4) |
| 67 | 문항이 쪽의 마지막 문단 | 쪽 경계, 구조적 |
| 46 | 보기 자체가 문단에 없음 | 혼합(표 흡수·그림 문항) |
| 26 | 다음 문단도 `question` (짝짓기형·표 개요) | 구조적 |
| 3 | 보기 6개 이상(연속 문항 병합) | 경계 |

**246건의 원인을 다시 쪼갰다** — `question` 문단 바로 뒤가 `body`인 경계 214곳에서 4-9의 어느 조건이 발동했는지 재계산:

| 건수 | 발동한 4-9 조건 |
|---:|---|
| **107** | **짧은 마지막 줄** (`prev.bbox.x1 < colLeft + 0.70·colWidth` + 앞 문장 종결) |
| 75 | 컬럼 바뀜 (`cur.col !== prev.col`) — spec이 명시적으로 요구하는 동작 |
| 22 | 행간 급증 — 대부분 `FIGURE I-nn` 캡션이 stem 사이에 들어온 경우 |
| 10 | 들여쓰기 |

**Build의 진단은 맞다.** 최대 덩어리는 4-9의 "짧은 마지막 줄" 규칙이고, 이것은 stem이 여러 문장일 때(`"… for a routine physical."` 다음에 `"His blood pressure is 119/76 …"`) 문단을 가른다. 코드 버그가 아니라 **규칙이 문항 stem을 모르는 것**이므로 고치려면 spec 4-9 개정이 필요하다는 Build의 판단도 맞다.

### 그래서 1e가 필요한가 — **아니다. 2단계로 가도 된다.**

1. **9단계 파서의 계약이 이미 여러 문단짜리 stem을 전제한다.** spec 5-2의 `ParsedQuestion.stemParaIds`는 **배열**이고, 5-3은 문항 본문의 끝을 "첫 보기(`A.`) 직전까지"로 정의한다. 즉 파서는 `question` 문단 하나만 집는 것이 아니라 **첫 보기 전까지의 문단을 모두 stem으로 흡수**하도록 설계돼 있다. 246건의 `question > body > option` 패턴은 그 설계로 **손실 없이 복원된다.** 4-11의 P7 문구("질문 문단 1개 + 보기 문단 5개")가 파서가 실제로 요구하는 것보다 엄격하다.
2. **잔여의 상당수는 spec이 이미 다른 장치로 처리한다.** 컬럼 바뀜 75건과 쪽 마지막 67건은 4-9의 `continuesNext`/`continuesPrev`와 5-2의 "여러 페이지에 걸칠 수 있다"가 담당한다.
3. **P7 66.2% / 완화 83.8%는 1e의 손익분기를 넘지 않는다.** "짧은 마지막 줄" 가드를 넣어도 회수는 107건(+7.7%p)이고, 그 규칙은 해설 문단에서는 정상 작동 중이라 문항 문맥(문단 시작이 `isQuestionStart`인지)을 `newParagraph`에 넘기는 **상태 추가**가 필요하다. 이것은 4-9의 함수 시그니처를 바꾸는 일이라 spec 개정 → Build → Review 한 바퀴를 더 돌아야 한다.
4. **더 시급한 것은 P7이 아니라 §1cd-3의 표 오탐이다.** 그쪽은 문단에서 **줄이 사라지므로 파서가 복원할 수 없다.** 3줄 패치로 36줄이 돌아오고 진짜 표 손실은 0이다.

**권고 순서**: ① spec 4-8에 라벨 가드 한 줄 추가 → 3줄 Build(§1cd-3의 패치, 회귀 측정 완료) → ② 2단계 착수 → ③ 여유가 생기면 spec 4-9의 문항 stem 가드(P7 +7.7%p) → ④ spec 5-3의 `[A-E]`→`[A-F]`와 정답 구분자 정규식.

---

## 8cd. 발견한 문제 (1c·1d)

### 차단 — 없음

무엇을 어떻게 확인했는지는 §1cd-1(단위 테스트·기대값 무변경), §1cd-2(전수 재현), §1cd-4(양방향 오탐 전수 + 표본 육안), §1cd-5(의도적 파손 5종), §1cd-7(순수성·결정성·범위)에 있다.

### 중간

1. **4-8 표 오탐이 문항·보기를 삼킨다 — 13쪽 46줄** (§1cd-3). 1d가 만든 결함은 아니고(1c에도 11쪽 36줄), 1d가 2쪽 10줄을 더했다. p33·p34는 명백한 오탐이며 한 문항의 보기가 셋은 표, 둘은 문단으로 찢긴다. **검증된 3줄 패치가 있고 진짜 표 손실은 0이다. spec 4-8 개정이 선행돼야 해 적용하지 않았다.**
2. **1c의 kind 우선순위가 1d 이후 테스트로 지켜지지 않았다** (§1cd-5 파손 (b)). 되돌려도 54/54가 통과했다. → `B21`·`B22`로 메웠다(§9cd).
3. **표 안 개요 라벨이 문항·보기로 샌다 — question의 6.0%(83건), option의 0.66%(41건)** (§1cd-4). 근본 원인은 4-8의 **미탐**(그 표들이 표로 잡히지 않음)이고, spec 5-3의 번호 연속성 필터가 9단계에서 대부분 걸러낸다.

### 경미

4. **`KEEP_HYPHEN_SUFFIXES` 오작동 1건 + 누락 1건** (§1cd-7). `related` 때문에 `cor-`+`related` → `cor-related`(정답: `correlated`). 46종 중 1종, 발동 54건 중 1건. 그리고 spec 4-10이 열거한 `macrophage`가 목록에 없어 p144에 `granulocytemacrophage`가 남았다. **사용자가 채운 값이라 건드리지 않았다.** 고친다면 `related` 제거(또는 `cor`를 `KEEP_HYPHEN_PREFIXES` 예외로 처리)와 `macrophage` 추가다.
5. **`parseAnswerStart`가 `"A, C, and E"`에서 마지막 글자를 조용히 버린다** (§1cd-6). spec 5-3 정규식 그대로의 한계이고 729쪽에는 복수 정답이 0건이라 현재 피해 없음. 9단계 전에 spec을 고치는 편이 좋다.
6. **이 책에는 6지선다(A~F)가 있다** (§1cd-6). `The answer is F.` 3건, `F.` 보기 줄 5건이 파서 밖으로 떨어진다. spec 5-3의 `[A-E]` 가정이 실데이터와 어긋난다.

### 제안

7. spec 4-8에 "감지 후보에서 **첫 run이 보기·문항 라벨뿐인 줄** 제외"를 추가할 것(§1cd-3). 4-7·4-9가 2026-09-18에 받은 원칙을 4-8만 못 받았다.
8. spec 4-11의 P7 문구를 파서 계약에 맞게 다듬을 것 — `stemParaIds`가 배열인 이상 "질문 문단 1개"는 필요 이상으로 엄격하다(§1cd-8). 완화 P7(83.8%)을 병기 지표로 두면 이후 단계의 회귀 감시가 정확해진다.
9. spec 5-3의 정답 구분자에 `,\s*and`와 `or`를 넣고 보기 범위를 `[A-F]`로 넓힐 것(§1cd-6).
10. 4-9의 "짧은 마지막 줄"·"들여쓰기" 규칙에 문항 stem 가드를 둘 것(P7 +7.7%p, §1cd-8). 우선순위는 위 7번 다음이다.

---

## 9cd. 내가 고친 것 (1c·1d)

### (1) `apps/medreader/tests/blocks.test.mjs` — `B21`·`B22` 추가 (+33줄)

**이유**: 1c가 넣은 spec 4-9의 kind 우선순위를 되돌려도(파손 (b)) 54개 테스트가 **전부 통과**했다 — 규칙이 코드에만 있고 테스트가 지키지 않는 상태였다. 1d의 role 가드 때문에 `B12`·`B13`의 픽스처에서는 줄 role이 더 이상 `heading`이 아니어서 `paragraphKind`의 순서가 결과에 영향을 주지 않는다.

**무엇으로 메웠나**: 우선순위가 지금도 실제로 발동하는 유일한 자리 — `fontSize >= 1.15·Fm`(`bigger` 경로)로 `role: 'heading'`이 된 줄이 문항·보기 형태일 때 — 를 고정했다. `B21`은 큰 폰트 `"I-5. Disorders of the Cardiovascular System"`이 role `heading`이면서 kind `question`임을, `B22`는 같은 구조의 보기 형태가 kind `option`임을 주장한다. spec 4-9의 "명시적 번호·글머리 패턴이 있는 문단이 항상 우선"을 그대로 옮긴 것이고, 기존 케이스는 한 줄도 건드리지 않았다.

**확인**: 추가 후 `tests 56 / pass 56 / fail 0`. 파손 (b)를 다시 걸면 `pass 54 / fail 2`로 **B21·B22만** 실패한다.

그 밖에는 아무것도 고치지 않았다. `js/text/*`·`js/config.js`는 한 글자도 바꾸지 않았다 — 발견한 결함 중 코드에서 고칠 수 있는 것(§1cd-3의 표 오탐)은 **spec 4-8에 없는 규칙**이어서 `spec.md` 개정이 선행돼야 하고, `KEEP_HYPHEN_SUFFIXES`는 사용자가 채운 값이라 근거만 보고했다.

---

## 10cd. 2단계에 넘길 주의사항 (1c·1d에서 추가된 것)

1. **`algoVersion = 4` 재추출 경로는 이제 두 번 필요했다.** v1→v2(컬럼), v3→v4(role·문단 경계). 2단계의 `extract.js`는 "저장된 `algoVersion`이 현재보다 작으면 `cursor ← 1`, `failed ← []`"를 **반드시** 구현해야 한다(spec 9-4). 1c·1d로 `paragraphs[].kind`와 `lines[].role`이 대규모로 바뀌었으므로 v3 이하 페이지는 5절 파서가 쓸 수 없다.

2. **9단계 파서는 `question` 문단 하나를 stem으로 보면 안 된다.** 전수에서 246건이 `question > body > … > option` 형태다(§1cd-8). spec 5-2의 `stemParaIds`(배열)와 5-3의 "첫 보기 직전까지"를 문자 그대로 구현하면 손실이 없고, `question` 문단 1개만 집으면 P7 66.2%가 그대로 파서 정확도가 된다.

3. **`role: 'table'` 줄은 파서에게 보이지 않는다.** 표로 오탐된 보기 46줄(13쪽)이 문단 밖에 있다(§1cd-3). 파서가 보기 문자 연속성(A,B,C…)이 끊긴 문항을 만나면 **오류가 아니라 `unverified`로 강등**하고 해당 쪽의 `regions`를 함께 기록해 두면, 4-8을 고친 뒤 재파싱만으로 복구된다.

---
---

# Review — MedReader 2a·2b·2c단계 (서비스 계층: 측정 도구 · 저장본 · db · hash · loader · extract)

- 검증일: 2026-09-21
- 검증 대상: `cc803af`(2a 측정 도구) · `d70433c`(2b 폭 위생·저장본) · `44a2a40`(2c db·hash·loader·extract) · `59ab762`(DB_VERSION 1→2). 브랜치 `claude/medreader-spec-planning-i8ge24`
- 검증 환경: Windows 10 Pro 19045 / Node **v24.14.0** / Chromium(내장 브라우저 패널, `python -m http.server 8000`) / `pdfjs-dist@5.4.149` legacy
- 기준 문서: `spec.md` 2-4 · 3-1~3-3 · 4-2 · 7-5 · 9-1·9-2·9-4 · 13절 · 14절 · 16-B·16-K · 18절, `.claude/tasks/medreader-build-2a.md`·`-2b.md`·`-2c.md`

---

## 종합 판정 (2a·2b·2c)

**조건부 통과** — 차단 0건, **중간 5건(그중 4건은 내가 고쳤다)**, 경미 7건, 제안 8건.

→ **3단계(spec 19절 3번)로 진행해도 되는가: 예.** 단, 아래 §10ec의 조건 2개를 3단계 착수와 **같은 커밋 안에서** 처리할 것.

근거:

- **재개 모델에서 새 결함 3건을 찾았고 전부 실기(브라우저)로 재현했다**(§2c-3). 2c가 스스로 고친 E16·E19와 **같은 종류**의 병이 세 자리 더 남아 있었다. 셋 다 고쳤고, 고치기 전/후를 같은 하네스로 재측정했다(298회 → 1회 / `done=true` 오판 → 20쪽 정상 추출).
- **v1 → v2 마이그레이션이 실제 IndexedDB에서 데이터를 보존한다**(§2c-6). 스텁이 아니라 진짜 v1 DB를 만들어 확인했고, `docId_algoVersion` 인덱스가 **기존 레코드를 소급해 담는 것**까지 봤다.
- **`QuotaExceededError` 경로가 실제로 돈다**(§2c-6). 2c가 `×`(미검증)로 신고한 자리다. `put` 스텁 → `DbError(ERR_DB_QUOTA)` → `STATUS.QUOTA` + `fatal` 이벤트 → `documents` 영속화까지 한 줄로 이어진다.
- **해시 충돌을 실제로 만들었다**(§2c-5). 대상 PDF의 표본 밖 4,096바이트를 바꾼 파일이 **같은 `fileHash`** 를 낸다. 목적(동일성 판별)에 비추면 수용 가능하지만, 코드 주석이 약속한 2차 방벽(`pageCount` 비교)이 **아직 구현돼 있지 않다** — 3단계 조건으로 넘긴다.
- **2a 측정 도구가 틀린 숫자를 내고 있었다**(§2c-7). `slimLayout`이 2b의 축소 규칙을 반영하지 못해 저장본을 **34.0KB/쪽**(진짜 21.9KB)으로 재고 있었다. 7000쪽 환산이 **238MB 대 64MB**로 갈리는 차이다. 고쳤고, 고친 뒤 도구가 내는 6.2MB/729쪽이 오케스트레이터의 브라우저 실측 6.65MB와 7% 안에서 만난다.
- 의도적 파손 18종 중 14종이 테스트를 깨뜨린다(§2c-8). 빈 칸 4개는 전부 근거와 함께 남긴다.
- 순수성·의존 방향·버전 문자열·`config.js` 불변·기존 테스트 기대값 무변경 전부 확인(§2c-2).

**단, 7000쪽 실자료로는 아무것도 검증되지 않았다.** 이 Review가 만진 모든 규모 수치는 729쪽 × 22.7MB에서 나온 것이고, 자료가 바뀌면 §2c-7의 측정을 **가장 먼저 다시 돌려야 한다.**

---

## 2c-1. 재현하지 않은 것과 재현한 것

오케스트레이터가 이미 확인한 것(134/134 pass, 729쪽 종단 `usage 29.34MB`·쪽당 `9.35KB`, 343쪽 저장본 왕복, 2b 전수 지표)은 **다시 세지 않았다.** 대신 그 숫자들이 **거짓일 수 있는 자리**를 팠다.

내가 독립적으로 돌린 것:

| 무엇 | 방법 |
|---|---|
| 재개 모델 적대적 시뮬레이션 11종 | 순수 함수만으로 루프를 재구성 |
| `Extractor` 실동작 9종 | 브라우저에서 가짜 `pdfDoc` + 진짜 `db.js`/IndexedDB |
| `toStored`/`fromStored` 경계 8종 | Node, 합성 + 실 픽스처 |
| 해시 충돌 합성 | 실제 22.7MB PDF의 바이트를 고쳐 만든 두 파일 |
| v1→v2 마이그레이션·`blocked`·`versionchange`·중단된 upgrade·쿼터 | 브라우저 실 IndexedDB |
| `profile.mjs` 출력 교차 검증 | `buildPageLayout`·`profile-lib`을 **전혀 쓰지 않는** 별도 집계기 |
| 의도적 파손 18종 | 파일 변형 → 전체 테스트 → 원복 |

시작 시점 테스트 **134 / 134 pass**(재확인). 내 회귀 테스트 6개를 더한 뒤 **140 / 140 pass**.

---

## 2c-2. 구조 · 순수성 · 회귀 (F)

| 확인 | 결과 |
|---|---|
| `text/*` 브라우저 전역 (`document`·`window`·`fetch`·`indexedDB`·`pdfjsLib`·`navigator`·`localStorage`·`sessionStorage`·`crypto`) | **0건** ○ |
| `db.js`·`pdf/*` 의 DOM 조작 | **0건** ○ (`navigator.storage`·`IDBKeyRange`·`EventTarget`·`requestIdleCallback`만 — 서비스 계층 허용) |
| `ui/` import | **0건**(주석 2줄뿐) ○ |
| `apps/medreader/` 경계 이탈 (`../../`) | **0건** ○ |
| `hash.js` 전역 | `globalThis.crypto` **존재 검사**(16-K 예외)와 `TextEncoder`뿐 ○ |
| 오류가 UI 문자열이 아니라 코드인가 | `db.ERR.{QUOTA,BLOCKED,OPEN}` · `loader.ERR_PDFJS_{LOAD,OFFLINE}` · `extract.STATUS.*` 전부 상수. 서비스 계층에 사용자용 영어 문장 **0건** ○ |
| pdf.js 버전 문자열 | **2곳이었다** — `config.js:19`(정본)과 `dev/profile.mjs:90`(설치 안내 문자열). 16-K 위반이라 고쳤다(§9ec (3)). 지금은 정본 1곳 |
| `config.js` 불변 (`git diff cc803af~1..HEAD`) | `EXTRACT` 블록 **추가만**. `KEEP_HYPHEN_SUFFIXES`(사용자가 채운 23개)·`LAYOUT`·`KEEP_HYPHEN_PREFIXES`·`ABBREVIATIONS` **한 글자도 안 바뀜** ○ |
| 기존 테스트 기대값 (`--numstat`) | 6파일 **1,114줄 추가 / 0줄 삭제** ○ |
| `dev/proto-extract.html` 콘솔 (16-K) | 새 탭 로드 → **에러·경고 0건** ○ |
| 모바일 375px | `scrollWidth === clientWidth === 375`, 넘치는 요소 **0개** ○ |
| `.nojekyll` | 존재 ○ |

**D1(`DB_VERSION` 단언 1→2) 변경은 정당하다.** `59ab762`가 `spec.md` 9-1의 "버전 **1**"을 "버전 **2**"로 **먼저** 고치고 테스트를 따라 고쳤다. D1이 주장하는 것은 "코드 값"이 아니라 **"spec과 코드가 같은 값을 말하는가"** 이므로, spec이 움직이면 함께 움직이는 것이 옳다. 게다가 이 파일 자체가 `44a2a40`에서 새로 생긴 것이라 **2a 이전의 기대값은 하나도 건드려지지 않았다.**

---

## 2c-3. A. 재개 모델의 구멍 사냥 ★ — 이번 Review의 핵심

### 결론: **새 결함 3건. 전부 E16·E19와 같은 종류다. 셋 다 고쳤다.**

2c의 자기 신고 2건은 우연이 아니었다. 같은 병(집합이어야 할 것을 불리언으로 관리 / 한쪽 경로가 `failed`를 보지 않음)이 **다른 세 자리에 그대로 남아 있었다.**

### 구멍 ① — 역할 재계산(priority 4)이 던지면 **같은 쪽을 무한히 다시 잡는다** 〔중간〕

`_tick`의 `catch`는 `roleQueue`를 정리하지 않는다. `_recomputeRoles`가 던지면 `roleQueue`에 그 쪽이 그대로 남고, `nextPage`의 마지막 루프가 그것을 다시 돌려준다.

```js
for (const r of rq) if (!busy.has(r)) return { pageNo: r, priority: 4 };
```

**실측(브라우저. 숨은 탭 스로틀을 없애려 `requestIdleCallback`을 `setTimeout(0)`으로 치환):**

```
_recomputeRoles 가 던지게 한 뒤 1.5초
  호출 횟수 298 · pageerror 이벤트 298 · running=true · 종료 이벤트 없음
```

E19가 우선순위 창에서 고친 바로 그 병이다(그때는 99회, 이번은 298회). 실기기에서는 탭이 영원히 idle 시간을 태우고 `done`이 서지 않으며 UI에 `pageerror`가 초당 수백 번 꽂힌다.

### 구멍 ② — **이미 저장된 쪽이 `failed`에 들어가면 영원히 빠지지 않는다** 〔중간〕

`catch`는 `target.pageNo`를 무조건 `failed`에 넣는다. 그런데 `nextPage`의 재시도 경로는

```js
if (!busy.has(f) && !has(f) && !tried.has(f)) return { pageNo: f, priority: 3 };
```

`!has(f)`로 거른다. **저장돼 있으면 재시도되지 않고, 재시도되지 않으면 `_processPage`의 성공 경로(`removeFrom(failed, …)`)를 탈 기회도 없다.** `isComplete`는 `failed.length === 0`을 요구하므로 `done`이 **영구히** 서지 않는다 → 5절 파서·`sectionIndex`가 영영 돌지 않는다.

도달 경로가 둘이다. 둘 다 이미 저장된 쪽에서만 난다.

1. **구멍 ①** — `_recomputeRoles`는 정의상 저장된 쪽만 다시 돈다.
2. `_processPage`가 `db.put('pages')`에 **성공한 뒤** `_saveMeta`가 던지는 경우(`documents` 쓰기 실패).

**실측:** 6쪽 문서를 정상 완료(`done=true`)시킨 뒤 저장된 4쪽을 `failed`에 넣고 재시작 →
`failed=[4]` · `stored.has(4)=true` · `done=false` · `status=paused`. 몇 번을 재시작해도 같다.

### 구멍 ③ — `cursor`가 `pageCount`를 넘으면 **저장된 쪽이 0개여도 `done=true`** 〔중간〕

`isComplete`가 `st.cursor`부터 훑는다. 이것은 "`cursor` 아래는 전부 저장됐거나 실패했다"는 불변식을 **저장본이 지켜 준다고 믿는 것**이다. 그 믿음이 깨지면 `cursor` 하나로 완료가 선다.

**실측(브라우저, 진짜 IndexedDB):**

```
documents.extraction = { cursor: 99999, pagesDone: 0, failed: [], algoVersion: 6 } · pageCount 20
→ prepare() → start()
   done = true · status = done · 'done' 이벤트 발생 · 실제 pages 행수 = 0 / 20
```

순수 함수만으로도 재현된다 — `normalizeExtraction`은 `cursor`의 **하한만** 1로 묶고 상한은 없다.

도달 경로: 같은 `docId`의 `pageCount`가 줄어든 경우. **§2c-5의 해시 충돌과 직결된다** — 표본 해시가 같은 더 짧은 파일을 열면 `findByFileHash`가 기존 문서 레코드를 돌려주고, 그 레코드의 `cursor`가 새 파일의 `pageCount`를 넘는다. 두 결함이 만나면 "빈 문서가 완료 상태로 서재에 앉는다".

### 그 밖에 판 것 — 구멍이 아니었던 자리

| 시나리오 | 결과 |
|---|---|
| 실패 4개가 서로 떨어져 있고 2차 시도에 성공 | 64스텝에 60쪽 전부, `failed=[]`, `done=true` ○ |
| 영구 실패 3개 | 구멍 3개가 `failed`에 **그대로 드러나고** `done`이 서지 않는다 ○ (9-4가 의도한 동작) |
| 중단 → 재개 × 3 (실패 섞음) | 124스텝, 영구 실패 1쪽만 남고 나머지 119쪽 구멍 0 ○ |
| `algoVersion`이 오른 상태 + 일부만 저장 | `cursor←1` · `failed←[]`, 구버전 쪽은 `docId_algoVersion` 인덱스가 걸러 `stored`에 없다 → 50쪽 전부 재추출 ○ |
| 손상된 `extraction` (문자열·음수·`null`·배열·`NaN`·`Infinity`) | `normalizeExtraction`이 전부 안전한 기본값으로 접는다. 던지지 않는다 ○ |
| `advanceCursor` 종료성 (7000쪽) | 0ms, 무한 루프 없음 ○ |
| **같은 문서를 두 탭에서 동시에 추출** | 24쪽 문서에 Extractor 2개 → `pages` 24행(중복 없음), `extraction`도 일치하게 수렴. **다만 build를 91회** 했다(필요 24회) 〔경미〕 |

**두 탭 동시 추출**은 손상을 내지 않는다 — 키가 `[docId,pageNo]`라 `put`이 멱등이다. 위험은 `documents.extraction`의 read-modify-write가 마지막 쓰는 쪽을 이긴다는 것이고, 최악이 "`failed` 한 건이 지워져 그 쪽을 한 번 더 뽑는다"라 자기 치유된다. 3단계에서 `Web Locks` 또는 `BroadcastChannel`로 한 탭만 추출하게 하는 편이 낫다(제안 3).

---

## 2c-4. B. `toStored`/`fromStored` 계약의 경계

**깨지는 입력은 찾지 못했다. 다만 계약에 구멍이 하나 있다.**

| 입력 | 결과 |
|---|---|
| 빈 문단(`lineIds: []`) | `text: ''`. 던지지 않는다 ○ |
| `lineIds`가 없는 줄을 가리킴 | 그 줄을 조용히 건너뛰고 나머지로 조립 ○ (설계대로. 다만 **신호가 전혀 없다** — 경미 10) |
| 표 줄만으로 이루어진 문단 | `groupParagraphs`가 `role='table'`·`regionId` 줄을 흐름에서 빼므로 **만들어질 수 없다.** 억지로 만들어도 왕복은 성립 ○ |
| 하이픈으로 끝나는 줄이 문단 **마지막** | `"… had cardio-"` → 왕복 후 바이트 동일 ○ (`joinHyphen`은 뒤 줄이 있을 때만 발동) |
| 회전 줄(`role: 'rotated'`)이 섞인 페이지 | role 보존, run text 미저장(표 밖), 문단에 미포함 ○ |
| 손상 저장본 (`null`·`undefined`·`'x'`·`42`·`{lines:'no'}`·`{lineIds:'x'}`) | 6종 전부 **던지지 않고** 빈 결과 ○ |
| `toStored` 입력 훼손 / 결정성 | 입력 불변 ○, 2회 결과 `JSON.stringify` 동일 ○ |
| 실 픽스처 8문단 왕복 | 불일치 **0건** ○ |

### ★ `KEEP_HYPHEN_SUFFIXES`를 바꾼 뒤 기존 저장본을 읽으면 — **문단 text가 달라진다. `storeVersion`은 이것을 잡지 못한다** 〔중간〕

2b 보고가 경고한 자리다. 실측:

```
저장본(lines: ["methicillin-", "resistant Staphylococcus"])
  저장 당시 집합으로 읽으면 : "methicillin-resistant Staphylococcus"
  접미사 집합이 바뀐 뒤     : "methicillinresistant Staphylococcus"
  storeVersion             : 1 → 1  (바뀌지 않는다)
```

축소 규칙 1은 문단 text를 **파생값**으로 만들었는데, 그 파생의 입력(`config.js`의 두 집합)이 저장본 어디에도 기록되지 않는다. spec 2-4가 이 값들을 **책별 프로파일로 옮기겠다고 이미 결정했으므로 이 변경은 반드시 일어난다.**

구체적 피해는 텍스트가 예뻐지고 말고가 아니다. **`paragraphs[].kind`는 저장되는데 그 kind는 옛 text로 판정된 것이다.** 집합이 바뀌면 `kind`와 `text`가 서로 다른 세계를 가리키고, 5절 파서는 둘 다 믿는다.

또 하나: **쓰는 쪽에 프로파일을 줄 길이 없다.** `groupParagraphs`는 `joinParagraphText(texts)`를 **인자 없이** 부른다(`blocks.js:510`). `fromStored`만 `opts.keepSuffixes`를 받는다. spec 2-4가 약속한 `buildPageLayout(items, pageInfo, params, profile)`이 오면 **읽기만 프로파일을 알고 쓰기는 모르는** 비대칭이 된다.

고치지 않은 이유: 어떤 방식(집합 해시를 `storeVersion`에 접기 / `algoVersion`을 올리기 / 프로파일 id를 레코드에 넣기)을 고를지는 **spec 9-2와 2-4가 함께 정할 문제**다. 제안 1·2로 넘긴다.

### `regionId` — spec 3-3 `Line`에 없다 〔경미, spec 쪽 결함〕

저장본 줄 키: `id, text, bbox, baseline, fontSize, col, role, hyphenJoin, paraId, regionId, runs`.
spec 3-3의 `Line`: `id, items, text, bbox, baseline, fontSize, col, runs, role, hyphenJoin, paraId`.

**계약 위반이 아니라 spec 누락이다.** `regionId`는 죽은 필드가 아니라 **세 곳에서 일한다**: (a) `groupParagraphs`가 표에 흡수된 캡션 줄을 흐름에서 뺀다(`blocks.js:486`), (b) `toStored` 규칙 2의 run text 보존 판정(`store.js:79`), (c) 4-12 하이라이트가 표 영역을 알아야 한다. 빼면 세 기능이 죽는다. **spec 3-3에 `regionId: string|null`을 더하는 것이 맞다**(제안 4). `Review 1 §2-3`도 같은 관찰을 "spec 본문이 요구하는 추가 필드"로 적어 두었다.

---

## 2c-5. C. 해시 전략의 실제 안전성 ★

### 충돌하는 두 파일을 **만들었다.**

대상 PDF(22.69MB) 기준 표본 구간은 18개 / 3,145,728바이트 = **13.22%**. **86.78%는 해시에 전혀 들어가지 않는다.**

```
표본 밖 오프셋 7,181,711 부터 4,096바이트를 XOR 0xff
  두 파일이 실제로 다른가 : true   (4,096바이트 차이)
  크기가 같은가           : true   (23,787,348 바이트)

  fileIdentityHash(A) = s256:p:23787348:d5294c9b…8853a
  fileIdentityHash(B) = s256:p:23787348:d5294c9b…8853a
  ★ 충돌 : true            (전체 SHA-256 은 1e5be99c… / 8d02dd72… 로 다르다)
```

해시가 죽어 있는 것은 아니다 — 표본 **안** 1바이트를 바꾸면 갈리고, 크기가 1바이트 달라도 갈린다(둘 다 확인).

### 난이도 판정: **목적에 비추면 수용 가능. 다만 주석이 약속한 2차 방벽이 없다.**

- **우연히 부딪칠 확률은 사실상 0이다.** 서로 다른 두 PDF가 바이트 단위로 같은 크기 + 같은 앞 1MB(헤더·초기 객체) + 같은 뒤 1MB(trailer·startxref) + 같은 중간 16구간이어야 한다.
- **의도하면 쉽다.** 위 실험이 30초 걸렸다. 다만 spec 9-2의 목적은 **"이 파일을 전에 가져왔는가"** 이고 파일은 사용자 자신의 것이다. 악의적 충돌을 방어할 이유가 없다는 `hash.js` 주석의 판단에 **동의한다**.
- **현실적으로 남는 위험**은 "같은 책의 두 파일인데 크기가 같고 작은 영역만 다른 경우" — 같은 도구가 같은 길이로 다시 쓴 워터마크·양식 필드·in-place 수정. 7000쪽 자료가 판본 여러 개로 올 수 있다면 실제로 일어날 수 있다.
- **문제는 코드 주석이 이미 있다고 쓴 2차 방벽이 없다는 것이다.** `hash.js:156-158`:

  > 그래서 **키에 size 를 문자열로 박아 넣고**, 가져오기 단계에서 `pageCount` 를 함께 비교한다(같은 해시인데 쪽수가 다르면 다른 파일로 취급한다).

  `pageCount` 비교는 **레포 어디에도 없다**(가져오기 코드 자체가 3단계 몫이다). 그리고 §2c-3 구멍 ③이 보여주듯 "기존 레코드를 잘못 여는 것"의 대가는 **"빈 문서가 완료 상태로 앉는 것"** 이다. 3단계 조건 1로 올린다.

### FNV-1a 64 폴백 경로 — **실제로 탄다** ○

`globalThis.crypto`를 `{}`로 덮어 비보안 컨텍스트를 흉내냈다.

```
hasSubtle()                 true → false
hashHex('hello')            fnv:a430d84680aabd0b:5
fileIdentityHash(A) [폴백]  fnv:p:23787348:8c3122a6dbbac3c2:3145740
복원 후 hasSubtle()         true
```

분기가 죽어 있지 않다. `hashHexSync`도 같은 값을 낸다(`fnv:a430d84680aabd0b:5`).

**다만 JSDoc과 실제 형식이 다르다** 〔경미 9〕. 주석은 표본 폴백을 `fnv:p:<size>:<hex16>`이라 적었는데 실제는 뒤에 표본 길이 `:3145740`이 더 붙는다. 표본 길이는 `size`의 결정적 함수라 정보 손실은 없다. 주석만 틀렸다.

### spec 7-5의 접두사 `s:`/`f:` 대 구현 `s256:`/`fnv:` — **구현이 맞다. spec을 고쳐라**

- spec 7-5가 요구한 것은 **"두 알고리즘의 키가 섞이지 않게 한다"** 이고, `s256:`/`fnv:`는 그 요구를 더 명확히 만족한다(알고리즘 이름이 드러나 나중에 SHA-512나 다른 폴백이 와도 자리가 있다).
- 캐시 키 형식(`kind|lang|docId|hash|extra`)의 구분자 `|`가 접두사에 들어 있지 않아 파싱도 그대로다.
- spec 7-5는 폴백을 "hex 16자 + 길이"라 했고 구현도 그렇다(`fnv:<hex16>:<len>`). **불일치는 접두사 글자뿐이다.**
- → **spec 7-5의 `s:`/`f:`를 `s256:`/`fnv:`로 고칠 것**(제안 5). 코드를 spec에 맞추면 오히려 나빠진다.

---

## 2c-6. D. `db.js` — 버전 2 마이그레이션 ★

**전부 브라우저의 진짜 IndexedDB로 확인했다.** 노드 테스트는 스텁이라 이 절의 어느 것도 증명하지 못한다.

### v1 → v2 — **인덱스가 생기고 데이터가 남는다** ○

`docId_algoVersion`이 **없고** 스토어도 4개뿐인(중단된 upgrade를 겸한) v1 DB를 손으로 만들고 데이터를 넣은 뒤 `db.openDb()`로 열었다.

```
v1 생성            스토어 blobs,documents,pages,settings  /  pages 인덱스: docId 뿐
v1 데이터          documents 1건(extraction 포함) · pages 5건 · settings 1건

db.openDb()  →  열림 v2 / 스토어 13개 / 빠져 있던 9개 스토어 전부 생성
★ pages 인덱스    docId, docId_algoVersion          ← 생겼다
★ documents 보존  {"done":false,"pagesDone":3,"cursor":4,"failed":[2],"algoVersion":6}
★ pages 보존      5건 전부, 본문까지 그대로 (1:쪽 1 | … | 5:쪽 5)
★ settings 보존   {"key":"ui.lang","value":"ko"}
```

**새 인덱스가 기존 레코드를 소급해 담는가** — 담는다(IndexedDB `createIndex`가 기존 레코드를 훑어 채운다). 이것이 안 되면 9-4 재개가 첫 실행에서 전부 재추출한다.

```
keysOf('pages','docId_algoVersion', bound([doc-A,6],[doc-A,∞]))
  → [["doc-A",1],["doc-A",2],["doc-A",3]]        (algoVersion 6 인 세 쪽의 **주 키**)
인덱스 전체 키 → [["doc-A",4],["doc-A",5],["doc-A",1],["doc-A",2],["doc-A",3]]
```

인덱스 `getAllKeys`가 **인덱스 키가 아니라 주 키**를 돌려준다는 점이 미묘한데, `_loadStoredSet`의 `this.stored.add(k[1])`은 주 키 `[docId, pageNo]`의 `[1]`을 집으므로 **맞다.**

### upgrade 도중 중단되면 — **통째로 롤백된다** ○

`onupgradeneeded`에서 스토어를 하나 만든 뒤 던지게 했다.

```
결과              error: AbortError
그 뒤 db.openDb()  v2 / 스토어 13개 / __halfBaked 남았나: false
데이터 보존         {"id":"doc-Q","fileHash":"s256:q","pageCount":3}
```

버전도 오르지 않고 반쯤 만들어진 스토어도 남지 않는다. IndexedDB가 버전 변경 트랜잭션을 원자적으로 다루기 때문이며, `reconcileSchema`가 멱등이라 다음 시도가 이어서 채운다.

### `blocked` / `versionchange` — **둘 다 실제로 발동한다** ○

| 상황 | 결과 |
|---|---|
| 다른 연결이 v3으로 올리려 함 | `db.js`의 `onversionchange` 발동 → 이벤트 `["versionchange"]` → 스스로 `close()` → **상대가 막히지 않고** `success v3` |
| `versionchange`를 무시하는 고집스런 v1 연결이 있을 때 `openDb()`(v2) | 이벤트 `["blocked"]`, 2초 동안 열리지 않음 |
| 그 연결을 닫자 | **같은 `dbPromise`가 스스로 풀린다** → `열림 v2`, 스토어 13개, 인덱스 정상 |

`blocked` 동안 `dbPromise`가 미결 상태로 남아 모든 `get`/`put`이 멈추는데 타임아웃이 없다 〔경미 11〕. 설계상 UI가 `blocked` 이벤트를 받아 "다른 탭을 닫아 주세요"를 띄우는 것이 전제이고, 닫으면 자기 치유되는 것을 확인했다. 다만 **`ERR.BLOCKED`(`'ERR_DB_BLOCKED'`) 상수는 아무도 쓰지 않는다** — `emit('blocked')`는 이벤트 **타입** 문자열을 보낸다. 죽은 상수다 〔경미 8〕.

### `QuotaExceededError` 경로 — **2c가 `×`로 신고한 자리. 실제로 돈다** ○

`IDBObjectStore.prototype.put`을 `pages`에 대해서만 `DOMException('quota','QuotaExceededError')`를 던지게 스텁하고 **끝까지** 태웠다.

```
Q1 isQuotaError(DOMException QuotaExceededError)   true   (name=QuotaExceededError, code=22)
Q2 db.put('pages', …)  →  DbError  code=ERR_DB_QUOTA   ERR.QUOTA 와 일치   cause.name 보존
Q3 Extractor  →  이벤트 ["fatal:{\"code\":\"ERR_DB_QUOTA\",\"pageNo\":1}"]
                 status = quota · running = false
                 documents.extraction.status = "quota"   (영속화됨)
put 원복 확인  true
```

`withTx`의 `catch`(동기 throw) → `tx.abort()` → `onabort`에서 `isQuotaError` 판별 → `DbError(ERR.QUOTA)` → `_tick`의 `e.code === db.ERR.QUOTA` → `STATUS.QUOTA` + `fatal` 이벤트 + 강제 메타 저장. **한 줄로 이어진다.** `isQuotaError`가 Firefox의 `NS_ERROR_DOM_QUOTA_REACHED`와 legacy `code === 22`도 본다.

남은 경계: **비동기 abort 경로**(요청이 성공 콜백 없이 쿼터로 죽고 트랜잭션이 나중에 abort)는 6.1GB 쿼터를 실제로 채워야 재현되어 확인하지 못했다. `withTx`의 `tx.onabort`가 `failed || tx.error`를 보고 같은 판별을 하므로 코드 읽기로는 같은 결론에 닿는다 〔실기기 검증 항목으로 남긴다〕.

---

## 2c-7. E. 2a 측정 도구의 신뢰성 ★

### ★ 도구가 **틀린 숫자를 내고 있었다** 〔중간 — 고쳤다〕

`profile-lib.mjs`의 `slimLayout`은 2a에서 **`items`만 떼어낸 얕은 복사본**이었다. 2b가 spec 9-2의 축소 규칙 1·2·3을 `toStored`로 구현한 뒤에도 그대로 남아 있었다. 즉 **도구가 실제로 저장되지 않는 것까지 세고 있었다.**

| | 고치기 전 | 고친 뒤 | 진실(2b·2c 실측) |
|---|---:|---:|---:|
| 저장본/쪽 | **34.0KB** | **21.9KB** | 21.9KB (JSON) |
| 내역 lines / paragraphs | 26.5 / 7.3KB | 18.8 / 2.8KB | — |
| 729쪽 전체 | 24.2MB | 15.6MB JSON / **6.2MB IDB** | 브라우저 실측 **6.65MB** |
| 7000쪽 환산 | ≈ 238MB | ≈ **60MB** | 2c 보고 64MB |

고친 뒤 도구가 내는 6.2MB가 오케스트레이터의 브라우저 실측 6.65MB와 **7% 안에서** 만난다. 고치기 전에는 4배 틀렸다.

도구는 그 위에 **이미 철회된 spec 초판 수치를 근거로 경고까지 찍고 있었다**:

> `[WARN] spec 9-2 의 "쪽당 5~10KB" 추정이 실측과 어긋난다 … 문단 text 가 줄 text 를 그대로 한 번 더 들고 있는 것이 큰 몫이다(문단 7.3KB / 줄 26.5KB)`

**2b가 이미 제거한 중복을 경고하고 있었다.** 새 자료를 받아 이 도구를 처음 돌리는 사람은 "7000쪽 238MB, 문단 text가 중복된다"는 **두 번 틀린 진단**을 받는다. 7000쪽 자료가 곧 오는 상황에서 이것이 가장 값비싼 결함이었다. §9ec (2)에서 고쳤다.

### 출력을 **다른 방법으로** 세어 대조했다

`buildPageLayout`·`profile-lib`을 **전혀 쓰지 않고** pdf.js 원시 아이템만으로(줄 만들기는 y를 0.5pt로 양자화하는 전혀 다른 방식) 다시 셌다.

| 항목 | `profile.mjs` | 독립 측정 | 판정 |
|---|---|---|---|
| **캡션 줄** | 후보 382 / `FIGURE+roman-dash 206` + `TABLE+roman-dash 156` = **362** | 접두어 전체 **379** / `FIGURE·FIG·TABLE` **365** | **일치**(±1%). 지침이 말한 "362"는 `FIGURE`+`TABLE`의 roman-dash 형태 합이고 지금 값도 같다 |
| **보기 글자 범위** | **A-F** (연속성 판정: F=5, G=1은 비연속) | **A-F** (F=5, G=1, H=4 …) — 희소 사건이 **정확히 일치** | **일치** |
| 보기 글자 빈도 | A=1272 B=1274 … | A=1105 B=1118 … (−13%) | 줄 만들기 방식 차이(내 0.5pt 양자화가 더 촘촘해 한 줄이 갈린다). **범위 판정은 방법에 무관** |
| **거터 폭** | **17.0pt**(최빈 16.0, 표본 226쪽) | **17.7pt**(최빈 18, 표본 346쪽) | **일치** |
| **2단 쪽** | **232** | 기준 강도별 356 / 297 / 275 / 256 / **247** / **220** | **반증 없음** — 232가 "양쪽 ≥20줄"(247)과 "≥25줄"(220) 사이에 놓인다. 내 기준이 거칠어 정확히 고정하지는 못했다 |
| 정답 줄 | 1190 (`ANSWER_RE` 1187) | 1237 | **일치**(내 정규식이 줄 머리 번호를 요구하지 않아 더 느슨하다) |

**네 지표 중 세 개가 독립적으로 재현됐고, 2단 쪽수는 반증되지 않았다.** 도구의 분류·집계는 믿을 만하다 — 틀린 것은 용량 측정 하나였다.

### `--stride` 표본 모드가 "신뢰 불가"라고 신고한 항목 — **맞다**

`profile.mjs:210`의 `prevSlim = args.stride === 1 ? slim : null;` 가 근거다. `stride > 1`이면 **이웃 페이지를 넘기지 않는다.** `classifyRoles`의 머리말 확정(4-7)은 이웃 페이지의 같은 자리 문자열을 비교해야 성립하므로, 표본 모드에서는

- 반복 머리말·꼬리말 집계가 구조적으로 낮게 나오고(이웃이 없으니 `header` 확정이 안 된다),
- `continuesPrev`(4-9)가 항상 `false` 쪽으로 기운다.

즉 **"희소 사건·이웃 의존"이라는 신고는 정확하다.** 더해서 캡션·6지선다 `F`·4자리 문항 번호처럼 **729쪽에 5건 안팎인 사건**은 `--stride 10`이면 기대값이 0.5건이라 있고 없고가 운에 좌우된다. 도구가 `--stride`일 때 리포트 머리에 `(--stride N 표본, 배율 ×N)`을 찍는 것은 옳은 최소 방어다. **7000쪽 실자료의 1차 측정은 `--stride` 없이 돌릴 것**(주의사항 1).

### `profile-lib.mjs` 순수 함수 테스트 21개가 **실제로 무엇을 주장하는가** — 읽었다

거의 전부 **"코드가 틀렸다는 것"을 주장한다.** 이 도구의 존재 이유와 일치한다.

| 테스트 | 실제 주장 |
|---|---|
| `classifyCaption: "TABLE II-9" 는 잡고 현재 코드 정규식은 못 잡는다` | 도구의 분류기 ≠ `blocks.js`의 정규식. **불일치 자체를 단언한다** |
| `classifyQuestionNumber: 코드의 \d{1,3} 상한을 넘는 번호도 잰다` | 측정기가 코드 한계를 **넘어서** 재야 한다 |
| `addPage/finalize: 캡션 죽은 코드가 경고로 드러난다` | `[DEAD]` 경고 생성 자체 |
| `addPage/finalize: 보기 글자가 F 까지면 [A-E] 누락이 경고로 나온다` | `[MISS]` 경고 생성 |
| `보기 글자 범위는 빈도가 아니라 연속성으로 정한다 (F 는 살리고 머리글자는 버린다)` | **판정 알고리즘의 핵심.** 빈도로 정하면 `S=8`이 `F=5`를 이긴다 |
| `robustMaxKey: 1~2건짜리 이상치가 자릿수 상한을 끌어올리지 못한다` | 6자리 1건이 `pageNoMax`를 6으로 만들지 않는다 |
| `histStats: 빈 히스토그램은 null 을 돌려준다(추측하지 않는다)` | **측정 없는 값을 지어내지 않는다** |
| `topEntries: 동률이면 키 사전순` · `quantileOf: 입력 배열을 훼손하지 않는다` | 결정성·순수성 |
| `tallyScripts: 문자열을 보관하지 않는다` | 13절 — 원서 문장을 레포에 남기지 않는다 |
| `renderBookProfile: 못 정한 값은 TODO 로 남는다` + `new Function` 문법 검사 | 초안이 **유효한 JS**이고 빈칸이 빈칸으로 보인다 |

**빈 칸이 하나 있었다**: 저장본 측정이 `toStored`와 같은지를 아무도 주장하지 않았다(§2c-8 G14). 메웠다.

---

## 2c-8. G. 의도적 파손 ★

18종을 하나씩 걸고 전체 테스트를 돌린 뒤 **매번 원본 바이트로 되돌렸다.**

| # | 바꾼 것 | 파일 | 실패한 테스트 |
|---|---|---|---|
| G1 | `toStored` 규칙 2 끄기 (run text를 모든 줄에) | `text/store.js` | **S3** |
| G2 | `toStored` 규칙 1 끄기 (문단 text를 저장) | `text/store.js` | **S2** |
| G3 | `toStored` 규칙 3 끄기 (좌표 반올림 없음) | `text/store.js` | **S4** |
| G4 | `fromStored`의 하이픈 접미사 집합 비우기 | `text/store.js` | **없음** ← §2c-4 |
| G5 | `reconcileSchema`의 인덱스 루프 삭제 | `db.js` | **D6, D7** |
| G6 | `MIGRATIONS[2]`를 빈 함수로 | `db.js` | **없음** → **D11 추가 후 D11** |
| G7 | 재개 커서를 `pagesDone` 기반으로 되돌리기(`c = 1`) | `pdf/extract.js` | **E8, E9, E10** |
| G8 | 해시의 `size` 결합 빼기 | `hash.js` | **없음**(무해 — 아래) |
| G9 | [E16 회귀] 재시도를 불리언 하나로 (첫 쪽만) | `pdf/extract.js` | **E13, E16, E22** |
| G10 | [E19 회귀] 우선순위 창에서 `failed`를 보지 않기 | `pdf/extract.js` | **E19** |
| G11 | [Review2 고침 되돌리기] `isComplete`를 `cursor`부터 훑기 | `pdf/extract.js` | **E20** |
| G12 | [Review2 고침 되돌리기] 저장된 쪽도 `failed`에 넣기 | `pdf/extract.js` | **없음**(브라우저 전용 — 아래) |
| G13 | 4-2 폭 위생 끄기 (페이지 폭 초과를 그대로) | `text/lines.js` | **L12, L13, L13b** |
| G14 | [Review2 고침 되돌리기] profile 저장본을 `toStored` 아닌 것으로 | `dev/profile-lib.mjs` | **없음** → **테스트 추가 후 실패** |
| G15 | [Review2 고침 되돌리기] `prepare`의 불변식 검산 제거 | `pdf/extract.js` | **없음**(브라우저 전용 — 아래) |
| G16 | `advanceCursor`가 `failed`를 건너뛰지 않게 | `pdf/extract.js` | **E9, E13, E19** |
| G17 | `normalizeExtraction`의 `cursor` 하한(1) 제거 | `pdf/extract.js` | **E3** |
| G18 | `planResume`의 `algoVersion` 되감기 제거 | `pdf/extract.js` | **E4** |

### 빈 칸 4개의 사정

- **G4 — 메우지 않았다(의도).** 하이픈 집합이 바뀌었을 때 기존 저장본을 지킬 **장치가 없다**(§2c-4). "집합을 바꾸면 text가 달라진다"를 테스트로 박으면 **결함을 명세로 굳히는 것**이 된다. 장치(제안 1)를 먼저 정하고 그 장치를 테스트해야 한다.
- **G8 — 무해하다.** 내 변형은 `size`를 **해시 입력**에서만 뺐다. `fileIdentityHash`는 키 문자열에 `p:<size>:`를 **따로** 박으므로(`H13`이 그것을 단언한다) 크기가 다른 두 파일은 여전히 갈린다. 이중으로 들어 있던 것 중 하나를 뺀 셈이라 테스트가 안 깨지는 것이 옳다.
- **G12·G15 — `Extractor` 내부 상태라 Node가 볼 수 없다.** 브라우저로 대체 측정했다(§2c-3, §9ec). G12를 되돌리면 "저장된 4쪽이 `failed`에 영구히 남고 `done`이 안 선다"가 재현되고, G15를 되돌리면 "`cursor 99999` → 20쪽 중 0쪽 추출"이 재현된다.

### 원상복구 확인

```
$ git status --porcelain
 M apps/medreader/dev/profile-lib.mjs
 M apps/medreader/dev/profile.mjs
 M apps/medreader/js/pdf/extract.js
 M apps/medreader/tests/db.test.mjs
 M apps/medreader/tests/extract.test.mjs
 M apps/medreader/tests/profile.test.mjs
?? .codex/
?? AGENTS.md
```

남은 6개는 **전부 §9ec에 적은 내 고침**이다. `js/text/*`·`js/config.js`·`js/db.js`·`js/hash.js`·`js/pdf/loader.js`·`dev/proto-extract.*`는 **한 글자도 바뀌지 않았다**(`git diff`로 확인). `.codex/`·`AGENTS.md`는 세션 시작부터 있던 미추적 파일이다.

최종 `node --test "apps/medreader/tests/*.test.mjs"` → **tests 140 / pass 140 / fail 0**.

---

## 8ec. 발견한 문제 (2a·2b·2c)

### 차단 — 없음

### 중간

1. **역할 재계산(priority 4)이 던지면 같은 쪽을 무한히 다시 잡는다**(§2c-3 구멍 ①). 실측 1.5초에 298회. E19와 같은 병이 다른 자리에 있었다. → **내가 고쳤다.**
2. **이미 저장된 쪽이 `failed`에 들어가면 영원히 빠지지 않고 `done`이 서지 않는다**(§2c-3 구멍 ②). 도달 경로 둘 — 역할 재계산 실패, `_saveMeta` 실패. → **내가 고쳤다.**
3. **`cursor`가 `pageCount`를 넘으면 저장된 쪽이 0개여도 `done=true`**(§2c-3 구멍 ③). 해시 충돌과 겹치면 "빈 문서가 완료 상태로 서재에 앉는다". → **내가 고쳤다.**
4. **하이픈 집합이 바뀌면 기존 저장본의 문단 text가 달라지고 `storeVersion`이 잡지 못한다**(§2c-4). `kind`는 옛 text로 판정된 채 남는다. spec 2-4가 이 값들을 프로파일로 옮기기로 **이미 결정**했으므로 반드시 일어난다. → **고치지 않았다.** 어느 장치를 쓸지는 spec 9-2·2-4가 함께 정할 문제다(제안 1·2). **잔존 중간 1건이 이것이다.**
5. **2a 측정 도구가 저장본을 34.0KB/쪽으로 재고 있었다**(진짜 21.9KB, §2c-7). 7000쪽 환산이 238MB 대 64MB로 갈린다. → **내가 고쳤다.**

### 경미

6. **두 탭 동시 추출에 잠금이 없다**(§2c-3). 손상은 없지만(24쪽에 `pages` 24행) build를 91회 한다. `documents.extraction`은 마지막 쓰는 쪽이 이긴다.
7. **`pageerror` 이벤트가 코드가 아니라 원시 예외 메시지를 싣는다**(`detail: {pageNo, message}`). spec 3-2는 서비스가 **코드**를 돌려주라고 한다. 진단용으로는 유용하니 `code: 'ERR_PAGE_EXTRACT'`를 더하고 `message`는 진단 필드로 남기면 된다.
8. **`ERR.BLOCKED`(`'ERR_DB_BLOCKED'`)가 죽은 상수다** — `emit('blocked')`는 이벤트 타입 문자열을 보낸다(§2c-6).
9. **`fileIdentityHash`의 JSDoc 형식이 실제와 다르다** — 폴백 표본 키에 표본 길이가 더 붙는다(§2c-5). 정보 손실은 없다.
10. **`fromStored`가 없는 줄을 조용히 건너뛰고 아무 신호도 남기지 않는다**(§2c-4). 손상 저장본에서 문단이 짧아지는데 드러나지 않는다. `stats.missingLines` 한 줄이면 된다.
11. **`blocked` 동안 `dbPromise`가 미결로 남고 타임아웃이 없다**(§2c-6). 막던 연결이 닫히면 자기 치유되는 것은 확인했다. UI가 `blocked` 이벤트를 반드시 받아 처리해야 한다.
12. **`_tick` 바깥으로 새는 예외가 잡히지 않는다.** `idle(() => this._tick())`에 `.catch()`가 없다. `_finish()`나 쿼터 분기의 `_saveMeta(true)`가 던지면 unhandled rejection이 되고 16-K의 "콘솔 에러 0건"을 깬다. (`running`이 먼저 `false`가 되므로 재시작은 가능하다.)

### 제안

1. **저장본이 자기 파생 규칙을 기술하게 할 것**(§2c-4). `storeVersion`에 하이픈 두 집합의 해시를 접거나, 프로파일 id를 `pages` 레코드에 넣고 `planResume`이 `algoVersion`처럼 다루게 한다. spec 9-2에 한 줄, 2-4에 한 줄이면 된다.
2. **`groupParagraphs`에도 프로파일을 흘릴 것**(§2c-4). 지금은 `joinParagraphText(texts)`를 인자 없이 부른다. spec 2-4의 `buildPageLayout(items, pageInfo, params, profile)`이 오면 읽기만 프로파일을 아는 비대칭이 된다.
3. **한 문서에 추출기는 하나여야 한다**(§2c-3). `navigator.locks.request('medreader-extract:' + docId, …)` 또는 `BroadcastChannel`. spec 9-4에 한 줄을 더할 값어치가 있다 — 7000쪽에서 두 배 일은 두 배 시간이다.
4. **spec 3-3의 `Line`에 `regionId: string|null`을 더할 것**(§2c-4). 세 기능이 이 필드에 매달려 있는데 계약에 없다.
5. **spec 7-5의 해시 접두사를 `s:`/`f:` → `s256:`/`fnv:`로 고칠 것**(§2c-5). 구현이 옳다.
6. **spec 9-2의 `fileHash` 칸에 "표본 해시 + `size`"임을 명시할 것**(§2c-5). 지금 표만 보면 전체 해시로 읽힌다. 13.22%만 읽는다는 사실과 `pageCount` 2차 비교 요구를 표에 박아 두면 3단계가 놓치지 않는다.
7. **`profile.mjs`에 `--pdfjs` 없이도 도는 길을 둘 것**(선택). 지금은 경로를 손으로 주지 않으면 즉시 실패한다. 7000쪽 자료를 받은 사람이 가장 먼저 부딪칠 벽이다.
8. **spec 9-4의 `extraction`에 `roleDirty`·`status`를 명시할 것.** 구현이 두 필드를 저장하는데 9-4의 목록에는 `done`·`pagesDone`·`cursor`·`failed`·`algoVersion` 다섯뿐이다. 실제로 쓰이고 `normalizeExtraction`이 정상화하므로 계약에 올려야 한다.

---

## 9ec. 내가 고친 것 (2a·2b·2c)

### (1) `apps/medreader/js/pdf/extract.js` — 재개 모델 구멍 3건 (+34줄)

**`_tick`의 `catch`** — 실패한 쪽을 `roleQueue`·`roleDirty`에서 빼고, **이미 저장된 쪽은 `failed`에 넣지 않는다**(구멍 ①②).

```js
this.ex.roleDirty = removeFrom(this.ex.roleDirty, target.pageNo);
this.roleQueue = this.roleQueue.filter((n) => n !== target.pageNo);
if (!this.stored.has(target.pageNo)) {
  this.ex.failed = addSorted(this.ex.failed, target.pageNo);
}
```

**`isComplete`** — `st.cursor`가 아니라 **1쪽부터** 훑는다(구멍 ③). 비용은 `pageCount`번의 Set 조회뿐이고 완료 판정은 문서당 몇 번뿐이다.

**`prepare()`** — 9-4 불변식("`cursor` 아래는 전부 저장됐거나 실패했다")을 **한 번 검산**한다. 건강한 저장본이면 값이 정확히 같아 아무 일도 하지 않고, 깨져 있으면 구멍의 첫 쪽으로 되감는다. `_loadStoredSet`이 이미 만들어 둔 Set을 읽으므로 7000쪽에서도 공짜다.

**고치기 전/후 실측(브라우저, 같은 하네스):**

| | 전 | 후 |
|---|---|---|
| 역할 재계산이 던질 때 1.5초 호출 수 | **298** (`running` 계속 true) | **1** (`failed=[]`, `roleQueue=[]`, `'done'` 발생) |
| 저장된 4쪽을 `failed`에 넣고 재시작 | `failed=[4]` 영구, `done=false` | `failed`에서 빠지고 `done=true` |
| `cursor 99999` / 20쪽 / 저장 0쪽 | `done=true`, `pages` **0행** | `cursor`가 1로 되감기고 **20/20** 추출, `done=true` |
| 건강한 재개(30·40쪽) | `cursor 41`, 40/40 | **`cursor 41`, 40/40 — 무변경** |

### (2) `apps/medreader/dev/profile-lib.mjs` — 저장본 측정을 `toStored`로 (−27/+27줄)

`slimLayout`이 `toStored`를 그대로 부르게 했다. 정의가 하나여야 도구와 앱이 같은 것을 센다. 함께 (a) 이미 철회된 "쪽당 5~10KB" 경고를 spec 9-2의 실측 기준(20.6KB JSON, 여유 1.5배)으로 고치고, (b) 리포트에 IndexedDB 환산(×0.40)을 병기했다.

실행 결과: `저장본/쪽 34.0KB → 21.9KB`, `전체 24.2MB → 15.6MB JSON / 6.2MB IndexedDB`, 철회된 `[WARN]` 소멸. 나머지 출력(캡션·보기·거터·2단·경고 11종)은 **한 줄도 바뀌지 않았다**(전수 재실행 diff로 확인).

### (3) `apps/medreader/dev/profile.mjs` — pdf.js 버전 문자열 중복 제거 (2줄)

`'npm install pdfjs-dist@5.4.149'`가 `config.js`의 `PDFJS_VERSION`과 **따로** 박혀 있었다(16-K 위반이고, 갈릴 수 있다). `PDFJS_VERSION`을 import해 조립한다. 이제 리터럴은 `config.js:19` 한 곳뿐이다.

### (4) 테스트 6개 추가 (`extract.test.mjs` +50, `db.test.mjs` +37, `profile.test.mjs` +28줄)

| 테스트 | 메우는 빈 칸 |
|---|---|
| `E20 isComplete 는 cursor 를 믿지 않는다 — 1쪽부터 실제로 훑는다` | G11 |
| `E21 failed 에 "이미 저장된 쪽"이 들어가면 영원히 빠지지 않는다 — 넣지 마라` | 구멍 ②의 계약을 순수 함수 쪽에서 고정 |
| `E22 실패가 셋 이상 흩어져 있어도 전부 한 번씩 재시도된다` | E13이 2건만 보던 것을 4건으로 (G9가 이것도 깬다) |
| `D11 ★ MIGRATIONS[2] 는 v1 DB 에 빠진 pages.docId_algoVersion 을 채운다` | **G6** — 버전을 올린 유일한 이유에 테스트가 없었다 |
| `D12 MIGRATIONS[2] 는 멱등하다` | 9-1의 멱등 요구를 2에도 |
| `★ 도구가 재는 저장본은 toStored 와 같은 것이다` | **G14** — 7000쪽 판단의 근거가 되는 숫자 |

기존 케이스는 **한 줄도 건드리지 않았다.** `134 → 140 pass`.

그 밖에는 아무것도 고치지 않았다. **`config.js`의 `KEEP_HYPHEN_SUFFIXES`는 손대지 않았다** — §2c-4의 결함은 집합의 *값*이 아니라 *버전 관리의 부재*이고, 그 장치는 spec이 먼저 정해야 한다.

---

## 10ec. 3단계(spec 19절 3번)로 가도 되는가 — **예. 조건 2개.**

**가도 되는 이유.** 3단계가 딛고 설 토대가 실제로 단단한지를 확인했다: v1→v2 마이그레이션이 **진짜 IndexedDB에서** 데이터를 보존하고, 쿼터 경로가 **끝까지 이어지고**, 재개 모델이 중단·실패·되감기·동시 실행을 견딘다(구멍 3건을 고친 뒤). 저장본 왕복은 내가 던진 8종의 경계 입력을 전부 버텼다. 의존 방향·순수성·버전 문자열·`config.js` 불변이 전부 확인됐다. 남은 중간 1건(하이픈 집합 버전)은 **3단계가 진행되는 동안에는 발동하지 않는다** — 프로파일을 실제로 도입하는 순간 발동한다.

**조건 1 — 문서 가져오기에 `pageCount` 2차 비교를 넣을 것.** `hash.js`가 이미 있다고 쓴 방벽이다(§2c-5). 없으면 §2c-3 구멍 ③과 맞물려 "빈 문서가 완료 상태로 앉는다". 구멍 ③은 고쳤지만 두 겹이어야 한다는 것이 `hash.js`의 원래 설계다. `findByFileHash`로 찾은 레코드의 `pageCount`가 새 파일과 다르면 **다른 문서로 취급**하면 된다(세 줄).

**조건 2 — 프로파일(2-4)을 실제로 도입하기 전에 제안 1·2를 먼저 처리할 것.** `KEEP_HYPHEN_SUFFIXES`를 프로파일로 옮기는 그 커밋이 기존 저장본을 조용히 다른 텍스트로 만든다(§2c-4). 순서를 뒤집으면 이미 추출된 쪽의 `kind`와 `text`가 어긋난 채 남는다.

### 3단계에 넘길 주의사항

1. **7000쪽 자료가 오면 `profile.mjs`를 `--stride` 없이 가장 먼저 돌릴 것.** 캡션·6지선다 `F`·4자리 문항 번호는 729쪽에 5건 안팎인 **희소 사건**이라 표본 모드에서 있고 없고가 운에 좌우된다(§2c-7). 이웃 의존 항목(반복 머리말·`continuesPrev`)도 표본 모드에서 구조적으로 낮게 나온다. 22.7MB·729쪽에 **7초**밖에 안 걸렸으니 전수를 돌릴 여유는 충분하다.

2. **`algoVersion`은 이제 6이고 재추출 경로는 네 번 필요했다. `DB_VERSION`도 2다.** 3단계가 `pages` 스키마를 또 건드리면 **인덱스 추가만** 버전 3이 필요하고 필드 추가는 필요 없다(9-1). `MIGRATIONS[3]`도 `reconcileSchema` 한 줄이면 되지만, **D11 같은 테스트를 반드시 함께 쓸 것** — G6이 보여주듯 그것 없이는 사다리 한 칸이 통째로 비어 있어도 아무도 모른다.

3. **`Extractor`의 이벤트 계약은 `progress`·`page`·`pageerror`·`done`·`stalled`·`fatal`·`reextract` 일곱이다.** `stalled`(완료 못 하고 멈춤)와 `reextract`(algoVersion 되감기)는 9-4 본문에 없지만 UI가 반드시 처리해야 한다 — 전자는 설정>고급의 실패 목록, 후자는 "텍스트를 다시 추출합니다" 안내다. `fatal`은 지금 `ERR_DB_QUOTA` 하나뿐이다.

4. **`pages` 저장본에는 `items`가 없다.** 아이템이 필요한 소비자(4-12 원본 뷰의 정밀 하이라이트 등)는 PDF에서 다시 뽑아야 한다. `_neighborLayouts`가 이미 저장본을 이웃으로 넘기고 그것으로 4-7이 성립하는 것을 확인했다(기준선 30쪽에서 `recomputed 29`, `roleDirty` 최종 `[]`).

5. **회전 줄(729쪽에 1,995줄)의 `bbox`를 그리지 마라.** 2b가 신고한 그대로다 — `lineBBox`가 `width`를 수평 폭으로 더하는데 90도 회전 아이템의 `width`는 세로 진행량이라 설계상 틀린다. 4-12 하이라이트는 `role === 'rotated'`를 건너뛰어야 한다.

6. **`storeVersion`은 지금 `1`이고 "그릇의 모양"만 뜻한다.** 파생 규칙(하이픈 집합)은 담고 있지 않다(§2c-4). 3단계가 저장본 형식을 바꾸면 이 값을 올리되, **무엇을 뜻하는 값인지 먼저 정하고** 올려야 한다.

---

# Review — MedReader 6단계 (6a `f5500ec` · 6b `f3f6f8c`)

검증 일자 2026-09-23. Build 와 다른 에이전트. 지침 `.claude/tasks/medreader-review-6.md`.
검증 환경: Node 24 / `node --test "apps/medreader/tests/*.test.mjs"` **336개 전부 통과**,
Chromium 375×812 에뮬레이션 + `127.0.0.1:8000`, 실물 729쪽 PDF 전수 재측정(Node + pdf.js 5.4.149).

---

## 6-0. 판정 — **조건부 통과**

| 등급 | 건수 | 목록 |
|---|---|---|
| 차단 | 0 | — |
| 중간 | 2 | ① 뷰를 바꾸면 낭독이 쪽 첫 발화로 되돌아간다 · ② `/Rotate≠0` 쪽에서 6a 클립이 줄 bbox 를 통째로 납작하게 만든다 |
| 경미 | 4 | ③ 오프라인에서 표 크롭이 쪽마다·표마다 pdf.js 를 다시 부른다 · ④ `stats.bboxDegenerate` 가 저장되지 않는다 · ⑤ `B1` 테스트가 자기 이름의 규칙을 못 잡는다 · ⑥ `leaveReader` 가 크롭 LRU·canvas 를 풀지 않는다 |
| 제안 | 4 | ⑦ `algoVersion` 값을 고정하는 테스트가 없다 · ⑧ 한 쪽에 표가 N개면 쪽 전체를 N번 렌더한다 · ⑨ `resolveAnchor` 의 `speaking` 은 실제로 "하이라이트가 있는가"다 · ⑩ 구간 반복이 안내 문단을 물면 회차마다 안내를 되풀이한다 |
| 이월 | 1 | ⑪ ko/fr 의 110여 키가 아직 영어 — spec 19절 3번이 10단계로 미뤄 둔 것. 6b 가 새로 넣은 11개 키는 4개 언어 전부 실제로 번역됐다 |

**조건** — ①을 고치고 나서 7단계로 간다. ②는 실제 7000쪽 자료를 넣는 **그날 아침에** 확인해야 한다(6-5절 참고).

---

## 6-1. 15개 항목

### 6a

**① 클립이 파이프라인에 새지 않았는가 — 새지 않았다.**

`js/text/layout.js:169-183` 의 클립 루프는 4·5·7·8·9 단계와 `bodyLeft` **뒤**에 있다.
`line.bbox` 를 읽는 곳을 `blocks.js` 에서 전수로 확인했다:

```
$ grep -n "bbox" js/text/blocks.js
78,82,83             columnMetrics    (layout.js:158 — 클립 전)
369,379,384,385,391  detectTables     (layout.js:152 — 클립 전)
442,444              newParagraph     (groupParagraphs 안, layout.js:155 — 클립 전)
495,513              groupParagraphs  (layout.js:155 — 클립 전)
```

`classifyRoles` 는 `bbox` 를 전혀 읽지 않는다(`baseline`·`fontSize` 만).
`columns.js` 는 `lineX0`(items 직접)만 쓴다. **클립 뒤에 오는 `line.bbox` 소비자는
`publicLine` 하나뿐이고 그건 출력이다.**

실측 재검증 — 729쪽 전수(Node + pdf.js 5.4.149, `buildPageLayout` 직접 호출):

```
쪽 = 729  줄 = 49629
페이지 밖 줄(badLines) = 0
stats.bboxDegenerate 합계 = 25 쪽: 1(19) 226(3) 655(3)
```

6a 커밋 메시지의 "badLines 1,074 → 0", "bboxDegenerate 25건(1·226·655쪽)" 이
**숫자까지 그대로 재현된다.** 커밋이 부풀린 곳이 없다.

**② `regions[].bbox`·`paragraphs[].bbox` 를 6b 가 그리는가 — 그리지 않는다. 6a 는 반쪽이 아니다.**

```
$ grep -rn "\.bbox" js/ui/*.js
js/ui/original.js:410  scrollToRegion — regions[i].bbox
js/ui/original.js:509  visibleLineIds — l.bbox (줄, 클립됨)
js/ui/reader.js:698    cropFor — render.cropBox(region.bbox, {width,height})
```

- `paragraphs[].bbox` 는 **한 곳에서도 쓰이지 않는다.**
- `cropBox`(`js/pdf/render.js:191-200`)가 `clipBox(grown, W, H)` 로 스스로 접는다 —
  6a 가 안 한 클립을 여기서 한다.
- `scrollToRegion` 만 클립 전 값을 쓰는데, 결과는 `scroller.scrollTo({top})` 이고
  브라우저가 범위를 접는다. **그리지 않는다.**

**③ `stats.bboxDegenerate` 가 저장본에 남는가 — 남지 않는다.**

`js/text/store.js:178-185` 의 `stats` 화이트리스트는
`medianFontSize · medianLeading · bodyLeft · warn · widthFixed` 뿐이다.
브라우저에서 실제 저장본을 꺼내 확인했다:

```
stats: { bodyLeft:[72,390], medianFontSize:11, medianLeading:14, warn:null, widthFixed:0 }
```

`dev/proto-extract.js:447,496` 의 화이트리스트에도 없다. **즉 이 수는 추출이 끝나는
순간 사라지고 7000쪽에서는 아무도 못 본다.** 이것이 문제인가 — **그렇다(경미 ④).**
이 값이 "클립이 진짜 결함을 덮고 있다"는 유일한 신호인데, 새 책에서 이 수가
25가 아니라 2,500이 되어도 알 방법이 없다. 특히 ②(회전 쪽)가 발동하면 이 수가
그 쪽 줄 전부로 뛴다. `widthFixed` 와 같은 대우를 받아야 한다(한 줄 + 테스트 한 개).

**④ `algoVersion` 7 의 파급 — 전수 재추출. 9-4 커서는 되감긴다.**

`js/pdf/extract.js:101-113` `planResume` 이 `e.algoVersion < algo` 면
`cursor:1, failed:[], roleDirty:[], done:false, reextract:true` 로 되감는다.
쪽별 판정은 `docId_algoVersion` 인덱스가 **값을 읽지 않고** 키만으로 한다(`:326-329`).
그래서 7000쪽이 통째로 stale 로 잡힌다.

그 재추출이 얼마나 보이는가 — 729쪽 전수 실측:

```
전수 시간 = 7.6s → 96.2 쪽/s | 7000쪽 환산 1.2 분   (Node, IDB 쓰기·틱 스케줄러 없음)
toStored JSON 합계 = 15.6 MB | 쪽당 21.9 KB | 7000쪽 환산 150 MB
```

순수 계산만 보면 7000쪽도 몇 분이다. 다만 브라우저 경로에는 IndexedDB 쓰기와
틱 스케줄러가 붙고, 코드 주석이 이미 측정해 둔 열화 경로(`extract.js:510-513`)가
"729쪽 약 2분 → 7000쪽이면 20분" 이라고 적고 있다. **9-4 커서 재개가 그 경로를 탄다** —
`cursor:1` 로 되감긴 뒤 순차 스캔이 돌고, 이웃 재계산이 `itemsCache`(3쪽) 안에서
끝나면 1ms, 벗어나면 `getPage+getTextContent` 를 처음부터 다시 한다.
사용자가 읽던 자리를 먼저 열면 임의 접근이 되어 캐시가 매번 빗나간다.

### 6b

**⑤ 오버레이 정합 — 맞는다. 테스트는 스텁이 자기를 확인하는 함정에 빠지지 않았다.**

`tests/render.test.mjs` 의 `viewport` 스텁은 `viewportRect` 가 쓰는 API(`convertToViewportPoint`)
만 제공하고, 기대값은 **스텁을 거치지 않고 손으로 계산한 값**이다(`72*s`, `(792-712)*s`).
`viewportRect` 자신의 로직(두 점 변환 후 `min`/`abs`)이 검증 대상이다.

그것으로 부족해서 **진짜 pdf.js 로 왕복 검증**을 했다(실물 729쪽 PDF 3쪽, 회전 4종 × 줌 3종):

```
rot=  0 s=0.8 → left=57.60   top=56.80   w=182.40 h=9.60   | 왕복 OK
rot= 90 s=3   → left=2100.00 top=216.00  w=36.00  h=684.00 | 왕복 OK
rot=180 s=1.5 → left=468.00  top=1050.00 w=342.00 h=18.00  | 왕복 OK
rot=270 s=0.8 → left=56.80   top=249.60  w=9.60   h=182.40 | 왕복 OK
   (12/12 전부 OK — viewportRect → pdfPoint 왕복 오차 < 1e-3)
```

브라우저에서도 실제 오버레이를 줌 6단계에서 측정했다. 기대값은 저장본 bbox 에서
독립적으로 계산했다(`(x0-0.15*fs)*s` 등):

```
scale 0.8000 → dLeft  0       dTop  0        dW 0 dH 0
scale 1.0000 → dLeft  0       dTop  0        dW 0 dH 0
scale 1.2500 → dLeft  0       dTop -0.0005   dW 0 dH 0
scale 1.5625 → dLeft  0.0001  dTop -0.0001   dW 0 dH 0
scale 1.9531 → dLeft -0.0003  dTop  0.0003   dW 0 dH 0
scale 2.4414 → dLeft  0.0001  dTop  0.0004   dW 0 dH 0
scale 3.0000 → dLeft  0       dTop  0        dW 0 dH 0
```

변이 M6(=`min`/`abs` 제거)이 R4 를 빨갛게 만든다. **테스트에 이빨이 있다.**

**⑥ 7000쪽 규모 — `ImageBitmap` 은 아예 쓰지 않는다. 크롭 LRU 는 제대로 돈다. canvas 는 명시적으로 풀지 않는다.**

- `grep -rn "ImageBitmap" js/` → **0건.** 걱정하던 `ImageBitmap.close()` 누락은 없다.
- 크롭 LRU: `js/ui/reader.js:301-306` 이 `onEvict` 에서 `URL.revokeObjectURL` 을 부른다.
  변이 M11(`onEvict` 제거)에서 R20·R21·R22 가 빨개진다 — 축출 경로가 테스트로 묶여 있다.
- **다만** `leaveReader()`(`js/ui/reader.js:462-477`)는 `state.crops.clear()` 를 부르지 않는다.
  문서가 바뀔 때만 비운다(`showReader:440`). 서재로 나가도 blob URL 20개가 살아 있다(경미 ⑥).
- canvas: `paint()` 가 `canvas.width/height` 를 키우고, 쪽을 넘기면
  `renderPage → clear(mount) + leaveOriginal()` 로 DOM 을 통째로 버리는데
  **`canvas.width = 0` 같은 명시적 해제가 없다.** 실측(375×812, dpr 2):

```
scale 1.0000 → 1224×1584 =  7.4 MB
scale 1.5625 → 1912×2474 = 18.0 MB
scale 3.0000 → 3672×4752 = 66.6 MB   ← 줌 최대에서 쪽을 넘길 때마다 이 덩어리가 GC 대기로 떨어진다
```

`DPR_MAX:2` 상한이 없었다면 dpr 3 에서 150MB 였다 — 그 상한은 옳다.

**⑦ 오프라인 — 리플로우는 정말 계속 돈다. `original.js` 정적 import 는 문제를 만들지 않는다. 다만 크롭이 재시도를 멈추지 않는다.**

정적 import 사슬(`reader.js → original.js → pdf/render.js → pdf/loader.js`)은
모듈 최상위에서 아무 네트워크도 건드리지 않는다. `loader.js` 는 `loadPdfjs()` 를
**부를 때만** `import()` 한다. 브라우저 실측(`simulateLoadFailure()` 후 뷰 전환):

```
unavailable      true       (원본 사용 불가로 표시됨)
toggleDisabled   true       (버튼 비활성)
stillReflow      true       (리플로우 DOM 유지)
canvas           false
state            "speaking" ← 낭독은 계속 돈다
콘솔 오류        0건
```

**그런데** 표 크롭 경로는 `cropFor → pdfDocFor → openDoc` 로 `showOriginal` 을
거치지 않는다. 그래서 `state.pdfjsFailed` 가 서지 않고, `loadPdfjs` 는 실패 시
`libPromise` 를 비워(`loader.js:70`) **다음 호출이 두 CDN 을 처음부터 다시 시도한다.**
결과: 오프라인에서 표가 3개 있는 쪽을 열 때마다 CDN 시도 6회. `fillTableCrops` 가
`await` 되지 않아 읽기는 안 막히지만, 쪽마다 네트워크 타임아웃이 쌓인다(경미 ③).
`fillTableCrops` 첫 줄에서 `if (original.originalUnavailable()) return;` 한 줄이면 끊긴다.

**⑧ 표 안내가 낭독 큐에 들어가는 것 — 5단계와 충돌하지 않는다. 단 두 가지 결이 남는다.**

브라우저 실측(합성 2쪽, 표 1개):

```
flowParas() → 문단 4개, 그중 table-notice 1개
  id "tablenotice:1:t0"  kind "table-notice"  text "표입니다. 화면을 확인하세요."
  위치: 1:p1(표 앞) 다음, 1:p2(표 뒤) 앞 — blocks 순서 그대로
낭독 큐 총 36 발화
```

- `markDone` — 안내 id 는 `lineElement()` 가 `null` 을 주므로 조용히 아무 일도 안 한다(`reader.js:1061-1065`). 충돌 없음.
- `setCurrentLines` — 안내를 만나면 `announcedTables.add(rid)` 하고 **`true`** 를 준다
  (`reader.js:1096-1101`). `false` 였으면 낭독이 쪽을 넘겨 버렸을 것이다. 이 처리는 맞다.
- **구간 반복** — `queueRebuilt()`(`speaker.js:215-220`)가 큐가 다시 만들어질 때마다
  `repeatMode` 를 `'off'` 로 내린다. 그래서 "안내가 빠져 큐 길이가 줄었는데 `repeatFrom/To`
  가 옛 번호를 가리킨다"는 사고는 **일어나지 않는다.** 확인:

```
reload 전 repeat = {"mode":"range","count":3,"pass":0,"from":2,"to":2}
reload 후 repeat = {"mode":"off","count":3,"pass":0,"from":0,"to":0}
```

  남는 결: 구간이 안내 문단을 물고 있으면 **회차마다 안내를 되풀이한다**(반복 중에는
  큐를 다시 만들지 않으므로 `announced` 가 걸러 주지 못한다). "한 번만 말한다"는 4-8 (3)의
  문구와 어긋나지만 사용자가 스스로 그 구간을 지정한 상황이라 해가 크지 않다(제안 ⑩).

**⑨ `pickAnchorLine` — 구현과 정책이 일치한다. `tests/anchor.test.mjs` 가 사슬 전체를 고정한다.**

| 정책 단계 | 구현 | 고정한 테스트 | 변이하면 |
|---|---|---|---|
| ① 낭독 줄(보일 때) | `original.js:73-74` | A1 A2 | M10 → A6 빨강 |
| ② 탭한 줄(보일 때) | `:81-82` | A4 A5 | M9 → A4 빨강 |
| ③ 화면 중앙 | `:84-85` | A3 A6 | M8 → A3 A5 빨강 |
| ④ 보이는 첫 줄 | `:88-89` | A7 | — |
| ⑤ `null` | `:92` | A8 | — |
| 순수·위생 | | A9 A10 A11 A12 | |

구현이 정책 문장보다 한 조건 **더** 엄격하다 — `c.speaking &&`. A6 이 그것을 못으로 박는다
("낭독 중이 아니면 낭독 줄이 보여도 쓰지 않는다"). 정책 문장과 모순은 아니다("듣는 곳"은
낭독 중에만 존재한다).

다만 호출자가 그 `speaking` 을 만드는 방식이 헐겁다 — `resolveAnchor()`(`reader.js:614`)는
`speaking: state.currentLineIds.length > 0` 이다. 일시정지해도 `currentLineIds` 는 남으므로
**정지 중에도 `speaking:true`** 다. 정책 의도("듣던 자리")로 보면 무해하지만, 이름과 값이
다르다(제안 ⑨).

**⑩ spec 6-4 Android TTS 제약 — 낭독이 죽지는 않는다. 그러나 자리를 잃는다. → 중간 ①**

`renderPage()` 가 DOM 을 통째로 버려도 `speaker` 는 죽지 않는다(세대 검사·utterance 참조 모두 견딘다).
실측: 뷰 전환 뒤 `state` 는 계속 `"speaking"`. **하지만 읽는 자리가 쪽 첫 발화로 돌아간다.**

브라우저 실측(리플로우에서 [다음] 3회 → 원본 뷰로 전환):

```
전환 전  index 3/36  lineIds ["1:4"]  text "Page 1 line 5 of the synthetic body text…"
전환 후  index 0/36  lineIds ["1:1"]  text "Page 1 line 2 of the synthetic body text…"   state "speaking"
```

pdf.js 로드 실패로 리플로우로 **되돌아가는** 경로에서도 같다(`index 8 → 0`).

원인은 한 줄이다:

- `setView()`(`reader.js:595-607`)가 `await renderPage()` 를 부른다 →
- `renderPage()` 끝에서 `notifyPage()`(`:530`) →
- `ui/controls.js:161` `onPageRender(() => { speaker.reload(); … })` — **인자가 없다** →
- `speaker.reload(fromLineId)`(`speaker.js:559-566`)는
  `const found = fromLineId == null ? -1 : …; index = found >= 0 ? found : 0;` → **index 0**,
  `state==='speaking'` 이면 `restart(0)`.

Node 재현(스텁 synth·가짜 시계, 실제 `speaker.js` 모듈):

```
진행 후 index = 2 / 4 state = speaking
말한 것: ["Alpha one here.","Beta two here.","Gamma three here."]
reload 후 index = 0 / 4 state = speaking
말한 것: ["Alpha one here.","Beta two here.","Gamma three here.","Alpha one here."]   ← 되감겼다
```

`reader.js:528` 의 주석 "★ **낭독 큐는 뷰와 무관하다.** … 원본 뷰에서도 낭독이 끊기지
않는다(6-4)" 는 **현재 코드와 다르다.** 쪽을 넘기는 경우에는 `index 0` 이 맞지만,
**같은 쪽을 다시 그리는 뷰 전환**에서는 틀리다. 6b 가 같은 쪽을 다시 그리는 경로를
새로 만들면서 생긴 결함이다.

고치지 않은 이유는 6-4절에 적었다.

### 전반

**⑪ CSS 물리속성 — 1건, spec 11-3 이 명시한 예외 그대로.**

```
$ grep -rnE "(^|[^-a-z])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:" css/*.css
css/reader.css:611:  left: 0;
```

`.original .hl-line` 의 `left:0`(+`top:0`)뿐이고 상자는 `transform: translate()` 로 옮긴다.
`js/**` 의 `style.left`/`style.right` 0건, `index.html` 0건.

**⑫ i18n — 4개 언어 키 집합 동일. 6b 가 넣은 11개 키는 전부 실제로 번역됐다.**

```
ar 키 155 / en 155 | 누락 0 | 잉여 0
fr 키 155 / en 155 | 누락 0 | 잉여 0
ko 키 155 / en 155 | 누락 0 | 잉여 0
6b 키 중 ar 가 영어 그대로: []
6b 키 중 fr 가 영어 그대로: ["reader.view.original"]   ← "Original" 은 프랑스어 낱말이다
6b 키 중 ko 가 영어 그대로: ["reader.original.zoom"]   ← 값이 "{percent}%" 다
```

전체로 보면 **fr 111개·ko 110개**가 아직 영어와 글자까지 같다. 이것은 6b 가 만든 것이
아니라 spec 19절 3번이 "fr·ko 는 키만 복사하고 값은 영어로 둔다(번역은 10단계)"로 정한
상태다(`dev/gen.mjs` 헤더 참고). 이월 ⑪.

브라우저에서 표 폴백의 `figcaption` 이 "Table", 버튼이 "View in the original page" 로 나오는
것도 같은 이유다(`reader.table.placeholder`·`reader.table.viewOriginal` — 6b 가 아니라
`b94d2af` 이 넣은 키). 같은 화면 안에서 `alt` 는 "원본 쪽에서 잘라 낸 표 그림"으로 한국어라
**한 카드 안에 두 언어가 섞여 보인다.** 10단계에서 같이 풀린다.

**⑬ 터치 타깃 48px · 375px 가로 넘침 0 — 둘 다 통과.**

375×812 에뮬레이션 실측:

```
viewToggle 52×48   zoomOut 66×48   zoomIn 66×48   play 64×64      (모두 ≥48)
리플로우   clientW 375  scrollW 375  넘치는 요소 0개
원본 3.0×  clientW 375  scrollW 375  넘치는 요소 0개   (확대분은 .original-scroll 안에서만 흐른다)
콘솔 오류  0건
```

**⑭ `js/text/*` 순수성 — 0건.**

```
$ grep -n "document\|window\|fetch\|indexedDB\|navigator\|localStorage" js/text/*.js
0건
```

**⑮ 서비스 계층이 UI 문자열을 만들지 않는가 — 만들지 않는다.**

`js/pdf/render.js` 의 import 는 `../config.js`(ORIGINAL)와 `./loader.js` 뿐이다.
`t(` 호출 0건, `textContent` 0건, `aria-label` 0건. 실패는 `ERR_PDFJS_LOAD` 같은
**코드**로만 나가고 문구는 `ui/original.js`·`ui/reader.js` 가 `t()` 로 만든다.
`js/text/*` 도 i18n 을 import 하지 않는다.

---

## 6-2. 변이 테스트 — 13건

`node --test "apps/medreader/tests/*.test.mjs"`, 매 변이마다 `git checkout --` 으로 되돌렸다.
마지막에 작업 트리가 깨끗하고 336개 전부 다시 통과하는 것을 확인했다.

| # | 무엇을 망가뜨렸나 | 빨개진 테스트 |
|---|---|---|
| M1 | `lineBBox` 의 `!isBlankItem(it)` 가드 제거 | B2 B3 — **B1 은 통과했다(아래 참고)** |
| M2 | `lineBBox` 의 `pageRect` 클립 무력화 | B5 B6 B8 |
| M3 | `algoVersion` 7 → 6 | **없음** ← 구멍 |
| M4 | 클립을 6단계 직후(파이프라인 앞)로 옮김 | B6 B8 |
| M5 | `overlayable` 에서 `rotated` 검사 제거 | R8 R10 |
| M6 | `viewportRect` 의 `min`/`abs` 제거 | R4 |
| M7 | `lineAtPoint` 가 가장 **큰** 상자를 고르게 | R13 |
| M8 | `pickAnchorLine` 의 "보이는가" 검사 제거 | A3 A5 |
| M9 | `pickAnchorLine` 탭 ↔ 중앙 우선순위 뒤집기 | A4 |
| M10 | `pickAnchorLine` 의 `speaking` 조건 제거 | A6 |
| M11 | LRU 의 `onEvict` 호출 제거(objectURL 누수) | R20 R21 R22 |
| M12 | `CROP_PAD_PT` 6 → 0 | R15 R16 |
| M13 | `insertTableNotices` 가 `announced` 를 무시 | N3 N4 |

**11/13 이 잡힌다.** 못 잡은 둘:

- **M3 — `algoVersion` 값을 고정하는 테스트가 하나도 없다.** `grep -rn "algoVersion" tests/`
  는 `db.test.mjs` 의 **인덱스** 검사만 보여 준다. 값을 실수로 되돌려도 336개가 전부
  초록이고, 그 대가는 "이미 읽던 책의 오버레이가 계속 틀린 값을 그린다"이다. 제안 ⑦.
- **M1 이 잡은 것은 B2·B3 뿐, `B1` 은 통과한다.** B1 의 이름은
  "폭을 가진 공백 아이템이 x1 을 밀지 않는다(목차 점선 자리)" 인데 fixture 가
  `[Chapter@72+40, 공백@112+400, 37@512+10]` 이라 공백을 넣든 빼든 `x1 = 522` 로 같다.
  **테스트가 자기 이름의 규칙을 검증하지 못한다.** 실측이 말한 진짜 모양(공백이 마지막
  실체 아이템 **너머로** 192pt 뻗는 것)을 쓰려면 공백을 맨 뒤로 옮겨야 한다.
  예: `[Chapter@72+40, 37@112+10, 공백@122+400]` → 기대 `x1 = 122`(지금 구현), 변이하면 `522`. 경미 ⑤.

---

## 6-3. 고친 것 — **없다**

지침의 기준("명백한 결함 · 한 파일 안에서 닫힘 · 기존 테스트 전부 통과")을
셋 다 만족하는 건이 없었다. 가장 가까운 것이 중간 ①인데 6-4절의 이유로 올린다.

---

## 6-4. 중간 2건의 근거와 권고

### ① 뷰를 바꾸면 낭독이 쪽 첫 발화로 되돌아간다

실증은 6-1 ⑩에 있다(브라우저 `index 3→0`, Node 재현, 실패 경로 `8→0`).

**권고(고치지 않았다).** `ui/controls.js:161` 한 줄로 닫힌다:

```js
onPageRender(() => {
  const cur = speaker.getCurrent();                       // units[index] — lineIds 를 가진다
  speaker.reload(cur && cur.lineIds && cur.lineIds[0]);   // 같은 쪽이면 찾아지고, 쪽이 바뀌면 -1 → 0
  attachDebugHook();
});
```

`reload` 는 못 찾으면 이미 `index = 0` 으로 떨어지므로 쪽 넘김 동작은 그대로다.

**그런데도 내가 안 고친 이유:** 이 한 줄은 `goToPageForSpeech` → `renderPage` →
`notifyPage` → `advancePage` 가 겹치는 자리를 지난다. 이 코드베이스가 다섯 번 데인
것이 정확히 "각각은 맞는데 합치면 깨지는 두 규칙"이고, 지금 그 경로를 고정하는
테스트는 없다(`reload` 인자 유무를 보는 테스트가 없다 — 그래서 이 결함이 살아남았다).
**Build 에이전트가 테스트와 함께 넣어야 하는 수정이지 Review 가 끼워 넣을 수정이 아니다.**
함께 넣을 테스트: "같은 쪽을 다시 그리면 낭독 자리가 유지된다", "다른 쪽으로 가면 0 이다".

### ② `/Rotate ≠ 0` 쪽에서 6a 클립이 줄 bbox 를 통째로 납작하게 만든다

`js/pdf/extract.js:440-448` 이 layout 에 넘기는 `width/height` 는
`page.getViewport({scale:1})` 의 값이다. **회전 쪽에서 이 값은 뒤바뀐다.**
반면 `getTextContent()` 아이템 좌표는 회전 전 PDF 사용자 공간이다.
합성 `/Rotate 90` PDF 로 실측:

```
page.rotate = 90   view = [0, 0, 612, 792]
extract.js 가 넘기는 width/height = vp.width/vp.height = 792 612
textContent item: str="Hello rotated world"  x=100  y=700  width=100.032
```

`y = 700` 인데 클립 상한 `H = 612` 다. 6a 는 `y0=y1=612` 로 접는다 →
넓이·높이 0 → `overlayable()` 이 `false`(`render.js:150`) → **오버레이가 안 그려지고
줄 탭도 안 먹는다**(`lineAtPoint` 도 `overlayable` 로 거른다). 세로가 612를 넘는 모든
줄, 즉 회전 쪽 본문의 상당 부분이 그렇게 된다.

**지금 729쪽에서는 안 보인다.** 전수 확인:

```
rotate 분포: [[0,729]]
viewport 크기 분포:
   612x783 (view 0,0,612,783) → 727 쪽
   783x612 (view 0,0,783,612) → 2 쪽     ← 진짜 가로 쪽이지 회전이 아니다
```

6a 이전에는 클립이 없어 bbox 가 틀리기만 했지 사라지지는 않았다. 6a 가 "틀린 것을
숨기는" 쪽으로 바꿨고, 그 신호(`bboxDegenerate`)는 ③ 때문에 저장되지도 않는다.
**두 결함이 맞물린다.**

권고: `extract.js` 가 `vp.width/height` 대신 `page.view` 기준 폭·높이
(`view[2]-view[0]`, `view[3]-view[1]`)를 넘기거나, 회전 쪽을 명시적으로 처리한다.
어느 쪽이든 `algoVersion` 을 또 올려야 하므로 **7000쪽 자료를 넣기 전에** 결정하는 편이 싸다.

---

## 6-5. 7000쪽에서 터질 것 (지금 729쪽에서는 안 보인다)

1. **`/Rotate ≠ 0` 쪽.** 위 ②. 729쪽에는 0개라 이 책으로는 영영 안 드러난다.
   7000쪽 자료에 한 쪽이라도 있으면 그 쪽의 오버레이와 줄 탭이 통째로 죽는다.
   **그리고 `bboxDegenerate` 가 저장되지 않으므로 아무 경고도 안 뜬다.**
2. **저장 용량 150MB.** 쪽당 21.9KB × 7000 = 약 150MB 가 `pages` 스토어에 들어간다
   (원본 PDF blob 은 별도). 지금 브라우저가 "5.0 GB 중 72KB" 라고 말하지만,
   안드로이드 크롬의 오리진 쿼터는 기기 여유 공간에 비례해 줄어든다. `ERR_DB_QUOTA`
   경로가 **7000쪽 중간에서** 처음 발동할 가능성이 높다 — 729쪽(15.6MB)에서는 절대 안 닿는다.
3. **줌 최대에서 쪽 넘김.** canvas 뒷면 66.6MB 가 명시적 해제 없이 GC 로 떨어진다.
   7000쪽을 훑으면 같은 일이 수천 번이다. `leaveOriginal()` 에서
   `canvas.width = canvas.height = 0` 한 줄이면 즉시 돌려줄 수 있다.
4. **한 쪽에 표가 N개면 쪽 전체를 N번 렌더한다**(제안 ⑧). `cropFor` 가 표마다
   `renderRegionImage` 를 부르고, 그 함수는 매번 **쪽 전체**를 오프스크린에 그린 뒤
   잘라 낸다(`render.js:350-365`). 크롭 배율 3× 에서 쪽 전체 캔버스가 1836×2349 ≈ 17MB.
   표가 4개인 쪽이면 pdf.js 렌더 4회 + 17MB 할당 4회다. 의학서는 그런 쪽이 흔하다.
5. **오프라인 × 표 많은 책.** ⑦의 재시도 루프. 표가 많은 의학서를 오프라인으로 훑으면
   쪽마다 표 개수만큼 CDN 시도가 쌓인다. 729쪽 표 밀도로는 견디지만 7000쪽에서는
   체감 정지로 보인다.
6. **재추출 20분.** ④. `algoVersion` 이 또 오르면(②를 고치면 오른다) 7000쪽 전체가
   되감긴다. 지금 UI 는 `reextract` 이벤트로 안내만 한다 — 20분이 걸린다는 것을
   사용자가 알 방법이 있어야 한다.
7. **확인함 — 문제 아님:** `lastTappedLineId` 는 문서가 바뀔 때만 비워지지만
   (`showReader:442`), 줄 id 에 쪽 번호가 들어 있어(`"45:12"`) 다른 쪽에서 되살아날 수 없고
   `resolveAnchor` 가 `flowLineIds().indexOf(id) < 0` 으로 한 번 더 거른다.

---

## 6-6. 사용자가 실기기(갤럭시 Z Fold 7)에서 확인할 것

1. **낭독을 켜 둔 채 [원본] ↔ [본문] 을 한 번씩 누르고, 소리가 "그 문장"에서 이어지는지 들을 것.**
   지금은 쪽 첫 문장으로 되돌아간다(중간 ①). 고친 뒤 이 한 가지만 귀로 확인하면 된다.
2. **원본 뷰를 3.0× 로 키운 상태에서 쪽을 10번 연속 넘길 것.** 한 번에 66.6MB 짜리
   canvas 가 오간다 — 렉이나 탭 강제 종료("Aw, Snap")가 나는지.
3. **접은 화면(외부) ↔ 펼친 화면(8인치) 로 전환할 때** 원본 뷰의 하이라이트가
   글자 위에 그대로 있는지. 줌을 손대지 않은 경우에만 폭을 다시 맞춘다(`refitOriginal`).
4. **비행기 모드에서 표가 있는 쪽을 열 것.** 리플로우 읽기·낭독이 계속되는지,
   그리고 쪽을 넘길 때마다 눈에 띄게 버벅이는지(경미 ③의 재시도 루프).
5. **표가 나오는 대목을 문장 모드로 낭독시켜** "표입니다. 화면을 확인하세요." 가
   **한 번만** 들리고 그 다음 문단으로 자연스럽게 넘어가는지.

---

# Review — MedReader 7b (설정 AI 탭과 실제 호출) · 2026-10-03

> Review 서브에이전트 작성. Build 와 분리된 검증자. Build 보고서(`.claude/tasks/medreader-build-7b-report.md`)는 검증 대상으로만 읽고 모든 항목을 다시 쟀다.
> **커밋하지 않았다. 실제 API 키는 어디에도 넣지 않았다**(가짜 키는 런타임에 이어 붙인 문자열, fetch 스텁만 사용).
> 검증 환경: `preview_start {name:"blog"}`(python http.server :8000). 앱 파일 46개를 `fetch(url,{cache:'reload'})` 로 다시 받고 쿼리(`?r=2`·`?r=4`)를 바꿔 navigate.
> 속도 팝오버를 열려면 문서가 필요해 **지어낸 3문장짜리 1쪽 PDF 를 브라우저 안에서 만들어** 가져왔고, 끝나고 `deleteDocument` 로 지웠다(레포에 PDF 없음).

## 7b-0. 결론 — **조건부 통과**

`[N]`·`[D]` 항목은 전부 통과했다. 키 누출 0건(다섯 갈래 × [검증]·[시험 번역] × 7개 검사면). 조건은 둘이다.
1. `[D][사용자]`·`[M][사용자]` — 실제 키가 필요한 두 항목은 **사용자 확인 대기**(7b-7). 이것 없이는 7b 가 끝나지 않는다(16-D0).
2. **범위 밖 결함 R1(중요)** — 실제 Gemini 가 무효 키에 주는 응답 형태(`400 INVALID_ARGUMENT` + `API_KEY_INVALID`, `[가정]` — 널리 알려진 형태지만 실물로 확인 전)는 `BAD_REQUEST` → "확인 불가 · 키는 저장할 수 있습니다"로 보이고 **틀린 키가 저장된다.** "무효" 문구가 실제로는 거의 나오지 않을 수 있다. 사용자 확인 때 **일부러 틀린 키로도 [검증]을 한 번** 눌러 보면 바로 가려진다(7b-7 ①-4).

## 7b-1. 16-D0 항목별

| 항목 | 결과 | 확인 방법 | 수치 |
|---|---|---|---|
| `[D][사용자]` 한국 PC 실제 키 | **사용자 확인 대기** | 실제 키 필요 | — |
| `[M][사용자]` Nour 기기·시리아 네트워크(VPN 켬/끔 기록) | **사용자 확인 대기** | 실제 키·실기기 필요 | — |
| `[N]` errorParser 다섯 줄 + `verifyKey` REGION | 통과 | 스크래치패드 스크립트로 `gemini.errorParser`·`verifyKey` 를 직접 불렀다(테스트 파일과 별개) | 400+FAILED_PRECONDITION→REGION, 403+"User location is not supported"→REGION, 403(문구 없음)→AUTH, 400+INVALID_ARGUMENT→BAD_REQUEST, 429→RATE_LIMIT. `verifyKey` → `{ok:false, code:'REGION', status:400, canSave:true}` |
| `[D]` 다섯 갈래 서로 다른 문구, 지역 제한에 [키 설정] 없음 | 통과 | 브라우저 `window.fetch` 스텁 5종(200 / 401 / 429 / 400 FAILED_PRECONDITION / `TypeError`)으로 [검증]·[시험 번역]을 각각 누름 | `data-outcome` valid·invalid·limited·region·unknown, 다섯 문구 모두 다름. 결과 상자 안 `[data-nav]`·`<a>` **0개**(10회 모두). `ai.state.region` 배너 버튼은 [닫기] 하나, `ai.state.noKey` 배너는 [키 설정] → `#/settings/ai` 실제 클릭으로 이동 |
| `[D]` 키 형식 경고 | 통과 | 입력칸에 구형(`AIza`+…)·신형(`AQ.`+…)·낯선 형식 입력 → [키 저장] | 구형·신형: 입력 중·저장 후 경고 숨김. 낯선 형식: 입력 중·저장 후 경고 보임, `sessionStorage` 에 저장됨, "Key saved." |
| `[D]` 설정 탭 ↔ 속도 팝오버 한 값, 기본값 | 통과 | 실제 클릭: 팝오버 [끔] → [번역 설정](data-nav)으로 설정 탭 → 같은 값 / 설정 탭에서 [표시+낭독]·원문 읽기 끔 → 리더로 돌아가 팝오버 → 같은 값 / 팝오버에서 다시 바꿈 | 기본 `speak`·원문 읽기 `true`. 양방향 모두 `aria-pressed`·`aria-checked` 일치, IndexedDB `settings` 행도 같음. `show`·`off` 에서 원문 읽기 스위치 `disabled` |
| `[D]` "번역 언어: العربية", "번역문 음성: 있음/없음" | 통과 | `speechSynthesis.getVoices = () => []` 스텁 | "Translation language: العربية", 약 3초 뒤 "Translation voice: not available" + [설치 방법] 보임 |
| `[D]` 동의 전 → 동의 카드 | 통과 | `privacy.consentedAt=null` 에서 [검증]·[시험 번역] 클릭 | **API 요청 0건**, 두 번 모두 카드 보임, 포커스 `H2 "Privacy"`, 동의 전 키 저장 0. 체크 없이 [동의] → 안내 보임·값 null 유지, 체크 후 [동의] → 기록·카드 닫힘 |
| `[D]` URL·콘솔·토스트·에러 문자열에 키 없음(모델 칸에 키) | 통과 | 7b-2 | 7b-2 |

## 7b-2. 키 누출 검사 — 기계 검사

검사면 7개를 매 단계 `includes(가짜키)` 로 셌다: ① 가로챈 요청 URL 전부 ② 콘솔(`console.*` 다섯 개를 감싸 기록) ③ `document.documentElement.outerHTML` ④ `body.textContent`·`innerText` ⑤ **모든 요소의 모든 속성**(`aria-*` 따로 집계) ⑥ 배너·`[role=alert]` ⑦ 입력·선택칸의 `.value`. 그리고 모든 요청의 `x-goog-api-key` 헤더가 키와 같은지. `dev.debug` 를 **켠 채로**(서버 메시지가 화면에 나오는 가장 넓은 경우) 스텁이 **키를 메시지에 되비추게** 했다.

| 갈래 | [검증] 뒤 | [시험 번역] 뒤 | 화면에 나온 서버 메시지 |
|---|---|---|---|
| 유효 | 7면 모두 0 | 0 | — |
| 무효(401) | 6면 0, ⑦ 입력칸 `.value` 에만 있음 | 같음 | `API key not valid: [KEY]` |
| 한도(429) | 0 | 0 | `Quota exceeded for key [KEY]` |
| 지역 제한(400) | 0 | 0 | `User location is not supported … key=[KEY]` |
| 확인 불가(TypeError) | 0 | 0 | `Failed to fetch` |

- 무효 갈래의 ⑦은 **사용자가 방금 친 값이 입력칸에 남은 것**이다(`canSave:false` 라 저장도 지우기도 안 함). `outerHTML`·속성에는 없다. 의도된 동작으로 본다.
- 헤더로만 감: 모든 경우 참. 요청 URL 은 `…/models?pageSize=1`, `…/models/gemini-2.5-flash-lite:generateContent` 뿐.
- **모델 칸에 키(7a 의 실제 누출 경로)** — `ai.model` 에 ⓐ 키 그대로 ⓑ `gemini-2.5?key=`+키 ⓒ 저장된 키 없이 키 그대로 ⓓ 낯선 형식 키를 넣고 화면을 다시 그린 뒤 [시험 번역]: ⓐⓒⓓ 요청 **0건**(`assertNoKeyInUrl`), 문구 "확인 불가", 힌트 `refused: key would travel in the URL`. ⓑ 요청 1건이지만 모델이 기본값으로 바뀌어 URL 에 키 없음. 네 경우 모두 선택칸 `<option value="__redacted__">`, 글자 `[KEY]`, 7면 0.
- **"이 기기에 기억"** — 실제 확인란 클릭: 끔+저장 → session 만 / 켬 → local 만(session 비워짐), 경고 보임 / 다시 끔 → **local 에서 지워짐**, session 만 / 켠 채 새로 저장 → local 만 / 끔 → session 만 / [키 지우기] → 양쪽 비움. 표시는 `AQ.Ab…p6` 마스킹.
- IndexedDB 13개 스토어 전부·`localStorage`·주소창에 키 0건.

## 7b-3. 문구

- `REGION` 문구 네 언어: [키 설정] 유도 없음, VPN·우회 언급 없음(`vpn|proxy|우회|프록시|وكيل|بروكسي` grep 0건), "키 문제가 아니다" 있음. 13절 경계를 넘지 않는다.
  - 판단 메모: 14-2 원문대로 "이 지역에서는 … 쓸 수 없습니다"라고 **단정**한다. 13절은 "네트워크 위치 때문일 수 **있다**"로 적었고, 판정(방법 B)은 느슨하다(429·500 이어도 두 낱말이 있으면 REGION). 단정형이 틀릴 수 있다는 점만 기록한다 — 14-2 원문을 따른 것이라 고치지 않았다.
- 아랍어: 새 63개 키 모두 실제 아랍어(자리표시·영어 그대로 0). `piiWarning` — UI 가 아랍어면 아랍어 한 줄(`ar/rtl`), 영어면 아랍어 줄이 **먼저**, 영어 줄이 다음. 키 입력칸 안은 `direction:ltr`. 네 언어 파일 키 254개씩, 집합 동일.
- **고친 것 1** — 아랍어 지역 제한 두 문구가 "واجهة {provider}"(= "{provider} 인터페이스")였다. Nour 는 시리아에서 소비자용 Gemini 를 쓰고 있어(8-2) "Gemini 를 이 지역에서 못 쓴다"로 읽히면 자기 경험과 어긋나 문구를 믿지 않는다. 영어·프랑스어·한국어는 모두 "API" 를 밝힌다. → "واجهة برمجة التطبيقات (API) الخاصة بـ {provider}"(= "{provider} 의 API")로 고쳤다(`js/i18n/ar.js` 두 줄). 브라우저에서 아랍어 [검증]·[시험 번역] 둘 다 새 문구, 가로 스크롤 없음.

## 7b-4. 화면 실측

뷰포트 에뮬레이션이 360×740 을 `innerWidth 361`, 360×800 을 `361×801` 로 보고했다(배율 반올림). 아래 "가로 스크롤 0"은 `scrollWidth == innerWidth` 이고 화면 밖으로 나간 요소가 0개라는 뜻이다.

**설정 화면**

| | 360×740 영어 | 360×800 영어 | 360×740 아랍어 | 360×800 아랍어 |
|---|---|---|---|---|
| `scrollWidth` / 화면 밖 요소 | 361 / 0 | 361 / 0 | 361 / 0 | 361 / 0 |
| 버튼·선택·입력 최소 | 59×48 | 59×48 | 59×48 | 59×48 |
| 확인란 2개 | 24×24, 라벨 252×48 | 같음 | 24×24, 라벨 252×48~50 | 같음 |
| 고정 고지 `footer.notice-bar` | 718–740 보임(fixed) | 779–801 보임 | 718–740 보임 | 779–801 보임 |
| [뒤로] 위치 | 24–83(왼쪽) | 같음 | 278–337(오른쪽, 거울) | 같음 |

조작 요소 16개 실측(360×740 영어): 뒤로 59×48 · 프로바이더 295×48 · 키 입력 214×48 · 표시 73×48 · 붙여넣기 72×48 · 키 저장 97×48 · 검증 295×48 · 시험 번역 295×48 · 모델 295×48 · 일일 상한 295×48 · 비우기 206×48 · 끔 135×48 · 표시 152×48 · 표시+낭독 295×48 · 원문 읽기 295×48 · 설치 방법 101×48. 48 미만은 확인란 본체 둘뿐이고 라벨 줄이 48 높이로 눌린다. 맨 아래 카드 bottom 654 < 고지 top 718(가려지지 않음).

**속도 팝오버 (360×740)**

| | 영어 | 아랍어 |
|---|---|---|
| 패널 top–bottom / `max-block-size` | 73–594 / 521.5px | 73–594 / 521.5px |
| 내용 `scrollHeight` / 보이는 높이 | **716** / 520 | **736** / 520 |
| 7b 줄(번역 따라가기·[번역 설정])을 뺀 높이 | 464 | — |
| 조작 요소 48 미만 | 0개(17개 모두 높이 48 이상) | 0개 |
| 상단바(배너 없음) | bottom 57 < 패널 top 73 — 덮지 않음 | 같음 |
| `ai.state.region` 배너가 있을 때 | 배너 0–149, 상단바 157–206, 패널 top 73 → **배너·상단바를 133px 덮음** | — |

- 화면 밖으로 잘리지는 않는다(패널이 뷰포트 안). 다만 **7b 이전에는 내용 464px 이 520px 안에 다 들어갔는데 지금은 716px** 이라, 번역 따라가기 줄 아래 [번역 설정]·[닫기]가 **팝오버 안을 약 200px 스크롤해야** 보인다(범위 밖 기록 R2).
- 이월 결함 3(배너가 있으면 팝오버가 상단바를 덮음)은 **기하는 그대로**다(top 73, max-block 같음). 덮는 양은 배너 글 길이에 달렸고, 7b 의 지역 제한 안내는 길어서(영어 149px) 10b 실측(57px)보다 많이 덮는다. 8a 가 이 배너를 실제로 띄우기 시작하면 드러난다.

**버튼 장치**: 새 이동 버튼 3개(서재 [설정], 팝오버 [번역 설정], 배너 [키 설정])는 `data-nav` 만 갖고, `data-nav` 와 `data-action`/`onclick` 을 함께 가진 요소는 0개(grep). 실제 클릭으로 세 입구 모두 `#/settings/ai`, 설정 [뒤로] → `#/library`. 설정 화면 안 동작은 섹션 하나의 `data-action` 위임이고, 번역 따라가기 줄은 버튼을 만드는 함수가 리스너도 함께 붙인다(반쪽 캐시에서 둘 중 하나만 낡을 수 없다).

**콘솔**: 위 전 과정(정상·다섯 갈래·모델 칸 키·동의 전·기억 토글·리더·팝오버·언어 전환) 동안 에러·경고 0, `error`/`unhandledrejection` 0, Browser 콘솔 메시지 0.

## 7b-5. 변이 테스트 (원본은 스크래치패드에 복사, 복사본으로 되돌리고 `cmp` 로 확인)

| 변이 | 결과 |
|---|---|
| M1a `verifyKey` REGION 갈래 `canSave:true→false` | 빨강 2 — P2, P3 |
| M1b `verifyKey` AUTH 갈래 `canSave:false→true` | 빨강 1 — `verifyKey 401/403 → AUTH, 저장 불가`(7a) |
| M2 `outcomeKey` 의 REGION 문구를 AUTH 문구(`settings.ai.verify.invalid`)로 | 빨강 1 — V2 |
| M3a `keys.saveKey` 의 반대쪽 지우기(`removeFrom(other)`) 삭제 | 빨강 3 — keys-7a 의 세 테스트 |
| M3b 설정 화면 `onRememberChange` 의 `keys.setRemember(...)` 호출 삭제(**확인란을 꺼도 localStorage 에 키가 남는다**) | **631개 전부 통과 — 헛돈다** → 테스트 C8 을 더했다. 더한 뒤 같은 변이에서 C8 빨강 1 |
| (내가 더한 V8) 아랍어 문구를 옛 "واجهة {provider}" 로 되돌림 | 빨강 1 — V8 |

`node --test "apps/medreader/tests/*.test.mjs"`: 처음 **631/631**(Build 주장과 같음) → 내가 2개 더해 **633/633**.

## 7b-6. 고친 것 / 범위 밖이라 기록만 한 것

**고친 것**
1. `js/i18n/ar.js` — 지역 제한 두 문구(`settings.ai.verify.region`, `ai.state.region`)가 "{provider} 인터페이스"로 읽혀 소비자 앱과 API 를 구별하지 못했다 → "{provider} 의 API(واجهة برمجة التطبيقات (API))"로 바꿨다(7b-3).
2. `tests/settings-7b.test.mjs` — C8 추가: 변이 M3b(설정 화면이 "기억" 확인란에서 `setRemember` 를 부르지 않음)를 잡는 테스트가 없었다. 화면 결선은 node 에서 안 보이므로 **주석을 걷어 낸 소스**에서 호출을 확인한다(처음 쓴 판은 주석 처리된 호출도 통과시켜 헛돌았다 — 고친 뒤 빨개지는 것을 확인).
3. `tests/settings-7b.test.mjs` — V8 추가: 네 언어의 지역 제한 문구가 "API" 를 밝히고 VPN·우회를 말하지 않음을 고정.

**범위 밖(기록만)**
- **R1 (중요, `gemini.js` — 이번 Review 에 고칠 권한 없음)** 무효 키 응답 오분류. Gemini 는 무효 키에 `HTTP 400`, `error.status:'INVALID_ARGUMENT'`, 메시지 "API key not valid. Please pass a valid API key.", `details[].reason:'API_KEY_INVALID'` 를 준다고 알려져 있다(`[가정]` — 실물 미확인). 이 응답을 스텁으로 [검증]에 넣으면 `BAD_REQUEST · HTTP 400` → **"지금은 확인할 수 없습니다 … 키는 저장할 수 있습니다"**, 그리고 **틀린 키가 저장됐다**(`canSave:true`). 16-D0 `[N]` 의 "400+INVALID_ARGUMENT → BAD_REQUEST" 자체가 이 경우를 가르지 않는다. 제안: `REGION` 판정 **뒤**, `BAD_REQUEST` 앞에서 `details[].reason` 이 `API_KEY_INVALID`/`API_KEY_EXPIRED` 이면 `AUTH`(spec 8-2·16-D0 수정이 먼저). 사용자 확인 ①-4 로 실물을 먼저 받는 것이 좋다.
- **R2 (팝오버 세로 예산)** 360×740 에서 속도 팝오버 내용이 464 → 716px(아랍어 736)로 늘어 [번역 설정]·[닫기]가 안쪽 스크롤 뒤로 갔다. 잘리지는 않고 하단 바의 속도 버튼으로도 닫힌다. "주 동작 위치"(인계 문서 교훈 4) 문제라 배치 결정은 사용자·오케스트레이터 몫으로 둔다(예: [닫기]를 패널 아래에 sticky, 또는 번역 따라가기 세 버튼을 한 줄로).
- **R3 (이월 결함 3)** 배너가 있으면 팝오버가 상단바를 덮는다 — 기하 불변, 7b 의 긴 지역 제한 배너에서 133px. 8a 에서 배너를 실제로 띄우기 전에 보는 것이 좋다.
- **R4 (경미)** [시험 번역] 성공 메타 줄은 `… ms · OK` 로 HTTP 상태가 없다(`complete()` 가 상태를 돌려주지 않음). 실패 때는 `HTTP 400` 처럼 나온다. 사용자 기록에는 지장 없음(DevTools 에서 본다).
- **R5 (경미)** 일일 상한 도움말("이 수를 넘으면 오늘은 AI 요청이 멈춥니다")은 8c 전까지 사실이 아니다([시험 번역]은 상한에 막히지 않음). 12-7 의 "저장만 하고 조용히 둔다"는 번역 따라가기에 대한 규칙이라 위반은 아니다.

## 7b-7. 사용자 확인 대기 — 절차

**공통**: 오케스트레이터가 커밋·푸시한 뒤 **배포본(https)** 에서 한다. 첫 로드에서 새로고침 두세 번(반쪽 캐시). 키는 **본인이 직접** 붙여 넣는다.

① **한국 PC (Chrome) — 먼저** `[D][사용자]`
1. 서재 상단바 [설정] → DevTools(F12) Network, `Preserve log` 켬.
2. 키 붙여넣기 → [검증]. 기록: 결과 문구, 메타 줄(`… ms · OK · HTTP 200`), `models?pageSize=1` 의 `OPTIONS` 상태와 `access-control-allow-origin`, 본 요청 상태, **URL 에 키 없음**, 요청 헤더 `x-goog-api-key` 있음.
3. [시험 번역]. 기록: 아랍어 번역문, 걸린 ms, `…:generateContent` 의 `OPTIONS`·`POST` 상태, URL 에 키 없음.
4. **(R1 확인) 키 끝 글자 하나를 바꾼 틀린 키로 [검증] 한 번.** 화면 문구가 "키가 거부되었습니다"(무효)인지 "지금은 확인할 수 없습니다"(확인 불가)인지, 메타 줄의 코드·HTTP 상태, Network 응답 본문의 `status`·`reason` 을 적는다. 끝나면 [키 지우기] 후 올바른 키를 다시 넣는다.
5. 결과(지연 ms 포함)를 이 파일에 적는다.

② **Nour 기기 (Android Chrome, 시리아 네트워크)** `[M][사용자]`
1. "이 기기에 기억"은 끈 채로(기본). 운영자 키로 시험했다면 끝나고 [키 지우기] 후 탭을 닫는다.
2. **VPN 켬/끔을 반드시 기록**한다. 앱은 VPN 을 안내하지 않는다(13절) — VPN 이 켜져 있으면 그 결과는 시리아 네트워크 결과가 아니다.
3. [검증] → [시험 번역] 순서로 누르고 **두 결과를 따로** 스크린샷(문구 + 메타 줄). 모델 목록은 통과하고 생성만 막히는 경우를 가른다.
4. 셋 중 하나로 기록: 통과 / 지역 제한(아랍어 "لا يمكن استخدام واجهة برمجة التطبيقات (API) …", [키 설정] 유도 없음) / 그 밖(코드·HTTP 상태).
5. 가능하면(원격 디버깅) `__medreader.settings.set('dev.debug', true)` 뒤 다시 눌러 **키가 지워진 서버 원문**을 받는다 — 8-2 의 `REGION` 판정을 실물에 맞추는 근거.

---

# Review — MedReader 7b-fix (실키 확인 결함 수정 + 번역 언어 선택) · 2026-10-08

검증자: Review 서브에이전트(Build 와 분리). 지침 `.claude/tasks/medreader-review-7b-fix.md`. Build 보고(`medreader-build-7b-report.md` "실키 확인 반영")는 검증 대상으로만 읽고 전부 다시 쟀다. 커밋하지 않았다. 실제 키는 쓰지 않았다(가짜 키는 실행 중에 이어 붙여 만들었고 소스·저장소에 남기지 않았다 — 끝에 `localStorage`·`sessionStorage` 에 가짜 키 0 확인). 차단 훅에 막힌 명령 없음.

## 7b-fix-1. 결론

**조건부 통과.** Build 의 다섯 가지 수정은 모두 주장대로 동작한다. 다만 결함 두 개를 찾아 고쳤다(① 키 앞뒤 공백 때문에 `assertNoKeyInUrl` 이 목록 쪽 넘김에서 빗나감, ② 원격 목록에 `gemini-2.5-*` 가 남아 골라도 화면은 2.5·요청은 3.5 로 어긋남). 고친 뒤 전체 테스트 **659/659 통과**(Build 657 + Review 2). 남은 조건: `preview` 모델을 목록에 남길지 운영자 결정, 실키 재확인(아래 7).

## 7b-fix-2. 항목별 결과와 확인 방법

| 항목 | 결과 | 확인 방법 · 수치 |
|---|---|---|
| 기본 모델 `gemini-3.5-flash-lite`, 정적 목록 3개 | 통과 | `config.js` diff · 테스트 D1. 다른 상수 변경 없음(diff 가 `DEFAULT_MODEL`·`STATIC_MODELS` 만) |
| 2.5 저장값 → 기본값 | 통과 | 브라우저: `ai.model='gemini-2.5-flash-lite'` 저장 → IndexedDB 행은 2.5 그대로, `settings.get` 은 `''`, 드롭다운 `gemini-3.5-flash-lite (default)`. [시험 번역] 요청 URL `…/models/gemini-3.5-flash-lite:generateContent` |
| 2.5 를 **드롭다운에서 고르면** | **결함 → 고침** | 원격 목록 스텁에 `gemini-2.5-flash-lite` 를 넣자 드롭다운에 나왔고, 고르면 드롭다운은 2.5 인데 요청 URL 은 3.5(저장값이 "설정 안 됨"으로 읽힘). 고친 뒤 드롭다운에서 2.5 가 빠짐 |
| 목록 엔드포인트 | 통과 | 실제 요청: `GET …/models?pageSize=1`(검증) → `GET …/models?pageSize=1000` → `…&pageToken=NEXT`. 키는 헤더 `x-goog-api-key` 로만 |
| `pageToken` 인코딩 | 통과 | 노드 스텁 `nextPageToken:'tok/=+2'` → `pageToken=tok%2F%3D%2B2` |
| 쪽마다 `assertNoKeyInUrl` | **결함 → 고침** | 코드상 쪽마다 걸림(provider.js `listModels` 루프). 그러나 `assertNoKeyInUrl` 이 **trim 안 된 키**를 받아, 키에 앞뒤 공백·줄바꿈이 있으면 `nextPageToken` 에 섞인 키가 둘째 요청 URL 로 **나갔다**(노드 스텁: 앞 공백, 뒤 줄바꿈, 앞 탭+뒤 공백 세 경우 모두 누출). 화면 경로는 입력을 `trim()` 해 넘기므로 지금 UI 로는 닿지 않지만 provider 가 마지막 방어선이라 고쳤다 |
| 목록 필터 | 통과(의견 있음) | 지침 예시 스텁(2쪽) → 남은 것 `3.5-flash-lite · 3.1-flash-lite · 3.5-flash · 3.5-pro-preview · 3.5-flash-lite-preview-09-2026`. 빠진 것 `3.8-flash-tts · 3.1-flash-image · 3.5-live-translate-preview · 3.5-transcribe · text-embedding-004 · veo-3.1-generate-preview · lyria-3.5`(+ 고친 뒤 2.5 둘). 기본이 맨 앞 |
| `preview` 처리 | 기록 · 의견 | **지금은 남긴다**(`preview` 를 거르는 규칙 없음). 노드 스텁으로 더 넣어 보니 `gemma-3-27b-it`·`gemini-robotics-er-1.5-preview`·`gemini-3.5-computer-use-preview`·`nano-banana-pro-preview`(이름에 `image` 가 없는 이미지 모델)·`gemini-flash-latest` 도 남는다. 의견은 6절 |
| 판정 순서 | 통과 | REGION 두 줄 → R1 AUTH → `MODEL_UNAVAILABLE` → 나머지(소스 순서·E2). 노드 확인: 404+지역 문구 → REGION, 404+`API_KEY_INVALID` → AUTH, 400 `INVALID_ARGUMENT` → BAD_REQUEST, 404 본문 없음 → MODEL_UNAVAILABLE |
| 다른 404 경로 | 통과(작은 기록) | [검증]이 404 → `verifyOutcome` 이 "확인 불가 · 키는 저장할 수 있습니다". 메타 줄은 `MODEL_UNAVAILABLE · HTTP 404`(문구와 코드 이름이 다르지만 진단엔 도움). 목록이 404 → 정적 목록(던지지 않음) |
| 404 문구 | 통과 | 영어 "This model is not available. Choose another model.", 아랍어 "هذا النموذج غير متاح. اختر نموذجًا آخر." — 키 이야기 없음. `data-outcome="model"`, 그 뒤 목록 새로고침 2쪽 요청 |
| 목록에 없는 저장 모델 | 통과 | `gemini-9-gone` 저장 → [시험 번역] 404 → 목록 새로고침 → 경고 한 줄(아랍어 "…تم التبديل إلى gemini-3.5-flash-lite.") · 저장값 `''` · 드롭다운 기본 |
| [시험 번역] 두 블록 | 통과 | 호출 1회. 블록 `ar/rtl`, `ko/ltr`, 각 위에 자국어 이름. 요청 `generationConfig` = `responseMimeType application/json` + `responseSchema {ar,ko}` required, `maxOutputTokens 2048`, `temperature 0.2`. 메타 "2 ms · gemini-3.5-flash-lite · OK / Input tokens 412 · output tokens 138" |
| JSON 실패 | 통과 | 잘린 JSON(`MAX_TOKENS`) → 원문 한 블록 `dir=auto`, 메타에 `· MAX_TOKENS`. 코드펜스 JSON → 원문 그대로 한 블록(8a jsonrepair 몫). 배열 JSON·`ko` 빠진 JSON → 원문 한 블록. 화면 깨짐 없음 |
| `<img onerror>` | 통과 | 두 블록 안·원문 블록 안 모두 문자 그대로 보임. 출력 안 `img/script/b` 요소 0, 스텁이 심은 전역 플래그 0 |
| 번역 언어 선택 | 통과 | [العربية]·[한국어] `aria-pressed`, 각 버튼 `lang`·`dir` 이 그 언어. 한국어로 → `ai.translationLang='ko'`(IndexedDB 행 확인), "Translation voice: not available → available"(이 PC 는 ko 음성만). 새로고침 뒤 `ko=true` 유지 |
| 속도 팝오버와 어긋남 | 해당 없음 | 팝오버의 번역 줄(`renderReadalongRow`)은 모드·원문 낭독 스위치만 그리고 **번역 언어를 표시하지 않는다** — 어긋날 값이 없다 |
| 지시문 한 곳 | 통과 | `TEST_PROMPT` 한 상수(COMMON·TASK·LANG_RULES·SCHEMA), 주석에 8a `prompts.js` 이전 명시. 예문은 지어낸 류마티스 관절염 두 문장(지시·용량 권고 없음) |

## 7b-fix-3. 키 누출 검사 (기계 검사 — `includes`)

가짜 키를 입력칸에 넣고 각 갈래를 일으킨 뒤 **요청 URL·요청 본문·`document.documentElement.outerHTML`(aria 속성 포함)** 을 검사했다.

| 갈래 | URL | 본문 | DOM |
|---|---|---|---|
| 검증 404 / 무효(400 `API_KEY_INVALID`) / 지역(400 `FAILED_PRECONDITION`) / 429 | 0 | 0 | 0 |
| 시험 번역 404(+목록 2쪽) / 500(오류 메시지에 키 포함) / 지역(403) | 0 | 0 | 0 |
| 모델 칸에 키가 저장된 경우(T5 경로) | 요청 자체가 나가지 않음(`[KEY] · BAD_REQUEST`) | — | 0 |
| 목록 2쪽(`pageToken`) | 0 | — | 0 |
| 노드: `nextPageToken` = 키, 키 그대로 | 둘째 요청 안 나감 | — | — |
| 노드: `nextPageToken` = 키, 키에 앞뒤 공백 | **고치기 전 누출 → 고친 뒤 0** | — | — |

콘솔: 모든 흐름에서 메시지 0. 소스·테스트에 실제 형식의 키 덩어리 없음(grep `AIza`·`AQ.Ab` — 주석·패턴뿐, 테스트 키는 문자열을 이어 붙여 만든다).

## 7b-fix-4. 화면 실측

미리보기 `preview_start blog`, 바뀐 파일은 `fetch(…,{cache:'reload'})` 후 쿼리를 바꿔 이동. [시험 번역] 두 블록이 펼쳐진 상태에서 쟀다. 미리보기 창 배율 때문에 폭이 361 로 잡힌 경우가 있다(그때도 `scrollWidth == clientWidth`).

| 뷰포트 · UI | `scrollWidth`/`clientWidth` | 화면 밖 요소 | [검증] | [시험 번역] | [العربية] | [한국어] | 모델 칸 | 번역 블록 폭 |
|---|---|---|---|---|---|---|---|---|
| 360×800 영어 | 360/360 | 0 | 294×48 | 294×48 | 141×48 | 145×48 | 294×48 | 241 · 241 |
| 360×740 영어 | 361/361 | 0 | 295×48 | 295×48 | 142×48 | 145×48 | 295×48 | 243 · 243 |
| 360×740 아랍어(`dir=rtl`) | 361/361 | 0 | 295×48 | 295×48 | 142×48 | 145×48 | 295×48 | 243 · 243 |
| 360×800 아랍어(404·경고 줄 표시) | 361/361 | 0 | 295×48 | 295×48 | 142×48 | 145×48 | 295×48 | — |

- 48px 미만으로 잡힌 것은 체크박스 `#aiRemember`·`#aiOnDevice`(24×24)뿐 — `label[for]` 높이 48, 줄 294×64 라 누를 자리는 48 이상. 7b 부터 있던 구조(이번 변경 아님).
- 아랍어 UI 에서 언어 버튼이 거울 배치(العربية 오른쪽), 한국어 블록만 `ltr`. 콘솔 0. 끝나고 뷰포트 desktop 으로 되돌림, 미리보기 설정값·가짜 키 지움.

## 7b-fix-5. 변이 테스트 (원본은 스크래치패드에 복사, 복사본으로 되돌리고 md5 일치 확인)

| 변이 | 출처 | 빨개진 테스트 |
|---|---|---|
| M1 `MODEL_UNAVAILABLE` 판정 삭제 | Build 재현 | 3 (E1·E2·E3) |
| M2a 목록 `MODELS_PAGE_SIZE = 1` | Build 재현 | 2 (L1·L2) |
| M3 2.5 무효화 삭제 | Build 재현 | 1 (D2) |
| M5 불필요 계열 필터 삭제 | Build 재현 | 1 (L3) |
| N1 목록 쪽 넘김에서 `assertNoKeyInUrl` 빼기 | Review 새로 | 1 (L5) |
| N2 `parseTestPair` 의 `try` 제거 | Review 새로 | 1 (J2) |
| N3 결과 블록 `textContent` → `innerHTML` | Review 새로 | 1 (C5 — 소스 검사) |
| N4 쪽 수 상한 제거 | Review 새로 | 테스트 파일 실패(L4 무한 쪽) |
| N5 같은 토큰 반복 멈춤 제거 | Review 새로 | 1 (L4) |
| N6 번역 언어 normalize 무력화 | Review 새로 | 1 (G1) |
| N7 MODEL 문구를 "확인 불가" 키로 | Review 새로 | 1 (E3) |
| R-a 고친 `assertNoKeyInUrl` 을 수정 전으로 | Review 수정 검증 | 1 (R1) |
| R-b `usableModels` 필터 제거 | Review 수정 검증 | 1 (R2) |

모든 변이에서 빨개지는 테스트가 있었다. 되돌린 뒤 659 통과.

## 7b-fix-6. 고친 것 / 기록만 한 것

### 고친 것
1. **`js/ai/provider.js` `assertNoKeyInUrl`** — 비교할 키를 `trim()` 한다. 틀렸던 점: `listModels`·`verifyKey` 는 헤더에 `trim()` 한 키를 싣고 `assertNoKeyInUrl` 에는 원문 키를 넘겨, 키에 앞뒤 공백이 있으면 `indexOf` 가 빗나갔다. 목록 쪽 넘김은 서버가 준 `pageToken` 을 URL 에 싣는 **처음 경로**라 이 빈틈이 실제 누출로 이어질 수 있었다. 테스트 R1.
2. **`js/ui/settings.js` `usableModels`(신설)·`refreshModels`** — 원격 목록에서 `settings.isRetired('ai.model', id)`(지금 `gemini-2.5-*`)를 뺀다. 틀렸던 점: 목록에 2.5 가 있으면 드롭다운에 나오고, 고르면 저장은 되지만 읽을 때 "설정 안 됨"이라 화면(2.5)과 요청(3.5)이 어긋났다. 걸러서 비면 원격 목록을 쓰지 않는다(정적 목록 유지). 테스트 R2.
3. `tests/settings-7b-fix.test.mjs` 끝에 R1·R2 추가(가짜 키는 기존의 쪼갠 상수 재사용).

### 기록만 (범위 밖이거나 결정이 필요한 것)
- **`preview` 모델 처리** — 지침에 없음. 지금은 남는다. 의견: 드롭다운은 **안정판만**(예: `gemini-<버전>-flash-lite` · `-flash` · `-pro`; `preview`·`exp`·`latest`·`gemma`·`robotics`·`computer-use`·`nano-banana` 제외) 보이는 **허용 목록** 방식이 낫다고 본다. 이유 — preview 는 짧은 예고로 내려가 다시 404 를 부르고, 한도도 다르며, Nour 는 이름만 보고 고를 수 없다. 지금 거부 목록(`UNFIT_FAMILY`)은 `nano-banana-pro-preview` 같은 새 이름을 놓친다. 다만 `MODEL_UNAVAILABLE` 이 이제 안내·새로고침을 하므로 급하지 않다 — 운영자 결정.
- `errorParser` 에서 `gs === 'NOT_FOUND'` 가 상태 코드보다 먼저라 `429/403/5xx + NOT_FOUND` 같은 (현실에 드문) 조합도 `MODEL_UNAVAILABLE` 이 된다. 실물 응답에서 보이면 다시 본다.
- [검증] 404 의 메타 줄은 `MODEL_UNAVAILABLE · HTTP 404`, 문구는 "확인 불가". 해롭지 않음.
- 모델 교체 경고(아랍어)에서 LTR 모델 이름이 문장 끝에 와 마침표 위치가 어색할 수 있다(`bdi` 없음). 작은 표시 문제.
- 코드펜스로 감싼 JSON 은 원문 한 블록으로 보인다 — 8a jsonrepair 몫.
- `tests/provider-7a.test.mjs` 기대값 3곳은 Build 가 범위 밖으로 알리고 고친 것(기본 모델 변경의 직접 결과) — 확인함, 다른 단언 변화 없음.
- REGION 두 줄·R1 AUTH 판정·`spec.md` 는 손대지 않았다.

## 7b-fix-7. 운영자 재확인 절차 (배포본, 실제 키)

1. 배포 뒤 설정 AI 탭을 **캐시 우회 새로고침**. 모델 칸 `gemini-3.5-flash-lite (기본)` 확인(예전 2.5 저장값은 자동 무시).
2. [검증] → "키가 유효합니다". 이어서 모델 드롭다운이 **여러 개**인지, `tts`·`image`·`embedding`·**`gemini-2.5-*`** 가 없는지 본다. **`preview` 가 들어간 이름이 몇 개인지 적어 둔다**(목록 정책 결정의 근거).
3. [시험 번역] → 결과 줄 **ms · 모델 · 코드 · 입력/출력 토큰** 기록. 404 면 "이 모델은 쓸 수 없습니다"가 떠야 하고, 드롭다운에서 `gemini-3.1-flash-lite` 로 바꿔 다시.
4. 한국어 블록으로 품질 판단 — 질환명·약물명(methotrexate·adalimumab)·숫자/단위(30분, 10 mg/L) 보존, 의학 용어 뒤 영어 괄호, 원문에 없는 내용 없음. 아랍어 블록은 같은 자리의 괄호 영어·숫자·약물명만 견주고, 가능하면 Nour 에게 "الفصحى 로 자연스러운가" 확인.
5. 블록이 하나뿐이고 `{` 나 코드펜스로 시작하면 JSON 파싱 실패 — 원문과 결과 줄(특히 `MAX_TOKENS`)을 기록. 400 `INVALID_ARGUMENT` 면 `responseSchema` 대문자 타입 `[가정]` 부터 의심.
6. "번역 언어"를 한국어/아랍어로 바꿔 "번역문 음성: 있음/없음"이 바뀌는지, 새로고침 뒤 선택이 유지되는지 본다.

---

# Review — MedReader 8a (번역 파이프라인·캐시·상태 기계·분할 계약) · 2026-10-10

> 검증자: Review 서브에이전트(Build 와 분리). 지침 `.claude/tasks/medreader-review-8a.md`. Build 보고서는 검증 대상으로만 읽고 전부 다시 쟀다.
> 커밋 없음 · 실제 키 사용 0(가짜 키는 실행 중에 조각을 이어 만들고 소스에 남기지 않음) · `git checkout/restore/stash` 사용 0 · 새 패키지 설치 0 · 차단 훅에 막힌 명령 0건.
> 시험 스크립트는 스크래치패드(`r8a/probe-*.mjs`, `r8a/mutate.mjs`)에만 두었다.

## 8a-1. 결론

**조건부 통과.** 16-D2 의 `[N]`·`[D]`(grep) 항목은 전부 통과한다. 상태 기계·Promise 공유·blocked/failed 구분은 직접 두드려도 Build 주장대로 움직였고 숨은 재시도 루프는 없었다.
결함 2건을 고쳤다(10-2 숫자 검사의 오탐, jsonrepair 의 펜스 오인). 테스트의 빈틈 2곳(살아남은 변이 2개)을 테스트 추가로 막았다.
남은 조건: **실PDF 로 낭독 큐가 그대로인지**(pdf.js 설치본 대기), 16-D2 `[D]` 기기 내 Translator(8c 로 넘김), 그리고 8a-7 의 결정 사항.

테스트: `node --test "apps/medreader/tests/*.test.mjs"` — Build 의 745 통과를 **직접 재현**, 리뷰 후 **749 통과 / 실패 0**(새 4개: V6·J11·K8·M8).

## 8a-2. 16-D2 항목별 결과와 확인 방법

| 항목 | 결과 | 어떻게 쟀나 |
|---|---|---|
| `[N]` 분할 계약 R1~R6 | ○ | `split-contract-8a` 12개 통과. R5 는 변이로 직접 재현(8a-6) — R2 만 빨강 1 |
| `[D]` grep `splitSentences` | ○ | `grep -rn splitSentences js/` → 정의 `text/segment.js:99`, 호출 `tts/text.js:180` 뿐(나머지는 주석·import) |
| `[N]` jsonrepair 5종 | ○ | 테스트 + 직접 시험: 펜스·후행 쉼표·잘린 배열·스마트 따옴표·스키마 위반 모두 기대대로. 악의적 입력은 8a-4 |
| `[N]` 10-2 검증 | ○(오탐 수정 후) | 8a-5 |
| `[N]` 상태 기계 | ○ | 8a-3 — 실제 `provider.js`·gemini 어댑터를 지나는 fetch 스텁 |
| `[N]` 캐시 | ○ | 키 `translate\|ar\|docA\|s256:…` — provider·model 없음, `readalong` 과 `translate` 가 같은 키. 정리 순서·문서 삭제는 8a-4 |
| `[N]` 프롬프트 | ○ | `grep -n "Arabic\|'ar'" js/ai/pipeline.js` 0건(readalong.js 는 아직 없음). P1 이 7b 지시문과 글자 단위 대조, P2 가 `ko` 지시문에 아랍어 없음 |
| `[D]` 기기 내 Translator | **8c 로 넘김(동의)** | 탭 화면이 8c. `ondevice.js` 는 `available` 일 때만·실패 시 `null`. N3 변이(자동 다운로드 허용)가 D3 를 빨갛게 함 |
| 설정 화면 회귀(브라우저) | ○ | 8a-4 끝 표 |
| 무료 한도 숫자·`innerHTML`·키 누출 | 0 · 0 · 0 | grep(한도·RPD/RPM 0건, 8a 파일 `innerHTML` 0 — settings.js 머리말 주석 1줄뿐), 누출은 8a-4 |

## 8a-3. 상태 기계 실측 (`r8a/probe-state.mjs`, 실패 0)

| 시험 | 결과 |
|---|---|
| 429(Retry-After 없음) → 이어서 20번 더 `translate` → 걸린 타이머 전부 발화 | `exhausted`, 결과 `blocked`, fetch **1**. 걸린 타이머는 만료 알림 하나(36,000,000ms = 다음 날 00:00)뿐 |
| 429, **실제 타이머·실제 시계로 1.5초 대기** | fetch 1 — 숨은 재시도 없음 |
| 429 + `Retry-After: 1` + "8b 흉내" 듣는 쪽(ready 가 오면 blocked 를 다시 보냄), 실제 3.3초 | fetch 4 = 1초에 1번. **Retry-After 간격으로만 다시 나가고 빽빽한 반복은 없다**(7-6 이 허락한 "상태 복귀 시 첫 전송") |
| 500 ×2 | fetch **정확히 2**(원 1 + 재시도 1), `cooldown`, `failed`. 만료 후 같은 문장 다시 부름 → fetch 그대로 2. `retry:true` 만 다시 보냄 |
| 401 / 400 FAILED_PRECONDITION / 403 "User location…" / 404 NOT_FOUND | `no-key` / `region` / `region` / `model`. 각각 fetch 1, `blocked`, **사흘 뒤에도 그대로**(시간으로 안 풀림) |
| 타임아웃(가짜 타이머) | 걸린 타이머 30,000ms 하나. 29,999 로는 아무 일 없음, 30,000 발화 → `cooldown`·`TIMEOUT`·fetch 1 |
| 같은 키 동시 5건(묶음 순서·경로 섞음) | fetch **1**, 다섯 모두 ready |
| offline → online | offline 동안 fetch 0·blocked, online 뒤 다시 부르면 첫 전송 1건 |
| 온라인 중 네트워크 오류(TypeError) | `cooldown`, `failed/NETWORK`, fetch 1 |

**`model` 상태(Build 결정)에 대한 의견 — 찬성.** 7-6 원칙은 "자동 재시도 없음·사용자 재시도로만 해제"다. `model` 은 시간·키 재입력으로 풀리지 않고 [다시 시도]·모델/프로바이더 변경으로만 ready 가 된다 — `region` 과 같은 끈적한 상태라 원칙과 맞는다. `no-key`(키 문제로 오안내)나 `cooldown`(만료마다 같은 404 를 다시 부름)보다 낫다. 그동안 문장을 `blocked` 로 두는 것도 맞다(내용이 판정받지 않았다 — 모델을 바꾸면 첫 전송). UI 문구 `ai.state.model` 은 8b/8c 몫.

**blocked / failed 구분에 대한 의견 — 대체로 일치, 한 가지 주의.**
- 일치: 429·401/403·REGION·MODEL·오프라인·호출자 abort → `blocked`(상태가 원인, 내용 미판정 → 상태가 돌아오면 첫 전송). 5xx 재시도 후·파싱·SAFETY·개수 누락·밀림 → `failed`(사용자 재시도만). 7-6 의 두 목록과 맞는다. `failedKeys` 가 상태 복귀 뒤에도 재전송을 막는 것을 직접 확인했다.
- 주의(결정 필요, 기록만): **온라인 중 네트워크 오류**도 `failed` 다. 모바일에서 순간 끊김(TypeError)이 나면 6,000자 청크(2~3쪽) 전체가 [다시 시도] 전까지 번역 없음이 된다. 요청이 서버에 닿았는지 알 수 없는 경우라 `blocked` 로 볼 여지도 있다. 8b 실기기에서 빈도를 보고 정하길 권한다.
- 무한 반복 경로: 찾지 못했다. 단, **성공 호출마다 `inflight → ready` 이벤트가 난다**(시험 [8]). 8b 가 "ready 가 오면 blocked 를 다시 보낸다"를 짤 때 `prev` 가 막는 상태(`exhausted`·`cooldown`·`offline`·`capped`·`no-key`·`region`·`model`)일 때만 보내야 한다 — 아니면 성공마다 재전송 훑기가 돈다(blocked 가 없으면 요청은 0 이지만 불필요한 일).

## 8a-4. jsonrepair·캐시·키 누출·화면

**jsonrepair 악의적 입력** (`r8a/probe-json-cache.mjs`)

| 입력 | 결과 |
|---|---|
| 5,000,000자 문자열 | ok, 10ms |
| 2,000,000자에서 잘린 문자열 | 355ms, 멈추지 않음(반쪽 항목은 버림) |
| `[` 20만 겹 + `]` 20만 겹 | SCHEMA, 24ms, 던지지 않음 |
| `{"segments":` + `[` 20만 겹(잘림) | 101ms |
| `{"a":` 10만 겹(스키마 없이) | 던지지 않음 |
| 문자열 밖 `e` 20만 개(잘림) | PARSE, 49ms(선형) |
| `__proto__`·`constructor.prototype` 키 | `Object.prototype` 오염 없음. 스키마 통과 값은 스키마 필드만 새 객체로 복사 — `__proto__` 가 붙지 않음 |
| 문자열 속 URL | 지워짐(10-7) |
| **번역문 속 백틱 세 개가 있는 멀쩡한 JSON** | **고치기 전 PARSE 실패** → 고침(8a-7 고친 것 1) |

**캐시**: 키에 provider/model 없음. 정리 순서 — createdAt 를 넣은 순서와 반대로 준 시험에서 가장 오래된 것부터 지워짐. 그러나 Build 테스트 K4 는 **삽입 순서 = createdAt 순서**라서 인덱스를 빼는 변이(N2)가 살아남았다 → K8 추가(8a-6). `deleteDoc` → 그 docId 0개.

**키 누출 기계 검사**(`includes`): 응답 6종(200·키를 되비춘 200·400 메시지에 키·500·429·throw) × 모델 칸 2종(기본·**키를 붙여 넣음**) = 12회. 요청 URL·`aiCache` 값·`usage` 행·`translate` 결과·상태 이벤트·콘솔 — **누출 0, 콘솔 출력 0**.

**설정 화면 회귀**(`preview_start {name:"blog"}`, 바뀐 파일 12개를 `fetch(…,{cache:'reload'})` 후 새 쿼리로 열고, 앱이 쓰는 모듈 인스턴스가 고친 코드인지 확인). 온보딩 완료·동의·UI 한국어와 가짜 키(sessionStorage)를 넣고 `generativelanguage.googleapis.com` 만 가로채는 fetch 스텁:

| 확인 | 결과 |
|---|---|
| [검증] | "키가 유효합니다 · 4ms · OK · HTTP 200" |
| [시험 번역] 평범한 JSON | 두 블록 — `ar/rtl`(bdi[dir=ltr] 8개: 영어 괄호 8개 전부) · `ko/ltr`. 메타 "ms · gemini-3.5-flash-lite · OK / 입력 토큰 421 · 출력 토큰 266" |
| 코드펜스 JSON | **두 블록**(7b 의 "한 블록" 결함 해소), bdi 8 |
| 번역문 속 백틱 세 개 | 두 블록(이번 수정 확인) |
| 잘린 펜스 + MAX_TOKENS | 원문 한 블록(`ai-tr-raw`) + "OK · MAX_TOKENS" — 의도대로 |
| 드롭다운 | `aiProvider`(1)·`aiModel`(2) 둘 그대로 |
| 360×740 | 두 블록, `scrollWidth 361 = innerWidth 361` |
| 요청 URL·DOM 의 키 / 키 위치 | 0 / 헤더에만(7건 모두) |
| 콘솔 | 0건 |

정리: fetch 원복, 가짜 키 `clearKey`(local·session 둘 다 비었음, 저장소 어디에도 키 문자열 없음), 넣은 설정 3개 `reset`(원래 값 `false·null·null` 확인), 뷰포트 desktop. 미리보기 브라우저의 `usage` 행(2026-10-10, 스텁 호출 수 — Build 확인분과 합쳐짐)은 그대로 두었다 — 키 문자열 없음 확인. `aiCache` 0건.

## 8a-5. 10-2 검증 오탐 시험 (`r8a/probe-10-2.mjs`)

운영자 캡처 꼴(Nour "좋다")의 아랍어를 문장 단위로 나눠 넣었다(`tests/bidi.test.mjs` 의 캡처 꼴 문장).

| 입력 | 비율 | 결과 |
|---|---|---|
| 문장 1(영어 괄호 3개, `30 دقيقة`) | 1.49 | ok |
| 문장 2(영어 괄호 5개, `mg/L → ملغ/لتر`, `10`) | 1.64 | ok — **단위가 번역돼도 숫자 소실로 보지 않는다**(숫자 `10` 이 남아 있으면 충분) |
| 같은 두 문장, 동방 숫자 `٣٠`·`١٠` | — | ok·ok |
| 한국어 번역 | 1.02·1.23 | ok |

경계 사례(정상 번역일 수 있는 것) — 고치기 전 → 후:

| 사례 | 전 | 후 |
|---|---|---|
| `1,500` → `1500`(천 단위 쉼표 생략) | **failed(digits)** | ok |
| `7.0%` → `7%` | **failed(digits)** | ok |
| `1,500` → `١٬٥٠٠` | ok | ok |
| `1,500` → `1.500`(유럽식) | failed | failed(드묾 — 그대로 둠) |
| `Type 2` → `النوع الثاني`(낱말) | failed | failed — 원문 숫자가 사라진 것이 맞다(10-1 규칙 5 위반). 의도대로 |
| 약어만 있는 짧은 문장 `ECG.`·`CRP.`·`MRI`(4자 이하) | failed(ratio 6~11) | failed — **spec 의 `[0.2, 5]` 그대로라 고치지 않음**(8a-7 기록) |
| `Treatment`·`Fig. 3`·범위 `3–5`·`IL-6`·간결한 번역(0.33) | ok | ok |

## 8a-6. 변이 테스트 (`r8a/mutate.mjs`)

방법: 원본을 스크래치패드 `r8a/orig/` 에 복사 → 변이마다 찾을 문자열이 **정확히 1곳**인지 확인 → 치환 → **변이 표지(`/*MUT_…*/`)가 작업본에 있는지 읽어서 확인** → 해당 테스트 실행 → `orig/` 내용으로 되돌리고 같은지 비교. 모든 변이에서 적용 확인 ○·복원 ○. 끝난 뒤 `cmp` 로 바뀐 8a 파일 9개와 review.md 가 원본과 같음을 확인했다(그 뒤에 이 리뷰의 수정을 넣었다).

| 변이 | 종류 | 빨강 | 걸린 테스트 |
|---|---|---|---|
| R5 `sentencesOf` 가 `.` 뒤에서 다시 나눔(두 번째 분할) | Build 재현 | 1 | **R2** |
| A1 429 에 1회 자동 재시도 | Build 재현 | 1 | M1 |
| A2 Promise 공유 빼기 | Build 재현 | 1 | M7 |
| A4 REGION → no-key | Build 재현 | 1 | M4 |
| N1 20% 경계 `>` → `>=` | 새것 | 1 | V3 |
| **N2 캐시 정리를 createdAt 인덱스 없이(삽입 순)** | 새것 | **0 → 살아남음** | → **K8 추가 후 1** |
| N3 기기 내 `downloadable` 도 쓰기(자동 다운로드) | 새것 | 1 | D3 |
| N4 10-7 URL 제거 끄기 | 새것 | 1 | J7 |
| **N5 숨은 재시도 루프(만료 타이머가 마지막 요청을 다시 보냄)** | 새것 | **0 → 살아남음** | → **M8 추가 후 1** |
| N6 표 안내에도 문장 번호(번역 입력에 들어감) | 새것 | 3 | R4·R4-보조·sentencesOf 정렬 |

고친 판이 원본에서 빨개지는지도 확인했다: `prompts.js`·`jsonrepair.js` 를 원본으로 바꿔 넣으면 V6·J11 이 빨강(2), 고친 판으로 되돌리고 `cmp` 일치.

## 8a-7. 고친 것 / 기록만 한 것

**고친 것** (지침의 "8a 가 만든 파일 안의 결함"):
1. `js/ai/jsonrepair.js` — `parseAIJson` 이 **그대로 파싱되는 JSON 도 먼저 펜스 제거부터** 했다. 번역문에 백틱 세 개가 들어 있으면 그 자리를 펜스로 알고 잘라 멀쩡한 응답이 PARSE 실패가 됐다(청크 전체 failed). → 원문을 먼저 `JSON.parse` 해 보고, 실패할 때만 펜스·자르기를 한다. 테스트 J11.
2. `js/ai/prompts.js` `numberTokens` — 숫자를 글자 그대로 비교해 `1,500` 과 `1500`, `7.0` 과 `7` 을 다른 숫자로 봤다 → 정상 번역을 "숫자 소실"로 버린다. 천 단위 구분(`,`·`٬`, 세 자리 묶음 앞에서만 — `1,2` 나열은 그대로)을 지우고 소수 끝 0·앞 0 을 떼어 **값으로** 맞춘다. 다른 숫자는 여전히 다르다(`1,500` vs `1600` → failed 를 테스트로 고정). 테스트 V6(운영자 캡처 꼴 아랍어 포함).
3. 테스트 빈틈: `tests/cache-8a.test.mjs` K8(정리 순서가 삽입 순서와 다를 때), `tests/pipeline-8a.test.mjs` M8(429·500 뒤 걸린 타이머를 전부 발화해도 요청 증가 0). 각각 살아남던 변이 N2·N5 를 빨갛게 만든다.

**기록만 한 것** (범위 밖이거나 결정이 필요):
1. **짧은 원문의 길이 비율 오탐** — `ECG.`·`MRI` 같은 4자 이하 문장은 영어 괄호를 붙인 정상 번역이 비율 5 를 넘어 failed. spec 10-2 의 `[0.2, 5]` 가 정한 값이라 고치지 않았다. 청크에서 이런 문장이 20% 를 넘는 일은 드물지만, 약어 하나뿐인 제목 문단을 탭하면 그 번역은 늘 실패한다. 제안: 원문이 짧을 때(예: 12자 미만) 상한에 절대 여유를 두기 — spec 결정 사항.
2. 온라인 중 네트워크 오류 = `failed`(8a-3 주의) — 8b 실기기 빈도를 보고 결정.
3. 8b 에게: `inflight → ready` 이벤트가 성공마다 난다 — 재전송은 `prev` 가 막는 상태일 때만(8a-3).
4. (`provider.js`, 7a 영역) 모델 칸에 키를 붙여 넣으면 `assertNoKeyInUrl` 이 막아 누출은 없지만, 그 오류가 `UNKNOWN` 으로 감싸져 파이프라인은 `cooldown` + `failed/NETWORK` 로 처리하고 `usage.calls` 도 1 오른다(실제 요청 0). 오안내·잘못된 실패 기억이다. `charsTranslated` 외에는 이번 수정 범위가 아니라 기록만.
5. Gemini 는 429 에 `Retry-After` **헤더**를 잘 주지 않고(본문 `retryDelay`), CORS 로 헤더가 안 보일 수도 있다 → 실제로는 대부분 "다음 날 00:00" 이 된다. 분당 한도(RPM) 429 도 하루 내내 막힐 수 있다. 8b 실키 확인 때 429 본문을 기록해 볼 것.
6. Build 결정 4(`byKind.readalong` 은 빈 행에 없고 처음 쓰일 때 생김)는 spec 9-2 와 다르다 — 대시보드(8c)가 `|| 0` 으로 읽으면 문제 없음. 결정 1·2·3·5·6·10·11 은 납득. 결정 10(번역 지시문 끝 아랍어 문체 지시)은 `TARGET_STYLE` 표에서 오고 `ko` 대상에 섞이지 않음(P2)을 확인.

## 8a-8. 실PDF 확인 대기 항목 (pdf.js 설치본 없음 — 운영자 허락 대기)

기존 픽스처로 한 것: `synth-2col.json` → `buildPageLayout` → `describePage` → (HEAD 의 `flowParas` 본문 + HEAD 의 `tts/text.js`) vs (지금의 `flowParasOf` + `insertTableNotices` + 지금의 `tts/text.js`) — 새 필드(`src/seg/kind`)를 뺀 낭독 큐가 **문장 모드 16개·줄 모드 36개 모두 JSON 기준 같다**(`r8a/probe-queue.mjs`; 문단 8·표 2 → `sentencesOf` 14항목).

실PDF 로 남은 것:
1. 실제 책(CMDT·Harrison) 몇 쪽에서 분리 전후 낭독 큐(문장 수·`lineIds`·`ranges`)가 같은지 — 위 비교를 실제 쪽으로.
2. 실제 쪽에서 R2(모든 Unit 의 `src` 가 `sentencesOf` 에 정확히 하나)와 `frag` head/tail 이 쪽 경계에서 맞는지 — 표 안내가 낀 쪽 포함.
3. 리더 화면에서 낭독이 그대로 도는지(하이라이트·표 안내 발화) — 브라우저에 가져온 PDF 가 없어 Build 도 리뷰도 보지 못했다.

---

# 7c + 8a 후속 Review (2026-10-10)

> Review 서브에이전트. 지침 `.claude/tasks/medreader-review-7c-8af.md`. Build 보고는 검증 대상으로만 읽고 전부 다시 쟀다.
> 커밋 없음 · 실제 키 0(가짜 키 `AQ.Ab_REVIEW78_DUMMY…` 만) · `git checkout/restore/stash` 0. 측정 스크립트는 스크래치패드 `rv78/` 에만 있다.
> 원서 문장은 옮기지 않았다(아래 조각은 전부 30자 이하 진단용).

## 7c8-1. 결론 — **조건부 통과**

16-D1 의 `[N]`·`[D]` 항목은 전부 통과했다. 8a 후속 세 결정(20자 미만 비율 생략·응답 없는 실패는 blocked·`KEY_IN_URL`)도 Build 주장대로 움직였다.
8a Review 때 대기였던 실PDF 항목은 세 책 2,583쪽에서 끝냈다. 낭독 큐는 8a 분리 전후, 7c 전후 모두 **한 글자도 다르지 않다**.
조건은 하나다. **documents 갱신 경합을 재현했다**(7c8-5). 지연을 넣으면 사용자가 고른 원문 언어가 매번 되돌아간다. 고치지 않았고 운영자 결정이 필요하다.
테스트 빈틈 3곳(살아남은 변이)과 간헐 실패 테스트 1개를 고쳤다. 테스트는 **806 → 808 통과, 실패 0**이다(전체 실행 10회 이상).

## 7c8-2. 16-D1 항목별

| 항목 | 결과 | 어떻게 쟀나 |
|---|---|---|
| `[N]` lang.test: en·fr·ko·zh·ja·ar·200자 미만·동률 | ○ | G1~G12 통과. 경계 테스트는 없었다. 계통 임계 30%→50%, 기능어 2배→1배 변이가 둘 다 살아남아서 **G13·G14 를 더했다**(7c8-8) |
| `[D]` 가져오면 본문 5쪽 추출 뒤 `lang`·`langGuess` 채움 · 카드 "(자동)" · [⋯] → `'user'` · 이후 추정이 덮지 않음 | ○ | 실제 가져오기 경로를 썼다(`#fileInput` 에 브라우저에서 만든 PDF). 영어 12쪽은 `en/auto/{en,1,latin}`, 프랑스어 8쪽은 `fr/auto/{fr,1,latin}` 이 되었고 카드에 "원문: Français (자동)"이 보였다. [⋯] → Français 를 고르면 DB `fr/user`, 메타 "원문: Français"(자동 없음)이 되고 패널은 열린 채 `aria-pressed` 가 갱신된다. 덮어쓰기 시험은 `user` 레코드의 `langGuess` 를 일부러 `null` 로 둔 뒤 새로고침해 다시 열었다. `ko/user/null` 그대로였다 |
| `[D]` 열린 문서 언어 변경 → `article[lang]`·`utterance.lang`·큐(새로고침 없이) | ○ | **실제 제자리 경로**: `É`·`À` 로 시작하는 문장이 있는 프랑스어 PDF 를 가져와 리더가 열린 채로 추정을 기다렸다. 같은 `article` 노드에서 `en|en-US|16` 이 `fr|fr-FR|32` 로 바뀌었다(큐가 새 규칙으로 다시 나뉨). [⋯] 경로로 ko→en→fr→ko 를 돌리면 `ko-KR/32`, `en-US/16`, `fr-FR/32`, `ko-KR/32` 이다 |
| 음성 없음 배너 "{언어} 음성이 없습니다" 언어마다 1회 | ○(부분) | 이 PC 에는 fr 음성만 없다. "이 기기에 Français 음성이 없습니다…" 배너는 세션에서 1개뿐이었고, fr 로 두 번 바꿔도 늘지 않았다. 음성 없는 **두 번째** 언어는 이 PC 에서 만들 수 없어 소스 검사(W3)로만 확인했다 |
| `[D]` grep 0건(quiz.js·config 지역 표 제외) | ○ | `grep -rn "pickVoice('en'\|setAttribute('lang', 'en')\|'en-US'" js/` 에서 quiz.js 를 빼면 `config.js:349 en: 'en-US'` 1건뿐이다 |
| `[N]` `splitSentences` 영어 불변 | ○ | E1 테스트에 더해 **실물**로 쟀다. 세 책 2,583쪽에서 HEAD(7c 전) `buildUnits` 와 지금 것을 비교했다(`{lang:'en'}`·인자 없음 × 문장·줄 모드 = 5,166 비교). `src/seg/kind` 를 포함한 JSON 이 전부 같다 |
| 분할 한 벌(R6) | ○ | `splitSentences(` 는 정의 `text/segment.js` 한 곳, 호출 `tts/text.js:194` 한 곳뿐이다 |

## 7c8-3. 8a 때 대기였던 실PDF 항목 (pdf.js 5.4.149, `rv78/probe-real.mjs`·`probe-pairs.mjs`·`probe-frag.mjs`)

**1. `flowParasOf` 분리 전후 낭독 큐** — 세 책을 3쪽 간격으로 2,583쪽 쟀다(Harrison 243 · CMDT 2026 656 · CMDT 2021 1,684). 길은 앱과 같게 `buildPageLayout → toStored → fromStored → describePage` 로 탔다. 8a 전(`6eadbbf`) 쪽은 인라인 `flowParas` + 그때의 `insertTableNotices`·`tts/text.js` 를 썼다. 지금 쪽은 `flowParasOf` + `insertTableNotices` + 지금 `tts/text.js` 다. 새 필드 `src/seg/kind` 를 뺀 큐를 비교했다. **문장 2,583 + 줄 2,583 = 5,166 비교가 전부 같다.** 표 안내가 낀 쪽 171쪽(안내 364개)도 포함된다.

**2. R2·`frag` 를 실제 쪽에서** — 낭독 단위 73,833개·문장 71,477개를 봤다.

| 검사 | 위반 |
|---|---|
| R2 모든 Unit 의 `src` 가 `sentencesOf` 에 정확히 하나 | **0** |
| R4 표 안내 유무와 `sentencesOf` 동일 | **0** |
| `seg` 가 0부터 연속 | **0** |

쪽 경계 짝은 9쪽 간격으로 쟀다. 레이아웃은 **이웃 쪽을 넣은** 것(추출기의 역할 재계산과 같은 입력)을 썼다.

| 책 | 짝 | head→tail (진짜 이어짐) | head, 다음 쪽 tail 아님 | tail, 앞쪽 head 아님 | 없음 |
|---|---|---|---|---|---|
| Harrison | 81 | 27 | 25 | 3 | 26 |
| CMDT 2026 | 215 | 11 | 127 | 2 | 75 |
| CMDT 2021 | 548 | 281 | 146 | 0 | 121 |

- 진짜 이어짐은 맞게 잡는다. 예: `…is reliably` ‖ `relieved by aspirin.`, `…immune system` ‖ `dysfunction.`
- **거짓 head** 는 쪽 끝이 마침표 없는 제목·선택지(`E. von Willebrand factor`)·쪽 표지(`YRix`)일 때 나온다. head 중 소문자·쉼표로 끝나는 진짜 조각은 약 3/4 이다(42/51 · 114/150 · 322/432).
- **tail 누락**: CMDT 2026 에서는 다음 쪽 첫 문단이 러닝 헤드(`12 CMDT 2026 CHAPTER 1` 꼴, 아래 범위 밖 ①)라서, 85/127 쌍에서 이어지는 소문자 조각에 tail 이 붙지 않는다.
- 거짓 tail 3건은 앞쪽 끝이 각주·약어 범례였다. tail 자체는 맞다.
- `frag` 는 프롬프트 표시("조각이니 완성하지 말라")일 뿐이다. 거짓 head 의 해는 작고, R2(1:1)는 깨지지 않는다 — **기록만** 한다.

**3. 리더에서 실제 책 낭독** — 미리보기 브라우저에 실제 책을 넣을 방법이 없었다. 파일 선택은 자동화할 수 없고, 다운로드 폴더를 서버로 열면 목록이 노출된다. 대신 브라우저에서 만든 PDF 3개로 **실제 가져오기 → 추출 → 추정 → 리더 → 낭독 큐** 를 확인했다. 실제 책의 소리 낭독(하이라이트·표 안내 발화)은 **사용자 실기기 확인으로 남긴다**.

## 7c8-4. 언어 추정의 실물

추출 순서(1→30쪽)를 흉내 내며 `collectSample`·`readyToGuess`·`guessLang` 을 앱과 같은 입력으로 돌렸다.

| 책 | 1–30쪽 글자 | 추정이 돈 쪽 | 그때 본문 쪽 | 결과 | 30쪽 전체 | 기능어 /1000낱말 (en · fr) |
|---|---|---|---|---|---|---|
| Harrison | 1–3쪽 짧음(표지·속표지) | 9 | 4·5·6·7·9 | **en 1** | en 1 (본문 25쪽) | 210 · 0 |
| CMDT 2026 | **1–3쪽 0자**(이미지 표지) | 8 | 4–8(앞붙이) | **en 1** | en 1 (24쪽) | 100 · 0 |
| CMDT 2021 | **2–27쪽 0자** | 30("앞 30쪽 다 모임" 규칙) | 28·29 | **en 1** | en 1 (2쪽) | 229 · 0 |

- 이미지 표지와 빈 쪽은 글자가 없어서 표본에서 저절로 빠진다. 앞붙이·차례가 "본문 쪽"으로 세어져도 언어는 같으니 결과는 맞다.
- **위험(기록만)**: 앞 30쪽이 **전부** 이미지면(스캔 앞붙이) 빈 표본으로 `en, score 0` 이 `langSource:'auto'` 로 저장된다. 그 뒤로는 다시 돌지 않는다(`shouldGuess` 거짓). 카드에는 근거 없이 "English (자동)"이 보인다. 프랑스어 책이면 사용자가 [⋯] 로 고쳐야 한다. 30쪽을 넘겨 더 기다릴지, 빈 표본이면 `default` 로 둘지는 spec 결정이다.

## 7c8-5. 경합 재현 결과 — **재현됨(2/2)**

**방법(지연 주입)**: 미리보기 브라우저에서 `IDBDatabase.prototype.transaction` 을 감쌌다. `documents` **읽기 전용** 트랜잭션의 `oncomplete` 를 3초 늦게 부른다. 그러면 `db.get('documents')` 가 3초 늦게 끝난다. 읽기-쓰기(`updateDocLang`)는 늦추지 않았다. `IDBObjectStore.prototype.put` 에는 기록기를 달았다.

**각본**: 리더에서 쪽을 넘기고(지연 켬, 리더의 `get` 시작), 3.4초에 숨은 서재 카드의 [⋯]에서 한국어를 골랐다(같은 위임 경로).

| 시각 | 일 |
|---|---|
| 3.41s | `updateDocLang` 이 `ko/user` 를 씀(한 트랜잭션) |
| 6.01s | 3초 전에 읽어 둔 레코드로 `put` 3건: `fr/user`(lastPage 5 — `saveLastPage`) + `fr/user`(lastPage 3) ×2 — 스택이 `db.js` 에서 잘려 호출자를 특정하지 못함. `get→put` 꼴의 다른 쓰기(아래 표)다 |
| 8.1s | DB `fr/user` — **사용자 선택이 되돌아갔다** |

- 카드 메타·`aria-pressed`·리더는 그 세션 동안 "한국어"를 보인다. DB 는 Français 다. 새로고침하면 카드가 "Français" 가 된다(실제로 확인 — 선택이 사라졌다).
- 같은 뿌리에서 나오는 **리더 쪽 증상**: `showReader` 가 늦게 끝난 `get` 의 옛 레코드를 `state.doc` 으로 삼았다. 사용자가 fr 을 고른 뒤인데도 그 쪽을 `article[lang=ko]`·`ko-KR` 로 그렸다. 다음 쪽에서 스스로 풀린다.
- 자동 추정도 같은 식으로 지워질 수 있다. 그때는 `langGuess` 가 `null` 로 남는다. 다음에 열 때 다시 돌아서 스스로 낫지만, 이번 세션의 감시는 이미 끝나 있다.

**레코드 통째 쓰기(get→put 이 다른 트랜잭션)**

| 곳 | 창(읽기~쓰기 사이) | 빈도 |
|---|---|---|
| `pdf/extract.js` `_saveMeta` (597–612) | IDB 왕복 1번(ms) | 추출 중 10쪽·2초마다. 7000쪽이면 몇 시간 |
| `ui/reader.js` `saveLastPage` (1056–1061) | ms | 쪽을 넘길 때마다 |
| `ui/quiz.js` `saveIndex`·`sectionIndexDone` (270–273·310–314) | ms | 색인 갱신 때 |
| `ui/library.js` `openDoc` (556–568) | **Blob 읽기 + PDF 파싱**(큰 책은 수백 ms~초) | 추출기가 안 붙은 문서를 열 때 |
| `ui/library.js` 가져오기 중복 경로 (342–354) | ms | 같은 파일을 다시 가져올 때 |

**심각도: 중간-낮음.** 자연 상태의 창은 대부분 ms 라서 한 번 고를 때 겹칠 확률은 작다(추정 1% 미만). 다만 큰 책은 추출이 몇 시간 돌고, `openDoc` 창은 길다. 겹치면 **사용자 설정이 조용히 사라진다**. 본문·위치는 잃지 않는다.

**고칠 범위(고치지 않았다 — 운영자 결정)**: `db.js` 에 "한 트랜잭션 안에서 읽고 고쳐 쓰기" 도우미(`update(store, key, mutate)`)를 둔다. 위 다섯 곳을 **자기 필드만 합쳐 쓰기**로 바꾼다(`extraction`·`lastPage/lastLineId`·`sectionIndex*`·`pageCount/lastOpenedAt`). `showReader` 는 `medreader:doclang` 을 받은 뒤의 늦은 읽기를 버리게 한다. 4절 알고리즘·`algoVersion`·`DB_VERSION` 과는 무관하다. 인계 문서의 이월 결함 "documents 갱신 경합"과 같은 뿌리다.

## 7c8-6. 8a 후속 확인 (`rv78/probe-8af.mjs` — 테스트 파일과 다른 각본, 실패 0)

| 확인 | 결과 |
|---|---|
| 20자 경계: 19자 `Serum K 4.1 mmol/L.` · 20자 `Dose: 2 mg IV daily.` · 21자 `Repeat ECG in 2 days.` | 19자는 5배 초과·0.2배 미만 모두 ok. 20·21자는 둘 다 `failed/ratio`. 숫자 소실은 세 길이 모두 `failed/digits` |
| 코드 포인트로 센다 | `𝛼` 가 든 19 코드 포인트(UTF-16 20)는 비율 생략 → ok |
| 8b 흉내(만료 알림마다 다시 보냄), 가짜 시계 8시간 | 네트워크만 **4** · 타임아웃만 **4** · 둘 교대 **4**(`b/NETWORK → b/TIMEOUT → b/NETWORK → f/TIMEOUT`) |
| 5xx 먼저 | 2건(원 1 + 즉시 재시도 1) → `failed/SERVER`. 그 뒤 재전송 0 |
| 문장 집합 둘을 번갈아 | 5건 — 단계는 파이프라인 전체가 함께 쓴다. 3단계 뒤 처음 보내는 다른 집합은 한 번 실패로 곧 failed(아래 기록) |
| 중간에 성공 1번 | 단계가 0 으로 → 7건. 무한 반복 없음 |
| `KEY_IN_URL` | fetch **0**, usage 행 없음(calls·errors 0), 상태 `model`, 이벤트 `code:'KEY_IN_URL'`, 문장 `blocked/model`, `translate.calls` 0. 사흘 뒤에도 `model`, `configChanged('key')` → ready. 결과·이벤트·usage 에 키 문자열 없음 |
| 화면(브라우저, 아랍어 UI) | 모델 칸에 가짜 키 → [시험 번역]: 요청 0, usage `calls 2 → 2`, `data-outcome="keyInUrl"`, 문구 "حقل النموذج يحتوي على مفتاح API…", 왼쪽 띠 `rgb(163,35,31)` = `--c-danger` |
| `settings.ai.test.keyInModel` 네 언어 · 키 집합 | 4/4 · 265개로 동일 |

## 7c8-7. 키 누출·회귀 (미리보기 `blog`, 바뀐 모듈은 `fetch(…,{cache:'reload'})` 후 새 쿼리로 열었다)

| 확인 | 결과 |
|---|---|
| [검증] | "المفتاح يعمل." · `4 ms · OK · HTTP 200` |
| [시험 번역] | 두 블록 `ar/rtl`(영어 괄호 2개 → `bdi[dir=ltr]` 2개) · `ko/ltr` |
| 드롭다운 | `aiProvider`·`aiModel` 2개 |
| 요청 URL·DOM·usage 의 키 | 0 · 0 · 0. 키는 `x-goog-api-key` 헤더에만 있다. 모델 칸 키 경우에도 URL 0 |
| 서재 [⋯] 아랍어 UI | `dir=rtl`. 패널이 `direction: rtl` 이고 English 가 오른쪽, [⋯] 는 줄 끝(왼쪽) 48×48. 메타 "لغة الأصل: Français (تلقائي)" 정상. 선택 버튼 48px, `lang` 속성 붙음 |
| 360×740 가로 스크롤 | 서재·설정·리더 모두 `scrollWidth = innerWidth`, 화면 밖 요소 0 |
| 콘솔 오류 | **0**. 경고 2줄 `[ds-level2] …` 은 같은 탭에서 앞서 연 다른 앱(데이터 과학 앱)의 것이다. MedReader 와 무관 |
| 정리 | fetch 원복, 가짜 키 `clearKey`, IndexedDB 13개 스토어 전부 0(시작 때와 같음), local·sessionStorage 0, 뷰포트 desktop |

## 7c8-8. 변이 (`rv78/mutate.mjs`) — 찾을 문자열 정확히 1곳 → 표지 `/*MUT_*/` 읽어 적용 확인 → 전체 테스트 → 스크래치패드 백업본으로 복원 → 바이트 비교

| 변이 | 종류 | 빨강 | 걸린 테스트 |
|---|---|---|---|
| B7-1 영어 문장 시작 정규식에 `\p{Lu}` | 7c Build 재현 | 4 | E1·E3·P2·P3 |
| B7-2 `applyGuess` 의 `'user'` 보호 삭제 | 7c Build 재현 | 2 | F3·F8 |
| BA-1 20자 조건 빼기 | 8a 후속 재현 | 3 | L1·L3·L5 |
| BA-2 3단계 상한 빼기(늘 blocked) | 8a 후속 재현 | 3 | N2·N3·T2 (Build 보고의 2 + 뒤에 더해진 T2) |
| N1 상한 하나 넘김(`<` → `<=`, 5건) | 새것 | 3 | N2·N3·T2 |
| N2 응답 본문 해석 실패(`responseParser` 가 던짐)도 `noResponse` | 새것 | **0** | 살아남음 — gemini `responseParser` 는 던지는 경로가 없어 도달 불가에 가깝다. 기록만 |
| N3 계통 임계 30% → 50% | 새것 | 0 → **1** | **G13 추가 후** 빨강 |
| N4 `langKey` 를 두 글자로 자르기 | 새것 | 0 | 동등 변이 — `und` → `un` 도 빈 기호 표·en 분할로 같다. 기록만 |
| N5 표본에 제목 문단 포함 | 새것 | 1 | S1 |
| N6 기능어 2배 규칙 → 1배 | 새것 | 0 → **1** | **G14 추가 후** 빨강 |
| N7 낭독 중 `NO_VOICE` 배너가 원문 언어 대신 `'en'` | 새것 | 0 → **1** | **W3 보강 후** 빨강 |

모든 변이에서 적용 확인과 복원 확인이 됐다. 끝난 뒤 `js/`·`tests/` 전체를 백업본과 `cmp` 해서 같음을 확인했고, `grep MUT_` 0건이다.
첫 BA-2 실행에서 전체 테스트가 한 번 **유휴 상태로 멈췄다**(자식 CPU 0.45초에서 멈춤). 그 자식을 끝냈고, 같은 변이를 시간 제한을 걸어 다시 돌리니 2.8초에 빨강 3으로 끝났다. 변이 없는 전체 실행도 10회 넘게 멈춘 적이 없다. 재현되지 않아 원인 미상으로 남긴다.

## 7c8-9. 고친 것 / 기록만 한 것

**고친 것**(두 Build 가 만들거나 바꾼 파일 안에서만)
1. `tests/lang.test.mjs` — **G13**: 영어 병기가 많은 한국어(한글 44%)를 ko 로 판정하는지 본다. 30% 임계를 고정한다. **G14**: 기능어가 1.5배면 en + 낮은 score 인지 본다. 2배 규칙을 고정한다. 살아남던 변이 N3·N6 이 빨개진다.
2. `tests/srclang-wiring-7c.test.mjs` W3 — `CODES.NO_VOICE` 경로가 `noVoiceNotice(sourceLang())` 인지 본다. N7 이 빨개진다.
3. `tests/pipeline-8a.test.mjs` M6 — 고정 5ms 대기가 전체 실행 부하에서 **간헐 실패**했다(관측 1회). 요청이 실제로 나갈 때까지(최대 2초) 기다리게 바꿨다. 단언은 그대로다.
4. `js/text/segment.js` 주석 — 대조 테스트 이름이 없는 파일 `tests/segment-lang.test.mjs` 로 적혀 있었다. `tests/srclang-7c.test.mjs` 의 E1 으로 바로잡았다(동작 무변경).

**기록만**(결정이 필요하거나 범위 밖)
1. **documents 갱신 경합**(7c8-5) — 운영자 결정.
2. 미지원(`und`) 문서에서 음성 없음 배너가 **"이 기기에 und 음성이 없습니다"** 로 나온다(`onboarding.lang.und` 키가 없어 코드가 그대로 들어간다). 설치할 음성이 없는 경우라서, 배너를 띄우지 않을지 다른 문구를 쓸지 정해야 한다.
3. 빈 표본 추정이 `auto/en/0` 으로 굳는다(7c8-4).
4. `cooldownLevel` 은 시간으로 줄지 않고 파이프라인 전체가 함께 쓴다. 3단계를 다 쓴 뒤에는, 그동안 한 번도 안 보낸 문장도 첫 실패에서 곧 `failed` 가 된다. 상한은 지켜진다. 성공 한 번이면 0 으로 돌아간다. 8b 실기기에서 다시 볼 것.
5. 거짓 head(제목·선택지)와 CMDT 2026 의 tail 누락(7c8-3) — 프롬프트 표시라 해는 작다.
6. **범위 밖 ①**: CMDT 2026 러닝 헤드(`N CMDT 2026 CHAPTER k`, `COMMON SYMptOMS CMDT 2026 21` 꼴)가 표본 200쪽 중 **196쪽에서 낭독 문단에 남는다**(`role:'header'` 는 3쪽뿐). 매 쪽 첫머리에 읽히고 tail 표시도 가린다. 4절 `classifyRoles` 몫(14단계 책별 측정과 함께 볼 것). 측정: `rv78/probe-hdr.mjs`.
7. 스크래치패드 정리 중 `rm -rf` 가 차단 훅에 막혔다. 우회하지 않았고 새 폴더(`rv78/fixed2/`)를 썼다. 스크래치패드의 `rv78/fixed/` 는 남아 있다.

---

# 8b Review — 낭독 동반 번역 (8b-1 서비스 + 8b-2 자막 띠) (2026-10-10)

> Review 서브에이전트. 두 Build 와 따로 다시 쟀다. Build 보고서는 비교할 대상으로만 썼다.
> 커밋하지 않았다. 실제 키는 넣지 않았다. 브라우저에서는 지어낸 가짜 키와 fetch 스텁을 썼고, 끝난 뒤 지웠다.
> 측정 스크립트는 스크래치패드 `r8b/` 에 있다. 원서 문장은 옮기지 않았다.

## 8b-1. 결론 — **조건부 통과**

- 서비스(창·청크·막힘·재시도)와 발화 순서는 맞다. 비용 보장은 실제 책 두 권으로 따로 재서 확인했다. 창 밖 요청 0, 막힌 10쪽 동안 요청 0, 알림 1번, [다시 시도] 즉시.
- **간헐 실패의 원인을 찾아 고쳤다.** 캐시 키 해시가 실제 시계를 따랐다(8b-3). 고친 뒤 부하를 줘도 0/48, 순차 실행도 0/10.
- 조건은 실기기 확인 세 가지다. 셋 다 기록만 했다.
  - ① **가로 800×360 에서 배너가 하나라도 뜨면** 원본 뷰 상자가 0px 이 되고, 띠가 원본 확대 막대를 덮는다(8b-8).
  - ② 데스크톱 Chrome 은 아랍어 음성이 없어도 **오류 없이 1.2초 만에 끝낸다**. 그래서 [들어 보기]가 "있음"으로 잘못 판정한다(8b-5).
  - ③ B4 를 글자 40px 에서는 기하학적으로 지킬 수 없다(8b-8).
- 테스트: 시작 880(통과 880) → 끝 **882**(통과 882). 더한 것은 RV1·RV2 두 개다.

## 8b-2. RA·B 항목별

| 항목 | 판정 | 근거 |
|---|---|---|
| RA1 | ○ | RA1 — 줄 순서를 겹쳐 놓고 하나씩 푼다. `trVoice:null` 은 speak 를 지킨다(10-10 결정) |
| RA2 | ○ | RA2. 간헐 실패를 고친 뒤 안정 |
| RA3 | ○ | RA3·RA3b. 실제 책 측정에서도 창 위반 0(8b-6) |
| RA4 | ○ | 6개 상태 × 10쪽, 요청 0·알림 1. 브라우저에서도 429 → 쪽 3번 넘김 → 요청 0·배너 1 |
| RA5·RA6·RA12·RA13·RA14 | ○ | 각 테스트. 변이로 확인한 것은 8b-9 |
| RA7 | ○ | RA7a~h·RA7f2. 브라우저에서도 `[src,tr,src,tr…]`(단계 기록 `1 src → 1 tr → 2 src → 2 tr…`) |
| RA8·RA10·RA11 | ○ | 각 테스트. 변이 N2·N3 이 RA10·RA11 을 빨갛게 만든다 |
| RA9 | ○ (결정 반영) | RA9a/b/c + **새 RV1·RV2**(운영자 폰 상황을 감시자부터 speaker 까지 한 줄로 이음) |
| 괄호 속 라틴 | ○ | 발화에서는 빠지고(TX·RV1), 띠 화면에는 남는다(RV1 의 `ra.get().text`, 브라우저 bdi 격리) |
| B1 | ○ | 360×800 글자 16·22·40 = **110.19·119.92·142.59**(토큰과 차이 0). 800×360 = 79.37(22dvh, 창 361 기준) |
| B2 | △ | 세로: 띠 아래변 662.76 ≤ 바 윗변 662.87. 크롬 높이 257.91 = 138 + 119.92. **가로 + 배너에서는 깨진다**(8b-8) |
| B3 | △ | 360×800 폭 맞춤·확대 모두 canvas 아래변 542.53·542.76 ≤ 띠 윗변 542.84. 가로는 배너가 없으면 ○(143.42 = 143.42, 상자 30.4px), **배너가 있으면 상자 0px** |
| B4 | △ | 22px 22문장(쪽 경계 포함)·16px 20문장 위반 **0**. 40px 는 20/20 위반이지만 20문장 **모두 문장 높이가 본문 영역(471px)보다 크다**(129~241자). 시작은 영역 맨 위에 둔다(20/20) — 기하학적 한계(8b-8) |
| B5 | ○ | scrollWidth 361 ≤ 361(세로, 글자 16·22·40), 801 ≤ 801(가로), 설정 화면 361 |
| B6 | ○ | `ko` 로 바꾸면 `dir=ltr lang=ko`·bdi 0. 모의 `<img src=x onerror=…>` 는 글자로 보이고 img 0·실행 0. ar 은 `dir=rtl lang=ar`·bdi 격리 |
| B7 | ○ (부드러운 경로는 미확인) | reduced-motion: 줄 높이 배수 계단(0 → 35.99), 띠를 누르면 같은 문장 동안 멈춤(held), 다음 문장에서 0·해제 |
| B8 | ○ | 본문/상태 줄/[다시 시도] — light 17.4/7.37/7.21 · dark 13.86/7.3/8.67 · sepia 11.94/6.85/7.26 · contrast 21/21/16.57 · system 17.4/7.37/7.21. 버튼 높이 47.99 |
| bidi 한 벌 | ○ | `appendBidiText` 정의는 `ui/bididom.js` 한 곳. settings·trband 둘 다 import(B5 테스트). [시험 번역] 두 블록 — ar bdi 2, ko bdi 0 |

## 8b-3. 간헐 실패 원인 — **찾았고 고쳤다**

- **재현**: 처음에는 순차 15번 실행해도 재현되지 않았다. `readalong.test.mjs` 를 8개씩 동시에 40번 돌리니 **7번 실패**했다. 실패한 테스트는 매번 달랐다(RA2·RA5·RA6·RA12d·RE·RT×3).
- **원인**: 캐시 키(`hash.js` `hashHex`)가 `crypto.subtle.digest` 를 쓴다. Node 에서는 이 계산이 **libuv 스레드 풀**에서 돌기 때문에 끝나는 시점이 실제 시계를 따른다. 그런데 테스트는 `flush()`(setImmediate 30번)·`settle()`(20번)이 끝나면 refill 이 끝났다고 가정했다. 기계가 바쁘면 해시가 그 안에 끝나지 않는다. 그러면 요청이 아직 나가지 않은 상태에서 단언이 돈다(Build 가 본 `actual 2, expected 3`).
- **확증**: 해시를 일부러 3ms 늦추는 preload(스크래치패드 `r8b/slow-digest.mjs`)를 걸면 **12개가 매번** 빨개진다(speaker-tr 의 RA9b 포함).
- **고친 것**(테스트만): 새 픽스처 `tests/fixtures/sync-digest.mjs` 를 만들었다. `node:crypto` 의 동기 SHA-256 으로 **같은 값**(`s256:` 접두 그대로)을 돌려주되, 끝나는 시점을 마이크로태스크로 정한다(가짜 타이머와 같은 취지). `readalong.test.mjs`·`speaker-tr.test.mjs` 가 이 픽스처를 맨 먼저 import 한다. 제품 코드는 바꾸지 않았다 — 제품은 tick 수에 기대지 않는다.
- **확인**: 지연 preload 를 건 채로 72/72 통과. 병렬 부하 48번 중 실패 0. 전체 테스트 4개 동시 실행 12번 중 실패 0. 순차 10번 중 실패 0.

## 8b-4. M5 판정 — **설명은 대체로 맞다(실제로는 세 겹). 동등 변이이고, 죽은 코드는 아니다**

`tr-wait` 의 두 콜백(도착 알림·타이머)을 지키는 장치는 세 겹이다.
- (a) `cancelSynth()` 가 `clearTrWait()` 로 타이머와 구독을 푼다.
- (b) 세대 검사 `myGen !== gen`
- (c) 동일성 검사 `trWait !== w`

`gen++` 는 `cancelSynth` 한 곳에만 있고, 거기서 언제나 (a)가 함께 돈다. 따라서 (b)가 혼자서 막는 경로는 지금 코드에 없다.

| 변이 | 빨강 |
|---|---|
| M5 (b)만 뺌 | 0 |
| M5b (b)+(c) 뺌 — (a)만 남음 | 0 |
| M5d (a)만 뺌 — (b)가 막는다 | 0 |
| M5c (b)+(a) 뺌 | **1 (RA7f2)** |

- Build 의 "두 겹"이라는 설명은 (c)를 빠뜨렸다. 결론(한 겹만 빼면 살아남는다, 함께 빼면 빨개진다)은 맞다.
- **의견**: (b)를 남긴다. spec 6-2 가 "두 타이머 모두 gen 을 들고 있다"고 정했고, 모듈 규칙(모든 콜백이 gen 을 든다)과도 같다. M5d 에서 보듯 (a)가 나중에 깨질 때 실제로 막는 예비 장치이고, 비용은 0이다. 지금 코드에서는 동등 변이로 기록한다.

## 8b-5. 음성 판정

- **운영자 폰 상황 스텁(새 RV1)**: 첫 `getVoices()` 0개인 상태에서 재생을 누르고, 9ms 뒤 92개가 온다(영어 5·ko·fr 2·아랍어 0). 결과:
  - 그 사이에도, 이후에도(안정 시간 × 2 지난 뒤까지) `NO_VOICE`·`TR_VOICE_FAILED`·`no-voice` 알림 **0**.
  - 목록 전 원문은 voice 없이 `en-US` 로, 목록이 온 뒤에는 영어 voice 로 읽는다.
  - 아랍어는 `lang='ar-SA'`·voice 없이 **speak 를 유지한다**.
  - 판정 기록에 "없음" 0, 마지막은 `yes/unlisted`.
- **RV2**: 같은 폰에서 첫 번역문 발화가 오류로 끝나면 그때만 show 로 내리고 알림 1. 원문 "음성 없음"은 0이고 원문은 계속 읽는다.
- **설정 화면 세 갈래(브라우저)**: `getVoices` 를 스텁으로 바꿔 0 → 92(아랍어 0)를 흘렸다.
  - 목록에 없으면 `unlisted` + [들어 보기] 보임.
  - 시험 실패를 기억하면 `no` + [들어 보기]·설치 안내.
  - 시험 성공을 기억하면 `yes`.
  - 대상 언어를 ko 로 바꾸면 `yes`. ar 로 돌아오면 다시 `unlisted`.
  - 배너 0. 스텁을 거두고 실제 목록 7개로 되돌렸다.
  - 한계: 미리보기 세션의 감시자는 이미 "안정" 상태였다. 그래서 세션 중간에 목록이 바뀐 경우만 볼 수 있었다. 첫 부팅 경로는 RV1·VW1 이 고정한다.
- **새 발견(기록만)**: 이 데스크톱 Chrome(음성 7개, 아랍어 없음)에서 165자 아랍어를 `lang='ar-SA'`·voice 없이 말하게 했다. **onstart 118ms → onend 1,244ms, 오류 없이 끝났다** — 들릴 만한 발화 길이가 아니다(같은 길이 영어는 7초 넘게 걸림). 그 결과:
  - (1) 8b-1 보고서의 "데스크톱에서도 [들어 보기]가 끝까지 가서 있음"은 **거짓 양성**일 가능성이 크다.
  - (2) 이런 엔진에서는 speak 모드가 번역문 자리에서 약 1초 동안 소리 없이 지나가는데, `TR_VOICE_FAILED` 는 영영 나지 않는다.
  - 운영자 폰에서는 귀로 들었으니 안드로이드 문제는 아니다. 다만 기기에 따라 "끝까지 감 ≠ 들림"이다.
  - 제안(결정 필요): [들어 보기]는 끝난 뒤 "들렸나요? [예]/[아니요]"를 묻는다. 또는 발화가 예상 시간(`글자 ÷ CHARS_PER_SEC_TR`)의 일정 비율보다 짧게 끝나면 "소리 없음"으로 센다.
- **`ui/quiz.js`(범위 밖, 고치지 않음)**: 아직 옛 `loadVoices`(첫 응답 또는 1.5초 빈 목록이 최종)를 쓴다.
  - 퀴즈에는 "음성 없음" 배너 경로가 없다. 그래서 **오경고는 남지 않는다**.
  - 남는 것은 목록이 1.5초보다 늦게 오면 사용자가 고른 영어 음성(`tts.voice.en`)을 놓치고 엔진 기본 `en-US` 로 읽는 것뿐이다.
  - 또 퀴즈는 `'en'` 을 박아 두었다(7c 원문 언어를 따르지 않음).
  - 다음 단계에서 `sharedVoiceWatch` 로 옮길 것을 권한다.
- **남은 오경고 경로(낮음)**: 원문 `NO_VOICE` 는 오류 코드가 음성 계열이거나 "이 세션에서 원문 발화가 한 번도 끝까지 간 적 없음"일 때 난다. 그래서 첫 문장이 `audio-busy` 같은 일시 오류로 재시도까지 실패하면 "영어 음성 없음" 배너가 뜰 수 있다.

## 8b-6. 비용 보장 — 실제 책 흐름 (`r8b/measure-review.mjs`, Build 스크립트와 따로 작성)

- 측정 방법: 테스트 쪽이 실제 문장 흐름에 따로 전역 번호를 매겼다. 요청이 나갈 때마다 그때의 커서로부터 **거리를 따로 계산**해 서비스 기록(`dist`)과 대조했다. `loadParas` 를 부를 때마다 그 쪽 첫 문장의 거리도 쟀다.
- 번역은 스텁이다. 즉시 응답하거나, 문장 3개가 지난 뒤 응답한다.

| 구간 | 응답 | 문장 | 글자 | 호출(head) | 1만 자당 | 청크 중앙/최대 | 도착 시 번역 없음 | 최대 떠 있음 | 최대 dist | 창 위반·불일치 | 창 밖 쪽 불러옴 |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| CMDT 2021 1000–1049 | 즉시 | 846 | 107,675 | 20 (1) | 1.86 | 5,896 / 5,981 | 0 | 2 | 8,898 | 0 | 0 |
| CMDT 2026 500–529 | 즉시 | 1,613 | 151,376 | 27 (1) | 1.78 | 5,930 / 5,992 | 0 | 2 | 8,998 | 0 | 0 |
| CMDT 2021 1000–1049 | 3문장 뒤 | 〃 | 〃 | 20 (1) | 1.86 | 〃 | 2(냉시작 2·3번째 문장) | 2 | 8,898 | 0 | 0 |
| CMDT 2026 500–529 | 3문장 뒤 | 〃 | 〃 | 27 (1) | 1.78 | 〃 | 2(냉시작) | 2 | 8,998 | 0 | 0 |

- Build 의 수치(20·27회, 1.86·1.78)와 같다.
- **막힘·재시도(실제 책)**: 2021 의 1010쪽, 2026 의 505쪽에서 `exhausted` 로 바꿨다. 그 뒤 10쪽 동안 요청 **0**, 원격 이벤트는 `exhausted,ready` 두 번뿐이다. 10쪽 뒤 `retry()` 를 부르면 `state=ready` 로 즉시 풀리고, 창 안에서만 head + 청크 2건이 나간다. 창 위반 0.
  - 처음 돌렸을 때 "dist 불일치 45"가 나왔다. 원인은 내 스크립트가 재시도 직후의 요청을 커서를 옮긴 **뒤에** 대조한 것이었다. 고쳐서 다시 재니 0이다. 제품 결함 아님.
- **브라우저**: 429 스텁에서 냉시작 head·청크 2건이 모두 429 를 받았다(429 는 한도를 쓰지 않는다). 그 뒤 쪽 3번 넘김 + 뒤로 1번 동안 요청 0, 배너 `ai.state.exhausted` 1개, 띠 `blocked` + [다시 시도], 원문 낭독은 계속됐다. [다시 시도]를 누르자 **55ms 안**(첫 폴링)에 `remote=ready`, 배너가 거둬지고, 2건이 다시 나가 띠가 `ready` 가 됐다.

## 8b-7. 회귀·위생

- 설정 AI 탭(360px): 위임 동작 9종(key-*·verify·test·cache-clear·target-lang·voice-test), 드롭다운 2개(aiProvider·aiModel), 가로 스크롤 0. [시험 번역]은 두 블록(ar bdi 2·ko bdi 0).
- 리더: 영어 낭독·하이라이트·자동 스크롤·쪽 넘김·원본 뷰 전환이 정상이다. 퀴즈 진입은 가짜 문서라 버튼이 숨김(정상)이다. 퀴즈 node 테스트는 통과.
- 키 누출 0: DOM·localStorage·디버그 훅·요청 URL(`key=` 0). 키는 의도대로 sessionStorage 에만 있었고 `clearKey` 뒤 0이다.
- `innerHTML`·`insertAdjacentHTML` 0(새 파일·추가된 줄). 추가된 CSS 의 물리 방향 속성 0. 새 파일 `console` 0, `onclick` 0. `splitSentences` 호출은 `tts/text.js` 한 곳.
- 콘솔 오류 **0**.

## 8b-8. 화면 실측 — 프레임 조건

- **미리보기 창은 이번에도 숨김**이었다(`document.hidden=true`, rAF 정지). 창을 보이게 하는 도구가 없어 실제 프레임으로는 재지 못했다.
  - 원본 뷰는 페이지 안에서 rAF → `setTimeout(16ms)` 대체를 넣고 쟀다.
  - 부드러운 스크롤은 진행되지 않는다. 그래서 B4·B7 은 `matchMedia` 를 reduced-motion 참으로 바꿔 즉시 경로로 쟀다. 부드러운 경로는 실기기 확인 목록으로 넘긴다.
  - 기기 모드 360×800 은 361×801 로 잡혔다.
  - 끝난 뒤 rAF·matchMedia·fetch 를 원래대로 되돌렸다.
- **가로 800×360 + 배너(이번 발견)**: 이 환경에서는 `reader.tts.wakeLock` 배너(73px)가 떠 있었다. 그 상태에서:
  - 원본 스크롤 상자 높이 **0px**, canvas 가 보이지 않음.
  - 원본 확대 막대(133.9~181.9)가 띠(143.4~222.8)에 **덮인다**. y=150 의 요소는 띠 → 확대 버튼 순서다.
  - 배너를 닫으면 상자 30.4px, canvas 아래변 = 띠 윗변(143.42).
  - 실기기에서는 429·음성·lagging 배너가 바로 이 기능 때문에 뜬다. 그래서 가로에서는 흔한 상황이 된다.
- **가로 의견**(구현하지 않음): 띠를 자동으로 줄이거나 접는 것이 **필요하다**.
  - 세로 본문은 360 − 49 − 138 − 79 = 94px 이고, 배너 하나면 0px 이하다. 띠 2줄 고정으로는 원본 뷰를 쓸 수 없다.
  - 안: (가) 본문 영역이 일정 높이(예: 160px) 밑이면 띠를 1줄(`--tr-lines:1`, 약 45px)로 줄인다. 넘치면 띠 안 스크롤. (나) 원본 뷰에서는 띠를 접은 "번역 보기" 손잡이로 두고, 누르면 펼친다. (다) 가로에서는 하단 컨트롤 바를 한 줄로 합친다.
  - 토큰 하나(`--tr-lines` 를 미디어 질의·높이 조건으로)로 시작할 수 있다. spec 7-7 표의 "800×360 −46%" 줄에 "배너가 있으면 0"을 더해 결정할 것.
- **B4 40px**: 360px 폭에서 글자 40px 이면 한 줄이 약 10자다. 의학 문장(130~240자)은 600~1,200px 높이가 되어 본문 영역 471px 를 넘는다. 이 경우 "끝 ≤ 띠 윗변 − 4"는 지킬 수 없다. 코드는 시작을 영역 맨 위에 두므로 옳게 물러선다. 22px 에서는 위반 0. spec B4 에 "문장이 본문 영역보다 길면 시작이 영역 맨 위"라는 예외를 더할 것을 제안한다(spec 은 고치지 않음). Build 의 "40px 0/20"은 짧은 문장으로 잰 결과로 보인다.
- 편안 영역의 윗변: 세로 360×800 에서도 배너가 위에 쌓이면 상단바가 132px 까지 내려온다. B4 의 "윗변 ≥ `--bar-top`(49)" 잣대는 배너 높이를 모른다. 10b 부터 있던 구조이고 이번 위반은 아니다. 기록만.

## 8b-9. 변이 (`r8b/mutate.py` — 찾을 문자열 개수 확인 → 전체 테스트 → 스크래치패드 복사본으로 복원 → `cmp`)

| 변이 | 출처 | 빨강 | 빨개진 테스트 |
|---|---|---:|---|
| 창 경계(`dist >= readAhead` 2곳) 빼기 | 8b-1 M1 재현 | 1 | RA3 |
| `prev` 거르기 빼기 | 8b-1 M3 재현 | 2 | RA4b·RA5 |
| 괄호 라틴 제거 빼기 | 8b-1 M4 재현 | 3 | TX·TX2·**RV1** |
| 띠 높이를 예산 합산에서 빼기 | 8b-2 M1 재현 | 2 | BUD2·BUD3 |
| bidi 격리 빼기 | 8b-2 M2 재현 | 1 | BD1 |
| M5·M5b·M5c·M5d | 8b-1 M5 재현 + 새것 | 0·0·1·0 | 8b-4 |
| N1 막힌 상태에서도 보내기 | 새것 | 파일 1 | `readalong.test.mjs` 가 **멈춤**(마이크로태스크 무한 반복 — refill 의 `again` 고리). 자식 프로세스를 끝내 빨강으로 셈. 변이에서만 생기는 고리이고, 원본은 막힌 분기가 `return` 해 고리가 없다 |
| N2 speakSource=false 무시 | 새것 | 2 | RA10·RA10b |
| N3 번역문 분할 경계 주입 빼기 | 새것 | 1 | RA11 |
| N4 LTR 블록을 innerHTML 로 | 새것 | 3 | B5·BD2·BD3 |
| N5 [다시 시도] 대상에서 exhausted 빼기 | 새것 | 1 | TB2 |

모든 변이에서 찾을 문자열 개수가 맞았다. 복원 뒤 바뀐 6개 파일이 실행 전 복사본과 `cmp` 로 같음을 확인했다. `git checkout`·`restore`·`stash` 는 쓰지 않았다.

## 8b-10. 고친 것 / 기록만 한 것

**고친 것**(테스트만)
1. `tests/fixtures/sync-digest.mjs`(새 파일) + `readalong.test.mjs`·`speaker-tr.test.mjs` 맨 앞 import — 간헐 실패 원인(8b-3).
2. `tests/speaker-tr.test.mjs` 에 **RV1·RV2** 를 더했다 — 운영자 폰 상황을 감시자 → controls 배선 → speaker·readalong 으로 한 줄에 이었다(8b-5).

**기록만**
1. 가로 800×360 + 배너 → 원본 상자 0px·확대 막대 덮임(8b-8). 띠를 줄이거나 접는 결정이 필요하다.
2. 기기에 따라 voice 없는 발화가 **오류 없이 무음으로 끝난다**(데스크톱 1.2초). [들어 보기]의 "있음"과 `TR_VOICE_FAILED` 판정이 믿을 수 없다(8b-5). 사용자 확인 또는 길이 판정 제안.
3. B4 의 40px 예외(spec 문구). B4 윗변 잣대가 위쪽 배너를 모른다(10b 부터).
4. `ui/quiz.js` 의 옛 `loadVoices`·`'en'` 고정(범위 밖). 첫 원문 발화의 일시 오류가 "음성 없음" 배너로 갈 수 있는 경로(낮음).
5. M5 는 동등 변이다. 세대 검사는 남긴다(8b-4).
6. 냉시작 head·청크가 동시에 나가서 429 때 요청이 2건 찍힌다(한도 소모 없음, 사용량 `blocked429` 2).
7. 정리: 가짜 문서 하나(documents·pages·blobs `deleteDocument`), aiCache 86+ 행, 오늘 usage 행(이번 스텁 호출 13건뿐) 지움. 가짜 키 `clearKey`(hasKey false). `medreader.voiceTest.*` 지움. 설정(`ai.translationLang=ar`·`readalong.mode=speak`·`reader.view=reflow`·`tts.unit=sentence`·`tts.rate=1`)은 원래 값 그대로. `--reader-fs` 22px 복원. 뷰포트 desktop. Bash 차단 훅에 막힌 명령 없음. npm 설치 없음.
8. 리포 안 `apps/medreader/NVIDIA Corporation/`·`dev/NVIDIA Corporation/`(9-28 생성, 빈 `umdlogs`) — GPU 드라이버가 남긴 빈 폴더로 보인다. git 에 잡히지 않는다. 범위 밖.

## 8b-11. 운영자 실기기 확인 목록

1. **번역문이 실제로 들리는지 귀로**(Fold 7·Nour 기기) — [들어 보기]가 "있음"이라고 할 때 정말 아랍어가 들렸는지. 번역문 단계가 문장 길이만큼 걸리는지(1초 만에 넘어가면 무음 통과, 8b-5).
2. 가로(펼침·가로 화면)에서 배너가 떠 있을 때 원본 뷰를 쓸 수 있는지(8b-8). 띠 크기 결정의 근거로.
3. speak 20문장 연속: `[원문 → 번역문]` 순서, 멈춤·중복 0. 번역문 동안 하이라이트가 원문에 머무는지. tr 중 일시정지 → 재개 10회.
4. 띠의 부드러운 경과 스크롤과 "만지면 멈춤"(숨김 창에서는 볼 수 없었다). `CHARS_PER_SEC_TR`(10, 가정)이 맞는지 — 띠 끝에 닿기 전에 다음 문장으로 넘어가지 않는지.
5. 실제 429(또는 로컬 오버라이드)에서 쪽을 3번 넘기는 동안 배너 1번·요청 0건, [다시 시도]가 즉시 풀리는지.
6. 앱을 막 연 직후 "영어 음성 없음"이 다시 뜨지 않는지(부팅 직후 목록 지연은 아직 미측정 — `dev/voices.html` 에 "로드 직후 첫 응답 ms" 항목을 더하면 확정된다).

---

# 공개 전 묶음 Review — P1(저장 경합·원본 해상도·키 가리기) + P2(CMDT 러닝 헤드) (2026-10-10)

> Review 서브에이전트. 두 Build 와 따로 다시 쟀다. Build 보고서는 비교 대상으로만 썼다.
> 커밋 없음 · 실제 키 0(가짜 키는 실행 중에 이어 붙여 만듦) · `git checkout/restore/stash` 0 · `rm -rf` 0 · npm 설치 0.
> 측정 스크립트는 스크래치패드 `rvpre/` 에만 있다(`census.mjs`·`census-mix.mjs`·`quizdiff.mjs`·`sec.mjs`·`mutate.py`). 원서 문장은 옮기지 않았다(아래 조각은 30자 이하 진단용).
> 기준(algoVersion 9)은 `git archive HEAD apps/medreader/js` 를 스크래치패드 새 폴더 `rvpre/base/` 에 풀어 썼다.

## PR-1. 결론 — **조건부 통과(Nour 공개 가능, 단 배포 절차 조건)**

- **P2 본문 손실: 산문 본문이 낭독에서 빠진 줄은 0 이다.** 세 책 **전수**(7,747쪽·39만 줄)에서 역할이 바뀐 줄을 하나씩 셌다(PR-2). 낭독에서 빠진 줄은 전부 머리말(띠 안)이거나 쪽 맨 위 표의 머리·첫 행이었다.
- **퀴즈 회귀 없음.** Harrison 문항 단위로 비교했다. 잃은 정답 0, 바뀐 정답 0, 보기 수 바뀐 문항 0, 새로 이은 정답 4(PR-3).
- **재추출과 경합 OK.** algoVersion 9 로 내려 둔 문서를 열면 다시 추출된다. 그동안 읽기·낭독이 되고, 지연을 넣은 채 언어를 바꾸고 쪽을 넘겨도 사용자 선택·마지막 쪽이 덮이지 않았다(PR-4).
- **P1 보안·해상도 OK**(PR-5). `main.js` boot 실패 로그까지 키가 갈 길은 찾지 못했다. 그래서 고치지 않았다.
- **조건 — 배포 반쪽 상태**(PR-6). 옛·새 모듈이 섞이면 두 가지 일이 생긴다. 하나는 **아무 안내 없는 빈 화면**이다. 다른 하나는 더 나쁜데, **오류 없이 섞인 규칙으로 재추출한 결과가 algoVersion 10 으로 굳는 것**이다. 운영자 절차로 피해야 한다(PR-10).
- 테스트 930/930. 순차 4회와 4개 동시 실행 2라운드(8회)에서 실패 0이었다. 변이는 10종(재현 5 + 새것 5)이고 전부 빨강이었다.

## PR-2. P2 본문 손실 — 역할이 바뀐 줄 전수 (`rvpre/census.mjs`, Build 의 probe 와 따로 작성)

**방법**: 쪽마다 기준(HEAD)과 현재 코드로 레이아웃을 만들었다. 이웃은 앱처럼 앞뒤 1쪽 저장본(`toStored`)을 썼다. 줄마다 "효과 역할"을 정했다. 줄이 문단에 들어 있으면 그 문단의 kind 다(낭독함). 문단 밖이면 `line.role` 이다(낭독 안 함). 줄 id 와 글자는 두 판에서 **전부 일치**했다(불일치 0, `lines.js` 는 바뀌지 않음).

| 책 (전수) | 쪽 / 줄 | 낭독 → 낭독 안 함 | 낭독 안 함 → 낭독 | heading → body |
|---|---|---|---|---|
| CMDT 2026 | 1,967 / 190,226 | **2,516줄 · 1,918쪽** (→header 2,481, →table 35) | 151 (header→body 117·heading 33·list 1) | 182 |
| Harrison | 729 / 49,679 | **6줄 · 2쪽** (→table 6) | 22 | 6 |
| CMDT 2021 | 5,051 / 153,648 | **0** | 0 | 0 |

**CMDT 2026 →header 2,481줄 분해** — 본문은 없었다.
- 1,900줄: 줄 안에 책 이름 표지(`CMDT`)가 있다. 쪽 머리말 그 자체다.
- 546줄: 같은 쪽에 표지 줄이 있고, **같은 띠**에 있는 줄이다(쪽 위에서 0.6% 이내, 최대 55자). 홀수 쪽 머리말이 "장 제목 | 책 이름 쪽번호"로 쪼개진 장 제목 조각이다. 표본: `GASTROINTESTINAL DISORDERS`, `CHapter 7`, `CONTENTS`.
- 35줄: 앞부분 20·22–38쪽이다. 34줄은 쪽마다 되풀이되는 3열 표의 열 제목(`Topic` / `Page Number…`)이다(P2 보고 §4 와 같다). 1줄은 20쪽 약어 목록의 제목(`COMMONLY USED ACRONYMS…`)이다. 이 한 줄은 **목록 제목이 낭독에서 빠지는 것**이다. 앞붙이라 영향은 작다. 기록만 한다.

**→table 35줄(CMDT 23쪽)·6줄(Harrison 243–244쪽)**
- 모두 쪽 맨 위(위에서 7–13%)에 있는 **표의 열 제목이나 첫 행**이다. 표본: `Common Indications Comments`, `Dabigatran Rivaroxaban`, `Regimen Indication`, `Category Antibacterial Drug…`, 용량 행 `600 mg orally twice daily…`.
- 예전에는 머리말(또는 잘못 머리말로 빠진 표 제목)이 표 영역 위쪽을 끊었다. 그래서 이 줄들이 본문으로 낭독됐다. 이제 표 영역에 들어가 표 안내로 읽힌다.
- 오케스트레이터가 본 208쪽(표 7-2)과 같은 현상이다. **"Harrison 손실 0"은 문장 단위(3쪽 간격) 측정이라 243–244쪽을 지나쳤다.** 줄 단위로는 표 행 6줄이 옮겨 갔다. 산문 손실은 0 이다.

**heading → body 182줄(Build 주장 확인)**: 20개를 고르게 뽑아 봤다. 그림 설명(`▲ Figure 6–15…`), 참고문헌(`Kılınç F et al…`), 표 칸 제목(`Adult Dose Comments`, `Notes`, `Indication`)이다. Build 의 설명이 맞다. 낭독은 그대로 하고 제목 억양만 바뀐다. 손실이 아니다.

**`option→header`·`question→header`·`answer→header` 전이: 세 책 모두 0.**

## PR-3. 퀴즈 회귀 (`dev/compare-quiz.mjs` 재실행 + 문항 단위 비교 `rvpre/quizdiff.mjs`)

| | 섹션 | 문항 | 정답 연결 | verified | unverified | 문단 kind q/o/a |
|---|---|---|---|---|---|---|
| Harrison 9 → 10 | 14 → 14 | 1233 → 1233 | 1186 → **1190** | 1181 → **1185** | 52 → 48 | 1389/6264/1157 → 같음 |
| CMDT 2026 9 → 10 | 10 → 13 | 12 → 15 | 0 → 0 | 0 → 0 | 12 → 15 | 2167/2478/0 → 같음 |

- **Harrison 문항 id 대조**(`docId:sec:qN` 으로 맞춤):
  - 사라진 문항 0, 새 문항 0.
  - **잃은 정답 0 · 바뀐 정답 0 · verified 를 잃은 문항 0 · 보기 수 바뀐 문항 0**.
  - 새로 이은 정답 4: `sec-V` q57–q60. 머리말로 빠지던 문항 라벨이 본문으로 돌아온 결과다.
  - Build 수치와 같다.
- CMDT 2026 은 verified 0 이라 퀴즈 칩이 뜨지 않는다. 바뀐 것은 후보 문항 2개가 사라지고 5개가 생긴 것뿐이다(정답 0). 영향 없다.

## PR-4. 재추출 + 경합 (미리보기 `blog`, 브라우저에서 만든 120쪽 가짜 PDF — 짝·홀이 다른 지어낸 머리말 + 지어낸 본문)

1. **첫 추출(algoVersion 10)**: 머리말 120/120쪽이 `header` 다. 짝수 쪽 `N … CHAPTER 1`, 홀수 쪽 `Test Chapter One … N` 이 쪽 번호 진행으로 잡혔다.
2. **algoVersion 9 로 내림**: 쪽 120개의 `algoVersion` 과 `extraction.algoVersion` 을 9 로 바꿨다. 사용자 필드는 `lang=fr/user`·`lastPage=7` 로 두었다. 그 뒤 새로고침했다(새 판을 처음 여는 상황).
3. **열기 → 재추출 경로가 돈다**:
   - 배너 "The text engine was updated, so this document is being prepared again."가 뜬다.
   - 진행 "Preparing text 22/120"이 보인다.
   - 끝나면 쪽 120개가 모두 algoVersion 10, `done` 이 된다.
4. **재추출 중 읽기·낭독**: 7쪽 본문(3,416자)이 바로 그려졌다(`article[lang]` = 사용자 언어). [▶] → `speechSynthesis.speaking=true`, "Line 1 of 41". 낭독 중에는 추출이 초당 약 1쪽으로 느려졌다(9-4 의도).
5. **경합(7c8-5 장치 — `documents` 읽기 전용 트랜잭션 완료를 3초 늦춤)**:
   - (a) 열기와 동시에(0.3초) 서재 카드 [⋯] → 한국어를 골랐다. 재추출의 `_saveMeta` patch 가 여러 번 이어졌다. **모든 documents put 이 `ko/user`·`lastPage 7` 을 들고 있었다**(되돌림 0).
   - (b) 낭독·재추출 중에 쪽 넘김 → 0.4초 뒤 English 를 골랐다. 이후 put 10건이 **전부 `en/user`** 였다. `lastPage` 는 화면에 그려진 쪽(8)과 같다.
   - (c) 끝난 뒤 DB 는 `en/user`·`lastPage 8`·algoVersion 10·done 이다.
   - 같은 조건에서 고치기 전 코드는 7c8-5 에서 2/2 덮였다.
6. **새로 본 결함(기존 결함, 이번 묶음이 만든 것 아님 — 기록만)**:
   - 앱을 막 켠 직후 첫 `showReader` 가 아직 `state.docId` 를 정하기 전에 [다음 쪽]을 누르면 `#/reader/null/2` 로 간다. 그 뒤 서재로 튕긴다(지연 주입에서 2/2 재현).
   - 원인은 `reader.js goPage` 가 `state.docId` 를 확인하지 않는 것이다. 보통은 첫 읽기가 ms 단위라 거의 안 걸린다.
   - 고칠 곳은 `goPage` 첫 줄에 `if (!state.docId) return;` 을 넣는 것이다. 이번 범위(P1 은 `saveLastPage` 만)를 넘어 고치지 않았다.

## PR-5. P1 경합 · 보안 · 해상도

**경합 — Build 필드 표를 코드와 대조**: 다섯 곳 + 7c 언어 모두 `db.patch` 를 쓴다. 각자 자기 필드만 쓴다.

| 곳 | 쓰는 필드 |
|---|---|
| `_saveMeta` | `extraction` |
| `writeLastPage` | `lastPage`·`lastLineId` |
| `saveSectionIndex` | `sectionIndex` |
| `markSectionIndexDone` | `sectionIndexDone`·`sectionIndexVersion` |
| `touchOnOpen` | `pageCount`·`lastOpenedAt` |
| `touchDuplicate` | 같음(`pageCount` 는 비었을 때만) |
| `updateDocLang` | `LANG_FIELDS` 3개 |

- `documents` 통째 쓰기는 두 곳만 남았다. 새 문서와 `touchDuplicate` 되살리기다.
- `ai/readalong.js` 의 `readStats` 는 이번 범위 밖이다. 그래도 이미 한 트랜잭션 읽고-쓰기라 안전하다(도우미로 통일만 안 됨).
- DP1~DP13 은 12회 실행에서 모두 초록이다.

기록만:
- ① `touchDuplicate` 의 "그사이 지워진 레코드 되살리기"는 Blob 없이 documents 만 다시 만든다. 그 뒤 열면 `openDoc` 이 `null` 을 돌려준다. 예전 코드와 같고, 드물다.
- ② `attach` 가 옛 추출기를 `stop()` 할 때 그 마지막 `_saveMeta` 를 기다리지 않는다. 그래서 옛 인스턴스의 `extraction` 이 새것 뒤에 한 번 쓰일 수 있다. 같은 필드 주인끼리라 다음 저장에서 바로잡히고, 사용자 필드와는 무관하다.

**보안 — 가짜 키(실행 중 조립, `rvpre/sec.mjs`)**

몸통에 `.`·`~`·`+`·`/`·`=`·`.~+/=`·`\`·`%`·`!` 가 든 신형 키 9종으로 쟀다.
- 형식 검사는 9/9 `OK`(경고 없음)다.
- **저장된 키 없이 패턴만으로** 문장·JSON·HTML·URL 쿼리·괄호·따옴표 안 6가지 문맥에서 조각 0이다.
- `ProviderError.message` 의 조각도 0이다.
- `"AQ.1 level is fine; AQ.short"` 는 그대로 남는다.
- 패턴이 못 잡는 모양(몸통에 `"`)은 패턴만 쓰면 남는다. 저장된 키 공급자가 있으면 `redactString`·`ProviderError` 모두 0이다(설계대로).

브라우저:
- 점·물결이 든 가짜 키는 경고가 없다.
- U+200B 가 든 키는 경고 + "length 31 · unusual characters: U+200B×1"(`bdi` 1)이 뜬다.
- `sk-` 모양은 "unfamiliar beginning"이 뜬다.
- DOM·localStorage·usage·요청 URL 의 키 조각은 0이다. 키는 `x-goog-api-key` 헤더에만 있다.

**`main.js:289` boot 실패 로그 — 키가 갈 길이 없다고 판단해 고치지 않았다.**
- `boot()` 는 원문 키를 읽지 않는다(설정 load·i18n·화면 init·라우터뿐이다). init 은 원문 키를 꺼내지 않는다(설정 화면은 `showSettings` 때 읽는다).
- 이 경로의 모듈에는 값을 메시지에 넣어 던지는 곳이 없다(`throw` 는 db.js 의 `DbError(code, cause)` 뿐이다).
- 키는 저장소에 문자열 그대로 있어 `JSON.parse` 오류 메시지에 실릴 일도 없다.
- js 전체 `console.*` 는 이 줄과 i18n 누락 경고 둘뿐이다.
- 덧붙여, 배포 반쪽 상태의 모듈 연결 오류는 `boot().catch` 에 오지 않는다(PR-6). 방어 삼아 `redact` 로 감싸려면 import 줄이 하나 더 필요하다. 지침의 "그 줄만"을 넘으므로 하지 않았다.

**해상도(브라우저, dpr 3 덮어씀, 375×812)**

| 상태 | 결과 |
|---|---|
| 폭 맞춤 68%(하한) | 1053×1464 / CSS 351 = **3.000** |
| 300% | 2454×3417 = **8,385,318px ≤ 8,388,608**, 비율 **1.582** |

- 띠를 켜고 낭독할 때 원본 스크롤 상자 아래변은 554.09, 띠 윗변은 554.09다. **B3 유지.**
- 가로 스크롤은 0이다.
- 표 크롭은 CB7–CB9 로 확인했다.

## PR-6. 배포 반쪽 상태 — 화면과 의견

**재현**: 같은 출처 iframe 에 importmap 을 걸었다. `redact.js` 만 `setSecretSource` export 가 없는 판(=옛 판)으로 바꾸고 나머지는 새 판을 썼다.
- 결과는 **배경색(rgb 253,252,250)만 있는 빈 화면**이다. 글자 0, 버튼 0, 배너 0. 콘솔에만 `SyntaxError … does not provide an export named 'setSecretSource'` 가 남는다.
- 모든 화면이 `hidden` 이고 문구는 JS 가 채운다. 그래서 모듈 연결이 실패하면 아무것도 보이지 않는다. `boot().catch` 의 배너도 돌지 않는다(평가 전에 실패).
- **사용자는 "새로고침하면 된다"는 것을 화면에서 알 수 없다.**

**같은 종류의 다른 조합**(이번 판에 해당):

| 섞인 조합 | 결과 | 보이는가 |
|---|---|---|
| 새 `provider.js` + 옛 `redact.js` | 연결 오류 → 빈 화면 | 빈 화면 |
| 새 `library/reader/quiz/extract.js` + 옛 `db.js`(`patch` 없음) | 연결 오류 → 빈 화면 | 빈 화면 |
| 새 `render.js` + 옛 `config.js`(`MAX_CANVAS_*` 없음) | `canvasRatio` = NaN → 캔버스 0px(Node 확인) | **원본 뷰만 조용히 빔** |
| 새 `layout.js`(algoVersion 10) + 옛 `blocks.js` | 오류 없음. 옛 규칙 + 새 상한 1.6 으로 판정한 쪽이 **algoVersion 10 으로 저장** — CMDT 3쪽 간격 656쪽에서 머리말 판정이 두 판 어느 것과도 다르다(문항 보기 1줄이 header 로 빠짐 포함) | 안 보임 |
| 새 `layout.js`·`blocks.js` + 옛 `config.js` | 오류 없음. `HEADER_BAND_GAP_FACTOR` 가 없어 띠가 늘 없음 → **머리말 판정 0**(CMDT 머리말 다시 낭독)인 채로 **algoVersion 10 으로 저장** | 안 보임 |

마지막 두 줄이 가장 나쁘다. algoVersion 이 이미 10 이라 **다음 판 올림 전까지 다시 추출되지 않는다.** spec 9-4 의 설정 > 고급 [텍스트 다시 추출] 버튼은 **아직 구현되지 않았다**(index.html·settings.js 에 없음). 지금 복구 길은 문서를 지우고 다시 가져오는 것뿐이다. 그러면 원문 언어·마지막 쪽을 잃는다.

**의견(구현하지 않음)**
- (가) 운영 절차가 가장 싸고 확실하다(PR-10).
- (나) `index.html` 에 모듈이 아닌 작은 인라인 스크립트를 둔다. `window` 의 `error` 이벤트(모듈 연결 `SyntaxError` 는 여기로 온다)나 "N초 안에 `__medreader` 가 없음"을 감지하면 정적 문구 한 줄과 [새로고침] 버튼을 보인다. 문구는 네 언어를 하드코딩하거나 `navigator.language` 로 고른다.
- (다) 근본책은 판 번호다. 모든 상대 import 에 같은 쿼리(`?v=…`)를 붙이거나, `main.js` 하나만 판 번호로 부르고 나머지를 import map 으로 판 고정한다. 이러면 섞임 자체가 없다. 빌드 도구가 없는 구조라 손이 든다.
- (라) 재추출이 섞인 규칙으로 굳는 것은 `algoVersion` 과 함께 `blocks.js` 규칙 상수의 지문(예: `LAYOUT` 해시)을 저장하면 잡힌다. 4절·9절 결정이 필요하다.
- 참고: GitHub Pages 는 `Cache-Control: max-age=600` 이다. 브라우저 일반 새로고침은 하위 자원을 다시 확인하지 않는다(신선하면 캐시 그대로). 그래서 **섞인 상태는 새로고침으로 바로 풀리지 않는다. 캐시가 만료되는 최대 10분 뒤에야 풀린다.** P1 이 본 혼합은 개발 서버(python, Cache-Control 없음 → 파일 수정 시각에 따른 휴리스틱 캐시)에서 생긴 것이다. Pages 에서는 모든 모듈이 같은 방문에 받아져 함께 만료되므로 덜 생긴다. 다만 배포 직후 CDN 가장자리 전파 동안이나 만료 경계의 방문에서는 생길 수 있다.

## PR-7. 회귀

| 항목 | 결과 |
|---|---|
| 설정(375px) | [검증] "The key works." · [시험 번역] 두 블록 `ar/rtl`(bdi 1)·`ko/ltr` · 드롭다운 `aiProvider`·`aiModel` |
| 리더 | 낭독(speaking·"Line 1 of 41"), 띠 `pending` + [Try again](fetch 실패 스텁), 원본 뷰 전환·확대·되돌림(`reader.view=reflow` 복원) |
| 퀴즈 진입 | 가짜 문서라 버튼 숨김(정상). 퀴즈 node 테스트 통과, Harrison 파서 비교는 PR-3 |
| 360×740 가로 스크롤 | 서재·설정·리더 모두 `scrollWidth = innerWidth`(361). 리더에서 화면 밖 요소 3개는 원본 스크롤 상자 **안**의 캔버스(상자가 가로 스크롤을 맡음) |
| 콘솔 | MedReader 오류 **0**. 남은 줄은 앞서 연 다른 앱의 `[ds-level2]`, P1 세션의 옛 `SyntaxError`(내 반쪽 재현 2줄은 의도된 것) |
| 키 누출 | 0(PR-5) |

## PR-8. 테스트 · 변이

- `node --test "apps/medreader/tests/*.test.mjs"`: **930/930**. 순차 4회, 4개 동시 실행 2라운드(8회)로 모두 12회 실패 0이다.
- 변이(`rvpre/mutate.py` — 찾을 문자열 정확히 1곳 → `MUT_*` 표지 확인 → 전체 테스트 → 스크래치패드 복사본으로 복원 → `cmp`):

| 변이 | 출처 | 빨강 | 걸린 테스트 |
|---|---|---:|---|
| B1a `writeLastPage` 를 get→put 통째 쓰기로 | P1 재현 | 2 | DP6·DP12 |
| B1b `canvasRatio` 를 `min(2,dpr)` 고정으로 | P1 재현 | 7 | CB1·CB2·CB3·CB4·CB5·CB7·R3 |
| B1c `ProviderError` 의 `keys` 빼기 | P1 재현 | 1 | KS7 |
| B2a 머리말 띠 조건 제거 | P2 재현 | 2 | H3·H3b |
| B2b `HEADER_FONT_RATIO` 1.6 → 1.1 | P2 재현 | 3 | H1·H3·H7 |
| N1 `db.patch` 가 합치지 않고 덮어씀 | 새것 | 2 | DP3·DP10 |
| N2 신형 키 길이 하한 20 → 8 | 새것 | 3 | KS4·KS14·keyPattern(기존) |
| N3 `edgeNumbers` 의 앞 숫자 무시 | 새것 | 3 | H2·H2b·H8 |
| N4 색인 완료 표시에서 `sectionIndexVersion` 빼기 | 새것 | 1 | DP8 |
| N5 캔버스 한 변 상한(4096) 제거 | 새것 | 1 | CB5 |

전부 적용 확인과 복원 `cmp` 를 마쳤다. 끝난 뒤 `js/`·`tests/` 전체를 시작 때 복사본과 `diff -r` 해서 같음을 확인했다. `grep MUT_` 0건이다.

## PR-9. 고친 것 / 기록만

**고친 것: 없다.** 두 Build 파일 안에서 고쳐야 할 결함을 찾지 못했다. `main.js` 줄은 PR-5 의 근거로 손대지 않았다.

**기록만**
1. **배포 반쪽 상태**(PR-6): 빈 화면 + 섞인 규칙의 재추출이 algoVersion 10 으로 굳는다. 운영 절차(PR-10)와 의견 (나)~(라)를 결정할 것.
2. `reader.js goPage` 의 `state.docId` 확인이 없다 → 부팅 직후 [다음 쪽]이 `#/reader/null/N` → 서재로 간다(PR-4-6). 한 줄로 고칠 수 있다.
3. CMDT 2026 20쪽 약어 목록 제목 1줄이 header 로 빠진다(앞붙이). 22–38쪽 반복 열 제목 34줄도 접힌다(P2 보고와 같다).
4. **오케스트레이터 측정 보정**: "Harrison 손실 0"은 문장 단위 표본에서만 맞다. 줄 단위 전수에서는 243–244쪽 표 행 6줄이 table 로 옮겨 갔다(산문 아님, 표 안내로 읽힘). spec 4-7 header 행의 "세 책 모두 본문 손실 0"은 "산문 손실 0, 표 행 41줄이 표 영역으로"로 고치기를 권한다.
5. **spec 4-7 표 깨짐**: `[수정 2026-10-12]` header 행 끝에 옛 행의 꼬리 `` |CHAPTER|PART)\b/i` ] | 러닝 헤드 … 등 | `` 가 남아 있다. 표 칸이 하나 더 생기고 정규식 조각이 드러난다. 오케스트레이터 몫이라 spec 은 고치지 않았다.
6. PR-5 기록 ①②(되살린 레코드의 Blob 없음, 옛 추출기의 마지막 `_saveMeta`).
7. 미리보기 창은 숨김이었다. 원본 뷰 측정 동안 rAF 를 `setTimeout(16ms)` 로, `devicePixelRatio` 를 3 으로 덮었다가 새로고침으로 되돌렸다.
8. Bash 차단 훅에 막힌 명령은 없었다. 다만 백그라운드 작업이 도는 동안 짧은 `node -e` 분석 몇 개가 끝나지 않았다. 원인 미상이고 파일로 옮겨 다시 돌렸다. 스크래치패드 `rvpre/` 는 남아 있다.

**정리**: 가짜 문서(documents 1·blobs 1·pages 120 `deleteDocument`), 오늘 usage 행(스텁 호출 5건)·aiCache 비움. 가짜 키는 sessionStorage 에서 지움(local·session 0). IndexedDB 13개 스토어가 시작과 같다(settings 8행 값 동일, 나머지 0). fetch·IDB 감싸기·rAF·dpr 은 새로고침으로 해제했고, 뷰포트는 desktop 이다.

## PR-10. Nour 공개 전 운영자가 할 일

1. **커밋·푸시는 한 번에.** 이번 묶음의 21개 js/테스트 변경을 한 커밋으로 올려 배포가 한 번에 바뀌게 한다(나눠 올리면 배포 사이에 섞인 판이 생긴다).
2. **배포 뒤 최소 15분 기다린 뒤** Nour 에게 알린다. Pages 빌드 완료 + CDN 전파 + 브라우저 캐시 max-age 10분을 지나야 한다. 그 전에 운영자 기기에서 앱을 열어 콘솔 오류 0, 설정 > 정보 등에서 새 판 동작(키 진단 줄 등)을 확인한다.
3. **Nour 에게 안내**: "앱을 완전히 닫았다가 다시 여세요. 빈 화면이면 몇 분 뒤 다시 여세요." 빈 화면이 나오면 **책을 열기 전에** 다시 열게 한다(섞인 판에서 책을 열면 재추출이 섞인 규칙으로 굳을 수 있다 — PR-6).
4. **재추출 안내**: Nour 의 CMDT 2026(약 1,967쪽)은 처음 열 때 "텍스트 엔진이 갱신되어 다시 준비합니다" 배너와 함께 전체를 다시 추출한다. 읽기·낭독은 그동안에도 된다. 다만 낭독 중에는 초당 1쪽이라 오래 걸린다. 와이파이·충전 중에 앱을 열어 두면 빨리 끝난다고 알린다. 원문 언어·마지막 쪽은 유지된다(PR-4).
5. 혹시 머리말이 다시 낭독되면 섞인 판으로 굳은 것이다. 지금은 [텍스트 다시 추출] 버튼이 없다. 그래서 복구하려면 문서를 지우고 다시 가져와야 한다(원문 언어·마지막 쪽을 다시 골라야 한다). 3번 절차로 애초에 피하는 것이 중요하다.
6. 실기기 확인: 원본 보기 31쪽 66% 가는 글자(12-5 `[M]`), 300% 에서 빈 화면 없음, Nour 키 경고가 사라졌는지 — 남아 있으면 진단 한 줄("길이 n · 글자 종류")만 받는다.
7. 결정 대기: PR-6 의견 (나)(빈 화면 안내 한 줄)는 작고 독립적이다. 다음 배포 전에 넣기를 권한다. 9-4 의 [텍스트 다시 추출] 버튼(복구 경로)도 함께 정할 것.
8. 참고(기존): `i18n/ko.js`·`fr.js` 의 `err.reextract` 가 영어 문장 그대로다. 한국어·프랑스어 UI 에서 재추출 배너가 영어로 뜬다. Nour(아랍어 UI)는 ar.js 를 쓰므로 해당하지 않는다. 다음 단계에서 확인할 것.

---

# 배포 안전장치 Review — import map · 부팅 실패 안내 · [텍스트 다시 추출] (2026-10-10)

> Review 서브에이전트(Build 와 분리). **커밋 없음** · `spec.md` 손대지 않음 · `.claude/launch.json` 손대지 않음 · npm 설치 0 · `git checkout/restore/stash` 0 · `rm -rf` 0. Bash 차단 훅에 막힌 명령은 없었다.
> Build 보고는 검증 대상으로만 읽고 숫자는 모두 다시 쟀다. 측정 도구는 스크래치패드 `rvds/`(`state.sh` 혼합 상태 깔기 · `crlf.mjs` · `mutate.py`)에만 있다. 옛 판은 `git show f26af46~1:…` 로 스크래치패드에 꺼냈다.

## DS-1. 결론 — **통과(첫 푸시 절차 조건)**

- **import map 이 앱 모듈 요청 전부를 덮는다.** 부팅 때 앱 자원 54개(CSS 4 + 모듈 50) 모두 `?v=<10자>` 다. 쿼리 없는 `/apps/medreader/js/`·`css/` 요청은 **0**이다(문서 URL 이 `index.html` 이든 디렉터리 `/apps/medreader/` 든 같다). 앱 내부 동적 `import()` 는 없고(pdf.js CDN 하나), 워커도 없다(pdf.js 워커는 CDN 판 고정). 앱이 `fetch` 하는 자기 파일도, CSS `url()` 도 없다.
- **혼합 상태 (1)(2)(3)을 독립 각본으로 재현했다**(DS-3). 같은 index.html 아래에서는 옛·새가 섞이는 길이 "옛 표의 URL 중 일부만 브라우저 캐시에 없음" 하나뿐이다. 그때 연결 오류가 나면 **빈 화면이 아니라 네 언어 안내**가 뜬다.
- **최악(섞인 규칙의 재추출이 굳음)은 이론상 남는다.** 그러나 겹쳐야 할 조건이 셋이라 아주 드물다. 이제는 [텍스트 다시 추출]로 복구된다(DS-4). 막는 장치(판 대조)는 다음 단계로 권한다. 푸시를 막을 일은 아니다.
- **고친 것 4건**(DS-10): RX4 간헐 실패(동시 실행 1/4 빨강) · 생성기 CRLF 보존 · 감시가 멀쩡한 부팅을 안내로 덮어 두던 오탐 · 테스트 구멍 둘(늦게 세운 부팅 완료 표시, 템플릿 문자열 동적 import).
- 테스트 **951/951**(950 + IM7b). 순차 3회와 4개 동시 실행 2라운드에서 실패 0이다. 고치기 전에는 4개 동시 실행 1라운드에서 RX4 가 1번 빨강이었다. 변이는 13종(재현 4 + 새것 9)이고 전부 의도한 테스트가 빨강이 됐다.
- **이번 첫 푸시는 보호 밖이다**(지금 배포된 index.html 에 표가 없다). DS-11 절차로 한 번 넘긴다.

## DS-2. import map 범위와 키 정규화 (미리보기 `blog`)

| 확인 | 결과 |
|---|---|
| 부팅 때 요청된 앱 자원 | 54개 — CSS 4 + 모듈 50. 표의 51개 중 안 받힌 1개는 `ai/ondevice.js`(어떤 모듈도 import 하지 않음) |
| 쿼리 없는 `js/`·`css/` 요청 | **0** (`index.html?s=…` · `/apps/medreader/?s=…` 둘 다) |
| 같은 경로가 다른 URL 로 두 번 받힌 것 | 0 (모듈 인스턴스가 둘로 갈리지 않음) |
| 앱 내부 동적 `import()` | 없음. `grep "import(" js` → `pdf/loader.js` 의 CDN 하나뿐 |
| 워커 · 앱 파일 `fetch` · CSS `url()` | 없음 · 없음 · 없음 |

**키 정규화 — 브라우저에서 직접**. 페이지 문맥에서 같은 모듈을 여러 모양으로 불렀다. `'./js/db.js'`, `'./js/ui/../db.js'`, `'./js/text/../ai/adapters/../../db.js'`, `'/apps/medreader/js/db.js'`, 절대 URL, `'./js/./db.js'` 의 6가지다. 6가지 모두 **앱이 쓰는 그 `db` 인스턴스와 같았고 새 네트워크 요청은 0**이었다. 깊이 3의 `ai/adapters/gemini.js` 도 두 경로로 불러 같은 인스턴스였다. 표의 키(`"./js/x.js"`)는 문서 기준 절대 URL 로 풀린다. 모듈 안의 상대 import 는 해시 URL 기준으로 풀린 뒤 경로가 같아져 표에 걸린다. 이것은 IM5 가 Node 에서, 위 실측이 브라우저에서 확인했다.

**구멍(테스트 보강함)**: IM5 는 `import('…')` 꼴만, IM5b 는 식별자로 시작하는 동적 import 만 봤다. 그래서 `` import(`../text/${n}.js`) `` 나 `import('../x.js' + q)` 가 둘 다를 비켜 갔다(변이 N2 로 확인). IM5b 에 "문자열 하나가 아닌 식" 검사를 더했다.

## DS-3. 혼합 상태 재현 — 독립 각본

**Build 와 다른 방법**: Build 는 옛 해시 URL 하나를 `fetch(…, {cache:'reload'})` 로 강제로 갈아 끼웠다. 나는 **강제 없이 "캐시 항목의 만료"만으로** 섞이게 했다.
- python `http.server` 는 `Cache-Control` 이 없다. 그래서 브라우저가 수정 시각 휴리스틱(나이의 10%)으로 신선 기간을 잡는다.
- 수정 시각을 2020 으로 두면 몇 달 동안 신선하다(= Pages 의 10분 안에 해당).
- 수정 시각을 지금으로 두면 곧바로 낡아서 다음 방문 때 재확인된다(= 캐시에서 빠진 항목에 해당).
- 옛 판은 `f26af46~1` 의 `provider.js`·`redact.js`(`setSecretSource` 없음)다. 각 회차마다 꼬리 주석 `// rv-A|B|C` 를 붙여 **이전 실험의 캐시와 겹치지 않는 새 해시**를 만들었다.
- 문서 URL 은 회차마다 `?s=…` 로 새로 열었다.

| 경우 | 서버 파일 | index.html | 받힌 것 (Resource Timing: 전송 바이트) | 결과 |
|---|---|---|---|---|
| (1) 옛 표 + 옛 파일 | 옛(A) | 옛 표 A | `provider?v=ea10f94273` 29,754B · `redact?v=c733eec6a1` 8,628B, `setSecretSource` 없음 | `data-boot=ok`, 쿼리 없는 요청 0 |
| (2) 새 표 + 새 파일 | 새 | 새 표 | `?v=48d1929564`·`?v=10e447456b`(캐시 0B, 새 내용). **옛 해시 URL 요청 0** | `data-boot=ok` |
| (3a) 옛 표 + 새 파일, 옛 URL 이 모두 캐시에 있음 | 새 | 옛 표 A | 둘 다 **0B(캐시)** → 옛 내용끼리 | 일관된 옛 판으로 `ok` |
| (3b) 옛 표 + 새 파일, 옛 URL 이 하나도 캐시에 없음 | 새 | 한 번도 안 받은 옛 표 C | 옛 해시 URL 인데 33,205B·11,041B = **새 내용**(서버가 쿼리를 무시) | 일관된 새 판으로 `ok` |
| **(3c) 옛 표 + 새 파일, provider 항목만 만료** | 새 | 옛 표 B | provider **33,205B(서버 → 새 내용)** · redact **0B(캐시 → 옛 내용)** | **섞임** → `SyntaxError … 'setSecretSource'` → **안내 즉시 표시**(`data-boot-fail="error"`, 화면 글자는 네 언어 안내뿐, 버튼 48px) |
| (3c)에서 [다시 불러오기] (index 는 아직 옛것) | 새 | 옛 표 B | `navigation.type=reload`. provider 300B(304) · redact **0B — 다시 확인조차 안 함** | **여전히 안내** |
| index.html 이 새것이 된 뒤 [다시 불러오기] | 새 | 새 표 | 새 해시 URL | `ok`, 안내 닫힘 |

**읽는 법**
- 쿼리는 **캐시 키를 나눌 뿐**이다. 서버(Pages·python)는 옛 판을 보관하지 않는다.
- 같은 index.html 아래에서 섞이는 길은 (3c), 곧 "옛 표가 가리키는 항목 중 **일부만** 캐시에 없을 때" 하나다. 모두 있으면 옛 판끼리, 모두 없으면 새 판끼리 일관된다.
- 크롬의 일반 새로고침은 하위 자원 중 신선한 것을 다시 확인하지 않는다. 그래서 (3c)는 [다시 불러오기]로 바로 풀리지 않는다. **index.html 이 만료돼 새 표를 받아야** 풀린다(Pages 에서 최대 10분). 안내 문구가 "잠시 뒤 다시 열어 주세요"인 것이 맞다.
- 실험 파일(index.html·provider.js·redact.js)은 스크래치패드 사본으로 되돌리고 `cmp` 로 같음을 확인했다(`rv-` 꼬리 0). 브라우저 캐시에는 실험용 옛 해시 URL 6개가 남아 있다. 지금 표가 가리키지 않으므로 앱에 영향은 없다.

## DS-4. 최악(섞인 규칙의 재추출이 굳음) — 잔존 가능성과 의견

**여전히 가능한가 — 가능하다. 다만 세 조건이 겹쳐야 한다.**
1. **(3c) 모양의 캐시 상태**여야 한다. 곧 옛 index.html 이 신선한데(Pages 10분) 그 표의 URL 중 **일부만** 캐시에 없어야 한다. 그런데 Pages 에서는 모든 모듈이 index.html 과 **같은 방문에서, 그 뒤에** 받혀 같은 10분을 산다. 앱 모듈은 모두 정적 import 라 부팅 때 한꺼번에 받힌다. 늦게 받히는 모듈이 없으니 오래 열어 둔 탭도 안전하다. 그래서 이 상태는 다음 경우에만 생긴다.
   - 그 10분 안에 저장 공간 압박으로 **항목 몇 개만** 축출됐을 때
   - 직전 방문의 모듈 받기가 일부 실패했을 때
   - 한 방문 안에서 index.html 재확인(304)과 모듈 재확인 사이(수 초)에 배포가 끼었을 때
   - CDN 퍼지 전파 중
2. 섞인 짝이 **연결 오류 없이 맞물려야** 한다. PR-6 의 `layout`+`blocks`/`config` 처럼 export 이름이 같은 경우다. 이름이 어긋나면 안내가 뜨고 추출은 시작조차 못 한다.
3. 그 방문에서 **추출이 돌아야** 한다. 새 책을 가져오거나 algoVersion·derivedHash 가 올라 다시 추출되는 경우다.

**가능성**: 셋 다 드물고 서로 독립이다. 곱하면 "Nour 한 사람이 1년에 한 번"도 안 될 수준이라고 본다. 실측이 아닌 판단이다. 걸리더라도 이제는 [⋯] → [텍스트 다시 추출]로 원문 언어·마지막 쪽을 잃지 않고 복구된다(DS-6).

**추가 장치 의견 — 권함(다음 단계, 이번 푸시를 막지 않음)**

**(가) "판 대조" — 추출이 쪽을 쓰기 전에 한 번.** 굳기 자체를 막는다.
- `extract.js` 의 추출 시작에서, 규칙 모듈(`text/*`·`config.js`)마다 `import.meta.resolve('../text/blocks.js')` 로 **표가 고른 URL**(`…?v=H`)을 얻는다.
- 그 URL 을 `fetch(url, {cache:'force-cache'})` 로 캐시에서 다시 읽는다. 줄바꿈을 LF 로 맞춘 SHA-256 앞 10자를 재서 `H` 와 비교한다.
- 하나라도 다르면 실제로 돈 내용이 표와 다르다는 뜻이다. 그러면 **추출을 시작하지 않는다**. 읽기는 그대로 두고 "앱이 갱신되는 중 — 잠시 뒤 다시 열어 주세요" 배너를 띄운다.
- `?v=` 가 없으면(import map 미지원) 건너뛴다.
- 비용: 캐시 읽기 10여 개, 약 400KB 해시. 세션당 한 번, 수십 ms 다.
- 오탐(검사 사이에 항목이 축출돼 새 내용을 받음)은 추출을 미룰 뿐이라 안전한 쪽이다.
- 생성기·js 파일 내용을 바꿀 필요가 없고, 코드 규칙 변경(상수가 아닌 로직)도 잡는다.

**(나) 보조 — 자가 치유.** 이미 있는 `derivedHash`(하이픈 집합 지문, `store.js`)에 `config.js` 의 레이아웃·머리말 상수를 넣는다.
- 섞인 판에서 굳은 문서는 다음 정상 방문 때 지문이 달라 저절로 다시 추출된다.
- 다만 로직만 바뀐 `blocks.js` 는 못 잡는다. 그래서 (가)의 대체가 아니라 보조다.

(가)는 `extract.js` 에 새 기능을 넣는 일이라 이번 Review 의 "결함 수정" 범위를 넘는다. 그래서 구현하지 않았다.

## DS-5. 부팅 실패 안내

| 항목 | 결과 |
|---|---|
| 정상 부팅 깜빡임 | 리더 딥링크(`#/reader/<id>/30`)로 열었다. pdf.js 받기와 추출이 도는 중에 `data-boot-fail`·`#bootFail` 에 MutationObserver 를 걸고 21.5초를 기다렸다. **변화 0**, `hidden` 유지 |
| 부팅 완료 표시 위치 | `boot()` 마지막 줄이다. 앞에 있는 무거울 수 있는 일은 모듈 그래프 받기와 `settings.load`(IndexedDB 열기)뿐이다. `startRouter` 는 `onRoute` 를 **기다리지 않고**(router.js `handler`) 부르므로 책 열기·pdf.js·추출은 모두 완료 표시 **뒤**에 돈다. 그래서 7,000쪽 책을 열고 부팅해도 20초에 걸리지 않는다. IM9 에 "라우터를 켠 뒤 완료 표시 전에 `await`·`.then`·`setTimeout` 0"을 더해 이것을 고정했다 |
| 20초 근거 | Build 의 추정(느린 망 5~10초의 두 배)이 타당하다고 본다. 오류는 ①②③이 즉시 잡는다. 아주 느린 망에서 20초를 넘겨 열려도 부팅이 끝나면 닫힌다(IM11) |
| 모듈 404 | 표의 `voices.js` 값을 잠시 `voices-404.js` 로 바꿨다 → `404` → `data-boot-fail="load"` 로 안내가 표시됐다. 스냅숏으로 되돌린 뒤 `cmp` 같음 |
| 연결 오류 | DS-3 (3c) — `error` 로 안내 표시 |
| [다시 불러오기] | `navigation.type=reload` 다. index 가 새것이 된 뒤에는 `ok` 다(DS-3) |
| 아랍어 먼저·`dir` | 문단 4개가 `ar/rtl`·`en/ltr`·`fr/ltr`·`ko/ltr` 이고 `text-align:start` 다. 버튼 높이는 1024px 에서 48, 360px 에서 76(두 줄) |
| 360px | 안내가 보일 때 `scrollWidth = innerWidth`(361) |
| 외부 CSS 의존 | 숨김 규칙과 모양이 인라인 `<style>`·시스템 색이라 CSS 를 못 받아도 보인다 |

**고친 오탐**(DS-10 ③)
- 고치기 전 감시는 ①(아무 `<script>` 요소의 `error`)이나 ②(이 앱 파일의 오류)로 연 안내를 **부팅이 끝나도 닫지 않았다**. ①은 스크립트의 출처도 보지 않았다.
- 그래서 확장 프로그램이 넣은 `<script>` 가 부팅 전에 실패하거나, 부팅을 막지 않은 처리기 예외가 하나 나면 **멀쩡히 부팅된 앱이 전면 안내에 덮인 채** 남았다.
- 진입 그래프가 정말 실패했다면 `main.js` 가 돌 수 없으므로 부팅 완료가 설 수 없다. 따라서 "완료가 서면 ③(부팅이 던짐) 말고는 닫는다"는 안전하다.
- ①은 이 앱의 스크립트(인라인 진입점이나 이 폴더 파일)만 보게 했다.
- 브라우저 확인: 고친 감시로 404 는 여전히 `load` 로 열린다. 정상 부팅 뒤 남의 `<script>` 404 로는 열리지 않는다.

## DS-6. [텍스트 다시 추출]

**지우는 목록을 코드와 대조했다.** 문서별 저장 지점을 전수로 찾았다(`db.patch/put('documents'`, 스토어 인덱스 `docId`).
- 지우는 것: `pages`·`questions`·`sections`·`extraction`·`sectionIndex*`. 이것이 텍스트에서 파생된 전부다.
- `readStats`·`langGuess` 를 남기는 판단에 동의한다.
- `annotations`(쪽·줄 기준)과 `cards` 는 사용자 데이터라 남기는 것이 맞다. 다만 줄 id 가 바뀌면 고리가 끊길 수 있다. 지금은 쓰는 화면이 없다.

**브라우저(40쪽 가짜 PDF — 브라우저에서 만든 짝·홀 머리말 + 지어낸 문장)**

| 단계 | 결과 |
|---|---|
| 준비 | 추출 완료(40쪽 algoVersion 10) 뒤 1–20쪽에 굳은 표지 `rvMixed` 를 달았다. `lang fr/user` · `lastPage 7` · `lastLineId keep-me` · 가짜 `sectionIndex`+`sectionIndexDone true` · questions 1 · aiCache 1 · cards 1 · annotations 1 도 넣었다 |
| 대화상자 | `showModal` → `:modal` 참. 첫 초점 [취소]. `aria-labelledby`·`aria-describedby` 있음. 버튼 48px |
| **실제 Esc 키** | 닫힘. 지운 것 0. **초점이 [텍스트 다시 추출] 버튼으로 돌아옴** |
| [다시 추출] + 겹침 | 확인 직후 같은 버튼 다시 누름 → 대화상자가 다시 안 열린다. `reextractDoc` 두 번 → **같은 약속**. 그사이 `openDoc` → 기다렸다가 **같은 새 추출기**를 받는다 |
| 끝난 뒤 | 쪽 40 모두 10, `rvMixed` 0. **처음 쓰인 쪽은 7·8·6·9**(마지막 쪽 우선). `fr/user`·`lastPage 7`·`keep-me` 유지. aiCache·cards·annotations·blobs 각 1 유지. questions 0 |
| 리더로 | 7쪽 `article lang="fr"`, 머리말이 빠진 본문. [다음 쪽] → 8. 퀴즈 색인이 다시 만들어짐(`sectionIndexDone true`, 판본 2) |
| 아랍어 UI 360px | 패널·대화상자가 `rtl`, 넘침 0 |

**낭독 중 누르기**: 버튼은 서재의 [⋯] 에만 있다. 리더를 떠나면 `leaveReader` 가 낭독을 멈춘다. 그래서 "낭독 중 다시 추출"은 생기지 않는다. 다른 책 열기는 `reextracting` 이 docId 별이라 영향이 없다.

## DS-7. stamp 생성기

| 항목 | 결과 (스크래치패드 앱 사본에서 CLI 로) |
|---|---|
| `--check` | 그대로면 종료 0. `blocks.js` 한 줄 추가 → **종료 1** + "돌려라". 새 `js/text/newmod.js` → 종료 1 |
| 쓰기 | 다시 찍으면 바뀐 줄은 그 모듈 한 줄뿐(`diff` 1줄). 다음 `--check` 는 0 |
| 구간 밖 | 구간 앞·뒤 글자가 한 글자도 같다(LF·CRLF 둘 다). 들여쓴 구간도 멱등 |
| 멱등 | 두 번째 찍기 `changed=false` |
| **CRLF** | **고치기 전에는 보존하지 않았다.** CRLF 로 저장된 index.html 을 찍으면 구간 62줄이 LF 로 들어가 줄바꿈이 섞였다. 해시가 맞아도 `--check`·IM6 이 "다르다"로 빨갰다. 구간 앞 줄끝을 보고 같은 줄바꿈으로 쓰게 고쳤다(IM7b). 저장소는 `.gitattributes eol=lf` 라 보통은 LF 다. 편집기가 CRLF 로 저장한 경우의 함정이다 |

## DS-8. 회귀 (미리보기 `blog`)

| 항목 | 결과 |
|---|---|
| 서재 | 카드, [⋯](원문 언어·다시 추출), 가져오기 |
| 리더 | 본문 `lang` = 사용자 언어, [다음 쪽] |
| 낭독 | [▶] → `speechSynthesis.speaking=true`, "Line 1 of 15", 다시 누르면 멈춤 |
| 띠(8b) | `trBand` `data-state="pending"`, 키 없음 — 동작은 이전과 같음(trband 무변경) |
| 원본 | 캔버스 801×1036(CSS 721). 되돌리면 `reader.view=reflow` |
| 설정 | 화면 표시 |
| 퀴즈 | 가짜 문서라 버튼 숨김(정상). 색인 재생성은 위 DS-6 |
| 360×740 | 서재·[⋯] 패널·대화상자·리더·설정·부팅 안내 모두 `scrollWidth = innerWidth`(361) |
| 콘솔 | 이번 세션에서 새로 생긴 오류는 의도한 (3c) 재현의 `SyntaxError` 2줄(처음·다시 불러오기)뿐이다. 나머지는 앞선 세션의 기록이다 |
| 키 누출 | 저장된 키 0. localStorage·sessionStorage 키 0 |

**정리**
- 가짜 문서는 `deleteDocument` 로 지웠다.
- IndexedDB 13개 스토어가 시작과 같다(settings 8행 값 동일, 나머지 0).
- UI 언어는 런타임에서만 ar 로 바꿨다가 en 으로 되돌렸다.
- 뷰포트는 desktop 이고, 페이지는 `index.html#/library` 다.

## DS-9. 테스트 · 변이

- `node --test "apps/medreader/tests/*.test.mjs"`: **951/951**.
  - 순차 3회, 4개 동시 실행 2라운드(8회)로 모두 실패 0이다.
  - RX4 를 고친 직후 6개 동시 실행 2라운드(12회)도 실패 0이었다.
- 변이(`rvds/mutate.py`): 찾을 문자열이 정확히 1곳인지 확인 → 적용 확인 → JS 를 고친 변이는 `stamp` 로 다시 찍음(표 탓 빨강과 분리) → 전체 테스트 → 스크래치패드 스냅숏으로 복원 → `filecmp`. 끝난 뒤 `js/`·`css/`·`dev/`·`tests/`를 스냅숏과 `diff -r` 해 같았고, `index.html` 은 `cmp` 로 같았다. `MUT_` 표지가 남은 앱 파일은 0, `stamp --check` 는 "그대로다".

| 변이 | 출처 | 빨강 |
|---|---|---|
| R1 표에서 `voices.js` 빼기 | Build M1 재현 | IM1·IM2·IM5·IM6·IM7b |
| R2 `db.js` 해시 바꾸기 | Build M2 재현 | IM2·IM6·IM7b |
| R3 진입점을 `src=` 로 | Build M3 재현 | IM4·IM8 |
| R4 `stopAndSettle` 이 도는 쪽을 안 기다림 | Build M6 재현 | RX4 |
| N1 동적 import 를 쿼리 붙은 경로로(표 밖) | 새것 | IM5 |
| N2 동적 import 를 템플릿 문자열로(표 밖) | 새것 | **IM5b(보강 후 — 전에는 통과)** |
| N3 부팅 완료 표시 앞에 25초 기다림 | 새것 | **IM9(보강 후 — 전에는 통과)** |
| N4 생성기가 CRLF 파일에 LF 구간 | 새것 | IM7b |
| N5 감시가 캡처 없이 들음(모듈 404 놓침) | 새것 | IM10 |
| N6 다시 추출이 `sectionIndexDone` 을 남김 | 새것 | RX1 |
| N7 감시: 부팅 뒤 시간 초과로 연 것만 닫음(고치기 전 동작) | 새것 | IM11 |
| N8 감시: 남의 `<script>` 오류로도 엶 | 새것 | IM10 |

## DS-10. 고친 것 / 기록만

**고친 것**(모두 배포 안전장치가 만든 파일 안이다)
1. **`tests/reextract.test.mjs` RX4 간헐 실패.**
   - 재현 쪽이 `sleep(20)` 뒤 `stop()` 했다. 부하가 크면 첫 `_tick` 이 아직 안 돌아 "stop 뒤 쓰기"가 오지 않았다(4개 동시 실행 1/4 빨강).
   - 같은 이유로 `stopAndSettle` 쪽 검사는 **쪽 처리가 돌지 않은 채 거저 통과**할 수 있었다.
   - 이제 `_buildAndStore` 에 들어온 뒤(`entered`)에 멈추고, 끝은 시간이 아니라 `_tickPromise` 를 기다린다.
   - 고친 뒤 동시 실행 20회 실패 0, R4 변이 빨강 유지.
2. **`dev/stamp-importmap.mjs` CRLF 보존**(DS-7) + IM7b.
3. **`index.html` 감시 오탐**(DS-5): 부팅 완료가 서면 ③ 말고는 닫는다. ① 은 이 앱 스크립트만 본다. IM10·IM11 을 새 규칙으로 고치고 경우를 더했다.
4. **테스트 구멍 둘**: IM9(라우터 뒤 기다림 금지), IM5b(식으로 된 동적 import).

**기록만**
1. **퀴즈 색인 빌드와 다시 추출의 경합**
   - `ui/quiz.js ensureSectionIndex` 가 돌고 있을 때 [다시 추출]을 확인하면 문제가 생긴다. 빌드는 옛 `d.extraction.done=true` 를 들고 있다. 그 빌드가 `resetDerived` 뒤에 **옛 쪽에서 만든 `sectionIndex`·`questions` 와 `sectionIndexDone=true`** 를 쓴다.
   - 새 추출이 끝날 때 리더가 그 추출기를 보고 있으면 `done` → `force` 로 다시 만든다. 그렇지 않으면(서재에만 있다가 나중에 열면) `hasIndex && done && sectionIndexDone && 판본 같음` 이라 **다시 만들지 않는다**.
   - 빌드가 도는 때는 추출 완료 직후 수 초뿐이라 드물다.
   - 고칠 곳은 `reextractDoc` 이 지우기 전에 그 문서의 진행 중 빌드를 기다리게 하는 것이다(`quiz.js` 에 `building.get(docId)` 를 내보내는 한 줄이 필요하다). `quiz.js` 는 이번 범위 밖이라 고치지 않았다.
2. [다시 추출]을 확인한 뒤에는 `renderList` 가 카드를 다시 그려 초점이 `body` 로 간다. [취소]·Esc 는 버튼으로 돌아온다. 작은 접근성 결함이다.
3. 대화상자 본문 "첫 쪽부터 다시 준비"는 실제 순서(마지막 쪽 ±5 먼저)와 조금 다르다. 사용자에게 해는 없다.
4. Build 기록 1·2(같은 세션의 리더 표 크롭 캐시, IndexedDB 막힘 20초 뒤 안내가 배너를 덮음)는 그대로다.
5. 앱 폴더와 `dev/` 에 빈 `NVIDIA Corporation/umdlogs/` 폴더가 있다. GPU 드라이버 로그 폴더로 보이며 추적되지 않는다(빈 폴더). `js/` 밖이라 표와 무관하다.
6. 작업 트리에 다른 Plan(검색)의 `spec.md` 변경과 `dev/measure-search.mjs`·`dev/search-bench.html` 이 섞여 있다. `.codex/`·`AGENTS.md` 도 있다. 첫 푸시 커밋에 무엇을 담을지 골라야 한다(DS-11).

## DS-11. 첫 푸시 절차 (이번 한 번은 보호 밖)

지금 배포된 index.html 에는 표가 없다(`src="js/main.js"`, 해시 없는 URL). 배포 직후 최대 10분 동안 옛 index.html 을 캐시에 든 기기는 해시 없는 옛 URL 을 쓴다. 그래서 PR-6 의 혼합 위험이 **이번 한 번** 그대로 있다. 새 index.html 을 받은 순간부터는 새 해시 URL 만 쓰므로 일관된다.

1. **커밋 전**
   - `node apps/medreader/dev/stamp-importmap.mjs --check` 가 "그대로다"인지 본다.
   - `node --test "apps/medreader/tests/*.test.mjs"` 가 951 통과인지 본다.
   - 커밋에는 배포 안전장치 파일(`index.html`·`js/`·`css/`·`dev/stamp-importmap.mjs`·`tests/` 둘·`review.md`)을 담는다.
   - `spec.md` 는 오케스트레이터가 Build 보고 9절 문구를 넣은 뒤 담는다. 검색 Plan 의 변경을 함께 올릴지는 따로 정한다.
   - 검색용 `dev/` 파일·`.codex/`·`AGENTS.md` 는 이 커밋에 섞지 않는다.
2. **한 번에 푸시**한다. 로컬 `f26af46` 과 이 커밋을 한 `git push` 로 올려 Pages 배포가 한 번만 일어나게 한다.
3. **15분 기다린다.** Pages 빌드 + CDN + `max-age=600` 이 지나야 한다.
4. **운영자 기기에서 확인한다.**
   - 앱을 연다. 콘솔에서 `document.documentElement.dataset.boot === 'ok'` 를 본다.
   - 네트워크 탭에서 `js/…?v=` URL 만 보이는지 본다. 이것으로 새 index.html 이 살아 있음을 확인한다.
   - 콘솔 오류 0 을 확인한다.
5. **Nour 에게 안내**: "앱을 완전히 닫았다가 다시 여세요. 네 언어로 '불러오지 못했습니다' 안내가 보이면 몇 분 뒤 다시 여세요."
   - 이번 한 번만 옛 판 혼합으로 빈 화면이 나올 수 있다. 그때도 몇 분 뒤 다시 열면 된다. **책을 열기 전에** 다시 열게 한다.
6. **재추출 안내**(PR-10 4항 그대로): CMDT 2026 은 처음 열 때 algoVersion 10 으로 전체를 다시 추출한다.
   - **PR-10 5항을 바꾼다**: 머리말이 다시 낭독되거나 문단이 이상하면 이제 **[⋯] → [텍스트 다시 추출]** 로 고친다. 원문 언어·마지막 쪽·번역 캐시는 남는다. 문서를 지우고 다시 가져올 필요가 없다.
7. **다음 배포부터**: JS·CSS 를 고친 커밋은 `node apps/medreader/dev/stamp-importmap.mjs` 로 바뀐 `index.html` 을 같은 커밋에 담는다(잊으면 IM2·IM6 빨강). 배포 뒤 혼합이 생겨도 빈 화면 대신 안내가 뜬다. 다만 섞인 규칙으로 굳는 최악은 DS-4 대로 아주 드물게 남는다. DS-4 (가)를 다음 Build 로 권한다.

**재시작 뒤 마무리 확인(2026-10-11)**
- 작업 트리의 `index.html`·`js/`·`css/`·`dev/`·`tests/` 를 스크래치패드 스냅숏과 `cmp`·`diff -r` 로 대조했다. 모두 같다. 변이 `MUT_` 표지와 실험 꼬리 `rv-A/B/C` 는 앱 파일에 0이다.
- `stamp-importmap --check` 는 "그대로다", 테스트는 **951/951** 이다.
- 미리보기를 다시 열었을 때 IndexedDB 는 13개 스토어가 모두 0이었고(settings 도 0 — 브라우저 세션이 새로 시작돼 온보딩부터 뜬다. 가짜 데이터는 없다) localStorage·sessionStorage 키도 0이다. 뷰포트는 desktop 이다.

---

# 8h 낭독 다듬기 Review — 8h-1 낭독 정리(인용·글머리·각주 기호) + 8h-F 타슈킬 시험 페이지 (2026-10-12)

> 지침: `.claude/tasks/medreader-review-8h.md`. Build 보고를 믿지 않고 다시 쟀다. 커밋하지 않았다. 진짜 API 키는 쓰지 않았다.
> 측정·덤프 스크립트는 스크래치패드 `r8h/` 에만 있다(원서 문장은 그 안에만 있다). 아래 원서 인용은 모두 40자 이하다.
> 환경: Windows 10 / Node v24.14.0 / 내장 Chromium 패널(이미 떠 있던 `localhost:8000` 정적 서버 — 내가 띄운 것이 아니라 그대로 둠).

## 8h-1. 결론 — **통과** (운영자 결정 3건은 아래 8h-10)

- 오탐(본문을 건너뜀) **0건** — 두 책, 지침 표본 전부 + 내 표본 3종(8h-2).
- 브라우저 실동작 전부 기대대로. 인용 줄은 발화·하이라이트·요청 묶음 어디에도 없다(8h-4).
- D: 지금 판에서는 **재현되지 않는다**. "옛 index.html + 8b 모듈" 판 섞임으로는 **영상과 같은 증상이 그대로 재현된다**(8h-5).
- 테스트 978/978(순차 3회 + 동시 4개), 변이 7개 모두 빨강(8h-8). 고친 파일 없음.

## 8h-2. 오탐 검토 (6-6-2 기준 0건)

`dev/measure-cite-8h.mjs --all` 을 두 책 전권에 다시 돌렸다. 수치는 Build 보고와 한 자리까지 같다.

| | CMDT 2026 (1,967쪽) | CMDT 2021 (5,051쪽) |
|---|---|---|
| 앱 큐 cite | 8,349 단위 · 295,411자(3.34%) · 927쪽 | 12,604 단위 · 493,538자(5.21%) · 1,340쪽 |
| A1 et al. **전수** | 161 → 본문 **0** | 27 → 본문 **0** |
| A2 묶음 무작위 | 200 → 본문 **0** | 200 → 본문 **0** |
| et al. 없는 A2 머리 **전수** | 58 → 본문 **0** | 136 → 본문 **0** |

내가 따로 뽑은 표본(앱의 `splitSentences`·`markReferences` 로 cite 문장 전수를 덤프한 뒤):
- **소문자 낱말 비율 상위 50**(책마다): 전부 참고문헌 제목 문장이다("A systematic review." 같은 부제 포함). 본문 0.
- **길이 상위 50**(2026, 207~316자): 전부 긴 지침 제목·단체 저자 문헌. 본문 0.
- **5문장짜리 A2 묶음 전부**(2026 7개, 2021 11개)와 **앞뒤가 모두 본문인 고립 A1 et al.**(2026 1개 — 27쪽 표 칸의 "저자 et al. 학술지." + 괄호 PMID): 본문 0.
- **식별자 + 글자가 남는 A1**: 2026 1개(22쪽 "Chin KM et al. Eur Respir J." + PMID), 2021 0개. 인용이다.
- 눈에 띈 것(오탐 아님): 2026 1647쪽 묶음 머리가 "Acetaminophen Stölzel U et al. …" — 참고문헌 목록 안의 소제목 낱말이 머리에 붙어 함께 빠진다. 본문 문장이 아니므로 허용.

→ 기준 0건을 두 책 모두 만족한다. 200 표본 0이면 95% 상한 약 1.5%(책마다), 전수 칸은 0.

**수치 대조(6-6-8 ±1%)**: Plan 흉내 대비 A1 −0.6%, A2 −0.1%, 빠지는 글자 −0.9% 로 안. B 의 인용 조각만 −1.5% 인데, Plan 스크립트의 `ID_CLOSE` 가 `iu` 플래그라 `\p{Lu}` 가 소문자에도 맞는다(Node 24 에서 직접 확인: `iu` 참 · `u` 거짓). 앱이 spec("소문자면 끊지 않는다")대로다.

## 8h-3. Harrison "other" 24곳 — `speechMarks` 가 하는 일

| 자리 | 수 | 앱 동작 | 판단 |
|---|---:|---|---|
| 655쪽 표 각주 별표 줄("c***", "c,d****", 범례 "* ** *** ****") | 16 | 모두 지움 | 맞다 — 각주 표지다 |
| 156쪽 "<10%*" 뒤 각주 | 1 | 지움 | 맞다 |
| **574·576쪽 HLA-DRB1 대립 유전자 표기** "(*1501, *0301)" "(*0401)" "(*0101, *0404, *1001, and *0901)" | **7** | `*` 를 지워 "HLA-DRB1 (1501, 0301)" 로 읽는다 | **뜻을 뒤집지는 않지만 표기가 바뀐다** — spec C 가 "대립 유전자 이름이 바뀐다 → 지우지 않는다"고 한 경우와 같은 종류인데, 앞 글자가 `(`·공백이라 피연산자 규칙에 걸리지 않는다 |

- 같은 꼴(괄호·공백 뒤 별표 + 숫자)은 CMDT 2026·2021 전권에 **0곳**이다. 고칠지 운영자 결정(8h-10 ③).
- 나머지 Harrison 기호(피연산자 1 "HLA-B*5801" 남김, 단어 끝 7·머리 5 지움)는 spec 대로다.

## 8h-4. 브라우저 실동작 (360×740, CMDT 2026 실제 PDF)

**PDF 넣기**: 106MB PDF 를 레포에 두지 않으려고, 스크래치패드의 임시 Node 서버(127.0.0.1:8765, 그 한 파일만 CORS 로)에서 받아 `#fileInput` 에 `DataTransfer` 로 넣었다. 끝나고 서버를 껐다.
**음성·번역**: `speechSynthesis.speak` 를 기록 후 40ms 에 `onend` 를 부르는 스텁으로 바꿨다. 키는 실행 중 조각을 이어 만든 가짜 키, `fetch` 는 Gemini 주소만 가로채는 스텁(처음엔 400, 뒤에는 원문에 "ترجمة " 를 붙여 돌려줌). 실제 Google 요청 **0**(네트워크 기록 `googleapis` 0건, `key=` 0건).

| 확인 | 결과 |
|---|---|
| 30쪽 기본(인용 거름) | 발화 38단위. 인용 12단위(저자 6·PMID 6) **발화 0**. "∗See chapter…" → "See chapter…". 하이라이트가 인용 줄(30:7·30:42·30:47·30:51·30:64)을 건너뛴다 |
| 요청 묶음(인용 거름 · 인용 읽기 둘 다) | 요청마다 "et al" 0 · "PMID" 0 · 30쪽 저자 이름 0. 키는 `x-goog-api-key` 헤더, URL 에 키 0 |
| 설정 "인용·참고문헌도 읽기" 켬(설정 화면 체크박스 클릭) | 인용 12발화 모두 `en-US`, 바로 다음은 다음 본문의 원문 — **번역 단계 없음**. 띠는 그동안 "이 문장은 번역 없음". 본문은 원문 → `ar-SA` 번역문 순서 그대로. 새로고침 뒤에도 설정 유지 |
| 인용 줄 탭 | 30:7(인용) 탭 → 다음 발화 "CHAPTER 30…"(30:8). 30:64(마지막 인용) 탭 → "YRx"(30:65) |
| **인용뿐인 쪽에서 재생** | CMDT 2026 전권에서 인용뿐인 쪽은 1819쪽 하나(65단위). 거기서 재생 → `waiting-page` → 1820쪽, **첫 발화 약 0.2초 뒤**. 데스크톱 Chrome 에서는 비동기 경로가 동작한다. 실기기(사용자 활성화 시간 안에 첫 `speak` 가 나가는지)는 여전히 미확인 |
| 구간 반복 | "Once started…"(23) ~ "• In some patients…"(24, 사이에 인용 "Sølling AS et al." 있음) 3회 반복 → 두 문장만 번갈아 3번, 인용 발화 0 |
| 설정 화면(360px) | 낭독 묶음 카드 끝에 체크박스 + 안내 한 줄(ko 문구 확인). 라벨 252×48px, 가로 스크롤 0 |

- 참고: 줄 단위 모드에서는 spec 대로 인용을 판정하지 않아 저자·PMID 를 **영어로** 읽는다(줄 모드에서는 번역이 쉬므로 아랍어 음역은 없다). 기록만.
- 참고: 지금 판의 리더에서는 30쪽 표 머리 "Topic / Page Number …" 줄이 `folded-lines`(공개 전 묶음의 러닝 헤드 접기)라 **아예 읽지 않는다**. 6-6-8 (3) 의 "표 머리 …Practice(∗ 없음)" 단계는 지금 판에서는 생기지 않는다. Node 측정(`measure-lib` 의 `sentenceUnits`)은 이 접기를 모른다.

## 8h-5. D — 원본 보기에서 자막 띠

**지금 판(작업 트리)** — speak 모드, 세피아, 360×740:

| 단계 | `#trBand` | 위치(top–bottom) | `elementFromPoint`(띠 가운데) | 상태 |
|---|---|---|---|---|
| ① 리플로우 재생 | 보임 | 483–602 | 띠 안 | ready, 번역문 표시 |
| ② 낭독 중 [원본] 전환 | 보임 | 483–602 | 띠 안 | ready |
| ③ 원본에서 멈춤 → 재생 | 보임 | 483–602 | 띠 안 | ready |
| ④ `reader.view='original'` 로 새로고침 → 곧장 원본 | 보임(아래 주의) | 483–602 | 띠 안 | idle 안내 문구 |
| ⑤ 가로 800×360 + 배너 1개 | 보임 | 143–223 | 원본 확대 막대 가운데가 **띠** | 원본 상자 높이 **0px** — 8b-8 에 이미 적은 것과 같다(새 결함 아님) |

- 세피아에서 띠 바탕 `rgb(251,244,228)`, 원본 스크롤 상자 바탕 `rgb(236,224,196)`, 띠 위 테두리 `rgb(216,199,163)` 0.9px. 구분은 약하지만 번역문 글자는 또렷이 보인다(D-c 는 "번역 없음" 흐린 한 줄일 때만 그럴듯하다).
- ④ 주의: 미리보기 창이 **숨김**(`visibilityState=hidden`, rAF 정지)일 때 원본으로 곧장 들어가면 원본 그리기가 끝나지 않아 `notifyPage` 가 오지 않는다 → 띠 숨김 · `__medreader.tts`·`__medreader.trband` 훅도 없음. 창이 보이게 되자 곧바로 그려지고 띠가 나타났다. 재생을 누르면 숨김 상태에서도 띠가 나온다(재생 핸들러의 `syncReadalong`). 실기기에서 화면이 보이는 동안에는 생기지 않는 조건이라 결함으로 보지 않는다. **다만 6-6-5 의 "trband 훅이 없으면 D-a 확정"은 이 경우에도 참이 되므로, 확인은 재생을 누른 뒤 `document.getElementById('trBand')` 가 있는지로 한다.**

**판 섞임 재현(D-a)** — `git show` 로 **8b 이전 `index.html`(4d291ca) + 8b 모듈·CSS(32f6636)** 를 그대로 내주는 임시 서버(127.0.0.1:8766, 체크아웃 없음)를 띄워 같은 PDF 를 넣었다:
- 리플로우·원본 둘 다: 원문 `en-US` → 번역문 `ar-SA` 가 번갈아 **소리 난다**, `#trBand` 요소 **없음**, `__medreader.trband` 없음, 콘솔 오류 **0**(조용히 물러난다).
- = 영상("아랍어는 들리는데 띠가 없다")과 같은 증상. **D-a 가설이 맞다.** 가려 내는 질문은 spec 그대로 "같은 세션에서 리플로우에서도 띠가 없었는가"다 — 판 섞임이면 리플로우에서도 없다.
- 그래서 **코드는 고치지 않았다**(`css/reader.css`·`ui/controls.js` 수정 없음). spec 6-6-5 의 권장(가이드 한 줄 + 설정 화면 판 표시)은 8h-D 몫으로 남긴다.

## 8h-6. 8h-F 타슈킬 시험 페이지

- 자리표시 데이터(지금 상태): `dir=rtl`·`lang=ar`, "الصفحة قيد التحضير / Not ready yet" 안내만 보인다. 가로 스크롤 0. 요청은 html + `tashkeel-ab.data.js` 둘뿐, 콘솔 0.
- 가짜 데이터(내가 쓴 짧은 아랍어 3문장)를 `__tashkeelAB.boot` 로 넣고 360px:
  - 보이는 버튼 22개 모두 48×48 이상.
  - **눈가림**: 화면 글자 중 부호가 있는 것은 고정 UI 문구 4개뿐, ②③ 글은 DOM(속성 포함) 어디에도 없다. 문장 줄·낱말 칩은 ① 을 부호 없이 보인다.
  - 섞은 순서가 결과에 남는다 — s1 `order 1=F 2=N 3=P` 에서 [▶ ٢] 를 누르자 실제로 ① 글이 말해졌다. s2 `1=P` 의 [▶ ١] 은 ③ 글.
  - 결과 복사: 이 패널에서는 clipboard 가 답하지 않아 1.5초 뒤 선택 폴백(563자 선택, "길게 눌러 복사" 안내). 결과 문자열에 순서·고른 판·표시한 낱말·재생 횟수·속도·Q3 가 있다.
- `tashkeel-make.mjs` 키 경로(코드 + 가짜 키 실행, 네트워크 없음): 키는 `GEMINI_API_KEY` 환경 변수로만, 전송은 `gemini.headers(key)`(헤더)만. `assertNoKeyInUrl` 가 깨끗한 URL 통과 · `?key=` · 인코딩한 키 · **다른** 키 모양 · 빈 `?key=` 모두 `KeyInUrlError`. `redact` 뒤 키 0. 결과 파일 쓰기 직전 키 모양 검사. 응답 헤더를 읽지 않는다. 키 없이 실행 → 종료 코드 2. 실제 생성은 하지 않았다.
- 부호 범위: 페이지 `strip` 과 스크립트 `TASHKEEL_RE` 모두 U+064B–U+065F · U+0670(코드포인트로 확인). 아랍-인도 숫자(U+0660–0669)는 지우지 않는다.

## 8h-7. 회귀

- **번역 캐시 키**: HEAD(740a3cd)의 `js/` 를 `git archive` 로 스크래치패드에 풀어 CMDT 2026 전권 문단마다 `buildUnits` 를 8h 전/후로 비교했다. 인용·글머리·식별자 괄호·기호가 없는 문단 **35,195개(81,197단위)**: `src` 차이 **0**, 단위 JSON 전체가 **같다**. 그런 것이 있는 문단 3,554개 중 `src` 가 바뀐 것은 1,309개(B 경계 — 예상된 비용).
- 서재·리더(리플로우·원본)·문장/줄 낭독·띠(8b)·설정 AI 탭: 정상. 360px 가로 스크롤 0. 콘솔 오류 0.
- 키 누출 0: DOM·localStorage 0, 가짜 키는 의도대로 sessionStorage 에만 있었고 [키 지우기] 뒤 0.
- 정적 점검: `splitSentences(` 호출은 `tts/text.js` 한 곳. `cite.js` 에 `document`·`window` 0. 바뀐/새 파일에 제어 문자 0. `ui/settings.js` 추가 줄에 `innerHTML` 0. `stamp-importmap --check` "그대로다(모듈 52개)". 추출(`pdf/*`·`layout`·`blocks`·`lines`·`columns`) diff 0, `algoVersion`·`DB_VERSION`·프롬프트 판 diff 0.
- 퀴즈는 브라우저에서 보지 않았다(이번 문서에 문항이 없다). node 퀴즈 테스트는 통과.
- 범위 밖(8h 와 무관, 기록만): `i18n/ko.js` 에 영어 그대로인 키가 남아 있다(`nav.back`·`reader.page.prev` 등 — HEAD 부터 그렇다).

## 8h-8. 테스트·변이

- `node --test "apps/medreader/tests/*.test.mjs"`: **978/978** 순차 3회, 동시 4개 모두 978/978.
- 변이(스크래치패드 실행기: 대상 문자열 1건 확인 → 적용 → 적용 grep → 전체 테스트 → 백업 복원 → 바이트 비교). 표의 빨강 말고 IM2·IM6·IM7b(해시)는 매번 함께 빨갛다.

| # | 변이 | 빨개진 테스트 |
|---|---|---|
| m2 | A2 머리에 쉼표 허용 | T-A2 ★★ "Stage III, severe …" |
| m4 | speaker 거르기 제거 | T-S 5개(기본·설정 반영·인용 줄 탭·인용뿐인 쪽·구간 반복) |
| m7 | `speechMarks` 를 `src` 에 | T-C ★★ src 불변(캐시 키) |
| **N1** | A1 길이 상한 200자 제거 | T-A1 ★ 음성(200자 초과) |
| **N2** | `trActive` 의 `seg` 검사 제거(인용 읽기 켬일 때 인용도 번역 단계로) | T-S ★ readCitations=true(번역문 단계 없음) |
| **N3** | 인용뿐인 쪽 판정 끔(재생 시 finish) | T-S ★ 인용뿐인 쪽 → 다음 쪽 |
| **N4** | `indexAtOrAfterLine` 이 화면 순서로 다음 줄을 찾지 않음 | T-S ★ 인용 줄 탭 |

- 복원 뒤 세 파일(`cite.js`·`speaker.js`·`text.js`) sha1 이 변이 전과 같다. 작업 트리 `git status` 는 시작 때와 같다.

## 8h-9. 고친 것 / 기록만

**고친 것**: 없다. 8h-1·8h-F 파일 안에서 결함을 찾지 못했고, D 는 판 섞임이라 코드 수정 대상이 아니다.

**기록만 — ① "출판 정보만인 문장 + 바로 뒤 식별자" 규칙(Build 제안)에 대한 의견**
- 실제로 읽히는 꼴: 출판 정보만 문장 바로 뒤가 걸러진 식별자만 문장인 경우가 CMDT 2026 **1,133곳(665쪽)**, CMDT 2021 **828곳(628쪽)**. 쪽의 3분의 1에서 "2024;332:957." 같은 숫자 줄을 한 번 이상 듣는다(speak 모드면 그 번역문까지). PMID 는 빠졌는데 제목·학술지·숫자만 남아 오히려 어색하다.
- 문맥을 보면 닫히지 않은 이유는 대개 두 가지다: (가) 단독 저자 머리가 따로 한 문장이 된다 — 예 "Woolf SH." 뒤에서 분할이 끊어, `REF_START` 가 요구하는 "머리 뒤 공백"이 같은 문장에 없다. (나) 문헌이 문단 둘로 나뉜다(같은 문단 안에서만 본다).
- 의견: 제안 규칙은 `PUB_ONLY` 가 매우 좁고(연도;권:쪽 만) 바로 뒤 식별자를 닫힘으로 요구하므로 **오탐 위험이 거의 없다** — 채택 권장. 다만 그것만으로는 숫자만 사라지고 학술지 약어(아랍어 음역 문제의 원인)는 남는다. 더 줄이려면 (가)의 "머리 꼴로 끝나는 문장(`성 이니셜.`)"도 머리로 받는 쪽이 효과가 크다 — 이것은 넓히는 변경이라 다시 오탐 검토가 필요하다.

**기록만 — ② 표 머리 "Affecting" 의 U+001F**
- CMDT 2026 에서 발화 글에 U+001F 가 남는 단위는 19개(18쪽), 모두 21~38쪽 "Key/New Advances" 표 머리 행이다. **지금 리더에서는 그 행이 `folded-lines` 로 접혀 낭독되지 않는다**(30쪽에서 확인). 그래서 지금은 들리지 않는다.
- 들리게 된다면: Chrome 계열 엔진은 C0 제어 문자를 소리 없이 건너뛰는 것이 보통이라 "A·ecting" 처럼 낱말이 깨져 읽힐 것으로 본다(실기기 미확인). `ff` 로 바꾸는 것은 그 글꼴의 사정이라(원칙 2 — 책 고유 관례) 권하지 않는다. 할 일이 있다면 낭독 사본에서 C0 제어 문자를 지우는 정도다. 지금은 조치 불필요 의견.

**기록만 — 그 밖**
- 단체 저자 인용("American Diabetes Association … Care." + PMID, 31쪽)은 PMID 만 빠지고 나머지는 읽힌다(미탐 — spec 이 예상한 범위).
- 인용뿐인 쪽 재생의 첫 발화는 쪽 이동(비동기) 뒤에 나간다. 데스크톱에서는 0.2초. Android 에서 사용자 활성화가 유지되는지 실기기 확인 필요(전권에 이런 쪽은 1819쪽 하나).
- 브라우저 패널 저장소에 시험용으로 넣은 CMDT 2026 문서가 두 오리진(`localhost:8000`, `127.0.0.1:8766`)에 남아 있다(각 약 106MB). 지우지 않았다 — 필요 없으면 운영자가 서재에서 지우면 된다. 테마·뷰·단위·인용 설정은 기본값으로 되돌렸다.

## 8h-10. 운영자 결정 필요

1. **"출판 정보만 + 바로 뒤 식별자" 규칙 채택 여부**(위 ①) — 권장: 채택(위험 작음, 2026 에서 1,133곳). 단독 저자 머리 받기는 별도 판단(넓히는 변경 → 오탐 재검토 필요).
2. **D 후속(8h-D)** — 판 섞임으로 확정. 코드 수정 없음. spec 6-6-5 권장대로 가이드 "앱을 완전히 닫았다 다시 열기" 한 줄 + 설정 화면 판 표시(`?v=` 앞 7자)를 둘지.
3. **Harrison 대립 유전자 표기 "(*0401)"**(8h-3) — 지금은 별표를 지워 "0401" 로 읽는다. "괄호·공백 뒤 별표 + 숫자"를 피연산자처럼 남길지(`∗`→`*`). CMDT 두 권에는 이 꼴이 0곳이라 영향은 Harrison 7곳뿐.

---

# 8h-2 A3 Review — 출판 정보만인 문장 + 바로 뒤 식별자 (2026-10-12)

> 지침: `.claude/tasks/medreader-review-8h-2.md`. Build 보고를 믿지 않고 다시 쟀다. 커밋하지 않았다. 진짜 API 키는 쓰지 않았다.
> 측정·덤프 스크립트는 스크래치패드 `r8h2/` 에만 있다(원서 문장은 그 안에만, 40자로 자름). 아래 원서 인용은 모두 40자 이하다.
> 비교 기준: `git archive 2fa52c8 apps/medreader/js` 를 스크래치패드에 풀어 같은 문단을 8h-2 전/후 모듈로 각각 `buildUnits` 했다(체크아웃 없음).

## 8h2-1. 결론 — **통과** (고친 것: 테스트 한 줄 · 운영자 결정 자료는 8h2-7)

- 오탐(본문을 건너뜀) **0건** — CMDT 2026 의 A3 984문장 **전수**, CMDT 2021 29문장 **전수**를 앞 문장(문단을 넘어서도)과 함께 봤다.
- 불변: A3 가 없는 문단은 세 권 전권에서 단위 JSON 이 **한 글자도** 다르지 않다. A1·A2 판정 수 그대로.
- 브라우저(CMDT 2026 50쪽, 360px): 출판 정보 줄 7곳과 그 PMID — 발화 0 · 하이라이트 0 · 번역 요청 0. 콘솔 0, 가로 스크롤 0.
- 테스트 983/983 ×3. Build 변이 2개 재현 + 새 변이 3개. **새 변이 하나(R-n1)가 살아남아** 테스트에 단언 한 줄을 더했다(8h2-6).

## 8h2-2. 수치 재측정 (`dev/measure-cite-8h.mjs` 와 내 전권 스크립트 둘 다)

| | CMDT 2026 (1,967쪽) | CMDT 2021 (5,051쪽) | Harrison (729쪽) |
|---|---|---|---|
| A3 로 새로 빠지는 문장 | **984** · 12,612자 · 599쪽 | **29** · 506자 · 28쪽 | 0 |
| 앱 큐 cite | 9,333 단위 · 308,023자(3.48%) | 12,633 · 494,044자(5.22%) | 0 |
| Review 정의(8h-9 ①) / 그중 글자가 있어 읽는 것 | 1,133 / 149 | 828 / 800 | 0 |

Build 보고와 자리까지 같다. 내 스크립트(문단마다 HEAD·작업 트리 `markReferences` 를 비교)에서도 새로 cite 가 된 문장은 정확히 984 / 29 / 0 이고, **전부 `publicationTails` 에 든 문장**이다(A3 가 아닌 판정 변화 0).

## 8h2-3. 오탐 검토 — 기준 0건, 결과 0건

**CMDT 2026 984문장 전수.** 꼴: `9;9:9.` 977 · `9;9: 9.` 4 · `9; 9:9.` 2 · `9;9:9-9.` 1. 바로 뒤는 984개 모두 식별자만(`[PMID: n]` 980 · `[PMID:n]` 3 · `[PMID n]` 1).
- 앞 문장이 같은 문단에 있는 것 **531**: 고유한 앞 문장 305가지를 전부 봤다. 학술지 약어("N Engl J Med." 37 · "JAMA." 21 · "Lancet." 18 …), "Erratum in: …", 문헌 제목 꼬리("Gene therapy with fidanacogene …"), 저자 머리가 붙은 문헌("Jeng WJ et al. Hepatitis B. Lancet.")뿐이다. 그중 2개는 앞이 이미 인용.
- 문단 첫 문장인 것 **453**: 쪽 단위로 다시 덤프해 **앞 문단의 마지막 단위**를 봤다. 역시 전부 학술지 약어(¶"N Engl J Med." 35 · ¶"JAMA." 15 …)나 문헌 제목 조각이다. 참고문헌이 학술지 약어 뒤에서 문단이 갈린 경우다.
- 문단 종류: body 982 · question 1(297쪽 "Respiration." 뒤) · list 1(1841쪽 "J Foot Ankle Surg." 뒤). 둘 다 참고문헌이다.

**CMDT 2021 29문장 전수.** 꼴은 `9;9(9):9–9.` 13 · `9;9:9–9.` 11 등. 앞은 모두 학술지 약어("JAMA." · "Lancet." · "Handb Clin Neurol." …)이고, 3178쪽 1개는 쪽 첫 단위(앞 쪽에서 이어진 문헌 — 뒤가 PMID 다음 소제목)다. 본문 0.

→ 글자가 하나도 없는 "연도;권:쪽." 이 식별자만인 문장 바로 앞에 오는 것은 두 책에서 예외 없이 참고문헌 꼬리다. 표·수치 문장이 이 꼴로 잘린 경우는 없었다.

## 8h2-4. 불변 (8h-2 전 HEAD `2fa52c8` 대비, 세 권 전권)

| | CMDT 2026 | CMDT 2021 | Harrison |
|---|---|---|---|
| 문단 | 38,749 | 30,681 | 12,044 |
| A3 가 없는 문단 → 단위 JSON 전체가 같다 | **37,795 / 37,795** (89,308단위) | **30,652 / 30,652** (94,148단위) | **12,044 / 12,044** (32,751단위) |
| A3 가 있는 문단 → `cite`·`seg` 말고 같다(`src`·줄·좌표) | 954 / 954 | 29 / 29 | — |
| 단위 수(전/후) | 94,638 / 94,638 | 94,376 / 94,376 | 32,751 / 32,751 |
| A1 판정 문장(전/후) | 3,259 / 3,259 | 3,848 / 3,848 | 0 / 0 |
| A2 묶음 · 묶음 안 문장(전/후) | 1,698 · 5,161 / 같음 | 2,864 · 8,944 / 같음 | 0 |
| cite 단위(전 → 후) | 8,352 → 9,336 (+984) | 12,610 → 12,639 (+29) | 0 → 0 |

(cite 단위 수가 측정 스크립트의 9,333 과 3 다른 것은 300자 초과로 쪼갠 조각을 내가 따로 셌기 때문이다. 차이 +984 는 같다.)
정적 점검: `splitSentences(` 호출은 `tts/text.js` 한 곳. `cite.js` 에 `document`·`window` 0. `config.js`·`ai/`·`pdf/`·`layout`·`blocks`·`segment` diff 0(algoVersion·DB_VERSION·프롬프트 불변). 바뀐 파일에 제어 문자 0. `stamp-importmap --check` "그대로다(모듈 52개)". 브라우저가 실제로 `cite.js?v=cf893548e8`·`tts/text.js?v=e2fd8e47f0` 를 받았다.

## 8h2-5. 브라우저 (이미 떠 있던 `localhost:8000` 정적 서버 — 내가 띄운 것 아님, 그대로 둠)

이전 Review 가 패널 저장소에 넣은 CMDT 2026 문서를 그대로 썼다(새로 넣지 않음). 360×740, speak 모드(기본), 인용 읽기 꺼짐(기본), 문장 단위.
`speechSynthesis.speak` 는 기록 후 40ms 에 `onend` 를 부르는 스텁, `fetch` 는 googleapis 주소만 가로채 원문 앞에 "ترجمة " 를 붙여 돌려주는 스텁. 키는 실행 중 조각을 이어 만든 가짜(sessionStorage), 끝나고 지웠다. 네트워크 기록에 googleapis 요청 **0**.

50쪽(A3 7곳 — "2021;325:971." · "2024;74:50." 등, 그중 3줄은 줄 전체가 출판 정보 + PMID)에서 처음부터 51쪽으로 넘어갈 때까지 재생:

| 확인 | 결과 |
|---|---|
| 발화 | 103발화(`en-US`·`ar-SA`). 7개 출판 정보·PMID 를 담은 발화 **0**. 글자 없는 숫자만 발화 **0** |
| 번역 요청 | 3회, 항목 121개. 7개 출판 정보·"PMID" 를 담은 항목 **0** |
| 하이라이트(`CSS.highlights.set` 을 감싸 칠한 구간을 기록) | 150구간 중 출판 정보·PMID 를 담은 구간 **0**. 줄 전체가 출판 정보+PMID 인 50:55·50:70 은 한 번도 안 칠해짐. 50:117("North Am. 2021;39:405. [PMID…]")은 앞 문장 "Emerg Med Clin North Am." 의 "North Am." 부분만 칠해짐 — 맞다 |
| 콘솔 | 오류 0 · 로그 0 |
| 360px 가로 스크롤 | `scrollWidth` = `clientWidth` |

- 알려진 미탐 그대로: 학술지 약어 문장("JAMA." · "CA Cancer J Clin." …)은 원문으로 읽고 번역문도 읽는다(spec A3 범위 밖).
- 흔적: 이 시험으로 패널(`localhost:8000`)의 `aiCache` 에 가짜 번역 약 121건, `usage` 에 호출 3회가 남았다. 패널 시험 문서에만 있는 것이라 지우지 않았다 — 필요 없으면 서재에서 문서를 지우거나 캐시를 비우면 된다. 키·설정은 되돌렸다(`localStorage` 0).

## 8h2-6. 테스트·변이

- `node --test "apps/medreader/tests/*.test.mjs"`: **983/983** 순차 3회(고치기 전), 고친 뒤 다시 순차 3회 983/983(기존 테스트에 단언만 더해 수는 그대로).
- 변이(스크래치패드 실행기: 대상 1건 확인 → 적용 → 적용 grep → 전체 테스트 → 백업 복원 → 바이트 비교, 끝에 `sha1sum -c` 일치). IM2·IM6·IM7b(해시)는 매번 함께 빨갛다 — 아래 표는 그 셋을 뺀 것.

| # | 변이 | 빨개진 테스트 |
|---|---|---|
| B-m1 (재현) | "바로 다음이 식별자" 조건 제거 | T-A3 ★ 음성(뒤가 식별자가 아님…) · T-A2 다른 문단 — Build 보고와 같음 |
| B-m2 (재현) | 낱말 글자 0 조건 제거 | T-A3 `isPublicationOnly` · T-A3 ★ 음성(In 2024·bvae033·Mar) — Build 보고와 같음 |
| **R-n1** (새) | 앞 **또는** 뒤가 식별자면 참(방향 무시) | **고치기 전: 0개 — 살아남음** → 고친 뒤 T-A3 ★ 음성 |
| R-n2 (새) | 쪽(콜론 뒤)을 선택으로 — "2024;332." 도 출판 정보 | T-A3 `isPublicationOnly` |
| R-n3 (새) | 문단 마지막 문장도 검사(뒤 문장 없음을 닫힘으로) | T-A3 ★ 음성 ×2 · T-A2 ★ 닫힘 거리 · T-A2 ★★ Stage III |

- R-n1 이 산 까닭: "식별자가 앞" 음성 테스트가 `[PMID, '2024;332:957.']` 하나뿐인데, 출판 정보가 **문단 마지막**이라 루프(`i + 1 < length`)가 그 문장을 아예 보지 않는다. 방향 조건을 지워도 결과가 같다.

## 8h2-7. 고친 것 / 기록만

**고친 것** — `tests/cite-8h.test.mjs`(8h-2 가 바꾼 파일) T-A3 ★ 음성 테스트에 단언 한 줄:
`markReferences([PMID, '2024;332:957.', 'Doses were halved.'])` → `[true, false, false]` (식별자가 앞, 뒤는 본문 — 출판 정보가 문단 끝이 아니어도 "앞" 방향은 닫힘이 아니다). 앱 코드는 바꾸지 않았다 — 코드는 spec 대로였고 테스트가 그 조건을 붙잡지 못했을 뿐이다. 앱 모듈이 그대로라 `stamp-importmap` 결과도 그대로다(`--check` 확인).

**기록만**
- `PUB_INFO` 는 권·쪽 자리에 `\p{L}` 를 허용하고 `ANY_LETTER` 가 따로 막는 2단 구조다. 꼴만 보면 넓어 보이지만 글자 0 조건과 늘 같이 쓰이므로(`isPublicationOnly` 밖에서 `PUB_INFO` 를 쓰는 곳 0) 결함은 아니다. 넓히는 안(아래)을 넣을 때 이 구조를 그대로 쓰면 된다.
- Build 보고의 "CMDT 2021 약 +800 / 2026 약 +92" 는 Review 정의(월·전자 위치·S·CD 꼴 모두) 기준의 "글자가 있어 읽는 것" 수다. 두 안 각각의 수는 아래처럼 그보다 작다.

## 8h2-8. 운영자 결정 자료 — 넓히는 두 안 (구현하지 않음)

재는 방식: 앱 분할 문장 중 **지금 cite 가 아닌** 문장이, 같은 문단의 바로 다음 문장이 A1 식별자만이고(A3 의 닫힘 그대로), 아래 한 가지만 걷어 내면 `isPublicationOnly` 가 참인 것. 다른 조건은 바꾸지 않았다.

**(가) 월 약어 허용** — `연도 (Jan|Feb|…|Dec)[ 일];…` 의 월(과 일)만 걷어 낸다.

| | CMDT 2021 | CMDT 2026 | Harrison |
|---|---|---|---|
| 새로 빠질 문장 | **686**(535쪽) — 그중 일까지 있는 것 281 | **2**(1868쪽 — 1987·2005년 옛 문헌) | 0 |

- 앞 문장: 같은 문단의 학술지 약어 꼴 510 · 문단 첫 176 · 그 밖 2(둘 다 "F1000Res." — 숫자가 든 학술지 이름).
- **표본 100(2021 무작위) 눈 검토: 100/100 참고문헌 꼬리, 본문 0.** 앞은 학술지 약어 75 · 문단 첫 19 · "Erratum in: …" 6. 꼴은 `2019 Mar;9(3):1–9.` 류, 일 있는 것 43. 2026 의 2건도 봤다(학술지 약어 뒤).
- 일을 빼고 월만 허용하면 2021 은 405 로 준다.
- **권장: 채택.** 글자는 정해진 12개 월 약어만 허용되고 나머지는 지금 A3 와 같으며(숫자·세미콜론·콜론 필수 + 바로 뒤 식별자만), 표본과 전체 분포 모두에서 참고문헌 밖의 것이 없다. 효과는 사실상 CMDT 2021 에만 있다(A3 29 → 715, Review 정의 828 의 약 86%). 일(1–2자리 숫자)도 함께 허용하는 쪽을 권한다 — A2 닫힘 `PUB_ONLY` 가 이미 같은 꼴을 받는다.

**(나) 전자 위치 `e123` 허용** — 쪽 자리(콜론 뒤)의 "e+숫자"(범위 "e38–360" 포함)만 걷어 낸다.

| | CMDT 2026 | CMDT 2021 | Harrison |
|---|---|---|---|
| 새로 빠질 문장 | **96**(90쪽) | **1** | 0 |

- 앞 문장: 학술지 약어 46 · 문단 첫 51. 꼴은 `2023;6:e2327739.` 류(`9;9:e9.` 92).
- **전수 97 눈 검토(100 이 안 되어 전부): 97/97 참고문헌 꼬리, 본문 0.** 학술지는 Cureus·PLoS One·JAMA Netw Open·BMJ·Circulation 같은 전자 쪽 번호를 쓰는 곳들이다.
- **권장: 채택.** 허용하는 글자가 콜론 바로 뒤의 소문자 `e` 하나뿐이고 그 뒤는 숫자만이라 본문 산문이 이 꼴이 될 길이 없다. 효과는 작다(2026 A3 984 → 1,080).
- 같은 이유로 `S9`(11)·`CD9`(10)·`P9`(3) 같은 꼴은 이번 숫자에 넣지 않았다. 수가 작고 글자 종류가 늘어나 따로 판단할 일이다.

두 안 모두 미탐을 줄이는 쪽이지 닫힘 조건을 바꾸지 않는다. 두 안을 다 넣어도 학술지 약어 문장은 계속 읽힌다(아랍어 음역의 주된 원인은 그대로) — 그것은 spec A3 "범위 밖" 그대로다.

# 8h-3 A3 넓힘 Review — 월 약어·일, 전자 위치 e123 (2026-10-12)

> 지침: `.claude/tasks/medreader-review-8h-3.md`. Build 보고를 믿지 않고 다시 쟀다. 커밋하지 않았다. 진짜 API 키는 쓰지 않았다(필요한 곳 없음). 브라우저는 지침대로 생략했다.
> 비교 기준: `git archive 6774f0d apps/medreader/js` 를 스크래치패드 `r8h3/head` 에 풀어(체크아웃 없음) 같은 문단을 8h-2 / 작업 트리 모듈로 각각 `markReferences`·`buildUnits` 했다. 스크립트·덤프는 스크래치패드 `r8h3/` 에만 있다. 아래 원서 인용은 모두 40자 이하다.

## 8h3-1. 결론 — **통과** (고친 것: 테스트 단언 보강 · 앱 코드는 그대로)

- 오탐(본문을 건너뜀) **0건** — 월+e 70문장 **전수**, 2021 e 1문장, 2021 월 문장 새 무작위 **100**(이전 표본과 겹침 0), 2026 **97 전수**를 앞 문장(문단 첫이면 앞 문단·앞 쪽의 마지막 문장)과 함께 봤다.
- 불변: 판정이 바뀐 문장은 세 권 854개 모두 넓힘 꼴이고 방향은 전부 "읽음 → cite"(반대 0). 바뀐 문장이 없는 문단은 단위 JSON 이 한 글자도 다르지 않다.
- 테스트 985/985 ×3(보강 전·후 각각). Build 변이 2개 재현 + 새 변이 5개 — **셋이 살아남아**(월 하나 빠짐 · 소문자 월 · "Mar5") 테스트 단언을 더했다. 하나(R-w4)는 등가 변이다.

## 8h3-2. 수치 재측정 (내 전권 대조 스크립트 `r8h3/full.mjs`)

| | CMDT 2026 (1,967쪽) | CMDT 2021 (5,051쪽) | Harrison (729쪽) |
|---|---|---|---|
| 판정이 바뀐 문장 | **97** · 1,463자 · 90쪽 | **757** · 17,797자 · 579쪽 | 0 |
| 꼴 — 월만 / e만 / 월+e / 그 밖 | 2 / 95 / 0 / **0** | 686(일 있음 281) / 1 / 70 / **0** | — |
| 방향 읽음→cite / cite→읽음 | 97 / **0** | 757 / **0** | 0 / 0 |
| `publicationTails` 에 새로 든 문장인가 | 97/97 | 757/757 | — |
| 8h-2 `isPublicationOnly` 참이던 것 / 지금 거짓인 것 | 0 / 0 | 0 / 0 | — |
| cite 단위(문단 단위 `buildUnits`, 300자 조각 포함) | 9,336 → 9,433 | 12,639 → 13,396 | 0 → 0 |

Build 보고(97 · 757, 꼴 분포, 일 있음 281, 쪽 수, 글자 수)와 자리까지 같다. 2021 의 757 ≠ 686+1 은 Build 설명대로 **월과 `e` 가 한 문장에 둘 다 있는 70문장** 때문이다 — 8h-2 Review 는 두 안을 하나씩만 걷어 재서 이 70을 어느 쪽에도 세지 않았다(내 8h2-8 수치의 한계였다).
2026 (나) 95 vs 8h-2 Review 96: 8h-2 덤프 `r8h2/c26-wide.jsonl` 에서 확인했다 — 차이 1은 1821쪽 `2021;16: e0242496.`(콜론 뒤 공백)이고, 8h-2 의 후보 식이 `:\s?e` 를 받았기 때문이다. 이번 대조에서도 "공백을 받으면 더 빠질 문장"은 2026 1 · 2021 0 · Harrison 0. 범위 끝 `e`("e38–e360") 꼴은 세 권 후보에 0.

## 8h3-3. 오탐 검토 — 기준 0건, 결과 0건

**월 + e 70문장(CMDT 2021) 전수 — 이전 Review 가 한 번도 보지 않은 것.** 꼴은 `2017 Nov 14;136(20):e348–92.` · `2019 May 3;2(5):e194585.` 류. 바로 뒤는 70개 모두 `[PMID: n]`.
- 앞 문장: 같은 문단의 학술지 약어 47(Obstet Gynecol. 16 · Circulation. 6 · Otol Neurotol. · Europace. · Clin Infect Dis. …), "Erratum in: Circulation." 류 9, 문단 첫 14(앞 문단 마지막이 ¶"Obstet Gynecol." · ¶"PLoS Negl Trop Dis." · ¶"Lancet HIV." 등 학술지 약어).
- 조각난 학술지 이름 3개(1995쪽 "Gynecol." · 3250쪽 "Open." · 3413쪽 "AIDS Soc.")는 각각 Obstet Gynecol. · JAMA Netw Open. · J Int AIDS Soc. 가 줄에서 갈린 것 — 뒤가 e 쪽 번호+PMID 라 참고문헌이다.
- 문단 종류: body 69 · question 1(4393쪽 "Erratum in: J Public Health (Oxf)." 뒤). **70/70 참고문헌 꼬리, 본문 0.**
- 같이 본 2021 e만 1문장(1085쪽 "Circulation." 뒤 `2016;133:e38–360.`)도 참고문헌.

**CMDT 2021 월 문장 — 새 무작위 100.** 월만 686 중 8h-2 표본(`r8h2/sample-mon.jsonl`)과 겹치는 100을 빼고 남은 586에서 시드 고정으로 뽑았다(겹침 0). 앞은 같은 문단의 학술지 약어 69("JAMA." · "N Engl J Med." · "Obstet Gynecol." …) · "Erratum in: …" 4 · 문단 첫 27(앞 문단 마지막이 ¶학술지 약어 26, ¶"2018 Apr 3;319(13):1386; JAMA." 1 — Erratum 목록 이어짐). 일 있는 것 41. 문단 종류 body 98 · question 2. **100/100 참고문헌 꼬리, 본문 0.**

**CMDT 2026 97문장 전수.** 꼴 `9;9:e9.` 92 · `9; 9:e9.` 2 · `9;9(9):e9.` 1 · `9 Jan;9(9):9–9.` 1 · `9 Aug;9(9):9–9.` 1(둘 다 1868쪽 1987·2005년 문헌, 뒤 `[PMID: n];`·`[PMID: n].`). 앞: 같은 문단 학술지 약어 43(Cureus. · PLoS One. · Circulation. · Stroke. · BMJ. …) · "Erratum in: …" 3 · 문단 첫 51(앞 문단 마지막이 전부 ¶학술지 약어). 문단 종류 body 97. **97/97 참고문헌 꼬리, 본문 0.**

→ 이번 넓힘이 허용한 글자(연도 바로 뒤 12개 월 약어, 콜론 바로 뒤 `e`)가 든 문장이 식별자만인 문장 바로 앞에 오는 경우는 두 책에서 예외 없이 참고문헌 꼬리다.

## 8h3-4. 불변 (8h-2 커밋 `6774f0d` 대비, 세 권 전권)

| | CMDT 2026 | CMDT 2021 | Harrison |
|---|---|---|---|
| 문단 | 38,749 | 30,681 | 12,044 |
| 바뀐 문장이 없는 문단 → 단위 JSON 전체가 같다 | **38,653 / 38,653** | **29,985 / 29,985** | **12,044 / 12,044** |
| 바뀐 문장이 있는 문단 → `cite`·`seg` 말고 같다(`src`·줄·좌표) | 96 / 96 | 696 / 696 | — |
| 쪽 단위 `buildUnits` — `cite`·`seg` 말고 같다 / 단위 수 같다 | 1,967 / 1,967 | 5,051 / 5,051 | 729 / 729 |
| 단위 수(전/후) | 94,638 / 94,638 | 94,376 / 94,376 | 32,751 / 32,751 |
| A1 판정(`citationKind`)·A2 묶음(`referenceRuns`)이 다른 문단 | 0 | 0 | 0 |

정적 점검: `cite.js` 에 `document`·`window` 0. `splitSentences(` 호출은 `js/tts/text.js:303` 한 곳. `isPublicationOnly`·`PUB_MONTH`·`PUB_ELOC` 를 쓰는 곳은 `cite.js` 안뿐. `config.js`·`ai/`·`pdf/`·`tts/`·`segment.js` diff 0(algoVersion·DB_VERSION·프롬프트 불변). 바뀐 파일에 제어 문자 0. `stamp-importmap` 다시 돌려 "그대로다(모듈 52개 · CSS 4개)" — `cite.js?v=259bcf49ea` 그대로(테스트만 고쳐서).

## 8h3-5. 테스트·변이

- `node --test "apps/medreader/tests/*.test.mjs"`: **985/985** 순차 3회(보강 전), 보강 뒤 다시 3회 985/985(기존 테스트에 단언만 더해 수 그대로).
- 변이(스크래치패드 `r8h3/mutate.mjs`: 대상 1건 확인 → 적용 → 적용 grep(모두 1) → 전체 테스트 → 백업 복원 → 바이트 비교, 매 회 같음, 끝에 작업 트리 `cite.js` sha1 = 시작 때 백업). IM2·IM6·IM7b(해시)는 매번 함께 빨갛다 — 아래 표는 그 셋을 뺀 것.

| # | 변이 | 빨개진 테스트 |
|---|---|---|
| M1 (재현) | 월 목록 → 아무 낱말(`\p{L}+`) | T-A3 `isPublicationOnly` · T-A3 ★ 음성(낱말이 섞인…) · T-A3w ★ 음성 — Build 와 같음 |
| M2 (재현) | `e` → 아무 글자(`:\p{L}(?=\d)`) | T-A3w ★ 음성 — Build 와 같음 |
| R-w1 (새) | 월 목록에서 `Jun` 하나 빠짐 | **보강 전 0 — 살아남음** → 보강 뒤 T-A3w ★ 양성 |
| R-w2 (새) | 월 대소문자 무시(`/iu`) | **보강 전 0 — 살아남음** → 보강 뒤 T-A3w ★ 음성 |
| R-w3 (새) | 월 뒤 마침표 불허 | T-A3w ★ 양성("2019 Jan. 5;…") |
| R-w4 (새) | `PUB_MONTH` 의 `^` 제거 | 0 — **등가 변이**: 맨 앞이 아닌 자리에서 걷혀도 앞 글자가 남거나 `PUB_INFO` 의 `^\d{4};` 가 다시 막는다(결과가 바뀌는 입력을 만들 수 없었다). 결함 아님 |
| R-w5 (새) | 일 앞 공백 선택(`2021 Mar5;`) | **보강 전 0 — 살아남음** → 보강 뒤 T-A3w ★ 음성 |

- 기록: 내 실행기 첫 회차는 변이 문자열을 셸 경유로 쓰다 역슬래시가 빠져 M1 이 문법 오류(모듈 로드 실패, 18파일 빨강)가 됐다. 복원 `cmp` 는 같았고, 문자열을 `String.raw` 로 고쳐 다시 돌린 위 결과가 유효하다.

## 8h3-6. 고친 것

`tests/cite-8h.test.mjs`(8h-3 이 바꾼 파일) — 단언만 더함, 앱 코드는 spec 대로라 그대로:
- T-A3w ★ 양성: 월 약어 12개 각각 `'2019 ' + m + ' 5;12(3):45–9.'` 이 참(하나가 빠지면 빨강 — R-w1).
- T-A3w ★ 음성 목록에 `'2021 mar;9(3):1-9.'` · `'2021 MAR;9(3):1-9.'`(정확한 꼴만 — R-w2) · `'2021 Mar5;9(3):1-9.'`(월과 일 사이 공백 필수 — R-w5).

## 8h3-7. 운영자 결정 자료 — `": e123"`(콜론 뒤 공백) 받을지 (구현하지 않음)

- 대상: CMDT 2026 **1문장**(1821쪽 "PLoS One." 뒤 `2021;16: e0242496.` + `[PMID: …]`) — 참고문헌 꼬리다. 2021·Harrison 0.
- **의견: 받아도 된다(낮은 우선순위).** 근거 ① A3 의 기존 꼴 `PUB_INFO` 가 이미 콜론 뒤 공백(`:\s?`)을 허용한다("2022; 17: 101–9") — 숫자 쪽은 공백을 받고 `e` 쪽만 안 받는 것은 오히려 비대칭이다. ② 공백 하나를 더해도 허용 글자는 여전히 콜론 뒤 소문자 `e` 하나이고, 문장 전체가 숫자·구두점뿐 + 바로 뒤 식별자만이라는 닫힘은 그대로라 본문이 이 꼴이 될 길은 늘지 않는다. ③ 다만 효과가 세 권 통틀어 1문장이라 급하지 않다. 받는다면 `PUB_ELOC` 를 `/:\s?e(?=\d)/u`(바꿀 글자는 `':'`)로 바꾸고, 테스트의 음성 `'2024;10: e123.'` 을 양성으로 옮기면 된다(Build M4 가 정확히 이 변이로 빨개지는 테스트다).
- 받지 않아도 손해는 1문장이 읽히는 것뿐이다 — "콜론 **바로** 뒤"라는 spec 문구를 그대로 두고 싶다면 지금 그대로가 맞다.

# 8i 행 표 Review — 표를 행 단위로 읽기 (spec 4-13) (2026-10-13)

> 지침: `.claude/tasks/medreader-review-8i.md`. Build 보고를 믿지 않고 다시 쟀다. 커밋하지 않았다. 진짜 API 키는 쓰지 않았다(설정에 넣은 키는 실행 중 조각을 이어 만든 가짜, Gemini 요청은 가로채 흉내 응답). 원서 인용은 모두 40자 이하.
> 비교 기준: `git archive HEAD apps/medreader/js` 를 스크래치패드 `r8i/old` 에 풀었다(체크아웃 없음). 스크립트·덤프·로그는 스크래치패드 `r8i/`, 캡처는 `shots-8i/`. 브라우저 프로필은 `shot-profile/` 을 **복사한** `r8i/profile` 을 썼다(원본 프로필은 algoVersion 10 그대로 남아 있다).

## 8i-1. 결론 — **통과(고친 것 2 · 테스트 보강 4)**, 운영자 결정 1건

- Build 수치를 다시 재서 전부 같았다: CMDT 2026 행 표 쪽 = 21–38(18쪽) · 띠 26(R7 6) · 이름표 문단 132 · 쪽 번호 칸 159 · 괘선 대조 834 중 823(98.7%) · 행 표 없는 쪽 옛·새 JSON 같음 **1,949 + 729 + 5,051, 다름 0** · 행 표 쪽 아이템 잃음 0/늘어남 0 · 21–38 낭독 단위 794(정수만 0 · 쪽 번호 줄 든 단위 0). CMDT 2021·Harrison 행 표 0.
- 눈 검토에서 **8i 가 만든 결함 2개**를 찾아 고쳤다(8i-6): 31쪽 장 제목 "CHAPTER 34…"이 그 장의 첫 행·쪽 꼬리 줄 **뒤에** 읽힘(읽기 순서), 표 안에 든 짧은 장 제목("CHAPTER 44: CANCER" 35쪽, "TURNER SYNDROME" 30쪽)이 heading → body 로 내려앉음(화면·8g 목차). 둘 다 행 표 쪽 안에서만 바뀐다(잡히지 않은 쪽 바이트 동일 재확인).
- 브라우저: 판 바뀜 → **자동 재추출**(안내 배너, [텍스트 다시 추출] 불필요), 사용자 데이터 유지, 30쪽 행 단위·쪽 번호 무낭독·하이라이트 정상. 다만 **지금 보고 있는 쪽은 저장본이 새로 써져도 화면이 옛 판 그대로 남는다**(다른 쪽에 갔다 와야 바뀜) — 8i 이전부터 있던 리더 동작이지만 8i 재추출에서 운영자가 바로 겪는 경로라 8i-8 에 결정 사항으로 올린다.

## 8i-2. Build 가 다르게 한 8곳 — 판정

| # | 내용 | 판정 | 근거 |
|---|---|---|---|
| 1 | `EDGE_ZONE` 0(시제품 0.06) | **타당** | 0.06 이면 33·34쪽 표 첫 내용 줄이 표 밖에 남아 표를 다 읽은 뒤 읽힌다. 0 이어도 머리말·꼬리말·회전은 역할로 빠지고, 쪽 자체 번호는 띠 맨 위·아래 pageno 제외로 빠진다. 부작용: 행 표 없는 쪽은 7b 가 입력을 그대로 돌려주므로 영향 0(바이트 비교). 쪽 아래 "YRx"(로고 겸 쪽 번호, y≈53)는 0.06 이어도 컷(43) 밖이라 이 값과 무관. **테스트가 없었다** — 변이 N3(0.06 으로)이 살아남아 RT18 을 더했다 |
| 2 | 열 머리 60자를 조각마다 · P 칸 조각이 섞이면 열 머리 아님 | **타당** | 21쪽 "Topic"+열 이름 = 62자. 18쪽 모두 열 머리가 접혔다(이웃 쪽이 있으면 22–38쪽은 4-7 이 header 로 먼저 빼고, 그때도 접힘 묶음에 들어간다). 위 정렬 표의 첫 행을 먹지 않는 조건도 맞다. **테스트가 없었다** — 변이 N4(행 합으로)가 살아남아 RT19 를 더했다 |
| 3 | R7 열을 경계 번호 k 로 | 타당 | 빈 열이 걸러져도 같은 열. 21–38 결과 동일(26띠·6물려받음) |
| 4 | `rt` 에 k · cell S/H/X · col rS/rX | 타당 | k 가 없으면 한 행 안 두 소행(P 칸)의 문단 경계를 지킬 수 없다(RT1). 저장·복원 확인(RT11), `storeVersion` 1 그대로가 맞다(필드 추가뿐) |
| 5 | 홀로 선 A 칸은 rowhead 아님 | 타당 — **보완함** | 내용이 없는 칸을 굵은 이름표로 보이지 않게 한 것은 맞다. 다만 role 을 무조건 body 로 만들어 7단계 heading(장 제목)이 body 로 내려앉았다 → 8i-6 F2 |
| 6 | R3 (b) 허용폭 = 0.25×띠 글자 크기 | 타당 | 책 고유 절댓값 제거. 결과 같음 |
| 7 | 정렬 모형을 띠마다 | 타당(부작용 없음) | 21–38쪽 26띠 전부 `mid`(진단 훅으로 확인). 한 행짜리 띠는 닻이 하나라 위/가운데가 같은 결과를 낸다 |
| 8 | `buildPageLayout` 4번째 인자·`rowTableProbe` | 타당 | 앱 호출부(`extract.js`)는 3인자 그대로, 훅은 함수일 때만 불리고 출력·저장에 안 들어간다 |

## 8i-3. 21–38쪽 눈 검토 (앱과 같은 경로: 이웃 저장본 2회차 → `toStored`·`fromStored` → `describePage` → `buildUnits`)

쪽마다 문단(kind · rt · 40자) 목록 `r8i/eye-final.txt`(514줄)를 전부 보고, 괘선(연산자 목록)을 정답으로 **이름표 글자 단위**로 다시 대조했다(`r8i/scripts/rules-detail.mjs` — Build 의 행 번호 대조와 다른 방법).

| 항목 | 기준 | 결과 |
|---|---|---|
| 이름표와 내용이 다른 행과 엇갈림 | 0 | **1** — 29쪽 "Mood Disorders (Depression & Mania)"와 다음 이름표 "Obsessive-…"가 한 칸으로 붙음(이름표 사이 틈이 칸 간격보다 작다). OCD 행 내용 3줄이 붙은 이름표 뒤에 읽힌다 — 순서·글자 손실은 없다. spec 4-13-2 의 "29쪽 이름표 두 개가 한 칸" 그대로(지침의 알려진 흠 목록에는 없어 따로 센다) |
| 내용 빠짐·두 번 | 0 | **0** — 아이템 다중 집합 잃음 0·늘어남 0, 두 문단에 든 줄 0 |
| 쪽 번호가 낭독에 남음 | 0 | **0** — 정수만 단위 0, 그 쪽 쪽 번호 숫자가 든 단위 0, pageno 줄이 든 단위 0 |
| 읽기 순서 어긋남(위 셋 밖) | — | 31쪽 "CHAPTER 34…" 1 → **고침**(8i-6 F1) |
| 원본 하이라이트 상자가 쪽 번호 줄을 덮음 | 0 | **0** / 상자 1,468(`highlightBox` 전수) |

알려진 흠(따로 셈): 두 줄 장 제목 둘째 줄 **2**(22쪽 "IN CARDIOLOGY"가 다음 이름표 앞에 붙음 — 괘선 대조 6줄 어긋남의 전부, 30쪽 "TURNER SYNDROME" 홀로 선 행) · 쪽 아래 "YRx" **18쪽 전부** 읽힘(짝수 쪽 8은 마지막 행 내용 끝에, 홀수 쪽은 각주 행 끝에 — 괘선 대조 8줄) · "∗See chapter…" 각주 **18쪽 전부** 읽힘(홀수 쪽 9개는 "(continued on following page)"와 짝지어 rowhead 로 굵게, 짝수 쪽 8은 body, 38쪽은 구획 heading).
그 밖 기록(8i 무관, 8i 전과 같음): 21쪽 왼쪽 위 "Topic"(제목 옆 탭 글자)이 heading 으로 읽힘 · 열 머리 글자에 U+001F(ff 합자 "A?ecting") — 접힌 줄에만 보인다.

## 8i-4. 브라우저 (로컬 정적 서버 :8000 · headless Edge · 360·412px · 가짜 키)

서버: 시작할 때 :8000 에 이미 레포 루트를 내보내는 서버가 떠 있어(PID 36964 — 내가 띄우지 않음) 그것을 썼고, 내 것이 아니라 끄지 않았다.

**주의 — 프로필의 HTTP 캐시**: 처음 연 실행은 앱이 **algoVersion 10 코드**로 돌아 재추출이 일어나지 않았다(동적 import 로 확인: `algoVersion 10`). 프로필 캐시에 남은 옛 `index.html`(옛 import map)을 휴리스틱 신선도로 쓴 것이다. 캐시를 끄고(`setCacheEnabled(false)`) 다시 했다. GitHub Pages(`max-age=600`)에서는 배포 뒤 최대 약 10분 옛 앱이 뜰 수 있다는 뜻 — 옛 앱은 옛 판으로 읽을 뿐 데이터를 망치지 않는다(새 앱이 뜨면 재추출).

**(a) 판 바뀜 → 재추출 경로** (`r8i/b-a.log`)
- 연 직후: `extraction.algoVersion 10 · done` → 30쪽을 열자 배너 "텍스트 엔진이 갱신되어 이 문서를 다시 준비하고 있습니다." + 진행 막대 "Preparing text n/1,967". **자동 재추출 — [텍스트 다시 추출] 불필요.**
- 30쪽 저장본은 **3.3초** 만에 11 로 다시 써졌다(우선순위 0). **그러나 화면은 옛 판("& Pseudo- 1130" 줄)에 그대로** — `onPage` 가 `!state.desc` 일 때만 다시 그린다(`reader.js` `wireExtractor`, 8i 이전 코드). 31쪽 갔다 오자 rowhead 6 · `rt-ref` 6 으로 바뀌었다(캡처 `a1-…`, `a2-…`). 이 상태에서 재생을 누르면 옛 판 문장(쪽 번호 섞인)이 읽힌다 → 8i-8.
- 사용자 데이터: `lastPage 30 → 30` · `lastLineId` 그대로 · 원문 언어 `en/auto → en/auto` · 번역 캐시(`aiCache`) **85 → 85**. 재추출 뒤 30쪽 `rt` 줄 64.
- 콘솔 오류: `/favicon.ico` 404 하나(로컬 서버 루트 — 앱 무관).

**(b) 30쪽 리플로우** (`r8i/b-bcd2.out`)
- `rowhead` 6개: 굵기 700 · 위 구분선 `1px solid`(토큰 `--c-border`) · 끝 `span.rt-ref` 16.5px(부모 22px의 0.75) · 회색 · 굵기 400 · **`.line` 아님·`data-line-id` 없음** · 글자 "1106" "1130" "1138 · 1139" "1143" "1142" "1155". 열 머리는 접힌 줄 묶음("Headers, footers, and page numbers" 안 "Topic Page Number Key…").
- 낭독(흉내 음성, 30쪽 처음부터 쪽 끝까지): 원문 발화 27 — 이름표 한 덩어리 → 그 행 내용 순서, 장 제목·홀로 선 행은 제자리. 하이라이트(CSS Highlight 범위)가 **행 순서로** 움직였다(30:1–2 이름표 → 30:4–5 내용 → 30:8 장 제목 → 30:9–11 이름표 …). 정수만 발화 0 · 쪽 번호 섞인 발화 0 · **인용 발화 0**(8h 건너뛰기 유지).
- 번역 요청 항목 35: 정수만 0 · 쪽 번호 섞임 0 · 이름표 6개가 각각 **한 항목**("Hypoparathyroidism & Pseudo-hypoparathyroidism" 등). 띠는 이름표 발화 때 주제 한 덩어리의 번역을 보였다(캡처 `b2-p30-reflow-band-rowhead.png`).
- 가로 넘침: 360·412px 모두 0(문서·본문·넘치는 요소 0).

**(c) 30쪽 원본 보기** — 발화를 붙잡고 상자에 테두리를 그려 찍었다(`c2-hold-rowhead-osteo.png` · `c3-hold-content-osteo.png` · `c4-hold-rowhead-hypopara.png`). 이름표 상자는 이름표 줄만 덮고("& Pseudo-" 상자가 1130 칸에 닿지 않는다 — 8i 전의 넓은 상자 사라짐), 내용 상자는 내용 줄만, **쪽 번호 칸에는 상자 0**. 원본 보기 가로 넘침 360·412px 0. (흉내 음성의 짧은 발화 동안 잡은 상자 좌표는 이동 애니메이션 중이라 버렸다 — 판정은 붙잡은 캡처와 `highlightBox` 전수 0 으로.)

**(d) 회귀** — 300쪽(표 없음): 문단 28 · rowhead 0 · `rt-ref` 0, 낭독 정상, 360·412px 가로 넘침 0. 8h 인용 건너뛰기 유지(위 (b)). 콘솔 오류는 favicon 404 하나뿐.

캡처(`shots-8i/`): `a1-p30-open-after-version-bump`(옛 판 화면) · `a2-p30-after-reextract`(배너 + 행 단위) · `b0-p30-reflow-360/412` · `b2-p30-reflow-band-rowhead`(리플로우 낭독 중 — 이름표 하이라이트 + 띠) · `c1-p30-original-reading-rowhead`(원본 낭독 중) · `c2`–`c4`(상자 테두리) · `d1-p300-reflow`.

## 8i-5. 재추출 시간

| | 시간 | 비고 |
|---|---|---|
| 데스크톱 Node(getTextContent + 레이아웃, DB 없음) | CMDT 2026 28.7초 · CMDT 2021 28.7초(5,051쪽) · Harrison 7.9초 | 레이아웃 ms/쪽 8i 전→후: 0.86→1.22 · 0.20→0.28 · 0.62→0.89 (Build 와 같다) |
| **데스크톱 브라우저(headless Edge, 리더 30쪽 열어 둔 채, 낭독 없음)** | **CMDT 2026 1,967쪽 74.8초**(38 ms/쪽, DB 쓰기 포함) · 지금 쪽 3.3초 | 14초 358쪽 · 34초 903쪽 |

폰 추정(데스크톱 브라우저 × 3–5 `[추정]`): CMDT 2026 **약 4–6분** · CMDT 2021 약 4–6분(Node 시간이 2026 과 같고 쪽 수만 많다 — DB 쓰기만큼 더) · Harrison 약 1–2분 → **세 권 합 약 10–14분**(spec 4-13-7 의 "5–8분 + DB 쓰기"보다 길다). 백그라운드·지금 쪽 우선이라 읽기는 바로 되지만, **낭독 중에는 우선순위 2 가 초당 1쪽**(`SPEAKING_PAGE_MS`)이라 계속 듣고 있으면 5,051쪽 책은 한 시간 넘게 걸린다(지금 쪽 ±5 는 우선이라 읽는 자리는 늘 새 판).

## 8i-6. 고친 것 (8i 가 만든 파일만)

- **F1 `js/text/rowtable.js` — 두 행 표 띠 사이 줄의 자리.** 7b 경계(`ROWTABLE.SPAN_RATIO` 0.55W)는 넘지만 4-5 의 span(`SPAN_WIDTH_RATIO` 0.6W)에는 못 미치는 장 제목은 4-5 가 오른쪽 단(col 1)에 넣어 읽기 순서 배열의 뒤쪽에 놓인다. 7b 는 띠를 첫 줄 자리에 끼우고 나머지 줄은 제자리에 두므로, 31쪽 "CHAPTER 34: NUTRITION…"(폭 297 / W 517)이 그 장의 첫 행 "Obesity"·각주·"YRxi" **뒤**에 읽혔다(8i 전에는 내용 단 안에서 제자리였다 — 8i 회귀). 이웃한 두 행 표 띠 사이(세로)에 있는 줄(머리말·꼬리말·회전·pageno 제외)을 **아래 띠 바로 앞**으로 옮긴다. 21–38쪽에서 바뀐 것은 31쪽 그 한 줄뿐(다른 쪽 장 제목은 이미 제자리 — 덤프 diff).
- **F2 같은 파일 — 홀로 선 이름표 칸의 역할.** 옆에 내용이 없는 A 칸은 7단계 역할이 heading 이면 heading 으로 둔다(내용이 있는 A 칸은 그대로 body → rowhead, D6 불변). 35쪽 "CHAPTER 44: CANCER"·30쪽 "TURNER SYNDROME"이 8i 전처럼 heading. "∗See chapter…" 홀로 선 각주는 원래 body 라 그대로.
- 재측정(고친 뒤): 세 권 수치 8i-1 과 같음(행 표 없는 쪽 다름 0 · 아이템 잃음 0). `stamp-importmap` 다시 찍음(모듈 53 · CSS 4, `--check` 0).
- **`tests/rowtable-8i.test.mjs` +4**: RT16(F1 — 0.55W<폭≤0.6W 장 제목이 두 띠 사이에서 읽힌다) · RT17(F2) · RT18(EDGE_ZONE 0 고정 — 쪽 위 6% 안의 표 첫 내용 줄) · RT19(열 머리 상한은 조각마다 — 합 62자). RT16·17 은 Build 코드 사본에서 빨갛고, RT18·19 는 Build 코드에서 초록(Build 의 결정을 고정).

## 8i-7. 테스트·변이

- 전체 `node --test`: 고치기 전 **1004/1004 × 순차 3 + 동시 2**, 고친 뒤 **1008/1008 × 순차 3 + 동시 2**. `stamp-importmap --check` 0.
- 변이(`r8i/scripts/mutate.mjs`: 대상 1건 확인 → 적용 → `grep -F` 1건 → 전체 테스트 → 스크래치패드 `r8i/bak2` 에서 복원 → `cmp` 같음, 매 회). IM2·IM6·IM7b(import map 해시)는 매번 함께 빨갛다 — 아래는 그 셋을 뺀 것.

| # | 변이 | 빨개진 테스트 |
|---|---|---|
| M1 (재현) | 조건 (c) 제거 | RT8 — Build 와 같음 |
| M7 (재현) | `describePage` ref 제외 제거 | RT12 · RT14 — 같음 |
| M11 (재현) | R7 물려받기 끔 | RT14 · RT16 — 같음(+새 RT16) |
| N1 (새) | R7 (e) `INH_CROSS` 0.3 → 1.0 | RT15 |
| N2 (새) | 쪽 번호 줄 role `ref` → `body`(낭독에 포함) | RT1 · RT12 · RT14 |
| N3 (새) | `EDGE_ZONE` 0 → 0.06 | **보강 전 0 — 살아남음** → RT18 |
| N4 (새) | 열 머리 상한을 행 합으로 | **보강 전 0 — 살아남음** → RT19 |
| F1 (새) | 이번에 고친 F1 끔 | RT16 |
| F2 (새) | 이번에 고친 F2 끔(늘 body) | RT17 |

## 8i-8. 운영자 결정 필요 사항

1. **[권장: 고침 — 별도 작은 Build] 재추출 중 "지금 보는 쪽"이 옛 판으로 남는다.** 판이 오른 뒤 앱을 열면 마지막 쪽(Nour 는 30쪽)이 **옛 저장본으로 먼저 그려지고**, 3초 뒤 새 판이 저장돼도 화면·낭독 큐가 그대로다 — 재생을 누르면 고치려던 바로 그 읽기("& Pseudo- 1130")를 듣는다. 다른 쪽에 갔다 오면 바뀐다. 8i 이전부터 있던 리더 동작(`onPage` 는 자리표시자일 때만 다시 그림)이라 이번 Review 에서 고치지 않았다(낭독 중 다시 그리기와 큐 교체가 얽힌다). 안: (가) 지금 쪽 저장본의 `algoVersion` 이 최신보다 낮으면 새 판이 저장될 때 **낭독 중이 아닐 때만** 다시 그린다 · (나) 옛 판 쪽은 "준비 중"으로 보이고 기다린다 · (다) 그대로 두고 운영자 가이드에 "업데이트 뒤 쪽을 한 번 넘겼다 오세요"라고 적는다. 권장 (가).
2. (기록) 폰 재추출 추정이 spec 의 5–8분보다 긴 **10–14분**(세 권), 낭독하면서 기다리면 훨씬 길다 — 안내 문구를 바꿀지는 운영자 판단.
3. (기록 — 결정 불요) 29쪽 붙은 이름표 1행, "∗See chapter…" 각주의 굵은 이름표화 9개는 spec 기록대로 남긴다. 8i-2(본문 2열 표) 때 이름표 사이 틈 판정을 다시 보면 같이 풀릴 수 있다.

# 8i-1 Review — 재추출 중 "지금 보고 있는 쪽"을 새 판으로 (spec 4-13-9) · 8i-1b · 8i-1c (2026-10-15)

> 지침: `.claude/tasks/medreader-review-8i-1.md`. Build 보고(`.claude/tasks/medreader-build-8i-1-report.md` 1–7절)를 믿지 않고 다시 쟀다. 커밋하지 않았다. 앱 코드는 고치지 않았다(변이는 되돌리고 `cmp` 로 확인). 진짜 API 키 없음(이 경로는 AI 를 부르지 않는다). 원서 인용은 모두 40자 이하.
> 작업 폴더: 스크래치패드 `r8i1/`(백업 `bak/` · HEAD 판 파일 `head/` · 변이 출력 `mut/` · 스크립트 `scripts/` · 로그 `rv-*.log`), 캡처 `shots-8i1/`(기존 `shots-8i/` 와 같은 자리 — 스크래치패드). 8000번 서버(PID 34392)는 그대로 쓰고 끄지 않았다.

## 8i1R-1. 결론 — **통과**(차단 문제 없음) · 테스트 보강 권장(낮음) · 운영자 결정 1건(8i-1 이전부터 있던 문제)

- spec 4-13-9 "8i-1" 줄의 여섯 요구를 브라우저와 코드로 모두 확인했다(8i1R-2). 리플로우 B·원본 C2 를 내 스크립트로 다시 돌려 **첫 발화 "Thyroid Nodules & Multinodular Goiter" 한 덩어리 · "& Pseudo- 1130" 든 발화 0 · 같은 문장 연속(멈춤→재생 제외) 0 · 원본 상자가 쪽 번호 칸에 닿지 않음**.
- 8i-1c 의 `refreshing`/`pageFresh` 는 모든 갈래(db 오류·저장본 없음·깨진 저장본·버려진 렌더·`leaveReader`·`finally`)에서 내려간다 — 남는 길을 찾지 못했다(8i1R-4).
- 내 변이 6개는 **모두 살아남았다**(해시 테스트 3개만 빨강). 둘(R1·R2)은 사실상 같은 동작이라 문제없지만, **배선 둘(R3 추출 `page` → 문지기, R4 speaker 상태 → 문지기)은 단위 테스트가 묶지 않는다** — 낭독 중 미룸(R4)은 Build 8i-1b C 의 headless 한 번으로만 확인돼 있다(8i1R-5).
- Build 보고 7-6 ① **"원본 보기 평소 쪽 넘김에서 다음 쪽 첫 문장을 두 번 읽음"은 headless 로 재현했고, 8i-1 이전(HEAD) 코드에서도 똑같이 난다**. 코드로는 6b(`f3f6f8c`)부터다 → 8i1R-8 운영자 결정.

## 8i1R-2. spec 대로인가 (브라우저: Edge headless · 412px · 캐시 끔 · 흉내 음성 · `shot-profile/Default` 복사본)

| 요구 | 결과 | 근거 |
|---|---|---|
| 지금 쪽 새 판 저장 → 낭독 중 아니면 다시 그림 | ✔ | B: 497 ms 본문 교체(이름표 6, "Pseudo- 1130" 줄 0) · C2: canvas 568 ms 새 layout |
| 낭독 중이면 멈출 때까지 미룸 | ✔(코드·Build headless) | 내 실행에서는 역할 재계산 저장이 낭독 전에 와서 이 갈래가 안 돌았다. C2 canvas 다시 그림 3회 모두 tts `null`/`waiting-page` — **낭독 중 다시 그림 0**. 미룸 자체는 RF3·RF17(+Build V1) 과 8i-1b C(멈춤 5966 ms → 5993 ms 다시 그림) |
| 다른 쪽·다른 문서 저장엔 무반응 | ✔ | RF4 + Build V2. 평소 쪽 넘김 실행(8i1R-6)에서 31–40쪽 발화 수가 HEAD 와 쪽마다 같음(34·25·27·23·32·28·29·19·39·47) |
| 옛 판 쪽에서 재생 → 옛 읽기 없이 새 판을 기다려 시작 | ✔ | B: 20 ms 재생 → `waiting-page`, 바 "Preparing text…", 발화 0 → 631 ms 첫 발화. C2: 12 ms 재생 → 같은 대기 → 819 ms 첫 발화. 캡처 `b1-…old-waiting`(옛 판 "& Pseudo- 1130" 이 보이는 채 대기) · `b2-…new-first-utterance` |
| 스크롤·선택 줄 유지 | ✔ | **리플로우**(600쪽, 옛 판 10 → 11): 가운데 줄 `600:45` 화면 높이 388 → 다시 그린 뒤 같은 줄 388(차 0, `scrollY` 2288 → 2399 로 따라감). **원본**(1200쪽, 2단 확대 후 `.original-scroll` 가운데로): scrollTop 108 → 108 · scrollLeft 109 → 109 · 배율 그대로(`rv-scroll*.log` — 원본은 다시 그리기가 너무 빨라 하네스에서 그 쪽 `page` 알림만 붙잡았다 풀었다. 앱 코드 무변경). 선택 줄(`lastTappedLineId`)은 `remapLineId` 로 옮김(RF10·RF11·RF15 — 브라우저에서는 옛 판 쪽 줄 탭이 재생으로 이어지지 않아 따로 보지 않음) |
| 원본 보기도 같음 | ✔ | C2 멈춘 자리 상자 3개 = 줄 `30:9·30:10·30:11`(모두 새 저장본에 있음, 그려진 상자 3). PDF 좌표 `highlightBox` 로 계산해 쪽 번호 칸 "1130" 상자와 **교차 0, 간격 24.7 pt**. 캡처 `c2-p30-original-paused-box.png`(빨간 테두리) |

원본 상자 판정은 Build 와 다르게 했다 — 화면 px 와 bbox×배율을 섞지 않고, 앱과 같은 `render.highlightBox` 로 두 상자를 같은 PDF 좌표에서 비교했다(그려지는 상자는 `narrowBox` 로 이보다 좁아질 뿐이다).

## 8i1R-3. 불변

- **평소 쪽 넘김·낭독**: 8i1R-6 의 원본 보기 10쪽 넘김을 지금 코드와 HEAD 코드(같은 출처에서 8i-1 파일 6개만 HEAD 로 가로채 내보냄)로 각각 돌렸다 — 쪽마다 발화 수·첫 발화가 같다. 리플로우 B 의 30 → 31쪽 넘김 정상(31쪽 첫 발화 "CHAPTER 32: DIABETES MELLITUS & HYPOGLY…").
- **8h 인용 건너뛰기**: B·C2 30쪽 발화 26(+멈춤→재생 1) — 8i Review 와 같은 수, 인용 줄("Dhanasekaran M et al. …") 발화 0.
- **8i 행 표**: 이름표 한 덩어리 · "1130" 든 발화 0 · 정수만 발화 0.
- **멈춤 → 재생은 그 문장 처음부터**(기존): C2 의 유일한 같은 문장 연속 = 멈춤 직후 "Hypoparathyroidism & Pseudo-hypoparathy…" 1건.
- **뷰 전환·원문 언어 변경 시 `reload()`**: `onPageRender` 첫 구독자 그대로(`syncSourceVoice` → `reload`), 8i-1 은 둘째 구독자(`refreshed` 일 때 `reshow`)만 더했다. 기존 W2 등 전체 테스트 초록.

## 8i1R-4. 코드 검토

| # | 본 것 | 판정 |
|---|---|---|
| 1 | `renderToken`·`refreshing` 엇갈림: 다시 그리기 R1 중 평소 렌더 R2(쪽 이동·뷰 전환)가 끼면 R2 가 저장본 읽은 동기 구간에서 0 으로 내리고, R1 의 `finally` 는 token 이 밀려 손대지 않는다. 반대(평소 → 다시 그리기)는 다시 그리기가 시작 때 세운다. 겹친 다시 그리기 둘은 RF22 | 문제 없음 |
| 2 | 예외 갈래: db 오류(마지막 렌더일 때만 0) · 저장본 없음(0) · 깨진 저장본(stale·refreshing 0) · `paintView` 예외(`finally`) · `leaveReader`(0) | 남는 길 없음. db 오류 때 `stale` 은 앞 값(옛 판이면 참)이 남는다 → 재생은 다시 20초 기다린 뒤 멈춤 — 옛 읽기는 안 냄, 다음 저장 알림에 다시 그림. 맞는 동작 |
| 3 | `freshGen`: 대기 중 멈춤·정지는 `cancelSynth` 가 세대를 올려 물러남(RF14). 대기 중 재생 다시 누름은 무시 | 문제 없음 |
| 4 | 20초 상한 뒤: `'paused'`, `stale` 그대로·문지기 따라가기 유지 → 뒤늦은 저장에 다시 그리고 `reshow` | 문제 없음 |
| 5 | 문지기 구독 누수(`leaveReader` 뒤): 문지기는 모듈 하나, `left()` 로 끊김. 화면 전환이 `leaveReader` 보다 먼저 리더를 숨겨(`router.js` `showScreen` → `onRoute`) 미뤄 둔 다시 그리기는 `refreshCurrentPage` 의 `hidden` 검사에서 멈춘다 | 새 누수 없음. **(기록, 8i-1 이전부터)** 추출기 `page` 리스너는 문서가 바뀔 때만 떼므로, 서재에 나가 있는 동안 떠난 쪽이 저장되면 `!state.desc` 갈래가 숨은 리더에 그 쪽을 그린다(재추출 때는 반드시 한 번). 8i-1 이 더한 `refreshGate.shown` 재무장은 다음 렌더가 덮어 해 없음 |
| 6 | 대기 중 사용자가 다른 쪽으로 감 → `whenCurrentPageReady` false → `'paused'`(다시 눌러야 함) | 받아들일 만함(기록) |
| 7 | 안드로이드: 대기 뒤 첫 `speak()` 가 탭 이벤트 밖(8i-1 보고 5절 (a)) | 낮음 — Chrome 의 발화 제한은 페이지가 한 번이라도 사용자 활성화를 받았는지(sticky)를 보는 것으로 알고 있고 방금 재생을 탭했으니 통과할 것으로 본다 `[추정]`. 막혀도 `TTS_NOT_ALLOWED` 배너로 간다(8h-1 "인용만 있는 쪽" 경로와 같은 모양). **실기기 확인 1회 권장** |
| 8 | (기록, 8i-1 이전부터 — 코드로만, 재현 0/29) 쪽 넘김 대기 폴링 `goToPageForSpeech` 는 `state.page` 가 바뀐 뒤 새 쪽 저장본을 읽는(`db.get`) 사이에 **앞 쪽 `desc`** 를 보고 풀릴 수 있다 → 앞 쪽 첫 문장을 새 쪽에서 잠깐 말하고 `reload()` 가 끊는다. 창이 db 읽기 시간뿐이라 이번 29번 넘김에서 0 | 8i1R-8 과 같은 고침으로 함께 사라진다 |

## 8i1R-5. 테스트의 힘 · 변이

- RF1–RF18 은 순수 부분(판정·문지기·줄 대응)과 실제 speaker 를 잇는 흉내로 동작을 묶는다. RF20–22 의 흉내 리더는 실제 `renderPage` 와 순서가 같은지 RF23 이 소스 문자열 순서로 묶는다 — 다만 RF23 은 **문자열 첫 출현 위치**만 본다(같은 줄을 다른 갈래로 옮겨도 순서만 맞으면 통과). 흉내와 실제가 어긋날 여지는 남는다(아래 R5·R6 이 살아남은 것도 같은 이유).
- 내 변이(`r8i1/scripts/mutate.mjs`: 정확히 1회 일치 → `grep MUT-Rn` 1건 → 전체 테스트 → `r8i1/bak/` 에서 복원 → `cmp` 같음, 6개 모두). 해시 테스트 IM2·IM6·IM7b 는 매번 빨강이라 뺐다.

| # | 변이(Build 가 안 한 곳) | 빨개진 테스트 | 판정 |
|---|---|---|---|
| R1 | speaker `play()` 의 `if (waitingFresh()) return;` 제거(대기 중 재생 탭) | 0 — 살아남음 | 같은 동작에 가깝다: 두 번째 `waitFresh` 가 `cancelSynth` 로 세대를 올려 첫 기다림이 물러난다 |
| R2 | speaker `waitFresh` 의 `rebuildNext = true` 제거 | 0 — 살아남음 | 같은 동작에 가깝다: `refreshed` 의 `reload()` 가 이미 큐를 새 판으로 갈았다 |
| R3 | reader 추출 `page` 이벤트 → `refreshGate.saved` 배선 제거 | 0 — **살아남음** | 배선이 단위 테스트에 없다(headless B·C2 만이 잡는다 — 이 배선이 없으면 화면이 옛 판에 남고 재생이 20초 뒤 멈춤) |
| R4 | controls `statechange` → `setSpeechState` 배선 제거 | 0 — **살아남음** | **낭독 중 미룸이 앱에서 꺼져도 테스트가 초록**(문지기는 늘 "낭독 아님"으로 본다 → 낭독 중 다시 그림 → `reload()` 가 읽던 문장을 처음부터) |
| R5 | `renderPage` 저장본 없음 갈래의 `refreshing = 0` 제거 | 0 — 살아남음 | 영향 작음(다시 그리기는 저장 알림에서 오므로 저장본이 없을 일이 드묾, 다음 평소 렌더가 내림) |
| R6 | `leaveReader` 의 `refreshing = 0` 제거 | 0 — 살아남음 | 영향 작음(다시 들어올 때 평소 렌더가 내림) |

→ **권장(낮음, 다음 Build 에 얹기)**: RF23 처럼 소스로 배선 둘을 묶는 테스트 — `wireExtractor` 의 `onPage` 가 `refreshGate.saved(` 를 부르고, controls 의 `statechange` 구독자가 `setSpeechState(` 를 부른다.

- 전체 `node --test apps/medreader/tests/*.test.mjs` **1031/1031 × 3회**(변이 전 1 + 끝 2). `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 53개 · CSS 4개)", 종료 0. 끝에 `reader.js`·`controls.js`·`speaker.js` 가 내 백업과 `cmp` 같음.

## 8i1R-6. Build 7-6 ① "원본 보기 평소 쪽 넘김 첫 문장 두 번" — **재현됨, 8i-1 이전부터**

`r8i1/scripts/rv.mjs TURN`: 원본 보기, 이미 새 판(11)인 쪽에서 재생 → 흉내 음성(발화 150 ms)으로 10쪽 넘김. 쪽마다 "첫 발화 − 그 쪽 canvas 다 그린 시각", 끊긴 발화(`cancel` 때 말하던 것), 같은 문장 연속을 쟀다.

| 실행 | 결과 |
|---|---|
| 지금 코드 · 31→41쪽 | **32쪽**(두 번 돌려 두 번 다): 첫 발화가 그 쪽 canvas 완료보다 **616 · 761 ms 앞섬**(무거운 쪽이라 그리기가 폴링 틱보다 늦다) → `notifyPage` 의 `reload()` 가 그때 말하던 문장을 끊고 처음부터("link antiviral-tecovirimat-sa…" 연달아 2번). 나머지 8쪽은 canvas 가 폴링 전에 끝나 정상 |
| **HEAD(8i-1 이전) 코드** · 같은 쪽 | **32쪽 똑같이**: 206 ms 첫 발화 → 860 ms canvas → 861 ms 끊김("Prevention") → 922 ms 같은 문장 다시. 쪽마다 발화 수도 지금 코드와 같다 |
| 지금 코드 · CPU 4배 감속(폰 흉내) · 46→56쪽 | **53쪽 — 첫 문장 그대로 두 번**: 0 ms mount → 203 ms "Common Symptoms" 발화 → 256 ms canvas → 260 ms 끊김 → 337 ms "Common Symptoms" 다시 |

- 원인은 Build 설명 그대로다: 원본 보기의 평소 렌더도 `state.desc` 를 `await paintView` **앞**에서 세우고, `goToPageForSpeech` 의 200 ms 폴링은 `state.desc`(와 지금은 `pageFresh` — 평소 쪽은 늘 참)만 본다. canvas 그리기가 다음 폴링 틱보다 늦게 끝나면 발화가 먼저 시작되고, 뒤이은 `notifyPage` → `reload()` 가 낭독 중이라 `restart(index)` 한다. 흉내 음성은 발화가 짧아 32쪽처럼 "그때 말하던 문장"이 겹치지만, **실제 음성은 한 문장이 수 초라 끊기는 것은 거의 늘 그 쪽 첫 문장**이다(53쪽 꼴).
- 언제부터: `goToPageForSpeech` 의 `state.page === target && state.desc` 폴링은 Build 5(`c60fb04`), 원본 보기의 비동기 `await paintView` 는 6b(`f3f6f8c`)부터 — **8i·8i-1 이 만든 것이 아니다**(HEAD 실측 + `8bc61de^` 소스 같음).
- 빈도: 데스크톱 9번 중 1(무거운 쪽), 4배 감속 10번 중 1. 폰에서 canvas 가 200 ms 를 넘는 쪽이 많으면 더 잦아진다 `[추정]`. 리플로우는 그리기가 동기라 없다(B 의 30 → 31 정상).

## 8i1R-7. 디스크 · 복사본 · 정리

- 복사본(모두 `shot-profile/Default/` 만 + 블롭 되넣기): `r8i1/p1`(165 MB, B) · `r8i1/p2`(148 MB, C2·TURN 5회(1회는 내 스크립트 대기 조건 오류로 중단)) · `r8i1/p3`(146 MB, 스크롤 유지) — **합 약 459 MB, 셋 다 재추출이 진행돼 다시 못 쓴다**. `rm -rf` 금지라 지우지 않았다 → 지울 경로: 스크래치패드 `r8i1/p1`·`r8i1/p2`·`r8i1/p3`(그리고 Build 가 남긴 `b8i1c/p1`·`b8i1c/p2` 약 295 MB). `shot-profile/` 은 읽기만 했다.
- `b8i1b/scripts/restore-blob.mjs` 는 이번에 서재 목록이 뜨기 전(800 ms)에 읽어 두 번 실패했다 → 사본 `r8i1/scripts/restore-blob.mjs` 에 목록 대기만 더해 썼다(넣은 블롭 106,843,404 B · `%PDF-` · 30쪽 algoVersion 10 확인, 세 복사본 모두).
- `df -h /c`: 시작 3.4 GB → 끝 **2.9 GB**. 띄운 Edge 는 스크립트 `finally` 에서 닫았고, 매 실행 뒤·끝에 `tasklist` 에 `msedge.exe` 0.
- 콘솔 오류: 매 실행 `/favicon.ico` 404 하나(앱 무관).

## 8i1R-8. 운영자 결정 필요 사항

1. **[권장: 고침 — 작은 Build, 8i-1 과 별개로 나가도 됨] 원본 보기에서 쪽이 넘어갈 때 다음 쪽 첫 문장이 시작 직후 끊기고 다시 나온다**(8i1R-6, 6b 부터). 옛 읽기가 나오거나 문장이 빠지지는 않는다 — 들리는 것은 "첫 문장 앞머리 반복". 안:
   - (가) **권장** — `goToPageForSpeech` 를 폴링 대신 **`notifyPage` 알림으로 풀기**(그 쪽 렌더가 끝난 뒤에만 참). 원본 보기 첫 문장 반복과 8i1R-4 #8(앞 쪽 `desc` 로 풀림)이 함께 사라지고, 폴링 지연(최대 200 ms)도 준다. 대가: 원본 보기 쪽 넘김 낭독이 canvas 그리기만큼(데스크톱 수십–수백 ms, 폰 더) 늦게 시작한다.
   - (나) 8i-1c 의 `refreshing` 을 평소 원본 렌더에도 세움(`pageFresh` 하나로) — 효과는 (가)와 같고 폴링은 남는다.
   - (다) 그대로 둔다(6b 이후 늘 그랬다).
2. (기록 — 결정 불요) 안드로이드에서 "옛 판 쪽 재생 → 대기 → 새 판 첫 발화"가 탭 밖 `speak()` 로 막히지 않는지 실기기 1회 확인(8i1R-4 #7). 막히면 배너가 뜨고 다시 누르면 된다.
3. (기록 — 결정 불요) 단위 테스트가 배선 둘(R3·R4)을 묶지 않는다 — 다음 Build 때 소스 테스트 두 줄로 보강 권장(8i1R-5).

# 8i-3 Review — 원본 보기 쪽 넘김 첫 문장 중복: 폴링 → 그리기 완료 알림 (spec 4-13-9) (2026-10-15)

> 지침: `.claude/tasks/medreader-review-8i-3.md`. Build 보고(`.claude/tasks/medreader-build-8i-3-report.md`)를 믿지 않고 다시 쟀다. 커밋하지 않았다. 앱 코드는 고치지 않았다(변이는 되돌리고 `cmp` 로 확인). 진짜 API 키 없음. 원서 인용은 모두 40자 이하.
> 작업 폴더: 스크래치패드 `r8i3/`(백업 `bak/` · HEAD 판 `head/js/ui/reader.js` · 변이 출력 `mut/` · 스크립트 `scripts/` · 로그 `rv-*.log`), 캡처 `shots-8i3/`(`shots-8i1/` 과 같은 자리 — 스크래치패드). 8000번 서버(PID 34392)는 그대로 쓰고 끄지 않았다.

## 8i3R-1. 결론 — **통과**(차단 문제 없음) · 테스트 보강 권장(낮음) · 운영자 결정 없음(기록 3)

- 고쳐졌다: 8i-1 Review 가 재현한 **32쪽**(데스크톱)과 **53쪽 "Common Symptoms"**(CPU 4배 감속)를 내 스크립트로 다시 돌려 지금 코드는 **끊긴 발화 0 · 첫 문장 연달아 두 번 0 · 그리기 전에 말한 쪽 0**. 같은 복사본·같은 쪽에서 **HEAD(`51815bc`) `reader.js` 는 두 곳 모두 다시 재현**했다(8i3R-2).
- 리플로우 쪽 넘김은 늦어지지 않고 오히려 빨라졌다(앞 쪽 끝 → 첫 발화 평균 12 ms, HEAD 206 ms). 8i-1 C2 회귀 없음.
- 코드: 대기열 누수·멈춤 갈래를 모두 따라가 봤고 폴링 판과 결과가 다른 길은 "사용자가 canvas 를 그리는 도중 직접 쪽을 옮김" 하나뿐이다(낮음, 8i3R-4 #6).
- 내 변이 4개 중 **2개가 살아남았다**(X2 `state.desc` 판정 뺌 · X4 `docId` 판정 뺌). PT3–PT8 이 실제 `goToPageForSpeech` 가 아니라 테스트 안의 **복사본**을 돌리고, 실제 소스는 PT9 가 문자열 몇 개로만 묶기 때문이다. X2 는 앱에서 "아직 추출 안 된 다음 쪽을 건너뜀"이 되는 변이라 보강을 권한다(8i3R-5).

## 8i3R-2. 고쳐졌는가 — headless (Edge · 412px · 캐시 끔 · 흉내 음성 · 복사본 `r8i3/p1`)

스크립트 `r8i3/scripts/rv.mjs` — 8i-1 Review 의 내 `rv.mjs` 에 발화 끝 기록·지연 집계·리플로우 모드(`TURNR`)·캡처를 더했다(Build `b8i3/scripts/` 는 쓰지 않음). `head` 는 같은 출처에서 `reader.js` 하나만 `git show HEAD:` 판으로 가로채 내보낸다. 흉내 발화 150 ms.

| 실행 (로그) | 결과 |
|---|---|
| **TURN 원본 보기 31→41** (`rv-TURN.log`) | 10쪽 넘김: 끊긴 발화 **0** · 첫 문장 연달아 두 번 **0** · 같은 문장 연속 **0** · 그리기 전에 말한 쪽 **0**. 첫 발화 − canvas 다 그림 3–7 ms. **32쪽**: 본문 교체 → 첫 발화 965 ms(canvas 를 다 그린 3 ms 뒤 "CHAPTER 36: HIV INFECTION & A…" 1번) — 운영자가 받아들인 지연. 나머지 쪽 앞 쪽 끝 → 첫 발화 20–82 ms |
| 대조 **TURN-head** (`rv-TURN-head.log`) | **32쪽 재현**: 216 ms 발화 시작(canvas 보다 615 ms 앞섬) → 831 ms canvas → 832 ms 끊김 → 893 ms 같은 문장 다시("link antiviral-tecovirimat-sa…"). 다른 쪽은 늘 약 200 ms(폴링 틱) 뒤 시작 |
| **TURN-x4 CPU 4배 감속 46→56** (`rv-TURN-x4.log`) | 10쪽: 끊긴 발화 0 · 첫 문장 두 번 0 · 그리기 전에 말한 쪽 0. **53쪽 "Common Symptoms" 1번**(본문 교체 → 256 ms, canvas 뒤 18 ms). 같은 문장 연속 1건은 51쪽 "(3) Weekly (4) Daily or almos…" — 끊김 0 이고 HEAD 실행에도 똑같이 있어 내용(설문 선택지 반복)이다 |
| 대조 **TURN-head-x4** (`rv-TURN-head-x4.log`) | **53쪽 재현**: 239 ms "Common Symptoms" → 241 ms canvas → 245 ms 끊김 → 340 ms "Common Symptoms" 다시. 8i-1 Review 와 같은 쪽·같은 꼴 |
| **TURNR 리플로우 33→38** (`rv-TURNR.log`) | **지연 없음**: 앞 쪽 마지막 발화 끝 → 첫 발화 8–17 ms(평균 12), 첫 발화 − 본문 교체 6–11 ms. 연속·끊김 0 |
| 대조 **TURNR-head** (`rv-TURNR-head.log`) | 202–212 ms(평균 206) / 197–207 ms — 폴링 틱. 쪽마다 발화 수·첫 발화 같음 |

캡처: `shots-8i3/turn-p32-original-speaking.png`(32쪽 원본 보기, 24줄 중 4번째 낭독 중, 하이라이트가 표 첫 행 "Complications" 칸) · `turn-x4-p47-original-speaking.png` · `c2-p30-original-paused-box.png`.

## 8i3R-3. 불변 · 회귀

- **8i-1 C2**(원본 보기, 연 즉시 옛 판 30쪽 재생, `rv-C2.log`): 15 ms 재생 → "Preparing text…", 발화 0 → 532 ms 첫 발화 "Thyroid Nodules & Multinodular Goiter" 한 덩어리(1번). 30쪽 발화 27 · "& Pseudo- 1130" **0** · "1130" 0 · 정수만 0. 멈춘 자리 상자 3개(`30:9·30:10·30:11`) 쪽 번호 칸과 교차 0, 간격 24.7 pt. 낭독 중 다시 그림 0. 30 → 31쪽 넘김 정상("CHAPTER 32: DIABETES MELLITUS & HYPOGLY…").
- **멈춤 → 재생은 그 문장 처음부터**: C2 의 유일한 같은 문장 연속 = 멈춤 직후 "Hypoparathyroidism & Pseudo-hypoparathy…" 1건(끊긴 발화 2 = 멈춤 1 + 스크립트 끝 멈춤 1).
- **8h 인용**: C2 30쪽 발화 27(= 26 + 멈춤→재생 1, 8i-1 Review 와 같은 수). **8i 행 표**: 이름표 한 덩어리, "1130"·정수만 발화 0.
- **뷰 전환·원문 언어 변경 때 `reload()`**: controls 의 `onPageRender` 첫 구독자(`syncSourceVoice → reload`)·둘째(`reshow`) 그대로, controls·speaker 는 바이트 변경 없음(`git diff` 에 없음). `setView` → `renderPage` → `notifyPage` 경로 그대로. 기존 테스트 초록.
- `TTS.PAGE_POLL_MS`: `js/` 안에서는 `config.js` 정의 한 곳뿐 — 앱은 더 쓰지 않는다(새 테스트의 대조 흉내만 읽음). 확인.

## 8i3R-4. 코드 검토 (`createRenderDone` · `renderPage` · `goToPageForSpeech` · `whenCurrentPageReady`)

| # | 본 것 | 판정 |
|---|---|---|
| 1 | 대기열 누수 — 대기자마다 상한 타이머가 있고 `done` 이 지우므로 버려진 렌더·다른 쪽·`leaveReader`·연속 쪽 넘김 어디서든 늦어도 5초(쪽 넘김)/`FRESH_WAIT_MS`(새 판 대기) 뒤 빠진다. `settled` 는 사본(`Array.from`)을 돌아 판정 중 추가·삭제에 안전 | 문제 없음 |
| 2 | 알림이 안 와서 상한까지 가는 갈래 — `renderToken` 을 올리는 곳은 `renderPage` 하나뿐(검색 확인) → 버려진 렌더 뒤엔 반드시 마지막 렌더가 끝에서 알린다(db 오류·저장본 없음·깨짐·`finally` 네 곳 모두 마지막 렌더일 때). `showReader` 의 `documents` 읽기 오류는 `renderPage` 전에 끝나 알림 없음 → 상한 뒤 false — 폴링 판도 `state.page` 가 안 바뀌어 같은 false | 폴링 판과 같은 결과 |
| 3 | 같은 쪽 재렌더 — `go()` 는 같은 해시면 라우터 handler 를 직접 부른다(`router.js` `go`) → `renderPage` → 알림. 저장본 없음(자리표시자)은 `desc` 가 없어 계속 기다리고, 추출기 `onPage` 의 `renderPage()` 끝 알림에 풀린다 | 문제 없음 |
| 4 | 대기를 `go` **앞**에 건다 — 같은 해시 갈래에서도 `renderPage` 는 `await db.get` 뒤에야 알리므로 순서상 늘 안전. PT9 가 묶는다 | 문제 없음 |
| 5 | 8i-1c `refreshing` 과의 순서 — `finally` 에서 `refreshing` 내림 → 알림. 다시 그리기 R1 중 평소 렌더 R2 가 끼면 R2 가 동기 구간에서 내리고 R2 끝 알림에 풀림(R1 은 버려져 안 알림). 문지기는 `waiting-page` 를 낭독 중으로 보지 않아 대기 중 새 판 다시 그리기가 미뤄지지 않는다 | 문제 없음 |
| 6 | 빠른 연속 쪽 넘김·쪽 이동 버튼과 겹침 — 대기 중 사용자가 다른 쪽으로 가면 그 렌더 끝은 `r.page !== target` 이라 무시 → 상한 뒤 `TTS_PAGE_TIMEOUT`(paused). 폴링 판도 `state.page !== target` 이라 대개 같은 결과. 다만 사용자가 **canvas 를 그리는 도중** 다른 쪽으로 가면 폴링 판은 이미 선 `desc` 로 먼저 풀려 낭독이 이어졌을 수 있는데(곧 `notifyPage` 로 바뀐 쪽 큐로 갈림), 이제는 5초 뒤 멈춘다 | 기록(낮음) — 사용자가 직접 쪽을 옮긴 경우라 받아들일 만함 |
| 7 | `paintView` 가 던지면 `notifyPage` 없이 `finally` 알림 → 참으로 풀려 speaker 가 `view.paras()`(새 쪽 `desc`)로 큐를 만든다 — 폴링 판과 같음 | 문제 없음 |
| 8 | `leaveReader` 알림 `page: null` — 쪽 넘김은 무시(상한 뒤 false, speaker 는 이미 `leaveControls` 로 멈춰 결과를 버림), 새 판 대기는 그 순간 상태로 판정(폴링 판과 같은 값) | 문제 없음 |
| 9 | Build "남은 문제" 2 — db 오류로 새 쪽 저장본을 못 읽으면 `state.desc` 가 앞 쪽 것이라 참으로 풀려 앞 쪽 글자를 새 쪽에서 읽는다. 코드로 확인 — 폴링 판도 같고 IndexedDB 오류 배너가 함께 뜬다. 고치려면 db 오류 갈래(마지막 렌더일 때)에서 `state.desc = null` | 동의 — 기록(낮음, 이전부터) |
| 10 | Build "남은 문제" 3 — `whenCurrentPageReady` 가 다른 쪽으로 간 것을 알아채는 때가 "폴링 틱" → "그 쪽 렌더의 끝". 결과(false)는 같고, speaker 는 그 사이 `waiting-page` 그대로라 사용자에게 차이가 없다 | 동의 — 문제 없음 |

## 8i3R-5. 테스트의 힘 · 변이

- PT1 은 실제 `createRenderDone` 을, PT10·PT11 은 실제 소스의 배선을 묶는다(8i-1 Review R3·R4 를 메움 — Build M5·M6 이 빨강). **PT3–PT8 은 테스트 안의 흉내 `goToPage`/`renderPage` 를 돌린다** — 실제 `goToPageForSpeech` 의 판정식이 바뀌어도 흉내는 그대로라 초록이다. 실제 소스와의 연결은 PT9 뿐인데, PT9 는 문자열 첫 출현 위치와 `r\.page !== target` 정규식 하나만 보므로 판정식의 나머지(`docId` 비교 · `state.desc` · `pageFresh`)는 묶지 않는다(`pageFresh` 는 RF23 이 우연히 잡는다).
- 내 변이(`r8i3/scripts/mut.mjs`: 정확히 1회 일치 → `MUT-Xn` 표식 1건 → 전체 테스트 → `r8i3/bak/` 에서 복원 → `cmp` 같음, 4개 모두). 해시 테스트 IM2·IM6·IM7b 는 매번 빨강이라 뺐다. 출력 `r8i3/mut/X1–X4.txt`.

| # | 변이(Build 가 안 한 곳) | 빨개진 테스트 | 판정 |
|---|---|---|---|
| X1 | `goToPageForSpeech` 대기 판정에서 `pageFresh(state)` 뺌(옛 판 쪽에서 풀림) | RF23 | 잡힘(RF23 이 같은 줄 문자열을 본다) |
| X2 | 대기 판정에서 `state.desc` 뺌 | 0 — **살아남음** | **앱에선 회귀**: 다음 쪽이 아직 추출 안 됐으면 자리표시자 렌더 끝(`desc` 없음, `pageFresh` 참)에 참으로 풀려 speaker 가 빈 큐 → `advancePage(hop + 1)` 로 그 쪽을 **건너뛴다** |
| X3 | `settled` 가 첫 대기자만 판정 | PT1(끝나지 않아 `--test-timeout` 취소) | 잡힘 |
| X4 | 대기 판정에서 `r.docId !== docId` 뺌 | 0 — 살아남음 | 영향 작음(다른 문서의 같은 쪽 번호 렌더 끝에도 판정 — 그때도 `state.page === target && desc` 가 필요하고 문서를 바꾸면 speaker 는 이미 멈춰 있다) |

→ **권장(낮음, 다음 Build 에 얹기)**: 판정식을 순수 함수로 꺼내(예: `speechPageReady(st, r, docId, target)`) `goToPageForSpeech` 와 흉내가 **같은 함수**를 쓰게 하고, "자리표시자 렌더 끝에는 안 풀림 → 추출 뒤 렌더 끝에 풀림"을 PT 로 하나 더 묶는다. 그러면 X2·X4 가 빨개진다.

- 전체 `node --test apps/medreader/tests/*.test.mjs` **1043/1043 × 4회**(변이 전 2 + 끝 2). `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 53개 · CSS 4개)", 종료 0. 끝에 `reader.js`·`controls.js`·`index.html` 이 내 백업과 `cmp` 같음.
- (기록) X1 실행 한 번에서 `pipeline-8a.test.mjs` M7("같은 캐시 키 동시 요청 → 호출 1건", 2 !== 1)이 빨강이었다 — `reader.js` 와 무관한 파일이고 다른 실행에선 초록이라 타이밍에 흔들리는 테스트로 본다(이번 변경 탓 아님).

## 8i3R-6. 디스크 · 복사본 · 정리

- 복사 전 `df -h /c` 2.8 GB. 복사본 **1개**: `r8i3/p1`(`shot-profile/Default/` 만 40 MB → 블롭 되넣은 뒤 146 MB; 106,843,404 B · `%PDF-` · 30쪽 algoVersion 10 확인). 같은 복사본으로 C2 → TURN · TURN-head · TURN-x4 · TURN-head-x4 · TURNR · TURNR-head 7회. `shot-profile/` 은 읽기만 했다. 끝 `df -h /c` **2.6 GB**.
- 지울 경로(`rm -rf` 금지라 지우지 않음): 스크래치패드 `r8i3/p1`(146 MB, 재추출이 진행돼 C2 용으로는 다시 못 씀). 그 밖 `r8i3/`·`shots-8i3/` 은 합 2 MB 미만.
- 띄운 Edge 는 스크립트 `finally` 에서 닫았고, 끝에 headless `msedge.exe` 0.
- **남은 node 프로세스 2개**(PID 47980 `node --test …` · 50268 `… pageturn-8i3.test.mjs`): X3 변이를 처음 돌릴 때 테스트 상한 없이 걸어 PT1 이 끝나지 않고 멈춘 테스트 실행이다. 셸 작업은 멈췄고 `reader.js` 는 곧바로 복원(`cmp` 같음)했지만, 두 프로세스를 끄는 명령이 권한 분류기에 막혀 변형을 찾지 않고 남겨 두었다 — 운영자가 작업 관리자에서 끄면 된다. 두 번째 X3 실행부터는 `--test-timeout=20000` 을 걸었다.
- 콘솔 오류: 매 실행 `/favicon.ico` 404 하나(앱 무관).

## 8i3R-7. 운영자 결정 필요 사항

없음(차단 아님). 기록:
1. (기록) 원본 보기 무거운 쪽은 그리기 시간만큼 늦게 시작한다 — 32쪽 데스크톱 약 0.97초, 4배 감속의 다른 쪽은 0.1–0.3초. 운영자가 받아들인 대가. 실기기(안드로이드) 원본 보기 쪽 넘김 한 번 체감 확인 권장(Build 와 같은 의견).
2. (기록) 테스트 보강(8i3R-5 권장) — 판정식을 순수 함수로 꺼내 X2(미추출 다음 쪽 건너뜀)를 묶기. 앱 동작은 지금 맞다.
3. (기록) `TTS.PAGE_POLL_MS` 는 앱에서 쓰지 않는다 — 다음 정리 때 새 테스트의 대조 흉내와 함께 지워도 된다. 남은 node 프로세스 2개(8i3R-6) 정리.

---

# 8i-3b Review — 쪽 넘김 판정식을 순수 함수로 · 테스트 보강 · `PAGE_POLL_MS` 삭제 (2026-10-16)

> 지침: `.claude/tasks/medreader-review-8i-3b.md`. Build 보고(`.claude/tasks/medreader-build-8i-3b-report.md`)를 믿지 않고 다시 쟀다. 커밋하지 않았다. 앱 코드·테스트는 고치지 않았다(변이는 되돌리고 `cmp` 로 확인). headless 재현은 하지 않았다(판정이 같게 나와 지침 6 의 조건에 들지 않음).
> 작업 폴더: 스크래치패드 `r8i3b/`(백업 `bak/` · `6594f48` 판 `old/reader.js` · 비교 스크립트 `equiv.mjs` · 변이 `scripts/mut.mjs`·`run-mut.sh` · 출력 `mut/*.txt` · 로그 `base.log`·`full-1.log`·`full-2.log`).

## 8i3bR-1. 결론 — **통과**(차단 문제 없음) · 운영자 결정 없음

- 판정식 동치: 옛 식과 새 식이 실제 `state`(평범한 객체 리터럴, getter 없음)에서 도달할 수 있는 모든 입력에서 **같은 결과**를 낸다(8i3bR-2).
- 8i-3 Review 가 살려 둔 **X2·X4 가 이제 빨강**이고, 내 변이 5개도 모두 빨강(8i3bR-3).
- 기존 PT 기대값은 그대로이며, PT9 는 옮기면서 오히려 강해졌다(8i3bR-4). `PAGE_POLL_MS` 는 앱에 남은 참조가 없다. 전체 **1048/1048 × 4회**(이 절을 덧붙인 뒤 1회 포함), stamp `--check` 0.

## 8i3bR-2. 동작 불변 — 옛·새 판정식을 같은 입력 표로

`git diff js/ui/reader.js` 를 줄 단위로 읽음: 바뀐 곳은 호출 자리 3곳(`goToPageForSpeech` 바로 풀기·렌더 끝 check, `whenCurrentPageReady` check)과 새 export `freshWaitCheck`·`speechPageReady`·`pageTurnCheck` 뿐이다. 상한(`TTS.PAGE_WAIT_MS`·`ms`), `docId` 를 잡는 자리(`go()` 앞), `go(readerHash(...))` 순서, `whenCurrentPageReady` 첫 줄 바로 풀기, `pageFresh` 본문은 그대로.

`r8i3b/equiv.mjs`: `git show 6594f48:` 판과 지금 판에서 세 판정식을 **소스 텍스트 그대로 정규식으로 꺼내**(손으로 옮겨 적지 않음) `new Function` 으로 평가하고, 새 순수 함수는 실제 모듈에서 import 했다. `pageFresh` 는 두 판의 텍스트가 같음을 먼저 확인. 결과는 `createRenderDone` 과 같은 해석(던짐 → false, true/false, 그 밖 → 계속 기다림), 바로 풀기는 `if` 의 참·거짓으로 비교.
- 입력: `state` 1152가지(`docId` A/B/null/undefined × `page` 32/33/'33'/undefined × `desc` 객체/null/undefined/''/'x'/0 × `stale` false/true/undefined/1 × `refreshing` 0/7/undefined) × 잡은 `docId` 3 × `target` 3(33/32/'33') × 렌더 끝 `r` 6가지(같은 문서·쪽/다른 문서/다른 쪽/'33'/`{}`/docId null).
- **평범한 상태 82,944건 — 다른 결과 0건**, 반환 원값(`true`/`false`/`undefined`)까지 같음. `state` 가 null 인 갈래도 둘 다 던져 같은 결과.
- 예외 갈래(참고): `stale`·`refreshing` 이 **던지는 getter** 일 때만 다르다(132건) — 새 식은 `pageFresh(state)` 를 인자로 먼저 재므로, 옛 식이 단락 평가로 `pageFresh` 에 닿지 않던 경우(다른 쪽·다른 문서의 렌더 끝, 리더가 다른 쪽)에도 던진다 → 렌더 끝 check 는 "계속 기다림" 대신 false, 바로 풀기는 거짓 대신 던짐. 실제 `state` 는 데이터 속성뿐인 객체 리터럴이라(`reader.js` 461줄, `defineProperty`·Proxy 없음) **도달할 수 없다**. `settled` 는 `info || {}` 로 부르므로 `r` 이 null 인 갈래도 없다. Build 보고의 "단락 평가가 사라져도 부수 효과 없음" 설명과 맞다.

## 8i3bR-3. 테스트의 힘 · 변이

`r8i3b/scripts/run-mut.sh`: 정확히 1회 일치 → `MUT-` 표식 1건 → 전체 테스트(`timeout 300`, `--test-timeout=20000`) → `bak/` 에서 복원 → `cmp` 같음(7개 모두). 해시 테스트 IM2·IM6·IM7b 는 `reader.js` 가 바뀌면 매번 빨강이라 표에서 뺐다. 7개 모두 종료 코드 1, cancelled 0.

| # | 변이 | 빨개진 테스트(IM 제외) | 판정 |
|---|---|---|---|
| X2 (재변이) | `pageTurnCheck` 렌더 끝 판정에서 `desc` 뺌(`st.page === target && fresh`) | PT12 · PT13 · PT13b | **잡힘**(8i-3 땐 0) |
| X4 (재변이) | `pageTurnCheck` 에서 `r.docId !== docId` 뺌 | PT12 · PT9 | **잡힘**(8i-3 땐 0) — 흉내 동작이 아니라 표·소스로 |
| Y1 | `freshWaitCheck` 에서 `st.page !== page` 뺌 | PT12b · PT8b · PT9 | 잡힘(흉내 동작 PT8b 도) |
| Y2 | `pageTurnCheck` 에서 `r.page !== target` 뺌 | PT12 · PT9 | 잡힘 |
| Y3 | `speechPageReady` 의 `===` → `==`(쪽 번호 꼴) | PT12 | 잡힘 |
| Y4 | `freshWaitCheck` 끝 `return undefined` → `return false`(옛 판이면 바로 포기) | PT12b | 잡힘 |
| Y5 | `whenCurrentPageReady` 호출 자리 `page` → `state.page`(떠난 것을 못 알아챔) | PT9 | 잡힘(소스 문자열만) |

- (기록, 낮음) 흉내의 **호출 자리**(`harness` 의 `goToPage`·`whenReady`)는 여전히 복사본이라, 실제 호출 자리의 인자를 바꾸는 변이(Y5·Build X8)는 PT9 의 정확한 문자열 검사로만 잡힌다. 판정식 자체는 이제 실제 함수라 8i-3 Review 권장은 충족됐다.

## 8i3bR-4. 기대값 · `PAGE_POLL_MS` · 실행

- `git diff tests/pageturn-8i3.test.mjs`: 기존 PT 의 assert 기대값·메시지는 바뀌지 않았다. 바뀐 것은 흉내 판정식 → import 한 함수, `TTS.PAGE_POLL_MS` → 지역 `LEGACY_POLL_MS = 200`(PT2·PT3·PT4 의 `advance` 값 같음)뿐.
- PT9 옮김: 옛 `go` 의 `/r\.page !== target/` → `pageTurnCheck` 본문의 `r.docId !== docId || r.page !== target` 정규식 + 호출 자리 정확한 문자열 2개 + `docId` 를 대기 앞에서 잡는지. 옛 `wr` 의 `state.docId !== docId || state.page !== page) return false` → `freshWaitCheck` 본문 + 호출 자리 문자열. 폴링 금지 정규식에 `setTimeout` 이 더해졌다. **약해진 곳 없음**(X4·Y2·Y5 가 PT9 로 빨개진 것이 증거).
- 새 테스트 PT12·PT12b(판정식 표)·PT13·PT13b(자리표시자 다음 쪽 — 상한까지 `waiting-page`, 추출 뒤 렌더 끝에 첫 문장 1번)·PT14 를 읽었다 — 지침 3번 표의 다섯 줄이 모두 있다.
- `PAGE_POLL_MS` grep: 앱(`js/`·`index.html`·`dev/`)에 **0건**. 남은 참조는 `tests/pageturn-8i3.test.mjs` 의 주석 1·PT14 "없음" 검사·PT9 금지 정규식 2 — 모두 "없어야 한다"는 쪽이라 맞다. `TTS` 를 키로 훑는 코드(`Object.keys(TTS)`·`TTS[...]`)도 없어 지운 것이 다른 곳을 깨지 않는다. 나머지는 `review.md`·`.claude/tasks/` 기록.
- 전체 `timeout 300 node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` — 변이 전 1회 + 끝 2회 + review.md 덧붙인 뒤 1회 모두 **1048/1048**, fail 0, cancelled 0(한 번 7초 안팎). `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 53개 · CSS 4개)", 종료 0.
- 끝에 `reader.js`·`config.js`·`pageturn-8i3.test.mjs`·`index.html` 이 내 백업과 `cmp` 같음. 띄운 프로세스 없음(서버·브라우저 안 씀) — `tasklist` 의 node.exe 는 PID 25148 하나(Build 보고 때부터 있던 것, 내 것 아님). 8i-3 Review 가 남긴 PID 47980·50268 은 목록에 없다.

## 8i3bR-5. 운영자 결정 필요 사항

없음. 기록: 흉내 호출 자리는 복사본으로 남아 PT9 문자열 검사가 그 연결을 맡는다(8i3bR-3, 낮음 — 고칠 필요는 없음).

# 8i-2 Review — 본문 이름표 2열 표를 행 단위로 읽기 (spec 4-13-10) (2026-10-17)

> 지침: `.claude/tasks/medreader-review-8i-2.md`. Build 보고(`.claude/tasks/medreader-build-8i-2-report.md`)를 믿지 않고 다시 쟀다. 커밋하지 않았다. 앱 코드·테스트는 고치지 않았다(변이는 되돌리고 `cmp` 로 확인). 진짜 API 키 없음(AI 요청은 가로채 막음 — 0건). 원서 인용은 모두 40자 이하.
> 비교 기준: `git archive HEAD`(246e392)의 `apps/medreader/js` 를 스크래치패드 `r8i2/old` 에 풀었다(체크아웃 없음). Build 의 `measure --app` 이 쓰는 "8i 참조(시제품 사본·규칙 끔)"가 아니라 **실제 HEAD 코드**와 비교했다. 스크립트·덤프·로그는 스크래치패드 `r8i2/`, 캡처는 `shots-8i2/`.
> pdf.js: Node 는 Build 와 같은 Codex 런타임 pdfjs-dist **5.6.205**(설치·다운로드 없음), 판정은 브라우저(앱이 CDN 으로 받는 **5.4.149**)로 했다.

## 8i2R-1. 결론 — **통과**(차단 문제 없음) · 테스트 보강 권장 · 운영자 결정 2건

- 브라우저(5.4.149) 저장본과 Node(5.6.205, 이웃 저장본을 넘긴 앱과 같은 2회차) 레이아웃이 **27쪽 전부 같다**(18쪽 + 21·25·30·33·38 + 표 없는 쪽 4). 판 차이로 바뀌는 것은 없다.
- 18쪽 눈 검토: 이름표 100행 · 설명 줄 500줄을 줄 단위로 전부 봤다. **틀린 짝 0**. 정답표(`rowtable-8i2-key.json`)도 내 판단과 어긋난 곳이 없다. Build 의 채점 100%(CMDT 88/88·448/448, Harrison 12/12·52/52, 머리 17/17 접음, 묶음 제목 7/7, 다열 4쪽 제외)를 다시 재서 같았다.
- 회귀: 실제 HEAD 코드 대 지금 코드, **세 권 전 쪽**(1,967 + 729 + 5,051) — 바뀐 쪽은 정확히 그 18쪽이고 글자 잃음 0·늘어남 0. 21–38쪽은 이웃을 넘긴 저장본까지 바이트 같다. 퀴즈 정답 연결 1,190 그대로.
- 브라우저 낭독·화면·원본 상자·옛 판 → 새 판 재추출 모두 정상.
- 새로 찾은 것 1(낮음–중간, 실물 0): **D10 이 구조로는 완전하지 않다.** 쪽 번호 열이 있는 표(R 표)가 R7 로 물려준 띠에 쪽 번호가 하나도 없으면 그 띠는 `det.R = []` 가 되어 2열 규칙을 탄다. **되돌림 스위치 `REQUIRE_REF:true` 에서도** 그렇다 — 합성 재현에서 8i 와 바이트가 다르다(8i2R-6).
- Build 남은 문제 2번(R6b 열 머리 오판)을 합성으로 재현했다. 실물 0 확인(8i2R-6).
- 내 변이 6개 중 **5개가 살아남았다**(테스트가 없는 방어 조건). 실물에서도 바뀌는 쪽이 0이라 동작 문제는 아니고 테스트 공백이다(8i2R-7).

## 8i2R-2. spec 대로인가 — 코드 대조 (`git diff`)

| 항목 | 판정 | 근거 |
|---|---|---|
| D10 — 새 규칙은 R 없는 표에만 | **대체로 맞음 · 구멍 1** | `judge` (f)·`rowsOf` R5b·`inheritFrom` 통로 좁히기·(f) 재검사·`splitStraddling`·`colheadTwo`·`emitBand` 역할 유지가 모두 `!det.R.length`(또는 `!d0.R.length`)로 갈린다. R1b 는 `!R.REQUIRE_REF` + R 표 띠 건너뜀, R1c 는 R 표 띠가 섞이면 합치지 않음. **구멍**: 판정 기준이 "R 열 조각이 있나"라서 R 표에서 물려받은 띠에 쪽 번호가 없으면 2열로 취급된다(8i2R-6 B) |
| D7 열 머리 접음 | 맞음 | `colheadTwo` 가 spec R6b (1)–(3) 그대로. 글꼴 조건 없음. 18쪽 머리 17개 모두 `colhead`(흐름 밖) |
| D8 Harrison 75·542 일부 격자 → 행 읽기 | 맞음 | `--app` 재측정: Harrison 4-8 영역 3 → 0. 브라우저 542·75 리플로우에서 행 문단으로 읽힘 |
| D9 숨은 열 가드 없음 | 맞음 | C365 이름표 칸이 "병기 + 정의" 4줄 한 덩어리로 읽힌다(행 순서는 맞음) |
| `REQUIRE_REF:false` · `HIDDEN_COL 0.2` · `ROW_GAP 1.1` | 맞음 | `config.js` 213–229줄 |
| `algoVersion 12` · 되돌림 주석 | 맞음 | `layout.js` 버전 이력 12 항목, 11 의 되돌림 주석 "지금 값 + 1". M10 계약(`ENABLED && !REQUIRE_REF` 이면 12, 아니면 ≥ 13), V9 = 12 |
| storeVersion · 리더·CSS·extract.js | 안 바뀜 | diff 에 없음 |

코드 메모(고칠 것 아님): R1c 는 다시 만든 띠를 `topY` 로 정렬해 R7 이웃 순서를 정한다. 2단 쪽에서 왼 단 아래 띠와 오른 단 위 띠의 순서가 바뀔 수 있지만, 2열 표가 있는 쪽에서만 열리고 18쪽 결과는 같다.

## 8i2R-3. 브라우저 (headless Edge · 412px · 캐시 끔 · 흉내 음성 · :8000)

서버: 시작 때 :8000 이 비어 있어 레포 루트에서 `python -m http.server 8000 --bind 127.0.0.1` 를 띄웠다(PID 26920). **지침대로 켜 두었다.** 콘솔 오류는 `favicon.ico` 404 하나뿐(로컬 서버 루트, 앱 무관).

**(a) 새 프로필 추출** (`r8i2/p-new` — 빈 프로필, 온보딩 표시만 설정)
- CMDT 2026 과 Harrison 을 `#fileInput` 으로 가져왔다. 앱 algoVersion 12, pdf.js 5.4.149. 실패 쪽 0.
- 추출 시간(데스크톱): CMDT 2026 은 첫 실행이 내 스크립트 오류로 56쪽에서 끊겨, 다시 열어 나머지 1,911쪽에 41초. Harrison 729쪽 15초.
- 저장본 27쪽의 줄(id·글·role·col·rt·paraId)과 문단(id·kind·lineIds)을 꺼내 Node 와 비교(`r8i2/cmpsig.mjs`) → **27쪽 모두 같음**. rt 줄·rowhead 수도 같다(예: 1681 rt 38·rowhead 6, H542 rt 20·rowhead 5, 30쪽 rt 64·rowhead 6).

**(b) 낭독 순서** (리플로우, 흉내 음성 발화 전부 기록 — `r8i2/read-*.json`)

| 쪽 | 결과 |
|---|---|
| C1681 무릎 진찰표 | 캡션 → Inspection → 그 설명 → palpation → 설명 → … → 묶음 제목 "Ligament Stress testing" 홀로 → Lachman → 설명 → anterior drawer → 설명. 열 머리 발화 0 |
| H542 | 표 제목(구획 줄, body) → Quantity → 설명 → Gender → … → Fatty liver → 설명 → 다음 해설. 열 머리 발화 0 |
| C365 | 캡션 → 이름표(병기+정의 한 덩어리, D9) → 그 행 설명 13줄 → 다음 행 … 열 머리 발화 0 |
| H75 | 앞 해설 → 표 제목 → 이름표(6줄 한 덩어리) → 설명 → 표 아래 각주 |

정수만 발화 0, 쪽 번호 섞인 발화 0.

**(c) 화면** — rowhead 문단 굵기 700 · 위 구분선 `solid 1px` · `rt-ref` 0(R 없음). 열 머리는 접힌 줄 묶음 안에 들어간다. 가로 넘침 0(412px). 캡처 `c1681-reflow`·`c365-reflow`·`h542-reflow`·`h75-reflow`.

**(d) 원본 보기 상자** — 발화를 하나씩 붙잡고 보이는 `.hl-line` 상자마다 덮은 줄을 저장본 bbox 로 대조했다(CMDT 쪽 view 원점 36pt 반영).
- C1681 발화 8개: 이름표 발화 상자는 그 이름표 줄만(A0·A1·A2), 설명 발화 상자는 그 행 P 줄만(P0 3줄, P1 4줄, P2 4줄). 다른 칸을 덮은 상자 0.
- H542 발화 6개: 표 제목 → S0, 이름표 → A1·A2·A3, 설명 → P1 3줄·P2 2줄. 다른 칸 0.
- C365: 이름표 발화 상자 4개가 A0 네 줄만, 설명 첫 발화가 P0 만.
- 캡처 `c1681-box1..8`·`h542-box1..6`·`c365-box1..4`(붙잡은 상자에 빨간 테두리). `c1681-box6` 에서 "Palpation" 행 설명 4줄만 덮인 것을 눈으로 확인했다.

**(e) 옛 판 → 새 판** (`r8i2/p-old` = `shot-profile/Default` 복사본, `r8i2/scripts/restore-blob.mjs` 로 PDF 블롭을 되넣음. 저장본 algoVersion 10)
- 1681쪽(저장본 algo 10·rt 0)을 열자 옛 판이 먼저 그려졌다(rowhead 0).
- 배너 "텍스트 엔진이 갱신되어 이 문서를 다시 준비하고 있습니다." + "Preparing text n/1,967". 659ms 에 1681쪽 저장본이 12 로 써졌고, 660ms 에 **화면이 새 판(rowhead 6·colhead 줄 2)으로 바뀌었다**(8i-1 경로). 문서 extraction 은 algo 12 로 되감겨 계속 진행. 캡처 `old-1-open`·`old-2-after`.

## 8i2R-4. 눈 검토 — 18쪽 "이름표 → 설명" 짝 전부

방법: `measure-rowtable-8i2.mjs --app --show --key`(`r8i2/show-c26.txt`·`show-h.txt`)와 내 덤프 `r8i2/pairs.mjs`(행마다 이름표 전부 + 설명 줄 전부, baseline·x — `tab-c26.txt`·`tab-h.txt`)로 행 100개·설명 줄 500줄을 하나씩 봤다. 1681 은 원본 캡처와도 맞춰 봤다.

- **틀린 짝 0.** 행 시작은 모두 이름표 첫 줄 = 설명 첫 줄 높이(위 정렬). 여러 줄 이름표(Esophageal… / junction cancer, LMWH / dalteparin, Waldenström 3줄, Harrison "Cancer surgery, including / …" 등)는 한 칸으로 붙고 다음 이름표와는 갈렸다. 1658–1683 처럼 행 사이에 그림이 있어 틈이 수백 pt 인 행도 맞다.
- **정답표 자체**: 행 시작 100·머리 17·묶음 제목 7·다열 4쪽이 내 판단과 모두 같다. 판단이 갈릴 만한 곳 두 개도 정답표가 맞다.
  - H75: 이름표 6줄에 조건 둘이 "or" 로 이어진다. 설명 열이 둘에 함께 걸리므로 한 행이 맞다.
  - C484: "Step 3"·"Step 4" 는 따로 행이다.
- 남은 흠(틀린 짝은 아님, 8i-2 전에도 읽히던 것):
  - 쪽 끝 "(continued)" 가 마지막 행의 P 칸에 들어가, 그 행 설명 뒤에 한 줄짜리 문단으로 읽힌다(1587·1588·1658·1659·1681·1682·1683 — 7쪽). 8i-2 전에도 body 문단으로 읽혔다.
  - 캡션 둘째 줄 "diagnosis)." 가 표 첫머리에 홀로 선 행으로 읽힌다(1587–1589, spec 4-13-10 3절 "알려진 것" 3).
  - C365 이름표 칸 안의 숨은 열(D9).
  - 이름표 첫 글자가 소문자로 나오는 줄("palpation", "hawkins …")은 원서 글꼴(작은 대문자)의 글자 추출 문제다. 8i-2 와 무관.

## 8i2R-5. 회귀 — 내 스크립트 (`r8i2/full.mjs`·`nb2138.mjs`, 5.6.205)

| 범위 | HEAD(246e392 실제 코드) 대 지금 |
|---|---|
| CMDT 2026 전 1,967쪽 (이웃 없음) | 바뀐 쪽 **15**: 45·365·484·587·810·1587–1589·1653·1658·1659·1661·1681–1683 |
| Harrison 전 729쪽 | 바뀐 쪽 **3**: 75·412·542 |
| CMDT 2021 전 5,051쪽 | 바뀐 쪽 **0** |
| 21–38쪽 | 이웃 없는 레이아웃 다름 0 · 이웃 저장본을 넘긴 2회차 `toStored` JSON 다름 **0**(rt 줄 1,280) |
| 바뀐 18쪽 글자(아이템 idx:str 다중 집합) | 잃음 **0** · 늘어남 **0** |
| 퀴즈(`dev/compare-quiz.mjs --base r8i2/old/…/js`, Harrison) | 문항 1,233 → 1,233 · 정답 연결 **1,190 → 1,190** · verified 1,185 · unverified 48 · rowhead 문단 +12 |

7b 레이아웃 시간(세 권 합): 지금 6.7초, HEAD 6.2초. 측정 잡음 수준이다.

## 8i2R-6. 위험 두 가지 — 합성 재현 (`r8i2/repro.mjs`, 지어낸 낱말)

**A. R6b 열 머리 오판 (Build 남은 문제 2)** — 재현됨.

| 픽스처 (머리 행 없는 2열 표, 지금 설정) | 결과 |
|---|---|
| A1 첫 행 이름표 2줄 · 첫 설명 줄이 문장 끝 아님 | **첫 이름표 줄 + 첫 설명 줄이 colhead 로 접힌다.** 이름표는 둘째 줄만 남고, 첫 설명 줄은 읽히지 않는다 |
| A4 첫 행 이름표 3줄 | 같은 오판 |
| A2 같은 표, 첫 행 이름표 1줄 | 정상 |
| A3 첫 설명 줄이 마침표로 끝남 | 정상 |

- 실물: 세 권 전권에서 2열 규칙이 열리는 쪽은 그 18쪽뿐이다. 18쪽 모두 머리 행이 있고, 정답 행 100개가 하나도 빠지지 않았으므로(헛 머리 = 행 손실) **걸리는 곳 0**.
- 심각도: **중간(새 책에서)**. 첫 행 일부를 소리 없이 건너뛰고, 원본에는 글이 있으니 사용자가 알아채기 어렵다. 지금 세 권에서는 0.
- 고칠 방향: R6b 조건 (3)의 "바로 아래 줄 옆 이름표 줄"이 **그 이름표 칸의 첫 줄인지**를 본다. 머리 줄 바로 아래(행간 이내)에 이어지는 이름표 줄은 줄바꿈이지 새 행이 아니다. 또는 머리 줄과 아래 줄 사이 간격 > ROW_GAP × 행간을 필수로 한다. 실물 머리 17개는 모두 음영 띠 아래 틈이 있다 — 다음 Plan 에서 18쪽으로 확인.
- 판정: **지금 고치지 않는다 — 다음 Plan.** 새 책을 넣을 때 `--show` 눈 검토 항목으로 둔다.

**B. D10 구멍 — R 표에서 물려받은 띠에 쪽 번호가 없을 때** (새로 찾음)

8i 모양 R 표(4행, 쪽 번호 있음) → 넓은 장 제목 → 아래 띠(2행 + 행 사이 구획 줄). 아래 띠의 쪽 번호가 있을 때와 없을 때를 비교했다.

| | 아래 띠 쪽 번호 있음 | 없음 |
|---|---|---|
| HEAD(8i) | 구획 줄 heading | 구획 줄 heading |
| 지금 + `REQUIRE_REF:true`(되돌림) | heading · **8i 와 바이트 같음** | **body · 8i 와 바이트 다름** |
| 지금 + `REQUIRE_REF:false`(지금) | heading · 같음 | body · 다름 |

- 원인: `inheritFrom` 의 `Rs` 는 물려받은 띠에 있는 R 열 조각만 남긴다(빈 열은 걸러진다). 그래서 R 표 자식이 `det.R = []` 가 되고, `rowsOf`(R5b)·`splitStraddling`(R2b)·`emitBand`(역할 유지)가 `!det.R.length` 로 2열 규칙을 연다. `REQUIRE_REF` 는 보지 않는다.
- 실물: CMDT 21–38 이 이웃 저장본까지 바이트 같으므로 **0**.
- 심각도: **낮음**(실물 0). 다만 spec 이 말한 "R 표는 위 규칙을 하나도 거치지 않는다"와 "되돌림 = `REQUIRE_REF:true`"가 구조로 보장되지는 않는다. RT30·RT31 픽스처에 이 꼴이 없어 테스트도 못 잡는다.
- 고칠 방향(작은 Build): `judge` 에서 2열 표에 `det.two = true` 를 달고, `inheritFrom` 은 부모의 `two` 를 물려준다(R 표 자식은 false). 2열 규칙의 갈림은 `!det.R.length` 대신 `det.two && !R.REQUIRE_REF` 로 한다. 테스트로 위 픽스처 B 를 RT30b(두 설정 모두 8i 와 바이트 동일)로 둔다. **algoVersion 은 그대로**다 — 실물 출력이 바뀌지 않음을 세 권 바이트 비교로 확인하는 조건이다.

## 8i2R-7. 테스트의 힘 · 변이 (`r8i2/mut.mjs`·`mutreal.mjs`, 백업 `r8i2/bak/rowtable.js`)

방식: 정확히 1곳 바꿈 → 전체 테스트(`--test-timeout=60000`, 실행 상한 300초) → 백업에서 복원 → `cmp` 같음(6개 모두). 해시 테스트 IM2·IM6·IM7b 는 `rowtable.js` 가 바뀌면 매번 빨강이라 뺐다. 마지막 열은 같은 변이로 표 쪽 40쪽(CMDT 21–38·42·1319·15쪽, Harrison 5쪽)의 레이아웃이 바뀌는지다.

| # | 변이 (Build N1–N15 에 없는 곳) | 빨개진 테스트 | 실물에서 바뀌는 쪽 |
|---|---|---|---|
| V1 | R5b 행 시작 (i) "P 칸 첫 줄" 조건 끔 | RT29 | C587 |
| V2 | 역할 유지에서 figure-caption 을 지키지 않음 | **없음 — 살아남음** | 0 |
| V3 | R2b "앞 아이템이 P 시작 전에 끝남" 조건 끔 | **살아남음** | 0 |
| V4 | (f) 숨은 열 가드를 R 표에도(D10 깨기) | **살아남음** | 0 |
| V5 | R6b "P 줄 위에 이름표 열·구획 밖 조각이 있으면 아니다" 끔 | **살아남음** | 0 |
| V6 | R1b 캡션 끊기를 R 표 띠에도(D10 깨기) | **살아남음** | 0 |

- 다섯 개 모두 실물 출력이 바뀌지 않는 **방어 조건**이다. 동작 결함이 아니라 테스트 공백이다.
- 다만 V4·V6 은 D10(21–38 바이트 동일)을 지키는 조건인데, RT30 픽스처(RT1·RT14)에는 캡션도 P 열 여러 run 도 없어 잡지 못한다.
- 보강 권장(위 B 와 같은 작은 Build):
  - RT30b: R 표 + 띠 안 캡션 줄 + P 줄 일부가 run 둘 + 쪽 번호 없는 물려받은 띠 → `REQUIRE_REF` 두 값 모두 8i 와 바이트 동일.
  - RT29 에 홀로 선 캡션 둘째 줄의 role 이 figure-caption 인 경우를 단언.
  - RT28 에 P 시작을 넘는 아이템(앞 아이템이 P 시작을 지나 끝남)을 자르지 않음을 단언.
  - RT23 변형: 머리 줄 위 홀로 선 P 밖 조각 → 열 머리 아님.

## 8i2R-8. 실행 · 디스크 · 복사본 · 정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(실행 상한 600초): 처음 2회, 변이 뒤 1회, 모두 **1063/1063**, fail 0. `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 53개 · CSS 4개)", 종료 0.
- 끝에 `rowtable.js` 가 백업과 `cmp` 같음. 앱 파일 diff 는 Build 가 남긴 그대로다(`git status` 변화 없음 — 이 절 추가 외).
- **프로필 복사본 2개**(상한 3):
  - `r8i2/p-new`: 빈 프로필에서 새로 추출, 176 MB.
  - `r8i2/p-old`: `shot-profile/Default` 복사, 40 MB + 블롭.
  - `shot-profile/` 은 읽기만 했다.
- 스크래치패드 `r8i2/` 합계 약 326 MB. C: 여유 158 GB.
- 남은 프로세스:
  - 8000번 서버 `python.exe` **PID 26920** — 내가 띄웠고, 지침대로 켜 두었다.
  - 첫 가져오기 실행을 멈출 때 남은 node(PID 22896)와 Edge 를 `taskkill` 로 정리했다.
  - 끝 `tasklist`: msedge 0. node 는 PID 44020 하나(Adobe — 내 것 아님).
- 권한·훅에 막힌 명령 없음. npm 설치·다운로드·체크아웃·`rm -rf` 없음.

## 8i2R-9. 운영자 결정 필요 사항

1. **[권장: 작은 Build — 지금 또는 다음 작업 전] D10 구멍 막기 + 테스트 보강**(8i2R-6 B, 8i2R-7). 실물 출력은 바뀌지 않으므로 algoVersion 은 그대로 둔다. 커밋은 지금 판 그대로 해도 된다. 막지 않으면 되돌림 스위치 `REQUIRE_REF:true` 가 "8i 그대로"라는 보장이 주석에만 남는다.
2. **[권장: 다음 Plan] R6b 열 머리 오판**(8i2R-6 A). 지금 세 권 0, 새 책에서 첫 행 일부를 소리 없이 건너뛸 수 있다. 다음 Plan 에서 "머리 아래 줄이 이름표 칸의 첫 줄인가" 신호를 18쪽으로 검증해 넣는다. 그 전까지는 새 책을 넣을 때 `measure-rowtable-8i2.mjs --show` 눈 검토에서 "첫 행이 짧아졌나"를 본다.
3. (기록 — 결정 불요) 쪽 끝 "(continued)" 가 마지막 행 설명 뒤에 한 줄 문단으로 읽힌다(7쪽). 캡션 둘째 줄이 표 첫머리에서 따로 읽힌다(1587–1589). 둘 다 8i-2 전에도 읽히던 글이고 짝은 틀리지 않는다.

---

# 8i-2b Review — D10 구멍 막기 + 테스트 보강 (실물 출력 불변) (2026-10-18)

> 지침: `.claude/tasks/medreader-review-8i-2b.md`. Build 보고(`.claude/tasks/medreader-build-8i-2b-report.md`)를 믿지 않고 다시 쟀다. 커밋하지 않았다. 앱 코드·테스트·spec.md 는 고치지 않았다(변이는 되돌리고 `cmp` 로 확인). 원서 인용 없음.
> 기준판: b37c21f = 지금 js 사본에 `git show b37c21f:…/rowtable.js` 를 덮어씀(나머지 js 는 b37c21f 와 같음 — `git diff --stat b37c21f` 확인). 8i = `git archive 246e392` 새로 풂. 스크립트·로그는 스크래치패드 `r8i2b/`. pdf.js 5.6.205(Codex 런타임, 8i-2 와 같은 경로).

## 8i2bR-1. 결론 — **통과**(차단 문제 없음) · 테스트 보강 권장(낮음–중간) 1건

- D10 구멍은 막혔다. 8i2R-6 B 재현 4개(쪽 번호 있음/없음 × `REQUIRE_REF` true/false)가 이제 **모두 8i 와 바이트 같다**. b37c21f 는 "없음" 두 경우가 여전히 다르다(구획 줄 body) — 고친 효과가 맞다.
- 세 권 전권, 내 스크립트(`r8i2b/full.mjs`)로 **다른 쪽 0**: 지금 대 b37c21f, 지금+`REQUIRE_REF:true` 대 8i 모두. rt 쪽은 이웃 저장본을 넘긴 2회차까지 0.
- Build 변이표(V2–V6, D10a–f)를 다시 걸어 **같은 결과**. V2·D10f 는 같은 동작을 내는 변이라는 Build 판단이 맞다.
- **새로 찾은 것(테스트 공백)**: 이번에 새로 생긴 "2열 표시(`two`)를 이어 주는 곳" 세 곳을 지우는 내 변이 M1–M3 가 **테스트를 모두 통과**하는데, **실물은 바뀐다**(CMDT 2026 최대 9쪽, Harrison 최대 2쪽). 지금 코드는 맞다. 다만 앞으로 리팩터링에서 표시가 빠져도 테스트가 못 잡는다(8i2bR-4).

## 8i2bR-2. D10 — 코드 대조

- `isTwo(det, R) = !!(det && det.two) && !R.REQUIRE_REF`. `!det.R.length` 로 가르던 9곳을 줄 단위로 봤다. 모두 `isTwo` 로 바뀌었다: `rowsOf` R5b · `inheritFrom` 통로·(f) · `emitBand` 역할 · `isRefTable` · R1c `ends`·`par` · R7 R1d · R2b · R6b.
- 남은 `det.R.length` 는 `emitBand` 의 쪽 번호 줄 배정 루프 하나다. 갈림이 아니다.
- **R 표에서 물려받은 띠는 2열 경로에 들지 않는다.**
  - `two` 를 다는 곳은 둘뿐이다. `judge` 의 `!Rs.length` 가지와 `inheritFrom` 의 2열 부모 가지다.
  - R 표 부모(`two` 없음)의 자식, 그리고 그 자식의 자식(연쇄)은 모두 `two` 가 없다.
  - `splitStraddling`·R6b 는 `Object.assign` 으로 det 를 다시 만들어 표시를 그대로 옮긴다. 둘 다 `isTwo` 띠에서만 돈다.
- **`REQUIRE_REF:true` 에서 2열 경로는 완전히 닫힌다.**
  - `judge` 는 `!Rs.length` 면 `noRef` 로 먼저 떨어진다. 그래서 `two` 가 생기지 않고, `isTwo` 도 스위치로 거짓이 된다.
  - R1b·R1c `capBreak` 는 `!R.REQUIRE_REF` 로 닫힌다. R1c 는 `ends` 가 비어 통째로 건너뛴다.
  - 8i 대비 다른 추가분(`cap` 필드, `bandsOf` opt)은 위 갈림 안에서만 쓰인다.
- 재현(`r8i2b/repro.mjs` = `r8i2/repro.mjs` B + b37c21f 줄 추가):

| 아래 띠 쪽 번호 | 8i | 지금+REF true | 지금+REF false | b37c21f+REF true | b37c21f+REF false |
|---|---|---|---|---|---|
| 있음 | heading | heading · 같음 | heading · 같음 | 같음 | 같음 |
| 없음 | heading | **heading · 같음** | **heading · 같음** | body · 다름 | body · 다름 |

## 8i2bR-3. 실물 불변 (`r8i2b/full.mjs` — 쪽마다 네 판, JSON 바이트)

| 책 | 쪽 | 지금 대 b37c21f | 지금+REF true 대 8i | rt 쪽·줄 (지금 / +REF) | 이웃 2회차(rt 쪽) | 시간 |
|---|---|---|---|---|---|---|
| CMDT 2026 | 1,967 | **0** | **0** | 33·1,904 / 18·1,314 | 33쪽 · 둘 다 0 | 46초 |
| CMDT 2021 | 5,051 | **0** | **0** | 0 / 0 | — | 48초 |
| Harrison | 729 | **0** | **0** | 3·78 / 0 | 3쪽 · 둘 다 0 | 11초 |

- `REQUIRE_REF:true` 는 `buildPageLayout` 넷째 인자로 줬다. 그 판에서 2열 표가 사라지는 것(Harrison rt 3 → 0, CMDT 33 → 18)으로 설정이 실제로 먹힌 것을 확인했다.
- 2회차는 같은 판의 1회차 저장본을 이웃으로 넘겼다(앱과 같음).

## 8i2bR-4. 테스트의 힘 · 변이 (`r8i2b/mut.mjs`, 백업 `r8i2b/bak/`)

방식: 레포 `rowtable.js` 를 정확히 1곳 바꾼다 → 전체 테스트(`--test-timeout=60000`, 실행 상한 300초) → 백업에서 복원 → 바이트 비교. 18개 모두 복원이 같았고, 끝 `cmp` 도 같다. 해시 테스트 IM2·IM6·IM7b 는 늘 빨강이라 뺐다. 실물 열은 변이를 스크래치 사본(`r8i2b/mut/<id>`)에 걸고 `full.mjs` 로 CMDT 2026·Harrison 을 잰 결과다.

| # | 변이 | 빨개진 테스트 | 실물 바뀐 쪽 |
|---|---|---|---|
| V2 | 역할 유지에서 figure-caption 안 지킴 | 없음 | 0 |
| V3 | R2b "앞 아이템이 P 시작 전에 끝남" 끔 | RT28b | — |
| V4 | (f) 숨은 열 가드를 R 표에도 | RT30c·RT30e | — |
| V5 | R6b "P 줄 위 바깥 조각" 검사 끔 | RT23b | — |
| V6 | R1b 캡션 끊기를 R 표 띠에도 | RT30d·RT30e | — |
| D10a–e | Build 와 같은 다섯 꼴 | 모두 RT30b·RT30e | — |
| D10f | `isTwo` 가 스위치를 안 봄 | 없음 | 0 |
| M1 | `inheritFrom` 2열 가지가 자식에게 `two` 를 안 줌 | **없음** | **C 45·587·1587–1589·1653 (6쪽)** |
| M2 | R2b 뒤 det 에서 `two` 가 빠짐 | **없음** | **H75 · C45·1588** |
| M3 | R6b 뒤 det 에서 `two` 가 빠짐 | **없음** | **H412·542 · C587·810·1587·1589·1653·1659·1661·1681·1683** |
| M4 | `isTwo` = 표시 **또는** R 열 빔(스위치는 봄) | RT30b·RT30e | — |
| M5 | `isRefTable` 을 옛 `det.R.length` 로 | 없음 | 0 |
| M6 | `inheritFrom` 이 스위치 없이 `d0.two` 만 | 없음 | 0 |
| M7 | R7 R1d 갈림만 옛 `!par.det.R.length` 로 | 없음 | 0 |

- **V2·D10f 판정: Build 주장이 맞다. 닿을 수 없는 방어다.**
  - V2: 2열 경로는 `!REQUIRE_REF` 에서만 열린다. 그때는 R1b·R1c·R1d 의 모든 띠 만들기가 캡션 조각에서 끊는다. 캡션이 남는 띠는 R 표 띠뿐인데, R 표 띠는 `two` 가 없다.
  - 내 탐침(`r8i2b/probe.mjs` P2): 2열 표의 맨 위·행 사이(이름표 열·P 열)·맨 아래에 캡션 꼴 줄을 넣었다. 4꼴 모두 캡션이 표 밖이고 V2 대 지금 바이트가 같다. 실물도 0이다.
  - D10f: `REQUIRE_REF:true` 면 `two` 가 생기지 않는다. 그래서 같은 동작이다(P3 탐침 같음, 실물 0).
  - 다만 `rowsOf` 를 서로 다른 설정으로 직접 부르면 다를 수 있다. 그렇게 부르는 곳은 앱·테스트에 없다.
  - M5·M6·M7 도 같은 동작을 내는 꼴로 보인다. M5·M6 은 구조상 같다. M7 은 R 표 연쇄 손주 띠 + 두 줄 연속 가로지름이 있어야 갈린다(탐침·실물 0).
- **M1–M3 (새로 찾은 공백, 낮음–중간)**
  - 8i-2 까지는 `R: []` 자체가 2열 표시였다. 8i-2b 는 표시를 `two` 로 따로 뺐다. 그래서 det 를 다시 만드는 세 곳(`inheritFrom` 2열 가지, R2b·R6b 의 `Object.assign`)이 표시를 옮겨야 한다.
  - 지금은 셋 다 옮긴다. 그래서 실물은 b37c21f 와 0 이다. 그러나 셋 중 하나라도 빠지면 테스트 1069개가 모두 통과한다. 그 사이 실물 최대 11쪽이 바뀐다(물려받은·쪼갠·머리 접은 2열 띠가 R 표 경로로 떨어진다 — 구획 줄 heading, 이름표 R5b 안 쪼갬, 행 합침).
  - 합성 재현(P1, 지어낸 낱말): 2열 표 → 넓은 줄 → 물려받은 띠.
    - 구획 줄이 있을 때(P1a): 지금은 body, M1 은 heading 이다.
    - 두 줄 이름표 행이 있을 때(P1b): M1 은 다음 행 이름표를 앞 행에 붙인다("… Vendo Oskat" 한 칸).
  - 보강 권장: 아래 셋을 단언하는 픽스처 세 개.
    - P1a 꼴: 2열 부모의 R7 자식 띠의 구획 줄이 body 다.
    - RT28 꼴 + 띠 안 구획 줄: R2b 뒤에도 2열 역할 유지.
    - RT23 꼴 + 띠 안 구획 줄 또는 R5b 행: R6b 뒤에도 2열.
  - 작은 테스트 Build 로 충분하고, 앱 코드·algoVersion 은 그대로다.

## 8i2bR-5. 새 테스트 점검

- 낱말: 모두 지어낸 낱말이다(Zorvat·Plonitis·Drevalacia·Pekalosis·xenoplast …). "Lesions·Goiter·Figure 3·CHAPTER 3" 같은 흔한 낱말이 섞였지만, 원서 문장은 아니다.
- 기준값 확인: 새 테스트 파일을 8i 코드 트리와 b37c21f 트리 옆에 복사해 돌렸다.
  - 8i 코드: RT30b·RT30d·RT30e·RT28b 통과. 그래서 `D10_8I` 상수는 실제로 8i 출력이다. RT23b·RT30c 는 8i 에 2열 규칙·`HIDDEN_COL` 이 없어 전제에서 떨어진다(예상대로).
  - b37c21f 코드: RT30b·RT30e 만 빨강이다. 이 둘이 D10 구멍을 잡는 테스트가 맞다.
- RT31 목록에 넣은 RT23b·RT28b: 둘 다 쪽 번호 없는 2열 픽스처다. `REQUIRE_REF:true` 면 표가 없어 "7b 없을 때와 동일"이 맞는 기대다. **적절하다.**
  - RT30b–e 는 R 표라 7b 없을 때와 다르다. 그래서 RT31 에 넣지 않은 것이 맞다. 이 넷은 TWO=REF 바이트 동일로 지킨다(RT30b 는 8i 상수까지 본다).
- 작은 메모(고칠 것 아님): RT30c·RT30d 는 "8i 와 같다"를 TWO=REF 바이트와 몇 가지 단언으로 지킨다. 8i 출력 자체와 대조하지는 않는다. 둘 다 바뀌는 변이는 RT30·쪽 번호 수·이름표 단언에 기댄다.

## 8i2bR-6. 실행 · 정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(실행 상한 600초): **2회 모두 1069/1069**, fail 0(6.2초·6.1초).
- `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 53개 · CSS 4개)", 종료 0. `index.html` 의 diff 는 rowtable 해시 1줄뿐이다.
- 끝에 `rowtable.js`·`rowtable-8i2.test.mjs` 가 백업과 `cmp` 같다. 레포에서 내가 바꾼 것은 이 절뿐이다. `spec.md`·`measure-search-8g.mjs`(8g Plan 쪽)는 건드리지 않았다.
- 남은 프로세스: 내가 띄운 것은 모두 끝났다. 끝 `tasklist`: node 1개(PID 13884 — Build 보고의 Adobe, 내 것 아님), msedge 0, python 0. 브라우저·프로필 복사는 없었다.
- 스크래치 `r8i2b/` 13 MB, C: 여유 159 GB.
- 권한·훅에 막힌 명령은 없다. npm 설치·다운로드, checkout/restore/stash, `rm -rf`, 커밋은 하지 않았다.

## 8i2bR-7. 운영자 결정 필요 사항

1. **[권장: 작은 테스트 Build — 다음 rowtable 작업 전]** M1–M3 공백 메우기(8i2bR-4). 2열 표시가 물려받기·R2b·R6b 뒤에도 남는지를 픽스처 셋으로 지킨다. 앱 코드는 그대로다. 지금 판은 맞으므로 **커밋은 그대로 해도 된다.**
2. (기록) V2·D10f(그리고 내 M5·M6·M7)는 같은 동작을 내는 방어 코드다. 지울지는 운영자 판단이다(지워도 출력은 같다).
3. (8i-2 Review 그대로) R6b 열 머리 오판은 다음 Plan 의 일이다.

---

# 8g-1 Review — 검색 데이터 단계 (text/screen.js 옮김 · DB 3 · searchText · versionchange 배너) (2026-10-19)

> 지침 `.claude/tasks/medreader-review-8g-1.md`. Build 와 분리된 검증자다. Build 보고는 믿지 않고 직접 다시 쟀다.
> 대상: 커밋 `165f2b9` 위의 작업 트리(바뀐 파일 18 + 새 파일 4), 단계 1 스냅숏 `b8g1/step1/`.
> 스크래치 `r8g1b/`만 썼다(첫 Review 의 `r8g1/`은 보지 않았다). 앱 코드·테스트·spec 은 고치지 않았다. 커밋하지 않았다.

## 8g1R-1. 결론 — **통과**(차단 문제 없음) · 테스트 보강 권장(낮음) 3건 · spec 문안 제안 2건은 맞다

- 단계 1 은 **옮김만**이다. 옮긴 함수 7개와 상수 2개가 `165f2b9` 와 글자 하나까지 같다. 단계 1 스냅숏만으로 1071/1071 녹색이다.
- spec 17-8-12 의 8g-1 범위(S1–S7, U1–U7·U8·U11·U14, G4)를 코드가 그대로 따른다.
- 세 권 실물: `pages` 는 옛 판과 **값이 같다**(7,747쪽 전부). 저장 글자는 **옛 판 함수로 따로 만든 화면 글자**와 전 쪽 같다. `searchText` 크기는 Plan ±1% 안이다.
- 브라우저(실제 IndexedDB): DB 2 → 3 업그레이드 뒤 옛 스토어 레코드 **전부** 바이트 단위로 같다. 새 쪽만 `searchText` 를 얻는다. 새 판 두 탭에서 배너·[다시 불러오기]·아랍어 RTL 이 맞다.
- 내 변이 9개 중 5개 빨강, 1개는 시간 초과로만 빨강, 3개 살아남음(전부 낮음 — 8g1R-5).
- 전체 1100/1100 × 3회, `stamp --check` 0.

## 8g1R-2. 단계 1 — 옮김만인가

- 스냅숏 무결성: `b8g1/step1-sha.txt` 6개 모두 OK.
- **함수별 비교**(`r8g1b/fncmp.mjs`): `165f2b9` 의 `ui/reader.js`·`tts/text.js` 에서 `describePage`·`paraBlock`·`flowParasOf`·`joinPieces`·`localRange`·`textOf`·`str` 본문을 잘라 `screen.js` 의 것과 비교했다. **7개 모두 같다.** `FOLD_ROLES`·`REF_ROLE` 선언 줄도 같다.
- **정렬 비교**: 두 옛 파일에서 빠진 줄은 모두 `screen.js` 에 있다. 예외는 `import { joinHyphen } from '../text/hyphen.js'` 하나로, 경로만 `./hyphen.js` 로 바뀌었다. `screen.js` 에만 있는 줄은 머리 주석·빈 줄·내부 도우미 `textOf`·`str` 사본뿐이다.
  - 도우미 둘은 **옮긴 것이 아니라 복사**했다. `reader.js` 는 `textOf` 를 다른 함수(다시 그리기 대응)가 쓰므로 남겼고, `tts/text.js` 는 `str` 를 남겼다. 사본은 글자까지 같다. 비공개 함수라 동작에 영향이 없다.
- 옛 두 파일의 남은 변경은 import 한 줄과 `export { … }` 한 줄씩뿐이다. 같은 함수 객체인지는 S3 테스트(`===`)가 본다(녹색).
- `screen.js` 가 `document`·`window`·`indexedDB`·`fetch`·`localStorage`·`navigator`·`location` 을 참조한 곳은 0 이다.
- **`split-contract-8a` 수정은 약해지지 않았다.**
  - 옛 판은 `flowParas()` 부터 `export function flowParasOf(` 앞까지 잘랐다. 그 사이에 flowParasOf 의 JSDoc 주석이 끼어 있었다.
  - 새 판은 `flowParas()` 부터 그 함수 끝(`\n}\n`)까지 자른다. 그래서 검사 범위가 **정확히 그 함수 본문**이다. 두 단언(`insertTableNotices(flowParasOf(state.desc)` 있음, `for (` 없음)도 그대로다.
- **단계 1 스냅숏만으로 녹색**: `git archive 165f2b9 apps/medreader` 에 스냅숏 6개를 덮은 사본(`r8g1b/step1repo/`)에서 돌렸다.
  - 전체 **1071/1071**
  - `stamp --check` 0(모듈 54)
- 포크가 섞은 흔적은 없다.
  - 22개 파일의 sha 를 시작할 때 `r8g1b/base-sha.txt` 에 적었다. 끝에서 다시 대조해 모두 같았다.
  - 단계 1 이후 바뀐 파일은 `index.html`(stamp 와 `search.js` 한 줄)과 `search-text-8g.test.mjs`(S1·S2·S7·S8·S12·S17 추가)뿐이다.
  - 변이 표식 grep 결과는 0 이다.

## 8g1R-3. spec 대조

| 항목 | 판정 | 근거 |
|---|---|---|
| `search.js` 여덟 함수 | ○ | `searchRecordOf(F, desc?, opts?)`·`foldText`·`parseQuery`·`findIn`·`classifyHit`·`snippetAt`·`rangesFor`·`headingToc`. 도우미로 `hitLength`·`headKey`·`headsOf`·`headFreq`·`isWordChar`·`searchKey`·`compoundPrefixes` 도 있다. import 는 `config`·`store`·`screen` 뿐이다(S3 grep). |
| U7 합성어 | ○ | 접두는 `KEEP_HYPHEN_PREFIXES` 에서 3자 이상인 23개다(`co`·`re`·`x`·`t`·`b`·`de`·`ex` 제외). 한 낱말이면 띄운 꼴을, "p␣나머지" 꼴이면 붙인 꼴을 더한다. 나머지는 3자 이상이어야 한다. 낱말 전체 일치(3자 이하) 검색어에는 붙이지 않는다. 탐침: `preeclampsia`↔`pre eclampsia`, `nonsense`→`non sense`, `post-op` 는 변형 없음(나머지 2자). |
| U8 소제목 강등 | ○ | `classifyHit`: 빈도가 `>= REPEAT_HEADING`(10) 이면 'body'. `headingToc`: `< 10` 만 남긴다. |
| U11 숫자 붙이기 | ○ | `DIGITS_ONLY` 항목에 같은 쪽 바로 다음 heading(반복 제목 포함 전체 목록 기준)을 붙인다. |
| 검색 대상(G4) | ○ | `text` = 흐름 문단(본문·heading·rowhead·인용). `ref` 는 `describePage` 가 접거나 이름표 `refs` 로만 보내고, `flowParasOf` 는 `lines` 만 본다. 그래서 구조로 빠진다. `colhead`·접힌 역할도 빠진다. `table` 은 4-8 영역 줄뿐이다. 실물 세 권: `describePage` 가 표 블록으로 보내는 줄 **집합**과 `table` 이 0 차이(8g1R-4). |
| `config.SEARCH` | ○ | 이름·값이 17-8-12 §1 끝 목록과 같다. |
| `db.js` | ○ | `DB_VERSION 3`(내리지 말라는 주석, S4 가드), 스키마 표 `searchText`(`[docId,pageNo]`·`docId`·`docId_sk`), `MIGRATIONS[3]` = `reconcileSchema`, `CASCADE_STORES`·`DERIVED_STORES` 에 searchText, `ERR.UPGRADED`. "버전 내림 방지"는 코드가 아니라 **테스트 가드**(S4 `>= 3`, D1·DP13 `=== 3`)다. spec §9 가 정한 그대로다. |
| `extract.js` | ○ | `writePageAndSearch` 가 `db.withTx(['pages','searchText'], 'readwrite')` 한 번으로 둘 다 쓴다. `_buildAndStore` 의 유일한 쓰기다. `_recomputeRoles` 는 `_buildAndStore` 를 부른다. `sk` = `SEARCH_KEY` = `'1|d1:9e94752b'`(실물 확인). `ENABLED=false` 면 만들지 않고 같은 트랜잭션에서 그 쪽 검색 글자를 지운다. 검색 레코드를 만들다 던지면 트랜잭션을 열기 전에 던지므로, 그 쪽은 `pages` 도 없이 `failed` 로 간다. 같은 저장본을 리더가 같은 함수로 그리므로 리더도 그 쪽에서 던졌을 경우라 새 위험은 아니다. |
| `main.js` 배너 | ○ | `versionchange` → `showBanner({code: ERR.UPGRADED, actions:[{reload:true, key:'common.reload'}]})`. 같은 키는 한 번만 뜬다(브라우저 `nBanner 1`). |
| i18n 네 언어 | ○ | `err.dbUpgraded` 를 ar·en·fr·ko 에 넣었다. `ERROR_KEYS` 에 더했다. |
| `common.reload`(spec 밖) | **적절** | spec §4-6 의 "기존 [다시 불러오기]"는 `index.html` 부팅 실패 안내의 정적 다국어 버튼(`#bootFailReload`)이다. i18n 키가 아니다. JS 배너 버튼은 i18n 키가 있어야 언어 전환(`relabelBanners`)을 따른다. 그래서 새 키가 맞다. 기존 키 중 같은 뜻은 없다(grep). |
| `settings.js` | ○ | `search.recent: []`. `defaultFor` 가 배열을 복사해 돌려준다(테스트 있음). `search.aiQuery` 는 없다. |

## 8g1R-4. 측정 재현 — 세 권, 내 스크립트(`r8g1b/m8g1.mjs`)

**방법**
- 실제 `Extractor` 로 전권을 추출했다(이웃 레이아웃 + 역할 재계산). 저장소는 `tests/fixtures/fake-idb.mjs`.
- 판 둘을 따로 돌렸다.
  - 옛 판: `git archive 165f2b9` 사본(`r8g1b/old165/`)
  - 새 판: 작업 트리
- pdfjs-dist 5.6.205(`C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`)를 썼다.
- `pages`: `extractedAt` 만 빼고 정규 문자열(키 정렬, -0·undefined 구분)로 만들어 쪽별 sha 를 비교했다.
- `searchText` 의 기준은 Build 와 다르게 잡았다. **옛 판(165f2b9)의 `ui/reader.js`·`tts/text.js` 함수**로 화면 글자·heads 오프셋·표 줄을 따로 계산해 비교했다. 출력은 수치·해시뿐이다.

| | Harrison 729 | CMDT 2026 1,967 | CMDT 2021 5,051 |
|---|---|---|---|
| 추출(옛/새) | done · 오류 0 · 17/18초 | done · 0 · 62/65초 | done · 0 · 81/81초 |
| `pages` 값 — 옛 ↔ 새, 쪽별 | **0쪽 다름** | **0쪽 다름** | **0쪽 다름** |
| 전체 정규 sha(옛 = 새) | `8f545fc7…` | `1699b2f6…` | `b90c3522…` |
| searchText 레코드 · 빠짐 | 729 · 0 | 1,967 · 0 | 5,051 · 0 |
| **text = 화면 글자**(옛 판 함수) | 729/729 | **1,967/1,967** | 5,051/5,051 |
| heads (i, o) = 옛 판 흐름 문단의 heading | 0 차이 · 1,017 | 0 차이 · 12,194 | 0 차이 · 5,997 |
| heads `r` = 0 인 것 | 0 | 0 | 0 |
| table 줄 집합 = describePage 표 블록 줄 | 0 차이 | 0 차이(**순서만 14쪽 다름**) | 0 차이 |
| `sk`·`algoVersion`·`docId` 어긋남 | 0 | 0 | 0 |
| searchText v8 | **5.65MB** (Plan 5.6 · +0.9%, Plan 반올림 탓) | **19.75MB** (Plan 19.7 · +0.25%) | **18.94MB** (Plan 18.9 · +0.2%) |
| text / table 글자 | 2,843,648 / 70,877 | 8,928,189 / 757,419 | 9,551,236 / 0 |

- **세 권 모두 Plan ±1% 안이다.** heads `r` 분포도 Plan 표와 맞는다. CMDT 2026 의 1.15–1.4 층이 5,704개로 Plan 표의 수와 같다.
- 표 줄 순서(정보, 결함 아님): CMDT 2026 14쪽에서 `searchRecordOf` 의 표 줄 순서가 화면 줄 순서와 다르다. `searchRecordOf` 는 영역 `lineIds` 순, 화면은 쪽 줄 순이다. spec 은 순서를 정하지 않았다. 줄 사이는 `'\n'` 이라 구 일치가 줄을 넘지 않는다. 그래서 적중 수에는 영향이 없다. 영향은 표 조각의 앞뒤 줄뿐이다.
- **v8 직렬화가 불안정하다는 Build 관찰은 맞다.**
  - 같은 객체를 두 번 직렬화하면 같다.
  - 그러나 `v8.serialize(c)` 와 `v8.serialize(structuredClone(c))` 는 쪽 75/6/4개에서 바이트가 다르다(CMDT 2026/Harrison/CMDT 2021, 옛 판 기준).
  - 값이 같은 옛·새 `pages` 도 v8 바이트가 5/0/1쪽 다르다.
  - 원인 재현: 같은 값 1 을 정수 표현과 실수 표현으로 두면 v8 바이트가 다르다(`{a:1}` 대 `{a:0.5+0.5}`). 그래서 **값 비교로 판정한 것이 옳다.**

## 8g1R-5. 찾은 문제 · 관찰

차단 문제는 없다. 아래는 모두 **낮음** 또는 정보다.

1. **[낮음 — 테스트 공백] `SEARCH.ENABLED=false` 갈래**(변이 R2 살아남음)
   - 옛 검색 글자를 지우는 `else s.searchText.delete(...)` 를 빼도 모든 테스트가 녹색이다. S5 는 소스에 `SEARCH.ENABLED` 가 있는지만 본다.
   - 이 갈래는 되돌림 스위치(§9)라서 쓰일 때는 이미 문제가 난 때다.
   - `writePageAndSearch` 에 스위치를 인자로 받는 시험 지점을 두거나, 순수 함수로 떼어 내 행동을 시험하기를 권한다.
2. **[낮음 — 테스트 공백] 3자 검색어 낱말 전체 경계**(변이 R5 살아남음)
   - `whole = f.length <= 3` 을 `< 3` 으로 바꿔도 녹색이다. S8 은 2자 `mi` 만 본다. spec 17-8-4 의 "3자 이하 낱말 전체"는 경계값 3 이 핵심이다.
   - 같은 꼴: 대문자 약어 상한 5 → 6(R9, 매우 낮음).
   - 8g-2 의 S8 표 테스트에 `the`(3자 — `there` 를 안 찾음)·`COPD5`/`ABCDEF` 를 더하기를 권한다.
3. **[낮음 — 테스트 강도] versionchange 에서 연결을 닫지 않는 변이**(R7)
   - 이 변이는 `--test-timeout` 에 걸려 **취소 1** 로만 빨강이 된다. 흉내가 blocked 뒤 영영 기다리기 때문이다.
   - S6 테스트에 짧은 시간 상한(예: 2초 안에 열리지 않으면 실패)을 두면 원인이 바로 보인다.
4. [정보] **fake-idb 의 관대함**
   - 복합 키의 한 칸이 `undefined` 여도 흉내는 받아들인다(`["X",null]` 로 저장). 실제 IndexedDB 는 `DataError` 로 거절한다(브라우저에서 확인).
   - DataError 를 흉내는 요청 단계(비동기)에서, 실제는 `put` 호출 때(동기) 던진다. 두 꼴 모두 `withTx` 가 abort 로 처리한다.
   - 지금 테스트가 이것 때문에 헛통과하지는 않는다. 변이 R8(검색 레코드에서 `pageNo` 빠뜨림)은 S5 가 키로 `peek` 해서 빨강이 된다.
   - 흉내의 업그레이드·versionchange·롤백 순서는 실제와 같았다. 브라우저에서 같은 결과를 확인했다.
   - 8g-2 백필 테스트(`docId_sk` 범위)를 쓸 때 이 차이를 기억하라.
5. [정보] `foldText` 는 spec 표에 없는 `′ ″ ‛ ‟`(프라임·뒤집힌 따옴표)도 곧은 따옴표로 접는다. 길이를 보존하므로 무해하다.
6. [정보] 합성어 변형에는 이론상 거짓 양성이 있다. 예: `present` → `pre sent`, `interest` → `inter est`. spec U7 규칙 그대로이고, 원문에 "pre sent"처럼 띄어 쓴 꼴이 있어야 맞는다. 실물 영향은 무시할 만하다.
7. [정보] `main.js` `showBanner` 의 주석은 "동작은 `data-nav` 전역 위임이 맡는다 — 여기서 onclick 을 붙이지 않는다"이다. 그런데 새 [다시 불러오기]는 `addEventListener` 로 붙인다. 동작 문제는 없으니 다음에 주석만 고치면 된다.
8. [기록 — spec] §9 첫째 줄 "추출은 `searchText` 를 계속 써도 무해"와 셋째 줄 "`SEARCH.ENABLED` 를 추출에서도 본다"가 엇갈린다.
   - 코드는 셋째 줄을 따랐고, 옛 글자를 지우는 일까지 더했다.
   - 결과로 스위치 하나가 입구 숨기기와 추출 끄기를 함께 맡는다. "입구만 숨기고 검색 글자는 계속 쌓기"는 이 스위치로 할 수 없다.

## 8g1R-6. 브라우저 — Edge headless · 412×915 · 캐시 끔 (`r8g1b/br8g1.mjs`, 로그 `br-prof1.log`)

**환경**
- PID 45124 서버는 없었다(PC 재시작). 그래서 레포 루트에서 `python -m http.server 8000 --bind 127.0.0.1` 을 직접 띄웠고(PID 41152, 상한 25분), 끝에 껐다.
- 새 프로필은 `r8g1b/prof1` **하나만** 썼다.
- 옛 판 탭은 같은 출처에서 요청을 가로채 `old165/` 파일 57개를 내보냈다.
- 문서는 내가 만든 지어낸 6쪽 PDF `mek6.pdf` 다(Helvetica, 쪽마다 heading 1개, 줄바꿈 하이픈 `cardio-`/`vascular`).
- 진짜 키·AI 요청은 0 이다. 외부 요청 차단 기록도 0 이다.

**A. 옛 판(DB 2)**
- 가져오기 → 2쪽 → 추출 끝 → `aiCache`·`progress` 하나씩 넣음 → 다시 불러옴 → 5·6쪽 저장본 지움 → extraction 을 "4쪽까지·paused"로 바꿈.
- 저장 DB 2, 스토어 13. lastPage 2, lastLineId 있음.

**B. 옛 탭을 연 채 새 판 탭**
- 새 탭이 555ms 에 부팅했다(막힘 없음, 두 탭 모두 배너 없음).
- 저장 DB 3, 스토어 14. 새 스토어는 `searchText` 하나다.
- **옛 스토어 13개의 레코드 전부가 업그레이드 전과 정규 문자열로 같다**(바뀐 스토어 0). 스키마는 `["docId","pageNo"]` · `docId` · `docId_sk ["docId","sk"]` 다.
- 옛 탭의 다음 DB 일은 `ERR_DB_OPEN/VersionError` 다. **옛 탭에는 배너가 없다** — 165f2b9 에는 배너 코드가 없다. 조용히 실패한다.
- 문서를 열자 5·6쪽이 추출되었다(done).
  - **`searchText` 는 5·6쪽에만** 있다. `sk` 가 맞고, 화면 글자와 같고, heads 1, algoVersion 이 같고, `cardiovascular` 로 붙어 있다.
  - 1–4쪽은 searchText 가 없다(백필은 8g-2 몫).
  - 1–4쪽 `pages` 값과 `aiCache`·`progress`·`settings`·`blobs` 가 그대로다.
  - lastPage 는 2 → 4 다. 4쪽을 열었으므로 맞다.
- 실제 IndexedDB 에 `pageNo` 없는 searchText 를 `put` 하면 `DataError` 다(8g1R-5 의 4).

**C. 새 판 탭 둘 — n2 가 `indexedDB.open('medreader', 4)`(가짜)**
- 막힘 없이 열렸다(`blocked:false`).
- **n1·n2 모두** `err.dbUpgraded` "앱이 새 판으로 바뀌었습니다. 다시 불러오세요." + [다시 불러오기](`data-reload="1"`)가 떴다. 배너는 탭마다 1개다.
- 버튼 상자 136×48, `scrollWidth 412 = innerWidth`. 캡처: `c-ko.png`
- 아랍어로 바꾸면 문구 "تم تحديث التطبيق…", 버튼 "إعادة التحميل", `dir=rtl`, 넘침 없음. 캡처: `c-ar.png`. 배너가 오른쪽 정렬이고 버튼 두 개가 왼쪽에 놓인다.
- 버튼을 누르면 **다시 불러온다.** 다시 불러온 뒤에는 DB 가 시험용 4 라서 `err.dbOpen` 이 뜬다. 기대대로다.

콘솔 오류는 옛 탭의 404 하나뿐이다(앱 밖 요청). 새 탭 둘은 0 이다.

## 8g1R-7. 테스트의 힘 — 내 변이 (`r8g1b/mut.mjs`, 백업 `r8g1b/bak/`, 대상 7파일)

Build 가 한 V1–V10·V13·V14 와 겹치지 않는 자리만 골랐다.

| # | 변이 | 결과 |
|---|---|---|
| R1 | `CASCADE_STORES` 에서 `searchText` 뺌 | 빨강 2 (S4 가드 · deleteDocument) |
| R2 | `ENABLED=false` 의 옛 글자 지우기 제거 | **살아남음** (8g1R-5 의 1) |
| R3 | `main.js` versionchange 배너 배선 제거 | 빨강 1 (S6 main.js) |
| R4 | 소제목 강등 문턱 `>=` → `>` | 빨강 1 (S12) |
| R5 | 3자 검색어 낱말 전체 → 접두 | **살아남음** (8g1R-5 의 2) |
| R6 | `MIGRATIONS[3]` 이 빈 함수 | 빨강 5 (S4 업그레이드 · S4 삭제 · S5 셋) |
| R7 | versionchange 에서 `db.close()` 안 함 | 시간 초과 취소 1 (S6 — 60초) (8g1R-5 의 3) |
| R8 | 검색 레코드에서 `pageNo` 빠뜨림 | 빨강 3 (S2 · S5 둘) |
| R9 | 대문자 약어 상한 5 → 6 | **살아남음** (매우 낮음) |

- 변이마다 복원 뒤 `cmp` 가 같았다. 끝에 22개 파일 sha 를 `base-sha.txt` 와 대조해 **모두 같았다.** 변이 표식 grep 은 0 이다.
- R1·R6 은 S4 가 소스 grep 이 아니라 **행동**(실제 삭제·업그레이드)으로도 잡는다. 좋은 강도다.

## 8g1R-8. 전체 테스트 · 정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(실행 상한 600초): 변이 전 2회와 변이 뒤 1회, **세 번 모두 1100/1100**, fail 0.
- `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 55개 · CSS 4개)", 종료 0.
- 레포에서 바꾼 것은 이 절뿐이다(review.md 끝). spec·앱 코드·테스트는 그대로다.
- 남은 프로세스: 내가 띄운 node·Edge(PID 37864)·python(41152)은 모두 끝났다. 끝 `tasklist` 에 node 1개(PID 43840)가 남아 있는데, Adobe Creative Cloud 의 것이라 내 것이 아니다. msedge 0, python 0.
- 스크래치 `r8g1b/` 28MB(옛 판 사본 둘·프로필 하나 포함), C: 여유 158GB.
- 권한·훅에 막힌 명령은 없다. 커밋·checkout/restore/stash·`rm -rf`·npm·다운로드는 하지 않았다.

## 8g1R-9. Build 의 spec 문안 제안 판정

1. **S6 "옛 판 탭" → "8g-1 이후 판 탭" — 맞다.**
   - 165f2b9 탭에는 `versionchange` 배너 코드가 없다. 그 탭의 다음 DB 일은 `VersionError` 로 조용히 실패한다(8g1R-6 B 에서 재현).
   - S6 이 확인할 수 있는 것은 "8g-1 이후 판 탭 둘 중 하나가 더 높은 버전으로 열 때"(C)뿐이다.
   - 문안에 한 줄을 더하기를 권한다: "**2 → 3 첫 배포 때 이미 열려 있던 옛 탭은 배너 없이 다음 DB 일에서 실패한다(되돌릴 수 없는 한 번 — 다시 불러오면 낫는다).**"
2. **§4-6 키 수 38 → 39 — 맞다.**
   - spec 표의 `search.*` 를 세면 37개다(open·title·scope×2·input×2·clear·tab×2·recent·group×3·page×2·count·minChars·tooMany·empty·scriptHint·partial·continuePrep·preparing·library.doc·toc×4·band×6·notOnPage·inTable·paused).
   - 여기에 `err.dbUpgraded` 와 `common.reload` 를 더하면 39 다. `common.reload` 는 적절하다(8g1R-3).
   - 8g-1 이 실제로 더한 키는 2개 × 4언어다.

## 8g1R-10. 운영자 결정 필요 사항

1. **커밋**: 지금 판은 그대로 커밋해도 된다. 단계 1 은 스냅숏 6개 그대로 먼저 커밋할 수 있다(그것만으로 1071 녹색 · stamp 0 — 8g1R-2). 단계 2 는 그다음 커밋이다.
2. **spec 문안 두 개 반영 승인**(8g1R-9). S6 에는 첫 배포 때의 옛 탭 한계 한 줄을 함께 넣기를 권한다.
3. **[기록] 첫 배포(2 → 3) 위험 받아들이기**: Nour 기기에서 새 판이 뜰 때 옛 판 탭이 함께 열려 있으면, 그 옛 탭은 배너 없이 멈춘 것처럼 보인다. 다시 불러오면 낫는다. 이 단계 코드로는 막을 수 없다(옛 코드의 일이다). 배포 안내에 "앱 탭을 하나만 열고 새로 고침"을 적을지 정해 주세요.
4. **[권장 — 8g-2 Build 에 함께]** 테스트 보강 세 가지(8g1R-5 의 1–3):
   - `ENABLED=false` 행동 테스트
   - 3자·약어 길이 경계
   - S6 의 짧은 시간 상한

   앱 코드는 그대로다.
5. [기록] §9 스위치 문안의 엇갈림(8g1R-5 의 8)을 정리할지 정해 주세요. 입구 숨김과 추출 끔을 따로 둘지는 8g-4 때 정해도 된다.

---

# 8i-2c Review — `two` 표시 옮기는 세 곳 테스트(RT33–RT35) (2026-10-19)

> 지침 `.claude/tasks/medreader-review-8i-2c.md`. Build 와 분리된 검증자다. Build 보고는 믿지 않고 다시 쟀다. 앱 코드·테스트는 고치지 않았다(변이는 되돌리고 `cmp`). 커밋하지 않았다. 스크래치 `r8i2c/`(8.1 MB)만 썼다.

## 8i2cR-1. 결론 — **통과**(차단 문제 없음) · 테스트 보강 권장(낮음, 선택) 1건

- 바뀐 레포 파일은 `tests/rowtable-8i2.test.mjs` 하나다(+90 −1). `git diff --quiet HEAD -- apps/medreader/js apps/medreader/index.html` 통과 — 앱 코드·`index.html` 은 `9d55ac3` 과 같다.
- M1·M2·M3 을 내 손으로 레포 `rowtable.js` 에 하나씩 걸었다. 각각 **새 테스트 하나만** 빨개진다(1:1).
- 단계를 통째로 끄는 변이에서도 새 테스트가 **전제 단언**에서 떨어진다. 헛테스트가 아니다.
- RT31 의 `REQUIRE_REF:true` 바이트 비교는 새 픽스처 넷에서 실제로 돈다.
- 전체 1103/1103 × 2회, `stamp --check` 0.

## 8i2cR-2. 변이 (`r8i2c/mut.mjs`, 백업 `r8i2c/bak/`)

방식: 레포 `rowtable.js` 를 정확히 1곳 바꾼다 → 전체 테스트(`--test-timeout=60000`, 상한 300초) → `finally` 에서 백업으로 복원 → 바이트 비교. 여섯 번 모두 복원이 같았고, 끝 `cmp` 도 같다. 해시 테스트 IM2·IM6·IM7b 는 늘 빨강이라 뺐다.

| # | 변이 | 빨개진 테스트 | 실패한 단언 |
|---|---|---|---|
| M1 | `inheritFrom` 2열 가지에서 `two: true` 뺌 | **RT33** | 본 단언 "2열 경로 역할" |
| M2 | R2b `Object.assign` 에 `two: false` | **RT34** | 본 단언 "2열 경로 역할" |
| M3 | R6b `Object.assign` 에 `two: false` | **RT35** | 본 단언 "2열 경로 역할" |
| S7 | R7 물려받기 루프를 돌지 않게 | RT14·RT16·RT30b·RT30e·**RT33** | RT33 전제 "1차 띠 + 물려받은 띠" |
| S2b | R2b 호출 지움 | RT28·**RT34** | RT34 전제 "R2b 가 쪼갰다" |
| S6b | R6b 가지를 `if (false)` 로 | RT23·RT23b·**RT35** | RT35 전제 "R6b 가 열 머리를 접었다" |

- 스크래치 사본 트리(`r8i2c/tree/<base|M1|M2|M3>`)의 탐침으로 픽스처별 바이트도 봤다. 각 픽스처는 **자기 변이에서만** 출력이 바뀐다. RT33 은 M1 에서만, RT34 는 M2 에서만, RT35 는 M3 에서만 다르다.
- M1 은 RT33 안에서 두 번 잡힌다. 구획 줄이 heading 이 되고, `f33b` 에서는 이름표가 `Trasse quilar Vendo Oskat` 한 칸으로 붙는다.
- 지금 판에서는 구획 줄이 OFF 에서 body 이고 표 안(`cell 'S'`)에 있다. 그래서 TWO 의 body 는 "표 밖이라 기본값"이 아니다. 실제로 2열 경로를 탄 결과다.

## 8i2cR-3. 픽스처 · RT31

- 낱말: `SEC33`·`WIDE33`·이름표·설명은 모두 지어낸 낱말이다(WORDS 목록·Zorvat 류). RT35 의 `Maneuver`·`Description` 은 RT23 에서 쓰던 흔한 낱말이다. 원서 문장은 없다.
- RT31 확인: 사본 트리 X 에서 `REQUIRE_REF:true` 에도 2열 경로가 열리게 했다(`noRef` 떨어짐 끔 + `isTwo` 가 스위치 무시).
  - 새 넷(`RT33`·`RT33b`·`RT34`·`RT35`)을 하나씩 비교하면 **넷 다 REF ≠ OFF** 다. 그래서 RT31 이 빨개진다.
  - 원래 판에서는 넷 다 REF = OFF, TWO ≠ OFF 다. 비교가 실제로 돌고, 의미도 있다.

## 8i2cR-4. Build 발견 1(RT28 이 칸 번호 `k` 를 안 봄) — 의견

- Build 는 "행만 늘린 RT28" 에서 M2 가 Vendo 행 설명을 문단 둘로 쪼갠다고 했다. 내가 재 보니 **원래 RT28(행 5개)에서도 같다.** M2 에서 `Vendo quilar ba` 행 P 줄 둘이 `k` 0 → 1 이 되고 설명이 두 문단이 된다. 행을 늘린 꼴에서는 그런 행이 셋이다.
- 지금 RT28 은 `pLinesByHead`(P 줄 수만 셈)·이름표·아이템 다중 집합만 본다. 그래서 이것을 놓친다.
- 의견: **필수는 아니다.** M2 는 RT34 가 이미 잡는다.
  - 다만 보는 증상이 다르다. RT34 는 구획 줄 역할을 보고, 이것은 설명 문단 나눔을 본다. 실물(Harrison 75)에서 보이는 증상에 더 가깝다.
  - RT28 에 한 줄을 더하면 싸게 두 번째 그물이 생긴다. 예: `rowsOfL(L).every((r) => r.p.length === 1)` 또는 P 줄 `k` 가 모두 0. 다음 rowtable 작업 때 함께 넣으면 충분하다(낮음).

## 8i2cR-5. 실행 · 정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초) **2회 모두 1103/1103**, fail 0, cancelled 0(7.0초·7.1초).
- `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 55개 · CSS 4개)", 종료 0.
- 끝에 `rowtable.js`·`rowtable-8i2.test.mjs`·`index.html` 이 `r8i2c/bak/` 과 `cmp` 같다. 레포에서 내가 바꾼 것은 이 절뿐이다.
- 작업 중 `.claude/tasks/medreader-plan-o1-o3.md` 가 새로 생겼다. 내가 만든 것이 아니다.
- 남은 프로세스: 내가 띄운 것은 모두 끝났다. 끝 `tasklist`: node 1개(PID 43840 — Adobe, 내 것 아님), msedgewebview2(앱 호스트, 내 것 아님), python 0.
- 권한·훅에 막힌 명령은 없다. checkout/restore/stash, `rm -rf`, npm 설치·다운로드, 커밋은 하지 않았다.

## 8i2cR-6. 운영자 결정 필요 사항

1. **커밋해도 된다.** 8i-2b Review 권장(M1–M3 공백)이 메워졌다.
2. (선택·낮음) RT28 에 설명 문단 나눔(`k`) 단언 한 줄 — 8i2cR-4. 다음 rowtable 작업 때.

---

# 8g-2 Review — 검색 엔진 (`js/search/engine.js` + `ui/library.js` 배선) (2026-10-19)

> 지침 `.claude/tasks/medreader-review-8g-2.md`. Build 와 분리된 검증. 시작 상태 HEAD `21ede92` + 작업 트리(engine.js 새 파일, library.js +7, index.html stamp, 테스트 2개, `dev/measure-search-8g.mjs` `--app`). 스크래치 `r8g2/` 만 썼다. 앱 코드·테스트·spec 은 고치지 않았다(변이는 되돌렸다). 커밋하지 않았다. 브라우저는 쓰지 않았다(8g-4 Review 몫).

## 8g2R-1. 결론 — **조건부 통과**

- 엔진은 spec 17-8-12(6절 8g-2 줄, S8–S14)와 17-8-5 대로다. 차단 문제는 없다.
- 측정은 Build 스크립트 재현(CMDT 2026)과 **내 참조 구현**(CMDT 2026·2021) 모두 차이 0, 결과 쪽 다시 찾기 불일치 0 이다.
- 전체 테스트 1117/1117 × 3회, `stamp --check` 0.
- 조건 두 가지(8g-4 와 함께 배포하기 전):
  1. **백필이 DB 오류로 실패하면 그 책 검색이 통째로 거절된다**(8g2R-3 의 1, 중간·드묾). 처리 방식을 정해야 한다.
  2. **테스트 공백**: 내 변이 11개 중 8개가 살아남았다(8g2R-6). 그중 M7 은 실제 동작 차이를 탐침으로 확인했다. 테스트 보강을 권한다.
- 지금 판은 커밋해도 된다. 화면 변화가 없고, 배선(`notePage`·`invalidate`)은 캐시가 없으면 아무 일도 하지 않는다.

## 8g2R-2. spec 대조

| 항목 | 판정 | 근거 |
|---|---|---|
| 백필 대상 = 지금 algoVersion `pages` 만 | ○ | `backfillPlan` 이 `docId_algoVersion` 범위 `[docId, ALGO]`–`[docId, ∞]` 와 `docId_sk` = `[docId, SEARCH_KEY]` 를 **키만** 비교한다. 옛 algoVersion 쪽은 안 만든다(S9 테스트 · V15 빨강). |
| `sk` 가 다르면 다시 | ○ | `docId_sk` 범위가 비므로 전부 빠진 쪽이 된다(S9 경첩 테스트 둘). |
| 빠진 쪽만 | ○ | 실물: CMDT 2026 1,312쪽을 지우면 `pages.get` **정확히 1,312회**, CMDT 2021 3,368 → 3,368(8g2R-4). |
| `pages` 읽기와 `searchText` 쓰기 한 트랜잭션 | ○ | `backfillBatch` = `withTx(['pages','searchText'],'readwrite')` 하나. 50쪽씩(M21 이 S9 에서 빨강). |
| 레코드 = 추출 레코드 | ○ | 실물 두 권에서 백필 레코드 JSON 이 **추출기가 쓴 레코드와 바이트 같다**(1,312·3,368쪽 차이 0). |
| `ENABLED=false` 면 0 | ○ | `backfill` 첫 줄. 사본 테스트 S5b 가 묶는다(E9re 빨강). |
| 캐시 = 열린 책 하나 | ○ | 모듈 변수 `cache` 하나. 서재 범위는 캐시하지 않는다(측정 8회 모두 `cacheInfo()` null). |
| 상한 1,000 · `truncated` | ○ | 쪽 순서(쪽 안은 본문 → 표)로 채우고, 넘는 적중이 하나라도 있으면 true. 정확히 1,000 은 false(S11). |
| 묶음 순서 | ○ | head → body → table, 묶음 안 쪽 → 오프셋. 43개 검색어에서 내 참조와 순서까지 같다. |
| 세대 취소 · `signal` · `onPartial` 순서 | ○ | 앞 세대는 `onPartial` 0회, 반환 `cancelled`. 부분 결과는 백필을 기다리기 **전에** 한 번, 최종은 반환으로만 — 부분 결과 적중은 최종의 부분집합(탐침 P7). |
| 서재 범위 | ○ | 열린 책 먼저, 그다음 `lastOpenedAt` 내림차순. 끝난 책마다 `onPartial`. 묶음은 빈도표를 다 모은 뒤 정한다(2단계 — 8회 내 참조와 같음). |
| `notePage` / `invalidate` | ○ | 캐시 없는·다른 책이면 읽기 0. 채우는 중의 `notePage` 도 받는다(탐침 P8). |
| 계층(3-2) | ○ | import 는 `config`·`db`·`text/layout`·`text/store`·`text/search` 뿐. DOM·`window`·`navigator` 0. 전역 `IDBKeyRange` 는 `pdf/extract.js` 와 같은 쓰임이다. |
| 배선(library.js) | ○ | `attach` 의 `page` → `notePage`, `reextract` → `invalidate`, `reextractDoc` 의 `resetDerived` 뒤, 삭제 성공 뒤 `invalidate`. 리스너는 `prepare()` 전에 붙어 `reextract` 를 놓치지 않는다. |
| 캐시 모양 | ○(17-8-12 우선) | 17-8-5 는 "원문을 메모리에 들고 있지 않는다"였으나 17-8-12 2-2 가 "원문 + 접은 글자"로 바꿨다(대문자 약어는 원문에서 찾는다). 코드는 뒤를 따른다. |

## 8g2R-3. 찾은 문제

1. **[중간 — 드묾] 백필이 DB 오류로 실패하면 그 책 검색이 매번 거절된다**(탐침 P2)
   - 재현: 80쪽 중 20쪽만 `searchText` 가 있고, `searchText.put` 이 비동기 `QuotaExceededError` 를 내게 했다.
   - 결과: 부분 결과(20쪽)를 `onPartial` 로 한 번 보낸 뒤 `searchDoc` 이 `ERR_DB_QUOTA` 로 **reject**. 다음 검색도 같은 길로 reject. 오류를 걷어 내자 80쪽 정상.
   - 원인: `ready()` 가 `await backfill()` 의 거절을 그대로 올린다. `bfDone` 이 서지 않아 검색마다 백필을 다시 시도한다.
   - spec 17-8-3 "백필 중에도 이미 있는 쪽은 찾는다"와 어긋난다. 실제 IndexedDB 에서 이 길은 저장소 가득 참, 그리고 **다른 탭이 DB 버전을 올려 연결이 닫힌 경우**(U2)에 열린다. fake-idb 에는 할당량이 없어 테스트로 드러나지 않는다.
   - 권장: (가) 엔진이 백필 실패를 잡아 있는 쪽으로 찾은 결과에 `error`(오류 코드)를 붙여 돌려준다. (나) 8g-4 화면이 reject 를 잡아 오류 배너만 낸다. **(가)** 를 권한다 — 결정 필요(8g2R-9).
2. **[낮음 — 테스트 공백] 살아남은 변이 8개**(8g2R-6). 실제 동작이 달라지는 것:
   - **M7**(채우는 중의 `notePage` 를 버림): 새 책을 추출하는 동안 검색 화면을 열면 흔히 겹친다. 이미 읽은 묶음의 쪽이 그사이 새로 쓰이면 그 쪽은 다음 `notePage`·`invalidate` 전까지 옛 글자로 남는다. 탐침 P8: 지금 코드는 새 글자를 찾고(`[5]`), M7 판은 못 찾는다(`[]`).
   - M9(서재 범위 빈도표를 상한에서 멈춤): 상한에 걸린 검색어에서 서재 범위 묶음이 책 범위와 갈린다. 측정 스크립트는 잡지만 테스트는 못 잡는다.
   - M1(상한 뒤 "더 있나"에서 표를 안 봄): 상한이 쪽 끝에서 정확히 차고 뒤쪽 적중이 표에만 있으면 `truncated` 가 거짓이 된다.
   - M6·M16(동시 검색·채우는 중 무효화): 두 검색이 겹치거나 채우는 중 `invalidate` 가 오면 한 번 옛 글자로 찾는다.
   - M13(서재 범위에 열린 책 부분 결과가 섞임), M17(`invalidate` 가 백필을 안 멈춤 — 거의 같은 동작), M20(서재 범위가 안 연 책을 백필하지 않음 — Build 문안 3 의 결정이 테스트로 고정되지 않았다).
3. **[낮음] 진행 중 검색이 `invalidate`·삭제 뒤에도 옛 캐시로 결과를 낸다**(탐침 P1)
   - `onPartial` 안에서 `invalidate` + `deleteDocument` → 그 검색은 `cancelled` 가 아니고 20적중을 돌려줬다(DB 에는 이미 0).
   - `ready()` 가 돌아온 뒤 `c.stale` 을 보지 않는다. 삭제·다시 추출은 서재 화면에서 일어나므로 실제로 겹치기는 어렵다.
   - 권장: `searchDocAt` 에서 `ready()` 뒤 `c.stale` 이면 다시 채우거나 `cancelled` 로 끝낸다(한 줄).
4. **[낮음] `preparing.done` 이 늘 0 이다**(탐침 P3)
   - `prepareDoc` 이 380쪽 중 이미 진행한 뒤 `searchDoc` 을 해도 부분 결과는 `{done:0, total:380}` 이다(덮은 쪽은 120).
   - 진행은 `onProgress` 가 바르게 준다. 8g-4 가 `preparing.done` 을 화면에 쓰면 틀린다. API 문안에 "진행은 onProgress"로 적거나 실제 값을 넣는다.
5. [정보] **상한에 걸린 검색의 제목 묶음은 책 앞쪽뿐이다**(내 측정, CMDT 2026)
   - 상한 1,000 을 쪽 순서로 채운 뒤 묶음으로 정렬하므로, 제목 적중도 그 1,000 안에 든 것만 보인다.
   - `treatment` 제목 308 중 **44**(317쪽까지), `patients` 424 중 38(217쪽까지), `hyper-` 178 중 62(489쪽까지).
   - 시제품과 같은 동작이고 spec 이 정하지 않았다. 화면은 "너무 많습니다" 문구를 낸다. 제목 적중만 상한과 따로 다 모을지는 선택(8g2R-9).
6. [정보] 서재 범위를 `signal` 로 취소해도 지금 책의 백필이 끝날 때까지 돌아오지 않는다(탐침 P5 — fake-idb 600쪽 39ms). 설계대로다(백필은 다음 검색이 이어 쓴다). 폰에서는 한 권 3.5–8초 `[Plan 추정]` 늦게 `cancelled` 가 온다 — 화면은 세대로 이미 무시하므로 보이는 문제는 없다.
7. [정보] **캐시 메모리**: `--expose-gc` 힙 증가 **CMDT 2026 39.0MB · CMDT 2021 37.5MB**(Plan 2-2: 33.4 · 28.4MB). 원문+표 글자 968만·955만 자, 두 바이트 문자열 쪽 1,892·4,523. Plan 보다 17%·32% 크다(쪽 항목 객체·heads·빈도표 몫). 한 권만 들므로 폰에서도 감당할 크기로 보이나 S15m 에서 실제 탭 메모리를 함께 재기를 권한다.
8. [정보] **추출기와 백필의 경합**(탐침 P4): 300쪽 백필 중 추출 경로(`writePageAndSearch`)로 네 쪽을 새로 썼다. 끝에 `searchText` 300쪽 모두 그 쪽 `pages` 의 화면 글자와 같고(불일치 0), 캐시도 새 글자 네 쪽만 찾는다. 겹치는 readwrite 트랜잭션은 줄을 서므로 실제 IndexedDB 에서도 같은 순서 규칙이다.
9. [정보 — 실제 IndexedDB 에서만 드러날 것]
   - 위 1(할당량·닫힌 연결 → 트랜잭션 abort → reject).
   - 50쪽 백필 트랜잭션 동안 추출기의 쓰기(같은 두 스토어)는 기다린다. Node·fake-idb 에서 묶음당 약 40–50ms(1,312쪽 1.26초), 폰 ×3–5 이면 묶음당 수백 ms — 추출이 그만큼 멈칫하지만 화면 스레드를 오래 잡는 계산은 아니다(쪽당 레코드 만들기 0.13ms `[Plan]`).
   - `searchText.put` 의 키 오류는 실제로는 **동기** `DataError` 다. 백필은 `pageNo` 를 읽은 키로 못 박고 `try` 로 감싸므로 그 쪽만 `failed` 로 센다. 테스트도 키 칸을 따로 단언한다(8g-1 Review 정보 4 대비 ○).

## 8g2R-4. 측정 재현

**A. Build 스크립트 그대로**(`dev/measure-search-8g.mjs --app`, CMDT 2026, pdf.js 5.6.205, 49초, 종료 0, `r8g2/build-app-c26.json`)
- 백필 1,967/1,967 · 레코드 차이 0 · 키/`sk` 이상 0.
- 26개 검색어: 상한·끝까지 적중 집합 차 0, 쪽·묶음·규칙·`truncated`·순서 차 0, 서재 범위 4개 차 0.
- 다시 찾기 2,433쪽 · 불일치 **0** · 두 줄 적중 140 · 빈 구간 0 — Build 보고·Plan 과 같다.
- 시간: 가장 느린 상한 검색 IL-6 13.5ms(Build 14.0), 다음 검색 6.2ms, 첫 검색(fake-idb) 137ms.

**B. 내 스크립트**(`r8g2/m8g2.mjs`) — 실제 `Extractor` 로 전권 추출(fake-idb) → 엔진을 **내 참조 구현**과 맞댐. 참조는 정규식 `exec` 로 겹침 포함 위치를 찾고, 경계 검사·heading 빈도표·묶음·상한·정렬·`len` 을 따로 짰다(검색어 변형은 앱 `parseQuery` — 8g-1 Review 에서 검증). 검색어 44개 = Build 26 + 내 것 18(`insulin`·`COPD`·`TNF-α`·`alpha-blocker`·`non-Hodgkin lymphoma`·`anti-inflammatory`·`x-ray`·`H. pylori`·`type 2 diabetes`·`HIV`·`Staphylococcus aureus`·`ab`·`mg/dL`·`pseudo`·`Ca`·`hyper-`·`café`·`κ light`) + 1자 오류.

| | CMDT 2026 1,967 | CMDT 2021 5,051 |
|---|---|---|
| 추출 | done · 오류 0 · 63.8초 | done · 0 · 79.2초 |
| 백필(2/3 지움) — 지운 쪽 / `pages.get` / 추출 레코드와 JSON 차이 | 1,312 / **1,312** / **0** | 3,368 / **3,368** / **0** |
| 캐시 검색(상한) · 끝까지 · `truncated` — 내 참조와 다른 검색어 | **0 / 0 / 0** (43개) | **0 / 0 / 0** |
| 서재 범위(캐시 없음) 8개 — 다른 검색어 | 0 | 0 |
| 1자 검색어 오류 코드 | 같음 | 같음 |
| 결과 쪽 다시 찾기(쪽 저장본 → 화면 글자 → 내 일치) 쪽 / 불일치 | 3,809 / **0** | 4,806 / **0** |
| 가장 느린 상한 검색(Node, 캐시 위) | 19.1ms (`TNF-α` — 변형 둘) | 18.3ms |
| 다음 검색 · 첫 검색(fake-idb) · 캐시 채우기(fake-idb) | 5.8ms · 162ms · 172ms | 5.8ms · 167ms · 190ms |
| 백필(fake-idb, 지운 쪽만) | 1.26초 | 1.05초 |
| 캐시 힙 증가 | 39.0MB | 37.5MB |

- 상한 검색은 모두 S15 "다음 검색 ≤ 50ms"(데스크톱) 안이다. fake-idb 시간은 참고값이다 — 실제 Chrome 값은 8g-4 Review 의 S15 몫.
- `H. pylori` 는 0 적중이다(엔진·참조 같음). 책 표기가 다를 뿐 엔진 문제는 아니다.

## 8g2R-5. 보강 3건 확인 (8g-1 Review 8g1R-5 의 1–3)

1. **ENABLED=false 사본 테스트(S5b)** — 앱 코드 경로를 탄다.
   - 테스트가 돌 때 작업 트리의 `js/` 를 임시 폴더로 복사하고, 사본 `config.js` 의 `SEARCH` 블록 `ENABLED: true` 만 바꾼다(못 찾으면 전제 단언으로 실패). 그래서 **옛 판이 아니라 지금 파일**을 부른다.
   - 확인: engine.js 에 E9 를 다시 걸자(E9re) S5b 가 빨강이 됐다 — 변이가 사본까지 따라간다. Build 의 R2(extract.js)도 같은 테스트에서 빨강이었다(로그 확인, 나는 `js/pdf` 를 건드리지 않았다).
   - 임시 폴더는 `finally` 에서 지운다. 세 번 돈 뒤 `mr-search-off-*` 남은 것 0. 실행 약 1초.
   - 사본은 별도 `db.js` 인스턴스지만 같은 전역 fake-idb 를 쓴다. 꺼진 판 백필 0 → 켜진 판 백필 1 을 같은 저장소에서 확인하므로 헛통과가 아니다.
2. **경계값** — `the`(3자, there·other 안 찾음)·`ther`(4자, 접두)·`a-b`(접은 길이 3)·`COPD5`(5자 약어)·`ABCDEF`(6자, 약어 아님)·`12`(대문자 없음)를 순수 함수와 엔진 양쪽에서 본다. 경계 3·5 의 안팎이 모두 있다. Build R5·R9 빨강(로그 확인).
3. **S6 2초 상한** — `Promise.race` 2초, 원인 문구에 `blocked` 를 담는다. Build R7 로그에서 **2,011ms** 에 실패했다. 정상 실행은 1ms 미만(세 번 모두)이라 2초 상한이 흔들릴 여지는 없다.

## 8g2R-6. 테스트의 힘 — 내 변이 (`r8g2/mut.mjs`, 로그 `mut.log`·`mut-out/`, 백업 `bak/`)

Build 의 V8·V9·V15·E1–E10·W1–W2·R2·R5·R7·R9 와 겹치지 않는 자리. `engine.js`·`library.js` 에만 걸었다. 변이마다 전체 테스트(`--test-timeout=60000`, 상한 300초) → 복원 → 바이트 비교 **모두 같음**. 끝에 대상 6파일 sha256 이 시작 기록과 같다. 표의 "빨강"은 import map 해시 테스트(IM2·IM6·IM7b — 파일을 바꾸면 늘 빨강)를 뺀 것.

| # | 변이 | 결과 |
|---|---|---|
| M1 | 상한 뒤 "더 있나"에서 표 글자를 안 봄 | **살아남음** |
| M6 | `refreshDirty` 가 도는 다시 읽기를 기다리지 않음 | **살아남음** |
| M7 | 캐시를 채우는 중에는 `notePage` 를 버림 | **살아남음** — 탐침 P8 로 실제 차이 확인 |
| M9 | 서재 범위 빈도표를 상한에서 그만 모음 | **살아남음** |
| M13 | 서재 범위가 열린 책의 백필 전 부분 결과를 `onPartial` 로 흘림 | **살아남음** |
| M16 | `ensureLoaded` 가 무효화된 캐시를 그대로 돌려줌 | **살아남음** |
| M17 | `invalidate` 가 도는 백필을 멈추지 않음 | **살아남음**(거의 같은 동작 — 지운 쪽은 읽을 것이 없다) |
| M20 | 서재 범위가 안 연 책을 백필하지 않음 | **살아남음** — Build 문안 3 의 결정이 테스트로 고정되지 않음 |
| M21 | 백필 묶음 50 을 무시하고 한 트랜잭션에 전부 | 빨강 1 (S9 묶음·진행) |
| E9re | 엔진 백필이 ENABLED 무시(Build E9 다시) | 빨강 1 (S5b) — 보강 ① 확인 |
| L1 | library: `page` 대신 `progress` 이벤트로 `notePage` | 빨강 1 (S13 배선) |

- library.js 배선은 소스 정규식으로 촘촘히 묶여 있다(W1·W2·L1 빨강). 엔진의 **동시성·서재 범위 상한 갈래**가 비어 있다.
- 권장 보강(작다, fake-idb 로 된다): M7(채우는 중 앞 묶음 쪽을 새로 쓰고 `notePage` → 다음 검색이 찾는다 — 탐침 P8 그대로), M9(반복 heading 이 상한 뒤쪽에 몰린 서재 범위 = 책 범위), M1(쪽 끝에서 상한이 차고 뒤쪽 표 적중 하나 → `truncated`), M20(문안 3 승인 시 — 서재 검색 뒤 안 연 책의 `searchText` 가 생긴다).

## 8g2R-7. 전체 테스트 · 정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초): 변이 전 1회, 변이 뒤 2회 — **세 번 모두 1117/1117**, fail 0, cancelled 0(8.3·8.0·7.9초).
- `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 56개 · CSS 4개)", 종료 0.
- 레포에서 바꾼 것은 이 절뿐이다. 앱 코드·테스트·spec·측정 스크립트는 시작 sha 와 같다.
- 내가 쓴 스크립트: `r8g2/probe.mjs`(탐침 P1–P8)·`m8g2.mjs`·`m8g2b.mjs`(제목 묶음 수 추가판)·`mut.mjs`·`m7probe.mjs`. 결과 `probe.out`·`m-c26*.json`·`m-c21.json`·`build-app-c26.json`. 출력은 수치뿐, 원서 글자를 저장하지 않았다.
- 남은 프로세스: 내가 띄운 node 는 모두 끝났다. 끝 `tasklist` 의 node 1개(PID 43840 — Adobe)는 내 것이 아니다. 브라우저·python 은 쓰지 않았다.
- `js/text/*`·`js/pdf/*`·`dev/measure-lib.mjs` 는 import 만 했다(다른 조사 에이전트 사용 중). 작업 중 `.claude/tasks/medreader-survey-language-library-report.md` 가 새로 생겼다 — 내 것이 아니다.
- 권한·훅에 막힌 명령은 없다. 커밋·checkout/restore/stash·`rm -rf`·npm·다운로드는 하지 않았다.

## 8g2R-8. Build 의 spec 문안 제안 판정 (보고서 8절)

1. **§6 8g-2 행에 library.js 배선, 8g-4 행에서 `reextractDoc` 뒤 invalidate 빼기 — 맞다.** 배선은 화면 변화가 없고 엔진과 함께 시험되는 것이 자연스럽다. 삭제 뒤 `invalidate` 도 맞는 한 줄이다(지운 책 글자를 캐시가 들고 서재 결과에 내지 않게).
2. **17-8-5 API 보강 — 맞다, 두 가지를 더 적는다.** (a) `preparing.done` 은 지금 늘 0 — "진행은 `onProgress`" 로 적거나 값을 고친다(8g2R-3 의 4). (b) DB 오류 때의 동작 — 지금은 reject. 8g2R-9 의 2 결정 뒤 그 결과를 적는다. `headLevel?` 을 만들지 않은 것은 맞다(쓰는 곳 없음).
3. **서재 범위가 안 연 책도 백필 — 결정으로서 맞다(조건 셋).** 하지 않으면 8g-1 전에 추출된 책이 서재 결과에서 빠진다. 다만 (a) 테스트로 고정되지 않았다(M20 살아남음), (b) 첫 서재 검색은 그런 책마다 백필(폰 한 권 3.5–8초 `[Plan 추정]`)이 들어 17-8-2 "서재 전체 ≤ 3초"·S15 "≤ 1초"를 넘을 수 있다 — S15 문안에 "백필이 끝난 뒤"를 붙이고, 화면은 책별 `onProgress`(docId 포함)로 "검색 준비 중"을 보여야 한다, (c) Nour 기기의 실제 비용은 8g-1 배포 뒤 추출·재추출이 이미 만든 양에 달렸다.
4. **`truncated` = "상한을 넘는 적중이 하나라도 있다" — 맞다.** 17-8-5 "넘으면 truncated" 와 같은 뜻이다. S11 문안 "상한 1,000 에서 `truncated`" 를 "1,000 을 넘으면(정확히 1,000 은 아님)"으로 고치기를 권한다. 두 권 측정에서 적중이 정확히 1,000 인 검색어는 없었다(갈림은 S11 테스트의 정확히 1,000 사례가 고정한다).

## 8g2R-9. 운영자 결정 필요 사항

1. **커밋**: 지금 판은 커밋해도 된다(화면 변화 0). 배포는 spec 대로 8g-4 와 함께.
2. **[8g-4 전 — 결정] 백필 실패 때 검색**(8g2R-3 의 1): (가) 엔진이 실패를 잡아 있는 쪽으로 찾은 결과 + 오류 코드를 돌려준다 **(권장)** · (나) 엔진은 그대로 reject, 8g-4 화면이 잡아 오류 배너만.
3. **[권장] 테스트 보강**: M7(필수 권장)·M9·M1, 그리고 문안 3 을 승인하면 M20. 8g-4 Build 에 함께 넣거나 작은 별도 작업으로. 같은 때 8g2R-3 의 3(`ready` 뒤 `stale` 확인 한 줄)·4(`preparing.done`)를 함께 고칠지 정해 주세요.
4. **[선택] 상한에 걸린 검색의 제목 묶음**(8g2R-3 의 5): 지금처럼 앞쪽 1,000 적중 안의 제목만 · 또는 제목 적중은 상한과 따로 끝까지 모은다(제목은 책당 수백 개 이하). 8g-4 화면 설계 때 정해도 된다.
5. **Build 문안 4건 반영 승인**(8g2R-8 — 2·3·4 는 보충 문구 포함).

# 8g-2b Review — 검색 엔진 보강 (백필 실패 처리 · ③④ · 테스트 · spec 문안) (2026-10-19)

> 지침 `.claude/tasks/medreader-review-8g-2b.md`. Build 와 분리된 검증. 시작 상태 HEAD `c35ebbf` + 작업 트리(engine.js · tests/search-db-8g.test.mjs · spec.md 17-8-5·17-8-12 · index.html stamp). 시작 sha256 이 Build 보고 7절과 같다(engine `0f4a2278…` · 테스트 `93f604de…` · spec `550313f6…` · index `0b6e5bd9…`). 스크래치 `r8g2b/` 만 썼다. 앱 코드·테스트·spec 은 고치지 않았다(변이는 되돌렸다 — 끝에 8개 파일 sha256 모두 시작과 같음). 커밋하지 않았다. 브라우저는 쓰지 않았다.

## 8g2bR-1. 결론 — **통과**(8g-4 배포 전 조건 2개)

- 운영자 결정 (가)가 엔진 세 길(`searchDoc` · `prepareDoc` · 서재 범위의 열린 책/안 연 책)에 모두 들어갔다. 백필이 실패해도 거절하지 않고, 있는 쪽으로 찾은 결과에 `db.ERR` 코드를 붙인다. 다음 검색은 빠진 쪽만 다시 시도한다.
- ③(검색 도중 `invalidate` → 다시 채움)과 ④(`preparing.done` = 실제 진행)는 맞게 고쳐졌다. 탐침 P1·P2·P3·P8 이 Build 보고와 같은 값을 냈다.
- 테스트의 힘: Review 변이 M1·M7·M9·M20 은 모두 빨강이다. 이번 수정 자리에 건 내 변이 8개 중 7개가 빨강이고, 살아남은 1개는 같은 동작이다. M16·M17 "같은 동작" 판단도 맞다.
- CMDT 2026 `--app`: 차이 0. 시간 칸을 뺀 `app` JSON 이 8g-2 판(`r8g2/build-app-c26.json`)·Build 판과 항목 전부 같다.
- 전체 테스트 1126/1126 × 3회(변이 전 1 + 끝 2), `stamp --check` 0.
- 8g-4 배포 전 조건 두 가지(지금 커밋을 막지는 않는다):
  1. **Build 남은 문제 1 을 엔진에서 고친다**(8g2bR-3 의 1). 읽기가 한 번 실패하면 같은 책 검색이 계속 거절되고, **서재 전체 검색도 함께 거절된다**. 한 줄 수정 + 테스트 1개.
  2. **8g-4 화면은 `searchDoc`·`searchLibrary` 의 reject 를 잡아야 한다**(8g2bR-3 의 2). 실제 `versionchange` 뒤에는 (가)를 타지 않고 `DbError(ERR_DB_OPEN)` 로 거절된다.

## 8g2bR-2. 결정 (가) 확인

| 항목 | 판정 | 근거 |
|---|---|---|
| reject 대신 부분 결과 + `error` | ○ | `backfill()` 본문을 `try/catch` 로 감쌌다. 실패한 묶음은 abort, 그 앞 묶음은 커밋된 채 남는다(S9b `stCount 70`). 탐침 P2: 20적중 + `ERR_DB_QUOTA`(8g-2 때는 reject). |
| 코드 = `db.ERR` 그대로, 새 코드 없음 | ○ | `withTx` 가 할당량을 `DbError(QUOTA)` 로 바꾸므로 `e.code` 를 먼저 본다. 나머지는 `OPEN` 이다. 변이 R3(전부 QUOTA)은 빨강, Build N4(전부 OPEN)도 빨강. |
| 범위 — `searchDoc` | ○ | 최종 결과에만 `error` 가 붙는다. 부분 결과는 백필 전이라 코드가 없다(S9b 단언). |
| 범위 — `prepareDoc` | ○ | `{docId, pagesCovered, error}` 를 돌려준다. 변이 R5(코드 버림)는 빨강. |
| 범위 — 서재: 열린 책 | ○ | `searchDocAt` 를 거치므로 같다. 서재 `onPartial` 에 부분 결과가 섞이지 않는다(M13 빨강 — Build). |
| 범위 — 서재: 안 연 책 | ○ | `streamDoc` 이 코드를 붙인 뒤 **있는 쪽을 그대로 찾는다**. 변이 R6(오류면 찾지 않고 코드만)은 빨강. |
| 다음 검색은 빠진 쪽만 다시 시도 | ○ — 타당 | S9b 둘째 검색의 `pages.get` 이 **정확히 10회**다. R2(오류여도 `bfDone` 을 세움)와 Build N2 는 빨강. 이유 넷(커밋된 묶음은 남음 · 풀림을 알 신호 없음 · 비용 작음 · 부분 결과가 먼저 나감)에 동의한다. 다만 저장소가 찬 동안에는 **입력 검색마다**(250ms 멈춤) 키 비교 + 실패하는 묶음 하나(≤ 50쪽 읽기)를 되풀이한다. 폰에서는 최종 결과가 수백 ms 늦을 수 있다. 부분 결과가 먼저 나가므로 보이는 문제는 작다(8g-4 Review S15m 에서 볼 것). |
| 검색어 오류와 DB 오류의 구분 | ○(접두어로) | `error` 한 칸에 두 종류가 들어간다: `ERR_SEARCH_*`(적중 0) · `ERR_DB_*`(적중이 있을 수 있음). 머리 주석과 spec 17-8-5 에 적혀 있다. 화면은 접두어로 가르면 된다. 서재 범위에서는 맨 위 `error` = 검색어 오류만, DB 코드는 `docs[i].error` 다(탐침 P12). **세 번째 통로 reject 가 남는다**(8g2bR-3 의 1·2) — 8g-4 는 셋 다 처리해야 한다. |

## 8g2bR-3. 찾은 문제

1. **[낮음–중간] Build 남은 문제 1 재현 — 읽기 실패가 붙는다. 서재 전체 검색까지 막힌다**(탐침 P9)
   - 재현: 캐시 채우기의 `searchText.getAll` 을 **딱 한 번** 비동기 `UnknownError` 로 실패시켰다.
   - 결과: 첫 검색이 reject. 오류를 걷어 낸 뒤에도 같은 책의 2·3번째 검색·`prepareDoc` 이 모두 같은 오류로 reject.
   - **서재 전체 검색도 통째로 reject 했다.** 그 책이 캐시 책이라 맨 앞에서 `searchDocAt` 을 타기 때문이다.
   - 풀리는 길은 `invalidate(그 책)` 이나 다른 책 검색(캐시가 바뀜)뿐이다. 둘 다 확인했다.
   - 오류도 `db.ERR` 코드가 아니라 날것(`UnknownError`)이다. `withTx` 는 할당량만 코드로 바꾼다.
   - 원인: `ensureLoaded` 의 `c.loading` 에 거절된 프라미스가 남는다.
   - 같은 계열(새로 찾음, 탐침 P10): `rereadDirty` 는 `c.dirty.clear()` 를 **읽기 전에** 한다. 그래서 다시 읽기가 실패하면 `notePage` 표시가 사라진다. 다음 검색은 성공하지만 그 쪽은 옛 글자로 남는다(`newword` → `[]`). 8g-2 부터 있던 동작이다.
   - 심각도: 실제 IndexedDB 의 읽기 실패는 드물다(백엔드 I/O `UnknownError`, 닫힌 연결 — 뒤의 경우는 어차피 다시 불러오기). 그래도 한 번이면 그 탭의 검색 화면이 서재 범위까지 굳는다.
   - **판정: 8g-4 몫으로 미루지 말고, 8g-4 배포 전에 엔진에서 고친다.** 8g-4 Build 지침의 첫 항목(엔진 두 줄 + 테스트 1–2개)으로 넣거나 작은 8g-2c 로 하면 된다. 엔진은 8g-4 와 함께 배포되므로 지금 사용자 영향은 없다.
     - ⓐ `c.loading = loadCache(c).catch((e) => { if (cache === c) cache = null; throw e; })`
     - ⓑ `rereadDirty` 실패 시 `ns` 를 `c.dirty` 에 되돌린다.
     - 테스트는 S9b 와 같은 프로토타입 감싸기로 된다.
   - 고쳐도 첫 실패는 reject 다. 화면이 reject 를 잡는 일(조건 2)은 그대로 필요하다.
2. **[낮음 — 문서 정확성 · 8g-4 지침] 실제 `versionchange` 뒤에는 (가)를 타지 않는다**(탐침 P13)
   - fake-idb 에서 다른 "탭"이 `DB_VERSION + 1` 로 열자 db.js 가 연결을 닫았다. 그 뒤:
     - `searchDoc` 은 캐시가 있어도 **reject `DbError(ERR_DB_OPEN)`(cause `VersionError`)**. 첫 줄 `db.get('documents')` 가 먼저 실패한다.
     - `searchLibrary` 도 reject(`documents.getAll`).
     - `prepareDoc` 만 `{pagesCovered:10, error:'ERR_DB_OPEN'}` 이다.
   - 그러니 (가)의 "닫힌 연결" 갈래는 **검색 도중에 닫힐 때**와 `prepareDoc` 에만 맞다.
   - S9b 닫힌 연결 테스트는 `pages` 를 범위에 둔 트랜잭션만 막는다(Build 가 주석에 적은 대로 좁은 흉내). 지금 코드에 대한 테스트로는 맞지만, 실제 닫힌 연결의 꼴은 아니다.
   - spec 17-8-5 새 줄 "(…연결이 닫힘 등 `ERR_DB_OPEN`): 검색을 거절하지 않는다"는 지나친 약속이다.
   - 해는 작다: `main.js` 가 `versionchange` 에 [다시 불러오기] 배너를 이미 띄운다.
   - 권장:
     - (a) 다음 spec 정리 때 17-8-5 문구를 "백필 도중의 DB 오류는 … 이미 닫힌 연결에서는 `documents` 읽기가 `ERR_DB_OPEN` 으로 거절된다(배너가 다시 불러오기를 안내)"로 고친다.
     - (b) 8g-4 지침: reject 의 `e.code`(`ERR_DB_*` 또는 날것)를 잡아 일반 오류 안내를 낸다.
3. [정보] **채우는 중 `invalidate` 가 세 번이면 조용한 0 적중**(탐침 P11)
   - `ensureLoaded` 가 세 번 다 무효화되면 끝에 `newCache(docId)` 를 돌려준다. 이 캐시는 전역에 없고 채우지도 않았다.
   - `ready` 는 그것을 정상으로 받는다 → 적중 0 · `pagesCovered 0` · `cancelled` 없음 · `error` 없음(`pageCount 30`). `prepareDoc` 도 `{pagesCovered:0}` 이다.
   - 두 번이면 정상(30)이다. 다음 검색도 정상(30)이다.
   - 머리 주석의 "세 번 안에 못 끝내면 `cancelled`"는 `ready` 고리 쪽만 맞다.
   - 한 검색 동안 같은 책을 세 번 다시 추출·삭제할 일은 사실상 없다. 고친다면 ⓐ 와 함께, `ensureLoaded` 의 끝 갈래가 `null` 을 돌려 `ready` 가 `null`(→ `cancelled`)로 끝나게 한다.
4. [정보] **`onPartial` 이 한 검색에 두 번 올 수 있다**(탐침 P1b)
   - 부분 결과 안에서 `invalidate` 하면 다시 채운 고리에서 부분 결과가 한 번 더 온다: 20적중 `{done:0,total:140}` → 70적중 `{done:0,total:90}` → 최종 160.
   - spec 17-8-5 새 줄 "…`onPartial` 로 한 번 보내는 결과"와 어긋난다(무효화가 없을 때는 한 번).
   - 세대가 같으므로 화면은 **덧붙이지 말고 바꿔야** 한다 → 8g-4 지침에 한 줄. Build 관찰 3(먼저 나간 부분 결과는 최종의 부분집합이 아닐 수 있다)과 같은 뿌리다.
5. [정보] `dbErrorCode` 는 `db.ERR` 코드도 할당량도 아닌 **모든** 예외를 `ERR_DB_OPEN` 으로 바꾼다.
   - 백필 안의 프로그램 오류(예: `TypeError`)도 "DB 를 지금 쓸 수 없다"로 보인다. 쪽 하나의 레코드 만들기 오류는 이미 `failed` 로 따로 센다.
   - 남는 것은 계획·트랜잭션 쪽뿐이라 작다. 8g-4 에서 개발 빌드 `console.warn` 정도를 고려할 만하다.

## 8g2bR-4. ③④ 확인

- **③ 경계**
  - `ready()` 는 최대 3회 돈다. 매회 머리에서 `alive()` 를 보고, 캐시 채우기 → 백필 → 표시된 쪽 다시 읽기를 마친 뒤 `!c.stale` 이면 끝낸다.
  - 안쪽 `ensureLoaded` 도 3회다 → 최악 9번 채우기에서 멈춘다. **무한 고리 없음**.
  - 무효화된 백필 작업은 `job.cancelled` 로 멈춘다. 다음 회차는 `bfJobs` 에서 새 작업을 만든다(옛 작업의 `finally` 는 `bfJobs.get(docId) === job` 일 때만 지우므로 새 작업을 지우지 않는다).
  - **세대 취소와의 상호작용**:
    - 새 검색이 오르면 다음 회차 머리에서 `null` 이 된다. 마지막 회차 뒤라면 `searchDocAt` 의 `!alive()` 가 `cancelled` 를 낸다.
    - 변이 R7(회차 머리의 `alive` 검사 뺌)은 살아남았다. 바깥 검사가 같은 일을 하므로 같은 동작이다(헛일만 한 번 더).
    - `prepareDoc` 은 `alive` 가 없어 무효화로만 끝난다(3회 넘으면 `cancelled:true`, 3의 예외 하나).
  - 변이 R1(다시 채우지 않고 바로 `cancelled`)은 S13b 에서 빨강 — Build 의 "다시 채우는 쪽" 선택이 테스트로 고정됐다.
  - 탐침 P1(검색 중 삭제): 0적중 · `cancelled:false` · `pagesCovered 0` — Build 와 같다. 지운 책의 빈 캐시(0쪽)가 남는 것도 같다(Build 관찰 2, 해 없음).
- **④ `preparing.done`**
  - 값은 백필 작업 객체의 `out.done` 이다 = **그 부분 결과를 보낼 때까지 그 책 백필이 한 쪽 수**. 그 쪽들은 이미 `pagesCovered` 에 든다.
  - 확인: 백필 묶음은 `cache.docId === docId && !stale` 일 때 캐시에 바로 넣는다. `prepareDoc`·서재 `streamDoc` 이 먼저 시작한 작업에 합류해도 캐시는 DB 에서 커밋된 묶음을 읽고, 채우는 동안 끝난 묶음도 넣는다.
  - 탐침 P3: `{done:100, total:380}` · 덮은 쪽 120(= 20 + 100) — Build 와 같다.
  - 변이 R4(`done = total`)와 Build N6(`done = 0`) 모두 S9c 에서 빨강. 새로 시작한 검색은 0 이다(S9 기존 단언 그대로).

## 8g2bR-5. 테스트의 힘 (`r8g2b/mut.mjs` · 로그 `mut.log`·`mut-out/` · 백업 `bak/`)

변이마다 레포 파일 한 곳 → 전체 테스트(`--test-timeout=60000`, 상한 300초) → finally 복원 → 바이트 비교. 16개 모두 **복원 같음**. 끝에 대상 8파일 sha256 이 시작 기록(`start-sha.txt`)과 같다. 엔진 변이의 fail 수에는 import map 해시 테스트 3개(파일을 바꾸면 늘 빨강)가 들어 있다. 아래 "빨강"은 그것을 뺀 것이다.

| # | 변이 | 결과 |
|---|---|---|
| **M1** | 상한 뒤 "더 있나"에서 표 글자를 안 봄 | 빨강 1 — S11b |
| **M7** | 채우는 중 `notePage` 를 버림 | 빨강 1 — S13c |
| **M9** | 서재 빈도표를 상한에서 멈춤 | 빨강 1 — S12b |
| **M20** | 서재 범위가 안 연 책을 백필 안 함(자리 새로: `const bf = {}`) | 빨강 2 — S12c · S9b 할당량 |
| M16 | `ensureLoaded` 가 무효화된 캐시를 돌려줌 | 살아남음 — **같은 동작 판단에 동의**. 바깥 `ready` 고리가 `stale` 을 보고 다시 채운다. 차이는 옛 캐시로 만든 부분 결과가 한 번 더 나갈 수 있는 것과 3회 한도를 하나 먼저 쓰는 것뿐이다. 최종 결과는 같다. |
| M17 | `invalidate` 가 백필을 안 멈춤 | 살아남음 — **동의**. 끝까지 도는 백필을 기다릴 뿐 최종은 같다(지운 책이면 읽을 `pages` 가 없고, 무효화된 캐시에는 `!cache.stale` 검사로 안 넣는다). |
| R1 | ③ 다시 채우지 않고 `stale` 이면 바로 `cancelled` | 빨강 1 — S13b |
| R2 | `ready` 가 백필 오류여도 `bfDone`(다시 시도 안 함) | 빨강 2 — S9b 둘 |
| R3 | `dbErrorCode` 를 늘 QUOTA | 빨강 1 — S9b 닫힌 연결 |
| R4 | `preparing.done` 을 `total` 로 | 빨강 2 — S9 · S9c |
| R5 | `prepareDoc` 이 코드를 버림 | 빨강 1 — S9b 닫힌 연결 |
| R6 | 서재 안 연 책이 오류면 찾지 않고 코드만 | 빨강 1 — S9b 할당량 |
| R7 | `ready` 회차 머리 `alive` 검사 뺌 | 살아남음 — 같은 동작(4절) |
| R8 | 백필 묶음을 캐시에 넣지 않음 | 빨강 7 |
| LK1 | (누수 검출력) S9b 닫힌 연결이 `finally` 에서 `transaction` 을 안 되돌림 | 빨강 8 — 그 테스트 + 뒤 테스트 7개(S9c·S13b·S13c·S13d·S11b·S12b·S12c). 누수가 생기면 드러난다. |
| LK2 | (누수 검출력) S9b 할당량이 `put` 을 안 되돌림 | 빨강 1(그 테스트의 "풀리면" 단언). 감싸기가 `docId === 'F9'` 로 좁혀져 있어 새어도 다른 테스트에 닿지 않는다. |

- **실패 주입이 새지 않는지**
  - 감싸기 셋(할당량 `put` · 닫힌 연결 `transaction` · M7 `getAll`)과 `delayReadonlyComplete` 모두 `finally` 로 되돌린다.
  - 테스트 파일 단독 5회 반복: 33/33 × 5.
  - 동시에 두 프로세스 + 검색 테스트 두 파일 한 번: 33·33·54 모두 녹색.
  - `--test-isolation=none`(파일들이 한 프로세스 — 프로토타입을 함께 씀)으로 검색 테스트 두 파일: 54/54.
  - 전체 실행은 파일마다 프로세스가 따로라 다른 파일에는 닿을 수 없다.

## 8g2bR-6. 탐침 다시 (`r8g2b/probe.mjs` — `r8g2/probe.mjs` 도우미 + P1·P2·P3·P8 + 새 P1b·P9–P13, 출력 `probe.out`)

| 탐침 | 8g-2 Review | Build 8g-2b 보고 | 지금(내 재실행) |
|---|---|---|---|
| P1 검색 중 invalidate + 삭제 | `cancelled:false` · 20적중 | 0적중 · `pagesCovered 0` | **같음** — 0적중 · 0 · `cancelled:false` · `onPartial` 1회 |
| P2 백필 쓰기 할당량(모든 `searchText.put`) | 첫·둘째 reject `ERR_DB_QUOTA` | 20적중 + `ERR_DB_QUOTA`, 부분 20, 둘째 같음, 풀면 80/80 | **같음** |
| P3 prepareDoc 중 searchDoc | `{done:0,total:380}` · 120 | `{done:100,total:380}` · 120 | **같음** |
| P8 채우는 중 notePage | `[5]` | `[5]` | **같음**(200쪽 들었을 때 씀) |
| P1b invalidate 만 | — | — | 부분 결과 2회(20 → 70), 최종 160 — 8g2bR-3 의 4 |
| P9 채우기 읽기 1회 실패 | — | (문제 1 서술) | 같은 책 검색·`prepareDoc`·**서재 전체** 모두 reject. `invalidate`·다른 책 검색으로 풀림 — 3 의 1 |
| P10 다시 읽기 1회 실패 | — | — | 표시가 사라져 다음 검색이 새 글자를 못 찾음 — 3 의 1 |
| P11 채우는 중 invalidate 3회 | — | — | 0적중 · `cancelled` 없음 · `error` 없음 — 3 의 3 |
| P12 검색어 오류 모양 | — | — | `{error:'ERR_SEARCH_SHORT', hits:[]}` · 서재 `{docs:[], error}` |
| P13 실제 versionchange 뒤 | — | — | `searchDoc`·`searchLibrary` reject `ERR_DB_OPEN`(VersionError), `prepareDoc` 은 `error` — 3 의 2 |

## 8g2bR-7. spec 반영 확인 (17-8-5 · 17-8-12 안에서만)

- 바뀐 자리 `git diff -U0`:
  - 17-8-5(3543–3567)에 새 줄 4개(3563–3566).
  - 17-8-12(3636–3931) §6 표 두 행(3860·3862)과 §7 S11·S15 두 줄(3881·3885).
  - **다른 절은 0 줄**이다. 표시 `[정정 2026-10-19 — 8g-2 Review]` 9개 — 8g-4 행에 둘 — 8줄 모두에 있다.
- 8g2R-8 판정과 맞는가:

| 문안 | 8g2R-8 요구 | 반영 | 판정 |
|---|---|---|---|
| ① library 배선 | 8g-2 행에, 8g-4 행에서 `reextractDoc` 뒤 invalidate 빼기, 삭제 뒤 invalidate | 8g-2 행에 배선 셋, 8g-4 행은 "8g-2 행으로 옮김" | ○ |
| ② API | `headLevel` 안 만듦 · (a) `preparing.done` 뜻 · (b) DB 오류 동작 | 셋 다 있음. `preparing.done` 은 고친 값의 뜻으로 적혔다. 오류 줄에 (가) 표시 | ○ — 다만 닫힌 연결 문구가 지나침(3 의 2), "`onPartial` 로 한 번"이 무효화 때 두 번(3 의 4). 다음 spec 정리 때 두 군데 |
| ③ 서재 백필 | 결정 고정(M20) · S15 "백필이 끝난 뒤" · 화면이 책별 진행을 보여야 · Nour 비용은 배포 뒤 양에 달림 | 17-8-5 새 줄 + §6 8g-4 행(책별 진행·DB 오류 안내) + S15. M20 은 S12c 로 묶임 | ○ — 17-8-2 "서재 전체 ≤ 3초"는 범위 밖이라 그대로(Build 관찰 5에 동의, 다음 spec 정리) |
| ④ S11 | "1,000 을 넘으면(정확히 1,000 은 아님)" | 그대로 | ○ |

## 8g2bR-8. 측정 · 전체 테스트 · 정리

- **CMDT 2026 `--app`** — `node --max-old-space-size=8192 apps/medreader/dev/measure-search-8g.mjs "<CMDT 2026>" --pdfjs <5.6.205> --json r8g2b/app-c26.json --app`, 종료 0.
  - 백필 1,967/1,967(written 1,967 · failed 0 · `error` 없음) · 레코드 차이 0 · 키/`sk` 이상 0.
  - `agg` 8칸 모두 0 · 서재 4개 차 0 · 다시 찾기 2,433쪽 불일치 0 · 두 줄 적중 140.
  - `r8g2b/cmp-app.mjs`(ms·time·heap 칸을 뺀 `app` 비교)로 **8g-2 판 `r8g2/build-app-c26.json` 과도, Build 8g-2b 판 `b8g2b/app-c26.json` 과도 같다**. 검색 결과 불변.
  - 시간(참고, OCR 일괄 작업과 CPU 를 나눔): 다음 검색 7ms, 첫 검색(fake-idb) 163ms, 백필(fake-idb) 2.07초.
- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초):
  - 변이 전 1회 + 끝 2회 — **1126/1126**, fail 0, cancelled 0(8.9·8.8·8.7초). 로그 `full-pre.log`·`full-1.log`·`full-2.log`.
  - `stamp-importmap.mjs --check` → "그대로다 (모듈 56개 · CSS 4개)", 종료 0.
- 레포에서 바꾼 것은 이 절뿐이다.
- 남은 프로세스: 내가 띄운 node 는 모두 끝났다. 끝 `tasklist` 의 node 43840 은 이전 보고들이 적은 것(Adobe)으로 내 것이 아니다. 브라우저·python 은 쓰지 않았다.
- 권한·훅에 막힌 명령은 없다. 커밋·checkout/restore/stash·`rm -rf`·npm·다운로드는 하지 않았다. PDF 는 CMDT 2026 한 경로만 읽었다. 출력은 수치뿐이다(원서 글자 저장·인용 없음).

## 8g2bR-9. 운영자 결정 필요 사항

1. **커밋**: 8g-2b 작업 트리는 커밋해도 된다(화면 변화 0, 배포는 8g-4 와 함께).
2. **[8g-4 배포 전 — 권장: 엔진에서 고침] 읽기 실패가 붙는 문제**(3 의 1). 한 번이면 그 책과 서재 전체 검색이 굳는다.
   - 고칠 것: ⓐ `ensureLoaded` 실패 때 캐시 비우기(한 줄) · ⓑ `rereadDirty` 실패 때 표시 되돌리기(한 줄) · (선택) 3 의 3 의 끝 갈래 `null`.
   - 방법: **8g-4 Build 지침의 첫 항목**으로 넣을지, 작은 8g-2c 로 따로 할지 정해 주세요. Review 권장은 8g-2c — 8g-4 Review 가 화면에 집중하게.
3. **[8g-4 지침에 넣을 것]**
   - (a) `searchDoc`·`searchLibrary` 의 **reject** 를 잡아 일반 오류 안내(실제 `versionchange` 뒤에는 `ERR_DB_OPEN` 으로 거절된다 — 3 의 2).
   - (b) 결과 `error` 를 접두어로 가르기: `ERR_SEARCH_*` 는 검색어 안내, `ERR_DB_*` 는 결과와 함께 띠/배너.
   - (c) 같은 세대의 `onPartial` 이 두 번 올 수 있으니 바꾸기로 그리기(3 의 4).
   - (d) 서재 결과의 책별 백필 진행(이미 §6 에 있음).
4. **[다음 spec 정리 때] 17-8-5 문구 둘**(닫힌 연결 · "`onPartial` 한 번")과 17-8-2 "서재 전체 ≤ 3초"에 "백필이 끝난 뒤".

# 8g-2c Review — 검색 엔진: 읽기 실패가 캐시에 붙는 문제 (2026-10-19)

> 지침 `.claude/tasks/medreader-review-8g-2c.md`. Build 와 분리된 검증. 시작 상태 HEAD `f42f72e` + 작업 트리(engine.js · tests/search-db-8g.test.mjs · index.html stamp). 시작 sha256 이 Build 보고 5절 끝 값과 같다(engine `aa92ddb0…` · 테스트 `76ce5e54…` · index `90bec177…`). 스크래치 `r8g2c/` 만 썼다(백업 `bak/`). 앱 코드·테스트·spec 은 고치지 않았다. 변이는 되돌렸고 `cmp` 로 같음을 확인했다. 끝에 4개 파일(review.md 포함, 이 절을 쓰기 전) sha256 이 시작과 같다. 커밋하지 않았다. 브라우저는 쓰지 않았다(화면 변경 없음).

## 8g2cR-1. 결론 — **통과**

- ⓐ 채우기 실패 → 캐시 버림, ⓑ 다시 읽기 실패 → 표시 되돌림, 밖으로 나가는 오류 `db.ERR` 코드화가 지침대로 들어갔다. 경쟁에서도 맞게 돈다(2절).
- 새 테스트 S13e·S13f 는 ⓐ·ⓑ 되돌림 변이를 잡는다. 다만 내 변이 둘(`cache === c` 검사 빼기 · 되돌릴 때 기존 표시 덮어쓰기)은 테스트가 못 잡고 내 경쟁 탐침만 잡는다. **[권장, 낮음] 테스트 2개 보강**(3절)을 제안한다. 커밋을 막는 일은 아니다.
- 탐침 다시: P9·P10 만 바뀌었다(고쳐짐). 나머지 P1·P1b·P2·P3·P8·P11·P12·P13 은 8g-2b Review 출력과 JSON 이 같다.
- 전체 테스트 1128/1128 × 2회, `stamp --check` 0.

## 8g2cR-2. 확인 (탐침 `r8g2c/race.mjs` = `r8g2b/probe.mjs` 도우미 + R1–R6, 출력 `race.out`)

**변경 범위** — `git diff --stat` 은 engine.js(+22/−4) · 테스트(+84) · index.html(stamp 한 줄)뿐이다. 미추적 `.codex/`·`AGENTS.md` 는 2026-08-27 파일로 이번 작업과 무관하다.

**ⓐ `ensureLoaded` 실패 → 캐시 비움**

| 경우 | 결과 |
|---|---|
| R1c A 채우기 요청이 걸린 순간 B 를 연다(실패 시점 캐시 = B) | A 만 reject `ERR_DB_OPEN`. B 캐시가 남는다(30쪽). |
| R1d A 실패가 **B 가 다 채워져 쉬는 동안** 온다(순서 `B done → A fail`) | B 캐시가 남는다. 서재 검색이 B 를 먼저 연다. |
| R3c 채우는 중 `invalidate` + 같은 책 새 캐시 → 옛 채우기 실패 | 새 캐시가 남는다(30쪽). 다음 검색 30. |
| R1b B 를 연 뒤 A 검색 실패 | 캐시 null. 서재는 A 30 · B 0(정상), 오류 없음. |
| R2b 같은 채우기를 함께 기다리던 `prepareDoc` 둘 | **둘 다** 같은 `ERR_DB_OPEN` 으로 reject. |
| R2b 채우는 중 시작한 `searchDoc`(`documents` 읽기 뒤에 `ensureLoaded` 도착) | 실패가 이미 캐시를 비워 새로 채운다 → 30. |
| R2 앞 세대 `searchDoc`(`ensureLoaded` 전에 세대가 바뀜) | `cancelled`. |

- 머리 주석의 "그 검색만 거절한다"는 정확히는 **"그 채우기를 함께 기다리던 호출만"**이다. 같은 프라미스를 기다렸으니 자연스럽고, 다음 호출은 정상이다. 해는 없다.
- 관찰(이번 범위 밖, 8g-2b 때부터): 채우기를 **기다리는 도중** 취소된 검색(signal abort · 세대 교체 · `invalidate`)은 `cancelled` 가 아니라 reject 로 끝난다(R3 · R3b · R6 `signalAbortedThenFail`). 그 검색이 `invalidate` 로 stale 이 된 경우에도 다시 채우지 않고 reject 한다. 다음 검색은 정상이다. → 8g-4 화면이 reject 를 잡을 때(8g2bR-1 조건 2) **앞 세대 검색의 reject 는 무시**해야 한다.

**ⓑ `rereadDirty` 실패 → 표시 되돌림**

- R4: 표시 {2} 를 비운 뒤 실패 요청을 거는 순간 `notePage(2)`·`notePage(3)` 을 넣었다. 실패 뒤 `dirty 2` 다. 빠지지 않았고 `Set` 이라 겹치지도 않는다. 다음 검색이 새 글자 [2,3] 을 찾고, 옛 글자는 [1,4,5] 다.
- R4b(대조, 성공 길): 다시 읽는 동안 들어온 표시는 남고(`dirty 1`), 다음 검색이 읽는다.
- R5: 같은 다시 읽기를 기다리던 `prepareDoc`·`searchDoc` 은 둘 다 `ERR_DB_OPEN` 이다. 표시는 1로 되돌아오고, 다음 검색은 정상이다.

**`dbFailure`** (R6)
- 이미 `DbError` 면 **같은 객체**를 그대로 낸다(QUOTA · UPGRADED).
- IDB 트랜잭션의 `AbortError` 는 `ERR_DB_OPEN`(cause AbortError)이 된다. 엔진은 사용자 취소를 `AbortError` 로 던지지 않으므로(`alive()` 확인) 잘못 감싸는 경우가 아니다.
- `QuotaExceededError` 는 `ERR_DB_QUOTA`, `InvalidStateError` 는 `ERR_DB_OPEN` 이 된다.
- 검색어 오류는 읽기를 건드리지 않는다(읽기 0회). `searchDoc`·`searchLibrary` 모두 `ERR_SEARCH_SHORT` 다.
- 관찰: `loadCache` 안의 **코드 버그**(TypeError 등)도 `ERR_DB_OPEN` 으로 감싸진다. 원인은 `cause` 에 남으므로 해는 작다.

## 8g2cR-3. 테스트의 힘 (`r8g2c/mut.mjs` · `mut.log` · `mut-R?.log`)

변이마다 engine.js 한 곳을 바꾸고 검색 DB 테스트 파일과 경쟁 탐침을 돌렸다. `finally` 로 `bak/engine.js` 를 복원했다. 다섯 번 모두 "복원 같음"이고, 끝에 `cmp` 도 같았다.

| 변이 | 테스트 | 경쟁 탐침 |
|---|---|---|
| RA ⓐ 되돌림 | **빨강** S13e | (탐침이 처리 안 된 reject 로 멈춤) |
| RB ⓑ 되돌림 | **빨강** S13f | — |
| RC `cache === c` 검사 빼기(무조건 비움) | 초록 35/35 | R1d 가 잡음: B 캐시가 null, 서재가 A 를 먼저 엶 |
| RD 되돌릴 때 기존 표시를 덮어씀(`clear` 후 ns) | 초록 35/35 | R4 가 잡음: 표시 1, 3쪽이 **옛 글자로 남음** |
| RE `dbFailure` 가 `DbError` 도 다시 감쌈 | 초록 | 코드는 같고 객체만 다름 — 호출자에게 같은 동작 |

- RC 가 테스트를 통과하는 까닭: 대개는 B 의 `ensureLoaded` 가 `cache !== c` 를 보고 다시 채워 스스로 낫는다. B 가 이미 쉬고 있을 때만 드러난다. 그때의 해는 다시 읽기 한 번과 서재의 "열린 책 먼저" 순서 정도다.
- RD 는 다시 들어오면 **옛 글자 검색 결과**를 낸다.
- **[권장, 낮음]** 위 두 경우를 묶는 테스트 2개(R1d 꼴: 빈 요청으로 A 트랜잭션을 늘여 B 가 쉬는 동안 A 실패 · R4 꼴: 실패 요청을 거는 순간 다른 쪽 `notePage`)를 8g-4 Build 에 함께 넣거나 작은 별도 작업으로 넣는다.

## 8g2cR-4. 탐침 다시 · 전체 테스트 · 정리

- `r8g2b/probe.mjs` 를 그대로 돌렸다(`r8g2c/probe.out`). 항목별 JSON 을 8g-2b Review 출력과 비교했다.
  - **P9**: 전에는 1·2·3번째 검색, `prepareDoc`, 서재가 모두 `UnknownError` 였다. 지금은 첫 검색만 `ERR_DB_OPEN` 이고, 2·3번째·`prepareDoc`·서재는 30이다. "다시 실패"도 그 한 번만 `ERR_DB_OPEN` 이다.
  - **P10**: 전에는 2번째가 `[]` 였다. 지금은 `[2]` 이고 `dirty 0` 이다.
  - P1·P1b·P2·P3·P8·P9 after_invalidate·P11·P12·P13 은 **같다**. Build 출력(`b8g2c/probe.out`)과는 전 항목이 같다.
- `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초) 2회: **1128/1128**, fail 0, cancelled 0(8.6초·8.8초). 로그는 `r8g2c/full-1.log`·`full-2.log` 다.
- `stamp-importmap.mjs --check`: "그대로다 (모듈 56개 · CSS 4개)", 종료 0.
- 남은 프로세스: 내가 띄운 node 는 모두 끝났다. `node 43840` 은 이전 보고들이 적은 것으로, 내 것이 아니다. 권한·훅에 막힌 명령은 없었다.

## 8g2cR-5. 운영자 결정 필요 사항

1. **8g-2c 커밋 승인**(engine.js · 테스트 · index.html stamp). 미푸시로 두고 8g-4 와 함께 배포한다.
2. **[권장, 낮음] 테스트 2개 보강**(8g2cR-3 의 RC·RD). 8g-4 Build 에 넣을지, 작은 별도 작업으로 할지 정해 주세요.
3. **8g-4 조건 2 보충**: 화면이 reject 를 잡을 때 **앞 세대(취소된) 검색의 reject 는 무시**한다(8g2cR-2 관찰). 8g-4 지침에 한 줄 더할지 정해 주세요.

# 8g-3 Review — 목차·쪽 라벨 (`js/search/outline.js` + 리더 배선) (2026-10-19)

> 지침 `.claude/tasks/medreader-review-8g-3.md`. Build 와 분리된 검증. 시작 상태 HEAD `fc82150` + 작업 트리(새 `js/search/outline.js`·`tests/search-outline-8g.test.mjs`, 바뀐 `js/ui/reader.js`·`dev/measure-search-8g.mjs`·`index.html` stamp). import map 의 해시가 지금 파일과 같다(outline `e9f8f5d676` · reader `77f1134d04`). 스크래치 `r8g3/` 만 썼다(백업 `bak/`). 앱 코드·테스트·spec 은 고치지 않았다. 변이는 되돌렸고 sha256 으로 같음을 확인했다. `D:/OCR` 는 읽기만 했다. 커밋하지 않았다. 브라우저는 쓰지 않았다(화면 변화 없음).

## 8g3R-1. 결론 — **통과** (커밋 가능). 다만 8g-4 전에 운영자 결정 둘(7절 1·2)

- `outline.js` 는 spec 17-8-6 · 17-8-12 §3 · S16·S17 대로다. 세 의학책 측정을 내가 다시 돌렸고 Build 수치와 모두 같다(3절).
- 배선은 리더 성능·쪽 넘김·8i-1/8i-3 경로에 끼어들지 않는다(2절).
- **새로 드러난 것 — 실제 대상 책(OCR 어학 교재)에서는 전제가 다르다**(4절).
  - 32권 중 23권은 개요가 없다.
  - 6권은 **스캐너가 만든 쓰레기 개요**를 가졌다. 쪽마다 하나씩 붙은 `SAVE###.JPG`·`###.bmp` 같은 파일 이름이다.
  - "개요 먼저" 규칙대로면 이 6권의 목차 탭에 파일 이름 수백 줄이 뜬다. 코드 결함은 아니고 spec 에 규칙이 없는 것이다.
  - 폴백이 이제 주 경로인데 품질은 책마다 0–70% 다.
- Build 가 남긴 "폴백 겹침"은 OCR 6권에서 **0** 이다. 지금 고치지 않기를 권한다.
- 내 변이 9개 가운데 4개가 빨강이다. 생존 5개는 모두 낮음이다(5절).
- 전체 테스트 1143/1143 × 2회, `stamp --check` 0.

## 8g3R-2. spec 대조 · 배선

**outline.js — spec 대로인가**

| 항목 | 확인 | 근거 |
|---|---|---|
| 개요 펼침(깊이 최상위 1 · 앞 순서 · 깊은 트리) | ○ | 스택 펼침. 테스트 40단 트리. 내 변이 R6(자식 순서 뒤집기)이 4건 빨강 |
| 쪽 해석: 이름 대상·명시 대상(ref·정수)·대상 없음·던짐·범위 밖 → `p:null` | ○ | `pageOfDest` 는 try 로 감싸 던지지 않는다. S16 픽스처가 여섯 꼴을 다 덮는다. 음수 순번은 테스트가 없다(R2 생존, 낮음) |
| 쪽 라벨: 있고 하나라도 `String(p)` 와 다를 때만 문자열로 | ○ | `usefulLabels`. CMDT 2026 실측 1,967개 저장, 다른 두 권은 저장 안 함 |
| `db.patch` — 다른 필드 보존 · 지워진 문서를 되살리지 않음 | ○ | 레코드가 없으면 patch 가 쓰지 않는다. 읽는 사이 삭제 테스트 → `missing` |
| 멱등(`outlineV`) | ○ | 두 번째 호출에서 PDF 호출 0. 실측 세 권 모두 `cached`·PDF 0 |
| 동시 호출 묶기 | ○ | `jobs` 맵. 내 변이 R7(끝난 작업을 지우지 않음)이 3건 빨강 |
| 실패 시 저장 안 함 | ○ | `getOutline`·`getPageLabels` 가 던지면 `ERR_OUTLINE_READ` 이고 `outlineV` 를 쓰지 않는다. 다음 호출이 다시 읽는다 |
| 쪽 수 불일치 가드 | ○ | 내 변이 R1 이 빨강. 실제로는 `touchOnOpen` 이 열 때마다 `pageCount` 를 실제 값으로 맞추므로 거의 안 걸린다(방어용) |
| 폴백을 저장하지 않고 `tocOf` 로 만듦 | **타당** | 17-8-6·17-8-12 §3 은 폴백 저장을 말하지 않는다. "폴백은 searchText 만 쓰므로 오프라인 ○" 와 맞는다. heads 가 추출·백필 따라 늘어나므로 저장하면 덜 된 목록이 굳는다는 이유도 맞다. 4절 결과로 보면 더 중요하다 — 원본 개요를 저장해 두면 쓰레기 개요 판정을 **나중에 `tocOf` 에서** 바꿀 수 있다(`OUTLINE_V` 를 올릴 필요 없음) |
| 계층(3-2) | ○ | `outline.js` 는 `config`·`db`·`text/search.js` 만 쓰고 DOM·window·타이머가 0 이다(테스트 grep). `requestIdleCallback`·`setTimeout` 은 `ui/reader.js` 에만 있다 |
| 4-13-7 rowhead 섞지 않음 | ○ | heads 는 kind `heading` 만이다(Build V10). 세 권 실측에서 행 표 쪽 항목 0 |

**배선 (`scheduleOutline`)**

- 부르는 자리는 `showReader` 의 `await renderPage()`·`saveLastPage()` 뒤다. `wireExtractor` 끝, `catchUpStale()` 다음이다. 쪽 넘김마다 `showReader` 가 돌지만 아래 셋으로 대개 바로 끝난다.
  - `isOutlineCurrent(state.doc)` — `saveLastPage` 의 patch 결과가 저장 뒤 레코드를 다시 넣는다.
  - `outlineQueued` 검사.
  - `jobs` 묶기.
- 리더에 끼어드는 것:
  - 화면 경로(`renderPage`·`notifyPage`·`onPageRender`·`createRenderDone`·`refreshGate`)는 하나도 건드리지 않는다.
  - 한가할 때(`timeout 5000`, 없으면 1.5초 뒤) 한 번 돈다. 다른 책이면 그만둔다. `.catch(() => {})` 로 실패를 삼킨다. 8i-1·8i-3 테스트는 녹색 그대로다.
  - 남는 영향은 pdf.js **워커 시간**이다. 큰 책은 첫 개요 읽기가 데스크톱에서 약 220–260ms 다(CMDT 2026 · 쓰레기 개요 299항목 — 처음 `getPageIndex` 가 쪽 트리를 훑는다). 그동안 추출·표 크롭 요청이 워커 줄에서 기다린다. 책마다 한 번이라 받아들일 만하다(낮음).
- [낮음] `leaveReader` 는 `state.docId` 를 지우지 않는다. 그래서 리더를 열자마자 서재로 가도 예약된 `ensure` 가 돈다. 저장만 하므로 해는 없다. 주석의 "다른 책으로 가면 중단"은 맞다.
- [낮음] 개요 읽기가 계속 실패하는 책(손상 PDF)은 쪽 넘김마다 한가할 때 `getOutline` 을 다시 부른다. 실패가 빨라 무해하다.
- [텍스트 다시 추출]·삭제·재추출:
  - `resetDerived` 는 `outline`·`outlineV`·`pageLabels` 를 지우지 않는다(`derivedDocReset` 에 없다). U3 의도대로다 — PDF 에서 온 것이고 PDF 는 그대로다. 테스트 S16b 끝이 고정한다.
  - `reextractDoc` 는 같은 `pdfDoc` 을 다시 쓰므로 개요도 맞는 채로 남는다.
  - 책 삭제는 `documents` 레코드째 지운다. 진행 중인 `ensure` 는 `missing` 으로 끝나고 되살리지 않는다.
  - 추출기의 `reextract` 이벤트(algoVersion 상승)는 개요와 무관하다.
- 주의: 쓰레기 개요 판정 규칙(7절 1)을 저장 단계(`readOutline`)에 넣으면 이미 저장된 책은 `OUTLINE_V` 를 올려야 다시 읽힌다. `tocOf` 에 넣으면 그럴 필요가 없다.

## 8g3R-3. 측정 재현 (`measure-search-8g.mjs --toc`, pdf.js 5.6.205, `r8g3/toc-{harr,c26,c21}.json`·`.log`, 13·39·43초, 종료 0)

| | Harrison | CMDT 2026 | CMDT 2021 |
|---|---|---|---|
| `readOutline` 항목 / 해석 / 시제품 대비 쪽·제목 차 | 37/37 · 0·0 | 61/61 · 0·0 | 50/50 · 0·0 |
| 깊이 | 1:17 · 2:20 | 1:61 | 1:50 |
| 쪽 라벨 | 저장 안 함 | **1,967개 저장 — PDF−38 이 1,704쪽**, −166 이 97쪽 · 개요 61항목 전부 인쇄 ≠ PDF | 저장 안 함 |
| `ensure` 첫 / 둘째 | saved · PDF 39 → cached · **0** | saved · 63 → cached · **0** | saved · 52 → cached · **0** |
| 저장 = 읽은 것 · 크기 | 같음 · 1.5KB | 같음 · 3.5KB + 12.7KB | 같음 · 2.6KB |
| 폴백 `headingToc` = 변형 C (집합 차) | 154 (0) | 106 (0) | 98 (0) |
| **S18** 개요 쪽 ±1 / 제목 일치 | **27/37** · 13/37 | 52/61 · 5/61 | 47/50 · **45/50** |
| 행 표 쪽 항목 · 남은 숫자만 · 겹침 | 0 · 0 · 0 | 0 · 0 · 1 | 0 · 0 · 12 |
| `tocOf` 폴백 = `headingToc` | 같음 | 같음 | 같음 |

Build 표와 수치가 모두 같다. S18 기준(CMDT 2021 45/50 이상 · 항목 ≤ 200, Harrison 27/37 이상)을 충족한다.

내 실행에서 CMDT 2026 의 1절 `msResolveAll` 은 224ms, 8절 `readOutline` 은 1.9ms 였다. 1절 값은 **이름 대상 0 · 명시 대상 61** 이다. 따라서 차이는 이름 대상 해석 캐시가 아니라 **첫 `getPageIndex`(쪽 트리)** 몫이다 → Build 제안 3의 원인 문구를 고쳐야 한다(6절).

## 8g3R-4. 개요 없는 실물 책 — OCR 어학 교재 (`r8g3/olt.mjs`·`ocrtoc.mjs`, 출력 `olt-all.txt`·`ocr2-*.json`, 읽기만)

**개요 유무 — `D:/OCR/01_English` 의 ` [OCR].pdf` 32권**(스피쿠스 unit 은 1개만 셈). 앱 `readOutline` 으로 셌다.

| 꼴 | 권수 | 예 (제목 꼴만) |
|---|---|---|
| 개요 없음 → 폴백 | **23** | English Grammar in Use 3판·2판, Longman Grammar Practice, Harry Potter 2, 스피쿠스 unit, Restless 6권 … |
| **쓰레기 개요**(쪽마다 이미지 파일 이름) | **6** | `SAVE###.JPG` ×299(Essential Grammar 2판) · ×299+1(같은 책 다른 판), `###.bmp` ×201(Pronunciation in Use), `###.tif` ×163/167(Speak English like an American), `###.jpg` ×72/76(Grammar in Use Basic — 진짜 항목 4개가 섞임), `Untitled-#.jpg` ×26 |
| 진짜 개요 | 3 | Grammar in Use Supplementary 61 · Pronunciation Dictionary Study Guide 27 · (Basic 의 4) |

- 쓰레기 개요의 특징은 세 가지다. 항목 수가 쪽 수와 같고, 항목 i 가 쪽 i 를 가리키며(`pagesEqIndex` 299/299 · 201/201 · 26/26), 제목이 파일 이름 꼴이다.
- 지금 규칙(17-8-6 "개요 먼저")대로면 이 책들의 목차 탭은 파일 이름 수백 줄이 된다. 폴백은 쓰이지 않는다.
- 처음 읽기 시간은 229–261ms 다(299 명시 대상, 데스크톱).

**폴백 결과 — 앱 경로**(`getTextContent(PDF_TEXT_CONTENT_OPTIONS)` → `buildPageLayout`(이웃 포함, 측정 스크립트와 같음) → `toStored`/`fromStored` → 앱 `searchRecordOf` → 앱 `headingToc`)

| 책 | 쪽 | heading | 폴백 항목 (≤200) | 최소 r | 숫자로 시작(붙임) | **겹침** | 제목다운 항목(4개마다 표본, 눈으로) |
|---|---|---|---|---|---|---|---|
| English Grammar in Use 3판 | 393 | 3,004 | 195 | 2.23 | 8 | **0** | 약 29/40 (단원 제목 · "Exercises Unit n") |
| English Grammar in Use 2판(Murphy) | 361 | 2,055 | 158 | 1.87 | 52 | **0** | 약 7/34 — 대부분 OCR 잡음·연습 문장 |
| Longman Grammar Practice | 302 | 1,714 | 184 | 1.52 | 76 | **0** | 약 15/40 ("3.4 …" 꼴 절 제목) |
| EnglishCafePlus | 60 | 344 | 200 | 1.18 | 3 | **0** | (보지 않음) |
| Harry Potter 2 | 341 | 318 | 75 | 1.01 | 0 | **0** | **0/19** — 대화 문장(r≈1.02). 장 제목이 heading 으로 잡히지 않는다 |
| 스피쿠스 unit1 | 6 | 44 | 41 | **0.36** | 4 | **0** | 섞임. 짧은 책은 200 상한이 안 걸려 본문보다 작은 heading(r 0.36)까지 다 들어간다 |

처음 10개 제목(40자 이하로 자름)은 `r8g3/ocr2-*.json` `first10` 에 있다. 원서 문장이라 여기 옮기지 않는다. 예를 들면 Grammar in Use 3판은 "Present continuous (I am doing)" 같은 단원 제목이 이어지고, Harry Potter 는 대화 줄이다.

**판정**

1. **폴백 겹침 — 고치지 않는다(기록만)를 권한다.**
   - OCR 6권에서 0 이다. CMDT 2021 은 12/98 이지만 개요가 있어 폴백을 쓰지 않는다.
   - 겹침은 "숫자만인 heading + 같은 층의 장 제목" 꼴(CMDT 2021 식)에서만 난다. 어학 교재의 번호는 "3.4 제목"처럼 한 줄이거나 장 제목이 다른 층이다.
2. **폴백 품질은 이제 주 경로의 문제다.** spec 17-8-12 §3 의 "세 권 모두 개요가 있어 폴백은 실제로 쓰이지 않는다"는 대상 책 기준으로 더는 맞지 않는다. 29/32 권(없음 23 + 쓰레기 6)이 폴백을 쓴다.
   - 일반 규칙(책별 튜닝 아님)으로 나아질 여지는 있다. 예: r < 1 층 빼기, 문장 끝 부호로 끝나거나 긴 줄 빼기.
   - 이것은 8g-3 범위 밖이다. Plan 감이다(7절 2).
3. 8g-3 코드에는 결함이 없다. spec 대로 짰고, 대상 책 실물이 spec 의 전제와 다른 것이다.

## 8g3R-5. 테스트의 힘 (`r8g3/mut.mjs`·`mut.log`, 리더 둘은 `mut2.mjs`·`mut2.log`)

Build 의 G1–G15·V10 이 하지 않은 곳만 바꿨다. outline 변이 7개는 관련 테스트 3파일로, 리더 변이 2개는 전체로 돌렸다. `finally` 에서 `bak/` 으로 복원했고 아홉 번 모두 "복원 같음"이다. 끝에 3파일 `sha256sum -c` OK.

| 변이 | 결과 |
|---|---|
| R1 쪽 수 불일치 가드 빼기 | **빨강** 1 |
| R2 음수 쪽 순번 받기(`idx < 0` 빼기) | 초록 — 생존(낮음: pdf.js `getPageIndex` 는 음수를 내지 않는다. 손상 PDF 의 정수 대상만 해당하고, 리더 `clampPage` 가 쪽을 다듬는다) |
| R3 patch 트랜잭션 안 재확인 빼기 | 초록 — 생존(낮음: 같은 PDF 에서 같은 값을 덮을 뿐. 여러 탭에서만 의미) |
| R4 `SEARCH.ENABLED=false` 갈래 빼기 | 초록 — 생존(낮음: 꺼도 `documents` 필드만 쓰므로 무해. `off` 를 고정하는 테스트가 없다) |
| R5 `tocOf` 가 개요 `[]` 도 outline 으로 | **빨강** 1 (S16b) |
| R6 펼침 자식 순서 뒤집기 | **빨강** 4 |
| R7 `jobs` 정리 빼기 | **빨강** 3 |
| R8 리더: 실행 뒤 `outlineQueued` 를 안 풂(실패한 책을 같은 세션에서 다시 시도 안 함) | 초록 — 생존. 전체에서 빨강 3 은 `importmap` 해시 테스트(IM2·IM6·IM7b)뿐이고, 그것을 빼면 1130/1130 |
| R9 리더: 한가할 때가 아니라 즉시 부름 | 초록 — 생존(같은 이유). 배선 테스트는 소스 모양(정규식) 검사라 행동을 보지 못한다 |

→ 핵심 갈래(해석·멱등·묶기·실패·불일치·폴백 선택)는 테스트가 잡는다. **[권장, 낮음]** 리더 배선의 행동 테스트(가짜 `requestIdleCallback` 으로 "실패 → 같은 책 다음 그리기에서 다시 시도 · 다른 책이면 안 부름")와 `ensure` 의 `off` 단언 하나. 8g-4 Build(같은 `reader.js` 를 고친다)에 함께 넣으면 된다. 커밋을 막을 일은 아니다.

## 8g3R-6. 전체 테스트 · Build spec 문안 판정 · 정리

- `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초) 2회: **1143/1143**, fail 0, cancelled 0(8.2초·8.4초). `r8g3/full1.log`·`full2.log`.
- `stamp-importmap.mjs --check`: "그대로다 (모듈 57개 · CSS 4개)", 종료 0.

**Build 7절 제안 4건**

| # | 판정 | 손볼 점 |
|---|---|---|
| 1 `[정정 — 8g-3 Build]` outline 항목·`p:null`·`outline:[]`+`outlineV`·실패 저장 안 함·쪽 수 가드·상한 5,000·API | **받음** | 그대로 정확하다. 한 줄 더하기를 권한다: "`outline` 은 PDF 의 원본 개요를 그대로 둔다. 화면에 쓸지(쓰레기 개요 판정)는 `tocOf` 가 정한다"(7절 1 결정 뒤) |
| 2 폴백은 저장하지 않고 `tocOf` 로 + 겹침 기록 | **받음, 고쳐서** | 겹침 기록에 "OCR 어학 교재 6권 0 — 고치지 않음"을 더한다. 17-8-12 §3 의 "폴백은 실제로 쓰이지 않는다"에는 `[정정 — 8g-3 Review]` "대상 OCR 교재 32권 중 29권이 폴백(개요 없음 23 · 쓰레기 개요 6)"을 단다 |
| 3 CMDT 2026 3.3ms 는 따뜻한 값 | **받음, 원인 고쳐서** | "이름 대상을 이미 해석한 뒤" → "**1절이 같은 문서에서 `getPageIndex`(쪽 트리)를 이미 돈 뒤** — CMDT 2026 개요는 명시 대상 61 · 이름 대상 0". 처음 값 218ms(내 재현 224ms)가 기준이다 |
| 4 8g-4 지침(S19) | **받음, 더해서** | (a) 7절 1 결정(쓰레기 개요)을 `tocOf` 에. (b) `tocOf` 폴백은 그 책 `searchText` 전부를 한 번 읽는다 → 검색 엔진 캐시가 이미 차 있으면 그것을 쓰거나, 세션 메모리에 `pagesCovered` 를 키로 둔다(폴백이 주 경로가 됐으므로 — 낮음). (c) 폴백 머리 문구 `search.toc.fallback` 은 꼭 보인다(품질이 책마다 0–70%) |

- 남은 프로세스:
  - 내가 띄운 node 는 모두 끝났다(측정·변이는 전경 또는 끝난 백그라운드).
  - `node.exe` 43840 은 이전 보고들이 적은 것으로 내 것이 아니다.
  - 권한·훅에 막힌 명령은 없었다.
- 관찰(범위 밖): `apps/medreader/NVIDIA Corporation/umdlogs` 빈 폴더가 있다. git 이 빈 폴더를 추적하지 않아 상태에 안 보인다. GPU 드라이버가 작업 폴더에 만든 것으로 보인다 — 운영자가 지워도 된다.

## 8g3R-7. 운영자 결정 필요 사항

1. **쓰레기 개요(스캐너 북마크) 규칙 — 8g-4 전에.** 대상 OCR 교재 6/32 권이 해당한다. 책별 튜닝이 아닌 일반 규칙이다. 판정은 `tocOf` 에서(저장은 원본 그대로).
   - (가) 파일 이름 꼴 제목(`…\.(jpe?g|png|bmp|tiff?|gif|pdf)$`)인 항목을 빼고, 남은 항목이 있으면 개요, 없으면 폴백.
   - (나) 그런 항목이 대부분(예: 80% 이상)이면 개요 전체를 버리고 폴백.
   - (다) 그대로(파일 이름 목록을 보인다).
   - 권장은 **(나)** 다. Basic 처럼 진짜 4개 + 파일 이름 72개인 책은 4항목 개요보다 폴백이 낫다. 다만 폴백 품질(2)과 함께 본다.
2. **폴백 품질 개선을 Plan 할지.** 29/32 권이 폴백을 쓰고, 표본에서 제목다운 항목은 0–70% 다(Harry Potter 0). 일반 규칙 후보는 r < 1 층 빼기, 문장꼴(끝 부호·긴 줄) 빼기, 짧은 책의 층 상한이다. 8g-4 와 따로 작은 단계(8g-3b)로 할지, 기록만 할지 정해 주세요.
3. **폴백 겹침**: 고치지 않음(기록만)을 권한다(4절 판정 1).
4. **8g-3 커밋 승인**(outline.js · 테스트 · reader.js 배선 · 측정 스크립트 · index.html stamp). 미푸시로 두고 8g-4 와 함께 배포한다.
5. [권장, 낮음] 배선 행동 테스트·`off` 단언(5절)을 8g-4 Build 에 넣을지.

---

# 8g-3b Review — 폴백 목차 품질 · 쓰레기 개요 판정 (`text/search.js` `tocDropReason`·`headingToc` · `search/outline.js` `isJunkOutline`·`tocOf`) (2026-10-19)

> 지침 `.claude/tasks/medreader-review-8g-3b.md`. Build 와 분리된 검증. 시작 상태는 HEAD `67eb4a9` + 작업 트리다(바뀐 `config.js`·`text/search.js`·`search/outline.js`·`tests/search-outline-8g.test.mjs`·`index.html`, 새 `tests/search-toc-8g3b.test.mjs`). 앱 코드·테스트·spec 은 고치지 않았다. 변이는 모두 되돌렸고, 끝에 77개 파일 해시가 시작 때와 같음을 확인했다. `D:/OCR` 는 읽기만 했다. 스크래치는 `r8g3b/` 다. pdf.js 5.6.205, Node 24.14. 원서 글은 40자 이하로만 옮겼다.

## 8g3bR-1. 결론 — **통과** (커밋 가능). 막는 문제는 없고, 넘길 것 셋(테스트 보강 2 · spec 문안 2 · 규칙 관찰 1)

- 앱은 기준 정의(`dev/measure-toc-8g3b.mjs`)와 **어디서도 차이가 없다**. 94권 heading 45,906개는 빼는 이유 코드까지 같다. 목록은 2,256경우(pages·max 여러 값)에서 순서·r 까지 같다. 합성 입력 약 162만 개도 차이 0 이다(2절).
- S36 은 모두 충족한다(3절). 기존 테스트 기대값이 바뀐 곳은 spec 이 말한 R9 한 곳뿐이다(4절).
- 시간: OCR 책의 첫 호출이 1ms 안쪽으로 느린 책이 하나 있다(Longman +0.8ms). 사용자가 느낄 수 있는 차이가 아니다(5절).
- T5 는 **동치 변이**가 맞다. 짧은 글 3,900만 개를 전수로 확인했다(6절).
- 단위 테스트가 놓치는 변이가 둘 있다. 빠른 길 `HAS_STOP`, 층 상한 경계(`>`→`>=`)다. 둘 다 차등 검사(S36 꼴)는 잡지만 `node --test` 는 녹색이다 → 테스트 보강을 권한다(7절).
- 새 관찰: R2 의 "3자 이하 낱말 + 마침표" 예외를 한글 문장 끝도 통과한다. "…이야."·"…알아." 같은 줄이다. 최종 목록 5,220항목 중 150개, 58권(대부분 스피쿠스)에 해당한다. Build 결함이 아니고 규칙 수준의 문제다(8절, 운영자 결정 거리).

## 8g3bR-2. 기준 정의와 같은가 (`r8g3b/dump.mjs` → `heads/1–94.json`, `diff.mjs` → `diff.txt`, 23초)

**글자 비교**
- 정규식 6개(`ELLIPSIS_END`·`SENT_END`·`MULTI`·`DIALOG_START`·`DIALOG_END`·`OCR_SYMBOL`)와 `DIGITS_ONLY`·`JUNK_TITLE_RE` 를 눈으로 맞댔다. 모두 기준 정의와 **글자 그대로**다.
- 셈 정규식 3개(`/\p{L}/gu`·`/[\p{Lu}\p{Ll}]/gu`·`/\p{Lu}/gu`)는 모듈 상수로 올라갔다. `String.prototype.match` 는 g 깃발에서 `lastIndex` 를 0 으로 되돌리므로 상태가 남지 않는다.
- 상수 4개(`TOC_MIN_R 0.9`·`TOC_WEAK_R 1.15`·`TOC_MAX_LEN 80`·`TOC_REPEAT_MIN 3`)는 `P` 와 같다. `SEARCH.VERSION`·`OUTLINE_V`·`readOutline`·`ensure`·저장 필드는 diff 에 없다.

**빠른 길 두 개 — 증명과 차등 검사**
- `SENT_END` 는 `[.!?]` 다음에 닫는 따옴표 하나까지만 허용하고 `$` 로 끝난다. 그래서 끝 글자는 `.!?"”’'` 중 하나여야 하고, 이것이 `SENT_LAST` 와 정확히 같은 집합이다. 빈 문자열은 `indexOf('')` 가 0 이라 검사로 들어가지만 `SENT_END` 가 맞지 않아 결과가 같다.
- `MULTI` 는 `[.!?]` 를 반드시 포함한다 → `HAS_STOP` 이 거짓이면 `MULTI` 도 거짓이다.
- R8 은 대소문자 수를 `r < TOC_WEAK_R` 일 때만 센다. 기준도 그 조건이 거짓이면 수를 쓰지 않는다.
- **덧붙여(변이 M1 에서 드러남)**: `SENT_LAST` 에서 따옴표를 하나 빼도 남기기/빼기 결과는 바뀌지 않는다. `DIALOG_END` 가 `SENT_END` 의 닫는 따옴표 네 개를 모두 덮기 때문이다. 바뀌는 것은 이유 코드뿐이다(`sentence` → `dialog`).

**차등 결과 — 모두 0**

| 검사 | 수 | 차이 |
|---|---|---|
| 94권 heading 전부 `tocDropReason` ≡ `dropReason`(이유 코드까지) | 45,906 | **0** |
| 94권 `headingToc` ≡ `protoToc`(순서·t·p·r) — pages ∈ {쪽 수, 없음, 6} × max ∈ {1, 3, 10, 30, 100, 200, 500, 5000} | 2,256 | **0** |
| 공식 꼴(`{pages: 쪽 수}`, max 200) | 94 | **0** |
| `isJunkOutline` ≡ `protoJunk` | 94 | **0** (쓰레기 6 · 진짜 5) |
| 합성 — 길이 1–5 전수(14자 알파벳: 문자·말줄임·부호·따옴표·괄호·숫자) × r 2개, 그리고 앞에 낱말을 붙인 길이 1–4 전수 | 1,323,868 | **0** |
| 합성 — 무작위 30만(넓은 알파벳·NBSP·전각 공백·SMP 문자·r ∈ 경계값·NaN·undefined) | 300,000 | **0** |
| 합성 — 손으로 만든 경계(67꼴 × r 8) | 536 | **0** |
| 합성 `headingToc` — 쪽 1–12, 무작위 줄, pages 4가지 × max 5가지(전부 빠지는 층·같은 r·숫자 붙이기) | 60,000 | **0** |
| r 이 NaN 인 heading 이 섞인 경우(앱 데이터에는 없는 꼴, 참고) | 1 | 같은 결과 |

**"상한을 넘는 층에서 멈춤"**
- 기준은 `cand` 전체를 먼저 거른 뒤 누적 수가 max 를 넘는 층에서 멈춘다.
- 앱은 층을 위에서부터 판정하며 누적한다. 남는 항목이 0 인 층도 지나가지만 출력에 더하는 것이 없다. 멈춘 층의 `keep` 표시는 `h.r >= floor` 로 걸러진다.
- 따라서 두 방식이 같은 결과를 낸다. 위 max 8가지(1–5000)와 합성 6만 경우가 이를 확인한다.
- 이 거르기를 없애는 변이(M3)와 `>`→`>=` 변이(M4)는 차등 검사에서 각각 1,030 · 797 / 2,256 차이로 잡혔다(7절).

## 8g3bR-3. S36 — `measure-toc-8g3b.mjs` 를 내가 94권에 돌림 (`r8g3b/drive.sh s36`, 결과 `s36/*.json`·`judge.mjs`)

- 상한은 책마다 의학 400초 · OCR 120초, 전체 2,400초다. 94/94 종료 0, 합 212초(의학 10·33·35초, OCR 1–3초), stderr 0.
- 모든 책 `symDiffAppVsProto` **0**(합 0).
- 앱 `isJunkOutline` = `protoJunk` 94/94. 쓰레기 6 · 진짜 개요 5 · 폴백 89권. **폴백 0항목 책 0**(최소 9).
- 의학 S18:
  - CMDT 2021: **98항목 · 제목 45/50 · 쪽 47/50** (기준 ≥45·≤200 충족)
  - Harrison: **120 · 쪽 30/37**(기준 ≥27) · 제목 13/37
  - CMDT 2026(기록): 97 · 51/61 · 5/61
  - Plan·Build 값과 같다 → **회귀 0**.
- Supplementary: 쪽 **56/61** · 제목 **14/61**(기준 56·14). Harry Potter 2 = **33항목**. OCR 91권 폴백 항목 합 4,905(Plan 과 같다).
- 시간 열은 덤프 실행과 동시에 돌려 경합이 있었다 → 시간 판정은 따로 잰 5절 값으로 한다.

## 8g3bR-4. 기존 테스트 기대값 변경 — 한 곳뿐, spec R9 그대로

- `git diff tests/search-outline-8g.test.mjs`: "S17 ★ headingToc — 숫자만인 항목은 같은 쪽…" 하나뿐이다. 바뀐 것은 기대값에서 `['4', 1]`(1쪽 끝의 숫자만 항목, 다음 heading 은 2쪽)을 뺀 것, 제목 괄호 "(쪽 끝이면 뺀다 — 8g-3b R9)", 주석 한 줄이다.
- spec §11-1 U11 정정·§11-5 "이 하나만" 과 같다.
- 그 밖의 테스트 파일은 diff 에 없다(`search-text-8g` S17·S16b·S17 상한 그대로 녹색).

## 8g3bR-5. 시간 (Build 남은 문제 1) (`r8g3b/bench.mjs`·`old.mjs`·`bench.txt`)

- 덤프에서 레코드를 읽어 두 함수를 쟀다. 8g-3 쪽은 `67eb4a9` 의 `headingToc` 원문(`old.mjs`)이고, 지금 쪽은 앱 모듈이다.
- 첫 호출 = 새 프로세스 9번의 중앙값, 따뜻한 값 = 5번 데운 뒤 21번의 중앙값. 다른 측정과 겹치지 않게 혼자 돌렸다. 데스크톱, ms.

| 책 | heads | 첫 호출 8g-3 → 지금 | 따뜻한 값 8g-3 → 지금 |
|---|---|---|---|
| English Grammar in Use 3판 | 3,004 | 24.1 → 17.4 | 18.5 → 9.3 |
| Essential Grammar 2판 | 2,344 | 18.3 → 14.5 | 13.6 → 7.5 |
| Essential Grammar(다른 판) | 2,344 | 18.0 → 14.2 | 13.1 → 7.8 |
| English Grammar in Use 2판 | 2,055 | 17.2 → 15.4 | 12.7 → 9.1 |
| Longman Grammar Practice | 1,714 | **19.8 → 20.6** | 15.8 → 13.4 |
| Grammar in Use Basic 2판 | 1,271 | 10.6 → 10.7 | 6.3 → 4.2 |
| (의학) CMDT 2026 | 12,194 | 60.8 → 36.4 | 48.0 → 26.4 |
| (의학) CMDT 2021 | 5,997 | 23.0 → 18.8 | 14.8 → 9.8 |
| (의학) Harrison | 1,017 | **10.2 → 13.1** | 5.7 → 6.7 |

- Build 표와 같은 그림이다. 따뜻한 값은 OCR 6권 모두 8g-3 보다 빠르다. 첫 호출은 Basic 2판이 +0.1(잡음 범위), Longman 이 +0.8ms(+4%)다. Harrison(의학, S36 기준 밖)은 +2.9ms 다.
- **판정 — 사용자에게 의미 없음.**
  - 목차 탭을 열면 `tocOf` 가 그 책의 `searchText` 를 커서로 모두 읽은 뒤(수백 레코드) `headingToc` 를 부른다. 첫 호출 전체가 데스크톱 21ms 이하다.
  - 폰이 3–5배 느리다고 쳐도 차이는 수 ms 다 `[추정 — 폰 실측 없음]`. 탭 전환에서 느낄 수 있는 크기(약 100ms)보다 두 자릿수 작다.
  - 첫 호출 차이는 유니코드 속성 정규식(`\p{L}` 등)을 처음 컴파일하는 값과 같은 크기다. 책마다 한 번 드는 값이다.
- **S36 시간 기준을 읽는 법(권장)**: "따뜻한 값(같은 프로세스 반복 중앙값)이 8g-3 이하, 첫 호출은 기록만"으로 읽는다. 이 Build 는 그 기준을 충족한다.
  - spec 문안: S36 의 "지금 앱(8g-3) 이하" 뒤에 `[정정 — 8g-3b Review] 따뜻한 값 기준. 첫 호출(정규식 컴파일 포함)은 +1ms 안팎이 남고 기록만 한다(Longman 19.8→20.6, Harrison 10.2→13.1)` 를 단다.
  - 손 루프로 바꿔 1ms 를 줄이는 일은 "정규식 글자 그대로" 원칙과 부딪치고 얻는 것이 없다 → 하지 않는다.

## 8g3bR-6. T5 — R2 말줄임 예외는 효과가 없다 (맞음) (`r8g3b/t5.mjs`)

- **증명**: `SENT_END` 가 맞으려면 끝의 `[.!?]`(+ 닫는 따옴표) 바로 앞이 **문자**여야 한다. `ELLIPSIS_END` 가 맞으면 그 자리는 `.`(`..` 의 둘째)·`…`·공백 중 하나다. 끝 `[.!?]` 가 없는 꼴이면 `.`·`…` 자체가 끝인데, `…` 는 `[.!?]` 가 아니고 `..` 의 끝 `.` 앞은 `.` 다. 따라서 둘이 함께 맞는 글은 없다.
- **전수**: 12자 알파벳(문자 2 · `.` · `…` · `!?` · 공백 · NBSP · 따옴표 4)으로 길이 1–7 문자열 39,089,244개를 만들었다. 말줄임 끝이 7,027,335개였고, 둘 다 맞은 것은 **0** 이었다. 두 정규식이 끝에 묶여 있어 끝 7자로 충분하다.
- **94권**: 차등 검사(2절)는 그대로 0. 변이 T5(예외 제거)는 테스트 51/51 녹색, 차등 검사도 0 이었다. Build 보고와 같다.
- **의견 — 코드는 그대로 두고 spec 문안만 고친다.**
  - 정규식을 지우려면 앱과 기준 정의 두 곳을 함께 고쳐야 하는데, 얻는 동작 차이가 0 이다.
  - spec R2 의 "아님: 말줄임 뒤의 부호"에 `[정정 — 8g-3b Review] 정의('글자 + [.!?]')에서 이미 따라 나온다 — 설명용, 효과 없음` 을 단다.
  - 11-7 의 T5 는 "동치 변이(녹색이 정상)"로 표시한다. 빨개져야 하는 목록에서는 뺀다.
  - 이 예외가 실제로 일을 하게 되는 것은 `SENT_END` 를 넓힐 때(부호 앞에 문자가 아닌 글자도 허용)뿐이다. 그때 T5 를 되살린다.

## 8g3bR-7. 테스트의 힘 (`r8g3b/mutate.mjs` → `mutate.txt`·`mutate-tests.txt`)

- 변이마다 다음을 했다: 백업 `bak/` 에서 한 곳을 바꿔 앱 파일에 쓴다 → 목차 테스트 3개(`search-toc-8g3b`·`search-outline-8g`·`search-text-8g`, 51개) → 차등 검사(2절 전체) → 백업으로 복원 → `cmp`.
- **14/14 복원 같음.** 끝에 77개 파일 해시도 시작과 같았다.

| 변이 | 테스트 | 차등 검사(이유 · 목록/2,256 · 합성 이유 · 합성 목록) | 읽기 |
|---|---|---|---|
| T5 말줄임 예외 제거 | 녹색 | 0 · 0 · 0 · 0 | 동치(6절) |
| T7 R4 에 붙임표 | **빨강** S33 | 49 · 146 · 6 · 0 | |
| T12 뺀 것도 층 누적에 셈 | **빨강** S34 | 0 · 987 · 0 · 15,971 | |
| T13 R9 제거 | **빨강** S17·S34 | 0 · 290 · 0 · 22,140 | |
| T14 pages 없으면 문턱 NaN | **빨강** 7개 | 0 · 739 · 0 · 11,685 | |
| T4 `tocOf` 가 pages 를 안 넘김 | **빨강** S32 | 0(차등은 `tocOf` 를 안 봄) | |
| M1 빠른 길 `SENT_LAST` 에서 `'` 뺌 | 녹색 | 0 · 0 · 588 · 0 | 결과 중립 — 이유 코드만 바뀐다(2절) |
| M6 빠른 길 `SENT_LAST` 에서 `”` 뺌 | **빨강** S33(이유 코드 단언) | 22 · 0 · 588 · 0 | 같은 꼴, 테스트가 이유 코드를 봐서 잡음 |
| **M2 빠른 길 `HAS_STOP` 에서 `?` 뺌** | **녹색** | 136 · **329** · 48 · 0 | **단위 테스트 구멍** — R3 픽스처에 `?` 로 끝나는 첫 문장이 없다 |
| M3 층 바닥 거르기(`h.r >= floor`) 없앰 | **빨강** S17·S34 | 0 · 1,030 · 0 · 19,898 | |
| **M4 층 멈춤 `>` → `>=`** | **녹색** | 0 · **797** · 0 · 17,048 | **단위 테스트 구멍** — 누적이 max 와 정확히 같은 경계 픽스처가 없다 |
| M5 R8 빠른 길 `<` → `<=` | **빨강** S33(r 1.15) | 488 · 312 · 10 · 0 | |
| M7 쓰레기 판정을 깊이 1 만 | **빨강** S31 | 쓰레기 2권 | |
| M8 `outlineIgnored: read` | **빨강** S32 | — | |

- 다시 돌린 T 변이 6개(T4·T5·T7·T12·T13·T14)는 Build 보고와 같은 결과다.
- 단위 테스트를 지나친 M2·M4 는 94권 차등(= S36 `symDiff`)이 잡는다. 지금 코드는 맞다(2절).
- 그러나 S36 은 손으로 돌리는 `[D]` 다. 다음 수정에서 `node --test` 만 돌리면 놓친다.
- **권장(막지 않음, 8g-4 Build 에 넣거나 작은 보강으로)**:
  - (a) S33 에 `Is it ok? Yes it is` → `'multi'` 를 넣는다(`.`·`!` 가 없는 두 문장).
  - (b) S34 에 남는 수 누적이 max 와 **정확히 같아지는** 층을 넣는다. 그 층은 들어와야 한다(예: max 4, 위 층 2 + 다음 층 2 → 4항목).

## 8g3bR-8. 눈 검토 — 새 폴백 처음 15항목 (`r8g3b/first15.mjs` → `first15.txt`)

- 제목다움은 내 판정이다. Plan 은 20개 균등 표본으로 보았고, 나는 첫 화면(처음 15)을 보았다.

| 책 | 항목(8g-3 → 지금) | 처음 15 중 제목다움 | Plan(20표본) | 맞는가 |
|---|---|---|---|---|
| English Grammar in Use 3판 | 195 → 196 | **12/15** — 표지 낱말 3개(Grammar·English·Grammar) 뒤로 "Contents"·"To the student"·단원 제목·"Exercises Unit 3" | 17/20 | 맞음 |
| Longman Grammar Practice | 184 → 188 | **8/15** — "1 The sentence"·"1.1 Sentence word order" 같은 절 번호 제목. 섞인 것은 지은이 줄·예문 "a 1 We put the subject…"·OCR 잡음 3줄 | 13/20 | 대체로 맞음. 첫 화면은 앞부분 잡음 때문에 평균보다 약간 나쁘다 |
| Harry Potter 2 | 75 → 33 | **10/15** — "DOBBY'S WARNING"·"THE BURROW"·"GILDEROY LOCKHART"·깨진 "CH-HAPTERR FIvE" 꼴. 섞인 것은 첫 쪽 URL·지은이·편지 머리·깨진 글자 1·**쪽 번호 + 대화 줄 붙임 1**(`78 "Silence!" said Snape…`) | 약 22/33 | 맞음. 남는 쓰레기는 spec 11-4 가 적은 그대로다 |
| 스피쿠스 unit1 | 41 → 22 | **약 7/15** — "나의성격"·"My Personality"·"학습목표"·"1:1 대화연습"·"Practice 1". 섞인 것은 한글 안내 문장 2·OCR 잡음 2·쪽 바닥글·질문 줄 | 약 12/20 | 대체로 맞음(조금 낮음) |

- 넷 다 8g-3(Harry Potter 0/20 등)보다 분명히 낫다. Plan 의 판정과 방향·크기가 맞는다.
- 남는 쓰레기는 spec 11-9 "이번엔 못 함"과 11-4 에 이미 적힌 꼴이다. 다만 스피쿠스의 한글 문장은 거기에 없다 → 아래 관찰.

**관찰(규칙 수준, Build 결함 아님 — 기준 정의와 같다)** (`r8g3b/hangul.mjs`)
- R2 의 약어 예외("3자 이하 낱말 + 마침표는 아님", `etc.` 용)가 **한글 문장 끝**에도 걸린다. 한글은 음절 하나가 문자 하나라서 "…알아."·"…이야."·"보세요." 의 마지막 낱말이 3자 이하다.
- 94권 최종 목록 5,220항목 중 **150항목, 58권**(대부분 스피쿠스 unit)이 이 예외로 남은 한글 문장이다. 라틴 약어 예외로 남은 것은 230이다.
- R3(두 문장)도 `\p{Ll}`·`\p{Lu}` 를 써서 한글에는 걸리지 않는다.
- 일반 규칙으로 고칠 수 있다. 예: 약어 예외를 대소문자가 있는 글자에만 적용한다(문자 체계 기준이고 책별 튜닝이 아니다). 다만 규칙 변경이라 Plan 실측(의학책 S18·Supplementary·목차 쪽 일치)과 운영자 결정이 필요하다. 이 Review 범위 밖이다.

## 8g3bR-9. 전체 테스트 · 정리

- `node --test --test-reporter=tap apps/medreader/tests/*.test.mjs`(상한 600초) 2회: **1158/1158**, fail 0(8.0초·8.0초). `r8g3b/full1.tap`·`full2.tap`.
- `stamp-importmap.mjs --check`: "그대로다 (모듈 57개 · CSS 4개)", 종료 0. `index.html` diff 는 해시 3줄(config·outline·search)뿐이다.
- 앱 코드·테스트·spec·측정 스크립트를 고치지 않았다. 시작 때 기록한 77개 파일 해시(`bak/sha-before.txt`)가 끝에도 모두 같다. `.nojekyll` 있음. 커밋하지 않았다.
- 남은 프로세스:
  - 내가 띄운 node 는 모두 끝났다(백그라운드 측정 2개는 종료 0).
  - `node.exe` 43840 은 이전 보고들이 적은 것으로 내 것이 아니다.
  - 권한·훅에 막힌 명령은 없었다.

## 8g3bR-10. 운영자 결정 필요 사항

1. **8g-3b 커밋 승인**(config · text/search.js · search/outline.js · 테스트 2 · index.html stamp). 미푸시로 두고 8g-2~4 와 함께 배포한다(G1).
2. **S36 시간 기준 읽기**: 따뜻한 값 기준 + 첫 호출은 기록만(5절) — 권장. spec 문안 `[정정 — 8g-3b Review]` 한 줄.
3. **T5·R2 말줄임 예외**: 코드 그대로, spec 에 "설명용·효과 없음", T5 를 동치 변이로 표시(6절) — 권장.
4. [권장, 낮음] 단위 테스트 보강 2개(7절 (a) `?` 두 문장 · (b) 상한과 같은 누적). 8g-4 Build 에 넣을지.
5. [관찰, 결정 거리] 한글 문장 끝이 R2 약어 예외로 남는 문제(150항목/58권, 8절). 지금 그대로 둘지, 작은 Plan(약어 예외를 대소문자 있는 글에만)으로 다룰지.

# 8g-4a Review — 검색 화면 · 결과로 이동 · 검색 띠 (`js/ui/search.js` + reader·controls·speaker·router·library 배선) (2026-10-20)

> 지침: `.claude/tasks/medreader-review-8g-4a.md`. Build 보고(`.claude/tasks/medreader-build-8g-4a-report.md`)를 믿지 않고 내 스크립트로 다시 쟀다(Build `b8g4a/` 스크립트는 참고만). 커밋하지 않았다. 앱 코드·테스트·spec 은 고치지 않았다(변이는 되돌리고 해시로 확인). 진짜 API 키 없음(가짜 키 + 흉내 번역 응답). 원서 인용은 모두 40자 이하.
> 작업 폴더: 스크래치패드 `r8g4a/`(스크립트 `lib.mjs`·`setup.mjs`·`s15.mjs`·`rv.mjs`·`wait.mjs`·`xdoc.mjs`·`dbg3.mjs`·`mut.mjs`, 결과 `rv-*.json`·`s15*.log`, 변이 `mut/`, 백업 `bak/`, 캡처 `shots/`). 브라우저: Edge headless · 새 프로필 **1개**(`r8g4a/p1`, 세 의학책을 새로 가져옴 — 추출 약 2분) · 캐시 끔 · 흉내 음성. 도중에 PC 가 재시작돼 8000번 서버를 레포 루트에서 다시 띄웠다(`python -m http.server 8000 --bind 127.0.0.1`, 켜 둠).

## 8g4aR-1. 결론 — **조건부 통과**: 고칠 문제 1건(중간 — 숨은 리더가 쪽을 넘긴 뒤 "떠났던 쪽" 결과가 엉뚱한 쪽으로) + 테스트 보강 권장

- 보안·회귀·S20–S29·S15 는 통과다. 8i-1(옛 판 재생 대기)·8i-3(쪽 넘김 낭독, 리플로우·원본)·8g-3 은 깨지지 않았다(8g4aR-3).
- **F1(중간)**: 낭독 중 [🔍] → 검색 화면 뒤에서 낭독이 다음 쪽으로 넘어간 뒤, **[🔍] 를 누를 때 읽던 쪽(떠났던 쪽)의 결과**를 누르면 그 쪽이 아니라 낭독이 간 쪽이 열리고 강조가 없다(headless 재현, 8g4aR-5). 커밋 전에 작게 고치기를 권한다.
- 내 변이 10개 중 **3개만 빨강**. 배선(결과 처리의 쪽 확인·숨은 리더 돌아오기·같은 쪽 판정)이 단위 테스트에 묶여 있지 않다 — F1 이 테스트로 안 잡힌 이유와 같다(8g4aR-6).

## 8g4aR-2. 보안 (지침 1)

| 본 것 | 결과 |
|---|---|
| `innerHTML`·`insertAdjacentHTML`·`outerHTML`·`document.write` (변경 파일 전부 + `js/search/*`) | **0**(주석 1줄뿐). 결과 조각 = 글자 노드 + `<mark>`(textContent) + 글자 노드, 검색어 되풀이 = `<bdi dir=auto>` textContent, 칩·띠·책 머리도 textContent |
| XSS 검색어 3개(`<img src=x onerror=…>` · `"><svg onload=…><b>q</b>` · `</mark><script>…`) — 상태 줄·최근 칩·띠 | 실행 0(`window.__xss` 0) · 대화상자 0 · 검색 화면 안 img/svg/script/b 요소 0 · 글자 그대로 보임(`shots/S21-xss-chips.png`) |
| 검색어가 새는 곳 | URL 해시·href 에 없음 · `localStorage` 비어 있음 · 콘솔 로그에 검색어 0 · 바깥 요청은 기존 pdf.js CDN 둘뿐. 최근 검색은 IndexedDB `settings.search.recent`(의도) |

## 8g4aR-3. 회귀 — 가장 중요 (지침 2)

| 경로 | 결과 (내 스크립트) |
|---|---|
| **8i-3 쪽 넘김 낭독** 리플로우 30→36 (`rv-turn.json`) | 6번 넘김 · 발화 168 · **같은 문장 연달아 0 · 끊긴 발화 0**(끝의 내 멈춤 1 제외). 30쪽 발화 26 · 32쪽 첫 발화 "CHAPTER 36: HIV INFECTION & AIDS" — 8i-1/8i-3 Review 와 같은 수 |
| **8i-3** 원본 보기(CPU 4배) 30→36 | 같음: 연달아 0 · 끊김 0 · 쪽별 발화 수 같음. 원본 보기였음을 따로 확인(canvas)했고 설정은 리플로우로 되돌림 |
| **8i-1 B** 옛 판 쪽(310쪽을 algoVersion 11 로)을 열자마자 재생 | 65 ms `waiting-page`, 발화 0 → 새 판 저장 뒤 527 ms 첫 발화, 쪽 DOM 새로 붙음. 옛 판 읽기 0 |
| **8i-1 다시 그리기 + 검색(S25 경로)** 320쪽 옛 판 → 검색 딥링크 결과 (`dbg3.mjs`) | 49 ms 옛 판에 칠함(cur 1) → 572 ms 새 판 저장 → 584 ms 새 DOM → 같은 낱말에 다시 칠함. 300쪽도 끝 상태 같음 |
| 8g-3 `scheduleOutline` | 코드 그대로(diff 에 없음) · 8g-3/3b 테스트 초록 |
| 낭독 동반 번역·원본 보기·설정·언어 | S24 번역 요청(아래) · S26 · 네 언어 전환 중 오류 0. 콘솔 오류는 매 실행 `/favicon.ico` 404 하나(기존) |
| 기존 테스트 | 전체 1184/1184 × 3회(8g4aR-8) |

## 8g4aR-4. S20–S29 (지침 3 — `rv.mjs`, 412×915 · S20 은 360×740 도)

| S | 결과 |
|---|---|
| S20 | 360·412 × ar/en/fr/ko × 퀴즈 버튼 보임/숨김 16조합 + 검색 화면 8: 리더 상단바·띠·검색 상단바·검색 칸 버튼 **전부 ≥ 48×48 · 한 줄 · 화면 안 · 가로 스크롤 0**, 결과 줄 ≥ 48. 어긋남 0. **제목 폭: 360+퀴즈 en·fr 0px · ar 5 · ko 15**(412+퀴즈 45–67, 퀴즈 없음 60–133) — Build 남은 문제 ① 그대로 |
| S21 | 묶음 "제목 3 → 본문 71 → 표 8", 67줄, 최소 높이 48, 첫 줄 "p. 222 (PDF 260)". 조각 20개 모두 `#text,MARK,#text`, `<mark>` 앞뒤가 라틴 글자 아님(낱말 안 자름). `metform` 은 "Metform" 만 칠함(접두 적중 길이 = 검색어). `the` → 상한 문구 · 1자 → 두 글자 안내 · 61자(프로그램 입력) → "60자까지" |
| S22 | `html dir=rtl` · 조각 `dir=ltr lang=en`(계산 방향 ltr) · 쪽 "ص. 222 (PDF 260)" · 빈 결과 문구의 검색어 `<bdi dir=auto>` · 띠 ‹(이전) x=296 > ›(다음) x=196 — 오른쪽이 이전, 글리프 `scaleX(-1)` |
| S23 | 제목 묶음 첫 줄 → 260쪽: 적중 중심이 본문 영역 가운데 **−1.6%**(띠 아래~하단 크롬 위), 레지스트리 `search-hit` 5 · `search-cur` 1 · `medreader-current` 1 동시. ‹ › 다음 +2.4%. (판 어긋남 → 쪽 맨 위 + `search.notOnPage` 는 U5·Build 실측에 기댐 — 다시 안 함) |
| S24 | 낭독 중(번역 요청 2) → 검색 → 결과: 멈춤 · 띠 안내 `search.paused` · 2.5초 번역 요청 **0** · [▶] 첫 발화 = 적중 문장 · [▶] 뒤 검색 강조 지워짐(띠 남음). [읽던 곳으로] → `#/reader/…/61`, [▶] 첫 발화 = 검색 전 읽던 문장("Pain reaching maximum intensity…") **같음**. 다른 책(서재 범위 → Harrison) 결과도 멈춤·요청 0·[▶] 적중부터. **`waiting-page` 중 결과 누름은 내 손으로 못 잡았다**(검색 화면 뒤 쪽 넘김 대기가 수 ms — 다음 쪽 저장본을 빼 봐도 추출기가 곧바로 채움, `wait.mjs`). U9(실제 speaker)·Build 실측에 기댄다 |
| S25 | 8g4aR-3 표(옛 판에 칠함 → 새 판 다시 그린 뒤 다시 칠함). 재추출까지 약 0.5초(캐시 끈 CDN pdf.js) |
| S26 | 멈춘 채 fr 로 → cur 1·hit 5 · 원본 보기 → 줄 상자 1개 화면 안 · 리플로우로 → cur 1·hit 5 (단 F2) |
| S27 | `metformin` 표 묶음 → 1135쪽 `figure.search-cur-fig` 상단 121px · 화면 안 · `search.inTable` · [원본으로 보기] · 크롭 그림 1 |
| S28 | `history.back()` → `#/search/:docId`(검색어 없음) · 검색어·67줄 그대로. 목록을 900px 내린 뒤 결과 → 뒤로 → scrollY **900** |
| S29 | 아랍 문자 검색어 → `search.empty` + `search.scriptHint`(ko·ar) · Harrison 729쪽 중 364쪽만 남김 → 서재 책 머리 "21곳 · 364/729쪽" + `search.partial` + [이 책 텍스트 준비 계속] → 누르면 7초 뒤 추출 끝(해시 `#/search` 그대로) → 다시 찾으면 95곳·729/729. 이 책 범위도 `search.partial`. 서재는 입력만으로 찾지 않음(Enter 만) · 서재에서 들어오면 범위 분절 숨김 · 빈 결과 문구 `<bdi>` |

## 8g4aR-5. 찾은 문제

| # | 심각도 | 내용 · 근거 |
|---|---|---|
| **F1** | **중간** | **숨은 리더가 쪽을 넘긴 뒤, 떠났던 쪽의 결과를 누르면 그 쪽으로 가지 않는다.** 재현(`rv.mjs hidden` → `rv-hidden.json`, `shots/hidden-result-on-left-page.png`): 61쪽 끝 근처 낭독 → [🔍] → 검색 화면 뒤에서 62쪽으로 넘어감(해시는 검색 그대로 — 의도) → 61쪽에 있는 낱말을 찾아 **61쪽 결과**를 누름 → 해시 `#/reader/…/62`, 62쪽이 보이고 `search-cur` 0 · `search-hit` 0 · 안내 없음(멈춤 안내도 안 보임), 띠는 "3/394" 로 떠 있다. 원인: `showReader` 의 숨은 리더 갈래 `state.hiddenTurn && wanted === state.softFromPage && state.page !== wanted` 가 "뒤로(떠났던 쪽 해시로 돌아옴)"와 "결과 누름(그 쪽으로 가려 함)"을 가르지 못하고 해시를 낭독 쪽으로 바꾼다. `S.pending`(61쪽)은 남아, 나중에 61쪽으로 직접 가면 그때 칠해진다. 다른 쪽 결과·띠 ‹ › 는 문제없음(보통 렌더). **고칠 안**: 결과 이동이 리더에 "이동이다"를 알리게(예: `beginJump` 의 이동 전에 reader 의 작은 함수로 `hiddenTurn` 을 내림 → 61쪽을 새로 그리고 pending 처리), 판정은 순수 함수로 꺼내 테스트 |
| F2 | 낮음 | 멈춘 채 원본 보기 → 리플로우로 돌아오면 강조(cur 1)는 남지만 **적중이 화면 밖**(중심 −183%, `rv-xdoc.json` v1). [▶] 는 여전히 적중 문장부터. 리플로우 복귀 때 원본의 앵커 줄로 맞추는 기존 규칙 탓으로 보인다 — S26 문구("강조가 남는다")는 지킨다 |
| F3 | 낮음·기록 | 리더(낭독 중) → 검색 → 서재 범위 → **다른 책** 결과: 리더를 "숨기기만" 한 채 문서가 바뀌어 `leaveReader` 정리(`leaveControls` → `trband.leave`, `original.leaveOriginal`, `refreshGate.left` 등)를 거치지 않는다. 실측에서 보인 차이는 **빈 번역 띠가 보인 채 남음**(`#trBand` hidden=false, 글자 ""). 멈춤·번역 요청 0·[▶] 적중부터는 맞다(`xdoc.mjs`) |
| F4 | 기록 | `search.scriptHint` 의 `{lang}` 은 자국어 표기 "English"(서재 카드 `onboarding.lang.*` 규칙 그대로) — 아랍어 문장 안에 라틴 낱말 하나. 기존 규칙과 같아 그대로 둬도 된다 |
| F5 | 기록 | 할당량: CDP `Storage.overrideQuotaForOrigin` 이 headless Edge 에서 먹지 않아(quota 11 GB 그대로) **실제 할당량 실패 화면은 못 봤다** → S15m/실기기. versionchange: 다른 탭이 버전 4 로 열고 upgrade 를 abort → 이 탭에 `err.dbUpgraded` 배너, DB 버전 3 그대로. 그 뒤 이 책 검색은 메모리 캐시로 결과를 냈다(오류 줄 없음 — 배너가 이미 다시 불러오기를 청하므로 받아들일 만함) |

## 8g4aR-6. 테스트의 힘 (지침 7 — `r8g4a/mut.mjs`: 정확히 1회 일치 → 전체 테스트(상한) → `bak/` 복원 → 바이트 비교, 출력 `mut/X*.tap`·`mut.log`)

| # | 변이 (이번 변경 파일만) | 빨강 (IM2·IM6·IM7b 해시 테스트 제외) | 판정 |
|---|---|---|---|
| X1 | 화면 `onReaderPage` — 기다리던 이동을 **쪽 번호 확인 없이** 처리 | 0 — 살아남음 | 배선 미검증 |
| X2 | 세대 `createSearchRun.cancel()` 이 세대를 안 올림 | U6 앞 세대 | 잡힘 |
| X3 | 세대 서재 범위 책별 `onPartial` 이 세대를 안 봄 | 0 — 살아남음 | 엔진이 이미 `alive()` 로 거른다 — 사실상 같은 동작(낮음) |
| X4 | 라우터 `#/search/:docId` 의 docId 를 다시 인코딩 | U1 (+ 흔들리는 M7 1회) | 잡힘 |
| X5 | `cue` 가 `waiting-page` 에서도 시작점을 바꿈 | 0 — 살아남음 | 앱에선 `pauseForJump` 가 먼저라 같은 동작에 가깝다(낮음) |
| X6 | `cue` 가 멈춤에서도 큐를 새로 만듦 | 0 — 살아남음 | 낮음(멈춤 큐는 방금 `reload` 한 같은 쪽) |
| X7 | `pauseSpeakerForJump` 가 결과 대신 늘 true | 0 — 살아남음 | 같은 동작(pause 는 늘 paused) |
| X8 | 리더 숨은 갈래 조건에서 `softFromPage` 확인 제거 | 0 — **살아남음** | `showReader` 숨은 갈래가 테스트에 없다(F1 자리) |
| X9 | `beginJump` 같은 쪽 판정에서 `visible` 제거(숨은 리더 같은 쪽 → 해시 안 바뀜, 검색 화면에 머묾) | 0 — **살아남음** | U9 가 `visible:false`+같은 쪽 경우를 안 본다 |
| X10 | 조각 말줄임 앞쪽 늘 참 | U2 | 잡힘 |

→ 복원 10/10 바이트 같음, 끝에 작업 트리 17개 파일 sha256 이 시작과 같음. **권장(F1 고칠 때 함께)**: ① `showReader` 숨은 갈래 판정을 순수 함수로 꺼내 X8·F1 을 묶기 ② U9 에 `beginJump(env({visible:false, ready:true, docId:'D', page:7}), {docId:'D', pageNo:7})` → `go` 1회(X9) ③ `onReaderPage` 의 pending 판정을 순수 함수로(X1).

## 8g4aR-7. S15 실측 (지침 4 — 데스크톱 Edge headless 1280×800, 실제 IndexedDB, 새로 가져온 세 권, `s15.mjs`·`s15.log`)

| 항목 | 기준 | 실측 | 판정 |
|---|---|---|---|
| 백필(searchText 를 지우고 `engine.backfill`) | ≤ 2초 | **CMDT 2026 1,967쪽 1.37초** · CMDT 2021 5,051쪽 1.55초 · Harrison 729쪽 0.40초 | ✔ |
| 첫 검색(새로 고침 → 리더 → [🔍] → 2초 뒤) | ≤ 300ms | Enter 부터 그림까지 **17–21ms**(3회) · 입력(250ms 멈춤 포함)부터 283ms | ✔ |
| 다음 검색 | ≤ 50ms | 6개 검색어 중앙값 16–22ms · 최대 32ms · 엔진만 6–11ms(`the` 2ms, 상한) | ✔ |
| 서재 전체 세 권(백필 끝난 뒤) | ≤ 1초 | **524–610ms**(새로 고침 직후·열린 책 있을 때 모두) | ✔ |
| (기록) 서재 첫 검색에 Harrison 백필 포함 | — | 543ms | — |
| (기록) 저장소 | — | 세 권 usage 약 346 MB | — |

실제 할당량·versionchange 는 F5. 폰(S15m)은 [M].

## 8g4aR-8. carryover 반영 (지침 5) · 전체 테스트 · stamp

| # | 확인 | 판정 |
|---|---|---|
| 1 세 통로 | `outcomeOf`(ERR_SEARCH_* → 검색어 안내·적중 0 / ERR_DB_* → 결과 + 오류 줄) · `rejectKey`(reject → 일반 안내), 서재는 책 묶음 안 줄. U6 | ✔ (브라우저 할당량 실패 화면은 F5 — 못 봄) |
| 2 앞 세대 reject 무시 | `createSearchRun` 이 partial·final·progress·reject 모두 세대 비교, `cancelled` 버림. U6 · X2 빨강 | ✔ |
| 3 바꿔 그리기 | `applyEvent('partial')` 이 결과를 바꿈, 그리기는 모형 전체. U6 | ✔ |
| 4 서재 책별 진행 | `onProgress({docId})` → 책별 "검색 준비 중" 칸. 내 실측은 백필이 짧아(0.4초) 문구를 붙잡지 못했다 — U6·Build 실측에 기댐 | ✔(코드·테스트) |
| 5 저장소 찬 동안 | 엔진 그대로 + 결과 + 오류 줄. 이 책 범위는 250ms 멈춤 뒤만 찾음 | 코드 ✔ · 브라우저 실측 못 함(F5) |
| 6·7 엔진 테스트 보강 | S13g(`cache === c`)·S13h(표시 되돌림) 추가, 초록. Build 변이 RC·RD 빨강(다시 돌리지 않음) | ✔ |
| 15 (a)(b) | S33b(`?` 두 문장 multi)·S34b(누적 = max 층) 추가, 초록 | ✔ |

- 전체 `node --test apps/medreader/tests/*.test.mjs` **1184/1184 × 3회**(시작 1 + 끝 2, 각 약 8초, fail 0·cancelled 0). `stamp-importmap --check` "그대로다(모듈 58개 · CSS 4개)", 종료 0. `engine.js`·`outline.js`·`text/search.js` 는 `e01ff2c` 와 같음. `.nojekyll` 있음.

## 8g4aR-9. Build 남은 문제 1–5 판정 (지침 6)

| # | 판정 | 심각도 | 어디서 |
|---|---|---|---|
| ① 360px + 퀴즈 버튼 → 제목 en·fr 0px | **확인**(ar 5 · ko 15). S20 문구는 지키지만 가장 작은 폰에서 책 제목이 사라진다 | 낮음–중간 | **4b**(작게 — [⧉] 글자를 아이콘으로 등) 또는 운영자가 "360px 은 제목 숨김" 수용 |
| ② 배너(sticky)가 상단바·띠를 덮음 | 기존 동작(내 실행도 [🔍] 전에 배너 닫기가 필요) | 낮음 | **따로**(14절 배너 정리) |
| ③ `cue` 뒤 "n번째 줄" 늦게 맞음 | 코드로 동의(`cue` 가 `linechange` 를 내지 않음 — 번역 커서를 안 건드리려는 선택) | 낮음 | **4b**(진행 칸만 다시 칠하는 작은 고침) 또는 그대로 |
| ④ 제목 묶음 첫 줄 → 띠 중간 번호 | 확인("7/82") — 쪽 순서 띠의 의도된 결과 | 정보 | **그대로**(spec 문안 4로 적기) |
| ⑤ S25 시간이 CDN 에 달림 | 내 실측 약 0.5초(캐시 끔). 그동안 옛 판에 칠해져 있음 | 정보 | **그대로**(기록) |

## 8g4aR-10. Build spec 문안 제안 판정 (지침 9)

1 i18n 34키(33 + `search.tooLong`, 목차 4키는 4b) — **동의**. 2 "리더 → 검색은 숨기기만 · 숨은 채 쪽 넘김 · 떠났던 쪽 해시로 돌아오면 낭독 쪽으로 replace" — **고쳐서 동의**: 마지막 규칙은 **뒤로(돌아옴)에만** 적용하고 결과 이동에는 적용하지 않는다고 적을 것(F1). 3 띠 ‹ ›·[읽던 곳으로] replace · 읽던 자리는 띠가 없을 때만 기억 — **동의**. 4 띠 순서 = 쪽 순서 — **동의**. 5 `cue` 는 idle 에서도 · 인용 쪽 끝이면 다음 쪽부터 — **동의**. 6 원본 보기 표 적중 `original.scrollToRegion` — **동의**. 7 조각 말줄임은 잘린 쪽에만 — **동의**. 덧붙일 것: F3(다른 책 결과는 `leaveReader` 정리를 거치지 않음)을 §4-5 표에서 정해 둘 것.

## 8g4aR-11. 정리 · 운영자 결정 필요 사항

- 띄운 Edge 는 모두 닫힘(남은 msedge 0). 프로필은 새로 만든 `r8g4a/p1` 하나(약 345 MB — `rm -rf` 금지라 남김, 지울 경로). 실험 중 내 프로필 안에서 CMDT 2026 의 71·300·310·320쪽과 Harrison 365–729쪽 저장본을 손댔고 모두 앱의 재추출로 되돌아왔다(71쪽은 내 스크립트가 중간에 멈춰 재추출로 복구). 8000번 서버는 재시작 뒤 내가 다시 띄워 켜 둠(PID 15088). 8123·8124번 node 는 건드리지 않음.

운영자 결정:
1. **F1 을 커밋 전에 고칠지**(권장: 고침 — 작은 4a-fix Build 또는 4b 첫 항목. 고치는 김에 X1·X8·X9 테스트 보강).
2. Build 남은 문제 ①(360px 제목 0px)·③(진행 표시)을 4b 에서 할지.
3. F3(다른 책 결과 때 빈 번역 띠·정리 생략)을 4b 에서 정리할지, 그대로 둘지.
4. (기록) 실기기: 실제 할당량 실패 화면, Gboard 음성 입력, 쪽 넘김 대기 중 결과 누름 한 번.

# 8g-4a-fix Review — 숨은 리더 쪽 넘김 뒤 "떠난 쪽 결과"로 이동(F1) (2026-10-20)

> 지침: `.claude/tasks/medreader-review-8g-4a-fix.md`. Build 보고는 참고만 하고 내 스크립트로 다시 쟀다. 커밋하지 않았다. 앱 코드·테스트·spec 은 고치지 않았다(변이는 읽어서 쓰기로 되돌리고 매번 바이트 비교, 끝에 sha256 5개가 시작과 같음). 작업 폴더: 스크래치패드 `r8g4af/`(`lib.mjs`·`setup.mjs`·`rv.mjs`·`mut.mjs`·`revert-f1.mjs`, 결과 `rv-*.json`·`mut.log`·`mut/*.tap`·`full-*.tap`, 캡처 `shots/`, 백업 `bak/`). 브라우저: Edge headless · 새 프로필 1개(`r8g4af/pr`, CURRENT 2026 만 가져옴 — 추출 54초) · 캐시 끔 · 흉내 음성. 진짜 API 키·요청 없음.

## 8g4afR-1. 결론 — **통과**

F1 은 고쳐졌다. "뒤로 돌아옴"(낭독이 간 쪽으로 replace)은 그대로다. 8i-3·8i-1 B 회귀 없음. 판정 함수는 순수하고 표로 묶였으며, 내 변이 9개가 모두 빨강이다. 고칠 문제 없음(아래 기록 2건은 낮음).

## 8g4afR-2. 변경 범위 · search.js 무결성

- `git diff --stat`: `index.html`(stamp 2줄) · `reader.js` · `search.js`(+5 −3) · `tests/search-ui-8g.test.mjs`(U9 3줄) + 새 `tests/search-jump-8g4afix.test.mjs`. 지침 범위뿐이다. `.codex/`·`AGENTS.md`(8월 27일)는 이번 작업이 아니다.
- **search.js 는 보고서가 말한 4곳뿐이다**: import 에 `noteSearchJump`, `beginJump` 주석 2줄, `env.mark();` 한 줄, `JUMP_ENV` 의 `mark: () => noteSearchJump()`. Build 의 손 복원 흔적은 없다. HEAD 와 줄 수 1201→1203, BOM·CRLF 0(HEAD 도 0), 끝 줄바꿈 같음, `git diff --check` 깨끗. 지금 파일 5개가 Build `b8g4af/bak` 과 바이트가 같고, Build `bak-orig` 는 HEAD 와 같다.

## 8g4afR-3. F1 표시(`softEntry = 'jump'`)가 생기고 지워지는 길

| 길 | 판정 |
|---|---|
| 생김 | `noteSearchJump()` 한 곳. `state.soft`(숨은 리더)일 때만 생긴다. 부르는 곳은 `beginJump` 의 `!same` 갈래뿐이고, 바로 다음 줄이 동기 `go`/`replace` 다. 보이는 리더(띠 ‹ ›·[읽던 곳으로])에서는 생기지 않는다 |
| 지워짐 | ① `showReader` 가 `softReturnPlan` 판정 직후 ② `leaveReader` 의 숨김 갈래(검색으로 갈 때마다) ③ 정말 떠날 때. `onRoute` 가 reader 가 아닌 모든 길에서 `leaveReader` 를 부르므로, 다음 "뒤로"가 오기 전에 반드시 ② 를 지난다 |
| mark 뒤 이동이 안 끝남 | 숨은 리더면 해시가 `#/search…` 라서 `go` 는 늘 hashchange 를 낸다. `showReader` 의 이른 return 중 범위 밖 쪽은 `replace` 로 다시 들어와 jump 를 그대로 쓴다(맞음). db 오류·문서 없음은 표시가 남지만 다음 검색 진입(②)이나 서재 이동(③)에서 지워진다. 해 없음 |
| 같은 쪽 결과(숨은 리더) | X9 대로 같은 쪽이 아니다 → mark → go → `'reshow'`(다시 그리지 않음). headless `f1same`: 62쪽으로 넘어간 뒤 62쪽 결과 → 해시 62 · cur 1 · 쪽 DOM 표지 그대로(다시 그리지 않음) · 멈춤 |
| 다른 책 결과(F3) | `sameDoc` 거짓 → 늘 `'render'`, 판정 직후 표시 지움. 표 12·13줄. headless 는 한 권 프로필이라 하지 않았다(코드 판정) |
| 검색 화면 [뒤로] `goBack` | 직전 화면이 reader 면 `history.back()` → mark 없음 → follow. headless `appback` 으로 확인. 대체 경로 `go(spot 쪽)` 도 mark 가 없어 "뒤로"로 친다(Build 판단에 동의) |
| 남은 표시가 다음 뒤로를 속이는가 | headless `stale`: F1 이동(61쪽 결과) → 띠 닫고 63쪽 낭독 → [🔍] → 64쪽으로 넘어감 → 뒤로 → 해시 64·낭독 계속·연달아 0. 속지 않는다 |

## 8g4afR-4. `softReturnPlan` 표

- 순수하다(입력만 읽고 상태·DOM 을 건드리지 않음). 테스트도 입력 스냅숏이 그대로인지 본다.
- 축(뒤로/이동 × 같은 쪽/다른 쪽 × hiddenTurn × hasDom × stalePaint × soft/sameDoc)이 다 나온다. F1·뒤로 follow·X8·follow 뒤 다시 불림·같은 해시 replace 되풀이 없음이 실제 경로와 맞는다.
- 기록(낮음): 보고서의 "표 17줄"은 표 16줄 + 빈 입력·순수성 1개다. "뒤로 + stalePaint", "이동 + DOM 없음" 줄은 없다. 다만 같은 조건을 다른 줄이 잡아서(아래 변이) 실질 공백은 아니다.

## 8g4afR-5. headless (내 `rv.mjs`, 412×915)

| 단계 | 결과 |
|---|---|
| **f1** 61쪽 끝 낭독 → [🔍] → 숨은 채 62쪽(해시는 검색 그대로) → "Progressive" 검색 → 61쪽 결과 | **해시 61 · 쪽 61 · hit 1 · cur 1("Progressive") · 띠 3/394 · `search.paused` · 멈춤 · 가운데에서 −10.7%**. 뒤로 한 번 = 결과 목록(284줄). 다시 앞으로 → [▶] 첫 발화가 61쪽 적중 문장. 판정 12/12. 2회 같음(`shots/f1.png`) |
| f1 판정의 힘 | `reader.js` 의 `entry !== 'jump'` 만 잠깐 빼고 같은 절차 → 해시 62 · hit 0 · cur 0(F1 재현, `rv-f1-reverted.json`·`shots/f1-reverted.png`) → 복원 후 바이트 같음 |
| **back** 같은 절차 → `history.back()` | 해시 62(낭독이 간 쪽) · 쪽 DOM 다시 그리지 않음 · speaking · 첫 발화 62쪽 · 연달아 0 |
| appback · stale | 위 표(8g4afR-3), 둘 다 통과 |
| **8i-3** 리플로우 30→36 낭독 | 발화 168 · 쪽별 30:26 · 31:34 · 32:24 · 33:27 · 34:23 · 35:32 · **같은 문장 연달아 0** · 끊김은 끝의 내 멈춤 1개뿐. 8g4aR-3 과 같은 수 |
| **8i-1 B** 310쪽을 옛 판(algo 12→11)으로 두고 열자마자 [▶] | 78 ms `waiting-page`, 발화 0 → 551 ms speaking. 쪽 DOM 새로 붙음(2개). algoVersion 이 12 로 돌아옴. 8g4aR-3 과 같은 모양 |

모든 실행에서 콘솔 오류는 기존 404 하나뿐이다. 로컬 밖 요청은 pdf.js CDN 2개뿐이다.

## 8g4afR-6. 테스트의 힘 (`r8g4af/mut.mjs`)

정확히 1회 일치하는지 보고 바꾼 뒤 전체 테스트를 TAP 로 돌렸다(상한 300초). 그다음 bak 을 읽어서 쓰는 방식으로 복원하고(재시도) 바이트를 비교했다. 아래 "빨강"은 IM2·IM6·IM7b(해시 표) 3개를 뺀 수다.

| # | 변이 | 빨강 |
|---|---|---|
| M1 | `showReader` 판정 직후 `softEntry='back'` 빼기 | FX3 showReader |
| M2 | `env.mark()` 를 `go/replace` **뒤로** | FX2 ×2 · FX3 검색 · U9 (4) |
| M3 | `noteSearchJump` 가 `state.soft` 를 안 봄 | FX3 noteSearchJump |
| M4 | 검색으로 숨길 때 back 되돌림 빼기 | FX3 noteSearchJump |
| M5 | 정말 떠날 때 back 되돌림 빼기 | FX3 noteSearchJump |
| M6 | `JUMP_ENV.mark` 를 빈 함수로 | FX3 검색 |
| **X1** | `onReaderPage` pending 의 쪽 번호 확인 빼기 | FX3 검색 |
| **X8** | follow 조건에서 `wanted === fromPage` 빼기 | FX1 X8 줄 |
| **X9** | `beginJump` 같은 쪽 판정에서 `visible` 빼기 | FX2 X9 |

→ 9/9 빨강, 복원 9/9 바이트 같음. 기록(낮음): M1·M3·M4·M5·M6·X1 은 소스 고정(정규식)으로만 잡힌다. M1·M3·M4·M5 는 겹친 안전장치라 하나만 빠져도 행동은 같다(위 표의 지워지는 길이 여럿이다). X1 을 행동 테스트로 묶는 일은 Build 제안대로 4b 에서 pending 판정을 순수 술어로 꺼낼 때 한다.

## 8g4afR-7. 전체 테스트 · stamp · 정리

- `node --test apps/medreader/tests/*.test.mjs` **1206/1206 × 2회**(변이 앞·뒤, 각 약 8초, fail 0·cancelled 0). `stamp-importmap --check` "그대로다(모듈 58개 · CSS 4개)", 종료 0. `.nojekyll` 있음.
- 내가 띄운 Edge·node 는 모두 닫혔다. 프로세스 목록이 시작과 같다(msedge 46716 은 원래 있던 것). 8000번 python(PID 15088)은 켜 둠. 8123·8124·8125번 node 는 건드리지 않음. 프로필 `r8g4af/pr`(152 MB)은 `rm -rf` 금지라 남김.
- 실험 중 내 프로필의 310쪽 저장본 판을 낮췄고, 앱의 재추출로 되돌아왔다.

## 8g4afR-8. 운영자 결정 필요 사항

1. **8g-4a-fix 커밋 승인**(reader.js · search.js · 테스트 2 · index.html stamp). 미푸시로 두고 8g-4 와 함께 배포.
2. (기록) X1 의 행동 테스트화(`onReaderPage` pending 판정을 순수 술어로)를 4b 넘김 항목에 넣을지.
3. 8g4aR-11 의 2·3·4(① 360px 제목 · ③ 진행 표시 · F3 · 실기기)는 그대로 4b 몫이다.


# 8g-4b Review — 목차 탭 · 검색 마무리 (8g 마지막) · 배포 판정 (2026-10-20)

> 지침: `.claude/tasks/medreader-review-8g-4b.md`. Build 보고(`medreader-build-8g-4b-report.md`)는 참고만 하고 **내 스크립트로 다시 쟀다**. 커밋하지 않았다. 앱 코드·테스트·spec 은 고치지 않았다(변이는 읽어서 쓰기로 되돌리고 매번 `cmp`, 끝에 101개 파일 sha256 이 시작과 같음). 작업 폴더: 스크래치패드 `r8g4b/`(`lib.mjs`·`setup.mjs`·`rv.mjs`·`probe-*.mjs`·`run-s36.mjs`·`judge-s36.mjs`·`r2diff.mjs`·`mut.mjs`·`mut2.mjs`, 결과 `rv-*.json`·`probe-*.json`·`s36.jsonl`·`s36-judge.txt`·`r2diff.json`·`mut*.json`·`mut/*.tap`·`full-*.tap`, 캡처 `shots/`, 백업 `bak/`). 브라우저: Edge headless · **새 프로필 1개**(`r8g4b/p1` — 의학책 3 + `D:/OCR` 교재 2를 가져와 추출 113초) · 캐시 끔 · 흉내 음성 · 가짜 키 + 흉내 번역 응답(진짜 키·요청 없음). `D:/OCR` 는 읽기만 했다.

## 8g4bR-1. 결론 — **통과** · 배포 판정 — **배포해도 된다**

- S19 는 다섯 권 · 두 폭 · 네 언어에서 모두 맞다. 4a 작은 문제(①·③·F2·F3)는 고쳐졌다. 회귀(8i-3 쪽 넘김 낭독 리플로우·원본, 8i-1 B, S25 다시 그리기, F1, S23·S24·S26·S28, 퀴즈·설정·번역 띠)는 없다. R2 약어 규칙은 앱과 기준 정의가 글자 그대로 같다. 내가 다시 돌린 S36 도 Build 수치와 같다. 전체 테스트는 1228/1228 × 2회다.
- **배포를 막는 문제는 없다.** 새로 찾은 문제는 중간 1(키보드로 목차 탭에 갈 수 없음 — 터치·TalkBack 은 됨)과 낮음 4다(8g4bR-8).
- **배포 판정**: 로컬 커밋 14개(`757b46f` 8g-2 … `c36e8e4`)에 이번 8g-4b 변경을 커밋해 얹은 뒤 한 번에 배포해도 된다. 배포 전에 꼭 할 일은 **이번 변경 커밋** 하나다(운영자 승인). R1(키보드)은 1–2줄짜리라 **배포 전에 고치기를 권한다**. 다만 막는 조건은 아니다(운영자 결정). 되돌림 길(§9 — `SEARCH.ENABLED=false`, `DB_VERSION` 3 유지)은 그대로다. T5 가 `outline.ensure` 의 `off` 를 이제 행동으로 묶는다.

## 8g4bR-2. 변경 범위

- `git diff --stat` 19파일 +739 −61 + 새 `tests/search-toc-8g4b.test.mjs`(453줄). 지침 범위다. `.codex/`·`AGENTS.md` 는 이번 작업이 아니다(8월 27일).
- `js/search/engine.js`·`js/db.js`·`js/pdf/*`·`js/search/outline.js` 는 HEAD 와 같다. 바뀐 파일은 모두 LF 이고 BOM 이 없으며 끝 줄바꿈이 있다(바이트로 확인). `git diff --check` 는 깨끗하다.
- 기존 테스트 4파일의 고침은 구조 이동(같은 단언을 새 함수 이름에)이다. 기대값이 바뀐 것은 검색 키 수 34 → 38 하나다(실제 `search.*` 키 ar·en·fr·ko 각 38 — 셈 확인).
- 사소한 기록: `dev/measure-toc-8g3b.mjs` 에서 `const count = (s, re)` 가 `const count =(s, re)` 로 바뀌었다. 띄어쓰기만 다르고 동작은 같다.

## 8g4bR-3. S19 (내 `rv.mjs`, Edge headless)

**412×915 · ko**(`rv-s19.json`, 판정 10개 × 5권 모두 참)

| 책 | 저장 개요 | 목록 | 안내 | 깊이·들여쓰기(제목 x) | 지금 항목(리더 쪽) | 쪽 표시 | 누름 → | 뒤로 |
|---|---|---|---|---|---|---|---|---|
| Harrison | 37 | **37** | 없음 | 1·2 → 29·**45px**(16px) | ANSWERS p.117(120쪽), 화면 안 | p. 117 | 5쪽 · scrollY 0 | 목차 탭 · 스크롤 같음 · 지금 항목 = 5쪽 "Title" |
| CMDT 2026 | 61 | **61** | 없음 | 1 | 9. Pulmonary(300쪽) | **p. 240 (PDF 278)** · 61줄 모두 "(PDF …)" | 5쪽 · 0 | 같음 · "p. ii (PDF 5)" |
| CMDT 2021 | 50 | **50** | 없음 | 1 | 10. Heart Disease(900쪽) | p. 874 | 28쪽 · 0 | 같음 |
| Essential Grammar 2판(쓰레기 개요 299) | 299(버림) | 폴백 **192** | **E5 문구 1줄** | 1 | p. 40 항목 | p. 40 | 9쪽 · 0 | 같음(58 = 58) |
| 스피쿠스 unit1(개요 없음) | 0 | 폴백 **20** | E5 문구 | 1 | p. 3 항목 | p. 3 | 1쪽 · 0 | 같음 |

- 다섯 권 모두 다음과 같다: 줄 높이 ≥ 48, 가로 스크롤 0, **파일 이름 줄 0**, 제목 `dir=ltr lang=en`, 지금 항목은 한 개이고 "지금 읽는 곳" 글자가 붙는다. 탭을 열고 그리기까지 14–112ms 걸렸다. 도착하면 쪽 첫 줄이 상단바 아래에 있다(첫 줄 top 110–123, 상단바 bottom 57).
- **네 언어 × 360·412**(`rv-langs.json`, 10/10 참): CMDT 2026 은 61항목, 최소 높이 48, 가로 스크롤 0, 지금 항목이 화면 안이다. 탭은 두 개 모두 48px 높이다. ar 은 UI `dir=rtl`, "ص. 240 (PDF 278)", 탭 순서가 뒤집힌다(찾기가 오른쪽). 제목은 네 언어 모두 `ltr/en` 이다. 쓰레기 개요 책도 ar 에서 E5 문구 1줄 · 192항목 · 파일 이름 0 이다.
- **`p:null`**(`rv-pnull.json` — 내 프로필의 CMDT 2021 개요 2번째 항목 쪽을 null 로 바꿨다가 되돌림): `disabled`, opacity 0.5, `data-page`·쪽 표시 없음. 눌러도 해시와 화면이 그대로다. 되돌린 값 26 확인.
- **깊이 3 이상 접기**(`probe-fold.json` — 합성 깊이 3·4 항목, 끝에 되돌림 37항목): 지금 항목이 든 가지만 처음부터 펼쳐진다. 다른 가지는 숨는다. 접기 단추는 48×48 이고 `aria-expanded` 가 맞다. 누르면 펼쳐진다. 깊이 3·4 모두 61px(두 칸까지만 들인다)이고 가로 스크롤 0 이다. 세 의학책에는 깊이 3 이 없어서 실제 책으로는 볼 수 없었다.
- **pdf.js 를 못 받음**(`rv-unavail.json`): Harrison 의 저장 개요를 지우고 jsdelivr·cdnjs 의 pdf.js 를 막았다(차단 2건). 7초 뒤에도 `outlineV` 가 없다. 목차에는 **"목차를 아직 읽지 못했습니다" + E5 문구 + 폴백 120항목**이 나온다. 막지 않고 다시 열면 개요 37이 저장되고, 안내 0 · 37항목으로 돌아온다.
- **낭독 중 목차 이동**(`rv-tocplay.json`, 판정 7/7, 흉내 번역 정상 응답으로 다시 돌림): Harrison 120쪽에서 낭독(번역 동반 `speak` 모드, 번역 2회) → [🔍] → 목차 → 163쪽 항목. 결과는 **멈춤 · scrollY 0 · 이동부터 [▶] 전까지 번역 요청 0 · [▶] 첫 발화 = 163쪽 첫 줄 "SECTION III"** 다. 같은 쪽 항목(600px 내려 둠)은 쪽 DOM 표지가 그대로 남아(다시 그리지 않음) 맨 위로 간다.
- **F1 을 목차로**(`rv-tocf1.json`, 6/6): CMDT 2026 203쪽 끝에서 낭독 → [🔍] → 숨은 리더가 204쪽으로 넘김 → 목차 → 203쪽 항목. 결과는 해시 203 · 쪽 203 · 맨 위 · 멈춤 · [▶] 첫 발화 203쪽이다. 뒤로 한 번이면 목차 탭으로 돌아온다.

## 8g4bR-4. 4a 작은 문제 고침

| # | 결과(내 측정) |
|---|---|
| ① `rv-narrow.json` | 360 + 퀴즈 보임에서 제목 폭은 **ar 52 · en 54 · fr 54 · ko 55px** 이다. 버튼은 모두 ≥ 48×48 · 한 줄 · 화면 안이고 가로 스크롤 0 이다(16/16 조합). [⧉] 는 48×48 글리프(`font-size 0` + `::before '⧉'`, 캡처에서 두 겹 네모로 보임)다. `aria-label` 은 "Original" 등 그대로다. 퀴즈가 없거나 412px 이면 예전 모양이다(412 퀴즈 보임 제목: ar 57 · en 45 · fr 45 · ko 67px — Build 남은 문제 ⑤) |
| ③ `rv-cue.json` | 낭독 중(47중 1–2번째) → 검색 → 본문 결과 이동 직후 진행 칸이 **"50중 28번째 줄"** 이다. [▶] 뒤 값·`index` 27 도 같다. 멈춤 상태다 |
| F2 `rv-f2.json` | 처음 상태: 원본 → 리플로우 뒤 적중 **+2.3%**. 원본 ↔ 리플로우를 두 번 더 오가도 +2.3% 다. 낭독 멈춤에서 두 번 왕복: **−6.9%**, [▶] 첫 발화 = 적중 문장("Sarcoidosis, toxoplasmosis…") |
| F2 원본 보기 강조 `rv-s26o.json` | 처음·멈춤 두 상태 모두 원본 보기의 줄 오버레이(`hl-line`)가 적중 줄(168:65)에 있다 |
| F3 `rv-f3.json` | CMDT 2026 낭독(띠에 번역 글자 보임) → 서재 범위 → Harrison 결과. 결과: 번역 요청 0 · 발화 0 · 상태 **idle** · 적중 +5.4% · [▶] 첫 발화 "E. Sarcoidosis". 번역 띠는 **서재에서 Harrison 을 바로 연 것과 숨김·글자·클래스가 같다**(빈 띠 = `speak` 모드의 평소 모습). 앞 책의 번역 글자는 남지 않는다 |

## 8g4bR-5. 회귀 (배포 전이라 넓게)

| 항목 | 결과 |
|---|---|
| 8i-3 리플로우 30→36 낭독 | 발화 168 · 쪽별 30:26 · 31:34 · 32:24 · 33:27 · 34:23 · 35:32 · **같은 문장 연달아 0** · 끊김은 끝의 내 멈춤 1개다. 8g-4a·4a-fix Review 와 같은 수다 |
| 8i-3 **원본 보기** 30→36 | 위와 쪽별 수가 같다(발화 쪽은 발화 때의 해시로 셈) · 연달아 0 · 끊김 1 |
| 8i-1 B 310쪽 옛 판으로 열자마자 [▶] | 91ms `waiting-page`, 발화 0 → 531ms speaking. 쪽 DOM 새로 2개 · algoVersion 12 로 돌아옴 |
| S25 300쪽 옛 판 결과로 이동 | 옛 판에 칠함 → 새 판으로 다시 그림(쪽 DOM 2개) → 새 판에 cur 2 · −6.5% |
| F1 (4a-fix 재현 절차) | 61쪽 끝 낭독 → 숨은 채 62쪽 → 61쪽 결과 → 해시·쪽 61 · cur · 멈춤 · 가운데 · [▶] 61쪽부터(7/7) |
| S23·S24 | 결과 → −1.5%, 레지스트리 `search-hit`·`search-cur`·`medreader-current` 셋이 함께 있다. 낭독 중 이동 → 멈춤 · `search.paused` · 번역 0. [읽던 곳으로] → 61쪽, [▶] 가 원래 문장("by 79 percent…")부터 |
| S26 | ar 로 바꿔도 강조가 남는다(띠 "1 من 82"). 원본 보기 오버레이 위 표 |
| S28 | 뒤로 = 검색어 "hypertension" · 결과 374줄 · scrollY 1175 그대로 · 검색어가 URL 에 없다 |
| 퀴즈 | Harrison 12쪽 퀴즈 버튼 → `#/quiz/…/sec-I` "문항 1/149", 선택지 5 → [뒤로] → 리더 12쪽 |
| 설정 · 번역 띠 | `#/settings` 열림(컨트롤 25). 낭독 동반 번역은 문장마다 띠에 번역 글자가 나오고 단계 `src`→`tr` 로 진행한다(`probe-tr.json`) |

모든 실행의 콘솔 오류는 기존 `/favicon.ico` 404 하나다(unavail 은 의도한 차단 `ERR_FAILED` 2개가 더 있다). 로컬 밖 요청은 pdf.js CDN 뿐이다.
기록: 내 흉내 번역 응답은 처음에 숫자를 옮기지 않아 앱 품질 검사에서 "번역 실패"가 됐다. step2 처럼 숫자를 넣어 다시 돌렸고, 번역 수가 걸린 단계(tocplay·cue·f3·s2x)는 고친 응답으로 다시 쟀다. 앱 문제가 아니다.

## 8g4bR-6. R2 약어 규칙 · S36 (내가 다시)

- 앱 `js/text/search.js` 와 기준 정의 `dev/measure-toc-8g3b.mjs` 의 `CASED_WORD = /^[\p{Lu}\p{Ll}]+$/u`, R2 조건 줄, `SENT_END`·`ELLIPSIS_END` 가 **글자 그대로 같다**(grep 대조).
- **S36**(`r8g4b/run-s36.mjs`: 의학 3 + `D:/OCR` 아래 ` [OCR].pdf` 91 = 94권. 책마다 상한 400/120초, 전체 상한 2,400초. 94/94 종료 0, 204초): 모든 책 `symDiffAppVsProto` **0**(합 0) · `isJunkOutline` = `protoJunk` 94/94(쓰레기 6 · 진짜 개요 5 · 폴백 89) · 폴백 0항목 책 0(최소 8).
- **의학책 S18 회귀 0**: CMDT 2021 98항목 · 제목 45/50 · 쪽 47/50 / Harrison 120 · 쪽 30/37 / CMDT 2026 97 · 51/61 · 5/61. Supplementary 쪽 56 · 제목 14, Harry Potter 33. OCR 폴백 합 4,755(앞 판 대비 −150), 스피쿠스 1,038 → 911, 문장꼴 715 → 565.
- **빠진 항목**(`r2diff.mjs`: `c36e8e4` 의 `text/search.js` 를 `git show` 로 꺼내 r8g3b heads 덤프 94권에 앞뒤 `headingToc`): 5,220 → 5,070, **빠짐 150 · 모두 "끝 낱말 ≤ 3자 + '.' + 대소문자 없는 글자" 규칙 때문이고 끝 낱말이 한글 150/150** · **새로 들어옴 0** · 58권(스피쿠스 57권 127 · EnglishCafePlus 23) · 의학책 변화 0.

## 8g4bR-7. spec 정정 12줄 · Build 7절 제안

- 12줄 모두 `[정정 2026-10-20 — 8g-4b …]` 이다. 17-8-5 안에 3줄(3566–3568), 17-8-12 안에 9줄(§2-2·§4-1·§4-3·§4-5 ×4·§4-6·§11-3)이 있다. 다른 절은 건드리지 않았다.
- 내용이 carryover 8·9·10·16·22·23 과 4a·4a-fix Review 판정에 맞는다. ⑦ "replace 는 뒤로 돌아올 때만"은 F1 판정과 같다. ⑩ F3 "상태는 처음 · 빈 띠는 그 모드의 평소 모습"은 내 측정과 같다. ⑪ 키 38 은 셈과 같다. ⑫ S36 수치는 내 재실행과 같다(시간만 193 → 204초).
- 작은 어긋남(낮음, 다음 spec 정리 때): §4-6 표의 `search.toc.here` 설명이 "현재 항목 aria"다. 구현은 **보이는 글자 + `aria-current`** 다. 표의 `search.toc.fallback` 글자는 E5 이전 문안이다(정정 줄이 바로잡고 있음).
- **Build 7절 제안에 대한 의견 — 셋 다 spec 에 넣기를 권한다**(운영자 승인 뒤 다음 spec 손볼 때): (a) 목차 탭 세부는 17-8-6/§4-2 에 넣는다. 이때 "지금 항목 = 같은 쪽이면 뒤 항목"(남은 문제 ③)과 "목차 이동 뒤 멈춤 안내"(②) 처리, 아래 R1 의 키보드 규칙(화살표 또는 두 탭 모두 Tab)을 함께 적는다. (b) F2 규칙은 §4-5 뷰 전환 행에 넣는다. 아래 R2 를 고칠 경우 "목차 이동 뒤에는 검색 시작점이 아니다"도 함께 적는다. (c) ① 은 S20 에 넣는다. 문턱(400 vs 420)은 남은 문제 ⑤ 결정에 따른다.

## 8g4bR-8. 찾은 문제

| # | 심각도 | 내용 · 근거 | 언제 |
|---|---|---|---|
| **R1** | **중간(접근성)** | **키보드로 목차 탭에 갈 수 없다.** 안 고른 탭에 `tabindex=-1`(index.html·`paintTabs`)을 주면서 WAI-ARIA 탭의 화살표 키 처리를 붙이지 않았다(`search.js` 에 keydown·Arrow 없음). `rv-kbd.json`: Tab 순서 = `searchInput → searchClear → searchGo → searchTabFind → (본문) …`, `searchTabToc` 에 한 번도 닿지 않는다. 찾기 탭에서 → 를 눌러도 초점·선택이 그대로다. 터치·TalkBack 스와이프는 접근성 트리를 따르므로 영향이 없다(Nour 기기는 됨). 고침은 1–2줄이다: 화살표 ←/→(RTL 뒤집기)·Home/End, 또는 두 탭 모두 `tabindex=0` | **배포 전 권장**(막지는 않음 — 운영자 결정) |
| R2 | 낮음 | **검색 결과로 간 쪽과 같은 쪽의 목차 항목으로 간 뒤 뷰를 오가면, 목차가 정한 "맨 위·첫 줄"이 적중으로 되돌아간다.** `probe-topview.json`: 203쪽 결과(scrollY 2698, 27번째 줄) → 목차 203쪽 → scrollY 0 · "47중 1번째 줄" → 원본 ↔ 리플로우 → **scrollY 2723 · "27번째 줄"**, [▶] 첫 발화가 적중 문장이다. 원인은 `doTop` 이 `S.lastJump`·`S.curLine` 을 바꾸지 않아서다. 그래서 `shouldRecue`(lastJump 가 이 쪽 + `cueOwned`)와 원본 보기 `revealLine`·뷰 힌트가 옛 적중을 다시 쓴다. 고침은 `doTop` 에서 `S.lastJump = null`(또는 맨 위 표시) | 다음 단계 |
| R3 | 낮음 | Build 남은 문제 ② 를 확인했다. 목차 이동으로 멈췄는데 띠가 없으면 `#searchBandNote` 에 `search.paused` 키가 들어 있지만 띠가 숨어 있어 안 보인다(`rv-tocplay`: band hidden · note "search.paused") | 다음 단계(운영자 결정) |
| R4 | 낮음 | 접기 단추의 이름이 그 항목 제목뿐이다. Harrison 같은 책은 "ANSWERS" 가 섹션마다 되풀이되어 화면 낭독기에서 어느 가지인지 모른다(`probe-fold`). 지금 세 의학책에는 깊이 3 이 없어 실제로는 안 보인다 | 다음 단계 |
| R5 | 낮음(테스트) | 내 변이 중 살아남은 3개(아래 8g4bR-10): 목차 탭에서 타이핑 → 찾기 탭(M3), 목차 이동이 멈춤 사실을 띠에 넘김(M4), 검색 화면을 떠날 때 목차 읽기 세대(M9). 행동 영향은 작다 | 다음 단계 |
| 기록 | — | `screens.css` RTL 주석은 "닫힌 글리프는 inline-start 쪽"이라고 하지만 실제로는 두 방향 모두 inline-end 를 가리킨다. 동작은 맞고 주석만 틀렸다 | 그대로 |

## 8g4bR-9. Build 남은 문제 1–6 판정

| # | 내용 | 심각도 | 판정 |
|---|---|---|---|
| ① | 멈춘 채 뷰를 오갈 때 `speaker.reload` 의 시작점 밀림(검색과 무관, speaker.js) | 낮음 | **다음 단계**(speaker.js 작은 Plan — `ranges` 첫 글자 기준). 검색이 정한 시작점은 지켜진다(F2 측정) |
| ② | 목차 이동 멈춤 안내가 띠 없으면 안 보임 | 낮음 | **다음 단계** — R3. [▶] 단추 모양으로는 알 수 있다. 짧은 알림을 둘지는 운영자 결정 |
| ③ | 한 쪽에 항목이 여럿이면 마지막이 "지금" | 낮음 | **그대로** — 깊은 항목이 더 구체적이다. 규칙을 spec (a)에 적는다. 폴백에서 어색하면 다음에 "쪽 안 위치"까지 보는 정도 |
| ④ | "p. Cover (PDF 1)" | 낮음 | **그대로** — §3 "라벨 글자는 그대로" 규칙이다. 앞부분 몇 줄뿐이다 |
| ⑤ | 412px 에서는 ① 이 적용 안 됨(Nour 기기) | 낮음 | **다음 단계** — 412 퀴즈 보임 제목 en·fr 45px(약 3–4글자), 0 은 아니다. 9절 실기기 6번에서 보고 문턱 420 여부를 운영자가 정한다(한 줄) |
| ⑥ | 스피쿠스 한글 목차 `lang=en` | 낮음 | **그대로** — 문서 언어 속성을 따르는 기존 규칙이다(책·언어별 튜닝 금지). 서재 [⋯] 로 바꿀 수 있다 |

## 8g4bR-10. 테스트의 힘 (내 변이 — 이번 변경 파일에만)

정확히 1회 일치할 때만 바꾸고 전체 테스트를 돌렸다(상한 300초). 그다음 `bak/` 사본을 읽어서 쓰기로 복원하고 `cmp` 로 확인했다. "빨강"은 IM2·IM3·IM6·IM7b(해시 표)를 뺀 것이다. M4·M8 은 첫 스크립트에서 일치가 3·0회라 건너뛰고 `mut2.mjs` 로 다시 했다.

| # | 변이 | 빨강 |
|---|---|---|
| M1 | 지금 항목: 같은 쪽이면 앞 항목(`>=` → `>`) | T2 지금 쪽 |
| M2 | 들여쓰기 상한 없앰 | T2 접기 |
| M3 | 목차 탭에서 타이핑해도 찾기 탭으로 안 감 | **없음(살아남음)** |
| M4 | 목차 이동 뒤 `pend.paused = false` | **없음(살아남음)** |
| M5 | F2 다시 cue 가 같은 뷰 다시 그리기에도 | T7 shouldRecue |
| M6 | F2 힌트 줄의 흐름 줄 확인 빼기 | T7 hintedAnchor |
| M7 | ① 문턱 400 → 300 | T7 ① |
| M8 | 앱만 R2 를 옛 뜻(`\p{L}`)으로 | S33c |
| M9 | 떠날 때 `S.tocToken++` 빼기 | **없음(살아남음)** |
| M10 | 못 읽음 판정을 `=== undefined` 로 | T1 · T3 |
| M11 | 목차 도착 뒤 첫 줄 cue 빼기 | T7 배선 |

→ 11개 중 8개 빨강이고 복원은 11/11 바이트가 같다. 살아남은 3개는 R5 에 적었다. M11·M7 은 소스 고정(정규식)으로만 잡힌다.

## 8g4bR-11. 전체 테스트 · stamp · 정리

- `node --test apps/medreader/tests/*.test.mjs` **1228/1228 × 2회**(시작 때 · 변이 뒤, fail 0 · cancelled 0, 각 약 8.6초). `stamp-importmap --check` 결과는 "그대로다(모듈 58개 · CSS 4개)", 종료 0. `git diff --check` 깨끗. `.nojekyll` 있음.
- 앱·테스트·spec 등 101개 파일의 sha256 이 시작과 같다(`sha-start.txt` 대조).
- 내가 띄운 Edge·node 는 모두 닫혔다. node 8개(47456·40228·48404·19520·48492·9980·40176·21516)와 msedge 46716 은 원래 있던 것이다. **8000번 python(PID 15088) 켜 둠**. 8123·8124·8125번 node 는 건드리지 않았다. 새 프로필은 `r8g4b/p1` 하나(412 MB)이고 `rm -rf` 금지라 남겼다. 실험 중 이 프로필의 Harrison·CMDT 2021 개요와 CMDT 2026 의 310·300쪽 판을 바꿨다가 모두 되돌렸다(37 · 26 · algoVersion 12 확인). `r8g4b/oldtree` 는 옛 `text/search.js` 를 import 하려고 만든 내 사본이라 남겼다.

## 8g4bR-12. 운영자 결정 필요 사항

1. **8g-4b 변경 커밋 승인**, 그리고 로컬 커밋 14개와 함께 **배포**(판정: 배포 가능).
2. **R1 키보드**를 배포 전에 고칠지(권장 — 화살표 키 또는 두 탭 Tab, 1–2줄 + 테스트), 아니면 배포 뒤 다음 단계로 둘지.
3. 다음 단계 묶음: R2(목차 이동 뒤 뷰 전환이 적중으로 되돌아감) · R3/② 멈춤 안내 · R4 접기 단추 이름 · R5 테스트 3개 · ① speaker `reload` · ⑤ 412px 문턱(실기기 9절 6번 뒤).
4. spec: Build 7절 제안 (a)(b)(c)를 넣을지(권장), §4-6 표 두 줄 정리.
5. 실기기 확인 목록(Build 9절 1–6)은 배포 뒤 운영자 몫으로 그대로 둔다.
