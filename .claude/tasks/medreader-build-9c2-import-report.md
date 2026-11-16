# Build 보고서 — 9c-2 백업 가져오기 (spec 17-4-1)

> Build 서브에이전트 · 2026-11-17 · 직전 배포 9c-1 `076b1bc` 위. **커밋하지 않음.** 운영자 위임 — 권장안 그대로.
> 호출 0 · 업로드 0 · 병합만(지우지 않음) · 멱등. DB 3·`algoVersion`·캐시 키·`PROMPT_VERSION` 무변 · `db.js`·`pipeline.js`·`library.js`·`dev/`·review.md 무변 · `dev/measure-table-8i4.mjs` 손대지 않음.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/backup/import.js` **새**(서비스, 약 440줄) | `previewBackup`(머리 줄·문서 목록만, 평문은 끝 64KB 에서 끝 줄 확인) · `importBackup`(흐름 → 500줄 묶음 = readwrite 트랜잭션 하나, 레코드마다 그 트랜잭션 안에서 기기 값을 읽고 `mergeRecord`) · 순수 도우미 `docHashCandidates`·`samePdf`·`cleanLinkIds`·`cleanRecord`. import 는 `config`·`db`·`hash`·`text/backup`·`text/vocab` 만 |
| `tests/backup-import-9c.test.mjs` **새** | I1–I15 + I4b (16 시험, fake-idb 종단) |
| `js/ui/backup.js` | 가져오기 그릇(JS 가 만듦 — `createElement`·`textContent`) · 파일 고르기(`accept` 없음) · 미리보기 · `☑ 설정도 가져오기` · 진행(내보내기 막대 재사용) · 결과 한 줄 · `[다시 불러오기]` · 떠나기 확인(이동 단추·주소 링크 붙잡기 단계, `hashchange`, `beforeunload`) · 끝난 뒤 다른 화면으로 가면 그 화면에서 새로 불러옴 (+313줄) |
| `js/text/backup.js` | `lineSplitter` 만 고침 — 줄 길이 상한(`maxLine`, 기본 `BACKUP.MAX_LINE_CHARS`) · 조각은 목록에 모았다가 줄바꿈에서 한 번만 이음 · `long` 셈. 이유: 9c-1R #10(줄바꿈 없는 큰 파일을 조각마다 다시 이음 — 10MB 279ms·100MB 수십 초) — 가져오기가 첫 줄 전에 거절하려면 순수 함수가 알려 줘야 한다. API(`push`·`end`)·K7 그대로 |
| `js/config.js` | `BACKUP.KEY_PATTERNS` — `sk-` 경계 5꼴 추가(`\xXX`·8진·`%uXXXX`·`%25XX`·`=XX`) · `Bearer` 왼쪽 경계 · `BACKUP.MAX_LINE_CHARS`(8M). `REDACT_PATTERNS` 무변 |
| i18n ko·en·fr·ar | 24키(`backup.import*`·`backup.preview.*`·`backup.withSettings`·`backup.cancel`·`backup.newer`·`backup.notBackup`·`backup.hashMismatch`·`backup.truncated`·`backup.imported`) + `backup.howto` 를 6절 문구로(9c-1 남은 문제 1). ar·fr `[검토 — Nour·운영자]`. 다시 불러오기 단추는 있는 `common.reload` |
| `tests/backup-9c.test.mjs` | K4b 에 줄 추가(새 경계 7꼴 · Bearer 합성어 3 그대로 · `%0A`·글자 그대로 `\n`·`Authorization:` 뒤는 여전히 지움) |
| `index.html` | stamp 만(모듈 79) |
| `spec.md` | 17-4-1 `[정정 2026-11-17 — 9c-2 Build]` 한 줄(①–⑫) |

설계 표의 "i18n 약 12키" 보다 많다(24) — 미리보기 줄·거절 이유·결과·떠나기 확인을 따로 적었기 때문. `css/` 는 고치지 않음(기존 `big`·`primary`·`consent-row`·`row`·`warn-note`).

## 2. 수용 기준 (17-4-1 "9c-2")

| 기준 | 결과 | 근거 |
|---|---|---|
| `[N]` lineSplitter 경계(줄 가운데·다바이트·`\r\n`·끝 줄바꿈 없음) | ✔ | K7·K7b(9c-1) + I1(상한·조각에서 바로 `long`·20MB 줄바꿈 없음 빠름) |
| `[N]` remapRecord | ✔ | K9 + I4(실제 가져오기: 캐시 키 셋째 칸 4개·`w=` 그대로·진도 키·문항 접두·시도 items·오답·카드·필기) |
| `[N]` mergeRecord 표 + 멱등(전 스토어 깊은 비교) | ✔ | K10a–h·K11 + I5(빈 기기·값이 다른 기기, gzip→gzip→평문 세 번 같은 스냅숏) |
| `[N]` fake-idb 종단 — 빈 DB: 문서(blob 없음·extraction 처음 값), 개수 = 머리 줄 counts / 같은 fileHash 다른 id → 그 id, 새 문서 0 | ✔ | I3(gzip·평문) · I4 · I4b(쪽수 변형 키) |
| `[N]` 잘린 파일(반쪽 줄 하나만 버림·truncated) · `format:2` 거절 · gzip·평문 | ✔ | I8(평문 bad=1 · gzip 60% 자름 → broken·truncated · 깨진 UTF-8 → 앞 두 줄만) · I9(newer 는 아무것도 안 씀, PDF 고름 → not-backup, 10MB 줄바꿈 없음 → not-backup) |
| `[D]` ★ 종단 두 프로필 | ✔ | 3절 |
| `[D]` 기기 B 에 같은 책 다른 id → 문서 1·요청 0 | ✔ | 3절 C |
| `[D]` 합성 150MB 힙 ≤ +64MB, 끝까지, 진행 막대 끝까지 | ✔ | 5절 (+49.0·+37.1MB, 남는 양 +0.16MB, 막대 150,010/150,010) |
| `[D]` 가져오는 중 떠나기 확인 · 끊고 다시 → 개수 같음 | ✔ | 7절 run-lv |
| 공통 — innerHTML 0·콘솔 오류 0·무료 티어 숫자 0·stamp | ✔ | I14·I15·K13 · 모든 headless console 0·pageerror 0 · stamp "그대로다(79·4)" |

## 3. 두 프로필 종단 (headless — 합성 PDF 5쪽 `b9c2/syn.pdf`, 지어낸 영어)

- **A**(`pA4`): 서재 [가져오기] → 3쪽 [▶] 7초 → Gemini POST 2·캐시 36 → 단어 2(`vocabStore.save`) → 진도 `lastPage 3`·`lastLineId '3:1'` → [내보내기] → `dl/A.jsonl.gz` 4,246B. 오늘 사용량 calls 2.
- **B**(`pB4`, 빈 프로필, UI en): 미리보기 "1 books — already 0 · new 1 (PDF needed) / Word list 2 · quiz 0 · notes 0 / 36 saved translations (about 53 KB) / Settings: included" → 가져오기 "New 40 · changed 1 · unchanged 8 · skipped 0" · [다시 불러오기] 초점 · **다시 불러오기 전에는** UI 여전히 en·캐시 칸 "0 B"(옛 메모리) → 누른 뒤 **ko**·"약 35 KB" · 문서 `lastPage 3`·`lastLineId '3:1'`·blob 없음·extraction 처음 값 · 동의는 B 의 것 그대로(옮기지 않음). 서재 카드 1 → 같은 PDF 서재 [가져오기] → **같은 id 재사용**(새 문서 0)·`#/reader/<id>/3` → 3쪽 [▶] 7초 **POST 0** · 단어장 dyspnea·edema 2 · 오늘 사용량 calls 2(A 와 같음).
  - 주의: PDF 를 넣자마자 열린 3쪽(이웃 쪽 추출 전)으로 바로 재면 POST 1 — 머리글 "Synthetic Chapter 3" 이 그 순간 본문으로 그려져 한 단위가 더 감(나중 추출 결과는 A·B 모두 `role:'header'` — `dump-p3`). A 와 같은 조건(추출 끝난 뒤 다시 열기)에서는 0. 9c 와 무관한 HEAD 동작(남은 문제 1).
- **C**(`pC1`, 같은 PDF 를 먼저 가져옴 — 다른 id): 미리보기 "이미 있음 1 · 새로 생김 0" → 가져오기 → 문서 1개 · 캐시 36개 **셋째 칸 전부 C 의 id**(A id 0) · 단어 docId C · blob 그대로 · `lastPage 1`(C 를 더 늦게 열었다 — 기기 값) · 3쪽 [▶] **POST 0**.

## 4. 데이터 안전 근거

- **쓰는 트랜잭션 안에서 다시 읽기**: 묶음 하나(10스토어 readwrite)에서 레코드마다 기기 값을 `get` → `mergeRecord` → `put`(patch 는 그 값에 합침) — 요청은 콜백으로 이어 걸어 트랜잭션이 도중에 끝나지 않는다. `db.patch` 와 같은 보장이라 documents 도 이 안에서(별도 `db.patch` 는 부르지 않음 — 9c-1 남은 문제 4② 의 뜻을 같은 트랜잭션으로 지킴).
- **I6**: 기기가 더 새로운 문서 자리(`lastOpenedAt`)·사용자 원문 언어·domain·readStats·진도·단어(내용·`sm2`·`dueAt`·`reviewedAt`·`introducedAt`·`suspended` **깊게 같음**)·문장 카드(기기 복습이 더 늦음)·필기·해결된 오답·캐시(`result`·`hits 77`·`createdAt`)는 그대로. 파일 `reviewedAt` 이 늦을 때만 복습 필드가 바뀌고 `updatedAt` 은 그대로.
- **`updatedAt` 뒤로 가지 않음**: term 은 `importPlan` 그대로(파일 시각을 지금으로 자름·미래/못 읽음 = 충돌 → 기기), 같은 시각 = 기기(9c-1b).
- **I7**: 다른 id 의 같은 낱말 → `term` 인덱스로 그 항목에(둘이 되지 않음) · 원어를 바꿔 기기의 다른 항목과 겹치면 내용 그대로(`dup`). 내용은 `importPlan` 의 정규화(겹공백·줄바꿈 → 공백)를 따른다.
- **지운 항목**(I13): 기기에서 지운 단어·문서가 파일에 있으면 **다시 생긴다** — 설계(병합만, 지움을 옮기지 않음)대로. 미리보기에는 문서 단위만("새로 생김 m — PDF 필요"에 지운 책이 포함). 단어 단위 수는 본문을 훑지 않으므로 미리보기에 없고, 끝난 뒤 결과 줄 "새로 n" 에 들어 있다(남은 문제 5).
- 키: 가져올 때 **속성 이름**이 키 모양이면 그 속성 뺌(I2·I10), 허용 밖·키 모양 설정 값 건너뜀, `blobs` 줄 무시, `links.medical` id 꼴 고침(줄바꿈·따옴표 → `i{번호}`, 멱등).

## 5. 힙 (Edge `--enable-precise-memory-info` · `--expose-gc` · 9c-1 합성 `b9c1/dl/h-150k.jsonl.gz` 22.8MB → 평문 162.5MB · 150,012줄 · 화면 경로)

| 실행 | 가져오는 동안 최댓값 | 끝난 뒤 gc 3번 남는 양 | 시간 | 진행 막대 |
|---|---|---|---|---|
| pH1 | **+49.0MB** | **+0.16MB** | 48.0초 | 150,010/150,010 |
| pH2 | **+37.1MB** | **+0.16MB** | 48.0초 | 150,010/150,010 |

9c-1 정정 ⑦ 두 기준((가) ≤ +64 · (나) ≤ +4) 안. 이 값은 `file.stream()`·압축 해제 조각(ArrayBuffer)까지 포함한 전체다. 미리보기 어림 "약 215 MB"(실제 `sizeBytes` 합 약 214MB) · 상한 200MB 넘음 줄 표시. Node(fake-idb)에서도 같은 파일 8.9초·개수 = 머리 줄·두 번째 = 같은 스냅숏.

## 6. 시험

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1719/1719 · 1719/1719**(HEAD 1703 + I 16). `stamp-importmap --check` "그대로다 (모듈 79개 · CSS 4개)" · `git diff --check` 0.
- 9c-1 Build·Review 파일 가져오기(`imp-files.mjs`, fake-idb): `b9c1/dl/x1`·`x2`(캐시 끔)·`r9c1/dl/x-cache`·`x-nocache`·`h-150k` 모두 ok·bad 0·잘림 0·개수 = 머리 줄·두 번째 = 같음.
- KEY_PATTERNS 전후(`fp.mjs`, r9c1c 글 목록·CMDT 덤프 읽기만): 정상 글 61 중 57 그대로(HEAD 와 같음, 새 오탐 0) · bearer 겨냥 40 중 31(HEAD 27 — 합성어 4개 풀림) · CMDT 1,277만 자 걸림 0 · 진짜 길이 `sk-` 4꼴 × `\x22`·`\x3D`·`\012`·`%u0022`·`%2522`·`%252F`·`=3D` → 샘 0(HEAD 4씩) · `"`·`%20`·`\n`·`Bearer ` 등 그대로 0 · 영숫자·하이픈 바로 뒤는 그대로 샘(받아들인 틈).

### 변이 (읽어서 쓰기 백업 `b9c2/bak/` → 시험 → 되돌림 → 바이트 비교 + `cmp`)

| # | 변이 | 빨강 |
|---|---|---|
| V1 | aiCache 충돌 = 파일이 이김 (설계) | K10e · I6(hits·createdAt) |
| V2 | usage 를 합으로 (설계) | K10c · K11 · I4 · I5 · I12 |
| V3 | remap 을 키에서 빼고 `v.docId` 만 (설계) | K9 · I4 + **headless C: POST 2**(0 이어야) |
| V4 | 다시 불러오기 생략 (설계) | **headless B: UI en·캐시 칸 "0 B" 그대로**, 다시 불러오기 없음 |
| V5 | fileHash 맞추기 끔(늘 새 문서) | I4 · I4b |
| V6 | term 겹침(dup) 검사 끔 | I7 |
| V7 | 의료 사이트 id 고침 끔 | I2 |
| V8 | 디코더 엄격 끔 | I8 · I14 |
| V9 | [설정도 가져오기] 끔 무시 | I10 |
| V10 | lineSplitter 조각 상한 끔 | 처음 살아남음 → I1 에 "줄바꿈 전에 바로 long" 단정 더해 빨강 |
| V11 | 속성 이름 키 모양 검사 끔 | I2 |
| V12 | Bearer 왼쪽 경계 뺌 | K4b |
| V13 | `sk-` 경계 `\xXX` 갈래 뺌 | K4b |
| V14 | 문서 병합 대신 파일 값으로 덮기 | I6 |

14/14 빨강. 되돌린 파일 모두 bak 과 같음(스크립트 바이트 비교 + V3·V4 `cmp` 0), `stamp --check` 그대로.

## 7. headless (Edge · 새 프로필 `b9c2/p*` · pipe · 가짜 키 세션+로컬 · 흉내 Gemini OPTIONS 204 + CORS · 캐시 끔 · 한 번에 하나 · **서버 띄움 0·8000 접속 0** — 앱 요청은 전부 가로채 작업 트리(또는 `git show HEAD:`)에서 내줌)

- 파일 넘기기: `uploadFile` 로 스크래치 파일만(`syn.pdf`·`dl/A.jsonl.gz`·`b9c1/dl/h-150k.jsonl.gz`). 내려받기는 `URL.createObjectURL` 감싸 잡아 `b9c2/dl/` 에만.
- **run-lv**(pL1, 150MB 파일): ① 이동 단추 + 확인 [취소] → confirm 1·`#/settings/backup` 그대로·진행 계속 ② 해시를 `#/search` 로(뒤로 가기·음성 꼴) + [취소] → 설정으로 돌아옴 ③ 가져오는 동안 `beforeunload` 막음 true, 새로 불러온 뒤 false ④ 이동 단추 + [예] → 23,500/150,010 에서 멈추고 `#/library` 에서 새로 불러옴(캐시 23,990 남음) ⑤ 같은 파일 다시 → 캐시 150,000·문서 2·카드 2·…(머리 줄과 같음), "새로 126,010 · 그대로 24,000" ⑥ 끝난 뒤 다시 불러오기 전 서재 단추 → 확인 없이 `#/library` 에서 새로 불러옴.
- **run-l**(pLay1) 360×740·412×915 × ko·en·fr·ar(미리보기 열림): 문서 가로 넘침 0·카드 밖 요소 0·미리보기 줄 넘침 0·`[가져오기]` 64px·`[이 파일 가져오기]`·`[취소]` 48px 이상·체크 줄 64px·ar `dir=rtl`·알림 `aria-live=polite` · 끝 화면(360 ar) `[다시 불러오기]` 294×64·초점. 스크린샷 `b9c2/shots/preview-360x740-ar.png`·`preview-360x740-fr.png`·`done-360x740-ar.png`.
- **회귀 run-r**(pA4): 설정 카드 여섯(백업·AI·번역 따라가기·목소리 둘·의료 사이트) · 서재 카드·[백업] · 단어장 2줄 · 사용량 화면 · **9c-1 내보내기(캐시 끔) 15줄 head/end·aiCache 0** · 8c-2 `#/settings/cache` 초점.
- **번역 요청 본문 바이트 HEAD 와 같음**(run-body, 합성 PDF 3쪽 · 새 프로필 둘): 지금 판 `4f2e6b6ac89f9d78`(2,729B)·`356e9e3f5ef34de4`(6,090B) = HEAD 판(257파일 `git show HEAD:`) 같은 둘.
- 모든 실행 콘솔 오류 0 · pageerror 0 · 새 탭 0 · 외부 요청 0(pdf.js CDN 만 — 앱이 원래 쓰는 라이브러리) · missing 0.

## 8. spec 정정
17-4-1 `[정정 2026-11-17 — 9c-2 Build]` 한 줄(Edit 로 9c-1c 줄 다음에만): ① gzip 은 첫 두 바이트만 ② 엄격 디코더 — 깨진 곳에서 멈춤(앞까지 들어감, `broken`) ③ 같은 트랜잭션 안 다시 읽기(documents 포함) ④ 문서 맞추기 순서·새 문서 `fileHash` 값 ⑤ term 찾기 순서·dup·importPlan 정규화 ⑥ 속성 이름 키 모양·링크 id ⑦ 줄 상한 ⑧ 캐시 MB 어림·잘림 표시는 평문만 ⑨ 떠나기 동작 ⑩ 그릇은 JS·i18n 24키 ⑪ 힙 실측 ⑫ KEY_PATTERNS.

## 9. 실기기 목록 (`[M]` — 17-4-1 10 그대로 + 이번에 생긴 것)
- [ ] Android 파일 고르기에서 `.jsonl.gz`(메신저로 받은 것 포함)를 고를 수 있는가(`accept` 비움) · 메신저가 풀어 `.jsonl` 로 바꾼 파일도 들어가는가.
- [ ] 큰 캐시 가져오기 — 폰에서 걸린 시간(PC 150MB 48초)·앱이 죽지 않는가·진행 막대.
- [ ] 가져오는 중 Android 뒤로 제스처 → 확인 창 → [취소] 시 설정으로 돌아오는가 · [확인] 시 새로 불러와지는가 · 탭 닫기/새로고침 경고.
- [ ] 끝난 뒤 [다시 불러오기] → UI 언어·설정이 파일 값으로 · 같은 PDF 서재 [가져오기] → 같은 쪽·읽은 쪽 낭독 동반 번역이 요청 없이.
- [ ] ar·fr 24키 `[검토 — Nour·운영자]`.
- [ ] 아주 긴 하이픈 합성어가 든 단어 문맥 백업 → 가져와 같은지(9c1R).

## 10. 남은 문제
1. (9c 무관 — HEAD) 처음 연 쪽이 이웃 쪽 추출 전이면 머리글이 본문으로 그려져 그 화면에서 한 단위가 더 요청된다(B 에서 1회). 또 그 순간 리더가 `lastLineId` 를 `null` 로 쓴다(텍스트 준비 전 `firstFlowLineId()` null) — 백업에서 온 `'3:1'` 이 처음 열 때 지워짐. 리더는 원래 줄을 되살리지 않고 쪽만 연다.
2. **9c-3 몫 그대로**: "PDF 필요" 배지·`[PDF 가져오기]` 없음 · 서재 [가져오기] 재사용 경로가 blob 을 쓰지 않아 **같은 세션 안에서만** 읽힌다(새로 불러오면 다시 PDF 없음). 종단은 그 세션 안에서 잼.
3. gzip 파일의 "끝까지 쓰이지 않음"은 미리보기에서 알 수 없고(끝까지 풀어야 함) 가져오기 끝 결과 줄에서 알린다.
4. 미리보기 "번역 약 x MB" 는 어림(머리 줄에 바이트 없음 — 내보내기에 `bytes` 를 더하면 정확해지나 9c-1 파일 범위 밖).
5. 지운 단어가 되살아나는 수는 미리보기에 없다(본문을 훑지 않음) — 결과 줄 "새로 n" 에만.
6. term 내용이 파일 쪽으로 바뀔 때 `importPlan` 정규화로 문맥의 줄바꿈이 공백이 된다(CSV 와 같은 규칙 — 그대로 둠).
7. 내보내기 지우개는 여전히 속성 이름을 보지 않는다(9c1R #3 의 내보내기 쪽 — 가져오기 쪽만 막음, 앱이 사용자 글자를 속성 이름으로 쓰는 길은 없음).
8. `x-Bearer <토큰>`처럼 하이픈에 바로 붙은 Bearer 는 이제 지우지 않는다(합성어 오탐을 막은 대가 — 기록).
9. ar 미리보기 "(نحو 53 KB)" 크기 글자 방향 고립 없음(9c-1 캐시 칸과 같은 꼴).
10. 떠나기 확인은 `window.confirm`(설정 캐시 지우기와 같은 장치) — 페이지 안 `<dialog>` 로 바꾸려면 `index.html`·CSS 가 필요해 이번 범위 밖.
11. 지침의 "i18n 약 12키" → 24키.

## 11. 막힌 명령 · 규칙
- 막힌 명령 없음.
- **규칙 어김 1회**: 처음 시험 실행을 `cd /d/01_claude_my-blog && node --test …` 로 묶었다(한 호출 한 가지 규칙) — 그 뒤로는 작업 폴더에서 바로.
- `run-b` 한 번이 미리보기 기다림 조건 실수(“읽는 중…” 을 결과로 봄)로 300초 기다림 끝에 실패 → 조건 고쳐 다시. 도구가 그 실행을 배경으로 옮겼고, 끝날 때까지 다른 headless 를 띄우지 않았다(한 번에 하나).
- 서버 띄움 0 · 8000 접속 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋·checkout/restore/stash 0 · `rm` 0 · 프로필 복사 0 · `.nojekyll` 무변 · 의학책 0(합성 PDF 만, CMDT 는 9c-1c Review 덤프를 수만 셈) · `b9c1/`·`r9c1/`·`r9c1c/`·`p14/` 읽기만 · C: 남은 공간 약 93GB.
- 스크래치 `b9c2/`: `common.mjs`·`make-pdf.mjs`·`syn.pdf`·`run-a/b/c/h/lv/l/r/body.mjs`·`dump-p3.mjs`·`dbg-pdf.mjs`·`imp-files.mjs`·`fp.mjs`·`cfg-head.mjs`·`mut.mjs`·`bak/`·`m-V*.txt`·결과 `*.json`·`full1/2.txt`·`dl/`·`shots/`·프로필 `p*`.
