/* ds-level2 — 파트A 2장 후반: 2-4 Pandas 병합과 결합 / 2-5 Pandas 시계열 / 2-6 Pandas 고급
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그한 용어는 전부 이 파일에서 정의.
   output 문제의 출력과 실습 정답은 pandas 3.0.6 / numpy 2.4.6 에서 실제 실행해 확인했다(2026-10-04).
   pandas 2.x 와 3.x 사이에 달라지는 동작은 정답으로 묻지 않는다. */
(function () {
  DS2.register({
    chapter: "a-2",

    /* ───────────────────────── 요약 카드 ───────────────────────── */
    cards: {
      "a-2-4": {
        node: "a-2-4",
        title: "Pandas 병합과 결합",
        summary: [
          "두 표를 **키로 맞춰 붙이는** [[merge|병합(merge)]]과 **방향으로 이어 붙이는** [[concat|결합(concat)]]을 구분하는 것이 이 토픽의 뼈대다.",
          "`merge`는 SQL [[join|조인(join)]]과 같아서 `how`(inner/left/right/outer/cross)가 남는 행을, `on`/`left_on`/`right_on`이 키를 정한다.",
          "키가 **중복**되면 행이 곱해져 늘어나고, 겹치는 컬럼에는 `suffixes`(`_x`, `_y`)가 붙는다.",
          "`join`은 인덱스 기준·`how='left'` 기본, `concat`은 `axis`·`ignore_index`·`keys`로 모양을 조절하며, 빈 자리는 [[missing-value|결측값(NaN)]]으로 채워진다."
        ],
        concepts: [
          "**병합 방식(how)**: [[inner-join|inner]]는 양쪽 모두 있는 키만, [[left-join|left]]는 왼쪽 전부 + 오른쪽 일치분, right는 그 반대, [[outer-join|outer]]는 합집합, [[cross-join|cross]]는 모든 조합(키 없음). 기본값은 `inner`.",
          "**키 지정**: 같은 이름이면 `on='k'`, 다르면 `left_on='id', right_on='uid'`. 인덱스를 키로 쓰려면 `left_index=True` / `right_index=True`.",
          "**중복 키와 행 수**: 왼쪽에 키 a가 2행, 오른쪽에 2행이면 결과는 2×2=4행. `validate='one_to_one'`(`'1:1'`), `'one_to_many'`(`'1:m'`) 등으로 중복을 검사해 [[validate|MergeError]]로 막을 수 있다.",
          "**겹치는 컬럼**: 키가 아닌 같은 이름 컬럼은 [[suffixes|접미사(suffixes)]] `_x`, `_y`가 붙는다. `indicator=True`는 각 행의 출처(`left_only`/`right_only`/`both`)를 `_merge` 컬럼으로 준다([[indicator|indicator]]).",
          "**join**: `df1.join(df2)`는 **인덱스**를 기준으로 결합하며 `how` 기본값이 `'left'`다. 컬럼명이 겹치면 `lsuffix`/`rsuffix`를 줘야 한다.",
          "**concat**: `pd.concat([a, b])`는 세로(axis=0), `axis=1`은 가로. 인덱스가 다르면 합집합(outer)으로 정렬되고 빈 칸은 NaN. `ignore_index=True`로 0부터 다시 번호, `keys=[...]`로 출처를 [[multiindex|MultiIndex]]로 남긴다.",
          "**combine_first**: `a.combine_first(b)`는 a의 결측을 b의 같은 위치 값으로 채우고 인덱스·컬럼은 합집합으로 돌려준다([[combine-first|combine_first]])."
        ],
        terms: ["merge", "join", "inner-join", "left-join", "outer-join", "cross-join", "concat", "suffixes", "indicator", "validate", "combine-first", "missing-value"],
        patterns: [
          {
            title: "키 이름이 다른 두 표의 왼쪽 조인",
            lang: "python",
            code: [
              "m = pd.merge(orders, customers, left_on='cust_id', right_on='id', how='left')",
              "m['region'].isna().sum()   # 짝이 없던 주문 수"
            ],
            note: "왼쪽 조인이므로 orders 행 수는 그대로 유지되고 짝이 없는 쪽만 NaN이 된다."
          },
          {
            title: "출처 표시와 중복 검사",
            lang: "python",
            code: [
              "m = pd.merge(a, b, on='k', how='outer', indicator=True, validate='one_to_one')",
              "m['_merge'].value_counts()"
            ],
            note: "validate 조건이 깨지면 MergeError. 키가 유일한지 모를 때 안전장치로 쓴다."
          },
          {
            title: "세로 결합 후 인덱스 재부여",
            lang: "python",
            code: [
              "all_df = pd.concat([jan, feb, mar], ignore_index=True)",
              "tagged = pd.concat([jan, feb], keys=['jan', 'feb'])   # 1단계 인덱스에 출처"
            ]
          },
          {
            title: "인덱스 기준 결합(join)",
            lang: "python",
            code: ["df1.join(df2, how='inner', lsuffix='_l', rsuffix='_r')"],
            note: "join 은 기본 how='left'. 겹치는 컬럼명이 있으면 접미사를 주지 않으면 ValueError."
          },
          {
            title: "결측을 다른 표로 채우기",
            lang: "python",
            code: ["price = main.set_index('id')['price'].combine_first(backup.set_index('id')['price'])"]
          }
        ],
        pitfalls: [
          "`merge`의 기본 `how`는 **inner**다. 왼쪽 행이 사라졌다면 짝이 없는 키 때문이다.",
          "키 중복은 행을 **곱한다**. 병합 후 행 수가 늘었으면 `validate='1:1'`로 원인을 찾는다.",
          "겹치는 컬럼은 `v_x`, `v_y`로 바뀌므로 병합 직후 `m['v']`는 KeyError.",
          "`concat(axis=1)`은 **인덱스**를 맞춰 붙인다. 위치로 붙이려면 먼저 `reset_index(drop=True)`.",
          "`how='cross'`에는 `on`을 주지 않는다. 결과 행 수는 두 표 행 수의 곱."
        ]
      },

      "a-2-5": {
        node: "a-2-5",
        title: "Pandas 시계열",
        summary: [
          "시계열의 출발은 문자열을 [[datetime|datetime64]]로 바꾸는 `pd.to_datetime`이고, 그 뒤 모든 기능은 [[datetimeindex|DatetimeIndex]]나 [[dt-accessor|dt 접근자]] 위에서 돈다.",
          "빈도를 바꾸는 [[resample|리샘플링(resample)]]은 **집계**가 따라붙고, [[asfreq|asfreq]]는 집계 없이 해당 시점 값만 고른다.",
          "[[rolling|이동 윈도(rolling)]]·[[expanding|누적(expanding)]]·[[ewm|지수가중(ewm)]]은 윈도 통계, [[shift|shift]]·`diff`·[[pct-change|pct_change]]는 전 시점 대비 변화를 만든다.",
          "`date_range`, [[period|Period]], [[timezone|시간대(tz_localize/tz_convert)]], 시간 기반 [[interpolation|보간]]까지가 시험 범위다."
        ],
        concepts: [
          "**변환**: `pd.to_datetime(s, format='%Y-%m-%d')`. `errors='coerce'`는 파싱 실패를 NaT로. 변환 전 문자열 컬럼에 `.dt`를 쓰면 AttributeError.",
          "**dt 접근자**: `s.dt.year/month/day/dayofweek(월=0)/quarter/day_name()/is_month_end`. 인덱스가 DatetimeIndex면 `.dt` 없이 `idx.year`.",
          "**resample**: `s.resample('MS').sum()`처럼 **규칙 문자열 + 집계**. `D`(일)·`W`(주, 일요일 끝)·`MS`(월초)·`QS`(분기초)·`h`(시) 등. `resample(...)`만 쓰면 Resampler 객체이고 값이 아니다. (월말 별칭은 pandas 2.2부터 `'M'`→`'ME'`로 바뀌었으니 `MS`를 쓰면 버전 무관.)",
          "**asfreq vs resample**: `asfreq('D')`는 빈도만 바꾸고 새로 생긴 시점은 NaN(집계 없음). `resample`은 구간을 묶어 집계한다.",
          "**윈도**: `rolling(3).mean()`은 앞 2개가 NaN(`min_periods` 기본 = 창 크기). `expanding().mean()`은 누적 평균, `ewm(span=5).mean()`은 최근 값에 큰 가중.",
          "**변화량**: `shift(1)`은 한 칸 뒤로 밀어 첫 값 NaN, `diff()` = `s - s.shift(1)`, `pct_change()` = `s / s.shift(1) - 1`.",
          "**시간대**: 순진한(naive) 시각에 `tz_localize('UTC')`로 시간대를 **붙이고**, 이미 시간대가 있는 값은 `tz_convert('Asia/Seoul')`로 **바꾼다**. 순진한 값에 `tz_convert`를 바로 쓰면 TypeError.",
          "**생성과 기간**: `pd.date_range(start, end|periods, freq)`, `pd.Period('2024-02', freq='M')`는 월 단위 기간 객체. 결측 보간은 `interpolate(method='time')`이 시간 간격을 반영한다."
        ],
        terms: ["datetime", "datetimeindex", "dt-accessor", "resample", "asfreq", "rolling", "shift", "pct-change", "timezone", "date-range", "interpolation", "frequency-alias"],
        patterns: [
          {
            title: "문자열 → 날짜, 인덱스로 설정",
            lang: "python",
            code: [
              "df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d', errors='coerce')",
              "ts = df.set_index('date').sort_index()"
            ]
          },
          {
            title: "월별 합계와 주별 평균",
            lang: "python",
            code: [
              "monthly = ts['sales'].resample('MS').sum()",
              "weekly = ts['sales'].resample('W').mean()"
            ],
            note: "resample 뒤에 반드시 집계 메서드. 'MS'는 월초 라벨, 'W'는 일요일 라벨(W-SUN)."
          },
          {
            title: "이동평균과 전일 대비 변화율",
            lang: "python",
            code: [
              "ts['ma7'] = ts['sales'].rolling(7).mean()",
              "ts['ret'] = ts['sales'].pct_change()",
              "ts['lag1'] = ts['sales'].shift(1)"
            ]
          },
          {
            title: "빈 날짜 채우고 시간 보간",
            lang: "python",
            code: [
              "daily = ts['temp'].asfreq('D')             # 없는 날은 NaN",
              "filled = daily.interpolate(method='time')"
            ]
          },
          {
            title: "시간대 붙이기와 변환",
            lang: "python",
            code: [
              "utc = s.dt.tz_localize('UTC')",
              "kst = utc.dt.tz_convert('Asia/Seoul')"
            ]
          },
          {
            title: "요일·월 추출",
            lang: "python",
            code: [
              "df['dow'] = df['date'].dt.dayofweek    # 월=0 … 일=6",
              "df['ym'] = df['date'].dt.to_period('M')"
            ]
          }
        ],
        pitfalls: [
          "`resample('W')`만 쓰고 집계를 빼면 값이 아니라 Resampler 객체가 나온다.",
          "`rolling(n)`의 첫 n-1개는 NaN. `min_periods=1`을 주면 사라진다.",
          "`dayofweek`는 **월요일이 0**, 일요일이 6.",
          "naive 시각에 `tz_convert`는 TypeError — 먼저 `tz_localize`.",
          "월말 별칭 `'M'`은 pandas 2.2에서 `'ME'`로 바뀌었다. 시험 코드에 `'M'`이 보여도 '월 단위 리샘플'로 읽되, 직접 쓸 때는 `'MS'`가 안전하다."
        ]
      },

      "a-2-6": {
        node: "a-2-6",
        title: "Pandas 고급",
        summary: [
          "[[multiindex|다중 인덱스(MultiIndex)]]를 만들고(`set_index([a, b])`, `groupby([a, b])`) `xs`·`swaplevel`·`sort_index`로 다루는 것이 첫 축이다.",
          "둘째 축은 **성능과 스타일**: 행 단위 `apply`보다 [[vectorization|벡터화]]가 빠르고, [[pipe|pipe]]·[[assign|assign]]·[[query|query]]·`eval`로 [[method-chaining|메서드 체이닝]]을 만든다.",
          "셋째 축은 도구 모음: [[category-dtype|category]]·[[downcast|downcast]]로 메모리 절약, [[explode|explode]], [[where-mask|where/mask]], [[nlargest|nlargest/nsmallest]], [[idxmax|idxmax/idxmin]], [[groupby-rolling|groupby.rolling]], [[str-accessor|str.extract/contains]]의 [[regex|정규식]], [[grouper|pd.Grouper]]."
        ],
        concepts: [
          "**MultiIndex 선택**: `df.xs('A', level='grp')`는 특정 레벨 값의 횡단면, `df.loc[('A', 'x')]`는 튜플 키. `swaplevel()` 뒤에는 `sort_index()`를 해야 슬라이싱이 안정적이다.",
          "**apply vs 벡터화**: `df.apply(f, axis=1)`은 행마다 파이썬 함수 호출이라 느리다. 컬럼 연산(`df['a'] + df['b']`), `np.where`, `.str`/`.dt` 접근자가 벡터화된 대안.",
          "**체이닝**: `df.pipe(f, arg)` = `f(df, arg)`. `assign(new=...)`은 원본을 바꾸지 않고 새 컬럼이 붙은 복사본을 돌려준다. `query('x > @thr')`는 외부 변수에 `@`, `eval('c = a + b')`는 문자열 식 계산.",
          "**메모리**: 고유값이 적은 문자열 컬럼은 `astype('category')`, 정수는 `pd.to_numeric(s, downcast='integer')`로 가장 작은 정수형으로 축소.",
          "**형태 변환**: `explode('tags')`는 리스트 원소를 행으로 펼친다(인덱스는 복제). `where(cond, other)`는 **조건이 거짓인 곳**을 바꾸고, `mask(cond, other)`는 **참인 곳**을 바꾼다.",
          "**극값**: `nlargest(n, col)`/`nsmallest`는 정렬 후 head보다 효율적. `idxmax()`는 최댓값의 **라벨**(동률이면 첫 번째), `argmax()`는 위치.",
          "**윈도 그룹**: `df.groupby('store')['sales'].rolling(3).mean()`은 그룹 안에서만 윈도를 굴린다(결과는 store를 포함한 MultiIndex). 시간 단위 그룹은 `groupby(pd.Grouper(key='date', freq='MS'))`.",
          "**문자열 정규식**: `s.str.contains(r'^[ab]')`는 불리언 Series(기본 `regex=True`), `s.str.extract(r'(\\d+)')`는 캡처 그룹별 **DataFrame**(`expand=False`면 Series)."
        ],
        terms: ["multiindex", "cross-section", "vectorization", "pipe", "query", "method-chaining", "category-dtype", "explode", "where-mask", "idxmax", "groupby-rolling", "str-accessor"],
        patterns: [
          {
            title: "MultiIndex 집계와 횡단면",
            lang: "python",
            code: [
              "g = df.groupby(['region', 'cat'])['sales'].sum()",
              "g.xs('East', level='region')          # region 레벨이 East 인 행",
              "g.swaplevel().sort_index().loc['food']"
            ]
          },
          {
            title: "메서드 체이닝",
            lang: "python",
            code: [
              "thr = 100",
              "out = (df.query('sales > @thr')",
              "         .assign(margin=lambda d: d['sales'] - d['cost'])",
              "         .pipe(lambda d: d.nlargest(5, 'margin')))"
            ],
            note: "assign 의 람다는 바로 앞 단계의 DataFrame 을 받으므로 체인 중간에 만든 컬럼도 쓸 수 있다."
          },
          {
            title: "메모리 최적화",
            lang: "python",
            code: [
              "df['city'] = df['city'].astype('category')",
              "df['qty'] = pd.to_numeric(df['qty'], downcast='integer')",
              "df.memory_usage(deep=True).sum()"
            ]
          },
          {
            title: "리스트 컬럼 펼치기와 정규식 추출",
            lang: "python",
            code: [
              "long = df.explode('tags')",
              "df['num'] = df['code'].str.extract(r'(\\d+)', expand=False).astype(int)",
              "df[df['code'].str.contains(r'^A-', regex=True)]"
            ]
          },
          {
            title: "조건 치환과 극값 라벨",
            lang: "python",
            code: [
              "s.where(s > 0, 0)        # 조건이 거짓(0 이하)인 곳을 0 으로",
              "s.mask(s > 0, 0)         # 조건이 참인 곳을 0 으로",
              "df.loc[df['score'].idxmax(), 'name']"
            ]
          },
          {
            title: "그룹별 이동평균과 시간 그룹",
            lang: "python",
            code: [
              "df['ma3'] = df.groupby('store')['sales'].transform(lambda s: s.rolling(3).mean())",
              "df.groupby(pd.Grouper(key='date', freq='MS'))['sales'].sum()"
            ]
          }
        ],
        pitfalls: [
          "`where`는 **거짓**인 곳을, `mask`는 **참**인 곳을 바꾼다. 서로 반대다.",
          "`query` 안에서 파이썬 변수는 `@변수`. 빼면 UndefinedVariableError.",
          "`idxmax()`는 값이 아니라 **인덱스 라벨**을 돌려준다. 동률이면 첫 번째.",
          "`str.extract`는 기본적으로 DataFrame 을 돌려준다. 한 컬럼이 필요하면 `expand=False` 또는 `[0]`.",
          "`swaplevel()` 직후 `loc` 슬라이싱은 정렬이 깨져 경고·오류가 날 수 있다. `sort_index()`를 붙인다."
        ]
      }
    },

    /* ───────────────────────── 필기 문제 ───────────────────────── */
    questions: [
      /* ===== a-2-4 Pandas 병합과 결합 ===== */
      {
        id: "a-2-4-q01", node: "a-2-4", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`pd.merge(left, right, on='k')`처럼 `how`를 생략했을 때 적용되는 기본 병합 방식(join type)은?",
        choices: ["left", "inner", "outer", "cross"],
        answer: 1,
        explanation: [
          "**정답: ②** `merge`의 `how` 기본값은 `'inner'`다. 양쪽에 **모두 존재하는 키**만 남기는 [[inner-join|내부 조인(inner join)]]이 적용되어, 짝이 없는 행은 조용히 사라진다.",
          "",
          "- ① `left`는 왼쪽 행을 모두 보존하는 방식이지만 기본값이 아니다. `DataFrame.join`의 기본값과 혼동하기 쉽다.",
          "- ③ `outer`는 양쪽 키의 합집합을 남긴다. 명시해야 한다.",
          "- ④ `cross`는 키 없이 모든 조합을 만드는 방식으로 pandas 1.2부터 추가된 옵션이다.",
          "",
          "시험에서는 '병합 후 행이 줄었다'는 상황을 주고 기본 `how`가 inner임을 아는지 묻는다. `join`은 기본 left, `merge`는 기본 inner — 둘을 짝으로 기억한다."
        ],
        terms: ["merge", "inner-join", "left-join"]
      },
      {
        id: "a-2-4-q02", node: "a-2-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "left = pd.DataFrame({'k': ['a', 'a', 'b'], 'x': [1, 2, 3]})",
          "right = pd.DataFrame({'k': ['a', 'b', 'b'], 'y': [10, 20, 30]})",
          "print(len(pd.merge(left, right, on='k')))"
        ],
        lang: "python",
        choices: ["2", "3", "4", "6"],
        answer: 2,
        explanation: [
          "**정답: ③** 키 `'a'`는 왼쪽 2행 × 오른쪽 1행 = 2행, 키 `'b'`는 1행 × 2행 = 2행. 내부 조인(inner join) 결과는 2 + 2 = **4행**이다. 키가 중복되면 행이 **곱해진다**는 것이 [[merge|병합(merge)]]의 핵심 함정이다.",
          "",
          "- ① 2는 고유 키의 수(a, b)다. 중복을 무시하면 이렇게 착각한다.",
          "- ② 3은 왼쪽 행 수다. 왼쪽 조인(left join)이라도 b가 두 번 매칭되어 4가 된다.",
          "- ④ 6은 교차 조인(cross join) 3×2의 결과다. `on='k'`가 있으므로 교차 조인이 아니다.",
          "",
          "시험에서는 '병합 결과의 행 수'를 묻는 문제가 반복된다. 키별로 (왼쪽 개수 × 오른쪽 개수)를 더하면 된다. 중복이 의심되면 [[validate|validate]] 인자로 검사한다."
        ],
        terms: ["merge", "inner-join", "validate"]
      },
      {
        id: "a-2-4-q03", node: "a-2-4", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`pd.concat([df1, df2], axis=1)`에 대한 설명으로 옳은 것은?",
        choices: [
          "두 DataFrame을 세로(행 방향)로 이어 붙인다.",
          "공통 컬럼을 키로 삼아 inner join 한다.",
          "두 DataFrame의 인덱스가 다르면 ValueError가 발생한다.",
          "열 방향으로 이어 붙이며, 인덱스가 다르면 합집합으로 정렬하고 빈 자리는 NaN이 된다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[concat|결합(concat)]]의 `axis=1`은 **열 방향**으로 붙인다. 이때 행을 맞추는 기준은 **인덱스**이고, 기본 `join='outer'`라 인덱스의 합집합이 되며 짝이 없는 칸은 [[missing-value|결측값(NaN)]]이 된다.",
          "",
          "- ① 세로로 이어 붙이는 것은 기본값 `axis=0`이다.",
          "- ② `concat`은 키 컬럼으로 조인하지 않는다. 키 기반 결합은 `merge`의 역할이다.",
          "- ③ 인덱스가 달라도 오류가 아니라 NaN으로 채워진다. `join='inner'`를 주면 교집합만 남는다.",
          "",
          "시험에서는 `concat(axis=1)`과 `merge`의 차이(인덱스 기준 vs 키 기준)를 묻는다. 위치로 붙이려면 먼저 `reset_index(drop=True)`를 해야 한다는 점도 함께 나온다."
        ],
        terms: ["concat", "missing-value", "merge"]
      },
      {
        id: "a-2-4-q04", node: "a-2-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "a = pd.DataFrame({'x': [1, 2]}, index=[0, 1])",
          "b = pd.DataFrame({'y': [3, 4]}, index=[1, 2])",
          "print(pd.concat([a, b], axis=1).shape)"
        ],
        lang: "python",
        choices: ["(2, 2)", "(3, 2)", "(4, 1)", "ValueError"],
        answer: 1,
        explanation: [
          "**정답: ②** `axis=1` [[concat|결합(concat)]]은 인덱스를 기준으로 가로로 붙인다. 인덱스 합집합은 {0, 1, 2}로 **3행**, 컬럼은 x, y **2열**이므로 `(3, 2)`. 인덱스 0의 y와 인덱스 2의 x는 [[missing-value|결측값(NaN)]]이 된다.",
          "",
          "- ① `(2, 2)`는 `join='inner'`를 줬을 때(인덱스 교집합 {1}은 1행이므로 그것도 아니다) 또는 위치로 붙였을 때의 착각이다.",
          "- ③ `(4, 1)`은 `axis=0`으로 세로 결합했을 때의 행 수(4)와 비슷하지만, 세로 결합이면 컬럼이 x, y 2개라 `(4, 2)`다.",
          "- ④ 인덱스가 달라도 오류는 나지 않는다. 합집합으로 정렬된다.",
          "",
          "시험에서는 `concat`의 `axis`와 인덱스 정렬 규칙을 shape 로 묻는다. 행 수 = 인덱스 합집합 크기, 열 수 = 컬럼 합(겹치면 중복 허용)으로 계산한다."
        ],
        terms: ["concat", "missing-value"]
      },
      {
        id: "a-2-4-q05", node: "a-2-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "left = pd.DataFrame({'k': [1, 2, 3]})",
          "right = pd.DataFrame({'k': [2, 3, 4]})",
          "m = pd.merge(left, right, on='k', how='left', indicator=True)",
          "print(m['_merge'].tolist())"
        ],
        lang: "python",
        choices: [
          "['left_only', 'both', 'both']",
          "['both', 'both', 'right_only']",
          "['left_only', 'both', 'both', 'right_only']",
          "[True, False, False]"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** `indicator=True`는 각 행의 **출처**를 `_merge` 컬럼에 `left_only`/`right_only`/`both`로 기록한다([[indicator|indicator]]). [[left-join|왼쪽 조인(left join)]]이므로 왼쪽 키 1, 2, 3이 모두 남고, 1은 오른쪽에 없어 `left_only`, 2와 3은 `both`다.",
          "",
          "- ② `right_only`가 나오려면 오른쪽에만 있는 키 4가 결과에 포함되어야 하는데 왼쪽 조인은 그 행을 버린다.",
          "- ③ 4행이 나오는 것은 `how='outer'`일 때다.",
          "- ④ `_merge`는 불리언이 아니라 세 범주를 가진 category 컬럼이다.",
          "",
          "시험에서는 `how`와 `indicator` 결과를 묶어 '어느 행이 left_only 인가'를 묻는다. outer + indicator 조합으로 양쪽 불일치 키를 찾는 패턴도 자주 나온다."
        ],
        terms: ["indicator", "left-join", "merge"]
      },
      {
        id: "a-2-4-q06", node: "a-2-4", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 마지막 줄에서 `KeyError: 'v'`가 발생한다. 원인으로 옳은 것은?",
        code: [
          "import pandas as pd",
          "a = pd.DataFrame({'k': [1, 2], 'v': [1, 2]})",
          "b = pd.DataFrame({'k': [1, 2], 'v': [3, 4]})",
          "m = pd.merge(a, b, on='k')",
          "print(m['v'])"
        ],
        lang: "python",
        choices: [
          "`on='k'` 지정이 잘못되어 교차 조인(cross join)이 되었다.",
          "`how='inner'` 기본값 때문에 모든 행이 제거되었다.",
          "merge는 키가 아닌 중복 컬럼을 자동으로 삭제한다.",
          "키가 아닌 컬럼 `v`가 양쪽에 겹쳐 `v_x`, `v_y`로 이름이 바뀌었기 때문이다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** 키(`k`)가 아닌데 양쪽에 같은 이름인 컬럼 `v`에는 기본 [[suffixes|접미사(suffixes)]] `('_x', '_y')`가 붙어 결과 컬럼은 `k, v_x, v_y`가 된다. 그래서 `m['v']`는 존재하지 않아 KeyError다. `suffixes=('_a', '_b')`로 바꾸거나 병합 전에 컬럼명을 바꾸면 해결된다.",
          "",
          "- ① `on='k'`는 정상이다. 교차 조인은 `how='cross'`를 줬을 때만 일어난다.",
          "- ② 키 1, 2가 양쪽에 다 있으므로 inner 조인이라도 2행이 모두 남는다. 행이 아니라 **컬럼명** 문제다.",
          "- ③ [[merge|병합(merge)]]은 중복 컬럼을 삭제하지 않고 접미사로 구분해 둘 다 남긴다.",
          "",
          "시험에서는 병합 후 컬럼 목록에 `_x`, `_y`가 보이는 출력을 주고 그 이유나 `suffixes` 인자를 묻는다."
        ],
        terms: ["suffixes", "merge"]
      },
      {
        id: "a-2-4-q07", node: "a-2-4", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`df1.join(df2)`에 대한 설명으로 옳은 것은?",
        choices: [
          "기본 `how='inner'`로 양쪽에 모두 있는 키만 남긴다.",
          "`pd.concat([df1, df2], axis=0)`과 완전히 같은 결과를 낸다.",
          "기본적으로 두 DataFrame의 인덱스를 기준으로 결합하며 `how` 기본값은 `'left'`다.",
          "컬럼명이 겹치면 자동으로 `_x`, `_y` 접미사를 붙인다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `DataFrame.join`은 **인덱스**를 기준으로 결합하는 [[join|조인(join)]] 메서드다(`on=`으로 호출 쪽의 컬럼을 지정할 수도 있다). `how` 기본값은 `'left'`로, `merge`의 기본값 `'inner'`와 다르다.",
          "",
          "- ① 기본 inner는 `merge`의 규칙이다. `join`은 left가 기본이다.",
          "- ② `concat(axis=0)`은 세로로 쌓는 것이고, `join`은 가로로 인덱스를 맞춰 붙이므로 전혀 다르다.",
          "- ④ `join`은 겹치는 컬럼명이 있으면 `lsuffix`/`rsuffix`를 주지 않는 한 **ValueError**를 낸다. 자동 접미사 `_x`/`_y`는 `merge`의 동작이다.",
          "",
          "시험에서는 `merge`·`join`·`concat` 세 함수의 기본 동작(키 vs 인덱스, 기본 how, 겹치는 컬럼 처리)을 비교하는 문제로 나온다."
        ],
        terms: ["join", "merge", "concat", "suffixes"]
      },
      {
        id: "a-2-4-q08", node: "a-2-4", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`pd.merge(a, b, on='k', how='outer')`는 양쪽 키의 합집합을 모두 남기고, 짝이 없는 쪽의 컬럼은 결측값(NaN)으로 채운다.",
        answer: true,
        explanation: [
          "**정답: O** [[outer-join|외부 조인(outer join)]]은 왼쪽에만 있는 키, 오른쪽에만 있는 키, 양쪽에 있는 키를 전부 남긴다. 짝이 없는 행의 상대편 컬럼은 [[missing-value|결측값(NaN)]]이 된다.",
          "그래서 outer 병합 뒤에는 `isna()`로 불일치 키를 찾거나 `fillna`로 후처리하는 단계가 따라온다.",
          "",
          "시험에서는 inner/left/right/outer 네 방식의 결과 행 수를 벤 다이어그램처럼 비교하는 문제로 나온다. outer = 합집합, inner = 교집합."
        ],
        terms: ["outer-join", "missing-value"]
      },
      {
        id: "a-2-4-q09", node: "a-2-4", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`pd.merge(a, b, how='cross')`를 쓰려면 두 DataFrame에 공통 키 컬럼이 반드시 있어야 한다.",
        answer: false,
        explanation: [
          "**정답: X** [[cross-join|교차 조인(cross join)]]은 키 없이 왼쪽의 모든 행과 오른쪽의 모든 행을 **조합**한다. `on`, `left_on` 등 키 인자를 함께 주면 오히려 오류가 난다. 결과 행 수는 두 표 행 수의 곱(예: 3행 × 2행 = 6행)이다.",
          "공통 키가 필요한 것은 inner/left/right/outer 네 방식이고, 그 경우에도 `left_on`/`right_on`으로 이름이 다른 키를 짝지을 수 있으므로 '같은 이름의 컬럼'이 꼭 필요한 것은 아니다.",
          "",
          "시험에서는 교차 조인의 행 수 계산(곱)이나 '모든 조합 표를 만드는 방법'으로 출제된다."
        ],
        terms: ["cross-join", "merge"]
      },
      {
        id: "a-2-4-q10", node: "a-2-4", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 인자 이름을 쓰시오. 두 표의 키 컬럼 이름이 다를 때: `pd.merge(orders, users, left_on='user_id', ____='id')`",
        answer: "right_on",
        explanation: [
          "**정답: right_on** 키 이름이 다르면 왼쪽은 `left_on`, 오른쪽은 `right_on`으로 각각 지정한다. 같은 이름이면 `on` 하나로 충분하다. [[merge|병합(merge)]] 결과에는 두 키 컬럼(`user_id`, `id`)이 모두 남으므로 보통 하나를 `drop`한다.",
          "인덱스를 키로 쓰려면 `left_index=True` / `right_index=True`를 쓴다.",
          "",
          "시험에서는 `on`과 `left_on`/`right_on`의 구분, 그리고 병합 후 키 컬럼이 두 개 남는 점을 빈칸으로 묻는다."
        ],
        terms: ["merge"]
      },
      {
        id: "a-2-4-q11", node: "a-2-4", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드가 출력하는 숫자를 쓰시오.",
        code: [
          "import pandas as pd",
          "a = pd.DataFrame({'x': [1, 2, 3]})",
          "b = pd.DataFrame({'y': ['p', 'q']})",
          "print(len(pd.merge(a, b, how='cross')))"
        ],
        lang: "python",
        answer: "6",
        explanation: [
          "**정답: 6** [[cross-join|교차 조인(cross join)]]은 키 없이 모든 조합을 만들므로 행 수는 3 × 2 = **6**이다. 컬럼은 x, y 두 개가 나란히 붙는다.",
          "SQL의 `CROSS JOIN`과 같은 연산이며, 날짜 × 매장처럼 '모든 조합의 뼈대 표'를 만들 때 쓴다.",
          "",
          "시험에서는 교차 조인의 결과 행 수(곱)나 `how='cross'`일 때 `on`을 주면 오류라는 점을 묻는다."
        ],
        terms: ["cross-join", "merge"]
      },
      {
        id: "a-2-4-q12", node: "a-2-4", type: "short", kind: "concept", difficulty: 3,
        prompt: "`pd.merge`의 `validate` 인자에서 **왼쪽 키는 유일하고 오른쪽 키는 중복될 수 있음**을 검사하는 값을 쓰시오. (`one_to_...` 형태의 전체 이름)",
        answer: "one_to_many",
        accept: ["1:m"],
        explanation: [
          "**정답: one_to_many** (`'1:m'`도 가능) [[validate|validate]]는 병합 전에 키의 중복 여부를 검사해 조건이 깨지면 `MergeError`를 낸다. `'one_to_one'`(`'1:1'`)은 양쪽 모두 유일, `'one_to_many'`(`'1:m'`)는 왼쪽만 유일, `'many_to_one'`(`'m:1'`)은 오른쪽만 유일, `'many_to_many'`(`'m:m'`)는 검사하지 않는다.",
          "고객(유일) ↔ 주문(중복) 병합이라면 고객이 왼쪽일 때 `'1:m'`, 주문이 왼쪽일 때 `'m:1'`이다.",
          "",
          "시험에서는 '병합 후 행이 예상보다 늘어난 것을 사전에 막는 인자'로 `validate`를 묻는다. [[merge|병합(merge)]]의 행 수 폭증을 방지하는 안전장치라고 기억한다."
        ],
        terms: ["validate", "merge"]
      },

      /* ===== a-2-5 Pandas 시계열 ===== */
      {
        id: "a-2-5-q01", node: "a-2-5", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "문자열 컬럼 `df['date']`(예: '2024-01-15')를 날짜형(datetime64)으로 변환하는 올바른 코드는?",
        choices: [
          "`df['date'].astype('date')`",
          "`pd.to_datetime(df['date'])`",
          "`df['date'].dt.to_datetime()`",
          "`pd.DatetimeIndex.parse(df['date'])`"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** `pd.to_datetime`은 문자열·숫자·리스트를 [[datetime|datetime64]] 자료형으로 바꾸는 표준 함수다. `format='%Y-%m-%d'`로 형식을 지정하면 빠르고 안전하며, `errors='coerce'`는 실패한 값을 NaT로 만든다.",
          "",
          "- ① `'date'`라는 dtype 문자열은 없다. `astype('datetime64[ns]')`는 가능하지만 형식 지정·오류 처리가 없어 권장되지 않는다.",
          "- ③ [[dt-accessor|dt 접근자]]는 **이미 datetime 형인** Series에만 쓸 수 있다. 문자열 상태에서는 AttributeError.",
          "- ④ `DatetimeIndex.parse`라는 메서드는 존재하지 않는다.",
          "",
          "시험에서는 '시계열 분석 전 첫 단계'로 `pd.to_datetime`을 고르는 문제, 또는 `format` 인자의 형식 코드(`%d/%m/%Y` 등)를 묻는 문제로 나온다."
        ],
        terms: ["datetime", "dt-accessor"]
      },
      {
        id: "a-2-5-q02", node: "a-2-5", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (2024-01-15는 월요일이다)",
        code: [
          "import pandas as pd",
          "s = pd.Series(pd.to_datetime(['2024-01-15', '2024-02-29', '2024-03-01']))",
          "print(s.dt.dayofweek.tolist())"
        ],
        lang: "python",
        choices: ["[0, 3, 4]", "[1, 4, 5]", "[0, 4, 5]", "[7, 3, 4]"],
        answer: 0,
        explanation: [
          "**정답: ①** [[dt-accessor|dt 접근자]]의 `dayofweek`는 **월요일 = 0, 일요일 = 6**이다. 2024-01-15는 월요일이므로 0, 2024-02-29(윤년)는 목요일이므로 3, 2024-03-01은 그 다음 날 금요일이므로 4. 따라서 `[0, 3, 4]`.",
          "",
          "- ② `[1, 4, 5]`는 월요일을 1로 세는 ISO 요일 번호(`isocalendar().day`)의 결과다. `dayofweek`와 다르다.",
          "- ③ `[0, 4, 5]`는 2월 29일을 건너뛰어 3월 1일을 토요일로 잘못 계산한 경우다. 2024년은 윤년이라 2월 29일이 존재한다.",
          "- ④ 7은 `dayofweek` 범위(0~6)에 없다.",
          "",
          "시험에서는 `dayofweek`의 기준(월=0)과 `day_name()`(영문 요일 이름)을 함께 묻는다. 주말 필터 `s.dt.dayofweek >= 5`가 전형적인 활용이다."
        ],
        terms: ["dt-accessor", "datetime"]
      },
      {
        id: "a-2-5-q03", node: "a-2-5", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([10, 12, 15])",
          "print(s.pct_change().round(2).tolist())"
        ],
        lang: "python",
        choices: ["[0.2, 0.25]", "[nan, 2.0, 3.0]", "[nan, 0.2, 0.25]", "[0.0, 0.2, 0.25]"],
        answer: 2,
        explanation: [
          "**정답: ③** [[pct-change|변화율(pct_change)]]은 `s / s.shift(1) - 1`이다. 첫 값은 비교 대상이 없어 NaN, 둘째는 (12−10)/10 = 0.2, 셋째는 (15−12)/12 = 0.25. 길이는 원본과 같은 3이다.",
          "",
          "- ① 첫 NaN이 빠져 길이가 2가 되었다. `pct_change`는 길이를 유지한다.",
          "- ② `[nan, 2.0, 3.0]`은 차분 `diff()`의 결과다(절대 변화량).",
          "- ④ 첫 값이 0.0이 되지는 않는다. 이전 값이 없으면 NaN이다.",
          "",
          "시험에서는 `diff`(차이)와 `pct_change`(비율)를 혼동시키는 보기가 반드시 섞여 나온다. 둘 다 첫 값 NaN, [[shift|shift]]를 기반으로 한다는 점을 기억한다."
        ],
        terms: ["pct-change", "shift"]
      },
      {
        id: "a-2-5-q04", node: "a-2-5", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, 2, 3, 4, 5])",
          "print(s.rolling(3).mean().tolist())"
        ],
        lang: "python",
        choices: [
          "[2.0, 3.0, 4.0]",
          "[1.0, 1.5, 2.0, 3.0, 4.0]",
          "[nan, nan, 2.0, 3.0, 4.0]",
          "[1.0, 1.5, 2.0, 2.5, 3.0]"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[rolling|이동 윈도(rolling)]] 크기 3의 평균은 값이 3개 모일 때부터 계산되므로 앞 두 자리는 NaN(`min_periods` 기본값 = 창 크기). 이후 (1+2+3)/3 = 2, 3, 4. 결과 길이는 원본과 같다.",
          "",
          "- ① NaN이 빠진 모양이다. rolling은 길이를 유지한다(`dropna()`를 해야 이렇게 된다).",
          "- ② 앞 두 값이 1.0, 1.5인 것은 `min_periods=1`을 준 경우다.",
          "- ④ `[1.0, 1.5, 2.0, 2.5, 3.0]`은 [[expanding|누적 윈도(expanding)]] 평균의 결과다.",
          "",
          "시험에서는 `rolling(n)`의 앞 n−1개 NaN, `min_periods`의 효과, `expanding`과의 차이를 출력 예측으로 묻는다."
        ],
        terms: ["rolling", "expanding"]
      },
      {
        id: "a-2-5-q05", node: "a-2-5", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "`resample`과 `asfreq`의 차이에 대한 설명으로 옳은 것은?",
        choices: [
          "`asfreq`는 구간을 묶어 집계하고, `resample`은 집계 없이 해당 시점의 값만 고른다.",
          "둘은 완전히 같은 기능이며 이름만 다르다.",
          "`resample`은 구간을 묶어 집계 함수를 적용하고, `asfreq`는 집계 없이 새 빈도의 시점 값만 선택하며 없는 시점은 NaN이 된다.",
          "`resample`은 다운샘플링만, `asfreq`는 업샘플링만 가능하다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[resample|리샘플링(resample)]]은 `s.resample('MS').sum()`처럼 구간을 묶어 **집계**한다. [[asfreq|asfreq]]는 `s.asfreq('D')`처럼 빈도만 바꾸어 각 시점의 값을 그대로 가져오고, 원본에 없던 시점은 NaN이다(이후 `ffill`이나 `interpolate`로 채운다).",
          "",
          "- ① 두 함수의 역할이 뒤바뀌었다.",
          "- ② `resample`은 Resampler 객체를 돌려주어 집계가 필요하고, `asfreq`는 바로 Series/DataFrame을 돌려준다. 다르다.",
          "- ④ 둘 다 업샘플링(더 촘촘하게)과 다운샘플링(더 거칠게) 모두 가능하다.",
          "",
          "시험에서는 '일별 → 월별 합계'는 `resample`, '불규칙 날짜 → 매일 격자 만들기'는 `asfreq`로 고르는 문제로 나온다."
        ],
        terms: ["resample", "asfreq", "frequency-alias"]
      },
      {
        id: "a-2-5-q06", node: "a-2-5", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 `AttributeError: Can only use .dt accessor with datetimelike values`를 낸다. 원인과 해결로 옳은 것은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'date': ['2024-01-01', '2024-02-01']})",
          "df['year'] = df['date'].dt.year"
        ],
        lang: "python",
        choices: [
          "`year`는 `dt`에 없는 속성이다. `dt.yr`로 바꾼다.",
          "`date` 컬럼이 아직 문자열이다. `pd.to_datetime(df['date']).dt.year`로 변환 후 사용한다.",
          "`dt` 접근자는 DatetimeIndex에만 쓸 수 있다. `set_index('date')` 후 사용한다.",
          "컬럼명이 `date`라서 예약어와 충돌한다. 컬럼명을 바꾼다."
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[dt-accessor|dt 접근자]]는 Series의 dtype이 [[datetime|datetime64]](또는 timedelta·period)일 때만 열린다. 리스트로 만든 `'2024-01-01'`은 그냥 문자열이므로 먼저 `pd.to_datetime`으로 변환해야 한다.",
          "",
          "- ① `dt.year`는 정상 속성이다. `yr`은 없다.",
          "- ③ `dt`는 Series용이다. 인덱스가 DatetimeIndex면 오히려 `.dt` 없이 `idx.year`를 쓴다. 인덱스로 바꾸는 것은 해결책이 아니다.",
          "- ④ `date`는 pandas 예약어가 아니며 컬럼명과 무관한 오류다.",
          "",
          "시험에서는 이 오류 메시지를 그대로 보여 주고 '변환이 빠졌다'는 원인을 고르게 한다. `read_csv` 뒤 날짜 컬럼이 object 인 상황이 전형적이다(`parse_dates=['date']`로도 해결)."
        ],
        terms: ["dt-accessor", "datetime"]
      },
      {
        id: "a-2-5-q07", node: "a-2-5", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "시간대(timezone) 정보가 없는 datetime Series `s`를 한국 시간(Asia/Seoul)으로 표시하려고 한다. 옳은 설명은?",
        choices: [
          "`s.dt.tz_convert('Asia/Seoul')`을 바로 호출하면 된다.",
          "`tz_localize`는 시간대를 바꾸고, `tz_convert`는 시간대를 처음 붙인다.",
          "`s.dt.tz_localize('Asia/Seoul')`은 시각 값을 UTC 기준으로 9시간 앞당겨 바꾼다.",
          "`s.dt.tz_localize('UTC').dt.tz_convert('Asia/Seoul')`을 쓰면 UTC 기준 값이 한국 시각으로 변환되며, naive 값에 `tz_convert`를 바로 쓰면 TypeError가 난다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[timezone|시간대(timezone)]] 처리는 두 단계다. 시간대가 없는(naive) 값에는 `tz_localize('UTC')`로 '이 값은 UTC다'라고 **붙이고**, 그 뒤 `tz_convert('Asia/Seoul')`로 다른 시간대의 시각으로 **환산**한다(09:00 UTC → 18:00 KST). naive 값에 `tz_convert`를 바로 쓰면 `TypeError: Cannot convert tz-naive timestamps`가 난다.",
          "",
          "- ① naive 값에는 `tz_convert`를 쓸 수 없다. 먼저 localize 해야 한다.",
          "- ② 역할이 뒤바뀌었다. `tz_localize`가 붙이는 것, `tz_convert`가 바꾸는 것.",
          "- ③ `tz_localize`는 시각 숫자를 **바꾸지 않고** 시간대 라벨만 붙인다. 값이 환산되는 것은 `tz_convert`다. (원래 데이터가 UTC 기록인데 'Asia/Seoul'로 바로 localize 하면 9시간이 틀어진다.)",
          "",
          "시험에서는 'localize = 붙인다, convert = 바꾼다'와 naive → convert 오류를 개념 문제로 묻는다."
        ],
        terms: ["timezone", "datetime"]
      },
      {
        id: "a-2-5-q08", node: "a-2-5", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`pd.date_range('2024-01-01', periods=3, freq='D')`는 2024-01-01, 01-02, 01-03 세 날짜의 DatetimeIndex를 만든다.",
        answer: true,
        explanation: [
          "**정답: O** [[date-range|date_range]]는 `start`와 `periods`(개수) 또는 `end`를 주고 `freq`(빈도 별칭) 간격으로 [[datetimeindex|DatetimeIndex]]를 생성한다. `freq='D'`는 1일 간격이므로 1월 1, 2, 3일 세 개가 된다.",
          "`start`, `end`, `periods` 중 두 개를 지정하면 나머지는 자동으로 정해진다. 월초는 `'MS'`, 주는 `'W'`(일요일), 시간은 `'h'`.",
          "",
          "시험에서는 `periods`와 `freq` 조합으로 만들어지는 날짜 수나 마지막 날짜를 묻는다. [[frequency-alias|빈도 별칭]] 표를 외워 둔다."
        ],
        terms: ["date-range", "datetimeindex", "frequency-alias"]
      },
      {
        id: "a-2-5-q09", node: "a-2-5", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`s.resample('W')`는 그 자체로 주별 값이 담긴 Series를 돌려주므로 바로 `.plot()`이나 산술 연산에 쓸 수 있다.",
        answer: false,
        explanation: [
          "**정답: X** `resample('W')`는 값이 아니라 **Resampler 객체**(그룹 묶음)를 돌려준다. `sum()`, `mean()`, `last()`, `agg([...])` 같은 집계를 붙여야 Series가 된다. [[resample|리샘플링(resample)]]은 '시간 기준 groupby'라고 이해하면 정확하다.",
          "집계 없이 빈도만 바꾸고 싶다면 [[asfreq|asfreq]]를 쓴다.",
          "",
          "시험에서는 `resample` 뒤에 집계가 빠진 코드를 보여 주고 결과가 무엇인지(값이 아님) 묻거나, `groupby`와의 유사성을 묻는다."
        ],
        terms: ["resample", "asfreq"]
      },
      {
        id: "a-2-5-q10", node: "a-2-5", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 인자 이름을 쓰시오. '15/01/2024' 같은 일/월/년 문자열을 파싱한다: `pd.to_datetime(s, ____='%d/%m/%Y')`",
        answer: "format",
        explanation: [
          "**정답: format** `pd.to_datetime`의 `format` 인자에 strftime 형식 코드를 주면 그 형식으로만 해석한다. `%d` 일, `%m` 월, `%Y` 네 자리 연도, `%H:%M:%S` 시분초. 형식을 명시하면 자동 추론보다 빠르고 일/월 혼동(15/01을 1월 15일로 읽는 문제)을 막는다.",
          "파싱 실패를 NaT로 처리하려면 `errors='coerce'`를 함께 준다. 결과는 [[datetime|datetime64]] 형이다.",
          "",
          "시험에서는 `format` 인자 이름과 형식 코드(`%Y`와 `%y`, `%m`과 `%M`의 차이)를 빈칸으로 묻는다."
        ],
        terms: ["datetime"]
      },
      {
        id: "a-2-5-q11", node: "a-2-5", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드가 출력하는 숫자를 쓰시오. (2024년 1월 1일은 월요일이다)",
        code: [
          "import pandas as pd",
          "idx = pd.date_range('2024-01-01', '2024-01-31', freq='W')",
          "print(len(idx))"
        ],
        lang: "python",
        answer: "4",
        explanation: [
          "**정답: 4** 빈도 `'W'`는 `'W-SUN'`과 같아서 **일요일** 날짜만 만든다([[frequency-alias|빈도 별칭]]). 2024년 1월의 일요일은 7, 14, 21, 28일 네 번이므로 길이는 4다. 1월 1일(월요일)과 31일(수요일)은 포함되지 않는다.",
          "`freq='D'`였다면 31, `freq='W-MON'`이었다면 1, 8, 15, 22, 29일로 5가 된다.",
          "",
          "시험에서는 [[date-range|date_range]]의 `freq`에 따른 개수나 첫 날짜를 묻는다. `'W'`가 일요일 기준이라는 점이 함정이다."
        ],
        terms: ["date-range", "frequency-alias"]
      },
      {
        id: "a-2-5-q12", node: "a-2-5", type: "short", kind: "fill", difficulty: 3,
        prompt: "빈칸에 알맞은 값을 쓰시오. 불규칙한 날짜 간격을 반영해 결측값을 선형 보간한다: `s.interpolate(method='____')`",
        answer: "time",
        explanation: [
          "**정답: time** [[interpolation|보간(interpolation)]]의 기본 `method='linear'`는 **행 위치**를 등간격으로 보고 채우지만, `method='time'`은 DatetimeIndex의 **실제 시간 간격**에 비례해 채운다. 3월 1일(10)과 3월 5일(20) 사이의 3월 2일은 time 보간으로 12.5가 된다.",
          "인덱스가 DatetimeIndex가 아니면 `method='time'`은 오류가 나므로, `asfreq('D')`로 격자를 만든 뒤 쓰는 것이 전형적인 순서다.",
          "",
          "시험에서는 `ffill`/`bfill`(앞·뒤 값 복사)과 `interpolate`(사이 값 계산)의 차이, 그리고 시계열에서 `method='time'`을 쓰는 이유를 묻는다."
        ],
        terms: ["interpolation", "asfreq"]
      },

      /* ===== a-2-6 Pandas 고급 ===== */
      {
        id: "a-2-6-q01", node: "a-2-6", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`('region', 'cat')` 두 레벨의 MultiIndex를 가진 Series `g`에서 `region` 레벨 값이 `'East'`인 행만(횡단면) 선택하는 코드는?",
        choices: [
          "`g.loc[:, 'East']`",
          "`g.xs('East', level='region')`",
          "`g.swaplevel('region')`",
          "`g.sort_index(level='region')`"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** `xs`(cross-section)는 [[multiindex|다중 인덱스(MultiIndex)]]에서 **특정 레벨의 특정 값**에 해당하는 [[cross-section|횡단면]]을 뽑는다. `level=`로 레벨을 지정하면 첫 레벨이 아니어도 선택할 수 있고, 선택된 레벨은 결과에서 제거된다(`drop_level=False`로 유지 가능).",
          "",
          "- ① Series에서 `loc[:, 'East']`는 두 번째 레벨 값이 'East'인 것을 뜻한다. region은 첫 레벨이므로 결과가 비거나 KeyError가 난다.",
          "- ③ `swaplevel`은 레벨 순서를 바꿀 뿐 행을 선택하지 않는다.",
          "- ④ `sort_index`는 정렬만 한다.",
          "",
          "시험에서는 `groupby([a, b])` 결과에서 한 레벨 값을 뽑는 방법으로 `xs`와 `loc[('A', 'x')]`(튜플 키)를 비교해 묻는다."
        ],
        terms: ["multiindex", "cross-section"]
      },
      {
        id: "a-2-6-q02", node: "a-2-6", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'id': [1, 2], 'tags': [['a', 'b'], ['c']]})",
          "print(df.explode('tags').shape)"
        ],
        lang: "python",
        choices: ["(2, 2)", "(2, 3)", "(3, 3)", "(3, 2)"],
        answer: 3,
        explanation: [
          "**정답: ④** [[explode|explode]]는 리스트 컬럼의 **원소 하나를 한 행으로** 펼친다. id 1은 태그가 2개라 2행, id 2는 1개라 1행 → 총 3행. 컬럼 수는 그대로 2이므로 `(3, 2)`. 펼쳐진 행의 인덱스는 원본 인덱스가 복제되어 `[0, 0, 1]`이 된다.",
          "",
          "- ① `(2, 2)`는 explode 전 원본의 shape다.",
          "- ② `(2, 3)`과 ③ `(3, 3)`은 컬럼이 늘어난 모양인데, explode는 컬럼을 추가하지 않는다. 컬럼이 늘어나는 것은 `pd.get_dummies`나 `str.split(expand=True)`다.",
          "",
          "시험에서는 explode 후의 행 수(리스트 길이의 합)와 인덱스 중복, 이어지는 `value_counts()`로 태그 빈도를 세는 패턴이 함께 나온다."
        ],
        terms: ["explode"]
      },
      {
        id: "a-2-6-q03", node: "a-2-6", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([1, -2, 3])",
          "print(s.where(s > 0, 0).tolist())"
        ],
        lang: "python",
        choices: ["[0, -2, 0]", "[1, 3]", "[1, 0, 3]", "[True, False, True]"],
        answer: 2,
        explanation: [
          "**정답: ③** [[where-mask|where]]는 **조건이 참인 곳은 원래 값을 유지**하고 거짓인 곳을 `other`(여기서는 0)로 바꾼다. -2만 조건(`> 0`)에 어긋나므로 0으로 바뀌어 `[1, 0, 3]`.",
          "",
          "- ① `[0, -2, 0]`은 반대 동작인 `s.mask(s > 0, 0)`의 결과다(참인 곳을 바꿈).",
          "- ② `[1, 3]`은 불리언 인덱싱 `s[s > 0]`의 결과로 길이가 줄어든다. `where`는 길이를 유지한다.",
          "- ④ 불리언 리스트는 조건식 `(s > 0).tolist()` 자체다.",
          "",
          "시험에서는 `where`와 `mask`의 방향을 뒤바꾼 보기가 반드시 나온다. 'where = 조건을 만족하는 것만 남기고 나머지 교체', `np.where(cond, a, b)`와는 인자 순서가 다르다는 점도 함께 기억한다."
        ],
        terms: ["where-mask"]
      },
      {
        id: "a-2-6-q04", node: "a-2-6", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "s = pd.Series([3, 9, 9, 1], index=['a', 'b', 'c', 'd'])",
          "print(s.idxmax())"
        ],
        lang: "python",
        choices: ["b", "c", "9", "1"],
        answer: 0,
        explanation: [
          "**정답: ①** [[idxmax|idxmax]]는 최댓값이 있는 **인덱스 라벨**을 돌려준다. 최댓값 9는 b와 c 두 곳에 있지만 **첫 번째 등장**인 `'b'`가 선택된다(`argmax()`라면 위치 1).",
          "",
          "- ② `'c'`는 두 번째 9의 라벨이다. 동률일 때 idxmax는 첫 것을 택한다.",
          "- ③ 9는 최댓값 **자체**로 `s.max()`의 결과다. idxmax는 값이 아니라 라벨.",
          "- ④ 1은 최솟값으로 `s.min()`이고, 그 라벨은 `s.idxmin()` → `'d'`다.",
          "",
          "시험에서는 '매출이 가장 큰 매장 이름'처럼 값이 아닌 라벨을 구하는 코드로 `idxmax`를 묻고, `max`·`argmax`·[[nlargest|nlargest]]와 구분시킨다."
        ],
        terms: ["idxmax", "nlargest"]
      },
      {
        id: "a-2-6-q05", node: "a-2-6", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "고유값이 5개뿐인 문자열 컬럼 `city`(100만 행)의 메모리 사용량을 줄이는 가장 적절한 방법은?",
        choices: [
          "`df['city'] = df['city'].astype('int64')`",
          "`df['city'] = df['city'].str.lower()`",
          "`df['city'] = df['city'].astype('category')`",
          "`df['city'] = pd.to_numeric(df['city'], downcast='integer')`"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[category-dtype|범주형(category)]]은 고유값 목록(categories)과 각 행의 정수 코드만 저장하므로, 고유값이 적고 행이 많은 문자열 컬럼에서 메모리가 크게 줄고 `groupby`도 빨라진다.",
          "",
          "- ① 도시 이름은 정수로 변환할 수 없어 ValueError가 난다.",
          "- ② 소문자로 바꿔도 문자열 객체 수는 그대로라 메모리는 거의 변하지 않는다.",
          "- ④ [[downcast|downcast]]는 **숫자** 컬럼을 더 작은 숫자형으로 줄이는 방법이다. 문자열에는 쓸 수 없다.",
          "",
          "시험에서는 '문자열 → category', '정수 → downcast/`astype('int8')`', '`memory_usage(deep=True)`로 확인'을 메모리 최적화 세트로 묻는다."
        ],
        terms: ["category-dtype", "downcast"]
      },
      {
        id: "a-2-6-q06", node: "a-2-6", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 마지막 줄에서 `UndefinedVariableError: name 'thr' is not defined`를 낸다. 올바른 수정은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'x': [1, 5, 10]})",
          "thr = 4",
          "print(df.query('x > thr'))"
        ],
        lang: "python",
        choices: [
          "`df.query('x > thr', engine='python')`",
          "`df.query('x > @thr')`",
          "`df.query('df.x > thr')`",
          "`df.query(x > thr)`"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[query|query]]의 문자열 식 안에서는 컬럼명이 변수처럼 쓰이므로, **파이썬 지역 변수**를 참조하려면 `@thr`처럼 `@`를 붙여야 한다. `eval`도 같은 규칙이다.",
          "",
          "- ① `engine='python'`은 계산 엔진만 바꾸며 변수 해석 규칙은 그대로다. 여전히 `thr`을 찾지 못한다.",
          "- ③ `df.x`는 query 문자열 안에서 컬럼 참조 방식이 아니다. `thr` 문제도 그대로 남는다.",
          "- ④ 따옴표를 빼면 `x`가 파이썬 이름으로 해석되어 `NameError: name 'x' is not defined`가 난다.",
          "",
          "시험에서는 `query('col > @var')`의 `@` 규칙, 공백이 있는 컬럼명을 백틱으로 감싸는 규칙, `in`/`not in` 사용을 함께 묻는다. [[method-chaining|메서드 체이닝]] 중간 필터로 자주 쓰인다."
        ],
        terms: ["query", "method-chaining"]
      },
      {
        id: "a-2-6-q07", node: "a-2-6", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "`s = pd.Series(['A-12', 'B-7'])`일 때 `s.str.extract(r'(\\d+)')`의 반환에 대한 설명으로 옳은 것은?",
        choices: [
          "일치한 문자열 전체 'A-12', 'B-7'을 담은 Series를 돌려준다.",
          "일치 여부를 나타내는 불리언 Series를 돌려준다.",
          "일치한 모든 숫자를 리스트로 담은 Series를 돌려준다.",
          "캡처 그룹별로 한 컬럼씩 가진 DataFrame(여기서는 1열, 값 '12', '7')을 돌려주며, `expand=False`를 주면 Series가 된다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[str-accessor|str 접근자]]의 `extract`는 [[regex|정규식(regular expression)]]의 **캡처 그룹**(괄호) 하나당 한 컬럼을 만든 **DataFrame**을 돌려준다(기본 `expand=True`). 그룹이 하나뿐이고 Series가 필요하면 `expand=False` 또는 `[0]`을 붙인다. 추출값은 문자열이므로 숫자 계산 전에 `astype(int)`가 필요하다.",
          "",
          "- ① 전체 일치 문자열이 아니라 **괄호 안**만 추출된다.",
          "- ② 불리언 Series는 `str.contains`의 결과다.",
          "- ③ 모든 일치를 리스트/행으로 모으는 것은 `str.findall` / `str.extractall`이다. `extract`는 첫 일치만.",
          "",
          "시험에서는 `contains`(불리언) / `extract`(캡처 그룹 DataFrame) / `findall`(리스트) / `replace`(치환) 네 메서드의 반환형을 구분하는 문제로 나온다."
        ],
        terms: ["str-accessor", "regex"]
      },
      {
        id: "a-2-6-q08", node: "a-2-6", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`df.assign(total=df['price'] * df['qty'])`는 원본 `df`를 바꾸지 않고 `total` 컬럼이 추가된 새 DataFrame을 돌려준다.",
        answer: true,
        explanation: [
          "**정답: O** [[assign|assign]]은 항상 **복사본**을 돌려주는 메서드라 원본은 그대로다. 그래서 `df.query(...).assign(...).pipe(...)`처럼 [[method-chaining|메서드 체이닝]] 중간에 컬럼을 만들 때 쓴다. 람다를 주면(`assign(total=lambda d: d['price'] * d['qty'])`) 체인 앞 단계의 결과를 받아 계산한다.",
          "원본을 직접 바꾸려면 `df['total'] = ...` 대입을 쓴다.",
          "",
          "시험에서는 '원본을 바꾸지 않는 컬럼 추가 메서드'로 `assign`을 묻거나, 람다 인자가 무엇을 받는지 묻는다."
        ],
        terms: ["assign", "method-chaining"]
      },
      {
        id: "a-2-6-q09", node: "a-2-6", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`pd.Grouper(key='date', freq='MS')`는 `resample` 전용 객체이므로 `groupby`에는 쓸 수 없다.",
        answer: false,
        explanation: [
          "**정답: X** [[grouper|pd.Grouper]]는 바로 `groupby`에 넣어 쓰는 객체다. `df.groupby(pd.Grouper(key='date', freq='MS'))['sales'].sum()`은 날짜 컬럼을 월 단위로 묶어 집계하며, `df.groupby(['store', pd.Grouper(key='date', freq='MS')])`처럼 **다른 키와 함께** 시간 그룹을 만들 수 있다는 점이 `resample` 대비 장점이다.",
          "`resample`은 인덱스(또는 `on=`)가 시간이어야 하고 시간 축 하나로만 묶지만, Grouper는 일반 groupby 키와 섞인다.",
          "",
          "시험에서는 '매장별 × 월별 합계'처럼 범주 키와 시간 키를 동시에 묶는 코드에서 Grouper를 고르는 문제로 나온다."
        ],
        terms: ["grouper", "resample"]
      },
      {
        id: "a-2-6-q10", node: "a-2-6", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 메서드 이름을 쓰시오. `df.____(f, 2)`는 `f(df, 2)`와 같으며 메서드 체이닝 중간에 사용자 함수를 끼울 때 쓴다.",
        answer: "pipe",
        explanation: [
          "**정답: pipe** [[pipe|pipe]]는 DataFrame/Series를 첫 인자로 사용자 함수에 넘겨 호출한다. `df.pipe(f, 2)` = `f(df, 2)`. 덕분에 `f(g(h(df)))`처럼 안에서 밖으로 읽어야 하는 코드를 `df.pipe(h).pipe(g).pipe(f)`로 왼쪽에서 오른쪽으로 읽는 [[method-chaining|메서드 체이닝]]이 된다.",
          "`apply`는 각 행·열(또는 원소)에 함수를 적용하는 것이고, `pipe`는 **객체 전체**를 함수에 넘기는 것이라는 차이가 있다.",
          "",
          "시험에서는 `pipe`와 `apply`의 차이, 그리고 `pipe((f, 'data'), arg)` 형태로 데이터를 다른 위치의 키워드 인자로 넘기는 문법을 묻는다."
        ],
        terms: ["pipe", "method-chaining", "apply"]
      },
      {
        id: "a-2-6-q11", node: "a-2-6", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드가 출력하는 숫자를 쓰시오.",
        code: [
          "import pandas as pd",
          "s = pd.Series(['apple', 'banana', 'cherry'])",
          "print(s.str.contains(r'^[ab]').sum())"
        ],
        lang: "python",
        answer: "2",
        explanation: [
          "**정답: 2** `str.contains`는 기본 `regex=True`라 [[regex|정규식(regular expression)]] `^[ab]`(a 또는 b로 **시작**)을 적용한다. 'apple', 'banana'가 참이고 'cherry'는 거짓이므로 불리언 Series `[True, True, False]`의 합은 2다.",
          "`^`가 없었다면 'cherry'에도 a가 없어 결과는 같지만, 예컨대 'grape'는 `^[ab]`에는 거짓, `[ab]`에는 참이 된다. 특수문자를 문자 그대로 찾을 때는 `regex=False`를 준다.",
          "",
          "시험에서는 [[str-accessor|str 접근자]]의 `contains` 결과(불리언)에 `sum()`을 붙여 개수를 세는 패턴, 그리고 `na=False`로 결측 처리하는 인자를 묻는다."
        ],
        terms: ["str-accessor", "regex"]
      },
      {
        id: "a-2-6-q12", node: "a-2-6", type: "short", kind: "fill", difficulty: 3,
        prompt: "빈칸에 알맞은 인자 이름을 쓰시오. 정수 Series를 값 범위에 맞는 가장 작은 정수형으로 축소한다: `pd.to_numeric(s, ____='integer')`",
        answer: "downcast",
        explanation: [
          "**정답: downcast** `pd.to_numeric`의 [[downcast|downcast]] 인자에 `'integer'`, `'signed'`, `'unsigned'`, `'float'`를 주면 값 범위를 보고 **가장 작은** 자료형(예: 값이 모두 −128~127 안이면 `int8`, 그보다 크면 `int16`, `int32` 순)으로 바꾼다. `astype('int8')`처럼 직접 지정하면 범위를 넘는 값이 잘릴 수 있어 downcast가 안전하다.",
          "문자열 컬럼의 메모리 절약은 [[category-dtype|범주형(category)]]으로, 숫자 컬럼은 downcast로 — 둘이 메모리 최적화의 짝이다.",
          "",
          "시험에서는 `to_numeric`의 `errors='coerce'`(변환 실패 → NaN)와 `downcast`를 한 문제에 묶어 묻는다."
        ],
        terms: ["downcast", "category-dtype"]
      }
    ],

    /* ───────────────────────── 실습 과제 ───────────────────────── */
    practices: [
      /* ===== a-2-4 ===== */
      {
        id: "a-2-4-p01", node: "a-2-4",
        title: "내부 조인 후 남는 주문 수",
        difficulty: 1,
        task: [
          "`orders`와 `customers`를 `cust_id` 기준으로 **내부 조인(inner join)** 하고, 결과의 **행 수**를 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240401)",
          "orders = pd.DataFrame({",
          "    'order_id': np.arange(1, 201),",
          "    'cust_id': rng.integers(1, 61, size=200),      # 1~60 (고객 표에는 1~50만 있다)",
          "    'amount': rng.integers(10, 500, size=200),",
          "})",
          "customers = pd.DataFrame({",
          "    'cust_id': np.arange(1, 51),",
          "    'region': rng.choice(['East', 'West', 'North'], size=50),",
          "})",
          "orders.head()"
        ],
        hint: ["`pd.merge(orders, customers, on='cust_id')` 의 기본 how 가 inner 다. `len()` 으로 행 수."],
        answer: { type: "int", value: 154 },
        solution: ["len(pd.merge(orders, customers, on='cust_id', how='inner'))"],
        explanation: [
          "고객 표에 없는 `cust_id`(51~60)를 가진 주문은 [[inner-join|내부 조인]]에서 탈락한다. 그래서 결과 행 수는 원래 200보다 작다.",
          "고객 키는 유일하므로 행이 곱해져 늘어나는 일은 없다. `how='left'`였다면 200행이 그대로 남고 region 만 NaN 이 된다."
        ],
        terms: ["merge", "inner-join"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-4-p02", node: "a-2-4",
        title: "왼쪽 조인으로 짝 없는 주문의 금액 합",
        difficulty: 2,
        task: [
          "`orders`를 기준으로 `customers`를 **왼쪽 조인(left join)** 한 뒤, `region`이 결측(짝이 없는 고객)인 주문들의 `amount` **합계**를 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240401)",
          "orders = pd.DataFrame({",
          "    'order_id': np.arange(1, 201),",
          "    'cust_id': rng.integers(1, 61, size=200),",
          "    'amount': rng.integers(10, 500, size=200),",
          "})",
          "customers = pd.DataFrame({",
          "    'cust_id': np.arange(1, 51),",
          "    'region': rng.choice(['East', 'West', 'North'], size=50),",
          "})",
          "orders.head()"
        ],
        hint: [
          "`how='left'` 로 병합하면 orders 행이 모두 남는다.",
          "`m['region'].isna()` 로 짝 없는 행을 고른다. `indicator=True` 의 `left_only` 로도 같다."
        ],
        answer: { type: "int", value: 12625 },
        solution: [
          "m = pd.merge(orders, customers, on='cust_id', how='left')",
          "int(m.loc[m['region'].isna(), 'amount'].sum())"
        ],
        explanation: [
          "[[left-join|왼쪽 조인]]은 왼쪽(orders) 행을 모두 보존하고 오른쪽에 짝이 없으면 [[missing-value|결측값(NaN)]]을 채운다. 그 결측을 조건으로 쓰면 '매칭 실패 주문'만 걸러진다.",
          "`indicator=True` 로 `_merge == 'left_only'` 를 쓰는 방법도 같은 답을 준다. 실무에서는 이렇게 조인 실패분을 점검하는 것이 데이터 품질 확인의 기본이다."
        ],
        terms: ["left-join", "missing-value", "indicator"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-4-p03", node: "a-2-4",
        title: "combine_first로 결측 가격 보완 후 평균",
        difficulty: 3,
        task: [
          "`main`의 `price`에는 결측이 있고, `backup`에는 더 많은 `id`(1~50)의 가격이 있다.",
          "두 표를 `id`를 인덱스로 맞춘 뒤 `main`의 결측을 `backup` 값으로 채우고, `main`에 없는 `id`도 `backup` 값으로 포함(합집합)한 **가격의 평균**을 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240403)",
          "main = pd.DataFrame({'id': np.arange(1, 41), 'price': rng.normal(100, 15, size=40).round(1)})",
          "main.loc[rng.choice(40, size=8, replace=False), 'price'] = np.nan   # 8개 결측",
          "backup = pd.DataFrame({'id': np.arange(1, 51), 'price': rng.normal(95, 15, size=50).round(1)})",
          "main.head()"
        ],
        hint: [
          "`main.set_index('id')['price'].combine_first(backup.set_index('id')['price'])`",
          "결과 길이는 50(합집합)이어야 한다."
        ],
        answer: { type: "number", value: 98.21, decimals: 2 },
        solution: [
          "a = main.set_index('id')['price']",
          "b = backup.set_index('id')['price']",
          "filled = a.combine_first(b)",
          "round(filled.mean(), 2)"
        ],
        explanation: [
          "[[combine-first|combine_first]]는 호출한 쪽(`a`)의 값을 우선하고, `a`가 결측인 자리와 `a`에 없는 인덱스를 `b`로 채워 **인덱스 합집합**(50개)을 돌려준다. 결과에 결측이 남지 않으므로 `mean()`이 전 50개의 평균이 된다.",
          "같은 결과를 `merge(how='outer')` + `fillna` 로도 만들 수 있지만, 인덱스를 맞춘 뒤 `combine_first` 한 줄이 가장 간결하다. 인덱스를 맞추지 않고 그냥 호출하면 위치(0~39)로 짝지어져 틀린 값이 나온다."
        ],
        terms: ["combine-first", "outer-join", "missing-value"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },

      /* ===== a-2-5 ===== */
      {
        id: "a-2-5-p01", node: "a-2-5",
        title: "월별 매출 합계의 최댓값",
        difficulty: 1,
        task: [
          "일별 매출 `sales`(2024-01-01 ~ 2024-03-31)를 **월 단위**로 리샘플링해 합계를 구하고, 세 달 중 **가장 큰 월 합계**를 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240501)",
          "idx = pd.date_range('2024-01-01', '2024-03-31', freq='D')",
          "sales = pd.Series(rng.integers(50, 150, size=len(idx)), index=idx, name='sales')",
          "sales.head()"
        ],
        hint: ["`sales.resample('MS').sum()` 뒤에 `.max()`. 월초 라벨 'MS' 는 pandas 버전과 무관하게 동작한다."],
        answer: { type: "int", value: 3212 },
        solution: ["int(sales.resample('MS').sum().max())"],
        explanation: [
          "[[resample|리샘플링]]은 시간 축의 groupby 다. `'MS'`(month start)로 묶으면 1월·2월·3월 세 구간이 생기고 `sum()`이 각 구간을 합친다. 그 Series 에 `max()`를 붙이면 스칼라.",
          "월말 라벨 `'M'`은 pandas 2.2에서 `'ME'`로 이름이 바뀌었으므로, 버전을 가리지 않는 `'MS'`를 쓰는 습관이 안전하다. 라벨만 다르고 합계 값은 같다."
        ],
        terms: ["resample", "frequency-alias", "datetimeindex"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-5-p02", node: "a-2-5",
        title: "7일 이동평균의 최댓값",
        difficulty: 2,
        task: [
          "같은 일별 매출 `sales`에서 **7일 이동평균(rolling mean, window=7)** 을 구하고, 그 최댓값을 소수 둘째 자리까지 반올림해 입력하시오. (`min_periods`는 기본값 그대로 둔다)"
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240501)",
          "idx = pd.date_range('2024-01-01', '2024-03-31', freq='D')",
          "sales = pd.Series(rng.integers(50, 150, size=len(idx)), index=idx, name='sales')",
          "sales.head()"
        ],
        hint: ["`sales.rolling(7).mean()` 의 앞 6개는 NaN 이지만 `max()` 는 NaN 을 무시한다."],
        answer: { type: "number", value: 124.14, decimals: 2 },
        solution: ["round(sales.rolling(7).mean().max(), 2)"],
        explanation: [
          "[[rolling|이동 윈도]] 7은 각 날짜에서 그날 포함 직전 7일의 평균을 만든다. 처음 6일은 값이 7개가 안 되어 NaN(`min_periods` 기본 = 창 크기)이지만, `max()`는 결측을 건너뛰므로 그대로 호출해도 된다.",
          "`rolling(7, center=True)` 로 하면 창이 가운데 정렬되어 값이 달라지고, `min_periods=1` 을 주면 초반 NaN 이 사라진다 — 과제에서 기본값을 명시한 이유다."
        ],
        terms: ["rolling", "missing-value"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-5-p03", node: "a-2-5",
        title: "불규칙 관측을 일 단위로 보간한 평균",
        difficulty: 3,
        task: [
          "불규칙한 날짜에 측정된 기온 `temp`를 `asfreq('D')`로 **매일 격자**로 바꾸면 측정이 없는 날은 결측이 된다.",
          "그 결측을 **시간 기반 보간**(`interpolate(method='time')`)으로 채운 뒤, 보간된 일별 시리즈 전체의 **평균**을 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240503)",
          "days = np.sort(rng.choice(np.arange(60), size=25, replace=False))   # 60일 중 25일만 관측",
          "idx = pd.Timestamp('2024-03-01') + pd.to_timedelta(days, unit='D')",
          "temp = pd.Series(rng.normal(12, 3, size=25).round(1), index=idx, name='temp')",
          "temp.head()"
        ],
        hint: [
          "`temp.asfreq('D')` 는 첫 관측일부터 마지막 관측일까지 매일 행을 만들고 빈 날은 NaN.",
          "`.interpolate(method='time')` 는 DatetimeIndex 의 실제 간격에 비례해 채운다."
        ],
        answer: { type: "number", value: 13.11, decimals: 2 },
        solution: [
          "daily = temp.asfreq('D')",
          "filled = daily.interpolate(method='time')",
          "round(filled.mean(), 2)"
        ],
        explanation: [
          "[[asfreq|asfreq]]는 집계 없이 빈도만 바꾸므로 새로 생긴 날짜는 [[missing-value|결측값(NaN)]]이다. `resample('D').mean()` 으로도 같은 격자를 만들 수 있다(관측이 하루 1개뿐이므로).",
          "[[interpolation|보간]]에서 `method='time'`은 두 관측 사이의 날짜 거리에 비례해 값을 채우고, `'linear'`는 행 번호 기준이다. 매일 격자 위에서는 두 방법의 값이 같지만, 격자를 만들지 않은 불규칙 인덱스에서는 다르다 — 그래서 시계열에서는 `'time'`이 정석이다."
        ],
        terms: ["asfreq", "interpolation", "missing-value"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },

      /* ===== a-2-6 ===== */
      {
        id: "a-2-6-p01", node: "a-2-6",
        title: "상위 5개 점수의 합",
        difficulty: 1,
        task: [
          "`df`에서 `score`가 가장 큰 **상위 5개 행**을 `nlargest`로 고르고, 그 5개 `score`의 **합**을 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240601)",
          "df = pd.DataFrame({",
          "    'id': np.arange(1, 101),",
          "    'score': rng.integers(0, 1000, size=100),",
          "    'grp': rng.choice(list('ABC'), size=100),",
          "})",
          "df.head()"
        ],
        hint: ["`df.nlargest(5, 'score')['score'].sum()`"],
        answer: { type: "int", value: 4930 },
        solution: ["int(df.nlargest(5, 'score')['score'].sum())"],
        explanation: [
          "[[nlargest|nlargest(n, col)]]은 `sort_values(col, ascending=False).head(n)` 과 같은 결과를 더 효율적으로 낸다. 동률 처리는 `keep='first'` 기본값으로 먼저 나온 행을 택하지만, 합계만 묻는 이 과제에서는 영향이 없다.",
          "가장 큰 **한 행의 라벨**만 필요하면 [[idxmax|idxmax]]를 쓴다."
        ],
        terms: ["nlargest", "idxmax"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-6-p02", node: "a-2-6",
        title: "explode 후 가장 흔한 태그의 빈도",
        difficulty: 2,
        task: [
          "`df['tags']`는 각 행이 태그 **리스트**다. `explode`로 태그를 행 단위로 펼친 뒤, **가장 많이 등장한 태그의 등장 횟수**를 정수로 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240602)",
          "pool = ['py', 'sql', 'ml', 'viz', 'etl']",
          "df = pd.DataFrame({'id': np.arange(1, 61)})",
          "df['tags'] = [list(rng.choice(pool, size=rng.integers(1, 4), replace=False)) for _ in range(60)]",
          "df.head()"
        ],
        hint: ["`df.explode('tags')['tags'].value_counts().max()`"],
        answer: { type: "int", value: 29 },
        solution: ["int(df.explode('tags')['tags'].value_counts().max())"],
        explanation: [
          "[[explode|explode]]는 리스트의 원소마다 행을 하나씩 만들고 다른 컬럼 값은 복제한다(인덱스도 복제). 펼친 뒤에는 보통의 범주 컬럼처럼 `value_counts()`로 빈도를 셀 수 있다.",
          "같은 태그가 한 행 안에서 중복되지 않도록 `replace=False`로 뽑았으므로, 이 빈도는 '그 태그를 가진 행의 수'와 같다."
        ],
        terms: ["explode"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-2-6-p03", node: "a-2-6",
        title: "매장별 3일 이동평균의 최댓값",
        difficulty: 3,
        task: [
          "`df`는 매장(`store`) 3곳의 30일간 일별 매출이다. **매장별로** 3일 이동평균(window=3, `min_periods` 기본값)을 구하고, 모든 매장·날짜에 걸친 이동평균의 **최댓값**을 소수 둘째 자리까지 반올림해 입력하시오.",
          "(이동평균이 매장 경계를 넘어 섞이지 않도록 `groupby` 뒤에 `rolling`을 써야 한다.)"
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(240603)",
          "idx = pd.date_range('2024-01-01', periods=30, freq='D')",
          "df = pd.DataFrame({",
          "    'date': np.tile(idx, 3),",
          "    'store': np.repeat(['S1', 'S2', 'S3'], 30),",
          "    'sales': rng.integers(100, 300, size=90),",
          "})",
          "df.head()"
        ],
        hint: [
          "`df.groupby('store')['sales'].rolling(3).mean()` 은 (store, 원본 인덱스) MultiIndex 의 Series.",
          "거기에 `.max()` 를 붙이면 전체 최댓값."
        ],
        answer: { type: "number", value: 279.67, decimals: 2 },
        solution: ["round(df.groupby('store')['sales'].rolling(3).mean().max(), 2)"],
        explanation: [
          "[[groupby-rolling|groupby 뒤의 rolling]]은 그룹 **안에서만** 창을 굴린다. 그냥 `df['sales'].rolling(3)` 을 쓰면 S1 의 마지막 날과 S2 의 첫날이 한 창에 섞여 틀린 값이 나온다.",
          "결과는 `store`가 첫 레벨인 [[multiindex|MultiIndex]] Series 다. 원본 df 에 컬럼으로 붙이려면 `groupby('store')['sales'].transform(lambda s: s.rolling(3).mean())` 처럼 transform 을 쓰는 것이 길이가 맞아 편하다."
        ],
        terms: ["groupby-rolling", "rolling", "multiindex"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      }
    ],

    /* ───────────────────────── 용어 사전 ───────────────────────── */
    terms: [
      /* 2-4 병합과 결합 */
      { id: "merge", ko: "병합", en: "merge",
        def: "두 DataFrame을 하나 이상의 키 컬럼(또는 인덱스) 값이 일치하는 행끼리 가로로 붙이는 연산. SQL의 조인에 해당하며 how 인자로 남길 행을 정한다.",
        nodes: ["a-2-4"], related: ["join", "inner-join", "left-join", "outer-join", "concat"] },
      { id: "join", ko: "조인", en: "join",
        def: "키가 일치하는 행을 짝지어 두 표를 결합하는 연산. pandas의 DataFrame.join은 인덱스를 기준으로 결합하며 how 기본값이 left다.",
        nodes: ["a-2-4"], related: ["merge", "inner-join", "left-join"] },
      { id: "inner-join", ko: "내부 조인", en: "inner join",
        def: "양쪽 표에 모두 존재하는 키의 행만 남기는 결합 방식. 교집합에 해당하며 pandas merge의 기본값이다.",
        nodes: ["a-2-4"], related: ["left-join", "outer-join", "merge"] },
      { id: "left-join", ko: "왼쪽 조인", en: "left join / left outer join",
        def: "왼쪽 표의 행을 모두 남기고 오른쪽에서 키가 일치하는 값을 붙이는 결합 방식. 짝이 없는 오른쪽 컬럼은 결측값이 된다.",
        nodes: ["a-2-4"], related: ["inner-join", "outer-join", "missing-value"] },
      { id: "outer-join", ko: "외부 조인", en: "outer join / full outer join",
        def: "양쪽 표의 키 합집합을 모두 남기는 결합 방식. 어느 한쪽에만 있는 행은 상대편 컬럼이 결측값으로 채워진다.",
        nodes: ["a-2-4"], related: ["inner-join", "left-join", "missing-value"] },
      { id: "cross-join", ko: "교차 조인", en: "cross join",
        def: "키 없이 왼쪽 표의 모든 행과 오른쪽 표의 모든 행을 조합하는 결합 방식. 결과 행 수는 두 표 행 수의 곱이다.",
        nodes: ["a-2-4"], related: ["merge"] },
      { id: "concat", ko: "결합(이어 붙이기)", en: "concat / concatenation",
        def: "여러 DataFrame이나 Series를 행 방향(axis=0) 또는 열 방향(axis=1)으로 이어 붙이는 연산. 키가 아니라 축과 인덱스 정렬을 기준으로 한다.",
        nodes: ["a-2-4"], related: ["merge", "multiindex"] },
      { id: "suffixes", ko: "접미사", en: "suffixes",
        def: "merge에서 키가 아닌 컬럼 이름이 양쪽에 겹칠 때 구분을 위해 붙이는 꼬리표. 기본값은 ('_x', '_y')다.",
        nodes: ["a-2-4"], related: ["merge"] },
      { id: "indicator", ko: "출처 표시", en: "indicator",
        def: "merge에서 indicator=True를 주면 각 행이 left_only, right_only, both 중 어디서 왔는지 나타내는 _merge 컬럼이 추가된다.",
        nodes: ["a-2-4"], related: ["merge", "outer-join"] },
      { id: "validate", ko: "병합 검증", en: "validate",
        def: "merge에서 키의 중복 관계가 one_to_one(1:1), one_to_many(1:m), many_to_one(m:1) 조건을 만족하는지 검사하고 위반 시 MergeError를 내는 인자.",
        nodes: ["a-2-4"], related: ["merge"] },
      { id: "combine-first", ko: "결측 우선 결합", en: "combine_first",
        def: "호출한 객체의 결측값을 다른 객체의 같은 위치 값으로 채우고, 인덱스와 컬럼은 두 객체의 합집합으로 돌려주는 메서드.",
        nodes: ["a-2-4"], related: ["missing-value", "outer-join"] },
      { id: "missing-value", ko: "결측값", en: "missing value / NaN",
        def: "관측되지 않았거나 존재하지 않아 비어 있는 값. pandas에서는 NaN(또는 NaT, None)으로 표현되며 isna()로 찾는다.",
        nodes: ["a-2-4", "a-2-5"], related: ["interpolation", "outer-join"] },

      /* 2-5 시계열 */
      { id: "datetime", ko: "날짜시간형", en: "datetime / datetime64",
        def: "날짜와 시각을 나타내는 pandas 자료형. pd.to_datetime으로 문자열에서 변환하며, 변환 후에만 dt 접근자와 시계열 연산을 쓸 수 있다.",
        nodes: ["a-2-5"], related: ["datetimeindex", "dt-accessor"] },
      { id: "datetimeindex", ko: "날짜시간 인덱스", en: "DatetimeIndex",
        def: "datetime64 값으로 이루어진 인덱스. 이를 가진 Series/DataFrame에서 resample, asfreq, 시간 기반 슬라이싱과 보간이 가능하다.",
        nodes: ["a-2-5"], related: ["datetime", "date-range", "resample"] },
      { id: "dt-accessor", ko: "dt 접근자", en: ".dt accessor",
        def: "datetime형 Series에서 year, month, dayofweek, day_name() 등 날짜 속성을 벡터 단위로 꺼내는 접근자. 문자열 Series에는 쓸 수 없다.",
        nodes: ["a-2-5"], related: ["datetime", "str-accessor"] },
      { id: "resample", ko: "리샘플링", en: "resample / resampling",
        def: "시계열의 빈도를 바꾸면서 구간별로 집계 함수를 적용하는 연산. 시간 축에 대한 groupby에 해당하며 집계 메서드를 붙여야 값이 나온다.",
        nodes: ["a-2-5", "a-2-6"], related: ["asfreq", "frequency-alias", "grouper"] },
      { id: "asfreq", ko: "빈도 변환", en: "asfreq",
        def: "집계 없이 시계열의 빈도만 바꾸어 각 시점의 값을 그대로 가져오는 메서드. 원본에 없던 시점은 결측값이 된다.",
        nodes: ["a-2-5"], related: ["resample", "interpolation"] },
      { id: "rolling", ko: "이동 윈도", en: "rolling window / moving average",
        def: "고정 크기의 창을 한 칸씩 밀면서 창 안의 값에 통계를 적용하는 연산. 창이 다 채워지기 전의 앞부분은 결측값이 된다.",
        nodes: ["a-2-5", "a-2-6"], related: ["expanding", "ewm", "groupby-rolling"] },
      { id: "expanding", ko: "누적 윈도", en: "expanding window",
        def: "시작점부터 현재 시점까지 모든 값을 창으로 삼아 통계를 적용하는 연산. 창 크기가 한 칸씩 늘어나며 누적 평균·누적 합 등을 만든다.",
        nodes: ["a-2-5"], related: ["rolling", "ewm"] },
      { id: "ewm", ko: "지수가중 이동", en: "ewm / exponentially weighted moving",
        def: "최근 값에 지수적으로 큰 가중치를 주어 평균 등을 계산하는 윈도 연산. span, halflife, alpha 중 하나로 감쇠 속도를 지정한다.",
        nodes: ["a-2-5"], related: ["rolling", "expanding"] },
      { id: "shift", ko: "시프트(지연)", en: "shift / lag",
        def: "값을 지정한 칸 수만큼 앞이나 뒤로 미는 연산. 밀려서 비는 자리는 결측값이 되며 전 시점 값과의 비교(diff, pct_change)의 기초다.",
        nodes: ["a-2-5"], related: ["pct-change"] },
      { id: "pct-change", ko: "변화율", en: "pct_change / percentage change",
        def: "각 값이 직전 값에 비해 몇 배 변했는지(s / s.shift(1) - 1)를 구하는 연산. 첫 값은 결측값이다.",
        nodes: ["a-2-5"], related: ["shift"] },
      { id: "timezone", ko: "시간대", en: "timezone / tz_localize / tz_convert",
        def: "시각이 어느 지역 기준인지 나타내는 정보. tz_localize는 시간대 없는 값에 시간대를 붙이고, tz_convert는 이미 있는 시간대를 다른 시간대로 환산한다.",
        nodes: ["a-2-5"], related: ["datetime"] },
      { id: "date-range", ko: "날짜 범위 생성", en: "date_range",
        def: "시작·끝(또는 개수)과 빈도를 지정해 등간격 DatetimeIndex를 만드는 함수.",
        nodes: ["a-2-5"], related: ["datetimeindex", "frequency-alias"] },
      { id: "period", ko: "기간", en: "Period / PeriodIndex",
        def: "특정 시점이 아니라 '2024년 2월'처럼 일정 길이의 구간을 나타내는 pandas 자료형. to_period('M')로 변환하며 월·분기 단위 집계 라벨로 쓴다.",
        nodes: ["a-2-5"], related: ["frequency-alias", "datetime"] },
      { id: "interpolation", ko: "보간", en: "interpolation",
        def: "알려진 이웃 값(데이터 점) 사이의 값을 추정해 결측을 채우는 방법. pandas interpolate() 의 기본 method='linear' 는 행 위치 기준, method='time' 은 실제 시간 간격에 비례하며, scipy.interpolate.interp1d 도 같은 일을 한다.",
        nodes: ["a-2-5"], related: ["missing-value", "asfreq"] },
      { id: "frequency-alias", ko: "빈도 별칭", en: "frequency alias / offset alias",
        def: "D(일), W(주), MS(월초), QS(분기초), h(시) 같이 시간 간격을 나타내는 문자열 코드. date_range, resample, asfreq의 freq 인자에 쓴다.",
        nodes: ["a-2-5"], related: ["resample", "date-range"] },

      /* 2-6 고급 */
      { id: "multiindex", ko: "다중 인덱스", en: "MultiIndex / hierarchical index",
        def: "두 개 이상의 레벨로 이루어진 계층적 인덱스. 여러 키로 groupby하거나 set_index에 여러 컬럼을 주면 생기며 xs, swaplevel, sort_index로 다룬다.",
        nodes: ["a-2-6", "a-2-4"], related: ["cross-section", "groupby-rolling"] },
      { id: "cross-section", ko: "횡단면 선택", en: "xs / cross-section",
        def: "MultiIndex에서 특정 레벨의 특정 값에 해당하는 행(또는 열)만 뽑는 연산. DataFrame.xs(key, level=...)로 수행한다.",
        nodes: ["a-2-6"], related: ["multiindex"] },
      { id: "vectorization", ko: "벡터화", en: "vectorization",
        def: "파이썬 반복문 대신 배열 전체에 한 번에 적용되는 연산을 쓰는 방식. 행 단위 apply보다 훨씬 빠르다.",
        nodes: ["a-2-6"], related: ["apply"] },
      { id: "apply", ko: "함수 적용", en: "apply",
        def: "각 행·열(DataFrame) 또는 각 원소(Series)에 사용자 함수를 적용하는 메서드. 유연하지만 파이썬 수준 반복이라 벡터화 연산보다 느리다.",
        nodes: ["a-2-6"], related: ["vectorization", "pipe"] },
      { id: "pipe", ko: "파이프", en: "pipe",
        def: "DataFrame이나 Series 전체를 첫 인자로 사용자 함수에 넘겨 호출하는 메서드. df.pipe(f, x)는 f(df, x)와 같아 메서드 체이닝을 이어 준다.",
        nodes: ["a-2-6"], related: ["method-chaining", "apply"] },
      { id: "assign", ko: "컬럼 추가(복사본)", en: "assign",
        def: "원본을 바꾸지 않고 새 컬럼이 추가된 DataFrame 복사본을 돌려주는 메서드. 람다를 주면 체인 앞 단계의 결과를 받아 계산한다.",
        nodes: ["a-2-6"], related: ["method-chaining", "pipe"] },
      { id: "query", ko: "질의 필터", en: "query",
        def: "문자열로 쓴 조건식으로 행을 걸러내는 메서드. 식 안에서 파이썬 변수는 @를 붙여 참조한다.",
        nodes: ["a-2-6"], related: ["method-chaining"] },
      { id: "method-chaining", ko: "메서드 체이닝", en: "method chaining",
        def: "결과를 중간 변수에 담지 않고 메서드를 점(.)으로 연속 호출해 처리 흐름을 한 식으로 쓰는 스타일. query, assign, pipe가 대표적 도구다.",
        nodes: ["a-2-6"], related: ["pipe", "assign", "query"] },
      { id: "category-dtype", ko: "범주형", en: "category dtype / Categorical",
        def: "고유값 목록과 각 행의 정수 코드로 값을 저장하는 자료형. 고유값이 적은 문자열 컬럼의 메모리를 크게 줄이고 groupby를 빠르게 한다.",
        nodes: ["a-2-6"], related: ["downcast"] },
      { id: "downcast", ko: "자료형 축소", en: "downcast",
        def: "숫자 컬럼을 값 범위에 맞는 가장 작은 자료형(int8, float32 등)으로 바꾸어 메모리를 줄이는 것. pd.to_numeric(s, downcast='integer')로 수행한다.",
        nodes: ["a-2-6"], related: ["category-dtype"] },
      { id: "explode", ko: "리스트 펼치기", en: "explode",
        def: "리스트 형태의 값을 가진 컬럼을 원소 하나당 한 행으로 펼치는 메서드. 다른 컬럼과 인덱스는 복제된다.",
        nodes: ["a-2-6"], related: ["str-accessor"] },
      { id: "where-mask", ko: "조건 치환", en: "where / mask",
        def: "조건에 따라 값을 바꾸는 메서드 쌍. where는 조건이 거짓인 곳을, mask는 조건이 참인 곳을 other 값으로 바꾸며 길이는 유지된다.",
        nodes: ["a-2-6"], related: ["vectorization"] },
      { id: "nlargest", ko: "상위 n개 선택", en: "nlargest / nsmallest",
        def: "지정한 컬럼 값이 가장 큰(작은) n개의 행을 돌려주는 메서드. 전체 정렬 후 head보다 효율적이다.",
        nodes: ["a-2-6"], related: ["idxmax"] },
      { id: "idxmax", ko: "최댓값 라벨", en: "idxmax / idxmin",
        def: "최댓값(최솟값)이 위치한 인덱스 라벨을 돌려주는 메서드. 동률이면 첫 번째 라벨을 택하며, 값 자체는 max/min, 위치는 argmax가 준다.",
        nodes: ["a-2-6"], related: ["nlargest"] },
      { id: "groupby-rolling", ko: "그룹별 이동 윈도", en: "groupby.rolling",
        def: "그룹별로 나눈 뒤 각 그룹 안에서만 이동 윈도 통계를 계산하는 연산. 결과는 그룹 키를 첫 레벨로 가진 MultiIndex다.",
        nodes: ["a-2-6"], related: ["rolling", "multiindex"] },
      { id: "str-accessor", ko: "str 접근자", en: ".str accessor",
        def: "문자열 Series에 contains, extract, replace, split 등 문자열 메서드를 벡터 단위로 적용하는 접근자. 정규식을 지원한다.",
        nodes: ["a-2-6"], related: ["regex", "dt-accessor"] },
      { id: "regex", ko: "정규식", en: "regular expression / regex",
        def: "문자열 패턴을 기술하는 표기법. ^(시작), \\d(숫자), +(1회 이상), ( )(캡처 그룹) 등으로 검색·추출·치환 조건을 표현한다.",
        nodes: ["a-2-6"], related: ["str-accessor"] },
      { id: "grouper", ko: "그룹 지정자", en: "pd.Grouper",
        def: "groupby에 넘겨 시간 빈도(freq)나 레벨 등 그룹 기준을 세밀하게 지정하는 객체. 다른 키와 함께 시간 단위 그룹을 만들 수 있다.",
        nodes: ["a-2-6"], related: ["resample"] }
    ]
  });
})();
