# Build 보고 — 다듬기 2: 8d·8p Review 남은 항목 (2026-11-14)

지침 `.claude/tasks/medreader-build-polish2.md`. 기준 `fc79473`. **커밋하지 않았다.** 스크래치 `bp2/` = `C:/Users/YDC/AppData/Local/Temp/claude/9d924f3f16e52d8a/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/bp2/`.

> **중간에 멈췄다.** headless Edge 실행 뒤 결과 파일을 보고 디버깅 포트가 닫혔는지 확인하는 명령이 **권한 분류기에 막혔다**("Undermining Oversight"). 지침대로 다른 명령을 찾지 않고 여기서 멈춘다. 아래 "못 한 것" 참고.

## 1. 바꾼 파일

| 파일 | 항목 |
|---|---|
| `apps/medreader/js/ui/inlinetr.js` | 1 M1 · 3 L1 |
| `apps/medreader/js/ui/controls.js` | 4 L3 |
| `apps/medreader/js/ui/settings.js` · `css/screens.css` | 2 "번역 위치" 한 줄 |
| `apps/medreader/js/ui/trband.js` | 5 L4 — 주석 공백 한 곳 (`git show ca2665a~1` 판과 같은 글자로) |
| `apps/medreader/js/ai/pipeline.js` | 8 캐시 기록 항목에 `domain` (아래 — **반만 됨**) |
| `apps/medreader/js/ui/library.js` | 9 L2 |
| `apps/medreader/js/ui/reader.js` | 10 — 순수 함수 `docAfterDomainChange` 를 꺼냄(테스트가 행동으로 보게) |
| `apps/medreader/index.html` | stamp 만(모듈 61 · CSS 4) |
| `apps/medreader/tests/inlinetr-8d.test.mjs` | 6 L2 + 새 테스트 D11b·D13·D14, D8·D9·D10·D11 손질 |
| `apps/medreader/tests/domain-8p.test.mjs` | P8-7 한 줄 + 새 P8-9·P8-10 |
| `apps/medreader/spec.md` | 7 — 7-7-1 수용 기준 · 19-1-3 §7 정정 줄 |

손대지 않은 것: `ai/cache.js`·`readalong.js`·DB 판·algoVersion·캐시 키·`PROMPT_VERSION`·`SEARCH`/`SCAN`·`review.md`·`dev/handsfree.html`.

## 2. 항목별

1. **M1 막힘 상태 줄 (안 (가))** — `ensureCurrentBlock` 이 블록을 새로 만들기 전에 `quietBlocked(art, rec)`:
   - 띠와 같은 규칙 `bandView` 로 본 상태가 `blocked` 이고 사유가 `offline·exhausted·no-key·capped·cooldown·region` 중 하나다.
   - 그리고 이 쪽에 이미 `data-state="blocked"` 블록이 있다.
   - 그러면 새 블록을 만들지 않는다. 이미 있는 줄(지나간 한 줄)은 그대로 둔다(I4).
   - 첫 막힌 문장에는 한 줄이 생긴다("상태 줄 1개만 새로" 와 맞춤). 현재 문장의 "번역 중…" 이 막힘으로 바뀐 경우에는 그 줄이 그 한 줄이다.
   - 블록을 달지 않은 지금 문장은 `watchCurrent` 로 상태를 지켜본다. 풀리면(pending/ready) 그때 그 문장 **아래**에 달고 `recheck`(6-5). 지금 문장이 바뀌거나 `clearAll` 이면 구독을 거둔다.
   - `model` 은 지침 목록에 없어 이 규칙 밖이다. 문장마다 그대로 생긴다(D13 이 고정). 넣을지는 운영자 결정.
   - `[D]` 훅 `state()` 에 `quiet` 를 더했다(글자 없음).
2. **"번역 위치" 줄** — `buildReadalongRow` 가 머리글 `span.readalong-label` 과 단추 묶음을 한 그릇 `div.readalong-display-line` 에 넣는다.
   - CSS: flex 한 줄. 머리글은 38% 까지, 두 줄로 접힐 수 있다. 단추는 남은 폭을 나눈다. `margin-block-start: var(--sp-2)`.
   - 설정 AI 탭도 같은 함수다(12-3).
   - **412×915·360×740 실측은 못 했다**(아래 4절). 탁상 계산으로는 머리글 줄(≈21px + 4px)이 빠지고 위 여백 8px 이 더해져 ≈17px 짧아진다. 8dR-9 의 52px 를 다 지우기엔 모자랄 수 있다. 실측 뒤 여백을 0 으로 할지 정해야 한다.
3. **L1** — `statusLine()` 이 블록의 `dir`·`lang` 도 UI 로 건다("번역 중…"·막힘·실패·"눌러서 보기"). 번역문은 `renderReady` 가 대상 언어로 되돌린다. UI 언어를 바꾸면 `relabel` 이 상태 줄을 다시 그려 따라간다.
4. **L3** — `view.show` 는 `if (inlinetr) { try { inlinetr.willShow(u); } catch (e) { } } return showSpoken(u);` 이다.
5. **L4** — "— `(경과" 로 되돌렸다.
6. **L2 테스트**
   - D1 에 오름차순 넣기를 더했다.
   - D11 의 세 줄은 실제 readalong 흐름에서 조건을 세우기가 흔들려서, 가짜 서비스를 쓰는 **D11b** 로 따로 두었다.
     - ① 현재 seg 보다 작은 늦은 캐시는 넣지 않는다.
     - ② 다른 쪽으로 갔다 돌아와도 현재 표시가 없고 지난 seg 에 상태 줄이 없다.
     - ③ band 에서 willShow 한 뒤 inline 으로 바꾸면 그 문장 블록이 생긴다.
7. **spec 7-7-1 수용 기준**
   - "문장 + 블록이 본문 영역에 **들어갈 수 있는 크기일 때** 위반 0" 으로 고쳤다. `[정정 2026-11-14 — 다듬기 2 …]` 를 달았다.
   - 넘치는 경우는 6-5 기존 원칙("읽기 시작점이 먼저")을 따른다는 한 줄을 더했다.
8. **캐시 값 `domain`** — **범위 문제로 반만 됐다.**
   - 된 것: `pipeline.js` 의 두 기록 항목(원격·기기 내)에 `domain: ctx.domain`(정규화 값)을 실었다. 키·요청 본문은 같다.
   - 안 된 것: `ai/cache.js` `putMany` 가 레코드 필드를 골라 쓴다. 그래서 IndexedDB 에는 **남지 않는다**.
   - `cache.js` 는 지침 수정 범위 밖이다. 게다가 `tests/domain-8p` P8-4b 가 "cache.js 는 domain 을 모른다"를 고정하고 있다. 8p Build 때와 같은 벽이다.
   - 남은 일: `putMany` 레코드 한 줄 + P8-4b 그 줄을 "키 함수가 domain 을 모른다"로 좁히기. 운영자 결정이 필요하다.
   - "옛 값(필드 없음)도 읽힘" 은 P8-9 가 고정했다.
9. **L2** — `setDocDomain` 은 `normalizeDomain(cur.domain) === domain` 로 비교한다. 필드 없는 문서에서 [의학]을 누르면 wrote false 다. 그래서 `setUserDomain` 이 알림을 내지 않는다(P8-7).
10. **L3/R4** — P8-10:
    - `docAfterDomainChange` 의 행동: 다른 문서·문서 없음은 null, 새 객체를 돌려준다.
    - 그 값이 `readalong.setDoc` 으로 가면 다음 요청 `ctx.domain === 'general'` 이다.
    - `onDocDomain` 이 그 값으로 `state.doc` 을 바꾸는지는 소스로 고정했다.

## 3. 검사

- 전체 `node --test apps/medreader/tests/*.test.mjs` **1회만**: **1389/1389**(1384 + 새 5: D11b·D13·D14·P8-9·P8-10). 2회째는 멈춤 때문에 못 했다.
- `stamp-importmap` 을 다시 찍었다. 그 뒤 `--check` "그대로다(모듈 61개 · CSS 4개)" 종료 0이다. JS·CSS 마지막 수정 뒤에 찍었다.
- `git diff --check` — 못 했다.
- **번역 요청 무변**(`bp2/books.mjs` → `bp2/books.json`)
  - 조건: CMDT 2026 × ar, 45쪽부터 고르게 15쪽, 실제 readalong + pipeline + fetch 흉내, 문장마다 진행. HEAD 는 `git archive fc79473` 를 `bp2/head` 에 풀어 썼다.
  - 요청 40/40, 본문 바이트 같음, 캐시 키 1560 같음, 청크 경계 같음, 저장된 캐시 값 같음.
  - 일반 문체도 키·청크 경계가 같다.
  - 기록 항목의 domain: HEAD 는 `undefined`, 현재는 `medical`(일반이면 `general`). 저장 레코드에는 domain 이 없다(위 8번 그대로).

## 4. 못 한 것 (멈춤)

- **headless Edge**(`bp2/hl.mjs`) — 한 번 돌렸는데, 흉내 Gemini 응답 함수(`mockGemini`, 84행 요청 가로채기 안)가 예외를 던져 Node 가 끝났다. 그래서 `finally` 의 `browser.close()` 가 불렸는지 모른다.
  - 결과 파일(`bp2/hl.json`)을 읽고 9411 포트가 닫혔는지 `curl` 로 보는 한 명령이 권한 분류기에 막혔다. 지침대로 변형을 찾지 않고 멈췄다.
  - **9411 포트·내가 띄운 Edge(프로필 `bp2/p1`)가 닫혔는지 확인하지 못했다.** puppeteer 는 보통 부모 Node 가 끝날 때 브라우저를 함께 끈다. 그래도 확인은 필요하다.
  - 그래서 항목 1·2·3·8·9·10 의 브라우저 확인, 콘솔 오류 0, 스크린숏(`bp2/shots/` — 생겼는지 모름)은 **없다**. 띠 모드 DOM·`--reader-chrome-bottom` 무변도 브라우저로 재지 못했다.
- 변이 3개 이상 → 빨강 → 복원은 하지 않았다(`bp2/bak/` 빈 폴더). 앱 파일은 변이 흔적 없이 깨끗하다.
- 전체 테스트 2회째, `git diff --check`.
- 8000번 python: 처음엔 응답이 없었다. 레포 루트에서 `python -m http.server 8000 --bind 127.0.0.1` 을 띄웠고 **켜 둔 채**다. 8123·8124·8125 는 건드리지 않았다. 프로세스 조회는 하지 않았다.

## 4-1. 덧붙임 — 운영자 결정(2026-11-15) 반영

오케스트레이터 전달을 받았다. 브라우저 확인·변이·테스트 2회째는 **별도 Review 가 맡는다**. 그래서 나는 headless·포트·결과 파일을 더 보지 않았다.

**코드**
- **항목 8 완료**
  - `js/ai/cache.js` `putMany` 에 한 줄을 더했다: `if (typeof e.domain === 'string' && e.domain) rec.domain = e.domain;`
    - 값에만 들어가고, 준 때만 남는다. 다른 kind 는 필드가 없다.
    - `cacheKindOf`·`keyFor` 는 그대로다(캐시 키 불변).
    - 옛 레코드는 고치지 않는다. 필드가 없으면 의학이다.
  - 테스트
    - P8-4b: "키 함수(cacheKindOf…sizeOf 앞)에 domain 없음 · putMany 가 값에 남김" 으로 고쳤다.
    - P8-9 에 실제 `cache.js` 경로를 더했다. 일반 → 레코드 `domain:'general'`, 필드 없는 문서 → `'medical'`, 키 목록 불변, 옛 레코드는 필드 없음 그대로이고 적중 0 호출, domain 을 안 준 기록(quiz)은 필드 없음.
  - spec 19-1-3 §7 정정 줄의 "아직 남지 않는다" 를 결정대로 고쳤다.
- **M1 에 `model` 추가** — `QUIET_BLOCKED` 에 넣었다.
  - D13 반복 목록에 `model` 을 더했다.
  - 예전 "model 은 규칙 밖" 확인은 "막힘이 아닌 '번역 중…' 은 문장마다 그대로" 로 바꿨다.
- 팝오버 위 여백: 건드리지 않았다(Review 실측 뒤).

**검사**
- stamp 를 다시 찍었다. 그 뒤 `--check` "그대로다(모듈 61개 · CSS 4개)" 종료 0이다.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 1회: **1389/1389**, fail 0(`bp2/t2.txt`).
- `git diff --check` 종료 0.
- 작업 트리
  - 앱 10파일: `css/screens.css`·`index.html`·`js/ai/{cache,pipeline}.js`·`js/ui/{controls,inlinetr,library,reader,settings,trband}.js`
  - `spec.md`
  - 테스트 2파일
  - 이 보고서

**내가 띄운 백그라운드 작업**
- **8000번 python 정적 서버 하나**: 레포 루트에서 `python -m http.server 8000 --bind 127.0.0.1`. 켜 둔 채이고, 끄지 않는다.
- 그 밖의 백그라운드 작업은 없다.
- headless Edge(`bp2/hl.mjs`, 프로필 `bp2/p1`, 포트 9411)는 백그라운드가 아니라 전경 실행이었다. 그러나 예외로 끝나 닫힘을 확인하지 못했다(4절). Review 가 확인할 몫이다.

## 5. 남은 문제 · 운영자 몫

> 2026-11-15 결정으로 1·2·3·4 모두 정리됨: 1은 Review 가 맡고, 2·3은 반영했고(4-1), 4는 Review 실측 뒤로 미룬다.

1. 위 막힌 명령을 허용할지. 허용하면 다음 순서로 이어 간다: 결과 파일 읽기와 포트 확인 → `mockGemini` 고치기 → 브라우저 확인 → 변이 → 테스트 2회째.
2. 항목 8: `cache.js` 를 수정 범위에 넣을지(한 줄 + P8-4b 한 줄).
3. M1 에 `model` 도 넣을지(지금은 지침의 여섯 사유만).
4. 팝오버 줄: 실측 뒤 여백(`margin-block-start`)을 0 으로 할지.
