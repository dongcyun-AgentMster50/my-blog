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
