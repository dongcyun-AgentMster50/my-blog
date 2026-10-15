# Build 지침 — 8i-1 재추출 중 "지금 보고 있는 쪽"을 새 판으로

> 너는 **Build 서브에이전트**다. 운영자가 spec 4-13-9 의 **8i-1** 줄을 결정했다(2026-10-14). 8i(로컬 커밋 `8bc61de`, 미푸시)와 함께 배포된다.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8i-1-report.md`.

## 문제 (8i Review 가 headless Edge 로 재현)
algoVersion 10 으로 추출된 책을 새 앱(11)으로 열면 배너("텍스트 엔진이 갱신되어 …")와 함께 자동 재추출이 돈다(지금 쪽 ±5쪽 우선). 그런데 **지금 보고 있는 쪽의 화면은 새 판이 저장돼도 옛 판으로 남는다** — 다른 쪽에 갔다 와야 바뀌고, 그 전에 재생하면 옛 읽기("& Pseudo- 1130")가 나온다. 8i 전부터의 리더 동작.

## 할 일 (spec 4-13-9 "8i-1" 줄)
1. 재추출(`js/pdf/extract.js` 의 `reextract` 경로)이 **지금 쪽**의 새 판을 저장하면, 리더가 그것을 알아채 **낭독 중이 아닐 때** 그 쪽을 다시 그린다. 스크롤 위치·선택된 줄(낭독 시작 위치)은 가능한 한 유지(줄 id 가 바뀌면 같은 글자 위치·같은 문단 순서로 가장 가까운 줄). 낭독 중이면 멈출 때(또는 쪽 끝)까지 미룬다.
2. 새 판이 아직 없는 쪽에서 재생을 누르면 옛 읽기를 내지 않는다 — 그 쪽 새 판 저장을 기다렸다(우선 처리 대상이라 짧다) 새 판으로 시작하거나, 같은 효과의 단순한 방법. 기다리는 동안 무엇이 보이는지(기존 상태 문구 재사용 — 새 i18n 키가 필요하면 4개 언어 모두).
3. 원본 보기에서도 같은 일(하이라이트 상자가 새 줄 좌표를 쓰는지).
4. 재추출이 아닌 평소 쪽 넘김·낭독·8h 인용·8i 행 표 동작 불변.

## 읽을 것
spec 4-13(특히 4-13-7 영향, 4-13-9), review.md 끝 "8i 행 표 Review"(재현 절차 (a)), `js/pdf/extract.js`, `js/ui/reader.js`, `js/ui/controls.js`, `js/tts/speaker.js`, 관련 i18n. 재현 도구: 스크래치패드 `shot-tool/`(puppeteer-core + Edge) 와 Review 가 쓴 `r8i/` — **프로필 `shot-profile/` 은 algoVersion 10 상태로 보존해야 하니 복사본을 써라.** 캐시 때문에 옛 index.html 이 뜰 수 있으니 캐시를 끄고 연다(Review 기록). 8000번 포트에는 레포 루트를 내보내는 서버가 이미 떠 있다 — 쓰되 끄지 마라. 진짜 키 금지(가짜 키·흉내 응답은 `shot-tool/step2.mjs` 참고).

## 검증
- 단위·통합 테스트 추가(지금 쪽 다시 그리기 조건: 낭독 중 미룸 · 멈춘 뒤 적용 · 다른 쪽 저장엔 반응 안 함 · 재생 대기). 전체 테스트 2회 이상.
- 변이 2개 이상(낭독 중에도 다시 그림 → 빨강, 지금 쪽이 아닌 쪽 저장에도 다시 그림 → 빨강). grep 적용 확인 → 스크래치패드 복사본으로 복원·`cmp`.
- headless 재현: algoVersion 10 프로필 복사본으로 30쪽을 연 채 재추출 → 다른 쪽에 가지 않고 재생 → 첫 발화가 "Thyroid Nodules & Multinodular Goiter" 한 덩어리인지, "& Pseudo- 1130" 0.
- `node apps/medreader/dev/stamp-importmap.mjs`, `--check` 0.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(훅이 막는다 — 새 폴더를 써라), npm 설치(이미 있는 `shot-tool/node_modules` 사용은 됨), `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열(PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 하나만), 원서 문장 40자 초과. 띄운 Edge 프로세스는 정리.
