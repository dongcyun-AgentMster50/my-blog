# Build 보고서 — 9c-3 "PDF 필요" 상태 · 같은 PDF 재사용 경로 (spec 17-4-1)

> Build 서브에이전트 · 2026-11-17 · 직전 배포 9c-2 `c8a797b` 위. **커밋하지 않음.** 운영자 위임 — 권장안 그대로(9c-D9 (가)).
> 호출 0 · `db.js`·`pipeline.js`·`text/backup.js`·`dev/`·review.md 무변 · DB 3·`algoVersion`·캐시 키·`PROMPT_VERSION` 무변 · `dev/measure-table-8i4.mjs` 손대지 않음.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/library.js` (+266) | 순수 `hashMayMatch`·`needPdfMatch`(identityFor 와 같은 판단 — 해시 그대로 또는 **그 쪽수의** 변형 키 + `reuse`) · `ensureBlob`(재사용 경로 — 한 readwrite 트랜잭션에서 `count` → 없고 문서가 있으면 `put`) · `attachBlobFor`(카드 [PDF 가져오기] — 한 트랜잭션에서 문서 다시 읽기 → 원본 + `lastOpenedAt`·모르던 `pageCount` 만) · `hasPdf`(키 개수만) · `goNeedPdf`(서재로 — 히스토리 바꿔 쓰기, 주소가 그사이 바뀌었으면 안 감, 그 카드 단추 초점) · "PDF 필요" 카드(`needPdfCard` — 배지·메타·안내·알림 `role=status`·[PDF 가져오기]·[삭제]·[⋯], 진행 줄·[계속] 없음) · 카드 전용 감춘 input(JS 생성) · `importFile` 재사용 **두 갈래**(같은 해시·변형 키)에 `ensureBlob` · 스캔 배지 칠하기가 PDF 필요 카드를 건드리지 않게 |
| `js/ui/reader.js` (+3) | `showReader` — 원본 없으면 `goNeedPdf` |
| `js/ui/search.js` (+5) | 이 책 범위 `showSearch` — 원본 없으면 `goNeedPdf` · 서재 범위 [이어서 준비] — 원본 없으면 서재 그 카드로(히스토리에 쌓음 — 뒤로 = 결과) |
| `js/ui/quiz.js` (+4) | `showQuiz` — 원본 없으면 `goNeedPdf`(토큰 확인) |
| `css/screens.css` (+19) | `.doc-need-hint`·`.doc-need-msg`(주의 토큰)·배지 굵기 |
| i18n ko·en·fr·ar (각 +6) | `library.needPdf`·`.hint`·`.import`·`.wrong`·`.opened` + `backup.import.quota`(9c2R #4). ar·fr `[검토 — Nour·운영자]` |
| `js/backup/import.js` (+~110, 9c2R 만) | `unionSetting`(의료 사이트·최근 검색어 합집합) · `settingTypeOk`(`defaults` 를 화면이 넘김) · `cleanRecord` 에 문서 미래 시각 자르기·`lastPage`/`pageCount` 꼴·term 없는 항목 거절·설정 꼴 · `plainStep` 이 설정 병합 전에 합집합 |
| `js/ui/backup.js` (+7, 9c2R 만) | `defaults: settings.DEFAULTS` 넘김 · 다시 불러오기 전 [내보내기]·캐시 체크 꺼짐 · `quota` 문구 · 이름 없는 "개수 다름" 줄 생략 · gzip 꼬리만 잘림(`broken && ended`)이면 손상 줄 생략 |
| `index.html` | stamp 만(모듈 79·CSS 4) |
| `tests/needpdf-9c3.test.mjs` **새** | N1–N5 |
| `tests/backup-import-9c.test.mjs` | I16(9c2R #6 — R2·R3·R5) · I17(#2 합집합) · I18(#3 타입·범위) |
| `spec.md` | 17-4-1 "9c-2 수용 기준" 의 "p.3·같은 줄" → "p.3(줄 이어 읽기는 리더 기능 밖 — 9c2R-9)" · `[정정 2026-11-17 — 9c-3 Build]` 한 줄(9c-2 Build 정정 다음) |
| `.claude/tasks/medreader-crossstep-notes.md` | 다듬기 후보에 `lastLineId` 한 줄 덧붙임 |

설계 표의 "library.js +60" 보다 크다(+266) — 판정·트랜잭션 도우미를 순수·주입 가능하게 떼고 주석을 단 몫.

## 2. 수용 기준 (17-4-1 "9c-3")

| 기준 | 결과 | 근거 |
|---|---|---|
| `[D]` blob 없는 카드: 배지 "PDF 필요"·[PDF 가져오기], [계속] 없음 | ✔ | `b1` card0: `needPdf` · 배지 "PDF 필요" · 단추 `need-pdf,delete,more` · 진행 줄 없음 |
| `[D]` 맞는 PDF → 추출 시작·리더 열림 | ✔ | `b1` → `#/reader/<A id>/3` · 추출 끝 · 원본 10,431B · **앱 새로 불러온 뒤에도** 보통 카드([계속]) |
| `[D]` 다른 PDF → 한 줄 안내·문서 무변 | ✔ | `b1` wrong: 카드 알림 "이 책의 PDF 가 아닙니다(다른 판일 수 있습니다)…" · 문서 JSON 같음 · 문서 1·원본 0·쪽 0 · 초점 단추 그대로 · `#/library` 머묾 |
| `[D]` 서재 [가져오기]로 같은 PDF → blob·이어짐 | ✔ | `r1`: 같은 id 재사용 · 원본 10,431B · 새로 불러온 뒤 보통 카드 · 3쪽 POST 0 · 한 번 더 넣어도 원본 1·문서 1 (9c-2 남은 2 고침) |
| `[D]` 검색·퀴즈·리더 주소 → 서재 그 카드 초점(빈 리더 0) | ✔ | `e1`: 리더·검색(이 책)·퀴즈·부팅 첫 주소가 리더·서재 범위 검색 [이어서 준비] 다섯 모두 `#/library`·화면 library 만·초점 = 그 카드 [PDF 가져오기]·화면 안·알림(`aria-live=polite`)·리더 줄 0 · 리더 주소는 히스토리 바꿔 씀(+1 = 주소를 바꾼 그 한 번) → 뒤로 = 서재(리더로 다시 튕기지 않음) · [이어서 준비] 뒤로 = `#/search` |
| 변이: 재사용 경로 blob 검사 지우기 → 빨강 | ✔ | M1: N5 빨강 + headless `r-M1` 원본 0·새로 불러온 뒤 "PDF 필요"·리더 못 엶 |
| 공통 — innerHTML 0·콘솔 오류 0·stamp·무료 티어 숫자 0 | ✔ | 변경분 `innerHTML` 0 · 모든 headless console 0·pageerror 0 · `--check` "그대로다(79·4)" · 숫자 문구 없음 |

## 3. 9c-2 Review(9c2R) 항목 처리

| # | 내용 | 처리 | 근거 |
|---|---|---|---|
| ① | 다시 불러오기 전 [내보내기] 무반응 | 끔(캐시 체크도) | `b1` `exportBeforeReload {disabled:true}` · `g1` `exportDisabledAfter true` |
| ② | `links.medical`·`search.recent` 통째 덮기 | **합집합** — 링크: 기기 순서 먼저·주소(trim)로 겹침 제거·30개·겹친 id 는 `cleanLinkIds` 새 id · 최근: 기기 먼저·5개 · 한쪽 `null`(기본 목록): 기기 null → 파일 값, 파일 null → 기기 그대로 · 그 밖 설정은 덮기 | I17(순수 + 실제 가져오기 + 두 번 = 한 번) · 변이 M5 빨강 |
| ③ | 타입·범위 | 설정은 `DEFAULTS` 와 같은 꼴(기본 null 키는 null·글자·수·배열) · 문서 `lastOpenedAt`·`addedAt` 미래 → 지금 · `lastPage`/`pageCount` 꼴 틀리면 그 필드 뺌 · `term` 없는(공백 포함) term 카드 거절 | I18 · 변이 M6·M7 빨강 |
| ④ | 쓰기 실패 문구·quota | `quota` 코드 → `backup.import.quota`("저장 공간이 모자라 멈췄습니다…같은 파일로 다시") | 배선·4언어 키(N5) — 저장소 가득은 headless 로 재현하지 않음 |
| ⑤ | 모르는 스토어 → 빈 괄호 | 이름 있는 것만, 하나도 없으면 줄 생략 | `g1` unknown.jsonl(pages 줄) 결과 줄 "…건너뜀 1" — 괄호 없음 |
| ⑥ | 시험 틈 R2·R3·R5 | I16 세 줄 | 같은 낱말·다른 대상 언어 따로 · 끝 줄 뒤 레코드 0·bad 1 · 키 틀린 진도·사용량 줄만 skip·마지막 캐시까지 |
| ⑧ | gzip 꼬리만 잘림 | `broken && ended` 면 손상 줄 생략 | `g1` trail.jsonl.gz(끝 4바이트 자름) → "새로 0 · 바뀜 0 · 그대로 49 · 건너뜀 0", 손상 문구 없음 |
| ⑨ `lastLineId` | 고치지 않음(낮음) | spec 9c-2 기준 문구 정정 · crossstep 후보 한 줄 | 아래 4절 관찰 |
| ⑦ | `window.confirm`(실기기) | 그대로 — 실기기 목록 | — |

## 4. 두 프로필 종단 (headless — 9c-2 합성 PDF·A 백업 읽기만)

- **A**: 9c-2 Build 의 A(`b9c2/dl/A.jsonl.gz`, `a-state.json` — 3쪽 낭독 동반 번역 POST 2·캐시 36·단어 2·`lastPage 3`·`lastLineId '3:1'`·사용량 calls 2)를 그대로 썼다(새로 만들지 않음).
- **B**(`pB1`, 빈 프로필, UI en): 미리보기 "1 books — already 0 · new 1 (PDF needed)…36 saved translations (about 53 KB)" → 가져오기 "New 40 · changed 1 · unchanged 8 · skipped 0" → [내보내기] 꺼짐 → [다시 불러오기](→ ko) → 서재 **"PDF 필요"** 카드 → 카드 [PDF 가져오기]에 다른 PDF(`b9c3/other.pdf`, 같은 5쪽·다른 해시) → 한 줄 안내·문서 무변 → 같은 PDF → `#/reader/<A id>/3` → 추출 끝까지 POST 0 → 앱 새로 불러옴 → 보통 카드·원본 그대로 → 3쪽 [▶] 7초 **POST 0** · 단어장 dyspnea·edema · 오늘 사용량 calls 2(A 와 같음) · 캐시 36 · 문서 1(같은 id).
- **줄**: 가져온 `lastLineId '3:1'` → 원본을 붙여 바로 연 3쪽(이웃 쪽 추출 전)에서 `'3:0'`(머리글 줄 — 9c-2 남은 1 의 HEAD 동작) → 추출 끝난 뒤 다시 열면 `'3:1'`. 끝 값은 A 와 같지만 리더가 줄을 되살리는 기능은 없다(9c2R-9) — 기준 문구를 "p.3"으로 정정.

## 5. 시험

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1727/1727 · 1727/1727**(HEAD 1719 + N 5 + I 3) — `b9c3/full1.txt`·`full2.txt`.
- `stamp-importmap --check` "그대로다 (모듈 79개 · CSS 4개)" · `git diff --check` 0(경고 하나: `ui/quiz.js` 작업본이 원래 CRLF — `i/lf w/crlf`, 고친 줄도 CRLF 로 같게).

### 변이 (`b9c3/mut.mjs` — 원본을 읽어 `b9c3/bak/` 에 쓰고 1곳만 바꿈 → 시험 → 원본 바이트로 되씀 → 바이트 비교, headless 둘은 `cmp` 0)

| # | 변이 | 빨강 |
|---|---|---|
| M1 | 재사용 경로 blob 검사(`ensureBlob`) 지우기 — 같은 해시 갈래 (설계) | N5 + **headless `r-M1`**: 원본 0·새로 불러온 뒤 "PDF 필요"·리더 열리지 않음 |
| M2 | `ensureBlob` 이 원본 유무를 안 봄(늘 put) | N2 |
| M3 | `needPdfMatch` 가 쪽수를 안 봄 | N1 |
| M4 | 리더 입구 검사 지우기 | N5 + **headless `e-M4`**: 리더 주소에서 서재로 오지 않음(빈 리더) |
| M5 | 의료 사이트 합집합 끔 | I17 |
| M6 | 문서 미래 시각 자르기 끔 | I18 |
| M7 | 설정 꼴 검사 끔 | I18 |
| M8 | 카드 해시 먼저 거르기 끔 | 처음 살아남음(N5 의 순서 단정이 `-1` 을 받음) → 단정 고쳐 N5 빨강 |

8/8 빨강, 모두 bak 과 같은 바이트로 되돌림(M1·M4 `cmp` 0).

## 6. headless (Edge · pipe · 새 프로필 `b9c3/p*` · 가짜 키 세션+로컬 · 흉내 Gemini OPTIONS 204 + CORS · 흉내 음성 · 캐시 끔 · **한 번에 하나** · 서버 띄움 0 — 앱 요청은 가로채 작업 트리 또는 `git show HEAD:` 에서)

| 실행 | 프로필 | 내용 | 결과 |
|---|---|---|---|
| `run-b3` | pB1 | 2절·4절 B 종단 | 위 표 |
| `run-r3` | pR1 | 재사용 경로 | 위 표 |
| `run-e3` | pE1 | 입구 다섯 | 위 표 |
| `run-l3` | pL1·pL2(최종 문구) | 360×740·412×915 × ko·ar × (서재로 온 알림·다른 PDF 알림) | 문서 가로 넘침 0·카드 넘침 0·카드 밖 요소 0·단추 최소 48px([PDF 가져오기] 138–172px)·ar `dir=rtl`·빈 `data-i18n` 0·초점 단추·알림 3–4줄 · 스크린샷 `b9c3/shots/opened-*`·`wrong-*` |
| `run-g3` | pG1 | 회귀: 새 PDF·같은 PDF(원본 1·문서 1·"already")·다른 PDF(문서 2) · 카드 [계속]·리더·검색(이 책, 결과 5)·퀴즈(없는 장 — 머묾)·단어장·사용량·설정 캐시 · 18 링크 카드 · 9c-1 내보내기(캐시 끔 14줄·head/end·aiCache 0) · 9c-2 가져오기(⑤·⑧) | 모두 머묾·정상 |
| `run-body` | pBodyC·pBodyH | 번역 요청 본문 바이트 | 지금 판 `4f2e6b6ac89f9d78`(2,729B)·`356e9e3f5ef34de4`(6,090B) = HEAD 판(260파일 `git show HEAD:`) 같은 둘 |
| `run-r3`·`run-e3` 변이 | pR2·pE2 | M1·M4 | 빨강 |

모든 실행 console 오류 0 · pageerror 0 · 새 탭 0 · 외부 요청 0(합성 PDF 를 연 실행만 pdf.js CDN — 앱이 원래 쓰는 라이브러리) · missing 0 · 4xx 0. 파일 넘기기는 `uploadFile`·파일 고르기 창(`waitForFileChooser`)으로 스크래치 파일만.

## 7. spec 정정
- 17-4-1 "9c-2 수용 기준" `[D]` 종단 줄: "p.3·같은 줄" → "p.3(줄 이어 읽기는 리더 기능 밖 — 9c2R-9 `[정정 2026-11-17 — 9c-3 Build]`)".
- 17-4-1 5절 정정 줄들 끝(9c-2 Build 다음)에 `[정정 2026-11-17 — 9c-3 Build]` 한 줄: ① 키만으로 판정·카드 꼴 ② `needPdfMatch`·한 트랜잭션 붙이기·맞지 않으면 무변 ③ 재사용 두 갈래 `ensureBlob` ④ 입구 `hasPdf`→`goNeedPdf`(히스토리 바꿔 쓰기, 검색 [이어서 준비]는 쌓기), "같은 배지에 초점" 대신 그 카드 단추 ⑤ i18n 6키·en·fr·ar 카드 단추는 "PDF 고르기" 뜻 ⑥ 9c2R 처리(4절 표 "settings 덮기"의 예외 두 키 포함).

## 8. 실기기 목록 (`[M]` — 17-4-1 10 + 이번에 생긴 것)
- [ ] 새 휴대폰(또는 Fold 7 새 Chrome 프로필)에서 백업 가져오기 → 서재 "PDF 필요" 카드 → [PDF 가져오기] 로 Android 파일 고르기에서 **같은 PDF**(다운로드·메신저로 받은 파일)를 고를 수 있는가 · 큰 책(CMDT)에서 해시 + pdf.js 열기 시간 · 같은 쪽·읽은 쪽 낭독 동반 번역이 요청 없이.
- [ ] 다른 판 PDF 를 고르면 안내 한 줄이 ar 로 읽히고 책이 그대로인가.
- [ ] 북마크·최근 탭으로 PDF 없는 책의 리더 주소를 열면 서재 그 카드로 오고 TalkBack 이 알림·단추(배지·안내 `aria-describedby`)를 읽는가 · Android 뒤로 제스처가 리더로 다시 튕기지 않는가.
- [ ] 서재 [가져오기]로 같은 PDF → 앱을 닫았다 열어도 "PDF 필요"가 다시 뜨지 않는가.
- [ ] ar·fr 6키 `[검토 — Nour·운영자]`(카드 단추 "اختيار ملف PDF"/"Choisir le PDF" 포함).
- [ ] (9c-2 넘김) 가져오는 중 뒤로 제스처 확인 창·ar · 큰 캐시 가져오기 시간.

## 9. 남은 문제
1. (HEAD — 9c2R-9) 리더가 쪽을 열 때 `lastLineId` 를 첫 줄/null(이웃 쪽 추출 전이면 머리글 줄 `3:0`)로 덮는다 — 줄 이어 읽기는 없는 기능. crossstep 후보로.
2. ko 서재 맨 위 단추는 아직 영어("Import a PDF" — fr·ko 미번역 키 묶음), 카드 단추는 "PDF 가져오기". en·fr·ar 카드 단추는 맨 위와 겹치지 않게 "PDF 고르기" 뜻으로 지음(spec 정정 ⑤).
3. `quota` 문구는 배선·키만 — 저장소 가득은 headless 로 재현하지 않음.
4. 링크 합집합: 기기에서 목록을 비운 사용자(`[]`)도 파일 항목을 받는다(합집합의 뜻 — 기록). 기기 `null`(기본 목록)은 예전처럼 파일 값.
5. 설정 꼴 검사는 화면이 `defaults` 를 넘길 때만(서비스는 `settings.js` 를 import 하지 않음 — I14 경계 유지).
6. 문서 미래 시각 자르기는 손댄 파일에서 `now` 가 달라지면 다시 가져올 때 `lastOpenedAt` 이 바뀐다(같은 `now` 면 멱등 — 앱 파일에서는 생기지 않음).
7. `#/vocab/<id>` 는 PDF 없이도 동작하므로 서재로 보내지 않음(설계 범위 밖).
8. 원본을 붙이자마자 연 3쪽에서 바로 [▶] 하면 9c-2 남은 1(머리글이 본문으로) 때문에 요청 1이 날 수 있다 — 이번엔 재지 않음(추출 끝난 뒤 0 만 잼).
9. `library.js` 가 설계 어림(+60)보다 큼(+266).

## 10. 막힌 명령 · 규칙
- 막힌 명령 없음. 규칙 어김 없음(명령 한 호출 한 가지 — 결과는 파일로 쓰고 따로 읽음).
- 서버 띄움 0 · 8000 접속 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋·checkout/restore/stash 0 · `rm` 0 · 프로필 복사 0 · `.nojekyll` 무변 · `G:`·`D:/OCR` 무관 · 원서 인용 0(합성 PDF·지어낸 글자만) · `b9c2/` 읽기만(`syn.pdf`·`dl/A.jsonl.gz`·`a-state.json`·하네스 사본 원본).
- 스크래치 `b9c3/`: `common.mjs`(b9c2 사본 — 경로만) · `make-other.mjs`·`other.pdf` · `make-dl.mjs`·`dl/unknown.jsonl`·`dl/trail.jsonl.gz` · `run-b3/r3/e3/l3/g3/body.mjs` · 결과 `b1`·`r1`·`e1`·`l1`·`l2`·`g1`·`body-cur`·`body-head`·`r-M1`·`e-M4` `.json`(+`.err`) · `mut.mjs`·`m-M*.txt`·`bak/` · `t0.txt`·`full1.txt`·`full2.txt` · `shots/` · 프로필 `pB1`·`pR1`·`pR2`·`pE1`·`pE2`·`pL1`·`pL2`·`pG1`·`pBodyC`·`pBodyH`.
