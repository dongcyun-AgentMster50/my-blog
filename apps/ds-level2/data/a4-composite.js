/* ds-level2 — 파트 A 4장 "복합 사용법" (a-4-1 ~ a-4-4) 콘텐츠.
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회,
   태그·링크한 용어는 전부 이 파일에서 정의. 실습 정답은 Python 으로 실행 검증(verified 참고). */
(function () {
  DS2.register({
    chapter: "a-4",

    /* ============================================================
       요약 카드
       ============================================================ */
    cards: {
      "a-4-1": {
        node: "a-4-1",
        title: "다중 컬럼 및 전처리",
        summary: [
          "한 컬럼씩 손보던 전처리를 **여러 컬럼에 한 번에** 적용하는 것이 이 토픽의 핵심이다.",
          "`select_dtypes`로 수치형/범주형을 가르고, 수치형에는 중앙값 대치·[[iqr|IQR]] 이상치 처리·표준화를, 범주형에는 [[one-hot-encoding|원핫 인코딩]]을 적용한다.",
          "sklearn의 [[column-transformer|ColumnTransformer]]가 이 분기를 한 객체로 묶어 주고, `train_test_split` **뒤에** 훈련 데이터에만 `fit`해야 [[data-leakage|데이터 누수]]가 없다.",
          "파생변수(날짜 분해, 다중 조건 라벨링, groupby 집계 딕셔너리)와 상관행렬 기반 [[multicollinearity|다중공선성]] 제거까지가 시험 범위다."
        ],
        concepts: [
          "**dtype 기반 컬럼 분리**: `df.select_dtypes(include='number')` / `exclude='number'`. `bool`은 `number`에 포함되지 않는다.",
          "**다중 컬럼 결측 처리**: `df[num] = df[num].fillna(df[num].median())` — Series를 넘기면 컬럼별로 각자의 중앙값이 들어간다. 컬럼별로 다른 값은 딕셔너리로.",
          "**IQR 이상치 다중 컬럼**: `Q1`, `Q3`를 DataFrame 단위로 구하고 `((num < lo) | (num > hi)).any(axis=1)`로 한 행이라도 벗어나면 제거.",
          "**ColumnTransformer**: `[('num', StandardScaler(), num_cols), ('cat', OneHotEncoder(), cat_cols)]` — 결과 열 수 = 수치 열 수 + 범주 수 합계.",
          "**누수 방지 순서**: 분리 → 훈련에 `fit_transform` → 테스트에 `transform`. 전체 데이터에 먼저 `fit`하면 테스트 분포가 학습에 새어 들어간다.",
          "**파생변수**: `dt.year/month/dayofweek/quarter`, `np.select(조건리스트, 값리스트, default)`, `np.where`, `pd.cut`.",
          "**다중 컬럼 집계**: `groupby('k').agg({'a': ['mean', 'max'], 'b': 'min'})` → 컬럼이 MultiIndex.",
          "**상관 기반 변수 제거**: `corr().abs()`의 상삼각에서 임계값(예: 0.9) 초과 쌍 중 **하나만** 제거."
        ],
        terms: ["missing-value", "outlier", "iqr", "column-transformer", "one-hot-encoding", "standardization", "data-leakage", "train-test-split", "feature-engineering", "correlation-matrix", "multicollinearity", "vif"],
        patterns: [
          {
            title: "수치/범주 분리 후 결측 일괄 처리",
            lang: "python",
            code: [
              "num = df.select_dtypes(include='number').columns",
              "cat = df.select_dtypes(exclude='number').columns",
              "df[num] = df[num].fillna(df[num].median())",
              "df[cat] = df[cat].fillna('unknown')"
            ],
            note: "`median()`은 컬럼별 Series 를 돌려주므로 `fillna`가 컬럼별로 맞춰 채운다."
          },
          {
            title: "IQR 기준 이상치 행 제거 (여러 컬럼 동시)",
            lang: "python",
            code: [
              "num = df.select_dtypes(include='number')",
              "q1, q3 = num.quantile(0.25), num.quantile(0.75)",
              "iqr = q3 - q1",
              "mask = ((num < q1 - 1.5 * iqr) | (num > q3 + 1.5 * iqr)).any(axis=1)",
              "clean = df[~mask]"
            ],
            note: "`any(axis=1)` 은 '한 컬럼이라도 벗어나면'. `all(axis=1)` 과 혼동하지 말 것."
          },
          {
            title: "ColumnTransformer + Pipeline (누수 없는 순서)",
            lang: "python",
            code: [
              "from sklearn.compose import ColumnTransformer",
              "from sklearn.preprocessing import StandardScaler, OneHotEncoder",
              "from sklearn.pipeline import Pipeline",
              "X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)",
              "ct = ColumnTransformer([",
              "    ('num', StandardScaler(), num_cols),",
              "    ('cat', OneHotEncoder(handle_unknown='ignore'), cat_cols),",
              "])",
              "pipe = Pipeline([('prep', ct), ('clf', LogisticRegression(max_iter=1000))])",
              "pipe.fit(X_tr, y_tr)",
              "pipe.score(X_te, y_te)"
            ],
            note: "Pipeline 안에서는 `fit` 이 훈련 데이터에만 적용되고 테스트는 `transform` 만 되므로 누수가 구조적으로 막힌다."
          },
          {
            title: "날짜 다중 피처 + 다중 조건 라벨링",
            lang: "python",
            code: [
              "d = pd.to_datetime(df['date'])",
              "df['year'], df['month'], df['dow'] = d.dt.year, d.dt.month, d.dt.dayofweek",
              "df['is_weekend'] = (d.dt.dayofweek >= 5).astype(int)",
              "conds = [df['score'] >= 90, df['score'] >= 70]",
              "df['grade'] = np.select(conds, ['A', 'B'], default='C')"
            ],
            note: "`np.select` 는 **먼저 참이 되는 조건**의 값을 고른다. 조건 순서가 결과를 바꾼다."
          },
          {
            title: "다중 컬럼 groupby 집계 딕셔너리",
            lang: "python",
            code: [
              "g = df.groupby('dept').agg({'sal': ['mean', 'max'], 'age': 'min'})",
              "g.columns = ['_'.join(c) for c in g.columns]   # MultiIndex 평탄화",
              "g = g.reset_index()"
            ]
          },
          {
            title: "상관행렬로 고상관 변수 하나만 제거",
            lang: "python",
            code: [
              "c = df.corr(numeric_only=True).abs()",
              "upper = c.where(np.triu(np.ones(c.shape), k=1).astype(bool))",
              "drop = [col for col in upper.columns if (upper[col] > 0.9).any()]",
              "df = df.drop(columns=drop)"
            ],
            note: "상삼각(upper triangle)만 보는 이유: 대각(1.0)과 대칭 중복을 빼기 위해."
          }
        ],
        pitfalls: [
          "`select_dtypes(include='number')` 에 `bool` 컬럼은 들어가지 않는다. 숫자처럼 보여도 dtype 이 `object` 인 컬럼도 빠진다.",
          "스케일러·인코더를 **분리 전 전체 데이터**에 `fit` 하면 데이터 누수(data leakage). 시험의 '문제점 찾기' 단골.",
          "`OneHotEncoder` 기본 출력은 희소행렬(sparse). `shape` 는 같지만 `.toarray()` 없이 DataFrame 으로 바로 못 만든다. (sklearn 1.2+: `sparse_output=False`)",
          "고상관 쌍은 **둘 중 하나만** 제거한다. 둘 다 지우면 정보가 사라진다.",
          "`np.select` 의 조건은 **위에서부터** 평가된다. `>= 70` 을 먼저 두면 90점도 'B' 가 된다."
        ]
      },

      "a-4-2": {
        node: "a-4-2",
        title: "모델 평가 및 변수 선택",
        summary: [
          "분류는 [[confusion-matrix|혼동행렬]]에서 정밀도·재현율·F1 을 **직접 유도**할 수 있어야 하고, 확률 기반 지표인 [[roc-auc|ROC-AUC]] 와 임계값 조정의 관계를 알아야 한다.",
          "회귀는 [[rmse|RMSE]]·MAE·MAPE·R²·조정 R² 의 정의와 '언제 어느 지표가 유리한가'가 출제된다.",
          "[[cross-validation|교차검증]]과 [[overfitting|과적합]]·편향-분산 개념으로 모델을 진단하고, [[feature-selection|변수 선택]]은 **필터·래퍼·임베디드** 세 갈래로 분류해 외운다."
        ],
        concepts: [
          "**혼동행렬**: sklearn 은 행=실제, 열=예측. `[[TN, FP], [FN, TP]]` 순서. 정밀도 = TP/(TP+FP), 재현율 = TP/(TP+FN), F1 = 2PR/(P+R).",
          "**ROC/AUC**: 임계값을 바꾸며 FPR-TPR 을 그린 곡선의 아래 면적. 0.5 = 무작위, 1.0 = 완벽. `roc_auc_score(y, model.predict_proba(X)[:, 1])`.",
          "**임계값 조정**: 기본 0.5. 낮추면 양성 예측이 늘어 재현율↑ 정밀도↓, 높이면 반대. 불균형 데이터에서는 PR 곡선이 더 민감하다.",
          "**회귀 지표**: MSE 의 제곱근이 RMSE(단위가 원래 값과 같음), MAE 는 이상치에 덜 민감, MAPE 는 실제값이 0 근처면 폭발, R² 는 설명력, 조정 R² = 1 − (1−R²)(n−1)/(n−k−1).",
          "**교차검증**: `cross_val_score(scoring='f1')`, `cross_validate(scoring=['accuracy', 'f1'])` 는 키가 `test_accuracy`, `test_f1` 로 바뀐다.",
          "**과적합/과소적합**: 훈련↑ 검증↓ 이면 과적합(분산 큼), 둘 다 낮으면 과소적합(편향 큼). 규제·데이터 증가·단순화로 분산을 줄인다.",
          "**변수 선택 3분류**: 필터(상관계수, `SelectKBest(f_classif/chi2)`), 래퍼([[rfe|RFE]], 전진/후진 선택), 임베디드([[lasso|Lasso]] 계수 0, 트리 `feature_importances_`).",
          "**다중공선성 VIF**: 1/(1−R²_j). 보통 10 이상(엄격하면 5)이면 문제. 변수 하나를 빼고 다시 계산한다."
        ],
        terms: ["confusion-matrix", "precision", "recall", "f1-score", "roc-auc", "threshold", "rmse", "adjusted-r-squared", "cross-validation", "overfitting", "feature-selection", "rfe"],
        patterns: [
          {
            title: "분류 지표 한 번에",
            lang: "python",
            code: [
              "from sklearn.metrics import confusion_matrix, classification_report, roc_auc_score",
              "pred = model.predict(X_te)",
              "proba = model.predict_proba(X_te)[:, 1]",
              "print(confusion_matrix(y_te, pred))         # [[TN, FP], [FN, TP]]",
              "print(classification_report(y_te, pred, digits=3))",
              "print(roc_auc_score(y_te, proba))"
            ],
            note: "AUC 는 **확률(또는 점수)** 을 넘겨야 한다. `predict` 결과(0/1)를 넘기면 값이 달라진다."
          },
          {
            title: "임계값 바꿔 예측",
            lang: "python",
            code: [
              "proba = model.predict_proba(X_te)[:, 1]",
              "pred_03 = (proba >= 0.3).astype(int)",
              "from sklearn.metrics import recall_score, precision_score",
              "recall_score(y_te, pred_03), precision_score(y_te, pred_03)"
            ]
          },
          {
            title: "회귀 지표 (RMSE 는 직접 제곱근)",
            lang: "python",
            code: [
              "from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score",
              "rmse = np.sqrt(mean_squared_error(y_te, pred))",
              "mae = mean_absolute_error(y_te, pred)",
              "r2 = r2_score(y_te, pred)",
              "n, k = X_te.shape",
              "adj_r2 = 1 - (1 - r2) * (n - 1) / (n - k - 1)"
            ],
            note: "`mean_squared_error(..., squared=False)` 는 구버전 전용이라 제거되었다. `np.sqrt` 또는 `root_mean_squared_error`(1.4+) 를 쓴다."
          },
          {
            title: "교차검증 다중 scoring",
            lang: "python",
            code: [
              "from sklearn.model_selection import cross_validate",
              "cv = cross_validate(model, X, y, cv=5, scoring=['accuracy', 'f1', 'roc_auc'])",
              "cv['test_accuracy'].mean(), cv['test_f1'].mean(), cv['test_roc_auc'].mean()"
            ]
          },
          {
            title: "변수 선택: 필터 / 래퍼 / 임베디드",
            lang: "python",
            code: [
              "from sklearn.feature_selection import SelectKBest, f_classif, RFE",
              "sk = SelectKBest(f_classif, k=5).fit(X_tr, y_tr)          # 필터",
              "cols_filter = X_tr.columns[sk.get_support()]",
              "rfe = RFE(LogisticRegression(max_iter=5000), n_features_to_select=5).fit(X_tr, y_tr)   # 래퍼",
              "cols_rfe = X_tr.columns[rfe.support_]",
              "lasso = Lasso(alpha=1.0).fit(X_tr, y_tr)                 # 임베디드",
              "cols_lasso = X_tr.columns[lasso.coef_ != 0]"
            ],
            note: "`get_support()` 는 bool 마스크, `get_support(indices=True)` 는 인덱스 배열."
          },
          {
            title: "VIF 계산",
            lang: "python",
            code: [
              "from statsmodels.stats.outliers_influence import variance_inflation_factor",
              "Xc = sm.add_constant(X)",
              "vif = pd.Series([variance_inflation_factor(Xc.values, i) for i in range(Xc.shape[1])], index=Xc.columns)",
              "vif.drop('const')"
            ]
          }
        ],
        pitfalls: [
          "정밀도와 재현율의 분모를 바꿔 쓰는 실수. 정밀도는 **예측 양성** 중, 재현율은 **실제 양성** 중.",
          "`roc_auc_score` 에 0/1 예측을 넘기면 정답과 다른 값. 반드시 `predict_proba[:, 1]`.",
          "조정 R² 는 변수를 추가해도 **감소할 수 있다**. R² 는 절대 감소하지 않는다.",
          "`cross_validate` 다중 scoring 결과에 `test_score` 키는 없다 → KeyError.",
          "Lasso(L1) 는 계수를 정확히 0 으로 만들어 변수를 선택하지만, Ridge(L2) 는 0 으로 만들지 않는다."
        ]
      },

      "a-4-3": {
        node: "a-4-3",
        title: "파라미터 튜닝 및 군집화",
        summary: [
          "[[grid-search|GridSearchCV]]/`RandomizedSearchCV` 의 `best_params_`·`best_score_`·`cv_results_` 를 읽고, [[pipeline|파이프라인]] 안의 파라미터를 `'단계명__파라미터'` 로 지정하는 법이 전반부다.",
          "후반부는 비지도 학습: [[kmeans|K-means]] 의 `inertia_`·`labels_`·`cluster_centers_`, [[elbow-method|엘보우]]와 [[silhouette-score|실루엣]]으로 k 결정, [[dbscan|DBSCAN]]·계층적 군집·[[pca|PCA]] 개념.",
          "군집·PCA 는 거리 기반이므로 **스케일링이 먼저**고, 랜덤 초기화가 있는 알고리즘은 `random_state` 와 `n_init` 을 명시한다."
        ],
        concepts: [
          "**GridSearchCV**: 모든 조합 × cv 폴드 수만큼 학습. `best_params_`(딕셔너리), `best_score_`(교차검증 평균 점수, 훈련 점수 아님), `best_estimator_`(refit 된 모델), `cv_results_['mean_test_score']`.",
          "**RandomizedSearchCV**: `n_iter` 번만 무작위 샘플링. 조합이 많거나 연속 분포(`scipy.stats.uniform`)를 탐색할 때.",
          "**파이프라인 파라미터 이름**: `Pipeline([('scaler', ...), ('clf', LogisticRegression())])` 이면 `{'clf__C': [0.1, 1, 10]}`. 밑줄 두 개.",
          "**주요 하이퍼파라미터 의미**: `C`(로지스틱/SVM, 클수록 규제 약함), `alpha`(Ridge/Lasso, 클수록 규제 강함), `max_depth`·`n_estimators`(트리 깊이·개수), `learning_rate`(부스팅 보폭), [[early-stopping|조기 종료]].",
          "**K-means**: `n_clusters`, `init='k-means++'`, `n_init`(초기화 반복 후 최저 inertia 선택), `inertia_`(군집 내 제곱합 WCSS), `labels_`, `cluster_centers_`.",
          "**k 결정**: 엘보우 = k 별 `inertia_` 꺾임점. 실루엣 = `silhouette_score(X, labels)` (−1~1, 클수록 좋음) 최대인 k.",
          "**DBSCAN**: `eps`(이웃 반경), `min_samples`(핵심점 조건, 자기 자신 포함). 군집 수를 미리 정하지 않고 노이즈는 `-1`.",
          "**계층적 군집 / PCA**: `linkage`(ward·complete·average) 와 덴드로그램 자르기. PCA 는 `explained_variance_ratio_` 누적합으로 성분 수 결정."
        ],
        terms: ["hyperparameter", "grid-search", "pipeline", "early-stopping", "kmeans", "inertia", "elbow-method", "silhouette-score", "dbscan", "hierarchical-clustering", "pca", "standardization"],
        patterns: [
          {
            title: "Pipeline + GridSearchCV",
            lang: "python",
            code: [
              "from sklearn.model_selection import GridSearchCV",
              "pipe = Pipeline([('scaler', StandardScaler()), ('svc', SVC())])",
              "grid = {'svc__C': [0.1, 1, 10], 'svc__gamma': ['scale', 0.01]}",
              "gs = GridSearchCV(pipe, grid, cv=5, scoring='accuracy').fit(X_tr, y_tr)",
              "gs.best_params_, round(gs.best_score_, 4)",
              "pd.DataFrame(gs.cv_results_)[['params', 'mean_test_score', 'rank_test_score']]"
            ],
            note: "`best_score_` 는 **교차검증 평균**. 테스트 점수는 `gs.score(X_te, y_te)` 로 따로 본다."
          },
          {
            title: "RandomizedSearchCV",
            lang: "python",
            code: [
              "from sklearn.model_selection import RandomizedSearchCV",
              "from scipy.stats import randint",
              "rs = RandomizedSearchCV(RandomForestClassifier(random_state=0),",
              "                        {'n_estimators': randint(50, 300), 'max_depth': [3, 5, None]},",
              "                        n_iter=10, cv=5, random_state=42).fit(X_tr, y_tr)",
              "rs.best_params_"
            ]
          },
          {
            title: "K-means + 엘보우 + 실루엣",
            lang: "python",
            code: [
              "from sklearn.cluster import KMeans",
              "from sklearn.metrics import silhouette_score",
              "Xs = StandardScaler().fit_transform(X)",
              "for k in range(2, 7):",
              "    km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(Xs)",
              "    print(k, round(km.inertia_, 1), round(silhouette_score(Xs, km.labels_), 4))"
            ],
            note: "실루엣은 k=1 에서 정의되지 않으므로 반드시 2 부터."
          },
          {
            title: "DBSCAN 군집 수와 노이즈 수",
            lang: "python",
            code: [
              "from sklearn.cluster import DBSCAN",
              "labels = DBSCAN(eps=0.5, min_samples=5).fit_predict(Xs)",
              "n_clusters = len(set(labels)) - (1 if -1 in labels else 0)",
              "n_noise = (labels == -1).sum()"
            ]
          },
          {
            title: "PCA 성분 수 결정",
            lang: "python",
            code: [
              "from sklearn.decomposition import PCA",
              "pca = PCA().fit(Xs)",
              "cum = np.cumsum(pca.explained_variance_ratio_)",
              "n_comp = int(np.argmax(cum >= 0.8) + 1)",
              "X2 = PCA(n_components=2).fit_transform(Xs)"
            ],
            note: "`PCA(n_components=0.8)` 처럼 0~1 실수를 주면 누적 설명 비율 기준으로 성분 수를 자동 선택한다."
          },
          {
            title: "계층적 군집 (scipy)",
            lang: "python",
            code: [
              "from scipy.cluster.hierarchy import linkage, fcluster, dendrogram",
              "Z = linkage(Xs, method='ward')",
              "labels = fcluster(Z, t=3, criterion='maxclust')"
            ]
          }
        ],
        pitfalls: [
          "`best_score_` 를 '테스트 정확도' 로 읽는 실수. 교차검증 평균이다.",
          "파이프라인 파라미터 이름은 `clf__C` (밑줄 2개). `clf_C`, `clf.C` 는 ValueError.",
          "스케일 차이가 큰 컬럼을 그대로 K-means 에 넣으면 큰 컬럼이 거리를 지배한다.",
          "`KMeans` 는 `random_state` 없이 실행하면 `labels_` 번호와 `inertia_` 가 바뀔 수 있다. 시험 코드엔 늘 `random_state` 가 있다.",
          "DBSCAN 의 `-1` 은 군집이 아니라 노이즈. 군집 수를 셀 때 빼야 한다."
        ]
      },

      "a-4-4": {
        node: "a-4-4",
        title: "통계 검정 및 특수 모델링",
        summary: [
          "검정은 **선택 흐름도**로 외운다: 정규성([[normality-test|Shapiro]]) → 등분산([[levene-test|Levene]]) → 모수 검정([[t-test|t-검정]]/[[anova|ANOVA]]) 또는 비모수(Mann-Whitney/Kruskal-Wallis). 범주 vs 범주는 [[chi-square-test|카이제곱]].",
          "대응표본, 사후검정(Tukey), [[bonferroni-correction|Bonferroni]] 다중비교 보정, 효과크기, 회귀진단은 '검정 결과를 어떻게 해석하고 보완하는가' 로 출제된다.",
          "특수 모델링은 개념 위주: [[odds-ratio|오즈비]] 해석, 포아송 회귀, 시계열 분해·[[arima|ARIMA(p,d,q)]]·[[adf-test|ADF]] 정상성, 생존분석, A/B 테스트 설계와 [[statistical-power|검정력]]/표본크기."
        ],
        concepts: [
          "**검정 선택 흐름**: 두 독립 집단 평균 → 정규·등분산 `ttest_ind` / 정규·이분산 `ttest_ind(equal_var=False)`(Welch) / 비정규 `mannwhitneyu`. 세 집단 이상 → `f_oneway` / `kruskal`. 같은 대상 전후 → `ttest_rel` / `wilcoxon`.",
          "**카이제곱**: 독립성 `chi2_contingency(crosstab)` (2×2 는 기본 Yates 보정 `correction=True`), 적합도 `chisquare(observed, expected)`. 자유도 = (행−1)(열−1).",
          "**사후검정·보정**: ANOVA 유의 → Tukey HSD(`pairwise_tukeyhsd`). 여러 검정 동시 → Bonferroni(α/m), Holm, FDR(BH). `multipletests(p, method='bonferroni')`.",
          "**효과크기**: p값은 표본이 크면 작아진다. Cohen's d(평균 차/합동 표준편차: 0.2 작음·0.5 중간·0.8 큼), η², Cramér's V 로 크기를 따로 본다.",
          "**로지스틱 회귀 해석**: 계수 β 의 `exp(β)` 가 오즈비. x 가 1 증가할 때 오즈가 exp(β) 배. 1 보다 크면 양성 확률 증가.",
          "**포아송 회귀**: 건수(count) 종속변수. 로그 링크, `exp(β)` 는 기대 건수의 배율. 과산포면 음이항 회귀.",
          "**시계열**: `seasonal_decompose` 로 추세·계절·잔차 분해. ADF 검정 귀무가설은 '단위근 존재(비정상)' → p < 0.05 면 정상. ARIMA(p,d,q) = AR 차수, 차분 횟수, MA 차수.",
          "**A/B 테스트**: 표본크기는 효과크기·α·검정력(1−β) 으로 결정. 검정력 0.8, α 0.05 가 관례. 효과가 작을수록 표본이 커진다. 생존분석은 Kaplan-Meier 곡선과 로그순위 검정 개념."
        ],
        terms: ["normality-test", "levene-test", "t-test", "paired-t-test", "anova", "kruskal-wallis", "chi-square-test", "bonferroni-correction", "odds-ratio", "arima", "adf-test", "statistical-power"],
        patterns: [
          {
            title: "정규성 → 등분산 → t-검정 흐름",
            lang: "python",
            code: [
              "from scipy import stats",
              "normal = stats.shapiro(a).pvalue > 0.05 and stats.shapiro(b).pvalue > 0.05",
              "if normal:",
              "    equal = stats.levene(a, b).pvalue > 0.05",
              "    res = stats.ttest_ind(a, b, equal_var=equal)",
              "else:",
              "    res = stats.mannwhitneyu(a, b)",
              "res.statistic, res.pvalue"
            ]
          },
          {
            title: "카이제곱 독립성 검정",
            lang: "python",
            code: [
              "ct = pd.crosstab(df['gender'], df['pref'])",
              "chi2, p, dof, expected = stats.chi2_contingency(ct)",
              "round(chi2, 3), round(p, 4), dof"
            ],
            note: "2×2 표는 기본 Yates 연속성 보정이 적용된다. 손계산과 맞추려면 `correction=False`."
          },
          {
            title: "ANOVA → Tukey 사후검정",
            lang: "python",
            code: [
              "from statsmodels.stats.multicomp import pairwise_tukeyhsd",
              "f, p = stats.f_oneway(g1, g2, g3)",
              "print(pairwise_tukeyhsd(df['value'], df['group'], alpha=0.05))"
            ]
          },
          {
            title: "다중비교 보정",
            lang: "python",
            code: [
              "from statsmodels.stats.multitest import multipletests",
              "reject, p_adj, _, alpha_bonf = multipletests(pvals, alpha=0.05, method='bonferroni')"
            ]
          },
          {
            title: "로지스틱 회귀 오즈비",
            lang: "python",
            code: [
              "import statsmodels.api as sm",
              "model = sm.Logit(y, sm.add_constant(X)).fit(disp=0)",
              "odds_ratio = np.exp(model.params)",
              "model.summary()"
            ]
          },
          {
            title: "정상성 검정과 차분",
            lang: "python",
            code: [
              "from statsmodels.tsa.stattools import adfuller",
              "p = adfuller(series)[1]            # p < 0.05 면 정상",
              "diff1 = series.diff().dropna()      # d = 1"
            ]
          },
          {
            title: "A/B 테스트 표본크기",
            lang: "python",
            code: [
              "from statsmodels.stats.power import TTestIndPower",
              "n_per_group = TTestIndPower().solve_power(effect_size=0.5, alpha=0.05, power=0.8)"
            ]
          }
        ],
        pitfalls: [
          "Shapiro p > 0.05 는 '정규성을 기각하지 못함' 이지 '정규임이 증명됨' 이 아니다.",
          "ADF 귀무가설은 **비정상**(단위근 존재). p 가 작아야 정상이다 — 방향을 뒤집어 묻는 문제가 많다.",
          "같은 대상의 전후 비교에 `ttest_ind` 를 쓰면 틀린다. `ttest_rel`.",
          "Bonferroni 는 α 를 m 으로 나누거나 p 에 m 을 곱한다(1 초과는 1 로 자름). 보수적이어서 검정력이 떨어진다.",
          "오즈비 exp(β) 는 '확률이 몇 배' 가 아니라 **오즈가 몇 배** 다."
        ]
      }
    },

    /* ============================================================
       필기 문제
       ============================================================ */
    questions: [
      /* ---------------- a-4-1 다중 컬럼 및 전처리 ---------------- */
      {
        id: "a-4-1-q01", node: "a-4-1", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "DataFrame `df`에서 **수치형(numeric) 컬럼만** 골라내는 코드로 옳은 것은?",
        choices: ["df.select_dtypes('numeric')", "df.select_dtypes(include='number')", "df[df.dtypes == 'number']", "df.select(include='number')"],
        answer: 1,
        explanation: [
          "**정답: ②** `select_dtypes(include='number')`는 `int`, `float` 등 `np.number` 계열 dtype 컬럼만 돌려준다. [[feature-engineering|전처리]]에서 수치형/범주형을 가르는 표준 패턴이다.",
          "",
          "- ① `'numeric'`은 지원하지 않는 이름이라 TypeError 가 난다. `'number'`가 맞다.",
          "- ③ `df.dtypes == 'number'`는 dtype 이름 문자열 비교라 전부 False 가 되고, 그 결과로 행을 걸러 KeyError/빈 결과가 된다.",
          "- ④ `DataFrame.select`라는 메서드는 없다.",
          "",
          "시험에서는 `include`/`exclude` 와 `'number'`, `'object'`, `'category'` 같은 dtype 이름을 묻는 문제로 나온다."
        ],
        terms: ["feature-engineering"]
      },
      {
        id: "a-4-1-q02", node: "a-4-1", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'a': [1, 2], 'b': [1.5, 2.5], 'c': ['x', 'y'], 'd': [True, False]})",
          "print(df.select_dtypes(include='number').columns.tolist())"
        ],
        lang: "python",
        choices: ["['a', 'b']", "['a', 'b', 'd']", "['a']", "['a', 'b', 'c', 'd']"],
        answer: 0,
        explanation: [
          "**정답: ①** `int64`인 `a`와 `float64`인 `b`만 `number`에 속한다. `bool`은 numpy 에서 `np.number`의 하위 타입이 아니라 **제외**된다.",
          "",
          "- ② `d`(bool)가 포함된다고 생각하는 것이 가장 흔한 함정이다. bool 은 `include='bool'`로 따로 고른다.",
          "- ③ float 컬럼 `b`도 수치형이므로 빠질 이유가 없다.",
          "- ④ 문자열 `c`는 `object` dtype 이라 제외된다.",
          "",
          "시험에서는 [[feature-engineering|전처리]] 코드에서 '수치형 컬럼 개수'나 결과 리스트를 묻는 형태로 나온다. bool 컬럼 유무를 꼭 확인하자."
        ],
        terms: ["feature-engineering"]
      },
      {
        id: "a-4-1-q03", node: "a-4-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드에서 `Xt.shape` 의 출력은?",
        code: [
          "import pandas as pd",
          "from sklearn.compose import ColumnTransformer",
          "from sklearn.preprocessing import StandardScaler, OneHotEncoder",
          "df = pd.DataFrame({'x1': [1.0, 2.0, 3.0, 4.0],",
          "                   'x2': [10.0, 20.0, 30.0, 40.0],",
          "                   'cat': ['a', 'b', 'c', 'a']})",
          "ct = ColumnTransformer([('num', StandardScaler(), ['x1', 'x2']),",
          "                        ('cat', OneHotEncoder(), ['cat'])])",
          "Xt = ct.fit_transform(df)",
          "print(Xt.shape)"
        ],
        lang: "python",
        choices: ["(4, 3)", "(4, 4)", "(4, 5)", "(4, 6)"],
        answer: 2,
        explanation: [
          "**정답: ③** [[column-transformer|ColumnTransformer]]는 각 변환 결과를 **가로로 이어 붙인다**. 표준화된 수치 2열 + `cat`의 범주 3개(`a`, `b`, `c`)를 [[one-hot-encoding|원핫 인코딩]]한 3열 = 5열. 행 수 4는 그대로.",
          "",
          "- ① `(4, 3)`은 원본 컬럼 수. 원핫 인코딩이 열을 늘린다는 점을 놓친 답.",
          "- ② `(4, 4)`는 `OneHotEncoder(drop='first')`를 썼을 때의 결과다. 기본값은 `drop=None`.",
          "- ④ `(4, 6)`은 범주를 4개로 잘못 센 경우. `'a'`는 두 번 나오지만 범주는 3개다.",
          "",
          "시험에서는 '변환 후 특성(feature) 개수'를 묻는 문제로 나온다. **수치 열 수 + 범주형 컬럼별 고유값 수 합**으로 계산한다."
        ],
        terms: ["column-transformer", "one-hot-encoding", "standardization"]
      },
      {
        id: "a-4-1-q04", node: "a-4-1", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "훈련/테스트 분리와 표준화(standardization)를 함께 수행할 때, **데이터 누수(data leakage)를 막는** 올바른 순서는?",
        choices: [
          "전체 데이터에 `fit_transform` → 그 결과를 `train_test_split`",
          "전체 데이터에 `fit` → 훈련·테스트 각각 `transform` → 분리",
          "분리 → 훈련·테스트 각각 `fit_transform`",
          "분리 → 훈련에 `fit_transform` → 테스트에는 `transform`만"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[data-leakage|데이터 누수]]를 막으려면 스케일러의 통계(평균·표준편차)를 **훈련 데이터로만** 추정하고, 테스트 데이터는 그 통계로 `transform`만 해야 한다. 실제 운영에서 미래 데이터의 평균을 미리 알 수 없는 상황을 재현하는 것이다.",
          "",
          "- ① 분리 전에 전체에 `fit`하면 테스트 데이터의 분포가 훈련 과정에 새어 들어간다. 전형적인 누수.",
          "- ② 역시 전체에 `fit`한 시점에 누수가 발생한다. 순서만 바꿔도 소용없다.",
          "- ③ 테스트에 따로 `fit`하면 훈련과 **다른 척도**로 변환되어 모델이 엉뚱한 입력을 받는다.",
          "",
          "시험에서는 코드 순서를 보고 '문제점을 고르라'거나 [[train-test-split|train_test_split]] 뒤 `Pipeline`을 쓰는 이유를 묻는다."
        ],
        terms: ["data-leakage", "train-test-split", "standardization"]
      },
      {
        id: "a-4-1-q05", node: "a-4-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np, pandas as pd",
          "df = pd.DataFrame({'score': [95, 72, 55, 88]})",
          "conds = [df['score'] >= 90, df['score'] >= 70]",
          "df['grade'] = np.select(conds, ['A', 'B'], default='C')",
          "print(df['grade'].tolist())"
        ],
        lang: "python",
        choices: ["['A', 'B', 'C', 'C']", "['A', 'B', 'C', 'B']", "['A', 'A', 'C', 'B']", "ValueError"],
        answer: 1,
        explanation: [
          "**정답: ②** `np.select`는 조건 리스트를 **위에서부터** 평가해 처음 참이 되는 조건의 값을 고른다. 95→A, 72→B, 55→어느 조건도 아니라 기본값 C, 88→B. 다중 조건 라벨링([[feature-engineering|파생변수]] 생성)의 표준 코드다.",
          "",
          "- ① 88은 `>= 70`을 만족하므로 C 가 아니라 B.",
          "- ③ 72는 90 미만이라 A 가 될 수 없다.",
          "- ④ 조건 수(2)와 값 수(2)가 같으므로 오류가 나지 않는다.",
          "",
          "시험에서는 조건 순서를 뒤바꾼 코드(`>= 70`을 먼저)를 주고 출력을 묻는 함정이 있다. 그 경우 90점대도 B 가 된다."
        ],
        terms: ["feature-engineering"]
      },
      {
        id: "a-4-1-q06", node: "a-4-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드에서 `r.shape` 의 출력은?",
        code: [
          "import pandas as pd",
          "df = pd.DataFrame({'dept': ['A', 'A', 'B', 'B', 'B'],",
          "                   'sal': [100, 200, 300, 400, 500],",
          "                   'age': [30, 40, 20, 30, 40]})",
          "r = df.groupby('dept').agg({'sal': ['mean', 'max'], 'age': 'min'})",
          "print(r.shape)"
        ],
        lang: "python",
        choices: ["(2, 2)", "(5, 3)", "(2, 3)", "(3, 2)"],
        answer: 2,
        explanation: [
          "**정답: ③** 그룹은 `A`, `B` 두 개(행 2), 집계 결과 컬럼은 `('sal','mean')`, `('sal','max')`, `('age','min')` 세 개(열 3). 집계(aggregation) 딕셔너리에서 **리스트로 준 함수는 각각 한 열**이 된다. 컬럼은 MultiIndex 다.",
          "",
          "- ① `(2, 2)`는 딕셔너리 키 수(2)를 열 수로 잘못 본 것. `sal`에 함수가 2개다.",
          "- ② 행 5는 원본 행 수. `agg`는 그룹 수로 줄어든다(`transform`과 다름).",
          "- ④ 그룹 수는 3이 아니라 2다. `B`가 세 번 나와도 그룹은 하나.",
          "",
          "시험에서는 결과의 컬럼 이름(튜플) 이나 `r.columns = ['_'.join(c) for c in r.columns]`로 평탄화한 뒤의 이름을 묻는다. [[feature-engineering|파생변수]] 생성 단골 코드."
        ],
        terms: ["feature-engineering"]
      },
      {
        id: "a-4-1-q07", node: "a-4-1", type: "mcq", kind: "bug", difficulty: 3,
        prompt: "다음 코드의 **문제점**으로 가장 적절한 것은?",
        code: [
          "from sklearn.preprocessing import StandardScaler",
          "from sklearn.model_selection import train_test_split",
          "scaler = StandardScaler()",
          "X_scaled = scaler.fit_transform(X)",
          "X_tr, X_te, y_tr, y_te = train_test_split(X_scaled, y, test_size=0.2, random_state=42)",
          "model.fit(X_tr, y_tr)",
          "print(model.score(X_te, y_te))"
        ],
        lang: "python",
        choices: [
          "분리 전에 전체 X 로 `fit_transform` 해서 테스트 데이터 정보가 학습에 누수된다",
          "`StandardScaler`는 DataFrame 을 입력으로 받을 수 없다",
          "`train_test_split`의 `test_size`는 정수만 가능하다",
          "`model.score`는 회귀 모델에서만 쓸 수 있다"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 스케일러를 **분리 전 전체 데이터**에 `fit`하면 테스트 행들의 평균·표준편차가 변환에 반영된다. 이것이 [[data-leakage|데이터 누수(data leakage)]]로, 테스트 점수가 실제보다 낙관적으로 나온다. 올바른 순서는 [[train-test-split|분리]] → 훈련에 `fit_transform` → 테스트에 `transform`.",
          "",
          "- ② `StandardScaler`는 DataFrame 과 ndarray 모두 받는다.",
          "- ③ `test_size`는 0~1 실수(비율) 또는 정수(개수) 둘 다 가능하다.",
          "- ④ `score`는 분류기(정확도)·회귀기(R²) 모두에 있다.",
          "",
          "시험에서는 이런 코드를 주고 '문제점을 고르라' 또는 '누수가 없는 코드를 고르라'로 나온다. `Pipeline`을 쓰면 구조적으로 막힌다는 점도 함께 기억."
        ],
        terms: ["data-leakage", "train-test-split", "standardization"]
      },
      {
        id: "a-4-1-q08", node: "a-4-1", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`OneHotEncoder(drop='first')`는 범주 하나를 기준(reference)으로 삭제해 **더미 변수 함정(dummy variable trap)**, 즉 완전한 다중공선성을 피하기 위한 옵션이다.",
        answer: true,
        explanation: [
          "**정답: O** k 개 범주를 k 개 열로 모두 [[one-hot-encoding|원핫 인코딩]]하면 열들의 합이 항상 1 이 되어 선형 모델에서 완전한 [[multicollinearity|다중공선성(multicollinearity)]]이 생긴다. `drop='first'`(pandas 는 `get_dummies(drop_first=True)`)는 첫 범주를 빼 k−1 열로 만든다.",
          "",
          "트리 모델에서는 다중공선성이 문제되지 않으므로 보통 `drop` 없이 쓴다.",
          "",
          "시험에서는 '선형 회귀에 범주형 변수를 넣을 때 범주가 k 개면 더미 변수는 몇 개?' → **k−1** 로 나온다."
        ],
        terms: ["one-hot-encoding", "multicollinearity"]
      },
      {
        id: "a-4-1-q09", node: "a-4-1", type: "ox", kind: "concept", difficulty: 2,
        prompt: "상관행렬(correlation matrix)에서 두 변수의 상관계수 절댓값이 0.95 로 매우 높다면, 다중공선성(multicollinearity)을 줄이기 위해 **두 변수를 모두** 제거해야 한다.",
        answer: false,
        explanation: [
          "**정답: X** 고상관 쌍은 서로 거의 같은 정보를 담고 있으므로 **둘 중 하나만** 제거하면 된다. 둘 다 지우면 그 정보 자체가 사라져 모델 성능이 떨어진다. 보통 [[correlation-matrix|상관행렬]]의 상삼각(upper triangle)만 보고 임계값(0.8~0.9)을 넘는 쌍에서 한쪽을 drop 한다.",
          "",
          "더 정확한 진단은 [[vif|VIF(분산팽창계수)]]로 하며, VIF 가 가장 큰 변수부터 하나씩 제거하고 재계산한다.",
          "",
          "시험에서는 `np.triu` 로 상삼각을 만드는 코드의 빈칸이나 '제거해야 할 컬럼 목록'을 묻는다."
        ],
        terms: ["correlation-matrix", "multicollinearity", "vif"]
      },
      {
        id: "a-4-1-q10", node: "a-4-1", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 속성 이름을 쓰시오. 날짜 컬럼에서 **요일(월요일=0 … 일요일=6)** 을 정수로 뽑는다: `pd.to_datetime(df['date']).dt.____`",
        answer: "dayofweek",
        accept: ["weekday", "day_of_week"],
        explanation: [
          "**정답: dayofweek** `Series.dt.dayofweek`(별칭 `weekday`, `day_of_week`)는 월요일 0 부터 일요일 6 까지의 정수를 돌려준다. 날짜에서 연·월·일·요일·분기 등 여러 [[feature-engineering|파생변수]]를 한 번에 뽑는 전처리의 기본이다.",
          "",
          "- `day_name()`은 `'Monday'` 같은 문자열을 주는 **메서드**(괄호 필요)라 정수 요일이 아니다.",
          "- 주말 플래그는 `(d.dt.dayofweek >= 5).astype(int)`.",
          "",
          "시험에서는 `dayofweek` 와 `day`(일), `dayofyear`(연중 일수)를 섞어 출제한다."
        ],
        terms: ["feature-engineering"]
      },
      {
        id: "a-4-1-q11", node: "a-4-1", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import pandas as pd",
          "print(pd.Timestamp('2024-03-15').dayofweek)"
        ],
        lang: "python",
        answer: "4",
        explanation: [
          "**정답: 4** 2024년 3월 15일은 **금요일**이다. `dayofweek`는 월요일을 0 으로 시작하므로 금요일은 4 다(월0 화1 수2 목3 금4 토5 일6).",
          "",
          "요일 계산은 2024-01-01(월요일)에서 세어도 되고, `pd.Timestamp('2024-03-15').day_name()` 이 `'Friday'` 임을 알면 바로 4 다.",
          "",
          "시험에서는 날짜 [[feature-engineering|파생변수]] 문제에서 `dayofweek` 값과 `isocalendar().week`, `quarter` 를 함께 묻는다. 일요일을 0 으로 착각하지 말 것."
        ],
        terms: ["feature-engineering"]
      },
      {
        id: "a-4-1-q12", node: "a-4-1", type: "short", kind: "concept", difficulty: 3,
        prompt: "선형 모델에서 설명 변수 간 다중공선성(multicollinearity)을 진단하는 지표로, 각 변수를 나머지 변수로 회귀한 R² 를 써서 1/(1−R²) 로 계산하며 **10 이상이면 심각**하다고 보는 지표의 영문 약어를 쓰시오.",
        answer: "VIF",
        accept: ["분산팽창계수", "varianceinflationfactor", "variance inflation factor"],
        explanation: [
          "**정답: VIF** [[vif|분산팽창계수(Variance Inflation Factor)]]는 변수 j 를 다른 설명 변수들로 회귀했을 때의 R²_j 로 1/(1−R²_j) 를 계산한다. 다른 변수로 완벽히 설명되면(R²→1) VIF 가 무한대로 커진다.",
          "",
          "- 관례적 기준: 10 이상 심각(엄격하게는 5). 1 이면 다른 변수와 무관.",
          "- `statsmodels.stats.outliers_influence.variance_inflation_factor(X.values, i)` 로 계산하고, 상수항을 넣은 뒤 `const` 는 제외해 읽는다.",
          "- 상관계수는 **두 변수 간** 관계만 보지만 VIF 는 **여러 변수의 결합**으로 생기는 [[multicollinearity|다중공선성]]까지 잡는다.",
          "",
          "시험에서는 'VIF 10 이상인 변수를 제거' 하는 흐름과 계산식의 빈칸으로 나온다."
        ],
        terms: ["vif", "multicollinearity"]
      },

      /* ---------------- a-4-2 모델 평가 및 변수 선택 ---------------- */
      {
        id: "a-4-2-q01", node: "a-4-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "혼동행렬(confusion matrix)에서 **재현율(recall)** 의 정의로 옳은 것은?",
        choices: ["TP / (TP + FP)", "TP / (TP + FN)", "(TP + TN) / (TP + TN + FP + FN)", "TN / (TN + FP)"],
        answer: 1,
        explanation: [
          "**정답: ②** [[recall|재현율(recall)]]은 **실제 양성** 중 양성으로 맞게 예측한 비율이다. 실제 양성은 TP + FN 이므로 TP/(TP+FN). 민감도(sensitivity), TPR 과 같은 값이다.",
          "",
          "- ① TP/(TP+FP)는 [[precision|정밀도(precision)]] — **예측 양성** 중 실제 양성 비율.",
          "- ③ 전체 중 맞힌 비율은 정확도(accuracy).",
          "- ④ TN/(TN+FP)는 특이도(specificity) — 실제 음성 중 음성으로 맞춘 비율.",
          "",
          "시험에서는 [[confusion-matrix|혼동행렬]] 숫자를 주고 네 지표를 계산하게 하거나, '암 진단처럼 놓치면 안 되는 문제에 중요한 지표' → 재현율을 고르게 한다."
        ],
        terms: ["recall", "precision", "confusion-matrix"]
      },
      {
        id: "a-4-2-q02", node: "a-4-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "from sklearn.metrics import precision_score",
          "y_true = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1]",
          "y_pred = [1, 0, 0, 1, 0, 1, 1, 0, 1, 0]",
          "print(precision_score(y_true, y_pred))"
        ],
        lang: "python",
        choices: ["0.6666666666666666", "0.7272727272727273", "0.8", "0.7"],
        answer: 2,
        explanation: [
          "**정답: ③** 예측이 1 인 자리는 인덱스 0, 3, 5, 6, 8 의 5개. 그중 실제도 1 인 것은 0, 3, 5, 8 의 4개(TP=4), 인덱스 6 은 실제 0 이라 FP=1. [[precision|정밀도]] = TP/(TP+FP) = 4/5 = **0.8**.",
          "",
          "- ① 0.667 은 [[recall|재현율]] — 실제 1 이 6개(TP 4 + FN 2) 이므로 4/6.",
          "- ② 0.727 은 F1 = 2·0.8·0.667/(0.8+0.667).",
          "- ④ 0.7 은 정확도 — 맞힌 개수 7/10.",
          "",
          "시험에서는 이렇게 짧은 두 리스트를 주고 네 지표 중 하나를 고르게 한다. 먼저 [[confusion-matrix|혼동행렬]] `[[TN, FP], [FN, TP]]`를 손으로 그려라."
        ],
        terms: ["precision", "recall", "confusion-matrix", "f1-score"]
      },
      {
        id: "a-4-2-q03", node: "a-4-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "from sklearn.metrics import r2_score",
          "y_true = np.array([3, 5, 7, 9])",
          "y_pred = np.array([2, 5, 8, 11])",
          "print(round(r2_score(y_true, y_pred), 2))"
        ],
        lang: "python",
        choices: ["0.5", "0.85", "1.5", "0.7"],
        answer: 3,
        explanation: [
          "**정답: ④** [[r-squared|R²]] = 1 − SSE/SST. 잔차는 (1, 0, −1, −2) 라 SSE = 1+0+1+4 = 6. 평균은 6 이고 편차 (−3, −1, 1, 3) 의 제곱합 SST = 9+1+1+9 = 20. 1 − 6/20 = **0.7**.",
          "",
          "- ① 0.5 는 SSE 를 잘못 세거나 SST 를 12 로 계산한 경우.",
          "- ② 0.85 는 1 − SSE/(2·SST) 같은 오계산.",
          "- ③ 1.5 는 MSE(= SSE/n = 6/4) 값이다. R² 는 1 을 넘을 수 없다.",
          "",
          "시험에서는 같은 데이터로 [[rmse|RMSE]](√1.5 ≈ 1.22), [[mae|MAE]](1.0), R² 를 함께 묻는다. 세 값을 모두 손으로 낼 수 있어야 한다."
        ],
        terms: ["r-squared", "rmse", "mae"]
      },
      {
        id: "a-4-2-q04", node: "a-4-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "어떤 분류 모델의 훈련 정확도가 0.99, 검증 정확도가 0.75 다. 이 상황에 대한 설명으로 가장 옳은 것은?",
        choices: [
          "과적합(overfitting) 상태로 분산(variance)이 크다. 규제 강화·데이터 추가·모델 단순화가 해법이다",
          "과소적합(underfitting) 상태로 편향(bias)이 크다. 더 복잡한 모델이 필요하다",
          "일반화가 잘 된 이상적인 상태다",
          "데이터 누수(data leakage)가 확실하므로 검증 점수를 믿을 수 없다"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 훈련 점수는 매우 높고 검증 점수가 크게 낮으면 훈련 데이터의 잡음까지 외운 [[overfitting|과적합(overfitting)]]이다. [[bias-variance-tradeoff|편향-분산 트레이드오프]]에서 **분산(variance)이 큰** 쪽. 규제(`C`↓, `alpha`↑), 트리 깊이 제한, 데이터 증가, 특성 축소, 조기 종료가 처방이다.",
          "",
          "- ② 과소적합은 훈련·검증 **둘 다 낮을 때**다. 편향이 큰 상태.",
          "- ③ 24%p 차이는 일반화가 잘 된 것이 아니다.",
          "- ④ 누수가 있으면 보통 **검증 점수가 비정상적으로 높아진다**. 여기서는 반대다.",
          "",
          "시험에서는 (훈련, 검증) 점수 쌍을 주고 과적합/과소적합/적절 중 고르게 하고, 처방을 함께 묻는다."
        ],
        terms: ["overfitting", "bias-variance-tradeoff"]
      },
      {
        id: "a-4-2-q05", node: "a-4-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "변수 선택(feature selection) 기법 중 **래퍼(wrapper) 방식**에 해당하는 것은?",
        choices: ["RFE (Recursive Feature Elimination)", "SelectKBest(f_classif)", "Lasso 회귀의 계수가 0 이 아닌 변수 선택", "타깃과의 상관계수 상위 k 개 선택"],
        answer: 0,
        explanation: [
          "**정답: ①** [[rfe|RFE]]는 모델을 **반복해서 학습**하며 중요도가 낮은 변수를 하나씩 제거하는 래퍼(wrapper) 방식이다. 전진 선택(forward selection)·후진 제거(backward elimination)도 같은 부류다. 모델 성능으로 부분집합을 평가하므로 비용이 크지만 정확하다.",
          "",
          "- ② `SelectKBest` 는 통계량(F값, χ²)으로 변수를 **개별 평가**하는 필터(filter) 방식.",
          "- ③ [[lasso|Lasso]] 는 학습 과정에서 계수를 0 으로 만들어 선택하는 임베디드(embedded) 방식. 트리의 `feature_importances_` 도 임베디드.",
          "- ④ 상관계수 기준 선택은 모델 없이 수행하는 필터 방식.",
          "",
          "시험에서는 [[feature-selection|변수 선택]] 기법 이름을 주고 필터/래퍼/임베디드 중 분류하게 한다."
        ],
        terms: ["feature-selection", "rfe", "lasso"]
      },
      {
        id: "a-4-2-q06", node: "a-4-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "from sklearn.feature_selection import SelectKBest, f_classif",
          "X = np.array([[1, 10, 5], [2, 20, 3], [3, 30, 8],",
          "              [4, 40, 1], [5, 50, 9], [6, 60, 2]])",
          "y = np.array([0, 0, 0, 1, 1, 1])",
          "sk = SelectKBest(f_classif, k=2).fit(X, y)",
          "print(sk.get_support(indices=True))"
        ],
        lang: "python",
        choices: ["[0 2]", "[1 2]", "[0 1]", "[2]"],
        answer: 2,
        explanation: [
          "**정답: ③** 0열(1~6)과 1열(10~60)은 y 가 0 인 앞 세 행이 모두 작고 1 인 뒤 세 행이 모두 크므로 집단 간 분리가 뚜렷해 F 값이 크다(둘은 서로 10배 관계라 F 값도 같다, 13.5). 2열(5,3,8,1,9,2)은 두 집단 평균이 비슷해 F ≈ 0.21. 상위 2개 인덱스는 `[0 1]`.",
          "",
          "- ① `[0 2]`, ② `[1 2]`: 2열은 분리력이 가장 낮아 선택되지 않는다.",
          "- ④ `k=2` 이므로 결과는 반드시 2개다.",
          "",
          "`get_support()` 는 bool 마스크 `[True True False]`, `indices=True` 면 정수 인덱스다. 시험에서는 [[feature-selection|필터 방식]] 변수 선택 결과로 '선택된 컬럼 이름'을 `X.columns[sk.get_support()]` 로 묻는다."
        ],
        terms: ["feature-selection"]
      },
      {
        id: "a-4-2-q07", node: "a-4-2", type: "mcq", kind: "bug", difficulty: 3,
        prompt: "다음 코드를 실행하면 오류가 난다. 원인으로 옳은 것은?",
        code: [
          "from sklearn.model_selection import cross_validate",
          "cv = cross_validate(model, X, y, cv=5, scoring=['accuracy', 'f1'])",
          "print(cv['test_score'].mean())"
        ],
        lang: "python",
        choices: [
          "`scoring`에 리스트를 넘길 수 없다. 문자열 하나만 가능하다",
          "다중 scoring 이면 결과 키가 `test_accuracy`, `test_f1` 처럼 지표명이 붙어 `test_score`는 KeyError",
          "`cv=5`는 분류 문제에 쓸 수 없다",
          "`cross_validate`는 `fit_time`만 반환하고 점수는 반환하지 않는다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** `cross_validate` 에 scoring 을 **여러 개** 주면 반환 딕셔너리의 키가 `test_accuracy`, `test_f1`, `fit_time`, `score_time` 으로 바뀐다. `test_score` 키는 scoring 이 **하나(또는 None)** 일 때만 존재한다. 그래서 KeyError.",
          "",
          "- ① 리스트·튜플·딕셔너리 모두 허용된다. 그것이 `cross_val_score` 와의 차이점이다.",
          "- ③ `cv=5` 는 분류에서 StratifiedKFold 5겹으로 동작한다.",
          "- ④ `test_*` 점수를 반환한다. `return_train_score=True` 면 `train_*` 도.",
          "",
          "시험에서는 [[cross-validation|교차검증]] 결과 딕셔너리의 키 이름을 빈칸으로 묻거나, `cross_val_score`(배열 반환) 와 `cross_validate`(딕셔너리 반환) 의 차이로 나온다."
        ],
        terms: ["cross-validation"]
      },
      {
        id: "a-4-2-q08", node: "a-4-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "ROC 곡선 아래 면적 AUC(Area Under the Curve)가 0.5 이면 무작위로 찍는 분류기와 같은 수준의 성능이다.",
        answer: true,
        explanation: [
          "**정답: O** [[roc-auc|ROC-AUC]]는 임계값을 전부 바꿔 가며 그린 (FPR, TPR) 곡선의 아래 면적이다. 대각선(y = x)은 무작위 분류기이며 그 면적이 0.5. 1.0 이면 완벽한 분리, 0.5 미만이면 레이블을 뒤집은 것보다 못한 상태다.",
          "",
          "AUC 는 '무작위로 뽑은 양성 샘플의 점수가 음성 샘플보다 높을 확률' 로도 해석된다.",
          "",
          "시험에서는 `roc_auc_score(y, model.predict_proba(X)[:, 1])` 코드와 함께 '0.5 의 의미', '임계값에 무관한 지표' 라는 성질을 묻는다."
        ],
        terms: ["roc-auc", "threshold"]
      },
      {
        id: "a-4-2-q09", node: "a-4-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "조정된 결정계수(Adjusted R²)는 설명 변수를 추가하면 **항상** 증가하거나 같다.",
        answer: false,
        explanation: [
          "**정답: X** 항상 증가하는 것은 보통의 [[r-squared|R²]]다. [[adjusted-r-squared|조정 R²]] = 1 − (1−R²)(n−1)/(n−k−1) 은 변수 수 k 에 **벌점**을 주므로, 추가한 변수가 설명력을 충분히 올리지 못하면 **감소**한다. 그래서 변수 개수가 다른 모델을 비교할 때 조정 R² 를 쓴다.",
          "",
          "예: n=100, k=5, R²=0.80 이면 조정 R² = 1 − 0.2·99/94 ≈ 0.789 로 R² 보다 작다.",
          "",
          "시험에서는 'R² 와 조정 R² 중 변수 수가 다른 두 모델의 비교에 적절한 것' 또는 조정 R² 공식의 빈칸(n−k−1)으로 나온다."
        ],
        terms: ["adjusted-r-squared", "r-squared"]
      },
      {
        id: "a-4-2-q10", node: "a-4-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 메서드 이름을 쓰시오. ROC-AUC 는 0/1 예측이 아니라 양성 클래스 **확률**로 계산한다: `roc_auc_score(y_test, model.____(X_test)[:, 1])`",
        answer: "predict_proba",
        accept: ["predict_proba()"],
        explanation: [
          "**정답: predict_proba** [[roc-auc|AUC]] 는 임계값을 움직이며 계산하므로 각 샘플의 **점수(확률)** 가 필요하다. `predict_proba` 는 (n, 클래스 수) 배열을 돌려주고 `[:, 1]` 이 양성 클래스 확률이다.",
          "",
          "- `predict` 결과(0/1)를 넘기면 임계값 0.5 하나에서의 점 하나로 AUC 가 계산되어 값이 달라진다.",
          "- SVM 처럼 확률이 없는 모델은 `decision_function` 점수를 넘겨도 된다.",
          "",
          "시험에서는 `[:, 1]` 을 빼먹거나 `predict` 를 쓴 코드의 문제점을 묻는 형태로도 나온다. [[threshold|임계값]] 조정 문제와 세트."
        ],
        terms: ["roc-auc", "threshold"]
      },
      {
        id: "a-4-2-q11", node: "a-4-2", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "n, k, r2 = 100, 5, 0.80",
          "adj = 1 - (1 - r2) * (n - 1) / (n - k - 1)",
          "print(round(adj, 3))"
        ],
        lang: "python",
        answer: "0.789",
        explanation: [
          "**정답: 0.789** [[adjusted-r-squared|조정 R²(Adjusted R²)]] 공식 1 − (1−R²)(n−1)/(n−k−1) 에 대입하면 1 − 0.2 × 99/94 = 1 − 0.2106 = 0.7894 → 소수 셋째 자리 반올림 0.789.",
          "",
          "- n 은 표본 수, k 는 설명 변수 수. 분모가 `n − k − 1` 인 점(상수항 포함)을 기억.",
          "- 변수를 늘리면 (n−1)/(n−k−1) 이 커져 벌점이 커진다.",
          "",
          "시험에서는 공식의 빈칸이나 'k 가 늘었는데 R² 는 조금만 올랐을 때 조정 R² 가 어떻게 되는가' 로 나온다. [[r-squared|R²]] 와 함께 암기."
        ],
        terms: ["adjusted-r-squared", "r-squared"]
      },
      {
        id: "a-4-2-q12", node: "a-4-2", type: "short", kind: "concept", difficulty: 3,
        prompt: "Lasso 회귀가 일부 계수를 **정확히 0** 으로 만들어 변수 선택(feature selection) 효과를 내는 이유가 되는 규제(regularization) 항의 종류를 쓰시오. (예: L?)",
        answer: "L1",
        accept: ["l1norm", "l1규제", "l1정규화", "l1 regularization"],
        explanation: [
          "**정답: L1** [[lasso|Lasso]] 는 손실에 계수 절댓값의 합 α·Σ|β| (L1 노름) 을 더한다. L1 제약 영역이 꼭짓점이 있는 마름모 모양이라 최적해가 축 위(계수 0)에 놓이기 쉬워 **희소(sparse)** 해가 나온다. 그래서 임베디드 [[feature-selection|변수 선택]] 기법으로 쓴다.",
          "",
          "- Ridge 는 L2(계수 제곱합)를 써서 계수를 **작게 만들지만 0 으로는 만들지 않는다**.",
          "- ElasticNet 은 L1 + L2 혼합(`l1_ratio`).",
          "- `alpha` 가 클수록 규제가 강해 0 이 되는 계수가 늘어난다.",
          "",
          "시험에서는 'Lasso = L1 = 변수 선택', 'Ridge = L2 = 축소만' 의 짝을 묻고, `Lasso(alpha=1.0).fit(X, y)` 뒤 `(coef_ != 0).sum()` 으로 선택된 변수 수를 세는 코드가 나온다."
        ],
        terms: ["lasso", "feature-selection"]
      },

      /* ---------------- a-4-3 파라미터 튜닝 및 군집화 ---------------- */
      {
        id: "a-4-3-q01", node: "a-4-3", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "다음 파이프라인에서 로지스틱 회귀의 규제 강도 `C` 를 GridSearchCV 로 튜닝하려 한다. `param_grid` 의 키로 옳은 것은?",
        code: [
          "pipe = Pipeline([('scaler', StandardScaler()),",
          "                 ('clf', LogisticRegression())])"
        ],
        lang: "python",
        choices: ["'C'", "'LogisticRegression__C'", "'clf__C'", "'clf.C'"],
        answer: 2,
        explanation: [
          "**정답: ③** [[pipeline|파이프라인]] 안의 [[hyperparameter|하이퍼파라미터]]는 `'<단계 이름>__<파라미터>'` 형식으로 지정한다. 단계 이름이 `clf` 이므로 `'clf__C'`. **밑줄 두 개(더블 언더스코어)** 가 핵심이다.",
          "",
          "- ① `'C'` 만 쓰면 Pipeline 자체에 `C` 라는 파라미터가 없어 ValueError.",
          "- ② 클래스 이름이 아니라 **단계에 붙인 이름**을 쓴다.",
          "- ④ 점(`.`) 이 아니라 밑줄 두 개다.",
          "",
          "시험에서는 [[grid-search|GridSearchCV]] 코드의 `param_grid` 빈칸으로 자주 나온다. `ColumnTransformer` 안쪽은 `'prep__num__with_mean'` 처럼 단계가 중첩된다."
        ],
        terms: ["pipeline", "grid-search", "hyperparameter"]
      },
      {
        id: "a-4-3-q02", node: "a-4-3", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "다음 GridSearchCV 는 (refit 을 제외하고) 모델을 **총 몇 번** 학습하는가?",
        code: [
          "grid = {'C': [0.1, 1, 10], 'penalty': ['l1', 'l2']}",
          "gs = GridSearchCV(LogisticRegression(solver='liblinear'), grid, cv=5)",
          "gs.fit(X, y)"
        ],
        lang: "python",
        choices: ["30", "6", "15", "5"],
        answer: 0,
        explanation: [
          "**정답: ①** [[grid-search|그리드 서치]]는 모든 파라미터 **조합** 3 × 2 = 6 가지를 만들고, 각 조합마다 [[cross-validation|교차검증]] 5 폴드씩 학습한다. 6 × 5 = **30** 회. (`refit=True` 기본값이면 최적 조합으로 전체 데이터에 1 회 더 학습해 31 회.)",
          "",
          "- ② 6 은 조합 수(`len(gs.cv_results_['params'])`)다. 폴드를 곱해야 한다.",
          "- ③ 15 는 파라미터 값 개수(3+2=5)에 3 을 곱한 오계산.",
          "- ④ 5 는 폴드 수일 뿐이다.",
          "",
          "시험에서는 '총 fit 횟수' 또는 `cv_results_` 행 수(조합 수) 를 묻는다. 둘을 구분하자. `RandomizedSearchCV` 는 `n_iter × cv`."
        ],
        terms: ["grid-search", "cross-validation"]
      },
      {
        id: "a-4-3-q03", node: "a-4-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "from sklearn.cluster import KMeans",
          "X = np.array([[0.0], [1.0], [10.0], [11.0]])",
          "km = KMeans(n_clusters=2, n_init=10, random_state=0).fit(X)",
          "print(km.inertia_)"
        ],
        lang: "python",
        choices: ["0.5", "1.0", "2.0", "50.5"],
        answer: 1,
        explanation: [
          "**정답: ②** 두 군집은 {0, 1} 과 {10, 11} 로 나뉘고 중심은 0.5 와 10.5 다. [[inertia|inertia(관성, WCSS)]]는 **각 점에서 자기 군집 중심까지 거리의 제곱합**: (0.5² + 0.5²) + (0.5² + 0.5²) = 0.25 × 4 = **1.0**.",
          "",
          "- ① 0.5 는 거리 제곱이 아닌 거리의 합 중 절반, 또는 한 군집만 계산한 값.",
          "- ② … 정답.",
          "- ③ 2.0 은 거리(0.5)를 제곱하지 않고 더한 값.",
          "- ④ 50.5 는 군집 1 개(k=1, 중심 5.5)일 때의 WCSS 다.",
          "",
          "시험에서는 [[kmeans|K-means]] 의 `inertia_` 정의(제곱합)와 k 가 커지면 **단조 감소**한다는 성질, 그래서 [[elbow-method|엘보우]] 가 필요하다는 흐름으로 나온다."
        ],
        terms: ["kmeans", "inertia", "elbow-method"]
      },
      {
        id: "a-4-3-q04", node: "a-4-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "from sklearn.cluster import DBSCAN",
          "X = np.array([[0.0], [0.2], [0.4], [5.0], [10.0], [10.1], [10.2]])",
          "print(DBSCAN(eps=0.5, min_samples=3).fit(X).labels_)"
        ],
        lang: "python",
        choices: ["[0 0 0 1 1 1 1]", "[0 0 0 -1 -1 -1 -1]", "[0 0 0 0 1 1 1]", "[0 0 0 -1 1 1 1]"],
        answer: 3,
        explanation: [
          "**정답: ④** [[dbscan|DBSCAN]] 은 반경 `eps=0.5` 안에 **자기 자신 포함** `min_samples=3` 개 이상 점이 있으면 핵심점(core point)이다. {0, 0.2, 0.4} 는 서로 0.5 이내라 각각 3개씩 → 군집 0. {10, 10.1, 10.2} 도 같은 이유로 군집 1. 5.0 은 반경 안에 자신뿐이라 **노이즈 −1**.",
          "",
          "- ① 5.0 을 군집에 넣었다. 가장 가까운 점(0.4, 10.0)이 4.6 이상 떨어져 있다.",
          "- ② 10 근처 세 점은 조건을 만족하는 핵심점이라 노이즈가 아니다.",
          "- ③ 5.0 은 0.4 와 4.6 떨어져 있어 군집 0 에 붙을 수 없다.",
          "",
          "시험에서는 노이즈 수 `(labels == -1).sum()` 과 군집 수 `len(set(labels)) - (1 if -1 in labels else 0)` 를 묻는다. `min_samples` 에 자기 자신이 포함된다는 점이 함정."
        ],
        terms: ["dbscan"]
      },
      {
        id: "a-4-3-q05", node: "a-4-3", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "K-means 의 군집 수 k 를 정하는 **엘보우 방법(elbow method)** 에서 k 를 바꾸며 그래프의 y 축에 그리는 값은?",
        choices: ["inertia_ (군집 내 제곱합, WCSS)", "silhouette_score", "explained_variance_ratio_", "n_init"],
        answer: 0,
        explanation: [
          "**정답: ①** [[elbow-method|엘보우 방법]]은 k 를 1, 2, 3, … 으로 늘리며 [[inertia|inertia_]](각 점과 소속 중심 간 거리 제곱합)를 그려, 감소 폭이 급격히 줄어드는 **팔꿈치 지점**을 k 로 택한다. inertia 는 k 가 커지면 항상 줄어들기 때문에 '최소값' 이 아니라 '꺾임' 을 본다.",
          "",
          "- ② [[silhouette-score|실루엣 계수]]도 k 선택에 쓰지만, 엘보우가 아니라 **최댓값**인 k 를 고르는 별도 방법이다.",
          "- ③ `explained_variance_ratio_` 는 PCA 의 성분 수 결정에 쓴다.",
          "- ④ `n_init` 은 초기화 반복 횟수 파라미터일 뿐이다.",
          "",
          "시험에서는 '엘보우 → inertia, 실루엣 → 최대' 짝과, 두 방법의 결론이 다를 때의 해석을 묻는다."
        ],
        terms: ["elbow-method", "inertia", "silhouette-score"]
      },
      {
        id: "a-4-3-q06", node: "a-4-3", type: "mcq", kind: "output", difficulty: 2,
        prompt: "PCA 의 성분별 설명 분산 비율이 아래와 같다. 다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "ratio = np.array([0.45, 0.25, 0.15, 0.10, 0.05])   # pca.explained_variance_ratio_",
          "cum = np.cumsum(ratio)",
          "print(int(np.argmax(cum >= 0.8) + 1))"
        ],
        lang: "python",
        choices: ["2", "4", "3", "5"],
        answer: 2,
        explanation: [
          "**정답: ③** 누적합은 [0.45, 0.70, 0.85, 0.95, 1.0]. `cum >= 0.8` 은 [F, F, T, T, T] 이고 `np.argmax` 는 **첫 True 의 인덱스** 2 를 돌려준다. 성분 개수는 인덱스 + 1 = **3**. 즉 [[pca|PCA]] 로 분산의 80% 를 설명하려면 3 개 성분이 필요하다.",
          "",
          "- ① 2 개면 누적 0.70 으로 부족하다.",
          "- ② 4 는 90% 기준이거나 `+1` 을 두 번 더한 경우.",
          "- ④ 5 는 전체 성분 수.",
          "",
          "시험에서는 `explained_variance_ratio_` 누적합으로 '최소 성분 수' 를 묻거나, `PCA(n_components=0.8)` 처럼 비율을 직접 넘기는 문법을 묻는다."
        ],
        terms: ["pca"]
      },
      {
        id: "a-4-3-q07", node: "a-4-3", type: "mcq", kind: "bug", difficulty: 3,
        prompt: "고객 데이터(`income`: 수백만 단위, `age`: 20~70)를 군집화하는 다음 코드의 **가장 큰 문제점**은?",
        code: [
          "from sklearn.cluster import KMeans",
          "km = KMeans(n_clusters=3, n_init=10, random_state=42)",
          "df['cluster'] = km.fit_predict(df[['income', 'age']])"
        ],
        lang: "python",
        choices: [
          "KMeans 는 DataFrame 을 입력으로 받을 수 없다",
          "스케일이 큰 `income` 이 거리 계산을 지배하므로 표준화(StandardScaler)를 먼저 해야 한다",
          "`n_clusters` 는 짝수여야 한다",
          "`fit_predict` 대신 `transform` 을 써야 라벨이 나온다"
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[kmeans|K-means]] 는 유클리드 거리 기반이다. `income` 의 차이가 수백만이면 `age` 의 차이(수십)는 거리에 거의 기여하지 못해 사실상 `income` 만으로 군집이 나뉜다. 군집·PCA·KNN 같은 거리 기반 기법은 [[standardization|표준화]]가 **선행 필수**다.",
          "",
          "- ① `KMeans` 는 DataFrame 을 그대로 받는다.",
          "- ③ `n_clusters` 에 홀짝 제약은 없다.",
          "- ④ `fit_predict` 가 바로 라벨을 돌려준다. `transform` 은 중심까지의 거리 행렬을 준다.",
          "",
          "시험에서는 '군집 전 전처리로 가장 필요한 것' 또는 이런 코드의 문제점으로 나온다. `random_state` 와 `n_init` 이 이미 있으니 그쪽은 문제가 아니다."
        ],
        terms: ["kmeans", "standardization"]
      },
      {
        id: "a-4-3-q08", node: "a-4-3", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`GridSearchCV` 의 `best_score_` 는 최적 파라미터로 **전체 훈련 데이터를 다시 학습(refit)했을 때의 훈련 점수**다.",
        answer: false,
        explanation: [
          "**정답: X** `best_score_` 는 최적 파라미터 조합의 **교차검증 평균 점수**(`cv_results_['mean_test_score']` 의 최댓값)다. 훈련 점수도, 별도 테스트 세트 점수도 아니다. 테스트 점수는 `gs.score(X_te, y_te)` 또는 `gs.best_estimator_.score(...)` 로 따로 본다.",
          "",
          "- `best_params_` 는 그 조합(딕셔너리), `best_estimator_` 는 refit 된 모델.",
          "",
          "시험에서는 [[grid-search|GridSearchCV]] 결과 속성 세 개의 의미를 구분하는 문제와, `best_score_` 를 '테스트 정확도' 로 쓰면 왜 안 되는지([[cross-validation|교차검증]] 점수이므로)를 묻는다."
        ],
        terms: ["grid-search", "cross-validation"]
      },
      {
        id: "a-4-3-q09", node: "a-4-3", type: "ox", kind: "concept", difficulty: 2,
        prompt: "실루엣 계수(silhouette coefficient)는 −1 에서 1 사이의 값을 가지며, 1 에 가까울수록 군집이 잘 분리되고 응집된 것이다.",
        answer: true,
        explanation: [
          "**정답: O** 한 점의 [[silhouette-score|실루엣 계수]] s = (b − a) / max(a, b). a 는 같은 군집 내 평균 거리(응집도), b 는 가장 가까운 다른 군집까지의 평균 거리(분리도). a ≪ b 면 1 에 가깝고, 잘못 배정되면 음수가 된다. `silhouette_score` 는 모든 점의 평균이다.",
          "",
          "- 0 근처면 군집 경계에 걸쳐 있는 상태.",
          "- k=1 에서는 b 가 정의되지 않아 계산할 수 없다(k ≥ 2).",
          "",
          "시험에서는 공식의 분모 `max(a, b)` 와 '실루엣이 최대인 k 를 고른다' 는 규칙, [[elbow-method|엘보우]]와의 차이로 출제된다."
        ],
        terms: ["silhouette-score", "elbow-method"]
      },
      {
        id: "a-4-3-q10", node: "a-4-3", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 파라미터 이름을 쓰시오. 초기 중심을 여러 번 다르게 잡아 실행한 뒤 inertia 가 가장 작은 결과를 택하는 횟수: `KMeans(n_clusters=3, ____=10, random_state=42)`",
        answer: "n_init",
        explanation: [
          "**정답: n_init** [[kmeans|K-means]] 는 초기 중심에 따라 지역 최적해에 빠질 수 있어, `n_init` 번 서로 다른 초기화로 실행하고 [[inertia|inertia]] 가 최소인 결과를 고른다. `random_state` 는 그 초기화의 난수를 고정한다.",
          "",
          "- `init='k-means++'` 는 초기 중심을 서로 멀리 뽑는 전략(기본값).",
          "- `max_iter` 는 한 번의 실행에서 중심 갱신 반복 상한.",
          "- sklearn 1.4 부터 `n_init` 기본값이 `'auto'` 로 바뀌어 k-means++ 에서는 1 회만 실행한다. 재현성과 안정성을 위해 시험 코드에는 `n_init=10` 을 명시한다.",
          "",
          "시험에서는 `n_init`, `max_iter`, `init` 세 파라미터의 의미를 바꿔 묻는다."
        ],
        terms: ["kmeans", "inertia"]
      },
      {
        id: "a-4-3-q11", node: "a-4-3", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "import numpy as np",
          "from sklearn.metrics import silhouette_score",
          "X = np.array([[0.0], [0.1], [10.0], [10.1]])",
          "labels = [0, 0, 1, 1]",
          "print(round(silhouette_score(X, labels), 2))"
        ],
        lang: "python",
        answer: "0.99",
        explanation: [
          "**정답: 0.99** 점 0.0 을 보면 같은 군집 평균 거리 a = 0.1, 다른 군집까지 평균 거리 b = (10 + 10.1)/2 = 10.05. s = (b − a)/max(a, b) = 9.95/10.05 ≈ 0.990. 네 점이 대칭이라 모두 같은 값이고 평균도 0.99. 군집이 아주 잘 분리된 경우 [[silhouette-score|실루엣 계수]]가 1 에 가깝다는 것을 보여 준다.",
          "",
          "- 공식에서 분모가 `max(a, b)` 이므로 값이 1 을 넘지 않는다.",
          "- 두 군집 사이가 가까워질수록 b 가 줄어 s 가 0 으로 간다.",
          "",
          "시험에서는 이렇게 작은 예시로 a, b 를 손계산하게 하거나 `silhouette_score(X, km.labels_)` 의 인자 순서(데이터, 라벨)를 묻는다."
        ],
        terms: ["silhouette-score"]
      },
      {
        id: "a-4-3-q12", node: "a-4-3", type: "short", kind: "concept", difficulty: 3,
        prompt: "그래디언트 부스팅(gradient boosting)이나 신경망 학습에서, 검증 손실(validation loss)이 일정 횟수 동안 개선되지 않으면 반복을 멈춰 과적합을 막는 기법의 **영문 이름**을 쓰시오. (sklearn 파라미터 이름과 같다)",
        answer: "early_stopping",
        accept: ["earlystopping", "early stopping", "조기종료", "조기 종료"],
        explanation: [
          "**정답: early_stopping (조기 종료)** [[early-stopping|조기 종료(early stopping)]]는 훈련 데이터 일부를 검증용으로 떼어 매 반복(트리 추가, 에포크)마다 검증 점수를 보고, `n_iter_no_change` 회 연속 개선이 없으면 학습을 멈춘다. 반복 횟수(`n_estimators`, `max_iter`) 자체를 튠하지 않아도 [[overfitting|과적합]]을 막는 효과가 있다.",
          "",
          "- sklearn: `GradientBoostingClassifier(n_iter_no_change=5, validation_fraction=0.1)`, `HistGradientBoostingClassifier(early_stopping=True)`, `MLPClassifier(early_stopping=True)`.",
          "- XGBoost/LightGBM: `early_stopping_rounds`.",
          "- 학습률(`learning_rate`)이 작으면 더 많은 반복이 필요하고, 조기 종료가 적정 지점을 찾아 준다.",
          "",
          "시험에서는 '학습률·트리 수·깊이·조기 종료' 네 [[hyperparameter|하이퍼파라미터]]의 역할을 짝짓는 문제로 나온다."
        ],
        terms: ["early-stopping", "hyperparameter", "overfitting"]
      },

      /* ---------------- a-4-4 통계 검정 및 특수 모델링 ---------------- */
      {
        id: "a-4-4-q01", node: "a-4-4", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "두 **독립** 집단의 평균을 비교하려 한다. 두 집단 모두 Shapiro-Wilk 검정에서 정규성을 만족했지만 Levene 검정에서 **등분산 가정이 기각**되었다. 적절한 검정은?",
        choices: ["stats.ttest_rel(a, b)", "stats.mannwhitneyu(a, b)", "stats.f_oneway(a, b)", "stats.ttest_ind(a, b, equal_var=False)"],
        answer: 3,
        explanation: [
          "**정답: ④** 정규성은 만족하고 등분산만 깨졌으면 **Welch 의 t-검정**을 쓴다. scipy 에서는 `ttest_ind(..., equal_var=False)`. 분산이 다를 때 자유도를 보정해 1종 오류를 통제한다. [[welch-t-test|Welch t-검정]]은 등분산일 때도 큰 손해가 없어 기본으로 권하는 교과서도 많다.",
          "",
          "- ① `ttest_rel` 은 같은 대상의 전후 측정처럼 **대응(paired)** 표본용이다.",
          "- ② `mannwhitneyu` 는 정규성이 **깨졌을 때** 쓰는 비모수 검정이다. 여기서는 정규성이 만족된다.",
          "- ③ `f_oneway`(ANOVA) 는 세 집단 이상 비교용이고 등분산을 가정한다.",
          "",
          "시험에서는 [[normality-test|정규성]] → [[levene-test|등분산]] → 검정 선택의 **흐름도**를 그대로 묻는다. 이 흐름을 외우면 4-4 의 절반은 해결된다."
        ],
        terms: ["welch-t-test", "t-test", "levene-test", "normality-test"]
      },
      {
        id: "a-4-4-q02", node: "a-4-4", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "import numpy as np",
          "from scipy import stats",
          "table = np.array([[10, 20], [20, 10]])",
          "chi2, p, dof, expected = stats.chi2_contingency(table)",
          "print(expected[0, 0], dof)"
        ],
        lang: "python",
        choices: ["10.0 1", "15.0 1", "20.0 2", "15.0 4"],
        answer: 1,
        explanation: [
          "**정답: ②** [[chi-square-test|카이제곱 독립성 검정]]의 기대빈도 = (행 합 × 열 합) / 전체. 1행 합 30, 1열 합 30, 전체 60 → 30 × 30 / 60 = **15.0**. 자유도 dof = (행 수 − 1)(열 수 − 1) = 1 × 1 = **1**.",
          "",
          "- ① 10.0 은 관측빈도다. 기대빈도와 혼동.",
          "- ③ 20.0 도 관측빈도이고, 자유도 2 는 2×3 표일 때다.",
          "- ④ 자유도 4 는 셀 수를 그대로 쓴 오류다.",
          "",
          "참고로 이 표는 2×2 라 `chi2` 통계량에 기본적으로 Yates 연속성 보정(`correction=True`)이 적용되어 5.4 가 나오고, `correction=False` 면 6.67 이다. 시험에서는 기대빈도 계산과 자유도 공식이 자주 나온다."
        ],
        terms: ["chi-square-test"]
      },
      {
        id: "a-4-4-q03", node: "a-4-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "로지스틱 회귀에서 변수 `x1` 의 계수가 0.6931 로 추정되었다. 다음 코드의 출력과 그 해석으로 옳은 것은?",
        code: [
          "import numpy as np",
          "print(round(np.exp(0.6931), 2))"
        ],
        lang: "python",
        choices: [
          "2.0 — x1 이 1 증가하면 양성의 오즈(odds)가 2 배가 된다",
          "0.69 — x1 이 1 증가하면 양성 확률이 69% 다",
          "1.69 — x1 이 1 증가하면 양성 확률이 1.69 배가 된다",
          "0.5 — x1 이 1 증가하면 오즈가 절반이 된다"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** 0.6931 ≈ ln 2 이므로 exp(0.6931) ≈ **2.0**. [[logistic-regression|로지스틱 회귀]]에서 계수 β 의 지수 exp(β) 가 [[odds-ratio|오즈비(odds ratio)]]이며, 'x1 이 1 단위 증가할 때 **오즈가 exp(β) 배**' 로 해석한다. 확률이 2 배가 되는 것이 아니다.",
          "",
          "- ② 0.69 는 계수 자체(로그 오즈 변화량)이고, 확률 69% 라는 해석도 틀렸다.",
          "- ③ 값도 틀렸고(1.69 ≠ e^0.6931), 오즈비는 **확률의 배수가 아니다**.",
          "- ④ 0.5 는 계수가 −0.6931 일 때의 오즈비다.",
          "",
          "시험에서는 `np.exp(model.params)` 로 오즈비를 구하는 코드와 '오즈비 > 1 이면 양성 가능성 증가' 해석, 그리고 '확률 vs 오즈' 함정이 반복된다."
        ],
        terms: ["odds-ratio", "logistic-regression"]
      },
      {
        id: "a-4-4-q04", node: "a-4-4", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "세 개 이상의 독립 집단 평균(중앙값)을 비교해야 하는데, 집단들이 **정규성을 만족하지 않는다**. 적절한 검정은?",
        choices: ["stats.f_oneway", "stats.ttest_ind", "stats.kruskal", "stats.chi2_contingency"],
        answer: 2,
        explanation: [
          "**정답: ③** 세 집단 이상 + 정규성 불만족 → [[kruskal-wallis|Kruskal-Wallis 검정]](`stats.kruskal`). 이는 일원배치 [[anova|ANOVA]] 의 비모수(nonparametric) 대응으로, 순위(rank)를 사용한다. 유의하면 사후검정은 Dunn 검정 또는 Mann-Whitney + Bonferroni.",
          "",
          "- ① `f_oneway`(ANOVA) 는 정규성·등분산을 가정하는 모수 검정이다.",
          "- ② `ttest_ind` 는 **두** 집단용이다. 세 집단에 반복 적용하면 다중비교 문제가 생긴다.",
          "- ④ `chi2_contingency` 는 범주형 두 변수의 독립성 검정이다.",
          "",
          "시험에서는 '집단 수(2 / 3+) × 정규성(만족 / 불만족)' 2×2 표로 네 검정(t / Mann-Whitney / ANOVA / Kruskal) 을 배치하는 문제가 나온다."
        ],
        terms: ["kruskal-wallis", "anova", "normality-test"]
      },
      {
        id: "a-4-4-q05", node: "a-4-4", type: "mcq", kind: "output", difficulty: 2,
        prompt: "네 개의 가설검정에서 얻은 p값에 Bonferroni 보정을 적용한다. 다음 코드의 출력은?",
        code: [
          "from statsmodels.stats.multitest import multipletests",
          "pvals = [0.01, 0.04, 0.03, 0.20]",
          "reject, p_adj, _, _ = multipletests(pvals, alpha=0.05, method='bonferroni')",
          "print(reject.sum())"
        ],
        lang: "python",
        choices: ["0", "1", "2", "3"],
        answer: 1,
        explanation: [
          "**정답: ②** [[bonferroni-correction|Bonferroni 보정]]은 유의수준을 검정 수 m 으로 나눈다: 0.05/4 = **0.0125**. (동치로 p 에 4 를 곱한 보정 p = [0.04, 0.16, 0.12, 0.80] 을 0.05 와 비교.) 0.0125 보다 작은 p 는 0.01 하나뿐이므로 기각 수 = **1**.",
          "",
          "- ① 0 — 0.01 < 0.0125 이므로 하나는 기각된다.",
          "- ③ 2, ④ 3 — 보정 없이 0.05 와 비교하면 0.01, 0.04, 0.03 세 개가 기각되지만, 보정 후 0.04·0.03 은 살아남지 못한다.",
          "",
          "시험에서는 '보정 전 3개 → 보정 후 1개' 처럼 기각 수 변화를 묻거나 `multipletests` 반환 튜플의 첫 원소(`reject`)·둘째(`pvals_corrected`)를 묻는다. Bonferroni 는 보수적이어서 [[statistical-power|검정력]]이 떨어진다는 단점도 함께."
        ],
        terms: ["bonferroni-correction", "p-value", "statistical-power"]
      },
      {
        id: "a-4-4-q06", node: "a-4-4", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "ARIMA(p, d, q) 모형에서 **d** 의 의미로 옳은 것은?",
        choices: [
          "정상성(stationarity)을 확보하기 위해 적용한 차분(differencing)의 횟수",
          "자기회귀(AR) 항의 차수 — 과거 값 몇 개를 쓰는가",
          "이동평균(MA) 항의 차수 — 과거 오차 몇 개를 쓰는가",
          "계절 주기(seasonal period)의 길이"
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[arima|ARIMA(p, d, q)]] 에서 I(Integrated) 에 해당하는 d 는 원 시계열을 몇 번 차분해 [[stationarity|정상성]]을 얻었는가다. d=1 이면 `y.diff()`, d=2 면 두 번 차분. 보통 [[adf-test|ADF 검정]]으로 차분 전후의 정상성을 확인해 d 를 정한다.",
          "",
          "- ② 과거 값의 개수는 **p**(AR 차수). PACF 로 가늠한다.",
          "- ③ 과거 오차의 개수는 **q**(MA 차수). ACF 로 가늠한다.",
          "- ④ 계절 주기는 SARIMA(p,d,q)(P,D,Q)m 의 **m** 이다.",
          "",
          "시험에서는 'ADF p값 0.6 → 비정상 → 1차 차분 후 p값 0.001 → d=1' 흐름과 p/d/q 각각의 의미를 묻는다."
        ],
        terms: ["arima", "stationarity", "adf-test"]
      },
      {
        id: "a-4-4-q07", node: "a-4-4", type: "mcq", kind: "bug", difficulty: 3,
        prompt: "같은 환자 8명의 **복용 전·후** 혈압을 비교하는 다음 코드의 문제점은?",
        code: [
          "from scipy import stats",
          "before = [142, 138, 150, 145, 160, 155, 148, 139]",
          "after  = [135, 130, 148, 140, 150, 149, 141, 136]",
          "res = stats.ttest_ind(before, after)",
          "print(res.pvalue)"
        ],
        lang: "python",
        choices: [
          "`ttest_ind` 는 리스트가 아니라 numpy 배열만 받는다",
          "`alternative` 인자를 반드시 지정해야 한다",
          "같은 대상의 전후 측정(대응표본)이므로 `ttest_rel` 을 써야 한다",
          "표본이 10 개 미만이면 t-검정을 할 수 없다"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** 같은 환자에게서 두 번 측정한 자료는 서로 **독립이 아니다**. 이런 대응(paired) 표본은 개인차를 제거하는 [[paired-t-test|대응표본 t-검정]] `ttest_rel(before, after)` 를 써야 한다. 독립표본 검정을 쓰면 개인 간 변동이 오차에 섞여 [[statistical-power|검정력]]이 떨어지고 전제도 틀린다. 정규성이 의심되면 비모수 `wilcoxon`.",
          "",
          "- ① scipy 검정 함수는 리스트, 배열, Series 모두 받는다.",
          "- ② `alternative` 기본값은 `'two-sided'` 로 생략 가능하다.",
          "- ④ t-검정은 소표본용으로 만들어진 검정이다. 표본 수 하한은 없다(정규성 가정이 더 중요).",
          "",
          "시험에서는 '같은 대상·전후·짝지어진' 이라는 단서가 있으면 [[t-test|t-검정]] 중 `ttest_rel`, 서로 다른 두 그룹이면 `ttest_ind` 를 고르게 한다."
        ],
        terms: ["paired-t-test", "t-test", "statistical-power"]
      },
      {
        id: "a-4-4-q08", node: "a-4-4", type: "ox", kind: "concept", difficulty: 1,
        prompt: "Shapiro-Wilk 정규성 검정에서 p값이 0.05 보다 크면 귀무가설(null hypothesis)을 기각하지 못하므로 데이터가 정규분포를 따른다고 가정하고 모수 검정을 진행할 수 있다.",
        answer: true,
        explanation: [
          "**정답: O** [[normality-test|Shapiro-Wilk 검정]]의 [[null-hypothesis|귀무가설]]은 '모집단이 정규분포를 따른다' 이다. [[p-value|p값]] > 0.05 면 기각할 근거가 없으므로 정규성을 **가정**하고 t-검정·ANOVA 같은 모수 검정으로 넘어간다. 엄밀히는 '정규임이 증명된' 것이 아니라 '정규가 아니라고 말할 수 없는' 상태다.",
          "",
          "- p < 0.05 면 정규성 기각 → Mann-Whitney, Kruskal-Wallis, Wilcoxon 같은 비모수 검정.",
          "- 표본이 아주 크면 미세한 차이에도 기각되므로 Q-Q plot 과 함께 본다.",
          "",
          "시험에서는 'p > 0.05 의 해석' 과 `stats.shapiro(x).pvalue` 코드가 흐름도의 첫 단계로 나온다."
        ],
        terms: ["normality-test", "null-hypothesis", "p-value"]
      },
      {
        id: "a-4-4-q09", node: "a-4-4", type: "ox", kind: "concept", difficulty: 2,
        prompt: "ADF(Augmented Dickey-Fuller) 검정의 귀무가설은 '시계열이 정상(stationary)이다' 이므로, p값이 0.05 보다 작으면 비정상 시계열로 판단한다.",
        answer: false,
        explanation: [
          "**정답: X** 방향이 반대다. [[adf-test|ADF 검정]]의 귀무가설은 '**단위근(unit root)이 존재한다 = 비정상**' 이다. 따라서 p < 0.05 면 귀무가설을 기각해 **정상(stationary)** 이라고 판단하고, p 가 크면 비정상이라 차분(differencing)이 필요하다.",
          "",
          "- `adfuller(series)[1]` 이 p값. 예: 랜덤워크 p ≈ 0.6 (비정상) → 1차 차분 p ≈ 0.000 (정상) → ARIMA 의 d = 1.",
          "- KPSS 검정은 귀무가설이 '정상' 으로 ADF 와 반대라 둘을 함께 쓴다.",
          "",
          "시험에서는 ADF 의 귀무가설 방향을 뒤집어 묻는 OX 와, [[stationarity|정상성]]이 ARIMA 의 전제라는 점이 함께 나온다."
        ],
        terms: ["adf-test", "stationarity", "null-hypothesis"]
      },
      {
        id: "a-4-4-q10", node: "a-4-4", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 함수 이름을 쓰시오. 두 집단의 등분산성(homogeneity of variance)을 검정하며, 중앙값 기반이라 정규성 위반에 강건하다: `stats.____(a, b)`",
        answer: "levene",
        accept: ["levene()"],
        explanation: [
          "**정답: levene** [[levene-test|Levene 검정]]은 '두(또는 그 이상) 집단의 분산이 같다' 는 귀무가설을 검정한다. p > 0.05 면 등분산 가정 → `ttest_ind(equal_var=True)`/ANOVA, p < 0.05 면 이분산 → Welch(`equal_var=False`).",
          "",
          "- `stats.bartlett` 도 등분산 검정이지만 정규성에 민감하다. 시험에서 '강건한' 쪽은 Levene.",
          "- `stats.fligner` 는 더 비모수적인 대안.",
          "",
          "시험에서는 [[normality-test|정규성]] → **등분산** → 검정 선택 흐름의 두 번째 칸으로 나오고, `equal_var` 인자와 짝지어 묻는다."
        ],
        terms: ["levene-test", "normality-test"]
      },
      {
        id: "a-4-4-q11", node: "a-4-4", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력을 쓰시오. (소수 넷째 자리까지 반올림된 값)",
        code: [
          "from scipy import stats",
          "a = [5.1, 4.9, 5.6, 5.8, 6.0]",
          "b = [6.5, 6.1, 7.0, 6.8, 7.2]",
          "print(round(stats.ttest_ind(a, b).pvalue, 4))"
        ],
        lang: "python",
        answer: "0.0024",
        accept: ["0.0024051922366522265", ".0024"],
        explanation: [
          "**정답: 0.0024** a 의 평균 5.48, b 의 평균 6.72 로 차이 1.24 이고 두 집단의 표준편차는 0.4~0.5 수준이라 t ≈ −4.36, 자유도 8 의 양측 [[p-value|p값]]은 약 0.0024 다. 0.05 보다 훨씬 작으므로 '두 평균이 같다' 는 [[null-hypothesis|귀무가설]]을 기각한다.",
          "",
          "- `ttest_ind` 의 기본은 `equal_var=True`(Student t) 다. Welch 를 쓰면 p값이 조금 달라진다.",
          "- `res.statistic` 은 t 통계량(부호는 a − b 방향), `res.pvalue` 는 양측 p값.",
          "",
          "시험에서는 이런 출력에서 'p < 0.05 → 유의한 차이' 결론을 고르게 하고, [[t-test|t-검정]] 결과 객체의 속성 이름(`statistic`, `pvalue`)을 묻는다."
        ],
        terms: ["t-test", "p-value", "null-hypothesis"]
      },
      {
        id: "a-4-4-q12", node: "a-4-4", type: "short", kind: "concept", difficulty: 3,
        prompt: "A/B 테스트의 표본 크기를 산정할 때 필요한 세 요소는 유의수준 α, 기대 효과크기(effect size), 그리고 '**실제 효과가 있을 때 이를 탐지해 귀무가설을 기각할 확률**(1 − β)' 이다. 이 세 번째 요소의 영문 용어를 쓰시오.",
        answer: "power",
        accept: ["검정력", "statisticalpower", "statistical power", "통계적검정력"],
        explanation: [
          "**정답: power (검정력)** [[statistical-power|검정력(statistical power)]] = 1 − β 로, β 는 2종 오류(실제 효과를 놓칠 확률)다. 관례적으로 0.8 을 쓴다. 효과크기가 작을수록, α 가 작을수록, 검정력을 높일수록 필요한 표본이 커진다.",
          "",
          "- `TTestIndPower().solve_power(effect_size=0.5, alpha=0.05, power=0.8)` ≈ 그룹당 64 명. 효과크기 0.2 면 약 393 명.",
          "- [[ab-test|A/B 테스트]] 설계: 지표·가설 정의 → 효과크기 가정 → 표본 크기 산정 → 무작위 배정 → 기간 종료 후 **한 번** 검정(중간에 자꾸 보면 1종 오류 증가).",
          "- [[effect-size|효과크기]] Cohen's d 는 0.2 작음·0.5 중간·0.8 큼.",
          "",
          "시험에서는 '표본 크기 결정 요소 세 가지' 와 '검정력 0.8 의 의미', 'p값이 작아도 효과크기가 작을 수 있다' 는 해석 문제로 나온다."
        ],
        terms: ["statistical-power", "ab-test", "effect-size"]
      }
    ],

    /* ============================================================
       실습 과제 (시험 실전형: 여러 단계 → 값 하나)
       ============================================================ */
    practices: [
      /* ---------------- a-4-1 ---------------- */
      {
        id: "a-4-1-p01", node: "a-4-1",
        title: "수치형 컬럼 결측을 중앙값으로 일괄 대치 후 평균",
        difficulty: 1,
        task: [
          "`df`의 **수치형 컬럼 전부**(`select_dtypes(include='number')`)에 대해 각 컬럼의 결측값을 **그 컬럼의 중앙값(median)** 으로 채우시오.",
          "그 뒤 `income` 컬럼의 평균을 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(411)",
          "df = pd.DataFrame({",
          "    'age': rng.integers(20, 60, size=200).astype(float),",
          "    'income': rng.normal(5000, 1200, size=200).round(0),",
          "    'score': rng.uniform(0, 100, size=200).round(1),",
          "    'city': rng.choice(['Seoul', 'Busan', 'Daegu'], size=200),",
          "})",
          "for col in ['age', 'income', 'score']:",
          "    idx = rng.choice(200, size=20, replace=False)",
          "    df.loc[idx, col] = np.nan",
          "df.isna().sum()"
        ],
        hint: [
          "`num = df.select_dtypes(include='number').columns` 로 컬럼 목록을 먼저 뽑는다.",
          "`df[num].fillna(df[num].median())` 은 컬럼별로 각자의 중앙값을 채운다."
        ],
        answer: { type: "number", value: 4889.85, decimals: 2 },
        solution: [
          "num = df.select_dtypes(include='number').columns",
          "df[num] = df[num].fillna(df[num].median())",
          "round(df['income'].mean(), 2)"
        ],
        explanation: [
          "`fillna` 에 Series(컬럼별 중앙값)를 넘기면 인덱스(컬럼 이름)를 맞춰 **컬럼마다 다른 값**이 들어간다. 범주형 `city` 는 `number` 가 아니므로 건드리지 않는다.",
          "[[missing-value|결측값]] 20개가 중앙값으로 채워지므로 평균은 결측을 뺀 평균과 약간 달라진다 — 시험에서는 '대치 후' 평균을 묻는지 '제거 후' 평균을 묻는지 지문을 정확히 읽어야 한다."
        ],
        terms: ["missing-value", "feature-engineering"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-4-1-p02", node: "a-4-1",
        title: "IQR 기준 이상치를 여러 컬럼에서 동시에 제거",
        difficulty: 2,
        task: [
          "`df`의 수치형 컬럼(`x1`, `x2`, `x3`) 각각에 대해 Q1 − 1.5·IQR 미만 또는 Q3 + 1.5·IQR 초과인 값을 이상치로 본다.",
          "**세 컬럼 중 하나라도** 이상치인 행을 제거한 뒤 남은 **행 수**(정수)를 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(412)",
          "df = pd.DataFrame({",
          "    'x1': rng.normal(50, 10, size=300),",
          "    'x2': rng.normal(100, 20, size=300),",
          "    'x3': rng.exponential(5, size=300),",
          "    'grp': rng.choice(['a', 'b'], size=300),",
          "})",
          "df.describe()"
        ],
        hint: [
          "`num = df.select_dtypes(include='number')` 에 `quantile(0.25)`, `quantile(0.75)` 를 한 번에 적용하면 컬럼별 Series 가 나온다.",
          "비교식은 DataFrame 과 Series 가 컬럼 기준으로 브로드캐스트된다. 마지막에 `.any(axis=1)`."
        ],
        answer: { type: "int", value: 284 },
        solution: [
          "num = df.select_dtypes(include='number')",
          "q1, q3 = num.quantile(0.25), num.quantile(0.75)",
          "iqr = q3 - q1",
          "mask = ((num < q1 - 1.5 * iqr) | (num > q3 + 1.5 * iqr)).any(axis=1)",
          "int((~mask).sum())"
        ],
        explanation: [
          "[[iqr|IQR]] 규칙을 DataFrame 단위로 한 번에 적용하는 것이 포인트다. `x3` 은 지수분포라 오른챈 꼬리가 길어 [[outlier|이상치]]가 많이 잡히고(12개), `x1` 에서 5개가 잡혀 총 16행이 제거된다.",
          "`any(axis=1)` 은 '한 컬럼이라도 벗어나면 제거'. 시험에서 '모든 컬럼이 이상치인 행만 제거' 라면 `all(axis=1)` 이다 — 지문의 '하나라도/모두' 를 확인하자."
        ],
        terms: ["outlier", "iqr"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6" }
      },
      {
        id: "a-4-1-p03", node: "a-4-1",
        title: "분리 → ColumnTransformer → 로지스틱 회귀 → 정확도",
        difficulty: 3,
        task: [
          "`df`에서 `churn` 을 타깃으로, 나머지를 특성으로 한다. `train_test_split(test_size=0.3, random_state=42, stratify=y)` 로 분리하시오.",
          "수치형 컬럼에는 `StandardScaler`, 범주형 컬럼(`region`, `plan`)에는 `OneHotEncoder(handle_unknown='ignore')` 를 적용하는 `ColumnTransformer` 와 `LogisticRegression(max_iter=1000)` 을 `Pipeline` 으로 묶어 **훈련 데이터에만** 학습시키시오.",
          "테스트 데이터 정확도(accuracy)를 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "rng = np.random.default_rng(413)",
          "n = 500",
          "df = pd.DataFrame({",
          "    'age': rng.integers(20, 65, size=n),",
          "    'income': rng.normal(5000, 1500, size=n).round(0),",
          "    'visits': rng.poisson(3, size=n),",
          "    'region': rng.choice(['N', 'S', 'E', 'W'], size=n),",
          "    'plan': rng.choice(['basic', 'pro'], size=n),",
          "})",
          "logit = (0.0006 * (df['income'] - 5000) + 0.3 * df['visits'] - 0.9",
          "         + np.where(df['plan'] == 'pro', 1.0, 0.0) + np.where(df['region'] == 'N', 0.5, 0.0))",
          "df['churn'] = (rng.uniform(size=n) < 1 / (1 + np.exp(-logit))).astype(int)",
          "df.head()"
        ],
        hint: [
          "`num_cols = X.select_dtypes(include='number').columns.tolist()`, `cat_cols = X.select_dtypes(exclude='number').columns.tolist()`.",
          "`Pipeline([('prep', ct), ('clf', LogisticRegression(max_iter=1000))]).fit(X_tr, y_tr)` 뒤 `.score(X_te, y_te)` 가 정확도다."
        ],
        answer: { type: "number", value: 0.76, decimals: 3 },
        solution: [
          "from sklearn.model_selection import train_test_split",
          "from sklearn.compose import ColumnTransformer",
          "from sklearn.preprocessing import StandardScaler, OneHotEncoder",
          "from sklearn.pipeline import Pipeline",
          "from sklearn.linear_model import LogisticRegression",
          "X = df.drop(columns='churn'); y = df['churn']",
          "X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)",
          "num_cols = X.select_dtypes(include='number').columns.tolist()",
          "cat_cols = X.select_dtypes(exclude='number').columns.tolist()",
          "ct = ColumnTransformer([('num', StandardScaler(), num_cols),",
          "                        ('cat', OneHotEncoder(handle_unknown='ignore'), cat_cols)])",
          "pipe = Pipeline([('prep', ct), ('clf', LogisticRegression(max_iter=1000))])",
          "pipe.fit(X_tr, y_tr)",
          "round(pipe.score(X_te, y_te), 3)"
        ],
        explanation: [
          "시험 실전형 흐름 전체다: [[train-test-split|분리]] → [[column-transformer|ColumnTransformer]](수치 [[standardization|표준화]] + 범주 [[one-hot-encoding|원핫]]) → 모델 → 지표. `Pipeline` 안에서 `fit` 은 훈련 데이터에만 적용되므로 [[data-leakage|누수]]가 없다.",
          "변환 후 특성 수는 수치 3 + region 4 + plan 2 = 9 열. 정확도 0.760 은 150개 테스트 행 중 114개를 맞힌 값이다.",
          "`stratify=y` 를 빼거나 `random_state` 를 바꾸면 분리가 달라져 값이 바뀐다 — 지문의 분리 조건을 그대로 따르는 것이 채점의 전제다."
        ],
        terms: ["column-transformer", "data-leakage", "train-test-split", "one-hot-encoding", "standardization"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / sklearn 1.9.1" }
      },

      /* ---------------- a-4-2 ---------------- */
      {
        id: "a-4-2-p01", node: "a-4-2",
        title: "예측 결과에서 F1 점수 계산",
        difficulty: 1,
        task: [
          "실제 라벨 `y_true` 와 예측 라벨 `y_pred` 가 주어져 있다. 혼동행렬을 출력해 TP/FP/FN 을 확인한 뒤, **F1 점수**를 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np",
          "rng = np.random.default_rng(421)",
          "y_true = rng.integers(0, 2, size=300)",
          "flip = rng.uniform(size=300) < 0.25",
          "y_pred = np.where(flip, 1 - y_true, y_true)",
          "y_true[:10], y_pred[:10]"
        ],
        hint: [
          "`from sklearn.metrics import confusion_matrix, f1_score`",
          "F1 = 2·P·R/(P+R). 혼동행렬에서 손으로 계산해 `f1_score` 결과와 맞춰 보자."
        ],
        answer: { type: "number", value: 0.763, decimals: 3 },
        solution: [
          "from sklearn.metrics import confusion_matrix, f1_score",
          "cm = confusion_matrix(y_true, y_pred)",
          "round(f1_score(y_true, y_pred), 3)"
        ],
        explanation: [
          "[[confusion-matrix|혼동행렬]] `[[120, 37], [32, 111]]` 에서 TP = 111, FP = 37, FN = 32. [[precision|정밀도]] = 111/148 = 0.750, [[recall|재현율]] = 111/143 = 0.776, [[f1-score|F1]] = 2·0.750·0.776/(0.750+0.776) ≈ 0.763.",
          "sklearn 혼동행렬은 **행 = 실제, 열 = 예측**, `[[TN, FP], [FN, TP]]` 순서다. 시험에서 손계산과 함수 결과를 대조하는 문제의 기본."
        ],
        terms: ["confusion-matrix", "f1-score", "precision", "recall"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6 / sklearn 1.9.1" }
      },
      {
        id: "a-4-2-p02", node: "a-4-2",
        title: "diabetes 선형회귀 테스트 RMSE",
        difficulty: 2,
        task: [
          "`load_diabetes` 데이터를 `train_test_split(test_size=0.2, random_state=42)` 로 분리하고 `LinearRegression` 을 훈련 데이터에 학습시키시오.",
          "테스트 데이터에 대한 **RMSE**(평균제곱오차의 제곱근)를 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "from sklearn.datasets import load_diabetes",
          "from sklearn.model_selection import train_test_split",
          "X, y = load_diabetes(return_X_y=True, as_frame=True)",
          "X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)",
          "X_tr.shape, X_te.shape"
        ],
        hint: [
          "`mean_squared_error(y_te, pred)` 에 `np.sqrt` 를 씌운다. (`squared=False` 인자는 최신 sklearn 에서 제거되었다.)"
        ],
        answer: { type: "number", value: 53.85, decimals: 2 },
        solution: [
          "from sklearn.linear_model import LinearRegression",
          "from sklearn.metrics import mean_squared_error",
          "lr = LinearRegression().fit(X_tr, y_tr)",
          "pred = lr.predict(X_te)",
          "round(float(np.sqrt(mean_squared_error(y_te, pred))), 2)"
        ],
        explanation: [
          "[[rmse|RMSE]] 는 MSE 의 제곱근이라 타깃과 같은 단위를 가진다(여기선 질병 진행 점수). 같은 분리에서 R² 는 약 0.45 로, 선형 모델이 분산의 절반가량만 설명한다.",
          "`sklearn.metrics.root_mean_squared_error` (1.4+) 를 써도 같은 값이다. [[mae|MAE]] 와 비교하면 RMSE 가 큰 오차에 더 민감하다는 점이 시험 포인트."
        ],
        terms: ["rmse", "r-squared", "train-test-split"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / sklearn 1.9.1" }
      },
      {
        id: "a-4-2-p03", node: "a-4-2",
        title: "표준화 → RFE 로 변수 5개 선택 → 로지스틱 회귀 → ROC-AUC",
        difficulty: 3,
        task: [
          "`load_breast_cancer` 데이터를 `train_test_split(test_size=0.25, random_state=42, stratify=y)` 로 분리하고, 훈련 데이터로 `StandardScaler` 를 학습해 훈련·테스트를 모두 변환하시오.",
          "`RFE(LogisticRegression(max_iter=5000), n_features_to_select=5)` 를 **표준화된 훈련 데이터**에 적용해 변수 5개를 고르고, 그 5개만으로 `LogisticRegression(max_iter=5000)` 을 다시 학습하시오.",
          "테스트 데이터의 **ROC-AUC**(`predict_proba` 의 양성 확률 사용)를 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "from sklearn.datasets import load_breast_cancer",
          "from sklearn.model_selection import train_test_split",
          "X, y = load_breast_cancer(return_X_y=True, as_frame=True)",
          "X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)",
          "X_tr.shape, X_te.shape"
        ],
        hint: [
          "`rfe.support_` 는 선택된 변수의 bool 마스크. `X_tr_s[:, rfe.support_]` 로 열을 고른다.",
          "`roc_auc_score(y_te, clf.predict_proba(X_te_sel)[:, 1])`."
        ],
        answer: { type: "number", value: 0.996, decimals: 3 },
        solution: [
          "from sklearn.preprocessing import StandardScaler",
          "from sklearn.feature_selection import RFE",
          "from sklearn.linear_model import LogisticRegression",
          "from sklearn.metrics import roc_auc_score",
          "sc = StandardScaler().fit(X_tr)",
          "X_tr_s, X_te_s = sc.transform(X_tr), sc.transform(X_te)",
          "rfe = RFE(LogisticRegression(max_iter=5000), n_features_to_select=5).fit(X_tr_s, y_tr)",
          "selected = X.columns[rfe.support_].tolist()",
          "clf = LogisticRegression(max_iter=5000).fit(X_tr_s[:, rfe.support_], y_tr)",
          "proba = clf.predict_proba(X_te_s[:, rfe.support_])[:, 1]",
          "round(roc_auc_score(y_te, proba), 3)"
        ],
        explanation: [
          "[[rfe|RFE]](래퍼 방식 [[feature-selection|변수 선택]])는 모델을 반복 학습하며 계수 절댓값이 가장 작은 변수를 하나씩 제거해 5개를 남긴다. 선택된 변수는 `radius error`, `worst radius`, `worst texture`, `worst area`, `worst concave points`.",
          "30개 중 5개만 써도 [[roc-auc|AUC]] 0.996 으로 거의 완벽하게 분리된다. 스케일러를 **훈련 데이터로만** `fit` 한 뒤 테스트에 `transform` 하는 순서가 누수 방지의 핵심이다.",
          "`predict` (0/1) 를 `roc_auc_score` 에 넘기면 값이 달라지므로 반드시 `predict_proba[:, 1]`."
        ],
        terms: ["rfe", "feature-selection", "roc-auc", "standardization"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / sklearn 1.9.1" }
      },

      /* ---------------- a-4-3 ---------------- */
      {
        id: "a-4-3-p01", node: "a-4-3",
        title: "make_blobs 군집화 후 가장 큰 군집의 크기",
        difficulty: 1,
        task: [
          "`X` 를 `KMeans(n_clusters=4, n_init=10, random_state=42)` 로 군집화하고, `labels_` 를 세어 **가장 큰 군집에 속한 점의 개수**(정수)를 입력하시오."
        ],
        setup: [
          "import numpy as np",
          "from sklearn.datasets import make_blobs",
          "X, _ = make_blobs(n_samples=[120, 80, 60, 40], centers=None, cluster_std=0.8, random_state=7)",
          "X.shape"
        ],
        hint: [
          "`np.bincount(km.labels_)` 또는 `pd.Series(km.labels_).value_counts()`."
        ],
        answer: { type: "int", value: 120 },
        solution: [
          "from sklearn.cluster import KMeans",
          "km = KMeans(n_clusters=4, n_init=10, random_state=42).fit(X)",
          "int(np.bincount(km.labels_).max())"
        ],
        explanation: [
          "`make_blobs` 에 리스트를 주면 군집별 표본 수를 지정할 수 있다. 군집이 잘 분리되어 있어 [[kmeans|K-means]] 가 원래 군집(120, 80, 60, 40)을 그대로 복원하고, 가장 큰 군집은 120 개다.",
          "`labels_` 의 **번호**(0~3)는 실행 환경에 따라 바뀔 수 있지만 **크기 분포**는 바뀌지 않는다. 시험에서도 '라벨 번호' 가 아니라 '개수·중심·[[inertia|inertia]]' 를 묻는다."
        ],
        terms: ["kmeans", "inertia"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6 / sklearn 1.9.1" }
      },
      {
        id: "a-4-3-p02", node: "a-4-3",
        title: "Pipeline + GridSearchCV 로 결정 트리 깊이 튜닝",
        difficulty: 2,
        task: [
          "`load_breast_cancer` 데이터 전체에 대해 `StandardScaler` → `DecisionTreeClassifier(random_state=0)` 파이프라인(단계 이름 `'scaler'`, `'tree'`)을 만들고, `max_depth` 후보 `[1, 2, 3, 4, 5, 6, 8]` 을 `GridSearchCV(cv=5, scoring='accuracy')` 로 탐색하시오.",
          "`best_params_` 에 나오는 **최적 max_depth**(정수)를 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "from sklearn.datasets import load_breast_cancer",
          "X, y = load_breast_cancer(return_X_y=True)",
          "X.shape, np.bincount(y)"
        ],
        hint: [
          "파이프라인 단계 이름이 `'tree'` 라면 param_grid 키는 `'tree__max_depth'` (밑줄 두 개).",
          "`gs.best_params_['tree__max_depth']`. `pd.DataFrame(gs.cv_results_)[['params', 'mean_test_score']]` 로 전체 표를 확인하자."
        ],
        answer: { type: "int", value: 2 },
        solution: [
          "from sklearn.pipeline import Pipeline",
          "from sklearn.preprocessing import StandardScaler",
          "from sklearn.tree import DecisionTreeClassifier",
          "from sklearn.model_selection import GridSearchCV",
          "pipe = Pipeline([('scaler', StandardScaler()), ('tree', DecisionTreeClassifier(random_state=0))])",
          "grid = {'tree__max_depth': [1, 2, 3, 4, 5, 6, 8]}",
          "gs = GridSearchCV(pipe, grid, cv=5, scoring='accuracy').fit(X, y)",
          "int(gs.best_params_['tree__max_depth'])"
        ],
        explanation: [
          "[[grid-search|GridSearchCV]] 는 7개 조합 × 5 폴드 = 35 회 학습한 뒤 교차검증 평균 정확도가 가장 높은 깊이를 고른다. 깊이 1 은 과소적합(0.90), **깊이 2 가 최고(0.928)** 이고 그 이상은 0.915 전후로 오히려 조금 떨어진다 — 깊어질수록 훈련 점수는 오르지만 [[cross-validation|교차검증]] 점수는 [[overfitting|과적합]]으로 내려가는 전형적 모양이다.",
          "[[pipeline|파이프라인]] 안의 [[hyperparameter|하이퍼파라미터]]는 `'tree__max_depth'` 처럼 단계 이름 + 밑줄 두 개로 지정한다. 트리는 스케일에 영향을 받지 않아 `StandardScaler` 가 결과를 바꾸지는 않지만, 시험 코드에서는 파이프라인 형태 그대로 나오므로 이름 규칙을 익혀 두자. `best_score_` 는 그 조합의 교차검증 평균 점수다."
        ],
        terms: ["grid-search", "pipeline", "hyperparameter", "cross-validation"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6 / sklearn 1.9.1" }
      },
      {
        id: "a-4-3-p03", node: "a-4-3",
        title: "표준화 → PCA(2) → K-means(3) → 실루엣 점수",
        difficulty: 3,
        task: [
          "`load_wine` 의 특성 `X` 를 `StandardScaler` 로 표준화하고, `PCA(n_components=2)` 로 2차원으로 축소하시오.",
          "축소된 데이터를 `KMeans(n_clusters=3, n_init=10, random_state=42)` 로 군집화한 뒤, **축소된 데이터와 군집 라벨**로 `silhouette_score` 를 계산해 소수 둘째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "from sklearn.datasets import load_wine",
          "X, y = load_wine(return_X_y=True)",
          "X.shape"
        ],
        hint: [
          "`Xs = StandardScaler().fit_transform(X)`, `X2 = PCA(n_components=2).fit_transform(Xs)`.",
          "`silhouette_score(X2, km.labels_)` — 첫 인자는 데이터, 둘째는 라벨."
        ],
        answer: { type: "number", value: 0.56, decimals: 2 },
        solution: [
          "from sklearn.preprocessing import StandardScaler",
          "from sklearn.decomposition import PCA",
          "from sklearn.cluster import KMeans",
          "from sklearn.metrics import silhouette_score",
          "Xs = StandardScaler().fit_transform(X)",
          "X2 = PCA(n_components=2).fit_transform(Xs)",
          "km = KMeans(n_clusters=3, n_init=10, random_state=42).fit(X2)",
          "round(float(silhouette_score(X2, km.labels_)), 2)"
        ],
        explanation: [
          "[[standardization|표준화]] → [[pca|PCA]] → [[kmeans|K-means]] → [[silhouette-score|실루엣]] 의 네 단계다. 두 주성분이 전체 분산의 약 55% 를 설명하며, 이 2차원에서 3개 군집의 실루엣은 0.56 으로 13차원 원공간에서의 0.28 보다 크게 높다 — 차원이 줄면 거리가 조밀해져 실루엣이 올라가는 경향이 있다.",
          "PCA 성분의 부호는 환경마다 뒤집힐 수 있지만 거리에는 영향이 없어 군집과 실루엣은 같다. `silhouette_score` 의 인자 순서(데이터, 라벨)를 바꾸면 오류가 난다."
        ],
        terms: ["pca", "kmeans", "silhouette-score", "standardization"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6 / sklearn 1.9.1" }
      },

      /* ---------------- a-4-4 ---------------- */
      {
        id: "a-4-4-p01", node: "a-4-4",
        title: "교차표 → 카이제곱 독립성 검정 통계량",
        difficulty: 1,
        task: [
          "`df`의 `gender` 와 `pref` 로 `pd.crosstab` 교차표를 만들고 `stats.chi2_contingency` 로 독립성 검정을 수행하시오.",
          "**카이제곱 통계량**을 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "from scipy import stats",
          "rng = np.random.default_rng(441)",
          "n = 400",
          "gender = rng.choice(['M', 'F'], size=n)",
          "pref = np.where(gender == 'M',",
          "                rng.choice(['A', 'B', 'C'], size=n, p=[0.5, 0.3, 0.2]),",
          "                rng.choice(['A', 'B', 'C'], size=n, p=[0.3, 0.3, 0.4]))",
          "df = pd.DataFrame({'gender': gender, 'pref': pref})",
          "pd.crosstab(df['gender'], df['pref'])"
        ],
        hint: [
          "`chi2, p, dof, expected = stats.chi2_contingency(ct)` — 반환 순서를 기억하자."
        ],
        answer: { type: "number", value: 31.612, decimals: 3 },
        solution: [
          "ct = pd.crosstab(df['gender'], df['pref'])",
          "chi2, p, dof, expected = stats.chi2_contingency(ct)",
          "round(float(chi2), 3)"
        ],
        explanation: [
          "2×3 교차표이므로 자유도는 (2−1)(3−1) = 2 이고, 2×2 가 아니라 Yates 연속성 보정은 적용되지 않는다. 통계량 31.612 에 대한 [[p-value|p값]]은 0.0001 미만으로 '성별과 선호는 독립' 이라는 [[null-hypothesis|귀무가설]]이 기각된다.",
          "[[chi-square-test|카이제곱 검정]] 반환값은 (통계량, p값, 자유도, 기대빈도 배열) 순서다. 시험에서는 이 중 어느 것을 묻는지 지문에서 확인."
        ],
        terms: ["chi-square-test", "p-value", "null-hypothesis"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / scipy 1.17.1" }
      },
      {
        id: "a-4-4-p02", node: "a-4-4",
        title: "정규성 → 등분산 → t-검정 흐름대로 p값 구하기",
        difficulty: 2,
        task: [
          "두 집단 `a`, `b` 에 대해 ① `stats.shapiro` 로 각각 정규성을 확인하고(둘 다 p > 0.05 임을 확인), ② `stats.levene` 으로 등분산을 검정하시오.",
          "③ Levene p값이 0.05 이상이면 `equal_var=True`, 미만이면 `equal_var=False` 로 `stats.ttest_ind` 를 수행하고, 그 **p값**을 소수 넷째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np",
          "from scipy import stats",
          "rng = np.random.default_rng(442)",
          "a = rng.normal(70, 8, size=40)",
          "b = rng.normal(74, 12, size=45)",
          "a.mean(), b.mean()"
        ],
        hint: [
          "`equal = stats.levene(a, b).pvalue >= 0.05` 로 bool 을 만들어 `ttest_ind(a, b, equal_var=equal)` 에 넘긴다."
        ],
        answer: { type: "number", value: 0.1134, decimals: 4 },
        solution: [
          "sh_a, sh_b = stats.shapiro(a).pvalue, stats.shapiro(b).pvalue",
          "equal = stats.levene(a, b).pvalue >= 0.05",
          "res = stats.ttest_ind(a, b, equal_var=equal)",
          "round(float(res.pvalue), 4)"
        ],
        explanation: [
          "Shapiro p값은 0.78, 0.16 으로 둘 다 [[normality-test|정규성]]을 기각하지 못하고, [[levene-test|Levene]] p값 0.24 로 등분산도 기각되지 않아 Student [[t-test|t-검정]](`equal_var=True`)을 쓴다. 결과 p = 0.1134 > 0.05 이므로 평균 차이는 유의하지 않다.",
          "만약 [[welch-t-test|Welch]](`equal_var=False`) 를 썼다면 p = 0.1095 로 넷째 자리에서 달라진다 — 흐름도를 따르지 않으면 틀리는 이유다. 시험 지문은 '등분산 검정 결과에 따라' 라고 쓰므로 조건 분기를 코드로 옮기자."
        ],
        terms: ["normality-test", "levene-test", "t-test", "welch-t-test", "p-value"],
        verified: { by: "python", at: "2026-10-04", env: "numpy 2.4.6 / scipy 1.17.1" }
      },
      {
        id: "a-4-4-p03", node: "a-4-4",
        title: "statsmodels 로지스틱 회귀 → x1 의 오즈비",
        difficulty: 3,
        task: [
          "`df` 에서 `y` 를 종속변수, `x1`, `x2` 를 설명변수로 하여 `statsmodels` 의 `Logit` 모형을 적합하시오(`sm.add_constant` 로 상수항 추가).",
          "`x1` 계수의 **오즈비(odds ratio)** `exp(β)` 를 소수 셋째 자리까지 반올림해 입력하시오."
        ],
        setup: [
          "import numpy as np, pandas as pd",
          "import statsmodels.api as sm",
          "rng = np.random.default_rng(443)",
          "n = 600",
          "x1 = rng.normal(size=n)",
          "x2 = rng.integers(0, 2, size=n)",
          "lin = -0.3 + 0.8 * x1 + 0.6 * x2",
          "y = (rng.uniform(size=n) < 1 / (1 + np.exp(-lin))).astype(int)",
          "df = pd.DataFrame({'y': y, 'x1': x1, 'x2': x2})",
          "df['y'].mean()"
        ],
        hint: [
          "`model = sm.Logit(df['y'], sm.add_constant(df[['x1', 'x2']])).fit(disp=0)`",
          "`np.exp(model.params['x1'])`."
        ],
        answer: { type: "number", value: 1.946, decimals: 3 },
        solution: [
          "model = sm.Logit(df['y'], sm.add_constant(df[['x1', 'x2']])).fit(disp=0)",
          "round(float(np.exp(model.params['x1'])), 3)"
        ],
        explanation: [
          "[[logistic-regression|로지스틱 회귀]] 계수 β₁ ≈ 0.666 의 지수 exp(0.666) ≈ 1.946 이 [[odds-ratio|오즈비]]다. 'x1 이 1 표준편차 증가하면 y = 1 의 **오즈가 약 1.95 배**' 로 해석한다(확률이 1.95 배가 아니다). 데이터 생성에 쓴 참값 0.8 의 exp 는 2.23 으로, 표본 추정치가 다소 작게 나왔다.",
          "`model.summary()` 의 `coef` 열이 로그 오즈, `np.exp(model.params)` 가 오즈비, `model.conf_int()` 에 exp 를 씌우면 오즈비 신뢰구간이다. sklearn `LogisticRegression` 은 기본 L2 규제가 있어 statsmodels 와 계수가 조금 다르다 — 시험에서 '오즈비 해석' 은 보통 statsmodels 출력으로 나온다."
        ],
        terms: ["logistic-regression", "odds-ratio"],
        verified: { by: "python", at: "2026-10-04", env: "pandas 3.0.6 / numpy 2.4.6 / statsmodels 0.15.0" }
      }
    ],

    /* ============================================================
       용어 사전 (이 파일에서 태그·링크한 용어 전부)
       ============================================================ */
    terms: [
      /* --- 4-1 전처리 --- */
      { id: "missing-value", ko: "결측값", en: "missing value / NaN",
        def: "관측되지 않아 비어 있는 값. pandas 에서는 NaN/None 으로 표현되며 제거(dropna) 또는 대치(fillna)로 처리한다.",
        nodes: ["a-4-1"], related: ["outlier", "feature-engineering"] },
      { id: "outlier", ko: "이상치", en: "outlier",
        def: "다른 관측값들과 동떨어진 극단적인 값. IQR 규칙(Q1−1.5·IQR, Q3+1.5·IQR) 이나 z-점수로 탐지한다.",
        nodes: ["a-4-1"], related: ["iqr", "missing-value"] },
      { id: "iqr", ko: "사분위 범위", en: "IQR (interquartile range)",
        def: "3사분위수(Q3)와 1사분위수(Q1)의 차이. Q1−1.5·IQR 미만 또는 Q3+1.5·IQR 초과를 이상치로 판정하는 기준이 된다.",
        nodes: ["a-4-1"], related: ["outlier"] },
      { id: "column-transformer", ko: "컬럼 변환기", en: "ColumnTransformer",
        def: "sklearn 에서 컬럼 그룹별로 서로 다른 전처리(스케일링·인코딩 등)를 적용하고 결과를 가로로 이어 붙이는 변환기.",
        nodes: ["a-4-1"], related: ["one-hot-encoding", "standardization", "pipeline"] },
      { id: "one-hot-encoding", ko: "원핫 인코딩", en: "one-hot encoding",
        def: "범주형 변수를 범주 수만큼의 0/1 더미 열로 바꾸는 인코딩. sklearn OneHotEncoder, pandas get_dummies 로 수행한다.",
        nodes: ["a-4-1"], related: ["column-transformer", "multicollinearity"] },
      { id: "standardization", ko: "표준화", en: "standardization / StandardScaler",
        def: "각 변수에서 평균을 빼고 표준편차로 나누어 평균 0, 표준편차 1 로 맞추는 스케일링. 거리 기반 모델과 규제 모델에 필수적이다.",
        nodes: ["a-4-1", "a-4-3"], related: ["column-transformer", "data-leakage", "kmeans"] },
      { id: "data-leakage", ko: "데이터 누수", en: "data leakage",
        def: "테스트(미래) 데이터의 정보가 학습 과정에 섞여 들어가 성능이 과대평가되는 현상. 전처리를 분리 전 전체 데이터에 fit 하는 것이 대표적 원인.",
        nodes: ["a-4-1"], related: ["train-test-split", "standardization", "pipeline"] },
      { id: "train-test-split", ko: "훈련/테스트 분리", en: "train_test_split",
        def: "데이터를 모델 학습용(train)과 평가용(test)으로 무작위 분리하는 것. random_state 로 재현하고 stratify 로 클래스 비율을 유지한다.",
        nodes: ["a-4-1", "a-4-2"], related: ["data-leakage", "cross-validation"] },
      { id: "feature-engineering", ko: "특성 공학 / 파생변수 생성", en: "feature engineering / derived variable",
        def: "기존 컬럼에서 날짜 분해, 조건 라벨링, 그룹 집계, 비율 계산 등으로 모델에 유용한 새 변수를 만드는 작업.",
        nodes: ["a-4-1"], related: ["missing-value", "one-hot-encoding"] },
      { id: "correlation-matrix", ko: "상관행렬", en: "correlation matrix",
        def: "모든 수치형 변수 쌍의 상관계수를 정방 행렬로 나타낸 것. df.corr() 로 구하며 고상관 변수 탐지와 다중공선성 점검에 쓴다.",
        nodes: ["a-4-1"], related: ["multicollinearity", "vif"] },
      { id: "multicollinearity", ko: "다중공선성", en: "multicollinearity",
        def: "설명 변수들이 서로 강하게 선형 상관되어 회귀 계수 추정이 불안정해지는 현상. 상관행렬이나 VIF 로 진단하고 변수 제거·규제로 완화한다.",
        nodes: ["a-4-1", "a-4-2"], related: ["vif", "correlation-matrix"] },
      { id: "vif", ko: "분산팽창계수", en: "VIF (variance inflation factor)",
        def: "변수 j 를 나머지 설명 변수로 회귀한 R² 로 1/(1−R²) 를 계산한 다중공선성 지표. 보통 10 이상(엄격하면 5)이면 문제로 본다.",
        nodes: ["a-4-1", "a-4-2"], related: ["multicollinearity", "correlation-matrix"] },

      /* --- 4-2 평가·변수 선택 --- */
      { id: "confusion-matrix", ko: "혼동행렬", en: "confusion matrix",
        def: "분류 결과를 실제 클래스(행)와 예측 클래스(열)로 교차 집계한 표. sklearn 은 [[TN, FP], [FN, TP]] 순서로 반환한다.",
        nodes: ["a-4-2"], related: ["precision", "recall", "f1-score"] },
      { id: "precision", ko: "정밀도", en: "precision",
        def: "양성으로 예측한 것 중 실제 양성의 비율, TP/(TP+FP). 거짓 양성(FP)의 비용이 클 때 중시한다.",
        nodes: ["a-4-2"], related: ["recall", "f1-score", "confusion-matrix"] },
      { id: "recall", ko: "재현율", en: "recall / sensitivity / TPR",
        def: "실제 양성 중 양성으로 맞게 예측한 비율, TP/(TP+FN). 거짓 음성(FN)의 비용이 클 때 중시한다.",
        nodes: ["a-4-2"], related: ["precision", "f1-score", "confusion-matrix"] },
      { id: "f1-score", ko: "F1 점수", en: "F1 score",
        def: "정밀도와 재현율의 조화평균 2PR/(P+R). 두 지표가 모두 높아야 커지며 불균형 데이터에서 정확도 대신 쓴다.",
        nodes: ["a-4-2"], related: ["precision", "recall"] },
      { id: "roc-auc", ko: "ROC 곡선 아래 면적", en: "ROC-AUC (Area Under the ROC Curve)",
        def: "임계값을 바꾸며 그린 (FPR, TPR) 곡선 아래 면적. 0.5 는 무작위, 1.0 은 완벽한 분류이며 확률 점수를 입력으로 계산한다.",
        nodes: ["a-4-2"], related: ["threshold", "recall"] },
      { id: "threshold", ko: "임계값", en: "threshold / cutoff",
        def: "예측 확률을 양성/음성으로 가르는 기준값(기본 0.5). 낮추면 재현율이 오르고 정밀도가 내려가는 트레이드오프가 있다.",
        nodes: ["a-4-2"], related: ["roc-auc", "precision", "recall"] },
      { id: "rmse", ko: "평균제곱근오차", en: "RMSE (root mean squared error)",
        def: "예측 오차 제곱 평균(MSE)의 제곱근. 타깃과 같은 단위를 가지며 큰 오차에 민감하다.",
        nodes: ["a-4-2"], related: ["mae", "mape", "r-squared"] },
      { id: "mae", ko: "평균절대오차", en: "MAE (mean absolute error)",
        def: "예측 오차 절댓값의 평균. RMSE 보다 이상치에 덜 민감하다.",
        nodes: ["a-4-2"], related: ["rmse", "mape"] },
      { id: "mape", ko: "평균절대백분율오차", en: "MAPE (mean absolute percentage error)",
        def: "|실제−예측|/|실제| 의 평균을 백분율로 나타낸 지표. 실제값이 0 에 가까우면 값이 폭발하는 단점이 있다.",
        nodes: ["a-4-2"], related: ["mae", "rmse"] },
      { id: "r-squared", ko: "결정계수", en: "R² (coefficient of determination)",
        def: "모델이 설명하는 분산의 비율, 1 − SSE/SST. 변수를 추가하면 감소하지 않으므로 변수 수가 다른 모델 비교에는 조정 R² 를 쓴다.",
        nodes: ["a-4-2"], related: ["adjusted-r-squared", "rmse"] },
      { id: "adjusted-r-squared", ko: "조정된 결정계수", en: "adjusted R²",
        def: "설명 변수 수 k 에 벌점을 준 결정계수, 1 − (1−R²)(n−1)/(n−k−1). 불필요한 변수를 추가하면 감소할 수 있다.",
        nodes: ["a-4-2"], related: ["r-squared"] },
      { id: "cross-validation", ko: "교차검증", en: "cross-validation (k-fold CV)",
        def: "데이터를 k 개 폴드로 나누어 k 번 학습·검증을 반복하고 점수를 평균하는 평가 방법. cross_val_score, cross_validate, GridSearchCV 가 사용한다.",
        nodes: ["a-4-2", "a-4-3"], related: ["grid-search", "overfitting", "train-test-split"] },
      { id: "overfitting", ko: "과적합", en: "overfitting",
        def: "모델이 훈련 데이터의 잡음까지 학습해 훈련 점수는 높지만 새 데이터에서 성능이 떨어지는 상태. 규제·데이터 추가·단순화로 완화한다.",
        nodes: ["a-4-2", "a-4-3"], related: ["bias-variance-tradeoff", "early-stopping", "cross-validation"] },
      { id: "bias-variance-tradeoff", ko: "편향-분산 트레이드오프", en: "bias-variance tradeoff",
        def: "모델이 단순하면 편향(bias)이 커 과소적합, 복잡하면 분산(variance)이 커 과적합되는 상충 관계. 적정 복잡도를 찾는 것이 목표다.",
        nodes: ["a-4-2"], related: ["overfitting"] },
      { id: "feature-selection", ko: "변수 선택", en: "feature selection",
        def: "모델에 쓸 설명 변수의 부분집합을 고르는 과정. 필터(통계량), 래퍼(모델 반복 학습), 임베디드(학습 과정 내 선택) 세 방식으로 나눈다.",
        nodes: ["a-4-2"], related: ["rfe", "lasso", "vif"] },
      { id: "rfe", ko: "재귀적 특성 제거", en: "RFE (Recursive Feature Elimination)",
        def: "모델을 학습해 중요도가 가장 낮은 변수를 제거하는 과정을 목표 개수가 남을 때까지 반복하는 래퍼 방식 변수 선택. support_ 로 선택 결과를 본다.",
        nodes: ["a-4-2"], related: ["feature-selection", "lasso"] },
      { id: "lasso", ko: "라쏘 회귀", en: "Lasso (L1 regularization)",
        def: "계수 절댓값 합(L1 노름)을 벌점으로 더하는 선형 회귀. 일부 계수를 정확히 0 으로 만들어 변수 선택 효과를 낸다.",
        nodes: ["a-4-2"], related: ["feature-selection", "hyperparameter"] },

      /* --- 4-3 튜닝·군집 --- */
      { id: "hyperparameter", ko: "하이퍼파라미터", en: "hyperparameter",
        def: "학습으로 추정되지 않고 사람이 미리 정하는 모델 설정값(C, alpha, max_depth, n_estimators, learning_rate 등). 교차검증으로 탐색한다.",
        nodes: ["a-4-3"], related: ["grid-search", "early-stopping", "lasso"] },
      { id: "grid-search", ko: "그리드 서치", en: "GridSearchCV / RandomizedSearchCV",
        def: "하이퍼파라미터 후보의 모든 조합(또는 무작위 n_iter 개)을 교차검증으로 평가해 best_params_, best_score_, best_estimator_ 를 찾는 탐색 방법.",
        nodes: ["a-4-3"], related: ["hyperparameter", "cross-validation", "pipeline"] },
      { id: "pipeline", ko: "파이프라인", en: "Pipeline",
        def: "전처리 단계들과 모델을 하나의 추정기로 묶는 sklearn 객체. 내부 파라미터는 '단계명__파라미터' 로 지정하며 교차검증 시 누수를 막는다.",
        nodes: ["a-4-3", "a-4-1"], related: ["grid-search", "column-transformer", "data-leakage"] },
      { id: "early-stopping", ko: "조기 종료", en: "early stopping",
        def: "반복 학습 중 검증 점수가 일정 횟수 동안 개선되지 않으면 학습을 멈추어 과적합을 막는 기법. 부스팅과 신경망에서 쓴다.",
        nodes: ["a-4-3"], related: ["overfitting", "hyperparameter"] },
      { id: "kmeans", ko: "K-평균 군집화", en: "K-means clustering",
        def: "k 개 중심을 반복 갱신해 각 점을 가장 가까운 중심에 배정하는 분할 군집 알고리즘. n_clusters, n_init, random_state 를 지정하고 inertia_, labels_, cluster_centers_ 를 얻는다.",
        nodes: ["a-4-3"], related: ["inertia", "elbow-method", "silhouette-score", "standardization"] },
      { id: "inertia", ko: "관성 (군집 내 제곱합)", en: "inertia / WCSS (within-cluster sum of squares)",
        def: "각 점에서 소속 군집 중심까지 거리의 제곱합. k 가 커지면 단조 감소하며 엘보우 방법의 y 축 값이다.",
        nodes: ["a-4-3"], related: ["kmeans", "elbow-method"] },
      { id: "elbow-method", ko: "엘보우 방법", en: "elbow method",
        def: "k 를 늘리며 inertia 를 그려 감소 폭이 급격히 줄어드는 꺾임점(팔꿈치)을 최적 군집 수로 택하는 방법.",
        nodes: ["a-4-3"], related: ["inertia", "silhouette-score", "kmeans"] },
      { id: "silhouette-score", ko: "실루엣 계수", en: "silhouette score / coefficient",
        def: "점별로 (b−a)/max(a,b) — a 는 같은 군집 내 평균 거리, b 는 가장 가까운 다른 군집까지 평균 거리 — 를 구해 평균한 군집 품질 지표. −1~1 이며 클수록 좋다.",
        nodes: ["a-4-3"], related: ["kmeans", "elbow-method"] },
      { id: "dbscan", ko: "밀도 기반 군집화", en: "DBSCAN",
        def: "eps 반경 안에 min_samples 개 이상 점이 있는 핵심점을 이어 군집을 만드는 밀도 기반 알고리즘. 군집 수를 미리 정하지 않고 노이즈를 −1 로 표시한다.",
        nodes: ["a-4-3"], related: ["kmeans", "hierarchical-clustering"] },
      { id: "hierarchical-clustering", ko: "계층적 군집화", en: "hierarchical clustering / linkage / dendrogram",
        def: "가까운 점(군집)들을 단계적으로 병합해 트리(덴드로그램)를 만들고 원하는 높이에서 잘라 군집을 얻는 방법. 연결 기준은 ward·complete·average 등.",
        nodes: ["a-4-3"], related: ["dbscan", "kmeans"] },
      { id: "pca", ko: "주성분 분석", en: "PCA (principal component analysis)",
        def: "분산이 최대가 되는 직교 축(주성분)으로 데이터를 투영해 차원을 줄이는 기법. explained_variance_ratio_ 누적합으로 성분 수를 정한다.",
        nodes: ["a-4-3"], related: ["standardization", "kmeans"] },

      /* --- 4-4 검정·특수 모델 --- */
      { id: "null-hypothesis", ko: "귀무가설", en: "null hypothesis (H0)",
        def: "'차이가 없다', '독립이다' 처럼 검정에서 기각 여부를 판단하는 기본 가설. p값이 유의수준보다 작으면 기각한다.",
        nodes: ["a-4-4"], related: ["p-value"] },
      { id: "p-value", ko: "p값 (유의확률)", en: "p-value",
        def: "귀무가설이 참일 때 관측된 통계량 이상으로 극단적인 값이 나올 확률. 유의수준(보통 0.05)보다 작으면 귀무가설을 기각한다.",
        nodes: ["a-4-4"], related: ["null-hypothesis", "statistical-power"] },
      { id: "normality-test", ko: "정규성 검정", en: "normality test (Shapiro-Wilk)",
        def: "표본이 정규분포에서 왔다는 귀무가설을 검정하는 절차. stats.shapiro 의 p > 0.05 면 정규성을 가정하고 모수 검정을 쓴다.",
        nodes: ["a-4-4"], related: ["levene-test", "t-test", "kruskal-wallis"] },
      { id: "levene-test", ko: "레빈 등분산 검정", en: "Levene's test (homogeneity of variance)",
        def: "여러 집단의 분산이 같다는 귀무가설을 검정하는 방법. 중앙값 기반이라 정규성 위반에 강건하며 p < 0.05 면 Welch t-검정을 쓴다.",
        nodes: ["a-4-4"], related: ["normality-test", "welch-t-test", "t-test"] },
      { id: "t-test", ko: "t-검정", en: "t-test (ttest_ind / ttest_rel)",
        def: "두 집단 평균의 차이를 t 분포로 검정하는 모수 검정. 독립표본은 ttest_ind, 대응표본은 ttest_rel 을 쓴다.",
        nodes: ["a-4-4"], related: ["welch-t-test", "paired-t-test", "anova"] },
      { id: "welch-t-test", ko: "웰치 t-검정", en: "Welch's t-test (equal_var=False)",
        def: "두 집단의 분산이 다를 때 자유도를 보정해 평균을 비교하는 독립표본 t-검정. scipy 에서는 ttest_ind(..., equal_var=False).",
        nodes: ["a-4-4"], related: ["t-test", "levene-test"] },
      { id: "paired-t-test", ko: "대응표본 t-검정", en: "paired t-test (ttest_rel)",
        def: "같은 대상에서 두 번 측정한(전·후) 짝지어진 자료의 평균 차이를 검정하는 t-검정. 비모수 대안은 Wilcoxon 부호순위 검정.",
        nodes: ["a-4-4"], related: ["t-test"] },
      { id: "anova", ko: "분산분석", en: "ANOVA (f_oneway)",
        def: "세 개 이상 집단의 평균이 모두 같다는 귀무가설을 F 통계량으로 검정하는 모수 검정. 유의하면 Tukey HSD 등 사후검정으로 어느 쌍이 다른지 본다.",
        nodes: ["a-4-4"], related: ["kruskal-wallis", "t-test", "bonferroni-correction"] },
      { id: "kruskal-wallis", ko: "크루스칼-왈리스 검정", en: "Kruskal-Wallis test (stats.kruskal)",
        def: "세 개 이상 집단의 분포(중앙값)를 순위로 비교하는 비모수 검정. 정규성이 깨졌을 때 일원배치 ANOVA 대신 쓴다.",
        nodes: ["a-4-4"], related: ["anova", "normality-test"] },
      { id: "chi-square-test", ko: "카이제곱 검정", en: "chi-square test (chi2_contingency)",
        def: "범주형 변수의 관측빈도와 기대빈도 차이를 검정하는 방법. 독립성 검정은 교차표로, 적합도 검정은 기대 분포로 수행하며 자유도는 (행−1)(열−1).",
        nodes: ["a-4-4"], related: ["null-hypothesis", "p-value"] },
      { id: "bonferroni-correction", ko: "본페로니 보정", en: "Bonferroni correction",
        def: "여러 검정을 동시에 할 때 유의수준을 검정 수 m 으로 나누어(α/m) 전체 1종 오류를 통제하는 다중비교 보정. 보수적이어서 검정력이 낮아진다.",
        nodes: ["a-4-4"], related: ["p-value", "anova", "statistical-power"] },
      { id: "effect-size", ko: "효과크기", en: "effect size (Cohen's d)",
        def: "집단 차이나 관계의 실질적 크기를 표준화한 지표. Cohen's d 는 0.2 작음·0.5 중간·0.8 큼으로 해석하며 p값과 달리 표본 크기에 영향받지 않는다.",
        nodes: ["a-4-4"], related: ["statistical-power", "ab-test"] },
      { id: "odds-ratio", ko: "오즈비", en: "odds ratio",
        def: "로지스틱 회귀 계수의 지수 exp(β). 설명 변수가 1 단위 증가할 때 양성 오즈(p/(1−p))가 몇 배가 되는지를 나타낸다.",
        nodes: ["a-4-4"], related: ["logistic-regression"] },
      { id: "logistic-regression", ko: "로지스틱 회귀", en: "logistic regression (Logit)",
        def: "이진 종속변수의 로그 오즈를 설명 변수의 선형 결합으로 모델링하는 분류 모형. statsmodels Logit 은 계수·p값·오즈비 해석에, sklearn 은 예측에 주로 쓴다.",
        nodes: ["a-4-4"], related: ["odds-ratio"] },
      { id: "arima", ko: "자기회귀 누적 이동평균 모형", en: "ARIMA(p, d, q)",
        def: "자기회귀 차수 p, 차분 횟수 d, 이동평균 차수 q 로 시계열을 모델링하는 방법. 차분으로 정상성을 확보한 뒤 AR·MA 항을 적합한다.",
        nodes: ["a-4-4"], related: ["stationarity", "adf-test"] },
      { id: "stationarity", ko: "정상성", en: "stationarity",
        def: "시계열의 평균·분산·자기상관 구조가 시간에 따라 변하지 않는 성질. ARIMA 의 전제이며 차분이나 로그 변환으로 확보한다.",
        nodes: ["a-4-4"], related: ["adf-test", "arima"] },
      { id: "adf-test", ko: "ADF 단위근 검정", en: "ADF test (Augmented Dickey-Fuller)",
        def: "시계열에 단위근이 존재한다(비정상)는 귀무가설을 검정하는 방법. adfuller 의 p < 0.05 면 정상 시계열로 판단한다.",
        nodes: ["a-4-4"], related: ["stationarity", "arima", "null-hypothesis"] },
      { id: "statistical-power", ko: "검정력", en: "statistical power (1 − β)",
        def: "실제 효과가 있을 때 귀무가설을 올바르게 기각할 확률. 관례적으로 0.8 을 목표로 하며 표본 크기 산정의 핵심 요소다.",
        nodes: ["a-4-4"], related: ["effect-size", "ab-test", "p-value"] },
      { id: "ab-test", ko: "A/B 테스트", en: "A/B test",
        def: "사용자를 무작위로 두 집단에 배정해 처리(B)와 대조(A)의 지표 차이를 가설검정으로 비교하는 실험 설계. 효과크기·유의수준·검정력으로 표본 크기를 미리 정한다.",
        nodes: ["a-4-4"], related: ["statistical-power", "effect-size", "t-test"] }
    ]
  });
})();
