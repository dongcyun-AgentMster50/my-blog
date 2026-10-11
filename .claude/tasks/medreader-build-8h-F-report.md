# Build 보고 — 8h-F 타슈킬 A/B 시험 페이지

커밋하지 않았다. 새 파일 세 개만 만들었다(앱 `js/`·`index.html`·`tests/` 및 그 밖의 파일은 건드리지 않음). 진짜 API 키는 쓰지 않았다 — 실제 생성은 하지 않았다.

## 만든 파일
| 파일 | 내용 |
|---|---|
| `apps/medreader/dev/tashkeel-make.mjs` | 생성 스크립트(운영자 PC 에서 한 번). `--dry` 는 네트워크 없이 자리표시 데이터 |
| `apps/medreader/dev/tashkeel-ab.data.js` | 지금은 `--dry` 로 만든 **자리표시**(`placeholder: true`, 아랍어 칸 "لم يُولَّد بعد · 생성 전") |
| `apps/medreader/dev/tashkeel-ab.html` | 시험 페이지 — 자리표시면 "الصفحة قيد التحضير / Not ready yet" 안내만 보인다 |

### tashkeel-make.mjs
- ① = `js/ai/prompts.js` 의 `buildTranslateRequest`(바꾸지 않고 import) + `AI.DEFAULT_MODEL.gemini`(지금 `gemini-3.5-flash-lite`), 8문장을 세그먼트 8개로 요청 1회. 앱의 `checkTranslation`·`parseAIJson`·`gemini` 어댑터(`endpoint`·`headers`·`bodyBuilder`·`responseParser`·`errorParser`)도 그대로 import 해 쓴다.
- ② 전부 부호 / ③ 필요한 곳만 부호 — 각각 별도 요청 1회(글자 변경 금지 지시, 같은 `segments[{i,t}]` 스키마).
- 검증: `stripTashkeel(②)`·`stripTashkeel(③)` 이 ① 과 같은가. 어긋난 문장만 1회 재요청, 그래도 어긋나면 그 문장을 빼고 콘솔에 보고. 첫 시도·재시도 뒤 일치율을 콘솔에 찍는다(spec 이 말한 "핵심 자료").
- `countTokens` 로 ①②③ 각각 토큰 수 → 데이터 파일과 콘솔(합계와 ②/① ③/① 배율).
- 출력 파일에는 문장·①②③·토큰 수·모델 이름·프롬프트 판·생성 날짜만.
- **키 안전**: `GEMINI_API_KEY` 환경 변수로만 받고 `x-goog-api-key` 헤더로만 보낸다. 요청마다 직전에 `assertNoKeyInUrl`(앱 `provider.js` 와 같은 검사 — 그 함수는 export 되지 않고 브라우저 모듈에 묶여 있어 같은 로직을 스크립트 안에 두었다) + `config.js` 의 `KEY_SHAPES` 모양 검사 + `?key=` 검사 → 걸리면 보내지 않고 중단. 응답 헤더는 읽지도 찍지도 않는다. 오류 문구는 키를 `[KEY]` 로 지운 뒤 출력. 데이터 파일을 쓰기 직전 키·키 모양이 섞였는지 한 번 더 본다.
- 429 면 40초 쉬고 한 번 더. 생성 사이 5초, `countTokens` 사이 0.4초 간격.

### 지침과 달리 한 것 (판단)
- **비교는 양쪽 다 부호를 지운 뒤**: 지침은 `stripTashkeel(②) === ①` 인데, 모델의 ① 번역 자체에 탄윈(ً) 같은 부호가 조금 들어 있을 수 있어 그대로 비교하면 글자가 같은데도 다 떨어진다. 그래서 `stripTashkeel(②) === stripTashkeel(①)` 로 비교하고, ① 안에 원래 있던 부호 개수를 콘솔에 함께 찍는다. ① 은 앱이 보여 주는 그대로 둔다.
- `stripTashkeel` 은 먼저 NFC 로 합친다 — 분해형 `ا+U+0653`(آ)·`ا+U+0654`(أ) 의 결합 부호가 지울 범위 안이라, 합치지 않고 지우면 글자가 바뀐다.
- 페이지 화면의 한 줄과 낱말 칩은 `stripTashkeel(①)` 이다(① 에 탄윈이 있어도 화면에는 부호 없음).

### tashkeel-ab.html (spec 6-6-7)
- 외부 요청 0(같은 폴더의 data.js 만 — 네트워크 기록으로 확인), 저장 0(새로고침하면 처음부터 다시 섞음), 키 0, 외부 라이브러리·CDN 없음.
- 아랍어 UI(`dir="rtl"`) + 작은 영어 보조. 세피아 바탕, 다크 모드 대응.
- 문장마다 세 판을 무작위로 섞어 `١ ٢ ٣` 로만 보여 준다(섞은 순서는 결과에 남는다). 화면에는 부호 없는 글 한 줄만.
- 속도 0.75(기본)/1.0, 판마다 [▶ ١][▶ ٢][▶ ٣] + [■ 정지]. 음성 고르기는 앱 `pickVoice` 와 같은 순서(localService > 이름에 Google > 첫 번째), 목록에 아랍어 음성이 없으면 `lang='ar-SA'` 만으로 말한다(8b-1).
- 질문 1(١/٢/٣/다 같다/다 틀렸다) · 질문 2(판마다 낱말 칩 한 줄, 눌러서 표시/해제) · 마지막 화면에 질문 3(예/아니요/차이가 크면) · [결과 복사].
- 결과 복사: `navigator.clipboard` 실패 시, 또는 1.5초 안에 답이 없으면(끝나지 않는 웹뷰 대비) 결과 글을 선택해 두고 "길게 눌러 복사" 안내.
- 진단 훅 `window.__tashkeelAB.boot(data)`·`.result()`(저장 없음).

결과 문자열 예(가짜 데이터로 화면에서 누른 실제 출력):
```
MedReader tashkeel A/B · data v1 · gemini-3.5-flash-lite · 2026-10-11 · n=3
voice: none-in-list → lang ar-SA · Arabic voices in list: 0
rate now: 1
UA: Mozilla/5.0 (...)
# N=① no marks · F=② full · P=③ partial. order = which version was behind ١ ٢ ٣
s1 order 1=P 2=F 3=N | pick 2=F | wrong 2=F[w2 الميثوتريكسات] | plays 1x0 2x1 3x0 @1
s2 order 1=N 2=F 3=P | pick - | wrong - | plays 1x0 2x0 3x0 @-
Q3: if-big
```

## 8개 영어 문장 (직접 씀, 원서 아님 · 113~121자)
1. s1 Methotrexate is the anchor drug in rheumatoid arthritis; liver enzymes and blood counts are checked every few months.
2. s2 Hydroxychloroquine reduces flares of systemic lupus erythematosus, but yearly retinal screening starts after five years.
3. s3 Anti-CCP antibodies are more specific than rheumatoid factor and may appear years before the first swollen joint.
4. s4 Ankylosing spondylitis causes inflammatory back pain that eases with exercise; HLA-B27 testing supports the diagnosis.
5. s5 In giant cell arteritis with visual symptoms, prednisone is started at once, even before the temporal artery biopsy.
6. s6 In gout, allopurinol is started at a low dose and raised slowly while colchicine prevents flares during the first months.
7. s7 Primary hyperparathyroidism often presents with hypercalcemia; a sestamibi scan helps locate the parathyroid adenoma.
8. s8 Radiofrequency ablation can shrink a parathyroid adenoma or benign thyroid nodule in patients who cannot undergo surgery.

## 검증
- `node apps/medreader/dev/tashkeel-make.mjs --dry` → 성공(3,450자, 문장 8개, 네트워크 0). 지금 data 파일이 이 결과다.
- 키 없이 실행 → 안내 후 종료 코드 2(요청 없음).
- 스크래치패드의 확인 스크립트(레포 밖):
  - `stripTashkeel`: `المِيثُوتْرِيكْسَات دَوَاءٌ أَسَاسِيٌّ` → `الميثوتريكسات دواء أساسي`, `آمِنٌ`→`آمن`, 분해형 `ا+U+0653`→`آ`, `عَلَىٰ`(U+0670)→`على` 모두 통과.
  - 키 그물: 실행 중 조각을 이어 만든 가짜 키(AIza 꼴·AQ. 꼴)를 URL 에 `?key=`·인코딩·경로로 넣으면 모두 `KeyInUrlError` 로 중단, 다른 키를 넘겨도 **모양만으로** 중단, 오류 문구에 키 없음, `redact` 가 `[KEY]` 로 지움.
  - 가짜 `fetch` 로 `main` 전체 흐름: 요청 26개(생성 4·재시도 포함 + countTokens 21) 모두 키는 헤더로만·URL 에 없음, ② 첫 시도에서 글자 바꾼 s3 는 재시도로 살아남고 ③ 에서 계속 바꾼 s8 은 빠짐, 결과 파일에 키 없음. 확인 뒤 `--dry` 로 자리표시 데이터로 되돌렸다.
- 브라우저(이미 떠 있던 `localhost:8000` 정적 서버 — 내가 띄운 것이 아니라 정리하지 않음):
  - 자리표시 상태: "준비 중" 안내만, 콘솔 오류 0.
  - 가짜 데이터 주입(`__tashkeelAB.boot`) 뒤 360×740: 자리표시·문장 화면·마지막 화면·복사 뒤 모두 `scrollWidth == clientWidth`(가로 스크롤 0), 보이는 버튼 61개 최소 높이 48px, 화면 한 줄에 부호 없음.
  - 실제 클릭으로 속도 1.0 → ▶٢ → 질문1 ٢ → 칩 표시 → 다음 ×3 → 질문 3 → [결과 복사]: 위 예시 문자열이 나옴. 이 내장 브라우저에서는 clipboard 가 답하지 않아 1.5초 뒤 선택 폴백으로 전환됨(472자 선택) — 폴백 경로 동작 확인.
  - 네트워크: `tashkeel-ab.html`·`tashkeel-ab.data.js` 두 개뿐(외부 0).

## 운영자가 돌릴 명령 (레포 루트에서, Node 22 이상)
PowerShell:
```
$env:GEMINI_API_KEY = "<키>"; node apps/medreader/dev/tashkeel-make.mjs; Remove-Item Env:GEMINI_API_KEY
```
bash:
```
GEMINI_API_KEY="<키>" node apps/medreader/dev/tashkeel-make.mjs
```
돌린 뒤: 콘솔의 "일치율"·"countTokens 합계" 줄을 spec 6-6-7 에 옮겨 적고, `tashkeel-ab.data.js` 를 열어 키가 없는지·문장 수(6개 미만이면 경고가 찍힘)를 보고, 로컬에서 페이지를 한 번 들어 본 뒤 커밋·배포 → Nour 에게 `…/apps/medreader/dev/tashkeel-ab.html` 링크.

## 남은 위험
- **Node 버전**: 스크립트가 앱의 `../js/*.js`(package.json 없는 ESM)를 그대로 import 하므로 Node 22.7+ 의 ESM 자동 판별이 필요하다(다른 dev 스크립트와 같은 방식). 이 PC 는 v24.14.0 으로 확인.
- **실제 모델 응답은 아직 안 봤다**: 부호 붙이기 지시를 모델이 얼마나 지키는지(글자 변경·타트윌(ـ) 추가) 모른다. 일치율이 낮아 남는 문장이 6개 미만이면 다시 돌리거나 문장을 바꿔야 한다. ③ "필요한 곳만"의 범위도 모델 판단이다.
- ① 은 8문장을 한 요청으로 번역한다(앱도 여러 문장을 한 청크로 보낸다). 앱 실제 청크보다 짧아 번역 결과가 조금 다를 수 있다.
- 무료 티어 한도: 생성 3~5회 + countTokens 24회. 429 는 한 번만 40초 기다린다 — 그 뒤에도 막히면 중단된다(파일은 그대로).
- `countTokens` 는 글만 세는 입력 토큰이다 — 실제 응답 출력 토큰(JSON 포장 포함)과 조금 다르다. 배율 비교에는 충분하다고 본다.
- 페이지: 데이터 파일이 GitHub Pages 캐시(약 10분)에 걸려 배포 직후 옛 자리표시가 보일 수 있다 — 배포 뒤 10분쯤 기다렸다가 링크를 보낸다.
- 섞은 순서는 저장하지 않는다(저장 0) — Nour 가 중간에 새로고침하면 처음부터 다시 섞인다. 결과에 순서가 남으므로 판정에는 문제없다.
- 실기기(Nour 의 Android Chrome)에서 `cancel()` 직후 `speak()` 가 삼켜지는 경우를 대비해 말하던 중이면 80ms 뒤에 말하게 했다 — 실기기 확인은 안 했다.
