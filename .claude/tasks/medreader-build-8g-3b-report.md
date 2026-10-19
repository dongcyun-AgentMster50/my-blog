# Build 보고 — 8g-3b 폴백 목차 품질 · 쓰레기 개요 판정

> 지침 `.claude/tasks/medreader-build-8g-3b.md` · spec 17-8-12 §11(승인 2026-10-19 E1–E6). **커밋 안 함.** 화면 변화 없음, 저장되는 것 없음(DB·`OUTLINE_V`·algoVersion·`SEARCH.VERSION` 그대로).
> 스크래치: `b8g3b/`(백업 `bak/`, 수정본 사본 `post/`, 측정·변이 스크립트와 결과).

## 1. 바꾼 것

| 파일 | 내용 |
|---|---|
| `js/config.js` | `SEARCH` 에 `TOC_MIN_R 0.9` · `TOC_WEAK_R 1.15` · `TOC_MAX_LEN 80` · `TOC_REPEAT_MIN 3`(이 넷만). `VERSION` 그대로 |
| `js/text/search.js` | **`tocDropReason(h)`**(새 export, 순수) — R1–R8, 코드 `'small'·'noise'·'sentence'·'multi'·'symbol'·'long'·'dialog'·'weak'`/null. 이름 붙은 정규식 6개(`ELLIPSIS_END`·`SENT_END`·`MULTI`·`DIALOG_START`·`DIALOG_END`·`OCR_SYMBOL`)와 셈 정규식 3개는 `dev/measure-toc-8g3b.mjs` 와 글자 그대로(셈 정규식은 모듈 상수로 올림). 결과가 같은 빠른 길 두 개: `SENT_END` 는 끝 글자가 `.!?"”’'` 일 때만, `MULTI` 는 `[.!?]` 가 있을 때만 돌린다. 대소문자 수는 `r < TOC_WEAK_R` 일 때만 센다. **`headingToc(recs, {max?, pages?})`** — R10 반복 문턱 `min(10, max(3, ⌈pages/2⌉))`(pages 가 없거나 0·NaN 이면 10), 반복 제목을 빼고 r 별로 묶은 뒤 **r 을 한 번 정렬**해 위 층부터 R1–R8 을 판정하며 남은 수를 누적(뺀 것은 상한에 안 듦), 누적이 max 를 넘는 층에서 멈춘다(그 아래 층은 판정하지 않는다). 숫자만 항목은 같은 쪽 다음 heading 을 붙이고, 그래도 숫자만이면 뺀다(R9) |
| `js/search/outline.js` | `JUNK_TITLE_RE` · `JUNK_OUTLINE_RATIO = 0.8` · **`isJunkOutline(outline)`**(순수, 모든 깊이, 빈 제목 포함, `[]` → false). **`tocOf`**: `read && outline.length && !junk` 일 때만 `source:'outline'`. 폴백 결과에 `outlineIgnored`(boolean), `headingToc(recs, { pages: Number(doc.pageCount) })`. `readOutline`·`ensure`·`OUTLINE_V`·저장 필드는 그대로 |
| `tests/search-toc-8g3b.test.mjs`(새) | S31–S35, 테스트 15개 |
| `tests/search-outline-8g.test.mjs` | 아래 2절 하나만 |
| `index.html` | `stamp-importmap` 으로만(config·outline·search 해시 3줄) |
| `dev/measure-toc-8g3b.mjs` | **안 바꿈** — 앱 비교 모드(`symDiffAppVsProto`·`appJunk`)가 이미 있어 그대로 돌렸다 |

## 2. 기존 테스트 기대값 변경 — 하나뿐

`tests/search-outline-8g.test.mjs` "S17 ★ headingToc — 숫자만인 항목은 같은 쪽…" 첫 테스트: 기대값에서 `['4', 1]`(1쪽 끝의 숫자만 항목)을 뺐다(R9, spec §11-1 U11 정정). 제목 괄호도 "(쪽 끝이면 뺀다 — 8g-3b R9)"로. 그 밖의 기존 테스트(S16b·S17 상한·search-text-8g S17)는 그대로 녹색.

## 3. 수용 기준

| | 결과 |
|---|---|
| S31 `isJunkOutline` 표·경계 | 통과 — spec 표의 파일 이름 꼴 8개·아님 3개(+ 확장자별 몇 개) · 8/10 버림 · 7/10 개요 · `[]`/null → false · 의학책 꼴 37·61·50 → false · Basic 2판 꼴(.pdf 4 + .jpg 6) → 버림 |
| S32 `tocOf` | 통과 — 쓰레기 개요(ensure 로 저장) → `fallback`·`outlineIgnored:true`·`outlineRead:true`, 저장본 = PDF 개요 그대로, tocOf 동안 documents put·readwrite 트랜잭션 0, 레코드 JSON 바이트 같음 · 진짜 개요 → `outline`(outlineIgnored 없음) · 7/10 개요는 그대로 · 개요 `[]` → `outlineIgnored:false` · 못 읽음 → false · 6쪽 문서는 3번 반복 제목 빠짐, 30쪽은 남음 |
| S33 `tocDropReason` 짝 표 | 통과 — spec 의 꼴 전부 + 경계(r 1.15/1.14, 0.9/0.89, 80/81자). `Pass the pan.` 은 남는다(알려진 한계로 테스트에 적음) |
| S34 `headingToc` | 통과 — 문장 줄 150(r 2.0) + 제목 100(r 1.5) → 제목 100 · R9(쪽 끝 숫자·숫자+숫자 빠짐, "1 Zorvat Chapter 2" 그대로) · R10(없음 10 · 6쪽·4쪽 3 · 7쪽 4 · 30쪽 10 · 0/NaN = 없음) · 쪽 순서 · 입력 불변 · 층 고르기 = 8g-3 식 층마다 거르기와 같은 결과 |
| S35 계층·순수 | 통과 — `text/search.js` 에 document·window·indexedDB·fetch 0 · `isJunkOutline` 본문에 `db.`·async 없음, 부를 때 DB 기록 0 |
| S36 94권 | 아래 4절 — 차이 0, 회귀 0. 시간은 따뜻한 값 전부 이하, 첫 호출 값은 OCR 2권이 조금 느리다(남은 문제 1) |
| S37 | 전체 `node --test apps/medreader/tests/*.test.mjs` 2회 **1158/1158**(1143 + 새 15) · `stamp-importmap --check` 0 |

## 4. S36 — `measure-toc-8g3b.mjs` 94권(의학 3 + `D:/OCR` 아래 ` [OCR].pdf` 91, 읽기만)

책마다 프로세스 하나·상한(의학 400초, OCR 120초), 전체 상한 2,400초. 최종 코드로 173초, 94/94 종료 0(`b8g3b/s36.jsonl`·`s36.log`·`s36-judge.json`; 셈 상수로 올리기 전 1차 실행 `s36-run1.*` 도 같은 판정).

- **모든 책 `symDiffAppVsProto` 0**(합 0). 덤프 대조(`precheck.mjs`)에서는 항목 순서·r 까지 94권 모두 같다.
- 앱 `isJunkOutline` = `protoJunk` 94/94 — 쓰레기 6 · 진짜 개요 5 · 폴백 89권, **폴백 0항목 책 0**(최소 9).
- 의학책 S18: **CMDT 2021 98항목 · 제목 45/50 · 쪽 47/50**(≥45·≤200 충족) · **Harrison 120항목 · 쪽 30/37**(≥27) · 제목 13/37 · CMDT 2026(기록) 97 · 51/61 · 5/61 — Plan 값과 같다.
- Supplementary 쪽 56/61 · 제목 14/61(기준 56·14) · Harry Potter 2 = 33항목 · OCR 91권 폴백 항목 합 4,905(Plan 과 같음).
- 시간(heading 1,000 이상, 앱 `headingToc`):

| 책 | heads | 따뜻한 값(같은 프로세스 반복) 8g-3 → 지금 | 첫 호출(프로세스 7번 중앙값) 8g-3 → 지금 | S36 한 번(8g-3 은 Plan 실행 값) |
|---|---|---|---|---|
| English Grammar in Use 3판 | 3,004 | 15.4 → 8.6 | 24.5 → 17.8 | 21.1 → 14.3 |
| Essential Grammar 2판 | 2,344 | 10.9 → 6.5 | 18.9 → 15.2 | 13.6 → 11.9 |
| Essential Grammar(다른 판) | 2,344 | 11.0 → 6.6 | 18.4 → 15.4 | 14.2 → 12.0 |
| Grammar in Use Basic 2판 | 1,271 | 5.5 → 3.8 | **10.4 → 10.9** | **7.3 → 9.9** |
| Longman Grammar Practice | 1,714 | 13.8 → 12.6 | **19.8 → 20.9** | **16.0 → 17.6** |
| English Grammar in Use 2판 | 2,055 | 10.8 → 8.0 | 18.2 → 16.9 | 15.3 → 13.4 |
| (의학) Harrison | 1,017 | 5.0 → 5.8 | 9.8 → 13.1 | 8.0 → 12.1 |
| (의학) CMDT 2026 | 12,194 | 48.1 → 25.7 | 58.3 → 36.3 | 72.1 → 43.1 |
| (의학) CMDT 2021 | 5,997 | 15.1 → 11.0 | 21.8 → 18.5 | 24.6 → 22.7 |

(ms, 데스크톱. 처음엔 기준 정의를 옮긴 그대로라 따뜻한 값이 8g-3 의 약 2배였다 → 빠른 길 두 개 → 위 층부터 판정하며 넘는 층에서 멈추기로 바꿔 위 표가 됐다. 결과는 매번 94권 차이 0 으로 다시 봤다.)

## 5. 변이 T1–T15(spec 11-7) — `b8g3b/mutate.mjs`, 결과 `mutate.txt`

변이마다 `post/` 사본에 치환 → 목차 테스트 세 파일 → 사본으로 복원 → `cmp` **15/15 같음**.

- **빨강 14**: T1·T2(S31) · T3·T15(S32 쓰레기 개요) · T4(S32 6쪽) · T6(S33 R2·약어) · T7(S33 R4 `-ing`; 붙임표를 여는 따옴표 묶음에 넣음) · T8(S33 R7 막대) · T9·T10·T11(S33 R8·R1) · T12(S34 상한; 뺀 것도 층 누적에 셈) · T13(S17·S34 R9) · T14(S17·S34 등 7개; pages 없으면 NaN).
- **T5(R2 말줄임 예외 제거) 녹색 — 동치 변이**: `SENT_END` 는 부호 바로 앞이 글자여야 맞고, `ELLIPSIS_END` 는 끝 부호 앞이 `..`·`…`·공백이어야 맞는다. 그래서 둘이 함께 맞는 글은 있을 수 없다. 94권 heading 45,906개에서 함께 맞은 것 0(말줄임 끝 339), 합성 꼴 8개도 0(`t5eq.mjs`). 기준 정의와 글자 그대로여야 하므로 정규식은 두었다. 예외 줄은 지금 할 일이 없는 셈이다 — spec/Review 에서 판단할 거리.

## 6. 남은 문제 · 넘김

1. **S36 시간 기준 일부**: 따뜻한 값은 OCR 6권 모두 8g-3 이하. 첫 호출 값은 Basic 2판(+0.5ms 중앙값, S36 한 번 +2.6ms)과 Longman(+1.1 / +1.6ms)이 조금 느리다. 이 두 권은 판정할 heading 이 많고 아래 층까지 내려간다. 남은 차이는 첫 호출 때 유니코드 속성 정규식을 컴파일하는 값(약 2ms, `coldparts`)과 같은 크기다. Harrison(의학, 기준 밖)도 첫 호출 +3–4ms. 기준을 "따뜻한 값"으로 읽을지, 이 정도는 받아들일지 Review·운영자가 판단해야 한다. 더 줄이려면 셈 정규식을 손 루프로 바꿔야 하는데, "정규식 글자 그대로" 와 부딪쳐 하지 않았다.
2. T5 동치 변이(5절) — R2 말줄임 예외가 정의상 다른 규칙과 겹쳐 효과가 없다.
3. `dev/measure-search-8g.mjs --toc`(8g-3 S18 도구)는 앱 `headingToc` 를 옛 '변형 C' 와 맞대므로, 이제 차이가 0 이 아니게 나온다. 이번 수정 범위 밖이라 그대로 뒀다. 8g-3b 이후 S18 은 `measure-toc-8g3b.mjs` 로 본다.
4. 8g-4 몫(그대로 넘김): E5 폴백 머리 문구 · `outlineIgnored` 를 화면이 쓸지 · S19 보강(Essential Grammar 2판 목차 탭 = 폴백, 파일 이름 0 줄).

남은 프로세스: 이 Build 가 띄운 node 0(측정·변이·테스트 모두 끝, 감시 tail 은 멈춤. 남은 node.exe 하나는 Adobe CC 의 것).
