# Build 지침 — 8h-1 낭독 정리 (인용·글머리·각주 기호)

> 너는 **Build 서브에이전트**다. 운영자가 spec 6-6 의 권장안을 **전부 승인**했다(2026-10-11).
> **커밋하지 않는다.** 한국어로 쓴다. 끝나면 보고서를 `.claude/tasks/medreader-build-8h-1-report.md` 에 쓴다.
> 같은 시간에 다른 Build(8h-F)가 `apps/medreader/dev/tashkeel-*` 새 파일만 만든다 — 그 파일들은 건드리지 마라.

## 읽을 것
- `apps/medreader/spec.md` **6-6 전부**(6-6-2 A, 6-6-3 B, 6-6-4 C, 6-6-8 G 의 파일 목록·테스트·변이) — 이것이 설계 문서다. 6-1, 7-7, 7-8, 9-3 도 필요한 만큼.
- `.claude/tasks/medreader-plan-8h-report.md`
- `apps/medreader/dev/probe-citations-8h.mjs` — Plan 이 규칙을 흉내 낸 측정 스크립트. 앱 규칙을 만든 뒤 **같은 수치가 나오는지** 비교 기준으로 쓴다.
- `.claude/tasks/medreader-handoff.md` 끝부분(배포 안전장치·import map)

## 할 일 (범위 = spec 6-6-8 의 8h-1 행)
- A(A1 인용 단위 + A2 참고문헌 묶음, 닫힘 조건 필수), B(B1 글머리 앞 · B2 식별자 괄호 끝 뒤 경계, en dash 줄머리 제외), C(각주 기호 — 피연산자 사이만 `∗`→`*`, 나머지 소리에서 제거, 원문·번역문 발화 양쪽, **`src` 와 화면·캐시 키 불변**), 설정 `tts.readCitations`(기본 false, 켜도 원서 언어로만·번역 없음).
- 파일: 새 `js/text/cite.js`(순수 — `document`·`window` 0), `js/text/segment.js`, `js/tts/text.js`, `js/tts/speaker.js`(큐에서 거르기 — 구간 반복·쪽 넘김 로직은 손대지 않음), `js/config.js`, `js/settings.js`, `js/ui/settings.js`, `js/ui/controls.js`, `js/ui/reader.js`(`lineOrder` 노출만), `js/i18n/{ar,en,fr,ko}.js`, `index.html`(**import map 갱신만** — `node apps/medreader/dev/stamp-importmap.mjs`), 테스트 `tests/cite-8h.test.mjs` 등.
- 7c E1 테스트가 B 때문에 빨개지는 것은 예정된 일이다 — spec T-B4 대로 "바뀐 문장은 전부 B1·B2 경계를 품는다" 검사로 바꾼다(그냥 기대값만 덮어쓰지 않는다).
- `splitSentences` 호출은 여전히 `js/tts/text.js` 한 곳뿐이어야 한다.

## 반드시 지킬 것
- **여러 권·여러 언어 원칙**: CMDT 고유 관례(열 위치·글꼴·쪽 번호) 금지. 식별자 토큰·국제 인용 꼴·글리프·기호 앞뒤 글자만.
- **오탐(본문을 건너뜀) > 미탐** — 애매하면 읽는다. 모든 규칙에 닫힘 조건.
- `algoVersion`·`DB_VERSION`·프롬프트 버전 **불변**. `extract.js`·`layout.js`·`blocks.js` 수정 금지. `KEEP_HYPHEN_SUFFIXES` 손대지 않음.
- 픽스처는 지어낸 문장. 원서 문장 40자 초과로 옮기지 않는다. 진짜 API 키를 어디에도 쓰지 않는다(가짜 키가 필요하면 실행 중 조각을 이어 만든다).
- 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치, `.nojekyll` 삭제, 다운로드 폴더 나열.

## 검증 (보고서에 숫자로)
1. 전체 테스트(`node --test apps/medreader/tests/` 또는 기존 방식) 통과 수, 2회 이상.
2. spec 6-6-8 의 변이 m1~m8 — 각각 **적용됐는지 grep 으로 확인한 뒤** 빨개지는 테스트 이름 기록, 그다음 스크래치패드 복사본으로 복원하고 `cmp` 로 원본과 같음 확인.
3. 실제 책: 앱의 `buildUnits` 로(측정 공용 `dev/measure-lib.mjs` 의 `sentenceUnits` 경유) CMDT 2026 전권을 세어 Plan 스크립트 수치(A1 1,489 · A2 1,700묶음 · B 인용 조각 1,841)와 비교 — 차이가 1% 넘으면 원인. CMDT 2021·Harrison 도 같은 방식으로 수치만. PDF 경로(이것만 연다):
   `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`,
   `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`,
   `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`;
   pdf.js 는 `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.
   비교용 측정 스크립트가 필요하면 `apps/medreader/dev/` 에 새 파일로(기존 파일 수정 금지).
4. CMDT 2026 30쪽 단위 목록(40자 이하로): 표 머리 단위에 `∗` 발화 없음, 인용·PMID 단위가 `cite` 로 표시됨.
5. `node apps/medreader/dev/stamp-importmap.mjs` 실행 후 `tests/importmap.test.mjs` 통과.
6. 브라우저 확인은 Review 가 한다 — 너는 하지 않아도 된다.

## 보고서
바뀐 파일과 이유 · 판별 규칙 요약 · 테스트·변이 결과 · 세 권 수치 비교 · 의도와 다르게 한 곳 · 남은 위험.
