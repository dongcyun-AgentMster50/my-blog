/* ds-level2 — 파트 B 2장 "pandas 문법 익히기" (b-2) + "2-2 이해도 점검 문제" (b-2-2)
   운영자의 비법: 파트 A 2장이 기능별 정리라면 여기는 시험에서 반복되는 pandas 함정과
   "이걸 모르면 틀리는" 포인트만 꿰뚫는다.
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그·링크한 용어는 전부 이 파일에서 정의.
   모든 kind=output 문제는 pandas 3.0.6 / numpy 2.4.6 에서 실제 실행해 출력을 확인했다.
   pandas 2.x ↔ 3.x 에서 달라지는 동작(CoW, 문자열 dtype 이름, SettingWithCopyWarning 유무 등)은 정답으로 묻지 않는다. */
(function () {
  DS2.register({
    chapter: "b-2",

    /* ────────────────────────────────────────────────────────
       요약 카드 — b-2 (점검 노드 b-2-2 는 카드 없음)
       ──────────────────────────────────────────────────────── */
    cards: {
      "b-2": {
        node: "b-2",
        title: "pandas 문법 익히기",
        summary: [
          "pandas 시험 문제는 기능을 아는지가 아니라 **함정을 아는지**를 묻는다.",
          "`df['a']`는 [[series|Series]], `df[ ['a'] ]`는 [[dataframe|DataFrame]] — 괄호 하나로 반환 타입이 바뀐다.",
          "[[loc|loc]]는 끝 레이블을 **포함**하고 [[iloc|iloc]]는 끝 위치를 **제외**한다. 조건 결합은 `&`·`|`·`~`와 괄호, `and`/`or`를 쓰면 `ValueError`다.",
          "`inplace=True`는 `None`을 돌려주고, `NaN == NaN`은 `False`이며, `astype(int)`는 결측값이 있으면 실패한다.",
          "[[groupby|groupby]]·[[merge|merge]]·[[concat|concat]]은 **결과의 길이와 인덱스 구조**가 출제 포인트다."
        ],
        concepts: [
          "**Series vs DataFrame 반환**: 컬럼 하나를 문자열로 고르면 Series, 리스트로 고르면 DataFrame. `df.loc[0]`은 Series, `df.loc[ [0] ]`은 DataFrame. 이후 `.str`·`.dt`·`value_counts()`가 되는지 안 되는지가 여기서 갈린다.",
          "**loc/iloc 끝 포함**: `s.loc['b':'d']`는 b·c·d 3개, `s.iloc[1:3]`은 위치 1·2 두 개. [[loc|레이블 기반(label-based)]]은 끝 포함, [[iloc|위치 기반(integer-location)]]은 파이썬 슬라이스 규칙.",
          "**불리언 인덱싱(boolean indexing) 결합**: 조건마다 괄호, 연결은 `&`·`|`·`~`. `and`/`or`는 Series 전체의 참·거짓을 묻는 꼴이어서 `ValueError: The truth value of a Series is ambiguous`.",
          "**체인 인덱싱(chained indexing)**: `df[cond]['b'] = 0`처럼 두 번 꺾어 대입하면 원본이 안 바뀔 수 있다. 대입은 항상 `df.loc[cond, 'b'] = 0` 한 번으로.",
          "**inplace와 None**: `inplace=True`인 메서드는 `None`을 돌려준다. `df = df.dropna(inplace=True)`를 쓰면 `df`가 `None`이 된다. 재할당 방식(`df = df.dropna()`)으로 통일하라.",
          "**axis의 의미**: `axis=0`은 행 방향(아래로), `axis=1`은 열 방향(옆으로). `drop(axis=1)`은 **컬럼을** 지우고, `mean(axis=1)`은 **행마다** 컬럼들을 가로로 평균낸다. '지우는 대상'과 '계산이 진행되는 방향'이라고 외우면 헷갈리지 않는다.",
          "**결측값(missing value) 비교**: `NaN == NaN`은 `False`라서 `df['a'] == np.nan`은 전부 `False`. 반드시 `isna()`/`notna()`. `value_counts()`·`nunique()`는 기본으로 결측을 제외하지만(`dropna=True`), `unique()`는 포함한다.",
          "**집계 결과 구조**: `groupby('k')`의 결과는 키가 인덱스가 되고(`as_index=False` 또는 `reset_index()`로 컬럼화), `agg({'v': ['mean', 'max']})`처럼 리스트를 주면 컬럼이 [[multiindex|MultiIndex]]가 된다. `transform`은 원본 길이를 보존한다."
        ],
        terms: ["series", "dataframe", "loc", "iloc", "boolean-indexing", "chained-indexing", "inplace", "axis", "missing-value", "groupby", "merge", "concat"],
        patterns: [
          {
            title: "다중 조건 필터 + 대입은 loc 한 번으로",
            lang: "python",
            code: [
              "mask = (df['age'] >= 30) & (df['city'].isin(['Seoul', 'Busan'])) & ~df['score'].isna()",
              "sub = df.loc[mask, ['age', 'score']]      # 선택: 컬럼 리스트 → DataFrame",
              "df.loc[mask, 'flag'] = 1                   # 대입: 체인 인덱싱 대신 loc 한 번"
            ],
            note: "조건마다 괄호. `isin`은 `in` 연산자의 벡터 버전, `~`는 not."
          },
          {
            title: "groupby 결과를 평평한 표로",
            lang: "python",
            code: [
              "g = df.groupby('dept', as_index=False)['salary'].mean()      # 키가 컬럼으로 남는다",
              "a = df.groupby('dept')['salary'].agg(['mean', 'max']).reset_index()",
              "m = df.groupby('dept').agg({'salary': ['mean', 'max']})       # 컬럼이 MultiIndex",
              "m.columns = ['_'.join(c) for c in m.columns]               # ('salary','mean') → 'salary_mean'",
              "df['dept_mean'] = df.groupby('dept')['salary'].transform('mean')   # 원본 길이 보존"
            ]
          },
          {
            title: "merge 행 수 점검과 concat 인덱스 재부여",
            lang: "python",
            code: [
              "m = orders.merge(customers, on='cust_id', how='left')   # 왼쪽 행 보존, 짝 없으면 NaN",
              "assert len(m) == len(orders)                              # 오른쪽 키가 중복이면 행이 늘어난다",
              "all_df = pd.concat([df1, df2], ignore_index=True)        # 0부터 새 인덱스"
            ],
            note: "`how='inner'` 교집합, `'left'` 왼쪽 전부, `'outer'` 합집합. 키 중복 × 키 중복 = 행 폭증."
          },
          {
            title: "결측·형 변환·정렬 한 줄 패턴",
            lang: "python",
            code: [
              "df = df.fillna({'score': 0, 'city': 'unknown'})            # 컬럼별 다른 값으로 채움",
              "df['age'] = df['age'].fillna(0).astype(int)              # NaN 있으면 astype(int) 실패 → 먼저 채운다",
              "df['date'] = pd.to_datetime(df['date'], errors='coerce')   # 실패 값은 NaT",
              "df = df.sort_values(['dept', 'salary'], ascending=[True, False])"
            ]
          },
          {
            title: "값 하나를 꺼내는 메서드들",
            lang: "python",
            code: [
              "s.idxmax()                 # 최댓값의 인덱스 레이블 (동률이면 첫 번째)",
              "df.nlargest(3, 'salary')   # 상위 3행",
              "s.value_counts(normalize=True)   # 비율, 결측 제외(dropna=True)",
              "s.rank(method='min')       # 동점은 같은 최소 순위, 다음 순위는 건너뜀",
              "s.quantile(0.75)           # 75% 분위수 = describe() 의 75% 행"
            ]
          }
        ],
        pitfalls: [
          "`df[df['a'] > 0 and df['b'] > 0]` → `ValueError`. `and` 대신 `&`, 조건마다 괄호.",
          "`df.loc['a':'c']`는 c를 **포함**, `df.iloc[0:3]`은 위치 3을 **제외**. 둘의 길이가 같은지 묻는 문제에 속지 마라.",
          "`df.drop('col', axis=1, inplace=True)`의 반환값은 `None`. 이를 변수에 받으면 데이터가 사라진다.",
          "`pd.concat([a, b])`는 인덱스를 그대로 이어 붙여 `0,1,0,1`처럼 중복된다. `ignore_index=True`가 아니면 `loc[0]`이 두 행을 돌려준다.",
          "`df.pivot(...)`은 (index, columns) 조합이 중복이면 `ValueError`. 중복이 있으면 `pivot_table`(기본 `aggfunc='mean'`)."
        ]
      }
    },

    /* ────────────────────────────────────────────────────────
       필기 문제
       ──────────────────────────────────────────────────────── */
    questions: [
      /* ===== b-2 (12) : mcq 7 / ox 2 / short 3, 난이도 4:6:2 ===== */
      {
        id: "b-2-q01", node: "b-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`df`가 DataFrame일 때 `df['a']`와 `df[ ['a'] ]`의 반환 타입으로 옳은 것은?",
        choices: [
          "둘 다 Series",
          "`df['a']`는 Series, `df[ ['a'] ]`는 DataFrame",
          "`df['a']`는 DataFrame, `df[ ['a'] ]`는 Series",
          "둘 다 DataFrame"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** 컬럼 이름을 **문자열 하나**로 넘기면 1차원 [[series|시리즈(Series)]]가, **리스트**로 넘기면 컬럼이 하나여도 2차원 [[dataframe|데이터프레임(DataFrame)]]이 돌아온다. 대괄호가 두 겹인지가 기준이다.",
          "",
          "- ① `df[ ['a'] ]`는 리스트 선택이므로 DataFrame이다.",
          "- ③ 반대로 적었다. 문자열 → Series, 리스트 → DataFrame.",
          "- ④ `df['a']`는 Series라 `.str`·`.value_counts()` 같은 Series 메서드가 바로 된다.",
          "",
          "시험에서는 \"다음 중 DataFrame을 반환하는 것은?\" 형태로 `df['a']`, `df[ ['a'] ]`, `df.loc[0]`, `df.loc[ [0] ]`을 섞어 낸다. 리스트로 고르면 항상 DataFrame이다."
        ],
        terms: ["series", "dataframe"],
        tags: ["selection"]
      },
      {
        id: "b-2-q02", node: "b-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([10, 20, 30, 40, 50], index=list('abcde'))",
          "print(s.loc['b':'d'].tolist(), s.iloc[1:3].tolist())"
        ],
        lang: "python",
        choices: [
          "[20, 30] [20, 30]",
          "[20, 30, 40] [20, 30, 40]",
          "[20, 30, 40] [20, 30]",
          "[20, 30] [20, 30, 40]"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[loc|레이블 기반 선택(loc)]]의 슬라이스는 **끝 레이블을 포함**하므로 `'b':'d'` → b, c, d 세 개 `[20, 30, 40]`. [[iloc|위치 기반 선택(iloc)]]은 파이썬 슬라이스처럼 **끝 위치를 제외**하므로 `1:3` → 위치 1, 2 두 개 `[20, 30]`.",
          "",
          "- ① loc가 끝을 제외한다고 본 오답. loc는 레이블이라 '어디까지'가 명확해서 포함한다.",
          "- ② iloc가 끝을 포함한다고 본 오답. iloc는 정수 위치라 파이썬 규칙을 따른다.",
          "- ④ 둘을 서로 바꿔 적은 오답.",
          "",
          "시험에서는 같은 구간을 loc와 iloc로 잘라 **길이가 다른 이유**를 묻거나, `df.loc[0:2]`가 3행인지 2행인지를 묻는다(정수 인덱스라도 loc면 3행)."
        ],
        terms: ["loc", "iloc"],
        tags: ["selection"]
      },
      {
        id: "b-2-q03", node: "b-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 실행 시 오류가 난다. 원인과 올바른 수정으로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'age': [25, 35, 45], 'city': ['S', 'B', 'S']})",
          "print(df[df['age'] > 30 and df['city'] == 'S'])"
        ],
        lang: "python",
        choices: [
          "`and`는 Series 전체의 참·거짓을 묻는 꼴이어서 `ValueError`. `df[(df['age'] > 30) & (df['city'] == 'S')]`로 고친다",
          "비교 연산자 `>`는 Series에 쓸 수 없어 `TypeError`. `df['age'].gt(30)`으로 고친다",
          "`'S'`가 문자열이라 `KeyError`. `df['city'] == 'S'`를 `df['city'].str == 'S'`로 고친다",
          "조건이 두 개라 `IndexError`. `df.query('age > 30 and city == \"S\"')`로만 해결 가능하다"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 파이썬의 `and`는 양쪽 피연산자를 **하나의 bool**로 평가하려 하는데 Series는 참·거짓이 애매하므로 `ValueError: The truth value of a Series is ambiguous`가 난다. [[boolean-indexing|불리언 인덱싱(boolean indexing)]]의 조건 결합은 원소별 연산자 `&`(and), `|`(or), `~`(not)를 쓰고, 비교보다 우선순위가 높으니 **조건마다 괄호**를 친다.",
          "",
          "- ② `>`는 Series에 벡터 비교로 잘 동작한다. `.gt()`는 같은 뜻의 메서드일 뿐 원인이 아니다.",
          "- ③ 문자열 비교 `== 'S'`는 정상이고 `.str == 'S'`는 성립하지 않는 문법이다.",
          "- ④ 조건 개수는 오류 원인이 아니다. `query`도 한 방법이지만 \"로만 해결 가능\"은 틀렸다.",
          "",
          "시험에서는 `and`/`or`가 들어간 필터 코드를 보여 주고 \"오류 원인은?\" 또는 \"올바르게 고친 것은?\"으로 거의 매회 나온다. 괄호 빠진 `df['a'] > 0 & df['b'] > 0`도 같은 함정이다."
        ],
        terms: ["boolean-indexing"],
        tags: ["filter"]
      },
      {
        id: "b-2-q04", node: "b-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "다음 코드를 실행한 뒤 `df`의 상태로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, None, 3]})",
          "df = df.dropna(inplace=True)"
        ],
        lang: "python",
        choices: [
          "결측 행이 제거된 DataFrame (2행)",
          "원본 그대로인 DataFrame (3행)",
          "빈 DataFrame (0행)",
          "`None`"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[inplace|inplace]]`=True`인 메서드는 객체를 **제자리에서 수정하고 `None`을 반환**한다. 그 반환값을 다시 `df`에 대입했으니 `df`는 `None`이 되고, 이후 `df.head()`는 `AttributeError`가 난다.",
          "",
          "- ① 제자리 수정은 일어났지만 그 결과가 담긴 원래 객체는 더 이상 `df`라는 이름으로 참조되지 않는다.",
          "- ② 원본 객체는 실제로 수정됐다. 바뀌지 않았다는 설명은 틀렸다.",
          "- ③ 결측(missing value) 행 하나만 빠지므로 설령 결과를 받았어도 0행이 아니다.",
          "",
          "시험에서는 `df = df.sort_values('a', inplace=True)` 같은 코드 뒤에 `df.shape`를 묻거나 `print(df)`의 출력을 묻는 형태로 나온다. **`inplace=True`와 재할당은 절대 같이 쓰지 않는다**."
        ],
        terms: ["inplace", "missing-value"],
        tags: ["inplace"]
      },
      {
        id: "b-2-q05", node: "b-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'x': [1, 2], 'y': [3, 4]})",
          "print(df.drop('x', axis=1).shape, df.sum(axis=0).tolist(), df.mean(axis=1).tolist())"
        ],
        lang: "python",
        choices: [
          "(2, 1) [3, 7] [2.0, 3.0]",
          "(1, 2) [3, 7] [2.0, 3.0]",
          "(2, 1) [4, 6] [2.0, 3.0]",
          "(2, 1) [3, 7] [1.5, 3.5]"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[axis|축(axis)]]의 뜻은 메서드마다 '대상'과 '방향'으로 갈린다. `drop('x', axis=1)`은 **컬럼** x를 지워 `(2, 1)`. `sum(axis=0)`은 행 방향(아래로) 더해 **컬럼별 합** `[1+2, 3+4] = [3, 7]`. `mean(axis=1)`은 열 방향(옆으로) 평균이라 **행별 평균** `[(1+3)/2, (2+4)/2] = [2.0, 3.0]`.",
          "",
          "- ② `drop(axis=1)`이 행을 지웠다고 본 오답. axis=1은 컬럼이다.",
          "- ③ `sum(axis=0)`을 행별 합 `[4, 6]`으로 본 오답. axis=0은 컬럼별 결과다.",
          "- ④ `mean(axis=1)` 값을 잘못 계산했다. 1행 평균은 2.0, 2행 평균은 3.0.",
          "",
          "시험에서는 `axis=0`/`axis=1`을 drop과 mean에 섞어 놓고 shape 또는 값을 묻는다. **drop·dropna는 '무엇을 지울지'(1=컬럼), 집계 함수는 '어느 방향으로 계산할지'(1=행마다)** 로 기억하라."
        ],
        terms: ["axis", "aggregation"],
        tags: ["axis"]
      },
      {
        id: "b-2-q06", node: "b-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np, pandas as pd",
          "df = pd.DataFrame({'a': [1.0, np.nan, 3.0, np.nan]})",
          "print((df['a'] == np.nan).sum(), df['a'].isna().sum())"
        ],
        lang: "python",
        choices: ["2 2", "2 0", "0 2", "0 0"],
        answer: 2,
        explanation: [
          "**정답: ③** IEEE 부동소수 규칙상 `NaN == NaN`은 **항상 `False`**다. 그래서 `df['a'] == np.nan`은 네 개 모두 `False`가 되어 합이 `0`. [[missing-value|결측값(missing value)]]은 `isna()`/`isnull()`로 세야 하며 결측이 두 개라 `2`.",
          "",
          "- ① `==` 비교로 결측을 찾을 수 있다고 본 오답. `np.nan == np.nan` 자체가 False다.",
          "- ② 두 값을 서로 바꿔 쓴 오답.",
          "- ④ `isna()`는 결측을 정확히 세므로 0이 아니다.",
          "",
          "시험에서는 `df[df['a'] == np.nan]`의 행 수(항상 0), `None`과 `np.nan`을 `isna()`가 모두 잡는지(잡는다), `fillna` 전에 `isna().sum()`을 묻는 형태로 나온다."
        ],
        terms: ["missing-value"],
        tags: ["nan"]
      },
      {
        id: "b-2-q07", node: "b-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`df.groupby('k').agg({'v': ['mean', 'max']})`의 결과 구조에 대한 설명으로 옳은 것은?",
        choices: [
          "행 인덱스는 0부터의 정수이고 컬럼은 `['k', 'mean', 'max']`다",
          "행 인덱스는 `k`이고 컬럼은 `['mean', 'max']` 단일 레벨이다",
          "결과는 그룹 수와 무관하게 원본과 같은 길이의 DataFrame이다",
          "행 인덱스는 `k`이고 컬럼은 `('v', 'mean')`, `('v', 'max')`의 MultiIndex다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[groupby|그룹화(groupby)]] 결과는 기본(`as_index=True`)으로 **그룹 키가 행 인덱스**가 된다. 그리고 `agg`에 `{컬럼: [함수 리스트]}` 딕셔너리를 주면 컬럼이 (원컬럼, 함수명) 두 레벨의 [[multiindex|다중 인덱스(MultiIndex)]]가 된다. 평탄화는 `r.columns = ['_'.join(c) for c in r.columns]`.",
          "",
          "- ① 키가 컬럼으로 남는 것은 `as_index=False`를 줬거나 `reset_index()`를 한 뒤다. 또 `agg` 딕셔너리-리스트 결과의 컬럼은 단일 레벨이 아니다.",
          "- ② 단일 레벨 `['mean', 'max']`가 되는 것은 `df.groupby('k')['v'].agg(['mean', 'max'])`처럼 **컬럼을 먼저 고른 뒤** 리스트를 준 경우다.",
          "- ③ 원본 길이를 보존하는 것은 [[transform|변환(transform)]]이다. `agg`는 [[aggregation|집계(aggregation)]]라 그룹 수만큼 줄어든다.",
          "",
          "시험에서는 groupby 결과를 `.reset_index()` 했을 때 컬럼 목록, `as_index=False`의 효과, `agg` 리스트 결과에서 `r['v']['mean']`이 되는 이유(MultiIndex)를 묻는다."
        ],
        terms: ["groupby", "aggregation", "multiindex", "transform"],
        tags: ["groupby"]
      },
      {
        id: "b-2-q08", node: "b-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`s.value_counts()`는 기본 설정에서 결측값(NaN)을 세지 않는다.",
        answer: true,
        explanation: [
          "**정답: O** [[value-counts|빈도 집계(value_counts)]]의 기본 인자는 `dropna=True`라 [[missing-value|결측값(missing value)]]을 **제외**하고 고유값별 빈도를 내림차순으로 돌려준다. 결측도 한 범주로 세고 싶으면 `value_counts(dropna=False)`.",
          "",
          "같은 계열로 `nunique()`도 기본 `dropna=True`지만, `unique()`는 결측을 **포함**한 배열을 돌려준다는 점이 함정이다.",
          "",
          "시험에서는 결측이 섞인 Series의 `value_counts()` 출력 행 수, `value_counts(normalize=True)` 비율의 분모에 결측이 들어가는지(들어가지 않는다)를 묻는다."
        ],
        terms: ["value-counts", "missing-value"],
        tags: ["value_counts"]
      },
      {
        id: "b-2-q09", node: "b-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`pd.concat([df1, df2])`는 기본 설정에서 결과 인덱스를 0부터 다시 매긴다.",
        answer: false,
        explanation: [
          "**정답: X** [[concat|결합(concat)]]의 기본값은 `ignore_index=False`라 **각 조각의 인덱스를 그대로 이어 붙인다**. `df1`·`df2`가 모두 0부터 시작하면 결과 인덱스는 `0, 1, …, 0, 1, …`로 **중복**되고, `result.loc[0]`은 여러 행을 돌려준다. 0부터 다시 매기려면 `ignore_index=True`, 중복 여부 확인은 `result.index.is_unique`.",
          "",
          "반면 [[merge|병합(merge)]]은 결과 인덱스를 항상 0부터 새로 만들므로 둘을 대비해서 기억하면 좋다.",
          "",
          "시험에서는 `pd.concat([a, b]).index.tolist()` 출력이나 \"concat 뒤 `loc[0]`이 2행인 이유\"로 나온다."
        ],
        terms: ["concat", "merge"],
        tags: ["concat"]
      },
      {
        id: "b-2-q10", node: "b-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 메서드 이름을 쓰시오. 컬럼 값이 목록 중 하나인 행만 고른다: `df[df['city'].____(['Seoul', 'Busan'])]`",
        answer: "isin",
        accept: ["isin()", ".isin"],
        explanation: [
          "**정답: isin** [[isin|멤버십 필터(isin)]]은 각 원소가 주어진 목록에 **속하는지**를 불리언 Series로 돌려준다. 파이썬 `in` 연산자의 벡터 버전이며 결과를 [[boolean-indexing|불리언 인덱싱(boolean indexing)]]에 바로 쓴다.",
          "",
          "`df['city'] in ['Seoul', 'Busan']`은 Series의 참·거짓이 애매해 오류이고, `(df['city'] == 'Seoul') | (df['city'] == 'Busan')`은 맞지만 목록이 길어지면 `isin`이 정답이다. 반대(목록에 없는 행)는 `~df['city'].isin([...])`.",
          "",
          "시험에서는 \"여러 값 중 하나에 해당하는 행을 고르는 메서드\"로 빈칸 문제, 또는 `in` 연산자를 쓴 오류 코드 고치기로 나온다."
        ],
        terms: ["isin", "boolean-indexing"],
        tags: ["filter"]
      },
      {
        id: "b-2-q11", node: "b-2", type: "short", kind: "concept", difficulty: 2,
        prompt: "`df.groupby('dept')['salary'].mean()`의 결과에서 그룹 키 `dept`를 행 인덱스가 아닌 **컬럼**으로 남기려 한다. `groupby()`에 `False`로 넘겨야 하는 키워드 인자의 이름을 쓰시오.",
        answer: "as_index",
        accept: ["as_index=False"],
        explanation: [
          "**정답: as_index** [[groupby|그룹화(groupby)]]는 기본 `as_index=True`라 그룹 키가 결과의 **행 인덱스**가 된다. `groupby('dept', as_index=False)`를 주면 키가 보통 컬럼으로 남아 SQL의 `GROUP BY` 결과와 같은 평평한 표가 된다. 같은 효과를 뒤에서 내는 방법이 `.reset_index()`다.",
          "",
          "`sort=False`는 그룹 순서를 정렬하지 않는 옵션, `dropna=False`는 키가 결측인 그룹도 포함하는 옵션으로 역할이 다르다.",
          "",
          "시험에서는 groupby 결과를 `merge`의 입력으로 쓰거나 `plot`에 넘기기 전 \"키를 컬럼으로 돌리는 두 가지 방법\"(`as_index=False`, `reset_index()`)으로 나온다."
        ],
        terms: ["groupby", "index"],
        tags: ["groupby"]
      },
      {
        id: "b-2-q12", node: "b-2", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드가 출력하는 숫자를 쓰시오.",
        code: [
          "import pandas as pd",
          "left = pd.DataFrame({'k': [1, 1, 2], 'x': [1, 2, 3]})",
          "right = pd.DataFrame({'k': [1, 1, 3], 'y': [4, 5, 6]})",
          "print(len(pd.merge(left, right, on='k')))"
        ],
        lang: "python",
        answer: "4",
        explanation: [
          "**정답: 4** [[merge|병합(merge)]]의 기본은 [[inner-join|내부 조인(inner join)]]이라 양쪽에 모두 있는 키 `1`만 남는다. 그런데 키 `1`이 왼쪽에 2행, 오른쪽에 2행 있으므로 **모든 짝이 조합되어 2 × 2 = 4행**이 된다. 키 `2`는 오른쪽에, 키 `3`은 왼쪽에 없어 제외.",
          "",
          "이것이 \"merge 후 행이 늘어났다\"의 정체다. 다대다(many-to-many) 키는 곱으로 폭증하므로 `validate='one_to_many'` 또는 `len()` 비교로 점검한다. `how='left'`였다면 키 2 행이 추가되어 5행, `how='outer'`면 키 3까지 6행.",
          "",
          "시험에서는 작은 두 표를 주고 `how`별 결과 행 수, 또는 \"왼쪽은 3행인데 left merge 결과가 5행인 이유\"를 묻는다."
        ],
        terms: ["merge", "inner-join", "left-join"],
        tags: ["merge"]
      },

      /* ===== b-2-2 점검 (20) : mcq 12 / ox 3 / short 5, 난이도 6:10:4, output ≥ 6 ===== */
      {
        id: "b-2-2-q01", node: "b-2-2", type: "mcq", kind: "bug", difficulty: 1,
        prompt: "`score`가 60 미만인 행의 `grade`를 `'F'`로 바꾸려 한다. 원본 `df`가 확실히 수정되는 코드는?",
        choices: [
          "`df[df['score'] < 60]['grade'] = 'F'`",
          "`df['grade'][df['score'] < 60] = 'F'`",
          "`df.loc[df['score'] < 60, 'grade'] = 'F'`",
          "`sub = df[df['score'] < 60]; sub['grade'] = 'F'`"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** 행 조건과 컬럼을 **`loc` 한 번에** 지정해 대입하면 pandas가 원본의 해당 위치를 직접 수정한다. 이것이 [[chained-indexing|체인 인덱싱(chained indexing)]]을 피하는 유일하게 안전한 쓰기 방식이다.",
          "",
          "- ① `df[cond]`가 먼저 새 객체(복사본)를 만들고 그 위에 대입하므로 원본이 바뀌지 않을 수 있다. 전형적인 체인 인덱싱.",
          "- ② 순서만 바뀐 체인 인덱싱이다. 중간 객체가 [[view-copy|뷰인지 복사본인지]]에 따라 결과가 달라져 신뢰할 수 없다.",
          "- ④ `sub`는 별도 객체라 `sub`만 바뀌고 `df`는 그대로다(`sub = df[...].copy()` 뒤 작업하는 것은 의도가 '부분집합을 따로 다루기'일 때만 옳다).",
          "",
          "시험에서는 네 코드 중 \"원본이 바뀌는 것\" 또는 \"경고(warning)가 날 수 있는 것\"을 고르게 한다. pandas 버전과 무관하게 **`df.loc[행조건, 컬럼] = 값`** 만 정답이다."
        ],
        terms: ["chained-indexing", "view-copy", "loc"],
        tags: ["assignment"]
      },
      {
        id: "b-2-2-q02", node: "b-2-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['a', 'a', 'b', 'a'])",
          "print(s.value_counts(normalize=True)['a'])"
        ],
        lang: "python",
        choices: ["0.75", "3", "0.25", "75.0"],
        answer: 0,
        explanation: [
          "**정답: ①** [[value-counts|빈도 집계(value_counts)]]에 `normalize=True`를 주면 빈도 대신 **전체 대비 비율**을 돌려준다. 'a'는 4개 중 3개라 `3/4 = 0.75`.",
          "",
          "- ② `3`은 `normalize=False`(기본)일 때의 개수다.",
          "- ③ `0.25`는 'b'의 비율이다.",
          "- ④ 백분율(%)로 바꿔 주지 않는다. 100을 곱하는 것은 사용자 몫이다.",
          "",
          "시험에서는 `normalize=True`의 결과 합이 1인지, 결측이 있을 때 분모에 포함되는지(`dropna=True`라 제외), 가장 많은 범주 비율을 묻는다."
        ],
        terms: ["value-counts"],
        tags: ["value_counts"]
      },
      {
        id: "b-2-2-q03", node: "b-2-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s1 = pd.Series([1, 2])",
          "s2 = pd.Series([3, 4])",
          "print(pd.concat([s1, s2]).index.tolist())"
        ],
        lang: "python",
        choices: ["[0, 1, 2, 3]", "[0, 1, 0, 1]", "[1, 2, 3, 4]", "ValueError"],
        answer: 1,
        explanation: [
          "**정답: ②** [[concat|결합(concat)]]은 기본 `ignore_index=False`라 각 조각의 [[index|인덱스(index)]]를 **그대로 이어 붙인다**. `s1`과 `s2`가 모두 `0, 1`이므로 결과는 `[0, 1, 0, 1]`로 중복된다.",
          "",
          "- ① `[0, 1, 2, 3]`은 `ignore_index=True`를 줬을 때다.",
          "- ③ 인덱스가 아니라 값(`values`)의 목록이다.",
          "- ④ 인덱스 중복은 concat에서 오류가 아니다. 오류를 내고 싶으면 `verify_integrity=True`.",
          "",
          "시험에서는 concat 뒤 `.loc[0]`이 두 행인 이유, `ignore_index=True`와 `reset_index(drop=True)`가 같은 효과라는 점으로 나온다."
        ],
        terms: ["concat", "index"],
        tags: ["concat"]
      },
      {
        id: "b-2-2-q04", node: "b-2-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "2024년 1월 1일은 월요일이다. 다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "d = pd.to_datetime(pd.Series(['2024-01-01', '2024-01-07']))",
          "print(d.dt.dayofweek.tolist())"
        ],
        lang: "python",
        choices: ["[0, 6]", "[1, 7]", "[1, 0]", "[7, 6]"],
        answer: 0,
        explanation: [
          "**정답: ①** [[dt-accessor|dt 접근자(.dt)]]의 `dayofweek`(= `weekday`)는 **월요일 = 0, 일요일 = 6**이다. 1월 1일 월요일 → 0, 1월 7일 일요일 → 6. 요일 이름이 필요하면 `dt.day_name()`.",
          "",
          "- ② 월요일을 1로 세는 체계는 ISO의 `isocalendar().day`(월=1 … 일=7)다. `dayofweek`가 아니다.",
          "- ③ 일요일을 0으로 두는 체계(일부 언어의 관례)와 혼동한 오답.",
          "- ④ `dayofweek`의 범위는 0~6이므로 7은 나오지 않는다.",
          "",
          "시험에서는 \"주말 행만 고르기\"를 `dt.dayofweek >= 5`로 쓰는지, `dt.month`·`dt.year`와 함께 [[datetime|날짜시간형(datetime)]]으로 먼저 변환했는지(문자열에는 `.dt`가 없다)를 묻는다."
        ],
        terms: ["dt-accessor", "datetime"],
        tags: ["datetime"]
      },
      {
        id: "b-2-2-q05", node: "b-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "l = pd.DataFrame({'k': [1, 2, 3], 'x': [10, 20, 30]})",
          "r = pd.DataFrame({'k': [2, 3, 4], 'y': [200, 300, 400]})",
          "print(len(pd.merge(l, r, on='k', how='inner')), len(pd.merge(l, r, on='k', how='left')),",
          "      len(pd.merge(l, r, on='k', how='outer')))"
        ],
        lang: "python",
        choices: ["3 3 3", "2 3 3", "2 2 4", "2 3 4"],
        answer: 3,
        explanation: [
          "**정답: ④** 키 집합은 왼쪽 `{1,2,3}`, 오른쪽 `{2,3,4}`. [[inner-join|내부 조인(inner)]]은 교집합 `{2,3}` → 2행, [[left-join|왼쪽 조인(left)]]은 왼쪽 키 전부 `{1,2,3}` → 3행(키 1의 `y`는 NaN), [[outer-join|외부 조인(outer)]]은 합집합 `{1,2,3,4}` → 4행.",
          "",
          "- ① inner가 3행이 되려면 세 키가 모두 양쪽에 있어야 한다.",
          "- ② outer는 어느 한쪽에만 있는 키 1과 4도 남기므로 3이 아니다.",
          "- ③ left는 왼쪽 행을 모두 보존하므로 2가 아니다.",
          "",
          "시험에서는 `how`별 행 수 비교, left merge 뒤 `isna().sum()`으로 \"짝이 없는 행 수\" 구하기, `indicator=True`의 `_merge` 컬럼 값(`left_only`, `both`)으로 나온다."
        ],
        terms: ["merge", "inner-join", "left-join", "outer-join"],
        tags: ["merge"]
      },
      {
        id: "b-2-2-q06", node: "b-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([3, 5, 9])",
          "print(s.diff().tolist())"
        ],
        lang: "python",
        choices: ["[2.0, 4.0]", "[nan, 2.0, 4.0]", "[nan, 3.0, 5.0]", "[3.0, 2.0, 4.0]"],
        answer: 1,
        explanation: [
          "**정답: ②** `diff()`는 각 값에서 **직전 값**을 뺀다(`s - s.shift(1)`). 첫 원소는 직전 값이 없어 `NaN`, 이어서 `5-3=2.0`, `9-5=4.0`. [[shift|시프트(shift)]] 계열 연산은 길이를 유지하고 비는 자리를 결측으로 채우므로 결과가 float가 된다.",
          "",
          "- ① 길이가 줄지 않는다. 첫 자리는 NaN으로 남는다.",
          "- ③ `[nan, 3.0, 5.0]`은 `s.shift(1)`의 결과다. 뺄셈을 하지 않았다.",
          "- ④ 첫 값을 원본 그대로 두지 않는다. 첫 번째는 항상 NaN이다.",
          "",
          "시험에서는 `diff()`·`shift(1)`·[[pct-change|변화율(pct_change)]]의 결과를 나열하고 짝을 맞추거나, 결과의 `isna().sum()`(=1), `pct_change()`의 두 번째 값(`(5-3)/3 = 0.667`)을 묻는다."
        ],
        terms: ["shift", "pct-change"],
        tags: ["timeseries"]
      },
      {
        id: "b-2-2-q07", node: "b-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['a', None, 'b', 'a'])",
          "print(s.nunique(), len(s.unique()))"
        ],
        lang: "python",
        choices: ["2 2", "3 3", "2 3", "3 2"],
        answer: 2,
        explanation: [
          "**정답: ③** `nunique()`는 기본 `dropna=True`라 [[missing-value|결측값(missing value)]]을 **빼고** 고유값을 센다 → `'a','b'` 2개. 반면 `unique()`는 결측을 **포함**한 고유값 배열을 돌려준다 → `['a', nan, 'b']` 길이 3.",
          "",
          "- ① `unique()`가 결측을 버린다고 본 오답.",
          "- ② `nunique()`가 결측을 센다고 본 오답. `nunique(dropna=False)`를 줘야 3이다.",
          "- ④ 두 값을 뒤바꾼 오답.",
          "",
          "시험에서는 결측이 섞인 범주 컬럼의 `nunique()`와 `len(unique())`가 1 차이 나는 이유, 또는 `value_counts()` 행 수(=nunique)를 묻는다. 결측 처리 기본값은 `value_counts`·`nunique`는 제외, `unique`는 포함으로 외운다."
        ],
        terms: ["missing-value", "value-counts"],
        tags: ["unique"]
      },
      {
        id: "b-2-2-q08", node: "b-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([3, 9, 9, 1], index=list('abcd'))",
          "print(s.idxmax())"
        ],
        lang: "python",
        choices: ["b", "c", "9", "1"],
        answer: 0,
        explanation: [
          "**정답: ①** [[idxmax|최댓값 라벨(idxmax)]]은 최댓값이 있는 **인덱스 레이블**을 돌려준다. 최댓값 9는 `b`와 `c` 두 곳에 있지만 동률이면 **처음 등장한** 레이블 `b`를 택한다.",
          "",
          "- ② 동률일 때 마지막이 아니라 첫 번째를 택한다.",
          "- ③ `9`는 값 자체이며 `s.max()`의 결과다.",
          "- ④ `1`은 최댓값의 정수 **위치**로 `s.argmax()`의 결과다. 레이블과 위치를 구분하라.",
          "",
          "시험에서는 \"가장 많이 팔린 상품명\"처럼 `value_counts().idxmax()` 또는 `groupby().sum().idxmax()` 형태로 레이블을 묻고, 값이 필요하면 `max()`, 상위 n개면 [[nlargest|nlargest]]로 구분하게 한다."
        ],
        terms: ["idxmax", "nlargest"],
        tags: ["idxmax"]
      },
      {
        id: "b-2-2-q09", node: "b-2-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`df`에 `(r, c)` 조합이 같은 행이 여러 개 있다. `df.pivot(index='r', columns='c', values='v')`와 `df.pivot_table(index='r', columns='c', values='v')`의 동작으로 옳은 것은?",
        choices: [
          "둘 다 중복 조합을 마지막 값으로 덮어써 같은 결과를 낸다",
          "`pivot`은 중복을 합계로 집계하고, `pivot_table`은 `ValueError`를 낸다",
          "둘 다 `ValueError`를 내므로 먼저 `drop_duplicates()`가 필수다",
          "`pivot`은 `ValueError`를 내고, `pivot_table`은 기본 `aggfunc='mean'`으로 집계한다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[pivot|피벗(pivot)]]은 **집계 없는 순수 재구조화**라 (index, columns) 조합이 중복이면 어느 값을 둘지 정할 수 없어 `ValueError: Index contains duplicate entries, cannot reshape`를 낸다. [[pivot-table|피벗 테이블(pivot_table)]]은 집계 함수를 거치므로 중복을 허용하고, `aggfunc` 기본값은 **`'mean'`**이다.",
          "",
          "- ① `pivot`은 덮어쓰지 않고 오류를 낸다.",
          "- ② 둘의 역할을 바꿔 적었다. 집계를 하는 쪽은 `pivot_table`이고 기본은 합계가 아니라 평균이다.",
          "- ③ `pivot_table`은 오류 없이 동작하므로 `drop_duplicates()`가 필수는 아니다.",
          "",
          "시험에서는 \"pivot에서 ValueError가 난 이유\", `pivot_table`의 기본 `aggfunc`, 합계가 필요할 때 `aggfunc='sum'`과 `fill_value=0`을 함께 쓰는 코드로 나온다."
        ],
        terms: ["pivot", "pivot-table", "aggregation"],
        tags: ["pivot"]
      },
      {
        id: "b-2-2-q10", node: "b-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, -2, 3])",
          "print(s.where(s > 0, 0).tolist(), s.mask(s > 0, 0).tolist())"
        ],
        lang: "python",
        choices: [
          "[0, -2, 0] [1, 0, 3]",
          "[1, 0, 3] [0, -2, 0]",
          "[1, 3] [-2]",
          "[1, 0, 3] [1, 0, 3]"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[where-mask|조건 치환(where / mask)]]은 서로 반대다. `where(cond, other)`는 조건이 **참인 곳은 유지**하고 거짓인 곳을 `other`로 바꾼다 → `[1, 0, 3]`. `mask(cond, other)`는 조건이 **참인 곳을 바꾼다** → `[0, -2, 0]`. 둘 다 길이를 유지한다.",
          "",
          "- ① where와 mask의 결과를 서로 바꿔 적은 오답.",
          "- ③ 길이가 줄어드는 것은 불리언 인덱싱 `s[s > 0]`이다. where/mask는 길이를 유지한다.",
          "- ④ mask는 where와 반대 방향이라 같은 결과가 나올 수 없다.",
          "",
          "시험에서는 `np.where(cond, a, b)`(numpy, 세 인자, 참이면 a)와 `Series.where(cond, b)`(참이면 유지)를 섞어 묻는다. \"where는 지키고 mask는 가린다\"로 외운다."
        ],
        terms: ["where-mask", "boolean-indexing"],
        tags: ["where"]
      },
      {
        id: "b-2-2-q11", node: "b-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([5, 10, 15, 20, 25])",
          "print(s.between(10, 20).sum())"
        ],
        lang: "python",
        choices: ["1", "2", "3", "4"],
        answer: 2,
        explanation: [
          "**정답: ③** `between(left, right)`는 기본 `inclusive='both'`라 **양 끝을 포함**한 구간 `10 ≤ x ≤ 20`을 검사한다. 10, 15, 20 세 개가 `True`이고 불리언 Series의 `sum()`은 `True`의 개수이므로 3. [[boolean-indexing|불리언 인덱싱(boolean indexing)]]의 `(s >= 10) & (s <= 20)`과 같다.",
          "",
          "- ① 양 끝을 모두 빼면 15 하나만 남는다. 그것은 `inclusive='neither'`다.",
          "- ② 한쪽 끝만 포함하는 경우(`'left'` 또는 `'right'`)다. 기본값이 아니다.",
          "- ④ 5나 25는 구간 밖이다.",
          "",
          "시험에서는 \"between의 기본값이 끝을 포함하는가\"(포함), 날짜 범위 필터 `df['date'].between('2024-01-01', '2024-01-31')`, 그리고 불리언 Series의 `sum()`이 True 개수라는 점으로 나온다."
        ],
        terms: ["boolean-indexing"],
        tags: ["filter"]
      },
      {
        id: "b-2-2-q12", node: "b-2-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`groupby` 뒤에 붙는 `agg`, `transform`, `apply`에 대한 설명으로 옳지 **않은**것은?",
        choices: [
          "`agg('mean')`은 그룹당 값 하나를 돌려주므로 결과 길이는 그룹 수와 같다",
          "`transform('mean')`은 그룹 평균을 각 행에 되돌려 결과 길이가 원본과 같아 새 컬럼으로 바로 대입할 수 있다",
          "`apply(func)`는 함수가 스칼라·Series·DataFrame 중 무엇을 돌려주느냐에 따라 결과 모양이 달라진다",
          "`df.apply(func, axis=1)`은 각 **컬럼**을 Series로 받아 함수를 적용하므로 행 단위 계산보다 빠르다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** `df.apply(func, axis=1)`은 **각 행**을 Series로 받아 함수를 적용한다(axis=1 → 열 방향으로 한 행을 훑는다). 파이썬 함수를 행마다 호출하므로 벡터화된 컬럼 연산(`df['x'] + df['y']`)보다 **훨씬 느리다**. 컬럼을 받는 것은 기본값 `axis=0`이다.",
          "",
          "- ① 옳다. [[aggregation|집계(aggregation)]]는 그룹당 하나로 축약한다.",
          "- ② 옳다. [[transform|변환(transform)]]은 길이를 보존해 `df['m'] = df.groupby('k')['v'].transform('mean')`이 가능하다.",
          "- ③ 옳다. [[apply|함수 적용(apply)]]은 범용이라 반환 모양이 함수에 따라 결정되고, 그래서 agg·transform보다 느리고 예측이 어렵다.",
          "",
          "시험에서는 세 메서드의 **결과 길이**(agg = 그룹 수, transform = 원본, apply = 함수에 따라)와 `apply(axis=1)`의 성능 함정을 함께 묻는다."
        ],
        terms: ["aggregation", "transform", "apply", "axis"],
        tags: ["groupby"]
      },
      {
        id: "b-2-2-q13", node: "b-2-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df.describe()`는 기본 설정에서 수치형 컬럼만 요약하며, 결과에는 25%·50%·75% 백분위수(percentile)가 포함된다.",
        answer: true,
        explanation: [
          "**정답: O** [[descriptive-statistics|기술통계(descriptive statistics)]] 요약 `describe()`는 기본으로 수치형 컬럼에 대해 `count, mean, std, min, 25%, 50%, 75%, max` 8개 행을 돌려준다. 문자열 컬럼까지 보려면 `describe(include='all')` 또는 `include='object'`, 백분위수를 바꾸려면 `percentiles=[.1, .9]`.",
          "",
          "여기서 `50%` 행은 중앙값(median)이고 `75% - 25%`가 사분위 범위(IQR)이며, 각 값은 `df['a'].quantile(0.75)`와 같다. `count`는 결측을 제외한 개수다.",
          "",
          "시험에서는 describe 출력표를 주고 중앙값·IQR을 읽게 하거나, `std`가 표본표준편차(ddof=1)라는 점, 문자열 컬럼이 빠지는 이유를 묻는다."
        ],
        terms: ["descriptive-statistics"],
        tags: ["describe"]
      },
      {
        id: "b-2-2-q14", node: "b-2-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`df.corr()`의 기본 상관계수는 스피어만(Spearman) 순위상관이다.",
        answer: false,
        explanation: [
          "**정답: X** `corr()`의 기본값은 `method='pearson'`, 즉 **피어슨 적률 [[correlation-coefficient|상관계수(Pearson correlation coefficient)]]**다. 순위상관이 필요하면 `df.corr(method='spearman')`, 켄달은 `'kendall'`. 또 기본으로 수치형 컬럼만 대상이며(`numeric_only`), 결측은 쌍별로 제외된다.",
          "",
          "두 컬럼만 보려면 `df['a'].corr(df['b'])`가 스칼라를 돌려주고, 전체 행렬에서 특정 쌍은 `df.corr().loc['a', 'b']`로 읽는다.",
          "",
          "시험에서는 \"상관행렬에서 절댓값이 가장 큰 쌍\"을 `corr().abs()`로 찾는 코드, 대각선이 1인 이유, 기본 method를 묻는다."
        ],
        terms: ["correlation-coefficient"],
        tags: ["corr"]
      },
      {
        id: "b-2-2-q15", node: "b-2-2", type: "ox", kind: "concept", difficulty: 3,
        prompt: "`df.set_index('id')` 뒤에 `reset_index(drop=True)`를 호출하면 `id`가 다시 컬럼으로 복원된다.",
        answer: false,
        explanation: [
          "**정답: X** `reset_index()`는 현재 [[index|인덱스(index)]]를 컬럼으로 **되돌리는** 메서드지만, `drop=True`를 주면 인덱스를 **버리고** 0부터의 정수 인덱스만 새로 만든다. 따라서 `id`는 컬럼으로 복원되지 않고 사라진다. 복원하려면 `reset_index()`(기본 `drop=False`).",
          "",
          "`drop=True`는 필터·정렬·concat 뒤 어긋난 정수 인덱스를 0부터 다시 매길 때 쓰는 옵션이다(`ignore_index=True`와 같은 효과). 반대로 `set_index('id', drop=False)`는 `id`를 인덱스로 올리면서 컬럼에도 남긴다.",
          "",
          "시험에서는 `reset_index()` 뒤 컬럼 목록에 `index`(이름 없는 인덱스일 때) 또는 원래 이름이 생기는지, `drop=True`일 때 컬럼 수 변화를 묻는다."
        ],
        terms: ["index", "sort"],
        tags: ["index"]
      },
      {
        id: "b-2-2-q16", node: "b-2-2", type: "short", kind: "output", difficulty: 1,
        prompt: "다음 코드가 출력하는 숫자를 쓰시오.",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, 2, 3, 4])",
          "print(s.cumsum().iloc[-1])"
        ],
        lang: "python",
        answer: "10",
        explanation: [
          "**정답: 10** [[cumulative|누적 연산(cumsum)]]은 각 위치까지의 누적 합을 **원본과 같은 길이**로 돌려준다 → `[1, 3, 6, 10]`. `iloc[-1]`은 마지막 위치이므로 10이고, 이는 `s.sum()`과 같다.",
          "",
          "`cumsum`·`cummax`·`cumcount`는 집계(aggregation)처럼 값 하나로 줄이지 않고 길이를 유지한다는 점이 핵심이다. 그룹별 누적은 `df.groupby('k')['v'].cumsum()`으로 쓰며 역시 원본 길이다.",
          "",
          "시험에서는 `cumsum()` 결과 리스트, \"누적 합이 처음 100을 넘는 행\"을 `(s.cumsum() >= 100).idxmax()`로 찾는 패턴, 누적 비율 `cumsum() / sum()`으로 나온다."
        ],
        terms: ["cumulative", "iloc"],
        tags: ["cumsum"]
      },
      {
        id: "b-2-2-q17", node: "b-2-2", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 문자열을 쓰시오. 날짜로 바꿀 수 없는 값을 오류 대신 `NaT`로 만든다: `pd.to_datetime(df['date'], errors='____')`",
        answer: "coerce",
        accept: ["'coerce'"],
        explanation: [
          "**정답: coerce** [[type-casting|형 변환(type casting)]] 함수 `to_datetime`·`to_numeric`의 `errors='coerce'`는 변환에 실패한 값을 **결측(`NaT` / `NaN`)으로 강제**하고 나머지는 정상 변환한다. 기본값 `errors='raise'`는 하나라도 실패하면 예외를 낸다.",
          "",
          "변환 뒤 `isna().sum()`으로 실패 개수를 세는 것이 정석이다. [[datetime|날짜시간형(datetime)]]으로 바뀐 뒤에만 `.dt.year` 같은 접근자를 쓸 수 있고, 형식이 특수하면 `format='%Y/%m/%d'`를 함께 준다.",
          "",
          "시험에서는 \"잘못된 날짜 문자열이 섞인 컬럼을 변환하는 인자\", `to_numeric(errors='coerce')` 뒤 결측 개수, `astype(int)`가 결측 때문에 실패하는 상황과 묶어 나온다."
        ],
        terms: ["type-casting", "datetime"],
        tags: ["datetime"]
      },
      {
        id: "b-2-2-q18", node: "b-2-2", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 키워드 인자의 이름을 쓰시오. 무작위 표본 추출을 실행마다 같게 재현한다: `df.sample(n=5, ____=42)`",
        answer: "random_state",
        accept: ["random_state=42"],
        explanation: [
          "**정답: random_state** `sample()`의 `random_state`에 정수를 주면 난수 시드가 고정되어 **같은 행이 같은 순서로** 뽑힌다. 시드 없이 뽑으면 실행마다 결과가 달라져 채점 값이 맞지 않는다.",
          "",
          "`sample(frac=0.3)`은 비율로 뽑고, `replace=True`는 복원추출(부트스트랩), `df.sample(frac=1, random_state=0)`은 행 전체를 섞는 관용구다. 같은 이름의 인자가 sklearn의 `train_test_split`·`KMeans`에도 있어 재현성(reproducibility)의 표준 키워드다.",
          "",
          "시험에서는 [[dataframe|DataFrame]] 표본 추출에서 \"결과를 재현하려면 어떤 인자를 고정하는가\", `n`과 `frac`을 동시에 주면 오류라는 점으로 나온다."
        ],
        terms: ["dataframe"],
        tags: ["sample"]
      },
      {
        id: "b-2-2-q19", node: "b-2-2", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 `read_csv` 인자의 이름을 쓰시오. 파일의 첫 번째 컬럼을 행 인덱스로 사용한다: `pd.read_csv('data.csv', ____=0)`",
        answer: "index_col",
        accept: ["index_col=0"],
        explanation: [
          "**정답: index_col** [[read-csv|CSV 읽기(read_csv)]]의 `index_col=0`은 0번째 컬럼을 행 [[index|인덱스(index)]]로 올린다. 이전에 `to_csv()`로 저장한 파일을 다시 읽을 때 `Unnamed: 0` 컬럼이 생기는 것을 막는 대표 인자다(`to_csv(index=False)`로 저장하는 것도 방법).",
          "",
          "함께 나오는 인자: `sep='\\t'`(구분자), `header=None`(헤더 없음, 컬럼은 0,1,2…), `usecols=[...]`(일부 컬럼만), `dtype={'id': str}`(형 지정), `parse_dates=['date']`(날짜 파싱), `encoding='cp949'`(한글 윈도 파일), `na_values=['-']`(결측 표기).",
          "",
          "시험에서는 \"첫 컬럼이 Unnamed: 0으로 들어온 이유와 해결\", 탭 구분 파일의 `sep`, 한글 깨짐의 `encoding`을 묻는다."
        ],
        terms: ["read-csv", "index"],
        tags: ["io"]
      },
      {
        id: "b-2-2-q20", node: "b-2-2", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드가 출력하는 숫자를 쓰시오.",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, None, None], 'b': [None, 2, 3]})",
          "print(df.fillna({'a': 0}).isna().sum().sum())"
        ],
        lang: "python",
        answer: "1",
        explanation: [
          "**정답: 1** `fillna`에 **딕셔너리**를 주면 키에 적은 컬럼만 해당 값으로 채운다. `a`의 결측 2개는 0으로 채워지고 `b`의 결측 1개는 **그대로 남는다**. `isna().sum()`은 컬럼별 결측 수 `a=0, b=1`, 다시 `.sum()`으로 전체 1.",
          "",
          "[[missing-value|결측값(missing value)]] 처리에서 컬럼마다 다른 값(수치는 중앙값, 범주는 최빈값)으로 채울 때 이 딕셔너리 형태가 정석이다: `df.fillna({'age': df['age'].median(), 'city': df['city'].mode()[0]})`. `fillna(0)`처럼 스칼라를 주면 모든 컬럼이 채워진다.",
          "",
          "시험에서는 `fillna` 딕셔너리 뒤 남은 결측 수, `isna().sum().sum()`이 전체 결측 개수라는 점, `fillna(df.mean(numeric_only=True))`로 컬럼별 평균 대치가 되는 이유로 나온다."
        ],
        terms: ["missing-value"],
        tags: ["fillna"]
      }
    ],

    /* ────────────────────────────────────────────────────────
       실습 과제 — b-2 (난이도 1·2)
       ──────────────────────────────────────────────────────── */
    practices: [
      {
        id: "b-2-p01", node: "b-2",
        title: "다중 조건 필터 행 수",
        difficulty: 1,
        task: [
          "`df`에서 도시(`city`)가 `'Seoul'`이고 나이(`age`)가 **30 이상**인 행의 개수를 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2024)",
          "df = pd.DataFrame({",
          "    'city': rng.choice(['Seoul', 'Busan', 'Daegu'], size=200),",
          "    'age': rng.integers(20, 60, size=200),",
          "    'score': rng.normal(70, 10, size=200).round(1),",
          "})",
          "df.loc[rng.choice(200, size=12, replace=False), 'score'] = np.nan",
          "df.head()"
        ],
        hint: [
          "조건마다 괄호를 치고 `&`로 연결한다. `and`를 쓰면 ValueError.",
          "불리언 Series의 `sum()` 또는 필터 결과의 `len()`이 행 수다."
        ],
        answer: { type: "int", value: 57 },
        solution: [
          "mask = (df['city'] == 'Seoul') & (df['age'] >= 30)",
          "int(mask.sum())"
        ],
        explanation: [
          "[[boolean-indexing|불리언 인덱싱(boolean indexing)]]의 기본형이다. 두 조건을 각각 괄호로 감싸고 `&`로 묶은 마스크의 `sum()`은 `True`의 개수, 즉 조건을 만족하는 행 수다. `len(df[mask])`와 같다.",
          "`score`에 결측이 섞여 있지만 이 문제의 조건에는 쓰이지 않으므로 행 수에 영향이 없다 — 결측이 있는 컬럼으로 필터할 때만 `notna()`를 함께 고려한다."
        ],
        terms: ["boolean-indexing", "isin"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "b-2-p02", node: "b-2",
        title: "left merge 후 등급별 평균 금액의 최댓값",
        difficulty: 2,
        task: [
          "주문표 `orders`에 고객표 `customers`를 **왼쪽 조인(left join)** 으로 붙인 뒤, 등급(`grade`)별 주문 금액(`amount`) 평균을 구하고 그중 **최댓값**을 소수 둘째 자리까지 반올림해 입력하시오.",
          "(고객표에 없는 고객의 주문은 등급이 결측이 되며, groupby 기본 설정에서 제외된다.)"
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(7)",
          "customers = pd.DataFrame({",
          "    'cust_id': range(1, 41),",
          "    'grade': rng.choice(['gold', 'silver', 'bronze'], size=40, p=[0.2, 0.3, 0.5]),",
          "})",
          "orders = pd.DataFrame({",
          "    'cust_id': rng.integers(1, 51, size=300),",
          "    'amount': rng.gamma(2.0, 30.0, size=300).round(0),",
          "})",
          "orders.head()"
        ],
        hint: [
          "`orders.merge(customers, on='cust_id', how='left')` — 행 수가 300으로 유지되는지 `len()`으로 확인한다.",
          "`groupby('grade')['amount'].mean()` 뒤에 `.max()`를 이어 붙인다."
        ],
        answer: { type: "number", value: 56.54, decimals: 2 },
        solution: [
          "m = orders.merge(customers, on='cust_id', how='left')",
          "round(m.groupby('grade')['amount'].mean().max(), 2)"
        ],
        explanation: [
          "[[left-join|왼쪽 조인(left join)]]은 왼쪽(`orders`) 행을 모두 보존한다. `customers`의 `cust_id`가 유일하므로 행이 늘어나지 않고 300행이 유지되며, 고객표에 없는 `cust_id` 41~50의 주문은 `grade`가 결측(NaN)이 된다.",
          "[[groupby|그룹화(groupby)]]는 기본 `dropna=True`라 키가 결측인 행을 그룹에서 제외하므로 세 등급의 평균만 나오고, 그 위에 `max()`를 얹으면 스칼라가 된다. 결측 고객까지 한 그룹으로 보고 싶다면 `groupby('grade', dropna=False)`."
        ],
        terms: ["merge", "left-join", "groupby", "missing-value"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      }
    ],

    /* ────────────────────────────────────────────────────────
       용어 — 이 파일에서 태그·링크한 것 전부. 다른 파일과 겹치는 id 는 같은 정의를 쓴다.
       ──────────────────────────────────────────────────────── */
    terms: [
      { id: "series", ko: "시리즈", en: "Series",
        def: "pandas의 1차원 자료구조. 값 배열과 인덱스(레이블)를 함께 가지며 단일 dtype을 갖는다. DataFrame의 한 컬럼이 Series다.",
        nodes: ["b-2"], related: ["dataframe", "index"] },
      { id: "dataframe", ko: "데이터프레임", en: "DataFrame",
        def: "pandas의 2차원 표 자료구조. 같은 인덱스를 공유하는 여러 Series(컬럼)로 이루어지며 컬럼마다 dtype이 다를 수 있다.",
        nodes: ["b-2", "b-2-2"], related: ["series", "index"] },
      { id: "index", ko: "인덱스", en: "index / label",
        def: "Series와 DataFrame의 행(또는 열)에 붙는 레이블. 정렬·정합(alignment)·선택의 기준이 되며 loc 접근자가 참조한다.",
        nodes: ["b-2", "b-2-2"], related: ["loc", "multiindex"] },
      { id: "loc", ko: "레이블 기반 선택", en: "loc (label-based indexing)",
        def: "행·열을 인덱스 레이블로 선택하는 접근자. 슬라이스의 끝 레이블을 포함하며 불리언 마스크도 받는다.",
        nodes: ["b-2", "b-2-2"], related: ["iloc", "index", "boolean-indexing"] },
      { id: "iloc", ko: "위치 기반 선택", en: "iloc (integer-location indexing)",
        def: "행·열을 0부터 시작하는 정수 위치로 선택하는 접근자. 파이썬 슬라이스처럼 끝 위치를 제외한다.",
        nodes: ["b-2", "b-2-2"], related: ["loc"] },
      { id: "boolean-indexing", ko: "불리언 인덱싱", en: "boolean indexing / boolean mask",
        def: "조건식으로 만든 True/False Series(마스크)로 행을 선택하는 방법. 조건 결합은 &, |, ~ 와 괄호를 쓴다.",
        nodes: ["b-2", "b-2-2"], related: ["loc", "isin"] },
      { id: "isin", ko: "멤버십 필터", en: "isin",
        def: "Series의 각 원소가 주어진 목록(또는 집합)에 속하는지를 불리언 Series로 돌려주는 메서드. 파이썬 in 연산자의 벡터 버전이다.",
        nodes: ["b-2"], related: ["boolean-indexing"] },
      { id: "view-copy", ko: "뷰와 복사", en: "view vs copy",
        def: "부분 선택 결과가 원본 메모리를 공유하는지(뷰) 독립적인지(복사)의 구분. 애매한 경우 .copy()를 명시하고, 원본 수정은 loc 한 번의 대입으로 한다.",
        nodes: ["b-2-2"], related: ["loc", "chained-indexing"] },
      { id: "chained-indexing", ko: "체인 인덱싱", en: "chained indexing",
        def: "df[cond]['col'] = 값처럼 선택을 두 번 이어 붙여 대입하는 방식. 중간 객체가 복사본일 수 있어 원본 수정이 보장되지 않으므로 df.loc[cond, 'col'] = 값으로 쓴다.",
        nodes: ["b-2", "b-2-2"], related: ["view-copy", "loc"] },
      { id: "inplace", ko: "제자리 수정", en: "inplace",
        def: "메서드가 새 객체를 돌려주지 않고 호출한 객체 자체를 바꾸게 하는 인자. inplace=True이면 반환값은 None이므로 재할당과 함께 쓰면 데이터를 잃는다.",
        nodes: ["b-2"], related: ["dataframe"] },
      { id: "axis", ko: "축", en: "axis",
        def: "연산이 적용되는 방향. axis=0은 행 방향(인덱스를 따라 아래로), axis=1은 열 방향(컬럼을 따라 옆으로)이며 drop(axis=1)은 컬럼을 지우고 mean(axis=1)은 행별 평균을 낸다.",
        nodes: ["b-2", "b-2-2"], related: ["aggregation", "dataframe"] },
      { id: "missing-value", ko: "결측값", en: "missing value (NaN / None / NaT)",
        def: "관측되지 않았거나 기록되지 않은 값. pandas에서는 NaN(수치), None, NaT(날짜)로 표현되며 isna()로 탐지한다.",
        nodes: ["b-2", "b-2-2"], related: ["type-casting", "value-counts"] },
      { id: "type-casting", ko: "형 변환", en: "type casting / type conversion",
        def: "컬럼의 dtype을 다른 타입으로 바꾸는 처리. astype은 실패 시 예외를 내고, to_numeric·to_datetime은 errors='coerce'로 실패 값을 NaN/NaT로 바꿀 수 있다.",
        nodes: ["b-2-2"], related: ["datetime", "missing-value"] },
      { id: "datetime", ko: "날짜시간형", en: "datetime64 / Timestamp",
        def: "날짜와 시각을 나타내는 pandas 자료형. to_datetime으로 변환하고 .dt 접근자로 연·월·일·요일 등을 추출한다.",
        nodes: ["b-2-2"], related: ["type-casting", "dt-accessor"] },
      { id: "dt-accessor", ko: "dt 접근자", en: ".dt accessor",
        def: "datetime형 Series에서 year, month, dayofweek, day_name() 등 날짜 속성을 벡터 단위로 꺼내는 접근자. 문자열 Series에는 쓸 수 없다.",
        nodes: ["b-2-2"], related: ["datetime", "str-accessor"] },
      { id: "str-accessor", ko: "str 접근자", en: ".str accessor",
        def: "문자열 Series에 contains, extract, replace, split 등 문자열 메서드를 벡터 단위로 적용하는 접근자. 정규식을 지원한다.",
        nodes: ["b-2"], related: ["dt-accessor"] },
      { id: "groupby", ko: "그룹화", en: "groupby / group-by",
        def: "키 컬럼 값이 같은 행끼리 묶어 각 묶음에 함수를 적용하는 연산. 분할-적용-결합 패턴의 구현.",
        nodes: ["b-2", "b-2-2"], related: ["aggregation", "transform", "apply"] },
      { id: "aggregation", ko: "집계", en: "aggregation / agg",
        def: "여러 값을 하나의 대표값(합·평균·개수 등)으로 줄이는 연산. 그룹당 결과가 하나다.",
        nodes: ["b-2", "b-2-2"], related: ["groupby", "transform"] },
      { id: "transform", ko: "변환", en: "transform",
        def: "그룹별 계산 결과를 원본과 같은 길이로 돌려주는 groupby 메서드. 그룹 통계를 각 행에 붙일 때 쓴다.",
        nodes: ["b-2", "b-2-2"], related: ["aggregation", "apply"] },
      { id: "apply", ko: "함수 적용", en: "apply",
        def: "각 그룹(또는 행·열·원소)에 임의의 함수를 적용하는 범용 메서드. 반환 모양이 함수에 따라 달라지며 agg·transform보다 느리다.",
        nodes: ["b-2-2"], related: ["aggregation", "transform", "axis"] },
      { id: "multiindex", ko: "다중 인덱스", en: "MultiIndex (hierarchical index)",
        def: "두 개 이상의 레벨로 이루어진 계층적 인덱스. 여러 키로 groupby하거나 pivot하면 생기며 unstack·reset_index로 평탄화한다.",
        nodes: ["b-2"], related: ["index", "groupby"] },
      { id: "merge", ko: "병합", en: "merge",
        def: "두 DataFrame을 하나 이상의 키 컬럼(또는 인덱스) 값이 일치하는 행끼리 가로로 붙이는 연산. SQL의 조인에 해당하며 how 인자로 남길 행을 정한다.",
        nodes: ["b-2", "b-2-2"], related: ["inner-join", "left-join", "outer-join", "concat"] },
      { id: "inner-join", ko: "내부 조인", en: "inner join",
        def: "양쪽 표에 모두 존재하는 키의 행만 남기는 결합 방식. 교집합에 해당하며 pandas merge의 기본값이다.",
        nodes: ["b-2", "b-2-2"], related: ["left-join", "outer-join", "merge"] },
      { id: "left-join", ko: "왼쪽 조인", en: "left join / left outer join",
        def: "왼쪽 표의 행을 모두 남기고 오른쪽에서 키가 일치하는 값을 붙이는 결합 방식. 짝이 없는 오른쪽 컬럼은 결측값이 된다.",
        nodes: ["b-2", "b-2-2"], related: ["inner-join", "outer-join", "missing-value"] },
      { id: "outer-join", ko: "외부 조인", en: "outer join / full outer join",
        def: "양쪽 표의 키 합집합을 모두 남기는 결합 방식. 어느 한쪽에만 있는 행은 상대편 컬럼이 결측값으로 채워진다.",
        nodes: ["b-2-2"], related: ["inner-join", "left-join", "missing-value"] },
      { id: "concat", ko: "결합(이어 붙이기)", en: "concat / concatenation",
        def: "여러 DataFrame이나 Series를 행 방향(axis=0) 또는 열 방향(axis=1)으로 이어 붙이는 연산. 키가 아니라 축과 인덱스 정렬을 기준으로 한다.",
        nodes: ["b-2", "b-2-2"], related: ["merge", "index"] },
      { id: "pivot", ko: "피벗(재구조화)", en: "pivot",
        def: "집계 없이 긴 형식을 넓은 형식으로 바꾸는 재구조화 메서드. (index, columns) 조합이 중복이면 ValueError가 난다.",
        nodes: ["b-2-2"], related: ["pivot-table"] },
      { id: "pivot-table", ko: "피벗 테이블", en: "pivot table / pivot_table",
        def: "행 키와 열 키 두 축으로 값을 집계해 교차표 형태로 만드는 연산.",
        nodes: ["b-2-2"], related: ["aggregation", "pivot"] },
      { id: "value-counts", ko: "빈도 집계", en: "value_counts",
        def: "Series의 고유값별 등장 횟수를 빈도 내림차순으로 돌려주는 메서드. normalize=True면 비율을 돌려준다.",
        nodes: ["b-2", "b-2-2"], related: ["descriptive-statistics", "missing-value"] },
      { id: "descriptive-statistics", ko: "기술통계", en: "descriptive statistics",
        def: "데이터의 분포를 개수·평균·표준편차·최소·사분위수·최대 등으로 요약하는 통계. pandas에서는 describe()가 수치형 컬럼에 대해 한 번에 계산한다.",
        nodes: ["b-2-2"], related: ["value-counts", "correlation-coefficient"] },
      { id: "correlation-coefficient", ko: "상관계수", en: "correlation coefficient (Pearson r)",
        def: "두 변수의 선형 관계 강도와 방향을 −1~1로 나타낸 값. 공분산을 두 표준편차의 곱으로 나눈다.",
        nodes: ["b-2-2"], related: ["descriptive-statistics"] },
      { id: "sort", ko: "정렬", en: "sort (sort_values / sort_index)",
        def: "값 기준(sort_values) 또는 인덱스 기준(sort_index)으로 행을 재배열하는 연산. 여러 키와 키별 오름·내림차순을 리스트로 지정할 수 있다.",
        nodes: ["b-2", "b-2-2"], related: ["rank", "index"] },
      { id: "rank", ko: "순위", en: "rank",
        def: "값의 크기 순서를 매기는 메서드. 동점 처리 방식은 method='average'|'min'|'max'|'first'|'dense'로 정한다.",
        nodes: ["b-2"], related: ["sort", "nlargest"] },
      { id: "idxmax", ko: "최댓값 라벨", en: "idxmax / idxmin",
        def: "최댓값(최솟값)이 위치한 인덱스 라벨을 돌려주는 메서드. 동률이면 첫 번째 라벨을 택하며, 값 자체는 max/min, 위치는 argmax가 준다.",
        nodes: ["b-2-2"], related: ["nlargest"] },
      { id: "nlargest", ko: "상위 n개 선택", en: "nlargest / nsmallest",
        def: "지정한 컬럼 값이 가장 큰(작은) n개의 행을 돌려주는 메서드. 전체 정렬 후 head보다 효율적이다.",
        nodes: ["b-2", "b-2-2"], related: ["idxmax", "sort"] },
      { id: "where-mask", ko: "조건 치환", en: "where / mask",
        def: "조건에 따라 값을 바꾸는 메서드 쌍. where는 조건이 거짓인 곳을, mask는 조건이 참인 곳을 other 값으로 바꾸며 길이는 유지된다.",
        nodes: ["b-2-2"], related: ["boolean-indexing"] },
      { id: "shift", ko: "시프트(지연)", en: "shift / lag",
        def: "값을 지정한 칸 수만큼 앞이나 뒤로 미는 연산. 밀려서 비는 자리는 결측값이 되며 전 시점 값과의 비교(diff, pct_change)의 기초다.",
        nodes: ["b-2-2"], related: ["pct-change", "cumulative"] },
      { id: "pct-change", ko: "변화율", en: "pct_change / percentage change",
        def: "각 값이 직전 값에 비해 몇 배 변했는지(s / s.shift(1) - 1)를 구하는 연산. 첫 값은 결측값이다.",
        nodes: ["b-2-2"], related: ["shift"] },
      { id: "cumulative", ko: "누적 연산", en: "cumulative (cumsum / cummax / cumcount)",
        def: "각 위치까지의 누적 합·최댓값·개수를 원본과 같은 길이로 돌려주는 연산. 집계와 달리 길이가 줄지 않는다.",
        nodes: ["b-2-2"], related: ["aggregation", "shift"] },
      { id: "read-csv", ko: "CSV 읽기", en: "read_csv",
        def: "구분자로 나뉜 텍스트 파일을 DataFrame으로 읽는 함수. sep, header, names, index_col, usecols, dtype, parse_dates, na_values, encoding 등의 옵션을 갖는다.",
        nodes: ["b-2-2"], related: ["dataframe", "index"] }
    ]
  });
})();
