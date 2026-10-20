# Build 보고서 — 8g-4b-R1: 키보드로 목차 탭에 갈 수 없는 문제

> 지침 `.claude/tasks/medreader-build-8g-4b-r1.md`. 시작 `2ce489e`(작업 트리 깨끗 · 전체 1228/1228). **커밋하지 않음.**
> 스크래치패드 `b8g4br1/`(백업 `bak/`, 변이 `mut.mjs`·`mut.json`, headless `lib.mjs`·`setup.mjs`·`run.mjs`·`run-*.json`, 전체 `full-1.tap`·`full-2.tap`).

## 1. 고친 방법

`apps/medreader/js/ui/search.js` (탭 키보드 처리만, +41줄)
- **420행 `tabKeyTarget(ev, i, n, rtl)`** — 새 순수 함수(1절 순수 부분, `tocRows` 다음). 이 키로 갈 탭 순번, 탭 키가 아니면 `-1`.
  - `→`/`←` 는 **시각적** 방향: LTR 은 → +1 · ← −1, **RTL 은 뒤집어** ← +1 · → −1(아랍어에서 찾기 탭이 오른쪽, 목차 탭이 왼쪽이므로 ← 가 목차로).
  - 끝에서 **넘어감**(마지막 → 처음, 처음 → 마지막 — WAI-ARIA APG 권장). `Home` 처음 · `End` 마지막.
  - Alt·Ctrl·Meta 를 누른 채면 `-1`(Alt+← 브라우저 뒤로 등을 가로채지 않음). Shift 는 막지 않음. 탭 0개면 `-1`, 순번 밖은 끝에 붙임.
- **573행** `els.tabs.addEventListener('keydown', onTabsKey)` — 기존 `if (els.tabs && els.toc)` 안(누름 배선 옆).
- **763행 `onTabsKey(ev)`** — `tocAllowed()` 아니면 아무것도 안 함 → `order=[찾기, 목차]` 에서 `ev.target` 순번 → 방향은 **탭 목록의 계산된 `direction`**(실패하면 `getDir()`) → `tabKeyTarget` → `-1` 이면 기본 동작 그대로 → 아니면 `preventDefault` → **초점 먼저 → `setTab`**(자동 선택. 누름과 같은 순서라 목차 탭의 "지금 항목으로 굴림"이 누름과 똑같이 동작).
- 고른 탭만 `tabindex=0`(`paintTabs`)은 그대로.

`apps/medreader/index.html` — 마크업 변경 없음. ARIA 는 이미 맞음(`role="tablist"` · 두 `role="tab"` 에 `aria-selected` · `aria-controls`(searchResults / searchToc) · 목차 탭 `tabindex="-1"` · 두 판 `role="tabpanel"` + `aria-labelledby`). **stamp 만 다시**(search.js `?v=c7349d1cb5 → b108d26af2`), `--check` 0.

## 2. 테스트 — `tests/search-tabs-8g4br1.test.mjs` (새 6개)

| | 내용 |
|---|---|
| K1 | LTR 표: → · ← · Home · End · 끝에서 넘어감(탭 2·3개) / 탭 키 아닌 것(Tab·Enter·Space·↑·↓·글자·Esc·PageDown·빈 키)은 -1 |
| K2 | RTL 표: ← 다음 · → 앞 · 넘어감 · Home/End 그대로 + "RTL → == LTR ←" |
| K3 | Alt/Ctrl/Meta → -1 · Shift 는 통과 · null · 탭 0/1개 · 순번 밖 · 문자열 수 |
| K4 | 배선: keydown 등록(탭 있을 때만) · `tocAllowed` 가드 · DOM 순서 · 계산된 방향 + `getDir` 폴백 · `if (j < 0) return` · preventDefault → 초점 → setTab 순서 · paintTabs 의 tabindex/aria-selected |
| K5 | 마크업: tablist · tab(aria-selected · aria-controls · 안 고른 탭 tabindex=-1) · tabpanel(aria-labelledby) |

## 3. 변이 (`mut.json`) — 11개 전부 빨강, 매번 복원(읽어서 쓰기) 확인, 끝에 `cmp` 일치

| 변이 | 빨강(실패 수) |
|---|---|
| M1 keydown 배선 없앰(= 고치기 전) | 1 |
| M2 RTL → 안 뒤집음 | 1 |
| M3 RTL ← 안 뒤집음 | 1 |
| M4 끝에서 안 넘어감 | 3 |
| M5 End 가 처음 | 3 |
| M6 Home 없음 | 2 |
| M7 수식 키 무시 안 함 | 1 |
| M8 preventDefault 없음 | 1 |
| M9 계산된 방향 안 봄 | 1 |
| M10 선택 안 함(초점만) | 1 |
| M11 다른 키도 preventDefault | 1 |

## 4. headless (Edge · 새 프로필 `b8g4br1/p1` · 412×915 · 흉내 음성 · 진짜 키 없음 · PDF 는 CURRENT 2026 하나 — 추출 49초 1967/1967)

CURRENT 2026 쪽 120 → [🔍] → 검색 화면(이 책 범위).

| 확인 | ko (`run-kbd-ko.json`) | ar (`run-kbd-ar.json`) |
|---|---|---|
| 입력 칸에서 Tab → searchClear → searchGo → **searchTabFind** | ✔ | ✔ |
| 화살표로 목차 탭(ko →, ar ←): 초점 목차 탭 · aria-selected · tabindex 0/-1 · 목차 판 보임(61항목) · 결과 숨김 | ✔ | ✔ |
| 그 상태에서 Tab → 목차 항목(`toc-row`) · Shift+Tab → 목차 탭 | ✔ | ✔ |
| 반대 화살표로 다시 찾기(목차 숨김 · 결과 보임 · tabindex 0/-1) | ✔ | ✔ |
| End → 목차 · Home → 찾기 · 넘어감(찾기에서 반대 화살표 → 목차 → 다시 찾기) | ✔ | ✔ |
| Alt+← 는 손대지 않음(선택·초점 그대로 · defaultPrevented=false) | ✔ | ✔ |
| 방향: html/탭 목록 `dir` · 목차 탭 x | ltr · 목차 x=210 > 찾기 x=16 | **rtl · 목차 x=16 < 찾기 x=210**(목차가 시각적 왼쪽) |

- 터치(`run-touch.json`): `tap` 목차 → 찾기, `click` 목차 → 찾기 — 4개 모두 선택·판·tabindex 그대로 ✔.
- 8i-3 회귀(`run-turn.json`, 리플로우 쪽 30 → 36, 빠른 흉내 음성): 168 발화 · 쪽 30–36 · **같은 문장 연달아 0** · 끊김 1(마지막 ⏸) ✔(Review 기록과 같은 수).
- 콘솔 오류는 매번 기존 404 하나뿐(이전 Review 와 같음). 바깥 요청은 pdf.js CDN 둘(기존).

## 5. 전체 테스트

`node --test apps/medreader/tests/*.test.mjs` 2회 — **1234/1234**, 1234/1234(1228 + 새 6). stamp `--check` 0.

## 6. 정리

- 띄운 Edge 는 매 스크립트 `finally` 에서 닫음. 끝난 뒤 프로세스 목록이 시작 때(`procs-before.txt`)와 같음: node 8개(같은 PID — 8123·8124·8125 포함, 건드리지 않음) · msedge 46716(시작 전부터 있던 것) · python 15088(8000번, 켜 둠).
- 수정 파일: `js/ui/search.js`, `index.html`(stamp 한 줄), 새 `tests/search-tabs-8g4br1.test.mjs`. spec·review·`.nojekyll` 손대지 않음.

## 7. 남은 문제

- **(작음 · 범위 밖, 고치지 않음)** 목차 탭으로 옮기면 8g-4b 의 "지금 항목으로 굴림" 때문에 페이지가 굴러(쪽 120 → scrollY 424) **초점이 간 목차 탭이 화면 위로 벗어난다**(탭 top −285). 누름(클릭)도 똑같다(`probe-focusview.json` — 키·클릭 같은 값). Tab 한 번이면 목차 항목으로 가고 그 항목은 보이므로 막히지는 않지만, 키보드 사용자에게 초점이 잠깐 안 보인다(WCAG 2.4.11 쪽). 고친다면 탭 목록을 sticky 로 두거나 키로 옮길 때만 굴림을 줄이는 방법 — 운영자 판단.
- 탭이 둘이라 끝에서 넘어가는 규칙 때문에 ar 에서 → 도 결국 목차로 간다. RTL 뒤집힘 자체는 headless 로 구분되지 않으므로 K2 표와 변이 M2·M3·M9 로 고정했다.
