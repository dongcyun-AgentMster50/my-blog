# Build 지침 — 8h-F 발음 기호(타슈킬) A/B 시험 페이지

> 너는 **Build 서브에이전트**다. 운영자가 spec 6-6-7 권장안을 승인했다(2026-10-11).
> **커밋하지 않는다.** 한국어로 쓴다. 끝나면 보고서를 `.claude/tasks/medreader-build-8h-F-report.md` 에 쓴다.
> **새 파일 세 개만** 만든다: `apps/medreader/dev/tashkeel-ab.html`, `apps/medreader/dev/tashkeel-ab.data.js`, `apps/medreader/dev/tashkeel-make.mjs`.
> 같은 시간에 다른 Build(8h-1)가 `apps/medreader/js/`·`index.html`·`tests/` 를 고친다 — 그 밖의 파일은 절대 건드리지 마라.

## 읽을 것
- `apps/medreader/spec.md` **6-6-7**(페이지·문장 출처·생성 방법·Nour 질문·결과 복사·키 안전) — 설계 문서다.
- `apps/medreader/dev/voices.html`(같은 방식의 진단 페이지 — 아랍어 음성 고르기, "목록에 없음 ≠ 말할 수 없음", 결과 복사·clipboard 실패 처리)
- `apps/medreader/js/ai/prompts.js`(번역 지시문 — **바꾸지 않고 import 해서 쓴다**), `js/ai/adapters/gemini.js`·`js/config.js`(`DEFAULT_MODEL`, `KEY_SHAPES`, `assertNoKeyInUrl` 위치 확인)

## 만들 것
1. **`tashkeel-make.mjs`** (운영자가 자기 PC 에서 한 번 돌림. Node 18+ 내장 `fetch`):
   - 키는 환경 변수 `GEMINI_API_KEY` 로만 받는다. 요청 헤더 `x-goog-api-key` 로만 보낸다. URL 에 키가 들어가면 즉시 중단(앱의 `assertNoKeyInUrl`/`KEY_SHAPES` 를 import 해서 쓰거나 같은 검사). 키·응답 헤더를 출력·파일에 남기지 않는다.
   - 입력: 스크립트 안의 **직접 쓴 영어 의학 문장 8개**(각 120자 안팎, 원서 문장 금지). 류마티스 중심(예: 메토트렉세이트·하이드록시클로로퀸·전신홍반루푸스·강직척추염·항CCP 항체 등) + 부갑상선·고주파 절제 등. 약 이름·질환명·검사명이 고루 들어가게.
   - ① = 앱과 같은 번역 지시문(`prompts.js`)·앱 기본 모델로 아랍어 번역. ② = ①의 글자를 그대로 두고 **부호 전부**. ③ = ①을 그대로 두고 **발음이 갈리는 낱말·의학 용어에만** 부호.
   - 검증: `stripTashkeel(②) === ①`, `stripTashkeel(③) === ①` (U+064B–U+065F, U+0670 제거). 어긋나면 1회 재시도, 그래도 어긋나면 그 문장은 빼고 보고.
   - `countTokens` 호출로 ①②③ 토큰 수를 재서 함께 기록.
   - 출력: `tashkeel-ab.data.js` 를 덮어쓴다(문장·①②③·토큰 수·모델 이름·생성 날짜만).
   - `--dry` 옵션: 네트워크 없이 가짜 데이터로 파일 모양만 만든다(테스트용).
2. **`tashkeel-ab.data.js`**: 처음에는 `--dry` 로 만든 **자리표시 데이터**(아랍어 문장 칸은 "생성 전" 표시). 운영자가 키로 돌리면 실제 데이터로 바뀐다. 페이지는 데이터가 자리표시면 "아직 준비 중" 안내를 띄운다.
3. **`tashkeel-ab.html`** — spec 6-6-7 그대로: 외부 요청 0·저장 0·키 0, 아랍어 UI(RTL) 먼저 + 작은 영어 보조, 문장마다 세 판을 섞어 `١ ٢ ٣` 으로만(섞은 순서는 결과에 기록), 화면엔 부호 없는 글 한 줄만, 속도 0.75(기본)/1.0, 판마다 [▶], 질문 1(어느 판 — ١/٢/٣/다 같다/다 틀렸다)·질문 2(틀린 낱말 칩 표시/해제)·끝에 질문 3(예/아니요/차이가 크면), [결과 복사](음성 이름·속도 포함, clipboard 실패 시 선택). 모바일 360px 가로 스크롤 0, 버튼 48px. 외부 라이브러리·CDN 없이.

## 금지
커밋, 다른 파일 수정, `git checkout/restore/stash`, `rm -rf`, npm 설치, 진짜 API 키를 어디에도 쓰는 것(이번에 실제 생성은 하지 않는다 — 운영자가 한다), 원서 문장 사용.

## 검증 (보고서에)
- `node apps/medreader/dev/tashkeel-make.mjs --dry` 로 data 파일 생성 성공.
- `stripTashkeel` 단위 확인(부호 붙인 예 → 원문).
- 키 검사: 가짜 키(실행 중 조각을 이어 만든 값)를 URL 에 넣는 경로에서 중단되는지 작은 확인.
- 브라우저(내장 브라우저 또는 로컬 정적 서버)에서 페이지 열어 콘솔 오류 0, 360px 가로 스크롤 0, 버튼 눌러 결과 복사 문자열 모양 확인. 서버를 띄웠으면 끝나고 정리.
- 보고서: 만든 파일 · 8개 영어 문장 목록 · 운영자가 돌릴 명령(키는 `<키>` 로 표기) · 남은 위험.
