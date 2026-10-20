# Build 지침 — 8l 스캔본·글자 깨짐 감지와 안내

> 너는 **Build 서브에이전트**다. 운영자가 8l 을 진행하기로 했다(2026-10-20). 승인된 설계: spec **17-5-1**(O1 Plan — 승인 2026-10-19 O-D1–O-D3) + **19-1-3 §3**(`garbled` 갈래 — 승인 L-D5·L-D10). 8g 검색·8j 는 배포됨(`a4c8cfe`).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8l-report.md`.

## 읽을 것
- spec **17-5-1 전체**(1 실측, 2 감지 규칙 `text/scan.js` — 10–90% 구간 12쪽 표본·75% 글자 0 이면 2쪽만 이미지 연산 확인 → `scan`/`notext`/`text`, 저장 `documents.scan` + `SCAN_FIELDS`, 3 안내 세 자리 + **▶ 를 눌렀을 때**(지금은 빈 쪽을 최대 20쪽 말없이 넘긴 뒤 멈춤 → 스캔본이면 넘기지 않고 안내), 검색 안내, 네 언어 문구, 4 PC OCR 은 앱엔 한 문장, 6 8l 수용 기준·크기)
- spec **19-1-3 §3**(`garbled`: 같은 12쪽 표본에서 FFFD·PUA·제어 문자 비율 ≥ 5%·표본 글자 ≥ 500 → `garbled`, 띄어진 글자 비율은 쓰지 않음, 안내 키 3개·네 언어 문안, `garbleCount` 테스트 꼴, L-D10 ▶ 막지 않음)
- **`.claude/tasks/medreader-8l-carryover.md`** — 세 번째 꼴 "그리기 명령은 있는데 추출 글자 0"(Harry Potter 2, Acrobat Distiller 5.0.5): 지금 규칙으로는 이미지 0 이라 **`notext`** 로 판정될 것 — Build 첫 단계에서 실물로 확인하고, 그 꼴이면 `documents.scan` 에 텍스트 연산 수(예: `textOps`)를 함께 저장해 **가이드가 `--force-ocr` 를 안내할 근거**로 남긴다(앱 문구는 spec 그대로 — 새 키 금지). spec 에는 17-5-1 안에 정정 줄로.
- 측정 도구: `apps/medreader/dev/measure-scan-o1.mjs`(O1 Plan 시제품 — 규칙의 기준), 조사 원자료 스크래치패드 `survey/results.jsonl`.
- 코드: `js/ui/library.js`(`attach` 다음에 판정), `js/db.js`(`patch`·`documents`), `js/ui/reader.js`·`js/ui/controls.js`·`js/tts/speaker.js`(빈 쪽 넘김 `MAX_EMPTY_PAGES`), `js/ui/search.js`(검색 안내 — 8g-4), `js/i18n/*`, `index.html`, `css/*`.

## 할 일
1. `js/text/scan.js`(새, 순수): spec 의 표본 고르기·`garbleCount`·판정. 순수 함수는 쪽 글자 수·이미지 수·텍스트 연산 수 등 **숫자만** 받는다(pdf.js 호출은 서비스 쪽).
2. 서비스(spec 이 정한 자리 — `ui/library.js` `attach` 다음): 문서마다 한 번, `SCAN.VERSION` 경첩, `db.patch` 로 자기 필드만. 실패해도 앱에 영향 0(조용히, 다음에 다시).
3. 안내 세 자리(서재 배지 · 리더 상단 띠 문서당 한 번 + [원본 보기] + `noticed` · 검색 안내) — `scan`/`notext` 와 `garbled` 각각 spec 문구. **▶ 동작**: `scan`/`notext` 면 빈 쪽을 넘기지 않고 `reader.scan.noRead` 안내, `garbled` 는 막지 않음(L-D10).
4. i18n 네 언어(spec 문안 그대로 — 아랍어·프랑스어 문안은 spec 에 있는 것).
5. 테스트: spec 수용 기준(17-5-1 §6 · 19-1-3 §3 테스트 꼴) + 표본 고르기·판정 표·`garbleCount` 경계·저장(자기 필드만)·▶ 갈래.
6. **실물 판정**(Node, 앱 모듈 + pdf.js 5.6.205): 세 의학책 → `text` · 운영자 스캔본 원본 2개 이상(Advanced Grammar 원본, 롱맨 1권 — `G:/01_Language/01_English/` **읽기만**) → `scan` · 스피쿠스 원본 unit 2개 → `garbled` · Harry Potter 2 원본 → (예상) `notext` + 텍스트 연산 > 0 · OCR 결과(`D:/OCR/01_English/` 의 ` [OCR].pdf` 몇 권 — 읽기만) → `text`. 조사 원자료(`survey/results.jsonl`)와 판정이 어긋나면 표로.
7. `node apps/medreader/dev/stamp-importmap.mjs`, `--check` 0.

## 검증
- 변이(판정 문턱·표본 구간·`garbled` 비율·▶ 갈래·자기 필드만 쓰기 등) 4개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8l/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1244 + 새).
- **headless Edge**(412×915 · ko·ar): 스캔본 원본을 넣어 서재 배지·리더 띠·[원본 보기]·▶ 안내(쪽이 넘어가지 않음)·검색 안내, 스피쿠스 unit 하나로 `garbled` 배지·띠·▶ 는 막지 않음, 의학책 하나는 아무 안내 없음(회귀), 8i-3 쪽 넘김 낭독 한 번. 8000번 python(PID 15088)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 2개까지. 진짜 API 키 금지.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`js/text/scan.js`(새), `js/ui/library.js`, `js/ui/reader.js`·`js/ui/controls.js`·`js/tts/speaker.js`(▶ 갈래만 — 최소), `js/ui/search.js`(안내 한 줄), `js/db.js`(필요하면 `SCAN_FIELDS` 류 최소), `js/config.js`(`SCAN` 상수), `js/i18n/*`, `index.html`(stamp·띠 자리), `css/*`(배지·띠), `tests/`, `spec.md`(17-5-1·19-1-3 §3 안 정정 줄만), 스크래치패드 `b8l/`, 보고서. DB 버전·algoVersion 은 올리지 않는다(spec: `documents` 필드 — DB 버전 무관). review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
