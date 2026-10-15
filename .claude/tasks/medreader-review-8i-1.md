# Review 지침 — 8i-1 (재추출 중 "지금 보고 있는 쪽"을 새 판으로) · 8i-1b · 8i-1c

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **맨 끝**에 기존 "8i 행 표 Review" 절들과 같은 꼴로 **"8i-1 Review"** 절을 덧붙인다. 앞 절은 고치지 않는다.

## 읽을 것
- 지침: `.claude/tasks/medreader-build-8i-1.md`, `-8i-1b.md`, `-8i-1c.md`
- Build 보고: `.claude/tasks/medreader-build-8i-1-report.md` (1–7절)
- spec 4-13(특히 4-13-9 "8i-1" 줄), review.md 끝 "8i 행 표 Review"(재현 절차)
- 변경: `git diff` (index.html · config.js · extract.js · speaker.js · controls.js · reader.js · spec.md) + 새 `tests/refresh-8i1.test.mjs`

## 확인할 것
1. **spec 대로인가**: 지금 쪽 새 판 저장 → 낭독 중 아니면 다시 그림 · 낭독 중이면 멈출 때까지 미룸 · 다른 쪽/다른 문서 저장엔 무반응 · 옛 판 쪽에서 재생 → 옛 읽기 없이 새 판을 기다려 시작 · 스크롤·선택 줄 유지 · 원본 보기도 같음.
2. **불변**: 평소(옛 판 아닌) 쪽 넘김·낭독, 8h 인용 건너뛰기, 8i 행 표, 멈춤 → 재생은 그 문장 처음부터(기존), 뷰 전환·원문 언어 변경 시 `reload()`.
3. **코드 문제**: 경쟁 조건(특히 `renderToken` · `refreshing` · `freshGen` 세대가 엇갈리는 경우), 문지기 구독 누수(`leaveReader` 뒤), 20초 상한 뒤 상태, 예외 갈래(db 오류·깨진 저장본)에서 `refreshing`·`stale` 이 남는지, 안드로이드 제스처 밖 첫 `speak()`(8i-1 보고 5절 (a)).
4. **테스트의 힘**: RF1–RF23 이 실제 동작을 묶는가, 흉내(RF20–23)가 실제 `renderPage` 순서와 어긋날 여지. 너만의 변이 2개 이상(Build 가 안 한 곳) → 빨강 확인 → 복원 → `cmp`.
5. **Build 가 남긴 문제 판정** (보고서 6·7절 "남은 문제"): 특히 7절 1번 — 원본 보기에서 **평소 쪽 넘김** 때도 `desc` 를 `paintView` 앞에서 세워 다음 쪽 첫 문장을 두 번 읽을 수 있다는 주장. **headless 로 재현을 시도**하고(원본 보기 · 쪽 끝까지 낭독 → 다음 쪽), 재현되면 증거와 함께 "8i 이전부터 있던 문제인지"를 판정해 운영자 결정 사항에 올린다.
6. **headless 재현** (Edge · 412px · 캐시 끔 · 흉내 음성): 리플로우 B 와 원본 보기 C2 를 **네 스크립트로** 한 번씩. 첫 발화 "Thyroid Nodules & Multinodular Goiter" 한 덩어리 · "& Pseudo- 1130" 든 발화 0 · 같은 문장 연속(멈춤 → 재생 제외) 0 · 원본 상자가 쪽 번호 칸에 닿지 않음. 스크린샷 몇 장(`shots-8i1/` — 기존 `shots-8i/` 와 같은 자리 규칙을 따른다. 위치가 앱 폴더 밖이면 스크래치패드).
   - Build 스크립트(`b8i1c/scripts/`)는 참고만 하고, 판정 코드는 직접 쓴다.
   - 원본 `shot-profile/` 에는 PDF 블롭이 없다. 복사본에 `b8i1b/scripts/restore-blob.mjs` 로 되넣는다. `shot-profile/` 자체는 읽기만 한다.
   - 8000번 서버(`python -m http.server`, PID 34392)가 있으면 쓰고 끄지 마라. 없으면 레포 루트에서 같은 방식으로 띄우고 켜 둔다.
7. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1031 기대), `node apps/medreader/dev/stamp-importmap.mjs --check` 0.

## ⚠️ 디스크 규칙
C: 남은 공간 **약 3.4 GB**. 복사 전마다 `df -h /c`, **2 GB 아래면 복사하지 말고 멈춰서 보고**. 프로필은 `shot-profile/Default/` 만 복사(스크래치패드 `r8i1/pN/Default/`), 새 복사본은 **모두 합쳐 3개까지**. `rm -rf` 가 막히면 변형 명령을 찾지 말고 지울 경로를 기록한다. "No space left on device" 면 즉시 멈춘다.

## 수정 범위
- **앱 코드는 고치지 않는다**(변이는 되돌린다). 문제를 찾으면 심각도·재현 절차·고칠 방향을 review.md 에 적는다 — 수정은 오케스트레이터가 따로 Build 에 맡긴다.
- 쓰는 곳: `apps/medreader/review.md` 끝 절, 스크린샷 폴더, 스크래치패드 `r8i1/`.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치(`shot-tool/node_modules` 사용은 됨), `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열(PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 하나만), 원서 문장 40자 초과. 띄운 Edge 는 정리하고 끝에 `tasklist` 로 headless `msedge.exe` 가 없는지 확인.
