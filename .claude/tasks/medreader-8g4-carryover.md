# 8g-4(검색 화면) Build 지침에 반드시 넣을 것 — 8g-2·2b·2c Review 에서 넘어온 항목

> 8g-4 지침을 쓸 때 이 파일을 통째로 옮긴다. 출처는 review.md "8g-2 Review"·"8g-2b Review"·"8g-2c Review".

## 엔진 결과를 화면이 다루는 법
1. **세 통로를 모두 처리**: ① 정상 결과 ② `error` 가 붙은 결과 — 접두어로 가른다: `ERR_SEARCH_*`(검색어 문제, 적중 0) / `ERR_DB_*`(저장소 문제, **적중이 함께 올 수 있음** — 결과를 보여 주고 안내 한 줄) ③ **reject**(채우기 첫 실패·versionchange 뒤 `documents` 읽기 실패 P13 등) — 잡아서 일반 오류 안내.
2. **앞 세대(취소된) 검색의 reject 는 무시**한다 — 채우기를 기다리다 취소된 검색은 `cancelled` 가 아니라 reject 로 끝난다(8g-2c Review 관찰).
3. **같은 세대의 `onPartial` 은 덧붙이지 말고 바꿔 그린다** — 검색 중 `invalidate` 가 오면 한 검색에 `onPartial` 이 두 번 올 수 있다(P1b).
4. **서재 범위 검색은 책별 진행을 보인다** — 안 연 책도 백필한다(폰 한 권 3.5–8초 추정). S15 서재 시간은 "백필이 끝난 뒤" 기준.
5. 저장소가 찬 동안에는 입력 검색마다 실패하는 백필 묶음 하나를 되풀이한다 — 폰에서 최종 결과 지연을 S15m 에서 잰다.

## 테스트 보강 (8g-2c Review [권장, 낮음])
6. `cache === c` 검사를 빼는 변이를 잡는 테스트(다른 책 캐시가 늦은 실패로 지워지지 않음 — Review 탐침 R1d).
7. 표시 되돌림이 기존 표시를 덮어쓰는 변이를 잡는 테스트(실패 중 들어온 `notePage` 보존 — 탐침 R4).

## spec 문구 정리 (다음 spec 손볼 때)
8. 17-8-5 "닫힌 연결도 거절하지 않는다" → versionchange 뒤 `searchDoc`·`searchLibrary` 는 reject(P13) — 배너가 이미 뜸.
9. 17-8-5 "`onPartial` 한 번" → invalidate 시 두 번 가능.
10. 17-8-2 "서재 전체 ≤ 3초" → 백필이 끝난 뒤 기준.

## 브라우저·폰 실측 (8g-4 Review 몫)
11. S15 데스크톱 Chrome(백필 ≤ 2초 · 첫 검색 ≤ 300ms · 다음 ≤ 50ms · 서재), S15m 폰, 실제 IndexedDB 의 할당량·versionchange 동작(fake-idb 는 관대함).

## 8g-3 Review 에서 넘어온 것 (2026-10-19)
12. 목차 탭: `tocOf` 의 `source`·`outlineRead`·빈 목록 → `search.toc.fallback`(폴백 머리 문구 **반드시** 보임)·`search.toc.unavailable`·`search.toc.empty`. 폴백 전에 `engine.prepareDoc` 권장(또는 `tocOf` 폴백이 엔진 캐시 재사용·세션 메모리). 쪽 표시는 `printedLabel`("p. {인쇄} (PDF {쪽})"), `p:null` 항목은 흐리게·누를 수 없게.
13. (낮음) 배선 행동 테스트 — 가짜 `requestIdleCallback` 으로 `scheduleOutline` 동작(지금 테스트는 소스 정규식이라 R8·R9 변이가 살아남음), `SEARCH.ENABLED=false` 의 `off` 단언.
14. 쓰레기 개요 판정·폴백 품질은 **8g-3b** 가 먼저 한다(운영자 결정 2026-10-19) — 8g-4 는 그 결과를 쓴다.
