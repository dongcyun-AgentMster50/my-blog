# MedReader 인계 문서

> **새 세션에서 이어받을 때 이 파일을 가장 먼저 읽는다.**
> 마지막 갱신: 2026-09-21 (1~4단계 완료, 5단계 착수 전)

## 한 줄 요약

의학 원서 PDF 리더·학습 웹앱. **spec 19절 10단계 중 1·2·3·4단계 완료. 다음은 5단계(TTS).**
브랜치 `claude/medreader-spec-planning-i8ge24`. 테스트 **205개 전부 통과**.

**지금 실제로 되는 것**: PDF 가져오기 → 729쪽 추출·저장 → 리플로우로 읽기 → `Aa`(글자·행간·글꼴·테마 5종) → 4개 언어·RTL.
`[사용자 실기기 확인]` 729쪽 전수 추출 완료(`done`·`cursor 730`·`failed []`), 중복 방지 동작, `derivedHash` 저장 확인.

## 새 세션 시작 프롬프트 (그대로 붙여넣기)

```
my-blog 레포, 브랜치 claude/medreader-spec-planning-i8ge24 에서 MedReader 작업을 이어받는다.

먼저 이 순서로 읽어라:
1. .claude/tasks/medreader-handoff.md   ← 인계 문서. 현재 상태·주의사항이 전부 여기 있다
2. apps/medreader/spec.md                ← 승인된 설계. 20절 + 2-4. 여러 번 수정되었으니 현재 파일이 기준
3. apps/medreader/review.md              ← 1·1b·1c·1d·2a·2b·2c 검증 보고서
4. CLAUDE.md                             ← Plan→Build→Review→Embed 사이클, 서브에이전트 규칙

그 다음 인계 문서의 "다음 할 일"부터 진행한다.
```

## 프로젝트 맥락 — 반드시 알아야 할 것

- **대상 PDF는 임시본이다.** 지금 검증에 쓰는 `C:\Users\YDC\Downloads\ILMA_2021_20th_ed_Harrison.pdf`(729쪽, 22.7MB)는 임시고, **7000쪽 실제 자료**가 곧 온다. `[사용자 확인]` **형식은 유사하다**(같은 계열 조판, 텍스트 PDF·스캔본 아님).
- 따라서 위험은 "미지의 형식"이 아니라 **10배 규모**다. 저장 용량·추출 재개·메모리.
- **사용자는 빨리 전달 가능한 물건을 원한다.** 3·4·5단계까지가 "쓸 수 있는 물건"(PDF 열기 → 리플로우 읽기 → 낭독). 6~10은 그 위에 얹는 기능이다.
- **특정 서적 지표를 소수점까지 끌어올리는 작업은 하지 않는다.**

## 환경 (확인 완료, 재검증 불필요)

| | |
|---|---|
| 레포 | `D:\01_claude_my-blog` (Windows). Bash 도구에서는 `/d/01_claude_my-blog` |
| Node | v24.14.0. Python은 `python` (`python3` 없음) |
| **테스트** | **`node --test "apps/medreader/tests/*.test.mjs"`** — 디렉터리 인자는 Node 24+Windows에서 **실패한다** |
| 브라우저 | `preview_start {name:"blog"}` (`python -m http.server 8000`) → `http://localhost:8000/apps/medreader/...`. **새 탭**으로 열 것(모듈 캐시). `launch.json` 수정 금지 |
| pdf.js | **`5.4.149` 고정.** 6.3.289는 `Map.prototype.getOrInsertComputed`(TC39 Stage 3)를 써서 사용자 Chrome에서 **로드 즉시 죽는다** |
| Node용 pdf.js | **`pdfjs-dist/legacy/build/pdf.mjs`** 를 import 할 것 — 일반 빌드는 `DOMMatrix is not defined`로 죽는다 |
| 하네스 | `C:\Users\YDC\AppData\Local\Temp\claude\D--01-claude-my-blog\ba4903bd-caaf-4b72-9d02-05694b9269f5\scratchpad\diag\` 에 `pdfjs-dist@5.4.149` 설치본과 측정 스크립트들 |

## 지금까지 만든 것

```
apps/medreader/
├─ spec.md              승인된 설계. 실측으로 12군데 수정됨(아래 "spec 수정 이력")
├─ review.md            1·1b·1c·1d·2a·2b·2c 검증 보고서
├─ index.html           화면 골격 — 모든 <section data-screen>
├─ css/                 tokens(테마 5종)·base·screens·reader
├─ js/
│  ├─ config.js         pdf.js 버전, LAYOUT 파라미터, KEEP_HYPHEN_*, EXTRACT
│  ├─ text/             ★ 순수 계층 — 브라우저 API를 모른다. Review 통과
│  │  ├─ lines.js       정규화·Y 클러스터링·run 분할·공백 결합·bbox
│  │  ├─ columns.js     거터 검출·컬럼 재편·읽기 순서
│  │  ├─ blocks.js      역할 판정·표 감지·문단 그룹핑
│  │  ├─ hyphen.js      하이픈 줄바꿈 결합
│  │  ├─ segment.js     문항·보기·정답 패턴
│  │  ├─ layout.js      buildPageLayout 파이프라인, algoVersion = 6
│  │  └─ store.js       toStored/fromStored/derivedHash, storeVersion = 1
│  ├─ db.js             IndexedDB. DB_VERSION = 2, 스토어 13개
│  ├─ hash.js           fileHash(8MB 초과는 표본), 캐시 키
│  ├─ pdf/loader.js     pdf.js 동적 로드, jsDelivr→cdnjs 폴백
│  ├─ pdf/extract.js    Extractor. 9-4 커서 재개, 우선순위 큐
│  ├─ router.js         해시 라우터 (parseRoute 는 순수)
│  ├─ settings.js       settings 스토어 래퍼 (9-3 키)
│  ├─ i18n/             index + ar·en·fr·ko (ar·en 은 실제 번역)
│  └─ ui/
│     ├─ onboarding.js  3화면 + requestPersist()
│     ├─ library.js     서재·가져오기·중복방지(pageCount 2차 비교)
│     ├─ reader.js      ★ 리플로우 뷰. 5단계 계약(flowLineIds·setCurrent·lineElement)
│     └─ typeset.js     Aa 팝오버
├─ tests/               205개
└─ dev/
   ├─ proto-lines.html  줄·컬럼·표를 눈으로 확인하는 도구
   ├─ proto-extract.*   추출·저장을 눈으로 확인하는 도구 (배선 예제로도 쓸 것)
   └─ profile.mjs       ★ PDF 특성 측정. 새 자료 받으면 가장 먼저 돌린다
```

### `dev/profile.mjs` — 새 자료를 받으면 이것부터

```bash
MEDREADER_PDFJS=<pdfjs-dist 경로> node apps/medreader/dev/profile.mjs <pdf> --stride 10 --json profiles/new.js
```

거터 폭·본문 폰트·문항 번호 형식·보기 글자 범위·캡션 문법·쪽번호 자릿수·품질 지표·예상 용량을 재고,
**코드 상수와 어긋나는 항목을 "이 책에서는 죽은 코드"로 경고**한다.
`--stride`는 희소 사건(0.08% 짜리 F 보기)과 이웃 의존 항목(머리말·꼬리말)을 놓친다 → **연속 구간 전수 1회 + stride 전역 1회**를 함께.

## 실측으로 얻은 핵심 수치 (729쪽 기준)

| | |
|---|---|
| 2단 판정 | 232 / 729쪽 |
| 표 region | 256 |
| 문단 | question 1392 · option 6264 · answer 1187 · heading 1009 |
| P7(문항→보기 2~5개) | 66.3% (완화 기준 84%) |
| `buildPageLayout` | 0.6 ms/쪽 |
| 저장본 | **9.35 KB/쪽**(깨끗한 DB) · **12.32 KB/쪽**(재추출 후, 사용자 실기기) — JSON 바이트의 **0.40배** |
| **7000쪽 환산** | **≈ 84MB**(보수적) — 사용자 기기 quota 285GB 의 **0.03%**. 용량 위험 없음 |

## spec 수정 이력 — 전부 실물을 만나고 나서 드러났다

| 절 | 무엇이 틀렸나 |
|---|---|
| 2-3·18 | pdf.js 고정 기준이 "npm latest"였다 → **"목표 기기에서 도는 가장 최신"** |
| 4-2 | `item.width`의 **2.13%가 깨져 있다**(페이지 폭 초과·음수). 음수만 막고 있었다 |
| 4-3 | 위첨자 예외가 `sameLine` 안에서 **원리적으로 발동 불가** → 2차 통과로 이동 |
| 4-4 | `RUN_GAP_FACTOR 2.0` → **1.2**. 이 책 거터가 15pt인데 임계가 20pt라 2단 검출 전면 실패 |
| 4-5 | 거터 비율의 **분모가 틀렸다**. 한쪽 컬럼에만 있는 줄은 끊길 수가 없는데 분모에 있었다 |
| 4-7 | heading 짧은 줄 규칙에 문항·보기 가드 |
| 4-8 | 표 후보에 번호·글머리 라벨 가드 |
| 4-9 | kind 우선순위를 명문화, `answer` > `question`, `heading`을 뒤로 |
| 4-10 | `KEEP_HYPHEN_SUFFIXES` 신설(접두사로는 못 막는다) |
| 5-3 | 문항 번호가 `12.`가 아니라 **`I-42.`** 형식 |
| 9-1 | `DB_VERSION` 1 → **2** |
| 9-2 | 용량 추정이 3~7배 틀렸다 + **`derivedHash` 신설** |
| 9-4 | 재개 모델을 **명시적 커서 + 실패 목록**으로 |
| 2-4 | **신설** — 책별 프로파일(`BOOK_PROFILE`)과 측정 도구 |

**교훈: 합성 픽스처는 코드의 가정대로 만들어지므로, 테스트가 전부 통과해도 실제 문서에서는 틀릴 수 있다.**
`figure-caption` 정규식이 그 사례다 — 해당 형식 362줄이 있는데 감지 0건이었고 단위 테스트 59개가 전부 초록이었다.

## 반드시 지킬 것

1. **`config.js`의 `KEEP_HYPHEN_SUFFIXES`(23개)는 사용자가 직접 채운 값이다.** 건드리지 마라.
2. **`js/text/*`는 순수 계층** — `document`·`window`·`fetch`·`indexedDB`·`navigator`·`localStorage` 참조 0건(16-A가 grep으로 검사).
3. **서비스 계층은 UI 문자열을 만들지 않는다**(3-2). `loader`/`db`/`Extractor`는 코드·이벤트만 낸다(`ERR_PDFJS_LOAD`, `ERR_DB_QUOTA`, `fatal`, `stalled`…). UI가 i18n 키에 매핑한다.
4. **CSS는 논리 속성만** — `left`/`right`/`margin-left`/`margin-right` 0건(16-H가 grep). 예외는 원본 뷰 오버레이 좌표(6단계)뿐.
5. **레포에 PDF·원서 문장·`node_modules`·`package.json`을 넣지 마라.** 픽스처 문장은 지어낸다.
6. **`.nojekyll`을 지우지 마라** — 지우면 GitHub Pages가 `posts/*.md`를 삼킨다.
7. Build와 Review 서브에이전트를 **분리**하고 각각 `.claude/tasks/*.md` 지침 파일로 넘긴다(CLAUDE.md).
8. 서브에이전트는 **커밋하지 않는다.** 오케스트레이터가 직접 `node --test`와 실제 PDF로 재현한 뒤 커밋한다.

## 알려진 함정 — 같은 실수를 반복하지 마라

- **재개 모델에 같은 종류의 구멍이 5개 나왔다**(E16·E19 + Review가 찾은 3개). 전부 **"각각은 맞는 두 규칙이 만나면 깨진다"** 형태다. `extract.js`를 고칠 때는 **강제 실패를 주입**해 보라 — 코드를 읽어서는 안 보인다.
- **측정 도구도 틀릴 수 있다.** `profile.mjs`가 저장본을 34KB로 재고 있었다(실제 21.9KB, 7000쪽 환산 238MB vs 64MB). 도구가 내는 숫자도 다른 방법으로 대조하라.
- **`JSON.stringify` 바이트 ≠ IndexedDB 점유.** 0.40배다.
- **해시 충돌을 실제로 만들 수 있다**(표본이 파일의 13.22%). 가져오기에 `pageCount` 2차 비교가 필요하다 — 3단계가 넣는다.
- 남은 bbox 이탈 1,365줄 중 **846이 회전 줄**이다. `lineBBox`가 `width`를 수평 폭으로 더하는데 90° 회전 아이템의 `width`는 세로 진행량이라 **설계상 틀린다.** **4-12 하이라이트 오버레이가 회전 줄 bbox를 그리면 안 된다**(6단계 주의).

## 다음 할 일

### 지금 (5단계 — 다음 차례)
`tts/*` + 하단 컨트롤 바 + 하이라이트 + 자동 스크롤. **실기기 확인을 여기서 즉시**(16-C).
Android Chrome 제약이 spec 6-4에 정리되어 있다 — `onboundary` 없음, `pause()` 후 재개 불가, utterance GC로 `onend` 유실.

**4단계가 만들어 둔 계약 — 그대로 쓰라:**
```js
import { flowLineIds, lineElement, setCurrent, markDone, currentPage } from './ui/reader.js';
```
- `flowLineIds()` — **지금 DOM 에 있는 그 한 쪽**의 낭독 대상 줄 id 를 읽기 순서로 준다.
  `span.line[data-flow="1"]` 이고, 머리말·꼬리말·쪽번호·회전 줄은 `data-flow="0"`(접힌 `details` 안)이라 **낭독에서 빼야 한다.** 표 줄은 아예 DOM 에 없다.
- `setCurrent(lineId)` — `.is-current` 를 옮긴다. **그 줄이 현재 쪽에 없으면 `false`** 를 돌려준다 → 쪽을 먼저 넘기고(`location.hash`) 그다음 부른다.
- **`span.line.textContent` 를 그대로 음성 엔진에 넣지 마라.** 하이픈 결합 줄은 끝의 `-` 를 `span.hy`(`display:none`)로 **감췄을 뿐 텍스트에는 남아 있다** — 그대로 읽히면 "cardio 대시"가 된다. `describePage()` 의 `lines[i].hyphen !== 'none'` 이 "다음 줄과 이어진다"를 뜻하니 **두 줄을 한 발화로 묶는 쪽**이 낫다.
- **쪽이 바뀌면 DOM 이 통째로 갈린다.** 요소 참조를 들고 있지 말고 `lineId` 를 들고 매번 다시 찾아라.
- 색은 테마별 `--hl-bg`/`--hl-text`/`--hl-done`(`tokens.css`). **자동 스크롤(6-5)은 아직 없다 — 5단계 몫이다.**

### 이후
6 원본 뷰 · 7 AI 프로바이더 · 8 번역·요약 파이프라인 · 9 퀴즈 파서 · 10 마감.

### 이월된 결함 (차단 아님, 기록만)
- **`documents` 갱신 경합** — `Extractor._saveMeta` 와 리더의 마지막 위치 저장이 각각 `get → 수정 → put` 이라 한쪽 필드가 덮인다. 이어 읽기가 드물게 한 쪽 뒤로 갈 수 있다. 부분 갱신 헬퍼가 있으면 깔끔하다.
- **`library.js` 의 `openDoc`** 이 `blobs` 없을 때 조용히 `null` 을 돌려준다 — 사용자에게는 "영원히 멈춘 문서"로 보인다.
- 상단바 뒤로 버튼이 40px 로 16-G(48px)에 미달(`screens.css`).

### 보류 중인 것
- **`BOOK_PROFILE` 분리(2-4)** — 형식이 유사하다고 확인돼 우선순위를 낮췄다. 새 자료 특성이 실제로 다르면 그때 한다.
- 4-9의 stem 문단 분할(P7 66% → 84% 여지). spec 변경이 필요하고 9단계 파서가 `stemParaIds` 배열로 복원할 수 있어 차단이 아니다.
- `figure-caption` 정규식이 이 책에서 죽은 코드(362줄 중 0건). 2-4 프로파일 도입 시 함께.
