# Build 보고서 — 9c-1c: `sk-` 왼쪽 경계 틈 막기 (2026-11-17)

> 지침 `.claude/tasks/medreader-build-9c1c-fix.md` · 근거 `apps/medreader/review.md` "9c-1b 재검증"(9c1bR-0~8). 커밋 0 · headless 0 · 서버 0.

## 고친 것 (전 → 후) — `js/config.js` `BACKUP.KEY_PATTERNS` 두 줄만

| # | 전 | 후 |
|---|---|---|
| 1 중간-1 `sk-` | `(?<![A-Za-z0-9\-])sk-[A-Za-z0-9_\-]{20,}` — 앞 한 글자만 봄 → `%20`·`%3D`·`%22`·`%3A`·`Bearer%20`·글자 그대로 `\n`·`\t`·`\u0022` 뒤 진짜 길이 키를 놓침 | `(?:(?<![A-Za-z0-9\-])\|(?<=%[0-9A-Fa-f]{2})\|(?<=\\[nrtbf"'/])\|(?<=\\u[0-9A-Fa-f]{4}))sk-[A-Za-z0-9_\-]{20,}` — Review (a)안 그대로 |
| 2 낮음-2 `Bearer` 토큰 | 숫자 하나 이상 + 12자 이상 | 숫자 든 12자 이상 **또는** 20자 이상(`(?:(?=T*[0-9])T{12,}\|T{20,})`, T = b64token 글자) |
| 3 낮음-4(선택 — 넣음) | `Bearer\s+` 만 | `[Bb][Ee][Aa][Rr][Ee][Rr](?:\s+\|%20\|:\s*)` — 대소문자 무시·`%20`·`:` 뒤. 정상 글 보존 시험 그대로 통과라 넣음 |
| 낮음-3 | `search.recent` 항목 안 진짜 줄바꿈·탭 뒤 `sk-` → 행 남음 | 1번으로 함께 막힘 — 행째 빠짐(확인: 탐침 escapeRows `\n`·`\t` 모두 rowDropped, K4b 한 줄) |

주석에 `[9c-1c — 9c1bR #1·#2·#4]` 문단 추가. `REDACT_PATTERNS`·`js/privacy/` 무변(고치기 전 사본과 `diff` — 920–929행만 다름 · `git diff --exit-code -- js/privacy/` 0).

## 시험 (`tests/backup-9c.test.mjs` K4b 에 줄 추가 — 시험 수 그대로)
- `%20sk-…` · 글자 그대로 `{"k":"x\nsk-…"}` · `\u0022sk-…\u0022` → `[KEY]`
- `search.recent` 항목 `'x\n' + sk-proj-…` → 행째 빠짐(낮음-3 확인)
- `Bearer ` + 숫자 없는 32자 → `[KEY]`
- `bearer `·`BEARER `·`Bearer%20`·`Bearer:` + 토큰 → `[KEY]`
- 정상 글 keep 셋 추가: `bearer bonds and other instruments`·`BEARER of the mutation`·`the stretcher-bearer-team-of-four`(기존 "the Bearer of the results"·"Bearer responsibilities apply" 등 그대로 통과)

## 검증
- **가짜 키 2,700 조합**(`b9c1c/probe.mjs` — Review `r9c1b/probe.mjs` 와 같은 씨앗·접두 45·접미 6·키 10꼴, 9c-1 판 `r9c1b/old-backup.mjs` 와 나란히):
  - 전: 9c-1 판이 막던 것 중 샘 804(진짜 길이·몸통 20/21 꼴 **546** = 7꼴 × 13접두 × 6, 나머지 258 = `sk-` 몸통 19 — 정보 #7)
  - 후: 샘 450 — 진짜 길이·20/21 꼴 **210** = 7꼴 × **5접두(`-`·`a`·`Z`·`9`·`api-key-` — 영숫자·하이픈에 바로 붙은 꼴뿐)** × 6, 나머지 240 = 몸통 19(정보 #7, 하한 20 그대로; `Bearer`·`bearer`·`BEARER`·`Authorization: Bearer`·`Bearer%20` 접두 다섯은 Bearer 갈래가 지워 43→40 묶음). 두 판 모두 새는 것 0.
  - Bearer 표: 숫자 없는 32·40자 → 지움(전 남음) · `bearer `·`BEARER `·`Bearer%20`·`Bearer:` 뒤 12자+ 숫자 토큰·JWT·32/40자 → 지움(전·9c-1 모두 남음). 남는 것: 11자 이하, 숫자 없는 12–19자, b64token 밖 글자(`:`·`%2B`)가 앞 12자 안에 든 토큰(9c-1b 와 같음).
- **정상 글 61개**: 전 57 · 후 **57**(같은 4개만 지움 — `sk-n-sh-cells-…`·`Bearer 2023-…`·`Bearer BRCA1-…`·`Bearer HLA-B27-…`, 9c-1 판도 같음). `search.recent` 정상 30개 행 남음.
- **CMDT 2026 본문**(`p14/pt-cmdt26.json` 읽기만, 수만): 글 318,943 · 12,768,741자 — 걸림 **0**(AIza 0 · AQ 0 · Bearer 0 · sk 0, 합친 정규식 0). 참고: 대소문자 무시 `bearer` 낱말 자체 0.
- **변이**(`b9c1c/mut.mjs`, 원본 읽어 `b9c1c/bak/` 에 쓰고 1곳일 때만 바꿈 → finally 원본 바이트로 되씀):

| # | 변이 | 빨강 | 복원 |
|---|---|---|---|
| M1 | `sk-` 경계에서 `%XX` 갈래 빼기 | K4b(`%20sk-…` 줄 — actual 에 키 남음) | 바이트 같음 · `cmp config.js bak/M1-js_config.js` 0 |
| M2 | `Bearer` "또는 20자 이상" 갈래 빼기 | K4b(숫자 없는 32자 줄) | 바이트 같음 · `cmp config.js bak/M2-js_config.js` 0 |

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **1회차 1703/1703(10.2초) · 2회차 1703/1703(10.4초)**(`b9c1c/full1.txt`·`full2.txt`).
- `stamp-importmap` 다시 찍음(config.js 해시 `0ea4ad86f9` → `cca20c8a1e`) → `--check` "그대로다 (모듈 78개 · CSS 4개)" · `git diff --check` 0 · `git status` 처음과 같은 목록(+ 이 보고서).
- spec 17-4-1 `[정정 2026-11-17 — 9c-1b]` 줄 뒤에 `[정정 2026-11-17 — 9c-1c]` 한 줄(Edit).

## 남는 것(기록)
- 영숫자·하이픈에 바로 붙은 `abcsk-…`·`api-key-sk-…` 는 합성어(`task-sk-…`)와 구별이 안 돼 남김(Review 와 같은 판단).
- `Bearer` 갈래는 왼쪽 경계가 없어 `cupbearer`·`stretcher-bearer` 뒤에 빈칸 + 20자 넘는 숫자 없는 낱말이 오면 지운다(예: 지어낸 "weight-bearer non-weight-bearing-exercises"). 실물 CMDT 에 `bearer` 0 이라 그대로 둠.

## 실행
명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0). **막힌 명령 0.** 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · 원서 인용 0 · `r9c1b/`·`p14/` 읽기만.

바꾼 파일: `apps/medreader/js/config.js`(`BACKUP.KEY_PATTERNS` + 주석) · `apps/medreader/tests/backup-9c.test.mjs`(K4b 줄 + 머리 주석 한 줄) · `apps/medreader/index.html`(stamp) · `apps/medreader/spec.md`(한 줄). 스크래치 `b9c1c/`: `bak.mjs`·`bak/`(orig-*·M1·M2) · `probe.mjs`·`probe-before.json`·`probe-after.json` · `corpus.mjs`·`corpus.json` · `mut.mjs`·`mut.json`·`m-M1.txt`·`m-M2.txt` · `full1.txt`·`full2.txt`.
