# Build 지침 — 9a-0b: 진단 페이지 손질 (Nour 전달 전)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 맨 끝 **"9a-0 Review"** — 판정 "통과, Nour 에게 보내기 전 중1·중2·중3·하1 을 고치면 좋다". 운영자는 지금 Fold 7 로 배포본(`fcd8630`)을 시험 중일 수 있다 — 기록 저장 키·형식을 바꾸지 마라. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9a0b-report.md`.

## 할 일 (이것만 — `apps/medreader/dev/handsfree.html`)
1. **중1 C14**: `cStats()` 가 `foreignHidden` 을 더하게 — 숨김 중 우리가 안 부른 pause 도 다툼으로 센다(spec 7절 규칙).
2. **중2 B11**: 숨김 중 발화 오류가 있으면 "(다) Plan 근거"가 나오지 않게(오류 뒤 간격 재기 또는 오류 수 조건). 오류 수를 요약에 보인다. spec 규칙을 넓히지 말고 "끊김 없음" 뜻에 맞춘다.
3. **중3 화면 거리**: `#marks`(표시 단추)를 `#now` 바로 아래로 — 412×915·360×740 에서 표시 단추와 "Buttons received" 가 한 화면에.
4. **하1 S10**: 모드 1 이 받았는데 "모드 1·2 모두 버튼 없음"이 나오는 문구 고침.
5. **하4**: 발화 오류·end 뒤 `#sum` 갱신. **하5**: A·D 안내에 "끝나면 [멈춤]". **하7**: B 끝난 뒤 "들렸나" 표시 단추 하나(기록에 남김, Nour 점검표용).
6. 페이지 안내가 A3 라고 해도 Nour 점검표는 B2 로 가는 어긋남은 **페이지를 고치지 말고** 보고서 6절 점검표 쪽에 "화면에 다음이 A3 라고 나와도 B2 를 누르세요" 한 줄을 더한다(지금 있는 Build 보고 `.claude/tasks/medreader-build-9a0-report.md` 6절을 고쳐라 — "B 뒤 3분 내내 들렸는지 메시지로" 도).

## 검증
- 시험은 Review 의 `r9a0/t1-verdict.cjs`·`t2-flow.cjs`(스크래치패드 — 복사해 `b9a0b/` 에서 고쳐 써도 됨, 원본은 읽기만)를 다시 돌린다. 실패 6개가 풀리고 나머지가 그대로인지.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회(`Get-CimInstance`·`Get-Process`·`tasklist` 어떤 형태든) 금지.** 브라우저는 `browser.close()` + 디버깅 포트 닫힘 확인. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고.
- `node --test apps/medreader/tests/*.test.mjs` 1회(1384), `git diff --check`, 외부 URL·앱 import 0.
- 8000번 python 은 **PID 32256** — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. 새 프로필 1개, 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 모든 실행에 시간 상한(10분 이내). C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`dev/handsfree.html`, `.claude/tasks/medreader-build-9a0-report.md`(6절), `spec.md`(17-1-1 7절 정정 줄에 짧게 — 바꾼 것이 있을 때), 스크래치패드 `b9a0b/`, 보고서. 앱 코드·테스트·review.md 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
