# Review 지침 — 7b: 설정 AI 탭과 실제 호출

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고서를 믿지 말고 처음부터 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "7b" 절로 덧붙인다. **커밋하지 않는다.** 모든 산출물·보고는 **한국어**.

## 읽을 것

1. `apps/medreader/spec.md` — **16-D0**(합격 기준), 12-7, 8-2(`REGION` — 2026-10-03 사용자 결정 "방법 B"로 수정됨), 8-4, 13절(VPN 행 포함), 14-2
2. `.claude/tasks/medreader-build-7b.md`(Build 가 받은 지침)와 `medreader-build-7b-report.md`(Build 의 주장 — **검증 대상이지 근거가 아니다**)
3. `.claude/tasks/medreader-handoff.md` — "반드시 지킬 것", "3차 실기기 확인 — 이 라운드에서 배운 것"(캐시·`data-nav`·주 동작 위치)
4. 바뀐 코드: `git status`·`git diff` 로 범위를 직접 확인하라

## 검증 항목 — 각각 **어떻게 쟀는지**와 수치를 적는다

### A. 16-D0 의 `[N]`·`[D]` 항목 전부
`[사용자]`·`[M]` 두 항목은 실제 키가 필요하므로 "사용자 확인 대기"로 둔다. **실제 키를 어디에도 넣지 않는다.**

### B. 키 누출 — 가장 중요
- fetch 스텁으로 다섯 갈래(유효·무효·한도·지역 제한·확인 불가)를 각각 일으키고, 그때마다 **요청 URL·콘솔·DOM 전체 텍스트·`aria-*` 속성·토스트**에 가짜 키 문자열이 있는지 기계적으로 검사하라(눈으로 보지 말고 `document.body.outerHTML.includes(…)` 같은 검사).
- 모델 칸에 키를 붙여 넣는 경우(7a 에서 실제로 누출됐던 경로)를 다시 시험하라.
- "이 기기에 기억" 끔 → `sessionStorage` 에만, 켬 → `localStorage`, 다시 끔 → `localStorage` 에서 **지워지는가**.
- 가짜 키는 진짜 형식 문자열을 한 덩어리로 소스에 남기지 마라(GitHub 비밀 스캐너).

### C. 문구
- `REGION` 문구에 [키 설정] 유도가 **없는가**. 13절이 2026-10-03 에 정한 경계("키 문제가 아니다 / 네트워크 위치 때문일 수 있다"까지, **VPN 을 안내·권장하지 않는다**)와 네 언어 문구가 맞는가. 어긋나면 고쳐라(아래 "고쳐도 되는 것").
- 아랍어 문구가 실제 아랍어인가(자리표시·영어 그대로가 아닌가). 키 입력창 옆 환자 정보 경고가 아랍어 우선인가.

### D. 화면
- `preview_start {name:"blog"}` → `http://localhost:8000/apps/medreader/index.html#/settings/ai`. **캐시**: `python -m http.server` 는 `Cache-Control` 을 안 보낸다 — 바뀐 파일을 `fetch(url,{cache:'reload'})` 로 다시 받고 쿼리를 바꿔 navigate.
- 360×800·360×740, 영어·아랍어(RTL): 가로 스크롤 0, 버튼 48×48px 이상(**실측값을 표로**), 고정 고지가 보이는가.
- **리더의 속도 팝오버**에 [번역 설정]·모드 줄이 더해졌다. 360×740 에서 팝오버가 **화면 밖으로 잘리거나 상단바를 덮지 않는가**(인계 문서 이월 결함 3 — 팝오버 `max-block-size` 가 배너 높이를 빼지 않던 문제가 이번에 악화됐는가). 수치로.
- 설정 탭 ↔ 속도 팝오버의 번역 따라가기 값이 **양방향으로** 같은가.
- 동의 전에는 [검증]·[시험 번역]이 **네트워크 요청 0건**으로 동의 카드로 가는가.
- 버튼 동작이 `data-nav` 전역 위임과 JS `onclick` 으로 **섞여 있지 않은가**(grep 과 실제 클릭).
- 콘솔 에러·경고 0(정상·다섯 갈래·동의 전 흐름 모두).

### E. 테스트의 질
- `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(Build 주장 631).
- **변이 테스트를 네가 직접**: `verifyKey` 의 `canSave` 를 뒤집기, `REGION` 문구 선택을 `AUTH` 문구로 바꾸기, "기억 끔"에서 `localStorage` 삭제를 빼기 — 각각 빨개지는 테스트가 있는가. 원본은 스크래치패드에 복사해 두고 반드시 되돌려라(`git checkout` 으로 되돌리지 마라 — 커밋 안 된 변경이 있다).

## 고쳐도 되는 것

7b 가 만든 파일(`js/ui/settings.js`, `js/ui/notice.js`, `js/ai/provider.js`, `js/settings.js`, `js/ui/controls.js`, `js/main.js`, `index.html`, `css/screens.css`, `js/i18n/*.js`, `tests/settings-7b.test.mjs`) 안의 **결함 수정**만. 고친 것은 전부 review.md 에 "무엇이 틀렸고 어떻게 고쳤나"로.
**고치지 않는 것**: `gemini.js` `errorParser` 의 `REGION` 판정(사용자 결정), `spec.md`, `js/text/*`·`js/quiz/*`·`js/pdf/*`·`js/tts/*`. 범위 밖 결함은 기록만.

## review.md "7b" 절 형식

1. 결론 한 줄(통과 / 조건부 통과 / 불통과)
2. 16-D0 항목별 표(결과·확인 방법·수치)
3. 키 누출 검사 결과
4. 화면 실측 표(버튼 크기·팝오버 위치·가로 스크롤)
5. 변이 테스트 결과
6. 고친 것 / 범위 밖이라 기록만 한 것
7. 사용자 확인 대기 항목과 절차
