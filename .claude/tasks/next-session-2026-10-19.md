# 다음 세션 시작 메모 — 2026-10-19

> 2026-10-18 밤, 포크 세션("MedReader 다중 형식 지원 (fork)")에서 남김. 원 세션("MedReader 다중 형식 지원")은 그때 8g-1 Build 를 돌리던 중이었다.

## 0. 먼저 확인 (중복 실행 방지)
- **원 세션이 아직 작업 중이면 새 세션에서 같은 일을 시작하지 마라.** 같은 작업 트리에서 Build 두 개가 돌면 diff 가 섞인다(10-18 에 실제로 겹친 적 있음 — 포크가 8g-1·Nour Plan 복사본을 5분 돌렸다가 멈춤, 원 세션에 알림 보냄).
- `git status`·`git log --oneline -5` 로 상태 확인. 10-18 밤 기준: 마지막 커밋 `d568b8f`(푸시됨), 작업 트리에 **8g-1 Build 진행 중 변경**(js/text/screen.js·search.js, db.js, extract.js, main.js, i18n, settings.js, tests…) — 커밋 안 됨.
- `.claude/tasks/medreader-build-8g-1-report.md` 가 있으면 8g-1 Build 가 끝난 것. 없으면 덜 끝난 것.

## 1. MedReader 본 작업 (원 세션이 하던 것)
1. **8g-1 검색 데이터** — Build 결과 확인 → 별도 Review → 커밋 둘(① `text/screen.js` 옮김만 — 스크래치패드 `b8g1/step1/` 사본 ② 데이터) → 푸시(G1: 8g-1 단독 배포). 지침 `.claude/tasks/medreader-build-8g-1.md`, spec 17-8-12.
2. **8i-2c 테스트 보강**(지침 `.claude/tasks/medreader-build-8i-2c.md`) — 8g-1 이 끝난 뒤에(변이가 rowtable.js 를 잠깐 바꾼다).
3. **Nour 요청 Plan 결정 E1–E7**(spec 19-1-1, 보고 `.claude/tasks/medreader-plan-nour-1018-report.md`) — 운영자에게 보여 주고 승인받기. 권장: E1 목소리 기본값 "휴대폰 설정 따름 + 고르기 목록", E2 8j(홈 화면 설치)+8k-0 을 8g-1 확인 뒤 단독 배포, E3 아이콘 SVG+PNG, E4 언어 시험(17단계)은 별도 앱 후보로, E5 11b·11c 를 11a 앞으로, E6 일반 다열 표는 14단계 때 측정부터, E7 UpToDate 는 북마크 링크만.
4. 끝나면 인계 문서 `.claude/tasks/medreader-handoff.md` 에 10-18~19 를 덧붙인다.

## 2. 운영자 요청 3개 — 로드맵에 넣기 (Plan 필요, 아직 안 함)
운영자가 자기 영어 공부용 PDF 로 MedReader 를 쓰려다 막혔다.
- **O1 스캔본**: `G:\01_Language\01_English\grammar in use\Cambridge.Advanced.Grammar.in.Use.[2nd.edition.2005].pdf` — 307쪽, OmniPage Pro 15 산, **표본 11쪽 글자 0**, 쪽마다 스캔 이미지 1–2장, 본문 약 150 dpi. 원본 보기만 되고 낭독·번역 불가. → spec 17-5 결정((c) 감지·안내 먼저 → (a) 브라우저 OCR 을 문서 단위로)의 우선순위를 올릴지. (c) 감지·안내는 아주 작다(쪽마다 글자 0 + 이미지 ≥1).
- **O2 영한 혼합 PDF**: 원문 언어가 문서 속성 하나라 한글 부분도 영어 목소리로 읽는다 → 문장별 언어 판별 + 목소리 전환. 새 Plan 후보.
- **O3 목소리 고르기(미국/영국, 남/여)**: 지금 앱엔 목소리 고르는 화면이 **없다**(`tts.voice.*` 를 쓰는 UI 0, `pickVoice` 가 첫 기기 내장 음성 — 억양 임의). Nour Plan 의 **8k**(고르기 목록 + [들어 보기] + 휴대폰 설정 따름)에 합친다. 안드로이드는 성별을 휴대폰 TTS 설정에서 고른다(앱엔 언어 단위로만 보임), PC Edge 는 "Microsoft Guy(미국 남)"·"Ryan(영국 남)" 이 목록에 있다.
- 순서 제안: 위 1번(8g-1·E1–E7 승인) 뒤에 O1–O3 를 한 Plan 으로(지침 파일 만들어 Plan 서브에이전트). spec 은 한 세션만 고친다.

## 3. 운영자 PC 의 OCR 작업 (이 책을 지금 쓰기 위한 우회)
- 설치 완료(10-18): `py -m ocrmypdf` 17.13.0, Tesseract·Ghostscript(winget 은 전체 경로 `& "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe"` 로 설치).
- **시험 파일**: 운영자는 "만들었다"고 했지만 **예상 경로 `G:\01_Language\01_English\grammar in use\test-OCR.pdf` 에 없었다**(레포 루트에도 없음). → 어디에 저장됐는지 물어보거나 아래 명령을 다시:
  `py -m ocrmypdf -l eng --pages 40-45 --rotate-pages --deskew --oversample 300 --output-type pdf "<원본>" "G:\01_Language\01_English\grammar in use\test-OCR.pdf"`
- 확인 방법: pdf.js(이 기계 `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`, 5.6.205)로 40–45쪽 `getTextContent` 글자 수 + 표본 몇 줄의 인식 품질(원서 문장 40자 넘게 옮기지 말 것). 왼쪽 설명·오른쪽 연습 문제(빈칸) 판형이라 MedReader 줄 재구성 순서도 함께 볼 것.
- 괜찮으면 전체 변환: `py -m ocrmypdf -l eng --rotate-pages --deskew --oversample 300 --optimize 1 --output-type pdf --jobs 4 "<원본>" "<같은 폴더>\Cambridge.Advanced.Grammar.in.Use.[OCR].pdf"` → MedReader 에 넣어 낭독·번역(대상 한국어) 확인.

## 4. 기타
- `apps/medreader/` 와 `apps/medreader/dev/` 에 출처 모를 빈 `NVIDIA Corporation/` 폴더가 있다(Plan 이 발견, 손대지 않음).
- 사용자 기기: 운영자 Galaxy Z Fold 7, Nour Realme GT 7(점검표는 spec 19-1-1).

---
## 갱신 — 2026-10-18 밤 늦게 (원 세션에서)
- 포크는 멈춤(작업 트리 안 건드림). **원 세션도 이 시점에 멈춘다**(PC 끔).
- **8g-1 Build: 끝남.** 보고서 `.claude/tasks/medreader-build-8g-1-report.md` 있음. 작업 트리 점검 결과 포크와 섞인 변경 0, 세 권 측정·브라우저 DB 2→3·배너 통과, 1100/1100.
- **8g-1 Review: 돌던 중 PC 를 꺼서 중단됨.** 지침 `.claude/tasks/medreader-review-8g-1.md` 로 **처음부터 다시** 돌린다(Review 서브에이전트). review.md 끝에 "8g-1 Review" 절이 반쯤 써졌을 수 있다 — 있으면 지우지 말고 "중단됨" 표시 후 새 절로.
  - 스크래치패드 `r8g1/` 의 반쯤 된 결과·프로필은 무시. 변이가 걸린 채 멈췄을 수 있으니 **시작 전에 `git diff` 가 Build 보고서의 22개 파일과 같은지, 변이 표식(`MUT`·`/*V`) 0인지 확인**한다.
- Review 통과 뒤: 커밋 둘(① `b8g1/step1/` 옮김만 ② 데이터) → 8g-1 단독 푸시 → Nour 에게 "앱 완전히 닫았다 다시 열기" 안내(옛 탭엔 배너 없음).
- **E1–E7 은 이미 승인·커밋됨**(`165f2b9`) — 위 1-3 은 끝난 일.
- 3번 OCR: 운영자가 "시험 명령 다시 실행"을 골랐다(40–45쪽 → 같은 폴더 `test-OCR.pdf`). 1번 뒤에.
- 순서: 1(8g-1 Review → 커밋 → 푸시 → 8i-2c) → 3(OCR 시험) → 2(O1–O3 Plan).
- ⚠ 스크래치패드는 세션마다 경로가 다르다. 이번 세션 것: `C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/` — 단계 1 스냅숏은 그 아래 `b8g1/step1/`(sha256 `b8g1/step1-sha.txt`). 새 세션의 지침에는 이 **절대 경로**를 적어 줄 것. Temp 가 지워졌으면 단계 1 커밋은 `screen.js`·`reader.js`·`tts/text.js`·`split-contract-8a`·`index.html`(stamp)·`search-text-8g`(S3 둘만)로 다시 만들어야 한다 — 그때는 커밋 하나로 합쳐도 된다.
