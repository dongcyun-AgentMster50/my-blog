# Build 보고 — 8f-4b: 8f-4 Review 지적 고치기

> 2026-11-16 Build 서브에이전트. 근거 review.md "8f-4 Review" 8f4R-6 #1–#4. **커밋하지 않음.** 스크래치 `b8f4b/`(`r8f4/`·`b8f4/` 는 읽기만).

## 1. 고친 것(전 → 후)

| # | 전(8f-4 판) | 후(8f-4b) | 곳 |
|---|---|---|---|
| 1 중간 | 바꾼 원어도 0건이면 «بُحث عنها … ← nosuchword» + «لم يُعثر على «nosuchword»» 뿐 — 글자 체계 안내·[«الفهرس» 로] 단추 없음 | Review 권고 **(가)**: 바꾼 검색이 끝나며 적중 0(또는 reject)이면 **원래 검색어 모형으로 되돌린다** — 바꿈 줄 없음, 17-8-7 안내(찾지 못했습니다 + 글자 체계 안내 + [«الفهرس» 로]) HEAD 와 같은 DOM. 바꿈 성공은 그대로 | `search.js` 새 순수 함수 `vocabFallback(m)` · `kickVocab` 이 바꾼 모형에 `nm.orig = m` · `onRunEvent` 가 그리기 전에 `const back = vocabFallback(S.model); if (back) S.model = back;` |
| 2 낮음 | `kickVocab` 의 낡은 결과 거르기(`S.model !== m \|\| S.docId !== docId`)를 지워도 node 시험 초록 | 응답 처리 판단을 순수 함수 `vocabSettle(st, m, docId, out)` → `'drop'·'later'·'dict'·'none'·'swap'` 로 떼고 `kickVocab` 은 그 값대로. W11 이 판단(검색어·책·지움·화면 떠남)과 흐름 흉내(단어장 읽기 중 새 검색 → 늦은 응답 drop)·배선을 지킨다 | `search.js`·W11 |
| 3 낮음 | 단어장 읽기가 매달리면 "찾지 못했습니다"·글자 체계 안내·단추 **모두** 미뤄져 상태 줄이 빔 | **미루는 것은 "찾지 못했습니다" 한 줄뿐** — 글자 체계 안내·[«الفهرس» 로] 는 바로 보인다 | `paintModelStatus` 조건에서 `m.vocab !== 'looking'` 을 빼고 루프 안 `if (k === 'empty' && m.vocab === 'looking') continue;` |
| 4 낮음 | U10 제목 "검색 키 47개(…)" ↔ 단언 48 | "48개(… + 8f-4 1)"(문안만) | `search-ui-8g.test.mjs` 한 줄 |

**3 에서 작은 쪽을 고른 이유**: 상한 시간(타이머)은 상태·정리·시험이 더 늘고, 상한 뒤 늦게 온 바꿈과 다시 엉킬 길이 생긴다. 글자 체계 안내와 [«الفهرس» 로] 는 단어장 결과와 무관하게 같은 문장이므로(바꿈이 성공할 때만 바꿈 줄 + 결과로 대체) 바로 보여도 틀릴 일이 없고, 매달려도 타이핑 없는 길(목차)이 남는다. 비용은 바꿈이 성공할 때 안내 줄이 수 ms 보였다 사라지는 것뿐 — 깜빡임이 문제 되던 "찾지 못했습니다"(사실과 반대가 될 수 있는 줄)는 여전히 미룬다.

**1 세부**: 되돌림은 `final`·`reject` 뒤(`m.final`)에만 — 찾는 중(partial)에는 바꿈 줄이 보인다. 되돌린 원래 모형은 `vocab` 표지가 남아 단어장을 다시 읽지 않는다(한 모형 한 번). 되돌림은 `[8g-7]` 폴백 목차 재읽기 블록 **뒤**에 둬서(그때 `S.model` 은 라틴 원어 — `chapterGate` 거짓) HEAD 에 없던 목차 재읽기를 만들지 않는다. 되돌린 뒤 `S.model.query === S.query` 라 Review #6(같은 아랍어 자동 검색이 한 번 더 도는 일)도 이 경우엔 사라진다.

## 2. 바꾼 파일
- `js/ui/search.js` — `vocabSettle`·`vocabFallback`(export, 순수) · `kickVocab` 응답 처리 · `nm.orig` · `onRunEvent` 되돌림 2줄 · `paintModelStatus` 조건 · 머리 주석 1줄.
- `tests/search-vocab-8f4.test.mjs` — W10([N] 바꾼 원어 0건 → 원래 모형 = HEAD 판 모형 · 17-8-7 안내 `['empty','hint']` · 찾는 중 안 되돌림 · 바꿈 성공 그대로 · reject 도 되돌림 · 배선), W11(위 2), W12(위 3 배선) — 11 → 14.
- `tests/search-ui-8g.test.mjs` — U10 제목 한 줄.
- `index.html` — stamp(search.js 판 번호).
- `spec.md` — 17-8-9 `[정정 2026-11-16 — 8f-4 Build]` 줄 뒤 `[정정 2026-11-16 — 8f-4b]` 한 줄.
- i18n·`vocab/store.js`·`text/*` 손대지 않음(새 키 0).

## 3. HEAD 대조 32 상태 (Review `r8f4/run.mjs` 꼴 — `b8f4b/run.mjs`)
- HEAD 판 = `r8f4/srv/head`(읽기만), 지금 판 = `b8f4b/srv/cur`(작업 트리 `index.html`·manifest·`css/`·`icons/`·`js/` 사본 2.3MB, `diff -rq js` 같음). 같은 데이터·같은 순서.
- 이번엔 각 판을 돌리기 전에 그 탭을 앞으로(`bringToFront`) 해서 조각 읽기가 두 판 다 돈다 — Review 가 손으로 뺀 차이 ①(조각 글자·`<mark>`)이 사라져 **원 JSON 그대로 비교**, PDF 문서 id 만 `<pdf>` 로 바꿈(차이 ②).
- 결과: **32/32 같음** — Review 때 다르던 B «الرَّبو»(→ zorvat, A 책 낱말)도 이제 HEAD 와 같은 «لم يُعثر على «الرَّبو»» + 글자 체계 안내 + `search-to-toc` 단추.
- 더한 대조 X 3개(두 판에 같은 카드 `nosuchword`←«الدوخة» 넣고): A «الدوخة» · A pulmonary · B «الرَّبو» — **3/3 같음**.

## 4. 시험
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs`: **1회차 1667/1667(9.9초) · 2회차 1667/1667(10.0초 — 변이 복원·spec 뒤)** — `b8f4b/test1.txt`·`test2.txt`. (1664 + 새 3)
- `dev/stamp-importmap.mjs` 다시 → `--check` "그대로다 (모듈 73개 · CSS 4개)" · `git diff --check` 0.

## 5. 변이 (백업 `b8f4b/bak/search.js`, `b8f4b/mutate.mjs` 로 한 곳씩 → `b8f4b/restore.mjs`(백업을 읽어 씀) → `cmp` 0, 매번)

| # | 변이 | 되돌리는 것 | 빨강 |
|---|---|---|---|
| V1 | `if (back) S.model = back;` → `if (back && false) …` | 1(배선) | W10 |
| V2 | `vocabFallback` 늘 null | 1(순수) | W10 ("원래 검색어 모형") |
| V3 | `vocabSettle` 에서 `st.model !== m \|\| st.docId !== docId` 빼기(= Review RM2) | 2(순수) | W11 ("검색어가 바뀜") |
| V4 | `kickVocab` 이 `'drop'` 을 무시 | 2(배선) | W11 (배선 정규식) |
| V5 | 안내 전체 미룸(`&& m.vocab !== 'looking'` 되살림) | 3 | W12 |

각 변이는 `search-vocab-8f4.test.mjs` 로 확인(전체로 돌리면 stamp 해시 시험도 빨개지는 것은 Review 와 같음). 최종 `search.js` = 백업, `cmp` 0.

## 6. headless (한 번 — Edge 412×915 · UI ar · 새 프로필 `b8f4b/p1` · pipe · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · 캐시 끔)
- **작은 합성 PDF(`b8f4/synth.pdf` 재사용)와 주입한 지어낸 책만.** 서버를 새로 띄우지 않음 — 8000 출처 이름만 쓰고 같은 출처 요청은 모두 가로채어 스크래치에서 내줌(실제 8000 으로 간 요청 0 · `bad` 0 · `missing` 0). 149초.
- 바꾼 원어 0건(«الدوخة» → nosuchword): «لم يُعثر على «الدوخة»» + «هذا الكتاب باللغة الإنجليزية …» + `search-to-toc` 단추, 바꿈 줄 없음 — HEAD 와 같음(X 대조). 스크린샷 `b8f4b/shots/412x915-ar-nohit.png`.
- 바꿈 성공 그대로: «الربو» → zorvat(제목 1·본문 3) · 정규화 «␠␠الرَّبـو␠» · 여러 항목 «… و2 غيرها» · PDF «الربو» → asthma 2줄 → 리더 `search-hit` asthma·Asthma · `search-cur` asthma · 띠 `asthma 1 من 3` → 뒤로 그대로. 스크린샷 `b8f4b/shots/412x915-ar-swap.png`(bdi 검색어 220–244 / 원어 160–202, 상태 줄이 결과 위, 가로 넘침 0).
- 낡은 결과 G1·G2·G4·G5 그대로(늦은 응답 버려짐). G6·G7 안내 그대로. **G8 매달림(2.5초)**: 이제 글자 체계 안내 + 단추가 바로 보이고 "찾지 못했습니다"만 미뤄짐 → 풀리면 붙음. G1 대기 중·G3 도 같은 모습(안내 + 단추).
- XSS: 바꿈 줄 글자 그대로 · `img` 0 · `__xss` 미정의.
- 흉내 Gemini 요청 **0**(두 판) · 콘솔 오류 **0/0** · pageerror 0 · 4xx/5xx 0 · 외부 요청은 앱 기존 pdf.js CDN 2건뿐.
- 스크립트 `b8f4b/run.mjs`, 결과 `b8f4b/run-out.json`, 요약 `b8f4b/summ.mjs`.

## 7. 남은 것
- Review #5(최근 검색어에 원어가 남음 · 같음만 봄)은 설계 미정 — 그대로.
- G3(화면 떠남 → 돌아옴) 최종 바꿈은 Review 와 같은 하네스 한계(단어장 화면 `list()` 도 같은 문에 걸림)로 못 봄 — 코드 길은 W11 `'later'`.

## 8. 실행 · 막힌 명령
명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0). **막힌 명령 0.** 첫 시험 실행 한 번은 `b8f4b/` 폴더가 아직 없어 출력 파일을 못 만들고 실패 → `mkdir -p` 뒤 같은 명령. 서버 새로 띄움 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · 원서 인용 0.
