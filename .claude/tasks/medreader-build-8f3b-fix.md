# Build 지침 — 8f-3b: 8f-3 Review 지적 고치기 (데이터 안전)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8f-3 Review" 절(8f3R-1~11) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8f3-vocab-ui.md` 의 규칙·금지는 그대로다. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8f3b-fix-report.md`. 스크래치패드 `b8f3b/`(Review 의 `r8f3/` 는 읽기만 — `probe-import`·headless 하네스 재사용 가능).

## 고칠 것 (원칙: 기기 데이터를 조용히 덮거나 지우지 않는다)
1. **중간-1 — 남은 삭제 리스너**: `askDelete` 의 리스너가 어떤 닫힘(`close()`·cancel·Esc·화면 떠남)에도 떼어지게 — 대화 하나에 리스너 한 벌, 대상 id 는 열 때 고정. `leaveVocab` 이 열린 대화를 닫을 때 같은 정리 경로를 타게. 편집 대화도 같은 꼴인지 보고 같이.
2. **중간-2 — 미리보기 뒤 편집을 덮음**: `applyImport`(또는 `planToApply`)가 적용 순간 기기 레코드를 **다시 읽어** 미리보기 때의 `updatedAt`(또는 내용 지문)과 다르면 그 항목은 적용하지 않고 "그사이 바뀜 — 건너뜀 n" 으로 알린다. `updatedAt` 을 더 이른 시각으로 되돌리는 일은 어떤 경우에도 없게.
3. **중간-3 — UTF-8 아닌 CSV**: `TextDecoder('utf-8', {fatal:true})` 로 읽고 실패하면 거절(사유: "UTF-8 CSV 로 다시 저장" 안내 — i18n 4언어, ar·fr `[검토 — Nour·운영자]`). UTF-16(BOM FF FE/FE FF)은 읽거나 같은 안내로 거절(작은 쪽). 디코딩 뒤 `U+FFFD` 가 든 값이 있으면 그 줄 거절. 미리보기 "바뀜" 항목에 기기 값 → 파일 값을 보인다(적어도 번역 칸).
4. 낮음-4: 일괄 번역 응답이 오기 전에 사용자가 같은 항목을 직접 고쳤으면(요청 때와 `updatedAt` 다름) 응답으로 덮지 않는다.
5. 낮음-5: 파일의 `updated` 가 지금보다 미래면 지금 시각으로 자르거나 충돌로(작은 쪽 — 이유를 보고서에).
6. 낮음-7: id 는 같은데 `target_lang` 이 기기 항목과 다르면 덮지 않고 거절(또는 새 항목 — 설계 4-6 과 맞는 쪽).
7. 낮음-6: 말없이 버려지는 파일 쪽 고침(일부만 번역된 머리 줄·깨진 따옴표 뒤 줄·유닉스 초 시각)은 거절 사유로 미리보기에 보이게(고치기 어려우면 사유만).
8. 낮음-8: 915×412 단어 시트에서 단추 줄이 sticky [닫기]에 가려 단추를 누르면 [닫기]가 눌림 — `css/reader.css` 를 이번엔 고쳐도 된다(시트 부분만). 단추가 다 보이거나 적어도 [닫기]와 겹치지 않게.

## 검증
- Review 의 재현(headless V1·V4, node I10·I11·I12·I3·I6·I5·B1·B2·B3)을 새로 돌려 고치기 전 재현 → 고친 뒤 0. 각 고침마다 시험 한 줄 이상.
- 회귀: 그대로 가져오기 0·0·n, 한 칸 고침 바뀜 1, 못 읽는 `updated` 충돌, 복습 필드 불변, 내보내기 바이트(BOM·CRLF·수식 접두·키 0), 8f-2 시트·8c-1·Esc 층, 번역 요청 본문 바이트 HEAD 와 같음.
- 변이 4개 이상(1·2·3 각각 되돌림 + 4 또는 6) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b8f3b/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시, `--check` 0, `git diff --check` 0.
- headless: Edge, pipe, 새 프로필 `b8f3b/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, 내려받기는 스크래치로만. 412×915 ko·915×412 ar. 콘솔 오류 0.
- spec 17-7-6 안 `[정정 2026-11-16 — 8f-3b]` 한 줄(Edit 로 그 자리만).

## 수정 범위
`js/ui/vocab.js`·`js/text/vocab.js`·`js/vocab/store.js`·`js/ui/wordsheet.js`(낮음-4 가 시트 쪽이면)·`css/reader.css`(시트 부분만)·`css/screens.css`·i18n 4개(새 거절 사유)·`tests/`·`index.html`(stamp)·`spec.md`(한 줄)·스크래치패드 `b8f3b/`·보고서. `pipeline.js`·`prompts.js`·`provider.js`·`db.js`·review.md·`dev/` 금지. 추적 안 된 `dev/measure-table-8i4.mjs`·`.claude/tasks/medreader-build-8c2-usage.md` 건드리지 마라.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리다). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
