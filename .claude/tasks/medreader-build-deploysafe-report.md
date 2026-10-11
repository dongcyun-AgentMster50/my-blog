# Build 보고 — 배포 안전장치 (운영자 결정 A)

> Build 서브에이전트. **커밋 없음** · `spec.md` 손대지 않음 · `.claude/launch.json` 손대지 않음 · npm 설치 0 · `git checkout/restore/stash` 0 · `rm -rf` 0.
> Bash 차단 훅에 막힌 명령은 없었다.
> git 은 `status`·`diff`·`archive`(옛 판 두 파일을 스크래치패드에 풀 때)만 썼다.

## 1. 만든 것

| 파일 | 내용 |
|---|---|
| `apps/medreader/index.html` | ① `<!-- stamp-importmap:begin/end -->` 구간 — CSS 4개 `?v=해시` + `<script type="importmap">` (js/ 아래 모듈 51개 전부 → `./js/x.js?v=<SHA-256 앞 10자>`) ② 진입점을 `<script type="module">import './js/main.js';</script>` 로(src= 제거) ③ 부팅 실패 안내 `#bootFail`(정적, 기본 `hidden`, 아랍어→영어→프랑스어→한국어 각자 `lang`·`dir`, [다시 불러오기] 48px — 모양은 인라인 `<style>`, 시스템 색) ④ 고전 감시 스크립트 ⑤ 다시 추출 확인 `<dialog id="reextractDialog">` ⑥ 머리 주석에 "배포 단위 = 이 파일 한 장" |
| `dev/stamp-importmap.mjs` (새) | `js/` 아래 모든 `.js`·`css/*.css` 의 SHA-256(줄바꿈 LF 로 맞춤) 앞 10자를 재서 표지 구간**만** 다시 쓴다. CSS 순서는 구간에 적힌 순서를 지킨다(새 파일은 끝, 사라진 파일은 뺌). `--check` 는 고치지 않고 어긋나면 종료 코드 1. 순수 함수 export(테스트가 씀) |
| `js/main.js` | `boot()` 마지막 줄에 `markBoot('ok')` → `<html data-boot="ok">` + `medreader:booted`. `boot().catch` 에 `markBoot('failed')` |
| `js/pdf/extract.js` | `Extractor.stopAndSettle()` — 멈추고 **도는 중인 `_tick` 과 `pause()` 의 마지막 저장까지** 기다린다(`_tickPromise`·`_pauseSave` 두 필드만 더함) |
| `js/db.js` | `DERIVED_STORES`·`derivedDocReset()`·`resetDerived(docId)` — 파생 데이터를 **한 트랜잭션**으로 지움(아래 4절 목록) |
| `js/ui/library.js` | [⋯] 패널에 "텍스트 다시 추출" 줄 · `askReextract`(페이지 안 `<dialog>`, 첫 초점 [취소], Esc=취소) · `reextractDoc`(순서: PDF 확보 → 옛 추출기 `stopAndSettle` → `resetDerived` → `attach`) · 그동안 `openDoc` 은 그 약속을 기다림 |
| `js/ui/reader.js` | `goPage` 첫 줄 `if (!state.docId) return;` (이것만) |
| `js/i18n/*.js` | `library.reextract.*` 10키 × 네 언어(ar·fr·ko 실제 번역). `err.reextract` ko·fr 번역(키 그대로) |
| `css/screens.css` | `.doc-reextract`·`.confirm-dialog`·`.confirm-actions` (논리 속성만) |
| `tests/importmap.test.mjs` (새, 12) | IM1 모듈 빠짐·남는 키 / IM2 해시=지금 내용 / IM3 CSS / IM4 진입점 specifier(소스) / IM5 **키 정규화** — 모든 모듈의 상대 import 를 **해시 URL 기준으로** 풀어도 표의 키에 걸림(쿼리 붙은 import 금지) / IM5b 문자열 아닌 동적 import 는 pdf.js 하나 / IM6 생성기 멱등 / IM7 구간만 다시 씀·CSS 순서 / IM8 안내 정적·네 언어·48px·고전 스크립트 위치 / IM9 main.js 표시 / IM10·IM11 감시 스크립트를 `vm` 가짜 DOM 에서 실제로 돌림 |
| `tests/reextract.test.mjs` (새, 8) | RX1 지우는 것/남기는 것 전수 / RX2 없는 문서 / RX3 지운 뒤 planResume / RX4 **`stop()` 은 뒤에 쓰기가 옴(재현) · `stopAndSettle` 은 0** / RX5 순서(소스) / RX6 `confirm()` 0·대화상자 키 네 언어 / RX7 `err.reextract` / RX8 `goPage` |

**키 정규화 확인**: import map 의 키 `"./js/db.js"` 는 문서 URL 기준 절대 URL 로 정규화된다. `js/ui/library.js?v=…` 안의 `'../db.js'` 는 쿼리가 떨어진 `…/js/db.js` 로 풀려 같은 키에 걸린다(IM5 가 51개 모듈의 import 전부를 이 규칙으로 검산 — 실패 0). 브라우저에서도 확인했다: 부팅 때 요청된 앱 자원 54개(CSS 4 + 모듈 50) 전부 `?v=` 가 붙었다(해시 없는 요청 0). 표에 있는데 안 받힌 1개는 `ai/ondevice.js` — 어떤 모듈도 import 하지 않는다(주석에서만 언급). 페이지 문맥의 동적 `import('./js/privacy/redact.js')` 도 표를 탔다(3a 아래).

**감시 스크립트가 안내를 여는 경우**(부팅 완료 표시 전만): ① 모듈 404·네트워크 — 진입 `<script>` 요소의 `error`(버블 안 함 → window **캡처**로 들음) ② 모듈 연결·평가 오류 — window `error`, 파일 URL 이 이 앱 폴더일 때만(확장 프로그램 등 남의 오류 무시) ③ `medreader:bootfailed` ④ `BOOT_TIMEOUT_MS = 20000` 안에 완료 없음 — 늦게라도 부팅이 끝나면 ④로 연 것만 닫는다. 20초 근거: 모듈 51개·약 1MB(gzip 약 1/4)를 느린 모바일망(실효 0.5Mbps·왕복 0.3초·import 깊이 6단)에서 5~10초, 그 두 배. 오류는 ①②③이 즉시 잡으므로 이 시간은 "멈춘 채 아무 일도 없는" 경우(예: 다른 탭이 IndexedDB 열기를 막음)만 맡는다.

## 2. 혼합 상태 재현 (미리보기 `blog`, 가장 중요)

python `http.server` 는 `Cache-Control` 이 없어 브라우저가 수정 시각 휴리스틱으로 캐시한다. Pages 의 `max-age=600`(10분 동안 재확인 없음)을 흉내 내려고 **옛 판 두 파일의 수정 시각만 2020-01-01 로** 두었다(휴리스틱 신선 기간 = 몇 달). 옛 판은 `git archive f26af46~1` 의 `provider.js`·`redact.js`(`setSecretSource` 없음 — Review PR-6 과 같은 조합)이고, 나머지 모듈은 지금 판이다(`settings.js`·`trband.js` 는 `provider` 를 namespace 로만 import 해서 옛 짝으로도 부팅된다). 단계마다 문서 URL 에 `?s=N` 을 붙여 새 문서로 열었다.

| 단계 | 서버에 있는 것 | 브라우저가 쓴 index.html | 요청된 URL (Resource Timing) | 결과 |
|---|---|---|---|---|
| 1 옛 배포 | 옛 provider·redact + 옛 표 | 옛 표 | `provider.js?v=fffd2f3af1`(29,746B) · `redact.js?v=97a6e4a4e1`(8,620B) | `data-boot=ok` |
| 2 새 배포 | 새 provider·redact + 새 표 | 새 표 | `provider.js?v=48d1929564` · `redact.js?v=10e447456b` — **옛 해시 URL 요청 0** | `data-boot=ok` |
| 3a 옛 표(캐시된 옛 index) + 새 파일만 서버에 | 새 파일 | 옛 표 | `?v=fffd2f3af1`·`?v=97a6e4a4e1` 둘 다 **캐시에서**(전송 0B). 페이지 안 `import('./js/privacy/redact.js')` → `setSecretSource` 없음 = **옛 내용** | 옛 판끼리 일관 → `data-boot=ok` |
| 3b 같은 상황, 단 옛 해시 URL **하나만** 캐시에서 밀림 | 새 파일 | 옛 표 | `fetch('…provider.js?v=fffd2f3af1',{cache:'reload'})` → 서버가 쿼리를 무시하고 **새 내용**을 줌(`setSecretSource` 있음) → 옛 URL 에 새 내용이 캐시됨 | **섞임**: 새 provider + 옛 redact → `SyntaxError … does not provide an export named 'setSecretSource'` → **안내가 즉시 열림**(`data-boot-fail="error"`, 화면 글자 = 네 언어 안내뿐) |
| 4 index.html 이 새것이 된 뒤 [다시 불러오기] | 새 파일 + 새 표 | 새 표 | `?v=48d1929564`·`?v=10e447456b` | `navigation.type=reload`, `data-boot=ok`, 안내 닫힘 |

**결론** — 브라우저는 표에 적힌 `?v=` URL **만** 요청한다. 그래서 같은 index.html 아래에서는 옛 판·새 판이 섞일 길이 "캐시 항목이 따로 밀리는 경우" 하나로 줄어든다. 다른 경우는 없다.

**한계(정확히)**:
- 쿼리는 **캐시 키를 나눌 뿐**이다. 서버(Pages·python)는 쿼리를 무시하고 **지금 파일**을 준다. 옛 판을 보관하지 않는다.
- 그래서 "옛 index.html(최대 10분 캐시) + 그 옛 표의 URL 중 일부가 브라우저 캐시에 없음"이면, 없는 것만 새 내용으로 받힌다. 그러면 섞일 수 있다(3b).
- 보통은 같은 방문에서 모든 모듈을 index.html 과 함께 받으므로 신선 기간이 같다. 그래서 드물다. 캐시 축출·저장 공간 압박·부분 실패 때 생긴다.
- 그때는 연결 오류면 **안내가 뜬다**(빈 화면 아님). 새로고침은 index.html 이 새것이 된 뒤에야 고친다(4) — 문구가 "잠시 뒤 다시 열어 주세요"인 이유다.
- **연결 오류 없이 조용히 섞이는 조합**(PR-6 의 `layout.js`+`blocks.js`·`config.js` 처럼 export 이름이 맞는 경우)은 3b 같은 축출에서 여전히 가능하다. 다만 같은 index.html 아래에서는 확률이 크게 줄었다. 굳은 경우의 복구 길이 [텍스트 다시 추출]이다(4절).
- **이번 변경을 처음 올리는 배포 하나는 보호되지 않는다.** 지금 배포된 index.html 에는 표가 없다(`src="js/main.js"`, 해시 없는 URL). 이번 한 번은 PR-10 절차(한 번에 푸시·15분 대기·"앱을 완전히 닫았다 다시 열기")를 따라야 한다. 그다음 배포부터 보호된다.
- (이론) CDN 전파 중에 가장자리가 새 index.html 을 줄 수 있다. 그런데 새 해시 URL 의 원본 응답이 아직 옛 내용이면, 옛 내용이 새 URL 로 10분 캐시된다. Pages 는 사이트를 통째로 바꿔 배포하므로 가능성은 낮다고 본다. 재현하지 않았다.
- import map 미지원 브라우저(Chrome 89 미만·Safari 16.4 미만)에서는 표가 무시된다. 그러면 해시 없는 URL 로 예전처럼 돈다(부팅은 됨, 보호만 없음).

## 3. 부팅 실패 안내

- **404**: 표의 `voices.js` 값을 잠시 `voices-404.js` 로 바꿔 열었다. 네트워크 기록은 `voices-404.js?v=… → 404`. 0.86초 안에 `data-boot-fail="load"` 로 안내가 보였다. 원복 후 `cmp` 같음.
- **[다시 불러오기]**: 3b 화면에서 눌렀다. `performance.getEntriesByType('navigation')[0].type === 'reload'` 였다. index.html 을 새것으로 돌린 뒤 다시 누르니 정상 부팅됐다(2절 4).
- **정상 부팅에서는 절대 안 보인다**: 새 문서로 연 뒤 안내 요소에 MutationObserver 를 걸고 21.5초를 기다렸다(20초 타이머 지남). 속성 변화 0, `data-boot-fail` 없음, `hidden` 유지. 기본이 `hidden` 이고 숨김 규칙이 인라인 `<style>` 에 있어서 외부 CSS 전에도 숨는다.
- 360px: 안내는 가로 넘침이 없다. 버튼은 16→345px, 높이 76px(두 줄)다. 1024px 에서는 높이 48px다(미리보기 배율 때문에 47.994 — 앱의 다른 버튼과 같은 값).
- 아랍어 문단이 오른쪽 정렬된 것을 확인했다(`text-align:start` + `dir`).

## 4. [텍스트 다시 추출]

**파생 데이터 — 코드에서 찾은 목록**

| 지운다 | 근거(만드는 곳) |
|---|---|
| `pages` (그 문서) | `extract.js _buildAndStore` |
| `questions` (그 문서) | `quiz/engine.js buildSectionIndex` → `ui/quiz.js putQuestions` |
| `sections` (그 문서) | 같은 파서 몫의 스토어. 지금 쓰는 곳은 없고 비어 있다 |
| documents.`extraction` | 새 문서 값 `{done:false,pagesDone:0,cursor:1,failed:[],algoVersion:0}` |
| documents.`sectionIndex`·`sectionIndexDone`·`sectionIndexVersion` | `ui/quiz.js saveSectionIndex`·`markSectionIndexDone` |

| 남긴다 | 이유 |
|---|---|
| `lang`·`langSource`·`langGuess`(원문 언어) | 사용자 선택. `langGuess` 는 텍스트에서 나왔지만 원문 언어 결정의 일부라 남긴다 |
| `lastPage`·`lastLineId` | 사용자 위치 |
| `readStats` | 비용 추정용 실측. 다시 추출해도 쪽 글자 수는 거의 같다. 주인은 `ai/readalong.js`(범위 밖) |
| `aiCache` | 번역 캐시. 같은 문장이면 키가 같다 |
| `cards` | 단어장 예정·문장 카드 |
| `progress`·`attempts`·`mistakes` | 퀴즈 기록. 문항 id 는 `docId:섹션:번호` 로 다시 같게 만들어진다 |
| `annotations`, `blobs` | `blobs` 는 다시 추출의 재료 |

**순서가 곧 안전**(`reextractDoc`):
1. PDF 를 먼저 손에 쥔다. 원본이 없으면 `library.reextract.noFile` 배너를 띄운다. pdf.js 를 못 받으면 오류 배너를 띄운다. 어느 쪽이든 **아무것도 지우지 않는다**.
2. 옛 추출기를 `stopAndSettle` 한다.
3. `resetDerived` 를 한 트랜잭션으로 돌린다.
4. `attach` 한다. 새 문서처럼 algoVersion 0 에서 시작하므로 "엔진 갱신" 배너는 뜨지 않는다.

그동안 `openDoc` 은 기다린다. 2번이 필요한 이유는 RX4 가 재현했다. `stop()` 만 하면 도는 중인 쪽이 지운 뒤에 `pages` 에 쓰인다(review.md PR-5 기록 ②의 실체).

**브라우저 검증**(브라우저에서 만든 6쪽 가짜 PDF를 파일 입력으로 가져옴 → algoVersion 10 추출 완료 → 1–3쪽 `algoVersion 9` · 4–6쪽 10 + 표지 `mixedRules`(굳은 쪽 흉내) · `lang=fr/user` · `lastPage 3` · `lastLineId 'keep-me'` · 가짜 sectionIndex·questions 1·aiCache 1 → 새로고침해 추출기 없는 상태에서 시작):
- [⋯] → [텍스트 다시 추출] 을 누르면 `<dialog>` 가 모달로 열린다. 첫 초점은 [취소], 버튼은 48px이다. [취소]와 Esc(`cancel`)에서는 쪽 6·문항 1 이 그대로였다.
- [다시 추출] 직후 쪽 0 → **3쪽(마지막 쪽)이 먼저** 10 으로 생긴다. 카드는 "Preparing text 1/6", 상태 줄은 "Preparing the text of “deploysafe-test” again."였다. `lang fr/user`·`lastPage 3`·`lastLineId keep-me`·aiCache 1 이 유지됐고, questions 0·sectionIndex [] 였다.
- 추출 중에 [이어 읽기]를 누르면 3쪽 본문이 바로 그려졌다(`article lang="fr"`).
- 끝난 뒤 쪽은 `1:10 … 6:10`, `mixedRules` 표지 0, `extraction.done`, 퀴즈 색인은 다시 만들어졌다(`sectionIndexDone true`, 판본 2, 가짜 문서라 섹션 0).
- 추출기가 메모리에 있는 경로(`stopAndSettle`)로도 한 번 더 했다. 결과는 같았다(done/6·`fr/user`·`lastPage 3`).
- 아랍어 UI: 패널·대화상자 문구가 아랍어로 나오고 `html dir=rtl`, 360px 가로 넘침 0 이었다.

**기존 재추출 경로와 다른 점(기록)**: algoVersion 이 오를 때의 경로는 옛 쪽을 지우지 않고 덮어쓰므로 그사이에도 옛 본문이 보인다. 버튼은 섞인 규칙의 쪽이 하나도 남지 않게 **지우고** 다시 뽑는다. 그래서 아직 안 뽑힌 쪽은 새 문서처럼 "준비 중" 자리표시자가 보인다. 보던 쪽 ±5 가 우선순위 0·1 이라 읽던 자리는 곧 생긴다.

## 5. 작은 결함 둘

- `goPage` 첫 줄에 `if (!state.docId) return;` 을 넣었다(RX8 · 변이 M5 빨강). 브라우저 지연 주입 재현은 하지 않았다. 원인과 수정이 Review PR-4-6 이 짚은 한 줄 그대로다.
- `err.reextract` 를 번역했다. ko "텍스트 엔진이 갱신되어 이 문서를 다시 준비하고 있습니다." / fr "Le moteur de texte a été mis à jour : ce document est de nouveau en préparation." 네 언어 키는 그대로다(I1 통과).

## 6. 테스트 · 변이

- `node --test "apps/medreader/tests/*.test.mjs"`: **950/950** (930 + importmap 12 + reextract 8). 구현 뒤 3회, 변이 뒤 3회, 모두 실패 0.
- 변이(스크래치패드 `mut/mutate.py`): 찾을 문자열이 정확히 1곳인지 확인 → 적용 → 전체 테스트 → 스크래치패드 복사본으로 복원 → `filecmp` 바이트 비교. 11종 모두 빨강이고 복원 `cmp` 도 모두 같았다. 끝난 뒤 `stamp-importmap --check` 는 "그대로다", 전체 950 통과다.

| 변이 | 빨강 | 걸린 테스트 |
|---|---:|---|
| **M1 표에서 모듈 하나(`voices.js`) 빼기** | 4 | IM1·IM2·IM5·IM6 |
| **M2 해시 하나(`db.js`) 바꾸기** | 3 | IM2·IM5·IM6 |
| **M3 진입점을 `src=` 로 되돌리기** | 2 | IM4·IM8 |
| M4 CSS 하나 해시 없이 | 2 | IM3·IM6 |
| M5 `goPage` 의 docId 확인 빼기 | 3 | RX8 (+IM2·IM6: 다시 찍지 않은 커밋) |
| M6 `stopAndSettle` 이 도는 쪽을 기다리지 않음 | 3 | RX4 (+IM2·IM6) |
| M7 `resetDerived` 가 questions 를 남김 | 4 | RX1·RX3 (+IM2·IM6) |
| M8 다시 추출: 멈추기 전에 지우기 | 3 | RX5 (+IM2·IM6) |
| M9 감시: 시간 초과 안내를 부팅 뒤에도 안 닫음 | 1 | IM11 |
| M10 감시: 부팅 완료 뒤 오류에도 안내를 엶 | 1 | IM10 |
| M11 main.js 부팅 완료 표시 빼기 | 3 | IM9 (+IM2·IM6) |

JS 를 고친 변이는 모두 IM2·IM6 도 빨갛게 했다. **표를 다시 찍지 않은 커밋은 테스트에서 걸린다**는 것이 저절로 확인된 셈이다.

## 7. 브라우저 회귀 (`preview_start {name:"blog"}`)

| 항목 | 결과 |
|---|---|
| 서재 | 카드·[⋯]·원문 언어·다시 추출, 360px `scrollWidth = innerWidth`(361) |
| 리더 | 3쪽 본문, [다음 쪽] → `#/reader/<id>/4` |
| 낭독 | [▶] → `speechSynthesis.speaking=true`, "Line 1 of 22", 다시 누르면 멈춤 |
| 띠 | `data-state="pending"`·"Translating…" (키 없음, 동작은 이전과 같음 — trband 는 손대지 않음) |
| 원본 | 캔버스 818×1058(CSS 736), 되돌리면 리플로우·`reader.view=reflow` 복원 |
| 설정 | AI 탭 표시, provider 1·model 2 |
| 퀴즈 | 가짜 문서라 버튼 숨김(정상) |
| 360×740 | 서재·리더·설정·대화상자·부팅 안내 모두 가로 넘침 0 |
| 콘솔 | 정상 동작 중 오류 **0**. 남은 오류는 의도한 재현의 것뿐(3b 연결 오류 4줄·404 1줄) |

- 미리보기 창이 숨김이어서 스크린숏·좌표 클릭이 시간 초과로 실패했다. 그래서 대부분을 요소 `.click()` 과 DOM·Resource Timing·네트워크 기록으로 쟀다. 원본 뷰 측정 동안 rAF 를 `setTimeout(16ms)` 로 덮었다(새로고침으로 해제).
- **정리**:
  - 가짜 문서는 `deleteDocument` 로 지웠다(documents 1·blobs 1·pages 6·aiCache 1).
  - IndexedDB 13개 스토어가 시작과 같다. settings 8행 값이 같고(`reader.view=reflow`·`ui.lang=en`) 나머지는 0이다. localStorage·sessionStorage 키도 0이다.
  - UI 언어는 런타임에서만 ar 로 바꿨다가 en 으로 되돌렸다(저장값 en 그대로).
  - 뷰포트는 desktop 으로 되돌렸고, 페이지는 `index.html#/library` 다.
  - 혼합 재현에 쓴 `index.html`·`provider.js`·`redact.js` 는 스크래치패드 사본으로 되돌리고 `cmp` 로 같음을 확인했다(provider·redact 는 작업 전 사본과도 같음).
- 참고: 브라우저 캐시에는 실험용 옛 해시 URL 2개(그중 하나는 일부러 새 내용을 넣음)가 남아 있다. 지금 표가 가리키지 않으므로 앱에 영향이 없다.

## 8. 운영자가 매 커밋 전에 할 일

```
node apps/medreader/dev/stamp-importmap.mjs
```
JS·CSS 를 고친 커밋이면 한 번 돌리고, 바뀐 `index.html` 을 **같은 커밋**에 넣는다. 잊으면 `tests/importmap.test.mjs`(IM2)가 "stamp-importmap 을 돌려라"로 빨갛다. 확인만 하려면 `--check` 를 붙인다.

**이번 푸시(이 묶음 + 대기 중인 `f26af46`)는 보호 밖이다**(2절 한계). PR-10 절차를 한 번 더 따른다.
1. 한 번에 푸시한다.
2. 15분 기다린다.
3. 운영자 기기에서 콘솔 오류 0 을 확인한다.
4. Nour 에게 "완전히 닫았다 다시 열기"를 안내한다.

그다음부터는 빈 화면 대신 안내가 뜬다. 섞인 규칙으로 굳은 책은 [⋯] → [텍스트 다시 추출]로 복구한다.

## 9. spec 에 넣을 문구 (오케스트레이터 몫 — spec.md 는 손대지 않았다)

**새 절 제안 — "2-5. 배포 단위와 판 번호 `[신설 2026-10-12 — 배포 안전장치]`"**

> GitHub Pages 는 파일마다 `max-age=600` 이라 배포 직후 옛·새 모듈이 섞일 수 있다(review.md PR-6: 빈 화면 · 원본 뷰만 빔 · 섞인 규칙의 재추출이 새 algoVersion 으로 굳음). 그래서 **배포 단위를 `index.html` 한 장으로** 한다.
> - `index.html` 의 import map 이 `js/` 아래 **모든** 앱 모듈을 `"./js/x.js": "./js/x.js?v=<SHA-256 앞 10자>"` 로 돌린다. 모듈 안의 상대 import 는 절대 URL 로 풀린 뒤 같은 키에 걸리므로 모든 모듈 요청이 해시 URL 이 된다. CSS `<link>` 도 같은 해시를 붙인다.
> - 진입점은 `<script type="module">import './js/main.js';</script>` 다. `src=` 는 import map 을 거치지 않으므로 쓰지 않는다. 앱 모듈의 import 에 쿼리를 붙이지 않는다(표를 비켜 간다).
> - 해시는 `dev/stamp-importmap.mjs` 가 찍는다(표지 구간만 다시 씀, LF 기준). **JS·CSS 를 고친 커밋은 이것을 돌린 `index.html` 을 함께 담는다.** `tests/importmap.test.mjs` 가 빠진 모듈·어긋난 해시·`src=` 진입점을 잡는다.
> - 한계: 쿼리는 캐시 키를 나눌 뿐 서버는 옛 판을 보관하지 않는다. 옛 index.html(최대 10분)이 가리키는 URL 중 일부가 브라우저 캐시에서 밀렸으면, 그것만 새 내용으로 받혀 섞일 수 있다. 연결 오류가 나면 아래 안내가 뜬다. 조용히 섞여 굳은 책은 [텍스트 다시 추출]로 복구한다.
> - **부팅 실패 안내**: `index.html` 의 정적 `#bootFail`(기본 숨김, 네 언어 — 아랍어 먼저, 각자 `dir`, [다시 불러오기] 48px)과 고전 감시 스크립트. 부팅 완료 표시(`<html data-boot="ok">`, `main.js boot()` 의 마지막 줄)가 서기 전에 모듈 404·연결 오류·부팅 예외가 나면 즉시 연다. 20초 안에 완료가 없으면 열고, 늦게 완료되면 닫는다. 모듈 시스템·외부 CSS 에 기대지 않는다. "문자열 하드코딩 금지"의 두 번째 예외다(`<noscript>` 다음).

**9-4 마지막 줄 수정 제안**

> - 재추출: `pages.algoVersion < layout.ALGO_VERSION`인 페이지를 발견하면 그 페이지만 재추출한다. ~~설정 > 고급에~~ **서재 카드 [⋯] 에** [텍스트 다시 추출](전체) `[구현 2026-10-12 — 배포 안전장치]` — 페이지 안 확인 대화상자. 그 문서의 파생 데이터(`pages`·`questions`·`sections`·`extraction`·`sectionIndex*`)를 한 트랜잭션으로 지우고 지금 algoVersion 으로 다시 뽑는다. 원문 언어·마지막 쪽·번역 캐시·퀴즈 기록·카드는 남는다(`db.resetDerived` 주석이 목록의 정본). 옛 추출기는 도는 쪽과 마지막 저장까지 기다린 뒤 지운다(`Extractor.stopAndSettle`). PDF 원본을 못 열면 아무것도 지우지 않는다.

**20절 함정 표에 한 행**

> | `[신설 2026-10-12]` 배포 직후 옛·새 모듈 혼합(빈 화면 · 섞인 규칙의 재추출이 굳음) | import map 해시 URL(2-5) + 부팅 실패 안내 + [텍스트 다시 추출]. 커밋 전 `node apps/medreader/dev/stamp-importmap.mjs` |

**19-1 의 공개 전 절차에 한 줄**: "이 변경을 처음 올리는 배포는 옛 index.html 에 표가 없어 보호 밖 — PR-10 절차를 한 번 더."

## 10. 기록만 한 것

1. **같은 세션의 리더 메모리 캐시**: 다시 추출 뒤 같은 세션에서 같은 문서의 리더로 돌아가면, `reader.js` 의 표 크롭(`state.crops`, docId·쪽·region id 키)과 `announcedTables` 가 남는다. 이것들은 문서가 바뀔 때만 비워진다. region id 가 달라졌다면 새로고침 전까지 옛 크롭이 보일 수 있다. reader.js 는 `goPage` 만 고칠 수 있어 손대지 않았다.
2. `boot()` 가 던지거나 IndexedDB 열기가 막혀 20초를 넘기면, 전면 안내가 기존 배너(예: "다른 탭을 닫으세요")를 덮는다. 다른 탭 막힘이면 배너 문구가 더 정확하다. 안내 위에 배너를 겹칠지는 결정할 일이다.
3. 확인 대화상자의 [취소]는 `common.cancel` 이 아니라 전용 키 `library.reextract.cancel` 이다. ko·fr 의 `common.*` 은 아직 영어라서 그렇다(이번 범위 밖).
4. `ai/ondevice.js` 는 표에 있지만 어떤 모듈도 import 하지 않는다. 표에 둬도 해가 없다.
5. 두 번 누름 방지(`reextracting`)는 진행 중일 때만 막는다. 가짜 6쪽 문서는 다시 추출이 수십 ms 에 끝나 브라우저에서 "진행 중 두 번째 누름"을 잡지 못했다. 끝난 뒤의 두 번째 누름은 새 요청으로 정상 처리된다.
6. 작업 중 `spec.md`·`dev/measure-search.mjs`·`dev/search-bench.html` 이 다른 서브에이전트에 의해 바뀌거나 생겼다. 손대지 않았다. **새 js 파일이 `js/` 아래 생기면** 표를 다시 찍어야 IM1 이 통과한다.
