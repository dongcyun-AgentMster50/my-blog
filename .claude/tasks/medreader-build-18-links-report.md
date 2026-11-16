# Build 보고서 — 18 의료 사이트 북마크 + 검색어 바로가기 (spec 17-9)

> Build 서브에이전트 · 2026-11-17 · 직전 배포 8f-4 `ee8ecfd` 위. **커밋하지 않음.** 운영자 위임(2026-11-15) — 결정 18-D1–D7 모두 권장안 (가).
> 링크만 — 앱의 외부 요청 0 · 스크래핑·응답 읽기·계정 정보 없음. 번역 요청 바이트·캐시 키·DB 버전·algoVersion·`PROMPT_VERSION` 무변.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/text/links.js` **새** (순수) | `checkLink`(코드 7) · `hasQuery` · `fillQuery`(encodeURIComponent) · `queryText`(NFKC·숨은 하이픈·폭 없는 공백 지움·앞뒤 구두점 뗌·**`SEL_LIMIT` import** — 8c-1 과 같은 상수) · `effectiveLinks`(null → 기본 / 배열 → 그 배열, 검사 통과 항목만·최대 30·id 겹침 없음) · `queryLinks` · `homeUrl`(18-D5) · `hostOf` · `lookupPlan` · `newLinkId`·`moveLink`·`removeLink`·`upsertLink`. `URL` 은 존재 검사 후(18-D6 (가)) |
| `js/ui/links.js` **새** | 서재 카드 `renderLibraryLinks` · 설정 카드 `initLinksSettings`/`showLinksSettings`/`leaveLinksSettings`(추가·수정·순서·삭제 확인 `<dialog>`·추천·되돌리기) · `[찾아보기]` `lookup`(1개 → 바로, 2+ → 줄 위 `role=menu`) · 새 탭 속성 한 곳 `armAnchor` · `openExternal`(`<a>` 만들어 `click` — `window.open` 없음) |
| `tests/links-18.test.mjs` **새** | L1–L10 (아래 2절) |
| `js/config.js` | `LINKS` {MAX 30 · NAME_MAX 60 · URL_MAX 2000 · QUERY · DEFAULTS 4 · SUGGESTED 4(`check:'unverified'`, UpToDate `paid`)} |
| `js/settings.js` | `'links.medical': null` |
| `js/ui/selbar.js` | `SEL_ACTIONS` 넷째 `{id:'lookup', key:'sel.lookup', when:'links'}` · `selBarModel(actions, snap, ctx)` 셋째 인자(`{q}` 링크 수 → 숨김, `queryText` null → 흐림, 단추별 `note` 키) · 클릭에서 `lookup` 을 **controls 보다 먼저**(사용자 동작 안에서 새 탭) · 목록이 떠 있으면 선택이 풀려도 줄 유지 · `hide`/`refresh` 가 목록을 닫음 |
| `js/ui/library.js` | import 1 + `showLibrary` 에서 `renderLibraryLinks()` |
| `js/ui/settings.js` | import 1 + `initLinksSettings()` · `showLinksSettings(params.tab)`(`#/settings/links` 굴리기·제목 포커스) · `leaveLinksSettings()` |
| `index.html` | 서재 `<details id="libraryLinks">`(저장 줄 위·기본 접힘) · 설정 `#settingsLinks` 카드(목소리·음성 명령 카드 아래, 주소 칸 `dir=ltr inputmode=url`, 삭제 `<dialog>`) · stamp |
| `css/screens.css` | `.links-*` (논리 속성만, 48px, `overflow-wrap:anywhere`, 접는 카드 +/− 표시, `.links-menu` absolute) |
| i18n ko·en·fr·ar | 34키 (ar·fr `[검토 — Nour·운영자]`) |
| `tests/taptr-8c.test.mjs` I7b · `tests/wordsheet-8f.test.mjs` W14 | `SEL_ACTIONS` 3 → 4 기대값만(`lookup`, ctx 없으면 숨김) |
| `spec.md` | 3-2 예외 한 줄 · 17-9 정정 줄 4개(1절 코드 사실 · 2절 checkLink · 2절 배선/18-D4 가정 · i18n 키 수) |

`controls.js`·`pipeline.js`·`prompts.js`·`db.js`·`wordsheet.js`·`vocab.js`·`search.js`·`dev/` 무변. `dev/measure-table-8i4.mjs` 손대지 않음.

## 2. 수용 기준 (17-9 4)

| 기준 | 결과 | 근거 |
|---|---|---|
| `[N]` checkLink — https ok · http·javascript:·data: → url-not-https · `u:p@`·`u@` → url-userinfo · 이름 0·61자 · 주소 2,001자 · 31번째 too-many · `{q}` 두 번 ok | ✔ | L1 (+ 제어 문자·호스트/포트 안 `{q}` → url-bad) |
| `[N]` fillQuery — `a&b=c#d` → `a%26b%3Dc%23d` · 아랍어·한글 · 결과가 다시 checkLink 통과 · `{q}` 없으면 그대로 | ✔ | L2 |
| `[N]` queryText — 정리 · 7낱말·61자 → null · clampSelection 과 같은 상수 | ✔ | L3 (import grep + 경계 판정 일치) |
| `[N]` 기본 목록 — null → DEFAULTS · 배열 → 그 배열(빈 배열 = 없음) · 기본 넷 ok·hasQuery | ✔ | L4 |
| `[D]` 설정 카드 — 추가·수정·순서·삭제(페이지 안 확인) → 새로고침 뒤 같다 · 되돌리기 → null · 잘못된 주소 코드별 한 줄·저장 0 | ✔ | run-a `set.*` 11항목 (`confirm()` 0회, Esc = 취소, 첫 초점 [취소]) |
| `[D]` 선택 줄 — `{q}` 0 → 없음 · 1 → 새 탭(가로챈 a.click 의 href·rel·target·referrerPolicy) · 2+ → 목록·고른 주소 · 7낱말 흐림+한 줄·새 탭 0 · 낭독 중 끊김 0 | ✔ | run-a `sel.*` 9항목 (낭독 중 `cancel` 증가 0) |
| `[D]` 서재 카드 — 접힘 기본 · 이름만 · `{q}` 링크 → `origin/` · [편집] → 설정 카드로 굴림 | ✔ | run-a `lib.*` 7항목 |
| `[D]` 360×740·412×915·915×412 × ko·ar (+en 412·fr 360) — 가로 넘침 0 · 48px · 주소 칸 ltr · RTL 거울 · innerHTML 새 사용 0 | ✔ | run-l 8조합 전부 · L8 grep · `git diff -G innerHTML` 0 |
| `[D]` 네트워크 — 18 동작 요청 0 | ✔ | run-a `req18.total = 0`(서재·설정 두 구간·선택 줄 두 구간·낭독 중) · 외부 주소 0 · 새 page 대상 0 |
| `[M]` GT 7 · UpToDate | 실기기 목록(6절) | — |

## 3. 시험

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1677/1677 · 1677/1677** (HEAD 1667 + L1–L10). `stamp --check` 그대로 · `git diff --check` 0.
- 변이 (읽어서 쓰기 백업 `b18/bak/` → 시험 → 되돌림 → `cmp` 0):

| # | 변이 | 빨강 |
|---|---|---|
| M1 | checkLink userinfo 검사 지움 | L1·L4 |
| M2 | fillQuery `encodeURIComponent` → `encodeURI` | L2·L6 |
| M3 | `LINK_REL` 에서 `noreferrer` 뺌 | L8 + **headless** `lib.attrs`·`lib.click`·`sel.menuPickOpens` |
| M4 | null 일 때 기본 대신 빈 목록 | L4 |
| M5 | queryText 낱말 상한을 사본 숫자 7 로 | L3·L6·L9 |
| M6 | `referrerPolicy` 지움 | L8 |
| M7 | 호스트 안 `{q}` 검사 지움 | L1 |

## 4. headless (Edge · 새 프로필 `b18/p1` · pipe · 가짜 키 · 흉내 Gemini OPTIONS 204+CORS · 캐시 끔 · 한 번에 하나)

- `HTMLAnchorElement.prototype.click` 가로채 기록·이동 0, `a[target=_blank]` 사용자 클릭은 캡처 preventDefault, `window.open`·`confirm` 가로채 0회. 앱 출처·흉내 Gemini·**pdf.js CDN(jsDelivr — 앱이 원래 쓰는 라이브러리, 앞 Build/Review 하네스와 같음)** 말고 모든 요청 abort·기록 → **외부 기록 0**. 의료 사이트 접속 0.
- run-a (ko 412×915) 26/26 · run-l 8조합 전부 · run-r 회귀 7/7(8c-1 손가락 탭 → 띠 · Esc 로 띠 닫기 · 선택 줄 네 단추 · 8f-2 [단어 번역] 시트·Esc · [여기서부터 읽기] · 서재 카드·저장 줄·단어장 단추 · 설정 AI·번역·목소리 카드) · 콘솔 오류 0 · pageerror 0.
- Esc 층: 목록 + 탭 띠 → 첫 Esc 는 목록만, 둘째 Esc 가 띠.
- **번역 요청 본문 HEAD 와 같음**: 같은 프로필·`aiCache` 비우고 40쪽 [▶] 8초 — HEAD 판(b18/head 를 가로채 내줌, 33파일) POST 2개 `8f301ea7584678d4`(2747B)·`1da11781b23e9ac3`(9426B) = 지금 판 같은 둘.
- 숨긴 하이픈 선택: `.hy` 는 `String(selection)` 에 안 들어가 결합된 꼴(11자 = 11자, 하이픈·공백 0) → spec 18-D4 정정 줄에 적음.
- 스크린샷 `b18/shots/`: `lib-412x915-ko.png` · `lib-360x740-ar.png` · `set-360x740-ar.png` · `set-412x915-en.png` · `menu-412x915-ko.png` · `menu-360x740-ar.png` · `menu-915x412-ko.png` · `a-ko-412-done.png`.

## 5. spec 정정 (Edit 로 그 자리만)
- 3-2 순수 계층 예외 한 줄 (`text/links.js` 의 `URL`, 허용 줄 = L5 두 줄).
- 17-9 1절 뒤: 지금 코드 사실(8c-1·8f-2·8f-3·8c-2·9b 뒤).
- 17-9 2절 검증 뒤: checkLink 만든 그대로(`count` · 제어 문자 · 호스트 안 `{q}`) · 더한 순수 함수.
- 17-9 2절 화면 끝: `controls.js` 무변 배선 · 목록 유지 규칙 · Esc 캡처 · **18-D4 `[가정]` 은 틀림**(스냅숏은 `String(sel)` — 숨긴 하이픈은 결합된 꼴로 들어감).
- 17-9 i18n: 실제 34키(+13키 목록).

## 6. 실기기 목록 (`[M]` — 마지막 점검 묶음)
- [ ] GT 7: 길게 눌러 낱말 → `[찾아보기]` → MedlinePlus/PubMed 결과가 새 탭 → 돌아오면 그 자리·낭독 멈춤 그대로.
- [ ] 손가락으로 `[찾아보기]` 누를 때 Android 가 선택을 풀어도 목록이 남는가(풀려도 남게 만듦 — `[가정 — 실기기]`) · 목록 밖을 누르면 닫히는가.
- [ ] 기본 넷 + 추천 넷이 폰 Chrome 에서 결과 화면으로 가는가 — **`[확인 필요]` 셋: MSD Manual (Professional) · Radiopaedia · NCBI Bookshelf** (결과가 비면 추천에서 뺀다). 웹은 열지 않았다.
- [ ] UpToDate(Nour 구독 뒤) `search=` 꼴 — 로그인 상태면 결과, 아니면 로그인 화면.
- [ ] 메신저 안 브라우저에서 새 탭 동작(가이드 몫 — "Chrome 으로 여세요").
- [ ] 폰 Chrome 에서 줄 끝 숨긴 하이픈 선택 → 검색어가 결합된 꼴인가.
- [ ] ar·fr 문구 34키 `[검토 — Nour·운영자]`.

## 7. 남은 문제
1. 360px ko·fr 에서 선택 줄 단추 넷 — "여기서부터 읽기" 가 두 줄로 접혀 줄 높이 76px(8f-2 의 셋일 때보다 높음). 11 이 `[찾아보기]` 를 `[⋯]` 안으로 옮기면 풀린다.
2. 목록은 줄 바로 위 전체 폭이라 고른 낱말이 줄 바로 위 몇 줄 안에 있으면 가릴 수 있다(고르는 동안만).
3. `[기본 목록으로 되돌리기]` 는 확인 없이 바로(설계에 확인 없음) — 사용자 목록을 잃는다. 원하면 다듬기에서 페이지 안 확인.
4. HEAD 부터: `selbar.reattach()` 를 부르는 곳이 없어 `window.__medreader.selbar` 디버그 훅이 부팅 끝 전역 재생성에 지워진다(8c-1 몫, 18 무관 — 하네스는 DOM 으로 봄).
5. **9c**: 백업 허용 목록에 설정 키 **`links.medical`** (9c Build 몫 — crossstep-notes "9c" 줄).
6. 11: `[찾아보기]` 를 `[⋯]` 안으로 — `SEL_ACTIONS` 항목 `when:'links'` 와 selbar 클릭의 `id === 'lookup'` 분기를 그대로 옮기면 된다.

## 8. 막힌 명령 · 규칙
- 막힌 명령 없음.
- 규칙 어김 1건(자진 보고): 초반 관련 시험 한 번을 `cd … && node --test … | grep | head` 로 묶어 돌렸다(한 호출 한 가지 규칙 위반). 그 뒤로는 결과를 파일로 쓰고 따로 읽었다. 결과에는 영향 없음(fail 0).
- 서버 새로 띄우지 않음(8000 쓰기만) · 외부 사이트 접속 0 · 진짜 키 없음 · 프로필 복사 없음 · 커밋·checkout/restore/stash 없음 · `.nojekyll` 무변.
