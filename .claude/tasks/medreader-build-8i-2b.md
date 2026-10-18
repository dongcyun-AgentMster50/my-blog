# Build 지침 — 8i-2b D10 구멍 막기 + 테스트 보강 (실물 출력 불변)

> 너는 **Build 서브에이전트**다. 운영자가 8i-2 Review 권장(review.md "8i2R-9" 1번)을 승인했다(2026-10-18). 8i-2 는 커밋됨(`1e6f168`·`b37c21f`, 미푸시).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8i-2b-report.md`.
> **세 권 실물 출력은 한 바이트도 바뀌지 않아야 한다** → `algoVersion` 은 12 그대로.
> **`spec.md` 는 건드리지 않는다**(다른 Plan 이 동시에 spec 을 고친다). spec 에 적을 것이 있으면 보고서에 문안으로 남겨라.

## 읽을 것
`apps/medreader/review.md` 맨 끝 "8i-2 Review" 절 — 특히 **8i2R-6 B(D10 구멍)**, **8i2R-7(변이 V1–V6)**, 8i2R-9. spec 4-13-10(규칙·D10). `js/text/rowtable.js`(`inheritFrom`·`det.R`·2열 경로 분기), `js/config.js`(`ROWTABLE.REQUIRE_REF`), `tests/rowtable-8i.test.mjs`·`tests/rowtable-8i2.test.mjs`. Review 의 합성 재현·변이 스크립트: 스크래치패드 `r8i2/repro.mjs`·`mut.mjs`·`mutreal.mjs`.

## 할 일
1. **D10 구멍 막기**: R(쪽 번호 열) 있는 표가 R7 로 아래 띠에 행을 물려줄 때, 그 띠에 쪽 번호가 하나도 없으면 `inheritFrom` 이 빈 R 열을 걸러 `det.R` 이 비고, 2열 규칙(`!det.R.length` 로만 갈림)이 걸린다 — **`REQUIRE_REF:true` 에서도**. 고칠 방향(Review): "이 띠는 2열 경로다"라는 표시(예: `det.two`)를 판정 때 만들어 물려주고, 2열 규칙은 그 표시와 `REQUIRE_REF` 를 함께 본다. R 표에서 물려받은 띠는 2열 경로가 아니다.
2. **테스트 보강**:
   - Review 합성 재현을 픽스처로: R 표 → 쪽 번호 없는 물려받은 띠 → 8i 와 JSON 바이트 동일(`REQUIRE_REF` false·true 둘 다). (예: RT30b)
   - 살아남은 변이 **V2**(역할 유지에서 figure-caption 안 지킴) · **V3**(R2b "앞 아이템이 P 시작 전에 끝남" 조건) · **V4**((f) 숨은 열 가드를 R 표에도) · **V5**(R6b "P 줄 위에 이름표 열·구획 밖 조각이 있으면 아니다") · **V6**(R1b 캡션 끊기를 R 표 띠에도)를 각각 빨갛게 만드는 합성 픽스처. V4·V6 은 RT30 류(R 표 + 캡션·P 열 여러 run)로.
3. `node apps/medreader/dev/stamp-importmap.mjs`, `--check` 0.

## 검증
- **실물 불변**: 세 권 전권을 `dev/measure-rowtable-8i2.mjs --app`(또는 Review 의 `r8i2/full.mjs` 방식)으로, 커밋 `b37c21f` 의 앱 모듈 출력과 **바이트 비교 → 다른 쪽 0**. pdf.js 는 8i-2 Build·Review 가 쓴 것과 같은 경로(Build 보고서 참고 — 이 기계의 pdfjs-dist 5.6.205). npm 설치·다운로드 금지.
- 변이: Review 의 V2–V6 을 다시 걸어 **모두 빨강** + D10 고친 부분을 되돌리는 변이 → 새 테스트 빨강. 복원 → `cmp`. 백업은 스크래치패드 `b8i2b/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회 — 1063 + 새 테스트.
- **모든 실행에 시간 상한**(`timeout`, `--test-timeout`). 띄운 프로세스는 정리, 못 끄면 PID 보고. 브라우저·프로필 복사 없음.

## 수정 범위
`apps/medreader/js/text/rowtable.js`, `apps/medreader/tests/`(rowtable 테스트), `index.html`(stamp 로만), 스크래치패드 `b8i2b/`, 보고서. `config.js` 는 필요할 때만(새 설정 키 금지 — 기존 키 재사용). spec·review·그 밖은 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
