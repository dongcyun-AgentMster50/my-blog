/* ds-level2 — 파트A 3장 전반 콘텐츠: a-3-1 Python Native 문법 / a-3-2 Pandas 문법 기본 /
   a-3-3 Pandas 문법 심화 / a-3-4 Scikit-Learn.
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그한 용어는 전부 이 파일에서 정의.
   kind:output 문제의 출력과 실습 정답은 Python 3 / pandas 3.0.6 / numpy 2.4.6 / sklearn 1.9.1 에서 실행해 확인했다. */
(function () {
  DS2.register({
    chapter: "a-3",

    cards: {
      "a-3-1": {
        node: "a-3-1",
        title: "Python Native 문법",
        summary: [
          "pandas 코드를 읽으려면 그 아래의 순수 Python 규칙을 먼저 알아야 한다.",
          "핵심은 **가변(mutable)·불변(immutable)** 구분, [[slicing|슬라이싱]]과 [[list-comprehension|컴프리헨션]], `sorted`의 `key=lambda`, 그리고 `is`와 `==`의 차이다.",
          "시험은 출력 예측 형태로 [[mutable-default-argument|가변 기본 인자]], [[shallow-copy|얕은 복사]], [[bankers-rounding|짝수 반올림]] 같은 함정을 반복해서 묻는다."
        ],
        concepts: [
          "**가변/불변(mutable/immutable)**: 리스트·딕셔너리·셋은 가변, 숫자·문자열·튜플은 불변. 불변 객체의 메서드는 항상 새 객체를 돌려준다.",
          "**얕은 복사(shallow copy) vs 깊은 복사(deep copy)**: `lst[:]`, `lst.copy()`, `list(lst)`는 바깥 껍데기만 복사한다. 중첩 리스트까지 분리하려면 `copy.deepcopy`.",
          "**is vs ==**: `is`는 같은 객체인지(identity), `==`는 값이 같은지(equality). `None` 비교는 `is None`.",
          "**정렬**: `lst.sort()`는 제자리 정렬 후 `None` 반환, `sorted(iterable, key=..., reverse=...)`는 새 리스트 반환.",
          "**제너레이터(generator)**: `yield` 또는 `(x for x in ...)`. 값을 지연 평가로 하나씩 내고, 한 번 소진되면 끝.",
          "**정수 나눗셈·반올림**: `//`는 내림(floor)이라 `-7 // 2 == -4`. `round()`는 .5에서 짝수로 반올림해 `round(2.5) == 2`.",
          "**collections**: `Counter`는 빈도 집계(`most_common`), `defaultdict(list)`는 없는 키에 기본값을 자동 생성."
        ],
        terms: ["mutability", "shallow-copy", "deep-copy", "identity", "lambda", "list-comprehension", "slicing", "generator", "counter", "defaultdict", "mutable-default-argument", "bankers-rounding"],
        patterns: [
          {
            title: "컴프리헨션과 조건",
            lang: "python",
            code: [
              "squares = [x ** 2 for x in range(10) if x % 2 == 0]",
              "lengths = {w: len(w) for w in ['a', 'bb', 'ccc']}",
              "uniq = {c for c in 'banana'}"
            ],
            note: "리스트·딕셔너리·셋 컴프리헨션. 소괄호 버전 `(x for x in ...)`은 튜플이 아니라 **제너레이터**다."
          },
          {
            title: "sorted + key=lambda",
            lang: "python",
            code: [
              "pairs = [('b', 2), ('a', 3), ('c', 1)]",
              "sorted(pairs, key=lambda p: p[1], reverse=True)   # [('a', 3), ('b', 2), ('c', 1)]",
              "sorted(d.items(), key=lambda kv: kv[1])            # 값 기준 정렬"
            ],
            note: "`key`는 비교에 쓸 값을 돌려주는 함수. 여러 기준은 튜플로: `key=lambda p: (-p[1], p[0])`."
          },
          {
            title: "enumerate / zip / map / filter",
            lang: "python",
            code: [
              "for i, name in enumerate(['a', 'b'], start=1): ...",
              "dict(zip(['x', 'y'], [1, 2]))          # {'x': 1, 'y': 2}",
              "list(map(str.upper, ['a', 'b']))      # ['A', 'B']",
              "list(filter(lambda x: x > 0, [-1, 2]))  # [2]"
            ]
          },
          {
            title: "안전한 기본 인자와 *args/**kwargs",
            lang: "python",
            code: [
              "def add(x, acc=None):",
              "    if acc is None:",
              "        acc = []",
              "    acc.append(x)",
              "    return acc",
              "",
              "def f(*args, **kwargs):",
              "    return len(args), sorted(kwargs)"
            ],
            note: "기본 인자는 함수 정의 시 **한 번만** 평가된다. `acc=[]`로 두면 호출 간에 리스트가 공유된다."
          },
          {
            title: "Counter / defaultdict",
            lang: "python",
            code: [
              "from collections import Counter, defaultdict",
              "Counter('banana').most_common(1)   # [('a', 3)]",
              "groups = defaultdict(list)",
              "for k, v in [('a', 1), ('a', 2)]:",
              "    groups[k].append(v)              # {'a': [1, 2]}"
            ]
          },
          {
            title: "예외 처리와 f-string",
            lang: "python",
            code: [
              "try:",
              "    v = int('3.5')",
              "except ValueError as e:",
              "    v = 0",
              "else:",
              "    print('성공')      # 예외가 없을 때만",
              "finally:",
              "    print('항상')",
              "print(f'{1234.5678:,.2f}')   # 1,234.57"
            ]
          }
        ],
        pitfalls: [
          "`lst.sort()`의 반환값은 `None`이다. `x = lst.sort()` 뒤 `x`를 쓰면 `AttributeError`.",
          "`round(0.5)`, `round(2.5)`는 모두 **짝수**로 간다(0, 2). 소수 둘째 자리 반올림도 같은 규칙.",
          "`a = b = []`는 같은 리스트 하나를 두 이름이 가리킨다. `b.append(1)`이 `a`에도 보인다.",
          "제너레이터는 `len()`이 없고 한 번만 순회된다. 두 번 쓰려면 `list()`로 받아 둔다.",
          "`-7 // 2`는 `-4`, `-7 % 2`는 `1`. 음수 나눗셈은 내림(floor) 규칙."
        ]
      },

      "a-3-2": {
        node: "a-3-2",
        title: "Pandas 문법 기본",
        summary: [
          "[[dataframe|DataFrame]]은 [[series|Series]](1차원, 인덱스 + 값)를 컬럼으로 모은 2차원 표다.",
          "선택은 라벨 기반 `loc`과 위치 기반 `iloc`, 필터는 [[boolean-indexing|불리언 인덱싱]] `df[cond]`로 한다.",
          "메서드는 기본적으로 **새 객체를 반환**하고 원본을 바꾸지 않는다. `inplace=True`를 주면 `None`이 반환된다는 점이 시험 함정이다.",
          "컬럼 단위 연산은 벡터화되어 있고, 행/열 단위 사용자 함수는 `apply`, 원소 치환은 `map`을 쓴다."
        ],
        concepts: [
          "**생성**: `pd.DataFrame({'a': [...], 'b': [...]})`, `pd.Series([...], index=[...])`. `df.shape`, `df.dtypes`, `df.info()`, `df.describe()`로 구조 확인.",
          "**선택**: `df['a']`(Series), `df[['a', 'b']]`(DataFrame), `df.loc[행라벨, 열라벨]`(끝 포함), `df.iloc[행위치, 열위치]`(끝 미포함).",
          "**필터**: `df[df['a'] > 3]`. 두 조건은 `&`, `|`, `~`와 **괄호** 필수. `and`/`or`는 ValueError.",
          "**정렬**: `df.sort_values('a', ascending=False)`, `df.sort_index()`. 정렬 뒤 인덱스는 뒤섞인 채 남는다 → `reset_index(drop=True)`.",
          "**기초 통계**: `mean/median/sum/count/std/min/max/nunique/value_counts`. `count()`는 결측값(missing value)을 빼고 센다.",
          "**apply vs map**: `df.apply(f)`는 컬럼(axis=0) 또는 행(axis=1) 단위, `Series.map(dict_or_f)`는 원소 단위 치환. (`applymap`은 `DataFrame.map`으로 이름이 바뀌었다.)",
          "**인덱스**: `set_index('id')`는 컬럼을 인덱스로, `reset_index()`는 인덱스를 다시 컬럼으로. `rename(columns={...})`로 이름 변경."
        ],
        terms: ["dataframe", "series", "loc-iloc", "boolean-indexing", "apply", "map", "inplace", "reset-index", "missing-value", "descriptive-statistics", "dtype"],
        patterns: [
          {
            title: "생성과 구조 확인",
            lang: "python",
            code: [
              "import pandas as pd",
              "df = pd.DataFrame({'name': ['A', 'B', 'C'], 'age': [25, 40, 31]})",
              "df.shape, df.dtypes, df.describe()"
            ]
          },
          {
            title: "loc / iloc",
            lang: "python",
            code: [
              "df.loc[0, 'age']        # 라벨 0 행, 'age' 열",
              "df.loc[0:1, ['name']]   # 라벨 0~1 (끝 포함) → 2행",
              "df.iloc[0:1, 0]         # 위치 0 (끝 미포함) → 1행"
            ],
            note: "기본 RangeIndex에서는 라벨 == 위치라서 차이가 안 보이지만, 정렬·필터 후에는 달라진다."
          },
          {
            title: "필터 + 정렬 + 인덱스 리셋",
            lang: "python",
            code: [
              "out = (df[(df['age'] > 30) & (df['name'] != 'C')]",
              "         .sort_values('age', ascending=False)",
              "         .reset_index(drop=True))"
            ]
          },
          {
            title: "컬럼 연산 / apply / map",
            lang: "python",
            code: [
              "df['age2'] = df['age'] * 2                         # 벡터 연산",
              "df['grade'] = df['age'].map(lambda a: 'S' if a >= 35 else 'J')",
              "df['code'] = df['name'].map({'A': 1, 'B': 2})      # 없는 키 → NaN",
              "df[['age', 'age2']].apply(lambda col: col.max() - col.min())   # 컬럼별 범위"
            ]
          },
          {
            title: "rename / set_index / reset_index",
            lang: "python",
            code: [
              "df = df.rename(columns={'name': 'emp'})",
              "idx = df.set_index('emp')      # 'emp' 가 인덱스로 이동",
              "idx.reset_index()               # 다시 컬럼으로"
            ],
            note: "`inplace=True`를 쓰면 반환값이 `None`이라 메서드 체이닝이 끊긴다."
          }
        ],
        pitfalls: [
          "`df[df['a'] > 1 and df['b'] < 3]` → ValueError. `&`와 괄호를 쓴다.",
          "`df.loc[0:2]`는 3행, `df.iloc[0:2]`는 2행. `loc` 슬라이스는 끝을 **포함**한다.",
          "`df.dropna(inplace=True)`의 결과를 변수에 받으면 `None`이 들어간다.",
          "`df['a'].count()`는 결측값을 빼고 센다. 행 수는 `len(df)` 또는 `df.shape[0]`.",
          "`Series.map(dict)`에서 딕셔너리에 없는 값은 NaN이 된다."
        ]
      },

      "a-3-3": {
        node: "a-3-3",
        title: "Pandas 문법 심화",
        summary: [
          "기본 문법 위에 **집계·조건·재구조화** 세 축을 얹는다.",
          "[[groupby|그룹화]]는 `agg`(그룹당 1값)와 [[transform|변환]](원본 길이) 결과 길이 차이가 핵심이다.",
          "조건 컬럼은 [[np-where|np.where]](2분기)·[[np-select|np.select]](다분기), 다중 조건 필터는 `&`·`|`·`~`와 괄호, 범위는 `isin`/`between`으로 쓴다.",
          "wide↔long은 [[pivot-table|pivot_table]]↔[[melt|melt]], 윈도 함수는 `rolling`·`shift`·`cumsum`, 병합은 [[merge|merge]]의 `how`와 키 중복 함정을 기억한다."
        ],
        concepts: [
          "**groupby + agg**: `df.groupby('g')['v'].agg(['mean', 'count'])`는 그룹당 1행. 컬럼별로 다른 함수는 `agg(total=('v', 'sum'), n=('v', 'size'))`(named aggregation).",
          "**transform**: 그룹 통계를 원본 길이로 브로드캐스트. `df['v'] - df.groupby('g')['v'].transform('mean')`처럼 그룹 중심화에 쓴다.",
          "**조건 컬럼**: `np.where(cond, a, b)`는 이분기, `np.select([c1, c2], [v1, v2], default=v)`는 첫 번째로 참인 조건을 택한다.",
          "**다중 조건 필터**: 비교 연산자보다 `&`·`|`의 우선순위가 **높으므로** 각 조건을 괄호로 감싼다. 부정은 `~`.",
          "**isin / between**: `df['c'].isin([...])`, `df['x'].between(lo, hi)`(양 끝 포함).",
          "**str / dt 접근자**: `s.str.split('_').str[0]`, `s.str.contains('a')`, `d.dt.month`, `d.dt.dayofweek`.",
          "**재구조화**: `pivot_table(index, columns, values, aggfunc='mean')`(기본 mean) ↔ `melt(id_vars, var_name, value_name)`. `pivot`은 중복 조합이 있으면 에러.",
          "**윈도 함수**: `rolling(3).mean()`(앞 2개 NaN), `shift(1)`, `groupby('g')['v'].cumsum()`. **merge**: 기본 `how='inner'`, 키 중복이면 행이 늘어난다."
        ],
        terms: ["groupby", "aggregation", "transform", "np-where", "np-select", "isin", "between", "pivot-table", "melt", "window-function", "merge", "method-chaining", "vectorization", "str-accessor", "dt-accessor"],
        patterns: [
          {
            title: "다층 집계 (named aggregation)",
            lang: "python",
            code: [
              "df.groupby(['region', 'month']).agg(",
              "    total=('amount', 'sum'),",
              "    avg=('amount', 'mean'),",
              "    n=('amount', 'size'),",
              ").reset_index()"
            ]
          },
          {
            title: "transform 으로 그룹 통계 붙이기",
            lang: "python",
            code: [
              "df['region_mean'] = df.groupby('region')['amount'].transform('mean')",
              "df['above'] = df['amount'] > df['region_mean']"
            ]
          },
          {
            title: "조건 컬럼: np.where / np.select",
            lang: "python",
            code: [
              "import numpy as np",
              "df['big'] = np.where(df['amount'] >= 200, 'Y', 'N')",
              "df['tier'] = np.select(",
              "    [df['amount'] >= 250, df['amount'] >= 150],",
              "    ['A', 'B'], default='C')"
            ],
            note: "`np.select`에 `default`를 안 주면 기본값 0이 들어가 문자열과 섞인다."
          },
          {
            title: "다중 조건 · isin · between",
            lang: "python",
            code: [
              "m = (df['region'].isin(['East', 'West'])",
              "     & df['amount'].between(100, 200)",
              "     & ~(df['month'] == 6))",
              "df[m]"
            ]
          },
          {
            title: "pivot_table ↔ melt 왕복",
            lang: "python",
            code: [
              "wide = df.pivot_table(index='region', columns='month', values='amount', aggfunc='sum', fill_value=0)",
              "long = wide.reset_index().melt(id_vars='region', var_name='month', value_name='amount')"
            ]
          },
          {
            title: "윈도 함수와 merge",
            lang: "python",
            code: [
              "s = df.sort_values('month')['amount']",
              "s.rolling(3).mean();  s.shift(1);  s.diff()",
              "df.groupby('region')['amount'].cumsum()",
              "pd.merge(df, info, on='region', how='left', validate='many_to_one')"
            ],
            note: "`validate='many_to_one'`은 오른쪽 키가 중복이면 에러를 내 행 증식을 막아 준다."
          },
          {
            title: "메서드 체이닝",
            lang: "python",
            code: [
              "(df.query('amount > 100')",
              "   .assign(ratio=lambda d: d['amount'] / d['amount'].sum())",
              "   .groupby('region', as_index=False)['ratio'].sum()",
              "   .sort_values('ratio', ascending=False))"
            ]
          }
        ],
        pitfalls: [
          "`df['a'] > 1 & df['b'] < 3`은 `1 & df['b']`가 먼저 계산된다. 괄호 필수.",
          "`transform` 결과는 원본 길이, `agg`는 그룹 수. 새 컬럼으로 대입할 수 있는 쪽은 `transform`.",
          "`pivot_table`의 `aggfunc` 기본값은 `'mean'`이다. 합계가 필요하면 `'sum'`을 명시.",
          "`merge`의 기본 `how`는 `'inner'`. 키가 한쪽에 중복되면 결과 행 수가 원본보다 늘어난다.",
          "`rolling(n)`의 앞 n-1개는 NaN. `.sum()` 등으로 집계할 때 결측이 자동 제외된다는 점을 기억."
        ]
      },

      "a-3-4": {
        node: "a-3-4",
        title: "Scikit-Learn",
        summary: [
          "scikit-learn의 모든 객체는 [[fit-transform-predict|fit / transform / predict]] 세 메서드로 통일된 API를 따른다.",
          "흐름은 [[train-test-split|학습/테스트 분할]] → 전처리(스케일링·인코딩·결측 대치) → 모델 `fit` → `predict` → 평가지표다.",
          "전처리는 **학습 세트에만 `fit`** 하고 테스트 세트는 `transform`만 해야 [[data-leakage|데이터 누수]]를 막는다. [[pipeline|Pipeline]]과 [[column-transformer|ColumnTransformer]]가 이를 강제해 준다.",
          "분류는 accuracy·precision·recall·F1·ROC-AUC·혼동행렬, 회귀는 MSE·RMSE·R²로 평가하고, [[cross-validation|교차검증]]과 [[grid-search|GridSearchCV]]로 일반화 성능과 하이퍼파라미터를 다룬다."
        ],
        concepts: [
          "**추정기 API**: 변환기(transformer)는 `fit` → `transform`(`fit_transform`), 모델(estimator)은 `fit` → `predict`(`predict_proba`). `fit`은 자기 자신을 반환하고 학습된 속성은 `mean_`, `coef_`처럼 끝에 `_`가 붙는다.",
          "**train_test_split**: `test_size`, `random_state`(재현), `stratify=y`(클래스 비율 유지), `shuffle=True` 기본.",
          "**전처리**: `StandardScaler`(평균 0·표준편차 1), `MinMaxScaler`(0~1), `OneHotEncoder`(범주 → 더미 열, 2차원 입력), `LabelEncoder`(타깃 라벨 → 정수, 1차원), `SimpleImputer(strategy='mean'|'median'|'most_frequent')`.",
          "**ColumnTransformer / Pipeline**: 수치 컬럼은 스케일러, 범주 컬럼은 원핫처럼 컬럼 그룹별 변환을 묶고, Pipeline으로 전처리 + 모델을 하나의 추정기로 만든다.",
          "**주요 모델과 핵심 하이퍼파라미터**: `LogisticRegression(C)`(C↑ 규제↓), `DecisionTree(max_depth, min_samples_leaf)`, `RandomForest(n_estimators, max_depth)`, `KNN(n_neighbors)`, `SVM(C, kernel, gamma)`, `GradientBoosting(n_estimators, learning_rate, max_depth)`.",
          "**평가지표**: `accuracy_score`, `precision_score`(예측 양성 중 실제 양성), `recall_score`(실제 양성 중 맞춘 비율), `f1_score`(조화평균), `roc_auc_score`(확률 입력), `confusion_matrix`([[TN, FP], [FN, TP]]), `mean_squared_error`, `r2_score`.",
          "**교차검증**: `cross_val_score(model, X, y, cv=5)`, `KFold`, `StratifiedKFold`(분류 기본). `GridSearchCV(model, param_grid, cv)` → `best_params_`, `best_score_`.",
          "**데이터 누수(leakage)**: 테스트 데이터 정보가 학습 과정에 들어가는 것. 스케일러·대치기를 전체 데이터에 `fit`하는 것이 대표 사례."
        ],
        terms: ["fit-transform-predict", "train-test-split", "stratified-sampling", "standardization", "min-max-scaling", "one-hot-encoding", "label-encoding", "imputation", "column-transformer", "pipeline", "hyperparameter", "overfitting", "regularization", "accuracy", "precision", "recall", "f1-score", "roc-auc", "confusion-matrix", "mse", "r2-score", "cross-validation", "k-fold", "grid-search", "data-leakage"],
        patterns: [
          {
            title: "분할 → 스케일 → 학습 → 평가 (누수 없는 순서)",
            lang: "python",
            code: [
              "from sklearn.model_selection import train_test_split",
              "from sklearn.preprocessing import StandardScaler",
              "from sklearn.linear_model import LogisticRegression",
              "from sklearn.metrics import accuracy_score",
              "X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)",
              "sc = StandardScaler().fit(X_tr)          # 학습 세트에만 fit",
              "X_tr_s, X_te_s = sc.transform(X_tr), sc.transform(X_te)",
              "model = LogisticRegression(max_iter=1000).fit(X_tr_s, y_tr)",
              "accuracy_score(y_te, model.predict(X_te_s))"
            ]
          },
          {
            title: "Pipeline + ColumnTransformer",
            lang: "python",
            code: [
              "from sklearn.pipeline import Pipeline",
              "from sklearn.compose import ColumnTransformer",
              "from sklearn.preprocessing import OneHotEncoder, StandardScaler",
              "from sklearn.impute import SimpleImputer",
              "pre = ColumnTransformer([",
              "    ('num', Pipeline([('imp', SimpleImputer(strategy='median')), ('sc', StandardScaler())]), num_cols),",
              "    ('cat', OneHotEncoder(handle_unknown='ignore'), cat_cols),",
              "])",
              "pipe = Pipeline([('pre', pre), ('model', LogisticRegression(max_iter=1000))])",
              "pipe.fit(X_tr, y_tr).score(X_te, y_te)"
            ],
            note: "Pipeline 전체가 하나의 추정기라서 `cross_val_score`와 `GridSearchCV`에 그대로 넣을 수 있다."
          },
          {
            title: "분류 평가지표 묶음",
            lang: "python",
            code: [
              "from sklearn.metrics import (accuracy_score, precision_score, recall_score,",
              "                             f1_score, roc_auc_score, confusion_matrix)",
              "pred = model.predict(X_te); proba = model.predict_proba(X_te)[:, 1]",
              "confusion_matrix(y_te, pred)             # [[TN, FP], [FN, TP]]",
              "precision_score(y_te, pred), recall_score(y_te, pred), f1_score(y_te, pred)",
              "roc_auc_score(y_te, proba)               # 확률(점수)을 넣는다"
            ]
          },
          {
            title: "회귀 평가지표",
            lang: "python",
            code: [
              "from sklearn.linear_model import LinearRegression",
              "from sklearn.metrics import mean_squared_error, r2_score",
              "import numpy as np",
              "reg = LinearRegression().fit(X_tr, y_tr)",
              "pred = reg.predict(X_te)",
              "mse = mean_squared_error(y_te, pred); rmse = np.sqrt(mse)",
              "r2_score(y_te, pred)"
            ]
          },
          {
            title: "교차검증과 GridSearchCV",
            lang: "python",
            code: [
              "from sklearn.model_selection import cross_val_score, StratifiedKFold, GridSearchCV",
              "from sklearn.ensemble import RandomForestClassifier",
              "cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)",
              "cross_val_score(RandomForestClassifier(random_state=0), X, y, cv=cv).mean()",
              "gs = GridSearchCV(RandomForestClassifier(random_state=0),",
              "                  {'n_estimators': [100, 300], 'max_depth': [3, 5, None]}, cv=cv)",
              "gs.fit(X_tr, y_tr); gs.best_params_, gs.best_score_"
            ]
          }
        ],
        pitfalls: [
          "스케일러를 전체 데이터에 `fit_transform`한 뒤 분할하면 데이터 누수(leakage). 분할이 먼저다.",
          "`roc_auc_score`에는 `predict`의 0/1 라벨이 아니라 `predict_proba[:, 1]`을 넣어야 제대로 된 AUC가 나온다.",
          "`LogisticRegression`의 `C`는 **규제의 역수**다. C가 클수록 규제가 약해진다.",
          "`OneHotEncoder`는 2차원 입력(DataFrame/2D 배열), `LabelEncoder`는 1차원 타깃용이다.",
          "`confusion_matrix`의 행은 실제(true), 열은 예측(pred)이며 라벨은 정렬 순서(0, 1)다. [0, 0]은 TP가 아니라 TN."
        ]
      }
    },

    questions: [
      /* ─────────────── a-3-1 Python Native 문법 ─────────────── */
      {
        id: "a-3-1-q01", node: "a-3-1", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "a = [1, 2, 3, 4, 5]",
          "print(a[::-1][1:3])"
        ],
        lang: "python",
        choices: ["[4, 3]", "[5, 4]", "[2, 3]", "[3, 4]"],
        answer: 0,
        explanation: [
          "**정답: ①** `a[::-1]`은 리스트를 뒤집어 `[5, 4, 3, 2, 1]`을 만들고, 거기서 `[1:3]`은 위치 1, 2(끝 미포함)를 골라 `[4, 3]`이 된다. [[slicing|슬라이싱(slicing)]]은 `[start:stop:step]`이며 stop은 포함하지 않는다.",
          "",
          "- ② `[5, 4]`는 `a[::-1][0:2]`의 결과다.",
          "- ③ `[2, 3]`은 뒤집지 않은 `a[1:3]`이다.",
          "- ④ `[3, 4]`는 `a[2:4]`에 해당한다.",
          "",
          "시험에서는 역순 슬라이스 뒤에 다시 슬라이스를 거는 출력 예측 문제로 나온다."
        ],
        terms: ["slicing"]
      },
      {
        id: "a-3-1-q02", node: "a-3-1", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`is`와 `==`에 대한 설명으로 옳은 것은?",
        choices: [
          "`==`는 두 객체가 메모리상 같은 객체인지(identity)를 비교한다",
          "`is`는 두 피연산자가 같은 객체인지(identity)를, `==`는 값이 같은지(equality)를 비교한다",
          "`None`과 비교할 때는 `x == None`이 `x is None`보다 권장된다",
          "`a = [1, 2]; b = [1, 2]`일 때 `a is b`는 항상 `True`다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[identity|동일성(identity)]]을 보는 연산자는 `is`, 동등성(equality)을 보는 연산자는 `==`다. 값이 같은 두 리스트는 `==`로는 `True`, `is`로는 `False`가 된다.",
          "",
          "- ① `==`는 값 비교다. 객체 동일성은 `is`(또는 `id()` 비교).",
          "- ③ PEP 8은 `None` 비교에 `is None` / `is not None`을 권장한다. `None`은 싱글턴이기 때문이다.",
          "- ④ 리터럴로 따로 만든 두 리스트는 서로 다른 객체라 `a is b`는 `False`다.",
          "",
          "시험에서는 `a = b`로 같은 객체를 가리키게 한 뒤 `is`/`==`의 결과를 묻는 보기로 자주 나온다."
        ],
        terms: ["identity", "mutability"]
      },
      {
        id: "a-3-1-q03", node: "a-3-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "def add(x, acc=[]):",
          "    acc.append(x)",
          "    return acc",
          "",
          "add(1)",
          "print(add(2))"
        ],
        lang: "python",
        choices: ["[2]", "[1]", "[1, 2]", "TypeError"],
        answer: 2,
        explanation: [
          "**정답: ③** 기본 인자는 함수가 **정의될 때 한 번만** 평가된다. `acc=[]`의 리스트 하나가 모든 호출에서 공유되므로 첫 호출에서 1, 두 번째 호출에서 2가 쌓여 `[1, 2]`가 출력된다. 이것이 [[mutable-default-argument|가변 기본 인자(mutable default argument)]] 함정이다.",
          "",
          "- ① `[2]`는 호출마다 새 리스트가 만들어진다고 오해한 답이다.",
          "- ② `[1]`은 첫 호출 결과이며 두 번째 호출에서는 2가 추가된다.",
          "- ④ 리스트에 `append`하는 것은 정상 동작이라 예외가 나지 않는다.",
          "",
          "시험에서는 이 패턴의 출력을 묻거나, 올바른 수정(`acc=None` 후 `if acc is None: acc = []`)을 고르는 문제로 나온다."
        ],
        terms: ["mutable-default-argument", "mutability"]
      },
      {
        id: "a-3-1-q04", node: "a-3-1", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "Python 정렬(sort)에 대한 설명으로 옳은 것은?",
        choices: [
          "`lst.sort()`는 정렬된 새 리스트를 반환하고 원본은 그대로 둔다",
          "`sorted()`는 리스트에만 쓸 수 있고 튜플이나 딕셔너리에는 쓸 수 없다",
          "`key=lambda x: -x`와 `reverse=True`는 문자열 리스트 정렬에서도 항상 서로 바꿔 쓸 수 있다",
          "`sorted(words, key=len)`은 원본을 바꾸지 않고 길이 기준으로 정렬된 새 리스트를 돌려준다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** `sorted(iterable, key=..., reverse=...)`는 어떤 반복 가능 객체든 받아 **새 리스트**를 돌려주며 원본은 바뀌지 않는다. `key`에는 비교 기준 값을 돌려주는 함수([[lambda|람다(lambda)]] 또는 `len` 같은 내장 함수)를 준다.",
          "",
          "- ① `lst.sort()`는 제자리(in-place) 정렬이고 반환값은 `None`이다. `x = lst.sort()`는 `x`가 `None`이 되는 대표 함정.",
          "- ② `sorted()`는 튜플·셋·딕셔너리(키 순회)·제너레이터 등 모든 이터러블에 쓸 수 있다.",
          "- ③ 문자열에는 단항 `-`를 적용할 수 없어 `TypeError`가 난다. 내림차순은 `reverse=True`로.",
          "",
          "시험에서는 `sort()`의 반환값 `None`과 `sorted(d.items(), key=lambda kv: kv[1])`의 정렬 기준을 묻는다."
        ],
        terms: ["lambda"]
      },
      {
        id: "a-3-1-q05", node: "a-3-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "from collections import Counter",
          "c = Counter('banana')",
          "print(c.most_common(1))"
        ],
        lang: "python",
        choices: ["[('n', 2)]", "[('a', 3)]", "('a', 3)", "{'a': 3}"],
        answer: 1,
        explanation: [
          "**정답: ②** [[counter|Counter]]는 반복 가능 객체의 원소 빈도를 세는 딕셔너리 서브클래스다. 'banana'에서 a는 3개, n은 2개, b는 1개이고, `most_common(1)`은 **가장 많은 1개를 (원소, 빈도) 튜플의 리스트**로 돌려준다.",
          "",
          "- ① `[('n', 2)]`는 두 번째로 많은 원소다. `most_common(2)[1]`에 해당한다.",
          "- ③ `most_common`은 튜플 하나가 아니라 **리스트**를 돌려준다.",
          "- ④ 딕셔너리 형태는 `dict(c)` 또는 `c` 자체의 표시 형식이다.",
          "",
          "시험에서는 `most_common()`의 반환 자료형(튜플 리스트)과 `Counter(list)[key]`로 없는 키를 조회하면 0이 나온다는 점을 묻는다."
        ],
        terms: ["counter"]
      },
      {
        id: "a-3-1-q06", node: "a-3-1", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "복사본 `g2`만 바꾸려 했는데 원본 `grid`의 값도 9로 바뀌었다. 올바른 수정은?",
        code: [
          "import copy",
          "grid = [[0, 0], [0, 0]]",
          "g2 = grid.copy()",
          "g2[0][0] = 9",
          "print(grid[0][0])   # 9 가 출력된다"
        ],
        lang: "python",
        choices: [
          "`grid.copy()`를 `grid[:]`로 바꾼다",
          "`grid.copy()`를 `list(grid)`로 바꾼다",
          "`grid.copy()`를 `copy.deepcopy(grid)`로 바꾼다",
          "리스트는 불변이므로 원본은 바뀌지 않는다. 출력은 0이다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `grid.copy()`는 [[shallow-copy|얕은 복사(shallow copy)]]라서 바깥 리스트만 새로 만들고, 안쪽 리스트 `[0, 0]`들은 원본과 **같은 객체**를 가리킨다. 중첩 구조까지 전부 분리하려면 [[deep-copy|깊은 복사(deep copy)]] `copy.deepcopy`가 필요하다.",
          "",
          "- ① `grid[:]` 슬라이스 복사도 얕은 복사다. 결과가 같다.",
          "- ② `list(grid)`도 얕은 복사다.",
          "- ④ 리스트는 가변(mutable) 객체다. 안쪽 리스트가 공유되므로 원본도 바뀐다.",
          "",
          "시험에서는 `copy()`·`[:]`·`list()`가 모두 얕은 복사라는 점과, 2차원 리스트 수정 시 `deepcopy`가 필요한 상황을 묻는다."
        ],
        terms: ["shallow-copy", "deep-copy", "mutability"]
      },
      {
        id: "a-3-1-q07", node: "a-3-1", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "제너레이터(generator)에 대한 설명으로 옳은 것은?",
        choices: [
          "제너레이터는 `len()`으로 길이를 바로 구할 수 있다",
          "`(x * 2 for x in range(3))`은 튜플 컴프리헨션으로, 튜플 `(0, 2, 4)`를 만든다",
          "제너레이터는 한 번 소진된 뒤에도 다시 `for`로 순회하면 처음부터 값을 낸다",
          "제너레이터는 값을 지연 평가(lazy evaluation)로 하나씩 생성하므로 큰 시퀀스도 메모리를 적게 쓴다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[generator|제너레이터(generator)]]는 `yield`나 제너레이터 표현식으로 만들어지며, 요청이 올 때마다 값을 **하나씩** 계산해 돌려준다(lazy evaluation). 전체를 메모리에 올리지 않아 큰 파일·무한 수열 처리에 적합하다.",
          "",
          "- ① 제너레이터는 길이를 미리 알 수 없어 `len()`을 지원하지 않는다. `TypeError`.",
          "- ② 소괄호 컴프리헨션은 튜플이 아니라 **제너레이터 표현식**이다. 튜플이 필요하면 `tuple(...)`.",
          "- ③ 제너레이터는 **한 번만** 순회된다. 소진 후에는 아무것도 내지 않는다.",
          "",
          "시험에서는 `(x for x in ...)`의 자료형과 `list(g)`를 두 번 호출했을 때 두 번째가 빈 리스트인 이유를 묻는다."
        ],
        terms: ["generator", "list-comprehension"]
      },
      {
        id: "a-3-1-q08", node: "a-3-1", type: "ox", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은 `-4`이다.",
        code: ["print(-7 // 2)"],
        lang: "python",
        answer: true,
        explanation: [
          "**정답: O** `//`는 [[floor-division|정수 나눗셈(floor division)]]으로 결과를 **내림(floor)** 한다. -7 / 2 = -3.5이고, -3.5보다 작거나 같은 가장 큰 정수는 -4다. 0 쪽으로 자르는(truncate) 것이 아니라는 점이 핵심이다.",
          "",
          "같은 규칙으로 `-7 % 2`는 `1`이 된다(`-7 == 2 * -4 + 1`).",
          "",
          "시험에서는 음수의 `//`와 `%` 결과를 함께 묻는다. `int(-3.5)`는 `-3`(truncate)이라는 대비도 기억하자."
        ],
        terms: ["floor-division"]
      },
      {
        id: "a-3-1-q09", node: "a-3-1", type: "ox", kind: "concept", difficulty: 2,
        prompt: "튜플(tuple)은 불변(immutable)이므로 `t = ([1], 2)`일 때 `t[0].append(3)`도 `TypeError`를 일으킨다.",
        answer: false,
        explanation: [
          "**정답: X** 튜플의 [[mutability|불변성(immutability)]]은 튜플이 **어떤 객체를 가리키는지**를 바꿀 수 없다는 뜻이다. `t[0] = ...`처럼 원소를 교체하면 `TypeError`지만, `t[0]`이 가리키는 리스트 자체는 가변이므로 `t[0].append(3)`은 정상 동작해 `t`는 `([1, 3], 2)`가 된다.",
          "",
          "같은 이유로 리스트가 들어 있는 튜플은 해시할 수 없어 딕셔너리 키나 셋 원소로 쓸 수 없다.",
          "",
          "시험에서는 \"튜플 안의 리스트는 수정 가능한가\"를 O/X로 묻는다."
        ],
        terms: ["mutability"]
      },
      {
        id: "a-3-1-q10", node: "a-3-1", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 내장 함수를 쓰시오. 리스트의 **인덱스와 값**을 동시에 순회한다: `for i, v in ____(lst):`",
        answer: "enumerate",
        accept: ["enumerate()"],
        explanation: [
          "**정답: enumerate** [[enumerate|enumerate(iterable, start=0)]]는 `(인덱스, 값)` 튜플을 차례로 내는 이터레이터를 돌려준다. `start=1`을 주면 1부터 번호를 매긴다.",
          "",
          "비슷한 역할의 `zip`은 **여러 시퀀스를 같은 위치끼리** 묶는 함수라 혼동하기 쉽다. `for i, v in zip(range(len(lst)), lst)`로도 같은 결과를 낼 수 있지만 관용적 표현은 `enumerate`다.",
          "",
          "시험에서는 `enumerate`와 `zip`의 출력 형태(튜플)와 `start` 인자를 묻는다."
        ],
        terms: ["enumerate"]
      },
      {
        id: "a-3-1-q11", node: "a-3-1", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: ["print(round(0.5) + round(1.5) + round(2.5))"],
        lang: "python",
        answer: "4",
        explanation: [
          "**정답: 4** Python의 `round()`는 정확히 .5인 값을 **가까운 짝수**로 보내는 [[bankers-rounding|은행가 반올림(banker's rounding, round half to even)]]을 쓴다. `round(0.5) == 0`, `round(1.5) == 2`, `round(2.5) == 2`이므로 합은 4다.",
          "",
          "학교에서 배운 \"5는 올림\" 규칙(round half up)으로 계산하면 1 + 2 + 3 = 6이 되어 틀린다. 소수 자리 반올림(`round(2.675, 2)`)은 여기에 부동소수 표현 오차까지 겹친다.",
          "",
          "시험에서는 `round(2.5)`의 값(2)을 직접 묻거나, 실습 정답을 반올림할 때 이 규칙 때문에 1 차이가 나는 상황으로 나온다."
        ],
        terms: ["bankers-rounding"]
      },
      {
        id: "a-3-1-q12", node: "a-3-1", type: "short", kind: "concept", difficulty: 3,
        prompt: "`collections` 모듈에서, 존재하지 않는 키에 접근할 때 지정한 팩토리 함수(예: `list`, `int`)로 기본값을 **자동 생성**하는 딕셔너리 서브클래스의 이름은?",
        answer: "defaultdict",
        accept: ["collections.defaultdict", "defaultdict()"],
        explanation: [
          "**정답: defaultdict** [[defaultdict|defaultdict(default_factory)]]는 없는 키를 읽을 때 `KeyError` 대신 `default_factory()`의 결과를 그 키에 넣고 돌려준다. `defaultdict(list)`로 그룹별 리스트를 쌓거나 `defaultdict(int)`로 빈도를 셀 때 쓴다.",
          "",
          "일반 `dict`에서는 `d.setdefault(k, []).append(v)` 또는 `d.get(k, 0) + 1`로 같은 효과를 낸다. 빈도 집계만 필요하면 [[counter|Counter]]가 더 간단하다.",
          "",
          "시험에서는 `defaultdict(int)`에 없는 키를 `+= 1`한 결과, 또는 `dict`와의 차이(KeyError 여부)를 묻는다."
        ],
        terms: ["defaultdict", "counter"]
      },

      /* ─────────────── a-3-2 Pandas 문법 기본 ─────────────── */
      {
        id: "a-3-2-q01", node: "a-3-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})",
          "print(df['a'].sum(), df.loc[1, 'b'])"
        ],
        lang: "python",
        choices: ["6 5", "6 2", "5 5", "KeyError"],
        answer: 0,
        explanation: [
          "**정답: ①** `df['a']`는 [[series|Series]]이고 `.sum()`은 1 + 2 + 3 = 6이다. `df.loc[1, 'b']`는 [[loc-iloc|라벨 기반 선택(loc)]]으로 인덱스 라벨 1, 컬럼 'b'의 값 5를 고른다. 기본 RangeIndex에서는 라벨과 위치가 같다.",
          "",
          "- ② `6 2`는 `df.loc[1, 'a']`로 잘못 읽은 경우다.",
          "- ③ `5 5`는 합계를 잘못 계산한 경우다.",
          "- ④ 라벨 1과 컬럼 'b'가 모두 존재하므로 `KeyError`는 나지 않는다.",
          "",
          "시험에서는 `loc[행라벨, 열라벨]`의 두 인수 순서(행 먼저)와 `iloc`과의 차이를 출력 예측으로 묻는다."
        ],
        terms: ["series", "loc-iloc", "dataframe"]
      },
      {
        id: "a-3-2-q02", node: "a-3-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`loc`과 `iloc`에 대한 설명으로 옳은 것은?",
        choices: [
          "`iloc`는 라벨 기반, `loc`는 정수 위치 기반 인덱싱이다",
          "`loc`는 라벨 기반이며 슬라이스의 끝을 포함하고, `iloc`는 정수 위치 기반이며 끝을 포함하지 않는다",
          "`df.loc[0:2]`와 `df.iloc[0:2]`는 어떤 인덱스에서도 항상 같은 수의 행을 돌려준다",
          "`df.iloc['a']`처럼 `iloc`에 컬럼 라벨을 넘길 수 있다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[loc-iloc|loc/iloc]]의 구분은 **라벨(label) vs 위치(position)** 다. `loc` 슬라이스는 라벨이므로 끝을 포함하고(`df.loc[0:2]` → 3행), `iloc` 슬라이스는 Python 관례대로 끝을 제외한다(`df.iloc[0:2]` → 2행).",
          "",
          "- ① 설명이 뒤바뀌었다. `i`는 integer의 i다.",
          "- ③ 기본 RangeIndex에서도 `loc[0:2]`는 3행, `iloc[0:2]`는 2행으로 다르다.",
          "- ④ `iloc`에 라벨을 넘기면 `TypeError`가 난다. 정수 위치만 받는다.",
          "",
          "시험에서는 정렬·필터 후 인덱스가 뒤섞인 [[dataframe|DataFrame]]에서 `loc[0]`과 `iloc[0]`이 다른 행을 가리키는 상황으로 나온다."
        ],
        terms: ["loc-iloc", "dataframe"]
      },
      {
        id: "a-3-2-q03", node: "a-3-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([3, 1, 2], index=['x', 'y', 'z'])",
          "print(s.sort_values().index.tolist())"
        ],
        lang: "python",
        choices: ["['x', 'y', 'z']", "[1, 2, 3]", "['y', 'z', 'x']", "['z', 'y', 'x']"],
        answer: 2,
        explanation: [
          "**정답: ③** `sort_values()`는 **값** 기준 오름차순으로 정렬하되 각 값에 붙은 인덱스 라벨을 함께 끌고 간다. 값 1(y), 2(z), 3(x) 순이므로 인덱스는 `['y', 'z', 'x']`다. [[series|Series]]에서 인덱스와 값은 항상 쌍으로 움직인다.",
          "",
          "- ① `['x', 'y', 'z']`는 `sort_index()`의 결과거나 정렬 전 인덱스다.",
          "- ② `[1, 2, 3]`은 `.index`가 아니라 `.values` 또는 `.tolist()`의 결과다.",
          "- ④ `['z', 'y', 'x']`는 `sort_index(ascending=False)`의 결과다.",
          "",
          "시험에서는 `sort_values` 뒤 인덱스가 뒤섞인 상태에서 `iloc[0]`과 `loc[0]`을 묻거나 `reset_index(drop=True)`의 필요성을 묻는다."
        ],
        terms: ["series", "reset-index"]
      },
      {
        id: "a-3-2-q04", node: "a-3-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "pandas 메서드의 반환값과 `inplace`에 대한 설명으로 옳은 것은?",
        choices: [
          "`df.rename(columns={'a': 'b'})`는 원본 `df`를 바로 수정한다",
          "`df.dropna(inplace=True)`는 결측값이 제거된 새 DataFrame을 반환한다",
          "`df.sort_values('a', inplace=True).head()`는 정렬 후 상위 5행을 보여준다",
          "대부분의 DataFrame 메서드는 기본적으로 새 객체를 반환하고 원본은 그대로 둔다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** pandas 메서드는 기본적으로 **원본을 건드리지 않고 새 객체를 반환**한다. 원본을 바꾸려면 결과를 다시 대입(`df = df.rename(...)`)하거나 [[inplace|inplace=True]]를 준다.",
          "",
          "- ① `rename`은 새 DataFrame을 돌려준다. 재대입하지 않으면 원본 컬럼명은 그대로다.",
          "- ② `inplace=True`를 주면 원본이 바뀌고 반환값은 `None`이다. 변수에 받으면 `None`이 들어간다.",
          "- ③ `inplace=True`의 반환값이 `None`이라 `.head()`에서 `AttributeError`가 난다. 체이닝은 `inplace` 없이.",
          "",
          "시험에서는 \"`df2 = df.dropna(inplace=True)` 후 `df2`의 값은?\"(정답 `None`) 형태로 자주 나온다."
        ],
        terms: ["inplace", "missing-value"]
      },
      {
        id: "a-3-2-q05", node: "a-3-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2, 3], 'b': [10, 20, 30]})",
          "print(df.apply(lambda col: col.max() - col.min()).tolist())"
        ],
        lang: "python",
        choices: ["[9, 18, 27]", "[2, 20]", "[11, 22, 33]", "[3, 30]"],
        answer: 1,
        explanation: [
          "**정답: ②** `df.apply(f)`는 기본 `axis=0`이라 **컬럼마다** 함수를 한 번씩 호출한다. 'a'의 범위는 3 - 1 = 2, 'b'의 범위는 30 - 10 = 20이므로 결과는 길이 2의 Series `[2, 20]`이다. [[apply|apply]]는 컬럼/행 단위, `map`은 원소 단위다.",
          "",
          "- ① `[9, 18, 27]`은 `axis=1`로 행마다 `b - a`를 계산한 값이다.",
          "- ③ `[11, 22, 33]`은 행 단위 합 `df.sum(axis=1)`이다.",
          "- ④ `[3, 30]`은 `df.max()`의 결과다.",
          "",
          "시험에서는 `apply`의 `axis` 기본값(0 = 컬럼 단위)과 결과 길이를 묻는다."
        ],
        terms: ["apply", "descriptive-statistics"]
      },
      {
        id: "a-3-2-q06", node: "a-3-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 `ValueError: The truth value of a Series is ambiguous`를 일으킨다. 올바른 수정은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'age': [25, 40, 31], 'city': ['A', 'B', 'A']})",
          "result = df[df['age'] > 30 and df['city'] == 'A']"
        ],
        lang: "python",
        choices: [
          "`and`를 `&&`로 바꾼다",
          "`df[...]`로는 두 조건을 동시에 쓸 수 없으므로 `df.query`만 가능하다",
          "`and`를 `&`로 바꾸고 각 조건을 괄호로 감싼다: `df[(df['age'] > 30) & (df['city'] == 'A')]`",
          "`df['age'] > 30`을 `df.age > 30`으로 바꾼다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `and`는 양쪽을 **하나의 True/False**로 평가하려 하는데, 불리언 Series는 값이 여러 개라 참/거짓이 모호해 `ValueError`가 난다. 원소별(element-wise) 논리 연산은 `&`(and), `|`(or), `~`(not)이며, 비교 연산자보다 우선순위가 높으므로 각 조건을 괄호로 감싼다. 이것이 [[boolean-indexing|불리언 인덱싱(boolean indexing)]]의 기본 규칙이다.",
          "",
          "- ① Python에는 `&&` 연산자가 없다. `SyntaxError`.",
          "- ② `df.query('age > 30 and city == \"A\"')`도 가능하지만 유일한 방법은 아니다.",
          "- ④ 속성 접근으로 바꿔도 `and`가 그대로라 같은 오류가 난다.",
          "",
          "시험에서는 `and`/`or` → `&`/`|` 교체와 괄호 누락 시의 우선순위 오류를 함께 묻는다."
        ],
        terms: ["boolean-indexing"]
      },
      {
        id: "a-3-2-q07", node: "a-3-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`set_index`와 `reset_index`에 대한 설명으로 옳은 것은?",
        choices: [
          "`reset_index()`는 기존 인덱스를 버리고 아무 컬럼도 추가하지 않는다",
          "`reset_index(drop=True)`는 기존 인덱스를 'index'라는 컬럼으로 보존한다",
          "`df.set_index('id')`는 기본적으로 'id'를 인덱스로 옮기면서 컬럼에도 그대로 남겨 둔다",
          "`groupby('k').sum()`처럼 키가 인덱스로 간 결과에 `reset_index()`를 쓰면 키가 다시 일반 컬럼이 된다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[reset-index|reset_index]]는 현재 인덱스를 **컬럼으로 되돌리고** 0부터 시작하는 RangeIndex를 새로 단다. `groupby` 결과의 키나 `set_index`로 올린 컬럼을 다시 평범한 컬럼으로 쓰고 싶을 때 쓴다. (`groupby(..., as_index=False)`로도 같은 효과.)",
          "",
          "- ① 기본값 `drop=False`에서는 기존 인덱스가 컬럼('index' 또는 인덱스 이름)으로 **보존**된다.",
          "- ② `drop=True`는 기존 인덱스를 **버린다**. 설명이 반대다.",
          "- ③ `set_index`는 기본 `drop=True`라 컬럼에서 제거하고 인덱스로만 옮긴다.",
          "",
          "시험에서는 `sort_values` 뒤 `reset_index(drop=True)`를 안 해서 인덱스가 뒤섞인 상태나, `groupby` 결과를 `merge`하기 전 `reset_index()`가 필요한 이유를 묻는다."
        ],
        terms: ["reset-index", "dataframe"]
      },
      {
        id: "a-3-2-q08", node: "a-3-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df.describe()`는 기본적으로 **수치형(numeric) 컬럼**만 요약하고, 문자열 컬럼은 제외한다.",
        answer: true,
        explanation: [
          "**정답: O** [[descriptive-statistics|기초 통계(descriptive statistics)]]를 내는 `describe()`는 기본적으로 수치형 컬럼에 대해 count, mean, std, min, 25%, 50%, 75%, max를 보여 준다. 문자열·범주형까지 보려면 `describe(include='all')` 또는 `include='object'`를 준다.",
          "",
          "문자열 컬럼만 넣으면 count, unique, top, freq가 나온다는 점도 함께 기억하자.",
          "",
          "시험에서는 `describe()` 출력표의 행 이름(50% = 중위수)과 `include='all'`의 의미를 묻는다."
        ],
        terms: ["descriptive-statistics", "dtype"]
      },
      {
        id: "a-3-2-q09", node: "a-3-2", type: "ox", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은 `3`이다.",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, None, 3]})",
          "print(df['a'].count())"
        ],
        lang: "python",
        answer: false,
        explanation: [
          "**정답: X** `count()`는 [[missing-value|결측값(missing value, NaN)]]을 **제외한** 값의 개수를 돌려준다. `None`은 숫자 컬럼에서 NaN으로 바뀌므로 유효한 값은 1과 3, 두 개다. 출력은 `2`.",
          "",
          "행 수 전체가 필요하면 `len(df)`, `df.shape[0]`, 또는 `df['a'].size`를 쓴다. `groupby().size()`와 `groupby().count()`의 차이도 같은 원리다.",
          "",
          "시험에서는 `count()` vs `len()`/`size`의 차이, `isna().sum()`으로 결측 개수를 세는 코드와 묶어 출제된다."
        ],
        terms: ["missing-value", "descriptive-statistics"]
      },
      {
        id: "a-3-2-q10", node: "a-3-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 메서드 이름을 쓰시오. 각 컬럼의 **dtype, non-null 개수, 메모리 사용량**을 한눈에 요약한다: `df.____()`",
        answer: "info",
        accept: ["info()"],
        explanation: [
          "**정답: info** `df.info()`는 행 수, 컬럼마다의 non-null 개수와 [[dtype|자료형(dtype)]], 메모리 사용량을 출력한다. 결측값이 어느 컬럼에 얼마나 있는지, 숫자처럼 보이는 컬럼이 object로 읽히지 않았는지 확인하는 첫 단계다.",
          "",
          "`describe()`는 통계 요약, `dtypes`는 자료형만, `shape`는 (행, 열) 크기라는 점에서 구분된다.",
          "",
          "시험에서는 `info()` 출력에서 non-null 수를 보고 결측 개수를 계산하게 하거나, `dtypes`와의 차이를 묻는다."
        ],
        terms: ["dtype", "missing-value"]
      },
      {
        id: "a-3-2-q11", node: "a-3-2", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, 2, 3, 4])",
          "print(s[s % 2 == 0].sum())"
        ],
        lang: "python",
        answer: "6",
        explanation: [
          "**정답: 6** `s % 2 == 0`은 `[False, True, False, True]`인 불리언 Series이고, 이를 `s[...]`에 넣는 [[boolean-indexing|불리언 인덱싱(boolean indexing)]]은 True인 위치의 값 2와 4만 남긴다. 합은 6이다.",
          "",
          "벡터화 연산(`s % 2`)이 원소마다 적용되어 같은 길이의 Series가 나온다는 점, 그 결과를 바로 필터 마스크로 쓸 수 있다는 점이 핵심이다.",
          "",
          "시험에서는 마스크 조건을 조금씩 바꿔(`!= 0`, `> 2`) 합이나 개수를 묻는다."
        ],
        terms: ["boolean-indexing", "series"]
      },
      {
        id: "a-3-2-q12", node: "a-3-2", type: "short", kind: "concept", difficulty: 3,
        prompt: "Series의 **각 원소**에 딕셔너리나 함수를 적용해 값을 치환하는 메서드로, 딕셔너리에 없는 값은 NaN이 되는 메서드 이름은? (예: `df['code'] = df['name'].____({'A': 1, 'B': 2})`)",
        answer: "map",
        accept: ["map()", "series.map"],
        explanation: [
          "**정답: map** [[map|Series.map]]은 원소 단위(element-wise) 치환 메서드로 딕셔너리, 함수, Series를 받는다. 딕셔너리에 **없는 키는 NaN**이 되므로 치환 후 결측 여부를 확인해야 한다.",
          "",
          "`apply`도 Series에서는 원소 단위로 동작하지만 딕셔너리를 바로 받지 못하고, DataFrame에서는 컬럼/행 단위로 동작한다는 차이가 있다. 과거 `applymap`은 `DataFrame.map`으로 이름이 바뀌었다.",
          "",
          "시험에서는 `map(dict)` 후 NaN이 생기는 경우와 `replace`(없는 값은 그대로 둠)와의 차이를 묻는다."
        ],
        terms: ["map", "apply", "missing-value"]
      },

      /* ─────────────── a-3-3 Pandas 문법 심화 ─────────────── */
      {
        id: "a-3-3-q01", node: "a-3-3", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'c': ['A', 'B', 'C', 'A']})",
          "print(df['c'].isin(['A', 'C']).sum())"
        ],
        lang: "python",
        choices: ["3", "2", "['A', 'C', 'A']", "True"],
        answer: 0,
        explanation: [
          "**정답: ①** [[isin|isin]]은 각 원소가 주어진 목록에 **포함되는지**를 불리언 Series로 돌려준다. `[True, False, True, True]`에 `.sum()`을 하면 True를 1로 세어 3이 된다.",
          "",
          "- ② 2는 'A'만 세거나 고유값 수를 센 경우다.",
          "- ③ 값 목록은 `df.loc[df['c'].isin([...]), 'c'].tolist()`의 결과다. `isin` 자체는 불리언을 낸다.",
          "- ④ `isin`은 스칼라가 아니라 원소별 불리언 Series를 돌려준다.",
          "",
          "시험에서는 `isin`이 SQL의 `IN`에 대응한다는 점과, 불리언 Series의 `sum()`이 True 개수라는 점을 묶어 묻는다."
        ],
        terms: ["isin"]
      },
      {
        id: "a-3-3-q02", node: "a-3-3", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`np.where(cond, x, y)`에 대한 설명으로 옳은 것은?",
        choices: [
          "조건이 참인 행만 반환하므로 결과 길이가 원본보다 짧아진다",
          "조건이 참인 위치는 `x`, 거짓인 위치는 `y`를 택해 원본과 같은 길이의 배열을 돌려준다",
          "세 개 이상의 조건 분기를 한 번에 처리하기 위한 함수다",
          "결과는 항상 pandas Series로 반환된다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[np-where|np.where]]는 벡터화된 if-else다. 조건 배열과 같은 길이로 `x`/`y` 중 하나를 골라 **numpy 배열**을 만들기 때문에 바로 새 컬럼으로 대입할 수 있다(`df['flag'] = np.where(df['v'] > 0, 'pos', 'neg')`).",
          "",
          "- ① 길이는 줄지 않는다. 행을 걸러내는 것은 불리언 인덱싱 `df[cond]`다.",
          "- ③ 다분기는 [[np-select|np.select]]의 역할이다. `np.where`는 이분기.",
          "- ④ 반환형은 `numpy.ndarray`다. Series로 쓰려면 DataFrame 컬럼에 대입하거나 `pd.Series()`로 감싼다.",
          "",
          "시험에서는 `np.where`(2분기)와 `np.select`(다분기, `default`)의 역할 구분을 묻는다."
        ],
        terms: ["np-where", "np-select"]
      },
      {
        id: "a-3-3-q03", node: "a-3-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'g': ['a', 'a', 'b'], 'v': [1, 3, 5]})",
          "r = df.groupby('g')['v'].agg(['mean', 'count'])",
          "print(r.loc['a', 'mean'], r.shape)"
        ],
        lang: "python",
        choices: ["4.0 (2, 2)", "2.0 (3, 2)", "2.0 (2, 2)", "2 (2, 1)"],
        answer: 2,
        explanation: [
          "**정답: ③** [[groupby|그룹화(groupby)]] 뒤 `agg(['mean', 'count'])`는 **그룹당 1행**, 함수당 1열인 DataFrame을 만든다. 그룹은 a, b 두 개라 shape는 (2, 2), 'a'의 평균은 (1 + 3) / 2 = 2.0이다. [[aggregation|집계(aggregation)]] 결과 길이 = 그룹 수.",
          "",
          "- ① 4.0은 'a' 그룹의 합이다. 평균이 아니다.",
          "- ② (3, 2)는 원본 길이(3)로 착각한 것이다. `transform`이라면 길이 3이 된다.",
          "- ④ `mean`은 float 2.0으로 표시되고, 함수가 둘이라 열도 2개다.",
          "",
          "시험에서는 `agg` 결과의 shape(그룹 수 × 함수 수)와 `transform` 결과의 길이(원본) 차이를 묻는다."
        ],
        terms: ["groupby", "aggregation", "transform"]
      },
      {
        id: "a-3-3-q04", node: "a-3-3", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "`pd.merge(a, b, on='key')`에 대한 설명으로 옳은 것은?",
        choices: [
          "`how`의 기본값은 `'outer'`라서 양쪽의 모든 키가 결과에 남는다",
          "키가 한쪽 테이블에 중복되어도 자동으로 중복이 제거되어 행 수가 보존된다",
          "양쪽에 같은 이름의 비(非)키 컬럼이 있으면 `ValueError`가 난다",
          "`how`의 기본값은 `'inner'`이며, 키가 한쪽에 중복되면 결과 행 수가 원본보다 늘어날 수 있다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[merge|병합(merge)]]의 기본 `how='inner'`는 양쪽에 **모두 있는 키**만 남긴다. 키가 한쪽에 여러 번 나오면 짝이 맞는 행끼리 모두 결합(카티션 곱)되어 행이 증식한다. 이를 막으려면 `validate='one_to_one'`/`'many_to_one'`을 준다.",
          "",
          "- ① 기본값은 `'inner'`다. `'outer'`는 명시해야 한다.",
          "- ② 중복 키는 제거되지 않는다. 오히려 행이 늘어나는 것이 대표 함정이다.",
          "- ③ 같은 이름의 비키 컬럼은 에러가 아니라 `_x`, `_y` 접미사(`suffixes`)가 붙는다.",
          "",
          "시험에서는 `how` 네 종류(inner/left/right/outer)의 결과 행 수와, 키 중복으로 행이 늘어나는 상황을 묻는다."
        ],
        terms: ["merge"]
      },
      {
        id: "a-3-3-q05", node: "a-3-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'x': [1, 2, 3, 4, 5]})",
          "print(df[~(df['x'] < 2) & (df['x'] != 4)]['x'].tolist())"
        ],
        lang: "python",
        choices: ["[1, 4]", "[2, 3, 5]", "[2, 3, 4, 5]", "[3, 5]"],
        answer: 1,
        explanation: [
          "**정답: ②** `~(df['x'] < 2)`는 \"2 미만이 아닌\" 즉 `x >= 2`인 행이고, `&`로 `x != 4`를 결합하면 2, 3, 5가 남는다. `~`(not), `&`(and), `|`(or)는 원소별 논리 연산이며 각 조건을 **괄호**로 감싸는 것이 [[boolean-indexing|불리언 인덱싱(boolean indexing)]]의 규칙이다.",
          "",
          "- ① `[1, 4]`는 전체 조건을 반대로 읽은 결과다(`~` 없이 `<2 | ==4`).",
          "- ③ `[2, 3, 4, 5]`는 `!= 4` 조건을 빠뜨린 경우다.",
          "- ④ `[3, 5]`는 `~(x < 2)`를 `x > 2`로 잘못 읽은 경우다.",
          "",
          "시험에서는 `~`의 적용 범위(괄호 안 전체)와 `&`/`|` 우선순위 함정을 함께 묻는다."
        ],
        terms: ["boolean-indexing", "vectorization"]
      },
      {
        id: "a-3-3-q06", node: "a-3-3", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "90점 이상 'A', 80점 이상 'B', 나머지 'C'를 만들려 했는데 80점 미만 행에 `0`이 들어갔다. 원인과 수정으로 옳은 것은?",
        code: [
          "import numpy as np, pandas as pd",
          "df = pd.DataFrame({'score': [95, 85, 70]})",
          "df['grade'] = np.select([df['score'] >= 90, df['score'] >= 80], ['A', 'B'])",
          "print(df['grade'].tolist())   # ['A', 'B', '0']"
        ],
        lang: "python",
        choices: [
          "조건 리스트와 선택값 리스트의 순서를 서로 바꿔야 한다",
          "`np.select`는 Series를 받지 못하므로 `.values`를 붙여야 한다",
          "`default='C'`를 지정하지 않아 어느 조건에도 해당하지 않는 행이 기본값 0으로 채워졌다",
          "조건이 서로 겹치므로 두 번째 조건을 `(df['score'] >= 80) & (df['score'] < 90)`으로 바꿔야 한다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[np-select|np.select(condlist, choicelist, default=0)]]는 어느 조건도 만족하지 않는 위치에 `default`를 넣는데 기본값이 **0**이다. `default='C'`를 주면 의도대로 'A', 'B', 'C'가 된다.",
          "",
          "- ① 조건과 선택값은 같은 순서로 짝지어져 있어 바꾸면 오히려 틀린다.",
          "- ② `np.select`는 불리언 Series를 그대로 받는다.",
          "- ④ `np.select`는 **첫 번째로 참인 조건**을 택하므로 조건이 겹쳐도 95는 'A'가 된다. 겹침은 문제가 아니다.",
          "",
          "시험에서는 `np.select`의 `default` 누락과 조건 평가 순서(first match wins)를 함께 묻는다."
        ],
        terms: ["np-select", "np-where"]
      },
      {
        id: "a-3-3-q07", node: "a-3-3", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "wide ↔ long 형태 변환(pivot / melt)에 대한 설명으로 옳은 것은?",
        choices: [
          "`melt`는 long → wide, `pivot`은 wide → long 변환이다",
          "`pivot`은 index·columns 조합이 중복되어도 자동으로 평균을 내 준다",
          "`pivot_table`의 `aggfunc` 기본값은 `'sum'`이다",
          "`melt(id_vars=...)`로 길게 푼 데이터는 `pivot(index=..., columns='variable', values='value')`로 다시 넓게 되돌릴 수 있다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[melt|melt]]는 여러 컬럼을 `variable`/`value` 두 컬럼으로 **길게(long)** 푸는 연산이고, [[pivot-table|pivot/pivot_table]]은 반대로 **넓게(wide)** 펼치는 연산이다. 둘은 서로 역변환이라 왕복이 가능하다.",
          "",
          "- ① 방향이 반대다. `melt`가 wide → long, `pivot`이 long → wide.",
          "- ② `pivot`은 조합이 중복되면 `ValueError`를 낸다. 중복을 집계하려면 `pivot_table`.",
          "- ③ `pivot_table`의 `aggfunc` 기본값은 `'mean'`이다.",
          "",
          "시험에서는 `pivot` vs `pivot_table`의 차이(중복 처리·aggfunc)와 `melt`의 `id_vars`/`value_vars` 역할을 묻는다."
        ],
        terms: ["melt", "pivot-table", "aggregation"]
      },
      {
        id: "a-3-3-q08", node: "a-3-3", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df['x'].between(1, 3)`은 기본적으로 양 끝 값 1과 3을 **모두 포함**한다.",
        answer: true,
        explanation: [
          "**정답: O** [[between|between(left, right, inclusive='both')]]의 기본값은 양 끝 포함이다. `(df['x'] >= 1) & (df['x'] <= 3)`과 같다. 끝을 빼려면 `inclusive='neither'`, `'left'`, `'right'`를 준다.",
          "",
          "SQL의 `BETWEEN 1 AND 3` 역시 양 끝을 포함하므로 같은 의미로 대응된다.",
          "",
          "시험에서는 `between`과 `(>=) & (<=)`의 동치, `inclusive` 옵션의 의미를 묻는다."
        ],
        terms: ["between", "isin"]
      },
      {
        id: "a-3-3-q09", node: "a-3-3", type: "ox", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은 `[1.0, 3.0, 5.0, 7.0]`이다.",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, 2, 3, 4])",
          "print(s.rolling(2).sum().tolist())"
        ],
        lang: "python",
        answer: false,
        explanation: [
          "**정답: X** [[window-function|윈도 함수(window function)]] `rolling(2)`는 현재 행과 직전 1행을 묶는데, 첫 행은 창을 채울 수 없어 **NaN**이 된다. 출력은 `[nan, 3.0, 5.0, 7.0]`이다. `min_periods=1`을 주면 첫 행이 1.0으로 나온다.",
          "",
          "`rolling(n)`의 앞 n-1개 NaN, `shift(1)`의 첫 행 NaN, `diff()`의 첫 행 NaN은 모두 같은 원리다.",
          "",
          "시험에서는 `rolling(3).mean()`의 결측 개수(2개)나 `min_periods`의 효과를 묻는다."
        ],
        terms: ["window-function", "missing-value"]
      },
      {
        id: "a-3-3-q10", node: "a-3-3", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 함수 이름을 쓰시오. 여러 컬럼을 `variable`·`value` 두 컬럼으로 풀어 wide → long 으로 바꾼다: `pd.____(df, id_vars='id', var_name='variable', value_name='value')`",
        answer: "melt",
        accept: ["melt()", "pd.melt"],
        explanation: [
          "**정답: melt** [[melt|melt]]는 `id_vars`로 지정한 식별 컬럼은 그대로 두고 나머지 컬럼명을 `var_name` 컬럼의 값으로, 셀 값을 `value_name` 컬럼으로 쌓아 **긴(long) 형태**를 만든다. `df.melt(...)` 메서드 형태로도 쓴다.",
          "",
          "반대 방향(long → wide)은 [[pivot-table|pivot / pivot_table]]이며, `stack`/`unstack`도 인덱스 레벨 기준으로 같은 역할을 한다.",
          "",
          "시험에서는 `melt` 결과의 행 수(원본 행 수 × 녹인 컬럼 수)를 계산하게 한다."
        ],
        terms: ["melt", "pivot-table"]
      },
      {
        id: "a-3-3-q11", node: "a-3-3", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import pandas as pd",
          "d = pd.to_datetime(pd.Series(['2024-01-15', '2024-02-20', '2024-02-05']))",
          "print(d.dt.month.value_counts().max())"
        ],
        lang: "python",
        answer: "2",
        explanation: [
          "**정답: 2** [[dt-accessor|dt 접근자(dt accessor)]] `d.dt.month`는 각 날짜의 월 `[1, 2, 2]`를 뽑고, `value_counts()`는 월별 빈도 {2: 2, 1: 1}을 만든다. 그 최댓값은 2다.",
          "",
          "`.dt`는 datetime 자료형 Series에서만 쓸 수 있으므로 문자열이라면 먼저 `pd.to_datetime`으로 바꿔야 한다. 문자열 메서드는 [[str-accessor|str 접근자]]로 같은 방식이다.",
          "",
          "시험에서는 `dt.year/month/dayofweek`와 `value_counts()`를 묶어 \"가장 많은 월은?\"(`idxmax()`) 또는 그 빈도(`max()`)를 묻는다."
        ],
        terms: ["dt-accessor", "str-accessor"]
      },
      {
        id: "a-3-3-q12", node: "a-3-3", type: "short", kind: "concept", difficulty: 3,
        prompt: "SQL 윈도 함수 `SUM(v) OVER (PARTITION BY g ORDER BY ...)`처럼, 그룹 안에서 **누적합**을 원본 길이로 구하는 groupby 메서드 이름은? (`df.groupby('g')['v'].____()`)",
        answer: "cumsum",
        accept: ["cumsum()"],
        explanation: [
          "**정답: cumsum** `groupby('g')['v'].cumsum()`은 그룹별로 **누적합(cumulative sum)** 을 계산해 원본과 같은 길이로 돌려주는 [[window-function|윈도 함수(window function)]]계열 연산이다. 결과를 바로 새 컬럼으로 대입할 수 있다는 점에서 [[transform|transform]]과 같은 성격이다.",
          "",
          "비슷한 계열로 `cumcount()`(그룹 내 순번), `cummax()`, `shift()`(이전 행), `rank()`가 있다. 정렬이 중요하므로 보통 `sort_values` 뒤에 쓴다.",
          "",
          "시험에서는 SQL 윈도 함수와 pandas 메서드의 대응(`ROW_NUMBER` ↔ `cumcount()+1`, `LAG` ↔ `shift(1)`)을 묻는다."
        ],
        terms: ["window-function", "transform", "groupby"]
      },

      /* ─────────────── a-3-4 Scikit-Learn ─────────────── */
      {
        id: "a-3-4-q01", node: "a-3-4", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "scikit-learn의 `fit` / `transform` / `predict` API에 대한 설명으로 옳은 것은?",
        choices: [
          "변환기(transformer)는 `fit`으로 통계를 학습하고 `transform`으로 데이터를 바꾸며, 모델(estimator)은 `fit` 후 `predict`로 예측한다",
          "`fit_transform`은 테스트 데이터에도 항상 적용해야 한다",
          "`predict`는 `fit`을 호출하지 않아도 동작한다",
          "`StandardScaler().fit(X)`는 변환된 배열을 반환한다"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[fit-transform-predict|fit / transform / predict]]는 모든 scikit-learn 객체가 따르는 통일 API다. `fit`은 데이터에서 필요한 값(평균·표준편차·회귀 계수 등)을 학습해 `mean_`, `coef_`처럼 끝에 `_`가 붙은 속성에 저장하고 **자기 자신**을 돌려준다.",
          "",
          "- ② 테스트 데이터에는 `transform`만 써야 한다. `fit_transform`을 쓰면 테스트 통계로 다시 학습해 [[data-leakage|데이터 누수(leakage)]]가 된다.",
          "- ③ 학습 전에 `predict`를 호출하면 `NotFittedError`가 난다.",
          "- ④ `fit`은 스케일러 객체 자신을 반환한다. 변환된 배열은 `transform` 또는 `fit_transform`의 결과다.",
          "",
          "시험에서는 `fit`의 반환값, `fit_transform` vs `transform`의 사용 위치(학습/테스트)를 묻는다."
        ],
        terms: ["fit-transform-predict", "data-leakage"]
      },
      {
        id: "a-3-4-q02", node: "a-3-4", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`train_test_split`에 대한 설명으로 옳은 것은?",
        choices: [
          "`test_size=0.2`는 학습 데이터의 비율이 20%라는 뜻이다",
          "`stratify=y`를 주면 학습·테스트 세트의 클래스 비율이 원본과 같게 유지된다",
          "`random_state`를 지정하지 않아도 실행마다 같은 분할이 나온다",
          "`shuffle`의 기본값은 `False`라서 데이터 순서대로 앞부분이 학습 세트가 된다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[train-test-split|train_test_split]]의 `stratify=y`는 [[stratified-sampling|층화 추출(stratified sampling)]]로, 클래스 불균형 데이터에서 테스트 세트에 소수 클래스가 거의 없는 상황을 막아 준다.",
          "",
          "- ① `test_size`는 **테스트** 세트 비율이다. 0.2면 테스트 20%, 학습 80%.",
          "- ③ `random_state`를 고정하지 않으면 실행마다 다른 분할이 나온다. 재현에는 고정 필수.",
          "- ④ `shuffle` 기본값은 `True`다. 시계열처럼 순서를 지켜야 할 때만 `shuffle=False`.",
          "",
          "시험에서는 `test_size`, `random_state`, `stratify`의 의미와 반환 순서(`X_train, X_test, y_train, y_test`)를 묻는다."
        ],
        terms: ["train-test-split", "stratified-sampling"]
      },
      {
        id: "a-3-4-q03", node: "a-3-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "from sklearn.preprocessing import StandardScaler",
          "X = np.array([[1.0], [2.0], [3.0]])",
          "sc = StandardScaler().fit(X)",
          "print(sc.mean_[0], round(sc.transform([[4.0]])[0, 0], 2))"
        ],
        lang: "python",
        choices: ["2.0 1.0", "2.0 2.0", "2.0 2.45", "2.0 1.63"],
        answer: 2,
        explanation: [
          "**정답: ③** [[standardization|표준화(standardization)]]는 `(x - mean) / std`다. 평균은 2.0, 표준편차는 **모표준편차**(n으로 나눔) √(2/3) ≈ 0.8165이므로 4.0은 (4 - 2) / 0.8165 ≈ 2.45로 변환된다. 학습된 값은 `mean_`, `scale_` 속성에 저장된다.",
          "",
          "- ① 1.0은 표준편차를 2로 잡은 경우다.",
          "- ② 2.0은 표준편차 1(스케일 없음)로 계산한 경우다.",
          "- ④ 1.63은 표본표준편차(n-1로 나눔, 1.0이 아닌 √1 = 1 → 2.0)와도 맞지 않는 값이다. `StandardScaler`는 `np.std(ddof=0)`을 쓴다.",
          "",
          "시험에서는 `StandardScaler`가 `ddof=0`(모표준편차)을 쓴다는 점과, 새 데이터(4.0)는 학습 통계로만 변환된다는 점을 묻는다."
        ],
        terms: ["standardization", "fit-transform-predict"]
      },
      {
        id: "a-3-4-q04", node: "a-3-4", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "분류 평가지표에 대한 설명으로 옳은 것은?",
        choices: [
          "`precision_score`는 실제 양성 중 양성으로 예측한 비율이다",
          "`confusion_matrix(y_true, y_pred)`의 [0, 0] 위치는 TP(true positive)다",
          "`roc_auc_score`에는 확률이 아니라 `predict`의 0/1 라벨을 넣어야 한다",
          "`f1_score`는 정밀도(precision)와 재현율(recall)의 조화평균이다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[f1-score|F1 점수]]는 [[precision|정밀도(precision)]]와 [[recall|재현율(recall)]]의 조화평균 2PR / (P + R)로, 둘 중 하나만 높아도 점수가 올라가지 않도록 균형을 잡는다.",
          "",
          "- ① \"실제 양성 중 맞춘 비율\"은 재현율(recall)이다. 정밀도는 **예측 양성 중** 실제 양성 비율 TP / (TP + FP).",
          "- ② [[confusion-matrix|혼동행렬]]은 행 = 실제, 열 = 예측이며 라벨 정렬 순(0, 1)이라 [0, 0]은 **TN**이다. TP는 [1, 1].",
          "- ③ [[roc-auc|ROC-AUC]]는 임곗값을 바꾸며 계산하므로 `predict_proba[:, 1]` 같은 점수를 넣어야 한다. 0/1 라벨을 넣으면 임곗값 하나만 반영된다.",
          "",
          "시험에서는 혼동행렬 4칸의 위치, 정밀도/재현율 공식, F1이 조화평균인 이유를 묻는다."
        ],
        terms: ["f1-score", "precision", "recall", "confusion-matrix", "roc-auc"]
      },
      {
        id: "a-3-4-q05", node: "a-3-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "from sklearn.metrics import confusion_matrix, accuracy_score",
          "y_true = [0, 1, 1, 0, 1]",
          "y_pred = [0, 1, 0, 0, 1]",
          "print(confusion_matrix(y_true, y_pred).ravel().tolist(), accuracy_score(y_true, y_pred))"
        ],
        lang: "python",
        choices: ["[2, 1, 0, 2] 0.8", "[2, 0, 1, 2] 0.8", "[2, 0, 1, 2] 0.6", "[0, 2, 2, 1] 0.8"],
        answer: 1,
        explanation: [
          "**정답: ②** [[confusion-matrix|혼동행렬(confusion matrix)]]은 `[[TN, FP], [FN, TP]]` 순서다. 실제 0 두 개는 모두 0으로 예측(TN=2, FP=0), 실제 1 세 개 중 하나를 0으로 놓쳤다(FN=1, TP=2). `ravel()`로 펴면 `[2, 0, 1, 2]`, [[accuracy|정확도(accuracy)]]는 (TN + TP) / 전체 = 4 / 5 = 0.8.",
          "",
          "- ① `[2, 1, 0, 2]`는 FP와 FN을 뒤바꾼 것이다. 놓친 양성(FN)이 1이다.",
          "- ③ 정확도 0.6은 맞춘 수를 3으로 잘못 센 경우다.",
          "- ④ `[0, 2, 2, 1]`은 행·열을 뒤섞은 결과다.",
          "",
          "시험에서는 작은 `y_true`/`y_pred` 리스트에서 혼동행렬 4칸과 accuracy·precision·recall을 손으로 계산하게 한다."
        ],
        terms: ["confusion-matrix", "accuracy", "recall"]
      },
      {
        id: "a-3-4-q06", node: "a-3-4", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 전처리 코드에는 모델 평가를 왜곡하는 문제가 있다. 원인과 수정으로 옳은 것은?",
        code: [
          "from sklearn.preprocessing import StandardScaler",
          "from sklearn.model_selection import train_test_split",
          "sc = StandardScaler()",
          "X_all = sc.fit_transform(X)",
          "X_tr, X_te, y_tr, y_te = train_test_split(X_all, y, test_size=0.2, random_state=0)"
        ],
        lang: "python",
        choices: [
          "문제 없다. 스케일링은 분할 전후 어느 쪽에서 해도 결과가 같다",
          "`fit_transform`을 `transform`으로 바꾸면 해결된다",
          "분할을 먼저 하고, 스케일러는 학습 세트에만 `fit`한 뒤 테스트 세트는 `transform`만 한다",
          "`random_state=0`을 제거해야 한다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** 전체 데이터에 `fit_transform`을 하면 테스트 세트의 평균·표준편차가 스케일러에 반영되어 [[data-leakage|데이터 누수(data leakage)]]가 생긴다. 올바른 순서는 `train_test_split` → `sc.fit_transform(X_tr)` → `sc.transform(X_te)`이며, [[pipeline|Pipeline]]을 쓰면 이 순서가 자동으로 지켜진다.",
          "",
          "- ① 테스트 정보가 학습에 섞이므로 평가가 실제보다 낙관적으로 나온다. 결과가 같지 않다.",
          "- ② 학습되지 않은 스케일러에 `transform`을 호출하면 `NotFittedError`다.",
          "- ④ `random_state`는 재현성을 위한 것이며 누수와 무관하다.",
          "",
          "시험에서는 \"스케일러를 어디에 fit해야 하는가\"(학습 세트만)와 누수의 정의를 묻는다."
        ],
        terms: ["data-leakage", "standardization", "pipeline"]
      },
      {
        id: "a-3-4-q07", node: "a-3-4", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "주요 모델의 하이퍼파라미터(hyperparameter)에 대한 설명으로 옳은 것은?",
        choices: [
          "`RandomForestClassifier`의 `n_estimators`는 각 트리의 최대 깊이를 뜻한다",
          "`LogisticRegression`의 `C`가 클수록 규제(regularization)가 강해진다",
          "`KNeighborsClassifier`의 `n_neighbors`를 1로 두면 과소적합(underfitting)이 가장 심해진다",
          "`DecisionTreeClassifier`의 `max_depth`를 줄이면 모델이 단순해져 과적합(overfitting)이 줄어든다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** 결정 트리의 `max_depth`는 트리가 자랄 수 있는 깊이의 상한이다. 깊이를 줄이면 분기가 줄어 모델이 단순해지고 [[overfitting|과적합(overfitting)]]이 완화된다(대신 너무 줄이면 과소적합). `min_samples_leaf`를 키우는 것도 같은 방향의 [[hyperparameter|하이퍼파라미터]] 조정이다.",
          "",
          "- ① `n_estimators`는 **트리의 개수**다. 깊이는 `max_depth`.",
          "- ② `C`는 [[regularization|규제(regularization)]] 강도의 **역수**다. C가 클수록 규제가 약해져 과적합 쪽으로 간다.",
          "- ③ `n_neighbors=1`은 가장 가까운 한 점만 보므로 **과적합**이 가장 심하다. k를 키울수록 경계가 부드러워진다.",
          "",
          "시험에서는 각 하이퍼파라미터를 키웠을 때 복잡도가 커지는지 작아지는지 방향을 묻는다."
        ],
        terms: ["hyperparameter", "overfitting", "regularization"]
      },
      {
        id: "a-3-4-q08", node: "a-3-4", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`Pipeline`에 `fit`을 호출하면 마지막 단계를 제외한 모든 단계는 `fit_transform`이, 마지막 단계는 `fit`이 실행된다.",
        answer: true,
        explanation: [
          "**정답: O** [[pipeline|Pipeline]]은 (이름, 추정기) 쌍의 목록이다. `fit(X, y)`를 호출하면 앞 단계들은 차례로 `fit_transform`해 다음 단계에 넘기고, 마지막 추정기(모델)만 `fit`한다. `predict(X_te)`를 호출하면 앞 단계들은 `transform`만 수행한다.",
          "",
          "덕분에 스케일러가 테스트 데이터에 다시 `fit`되는 데이터 누수가 구조적으로 막히고, 전체 파이프라인을 `cross_val_score`·`GridSearchCV`에 하나의 모델처럼 넣을 수 있다.",
          "",
          "시험에서는 Pipeline 각 단계에서 호출되는 메서드와, 마지막 단계만 모델이어야 하는 이유를 묻는다."
        ],
        terms: ["pipeline", "fit-transform-predict"]
      },
      {
        id: "a-3-4-q09", node: "a-3-4", type: "ox", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은 `2`이다.",
        code: [
          "from sklearn.model_selection import KFold",
          "kf = KFold(n_splits=4)",
          "print(len(list(kf.split(range(8)))))"
        ],
        lang: "python",
        answer: false,
        explanation: [
          "**정답: X** [[k-fold|K-겹(K-fold)]] `KFold(n_splits=4)`의 `split()`은 **폴드 수만큼** `(train_idx, test_idx)` 쌍을 내므로 리스트 길이는 4다. 8개 데이터를 4겹으로 나누면 각 테스트 폴드의 크기가 2일 뿐이다.",
          "",
          "`KFold`는 기본 `shuffle=False`라 순서대로 자르고, 분류에서는 클래스 비율을 유지하는 `StratifiedKFold`를 쓴다. `cross_val_score(..., cv=4)`의 결과 길이도 4다.",
          "",
          "시험에서는 `n_splits`와 결과 개수의 관계, 테스트 폴드 크기(n / k)를 묻는다."
        ],
        terms: ["k-fold", "cross-validation"]
      },
      {
        id: "a-3-4-q10", node: "a-3-4", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 인자 이름을 쓰시오. 분할 후에도 클래스 비율을 유지한다: `train_test_split(X, y, test_size=0.3, random_state=42, ____=y)`",
        answer: "stratify",
        accept: ["stratify=y"],
        explanation: [
          "**정답: stratify** `stratify=y`는 [[stratified-sampling|층화 추출(stratified sampling)]]로 학습·테스트 세트의 클래스 비율을 원본과 같게 맞춘다. 불균형 데이터에서 테스트 세트에 소수 클래스가 빠지는 것을 막는다.",
          "",
          "`random_state`는 재현성, `test_size`는 테스트 비율, `shuffle`은 섞기 여부로 각각 역할이 다르다. 회귀(연속형 타깃)에는 `stratify`를 쓰지 않는다.",
          "",
          "시험에서는 [[train-test-split|train_test_split]]의 인자 이름을 빈칸으로 묻는다."
        ],
        terms: ["stratified-sampling", "train-test-split"]
      },
      {
        id: "a-3-4-q11", node: "a-3-4", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "from sklearn.metrics import mean_squared_error",
          "y_true = [1, 2, 3]",
          "y_pred = [1, 2, 6]",
          "print(mean_squared_error(y_true, y_pred))"
        ],
        lang: "python",
        answer: "3.0",
        accept: ["3"],
        explanation: [
          "**정답: 3.0** [[mse|평균제곱오차(MSE, mean squared error)]]는 오차의 제곱을 평균한 값이다. 오차는 0, 0, 3이고 제곱은 0, 0, 9이므로 평균은 9 / 3 = 3.0이다. RMSE는 그 제곱근 √3 ≈ 1.73.",
          "",
          "`mean_absolute_error`는 |오차|의 평균 = 1.0, [[r2-score|결정계수(R²)]]는 1 - SSE/SST로 이 예에서는 1 - 9/2 = -3.5가 된다(음수 가능).",
          "",
          "시험에서는 작은 리스트로 MSE·RMSE·MAE를 손계산하게 하거나 `squared=False`/`root_mean_squared_error`로 RMSE를 구하는 코드를 묻는다."
        ],
        terms: ["mse", "r2-score"]
      },
      {
        id: "a-3-4-q12", node: "a-3-4", type: "short", kind: "concept", difficulty: 3,
        prompt: "수치형 컬럼에는 `StandardScaler`, 범주형 컬럼에는 `OneHotEncoder`처럼 **컬럼 그룹별로 다른 변환기**를 적용하는 `sklearn.compose`의 클래스 이름은?",
        answer: "ColumnTransformer",
        accept: ["columntransformer", "sklearn.compose.ColumnTransformer"],
        explanation: [
          "**정답: ColumnTransformer** [[column-transformer|ColumnTransformer]]는 `[(이름, 변환기, 컬럼목록), ...]`을 받아 각 컬럼 그룹에 다른 전처리를 적용하고 결과를 가로로 이어 붙인다. [[one-hot-encoding|원핫 인코딩]]과 [[standardization|표준화]]를 한 번에 처리하는 표준 도구다.",
          "",
          "보통 `Pipeline([('pre', ColumnTransformer(...)), ('model', ...)])`로 묶어 학습·예측·교차검증을 한 객체로 수행한다. 지정하지 않은 컬럼은 기본 `remainder='drop'`으로 버려진다.",
          "",
          "시험에서는 `ColumnTransformer`의 역할과 `remainder` 옵션, `OneHotEncoder(handle_unknown='ignore')`의 의미를 묻는다."
        ],
        terms: ["column-transformer", "one-hot-encoding", "pipeline"]
      }
    ],

    practices: [
      {
        id: "a-3-1-p01", node: "a-3-1",
        title: "Counter 로 최빈 단어 빈도 구하기",
        difficulty: 1,
        task: ["단어 리스트 `words`에서 **가장 많이 등장한 단어의 등장 횟수**를 정수로 입력하시오."],
        setup: [
          "import numpy as np",
          "from collections import Counter",
          "rng = np.random.default_rng(31)",
          "vocab = ['data', 'model', 'train', 'test', 'score', 'split']",
          "words = [str(w) for w in rng.choice(vocab, size=200, p=[0.3, 0.2, 0.15, 0.15, 0.1, 0.1])]",
          "words[:10]"
        ],
        hint: ["`Counter(words).most_common(1)`은 `[(단어, 빈도)]` 형태의 리스트다."],
        answer: { type: "int", value: 65 },
        solution: ["Counter(words).most_common(1)[0][1]"],
        explanation: [
          "[[counter|Counter]]는 원소 빈도를 세는 딕셔너리다. `most_common(1)`은 길이 1의 리스트이고 그 첫 원소가 `(단어, 빈도)` 튜플이므로 `[0][1]`로 빈도를 꺼낸다.",
          "순수 Python으로는 `max(Counter(words).values())` 또는 `defaultdict(int)`로 세어도 같은 값이 나온다."
        ],
        terms: ["counter", "defaultdict"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6" }
      },
      {
        id: "a-3-1-p02", node: "a-3-1",
        title: "defaultdict 로 부서별 평균 급여의 최댓값",
        difficulty: 2,
        task: ["`records`는 `(이름, 부서, 급여)` 튜플의 리스트다. `defaultdict(list)`로 부서별 급여를 모은 뒤 **부서별 평균 급여 중 최댓값**을 소수 둘째 자리까지 반올림해 입력하시오."],
        setup: [
          "import numpy as np",
          "from collections import defaultdict",
          "rng = np.random.default_rng(32)",
          "depts = ['Sales', 'Dev', 'HR', 'Ops']",
          "records = [(f'emp{i:03d}', str(rng.choice(depts)), int(rng.integers(3000, 8000))) for i in range(60)]",
          "records[:3]"
        ],
        hint: [
          "`for name, dept, sal in records:` 로 튜플을 언패킹한다.",
          "딕셔너리 컴프리헨션 `{d: sum(v) / len(v) for d, v in by.items()}` 뒤에 `max(...values())`."
        ],
        answer: { type: "number", value: 5887.47, decimals: 2 },
        solution: [
          "by = defaultdict(list)",
          "for name, dept, sal in records:",
          "    by[dept].append(sal)",
          "means = {d: sum(v) / len(v) for d, v in by.items()}",
          "round(max(means.values()), 2)"
        ],
        explanation: [
          "[[defaultdict|defaultdict(list)]]는 처음 보는 부서 키에도 빈 리스트를 자동으로 만들어 주므로 `if dept not in by` 검사가 필요 없다.",
          "부서별 평균은 [[list-comprehension|딕셔너리 컴프리헨션]]으로 한 줄에 만들고, `max()`로 최댓값을 고른다. pandas로는 `df.groupby('dept')['salary'].mean().max()`와 같은 계산이다."
        ],
        terms: ["defaultdict", "list-comprehension", "bankers-rounding"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6" }
      },
      {
        id: "a-3-2-p01", node: "a-3-2",
        title: "iris 에서 품종별 필터 후 평균",
        difficulty: 1,
        task: ["`df`에서 `target`이 0인 행만 골라 `petal length (cm)` 컬럼의 **평균**을 소수 둘째 자리까지 반올림해 입력하시오."],
        setup: [
          "import pandas as pd",
          "from sklearn.datasets import load_iris",
          "iris = load_iris(as_frame=True)",
          "df = iris.frame            # 4개 특성 + target 컬럼",
          "df.head()"
        ],
        hint: ["불리언 인덱싱 `df[df['target'] == 0]` 뒤에 컬럼을 고르고 `.mean()`."],
        answer: { type: "number", value: 1.46, decimals: 2 },
        solution: ["round(df[df['target'] == 0]['petal length (cm)'].mean(), 2)"],
        explanation: [
          "[[boolean-indexing|불리언 인덱싱]]으로 행을 걸러낸 뒤 컬럼 하나를 선택하면 [[series|Series]]가 되고, `mean()`은 스칼라를 돌려준다.",
          "`df.loc[df['target'] == 0, 'petal length (cm)'].mean()`처럼 `loc`에 조건과 컬럼을 함께 쓰는 형태도 같은 결과다."
        ],
        terms: ["boolean-indexing", "series", "loc-iloc"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / sklearn 1.9.1" }
      },
      {
        id: "a-3-2-p02", node: "a-3-2",
        title: "wine 에서 조건 필터·정렬 후 통계",
        difficulty: 2,
        task: ["`df`에서 `alcohol`이 13 **초과**인 행만 골라 `color_intensity`의 **평균**을 소수 둘째 자리까지 반올림해 입력하시오."],
        setup: [
          "import pandas as pd",
          "from sklearn.datasets import load_wine",
          "wine = load_wine(as_frame=True)",
          "df = wine.frame",
          "df.shape"
        ],
        hint: ["`df.loc[df['alcohol'] > 13, 'color_intensity'].mean()`"],
        answer: { type: "number", value: 6.47, decimals: 2 },
        solution: ["round(df.loc[df['alcohol'] > 13, 'color_intensity'].mean(), 2)"],
        explanation: [
          "[[loc-iloc|loc]]의 첫 인수에 불리언 조건, 둘째 인수에 컬럼명을 넣으면 필터와 선택을 한 번에 한다.",
          "`df[df['alcohol'] > 13]['color_intensity'].mean()`도 같은 값이다. [[descriptive-statistics|기초 통계]] 메서드는 결측값을 자동으로 제외한다."
        ],
        terms: ["loc-iloc", "boolean-indexing", "descriptive-statistics"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / sklearn 1.9.1" }
      },
      {
        id: "a-3-3-p01", node: "a-3-3",
        title: "isin · between 다중 조건 행 수",
        difficulty: 1,
        task: ["`df`에서 `region`이 'East' 또는 'West'이고, `amount`가 100 이상 200 이하(양 끝 포함)인 **행의 수**를 정수로 입력하시오."],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(33)",
          "df = pd.DataFrame({",
          "    'region': rng.choice(['East', 'West', 'North', 'South'], size=300),",
          "    'month': rng.integers(1, 7, size=300),",
          "    'amount': rng.integers(50, 300, size=300),",
          "})",
          "df.head()"
        ],
        hint: ["`df['region'].isin([...]) & df['amount'].between(100, 200)` 을 마스크로 쓴다."],
        answer: { type: "int", value: 59 },
        solution: ["int((df['region'].isin(['East', 'West']) & df['amount'].between(100, 200)).sum())"],
        explanation: [
          "[[isin|isin]]은 SQL `IN`, [[between|between]]은 SQL `BETWEEN`(양 끝 포함)에 대응한다. 두 불리언 Series를 `&`로 결합하면 원소별 AND가 된다.",
          "불리언 Series의 `sum()`은 True의 개수다. `len(df[mask])`로도 같은 값이 나온다."
        ],
        terms: ["isin", "between", "boolean-indexing"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-3-3-p02", node: "a-3-3",
        title: "pivot_table 지역×월 합계의 최댓값",
        difficulty: 2,
        task: ["`df`를 행 `region`, 열 `month`, 값 `amount`의 **합계**로 피벗(pivot_table)한 뒤, 표의 모든 셀 중 **최댓값**을 정수로 입력하시오."],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(33)",
          "df = pd.DataFrame({",
          "    'region': rng.choice(['East', 'West', 'North', 'South'], size=300),",
          "    'month': rng.integers(1, 7, size=300),",
          "    'amount': rng.integers(50, 300, size=300),",
          "})",
          "df.head()"
        ],
        hint: [
          "`pd.pivot_table(df, index='region', columns='month', values='amount', aggfunc='sum')`",
          "DataFrame 전체의 최댓값은 `.max().max()` 또는 `.to_numpy().max()`."
        ],
        answer: { type: "int", value: 3012 },
        solution: [
          "pt = pd.pivot_table(df, index='region', columns='month', values='amount', aggfunc='sum')",
          "int(pt.to_numpy().max())"
        ],
        explanation: [
          "[[pivot-table|pivot_table]]은 두 키(region, month)로 [[aggregation|집계]]해 교차표를 만든다. `aggfunc` 기본값은 `'mean'`이므로 합계는 `'sum'`을 명시해야 한다.",
          "`pt.max()`는 열별 최댓값 Series이므로 한 번 더 `.max()`를 해야 스칼라가 된다. 같은 값은 `df.groupby(['region', 'month'])['amount'].sum().max()`로도 구할 수 있다."
        ],
        terms: ["pivot-table", "aggregation", "groupby"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-3-4-p01", node: "a-3-4",
        title: "iris KNN 분류 정확도",
        difficulty: 1,
        task: ["`X_tr, y_tr`로 `KNeighborsClassifier(n_neighbors=5)`를 학습하고, `X_te`에 대한 예측의 **정확도(accuracy)** 를 소수 둘째 자리까지 반올림해 입력하시오."],
        setup: [
          "from sklearn.datasets import load_iris",
          "from sklearn.model_selection import train_test_split",
          "from sklearn.neighbors import KNeighborsClassifier",
          "from sklearn.metrics import accuracy_score",
          "X, y = load_iris(return_X_y=True)",
          "X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)",
          "X_tr.shape, X_te.shape"
        ],
        hint: ["`model.fit(X_tr, y_tr)` → `accuracy_score(y_te, model.predict(X_te))`"],
        answer: { type: "number", value: 0.91, decimals: 2 },
        solution: [
          "knn = KNeighborsClassifier(n_neighbors=5).fit(X_tr, y_tr)",
          "round(accuracy_score(y_te, knn.predict(X_te)), 2)"
        ],
        explanation: [
          "[[fit-transform-predict|fit → predict]] 두 단계가 모든 모델의 공통 흐름이다. `fit`은 모델 자신을 반환하므로 `.fit(...)` 뒤에 바로 변수에 받을 수 있다.",
          "[[accuracy|정확도]]는 `model.score(X_te, y_te)`로도 같은 값이 나온다. `stratify=y`와 `random_state=42`를 고정했기 때문에 분할이 재현된다."
        ],
        terms: ["fit-transform-predict", "accuracy", "train-test-split"],
        verified: { by: "python", at: "2026-10-04", env: "sklearn 1.9.1" }
      },
      {
        id: "a-3-4-p02", node: "a-3-4",
        title: "Pipeline + 교차검증 평균 정확도",
        difficulty: 2,
        task: ["`StandardScaler` → `LogisticRegression(max_iter=1000)` 순서의 `Pipeline`을 만들고, 주어진 `cv`로 `cross_val_score`를 수행해 **5개 폴드 정확도의 평균**을 소수 둘째 자리까지 반올림해 입력하시오."],
        setup: [
          "from sklearn.datasets import load_breast_cancer",
          "from sklearn.pipeline import Pipeline",
          "from sklearn.preprocessing import StandardScaler",
          "from sklearn.linear_model import LogisticRegression",
          "from sklearn.model_selection import cross_val_score, StratifiedKFold",
          "X, y = load_breast_cancer(return_X_y=True)",
          "cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)",
          "X.shape"
        ],
        hint: [
          "`Pipeline([('sc', StandardScaler()), ('lr', LogisticRegression(max_iter=1000))])`",
          "`cross_val_score(pipe, X, y, cv=cv)`는 길이 5의 배열이다. `.mean()`."
        ],
        answer: { type: "number", value: 0.98, decimals: 2 },
        solution: [
          "pipe = Pipeline([('sc', StandardScaler()), ('lr', LogisticRegression(max_iter=1000))])",
          "scores = cross_val_score(pipe, X, y, cv=cv)",
          "round(scores.mean(), 2)"
        ],
        explanation: [
          "[[pipeline|Pipeline]]을 [[cross-validation|교차검증]]에 넣으면 폴드마다 스케일러가 **학습 폴드에만** `fit`되어 [[data-leakage|데이터 누수]] 없이 평가된다. 스케일러를 밖에서 전체 X에 적용하면 누수다.",
          "`StratifiedKFold(shuffle=True, random_state=0)`로 폴드를 고정했으므로 결과가 재현된다. 반올림 자릿수(2자리)는 라이브러리 버전 간 미세한 수치 차이를 흡수하기 위한 것이다."
        ],
        terms: ["pipeline", "cross-validation", "k-fold", "data-leakage"],
        verified: { by: "python", at: "2026-10-04", env: "sklearn 1.9.1" }
      }
    ],

    terms: [
      /* Python */
      { id: "mutability", ko: "가변성 / 불변성", en: "mutable / immutable",
        def: "객체를 만든 뒤 내용을 바꿀 수 있으면 가변(mutable: 리스트·딕셔너리·셋), 없으면 불변(immutable: 숫자·문자열·튜플). 불변 객체의 연산은 항상 새 객체를 만든다.",
        nodes: ["a-3-1"], related: ["shallow-copy", "identity", "mutable-default-argument"] },
      { id: "shallow-copy", ko: "얕은 복사", en: "shallow copy",
        def: "컨테이너의 바깥 껍데기만 새로 만들고 안의 원소는 원본과 같은 객체를 참조하는 복사. lst[:], lst.copy(), list(lst), copy.copy()가 해당한다.",
        nodes: ["a-3-1"], related: ["deep-copy", "mutability"] },
      { id: "deep-copy", ko: "깊은 복사", en: "deep copy",
        def: "중첩된 내부 객체까지 재귀적으로 전부 새로 만드는 복사. copy.deepcopy()로 수행하며 원본과 완전히 독립된다.",
        nodes: ["a-3-1"], related: ["shallow-copy"] },
      { id: "identity", ko: "동일성 (is) vs 동등성 (==)", en: "identity (is) / equality (==)",
        def: "is는 두 이름이 메모리상 같은 객체를 가리키는지(identity), ==는 두 객체의 값이 같은지(equality)를 비교한다. None 비교는 is None을 쓴다.",
        nodes: ["a-3-1"], related: ["mutability"] },
      { id: "lambda", ko: "람다 함수", en: "lambda",
        def: "이름 없이 한 줄로 정의하는 익명 함수. lambda 인자: 표현식 형태이며 sorted의 key, map, filter의 인자로 자주 쓴다.",
        nodes: ["a-3-1", "a-3-2"], related: ["list-comprehension", "apply"] },
      { id: "list-comprehension", ko: "컴프리헨션", en: "list / dict / set comprehension",
        def: "반복문과 조건을 대괄호·중괄호 안에 한 줄로 써서 리스트·딕셔너리·셋을 만드는 문법. 소괄호 형태는 제너레이터 표현식이다.",
        nodes: ["a-3-1"], related: ["generator", "lambda"] },
      { id: "slicing", ko: "슬라이싱", en: "slicing",
        def: "시퀀스에서 [start:stop:step]으로 부분을 잘라내는 연산. stop은 포함하지 않으며 음수 인덱스와 step=-1(역순)을 쓸 수 있다.",
        nodes: ["a-3-1"], related: ["loc-iloc"] },
      { id: "generator", ko: "제너레이터", en: "generator",
        def: "yield 문이나 제너레이터 표현식으로 만들어 값을 요청 시마다 하나씩 지연 생성하는 이터레이터. 한 번 소진되면 다시 순회할 수 없고 len()이 없다.",
        nodes: ["a-3-1"], related: ["list-comprehension"] },
      { id: "counter", ko: "카운터", en: "collections.Counter",
        def: "반복 가능 객체의 원소 빈도를 세는 dict 서브클래스. most_common(n)으로 상위 n개를 (원소, 빈도) 튜플 리스트로 돌려준다.",
        nodes: ["a-3-1"], related: ["defaultdict"] },
      { id: "defaultdict", ko: "디폴트딕트", en: "collections.defaultdict",
        def: "없는 키에 접근하면 지정한 팩토리 함수(list, int 등)로 기본값을 자동 생성하는 dict 서브클래스. 그룹별 모으기·빈도 세기에 쓴다.",
        nodes: ["a-3-1"], related: ["counter"] },
      { id: "mutable-default-argument", ko: "가변 기본 인자 함정", en: "mutable default argument",
        def: "함수의 기본 인자는 정의 시 한 번만 평가되므로 def f(x, acc=[])처럼 가변 객체를 기본값으로 두면 호출 간에 공유되는 함정. acc=None 후 함수 안에서 생성하는 것이 관례다.",
        nodes: ["a-3-1"], related: ["mutability"] },
      { id: "bankers-rounding", ko: "은행가 반올림 (짝수 반올림)", en: "banker's rounding / round half to even",
        def: "정확히 .5인 값을 가장 가까운 짝수로 보내는 반올림 규칙. Python round()와 numpy round가 이 규칙을 따라 round(2.5) == 2가 된다.",
        nodes: ["a-3-1"], related: ["floor-division"] },
      { id: "floor-division", ko: "정수 나눗셈 (내림)", en: "floor division //",
        def: "나눗셈 결과를 음의 무한대 방향으로 내림한 정수를 돌려주는 연산자 //. -7 // 2는 -4이고 나머지 %는 제수와 같은 부호를 가진다.",
        nodes: ["a-3-1"], related: ["bankers-rounding"] },
      { id: "enumerate", ko: "이뉴머레이트", en: "enumerate",
        def: "반복 가능 객체를 순회하면서 (인덱스, 값) 튜플을 차례로 내는 내장 함수. start 인자로 시작 번호를 바꿀 수 있다.",
        nodes: ["a-3-1"], related: ["generator"] },

      /* Pandas 기본 */
      { id: "dataframe", ko: "데이터프레임", en: "DataFrame",
        def: "행 인덱스와 열 이름을 가진 2차원 표 형태의 pandas 자료구조. 각 열은 Series이며 열마다 다른 dtype을 가질 수 있다.",
        nodes: ["a-3-2"], related: ["series", "dtype"] },
      { id: "series", ko: "시리즈", en: "Series",
        def: "인덱스가 붙은 1차원 pandas 자료구조. DataFrame의 한 열이 Series이며 인덱스와 값이 항상 쌍으로 움직인다.",
        nodes: ["a-3-2"], related: ["dataframe"] },
      { id: "loc-iloc", ko: "라벨/위치 인덱싱", en: "loc / iloc",
        def: "loc은 행·열 라벨로 선택하며 슬라이스 끝을 포함하고, iloc은 정수 위치로 선택하며 슬라이스 끝을 포함하지 않는다. 형식은 df.loc[행, 열].",
        nodes: ["a-3-2"], related: ["boolean-indexing", "slicing"] },
      { id: "boolean-indexing", ko: "불리언 인덱싱", en: "boolean indexing / boolean mask",
        def: "조건식으로 만든 True/False Series를 df[mask]에 넣어 True인 행만 고르는 필터 방식. 여러 조건은 &, |, ~와 괄호로 결합한다.",
        nodes: ["a-3-2", "a-3-3"], related: ["loc-iloc", "isin", "between"] },
      { id: "apply", ko: "apply (함수 적용)", en: "apply",
        def: "DataFrame의 각 열(axis=0, 기본) 또는 각 행(axis=1)에 함수를 적용하는 메서드. Series.apply는 원소 단위로 동작한다.",
        nodes: ["a-3-2"], related: ["map", "lambda", "vectorization"] },
      { id: "map", ko: "map (원소 치환)", en: "Series.map",
        def: "Series의 각 원소에 딕셔너리·함수·Series를 적용해 값을 치환하는 메서드. 딕셔너리에 없는 값은 NaN이 된다. DataFrame.map(구 applymap)은 모든 셀에 적용한다.",
        nodes: ["a-3-2"], related: ["apply", "missing-value"] },
      { id: "inplace", ko: "inplace (제자리 수정)", en: "inplace=True",
        def: "pandas 메서드가 새 객체를 반환하는 대신 원본을 직접 수정하도록 하는 옵션. inplace=True이면 반환값이 None이라 메서드 체이닝이 끊긴다.",
        nodes: ["a-3-2"], related: ["method-chaining"] },
      { id: "reset-index", ko: "인덱스 재설정", en: "reset_index / set_index",
        def: "reset_index()는 현재 인덱스를 일반 컬럼으로 되돌리고 0부터 시작하는 정수 인덱스를 새로 단다(drop=True면 버림). set_index(col)은 반대로 컬럼을 인덱스로 올린다.",
        nodes: ["a-3-2"], related: ["groupby", "dataframe"] },
      { id: "missing-value", ko: "결측값", en: "missing value / NaN",
        def: "관측되지 않아 비어 있는 값. pandas에서는 NaN(또는 None, NaT)으로 표현되며 count()·mean() 등 통계에서 자동 제외되고 isna()로 탐지한다.",
        nodes: ["a-3-2", "a-3-3"], related: ["imputation"] },
      { id: "descriptive-statistics", ko: "기초 통계 (요약 통계)", en: "descriptive statistics / describe",
        def: "평균·중위수·표준편차·최솟값·최댓값·사분위수 등 데이터 분포를 요약하는 통계량. pandas의 describe(), mean(), median(), std(), count() 등으로 구한다.",
        nodes: ["a-3-2"], related: ["missing-value"] },
      { id: "dtype", ko: "자료형", en: "dtype",
        def: "Series/열의 원소 자료형(int64, float64, bool, datetime64, object, category 등). df.dtypes·df.info()로 확인하고 astype()으로 바꾼다.",
        nodes: ["a-3-2"], related: ["dataframe"] },

      /* Pandas 심화 */
      { id: "groupby", ko: "그룹화", en: "groupby / group-by",
        def: "키 컬럼 값이 같은 행끼리 묶어 각 묶음에 함수를 적용하는 연산. 분할-적용-결합 패턴의 구현.",
        nodes: ["a-3-3"], related: ["aggregation", "transform"] },
      { id: "aggregation", ko: "집계", en: "aggregation / agg",
        def: "여러 값을 하나의 대표값(합·평균·개수 등)으로 줄이는 연산. 그룹당 결과가 하나다.",
        nodes: ["a-3-3"], related: ["groupby", "transform"] },
      { id: "transform", ko: "변환", en: "transform",
        def: "그룹별 계산 결과를 원본과 같은 길이로 돌려주는 groupby 메서드. 그룹 통계를 각 행에 붙일 때 쓴다.",
        nodes: ["a-3-3"], related: ["aggregation", "window-function"] },
      { id: "np-where", ko: "조건 분기 (np.where)", en: "np.where(cond, x, y)",
        def: "조건이 참인 위치는 x, 거짓인 위치는 y를 택해 조건과 같은 길이의 numpy 배열을 돌려주는 벡터화된 if-else. 이분기 조건 컬럼을 만들 때 쓴다.",
        nodes: ["a-3-3"], related: ["np-select", "vectorization"] },
      { id: "np-select", ko: "다분기 조건 (np.select)", en: "np.select(condlist, choicelist, default)",
        def: "여러 조건 리스트 중 첫 번째로 참인 조건에 대응하는 값을 택하는 numpy 함수. 어느 조건도 참이 아니면 default(기본 0)를 넣는다.",
        nodes: ["a-3-3"], related: ["np-where"] },
      { id: "isin", ko: "포함 여부 (isin)", en: "isin",
        def: "각 원소가 주어진 값 목록에 포함되는지를 불리언 Series로 돌려주는 메서드. SQL의 IN에 대응한다.",
        nodes: ["a-3-3"], related: ["between", "boolean-indexing"] },
      { id: "between", ko: "범위 조건 (between)", en: "between(left, right)",
        def: "각 원소가 left 이상 right 이하(기본 inclusive='both')인지 불리언 Series로 돌려주는 메서드. SQL의 BETWEEN에 대응한다.",
        nodes: ["a-3-3"], related: ["isin", "boolean-indexing"] },
      { id: "pivot-table", ko: "피벗 테이블", en: "pivot table / pivot_table",
        def: "행 키와 열 키 두 축으로 값을 집계해 교차표 형태로 만드는 연산.",
        nodes: ["a-3-3"], related: ["aggregation", "melt"] },
      { id: "melt", ko: "멜트 (wide → long)", en: "melt",
        def: "여러 열을 variable(열 이름)·value(값) 두 열로 쌓아 넓은(wide) 표를 긴(long) 표로 바꾸는 연산. pivot의 역변환이다.",
        nodes: ["a-3-3"], related: ["pivot-table"] },
      { id: "window-function", ko: "윈도 함수", en: "window function (rolling / shift / cumsum)",
        def: "행 수를 줄이지 않고 각 행 주변 또는 그룹 내 누적 범위의 값으로 계산하는 연산. pandas의 rolling, shift, diff, cumsum, rank가 해당한다.",
        nodes: ["a-3-3"], related: ["transform", "groupby"] },
      { id: "merge", ko: "병합 (조인)", en: "merge / join",
        def: "두 DataFrame을 공통 키 컬럼으로 가로로 결합하는 연산. how(inner·left·right·outer)로 남길 키를 정하며 기본은 inner다.",
        nodes: ["a-3-3"], related: ["groupby"] },
      { id: "method-chaining", ko: "메서드 체이닝", en: "method chaining",
        def: "새 객체를 반환하는 메서드를 점(.)으로 연달아 호출해 전처리 단계를 한 표현식으로 잇는 스타일. inplace=True와는 함께 쓸 수 없다.",
        nodes: ["a-3-3"], related: ["inplace"] },
      { id: "vectorization", ko: "벡터화", en: "vectorization",
        def: "Python 반복문 대신 배열 전체에 한 번에 적용되는 numpy/pandas 연산을 쓰는 방식. 원소별 루프나 apply보다 훨씬 빠르다.",
        nodes: ["a-3-3"], related: ["apply", "np-where"] },
      { id: "str-accessor", ko: "문자열 접근자", en: "str accessor (Series.str)",
        def: "문자열 Series에 원소별 문자열 메서드(split, contains, replace, upper 등)를 벡터화해 적용하는 접근자. s.str.split('_').str[0]처럼 결과에 다시 인덱싱할 수 있다.",
        nodes: ["a-3-3"], related: ["dt-accessor"] },
      { id: "dt-accessor", ko: "날짜 접근자", en: "dt accessor (Series.dt)",
        def: "datetime 자료형 Series에서 year, month, day, dayofweek 등 날짜 구성요소를 벡터화해 꺼내는 접근자. 문자열은 먼저 pd.to_datetime으로 바꿔야 한다.",
        nodes: ["a-3-3"], related: ["str-accessor"] },

      /* Scikit-Learn */
      { id: "fit-transform-predict", ko: "추정기 API (fit / transform / predict)", en: "fit / transform / predict",
        def: "scikit-learn 객체의 공통 인터페이스. fit은 데이터에서 파라미터를 학습하고 자기 자신을 반환하며, 변환기는 transform으로 데이터를 바꾸고 모델은 predict로 예측한다.",
        nodes: ["a-3-4"], related: ["pipeline", "data-leakage"] },
      { id: "train-test-split", ko: "학습/테스트 분할", en: "train_test_split",
        def: "데이터를 학습 세트와 테스트 세트로 무작위 분할하는 함수. test_size로 비율, random_state로 재현성, stratify로 클래스 비율 유지를 지정한다.",
        nodes: ["a-3-4"], related: ["stratified-sampling", "cross-validation"] },
      { id: "stratified-sampling", ko: "층화 추출", en: "stratified sampling / stratify",
        def: "분할 후 각 세트의 클래스 비율이 원본과 같도록 클래스별로 나눠 추출하는 방법. train_test_split의 stratify=y, StratifiedKFold가 해당한다.",
        nodes: ["a-3-4"], related: ["train-test-split", "k-fold"] },
      { id: "standardization", ko: "표준화", en: "standardization / StandardScaler",
        def: "각 특성을 (x - 평균) / 표준편차로 바꿔 평균 0, 표준편차 1로 맞추는 스케일링. StandardScaler는 학습 세트에만 fit해야 한다.",
        nodes: ["a-3-4"], related: ["min-max-scaling", "data-leakage"] },
      { id: "min-max-scaling", ko: "최소-최대 정규화", en: "min-max scaling / MinMaxScaler",
        def: "각 특성을 (x - 최솟값) / (최댓값 - 최솟값)으로 바꿔 0~1 범위로 맞추는 스케일링. 이상치에 민감하다.",
        nodes: ["a-3-4"], related: ["standardization"] },
      { id: "one-hot-encoding", ko: "원핫 인코딩", en: "one-hot encoding / OneHotEncoder",
        def: "범주형 변수를 범주마다 0/1 더미 열로 펼치는 인코딩. sklearn OneHotEncoder(2차원 입력) 또는 pd.get_dummies로 수행한다.",
        nodes: ["a-3-4"], related: ["label-encoding", "column-transformer"] },
      { id: "label-encoding", ko: "라벨 인코딩", en: "label encoding / LabelEncoder",
        def: "범주를 0, 1, 2… 정수로 바꾸는 인코딩. sklearn LabelEncoder는 1차원 타깃(y)용이며 순서가 없는 입력 특성에는 원핫 인코딩이 적절하다.",
        nodes: ["a-3-4"], related: ["one-hot-encoding"] },
      { id: "imputation", ko: "결측값 대치", en: "imputation / SimpleImputer",
        def: "결측값을 평균·중위수·최빈값 등 추정값으로 채우는 전처리. SimpleImputer(strategy='mean'|'median'|'most_frequent')로 수행하며 학습 세트 통계로 fit한다.",
        nodes: ["a-3-4"], related: ["missing-value", "data-leakage"] },
      { id: "column-transformer", ko: "컬럼 변환기", en: "ColumnTransformer",
        def: "컬럼 그룹마다 다른 변환기(수치형 스케일러, 범주형 인코더 등)를 적용하고 결과를 이어 붙이는 sklearn.compose 클래스. 지정하지 않은 컬럼은 remainder로 처리한다.",
        nodes: ["a-3-4"], related: ["pipeline", "one-hot-encoding"] },
      { id: "pipeline", ko: "파이프라인", en: "Pipeline",
        def: "여러 전처리 단계와 마지막 모델을 하나의 추정기로 묶는 sklearn 클래스. fit 시 앞 단계는 fit_transform, 마지막 단계는 fit이 실행되어 데이터 누수를 구조적으로 막는다.",
        nodes: ["a-3-4"], related: ["column-transformer", "cross-validation", "data-leakage"] },
      { id: "hyperparameter", ko: "하이퍼파라미터", en: "hyperparameter",
        def: "학습으로 정해지는 파라미터와 달리 사람이 학습 전에 지정하는 설정값(max_depth, n_estimators, C, n_neighbors 등). GridSearchCV 등으로 탐색한다.",
        nodes: ["a-3-4"], related: ["grid-search", "overfitting", "regularization"] },
      { id: "overfitting", ko: "과적합", en: "overfitting",
        def: "모델이 학습 데이터의 잡음까지 외워 학습 성능은 높지만 새 데이터에서 성능이 떨어지는 현상. 모델 단순화·규제·더 많은 데이터로 완화한다.",
        nodes: ["a-3-4"], related: ["regularization", "hyperparameter", "cross-validation"] },
      { id: "regularization", ko: "규제", en: "regularization",
        def: "손실 함수에 계수 크기에 대한 벌점을 더해 모델 복잡도를 억제하는 기법. LogisticRegression·SVM의 C는 규제 강도의 역수다.",
        nodes: ["a-3-4"], related: ["overfitting", "hyperparameter"] },
      { id: "accuracy", ko: "정확도", en: "accuracy",
        def: "전체 예측 중 맞게 예측한 비율 (TP + TN) / 전체. 클래스가 불균형하면 높아도 의미가 작을 수 있다.",
        nodes: ["a-3-4"], related: ["precision", "recall", "confusion-matrix"] },
      { id: "precision", ko: "정밀도", en: "precision",
        def: "양성으로 예측한 것 중 실제 양성의 비율 TP / (TP + FP). 거짓 양성(FP)을 줄이는 것이 중요할 때 본다.",
        nodes: ["a-3-4"], related: ["recall", "f1-score"] },
      { id: "recall", ko: "재현율 (민감도)", en: "recall / sensitivity",
        def: "실제 양성 중 양성으로 맞게 예측한 비율 TP / (TP + FN). 놓치는 양성(FN)을 줄이는 것이 중요할 때 본다.",
        nodes: ["a-3-4"], related: ["precision", "f1-score"] },
      { id: "f1-score", ko: "F1 점수", en: "F1 score",
        def: "정밀도와 재현율의 조화평균 2PR / (P + R). 두 지표가 모두 높을 때만 높아져 불균형 데이터 평가에 쓴다.",
        nodes: ["a-3-4"], related: ["precision", "recall"] },
      { id: "roc-auc", ko: "ROC-AUC", en: "ROC curve / AUC",
        def: "임곗값을 바꾸며 그린 ROC 곡선(FPR 대 TPR) 아래 면적. 1에 가까울수록 좋고 0.5는 무작위 수준이며, 예측 확률(점수)을 입력으로 계산한다.",
        nodes: ["a-3-4"], related: ["recall", "confusion-matrix"] },
      { id: "confusion-matrix", ko: "혼동행렬", en: "confusion matrix",
        def: "실제 클래스(행)와 예측 클래스(열)의 조합별 개수를 담은 표. 이진 분류에서 sklearn 출력은 [[TN, FP], [FN, TP]] 순서다.",
        nodes: ["a-3-4"], related: ["accuracy", "precision", "recall"] },
      { id: "mse", ko: "평균제곱오차", en: "MSE (mean squared error) / RMSE",
        def: "회귀 예측 오차의 제곱을 평균한 값. 제곱근을 취한 RMSE는 타깃과 같은 단위를 가진다.",
        nodes: ["a-3-4"], related: ["r2-score"] },
      { id: "r2-score", ko: "결정계수", en: "R² score / coefficient of determination",
        def: "모델이 타깃 분산을 설명하는 비율 1 - SSE / SST. 1이 완벽, 0은 평균 예측 수준이며 음수도 가능하다.",
        nodes: ["a-3-4"], related: ["mse"] },
      { id: "cross-validation", ko: "교차검증", en: "cross-validation / cross_val_score",
        def: "데이터를 k개 폴드로 나눠 각 폴드를 한 번씩 테스트로 쓰며 k번 학습·평가해 성능을 평균하는 방법. 분할 하나에 의존하는 평가의 불안정성을 줄인다.",
        nodes: ["a-3-4"], related: ["k-fold", "grid-search", "overfitting"] },
      { id: "k-fold", ko: "K-겹 분할", en: "KFold / StratifiedKFold",
        def: "데이터를 k개의 폴드로 나누는 교차검증 분할기. StratifiedKFold는 각 폴드의 클래스 비율을 원본과 같게 유지하며 분류의 기본이다.",
        nodes: ["a-3-4"], related: ["cross-validation", "stratified-sampling"] },
      { id: "grid-search", ko: "그리드 서치", en: "GridSearchCV",
        def: "하이퍼파라미터 후보 조합을 전부 교차검증으로 평가해 최적 조합을 찾는 sklearn 클래스. best_params_, best_score_, best_estimator_를 제공한다.",
        nodes: ["a-3-4"], related: ["hyperparameter", "cross-validation"] },
      { id: "data-leakage", ko: "데이터 누수", en: "data leakage",
        def: "테스트(미래) 데이터의 정보가 학습 과정에 섞여 평가가 실제보다 낙관적으로 나오는 문제. 스케일러·대치기를 전체 데이터에 fit하는 것이 대표 사례다.",
        nodes: ["a-3-4"], related: ["pipeline", "standardization", "train-test-split"] }
    ]
  });
})();
