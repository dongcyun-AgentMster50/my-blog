# Build 지침 — 8g-7 아랍어 진료과 이름으로 장 찾기 (Nour R1)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **19-1-4** 전부, 특히 **2-4 "8g-7 설계 뼈대"** 표(새 파일·화면 자리·켜지는 조건·DB/버전·i18n·수용 기준) + 결정 **N-D1 (다)** 내장 진료과·장기계 사전 · **N-D2 (가)** «ابحث» 맨 위 "장" 묶음 + 목차 탭 항목 옆 흐린 아랍어 이름 · **N-D3 (가)** 지금 단독(8e 앞). 운영자 승인 2026-10-27. 8d 배포됨(`c6a2d5d`), Plan 커밋 `c6352a4`.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g7-report.md`.

## 읽을 것
spec 19-1-4 전부, 17-8(검색 — 특히 17-8-6 폴백 목록, 17-8-9 아랍어 검색어, 17-8-12), 8p `domain`(19-1-3 §7). **사전 원본**: Plan 보고서 `.claude/tasks/medreader-plan-nour-1026-report.md` §3(54 표제어·별칭·정규화 규칙·합성 질의 31개·측정 방법) — 스크래치 `pn26/` 은 임시이니 보고서 표를 원본으로. 코드: `js/ui/search.js`(결과 묶음·`scriptHint`·`tocJump`·목차 탭), `js/text/search.js`, `tocOf`·폴백 목록, `js/i18n/*`.

## 할 일
1. `js/text/specialty.js`(순수): 데이터 + `conceptsOfQuery(q)`·`conceptsOfTitle(title, lang)`·`foldArabic`(낱말 단위 + 가장 긴 별칭 우선 — Plan 규칙). **책 고유 값 없음**(메모리 규칙: 책·언어별 튜닝 금지 — 제목 쪽 일치 낱말은 언어별 일반 의학 어휘). Plan 이 못 찾은 형용사꼴(تنفسية·قلبية 류)은 일반 규칙(어미 정규화 등)으로 잡을 수 있으면 잡되, 오탐을 측정으로 확인. 질환 이름(الربو 등)은 범위 밖 그대로.
2. 화면(설계 뼈대 그대로): (1) 결과 맨 위 "장" 묶음 — 누르면 `tocJump`, 머리에 "사전으로 찾음" 한 줄(무엇에 대응했는지) (2) 목차 탭 항목 옆 흐린 아랍어 이름(UI 언어 ≠ 책 언어일 때만) (3) `scriptHint` 에 [«الفهرس» 로] 단추 + **언어 이름을 UI 언어로**(지금 «…بلغة English» 처럼 영어로 나오는 것 고침).
3. 켜지는 조건: 검색어 글자 체계 ≠ 책 언어(`scriptMismatch`)일 때만 — **라틴 검색어의 결과는 8g 와 바이트까지 같다**. `domain === 'general'` 이면 끔. 개요 없는 책은 폴백 목록과 맞댐.
4. i18n ×4(아랍어·프랑스어 `[검토 — Nour·운영자]`), 사전의 아랍어·프랑스어·한국어 별칭도 `[검토 — Nour·운영자]` 표시(주석 한 줄).
5. 테스트: 설계 뼈대의 `[N]` 전부(사전 무결성·의도된 공유 목록·정규화 표 31개+형용사꼴·합성 개요 픽스처 — 실물 제목은 테스트에 넣지 않음·라틴 검색어 결과 JSON 이 HEAD 와 같음·`general` 이면 묶음 없음).
6. stamp 다시, `--check` 0.
7. spec 은 19-1-4 2-4 안에 `[정정 2026-10-27 — 8g-7 Build]` 줄만(설계에서 바꾼 것). 크게 바꿔야 하면 멈추고 보고.

## 검증
- **실측**: 의학책 3권 개요로 덮음·틀린 장 0 재확인(Plan 104/105), 합성 질의 31개 + 네가 만든 형용사꼴 결과, 라틴 검색어 표본(각 책 20개 이상)으로 결과가 HEAD(`c6352a4`)와 같은지.
- **headless Edge**(412×915 · 360×740 · 아랍어 UI · 새 프로필 · 가짜 키): «الأمراض الصدرية» → 첫 줄이 Pulmonary 장 → 누르면 그 장 첫 쪽, "장" 묶음 줄 ≥ 48px, 가로 스크롤 0, 제목 `dir=ltr`, [«الفهرس» 로] 단추, 목차 탭 흐린 이름. 회귀: 영어 검색·제목 묶음·결과 이동 뒤 [▶](8g), 목차 탭, 8d 블록, 띠. 콘솔 오류 0. 스크린숏 2–3장 `b8g7/shots/`.
- 8000번 python(PID 30352)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 새 프로필 3개까지, 프로필 복사 금지. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
- 변이 3개 이상(조건 지우기 → 라틴 결과 바뀜, 가장 긴 별칭 우선 끄기, `general` 조건 지우기 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8g7/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1360 + 새).
- **모든 실행에 시간 상한**(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리. C: 남은 공간이 5GB 아래면 멈추고 보고.

## 수정 범위
`js/text/specialty.js`(새), `js/ui/search.js`(묶음·목차 탭 이름·`scriptHint`), 필요하면 `js/text/search.js` 의 공개 함수 하나(결과 JSON 불변), `js/i18n/*`, `css/*`, `index.html`(stamp), `tests/`, `spec.md`(19-1-4 안 정정 줄), 스크래치패드 `b8g7/`, 보고서. DB 버전·algoVersion·`SEARCH.VERSION`·`OUTLINE_V`·캐시 키·`PROMPT_VERSION` 불변. review.md 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
