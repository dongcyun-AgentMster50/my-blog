/* ds-level2 — 개발용 더미 콘텐츠 (a-2-3 노드). 엔진 개발·검증 도구 확인용이며
   2단계 종료 시 삭제된다. 형식은 spec 3절 스키마와 동일하다 — 콘텐츠 에이전트 참고용.
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그한 용어는 전부 이 파일에서 정의. */
(function () {
  DS2.register({
    chapter: "a-2",

    cards: {
      "a-2-3": {
        node: "a-2-3",
        title: "Pandas 변환과 집계",
        summary: [
          "`groupby`-`agg`-`transform` 세 축을 구분하는 것이 이 토픽의 전부다.",
          "[[groupby|그룹화]]는 키별로 나누고(split) 함수를 적용하고(apply) 다시 합친다(combine).",
          "결과의 **길이**가 그룹 수인지(집계) 원본과 같은지(변환)가 시험의 핵심 구분점이다."
        ],
        concepts: [
          "**분할-적용-결합(split-apply-combine)**: `groupby`는 키별로 나누고, 함수를 적용하고, 다시 합친다.",
          "**집계(aggregation)**: `agg`/`sum`/`mean` 등은 그룹당 값 하나를 돌려준다. 결과 길이 = 그룹 수.",
          "**변환(transform)**: `transform`은 그룹 결과를 원본 길이로 [[broadcasting|브로드캐스트]]한다. 결과 길이 = 원본 길이.",
          "**피벗(pivot_table)**: 행·열 두 키로 집계해 교차표를 만든다. `aggfunc` 기본값은 `mean`."
        ],
        terms: ["groupby", "aggregation", "transform", "pivot-table"],
        patterns: [
          {
            title: "그룹별 여러 통계 한 번에",
            lang: "python",
            code: ["df.groupby('dept')['salary'].agg(['mean', 'max', 'count'])"],
            note: "결과는 컬럼이 통계명인 DataFrame. `as_index=False`를 주면 키가 컬럼으로 남는다."
          },
          {
            title: "그룹 평균을 원본 길이로 붙이기",
            lang: "python",
            code: [
              "df['dept_mean'] = df.groupby('dept')['salary'].transform('mean')",
              "df['diff'] = df['salary'] - df['dept_mean']"
            ],
            note: "`transform`이라 길이가 맞아 바로 새 컬럼으로 대입할 수 있다."
          },
          {
            title: "피벗 테이블",
            lang: "python",
            code: ["pd.pivot_table(df, index='dept', columns='year', values='salary', aggfunc='sum', fill_value=0)"]
          }
        ],
        pitfalls: [
          "`transform`은 원본과 같은 길이를 돌려준다. `agg`와 혼동하면 shape 오류.",
          "`groupby(...).size()`는 결측값이 있는 행도 세지만 `count()`는 결측값을 빼고 센다."
        ]
      }
    },

    questions: [
      {
        id: "a-2-3-q01", node: "a-2-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'k': ['a','b','a'], 'v': [1, 2, 3]})",
          "print(df.groupby('k')['v'].transform('sum').tolist())"
        ],
        lang: "python",
        choices: ["[4, 2]", "[4, 2, 4]", "[1, 2, 3]", "KeyError"],
        answer: 1,
        explanation: [
          "**정답: ②** `transform`은 [[transform|변환]] 연산이라 **원본과 같은 길이**로 결과를 돌려준다. 'a' 그룹의 합 4가 두 자리에 브로드캐스트되어 `[4, 2, 4]`.",
          "",
          "- ① `[4, 2]`는 `agg('sum')`의 결과다. 길이가 그룹 수로 줄어든다.",
          "- ③ 원본 값 그대로는 아무 연산도 하지 않은 경우다.",
          "- ④ 'k' 컬럼은 존재하므로 KeyError는 나지 않는다.",
          "",
          "시험에서는 집계(aggregation)와 변환(transform)의 **결과 길이 차이**를 묻는 문제가 반복된다."
        ],
        terms: ["transform", "aggregation", "broadcasting"],
        tags: ["groupby"]
      },
      {
        id: "a-2-3-q02", node: "a-2-3", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df.groupby('k').size()`는 값 컬럼에 결측값(NaN)이 있는 행도 센다.",
        answer: true,
        explanation: [
          "**정답: O** `size()`는 그룹의 **행 수**를 세므로 결측값(missing value) 여부와 무관하다.",
          "반면 `count()`는 컬럼별로 **결측이 아닌 값**만 센다. 둘의 차이가 바로 결측값 개수다.",
          "",
          "시험에서는 `size()`와 `count()`의 결과가 다른 이유를 [[groupby|그룹화]] 문맥에서 묻는다."
        ],
        terms: ["groupby"]
      },
      {
        id: "a-2-3-q03", node: "a-2-3", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 메서드 이름을 쓰시오. 그룹별 순위를 원본 길이로 돌려준다: `df.groupby('k')['v'].____('rank')`",
        answer: "transform",
        accept: ["transform()"],
        explanation: [
          "**정답: transform** 그룹별 결과를 **원본 길이**로 돌려주는 메서드는 [[transform|변환(transform)]]이다.",
          "`agg('rank')`는 그룹당 스칼라를 기대하므로 길이가 맞지 않아 오류가 난다.",
          "",
          "시험에서는 `transform`과 `apply`의 차이(길이 보장 여부)로 출제된다."
        ],
        terms: ["transform"]
      }
    ],

    practices: [
      {
        id: "a-2-3-p01", node: "a-2-3",
        title: "부서별 평균 급여의 최댓값",
        difficulty: 2,
        task: [
          "`df`에서 부서(`dept`)별 급여(`salary`) 평균을 구하고, 그중 **최댓값**을 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(20240203)",
          "df = pd.DataFrame({",
          "    'dept': rng.choice(['A', 'B', 'C'], size=120),",
          "    'salary': rng.normal(5000, 800, size=120).round(0),",
          "})",
          "df.head()"
        ],
        hint: ["`groupby('dept')['salary'].mean()` 뒤에 `.max()`를 이어 붙인다."],
        answer: { type: "number", value: 5233.6, decimals: 2 },
        solution: ["round(df.groupby('dept')['salary'].mean().max(), 2)"],
        explanation: [
          "평균은 그룹 수(3)만큼의 Series 다. 그 위에 `max()`를 호출하면 스칼라가 나온다.",
          "[[aggregation|집계]]를 두 번 겹친 형태 — 첫 집계는 그룹별, 두 번째는 전체."
        ],
        terms: ["groupby", "aggregation"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      }
    ],

    terms: [
      { id: "groupby", ko: "그룹화", en: "groupby / group-by",
        def: "키 컬럼 값이 같은 행끼리 묶어 각 묶음에 함수를 적용하는 연산. 분할-적용-결합 패턴의 구현.",
        nodes: ["a-2-3"], related: ["aggregation", "transform"] },
      { id: "aggregation", ko: "집계", en: "aggregation / agg",
        def: "여러 값을 하나의 대표값(합·평균·개수 등)으로 줄이는 연산. 그룹당 결과가 하나다.",
        nodes: ["a-2-3"], related: ["groupby", "transform"] },
      { id: "transform", ko: "변환", en: "transform",
        def: "그룹별 계산 결과를 원본과 같은 길이로 돌려주는 groupby 메서드. 그룹 통계를 각 행에 붙일 때 쓴다.",
        nodes: ["a-2-3"], related: ["aggregation", "broadcasting"] },
      { id: "broadcasting", ko: "브로드캐스팅", en: "broadcasting",
        def: "크기가 다른 배열 간 연산에서 작은 쪽을 큰 쪽의 모양에 맞춰 자동으로 늘려 맞추는 규칙.",
        nodes: ["a-2-3"], related: ["transform"] },
      { id: "pivot-table", ko: "피벗 테이블", en: "pivot table / pivot_table",
        def: "행 키와 열 키 두 축으로 값을 집계해 교차표 형태로 만드는 연산.",
        nodes: ["a-2-3"], related: ["aggregation"] }
    ]
  });
})();
