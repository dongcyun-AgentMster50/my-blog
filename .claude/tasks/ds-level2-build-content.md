# Build 지침 — ds-level2 콘텐츠 (공통)

## 너의 역할

`/home/user/my-blog/apps/ds-level2/` 학습앱의 **콘텐츠 데이터 파일 1개**를 작성한다. 어떤 파일·노드·분량을 맡는지는 너를 호출한 프롬프트에 적혀 있다. 엔진(UI)은 다른 에이전트가 만들고 있으니 건드리지 않는다.

학습자는 "데이터 사이언스 레벨2" 시험(필기 + Jupyter 실습)을 준비하는 중급자다. 네가 쓰는 문제와 해설이 이 앱의 가치 전부다. **정확성 > 분량.** 틀린 해설 하나가 앱 신뢰를 무너뜨린다.

## 먼저 읽을 것

1. `/home/user/my-blog/apps/ds-level2/spec.md` — **2절(ID 규칙), 3절(스키마, 전부), 4절(할당표), 10절 B(검증 항목)** 는 반드시. 1절 레지스트리 API도.
2. `/home/user/my-blog/apps/ds-level2/js/registry.js`, `js/curriculum.js` — 실제 API와 노드 id.
3. `/home/user/my-blog/apps/ds-level2/data/_sample.js` — 있으면 형식 참고(없으면 spec 3절 예시).

## 수정 허용 범위

**오직 네가 할당받은 `apps/ds-level2/data/<파일>.js` 하나.** 검증 중간 산출물은 `/tmp/claude-0/-home-user-my-blog/badd8dda-adc1-5d9c-91ff-d936875c7dcd/scratchpad/<파일명>/` 아래에만. 다른 파일(엔진, spec, 다른 data 파일, 블로그 본체)은 읽기만. git 명령 금지.

## 콘텐츠 작성 규칙

### 형식
- 파일 전체를 IIFE로 감싸고 `DS2.register({...})`를 **한 번만** 호출. `chapter` 필드는 할당받은 챕터 id.
- **백틱 문자열(템플릿 리터럴) 금지.** 큰따옴표 문자열 또는 줄 배열(`string[]`)만. 코드·해설은 줄 배열로.
- 미니 마크업만(spec 3-1): 인라인 `` `code` ``, `**굵게**`, `- 목록`, 빈 줄 문단, ```` ```python ```` 블록, `[[term-id]]` / `[[term-id|표시]]`. 표는 쓰지 않는다.
- id: `<node>-qNN`, `<node>-pNN` (01부터 연속). 용어 id는 영문 소문자 슬러그.

### 필기 문제 (spec 3-3)
- 유형 `mcq`/`ox`/`short`, `kind` concept/output/bug/fill, 난이도 1~3. 할당표의 수·분포를 지킨다(노드당 12: mcq 7 / ox 2 / short 3, 난이도 4:6:2, output ≥3, bug ≥1, fill ≥1. 점검 노드 20: mcq 12 / ox 3 / short 5, 난이도 6:10:4, output ≥6).
- **mcq 정답 위치를 고르게 분산**(한 노드에서 같은 인덱스가 60% 넘으면 검증기 경고). 보기 순서는 셔플되지 않으므로 해설에서 ①②③④로 지칭 가능.
- `short` 답은 1토큰(메서드명·키워드·숫자), 30자 이하, `accept`에 흔한 변형(괄호 포함, 대문자 등은 정규화되니 불필요 — 실제 다른 표기만).
- **해설 5조건**: ① 첫 줄 `**정답: ②**` + 왜 정답인지 ② mcq는 오답 보기마다 왜 틀렸는지 한 줄(목록) ③ 전문용어 **한글(영문)** 병기 + `[[term]]` 링크 최소 1개 ④ "시험에서는 …로 나온다" 한 줄 ⑤ 60자 이상.
- **시험 지문 톤**: "다음 중 옳은 것은?", "다음 코드의 출력은?", "빈칸에 알맞은 것은?" 등. 전문용어는 시험지에 등장하는 영문 표기를 꼭 병기(예: 결측값(missing value), 귀무가설(null hypothesis), 조인(join), 집계(aggregation)).
- `kind: output` 문제의 코드는 **반드시 Python으로 실행해 출력을 확인**하고 그 출력을 정답으로 쓴다. 머리로 추측하지 마라. SQL은 `sqlite3` 인메모리로 실행해 확인(SQL 방언 차이가 있는 문법 — 윈도 함수·CTE는 sqlite 3.25+에서 동작한다; sqlite에 없는 문법(`FULL OUTER JOIN`은 3.39+, `PIVOT` 등)은 개념 문제로만 내고 "표준 SQL 기준"이라고 명시).
- **pandas 버전 함정**: 검증 환경은 pandas 3.0인데 학습자는 2.x일 수 있다. 버전에 따라 달라지는 것(Copy-on-Write, 문자열 dtype 이름 `str`/`object`, `SettingWithCopyWarning`, `groupby(observed=)` 기본, `DataFrame.append` 제거 여부 등)을 정답으로 묻지 않는다. 묻고 싶으면 "pandas 2.x 기준"을 지문에 명시하고 해설에 3.0 변화를 적는다.

### 실습 과제 (spec 3-4)
- 할당 수만큼. 난이도 2개면 1·2, 3개면 1·2·3.
- `setup`은 **고정 시드**(`np.random.default_rng(정수)` 권장) + 인터넷 불필요(numpy 합성 또는 `sklearn.datasets.load_*`/`make_*`; `seaborn.load_dataset`, `statsmodels.datasets`, URL 금지). SQL 노드는 `sqlite3.connect(':memory:')` + `df.to_sql(...)` + `pd.read_sql(...)`.
- `task`에 반올림 자릿수를 문장으로 명시. `answer`는 `{type:"number", value, decimals}` / `{type:"int", value}` / `{type:"string", value, accept?}`.
- `solution`의 **마지막 줄은 답 값을 내는 표현식**(예: `round(result, 2)`)이어야 검증기가 읽는다.
- **반드시 실제 실행 검증**: 파일을 쓴 뒤
  ```
  cd /home/user/my-blog/apps/ds-level2
  node tools/extract_practice.js data/<파일>.js > <scratch>/p.json
  python3 tools/verify_practice.py <scratch>/p.json
  ```
  전부 PASS일 때만 `verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / sklearn 1.9.1 / scipy 1.17.1 / statsmodels 0.15.0" }`를 기입(해당 라이브러리만 적어도 된다). 랜덤 알고리즘은 `random_state` 고정 + 자릿수 낮게(2자리) 또는 정수형 답.

### 요약 카드 (spec 3-2)
- 노드마다 1개(점검 노드 `b-N-2`는 카드 없음). summary 3~6문장, concepts 3~8, terms 3~12, patterns 3~7(실행 가능한 코드), pitfalls 0~5(시험 함정).

### 용어 (spec 3-2 terms)
- 네 파일에서 `terms`로 태그하거나 `[[ ]]`로 링크한 용어는 **전부 네 파일에서 정의**한다. 다른 파일을 믿지 마라. `ko`, `en`, `def`(교과서적 표준 정의 1~2문장 — 다른 파일과 충돌을 줄이기 위해 간결하고 표준적으로), `nodes`, `related`.

## 검증 (끝나기 전에 반드시, 결과를 보고에 그대로 적는다)

```
cd /home/user/my-blog/apps/ds-level2
node tools/validate.js data/<파일>.js          # ERRORS 0 필수, WARNINGS는 사유와 함께 보고
node tools/extract_practice.js data/<파일>.js > <scratch>/p.json && python3 tools/verify_practice.py <scratch>/p.json   # 전부 PASS
node -e "require('vm'); ..."  # 최소한 node로 파일 구문 오류 없는지: node --check data/<파일>.js
```
`tools/`가 아직 없으면(엔진 1단계 미완) 5분 간격으로 최대 3번 다시 확인하고, 그래도 없으면 **직접 임시 검증 스크립트를 scratch에 만들어** 같은 검사를 하고 보고에 그 사실을 적는다.

## 완료 후 보고 (8줄 이내)

파일 경로·줄 수, 노드별 문제 수/실습 수, validate 결과(ERRORS/WARNINGS 수와 내용), verify_practice 결과, 정의한 용어 수, 스스로 확신이 낮은 문제 id 목록(있으면 솔직하게), 할당 대비 미달 항목.
