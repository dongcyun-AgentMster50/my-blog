# Review 지침 — ds-level2 학습앱

## 너의 역할

`/home/user/my-blog/apps/ds-level2/`에 구현된 "데이터 사이언스 레벨2 학습앱"의 **Review 단계** 담당이다. Build 에이전트와는 별개의 눈으로 검증한다. 설계 문서 `apps/ds-level2/spec.md`(특히 10절 체크리스트)와 프로젝트 규칙 `/home/user/my-blog/CLAUDE.md`를 먼저 읽어라.

## 수정 허용 범위

- 생성: `apps/ds-level2/review.md`
- 수정(발견한 문제를 고칠 때만, 최소 변경): `apps/ds-level2/` 안의 엔진 파일(`index.html`, `style.css`, `js/*`, `tools/*`)과 콘텐츠 파일(`data/*.js`)
- **금지**: `spec.md`, 블로그 본체(루트 `index.html`, `css/`, `js/`, `posts/`, `vendor/`, `apps/2048/`), `.nojekyll`, `.claude/`. git 명령 금지(커밋은 부모가 한다). `apps/ds-level2/.claude/`는 임시 후크 복사본이니 건드리지 마라.
- Bash가 후크 경로 오류를 내면 cwd가 `apps/ds-level2`로 바뀐 것이다. 명령은 절대경로로 쓰고 `cd`는 하지 마라(복사본 후크가 있어 그대로 재시도하면 통과한다).

## 환경

Python 3.11 + pandas 3.0.6 / numpy 2.4.6 / scikit-learn 1.9.1 / scipy 1.17.1 / statsmodels 0.15.0. Node 22. Chromium: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`(playwright npm 패키지는 없을 수 있다 — `ls /opt/pw-browsers`로 바이너리를 찾아 `--headless --dump-dom` / `--screenshot` 으로 쓰거나, Node에서 `require('playwright')`가 되면 그걸 써라. `playwright install`은 하지 마라). 로컬 서버: `python3 -m http.server 8000 --directory /home/user/my-blog &`.

## 검증할 것 (spec 10절 A·B 전부) — 결과를 review.md에 체크리스트로

### A. 엔진
1. `node /home/user/my-blog/apps/ds-level2/tools/validate.js` 전체 실행 → ERRORS 0 확인. 경고(특히 term-conflict)는 목록화.
2. 모든 `data/*.js` 실습을 `tools/extract_practice.js` + `tools/verify_practice.py`로 **전부 재실행** → 전부 PASS.
3. 브라우저(헤드리스 크로미움)로 `http://localhost:8000/apps/ds-level2/index.html` 열어: 콘솔 에러 0, `DS2.warnings` 수, 라우트 `#/`, `#/tree`, `#/topic/a-1-1`, `#/topic/a-2-3/quiz`, `#/topic/b-1-2`, `#/wrong`, `#/review`, `#/exam`, `#/glossary`, `#/settings`가 렌더되고 잘못된 id(`#/topic/zzz`)는 홈으로. 트리에 31개 학습 노드가 색인 제목 그대로 보이는지(curriculum.js vs `.claude/tasks/ds-level2-plan.md`의 색인 대조).
4. 퀴즈 1세션을 스크립트로 완주(보기 클릭 → 정답 확인 → 다음)하고 localStorage `apps.ds-level2.progress.v1`에 기록·라이트너 상자·due가 맞게 생기는지. 틀린 문제가 `#/wrong`에 나타나고 다시 맞히면 사라지는지.
5. 순수 함수 단위 테스트(Node 또는 브라우저 콘솔 `window.__DS2`): grader(mcq/ox/short 정규화, number 반올림·쉼표, int "42.0"), leitner(오답→상자1, 첫 정답→상자2, 연속 정답→상자4 졸업), exam.buildExam(20/40, 노드 편중 ≤3, seed 재현), 노드 상태 계산(완료 조건).
6. 모의고사: 설정→진행→제출→결과 리포트 노드별 합계 = 총점, 새로고침 후 진행 복구, 타이머.
7. `.ipynb`: 토픽·챕터 노트북 생성 결과를 파일로 받아 `python3 -c "import json; ..."`로 nbformat 4·셀 id 유일·code 셀 outputs/execution_count 확인(`nbformat` 패키지가 있으면 `nbformat.validate`도).
8. 내보내기 JSON → 가져오기(병합·덮어쓰기), 손상 JSON 복구, localStorage 차단 시(브라우저에서 `localStorage` 접근을 throw하도록 오버라이드) 앱 동작 + 설정 경고 문구.
9. 모바일 뷰포트 360×640·390×844 스크린샷: 하단 탭바가 콘텐츠를 가리지 않음, 코드 블록 가로 스크롤, 퀴즈 중 탭바 숨김. 데스크톱 1280 스크린샷. 다크 모드(`?theme=dark`) 스크린샷. 임베드(`?embed=1`, 320×427) 스크린샷 — 컴팩트 홈 + 전체화면 링크.
10. `file://`로 열었을 때 깨지는 코드(fetch, type=module, 절대경로)가 없는지 grep. 외부 요청 0(네트워크 로그), `../` 참조 없음, 전역은 `DS2`/`__DS2`뿐. `data/_sample.js`가 삭제되었고 `index.html`에 그 태그가 없는지. 블로그 기존 파일 무변경(`git status`로 확인만).
11. 접근성: 키보드만으로 퀴즈 1문제 풀기(숫자키·Enter), `role="radiogroup"`·`aria-live`·`:focus-visible` 존재, 아이콘 버튼 `aria-label`.

### B. 콘텐츠 표본 검사 (사람 눈으로)
12. **31개 노드마다 문제 2개를 무작위 추출(총 62개)** 해서: 정답이 실제로 맞는지(코드가 있으면 Python/sqlite3로 실행), 해설이 spec 3-3의 5조건(정답 명시·오답 보기별 이유·한글(영문) 용어 병기·시험 출제 경향 한 줄·60자 이상)을 지키는지, 시험 지문 톤인지, 보기 중 복수 정답 가능성이 없는지, pandas 2.x에서 결과가 달라질 문항인지. 틀린 것은 **고치고** review.md에 id·원인·수정 내용을 적어라.
13. 용어 정의 충돌(term-conflict 경고) 목록을 보고 **의미가 다른 경우만** 한쪽으로 통일(선등록 파일의 정의를 기준으로 다른 파일을 수정). 문구만 다른 것은 그대로 둬도 된다(선등록이 쓰인다).
14. 파일당 1개 실습을 골라 실제로 "학습자처럼" 풀어본다: task 문장만 보고 setup 셀을 실행해 코드를 직접 짜서 값을 구하고, 앱의 answer·decimals 규칙으로 맞는지. task 문장이 모호해 다른 값이 나올 수 있으면 task를 명확히 고쳐라.
15. 31노드 전체에서 `kind: output` 문제의 code를 일괄 추출해 실행하는 스크립트를 scratch에 만들어 **전부 재실행**하고, 보기 정답과 불일치하는 것을 찾아 고쳐라(SQL은 sqlite3로).

## 보고

`apps/ds-level2/review.md`를 2048의 `apps/2048/review.md` 형식을 참고해 작성: 검증 항목별 결과(통과/실패/수정함), 발견한 문제와 수정 내역(파일·id·원인), 스크린샷 확인 요약, 남은 리스크(예: pandas 2.x 재검증 필요 문항, 용어 충돌 잔여). 부모에게는 핵심 10줄 이내로 요약 보고(수정한 파일 목록 포함). 과장 금지 — 못 한 항목은 못 했다고 써라.
