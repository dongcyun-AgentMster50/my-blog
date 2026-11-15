# 초안 — spec 에 붙여 넣을 것 (18 · 9c · 10 Plan, 2026-11-16)

> 이 파일은 **초안**이다. spec.md 는 고치지 않았다. 붙일 자리:
> (A) 17-8 뒤(17절 끝)에 새 소절 **17-9**(18 의료 사이트 북마크 + 검색어 바로가기),
> (B) 17-4 바로 뒤에 새 소절 **17-4-1**(9c 백업·옮기기 Build 설계),
> (C) 17-9 뒤에 새 소절 **17-10**(10 다른 무료 번역 서비스 — 후보 비교와 뼈대),
> (D) 19-1 표 **18**·**9c**·**10** 행 끝에 `[수정 …]` 한 줄씩, (E) 13절 표 "유료 DB"·"백업 파일" 행 끝에 한 줄씩.
> 실측: 앱은 돌리지 않았다(앱 무변). 웹 조사·CORS 사전 요청(OPTIONS, 키 없음, 임의 Origin `https://example.github.io`, 2026-11-16 한국 IP)만 했다. 출처는 각 표 아래.

---

## (D) 19-1 표 행 끝에 붙일 한 줄

**18 행** — `[수정 2026-11-16 — 18 Plan]` 설계·수용 기준은 **17-9** 가 정본이다. Build 하나(**18-1**): 북마크 목록(`links.medical`, 설정 키 — DB 무관) · 서재 아래 "의료 사이트" 접는 카드(열기) · 설정 "의료 사이트" 카드(추가·수정·삭제·순서) · 선택 동작 줄 `[찾아보기]` 하나(`{q}` 링크가 있을 때만). 자리는 **8c-2 배포 뒤**(`selbar.js`·`ui/settings.js`·`index.html`·i18n 이 8c+8f 다섯 Build 와 겹친다). 호출 0. Build 약 2시간 + Review 약 1시간.

**9c 행** — `[수정 2026-11-16 — 9c Plan]` 설계·수용 기준은 **17-4-1** 이 정본이다. 세 Build — **9c-1 내보내기**(한 파일 NDJSON + gzip, Blob 이어 붙이기) → **9c-2 가져오기**(흐름 읽기·병합만·멱등·끝나면 다시 불러오기) → **9c-3 "PDF 필요" 상태와 같은 PDF 붙이기**. 추출본(`pages`)·검색 글자·원서 문항은 **담지 않는다**(파생 — 무료·오프라인 재추출), PDF 원본은 파일 안이 아니라 책별 `.pdf` 내려받기. DB 버전 3 그대로·`algoVersion` 무관·호출 0. 자리는 **18 뒤**. Build 약 7–7.5시간 + Review 약 3.5시간(옛 추정 2~3시간은 가져오기 병합·PDF 필요 상태를 세지 않았다).

**10 행** — `[수정 2026-11-16 — 10 Plan]` **새 외부 서비스로 책 글을 보내는 일이라 어느 서비스를 넣을지(넣지 않을지)는 운영자 결정**이다(17-10 비교표 · 10-Q1). 조사 결과 무료·카드 없음·브라우저 직접 호출을 모두 만족하는 후보는 **OpenRouter `:free`·Mistral Experiment·Groq** 셋이고, 셋 다 **시리아에서 막히거나 약관상 VPN 우회가 문제**가 된다(17-10 2). DeepL Free(CORS 막힘·카드)·Azure Translator(카드)·Cerebras(체험 크레딧·결제 수단)·xAI(유료) 는 비용 0원·백엔드 없음 조건으로 **제외**. 새 서비스 없이 되는 **"같은 Gemini 키·다른 모델로 이어 쓰기"(10-G)** 도 선택지로 둔다. 운영자 결정 뒤 Build: (10-G 만이면) 1 Build 약 1.5시간 / (서비스 하나 추가면) **10-1 어댑터** → **10-2 이어 쓰기 규칙** 두 Build 약 5시간 + Review 3시간. 자리는 **9c 뒤**(`pipeline.js` 를 8f-1·8c-2 가 먼저 고친다).

---

## (E) 13절 표에 붙일 한 줄

**"유료 DB" 행 끝** — `[수정 2026-11-16 — 18 Plan]` 검색어 바로가기(`{q}` 링크, 17-9)는 **사용자가 고른 낱말(최대 6낱말·60자)만** 그 사이트 주소에 넣어 **새 탭**으로 연다(`rel="noopener noreferrer"` — 앱 주소를 넘기지 않는다). 앱은 그 사이트의 응답을 읽지 않고(fetch 0), 계정·쿠키를 다루지 않는다. 링크 주소에 `아이디:비밀번호@` 꼴(userinfo)이 있으면 저장을 거절한다 — "계정 칸 없음"을 주소 속에서도 지킨다. 그 사이트에 로그인해 있으면 검색어가 그 계정 기록에 남을 수 있음을 설정 카드에 한 줄로 알린다.

**"백업 파일" 행 끝** — `[수정 2026-11-16 — 9c Plan]` 내보내기 모듈(`backup/*`)은 **`privacy/keys` 를 import 하지 않고**(정적 검사), `settings` 는 **허용 목록** 키만 담는다(`privacy.*`·`dev.*` 없음 — 17-4-1 4). 파일에는 번역문·단어장의 문맥 문장(교과서 원문)·메모·퀴즈 기록·책 제목이 들어간다 — 내보내기 화면에 "다른 사람에게 보내지 마세요" 한 줄(기존 고지 문구를 넓힘). 파일 암호는 걸지 않는다(10-Q 와 별개로 **9c-Q1** 에서 운영자 결정).

---

## (A) 새 소절

### 17-9. 의료 사이트 북마크 + 검색어 바로가기 (18 Build 설계) `[신설 2026-11-16 — 18 Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 18-D1–D7]`

**방침**: 17절 표 "의료 웹사이트 북마크"·13절 "유료 DB"·19-1-1 N9·결정 E7 을 그대로 따른다 — **링크만**(스크래핑·응답 읽기·계정 정보 없음), 호출 0. 이 소절은 그 위에 Build 지시를 얹는다.

#### 1. 지금 코드 사실 (파일:행 — 2026-11-16 작업 트리, 8e Build 진행 중)

| 항목 | 지금 | 근거 |
|---|---|---|
| 설정 키 `links.medical` | **없다**(17절 표에만). `DEFAULTS` 는 9-3 목록이고 모르는 키는 `undefined`(조용히 만들지 않음) | `js/settings.js:26-108·154-158` |
| 북마크 화면·목록 | **없다** — 서재 상단은 `[설정][정보][🔍]`(8f-3 이 `[단어장]` 을 더할 예정) | `index.html:301-308` · 8cf 초안 4-6 |
| 선택 동작 줄 | **아직 없다** — 8c-1 이 `js/ui/selbar.js`·`js/text/select.js` 를 새로 만든다(단추 `[단어 번역]`·`[문장 번역]`·`[여기서부터 읽기]`, "단추 4개까지 한 줄 — 넷째 자리는 11a [설명]") | 8cf 초안 4-2 |
| 선택 길이 제한 | 8c-1 `clampSelection(words ≤ 6, chars ≤ 60)` 예정 | 8cf 초안 4-2 |
| 외부 링크 만드는 법 | 정보 화면 pdf.js 링크 하나 — `a.href`·`textContent`·`rel = 'noopener noreferrer'`·`target = '_blank'` | `js/main.js:305-310` |
| 설정 화면 | 카드 셋(AI · 번역 따라가기 · 목소리), 라우트 `#/settings/{tab}`(탭 값은 담아만 둠) | `index.html:650-773` · `js/router.js:74-76` |
| 9c 와의 관계 | 9c 가 `settings` 를 담으므로 `links.medical` 은 백업에 저절로 들어간다(17-4-1 4 허용 목록에 넣는다) | 17-4 표 "학습 기록" |

#### 2. 설계

**데이터** — `settings` 키 `links.medical`(DB 무관 · 9-3 에 한 줄 더함):
```
links.medical : null | [{ id, name, url }]      # null = 기본 목록(config.js LINKS.DEFAULTS)을 쓴다
```
- `null` 이면 `config.js` `LINKS.DEFAULTS` 를 읽는다 → 앱이 기본 목록을 고치면(죽은 주소 등) 손대지 않은 사용자에게 저절로 간다. 사용자가 한 번이라도 고치면 그 배열을 쓴다(기본 목록의 사본으로 시작).
- `id` 는 짧은 무작위 문자열(순서 바꾸기·지우기의 손잡이). 최대 **30개**.

**검증 — 순수 `js/text/links.js`(새, 약 90줄)**:
- `checkLink({name, url})` → `{ok, code}`: 이름 1–60자(앞뒤 공백 제거) · 주소 ≤ 2,000자 · `{q}` 를 `x` 로 바꾼 뒤 `new URL()` 이 되고 **`protocol === 'https:'`** · **`username`·`password` 가 비었다**(userinfo 거절 — 13절) · 호스트가 있다. 코드: `name-empty`·`name-long`·`url-bad`·`url-not-https`·`url-userinfo`·`url-long`·`too-many`.
- `hasQuery(url)` = `url.includes('{q}')`.
- `fillQuery(url, q)` = `{q}` 자리마다 `encodeURIComponent(q)`. `q` 는 `queryText(sel)` — NFKC·공백 하나·앞뒤 구두점 제거·**6낱말·60자**(8c-1 `clampSelection` 과 같은 수치, 넘으면 `null` → 단추 흐림).
- 순수 계층(16-A grep 대상) — `URL` 은 전역이지만 Node·브라우저 공통 내장이다. 3-2 "순수 계층은 Math·String·Array·Map 외 전역 금지" 의 예외로 `URL` 하나를 더한다(`hash.js` 의 `globalThis.crypto` 처럼 존재 검사 후). **대안**: 검증을 `ui/links.js` 로 옮겨 순수 규칙을 건드리지 않는다 — 결정 18-D6.

**기본 목록 — `config.js` `LINKS.DEFAULTS`**(결정 18-D3):

| 이름 | 주소 | 무엇 | 확인 |
|---|---|---|---|
| MedlinePlus | `https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?v%3Aproject=medlineplus&v%3Asources=medlineplus-bundle&query={q}` | 미 국립의학도서관 환자·학습용 건강 정보(무료·공개) | `[확인 2026-11-16]` "sarcoidosis" → 결과 185건, 첫 결과 "Sarcoidosis (National Library of Medicine)" |
| PubMed | `https://pubmed.ncbi.nlm.nih.gov/?term={q}` | 의학 논문 초록 검색(무료) | `[확인 2026-11-16]` "sarcoidosis" → "38,257 results" |
| Wikipedia (English) | `https://en.wikipedia.org/w/index.php?search={q}` | 일반 설명 + **왼쪽 언어 목록의 "العربية" 로 아랍어 용어** | `[확인 2026-11-16]` "sarcoidosis" → 문서로 바로 감, 언어 목록에 아랍어 «ساركويد» |
| DailyMed | `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query={q}` | 미 FDA 약 설명서(무료) | `[확인 2026-11-16]` "metformin" → "560 results" |

**추천 추가 목록**(설정 카드 `[추천 링크 추가]` 에서 골라 넣는다 — 기본에는 없다):

| 이름 | 주소 | 비고 |
|---|---|---|
| MSD Manual (Professional) | `https://www.msdmanuals.com/professional/searchresults?query={q}` | 무료·가입 없음. **`[확인 필요 — Build 가 브라우저로]`** 비대화 조회에서 검색 칸이 비어 나왔다(스크립트로 그리는 화면으로 보임). 아랍어판은 일반인용 `/ar/home/` 만 확인 |
| Radiopaedia | `https://radiopaedia.org/search?q={q}` | 영상의학 참고(무료). `[확인 필요]` 비대화 조회는 402 로 막힘 — 브라우저로 확인. 19 단계(Open-i)와 같은 갈래 |
| NCBI Bookshelf (StatPearls) | `https://www.ncbi.nlm.nih.gov/books/?term={q}` | 무료 교과서 장. `[확인 필요]` 비대화 조회는 로봇 확인 화면 |
| UpToDate (구독자) | `https://www.uptodate.com/contents/search?search={q}` | **유료 구독** — Nour 구독 뒤(N9). 검색 주소 꼴은 도서관 안내 한 곳의 예시뿐이고 Wolters Kluwer 의 연결 정책은 "검색 쪽 `…/contents/search` 로의 연결"만 안내한다 `[확인 필요 — Nour 구독 뒤 실기기]`. 로그인은 Nour 가 그 사이트에서 |

출처: MedlinePlus·PubMed·Wikipedia·DailyMed 검색 결과 쪽(2026-11-16 직접 조회) · MSD Manuals 아랍어 FAQ `https://www.msdmanuals.com/ar/home/resourcespages/faqs` · UpToDate 연결 정책 `https://www.wolterskluwer.com/en/solutions/uptodate/policies-legal/linking-policy`(본문 조회는 403 — 검색 요약만) · `search=` 예시 `https://springfield.libanswers.com/faq/338343`.

**화면**
- **서재 아래 "의료 사이트" 카드**(결정 18-D2): 저장 줄(`#storageLine`) 위에 접는 카드 하나(`<details>`, 기본 접힘, 열림 상태는 저장하지 않음). 펼치면 링크 줄(48px 이상, 이름만 — 주소는 보이지 않음). `{q}` 링크는 누르면 **검색 칸 없이 그 사이트 첫 화면**(`origin + '/'`)으로 — 검색어가 없으니까. 카드 끝 `[편집]` → `#/settings/links`.
- **설정 "의료 사이트" 카드**(`#settingsLinks`, 목소리 카드 아래): 목록(이름 · 작은 글자로 호스트 · `{q}` 이면 "검색어 바로가기" 표시) · 줄마다 `[위][아래][수정][삭제]`(삭제는 페이지 안 확인 — `confirm()` 금지, 서재 다시 추출 대화와 같은 장치) · `[링크 추가]`(이름·주소 두 칸, 주소 칸 `dir=ltr`·`inputmode=url`, 저장 시 `checkLink` 코드별 한 줄) · `[추천 링크 추가]`(위 추천 표에서 체크) · `[기본 목록으로 되돌리기]`(값을 `null` 로) · 안내 두 줄: "주소에 `{q}` 를 넣으면 본문에서 고른 낱말로 그 사이트를 검색합니다" · "아이디·비밀번호는 여기에 넣지 않습니다. 로그인은 그 사이트에서 하세요(검색어가 그 계정 기록에 남을 수 있습니다)".
- **선택 동작 줄 `[찾아보기]`**(결정 18-D1): `{q}` 링크가 **하나 이상 있을 때만** 보인다(8c-1 이 남긴 넷째 자리 — 아래 "11a 와의 자리" 참고). 누르면 선택 스냅숏 글자로 `queryText` →
  - `{q}` 링크가 하나면 바로 새 탭.
  - 둘 이상이면 줄 바로 위에 작은 목록(`role="menu"`, 항목 48px, 최대 높이 = 선택 동작 줄 위 공간, 안 스크롤) — 고르면 새 탭. 목록 맨 위 한 줄에 검색어(`dir=ltr`, `textContent`).
  - `queryText` 가 `null`(6낱말·60자 초과·빈 글자)이면 흐림 + 누르면 한 줄 안내 `links.tooLong`.
  - 낭독은 멈추지 않는다(새 탭으로 가면 Android 가 페이지를 숨김 → 6-4 "hidden → 일시정지" 규칙 그대로).
  - 열기: `<a>` 를 만들어 `href = fillQuery(...)`(검증을 다시 통과한 값만), `target="_blank"`, `rel="noopener noreferrer"`, `referrerPolicy = 'no-referrer'` 를 누르게 한다(`window.open` 대신 — 팝업 차단을 피하고 탭 안 사용자 동작으로 연다).
- **11a 와의 자리**: 8c-1 이 "단추 4개까지 한 줄"로 만든다. 18 이 넷째를 쓰면 11a [설명]은 다섯째가 된다 → 11a Plan 이 "좁으면 `[⋯]` 로 접기"를 정한다(이번엔 자리만 기록).

**i18n**(4언어 같은 키 — i18n 테스트가 짝을 본다, 약 18키): `links.card.title`·`links.card.edit`·`links.settings.title`·`links.add`·`links.addSuggested`·`links.reset`·`links.name`·`links.url`·`links.help.query`·`links.help.account`·`links.queryBadge`·`links.err.{nameEmpty,nameLong,urlBad,urlNotHttps,urlUserinfo,urlLong,tooMany}`·`links.delete.confirm`·`sel.lookup`·`links.tooLong`. 링크 **이름**은 번역하지 않는다(고유명사). ar·fr 새 문구는 `[검토 — Nour·운영자]`.

#### 3. 고치는 파일 · import 방향

| 새 파일 | 고치는 파일 |
|---|---|
| `js/text/links.js`(약 90줄) · `js/ui/links.js`(약 260줄 — 서재 카드·설정 카드·찾아보기 목록, 그리는 함수 하나를 셋이 씀) · `tests/links-18.test.mjs` | `js/config.js`(`LINKS` +25) · `js/settings.js`(`'links.medical': null` +2) · `js/ui/selbar.js`(`[찾아보기]` +30) · `js/ui/library.js`(카드 자리 +6) · `js/ui/settings.js`(카드 init·탭 `links` 로 굴리기 +10) · `index.html`(서재 카드 그릇·설정 카드·확인 대화) · `css/screens.css`(+40) · i18n 4개 |

- import: `ui/links.js` → `config`·`settings`·`text/links`·`i18n`(3-2 ui 행 그대로). `text/links.js` 는 순수(결정 18-D6). 새 `js/*.js` 두 개는 `dev/stamp-importmap.mjs` → `--check` 0.
- DB 버전·`algoVersion`·캐시 키·`PROMPT_VERSION` 전부 무변. 호출 0. 외부 요청 0(새 탭은 앱의 요청이 아니다 — 16-I "네트워크 탭" 기준 그대로).

#### 4. 수용 기준

- [ ] `[N]` `checkLink`: `https://a.b/x?q={q}` ok · `http://` → `url-not-https` · `javascript:alert(1)`·`data:` → `url-not-https` · `https://u:p@a.b/` → `url-userinfo` · `https://u@a.b/` → `url-userinfo` · 이름 0자·61자 · 주소 2,001자 · 31번째 → `too-many` · `{q}` 두 번 ok.
- [ ] `[N]` `fillQuery`: `a&b=c#d` → `a%26b%3Dc%23d` · 아랍어·한글 낱말 퍼센트 인코딩 · 결과가 다시 `checkLink` 통과 · `{q}` 없는 주소는 그대로.
- [ ] `[N]` `queryText`: 앞뒤 구두점·여러 공백 정리, 7낱말·61자 → `null`(8c-1 `clampSelection` 과 같은 경계 — 두 함수가 같은 상수를 읽는다).
- [ ] `[N]` 기본 목록: `links.medical` 이 `null` 이면 `LINKS.DEFAULTS`, 배열이면 그 배열(빈 배열 = 목록 없음, 기본으로 돌아가지 않음). 기본 목록 네 개가 전부 `checkLink` ok·`hasQuery` 참.
- [ ] `[D]` 설정 카드: 추가·수정·순서·삭제(페이지 안 확인) → 새로고침 뒤 같다. `[기본 목록으로 되돌리기]` → 값 `null`. 잘못된 주소마다 코드별 문구 한 줄, 저장 0.
- [ ] `[D]` 선택 동작 줄: `{q}` 링크 0개 → `[찾아보기]` 없음 · 1개 → 누르면 새 탭(가로챈 `a.click` 의 `href`·`rel`·`target` 확인) · 2개 이상 → 목록, 고르면 그 주소. 7낱말 선택 → 흐림 + 한 줄 안내, 새 탭 0. 낭독 중에 눌러도 발화 끊김 0(새 탭 전까지).
- [ ] `[D]` 서재 카드: 접힘 기본, 펼치면 이름만, `{q}` 링크는 `origin/` 로. `[편집]` → 설정 카드로 굴림.
- [ ] `[D]` 360×740·412×915·915×412 × 4언어: 카드·목록·설정 카드 가로 넘침 0, 단추 48px 이상, 주소 칸 `dir=ltr`, RTL 거울. `innerHTML` 새 사용 0(grep). 링크 이름·주소는 `textContent`/`href` 속성으로만.
- [ ] `[D]` 네트워크: 18 의 어떤 동작도 앱 탭에서 요청 0건(16-I).
- [ ] `[M]` Nour GT 7: 길게 눌러 낱말 → `[찾아보기]` → MedlinePlus/PubMed 결과 화면이 새 탭으로 뜨고, 뒤로 가기/탭 전환으로 MedReader 에 돌아오면 그 자리·낭독 상태(멈춤)가 그대로.
- [ ] `[M]` UpToDate(구독 뒤): 추천 목록의 UpToDate 로 찾기 → 로그인한 상태면 결과, 아니면 로그인 화면(앱은 아무것도 넘기지 않는다).
- 변이: `checkLink` 의 userinfo 검사 지우기 → `u:p@` 시험 빨강 · `fillQuery` 의 `encodeURIComponent` 를 `encodeURI` 로 → `&`·`#` 시험 빨강 · `rel` 에서 `noreferrer` 빼기 → `[D]` 속성 시험 빨강 · `null` 일 때 기본 목록 대신 빈 목록 → 기본 시험 빨강.

#### 5. headless 시험 방법
8c-1 하네스와 같은 꼴(Edge, 새 프로필·새 포트, `try { … } finally { await browser.close() }`, 결과 JSON 은 stdout, 10분 상한, 8000번 python 정적 서버). `HTMLAnchorElement.prototype.click` 을 감싸 `href`·`rel`·`target` 을 기록하고 실제 이동은 막는다(외부 사이트 요청 0). 선택은 `Selection.setBaseAndExtent`. `page.on('request')` 로 앱 탭 요청 수를 센다.

#### 6. 결정 표 — 권장 (운영자 위임: 권장안으로 진행)

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 18-D1 | `{q}` 링크를 부르는 자리 | (가) **선택 동작 줄 `[찾아보기]` 하나 — 링크 하나면 바로, 둘 이상이면 작은 목록** · (나) 링크마다 단추 `[검색: 이름]`(E7 원문) · (다) 단어 시트(8f-2) 안 한 줄 | **(가)** — 8c-1 의 단추 한 줄(4개)을 링크 수만큼 늘릴 수 없다(360px). E7 의 뜻("선택 동작 줄에서 그 사이트로")은 그대로. (다)는 시트를 거쳐 두 번 누름 — 나중에 더해도 된다 |
| 18-D2 | 북마크 목록을 여는 자리 | (가) **서재 아래 접는 카드(열기) + 설정 카드(편집)** · (나) 새 화면 `#/links` + 서재 상단 단추 · (다) 설정 카드만 | **(가)** — 서재 상단은 8f-3 뒤 단추 넷(412 에서 빠듯). 그리는 함수는 하나라 장치가 둘이 되지 않는다. 라우트·`main.js` 무변 |
| 18-D3 | 기본 목록 | (가) **무료·공개 4개(MedlinePlus·PubMed·Wikipedia·DailyMed — 검색 주소를 2026-11-16 확인한 것만) + 추천 추가 목록(MSD·Radiopaedia·Bookshelf·UpToDate — `[확인 필요]`)** · (나) 빈 목록 + 추천 추가만 · (다) 빈 목록 | **(가)** — 첫날부터 `[찾아보기]` 가 보여 기능이 묻히지 않는다. 확인 못 한 주소는 기본에 넣지 않는다. 유료(UpToDate)는 기본에 두지 않는다(13절) |
| 18-D4 | 검색어 | (가) **선택 글자 그대로 정리(≤ 6낱말·60자)** · (나) 8f 의 `expandWord` 낱말 하나 | **(가)** — "rheumatoid arthritis" 처럼 두 낱말 용어가 흔하다. 하이픈 결합은 8c-1 스냅숏이 이미 처리한다 `[가정 — 8c-1 Build 확인]` |
| 18-D5 | `{q}` 없는 링크를 서재 카드에서 누르면 / `{q}` 링크를 서재에서 누르면 | (가) **주소 그대로 / 그 사이트 첫 화면(`origin/`)** · (나) `{q}` 링크는 서재 카드에 안 보임 | **(가)** — 같은 목록이 두 곳에서 같게 보인다 |
| 18-D6 | `URL` 을 쓰는 검증의 계층 | (가) **순수 `text/links.js` + 3-2 예외에 `URL` 하나 더함(존재 검사)** · (나) `ui/links.js` 안에 두고 순수 규칙 무변 | **(가)** — 검증이 `node --test` 로 전수 시험된다(13절 경계). `URL` 은 Node 24·Chrome 공통 내장이라 순수성(입력 → 출력)을 해치지 않는다. 16-A grep 에 `URL` 허용 한 줄 |
| 18-D7 | 순서 | (가) **8c-2 배포 뒤 · 9c 앞**(19-1-1 4 그대로) · (나) 8c-1 바로 뒤(8f 앞) | **(가)** — `selbar.js`·`ui/settings.js`·`library.js`·`index.html`·i18n 이 8f-2·8f-3·8c-2 와 겹친다. 북마크만 먼저(선택 줄 없이)는 E7 의 핵심(검색어)이 빠진다 |

**운영자에게 물을 것** — 없음(호출 0·키 0·외부 전송은 사용자가 누른 새 탭뿐 — 13절 E7 승인 범위). 단 **UpToDate 주소 꼴**은 Nour 구독 뒤 실기기로 확정(`[M]`).

#### 7. 크기 · 시간 `[추정]`
Build 약 2시간(순수 0.3 · UI 1.2 · 시험 0.5) · Review 약 1시간. 위험 낮음(호출·DB 무관, 새 탭 하나). 옛 추정 1시간은 편집 화면(추가·수정·순서·확인 대화)을 작게 셌다.

#### 8. 마지막 실기기 점검 묶음 (18 몫)
- [ ] `[M]` GT 7: `[찾아보기]` → 새 탭 → 돌아오기(위 4).
- [ ] `[M]` 기본 링크 넷 + 추천 넷이 폰 Chrome 에서 결과 화면으로 가는가(특히 MSD·Radiopaedia·Bookshelf — `[확인 필요]` 셋, 결과가 비면 그 항목을 추천 목록에서 뺀다).
- [ ] `[M]` 메신저 안 브라우저로 열었을 때 새 탭 동작(가이드 몫 — "Chrome 으로 여세요").
- [ ] `[M]` UpToDate 구독 뒤 `search=` 꼴.

---

## (B) 새 소절

#### 17-4-1. 9c 백업·옮기기 Build 설계 `[신설 2026-11-16 — 9c Plan]` `[운영자 위임 2026-11-15: 권장안으로 진행 — 결정 표 9c-D1–D13]`

**방침**: 17-4 의 경계(키 절대 없음 · 앱은 기기에 저장만 · 업로드·동기화 없음 · 호출 0)를 그대로 지킨다. 17-4 가 미뤄 둔 것(파일 형식·`docId` 맞추기·충돌·메모리)을 여기서 정한다. 17-4 표의 "추출본 — 선택"은 **담지 않는다**로 바꾼다(9c-D2 — 이유는 아래 2).

##### 1. 지금 코드 사실 (파일:행)

| 항목 | 지금 | 근거 |
|---|---|---|
| DB | `medreader` 버전 **3**, 스토어 14개(`documents`·`blobs`·`pages`·`progress`·`questions`·`attempts`·`mistakes`·`cards`·`aiCache`·`usage`·`settings`·`annotations`·`sections`·`searchText`) | `js/db.js:15-24·31-100` |
| 내보내기·가져오기 | **없다**(`createObjectURL` 은 PDF 열기·무음 오디오·표 그림뿐, `<a download>` 0) | grep `createObjectURL` |
| 순회 | `db.iterate(store, {index, query, direction}, onRecord)` — 커서, 배열로 모으지 않음 | `js/db.js:391-410` |
| 묶어 쓰기 | `db.putAll(store, values)` 한 트랜잭션 · `db.withTx(names, mode, fn)` | `js/db.js:265-304·366-372` |
| 키 | `sessionStorage`/`localStorage['medreader.key.{provider}']` — **DB 에 없다**. `settings` 에도 없다 | `js/privacy/keys.js:43` · `js/settings.js:15` |
| 설정 | `settings` 스토어 `{key, value}`, 앱 시작 때 한 번 읽어 메모리 맵 | `js/settings.js:162-189` |
| 문서 정체 | `fileHash` = 표본 해시(앞·뒤 1MB + 가운데 16 × 64KB) + 쪽수 2차 비교(`identityFor` — 같은 해시·다른 쪽수면 `해시:n쪽수` 변형) | `js/hash.js:163-218` · `js/ui/library.js:82-96` |
| 같은 PDF 다시 가져오기 | `fileHash` 가 같으면 **기존 레코드 재사용**(`touchDuplicate`) — **이때 `blobs` 를 쓰지 않는다**. 지금은 늘 blob 이 있으니 문제가 없었다 | `js/ui/library.js:427-445` |
| PDF 없는 문서 열기 | `openDoc` 이 blob 이 없으면 **`null`** — 리더는 조용히 빈다(안내 없음) | `js/ui/library.js:818-836` · `js/ui/reader.js:1607-1608` |
| 캐시 키 | `kind|target|docId|hashHex(normalize(text))[|extra]`, `hashHex` 접두 `s256:`(https) / `fnv:`(그 밖) — **키에 `docId` 가 들어 있다** | `js/hash.js:87-93·122-125` · `js/ai/cache.js:9·38-40` |
| 캐시 값 | `{key, docId, kind, targetLang, result(번역문), provider, model, promptVersion, repaired, domain, sizeBytes, createdAt, hits}` — **원문 문장은 없다**(해시뿐) | `js/ai/pipeline.js:394-400` · `js/ai/cache.js:98-120` |
| 캐시 상한 | 크기 합을 처음 한 번 세고 넣고 뺄 때 고친다 — DB 를 직접 쓰면 수가 어긋난다(서재 삭제와 같은 경우 — 넘었다고 보일 때만 다시 센다) | `js/ai/cache.js:17-22·70-80` |
| 파생 스토어 | `DERIVED_STORES = pages·questions·sections·searchText` + documents 의 `extraction`·`sectionIndex*` (`derivedDocReset`) | `js/db.js:458-496` |
| 퀴즈 문항 id | `{docId}:{sectionId}:q{n}`(원서) — `attempts.items[].questionId`·`mistakes.questionId` 가 이것을 가리킨다 | 9-2 표 · `js/db.js:466-470` 주석 |
| 진도 키 | `progress` = `[docId, sectionId]` | `js/db.js:44-48` |
| 단어장 | 8f-1 뒤 `cards` `kind:'term'`(문서를 지워도 남음), CSV 가져오기 규칙 `importPlan`(id → `updated` 새로운 쪽, 없으면 `term`+`target_lang`) | 8cf 초안 4-4·4-6 |
| 다시 불러오기 문구 | `err.dbUpgraded` 배너 + [다시 불러오기] 장치가 있다 | `js/main.js:165-166` |

##### 2. 무엇을 담나

| 묶음 | 스토어·필드 | 담나 | 이유 |
|---|---|---|---|
| 문서 메타 | `documents` 의 **사용자 몫**: `id, title, fileName, size, pageCount, fileHash, addedAt, lastOpenedAt, lastPage, lastLineId, lang, langSource, langGuess, domain, readStats, outline, pageLabels, scan, columnsHint` | **항상** | 진도·원문 언어·문체·쪽 라벨. `extraction`·`sectionIndex*` 는 **빼고** 가져올 때 `derivedDocReset()` 값으로(추출본을 담지 않으므로 "다 뽑았다"가 거짓이 된다) |
| 학습 기록 | `progress`·`attempts`·`mistakes`·`cards`(단어장·문장 카드)·`annotations`(필기·11b 저장 요약) | **항상** | 사용자 기록 — 다시 만들 수 없다 |
| 원서 문항 | `questions` 중 `source:'ai'` 만 | **항상**(지금 0건) | 원서 문항(`book`)은 쪽 글자에서 다시 만든다(파생). AI 문항은 한도를 쓴 결과 |
| 사용량 | `usage` | **항상** | 작다(하루 한 줄). 오늘 상한·사용량 화면 이어짐 |
| 설정 | `settings` 의 **허용 목록**(아래 4) | 기본 켬(가져올 때 끌 수 있음) | 기기마다 다른 키(목소리 URI 등)는 뺀다 |
| 번역 캐시 | `aiCache` 전부(`translate`·`term`·나중 `summarize`·`explain`) | **기본 켬**(끌 수 있음) | 잃으면 이미 쓴 한도를 다시 쓴다(17-4 "왜"). 원문 1,000자당 약 10.6KB — 한 권 다 읽으면 약 100MB `[추정]`, gzip 뒤 약 1/3 `[추정 — 아랍어 UTF-8]` |
| 추출본 | `pages` | **담지 않는다** | 파생이고 **무료·오프라인**으로 다시 만든다(폰 재추출 CMDT 2026 약 4–6분, 세 권 10–14분 — 4-13-8 8i Review 추정). `algoVersion` 이 자주 오른다(지금까지 10회 이상) — 담아 봐야 판이 다르면 버린다. 7000쪽 84MB 를 파일·메모리에서 아낀다 |
| 검색 글자 | `searchText` | 담지 않는다 | 파생(9-2 표 그대로) — 추출이 함께 만든다 |
| `sections` | — | 담지 않는다 | 파생(P2, 지금 비어 있음) |
| PDF 원본 | `blobs` | **파일 안에는 없다** — 대신 설정 카드의 책 목록에서 책별 **`[PDF 내려받기]`**(원본 Blob 을 그대로 `<a download>` — 이름은 `fileName`) | base64 로 JSON 에 넣으면 +33%·메모리 두 벌. 사용자가 PDF 를 이미 가지고 있는 경우가 대부분(가져온 파일) — 없을 때만 따로 받는다 |
| API 키 | — | **절대 없음** | 내보내기 코드가 키 저장소를 **import 하지도 않는다**(정적 검사) |

##### 3. 파일 형식 — 한 파일 NDJSON(+gzip)

```
medreader-backup-YYYYMMDD-HHmm.jsonl.gz        (CompressionStream 이 없으면 .jsonl)
1행  {"t":"head","format":1,"app":"medreader","db":3,"algo":<algoVersion>,"createdAt":"ISO",
      "hash":"s256"|"fnv","include":{"cache":true,"settings":true},
      "counts":{"documents":3,"progress":120,…,"aiCache":41203},"docs":[{"id","title","fileHash","pageCount"}…]}
2행~ {"t":"rec","s":"documents","v":{…}}
     {"t":"rec","s":"aiCache","v":{…}}     … 스토어 순서: documents → settings → usage → progress → attempts →
                                              mistakes → questions → cards → annotations → aiCache
끝행 {"t":"end","counts":{…}}              ← 이 줄이 없으면 "끝까지 쓰지 못한 파일"(잘린 파일) — 가져오기는 미리보기에서 알린다
```
- **한 줄 = 레코드 하나** → 쓸 때도 읽을 때도 한 번에 한 줄만 메모리에 둔다. JSON 한 덩어리(`JSON.parse` 한 번)는 100MB 파일에서 문자열 + 객체 트리가 수백 MB 가 되어 폰에서 죽을 수 있다(17-4 `[가정]`).
- `format` 은 파일 꼴의 판(1). 가져오기는 `format > 지원` 이면 거절("새 판 앱에서 만든 파일 — 앱을 새로 고친 뒤 다시"), 낮으면 사다리로 올린다. `db`·`algo` 는 진단용(가져오기 판정에 쓰지 않는다 — 추출본을 담지 않으므로).
- `hash` 가 가져오는 기기와 다르면(https ↔ LAN http) 캐시 키가 맞지 않는다 — 미리보기에 한 줄 경고, 캐시는 그래도 넣는다(해가 없다).
- **gzip**(결정 9c-D1): `CompressionStream('gzip')` 이 있으면 쓴다(Chrome 80+). 아랍어 번역은 UTF-8 에서 2바이트라 압축률이 영어보다 낮다 `[추정 — Build 가 합성 캐시로 잰다]`.
- **두 파일로 나누지 않는다**(17-4 "묶음별로 나눠" 고려) — 흐름 읽기·쓰기로 메모리 문제가 풀리고, 파일 하나가 옮기기 쉽다(메신저 문서 한 번). 대신 **캐시 끄기** 선택으로 작은 파일을 만들 수 있다.

##### 4. 설정 허용 목록 (`BACKUP.SETTINGS_KEYS` — `config.js`)

담는다: `ui.lang`·`ui.theme`·`reader.*`(전부)·`tts.rate`·`tts.unit`·`tts.repeat.count`·`tts.wakeLock`·`tts.readCitations`·`tts.scriptSwitch`·`tts.mediaKeys`·`tts.autoSummarize`·`voice.enabled`·`voice.cmdLang`·`voice.sayErrors`·`readalong.*`·`search.recent`·`ai.provider`·`ai.model`·`ai.translationLang`·`ai.summaryLangs`·`ai.useOnDevice`·`ai.dailyCap`·`ai.warnAt`·`ai.cacheLimitMB`·`ai.maxReqChars`·`privacy.piiCheck`·`vocab.lastExportAt`·`links.medical`(18).

담지 않는다(기기 몫·개인정보 몫): `tts.voice.*`·`tts.accent.*`(그 기기의 음성 URI) · `voice.tag`(그 기기에서 통한 인식 태그) · `voice.noticeAt`(마이크 고지 — 새 기기에서 다시 본다) · `privacy.consentedAt`(**AI 전송 동의는 새 기기에서 다시 받는다** — 9c-D5) · `privacy.rememberKey`(키 저장 위치 — 키를 옮기지 않으므로) · `onboarding.done`(새 기기는 온보딩을 본다 — 짧다) · `dev.debug` · `ai.proxyUrl` · `backup.*`.

허용 목록은 **명시 목록**이다(접두 와일드카드 `reader.*` 는 `DEFAULTS` 의 키에서 펼친 목록으로 만든다). 새 설정 키가 생기면 자동으로 들어가지 않는다 — 시험이 "DEFAULTS 의 모든 키가 담음/안 담음 둘 중 하나에 적혀 있다"를 본다(빠지면 빨강).

##### 5. 가져오기 — 병합만, 지우지 않음, 멱등

**문서 맞추기**(결정 9c-D3): 파일의 문서마다
1. 이 기기에 같은 `id` 가 있다 → 그 문서(같은 기기에 다시 가져옴).
2. 같은 `fileHash` 가 있다(`findByFileHash` — 변형 키 `해시:n쪽수` 포함) → **그 기기의 `id` 로 바꿔 쓴다**(`remap[oldId] = newId`).
3. 없다 → **원래 `id` 그대로** 새 문서(`blobs` 없음 = "PDF 필요", `derivedDocReset()` 값).

**`docId` 바꿔 쓰기**(2번일 때만 — 순수 `remapRecord(store, rec, remap)`):
- `aiCache.key` 의 셋째 칸(`kind|target|docId|해시…` 를 `|` 로 나눔 — 해시·extra 에 `|` 가 없다: `s256:`·`fnv:…:길이`, `w=낱말`은 `normalizeTerm` 이 `|` 를 지움) + `v.docId`.
- `progress` 키 `[docId, sectionId]` · `questions.id`·`attempts.items[].questionId`·`mistakes.questionId` 의 앞 `{docId}:` · `attempts.docId`·`mistakes.docId`·`cards.docId`·`annotations.docId`.

**스토어별 충돌 규칙**(같은 레코드가 이미 있을 때 — 순수 `mergeRecord(store, mine, theirs)`):

| 스토어 | 규칙 |
|---|---|
| `documents`(있음) | 기기 레코드를 **`db.patch` 로 필드만**: `lastPage`·`lastLineId` 는 `lastOpenedAt` 이 더 새로운 쪽 · `lang`·`langSource`·`langGuess` 는 파일이 `langSource:'user'` 이고 기기가 아니면 파일 · `domain` 은 기기에 없으면 파일 · `readStats` 는 `pages` 가 큰 쪽 · `outline`·`pageLabels`·`scan` 은 기기에 없으면 파일. `extraction`·`blobs` 는 건드리지 않는다 |
| `settings` | 허용 목록 키만, **파일 값으로 덮는다**(가져오기 화면에서 [설정도 가져오기] 끄면 0) |
| `usage` | 같은 날이면 **필드별 큰 값**(`calls`·`byKind.*`·`byProvider.*`·… — 같은 파일을 두 번 넣어도 같다), 없으면 추가 |
| `progress` | `updatedAt` 새로운 쪽 |
| `attempts` | 없으면 추가(있으면 그대로 — id 가 uuid) |
| `mistakes` | 없으면 추가, 있으면 `resolvedAt` 이 있는 쪽 |
| `questions`(ai) | 없으면 추가 |
| `cards` | `kind:'term'` 은 8f-1 `importPlan` 과 **같은 규칙**(id → `updatedAt` 새로운 쪽, 없으면 `term`+`targetLang`) — 함수를 다시 만들지 않고 `text/vocab.js` 것을 부른다. 문장 카드는 id 로 `updatedAt` 새로운 쪽. **term 은 문서가 없어도 넣는다**(`docTitle` 사본 — 8cf 초안 13) |
| `annotations` | `updatedAt` 새로운 쪽 |
| `aiCache` | **이미 있으면 그대로**(같은 키 = 같은 입력의 번역 — 어느 쪽도 맞다). 없으면 추가 |

**한도·순서**:
- 쓰기는 **500줄씩 한 트랜잭션**(`withTx`) — 7000쪽 추출과 같은 이유(트랜잭션 비용)이고, 중간에 끊겨도 앞 묶음은 남는다. 모든 규칙이 멱등이라 **같은 파일로 다시 가져오면 이어진다**(끊긴 가져오기 = 처음부터 다시 — 이미 들어간 것은 그대로).
- `documents` 를 먼저 다 처리해 `remap` 표를 만든 뒤 나머지(파일 순서가 그렇게 쓰여 있다).
- 캐시 상한: 미리보기에서 "들어올 캐시 약 n MB · 상한 m MB" — 넘치면 "넘는 만큼은 오래된 번역부터 정리됩니다" 한 줄(결정 9c-D10). 가져온 뒤 **다시 불러오기**가 캐시 크기를 다시 세게 한다(아래).
- **끝나면 다시 불러오기**(결정 9c-D7): 설정 메모리 맵·파이프라인 상태·readalong 메모리·검색 캐시·캐시 크기 수가 전부 옛 값이다 → "가져오기 끝 — 새로 불러옵니다" + `[다시 불러오기]`(`location.reload()`). 가져오는 동안 리더·검색은 열지 않는다(설정 화면 안에서 진행 막대, 화면을 떠나면 확인).

**미리보기**(가져오기 전 — 머리 줄과 문서 목록만 읽는다, 본문을 훑지 않는다): "책 n권(이 기기에 이미 있음 k · 새로 생김 m — PDF 필요) · 단어장 n · 퀴즈 기록 n · 필기 n · 번역 n개(약 x MB) · 설정 ○/✗ · 만든 날" + 잘린 파일이면(끝 줄 없음) "파일이 끝까지 쓰이지 않았습니다 — 있는 데까지 가져옵니다" + `[가져오기]`(확인) · `[취소]`. 개수는 머리 줄 `counts` — 실제 끝 줄이 다르면 끝에 한 줄로 알린다.

**메모리**(결정 9c-D6):
- 내보내기: 스토어를 커서로 읽어 **1,000줄마다 문자열 하나**를 만들고 `blob = new Blob([blob, chunk])` 로 이어 붙인다 — 앞 Blob 은 복사하지 않고 참조하며, 브라우저가 Blob 내용을 렌더러 힙 밖(필요하면 디스크)에 둔다 `[가정 — Chrome Blob 저장소, 실기기 확인]`. JS 힙에는 한 덩어리(약 1MB)만 남는다. 끝에 `blob.stream().pipeThrough(new CompressionStream('gzip'))` → `new Response(…).blob()` → `<a download>`.
- 가져오기: `file.stream()` →(이름이 `.gz` 이거나 첫 두 바이트가 `1f 8b` 면) `DecompressionStream('gzip')` → `TextDecoderStream` → 줄 나누기(순수 `lineSplitter` — 조각 경계에 걸친 줄을 이어 붙임) → `JSON.parse` 한 줄씩 → 500줄 묶음 쓰기. 메모리 = 한 묶음.
- 수용 기준이 headless 에서 힙 최댓값을 잰다(아래 7).

##### 6. 화면

- **설정 "백업·옮기기" 카드**(`#settingsBackup` — AI 카드 위, 라우트 `#/settings/backup`):
  - 한 줄 상태: "마지막 백업: n일 전"(`backup.lastExportAt` — 새 설정 키, 9-3 에 한 줄) 또는 "아직 백업하지 않았습니다". **30일을 넘으면** 그 줄만 주의 색(배너·알림은 없다 — 9c-D8).
  - `[내보내기]` + `☑ 번역 캐시 포함(약 n MB)`(기본 켬 — n 은 `cache` 크기 합, 8c-2 `cache.stats()` 재사용) → 진행 막대(스토어 이름·n/총) → 내려받기. 고지 한 줄: "이 파일에는 번역·단어장(교과서 문장 포함)·필기·퀴즈 기록이 들어 있습니다. API 키는 들어 있지 않습니다. 다른 사람에게 보내지 마세요."
  - `[가져오기]`(파일 고르기 — `accept` 는 비워 둔다: Android 파일 고르기가 `.gz`·`.jsonl` 을 흐리게 할 수 있다 `[가정 — M]`) → 미리보기 → `☑ 설정도 가져오기`(기본 켬) → `[가져오기]` → 진행 → 다시 불러오기.
  - **책별 PDF**: 접는 목록 "PDF 원본 따로 받기" — 책마다 `[PDF 내려받기]`(blob 있을 때만, 크기 표시).
  - 안내 한 줄: "새 휴대폰에서: 이 파일을 가져온 뒤, 같은 PDF 를 서재에서 다시 가져오면 진도와 번역이 이어집니다."
- **서재 "PDF 필요" 상태**(9c-3): blob 이 없는 문서 카드 — 진행 줄 대신 "PDF 필요" 배지 + `[계속]` 자리에 **`[PDF 가져오기]`**(파일 고르기). 고른 파일의 `fileIdentityHash`·쪽수가 그 문서와 맞으면(`identityFor` 가 `reuse`) blob 을 넣고 추출 시작 · 맞지 않으면 "이 책의 PDF 가 아닙니다(다른 판일 수 있습니다)" + 새 문서로 가져올지 묻지 않는다(서재 [가져오기]로 하라고 한 줄). 리더·검색·퀴즈 입구에서 PDF 없는 문서를 열면 리더 대신 서재로 돌아가 같은 배지에 초점(조용한 빈 화면을 없앤다).
- **서재 가져오기 재사용 경로 고침**(9c-3): `fileHash` 가 맞는 기존 문서에 blob 이 없으면 **그 자리에서 blob 을 넣는다**(`library.js:430-435` 의 `touchDuplicate` 뒤 `db.get('blobs')` 확인 → 없으면 `put`). 그래서 서재 [가져오기]로 같은 PDF 를 넣어도 이어진다.
- 서재 저장 줄 옆 글자 링크 `[백업]` → `#/settings/backup`(상단 단추를 늘리지 않는다).

**i18n**(약 32키): `backup.title`·`backup.last`·`backup.never`·`backup.export`·`backup.includeCache`·`backup.notice`·`backup.progress.*`(스토어 이름 10)·`backup.import`·`backup.preview.*`(6)·`backup.withSettings`·`backup.truncated`·`backup.newer`·`backup.hashMismatch`·`backup.done`·`backup.reload`·`backup.pdf.*`(3)·`library.needPdf`·`library.needPdf.import`·`library.needPdf.wrong`·`backup.howto`. ar·fr `[검토]`.

##### 7. 고치는 파일 · import 방향 · 수용 기준

| Build | 새 파일 | 고치는 파일 |
|---|---|---|
| **9c-1 내보내기** | `js/text/backup.js`(순수 약 220줄 — `docForBackup`·`settingsForBackup`·`headLine`·`recLine`·`endLine`·`lineSplitter`·`remapRecord`·`mergeRecord`·`readHead`) · `js/backup/export.js`(서비스 약 160줄) · `tests/backup-9c.test.mjs` | `js/config.js`(`BACKUP` 상수 — 형식 판·묶음 크기·허용 목록 +45) · `js/settings.js`(`backup.lastExportAt`) · `js/ui/backup.js`(새 — 카드 내보내기 몫 약 180줄) · `js/ui/settings.js`(카드 init +8) · `index.html`(카드) · `css/screens.css` · i18n 4개(약 14키) |
| **9c-2 가져오기** | `js/backup/import.js`(서비스 약 260줄) · `tests/backup-import-9c.test.mjs`(fake-idb) | `js/ui/backup.js`(미리보기·진행·다시 불러오기 +200) · i18n 4개(약 12키) |
| **9c-3 PDF 필요** | — | `js/ui/library.js`(배지·`[PDF 가져오기]`·재사용 경로 blob +60) · `js/ui/reader.js`·`js/ui/search.js`·`js/ui/quiz.js`(blob 없음 → 서재로, 각 +4) · `css/screens.css` · i18n 4개(약 6키) |

- **import 방향**(3-2 에 한 줄): `backup/*` 행 = `search/*`·`vocab/*` 행과 같다 — `config`·`text/*`·`db`·`hash`(+ `vocab/store` 는 쓰지 않고 `text/vocab` 의 순수 `importPlan` 만). **`privacy/*`·`ai/*`·`ui/*` import 0**(정적 시험 — 키 저장소를 볼 길이 없다). `ui/backup.js` 가 `<a download>`·파일 고르기·`location.reload()` 를 맡는다.
- `db.js` 는 **고치지 않는다**(`withTx`·`iterate`·`findByFileHash`·`patch` 로 된다). DB 버전 3 그대로·`algoVersion`·캐시 키·`PROMPT_VERSION` 무변. 새 `js/*.js` 넷 → `stamp-importmap --check` 0.

**9c-1 수용 기준**
- [ ] `[N]` `docForBackup`: 사용자 몫 필드만, `extraction`·`sectionIndex*`·알 수 없는 필드 없음.
- [ ] `[N]` `settingsForBackup`: `DEFAULTS` 의 **모든 키**가 담음/안 담음 목록 중 하나에 있다(새 키가 빠지면 빨강). `privacy.consentedAt`·`privacy.rememberKey`·`tts.voice.*`·`voice.tag`·`dev.debug` 없음.
- [ ] `[N]` 줄 꼴: 머리 줄 → rec 줄 → 끝 줄, 줄마다 `JSON.parse` 가 되고 줄 안에 날 줄바꿈 없음(값 속 `\n` 은 이스케이프), 스토어 순서 고정.
- [ ] `[N]` **키 0건**: 가짜 키(형식만 맞춘 문자열 `AQ.` 꼴·`AIza` 꼴·`sk-` 꼴)를 가짜 `sessionStorage`·`localStorage`·설정 값에까지 심은 상태에서 내보낸 글자에 그 문자열·`REDACT_PATTERNS` 일치 0(17-4 뼈대).
- [ ] `[N]` 정적: `js/backup/*`·`js/text/backup.js` 에 `privacy/`·`ai/`·`ui/` import 0, `localStorage`·`sessionStorage` 낱말 0(grep).
- [ ] `[D]` 합성 캐시 150MB(가짜 번역 15만 개)로 내보내기 — 파일이 내려받아지고(가로챈 Blob), `performance.memory.usedJSHeapSize` 최댓값이 시작 대비 **+64MB 이하** `[기준 — Build 가 재서 조정 가능, 근거 남김]`, 압축률 기록(stdout).
- [ ] `[D]` 캐시 끄기 → 파일에 `aiCache` 줄 0. `backup.lastExportAt` 갱신, 카드 "마지막 백업: 오늘".
- [ ] `[D]` 360×740·412×915 × 4언어: 카드 가로 넘침 0, 단추 48px, 진행 막대 `aria-live`.
- 변이: 허용 목록에 `privacy.consentedAt` 넣기 → 빨강 · `docForBackup` 이 `extraction` 을 남기게 → 빨강 · 줄 대신 `JSON.stringify(전체)` 로 → 힙 기준 빨강 · `export.js` 에 `privacy/keys` import 추가 → 정적 시험 빨강.

**9c-2 수용 기준**
- [ ] `[N]` `lineSplitter`: 조각 경계가 줄 가운데·UTF-8 다바이트 글자 가운데(디코더 몫)·`\r\n` 에 걸려도 같은 줄들. 마지막 줄에 줄바꿈이 없어도 나온다.
- [ ] `[N]` `remapRecord`: `aiCache` 키 셋째 칸만 바뀌고 해시·extra(`w=…`)는 그대로, `progress` 키·`questions.id`·`attempts.items[].questionId`·`mistakes.questionId` 앞 `{docId}:` 만 바뀜, 다른 문서 레코드는 무변.
- [ ] `[N]` `mergeRecord` 표 전부(스토어마다 있음/없음·새/옛) + **멱등**: 같은 파일 두 번 = 한 번(전 스토어 깊은 비교).
- [ ] `[N]` (fake-idb 종단) 빈 DB 에 가져오기 → 문서 3(blob 없음·`extraction` 처음 값), 기록·캐시 개수 = 머리 줄 `counts`. 같은 `fileHash` 의 다른 `id` 문서가 있는 DB → 그 `id` 로 바뀌어 들어가고 새 문서 0.
- [ ] `[N]` 잘린 파일(끝 줄 없음, 중간 줄 반쪽) → 반쪽 줄 하나만 버리고 나머지 들어감 + `truncated` 표시. `format: 2` → 거절 코드. gzip·평문 둘 다.
- [ ] `[D]` **종단 — 두 프로필**(17-4 뼈대): 프로필 A 에서 책 가져오기 → 흉내 Gemini 로 3쪽 낭독 동반 번역 → 단어 2개 저장 → 진도 p.3 → 내보내기. **빈 프로필 B** 에서 가져오기 → 다시 불러오기 → 서재에 "PDF 필요" → 같은 PDF `[PDF 가져오기]` → 열면 **p.3·같은 줄**, 그 3쪽 낭독 동반 번역 **요청 0건**(가로채기 셈), 단어장 2개, 오늘 사용량 그대로.
- [ ] `[D]` 기기 B 에 이미 그 책이 다른 `id` 로 있을 때(B 에서 먼저 가져옴) → 가져오기 뒤 문서 1개, 번역 요청 0건(키 바꿔 쓰기 확인).
- [ ] `[D]` 합성 150MB 파일 가져오기 — 힙 최댓값 시작 대비 +64MB 이하, 끝까지 들어감, 진행 막대가 끝까지 감.
- [ ] `[D]` 가져오는 중 화면을 떠나려 하면 확인, 끊고 다시 같은 파일 → 개수 같음(멱등).
- 변이: `aiCache` 충돌 규칙을 "파일이 이김"으로 → 멱등 시험은 통과하지만 `hits`·`createdAt` 시험 빨강(기기 값 보존) · `usage` 를 합으로 → 두 번 가져오기 시험 빨강 · `remap` 을 키에서 빼고 `v.docId` 만 → 기기 B 시험의 요청 0건 빨강 · 다시 불러오기 생략 → (D) 캐시 크기 시험 빨강.

**9c-3 수용 기준**
- [ ] `[D]` blob 없는 문서 카드: 배지 "PDF 필요"·`[PDF 가져오기]`, `[계속]` 없음. 맞는 PDF → 추출 시작·리더 열림. 다른 PDF → 한 줄 안내·문서 무변.
- [ ] `[D]` 서재 [가져오기]로 같은 PDF → blob 이 생기고 이어짐(재사용 경로).
- [ ] `[D]` 검색·퀴즈·리더 주소로 blob 없는 문서를 바로 열면 서재로 와서 그 카드에 초점(빈 리더 0).
- 변이: 재사용 경로의 blob 검사 지우기 → 서재 [가져오기] 시험 빨강.

**모든 Build 공통**: `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과 · `stamp-importmap --check` 0 · `innerHTML` 새 사용 0 · 콘솔 오류 0 · 무료 티어 숫자 0.

**headless 시험 방법**: 8cf 하네스 꼴(Edge, **프로필 둘** — A·B 각각 새 사용자 데이터 폴더·새 포트, 각 `try { … } finally { await browser.close() }`, 결과는 stdout JSON, 10분 상한). 흉내 Gemini 는 요청 가로채기(OPTIONS 204 + ACAO). 내려받기는 `URL.createObjectURL` 을 감싸 Blob 을 잡아 **파일로 쓰지 않고** B 의 `input[type=file]` 에 `uploadFile` 로 넘기기 위해 스크래치패드 `p18/` 에만 임시 저장. 힙은 `performance.memory`(Edge `--enable-precise-memory-info`). 실물 PDF 문장은 결과에 넣지 않는다. 합성 캐시는 지어낸 글자.

##### 8. 결정 표 — 권장 (운영자 위임: 권장안으로 진행)

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 9c-D1 | 파일 형식 | (가) **한 파일 NDJSON + gzip(없으면 평문)** · (나) JSON 한 덩어리 · (다) 묶음별 여러 파일 · (라) ZIP | **(가)** — 줄 단위로 쓰고 읽어 폰 메모리가 한 묶음뿐. (나)는 100MB 에서 `JSON.parse` 가 죽을 수 있다. (다)는 옮기기·짝 맞추기가 번거롭다. (라)는 라이브러리(외부) 또는 직접 구현이 크다 |
| 9c-D2 | 추출본·PDF | (가) **추출본 안 담음(재추출 — 무료·오프라인) · PDF 는 책별 `.pdf` 따로 내려받기** · (나) 17-4 원안(추출본 선택·PDF 선택 — 파일 안) | **(가)** — 17-4 원안의 "`algoVersion` 같으면 재사용" 은 판이 자주 올라 이득이 작고, PDF 를 JSON 에 넣으면 base64 +33%·메모리 두 벌. 재추출은 폰 수 분 — 한 번 |
| 9c-D3 | `docId` | (가) **원래 `id` 유지, 같은 `fileHash` 가 있으면 그 `id` 로 바꿔 쓰기** · (나) 늘 새 `id` 로 바꿔 쓰기 · (다) 늘 원래 `id`(같은 책 두 레코드 가능) | **(가)** — 새 기기(대부분)에서는 바꿔 쓸 일이 없어 가장 단순하고, 이미 있는 책과는 하나로 합친다. (다)는 `fileHash` unique 인덱스와 부딪쳐 실패한다 |
| 9c-D4 | 충돌 | (가) **병합만 — 지우지 않음, 스토어별 규칙, 멱등** · (나) "덮어쓰기(이 기기 지우고 복원)" 모드 추가 | **(가)** — 실수로 지우는 길이 없다. 깨끗이 옮기려면 새 기기가 이미 빈 상태다. (나)는 되돌릴 수 없는 단추를 하나 더 만든다 |
| 9c-D5 | 기기 몫·동의 | (가) **허용 목록 — 목소리 URI·인식 태그·마이크 고지·AI 전송 동의·키 기억 여부는 옮기지 않음** · (나) 설정 전부 | **(가)** — 음성 URI 는 기기마다 다르다(8k). 동의는 새 기기에서 한 번 더 받는 쪽이 보수적이다(개인정보 쪽으로 더 조심 — 권장 가능) |
| 9c-D6 | 메모리 | (가) **내보내기 = 1,000줄 Blob 이어 붙이기, 가져오기 = 흐름 + 500줄 트랜잭션** · (나) 배열에 모아 한 번에 | **(가)** — 힙에 한 묶음만. 수용 기준이 힙을 잰다 |
| 9c-D7 | 가져온 뒤 | (가) **다시 불러오기 필수** · (나) 메모리 상태를 하나하나 다시 읽기 | **(가)** — 설정 맵·파이프라인·readalong·검색 캐시·캐시 크기 다섯 곳을 고치는 대신 한 줄. 이미 `err.dbUpgraded` 같은 장치가 있다 |
| 9c-D8 | 백업 알림 | (가) **설정 카드 한 줄 "마지막 백업 n일 전" — 30일 넘으면 주의 색만** · (나) 서재 배너 · (다) 없음 | **(가)** — 화면을 가리지 않는다. 배너는 매일 쓰는 사용자에게 소음 |
| 9c-D9 | PDF 필요 | (가) **서재 배지 + `[PDF 가져오기]`(해시·쪽수 확인) + 재사용 경로 blob 넣기 + 빈 리더 대신 서재로** · (나) 서재 [가져오기]만 | **(가)** — 지금 코드는 blob 없는 문서를 조용히 빈 화면으로 연다(1 표). 같은 장치(`identityFor`)를 다시 쓴다 |
| 9c-D10 | 캐시 상한을 넘는 가져오기 | (가) **넣고 오래된 순 정리(미리보기에 한 줄)** · (나) 상한을 자동으로 올림 · (다) 넘으면 거절 | **(가)** — 7-5 규칙 그대로. 상한은 사용자가 설정에서 올린다 |
| 9c-D11 | 나누기·순서 | (가) **9c-1 내보내기 → 9c-2 가져오기 → 9c-3 PDF 필요** · (나) 한 Build | **(가)** — 각 2–3시간. 9c-1 만 배포해도 "기기 밖 사본"이 생긴다(가져오기 전에 백업을 시작할 수 있다 — 형식이 고정되므로) |
| 9c-D12 | 단어장 term | (가) **문서 없이도 넣음 · 8f `importPlan` 재사용** · (나) 문서가 있을 때만 | **(가)** — 8f 의 "문서를 지워도 남는다"와 같은 뜻 |
| 9c-D13 | 오늘 사용량 | (가) **날짜별 필드 최댓값** · (나) 합 · (다) 옮기지 않음 | **(가)** — 멱등. 같은 키(같은 무료 한도)를 두 기기에서 같은 날 썼다면 최댓값이 실제보다 작을 수 있으나, 상한은 사용자의 안전장치라 작게 세는 쪽의 해가 작다 |

**운영자에게 물을 것** (개인정보·외부 전송 — 권장하지 않음)

| # | 무엇 | 지금 설계 | 바꾸면 |
|---|---|---|---|
| 9c-Q1 | 백업 파일 **암호(비밀번호)** | 걸지 않는다 — 13절 원칙("저장소를 읽는 사람은 어차피…")과 같은 판단, 대신 고지 한 줄 | 비밀번호로 AES-GCM(`crypto.subtle`, PBKDF2) — 메신저로 옮길 때 안전. 대신 비밀번호를 잊으면 복구 불가, 화면·시험이 늘어난다(약 +1.5시간) |
| 9c-Q2 | **번역 캐시 기본 켬** | 켬 — 이미 쓴 한도를 지킨다(17-4) | 끄면 파일이 작고(번역문 없음) 개인 기록이 줄지만, 새 기기에서 같은 번역에 한도를 다시 쓴다 |
| 9c-Q3 | 문맥 문장(교과서 원문) | 단어장 `context` 를 그대로 담는다(17-7-4 CSV 와 같은 판단) | 빼면 단어장의 문맥이 사라진다 — 8cf-Q2 와 같은 질문이라 함께 정하면 된다 |

##### 9. 크기 · 시간 `[추정]`

| Build | 크기 | Build | Review | 위험 |
|---|---|---|---|---|
| 9c-1 내보내기 | 중간 | 2.5h | 1h | 낮음~중간 — 메모리(Blob 이어 붙이기)는 실기기 `[M]` |
| 9c-2 가져오기 | 중간~큼 | 3h | 1.5h | 중간 — 병합 규칙·`docId` 바꿔 쓰기·흐름 읽기 |
| 9c-3 PDF 필요 | 작음~중간 | 1.5–2h | 1h | 낮음 — `library.js` 를 8f-2·8f-3 이 먼저 고친다(순서로 피함) |
| **합** | | **7–7.5h** | **3.5h** | |

##### 10. 마지막 실기기 점검 묶음 (9c 몫)
- [ ] `[M]` Nour GT 7(또는 운영자 Fold 7): 실제 데이터로 `[내보내기]` — 걸린 시간·파일 크기, 앱이 죽지 않는가(캐시 큰 기기에서).
- [ ] `[M]` 내려받은 파일이 Android "다운로드" 에 보이고, WhatsApp/텔레그램 **문서**로 보내 다른 기기에서 받을 수 있는가(메신저가 `.gz` 를 막거나 이름을 바꾸는지).
- [ ] `[M]` 다른 기기(운영자 Fold 7 의 새 Chrome 프로필 또는 새 휴대폰)에서 `[가져오기]` — Android 파일 고르기에서 그 파일을 고를 수 있는가(`accept` 비움), 미리보기 개수, 끝까지 들어가는가, 다시 불러오기.
- [ ] `[M]` 같은 PDF 를 `[PDF 가져오기]` → 같은 쪽·같은 줄, 읽은 쪽 낭독 동반 번역이 **즉시**(요청 없이) 나오는가.
- [ ] `[M]` `[PDF 내려받기]` 로 받은 PDF 가 원본과 같은가(크기).
- [ ] `[M]` 메신저 안 브라우저에서는 내려받기가 막힐 수 있음 — 가이드 "Chrome 으로 여세요"(17-7-4 와 같은 안내).

---

## (C) 새 소절

### 17-10. 다른 무료 번역 서비스 이어 쓰기 — 후보 비교와 뼈대 (10 Plan) `[신설 2026-11-16 — 10 Plan]` `[결정 대기 — 서비스 선택은 운영자(10-Q1)]`

**방침**: 17절 머리 원칙 5(한도가 바닥나면 사용자가 넣어 둔 다른 무료 프로바이더 키로 이어 쓰기 · 같은 프로바이더 키 돌려쓰기 금지) · 18절 "비용 0원 — 최소 1년"(무료 티어가 있을 때만) · 8-2·8-3 그대로. **새 서비스를 넣는 것 자체가 책 글을 새 회사로 보내는 일**이라 이 소절은 **비교만** 하고 고르지 않는다.

#### 1. 지금 코드 사실 (파일:행)

| 항목 | 지금 | 근거 |
|---|---|---|
| 어댑터 | **gemini 하나** — `ADAPTERS = { gemini }`. 8-2 표의 `openai-compat` 계열은 설계만 | `js/ai/provider.js:29-32` · `js/ai/adapters/`(gemini.js 뿐) |
| 어댑터 꼴 | 선언 객체 — `endpoint(model)`(키를 받지 않음)·`verifyEndpoint`·`modelsEndpoint`·`headers(key)`·`bodyBuilder`·`responseParser`·`errorParser`·`modelsParser` | `js/ai/adapters/gemini.js:45-150` |
| 키 저장 | 프로바이더별 이름 `medreader.key.{provider}` — **여러 프로바이더 키를 이미 따로 둘 수 있다** | `js/privacy/keys.js:43` · `js/config.js:621` |
| 파이프라인 | 상태 기계 **한 벌**(`exhausted`·`region`·`cooldown` 이 프로바이더를 가리지 않는다). 보낼 때 `getSetting('ai.provider')` 하나와 `getKey()` 하나 | `js/ai/pipeline.js:142-236·287-289` · `js/ui/controls.js:119` |
| 프로바이더 바꾸기 | 설정 AI 탭 `<select id="aiProvider">` 가 `ADAPTERS` 를 돈다(지금 항목 하나) → `ai.provider` 저장, `configChanged('provider')` 가 `region`·`model`·`no-key` 를 푼다 | `js/ui/settings.js:936-946·1769-1771` · `js/ai/pipeline.js:577-587` |
| 모델 설정 | `ai.model` **한 개**(프로바이더별 아님) | `js/settings.js:95` |
| 캐시 키 | 프로바이더·모델 **없음** → 서비스를 바꿔도 받은 번역이 그대로 맞는다 | `js/ai/cache.js:9-15` |
| 사용량 | `usage.byProvider` 가 이미 있다 | `js/ai/provider.js:250-283` |
| 지우개 | `REDACT_PATTERNS` 에 `Bearer \S+`·`sk-…` 가 이미 있다(openai-compat 키가 오류에 섞여도) | `js/config.js:756-761` |
| JSON 강제 | gemini 는 `responseSchema`. openai-compat 는 `response_format: {type:'json_object'}` 뿐(스키마 강제 없음 — 모델마다 지원 다름) → `jsonrepair` + `checkTranslation`(밀림·개수 검증)이 받는다 | `js/ai/adapters/gemini.js:107-125` · 8-2 표 |
| 동의 문구 | "AI 기능은 글을 **외부 API** 로 보냅니다 … 무료 등급은 보낸 것을 모델 개선에 쓸 수 있습니다" — 회사 이름 없음 | `js/i18n/ko.js:50-51` |

#### 2. 후보 비교 (2026-11-16 조사 — 웹 문서 + 키 없는 CORS 사전 요청)

`CORS` 열은 이 PC(한국)에서 `OPTIONS …/chat/completions`(임의 Origin, `Authorization`·`Content-Type` 요청)에 대한 응답이다. **시리아에서의 결과는 아니다.** "한도 환산"은 호출 1회 ≈ 낭독 번역 약 5,900자(17절 머리 2) ≈ CMDT 2026 약 1.3쪽.

| 후보 | 무료 구간 | 가입 · 결제 등록 | 브라우저 직접 호출 | 시리아·VPN | 보낸 글의 학습·보관 | 번역 품질(아랍어) | 판정 |
|---|---|---|---|---|---|---|---|
| **(G) 같은 Gemini 키 · 다른 모델** — 새 서비스 아님 | 한도는 **프로젝트 단위·모델마다 다르다**(공식: "Rate limits are applied per project, not per API key" · "Limits vary depending on the specific model") — 모델마다 **독립된 일일 한도인지는 문서에 명시 없음** `[확인 필요 — 실키]` | 없음(지금 키) | ○(8-3 실측) | 시리아는 지원 지역 **아님**(공식 목록 — 요르단·레바논은 있음). 지금처럼 VPN 켬으로 됨(16-D0) | 무료 등급은 개선에 쓰임(17-6) — **지금과 같음** | 같은 계열 — flash-lite → flash 면 같거나 낫다 `[가정]` | **후보** — 새 회사·새 가입 0. 단 "한도를 늘리는" 방식이 17절 머리 원칙 5 의 새 해석이라 운영자 확인 |
| **OpenRouter `:free`** | `:free` 모델 **분당 20 · 하루 50**(평생 구매 크레딧 10 미만). 10 이상 **구매**하면 하루 1,000 — 구매는 비용이라 해당 없음. 하루 50 ≈ 낭독 번역 약 29.5만 자 ≈ CMDT 2026 약 65쪽 | 계정(이메일 등) `[가정 — 가입 화면 미확인]` · 하루 50 경로는 결제 등록 없음 `[가정]` | ○ — OPTIONS **204**, `access-control-allow-origin: *`, `HTTP-Referer`·`X-OpenRouter-Title` 허용 | **약관 5.7**: 모델 제공자가 지역을 막을 수 있고 그런 모델은 쓸 수 없으며 **"virtual private networks and proxies" 로 우회 금지**, 위반은 즉시 정지 사유. 시리아 명시 목록은 찾지 못함 | OpenRouter 자체는 기본 저장·학습 안 함(설정에서 켤 때만). **제공자에 따라 학습할 수 있다** — 무료 모델 제공자는 개별 확인 필요. "ZDR only" 설정으로 거를 수 있음 | 무료 모델(Llama·Qwen·gpt-oss 등) — 모델마다 다름 `[M — Nour 판단]` | 후보 — **VPN 약관이 Nour 사용 방식과 부딪친다** |
| **Mistral (Experiment)** | 무료 실험 요금제. 한도 수치 `[확인 필요 — 공식 도움말 직접 열람 실패(404)]` | **휴대폰 번호 인증**(번호 하나에 요금제 하나), 카드 없음(공식 도움말 — 검색 요약) | ○ — OPTIONS **200**, `access-control-allow-origin: *` | 약관: 포괄 제재 지역 사용자 아님을 보증(제3자 요약, 시리아 예시) `[확인 필요 — legal.mistral.ai 원문]`. 제3자 소식: API 를 사업자 고객으로 한정 `[확인 필요]` | **Experiment 요청은 학습에 쓰일 수 있음**(공식 도움말 — 검색 요약), 관리 콘솔에서 끌 수 있다는 안내도 있음 — 공식 글끼리 엇갈림 | Mistral 계열 — 아랍어 `[M]` | 후보 — **전화번호(개인정보)·학습·제재 보증** 셋을 운영자가 판단 |
| **Groq** | 무료 플랜 — 조직·모델별 한도, 넘으면 429(과금 없음 — 공식 커뮤니티 답변). 수치는 계정 화면에서 `[확인 필요]` | 카드 요구 여부 출처 갈림 `[확인 필요]` | ○ — OPTIONS **204**, `access-control-allow-origin: *` | **시리아는 제한 지역**(Groq 커뮤니티 답변 — 그레이터 차이나·러시아·시리아·이란·북한·쿠바, IP 차단) → Nour 는 VPN 으로만 = 우회 | `[확인 필요]` | gpt-oss·qwen 계열 `[M]` | 사실상 **어렵다**(지역 제한 명시) |
| Cerebras | 무료 **체험** $5 · 30일 만료, 결제 수단 등록 뒤 지급이라는 출처 | 결제 수단 `[출처 갈림]` | ○ — OPTIONS 200, ACAO `*` | `[확인 안 함]` | 보관 안 함(제3자 요약) | — | **제외** — 체험·결제 수단(비용 0원·1년 조건) |
| DeepL API Free | 월 50만 자 | 카드 필요(제3자 안내 — 공식 확인 못 함) | **✗** — 공식 문서: 브라우저 호출은 CORS 로 403, 백엔드 경유 권장. OPTIONS 204 이지만 `access-control-allow-origin` **없음** | — | — | 번역 전용(품질 좋음 `[가정]`) | **제외** — 백엔드 없음(1절)·카드 |
| Azure AI Translator (F0) | 월 200만 자 | Azure 무료 계정 = 전화 + **신용/직불카드**(공식 FAQ 요약) | `[확인 안 함]` | `[확인 안 함]` | — | 번역 전용 | **제외** — 카드 |
| xAI Grok | 무료 크레딧 종료·유료만이라는 출처들(데이터 공유 프로그램은 $5 이상 지출 뒤) | 결제 | `[확인 안 함]` | `[확인 안 함]` | 데이터 공유 = 학습 | — | **제외** — 유료(18절 "무료 티어가 있을 때만") |

출처:
- Gemini 한도·지역: `https://aistudio.google.com/docs/rate-limits` · `https://aistudio.google.com/docs/available-regions`(2026-11-16 열람)
- OpenRouter 한도: `https://openrouter.ai/docs/api-reference/limits` · 약관 5.7: `https://openrouter.ai/terms` · 데이터: `https://openrouter.ai/docs/guides/privacy/data-collection` · 헤더: `https://openrouter.ai/docs/quickstart`
- Mistral: 도움말 `https://help.mistral.ai/en/articles/455206-how-can-i-try-the-api-for-free-with-the-experiment-plan`·`…/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training`(검색 요약 — 직접 열람 404) · 약관 `https://legal.mistral.ai/terms/commercial-terms-of-service` · 제재 보증 요약 `https://conductatlas.com/platform/mistral-ai/mistral-ai-terms-of-service/user-warrants-not-in-sanctioned-country/`
- Groq: `https://community.groq.com/t/what-geographic-regions-does-groqcloud-serve/833` · `https://community.groq.com/t/do-i-get-charged-for-anything-on-the-groq-free-plan/832` · `https://console.groq.com/docs/rate-limits`
- Cerebras: `https://inference-docs.cerebras.ai/support/rate-limits` · `https://costbench.com/software/llm-api-providers/cerebras-inference/free-plan/`
- DeepL: `https://developers.deepl.com/docs/best-practices/cors-requests` · `https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-Free`
- Azure: `https://azure.microsoft.com/pricing/details/translator/` · `https://azure-int.microsoft.com/en-us/free/free-account-faq`
- xAI: `https://agentdeals.dev/vendor/xai` · `https://radar.apideck.com/blog/how-to-get-your-grok-xai-api-key`(둘 다 제3자 — 공식 확인 못 함)
- CORS 열: 이 PC 에서 `curl -X OPTIONS`(키 없음) 2026-11-16.

**읽는 법(운영자용 요약)**: 무료·카드 없음·브라우저 직접 호출 셋을 다 만족하는 새 서비스는 **OpenRouter·Mistral·Groq**. 그런데 Nour 는 시리아에서 늘 VPN 을 쓴다 — **Groq 는 시리아를 막고, OpenRouter 는 약관에서 VPN 우회를 금지**하고, **Mistral 은 제재 지역이 아님을 보증하게 하고 전화번호를 받는다.** 새 서비스 없이 되는 길은 **(G) 같은 키·다른 모델**뿐이다. 또 하나의 길은 17-6 B(운영자 유료 키 — 무료 한도가 아니라 비용)다.

#### 3. 이어 쓰는 규칙 — 어떤 후보를 고르든 같은 뼈대

**설정**(DB 무관 — `settings` 키, 9-3 에 더함):
```
ai.chain      : ['gemini'] | ['gemini', 'openrouter'] …    # 순서 = 먼저 쓰는 것. 첫째가 지금의 ai.provider
ai.model.{id} : ''                                          # 프로바이더별 모델(지금 ai.model 은 gemini 몫으로 읽음 — 옮김 없이)
ai.switch     : 'ask' | 'auto'                              # 10-Q2
```
- 키는 지금처럼 `medreader.key.{id}` 따로(13절 그대로). 프로바이더마다 [검증]·[시험 번역]·"이 기기에 기억".

**언제 넘어가나**: 지금 프로바이더가 `exhausted`(429) 또는 `region` 이 되고, 사슬에 **키가 있는 다음** 프로바이더가 있을 때.
- **`ask`(묻기)**: 띠·상태 바의 그 안내에 단추 하나 `[{다음 서비스 이름}(으)로 계속]` → 누르면 **그날(로컬 자정까지)** 다음 프로바이더로. 처음 한 번은 "책 문장이 {회사}로 보내집니다" 확인 카드(프로바이더별 동의 `privacy.consent.{id}`).
- **`auto`(자동)**: 묻지 않고 넘어가며 상태 바에 한 줄 "{이름}으로 이어서 번역합니다" (프로바이더별 동의는 설정에서 키를 넣을 때 받는다).
- 넘어가지 **않는** 것: `no-key`(설정으로), `capped`(사용자 상한 — **전체 합**, 10-D2), `cooldown`(5xx·네트워크 — 잠깐이다), `offline`, `model`.
- 다음 날(로컬 자정) 또는 사용자 [다시 시도] 면 첫째로 돌아간다(첫째의 `exhausted` until 이 지났을 때).

**상태 기계**(`pipeline.js`): `base` 를 **프로바이더별 맵**으로(`exhausted`·`region`·`cooldown` 이 프로바이더에 붙는다). `current()` 는 "지금 쓰는 프로바이더"의 상태. 8f-1 의 `job` 일반화와 8c-2 의 `onWarn` 위에 얹는다(같은 파일 — 순서로 피함). 7-6 의 "자동 재시도 0" 은 그대로 — 넘어간 뒤 **같은 청크를 다시 보내는 것은 첫 전송**이다(보내지 않은 것 = `blocked` 였으므로 7-6 경계와 같다). `failed` 는 넘어가도 그대로(사용자 [다시 시도]만).

**어댑터 `js/ai/adapters/openai-compat.js`**(새, 약 150줄): `makeOpenAICompat({id, label, base, extraHeaders, keyPattern, defaultModel, staticModels, modelFilter})` → 8-2 의 선언 객체. `bodyBuilder` = `messages[{system},{user}]` + `response_format: {type:'json_object'}`(모델이 거절하면 400 → 한 번 빼고 다시가 아니라 `BAD_REQUEST` 로 — 자동 재시도 0 원칙. 모델 목록 필터에서 JSON 모드 지원 모델만) · `responseParser` = `choices[0].message.content` + `usage.prompt_tokens/completion_tokens` · `errorParser` = 429 → `RATE_LIMIT`, 401 → `AUTH`, 402 → `RATE_LIMIT`(크레딧 없음 — 무료에서는 한도와 같은 뜻 `[가정]`), 403 + 지역·국가 낱말 → `REGION`(실물 원문으로 확정 — 16-D0 과 같은 방법), 404 → `MODEL_UNAVAILABLE`, 5xx → `SERVER`. `verifyEndpoint` = `GET {base}/models`(OpenRouter 는 키 확인 `GET /key` `[확인 필요]`).
- 프롬프트·검증은 바꾸지 않는다(프로바이더는 프롬프트를 모른다 — 8-1). 번역 스키마 강제가 없으므로 `checkTranslation`(개수·밀림·숫자)이 품질 그물이다.
- `keyPattern` 은 **경고만**(8-4). `AI_KEY_PATTERNS`·`KEY_SHAPES`·`REDACT_PATTERNS` 에 그 키 꼴(예: OpenRouter `sk-or-v1-…` `[확인 필요]`)을 더한다 — 지우개는 넓게.

**(G) 같은 키·다른 모델**(서비스를 넣지 않을 때의 작은 판): `ai.chain` 대신 `ai.modelChain = ['gemini-3.5-flash-lite', 'gemini-3.5-flash']`(목록에서 고른 순서). 첫 모델이 429 면 `ask`/`auto` 규칙 그대로 둘째 모델로. 어댑터·키·동의 무변, `pipeline.js`·설정 카드·i18n 만. 단 모델마다 한도가 독립인지 문서에 없다 — 둘째 모델도 바로 429 면 그날은 거기서 끝(자동 반복 0).

#### 4. 나누기 · 크기 · 시간 `[추정 — 운영자 결정에 따라]`

| 경우 | Build | 크기 | Build 시간 | Review |
|---|---|---|---|---|
| (G) 만 | **10-G** 모델 사슬 | 작음~중간 | 1.5h | 1h |
| 서비스 하나 추가 | **10-1** openai-compat 어댑터 + 프로바이더별 키·모델·[검증]·[시험 번역]·동의 (넘어가기 없음 — 설정에서 손으로 바꿈) | 중간 | 2.5h | 1.5h |
| | **10-2** 사슬·넘어가기(`ask`/`auto`)·프로바이더별 상태 | 중간 | 2.5h | 1.5h |
| 둘 다 | 10-G 를 10-2 안에 | | +0.5h | |

고치는 파일(10-1·10-2): `js/ai/adapters/openai-compat.js`(새) · `js/ai/provider.js`(`ADAPTERS` +3) · `js/config.js`(`DEFAULT_MODEL`·`STATIC_MODELS`·키 꼴 +20) · `js/ai/pipeline.js`(프로바이더별 상태 +80) · `js/ui/controls.js`(`getKey(id)` +5) · `js/ui/settings.js`(사슬 순서·프로바이더별 키 줄 +120) · `js/ui/trband.js`(`exhausted`·`region` 안내에 `[…로 계속]` +20) · `js/settings.js`(키 3) · `index.html`·i18n 4개(약 16키)·`tests/provider-chain-10.test.mjs`. 자리: **9c 뒤**(`pipeline.js` 는 8f-1·8c-2 가, `ui/settings.js` 는 8c-2·18·9c 가 먼저 고친다).

#### 5. 수용 기준 (뼈대 — 운영자 결정 뒤 단계 Plan 이 다듬는다)
- [ ] `[N]` openai-compat `bodyBuilder`·`responseParser`·`errorParser`(429·401·402·403 지역·404·5xx·200 빈 내용) 전수, `endpoint` 에 키 없음(`assertNoKeyInUrl`), 오류 메시지에서 키 지움.
- [ ] `[N]` 사슬: A 429 → `ask` 면 상태 `exhausted` + `next:'B'`, 누르면 B 로 같은 청크 1회(자동 재시도 0 — A 로 다시 0회) · `auto` 면 바로 B · B 키 없음이면 넘어가지 않음 · `capped`·`cooldown` 에서 넘어가지 않음 · 다음 날 A 로 · `failed` 는 넘어가도 그대로.
- [ ] `[N]` 캐시: A 가 받은 번역을 B 로 바꾼 뒤에도 0호출(키에 프로바이더 없음 — 7-5). 값의 `provider` 는 받은 쪽.
- [ ] `[N]` 사용량: `byProvider.A`·`byProvider.B` 따로, 상한은 **합**(10-D2).
- [ ] `[D]` 흉내 두 서비스(가로채기 — OPTIONS 204 + ACAO): A 429 → 띠 `[B 로 계속]` → 첫 누름에 동의 카드 → 이어서 번역, 원문 낭독 끊김 0.
- [ ] `[D]` 네트워크 탭: 사슬에 있어도 **쓰는 프로바이더 하나에만** 요청(16-I "선택한 AI 프로바이더 외 요청 없음"을 "지금 쓰는 프로바이더"로 고쳐 읽는다).
- [ ] `[M]` Nour 기기에서 새 서비스 [검증]·[시험 번역] — **VPN 켬/끔 각각**(16-D0 과 같은 방법), 아랍어 시험 번역 10문장을 Nour 가 읽고 "쓸 만한가" 한 줄.
- 변이: 사슬이 `cooldown` 에서도 넘어가게 → 빨강 · 넘어간 뒤 A 로 같은 청크를 다시 보내게 → 자동 재시도 0 시험 빨강 · 상한을 프로바이더별로 → 합 시험 빨강.

#### 6. 결정 표

**권장 (운영자가 서비스를 고른 뒤에 적용 — 위임 범위)**

| # | 무엇 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| 10-D1 | 어댑터 꼴 | (가) **`openai-compat` 하나를 매개변수로(8-2 원안)** · (나) 서비스마다 파일 | **(가)** — OpenRouter·Mistral·Groq 가 같은 `/chat/completions` 꼴 |
| 10-D2 | `ai.dailyCap`(17절 표 `[미정]`) | (가) **전체 합 — 지금 코드 그대로** · (나) 프로바이더별 | **(가)** — 상한은 "하루에 이만큼만" 이라는 사용자의 안전장치다. 서비스별 무료 한도는 429 가 알려 준다. 코드 무변(`overCap` 이 `row.calls` 합) |
| 10-D3 | 넘어가는 조건 | (가) **`exhausted`·`region` 만** · (나) `cooldown` 도 | **(가)** — 5xx·네트워크는 잠깐이고, 넘어가면 짧은 장애마다 글이 다른 회사로 간다 |
| 10-D4 | 모델 설정 | (가) **`ai.model.{id}` 프로바이더별, 옛 `ai.model` 은 gemini 몫으로 읽음** · (나) 하나 | **(가)** — 모델 이름은 프로바이더마다 다르다. 옛 키를 옮기지 않아 되돌림 쉬움 |
| 10-D5 | 나누기 | (가) **10-1 어댑터(손으로 바꾸기) → 10-2 사슬** · (나) 한 Build | **(가)** — 10-1 만으로 Nour 기기 [검증]·[시험 번역](CORS·지역·품질)을 먼저 본다. 안 되면 10-2 를 하지 않는다 |
| 10-D6 | 실기기 확인 시점 | (가) **10-1 배포 직후 Nour 기기(16-D0 방식)** · (나) 마지막 묶음 | **(가)** — 이 단계의 존재 이유(지역·품질)가 실기기에서만 답이 난다. 지침 "실기기를 기다리지 않는다" 와 부딪치지 않게 10-2 Build 는 기다리지 않고 진행하되 **배포**만 그 결과 뒤 |

**운영자에게 물을 것** (외부 전송·개인정보·무료 한도 원칙 — 권장하지 않음)

| # | 무엇 | 선택지 | Plan 이 보는 것(사실만) |
|---|---|---|---|
| **10-Q1** | **어느 서비스를 넣나** | (가) 넣지 않음(지금대로 Gemini 하나 — 한도가 차면 다음 날) · (나) **(G) 같은 Gemini 키·다른 모델** · (다) OpenRouter `:free` · (라) Mistral Experiment · (마) Groq · (바) 17-6 B 운영자 유료 키 · (나)+(다)/(라) 조합 | (나)는 새 회사·새 가입·새 동의 0. (다)는 하루 50회·약관상 VPN 우회 금지. (라)는 Nour 전화번호를 새 회사에 주고 학습 사용 가능·제재 지역 보증. (마)는 시리아 제한 명시. (바)는 비용. **8c-2 사용량 화면으로 Nour 가 실제로 한도에 닿는지 먼저 본 뒤 정해도 된다** — 지금까지 Nour 의 429 보고는 없다 `[인계 문서 기준]` |
| 10-Q2 | 넘어갈 때 묻나 | `ask`(그날 첫 번 한 번 누름 + 서비스별 첫 동의) · `auto`(묻지 않음) | `auto` 는 사용자가 모르는 사이 글이 다른 회사로 간다. `ask` 는 화면을 안 보는 낭독(9a·9b) 중에는 멈춘 채 기다린다 — 원문 낭독은 계속된다 |
| 10-Q3 | VPN 과 약관 | — | OpenRouter 약관은 VPN·프록시로 지역 제한을 피하는 것을 금지한다. Gemini 도 시리아는 지원 지역이 아니다(지금 Nour 는 VPN 켬으로 씀 — 13절 "앱은 VPN 을 안내·권장하지 않는다"). 새 서비스를 넣으면 이 위험이 그 회사 계정으로도 생긴다 |
| 10-Q4 | 학습 사용 | — | Gemini 무료 등급·Mistral Experiment 는 보낸 글을 학습에 쓸 수 있다. 보내는 것은 교과서 문장뿐(환자 정보 없음 — 13절)이지만 회사가 하나 늘면 그만큼 퍼진다. 동의 문구에 회사 이름을 넣을지 |
| 10-Q5 | Nour 가 할 일 | — | 새 서비스는 Nour 가 그 회사에 직접 가입해 키를 만들어야 한다(BYOK — 운영자 키 나눠 주기 금지, 17-6). 가입 화면은 영어 — 가이드 필요 |

#### 7. 마지막 실기기 점검 묶음 (10 몫)
- [ ] `[M]` (10-1 배포 뒤 — D6) Nour 기기: 새 서비스 [검증]·[시험 번역] VPN 켬/끔 — 결과 코드·걸린 시간·응답 원문(키 지운 채, `dev.debug`).
- [ ] `[M]` 아랍어 품질 — 같은 예문을 Gemini 와 새 서비스로, Nour 가 고른다.
- [ ] `[M]` (10-2) 실제로 Gemini 429 가 난 날 `[…로 계속]` 이 뜨고 이어지는가(일부러 만들지 않는다 — 생긴 날 기록).

---

## (F) 순서 — 19-1 갱신 제안 (붙일 곳: 19-1-4 6 "배치" 아래 한 줄)

`[수정 2026-11-16 — 18·9c·10 Plan]` **… → 8c+8f(8c-1 → 8f-1 → 8f-2 → 8f-3 → 8c-2) → 18-1 → 9c-1 → 9c-2 → 9c-3 → (10-Q1 결정) 10-G 또는 10-1 → 10-2 → 11b+11c …** — 셋 다 8c+8f 다섯 Build 와 파일이 겹친다(`selbar.js`·`library.js`·`ui/settings.js`·`pipeline.js`·`index.html`·i18n) → 그 뒤. 9c-1(내보내기)은 18 과 파일이 거의 안 겹쳐(`ui/settings.js`·`index.html`·i18n 만) 18 과 순서를 바꿔도 된다 — **Nour 가 새 휴대폰으로 옮길 날이 정해지면 9c 를 18 앞으로.** 10-Q1 은 지금 물어도 되고, 8c-2 사용량 화면으로 Nour 의 실제 사용을 본 뒤 물어도 된다.
