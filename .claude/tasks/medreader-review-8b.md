# Review 지침 — 8b: 낭독 동반 번역 (8b-1 서비스 + 8b-2 화면)

> 너는 **Review 서브에이전트**다. 두 Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "8b" 절로 덧붙인다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.

## 읽을 것
1. 지침: `.claude/tasks/medreader-build-8b1.md`(진단 결정 반영분 포함), `medreader-build-8b2.md`. 보고: `medreader-build-8b1-report.md`, `medreader-build-8b2-report.md` — **검증 대상**
2. spec 16-D3(RA1~RA14·B1~B8), 7-7·7-8 전부, 6-1·6-2·6-5, 7-6
3. `.claude/tasks/medreader-handoff.md` 의 2026-10-10 "음성 진단" 절 — **"목록에 없음 ≠ 말할 수 없음"** 결정의 근거(운영자 폰: 목록 92개·아랍어 0개, 그래도 `lang='ar-SA'` 로 아랍어가 소리 남)
4. `git diff` 와 새 파일(`js/ai/readalong.js`, `js/ui/trband.js`, `js/ui/bididom.js`, 테스트들)

## 특히 볼 것
- **간헐 실패**: Build 가 `readalong.test.mjs` RA2 가 한 번 실패하고 재실행에서 통과했다고 보고했다. 전체 테스트를 **최소 10번** 돌려 재현을 시도하고, 원인(타이머·실제 시계·순서 의존)을 찾아 고쳐라. 오케스트레이터는 4번 돌려 재현 못 했다.
- **살아남은 변이 M5**(8b-1): "tr-wait 세대 검사만 빼면 살아남는다 — 이중 방어라서"라는 설명이 맞는지. 두 겹을 함께 빼면 정말 빨개지는지, 한 겹이 실제로 도달 불가인지 코드로 확인. 도달 불가면 죽은 코드인지 의견.
- **음성 판정**: 운영자 폰과 같은 상황을 스텁으로 — 첫 `getVoices()` 0개 → 9ms 뒤 92개(영어 5·한국어·프랑스어 2, 아랍어 0). 그 사이·이후 어디에서도 "영어 음성 없음" 알림이 뜨지 않는가. 아랍어는 목록에 없어도 `speak` 유지·알림 0, **첫 발화 오류**에서만 `show` + 알림 1. 설정 화면 3갈래(있음 / 목록에 없음·[들어 보기] / 안 됨)가 맞게 바뀌는가. `ui/quiz.js` 가 아직 옛 `loadVoices` 를 쓴다(8b-1 보고) — 같은 오판이 퀴즈 해설 낭독에 남는지 확인하고 의견(고치지 마라 — 범위 밖, 기록).
- **창 경계와 비용**(가장 중요한 비용 보장): 20,000자 넘게 낭독하며 요청된 문장이 모두 커서로부터 9,000자 안인가(RA3), 429·capped·offline·region·model 에서 요청 0건·알림 1번(RA4), [다시 시도]가 `exhausted` 를 즉시 푸는가. 실제 책 흐름으로도 한 번: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`, `apps/medreader/dev/measure-lib.mjs`·`sim-readahead.mjs`. PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 와 `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf` 만 — **다운로드 폴더 목록을 띄우지 마라.** 원서 문장을 review.md 에 옮기지 마라.
- **발화 순서**(RA7~RA10): `[src, tr, src, tr…]`, 늦은 번역 `TR_WAIT_MS` 뒤 건너뜀, 멈춤 뒤 늦게 온 번역을 읽지 않음(세대), `speakSource=false`, 문장 반복. **번역문 발화 텍스트에서 괄호 속 라틴 문자가 빠지는가**(운영자 결정) — 그리고 화면 띠에는 괄호가 **남아 있는가**.
- **화면 B1~B8 을 다시 재라**: 띠 높이 = 토큰, 컨트롤 바와 겹침 0, **원본 뷰 끝이 띠 위**(10b 결함 재발 금지 — 운영자가 결함으로 지적했던 것), 하이라이트가 띠에 가리지 않음, 가로 스크롤 0, `ko` 전환 시 `dir=ltr`, `<img onerror>` 가 글자로, 대비. Build 가 "미리보기 창이 숨김이라 프레임이 안 돌아 대체 코드를 넣고 쟀다"고 했다 — 가능하면 창을 보이게 해서 실제 프레임으로 다시 재고, 안 되면 그 한계를 적어라.
- **800×360(가로)**: 본문 94px·원본 상자 30px — Build 가 "긴 문장은 기하학적으로 못 지킨다"고 했다. 가로 모드에서 띠를 자동으로 줄이거나 접는 게 필요한지 의견(구현은 하지 마라).
- **bidi 한 벌**: `appendBidiText` 가 `ui/bididom.js` 한 곳에만 있고 설정·띠가 그것을 쓰는가(오케스트레이터가 B5 테스트를 이 뜻으로 고쳤다).
- 회귀: 설정 화면(검증·시험 번역·두 블록·드롭다운 2개), 영어 낭독·하이라이트·자동 스크롤, 원본 뷰, 퀴즈 진입. 키 누출 0, `innerHTML` 0(정적 템플릿 외), CSS 물리 속성 0, 콘솔 0.
- 변이: 두 Build 의 것 중 3개 이상 재현 + 새것 2개 이상. 적용 grep 확인 후, 스크래치패드 복사본으로 복원·cmp(`git checkout`·`restore`·`stash` 금지).

## 고쳐도 되는 것
8b-1·8b-2 가 만든·바꾼 파일 안의 결함 수정과 테스트(간헐 실패 원인 포함). `spec.md`·4절·`gemini.js` 판정·`js/quiz/*` 는 고치지 않는다. npm 설치 금지.

## review.md "8b" 절
결론 · RA·B 항목별 · 간헐 실패 원인 · M5 판정 · 음성 판정 · 비용 보장(창·막힘·재시도) · 실제 책 흐름 · 화면 실측(프레임 조건 명시) · 회귀 · 변이 · 고친 것/기록만 · 운영자 실기기 확인 목록.
