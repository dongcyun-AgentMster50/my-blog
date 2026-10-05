/* ds-level2 — 파트 B 3장 콘텐츠: b-3 "복합 패턴 — Python + pandas 조합의 원리", b-3-2 "이해도 점검 문제".
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그·링크한 용어는 전부 이 파일에서 정의.
   모든 output 문제와 실습은 pandas 3.0.6 / numpy 2.4.6 에서 실제 실행해 출력을 확인했다. */
(function () {
  DS2.register({
    chapter: "b-3",

    /* ────────────────────────────────────────────────────────
       요약 카드 (b-3 만. 점검 노드 b-3-2 는 카드 없음)
       ──────────────────────────────────────────────────────── */
    cards: {
      "b-3": {
        node: "b-3",
        title: "복합 패턴 — Python + pandas 조합의 원리",
        summary: [
          "pandas 메서드는 대부분 **Python 객체를 인수로 받아 각 조각에 적용**한다. 그래서 [[lambda|람다]]·[[dictionary|딕셔너리]]·[[list-comprehension|컴프리헨션]]·[[zip|zip]] 같은 Python 문법이 pandas 안에서 그대로 쓰인다.",
          "핵심은 \"**함수가 무엇을 받고 무엇을 돌려주는가**\"다. `apply(axis=1)`은 행 Series를 받고, `groupby().apply`는 그룹 DataFrame을 받으며, 반환이 스칼라면 Series·Series면 DataFrame이 된다.",
          "조건부 컬럼은 [[np-where|np.where]](2분기) → [[np-select|np.select]](다분기) → `apply`(복잡 로직) 순으로 고르고, 가능하면 [[vectorization|벡터화]]로 반복문을 피한다.",
          "시험은 \"이 코드의 결과 구조(길이·타입)\"와 \"없는 키·축 지정 실수\"를 묻는다."
        ],
        concepts: [
          "**행 단위 apply**: `df.apply(f, axis=1)`은 각 행을 `Series`(인덱스 = 컬럼명)로 넘긴다. `row['col']`로 접근하며, f가 스칼라를 돌려주면 결과는 Series, `pd.Series`를 돌려주면 DataFrame이 된다.",
          "**map의 세 인수**: [[map|map]]에 딕셔너리·함수·Series를 줄 수 있고, 딕셔너리/Series에 **없는 키는 NaN**이 된다. 없는 값을 그대로 두려면 [[replace|replace]]를 쓴다.",
          "**딕셔너리로 명세**: `agg({'v': 'sum'})`, `rename(columns={...})`, `replace({...})`, `astype({'a': 'float'})` 처럼 컬럼→동작 매핑을 딕셔너리로 넘긴다. [[named-aggregation|이름 붙인 집계]]는 결과 컬럼 이름까지 지정한다.",
          "**조건부 컬럼 3종**: [[np-where|np.where]](조건, 참값, 거짓값)은 2분기, [[np-select|np.select]]([조건들], [값들], default)는 다분기 — 먼저 참인 조건이 이긴다. `apply(axis=1)`은 가장 유연하지만 가장 느리다.",
          "**그룹별 사용자 함수**: `groupby('g').apply(f)`의 f는 **그룹 DataFrame**을 받는다. `groupby('g')['v'].transform(lambda s: (s - s.mean()) / s.std())`는 그룹별 [[standardization|표준화]]를 원본 길이로 돌려준다.",
          "**컬럼 평탄화**: 딕셔너리 agg나 피벗으로 생긴 [[multiindex|다중 인덱스]] 컬럼은 `['_'.join(c) for c in df.columns]`로 한 단계 문자열 컬럼으로 만든다.",
          "**반복문 vs 벡터화**: `iterrows`(행을 Series로, 느림·dtype 깨짐) < `itertuples`(namedtuple, 더 빠름) < `zip(df['a'], df['b'])` < **벡터 연산** 순으로 빨라진다. 100만 행이면 반복문은 피한다.",
          "**조건 집계**: `(df['x'] > 0).sum()`은 조건을 만족하는 행 수, `(df['x'] > 0).mean()`은 **비율**이다. True=1, False=0으로 계산되는 [[conditional-aggregation|조건 집계]] 패턴."
        ],
        terms: ["apply", "lambda", "map", "dictionary", "list-comprehension", "np-select", "zip", "transform", "flatten-columns", "iterrows", "str-extract", "conditional-aggregation"],
        patterns: [
          {
            title: "행 단위 apply — 여러 컬럼을 람다에서 사용",
            lang: "python",
            code: [
              "df['total'] = df.apply(lambda row: row['price'] * row['qty'], axis=1)   # 스칼라 반환 → Series",
              "new = df.apply(lambda r: pd.Series({'s': r['a'] + r['b'], 'd': r['a'] - r['b']}), axis=1)  # Series 반환 → DataFrame"
            ],
            note: "`axis=1`을 빼면 **컬럼**이 넘어가 `row['price']`가 KeyError를 낸다. 단순 곱은 `df['price'] * df['qty']`가 훨씬 빠르다."
          },
          {
            title: "조건부 컬럼 3종",
            lang: "python",
            code: [
              "df['flag'] = np.where(df['score'] >= 60, 'pass', 'fail')",
              "df['grade'] = np.select([df['score'] >= 90, df['score'] >= 60], ['A', 'B'], default='C')",
              "df['grade2'] = df['score'].apply(lambda x: 'A' if x >= 90 else ('B' if x >= 60 else 'C'))"
            ],
            note: "`np.select`는 조건 리스트의 **앞에서부터** 처음 참인 값을 택한다. 결과는 ndarray라 대입하면 컬럼이 된다."
          },
          {
            title: "딕셔너리로 집계·이름 바꾸기·형 변환 명세",
            lang: "python",
            code: [
              "g = df.groupby('dept').agg({'salary': ['mean', 'max'], 'age': 'count'})",
              "g.columns = ['_'.join(c) for c in g.columns]          # ('salary','mean') → 'salary_mean'",
              "df = df.rename(columns={'old': 'new'}).astype({'age': 'int64'})",
              "df.columns = [c.strip().lower() for c in df.columns]"
            ],
            note: "컬럼 MultiIndex는 튜플의 시퀀스라 `'_'.join(튜플)`로 평탄화된다."
          },
          {
            title: "그룹별 사용자 함수와 표준화",
            lang: "python",
            code: [
              "def top2(g):                       # g: 그룹 하나의 DataFrame",
              "    return g.nlargest(2, 'sales')",
              "top = df.groupby('region', group_keys=False)[['region', 'sales']].apply(top2)",
              "df['z'] = df.groupby('region')['sales'].transform(lambda s: (s - s.mean()) / s.std())",
              "top_alt = df.sort_values('sales', ascending=False).groupby('region').head(2)   # apply 없는 대안"
            ],
            note: "`transform`은 길이가 보존되어 바로 컬럼 대입이 된다. 상위 n 추출은 정렬 후 `groupby.head(n)`이 더 빠르고 버전 차이가 없다."
          },
          {
            title: "문자열 결합·정규식 추출·날짜 파싱 조합",
            lang: "python",
            code: [
              "df['key'] = df['year'].astype(str) + '_' + df['region']       # 숫자는 astype(str) 필수",
              "ex = df['code'].str.extract(r'^([A-Z]{2})-(\\d{4})')          # 그룹마다 컬럼 하나",
              "df['country'], df['year'] = ex[0], ex[1].astype(int)",
              "df['month'] = pd.to_datetime(df['date']).dt.month"
            ],
            note: "`str.extract`는 캡처 그룹 수만큼 컬럼을 가진 DataFrame을 주고, 매칭 실패 행은 NaN이다."
          },
          {
            title: "딕셔너리 리스트 ↔ DataFrame, pipe 체이닝",
            lang: "python",
            code: [
              "df = pd.DataFrame(records)                 # [{'a': 1, 'b': 2}, ...] → 키가 컬럼",
              "flat = pd.json_normalize(nested, sep='_')  # {'info': {'x': 1}} → 'info_x'",
              "rows = df.to_dict(orient='records')        # 다시 딕셔너리 리스트로",
              "def add_ratio(d, col, by): return d.assign(ratio=d[col] / d[by])",
              "out = df.pipe(add_ratio, 'sales', 'cost').query('ratio > 1')"
            ],
            note: "`df.pipe(f, a, b)`는 `f(df, a, b)`와 같다. 사용자 함수가 DataFrame을 **반환**해야 체인이 이어진다."
          },
          {
            title: "조건 집계와 구간화 + 빈도",
            lang: "python",
            code: [
              "n_pos = (df['x'] > 0).sum()                # 조건 만족 행 수",
              "ratio = (df['x'] > 0).mean()               # 비율 (True=1, False=0 의 평균)",
              "df['bin'] = pd.cut(df['x'], bins=[0, 10, 20], labels=['low', 'high'])",
              "df['bin'].value_counts().sort_index()"
            ]
          }
        ],
        pitfalls: [
          "`df.apply(f, axis=1)`에서 `axis=1`을 빼면 f가 **컬럼** Series를 받는다. `row['col']`이 KeyError를 내는 가장 흔한 원인.",
          "`map(딕셔너리)`에 없는 키는 **NaN**이 된다(원래 값 유지가 아님). 그 때문에 정수 컬럼이 float로 바뀐다.",
          "정수 컬럼과 문자열 `'_'`를 `+`로 바로 더하면 TypeError. `astype(str)` 먼저.",
          "`iterrows`가 돌려주는 행 Series는 **한 dtype으로 승격**되어 정수가 float로 보일 수 있다. 값 비교·성능 모두에서 벡터화가 우선.",
          "`np.select`의 조건 순서를 바꾸면 결과가 바뀐다 — 넓은 조건(`x >= 60`)을 앞에 두면 좁은 조건(`x >= 90`)이 가려진다."
        ]
      }
    },

    /* ────────────────────────────────────────────────────────
       필기 문제 — b-3 (12) + b-3-2 (20)
       ──────────────────────────────────────────────────────── */
    questions: [
      /* ===== b-3 : 12문제 (mcq 7 / ox 2 / short 3, 난이도 4:6:2) ===== */
      {
        id: "b-3-q01", node: "b-3", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`df.apply(f, axis=1)`에서 함수 `f`가 매 호출마다 받는 인수 `row`의 타입과 접근 방법으로 옳은 것은?",
        choices: [
          "튜플이며 `row[0]`처럼 위치로만 접근한다",
          "컬럼명을 인덱스로 가진 `Series`이며 `row['col']`로 접근한다",
          "딕셔너리이며 `row.get('col')`만 가능하고 속성 접근은 불가하다",
          "`ndarray`이며 컬럼명은 사라져 `row['col']`은 KeyError가 난다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** `axis=1`일 때 [[apply|apply]]는 행 하나를 **컬럼명을 인덱스로 가진 Series**로 넘긴다. 그래서 `row['price'] * row['qty']`처럼 라벨로 접근하고, 속성 접근 `row.price`도 된다.",
          "",
          "- ① 튜플로 넘기는 것은 `itertuples()`다. apply는 Series를 넘긴다.",
          "- ③ 딕셔너리가 아니다. `row.get('col')`은 Series에도 있지만 `row['col']`·`row.col`도 가능하다.",
          "- ④ 컬럼명은 인덱스로 보존된다. ndarray가 되는 것은 `raw=True`를 줬을 때뿐이다.",
          "",
          "시험에서는 \"행 단위 적용(row-wise apply)에서 `row`가 무엇인가\"를 묻고, [[axis|축(axis)]]을 빼먹은 코드의 오류를 찾게 한다."
        ],
        terms: ["apply", "axis", "lambda"]
      },
      {
        id: "b-3-q02", node: "b-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2], 'b': [10, 20]})",
          "r = df.apply(lambda row: pd.Series({'s': row['a'] + row['b'],",
          "                                   'd': row['b'] - row['a']}), axis=1)",
          "print(type(r).__name__, r.shape)"
        ],
        lang: "python",
        choices: ["Series (2,)", "Series (4,)", "DataFrame (2, 1)", "DataFrame (2, 2)"],
        answer: 3,
        explanation: [
          "**정답: ④** 행 단위 [[apply|apply]]에서 람다가 **`pd.Series`를 반환**하면 그 Series의 인덱스(`s`, `d`)가 결과의 **컬럼**이 되어 DataFrame이 만들어진다. 행 2개 × 컬럼 2개 = `(2, 2)`.",
          "",
          "- ① 스칼라(예: `row['a'] + row['b']`)를 반환했을 때의 결과다.",
          "- ② 결과가 길이 4로 늘어나는 일은 없다. 행 수는 보존된다.",
          "- ③ 컬럼은 반환 Series의 원소 수인 2개다.",
          "",
          "시험에서는 \"반환값이 스칼라면 Series, Series면 DataFrame\"이라는 [[user-defined-function|사용자 정의 함수(UDF)]] 반환 구조 규칙으로 출제된다. `result_type='expand'`로 리스트 반환을 컬럼으로 펼치는 것도 같은 맥락이다."
        ],
        terms: ["apply", "lambda", "result-type"]
      },
      {
        id: "b-3-q03", node: "b-3", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`s.map({'a': 1, 'b': 2})`를 실행하면 딕셔너리에 없는 값 `'c'`는 원래 값 `'c'`가 그대로 유지된다.",
        answer: false,
        explanation: [
          "**정답: X** [[map|map]]에 딕셔너리(또는 Series)를 주면 **없는 키는 NaN**이 된다. 원래 값을 유지하고 싶으면 [[replace|replace]]를 쓰거나 `map` 뒤에 `.fillna(s)`를 붙인다.",
          "결과에 NaN이 섞이면 정수 컬럼이 float로 바뀌는 부작용도 생긴다(`[1.0, 2.0, nan]`).",
          "",
          "시험에서는 매핑(map)과 치환(replace)의 **없는 키 처리 차이**를 OX·출력 문제로 반복해 묻는다."
        ],
        terms: ["map", "replace", "dictionary"]
      },
      {
        id: "b-3-q04", node: "b-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np, pandas as pd",
          "s = pd.Series([5, 15, 25])",
          "r = np.select([s < 10, s < 20], ['low', 'mid'], default='high')",
          "print(r.tolist())"
        ],
        lang: "python",
        choices: ["['low', 'mid', 'high']", "['low', 'low', 'high']", "['mid', 'mid', 'high']", "ValueError"],
        answer: 0,
        explanation: [
          "**정답: ①** [[np-select|np.select]]는 조건 리스트를 **앞에서부터** 검사해 처음 참인 조건의 값을 택한다. 5는 `s < 10` 참 → 'low', 15는 `s < 10` 거짓·`s < 20` 참 → 'mid', 25는 둘 다 거짓 → `default` 'high'.",
          "",
          "- ② 15는 `s < 10`을 만족하지 않으므로 'low'가 아니다.",
          "- ③ 5는 첫 조건에서 이미 'low'로 결정된다. 15만 'mid'.",
          "- ④ 조건 리스트와 값 리스트 길이가 같아(2=2) 오류가 나지 않는다.",
          "",
          "시험에서는 [[np-where|np.where]]가 2분기, `np.select`가 다분기이며 **조건 순서가 결과를 바꾼다**는 점을 출력 문제로 낸다."
        ],
        terms: ["np-select", "np-where", "vectorization"]
      },
      {
        id: "b-3-q05", node: "b-3", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 문자열 메서드 이름을 쓰시오. 모든 컬럼명을 소문자로 바꾼다: `df.columns = [c.____() for c in df.columns]`",
        answer: "lower",
        accept: ["lower()", "str.lower"],
        explanation: [
          "**정답: lower** `df.columns`는 반복 가능한 Index이므로 [[list-comprehension|리스트 컴프리헨션]]으로 각 컬럼명 문자열에 `lower()`를 적용한 새 리스트를 만들어 다시 대입한다.",
          "같은 결과를 pandas 방식으로는 `df.columns = df.columns.str.lower()`(Index의 [[str-accessor|str 접근자]])로 얻는다. 공백 제거는 `c.strip()`, 치환은 `c.replace(' ', '_')`를 이어 붙인다.",
          "",
          "시험에서는 컬럼명 가공 코드의 빈칸(`lower`, `strip`, `replace`)을 채우게 하거나, `df.rename(columns=str.lower)`가 같은 뜻임을 묻는다."
        ],
        terms: ["list-comprehension", "str-accessor"]
      },
      {
        id: "b-3-q06", node: "b-3", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 `TypeError`를 낸다. 원인으로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'year': [2023, 2024], 'region': ['KR', 'US']})",
          "df['key'] = df['year'] + '_' + df['region']"
        ],
        lang: "python",
        choices: [
          "`'_'`는 길이 1 문자열이라 길이 2 Series와 브로드캐스트되지 않는다",
          "`df['key']`가 아직 없는 컬럼이어서 대입할 수 없다",
          "정수 Series와 문자열을 `+`로 더할 수 없다 — `df['year'].astype(str)`로 먼저 바꿔야 한다",
          "Series끼리는 `+`가 아니라 `str.cat()`으로만 결합할 수 있다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `year`는 정수(int64) Series다. 정수와 문자열 `'_'`의 덧셈은 Python에서도 pandas에서도 정의되지 않아 TypeError가 난다. [[type-casting|형 변환]] `df['year'].astype(str) + '_' + df['region']`이 올바른 [[string-concatenation|문자열 결합]]이다.",
          "",
          "- ① 스칼라 문자열은 Series 전체에 브로드캐스트된다. 길이 문제가 아니다.",
          "- ② 없는 컬럼명으로 대입하면 새 컬럼이 만들어진다. 대입은 문제가 아니다.",
          "- ④ 문자열 Series끼리는 `+`로 결합된다. `str.cat`은 대안일 뿐 필수가 아니다.",
          "",
          "시험에서는 \"숫자 컬럼을 문자열과 결합할 때 빠진 한 줄\"을 고르게 한다. 답은 거의 항상 `astype(str)`이다."
        ],
        terms: ["string-concatenation", "type-casting", "dtype"]
      },
      {
        id: "b-3-q07", node: "b-3", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "DataFrame 행 반복(iteration)에 대한 설명으로 옳은 것은?",
        choices: [
          "`iterrows()`는 각 행을 namedtuple로 돌려주어 `row.col`로만 접근한다",
          "`itertuples()`는 `iterrows()`보다 빠르고 원래 dtype을 더 잘 보존한다",
          "`iterrows()`가 돌려주는 행 Series는 각 컬럼의 dtype을 항상 그대로 유지한다",
          "`iterrows()` 반복문은 같은 계산의 벡터화 연산보다 빠르다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[iterrows|itertuples]]는 행을 namedtuple로 만들어 Series 생성 비용이 없으므로 `iterrows`보다 훨씬 빠르고, 한 행을 하나의 dtype으로 승격하지 않아 정수가 float로 바뀌는 일이 적다.",
          "",
          "- ① namedtuple을 주는 것은 `itertuples()`다. `iterrows()`는 `(index, Series)` 쌍을 준다.",
          "- ③ `iterrows()`는 한 행을 Series로 만들면서 **공통 dtype으로 승격**한다. 정수 컬럼이 float로 보일 수 있다.",
          "- ④ 반대다. 파이썬 반복문은 [[vectorization|벡터화]] 연산보다 수십~수백 배 느리다.",
          "",
          "시험에서는 성능 순서 \"iterrows < itertuples < zip < 벡터화\"와 **iterrows의 dtype 승격**을 묻는다."
        ],
        terms: ["iterrows", "vectorization", "dtype"]
      },
      {
        id: "b-3-q08", node: "b-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'g': ['a', 'a', 'b', 'b'], 'v': [1, 3, 2, 6]})",
          "z = df.groupby('g')['v'].transform(lambda s: (s - s.mean()) / s.std())",
          "print((z > 0).sum(), round((z > 0).mean(), 2))"
        ],
        lang: "python",
        choices: ["4 1.0", "1 0.25", "2 2.0", "2 0.5"],
        answer: 3,
        explanation: [
          "**정답: ④** [[transform|transform]]에 람다를 주면 그룹별 Series `s`를 받아 **같은 길이**로 돌려준다. 그룹 a(1, 3)와 b(2, 6)는 각각 평균보다 큰 값이 하나씩 있어 z가 양수인 행은 2개. `(z > 0).sum()`은 참 개수 2, `.mean()`은 비율 2/4 = 0.5.",
          "",
          "- ① 각 그룹에서 평균보다 큰 값은 하나뿐이라 4개가 양수일 수 없다.",
          "- ② 그룹이 둘이므로 양수 z도 둘이다. 1개가 아니다.",
          "- ③ 불리언 Series의 평균은 0~1 사이의 **비율**이다. 2.0은 나올 수 없다.",
          "",
          "시험에서는 그룹별 [[standardization|표준화]](z-score)를 `transform`으로 쓰는 패턴과 `(조건).sum()`/`.mean()`의 [[conditional-aggregation|조건 집계]] 해석이 함께 출제된다."
        ],
        terms: ["transform", "standardization", "conditional-aggregation", "lambda"]
      },
      {
        id: "b-3-q09", node: "b-3", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`(df['x'] > 0).mean()`은 `x`가 0보다 큰 행의 **비율**(0~1)을 돌려준다.",
        answer: true,
        explanation: [
          "**정답: O** 비교 연산 `df['x'] > 0`은 불리언(boolean) Series를 만들고, 평균을 구할 때 True는 1·False는 0으로 계산된다. 따라서 `.mean()`은 참인 행의 비율, `.sum()`은 참인 행의 개수다.",
          "이것이 [[conditional-aggregation|조건 집계]] 패턴이며, `groupby('g')['x'].apply(lambda s: (s > 0).mean())`처럼 그룹별 비율로 확장된다.",
          "",
          "시험에서는 \"조건을 만족하는 비율을 구하는 한 줄\"로 `.mean()`을 고르게 하거나, `.sum()`과 혼동하도록 보기를 구성한다."
        ],
        terms: ["conditional-aggregation", "boolean-indexing"]
      },
      {
        id: "b-3-q10", node: "b-3", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`g = df.groupby('d').agg({'v': ['sum', 'max']})`의 결과 컬럼은 `('v', 'sum')`, `('v', 'max')`인 MultiIndex다. 이를 `v_sum`, `v_max`로 평탄화하는 코드로 옳은 것은?",
        choices: [
          "`g.columns = ['_'.join(c) for c in g.columns]`",
          "`g.columns = g.columns.join('_')`",
          "`g = g.reset_index(level=1)`",
          "`g.columns = g.columns.str.join('_')`"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 컬럼 [[multiindex|다중 인덱스]]를 순회하면 각 원소가 **튜플** `('v', 'sum')`이다. Python 문자열 메서드 `'_'.join(튜플)`이 `'v_sum'`을 만들고, [[list-comprehension|리스트 컴프리헨션]]으로 전체를 모아 다시 대입하면 [[flatten-columns|컬럼 평탄화]]가 끝난다.",
          "",
          "- ② `Index.join`은 다른 Index와의 집합 연산(inner/outer 조인)이다. 문자열 join이 아니다.",
          "- ③ `reset_index`는 **행** 인덱스를 컬럼으로 내리는 것이라 컬럼 MultiIndex에는 영향이 없다.",
          "- ④ `.str.join`은 각 원소가 문자열 리스트일 때 쓰는 접근자 메서드로, 튜플 MultiIndex 컬럼에는 적용되지 않는다. 대안은 `g.columns.map('_'.join)`이다.",
          "",
          "시험에서는 피벗·딕셔너리 집계 뒤 \"컬럼 이름을 한 단계로 만드는 코드\"를 고르게 한다. `'_'.join`과 `map('_'.join)` 두 형태를 기억한다."
        ],
        terms: ["flatten-columns", "multiindex", "list-comprehension", "aggregation"]
      },
      {
        id: "b-3-q11", node: "b-3", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 `orient` 값을 쓰시오. DataFrame을 `[{'a': 1, 'b': 'x'}, {'a': 2, 'b': 'y'}]`처럼 **행마다 딕셔너리 하나**인 리스트로 바꾼다: `df.to_dict(orient='____')`",
        answer: "records",
        accept: ["'records'", "\"records\""],
        explanation: [
          "**정답: records** [[to-dict|to_dict]]의 `orient='records'`는 행마다 `{컬럼: 값}` 딕셔너리를 만들어 **리스트**로 돌려준다. JSON API 응답이나 `pd.DataFrame(records)`의 입력 형태와 같은 [[records|레코드(딕셔너리 리스트)]] 방향이다.",
          "다른 방향: 기본값 `'dict'`는 `{컬럼: {인덱스: 값}}`, `'list'`는 `{컬럼: [값들]}`, `'index'`는 `{인덱스: {컬럼: 값}}`, `'split'`은 `{'index', 'columns', 'data'}` 세 키.",
          "",
          "시험에서는 `orient` 다섯 가지 중 \"딕셔너리 리스트\"에 해당하는 것을 고르게 하며, 역방향 `pd.DataFrame(딕셔너리 리스트)`에서 키가 컬럼이 된다는 점과 짝지어 나온다."
        ],
        terms: ["to-dict", "records", "dictionary"]
      },
      {
        id: "b-3-q12", node: "b-3", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import pandas as pd",
          "s = pd.Series(['id_007', 'id_042'])",
          "print(s.str.extract(r'(\\d+)')[0].astype(int).sum())"
        ],
        lang: "python",
        answer: "49",
        explanation: [
          "**정답: 49** [[str-extract|str.extract]]는 [[regex|정규식]]의 **캡처 그룹**마다 컬럼 하나를 가진 DataFrame을 돌려준다. 그룹이 하나라 컬럼 `0`에 `'007'`, `'042'`가 문자열로 들어가고, `astype(int)`로 7과 42가 되어 합은 49.",
          "추출 결과는 항상 **문자열(object/str)** 이므로 수치 계산 전에 [[type-casting|형 변환]]이 필요하다. 매칭 실패 행은 NaN이 되어 `astype(int)`가 실패하므로 실무에서는 `pd.to_numeric(errors='coerce')`를 쓴다.",
          "",
          "시험에서는 `extract`의 반환이 DataFrame이라는 점(`[0]`으로 첫 그룹 선택)과 추출값이 문자열이라는 점을 함께 묻는다."
        ],
        terms: ["str-extract", "regex", "type-casting"]
      },

      /* ===== b-3-2 : 20문제 (mcq 12 / ox 3 / short 5, 난이도 6:10:4, output ≥ 6) ===== */
      {
        id: "b-3-2-q01", node: "b-3-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['a', 'b', 'c'])",
          "print(s.map({'a': 1, 'b': 2}).tolist())"
        ],
        lang: "python",
        choices: ["[1, 2, 'c']", "[1.0, 2.0, nan]", "[1, 2]", "KeyError: 'c'"],
        answer: 1,
        explanation: [
          "**정답: ②** [[map|map]]에 [[dictionary|딕셔너리]]를 주면 키에 없는 `'c'`는 **NaN**이 된다. NaN이 섞이면서 정수 1, 2가 float 1.0, 2.0으로 승격되어 `[1.0, 2.0, nan]`.",
          "",
          "- ① 원래 값을 유지하는 것은 `replace({'a': 1, 'b': 2})`의 동작이다.",
          "- ③ 길이는 보존된다. 행이 사라지지 않는다.",
          "- ④ 없는 키는 예외가 아니라 결측값(missing value)으로 처리된다.",
          "",
          "시험에서는 `map`과 `replace`의 없는 키 처리, 그리고 **NaN 때문에 생기는 float 승격**을 출력 문제로 낸다."
        ],
        terms: ["map", "dictionary", "missing-value"]
      },
      {
        id: "b-3-2-q02", node: "b-3-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`cols = ['a', 'b']`일 때 `df[cols] = df[cols[::-1]].to_numpy()`는 라벨 정렬 없이 **위치대로** 값을 넣으므로 두 컬럼 `a`, `b`의 값이 서로 맞바뀐다.",
        answer: true,
        explanation: [
          "**정답: O** 우변을 `to_numpy()`(또는 `.values`)로 ndarray로 바꾸면 컬럼 라벨이 사라져 pandas가 **정렬(alignment)** 을 하지 않고 위치 순서대로 대입한다. 그래서 `a`에는 옛 `b`, `b`에는 옛 `a`가 들어가 교환된다.",
          "반면 `df.loc[:, cols] = df[cols[::-1]]`처럼 DataFrame을 그대로 넘기면 라벨 기준으로 맞춰 넣어 **아무것도 바뀌지 않는다**. 리스트로 여러 컬럼을 한 번에 다루는 [[multi-column-assignment|다중 컬럼 할당]]의 대표 함정이다.",
          "",
          "시험에서는 \"두 컬럼 값 맞바꾸기\" 코드에서 `.values`/`.to_numpy()`가 왜 필요한지를 묻는다."
        ],
        terms: ["multi-column-assignment", "unpacking"]
      },
      {
        id: "b-3-2-q03", node: "b-3-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`df.groupby('g').agg({'v': 'sum', 'w': 'mean'})`에 대한 설명으로 옳은 것은?",
        choices: [
          "결과 컬럼은 `('v', 'sum')`, `('w', 'mean')`의 MultiIndex가 된다",
          "`v`, `w` 두 컬럼 모두에 `sum`과 `mean`을 각각 적용해 4개 컬럼이 생긴다",
          "컬럼마다 다른 함수를 적용하며 결과 컬럼은 `v`, `w` 단일 레벨이다",
          "딕셔너리 값에는 문자열만 올 수 있고 함수 객체나 리스트는 올 수 없다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[aggregation|agg]]에 `{컬럼: 함수}` [[dictionary|딕셔너리]]를 주면 **컬럼별로 다른 함수**를 적용한다. 값이 함수 하나(문자열)면 결과 컬럼은 원래 이름 `v`, `w`의 단일 레벨이다.",
          "",
          "- ① MultiIndex 컬럼은 값이 **리스트**(`{'v': ['sum', 'max']}`)일 때 생긴다.",
          "- ② 모든 컬럼에 모든 함수를 적용하는 것은 `agg(['sum', 'mean'])`처럼 리스트를 통째로 줬을 때다.",
          "- ④ 값에는 함수 객체(`np.mean`), 람다, 함수 리스트도 올 수 있다.",
          "",
          "시험에서는 딕셔너리 agg와 리스트 agg의 **결과 컬럼 구조 차이**, 그리고 [[named-aggregation|이름 붙인 집계]] `agg(total=('v', 'sum'))`와의 비교로 출제된다."
        ],
        terms: ["aggregation", "dictionary", "named-aggregation", "groupby"]
      },
      {
        id: "b-3-2-q04", node: "b-3-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})",
          "print([x * y for x, y in zip(df['a'], df['b'])])"
        ],
        lang: "python",
        choices: ["[4, 10, 18]", "[(1, 4), (2, 5), (3, 6)]", "[32]", "TypeError"],
        answer: 0,
        explanation: [
          "**정답: ①** [[zip|zip]]은 두 컬럼 Series를 **행 단위 쌍** `(1, 4)`, `(2, 5)`, `(3, 6)`으로 묶고, [[list-comprehension|컴프리헨션]]의 `for x, y in`이 각 쌍을 [[unpacking|언패킹]]해 곱한다. 결과는 `[4, 10, 18]`.",
          "",
          "- ② 곱하지 않고 쌍만 모았을 때(`list(zip(...))`)의 결과다.",
          "- ③ 합계 32는 `sum(x*y for ...)`처럼 집계했을 때 나온다.",
          "- ④ Series는 반복 가능(iterable)하므로 `zip`에 그대로 넣을 수 있다.",
          "",
          "시험에서는 `zip`이 컬럼 쌍 순회 도구임을 묻고, 같은 결과를 내는 벡터화 코드 `(df['a'] * df['b']).tolist()`가 더 빠르다는 점을 덧붙여 낸다."
        ],
        terms: ["zip", "list-comprehension", "unpacking"]
      },
      {
        id: "b-3-2-q05", node: "b-3-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 pandas 함수 이름을 쓰시오. `[{'id': 1, 'info': {'x': 1, 'y': 2}}]`처럼 **중첩된 딕셔너리 리스트**를 `id`, `info_x`, `info_y` 컬럼의 평탄한 DataFrame으로 만든다: `pd.____(records, sep='_')`",
        answer: "json_normalize",
        accept: ["json_normalize()", "pd.json_normalize"],
        explanation: [
          "**정답: json_normalize** [[json-normalize|json_normalize]]는 중첩 딕셔너리(JSON)를 **점(또는 `sep`)으로 이어 붙인 컬럼명**으로 평탄화해 DataFrame을 만든다. `info.x` 대신 `sep='_'`로 `info_x`가 된다.",
          "그냥 `pd.DataFrame(records)`를 쓰면 `info` 컬럼에 딕셔너리가 **그대로 객체로** 들어가 평탄화되지 않는다. 리스트가 중첩된 경우는 `record_path=` 인수로 펼친다.",
          "",
          "시험에서는 API 응답(JSON) → DataFrame 변환 코드의 빈칸으로 나오며, `pd.DataFrame(레코드)`와의 차이(중첩 처리 여부)를 함께 묻는다."
        ],
        terms: ["json-normalize", "records", "dictionary"]
      },
      {
        id: "b-3-2-q06", node: "b-3-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2, 3], 'b': [3, 2, 1]})",
          "r = df.apply(lambda row: max(row['a'], row['b']), axis=1)",
          "print(r.tolist())"
        ],
        lang: "python",
        choices: ["[3, 3]", "(3, 2, 3)", "[1, 2, 3, 3, 2, 1]", "[3, 2, 3]"],
        answer: 3,
        explanation: [
          "**정답: ④** `axis=1`이므로 [[lambda|람다]]는 각 행 Series를 받아 `a`, `b` 중 큰 값을 **스칼라**로 돌려준다. 스칼라 반환이면 결과는 행 수와 같은 길이의 Series: 행 0 → max(1, 3) = 3, 행 1 → max(2, 2) = 2, 행 2 → max(3, 1) = 3.",
          "",
          "- ① `[3, 3]`은 `axis=0`으로 컬럼마다 최대를 구했을 때의 값이다(그 경우 `row['a']`는 KeyError지만 `row.max()`였다면 이 결과).",
          "- ② `tolist()`는 튜플이 아니라 **리스트**를 돌려준다. 값은 같아도 타입 표기가 다르다.",
          "- ③ 두 컬럼을 이어 붙인 길이 6이 될 이유가 없다. [[apply|apply]]는 행 수를 보존한다.",
          "",
          "시험에서는 \"여러 컬럼을 쓰는 람다는 `axis=1`\"과 \"스칼라 반환 → Series\"를 결합한 출력 문제로 나온다. 벡터화 대안은 `df.loc[:, ['a', 'b']].max(axis=1)`이다."
        ],
        terms: ["apply", "lambda", "axis"]
      },
      {
        id: "b-3-2-q07", node: "b-3-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "조건부 컬럼 생성 방법 `np.where`, `np.select`, `apply`의 비교로 옳은 것은?",
        choices: [
          "`np.where`는 조건을 리스트로 여러 개 넣어 3분기 이상도 한 번에 처리한다",
          "`np.select`는 조건 리스트와 값 리스트를 받아, 앞에서부터 **처음 참인 조건**의 값을 택한다",
          "`apply(axis=1)`은 C 수준에서 실행되어 셋 중 가장 빠르다",
          "`np.where`의 반환값은 항상 원본과 같은 인덱스를 가진 `Series`다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[np-select|np.select]]`(condlist, choicelist, default)`는 다분기용이며, 조건이 여러 개 참이면 **리스트에서 앞선 조건**이 이긴다. 그래서 좁은 조건(`>= 90`)을 넓은 조건(`>= 60`)보다 앞에 둔다.",
          "",
          "- ① [[np-where|np.where]]`(cond, x, y)`는 조건 **하나**의 2분기다. 3분기는 중첩하거나 `np.select`를 쓴다.",
          "- ③ `apply(axis=1)`은 행마다 파이썬 함수를 호출하므로 셋 중 **가장 느리다**. 유연성이 장점일 뿐이다.",
          "- ④ `np.where`는 **ndarray**를 돌려준다. 컬럼에 대입하면 위치대로 들어가지만 인덱스는 없다.",
          "",
          "시험에서는 세 방식의 \"분기 수·속도·반환 타입\" 중 하나를 바꿔 틀린 보기를 만든다. [[vectorization|벡터화]] 우선 원칙을 기억한다."
        ],
        terms: ["np-where", "np-select", "apply", "vectorization"]
      },
      {
        id: "b-3-2-q08", node: "b-3-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`df.groupby('g').apply(f)`에서 사용자 함수 `f`는 그룹 하나에 해당하는 **DataFrame**을 인수로 받는다.",
        answer: true,
        explanation: [
          "**정답: O** [[groupby|groupby]] 객체의 [[apply|apply]]는 [[split-apply-combine|분할-적용-결합]]의 \"적용\" 단계에서 **그룹별 부분 DataFrame**을 `f`에 넘긴다. 그래서 `f` 안에서 `g.nlargest(2, 'v')`, `g['v'].mean()`처럼 DataFrame 메서드를 쓸 수 있다.",
          "`df.groupby('g')['v'].apply(f)`처럼 컬럼을 먼저 고르면 `f`는 **Series**를 받는다. 반환이 스칼라면 그룹당 한 값, DataFrame이면 그대로 이어 붙여진다.",
          "",
          "시험에서는 \"f가 받는 것은 DataFrame인가 Series인가\"와 \"반환 모양에 따라 결과 구조가 달라진다\"를 함께 묻는다. 상위 n 추출은 정렬 후 `groupby.head(n)`이 더 간단한 대안이다."
        ],
        terms: ["groupby", "apply", "split-apply-combine", "user-defined-function"]
      },
      {
        id: "b-3-2-q09", node: "b-3-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'d': ['x', 'x', 'y'], 'v': [1, 2, 3]})",
          "g = df.groupby('d').agg({'v': ['sum', 'max']})",
          "g.columns = ['_'.join(c) for c in g.columns]",
          "print(g.columns.tolist())"
        ],
        lang: "python",
        choices: ["[('v', 'sum'), ('v', 'max')]", "['sum', 'max']", "['v_sum', 'v_max']", "['d', 'v_sum', 'v_max']"],
        answer: 2,
        explanation: [
          "**정답: ③** 딕셔너리 값이 리스트라 결과 컬럼은 [[multiindex|다중 인덱스]] `('v','sum')`, `('v','max')`다. 컴프리헨션이 각 튜플을 `'_'.join`으로 이어 `'v_sum'`, `'v_max'`로 [[flatten-columns|평탄화]]한다.",
          "",
          "- ① 평탄화 **전**의 컬럼 모습이다. 대입 뒤에는 바뀐다.",
          "- ② 두 번째 레벨만 쓴 결과(`g.columns.get_level_values(1)`)다. `join`은 두 레벨을 모두 이어 붙인다.",
          "- ④ `d`는 그룹 키라 **행 인덱스**에 있다. `reset_index()`를 하기 전에는 컬럼이 아니다.",
          "",
          "시험에서는 `agg` 딕셔너리 → MultiIndex → `'_'.join` 평탄화의 세 단계가 한 코드로 묶여 출력 문제로 나온다."
        ],
        terms: ["flatten-columns", "multiindex", "aggregation"]
      },
      {
        id: "b-3-2-q10", node: "b-3-2", type: "short", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'x': [3, -1, 0, 5]})",
          "print(int((df['x'] > 0).mean() * 100))"
        ],
        lang: "python",
        answer: "50",
        explanation: [
          "**정답: 50** `df['x'] > 0`은 `[True, False, False, True]`. 불리언의 평균은 True를 1로 보아 2/4 = 0.5이고, 100을 곱해 정수로 바꾸면 50 — 즉 양수인 행의 **비율(%)** 이다.",
          "[[conditional-aggregation|조건 집계]] 패턴: `(조건).sum()`은 개수, `(조건).mean()`은 비율. 그룹별로는 `groupby('g')['x'].apply(lambda s: (s > 0).mean())`로 확장한다.",
          "",
          "시험에서는 `.sum()`(개수 2)과 `.mean()`(비율 0.5)을 바꿔 묻는 출력 문제가 흔하다."
        ],
        terms: ["conditional-aggregation", "boolean-indexing"]
      },
      {
        id: "b-3-2-q11", node: "b-3-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "100만 행 DataFrame에서 `a + b`를 새 컬럼으로 만든다. 다음 중 **가장 빠른** 방법은?",
        choices: [
          "`for i, row in df.iterrows(): df.loc[i, 'c'] = row['a'] + row['b']`",
          "`df['c'] = df.apply(lambda r: r['a'] + r['b'], axis=1)`",
          "`df['c'] = df['a'] + df['b']`",
          "`df['c'] = [a + b for a, b in zip(df['a'], df['b'])]`"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `df['a'] + df['b']`는 [[vectorization|벡터화]] 연산으로 C 수준에서 배열 전체를 한 번에 처리한다. 파이썬 함수 호출이 행마다 일어나지 않아 가장 빠르다.",
          "",
          "- ① [[iterrows|iterrows]] + 행마다 `loc` 대입은 가장 느린 조합이다(행마다 Series 생성 + 쓰기).",
          "- ② `apply(axis=1)`은 행마다 람다를 호출하는 파이썬 반복이라 벡터화보다 수십 배 느리다.",
          "- ④ [[zip|zip]] 컴프리헨션은 `iterrows`·`apply`보다는 빠르지만 여전히 파이썬 루프다.",
          "",
          "시험에서는 성능 순서 \"iterrows < apply(axis=1) < zip 컴프리헨션 < 벡터화\"를 알고 가장 빠른(또는 느린) 것을 고르게 한다."
        ],
        terms: ["vectorization", "iterrows", "apply", "zip"]
      },
      {
        id: "b-3-2-q12", node: "b-3-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['2024-01-15', '2024-02-20', '2024-01-31'])",
          "d = pd.to_datetime(s)",
          "print(d.dt.year.iloc[0], d.dt.month.value_counts().idxmax(), d.dt.day_name().iloc[0])"
        ],
        lang: "python",
        choices: ["2024 1 Monday", "2024 2 Monday", "2024 1 Sunday", "AttributeError"],
        answer: 0,
        explanation: [
          "**정답: ①** 문자열을 `to_datetime`으로 [[datetime|날짜시간형]]으로 바꾼 뒤에만 [[dt-accessor|dt 접근자]]를 쓸 수 있다. 첫 행의 연도는 2024, 월은 1이 두 번·2가 한 번이라 [[value-counts|value_counts]]의 `idxmax()`는 1, 2024-01-15는 월요일(Monday).",
          "",
          "- ② 월 빈도는 1월이 2회로 가장 많다. 2가 아니다.",
          "- ③ 2024년 1월 15일은 월요일이다. `day_name()`은 영어 요일 이름을 돌려준다.",
          "- ④ `to_datetime` 변환을 거쳤으므로 `.dt`가 정상 동작한다. 문자열 Series에 바로 `.dt`를 쓰면 그때 AttributeError다.",
          "",
          "시험에서는 \"문자열 → to_datetime → dt.속성 → 집계\"의 조합을 한 줄로 묶어 출력 문제로 낸다. `value_counts().idxmax()`가 **최빈값**의 라벨이라는 점도 함께."
        ],
        terms: ["dt-accessor", "datetime", "value-counts"]
      },
      {
        id: "b-3-2-q13", node: "b-3-2", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['A-10', 'B-20', 'C-x'])",
          "r = s.str.extract(r'([A-Z])-(\\d+)')",
          "print(r.shape, r[1].isna().sum())"
        ],
        lang: "python",
        choices: ["(3,) 1", "(2, 2) 0", "(3, 1) 1", "(3, 2) 1"],
        answer: 3,
        explanation: [
          "**정답: ④** [[str-extract|str.extract]]는 [[regex|정규식]] 캡처 그룹이 2개이므로 **컬럼 2개**(`0`, `1`)인 DataFrame을 돌려주고 행 수는 원본과 같은 3이다 → `(3, 2)`. `'C-x'`는 `\\d+`에 매칭되지 않아 그 행은 두 컬럼 모두 NaN이므로 `r[1].isna().sum()`은 1.",
          "",
          "- ① `(3,)`은 Series 모양이다. 그룹이 2개면 `expand=True` 기본값으로 DataFrame이 된다.",
          "- ② 매칭 실패 행은 **삭제되지 않고 NaN**으로 남는다. 행 수 3이 유지된다.",
          "- ③ 컬럼 수는 캡처 그룹 수 2다.",
          "",
          "시험에서는 \"그룹 수 = 컬럼 수\", \"매칭 실패 = NaN(행 유지)\" 두 규칙을 shape와 결측 개수로 확인하게 한다."
        ],
        terms: ["str-extract", "regex", "missing-value"]
      },
      {
        id: "b-3-2-q14", node: "b-3-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`df = pd.DataFrame({'a': [1, 2], 'b': ['x', 'y']})`일 때, `df.to_dict(orient=...)`의 `orient`와 결과 구조의 짝으로 **옳은** 것은?",
        choices: [
          "`'records'` → `{'a': [1, 2], 'b': ['x', 'y']}`",
          "`'list'` → `{'a': [1, 2], 'b': ['x', 'y']}`",
          "`'dict'`(기본값) → `[{'a': 1, 'b': 'x'}, {'a': 2, 'b': 'y'}]`",
          "`'index'` → `{'a': {0: 1, 1: 2}, 'b': {0: 'x', 1: 'y'}}`"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[to-dict|to_dict]]의 `'list'`는 **컬럼 → 값 리스트** 구조 `{'a': [1, 2], 'b': ['x', 'y']}`다. `pd.DataFrame(그 딕셔너리)`를 하면 원래 DataFrame이 복원되는, 생성자 입력과 같은 방향이다.",
          "",
          "- ① `'records'`는 행마다 딕셔너리인 **리스트** `[{'a': 1, 'b': 'x'}, {'a': 2, 'b': 'y'}]`다.",
          "- ③ 기본값 `'dict'`는 `{컬럼: {인덱스: 값}}` = `{'a': {0: 1, 1: 2}, 'b': {0: 'x', 1: 'y'}}`다.",
          "- ④ `'index'`는 `{인덱스: {컬럼: 값}}` = `{0: {'a': 1, 'b': 'x'}, 1: {'a': 2, 'b': 'y'}}`다. 보기의 구조는 `'dict'`의 것.",
          "",
          "시험에서는 네 방향 `dict`/`list`/`records`/`index`를 뒤섞어 짝을 고르게 한다. \"바깥 키가 컬럼인가 인덱스인가, 결과가 리스트인가\"로 구분하면 된다. [[records|레코드]] 형태가 가장 자주 나온다."
        ],
        terms: ["to-dict", "records", "dictionary"]
      },
      {
        id: "b-3-2-q15", node: "b-3-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df.rename(columns={'old': 'new'})`에서 딕셔너리의 키 `'old'`가 실제 컬럼에 없으면 `KeyError`가 발생한다.",
        answer: false,
        explanation: [
          "**정답: X** `rename`은 기본값 `errors='ignore'`라 [[dictionary|딕셔너리]]에 있지만 **실제로 없는 라벨은 조용히 무시**한다. 오타가 있어도 오류 없이 원본 그대로 돌아오므로, 바꿨다고 믿은 컬럼이 그대로인 함정이 생긴다. 엄격히 검사하려면 `errors='raise'`를 준다.",
          "같은 \"없는 것은 무시\" 규칙은 `replace({...})`에도 적용되지만, `map({...})`은 없는 키를 **NaN**으로 만든다는 점이 다르다.",
          "",
          "시험에서는 `rename`·`replace`(무시) vs `map`(NaN) vs `astype({'없는컬럼': ...})`(KeyError)의 **없는 키 처리** 차이를 OX로 묻는다."
        ],
        terms: ["dictionary", "replace", "map"]
      },
      {
        id: "b-3-2-q16", node: "b-3-2", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 groupby 메서드 이름을 쓰시오. 그룹(`g`)별로 `v`가 큰 **상위 2행**을 원본 컬럼 그대로 추출한다: `df.sort_values('v', ascending=False).groupby('g').____(2)`",
        answer: "head",
        accept: ["head()", "head(2)"],
        explanation: [
          "**정답: head** 먼저 전체를 `v` 내림차순으로 정렬하면 각 그룹 안의 순서도 내림차순이 되고, [[groupby-head|groupby.head(n)]]는 **그룹마다 처음 n행**을 원본 컬럼·인덱스 그대로 돌려준다. `apply(lambda g: g.nlargest(2, 'v'))`와 같은 결과를 더 빠르게, pandas 버전 차이 없이 얻는 \"정렬 후 groupby.head\" 패턴이다.",
          "비슷한 메서드: `first()`는 그룹당 1행을 **집계 형태**(그룹 키가 인덱스)로, `nth(1)`은 그룹별 두 번째 행만 돌려준다.",
          "",
          "시험에서는 \"그룹별 상위 n개\"를 구하는 두 방법(정렬+`head` / `apply`+`nlargest`)을 빈칸이나 동치 판단으로 낸다."
        ],
        terms: ["groupby-head", "nlargest", "sort"]
      },
      {
        id: "b-3-2-q17", node: "b-3-2", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, 5, 9, 12, 20])",
          "c = pd.cut(s, bins=[0, 10, 20], labels=['low', 'high'])",
          "print(c.value_counts().tolist(), c.tolist()[2:])"
        ],
        lang: "python",
        choices: ["[3, 2] ['low', 'high', 'high']", "[2, 3] ['high', 'high', 'high']", "[3, 2] ['high', 'high', 'high']", "[2, 2] ['low', 'high', nan]"],
        answer: 0,
        explanation: [
          "**정답: ①** [[binning|구간화]] `pd.cut`은 기본 `right=True`라 구간이 `(0, 10]`, `(10, 20]`이다. 1, 5, 9는 'low', 12와 20은 'high'(20은 오른쪽 경계 포함) → `value_counts()`는 `[3, 2]`. 세 번째 원소부터는 9('low'), 12, 20('high').",
          "",
          "- ② 'low'가 3개, 'high'가 2개다. 9는 10 이하라 'low'.",
          "- ③ 인덱스 2의 값 9는 `(0, 10]` 구간이므로 'low'다.",
          "- ④ 20은 마지막 구간의 **오른쪽 경계에 포함**되어 NaN이 아니다. 0처럼 왼쪽 경계 바깥 값만 NaN이 된다.",
          "",
          "시험에서는 `cut`의 경계 포함 규칙(`right=True`)과 `labels` → [[value-counts|value_counts]] 조합을 출력 문제로 낸다. `qcut`은 분위수 기준 등빈도 구간이라는 점과 함께."
        ],
        terms: ["binning", "value-counts"]
      },
      {
        id: "b-3-2-q18", node: "b-3-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 `KeyError: 'a'`를 낸다. 수정 방법으로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2, 3], 'b': [3, 2, 1]})",
          "df['c'] = df.apply(lambda r: r['a'] + r['b'])"
        ],
        lang: "python",
        choices: [
          "`r['a']`를 `r.a`로 바꾼다 — 람다 안에서는 대괄호 접근이 불가하다",
          "`lambda r:` 를 `def f(r):` 로 바꾼다 — 람다는 두 컬럼을 참조할 수 없다",
          "`df.apply(...)`를 `df['a'].apply(...)`로 바꾼다",
          "`axis=1`을 추가한다 — 기본 `axis=0`은 **컬럼** Series를 넘겨 `r['a']`가 라벨 0, 1, 2 중에 없다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** `DataFrame.apply`의 기본 [[axis|축]]은 0이라 람다가 받는 `r`은 **컬럼** Series(`a` 전체, 그다음 `b` 전체)이고 그 인덱스는 행 라벨 0, 1, 2다. 거기에 `'a'`가 없어 KeyError. `axis=1`을 주면 행 Series(인덱스 = 컬럼명)를 받아 `r['a'] + r['b']`가 성립한다.",
          "",
          "- ① 람다 안에서도 대괄호 접근은 가능하다. `r.a`로 바꿔도 축이 틀렸으니 AttributeError로 바뀔 뿐이다.",
          "- ② 람다도 여러 컬럼을 참조할 수 있다. 함수 정의 형태와 무관하다.",
          "- ③ `df['a'].apply`는 Series의 각 **원소**(스칼라)를 넘기므로 `r['b']`를 쓸 수 없다.",
          "",
          "시험에서는 행 단위 [[apply|apply]]의 가장 흔한 버그인 **`axis=1` 누락**을 KeyError와 묶어 낸다. 벡터화 대안 `df['a'] + df['b']`도 함께 기억한다."
        ],
        terms: ["apply", "axis", "lambda"]
      },
      {
        id: "b-3-2-q19", node: "b-3-2", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 메서드 이름을 쓰시오. 사용자 함수 `f(df, n)`을 메서드 체인 중간에 끼워 `f(df, 3)`과 같이 호출한다: `df.query('x > 0').____(f, 3).sort_values('y')`",
        answer: "pipe",
        accept: ["pipe()"],
        explanation: [
          "**정답: pipe** [[pipe|pipe]]는 DataFrame **전체**를 첫 인수로 사용자 함수에 넘긴다. `df.pipe(f, 3)`은 `f(df, 3)`과 같으므로, DataFrame을 받아 DataFrame을 돌려주는 함수를 [[method-chaining|메서드 체이닝]] 사이에 끼울 수 있다.",
          "`apply`와 헷갈리기 쉽다: `apply`는 행·열·원소 **조각**에 함수를 적용하고, `pipe`는 **객체 전체**를 넘긴다. 함수가 DataFrame을 반환하지 않으면 뒤의 `sort_values`에서 오류가 난다.",
          "",
          "시험에서는 체인 코드의 빈칸으로 `pipe`를 묻거나, `pipe`와 `apply`의 \"무엇을 넘기는가\" 차이를 OX로 낸다."
        ],
        terms: ["pipe", "method-chaining", "user-defined-function"]
      },
      {
        id: "b-3-2-q20", node: "b-3-2", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'g': ['a', 'a', 'b'], 'v': [2, 4, 9]})",
          "print(df.groupby('g')['v'].apply(lambda s: s.nlargest(1).sum()).sum())"
        ],
        lang: "python",
        answer: "13",
        explanation: [
          "**정답: 13** `groupby('g')['v']`로 컬럼을 먼저 골랐으므로 [[apply|apply]]의 람다는 그룹별 **Series** `s`를 받는다. `s.nlargest(1).sum()`은 그룹 최댓값(스칼라)이라 결과는 그룹당 한 값 — a: 4, b: 9. 바깥 `.sum()`으로 4 + 9 = 13.",
          "[[user-defined-function|사용자 함수]]의 반환이 스칼라면 결과는 그룹 수 길이의 Series(인덱스 = 그룹 키)가 된다는 규칙의 적용이다. 같은 값은 `df.groupby('g')['v'].max().sum()`으로도 얻는다.",
          "",
          "시험에서는 그룹별 사용자 함수의 \"받는 것(Series/DataFrame)·돌려주는 것(스칼라/Series)\"을 결과 길이와 값으로 확인하게 한다. [[nlargest|nlargest]]는 상위 n개 **값**을 Series로 돌려준다는 점도 포함."
        ],
        terms: ["apply", "groupby", "nlargest", "user-defined-function"]
      }
    ],

    /* ────────────────────────────────────────────────────────
       실습 과제 — b-3 (2개, 난이도 2·3: 복합 패턴 실전형)
       ──────────────────────────────────────────────────────── */
    practices: [
      {
        id: "b-3-p01", node: "b-3",
        title: "코드 문자열 분해 → 조건 라벨 → 그룹 평균",
        difficulty: 2,
        task: [
          "`df['code']`는 `'KR-2022-001'` 꼴(국가코드-연도-일련번호)이다. 다음을 순서대로 수행하시오.",
          "",
          "- `str.extract`로 **국가코드**(영문 대문자 2자)와 **연도**(숫자 4자리)를 뽑아 `country`, `year`(정수형) 컬럼을 만든다.",
          "- `np.where`로 `year >= 2021`이면 `'recent'`, 아니면 `'old'`인 `label` 컬럼을 만든다.",
          "- `country`, `label` 두 키로 그룹화해 `amount`의 평균을 구한다.",
          "",
          "그 결과에서 **`KR`의 `recent` 그룹 평균**을 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(303)",
          "n = 200",
          "country = rng.choice(['KR', 'US', 'JP'], size=n)",
          "year = rng.integers(2019, 2024, size=n)",
          "df = pd.DataFrame({",
          "    'code': [f\"{c}-{y}-{i:03d}\" for i, (c, y) in enumerate(zip(country, year))],",
          "    'amount': rng.gamma(2.0, 150.0, size=n).round(1),",
          "})",
          "df.head()"
        ],
        hint: [
          "정규식 `r'^([A-Z]{2})-(\\d{4})-'` — 캡처 그룹 2개 → 컬럼 `0`, `1`. 연도는 문자열이므로 `astype(int)`.",
          "두 키 groupby 결과는 MultiIndex Series다. `.loc[('KR', 'recent')]`로 한 값을 꺼낸다."
        ],
        answer: { type: "number", value: 251.71, decimals: 2 },
        solution: [
          "ex = df['code'].str.extract(r'^([A-Z]{2})-(\\d{4})-')",
          "df['country'] = ex[0]",
          "df['year'] = ex[1].astype(int)",
          "df['label'] = np.where(df['year'] >= 2021, 'recent', 'old')",
          "m = df.groupby(['country', 'label'])['amount'].mean()",
          "round(m.loc[('KR', 'recent')], 2)"
        ],
        explanation: [
          "세 가지 복합 패턴이 한 줄씩 이어진다. (1) [[str-extract|str.extract]]는 [[regex|정규식]] 그룹마다 컬럼을 만들고 결과는 **문자열**이므로 연도에 [[type-casting|형 변환]]이 필요하다. (2) [[np-where|np.where]]는 2분기 조건부 컬럼을 ndarray로 돌려주며 그대로 대입하면 컬럼이 된다. (3) 두 키 [[groupby|groupby]] 평균은 MultiIndex Series라 튜플 라벨로 한 값을 고른다.",
          "`np.where` 대신 `df['year'].apply(lambda y: 'recent' if y >= 2021 else 'old')`도 같은 결과지만 더 느리다."
        ],
        terms: ["str-extract", "np-where", "groupby", "type-casting"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "b-3-p02", node: "b-3",
        title: "컬럼명 정리 → 행 단위 apply → 그룹별 표준화 → 조건 집계",
        difficulty: 3,
        task: [
          "`df`의 컬럼은 `Team`, `Q1`, `Q2`, `Q3`(분기별 점수)이다. 다음을 순서대로 수행하시오.",
          "",
          "- 리스트 컴프리헨션으로 모든 컬럼명을 **소문자**로 바꾼다(`team`, `q1`, `q2`, `q3`).",
          "- 행 단위 `apply(axis=1)`로 세 분기 점수 중 **최댓값**을 담은 `best` 컬럼을 만든다.",
          "- `team`별로 `best`를 **표준화**(z = (x − 그룹 평균) / 그룹 표준편차, `std()` 기본 ddof=1)한 `z` 컬럼을 `groupby().transform(lambda ...)`로 만든다.",
          "",
          "`z > 1`인 행의 **개수**(정수)를 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(1203)",
          "n = 240",
          "df = pd.DataFrame({",
          "    'Team': rng.choice(['Red', 'Blue', 'Green', 'Gold'], size=n),",
          "    'Q1': rng.integers(40, 101, size=n),",
          "    'Q2': rng.integers(40, 101, size=n),",
          "    'Q3': rng.integers(40, 101, size=n),",
          "})",
          "df.head()"
        ],
        hint: [
          "`df.columns = [c.lower() for c in df.columns]`",
          "`lambda row: max(row['q1'], row['q2'], row['q3'])` — 스칼라 반환이라 결과는 Series. 벡터화 대안은 `df.loc[:, ['q1', 'q2', 'q3']].max(axis=1)`.",
          "`df.groupby('team')['best'].transform(lambda s: (s - s.mean()) / s.std())` 뒤에 `(df['z'] > 1).sum()`."
        ],
        answer: { type: "int", value: 40 },
        solution: [
          "df.columns = [c.lower() for c in df.columns]",
          "df['best'] = df.apply(lambda row: max(row['q1'], row['q2'], row['q3']), axis=1)",
          "df['z'] = df.groupby('team')['best'].transform(lambda s: (s - s.mean()) / s.std())",
          "int((df['z'] > 1).sum())"
        ],
        explanation: [
          "네 단계가 각각 하나의 복합 패턴이다. (1) [[list-comprehension|컴프리헨션]]으로 컬럼명 가공, (2) 행 단위 [[apply|apply]]에서 [[lambda|람다]]가 `row['q1']`처럼 여러 컬럼을 읽어 **스칼라**를 돌려주면 길이가 보존된 Series가 된다, (3) [[transform|transform]]에 람다를 주면 그룹별 Series를 받아 같은 길이로 돌려주므로 그룹별 [[standardization|표준화]] 값을 바로 컬럼에 붙일 수 있다, (4) `(조건).sum()`은 참인 행 수를 세는 [[conditional-aggregation|조건 집계]]다.",
          "`std()`의 기본 `ddof=1`(표본 표준편차)을 numpy의 `np.std`(ddof=0)로 바꾸면 z값이 달라져 개수도 달라질 수 있다. 시험에서는 pandas 기본값을 따른다."
        ],
        terms: ["list-comprehension", "apply", "transform", "standardization", "conditional-aggregation"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      }
    ],

    /* ────────────────────────────────────────────────────────
       용어 — 이 파일에서 태그·링크한 용어 전부
       (다른 파일과 겹치는 id 는 정의 문장을 동일하게 맞췄다)
       ──────────────────────────────────────────────────────── */
    terms: [
      /* --- 이 장 고유 용어 --- */
      { id: "lambda", ko: "람다(익명 함수)", en: "lambda (anonymous function)",
        def: "이름 없이 한 줄로 정의하는 Python 함수 표현식. apply, map, transform 등에 즉석 함수를 넘길 때 쓴다.",
        nodes: ["b-3", "b-1"], related: ["apply", "user-defined-function"] },
      { id: "user-defined-function", ko: "사용자 정의 함수", en: "user-defined function (UDF)",
        def: "def 또는 lambda로 직접 작성해 apply·pipe·transform 등에 넘기는 함수. 무엇을 받고(행·열·그룹·전체) 무엇을 돌려주는지(스칼라·Series·DataFrame)가 결과 구조를 결정한다.",
        nodes: ["b-3"], related: ["lambda", "apply", "pipe"] },
      { id: "dictionary", ko: "딕셔너리", en: "dict / dictionary",
        def: "키-값 쌍을 담는 Python 자료형. pandas에서는 map의 매핑표, agg·rename·replace·astype의 컬럼별 명세로 쓰인다.",
        nodes: ["b-3", "b-1"], related: ["map", "aggregation", "records"] },
      { id: "list-comprehension", ko: "리스트 컴프리헨션", en: "list comprehension",
        def: "[식 for 변수 in 반복가능 if 조건] 형태로 리스트를 한 줄에 만드는 Python 문법. 컬럼명 가공이나 MultiIndex 컬럼 평탄화에 자주 쓴다.",
        nodes: ["b-3", "b-1"], related: ["flatten-columns", "zip"] },
      { id: "zip", ko: "zip(쌍 묶기)", en: "zip",
        def: "여러 반복 가능 객체를 같은 위치끼리 튜플로 묶어 순회하는 Python 내장 함수. 두 컬럼을 행 단위 쌍으로 다룰 때 쓴다.",
        nodes: ["b-3", "b-1"], related: ["unpacking", "list-comprehension"] },
      { id: "unpacking", ko: "언패킹", en: "unpacking",
        def: "튜플·리스트의 원소를 여러 변수에 한 번에 나눠 담는 문법(a, b = pair). zip 순회나 다중 컬럼 할당에서 쓴다.",
        nodes: ["b-3", "b-1"], related: ["zip", "multi-column-assignment"] },
      { id: "multi-column-assignment", ko: "다중 컬럼 할당", en: "multi-column assignment",
        def: "df[cols] = 값(cols는 컬럼명 리스트) 형태로 여러 컬럼에 한 번에 대입하는 방법. 우변이 DataFrame이면 라벨 정렬이, ndarray면 위치 대입이 일어난다.",
        nodes: ["b-3"], related: ["unpacking"] },
      { id: "axis", ko: "축", en: "axis",
        def: "연산이 진행되는 방향. axis=0은 행 방향(각 컬럼에 적용), axis=1은 열 방향(각 행에 적용)이다. apply(axis=1)이 행 단위 적용이다.",
        nodes: ["b-3", "b-2"], related: ["apply"] },
      { id: "result-type", ko: "결과 형태 지정", en: "result_type",
        def: "DataFrame.apply(axis=1)에서 리스트 반환값을 어떻게 펼칠지 정하는 인수. 'expand'면 원소마다 컬럼, 'reduce'면 Series 한 컬럼, 'broadcast'면 원본 컬럼 모양.",
        nodes: ["b-3"], related: ["apply"] },
      { id: "np-where", ko: "조건 선택(2분기)", en: "np.where",
        def: "np.where(조건, 참값, 거짓값) 형태로 조건에 따라 두 값 중 하나를 고르는 numpy 벡터화 함수. 결과는 ndarray다.",
        nodes: ["b-3"], related: ["np-select", "where-mask", "vectorization"] },
      { id: "np-select", ko: "조건 선택(다분기)", en: "np.select",
        def: "np.select(조건 리스트, 값 리스트, default) 형태로 여러 조건을 순서대로 검사해 처음 참인 조건의 값을 고르는 numpy 함수.",
        nodes: ["b-3"], related: ["np-where", "vectorization"] },
      { id: "iterrows", ko: "행 반복", en: "iterrows / itertuples",
        def: "DataFrame 행을 하나씩 순회하는 메서드. iterrows는 (인덱스, Series) 쌍을, itertuples는 namedtuple을 돌려주며 후자가 더 빠르다. 둘 다 벡터화보다 느리다.",
        nodes: ["b-3"], related: ["vectorization", "zip"] },
      { id: "string-concatenation", ko: "문자열 결합", en: "string concatenation",
        def: "문자열 Series끼리 또는 문자열 상수와 + 로 이어 붙이는 연산. 숫자 컬럼은 astype(str)로 먼저 바꿔야 한다.",
        nodes: ["b-3"], related: ["type-casting", "str-accessor"] },
      { id: "str-extract", ko: "정규식 추출", en: "str.extract",
        def: "문자열 Series에서 정규식 캡처 그룹에 해당하는 부분을 뽑아 그룹마다 컬럼 하나인 DataFrame으로 돌려주는 메서드. 매칭 실패는 NaN.",
        nodes: ["b-3"], related: ["regex", "str-accessor"] },
      { id: "flatten-columns", ko: "컬럼 평탄화", en: "flatten MultiIndex columns",
        def: "딕셔너리 agg나 피벗으로 생긴 컬럼 MultiIndex(튜플)를 '_'.join 등으로 이어 한 단계 문자열 컬럼으로 바꾸는 처리.",
        nodes: ["b-3"], related: ["multiindex", "list-comprehension"] },
      { id: "groupby-head", ko: "그룹별 상위 n행", en: "groupby.head / first / nth",
        def: "그룹마다 처음 n행(head), 첫 행(first), k번째 행(nth)을 돌려주는 groupby 메서드. 정렬 뒤에 쓰면 그룹별 상위 n개 추출이 된다.",
        nodes: ["b-3"], related: ["nlargest", "sort", "groupby"] },
      { id: "to-dict", ko: "딕셔너리 변환", en: "to_dict(orient=)",
        def: "DataFrame을 딕셔너리로 바꾸는 메서드. orient가 'dict'(기본, 컬럼→{인덱스: 값}), 'list', 'records'(행별 딕셔너리 리스트), 'index', 'split' 등으로 구조가 달라진다.",
        nodes: ["b-3"], related: ["records", "json-normalize"] },
      { id: "records", ko: "레코드(딕셔너리 리스트)", en: "records (list of dicts)",
        def: "행 하나가 {컬럼: 값} 딕셔너리인 리스트 형태의 데이터. pd.DataFrame(records)로 DataFrame을 만들고 to_dict('records')로 되돌린다.",
        nodes: ["b-3"], related: ["to-dict", "dictionary"] },
      { id: "json-normalize", ko: "JSON 평탄화", en: "json_normalize",
        def: "중첩된 딕셔너리(JSON) 리스트를 안쪽 키를 sep으로 이어 붙인 컬럼명의 평탄한 DataFrame으로 바꾸는 pandas 함수.",
        nodes: ["b-3"], related: ["records", "to-dict"] },
      { id: "conditional-aggregation", ko: "조건 집계", en: "conditional aggregation / boolean mean",
        def: "불리언 Series에 sum·mean을 적용해 조건을 만족하는 개수와 비율을 구하는 패턴. True=1, False=0으로 계산된다.",
        nodes: ["b-3"], related: ["boolean-indexing", "aggregation"] },
      { id: "standardization", ko: "표준화", en: "standardization (z-score scaling)",
        def: "값에서 평균을 빼고 표준편차로 나누어 평균 0, 표준편차 1로 맞추는 변환. 그룹별로는 groupby().transform에 람다를 넘겨 구한다.",
        nodes: ["b-3"], related: ["transform", "z-score"] },

      /* --- 다른 장과 공유하는 용어 (정의 문장 동일) --- */
      { id: "apply", ko: "함수 적용", en: "apply",
        def: "각 그룹(또는 행·열·원소)에 임의의 함수를 적용하는 범용 메서드. 반환 모양이 함수에 따라 달라지며 agg·transform보다 느리다.",
        nodes: ["b-3", "a-2-3"], related: ["lambda", "axis", "transform", "pipe"] },
      { id: "map", ko: "매핑", en: "map",
        def: "Series의 각 값을 딕셔너리·함수·Series로 대응시켜 바꾸는 메서드. 딕셔너리에 없는 값은 NaN이 된다.",
        nodes: ["b-3", "a-2-2"], related: ["replace", "apply", "dictionary"] },
      { id: "replace", ko: "값 치환", en: "replace",
        def: "지정한 값(들)을 다른 값으로 바꾸는 메서드. 딕셔너리에 없는 값은 그대로 유지된다는 점이 map과 다르다.",
        nodes: ["b-3", "a-2-2"], related: ["map"] },
      { id: "groupby", ko: "그룹화", en: "groupby / group-by",
        def: "키 컬럼 값이 같은 행끼리 묶어 각 묶음에 함수를 적용하는 연산. 분할-적용-결합 패턴의 구현.",
        nodes: ["b-3", "a-2-3"], related: ["aggregation", "transform", "split-apply-combine"] },
      { id: "split-apply-combine", ko: "분할-적용-결합", en: "split-apply-combine",
        def: "데이터를 키별로 나누고(split), 각 조각에 함수를 적용하고(apply), 결과를 하나로 합치는(combine) 그룹 연산의 일반 패턴.",
        nodes: ["b-3", "a-2-3"], related: ["groupby"] },
      { id: "aggregation", ko: "집계", en: "aggregation / agg",
        def: "여러 값을 하나의 대표값(합·평균·개수 등)으로 줄이는 연산. 그룹당 결과가 하나다.",
        nodes: ["b-3", "a-2-3"], related: ["groupby", "transform", "named-aggregation"] },
      { id: "named-aggregation", ko: "이름 붙인 집계", en: "named aggregation",
        def: "agg(새이름=(컬럼, 함수)) 형태로 결과 컬럼 이름을 직접 지정하는 집계 문법. 결과가 단일 레벨 컬럼이 된다.",
        nodes: ["b-3", "a-2-3"], related: ["aggregation", "flatten-columns"] },
      { id: "transform", ko: "변환", en: "transform",
        def: "그룹별 계산 결과를 원본과 같은 길이로 돌려주는 groupby 메서드. 그룹 통계를 각 행에 붙일 때 쓴다.",
        nodes: ["b-3", "a-2-3"], related: ["aggregation", "standardization"] },
      { id: "multiindex", ko: "다중 인덱스", en: "MultiIndex (hierarchical index)",
        def: "두 개 이상의 레벨로 이루어진 계층적 인덱스. 여러 키로 groupby하거나 pivot하면 생기며 unstack·reset_index로 평탄화한다.",
        nodes: ["b-3", "a-2-3"], related: ["flatten-columns"] },
      { id: "binning", ko: "구간화", en: "binning (cut / qcut)",
        def: "연속형 값을 구간으로 나눠 범주로 바꾸는 처리. cut은 값 경계 기준, qcut은 분위수 기준 등빈도 구간을 만든다.",
        nodes: ["b-3", "a-2-3"], related: ["value-counts"] },
      { id: "value-counts", ko: "빈도 집계", en: "value_counts",
        def: "Series의 고유값별 등장 횟수를 빈도 내림차순으로 돌려주는 메서드. normalize=True면 비율을 돌려준다.",
        nodes: ["b-3", "a-2-1"], related: ["binning", "aggregation"] },
      { id: "nlargest", ko: "상위 n개 선택", en: "nlargest / nsmallest",
        def: "지정한 컬럼 값이 가장 큰(작은) n개의 행을 돌려주는 메서드. 전체 정렬 후 head보다 효율적이다.",
        nodes: ["b-3", "a-2-6"], related: ["groupby-head"] },
      { id: "sort", ko: "정렬", en: "sort (sort_values / sort_index)",
        def: "값(sort_values) 또는 인덱스(sort_index) 기준으로 행을 정렬하는 메서드. ascending=False로 내림차순, 여러 키는 리스트로 준다.",
        nodes: ["b-3"], related: ["groupby-head"] },
      { id: "vectorization", ko: "벡터화", en: "vectorization",
        def: "파이썬 반복문 대신 배열 전체에 한 번에 적용되는 연산을 쓰는 방식. 행 단위 apply보다 훨씬 빠르다.",
        nodes: ["b-3", "a-2-6"], related: ["apply", "iterrows", "np-where"] },
      { id: "pipe", ko: "파이프", en: "pipe",
        def: "DataFrame이나 Series 전체를 첫 인자로 사용자 함수에 넘겨 호출하는 메서드. df.pipe(f, x)는 f(df, x)와 같아 메서드 체이닝을 이어 준다.",
        nodes: ["b-3", "a-2-6"], related: ["method-chaining", "apply"] },
      { id: "method-chaining", ko: "메서드 체이닝", en: "method chaining",
        def: "결과를 중간 변수에 담지 않고 메서드를 점(.)으로 연속 호출해 처리 흐름을 한 식으로 쓰는 스타일. query, assign, pipe가 대표적 도구다.",
        nodes: ["b-3", "a-2-6"], related: ["pipe"] },
      { id: "where-mask", ko: "조건 치환", en: "where / mask",
        def: "조건에 따라 값을 바꾸는 메서드 쌍. where는 조건이 거짓인 곳을, mask는 조건이 참인 곳을 other 값으로 바꾸며 길이는 유지된다.",
        nodes: ["b-3", "a-2-6"], related: ["np-where"] },
      { id: "str-accessor", ko: "str 접근자", en: ".str accessor",
        def: "문자열 Series에 contains, extract, replace, split 등 문자열 메서드를 벡터 단위로 적용하는 접근자. 정규식을 지원한다.",
        nodes: ["b-3", "a-2-6"], related: ["regex", "str-extract", "dt-accessor"] },
      { id: "regex", ko: "정규식", en: "regular expression / regex",
        def: "문자열 패턴을 기술하는 표기법. ^(시작), \\d(숫자), +(1회 이상), ( )(캡처 그룹) 등으로 검색·추출·치환 조건을 표현한다.",
        nodes: ["b-3", "a-2-6"], related: ["str-extract", "str-accessor"] },
      { id: "dt-accessor", ko: "dt 접근자", en: ".dt accessor",
        def: "datetime형 Series에서 year, month, dayofweek, day_name() 등 날짜 속성을 벡터 단위로 꺼내는 접근자. 문자열 Series에는 쓸 수 없다.",
        nodes: ["b-3", "a-2-5"], related: ["datetime", "str-accessor"] },
      { id: "datetime", ko: "날짜시간형", en: "datetime64 / Timestamp",
        def: "날짜와 시각을 나타내는 pandas 자료형. to_datetime으로 변환하고 .dt 접근자로 연·월·일·요일 등을 추출한다.",
        nodes: ["b-3", "a-2-2"], related: ["dt-accessor", "type-casting"] },
      { id: "type-casting", ko: "형 변환", en: "type casting / type conversion",
        def: "컬럼의 dtype을 다른 타입으로 바꾸는 처리. astype은 실패 시 예외를 내고, to_numeric·to_datetime은 errors='coerce'로 실패 값을 NaN/NaT로 바꿀 수 있다.",
        nodes: ["b-3", "a-2-2"], related: ["dtype", "string-concatenation"] },
      { id: "dtype", ko: "자료형", en: "dtype (data type)",
        def: "Series(컬럼)에 저장된 값의 데이터 타입. int64, float64, bool, object/str, datetime64, category 등이 있다.",
        nodes: ["b-3", "a-2-1"], related: ["type-casting"] },
      { id: "boolean-indexing", ko: "불리언 인덱싱", en: "boolean indexing / boolean mask",
        def: "조건식으로 만든 True/False Series(마스크)로 행을 선택하는 방법. 조건 결합은 &, |, ~ 와 괄호를 쓴다.",
        nodes: ["b-3", "a-2-1"], related: ["conditional-aggregation"] },
      { id: "missing-value", ko: "결측값", en: "missing value / NaN",
        def: "관측되지 않아 비어 있는 값. pandas는 NaN(float), None, NaT(datetime)로 표현하며 isna()로 찾는다.",
        nodes: ["b-3"], related: ["map"] },
      { id: "z-score", ko: "z 점수", en: "z-score / standard score",
        def: "값이 평균에서 표준편차의 몇 배만큼 떨어져 있는지를 나타내는 표준화 점수. (x - 평균) / 표준편차로 구한다.",
        nodes: ["b-3"], related: ["standardization"] }
    ]
  });
})();
