# Review 지침 — 공개 전 묶음 (P1: 저장 경합·원본 해상도·키 가리기 / P2: CMDT 러닝 헤드)

> 너는 **Review 서브에이전트**다. 두 Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "공개 전 묶음" 절로 덧붙인다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.
> 이 묶음이 끝나면 **Nour 에게 공개**한다. 실사용자가 처음 받는 판이다 — 그 기준으로 본다.

## 읽을 것
- 지침: `.claude/tasks/medreader-build-prerelease-p1.md`, `-p2.md`. 보고: `-p1-report.md`, `-p2-report.md` — **검증 대상**
- spec: 4-7(header 행 — 오케스트레이터가 P2 결과로 갱신), 9-2·9-4, 12-5, 8-4 `[수정 2026-10-12]`, 13절
- `review.md` 의 "7c + 8a 후속"(경합 재현 방법), "8b"(최근 기준)
- `git diff` — 이번 두 Build 의 변경

## 오케스트레이터가 이미 잰 것 (다시 재도 된다)
- P1 보안: `.`·`~`·`+/=` 가 든 가짜 키가 `redactString`·`ProviderError.message` 모두 `[KEY]`. "AQ.1 level is fine" 은 그대로.
- P2 본문 손실: 세 책 3쪽 간격, algoVersion 9(HEAD) 대 10. CMDT 2026 줄어든 쪽 583, 쪽당 손실 중앙값 26자·p95 63자(머리말 한 줄 크기), 최대 208쪽 178자 — 직접 보니 머리말 2줄 + **원래 표인 줄 3줄이 이제 표로 잡힘**(표 7-2 — 이전엔 본문으로 잘못 낭독). Harrison·CMDT 2021 손실 0.

## 특히 볼 것
- **P2 본문 손실을 다른 방법으로**: 문장 단위가 아니라 **역할이 바뀐 줄 전부**를 세 책 전수(또는 1쪽 간격)로 — `body/heading/question/option/answer → header/table/footer` 로 바뀐 줄의 수와 표본. Build 가 말한 "머리말 바로 아래 첫 줄이 heading → body 로 바뀐 182줄"(그림 설명·참고문헌·표 칸이라 했다)도 표본 확인. **본문이 낭독에서 빠지는 쪽**(→ header/table/footer)이 하나라도 있으면 그 줄을 진단 조각(40자 이하)과 함께 보고. 원서 문장을 길게 옮기지 마라.
  pdf.js: `MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`, 공용 `apps/medreader/dev/measure-lib.mjs`, P2 가 남긴 `dev/probe-running-heads.mjs`·`dev/compare-quiz.mjs`. PDF 는 세 개만(**다운로드 폴더 목록 금지**): `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`. 비교 기준(algoVersion 9)은 `git archive HEAD apps/medreader/js` 를 스크래치패드 새 폴더에 풀어 쓴다(`rm -rf` 금지 — 새 폴더 이름으로).
- **퀴즈 회귀**: Harrison 정답 연결 1186 → 1190(Build). 실제로 섹션·문항·verified 수가 나빠지지 않았는가(`compare-quiz.mjs`).
- **재추출**: algoVersion 10 이면 저장된 문서가 다시 추출된다 — 그 경로가 정말 돌고(가짜 문서에 algoVersion 9 쪽을 넣고 열기), 재추출 중에도 읽기·낭독이 되며, **P1 의 `db.patch` 와 겹쳐도 사용자 선택(원문 언어)·마지막 쪽이 유지**되는가(재추출이 `_saveMeta` 를 많이 부른다).
- **P1 경합**: 5곳 각각 "자기 필드만" — Build 표를 코드와 대조. 지연 주입 재현이 고친 뒤 초록인가.
- **P1 보안**: 키를 모르는 가리기 경로(Build 보고: `main.js` boot 실패 `console.error` 는 지우개를 거치지 않음) — 실제로 키가 거기까지 갈 수 있는 경로가 있는가. 있으면 고쳐라(`main.js` 의 그 줄만 허용).
- **P1 해상도**: dpr 3·66% → 비율 3.0, 3.0× 확대 → 예산 안. 원본 뷰 B3(쪽 끝이 띠 위) 유지.
- **배포 반쪽 상태**(P1 보고): 첫 로드에 캐시된 옛 `redact.js` + 새 `provider.js` 가 섞여 SyntaxError 가 한 번 났다. GitHub Pages 는 파일을 약 10분 캐시한다. 이번 배포는 바뀌는 파일이 많다. **앱이 이 상태에서 어떻게 보이는가**(흰 화면? 오류 안내?) — 사용자가 새로고침으로 회복할 수 있다는 것이 화면에서 드러나는가. 개선안은 의견으로(구현은 하지 마라).
- 회귀: 설정 화면·시험 번역·드롭다운, 리더 낭독·띠(8b), 원본 뷰, 퀴즈 진입. 키 누출 0, 콘솔 0, 360px 가로 스크롤 0.
- 테스트: 전체 3번 이상, 동시 실행도. 변이: 두 Build 의 것 중 각 2개 이상 재현 + 새것 2개 이상, 적용 grep 확인 후, 스크래치패드 복사본으로 복원·cmp(`git checkout`·`restore`·`stash` 금지).

## 고쳐도 되는 것
두 Build 가 바꾼 파일 안의 결함 수정, `main.js` 의 boot 실패 로그 한 줄(키 가리기). `spec.md`·4절 규칙의 방향 변경·`js/quiz/*` 파서는 고치지 않는다(보고). npm 설치 금지.

## review.md 절
결론 · P2 본문 손실(역할 바뀐 줄 전수) · 퀴즈 회귀 · 재추출 + 경합 · P1 경합·보안·해상도 · 배포 반쪽 상태 화면과 의견 · 회귀 · 테스트·변이 · 고친 것/기록만 · **Nour 공개 전 운영자가 할 일**(배포 후 대기 시간 등).
