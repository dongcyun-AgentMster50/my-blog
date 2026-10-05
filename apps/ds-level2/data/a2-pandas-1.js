/* ds-level2 — 파트A 2장 전반: 2-1 Pandas 기초 / 2-2 Pandas 데이터 정제 / 2-3 Pandas 변환과 집계.
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그·링크한 용어는 전부 이 파일에서 정의.
   kind=output 문제의 출력과 실습 정답은 pandas 3.0.6 / numpy 2.4.6 에서 실제 실행해 확인했다(버전 의존 동작은 묻지 않는다). */
(function () {
  DS2.register({
    chapter: "a-2",

    /* ───────────────────────── 요약 카드 ───────────────────────── */
    cards: {
      "a-2-1": {
        node: "a-2-1",
        title: "Pandas 기초",
        summary: [
          "pandas의 두 자료구조 [[series|시리즈(Series)]]와 [[dataframe|데이터프레임(DataFrame)]]은 모두 **인덱스(index)** 를 가진 레이블 배열이다.",
          "행과 값을 고르는 방법은 레이블 기반 [[loc|`loc`]], 정수 위치 기반 [[iloc|`iloc`]], 조건식 기반 [[boolean-indexing|불리언 인덱싱]] 세 가지로 정리된다.",
          "`shape`/`info()`/`describe()`/`value_counts()`로 데이터를 훑어보고, `sort_values`로 정렬하고, `read_csv`의 주요 옵션으로 파일을 읽는 것까지가 이 토픽의 범위다.",
          "슬라이스 결과가 원본의 뷰(view)인지 복사(copy)인지 애매할 때는 `.copy()`를 명시하는 습관이 시험과 실무 모두에서 안전하다."
        ],
        concepts: [
          "**Series**: 1차원 레이블 배열. 값(values) + 인덱스(index) + 단일 [[dtype|자료형(dtype)]]. DataFrame의 한 컬럼이 Series다.",
          "**DataFrame**: 2차원 표. 컬럼마다 dtype이 다를 수 있다(수치·문자열·불리언·날짜 혼재 가능). `df.dtypes`로 컬럼별 dtype을 본다.",
          "**`loc` vs `iloc`**: `loc`는 레이블(label) 기반이고 슬라이스 끝을 **포함**한다. `iloc`는 정수 위치(position) 기반이고 파이썬 슬라이스처럼 끝을 **제외**한다. 단일 스칼라는 `at`/`iat`가 더 빠르다.",
          "**불리언 인덱싱**: `df[df['a'] > 1]`처럼 조건식(bool Series)으로 행을 고른다. 조건을 묶을 때는 `and`/`or`가 아니라 `&`/`|`/`~`를 쓰고 각 조건을 괄호로 감싼다.",
          "**컬럼 추가·삭제**: `df['new'] = ...` 또는 `df.assign(new=...)`로 추가, `df.drop(columns=[...])`로 삭제. `drop`의 기본 `axis=0`은 행 기준이다.",
          "**훑어보기**: `shape`(행, 열), `head(n)`, `info()`(dtype·결측·메모리), `describe()`(수치형 요약통계), [[value-counts|`value_counts()`]](범주 빈도).",
          "**정렬**: [[sort|`sort_values(by, ascending=)`]]는 값 기준, `sort_index()`는 인덱스 기준. 여러 키는 리스트로 주고 `ascending`도 같은 길이 리스트로 줄 수 있다.",
          "**`read_csv` 주요 옵션**: `sep`(구분자), `header`(헤더 행, 없으면 `None`), `names`(컬럼명), `index_col`, `usecols`, `dtype`, `parse_dates`, `na_values`, `encoding`, `skiprows`, `nrows`."
        ],
        terms: ["series", "dataframe", "index", "dtype", "loc", "iloc", "boolean-indexing", "view-copy", "read-csv", "value-counts", "descriptive-statistics", "sort"],
        patterns: [
          {
            title: "레이블·위치로 부분 선택",
            lang: "python",
            code: [
              "df.loc['r1':'r3', ['a', 'b']]   # 레이블 슬라이스: 'r3' 포함",
              "df.iloc[0:3, 0:2]               # 위치 슬라이스: 3행·2열 제외",
              "df.at['r1', 'a']                # 스칼라 하나(레이블)",
              "df.iat[0, 0]                    # 스칼라 하나(위치)"
            ],
            note: "`loc`의 끝 포함 규칙은 시험에서 가장 자주 묻는 함정이다."
          },
          {
            title: "조건으로 행 고르기",
            lang: "python",
            code: [
              "mask = (df['age'] >= 30) & (df['city'] == 'Seoul')",
              "sub = df.loc[mask, ['id', 'income']]",
              "df.query('age >= 30 and city == \"Seoul\"')   # query 안에서는 and/or 사용 가능"
            ],
            note: "`&`, `|`, `~`와 괄호. `isin([...])`, `between(a, b)`도 자주 쓴다."
          },
          {
            title: "데이터 훑어보기",
            lang: "python",
            code: [
              "df.shape, df.dtypes",
              "df.info()",
              "df.describe()                     # 수치형 요약. include='all' 로 전체",
              "df['city'].value_counts(normalize=True)"
            ]
          },
          {
            title: "정렬과 컬럼 추가·삭제",
            lang: "python",
            code: [
              "df.sort_values(['city', 'income'], ascending=[True, False])",
              "df['income_k'] = df['income'] / 1000",
              "df = df.drop(columns=['tmp'])"
            ]
          },
          {
            title: "CSV 읽기 옵션",
            lang: "python",
            code: [
              "pd.read_csv('data.csv', sep=',', header=None, names=['a', 'b', 'c'],",
              "            usecols=['a', 'c'], index_col='a', parse_dates=['c'],",
              "            na_values=['-', 'NA'], encoding='utf-8')"
            ],
            note: "`header=None`이면 첫 행도 데이터로 읽고 컬럼명은 0,1,2… 가 된다."
          },
          {
            title: "뷰와 복사를 분명히",
            lang: "python",
            code: [
              "sub = df[df['age'] >= 30].copy()   # 독립 복사본",
              "sub['flag'] = 1                    # 원본 df에 영향 없음",
              "df.loc[df['age'] >= 30, 'flag'] = 1   # 원본을 고치려면 loc 한 번에"
            ],
            note: "pandas 2.x에서는 체인 대입이 `SettingWithCopyWarning`을 내고, 3.0(Copy-on-Write)에서는 조용히 원본에 반영되지 않는다. 어느 버전이든 `.copy()`와 `loc` 한 번 대입이 정답이다."
          }
        ],
        pitfalls: [
          "`df.loc[1:3]`은 레이블 1,2,3 **세 행**, `df.iloc[1:3]`은 위치 1,2 **두 행**.",
          "`df[df.a > 1 and df.b < 5]`는 `ValueError`(The truth value of a Series is ambiguous). `&`와 괄호를 써야 한다.",
          "`df.drop('col')`은 기본 `axis=0`이라 'col'이라는 **행**을 찾는다. 열 삭제는 `columns='col'` 또는 `axis=1`.",
          "정수가 들어 있던 Series에 `None`/`NaN`이 섞이면 dtype이 `float64`로 올라간다(upcast).",
          "`describe()`는 기본적으로 수치형 컬럼만 요약한다. 문자열까지 보려면 `include='all'`."
        ]
      },

      "a-2-2": {
        node: "a-2-2",
        title: "Pandas 데이터 정제",
        summary: [
          "정제(cleaning)는 **결측값(missing value) → 중복(duplicate) → 자료형(dtype) → 문자열 → 이상치(outlier)** 순서로 점검하는 것이 표준 절차다.",
          "[[missing-value|결측값]]은 `isna()`로 찾고 `fillna`/`interpolate`로 채우거나([[imputation|대치]]) `dropna`로 지운다.",
          "`astype`·`to_numeric`·`to_datetime`으로 [[type-casting|형 변환]]을 하되, 깨진 값은 `errors='coerce'`로 NaN 처리한다.",
          "[[outlier|이상치]]는 [[iqr|IQR 규칙]]이나 [[z-score|z-점수]]로 찾아 제거하거나 `clip`으로 경계값에 묶는다."
        ],
        concepts: [
          "**결측값 탐지**: `isna()`/`isnull()`은 True/False 마스크, `df.isna().sum()`은 컬럼별 결측 개수, `df.isna().sum().sum()`은 전체 개수. `notna()`는 반대.",
          "**결측값 처리**: `fillna(값|dict)`, `ffill()`/`bfill()`(앞·뒤 값으로), `interpolate()`([[interpolation|보간]], 기본 선형), `dropna(axis=0, how='any'|'all', thresh=, subset=)`. 모두 기본은 **새 객체 반환**(inplace 아님).",
          "**중복**: `duplicated(subset=, keep='first'|'last'|False)`는 불리언 마스크, `drop_duplicates(...)`는 제거. `keep=False`면 중복된 행을 전부 지운다.",
          "**형 변환**: `astype('int64'|'float'|'category'|'string')`은 실패 시 예외, `pd.to_numeric(s, errors='coerce')`·`pd.to_datetime(s, format=, errors='coerce')`는 깨진 값을 NaN/NaT로 바꾼다.",
          "**문자열 정제**: [[string-accessor|`.str` 접근자]] — `strip`, `lower/upper`, `replace`, `contains`, `split`, `len`, `startswith`, `extract`. 요소별(element-wise)로 작동하고 결측값은 결측으로 유지된다.",
          "**이상치**: IQR 규칙은 `[Q1 - 1.5·IQR, Q3 + 1.5·IQR]` 밖을 이상치로 본다. z-점수는 `|(x - 평균)/표준편차| > 3`(또는 2) 기준. `clip(lower, upper)`는 경계 밖 값을 경계값으로 바꾼다(제거 아님).",
          "**값 매핑**: [[map|`map(dict)`]]은 딕셔너리에 없는 값을 **NaN**으로, [[replace|`replace(dict)`]]는 없는 값을 **그대로** 둔다.",
          "**카테고리형**: `astype('category')`는 고유값이 적은 문자열 컬럼의 메모리를 줄이고 `cat.codes`·`cat.categories`·순서(ordered) 비교를 지원한다."
        ],
        terms: ["missing-value", "imputation", "interpolation", "duplicate", "type-casting", "string-accessor", "outlier", "iqr", "z-score", "categorical", "clip", "map"],
        patterns: [
          {
            title: "결측값 현황과 대치",
            lang: "python",
            code: [
              "df.isna().sum()                              # 컬럼별 결측 개수",
              "df['qty'] = df['qty'].fillna(df['qty'].median())",
              "df['cat'] = df['cat'].fillna('unknown')",
              "df = df.dropna(subset=['price'])             # 특정 컬럼 결측 행만 제거"
            ],
            note: "수치형은 중앙값, 범주형은 최빈값/별도 라벨로 채우는 것이 교과서적 기본이다."
          },
          {
            title: "형 변환 (깨진 값은 NaN으로)",
            lang: "python",
            code: [
              "df['price'] = pd.to_numeric(df['price'].str.replace(',', ''), errors='coerce')",
              "df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d', errors='coerce')",
              "df['grade'] = df['grade'].astype('category')"
            ]
          },
          {
            title: "중복 제거",
            lang: "python",
            code: [
              "df.duplicated().sum()                        # 중복 행 수",
              "df = df.drop_duplicates(subset=['id'], keep='last')"
            ]
          },
          {
            title: "IQR 이상치 제거",
            lang: "python",
            code: [
              "q1, q3 = df['x'].quantile([0.25, 0.75])",
              "iqr = q3 - q1",
              "lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr",
              "clean = df[(df['x'] >= lo) & (df['x'] <= hi)]",
              "df['x_clipped'] = df['x'].clip(lo, hi)        # 제거 대신 경계값으로"
            ]
          },
          {
            title: "z-점수 이상치",
            lang: "python",
            code: [
              "z = (df['x'] - df['x'].mean()) / df['x'].std()",
              "outliers = df[z.abs() > 3]"
            ],
            note: "`scipy.stats.zscore`도 같다(기본 ddof=0 이라 pandas `std()`(ddof=1)와 미세하게 다름)."
          },
          {
            title: "문자열 정제 체인",
            lang: "python",
            code: [
              "s = df['name'].str.strip().str.lower()",
              "df['is_kr'] = df['email'].str.contains('.kr', regex=False)",
              "df['code'] = df['code'].str.replace('-', '')"
            ]
          }
        ],
        pitfalls: [
          "`dropna()`의 기본은 **행** 제거(`axis=0`), `how='any'`. 열을 지우려면 `axis=1`.",
          "`fillna`·`dropna`·`drop_duplicates`는 기본적으로 원본을 바꾸지 않는다. 결과를 다시 대입하거나 `inplace=True`.",
          "`pd.to_numeric(['1', 'x'])`는 기본(`errors='raise'`)에서 `ValueError`. `errors='coerce'`가 있어야 NaN이 된다.",
          "`map(dict)`는 매핑에 없는 값을 NaN으로 바꿔 데이터를 잃을 수 있다. 일부만 바꾸려면 `replace`.",
          "IQR 하한은 `Q1 - 1.5·IQR`이다. `Q1 - 1.5·Q1`이나 `Q1 - IQR`로 쓴 보기가 함정으로 나온다."
        ]
      },

      "a-2-3": {
        node: "a-2-3",
        title: "Pandas 변환과 집계",
        summary: [
          "[[groupby|그룹화(groupby)]]는 [[split-apply-combine|분할-적용-결합]] 패턴의 구현이고, 그 뒤에 붙는 메서드가 **결과 길이**를 결정한다.",
          "[[aggregation|`agg`]]는 그룹당 하나(길이 = 그룹 수), [[transform|`transform`]]은 원본 길이, [[filter|`filter`]]는 조건을 만족하는 그룹의 행만, [[apply|`apply`]]는 함수가 돌려주는 모양 그대로다.",
          "재구조화는 [[pivot-table|`pivot_table`]](집계 포함) / `pivot`(집계 없음, 중복 불가) / [[crosstab|`crosstab`]](빈도표) / [[melt|`melt`]](wide→long) / `stack`·[[unstack|`unstack`]](인덱스↔컬럼)으로 정리된다.",
          "구간화 `cut`/`qcut`, 순위 `rank`, 누적 `cumsum`/`cummax`, 그리고 여러 키로 그룹화하면 생기는 [[multiindex|다중 인덱스]] 기본 조작까지가 범위다."
        ],
        concepts: [
          "**분할-적용-결합(split-apply-combine)**: `groupby(키)`로 나누고, 함수를 적용하고, 결과를 합친다. `size()`는 결측 포함 행 수, `count()`는 컬럼별 비결측 수.",
          "**agg(집계, aggregation)**: `agg('mean')`, `agg(['mean', 'max'])`, `agg({'v': 'sum', 'w': 'mean'})`, [[named-aggregation|이름 붙인 집계]] `agg(total=('v', 'sum'))`. 결과 길이 = 그룹 수.",
          "**transform(변환)**: 그룹별 결과를 원본 길이로 [[broadcasting|브로드캐스트]]한다. 그룹 평균 대비 차이, 그룹별 결측 대치, 그룹별 표준화에 쓴다.",
          "**filter(그룹 필터)**: 그룹 단위 조건(`lambda g: len(g) > 1`)이 True인 그룹의 **행들**을 원본 형태로 돌려준다. 행 단위 불리언 인덱싱과 다르다.",
          "**apply**: 그룹 DataFrame을 받아 스칼라·Series·DataFrame 아무것이나 돌려준다. 가장 유연하지만 느리고 결과 모양을 예측하기 어렵다. `agg`/`transform`으로 되면 그쪽을 쓴다.",
          "**pivot_table vs pivot vs crosstab**: `pivot_table(index, columns, values, aggfunc='mean', fill_value, margins)`은 중복 키를 집계한다. `pivot`은 집계 함수가 없어 (index, columns) 조합이 중복이면 `ValueError`. `crosstab(a, b)`는 두 범주의 빈도표(`normalize=`로 비율).",
          "**melt / stack / unstack**: `melt(id_vars, value_vars, var_name, value_name)`은 넓은 형식을 긴 형식으로. `stack()`은 컬럼을 행 인덱스로, `unstack()`은 (다중) 행 인덱스 한 레벨을 컬럼으로 올린다.",
          "**구간화·순위·누적**: [[binning|`cut`]]은 값 경계(기본 오른쪽 닫힘 `(a, b]`), `qcut`은 분위 기준 등빈도 구간. [[rank|`rank(method='average'|'min'|'dense'|'first')`]]. [[cumulative|`cumsum`/`cummax`/`cumcount`]]는 원본 길이의 누적값."
        ],
        terms: ["groupby", "split-apply-combine", "aggregation", "transform", "filter", "apply", "pivot-table", "crosstab", "melt", "unstack", "binning", "multiindex"],
        patterns: [
          {
            title: "그룹별 여러 통계 · 이름 붙인 집계",
            lang: "python",
            code: [
              "df.groupby('dept')['salary'].agg(['mean', 'max', 'count'])",
              "df.groupby('dept').agg(avg=('salary', 'mean'), n=('salary', 'size'))",
              "df.groupby('dept', as_index=False)['salary'].mean()   # 키를 컬럼으로"
            ]
          },
          {
            title: "그룹 통계를 원본 길이로 붙이기",
            lang: "python",
            code: [
              "df['dept_mean'] = df.groupby('dept')['salary'].transform('mean')",
              "df['diff'] = df['salary'] - df['dept_mean']",
              "df['z_in_dept'] = df.groupby('dept')['salary'].transform(lambda s: (s - s.mean()) / s.std())"
            ],
            note: "길이가 같으므로 바로 새 컬럼으로 대입할 수 있다. `agg` 결과는 길이가 달라 대입하면 NaN이 생긴다."
          },
          {
            title: "그룹 조건으로 행 필터",
            lang: "python",
            code: [
              "big = df.groupby('dept').filter(lambda g: len(g) >= 30)",
              "# 같은 결과를 transform 으로:",
              "big2 = df[df.groupby('dept')['salary'].transform('size') >= 30]"
            ]
          },
          {
            title: "피벗 테이블과 교차표",
            lang: "python",
            code: [
              "pd.pivot_table(df, index='dept', columns='year', values='salary', aggfunc='sum', fill_value=0, margins=True)",
              "pd.crosstab(df['dept'], df['year'], normalize='index')   # 행 비율"
            ]
          },
          {
            title: "wide ↔ long",
            lang: "python",
            code: [
              "long = wide.melt(id_vars='id', var_name='month', value_name='sales')",
              "wide2 = long.pivot(index='id', columns='month', values='sales')",
              "g = df.groupby(['dept', 'year'])['salary'].mean()   # MultiIndex Series",
              "g.unstack('year')                                     # year 를 컬럼으로",
              "g.loc[('IT', 2023)]                                   # 다중 인덱스 선택"
            ]
          },
          {
            title: "구간화 · 순위 · 누적",
            lang: "python",
            code: [
              "df['band'] = pd.cut(df['age'], bins=[0, 29, 49, 100], labels=['20s', '30-40s', '50+'])",
              "df['q4'] = pd.qcut(df['salary'], q=4, labels=['Q1', 'Q2', 'Q3', 'Q4'])",
              "df['rk'] = df.groupby('dept')['salary'].rank(ascending=False, method='min')",
              "df['cum'] = df.sort_values('date')['sales'].cumsum()"
            ]
          }
        ],
        pitfalls: [
          "`transform`은 원본과 같은 길이, `agg`는 그룹 수 길이. 둘을 혼동하면 shape 오류나 NaN 컬럼이 생긴다.",
          "`pivot`에 (index, columns) 중복 조합이 있으면 `ValueError: Index contains duplicate entries`. 집계가 필요하면 `pivot_table`.",
          "`pd.cut`의 기본 `right=True`는 `(a, b]` — 왼쪽 경계값은 구간에 **들어가지 않아** NaN이 된다.",
          "`cumsum`·`rank`·`transform`은 집계가 아니다(길이가 줄지 않는다). '집계 함수를 모두 고르시오' 유형의 함정.",
          "`groupby(...).filter`는 **그룹** 단위 조건이다. `df[df['v'] > 2]`(행 단위)와 결과가 다르다."
        ]
      }
    },

    /* ───────────────────────── 필기 문제 ───────────────────────── */
    questions: [
      /* ====================== a-2-1 Pandas 기초 ====================== */
      {
        id: "a-2-1-q01", node: "a-2-1", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "pandas의 시리즈(Series)와 데이터프레임(DataFrame)에 대한 설명으로 옳은 것은?",
        choices: [
          "Series는 인덱스를 가진 1차원 레이블 배열이고, DataFrame은 여러 Series를 컬럼으로 묶은 2차원 표다.",
          "DataFrame의 모든 컬럼은 반드시 같은 dtype이어야 한다.",
          "Series에는 인덱스가 없고 정수 위치로만 접근할 수 있다.",
          "DataFrame은 NumPy 배열과 달리 수치형 데이터만 담을 수 있다."
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[series|시리즈(Series)]]는 값과 인덱스(index)를 가진 1차원 레이블 배열이고, [[dataframe|데이터프레임(DataFrame)]]은 같은 인덱스를 공유하는 Series들을 컬럼으로 묶은 2차원 표다. `df['col']`은 Series를 돌려준다.",
          "",
          "- ② DataFrame은 **컬럼마다** dtype이 다를 수 있다(`df.dtypes`). 하나의 Series 안에서만 dtype이 하나다.",
          "- ③ Series도 인덱스를 가진다. `s.loc['a']`처럼 레이블로 접근할 수 있다.",
          "- ④ 문자열·불리언·날짜 등 어떤 자료형도 담을 수 있다. NumPy 배열이 오히려 단일 dtype이다.",
          "",
          "시험에서는 'DataFrame의 한 컬럼은 Series다', 'Series는 dtype이 하나다' 같은 구조 설명을 참/거짓으로 묻는다."
        ],
        terms: ["series", "dataframe", "dtype"]
      },
      {
        id: "a-2-1-q02", node: "a-2-1", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`df.loc[1:3]`과 `df.iloc[1:3]`의 차이에 대한 설명으로 옳은 것은? (인덱스는 0부터 시작하는 정수 `RangeIndex`)",
        choices: [
          "둘 다 위치 1, 2 두 행을 돌려주므로 결과가 같다.",
          "`loc`는 레이블 1, 2, 3 세 행(끝 포함), `iloc`는 위치 1, 2 두 행(끝 제외)을 돌려준다.",
          "`loc`는 위치 기반, `iloc`는 레이블 기반이다.",
          "`loc[1:3]`은 정수 레이블에 쓸 수 없어 `TypeError`가 난다."
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[loc|`loc`]]는 레이블(label) 기반 접근자라 슬라이스의 **끝 레이블을 포함**하고, [[iloc|`iloc`]]는 정수 위치(integer position) 기반이라 파이썬 슬라이스처럼 **끝을 제외**한다. 그래서 같은 `1:3`이라도 행 수가 3개와 2개로 다르다.",
          "",
          "- ① 결과가 같다는 것은 틀렸다. `loc`가 한 행 더 많다.",
          "- ③ 역할이 뒤바뀌었다. `loc` = label, `iloc` = integer location.",
          "- ④ 정수 레이블도 `loc`로 접근할 수 있다. 예외는 나지 않는다.",
          "",
          "시험에서는 `df.loc['b':'d']`나 `df.loc[1:3]`의 **행 수**를 고르게 하는 형태로 반복 출제된다."
        ],
        terms: ["loc", "iloc", "index"]
      },
      {
        id: "a-2-1-q03", node: "a-2-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]}, index=['x', 'y', 'z'])",
          "print(df.loc['x':'y', 'b'].tolist(), df.iloc[0:1, 1].tolist())"
        ],
        lang: "python",
        choices: ["[4] [4]", "[4, 5] [4, 5]", "[4, 5] [4]", "[4, 5, 6] [4]"],
        answer: 2,
        explanation: [
          "**정답: ③** [[loc|`loc['x':'y', 'b']`]]는 레이블 슬라이스라 'y'까지 **포함**해 `[4, 5]`. [[iloc|`iloc[0:1, 1]`]]은 위치 슬라이스라 0번 행만(1 제외) 골라 두 번째 컬럼 'b'의 `[4]`가 된다.",
          "",
          "- ① `loc`가 끝을 제외한다고 본 오답이다.",
          "- ② `iloc`가 끝을 포함한다고 본 오답이다.",
          "- ④ `loc['x':'y']`에 'z'는 들어가지 않는다.",
          "",
          "시험에서는 `loc`와 `iloc`를 한 코드에 나란히 두고 길이 차이를 묻는다. [[index|인덱스(index)]] 레이블 기준인지 위치 기준인지, 끝 포함(inclusive) 여부만 기억하면 된다."
        ],
        terms: ["loc", "iloc"]
      },
      {
        id: "a-2-1-q04", node: "a-2-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'g': ['x', 'y', 'x', 'y'], 'v': [3, 1, 2, 4]})",
          "print(df.sort_values(['g', 'v'], ascending=[True, False])['v'].tolist())"
        ],
        lang: "python",
        choices: ["[1, 2, 3, 4]", "[4, 3, 2, 1]", "[2, 3, 1, 4]", "[3, 2, 4, 1]"],
        answer: 3,
        explanation: [
          "**정답: ④** [[sort|`sort_values`]]에 키를 리스트로 주면 **첫 키부터 차례로** 정렬한다. `g` 오름차순으로 x 그룹(3, 2)이 먼저, y 그룹(1, 4)이 뒤에 오고, 각 그룹 안에서 `v`는 `ascending=False`로 내림차순 → `[3, 2, 4, 1]`.",
          "",
          "- ① `v`만 오름차순 정렬한 결과다. `g`가 1차 키임을 놓쳤다.",
          "- ② `v`만 내림차순 정렬한 결과다.",
          "- ③ 그룹 안을 오름차순으로 정렬한 결과다. `ascending` 리스트의 두 번째 값이 False임을 놓쳤다.",
          "",
          "시험에서는 다중 키 정렬(multi-key sort)에서 `ascending` 리스트가 **키와 1:1로 대응**한다는 점을 묻는다."
        ],
        terms: ["sort", "dataframe"]
      },
      {
        id: "a-2-1-q05", node: "a-2-1", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드를 실행했을 때의 결과로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})",
          "print(df[df['a'] > 1 and df['b'] < 6])"
        ],
        lang: "python",
        choices: [
          "a=2, b=5 인 행 하나가 출력된다.",
          "`ValueError`(The truth value of a Series is ambiguous)가 발생한다.",
          "`SyntaxError`가 발생한다.",
          "`KeyError`가 발생한다."
        ],
        answer: 1,
        explanation: [
          "**정답: ②** 파이썬 `and`는 피연산자를 **단일 참/거짓**으로 평가하려 하는데, 불리언 Series는 원소가 여러 개라 참/거짓을 정할 수 없어 `ValueError: The truth value of a Series is ambiguous`가 난다. [[boolean-indexing|불리언 인덱싱]]에서 조건을 묶을 때는 원소별 연산자 `&`, `|`, `~`를 쓰고 각 조건을 괄호로 감싼다: `df[(df['a'] > 1) & (df['b'] < 6)]`.",
          "",
          "- ① `&`로 고쳐 썼을 때의 올바른 결과다. 지금 코드로는 나오지 않는다.",
          "- ③ 문법적으로는 유효한 식이라 구문 오류(SyntaxError)는 아니다. 실행 시점 오류다.",
          "- ④ 'a', 'b' 컬럼이 존재하므로 KeyError는 아니다.",
          "",
          "시험에서는 `and`/`or`를 쓴 코드를 보여 주고 오류 종류나 올바른 수정(`&`, `|`, 괄호)을 고르게 한다."
        ],
        terms: ["boolean-indexing"]
      },
      {
        id: "a-2-1-q06", node: "a-2-1", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "`pd.read_csv()`의 옵션 설명으로 옳지 **않은** 것은?",
        choices: [
          "`sep`: 필드 구분자. 탭 구분 파일은 `sep='\\t'`.",
          "`header=None`: 첫 행을 컬럼명으로 쓰지 않고 데이터로 읽는다.",
          "`index_col`: 인덱스로 사용할 컬럼을 지정한다.",
          "`usecols`: 파일 앞부분에서 건너뛸 행 수를 지정한다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** `usecols`는 **읽어 올 컬럼**을 이름이나 위치 리스트로 고르는 옵션이다. 앞부분 행을 건너뛰는 옵션은 `skiprows`, 읽을 행 수 제한은 `nrows`다. [[read-csv|`read_csv`]] 옵션 이름과 역할을 짝지어 외워야 한다.",
          "",
          "- ① `sep`(또는 `delimiter`)는 구분자. 기본은 쉼표이고 TSV는 `'\\t'`.",
          "- ② `header=None`이면 첫 행도 데이터가 되고 컬럼명은 0, 1, 2…가 된다. 이때 `names=[...]`로 이름을 준다.",
          "- ③ `index_col='id'` 또는 `index_col=0`처럼 인덱스로 쓸 컬럼을 지정한다.",
          "",
          "시험에서는 `header`/`names`/`usecols`/`skiprows`/`nrows`/`na_values`/`parse_dates`의 역할을 섞어 '옳지 않은 것'으로 묻는다."
        ],
        terms: ["read-csv", "index"]
      },
      {
        id: "a-2-1-q07", node: "a-2-1", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['b', 'a', 'b', 'c', 'b', 'a'])",
          "vc = s.value_counts()",
          "print(vc.index.tolist(), round(vc.iloc[0] / len(s), 2))"
        ],
        lang: "python",
        choices: ["['b', 'a', 'c'] 0.5", "['a', 'b', 'c'] 0.5", "['b', 'a', 'c'] 3", "['a', 'b', 'c'] 0.33"],
        answer: 0,
        explanation: [
          "**정답: ①** [[value-counts|`value_counts()`]]는 고유값의 빈도를 **빈도 내림차순**으로 정렬해 돌려준다. b가 3회, a가 2회, c가 1회이므로 인덱스는 `['b', 'a', 'c']`, 첫 빈도 3을 전체 6으로 나누면 0.5다. `value_counts(normalize=True)`를 쓰면 바로 비율이 나온다.",
          "",
          "- ② 인덱스가 알파벳순으로 정렬된다고 본 오답이다. 빈도순이 기본이고 알파벳순은 `sort_index()`를 따로 해야 한다.",
          "- ③ 두 번째 값은 빈도 3 자체가 아니라 비율 3/6이다.",
          "- ④ 인덱스 순서도 틀리고, 0.33은 a의 비율(2/6)이다.",
          "",
          "시험에서는 `value_counts()`의 기본 정렬(빈도 내림차순)과 `normalize=True`의 의미를 묻는다. `size()`·`nunique()`와 구분해 둔다."
        ],
        terms: ["value-counts", "series"]
      },
      {
        id: "a-2-1-q08", node: "a-2-1", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df.describe()`는 별도 옵션이 없으면 수치형(numeric) 컬럼만 요약통계로 보여 준다.",
        answer: true,
        explanation: [
          "**정답: O** `describe()`의 기본은 **수치형 컬럼만** 대상으로 count·mean·std·min·사분위수·max를 보여 주는 [[descriptive-statistics|기술통계(descriptive statistics)]] 요약이다. 문자열·범주형까지 보려면 `include='all'` 또는 `include='object'`를 준다(그때는 count·unique·top·freq가 나온다).",
          "",
          "`info()`는 dtype·비결측 수·메모리를 보여 주는 구조 요약이고, `describe()`는 값의 분포 요약이라는 점을 구분한다.",
          "",
          "시험에서는 `describe()`의 기본 대상(수치형)과 `include='all'`의 효과, 그리고 `info()`와의 차이를 OX로 묻는다."
        ],
        terms: ["descriptive-statistics"]
      },
      {
        id: "a-2-1-q09", node: "a-2-1", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`df.drop('price')`는 기본적으로 'price' **열(column)** 을 삭제한 새 DataFrame을 돌려준다.",
        answer: false,
        explanation: [
          "**정답: X** `drop`의 기본 축은 `axis=0`(행)이다. 따라서 `df.drop('price')`는 **인덱스 레이블** 'price'인 행을 찾고, 없으면 `KeyError`가 난다. 열을 지우려면 `df.drop(columns='price')` 또는 `df.drop('price', axis=1)`로 써야 한다.",
          "",
          "또한 `drop`은 기본적으로 원본을 바꾸지 않고 **새 객체**를 돌려준다(`inplace=False`). 결과를 대입하지 않으면 원본은 그대로다. 이것은 [[view-copy|뷰/복사]] 문제와 함께 자주 함정으로 나온다.",
          "",
          "시험에서는 `drop`의 `axis` 기본값과 `columns=` 인자, `inplace` 여부를 묻는다. [[dataframe|데이터프레임]]의 축 번호(0=행, 1=열)는 `sum(axis=)`, `dropna(axis=)`와 공통이다."
        ],
        terms: ["dataframe", "view-copy"]
      },
      {
        id: "a-2-1-q10", node: "a-2-1", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 메서드 이름을 쓰시오. 컬럼별 dtype, 비결측(non-null) 개수, 메모리 사용량을 한 번에 요약한다: `df.____()`",
        answer: "info",
        accept: ["info()"],
        explanation: [
          "**정답: info** `df.info()`는 행 수, 컬럼별 **비결측 개수(Non-Null Count)**, [[dtype|자료형(dtype)]], 메모리 사용량을 출력하는 구조 요약 메서드다. 결측값 유무와 형 변환이 필요한 컬럼을 한눈에 찾을 때 가장 먼저 호출한다.",
          "",
          "값의 분포(평균·표준편차·사분위수)를 보는 것은 `describe()`, 크기만 보는 것은 `shape`다. 셋을 구분한다.",
          "",
          "시험에서는 '결측값과 dtype을 한 번에 확인하는 메서드'라는 설명으로 `info`를 묻고, `describe`와 바꿔 놓은 보기를 함정으로 둔다."
        ],
        terms: ["dtype", "descriptive-statistics"]
      },
      {
        id: "a-2-1-q11", node: "a-2-1", type: "short", kind: "concept", difficulty: 2,
        prompt: "조건으로 뽑은 부분 DataFrame을 원본과 완전히 독립된 객체로 만들어 안전하게 수정하고 싶다. 뒤에 붙이는 메서드 이름을 쓰시오: `sub = df[df['age'] >= 30].____()`",
        answer: "copy",
        accept: ["copy()"],
        explanation: [
          "**정답: copy** `.copy()`는 데이터를 실제로 복제한 **독립 복사본(deep copy)** 을 만든다. 슬라이스나 조건 선택 결과는 [[view-copy|뷰(view)인지 복사(copy)인지]]가 상황에 따라 달라, 거기에 값을 대입하면 pandas 2.x는 `SettingWithCopyWarning`을 내고 3.0(Copy-on-Write)은 원본에 반영하지 않는다. `.copy()`를 붙이면 어느 버전에서든 의도가 분명해진다.",
          "",
          "원본을 고치는 것이 목적이라면 복사 대신 `df.loc[조건, '컬럼'] = 값`처럼 [[loc|`loc`]] 한 번으로 대입한다.",
          "",
          "시험에서는 '부분 선택 후 값을 바꿨는데 원본이 바뀌지 않는/경고가 뜨는 이유'와 그 해결책(`.copy()`, `loc` 단일 대입)을 묻는다."
        ],
        terms: ["view-copy", "loc"]
      },
      {
        id: "a-2-1-q12", node: "a-2-1", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드가 출력하는 dtype 이름을 쓰시오.",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, 2, None])",
          "print(s.dtype)"
        ],
        lang: "python",
        answer: "float64",
        accept: ["float"],
        explanation: [
          "**정답: float64** 정수 리스트에 `None`이 섞이면 pandas는 `None`을 결측값 `NaN`으로 바꾸는데, `NaN`은 부동소수(float) 값이라 Series 전체 [[dtype|자료형(dtype)]]이 **`float64`로 올라간다(upcast)**. 그래서 `[1.0, 2.0, NaN]`이 저장된다.",
          "",
          "정수형을 유지하면서 결측을 담으려면 nullable 정수형 `Int64`(대문자 I)를 명시해야 한다: `pd.Series([1, 2, None], dtype='Int64')`.",
          "",
          "시험에서는 '정수 컬럼에 [[missing-value|결측값(missing value)]]이 생기면 dtype이 어떻게 되는가'를 묻고, `int64`/`object`를 함정 보기로 둔다."
        ],
        terms: ["dtype", "missing-value"]
      },

      /* ====================== a-2-2 Pandas 데이터 정제 ====================== */
      {
        id: "a-2-2-q01", node: "a-2-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "결측값(missing value) 처리 메서드에 대한 설명으로 옳지 **않은** 것은?",
        choices: [
          "`isna()`는 각 원소가 결측이면 True인 같은 모양의 불리언 객체를 돌려준다.",
          "`fillna(0)`은 결측값을 0으로 채운 새 객체를 돌려준다.",
          "`df.isna().sum()`은 컬럼별 결측값 개수다.",
          "`dropna()`는 기본적으로 결측값이 하나라도 있는 **열(column)** 을 제거한다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** `dropna()`의 기본은 `axis=0`, `how='any'` — 결측값이 하나라도 있는 **행(row)** 을 제거한다. 열을 지우려면 `axis=1`, 모든 값이 결측인 경우만 지우려면 `how='all'`, 비결측이 k개 이상인 행만 남기려면 `thresh=k`다. [[missing-value|결측값(missing value)]]은 pandas에서 `NaN`(수치)·`None`·`NaT`(날짜)로 표현된다.",
          "",
          "- ① `isna()`(= `isnull()`)는 원소별 결측 마스크다. 반대는 `notna()`.",
          "- ② `fillna`는 상수·딕셔너리(컬럼별 값)·Series로 채우며 기본은 새 객체 반환이다.",
          "- ③ 불리언의 합은 True의 개수이므로 컬럼별 결측 수가 된다. 전체 수는 `.sum().sum()`.",
          "",
          "시험에서는 `dropna`의 기본 축과 `how`/`thresh`/`subset` 옵션, `isna().sum()`의 의미를 묻는다."
        ],
        terms: ["missing-value", "imputation"]
      },
      {
        id: "a-2-2-q02", node: "a-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, None, None], 'b': [None, None, 3]})",
          "print(len(df.dropna()), len(df.dropna(how='all')))"
        ],
        lang: "python",
        choices: ["0 2", "2 0", "1 2", "0 3"],
        answer: 0,
        explanation: [
          "**정답: ①** 행별로 보면 0행 `(1, NaN)`, 1행 `(NaN, NaN)`, 2행 `(NaN, 3)`이다. 기본 `dropna()`(`how='any'`)는 [[missing-value|결측값]]이 하나라도 있는 행을 지우므로 세 행 모두 제거되어 **0**. `how='all'`은 **모든 값이 결측**인 1행만 지우므로 **2**가 남는다.",
          "",
          "- ② `how`의 의미가 뒤바뀐 오답이다.",
          "- ③ 0행과 2행은 결측이 하나씩 있어 `any` 기준에서 남지 않는다.",
          "- ④ `how='all'`이라도 1행은 전부 결측이라 제거된다.",
          "",
          "시험에서는 작은 표를 주고 `dropna()`·`dropna(how='all')`·`dropna(thresh=n)`·`dropna(axis=1)` 각각의 결과 행·열 수를 묻는다."
        ],
        terms: ["missing-value"]
      },
      {
        id: "a-2-2-q03", node: "a-2-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, None, None, 4])",
          "print(s.ffill().tolist(), s.interpolate().tolist())"
        ],
        lang: "python",
        choices: [
          "[1.0, 4.0, 4.0, 4.0] [1.0, 2.0, 3.0, 4.0]",
          "[1.0, 1.0, 1.0, 4.0] [1.0, 2.5, 2.5, 4.0]",
          "[1.0, 1.0, 1.0, 4.0] [1.0, 2.0, 3.0, 4.0]",
          "[1.0, 2.0, 3.0, 4.0] [1.0, 1.0, 1.0, 4.0]"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `ffill()`(forward fill)은 결측을 **직전의 유효값**으로 채우므로 `[1, 1, 1, 4]`. `interpolate()`는 기본 `method='linear'`로 양쪽 유효값 1과 4 사이를 **등간격으로 보간**해 `[1, 2, 3, 4]`가 된다. 둘 다 [[imputation|결측값 대치(imputation)]] 기법이지만 전제가 다르다.",
          "",
          "- ① 앞 리스트는 `bfill()`(뒤 값으로 채움)의 결과다.",
          "- ② 뒤 리스트처럼 두 결측을 같은 값(평균)으로 채우는 것은 `fillna(s.mean())`에 가깝다. 선형 [[interpolation|보간(interpolation)]]은 위치에 따라 값이 달라진다.",
          "- ④ 두 결과가 서로 바뀌었다.",
          "",
          "시험에서는 `ffill`/`bfill`/`interpolate`/`fillna(mean)`의 결과를 작은 Series로 비교하게 한다. 시계열에서는 `ffill`, 연속 측정값에서는 `interpolate`가 교과서적 선택이다."
        ],
        terms: ["imputation", "interpolation", "missing-value"]
      },
      {
        id: "a-2-2-q04", node: "a-2-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드를 실행했을 때의 결과로 옳은 것은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['1', '2', 'x'])",
          "print(pd.to_numeric(s).tolist())"
        ],
        lang: "python",
        choices: [
          "`[1.0, 2.0, nan]`이 출력된다.",
          "`ValueError`(Unable to parse string \"x\")가 발생한다.",
          "`[1, 2, 'x']`가 그대로 출력된다.",
          "`TypeError`가 발생한다."
        ],
        answer: 1,
        explanation: [
          "**정답: ②** `pd.to_numeric`의 기본은 `errors='raise'`라서 숫자로 바꿀 수 없는 `'x'`를 만나면 `ValueError`를 던진다. 깨진 값을 `NaN`으로 바꾸며 계속 진행하려면 `pd.to_numeric(s, errors='coerce')`로 써야 하고, 그때의 결과가 보기 ①이다. [[type-casting|형 변환(type casting)]]에서 `astype(float)`도 같은 상황에서 `ValueError`가 난다.",
          "",
          "- ① `errors='coerce'`를 줬을 때의 결과다. 기본 동작이 아니다.",
          "- ③ 원본이 그대로 나오는 옵션은 `errors='ignore'`였는데 이는 deprecated 되었고, 기본값도 아니다.",
          "- ④ 자료형 자체가 잘못된 것이 아니라 값 해석 실패이므로 `ValueError`다.",
          "",
          "시험에서는 `to_numeric`/`to_datetime`의 `errors='coerce'` 의미와, 쉼표·공백이 섞인 문자열을 `.str.replace` 후 변환하는 패턴을 묻는다."
        ],
        terms: ["type-casting", "missing-value"]
      },
      {
        id: "a-2-2-q05", node: "a-2-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "IQR(사분위 범위) 규칙으로 이상치(outlier)를 판정할 때 **하한(lower bound)** 으로 옳은 것은? (Q1 = 1사분위수, Q3 = 3사분위수, IQR = Q3 − Q1)",
        choices: ["Q1 − IQR", "Q1 − 1.5 × Q1", "Q1 − 1.5 × IQR", "Q3 − 1.5 × IQR"],
        answer: 2,
        explanation: [
          "**정답: ③** [[iqr|IQR(interquartile range)]] 규칙은 `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]` 범위 밖의 값을 [[outlier|이상치(outlier)]]로 본다. 상자그림(box plot)의 수염(whisker) 끝이 바로 이 경계다. 1.5 대신 3을 쓰면 '극단 이상치(extreme outlier)' 기준이 된다.",
          "",
          "- ① 계수 1.5가 빠졌다.",
          "- ② IQR 대신 Q1에 1.5를 곱한 오답이다.",
          "- ④ Q3에서 빼는 것은 하한 공식이 아니다. 상한은 `Q3 + 1.5·IQR`.",
          "",
          "시험에서는 공식 자체를 고르게 하거나, 작은 숫자 표본에서 Q1·Q3를 구해 이상치 개수를 세게 한다. pandas에서는 `s.quantile([0.25, 0.75])`로 구한다."
        ],
        terms: ["iqr", "outlier"]
      },
      {
        id: "a-2-2-q06", node: "a-2-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'k': ['a', 'a', 'b'], 'v': [1, 2, 3]})",
          "print(df.drop_duplicates('k', keep='last')['v'].tolist())"
        ],
        lang: "python",
        choices: ["[1, 3]", "[2, 3]", "[1, 2, 3]", "[3]"],
        answer: 1,
        explanation: [
          "**정답: ②** `drop_duplicates(subset='k')`는 'k' 값만 기준으로 [[duplicate|중복(duplicate)]]을 판단한다. 'a'가 두 번 나오고 `keep='last'`이므로 **마지막** 'a'(v=2)를 남기고 첫 'a'(v=1)를 지운다. 'b'(v=3)는 유일하므로 그대로 → `[2, 3]`.",
          "",
          "- ① 기본값 `keep='first'`일 때의 결과다.",
          "- ③ `subset`을 주지 않고 전 컬럼으로 비교하면 (a,1)·(a,2)가 다른 행이라 아무것도 지워지지 않는다. 지금은 'k'만 본다.",
          "- ④ `keep=False`로 중복된 행을 **모두** 지웠을 때의 결과다.",
          "",
          "시험에서는 `keep='first'|'last'|False`에 따른 결과와 `duplicated().sum()`(중복 행 수)을 묻는다."
        ],
        terms: ["duplicate"]
      },
      {
        id: "a-2-2-q07", node: "a-2-2", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series(['a', 'b', 'c'])",
          "print(s.map({'a': 1}).tolist(), s.replace({'a': 1}).tolist())"
        ],
        lang: "python",
        choices: [
          "[1.0, nan, nan] [1, 'b', 'c']",
          "[1, 'b', 'c'] [1.0, nan, nan]",
          "[1, 'b', 'c'] [1, 'b', 'c']",
          "`KeyError`가 발생한다."
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[map|`map(dict)`]]은 딕셔너리를 **조회표**로 써서 키가 없는 값은 `NaN`으로 바꾼다(그래서 `float64`가 되어 `1.0`). 반면 [[replace|`replace(dict)`]]는 딕셔너리에 있는 값만 바꾸고 **나머지는 그대로** 둔다 → `[1, 'b', 'c']`.",
          "",
          "- ② 두 메서드의 결과가 서로 바뀌었다.",
          "- ③ `map`도 그대로 둔다고 본 오답이다. 매핑에 없는 값은 결측이 된다.",
          "- ④ 두 메서드 모두 없는 키에 대해 예외를 던지지 않는다.",
          "",
          "시험에서는 '일부 값만 바꾸려면 어느 메서드인가', '`map` 뒤 결측이 생긴 이유'를 묻는다. 범주 라벨 재부호화(recoding) 시 전체 매핑이면 `map`, 부분이면 `replace`가 안전하다."
        ],
        terms: ["map", "replace", "missing-value"]
      },
      {
        id: "a-2-2-q08", node: "a-2-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df.dropna()`를 호출하면 별도 옵션이 없어도 원본 `df`에서 결측 행이 바로 제거된다.",
        answer: false,
        explanation: [
          "**정답: X** `dropna`·`fillna`·`drop_duplicates`·`sort_values` 등 대부분의 pandas 메서드는 기본적으로 **원본을 바꾸지 않고 새 객체를 돌려준다**(`inplace=False`). 결과를 `df = df.dropna()`처럼 다시 대입하거나 `inplace=True`를 줘야 원본이 바뀐다. [[missing-value|결측값(missing value)]]을 지웠다고 생각했는데 `df.isna().sum()`이 그대로인 전형적 실수다.",
          "",
          "`inplace=True`는 `None`을 돌려주므로 `df = df.dropna(inplace=True)`라고 쓰면 `df`가 `None`이 되는 2차 함정도 있다.",
          "",
          "시험에서는 메서드 체인 후 원본이 바뀌지 않는 이유, `inplace=True`의 반환값을 OX로 묻는다."
        ],
        terms: ["missing-value"]
      },
      {
        id: "a-2-2-q09", node: "a-2-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "고유값(unique value)이 적은 문자열 컬럼을 `astype('category')`로 바꾸면 일반적으로 메모리 사용량이 줄어든다.",
        answer: true,
        explanation: [
          "**정답: O** [[categorical|카테고리형(categorical)]]은 고유값 목록(`categories`)을 한 번만 저장하고 각 행에는 작은 정수 코드(`codes`)만 두는 사전 부호화(dictionary encoding) 구조다. 고유값이 적고 행이 많을수록 문자열을 매 행마다 저장하는 것보다 메모리가 크게 줄고, `groupby`·정렬도 빨라진다. 반대로 고유값이 행 수에 가까우면(ID 컬럼 등) 이득이 없거나 오히려 늘 수 있다.",
          "",
          "`pd.Categorical(..., ordered=True)` 또는 `CategoricalDtype(categories, ordered=True)`로 순서를 주면 `<`, `>` 비교와 정렬이 범주 순서를 따른다(예: 'low' < 'mid' < 'high').",
          "",
          "시험에서는 카테고리형의 장점(메모리·속도·순서 비교)과 `cat.codes`/`cat.categories` 접근자를 묻는다."
        ],
        terms: ["categorical", "dtype"]
      },
      {
        id: "a-2-2-q10", node: "a-2-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 인자 이름을 쓰시오. '2024/03/15' 형태의 문자열을 날짜형으로 바꾼다: `pd.to_datetime(s, ____='%Y/%m/%d')`",
        answer: "format",
        explanation: [
          "**정답: format** `pd.to_datetime(s, format='%Y/%m/%d')`처럼 `format` 인자에 strftime 지시자(`%Y` 4자리 연도, `%m` 월, `%d` 일, `%H:%M:%S` 시분초)로 패턴을 주면 파싱이 정확하고 빠르다. 패턴에 맞지 않는 값은 기본(`errors='raise'`)에서 예외이고, `errors='coerce'`를 주면 `NaT`(Not a Time)가 된다. 이것도 [[type-casting|형 변환(type casting)]]의 하나다.",
          "",
          "변환 후에는 `.dt` 접근자로 `s.dt.year`, `s.dt.month`, `s.dt.dayofweek`를 꺼낼 수 있다.",
          "",
          "시험에서는 `format` 지시자 읽기(`%Y`와 `%y`, `%m`과 `%M`의 차이)와 `errors='coerce'`의 결과 `NaT`를 묻는다."
        ],
        terms: ["type-casting", "datetime"]
      },
      {
        id: "a-2-2-q11", node: "a-2-2", type: "short", kind: "concept", difficulty: 2,
        prompt: "값이 지정한 하한보다 작으면 하한으로, 상한보다 크면 상한으로 바꿔(제거하지 않고) 이상치의 영향을 줄이는 Series/DataFrame 메서드 이름을 쓰시오.",
        answer: "clip",
        accept: ["clip()"],
        explanation: [
          "**정답: clip** [[clip|`clip(lower, upper)`]]는 경계 밖 값을 **경계값으로 잘라 넣는**(winsorizing과 유사한) 처리다. 예: `s.clip(0, 100)`은 음수를 0으로, 100 초과를 100으로 바꾼다. 행을 지우지 않으므로 표본 수가 유지된다는 점이 `dropna`·불리언 필터로 [[outlier|이상치(outlier)]]를 제거하는 방식과 다르다.",
          "",
          "IQR 경계와 함께 `s.clip(q1 - 1.5*iqr, q3 + 1.5*iqr)`로 쓰는 것이 전형적 패턴이다.",
          "",
          "시험에서는 '이상치를 제거하지 않고 경계값으로 대체하는 메서드'라는 설명으로 `clip`을 묻고, `where`/`mask`를 함정 보기로 둔다."
        ],
        terms: ["clip", "outlier"]
      },
      {
        id: "a-2-2-q12", node: "a-2-2", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드가 출력하는 값을 쓰시오.",
        code: [
          "import pandas as pd",
          "s = pd.Series(['  Hello ', 'world'])",
          "print(s.str.strip().str.upper().str.len().sum())"
        ],
        lang: "python",
        answer: "10",
        explanation: [
          "**정답: 10** [[string-accessor|`.str` 접근자]]는 Series의 각 문자열에 **요소별(element-wise)** 로 문자열 메서드를 적용한다. `strip()`으로 앞뒤 공백을 지우면 `'Hello'`(5자)와 `'world'`(5자), `upper()`는 길이를 바꾸지 않고, `len()`은 `[5, 5]`, 합은 **10**이다.",
          "",
          "`strip`을 빼면 `'  Hello '`가 8자라 13이 되는 점이 함정이다. `.str`은 체인으로 이어 쓸 수 있고 결측값은 결측으로 유지된다.",
          "",
          "시험에서는 `.str.strip/lower/replace/contains/split/len`을 체인한 결과 값이나, `.str` 없이 `s.upper()`를 호출해 `AttributeError`가 나는 코드를 묻는다."
        ],
        terms: ["string-accessor"]
      },

      /* ====================== a-2-3 Pandas 변환과 집계 ====================== */
      {
        id: "a-2-3-q01", node: "a-2-3", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "부서별 평균 급여를 계산해 **각 행 옆에 그대로 붙이고**(원본과 같은 행 수) 싶다. `df.groupby('dept')['salary']` 뒤에 쓸 메서드로 가장 적절한 것은?",
        choices: ["`agg('mean')`", "`transform('mean')`", "`filter(lambda g: g.mean())`", "`size()`"],
        answer: 1,
        explanation: [
          "**정답: ②** [[transform|`transform`]]은 그룹별 계산 결과를 **원본과 같은 길이**로 [[broadcasting|브로드캐스트]]해 돌려주므로 `df['dept_mean'] = ...`처럼 바로 새 컬럼으로 대입할 수 있다.",
          "",
          "- ① `agg('mean')`은 [[aggregation|집계(aggregation)]]라 결과 길이가 **그룹 수**다. 각 행에 붙이려면 `merge`가 추가로 필요하다.",
          "- ③ `filter`는 그룹 단위 조건으로 **행을 거르는** 메서드다. 평균값을 돌려주지 않고, 함수가 bool을 돌려주지 않으면 오류가 난다.",
          "- ④ `size()`는 그룹별 행 수를 돌려주는 집계다.",
          "",
          "시험에서는 'agg·transform·filter·apply 중 결과 길이가 원본과 같은 것'을 고르게 하는 문제가 매회 나온다."
        ],
        terms: ["transform", "aggregation", "filter", "groupby"]
      },
      {
        id: "a-2-3-q02", node: "a-2-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'k': ['a', 'b', 'a'], 'v': [1, 2, 3]})",
          "res = df.groupby('k').agg(total=('v', 'sum'), n=('v', 'count'))",
          "print(res.columns.tolist(), res.loc['a', 'total'], res.shape)"
        ],
        lang: "python",
        choices: [
          "['v', 'v'] 4 (2, 2)",
          "['total', 'n'] 3 (3, 2)",
          "['total', 'n'] 4 (2, 2)",
          "['sum', 'count'] 4 (2, 2)"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `agg(새이름=(컬럼, 함수))` 형태의 [[named-aggregation|이름 붙인 집계(named aggregation)]]는 결과 컬럼명이 **지정한 새 이름**(`total`, `n`)이 된다. 그룹 'a'의 v 합은 1 + 3 = 4이고, 그룹이 a·b 두 개, 집계 컬럼이 두 개라 `shape`는 `(2, 2)`다.",
          "",
          "- ① `agg({'v': ['sum', 'count']})`처럼 딕셔너리로 주면 다중 레벨 컬럼이 되지만, 이름 붙인 집계는 단일 레벨의 새 이름이다.",
          "- ② 행 수는 **그룹 수**(2)이지 원본 행 수(3)가 아니고, 'a'의 합도 3이 아니다.",
          "- ④ 함수명이 컬럼명이 되는 것은 `agg(['sum', 'count'])`(리스트) 형태다.",
          "",
          "시험에서는 named aggregation의 문법(`이름=(컬럼, 함수)`)과 결과 컬럼명, `as_index=False` 유무에 따른 키 위치를 묻는다."
        ],
        terms: ["named-aggregation", "aggregation", "groupby"]
      },
      {
        id: "a-2-3-q03", node: "a-2-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'k': ['a', 'b', 'a'], 'v': [1, 2, 3]})",
          "print(df.groupby('k').filter(lambda g: len(g) > 1)['v'].tolist())"
        ],
        lang: "python",
        choices: ["[1, 3]", "[2]", "[True, False, True]", "[4]"],
        answer: 0,
        explanation: [
          "**정답: ①** [[filter|`groupby(...).filter(func)`]]는 **그룹 단위**로 `func`를 평가해 True인 그룹에 속한 **행들을 원본 형태로** 돌려준다. 그룹 'a'는 2행(len 2 > 1 → 통과), 'b'는 1행(탈락)이므로 'a' 행들의 v인 `[1, 3]`이 남는다.",
          "",
          "- ② 'b'만 남긴 것으로, 조건이 반대다.",
          "- ③ 불리언 마스크를 돌려주는 것이 아니라 **행 자체**를 돌려준다. 마스크가 필요하면 `transform('size') > 1`을 쓴다.",
          "- ④ `[4]`는 그룹 합(`agg('sum')`)이다. `filter`는 집계하지 않는다.",
          "",
          "시험에서는 `filter`(그룹 조건 → 행 반환)와 불리언 인덱싱(행 조건), `agg`(집계)의 결과 형태 차이를 묻는다."
        ],
        terms: ["filter", "groupby"]
      },
      {
        id: "a-2-3-q04", node: "a-2-3", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "`pivot`, `pivot_table`, `crosstab`에 대한 설명으로 옳은 것은?",
        choices: [
          "`pivot`은 `aggfunc` 기본값이 `'mean'`이라 중복 키를 자동으로 평균한다.",
          "`pivot_table`은 집계 함수를 쓸 수 없어 (index, columns) 조합이 중복이면 오류가 난다.",
          "`crosstab`은 두 수치형 컬럼의 상관계수 행렬을 만든다.",
          "`pivot_table`은 중복 키를 `aggfunc`(기본 `'mean'`)로 집계하고, `pivot`은 중복 키가 있으면 `ValueError`가 난다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[pivot-table|`pivot_table`]]은 집계가 들어간 재구조화라 같은 (index, columns) 조합이 여러 행이면 `aggfunc`(기본 평균)로 합친다. [[pivot|`pivot`]]은 단순 모양 바꾸기라 집계 함수가 없고, 조합이 중복이면 `ValueError: Index contains duplicate entries, cannot reshape`가 난다.",
          "",
          "- ① `pivot`에는 `aggfunc` 인자 자체가 없다. `aggfunc` 기본 `'mean'`은 `pivot_table`의 이야기다.",
          "- ② 설명이 `pivot`과 뒤바뀌었다.",
          "- ③ [[crosstab|`crosstab(a, b)`]]은 두 **범주형** 변수의 **빈도표**(교차표)를 만든다. 상관계수 행렬은 `df.corr()`.",
          "",
          "시험에서는 '중복 키가 있을 때 오류가 나는 것은?', '기본 aggfunc는?', '교차 빈도표를 만드는 함수는?' 세 가지가 번갈아 나온다."
        ],
        terms: ["pivot-table", "pivot", "crosstab"]
      },
      {
        id: "a-2-3-q05", node: "a-2-3", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'id': [1, 2], 'x': [10, 20], 'y': [30, 40]})",
          "m = df.melt(id_vars='id', value_vars=['x', 'y'])",
          "print(m.shape, m['variable'].tolist())"
        ],
        lang: "python",
        choices: [
          "(2, 3) ['x', 'y']",
          "(4, 3) ['x', 'x', 'y', 'y']",
          "(4, 2) ['x', 'y', 'x', 'y']",
          "(2, 4) ['id', 'x', 'y', 'value']"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[melt|`melt`]]는 넓은(wide) 형식을 긴(long) 형식으로 바꾼다. `value_vars` 두 컬럼(x, y)이 각각 행으로 풀리므로 행 수는 2 × 2 = **4**, 컬럼은 `id`, `variable`, `value` **3개**다. `variable`에는 원래 컬럼명이 들어가며 x들이 먼저, y들이 뒤에 쌓인다.",
          "",
          "- ① 행이 늘지 않는다고 본 오답이다. 컬럼 수만큼 행이 곱해진다.",
          "- ③ 컬럼은 `id`를 포함해 3개이고, 순서도 컬럼별로 묶여 `['x', 'x', 'y', 'y']`다.",
          "- ④ 원본 모양에 value를 덧붙인 것이 아니다.",
          "",
          "시험에서는 `melt` 결과의 **행 수와 컬럼명**(`var_name`, `value_name`으로 바꿀 수 있음), 그리고 역변환이 `pivot`임을 묻는다."
        ],
        terms: ["melt", "pivot"]
      },
      {
        id: "a-2-3-q06", node: "a-2-3", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드를 실행했을 때의 결과로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'k': ['a', 'a'], 'c': ['x', 'x'], 'v': [1, 2]})",
          "print(df.pivot(index='k', columns='c', values='v'))"
        ],
        lang: "python",
        choices: [
          "`ValueError`(Index contains duplicate entries, cannot reshape)가 발생한다.",
          "셀 값이 평균 1.5인 1×1 표가 출력된다.",
          "셀 값이 합 3인 1×1 표가 출력된다.",
          "셀 값이 마지막 값 2인 1×1 표가 출력된다."
        ],
        answer: 0,
        explanation: [
          "**정답: ①** (k='a', c='x') 조합이 두 행이라 [[pivot|`pivot`]]은 한 셀에 넣을 값을 정할 수 없어 `ValueError: Index contains duplicate entries, cannot reshape`를 던진다. 중복을 **집계해서** 넣고 싶으면 `df.pivot_table(index='k', columns='c', values='v', aggfunc='mean')`(결과 1.5) 또는 `aggfunc='sum'`(결과 3)을 쓴다.",
          "",
          "- ② [[pivot-table|`pivot_table`]] 기본 `aggfunc='mean'`일 때의 결과다.",
          "- ③ `pivot_table(aggfunc='sum')`일 때의 결과다.",
          "- ④ `pivot_table(aggfunc='last')`일 때의 결과다. `pivot`은 어느 것도 자동으로 고르지 않는다.",
          "",
          "시험에서는 `pivot` 오류 메시지를 보여 주고 원인(중복 키)과 해결(`pivot_table` + `aggfunc`)을 고르게 한다."
        ],
        terms: ["pivot", "pivot-table", "aggregation"]
      },
      {
        id: "a-2-3-q07", node: "a-2-3", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([5, 6, 10, 0])",
          "print(pd.cut(s, bins=[0, 5, 10], labels=['L', 'H']).tolist())"
        ],
        lang: "python",
        choices: [
          "['L', 'H', 'H', 'L']",
          "['H', 'H', nan, 'L']",
          "['L', 'H', 'H', nan]",
          "['L', 'L', 'H', 'L']"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[binning|`pd.cut`]]의 기본은 `right=True`라 구간이 **오른쪽 닫힘** `(0, 5]`, `(5, 10]`이다. 5는 `(0, 5]`에 들어 'L', 6과 10은 `(5, 10]`에 들어 'H', **0은 어느 구간에도 속하지 않아 `NaN`** 이 된다(`include_lowest=True`를 주면 0도 'L').",
          "",
          "- ① 0이 'L'에 들어간다고 본 오답이다. 왼쪽 끝 경계값은 기본에서 제외된다.",
          "- ② `right=False`(`[0, 5)`, `[5, 10)`)일 때의 결과다. 그때는 10이 NaN이 된다.",
          "- ④ 6이 'L'일 수는 없다.",
          "",
          "시험에서는 경계값(5, 0, 10)이 어느 구간에 들어가는지, `right`/`include_lowest`의 효과, 그리고 등빈도 구간을 만드는 `qcut`과의 차이를 묻는다."
        ],
        terms: ["binning", "missing-value"]
      },
      {
        id: "a-2-3-q08", node: "a-2-3", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`pd.crosstab(df['dept'], df['year'])`는 별도 옵션이 없으면 두 범주 조합의 **빈도(count)** 를 집계한 교차표를 만든다.",
        answer: true,
        explanation: [
          "**정답: O** [[crosstab|`crosstab`]]의 기본 집계는 **빈도**다. `values=`와 `aggfunc=`를 함께 주면 다른 집계(예: 평균)도 가능하고, `normalize='index'|'columns'|'all'`로 비율표, `margins=True`로 합계 행·열을 붙일 수 있다.",
          "",
          "같은 빈도표를 `pd.pivot_table(df, index='dept', columns='year', aggfunc='size', fill_value=0)`나 `df.groupby(['dept', 'year']).size().unstack(fill_value=0)`으로도 만들 수 있다. 셋이 같은 결과라는 점이 자주 출제된다.",
          "",
          "시험에서는 `crosstab`의 기본 집계(빈도)와 `normalize` 옵션, 그리고 카이제곱 검정(chi-square test) 입력으로 쓰이는 흐름을 묻는다."
        ],
        terms: ["crosstab", "pivot-table"]
      },
      {
        id: "a-2-3-q09", node: "a-2-3", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`cumsum()`은 집계(aggregation) 함수이므로 Series에 적용하면 길이 1의 결과를 돌려준다.",
        answer: false,
        explanation: [
          "**정답: X** [[cumulative|`cumsum`/`cummax`/`cumcount`]]는 **누적(cumulative)** 연산으로 각 위치까지의 누적값을 돌려주므로 결과 길이가 **원본과 같다**. 예: `pd.Series([1, 2, 3]).cumsum()` → `[1, 3, 6]`. 길이를 1로 줄이는 것은 `sum()` 같은 [[aggregation|집계(aggregation)]]다.",
          "",
          "`groupby` 뒤에 붙이면 그룹별 누적이 되어 역시 원본 길이다(`df.groupby('k')['v'].cumsum()`). `rank`, `shift`, `diff`, `pct_change`도 같은 부류(원본 길이 유지)다.",
          "",
          "시험에서는 '다음 중 집계 함수가 아닌 것'에 `cumsum`·`rank`·`transform`을 섞어 두거나, groupby 뒤 `cumsum` 결과 길이를 묻는다."
        ],
        terms: ["cumulative", "aggregation"]
      },
      {
        id: "a-2-3-q10", node: "a-2-3", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 메서드 이름을 쓰시오. 그룹별로 평균과 최댓값을 한 번에 구한다: `df.groupby('k')['v'].____(['mean', 'max'])`",
        answer: "agg",
        accept: ["agg()", "aggregate", "aggregate()"],
        explanation: [
          "**정답: agg** `agg`(= `aggregate`)에 함수 이름 **리스트**를 주면 각 함수가 컬럼이 되는 DataFrame을 돌려준다(컬럼명 `mean`, `max`). 딕셔너리를 주면 컬럼별로 다른 함수를, `이름=(컬럼, 함수)` 형태를 주면 [[named-aggregation|이름 붙인 집계]]를 할 수 있다. 결과 길이는 그룹 수다([[aggregation|집계(aggregation)]]).",
          "",
          "`agg('mean', 'max')`처럼 위치 인자로 나열하면 두 번째 인자가 함수의 추가 인자로 넘어가 오류가 난다. 반드시 리스트로 감싼다.",
          "",
          "시험에서는 `agg`의 세 가지 입력 형태(문자열·리스트·딕셔너리)와 결과 컬럼 구조(단일/다중 레벨)를 묻는다."
        ],
        terms: ["aggregation", "named-aggregation", "groupby"]
      },
      {
        id: "a-2-3-q11", node: "a-2-3", type: "short", kind: "concept", difficulty: 2,
        prompt: "컬럼마다 월별 매출이 옆으로 펼쳐진 넓은(wide) 형식의 DataFrame을, (id, month, sales) 세 컬럼의 긴(long) 형식으로 바꾸는 pandas 메서드 이름을 쓰시오.",
        answer: "melt",
        accept: ["melt()"],
        explanation: [
          "**정답: melt** [[melt|`melt(id_vars=, value_vars=, var_name=, value_name=)`]]는 wide → long 변환이다. `id_vars`는 그대로 남길 식별 컬럼, `value_vars`는 행으로 풀 컬럼들이며, 풀린 컬럼명은 `variable`(또는 `var_name`), 값은 `value`(또는 `value_name`)에 들어간다.",
          "",
          "반대 방향(long → wide)은 [[pivot|`pivot`]](집계 없음)이나 `pivot_table`(집계 있음)이다. 인덱스 레벨 기준으로는 `stack`(컬럼→행)과 [[unstack|`unstack`]](행→컬럼)이 짝이다.",
          "",
          "시험에서는 wide/long 용어와 `melt`↔`pivot`, `stack`↔`unstack`의 짝을 묻는다."
        ],
        terms: ["melt", "pivot", "unstack"]
      },
      {
        id: "a-2-3-q12", node: "a-2-3", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드가 출력하는 값을 쓰시오.",
        code: [
          "import pandas as pd",
          "s = pd.Series([10, 20, 20, 30])",
          "print(s.rank(method='dense').max())"
        ],
        lang: "python",
        answer: "3",
        accept: ["3.0"],
        explanation: [
          "**정답: 3** [[rank|`rank`]]는 기본 오름차순으로 순위를 매기고, 동점(tie)을 다루는 방식이 `method`에 따라 다르다. `'dense'`는 동점에 같은 순위를 주고 **다음 순위를 건너뛰지 않으므로** 10→1, 20→2, 20→2, 30→**3**이 되어 최댓값은 3이다(출력은 `3.0`).",
          "",
          "비교: `method='min'`이면 `[1, 2, 2, 4]`(최댓값 4), 기본 `'average'`면 `[1, 2.5, 2.5, 4]`, `'first'`면 등장 순서로 `[1, 2, 3, 4]`.",
          "",
          "시험에서는 작은 Series에 `method='average'|'min'|'dense'|'first'`를 적용한 결과를 비교하게 한다. `dense`만 최대 순위가 고유값 수와 같다는 점을 기억한다."
        ],
        terms: ["rank"]
      }
    ],

    /* ───────────────────────── 실습 과제 ───────────────────────── */
    practices: [
      /* a-2-1 */
      {
        id: "a-2-1-p01", node: "a-2-1",
        title: "조건을 만족하는 행 수 세기",
        difficulty: 1,
        task: [
          "`df`에서 나이(`age`)가 **30 이상**이면서 도시(`city`)가 **'Seoul'** 인 행의 개수를 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2101)",
          "n = 200",
          "df = pd.DataFrame({",
          "    'id': np.arange(1, n + 1),",
          "    'city': rng.choice(['Seoul', 'Busan', 'Daegu', 'Incheon'], size=n, p=[0.4, 0.25, 0.2, 0.15]),",
          "    'age': rng.integers(20, 60, size=n),",
          "    'income': rng.normal(4200, 900, size=n).round(0),",
          "    'score': rng.uniform(0, 100, size=n).round(1),",
          "})",
          "df.head()"
        ],
        hint: ["두 조건을 각각 괄호로 감싸고 `&`로 묶는다. 불리언 Series의 `sum()`이 True의 개수다."],
        answer: { type: "int", value: 59 },
        solution: [
          "mask = (df['age'] >= 30) & (df['city'] == 'Seoul')",
          "int(mask.sum())"
        ],
        explanation: [
          "[[boolean-indexing|불리언 인덱싱]]의 기본형. `and`가 아니라 `&`를 써야 하고, 비교 연산자보다 `&`의 우선순위가 높아 **괄호가 필수**다.",
          "`len(df[mask])`로 세어도 같다. `df.query(\"age >= 30 and city == 'Seoul'\")`도 가능하다."
        ],
        terms: ["boolean-indexing", "dataframe"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-1-p02", node: "a-2-1",
        title: "조건 선택 후 특정 컬럼의 평균",
        difficulty: 2,
        task: [
          "`df`에서 도시(`city`)가 **'Busan'** 인 행만 골라 소득(`income`)의 평균을 구하고, 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2101)",
          "n = 200",
          "df = pd.DataFrame({",
          "    'id': np.arange(1, n + 1),",
          "    'city': rng.choice(['Seoul', 'Busan', 'Daegu', 'Incheon'], size=n, p=[0.4, 0.25, 0.2, 0.15]),",
          "    'age': rng.integers(20, 60, size=n),",
          "    'income': rng.normal(4200, 900, size=n).round(0),",
          "    'score': rng.uniform(0, 100, size=n).round(1),",
          "})",
          "df.head()"
        ],
        hint: ["`df.loc[행 조건, '컬럼']` 한 번으로 행과 열을 동시에 고른 뒤 `.mean()`."],
        answer: { type: "number", value: 4113.34, decimals: 2 },
        solution: [
          "round(df.loc[df['city'] == 'Busan', 'income'].mean(), 2)"
        ],
        explanation: [
          "[[loc|`loc[조건, 컬럼]`]]은 행 조건과 열 선택을 한 번에 처리하는 가장 안전한 형태다. `df[df['city'] == 'Busan']['income'].mean()`도 결과는 같지만, 거기에 **대입**까지 하면 뷰/복사 문제가 생기므로 읽기 전용일 때만 쓴다.",
          "반올림은 `round(x, 2)` 또는 `x.round(2)`."
        ],
        terms: ["loc", "boolean-indexing", "view-copy"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-1-p03", node: "a-2-1",
        title: "상위 25% 점수 집단의 최빈 도시",
        difficulty: 3,
        task: [
          "`df`에서 점수(`score`)가 **전체 0.75 분위수(quantile) 이상**인 행만 골라, 그 행들의 도시(`city`) 값 중 **가장 자주 나오는 도시 이름**을 문자열로 입력하시오(예: `Seoul`)."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2101)",
          "n = 200",
          "df = pd.DataFrame({",
          "    'id': np.arange(1, n + 1),",
          "    'city': rng.choice(['Seoul', 'Busan', 'Daegu', 'Incheon'], size=n, p=[0.4, 0.25, 0.2, 0.15]),",
          "    'age': rng.integers(20, 60, size=n),",
          "    'income': rng.normal(4200, 900, size=n).round(0),",
          "    'score': rng.uniform(0, 100, size=n).round(1),",
          "})",
          "df.head()"
        ],
        hint: [
          "`df['score'].quantile(0.75)`로 경계값을 구한다.",
          "`value_counts()`의 첫 인덱스 또는 `mode()[0]`이 최빈값이다."
        ],
        answer: { type: "string", value: "Seoul" },
        solution: [
          "top = df[df['score'] >= df['score'].quantile(0.75)]",
          "top['city'].value_counts().index[0]"
        ],
        explanation: [
          "조건 선택([[boolean-indexing|불리언 인덱싱]]) → 범주 빈도([[value-counts|`value_counts`]]) → 첫 인덱스(빈도 내림차순 정렬이라 최빈값)의 3단계다.",
          "`top['city'].mode()[0]`도 같다. 동률이 있으면 `mode()`는 여러 값을 돌려주므로 `value_counts()`로 빈도를 직접 확인하는 습관이 좋다."
        ],
        terms: ["boolean-indexing", "value-counts", "descriptive-statistics"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },

      /* a-2-2 */
      {
        id: "a-2-2-p01", node: "a-2-2",
        title: "전체 결측값 개수",
        difficulty: 1,
        task: [
          "`df` 전체에서 결측값(missing value)의 **총 개수**를 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2202)",
          "n = 300",
          "df = pd.DataFrame({",
          "    'order_id': np.arange(1, n + 1),",
          "    'category': rng.choice(['food', 'book', 'toy'], size=n),",
          "    'qty': rng.integers(1, 10, size=n).astype(float),",
          "    'price': rng.normal(20000, 5000, size=n).round(-2),",
          "})",
          "df.loc[rng.choice(n, 30, replace=False), 'qty'] = np.nan     # 결측 주입",
          "df.loc[rng.choice(n, 20, replace=False), 'price'] = np.nan",
          "df.head()"
        ],
        hint: ["`isna()`는 같은 모양의 불리언 표. `sum()`을 두 번 하면 전체 개수."],
        answer: { type: "int", value: 50 },
        solution: ["int(df.isna().sum().sum())"],
        explanation: [
          "`df.isna().sum()`은 **컬럼별** [[missing-value|결측값]] 개수(Series), 거기에 `.sum()`을 한 번 더 하면 전체 개수다. `df.isna().values.sum()`도 같다.",
          "`info()`의 Non-Null Count 와 행 수의 차이로도 확인할 수 있다."
        ],
        terms: ["missing-value"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-2-p02", node: "a-2-2",
        title: "중앙값으로 대치한 뒤 평균",
        difficulty: 2,
        task: [
          "`df`의 수량(`qty`) 결측값을 **`qty`의 중앙값(median)** 으로 채운 뒤, 채워진 `qty`의 평균을 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2202)",
          "n = 300",
          "df = pd.DataFrame({",
          "    'order_id': np.arange(1, n + 1),",
          "    'category': rng.choice(['food', 'book', 'toy'], size=n),",
          "    'qty': rng.integers(1, 10, size=n).astype(float),",
          "    'price': rng.normal(20000, 5000, size=n).round(-2),",
          "})",
          "df.loc[rng.choice(n, 30, replace=False), 'qty'] = np.nan     # 결측 주입",
          "df.loc[rng.choice(n, 20, replace=False), 'price'] = np.nan",
          "df.head()"
        ],
        hint: ["`fillna`에 `df['qty'].median()`을 넘긴다. 중앙값은 결측을 자동으로 제외하고 계산된다."],
        answer: { type: "number", value: 5.21, decimals: 2 },
        solution: ["round(df['qty'].fillna(df['qty'].median()).mean(), 2)"],
        explanation: [
          "수치형 결측의 교과서적 [[imputation|대치(imputation)]]는 **중앙값**이다(평균은 이상치에 민감). `median()`·`mean()`은 기본 `skipna=True`라 결측을 빼고 계산한다.",
          "`fillna`는 새 Series를 돌려주므로 원본 `df['qty']`는 바뀌지 않는다. 바꾸려면 `df['qty'] = ...`로 대입한다."
        ],
        terms: ["imputation", "missing-value"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-2-p03", node: "a-2-2",
        title: "문자열 정제 → 중복 제거 → IQR 이상치 제거",
        difficulty: 3,
        task: [
          "`raw`의 가격(`price`)은 `'31,200원'`처럼 쉼표와 '원'이 붙은 문자열이다. 다음 순서로 정제한 뒤 **남는 행 수**를 정수로 입력하시오.",
          "- 1. 쉼표와 '원'을 제거해 숫자형으로 변환",
          "- 2. 완전히 같은 행(중복)을 제거",
          "- 3. IQR 규칙(Q1 − 1.5·IQR 미만 또는 Q3 + 1.5·IQR 초과)에 해당하는 이상치 행을 제거"
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2203)",
          "n = 250",
          "base = rng.normal(30000, 6000, size=n).round(-2)",
          "base[:6] = [95000, 99000, 120000, 2000, 1500, 150000]      # 극단값 주입",
          "raw = pd.DataFrame({",
          "    'item': rng.choice(['A', 'B', 'C'], size=n),",
          "    'price': [f'{int(v):,}원' for v in base],",
          "})",
          "raw = pd.concat([raw, raw.iloc[:10]], ignore_index=True)   # 중복 행 주입",
          "raw.head()"
        ],
        hint: [
          "`.str.replace(',', '').str.replace('원', '')` 뒤 `pd.to_numeric`.",
          "`quantile([0.25, 0.75])`로 Q1, Q3를 한 번에 구한다."
        ],
        answer: { type: "int", value: 210 },
        solution: [
          "p = raw['price'].str.replace(',', '').str.replace('원', '')",
          "d = raw.assign(price=pd.to_numeric(p)).drop_duplicates()",
          "q1, q3 = d['price'].quantile([0.25, 0.75])",
          "iqr = q3 - q1",
          "keep = (d['price'] >= q1 - 1.5 * iqr) & (d['price'] <= q3 + 1.5 * iqr)",
          "int(keep.sum())"
        ],
        explanation: [
          "정제의 표준 순서다. [[string-accessor|`.str` 접근자]]로 기호를 떼고 [[type-casting|`to_numeric`]]으로 숫자화, `drop_duplicates()`로 [[duplicate|중복]] 제거, 마지막에 [[iqr|IQR 규칙]]으로 [[outlier|이상치]]를 걸러낸다.",
          "중복 제거를 먼저 하는 이유는 같은 행이 여러 번 들어가면 분위수(Q1·Q3)가 왜곡되기 때문이다. 순서를 바꾸면 답이 달라질 수 있다."
        ],
        terms: ["string-accessor", "type-casting", "duplicate", "iqr", "outlier"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },

      /* a-2-3 */
      {
        id: "a-2-3-p01", node: "a-2-3",
        title: "인원이 가장 많은 부서의 인원 수",
        difficulty: 1,
        task: [
          "`df`를 부서(`dept`)별로 묶어 각 부서의 **행 수**를 구하고, 그중 **최댓값**을 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2301)",
          "n = 180",
          "df = pd.DataFrame({",
          "    'dept': rng.choice(['HR', 'IT', 'Sales', 'Ops'], size=n),",
          "    'year': rng.choice([2022, 2023, 2024], size=n),",
          "    'salary': rng.normal(5200, 700, size=n).round(0),",
          "})",
          "df.head()"
        ],
        hint: ["`groupby('dept').size()` 또는 `df['dept'].value_counts()` 뒤에 `.max()`."],
        answer: { type: "int", value: 54 },
        solution: ["int(df.groupby('dept').size().max())"],
        explanation: [
          "[[groupby|`groupby`]] 뒤의 `size()`는 그룹별 **행 수**를 돌려주는 [[aggregation|집계]]다(결측 포함). `count()`는 컬럼별 비결측 수라 DataFrame이 나온다.",
          "`df['dept'].value_counts().max()`, `df['dept'].value_counts().iloc[0]`도 같은 값이다."
        ],
        terms: ["groupby", "aggregation", "value-counts"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-3-p02", node: "a-2-3",
        title: "부서 평균 대비 급여 차이의 최댓값",
        difficulty: 2,
        task: [
          "`df`에서 각 행의 급여(`salary`)에서 **그 행이 속한 부서(`dept`)의 평균 급여**를 뺀 값을 구하고, 그 차이의 **최댓값**을 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2301)",
          "n = 180",
          "df = pd.DataFrame({",
          "    'dept': rng.choice(['HR', 'IT', 'Sales', 'Ops'], size=n),",
          "    'year': rng.choice([2022, 2023, 2024], size=n),",
          "    'salary': rng.normal(5200, 700, size=n).round(0),",
          "})",
          "df.head()"
        ],
        hint: ["`groupby('dept')['salary'].transform('mean')`은 원본과 같은 길이라 바로 뺄 수 있다."],
        answer: { type: "number", value: 1785.7, decimals: 2 },
        solution: [
          "diff = df['salary'] - df.groupby('dept')['salary'].transform('mean')",
          "round(diff.max(), 2)"
        ],
        explanation: [
          "[[transform|`transform('mean')`]]은 부서 평균을 **각 행에 브로드캐스트**하므로 원본 `salary`와 길이가 같아 바로 뺄 수 있다. `agg('mean')`을 쓰면 길이가 4(부서 수)라 뺄셈이 인덱스 정렬 때문에 NaN으로 가득 찬다.",
          "같은 패턴으로 그룹별 표준화(z-score)나 그룹별 결측 대치도 할 수 있다."
        ],
        terms: ["transform", "groupby", "broadcasting"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-3-p03", node: "a-2-3",
        title: "피벗 테이블의 최대 셀",
        difficulty: 3,
        task: [
          "`df`로 행 = 부서(`dept`), 열 = 연도(`year`), 값 = 급여(`salary`)의 **합계**인 피벗 테이블을 만들고(빈 칸은 0), 표 전체에서 **가장 큰 셀 값**을 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(2301)",
          "n = 180",
          "df = pd.DataFrame({",
          "    'dept': rng.choice(['HR', 'IT', 'Sales', 'Ops'], size=n),",
          "    'year': rng.choice([2022, 2023, 2024], size=n),",
          "    'salary': rng.normal(5200, 700, size=n).round(0),",
          "})",
          "df.head()"
        ],
        hint: [
          "`pd.pivot_table(df, index='dept', columns='year', values='salary', aggfunc='sum', fill_value=0)`.",
          "DataFrame 전체의 최댓값은 `.max().max()` 또는 `.values.max()`."
        ],
        answer: { type: "int", value: 102583 },
        solution: [
          "pt = pd.pivot_table(df, index='dept', columns='year', values='salary', aggfunc='sum', fill_value=0)",
          "int(pt.values.max())"
        ],
        explanation: [
          "[[pivot-table|`pivot_table`]]은 두 키(dept × year)로 [[aggregation|집계]]한 교차표다. `aggfunc` 기본값은 `'mean'`이므로 합계는 **명시**해야 하고, 조합이 없는 칸은 `fill_value=0`으로 채운다.",
          "`df.groupby(['dept', 'year'])['salary'].sum().unstack(fill_value=0)`도 같은 표를 만든다 — groupby 결과의 [[multiindex|다중 인덱스]] 한 레벨을 [[unstack|`unstack`]]으로 컬럼에 올리는 것이 피벗의 본질이다.",
          "`pt.max()`는 열별 최댓값 Series이므로 한 번 더 `.max()`가 필요하다."
        ],
        terms: ["pivot-table", "aggregation", "unstack", "multiindex"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      }
    ],

    /* ───────────────────────── 용어 사전 ───────────────────────── */
    terms: [
      /* 2-1 */
      { id: "series", ko: "시리즈", en: "Series",
        def: "pandas의 1차원 자료구조. 값 배열과 인덱스(레이블)를 함께 가지며 단일 dtype을 갖는다. DataFrame의 한 컬럼이 Series다.",
        nodes: ["a-2-1"], related: ["dataframe", "index", "dtype"] },
      { id: "dataframe", ko: "데이터프레임", en: "DataFrame",
        def: "pandas의 2차원 표 자료구조. 같은 인덱스를 공유하는 여러 Series(컬럼)로 이루어지며 컬럼마다 dtype이 다를 수 있다.",
        nodes: ["a-2-1"], related: ["series", "index"] },
      { id: "index", ko: "인덱스", en: "index / label",
        def: "Series와 DataFrame의 행(또는 열)에 붙는 레이블. 정렬·정합(alignment)·선택의 기준이 되며 loc 접근자가 참조한다.",
        nodes: ["a-2-1"], related: ["loc", "multiindex"] },
      { id: "dtype", ko: "자료형", en: "dtype (data type)",
        def: "Series(컬럼)에 저장된 값의 데이터 타입. int64, float64, bool, object/str, datetime64, category 등이 있다.",
        nodes: ["a-2-1", "a-2-2"], related: ["type-casting", "categorical"] },
      { id: "loc", ko: "레이블 기반 선택", en: "loc (label-based indexing)",
        def: "행·열을 인덱스 레이블로 선택하는 접근자. 슬라이스의 끝 레이블을 포함하며 불리언 마스크도 받는다.",
        nodes: ["a-2-1"], related: ["iloc", "index", "boolean-indexing"] },
      { id: "iloc", ko: "위치 기반 선택", en: "iloc (integer-location indexing)",
        def: "행·열을 0부터 시작하는 정수 위치로 선택하는 접근자. 파이썬 슬라이스처럼 끝 위치를 제외한다.",
        nodes: ["a-2-1"], related: ["loc"] },
      { id: "boolean-indexing", ko: "불리언 인덱싱", en: "boolean indexing / boolean mask",
        def: "조건식으로 만든 True/False Series(마스크)로 행을 선택하는 방법. 조건 결합은 &, |, ~ 와 괄호를 쓴다.",
        nodes: ["a-2-1"], related: ["loc"] },
      { id: "view-copy", ko: "뷰와 복사", en: "view vs copy",
        def: "부분 선택 결과가 원본 메모리를 공유하는지(뷰) 독립적인지(복사)의 구분. 애매한 경우 .copy()를 명시하고, 원본 수정은 loc 한 번의 대입으로 한다.",
        nodes: ["a-2-1"], related: ["loc"] },
      { id: "read-csv", ko: "CSV 읽기", en: "read_csv",
        def: "구분자로 나뉜 텍스트 파일을 DataFrame으로 읽는 함수. sep, header, names, index_col, usecols, dtype, parse_dates, na_values, encoding 등의 옵션을 갖는다.",
        nodes: ["a-2-1"], related: ["dataframe"] },
      { id: "value-counts", ko: "빈도 집계", en: "value_counts",
        def: "Series의 고유값별 등장 횟수를 빈도 내림차순으로 돌려주는 메서드. normalize=True면 비율을 돌려준다.",
        nodes: ["a-2-1"], related: ["descriptive-statistics", "aggregation"] },
      { id: "descriptive-statistics", ko: "기술통계", en: "descriptive statistics",
        def: "데이터의 분포를 개수·평균·표준편차·최소·사분위수·최대 등으로 요약하는 통계. pandas에서는 describe()가 수치형 컬럼에 대해 한 번에 계산한다.",
        nodes: ["a-2-1"], related: ["value-counts", "iqr"] },
      { id: "sort", ko: "정렬", en: "sort (sort_values / sort_index)",
        def: "값 기준(sort_values) 또는 인덱스 기준(sort_index)으로 행을 재배열하는 연산. 여러 키와 키별 오름·내림차순을 리스트로 지정할 수 있다.",
        nodes: ["a-2-1"], related: ["rank"] },

      /* 2-2 */
      { id: "missing-value", ko: "결측값", en: "missing value (NaN / None / NaT)",
        def: "관측되지 않았거나 기록되지 않은 값. pandas에서는 NaN(수치), None, NaT(날짜)로 표현되며 isna()로 탐지한다.",
        nodes: ["a-2-2", "a-2-1"], related: ["imputation", "interpolation"] },
      { id: "imputation", ko: "결측값 대치", en: "imputation",
        def: "결측값을 평균·중앙값·최빈값·앞뒤 값·모델 예측값 등 추정값으로 채우는 처리. pandas 의 fillna, ffill, bfill 이 기본 도구이고 sklearn 의 SimpleImputer(strategy='mean'|'median'|'most_frequent') 는 학습 세트 통계로 fit 해 적용한다.",
        nodes: ["a-2-2"], related: ["missing-value", "interpolation"] },
      { id: "interpolation", ko: "보간", en: "interpolation",
        def: "알려진 이웃 값(데이터 점) 사이의 값을 추정해 결측을 채우는 방법. pandas interpolate() 의 기본 method='linear' 는 행 위치 기준, method='time' 은 실제 시간 간격에 비례하며, scipy.interpolate.interp1d 도 같은 일을 한다.",
        nodes: ["a-2-2"], related: ["imputation", "missing-value"] },
      { id: "duplicate", ko: "중복", en: "duplicate",
        def: "지정한 컬럼(subset) 기준으로 값이 완전히 같은 행. duplicated()로 탐지하고 drop_duplicates(keep=)로 제거한다.",
        nodes: ["a-2-2"], related: [] },
      { id: "type-casting", ko: "형 변환", en: "type casting / type conversion",
        def: "컬럼의 dtype을 다른 타입으로 바꾸는 처리. astype은 실패 시 예외를 내고, to_numeric·to_datetime은 errors='coerce'로 실패 값을 NaN/NaT로 바꿀 수 있다.",
        nodes: ["a-2-2"], related: ["dtype", "datetime"] },
      { id: "datetime", ko: "날짜시간형", en: "datetime64 / Timestamp",
        def: "날짜와 시각을 나타내는 pandas 자료형. to_datetime으로 변환하고 .dt 접근자로 연·월·일·요일 등을 추출한다.",
        nodes: ["a-2-2"], related: ["type-casting"] },
      { id: "string-accessor", ko: "문자열 접근자", en: ".str accessor",
        def: "문자열 Series의 각 원소에 요소별로 문자열 메서드(strip, lower, replace, contains, split, len 등)를 적용하는 접근자.",
        nodes: ["a-2-2"], related: ["type-casting"] },
      { id: "outlier", ko: "이상치", en: "outlier",
        def: "다른 관측값들과 동떨어진 극단적인 값. IQR 규칙이나 z-점수로 판정하며 제거·대체·clip 등으로 처리한다.",
        nodes: ["a-2-2"], related: ["iqr", "z-score", "clip"] },
      { id: "iqr", ko: "사분위 범위", en: "IQR (interquartile range)",
        def: "3사분위수(Q3)와 1사분위수(Q1)의 차이. [Q1 − 1.5·IQR, Q3 + 1.5·IQR] 밖의 값을 이상치로 보는 규칙에 쓰인다.",
        nodes: ["a-2-2"], related: ["outlier", "descriptive-statistics"] },
      { id: "z-score", ko: "z-점수(표준화 점수)", en: "z-score",
        def: "값에서 평균을 빼고 표준편차로 나눈 표준화 값. 절댓값이 3(또는 2)을 넘는 관측치를 이상치로 보는 기준에 쓰인다.",
        nodes: ["a-2-2"], related: ["outlier"] },
      { id: "categorical", ko: "카테고리형", en: "categorical dtype",
        def: "고유값 목록(categories)과 정수 코드(codes)로 범주 데이터를 저장하는 pandas dtype. 메모리를 줄이고 순서(ordered) 비교를 지원한다.",
        nodes: ["a-2-2"], related: ["dtype"] },
      { id: "clip", ko: "경계값 절단", en: "clip",
        def: "지정한 하한·상한 밖의 값을 각 경계값으로 바꾸는 메서드. 행을 제거하지 않고 이상치의 영향을 줄인다.",
        nodes: ["a-2-2"], related: ["outlier"] },
      { id: "map", ko: "매핑", en: "map",
        def: "Series의 각 값을 딕셔너리·함수·Series로 대응시켜 바꾸는 메서드. 딕셔너리에 없는 값은 NaN이 된다.",
        nodes: ["a-2-2"], related: ["replace", "apply"] },
      { id: "replace", ko: "값 치환", en: "replace",
        def: "지정한 값(들)을 다른 값으로 바꾸는 메서드. 딕셔너리에 없는 값은 그대로 유지된다는 점이 map과 다르다.",
        nodes: ["a-2-2"], related: ["map"] },

      /* 2-3 */
      { id: "groupby", ko: "그룹화", en: "groupby / group-by",
        def: "키 컬럼 값이 같은 행끼리 묶어 각 묶음에 함수를 적용하는 연산. 분할-적용-결합 패턴의 구현.",
        nodes: ["a-2-3"], related: ["aggregation", "transform", "split-apply-combine"] },
      { id: "split-apply-combine", ko: "분할-적용-결합", en: "split-apply-combine",
        def: "데이터를 키별로 나누고(split), 각 조각에 함수를 적용하고(apply), 결과를 하나로 합치는(combine) 그룹 연산의 일반 패턴.",
        nodes: ["a-2-3"], related: ["groupby"] },
      { id: "aggregation", ko: "집계", en: "aggregation / agg",
        def: "여러 값을 하나의 대표값(합·평균·개수 등)으로 줄이는 연산. 그룹당 결과가 하나다.",
        nodes: ["a-2-3"], related: ["groupby", "transform", "named-aggregation"] },
      { id: "named-aggregation", ko: "이름 붙인 집계", en: "named aggregation",
        def: "agg(새이름=(컬럼, 함수)) 형태로 결과 컬럼 이름을 직접 지정하는 집계 문법. 결과가 단일 레벨 컬럼이 된다.",
        nodes: ["a-2-3"], related: ["aggregation"] },
      { id: "transform", ko: "변환", en: "transform",
        def: "그룹별 계산 결과를 원본과 같은 길이로 돌려주는 groupby 메서드. 그룹 통계를 각 행에 붙일 때 쓴다.",
        nodes: ["a-2-3"], related: ["aggregation", "broadcasting"] },
      { id: "filter", ko: "그룹 필터", en: "groupby filter",
        def: "그룹 단위 조건 함수가 True인 그룹에 속한 행들만 원본 형태로 돌려주는 groupby 메서드.",
        nodes: ["a-2-3"], related: ["groupby", "boolean-indexing"] },
      { id: "apply", ko: "함수 적용", en: "apply",
        def: "각 그룹(또는 행·열·원소)에 임의의 함수를 적용하는 범용 메서드. 반환 모양이 함수에 따라 달라지며 agg·transform보다 느리다.",
        nodes: ["a-2-3"], related: ["aggregation", "transform", "map"] },
      { id: "pivot-table", ko: "피벗 테이블", en: "pivot table / pivot_table",
        def: "행 키와 열 키 두 축으로 값을 집계해 교차표 형태로 만드는 연산.",
        nodes: ["a-2-3"], related: ["aggregation", "pivot", "crosstab"] },
      { id: "pivot", ko: "피벗(재구조화)", en: "pivot / pivot_table",
        def: "행에 있던 범주 값을 열로 펼쳐 긴(long) 형식을 넓은(wide) 형식으로 바꾸는 재구조화. pandas pivot 은 집계 없이 바꾸며 (index, columns) 조합이 중복이면 ValueError 가 나고, 중복을 집계하려면 pivot_table 을 쓴다. 표준 SQL 은 SUM(CASE WHEN ...) 으로 구현한다.",
        nodes: ["a-2-3"], related: ["pivot-table", "melt", "unstack"] },
      { id: "crosstab", ko: "교차표", en: "crosstab / contingency table",
        def: "두 범주형 변수의 조합별 빈도를 표로 만드는 함수. normalize로 비율, margins로 합계를 추가할 수 있다.",
        nodes: ["a-2-3"], related: ["pivot-table"] },
      { id: "melt", ko: "멜트(wide→long)", en: "melt",
        def: "여러 컬럼을 variable·value 두 컬럼으로 풀어 넓은 형식을 긴 형식으로 바꾸는 메서드.",
        nodes: ["a-2-3"], related: ["pivot", "unstack"] },
      { id: "unstack", ko: "언스택", en: "stack / unstack",
        def: "행 인덱스의 한 레벨을 컬럼으로 올리는(unstack) 또는 컬럼을 행 인덱스로 내리는(stack) 재구조화 메서드. 다중 인덱스와 함께 쓴다.",
        nodes: ["a-2-3"], related: ["multiindex", "pivot"] },
      { id: "binning", ko: "구간화", en: "binning (cut / qcut)",
        def: "연속형 값을 구간으로 나눠 범주로 바꾸는 처리. cut은 값 경계 기준, qcut은 분위수 기준 등빈도 구간을 만든다.",
        nodes: ["a-2-3"], related: ["categorical"] },
      { id: "rank", ko: "순위", en: "rank / RANK()",
        def: "값의 크기 순서를 매기는 순위 연산. SQL RANK() 는 동률에 같은 순위를 주고 다음 순위를 동률 인원수만큼 건너뛰며(1,1,3) pandas rank(method='min') 에 대응한다. pandas rank 의 기본은 method='average' 이고 min·max·first·dense 로 바꿀 수 있다.",
        nodes: ["a-2-3"], related: ["sort"] },
      { id: "cumulative", ko: "누적 연산", en: "cumulative (cumsum / cummax / cumcount)",
        def: "각 위치까지의 누적 합·최댓값·개수를 원본과 같은 길이로 돌려주는 연산. 집계와 달리 길이가 줄지 않는다.",
        nodes: ["a-2-3"], related: ["aggregation", "transform"] },
      { id: "multiindex", ko: "다중 인덱스", en: "MultiIndex (hierarchical index)",
        def: "두 개 이상의 레벨로 이루어진 계층적 인덱스. 여러 키로 groupby하거나 pivot하면 생기며 unstack·reset_index로 평탄화한다.",
        nodes: ["a-2-3"], related: ["index", "unstack"] },
      { id: "broadcasting", ko: "브로드캐스팅", en: "broadcasting",
        def: "크기가 다른 배열 간 연산에서 작은 쪽을 큰 쪽의 모양에 맞춰 자동으로 늘려 맞추는 규칙.",
        nodes: ["a-2-3"], related: ["transform"] }
    ]
  });
})();
