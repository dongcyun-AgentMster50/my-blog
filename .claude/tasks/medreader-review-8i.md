# Review 지침 — 8i 표를 행 단위로 읽기

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "8i 행 표 Review" 절로 덧붙인다. **커밋하지 않는다.** 한국어로 쓴다.

## 읽을 것
- spec **4-13 전부**(승인 4-13-9), Build 보고 `.claude/tasks/medreader-build-8i-report.md`(특히 "지침·시제품과 다르게 한 곳" 8개와 남은 위험), `git diff` + 새 파일(`js/text/rowtable.js`, `tests/rowtable-8i.test.mjs`, `dev/measure-rowtable-8i.mjs`). `spec.md` diff 는 Plan·오케스트레이터 기록이니 무시.

## 오케스트레이터가 이미 독립 확인한 것
테스트 1004/1004 · stamp `--check` 0 · HEAD 사본과 레이아웃 직접 비교(algoVersion 필드 제외): CMDT 2026 307쪽 중 다른 쪽 = 정확히 21–38쪽, CMDT 2021 203쪽·Harrison 73쪽 다른 쪽 0 · 30쪽 단위: Thyroid…Goiter 한 덩어리 → 내용 → cite → CHAPTER 30 → Hypoparathyroidism & Pseudohypoparathyroidism → 내용 …, 쪽 번호만인 단위 0.

## 특히 볼 것
1. **Build 가 시제품·지침과 다르게 한 8곳** — 각각 타당한가, 다른 쪽에 부작용이 없는가(특히 `EDGE_ZONE` 0, 열 머리 60자 줄마다, 행 동기 허용폭 비율화, 정렬을 띠마다).
2. **21–38쪽 18쪽 눈 검토** — 쪽마다 행(이름표 → 내용) 목록을 40자 이하로 뽑아, 이름표와 내용이 다른 행과 엇갈린 곳, 내용이 빠지거나 두 번 나온 곳, 쪽 번호가 낭독에 남은 곳을 센다. 기준 0(알려진 흠 — 두 줄 장 제목 둘째 줄 홀로 서기, 쪽 아래 "YRx" 붙음, "∗See chapter…" 각주 — 은 따로 센다).
3. **브라우저 실동작**(로컬 정적 서버, 360px·412px, 진짜 키 금지). 오케스트레이터가 캡처용으로 만든 도구를 써도 된다: 스크래치패드 `shot-tool/`(puppeteer-core + Edge, 프로필 `shot-profile/` 에 **CMDT 2026 이 algoVersion 10 으로 추출된 채** 들어 있다. 흉내 음성·흉내 번역 응답·가짜 키 저장 절차는 `shot-tool/step2.mjs` 참고. 서버는 `python -m http.server 8000` 을 레포 루트에서 — 띄웠으면 끝나고 끈다). 확인:
   - (a) **판 바뀜 → 재추출 경로**: 그 프로필로 앱을 열면 algoVersion 10 문서가 어떻게 되는가(자동 재추출 안내? [텍스트 다시 추출] 필요?), 재추출 뒤 30쪽이 행 단위인가, 사용자 데이터(마지막 쪽·원문 언어·번역 캐시) 유지.
   - (b) 30쪽 리플로우: `rowhead` 표시(구분·굵기), 주제 끝 회색 쪽 번호(D4), 열 머리 접힘(D3), 낭독 하이라이트가 행 순서로 움직이는가, 띠 번역이 주제 한 덩어리로 나오는가.
   - (c) 30쪽 원본 보기: 하이라이트 상자가 맞는 줄을 칠하는가, 쪽 번호 칸을 칠하지 않는가.
   - (d) 회귀: 표 없는 쪽(예: 300쪽), 8h 인용 건너뛰기, 콘솔 0, 가로 스크롤 0.
   캡처 몇 장을 스크래치패드 `shots-8i/` 에 남겨라(오케스트레이터가 운영자 가이드에 쓸 수 있게 — 30쪽 리플로우 낭독 중, 원본 낭독 중).
4. 재추출 시간: 데스크톱 브라우저에서 CMDT 2026 전권 재추출 시간을 재고, 폰 추정을 다시 적어라.
5. 테스트 3회 + 동시 실행, 변이 M1–M12 중 3개 재현 + 새 변이 2개 이상(예: R7 (e) 상한 0.3→1.0, `ref` 줄을 낭독에 포함). grep 적용 확인 → 스크래치패드 복사본으로 복원·`cmp`.

## 고쳐도 되는 것
8i 가 바꾼/만든 파일 안의 결함. 고치면 `node apps/medreader/dev/stamp-importmap.mjs` 다시. `spec.md` 는 고치지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치, `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열, 원서 문장 40자 초과.
PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`.

## review.md 절
결론 · 다르게 한 8곳 판정 · 21–38쪽 눈 검토 · 브라우저(a)–(d) · 재추출 시간 · 테스트·변이 · 고친 것 / 기록만 · 운영자 결정 필요 사항.
