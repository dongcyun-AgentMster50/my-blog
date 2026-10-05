# 인수인계 — 데이터 사이언스 레벨2 학습앱 (ds-level2)

> 새 세션은 이 문서를 먼저 읽는다. 작성 시점: 2026-10-05.
> 이 문서는 지시가 아니라 상태 기록이다. 다음에 무엇을 할지는 사용자가 정한다.

## 1. 한 줄 요약

`CLAUDE.md`의 작업 사이클(Plan → Build → Review → Embed)을 **전부 마쳤다**. 앱은 브랜치에 푸시되어 있고, **main 병합(=GitHub Pages 공개)과 PR 생성은 아직 하지 않았다**(사용자가 요청하지 않음).

## 2. 저장소 상태

| 항목 | 값 |
|---|---|
| 저장소 | `dongcyun-AgentMster50/my-blog` |
| 작업 브랜치 | `claude/data-science-level2-app-7uduft` (원격과 동기화됨, 미커밋 변경 없음) |
| main 대비 | 커밋 19개 앞섬, PR 없음 |
| 마지막 커밋 | `블로그 메인에 데이터 사이언스 레벨2 학습앱 카드 추가` |
| 블로그 본체 변경 | 루트 `index.html`에 앱 카드 1개 추가뿐. `css/`, `js/`, `posts/`, `vendor/`, `apps/2048/`, `.nojekyll` 무변경 |

GitHub Pages는 main을 서비스하므로 **main에 병합되기 전까지 블로그에는 보이지 않는다**.

## 3. 만든 것

색인(파트 A 전처리 4장 21토픽 + 파트 B 운영자 비법 5장 + 점검 노드 5개 = 학습 노드 31개)을 트리로 1:1 반영한 시험 대비 앱. 노드마다 요약 카드 → 필기 퀴즈 → Jupyter 실습 순서로 학습한다.

| 항목 | 수량 |
|---|---|
| 요약 카드 | 26 (점검 노드 5개는 카드 없음) |
| 필기 문제 | 412 (토픽 노드 12개씩, 점검 노드 20개씩) |
| 실습 과제 | 62 |
| 용어 사전 | 313 |

기능: 해시 라우팅 단일 페이지, 오답 노트, 라이트너 4상자 간격 반복, 모의고사(20/40문제·타이머·노드별 약점 리포트), 용어 바텀시트, 진도 JSON 내보내기/가져오기(병합·덮어쓰기·붙여넣기), `.ipynb` 생성 다운로드, 다크 모드, 임베드 모드(`?embed=1`), 모바일 우선. 순수 HTML/CSS/JS, 외부 의존성 0, `file://`로도 동작.

## 4. 파일 지도

```
apps/ds-level2/
├── spec.md              설계 문서(663줄). 스키마·ID 규칙·화면·검증 기준의 원본
├── review.md            Review 보고서(94줄). 검증 결과·수정 내역·남은 리스크
├── index.html           앱 셸. 스크립트 로드 순서가 중요(registry → curriculum → data 11개 → 엔진)
├── style.css
├── js/                  엔진. registry(DS2 전역·register API) curriculum(31노드) store(localStorage)
│                        format(미니 마크업·코드 하이라이트) grader leitner exam ipynb router views app
├── data/                콘텐츠 11파일 (챕터 단위)
│   a1-sql  a2-pandas-1  a2-pandas-2  a3-libs-1  a3-libs-2  a4-composite
│   b1-python  b2-pandas  b3-pattern  b4-regression  b5-hypothesis
└── tools/               검증 도구 (앱 런타임에는 안 쓰임)
    validate.js          콘텐츠 스키마·분량·용어 검사 (node)
    validate.html        같은 검사를 브라우저에서
    extract_practice.js  실습을 JSON으로 추출 (node)
    verify_practice.py   실습 setup+solution 실행 후 정답 대조 (python)

.claude/tasks/
├── ds-level2-plan.md            Plan 지침 (색인 원문이 여기 있다)
├── ds-level2-build-engine.md    Build 엔진 지침
├── ds-level2-build-content.md   Build 콘텐츠 공통 지침 (문제·해설 작성 규칙)
├── ds-level2-review.md          Review 지침
└── ds-level2-handoff.md         이 문서
```

ID 규칙: 노드 `a-2-3`, 문제 `a-2-3-q07`, 실습 `a-2-3-p01`, 용어는 영문 슬러그(`groupby`, `p-value`). 문제를 찾을 때는 `grep -n '"a-2-3-q07"' apps/ds-level2/data/*.js`.

## 5. 검증 현황 (마지막 실행 기준)

| 검사 | 결과 |
|---|---|
| `validate.js` 전체 | ERRORS 0 / WARNINGS 113 (용어 문구 차이 110, 무시 가능 3) |
| 실습 62개 Python 재실행 | 62/62 PASS |
| 출력 예측 문제 실행 | 152/152 정답과 일치 (SQL 12개는 sqlite3) |
| 브라우저 하네스 | 123/123 통과, 콘솔 에러 0, 외부 요청 0 |
| `.ipynb` | `nbformat.validate` 통과 |
| 표본 사람 검사 | 62문제 검사, 3건 교정 (상세는 `review.md`) |

검증 환경은 pandas 3.0.6 / numpy 2.4.6 / scikit-learn 1.9.1 / scipy 1.17.1 / statsmodels 0.15.0.

## 6. 남은 일 (우선순위순, 전부 사용자 결정 대기)

1. **main 병합 또는 PR 생성.** 블로그에 공개하려면 필요하다. 사용자가 요청할 때만 한다.
2. **pandas 2.x 환경 재검증.** 사용자의 데스크톱 Jupyter가 2.x일 가능성이 크다. 아래 명령을 사용자 PC에서 한 번 돌리도록 안내한다. 흔들릴 수 있는 후보는 sklearn 기반 실습(`a-3-4-p02`, `a-4-2-*`, `a-4-3-*`)이다.
   ```
   node apps/ds-level2/tools/extract_practice.js apps/ds-level2/data/*.js > p.json
   python apps/ds-level2/tools/verify_practice.py p.json
   ```
3. **안전 후크 경로 수정 제안.** `.claude/settings.json`의 PreToolUse 후크가 상대경로(`python .claude/hooks/...`)라 셸 작업 디렉터리가 하위 폴더로 바뀌면 모든 Bash가 차단된다. `python "$CLAUDE_PROJECT_DIR/.claude/hooks/block-dangerous-commands.py"`로 바꾸는 안을 사용자에게 제안만 했다. 안전장치 파일이므로 승인 없이 고치지 않는다.
4. **개념·빈칸 문제 2차 표본 검사.** 출력·버그 문제 179개는 실행으로 전수 확인했지만, 개념·빈칸 문제 233개는 형식 검사와 표본만 거쳤다.
5. **용어 문구 차이 110건 정리.** 동작 문제는 없다(먼저 등록된 파일의 정의가 표시됨). 의미가 다른 5건은 Review에서 이미 통일했다.
6. **실기기 확인.** iOS Safari 노트북 다운로드, 홈 화면 추가, Android 숫자 키패드.
7. **사용자 피드백 반영 루프.** 사용자가 학습 중 틀린 문제를 문제 id로 알려주면 해당 파일을 고치고 아래 7절 절차로 검증한다.

## 7. 콘텐츠를 고칠 때의 절차

1. 문제 id로 파일과 줄을 찾는다.
2. 고친다. 규칙은 `.claude/tasks/ds-level2-build-content.md`를 따른다. 핵심만 적으면 다음과 같다.
   - 콘텐츠 파일에서 **백틱 문자열(템플릿 리터럴) 금지**. 큰따옴표 문자열 또는 줄 배열만.
   - 해설 5조건: 첫 줄 정답 명시, 객관식은 오답 보기마다 이유, 용어 한글(영문) 병기와 `[[term-id]]` 링크, 시험 출제 경향 한 줄, 60자 이상.
   - 출력 예측 문제의 정답은 반드시 실제 실행 결과로.
   - 버전에 따라 결과가 달라지는 동작(pandas Copy-on-Write, 문자열 dtype 이름 등)은 정답으로 묻지 않는다.
3. 검증한다.
   ```
   node --check apps/ds-level2/data/<파일>.js
   node apps/ds-level2/tools/validate.js apps/ds-level2/data/<파일>.js
   node apps/ds-level2/tools/extract_practice.js apps/ds-level2/data/<파일>.js | python3 apps/ds-level2/tools/verify_practice.py /dev/stdin
   ```
4. 커밋하고 이 브랜치로 푸시한다.

## 8. 새 세션 환경 준비

- 컨테이너가 새로 뜨면 Python 라이브러리가 없을 수 있다. 확인 후 설치한다. 첫 시도에서 타임아웃이 나면 패키지를 하나씩, `--timeout 300 --retries 10`으로 설치하면 된다.
  ```
  python3 -c "import pandas, sklearn, scipy, statsmodels" || pip install --user --timeout 300 --retries 10 numpy pandas scikit-learn scipy statsmodels
  ```
- 로컬 실행: 저장소 루트에서 `python3 -m http.server 8000` 후 `http://localhost:8000/apps/ds-level2/index.html`.
- 헤드리스 브라우저: `/opt/pw-browsers/chromium-*/chrome-linux/chrome --headless=new --no-sandbox --screenshot=...`. `playwright install`은 하지 않는다.
- 푸시가 403이면 GitHub 앱 연결 문제다. 사용자에게 https://claude.ai/connect-github 재연결을 요청한다. 이번 세션에서 한 번 발생했고 재연결로 해결됐다.

## 9. 이번 세션에서 겪은 함정

- **셸 작업 디렉터리 이동.** `cd apps/ds-level2` 같은 명령이 공용 셸의 작업 디렉터리를 바꾸면 상대경로 후크가 깨져 Bash가 전부 막힌다. 명령은 절대경로로 쓰고 `cd`를 피한다. 서브에이전트에게도 같은 규칙을 지침에 넣는다.
- **인라인 코드 속 `[[`.** `df[['a','b']]`가 예전에 용어 링크로 오인됐다. 엔진의 검증기와 포매터를 고쳐 이제 백틱 안과 코드 블록 안은 무시한다.
- **세션 사용량 한도.** 서브에이전트 9명을 동시에 돌리다 한도에 걸려 일제히 중단됐다. 중단된 에이전트는 메시지를 보내 재개했고 디스크의 작성분은 보존됐다. 큰 병렬 작업 전에는 진행분을 자주 커밋한다.
- **서브에이전트 모드.** Plan 전용 에이전트는 읽기 전용이라 파일을 못 쓴다. 문서 전문을 돌려받아 부모가 저장했다.

## 10. 사용자와 일하는 방식

- 작업을 받으면 바로 실행하지 않고 계획을 먼저 보고한다. 사용자가 확정한 뒤 실행한다.
- 한국어, 결론 먼저, 간결하게. 전문용어는 영문을 병기한다.
- 새 개념은 비유로 먼저, 그다음 전문용어로 설명한다.
- 놓친 점(엣지 케이스, 보안, 유지보수, 더 단순한 대안)은 답변 끝 "짚고 넘어갈 점"으로 1~3개만 덧붙인다.
- 구현 완료를 주장하기 전에 실제 구현률을 정직하게 감사해 보고한다.
- 프로젝트 규칙 `CLAUDE.md`를 따른다. 승인 없이 구현을 시작하지 않고, `.nojekyll`을 지우지 않는다.
