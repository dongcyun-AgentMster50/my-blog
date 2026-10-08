# Review 지침 — 7b 실키 결함 수정 검증

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **Build 보고를 믿지 말고 다시 재라.**
> 결과는 `apps/medreader/review.md` 끝에 "7b-fix" 절로 덧붙인다. **커밋하지 않는다.** 실제 키를 넣지 않는다. 한국어로 쓴다.

## 읽을 것
1. `.claude/tasks/medreader-build-7b-fix.md` — Build 가 받은 지침(무엇이 왜 바뀌어야 했는가)
2. `.claude/tasks/medreader-build-7b-report.md` 끝 "실키 확인 반영(2026-10-08)" — Build 의 주장(검증 대상)
3. `.claude/tasks/medreader-review-7b.md` — 지난 7b Review 의 기준(키 누출 기계 검사·문구·화면·변이). **같은 기준을 이번 변경에 다시 적용하라.**
4. spec 8-4(기본 모델·목록·`MODEL_UNAVAILABLE`), 12-7(번역 언어 선택·[시험 번역] 두 언어)
5. `git diff` 로 바뀐 범위

## 특히 볼 것
- **새 목록 엔드포인트의 키 누출**: `pageSize=1000`·`nextPageToken` 을 따라가는 요청마다 URL 에 키가 없는가. `pageToken` 값이 URL 에 실리는 것은 정상이지만, 그 값에 키가 섞이는 경로가 없는가(`assertNoKeyInUrl` 이 쪽마다 걸리는지 코드와 스텁으로).
- **판정 순서**: REGION 두 줄 → R1 AUTH → `MODEL_UNAVAILABLE` → 나머지. 404 를 쓰는 다른 경로(검증 엔드포인트가 404 를 낼 때)가 엉뚱한 안내를 내지 않는가.
- **2.5 저장값 처리**: `gemini-2.5-*` 가 저장된 상태에서 화면·요청이 실제로 3.5 를 쓰는가(요청 URL 의 모델 이름으로 확인).
- **목록 필터**: 실제 공식 목록과 비슷한 스텁(예: `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.5-flash`, `gemini-3.8-flash-tts`, `gemini-3.1-flash-image`, `gemini-3.5-live-translate-preview`, `gemini-3.5-transcribe`, `text-embedding-…`, `veo-3.1-generate-preview`, `lyria-3.5`)으로 드롭다운에 번역용만 남는가. **`preview` 모델을 남길지 뺄지**는 지침에 없다 — 지금 동작을 기록하고 의견을 적어라.
- **[시험 번역] 두 블록**: 아랍어 블록 `dir=rtl lang=ar`, 한국어 블록 `lang=ko dir=ltr`. JSON 파싱 실패(잘린 JSON, 코드펜스 감싼 JSON) 때 화면이 깨지지 않고 원문이 보이는가. AI 응답에 `<img onerror>` 를 넣은 스텁이 문자 그대로 보이는가.
- **번역 언어 선택**: ar/ko 전환이 저장·새로고침 후 유지, 리더 속도 팝오버의 번역 관련 표시와 어긋나지 않는가.
- 360×800·360×740, 영어·아랍어 UI: 가로 스크롤 0, 버튼 48px 이상(실측표), 콘솔 0.
- **변이 테스트를 직접**: Build 가 보고한 것 중 최소 3개를 네가 다시, 그리고 Build 가 하지 않은 것 하나 이상(예: 목록 쪽 넘김에서 `assertNoKeyInUrl` 빼기). 원본은 스크래치패드에 복사 후 복사본으로 되돌린다(`git checkout`·`restore`·`stash` 금지).

## 고쳐도 되는 것
이번 변경 파일(`js/config.js` 의 모델 상수, `js/ai/provider.js`, `js/ai/adapters/gemini.js` 의 목록·`MODEL_UNAVAILABLE` 부분, `js/ui/settings.js`, `js/settings.js`, `js/i18n/*`, `css/screens.css`, 7b 테스트들) 안의 **결함 수정**만. REGION 두 줄·R1 AUTH 판정·`spec.md` 는 고치지 않는다. 범위 밖은 기록만.

## review.md "7b-fix" 절
결론(통과/조건부/불통과) · 항목별 결과와 확인 방법 · 키 누출 검사 · 화면 실측 · 변이 결과 · 고친 것/기록만 한 것 · 운영자 재확인 절차.
