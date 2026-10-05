/* ds-level2 — 파트 B 4장 "신뢰구간과 선형회귀분석" 콘텐츠 (b-4 토픽 + b-4-2 이해도 점검).
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그·링크한 용어는 전부 이 파일에서 정의.
   kind=output 문제와 실습 정답은 scipy 1.17.1 / statsmodels 0.15.0 / sklearn 1.9.1 / numpy 2.4.6 에서 실행해 확인했다. */
(function () {
  DS2.register({
    chapter: "b-4",

    cards: {
      "b-4": {
        node: "b-4",
        title: "신뢰구간과 선형회귀분석",
        summary: [
          "이 장의 핵심은 두 가지 공식 패턴이다. [[confidence-interval|신뢰구간]]은 **점추정값 ± 임계값 × 표준오차** 하나로 끝나고, 선형회귀는 **잔차제곱합을 최소화**하는 직선을 찾은 뒤 `summary()` 표를 읽는 일이다.",
          "모분산을 모르면 z 대신 자유도 n-1의 [[t-distribution|t 분포]]를 쓴다는 것, `scipy.stats.t.interval`과 손계산이 같은 값을 내는 것을 직접 확인해 두면 출력 문제는 전부 풀린다.",
          "회귀에서는 계수의 `P>|t|`·`[0.025 0.975]`로 개별 유의성을, `F-statistic`·`Prob (F-statistic)`으로 모형 전체의 유의성을, `R-squared`·`Adj. R-squared`로 설명력을 읽는다.",
          "가정 4가지(선형성·독립성·등분산성·정규성)와 각 진단 도구(잔차도·Durbin-Watson·Breusch-Pagan·Q-Q plot)를 짝지어 암기하는 것이 시험의 마지막 관문이다."
        ],
        concepts: [
          "**모평균 신뢰구간(confidence interval for the mean)**: 모분산을 알면 `x̄ ± z(α/2) · σ/√n`, 모르면 `x̄ ± t(α/2, n-1) · s/√n`. 표본표준편차 `s`는 `ddof=1`로 구하고 [[standard-error|표준오차]]는 `s/√n`이다.",
          "**신뢰수준(confidence level)과 폭**: 신뢰수준을 올리면(90%→99%) 임계값이 커져 구간이 **넓어지고**, 표본 크기 n을 키우면 `1/√n`으로 구간이 **좁아진다**. n을 4배로 하면 폭은 절반이 된다.",
          "**신뢰구간 해석**: '같은 방법으로 반복 추출하면 구간의 95%가 모수를 포함한다'가 맞는 해석이다. '이 구간 안에 모수가 있을 확률이 95%'는 시험에서 반복 출제되는 **틀린** 문장이다.",
          "**모비율 신뢰구간(CI for a proportion)**: `p̂ ± z(α/2) · √(p̂(1-p̂)/n)`. 표준오차에 표본비율 p̂를 그대로 넣는 점이 핵심이다.",
          "**최소제곱법(OLS)**: 잔차 `e = y - ŷ`의 제곱합 SSE를 최소화하는 기울기 `β1 = Sxy / Sxx`, 절편 `β0 = ȳ - β1·x̄`. 직선은 반드시 `(x̄, ȳ)`를 지난다.",
          "**결정계수(R²)**: `R² = SSR/SST = 1 - SSE/SST`. 총변동 중 모형이 설명하는 비율이며 변수를 추가하면 **감소하지 않는다**. 그래서 변수 수에 벌점을 주는 [[adjusted-r-squared|조정 결정계수]]로 모형을 비교한다.",
          "**계수 유의성 t 검정과 모형 F 검정**: `t = coef / std err`, `P>|t| < 0.05`면 그 계수가 유의하다. F 검정은 '모든 기울기 = 0'을 한 번에 검정하므로 F가 유의해도 **개별 계수가 모두 유의하다는 뜻은 아니다**.",
          "**가정과 진단**: 선형성(잔차도의 패턴), 독립성([[durbin-watson|Durbin-Watson]] ≈ 2), 등분산성([[breusch-pagan|Breusch-Pagan]] 검정, 잔차도의 깔때기 모양), 정규성(Q-Q plot, Shapiro-Wilk). 다중회귀에서는 [[vif|VIF]] ≥ 10이면 다중공선성을 의심한다."
        ],
        terms: ["confidence-interval", "standard-error", "t-distribution", "degrees-of-freedom", "ols", "least-squares", "residual", "r-squared", "adjusted-r-squared", "f-statistic", "p-value", "vif"],
        patterns: [
          {
            title: "모평균 95% 신뢰구간 — 손계산과 scipy 비교",
            lang: "python",
            code: [
              "import numpy as np",
              "from scipy import stats",
              "x = np.array([12, 15, 11, 14, 13, 16, 12, 15])",
              "n, m, se = len(x), x.mean(), x.std(ddof=1) / np.sqrt(len(x))",
              "t = stats.t.ppf(0.975, df=n - 1)          # 양측 5% → 상위 2.5% 분위수",
              "print(m - t * se, m + t * se)             # 손계산",
              "print(stats.t.interval(0.95, df=n - 1, loc=m, scale=se))   # 같은 값"
            ],
            note: "모분산을 아는 경우에만 `stats.norm.interval(0.95, loc=m, scale=sigma/np.sqrt(n))`을 쓴다. `scale`에는 표준편차가 아니라 **표준오차**를 넣는다."
          },
          {
            title: "모비율 신뢰구간",
            lang: "python",
            code: [
              "p_hat, n = 0.4, 100",
              "z = stats.norm.ppf(0.975)                 # 1.96",
              "se = np.sqrt(p_hat * (1 - p_hat) / n)",
              "print(p_hat - z * se, p_hat + z * se)     # (0.304, 0.496)"
            ]
          },
          {
            title: "statsmodels OLS 적합과 summary 읽기",
            lang: "python",
            code: [
              "import statsmodels.api as sm",
              "X = sm.add_constant(df[['x1', 'x2']])     # 절편 컬럼 const 추가 (필수)",
              "model = sm.OLS(df['y'], X).fit()",
              "print(model.summary())",
              "model.params        # coef",
              "model.pvalues       # P>|t|",
              "model.conf_int()    # [0.025  0.975]",
              "model.rsquared, model.rsquared_adj, model.fvalue, model.f_pvalue"
            ],
            note: "`add_constant`를 빼면 절편 없는 회귀가 되어 계수가 1개 모자란다. formula API(`smf.ols('y ~ x1 + x2', data=df)`)는 절편을 자동으로 넣는다."
          },
          {
            title: "sklearn LinearRegression",
            lang: "python",
            code: [
              "from sklearn.linear_model import LinearRegression",
              "lr = LinearRegression().fit(df[['x']], df['y'])   # X는 2차원",
              "lr.coef_, lr.intercept_                           # 기울기 배열, 절편",
              "lr.score(df[['x']], df['y'])                       # R²",
              "lr.predict([[6]])"
            ],
            note: "sklearn은 p-value·신뢰구간을 주지 않는다. 유의성이 필요하면 statsmodels를 쓴다."
          },
          {
            title: "회귀 진단 — Durbin-Watson, Breusch-Pagan, VIF",
            lang: "python",
            code: [
              "from statsmodels.stats.stattools import durbin_watson",
              "from statsmodels.stats.diagnostic import het_breuschpagan",
              "from statsmodels.stats.outliers_influence import variance_inflation_factor",
              "durbin_watson(model.resid)                        # 2에 가까우면 자기상관 없음",
              "het_breuschpagan(model.resid, model.model.exog)   # (LM, LM p, F, F p) — p < 0.05면 이분산",
              "[variance_inflation_factor(X.values, i) for i in range(X.shape[1])]   # 10 이상이면 공선성"
            ]
          },
          {
            title: "손으로 기울기·절편·R² 구하기",
            lang: "python",
            code: [
              "x = np.array([1, 2, 3, 4, 5]); y = np.array([2, 4, 5, 4, 5])",
              "Sxy = ((x - x.mean()) * (y - y.mean())).sum()   # 6.0",
              "Sxx = ((x - x.mean()) ** 2).sum()                # 10.0",
              "b1 = Sxy / Sxx                                   # 0.6",
              "b0 = y.mean() - b1 * x.mean()                    # 2.2",
              "sse = ((y - (b0 + b1 * x)) ** 2).sum(); sst = ((y - y.mean()) ** 2).sum()",
              "r2 = 1 - sse / sst                               # 0.6"
            ],
            note: "`stats.linregress(x, y)`의 `slope`, `intercept`, `rvalue**2`와 일치한다."
          }
        ],
        pitfalls: [
          "`stats.t.interval`·`stats.norm.interval`의 `scale`은 **표준오차(s/√n)**다. 표준편차 s를 그대로 넣으면 구간이 √n배 넓어진다.",
          "`stats.t.ppf(0.95, df)`는 단측 임계값이다. 95% 양측 신뢰구간의 임계값은 `ppf(0.975, df)`다.",
          "`sm.OLS(y, X)`는 절편을 자동으로 넣지 않는다. `sm.add_constant(X)`를 잊으면 summary에 `const` 행이 없다.",
          "R²가 높다고 모형이 옳은 것은 아니고, F 검정이 유의하다고 모든 계수가 유의한 것도 아니다. 두 문장이 OX로 자주 나온다.",
          "예측구간(prediction interval)은 개별 관측값의 오차까지 포함하므로 같은 x에서 평균 반응의 신뢰구간보다 **항상 넓다**."
        ]
      }
    },

    questions: [
      /* ───────────── b-4 토픽 12문제 ───────────── */
      {
        id: "b-4-q01", node: "b-4", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "모평균 μ의 95% 신뢰구간(confidence interval)이 (48.3, 53.0)으로 계산되었다. 다음 중 **옳은** 해석은?",
        choices: [
          "μ가 48.3과 53.0 사이에 있을 확률이 95%다.",
          "표본의 95%가 48.3과 53.0 사이에 있다.",
          "같은 방법으로 표본을 반복 추출해 구간을 만들면 그 구간들의 약 95%가 μ를 포함한다.",
          "다음에 뽑는 관측값 하나가 48.3과 53.0 사이에 들어올 확률이 95%다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** 신뢰수준(confidence level) 95%는 **구간을 만드는 절차**의 장기적 성공 비율이다. 모수 μ는 고정된 상수이고 구간이 표본마다 달라지므로, 반복 추출 시 구간의 95%가 μ를 포함한다는 뜻이다. [[confidence-interval|신뢰구간]]의 교과서 정의다.",
          "",
          "- ① 특정 구간이 계산된 뒤에는 μ가 그 안에 있거나 없거나 둘 중 하나다. 확률 95%를 붙이는 것은 빈도주의 해석에서 틀린 문장이다.",
          "- ② 신뢰구간은 모평균의 범위이지 표본 자료의 범위가 아니다. 자료의 95%는 평균 ± 약 2 표준편차 쪽 이야기다.",
          "- ④ 개별 관측값의 범위는 예측구간(prediction interval)이 다루며 신뢰구간보다 훨씬 넓다.",
          "",
          "시험에서는 ①이 '그럴듯한 오답'으로 매번 등장한다. '모수가 구간에 있을 확률'이라는 표현을 보면 일단 틀렸다고 보라."
        ],
        terms: ["confidence-interval", "confidence-level", "prediction-interval"]
      },
      {
        id: "b-4-q02", node: "b-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (소수 셋째 자리까지 반올림한 값으로 보기를 제시함)",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "x = np.array([12, 15, 11, 14, 13, 16, 12, 15])",
          "m = x.mean()",
          "se = x.std(ddof=1) / np.sqrt(len(x))",
          "lo, hi = stats.t.interval(0.95, df=len(x) - 1, loc=m, scale=se)",
          "print(round(lo, 3), round(hi, 3))"
        ],
        lang: "python",
        choices: ["12.018 14.982", "12.272 14.728", "13.5 13.5", "10.017 16.983"],
        answer: 0,
        explanation: [
          "**정답: ①** 표본평균 13.5, 표본표준편차(ddof=1) 1.7728, [[standard-error|표준오차]] `1.7728/√8 = 0.6268`. 자유도 7의 [[t-distribution|t 분포]] 임계값 `t(0.975, 7) = 2.3646`이므로 `13.5 ± 2.3646 × 0.6268 = (12.018, 14.982)`.",
          "",
          "- ② 임계값에 t 대신 z=1.96을 넣으면 `13.5 ± 1.228 = (12.272, 14.728)`로 더 좁은 구간이 나온다. n이 작을 때 모분산을 모르면 t를 써야 한다.",
          "- ③ 구간 폭이 0인 경우는 표준오차가 0일 때만 가능하다.",
          "- ④ `scale`에 표준오차 대신 표준편차 1.7728을 넣으면 `13.5 ± 3.483`처럼 √n배 넓은 구간이 나온다.",
          "",
          "시험에서는 `scale=`에 무엇을 넣는가(s/√n), 그리고 t와 z 중 어느 임계값인가를 묻는 형태로 나온다."
        ],
        terms: ["confidence-interval", "standard-error", "t-distribution"]
      },
      {
        id: "b-4-q03", node: "b-4", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "모평균 신뢰구간의 **폭**에 대한 설명으로 옳은 것은? (다른 조건은 동일하다고 가정)",
        choices: [
          "신뢰수준을 95%에서 99%로 올리면 구간이 좁아진다.",
          "표본 크기 n을 4배로 늘리면 구간 폭은 약 절반이 된다.",
          "표본표준편차 s가 커지면 구간이 좁아진다.",
          "표본 크기 n을 2배로 늘리면 구간 폭도 절반이 된다."
        ],
        answer: 1,
        explanation: [
          "**정답: ②** 구간 폭은 `2 × 임계값 × s/√n`에 비례한다. 분모가 `√n`이므로 n을 4배로 하면 `√4 = 2`배만큼 좁아져 폭이 절반이 된다. [[standard-error|표준오차]]가 `1/√n`으로 줄어드는 성질이다.",
          "",
          "- ① 신뢰수준(confidence level)을 올리면 임계값이 커진다(z: 1.96 → 2.576). 구간은 **넓어진다**.",
          "- ③ s는 분자에 있으므로 s가 커지면 구간이 **넓어진다**.",
          "- ④ n을 2배로 하면 폭은 `1/√2 ≈ 0.707`배가 된다. 절반이 아니다.",
          "",
          "시험에서는 'n을 4배 → 폭 1/2', '신뢰수준↑ → 폭↑' 두 가지가 숫자를 바꿔 반복 출제된다."
        ],
        terms: ["confidence-interval", "standard-error", "confidence-level"]
      },
      {
        id: "b-4-q04", node: "b-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (`slope`, `intercept` 순서, 소수 첫째 자리까지 반올림)",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "x = np.array([1, 2, 3, 4, 5])",
          "y = np.array([2, 4, 5, 4, 5])",
          "res = stats.linregress(x, y)",
          "print(round(res.slope, 1), round(res.intercept, 1))"
        ],
        lang: "python",
        choices: ["1.0 2.0", "0.8 1.6", "0.6 4.0", "0.6 2.2"],
        answer: 3,
        explanation: [
          "**정답: ④** [[least-squares|최소제곱법]]의 기울기 `β1 = Sxy / Sxx`. `x̄ = 3`, `ȳ = 4`, 편차곱의 합 `Sxy = (-2)(-2) + (-1)(0) + 0 + (1)(0) + (2)(1) = 6`, `Sxx = 4+1+0+1+4 = 10`이므로 `β1 = 0.6`. 절편 `β0 = ȳ - β1·x̄ = 4 - 1.8 = 2.2`.",
          "",
          "- ① 기울기 1.0은 y가 x와 같은 폭으로 늘 때다. 여기서는 y 증가분이 x보다 작다.",
          "- ② 0.8은 Sxy를 Sxx가 아닌 다른 값으로 나눈 계산 착오다.",
          "- ③ 기울기는 맞지만 절편 4.0은 `ȳ`를 그대로 쓴 것이다. `ȳ - β1·x̄`를 빼야 한다.",
          "",
          "시험에서는 5개 정도의 작은 데이터로 `Sxy/Sxx`를 손으로 구하게 하거나, `linregress` 결과의 `slope`·`intercept`·`rvalue`를 읽게 한다. 회귀직선은 항상 `(x̄, ȳ)`를 지난다는 사실로 검산하라."
        ],
        terms: ["least-squares", "ols", "regression-coefficient", "intercept"]
      },
      {
        id: "b-4-q05", node: "b-4", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "어느 회귀모형에서 총제곱합 SST = 120, 잔차제곱합 SSE = 30이다. 결정계수(R-squared)는?",
        choices: ["0.25", "0.75", "0.80", "4.0"],
        answer: 1,
        explanation: [
          "**정답: ②** [[r-squared|결정계수]] `R² = 1 - SSE/SST = 1 - 30/120 = 0.75`. 회귀제곱합 `SSR = SST - SSE = 90`이므로 `SSR/SST = 90/120 = 0.75`로도 같다. 총변동의 75%를 모형이 설명한다는 뜻이다.",
          "",
          "- ① 0.25는 `SSE/SST`, 즉 **설명하지 못한** 비율이다. 1에서 빼야 한다.",
          "- ③ 0.80은 분모를 잘못 잡은 값이다. `SST = SSR + SSE`를 기억하라.",
          "- ④ `SST/SSE = 4`는 비율이 뒤집힌 값이며 R²는 0~1 범위를 벗어날 수 없다.",
          "",
          "시험에서는 SST·SSE·SSR 중 두 개를 주고 R²를 구하게 하거나, [[sum-of-squares|제곱합 분해]] `SST = SSR + SSE`를 묻는다. SSR(regression)과 SSE(error)의 약자를 헷갈리지 마라."
        ],
        terms: ["r-squared", "sum-of-squares", "residual"]
      },
      {
        id: "b-4-q06", node: "b-4", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드를 실행했더니 `summary()` 결과에 계수가 `x` 하나만 나오고 절편 행이 없다. 원인은?",
        code: [
          "import statsmodels.api as sm",
          "model = sm.OLS(df['y'], df[['x']]).fit()",
          "print(model.summary())"
        ],
        lang: "python",
        choices: [
          "`sm.OLS`의 인수 순서가 `(X, y)`여야 한다.",
          "`fit()` 대신 `fit_regularized()`를 호출해야 한다.",
          "`sm.add_constant(df[['x']])`로 상수 컬럼을 추가하지 않아 절편 없는 회귀가 되었다.",
          "`df[['x']]` 대신 `df['x']`로 1차원 Series를 넘겨야 한다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** statsmodels의 배열 API `sm.OLS(endog, exog)`는 [[intercept|절편]]을 자동으로 넣지 않는다. `exog = sm.add_constant(df[['x']])`로 값이 1인 `const` 컬럼을 추가해야 `const` 행이 summary에 나타난다. 빠뜨리면 원점을 지나는 회귀가 되어 R²도 왜곡된다.",
          "",
          "- ① `sm.OLS(endog=y, exog=X)` 순서가 맞다. sklearn의 `fit(X, y)`와 반대라는 점은 함정이지만 이 코드의 문제는 아니다.",
          "- ② `fit_regularized`는 라쏘·릿지 벌점 회귀용이다. 절편과 무관하다.",
          "- ④ `df[['x']]`(DataFrame)든 `df['x']`(Series)든 OLS는 받는다. 절편 유무와 무관하다.",
          "",
          "시험에서는 `add_constant`의 역할(절편 추가), formula API `smf.ols('y ~ x', data=df)`는 절편을 자동으로 넣는다는 점이 짝으로 나온다. [[ols|OLS]] 적합 시 상수항 확인은 반드시 하라."
        ],
        terms: ["ols", "intercept"]
      },
      {
        id: "b-4-q07", node: "b-4", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "선형회귀의 가정(assumption)과 진단 도구의 연결이 **틀린** 것은?",
        choices: [
          "독립성(independence) — Breusch-Pagan 검정",
          "등분산성(homoscedasticity) — 적합값 대 잔차 산점도의 깔때기 모양 확인",
          "정규성(normality) — 잔차의 Q-Q plot, Shapiro-Wilk 검정",
          "독립성(independence) — Durbin-Watson 통계량이 2에 가까운지 확인"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[breusch-pagan|Breusch-Pagan]] 검정은 잔차의 분산이 설명변수에 따라 달라지는지, 즉 **등분산성(homoscedasticity)** 위반(이분산)을 검정한다. 독립성 진단 도구가 아니다. 귀무가설은 '등분산'이므로 p < 0.05면 이분산을 의심한다.",
          "",
          "- ② 잔차도(residual plot)에서 적합값이 커질수록 잔차 폭이 벌어지는 깔때기 모양은 이분산의 전형적 신호다. 옳은 연결.",
          "- ③ 잔차의 정규성은 Q-Q plot이 직선에 가까운지, Shapiro-Wilk·Jarque-Bera 검정의 p값으로 본다. 옳은 연결.",
          "- ④ [[durbin-watson|Durbin-Watson]]은 잔차의 1차 자기상관을 본다. 0~4 범위이고 2 근처면 자기상관이 없다. 옳은 연결.",
          "",
          "시험에서는 가정 4가지(선형성·독립성·등분산성·정규성)에 진단 도구를 섞어 놓고 틀린 짝을 찾게 한다. [[regression-assumptions|회귀 가정]]과 도구를 표처럼 외우라."
        ],
        terms: ["regression-assumptions", "breusch-pagan", "durbin-watson", "homoscedasticity"]
      },
      {
        id: "b-4-q08", node: "b-4", type: "ox", kind: "concept", difficulty: 1,
        prompt: "모분산 σ²를 모르고 표본 크기가 작을 때 모평균의 신뢰구간을 구하려면, 표준정규분포(z) 대신 자유도 n-1의 t 분포 임계값을 사용한다.",
        answer: true,
        explanation: [
          "**정답: O** 모분산을 모르면 σ 대신 표본표준편차 s를 쓰는데, s 자체가 표본마다 흔들리므로 그 불확실성을 반영해 꼬리가 두꺼운 [[t-distribution|t 분포]]를 쓴다. [[degrees-of-freedom|자유도]]는 평균 하나를 추정하는 데 쓰였으므로 n-1이다.",
          "n이 커지면 t 분포가 표준정규분포에 수렴하므로(n ≥ 30 정도) z를 써도 차이가 거의 없다. 하지만 scipy에서는 n이 커도 `stats.t.interval`을 그대로 쓰는 것이 정확하다.",
          "",
          "시험에서는 'σ를 알면 z, 모르면 t(df = n-1)'이 그대로 OX나 빈칸으로 나온다."
        ],
        terms: ["t-distribution", "degrees-of-freedom", "confidence-interval"]
      },
      {
        id: "b-4-q09", node: "b-4", type: "ox", kind: "concept", difficulty: 2,
        prompt: "같은 x 값에서 새로운 개별 관측값 y에 대한 95% 예측구간(prediction interval)은 그 x에서의 평균 반응 E[y]에 대한 95% 신뢰구간보다 항상 넓다.",
        answer: true,
        explanation: [
          "**정답: O** 평균 반응의 [[confidence-interval|신뢰구간]]은 회귀직선 자체의 추정 오차만 반영하지만, [[prediction-interval|예측구간]]은 거기에 개별 관측값의 오차 분산 σ²까지 더한다. 분산이 더 크니 구간이 항상 넓다.",
          "statsmodels에서는 `model.get_prediction(X_new).summary_frame()`이 `mean_ci_lower/upper`(신뢰구간)와 `obs_ci_lower/upper`(예측구간)를 함께 보여 준다.",
          "",
          "시험에서는 '예측구간은 신뢰구간보다 넓다/좁다'로 나오고, 두 구간이 모두 `x̄`에서 가장 좁고 x̄에서 멀어질수록 넓어진다는 성질도 함께 묻는다."
        ],
        terms: ["prediction-interval", "confidence-interval"]
      },
      {
        id: "b-4-q10", node: "b-4", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 scipy 메서드 이름을 쓰시오. 자유도 n-1인 t 분포에서 95% 양측 신뢰구간의 임계값을 구한다: `stats.t.____(0.975, df=n-1)`",
        answer: "ppf",
        accept: ["ppf()", "t.ppf", "stats.t.ppf"],
        explanation: [
          "**정답: ppf** [[ppf|분위수 함수(percent point function)]]는 누적확률을 받아 그에 해당하는 값을 돌려주는 CDF의 역함수다. 양측 5%를 좌우로 2.5%씩 나누므로 상위 2.5% 경계인 `ppf(0.975)`를 쓴다.",
          "`cdf`는 반대로 값을 받아 누적확률을 주고, `interval(0.95, df)`는 하한·상한을 한 번에 돌려준다. `stats.norm.ppf(0.975)`는 1.96이다.",
          "",
          "시험에서는 `ppf(0.95)`(단측)와 `ppf(0.975)`(양측 95%)를 혼동하게 만드는 보기가 나온다."
        ],
        terms: ["ppf", "t-distribution"]
      },
      {
        id: "b-4-q11", node: "b-4", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "from scipy import stats",
          "print(round(stats.norm.ppf(0.975), 2))"
        ],
        lang: "python",
        answer: "1.96",
        accept: ["1.960"],
        explanation: [
          "**정답: 1.96** 표준정규분포에서 누적확률 0.975에 해당하는 값, 즉 95% 양측 신뢰구간의 z 임계값이다. [[ppf|ppf]]는 CDF의 역함수이므로 `norm.cdf(1.96) ≈ 0.975`가 성립한다.",
          "함께 외울 값: `norm.ppf(0.95) = 1.645`(90% 양측 또는 95% 단측), `norm.ppf(0.995) = 2.576`(99% 양측).",
          "",
          "시험에서는 1.645 / 1.96 / 2.576 세 값을 신뢰수준과 짝지어 묻고, 모비율 [[confidence-interval|신뢰구간]] 계산에 1.96을 대입하게 한다."
        ],
        terms: ["ppf", "confidence-interval"]
      },
      {
        id: "b-4-q12", node: "b-4", type: "short", kind: "concept", difficulty: 3,
        prompt: "다중회귀에서 설명변수 x1을 나머지 설명변수들로 회귀했을 때 결정계수가 0.9였다. x1의 분산팽창계수(VIF)를 숫자로 쓰시오.",
        answer: "10",
        accept: ["10.0"],
        explanation: [
          "**정답: 10** [[vif|분산팽창계수(VIF)]]는 `1 / (1 - R²_j)`로 정의된다. `1 / (1 - 0.9) = 10`. 관례적으로 VIF ≥ 10(보수적으로는 5)이면 [[multicollinearity|다중공선성]]이 심하다고 판단하고 변수를 제거하거나 결합한다.",
          "statsmodels에서는 `variance_inflation_factor(X.values, i)`로 i번째 컬럼의 VIF를 구한다. 이때 X에 `const` 컬럼이 들어 있어야 다른 변수들의 VIF가 올바르게 계산된다.",
          "",
          "시험에서는 R²_j를 주고 VIF를 계산하게 하거나, 'VIF가 10이면 R²_j는 0.9'처럼 거꾸로 묻는다."
        ],
        terms: ["vif", "multicollinearity"]
      },

      /* ───────────── b-4-2 이해도 점검 20문제 ───────────── */
      {
        id: "b-4-2-q01", node: "b-4-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "모표준편차 σ = 10을 아는 모집단에서 n = 25개를 뽑아 표본평균 50을 얻었다. 다음 코드의 출력은? (소수 둘째 자리까지 반올림)",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "lo, hi = stats.norm.interval(0.95, loc=50, scale=10 / np.sqrt(25))",
          "print(round(lo, 2), round(hi, 2))"
        ],
        lang: "python",
        choices: ["30.4 69.6", "46.08 53.92", "48.0 52.0", "46.71 53.29"],
        answer: 1,
        explanation: [
          "**정답: ②** 모분산을 아는 경우라 z를 쓴다. [[standard-error|표준오차]] `σ/√n = 10/5 = 2`, `50 ± 1.96 × 2 = (46.08, 53.92)`. `norm.interval(0.95, loc, scale)`은 `loc ± 1.96 × scale`을 돌려준다.",
          "",
          "- ① `scale`에 σ = 10을 그대로 넣었을 때의 결과(`50 ± 19.6`)다. 반드시 표준오차를 넣는다.",
          "- ③ 임계값을 1.0으로 잡은 값이다. 95%는 1.96이다.",
          "- ④ 자유도 24의 t 임계값 2.064를 쓴 값이다. σ를 알고 있으므로 t가 아니라 z를 쓴다.",
          "",
          "시험에서는 'σ를 안다'는 조건이 z를 쓰라는 신호다. [[confidence-interval|신뢰구간]] 문제에서 이 조건부터 확인하라."
        ],
        terms: ["confidence-interval", "standard-error"]
      },
      {
        id: "b-4-2-q02", node: "b-4-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "모분산을 모르는 정규모집단에서 n = 15인 표본으로 모평균의 95% 신뢰구간을 구할 때 사용하는 분포와 자유도는?",
        choices: [
          "표준정규분포, 자유도 없음",
          "t 분포, 자유도 15",
          "카이제곱분포, 자유도 14",
          "t 분포, 자유도 14"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** 모분산을 모르고 표본표준편차 s로 대체하면 [[t-distribution|t 분포]]를 쓰며 [[degrees-of-freedom|자유도]]는 `n - 1 = 14`다. 평균을 추정하느라 자유도 하나를 소모했다고 이해하면 된다.",
          "",
          "- ① 표준정규분포(z)는 모분산 σ²를 **알 때** 쓴다.",
          "- ② 자유도는 표본 크기 n이 아니라 n - 1이다. 가장 흔한 함정.",
          "- ③ 카이제곱분포는 **모분산**의 신뢰구간이나 적합도·독립성 검정에 쓴다. 모평균과는 무관하다.",
          "",
          "시험에서는 scipy 코드 `stats.t.ppf(0.975, df=14)`의 `df` 값을 n으로 쓴 오답이 보기로 나온다."
        ],
        terms: ["t-distribution", "degrees-of-freedom"]
      },
      {
        id: "b-4-2-q03", node: "b-4-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (소수 첫째 자리까지 반올림)",
        code: [
          "import numpy as np",
          "from sklearn.linear_model import LinearRegression",
          "X = np.array([1, 2, 3, 4, 5]).reshape(-1, 1)",
          "y = np.array([2, 4, 5, 4, 5])",
          "lr = LinearRegression().fit(X, y)",
          "print(round(lr.predict([[6]])[0], 1))"
        ],
        lang: "python",
        choices: ["5.8", "6.0", "3.6", "5.0"],
        answer: 0,
        explanation: [
          "**정답: ①** 이 데이터의 [[ols|OLS]] 적합은 `coef_ = [0.6]`, `intercept_ = 2.2`다. `x = 6`을 넣으면 `2.2 + 0.6 × 6 = 5.8`. `predict`는 2차원 입력을 받아 배열을 돌려주므로 `[0]`으로 첫 원소를 꺼냈다.",
          "",
          "- ② 6.0은 x를 그대로 돌려준 값으로, 기울기 1·절편 0일 때만 가능하다.",
          "- ③ 3.6은 기울기만 곱하고 [[intercept|절편]] 2.2를 더하지 않은 값이다.",
          "- ④ 5.0은 마지막 관측값 y를 그대로 쓴 것으로, 회귀 예측과 무관하다.",
          "",
          "시험에서는 `coef_`(배열)와 `intercept_`(스칼라)를 읽어 `predict` 값을 손으로 구하게 한다. `coef_[0]`처럼 인덱스를 붙여야 숫자가 된다는 점도 자주 나온다."
        ],
        terms: ["ols", "intercept", "regression-coefficient"]
      },
      {
        id: "b-4-2-q04", node: "b-4-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "다음은 `statsmodels` OLS `summary()`의 계수 표 일부다. 유의수준 5%에서 옳은 해석은?",
        code: [
          "             coef    std err        t    P>|t|    [0.025    0.975]",
          "const      2.2000      0.938    2.345    0.101    -0.785     5.185",
          "x1         0.6000      0.283    2.121    0.124    -0.300     1.500"
        ],
        lang: "text",
        choices: [
          "x1의 p값이 0.124이므로 x1은 y에 유의한 영향을 준다.",
          "x1이 한 단위 증가하면 y는 평균 0.283 증가한다.",
          "x1의 95% 신뢰구간 (-0.300, 1.500)이 0을 포함하므로 x1의 계수는 유의하지 않다.",
          "t 값 2.121은 `std err / coef`로 계산된 값이다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** 계수의 [[confidence-interval|신뢰구간]] `[0.025 0.975]`가 0을 포함하면 'β1 = 0'을 기각할 수 없다는 뜻이고, 이는 `P>|t| = 0.124 > 0.05`와 정확히 같은 결론이다. 신뢰구간과 [[p-value|p값]]은 항상 일관된다.",
          "",
          "- ① p값 0.124는 0.05보다 크므로 **유의하지 않다**. 결론이 반대다.",
          "- ② x1 한 단위 증가 시 y의 평균 변화는 `coef = 0.6`이다. 0.283은 표준오차(std err)다.",
          "- ④ `t = coef / std err = 0.6 / 0.283 = 2.121`이다. 분수가 뒤집혔다.",
          "",
          "시험에서는 summary 표를 주고 `coef`·`std err`·`t`·`P>|t|`·`[0.025 0.975]` 다섯 열의 관계를 묻는다. `t = coef/std err`, `CI = coef ± t임계값 × std err`, 'CI가 0 포함 ⇔ p > 0.05'를 세트로 외우라."
        ],
        terms: ["p-value", "confidence-interval", "regression-coefficient", "t-test"]
      },
      {
        id: "b-4-2-q05", node: "b-4-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (n = 표본 수, k = 설명변수 수)",
        code: [
          "n, k, r2 = 30, 3, 0.80",
          "adj_r2 = 1 - (1 - r2) * (n - 1) / (n - k - 1)",
          "print(round(adj_r2, 3))"
        ],
        lang: "python",
        choices: ["0.800", "0.777", "0.823", "0.793"],
        answer: 1,
        explanation: [
          "**정답: ②** [[adjusted-r-squared|조정 결정계수]] `Adj R² = 1 - (1 - R²)(n - 1)/(n - k - 1) = 1 - 0.2 × 29/26 = 1 - 0.2231 = 0.777`. 설명변수 수 k가 늘수록 분모 `n - k - 1`이 작아져 벌점이 커진다.",
          "",
          "- ① 0.800은 보정 전 [[r-squared|R²]] 자체다. 조정 결정계수는 항상 R² 이하다.",
          "- ③ 0.823은 R²보다 크다. 조정 결정계수가 R²를 넘을 수는 없다.",
          "- ④ 0.793은 분모를 `n - k`로 잘못 쓴 값(`0.2 × 29/27`)이다. 절편까지 세어 `n - k - 1`이다.",
          "",
          "시험에서는 n, k, R²를 주고 조정 R²를 계산하게 하거나, '변수를 추가하면 R²는 감소하지 않지만 Adj R²는 감소할 수 있다'를 OX로 묻는다."
        ],
        terms: ["adjusted-r-squared", "r-squared"]
      },
      {
        id: "b-4-2-q06", node: "b-4-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "지역 변수(A/B/C)를 더미변수(dummy variable)로 바꾸어 `y ~ x + region_B + region_C`를 적합했다(기준범주 A). `region_B`의 계수가 3.2일 때 옳은 해석은?",
        choices: [
          "B 지역은 C 지역보다 y가 평균 3.2 높다.",
          "region_B가 한 단위 증가할 때마다 y가 3.2 증가한다.",
          "B 지역 y의 전체 평균이 3.2다.",
          "x가 같을 때 B 지역은 기준범주 A 지역보다 y가 평균 3.2 높다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[dummy-variable|더미변수]]의 계수는 항상 **기준범주(reference category)와의 차이**다. 다른 설명변수 x를 고정했을 때 B 지역의 평균 y가 A 지역보다 3.2 높다는 뜻이다.",
          "",
          "- ① B와 C의 비교는 `region_B - region_C` 계수 차이로 봐야 한다. 각 계수는 A 대비다.",
          "- ② 더미변수는 0 또는 1만 가지므로 '한 단위 증가'라는 연속형 해석은 어색하다. 0→1, 즉 A→B로 바뀌는 효과다.",
          "- ③ B 지역의 평균은 `절편 + 3.2 + β_x × x`다. 3.2 자체가 평균은 아니다.",
          "",
          "시험에서는 범주 k개 → 더미 k-1개(`drop_first=True`), 기준범주는 계수 표에 **나타나지 않는** 범주라는 점, 그리고 계수 해석을 묻는다. k개를 모두 넣으면 완전 공선성(dummy variable trap)이 생긴다."
        ],
        terms: ["dummy-variable", "multicollinearity", "intercept"]
      },
      {
        id: "b-4-2-q07", node: "b-4-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드는 `ValueError: Expected 2D array, got 1D array instead`로 실패한다. 올바른 수정은?",
        code: [
          "import numpy as np",
          "from sklearn.linear_model import LinearRegression",
          "x = np.array([1, 2, 3, 4, 5])",
          "y = np.array([2, 4, 5, 4, 5])",
          "lr = LinearRegression().fit(x, y)"
        ],
        lang: "python",
        choices: [
          "`x`를 `x.reshape(-1, 1)`로 바꿔 (표본 수, 특성 수) 모양의 2차원 배열로 넘긴다.",
          "`y`를 `y.reshape(-1, 1)`로 바꾼다. 타깃도 2차원이어야 한다.",
          "`fit` 전에 `sm.add_constant(x)`로 절편 컬럼을 추가한다.",
          "`fit(x, y)`를 `fit(y, x)`로 순서를 바꾼다."
        ],
        answer: 0,
        explanation: [
          "**정답: ①** sklearn의 모든 추정기는 특성 행렬 X를 `(n_samples, n_features)` 2차원으로 요구한다. 특성이 하나뿐이면 `x.reshape(-1, 1)` 또는 `df[['x']]`(이중 대괄호)로 열 벡터를 만들어야 한다. 오류 메시지가 이 해법을 직접 알려 준다.",
          "",
          "- ② 타깃 y는 1차원 배열이 정상이다. 2차원으로 바꾸면 경고가 나거나 다중출력 회귀로 취급된다.",
          "- ③ sklearn의 `LinearRegression`은 `fit_intercept=True`가 기본이어서 [[intercept|절편]]을 스스로 추정한다. `add_constant`는 statsmodels용이다.",
          "- ④ 순서는 `fit(X, y)`가 맞다. 바꾸면 의미가 뒤집힌다.",
          "",
          "시험에서는 `df['x']`(1차원 Series)와 `df[['x']]`(2차원 DataFrame)의 차이, 그리고 statsmodels(`add_constant` 필요)와 sklearn(절편 자동)의 차이가 [[ols|OLS]] 코드 오류 문제로 나온다."
        ],
        terms: ["ols", "intercept"]
      },
      {
        id: "b-4-2-q08", node: "b-4-2", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은? (소수 셋째 자리까지 반올림)",
        code: [
          "import numpy as np",
          "import statsmodels.api as sm",
          "x = np.array([1, 2, 3, 4, 5], dtype=float)",
          "y = np.array([2, 4, 5, 4, 5], dtype=float)",
          "model = sm.OLS(y, sm.add_constant(x)).fit()",
          "print(round(model.rsquared_adj, 3))"
        ],
        lang: "python",
        choices: ["0.600", "0.775", "0.467", "0.360"],
        answer: 2,
        explanation: [
          "**정답: ③** 이 데이터의 [[r-squared|R²]]는 0.6(앞 문제의 `SSE = 2.4`, `SST = 6`). n = 5, k = 1이므로 [[adjusted-r-squared|조정 결정계수]] `1 - (1 - 0.6)(5 - 1)/(5 - 1 - 1) = 1 - 0.4 × 4/3 = 1 - 0.533 = 0.467`. 표본이 작아 벌점이 커서 R²와 차이가 크다.",
          "",
          "- ① 0.600은 `model.rsquared`, 보정 전 결정계수다.",
          "- ② 0.775는 상관계수 r(`√0.6`)이다. `rvalue`를 R²로 착각한 값.",
          "- ④ 0.360은 R²를 제곱한 값(`0.6²`)으로 의미가 없다.",
          "",
          "시험에서는 `rsquared`·`rsquared_adj`·`linregress`의 `rvalue` 세 값을 섞어 보기로 낸다. 단순회귀에서 `R² = r²`라는 관계도 함께 기억하라."
        ],
        terms: ["adjusted-r-squared", "r-squared", "correlation-coefficient"]
      },
      {
        id: "b-4-2-q09", node: "b-4-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "표본 n개 중 성공 비율이 p̂일 때 모비율 p의 95% 신뢰구간 공식으로 옳은 것은?",
        choices: [
          "p̂ ± 1.96 × √(p̂(1-p̂)/n)",
          "p̂ ± 1.96 × p̂(1-p̂)/n",
          "p̂ ± 1.96 × √(p̂(1-p̂))",
          "p̂ ± 1.645 × √(p̂(1-p̂)/n)"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 표본비율 p̂의 [[standard-error|표준오차]]는 `√(p̂(1-p̂)/n)`이고, 비율은 n이 크면 정규근사가 되므로 z 임계값 1.96을 곱한다. 모평균 신뢰구간과 구조(`추정값 ± z × SE`)가 같고 SE 식만 다르다.",
          "",
          "- ② 제곱근을 빼먹었다. `p̂(1-p̂)/n`은 분산이고 표준오차는 그 제곱근이다.",
          "- ③ n으로 나누지 않았다. `√(p̂(1-p̂))`는 베르누이 변수 하나의 표준편차지 비율의 표준오차가 아니다.",
          "- ④ 1.645는 90% 양측(또는 95% 단측) 임계값이다. 95% 양측은 1.96.",
          "",
          "시험에서는 공식을 고르게 하거나 p̂ = 0.4, n = 100 같은 값을 넣어 [[confidence-interval|신뢰구간]] (0.304, 0.496)을 계산하게 한다. 정규근사 조건 `np̂ ≥ 5, n(1-p̂) ≥ 5`도 가끔 나온다."
        ],
        terms: ["confidence-interval", "standard-error", "proportion-ci"]
      },
      {
        id: "b-4-2-q10", node: "b-4-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "시계열 자료로 회귀를 적합한 뒤 `summary()`의 `Durbin-Watson` 값이 0.6으로 나왔다. 가장 적절한 판단은?",
        choices: [
          "잔차의 분산이 일정하지 않아 등분산성 가정이 위반되었다.",
          "잔차에 양(+)의 자기상관이 있어 독립성 가정이 의심된다.",
          "설명변수 사이에 다중공선성이 심하다.",
          "2에 가까운 값이므로 자기상관이 없다고 본다."
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[durbin-watson|Durbin-Watson 통계량]]은 0~4 범위이며 `DW ≈ 2(1 - ρ)`로 근사된다. 2 근처면 자기상관 없음, **0에 가까우면 양의 자기상관**, 4에 가까우면 음의 자기상관이다. 0.6은 양의 자기상관이 강하다는 신호로, 잔차가 독립이라는 가정이 깨졌다.",
          "",
          "- ① 등분산성(homoscedasticity)은 [[breusch-pagan|Breusch-Pagan]] 검정이나 잔차도로 본다. DW와는 다른 가정이다.",
          "- ③ 다중공선성은 VIF나 `Cond. No.`로 진단한다. DW는 잔차의 자기상관만 본다.",
          "- ④ 0.6은 2에서 멀다. 보통 1.5~2.5 밖이면 자기상관을 의심한다.",
          "",
          "시험에서는 'DW가 0에 가까우면 양의 자기상관, 4에 가까우면 음의 자기상관'과 각 가정-진단 도구 매칭이 함께 출제된다. [[regression-assumptions|회귀 가정]] 중 독립성은 시계열에서 가장 자주 깨진다."
        ],
        terms: ["durbin-watson", "regression-assumptions", "homoscedasticity"]
      },
      {
        id: "b-4-2-q11", node: "b-4-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "설문 100명 중 40명이 찬성했다. 다음 코드의 출력은? (소수 셋째 자리까지 반올림)",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "p_hat, n = 40 / 100, 100",
          "z = stats.norm.ppf(0.975)",
          "se = np.sqrt(p_hat * (1 - p_hat) / n)",
          "print(round(p_hat - z * se, 3), round(p_hat + z * se, 3))"
        ],
        lang: "python",
        choices: ["0.352 0.448", "0.3 0.5", "0.319 0.481", "0.304 0.496"],
        answer: 3,
        explanation: [
          "**정답: ④** [[proportion-ci|모비율 신뢰구간]]. `se = √(0.4 × 0.6 / 100) = √0.0024 = 0.049`, `z = 1.96`, 오차한계 `1.96 × 0.049 = 0.096`. 따라서 `(0.304, 0.496)`.",
          "",
          "- ① 0.352 0.448은 오차한계가 0.048, 즉 z를 곱하지 않고 표준오차만 더한 값이다.",
          "- ② 0.3 0.5는 오차한계를 0.1로 어림한 값으로 정확한 계산이 아니다.",
          "- ③ 0.319 0.481은 z = 1.645(90% 양측)를 쓴 값이다. `ppf(0.975)`는 1.96.",
          "",
          "시험에서는 `ppf(0.975)` 대신 `ppf(0.95)`를 쓴 코드를 주고 어느 신뢰수준인지 묻거나, 이 계산을 손으로 시킨다. [[standard-error|표준오차]] 식의 제곱근을 빼먹는 실수를 조심하라."
        ],
        terms: ["proportion-ci", "standard-error", "ppf"]
      },
      {
        id: "b-4-2-q12", node: "b-4-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "종속변수에 자연로그를 취한 모형 `ln(y) = β0 + β1·x`를 적합했더니 β1 = 0.05였다. x가 1 증가할 때 y의 변화로 가장 적절한 해석은?",
        choices: [
          "y가 0.05 증가한다.",
          "y가 5 증가한다.",
          "y가 약 5% 증가한다(정확히는 e^0.05 - 1 ≈ 5.13%).",
          "x가 1% 증가할 때 y가 0.05% 증가한다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** 종속변수만 로그를 취한 log-linear 모형(level-log의 반대)에서 β1은 x 한 단위당 `ln(y)`의 변화이므로 y의 **비율 변화**로 해석한다. 정확한 변화율은 `exp(β1) - 1 = exp(0.05) - 1 = 0.0513`, 약 5.13%이고 β1이 작을 때 `β1 × 100%`로 근사한다. [[log-transformation|로그 변환]]의 핵심 해석이다.",
          "",
          "- ① 0.05 증가는 `ln(y)`의 변화량이지 y의 변화량이 아니다.",
          "- ② 5라는 절대량 변화는 로그를 취하지 않은 선형 모형에서의 해석이다.",
          "- ④ 'x 1% 증가 → y β1% 증가'는 양쪽 모두 로그를 취한 log-log 모형(탄력성)의 해석이다.",
          "",
          "시험에서는 log-linear(y만 로그: x 1 단위 → y 100·β1%), log-log(둘 다 로그: x 1% → y β1%), 그리고 [[standardized-coefficient|표준화 계수]](x 1 표준편차 → y β 표준편차) 세 가지 해석을 섞어 출제한다."
        ],
        terms: ["log-transformation", "standardized-coefficient", "regression-coefficient"]
      },
      {
        id: "b-4-2-q13", node: "b-4-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "다중회귀모형에 설명변수를 추가하면, 그 변수가 전혀 쓸모없더라도 결정계수(R-squared)는 감소하지 않는다.",
        answer: true,
        explanation: [
          "**정답: O** [[r-squared|결정계수]]는 `1 - SSE/SST`인데, 변수를 추가하면 최소제곱법이 그 변수를 써서 SSE를 **같거나 더 작게** 만들 수 있으므로(계수를 0으로 두면 최소한 같다) R²는 절대 줄지 않는다. 그래서 R²만으로 변수 수가 다른 모형을 비교하면 복잡한 모형이 항상 이긴다.",
          "이 문제를 보정한 것이 [[adjusted-r-squared|조정 결정계수]]로, 쓸모없는 변수를 넣으면 오히려 감소할 수 있다.",
          "",
          "시험에서는 'R²는 감소하지 않는다(O)', '조정 R²는 감소할 수 있다(O)', '조정 R²는 R²보다 클 수 있다(X)' 세 문장이 OX로 돌아가며 나온다."
        ],
        terms: ["r-squared", "adjusted-r-squared"]
      },
      {
        id: "b-4-2-q14", node: "b-4-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "다중회귀의 `Prob (F-statistic)`이 0.001로 유의수준 5%에서 유의하면, 모형의 모든 개별 회귀계수도 5%에서 유의하다.",
        answer: false,
        explanation: [
          "**정답: X** [[f-statistic|F 검정]]의 귀무가설은 '모든 기울기 계수가 동시에 0(β1 = β2 = … = 0)'이다. 이를 기각했다는 것은 **적어도 하나**의 계수가 0이 아니라는 뜻일 뿐, 각 계수가 모두 유의하다는 보장은 없다. 다중공선성이 있으면 F는 유의한데 개별 t 검정은 모두 유의하지 않은 경우도 흔하다.",
          "개별 계수의 유의성은 `P>|t|`([[t-test|t 검정]])로, 모형 전체는 `Prob (F-statistic)`으로 따로 읽는다.",
          "",
          "시험에서는 'F가 유의하면 모든 계수가 유의하다(X)'와 'F 검정의 귀무가설은 모든 기울기 = 0(O)'이 짝으로 나온다."
        ],
        terms: ["f-statistic", "t-test", "p-value"]
      },
      {
        id: "b-4-2-q15", node: "b-4-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "회귀계수의 95% 신뢰구간 `[0.025 0.975]`가 0을 포함하면, 그 계수의 `P>|t|` 값은 0.05보다 크다.",
        answer: true,
        explanation: [
          "**정답: O** 계수의 95% [[confidence-interval|신뢰구간]]은 `coef ± t(0.975, df) × std err`이고, [[p-value|p값]]은 같은 t 분포에서 `|t| = |coef / std err|`보다 극단적인 확률이다. 구간이 0을 포함한다는 것은 `|coef| < t(0.975) × std err`, 즉 `|t| < t(0.975)`라는 뜻이므로 p > 0.05가 된다. 두 판단은 수학적으로 동치다.",
          "",
          "거꾸로 신뢰구간이 0을 포함하지 않으면 p < 0.05로 유의하다. summary 표에서 `[0.025 0.975]` 두 값의 부호가 같은지만 보면 유의성을 즉시 알 수 있다.",
          "",
          "시험에서는 p값 열을 가린 summary 표를 주고 신뢰구간만으로 유의한 변수를 고르게 한다."
        ],
        terms: ["confidence-interval", "p-value", "t-test"]
      },
      {
        id: "b-4-2-q16", node: "b-4-2", type: "short", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "from scipy import stats",
          "print(round(stats.t.ppf(0.975, df=4), 3))"
        ],
        lang: "python",
        answer: "2.776",
        explanation: [
          "**정답: 2.776** 자유도 4인 [[t-distribution|t 분포]]의 상위 2.5% 분위수다. 자유도가 작으면 꼬리가 두꺼워 z의 1.96보다 훨씬 크고, 자유도가 커질수록 1.96에 가까워진다(df=9: 2.262, df=24: 2.064, df=∞: 1.960).",
          "`ppf`는 [[ppf|분위수 함수]]로 CDF의 역함수이며, n = 5인 표본의 95% 신뢰구간 임계값이 바로 이 값이다.",
          "",
          "시험에서는 자유도별 t 임계값이 z보다 큰 이유(표본표준편차의 불확실성)와 n이 커지면 z에 수렴하는 성질을 묻는다."
        ],
        terms: ["t-distribution", "ppf", "degrees-of-freedom"]
      },
      {
        id: "b-4-2-q17", node: "b-4-2", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 들어갈 statsmodels 함수 이름을 쓰시오. 설명변수 행렬에 절편용 상수 컬럼을 추가한다: `X = sm.____(df[['x1', 'x2']])`",
        answer: "add_constant",
        accept: ["add_constant()", "sm.add_constant"],
        explanation: [
          "**정답: add_constant** `sm.add_constant(X)`는 값이 모두 1인 `const` 컬럼을 맨 앞에 붙여 [[ols|OLS]]가 [[intercept|절편]]을 추정할 수 있게 한다. statsmodels 배열 API는 절편을 자동으로 넣지 않으므로 이 한 줄이 빠지면 summary에 `const` 행이 없고 R²가 비정상적으로 높게 나올 수 있다.",
          "formula API `smf.ols('y ~ x1 + x2', data=df)`는 절편을 자동으로 포함하며, 빼고 싶을 때 `- 1`을 식에 붙인다.",
          "",
          "시험에서는 `add_constant`를 빠뜨린 코드의 결과(계수 1개 부족)를 묻거나 빈칸으로 낸다."
        ],
        terms: ["ols", "intercept"]
      },
      {
        id: "b-4-2-q18", node: "b-4-2", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드는 잔차 배열로 Durbin-Watson 통계량을 직접 계산한다. 출력을 쓰시오.",
        code: [
          "import numpy as np",
          "e = np.array([1, 2, 3, 2, 1])",
          "dw = np.sum(np.diff(e) ** 2) / np.sum(e ** 2)",
          "print(round(dw, 3))"
        ],
        lang: "python",
        answer: "0.211",
        explanation: [
          "**정답: 0.211** [[durbin-watson|Durbin-Watson]] 통계량의 정의는 `Σ(e_t - e_{t-1})² / Σe_t²`다. 연속 차 `np.diff(e) = [1, 1, -1, -1]`의 제곱합은 4, 잔차 제곱합은 `1 + 4 + 9 + 4 + 1 = 19`이므로 `4/19 = 0.2105 → 0.211`. `statsmodels.stats.stattools.durbin_watson(e)`도 같은 값을 준다.",
          "잔차가 1→2→3→2→1로 부드럽게 이어져 이웃 [[residual|잔차]]가 비슷하므로(양의 자기상관) 값이 0에 가깝다.",
          "",
          "시험에서는 DW 공식과 함께 '0에 가까우면 양의 자기상관, 2면 없음, 4에 가까우면 음의 자기상관'을 묻는다."
        ],
        terms: ["durbin-watson", "residual"]
      },
      {
        id: "b-4-2-q19", node: "b-4-2", type: "short", kind: "concept", difficulty: 3,
        prompt: "설명변수 1개인 단순회귀에서 n = 22, SST = 200, SSE = 50이다. 모형 유의성 검정의 F 통계량을 숫자로 쓰시오.",
        answer: "60",
        accept: ["60.0"],
        explanation: [
          "**정답: 60** [[f-statistic|F 통계량]] `F = (SSR/k) / (SSE/(n-k-1))`. `SSR = SST - SSE = 150`, k = 1, 잔차 [[degrees-of-freedom|자유도]] `n - k - 1 = 20`. 따라서 `F = (150/1) / (50/20) = 150 / 2.5 = 60`. 분자는 회귀 평균제곱(MSR), 분모는 잔차 평균제곱(MSE)이다.",
          "단순회귀에서는 기울기의 t 통계량과 `F = t²` 관계가 성립하므로 `t = √60 ≈ 7.75`가 된다. summary의 `F-statistic`과 `x1`의 `t` 값으로 이 관계를 확인할 수 있다.",
          "",
          "시험에서는 [[sum-of-squares|제곱합]]과 자유도(회귀 k, 잔차 n-k-1, 전체 n-1)를 주고 F를 계산하게 하거나, 분산분석표의 빈칸을 채우게 한다."
        ],
        terms: ["f-statistic", "sum-of-squares", "degrees-of-freedom"]
      },
      {
        id: "b-4-2-q20", node: "b-4-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 sklearn 메서드 이름을 쓰시오. 적합된 선형회귀 모형의 결정계수 R²를 돌려준다: `lr.____(X, y)`",
        answer: "score",
        accept: ["score()"],
        explanation: [
          "**정답: score** `LinearRegression.score(X, y)`는 X로 예측한 값과 y 사이의 [[r-squared|결정계수]] R²를 돌려준다. `r2_score(y, lr.predict(X))`와 같은 값이다. 분류기의 `score`는 정확도(accuracy)를 돌려주므로 모형 종류에 따라 의미가 다르다.",
          "sklearn은 p값·신뢰구간·조정 R²를 제공하지 않는다. `coef_`, `intercept_`, `score`, `predict`가 전부이며 유의성이 필요하면 statsmodels [[ols|OLS]]를 쓴다.",
          "",
          "시험에서는 `score`가 돌려주는 값이 R²인지 RMSE인지, 그리고 `coef_`가 배열이고 `intercept_`가 스칼라라는 점을 묻는다."
        ],
        terms: ["r-squared", "ols"]
      }
    ],

    practices: [
      {
        id: "b-4-p01", node: "b-4",
        title: "모평균 95% 신뢰구간의 상한",
        difficulty: 1,
        task: [
          "`sample`은 어느 공정에서 측정한 40개의 값이다. 모분산을 모른다고 가정하고 모평균의 **95% 신뢰구간**을 t 분포로 구한 뒤, **상한(upper bound)**을 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np",
          "from scipy import stats",
          "rng = np.random.default_rng(2024)",
          "sample = rng.normal(loc=50, scale=8, size=40).round(1)",
          "sample[:10]"
        ],
        hint: [
          "표준오차는 `sample.std(ddof=1) / np.sqrt(len(sample))` 또는 `stats.sem(sample)`.",
          "`stats.t.interval(0.95, df=n-1, loc=평균, scale=표준오차)`가 (하한, 상한)을 돌려준다."
        ],
        answer: { type: "number", value: 53.024, decimals: 3 },
        solution: [
          "n = len(sample)",
          "m = sample.mean()",
          "se = sample.std(ddof=1) / np.sqrt(n)",
          "lo, hi = stats.t.interval(0.95, df=n - 1, loc=m, scale=se)",
          "round(float(hi), 3)"
        ],
        explanation: [
          "표본평균 50.64, 표본표준편차(ddof=1)를 √40으로 나눈 [[standard-error|표준오차]] 1.1785, 자유도 39의 t 임계값 2.0227을 곱한 오차한계 2.384를 더하면 상한 53.024가 나온다.",
          "손계산 `m + stats.t.ppf(0.975, n-1) * se`와 `stats.t.interval`의 결과가 일치하는지 꼭 확인하라. `scale`에 표준편차를 넣으면 구간이 √40배 넓어진다. 모분산을 안다는 조건이 있을 때만 `stats.norm.interval`을 쓴다."
        ],
        terms: ["confidence-interval", "standard-error", "t-distribution"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6 / scipy 1.17.1" }
      },
      {
        id: "b-4-p02", node: "b-4",
        title: "statsmodels OLS 기울기 추정",
        difficulty: 2,
        task: [
          "`df`의 `x`로 `y`를 설명하는 단순선형회귀를 statsmodels OLS로 적합하시오(절편 포함). 추정된 **x의 기울기 계수(coef)**를 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "import statsmodels.api as sm",
          "rng = np.random.default_rng(42)",
          "x = rng.uniform(0, 10, size=80)",
          "y = 3 + 2 * x + rng.normal(0, 2, size=80)",
          "df = pd.DataFrame({'x': x.round(3), 'y': y.round(3)})",
          "df.head()"
        ],
        hint: [
          "`X = sm.add_constant(df['x'])`로 상수 컬럼을 추가해야 절편이 추정된다.",
          "`model.params['x']`가 기울기, `model.params['const']`가 절편이다."
        ],
        answer: { type: "number", value: 2.093, decimals: 3 },
        solution: [
          "X = sm.add_constant(df['x'])",
          "model = sm.OLS(df['y'], X).fit()",
          "round(float(model.params['x']), 3)"
        ],
        explanation: [
          "참값 2에 잡음이 섞인 자료라 [[ols|OLS]] 기울기는 2.093, 절편은 2.282로 추정된다. `model.summary()`를 출력하면 `x`의 `coef` 열에 2.0931, `P>|t|`에 0.000, `[0.025 0.975]`에 (1.939, 2.247)이 보이고 참값 2가 신뢰구간 안에 들어 있다.",
          "`add_constant`를 빼면 원점을 지나는 직선이 적합되어 기울기가 달라지므로 답이 틀린다. `R-squared` 0.904도 함께 읽어 두라. [[regression-coefficient|회귀계수]]의 손계산 `Sxy/Sxx`와도 일치한다."
        ],
        terms: ["ols", "regression-coefficient", "intercept"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / statsmodels 0.15.0" }
      }
    ],

    terms: [
      { id: "confidence-interval", ko: "신뢰구간", en: "confidence interval (CI)",
        def: "모수를 포함할 것으로 기대되는 구간. 95% 신뢰구간은 점추정값 ± 임계값 × 표준오차로 계산하며, 0을 포함하면 해당 계수는 유의하지 않다.",
        nodes: ["b-4", "b-4-2"], related: ["confidence-level", "standard-error", "prediction-interval"] },
      { id: "confidence-level", ko: "신뢰수준", en: "confidence level",
        def: "같은 방법으로 반복 추출해 신뢰구간을 만들 때 모수를 포함하는 구간의 장기적 비율(1−α). 높일수록 임계값이 커져 구간이 넓어진다.",
        nodes: ["b-4"], related: ["confidence-interval"] },
      { id: "standard-error", ko: "표준오차", en: "standard error (SE)",
        def: "표본 통계량(주로 표본평균)의 표준편차. 평균의 표준오차는 s/√n이며 신뢰구간 계산에 쓴다.",
        nodes: ["b-4", "b-4-2"], related: ["confidence-interval", "t-distribution"] },
      { id: "t-distribution", ko: "t 분포", en: "t-distribution (Student's t)",
        def: "모분산을 모를 때 표본표준편차로 표준화한 표본평균이 따르는 분포. 자유도 n−1이며 정규분포보다 꼬리가 두껍고 자유도가 커지면 정규분포에 수렴한다.",
        nodes: ["b-4", "b-4-2"], related: ["degrees-of-freedom", "ppf", "t-test"] },
      { id: "degrees-of-freedom", ko: "자유도", en: "degrees of freedom (df)",
        def: "통계량 계산에서 자유롭게 변할 수 있는 값의 개수. 모평균 신뢰구간은 n−1, 회귀의 잔차 자유도는 n−k−1(k는 설명변수 수)이다.",
        nodes: ["b-4", "b-4-2"], related: ["t-distribution", "f-statistic"] },
      { id: "ppf", ko: "분위수 함수", en: "PPF (percent point function) / quantile",
        def: "누적확률 q에 해당하는 값을 돌려주는 cdf의 역함수. norm.ppf(0.975) = 1.96처럼 임계값 계산에 쓴다.",
        nodes: ["b-4", "b-4-2"], related: ["t-distribution", "confidence-interval"] },
      { id: "proportion-ci", ko: "모비율 신뢰구간", en: "confidence interval for a proportion",
        def: "표본비율 p̂를 이용해 모비율 p를 추정하는 구간 p̂ ± z(α/2)·√(p̂(1−p̂)/n). 정규근사를 쓰므로 np̂와 n(1−p̂)가 충분히 커야 한다.",
        nodes: ["b-4-2"], related: ["confidence-interval", "standard-error"] },
      { id: "prediction-interval", ko: "예측구간", en: "prediction interval",
        def: "주어진 x에서 새로 관측될 개별 y 값이 들어올 구간. 평균 반응의 신뢰구간에 개별 오차 분산이 더해져 항상 신뢰구간보다 넓다.",
        nodes: ["b-4"], related: ["confidence-interval", "residual"] },
      { id: "ols", ko: "최소제곱 선형회귀", en: "OLS (ordinary least squares)",
        def: "잔차 제곱합을 최소화하는 계수를 찾는 선형회귀 추정법. statsmodels에서는 sm.OLS(endog, exog).fit()으로 적합한다.",
        nodes: ["b-4", "b-4-2"], related: ["least-squares", "intercept", "r-squared"] },
      { id: "least-squares", ko: "최소제곱법", en: "least squares",
        def: "예측 오차의 제곱합을 최소화하는 계수를 찾는 방법. np.linalg.lstsq 또는 정규방정식으로 해를 구한다.",
        nodes: ["b-4"], related: ["ols", "residual", "regression-coefficient"] },
      { id: "regression-coefficient", ko: "회귀계수", en: "regression coefficient / slope (β)",
        def: "다른 설명변수를 고정했을 때 설명변수가 한 단위 증가하면 종속변수 평균이 변하는 양. 단순회귀의 기울기는 Sxy/Sxx로 구한다.",
        nodes: ["b-4", "b-4-2"], related: ["intercept", "ols", "standardized-coefficient"] },
      { id: "intercept", ko: "절편", en: "intercept / constant",
        def: "모든 설명변수가 0일 때의 예측값. statsmodels 배열 API는 sm.add_constant로 상수 컬럼을 추가해야 추정된다.",
        nodes: ["b-4", "b-4-2"], related: ["regression-coefficient", "ols"] },
      { id: "residual", ko: "잔차", en: "residual",
        def: "관측값과 모형 예측값의 차이(y − ŷ). 잔차의 정규성·등분산성·독립성 확인이 회귀 진단의 핵심이다.",
        nodes: ["b-4", "b-4-2"], related: ["sum-of-squares", "regression-assumptions", "durbin-watson"] },
      { id: "sum-of-squares", ko: "제곱합 분해", en: "SST / SSR / SSE (sum of squares)",
        def: "총제곱합 SST = Σ(y−ȳ)²를 회귀제곱합 SSR = Σ(ŷ−ȳ)²와 잔차제곱합 SSE = Σ(y−ŷ)²로 나눈 것. SST = SSR + SSE이며 R²와 F 통계량의 재료다.",
        nodes: ["b-4", "b-4-2"], related: ["r-squared", "f-statistic", "residual"] },
      { id: "r-squared", ko: "결정계수", en: "R-squared (R²)",
        def: "종속변수 총변동 중 모형이 설명하는 비율. 0~1이며 설명변수를 추가하면 감소하지 않는다.",
        nodes: ["b-4", "b-4-2"], related: ["adjusted-r-squared", "sum-of-squares", "correlation-coefficient"] },
      { id: "adjusted-r-squared", ko: "수정 결정계수", en: "adjusted R-squared",
        def: "설명변수 개수에 벌점을 주어 보정한 결정계수. 항상 R² 이하이며 불필요한 변수를 추가하면 감소할 수 있어 모형 비교에 쓴다.",
        nodes: ["b-4", "b-4-2"], related: ["r-squared"] },
      { id: "correlation-coefficient", ko: "상관계수", en: "correlation coefficient (Pearson r)",
        def: "두 변수의 선형 관계 강도와 방향을 −1~1로 나타낸 값. 공분산을 두 표준편차의 곱으로 나눈다.",
        nodes: ["b-4-2"], related: ["r-squared"] },
      { id: "f-statistic", ko: "F 통계량", en: "F-statistic",
        def: "회귀모형의 모든 기울기 계수가 0이라는 귀무가설을 검정하는 통계량. 분산분석에서는 집단 간 분산과 집단 내 분산의 비다.",
        nodes: ["b-4", "b-4-2"], related: ["p-value", "t-test", "sum-of-squares"] },
      { id: "p-value", ko: "p값", en: "p-value",
        def: "귀무가설이 참일 때 관측된 통계량 이상으로 극단적인 값이 나올 확률. 유의수준(보통 0.05)보다 작으면 귀무가설을 기각한다.",
        nodes: ["b-4", "b-4-2"], related: ["confidence-interval", "t-test", "f-statistic"] },
      { id: "t-test", ko: "t 검정", en: "t-test",
        def: "평균에 관한 가설을 t 분포로 검정하는 방법. 단일표본(ttest_1samp), 독립 2표본(ttest_ind), 대응표본(ttest_rel)이 있다.",
        nodes: ["b-4-2"], related: ["p-value", "t-distribution", "regression-coefficient"] },
      { id: "regression-assumptions", ko: "회귀 가정", en: "regression assumptions (LINE)",
        def: "선형회귀가 전제하는 네 가지 조건: 선형성(Linearity), 독립성(Independence), 정규성(Normality), 등분산성(Equal variance). 잔차도·Durbin-Watson·Q-Q plot·Breusch-Pagan으로 진단한다.",
        nodes: ["b-4", "b-4-2"], related: ["residual", "homoscedasticity", "durbin-watson", "breusch-pagan"] },
      { id: "homoscedasticity", ko: "등분산성", en: "homoscedasticity",
        def: "오차의 분산이 설명변수 값에 관계없이 일정하다는 회귀 가정. 위반된 상태를 이분산성(heteroscedasticity)이라 하며 잔차도의 깔때기 모양이나 Breusch-Pagan 검정으로 진단한다.",
        nodes: ["b-4", "b-4-2"], related: ["regression-assumptions", "breusch-pagan"] },
      { id: "breusch-pagan", ko: "브로이슈-페이건 검정", en: "Breusch-Pagan test",
        def: "회귀 잔차의 분산이 설명변수에 의존하는지(이분산성) 검정하는 방법. 귀무가설은 등분산이며 p < 0.05면 이분산을 의심한다. statsmodels의 het_breuschpagan으로 수행한다.",
        nodes: ["b-4", "b-4-2"], related: ["homoscedasticity", "regression-assumptions"] },
      { id: "durbin-watson", ko: "더빈-왓슨 통계량", en: "Durbin-Watson statistic",
        def: "회귀 잔차의 1차 자기상관을 진단하는 통계량. 0~4 범위이며 2에 가까우면 자기상관이 없다고 본다.",
        nodes: ["b-4", "b-4-2"], related: ["residual", "regression-assumptions"] },
      { id: "vif", ko: "분산팽창계수", en: "VIF (variance inflation factor)",
        def: "한 설명변수를 나머지 설명변수로 회귀한 R²로 계산한 1/(1−R²). 10 이상이면 다중공선성이 심하다고 판단한다.",
        nodes: ["b-4"], related: ["multicollinearity"] },
      { id: "multicollinearity", ko: "다중공선성", en: "multicollinearity",
        def: "설명변수들 사이에 강한 선형 상관이 있어 계수 추정이 불안정해지는 현상. VIF나 상관행렬로 진단한다.",
        nodes: ["b-4", "b-4-2"], related: ["vif", "dummy-variable"] },
      { id: "dummy-variable", ko: "더미 변수", en: "dummy variable / one-hot",
        def: "범주형 변수를 0/1 지시변수로 바꾼 것. 회귀에서는 기준 범주 하나를 제외한 k−1개를 사용해 완전 공선성을 피한다.",
        nodes: ["b-4-2"], related: ["multicollinearity", "regression-coefficient"] },
      { id: "log-transformation", ko: "로그 변환", en: "log transformation (log-linear / log-log)",
        def: "변수에 자연로그를 취해 회귀하는 변환. 종속변수만 로그면 계수는 x 한 단위당 y의 비율 변화(≈100·β %), 양쪽 모두 로그면 x 1% 변화당 y의 β% 변화(탄력성)로 해석한다.",
        nodes: ["b-4-2"], related: ["regression-coefficient", "standardized-coefficient"] },
      { id: "standardized-coefficient", ko: "표준화 회귀계수", en: "standardized coefficient (beta)",
        def: "설명변수와 종속변수를 모두 표준화한 뒤 추정한 회귀계수. 단위가 사라져 설명변수 간 영향력 크기를 직접 비교할 수 있다.",
        nodes: ["b-4-2"], related: ["regression-coefficient", "log-transformation"] }
    ]
  });
})();
