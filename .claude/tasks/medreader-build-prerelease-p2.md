# Build 지침 — 공개 전 묶음 P2: CMDT 2026 러닝 헤드(쪽 머리말) 낭독

> 너는 **Build 서브에이전트(P2)**다. **커밋하지 않는다.** 한국어로 쓴다.
> 동시에 Build P1 이 `db.js`·`extract.js`·`reader.js`·`library.js`·`render.js`·`original.js`·`redact.js`·`provider.js`·`settings.js`·`config.js` 의 `ORIGINAL`/`REDACT_PATTERNS` 블록을 고친다. **너는 그것들을 건드리지 마라.** 너의 범위는 `js/text/*`(4절)·`algoVersion`·`config.js` 의 `LAYOUT` 블록·관련 테스트.
> 끝나면 보고서 `.claude/tasks/medreader-build-prerelease-p2-report.md`.

## 문제
7c Review(2026-10-10) 실측: **CMDT 2026 표본 200쪽 중 196쪽에서 쪽 머리말(러닝 헤드)이 낭독 문단에 남는다.** Nour 의 주 교재다 — 쪽마다 같은 머리말을 소리로 듣는다. Harrison 에서는 머리말이 잘 걸러졌다(그래서 지금까지 몰랐다).

## 읽을 것
- spec **4-7**(역할 판정: `header` = 상단 8% · 80자 이하 · fontSize ≤ 1.1×Fm · 이웃 쪽 반복 …), 4-11(수용 기준), 2-4(`BOOK_PROFILE` — 책마다 다르다는 전제), 18 해당 행
- `.claude/tasks/medreader-handoff.md` — "알려진 함정", "교훈: 합성 픽스처는 코드의 가정대로 만들어진다", 2026-09-27(CMDT 거터 결함 — **한 책만 보고는 안 보였다**), 2026-10-10 "본문 속 숫자"(3열 사이드바 — **14단계로 미룸, 이번에 고치지 마라**)
- 코드: `js/text/blocks.js`(`classifyRoles`)·`layout.js`·`lines.js`, `tests/review6.test.mjs` 의 V9(algoVersion 고정)

## 할 일
1. **먼저 잰다**(추측으로 고치지 마라): `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`, `apps/medreader/dev/measure-lib.mjs`. CMDT 2026 의 머리말 줄이 4-7 의 어느 조건에서 떨어지는가(위치 비율·길이·글자 크기·이웃 반복 — 각각 통과/실패 수). 머리말 문자열을 review/보고서에 옮기지 마라(40자 이하 진단 조각만, 원서 문장 금지). 진단 스크립트는 `apps/medreader/dev/` 에 남겨라(재사용).
   PDF(이 셋만 — **다운로드 폴더 목록을 띄우지 마라**): `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`.
2. **고친다** — 특정 책 튜닝이 아니라 **일반화되는 규칙**으로(인계 문서 원칙: 책마다 스스로 맞추는 설계). 상수는 `LAYOUT` 에.
3. **퇴보 검사 — 세 책 모두**: 머리말 판정 전후로 (a) 머리말이 낭독에서 빠진 쪽 수, (b) **본문 줄이 잘못 머리말로 빠진 수**(가장 중요 — 본문을 잃으면 안 된다), (c) 2단 판정·문단 수·문항/정답 수(퀴즈 파서 입력이 바뀌는가), (d) Harrison 의 기존 지표(인계 문서 수치)가 나빠지지 않았는가. 표로.
4. **`algoVersion` 9 → 10**, `tests/review6.test.mjs` V9 를 같이 고친다(그 테스트가 요구한다). 재추출이 일어난다는 것을 보고서에 명시.
5. 3열 사이드바 숫자(CMDT 앞부분 20쪽)는 **고치지 마라** — 14단계. 이번 변경이 그 증상을 바꾸면 보고만.

## 반드시 지킬 것
- 순수 계층(`text/*`)은 브라우저 API 를 모른다 — 16-A 검사는 **주석까지** grep 한다.
- `KEEP_HYPHEN_*` 는 사용자가 채운 값 — 건드리지 않는다.
- 픽스처 문장은 **지어낸다**(원서 문장 금지). 레포에 PDF 를 넣지 않는다.
- 측정 스크립트는 레포의 js/ 를 그대로 읽는다 — P1 이 동시에 다른 파일을 고치지만 `text/*` 는 안 건드리니 영향 없다. 그래도 측정 수치가 이상하게 흔들리면 재측정.

## 검증
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 882 — P1 이 동시에 테스트를 더한다. 실패가 P1 파일이면 보고만). 3번 이상.
2. 새 테스트: 머리말 판정(지어낸 좌표 픽스처) + **본문이 머리말로 빠지지 않는** 반례.
3. 변이: 새 규칙의 핵심 조건 하나씩 빼기 → 빨개지는가. 적용 grep 확인 후, 스크래치패드 복사본으로 복원·cmp(`git checkout`·`restore`·`stash` 금지).
4. 마지막 응답: 원인(어느 조건에서 떨어졌나), 고친 규칙, 세 책 퇴보 표 요약, algoVersion, 테스트 수, 변이를 12줄 이내로.
