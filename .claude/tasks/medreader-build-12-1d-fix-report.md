# Build 보고 — 12-1d: 세 기기 수렴 — 같은 시각·다른 값의 결정 규칙

> 지침 `.claude/tasks/medreader-build-12-1d-fix.md` · 근거 `apps/medreader/review.md` "12-1c 재검증" 절. 커밋 0. 스크래치 `b12-1d/`.

## ⚠ 멈춘 곳 (운영자 결정 필요) — 범위 밖 시험 한 줄

전체 시험 2회 모두 **1,852/1,853 — `tests/backup-9c.test.mjs` K10h 한 줄만 빨강**(587행):

```js
assert.equal(R('cards', sc({ updatedAt: 20 }), sc({ back: 'new', updatedAt: 20 })).op, 'keep', '같으면 기기');
```

`sc()` 는 `createdAt` 이 없어 둘 다 "고친 것", `updatedAt` 같음 → 바로 지침 1이 고치라는 자리(같은 꼴·같은 시각, 글자 칸 `'b'` 대 `'new'` 둘 다 비지 않고 다름). 새 규칙으로는 `{ op: 'patch', patch: { back: 'new' } }`(`'new' > 'b'`). 이 줄은 12-1 의 "같으면 기기"를 글자 칸까지 고정하던 기대라 지침 1과 정면으로 맞선다.
12-1d 수정 범위의 시험 파일은 `tests/cards-12.test.mjs` 뿐이라 `backup-9c.test.mjs` 는 **고치지 않았다**. 제안(한 줄):

```js
// [12-1d] 같은 시각 — 비글자 칸은 기기, 둘 다 비지 않은 다른 글자는 문자열이 큰 쪽
assert.deepEqual(R('cards', sc({ updatedAt: 20 }), sc({ back: 'new', updatedAt: 20 })), { op: 'patch', patch: { back: 'new' } }, '같으면 기기 — 글자는 큰 쪽');
assert.equal(R('cards', sc({ updatedAt: 20, back: 'z' }), sc({ back: 'new', updatedAt: 20 })).op, 'keep', '같으면 기기(내 글자가 큼)');
```

승인되면 이 한 줄을 바꾸고 전체 2회만 다시 돌리면 끝난다. 그 밖의 항목은 모두 끝냈다.

## 1. 고친 것 (`js/text/backup.js` `mergeSentence` 한 곳)

**전**(12-1c): 내용 묶음에서 기기가 이기거나 같을 때 — 기기 글자 칸이 비었으면 파일 값으로 채움, 그 밖은 기기.
```js
} else {
  for (const k of SENTENCE_TEXT_FIELDS) if (blankText(mine[k]) && !blankText(theirs[k])) p[k] = theirs[k];
}
```
**후**(12-1d): 같은 자리에서 "같은 꼴(고침/안 고침)·같은 `updatedAt`"이면 둘 다 비지 않은 다른 글자 칸은 **문자열이 큰 쪽**.
```js
} else {
  const tie = mineEdited === theirsEdited && num(theirs.updatedAt) === num(mine.updatedAt);
  for (const k of SENTENCE_TEXT_FIELDS) {
    if (blankText(mine[k])) { if (!blankText(theirs[k])) p[k] = theirs[k]; }
    else if (tie && !blankText(theirs[k]) && String(theirs[k]) > String(mine[k])) p[k] = theirs[k];
  }
}
```
- **왜 "문자열이 큰 쪽"인가**: 기기·순서·시각과 무관한 전순서라 같은 시각 자리의 칸별 합치기가 `max` 가 된다 → 교환(A←B·B←A 같은 값)·결합(어느 순서로 묶어도 같음)·멱등(두 번째엔 같은 값 → keep). 그래서 모든 기기가 "가장 큰 값"으로 모인다. JS 기본 비교(UTF-16 코드 단위)를 썼다 — 코드 포인트 순과 BMP 밖 일부에서만 다르지만 결정적·전순서인 것이 요점이라 충분하고 `localeCompare`(환경·로캘에 따라 달라질 수 있음)보다 안전하다. 의미상 "더 나은" 값을 고르는 규칙은 아니다(같은 시각엔 고를 근거가 없음).
- **잃는 칸 없음**: 지는 값은 12-1c 에서도 "같으면 기기"로 진 쪽(다른 기기에선 이미 졌던 값). 한쪽이 비면 지금처럼 채움, 시각·꼴이 다르면 지금 규칙 그대로(이긴 쪽 · 빈 값은 못 지움). `updatedAt` 은 여전히 올리지 않음.
- 범위는 글자 칸(`back`·`note`·`explain`)이면서 **둘 다 비지 않을 때만**(지침 그대로). 둘 다 빈 값끼리(`''` 대 `'   '`)는 그대로 둔다 — 아래 정보.

## 2. 시험 (`tests/cards-12.test.mjs`)

- **C11 덧붙임**: ① 낮음-3 — 파일이 이기면 비글자 칸(`docTitle ''`·`lineId null`·`paraId '   '`)의 빈 값은 그대로 옮겨진다(X3 잡음). ② 같은 꼴·같은 시각 양방향 — P←Q 는 큰 뒷면만 받고 내 큰 설명은 지킴, Q←P 는 반대, 두 방향 같은 글자·두 번 = 한 번. ③ 시각이 다르면(둘 다 고침) 큰 쪽 규칙 끼지 않음. ④ 같은 `updatedAt` 이어도 꼴이 다르면(고침 대 만들기만) 고친 기기 그대로(M3 잡음).
- **C11c 새로**: 12-1cR W3 꼴(W 메모 고침·뒷면 빔·가장 늦음 / L1·L2 자동 뒷면 다름 → L2←W(첫 파일) · W←L1 · 세 바퀴) → 셋 다 `'L2-auto'`·`'W-note'`, 한 번 더 = 그대로 + 씨앗 고정 세 기기 무작위 돌기 600회(옛 파일 섞어 8번 → 3바퀴 + 1바퀴) 갈라짐·불안정·지움 0.
- 머리 주석에 C11 덧붙임·C11c 줄.

## 3. 시뮬레이션 숫자 (Review `r12-1c/rv3.test.mjs` 의 사본 `b12-1d/rv3-fixed.test.mjs` — W2·W3·W3e 기대 뒤집음, W1 에 같은 시각 글자 갈라짐 셈 추가)

| 점검 | 12-1c(= 변이 M1) | 12-1d |
|---|---|---|
| W2 세 기기 3,000회(옛 파일 섞음) 갈라짐 | 354 | **0** |
| W2 세 기기 3,000회(옛 파일 없음 — 170 꼴) 갈라짐 | 170 | **0** |
| W2 지움 · 불안정 · 한 기기만 고친 글자 잃음 | 0 · 0 · 0 | 0 · 0 · 0 |
| W2 두 기기 3,000회 갈라짐 | 0 | 0 |
| W1 두 기기 전수 6,400 쌍 — 지움 · 고친 쪽 잃음 · 멱등 · 순서 차이 · 시각 다른데 다름 | 0 · 0 · 0 · 0 · 0 | **0 · 0 · 0 · 0 · 0**(12-1c 와 같음) |
| W1 같은 시각 쌍에서 비지 않은 글자가 기기마다 다름(새 셈) | 2,832 | **0** |
| W3(순수)·W3e(종단 실제 내보내기·가져오기) | 갈라짐(W·L1 `L1-auto` / L2 `L2-auto`) | 셋 다 `L2-auto` |

- `rv3-fixed` **7/7 통과**. Review 원본 `rv3.test.mjs` 를 고친 코드로: **W2·W3·W3e 만 빨강**(발견을 단정하던 줄 — 기대대로), W1·W4·W4b·W5 통과(나머지 그대로).
- 정보(옛 레코드 섞음 — 정보-4, 고치지 않음): W2 legacy 갈라짐 568(전부 `createdAt` 만 다름 — 파일에 `createdAt` 키가 없을 때), W1 legacy `createdAt` 차이 4,608 쌍 · 한 기기만 고친 글자 바뀜 2/3,000(Review 와 같음).
- 정보(지침 범위 밖으로 둔 것): W1 의 같은 시각 쌍(두 기기가 같은 ms 에 따로 만든 꼴 — 실제로는 거의 없음) 중 둘 다 빈 값끼리만 다른(`''` 대 `'   '`) 것 624 — 보이는 차이 없음. crossstep 줄에 기록.

## 4. 변이 (bak `b12-1d/bak/backup.fixed.js` 를 **읽어** 한 곳 바꿈(매치 1 확인) → `cards-12` + `rv3-fixed` → `mut.mjs restore` 가 bak 을 읽어서 씀 → `cmp` 0)

| # | 변이 | 빨강 |
|---|---|---|
| M1 | 1 되돌림(같은 시각 큰 쪽 고르기 끔 — `false &&`) | C11 · **C11c** · W1 · W2 · W3 · W3e (W2 354·170 재현) |
| X3 | 빈 값 건너뜀을 모든 필드로 넓힘(`SENTENCE_TEXT_FIELDS` 조건 지움) | **C11**("비글자 칸의 빈 값은 건너뛰지 않음") — 12-1c 에선 살아남던 것 |
| M3 | 같은 시각 판정에서 꼴 조건 뺌(`updatedAt` 만) | C11("꼴이 다르면 고친 기기 그대로") |

복원 뒤 `cmp backup.js bak/backup.fixed.js` 0. 원본은 `bak/backup.orig.js`·`bak/cards-12.orig.test.mjs`.

## 5. 검증

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회: **1,852/1,853 · 1,852/1,853**(12.9초 · 13.0초 — `b12-1d/full1.txt`·`full2.txt`). 실패는 둘 다 위 **K10h 587행 하나**(범위 밖 — 멈춘 곳). 12-1·12-1b·12-1c(C1–C11b)·C11c·9c 병합 I6·멱등 K11·I5 통과.
- `cards-12` 단독 15/15(`b12-1d/cards1.txt`).
- `dev/stamp-importmap.mjs` 다시 찍음(단독 명령, 변이 복원 뒤) → `--check` "그대로다(모듈 88개 · CSS 4개)" · `git diff --check` 0. headless 하지 않음.
- spec 17-4-1 `[정정 2026-11-17 — 12-1c]` 줄 뒤에 `[정정 2026-11-17 — 12-1d]` 한 줄(Edit).
- crossstep: 12-1c 줄 뒤에 "12-3 결정 후보 (12-1cR 낮음-2 · 정보-4)" 한 줄 덧붙임(자동 채움이 `updatedAt` 을 올림 · 옛 레코드 `createdAt` · 빈 값끼리는 그대로).

## 6. 실행 · 정리

명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0 — 결과는 리다이렉트로 파일에). **막힌(거절된) 명령 0.** 서버 0 · headless 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `r12-1c/` 읽기·실행만 · 12-2 지침 파일 무변.

바꾼 파일: `apps/medreader/js/text/backup.js`(`mergeSentence` 한 곳) · `apps/medreader/tests/cards-12.test.mjs` · `apps/medreader/index.html`(stamp) · `apps/medreader/spec.md`(한 줄) · `.claude/tasks/medreader-crossstep-notes.md`(한 줄 덧붙임) · 이 보고서.
스크래치 `b12-1d/`: `bak/`(backup.orig·fixed, cards-12.orig) · `rv3-fixed.test.mjs`·`rv3-fixed.txt` · `rv3-orig.txt` · `mut.mjs`·`m-M1.txt`·`m-X3.txt`·`m-M3.txt` · `cards1.txt` · `full1.txt`·`full2.txt`.

## 7. 덧붙임 — K10h 기대값 수정(오케스트레이터 승인 뒤)

- 승인: `tests/backup-9c.test.mjs` K10h 587행을 위 "멈춘 곳"의 두 줄로 바꿈(같은 시각·둘 다 비지 않음 → 큰 글자 `patch {back:'new'}` / 내 글자가 크면 `keep`). 이 한 곳만, 12-1d 의 의도된 규칙 변경을 따라가는 기대값 수정.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회(단독 명령): **1,853/1,853 · 1,853/1,853**(13.0초 · 12.9초 — `b12-1d/full3.txt`·`full4.txt`). 실패 0.
- `git diff --check` 0(다시). 앱 코드 무변이라 stamp 그대로. 커밋 0 · 명령 묶기 0 · 막힌 명령 0.
- 바꾼 파일에 `apps/medreader/tests/backup-9c.test.mjs`(K10h 한 곳) 추가.
