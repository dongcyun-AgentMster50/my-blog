# Build 지침 — ds-level2 엔진

## 너의 역할

`/home/user/my-blog/apps/ds-level2/` 학습앱의 **엔진**(UI·채점·진도·ipynb·검증 도구)을 구현한다. 콘텐츠(문제·해설)는 쓰지 않는다 — 다른 에이전트 11명이 `data/*.js`를 병렬로 작성 중이다.

설계 문서 `/home/user/my-blog/apps/ds-level2/spec.md`를 **전부** 읽고 그대로 구현한다. 스키마(3절)·레지스트리 API(1절)·ID 규칙(2절)은 콘텐츠 에이전트들과의 계약이므로 **절대 바꾸지 않는다**. 필요하면 선택 필드만 추가한다.

프로젝트 규칙 `/home/user/my-blog/CLAUDE.md`와 선례 `/home/user/my-blog/apps/2048/`(game.js의 safeStorage, IIFE, 클래식 스크립트)도 읽어라.

## 수정 허용 범위

생성·수정 가능:
```
apps/ds-level2/index.html
apps/ds-level2/style.css
apps/ds-level2/js/*.js
apps/ds-level2/tools/*            (validate.js, validate.html, extract_practice.js, verify_practice.py)
apps/ds-level2/data/_sample.js    (개발용 더미. 2단계 끝에 삭제)
```
**금지**: `apps/ds-level2/data/` 의 다른 파일, `apps/ds-level2/spec.md`, 블로그 본체(`index.html`, `css/`, `js/`, `posts/`, `vendor/`, `apps/2048/`), `.nojekyll`, `.claude/`. git 명령은 쓰지 않는다(커밋은 부모가 한다).

## 작업은 두 단계다 — 1단계가 끝나면 즉시 보고하라

### 1단계 (최우선 — 콘텐츠 에이전트들이 기다린다)

1. `js/registry.js` — spec 1절의 `DS2.register()` / 읽기 API / `DS2.warnings` / 용어 병합 규칙. Node `vm`과 브라우저 양쪽에서 동작해야 하므로 `window`가 없어도 전역(`globalThis`)에 `DS2`를 만든다.
2. `js/curriculum.js` — spec 2절 트리 31 학습 노드 + part/chapter. 제목은 색인 원문 그대로(spec 2절 표와 `.claude/tasks/ds-level2-plan.md`의 색인 참조).
3. `tools/validate.js` — spec 10절 B의 모든 기계 검사. 실행: `node tools/validate.js data/a1-sql.js [더 많은 파일...]`. 파일 인수가 없으면 `data/*.js` 전부. 결과는 사람이 읽는 표 + 마지막 줄 `ERRORS: n  WARNINGS: m`, 에러가 있으면 exit 1. 검사 항목(최소):
   - 백틱 문자열 사용 탐지(파일 텍스트 정규식)
   - id 형식·전체 유일성, `node`가 트리에 존재, `chapter`와 노드 소속 일치
   - 필수 필드, type별 answer 형식, mcq choices 3~5, 정답 인덱스 범위, short 답 1토큰·30자 이하
   - explanation 60자 이상, mcq 해설에 오답 보기 언급(①②③④ 또는 보기 텍스트 2개 이상)
   - terms 1개 이상 + 사전에 존재, `[[id]]` 해석 가능, 용어 정의 충돌 목록
   - 노드별 문제 수/난이도/유형 분포를 spec 4절 할당과 비교(±1 밖이면 WARNING), 정답 인덱스 편중 ≥60% WARNING
   - 실습: 시드 존재, 금지 패턴, answer.type 유효, number면 decimals, verified 존재
   - `_sample.js`는 할당 비교에서 제외
4. `tools/extract_practice.js` — `node tools/extract_practice.js data/a1-sql.js > out.json`: 지정 파일들을 vm으로 로드해 `practices[]`를 JSON으로 출력(각 항목 `id, setup(문자열 합침), solution(문자열 합침), answer`).
5. `tools/verify_practice.py` — `python3 tools/verify_practice.py out.json`: 과제마다 **새 네임스페이스**에서 `setup` 실행 후 `solution`을 실행하고 **마지막 표현식의 값**을 얻는다(`ast`로 마지막 문장이 Expr이면 eval, 아니면 네임스페이스의 `answer` 또는 `result` 변수를 찾는다). spec 6-3 규칙으로 `answer`와 비교(number: decimals 반올림 후 비교; int; string 정규화). numpy/pandas 스칼라는 `float()`/`int()`/`str()`로 변환. 출력: 과제별 PASS/FAIL/ERROR 한 줄(FAIL이면 기대값·실제값), 요약, 실패 있으면 exit 1. 경고(FutureWarning 등)는 억제. 이 컨테이너에는 pandas 3.0.6, numpy 2.4.6, scikit-learn 1.9.1, scipy 1.17.1, statsmodels 0.15.0이 있다.
6. `data/_sample.js` — 스키마 예시를 그대로 따르는 더미(a-2-3 노드에 카드 1, 문제 3(mcq/ox/short 각 1), 실습 1, 용어 4). **실습의 answer는 실제로 Python을 돌려 얻은 값**으로 넣고 `tools/`로 검증 통과를 확인한다.

1단계 완료 조건: `node tools/validate.js data/_sample.js` 가 ERRORS 0, `node tools/extract_practice.js data/_sample.js | python3 tools/verify_practice.py /dev/stdin` 이 PASS. **여기까지 되면 부모에게 즉시 짧게 보고하라**(보고 후 2단계를 계속하라고 지시받는다; 지시가 올 때까지 기다리지 말고 바로 2단계로 진행해도 된다 — 보고가 먼저일 뿐이다).

### 2단계 — 앱 본체

spec 5~8절을 전부 구현한다. 순서는 spec 9절 "엔진 에이전트" ②~⑥. 요점:
- `index.html`: `<head>` 인라인 테마 스크립트(FOUC 방지), 스크립트 로드 순서(spec 1절) — **`data/` 11개 파일 태그를 전부 미리 적어 둔다**(a1-sql, a2-pandas-1, a2-pandas-2, a3-libs-1, a3-libs-2, a4-composite, b1-python, b2-pandas, b3-pattern, b4-regression, b5-hypothesis). 없는 파일은 404여도 앱이 떠야 하고, 콘텐츠 없는 노드는 트리에 "준비 중"으로 보인다. `_sample.js` 태그는 개발 중에만 두고 마지막에 제거·삭제.
- `store.js`(safeStorage·스키마 v1·마이그레이션·내보내기/가져오기 병합·corrupt 보관), `grader.js`, `leitner.js`, `exam.js`, `ipynb.js`(nbformat 4.5, 모든 셀 id), `format.js`(미니 마크업 + python/sql 토크나이저, 입력 먼저 이스케이프), `router.js`, `views.js`, `app.js`. 순수 함수 모듈은 `window.__DS2`에 디버그 노출.
- 화면 전부: 홈, 트리, 토픽(요약/퀴즈/실습 탭), 오답, 복습, 모의고사(설정/진행/결과, sessionStorage 복구, 타이머), 사전(검색·바텀시트), 설정(테마·글자크기·타이머·내보내기/가져오기/붙여넣기·초기화 2단계·경고 수·저장 불가 안내).
- 모바일 우선(하단 탭바, safe-area, 44px 타깃, 퀴즈 중 탭바 숨김), 데스크톱 사이드바, 임베드 모드(`?embed=1` 또는 iframe 감지 → 컴팩트 홈 + 전체화면 링크 `target="_top"`), 다크 모드(`auto|light|dark` + `?theme=`), 접근성(spec 8절: 숫자키, radiogroup, 포커스 이동, aria-live, reduced-motion).
- 외부 요청 0건. `../` 참조 금지. 전역은 `window.DS2`와 `window.__DS2`만.

### 2단계 자체 검증(끝나기 전에 꼭)

- `python3 -m http.server 8000`을 저장소 루트에서 띄우고 Playwright(크로미움 설치됨: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `npx playwright` 또는 `node`에서 `require('playwright')`가 없으면 `npm i -D playwright`는 하지 말고 `/opt/pw-browsers/chromium*` 바이너리를 `--headless --dump-dom` 등으로 쓰거나, 간단히 `node` 스크립트로 라우팅 외 순수 함수를 테스트)로 다음을 확인: 콘솔 에러 0, `#/`·`#/tree`·`#/topic/a-2-3`·`#/exam`·`#/glossary`·`#/settings` 렌더, 더미 퀴즈 1세션 완주 후 localStorage에 진도 기록, 360px 뷰포트 레이아웃.
- 순수 함수 테스트는 Node로: `grader`(spec 10절 A의 케이스), `leitner`, `exam.buildExam` 노드 편중, `ipynb` 출력이 `python3 -c "import json,sys; nb=json.load(open(...)); assert nb['nbformat']==4; ids=[c['id'] for c in nb['cells']]; assert len(ids)==len(set(ids))"` 통과. (nbformat 패키지는 없을 수 있다 — 있으면 `nbformat.validate`도.)
- `file://`로 열었을 때 깨지는 코드(fetch, 모듈)가 없는지 재확인.
- 마지막에 `_sample.js` 삭제 + `index.html`에서 태그 제거. 그 뒤 콘텐츠 파일이 일부 도착해 있으면 `node tools/validate.js`로 전체 검증을 한 번 돌리고 결과를 보고에 포함(콘텐츠 자체는 고치지 마라 — 보고만).

## 코드 스타일

- 각 파일 IIFE, 2048과 같은 톤(한국어 주석, "왜"를 설명하는 주석). ES2019 수준 문법(옵셔널 체이닝 OK, 모듈 금지).
- CSS는 `style.css` 하나. 토큰은 spec 7절 "스타일 톤"대로 `:root`/`:root[data-theme="dark"]`.
- 라이브러리·CDN 0.

## 완료 후 보고

구현 파일 목록과 줄 수, 자체 검증 결과(통과/실패 그대로), spec 대비 미구현·축소한 항목을 **정직하게** 나열("구현률 n%, 누락: …" 형식). 콘텐츠 에이전트가 주의해야 할 점이 있으면 적어라.
