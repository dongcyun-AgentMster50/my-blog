# Plan 지침 — 9a 이어폰·잠금 화면 버튼 (Nour 필수 — 핸즈프리 1)

> 너는 **Plan 서브에이전트**다. 구현하지 않는다. 앱 코드·테스트를 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 spec `apps/medreader/spec.md` 17-1 안에 새 소절 **"17-1-x. 9a Build 설계"**(번호는 기존 소절 뒤로)와 보고서 `.claude/tasks/medreader-plan-9a-report.md`. 운영자 승인 전까지 소절 머리에 `[신설 2026-10-27 — 9a Plan, 운영자 결정 대기]`.

## 배경
19-1 의 9a 행: Media Session `play/pause/nexttrack/previoustrack` → 재생·멈춤·다음·이전, 필요하면 무음 오디오로 세션 잡기(17-1). 호출 0. `[가정]` 무음 오디오 필요 여부·버튼 이벤트 도달은 Nour 기기 실기기 확인. "6-4 hidden → 일시정지 규칙은 이번에 바꾸지 않는다". Nour 기기: Realme GT 7(412×915), Android Chrome 143(`.claude/tasks/medreader-8k-carryover.md`). 9b(음성 명령)가 이 위에 얹힌다.

## 따질 것
1. **지금 코드의 사실**(파일:행): speaker 의 재생 상태·다음/이전 단위 이동 함수, 6-4 의 `visibilitychange`(hidden → 일시정지) 규칙과 그 이유, Web Speech 가 화면 꺼짐·백그라운드에서 어떻게 되는지(spec 6-4·기존 실측), `navigator.mediaSession` 사용 여부(0 인지), 8d·8i-3 쪽 넘김·8m 목소리 전환·readalong 번역 단계(`tr` phase)와의 관계.
2. **핵심 쟁점 — 잠금 화면**: hidden → 일시정지 규칙을 그대로 두면 잠금 화면 버튼은 "화면이 켜진 채 이어폰 버튼"만 의미가 있다. Android Chrome 에서 (a) speechSynthesis 만으로 Media Session 알림·이어폰 버튼 이벤트가 오는지, (b) 무음 `<audio>` 재생이 필요한지, (c) 화면이 꺼지면 speechSynthesis 가 계속되는지 — 웹 문서·Chromium 이슈로 확인 가능한 것은 출처와 함께, 확인 못 한 것은 `[가정 — 실기기]`. 선택지 비교(예: (가) 화면 켜짐 전제 — 이어폰 버튼만 · (나) 무음 오디오로 세션 잡고 hidden 규칙 유지 · (다) hidden 규칙을 바꿔 잠금 중 계속 읽기 — 6-4 를 다시 여는 것) 와 권장.
3. **버튼 대응**: play/pause/next/previous(+ `seekforward`/`seekbackward`·`stop` 쓸지) → 문장 단위 이동, 번역 단계 중일 때 next 의 뜻, 쪽 끝에서 next(8i-3), 이어폰 한 번/두 번/세 번 누름이 Android 에서 어느 액션으로 오는지 `[가정 — 실기기]`.
4. **알림 화면 메타데이터**: 제목(책·쪽), 아트워크(앱 아이콘 — 8j PNG), `playbackState`, 위치 상태(`setPositionState` 쓸지 — 문장 수 기준인지).
5. **실기기 확인 도구**: 8k-0 진단 페이지처럼 Nour 가 버튼을 눌러 보고 결과를 보내 줄 `dev/` 진단 페이지가 필요한지(어떤 이벤트가 오는지 기록) — 필요하면 9a 를 9a-0(진단, 먼저 배포) + 9a 로 나누는 안. 운영자 Galaxy Z Fold 7 에서 먼저 확인할 것.
6. 수용 기준 `[N]`·`[D]`·`[M]`, 테스트 방법(headless 에서 `navigator.mediaSession` 흉내), 크기·시간, 결정 표(9-D1… 선택지·권장·이유).

## 규칙
읽기·조사만. 웹 조사는 해도 된다(출처 남기기). 앱 코드·테스트·review.md 수정 금지 — spec 은 17-1 새 소절과 19-1 9a 행에 `[수정 2026-10-27 — 9a Plan]` 표시만. 모든 실행에 시간 상한(하나에 10분 넘지 않게), 표준 입력을 기다리는 명령 금지. 스크래치패드는 `p9a/` 만. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 8000·8123·8124·8125번 서버 건드리기, 진짜 API 키.
