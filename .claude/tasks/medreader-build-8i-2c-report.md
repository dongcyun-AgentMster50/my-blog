# 8i-2c Build 보고 — `two` 표시 옮기기 세 곳 테스트 보강 (2026-10-19)

> 지침 `.claude/tasks/medreader-build-8i-2c.md`. 앱 코드는 고치지 않았다. 바꾼 레포 파일은 `apps/medreader/tests/rowtable-8i2.test.mjs` 하나다(+90 −1). 커밋하지 않았다. 스크래치 `b8i2c/`(3.9 MB)만 썼다.

## 1. 새 픽스처 (지어낸 낱말, 원서 문장 없음)

공통 줄 두 개를 더했다. 넓은 줄 `WIDE33` 은 0.55W 를 넘고 A 통로에서 시작하므로 띠 경계가 된다. 구획 줄 `SEC33` 은 통로를 덮지만 0.55W 보다 짧아 띠 안에 남고, 7단계 역할은 body 다. 세 테스트는 먼저 "그 단계가 실제로 돌았다"는 전제를 단언하고, 그다음 띠 안 구획 줄이 2열 경로 역할인 **body**(R 표 경로였다면 heading)인지 본다.

| 테스트 | 픽스처 | 지키는 것 | 전제 단언 |
|---|---|---|---|
| **RT33** (M1) | `f33`: 2열 표 → 넓은 줄 → 물려받은 띠(행 + 구획 줄 + 행)<br>`f33b`: 같은 꼴, 물려받은 띠 첫 행이 두 줄 이름표(둘째 줄 = 행 시작 높이) | R7 `inheritFrom` 의 2열 가지가 자식 det 에 `two` 를 준다. 그래서 구획 줄이 body 다. R5b 도 돈다: rowhead 는 `Trasse quilar Vendo`·`Oskat` 이고, 다음 행 이름표가 앞 행에 붙지 않는다. | 진단 `tables` 에 1차 띠와 물려받은 띠가 둘 다 있다. 넓은 줄은 표 밖이다. 구획 줄의 7단계 역할은 body 다. |
| **RT34** (M2) | `f34`: RT28 꼴(붙은 run)에 행 셋을 더했다(띠 줄 25개). 붙은 행 바로 아래에 구획 줄을 둔다. | R2b 뒤에 다시 만든 det 에도 `two` 가 남는다. 그래서 구획 줄이 body 다. 아이템 다중 집합은 7b 없을 때와 같다. | 7b 없을 때 이름표와 설명 첫 줄이 한 run 이다. 2열 판에서는 `JOINED` 가 A 칸 줄로 쪼개진다. rowhead 는 8개다. |
| **RT35** (M3) | `f35`: RT23 꼴(머리A·머리P 줄)의 행 사이에 구획 줄을 넣었다. | R6b 뒤에 다시 만든 det 에도 `two` 가 남는다. 그래서 구획 줄이 body 다. | 진단에 `head2` 가 있다. `Description` 줄이 colhead 다. rowhead 4개. |

- 행을 늘린 이유(RT34): RT28 의 띠는 줄이 20개라 통로를 덮어도 되는 조각이 ⌊0.08×20⌋ = 1개다. 붙은 run 이 이미 그 하나를 쓴다. 그래서 구획 줄을 더하면 통로가 사라지고 표가 잡히지 않는다. 행 셋을 더하면 줄이 25개가 되어 2개까지 허용된다.
- 네 픽스처(`f33`·`f33b`·`f34`·`f35`)를 **RT31 되돌림 스위치 목록**에도 넣었다. 이제 `REQUIRE_REF:true` 에서 7b 없을 때와 바이트가 같은지도 본다. 결과는 통과다.
- 도우미 `tablesOf(items)` 를 더했다. `rowTableProbe` 의 `tables` 진단을 모으는 함수다.

## 2. 변이 (레포 `js/text/rowtable.js`, 백업 `b8i2c/bak/rowtable.js.orig`, 스크립트 `b8i2c/mut.mjs`)

변이 문자열은 Review `r8i2b/mut.mjs` 의 M1–M3 와 같다. 하나씩 걸고, 전체 테스트(`--test-timeout=60000`, 실행 상한 300초)를 돌린 뒤, `finally` 에서 백업으로 복원하고 바이트를 비교했다.

| 변이 | 결과 | 빨개진 테스트(해시 IM2·IM6·IM7b 제외) | 복원 |
|---|---|---|---|
| M1 `inheritFrom` 2열 가지에서 `two: true` 뺌 | 1099 pass · fail 4 | **RT33** | 같음 |
| M2 R2b `Object.assign` 에 `two: false` | 1099 pass · fail 4 | **RT34** | 같음 |
| M3 R6b `Object.assign` 에 `two: false` | 1099 pass · fail 4 | **RT35** | 같음 |

- fail 4 의 나머지 셋은 늘 빨간 importmap 해시 테스트(IM2·IM6·IM7b)다. rowtable.js 바이트가 바뀌어서 생긴다.
- 변이 하나에 새 테스트 하나씩, 정확히 대응한다.
- 끝에 `cmp bak/rowtable.js.orig js/text/rowtable.js` → **같음**. `index.html` 도 백업과 `cmp` 같다.
- 탐침(`b8i2c/probe*.mjs`)은 스크래치 사본 `b8i2c/mut/M1–M3/js`(각 약 1.3 MB)에서 돌렸다. 그 결과로 픽스처마다 그 변이에서만 바이트가 달라지는 것을 먼저 확인했다.
  - RT33 꼴은 M1 에서만 다르다.
  - RT34 꼴은 M2 에서만 다르다.
  - RT35 꼴은 M3 에서만 다르다.

## 3. 실행

- `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초) 2회: **1103/1103** 통과, fail 0, cancelled 0(6.7초·6.6초). 기존 1100개에 3개가 더해졌다.
- `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 55개 · CSS 4개)", 종료 0.
- `git status`: 레포 변경은 `tests/rowtable-8i2.test.mjs` 하나다(+ 이 보고서).

## 4. 남은 문제 · 메모

- 발견 1: 행만 늘린 RT28(구획 줄 없음)에서도 M2 는 Vendo 행 설명을 문단 둘로 쪼갠다(P 칸 `k` 0 → 1). 기존 RT28 은 `pLinesByHead` 가 `k` 를 보지 않아서 이것을 놓쳤다. 지금은 RT34 가 M2 를 잡으므로 따로 단언하지 않았다.
- 실행 사고 1건(피해 없음)
  - 편집 명령을 `python - <<EOF … || node -e …` 꼴로 잘못 써서, python 이 stdin 을 기다리며 멈췄다.
  - 백그라운드 작업을 멈추고, 내가 띄운 `python.exe -`(PID 46652, 명령줄로 확인)를 종료했다.
  - 그러자 `||` 뒤 node 편집이 한 번 실행됐다. 바뀐 내용은 의도한 두 곳뿐이다: 머리 주석 한 줄과 RT31 목록. 찾는 문자열이 정확히 1번 나올 때만 바꾸도록 짠 편집이다.
- 권한·훅에 막힌 명령은 없다. checkout/restore/stash, `rm -rf`, npm 설치·다운로드, 커밋은 하지 않았다.
- 남은 프로세스
  - 내가 띄운 것은 모두 끝났다.
  - node 는 Adobe(PID 43840)뿐이고 내 것이 아니다.
  - msedgewebview2 12개도 앱 호스트라 내 것이 아니다.
  - python 은 0개다.
