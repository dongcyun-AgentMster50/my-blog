# Build 보고 — 12-1b: 12-1 Review 지적 고치기

> 지침 `.claude/tasks/medreader-build-12-1b-fix.md` · 근거 review.md "12-1 Review"(12-1R-1~9) · 앞 지침 `medreader-build-12-1-srs-service.md` 규칙 그대로. **커밋 0.** 스크래치 `b12-1b/`(`r12-1/` 은 읽기·실행만). 12-2 지침 파일 무변.

## 고친 것 (전 → 후)

| # | 지적 | 전 | 후 | 파일 |
|---|---|---|---|---|
| 1 | 중간-1 두 번째 [쉬움] < [좋음] | reps==1: 어려움 2 · 좋음 6 · **쉬움 3**(처음 [좋음]·[어려움] 뒤 모두) | reps==1 easy = `max(SECOND_GOOD_DAYS + 1, 공식 값)` → **2 · 6 · 7**(처음 [쉬움] 4일 뒤는 공식 값 15 그대로). 상수 추가 없음. **S1–S10 무변**(표에 reps==1 easy 없음) | `js/srs/sm2.js` +1줄·주석 1줄 |
| 2 | 중간-2 문장 카드 id 의 docId | id = 해시(대상 언어·**docId**·앞면) → 두 기기 같은 PDF 따로 가져오기·지우고 다시 가져오기에서 **카드 둘** | id = 해시(대상 언어·**`sentenceDocKey(문서 fileHash, docId)`**·앞면) — `fileHash` 의 `:n쪽수` 꼬리를 뗀 바탕, 없으면 docId. `saveSentence` 가 문서 레코드를 읽어(해시는 트랜잭션 밖) id 를 만들고, 같은 id 의 옛 카드를 만나면 **`docId`·`docTitle` 을 지금 문서로**(내용·복습·멈춤·`updatedAt` 그대로 — 빈 뒷면을 함께 채울 때만 `updatedAt` 오름). 새 공개 `sentenceDocKey` · `cardStore.idFor({front, targetLang, docId})` | `js/srs/cards.js` |
| 2 | 9c `remapRecord` | 카드 `docId` 만 바꾸고 id 그대로(→ 중복의 원인) | 코드 그대로가 **맞다**(id 에 docId 가 없으므로) — 주석 한 줄. 시험으로 확인(C10b·rv R8) | `js/text/backup.js` 주석 1줄 |
| 3 | 낮음-3 `clampNewPerDay(null)`·`('')` | 0(새 카드 0) | 20(`null`·`undefined`·공백만 글자 → 기본, `0` 은 0) | `js/srs/cards.js` +1줄 |
| 5 | 낮음-5 시험 틈 X2 | Build 시험 전부 통과 | C6 에 한 줄 — 파일이 내용만 늦고 멈춤 시각 없음 → 패치는 내용만(멈춤은 기기) | `tests/cards-12.test.mjs` |
| 4 | 낮음-4 서머타임 | — | 기록만 — crossstep "다음 다듬기 후보"에 줄 | crossstep |

`js/config.js` 무변(상수 불필요). DB 3·algoVersion·`*_PROMPT_VERSION`·`ai/*`·`ui/*` 무변.

### fileHash 가 없을 때 docId 로 물러서는 이유
`fileHash` 가 빈 문서(옛 레코드·특이 경로)나 문서 레코드가 없는 docId 는 같은 PDF 인지 알 길이 없다. 9c 도 `fileHash` 로만 문서를 맞추므로(`remap`) 그런 문서는 기기 사이에서 맞춰지지 않는다 — docId 를 쓰면 전과 같은 동작이고 잃는 것이 없다. 반대로 빈 값을 책 칸에 쓰면 서로 다른 책의 같은 문장이 한 카드로 합쳐진다.

### `:n쪽수` 를 떼는 판단과 남는 것
서재 가져오기는 표본 해시가 겹친 **다른** PDF 가 이미 있으면 새 문서에 `해시:n쪽수` 를 붙인다 — 기기마다 붙고 안 붙고가 다를 수 있으므로(9c `docHashCandidates` 가 같은 이유로 둘을 맞춤) 떼야 같은 PDF 가 같은 id 를 낸다. 남는 것: 표본 해시·크기가 같은 다른 PDF 둘에 글자까지 같은 문장이 있으면 한 카드(마지막 저장 문서로 옮겨 감) — 9-2 와 같은 "사용자 서재 안 실질 위험 낮음" 판단. 쪽수를 책 칸에 넣는 안은 "PDF 필요"·채택(쪽수 0) 문서와 기기 사이에서 쪽수가 다를 수 있어 버렸다.

### docId 옮김이 `updatedAt` 을 올리지 않는 이유
`updatedAt` 은 사용자 내용 수정만(12-D9) — 올리면 8f "바뀐 항목"·9c 내용 묶음 비교가 문서 옮김에 반응한다. 9c 는 `remapRecord` 가 `docId` 를 기기 문서로 맞추므로 시각이 필요 없다. 남는 것(spec 17-4-1 정정에 기록): 받는 기기에서 그 책 문서를 **지운 뒤** 가져오면 파일 문서가 "PDF 필요"로 새로 들어오지만 카드 `docId` 는 내용 시각이 같으면 기기 값(지운 문서)으로 남는다 — 그 문장을 다시 저장하면 `saveSentence` 가 고친다.

## 시험

- 새·바뀐 시험: `sm2-12` N1(reps 1 easy 3 → **7**, {2.35,1,1} → 7, {2.65,4,1} → 15) · **N5 단조성**(again ≤ hard ≤ good ≤ easy 간격 + hard·good·easy dueAt 순서 — reps 0·1(간격 0–5)·2·3·4·7·15·40 × ease 13값 × 간격 20값 + 씨앗 고정 무작위 걸음 300개, 약 6천 상태, 걸음 중 reps 1 은 간격 1·4 로만 닿음 단정) · `cards-12` C3(`null`·`undefined`·`''`·공백·`'x'`·NaN → 20, 0 → 0, `queue({newPerDay:null})` 20장) · C6 한 줄(X2) · **C10**(책 칸 순수 · 같은 PDF 두 문서(한쪽 변형 키) → 한 장 · `docId`·`docTitle` 옮김 · 내용·복습 그대로 · `keptCount`/`list({docId})`/`queue({docId})` 가 옮긴 문서 쪽 · 같은 문서 다시 = 쓰지 않음 · 옮기며 빈 뒷면 채우면 그때만 `updatedAt` · **같은 기기 문서 지우고 같은 PDF 다시 → 한 장, docId 새 문서** · fileHash 없음 → docId · id 경계 "a b"+"c" ≠ "a"+"b c") · **C10b**(9c 두 기기 따로 가져오기 → 실제 `exportBackup`/`importBackup` → 한 장·`docId` 는 기기 문서·`idFor` 로 다시 찾음·두 번 = 한 번, 같은 `fileHash`·쪽수 변형 키 두 경우 · `remapRecord` 는 `docId` 만). 기존 C1 id 경계(문서 레코드 없는 docId → 물러섬 갈래)는 그대로 통과.
- Review `r12-1/rv.test.mjs`(원본 그대로 실행 — `b12-1b/rv-orig.txt`): 9 통과 · **R8**(“같은 문장인데 기기마다 id 가 다름” 단정)·**R3** 끝 두 줄(`clampNewPerDay(null) = 0` 단정) 만 빨강 — 둘 다 발견을 단정하던 줄이라 기대대로. **R1d** 는 통과하며 남은 이상 12개가 **모두 reps==1·간격 ≥ 6 의 hard > good**(easy ≥ good 은 전부 — 이 상태는 `next()` 로 닿지 않음). 발견 단정을 고친 뒤 기대로 바꾼 사본 `b12-1b/rv-after.test.mjs` **11/11**(R1d 쉬움 ≥ 좋음·2·6·7 · R3 null → 20 · R8 같은 id·카드 한 장·docId 기기 문서·복습 상태 A).
- **전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회: 1,850/1,850 · 1,850/1,850**(13.0초 · 13.1초 — `b12-1b/full1.txt`·`full2.txt`, 2회째는 변이 복원 뒤). 1,847 + N5·C10·C10b. 회귀: 12-1 전부 · 9c 병합 K10h·I6 · 멱등 K11·I5 · 8f 단어장 · 11-1 삭제 연쇄(D1·W13) 모두 통과.
- stamp 다시(단독 명령 — "모듈 88개 · CSS 4개") · `--check` "그대로다" · `git diff --check` 0 · 새 파일(`js/srs/*`·두 시험) 끝 공백 0 · `sm2.js` 순수 grep(`Date|document|window|fetch|indexedDB|localStorage|navigator`) 0.

## 변이 (백업 `b12-1b/bak/` → `mut.mjs` 한 곳 → 관련 시험 4파일 + rv-after → `mut.mjs restore` 가 **bak 을 읽어서 씀** → `cmp` 0)

| # | 변이 | 빨강 |
|---|---|---|
| M1 | (1 되돌림) reps==1 easy 바닥 줄 지움 | N1 · N5 · rv R1d |
| M2 | (2 되돌림) id 책 칸 = `rec.docId` | C10 · C10b · rv R8 |
| M2b | 옛 카드를 만나도 `docId`·`docTitle` 안 고침 | C10 |
| M3 | (3 되돌림) `clampNewPerDay` null·빈 글자 갈래 지움 | C3 · rv R3 |
| X2 | `mergeSentence` 내용 묶음이 멈춤 필드를 빼지 않음 | **C6(새 줄 "내용 묶음이 멈춤 필드를 가져가지 않는다")** · rv R4 |

복원 뒤 `cmp` sm2.js·cards.js·backup.js 모두 0. 결과 `b12-1b/m-M1.txt`·`m-M2.txt`·`m-M2b.txt`·`m-M3.txt`·`m-X2.txt`.

## headless 한 번 (`b12-1b/run-h.mjs` → `h1.json`)

Edge headless · pipe · 새 프로필 `b12-1b/p1` · 캐시 끔 · **서버 없음**(요청 가로채 작업 트리를 `127.0.0.1:8000` 으로 내줌) · 412×915 · 4.9초. 앱 뜸(`data-boot=ok`) → 페이지 안 동적 import(`./js/srs/cards.js` — import map 을 거쳐 앱과 **같은 db 모듈**, 실제 IndexedDB):
- 같은 `fileHash`(한쪽 `:n12` 변형)·다른 docId 두 문서 → 같은 문장 저장 두 번: created true → **false · 같은 id · 문장 카드 1장** · id = fileHash 바탕(docId 아님) · `idFor` 두 문서 모두 같은 id · `docId`·`docTitle` = 둘째 문서 · 복습 상태·`updatedAt`·뒷면 그대로 · `keptCount` [0, 1] · DB 저장값 docId 둘째 문서.
- fileHash 빈 문서 → docId 로 물러섬 ✓ · 두 번째 [쉬움] 7일·[좋음] 6일 · `clampNewPerDay(null)` 20.
- 다시 불러오기 뒤 앱 뜸·문장 카드 2장(위 1 + 물러섬 1).
- **콘솔 오류 0 · pageerror 0 · 빠진 파일 0 · 외부 요청 0 · AI POST 0 · 대화상자 0**, stderr 0바이트.

## spec · crossstep

- spec 17-11 3: `[정정 2026-11-17 — 12-1b]` 줄(easy reps==1 규칙 · S1–S10 무변 이유 · N5 · 닿지 않는 reps==1·간격 ≥ 6 상태 기록).
- spec 17-11 4: `[정정 2026-11-17 — 12-1b]` 줄(① 책 칸 fileHash 바탕·물러섬·옛 카드 옮김·`idFor`·`sentenceDocKey`·12-2 가 쓸 길·`keptCount`/`list` 는 `docId` 필드 · ② `clampNewPerDay` · ③ 시험).
- spec 17-4-1 9c: `[정정 2026-11-17 — 12-1b]` 줄(`remapRecord` 는 `docId` 만이 맞음 · 지운 문서 뒤 가져오기의 남는 꼴).
- crossstep: **12-2 줄**(`[★]` 상태는 `cardStore.idFor` — `sentenceIdOf(tl, docId, front)` 직접 부르면 다른 id · 옛 카드 옮김 · 두 번째 복습 라벨 2·6·7) · 다듬기 후보 줄(12-1R #4 서머타임 · 닿지 않는 reps==1 상태 · 23:50 뒤 [다시] dueAt 이 [어려움]보다 늦음 — 간격 순서는 맞음).

## 넘길 것

1. **12-2**: 12-2 지침 6줄의 API 목록에 `sentenceIdOf` 가 있다 — 지침 파일은 건드리지 않았으므로 crossstep 줄로 넘김. 띠 `[★]` 상태는 `cardStore.idFor(…)` 또는 `sentenceIdOf(tl, sentenceDocKey(doc.fileHash, doc.id), front)`.
2. 같은 PDF 의 옛 카드를 만나면 `created:false` + 카드가 지금 문서로 옮겨진다 — 12-2 의 "이미 있음" 안내가 그대로 맞다.
3. 낮음-4(서머타임)는 다듬기 묶음 후보.

## 실행 · 정리

명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0 — 결과는 리다이렉트로 파일에). **막힌(거절된) 명령 0.** 서버 띄움 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · `r12-1/` 읽기·실행만 · 12-2 지침 무변.

스크래치 `b12-1b/`: `orig/`(고치기 전 sm2·cards·backup·두 시험) · `bak/`(고친 뒤 — 변이 복원 원본) · `mut.mjs` · `t1.txt` · `rv-orig.txt` · `rv-after.test.mjs`·`rv-after.txt` · `full1.txt`·`full2.txt` · `m-M1.txt`·`m-M2.txt`·`m-M2b.txt`·`m-M3.txt`·`m-X2.txt` · `run-h.mjs`·`h1.json`·`h1.err` · 프로필 `p1`.
