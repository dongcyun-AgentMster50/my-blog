# Build 보고서 — 8b-2: 낭독 동반 번역 화면 (하단 자막 띠)

> Build 서브에이전트. 커밋하지 않았다. 실제 API 키를 넣지 않았다(브라우저 확인에는 지어낸 가짜 키 + fetch 스텁, 끝나고 지움).
> `js/ai/*`·`js/tts/*`·`spec.md`·`js/text/*` 는 건드리지 않았다(작업 트리의 그 파일 변경은 8b-1 몫).

## 0. 먼저 알릴 것 — 범위 충돌 1건 (오케스트레이터 조치 필요)

지침 1번이 요구한 대로 `settings.js` 의 `appendBidiText` 를 공용 모듈(`js/ui/bididom.js`)로 **옮겼다**. 그러자 기존 테스트
`tests/bidi.test.mjs` **B5** 가 빨개진다 — B5 는 `settings.js` 소스 안에 `import { ltrRuns }` 와 `function appendBidiText` 본문이
있는지를 grep 한다. 기존 테스트 수정은 "고쳐도 되는 파일"(tests/ **새** 테스트)에 없어서 **고치지 않았다**
(7c 때 선례처럼 패치만 적는다). 같은 계약은 새 테스트 `BD1~BD3` 가 새 위치에서 고정한다.

B5 를 이렇게 바꾸면 초록이 된다(단언은 그대로, 읽는 파일만 옮김):
```js
test('B5 ★ 화면 연결 — 번역 본문은 appendBidiText 로, rtl 일 때만 <bdi dir="ltr">, 조각은 textContent', () => {
  const src = readFileSync(new URL('../js/ui/settings.js', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../js/ui/bididom.js', import.meta.url), 'utf8');
  assert.match(lib, /import \{ ltrRuns \} from '\.\.\/text\/bidi\.js'/);
  assert.match(src, /import \{ appendBidiText \} from '\.\/bididom\.js'/);
  assert.match(src, /appendBidiText\(body, r\.pair\[code\], a\.dir\)/, '번역 블록 본문은 appendBidiText 를 거친다');
  const fn = lib.slice(lib.indexOf('export function appendBidiText'));
  assert.match(fn, /if \(dir !== 'rtl'\) \{ el\.textContent = s; return; \}/);
  assert.match(fn, /createElement\('bdi'\)/);
  assert.match(fn, /iso\.dir = 'ltr'/);
  assert.match(fn, /iso\.textContent = /);
  assert.doesNotMatch(fn, /innerHTML/);
});
```

## 1. 테스트 수

| | 수 |
|---|---|
| 시작 | 866 (전부 통과. 단 첫 실행에서 8b-1 의 `readalong.test.mjs` RA2 가 한 번 빨갛다가(240행 `actual 2, expected 3`) 재실행에서 통과 — **간헐 실패**, 부하 의존으로 보임. 내 범위 밖) |
| 끝 | **880** = 866 + 새 14(`tests/trband.test.mjs`) · **879 통과 · 1 실패(B5 — 0절)** |

## 2. 만든 것·고친 것

| 파일 | 내용 |
|---|---|
| **새 `js/ui/trband.js`** | 띠 화면. speaker `linechange`(지금 문장 `src`)·`phasechange`·`statechange`·`error`(LAGGING), readalong `mode`·`notice`·`notice-clear`·`remote` 구독, 지금 문장만 `readalong.onChange(src)` 로 구독. 상태 갈래는 순수 `bandView`: idle(재생 전 안내) · none(표 안내 — "이 문장은 번역 없음") · ready · pending("번역 중…", 아직 안 물은 문장도) · failed("번역 실패" + [다시 시도]) · blocked(사유 한 줄, [다시 시도]는 exhausted·cooldown·region·model 에만). 번역문 `dir`·`lang` = `translationBlockAttrs(ai.translationLang)`, 본문은 `appendBidiText`(조각마다 textContent). [다시 시도] = `readalong.retry()`(띠 하나의 위임 `data-tr-action`, 누르는 동안 disabled). 경과 비율 스크롤: show = 원문 발화 시간(14자/초·속도), speak 의 tr 단계 = `trSpeechText` 길이(10자/초), 500ms 마다 `(경과−1s)/예상`, reduced-motion 이면 줄 높이 배수 계단·즉시, 띠를 pointerdown/touchstart/wheel 하면 그 문장 동안 멈춤, 새 문장에서 풀림·맨 위로. `data-speaking="tr"` 이면 `inline-start` 테두리 강조. 상태 바: 사유(`readalong.*`·`ai.state.noKey`)·원격 상태(`ai.state.*`)를 **전이 때 한 번**, 벗어나면/회복하면 배너의 닫기 단추로 거둠. `consent`·`no-key` 안내는 **첫 재생 때**로 미룸(7-8-1 "재생을 처음 누를 때" — 읽기만 하는 사람에게 리더를 열 때마다 띄우지 않게). 디버그 훅 `__medreader.trband.state()`(원문·번역문·키 없음) |
| **새 `js/ui/bididom.js`** | `appendBidiText` — settings.js 에서 **글자 그대로** 옮김. 설정 [시험 번역]과 띠가 이 하나를 쓴다 |
| `js/ui/settings.js` | 그 함수 정의를 지우고 `import { appendBidiText } from './bididom.js'` (+ 주석). 다른 변경 없음 |
| `js/ui/controls.js` | `initTrBand({readalong, speaker})` 한 줄, `syncReadalong()` 끝에 `trband.sync()`, `leaveControls` 에 `trband.leave()`. 속도 팝오버 모드 줄: 8b-1 의 `setTimeout(syncReadalong, 0)` 를 **팝오버(조상) 버블 단계 리스너**로 바꿈 — settings.js 의 저장 위임이 먼저 돈 뒤 **동기로** `syncReadalong()`(타이머 없음) |
| `js/ui/reader.js` | 6-5 편안 영역을 **본문 영역** 기준으로: `bodyArea()` = `[--bar-top, 탐침 윗변]`, 탐침(`.chrome-probe`)은 `block-size: calc(var(--reader-chrome-bottom) + safe-area)` 인 보이지 않는 고정 상자 — JS 에 calc 를 두 벌 두지 않는다. 잣대를 줄 상자가 아니라 **칠해진 문장 범위**(CSS Highlight Range 상자, 없으면 줄 상자)로 — 문장 끝이 띠 윗변−4px 를 넘으면 편안 영역 밖. 목표 위치 = 첫 화면 줄을 영역 가운데, 끝이 띠에 닿으면 올리고, 영역보다 길면 시작을 영역 맨 위(+4px). `scrollIntoView` 대신 `scrollBy`(이유 4절) |
| `index.html` | `#ttsBar` 바로 앞에 `div.tr-band#trBand[role=region][data-i18n-aria=readalong.band][hidden]` + `p.tr-text` + `.tr-status`(`p.tr-note` + `button.tr-retry[data-tr-action=retry]`). aria-live 없음 |
| `css/tokens.css` | `--tr-fs`·`--tr-lh`·`--tr-lines`·`--tr-pad`·`--tr-band-h`(spec 7-7 식 그대로), `:root[data-tr-band="on"] { --reader-chrome-bottom: … + var(--tr-band-h) }` |
| `css/reader.css` | `.tr-band`(fixed, `block-size: var(--tr-band-h)`, border-box, 띠 안 스크롤, 아래변 = 컨트롤 바 윗변), `.tr-text`(`unicode-bidi: plaintext`, `:lang(ar)` 글꼴), 상태 줄·[다시 시도] 48px. 리플로우 화면 아래 여백을 `calc(var(--reader-chrome-bottom) - var(--notice-total))` 로(전에는 바 셋을 따로 더해 띠를 몰랐다). `html:has(리더 보임) { scroll-padding-block-start: var(--bar-top); scroll-padding-block-end: chrome + safe }`. `.chrome-probe`. 물리 방향 속성 0 |
| `js/i18n/*.js` | 네 언어 같은 키 24개: `readalong.{retry,band,idle,pending,failed,none,consent,unsupportedLang,sameLang,lineMode,noVoice,lagging}`, `readalong.blocked.{offline,exhausted,capped,cooldown,region,model,noKey}`, `ai.state.{offline,exhausted,capped,cooldown,model}`. 문구는 14-2 그대로(한국어). `readalong.retry` 를 따로 둔 이유: `common.retry` 가 fr·ko 에서 아직 영어("Try again") |
| **새 `tests/trband.test.mjs`** | 14개 — TB1~3(상태·스크롤 순수), **BUD1~4(tokens.css·reader.css 를 읽어 작은 calc 계산기로 B1 기대값·예산 합산·띠 아래변=바 윗변·소비처 전부가 한 토큰)**, BD1~3(캡처 아랍어 괄호 8개 격리·규칙 한 벌·innerHTML 0·`'ar'` 리터럴 0), WB1~3(배선), NB1(배너 키 네 언어·region 에 [키 설정] 없음) |

## 3. 지침에서 벗어난 것(이유)

1. **`body` 가 아니라 `html` 에 `data-tr-band`**(spec 7-7 은 `body[data-tr-band="on"]`). 문서 스크롤러의 `scroll-padding` 은 루트 요소에 있어서 body 에 걸면 6-5 의 scroll-padding 이 띠를 모른다.
2. **자동 스크롤을 `scrollIntoView` 에서 `scrollBy` 로**(리플로우만). 처음엔 편안 영역 판정만 본문 영역으로 바꿨는데 40px 에서 B4 위반 16/20 — 원서 한 줄(`span.line`)이 화면 여러 줄로 접혀 줄 상자로는 문장 위치를 못 잰다. 칠해진 Range 상자로 재고 목표를 계산하니 0/20. `scroll-padding` 은 그대로 두어 다른 `scrollIntoView`(뷰 전환 착지)가 본문 영역을 존중한다.
3. 상태 갈래에 `idle`(재생 전 "재생을 누르면…") · `none`(표 안내) 을 더했다 — spec 의 `data-state` 다섯에 없지만 지침 1번의 "이 문장은 번역 없음"이 표 안내 자리다.
4. 탭 번역용 `button.tr-close`·[문단 전체]는 만들지 않았다(8c).

## 4. B1~B8 — 브라우저 실측 (`preview_start blog`, 가짜 3쪽 PDF·fetch 스텁)

환경 메모: 미리보기 창이 **숨김 상태**(document.hidden=true)라 ① `requestAnimationFrame` 이 안 돈다 → pdf.js 렌더가 멈춰 원본 뷰가 "여는 중…"/"표시할 수 없음"(이월 ① 경합과 같은 모습)으로 남았다 — 페이지에 rAF→setTimeout 대체를 넣고 재야 했다 ② `behavior:'smooth'` 스크롤이 진행되지 않는다 → B4·B7 수치는 `matchMedia('(prefers-reduced-motion)')` 를 참으로 돌린 즉시 스크롤 경로로 쟀고, 부드러운 경로는 `scrollTo` 호출 기록(spy)으로 확인했다. 기기 모드는 360×800 을 주면 innerWidth/Height 가 361×801 로 잡혔다.

| | 결과 |
|---|---|
| **B1** 띠 높이 = 토큰 | 360×800: 16px **110.19**/토큰 110.19 · 22px **119.92**/119.92 · 40px **142.59**/142.59 (차 0). 800×360: 세 글자 크기 모두 **79.19**/79.19 (22dvh). **spec 기대값 110.2·119.9·142.6·79.2 와 같다** — 갱신 필요 없음. node `BUD1` 이 식으로도 고정 |
| **B2** 겹침 없음 | 띠 아래변 662.76 ≤ 컨트롤 바 윗변 662.87 (360×800, 세 크기), 800×360 222.00 = 222.00. 띠 윗변 520~553 ≥ 49. 끄기(모드 줄 "끔"): 띠 hidden, `html[data-tr-band]` 없음, chrome **138px**, 리플로우 여백 116px, scroll-padding-end 138px — 빈 자리 0 |
| **B3** 원본 뷰 끝까지 | 360×800(띠 119.92): 배율 0.65(폭 맞춤)·0.81·1.59 모두 canvas 아래변 **542.00** ≤ 띠 윗변 **542.09**, 페이지 스크롤 0. 800×360: 0.81 → 143.00 vs 142.81 (+0.19, 허용 0.5 안), 1.59 → 128(가로 스크롤바). 마지막 줄(쪽 아래 92pt)은 끝까지 스크롤하면 띠 위에 보인다. **주의: 800×360 에서 원본 스크롤 상자가 29.8px** — 잘리지는 않지만 사실상 쓸 수 없다(아래 6-3) |
| **B4** 리플로우 하이라이트 | 360×800 연속 20문장 × 글자 16·22·40: 위반 **0·0·0**(쪽 경계 넘김 포함). 같은 조건에서 **옛 판정(창 높이 30~65% + 첫 줄 가운데)으로 되돌리면 22px 3/15 · 40px 14/15 위반**(브라우저 변이 M7). 800×360: 16px 0/8, 22px 1/8, 40px 8/8 — 본문 영역이 94px 라 3줄 넘는 문장은 **기하학적으로 불가능**(시작을 영역 맨 위에 둠) |
| **B5** 가로 스크롤 | 360 폭 글자 16·22·40 + 띠: scrollWidth 361 ≤ 361. 800 폭: 785 ≤ 800 |
| **B6** dir·lang·textContent | ar: `dir=rtl lang=ar`, bdi 8. 콘솔로 `ai.translationLang='ko'` → 코드 수정 없이 `dir=ltr lang=ko`, bdi 0. 모의 응답 `<img src=x onerror=…>` → 글자로 보임, img 0, onerror 실행 0 |
| **B7** 넘침 스크롤 | reduced-motion: 띠 scrollTop 0→36→71→107→143(줄 높이 35.64 배수, 500ms 마다). 부드러운 경로: `scrollTo({top:80…184, behavior:'smooth'})` 500ms 마다 증가. pointerdown 뒤 같은 문장 2초 동안 36 고정, 다음 문장에서 held=false·scrollTop 0. speak 모드 tr 단계: `data-speaking="tr"`, 스크롤 시계 tr(번역문 발화 시간) |
| **B8** 대비(본문/상태 줄/[다시 시도]) | light 17.4/7.37/7.21 · dark 13.86/7.3/8.67 · sepia 11.94/6.85/7.26 · **contrast 21/21/16.57**(≥7) · system(OS 다크 에뮬레이션) 13.86/7.3/8.67. [다시 시도] 47.99×100px(기기 모드 배율의 소수점 — CSS 는 48) |

그 밖에 확인:
- **bidi(지침 검증 3)**: 운영자 캡처 꼴 아랍어 → 괄호 8개 모두 `<bdi dir="ltr">`, 화면엔 괄호 8개가 보이고 원문과 글자 동일. 긴 괄호 4개("(chronic autoimmune disease)" 등)는 360px 에서 두 줄로 접히지만 읽는 순서는 맞다(10-08 기록과 같음).
- **[다시 시도](지침 1)**: 스텁 429 → `exhausted` — 요청 2건 뒤 **쪽을 넘겨도 0건**, 배너 `ai.state.exhausted` 1개, 띠 "오늘 무료 한도…" + [다시 시도]. 누르자 즉시 `remote=ready`, 배너 거둠, 재요청 2건, 띠 ready. 응답 해석 실패(PARSE) → "번역 실패" + [다시 시도] → ready.
- **모드 줄(지침 3)**: 속도 팝오버에서 "표시" 클릭 → 같은 클릭 안에서 readalong 유효 모드 `show`. 닫기 늘 보임: 360×800 닫기 469~517 < 띠 윗변 542, 800×360 닫기 70~118 보임(팝오버 윗변이 −9px — 7b R3 의 하한 144px 때문, 첫 줄 위 여백만 가려짐).
- **알림(지침 4)**: 줄 단위로 바꿈 → `readalong.lineMode` 1번, 띠 숨김, 같은 단위 다시 눌러도 반복 0, 문장 단위로 돌아오면 배너 거둠·띠 복귀. 키 없음 → 쪽 넘김에선 배너 0, **재생을 누를 때** `ai.state.noKey` + [번역 설정] 1번. 아랍어 UI: 상태 줄 `dir=rtl`, 버튼 "أعد المحاولة".
- 콘솔 오류 0.

## 5. 변이 (적용은 python 으로 "찾을 문자열이 정확히 1번"을 확인 후 치환 → 전체 테스트 → 스크래치패드 복사본으로 복원 → `cmp` 같음)

기준선의 빨강은 B5 하나(0절). 아래 "빨개진 테스트"는 그 위에 더해진 것.

| 변이 | 빨개진 테스트 | 복원 cmp |
|---|---|---|
| M1 띠 높이 토큰을 예산 합산에서 빼기(tokens.css on 규칙의 `+ var(--tr-band-h)`) | BUD2·BUD3 | 같음 |
| M2 bidi 격리 빼기(bididom `if (false && runs[i].ltr)`) | BD1 | 같음 |
| M3 [다시 시도] 연결 빼기(`.then(() => ra.retry())` → `null`) | WB1 | 같음 |
| M4 편안 영역에서 "문장 끝 ≤ 띠 윗변−4" 조건 빼기 | BUD4 | 같음 |
| M5 띠 `block-size` → `min-block-size`(내용이 높이를 정함) | BUD3 | 같음 |
| M6 `syncReadalong` 끝의 `trband.sync()` 빼기 | WB2 | 같음 |
| M7(브라우저) 편안 영역·스크롤을 8b-2 전 코드로 | B4 위반 22px 3/15 · 40px 14/15 (지금 0/20) | 같음 |

M4 는 node 에서는 grep(BUD4)만 잡는다 — 브라우저에서 M4 만 적용하면 B4 위반이 0 이었다(목표 위치 계산이 문장 길이를 이미 보므로). 행동으로 잡히는 것은 M7.

## 6. 남은 것·실기기에서 운영자가 볼 것

1. **띠 스크롤 타이밍**: 예상 시간은 원문 14자/초·번역문 10자/초(가정). 데스크톱 음성은 추정보다 빨랐다(0.5× 에서도 약 12초 예상 문장이 7초 안에 끝남). Fold 7·Nour 기기에서 아랍어 번역문이 띠 끝에 닿기 전에 다음 문장으로 넘어가는지 볼 것 — 넘어가면 `CHARS_PER_SEC_TR` 를 실측으로.
2. **부드러운 스크롤·손대면 멈춤**: 숨김 창이라 부드러운 애니메이션 자체는 눈으로 못 봤다(호출 기록만). 실기기에서 띠가 흔들리지 않게 흐르는지, 띠를 만지면 그 문장 동안 멈추는지.
3. **가로 800×360**: 띠 79px + 하단 바 138px 로 본문 94px, 원본 상자 30px — spec 7-7 표(−46%)대로지만 실사용이 어렵다. 가로에서는 띠를 2줄 고정 대신 더 줄이거나 바를 접는 안을 spec 에서 정할 것을 제안.
4. 실제 429 에서 [다시 시도]가 즉시 풀리는지(스텁으로는 확인), 쪽 3번 넘기는 동안 배너 1번·요청 0건.
5. 접힘(375px)·펼침에서 띠 높이와 원본 쪽 끝이 띠 위에 오는지(B3).
6. 기록: 원본 뷰 첫 진입 경합(이월 ①)은 이번 숨김 창에서 rAF 가 멈출 때 그대로 재현됐다 — 내 변경과 무관(rAF 대체 후 정상).

## 7. 정리·도구

- 브라우저: 가져오기로 넣은 가짜 문서(지어낸 영어 문장 PDF) `db.deleteDocument` — documents 1·blobs 1·pages 3·aiCache 28 삭제, 다시 열어 documents 0 확인. 오늘(2026-10-10) usage 행(스텁 호출만 — readalong 외 0) 삭제. 가짜 키 `clearKey`(hasKey false). 설정 원상복구: `readalong.mode=speak`, `tts.rate=1`(시험 중 0.5 로 바꿨던 것), `tts.unit=sentence`, `ai.translationLang=ar`, `reader.view=reflow`. 배너 닫음. 뷰포트 desktop. 테마·글자 크기는 저장값을 바꾸지 않았다(속성만 바꾸고 되돌림).
- Bash 차단 훅에 막힌 명령 없음. npm 설치 없음. `git checkout/restore/stash` 쓰지 않음(복원은 스크래치패드 복사본 + cmp).
