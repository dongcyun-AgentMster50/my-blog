# Plan 지침 — 8h 낭독 다듬기 (Nour 녹화 영상 분석)

> 너는 **Plan 서브에이전트**다. 코드를 고치지 않는다. 결과는 `apps/medreader/spec.md` 에 새 절로 쓰고,
> 같은 내용의 요약을 `.claude/tasks/medreader-plan-8h-report.md` 에 쓴다. **커밋하지 않는다.** 한국어로 쓴다.
> 운영자 승인 전에는 구현이 시작되지 않는다 — 결정이 필요한 곳은 선택지와 권장안을 적어라.

## 배경 — 운영자(오케스트레이터)가 직접 잰 사실

Nour(시리아, 류마티스 전공의, 아랍어 모국어)가 "아랍어 낭독 발음이 틀린다(발음 기호가 없어서, 특히 의학 용어)"며
52초 화면 녹화를 보냈다. 원본 보기, CMDT 2026 30쪽(앞부분 "Key/New Advances" 표), 0.75×, 낭독 동반 번역(speak).
음성 인식(faster-whisper medium, 구간별 언어 판정)과 2초 간격 장면으로 맞춘 결과:

| 시각 | 언어 | 들린 것 | 판정 |
|---|---|---|---|
| 0–2s | 영어 | "…practice **asterisk operator**" | 표 머리의 각주 기호 U+2217 을 TTS 가 문자 이름으로 읽음 |
| 2.5–9.6s | 아랍어 | "رقم الصفحة المستجدات الرئيسية…" | 표 열 머리("Page Number Key/New Advances…")가 한 문장으로 |
| 10–18.7s | 영어 | 본문 문장 | 정상 |
| 19.9–34.4s | 아랍어 | 본문 번역 | 음성 인식이 그대로 받아씀 — 알아들을 수 있음 |
| 35–39.5s | 영어 | "Dhanasekaran M et al. J Endocr Soc." | 인용 낭독 |
| 39.7–43.6s | 아랍어 | "دانا سكران اميعال جي اندو سورسوك" | **저자·학술지 약어의 아랍어 음역 → 뜻 없는 소리** |
| 43.9–50.6s | 영어 | "PMID thirty-nine million…" | 문헌 번호 5초 |

재현: `splitSentences('…reversed by RFA. Dhanasekaran M et al. J Endocr Soc. [PMID: 39502476]')` → 3 단위.
CMDT 2026 전권(`dev/probe-citations.mjs`, 앱과 같은 `sentenceUnits`): 단위 92,790 중 **인용만으로 된 단위 3,186(3.4%)** —
PMID 1,316 + "et al." 인용 1,870 — 이 **957쪽(49%)** 에 있다. 앞부분 표(25–40쪽)에서는 25%.
그 밖에 "[PMID: 38233678] • Weekly subcutaneous…" 처럼 **인용 꼬리가 다음 글머리(•) 항목과 한 단위로 붙은 것**이 있다(5자리 이상 숫자 단위 1,493).
합자 손실("Affecting"→"Aecting")은 그 표 머리 글꼴에만 — 197쪽 표본에서 0. 기록만.
**원본 보기에서 자막 띠가 보이지 않았다**(아랍어가 소리 났으니 유효 모드는 speak). CSS 로 숨기는 규칙은 못 찾음 — 재현이 필요하다.
기호 표 `TTS_SYMBOLS`(config.js)에 `∗ * † ‡ §` 처리가 없다.

**정직한 한계**: 이 영상에서 "깨진 아랍어"로 확인된 곳은 인용 구간이다. 본문 번역의 미세한 모음 오독(타슈킬)은
음성 인식이 문맥으로 보정하므로 이 방법으로는 판정할 수 없다. 타슈킬 문제가 따로 있는지는 Nour 가 들어 봐야 안다.

## 읽을 것
- `.claude/tasks/medreader-handoff.md` 끝부분, `apps/medreader/spec.md` 의 6-1(낭독 단위), 7-7/7-8(낭독 동반 번역), 8-x(파이프라인·캐시 키), 9-3, 16-D*
- `js/text/segment.js`(splitSentences, ABBREVIATIONS), `js/tts/text.js`(buildUnits, emit, 기호 표 적용), `js/ai/readalong.js`, `js/tts/speaker.js`, `js/ui/trband.js`, `js/ui/reader.js`(원본 보기 전환), `js/config.js`
- `apps/medreader/dev/probe-citations.mjs`
- 메모: 대상은 **여러 권·여러 언어**다 — 한 책(CMDT)의 모양에 맞춘 규칙 금지. 원문 언어는 문서 속성(`documents.lang`).

## 계획할 것 (각 항목: 설계·영향 범위·검증 방법·되돌림)
A. **인용 단위를 낭독·번역에서 뺀다** — 화면에는 그대로 둔다. 판별 규칙(PMID/PMCID/DOI 괄호, 짧은 "et al." + 학술지 약어 꼴, 번호 참고문헌 등)을
   언어·책에 기대지 않게. 오탐 비용(본문 문장을 건너뜀)이 미탐 비용보다 크다 — 기준과 측정 방법(전권 오탐 표본 검토)을 정하라.
   하이라이트·쪽 넘김·자동 스크롤·문장 번호(seq)·번역 캐시 키·선행 창(9,000자)에 미치는 영향. 설정 "인용도 읽기"(기본 끔) 여부.
B. **글머리 기호(•, ▪, – 줄머리)는 문장 경계** — 붙은 인용 꼬리가 다음 항목과 갈라지도록. 문장 키가 바뀌어 기존 번역 캐시가 일부 빗나가는 비용을 적어라.
C. **각주·기호 문자 낭독 정리** — `∗ * † ‡ §` 가 단어 끝/줄 끝 각주 표시일 때 소리에서 뺀다(수식의 곱셈 `*` 와 구분). 원문·번역문 양쪽.
D. **원본 보기에서 자막 띠 미표시** — 재현 절차(로컬 서버, 원본 보기, speak 모드)와 원인 후보, 고치는 범위. 재현 안 되면 그 사실을 기록.
E. **표 열 머리 행 낭독**(Topic/Page Number/…) — 기록만 할지, 규칙을 둘지 권장안.
F. **타슈킬(발음 기호) 실험** — 앱을 고치기 전에 **Nour 가 폰에서 귀로 비교하는 A/B 페이지**(예: `apps/medreader/dev/tashkeel-ab.html`, 기존 `dev/voices.html` 방식) 설계:
   같은 아랍어 의학 문장 6–8개를 "발음 기호 없음 / 있음" 두 버튼으로 낭독(speechSynthesis, lang ar). 문장 출처(이 영상의 본문 번역 포함),
   발음 기호본을 누가 어떻게 만드는가(미리 써 둔 것 vs Nour 의 키로 Gemini 에 즉석 요청 — 비용·키 안전 규칙 `assertNoKeyInUrl`/`KEY_SHAPES` 준수),
   Nour 가 답할 질문 2–3개(어느 쪽이 맞게 들리나, 틀린 단어는 무엇인가). 결과에 따라 앱 반영안(낭독용 발음 기호본을 번역과 함께 받기 — 출력 토큰 증가량 추정)을 조건부로.
G. 순서·단위 나누기(Build 한 번에 할 것 / 따로 할 것), algoVersion·DB 버전 변경 필요 여부(추출이 아니라 낭독 단위 단계라면 재추출 불필요한지 확인), 테스트·변이 목록.

## 금지
코드 수정·커밋·npm 설치·`git checkout/restore/stash`·`rm -rf`. 원서 문장을 40자 넘게 옮기지 않는다. 다운로드 폴더를 나열하지 않는다
(측정에는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 경로 하나만, pdf.js 는
`MEDREADER_PDFJS=C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/pdfjs`).
측정 스크립트가 필요하면 `apps/medreader/dev/` 에 새로 만들어도 된다(기존 파일 수정 금지).
