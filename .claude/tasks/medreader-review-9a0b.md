# Review 지침 — 9a-0b 진단 페이지 손질 (짧은 Review)

> 너는 **Review 서브에이전트**다(9a-0 Build·Review·9a-0b Build 와 다른 새 에이전트). 직접 확인한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"9a-0b Review"** 절로 덧붙인다(앞 절은 고치지 않는다, 짧게). **배포 판정**까지.

## 읽을 것
review.md "9a-0 Review"(중1·중2·중3·하1·하4·하5·하7), 지침 `.claude/tasks/medreader-build-9a0b.md`, Build 보고 `.claude/tasks/medreader-build-9a0b-report.md`. 변경: `git diff`(`dev/handsfree.html`, `spec.md` 한 줄, `.claude/tasks/medreader-build-9a0-report.md` 6절 — 기준 커밋 `fcd8630`). 시험 스크립트 `r9a0/`·`b9a0b/`(읽기만 — 네 시험은 `r9a0b/`).

## 확인할 것
1. 고친 7개가 맞게 고쳐졌는지(코드 + 네 시험): C14·B11·`#marks` 위치·S10·`#sum` 갱신·[멈춤] 안내·"3분 내내 들렸어요" 단추.
2. **저장 호환**: 키·`v:1`·필드 그대로 — `fcd8630` 판으로 쌓은 기록을 새 판이 읽는지(운영자가 Fold 7 로 시험 중일 수 있다). 옛 판으로 기록을 만들고 새 판으로 여는 시험을 하나 넣어라.
3. **회귀**: 판정 문구 16종이 고친 것 외에 그대로인지, 진폭 값(128 / 127–129·80,044바이트·`duration` 10), 콘솔 오류 0, 가로 스크롤 0, 단추 ≥ 48px(412×915·360×740), 앱 무변(앱 저장소 키·네트워크 0).
4. Build 남은 문제 2·3 의견: 숨김 중 `interrupted` 를 오류로 치는 것, [멈춤]이 표시 단추에서 멀어진 것 — Fold 7·Nour 시험에 해가 되는지.
5. Nour 점검표(보고서 6절)가 페이지 단추 이름과 맞는지.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 1회(1384), `git diff --check`, `.nojekyll` 있음. **배포 판정.**

## 규칙
**명령은 한 호출에 한 가지 일만. 프로세스 조회(어떤 형태든) 금지.** 브라우저는 `browser.close()` + 디버깅 포트 닫힘 확인. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 8000번 python 은 **PID 32256** — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. 새 프로필 1개, 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. dev 페이지·앱·spec 은 고치지 않는다. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
