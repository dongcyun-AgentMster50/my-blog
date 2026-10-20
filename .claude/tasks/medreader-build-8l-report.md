# Build 보고서 — 8l 스캔본·글자 깨짐 감지와 안내 (2026-10-20)

> 지침 `.claude/tasks/medreader-build-8l.md` · 설계 spec **17-5-1**(O-D1–O-D3) + **19-1-3 §3**(L-D5·L-D10) + carryover `medreader-8l-carryover.md`.
> **커밋하지 않았다.** 시작 상태: `a4c8cfe`, 전체 1244/1244.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/scan.js` (새, 순수 262줄) | `probePages` · `garbleCount`/`countItems` · `textlessEnough`/`imageCheckPages` · `scanVerdict` · `scanRecord`/`needsScan` · 안내 키(`NOTICE_KEYS`·`badgeKey`·`bandKey`·`searchNotice`) · ▶ 갈래 `blocksPlay` · 연산 번호 표(`imageOpIds`·`textOpIds`·`countOps`) · `SCAN_FIELDS = ['scan']` |
| `js/config.js` | `SCAN` 상수(spec 그대로 + `START_AFTER_MS: 1500` — spec 밖 작은 값, 주석 표시) |
| `js/ui/library.js` | `attach` 다음 `scheduleScan`(추출기 첫 `page` 이벤트 또는 1.5초 뒤) · `scanPdf`(pdf.js 호출은 여기만) · `runScan`(한 번만·실패는 조용히) · `writeScan`/`markScanNoticed`(`db.patch` 로 `scan` 만) · 카드 배지 · `medreader:docscan` 이벤트 |
| `js/ui/reader.js` | 상단 띠(문서당 한 번, [원본 보기]·[닫기] → `noticed`) · `docScanVerdict()` · 빈 쪽 안내 `reader.page.noText` + [원본 보기](모든 문서) |
| `js/ui/controls.js` | ▶ 갈래 `scanPlayBlocked(sp, verdict)` → `reader.scan.noRead` 배너(누를 때마다) |
| `js/tts/speaker.js` | 읽기 전용 `isQueueEmptyHere()` 하나 — `queueOf(paras, peek)` 로 같은 큐 계산(빈 쪽 넘기기 규칙 무변) |
| `js/ui/search.js` | 이 책 검색 상태 줄 한 곳(`searchNotice`) |
| `js/i18n/{ko,en,ar,fr}.js` | 새 키 8개 × 4 |
| `index.html` | 띠 자리 `#scanNotice` + import map 도장 |
| `css/reader.css`·`css/screens.css` | 띠·빈 쪽 안내·배지 |
| `tests/scan-8l.test.mjs` (새, 16개) | 아래 4 |
| `spec.md` | 17-5-1 안 정정 줄 2 · 19-1-3 §3-2 안 정정 줄 1 |

DB 버전(3)·`algoVersion`·`derivedDocReset` 무변(테스트 SC13). `.nojekyll` 그대로. `dev/` 무변.

## 2. 판정 규칙

- 표본: `probePages(N)` — N ≤ 12 이면 1..N, 아니면 [0.10N, 0.90N] 을 12칸으로 나눈 칸 가운데 쪽(반올림·중복 제거). O1 조사 `diag-one.mjs` 와 같은 식.
- 쪽마다 `getTextContent(PDF_TEXT_CONTENT_OPTIONS)` 아이템 `str` 만 — 공백(`\s`) 아닌 **코드 포인트** 수 `chars`, 그중 `bad` = U+FFFD + PUA(E000–F8FF·F0000–10FFFD) + 제어(0000–001F·007F–009F 중 `\s` 아닌 것).
- 문턱: 글자 0 표본 × 4 ≥ 표본 × 3(75%) → 글자 0 표본 앞 2쪽만 `getOperatorList` → 이미지 연산(7종) ≥1 쪽이 하나라도 → `scan`, 아니면 `notext`. 그 밖에 Σchars ≥ 500 이고 Σbad × 20 ≥ Σchars(5%) → `garbled`. 나머지 `text`. **글자 0 판정이 먼저**.
- **Harry Potter 꼴(carryover)**: 실물 확인 — 12/12 글자 0, 확인 쪽(45·68) 이미지 0, **텍스트 연산 84·66** → `notext`. 판정 셋·앱 문구는 그대로(새 키 없음), 이미지를 확인한 경우(`scan`·`notext`) 확인 쪽의 텍스트 연산 합을 `documents.scan.textOps` 로 저장(150). `notext + textOps > 0` = 글꼴 매핑 없음 → 가이드가 `--force-ocr` 를 안내할 근거.
- 저장: `documents.scan = { v, verdict, probed, textless, img, chars, bad, at, textOps?, noticed? }` — `db.patch` 로 `scan` 만. 같은 판(`v`)이면 다시 돌지 않음. 표본 쪽 하나라도 못 읽으면 저장하지 않음(다음에 열 때 다시). 판이 올라 다시 판정해도 같은 갈래면 `noticed` 를 지킨다.

## 3. 실물 판정 (앱 `ui/library.js scanPdf` + pdf.js 5.6.205, Node — 숫자만)

| 파일 | 쪽 | 기대 | 판정 | 글자0/표본 | img | textOps | Σbad/Σchars | ms |
|---|---|---|---|---|---|---|---|---|
| Harrison 2021 | 729 | text | text | 0/12 | — | — | 0 / 39,879 | 609 |
| CMDT 2026 | 1,967 | text | text | 0/12 | — | — | 0 / 51,283 | 1,306 |
| CMDT 2021 | 5,051 | text | text | 0/12 | — | — | 0 / 22,117 | 409 |
| Advanced Grammar 원본(OmniPage) | 307 | scan | scan | 12/12 | 2 | 0 | 0 | 650 |
| `test-OCR.pdf`(40–45쪽만 OCR) | 307 | scan | scan | **11/12** | 2 | 0 | 0 / 2,742 | 1,330 |
| 롱맨 Grammar in Use 원본 | 275 | scan | scan | 12/12 | 2 | 0 | 0 | 92 |
| 롱맨 Market Leader 원본 | 99 | scan | scan | 12/12 | 2 | 0 | 0 | 865 |
| 스피쿠스 unit1 | 6 | garbled | garbled | 0/6 | — | — | 1,209 / 5,599 (21.6%) | 125 |
| 스피쿠스 unit10 | 8 | garbled | garbled | 0/8 | — | — | 2,058 / 8,286 (24.8%) | 96 |
| Harry Potter 2 원본 | 341 | notext | **notext** | 12/12 | 0 | **150** | 0 | 43 |
| OCR: Advanced Grammar `[OCR]`(G:) | 307 | text | text | 0/12 | — | — | 0 | 1,951 |
| OCR: 롱맨 Grammar `[OCR]` · Market Leader `[OCR]` | 275·99 | text | text | 0/12 | — | — | 0 | 177·180 |
| OCR: Harry Potter 2 `[OCR]` | 341 | text | text | 0/12 | — | — | 0 | 143 |
| OCR: 스피쿠스 unit1 `[OCR]` | 6 | text | text | 0/6 | — | — | 0 | 65 |
| OCR: Advanced Grammar key `[OCR]` · Pronunciation In Use `[OCR]` | 43·201 | text | text | 0/12 | — | — | 0 | 293·170 |

- 17/17 기대와 같음. `test-OCR.pdf` 는 표본 41쪽이 OCR 한 쪽이라 spec 의 12/12 가 아니라 11/12 — 여전히 `scan`(spec 정정 줄에 적음).
- **조사 원자료 전수**(`survey/results.jsonl` 323개, 조사 판정 + badPct ≥ 5 → garbled 로 기대값): **어긋남 0**, 오류 0. 분포 text 216 · scan 46 · notext 1(Harry Potter, textOps 150) · garbled 60. 앱 값 garbled 최저 19.1%, text 최대 0.075%(English Pronunciation In Use). 파일당 평균 288ms·최대 2.5초(데스크톱).
- 세 책 회귀(19-1-3 §3-4): Harrison·CMDT 2026·CMDT 2021·`test-OCR` Σbad = 0 → 5% 의 1/10 미만 충족(멈출 일 없음).
- 원자료: 스크래치패드 `b8l/out-all.jsonl`·`b8l/out-survey.jsonl`, 스크립트 `b8l/judge.mjs`·`b8l/fixture-measure.mjs`.

## 4. 안내 세 자리와 ▶

| 자리 | scan·notext | garbled |
|---|---|---|
| 서재 카드 | 배지 `library.card.scan`(추출 진행 줄 그대로) | 배지 `library.card.garbled` |
| 리더 상단 띠(`#scanNotice`, `.banner` 모양) | `reader.scan.notice` + [원본 보기] + [닫기] — 둘 다 `noticed = true`(문서당 한 번, [원본 보기]는 원본 뷰로) | `reader.scan.garbled` + 같은 단추 |
| 검색(이 책) | 결과 0(끝난 뒤) 이면 "찾지 못했습니다" **대신** `reader.scan.noSearch` | 결과 위에 한 줄 `reader.scan.garbledSearch`(결과 그대로) |
| ▶ | 재생 시작 지점에서 지금 쪽 큐가 비면 `play()` 를 부르지 않고 `reader.scan.noRead` 배너(누를 때마다), `idle`·쪽 그대로 | **막지 않음**(L-D10) |
| 빈 쪽(블록 0) | 모든 문서 — `reader.page.noText` + [원본 보기] (옛 `reader.page.empty` 키는 남김) | 같음 |

- 판정은 `attach` 의 `ex.start()` **뒤**, 추출기 첫 `page` 이벤트(또는 1.5초)에 시작 — 첫 쪽 표시를 막지 않는다. 판정이 오면 `medreader:docscan` → 카드 배지·열린 리더 띠가 즉시 바뀐다.
- spec 의 "지금은 빈 쪽을 20쪽 넘긴 뒤 멈춤" 서술은 실제 코드와 다르다: 재생을 시작한 쪽이 비면 **조용히 idle**(S22), 20쪽 넘김은 글자 있는 쪽 끝에서 일어난다. 8l 은 시작 지점만 바꿈(조용히 → 안내) — spec 정정 줄.

## 5. i18n

새 키 8개 × ko·en·ar·fr: `library.card.scan` · `library.card.garbled` · `reader.page.noText` · `reader.scan.notice` · `reader.scan.noRead` · `reader.scan.noSearch` · `reader.scan.garbled` · `reader.scan.garbledSearch`. **spec 표 문안 그대로**(테스트 SC16 이 spec.md 표 행을 읽어 네 언어 모두 글자 단위 비교). ar·fr 은 spec 의 `[검토 — Nour·운영자]` 그대로. 기존 i18n 테스트(키 집합·HTML 없음·ar 번역됨) 통과.

## 6. spec 정정 줄 (고친 곳은 이 셋뿐)

1. 17-5-1 2 — Harry Potter 꼴 실물·`textOps` 저장·실물 판정 표 요약·조사 323개 어긋남 0.
2. 17-5-1 2 — 시작 시점(첫 쪽 또는 `START_AFTER_MS`)·실패 시 저장 안 함.
3. 17-5-1 3 — ▶ "지금" 서술 정정, `isQueueEmptyHere`, [원본 보기]도 `noticed`.
4. 19-1-3 §3-2 — `textOps` 필드, 앱 값(쪽 전체)과 조사 원값(쪽당 6,000자) 차이, 세 책 회귀 Σbad 0, `dev/measure-scan-o1.mjs` 대신 스크래치 스크립트로 잰 이유(범위 밖).

## 7. 테스트·변이

- 새 `tests/scan-8l.test.mjs` 16개: SC1 표본 경계(0·1·5·12·13·307·341·5051) · SC2 `garbleCount` 경계(FFFD·PUA 두 구간·C0·DEL·C1·U+0085, 공백류·NBSP·U+3000·FEFF 제외, 서로게이트 쌍 1) · SC3 문턱(9/12 후보·8/12 text·4 중 3·표본 0) · SC4 실물 표 · SC5 옛 "앞 12쪽" 규칙이면 CMDT 2021 → scan · SC6 garbled(스피쿠스 최저·최고·정상 최대·경계·499·순서) · SC7 레코드·경첩 · SC8 안내 키·▶ 순수 · SC9 `scanPdf` 호출 수(텍스트 책 `getOperatorList` 0번·최대 2쪽) · SC10 P1 경합(판정 도중 끼어든 `lang`·`lastPage` 보존) · SC11 한 번만·옛 판 다시·실패 조용히·다음에 다시·지운 문서 안 되살림 · SC12 `scan` 만 씀·`noticed` · SC13 DB 버전·`derivedDocReset`·[다시 추출] 무관 · SC14 ▶ 갈래(실제 `createSpeaker`) · SC15 배선 · SC16 i18n = spec.
- 전체 `node --test apps/medreader/tests/*.test.mjs` **2회 1260/1260**(1244 + 16). `stamp-importmap --check` 0.
- 변이 10개(백업 `b8l/bak/`, 복원 = 백업을 읽어서 쓰기 + 바이트 비교 + `cmp` 4파일 같음) — 전부 빨강:

| 변이 | 빨강 |
|---|---|
| M1 문턱 75%→50% | SC3 |
| M2 표본 구간 FROM 0 | SC1·SC9 |
| M3 garbled 문턱 0 | SC3·SC4·SC5·SC6 |
| M4 제어 문자를 세지 않음 | SC2·SC9 |
| M5 ▶ 갈래가 garbled 도 막음 | SC8·SC14 |
| M6 ▶ 갈래 없음(controls) | SC14 |
| M7 자기 필드만 → get→put 통째 쓰기 | SC10 |
| M8 한 번만 → 매번 | SC7·SC11·SC12 |
| M9 순서 — 깨짐을 먼저 | SC6 |
| M10 스캔본 검색도 "위 한 줄" | SC8 |

(spec 의 "FROM: 0 + CMDT 2021 앞쪽 수치 → scan" 변이는 5,051쪽에선 FROM 0 이어도 표본이 앞붙이에 닿지 않아 그대로는 빨강이 안 된다 — SC5 가 옛 "앞 12쪽" 규칙 꼴로 같은 뜻을 고정하고, M2 는 SC1·SC9 가 잡는다.)

## 8. headless Edge (412×915, 새 프로필 `b8l/pko`·`b8l/par` 2개 — 시험 DB 만 비우고 시작, 8000번 python 사용·끄지 않음)

- **ko**: 롱맨 Grammar 원본 → 판정 `scan`(img 2, textOps 0) · 리더 띠 문구 = ko 키(리더가 보인 뒤 약 0.2초) · 1쪽 빈 쪽 안내 + [원본] · ▶ → 쪽 1 그대로·`idle`·발화 0·`reader.scan.noRead` 배너, 닫고 다시 누르면 다시 · 412/360px 가로 스크롤 0(412/412·360/360) · 띠 단추 48px · 띠 [원본 보기] → 원본 뷰·띠 닫힘·`noticed: true`·다른 필드 그대로 → 리플로우로 복귀 · 검색 "grammar" → `reader.scan.noSearch`(부분 결과 줄과 함께) · 서재 배지 "스캔본 — 글자 없음"(추출 줄 "Text ready" 그대로) · 새로고침 후 다시 열면 띠 없음.
  스피쿠스 unit1 → `garbled`(5,599/1,209) · 배지 "글자 깨짐 — OCR 필요" · 띠 문구 일치 · ▶ → 발화 17·`speaking`·noRead 없음(막지 않음) · 검색 "th" → 맨 위 `reader.scan.garbledSearch`.
  Harrison → `text`(Σbad 0) · 띠·배지 없음 · **8i-3 쪽 넘김 낭독**: 20쪽에서 ▶ → 21쪽으로 넘어가 21쪽 발화 계속, 스캔 안내 0.
- **ar**: `dir=rtl lang=ar` · 띠 아랍어 문구 일치 · 빈 쪽 안내 일치 · ▶ → 쪽 그대로·`idle`·아랍어 noRead 배너 · 412/360px 가로 스크롤 0 · 띠 단추 48px(الأصل·إغلاق) · 배지 아랍어·`direction: rtl` · 검색 noSearch · [닫기] → `noticed`.
- 콘솔 오류: 앱 0. (`favicon.ico` 404 한 건은 시험 DB 를 비우려고 연 `manifest.webmanifest` 쪽에서 난 것 — 앱 아님.) 스크린샷 `b8l/shots/`.

## 9. 남은 프로세스

내가 띄운 Edge·node 없음(확인: 남은 `msedge.exe` 3개는 명령줄이 보이지 않는 다른 프로세스 — 내 프로필 경로 아님, node 는 Adobe·codex·8123–8125 http-server). 8000번 python(PID 15088) 그대로 켜 둠. 8123·8124·8125 손대지 않음.

## 10. 남은 문제

1. **스캔본 안의 OCR 된 쪽을 읽다가 뒤 빈 쪽들로 넘어갈 때** speaker 의 20쪽 넘김은 그대로다(spec: "시작 지점에서만"). `test-OCR` 같은 부분 OCR 문서에서 화면이 최대 20쪽 앞으로 갈 수 있다 — 막으려면 speaker 규칙을 문서 판정에 묶는 별도 결정이 필요.
2. 검색 화면은 들어올 때 문서 레코드를 읽는다 — 판정이 검색 화면을 연 **뒤**에 오면 다시 들어올 때부터 안내 줄이 보인다(가져온 직후 바로 검색하는 경우만).
3. ▶ 안내는 14절 배너(화면 맨 위, 닫을 때까지 남음)를 쓴다 — ▶ 근처가 아니다. 412px 에서 띠의 [닫기]가 둘째 줄로 내려간다(48px·가로 스크롤 0 은 지킴).
4. `[M]` 운영자 Galaxy: 띠가 첫 화면을 늦추지 않는지(표본 12쪽 + 확인 2쪽) — 데스크톱은 파일당 평균 288ms, 휴대폰 미확인.
5. 표본 쪽 하나가 늘 `getTextContent` 에 실패하는 PDF 는 열 때마다 판정을 다시 시도한다(조용히, 12쪽 비용).
6. 운영자 가이드(앱 밖)에 "`notext` + `textOps > 0` → `--force-ocr`" 를 넣는 일은 이 Build 범위 밖 — 앱은 값만 남긴다(값을 볼 화면은 없음 — 9c 백업·DevTools).
