# Build 지침 — 성장 빙고

## 너의 역할

이 프로젝트의 **Build 단계** 담당이다. 승인된 설계 문서대로 웹앱 "성장 빙고"를 구현한다.

## 먼저 읽을 것 (경로는 저장소 루트 기준)

1. `apps/growth-bingo/spec.md` — **사용자가 승인한 설계 문서. 이것이 유일한 진실이다.** 처음부터 끝까지 읽어라.
2. `CLAUDE.md` — 프로젝트 규칙.
3. `apps/2048/` — 같은 프로젝트의 앞선 앱. 코드 모양과 주석 수준 참고용.

특히 그대로 따라야 하는 절: **2절(규칙)**, **3-2절(49칸 표)**, **11절(파일 구조)**, **12절(`rules.js` API와 `canClaim` 검사 순서)**, **15절 A(테스트 시나리오)**, **16절(구현 순서와 함정)**.

## 수정 허용 범위 — 엄격히 지킬 것

**`apps/growth-bingo/` 안에서, spec 11절에 적힌 파일만 만든다.**

```
apps/growth-bingo/index.html
apps/growth-bingo/style.css
apps/growth-bingo/print.html
apps/growth-bingo/print.css
apps/growth-bingo/js/board-data.js
apps/growth-bingo/js/rules.js
apps/growth-bingo/js/guide.js
apps/growth-bingo/js/store.js
apps/growth-bingo/js/family-gate.js
apps/growth-bingo/js/app.js
apps/growth-bingo/js/print.js
apps/growth-bingo/tests/rules.test.js
apps/growth-bingo/tests/balance.test.js
```

**하지 말 것:**

- 블로그 본체(`index.html`, `post.html`, `css/`, `js/`, `posts/`, `vendor/`)와 다른 앱 폴더 수정 금지. 읽기만 한다.
- `apps/growth-bingo/spec.md` 수정 금지. `review.md` 생성 금지(Review 담당의 몫이다).
- `CLAUDE.md`, `.claude/`, `.gitignore`, `.nojekyll` 수정 금지.
- git 커밋·푸시 금지.
- 임시 파일은 저장소 밖(`/tmp`)에만 만든다.
- 셸에서 `rm -r`, `find -delete`, `sudo` 형태는 훅이 차단하니 쓰지 마라.

끝나면 `git status --short`로 위 파일 외에 바뀐 것이 없는지 확인하라.

## 순서

spec 16절의 권장 순서를 따른다. 요점만 다시 적는다.

1. `board-data.js` — 3-2절 표를 그대로 옮긴다. 제목·기준·네모 수·인증 방법을 임의로 바꾸지 마라.
2. `tests/balance.test.js` — spec 3-4절과 15절 A-1의 숫자가 재현되는지 먼저 확인한다. **숫자가 다르면 표를 잘못 옮긴 것이니 여기서 멈추고 고친다.**
3. `rules.js` + `tests/rules.test.js` — 화면 없이 15절 A의 시나리오를 전부 통과시킨다.
4. `guide.js` → `store.js` → `family-gate.js` → `app.js`와 화면 → 날짜 갱신 → `print.html` → 임베드·다크 모드·접근성.

## 반드시 지킬 구현 사항

설계 문서에 다 있지만 틀리기 쉬운 것을 다시 강조한다.

1. **순수 함수 파일의 경계** — `board-data.js`, `rules.js`, `guide.js`는 DOM, `localStorage`, `Date.now()`, `Math.random()`을 쓰지 않는다. Node에서 `require`로 읽혀야 한다.
2. **클래식 스크립트** — ES 모듈을 쓰지 않는다. 전역은 `window.GrowthBingo` 하나.
3. **무엇을 세는가** — spec 2-5절 표대로. 하루 상한·간격 규칙은 확인 대기 + 확정을 세고, 칸 완성·줄 완성·빙고 수·레벨 열림은 **확정만** 센다.
4. **칸 id를 규칙 코드에 박지 않는다** — 규칙은 칸의 속성만 본다. 판 데이터를 갈아 끼울 수 있어야 한다.
5. **`confirm()`·`alert()`·`prompt()` 금지** — 블로그 메인에 iframe으로 들어간다. 확인 절차는 화면 안 대화 상자로 만든다.
6. **저장 실패를 알린다** — `window.localStorage` 프로퍼티 접근 자체를 `try/catch`로 감싸고, 저장이 안 되는 환경이면 화면에 알린다.
7. **날짜** — 기기 로컬 날짜의 연·월·일로 일차를 계산한다. 밀리초 차이를 24시간으로 나누지 마라.
8. **의존성 0** — CDN을 포함해 외부 라이브러리·폰트를 쓰지 않는다.
9. **휴대폰 폭 360px에서 7×7 판이 가로 스크롤 없이 보여야 한다.** 칸에는 축약 이름을 쓰고 눌러서 상세를 연다.
10. **가족 확인 경계** — 가족 확인은 `family-gate.js` 뒤에 숨긴다. `app.js`가 비밀번호 방식에 직접 의존하지 않게 한다(다른 앱으로 옮길 때 이 파일만 갈아 끼운다).

## 스스로 검증할 것

Review 단계에 미루지 말고 직접 확인하라.

- `node apps/growth-bingo/tests/balance.test.js`와 `node apps/growth-bingo/tests/rules.test.js`가 통과한다. 실제 출력을 보고에 붙인다.
- 브라우저로 실제로 열어 본다. Chromium과 Playwright가 설치되어 있다(`require('playwright')`, `chromium.launch()`에 옵션 불필요, 새로 설치하지 마라). 저장소 루트에서 `python3 -m http.server`로 띄운 뒤 다음을 확인한다.
  - 폭 360px과 1280px에서 콘솔 오류 없이 열린다.
  - 첫 실행 → 칸 눌러 "했어요" → 가족 도장 → 스티커 확정 → 새로고침 후 유지.
  - 하루 상한에 닿으면 더 못 누르고 사유가 보인다.
  - `?embed=1`과 `print.html`이 열린다.
- 확인용 스크립트와 스크린샷은 `/tmp`에만 둔다.

## 코드 품질

- 한국어 주석. **왜 그렇게 했는지**를 적고, 코드가 자명한 곳에는 달지 않는다.
- 설계 문서가 정한 파일·함수 이름과 사유 코드를 그대로 쓴다.
- 화면 문구는 사용자가 가족에게 보여 줄 말이다. 개발 용어를 쓰지 않는다.

## 막히면

설계 문서끼리 충돌하거나 설계대로 하면 동작하지 않는 부분을 발견하면 **임의로 크게 바꾸지 말고**, 가장 작은 수정으로 진행한 뒤 무엇을 왜 바꿨는지 보고에 적어라. 판의 칸 내용·네모 수·위치는 어떤 경우에도 바꾸지 마라.

## 완료 후 보고

1. 만든 파일과 줄 수
2. 두 테스트의 실제 실행 결과 (통과 수, 실패가 있으면 그대로)
3. 브라우저 확인에서 실제로 해 본 것과 못 해 본 것
4. 설계 문서와 다르게 구현한 부분과 이유
5. 구현하지 못했거나 미완성인 부분 (숨기지 말 것)
6. Review 단계에서 특히 봐야 할 부분
