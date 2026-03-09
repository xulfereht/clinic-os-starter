# 2026-03-07 Public Skin System Audit

## 판단

현행 디자인 설정은 `theme tokens 일부 + CSS override 일부 + 4개 하드코딩 프리셋` 수준이다.
이 구조만으로는 다음 요구를 충족하기 어렵다.

- 퍼블릭 페이지 전체를 스킨 단위로 묶어 바꾸기
- 로컬 클라이언트가 에이전트에게 스킨 생성/수정을 맡기기
- Hero/MainHero 같은 복잡한 섹션을 안전하게 재설계하기
- 스킨을 재사용/공유 가능한 단위로 관리하기

## 핵심 미비점

1. 스킨 프리셋이 코드에 하드코딩되어 있고 설치된 로컬 스킨을 자동으로 보여주지 못함
2. `SectionRenderer` 가 실제 skin과 index를 넘기지 않아 스킨 리듬이 상당 부분 죽어 있음
3. 퍼블릭 섹션 변경이 `_local` 페이지 override와 홈페이지 override 플러그인으로 분산되어 있음
4. 로컬 클라이언트가 스킨을 만들 수 있는 안전 워크스페이스와 생성 경로가 없었음
5. Hero/MainHero 같이 구조가 큰 섹션을 토큰만으로 다루기 어려움

## 이번 배치 목표

- `src/skins/*`, `src/skins/local/*` 기반 skin pack 레지스트리 도입
- BaseLayout, SectionRenderer, admin/design을 skin pack 기준으로 정렬
- `npm run skin:create` 스캐폴드 추가
- local workspace, protection rules, agent context에 `src/skins/local` 반영

## 후속 과제

- 디자인 페이지 미리보기 surface를 더 확대
- 신규 코어 skin preset을 추가 제작
- 스킨 팩 검증/테스트 커맨드 추가
- 스킨 공유/스토어 제출 포맷 설계
