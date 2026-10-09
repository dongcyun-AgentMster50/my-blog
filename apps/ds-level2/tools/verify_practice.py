#!/usr/bin/env python3
"""ds-level2 — 실습 정답 재실행 검증.

    python3 tools/verify_practice.py out.json        (또는 /dev/stdin, -)

tools/extract_practice.js 가 덤프한 JSON 을 읽어, 과제마다 **새 네임스페이스**에서
setup 을 exec 한 뒤 solution 을 실행하고 마지막 표현식의 값을 얻는다.
  - solution 의 마지막 문장이 표현식(ast.Expr)이면 그 값을 eval 로 얻는다.
  - 아니면 네임스페이스의 `answer` 또는 `result` 변수를 찾는다.
그 값을 spec 6-3 규칙으로 answer 와 비교한다.
  number : 양쪽을 decimals 자리로 반올림, |a-b| < 10^-(decimals+3)
  int    : 정수로 정확히 일치 (42.0 도 허용)
  string : 정규화(공백·따옴표·백틱 제거, 소문자, 끝 '()' 제거, 전각→반각) 후 value / accept 와 비교
numpy/pandas 스칼라는 float()/int()/str() 로 변환한다. 경고(FutureWarning 등)는 억제한다.
과제별 PASS/FAIL/ERROR 한 줄 + 요약. 실패나 예외가 있으면 exit 1.
"""
import ast
import io
import json
import math
import sys
import warnings
import contextlib

warnings.simplefilter("ignore")


def normalize(s):
    s = str(s).strip().lower()
    s = "".join(s.split())
    s = s.replace("'", "").replace('"', "").replace("`", "")
    s = s.replace("（", "(").replace("）", ")").replace("，", ",").replace("、", ",")
    while s.endswith("()"):
        s = s[:-2]
    return s


def to_scalar(v):
    """numpy/pandas 스칼라·길이 1 컨테이너를 파이썬 기본형으로. 그 외는 그대로."""
    # 길이 1 Series/ndarray/list 는 그 원소로 (예: df['x'].mode() 의 결과)
    try:
        import numpy as np  # noqa
        if isinstance(v, np.generic):
            return v.item()
        if isinstance(v, np.ndarray) and v.size == 1:
            return to_scalar(v.reshape(-1)[0])
    except Exception:
        pass
    try:
        import pandas as pd  # noqa
        if isinstance(v, (pd.Series, pd.Index)) and len(v) == 1:
            return to_scalar(v.iloc[0] if hasattr(v, "iloc") else v[0])
        if isinstance(v, pd.DataFrame) and v.shape == (1, 1):
            return to_scalar(v.iloc[0, 0])
        if hasattr(pd, "Timestamp") and isinstance(v, pd.Timestamp):
            return str(v)
    except Exception:
        pass
    if isinstance(v, (list, tuple)) and len(v) == 1:
        return to_scalar(v[0])
    if hasattr(v, "item") and callable(v.item):
        try:
            return v.item()
        except Exception:
            pass
    return v


def run_one(p):
    ns = {"__name__": "__ds2__"}
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        exec(compile(p["setup"], f"{p['id']}/setup", "exec"), ns)
        sol = p["solution"]
        tree = ast.parse(sol, f"{p['id']}/solution")
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            head = ast.Module(body=tree.body[:-1], type_ignores=[])
            exec(compile(head, f"{p['id']}/solution", "exec"), ns)
            last = ast.Expression(body=tree.body[-1].value)
            value = eval(compile(last, f"{p['id']}/solution", "eval"), ns)
        else:
            exec(compile(tree, f"{p['id']}/solution", "exec"), ns)
            if "answer" in ns:
                value = ns["answer"]
            elif "result" in ns:
                value = ns["result"]
            else:
                raise ValueError("solution 의 마지막 문장이 표현식이 아니고 answer/result 변수도 없음")
    return to_scalar(value)


def compare(answer, value):
    """(ok, expected_repr, actual_repr)"""
    t = answer.get("type")
    if t == "number":
        d = int(answer.get("decimals", 0))
        exp = float(answer["value"])
        try:
            act = float(value)
        except Exception:
            return False, f"{exp}", f"{value!r} (숫자로 변환 불가)"
        if math.isnan(act):
            return False, f"{round(exp, d)}", "nan"
        ra, rb = round(exp, d), round(act, d)
        ok = abs(ra - rb) < 10 ** (-(d + 3))
        return ok, f"{ra:.{d}f}", f"{act!r} → {rb:.{d}f}"
    if t == "int":
        exp = int(answer["value"])
        try:
            act = float(value)
        except Exception:
            return False, str(exp), f"{value!r} (숫자로 변환 불가)"
        ok = float(act).is_integer() and int(act) == exp
        return ok, str(exp), f"{value!r}"
    if t == "string":
        exp = str(answer["value"])
        accept = [exp] + [str(a) for a in (answer.get("accept") or [])]
        act = str(value)
        ok = normalize(act) in {normalize(a) for a in accept}
        return ok, exp, act
    return False, repr(answer), f"{value!r} (알 수 없는 answer.type {t!r})"


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    src = argv[1]
    if src in ("-", "/dev/stdin"):
        data = json.load(sys.stdin)
    else:
        with open(src, encoding="utf-8") as f:
            data = json.load(f)

    n_pass = n_fail = n_err = 0
    for p in data:
        pid = p.get("id", "?")
        try:
            value = run_one(p)
        except Exception as e:  # noqa: BLE001 — 과제 하나의 예외가 전체를 멈추면 안 된다
            n_err += 1
            print(f"ERROR {pid}  {type(e).__name__}: {e}")
            continue
        try:
            ok, exp, act = compare(p.get("answer") or {}, value)
        except Exception as e:  # noqa: BLE001
            n_err += 1
            print(f"ERROR {pid}  비교 실패 {type(e).__name__}: {e}")
            continue
        if ok:
            n_pass += 1
            print(f"PASS  {pid}  = {exp}")
        else:
            n_fail += 1
            print(f"FAIL  {pid}  expected={exp}  actual={act}")

    total = n_pass + n_fail + n_err
    print(f"\n요약: {total}개 중 PASS {n_pass}  FAIL {n_fail}  ERROR {n_err}")
    return 1 if (n_fail or n_err) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
