# Build 지침 — 8i-1 이어서 (변이 · 원본 보기 재현 · 전체 테스트)

> 너는 **Build 서브에이전트**다. 앞선 8i-1 Build 가 C: 드라이브가 가득 차서 중간에 멈췄다. 코드 수정은 끝났고, **검증만 남았다.**
> **커밋하지 않는다.** 한국어로 쓴다. 먼저 `.claude/tasks/medreader-build-8i-1.md`(원래 지침)와 `.claude/tasks/medreader-build-8i-1-report.md`(앞 보고서)를 읽어라.
> 보고는 앞 보고서 끝에 **"## 6. 이어서 (8i-1b)"** 절을 덧붙인다. 앞 절은 고치지 않는다.

## ⚠️ 디스크 규칙 (가장 중요)
C: 는 466 GB 중 남은 공간이 **약 3.4 GB** 뿐이다. 스크래치패드도 C: 에 있다.
- **복사 전마다** `df -h /c` 로 남은 공간을 본다. **2 GB 아래면 복사하지 말고 멈춰서 보고한다.**
- 프로필 전체(`shot-profile/`, 약 300 MB)를 복사하지 마라. **`shot-profile/Default/` 폴더만**(약 40 MB) 새 폴더 `b8i1b/pN/Default/` 로 복사해 쓴다(IndexedDB 는 `Default/IndexedDB` 안에 있다). 이걸로 Edge 가 옛 판 책을 못 읽으면 그때만 전체를 **딱 한 번** 복사한다.
- 새 프로필 복사본은 **모두 합쳐 3개까지**. 같은 실행을 되풀이하려고 복사본을 늘리지 마라.
- `rm -rf` 는 훅이 막는다. 막히면 변형 명령을 찾지 말고, 지워야 할 경로를 보고서에 적어라.
- 셸 출력이 "No space left on device" 로 실패하면 즉시 멈춘다.

## 원본 상태 먼저 확인
`shot-profile/` 크기가 574 MB → 302 MB 로 줄었다(Edge 가 부속 캐시를 지운 것으로 보이며, `Default/IndexedDB` 22 MB 는 10월 13일 그대로다). 첫 재현에서 화면 기록의 첫 렌더가 **옛 판**(이름표 0 · "Pseudo- 1130" 줄 1)인지 확인한다. 옛 판이 아니면(이미 11 로 저장돼 있으면) 재현을 멈추고 보고한다. `shot-profile/` 자체는 읽기만 하고 절대 Edge 의 `userDataDir` 로 쓰지 마라.

## 할 일
1. **변이 V1–V4** (앞 보고서 3절 계획대로). 바꾸기 전에 대상 파일을 스크래치패드 `b8i1b/bak/` 에 복사 → 변이 → grep 으로 적용 확인 → 해당 테스트 실행(빨강 기대) → 복원 → `cmp` 로 원본과 같음 확인. 각 변이 결과(빨간 테스트 이름)를 표로.
2. **headless C — 원본 보기**: `b8i1/scripts/repro.mjs` 를 `b8i1b/scripts/` 로 복사해 고친다. 원본 보기 설정을 **부팅 전**(evaluateOnNewDocument 에서 localStorage 등)에 넣는다. 확인할 것: 다시 그린 뒤 원본 보기 캔버스가 새 판 layout 을 쓰는지, 멈춘 자리 하이라이트 상자가 쪽 번호 칸에 닿지 않는지, 첫 발화가 "Thyroid Nodules & Multinodular Goiter" 한 덩어리인지, "& Pseudo- 1130" 든 발화 0.
3. 가능하면 같은 복사본 방식으로 **B 를 한 번 더**(옛 판 화면에서 바로 재생 → 대기 → 새 판 첫 발화). 디스크 규칙 안에서만.
4. **전체 테스트 2회**: `node --test apps/medreader/tests/*.test.mjs` → 1026/1026 기대. `node apps/medreader/dev/stamp-importmap.mjs --check` 0.
5. 띄운 Edge 는 `finally` 에서 닫고, 끝나고 `tasklist` 로 headless `msedge.exe` 가 남지 않았는지 확인.

## 수정 범위
- 앱 코드는 **변이(되돌릴 것)만** 건드린다. 변이에서 예상과 다른 결과가 나와 코드에 문제가 보이면 **고치지 말고 보고**한다.
- 쓰는 곳: 스크래치패드 `b8i1b/`, 앞 보고서 끝 절.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치(`shot-tool/node_modules` 사용은 됨), `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열, 원서 문장 40자 초과. 8000번 서버는 쓰되 끄지 마라.
