/* ds-level2 — 파트A 1장 SQL 학습 (a-1-1 ~ a-1-4)
   노드: 1-1 SQL 기초 / 1-2 SQL 중급 / 1-3 SQL 고급 / 1-4 SQL ↔ Pandas
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그·링크한 용어는 전부 이 파일에서 정의.
   정답 기준: 표준 SQL. 출력 문제는 sqlite3 3.45(인메모리)·pandas 3.0.6 으로 실행해 확인했다.
   BigQuery 방언(SAFE_DIVIDE, 백틱 식별자, UNION DISTINCT)은 해설에 한 줄만 언급한다. */
(function () {
  DS2.register({
    chapter: "a-1",

    cards: {
      "a-1-1": {
        node: "a-1-1",
        title: "SQL 기초",
        summary: [
          "SELECT 문은 쓰는 순서와 **실행 순서**가 다르다. `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`를 외워야 WHERE 에 [[aggregate-function|집계함수]]를 못 쓰는 이유, SELECT 별칭을 WHERE 에서 못 쓰는 이유가 설명된다.",
          "[[null|NULL]]은 값이 아니라 '모름'이다. `= NULL`은 항상 거짓, 비교는 `IS NULL`, 집계함수는 NULL 을 **무시**하고 `COUNT(*)`만 행 전체를 센다.",
          "그룹 전 필터는 [[where-clause|WHERE]], 그룹 후 필터는 [[having|HAVING]]. 이 두 가지 구분이 기초 파트 출제의 절반이다."
        ],
        concepts: [
          "**실행 순서(logical processing order)**: FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT. SELECT 가 늦게 실행되므로 WHERE/GROUP BY/HAVING 에서는 SELECT 별칭(alias)을 참조할 수 없고, ORDER BY 에서는 가능하다.",
          "**WHERE vs HAVING**: WHERE 는 행(row) 단위, HAVING 은 그룹(group) 단위 조건. 집계함수는 HAVING 에서만 쓸 수 있다.",
          "**집계함수(aggregate function)**: `COUNT, SUM, AVG, MIN, MAX`. 모두 NULL 을 무시한다. `COUNT(*)`는 NULL 포함 행 수, `COUNT(col)`은 col 이 NULL 이 아닌 행 수, `COUNT(DISTINCT col)`은 서로 다른 값의 수.",
          "**NULL 처리**: `IS NULL / IS NOT NULL`로 판별, [[coalesce|COALESCE]]`(a, b, ...)`는 첫 번째 NULL 이 아닌 값, `NULLIF(a, b)`는 a=b 이면 NULL. NULL 과의 산술·비교 결과는 모두 NULL(3치 논리).",
          "**DISTINCT**: 선택한 **컬럼 조합** 기준으로 중복 행을 제거한다. `SELECT DISTINCT a, b`는 (a, b) 쌍이 같은 행만 하나로 합친다.",
          "**ORDER BY / LIMIT**: 기본 오름차순(ASC), `DESC`로 내림차순. `LIMIT n OFFSET m`으로 상위 n개 추출. NULL 의 정렬 위치는 DBMS 마다 다르다(SQLite·MySQL 은 NULL 이 가장 작은 값, Oracle·PostgreSQL 은 가장 큰 값).",
          "**CASE 식**: `CASE WHEN 조건 THEN 값 ... ELSE 값 END`. SELECT 안에서 파생 컬럼을 만들고, `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`로 조건부 집계를 한다.",
          "**문자열·날짜 함수**: `UPPER/LOWER, LENGTH, SUBSTR(s, start, len), TRIM, REPLACE, ||`(연결). 날짜는 DBMS 의존적이라 시험은 `strftime`·`DATE()`보다 **CASE 와 집계의 조합**을 주로 묻는다."
        ],
        terms: ["sql-execution-order", "where-clause", "group-by", "having", "aggregate-function", "null", "coalesce", "distinct", "order-by", "case-expression"],
        patterns: [
          {
            title: "그룹별 집계 뒤 그룹 조건 필터",
            lang: "sql",
            code: [
              "SELECT dept, COUNT(*) AS n, AVG(salary) AS avg_salary",
              "FROM emp",
              "WHERE hire_year >= 2020        -- 행 조건: 그룹화 전",
              "GROUP BY dept",
              "HAVING COUNT(*) >= 5           -- 그룹 조건: 그룹화 후",
              "ORDER BY avg_salary DESC",
              "LIMIT 3;"
            ],
            note: "WHERE 에 `COUNT(*)`를 쓰면 오류. 집계 조건은 HAVING 으로."
          },
          {
            title: "NULL 세기와 치환",
            lang: "sql",
            code: [
              "SELECT COUNT(*)            AS all_rows,",
              "       COUNT(bonus)        AS non_null_bonus,",
              "       COUNT(*) - COUNT(bonus) AS null_bonus,",
              "       AVG(COALESCE(bonus, 0)) AS avg_bonus_zero_filled",
              "FROM emp",
              "WHERE bonus IS NULL OR bonus > 0;"
            ],
            note: "`AVG(bonus)`는 NULL 을 분모에서 빼고, `AVG(COALESCE(bonus, 0))`는 0으로 채워 분모에 넣는다. 둘은 다르다."
          },
          {
            title: "CASE 로 조건부 집계(피벗 흉내)",
            lang: "sql",
            code: [
              "SELECT dept,",
              "       SUM(CASE WHEN gender = 'F' THEN 1 ELSE 0 END) AS n_female,",
              "       SUM(CASE WHEN gender = 'M' THEN 1 ELSE 0 END) AS n_male",
              "FROM emp",
              "GROUP BY dept;"
            ]
          },
          {
            title: "DISTINCT 와 COUNT(DISTINCT)",
            lang: "sql",
            code: [
              "SELECT DISTINCT dept, job FROM emp;        -- (dept, job) 조합 기준 중복 제거",
              "SELECT COUNT(DISTINCT dept) FROM emp;      -- 서로 다른 dept 수 (NULL 제외)"
            ]
          }
        ],
        pitfalls: [
          "`WHERE col = NULL`은 한 행도 못 고른다. 반드시 `IS NULL`.",
          "`COUNT(col)`과 `COUNT(*)`의 차이 = col 의 NULL 개수. 시험에서 가장 자주 나오는 숫자 함정.",
          "SELECT 별칭을 WHERE 에서 쓰면 표준 SQL 에서는 오류(실행 순서상 아직 없음). ORDER BY 에서는 가능.",
          "`SUM`은 NULL 을 0 으로 치지 않고 **무시**한다. 전부 NULL 이면 결과도 NULL(0 이 아님)."
        ]
      },

      "a-1-2": {
        node: "a-1-2",
        title: "SQL 중급",
        summary: [
          "[[inner-join|INNER JOIN]]은 양쪽에 매칭되는 행만, [[left-join|LEFT JOIN]]은 왼쪽 전체 + 매칭 없으면 NULL, FULL OUTER 는 양쪽 전체. 결과 **행 수**를 예측하는 문제가 반복된다.",
          "LEFT JOIN 뒤 오른쪽 컬럼 조건을 WHERE 에 쓰면 NULL 행이 걸러져 INNER JOIN 으로 변해 버린다 — 조건은 ON 에 둔다. 반대로 `WHERE 오른쪽.key IS NULL`은 의도적인 [[anti-join|안티 조인]]이다.",
          "집합 연산 [[union|UNION]](중복 제거)/UNION ALL(중복 유지)/INTERSECT/EXCEPT, [[subquery|서브쿼리]]와 [[exists|EXISTS]]/IN, 그리고 가독성을 위한 [[cte|CTE(WITH)]]가 중급의 나머지다."
        ],
        concepts: [
          "**INNER JOIN**: ON 조건을 만족하는 행의 조합만. 키가 한쪽에서 중복되면 결과 행이 곱으로 늘어난다(1:N → N행).",
          "**LEFT/RIGHT (OUTER) JOIN**: 기준 테이블의 모든 행을 유지하고 상대 쪽에 매칭이 없으면 NULL 로 채운다. `A RIGHT JOIN B` = `B LEFT JOIN A`. **FULL OUTER JOIN** 은 양쪽 모두 유지(SQLite 3.39+, MySQL 은 미지원 → UNION 으로 흉내).",
          "**CROSS JOIN**: 조건 없는 모든 조합(카티션 곱). 행 수 = |A| × |B|. **SELF JOIN**: 같은 테이블을 별칭 둘로 조인(상사-부하, 연속 행 비교).",
          "**서브쿼리(subquery)**: SELECT 안의 SELECT. 스칼라(값 하나), 행/리스트(IN), 파생 테이블(FROM 절), 상관 서브쿼리(바깥 행을 참조, 행마다 재평가).",
          "**EXISTS vs IN**: 둘 다 '존재 여부' 필터. `NOT IN (서브쿼리)`는 서브쿼리 결과에 NULL 이 하나라도 있으면 **전체가 공집합**이 된다(3치 논리). `NOT EXISTS`는 안전하다.",
          "**집합 연산**: UNION(중복 제거 — BigQuery 는 `UNION DISTINCT`로 명시), UNION ALL(그대로 이어붙임, 빠름), INTERSECT(공통), EXCEPT/MINUS(차집합). 컬럼 수·타입이 같아야 한다.",
          "**CTE(WITH)**: `WITH t AS (SELECT ...) SELECT ... FROM t`. 서브쿼리에 이름을 붙여 위에서 아래로 읽게 한다. 여러 개는 쉼표로 이어 쓴다."
        ],
        terms: ["inner-join", "left-join", "right-join", "full-outer-join", "self-join", "cross-join", "anti-join", "subquery", "correlated-subquery", "exists", "union", "union-all", "cte"],
        patterns: [
          {
            title: "LEFT JOIN + 오른쪽 조건은 ON 에",
            lang: "sql",
            code: [
              "-- 모든 직원을 유지하면서 '활성' 부서 이름만 붙이기",
              "SELECT e.name, d.name AS dept_name",
              "FROM emp e",
              "LEFT JOIN dept d ON e.dept_id = d.id AND d.active = 1;",
              "-- WHERE d.active = 1 로 쓰면 매칭 없는 직원(d.* 가 NULL)이 사라져 INNER JOIN 과 같아진다."
            ]
          },
          {
            title: "안티 조인(없는 것 찾기) 두 가지",
            lang: "sql",
            code: [
              "-- 1) LEFT JOIN + IS NULL",
              "SELECT e.* FROM emp e LEFT JOIN dept d ON e.dept_id = d.id WHERE d.id IS NULL;",
              "-- 2) NOT EXISTS (NULL 안전)",
              "SELECT e.* FROM emp e WHERE NOT EXISTS (SELECT 1 FROM dept d WHERE d.id = e.dept_id);"
            ],
            note: "`NOT IN (SELECT dept_id FROM ...)`은 서브쿼리에 NULL 이 섞이면 빈 결과가 된다."
          },
          {
            title: "상관 서브쿼리: 부서 평균보다 높은 직원",
            lang: "sql",
            code: [
              "SELECT e.name, e.salary",
              "FROM emp e",
              "WHERE e.salary > (SELECT AVG(salary) FROM emp WHERE dept_id = e.dept_id);"
            ],
            note: "바깥 행(e)을 참조하므로 행마다 재평가된다. 1-3의 윈도 함수 `AVG() OVER (PARTITION BY dept_id)`로 바꿔 쓸 수 있다."
          },
          {
            title: "CTE 로 단계 나누기",
            lang: "sql",
            code: [
              "WITH dept_avg AS (",
              "  SELECT dept_id, AVG(salary) AS avg_salary FROM emp GROUP BY dept_id",
              "),",
              "big AS (SELECT * FROM dept_avg WHERE avg_salary >= 6000)",
              "SELECT d.name, b.avg_salary",
              "FROM big b JOIN dept d ON d.id = b.dept_id;"
            ]
          },
          {
            title: "UNION vs UNION ALL",
            lang: "sql",
            code: [
              "SELECT city FROM customers",
              "UNION ALL                     -- 중복 유지. 개수 세기엔 이쪽",
              "SELECT city FROM suppliers;",
              "-- UNION 은 중복 제거(정렬·해시 비용). BigQuery 는 UNION DISTINCT / UNION ALL 을 반드시 명시."
            ]
          }
        ],
        pitfalls: [
          "JOIN 결과 행 수 = 매칭 쌍의 수. 키가 양쪽에서 중복이면 곱으로 늘어난다(2×3 = 6행).",
          "LEFT JOIN 후 WHERE 에 오른쭉 컬럼 조건 → INNER JOIN 으로 변질. ON 에 쓰거나 `OR d.col IS NULL`을 덧붙인다.",
          "`NOT IN` + NULL = 빈 결과. `NOT EXISTS`가 안전.",
          "UNION 은 중복을 **제거**한다. '두 테이블 합친 행 수' 문제는 UNION ALL 인지 확인."
        ]
      },

      "a-1-3": {
        node: "a-1-3",
        title: "SQL 고급",
        summary: [
          "[[window-function|윈도 함수]]는 GROUP BY 처럼 그룹 계산을 하지만 **행 수를 줄이지 않는다**. `함수() OVER (PARTITION BY 그룹 ORDER BY 정렬 [프레임])` 구문 하나로 순위·누적합·이동평균·전행 비교를 모두 처리한다.",
          "순위 3종 [[row-number|ROW_NUMBER]](항상 고유)·[[rank|RANK]](동률 뒤 건너뜀)·[[dense-rank|DENSE_RANK]](건너뛰지 않음), 그리고 [[lag-lead|LAG/LEAD]]의 첫 행 NULL 이 출력 문제의 핵심이다.",
          "윈도 함수는 SELECT 가 실행될 때 계산되므로 WHERE/HAVING 에 직접 쓸 수 없다 — 서브쿼리나 [[cte|CTE]]로 감싸서 필터한다(그룹별 상위 N)."
        ],
        concepts: [
          "**윈도 함수 구문**: `f(x) OVER (PARTITION BY p ORDER BY o ROWS BETWEEN ... AND ...)`. PARTITION BY 는 GROUP BY 의 그룹에 대응하지만 결과 행은 원본과 같다. 생략하면 전체가 한 파티션.",
          "**순위 함수**: ROW_NUMBER 는 1,2,3,… 고유 번호(동률은 임의/ORDER BY 2차 키로 결정). RANK 는 동률에 같은 순위를 주고 다음 순위를 건너뛴다(1,1,3). DENSE_RANK 는 건너뛰지 않는다(1,1,2).",
          "**LAG/LEAD**: `LAG(x, n, default)`는 n행 앞의 값, LEAD 는 n행 뒤의 값. 파티션의 첫/끝 행은 default(기본 NULL). 전일 대비 증감 계산에 쓴다.",
          "**집계 윈도**: `SUM(x) OVER (PARTITION BY p ORDER BY o)`는 누적합(running total). ORDER BY 를 빼면 파티션 전체 합이 모든 행에 붙는다(비율 계산: `x * 1.0 / SUM(x) OVER (PARTITION BY p)`).",
          "**프레임(frame)**: `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`는 7행 이동평균. ORDER BY 가 있을 때 기본 프레임은 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`라 **동률 행이 함께 포함**된다 — 행 단위 누적이 필요하면 ROWS 를 명시.",
          "**그룹별 상위 N(top-N per group)**: CTE 에서 `ROW_NUMBER() OVER (PARTITION BY g ORDER BY v DESC) AS rn`을 만들고 바깥에서 `WHERE rn <= N`.",
          "**CASE 피벗**: 표준 SQL 에 PIVOT 이 없으므로 `SUM(CASE WHEN col = 'A' THEN v END) AS A`를 열마다 반복한다. BigQuery·SQL Server 는 PIVOT 구문이 따로 있다.",
          "**재귀 CTE**: `WITH RECURSIVE t AS (앵커 UNION ALL 재귀 부분 참조 t) SELECT * FROM t`. 조직도·경로·연속 날짜 생성에 쓴다. 종료 조건이 없으면 무한 루프."
        ],
        terms: ["window-function", "partition-by", "row-number", "rank", "dense-rank", "lag-lead", "window-frame", "running-total", "moving-average", "top-n-per-group", "pivot", "recursive-cte"],
        patterns: [
          {
            title: "순위 3종 비교",
            lang: "sql",
            code: [
              "SELECT name, salary,",
              "       ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn,   -- 1,2,3,4",
              "       RANK()       OVER (ORDER BY salary DESC) AS rk,   -- 1,1,3,4",
              "       DENSE_RANK() OVER (ORDER BY salary DESC) AS dr    -- 1,1,2,3",
              "FROM emp;"
            ]
          },
          {
            title: "그룹별 상위 2명",
            lang: "sql",
            code: [
              "WITH ranked AS (",
              "  SELECT *, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, id) AS rn",
              "  FROM emp",
              ")",
              "SELECT * FROM ranked WHERE rn <= 2;"
            ],
            note: "WHERE 에 윈도 함수를 직접 쓰면 오류. 반드시 한 겹 감싼다."
          },
          {
            title: "누적합과 7일 이동평균",
            lang: "sql",
            code: [
              "SELECT day, amount,",
              "       SUM(amount) OVER (ORDER BY day) AS running_total,",
              "       AVG(amount) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7",
              "FROM sales;"
            ],
            note: "처음 6행의 ma7 은 가용 행만으로 평균을 낸다(pandas `rolling(7)`은 NaN). 비교 문제에서 주의."
          },
          {
            title: "전일 대비 증감(LAG)",
            lang: "sql",
            code: [
              "SELECT day, amount,",
              "       amount - LAG(amount, 1) OVER (ORDER BY day) AS diff,",
              "       LAG(amount, 1, 0) OVER (ORDER BY day) AS prev_or_zero",
              "FROM sales;"
            ]
          },
          {
            title: "CASE 로 피벗",
            lang: "sql",
            code: [
              "SELECT dept,",
              "       SUM(CASE WHEN quarter = 'Q1' THEN amount END) AS q1,",
              "       SUM(CASE WHEN quarter = 'Q2' THEN amount END) AS q2",
              "FROM sales GROUP BY dept;"
            ]
          },
          {
            title: "재귀 CTE 로 1~5 생성",
            lang: "sql",
            code: [
              "WITH RECURSIVE seq(n) AS (",
              "  SELECT 1",
              "  UNION ALL",
              "  SELECT n + 1 FROM seq WHERE n < 5",
              ")",
              "SELECT n FROM seq;"
            ]
          }
        ],
        pitfalls: [
          "RANK 는 건너뛰고(1,1,3) DENSE_RANK 는 안 건너뛴다(1,1,2). 둘을 바꿔 묻는 출력 문제가 반복된다.",
          "LAG 의 첫 행은 0 이 아니라 **NULL**. default 인수를 주지 않았다면 차이도 NULL.",
          "윈도 함수는 WHERE/HAVING/GROUP BY 에 직접 못 쓴다. 서브쿼리·CTE 로 감싼다.",
          "ORDER BY 가 있는 윈도의 기본 프레임은 RANGE — 동률이 함께 묶여 누적합이 계단처럼 뛴다."
        ]
      },

      "a-1-4": {
        node: "a-1-4",
        title: "SQL ↔ Pandas",
        summary: [
          "SQL 절 하나가 pandas 메서드 하나에 대응한다: WHERE ↔ [[boolean-indexing|불리언 인덱싱]]/`query`, GROUP BY ↔ [[groupby|groupby]]`.agg`, JOIN ↔ [[merge|merge(how=)]], ORDER BY ↔ `sort_values`, DISTINCT ↔ `drop_duplicates`/`unique`, UNION ALL ↔ [[concat|concat]], 윈도 함수 ↔ `groupby().transform`/`rank`/`shift`/`cumsum`.",
          "차이점이 시험 포인트다: `merge(how='outer')`가 FULL OUTER JOIN, `concat`은 중복을 제거하지 않음(UNION ALL), `rank(method='min')`이 RANK, `shift(1)`이 LAG, NaN 정렬 위치는 `na_position='last'` 기본.",
          "`pd.read_sql(sql, con)`으로 SQL 결과를 DataFrame 으로, `df.to_sql(name, con, if_exists=)`로 반대 방향. 두 결과를 나란히 놓고 같은지 확인하는 것이 이 노드 실습의 패턴이다."
        ],
        concepts: [
          "**WHERE ↔ 불리언 인덱싱**: `df[df['age'] > 30]` 또는 `df.query('age > 30')`. 복합 조건은 `&`, `|`, `~`와 괄호(파이썬 `and/or`는 ValueError). `query` 안에서 외부 변수는 `@var`.",
          "**GROUP BY ↔ groupby.agg**: `df.groupby('dept')['salary'].agg(['mean', 'count'])`. `as_index=False`를 주면 SQL 처럼 키가 컬럼으로 남는다. HAVING 은 집계 결과를 다시 불리언 인덱싱(`g[g['count'] >= 5]`)하거나 `groupby().filter(lambda g: len(g) >= 5)`(원본 행 반환).",
          "**JOIN ↔ merge**: `pd.merge(a, b, on='key', how='inner'|'left'|'right'|'outer')`. 키 이름이 다르면 `left_on/right_on`, 인덱스 기준은 `join`. `indicator=True`를 주면 `_merge` 컬럼(`left_only/right_only/both`)으로 안티 조인을 만든다. `validate='1:1'`로 중복 키 폭발을 막는다.",
          "**ORDER BY/LIMIT ↔ sort_values/head**: `df.sort_values(['a', 'b'], ascending=[True, False]).head(10)`. NaN 은 기본 `na_position='last'`. 상위 N 만 필요하면 `nlargest(n, 'col')`.",
          "**DISTINCT ↔ drop_duplicates/unique/nunique**: `df.drop_duplicates(subset=['a', 'b'])`는 `SELECT DISTINCT a, b`. `Series.nunique()`는 `COUNT(DISTINCT col)`(NaN 제외 기본), `unique()`는 NaN 을 포함한다.",
          "**UNION ALL ↔ concat**: `pd.concat([a, b], ignore_index=True)`. UNION(중복 제거)은 뒤에 `.drop_duplicates()`를 붙인다.",
          "**윈도 함수 ↔ transform/rank/shift/cumsum**: `SUM() OVER (PARTITION BY k)` ↔ `groupby('k')['v'].transform('sum')`; `RANK()` ↔ `rank(method='min', ascending=False)`; `DENSE_RANK()` ↔ `rank(method='dense')`; `ROW_NUMBER()` ↔ `rank(method='first')` 또는 `cumcount()+1`; `LAG()` ↔ `groupby('k')['v'].shift(1)`; 누적합 ↔ `groupby('k')['v'].cumsum()`; 이동평균 ↔ `rolling(7).mean()`.",
          "**read_sql / to_sql**: `pd.read_sql(sql, con)`(DB-API 연결 또는 SQLAlchemy 엔진), `df.to_sql('t', con, index=False, if_exists='fail'|'replace'|'append')`. `index=False`를 빼면 인덱스가 컬럼으로 들어간다."
        ],
        terms: ["boolean-indexing", "query-method", "groupby", "aggregation", "merge", "sort-values", "drop-duplicates", "concat", "transform", "rank-method", "shift", "read-sql", "to-sql"],
        patterns: [
          {
            title: "같은 질의를 SQL 과 pandas 로",
            lang: "python",
            code: [
              "import sqlite3, pandas as pd",
              "con = sqlite3.connect(':memory:')",
              "df.to_sql('emp', con, index=False)",
              "sql = pd.read_sql(\"SELECT dept, AVG(salary) AS avg_salary FROM emp WHERE age >= 30 GROUP BY dept\", con)",
              "pdv = (df[df['age'] >= 30].groupby('dept', as_index=False)['salary'].mean()",
              "         .rename(columns={'salary': 'avg_salary'}))",
              "pd.testing.assert_frame_equal(sql, pdv)   # 순서·dtype 이 같으면 통과"
            ]
          },
          {
            title: "JOIN 4종 ↔ merge(how=)",
            lang: "python",
            code: [
              "pd.merge(emp, dept, on='dept_id', how='inner')   # INNER JOIN",
              "pd.merge(emp, dept, on='dept_id', how='left')    # LEFT JOIN",
              "pd.merge(emp, dept, on='dept_id', how='outer')   # FULL OUTER JOIN",
              "m = pd.merge(emp, dept, on='dept_id', how='left', indicator=True)",
              "m[m['_merge'] == 'left_only']                     # LEFT JOIN ... WHERE d.id IS NULL (안티 조인)"
            ]
          },
          {
            title: "윈도 함수 ↔ transform / rank / shift",
            lang: "python",
            code: [
              "df['dept_total'] = df.groupby('dept')['salary'].transform('sum')      # SUM() OVER (PARTITION BY dept)",
              "df['rk'] = df.groupby('dept')['salary'].rank(method='min', ascending=False)  # RANK() OVER (PARTITION BY dept ORDER BY salary DESC)",
              "df['prev'] = df.sort_values('day').groupby('dept')['amount'].shift(1)  # LAG(amount) OVER (PARTITION BY dept ORDER BY day)",
              "df['run'] = df.sort_values('day').groupby('dept')['amount'].cumsum()   # SUM(amount) OVER (PARTITION BY dept ORDER BY day)"
            ]
          },
          {
            title: "HAVING 두 가지 번역",
            lang: "python",
            code: [
              "g = df.groupby('dept')['salary'].agg(['count', 'mean'])",
              "g[g['count'] >= 5]                                   # 집계 행만 (SQL HAVING 과 같은 모양)",
              "df.groupby('dept').filter(lambda x: len(x) >= 5)     # 조건을 만족하는 그룹의 원본 행 전부"
            ]
          },
          {
            title: "DISTINCT / UNION ALL",
            lang: "python",
            code: [
              "df.drop_duplicates(subset=['dept', 'job'])           # SELECT DISTINCT dept, job",
              "df['dept'].nunique()                                 # COUNT(DISTINCT dept)",
              "pd.concat([a, b], ignore_index=True)                 # UNION ALL",
              "pd.concat([a, b]).drop_duplicates()                  # UNION"
            ]
          }
        ],
        pitfalls: [
          "`df[cond1 and cond2]` → ValueError. 벡터 조건은 `&`/`|` 와 괄호.",
          "`concat`은 UNION ALL 이다. UNION 을 원하면 `drop_duplicates()`를 붙인다.",
          "`nunique()`는 NaN 을 빼고 세고 `unique()`는 NaN 을 포함한다 — `COUNT(DISTINCT)`와 같은 것은 `nunique()`.",
          "`rank()` 기본 `method='average'`는 SQL 에 대응물이 없다. RANK 는 `'min'`, DENSE_RANK 는 `'dense'`, ROW_NUMBER 는 `'first'`.",
          "`to_sql`에 `index=False`를 빼면 인덱스 컬럼이 테이블에 들어가 컬럼 수가 하나 늘어난다."
        ]
      }
    },

    questions: [
      /* ───────── a-1-1 SQL 기초 ───────── */
      {
        id: "a-1-1-q01", node: "a-1-1", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "다음 중 SELECT 문의 **논리적 실행 순서(logical processing order)** 로 옳은 것은?",
        choices: [
          "SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY",
          "FROM → SELECT → WHERE → GROUP BY → HAVING → ORDER BY",
          "FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY",
          "FROM → GROUP BY → WHERE → HAVING → SELECT → ORDER BY"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** SQL 은 쓰는 순서(SELECT 가 맨 앞)와 달리 `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT` 순으로 평가된다. 이 [[sql-execution-order|실행 순서]] 때문에 WHERE 에서는 SELECT 의 별칭(alias)과 집계함수(aggregate function)를 쓸 수 없고, ORDER BY 에서는 별칭을 쓸 수 있다.",
          "",
          "- ① SELECT 는 작성 순서상 첫 줄이지만 실행은 HAVING 뒤다.",
          "- ② WHERE 는 SELECT 보다 먼저 실행된다. 그래서 WHERE 에서 별칭을 못 쓴다.",
          "- ④ WHERE(행 필터)는 GROUP BY(그룹화)보다 먼저다. 그룹화 후 조건은 HAVING.",
          "",
          "시험에서는 \"WHERE 절에 집계함수를 쓸 수 없는 이유\" 또는 \"별칭을 쓸 수 있는 절은?\" 형태로 실행 순서를 묻는다."
        ],
        terms: ["sql-execution-order", "where-clause", "having"]
      },
      {
        id: "a-1-1-q02", node: "a-1-1", type: "mcq", kind: "output", difficulty: 1,
        prompt: "`emp` 테이블이 아래와 같을 때, 다음 쿼리의 출력은? (dept 가 NULL 인 행이 2개 있다)",
        code: [
          "-- emp(name, dept)",
          "-- ('kim','A'), ('lee',NULL), ('park','B'), ('choi',NULL), ('jung','A')",
          "SELECT COUNT(*), COUNT(dept), COUNT(DISTINCT dept) FROM emp;"
        ],
        lang: "sql",
        choices: ["5, 5, 2", "5, 3, 2", "3, 3, 2", "5, 3, 3"],
        answer: 1,
        explanation: [
          "**정답: ②** `COUNT(*)`는 [[null|NULL]] 여부와 무관하게 **행 수** 5, `COUNT(dept)`는 dept 가 NULL 이 아닌 행 3, `COUNT(DISTINCT dept)`는 서로 다른 값 {A, B} 의 개수 2다. [[aggregate-function|집계함수]]는 NULL 을 세지 않는다.",
          "",
          "- ① `COUNT(dept)`가 5 가 되려면 NULL 도 세어야 하는데 집계함수는 NULL 을 무시한다.",
          "- ③ `COUNT(*)`는 NULL 행도 포함해 5 다.",
          "- ④ DISTINCT 집계에서도 NULL 은 값으로 세지 않으므로 3 이 아니라 2 다.",
          "",
          "시험에서는 `COUNT(*) - COUNT(col)` = col 의 NULL 개수라는 공식으로 자주 나온다."
        ],
        terms: ["aggregate-function", "null", "distinct"]
      },
      {
        id: "a-1-1-q03", node: "a-1-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 쿼리의 결과 행을 순서대로 나열한 것은?",
        code: [
          "-- sales(region, amount)",
          "-- ('E',100),('E',200),('W',50),('W',70),('W',30),('N',500)",
          "SELECT region, SUM(amount) AS total",
          "FROM sales",
          "GROUP BY region",
          "HAVING COUNT(*) >= 2",
          "ORDER BY total DESC;"
        ],
        lang: "sql",
        choices: [
          "N 500 / E 300 / W 150",
          "W 150 / E 300",
          "E 300 / N 500",
          "E 300 / W 150"
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[group-by|GROUP BY]] 로 region 별 합계를 내면 E=300, W=150, N=500. [[having|HAVING]] `COUNT(*) >= 2`는 행이 2개 이상인 그룹만 남기므로 행이 1개뿐인 N 이 탈락한다. 남은 E 300, W 150 을 total 내림차순으로 정렬하면 E, W 순이다.",
          "",
          "- ① N 은 행이 1개라 HAVING 조건에서 탈락한다.",
          "- ② `ORDER BY total DESC`이므로 300 이 150 보다 먼저 온다.",
          "- ③ N 은 탈락했고 W 가 빠져 있다.",
          "",
          "시험에서는 HAVING 이 **그룹 단위** 조건이고 `COUNT(*)`가 그룹 내 행 수라는 점, 그리고 별칭 `total`을 ORDER BY 에서 쓸 수 있다는 점을 함께 묻는다."
        ],
        terms: ["group-by", "having", "order-by"]
      },
      {
        id: "a-1-1-q04", node: "a-1-1", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "WHERE 절과 HAVING 절에 대한 설명으로 옳은 것은?",
        choices: [
          "HAVING 은 GROUP BY 전에 행을 걸러내고, WHERE 는 그룹을 걸러낸다.",
          "WHERE 절에는 집계함수를 쓸 수 있지만 HAVING 절에는 쓸 수 없다.",
          "둘 다 같은 시점에 실행되므로 어느 쪽에 조건을 써도 결과는 항상 같다.",
          "WHERE 는 그룹화 전 개별 행에, HAVING 은 그룹화 후 집계 결과에 조건을 건다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[where-clause|WHERE]] 는 [[group-by|GROUP BY]] **전**에 행(row) 단위로 평가되고, [[having|HAVING]] 은 그룹화 **후** 집계 결과(group) 에 조건을 건다. 그래서 집계함수(aggregate function)는 HAVING 에서만 쓸 수 있다.",
          "",
          "- ① 순서가 반대다. WHERE 가 먼저(행), HAVING 이 나중(그룹).",
          "- ② 반대다. 집계함수는 HAVING 에서만 가능하다. WHERE 는 아직 그룹이 없다.",
          "- ③ 집계 조건이 아닌 단순 행 조건이라면 결과가 같을 수 있지만, WHERE 가 먼저 행을 줄이므로 성능이 다르고 집계 조건은 WHERE 에 쓸 수 없다.",
          "",
          "시험에서는 \"평균 급여가 5000 이상인 부서\" 를 구하는 쿼리에서 조건을 어느 절에 두어야 하는지로 출제된다."
        ],
        terms: ["where-clause", "having", "aggregate-function"]
      },
      {
        id: "a-1-1-q05", node: "a-1-1", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "부서(dept)가 비어 있는(NULL) 직원 수를 구하려는 쿼리다. 실행하면 오류 없이 **0** 이 나온다. 원인과 수정으로 옳은 것은?",
        code: [
          "SELECT COUNT(*) FROM emp WHERE dept = NULL;"
        ],
        lang: "sql",
        choices: [
          "`= NULL` 비교 결과는 참이 아니라 UNKNOWN 이라 어떤 행도 통과하지 못한다. `dept IS NULL` 로 고친다.",
          "`COUNT(*)`가 NULL 행을 세지 않는다. `COUNT(dept)` 로 고친다.",
          "NULL 은 문자열이므로 `dept = 'NULL'` 로 따옴표를 붙인다.",
          "WHERE 대신 HAVING 을 써야 NULL 비교가 된다."
        ],
        answer: 0,
        explanation: [
          "**정답: ①** [[null|NULL]] 은 '값 없음/모름'이라 `dept = NULL`은 참(TRUE)도 거짓(FALSE)도 아닌 UNKNOWN 으로 평가되고, WHERE 는 TRUE 인 행만 통과시킨다. 그래서 오류 없이 0 행이다. NULL 판별은 `IS NULL / IS NOT NULL` 뿐이다(3치 논리, three-valued logic).",
          "",
          "- ② `COUNT(*)`는 NULL 행도 센다. 문제는 WHERE 에서 이미 모든 행이 탈락한 것이다.",
          "- ③ NULL 은 문자열 'NULL' 이 아니다. 따옴표를 붙이면 그런 문자열을 가진 행만 찾는다.",
          "- ④ HAVING 은 그룹 조건용이며 NULL 비교 방식과 무관하다.",
          "",
          "시험에서는 \"다음 쿼리가 항상 0 행을 돌려주는 이유\" 또는 `<> NULL` 변형으로 나온다. 둘 다 UNKNOWN 이다."
        ],
        terms: ["null", "where-clause"]
      },
      {
        id: "a-1-1-q06", node: "a-1-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 쿼리의 출력은?",
        code: [
          "-- emp(name, bonus): ('kim',100), ('lee',NULL), ('park',200), ('choi',NULL)",
          "SELECT AVG(bonus),",
          "       AVG(COALESCE(bonus, 0)),",
          "       SUM(CASE WHEN bonus IS NULL THEN 1 ELSE 0 END)",
          "FROM emp;"
        ],
        lang: "sql",
        choices: ["75, 75, 2", "150, 75, 2", "150, 150, 0", "150, 75, 0"],
        answer: 1,
        explanation: [
          "**정답: ②** `AVG(bonus)`는 [[null|NULL]] 을 **무시**하므로 (100+200)/2 = 150. [[coalesce|COALESCE]]`(bonus, 0)`로 NULL 을 0 으로 바꾸면 (100+0+200+0)/4 = 75. [[case-expression|CASE]] 로 NULL 행을 1 로 표시해 더하면 2 다.",
          "",
          "- ① 첫 번째 AVG 는 분모가 2(NULL 제외)라 75 가 아니라 150 이다.",
          "- ③ COALESCE 로 0 을 채우면 분모가 4 가 되어 75. NULL 행은 2개다.",
          "- ④ NULL 인 행은 lee, choi 두 명이므로 0 이 아니다.",
          "",
          "시험에서는 `AVG(col)` 과 `AVG(COALESCE(col, 0))` 이 다른 이유(분모 차이)가 단골이다. BigQuery 에서는 `IFNULL` 도 같은 역할을 한다."
        ],
        terms: ["aggregate-function", "coalesce", "case-expression", "null"]
      },
      {
        id: "a-1-1-q07", node: "a-1-1", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "표준 SQL 기준으로 다음 중 **오류 없이 실행되는** 쿼리는? (emp 테이블에 name, salary 컬럼이 있다)",
        choices: [
          "`SELECT name, salary * 12 AS annual FROM emp WHERE annual > 60000;`",
          "`SELECT name, MAX(salary) FROM emp WHERE MAX(salary) > 5000;`",
          "`SELECT name, salary * 12 AS annual FROM emp ORDER BY annual DESC;`",
          "`SELECT DISTINCT name FROM emp ORDER BY salary;`"
        ],
        answer: 2,
        explanation: [
          "**정답: ③** SELECT 의 별칭(alias) `annual`은 [[sql-execution-order|실행 순서]]상 SELECT 뒤에 오는 [[order-by|ORDER BY]] 에서만 참조할 수 있다. ③ 은 그 규칙을 지킨 정상 쿼리다.",
          "",
          "- ① WHERE 는 SELECT 보다 먼저 실행되어 `annual`이 아직 존재하지 않는다(표준 SQL 에서 오류. SQLite·MySQL 은 확장으로 허용하기도 하지만 시험은 표준 기준).",
          "- ② WHERE 절에는 집계함수(aggregate function)를 쓸 수 없다. 집계 조건은 HAVING 으로.",
          "- ④ `SELECT DISTINCT` 를 쓰면 ORDER BY 컬럼이 SELECT 목록에 있어야 한다(표준 SQL). `salary`가 없어 오류.",
          "",
          "시험에서는 \"오류가 나는 쿼리를 고르시오\" 형태로 별칭 참조 위치와 DISTINCT-ORDER BY 제약을 묻는다."
        ],
        terms: ["sql-execution-order", "order-by", "distinct"]
      },
      {
        id: "a-1-1-q08", node: "a-1-1", type: "ox", kind: "concept", difficulty: 1,
        prompt: "`SUM(col)` 은 col 의 NULL 을 0 으로 간주해 더하므로, 모든 값이 NULL 이면 결과는 0 이다.",
        answer: false,
        explanation: [
          "**정답: X** [[aggregate-function|집계함수]]는 [[null|NULL]] 을 0 으로 바꾸는 것이 아니라 **무시(skip)** 한다. 그래서 값이 전부 NULL 이면 더할 것이 없어 결과도 NULL 이다(`COUNT`만 예외로 0). 0 을 원하면 `COALESCE(SUM(col), 0)` 또는 `SUM(COALESCE(col, 0))` 을 쓴다.",
          "",
          "시험에서는 \"전부 NULL 인 컬럼의 SUM/AVG/MAX 결과는?\" 으로 나오며 답은 NULL, `COUNT(col)` 만 0 이다."
        ],
        terms: ["aggregate-function", "null", "coalesce"]
      },
      {
        id: "a-1-1-q09", node: "a-1-1", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`SELECT DISTINCT dept, job FROM emp` 는 dept 값이 같은 행을 모두 하나로 합쳐, 결과 행 수가 서로 다른 dept 의 개수와 같다.",
        answer: false,
        explanation: [
          "**정답: X** [[distinct|DISTINCT]] 는 SELECT 목록에 적은 **모든 컬럼의 조합** 기준으로 중복을 제거한다. (dept, job) 쌍이 다르면 dept 가 같아도 별개 행이다. 결과 행 수 = 서로 다른 (dept, job) 조합 수이며, 서로 다른 dept 수(`COUNT(DISTINCT dept)`)보다 크거나 같다.",
          "",
          "시험에서는 \"DISTINCT 가 첫 컬럼에만 적용된다\" 는 오해를 유도하는 보기로 나온다. DISTINCT 는 컬럼 하나가 아니라 행 전체에 걸린다."
        ],
        terms: ["distinct"]
      },
      {
        id: "a-1-1-q10", node: "a-1-1", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 키워드를 쓰시오. 직원 테이블에서 서로 다른 부서 이름만 중복 없이 뽑는다: `SELECT ____ dept FROM emp;`",
        answer: "DISTINCT",
        explanation: [
          "**정답: DISTINCT** [[distinct|DISTINCT]] 는 결과 행의 중복을 제거하는 키워드로 SELECT 바로 뒤에 쓴다. 같은 일을 `GROUP BY dept` 로도 할 수 있지만 집계 없이 중복 제거만 할 때는 DISTINCT 가 관용적이다.",
          "",
          "시험에서는 pandas 의 `drop_duplicates()`/`unique()` 와 짝지어 묻는다(1-4 참고)."
        ],
        terms: ["distinct"]
      },
      {
        id: "a-1-1-q11", node: "a-1-1", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 쿼리의 결과를 쓰시오. (값이 없으면 `NULL` 이라고 쓴다)",
        code: ["SELECT COALESCE(NULL, 10) + NULLIF(5, 5);"],
        lang: "sql",
        answer: "NULL",
        accept: ["None", "null"],
        explanation: [
          "**정답: NULL** [[coalesce|COALESCE]]`(NULL, 10)` 은 첫 번째 NULL 이 아닌 값 10 을 돌려준다. `NULLIF(5, 5)` 는 두 인수가 같으면 [[null|NULL]] 을 돌려준다. `10 + NULL` 은 NULL 과의 산술이라 결과는 NULL 이다. 15 가 아니다.",
          "",
          "시험에서는 COALESCE/NULLIF 의 뜻과 \"NULL 과 연산하면 NULL\" 규칙을 한 식에 섞어 출력을 묻는다. BigQuery 의 `SAFE_DIVIDE(a, 0)` 가 NULL 을 돌려주는 것도 같은 맥락이다."
        ],
        terms: ["coalesce", "null"]
      },
      {
        id: "a-1-1-q12", node: "a-1-1", type: "short", kind: "fill", difficulty: 3,
        prompt: "빈칸에 들어갈 표준 SQL 함수 이름을 쓰시오. bonus 가 NULL 인 직원을 0 으로 쳐서 **전체 인원 기준** 평균 보너스를 구한다: `SELECT AVG(____(bonus, 0)) FROM emp;`",
        answer: "COALESCE",
        accept: ["IFNULL", "NVL"],
        explanation: [
          "**정답: COALESCE** `AVG(bonus)` 는 [[null|NULL]] 행을 분모에서 빼므로 '전체 인원 기준' 평균이 되지 않는다. [[coalesce|COALESCE]]`(bonus, 0)` 로 NULL 을 0 으로 치환하면 모든 행이 분모에 들어간다. `IFNULL`(MySQL/SQLite/BigQuery), `NVL`(Oracle) 은 같은 역할의 방언이다.",
          "",
          "시험에서는 \"NULL 을 0 으로 치환해 평균을 구하라\" 는 지문에서 함수 이름을 묻거나, 두 평균이 왜 다른지를 묻는다."
        ],
        terms: ["coalesce", "null", "aggregate-function"]
      },
      /* ───────── a-1-2 SQL 중급 ───────── */
      {
        id: "a-1-2-q01", node: "a-1-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "`emp LEFT JOIN dept ON emp.dept_id = dept.id` 의 결과에 대한 설명으로 옳은 것은?",
        choices: [
          "dept 에 매칭되는 직원 행만 남는다.",
          "emp 의 모든 행이 남고, 매칭되는 부서가 없으면 dept 쪽 컬럼은 NULL 이 된다.",
          "dept 의 모든 행이 남고, 직원이 없는 부서는 emp 쪽 컬럼이 NULL 이 된다.",
          "두 테이블의 모든 행이 남고, 어느 쪽이든 매칭이 없으면 NULL 로 채워진다."
        ],
        answer: 1,
        explanation: [
          "**정답: ②** [[left-join|LEFT (OUTER) JOIN]] 은 **왼쪽 테이블(emp)** 의 모든 행을 유지한다. ON 조건에 맞는 부서가 없는 직원도 결과에 남으며, 그 행의 dept 쪽 컬럼은 [[null|NULL]] 로 채워진다.",
          "",
          "- ① 매칭되는 행만 남는 것은 [[inner-join|INNER JOIN]] 이다.",
          "- ③ 오른쪽(dept) 전체를 유지하는 것은 RIGHT JOIN 이다.",
          "- ④ 양쪽을 모두 유지하는 것은 FULL OUTER JOIN 이다.",
          "",
          "시험에서는 조인(join) 4종의 결과 행 수를 벤 다이어그램 또는 작은 표로 예측하게 한다. 'LEFT' 가 가리키는 쪽이 전부 살아남는다고 기억하면 된다."
        ],
        terms: ["left-join", "inner-join", "full-outer-join"]
      },
      {
        id: "a-1-2-q02", node: "a-1-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 쿼리의 출력은?",
        code: [
          "-- emp(id, name, dept_id): (1,'kim',10),(2,'lee',20),(3,'park',NULL),(4,'choi',30),(5,'jung',10)",
          "-- dept(id, name):          (10,'HR'),(20,'IT'),(40,'R&D')",
          "SELECT COUNT(*) FROM emp e INNER JOIN dept d ON e.dept_id = d.id;"
        ],
        lang: "sql",
        choices: ["3", "4", "5", "2"],
        answer: 0,
        explanation: [
          "**정답: ①** [[inner-join|INNER JOIN]] 은 ON 조건이 참인 쌍만 남긴다. dept_id 10(kim, jung)과 20(lee)은 dept 에 있지만, 30(choi)은 dept 에 없고 park 의 dept_id 는 [[null|NULL]] 이라 어떤 행과도 매칭되지 않는다. 따라서 3 행이다.",
          "",
          "- ② choi(30) 는 dept 에 30 이 없어 탈락한다.",
          "- ③ emp 전체 5 행이 남는 것은 LEFT JOIN 일 때다.",
          "- ④ dept_id 10 인 직원이 두 명(kim, jung)이라 HR 이 두 번 매칭된다.",
          "",
          "시험에서는 작은 두 표를 주고 INNER/LEFT 각각의 행 수를 묻는다. NULL 키는 `=` 비교가 UNKNOWN 이라 절대 매칭되지 않는다는 점이 함정이다."
        ],
        terms: ["inner-join", "null"]
      },
      {
        id: "a-1-2-q03", node: "a-1-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "앞 문제와 같은 emp, dept 테이블에서 다음 쿼리의 출력은?",
        code: [
          "SELECT e.name",
          "FROM emp e LEFT JOIN dept d ON e.dept_id = d.id",
          "WHERE d.id IS NULL",
          "ORDER BY e.name;"
        ],
        lang: "sql",
        choices: ["park", "choi, park", "kim, lee, jung", "(빈 결과)"],
        answer: 1,
        explanation: [
          "**정답: ②** [[left-join|LEFT JOIN]] 으로 emp 5 행을 모두 유지한 뒤 `WHERE d.id IS NULL` 로 **매칭되지 않은 행만** 남기는 [[anti-join|안티 조인]] 패턴이다. 매칭이 없는 직원은 dept_id 가 30 인 choi 와 NULL 인 park. 이름순 정렬이라 choi, park.",
          "",
          "- ① park 뿐 아니라 dept 에 없는 30 번 부서의 choi 도 매칭되지 않는다.",
          "- ③ kim, lee, jung 은 매칭된 직원들로 `d.id IS NULL` 조건에서 걸러진다.",
          "- ④ LEFT JOIN 이므로 매칭 없는 행이 NULL 로 남아 결과가 비지 않는다.",
          "",
          "시험에서는 \"부서 정보가 없는 직원\" 을 찾는 쿼리로 나오며, `NOT EXISTS` 와 같은 결과라는 점을 함께 묻는다."
        ],
        terms: ["left-join", "anti-join", "null"]
      },
      {
        id: "a-1-2-q04", node: "a-1-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "집합 연산자(set operator)에 대한 설명으로 옳은 것은?",
        choices: [
          "UNION 은 중복을 유지하고 UNION ALL 은 중복을 제거한다.",
          "INTERSECT 는 첫 쿼리에만 있는 행을 돌려준다.",
          "UNION 은 두 결과를 합치면서 중복 행을 제거하므로 UNION ALL 보다 비용이 크다.",
          "집합 연산은 두 쿼리의 컬럼 수가 달라도 자동으로 맞춰 준다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** [[union|UNION]] 은 두 결과를 세로로 이어붙인 뒤 **중복 행을 제거**한다(정렬·해시 비용). [[union-all|UNION ALL]] 은 그대로 이어붙여 중복이 남고 더 빠르다. BigQuery 는 `UNION DISTINCT`/`UNION ALL` 로 명시해야 한다.",
          "",
          "- ① 반대다. UNION 이 제거, UNION ALL 이 유지.",
          "- ② 첫 쿼리에만 있는 행은 EXCEPT(MINUS). INTERSECT 는 양쪽에 공통인 행이다.",
          "- ④ 집합 연산은 컬럼 수와 타입(순서대로)이 맞아야 하며 자동으로 맞춰 주지 않는다.",
          "",
          "시험에서는 \"두 테이블을 합친 행 수\" 를 물으며 UNION 인지 UNION ALL 인지로 답이 달라진다."
        ],
        terms: ["union", "union-all"]
      },
      {
        id: "a-1-2-q05", node: "a-1-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "'IT 부서가 아닌 직원' 을 부서가 없는 직원까지 포함해 모두 보려고 했다. 그런데 결과에 부서가 없는 직원(park, choi)이 빠진다. 올바른 수정은?",
        code: [
          "SELECT e.name, d.name AS dept_name",
          "FROM emp e LEFT JOIN dept d ON e.dept_id = d.id",
          "WHERE d.name <> 'IT';"
        ],
        lang: "sql",
        choices: [
          "LEFT JOIN 을 RIGHT JOIN 으로 바꾼다.",
          "`WHERE d.name <> 'IT'` 를 `WHERE d.name != 'IT'` 로 바꾼다.",
          "`<>` 대신 `NOT IN ('IT')` 를 쓴다.",
          "조건을 ON 절로 옮기거나(`ON ... AND d.name <> 'IT'`) `OR d.name IS NULL` 을 덧붙인다."
        ],
        answer: 3,
        explanation: [
          "**정답: ④** [[left-join|LEFT JOIN]] 으로 살아남은 매칭 없는 행은 dept 쪽 컬럼이 [[null|NULL]] 이다. `NULL <> 'IT'` 는 UNKNOWN 이라 WHERE 에서 탈락하고, 결과적으로 INNER JOIN 과 같아진다. 오른쪽 테이블 조건은 ON 절에 두거나 `OR d.name IS NULL` 로 NULL 행을 명시적으로 살려야 한다.",
          "",
          "- ① RIGHT JOIN 은 dept 를 전부 유지하므로 직원이 빠지는 문제가 더 커진다.",
          "- ② `!=` 와 `<>` 는 같은 연산자다. NULL 비교가 UNKNOWN 인 것은 변하지 않는다.",
          "- ③ `NOT IN` 도 NULL 과 비교하면 UNKNOWN 이다.",
          "",
          "시험에서는 \"LEFT JOIN 인데 왜 INNER JOIN 처럼 동작하는가\" 로 출제되는 대표 함정이다. 답은 항상 'WHERE 의 오른쪽 컬럼 조건'."
        ],
        terms: ["left-join", "null", "inner-join"]
      },
      {
        id: "a-1-2-q06", node: "a-1-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "`t1.v` 가 1,2,2,3 이고 `t2.v` 가 2,3,4 일 때, 아래 세 쿼리의 결과 행 수를 (a), (b), (c) 순서로 나열한 것은?",
        code: [
          "SELECT v FROM t1 UNION     SELECT v FROM t2;   -- (a)",
          "SELECT v FROM t1 UNION ALL SELECT v FROM t2;   -- (b)",
          "SELECT v FROM t1 EXCEPT    SELECT v FROM t2;   -- (c)"
        ],
        lang: "sql",
        choices: ["4, 7, 1", "5, 7, 1", "4, 7, 2", "4, 4, 1"],
        answer: 0,
        explanation: [
          "**정답: ①** (a) [[union|UNION]] 은 중복 제거 → {1,2,3,4} = 4 행. (b) [[union-all|UNION ALL]] 은 4 + 3 = 7 행 그대로. (c) EXCEPT 는 t1 에 있고 t2 에 없는 값 {1} = 1 행(중복도 제거).",
          "",
          "- ② UNION 은 t1 내부의 중복 2 도 제거하므로 5 가 아니라 4 다.",
          "- ③ EXCEPT 결과는 1 뿐이다. 2 는 t2 에도 있어 빠진다.",
          "- ④ UNION ALL 은 중복을 제거하지 않으므로 7 이다.",
          "",
          "시험에서는 INTERSECT(여기서는 {2,3} = 2 행)까지 넷을 한 번에 묻는다. 집합 연산 결과는 UNION ALL 을 빼고 모두 중복이 제거된다."
        ],
        terms: ["union", "union-all", "intersect-except"]
      },
      {
        id: "a-1-2-q07", node: "a-1-2", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "'직원이 한 명도 없는 부서' 를 찾는 두 쿼리가 있다. emp.dept_id 에 NULL 이 하나 이상 있을 때의 결과로 옳은 것은? (표준 SQL 기준)",
        code: [
          "-- (A)",
          "SELECT * FROM dept WHERE id NOT IN (SELECT dept_id FROM emp);",
          "-- (B)",
          "SELECT * FROM dept d WHERE NOT EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.id);"
        ],
        lang: "sql",
        choices: [
          "(A)와 (B)는 항상 같은 결과를 낸다.",
          "(A)는 오류가 나고 (B)만 실행된다.",
          "(A)는 한 행도 돌려주지 않고, (B)는 직원 없는 부서를 올바르게 돌려준다.",
          "(B)는 한 행도 돌려주지 않고, (A)만 올바르게 돌려준다."
        ],
        answer: 2,
        explanation: [
          "**정답: ③** `id NOT IN (10, 20, NULL)` 은 `id <> 10 AND id <> 20 AND id <> NULL` 과 같고, 마지막 항이 UNKNOWN 이라 전체가 TRUE 가 될 수 없다. 따라서 (A)는 **빈 결과**다. [[exists|NOT EXISTS]] 는 상관 [[subquery|서브쿼리]]가 행을 돌려주는지만 보므로 [[null|NULL]] 에 영향받지 않는다.",
          "",
          "- ① 서브쿼리에 NULL 이 없을 때만 같다.",
          "- ② (A)는 문법적으로 정상이며 오류 없이 0 행을 돌려준다 — 그래서 더 위험하다.",
          "- ④ 반대다. NOT EXISTS 가 안전한 쪽이다.",
          "",
          "시험에서는 \"NOT IN 서브쿼리가 비어 보이는 이유\" 로 출제된다. 대응: `NOT EXISTS`, 또는 서브쿼리에 `WHERE dept_id IS NOT NULL` 추가."
        ],
        terms: ["exists", "in-operator", "subquery", "null"]
      },
      {
        id: "a-1-2-q08", node: "a-1-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "조건 없이 `FROM a CROSS JOIN b` 로 조인하면 결과 행 수는 a 의 행 수와 b 의 행 수의 곱이다.",
        answer: true,
        explanation: [
          "**정답: O** [[cross-join|CROSS JOIN]] 은 ON 조건 없이 두 테이블의 **모든 조합**(카티션 곱, Cartesian product)을 만든다. a 가 3 행, b 가 4 행이면 12 행. `FROM a, b` 에 WHERE 를 빼먹은 경우도 같은 결과가 나와 행이 폭발하는 원인이 된다.",
          "",
          "시험에서는 \"조인 조건을 빠뜨리면 몇 행이 나오는가\" 또는 날짜×상품 조합 표를 만드는 용도로 나온다."
        ],
        terms: ["cross-join"]
      },
      {
        id: "a-1-2-q09", node: "a-1-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`a RIGHT JOIN b ON cond` 는 테이블 순서를 바꾼 `b LEFT JOIN a ON cond` 와 같은 행 집합을 돌려준다.",
        answer: true,
        explanation: [
          "**정답: O** [[right-join|RIGHT JOIN]] 은 오른쪽 테이블(b)의 모든 행을 유지하는 외부 조인(outer join)이고, [[left-join|LEFT JOIN]] 은 왼쪽을 유지한다. 유지되는 쪽이 같으면 행 집합은 같고 컬럼 순서만 다를 수 있다. 그래서 실무·pandas(`how='right'`)에서는 대부분 LEFT 로 통일한다.",
          "",
          "시험에서는 \"RIGHT JOIN 을 LEFT JOIN 으로 바꿔 쓰시오\" 또는 SQLite 구버전·일부 엔진이 RIGHT JOIN 을 지원하지 않는 이유로 나온다."
        ],
        terms: ["right-join", "left-join"]
      },
      {
        id: "a-1-2-q10", node: "a-1-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 들어갈 키워드를 쓰시오. 부서가 없는 직원도 결과에 남기고 싶다: `SELECT e.name, d.name FROM emp e ____ JOIN dept d ON e.dept_id = d.id;`",
        answer: "LEFT",
        accept: ["LEFT OUTER", "LEFTOUTER"],
        explanation: [
          "**정답: LEFT** 기준 테이블 emp 가 FROM 바로 뒤(왼쪽)에 있으므로 emp 의 모든 행을 유지하려면 [[left-join|LEFT (OUTER) JOIN]] 이다. OUTER 는 생략 가능하다. INNER 라면 부서 없는 직원이 빠진다.",
          "",
          "시험에서는 \"모든 직원을 유지\" 라는 표현이 LEFT, \"모든 부서를 유지\" 가 RIGHT 의 힌트다."
        ],
        terms: ["left-join"]
      },
      {
        id: "a-1-2-q11", node: "a-1-2", type: "short", kind: "output", difficulty: 2,
        prompt: "다음 쿼리의 결과 값을 쓰시오.",
        code: [
          "-- emp(name, salary): ('kim',300), ('lee',500), ('park',400), ('choi',200)",
          "SELECT COUNT(*) FROM emp",
          "WHERE salary > (SELECT AVG(salary) FROM emp);"
        ],
        lang: "sql",
        answer: "2",
        explanation: [
          "**정답: 2** 괄호 안은 값 하나를 돌려주는 스칼라 [[subquery|서브쿼리]](scalar subquery)로, 전체 평균 (300+500+400+200)/4 = 350 이다. 350 보다 큰 급여는 lee(500), park(400) 두 명이다. WHERE 에 집계함수를 직접 쓸 수 없으므로 이렇게 서브쿼리로 감싼다.",
          "",
          "시험에서는 \"평균보다 높은 직원 수\" 가 WHERE + 스칼라 서브쿼리의 대표 예제이며, 부서별 평균과 비교하면 상관 서브쿼리(correlated subquery)가 된다."
        ],
        terms: ["subquery", "aggregate-function"]
      },
      {
        id: "a-1-2-q12", node: "a-1-2", type: "short", kind: "fill", difficulty: 3,
        prompt: "빈칸에 들어갈 키워드를 쓰시오. 직원이 한 명이라도 있는 부서만 고른다(NULL 에 안전한 방식): `SELECT * FROM dept d WHERE ____ (SELECT 1 FROM emp e WHERE e.dept_id = d.id);`",
        answer: "EXISTS",
        explanation: [
          "**정답: EXISTS** [[exists|EXISTS]] 는 괄호 안 [[correlated-subquery|상관 서브쿼리]]가 **한 행이라도** 돌려주면 참이다. 바깥 행 `d.id` 를 참조하므로 부서마다 재평가된다. `SELECT 1` 은 관용 표현으로 컬럼 내용은 의미가 없다. `IN (SELECT dept_id FROM emp)` 도 같은 결과지만 NOT 을 붙일 때 NULL 문제가 생기므로 EXISTS 가 안전하다.",
          "",
          "시험에서는 EXISTS 와 IN 의 차이, 그리고 \"SELECT 1\" 의 의미(행 존재 여부만 확인)를 묻는다."
        ],
        terms: ["exists", "correlated-subquery"]
      },
