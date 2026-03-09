# HQ Public Alignment Plan (2026-03-07)

## 이번 배치에서 정렬한 항목

- 운영 HQ에서 community skin 제출 -> 승인 -> 설치 스모크 검증 완료
- HQ 홈 랜딩에 agent-driven 설치/복원/스킨 스토어 흐름 반영
- HQ `Windows/macOS 설치 가이드`를 `bash 설치까지만 사람, 이후는 에이전트` 기준으로 정렬
- HQ `로컬 vs 프로덕션`, `마이그레이션과 재설치 이관`을 최신 수명주기/복원 경로 기준으로 재작성
- HQ 홈 랜딩/온보딩/다운로드/체인지로그에서 고정 가격·얼리버드·단톡방 중심 카피를 상시 온보딩/질문 채널 문구로 정리

## 아직 남아 있는 HQ 최신화 범위

### P0

- HQ 홈/가이드에서 `설치 상태 진단 -> lifecycle -> snapshot -> restore` 흐름을 시각적으로 더 잘 연결
- HQ `/plugins` 와 `/survey-tools` 소개면에 최신 agent-driven 생성/설치 경로 반영 여부 점검

### P1

- HQ 가이드 전체에서 raw 명령 나열보다 `에이전트에게 어떻게 요청할지` 중심으로 표현 통일
- HQ 퍼블릭 페이지에 `skins / plugins / survey-tools` 생태계 연결을 더 명확히 노출
- HQ 공개 페이지와 로컬 관리자 페이지의 실제 기능 범위를 비교하는 링크 구조 정리

### P2

- HQ 가이드별 "최종 업데이트 기준 기능" 배지 또는 변경 이력 노출 검토
- 최신 코어 기능이 반영되지 않은 레거시 설명 문서를 `history/archive` 영역으로 내리는 정책 검토

## 후속 작업 제안

1. HQ `/plugins`, `/survey-tools`, `/guide` 랜딩을 각각 코드베이스 기준으로 재감사
2. 홈 랜딩과 가이드에 `테스트 클라이언트 / 운영 검증 / 안전 배포` 흐름을 더 명시적으로 추가
3. 변경 후 `hq build + guide sync + production deploy`를 한 배치로 운영
