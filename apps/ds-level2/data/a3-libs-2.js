/* ds-level2 — 파트A 3장 후반 콘텐츠: a-3-5 statsmodels · a-3-6 Scipy · a-3-7 특수 라이브러리 및 수동 구현
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그·링크한 용어는 전부 이 파일에서 정의.
   실습 정답은 tools/extract_practice.js + tools/verify_practice.py 로 실제 실행 검증했다(verified 필드). */
(function () {
  DS2.register({
    chapter: "a-3",

    /* ────────────────────────────────────────────────────────
       요약 카드
       ──────────────────────────────────────────────────────── */
    cards: {
      "a-3-5": {
        node: "a-3-5",
        title: "statsmodels",
        summary: [
          "statsmodels는 **통계 추론**에 특화된 라이브러리다. 예측 성능보다 계수의 유의성·신뢰구간·모형 적합도를 보는 것이 목적이고, 그 결과가 `summary()` 표 한 장에 모인다.",
          "입구는 둘이다. 배열 API(`sm.OLS(y, sm.add_constant(X))`)는 **절편을 직접 넣어야** 하고, 수식 API(`smf.ols('y ~ x1 + C(g)', data=df)`)는 절편이 자동이며 `C()`로 범주형을 더미 처리한다.",
          "시험은 [[ols|OLS]] summary 표의 각 칸(coef, std err, t, P>|t|, [0.025 0.975], R², Adj. R², F-statistic, AIC/BIC, Durbin-Watson)을 **읽을 수 있는지**, 그리고 [[logistic-regression|로지스틱 회귀]]의 계수를 [[odds-ratio|오즈비]]로 바꿀 수 있는지를 묻는다."
        ],
        concepts: [
          "**OLS(ordinary least squares)**: 잔차 제곱합을 최소화하는 선형회귀. `sm.OLS(endog, exog)` — **종속변수가 첫 인자**다. `fit()` 뒤 `params`, `pvalues`, `conf_int()`, `rsquared`, `rsquared_adj`, `fvalue`, `aic`, `bic`, `resid`, `predict()`.",
          "**절편(intercept)**: 배열 API는 절편을 자동으로 넣지 않는다. [[intercept|`sm.add_constant(X)`]]로 값이 1인 `const` 컬럼을 붙인다. 수식 API는 `Intercept`가 자동 포함(`-1` 또는 `+0`으로 제거).",
          "**summary 읽기**: `coef`는 추정 계수, `std err`는 계수의 표준오차, `t = coef/std err`, `P>|t|`는 [[p-value|p값]](0.05보다 작으면 유의), `[0.025 0.975]`는 95% [[confidence-interval|신뢰구간]](0을 포함하면 유의하지 않음과 동치).",
          "**적합도**: [[r-squared|R²]]는 설명 분산 비율, [[adjusted-r-squared|Adj. R²]]는 변수 수를 벌점으로 보정(변수를 더해도 올라가지 않을 수 있음). [[f-statistic|F-statistic]]은 '모든 기울기 = 0' 검정. [[aic-bic|AIC/BIC]]는 작을수록 좋고 모형 비교용. [[durbin-watson|Durbin-Watson]]은 잔차 자기상관(2 근처면 없음).",
          "**범주형과 상호작용**: `C(g)`는 [[dummy-variable|더미 변수]]로 바꾸고 첫 범주를 기준(reference)으로 뺀다 → 계수 이름 `C(g)[T.b]`. 상호작용은 `x1:x2`(교차항만) 또는 `x1*x2`(주효과 + 교차항).",
          "**로지스틱**: `smf.logit('y ~ x', df).fit()` 또는 `sm.GLM(y, X, family=sm.families.Binomial())`. 계수는 **로그 오즈(log-odds)** 이므로 `np.exp(params)`가 [[odds-ratio|오즈비]]. 변수 1단위 증가 시 오즈가 exp(coef)배.",
          "**진단**: [[vif|VIF]]는 `statsmodels.stats.outliers_influence.variance_inflation_factor(X.values, i)`로 변수별 계산, 10 이상이면 [[multicollinearity|다중공선성]] 의심. 잔차는 `res.resid`, 정규성은 Jarque-Bera(summary 하단)나 scipy shapiro.",
          "**가설검정 모듈** `statsmodels.stats`: `ttest_ind`(weightstats), `proportions_ztest`(proportion), `anova_lm`(anova — OLS 결과를 [[anova|분산분석]] 표로), `pairwise_tukeyhsd`(multicomp — [[tukey-hsd|사후검정]]). 시계열은 `tsa.stattools.adfuller`([[adf-test|ADF 정상성 검정]]), `acf`([[autocorrelation|자기상관]])."
        ],
        terms: ["ols", "intercept", "p-value", "confidence-interval", "r-squared", "adjusted-r-squared", "f-statistic", "aic-bic", "durbin-watson", "dummy-variable", "logistic-regression", "odds-ratio"],
        patterns: [
          {
            title: "배열 API — 절편을 직접 추가",
            lang: "python",
            code: [
              "import statsmodels.api as sm",
              "X = sm.add_constant(df[['x1', 'x2']])   # const 컬럼 추가",
              "res = sm.OLS(df['y'], X).fit()            # endog(y) 먼저, exog(X) 다음",
              "print(res.summary())",
              "res.params, res.pvalues, res.conf_int(), res.rsquared_adj"
            ],
            note: "`add_constant`를 빼면 원점을 지나는 회귀가 되어 R²가 비정상적으로 커 보일 수 있다."
          },
          {
            title: "수식 API — 범주형 C()와 상호작용",
            lang: "python",
            code: [
              "import statsmodels.formula.api as smf",
              "res = smf.ols('y ~ x1 + x2 + C(group) + x1:x2', data=df).fit()",
              "res.params.index.tolist()",
              "# ['Intercept', 'C(group)[T.b]', 'C(group)[T.c]', 'x1', 'x2', 'x1:x2']"
            ],
            note: "기준 범주(알파벳순 첫 범주)는 절편에 흡수된다. `C(group, Treatment('c'))`로 기준을 바꿀 수 있다."
          },
          {
            title: "로지스틱 회귀와 오즈비",
            lang: "python",
            code: [
              "import numpy as np",
              "res = smf.logit('y ~ age + income', data=df).fit(disp=0)",
              "odds_ratio = np.exp(res.params)       # 계수(log-odds) → 오즈비",
              "ci_or = np.exp(res.conf_int())        # 오즈비의 95% 신뢰구간",
              "pred = (res.predict(df) >= 0.5).astype(int)"
            ],
            note: "`sm.GLM(y, X, family=sm.families.Binomial()).fit()`도 같은 계수를 준다. `predict`는 확률을 돌려주므로 0.5 기준으로 잘라 분류한다."
          },
          {
            title: "VIF로 다중공선성 점검",
            lang: "python",
            code: [
              "from statsmodels.stats.outliers_influence import variance_inflation_factor",
              "X = sm.add_constant(df[['x1', 'x2', 'x3']])",
              "vif = pd.Series([variance_inflation_factor(X.values, i) for i in range(X.shape[1])],",
              "                index=X.columns)",
              "vif[vif > 10]"
            ],
            note: "두 번째 인자는 **컬럼 위치(정수)**. `const` 행의 VIF는 무시한다."
          },
          {
            title: "ANOVA 표와 Tukey 사후검정",
            lang: "python",
            code: [
              "from statsmodels.stats.anova import anova_lm",
              "from statsmodels.stats.multicomp import pairwise_tukeyhsd",
              "model = smf.ols('score ~ C(method)', data=df).fit()",
              "anova_lm(model, typ=2)                      # F, PR(>F)",
              "print(pairwise_tukeyhsd(df['score'], df['method'], alpha=0.05))"
            ]
          }
        ],
        pitfalls: [
          "`sm.OLS(X, y)`처럼 인자 순서를 바꾸면 에러가 아니라 **엉뚱한 모형**이 조용히 적합된다. 종속변수(endog)가 먼저다.",
          "Logit의 `params`는 오즈비가 아니라 로그 오즈다. 오즈비를 물으면 `np.exp()`를 적용한 값을 답한다.",
          "`P>|t|`가 0.05보다 **작아야** 유의하다. 95% 신뢰구간이 0을 포함하면 그 계수는 유의하지 않다.",
          "Adj. R²는 R²보다 항상 작거나 같다. 변수를 더해 R²는 올라갔는데 Adj. R²가 내려가면 그 변수는 쓸모없다는 신호.",
          "`C()`를 빼고 숫자형 코드(1,2,3)로 저장된 범주를 그대로 넣으면 **연속형으로 취급**되어 계수 1개만 나온다."
        ]
      },

      "a-3-6": {
        node: "a-3-6",
        title: "Scipy",
        summary: [
          "`scipy.stats`는 확률분포 객체와 가설검정 함수의 창고다. 분포 객체(`norm`, `t`, `chi2`, `f`, `binom`, `poisson`)는 공통 메서드 [[pdf|pdf]]/[[pmf|pmf]]·[[cdf|cdf]]·[[ppf|ppf]]·[[survival-function|sf]]·`rvs`를 가진다.",
          "검정 함수는 모두 `statistic`과 `pvalue` 속성을 가진 결과 객체를 돌려주고, 대부분 `alternative='two-sided'|'less'|'greater'`로 [[one-sided-test|단측 검정]]을 지정한다.",
          "시험은 '어느 상황에 어느 함수인가'(모수 vs 비모수, 독립 vs 대응, 2집단 vs 3집단 이상)와 `ppf(0.975)=1.96`처럼 분포 메서드의 뜻을 묻는다."
        ],
        concepts: [
          "**분포 메서드**: `pdf(x)` 확률밀도(연속), `pmf(k)` 확률질량(이산), `cdf(x)` = P(X ≤ x), `sf(x)` = 1 − cdf = P(X > x), `ppf(q)` = cdf의 역함수(분위수, 임계값), `rvs(size, random_state)` 난수. 예: `norm.ppf(0.975)` ≈ 1.96, `t.ppf(0.975, df=n-1)`.",
          "**t 검정 3종**: `ttest_1samp(a, popmean)` 단일표본, `ttest_ind(a, b, equal_var=True)` 독립 2표본(`equal_var=False`면 [[welch-t-test|Welch t 검정]]), `ttest_rel(a, b)` 대응(짝지은) 표본 — 두 배열 길이가 같아야 한다.",
          "**범주형**: `chi2_contingency(table)`은 (statistic, pvalue, dof, expected) 4개를 돌려주는 [[chi-square-test|카이제곱 독립성 검정]]. `pd.crosstab`으로 분할표를 만들어 넣는다. 자유도 = (행−1)(열−1).",
          "**3집단 이상**: 모수 `f_oneway(a, b, c)`([[anova|일원분산분석]]), 비모수 `kruskal(a, b, c)`([[kruskal-wallis|Kruskal-Wallis]]).",
          "**가정 검정**: 정규성 `shapiro(x)`, `normaltest(x)`(D'Agostino) — p < 0.05면 정규성 **기각**([[normality-test|정규성 검정]]). 등분산 `levene(a, b)`(강건), `bartlett(a, b)`(정규 가정) — p < 0.05면 분산이 다르다([[levene-test|Levene 검정]]).",
          "**비모수 대응표**: 독립 2표본 → [[mann-whitney-u|`mannwhitneyu`]], 대응 2표본 → [[wilcoxon|`wilcoxon`]], 3집단 이상 → `kruskal`. 순위 기반이라 정규성 가정이 필요 없다([[nonparametric-test|비모수 검정]]).",
          "**상관**: `pearsonr`(선형, [[correlation-coefficient|피어슨 상관계수]]), [[spearman|`spearmanr`]](순위 상관, 단조 관계·이상치에 강건), `kendalltau`. 모두 (statistic, pvalue).",
          "**그 외**: `scipy.optimize.minimize(f, x0)` 수치 최적화, [[curve-fit|`curve_fit(f, x, y)`]] 비선형 최소제곱 적합(계수와 공분산 반환), `scipy.interpolate.interp1d` [[interpolation|보간]]."
        ],
        terms: ["probability-distribution", "cdf", "ppf", "survival-function", "pmf", "welch-t-test", "chi-square-test", "normality-test", "levene-test", "nonparametric-test", "correlation-coefficient", "one-sided-test"],
        patterns: [
          {
            title: "분포 객체 — 임계값·확률",
            lang: "python",
            code: [
              "from scipy import stats",
              "stats.norm.ppf(0.975)              # 1.96  (양측 5% 임계값)",
              "stats.norm.cdf(1.96)               # 0.975",
              "stats.norm.sf(1.96)                # 0.025  (= 1 - cdf)",
              "stats.t.ppf(0.975, df=29)          # 2.045",
              "stats.binom.pmf(2, n=4, p=0.5)     # 0.375",
              "stats.poisson.cdf(3, mu=2)         # P(X<=3)"
            ]
          },
          {
            title: "t 검정 3종과 결과 객체",
            lang: "python",
            code: [
              "r1 = stats.ttest_1samp(x, popmean=50)",
              "r2 = stats.ttest_ind(a, b, equal_var=False)         # Welch",
              "r3 = stats.ttest_rel(before, after, alternative='greater')",
              "r2.statistic, r2.pvalue, r2.df"
            ],
            note: "p값 비교는 `r.pvalue < 0.05`. 결과는 튜플처럼 언패킹도 된다: `t, p = stats.ttest_ind(a, b)`."
          },
          {
            title: "카이제곱 독립성 검정",
            lang: "python",
            code: [
              "table = pd.crosstab(df['gender'], df['brand'])",
              "chi2, p, dof, expected = stats.chi2_contingency(table)",
              "# 2x2 표에서 연속성 보정을 끄려면 correction=False"
            ]
          },
          {
            title: "가정 검정 → 검정 선택",
            lang: "python",
            code: [
              "sw = stats.shapiro(a).pvalue        # 정규성: p < 0.05 면 기각",
              "lv = stats.levene(a, b).pvalue      # 등분산: p < 0.05 면 분산 다름",
              "if sw < 0.05:",
              "    res = stats.mannwhitneyu(a, b)",
              "else:",
              "    res = stats.ttest_ind(a, b, equal_var=(lv >= 0.05))"
            ]
          },
          {
            title: "상관계수와 p값",
            lang: "python",
            code: [
              "r, p = stats.pearsonr(df['x'], df['y'])",
              "rho, p2 = stats.spearmanr(df['x'], df['y'])",
              "tau, p3 = stats.kendalltau(df['x'], df['y'])"
            ]
          },
          {
            title: "curve_fit 비선형 적합",
            lang: "python",
            code: [
              "from scipy.optimize import curve_fit",
              "def f(x, a, b): return a * np.exp(b * x)",
              "popt, pcov = curve_fit(f, x, y, p0=[1, 0.1])",
              "a_hat, b_hat = popt"
            ]
          }
        ],
        pitfalls: [
          "`ppf`는 cdf의 **역함수**다. `norm.ppf(0.95)`=1.645(단측 5%), `norm.ppf(0.975)`=1.96(양측 5%)을 헷갈리면 안 된다.",
          "`ttest_ind`의 기본 `equal_var=True`(Student). 등분산을 가정하기 어려우면 `equal_var=False`(Welch).",
          "`ttest_1samp`에는 `popmean`이 **필수 위치 인자**다. 빼면 TypeError.",
          "`chi2_contingency`는 값 4개를 돌려준다. `chi2, p = ...`로 두 개만 받으면 ValueError.",
          "정규성·등분산 검정에서 p < 0.05는 '가정 위반'이다. '유의하니 좋다'로 읽으면 반대로 해석하게 된다."
        ]
      },

      "a-3-7": {
        node: "a-3-7",
        title: "특수 라이브러리 및 수동 구현",
        summary: [
          "라이브러리 함수가 막혔거나 '직접 계산하라'는 지문이 나올 때를 위한 토픽이다. numpy 벡터 연산으로 평균·[[sample-variance|표본분산]]·[[standard-error|표준오차]]·[[z-score|z 점수]]·상관계수·[[confidence-interval|신뢰구간]]·최소제곱 해·[[f1-score|F1]]·[[rmse|RMSE]]·거리·스케일링을 식 그대로 구현한다.",
          "핵심 함정은 **[[ddof|ddof]]**(numpy 기본 0 = 모분산, pandas 기본 1 = 표본분산)와 **분모가 무엇인지**(정밀도는 예측 양성, 재현율은 실제 양성)이다.",
          "xgboost/lightgbm/imbalanced-learn/mlxtend 같은 특수 라이브러리는 설치 여부가 환경마다 달라 **개념**(핵심 파라미터·용도)만 출제된다."
        ],
        concepts: [
          "**분산의 자유도**: 표본분산 s² = Σ(x−x̄)²/(n−1). `np.var(x)`는 ddof=0(n으로 나눔, 모분산), `np.var(x, ddof=1)`·`pd.Series.var()`는 n−1. 표준편차도 같다.",
          "**표준오차와 신뢰구간**: SE = s/√n. 95% 신뢰구간 = x̄ ± t(0.975, n−1)·SE (σ 미지) 또는 x̄ ± 1.96·SE(대표본). `stats.t.ppf(0.975, n-1)`로 임계값.",
          "**표준화와 상관**: z = (x − μ)/σ. 공분산 cov = Σ(x−x̄)(y−ȳ)/(n−1), 상관계수 r = cov/(sx·sy) = `np.corrcoef(x, y)[0, 1]`. [[min-max-scaling|min-max]]는 (x − min)/(max − min) → [0, 1], [[standardization|표준화]]는 평균 0·표준편차 1.",
          "**최소제곱 해**: 정규방정식 β = (XᵀX)⁻¹Xᵀy. 실무는 `np.linalg.lstsq(X, y, rcond=None)[0]`(수치적으로 안정). X에 1로 채운 열을 붙여야 절편이 나온다([[least-squares|최소제곱]]).",
          "**분류 지표 수동 계산**: [[confusion-matrix|혼동행렬]]에서 정확도 = (TP+TN)/전체, [[precision|정밀도]] = TP/(TP+FP), [[recall|재현율]] = TP/(TP+FN), F1 = 2PR/(P+R)(조화평균). 불리언 마스크 `((y_true==1)&(y_pred==1)).sum()`으로 TP를 센다.",
          "**회귀 지표**: MSE = mean((y−ŷ)²), RMSE = √MSE, [[mae|MAE]] = mean(|y−ŷ|). 제곱을 **평균 안에서** 해야 한다.",
          "**거리와 유사도**: [[euclidean-distance|유클리드]] √Σ(a−b)², [[manhattan-distance|맨해튼]] Σ|a−b|, [[cosine-similarity|코사인 유사도]] a·b/(‖a‖‖b‖) — 크기가 아니라 방향만 본다. [[knn|KNN]]은 거리 기준 k개 이웃의 다수결, [[k-means|k-means]] 1스텝은 '가장 가까운 중심 할당 → 중심을 평균으로 갱신'.",
          "**특수 라이브러리 개념**: [[xgboost|XGBoost]]/LightGBM은 그래디언트 부스팅(`n_estimators`, [[learning-rate|`learning_rate`]], `max_depth`, LightGBM은 `num_leaves`). [[smote|SMOTE]](imbalanced-learn)는 소수 클래스를 k-NN 보간으로 합성해 [[class-imbalance|클래스 불균형]]을 완화하며 **학습 데이터에만** 적용. mlxtend `apriori` → `association_rules`는 support·confidence·[[lift|lift]]를 계산([[association-rules|연관규칙]]). `itertools.combinations`·`functools.reduce`로 조합·누적 연산."
        ],
        terms: ["sample-variance", "ddof", "standard-error", "z-score", "least-squares", "precision", "recall", "f1-score", "rmse", "mae", "cosine-similarity", "smote"],
        patterns: [
          {
            title: "기술통계를 식으로",
            lang: "python",
            code: [
              "n = len(x)",
              "mean = x.sum() / n",
              "var_s = ((x - mean) ** 2).sum() / (n - 1)        # 표본분산 == np.var(x, ddof=1)",
              "se = np.sqrt(var_s) / np.sqrt(n)                 # 표준오차",
              "z = (x - mean) / np.sqrt(var_s)                  # z-score",
              "r = ((x - x.mean()) * (y - y.mean())).sum() / np.sqrt(((x - x.mean())**2).sum() * ((y - y.mean())**2).sum())"
            ]
          },
          {
            title: "95% 신뢰구간 수동 계산",
            lang: "python",
            code: [
              "from scipy import stats",
              "n = len(x); m = x.mean(); se = x.std(ddof=1) / np.sqrt(n)",
              "t_crit = stats.t.ppf(0.975, df=n - 1)",
              "lower, upper = m - t_crit * se, m + t_crit * se"
            ],
            note: "σ를 아는 경우(또는 대표본 근사)는 `stats.norm.ppf(0.975)` = 1.96을 쓴다."
          },
          {
            title: "최소제곱 해 — 정규방정식과 lstsq",
            lang: "python",
            code: [
              "X1 = np.column_stack([np.ones(len(x)), x])        # 절편 열 추가",
              "beta_ne = np.linalg.inv(X1.T @ X1) @ X1.T @ y      # 정규방정식",
              "beta, *_ = np.linalg.lstsq(X1, y, rcond=None)      # 권장",
              "beta  # [절편, 기울기]"
            ]
          },
          {
            title: "분류 지표 수동 계산",
            lang: "python",
            code: [
              "tp = np.sum((y_true == 1) & (y_pred == 1))",
              "fp = np.sum((y_true == 0) & (y_pred == 1))",
              "fn = np.sum((y_true == 1) & (y_pred == 0))",
              "tn = np.sum((y_true == 0) & (y_pred == 0))",
              "acc = (tp + tn) / len(y_true)",
              "precision = tp / (tp + fp); recall = tp / (tp + fn)",
              "f1 = 2 * precision * recall / (precision + recall)"
            ]
          },
          {
            title: "회귀 지표·거리·스케일링",
            lang: "python",
            code: [
              "mse = np.mean((y - y_hat) ** 2); rmse = np.sqrt(mse); mae = np.mean(np.abs(y - y_hat))",
              "euclid = np.sqrt(np.sum((a - b) ** 2)); manhattan = np.sum(np.abs(a - b))",
              "cosine = a @ b / (np.linalg.norm(a) * np.linalg.norm(b))",
              "minmax = (x - x.min()) / (x.max() - x.min())",
              "standard = (x - x.mean()) / x.std()"
            ]
          },
          {
            title: "itertools / functools 활용",
            lang: "python",
            code: [
              "from itertools import combinations, product",
              "from functools import reduce",
              "pairs = list(combinations(['a', 'b', 'c'], 2))   # [('a','b'), ('a','c'), ('b','c')]",
              "total = reduce(lambda acc, v: acc * v, [1, 2, 3, 4], 1)   # 24"
            ]
          }
        ],
        pitfalls: [
          "`np.std(x)`(ddof=0)와 `pd.Series(x).std()`(ddof=1)는 **값이 다르다**. 지문의 '표본표준편차'는 ddof=1.",
          "RMSE를 `np.sqrt(np.mean(y - y_hat) ** 2)`로 쓰면 잔차 평균의 절댓값이 나온다. 제곱은 평균 **안**에서.",
          "정밀도와 재현율의 분모를 바꾸면 값이 뒤집힌다. 정밀도 = 예측 양성 중 맞춘 비율, 재현율 = 실제 양성 중 찾아낸 비율.",
          "코사인 유사도는 벡터 길이에 영향을 받지 않는다(방향만). 유클리드 거리는 영향을 받는다.",
          "SMOTE는 train/test 분할 **후** 훈련 데이터에만 적용한다. 전체에 적용하면 테스트 누수(leakage)."
        ]
      }
    },

    /* ────────────────────────────────────────────────────────
       필기 문제 — a-3-5 statsmodels (12)
       ──────────────────────────────────────────────────────── */
    questions: [
      {
        id: "a-3-5-q01", node: "a-3-5", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "statsmodels의 배열 API로 선형회귀(OLS)를 적합할 때 `X = sm.add_constant(X)`를 호출하는 이유로 옳은 것은?",
        choices: [
          "절편(intercept) 항을 추정하도록 값이 1인 상수 컬럼을 추가한다",
          "설명변수를 표준화(standardization)하여 계수를 비교 가능하게 한다",
          "결측값(missing value)을 상수 0으로 대체한다",
          "종속변수와 설명변수의 길이를 맞춘다"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** `sm.OLS`는 scikit-learn과 달리 [[intercept|절편(intercept)]]을 자동으로 넣지 않는다. `add_constant`는 값이 모두 1인 `const` 컬럼을 붙여 절편 계수를 추정하게 한다.",
          "",
          "- ② 표준화(standardization)는 `StandardScaler`나 `(x-mean)/std`로 한다. `add_constant`는 값을 바꾸지 않는다.",
          "- ③ 결측값 처리는 `missing='drop'` 옵션이나 사전 `dropna()`로 하고, 상수 컬럼 추가와 무관하다.",
          "- ④ 길이가 다르면 ValueError가 난다. `add_constant`는 컬럼을 하나 늘릴 뿐 행 수는 바꾸지 않는다.",
          "",
          "시험에서는 \"[[ols|OLS]] 결과에 절편이 없다/`const` 행이 없다\"는 상황을 주고 빠진 함수를 묻는 형태로 나온다."
        ],
        terms: ["intercept", "ols"]
      },
      {
        id: "a-3-5-q02", node: "a-3-5", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "OLS `summary()` 표에서 어떤 설명변수의 `P>|t|` 값이 0.003으로 나왔다. 이에 대한 해석으로 옳은 것은?",
        choices: [
          "이 변수의 계수는 0.003이다",
          "이 변수가 종속변수 분산의 0.3%를 설명한다",
          "유의수준 0.05에서 이 변수의 계수는 0과 유의하게 다르다",
          "이 변수의 95% 신뢰구간은 0을 포함한다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `P>|t|`는 '계수 = 0'이라는 귀무가설(null hypothesis)에 대한 [[p-value|p값(p-value)]]이다. 0.003 < 0.05이므로 귀무가설을 기각하고 계수가 유의하다고 본다.",
          "",
          "- ① 계수 값은 `coef` 열이다. p값은 계수의 크기가 아니다.",
          "- ② 설명 분산 비율은 [[r-squared|R²]]이며 변수 단위가 아니라 모형 전체에 대한 값이다.",
          "- ④ p < 0.05이면 95% [[confidence-interval|신뢰구간]] `[0.025 0.975]`은 0을 포함하지 **않는다**. 둘은 동치다.",
          "",
          "시험에서는 summary 표 일부를 보여주고 \"유의한 변수는?\" 또는 \"신뢰구간이 0을 포함하는 변수는?\"으로 나온다."
        ],
        terms: ["p-value", "confidence-interval"]
      },
      {
        id: "a-3-5-q03", node: "a-3-5", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "import numpy as np",
          "import statsmodels.api as sm",
          "x = np.array([1, 2, 3, 4, 5])",
          "y = 2 * x + 1",
          "X = sm.add_constant(x)",
          "res = sm.OLS(y, X).fit()",
          "print(np.round(res.params, 1).tolist(), X.shape)"
        ],
        lang: "python",
        choices: ["[2.0, 1.0] (5, 1)", "[1.0, 2.0] (5, 2)", "[2.0] (5, 1)", "[1.0, 2.0] (2, 5)"],
        answer: 1,
        explanation: [
          "**정답: ②** `add_constant`는 상수 열을 **앞에** 붙여 `X`가 (5, 2)가 된다. 완전한 직선 y = 1 + 2x이므로 [[ols|OLS]] 계수는 `[절편 1.0, 기울기 2.0]` 순서로 나온다.",
          "",
          "- ① 순서가 뒤집혔다. `params`의 첫 원소는 [[intercept|절편(intercept)]](const)이다.",
          "- ③ `add_constant`를 호출하지 않았을 때의 결과다(계수 하나, shape (5, 1)).",
          "- ④ `X`는 행이 관측치(5), 열이 변수(2)다. (2, 5)는 전치된 모양이다.",
          "",
          "시험에서는 `params` 순서(const 먼저)와 `add_constant` 후 shape를 함께 묻는다."
        ],
        terms: ["ols", "intercept"]
      },
      {
        id: "a-3-5-q04", node: "a-3-5", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "수식 API `smf.ols('y ~ x + C(region)', data=df)`에서 `C(region)`의 역할로 옳은 것은?",
        choices: [
          "`region`을 표준화(standardization)한다",
          "`region`과 `x`의 상호작용(interaction) 항을 만든다",
          "`region`을 연속형으로 강제 변환한다",
          "`region`을 범주형으로 취급해 기준 범주를 제외한 더미 변수(dummy variable)로 인코딩한다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** `C()`는 categorical의 약자다. 범주 수 k개면 k−1개의 [[dummy-variable|더미 변수(dummy variable)]]를 만들고, 첫 범주(기준, reference)는 절편에 흡수된다. 계수 이름은 `C(region)[T.서울]`처럼 나온다.",
          "",
          "- ① 표준화는 `standardize()`나 사전 처리로 한다. `C()`는 값을 스케일링하지 않는다.",
          "- ② 상호작용은 `x:C(region)` 또는 `x*C(region)`으로 쓴다. `+`는 주효과만 더한다.",
          "- ③ 반대다. 숫자 코드(1, 2, 3)로 저장된 범주를 `C()` 없이 넣으면 연속형으로 취급되는데, `C()`가 이를 범주형으로 바꾼다.",
          "",
          "시험에서는 \"범주가 4개인데 계수가 3개만 나온 이유\" 또는 `C()`를 빼먹은 코드의 문제점을 묻는다."
        ],
        terms: ["dummy-variable", "formula-api"]
      },
      {
        id: "a-3-5-q05", node: "a-3-5", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "import pandas as pd",
          "import statsmodels.formula.api as smf",
          "df = pd.DataFrame({'y': [1, 2, 3, 4, 5, 6],",
          "                   'x': [1, 2, 3, 4, 5, 6],",
          "                   'g': ['a', 'b', 'c', 'a', 'b', 'c']})",
          "res = smf.ols('y ~ x + C(g)', data=df).fit()",
          "print(res.params.index.tolist())"
        ],
        lang: "python",
        choices: [
          "['Intercept', 'C(g)[T.b]', 'C(g)[T.c]', 'x']",
          "['const', 'x', 'g_a', 'g_b', 'g_c']",
          "['x', 'C(g)[T.a]', 'C(g)[T.b]', 'C(g)[T.c]']",
          "['Intercept', 'x', 'g']"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[formula-api|수식 API]]는 `Intercept`를 자동으로 넣고, 범주형 항을 연속형 항보다 **앞에** 배치한다. `C(g)`는 기준 범주 `a`를 빼고 `[T.b]`, `[T.c]` 두 [[dummy-variable|더미 변수]]만 만든다.",
          "",
          "- ② `const`·`g_a` 식 이름은 `sm.add_constant` + `pd.get_dummies`를 쓴 배열 API의 모양이고, 범주 3개를 모두 넣으면 완전 공선성이 생긴다.",
          "- ③ 수식 API에는 절편이 있고, 기준 범주 `a`는 더미로 만들지 않는다.",
          "- ④ `g`가 문자열이면 `C()`가 없어도 더미로 분해되므로 `g` 하나의 계수로 나오지 않는다.",
          "",
          "시험에서는 `C(g)[T.b]` 표기를 보여주고 \"기준 범주는 무엇인가\"(a)를 묻는 형태가 흔하다."
        ],
        terms: ["formula-api", "dummy-variable", "intercept"]
      },
      {
        id: "a-3-5-q06", node: "a-3-5", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드로 `y`를 `x1`, `x2`로 설명하는 회귀를 적합하려 한다. 잘못된 부분은?",
        code: [
          "import statsmodels.api as sm",
          "X = sm.add_constant(df[['x1', 'x2']])",
          "res = sm.OLS(X, df['y']).fit()",
          "print(res.summary())"
        ],
        lang: "python",
        choices: [
          "`add_constant`는 DataFrame에 쓸 수 없다",
          "`sm.OLS`의 인자 순서가 뒤바뀌었다 — 종속변수(endog)가 먼저 와야 한다",
          "`fit()` 대신 `fit_transform()`을 써야 한다",
          "`summary()`가 아니라 `summary2()`만 존재한다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** `sm.OLS(endog, exog)` — 첫 인자가 종속변수(endogenous), 둘째가 설명변수(exogenous)다. 이 코드는 `X`를 종속변수로, `y`를 설명변수로 적합하므로 **에러 없이 엉뚱한 모형**이 만들어진다(다변량 endog로 처리).",
          "",
          "- ① `add_constant`는 ndarray, Series, DataFrame 모두 받아 `const` 컬럼을 붙여준다.",
          "- ③ `fit_transform`은 scikit-learn 변환기의 메서드다. statsmodels 모형은 `fit()`을 쓴다.",
          "- ④ `summary()`와 `summary2()` 둘 다 존재한다. `summary()`가 표준이다.",
          "",
          "시험에서는 scikit-learn `fit(X, y)` 순서와 statsmodels `OLS(y, X)` 순서가 반대라는 점을 [[ols|OLS]] 코드 오류 문제로 낸다."
        ],
        terms: ["ols", "intercept"]
      },
      {
        id: "a-3-5-q07", node: "a-3-5", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "OLS 결과 진단에 대한 설명 중 **옳지 않은** 것은?",
        choices: [
          "Durbin-Watson 통계량이 2에 가까우면 잔차의 자기상관(autocorrelation)이 거의 없다고 본다",
          "VIF(variance inflation factor)가 10을 넘는 변수는 다중공선성(multicollinearity)이 의심된다",
          "AIC가 더 큰 모형이 더 좋은 모형이다",
          "F-statistic의 p값(Prob (F-statistic))은 모든 기울기 계수가 0이라는 귀무가설을 검정한다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[aic-bic|AIC/BIC]]는 적합도에 모수 개수 벌점을 더한 정보량 기준으로, **작을수록** 좋은 모형이다. '크면 좋다'는 R²와 혼동한 설명이다.",
          "",
          "- ① 옳다. [[durbin-watson|Durbin-Watson]]은 0~4 범위이고 2 근처면 자기상관 없음, 0에 가까우면 양의 자기상관.",
          "- ② 옳다. [[vif|VIF]] = 1/(1−R²ᵢ)로 계산하며 10(보수적으로 5) 이상이면 [[multicollinearity|다중공선성]]을 의심한다.",
          "- ④ 옳다. [[f-statistic|F 검정]]은 절편만 있는 모형 대비 전체 모형의 유의성, 즉 '모든 기울기 = 0'을 검정한다.",
          "",
          "시험에서는 summary 하단 지표(Durbin-Watson, Jarque-Bera, Cond. No.)의 의미와 AIC/BIC의 방향(작을수록 좋음)을 섞어 묻는다."
        ],
        terms: ["aic-bic", "durbin-watson", "vif", "f-statistic"]
      },
      {
        id: "a-3-5-q08", node: "a-3-5", type: "ox", kind: "concept", difficulty: 1,
        prompt: "같은 데이터와 모형에서 수정 결정계수(Adj. R²)는 결정계수(R²)보다 클 수 없다.",
        answer: true,
        explanation: [
          "**정답: O** [[adjusted-r-squared|Adj. R²]] = 1 − (1 − R²)(n − 1)/(n − p − 1)이고, 설명변수가 1개 이상이면 (n − 1)/(n − p − 1) ≥ 1이므로 항상 [[r-squared|R²]] 이하다.",
          "변수를 추가하면 R²는 절대 내려가지 않지만 Adj. R²는 변수가 쓸모없으면 내려간다. 그래서 모형 비교에는 Adj. R²를 쓴다.",
          "",
          "시험에서는 \"변수를 추가했는데 R²는 올랐고 Adj. R²는 내렸다 — 해석은?\"(추가 변수가 설명력에 기여하지 않음)으로 나온다."
        ],
        terms: ["adjusted-r-squared", "r-squared"]
      },
      {
        id: "a-3-5-q09", node: "a-3-5", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`smf.logit('y ~ x', data=df).fit().params['x']`의 값은 `x`가 1단위 증가할 때의 오즈비(odds ratio)이다.",
        answer: false,
        explanation: [
          "**정답: X** [[logistic-regression|로지스틱 회귀]]의 계수는 **로그 오즈(log-odds)** 의 변화량이다. [[odds-ratio|오즈비(odds ratio)]]는 `np.exp(params['x'])`로 지수 변환해야 얻는다.",
          "예를 들어 계수가 0.6931이면 오즈비는 exp(0.6931) ≈ 2.0, 즉 x가 1 늘면 성공 오즈가 2배가 된다. 계수가 0이면 오즈비 1(영향 없음).",
          "",
          "시험에서는 Logit summary의 `coef`를 주고 \"오즈비는?\"을 묻거나, 오즈비 신뢰구간이 1을 포함하는지(= 계수 신뢰구간이 0을 포함하는지)를 묻는다."
        ],
        terms: ["odds-ratio", "logistic-regression"]
      },
      {
        id: "a-3-5-q10", node: "a-3-5", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 함수 이름을 쓰시오. statsmodels 배열 API에서 절편 추정을 위해 상수 컬럼을 추가한다: `X = sm.____(X)`",
        answer: "add_constant",
        accept: ["add_constant()", "sm.add_constant"],
        explanation: [
          "**정답: add_constant** `sm.add_constant(X)`는 값이 1인 `const` 컬럼을 맨 앞에 붙여 [[intercept|절편(intercept)]]을 추정할 수 있게 한다. 이미 상수 컬럼이 있으면 기본값(`has_constant='skip'`)에 따라 추가하지 않는다.",
          "[[formula-api|수식 API]](`smf.ols`)는 `Intercept`를 자동으로 넣으므로 이 함수가 필요 없다.",
          "",
          "시험에서는 배열 API 코드에서 빠진 한 줄로 가장 자주 나오는 함수다."
        ],
        terms: ["intercept"]
      },
      {
        id: "a-3-5-q11", node: "a-3-5", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import numpy as np",
          "import statsmodels.api as sm",
          "x = np.array([0, 1, 2, 3])",
          "y = 3 * x + 2",
          "res = sm.OLS(y, sm.add_constant(x)).fit()",
          "print(round(res.params[1], 1))"
        ],
        lang: "python",
        answer: "3.0",
        accept: ["3"],
        explanation: [
          "**정답: 3.0** 데이터가 정확히 y = 2 + 3x 직선 위에 있으므로 [[ols|OLS]]는 잔차 0으로 적합된다. `params[0]`은 [[intercept|절편]] 2.0, `params[1]`은 기울기 3.0이다.",
          "`add_constant`가 상수 열을 **앞에** 두기 때문에 인덱스 1이 기울기다. ndarray를 넣었으므로 `params`도 ndarray라 정수 인덱싱이 가능하다.",
          "",
          "시험에서는 작은 완전 선형 데이터로 계수 순서(const → x)를 확인하는 출력 문제가 나온다."
        ],
        terms: ["ols", "intercept"]
      },
      {
        id: "a-3-5-q12", node: "a-3-5", type: "short", kind: "concept", difficulty: 3,
        prompt: "`statsmodels.stats.outliers_influence` 모듈에서 설명변수별 다중공선성(multicollinearity) 지표를 계산하는 함수 이름을 쓰시오.",
        answer: "variance_inflation_factor",
        accept: ["variance_inflation_factor()", "vif"],
        explanation: [
          "**정답: variance_inflation_factor** [[vif|VIF(분산팽창계수)]]는 `variance_inflation_factor(exog.values, i)`처럼 설계행렬과 **컬럼 위치 정수**를 받아 변수 하나의 VIF를 돌려준다. 전체는 리스트 컴프리헨션으로 돈다.",
          "VIFᵢ = 1/(1 − Rᵢ²)이며 Rᵢ²는 i번째 변수를 나머지 변수로 회귀한 결정계수다. 10 이상이면 [[multicollinearity|다중공선성]]이 심하다고 본다.",
          "",
          "시험에서는 함수가 속한 모듈 경로와 두 번째 인자가 컬럼 이름이 아닌 **정수 인덱스**라는 점이 나온다."
        ],
        terms: ["vif", "multicollinearity"]
      },

      /* ────────────────────────────────────────────────────────
         a-3-6 Scipy (12)
         ──────────────────────────────────────────────────────── */
      {
        id: "a-3-6-q01", node: "a-3-6", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`scipy.stats.norm.cdf(1.96)`이 약 0.975를 돌려준다. `cdf`가 계산하는 것으로 옳은 것은?",
        choices: [
          "X = 1.96에서의 확률밀도 f(1.96)",
          "누적확률 P(X ≤ 1.96)",
          "상위 꼬리 확률 P(X > 1.96)",
          "누적확률 0.975에 해당하는 분위수(quantile)"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[cdf|누적분포함수(CDF, cumulative distribution function)]]는 P(X ≤ x)다. 표준정규분포에서 1.96 이하의 확률이 0.975.",
          "",
          "- ① 확률밀도는 `pdf(1.96)` ≈ 0.058이다.",
          "- ③ 상위 꼬리 P(X > x)는 [[survival-function|생존함수]] `sf(1.96)` ≈ 0.025 = 1 − cdf.",
          "- ④ 확률 → 값의 방향은 [[ppf|`ppf(0.975)`]] = 1.96이다. cdf의 역함수.",
          "",
          "시험에서는 pdf/cdf/sf/ppf 네 메서드를 섞어 \"1.96과 0.975를 연결하는 메서드는?\" 식으로 나온다."
        ],
        terms: ["cdf", "ppf", "survival-function"]
      },
      {
        id: "a-3-6-q02", node: "a-3-6", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "from scipy import stats",
          "print(round(stats.norm.ppf(0.975), 2))"
        ],
        lang: "python",
        choices: ["0.98", "1.64", "1.96", "2.58"],
        answer: 2,
        explanation: [
          "**정답: ③** [[ppf|ppf(percent point function)]]는 [[cdf|cdf]]의 역함수다. 표준정규분포에서 누적확률 0.975에 해당하는 값은 1.96 — 양측 5% 검정의 임계값이자 95% [[confidence-interval|신뢰구간]]의 계수다.",
          "",
          "- ① 0.98은 `cdf(2.05)` 정도의 확률값이지 분위수가 아니다.",
          "- ② 1.64(정확히 1.645)는 `ppf(0.95)` — 단측 5% 임계값이다.",
          "- ④ 2.58은 `ppf(0.995)` — 양측 1% 임계값이다.",
          "",
          "시험에서는 1.645(단측 5%), 1.96(양측 5%), 2.576(양측 1%) 세 값을 `ppf` 인자와 연결해 묻는다."
        ],
        terms: ["ppf", "probability-distribution"]
      },
      {
        id: "a-3-6-q03", node: "a-3-6", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "두 독립 집단의 평균을 비교하는데 등분산(homogeneity of variance) 가정이 성립하지 않는다. 올바른 호출은?",
        choices: [
          "`stats.ttest_ind(a, b, equal_var=False)`",
          "`stats.ttest_rel(a, b)`",
          "`stats.ttest_1samp(a, b.mean())`",
          "`stats.ttest_ind(a, b, alternative='two-sided')`"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** `equal_var=False`는 [[welch-t-test|Welch t 검정]]으로, 두 집단의 분산이 다를 때 자유도를 보정한다. 기본값 `equal_var=True`는 Student t 검정(합동 분산).",
          "",
          "- ② `ttest_rel`은 **대응(paired)** 표본용이다. 같은 대상의 전후 측정처럼 짝이 있어야 하고 길이도 같아야 한다.",
          "- ③ `ttest_1samp`는 한 집단 평균을 **알려진 모평균**과 비교한다. b의 표본평균을 모평균처럼 넣는 것은 b의 변동을 무시한 잘못된 분석이다.",
          "- ④ `alternative`는 단측/양측 선택 인자이고 기본값이 `'two-sided'`다. 등분산 문제를 해결하지 않는다.",
          "",
          "시험에서는 `levene` 결과 p < 0.05 → \"다음에 호출할 함수와 인자는?\"으로 이어 나온다."
        ],
        terms: ["welch-t-test", "levene-test"]
      },
      {
        id: "a-3-6-q04", node: "a-3-6", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "from scipy import stats",
          "table = [[10, 20, 30],",
          "         [20, 20, 20]]",
          "chi2, p, dof, expected = stats.chi2_contingency(table)",
          "print(dof, expected[0].tolist())"
        ],
        lang: "python",
        choices: ["6 [10.0, 20.0, 30.0]", "2 [15.0, 20.0, 25.0]", "5 [15.0, 20.0, 25.0]", "2 [20.0, 20.0, 20.0]"],
        answer: 1,
        explanation: [
          "**정답: ②** [[chi-square-test|카이제곱 독립성 검정]]의 자유도는 (행 − 1)(열 − 1) = 1 × 2 = 2. 기대빈도 = 행합 × 열합 / 전체이고, 1행 합 60, 열합 30/40/50, 전체 120이므로 60×30/120 = 15, 60×40/120 = 20, 60×50/120 = 25.",
          "",
          "- ① 자유도 6은 행×열(2×3)로 잘못 계산한 값이고, 기대빈도는 관측빈도 그대로가 아니다.",
          "- ③ 자유도 5는 셀 수 − 1로 계산한 오류다.",
          "- ④ 기대빈도는 열합 비율(30:40:50)을 따르므로 모두 20이 되지 않는다. 2행의 관측값과 혼동한 것.",
          "",
          "시험에서는 `chi2_contingency` 반환 4개의 **순서**(statistic, pvalue, dof, expected)와 자유도 공식을 함께 묻는다."
        ],
        terms: ["chi-square-test"]
      },
      {
        id: "a-3-6-q05", node: "a-3-6", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "두 집단 이상의 분산 동질성(등분산성, homogeneity of variance)을 검정하는 `scipy.stats` 함수는?",
        choices: ["`shapiro`", "`mannwhitneyu`", "`kruskal`", "`levene`"],
        answer: 3,
        explanation: [
          "**정답: ④** [[levene-test|Levene 검정]]은 집단 간 분산이 같은지 검정한다(p < 0.05면 등분산 기각). 정규성에 덜 민감해 `bartlett`보다 널리 쓰인다.",
          "",
          "- ① `shapiro`는 [[normality-test|정규성 검정(Shapiro-Wilk)]]이다. 분산을 비교하지 않는다.",
          "- ② `mannwhitneyu`는 독립 2표본의 분포(중앙값) 차이를 보는 [[nonparametric-test|비모수 검정]]이다.",
          "- ③ `kruskal`은 3집단 이상의 비모수 분산분석(Kruskal-Wallis)이다. 이름에 '분산'이 들어가지만 평균(순위) 비교다.",
          "",
          "시험에서는 t 검정·ANOVA 전 가정 확인 절차(정규성 → shapiro, 등분산 → levene/bartlett)로 나온다."
        ],
        terms: ["levene-test", "normality-test"]
      },
      {
        id: "a-3-6-q06", node: "a-3-6", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "표본 `x`의 평균이 50과 다른지 검정하려는 다음 코드를 실행하면 어떻게 되는가?",
        code: [
          "from scipy import stats",
          "x = [48, 52, 51, 49, 53, 47]",
          "res = stats.ttest_1samp(x)",
          "print(res.pvalue < 0.05)"
        ],
        lang: "python",
        choices: [
          "`False`가 출력된다",
          "`True`가 출력된다",
          "`TypeError` — 필수 인자 `popmean`이 빠졌다",
          "`ValueError` — 표본 크기가 너무 작다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `ttest_1samp(a, popmean)`에서 비교 대상 모평균 `popmean`은 **필수 위치 인자**다. 생략하면 `TypeError: ttest_1samp() missing 1 required positional argument: 'popmean'`.",
          "",
          "- ①·② 실행 자체가 되지 않으므로 어떤 불리언도 출력되지 않는다. `popmean=50`을 넣으면 평균 50과 거의 같아 `False`가 나온다.",
          "- ④ 표본 6개로도 [[t-test|t 검정]]은 계산된다. 크기 때문에 ValueError가 나지는 않는다.",
          "",
          "시험에서는 `ttest_1samp`의 둘째 인자(popmean)와 `ttest_ind`의 둘째 인자(두 번째 표본)를 구분하는 코드 문제로 나온다."
        ],
        terms: ["t-test"]
      },
      {
        id: "a-3-6-q07", node: "a-3-6", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "모수 검정과 그에 대응하는 비모수(nonparametric) 검정의 짝으로 **옳지 않은** 것은?",
        choices: [
          "대응표본 t 검정 `ttest_rel` ↔ `mannwhitneyu`",
          "독립 2표본 t 검정 `ttest_ind` ↔ `mannwhitneyu`",
          "일원분산분석 `f_oneway` ↔ `kruskal`",
          "피어슨 상관 `pearsonr` ↔ `spearmanr`"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 대응(짝지은) 표본의 비모수 대응은 [[wilcoxon|Wilcoxon 부호순위 검정 `wilcoxon`]]이다. [[mann-whitney-u|`mannwhitneyu`]]는 **독립** 2표본용이라 짝 정보를 버린다.",
          "",
          "- ② 옳다. 독립 2표본의 [[nonparametric-test|비모수 검정]]은 Mann-Whitney U.",
          "- ③ 옳다. 3집단 이상 비모수 비교는 [[kruskal-wallis|Kruskal-Wallis]] H 검정.",
          "- ④ 옳다. [[spearman|Spearman]]은 순위 상관이라 정규성·선형성 가정이 없다.",
          "",
          "시험에서는 \"정규성이 기각된 전후 비교 데이터에 쓸 함수는?\"(wilcoxon) 또는 짝 표를 주고 틀린 것을 고르게 한다."
        ],
        terms: ["wilcoxon", "mann-whitney-u", "kruskal-wallis", "nonparametric-test"]
      },
      {
        id: "a-3-6-q08", node: "a-3-6", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`stats.ttest_ind(a, b)`는 인자를 따로 주지 않으면 두 집단의 분산이 같다고 가정하는 Student t 검정을 수행한다.",
        answer: true,
        explanation: [
          "**정답: O** `ttest_ind`의 기본값은 `equal_var=True`로, 두 표본의 분산을 합동(pooled)하여 자유도 n₁ + n₂ − 2의 Student [[t-test|t 검정]]을 한다.",
          "분산이 다르다고 판단되면(`levene` p < 0.05) `equal_var=False`로 [[welch-t-test|Welch t 검정]]을 써야 한다. 또한 `alternative`의 기본값은 `'two-sided'`다.",
          "",
          "시험에서는 기본 인자값(equal_var=True, alternative='two-sided')을 전제로 결과를 해석하게 한다."
        ],
        terms: ["t-test", "welch-t-test"]
      },
      {
        id: "a-3-6-q09", node: "a-3-6", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`stats.norm.sf(x)`는 P(X ≤ x), 즉 누적확률을 돌려준다.",
        answer: false,
        explanation: [
          "**정답: X** `sf`는 [[survival-function|생존함수(survival function)]]로 P(X > x) = 1 − [[cdf|cdf]](x)다. 상위 꼬리 확률이므로 단측 p값 계산에 바로 쓴다(`norm.sf(abs(z)) * 2`가 양측 p값).",
          "P(X ≤ x)는 `cdf(x)`다. 예: `norm.cdf(1.96)` = 0.975, `norm.sf(1.96)` = 0.025.",
          "",
          "시험에서는 z 통계량에서 p값을 구하는 코드(`2 * norm.sf(abs(z))` 또는 `2 * (1 - norm.cdf(abs(z)))`)의 동치 여부를 묻는다."
        ],
        terms: ["survival-function", "cdf"]
      },
      {
        id: "a-3-6-q10", node: "a-3-6", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 인자 이름을 쓰시오. 등분산을 가정하지 않는 Welch t 검정: `stats.ttest_ind(a, b, ____=False)`",
        answer: "equal_var",
        accept: ["equal_var=False"],
        explanation: [
          "**정답: equal_var** `equal_var=False`를 주면 두 집단의 분산이 다르다고 보고 Welch-Satterthwaite 자유도를 쓰는 [[welch-t-test|Welch t 검정]]이 된다. 기본값은 `True`(Student).",
          "결과 객체의 `df` 속성에서 보정된(정수가 아닌) 자유도를 확인할 수 있다.",
          "",
          "시험에서는 [[levene-test|Levene 검정]] 결과와 묶어 \"이 상황에서 바꿔야 할 인자는?\"으로 나온다."
        ],
        terms: ["welch-t-test"]
      },
      {
        id: "a-3-6-q11", node: "a-3-6", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "from scipy import stats",
          "print(round(stats.binom.pmf(2, 4, 0.5), 3))"
        ],
        lang: "python",
        answer: "0.375",
        accept: [".375"],
        explanation: [
          "**정답: 0.375** 이항분포 B(n=4, p=0.5)에서 성공 2회의 확률은 C(4,2)·0.5²·0.5² = 6/16 = 0.375. 이산분포이므로 `pdf`가 아니라 [[pmf|확률질량함수 `pmf`]]를 쓴다.",
          "인자 순서는 `pmf(k, n, p)` — 첫 인자가 성공 횟수 k다. `binom.cdf(2, 4, 0.5)`는 P(X ≤ 2) = 11/16 = 0.6875로 다른 값이다.",
          "",
          "시험에서는 [[probability-distribution|분포 객체]]의 인자 순서(`binom(n, p)`, `poisson(mu)`)와 pmf/cdf 구분을 작은 숫자로 확인한다."
        ],
        terms: ["pmf", "probability-distribution"]
      },
      {
        id: "a-3-6-q12", node: "a-3-6", type: "short", kind: "concept", difficulty: 3,
        prompt: "`scipy.optimize`에서 사용자 정의 함수 `f(x, a, b)`의 모수 `a`, `b`를 데이터 `(x, y)`에 비선형 최소제곱으로 적합하여 `(popt, pcov)`를 돌려주는 함수 이름을 쓰시오.",
        answer: "curve_fit",
        accept: ["curve_fit()", "optimize.curve_fit", "scipy.optimize.curve_fit"],
        explanation: [
          "**정답: curve_fit** [[curve-fit|`curve_fit(f, xdata, ydata, p0=...)`]]는 모형 함수의 첫 인자를 독립변수로, 나머지를 추정할 모수로 보고 잔차 제곱합을 최소화한다. 반환은 최적 모수 `popt`와 공분산행렬 `pcov`(대각의 제곱근이 표준오차).",
          "`scipy.optimize.minimize(fun, x0)`는 임의의 스칼라 목적함수를 최소화하는 범용 함수로, 손실 함수를 직접 쓸 때 사용한다.",
          "",
          "시험에서는 `popt, pcov = curve_fit(...)` 언패킹 형태나 `p0`(초기값)의 역할로 나온다."
        ],
        terms: ["curve-fit", "least-squares"]
      },

      /* ────────────────────────────────────────────────────────
         a-3-7 특수 라이브러리 및 수동 구현 (12)
         ──────────────────────────────────────────────────────── */
      {
        id: "a-3-7-q01", node: "a-3-7", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`np.var(x)`를 인자 없이 호출했을 때 계산되는 것은?",
        choices: [
          "편차 제곱합을 n으로 나눈 모분산(population variance, ddof=0)",
          "편차 제곱합을 n−1로 나눈 표본분산(sample variance, ddof=1)",
          "표준편차(standard deviation)",
          "표준오차(standard error)"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** numpy의 `var`/`std`는 기본 [[ddof|ddof=0]]이라 분모가 n인 모분산이다. 표본분산을 원하면 `np.var(x, ddof=1)`.",
          "",
          "- ② 분모 n−1은 `ddof=1`을 명시해야 한다. 반대로 pandas `Series.var()`는 기본이 ddof=1이다.",
          "- ③ 표준편차는 `np.std`로, 분산의 제곱근이다.",
          "- ④ [[standard-error|표준오차]]는 표준편차를 √n으로 나눈 값으로 numpy 기본 함수가 없다(`scipy.stats.sem`).",
          "",
          "시험에서는 \"numpy와 pandas의 분산 결과가 다른 이유\"나 [[sample-variance|표본분산]] 손계산 문제로 나온다."
        ],
        terms: ["ddof", "sample-variance"]
      },
      {
        id: "a-3-7-q02", node: "a-3-7", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "import numpy as np",
          "x = np.array([1, 2, 3, 4])",
          "print(round(np.var(x, ddof=1), 4))"
        ],
        lang: "python",
        choices: ["1.25", "1.6667", "1.5", "2.0"],
        answer: 1,
        explanation: [
          "**정답: ②** 평균 2.5, 편차 제곱합 = 2.25 + 0.25 + 0.25 + 2.25 = 5. [[ddof|ddof=1]]이므로 분모 n − 1 = 3 → 5/3 = 1.6667 ([[sample-variance|표본분산]]).",
          "",
          "- ① 1.25는 분모 n = 4로 나눈 모분산(`np.var(x)` 기본값).",
          "- ③ 1.5는 범위(max − min = 3)를 2로 나눈 값으로, 분산 공식과 무관하다.",
          "- ④ 2.0은 편차 절댓값의 합(1.5 + 0.5 + 0.5 + 1.5 = 4)을 2로 나눈 꼴로, 어떤 분산 정의에도 해당하지 않는다.",
          "",
          "시험에서는 작은 배열로 ddof=0과 ddof=1의 값을 둘 다 보기로 넣어 구분하게 한다."
        ],
        terms: ["sample-variance", "ddof"]
      },
      {
        id: "a-3-7-q03", node: "a-3-7", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "import numpy as np",
          "y_true = np.array([1, 1, 1, 1, 0, 0])",
          "y_pred = np.array([1, 1, 0, 0, 0, 0])",
          "tp = np.sum((y_true == 1) & (y_pred == 1))",
          "fn = np.sum((y_true == 1) & (y_pred == 0))",
          "print(tp / (tp + fn))"
        ],
        lang: "python",
        choices: ["1.0", "0.6666666666666666", "0.5", "0.3333333333333333"],
        answer: 2,
        explanation: [
          "**정답: ③** TP(실제 1·예측 1) = 2, FN(실제 1·예측 0) = 2. `tp / (tp + fn)` = 2/4 = 0.5는 [[recall|재현율(recall)]] — 실제 양성 중 찾아낸 비율이다.",
          "",
          "- ① 1.0은 [[precision|정밀도(precision)]] TP/(TP+FP) = 2/(2+0)다. 분모를 혼동한 값.",
          "- ② 0.667은 정확도(accuracy) (TP+TN)/전체 = (2+2)/6이다.",
          "- ④ 0.333은 FN/전체 = 2/6으로 지표가 아니다.",
          "",
          "시험에서는 [[confusion-matrix|혼동행렬]]을 불리언 마스크로 세는 코드를 주고 분모가 무엇인지로 정밀도·재현율을 구분하게 한다."
        ],
        terms: ["recall", "precision", "confusion-matrix"]
      },
      {
        id: "a-3-7-q04", node: "a-3-7", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "XGBoost·LightGBM 같은 그래디언트 부스팅(gradient boosting) 모델의 `learning_rate`(eta)에 대한 설명으로 옳은 것은?",
        choices: [
          "한 트리의 최대 깊이를 제한한다",
          "각 반복에서 사용할 샘플의 비율이다",
          "리프 노드의 최소 샘플 수다",
          "각 트리의 기여도를 축소(shrinkage)하여 과적합을 억제하며, 작을수록 더 많은 트리가 필요하다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[learning-rate|학습률(learning rate)]]은 새 트리의 예측을 더할 때 곱하는 축소 계수다. 작게 두면 한 번에 조금씩 보정해 일반화가 좋아지지만 `n_estimators`를 늘려야 한다.",
          "",
          "- ① 트리 깊이는 `max_depth`([[xgboost|XGBoost]]), LightGBM은 `num_leaves`가 핵심이다.",
          "- ② 샘플 비율은 `subsample`, 피처 비율은 `colsample_bytree`다.",
          "- ③ 리프 최소 샘플 수는 `min_child_weight`(XGBoost) / `min_child_samples`(LightGBM)다.",
          "",
          "시험에서는 설치 환경을 가정할 수 없어 코드 실행 대신 핵심 파라미터의 **역할 매칭** 문제로 나온다."
        ],
        terms: ["learning-rate", "xgboost"]
      },
      {
        id: "a-3-7-q05", node: "a-3-7", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력으로 옳은 것은?",
        code: [
          "import numpy as np",
          "x = np.array([2, 4, 6])",
          "z = (x - x.mean()) / x.std()",
          "print(np.round(z, 4).tolist())"
        ],
        lang: "python",
        choices: ["[-1.2247, 0.0, 1.2247]", "[-1.0, 0.0, 1.0]", "[0.0, 0.5, 1.0]", "[-2.0, 0.0, 2.0]"],
        answer: 0,
        explanation: [
          "**정답: ①** 평균 4, 편차 [−2, 0, 2]. `x.std()`는 [[ddof|ddof=0]]이라 √(8/3) ≈ 1.633. [[z-score|z 점수]] = 편차/1.633 → ±1.2247.",
          "",
          "- ② `x.std(ddof=1)` = √(8/2) = 2를 썼을 때의 결과다. 기본값이 아니다.",
          "- ③ `[0.0, 0.5, 1.0]`은 [[min-max-scaling|min-max 스케일링]] (x − min)/(max − min)의 결과.",
          "- ④ 편차를 표준편차로 나누지 않고 그대로 둔 값이다.",
          "",
          "시험에서는 [[standardization|표준화]]와 min-max의 결과 모양, 그리고 ddof 기본값에 따른 값 차이를 묻는다."
        ],
        terms: ["z-score", "standardization", "ddof"]
      },
      {
        id: "a-3-7-q06", node: "a-3-7", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "RMSE를 직접 계산하는 다음 코드에서 잘못된 줄은?",
        code: [
          "import numpy as np",
          "y = np.array([1, 2, 3])",
          "y_hat = np.array([2, 2, 5])",
          "mse = np.mean(y - y_hat) ** 2        # (A)",
          "rmse = np.sqrt(mse)                  # (B)",
          "print(round(rmse, 4))"
        ],
        lang: "python",
        choices: [
          "(B) — 제곱근은 `np.sqrt`가 아니라 `np.square`를 써야 한다",
          "(A) — 잔차의 평균을 제곱했다. `np.mean((y - y_hat) ** 2)`처럼 제곱을 평균 안에서 해야 한다",
          "(A) — `y - y_hat`이 아니라 `y_hat - y`여야 한다",
          "오류 없다. 1.291이 출력된다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** 현재 (A)는 `mean(잔차)²` = (−1)² = 1.0을 계산해 RMSE 1.0이 나온다. 올바른 MSE는 `np.mean((y - y_hat) ** 2)` = (1 + 0 + 4)/3 = 1.667이고 [[rmse|RMSE]] = √1.667 ≈ 1.291이다.",
          "",
          "- ① `np.sqrt`가 맞다. `np.square`는 제곱이다.",
          "- ③ 차이의 부호는 제곱하면 사라지므로 순서는 결과에 영향이 없다.",
          "- ④ 1.291은 **고친** 코드의 출력이다. 현재 코드는 1.0을 출력한다.",
          "",
          "시험에서는 [[mse|MSE]]·RMSE·[[mae|MAE]] 수식을 코드로 옮긴 것 중 괄호 위치가 틀린 줄을 찾는 문제로 나온다."
        ],
        terms: ["rmse", "mse", "mae"]
      },
      {
        id: "a-3-7-q07", node: "a-3-7", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "imbalanced-learn의 SMOTE(Synthetic Minority Over-sampling Technique)에 대한 설명으로 옳은 것은?",
        choices: [
          "다수 클래스 샘플을 무작위로 제거하여 균형을 맞춘다",
          "소수 클래스 샘플을 단순 복제(duplicate)하여 늘린다",
          "소수 클래스 샘플과 그 k-최근접 이웃 사이를 보간(interpolation)해 새 합성 샘플을 만들며, 훈련 데이터에만 적용해야 한다",
          "훈련·테스트 데이터를 합친 뒤 적용해야 분포가 일치한다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[smote|SMOTE]]는 소수 클래스 점과 이웃 점을 잇는 선분 위에 새 점을 생성하는 오버샘플링이다. `fit_resample(X_train, y_train)`처럼 **분할 후 훈련 세트에만** 적용해야 테스트 누수(leakage)가 없다.",
          "",
          "- ① 다수 클래스 제거는 언더샘플링(`RandomUnderSampler`)이다.",
          "- ② 단순 복제는 `RandomOverSampler`다. SMOTE는 새로운 점을 합성한다.",
          "- ④ 테스트 데이터에 합성 샘플이 섞이면 평가가 낙관적으로 왜곡된다. 전체에 적용하면 안 된다.",
          "",
          "시험에서는 [[class-imbalance|클래스 불균형]] 처리 기법(오버/언더샘플링, `class_weight`)과 SMOTE 적용 시점을 개념으로 묻는다."
        ],
        terms: ["smote", "class-imbalance"]
      },
      {
        id: "a-3-7-q08", node: "a-3-7", type: "ox", kind: "concept", difficulty: 1,
        prompt: "같은 데이터에 대해 `np.std(x)`와 `pd.Series(x).std()`는 기본 인자에서 서로 다른 값을 돌려준다.",
        answer: true,
        explanation: [
          "**정답: O** numpy `std`의 기본은 [[ddof|ddof=0]](분모 n), pandas `Series.std()`의 기본은 ddof=1(분모 n − 1)이다. 그래서 같은 배열이라도 pandas 값이 약간 더 크다.",
          "둘을 맞추려면 `np.std(x, ddof=1)` 또는 `s.std(ddof=0)`으로 명시한다. [[sample-variance|표본분산]]·표본표준편차는 ddof=1이 표준이다.",
          "",
          "시험에서는 \"두 결과가 다른 이유\" 또는 \"표본표준편차를 구하는 numpy 코드\"로 나온다."
        ],
        terms: ["ddof", "sample-variance"]
      },
      {
        id: "a-3-7-q09", node: "a-3-7", type: "ox", kind: "concept", difficulty: 2,
        prompt: "코사인 유사도(cosine similarity)는 두 벡터의 크기(길이)가 달라도 방향이 같으면 1이다.",
        answer: true,
        explanation: [
          "**정답: O** [[cosine-similarity|코사인 유사도]] = a·b / (‖a‖‖b‖)는 두 벡터 사이 각도의 코사인이라 크기에 무관하다. (1, 2)와 (2, 4)는 방향이 같아 유사도 1이다.",
          "반면 [[euclidean-distance|유클리드 거리]]는 두 점 사이의 실제 거리라 크기 차이가 그대로 반영된다((1,2)와 (2,4)의 거리 = √5). 문서 벡터처럼 길이가 의미 없는 데이터에 코사인을 쓰는 이유다.",
          "",
          "시험에서는 유클리드·[[manhattan-distance|맨해튼]]·코사인 세 척도의 수식과 '크기 영향 여부'를 묻는다."
        ],
        terms: ["cosine-similarity", "euclidean-distance"]
      },
      {
        id: "a-3-7-q10", node: "a-3-7", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 함수 이름을 쓰시오. 설계행렬 `X`와 벡터 `y`의 최소제곱(least squares) 해를 구한다: `beta = np.linalg.____(X, y, rcond=None)[0]`",
        answer: "lstsq",
        accept: ["lstsq()", "np.linalg.lstsq", "linalg.lstsq"],
        explanation: [
          "**정답: lstsq** `np.linalg.lstsq(X, y, rcond=None)`는 ‖Xβ − y‖²를 최소화하는 [[least-squares|최소제곱]] 해를 돌려준다. 반환은 (해, 잔차합, 랭크, 특이값) 4개라 `[0]`으로 해만 꺼낸다.",
          "정규방정식 `np.linalg.inv(X.T @ X) @ X.T @ y`와 같은 값이지만 역행렬을 직접 구하지 않아 수치적으로 안정적이다. 절편을 원하면 X에 1로 채운 열을 먼저 붙인다.",
          "",
          "시험에서는 `lstsq`와 `solve`(정방행렬 전용)를 구분하거나 `rcond=None`을 넣는 이유(경고 억제)를 묻는다."
        ],
        terms: ["least-squares", "normal-equation"]
      },
      {
        id: "a-3-7-q11", node: "a-3-7", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import numpy as np",
          "y = np.array([1, 2, 3])",
          "y_hat = np.array([2, 2, 5])",
          "print(round(np.mean(np.abs(y - y_hat)), 2))"
        ],
        lang: "python",
        answer: "1.0",
        accept: ["1"],
        explanation: [
          "**정답: 1.0** 잔차 y − ŷ = [−1, 0, −2], 절댓값 [1, 0, 2], 평균 3/3 = 1.0. 이것이 [[mae|평균절대오차(MAE)]]다.",
          "같은 데이터의 [[mse|MSE]]는 (1 + 0 + 4)/3 = 1.667, [[rmse|RMSE]] = 1.291이다. MAE는 이상치에 덜 민감하고 단위가 y와 같다.",
          "",
          "시험에서는 MAE·MSE·RMSE를 같은 작은 배열로 계산해 값을 비교하거나, `np.abs`가 빠진 코드가 왜 틀렸는지 묻는다."
        ],
        terms: ["mae", "rmse"]
      },
      {
        id: "a-3-7-q12", node: "a-3-7", type: "short", kind: "concept", difficulty: 3,
        prompt: "LightGBM에서 트리 하나가 가질 수 있는 리프(leaf) 노드의 최대 개수를 지정하는 핵심 파라미터 이름을 쓰시오.",
        answer: "num_leaves",
        accept: ["num_leaves=", "numleaves"],
        explanation: [
          "**정답: num_leaves** LightGBM은 leaf-wise(리프 중심) 성장 방식이라 깊이보다 **리프 개수**로 복잡도를 제어한다. 기본값 31이며 크면 과적합(overfitting) 위험이 커진다. `max_depth`와 함께 쓸 때는 `num_leaves ≤ 2^max_depth`가 권장된다.",
          "[[xgboost|XGBoost]]는 level-wise 성장이라 `max_depth`가 핵심이다. 두 라이브러리 모두 [[learning-rate|`learning_rate`]], `n_estimators`, `subsample`, `colsample_bytree`를 공유한다.",
          "",
          "시험에서는 설치를 가정하지 않고 라이브러리별 대표 파라미터(XGBoost `max_depth`/`eta`, LightGBM `num_leaves`)를 개념으로 묻는다."
        ],
        terms: ["xgboost", "learning-rate"]
      }
    ],

    /* ────────────────────────────────────────────────────────
       실습 과제 (6)
       ──────────────────────────────────────────────────────── */
    practices: [
      {
        id: "a-3-5-p01", node: "a-3-5",
        title: "OLS 기울기 계수 읽기",
        difficulty: 1,
        task: [
          "`x`로 `y`를 설명하는 단순 선형회귀를 statsmodels OLS로 적합하시오(절편 포함). `x`의 **기울기 계수(coef)** 를 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "import statsmodels.api as sm",
          "rng = np.random.default_rng(35001)",
          "x = rng.uniform(0, 10, size=80)",
          "y = 2 + 3 * x + rng.normal(0, 2, size=80)",
          "df = pd.DataFrame({'x': x, 'y': y})",
          "df.head()"
        ],
        hint: ["`sm.add_constant(df['x'])`로 상수 열을 붙인 뒤 `sm.OLS(df['y'], X).fit()`. 기울기는 `params['x']`."],
        answer: { type: "number", value: 2.945, decimals: 3 },
        solution: [
          "X = sm.add_constant(df['x'])",
          "res = sm.OLS(df['y'], X).fit()",
          "round(float(res.params['x']), 3)"
        ],
        explanation: [
          "[[ols|OLS]] 적합의 첫 단계는 [[intercept|절편]]용 상수 열 추가다. `params`는 `const`, `x` 두 원소를 가진 Series이며 `x`의 값이 기울기다. 생성 과정의 참값 3에 가까운 값이 나온다.",
          "`res.summary()`를 출력하면 같은 값이 `coef` 열에, 표준오차·t·P>|t|·95% 신뢰구간이 옆 열에 나온다."
        ],
        terms: ["ols", "intercept"],
        verified: { by: "python", at: "2026-10-04", env: "statsmodels 0.15.0 / numpy 2.4.6 / pandas 3.0.6" }
      },
      {
        id: "a-3-5-p02", node: "a-3-5",
        title: "로지스틱 회귀의 오즈비",
        difficulty: 2,
        task: [
          "수식 API로 `y ~ x1 + x2` 로지스틱 회귀(Logit)를 적합하고, `x1`의 **오즈비(odds ratio)** 를 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "import statsmodels.formula.api as smf",
          "rng = np.random.default_rng(35002)",
          "n = 300",
          "x1 = rng.normal(0, 1, size=n)",
          "x2 = rng.normal(0, 1, size=n)",
          "p = 1 / (1 + np.exp(-(-0.5 + 0.8 * x1 - 0.4 * x2)))",
          "y = rng.binomial(1, p)",
          "df = pd.DataFrame({'y': y, 'x1': x1, 'x2': x2})",
          "df.head()"
        ],
        hint: ["`smf.logit('y ~ x1 + x2', data=df).fit(disp=0)` 뒤 `np.exp(res.params['x1'])`."],
        answer: { type: "number", value: 2.466, decimals: 3 },
        solution: [
          "res = smf.logit('y ~ x1 + x2', data=df).fit(disp=0)",
          "round(float(np.exp(res.params['x1'])), 3)"
        ],
        explanation: [
          "[[logistic-regression|로지스틱 회귀]] 계수는 로그 오즈이므로 `np.exp()`를 적용해야 [[odds-ratio|오즈비]]가 된다. x1이 1단위 커질 때 성공 오즈가 몇 배가 되는지를 뜻한다. 데이터 생성에 쓴 참 계수 0.8의 exp ≈ 2.23이고, 표본에서 추정한 계수(약 0.90)의 exp는 그보다 조금 큰 2.4대가 나온다.",
          "`sm.GLM(y, X, family=sm.families.Binomial())`로 적합해도 같은 계수를 얻는다. `disp=0`은 반복 로그 출력을 끄는 옵션이다."
        ],
        terms: ["logistic-regression", "odds-ratio", "formula-api"],
        verified: { by: "python", at: "2026-10-04", env: "statsmodels 0.15.0 / numpy 2.4.6 / pandas 3.0.6" }
      },
      {
        id: "a-3-6-p01", node: "a-3-6",
        title: "독립 2표본 t 검정 통계량",
        difficulty: 1,
        task: [
          "두 집단 `a`, `b`의 평균 차이를 등분산 가정의 독립 2표본 t 검정(`ttest_ind`, 기본 인자)으로 검정하고, **t 통계량(statistic)** 을 소수 셋째 자리까지 반올림해 입력하시오(음수면 음수 그대로)."
        ],
        setup: [
          "import numpy as np",
          "from scipy import stats",
          "rng = np.random.default_rng(36001)",
          "a = rng.normal(50, 10, size=40)",
          "b = rng.normal(55, 10, size=45)",
          "print(a.mean().round(2), b.mean().round(2))"
        ],
        hint: ["`stats.ttest_ind(a, b)`의 결과 객체에서 `.statistic`을 읽는다."],
        answer: { type: "number", value: -2.066, decimals: 3 },
        solution: [
          "res = stats.ttest_ind(a, b)",
          "round(float(res.statistic), 3)"
        ],
        explanation: [
          "[[t-test|독립 2표본 t 검정]]의 통계량은 (ā − b̄)/SE 꼴이라 a의 평균이 더 작으면 음수가 나온다. 결과 객체의 `.pvalue`로 유의성을 판단한다.",
          "`equal_var=False`로 바꾸면 [[welch-t-test|Welch t 검정]]이 되어 통계량과 자유도가 조금 달라진다."
        ],
        terms: ["t-test", "welch-t-test"],
        verified: { by: "python", at: "2026-10-04", env: "scipy 1.17.1 / numpy 2.4.6" }
      },
      {
        id: "a-3-6-p02", node: "a-3-6",
        title: "분할표 카이제곱 독립성 검정",
        difficulty: 2,
        task: [
          "`df`의 `gender`와 `pref`로 분할표(crosstab)를 만들고 카이제곱 독립성 검정을 수행하시오. **카이제곱 통계량(statistic)** 을 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "from scipy import stats",
          "rng = np.random.default_rng(36002)",
          "n = 200",
          "gender = rng.choice(['M', 'F'], size=n)",
          "pref_m = rng.choice(['A', 'B', 'C'], size=n, p=[0.5, 0.3, 0.2])",
          "pref_f = rng.choice(['A', 'B', 'C'], size=n, p=[0.3, 0.3, 0.4])",
          "df = pd.DataFrame({'gender': gender, 'pref': np.where(gender == 'M', pref_m, pref_f)})",
          "pd.crosstab(df['gender'], df['pref'])"
        ],
        hint: ["`stats.chi2_contingency(pd.crosstab(df['gender'], df['pref']))`는 (statistic, pvalue, dof, expected) 4개를 돌려준다."],
        answer: { type: "number", value: 24.094, decimals: 3 },
        solution: [
          "table = pd.crosstab(df['gender'], df['pref'])",
          "chi2, p, dof, expected = stats.chi2_contingency(table)",
          "round(float(chi2), 3)"
        ],
        explanation: [
          "[[chi-square-test|카이제곱 독립성 검정]]은 `pd.crosstab`으로 만든 관측 분할표와 기대빈도의 차이 Σ(O−E)²/E를 통계량으로 쓴다. 2×3 표이므로 자유도 (2−1)(3−1) = 2이고, 이 데이터는 통계량이 커서 p값이 0.0001보다 작아(`p < 0.05`) 성별과 선호가 독립이 아니라고 판단한다.",
          "반환값이 4개(statistic, pvalue, dof, expected)라 변수 4개로 받아야 한다. 결과 객체의 `.statistic`, `.pvalue` 속성으로도 접근할 수 있다."
        ],
        terms: ["chi-square-test", "p-value"],
        verified: { by: "python", at: "2026-10-04", env: "scipy 1.17.1 / numpy 2.4.6 / pandas 3.0.6" }
      },
      {
        id: "a-3-7-p01", node: "a-3-7",
        title: "표본표준편차 직접 계산",
        difficulty: 1,
        task: [
          "numpy 함수 `np.std`를 쓰지 말고, 배열 `x`의 **표본표준편차(sample standard deviation, 분모 n−1)** 를 식 그대로 계산하여 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np",
          "rng = np.random.default_rng(37001)",
          "x = rng.normal(100, 15, size=50).round(1)",
          "x[:10]"
        ],
        hint: ["`np.sqrt(np.sum((x - x.mean()) ** 2) / (len(x) - 1))`. `np.std(x, ddof=1)`과 같아야 한다."],
        answer: { type: "number", value: 12.891, decimals: 3 },
        solution: [
          "n = len(x)",
          "s = np.sqrt(np.sum((x - x.mean()) ** 2) / (n - 1))",
          "round(float(s), 3)"
        ],
        explanation: [
          "[[sample-variance|표본분산]]은 편차 제곱합을 n − 1로 나눈다([[ddof|ddof=1]]). 그 제곱근이 표본표준편차. `np.std(x)` 기본값(ddof=0)과는 값이 다르므로 지문의 '분모 n−1'을 확인해야 한다.",
          "여기서 √n으로 한 번 더 나누면 [[standard-error|표준오차]]가 되고, 거기에 `stats.t.ppf(0.975, n-1)`을 곱하면 95% 신뢰구간 반폭이 된다."
        ],
        terms: ["sample-variance", "ddof", "standard-error"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6" }
      },
      {
        id: "a-3-7-p02", node: "a-3-7",
        title: "F1 점수 수동 계산",
        difficulty: 2,
        task: [
          "scikit-learn을 쓰지 말고 `y_true`, `y_pred`에서 TP·FP·FN을 직접 세어 양성(1) 클래스의 **F1 점수**를 계산하고 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np",
          "rng = np.random.default_rng(37002)",
          "y_true = rng.binomial(1, 0.4, size=100)",
          "flip = rng.random(100) < 0.25          # 25% 확률로 예측이 뒤집힘",
          "y_pred = np.where(flip, 1 - y_true, y_true)",
          "print(y_true[:10], y_pred[:10])"
        ],
        hint: [
          "`tp = np.sum((y_true == 1) & (y_pred == 1))`처럼 불리언 마스크의 합으로 센다.",
          "F1 = 2 × 정밀도 × 재현율 / (정밀도 + 재현율)."
        ],
        answer: { type: "number", value: 0.758, decimals: 3 },
        solution: [
          "tp = np.sum((y_true == 1) & (y_pred == 1))",
          "fp = np.sum((y_true == 0) & (y_pred == 1))",
          "fn = np.sum((y_true == 1) & (y_pred == 0))",
          "precision = tp / (tp + fp)",
          "recall = tp / (tp + fn)",
          "f1 = 2 * precision * recall / (precision + recall)",
          "round(float(f1), 3)"
        ],
        explanation: [
          "[[confusion-matrix|혼동행렬]]의 네 칸 중 세 개(TP, FP, FN)만 있으면 [[precision|정밀도]] TP/(TP+FP), [[recall|재현율]] TP/(TP+FN), 그리고 둘의 조화평균인 [[f1-score|F1]]을 구할 수 있다. TN은 F1에 쓰이지 않는다.",
          "`sklearn.metrics.f1_score(y_true, y_pred)`와 같은 값이 나와야 한다. 다중 클래스에서는 `average=` 인자로 macro/micro/weighted를 고른다."
        ],
        terms: ["f1-score", "precision", "recall", "confusion-matrix"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6" }
      }
    ],

    /* ────────────────────────────────────────────────────────
       용어 사전 — 이 파일에서 태그·링크한 용어 전부
       ──────────────────────────────────────────────────────── */
    terms: [
      /* statsmodels */
      { id: "ols", ko: "최소제곱 선형회귀", en: "OLS (ordinary least squares)",
        def: "잔차 제곱합을 최소화하는 계수를 찾는 선형회귀 추정법. statsmodels에서는 sm.OLS(endog, exog).fit()으로 적합한다.",
        nodes: ["a-3-5"], related: ["intercept", "r-squared", "least-squares"] },
      { id: "intercept", ko: "절편", en: "intercept / constant",
        def: "모든 설명변수가 0일 때의 예측값. statsmodels 배열 API는 sm.add_constant로 상수 컬럼을 추가해야 추정된다.",
        nodes: ["a-3-5"], related: ["ols", "formula-api"] },
      { id: "formula-api", ko: "수식 API", en: "formula API (statsmodels.formula.api)",
        def: "'y ~ x1 + C(g)' 같은 R 스타일 수식 문자열로 모형을 지정하는 statsmodels 인터페이스. 절편이 자동 포함되고 C()로 범주형을 처리한다.",
        nodes: ["a-3-5"], related: ["dummy-variable", "intercept"] },
      { id: "p-value", ko: "p값", en: "p-value",
        def: "귀무가설이 참일 때 관측된 통계량 이상으로 극단적인 값이 나올 확률. 유의수준(보통 0.05)보다 작으면 귀무가설을 기각한다.",
        nodes: ["a-3-5", "a-3-6"], related: ["confidence-interval", "t-test"] },
      { id: "confidence-interval", ko: "신뢰구간", en: "confidence interval (CI)",
        def: "모수를 포함할 것으로 기대되는 구간. 95% 신뢰구간은 점추정값 ± 임계값 × 표준오차로 계산하며, 0을 포함하면 해당 계수는 유의하지 않다.",
        nodes: ["a-3-5", "a-3-7"], related: ["p-value", "standard-error"] },
      { id: "r-squared", ko: "결정계수", en: "R-squared (R²)",
        def: "종속변수 총변동 중 모형이 설명하는 비율. 0~1이며 설명변수를 추가하면 감소하지 않는다.",
        nodes: ["a-3-5"], related: ["adjusted-r-squared", "ols"] },
      { id: "adjusted-r-squared", ko: "수정 결정계수", en: "adjusted R-squared",
        def: "설명변수 개수에 벌점을 주어 보정한 결정계수. 항상 R² 이하이며 불필요한 변수를 추가하면 감소할 수 있어 모형 비교에 쓴다.",
        nodes: ["a-3-5"], related: ["r-squared", "aic-bic"] },
      { id: "f-statistic", ko: "F 통계량", en: "F-statistic",
        def: "회귀모형의 모든 기울기 계수가 0이라는 귀무가설을 검정하는 통계량. 분산분석에서는 집단 간 분산과 집단 내 분산의 비다.",
        nodes: ["a-3-5"], related: ["anova", "p-value"] },
      { id: "aic-bic", ko: "정보량 기준", en: "AIC / BIC",
        def: "모형 적합도에 모수 개수 벌점을 더한 모형 선택 기준. 값이 작을수록 좋으며 BIC는 AIC보다 복잡한 모형에 더 큰 벌점을 준다.",
        nodes: ["a-3-5"], related: ["adjusted-r-squared"] },
      { id: "durbin-watson", ko: "더빈-왓슨 통계량", en: "Durbin-Watson statistic",
        def: "회귀 잔차의 1차 자기상관을 진단하는 통계량. 0~4 범위이며 2에 가까우면 자기상관이 없다고 본다.",
        nodes: ["a-3-5"], related: ["autocorrelation", "residual"] },
      { id: "residual", ko: "잔차", en: "residual",
        def: "관측값과 모형 예측값의 차이(y − ŷ). 잔차의 정규성·등분산성·독립성 확인이 회귀 진단의 핵심이다.",
        nodes: ["a-3-5"], related: ["durbin-watson", "ols"] },
      { id: "dummy-variable", ko: "더미 변수", en: "dummy variable / one-hot",
        def: "범주형 변수를 0/1 지시변수로 바꾼 것. 회귀에서는 기준 범주 하나를 제외한 k−1개를 사용해 완전 공선성을 피한다.",
        nodes: ["a-3-5"], related: ["formula-api", "multicollinearity"] },
      { id: "logistic-regression", ko: "로지스틱 회귀", en: "logistic regression / Logit",
        def: "이진 결과의 로그 오즈를 설명변수의 선형결합으로 모형화하는 분류 모형. statsmodels에서는 Logit 또는 GLM(Binomial)로 적합한다.",
        nodes: ["a-3-5"], related: ["odds-ratio"] },
      { id: "odds-ratio", ko: "오즈비", en: "odds ratio",
        def: "설명변수가 1단위 증가할 때 성공 오즈가 몇 배가 되는지를 나타내는 값. 로지스틱 회귀 계수에 exp()를 적용해 얻는다.",
        nodes: ["a-3-5"], related: ["logistic-regression"] },
      { id: "vif", ko: "분산팽창계수", en: "VIF (variance inflation factor)",
        def: "한 설명변수를 나머지 설명변수로 회귀한 R²로 계산한 1/(1−R²). 10 이상이면 다중공선성이 심하다고 판단한다.",
        nodes: ["a-3-5"], related: ["multicollinearity"] },
      { id: "multicollinearity", ko: "다중공선성", en: "multicollinearity",
        def: "설명변수들 사이에 강한 선형 상관이 있어 계수 추정이 불안정해지는 현상. VIF나 상관행렬로 진단한다.",
        nodes: ["a-3-5"], related: ["vif", "dummy-variable"] },
      { id: "t-test", ko: "t 검정", en: "t-test",
        def: "평균에 관한 가설을 t 분포로 검정하는 방법. 단일표본(ttest_1samp), 독립 2표본(ttest_ind), 대응표본(ttest_rel)이 있다.",
        nodes: ["a-3-6", "a-3-5"], related: ["welch-t-test", "p-value"] },
      { id: "anova", ko: "분산분석", en: "ANOVA (analysis of variance)",
        def: "세 집단 이상의 평균이 모두 같은지 F 통계량으로 검정하는 방법. scipy f_oneway, statsmodels anova_lm으로 수행한다.",
        nodes: ["a-3-5", "a-3-6"], related: ["f-statistic", "tukey-hsd", "kruskal-wallis"] },
      { id: "tukey-hsd", ko: "튜키 사후검정", en: "Tukey HSD (pairwise_tukeyhsd)",
        def: "분산분석에서 유의한 차이가 나왔을 때 어느 집단 쌍이 다른지 다중비교 보정과 함께 확인하는 사후검정.",
        nodes: ["a-3-5"], related: ["anova"] },
      { id: "adf-test", ko: "ADF 단위근 검정", en: "ADF test (augmented Dickey-Fuller)",
        def: "시계열이 단위근을 가지는지(비정상인지) 검정하는 방법. p < 0.05면 정상(stationary) 시계열로 판단한다. statsmodels tsa.stattools.adfuller.",
        nodes: ["a-3-5"], related: ["autocorrelation"] },
      { id: "autocorrelation", ko: "자기상관", en: "autocorrelation (ACF)",
        def: "시계열이 자기 자신의 과거 값과 가지는 상관. 시차별 자기상관을 나열한 것이 ACF이며 잔차에 남아 있으면 독립성 가정 위반이다.",
        nodes: ["a-3-5"], related: ["durbin-watson", "adf-test"] },

      /* scipy */
      { id: "probability-distribution", ko: "확률분포 객체", en: "probability distribution (scipy.stats)",
        def: "norm, t, chi2, f, binom, poisson 등 분포를 나타내는 scipy.stats 객체. pdf/pmf, cdf, sf, ppf, rvs 메서드를 공통으로 가진다.",
        nodes: ["a-3-6"], related: ["cdf", "ppf", "pmf"] },
      { id: "pdf", ko: "확률밀도함수", en: "PDF (probability density function)",
        def: "연속형 확률변수가 특정 값 근처에 있을 밀도. 구간의 적분이 확률이며 scipy 분포 객체의 pdf(x) 메서드.",
        nodes: ["a-3-6"], related: ["pmf", "cdf"] },
      { id: "pmf", ko: "확률질량함수", en: "PMF (probability mass function)",
        def: "이산형 확률변수가 특정 값을 가질 확률. binom, poisson 같은 이산분포의 pmf(k) 메서드.",
        nodes: ["a-3-6"], related: ["pdf", "probability-distribution"] },
      { id: "cdf", ko: "누적분포함수", en: "CDF (cumulative distribution function)",
        def: "확률변수가 x 이하일 확률 P(X ≤ x). scipy 분포 객체의 cdf(x) 메서드이며 ppf의 역함수다.",
        nodes: ["a-3-6"], related: ["ppf", "survival-function"] },
      { id: "ppf", ko: "분위수 함수", en: "PPF (percent point function) / quantile",
        def: "누적확률 q에 해당하는 값을 돌려주는 cdf의 역함수. norm.ppf(0.975) = 1.96처럼 임계값 계산에 쓴다.",
        nodes: ["a-3-6"], related: ["cdf"] },
      { id: "survival-function", ko: "생존함수", en: "survival function (sf)",
        def: "확률변수가 x를 초과할 확률 P(X > x) = 1 − cdf(x). 상위 꼬리 확률로 p값 계산에 쓴다.",
        nodes: ["a-3-6"], related: ["cdf"] },
      { id: "welch-t-test", ko: "웰치 t 검정", en: "Welch's t-test",
        def: "두 독립 집단의 분산이 다를 때 자유도를 보정해 평균을 비교하는 t 검정. scipy에서는 ttest_ind(a, b, equal_var=False).",
        nodes: ["a-3-6"], related: ["t-test", "levene-test"] },
      { id: "chi-square-test", ko: "카이제곱 검정", en: "chi-square test (chi2_contingency)",
        def: "분할표의 관측빈도와 기대빈도의 차이로 두 범주형 변수의 독립성을 검정하는 방법. 자유도는 (행−1)(열−1).",
        nodes: ["a-3-6"], related: ["p-value"] },
      { id: "normality-test", ko: "정규성 검정", en: "normality test (Shapiro-Wilk)",
        def: "표본이 정규분포에서 나왔는지 검정하는 방법. shapiro, normaltest 등이 있으며 p < 0.05면 정규성을 기각한다.",
        nodes: ["a-3-6"], related: ["nonparametric-test", "levene-test"] },
      { id: "levene-test", ko: "레빈 검정", en: "Levene's test",
        def: "두 집단 이상의 분산이 같은지(등분산성) 검정하는 방법. 정규성에 덜 민감하며 p < 0.05면 등분산을 기각한다.",
        nodes: ["a-3-6"], related: ["welch-t-test", "normality-test"] },
      { id: "nonparametric-test", ko: "비모수 검정", en: "nonparametric test",
        def: "모집단 분포(정규성)를 가정하지 않고 순위 등을 이용하는 검정. Mann-Whitney U, Wilcoxon, Kruskal-Wallis가 대표적이다.",
        nodes: ["a-3-6"], related: ["mann-whitney-u", "wilcoxon", "kruskal-wallis"] },
      { id: "mann-whitney-u", ko: "맨-휘트니 U 검정", en: "Mann-Whitney U test",
        def: "두 독립 집단의 분포가 같은지 순위로 비교하는 비모수 검정. 독립 2표본 t 검정의 비모수 대응이다.",
        nodes: ["a-3-6"], related: ["nonparametric-test", "wilcoxon"] },
      { id: "wilcoxon", ko: "윌콕슨 부호순위 검정", en: "Wilcoxon signed-rank test",
        def: "대응(짝지은) 두 표본의 차이가 0인지 순위로 검정하는 비모수 방법. 대응표본 t 검정의 비모수 대응이다.",
        nodes: ["a-3-6"], related: ["nonparametric-test", "mann-whitney-u"] },
      { id: "kruskal-wallis", ko: "크루스칼-왈리스 검정", en: "Kruskal-Wallis H test",
        def: "세 집단 이상의 분포가 같은지 순위로 검정하는 비모수 방법. 일원분산분석의 비모수 대응이다.",
        nodes: ["a-3-6"], related: ["anova", "nonparametric-test"] },
      { id: "correlation-coefficient", ko: "상관계수", en: "correlation coefficient (Pearson r)",
        def: "두 변수의 선형 관계 강도와 방향을 −1~1로 나타낸 값. 공분산을 두 표준편차의 곱으로 나눈다.",
        nodes: ["a-3-6", "a-3-7"], related: ["spearman", "covariance"] },
      { id: "spearman", ko: "스피어만 순위상관", en: "Spearman rank correlation",
        def: "두 변수를 순위로 바꾼 뒤 계산한 상관계수. 단조 관계를 측정하며 이상치와 비선형에 강건하다.",
        nodes: ["a-3-6"], related: ["correlation-coefficient"] },
      { id: "one-sided-test", ko: "단측 검정", en: "one-sided (one-tailed) test",
        def: "대립가설이 한 방향(크다 또는 작다)인 검정. scipy에서는 alternative='greater' 또는 'less'로 지정한다.",
        nodes: ["a-3-6"], related: ["p-value"] },
      { id: "curve-fit", ko: "곡선 적합", en: "curve_fit (scipy.optimize)",
        def: "사용자 정의 함수의 모수를 비선형 최소제곱으로 데이터에 맞추는 함수. 최적 모수 popt와 공분산 pcov를 돌려준다.",
        nodes: ["a-3-6"], related: ["least-squares"] },
      { id: "interpolation", ko: "보간", en: "interpolation",
        def: "알려진 데이터 점 사이의 값을 추정하는 방법. scipy.interpolate.interp1d, pandas interpolate()가 대표적이다.",
        nodes: ["a-3-6"], related: [] },

      /* 수동 구현 */
      { id: "sample-variance", ko: "표본분산", en: "sample variance",
        def: "편차 제곱합을 n−1로 나눈 모분산의 불편추정량. numpy는 ddof=1을 명시해야 하고 pandas는 기본값이다.",
        nodes: ["a-3-7"], related: ["ddof", "standard-error"] },
      { id: "ddof", ko: "자유도 보정", en: "ddof (delta degrees of freedom)",
        def: "분산·표준편차 계산 시 분모 n에서 뺄 값. numpy 기본 0(모분산), pandas 기본 1(표본분산).",
        nodes: ["a-3-7"], related: ["sample-variance"] },
      { id: "standard-error", ko: "표준오차", en: "standard error (SE)",
        def: "표본 통계량(주로 표본평균)의 표준편차. 평균의 표준오차는 s/√n이며 신뢰구간 계산에 쓴다.",
        nodes: ["a-3-7", "a-3-5"], related: ["confidence-interval", "sample-variance"] },
      { id: "z-score", ko: "z 점수", en: "z-score / standard score",
        def: "값에서 평균을 빼고 표준편차로 나눈 표준화 점수. 평균에서 몇 표준편차 떨어졌는지를 나타낸다.",
        nodes: ["a-3-7"], related: ["standardization"] },
      { id: "covariance", ko: "공분산", en: "covariance",
        def: "두 변수가 함께 변하는 정도. Σ(x−x̄)(y−ȳ)/(n−1)로 계산하며 단위에 의존하므로 상관계수로 표준화한다.",
        nodes: ["a-3-7"], related: ["correlation-coefficient"] },
      { id: "least-squares", ko: "최소제곱법", en: "least squares",
        def: "예측 오차의 제곱합을 최소화하는 계수를 찾는 방법. np.linalg.lstsq 또는 정규방정식으로 해를 구한다.",
        nodes: ["a-3-7", "a-3-5"], related: ["normal-equation", "ols"] },
      { id: "normal-equation", ko: "정규방정식", en: "normal equation",
        def: "최소제곱 해의 닫힌 형태 β = (XᵀX)⁻¹Xᵀy. 역행렬 계산이 불안정할 수 있어 실무에서는 lstsq를 쓴다.",
        nodes: ["a-3-7"], related: ["least-squares"] },
      { id: "confusion-matrix", ko: "혼동행렬", en: "confusion matrix",
        def: "실제 클래스와 예측 클래스를 교차한 표. TP·FP·FN·TN 네 칸으로 정확도·정밀도·재현율·F1을 계산한다.",
        nodes: ["a-3-7"], related: ["precision", "recall", "f1-score"] },
      { id: "precision", ko: "정밀도", en: "precision",
        def: "양성으로 예측한 것 중 실제 양성의 비율 TP/(TP+FP). 거짓 양성 비용이 클 때 중시한다.",
        nodes: ["a-3-7"], related: ["recall", "f1-score"] },
      { id: "recall", ko: "재현율", en: "recall / sensitivity",
        def: "실제 양성 중 양성으로 맞게 예측한 비율 TP/(TP+FN). 거짓 음성 비용이 클 때 중시한다.",
        nodes: ["a-3-7"], related: ["precision", "f1-score"] },
      { id: "f1-score", ko: "F1 점수", en: "F1 score",
        def: "정밀도와 재현율의 조화평균 2PR/(P+R). 두 지표가 모두 높아야 커지며 불균형 데이터 평가에 쓴다.",
        nodes: ["a-3-7"], related: ["precision", "recall"] },
      { id: "mse", ko: "평균제곱오차", en: "MSE (mean squared error)",
        def: "잔차 제곱의 평균 mean((y−ŷ)²). 큰 오차에 민감하며 단위가 y의 제곱이다.",
        nodes: ["a-3-7"], related: ["rmse", "mae"] },
      { id: "rmse", ko: "평균제곱근오차", en: "RMSE (root mean squared error)",
        def: "MSE의 제곱근. 단위가 y와 같아 해석이 쉽고 큰 오차에 민감하다.",
        nodes: ["a-3-7"], related: ["mse", "mae"] },
      { id: "mae", ko: "평균절대오차", en: "MAE (mean absolute error)",
        def: "잔차 절댓값의 평균 mean(|y−ŷ|). 이상치에 RMSE보다 덜 민감하다.",
        nodes: ["a-3-7"], related: ["rmse", "mse"] },
      { id: "euclidean-distance", ko: "유클리드 거리", en: "Euclidean distance",
        def: "두 점 사이의 직선 거리 √Σ(aᵢ−bᵢ)². KNN·k-means의 기본 거리 척도다.",
        nodes: ["a-3-7"], related: ["manhattan-distance", "cosine-similarity"] },
      { id: "manhattan-distance", ko: "맨해튼 거리", en: "Manhattan distance (L1)",
        def: "좌표별 차이의 절댓값 합 Σ|aᵢ−bᵢ|. 격자 이동 거리와 같다.",
        nodes: ["a-3-7"], related: ["euclidean-distance"] },
      { id: "cosine-similarity", ko: "코사인 유사도", en: "cosine similarity",
        def: "두 벡터 사이 각도의 코사인 a·b/(‖a‖‖b‖). 벡터 크기와 무관하게 방향의 유사성만 측정한다.",
        nodes: ["a-3-7"], related: ["euclidean-distance"] },
      { id: "min-max-scaling", ko: "최소-최대 스케일링", en: "min-max scaling",
        def: "(x−min)/(max−min)으로 값을 0~1 범위로 변환하는 방법. 이상치에 민감하다.",
        nodes: ["a-3-7"], related: ["standardization"] },
      { id: "standardization", ko: "표준화", en: "standardization (z-score scaling)",
        def: "(x−평균)/표준편차로 평균 0, 표준편차 1이 되게 변환하는 방법. StandardScaler와 같다.",
        nodes: ["a-3-7"], related: ["z-score", "min-max-scaling"] },
      { id: "knn", ko: "k-최근접 이웃", en: "KNN (k-nearest neighbors)",
        def: "새 점과 거리가 가장 가까운 k개 학습 샘플의 다수결(분류) 또는 평균(회귀)으로 예측하는 방법.",
        nodes: ["a-3-7"], related: ["euclidean-distance", "k-means"] },
      { id: "k-means", ko: "k-평균 군집화", en: "k-means clustering",
        def: "각 점을 가장 가까운 중심에 할당하고 중심을 할당된 점들의 평균으로 갱신하는 과정을 반복하는 군집화 알고리즘.",
        nodes: ["a-3-7"], related: ["knn", "euclidean-distance"] },
      { id: "xgboost", ko: "XGBoost", en: "XGBoost / LightGBM (gradient boosting)",
        def: "약한 결정트리를 순차적으로 더해 이전 오차를 보정하는 그래디언트 부스팅 라이브러리. 핵심 파라미터는 n_estimators, learning_rate, max_depth(LightGBM은 num_leaves).",
        nodes: ["a-3-7"], related: ["learning-rate"] },
      { id: "learning-rate", ko: "학습률", en: "learning rate (eta)",
        def: "부스팅에서 각 트리의 기여를 축소하는 계수. 작을수록 과적합이 줄지만 더 많은 트리가 필요하다.",
        nodes: ["a-3-7"], related: ["xgboost"] },
      { id: "smote", ko: "SMOTE", en: "SMOTE (Synthetic Minority Over-sampling Technique)",
        def: "소수 클래스 샘플과 그 k-최근접 이웃 사이를 보간해 합성 샘플을 만드는 오버샘플링 기법. 훈련 데이터에만 적용한다.",
        nodes: ["a-3-7"], related: ["class-imbalance"] },
      { id: "class-imbalance", ko: "클래스 불균형", en: "class imbalance",
        def: "분류 문제에서 클래스별 샘플 수가 크게 다른 상태. 오버/언더샘플링, class_weight, F1 같은 지표로 대응한다.",
        nodes: ["a-3-7"], related: ["smote", "f1-score"] },
      { id: "association-rules", ko: "연관규칙", en: "association rules (apriori)",
        def: "장바구니 데이터에서 함께 등장하는 항목 집합의 규칙 A→B를 찾는 분석. 지지도·신뢰도·향상도로 평가하며 mlxtend apriori, association_rules로 구한다.",
        nodes: ["a-3-7"], related: ["lift"] },
      { id: "lift", ko: "향상도", en: "lift",
        def: "연관규칙 A→B의 신뢰도를 B의 지지도로 나눈 값. 1보다 크면 A가 B의 구매 확률을 높인다.",
        nodes: ["a-3-7"], related: ["association-rules"] }
    ]
  });
})();
