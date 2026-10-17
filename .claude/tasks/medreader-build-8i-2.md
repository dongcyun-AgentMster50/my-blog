# Build 지침 — 8i-2 본문 이름표 2열 표를 행 단위로 읽기

> 너는 **Build 서브에이전트**다. 운영자가 spec **4-13-10** 을 승인했다(2026-10-17: D7 (가) 접음 · D8 (가) 대체 · D9 가드 없음 · D10 (가) R 없는 표에만).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8i-2-report.md`.

## 읽을 것
- spec **4-13-10 전체**(1–8절: 대상 전수, 규칙 R1b·R1c·R1d·R2b·R5b·R6b·(f), 채점, 영향, 결정, 7절 Build 나누기·테스트 RT20–RT32·변이 N1–N14·되돌림, 8절 못 함), 그리고 4-13 전체(8i 규칙 R1–R7)
- Plan 보고 `.claude/tasks/medreader-plan-8i-2-report.md`
- 시제품 `apps/medreader/dev/proto-rowtable-8i2.mjs`(규칙을 옮길 원본), 측정 `dev/measure-rowtable-8i2.mjs`, 정답표 `dev/rowtable-8i2-key.json`
- 앱: `js/text/rowtable.js`, `js/text/layout.js`, `js/text/blocks.js`, `js/config.js`(`ROWTABLE`), `js/pdf/extract.js`(algoVersion 11), 기존 테스트 `tests/rowtable*.test.mjs`

## 할 일 — spec 4-13-10 7절 순서 그대로
**(a) 어둡게 들이기**
1. 시제품 규칙을 `js/text/rowtable.js` 로 옮긴다. **모든 새 규칙은 R(쪽 번호 열) 없는 표 경로에만**(D10). 21–38쪽 경로는 한 줄도 바꾸지 않는다.
2. `config.ROWTABLE` 에 새 비율(spec 의 `HIDDEN_COL 0.2`·`ROW_GAP 1.1` 등 — 이름은 네 판단) 추가. `REQUIRE_REF` 는 **true 그대로** → 이 단계에서 앱 동작 불변.
3. 시제품이 남긴 틈(spec 8절·Plan 보고): **넓힌 띠·물려받은 띠에도 다열(숨은 열) 거르기를 다시 건다.**
4. 테스트 RT20–RT32(합성 픽스처, 원서 문장 금지, 지어낸 낱말). RT30·RT31(바이트 동일·되돌림 스위치) 필수.
5. `dev/measure-rowtable-8i2.mjs` 에 `--app` 모드: 앱 모듈을 (나) 설정(`REQUIRE_REF:false`)으로 돌려 **시제품과 같은 PageLayout** 을 내는지 18쪽 비교 + 21–38쪽 바이트 비교.
6. `node apps/medreader/dev/stamp-importmap.mjs`, `--check` 0. 전체 테스트 통과.
7. **(a) 끝 상태를 기록**: 이 시점의 `git diff --stat` 과 전체 테스트 수를 보고서에 적는다. (b) 에서 바꾸는 줄이 무엇인지(파일·줄) 정확히 적는다 — 오케스트레이터가 커밋을 (a)/(b) 둘로 나눈다.

**(b) 켜기**
8. `REQUIRE_REF: false`, `algoVersion` 12(주석에 8i-2 와 되돌림 규칙 "REQUIRE_REF:true 와 함께 지금 값 + 1"). 8i 의 되돌림 주석("ENABLED=false 와 12")을 "지금 값 + 1" 로 고친다.
9. 전권 재측정(세 권): 잡힌 쪽 = spec 의 18쪽(CMDT 45·365·484·587·810·1587–1589·1653·1658·1659·1661·1681–1683, Harrison 75·412·542) · 21–38쪽과 표 없는 쪽 **바이트 동일** · 정답표 채점 이름표·설명 줄·열 머리(기준 98% 이상) · 글자 보존(잃거나 는 글자 0) · 퀴즈 정답 연결 1,190 그대로.
10. stamp 다시, `--check` 0. 전체 테스트 2회.

## 검증
- 변이 N1–N14(spec 7절) → 각각 기대한 테스트가 빨강 → 복원 → `cmp`. 백업은 스크래치패드 `b8i2/bak/`. 살아남는 변이가 있으면 테스트를 보강하거나 이유를 적는다.
- **모든 실행에 시간 상한**(`timeout`, `--test-timeout`). 띄운 프로세스는 정리하고, 못 끄면 PID 를 보고한다.
- headless 브라우저는 이번 Build 에서 **하지 않는다**(Review 가 한다). 브라우저 프로필 복사 금지.
- 디스크: 큰 출력은 스크래치패드 `b8i2/` 에. 쓰기 전 `df -h /c`, **2 GB 아래면 멈추고 보고**.

## 수정 범위
`apps/medreader/js/text/rowtable.js`, `js/config.js`(`ROWTABLE`), `js/pdf/extract.js`(algoVersion·주석), 필요하면 `js/text/layout.js`(7b 호출부 — 최소한), `apps/medreader/tests/`(새 테스트), `apps/medreader/dev/measure-rowtable-8i2.mjs`(`--app` 모드), `index.html`(stamp 로만), 스크래치패드 `b8i2/`, 보고서. 리더·CSS·저장본은 고치지 않는다(spec: 재사용). 그 밖은 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.
