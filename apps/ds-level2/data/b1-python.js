/* ds-level2 — 파트 B 1장 "Python native 문법 익히기" (b-1) + "1-2 이해도 점검 문제" (b-1-2)
   운영자의 비법: pandas 이전에 발목 잡는 Python 핵심을 시험 함정 중심으로 꿴다.
   규칙: 백틱 문자열 금지(큰따옴표·줄 배열만), DS2.register() 1회, 태그·링크한 용어는 전부 이 파일에서 정의.
   kind: output 문제의 출력은 전부 Python 3 실행으로 확인했다. */
(function () {
  DS2.register({
    chapter: "b-1",

    /* ──────────────────────────── 요약 카드 ──────────────────────────── */
    cards: {
      "b-1": {
        node: "b-1",
        title: "Python native 문법 익히기",
        summary: [
          "데이터 분석 시험의 Python 문제는 문법 지식보다 **함정**을 묻는다. 가변 객체(mutable)와 불변 객체(immutable)의 차이, `is`와 `==`의 차이, [[shallow-copy|얕은 복사]]와 깊은 복사, 반환값이 `None`인 메서드가 단골이다.",
          "`round()`의 은행가 반올림, 음수 `//`·`%`, `0.1 + 0.2 != 0.3` 같은 **수치 함정**과 `sorted` vs `list.sort`, `map`/`filter`가 돌려주는 [[iterator|이터레이터]]의 1회성도 반복 출제된다.",
          "출력 예측 문제는 머리로 돌리지 말고 규칙(슬라이싱 범위 초과는 빈 결과, 제너레이터는 한 번 소진되면 끝)을 기계적으로 적용하는 훈련이 핵심이다.",
          "`collections`(Counter·defaultdict·deque), `itertools`(permutations·combinations·product·groupby), `datetime` 포맷 코드는 **개수와 이름**을 외워 두면 바로 점수가 된다."
        ],
        concepts: [
          "**가변(mutable) vs 불변(immutable)**: `list`·`dict`·`set`은 가변, `int`·`str`·`tuple`·`frozenset`은 불변. 불변 객체만 [[hashable|해시 가능]]이어서 dict 키와 set 원소가 될 수 있다. `tuple` 안에 list가 들어 있으면 해시 불가.",
          "**가변 기본 인자 함정**: `def f(x, lst=[])`의 `[]`는 함수 정의 시 **한 번만** 만들어져 호출 간에 공유된다. 누적되는 결과가 시험 단골. 해법은 `lst=None` 후 함수 안에서 `lst = lst or []`.",
          "**`is` vs `==`**: `==`는 값 비교, `is`는 [[identity|동일 객체]](같은 id) 비교. 같은 값의 리스트 둘은 `==`가 True, `is`는 False. `None` 비교는 항상 `is None`.",
          "**얕은 복사(shallow copy)**: `a[:]`, `list(a)`, `a.copy()`, `dict(d)`는 바깥 컨테이너만 새로 만들고 안의 객체는 공유한다. 중첩 구조까지 독립시키려면 `copy.deepcopy`.",
          "**반환값 `None` 메서드**: `list.sort()`, `list.append()`, `dict.update()`, `random.shuffle()`은 제자리(in-place)에서 바꾸고 `None`을 돌려준다. `x = lst.sort()` 뒤에 `x[0]`을 하면 `TypeError`. 새 객체가 필요하면 `sorted()`.",
          "**수치 함정**: `round(2.5) == 2`, `round(3.5) == 4`(짝수 반올림, banker's rounding). `-7 // 2 == -4`(바닥 나눗셈, 음의 무한대 방향), `-7 % 2 == 1`(나머지 부호는 제수를 따름). `/`는 항상 `float`. `0.1 + 0.2 == 0.3`은 False([[floating-point|부동소수점]] 오차). `int`는 크기 제한 없음.",
          "**슬라이싱(slicing)**: `a[start:stop:step]`에서 `stop`은 미포함, 범위를 넘으면 예외 없이 잘라낸다(`'abc'[1:100] == 'bc'`, `a[10:] == []`). 음수 인덱스는 뒤에서부터, `[::-1]`은 역순. 단일 인덱스 초과만 `IndexError`.",
          "**예외 흐름**: `try` → 예외 없으면 `else` → 항상 `finally`. `return`이 있어도 `finally`는 실행된다. 어떤 코드가 어떤 [[exception|예외]]를 내는지 외운다: `int('3.5')`→ValueError, `[1][5]`→IndexError, `d['없는키']`→KeyError, `'a'+1`→TypeError, `1/0`→ZeroDivisionError, 반복 중 dict 크기 변경→RuntimeError."
        ],
        terms: ["mutable", "immutable", "hashable", "shallow-copy", "identity", "slicing", "generator", "iterator", "exception", "counter", "itertools", "floating-point"],
        patterns: [
          {
            title: "다중 키 정렬 — 점수 내림차순, 같으면 이름 오름차순",
            lang: "python",
            code: [
              "rows = [('kim', 90), ('lee', 85), ('ahn', 90)]",
              "sorted(rows, key=lambda r: (-r[1], r[0]))",
              "# [('ahn', 90), ('kim', 90), ('lee', 85)]"
            ],
            note: "숫자 키는 부호를 뒤집어 방향을 섞는다. `reverse=True`는 모든 키의 방향을 한꺼번에 뒤집으므로 다중 키 혼합 방향에는 못 쓴다. Python 정렬은 [[stable-sort|안정 정렬]]이라 같은 키는 원래 순서를 유지한다."
          },
          {
            title: "빈도 세기와 그룹별 누적 — Counter / defaultdict",
            lang: "python",
            code: [
              "from collections import Counter, defaultdict",
              "Counter('mississippi').most_common(2)   # [('i', 4), ('s', 4)]",
              "",
              "total = defaultdict(int)",
              "for cat, amt in [('a', 10), ('b', 5), ('a', 7)]:",
              "    total[cat] += amt                      # 없는 키도 0에서 시작",
              "dict(total)                                 # {'a': 17, 'b': 5}"
            ],
            note: "`most_common`은 빈도 내림차순, 동률이면 먼저 등장한 순서. `defaultdict(list)`이면 `.append` 누적."
          },
          {
            title: "컴프리헨션과 제너레이터 표현식",
            lang: "python",
            code: [
              "squares = [x * x for x in range(10) if x % 2 == 0]   # 리스트",
              "lookup = {k: len(k) for k in ['ab', 'cde']}          # dict",
              "uniq = {w.lower() for w in ['A', 'a', 'B']}          # set → {'a', 'b'}",
              "g = (x * x for x in range(3))                        # 제너레이터 — 지연 평가",
              "sum(g), sum(g)                                       # (5, 0) 두 번째는 소진됨"
            ],
            note: "제너레이터는 한 번 순회하면 끝. `len()`도 못 쓴다. 중첩 `for`는 바깥 루프를 먼저 쓴다: `[(i, j) for i in A for j in B]`."
          },
          {
            title: "안전한 복사와 기본 인자",
            lang: "python",
            code: [
              "import copy",
              "a = [[1, 2], [3]]",
              "b = a[:]                 # 얕은 복사 — b[0] is a[0]",
              "c = copy.deepcopy(a)     # 깊은 복사",
              "a[0].append(9)",
              "b[0], c[0]               # ([1, 2, 9], [1, 2])",
              "",
              "def append_to(x, lst=None):",
              "    lst = lst if lst is not None else []",
              "    lst.append(x)",
              "    return lst"
            ]
          },
          {
            title: "문자열 서식 지정자(f-string)",
            lang: "python",
            code: [
              "x, name = 1234567.891, 'hi'",
              "f'{x:,.2f}'    # '1,234,567.89'  천 단위 쉼표 + 소수 2자리",
              "f'{x:.0f}'     # '1234568'       반올림 정수 표기",
              "f'{name:>4}'   # '  hi'          오른쪽 정렬 폭 4",
              "f'{0.256:.1%}' # '25.6%'         백분율"
            ],
            note: "`:,` 쉼표, `.2f` 소수 자릿수, `>`·`<`·`^` 정렬, `%` 백분율. 시험에서는 출력 문자열의 공백·자릿수를 그대로 고르게 한다."
          },
          {
            title: "itertools 조합 개수와 groupby",
            lang: "python",
            code: [
              "from itertools import permutations, combinations, product, groupby",
              "len(list(permutations('abcd', 2)))   # 12 = 4P2 (순서 있음)",
              "len(list(combinations('abcd', 2)))   # 6  = 4C2 (순서 없음)",
              "len(list(product('ab', repeat=3)))   # 8  = 2**3 (중복 허용)",
              "[(k, len(list(g))) for k, g in groupby(sorted('abab'))]   # [('a', 2), ('b', 2)]"
            ],
            note: "`groupby`는 **연속된** 같은 값만 묶는다. 정렬하지 않으면 `'abab'`은 네 그룹이 된다."
          },
          {
            title: "예외 흐름과 datetime 포맷",
            lang: "python",
            code: [
              "def parse(s):",
              "    try:",
              "        return int(s)",
              "    except ValueError:",
              "        return -1",
              "    finally:",
              "        print('done')      # return 뒤에도 실행된다",
              "",
              "from datetime import datetime, timedelta",
              "d = datetime.strptime('2026-10-04', '%Y-%m-%d')",
              "(d + timedelta(days=30)).strftime('%d/%m/%Y')   # '03/11/2026'"
            ],
            note: "`strptime`은 문자열→날짜(parse), `strftime`은 날짜→문자열(format). `%Y` 4자리 연도, `%y` 2자리, `%m` 월, `%d` 일, `%H:%M:%S` 시분초."
          }
        ],
        pitfalls: [
          "`round(2.5)`는 3이 아니라 **2**다(짝수 반올림). `round(2.675, 2)`도 부동소수 표현 때문에 2.67이 나온다.",
          "`x = lst.sort()` → `x`는 `None`. 정렬 결과를 변수에 받으려면 `sorted(lst)`.",
          "`def f(x, lst=[])`는 호출마다 같은 리스트를 공유한다. 두 번째 호출 결과에 첫 번째 값이 남아 있다.",
          "`map`·`filter`·`zip`·제너레이터는 **이터레이터**라 `len()`이 없고, 한 번 소진되면 두 번째 순회는 빈 결과다.",
          "`{1, 1.0, True}`의 길이는 1 — 세 값이 `==`이고 해시도 같아 하나로 합쳐진다. dict 키에서도 `d[1]`, `d[1.0]`, `d[True]`는 같은 칸."
        ]
      }
    },

    /* ──────────────────────────── 필기 문제 ──────────────────────────── */
    questions: [
      /* ===== b-1: 12문제 (mcq 7 / ox 2 / short 3, 난이도 4:6:2) ===== */
      {
        id: "b-1-q01", node: "b-1", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "다음 중 변경 불가능한(immutable) 자료형으로 **딕셔너리의 키로 쓸 수 있는** 것은?",
        choices: ["`list`", "`dict`", "`tuple`", "`set`"],
        answer: 2,
        explanation: [
          "**정답: ③** `tuple`은 [[immutable|불변 객체(immutable)]]이므로 [[hashable|해시 가능(hashable)]]하고, 딕셔너리 키나 집합 원소로 쓸 수 있다(원소가 모두 불변일 때).",
          "",
          "- ① `list`는 가변(mutable)이라 `__hash__`가 없어 키로 쓰면 `TypeError: unhashable type`.",
          "- ② `dict` 역시 가변 컨테이너라 해시 불가.",
          "- ④ `set`은 가변이다. 불변 버전은 `frozenset`이며 그것만 키로 쓸 수 있다.",
          "",
          "시험에서는 \"다음 중 해시 가능한 것은?\" 또는 \"딕셔너리 키로 쓸 수 없는 것은?\" 형태로 나온다."
        ],
        terms: ["immutable", "hashable", "mutable"]
      },
      {
        id: "b-1-q02", node: "b-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "def add(x, lst=[]):",
          "    lst.append(x)",
          "    return lst",
          "",
          "add(1)",
          "print(add(2))"
        ],
        lang: "python",
        choices: ["`[2]`", "`[1, 2]`", "`[[1], 2]`", "`TypeError`"],
        answer: 1,
        explanation: [
          "**정답: ②** [[default-argument|기본 인자(default argument)]] `[]`는 함수가 **정의될 때 한 번** 만들어져 모든 호출이 공유한다. 첫 호출에서 `[1]`이 된 리스트에 두 번째 호출이 2를 더해 `[1, 2]`.",
          "",
          "- ① `[2]`는 호출마다 새 리스트가 만들어진다고 착각한 답. `lst=None`으로 두고 함수 안에서 생성해야 그렇게 된다.",
          "- ③ 리스트가 중첩될 이유가 없다. `append`는 원소를 하나 추가할 뿐이다.",
          "- ④ 타입 오류가 날 요소가 없다. [[mutable|가변 객체]]를 기본값으로 써도 문법상 정상이다.",
          "",
          "시험에서는 \"두 번째 호출의 반환값은?\"으로 나와 누적 여부를 묻는다."
        ],
        terms: ["default-argument", "mutable"]
      },
      {
        id: "b-1-q03", node: "b-1", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: [
          "a = [0, 1, 2, 3, 4, 5]",
          "print(a[-2:], a[::2], a[10:])"
        ],
        lang: "python",
        choices: ["`[4, 5] [0, 2, 4] []`", "`[5, 4] [0, 2, 4] IndexError`", "`[4, 5] [1, 3, 5] []`", "`IndexError`"],
        answer: 0,
        explanation: [
          "**정답: ①** [[slicing|슬라이싱(slicing)]]에서 `a[-2:]`는 뒤에서 두 개 `[4, 5]`, `a[::2]`는 0번부터 2칸씩 `[0, 2, 4]`, 범위를 넘는 `a[10:]`은 **예외 없이 빈 리스트**를 돌려준다.",
          "",
          "- ② 음수 시작 인덱스는 순서를 뒤집지 않는다. 역순은 `step`이 음수일 때(`[::-1]`)만이다. 또 슬라이스는 IndexError를 내지 않는다.",
          "- ③ `[::2]`는 인덱스 0부터 시작하므로 짝수 인덱스 `0, 2, 4`가 뽑힌다. `[1::2]`라면 `[1, 3, 5]`.",
          "- ④ 단일 인덱스 `a[10]`은 IndexError지만 슬라이스 `a[10:]`은 잘려서 빈 결과다.",
          "",
          "시험에서는 \"슬라이스 범위 초과\"와 \"단일 인덱스 초과\"의 동작 차이를 섞어 출제한다."
        ],
        terms: ["slicing"]
      },
      {
        id: "b-1-q04", node: "b-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: ["print(round(2.5), round(3.5), -7 // 2, -7 % 2)"],
        lang: "python",
        choices: ["`3 4 -3 -1`", "`2 4 -3 1`", "`3 4 -4 1`", "`2 4 -4 1`"],
        answer: 3,
        explanation: [
          "**정답: ④** `round()`는 정확히 .5일 때 **짝수 쪽으로** 반올림(banker's rounding)하므로 `round(2.5)=2`, `round(3.5)=4`. `//`는 바닥 나눗셈(floor division)이라 `-7 // 2 = -4`(음의 무한대 방향), `%`의 결과 부호는 제수를 따라 `-7 % 2 = 1`. 항등식 `(-7 // 2) * 2 + (-7 % 2) == -7`이 성립한다.",
          "",
          "- ① `round(2.5)`를 3으로 본 것과 C 언어식 `-3`, `-1`을 섞은 오답.",
          "- ② 반올림은 맞지만 `//`를 0 방향 절삭(`-3`)으로 본 오답. Python은 바닥(floor)이다.",
          "- ③ `//`·`%`는 맞지만 `round(2.5)`를 3으로 본 오답.",
          "",
          "시험에서는 [[floating-point|부동소수점]] 반올림과 음수 나눗셈을 한 문제에 묶어 출제한다. `math.floor`·`int()` 절삭과의 차이도 함께 익힌다."
        ],
        terms: ["floating-point"]
      },
      {
        id: "b-1-q05", node: "b-1", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드를 실행하면 어떤 결과가 나오는가?",
        code: [
          "nums = [3, 1, 2]",
          "result = nums.sort()",
          "print(result[0])"
        ],
        lang: "python",
        choices: ["`IndexError`", "`TypeError`", "`AttributeError`", "`1`이 출력된다"],
        answer: 1,
        explanation: [
          "**정답: ②** `list.sort()`는 리스트를 **제자리(in-place)** 에서 정렬하고 `None`을 반환한다. `result`는 `None`이므로 `None[0]`에서 `TypeError: 'NoneType' object is not subscriptable`.",
          "",
          "- ① IndexError는 인덱스가 범위를 벗어났을 때다. 인덱싱 대상 자체가 `None`이라 거기까지 가지 않는다.",
          "- ③ AttributeError는 `None.foo`처럼 속성 접근에서 난다. `[]` 인덱싱은 TypeError다.",
          "- ④ `1`을 출력하려면 `result = sorted(nums)`로 새 리스트를 받아야 한다.",
          "",
          "시험에서는 `sorted()`(새 리스트 반환) vs `.sort()`(`None` 반환)의 반환값 차이를 [[exception|예외]] 유형과 함께 묻는다. `append`, `reverse`, `shuffle`도 같은 `None` 함정이다."
        ],
        terms: ["exception", "mutable"]
      },
      {
        id: "b-1-q06", node: "b-1", type: "mcq", kind: "concept", difficulty: 3,
        prompt: "다음 중 코드와 발생하는 예외(exception)의 연결이 **틀린** 것은?",
        choices: ["`int('3.5')` → `ValueError`", "`[1, 2][2]` → `IndexError`", "`{'a': 1}['b']` → `IndexError`", "`'a' + 1` → `TypeError`"],
        answer: 2,
        explanation: [
          "**정답: ③** 딕셔너리에 없는 키를 조회하면 `IndexError`가 아니라 **`KeyError`** 다. IndexError는 시퀀스(list·tuple·str)의 정수 인덱스가 범위를 벗어날 때만 난다.",
          "",
          "- ① `int('3.5')`는 형식이 맞지 않는 값이라 `ValueError`. 참고로 `int(3.5)`는 3으로 정상 변환된다.",
          "- ② 길이 2인 리스트의 인덱스 2는 범위 밖이라 `IndexError`.",
          "- ④ 문자열과 정수의 `+`는 타입이 맞지 않아 `TypeError`. `'a' + str(1)`이어야 한다.",
          "",
          "시험에서는 [[exception|예외 계층]]을 \"다음 코드가 발생시키는 예외는?\" 형태로 묻는다. `1/0`→ZeroDivisionError, `d.get('b')`는 예외 없이 `None`도 함께 기억한다."
        ],
        terms: ["exception"]
      },
      {
        id: "b-1-q07", node: "b-1", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "g = (x * x for x in range(3))",
          "print(sum(g), sum(g))"
        ],
        lang: "python",
        choices: ["`5 0`", "`5 5`", "`3 0`", "`3 3`"],
        answer: 0,
        explanation: [
          "**정답: ①** 소괄호 컴프리헨션은 [[generator|제너레이터 표현식(generator expression)]]이다. 첫 `sum(g)`는 `0 + 1 + 4 = 5`를 내며 제너레이터를 **소진**시키고, 두 번째 `sum(g)`는 남은 원소가 없어 `0`.",
          "",
          "- ② 리스트 컴프리헨션 `[x * x for x in range(3)]`이었다면 두 번 모두 5가 나온다. 제너레이터는 1회용 [[iterator|이터레이터]]다.",
          "- ③ `range(3)`은 0, 1, 2이므로 제곱합은 3이 아니라 5다. `0+1+2`로 계산한 실수.",
          "- ④ 합도 틀리고 재사용도 틀렸다.",
          "",
          "시험에서는 `zip`·`map`·`filter` 결과를 두 번 순회시켜 두 번째가 비는지를 묻는 형태로도 나온다."
        ],
        terms: ["generator", "iterator", "comprehension"]
      },
      {
        id: "b-1-q08", node: "b-1", type: "ox", kind: "concept", difficulty: 1,
        prompt: "Python 3.7 이상에서 `dict`는 키를 **삽입한 순서**를 보장하며, `for k in d`로 순회하면 넣은 순서대로 나온다.",
        answer: true,
        explanation: [
          "**정답: O** Python 3.7부터 딕셔너리의 삽입 순서 보존(insertion order)은 언어 사양이다. `list(d.keys())`, `d.items()` 순회가 모두 넣은 순서를 따른다.",
          "반면 `set`은 여전히 순서를 보장하지 않으므로 `set`을 `list`로 바꾼 뒤의 순서를 답으로 묻는 문제는 없다. 순서가 필요하면 `dict.fromkeys(seq)`로 중복을 제거한다.",
          "",
          "시험에서는 [[hashable|해시]] 기반 자료형 중 \"순서를 보장하는 것은?\"으로 나오며, `dict`는 O, `set`은 X가 정답이다."
        ],
        terms: ["hashable", "mutable"]
      },
      {
        id: "b-1-q09", node: "b-1", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`a = [[1, 2], [3]]; b = a[:]` 를 실행한 뒤 `b[0].append(9)`를 하면, `b`는 `a`의 복사본이므로 `a`는 바뀌지 않는다.",
        answer: false,
        explanation: [
          "**정답: X** 슬라이스 `a[:]`는 [[shallow-copy|얕은 복사(shallow copy)]]다. 바깥 리스트만 새로 만들고 안쪽 `[1, 2]`는 **같은 객체를 공유**하므로 `b[0].append(9)` 뒤 `a`는 `[[1, 2, 9], [3]]`이 된다.",
          "`list(a)`, `a.copy()`, `dict(d)`도 모두 얕은 복사다. 중첩 구조까지 독립시키려면 `copy.deepcopy(a)`([[deep-copy|깊은 복사]])를 써야 한다.",
          "",
          "시험에서는 복사 후 안쪽 원소를 바꾸고 원본을 출력시켜 얕은/깊은 복사 구분을 묻는다. `b.append(...)`처럼 바깥만 바꾸면 원본은 영향이 없다는 점도 함께 나온다."
        ],
        terms: ["shallow-copy", "deep-copy", "mutable"]
      },
      {
        id: "b-1-q10", node: "b-1", type: "short", kind: "fill", difficulty: 2,
        prompt: "빈칸에 공통으로 들어갈 `collections` 모듈의 클래스 이름을 쓰시오. 단어 빈도 상위 2개를 구한다: `from collections import ____; ____(words).most_common(2)`",
        answer: "Counter",
        accept: ["collections.Counter"],
        explanation: [
          "**정답: Counter** [[counter|Counter]]는 이터러블의 원소 빈도를 세는 `dict` 서브클래스로, `most_common(n)`이 빈도 내림차순 상위 n개를 `(원소, 횟수)` 튜플 리스트로 돌려준다.",
          "동률이면 먼저 등장한 순서가 앞선다(안정 정렬). `Counter(a) + Counter(b)`로 합산, `c['없는키']`는 KeyError 대신 0을 돌려준다.",
          "",
          "시험에서는 `most_common(1)[0][0]`(최빈값)과 [[defaultdict|defaultdict(int)]]로 직접 세는 코드를 비교하는 형태로 나온다."
        ],
        terms: ["counter", "defaultdict"]
      },
      {
        id: "b-1-q11", node: "b-1", type: "short", kind: "concept", difficulty: 3,
        prompt: "`zip(a, b)`는 짧은 쪽 길이에서 멈춘다. 긴 쪽의 남는 원소까지 `None`으로 채워 묶어 주는 `itertools` 함수의 이름은?",
        answer: "zip_longest",
        accept: ["itertools.zip_longest"],
        explanation: [
          "**정답: zip_longest** 내장 `zip([1, 2, 3], 'ab')`는 `[(1, 'a'), (2, 'b')]`로 짧은 쪽에서 멈추지만, [[itertools|itertools]]`.zip_longest([1, 2, 3], 'ab')`는 `[(1, 'a'), (2, 'b'), (3, None)]`을 만든다. `fillvalue=` 로 채울 값을 바꿀 수 있다.",
          "Python 3.10+에서는 `zip(a, b, strict=True)`로 길이가 다르면 `ValueError`를 내게 할 수도 있다.",
          "",
          "시험에서는 \"`zip` 길이 불일치 시 결과 길이는?\"(짧은 쪽)과 함께 [[iterator|이터레이터]]라 `len()`이 없다는 점을 묻는다."
        ],
        terms: ["itertools", "iterator"]
      },
      {
        id: "b-1-q12", node: "b-1", type: "short", kind: "concept", difficulty: 1,
        prompt: "`try`/`except`/`else`/`finally` 구조에서 예외 발생 여부, `return` 여부와 무관하게 **항상** 실행되는 블록의 키워드는?",
        answer: "finally",
        explanation: [
          "**정답: finally** `finally` 블록은 `try`에서 예외가 나든, `except`에서 처리되든, 중간에 `return`이 있든 **항상** 실행된다. 파일 닫기·연결 해제 같은 정리(cleanup) 코드를 둔다.",
          "실행 순서는 `try` → (예외 없으면) `else` → `finally`, 또는 `try` → `except` → `finally`. `else`는 예외가 **없을 때만** 실행되므로 혼동하지 않는다.",
          "",
          "시험에서는 `return` 뒤에도 `finally`의 `print`가 찍히는지를 출력 예측으로 묻는다. `with` 문은 [[exception|예외]]가 나도 자원을 닫아 주는 `finally`의 축약형이다."
        ],
        terms: ["exception"]
      },

      /* ===== b-1-2: 20문제 (mcq 12 / ox 3 / short 5, 난이도 6:10:4, output ≥ 6) ===== */
      {
        id: "b-1-2-q01", node: "b-1-2", type: "mcq", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력은?",
        code: ["print(0.1 + 0.2 == 0.3, 0.1 + 0.2)"],
        lang: "python",
        choices: ["`True 0.3`", "`False 0.30000000000000004`", "`False 0.3`", "`True 0.30000000000000004`"],
        answer: 1,
        explanation: [
          "**정답: ②** 0.1과 0.2는 이진 [[floating-point|부동소수점(floating point)]]으로 정확히 표현되지 않아 합이 `0.30000000000000004`가 되고, `0.3`과의 `==`는 **False** 다.",
          "",
          "- ① 10진수 직관으로 같다고 본 오답. 부동소수 비교에 `==`를 쓰면 안 된다.",
          "- ③ 비교는 맞지만 `print`는 `repr` 기준 최단 표현을 찍으므로 오차가 그대로 보인다.",
          "- ④ 값이 다르게 찍히는데 같다고 하는 모순.",
          "",
          "시험에서는 해법으로 `math.isclose(a, b)`, `round(a, 10) == round(b, 10)`, `abs(a - b) < 1e-9`, 또는 `decimal.Decimal`을 고르게 한다."
        ],
        terms: ["floating-point"]
      },
      {
        id: "b-1-2-q02", node: "b-1-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은? (`|`는 구분용 문자다)",
        code: [
          "x, w = 1234567.891, 'hi'",
          "print(f'{x:,.2f}|{x:.0f}|{w:>4}|')"
        ],
        lang: "python",
        choices: ["`1234567.89|1234567|hi  |`", "`1,234,567.891|1234568|  hi|`", "`1,234,567.89|1234568|  hi|`", "`1,234,567.89|1234567|hi|`"],
        answer: 2,
        explanation: [
          "**정답: ③** [[f-string|f-문자열]] 서식 `:,.2f`는 천 단위 쉼표 + 소수 둘째 자리 → `1,234,567.89`. `:.0f`는 소수 0자리로 **반올림** → `1234568`. `:>4`는 폭 4에 **오른쪽 정렬** → 앞에 공백 2개 `  hi`.",
          "",
          "- ① 쉼표가 빠졌고, `.0f`는 절삭이 아니라 반올림이며, `>`는 오른쪽 정렬이라 공백이 앞에 온다(`<`가 왼쪽 정렬).",
          "- ② `.2f`는 소수 둘째 자리까지만 표시한다. `.891`이 남을 수 없다.",
          "- ④ `.0f`가 반올림이라 `1234568`이어야 하고, 폭 지정 `4`가 무시될 수 없다.",
          "",
          "시험에서는 `:,`, `:.2f`, `:>10`, `:<10`, `:^10`, `:.1%`, `:05d`(0 패딩) 조합의 출력 문자열을 고르게 한다. 공백 개수까지 센다."
        ],
        terms: ["f-string", "floating-point"]
      },
      {
        id: "b-1-2-q03", node: "b-1-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "a = [1, 2]",
          "b = [1, 2]",
          "c = a",
          "print(a == b, a is b, a is c)"
        ],
        lang: "python",
        choices: ["`True False True`", "`True True True`", "`False False True`", "`True False False`"],
        answer: 0,
        explanation: [
          "**정답: ①** `==`는 **값**이 같은지, `is`는 [[identity|동일한 객체(identity)]]인지(`id()`가 같은지) 본다. `a`와 `b`는 값은 같지만 서로 다른 리스트 객체라 `a is b`는 False. `c = a`는 같은 객체를 가리키는 별칭(alias)이라 `a is c`는 True.",
          "",
          "- ② 리스트 리터럴은 쓸 때마다 새 객체를 만들므로 `a is b`가 True일 수 없다.",
          "- ③ 값 비교 `a == b`는 원소가 같으니 True다.",
          "- ④ `c = a`는 복사가 아니라 같은 객체에 이름을 하나 더 붙인 것이다. `a is c`는 True.",
          "",
          "시험에서는 `c.append(3)` 뒤 `a`의 값(같이 바뀜)이나, `is None`을 써야 하는 이유를 함께 묻는다. 작은 정수·짧은 문자열은 캐시(interning)로 `is`가 True가 될 수 있어 값 비교에 `is`를 쓰면 안 된다."
        ],
        terms: ["identity", "mutable"]
      },
      {
        id: "b-1-2-q04", node: "b-1-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "d = {k: v for k, v in zip('abc', [1, 2, 3]) if v % 2}",
          "print(d, len({1, 1.0, True}))"
        ],
        lang: "python",
        choices: ["`{'b': 2} 3`", "`{'a': 1, 'c': 3} 3`", "`{'b': 2} 1`", "`{'a': 1, 'c': 3} 1`"],
        answer: 3,
        explanation: [
          "**정답: ④** 딕셔너리 [[comprehension|컴프리헨션]]의 조건 `if v % 2`는 나머지가 0이 아닌(참인) 홀수만 남기므로 `{'a': 1, 'c': 3}`. 집합 `{1, 1.0, True}`는 세 값이 서로 `==`이고 [[hashable|해시값]]도 같아 **하나로 합쳐져** 길이 1.",
          "",
          "- ① `v % 2`가 참인 것은 홀수다. 짝수만 남긴다고 거꾸로 읽은 오답.",
          "- ② 딕셔너리는 맞지만 집합 길이를 3으로 본 오답. `True == 1 == 1.0`이고 `hash(True) == hash(1) == hash(1.0)`이다.",
          "- ③ 둘 다 틀렸다.",
          "",
          "시험에서는 `{True: 'a', 1: 'b'}`의 길이와 값(`{True: 'b'}` — 먼저 들어온 키가 유지되고 값은 덮어쓰임)을 묻는 변형이 나온다."
        ],
        terms: ["comprehension", "hashable", "truthiness"]
      },
      {
        id: "b-1-2-q05", node: "b-1-2", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은?",
        code: [
          "def make():",
          "    count = 0",
          "    def inc():",
          "        nonlocal count",
          "        count += 1",
          "        return count",
          "    return inc",
          "",
          "f = make()",
          "f(); f()",
          "print(f(), make()())"
        ],
        lang: "python",
        choices: ["`3 4`", "`3 1`", "`1 1`", "`UnboundLocalError`"],
        answer: 1,
        explanation: [
          "**정답: ②** `inc`는 바깥 함수의 변수 `count`를 기억하는 [[closure|클로저(closure)]]다. `f`는 자기만의 `count`를 가지며 세 번째 호출에서 3. `make()()`는 **새 클로저**를 만들어 바로 호출하므로 독립된 `count`로 1.",
          "",
          "- ① 두 클로저가 `count`를 공유한다고 본 오답. `make()`를 다시 부르면 새 [[scope|스코프]]가 만들어진다.",
          "- ③ `f`는 호출마다 상태가 누적되므로 세 번째는 1이 아니라 3이다.",
          "- ④ `nonlocal count`가 있어서 바깥 변수에 대입할 수 있다. 이 줄이 없었다면 `count += 1`에서 `UnboundLocalError`가 난다.",
          "",
          "시험에서는 `nonlocal`을 지운 코드를 보여 주고 발생하는 예외를 묻거나, `global`과 `nonlocal`의 차이(모듈 전역 vs 바로 바깥 함수)를 묻는다."
        ],
        terms: ["closure", "scope"]
      },
      {
        id: "b-1-2-q06", node: "b-1-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "from collections import Counter",
          "print(Counter('mississippi').most_common(2))"
        ],
        lang: "python",
        choices: ["`{'i': 4, 's': 4}`", "`[('s', 4), ('i', 4)]`", "`[('i', 4), ('s', 4)]`", "`[('m', 1), ('i', 4)]`"],
        answer: 2,
        explanation: [
          "**정답: ③** `'mississippi'`의 빈도는 m1, i4, s4, p2. [[counter|Counter]]`.most_common(2)`는 빈도 **내림차순** 상위 2개를 `(원소, 횟수)` **튜플의 리스트**로 돌려준다. i와 s가 동률(4)인데, [[stable-sort|안정 정렬]]이라 **먼저 등장한** `i`(인덱스 1)가 `s`(인덱스 2)보다 앞선다.",
          "",
          "- ① `most_common`의 반환형은 dict가 아니라 리스트다. `dict(c.most_common(2))`로 바꿔야 그 형태가 된다.",
          "- ② 동률일 때 순서는 처음 등장한 순서다. s가 i보다 뒤에 처음 나왔으므로 뒤로 간다.",
          "- ④ 빈도 오름차순이 아니다. 가장 적은 m은 뒤로 간다.",
          "",
          "시험에서는 `most_common(1)[0][0]`으로 최빈값(mode)을 꺼내는 코드, 동률 순서, 반환형을 묻는다."
        ],
        terms: ["counter", "stable-sort"]
      },
      {
        id: "b-1-2-q07", node: "b-1-2", type: "mcq", kind: "output", difficulty: 2,
        prompt: "다음 코드의 출력은?",
        code: [
          "from itertools import permutations, combinations, product",
          "print(len(list(permutations('abcd', 2))),",
          "      len(list(combinations('abcd', 2))),",
          "      len(list(product('ab', repeat=3))))"
        ],
        lang: "python",
        choices: ["`12 6 8`", "`6 12 8`", "`12 6 6`", "`24 6 9`"],
        answer: 0,
        explanation: [
          "**정답: ①** [[itertools|itertools]]의 `permutations(n개, r)`는 순서 있는 순열 nPr = 4×3 = **12**, `combinations`는 순서 없는 조합 nCr = 4C2 = **6**, `product('ab', repeat=3)`은 중복 허용 데카르트 곱 2³ = **8**.",
          "",
          "- ② 순열과 조합의 개수를 바꿔 쓴 오답. 순열은 `('a','b')`와 `('b','a')`를 따로 세므로 조합보다 많다.",
          "- ③ `product`는 `('a','a','a')`처럼 중복을 허용하므로 2³ = 8. 6으로 본 것은 중복 없는 경우를 떠올린 실수.",
          "- ④ `permutations('abcd')`처럼 r을 생략하면 4! = 24지만 r=2를 지정했다. 9도 3²로 밑과 지수를 뒤바꾼 값.",
          "",
          "시험에서는 세 함수의 **개수 공식**(nPr, nCr, nʳ)과 `combinations_with_replacement`(중복 조합)를 함께 묻는다. 결과는 모두 [[iterator|이터레이터]]라 `len()`을 바로 쓸 수 없고 `list()`로 감싸야 한다."
        ],
        terms: ["itertools", "iterator"]
      },
      {
        id: "b-1-2-q08", node: "b-1-2", type: "mcq", kind: "concept", difficulty: 1,
        prompt: "다음 중 `bool()`로 변환했을 때 **True**인 것은?",
        choices: ["`[]`", "`0.0`", "`'0'`", "`None`"],
        answer: 2,
        explanation: [
          "**정답: ③** 문자열 `'0'`은 길이 1인 **비어 있지 않은 문자열**이라 참(truthy)이다. 문자열은 내용이 아니라 **길이**로 [[truthiness|진릿값]]이 정해진다.",
          "",
          "- ① 빈 리스트 `[]`는 거짓. 빈 컨테이너(`()`, `{}`, `set()`, `''`)는 모두 거짓이다.",
          "- ② 숫자 0은 `int`·`float`·`complex` 모두 거짓. `0.0`도 거짓이다.",
          "- ④ `None`은 거짓. 단, `if x is None`과 `if not x`는 다르다(0이나 빈 리스트도 `not x`가 참).",
          "",
          "시험에서는 `if data:`로 빈 리스트와 `None`을 구분하지 못하는 버그, `'False'` 문자열이 참인 함정, `bool('0')`과 `bool(0)`의 차이를 묻는다. numpy 배열은 길이 2 이상이면 `bool()` 자체가 ValueError다."
        ],
        terms: ["truthiness"]
      },
      {
        id: "b-1-2-q09", node: "b-1-2", type: "mcq", kind: "bug", difficulty: 2,
        prompt: "다음 코드를 실행한 결과로 옳은 것은?",
        code: [
          "data = {'a': 1, 'b': 2}",
          "for k in data:",
          "    if data[k] == 1:",
          "        del data[k]",
          "print(data)"
        ],
        lang: "python",
        choices: ["`KeyError`", "`RuntimeError`", "`{'b': 2}` 가 출력된다", "`TypeError`"],
        answer: 1,
        explanation: [
          "**정답: ②** 딕셔너리를 **순회하는 도중 크기를 바꾸면** `RuntimeError: dictionary changed size during iteration`이 난다. 리스트도 순회 중 `remove`하면 원소를 건너뛰는 버그가 생긴다.",
          "",
          "- ① KeyError는 없는 키를 조회할 때다. `data[k]`의 k는 존재하는 키다.",
          "- ③ 의도한 결과지만 그렇게 되지 않는다. 올바른 방법은 `for k in list(data):`로 키를 복사해 순회하거나, `{k: v for k, v in data.items() if v != 1}`로 새 dict를 만드는 것.",
          "- ④ 타입이 맞지 않는 연산은 없다.",
          "",
          "시험에서는 \"이 코드의 문제를 고치려면?\"으로 `list(data.keys())` 복사본 순회나 [[comprehension|컴프리헨션]] 재구성을 고르게 한다. [[mutable|가변 객체]]를 순회 중에 바꾸지 않는 것이 원칙이다."
        ],
        terms: ["mutable", "exception", "comprehension"]
      },
      {
        id: "b-1-2-q10", node: "b-1-2", type: "mcq", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력은? (여러 줄이면 순서대로)",
        code: [
          "def f():",
          "    try:",
          "        return int('12')",
          "    except ValueError:",
          "        return -1",
          "    else:",
          "        return 0",
          "    finally:",
          "        print('done')",
          "",
          "print(f())"
        ],
        lang: "python",
        choices: ["`done` 다음 줄에 `12`", "`12` 다음 줄에 `done`", "`done` 다음 줄에 `0`", "`0` 한 줄만"],
        answer: 0,
        explanation: [
          "**정답: ①** `try` 안의 `return int('12')`가 반환값 12를 **확정**하지만, 함수가 실제로 끝나기 전에 `finally`가 먼저 실행되어 `done`이 찍힌다. 그 다음 바깥 `print(f())`가 12를 출력한다. `else`는 `try` 블록이 `return`으로 빠져나갔으므로 실행되지 않는다.",
          "",
          "- ② `finally`는 함수가 값을 돌려주기 **전에** 실행된다. 호출자의 `print`보다 먼저 `done`이 나온다.",
          "- ③ `else`는 `try`가 예외 없이 **끝까지** 실행됐을 때만 돈다. `return`으로 빠져나가면 건너뛴다.",
          "- ④ `finally`는 생략될 수 없다.",
          "",
          "시험에서는 `finally` 안에 `return`을 두어 `try`의 반환값을 덮어쓰는 변형, `int('abc')`로 바꿔 `except` 경로(`done` 뒤 `-1`)를 묻는 변형이 나온다. [[exception|예외 처리]] 흐름은 순서를 그려서 푼다."
        ],
        terms: ["exception"]
      },
      {
        id: "b-1-2-q11", node: "b-1-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "`rows = [('kim', 90), ('lee', 85), ('ahn', 90)]`을 **점수 내림차순, 점수가 같으면 이름 오름차순**으로 정렬하는 코드로 옳은 것은?",
        choices: ["`sorted(rows, key=lambda r: (r[1], r[0]), reverse=True)`", "`sorted(rows, key=lambda r: r[1], r[0])`", "`sorted(rows, key=(r[1], -r[0]))`", "`sorted(rows, key=lambda r: (-r[1], r[0]))`"],
        answer: 3,
        explanation: [
          "**정답: ④** 정렬 키를 튜플 `(-점수, 이름)`으로 주면 첫 원소(음수 점수)가 작은 순 = 점수 큰 순, 동률이면 둘째 원소 이름 오름차순이 된다. 결과는 `[('ahn', 90), ('kim', 90), ('lee', 85)]`.",
          "",
          "- ① `reverse=True`는 **모든 키의 방향**을 뒤집으므로 이름도 내림차순이 되어 `kim`이 `ahn`보다 앞에 온다.",
          "- ② `key=`에는 함수 하나만 들어간다. `lambda r: r[1], r[0]`은 람다 바깥의 `r[0]`이 두 번째 위치 인자로 해석되어 오류다.",
          "- ③ `key`에 튜플 리터럴을 넘기면 호출 가능 객체가 아니라 `TypeError`. 또 문자열에 단항 `-`를 붙일 수 없다.",
          "",
          "시험에서는 `key=lambda` 다중 키, 문자열 내림차순(부호를 못 붙이므로 `reverse=True` 후 두 단계 정렬 이용 — [[stable-sort|안정 정렬]] 덕에 가능), `sorted(d.items(), key=lambda kv: kv[1])`로 값 기준 dict 정렬을 묻는다."
        ],
        terms: ["lambda", "stable-sort"]
      },
      {
        id: "b-1-2-q12", node: "b-1-2", type: "mcq", kind: "concept", difficulty: 2,
        prompt: "`datetime.date(2026, 10, 4)`를 문자열 `'04/10/2026'`으로 만드는 `strftime` 포맷 문자열로 옳은 것은?",
        choices: ["`'%m/%d/%Y'`", "`'%d/%m/%y'`", "`'%D/%M/%Y'`", "`'%d/%m/%Y'`"],
        answer: 3,
        explanation: [
          "**정답: ④** [[strftime|strftime]] 포맷 코드에서 `%d`는 일(01~31), `%m`은 월(01~12), `%Y`는 4자리 연도다. 일/월/연 순서이므로 `'%d/%m/%Y'` → `04/10/2026`.",
          "",
          "- ① `%m/%d/%Y`는 월/일/연이라 `10/04/2026`이 된다. 미국식 표기.",
          "- ② `%y`는 **2자리** 연도라 `04/10/26`.",
          "- ③ `%D`는 `%m/%d/%y`의 축약, `%M`은 **분(minute)** 이다. 대소문자가 뜻이 다르다.",
          "",
          "시험에서는 `%Y-%m-%d`, `%H:%M:%S`(시:분:초), `%A`(요일 이름), `%B`(월 이름)와, 문자열→날짜는 `strptime`·날짜→문자열은 `strftime`이라는 방향 구분을 묻는다. `timedelta(days=7)` 덧셈과 `.days` 속성도 함께 외운다."
        ],
        terms: ["strftime"]
      },
      {
        id: "b-1-2-q13", node: "b-1-2", type: "ox", kind: "concept", difficulty: 1,
        prompt: "Python의 `int`는 고정 비트 크기가 아니므로 `2 ** 100`과 같은 큰 정수도 오버플로(overflow) 없이 정확히 계산된다.",
        answer: true,
        explanation: [
          "**정답: O** Python 3의 `int`는 임의 정밀도(arbitrary precision)라 메모리가 허락하는 한 자릿수 제한이 없다. `2 ** 100 == 1267650600228229401496703205376`이 정확히 나온다.",
          "반면 `float`는 64비트 IEEE 754라 약 15~17자리 유효숫자까지만 정확하고, `numpy`의 `int64` 배열은 2⁶³을 넘으면 오버플로된다. 순수 Python과 numpy의 차이가 함정이다.",
          "",
          "시험에서는 `int` 무제한 vs `float` [[floating-point|부동소수점]] 오차 vs `np.int64` 오버플로를 비교하는 OX로 나온다."
        ],
        terms: ["floating-point"]
      },
      {
        id: "b-1-2-q14", node: "b-1-2", type: "ox", kind: "concept", difficulty: 2,
        prompt: "`map(str, [1, 2, 3])`과 `filter(None, [0, 1, 2])`는 모두 **리스트**를 반환하므로 바로 `len()`을 쓰거나 인덱싱할 수 있다.",
        answer: false,
        explanation: [
          "**정답: X** Python 3에서 `map`·`filter`·`zip`·`reversed`·`dict.keys()`는 리스트가 아니라 [[iterator|이터레이터]](또는 뷰)를 돌려준다. `len()`이나 `[0]` 인덱싱을 하면 `TypeError`가 나며, `list(map(...))`로 감싸야 한다.",
          "이터레이터는 **한 번만** 순회할 수 있어 두 번째 `for`는 빈 결과다. `filter(None, seq)`는 [[truthiness|진릿값]]이 참인 원소만 남긴다(`[1, 2]`).",
          "",
          "시험에서는 `print(map(str, [1, 2]))`의 출력이 `<map object at ...>`인 이유, `len(zip(a, b))`가 오류인 이유를 묻는다. Python 2에서는 리스트였다는 점이 혼동의 뿌리다."
        ],
        terms: ["iterator", "truthiness"]
      },
      {
        id: "b-1-2-q15", node: "b-1-2", type: "ox", kind: "concept", difficulty: 3,
        prompt: "`itertools.groupby('abab')`는 입력이 정렬되어 있지 않아도 같은 키를 모두 모아 `a` 그룹과 `b` 그룹 **두 개**를 만든다.",
        answer: false,
        explanation: [
          "**정답: X** [[itertools|itertools]]`.groupby`는 **연속된(consecutive)** 같은 키만 한 그룹으로 묶는다. `'abab'`은 a, b, a, b **네 그룹**이 된다. SQL이나 pandas의 `groupby`처럼 전체를 모으려면 먼저 `sorted()`로 정렬해야 한다.",
          "또 각 그룹의 값은 1회용 [[iterator|이터레이터]]라 다음 그룹으로 넘어가면 이전 그룹은 소진된다. `list(g)`로 바로 꺼내 둬야 한다.",
          "",
          "시험에서는 `[(k, len(list(g))) for k, g in groupby(s)]`의 결과를 정렬 유무로 비교해 묻는다. pandas `groupby`와 **동작이 다르다**는 점이 핵심 함정이다."
        ],
        terms: ["itertools", "iterator"]
      },
      {
        id: "b-1-2-q16", node: "b-1-2", type: "short", kind: "fill", difficulty: 1,
        prompt: "빈칸에 알맞은 함수 이름을 쓰시오. 파일 객체에서 JSON을 읽어 Python 객체로 만든다: `with open('data.json', encoding='utf-8') as f: d = json.____(f)`",
        answer: "load",
        accept: ["json.load"],
        explanation: [
          "**정답: load** [[json|json]] 모듈은 네 함수를 쌍으로 외운다. `load(파일객체)`·`loads(문자열)`은 JSON → Python(dict/list), `dump(obj, 파일객체)`·`dumps(obj)`는 Python → JSON. 끝의 `s`는 **string**을 뜻한다.",
          "`with` 문은 블록이 끝나거나 예외가 나도 파일을 자동으로 닫는다(컨텍스트 매니저). `json.loads(f)`라고 쓰면 파일 객체를 문자열로 취급해 `TypeError`.",
          "",
          "시험에서는 `load` vs `loads`, `dump` vs `dumps`, `ensure_ascii=False`(한글 그대로 저장), `indent=2`를 묻는다. 파일 읽기 모드 `'r'`은 기본값이라 생략 가능하고 [[exception|예외]] 안전을 위해 `with`를 쓴다."
        ],
        terms: ["json", "exception"]
      },
      {
        id: "b-1-2-q17", node: "b-1-2", type: "short", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "a, *rest = [1, 2, 3, 4]",
          "print(sum(rest))"
        ],
        lang: "python",
        answer: "9",
        explanation: [
          "**정답: 9** 확장 [[unpacking|언패킹(unpacking)]] `a, *rest = [1, 2, 3, 4]`는 첫 원소 1을 `a`에, 나머지 `[2, 3, 4]`를 **리스트**로 `rest`에 담는다. 합은 2 + 3 + 4 = 9.",
          "`*rest`는 어느 위치에나 하나만 둘 수 있다: `first, *mid, last = ...`. 원소가 없으면 `rest`는 빈 리스트 `[]`다. 튜플을 언패킹해도 `rest`는 항상 리스트다.",
          "",
          "시험에서는 `a, b = b, a` 스왑, `for k, v in d.items()`, 함수 호출 시 `f(*args, **kwargs)` 펼치기와 묶어 출제된다."
        ],
        terms: ["unpacking"]
      },
      {
        id: "b-1-2-q18", node: "b-1-2", type: "short", kind: "output", difficulty: 1,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: ["print(len('a,b,,c'.split(',')))"],
        lang: "python",
        answer: "4",
        explanation: [
          "**정답: 4** 구분자를 지정한 `split(',')`은 연속된 구분자 사이의 **빈 문자열도 원소로** 남긴다. 결과는 `['a', 'b', '', 'c']`로 길이 4.",
          "반대로 인자 없는 `split()`은 공백 기준으로 나누면서 연속 공백·앞뒤 공백을 모두 무시한다(`' a  b '.split()` → `['a', 'b']`). 두 동작의 차이가 시험 함정이다.",
          "",
          "시험에서는 `','.join(리스트)`로 되돌리기, `strip()`·`replace()` [[slicing|슬라이싱]]과 메서드 체이닝 `s.strip().lower().split(',')`의 결과를 묻는다. CSV 한 줄 파싱 문맥으로도 자주 나온다."
        ],
        terms: ["slicing", "immutable"]
      },
      {
        id: "b-1-2-q19", node: "b-1-2", type: "short", kind: "concept", difficulty: 2,
        prompt: "`collections.deque`에서 **왼쪽 끝**에 원소를 O(1)로 추가하는 메서드 이름은?",
        answer: "appendleft",
        accept: ["deque.appendleft"],
        explanation: [
          "**정답: appendleft** [[deque|덱(deque, double-ended queue)]]은 양쪽 끝 삽입·삭제가 O(1)인 자료구조다. `append`/`appendleft`로 넣고 `pop`/`popleft`로 뺀다. 리스트의 `insert(0, x)`·`pop(0)`은 O(n)이라 큐(queue) 구현에는 deque를 쓴다.",
          "`deque(maxlen=3)`은 꽉 찬 상태에서 넣으면 반대쪽이 자동으로 밀려 나가 **이동 창(rolling window)** 을 만들 때 쓴다. `rotate(1)`은 오른쪽으로 회전.",
          "",
          "시험에서는 `popleft`의 반환값, `maxlen` 초과 시 남는 원소, 스택(LIFO)은 리스트 `append/pop`·큐(FIFO)는 deque라는 선택을 묻는다. [[counter|Counter]]·`defaultdict`·`namedtuple`과 함께 `collections` 4종으로 묶어 외운다."
        ],
        terms: ["deque", "counter"]
      },
      {
        id: "b-1-2-q20", node: "b-1-2", type: "short", kind: "output", difficulty: 3,
        prompt: "다음 코드의 출력을 쓰시오.",
        code: [
          "d = {1: 'a', 1.0: 'b', True: 'c'}",
          "print(d[1])"
        ],
        lang: "python",
        answer: "c",
        accept: ["'c'", "\"c\""],
        explanation: [
          "**정답: c** `1 == 1.0 == True`이고 세 값의 [[hashable|해시값]]도 같으므로 딕셔너리는 이들을 **같은 키**로 본다. 키는 처음 들어온 `1`이 유지되고 값은 뒤에 오는 것으로 계속 덮어써져 최종 `{1: 'c'}`. 따라서 `d[1]`은 `'c'`, `len(d)`는 1.",
          "`True`는 `int`의 서브클래스(`bool`)라 `True + 1 == 2`, `sum([True, False, True]) == 2`가 성립한다. 조건을 만족하는 개수를 `sum(x > 0 for x in xs)`로 세는 관용구가 여기서 나온다.",
          "",
          "시험에서는 `{True: 'a', 1: 'b'}`의 `len`, `set([1, True, 1.0])`의 길이, `'1'`(문자열)은 별도 키라는 점을 섞어 묻는다. [[identity|`is`]]와는 무관하게 `==`와 `hash` 기준으로 키가 합쳐진다는 것이 핵심이다."
        ],
        terms: ["hashable", "identity"]
      }
    ],

    /* ──────────────────────────── 실습 과제 ──────────────────────────── */
    practices: [
      {
        id: "b-1-p01", node: "b-1",
        title: "조건을 만족하는 점수 개수 세기",
        difficulty: 1,
        task: [
          "`random.seed(7)`로 만든 50개 점수 리스트 `scores`에서 **80점 이상**인 점수의 **개수**를 정수로 입력하시오.",
          "pandas 없이 순수 Python(컴프리헨션 또는 `sum`)으로 구한다."
        ],
        setup: [
          "import random",
          "random.seed(7)",
          "scores = [random.randint(40, 100) for _ in range(50)]",
          "scores[:10]"
        ],
        hint: [
          "`sum(1 for s in scores if s >= 80)` 또는 `len([s for s in scores if s >= 80])`.",
          "`sum(s >= 80 for s in scores)`처럼 불리언을 바로 더해도 된다 (`True == 1`)."
        ],
        answer: { type: "int", value: 10 },
        solution: ["sum(1 for s in scores if s >= 80)"],
        explanation: [
          "조건을 만족하는 원소 수는 [[comprehension|컴프리헨션]]으로 필터링한 뒤 `len`을 재거나, [[generator|제너레이터 표현식]]을 `sum`에 넘겨 메모리 없이 센다.",
          "`sum(s >= 80 for s in scores)`가 동작하는 이유는 `bool`이 `int`의 서브클래스이기 때문이다([[truthiness|진릿값]] True == 1). 같은 시드(`random.seed(7)`)면 `randint` 결과가 재현된다."
        ],
        terms: ["comprehension", "generator", "truthiness"],
        verified: { by: "python", at: "2026-10-04", env: "python 3 / numpy 2.4.6" }
      },
      {
        id: "b-1-p02", node: "b-1",
        title: "카테고리별 합계가 가장 큰 카테고리의 평균 거래액",
        difficulty: 2,
        task: [
          "거래 기록 리스트 `records`(각 원소는 `{'cat': 카테고리, 'amount': 금액}` 딕셔너리)에서 **카테고리별 금액 합계**를 구하고, 합계가 **가장 큰 카테고리**의 **평균 거래액**(그 카테고리 합계 ÷ 건수)을 소수 둘째 자리까지 반올림해 입력하시오.",
          "pandas 없이 `collections.defaultdict` 또는 일반 dict로 집계한다."
        ],
        setup: [
          "import random",
          "from collections import defaultdict",
          "random.seed(2024)",
          "cats = ['food', 'transport', 'housing', 'leisure', 'health']",
          "records = [{'cat': random.choice(cats), 'amount': random.randint(1000, 30000)} for _ in range(120)]",
          "records[:3]"
        ],
        hint: [
          "`total = defaultdict(int); count = defaultdict(int)` 두 개를 한 루프에서 누적한다.",
          "합계가 최대인 키는 `max(total, key=total.get)`.",
          "평균은 `total[top] / count[top]`를 `round(..., 2)`."
        ],
        answer: { type: "number", value: 16634.69, decimals: 2 },
        solution: [
          "total = defaultdict(int)",
          "count = defaultdict(int)",
          "for r in records:",
          "    total[r['cat']] += r['amount']",
          "    count[r['cat']] += 1",
          "top = max(total, key=total.get)",
          "round(total[top] / count[top], 2)"
        ],
        explanation: [
          "[[defaultdict|defaultdict(int)]]는 없는 키를 0으로 시작하므로 `if key in d` 검사 없이 `+=`로 누적할 수 있다. 같은 일을 `dict.get(k, 0) + v` 또는 [[counter|Counter]]로도 할 수 있다.",
          "`max(dict, key=dict.get)`은 값이 최대인 **키**를 돌려주는 관용구다. 합계가 가장 큰 카테고리는 `transport`(39건, 648,753)이며 평균은 16634.69. 이 집계는 pandas의 `df.groupby('cat')['amount'].agg(['sum', 'mean'])`에 정확히 대응한다."
        ],
        terms: ["defaultdict", "counter", "lambda"],
        verified: { by: "python", at: "2026-10-04", env: "python 3 / numpy 2.4.6" }
      }
    ],

    /* ──────────────────────────── 용어 ──────────────────────────── */
    terms: [
      { id: "mutable", ko: "가변 객체", en: "mutable",
        def: "생성 후 내용을 바꿀 수 있는 객체. list, dict, set이 대표적이며 제자리 변경 메서드를 가진다.",
        nodes: ["b-1", "b-1-2"], related: ["immutable", "shallow-copy", "default-argument"] },
      { id: "immutable", ko: "불변 객체", en: "immutable",
        def: "생성 후 내용을 바꿀 수 없는 객체. int, float, str, tuple, frozenset이 해당하며 변경 연산은 항상 새 객체를 만든다.",
        nodes: ["b-1", "b-1-2"], related: ["mutable", "hashable"] },
      { id: "hashable", ko: "해시 가능", en: "hashable",
        def: "수명 동안 변하지 않는 해시값을 가져 dict 키와 set 원소로 쓸 수 있는 성질. 불변 객체는 대체로 해시 가능하다.",
        nodes: ["b-1", "b-1-2"], related: ["immutable", "identity"] },
      { id: "shallow-copy", ko: "얕은 복사", en: "shallow copy",
        def: "바깥 컨테이너만 새로 만들고 내부 원소 객체는 원본과 공유하는 복사. 슬라이스 [:], list(), copy()가 해당한다.",
        nodes: ["b-1"], related: ["deep-copy", "mutable"] },
      { id: "deep-copy", ko: "깊은 복사", en: "deep copy",
        def: "중첩된 내부 객체까지 재귀적으로 전부 새로 만들어 원본과 완전히 독립시키는 복사. copy.deepcopy()로 수행한다.",
        nodes: ["b-1"], related: ["shallow-copy"] },
      { id: "identity", ko: "동일성", en: "identity (is)",
        def: "두 이름이 메모리상 같은 객체를 가리키는지 여부. is 연산자와 id()로 확인하며 값의 동등성(==)과 구별된다.",
        nodes: ["b-1", "b-1-2"], related: ["hashable", "mutable"] },
      { id: "default-argument", ko: "기본 인자", en: "default argument",
        def: "함수 정의 시 매개변수에 지정하는 기본값. 함수가 정의될 때 한 번만 평가되어 모든 호출이 같은 객체를 공유한다.",
        nodes: ["b-1"], related: ["mutable", "scope"] },
      { id: "slicing", ko: "슬라이싱", en: "slicing",
        def: "시퀀스에서 [start:stop:step] 형식으로 부분 범위를 꺼내는 연산. stop은 포함하지 않으며 범위를 넘어도 예외 없이 잘린다.",
        nodes: ["b-1", "b-1-2"], related: ["immutable", "unpacking"] },
      { id: "comprehension", ko: "컴프리헨션", en: "comprehension",
        def: "반복과 조건을 한 식으로 써서 list, dict, set을 만드는 구문. [식 for 변수 in 이터러블 if 조건] 형태다.",
        nodes: ["b-1", "b-1-2"], related: ["generator", "iterator"] },
      { id: "generator", ko: "제너레이터", en: "generator",
        def: "값을 미리 만들지 않고 요청될 때마다 하나씩 생산하는 지연 평가 이터레이터. yield 함수 또는 소괄호 표현식으로 만들며 한 번만 순회할 수 있다.",
        nodes: ["b-1"], related: ["iterator", "comprehension"] },
      { id: "iterator", ko: "이터레이터", en: "iterator",
        def: "next()로 원소를 하나씩 꺼내는 객체. map, filter, zip 등이 반환하며 길이가 없고 한 번 소진되면 재사용할 수 없다.",
        nodes: ["b-1", "b-1-2"], related: ["generator", "itertools"] },
      { id: "lambda", ko: "람다", en: "lambda",
        def: "이름 없이 식 하나로 정의하는 익명 함수. sorted, max, map 등의 key 인자로 자주 쓴다.",
        nodes: ["b-1", "b-1-2"], related: ["stable-sort", "closure"] },
      { id: "closure", ko: "클로저", en: "closure",
        def: "바깥 함수의 지역 변수를 기억해 바깥 함수가 끝난 뒤에도 그 변수에 접근하는 내부 함수. nonlocal로 그 변수를 수정할 수 있다.",
        nodes: ["b-1", "b-1-2"], related: ["scope", "lambda"] },
      { id: "scope", ko: "스코프(LEGB)", en: "scope / LEGB rule",
        def: "이름을 찾는 범위와 순서. Local, Enclosing, Global, Built-in 순으로 탐색하며 global·nonlocal 키워드로 대입 대상을 바꾼다.",
        nodes: ["b-1-2"], related: ["closure", "default-argument"] },
      { id: "exception", ko: "예외", en: "exception",
        def: "실행 중 발생하는 오류를 나타내는 객체. try/except/else/finally로 처리하며 ValueError, TypeError, KeyError, IndexError 등 계층을 이룬다.",
        nodes: ["b-1", "b-1-2"], related: ["mutable", "json"] },
      { id: "counter", ko: "카운터", en: "collections.Counter",
        def: "이터러블 원소의 빈도를 세는 dict 서브클래스. most_common(n)으로 빈도 상위 n개를 (원소, 횟수) 리스트로 얻는다.",
        nodes: ["b-1", "b-1-2"], related: ["defaultdict", "deque"] },
      { id: "defaultdict", ko: "기본값 딕셔너리", en: "collections.defaultdict",
        def: "없는 키를 조회하면 지정한 팩토리(int, list 등)로 기본값을 만들어 넣는 dict 서브클래스. 그룹별 누적에 쓴다.",
        nodes: ["b-1"], related: ["counter", "deque"] },
      { id: "deque", ko: "덱", en: "collections.deque",
        def: "양쪽 끝에서 O(1)로 삽입·삭제할 수 있는 양방향 큐. appendleft/popleft를 제공하고 maxlen으로 고정 길이 창을 만든다.",
        nodes: ["b-1-2"], related: ["counter", "defaultdict"] },
      { id: "itertools", ko: "itertools", en: "itertools",
        def: "순열(permutations), 조합(combinations), 데카르트 곱(product), 연속 그룹(groupby), 누적(accumulate) 등 이터레이터 도구를 모은 표준 모듈.",
        nodes: ["b-1", "b-1-2"], related: ["iterator", "generator"] },
      { id: "f-string", ko: "f-문자열", en: "f-string / format specifier",
        def: "f'...{식:서식}' 형태로 값을 문자열에 끼워 넣는 서식 문자열. 콜론 뒤에 :,.2f, :>10, :.1% 같은 서식 지정자를 둔다.",
        nodes: ["b-1", "b-1-2"], related: ["floating-point"] },
      { id: "floating-point", ko: "부동소수점", en: "floating point",
        def: "실수를 이진 가수와 지수로 근사 표현하는 방식(IEEE 754). 0.1처럼 정확히 표현되지 않는 값이 있어 == 비교에 오차가 생긴다.",
        nodes: ["b-1", "b-1-2"], related: ["f-string"] },
      { id: "truthiness", ko: "진릿값", en: "truthiness",
        def: "객체를 불리언 문맥에서 평가한 참·거짓. 0, None, 빈 컨테이너, 빈 문자열은 거짓이고 그 외는 참이다.",
        nodes: ["b-1", "b-1-2"], related: ["iterator"] },
      { id: "unpacking", ko: "언패킹", en: "unpacking",
        def: "시퀀스의 원소를 여러 변수에 한 번에 나누어 대입하는 구문. *rest로 남은 원소를 리스트로 받고 함수 호출에서는 *args, **kwargs로 펼친다.",
        nodes: ["b-1-2"], related: ["slicing"] },
      { id: "stable-sort", ko: "안정 정렬", en: "stable sort",
        def: "정렬 키가 같은 원소의 상대적 순서를 입력 순서대로 유지하는 정렬. Python의 sorted와 list.sort는 안정 정렬이다.",
        nodes: ["b-1", "b-1-2"], related: ["lambda", "counter"] },
      { id: "strftime", ko: "날짜 서식 변환", en: "strftime / strptime",
        def: "strftime은 datetime을 %Y-%m-%d 같은 포맷 코드로 문자열로 만들고, strptime은 반대로 문자열을 datetime으로 해석한다.",
        nodes: ["b-1-2"], related: ["f-string"] },
      { id: "json", ko: "JSON 직렬화", en: "json module",
        def: "Python 객체와 JSON 문자열을 서로 바꾸는 표준 모듈. load/loads는 JSON을 읽고 dump/dumps는 쓰며 s가 붙으면 문자열 대상이다.",
        nodes: ["b-1-2"], related: ["exception"] }
    ]
  });
})();
