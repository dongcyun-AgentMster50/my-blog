# Build 보고 — 8g-2c 검색 엔진: 읽기 실패가 캐시에 붙는 문제 (2026-10-19)

> 지침 `.claude/tasks/medreader-build-8g-2c.md`. 시작 HEAD `f42f72e`(작업 트리 깨끗). 커밋하지 않았다. 스크래치 `b8g2c/` 만 썼다.

## 1. 고친 두 곳 (`apps/medreader/js/search/engine.js`)

- **ⓐ 채우기 실패 → 캐시를 버린다** (355줄, `ensureLoaded`)
  `c.loading = loadCache(c).catch((e) => { if (cache === c) cache = null; throw dbFailure(e); })`
  거절된 채우기가 캐시에 남지 않는다. 다음 검색이 새 캐시로 다시 읽는다. 서재 전체 검색도 그 책을 "열린 책"으로 보지 않는다.
- **ⓑ 다시 읽기 실패 → 표시를 되돌린다** (172–180줄, `rereadDirty`)
  `withTx` 를 `try/catch` 로 감쌌다. 실패하면 `for (const n of ns) c.dirty.add(n)` 을 하고 다시 던진다. 다음 검색이 그 쪽을 다시 읽는다.
- **오류 코드** (66–69줄, 새 도우미 `dbFailure`)
  두 길 모두 밖으로 나가는 오류를 `db.ERR` 코드로 낸다. 이미 코드가 있으면 그대로 낸다(`DbError`, 할당량 등). 아니면 `new db.DbError(dbErrorCode(e), e)` 로 감싼다. 백엔드 `UnknownError` 는 `ERR_DB_OPEN` 이 되고, 원인은 `cause` 에 남는다.
- 머리 주석에 `[8g-2c]` 두 줄을 더했다(31–32줄).
- 첫 실패 검색은 지금도 reject 한다. 화면이 그것을 잡는 일은 8g-4 몫이라 건드리지 않았다. `error` 접두어, `onPartial` 두 번, P11·P13, spec 도 그대로다.

## 2. 새 테스트 (`tests/search-db-8g.test.mjs`, S6 앞)

- 도우미 `asyncFail`: 비동기 요청 실패를 흉내 낸다(onerror → abort, 탐침과 같은 식). 감싸기는 모두 `try/finally` 로 되돌린다.
- **S13e** 캐시 채우기 `searchText.getAll` 이 한 번 실패한다.
  - 그 검색만 reject 한다. 오류는 `code === ERR_DB_OPEN`, `cause.name === 'UnknownError'` 다.
  - 실패 뒤 `cacheInfo() === null` 이다.
  - 그다음 같은 책 검색 두 번과 `prepareDoc` 은 정상(30)이다.
  - 다시 한 번 실패시킨 직후의 **서재 전체 검색**도 정상(그 책 30적중, 어느 책에도 오류 없음)이다.
  - 복원 뒤 열린 책 검색과 서재(열린 책 먼저)도 정상이다.
- **S13f** `notePage` 표시 뒤 다시 읽기(`searchText.get`, readonly)가 한 번 실패한다.
  - reject `ERR_DB_OPEN` 이다. 실패 뒤에도 `dirty === 1` 로 표시가 남는다.
  - 다음 검색이 새 글자를 찾는다(`newword` → [2]). 옛 글자는 [1,3,4,5]이고, 끝에 `dirty 0` 이다.
- 파일 단독: 35/35(33 + 2).

## 3. 변이 (`b8g2c/mut.mjs` · `mut.log` · `mut-M?.log`)

변이마다 engine.js 한 곳을 바꾸고 검색 DB 테스트 파일을 돌린 뒤 `finally` 로 복원해 바이트를 비교했다. 끝에 `cmp engine.fixed.js` 도 같았다.

| 변이 | 결과 |
|---|---|
| MA ⓐ 되돌림(캐시를 비우지 않음) | 빨강 1 — S13e |
| MB ⓑ 되돌림(표시를 되돌리지 않음) | 빨강 1 — S13f |
| MC 코드로 감싸지 않음(날것 그대로) | 빨강 2 — S13e · S13f |

세 변이 모두 복원 후 바이트가 같다.

## 4. Review 탐침 다시 (`r8g2b/probe.mjs` 를 그대로 실행 → `b8g2c/probe.out`)

Review 출력(`r8g2b/probe.out`)과 항목별로 비교했다. **바뀐 것은 P9·P10 뿐**이고, 나머지 P1·P1b·P2·P3·P8·P11·P12·P13 은 같다.

- **P9**
  - 전: 1·2·3번째 검색, `prepareDoc`, 서재가 모두 reject `UnknownError` 였다.
  - 지금: 첫 검색만 reject `ERR_DB_OPEN` 이다. 2번째(30)·3번째(30)·`prepareDoc`(30)·서재(30)는 정상이다. 다시 실패시키면 그 한 번만 `ERR_DB_OPEN` 이다.
- **P10**
  - 전: 1번째 reject `UnknownError`, 2번째 `[]`(옛 글자로 남음)였다.
  - 지금: 1번째 reject `ERR_DB_OPEN`, 2번째 `[2]`, `dirty 0` 이다.

## 5. 전체 테스트 · 정리

- `node --test --test-timeout=120000 apps/medreader/tests/*.test.mjs`(상한 600초)를 2회 돌렸다. **1128/1128**(1126 + 2), fail 0, cancelled 0(8.1초·8.3초). 로그는 `b8g2c/full-1.log`·`full-2.log` 이다.
- `stamp-importmap.mjs` 로 index.html 의 engine 해시를 `0f4a227872` 에서 `aa92ddb05d` 로 바꿨다. `--check` 는 "그대로다 (모듈 56개 · CSS 4개)"이고 종료 0 이다.
- sha256(`b8g2c/start-sha.txt` → `end-sha.txt`)
  - engine `0f4a2278…` → `aa92ddb0…`
  - 테스트 `93f604de…` → `76ce5e54…`
  - index `0b6e5bd9…` → `90bec177…`
  - 시작 백업은 `b8g2c/bak/` 에 있다.
- 바꾼 레포 파일은 위 3개와 이 보고서뿐이다. spec·review 는 건드리지 않았다.
- 남은 프로세스: 내가 띄운 node 는 모두 끝났다. `tasklist` 의 node 43840 은 이전 보고들이 적은 것(Adobe)으로, 내 것이 아니다.
- 권한·훅에 막힌 명령은 없었다. 커밋, checkout/restore/stash, `rm -rf`, npm, 다운로드는 하지 않았다.

## 6. 남은 문제

- 없다(이번 범위). 첫 실패 검색의 reject 를 화면에서 잡는 일, P11(채우는 중 무효화 세 번 → 조용한 0 적중), P13, spec 문구는 지침대로 8g-4·다음 spec 정리 몫으로 남긴다.
- 참고: 다시 읽기 실패 때 표시는 그 캐시가 이미 무효화됐어도 되돌린다. 무효화된 캐시는 다시 쓰이지 않으므로 해는 없다.
