# ds-level2 — 검증 보고서 (review)

- 검증일: 2026-10-05
- 검증 환경: Linux 컨테이너, Playwright 번들 Chromium 141(헤드리스), Node 22, Python 3.11 + pandas 3.0.6 / numpy 2.4.6 / scikit-learn 1.9.1 / scipy 1.17.1 / statsmodels 0.15.0, nbformat 5.x(검증 중 설치). `http://localhost:8000/apps/ds-level2/index.html` 과 `file:///…/apps/ds-level2/index.html` 양쪽.
- 검증 방식: 코드 정독 + 브라우저 자동화 하네스(123개 체크, 스크린샷 14장) + `window.__DS2` 순수 함수 직접 호출 + `tools/validate.js`·`verify_practice.py` 전체 재실행 + 412문제 전수 기계 검사 + 출력 예측(output) 문제 152개 전부 실제 실행 + 노드당 2문제(62개) 사람 눈 표본 검사 + 파일당 1개 실습(11개)을 과제 문장만 보고 직접 풀이.

## 요약

**전체 판정: 통과(수정 6파일 반영 후)**

- 엔진: 하네스 123/123 통과, 콘솔 에러 0, 외부 요청 0, `file://` 동작, 노트북 4종 `nbformat.validate` 통과. 엔진 코드 수정 0건.
- 콘텐츠: `validate.js` ERRORS 0, `verify_practice.py` 62/62 PASS, output 문제 152/152 실행 결과가 정답과 일치, bug 문제의 "오류가 난다" 전제 27/27 실제 재현(1건 numpy 버전 의존 → 수정). 표본 62문제 중 결함 3건(복수 정답 가능 1, 버전 의존 전제 1, 해설 서술 오류 1) 발견·수정. 용어 정의 충돌 118건 중 **의미가 다른 5개 id(8건)** 를 통일해 110건(문구 차이만)으로 줄임.
- 실습 11개를 학습자처럼 풀어 전부 일치. 과제 문장 수정 필요 없음.
- 추가 검증(2026-10-08): pandas 2.x 환경에서 실습 62/62 PASS. 아래 "남은 리스크" 1.
- 못 한 것: iOS 실기기, 실제 Jupyter GUI 열기(스키마 검증으로 대체), output 문제의 pandas 2.x 재실행. 아래 "남은 리스크".

## A. 엔진 검증

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | `validate.js` 전체 | **통과** | ERRORS 0 / WARNINGS 113 (용어 충돌 110 + `a-3-2-p01/p02` 시드 없음(sklearn 내장 데이터라 무시 가능) 2 + `b-3` 실습 난이도 {2,3} 권장 이탈 1) |
| 2 | 실습 전수 재실행 | **통과** | `extract_practice.js` 62개 추출 → `verify_practice.py` PASS 62 / FAIL 0 / ERROR 0 (수정 후 재실행도 62/62) |
| 3 | 부팅·라우트 | **통과** | 콘솔 에러 0, `DS2.warnings` 110(전부 term-conflict), 전역 `DS2`·`__DS2` 뿐. `#/`, `#/tree`, `#/topic/a-1-1`, `#/topic/a-2-3/quiz`, `#/topic/b-1-2`, `#/wrong`, `#/review`, `#/exam`, `#/glossary`, `#/settings` 모두 렌더. `#/topic/zzz` → `#/` + 토스트 "없는 주소입니다". 트리에 학습 노드 31개, 제목 31개가 `.claude/tasks/ds-level2-plan.md` 색인과 글자 단위 일치 |
| 4 | 퀴즈 세션·진도·오답 | **통과** | a-1-1 12문제 완주(앞 2개 고의 오답): 세션 완료 83%, `apps.ds-level2.progress.v1` 에 12건, 오답 `{box:1, due:오늘+1, last:false}`, 정답 `{box:2, due:오늘+3}`, 카드 열람 기록, 노드 상태 `done`. `#/wrong` 에 2건 표시 → 읽기 모드 동작 → "전부 다시 풀기"로 맞히면 목록에서 사라지고 `{box:2, correct:1, wrong:1}` |
| 5 | 순수 함수 단위 | **통과 48/48** | grader: mcq/ox/short 각 3+, `" Transform() "`·따옴표 정규화, number `5231.474`→정답·`5231.5`→오답·`5,231.47`·`abc`→invalid, int `"42.0"`·`" 42 "` 정답·`42.5`·`43` 오답, string accept. leitner: 첫 오답→상자1·내일, 첫 정답→상자2·+3일, 연속 정답→3(+7일)→4(졸업, due null, 복습 제외), 졸업 후 오답→상자1. nodeStatus: 10/12+카드=done, 카드 없음=learning, 9/12=learning, 미시도 있음=learning, check 노드는 카드 없이 done. exam: 20/40 모두 중복 없음·노드 편중 ≤3(실측 max 1·2), seed 재현, 다른 seed 상이, 범위 a-1 → a-1-x만, b-1(32문제)에 40 요청 → 32, grade 의 노드별 합계 = 총점 |
| 6 | 모의고사 | **통과** | 20문제·타이머 1200초 세션 저장(`sessionStorage`), 상단바 `1/20 · 20:00`, 10문제 답한 뒤 새로고침 → `idx 10 / 10 답함 / 번호 그리드 10개 채움` 복구, 이전 답 재표시, 미응답 제출 시 2단계 토스트 확인 후 결과(7/20, 노드별 합계 = 7, 출제 합계 = 20, 문제별 검토 20개, exam 기록 10건 `source:'exam'`), "같은 문제로 다시" → 동일 id 순서, `startedAt` 을 과거로 돌려 새로고침 → 자동 제출 + `timeUp` + "시간 종료 자동 제출" 표기, 40문제·2400초·노드 편중 ≤2, 잔여 50초 → `urgent` 클래스 + "1분 남았습니다" 토스트·라이브 영역 |
| 7 | `.ipynb` | **통과** | 토픽(a-2-3, 10셀) / 챕터(a-2, 79셀, 모범 답안 포함 18개 `<details>`) / 파트B 토픽(b-1) / 파트 전체(a, 178셀) 생성, check 노드는 null. 4개 모두 `nbformat 4.5`, 셀 id 유일·형식 적합, code 셀 `execution_count:null`·`outputs:[]`·source 문자열, **`nbformat.validate` 통과**. 버튼 클릭 시 `download` 이벤트 `ds-level2_a-2-3.ipynb` 발생 |
| 8 | 저장소 | **통과** | 내보내기 JSON(`app`, `progress.version`) → 초기화 후 덮어쓰기 가져오기 = 원본과 동일; 병합은 문제별 `at` 최신 채택(로컬이 최신이면 유지, 오래되면 교체, 없던 건 복원), 백업 키 기록, UI 가져오기 "병합 완료" 메시지. 손상 JSON `"abc"` → 빈 진도 + `progress.corrupt` 보관 + 설정 경고 문구, 콘솔 에러 0. `localStorage` getter 가 throw 하도록 오버라이드 → 앱 동작, `store.ok=false`, 설정에 "이 브라우저에서는 진도가 저장되지 않습니다", 퀴즈 채점은 메모리에 기록, 콘솔 에러 0. 초기화 2단계 버튼, 테마 토글이 설정 키에 저장 |
| 9 | 뷰포트·테마·임베드 | **통과** | 360×640 홈/트리, 390×844 요약/퀴즈/실습, 1280 홈/트리/모의고사, 다크(`?theme=dark`, `prefers-color-scheme`), 임베드 320×427 홈/퀴즈 — 14장 (`scratchpad/shots/`). 가로 스크롤 0건, `.view` 하단 패딩 80px ≥ 탭바 56px, 퀴즈 중 `html[data-session]` 으로 탭바 `display:none`, 코드 `<pre>` 전부 `overflow-x:auto`(요약 카드 6개 블록이 실제 가로 스크롤), 임베드 홈은 탭바 대신 햄버거 + "전체 화면으로 열기 ↗"(`target=_top`, 해시 유지), 부모 페이지 iframe(`?embed` 없이) 에서도 `self!==top` 감지 + 부모 scrollY 불변. 대비: 밝은 테마 4표본·어두운 테마 7표본(정답/오답 라인·보기·코드 토큰·muted) 모두 ≥ 4.5:1 (최저 5.48) |
| 10 | 자체 완결 | **통과** | `fetch(`·`type="module"`·`../`·`http(s)://` 참조 0건(index/js/css/data). 네트워크 로그 외부 요청 0건, `file://` 에서 11파일 등록·412문제·62실습·313용어 로드, 복사 버튼 "복사됨". `data/_sample.js` 삭제됨·`index.html` 태그 없음. `git status`: 블로그 본체 무변경, `.nojekyll` 존재(0바이트) |
| 11 | 접근성 | **통과** | 키보드만으로 mcq 1문제(숫자키 → Enter 채점 → Enter 다음) 완료, 채점 후 포커스 [다음], 정답 보기 `data-state="correct"` + `aria-label="정답: …"`. `role="radiogroup"`/`role="radio"`, `aria-live="polite"` 라이브 영역에 "정답입니다", `:focus-visible` 규칙, 아이콘 버튼 3개 전부 `aria-label`, `lang="ko"`, `user-scalable=no` 없음. 용어 시트: 열림 → Esc 닫힘 → 포커스 원래 버튼으로 복귀 |

## B. 콘텐츠 검증

### 12. 표본 62문제(노드당 2, 시드 20261005) — 3건 수정

- 기계 검사(412문제 전수): 해설 60자 이상, 첫 줄 `정답` 명시, `[[term]]` 링크 ≥1, mcq 해설에 원문자 ①②③④ 3개 이상, "시험" 출제 경향 문장, short 정답 1토큰 — **위반 0건**.
- 사람 검사 62문제: 정답 정확성(코드는 실행), 오답 보기별 이유, 한글(영문) 병기, 시험 지문 톤, 복수 정답 가능성, pandas 2.x 차이. 결과 59개 이상 없음, 3개 수정:

| id | 파일 | 원인 | 수정 |
|---|---|---|---|
| `a-2-5-q07` | `a2-pandas-2.js` | 보기 ③ "`tz_localize('Asia/Seoul')`은 시각 값은 그대로 두고 시간대 정보만 붙인다"가 **사실상 참**이라 "옳은 설명은?"에 복수 정답 가능(해설도 "문장 자체는 맞지만"이라고 인정) | 보기 ③을 명백한 오답("시각 값을 UTC 기준으로 9시간 앞당겨 바꾼다")으로 교체, 해설 ③ 항목을 그에 맞게 수정 |
| `a-3-3-q06` | `a3-libs-1.js` | 전제 "80점 미만 행에 `0`이 들어갔다(`['A','B','0']`)"는 numpy 1.x 동작. **numpy 2.x 에서는 `TypeError: Choicelist and default value do not have a common dtype`** 가 나서(검증 환경 2.4.6 에서 재현) 전제가 틀림 | 프롬프트·코드 주석·해설 첫 줄에 numpy 1.x/2.x 양쪽 현상을 적고 원인(`default` 누락)은 같다고 명시. 정답 ③ 유지 |
| `b-2-2-q14` | `b2-pandas.js` | 해설 "기본으로 수치형 컬럼만 대상이며(`numeric_only`)" — pandas 2.0부터 `numeric_only=False` 가 기본이라 문자열 컬럼이 있으면 오류 | 2.0 이후 동작과 `numeric_only=True` 사용법으로 서술 교정 |

### 15. 출력 예측(output) 문제 전수 실행 — 152/152 일치

- Python 140개: 스크립트로 `exec`(마지막 표현식은 Jupyter처럼 평가)해 출력을 정답 보기와 정규화 비교 → 자동 일치 132, 나머지 8개는 눈으로 확인(두 줄 출력·반올림·OX 서술형)해 전부 일치.
- SQL 12개: 코드 주석의 표 데이터로 sqlite3 인메모리 DB 를 만들어 실행 → 12/12 정답과 일치.
- 보너스: bug 문제(python 27개)도 전부 실행해 "오류가 난다"는 전제를 확인 — 26개 재현, 1개(`a-3-3-q06`)는 위와 같이 버전 의존이라 수정.

### 13. 용어 정의 충돌 — 118건 → 110건

- 118건 전부 읽음. 대부분 같은 뜻을 다른 문장으로 쓴 것(선등록 유지로 충분).
- **의미가 달라 통일한 id 5개(8건)**: 모든 관련 파일의 `ko/en/def` 를 같은 문자열로 맞춤(선등록 파일 포함).
  - `pivot` (a1-sql vs a2-pandas-1, b2-pandas): SQL 교차표 설명 vs pandas `pivot` 메서드(집계 없음·중복 시 ValueError). 선등록(a1-sql)에는 "pandas 는 pivot_table 을 쓴다"고 되어 있어 pandas 문제에서 `[[pivot]]` 을 탭하면 오해 소지 → `pivot`/`pivot_table`/SQL CASE WHEN 을 모두 담은 정의로.
  - `rank` (a1-sql vs a2-pandas-1, b2-pandas): 선등록이 SQL `RANK()`(1,1,3) 전용이고 ko/en 도 "RANK/RANK()" → pandas 문제 칩에 "RANK"로 표시됨. SQL RANK 와 pandas `rank(method=…)`(기본 average) 를 함께 설명하는 정의, ko "순위", en "rank / RANK()".
  - `window-function` (a1-sql vs a3-libs-1): SQL `OVER()` 전용 vs pandas rolling/shift → 양쪽을 포괄.
  - `imputation` (a2-pandas-1 vs a3-libs-1): pandas fillna 전용 vs sklearn `SimpleImputer` 전용 → 둘 다 포함.
  - `interpolation` (a2-pandas-1 vs a2-pandas-2, a3-libs-2): pandas linear 전용 / `method='time'` / scipy `interp1d` → 통합.
- 남은 110건은 문구 차이(예: `missing-value` 4건, `boolean-indexing` 4건, `precision`·`recall`·`f1-score` 등). 선등록 정의가 쓰이며 의미 손실 없음.

### 14. 실습 11개 학습자 풀이 — 11/11 일치

파일당 1개(난이도 높은 것 우선: `a-1-4-p02`, `a-2-3-p03`, `a-2-6-p03`, `a-3-4-p02`, `a-3-7-p02`, `a-4-4-p03`, `b-1-p02`, `b-2-p02`, `b-3-p02`, `b-4-p02`, `b-5-p02`)를 **task 문장만 보고** setup 셀을 실행한 뒤 직접 코드를 짜서 값을 구함. 11개 모두 앱의 `answer`·`decimals` 규칙으로 정답(예: `a-3-4-p02` 0.9789 → 2자리 0.98, `a-1-4-p02` SQL 윈도/pandas transform 양쪽 98). task 문장이 모호해 다른 값이 나올 여지가 있는 과제 없음(`min_periods` 기본값, `ddof=1`, `fill_value=0`, 반올림 자릿수가 전부 명시됨).

## 수정 내역 (파일 단위)

| 파일 | 변경 |
|---|---|
| `data/a2-pandas-2.js` | `a-2-5-q07` 보기 ③·해설 ③ 교체; 용어 `interpolation` 정의 통일 |
| `data/a3-libs-1.js` | `a-3-3-q06` 프롬프트·코드 주석·해설(numpy 1.x/2.x); 용어 `window-function`, `imputation` 정의 통일 |
| `data/b2-pandas.js` | `b-2-2-q14` 해설(`numeric_only`) 교정; 용어 `pivot`, `rank` 정의 통일 |
| `data/a1-sql.js` | 용어 `window-function`, `rank`(ko/en 포함), `pivot`(ko/en 포함) 정의 통일 |
| `data/a2-pandas-1.js` | 용어 `imputation`, `interpolation`, `pivot`, `rank` 정의 통일 |
| `data/a3-libs-2.js` | 용어 `interpolation` 정의 통일 |

엔진(`index.html`, `style.css`, `js/*`, `tools/*`)과 `spec.md`, 블로그 본체는 수정하지 않았다. 수정 후 `validate.js` ERRORS 0 / WARNINGS 113, `verify_practice.py` 62/62, output 문제 152/152, 브라우저(http·file://) 콘솔 에러 0·`DS2.warnings` 110 을 재확인했다.

## 스크린샷 확인 요약 (`scratchpad/shots/`, 저장소에는 넣지 않음)

- `m360_home`, `m360_tree`: 진도 링·"이어서 학습"·오늘 복습/오답 타일·파트 바가 360px 안에 들어가고 하단 탭바(홈/트리/복습/사전/더보기)가 콘텐츠를 가리지 않음.
- `m390_card`: 요약 카드의 용어 링크(점선 밑줄)·핵심 개념 목록·코드 패턴 아코디언, 긴 코드 줄은 가로 스크롤.
- `m390_quiz`, `m360_quiz_output`: 퀴즈 중 탭바 숨김, 상단에 `1/12`·[종료], 보기 번호 1~4, 채점 후 해설·용어 칩·"상자 2 · 다음 복습 날짜"·[다음 →]. 코드 블록 우상단 [복사] 버튼이 첫 줄 끝을 덮지만 `padding-right: 3.6rem` 이 있어 스크롤하면 읽힌다(결함 아님).
- `d1280_*`: 데스크톱 사이드바 7개 메뉴 + 48rem 본문.
- `dark_390_*`: `#121417` 배경, 정답 초록·코드 토큰 대비 충분.
- `embed_320x427*`: 컴팩트 홈(작은 링·이어서 학습·타일) + 햄버거, 전체 화면 링크.

## 남은 리스크 / 검증하지 못한 것

1. **pandas 2.x 재검증 — 실습은 완료, output 문제는 미실시.** 2026-10-08 사용자 데스크톱(Windows, Anaconda Python 3.13.5 + pandas 2.2.3 / numpy 2.1.3 / scikit-learn 1.6.1 / scipy 1.15.3 / statsmodels 0.14.4)에서 `verify_practice.py` 를 돌려 **62/62 PASS**(FAIL·ERROR 0). 걱정했던 sklearn 기반 `a-3-4-p02`(0.98), `a-4-2-p01~p03`, `a-4-3-p01~p03` 도 값이 같다. output 문제 152개는 이 환경에서 다시 돌리지 않았다(전용 도구 없음). 아래는 최초 Review 때의 기록이다. 컨테이너에 pandas 3.0.6 만 있고 오프라인이라 2.x 를 설치하지 못했다. 코드를 정독한 범위에서 3.0 특유 동작(CoW, `str` dtype 표기, `observed` 기본값, `'ME'` 별칭)에 정답이 의존하는 문제·실습은 없고 빈도 별칭은 `'D'`, `'W'`, `'MS'`, `'W-MON'`, `to_period('M')` 만 쓴다. 다만 실습 62개 값은 사용자의 데스크톱 Jupyter(pandas 2.x)에서 `node tools/extract_practice.js > p.json && python tools/verify_practice.py p.json` 으로 한 번 돌려 보기를 권한다. 특히 sklearn 모델 기반(`a-3-4-p02` 0.98, `a-4-3-*`, `a-4-2-*`)은 버전에 따라 소수 셋째 자리가 흔들릴 수 있다(앱 설정 화면의 "미검증 실습" 표시는 현재 0).
2. numpy 1.x 사용자에게는 `a-3-3-q06` 의 두 현상 중 "`'0'`이 들어간다"가, 2.x 사용자에게는 TypeError 가 보인다 — 프롬프트에 둘 다 적어 두었다.
3. 용어 충돌 110건은 문구 차이로 남겨 두었다. 사전에서는 선등록 파일의 정의가 보이며, 관련 노드·관련 용어는 합집합으로 병합된다.
4. 실기기 미검증: iOS Safari 의 Blob 다운로드(새 탭 열림)·홈 화면 추가, Android Chrome 숫자 키패드(`inputmode="decimal"` 은 마크업으로 확인). 실제 Jupyter GUI 로 노트북을 열지는 못했고 `nbformat.validate` 와 구조 검사로 대체했다.
5. 표본 검사는 62/412 문제다. output/bug 문제(179개)는 코드 실행으로 전수 확인했지만 concept/fill 문제(233개)의 사실 관계는 표본 외에는 기계 검사(형식)만 거쳤다.
