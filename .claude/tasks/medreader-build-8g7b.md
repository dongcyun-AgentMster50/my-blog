# Build 지침 — 8g-7b: 8g-7 Review 수정 (오탐 두 꼴 + 조각 캐시)

> 너는 **Build 서브에이전트**다(8g-7 Build·Review 와 다른 새 에이전트). 8g-7 은 아직 커밋 전이다 — 작업 트리의 8g-7 변경 위에 고친다. 근거: `apps/medreader/review.md` 맨 끝 **"8g-7 Review"**(8g7R-1–11) — 판정 "조건부 통과, (가) 고친 뒤 배포". 운영자 방침: 권장대로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8g7b-report.md`.

## 할 일 (이것만)
1. **중1 형용사꼴 접기 오탐**: «الجهاز المعدي المعوي» 가 감염 장으로 가는 문제. gi 별칭에 «المعدي المعوي» 를 더하고(가장 긴 별칭 우선으로 이김), «قرحة معدية»·«النزف المعدي» 같은 꼴도 gi(또는 없음)로 가는지 확인. 필요하면 일반 규칙으로 — 책·질의별 예외 목록 금지.
2. **중2 "검색어를 품은 별칭" 폴백 오탐**: 폴백 대응을 **검색어 낱말이 별칭의 첫 낱말일 때만**으로 좁힌다. heme 별칭 «الأمراض الدموية» 추가. «الصحة»·«نقص» 가 여러 장으로 퍼지지 않는지.
3. 새 별칭에 `[검토 — Nour·운영자]`.
4. **중3 (8g 옛 버그)**: `ui/search.js` 조각 캐시 `S.snips` 키에 검색어가 없고 비우지 않아, 같은 책에서 검색어를 바꾸면 앞 검색어의 조각·`<mark>` 가 남는다 → 키에 검색어(정규화된 것)를 넣거나 검색어가 바뀌면 비운다. 라틴 결과 JSON·첫 검색 화면은 그대로여야 한다.
5. **하 — 폴백 목차의 "장" 묶음 머리**: 개요 없는 책(폴백 목록)에서 나온 묶음이면 머리에 목차 탭과 같은 "틀릴 수 있음" 안내 한 줄(기존 i18n 키 재사용 — 새 키가 필요하면 ×4, ar·fr `[검토]`).
6. 테스트: Review 가 지적한 빈틈 R1("찾지 못했습니다" 줄 숨김)·R2(넓은 대응 상한) + 위 1·2 의 질의(«الجهاز المعدي المعوي» → gi, «الأمراض الدموية» → heme, «الصحة»·«نقص» 퍼지지 않음) + 4(검색어 바꾼 뒤 조각에 앞 검색어 `<mark>` 없음) + 5. 라틴 golden 그대로 초록.
7. stamp 다시, `--check` 0. spec 19-1-4 2-4 의 8g-7 정정 단락 끝에 `[정정 2026-10-27 — 8g-7b]` 한 줄.

## 검증
- Review 의 질의 153개(`r8g7/ar-out.txt` — 스크래치패드, 읽기만) × 세 권 실물 개요로 다시 돌려 **틀린 장 0**, 바뀐 줄 목록을 보고서에. 라틴 검색어 = HEAD(`c6352a4`) 재확인(Build 의 golden + 세 권 표본).
- headless Edge(아랍어 UI 412×915 · 새 프로필 1–2개 · 가짜 키): 1·2·4·5 를 화면으로, 콘솔 오류 0. 8000번 python 은 지금 **PID 45964** — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지. 띄운 Edge 는 `browser.close()` 로 닫고, 보고서에 닫았음을 적는다.
- 변이 2개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `b8g7b/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1374 + 새).
- **모든 실행에 시간 상한**(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지. C: 남은 공간 5GB 아래면 멈추고 보고.

## 수정 범위
`js/text/specialty.js`, `js/ui/search.js`, `js/i18n/*`(필요할 때만), `css/*`(필요할 때만), `index.html`(stamp), `tests/`, `spec.md`(한 줄), 스크래치패드 `b8g7b/`, 보고서. DB 버전·algoVersion·`SEARCH.VERSION`·`OUTLINE_V`·캐시 키·`PROMPT_VERSION` 불변. review.md 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive` 로 스크래치패드에), `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
