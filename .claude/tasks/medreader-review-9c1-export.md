# Review 지침 — 9c-1 백업 내보내기

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "9c-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r9c1/`(Build 의 `b9c1/` 는 읽기만 — 합성 파일 `b9c1/dl/h-150k.jsonl.gz` 재사용 가능, 새 150MB 합성은 만들지 말 것 — 디스크). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-4-1 전부(+ `[정정 2026-11-17 — 9c-1 Build]`·⑦ 힙 기준 조정)·13절(백업 파일 행)·3-2·9-3 한 줄, `.claude/tasks/medreader-crossstep-notes.md` 의 "9c" 줄들, 지침 `.claude/tasks/medreader-build-9c1-export.md`, 보고서 `.claude/tasks/medreader-build-9c1-export-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/text/backup.js`·`js/backup/export.js`·`js/ui/backup.js`·`tests/backup-9c.test.mjs`).

## 확인할 것
1. **키·개인정보(가장 중요)**: 가짜 키를 **네가 새로 고른 자리**(문서 제목·파일 이름·단어 메모·필기·검색 최근·링크 이름/주소·사용량 행·캐시 값·설정 허용 키 값·`langGuess`)에 심고 내보낸 파일(gzip 풀어서)에 키 문자열·REDACT 일치 0. 정적 import(`backup/*`·`text/backup.js` → `privacy/`·`ai/`·`ui/` 0, `localStorage`·`sessionStorage` 낱말 0)를 import 그래프로 **간접**까지(`config`·`text/*`·`db`·`hash` 가 다시 무엇을 import 하는지). 허용 목록 분류(55키)가 "기기 몫·개인정보 몫은 안 담음" 원칙에 맞는가 — 특히 `ai.*` 9개(`ai.provider`·`ai.model` 은 괜찮나, 키 꼴 값이 들어갈 수 있는 키는?), `search.recent`(검색어 — 개인 기록이지만 설계는 담음), `links.medical`.
2. **파일 꼴**: 머리·rec·끝 줄, 스토어 순서, `counts`, 날 줄바꿈 0, 줄마다 `JSON.parse`, gzip 이 없을 때 평문 `.jsonl`, 파일 이름 시간대. `docForBackup` 이 `extraction`·`sectionIndex*`·알 수 없는 필드를 빼는가 — 정정에서 더한 `lastOpenedAt`·`outlineV`·`columnsHint` 가 사용자 몫이 맞는가.
3. **순수 함수(9c-2 가 쓸 것)**: `mergeRecord` 정정 규칙(문장 카드 `max(updatedAt, reviewedAt)`·term `importPlan` 그대로·충돌이면 기기 값·`edited` 파일 값·복습 필드는 `reviewedAt` 늦을 때만·usage 객체 안 큰 값·`capWarned` OR·progress `@read` 합집합)이 멱등이고 기기 데이터를 덮지 않는가 — 네가 새로 만든 표본으로. `remapRecord` 가 캐시 키 셋째 칸만·`w=…` 그대로. `lineSplitter` 조각 경계·`\r\n`·마지막 줄.
4. **메모리**: 15만 개 합성(`b9c1` 파일을 IDB 에 넣는 방법은 Build 하네스 재사용 — 새로 만들지 말 것)으로 읽기 단계 ≤ +64MB·남는 양 ≤ +4MB 를 다시 재고, 힙 기준 조정(⑦)의 근거가 맞는지 — "압축 흐름 조각"이 실기기 폰에서 OOM 위험이 되는지 판단(실기기 확인 목록에 넣을지).
5. **화면**: 카드 360×740·412×915 × 4언어, 진행 막대 `aria-live`, 캐시 포함 체크, 책별 PDF 받기(Blob 그대로·이름·크기), 30일 주의 색, 서재 `[백업]` 링크, 가로 넘침 0, 48px, `innerHTML` 0. 설정 화면 열 때 `cacheSize()` 3초(보고서 남은 3) — 설정 화면이 그동안 멈추는지.
6. **회귀**: 설정(8c-2 `#/settings/cache`·사용량)·서재·단어장 CSV·18 링크 카드, 8d D8 import 고리(보고서가 고친 것), 번역 요청 본문 바이트 HEAD 와 같음.
7. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
8. 변이 3개 이상 네가 고른 곳(Build M1–M12 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r9c1/bak/`).
9. headless: Edge `--enable-precise-memory-info`, pipe, 새 프로필 `r9c1/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**. 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 키·동의·기기 몫이 파일에 들어감, 금지 import(간접 포함), 파일 꼴이 설계와 달라 9c-2 가 읽을 수 없음, `mergeRecord` 가 기기 데이터를 덮거나 멱등이 아님, 화면 멈춤·회귀·콘솔 오류, 폰 OOM 이 거의 확실한 메모리 꼴.
- **낮음**(→ "배포 가능"): 진행 글자·문안·실기기 확인 거리·성능 다듬기.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 수정 범위: `review.md` 끝 절, 스크래치패드 `r9c1/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
