# Build 보고 — 8i-2b D10 구멍 막기 + 테스트 보강 (2026-10-18)

> 지침: `.claude/tasks/medreader-build-8i-2b.md`. 커밋하지 않았다. `spec.md`·`review.md`·`config.js` 는 건드리지 않았다.
> 바꾼 파일: `apps/medreader/js/text/rowtable.js`, `apps/medreader/tests/rowtable-8i2.test.mjs`, `apps/medreader/index.html`(stamp 로만).
> 스크립트·로그·백업: 스크래치패드 `b8i2b/`. 원서 인용 없음(픽스처는 모두 지어낸 낱말).

## 1. 결론

- D10 구멍을 막았다. R 표(쪽 번호 열)에서 물려받은 띠는 그 띠에 쪽 번호가 하나도 없어도 2열 경로를 타지 않는다. `REQUIRE_REF` 가 false 든 true 든 같다.
- **세 권 실물 출력은 바뀌지 않았다.** b37c21f 대비 다른 쪽 **0**(CMDT 2026 1,967 · CMDT 2021 5,051 · Harrison 729). 이웃 저장본을 넘긴 21–38쪽 2회차 저장본도 다른 쪽 0. `algoVersion` 은 12 그대로다.
- 덤으로 확인한 것: 되돌림 스위치 `REQUIRE_REF:true` 의 지금 코드 출력이 8i 코드(246e392)와 **세 권 전 쪽에서 바이트가 같다**(다른 쪽 0). 이제 "되돌림 = 8i 그대로"를 구조로 보장한다.
- 새 테스트는 6개다. 전체 테스트는 1069/1069(= 1063 + 6)이고 두 번 돌렸다.
- Review 의 변이 V3·V4·V5·V6 은 이제 모두 빨강이다. D10 을 되돌리는 변이 5개도 모두 빨강이다.
- V2 와 D10f 는 **같은 동작을 내는 변이**라 어떤 입력으로도 빨갛게 만들 수 없다. 근거는 3절에 적었다.

## 2. D10 고친 방법 (`rowtable.js`)

**원인(Review 8i2R-6 B).** 2열 규칙의 갈림이 `!det.R.length`("R 열 조각이 비었나")였다. 그런데 `inheritFrom` 은 물려받은 띠에 조각이 없는 R 열을 걸러 낸다. 그래서 R 표 자식 띠에 쪽 번호가 없으면 `det.R = []` 가 되고, 그 띠가 2열 규칙을 탔다. `REQUIRE_REF` 는 보지 않았다.

**고친 방법.**
- `judge` 가 R 없이 잡은 표(2열 표)의 판정 결과에 `two: true` 를 단다.
  - `REQUIRE_REF:true` 면 R 없는 표는 그 앞의 `noRef` 에서 이미 떨어진다. 그래서 이 표시는 생기지 않는다.
- `inheritFrom` 은 **부모의 표시**로 경로를 정하고, 2열 부모의 자식에게만 `two: true` 를 물려준다.
  - R 표 부모의 자식에게는 표시가 없다. 그 띠의 쪽 번호 수와는 상관없다.
  - `splitStraddling`·R6b 가 `det` 를 다시 만들 때는 `Object.assign` 이라 표시가 그대로 남는다.
- 새 함수 `isTwo(det, R) = !!(det && det.two) && !R.REQUIRE_REF`. `!det.R.length` 로 가르던 곳 9곳을 모두 이 함수로 바꿨다.
  - `rowsOf` R5b
  - `inheritFrom` 통로 좁히기와 (f) 재검사
  - `emitBand` 역할 유지
  - `isRefTable`
  - R1c 의 `ends` 와 `par`
  - R7 의 R1d
  - R2b 호출
  - R6b 호출
- 남은 `det.R.length` 는 `emitBand` 의 쪽 번호 줄 배정 루프 하나다. 이것은 규칙의 갈림이 아니다.
- 새 설정 키는 없다. 진단(`tables`)에도 필드를 더하지 않았다. 진단은 저장·출력에 들어가지 않지만, 그래도 그대로 두었다.
- 머리 주석에 D10 의 갈림 방식을 적었다.

**합성 재현**(Review `r8i2/repro.mjs` B, 그대로 다시 돌림). 아래 띠에 쪽 번호가 없을 때:
- 고치기 전: `REQUIRE_REF` true·false 둘 다 "구획 줄 body · HEAD 와 바이트 다름"
- 고친 뒤: 둘 다 "구획 줄 heading · **HEAD(8i) 와 바이트 같음**"

## 3. 새 테스트 (`tests/rowtable-8i2.test.mjs`, +6)

8i R 표 픽스처 함수 `rowTable` 에 두 가지를 더했다. 기존 RT30 의 출력은 바뀌지 않는다.
- `{ line }`: 임의의 한 줄(캡션)
- 칸 옵션 `split`: 그 줄을 run 둘로(틈 12pt)

| 테스트 | 무엇 | 잡는 변이 |
|---|---|---|
| **RT30b** ★ | Review 픽스처 B 모양이다. R 표 → 넓은 장 제목 → 쪽 번호 없는 물려받은 띠(구획 줄 + 둘째 이름표 줄이 둘째 P 칸 첫 줄과 같은 높이인 행). 아래 띠는 혼자서는 R3 를 못 넘는다. `REQUIRE_REF` false·true 각각에서 넷을 본다: 구획 줄 heading · 이름표를 R5b 로 쪼개지 않음 · 아래 띠 줄의 [role col 칸+행]이 **8i(246e392) 코드로 뽑은 값**과 같음 · 두 설정의 JSON 바이트 동일 | D10a–e |
| **RT30c** | R 표의 P 줄 일부가 run 둘이다(비율 ≥ HIDDEN_COL — 전제로 잰다). 그래도 8i 처럼 R 표로 잡히고 두 설정의 바이트가 같다 | V4 |
| **RT30d** | R 표 띠 안에 figure-caption 줄이 있다(7단계 캡션 — 전제로 잰다). 8i 에서는 띠 안 구획 줄이고, 두 설정의 바이트가 같다 | V6 |
| **RT30e** | 위 셋을 한 쪽에 모은다(R 표 + run 둘 + 띠 안 캡션 + 쪽 번호 없는 물려받은 띠). 두 설정의 바이트가 같고, 아래 띠 구획 줄은 heading, 이름표는 쪼개지 않는다 | V4·V6·D10a–e |
| **RT23b** | RT23 머리 줄 위에 이름표 열도 구획도 아닌 홀로 선 짧은 조각을 둔다(오른쪽 끝). 맨 윗 P 줄을 열 머리로 접지 않는다 | V5 |
| **RT28b** | 이름표 아이템이 P 시작(160)을 지나 176 에서 끝나고, 다음 아이템이 178 에서 시작하는 한 run 이다. 자르지 않는다(두 아이템이 한 줄 · 글자 다중 집합 동일) | V3 |

RT23b·RT28b 픽스처는 RT31(되돌림 스위치 → 7b 없을 때와 바이트 동일) 목록에도 넣었다.

**RT30b 의 8i 기준값.** 테스트는 옛 코드를 불러올 수 없다. 그래서 8i 코드(`r8i2/old`, 246e392)로 아래 띠 줄 13개의 `role col 칸+행` 을 뽑아 상수로 넣었다(`D10_8I`).
- 전체 JSON 은 스크래치에서 8i 와 바이트 비교해 같음을 확인했다(`b8i2b/fx.mjs` 의 `D10none`·`ALL`: TWO=8i·REF=8i 모두 true).
- 처음에는 "쪽 번호가 있는 같은 띠"와 비교하는 관계도 넣으려 했다. 그러나 그 꼴에서는 쪽 번호와 P 줄이 같은 높이에서 한 run 으로 붙는다(8i 도 같다). 그래서 뺐다.

## 4. 변이 (`b8i2b/mut.mjs`·`muts.mjs` → `mut.txt`)

방식은 Review 와 같다. 레포 `rowtable.js` 를 정확히 1곳 바꾼다 → 전체 테스트(`--test-timeout=60000`, 실행 상한 300초) → 백업 `b8i2b/bak/rowtable.js.fixed` 로 복원 → `cmp`. 11개 모두 복원 `cmp` 가 같았고, 끝에도 `cmp` 가 같았다. 해시 테스트 IM2·IM6·IM7b 는 `rowtable.js` 가 바뀌면 늘 빨강이라 표에서 뺐다.

| # | 변이 | 빨개진 테스트 |
|---|---|---|
| V2 | 역할 유지에서 figure-caption 안 지킴 | **없음 — 같은 동작을 내는 변이** (아래) |
| V3 | R2b "앞 아이템이 P 시작 전에 끝남" 끔 | RT28b |
| V4 | (f) 숨은 열 가드를 R 표에도 | RT30c · RT30e |
| V5 | R6b "P 줄 위 이름표 열·구획 밖 조각" 검사 끔 | RT23b |
| V6 | R1b 캡션 끊기를 R 표 띠에도 | RT30d · RT30e |
| D10a | `isTwo` 를 8i-2 그대로(`!det.R.length`) — b37c21f 와 같은 동작 | RT30b · RT30e |
| D10b | `isTwo` = R 열 조각 없음 + 스위치(표시 안 봄) | RT30b · RT30e |
| D10c | R 표 자식에게 자기 R 열로 `two` 를 닮(`two: !Rs.length`) | RT30b · RT30e |
| D10d | `emitBand` 만 `!det.R.length` | RT30b · RT30e |
| D10e | `rowsOf` R5b 만 `!det.R.length` | RT30b · RT30e |
| D10f | `isTwo` 가 스위치를 안 봄(표시만) | **없음 — 같은 동작을 내는 변이** (아래) |

**같은 동작을 내는 변이 두 개.**
- **V2.** figure-caption 줄은 2열 표 띠에 들어갈 수 없다. 2열 경로는 `!REQUIRE_REF` 에서만 열리고, 그때는 모든 띠 만들기가 캡션 조각에서 끊긴다.
  - 1차 띠의 R1b 재분할, R1c 의 `bandsOf(…capBreak)`, R1d 의 나머지 띠가 모두 그렇다.
  - 캡션을 품은 띠는 R 표 띠뿐인데, R 표 띠는 2열 경로가 아니다.
  - 그래서 `keepRole` 의 figure-caption 가지에는 닿을 수 없다.
  - 확인: 캡션 꼴 줄을 이름표·설명·구획 자리에 무작위로 넣은 2열 표 600쪽(`b8i2b/fuzzv2.mjs`). 행 표 303쪽 중 figure-caption 줄이 있는 쪽 270, 표 안 figure-caption 줄 0, 지금 코드 대 V2 다름 **0**.
  - 그 가지는 방어 코드로 남겨 두었다. 지울지는 운영자 판단이다(지워도 출력은 같다).
- **D10f.** `det.two` 는 `judge` 가 `!REQUIRE_REF` 일 때만 단다. `REQUIRE_REF:true` 면 R 없는 표는 `noRef` 로 먼저 떨어진다. 물려받기는 부모의 표시를 따른다. 그래서 `&& !R.REQUIRE_REF` 는 지금은 겹치는 방어다. 지침("표시와 `REQUIRE_REF` 를 함께 본다")대로 남겼다.

## 5. 실물 불변 (`b8i2b/full.mjs` — Review `r8i2/full.mjs` 방식)

- pdf.js: 8i-2 Build·Review 와 같은 `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist` **5.6.205**. 설치·다운로드는 하지 않았다.
- 비교 기준: `git archive b37c21f apps/medreader/js` 를 `b8i2b/base` 에 풀었다(체크아웃 없음). 8i 는 Review 가 풀어 둔 `r8i2/old`(246e392)를 썼다.
- 측정한 `rowtable.js` 는 지금 파일과 md5 가 같다(`a086a4b0…`).

| 책 | 쪽 | 지금 대 b37c21f (기본 설정) | 지금+`REQUIRE_REF:true` 대 8i | rt 있는 쪽 · rt 줄 | 이웃 2회차 21–38 | 시간 |
|---|---|---|---|---|---|---|
| CMDT 2026 | 1,967 | 다른 쪽 **0** | **0** | 33 · 1,904 | 18쪽 다름 **0** (rt 줄 1,280) | 48초 |
| CMDT 2021 | 5,051 | **0** | **0** | 0 · 0 | — | 47초 |
| Harrison | 729 | **0** | **0** | 3 · 78 | — | 13초 |

CMDT 2026 의 rt 33쪽은 2열 15쪽에 21–38쪽 18쪽을 더한 것이다. Harrison 3쪽은 75·412·542 다. 모두 Review 와 같다.

## 6. 실행·정리

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(실행 상한 600초): **2회 모두 1069/1069**, fail 0(`b8i2b/test-1.txt`·`test-2.txt`).
- `node apps/medreader/dev/stamp-importmap.mjs` 로 `apps/medreader/index.html` 해시 1곳을 갱신했다. `--check` → "그대로다 (모듈 53개 · CSS 4개)", 종료 0.
- 백업: `b8i2b/bak/` 에 `rowtable.js.orig`·`rowtable-8i2.test.mjs.orig`·`rowtable.js.fixed` 가 있다. 루트 `index.html.orig` 는 쓸 일이 없었고, 루트 `index.html` 은 건드리지 않았다.
- 변이 탐색은 스크래치 사본 `b8i2b/mutjs/<id>` 에서 먼저 했다(레포 무관). 그다음 레포 파일 변이는 위 4절 방식으로 했다.
- 남은 프로세스: 내가 띄운 것은 없다. 끝 `tasklist` 결과는 node 1개(PID 13884, Adobe Creative Cloud — 내 것 아님), msedge 0, python 0이다.
  - Review 가 켜 둔 :8000 서버(PID 26920)는 지금 떠 있지 않다.
- 스크래치 `b8i2b/` 는 15 MB, C: 여유 159 GB.
- 권한·훅에 막힌 명령은 없다. 커밋, checkout/restore/stash, `rm -rf`, npm 설치·다운로드, 브라우저 실행은 하지 않았다.
- `git status` 에 내 것이 아닌 새 파일 `apps/medreader/dev/measure-search-8g.mjs` 가 보인다. 동시에 일하는 Plan 쪽 파일로 보이며, 건드리지 않았다.

## 7. spec 에 넣을 문안 (Plan 이 spec 4-13-10 D10 에 반영할 때)

> D10 갈림: 2열 규칙(R1b·R1c·R1d·R2b·R3 (f) 재검사·R5b·R6b·역할 유지·좁힌 통로)은 "그 띠가 2열 경로인가"로 연다. 2열 경로 = R3 가 쪽 번호 열 없이 잡은 표(`REQUIRE_REF:false` 일 때만 생김), 그리고 그런 표에서 R1c·R7 로 물려받은 띠다. **R 표에서 물려받은 띠는 그 띠에 쪽 번호가 하나도 없어도 R 표 경로다.** "R 열 조각이 비었나"로 가르지 않는다. `REQUIRE_REF:true` 면 2열 경로는 없다 — 세 권 전 쪽이 8i(246e392)와 바이트가 같다(8i-2b 측정).

## 8. 남은 문제

1. (기록) V2·D10f 는 같은 동작을 내는 변이라 테스트로 지킬 수 없다(4절). `keepRole` 의 figure-caption 가지는 지금 닿을 수 없는 방어 코드다.
2. (Review 8i2R-9 2번, 이번 범위 밖) R6b 열 머리 오판(머리 행 없는 2열 표의 첫 행 이름표가 두 줄 이상일 때)은 그대로다. 다음 Plan 의 일이다.
3. 세 권에서 이번 수정이 걸리는 곳은 0이다. 실물로는 D10 이 고쳐진 것을 볼 수 없고, 합성(RT30b·RT30e)으로만 확인된다.
