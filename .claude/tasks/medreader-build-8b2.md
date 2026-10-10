# Build 지침 — 8b-2: 낭독 동반 번역 화면 (하단 자막 띠)

> 너는 **Build 서브에이전트**다. 아래 "고쳐도 되는 파일"만 고친다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.
> 8b-1(서비스·발화 순서)은 끝났다. **너는 화면만** 한다 — 8b-1 이 남긴 계약 위에 붙인다. 서비스 동작을 바꿔야 하면 멈추고 보고하라.
> 끝나면 보고서 `.claude/tasks/medreader-build-8b2-report.md` 를 쓴다.

## 먼저 읽을 것
1. `.claude/tasks/medreader-build-8b1-report.md` — **8절 "8b-2 계약"**(구독할 이벤트·부를 함수·데이터 모양). 이것이 너의 입력이다.
2. `.claude/tasks/medreader-handoff.md` — "반드시 지킬 것", 10b(하단 바 세로 예산·스크롤 소유권 — 운영자가 "바가 두껍다", "원본이 잘린다"를 결함으로 지적했다), 2026-10-08 bidi, 2026-10-10 음성 진단
3. spec: **16-D3 의 `[D]` B1~B8**(이번 합격 기준), **7-7**(표시 규칙 — 하단 자막 띠·세로 예산 토큰·수치 표), 6-5(편안 영역·`scroll-padding` 을 본문 영역 기준으로), 12-3(하단 순서 그림·속도 팝오버 모드 줄), 14-2(상태 문구), 11-3
4. 코드: `css/tokens.css`(`--pager-h`·`--notice-total`·`--tts-gap`·`--reader-chrome-bottom`·`--banners-h`), `css/reader.css`, `js/ui/reader.js`·`controls.js`·`original.js`, `js/text/bidi.js`(`ltrRuns`), `js/ui/settings.js` 의 `appendBidiText`(같은 규칙을 띠에서도 — 한 벌로), `index.html`

## 만들 것
1. **`js/ui/trband.js` + 하단 자막 띠** — 리플로우·원본 두 뷰 공통(7-7). 현재 문장의 번역문을 보인다. 상태: 준비됨 / 번역 중… / 이 문장은 번역 없음 / 막힘(사유별 한 줄 + **[다시 시도]**). 끄기 모드면 띠가 없고 자리도 남지 않는다.
   - 번역문 블록 `dir`·`lang` 은 `ai.translationLang` 에서 유도(`ar` 박지 않음). **라틴 문자 구간은 `ltrRuns` 로 `<bdi dir="ltr">` 격리** — `settings.js` 의 `appendBidiText` 를 공용 위치로 옮겨 두 곳이 같은 함수를 쓰게 하라(`ui/` 안의 공용 모듈 — `text/*` 는 DOM 을 모르므로 거기 두지 않는다). 조각마다 `textContent`.
   - **화면에는 괄호 속 영어를 그대로 보인다**(낭독만 뺀다 — 8b-1 `trSpeechText`).
   - **[다시 시도]** 는 `readalong.retry()` — `exhausted`(Gemini 429 는 `Retry-After` 가 거의 없어 사실상 자정까지)·`cooldown`·`model` 을 즉시 풀어야 한다. 48px.
   - 넘치는 번역문: 띠 안에서 발화 경과에 따라 스크롤, 띠를 만지면 그 문장 동안 멈춤, `prefers-reduced-motion` 은 계단(B7).
2. **세로 예산(7-7·B1~B4)** — 띠 높이는 **토큰 `--tr-band-h`** 가 정한다(글자 크기에 따라). `--reader-chrome-bottom` 에 합산해 기존 소비처(본문 패딩·원본 뷰 스크롤 영역·편안 영역·`scroll-padding`·팝오버 최대 높이)가 자동으로 따라오게. **10b 결함 재발 금지**: 원본 뷰를 끝까지 스크롤하면 canvas 아래변이 띠 윗변 위(B3), 리플로우 하이라이트가 띠에 가려지지 않음(B4).
3. **속도 팝오버의 모드 줄**(7b 에서 저장만 되던 것)이 이제 실제로 동작 — 바꾸면 `syncReadalong()`. 7b R2 의 "닫기 늘 보임"이 유지되는지.
4. **상태 알림**은 14-2 문구로, 상태 전이 때 1번(8b-1 `notice`·`notice-clear`). 같은 상태에서 반복하지 않는다.

## 고쳐도 되는 파일
새 `js/ui/trband.js`, 공용 bidi DOM 모듈(`js/ui/` 안 새 파일), `js/ui/settings.js`(공용 모듈로 옮긴 함수 import 만), `js/ui/reader.js`·`controls.js`·`original.js`(띠 배선·예산 소비만), `index.html`(띠 자리), `css/tokens.css`·`reader.css`·`screens.css`, `js/i18n/*.js`(띠 문구, 네 언어 키 집합 동일), `tests/` 새 테스트.
**건드리지 않는 것:** `js/ai/*`·`js/tts/*`(8b-1 결과 — 필요하면 보고), `spec.md`, `js/text/*`, 4절, `js/quiz/*`.

## 반드시 지킬 것
- CSS 논리 속성만, `innerHTML` 은 정적 템플릿만, 모든 번역문·AI 응답은 `textContent`(B6 — 모의 응답 `<img src=x onerror=…>` 가 글자로).
- 버튼 동작은 한 장치(`data-nav` 또는 기존 위임) — JS `onclick` 과 섞지 않는다.
- 버튼 48px, 띠 대비 4.5:1(고대비 7:1, 테마 5종 — B8).
- **캐시**: `python -m http.server` 는 `Cache-Control` 을 안 보낸다 — 고친 파일을 `fetch(url,{cache:'reload'})` 로 받고 쿼리를 바꿔 navigate.

## 검증 — 보고서에 수치로
1. `node --test "apps/medreader/tests/*.test.mjs"` 전부 통과(시작 866).
2. **B1~B8 을 브라우저에서 수치로** — 360×800·800×360, 글자 16·22·40px, 테마 5종. B1 기대값(spec): 110.2·119.9·142.6px(세로), 800×360 은 79.2px — 다르면 왜 다른지 적어라(spec 수치가 가정이면 실측으로 갱신 제안). 미리보기 브라우저에 PDF 가 없으면 IndexedDB 에 가짜 문서·쪽을 넣고 readalong 은 fetch 스텁으로 — 끝나면 지운다.
3. 운영자 캡처의 실제 아랍어(보고서·review.md 에 있는 꼴)를 띠에 넣어 bidi 확인(괄호 8개 격리, 화면엔 괄호 보임).
4. 변이 3개 이상(띠 높이 토큰을 예산 합산에서 빼기 → B2/B3 테스트, bidi 격리 빼기, [다시 시도] 연결 빼기 등). 적용 grep 확인 후, 스크래치패드 복사본으로 복원·cmp(`git checkout`·`restore`·`stash` 금지).
5. 마지막 응답: 만든 것, B1~B8 수치, 변이, 실기기에서 운영자가 볼 것을 12줄 이내로.
