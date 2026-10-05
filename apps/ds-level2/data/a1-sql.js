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
