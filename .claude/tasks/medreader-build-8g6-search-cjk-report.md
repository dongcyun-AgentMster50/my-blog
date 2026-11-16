# Build 보고 — 8g-6 검색: CJK·한국어 조사 (F7)

지침 `.claude/tasks/medreader-build-8g6-search-cjk.md` · spec 19-1-3 §8. **커밋하지 않았다.** 8n 파일(`text/lang.js`·`segment.js`·`config.js`·i18n·`settings.js`·`ui/settings.js`·8n 테스트)과 `dev/measure-table-8i4.mjs` 는 건드리지 않았다(8n 은 이미 커밋 `0e2b1e4`).

## 0. 결론

- 세 의학책의 전각 글자(U+FF01–FF5E)·U+3000 은 **모두 0**. 라틴 검색어 경로는 **HEAD 와 하나도 다르지 않다**(세 권 × 26 검색어, 시간 칸을 뺀 측정 JSON 차 0 · headless 에서 같은 저장본의 적중 오프셋까지 같음).
- `학교` 는 "학교에"·"학교는"을 찾고 "대학교"는 찾지 않는다. `学校` 는 `我们学校很大` 안에서 찾는다. `学` 1자는 허용, `학` 1자는 짧음. 전각 `ＡＢＣ` ↔ `abc`.
- 바꾼 앱 코드는 `js/text/search.js` 하나뿐. DB·`SEARCH.VERSION`·`SEARCH_KEY`·`derivedHash`·백필·algoVersion·`PROMPT_VERSION`·i18n 은 그대로다.

## 1. 먼저 잰 것

### 1-1. 전각 글자 수 (PDF 글자, `getTextContent` 를 추출과 같은 옵션으로, pdf.js 5.6.205 — `b8g6/count-fw.mjs`)

| 책 | 쪽 | 글자 | U+FF01–FF5E | U+3000 |
|---|---|---|---|---|
| CMDT 2026 | 1,967 | 9,720,448 | **0** | **0** |
| CMDT 2021 | 5,051 | 9,404,348 | **0** | **0** |
| Harrison (ILMA 2021) | 729 | 2,907,612 | **0** | **0** |

모두 0이라 의학책의 결과 수가 바뀔 길이 없다.

### 1-2. `dev/measure-search-8g.mjs --app` 기존 검색어 26개: HEAD 대 8g-6

HEAD 판은 `git archive HEAD`(js·dev·tests/fixtures)를 `b8g6/head/` 에 풀어 **그 안의 스크립트를 그대로** 돌렸다. 8g-6 판은 저장소 스크립트를 고치지 않고 돌렸다. 비교 스크립트는 `b8g6/cmp-app.mjs` 이고, `ms*`·`time`·`memory` 칸을 빼고 모든 경로를 비교했다.

| 책 | 다른 경로 수 | agg(시제품 대비 차) HEAD / 8g-6 | 다시 찾기 쪽·적중 | 서재 범위 |
|---|---|---|---|---|
| CMDT 2026 | **0** | 전부 0 / 전부 0 | 2,433쪽 · 15,866 · 불일치 0 | 차 0 |
| CMDT 2021 | **0** | 전부 0 / 전부 0 | 3,015쪽 · 8,650 · 불일치 0 | 차 0 |
| Harrison | **0** | 전부 0 / 전부 0 | 1,567쪽 · 13,344 · 불일치 0 | 차 0 |

검색어별 앱 적중 수(끝까지, HEAD / 8g-6):

| 검색어 | CMDT 2026 | CMDT 2021 | Harrison |
|---|---|---|---|
| patients | 11281 / 11281 | 11324 / 11324 | 1937 / 1937 |
| treatment | 5800 / 5800 | 5206 / 5206 | 961 / 961 |
| the | 42139 / 42139 | 42972 / 42972 | 18273 / 18273 |
| sarcoidosis | 82 / 82 | 99 / 99 | 95 / 95 |
| pheochromocytoma | 107 / 107 | 180 / 180 | 38 / 38 |
| pseudohypoparathyroidism | 6 / 6 | 7 / 7 | 0 / 0 |
| heart failure | 129 / 129 | 575 / 575 | 138 / 138 |
| rheumatoid arthritis | 86 / 86 | 143 / 143 | 69 / 69 |
| acute kidney injury | 34 / 34 | 100 / 100 | 26 / 26 |
| beta-blocker · beta blocker · β-blocker | 249 / 249 | 192 / 192 | 27 / 27 |
| non-Hodgkin | 39 / 39 | 39 / 39 | 3 / 3 |
| IL-6 | 23 / 23 | 12 / 12 | 5 / 5 |
| MI | 276 / 276 | 144 / 144 | 12 / 12 |
| CKD | 262 / 262 | 147 / 147 | 18 / 18 |
| HbA1c | 69 / 69 | 69 / 69 | 5 / 5 |
| ACE | 193 / 193 | 181 / 181 | 24 / 24 |
| mi | 277 / 277 | 147 / 147 | 12 / 12 |
| metform | 82 / 82 | 92 / 92 | 17 / 17 |
| warfarin | 183 / 183 | 154 / 154 | 42 / 42 |
| (아랍 문자) | 0 / 0 | 0 / 0 | 0 / 0 |
| preeclampsia · pre-eclampsia | 99 / 99 | 102 / 102 | 9 / 9 |
| nonsteroidal | 22 / 22 | 71 / 71 | 47 / 47 |
| hypoparathyroidism | 66 / 66 | 95 / 95 | 2 / 2 |

`derivedHash` 는 하이픈 집합만 보므로 검색 함수 내용과 묶여 있지 않다. `SEARCH_KEY` 는 `1|d1:9e94752b` 로 HEAD 와 같다(테스트 C7b). 그래서 재색인은 일어나지 않는다.

## 2. 바꾼 것 — `js/text/search.js`

- **`fold1`**: 전각 U+FF01–FF5E 는 코드에서 0xFEE0 을 빼고, U+3000 은 공백으로 **먼저** 바꾼다. 그 뒤 기존 접기(소문자·하이픈 → 공백·악센트·따옴표)를 그대로 지난다. 그래서 `－` 는 공백이 된다. NFKC 는 쓰지 않는다. 길이 가드는 바꾼 반각 글자 기준이다. 라틴 글자에서는 HEAD 와 같은 값이다.
- **`parseQuery`**: 규칙은 **검색어 접은 꼴의 첫 글자·끝 글자**로만 정한다. 문서 언어는 보지 않는다(8m 혼합 문서).
  - 끝 글자가 한글이면 `whole:false` 다. 길이와 상관없이 뒤 경계를 열어 조사를 허용한다. 앞 경계는 그대로다.
  - 끝 글자가 한자·가나면 `whole:false` 다. 가나에는 `ー` U+30FC(Script=Common)를 포함한다.
  - 첫 글자가 한자·가나면 `open:true` 다. 이 필드는 그때만 붙으므로 라틴 검색어의 결과 객체는 HEAD 와 바이트가 같다.
  - 검색어가 한자·가나 **한 글자**면 짧음 오류를 내지 않는다. 서로게이트 한자 1자도 마찬가지다. `SEARCH.MIN_CHARS`(2)는 그대로다.
- **`findIn`**: 앞 경계 검사를 `pq.open || i === 0 || !isWordChar(h[i-1])` 로 바꿨다.
- 주석: 머리 설명·`foldText`·`parseQuery` JSDoc 을 고쳤다.
- `index.html`: stamp 만 다시 찍었다(`search.js` 해시 한 줄).
- `ui/search.js` 는 고치지 않았다. 이유는 §6 ③④에 적었다.

## 3. 테스트 — 새 `tests/search-cjk-8g6.test.mjs`(10개, 기존 테스트는 수정 0)

| | 내용 |
|---|---|
| C1 | `학교` → "학교에"·"학교는"·"학교" [0,8,27], "대학교" 아님 · `관절염` 은 "류마티스관절염" 속에서 못 찾음(한계) · `X선` 조사 · 라틴으로 끝나는 3자 이하는 낱말 전체 그대로 |
| C2 | `学校` ⊂ `我们学校很大` · `。学校的` · 가나 `がくせい`·`コーヒー`(`ー` 끝) · 한자 시작 + 한글 끝 · 한글 시작 + 한자 끝(앞 경계 검사) |
| C3 | `学`·`の`·`ア`·`𠀀` 허용 · `학`·`a`·`β`·`ㄱ`·`Ａ`·`１`·`　` 짧음 · 61자 김 |
| C4 | `ＡＢＣ` ↔ `abc` 양방향 · U+FF01·FF5E 끝 · 범위 밖 `｟｡` 그대로 · `㎎ ﬁ ½` 그대로(NFKC 아님) · `ＣＯＶＩＤ－１９` ↔ `covid-19` |
| C5 | U+3000 ↔ 공백(구·한자·한글) |
| C6 | 무작위 유니코드 1만 개(전각·반각 블록·U+3000·`㎎ ﬁ ½ ㈜ ① ｶﾞ ℡`·서로게이트)에서 길이 보존, FF01–FF5E 전부 1글자 |
| C7 | **HEAD 고정 표**: HEAD 판 `search.js` 로 뽑은 라틴·아랍·스페인어·오류 검색어 32개의 `parseQuery` 결과와 합성 글 적중 [오프셋, 길이](`b8g6/gen-latin-table.mjs`)가 deepEqual. 3자 이하 낱말 전체·4자 접두·약어 대소문자 |
| C7b | `SEARCH.VERSION` 1 · `SEARCH_KEY` HEAD 값 · 저장 레코드는 전각을 접지 않음 |
| C8 | fake-idb 엔진 `searchDoc`(한글·한자·1자·전각·짧음) · 강조 경로 `findOn → rangesFor` 가 줄 글자 '학교' 위 · `snipQueryKey` |
| C9 | 8g-7 `text/specialty.js` 는 `search.js` 를 import 하지 않고 `foldText/parseQuery/findIn` 을 부르지 않음 → 8g-6 이 그 결과를 바꿀 길이 없다. 기존 `specialty-8g7` 의 아랍어 `chapterGate` 테스트도 통과 |

- 전체 `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs` **2회: 둘 다 1523/1523**, fail 0, cancelled 0(9.4초·9.4초). 로그는 `b8g6/full-1.log`·`full-2.log`.
- `stamp-importmap` 다시 찍음 → `--check` 종료 0 · `git diff --check` 종료 0 · 새 테스트 파일 줄끝 공백 0.

## 4. 변이 (`b8g6/mutate.mjs` — 한 곳 바꿈 → 검색 테스트 5파일 → finally 에서 백업 **읽어서 쓰기**)

| 변이 | 결과 | 빨강 |
|---|---|---|
| M1 한글 뒤 경계를 다시 닫음 | 111 통과 / **3 실패** | C1·C2·C8 |
| M2 전각 치환을 `normalize('NFKC')` 로 | 111 / **3** | C4·C6·기존 S1(길이 보존) |
| M3 한자·가나 1자 허용 끄기 | 112 / **2** | C3·C8 |
| M4 한자 앞 경계 다시 검사 | 111 / **3** | C2·C3·C8 |

넷 다 복원 뒤 바이트가 같았다(`restoredSame:true`). 끝에 `cmp search.js b8g6/bak/search.js.8g6` 도 같음. 백업은 `b8g6/bak/search.js.head`(HEAD)·`search.js.8g6`.

## 5. headless (Edge, 412×915, 새 프로필 `b8g6/p1`, pipe — 디버깅 포트 없음, 가짜 키, 8000번 python 은 쓰기만)

**합성 한글·한자·가나 PDF**(`b8g6/cjk-synth.pdf`, 지은 문장, 맑은 고딕·SimHei — `make_cjk_pdf.py`; `run-cjk.mjs` → `run-cjk.json`). 문서 lang `ko`, 검색 레코드는 2쪽이다. 같은 저장본에서 HEAD `search.js`(blob 모듈)와 지금 판, 엔진을 맞댔다.

| 검색어 | HEAD | 8g-6 | 엔진 | 적중 글자 |
|---|---|---|---|---|
| 학교 | 1 | **5** | 5 | 전부 "학교"(대학교·중학교 제외) |
| 관절염 | 0 | **2** | 2 | "관절염이"·"관절염은"(합성어 속 제외) |
| 学校 | 1 | **4** | 4 | 学校 ×4 |
| 学 | 짧음 | **6** | 6 | 学 ×6 |
| コーヒー | 0 | 1 | 1 | |
| abc · covid-19 | 0 · 0 | 1 · 1 | 1 · 1 | ＡＢＣ · ＣＯＶＩＤ－１９ |
| 도서관은(4자) | 1 | 1 | 1 | 그대로 |
| 학 | 짧음 | 짧음 | 짧음 | 화면: "두 글자 이상 입력하세요" |

- 검색 화면(ko): `학교` 는 제목 1곳 + 본문 4곳이고 `<mark>` 는 "학교"다. `学校` 는 1 + 3, `学` 은 1 + 5다.
- 본문 줄을 누르면 리더 1쪽으로 간다. CSS 하이라이트 `search-hit` 5개가 모두 "학교", `search-cur` 1개, 띠는 "2/5"이고 줄 대체 클래스는 0이다(`shots/2-reader-ko-학교.png`).
- ar UI(`dir=rtl`): `学校` 는 "مواضع: 1"·"مواضع: 3"이고 `<mark>` 는 "学校"다(`shots/3-search-ar-学校.png`). 검색 화면 ko 는 `shots/1-search-ko-학교.png`.
- 콘솔 오류 0 · pageerror 0 · 4xx/5xx 0. 외부 요청은 앱의 pdf.js CDN 둘뿐이다(웹앱 CDN 허용).

**CMDT 2026**(`run-cmdt.mjs` → `run-cmdt.json`): 앱에서 가져와 1,967쪽 검색 레코드를 만드는 데 66초 걸렸다. 같은 searchText 에서 HEAD `findIn` 오프셋 = 지금 오프셋이었다(**26 검색어 전부 `sameOffsets:true`**). 엔진 끝까지 적중 수도 같고, 상한 1,000 과 `truncated` 도 정상이다. 검색 화면 `sarcoidosis` 는 67줄, 합 82곳이다. `학교`·`学校`·`学` 는 0이다(전각·CJK 0이므로 맞다). 콘솔 오류 0.
- 브라우저 수와 Node 측정이 두 곳에서 다르다(`the` 42,140 대 42,139, `HbA1c` 68 대 69). 이것은 **pdf.js 판 차이**(앱 5.4.149 · Node 5.6.205) 때문이다. 같은 판끼리 비교한 HEAD 대 8g-6 은 양쪽 모두 같다.

## 6. 한계·남은 일

1. **붙여 쓴 합성어 앞 경계**: "류마티스관절염" 속 `관절염` 은 못 찾는다. 앞 경계를 그대로 둔 설계대로다(C1 에 고정).
2. **한자 부분 일치 오탐**: 한자·가나는 경계 검사가 없어서 `学` 이 "大学" 같은 다른 낱말 속도 찾는다. 1자 검색어(`の` 등)는 적중이 많아 1,000 상한에 쉽게 닿는다.
3. **최근 검색어**: 한자·가나 1자 검색어는 최근 검색어에 남지 않는다. `ui/search.js` `recentWith` 가 `SEARCH.MIN_CHARS` 로 길이를 보기 때문이다. 검색 자체는 된다. 고치려면 한 줄(`parseQuery(q).error` 로 판정)이고 그 파일의 테스트를 함께 봐야 한다.
4. **조각 길이**: `snippetAt` 은 낱말 경계로 넓힌다. 그래서 공백 없는 한자·가나 문단은 조각이 문단 끝까지 길어진다. 화면은 줄임표로 자른다(`shots/3`). 8g-6 표 밖이라 고치지 않았다.
5. **전각과 약어 규칙**: 전각 대문자 검색어 `ＡＢＣ` 는 약어(대소문자 구분) 규칙에 들지 않고, 접은 글자로 대소문자 무시로 찾는다. 반각 약어 검색어 `ABC` 는 원문(`cs`)에서 찾으므로 전각 `ＡＢＣ` 를 찾지 못한다. 엔진 `cs` 갈래를 고쳐야 하는데 범위 밖이다.
6. **U+3000**: 화면 글자(`joinPieces`)와 검색어가 이미 `\s+` 를 공백 하나로 잇는다. 그래서 U+3000 접기는 실제 결과를 바꾸지 않는다(규칙대로 남겨 둠, C7b 에 기록).
7. **짧음 문구(i18n)**: "두 글자 이상 입력하세요"는 그대로다. 한자 1자 예외가 문구에는 없다. 지금 문구로 틀린 안내는 아니다(한글·라틴 1자일 때만 뜬다). 고칠지는 운영자가 정한다(i18n 은 다음 정리 때).
8. 실기기 확인은 Review·운영자 몫이다. 실물 한글 견본(해커스)은 쓰지 않았고 합성 PDF 를 썼다.

## 7. spec 정정

`spec.md` 19-1-3 §8 수용 기준 줄 바로 뒤에 `[정정 2026-11-16 — 8g-6 Build]` **한 줄**을 Edit 로 넣었다. 내용은 구현, 실측, 위 ②–⑤ 다.

## 8. 실행·정리

- 바꾼 파일: `apps/medreader/js/text/search.js` · `apps/medreader/index.html`(stamp) · `apps/medreader/spec.md`(한 줄) · 새 `apps/medreader/tests/search-cjk-8g6.test.mjs` · 이 보고서.
- 스크래치패드 `b8g6/`: `head/`(git archive), `count-fw.mjs`·`fw-*.json`, `app-*-head.json`·`app-*-8g6.json`·`cmp-*.txt`, `gen-latin-table.mjs`·`latin-table-head.json`, `make_cjk_pdf.py`·`cjk-synth.pdf`, `common.mjs`(b8n 사본), `run-cjk.*`·`run-cmdt.*`, `mutate.mjs`·`mut-M1..M4.json`, `bak/`, `shots/`(3장), `full-1.log`·`full-2.log`.
- 모든 실행은 `timeout` 상한 안에서 끝났다(가장 긴 것: Node 측정 한 번 약 1–2분, headless CMDT 약 2분). 프로세스 조회·디버깅 포트 접근 없음. 8000·8123·8124·8125 는 손대지 않았다. puppeteer-core 는 읽기만 했다. C: 남은 공간 133 GB.
- 막힌 명령: 없음.
