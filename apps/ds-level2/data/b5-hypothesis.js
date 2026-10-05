/* ds-level2 — 파트B 5장 가설검정 (b-5 토픽 + b-5-2 이해도 점검).
   형식: spec 3절 스키마. 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회,
   태그·링크한 용어는 전부 이 파일에서 정의한다.
   output 문제의 출력은 scipy 1.17.1 / statsmodels 0.15.0 / numpy 2.4.6 에서 실제 실행해 확인했다. */
(function () {
  DS2.register({
    chapter: "b-5",

    /* ────────────────────────────────────────────────
       요약 카드 (b-5 만. 점검 노드 b-5-2 는 카드 없음)
       ──────────────────────────────────────────────── */
    cards: {
      "b-5": {
        node: "b-5",
        title: "가설검정",
        summary: [
          "가설검정은 **귀무가설(H0)을 기각할 증거가 충분한가**를 묻는 절차다. [[p-value|유의확률(p-value)]]은 \"H0가 참일 때 지금 관측한 것 이상으로 극단적인 결과가 나올 확률\"이고, 이것이 [[significance-level|유의수준(α)]]보다 작으면 H0를 기각한다.",
          "시험은 (1) p-value 의 정의와 흔한 오해, (2) 1종·2종 오류와 검정력, (3) **상황에 맞는 검정 고르기**(데이터 유형·집단 수·대응 여부·정규성·등분산성), (4) `scipy.stats` 결과를 읽고 결론 문장을 쓰는 네 가지를 반복해서 묻는다.",
          "코드에서는 `ttest_ind(equal_var=False)`(Welch), `ttest_rel`(대응), `f_oneway`(ANOVA), `chi2_contingency`(반환값 순서!), `alternative=` 인자가 단골이다."
        ],
        concepts: [
          "**가설 세우기**: [[null-hypothesis|귀무가설(null hypothesis, H0)]]은 \"차이·효과가 없다\"(등호 포함), [[alternative-hypothesis|대립가설(alternative hypothesis, H1)]]은 연구자가 보이려는 주장. '증가했다/감소했다'면 단측, '다르다'면 양측.",
          "**판정 규칙**: [[test-statistic|검정통계량]]을 계산해 p-value 를 얻고, p < α 면 H0 기각. 같은 말로, 검정통계량이 [[critical-value|임계값]]을 넘어 [[rejection-region|기각역]]에 들어가면 기각. 기각하지 못해도 H0가 '참'으로 증명된 것은 아니다.",
          "**두 오류**: [[type-i-error|1종 오류(α)]] = 참인 H0를 기각, [[type-ii-error|2종 오류(β)]] = 거짓인 H0를 기각 못함. [[statistical-power|검정력]] = 1 − β. 표본크기↑·[[effect-size|효과크기]]↑·α↑ 이면 검정력↑.",
          "**검정 선택 흐름**: 평균 비교 → 1집단 `ttest_1samp` / 독립 2집단 `ttest_ind` / 같은 대상 전후 `ttest_rel` / 3집단 이상 `f_oneway`(+사후검정 Tukey). 범주 vs 범주 → `chi2_contingency`. 비율 → `proportions_ztest`. 정규성 깨지면 비모수(`mannwhitneyu`, `wilcoxon`, `kruskal`).",
          "**가정 점검**: 정규성은 [[shapiro-wilk-test|Shapiro-Wilk]](`stats.shapiro`), 등분산성은 [[levene-test|Levene]](`stats.levene`). Levene p < 0.05 면 등분산 기각 → `equal_var=False`(Welch).",
          "**카이제곱**: [[expected-frequency|기대빈도]] = 행합 × 열합 / 전체, [[degrees-of-freedom|자유도]] = (행−1)(열−1). `chi2_contingency`는 `(statistic, pvalue, dof, expected)` 순서로 돌려준다.",
          "**다중비교**: 검정을 k번 반복하면 1종 오류가 누적된다. [[bonferroni-correction|Bonferroni]]는 비교당 α/k 를 쓰고, ANOVA 뒤에는 [[tukey-hsd|Tukey HSD]] 사후검정으로 어느 쌍이 다른지 본다."
        ],
        terms: ["null-hypothesis", "alternative-hypothesis", "p-value", "significance-level", "type-i-error", "type-ii-error", "statistical-power", "t-test", "welch-t-test", "anova", "chi-square-test", "nonparametric-test"],
        patterns: [
          {
            title: "독립 2표본 t-검정 — 등분산 확인 후 Student / Welch",
            lang: "python",
            code: [
              "from scipy import stats",
              "lev = stats.levene(a, b)                       # 등분산 검정",
              "equal = lev.pvalue >= 0.05",
              "res = stats.ttest_ind(a, b, equal_var=equal)   # False 면 Welch",
              "print(round(res.statistic, 3), round(res.pvalue, 4))"
            ],
            note: "`equal_var` 기본값은 `True`(Student). 양측이 기본이며 `alternative='less'|'greater'` 로 단측."
          },
          {
            title: "대응표본 t-검정 (같은 대상의 전·후)",
            lang: "python",
            code: [
              "res = stats.ttest_rel(after, before)    # 차이 = after - before",
              "res.statistic, res.pvalue"
            ],
            note: "`ttest_rel(after, before)` 는 `ttest_1samp(after - before, 0)` 과 같은 값이다."
          },
          {
            title: "일원 분산분석 + Tukey 사후검정",
            lang: "python",
            code: [
              "from statsmodels.stats.multicomp import pairwise_tukeyhsd",
              "f = stats.f_oneway(g1, g2, g3)",
              "if f.pvalue < 0.05:",
              "    print(pairwise_tukeyhsd(df['score'], df['group']))"
            ],
            note: "`f_oneway` 는 집단을 각각 위치 인자로 받는다. 전체 차이가 유의할 때만 사후검정으로 쌍별 차이를 본다."
          },
          {
            title: "카이제곱 독립성 검정 — crosstab 을 넘기고 4개를 받는다",
            lang: "python",
            code: [
              "import pandas as pd",
              "table = pd.crosstab(df['gender'], df['smoke'])",
              "chi2, p, dof, expected = stats.chi2_contingency(table)",
              "print(round(chi2, 3), round(p, 4), dof)"
            ],
            note: "원본 컬럼 두 개를 그대로 넘기면 안 된다. 2×2 표는 기본 `correction=True`(Yates 연속성 보정)가 적용된다."
          },
          {
            title: "비율 z-검정 (statsmodels)",
            lang: "python",
            code: [
              "from statsmodels.stats.proportion import proportions_ztest",
              "stat, p = proportions_ztest(count=40, nobs=100, value=0.5)   # H0: p = 0.5",
              "stat2, p2 = proportions_ztest(count=[40, 55], nobs=[100, 100])  # 두 비율 비교"
            ]
          },
          {
            title: "비모수 대응",
            lang: "python",
            code: [
              "stats.mannwhitneyu(a, b)        # 독립 2표본 t 의 비모수판",
              "stats.wilcoxon(after, before)   # 대응표본 t 의 비모수판",
              "stats.kruskal(g1, g2, g3)       # 일원 ANOVA 의 비모수판"
            ]
          },
          {
            title: "결론 문장 자동화",
            lang: "python",
            code: [
              "alpha = 0.05",
              "verdict = '기각' if res.pvalue < alpha else '기각하지 못함'",
              "print(f'유의수준 {alpha:.0%}에서 귀무가설을 {verdict}')"
            ]
          }
        ],
        pitfalls: [
          "p-value 는 \"H0가 참일 확률\"이 아니다. H0를 참이라 가정했을 때 **데이터가** 나올 확률이다.",
          "p ≥ α 는 \"H0 채택\"이 아니라 \"기각할 증거 부족\". 보고 문장도 \"귀무가설을 기각하지 못한다\"로 쓴다.",
          "`chi2_contingency` 반환값 순서는 `(statistic, pvalue, dof, expected)`. 두 번째가 p 다.",
          "같은 대상의 전·후 자료에 `ttest_ind` 를 쓰면 짝 정보가 사라져 p-value 가 크게 부풀려진다. `ttest_rel`.",
          "표본이 크면 미세한 차이도 '유의'하다. 통계적 유의성과 실질적 의미(효과크기)는 별개다."
        ]
      }
    },

    /* ────────────────────────────────────────────────
       필기 문제 — b-5 (12) : mcq 7 / ox 2 / short 3, 난이도 4:6:2
       ──────────────────────────────────────────────── */
    questions: [
      {
        id: "b-5-q01", node: "b-5", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "다음 중 유의확률(p-value)의 정의로 옳은 것은?",
        choices: [
          "귀무가설이 참일 확률",
          "귀무가설이 참이라고 가정할 때, 관측된 검정통계량 이상으로 극단적인 값이 나올 확률",
          "대립가설이 참일 확률",
          "표본의 결과가 우연이 아님을 보여주는 확률로, 1종 오류의 허용 한계"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[p-value|유의확률(p-value)]]은 **귀무가설(null hypothesis)이 참이라는 가정 아래** 지금 관측한 [[test-statistic|검정통계량(test statistic)]] 이상으로 극단적인 값이 나올 확률이다. 데이터에 관한 조건부 확률이지 가설에 관한 확률이 아니다.",
          "",
          "- ① 가설이 참일 확률은 빈도주의 검정에서 정의되지 않는다. 가장 흔한 오해다.",
          "- ③ 대립가설이 참일 확률도 마찬가지로 p-value 가 말해 주지 않는다.",
          "- ④ \"1종 오류의 허용 한계\"는 p-value 가 아니라 [[significance-level|유의수준(α)]]의 정의다.",
          "",
          "시험에서는 ①과 ④를 섞은 그럴듯한 문장을 정답처럼 배치한다. \"H0가 참일 때 … 데이터가 나올 확률\"이라는 조건부 구조를 기억하라."
        ],
        terms: ["p-value", "significance-level", "null-hypothesis"]
      },
      {
        id: "b-5-q02", node: "b-5", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "귀무가설(null hypothesis)이 실제로 참인데 이를 기각하는 오류를 무엇이라 하는가?",
        choices: ["1종 오류(Type I error)", "2종 오류(Type II error)", "검정력(power)", "표본오차(sampling error)"],
        answer: 0,
        explanation: [
          "**정답: ①** 참인 귀무가설을 잘못 기각하는 것이 [[type-i-error|1종 오류(Type I error)]]이고, 그 확률의 상한이 유의수준 α 다. \"없는 효과를 있다고 하는\" 거짓 양성이다.",
          "",
          "- ② [[type-ii-error|2종 오류(Type II error)]]는 반대로 거짓인 H0를 기각하지 **못하는** 오류(확률 β).",
          "- ③ 검정력(power)은 1 − β 로 오류가 아니라 거짓 H0를 올바르게 기각할 확률이다.",
          "- ④ 표본오차는 표본통계량과 모수의 차이를 뜻하는 일반 용어로 가설검정의 오류 분류가 아니다.",
          "",
          "시험에서는 \"α = 1종 오류 = 거짓 양성, β = 2종 오류 = 거짓 음성, 검정력 = 1 − β\" 세 줄을 표로 외워 두면 어떤 변형이 나와도 답할 수 있다."
        ],
        terms: ["type-i-error", "type-ii-error", "statistical-power"]
      },
      {
        id: "b-5-q03", node: "b-5", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (소수 셋째 자리까지 반올림)",
        code: [
          "from scipy import stats",
          "x = [52, 48, 55, 50, 53, 49, 54, 51]",
          "res = stats.ttest_1samp(x, popmean=50)",
          "print(round(res.statistic, 3), round(res.pvalue, 3))"
        ],
        lang: "python",
        choices: ["0.127 1.732", "1.732 0.064", "1.732 0.127", "-1.732 0.127"],
        answer: 2,
        explanation: [
          "**정답: ③** 표본평균은 51.5, 표본표준편차는 약 2.449(n=8)이므로 [[one-sample-t-test|단일표본 t-검정(one-sample t-test)]]의 검정통계량 t = (51.5 − 50) / (2.449/√8) ≈ 1.732. 자유도 7인 t 분포에서 양측 p-value 는 약 0.127 이다. 유의수준 5%에서 귀무가설(μ = 50)을 기각하지 못한다.",
          "",
          "- ① `statistic`, `pvalue` 순서가 뒤바뀌었다. scipy 결과 객체는 통계량이 먼저다.",
          "- ② 0.064 는 단측(`alternative='greater'`) p-value 다. 기본값은 양측(`two-sided`).",
          "- ④ 표본평균(51.5)이 가설값 50보다 크므로 t 는 양수다.",
          "",
          "시험에서는 \"기본은 양측검정이며 단측 p 는 그 절반\"과 \"결과 객체는 `(statistic, pvalue)`\" 두 가지를 출력 문제로 낸다."
        ],
        terms: ["one-sample-t-test", "p-value", "two-tailed-test"]
      },
      {
        id: "b-5-q04", node: "b-5", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "from scipy import stats",
          "table = [[30, 10], [20, 40]]",
          "chi2, p, dof, expected = stats.chi2_contingency(table)",
          "print(dof, expected[0].tolist())"
        ],
        lang: "python",
        choices: ["1 [25.0, 25.0]", "2 [20.0, 20.0]", "3 [30.0, 10.0]", "1 [20.0, 20.0]"],
        answer: 3,
        explanation: [
          "**정답: ④** `chi2_contingency`는 `(statistic, pvalue, dof, expected)` 순서로 돌려준다. [[degrees-of-freedom|자유도(degrees of freedom)]] = (행 수 − 1)(열 수 − 1) = 1. [[expected-frequency|기대빈도(expected frequency)]] = 행합 × 열합 / 전체 이고, 1행 합 40, 열합 50·50, 전체 100 이므로 1행 기대빈도는 [20.0, 20.0].",
          "",
          "- ① 25 는 전체 100을 4칸에 균등 배분한 값이다. 행합이 40·60으로 다르므로 틀렸다.",
          "- ② 2×2 표의 자유도는 1 이다. 2 는 (행−1)(열−1)이 아니라 행 수를 쓴 실수.",
          "- ③ 3 은 (셀 수 − 1)로 잘못 계산한 값이고, [30.0, 10.0]은 기대빈도가 아니라 **관측빈도**다.",
          "",
          "시험에서는 [[chi-square-test|카이제곱 검정(chi-square test)]] 반환값 네 개의 순서와 기대빈도 공식(행합×열합/n)을 한 문제에 함께 묻는다."
        ],
        terms: ["chi-square-test", "expected-frequency", "degrees-of-freedom"]
      },
      {
        id: "b-5-q05", node: "b-5", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "두 독립 집단의 평균을 비교하려 한다. Levene 검정 결과 p = 0.01로 등분산(equal variance) 가정이 기각되었다. 가장 적절한 검정은?",
        choices: [
          "대응표본 t-검정 `stats.ttest_rel(a, b)`",
          "Welch의 t-검정 `stats.ttest_ind(a, b, equal_var=False)`",
          "Student의 t-검정 `stats.ttest_ind(a, b)`",
          "일원 분산분석 `stats.f_oneway(a, b)`"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[levene-test|Levene 검정]]의 귀무가설은 \"분산이 같다\"이다. p = 0.01 < 0.05 로 기각되었으니 [[equal-variance|등분산성(homogeneity of variance)]]을 가정할 수 없고, 분산이 달라도 되는 [[welch-t-test|Welch의 t-검정(Welch's t-test)]], 즉 `equal_var=False` 를 쓴다.",
          "",
          "- ① 대응표본 t-검정은 같은 대상을 두 번 측정한 짝지어진 자료용이다. 독립 집단에는 쓰지 않는다.",
          "- ③ `equal_var=True`(기본값)인 Student t-검정은 등분산을 전제한다. 가정이 깨졌으므로 부적절.",
          "- ④ 두 집단에 ANOVA 를 쓰면 등분산 Student t 와 같은 결과(F = t²)이며 역시 등분산을 전제한다.",
          "",
          "시험에서는 \"Levene p < 0.05 → `equal_var=False`\"를 한 줄로 외우게 하는 문제가 반복된다. `equal_var` 기본값이 `True` 라는 점도 자주 묻는다."
        ],
        terms: ["welch-t-test", "levene-test", "equal-variance", "independent-t-test"]
      },
      {
        id: "b-5-q06", node: "b-5", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "같은 5명의 교육 전·후 점수에 차이가 있는지 검정하려는 다음 코드에서 **잘못된 점**은?",
        code: [
          "from scipy import stats",
          "before = [80, 85, 78, 90, 88]   # 같은 5명의 교육 전 점수",
          "after  = [82, 88, 80, 91, 90]   # 같은 5명의 교육 후 점수",
          "res = stats.ttest_ind(after, before)",
          "print(res.pvalue < 0.05)"
        ],
        lang: "python",
        choices: [
          "`pvalue` 대신 `p_value` 속성을 써야 한다",
          "두 리스트의 순서를 `(before, after)`로 바꿔야 한다",
          "`equal_var=False`를 반드시 넣어야 한다",
          "같은 대상의 전·후 자료이므로 `ttest_ind`가 아니라 `ttest_rel`을 써야 한다"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** 같은 사람을 두 번 측정한 자료는 짝지어진(paired) 자료다. [[paired-t-test|대응표본 t-검정(paired t-test)]] `ttest_rel` 은 개인별 차이(2, 3, 2, 1, 2)만 보므로 p ≈ 0.003 으로 유의하지만, 독립표본으로 잘못 돌리면 개인차가 오차에 섞여 p ≈ 0.546 으로 전혀 유의하지 않게 나온다.",
          "",
          "- ① scipy 결과 객체의 속성 이름은 `pvalue` 가 맞다.",
          "- ② 순서를 바꾸면 통계량의 부호만 바뀌고 양측 p-value 는 같다. 오류의 원인이 아니다.",
          "- ③ `equal_var` 는 [[independent-t-test|독립 2표본 t-검정]]의 옵션이다. 검정 종류 자체가 잘못됐으니 핵심이 아니다.",
          "",
          "시험에서는 \"같은 대상·전후·사전사후·짝\"이라는 단서가 보이면 `ttest_rel`, \"서로 다른 두 집단\"이면 `ttest_ind` 를 고르는 문제가 반드시 나온다."
        ],
        terms: ["paired-t-test", "independent-t-test"]
      },
      {
        id: "b-5-q07", node: "b-5", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "검정력(statistical power)에 대한 설명으로 옳지 **않은** 것은?",
        choices: [
          "검정력은 1 − β 로, 귀무가설이 거짓일 때 이를 올바르게 기각할 확률이다",
          "다른 조건이 같다면 표본크기가 커질수록 검정력은 커진다",
          "다른 조건이 같다면 유의수준 α 를 0.05 에서 0.01 로 낮추면 검정력은 커진다",
          "실제 효과크기(effect size)가 클수록 검정력은 커진다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** α 를 낮추면 기각역이 좁아져 거짓인 H0도 기각하기 어려워진다. 즉 [[type-ii-error|2종 오류(β)]]가 커지고 [[statistical-power|검정력(power)]] = 1 − β 는 **작아진다**. α 와 β 는 다른 조건이 같을 때 상충(trade-off) 관계다.",
          "",
          "- ① 검정력의 정의 그대로다. 거짓인 H0를 기각하는 '옳은 결정'의 확률.",
          "- ② 표본이 커지면 표준오차가 줄어 작은 차이도 탐지된다. 검정력을 올리는 가장 확실한 방법.",
          "- ④ [[effect-size|효과크기(effect size)]]가 크면 H0와 실제 분포가 멀어져 기각이 쉬워진다.",
          "",
          "시험에서는 \"검정력을 높이는 요인\"으로 표본크기↑·효과크기↑·α↑(완화)·분산↓ 네 가지를 고르게 하고, 그중 α 방향을 거꾸로 쓴 보기를 오답으로 심는다."
        ],
        terms: ["statistical-power", "type-ii-error", "effect-size", "significance-level"]
      },
      {
        id: "b-5-q08", node: "b-5", type: "ox", kind: "concept", difficulty: 1,
        prompt: "p-value 가 0.03 이라는 것은 귀무가설이 참일 확률이 3% 라는 뜻이다.",
        answer: false,
        explanation: [
          "**정답: X** [[p-value|p-value]]는 **귀무가설(null hypothesis)이 참이라고 가정했을 때** 관측치 이상으로 극단적인 결과가 나올 확률이다. 가설이 참일 확률이 아니라 데이터에 관한 조건부 확률이므로 \"H0가 참일 확률 3%\"는 틀린 해석이다.",
          "올바른 문장은 \"H0가 참이라면 이런 데이터가 나올 가능성은 3%에 불과하므로, 유의수준 5%에서 H0를 기각한다\"이다.",
          "",
          "시험에서는 이 오해를 OX 와 4지선다 양쪽으로 반복해서 낸다. 한 문제는 거의 확실히 나온다."
        ],
        terms: ["p-value", "null-hypothesis"]
      },
      {
        id: "b-5-q09", node: "b-5", type: "ox", kind: "concept", difficulty: 2,
        prompt: "t 분포처럼 대칭인 분포를 쓰는 검정에서 검정통계량이 대립가설이 가리키는 방향에 있을 때, 단측검정(one-tailed test)의 p-value 는 양측검정(two-tailed test) p-value 의 절반이다.",
        answer: true,
        explanation: [
          "**정답: O** [[two-tailed-test|양측검정(two-tailed test)]]은 분포의 양쪽 꼬리 확률을 합치므로, 대칭 분포에서는 한쪽 꼬리 확률(= [[one-tailed-test|단측검정(one-tailed test)]] p-value)의 정확히 2배다. 예컨대 양측 p = 0.127 이면 같은 방향의 단측 p = 0.064.",
          "단, 통계량이 대립가설과 **반대** 방향에 있으면 단측 p = 1 − (양측 p / 2) 로 0.5보다 커진다. scipy 에서는 `alternative='less'|'greater'` 로 방향을 지정한다.",
          "",
          "시험에서는 \"단측으로 바꾸면 p 가 어떻게 되는가\"를 수치로 묻는다. 방향이 맞을 때만 절반이라는 조건을 놓치지 말 것."
        ],
        terms: ["one-tailed-test", "two-tailed-test", "p-value"]
      },
      {
        id: "b-5-q10", node: "b-5", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 인자 이름을 쓰시오. 등분산을 가정하지 않는 Welch의 t-검정: `stats.ttest_ind(a, b, ____=False)`",
        answer: "equal_var",
        accept: ["equal_var=False"],
        explanation: [
          "**정답: equal_var** `ttest_ind` 의 `equal_var` 인자는 기본값이 `True`(Student t, 합동분산 사용)이고, `False` 로 주면 두 집단의 분산이 다르다고 보는 [[welch-t-test|Welch의 t-검정(Welch's t-test)]]을 수행한다. 자유도가 Welch–Satterthwaite 식으로 보정되어 정수가 아닌 값이 나온다.",
          "[[levene-test|Levene 검정]]에서 등분산이 기각되었을 때, 또는 표본크기가 많이 다를 때 `equal_var=False` 를 쓴다.",
          "",
          "시험에서는 코드 빈칸으로 `equal_var` 를 묻거나, \"기본값이 True 인가 False 인가\"를 OX 로 낸다."
        ],
        terms: ["welch-t-test", "equal-variance"]
      },
      {
        id: "b-5-q11", node: "b-5", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 숫자로 쓰시오.",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "table = np.array([[10, 20, 30, 40],",
          "                  [15, 25, 35, 45],",
          "                  [20, 30, 40, 50]])",
          "chi2, p, dof, expected = stats.chi2_contingency(table)",
          "print(dof)"
        ],
        lang: "python",
        answer: "6",
        explanation: [
          "**정답: 6** [[chi-square-test|카이제곱 독립성 검정(chi-square test of independence)]]의 [[degrees-of-freedom|자유도(degrees of freedom)]]는 (행 수 − 1) × (열 수 − 1) 이다. 3행 4열이므로 (3 − 1)(4 − 1) = 2 × 3 = 6. `chi2_contingency` 는 세 번째 반환값으로 이 자유도를 돌려준다.",
          "셀 수 12 에서 1을 뺀 11 이나, 행·열 수를 그대로 곱한 12 로 착각하기 쉽다. 각 행합·열합이 고정되어 있어 자유롭게 정할 수 있는 셀이 6개라는 뜻이다.",
          "",
          "시험에서는 분할표 크기만 주고 자유도를 묻거나, 출력 문제에서 `dof` 값을 보기로 낸다."
        ],
        terms: ["degrees-of-freedom", "chi-square-test", "contingency-table"]
      },
      {
        id: "b-5-q12", node: "b-5", type: "short", kind: "concept", difficulty: 3,
        prompt: "일원 분산분석(one-way ANOVA)에서 귀무가설이 기각된 뒤, **어느 집단 쌍**의 평균이 다른지 모든 쌍을 비교하는 가장 대표적인 사후검정(post-hoc test)의 이름을 쓰시오. (영문)",
        answer: "tukey",
        accept: ["tukeyhsd", "tukeyshsd", "tukey-hsd", "pairwise_tukeyhsd", "tukeyhonest"],
        explanation: [
          "**정답: Tukey** (Tukey HSD) ANOVA 의 F 검정은 \"적어도 한 쌍은 다르다\"만 알려 준다. 어느 쌍인지 보려면 [[post-hoc-test|사후검정(post-hoc test)]]이 필요하고, 모든 쌍을 1종 오류 누적 없이 비교하는 표준 방법이 [[tukey-hsd|Tukey HSD(Honestly Significant Difference)]]다. statsmodels 의 `pairwise_tukeyhsd(values, groups)` 로 수행한다.",
          "Bonferroni 는 사후검정에도 쓸 수 있지만 범용 [[bonferroni-correction|다중비교 보정]]이라 보수적이고, Scheffé·Dunnett 은 특수 상황용이다.",
          "",
          "시험에서는 \"ANOVA 후 사후검정 → Tukey\", \"비교 횟수로 α 나누기 → Bonferroni\" 짝을 묻는다."
        ],
        terms: ["tukey-hsd", "post-hoc-test", "anova"]
      },

      /* ────────────────────────────────────────────────
         필기 문제 — b-5-2 이해도 점검 (20) : mcq 12 / ox 3 / short 5, 난이도 6:10:4, output 8
         ──────────────────────────────────────────────── */
      {
        id: "b-5-2-q01", node: "b-5-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "어느 회사가 \"신규 광고 후 일평균 매출이 **증가**했다\"를 통계적으로 입증하려 한다. 귀무가설(H0)과 대립가설(H1)을 옳게 세운 것은? (μ: 광고 후 일평균 매출, μ0: 광고 전 일평균 매출)",
        choices: [
          "H0: μ > μ0, H1: μ = μ0",
          "H0: μ = μ0, H1: μ > μ0",
          "H0: μ ≠ μ0, H1: μ = μ0",
          "H0: μ = μ0, H1: μ ≠ μ0"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[null-hypothesis|귀무가설(null hypothesis)]]은 \"변화가 없다\"는 현상 유지 주장으로 항상 등호를 포함하고, [[alternative-hypothesis|대립가설(alternative hypothesis)]]은 연구자가 보이려는 주장이다. \"증가했다\"는 방향이 있으므로 H1: μ > μ0 인 [[one-tailed-test|단측검정]]이다.",
          "",
          "- ① 등호 없는 부등식을 귀무가설에 두었다. H0는 등호를 포함해야 한다.",
          "- ③ H0와 H1이 뒤바뀌었다. 입증하려는 주장은 대립가설에 둔다.",
          "- ④ 양측검정의 가설이다. \"다르다\"를 보이려 할 때 쓰고, \"증가했다\"를 보이려면 단측이 맞다.",
          "",
          "시험에서는 문장 속 \"증가/감소/개선\"(단측) 과 \"차이가 있다/다르다\"(양측) 단서를 읽고 H1을 세우게 한다."
        ],
        terms: ["null-hypothesis", "alternative-hypothesis", "one-tailed-test"]
      },
      {
        id: "b-5-2-q02", node: "b-5-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "유의수준(significance level) α = 0.05 의 의미로 가장 적절한 것은?",
        choices: [
          "대립가설이 참일 확률이 5% 이다",
          "표본평균이 모평균과 다를 확률이 5% 이다",
          "귀무가설이 참인데도 기각하는 1종 오류를 최대 5% 까지 허용한다",
          "귀무가설이 거짓인데 기각하지 못하는 2종 오류를 5% 로 통제한다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[significance-level|유의수준(significance level, α)]]은 검정 전에 연구자가 정하는 [[type-i-error|1종 오류(Type I error)]] 확률의 상한이다. p-value 가 α 보다 작을 때 기각한다는 규칙을 쓰면, H0가 참일 때 잘못 기각할 확률이 α 를 넘지 않는다.",
          "",
          "- ① 가설이 참일 확률은 빈도주의 검정이 다루는 양이 아니다.",
          "- ② 표본평균은 거의 항상 모평균과 다르다. 유의수준과 무관한 서술.",
          "- ④ 2종 오류 확률은 β 이며 α 로 직접 통제되지 않는다. β 는 표본크기·효과크기에 따라 달라진다.",
          "",
          "시험에서는 \"α = 1종 오류 허용 한계\", \"p < α → 기각\" 두 문장을 뒤섞은 보기 사이에서 정확한 정의를 고르게 한다."
        ],
        terms: ["significance-level", "type-i-error", "type-ii-error"]
      },
      {
        id: "b-5-2-q03", node: "b-5-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "유의수준 5% 에서 검정한 결과 p-value = 0.032 였다. 올바른 결론 문장은?",
        choices: [
          "p < 0.05 이므로 귀무가설을 기각한다",
          "p < 0.05 이므로 귀무가설을 채택한다",
          "p > 0.01 이므로 귀무가설을 기각하지 못한다",
          "p-value 가 0.05 보다 작으므로 대립가설이 참임이 증명되었다"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 판정 규칙은 [[p-value|p-value]] < [[significance-level|유의수준(α)]] 이면 귀무가설 기각이다. 0.032 < 0.05 이므로 \"유의수준 5%에서 귀무가설을 기각한다\"가 표준 보고 문장이다.",
          "",
          "- ② p 가 작으면 기각이다. '채택'은 방향이 반대이며, 가설검정에서는 H0를 '채택'한다는 표현 자체를 피한다.",
          "- ③ 기준은 문제에 주어진 α = 0.05 다. 임의로 0.01 과 비교하면 안 된다.",
          "- ④ 기각은 \"H0와 데이터가 양립하기 어렵다\"는 뜻이지 H1의 증명이 아니다. 1종 오류 가능성이 α 만큼 남아 있다.",
          "",
          "시험에서는 결론 문장을 고르는 문제에서 \"채택\", \"증명\" 같은 단어가 들어간 보기를 오답으로 심는다."
        ],
        terms: ["p-value", "significance-level", "null-hypothesis"]
      },
      {
        id: "b-5-2-q04", node: "b-5-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (통계량은 소수 셋째, p-value 는 소수 넷째 자리까지 반올림)",
        code: [
          "from scipy import stats",
          "a = [23, 25, 28, 22, 26, 24]",
          "b = [30, 27, 29, 31, 28, 32]",
          "res = stats.ttest_ind(a, b)",
          "print(round(res.statistic, 3), round(res.pvalue, 4))"
        ],
        lang: "python",
        choices: ["4.143 0.002", "-4.143 0.998", "-4.143 0.002", "-4.143 0.001"],
        answer: 2,
        explanation: [
          "**정답: ③** [[independent-t-test|독립 2표본 t-검정(independent two-sample t-test)]]에서 통계량은 (a 평균 − b 평균) 방향으로 계산된다. a 평균 24.67 < b 평균 29.5 이므로 t 는 음수(−4.143)이고, 자유도 10인 양측 p-value 는 0.0020 이다. 유의수준 5%에서 두 집단 평균이 같다는 귀무가설을 기각한다.",
          "",
          "- ① 첫 인자 a 가 더 작으므로 부호는 음수다. 인자 순서를 바꾸면 +4.143.",
          "- ② 0.998 은 `alternative='greater'`(a > b 를 대립가설로)로 방향을 거꾸로 잡았을 때의 단측 p 다.",
          "- ④ 0.001 은 `alternative='less'` 단측 p(양측의 절반)다. 기본값은 양측.",
          "",
          "시험에서는 통계량의 **부호**(첫 인자 − 둘째 인자)와 **양측 기본**을 동시에 묻는 출력 문제가 나온다."
        ],
        terms: ["independent-t-test", "two-tailed-test", "test-statistic"]
      },
      {
        id: "b-5-2-q05", node: "b-5-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (통계량은 소수 셋째, p-value 는 소수 넷째 자리까지 반올림)",
        code: [
          "from scipy import stats",
          "before = [80, 85, 78, 90, 88]",
          "after  = [82, 88, 80, 91, 90]",
          "res = stats.ttest_rel(after, before)",
          "print(round(res.statistic, 3), round(res.pvalue, 4))"
        ],
        lang: "python",
        choices: ["6.325 0.0032", "-6.325 0.0032", "2.0 0.0032", "6.325 0.0016"],
        answer: 0,
        explanation: [
          "**정답: ①** [[paired-t-test|대응표본 t-검정(paired t-test)]]은 쌍별 차이 d = after − before = [2, 3, 2, 1, 2] 에 대한 단일표본 t-검정과 같다. 평균 2, 표준편차 √0.5 ≈ 0.707 이므로 t = 2 / (0.707/√5) ≈ 6.325, 자유도 4 양측 p ≈ 0.0032.",
          "",
          "- ② 첫 인자가 `after`(큰 쪽)이므로 차이 평균은 양수, t 도 양수다.",
          "- ③ 2.0 은 차이의 평균이지 검정통계량이 아니다.",
          "- ④ 0.0016 은 단측 p-value. 기본값은 양측이다.",
          "",
          "시험에서는 `ttest_rel(x, y)` 가 `ttest_1samp(x - y, 0)` 과 같다는 사실과 자유도가 n − 1 = 4(10 − 2 가 아님)라는 점을 묻는다."
        ],
        terms: ["paired-t-test", "one-sample-t-test", "degrees-of-freedom"]
      },
      {
        id: "b-5-2-q06", node: "b-5-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "table = np.array([[40, 10],",
          "                  [20, 30]])",
          "chi2, p, dof, expected = stats.chi2_contingency(table)",
          "print(expected[1].tolist())"
        ],
        lang: "python",
        choices: ["[20.0, 30.0]", "[30.0, 20.0]", "[25.0, 25.0]", "[30.0, 30.0]"],
        answer: 1,
        explanation: [
          "**정답: ②** [[expected-frequency|기대빈도(expected frequency)]] = 행합 × 열합 / 전체. 2행 합 50, 열합 60·40, 전체 100 이므로 2행 기대빈도는 [50×60/100, 50×40/100] = [30.0, 20.0]. 두 행의 행합이 같아(50, 50) 1행 기대빈도도 똑같이 [30, 20] 이다.",
          "",
          "- ① [20.0, 30.0] 은 2행의 **관측빈도**다. 기대빈도와 혼동하면 안 된다.",
          "- ③ 25 는 열합이 50·50 일 때의 값이다. 여기서 열합은 60·40.",
          "- ④ 기대빈도의 행합은 관측 행합(50)과 같아야 하므로 합이 60인 [30, 30]은 불가능하다.",
          "",
          "시험에서는 [[contingency-table|분할표(contingency table)]] 한 칸의 기대빈도를 직접 계산하게 하거나, `expected` 배열을 보기로 낸다. 행합·열합이 보존된다는 점으로 오답을 빨리 걸러라."
        ],
        terms: ["expected-frequency", "contingency-table", "chi-square-test"]
      },
      {
        id: "b-5-2-q07", node: "b-5-2", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은?",
        code: [
          "from scipy import stats",
          "a = [23, 25, 28, 22, 26, 24]",
          "b = [30, 27, 29, 31, 28, 32]",
          "p_two     = stats.ttest_ind(a, b).pvalue",
          "p_less    = stats.ttest_ind(a, b, alternative='less').pvalue",
          "p_greater = stats.ttest_ind(a, b, alternative='greater').pvalue",
          "print(round(p_less / p_two, 2), round(p_less + p_greater, 2))"
        ],
        lang: "python",
        choices: ["2.0 1.0", "0.5 0.5", "1.0 2.0", "0.5 1.0"],
        answer: 3,
        explanation: [
          "**정답: ④** t 통계량은 −4.143 으로 음수, 즉 `alternative='less'`(a < b) 방향에 있다. 대칭인 t 분포에서 그 방향의 [[one-tailed-test|단측 p]] 는 [[two-tailed-test|양측 p]] 의 절반이므로 비율은 0.5. 그리고 `less` 와 `greater` 의 p 는 분포 전체를 둘로 나눈 것이라 합이 항상 1.0 이다(연속 분포).",
          "",
          "- ① 2.0 은 양측/단측 비율을 거꾸로 계산한 값이다.",
          "- ② 두 단측 p 의 합은 0.5 가 아니라 1 이다. 한쪽이 0.001 이면 다른 쪽은 0.999.",
          "- ③ 단측 p 가 양측 p 와 같아지는 경우는 없다.",
          "",
          "시험에서는 `alternative` 인자 세 값(`two-sided`, `less`, `greater`)의 관계를 \"p_less + p_greater = 1\", \"방향이 맞는 단측 p = 양측 p / 2\" 두 식으로 묻는다."
        ],
        terms: ["one-tailed-test", "two-tailed-test", "p-value"]
      },
      {
        id: "b-5-2-q08", node: "b-5-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (통계량은 소수 둘째 자리까지 반올림)",
        code: [
          "from scipy import stats",
          "g1 = [5, 6, 7, 6, 5]",
          "g2 = [8, 9, 7, 8, 9]",
          "g3 = [5, 7, 6, 6, 5]",
          "res = stats.f_oneway(g1, g2, g3)",
          "print(round(res.statistic, 2), res.pvalue < 0.05)"
        ],
        lang: "python",
        choices: ["13.71 False", "2.74 True", "13.71 True", "0.0008 True"],
        answer: 2,
        explanation: [
          "**정답: ③** [[anova|일원 분산분석(one-way ANOVA)]]의 F 통계량은 집단 간 분산 / 집단 내 분산이다. 집단 평균 5.8, 8.2, 5.8 로 g2 가 뚜렷이 높아 집단 간 분산이 크고, F ≈ 13.71, p ≈ 0.0008 < 0.05 이므로 `True`. \"세 집단 평균이 모두 같다\"는 귀무가설을 기각한다.",
          "",
          "- ① F 값은 맞지만 p ≈ 0.0008 이므로 비교 결과는 `True` 다.",
          "- ② 2.74 는 분모·분자를 뒤바꾸거나 자유도를 잘못 쓴 값이다.",
          "- ④ 0.0008 은 p-value 다. 첫 출력은 `statistic` 이어야 한다.",
          "",
          "시험에서는 `f_oneway` 가 집단을 **각각 위치 인자**로 받는다는 점, 결과가 유의하면 [[tukey-hsd|Tukey]] 사후검정으로 이어진다는 점을 묻는다."
        ],
        terms: ["anova", "test-statistic", "tukey-hsd"]
      },
      {
        id: "b-5-2-q09", node: "b-5-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "세 가지 독립된 교육 방식(A, B, C)에 따른 시험 점수의 평균이 모두 같은지 검정하려 한다. 각 집단이 정규성과 등분산성을 만족한다고 할 때 가장 적절한 검정은?",
        choices: [
          "일원 분산분석(one-way ANOVA) `stats.f_oneway(a, b, c)`",
          "독립 2표본 t-검정을 세 쌍(A-B, B-C, A-C)에 각각 수행",
          "카이제곱 독립성 검정 `stats.chi2_contingency`",
          "대응표본 t-검정 `stats.ttest_rel`"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 세 개 이상 독립 집단의 **평균** 비교는 [[anova|일원 분산분석(one-way ANOVA)]]이 표준이다. 전체 검정 하나로 \"적어도 한 집단은 다르다\"를 판정하고, 유의하면 [[post-hoc-test|사후검정]]으로 쌍을 비교한다.",
          "",
          "- ② t-검정을 세 번 반복하면 각 5% 의 1종 오류가 누적되어 전체 오류율이 약 14% 까지 커진다([[multiple-comparison|다중비교 문제]]).",
          "- ③ 카이제곱 검정은 범주형 변수 사이의 관계(빈도)를 보는 검정이다. 연속형 점수의 평균 비교에는 쓰지 않는다.",
          "- ④ 대응표본 t-검정은 같은 대상의 두 측정값 비교용이다. 집단이 셋이고 서로 독립이므로 부적절.",
          "",
          "시험에서는 \"집단 수(2 vs 3+) × 대응 여부 × 데이터 유형(연속 vs 범주)\" 조합으로 검정 선택 문제를 낸다. 3집단 평균 → ANOVA 를 바로 떠올려라."
        ],
        terms: ["anova", "multiple-comparison", "post-hoc-test"]
      },
      {
        id: "b-5-2-q10", node: "b-5-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "모수 검정과 그에 대응하는 비모수 검정(nonparametric test)의 짝으로 옳지 **않은** 것은?",
        choices: [
          "독립 2표본 t-검정 — Mann-Whitney U 검정",
          "대응표본 t-검정 — Wilcoxon 부호순위 검정",
          "일원 분산분석 — Kruskal-Wallis 검정",
          "카이제곱 독립성 검정 — Shapiro-Wilk 검정"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[shapiro-wilk-test|Shapiro-Wilk 검정]]은 \"표본이 정규분포에서 왔다\"를 귀무가설로 하는 **정규성 검정**이지 카이제곱 검정의 비모수 대응이 아니다. 카이제곱 검정은 범주형 빈도를 다루므로 이미 분포 가정이 거의 없다(기대빈도 5 이상 조건은 있다).",
          "",
          "- ① [[mann-whitney-u|Mann-Whitney U]](`stats.mannwhitneyu`)는 독립 두 집단의 분포 위치를 순위로 비교한다. 옳은 짝.",
          "- ② [[wilcoxon-signed-rank|Wilcoxon 부호순위]](`stats.wilcoxon`)는 짝지어진 차이의 순위를 쓴다. 옳은 짝.",
          "- ③ [[kruskal-wallis|Kruskal-Wallis]](`stats.kruskal`)는 3집단 이상 순위 비교로 ANOVA 의 비모수판. 옳은 짝.",
          "",
          "시험에서는 이 세 짝을 표로 묻고, 정규성 검정(Shapiro)·등분산 검정(Levene)을 비모수 검정인 것처럼 끼워 넣어 오답을 만든다."
        ],
        terms: ["nonparametric-test", "mann-whitney-u", "wilcoxon-signed-rank", "kruskal-wallis", "shapiro-wilk-test"]
      },
      {
        id: "b-5-2-q11", node: "b-5-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "성별(`gender`)과 흡연 여부(`smoke`)가 독립인지 카이제곱 검정하려는 다음 코드는 `TypeError` 를 낸다. 올바른 수정은?",
        code: [
          "import pandas as pd",
          "from scipy import stats",
          "df = pd.DataFrame({'gender': ['M','F','M','F','M','F','M','F'],",
          "                   'smoke':  ['Y','N','Y','N','N','N','Y','Y']})",
          "chi2, p, dof, expected = stats.chi2_contingency(df['gender'], df['smoke'])"
        ],
        lang: "python",
        choices: [
          "`stats.chisquare(df['gender'], df['smoke'])` 로 바꾼다",
          "`stats.chi2_contingency(pd.crosstab(df['gender'], df['smoke']))` 처럼 분할표를 만들어 넘긴다",
          "반환값을 `chi2, p` 두 개만 받는다",
          "두 컬럼을 0/1 로 인코딩한 뒤 그대로 두 인자로 넘긴다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** `chi2_contingency` 는 **관측빈도 분할표**(2차원 배열) 하나를 받는다. 두 번째 위치 인자는 `correction`(Yates 보정 여부)이라, 문자열 Series 를 넘기면 내부 비교에서 `TypeError` 가 난다. 먼저 `pd.crosstab` 으로 [[contingency-table|분할표(contingency table)]]를 만들어 넘기는 것이 정석이다.",
          "",
          "- ① `chisquare` 는 한 변수의 관측빈도를 기대빈도와 비교하는 **적합도 검정(goodness-of-fit)**이며, 원시 범주 문자열을 받지 않는다.",
          "- ③ 반환값 개수는 오류 원인이 아니다. 입력이 잘못됐다.",
          "- ④ 숫자로 바꿔도 두 컬럼을 두 인자로 넘기는 구조가 그대로이므로 여전히 분할표가 아니다.",
          "",
          "시험에서는 \"[[chi-square-test|카이제곱 독립성 검정]]은 crosstab → chi2_contingency\" 흐름과, 적합도(`chisquare`)·독립성(`chi2_contingency`) 함수 구분을 함께 묻는다."
        ],
        terms: ["chi-square-test", "contingency-table"]
      },
      {
        id: "b-5-2-q12", node: "b-5-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "표본 10만 명씩의 A/B 테스트에서 전환율 차이가 0.01%p 에 불과했지만 p = 0.001 로 나왔다. 가장 적절한 해석은?",
        choices: [
          "p 가 매우 작으므로 광고 효과가 크다고 결론 내린다",
          "p < 0.05 이므로 대립가설이 참임이 증명되었다",
          "표본이 크면 아주 작은 차이도 통계적으로 유의해질 수 있으므로, 효과크기(effect size)와 실질적 의미를 함께 판단해야 한다",
          "표본이 너무 커서 검정 결과 자체를 신뢰할 수 없다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** p-value 는 효과의 **크기**가 아니라 \"차이가 0 이라는 H0와 데이터가 얼마나 양립하기 어려운가\"만 말한다. 표본이 커지면 표준오차가 0 에 가까워져 미세한 차이도 유의해진다. 그래서 통계적 유의성(statistical significance)과 별도로 [[effect-size|효과크기(effect size)]]·신뢰구간·비용 대비 이득 같은 실질적 의미를 봐야 한다.",
          "",
          "- ① p 의 크기와 효과의 크기는 다른 것이다. 0.01%p 는 비즈니스적으로 무의미할 수 있다.",
          "- ② 기각은 증명이 아니다. 1종 오류 가능성이 남아 있고, 효과가 '있다'와 '크다'는 별개다.",
          "- ④ 표본이 크면 검정의 정밀도는 오히려 높아진다. 결과를 못 믿는 것이 아니라 해석을 조심해야 한다.",
          "",
          "시험에서는 \"대표본에서 유의하지만 작은 차이\" 시나리오를 주고 [[statistical-power|검정력]]·효과크기 개념을 아는지 묻는다."
        ],
        terms: ["effect-size", "p-value", "statistical-power"]
      },
      {
        id: "b-5-2-q13", node: "b-5-2", type: "short", kind: "concept", difficulty: 3,
        prompt: "다섯 개의 가설검정을 동시에 수행하면서 전체 유의수준을 0.05 로 유지하려 Bonferroni 보정을 적용한다. 각 검정에 적용할 유의수준을 숫자로 쓰시오.",
        answer: "0.01",
        accept: ["0.010", ".01"],
        explanation: [
          "**정답: 0.01** [[bonferroni-correction|Bonferroni 보정(Bonferroni correction)]]은 비교 횟수 k 에 대해 각 검정의 유의수준을 α / k 로 낮춘다. 0.05 / 5 = 0.01. 같은 뜻으로 각 p-value 에 k 를 곱해 0.05 와 비교해도 된다.",
          "검정을 5번 반복하면 하나라도 잘못 기각할 확률은 1 − 0.95⁵ ≈ 0.226 으로 불어난다([[multiple-comparison|다중비교 문제]]). Bonferroni 는 이 전체 1종 오류율(family-wise error rate)을 α 이하로 묶어 주지만 보수적이어서 검정력이 떨어진다.",
          "",
          "시험에서는 \"비교 k 번, α = 0.05 → 비교당 α 는?\" 또는 \"보정된 p = 원래 p × k\" 로 숫자를 묻는다."
        ],
        terms: ["bonferroni-correction", "multiple-comparison", "significance-level"]
      },
      {
        id: "b-5-2-q14", node: "b-5-2", type: "ox", kind: "output", difficulty: 2,
        prompt: "다음 코드는 `True` 를 출력한다.",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "rng = np.random.default_rng(0)",
          "x = rng.exponential(size=200)",
          "print(stats.shapiro(x).pvalue < 0.05)"
        ],
        lang: "python",
        answer: true,
        explanation: [
          "**정답: O** [[shapiro-wilk-test|Shapiro-Wilk 검정]]의 귀무가설은 \"자료가 정규분포를 따른다\"이다. 지수분포(exponential)는 오른쪽으로 크게 치우친 분포이고 n = 200 이면 검정력이 충분해 p-value 가 10⁻¹² 수준으로 거의 0 이 된다. 따라서 `p < 0.05` 는 `True`, 즉 정규성이 기각된다.",
          "정규성이 깨졌을 때는 [[nonparametric-test|비모수 검정]](Mann-Whitney, Kruskal-Wallis 등)으로 넘어가거나 로그 변환을 고려한다.",
          "",
          "시험에서는 \"Shapiro p < 0.05 → 정규성 기각 → 비모수\" 흐름을, 그리고 H0가 '정규분포다'라는 점을 뒤집어 묻는다."
        ],
        terms: ["shapiro-wilk-test", "nonparametric-test"]
      },
      {
        id: "b-5-2-q15", node: "b-5-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "대립가설(alternative hypothesis)은 연구자가 자료로 입증하고자 하는 주장이며, 검정은 귀무가설을 기각함으로써 이를 간접적으로 지지한다.",
        answer: true,
        explanation: [
          "**정답: O** [[alternative-hypothesis|대립가설(alternative hypothesis, H1)]]은 연구자가 보이려는 \"효과가 있다/다르다\"는 주장이고, [[null-hypothesis|귀무가설(null hypothesis, H0)]]은 그 반대인 \"효과가 없다\"는 기본 전제다. 검정은 H0를 참이라 가정하고 데이터가 얼마나 드문지(p-value) 재서, 충분히 드물면 H0를 기각해 H1을 **간접적으로** 지지한다.",
          "H1을 직접 증명하는 절차가 아니라는 점이 핵심이다. 기각하지 못하면 H1을 지지할 증거가 부족하다는 뜻일 뿐이다.",
          "",
          "시험에서는 \"귀무가설 = 연구자의 주장\"처럼 둘을 뒤바꾼 문장을 OX 로 낸다."
        ],
        terms: ["alternative-hypothesis", "null-hypothesis"]
      },
      {
        id: "b-5-2-q16", node: "b-5-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "Levene 검정의 p-value 가 0.05 보다 **작으면** 등분산 가정이 만족된 것이므로 Student t-검정(`equal_var=True`)을 사용한다.",
        answer: false,
        explanation: [
          "**정답: X** 방향이 반대다. [[levene-test|Levene 검정]]의 귀무가설은 \"두 집단의 분산이 같다\"이므로 p < 0.05 는 [[equal-variance|등분산성(homogeneity of variance)]]이 **기각**된 것이다. 이때는 분산이 달라도 되는 [[welch-t-test|Welch의 t-검정]] `equal_var=False` 를 쓴다. p ≥ 0.05 일 때 등분산을 기각하지 못하므로 Student t 를 쓸 수 있다.",
          "",
          "시험에서는 \"가정 검정(정규성·등분산)에서는 p 가 **커야** 가정이 유지된다\"는 뒤집힌 방향을 노려 OX 를 낸다. 효과 검정과 반대로 읽히는 점을 기억하라."
        ],
        terms: ["levene-test", "equal-variance", "welch-t-test"]
      },
      {
        id: "b-5-2-q17", node: "b-5-2", type: "short", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력을 숫자로 쓰시오.",
        code: [
          "from scipy import stats",
          "chi2, p, dof, expected = stats.chi2_contingency([[20, 30], [30, 20]])",
          "print(expected[0][0])"
        ],
        lang: "python",
        answer: "25.0",
        accept: ["25"],
        explanation: [
          "**정답: 25.0** [[expected-frequency|기대빈도(expected frequency)]] = 행합 × 열합 / 전체. 1행 합 50, 1열 합 50, 전체 100 이므로 50 × 50 / 100 = 25.0. 두 변수가 독립이라면 (1행, 1열) 칸에 25 명이 있어야 한다는 뜻이고, 관측치 20 과의 차이가 카이제곱 통계량에 반영된다.",
          "`expected` 는 numpy 배열이므로 `25.0` 처럼 실수로 출력된다.",
          "",
          "시험에서는 [[chi-square-test|카이제곱 검정]]에서 기대빈도 한 칸을 직접 계산하게 하는 단답이 자주 나온다. 공식 하나로 끝난다."
        ],
        terms: ["expected-frequency", "chi-square-test"]
      },
      {
        id: "b-5-2-q18", node: "b-5-2", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 숫자로 쓰시오. (소수 둘째 자리까지 반올림)",
        code: [
          "from statsmodels.stats.proportion import proportions_ztest",
          "stat, p = proportions_ztest(count=40, nobs=100, value=0.5)",
          "print(round(stat, 2))"
        ],
        lang: "python",
        answer: "-2.04",
        accept: ["-2.040"],
        explanation: [
          "**정답: -2.04** [[proportion-z-test|비율 z-검정(one-proportion z-test)]]의 통계량은 (p̂ − p0) / √(p̂(1 − p̂)/n). 표본비율 p̂ = 0.4, 가설값 0.5, n = 100 이므로 z = −0.1 / √(0.4 × 0.6 / 100) = −0.1 / 0.049 ≈ −2.04. statsmodels 는 기본적으로 분모에 **표본비율** p̂ 을 쓴다(교과서식 p0 를 쓰면 −2.0). 양측 p ≈ 0.041 로 5% 에서 기각.",
          "부호는 p̂ − p0 방향이라 표본비율이 가설값보다 작으면 음수다.",
          "",
          "시험에서는 `proportions_ztest(count, nobs, value)` 의 인자 의미와 \"두 비율 비교는 count·nobs 를 리스트로\"를 묻는다."
        ],
        terms: ["proportion-z-test", "test-statistic"]
      },
      {
        id: "b-5-2-q19", node: "b-5-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 함수 이름을 쓰시오. 같은 고객 30명의 할인 전·후 월 구매액을 비교한다: `stats.____(after, before)`",
        answer: "ttest_rel",
        accept: ["stats.ttest_rel", "scipy.stats.ttest_rel"],
        explanation: [
          "**정답: ttest_rel** 같은 대상을 두 번 측정한 짝지어진 자료는 [[paired-t-test|대응표본 t-검정(paired t-test)]] `stats.ttest_rel` 로 분석한다. 쌍별 차이 after − before 의 평균이 0 인지 보는 것이며, `stats.ttest_1samp(after - before, 0)` 과 같은 결과다.",
          "서로 다른 두 고객 집단이었다면 `ttest_ind`, 집단이 셋 이상이면 `f_oneway` 를 쓴다.",
          "",
          "시험에서는 지문의 \"같은 고객·전후·사전사후\" 단서로 `ttest_rel` 을, \"서로 다른 집단\" 단서로 `ttest_ind` 를 고르게 하는 빈칸 문제가 반복된다."
        ],
        terms: ["paired-t-test", "t-test"]
      },
      {
        id: "b-5-2-q20", node: "b-5-2", type: "short", kind: "concept", difficulty: 3,
        prompt: "세 개 이상의 독립 집단에서 정규성 가정이 깨졌을 때, 일원 분산분석 대신 사용하는 비모수 검정에 해당하는 `scipy.stats` 함수 이름을 쓰시오.",
        answer: "kruskal",
        accept: ["stats.kruskal", "scipy.stats.kruskal", "kruskal-wallis", "kruskalwallis"],
        explanation: [
          "**정답: kruskal** [[kruskal-wallis|Kruskal-Wallis 검정]](`stats.kruskal(g1, g2, g3, ...)`)은 자료를 전체 순위로 바꿔 집단 간 순위 평균이 같은지 보는 [[nonparametric-test|비모수 검정(nonparametric test)]]으로, [[anova|일원 분산분석(one-way ANOVA)]]의 비모수판이다. 정규성·등분산 가정 없이 쓸 수 있고 이상치에 강건하다.",
          "집단이 둘이면 `mannwhitneyu`(독립) 또는 `wilcoxon`(대응)을 쓴다. 세 비모수 검정 모두 `f_oneway` 처럼 집단을 위치 인자로 받는다.",
          "",
          "시험에서는 \"ANOVA ↔ Kruskal-Wallis\", \"독립 t ↔ Mann-Whitney\", \"대응 t ↔ Wilcoxon\" 짝에서 함수 이름을 단답으로 묻는다."
        ],
        terms: ["kruskal-wallis", "nonparametric-test", "anova"]
      }
    ],

    /* ────────────────────────────────────────────────
       실습 과제 — b-5 (2) : 난이도 1·2
       ──────────────────────────────────────────────── */
    practices: [
      {
        id: "b-5-p01", node: "b-5",
        title: "단일표본 t-검정의 p-value",
        difficulty: 1,
        task: [
          "`scores` 는 어느 학급 40명의 시험 점수다. 모평균이 70점이라는 귀무가설(H0: μ = 70)에 대해 **양측** 단일표본 t-검정을 수행하고, p-value 를 소수 넷째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np",
          "from scipy import stats",
          "rng = np.random.default_rng(55)",
          "scores = rng.normal(loc=72, scale=10, size=40).round(1)",
          "scores[:10]"
        ],
        hint: [
          "`stats.ttest_1samp(scores, popmean=70)` 의 `.pvalue` 를 읽는다.",
          "기본값이 양측(`alternative='two-sided'`)이므로 따로 지정하지 않아도 된다."
        ],
        answer: { type: "number", value: 0.0085, decimals: 4 },
        solution: [
          "res = stats.ttest_1samp(scores, popmean=70)",
          "round(res.pvalue, 4)"
        ],
        explanation: [
          "표본평균은 약 75.1, 표본표준편차 약 11.7 이므로 t = (75.1 − 70) / (11.7/√40) ≈ 2.77, 자유도 39 양측 p ≈ 0.0085. 유의수준 5%에서 \"모평균이 70이다\"는 [[null-hypothesis|귀무가설]]을 기각한다.",
          "[[one-sample-t-test|단일표본 t-검정]]은 결과 객체 `TtestResult(statistic, pvalue, df)` 를 돌려주며, `res[1]` 로도 p-value 를 꺼낼 수 있다."
        ],
        terms: ["one-sample-t-test", "p-value", "null-hypothesis"],
        verified: { by: "python", at: "2026-10-04", env: "scipy 1.17.1 / numpy 2.4.6" }
      },
      {
        id: "b-5-p02", node: "b-5",
        title: "요금제와 이탈 여부의 카이제곱 독립성 검정",
        difficulty: 2,
        task: [
          "`df` 에는 고객 300명의 요금제(`plan`: basic/premium)와 이탈 여부(`churn`: yes/no)가 있다. `pd.crosstab` 으로 분할표를 만든 뒤 `stats.chi2_contingency` 를 **기본 인자 그대로** 적용해, 카이제곱 검정통계량(statistic)을 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "from scipy import stats",
          "rng = np.random.default_rng(2025)",
          "n = 300",
          "plan = rng.choice(['basic', 'premium'], size=n, p=[0.6, 0.4])",
          "churn = np.where(plan == 'premium',",
          "                 rng.choice(['yes', 'no'], size=n, p=[0.2, 0.8]),",
          "                 rng.choice(['yes', 'no'], size=n, p=[0.35, 0.65]))",
          "df = pd.DataFrame({'plan': plan, 'churn': churn})",
          "df.head()"
        ],
        hint: [
          "`table = pd.crosstab(df['plan'], df['churn'])` 로 2×2 분할표를 만든다.",
          "`chi2_contingency` 의 반환값은 `(statistic, pvalue, dof, expected)` 순서다. 첫 번째가 통계량."
        ],
        answer: { type: "number", value: 15.262, decimals: 3 },
        solution: [
          "table = pd.crosstab(df['plan'], df['churn'])",
          "chi2, p, dof, expected = stats.chi2_contingency(table)",
          "round(chi2, 3)"
        ],
        explanation: [
          "분할표는 basic(no 118, yes 68) / premium(no 97, yes 17). basic 의 이탈률이 36.6%, premium 이 14.9% 로 크게 달라 [[chi-square-test|카이제곱 독립성 검정]] 통계량 ≈ 15.262, p ≈ 0.0001, [[degrees-of-freedom|자유도]] 1. 유의수준 5%에서 \"요금제와 이탈은 독립이다\"는 귀무가설을 기각한다.",
          "2×2 표에서는 scipy 가 기본 `correction=True`(Yates 연속성 보정)를 적용한다. `correction=False` 로 두면 약 16.311 로 값이 달라지므로, 시험에서 \"기본 인자\"인지 꼭 확인하라.",
          "원본 컬럼 두 개를 그대로 `chi2_contingency` 에 넘기면 오류가 난다. 반드시 [[contingency-table|분할표]]를 먼저 만든다."
        ],
        terms: ["chi-square-test", "contingency-table", "expected-frequency", "degrees-of-freedom"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / scipy 1.17.1" }
      }
    ],

    /* ────────────────────────────────────────────────
       용어 사전 — 이 파일에서 태그·링크한 용어는 전부 여기서 정의
       ──────────────────────────────────────────────── */
    terms: [
      { id: "null-hypothesis", ko: "귀무가설", en: "null hypothesis (H0)",
        def: "검정에서 기본 전제로 두는 \"차이나 효과가 없다\"는 가설. 등호를 포함하며, 데이터가 이를 충분히 반박할 때 기각한다.",
        nodes: ["b-5", "b-5-2"], related: ["alternative-hypothesis", "p-value", "significance-level"] },
      { id: "alternative-hypothesis", ko: "대립가설", en: "alternative hypothesis (H1, Ha)",
        def: "연구자가 자료로 입증하려는 주장. 귀무가설이 기각될 때 간접적으로 지지되며, 방향에 따라 단측·양측으로 나뉜다.",
        nodes: ["b-5", "b-5-2"], related: ["null-hypothesis", "one-tailed-test", "two-tailed-test"] },
      { id: "p-value", ko: "유의확률", en: "p-value",
        def: "귀무가설이 참이라고 가정할 때 관측된 검정통계량 이상으로 극단적인 값이 나올 확률. 유의수준보다 작으면 귀무가설을 기각한다.",
        nodes: ["b-5", "b-5-2"], related: ["significance-level", "test-statistic", "null-hypothesis"] },
      { id: "significance-level", ko: "유의수준", en: "significance level (alpha, α)",
        def: "검정 전에 정하는 1종 오류 확률의 상한. 보통 0.05 를 쓰며, p-value 가 이보다 작을 때 귀무가설을 기각한다.",
        nodes: ["b-5", "b-5-2"], related: ["p-value", "type-i-error", "critical-value"] },
      { id: "test-statistic", ko: "검정통계량", en: "test statistic",
        def: "표본 자료를 하나의 수치로 요약해 귀무가설과의 괴리를 나타내는 값(t, F, 카이제곱, z 등). 그 분포에서 p-value 를 계산한다.",
        nodes: ["b-5", "b-5-2"], related: ["p-value", "critical-value", "rejection-region"] },
      { id: "critical-value", ko: "임계값", en: "critical value",
        def: "유의수준에 대응하는 검정통계량 분포의 경계값. 검정통계량이 임계값을 넘으면(기각역에 들면) 귀무가설을 기각한다.",
        nodes: ["b-5"], related: ["rejection-region", "significance-level", "test-statistic"] },
      { id: "rejection-region", ko: "기각역", en: "rejection region / critical region",
        def: "검정통계량이 그 안에 들어가면 귀무가설을 기각하는 값의 영역. 유의수준 α 에 해당하는 분포의 꼬리 부분이다.",
        nodes: ["b-5"], related: ["critical-value", "significance-level"] },
      { id: "type-i-error", ko: "1종 오류", en: "Type I error (false positive)",
        def: "귀무가설이 참인데 이를 기각하는 오류. 그 확률의 상한이 유의수준 α 다.",
        nodes: ["b-5", "b-5-2"], related: ["type-ii-error", "significance-level", "multiple-comparison"] },
      { id: "type-ii-error", ko: "2종 오류", en: "Type II error (false negative)",
        def: "귀무가설이 거짓인데 이를 기각하지 못하는 오류. 그 확률을 β 라 하고, 1 − β 가 검정력이다.",
        nodes: ["b-5", "b-5-2"], related: ["type-i-error", "statistical-power"] },
      { id: "statistical-power", ko: "검정력", en: "statistical power (1 − β)",
        def: "귀무가설이 거짓일 때 이를 올바르게 기각할 확률. 표본크기·효과크기·유의수준이 커질수록 높아진다.",
        nodes: ["b-5", "b-5-2"], related: ["type-ii-error", "effect-size"] },
      { id: "effect-size", ko: "효과크기", en: "effect size",
        def: "집단 간 차이나 관계의 실제 크기를 표준화해 나타낸 값(Cohen's d 등). p-value 와 달리 표본크기에 직접 의존하지 않아 실질적 의미를 판단하는 데 쓴다.",
        nodes: ["b-5", "b-5-2"], related: ["statistical-power", "p-value"] },
      { id: "one-tailed-test", ko: "단측검정", en: "one-tailed test / one-sided test",
        def: "대립가설이 한 방향(크다 또는 작다)만 주장하는 검정. 기각역이 분포의 한쪽 꼬리에만 있고, scipy 에서는 alternative='less'|'greater' 로 지정한다.",
        nodes: ["b-5", "b-5-2"], related: ["two-tailed-test", "alternative-hypothesis"] },
      { id: "two-tailed-test", ko: "양측검정", en: "two-tailed test / two-sided test",
        def: "대립가설이 \"다르다\"로 방향을 두지 않는 검정. 기각역이 분포의 양쪽 꼬리에 나뉘며 scipy 검정 함수의 기본값이다.",
        nodes: ["b-5", "b-5-2"], related: ["one-tailed-test", "alternative-hypothesis"] },
      { id: "t-test", ko: "t-검정", en: "t-test",
        def: "표본평균을 이용해 모평균에 관한 가설을 t 분포로 검정하는 방법. 단일표본·독립 2표본·대응표본 세 종류가 있다.",
        nodes: ["b-5", "b-5-2"], related: ["one-sample-t-test", "independent-t-test", "paired-t-test"] },
      { id: "one-sample-t-test", ko: "단일표본 t-검정", en: "one-sample t-test (ttest_1samp)",
        def: "한 집단의 평균이 특정 값(popmean)과 같은지 검정하는 t-검정. scipy 의 stats.ttest_1samp 로 수행한다.",
        nodes: ["b-5", "b-5-2"], related: ["t-test", "paired-t-test"] },
      { id: "independent-t-test", ko: "독립 2표본 t-검정", en: "independent two-sample t-test (ttest_ind)",
        def: "서로 독립인 두 집단의 평균이 같은지 검정하는 t-검정. 등분산을 가정하는 Student 방식과 가정하지 않는 Welch 방식이 있다.",
        nodes: ["b-5", "b-5-2"], related: ["t-test", "welch-t-test", "equal-variance"] },
      { id: "welch-t-test", ko: "Welch의 t-검정", en: "Welch's t-test (equal_var=False)",
        def: "두 집단의 분산이 다르다고 보고 자유도를 보정한 독립 2표본 t-검정. scipy 에서는 ttest_ind(a, b, equal_var=False) 로 수행한다.",
        nodes: ["b-5", "b-5-2"], related: ["independent-t-test", "levene-test", "equal-variance"] },
      { id: "paired-t-test", ko: "대응표본 t-검정", en: "paired t-test (ttest_rel)",
        def: "같은 대상을 두 번 측정한 짝지어진 자료에서 쌍별 차이의 평균이 0 인지 검정하는 t-검정. scipy 의 stats.ttest_rel 로 수행한다.",
        nodes: ["b-5", "b-5-2"], related: ["t-test", "one-sample-t-test", "wilcoxon-signed-rank"] },
      { id: "equal-variance", ko: "등분산성", en: "homogeneity of variance / equal variance",
        def: "비교하는 집단들의 모분산이 같다는 가정. Student t-검정과 ANOVA 가 전제하며, Levene 검정 등으로 확인한다.",
        nodes: ["b-5", "b-5-2"], related: ["levene-test", "welch-t-test"] },
      { id: "anova", ko: "분산분석", en: "ANOVA (analysis of variance, f_oneway)",
        def: "세 개 이상 집단의 평균이 모두 같은지 집단 간 분산과 집단 내 분산의 비(F 통계량)로 검정하는 방법. 일원 분산분석은 scipy 의 stats.f_oneway 로 수행한다.",
        nodes: ["b-5", "b-5-2"], related: ["post-hoc-test", "tukey-hsd", "kruskal-wallis"] },
      { id: "post-hoc-test", ko: "사후검정", en: "post-hoc test",
        def: "분산분석에서 귀무가설이 기각된 뒤 어느 집단 쌍의 평균이 다른지 알아보는 추가 검정. Tukey HSD, Bonferroni 등이 있다.",
        nodes: ["b-5", "b-5-2"], related: ["anova", "tukey-hsd", "multiple-comparison"] },
      { id: "tukey-hsd", ko: "Tukey 사후검정", en: "Tukey HSD (honestly significant difference)",
        def: "분산분석 뒤 모든 집단 쌍의 평균 차이를 전체 1종 오류율을 유지하며 비교하는 대표적 사후검정. statsmodels 의 pairwise_tukeyhsd 로 수행한다.",
        nodes: ["b-5", "b-5-2"], related: ["post-hoc-test", "anova", "bonferroni-correction"] },
      { id: "chi-square-test", ko: "카이제곱 검정", en: "chi-square test (chi2_contingency, chisquare)",
        def: "범주형 자료의 관측빈도와 기대빈도의 차이를 카이제곱 분포로 검정하는 방법. 적합도 검정(chisquare)과 독립성·동질성 검정(chi2_contingency)이 있다.",
        nodes: ["b-5", "b-5-2"], related: ["contingency-table", "expected-frequency", "degrees-of-freedom"] },
      { id: "contingency-table", ko: "분할표", en: "contingency table / cross tabulation",
        def: "두 범주형 변수의 조합별 빈도를 행과 열로 정리한 표. pandas 의 pd.crosstab 으로 만들며 카이제곱 독립성 검정의 입력이다.",
        nodes: ["b-5", "b-5-2"], related: ["chi-square-test", "expected-frequency"] },
      { id: "expected-frequency", ko: "기대빈도", en: "expected frequency",
        def: "두 변수가 독립이라고 가정할 때 분할표의 각 칸에 기대되는 빈도. 행합 × 열합 / 전체 로 계산한다.",
        nodes: ["b-5", "b-5-2"], related: ["chi-square-test", "contingency-table"] },
      { id: "degrees-of-freedom", ko: "자유도", en: "degrees of freedom (df, dof)",
        def: "통계량 계산에서 자유롭게 변할 수 있는 값의 개수. t-검정은 n − 1, 카이제곱 독립성 검정은 (행 수 − 1)(열 수 − 1) 이다.",
        nodes: ["b-5", "b-5-2"], related: ["chi-square-test", "t-test"] },
      { id: "proportion-z-test", ko: "비율 z-검정", en: "proportion z-test (proportions_ztest)",
        def: "표본비율이 특정 값과 같은지, 또는 두 집단의 비율이 같은지 정규근사로 검정하는 방법. statsmodels 의 proportions_ztest 로 수행한다.",
        nodes: ["b-5", "b-5-2"], related: ["test-statistic", "chi-square-test"] },
      { id: "shapiro-wilk-test", ko: "샤피로-윌크 정규성 검정", en: "Shapiro-Wilk test (shapiro)",
        def: "표본이 정규분포에서 나왔다는 귀무가설을 검정하는 정규성 검정. p-value 가 작으면 정규성이 기각되어 비모수 검정을 고려한다.",
        nodes: ["b-5", "b-5-2"], related: ["nonparametric-test", "levene-test"] },
      { id: "levene-test", ko: "르빈 등분산 검정", en: "Levene's test (levene)",
        def: "여러 집단의 분산이 같다는 귀무가설을 검정하는 등분산 검정. p-value 가 작으면 등분산이 기각되어 Welch t-검정 등을 쓴다.",
        nodes: ["b-5", "b-5-2"], related: ["equal-variance", "welch-t-test", "shapiro-wilk-test"] },
      { id: "nonparametric-test", ko: "비모수 검정", en: "nonparametric test",
        def: "모집단 분포(정규성 등)를 가정하지 않고 주로 순위를 이용해 검정하는 방법. Mann-Whitney U, Wilcoxon, Kruskal-Wallis 가 대표적이다.",
        nodes: ["b-5", "b-5-2"], related: ["mann-whitney-u", "wilcoxon-signed-rank", "kruskal-wallis"] },
      { id: "mann-whitney-u", ko: "맨-휘트니 U 검정", en: "Mann-Whitney U test (mannwhitneyu)",
        def: "독립인 두 집단의 분포 위치가 같은지 순위로 비교하는 비모수 검정. 독립 2표본 t-검정의 비모수 대응이다.",
        nodes: ["b-5", "b-5-2"], related: ["nonparametric-test", "independent-t-test"] },
      { id: "wilcoxon-signed-rank", ko: "윌콕슨 부호순위 검정", en: "Wilcoxon signed-rank test (wilcoxon)",
        def: "짝지어진 두 측정값의 차이를 부호와 순위로 검정하는 비모수 검정. 대응표본 t-검정의 비모수 대응이다.",
        nodes: ["b-5", "b-5-2"], related: ["nonparametric-test", "paired-t-test"] },
      { id: "kruskal-wallis", ko: "크루스칼-왈리스 검정", en: "Kruskal-Wallis test (kruskal)",
        def: "세 개 이상 독립 집단의 분포 위치가 같은지 순위로 검정하는 비모수 검정. 일원 분산분석의 비모수 대응이다.",
        nodes: ["b-5", "b-5-2"], related: ["nonparametric-test", "anova"] },
      { id: "multiple-comparison", ko: "다중비교 문제", en: "multiple comparisons problem",
        def: "여러 검정을 반복하면 하나라도 잘못 기각할 전체 1종 오류율이 커지는 문제. Bonferroni 보정이나 Tukey 사후검정으로 통제한다.",
        nodes: ["b-5", "b-5-2"], related: ["bonferroni-correction", "type-i-error", "post-hoc-test"] },
      { id: "bonferroni-correction", ko: "본페로니 보정", en: "Bonferroni correction",
        def: "k 번 검정할 때 각 검정의 유의수준을 α / k 로 낮춰 전체 1종 오류율을 α 이하로 묶는 다중비교 보정. 단순하지만 보수적이다.",
        nodes: ["b-5", "b-5-2"], related: ["multiple-comparison", "significance-level", "tukey-hsd"] }
    ]
  });
})();
