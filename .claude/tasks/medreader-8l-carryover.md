# 8l(스캔본·글자 깨짐 감지) Build 지침에 넣을 것 — 2026-10-19 운영자 PC OCR 에서 발견

## 세 번째 꼴: "그리기 명령은 있는데 추출 글자 0"
- 실물: `G:/01_Language/01_English/리딩속도를 늘리기위한 책/해리포터/2. 해리포터와 비밀의 방/Harry Potter & The Chamber of Secrets.pdf` (341쪽, Acrobat Distiller 5.0.5).
- 쪽마다 `showText` 55–79회·`setFont` 가 있는데 pdf.js `getTextContent` 항목은 **0** — 글꼴에 글자 매핑이 없다. 조사(survey)에서는 `notext` 로 분류됐다.
- OCRmyPDF `--skip-text` 는 "글자 있음"으로 보고 **건너뛴다**(5초, 결과 0자). **`--force-ocr` 가 필요**하다 — 스피쿠스(깨진 매핑)와 같은 처리.
- 그러므로 spec 17-5-1·19-1-3 의 판정 셋(scan / garbled / text)에 **이 꼴을 OCR 필요로** 넣어야 한다: 표본 쪽에서 글자 0 인데 이미지 연산이 없고 텍스트 연산(`showText` 등)이 있으면 → "글자 매핑 없음(강제 OCR 필요)". `notext`(진짜 빈 쪽) 와 구분.
- 안내 문구·가이드: 스캔본은 `--skip-text`, 깨짐·매핑 없음은 `--force-ocr`.

## 운영자 PC OCR 실측 (가이드 근거)
- 가벼운 판(`--skip-text --rotate-pages`)은 크기 ≈ 원본, 인식은 고품질 판(`--deskew --oversample 300`, 크기 ×3)과 거의 같음(Advanced Grammar 40–45쪽 이상한 낱말 58 vs 64).
- 영어 23권 약 4,100쪽: 51분, 705 MB, 실패 0. 이상한 낱말 0.4–6.3%(발음기호 많은 책이 높음).
- `TESSDATA_PREFIX` 를 따로 둘 때는 `configs/`·`tessconfigs/` 도 함께 복사해야 한다(없으면 `TesseractConfigError: hocr`).
- 한국어(`kor`, tessdata_fast) OCR 은 글자 사이를 띄우는 경우가 있다("패 턴 이 사 용 된") — 8m(영한 혼합)·낭독에서 확인할 것.
