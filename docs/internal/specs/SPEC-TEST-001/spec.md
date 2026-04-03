---
id: SPEC-TEST-001
version: "1.0.0"
status: draft
created: "2026-01-28"
updated: "2026-01-28"
author: "Alfred"
priority: "HIGH"
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|-----|------|-------|---------|
| 1.0.0 | 2026-01-28 | Alfred | 초안 작성 |

---

# SPEC-TEST-001: 관리자 페이지 E2E 테스트 프레임워크 구축

## 1. 개요

관리자 페이지의 API 및 UI 기능이 정상 작동하는지 검증하기 위한 E2E(End-to-End) 테스트 프레임워크를 구축합니다.

### 1.1 배경

- 직원 삭제 기능이 API는 동작하지만 목록에서 필터링되지 않는 버그 발생
- 현재 테스트 코드 부재로 이런 통합 버그를 사전에 발견하지 못함
- CRUD 작업 후 실제 UI 상태 검증이 필요

### 1.2 목표

- Playwright 기반 E2E 테스트 환경 구축
- 로컬 D1 테스트 DB를 활용한 격리된 테스트 환경
- 핵심 관리자 기능(직원, 환자, 예약)에 대한 기본 테스트 커버리지

### 1.3 비목표

- 전체 페이지 100% 커버리지 (점진적 확장)
- CI/CD 파이프라인 통합 (후속 SPEC)
- 성능/부하 테스트 (별도 SPEC)

---

## 2. 요구사항 (EARS Format)

### 2.1 Ubiquitous Requirements

**REQ-001**: 시스템은 테스트 실행 시 프로덕션 DB가 아닌 테스트 전용 D1 DB를 사용해야 한다.

**REQ-002**: 시스템은 테스트 시작 전 테스트 DB를 초기화하고 시드 데이터를 삽입해야 한다.

### 2.2 Event-Driven Requirements

**REQ-003**: `bun run test` 명령 실행 시, 시스템은 테스트 DB 초기화 → 시드 데이터 삽입 → E2E 테스트 실행 → 결과 리포트 순으로 동작해야 한다.

**REQ-004**: E2E 테스트 실패 시, 시스템은 실패한 테스트의 스크린샷과 트레이스를 저장해야 한다.

### 2.3 State-Driven Requirements

**REQ-005**: 테스트 DB가 존재하지 않는 상태에서 테스트 실행 시, 시스템은 자동으로 테스트 DB를 생성해야 한다.

**REQ-006**: 테스트가 완료된 상태에서, 시스템은 테스트 결과 리포트(HTML)를 생성해야 한다.

### 2.4 Optional Feature Requirements

**REQ-007**: 사용자가 `--headed` 옵션을 제공하면, 시스템은 브라우저를 시각적으로 표시하며 테스트를 실행해야 한다.

**REQ-008**: 사용자가 특정 테스트 파일을 지정하면, 시스템은 해당 파일만 실행해야 한다.

### 2.5 Unwanted Behavior Requirements

**REQ-009**: 테스트 실행 중 프로덕션 DB 연결 시도가 발생해서는 안 된다.

**REQ-010**: 테스트 데이터가 개발 환경 DB에 영향을 주어서는 안 된다.

---

## 3. 기술 제약사항

### 3.1 기술 스택

| 영역 | 기술 | 버전 | 비고 |
|-----|-----|------|-----|
| E2E 프레임워크 | Playwright | ^1.40.0 | Chromium, Firefox, WebKit 지원 |
| 테스트 러너 | Playwright Test | ^1.40.0 | 내장 테스트 러너 |
| DB | Cloudflare D1 | Local | wrangler d1 execute --local |
| 패키지 매니저 | Bun | 1.0+ | 기존 환경 유지 |

### 3.2 환경 분리

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Production    │   Development   │      Test       │
├─────────────────┼─────────────────┼─────────────────┤
│ clinic-os-prod  │ clinic-os-dev   │ clinic-os-test  │
│ (Cloudflare)    │ (Local/Remote)  │ (Local Only)    │
└─────────────────┴─────────────────┴─────────────────┘
```

### 3.3 디렉토리 구조

```
clinic-os/
├── tests/
│   ├── e2e/
│   │   ├── admin/
│   │   │   ├── staff.spec.ts      # 직원 관리 테스트
│   │   │   ├── patients.spec.ts   # 환자 관리 테스트
│   │   │   └── reservations.spec.ts
│   │   ├── auth/
│   │   │   └── login.spec.ts      # 로그인 테스트
│   │   └── fixtures/
│   │       └── auth.ts            # 인증 fixture
│   ├── global-setup.ts            # DB 초기화
│   └── global-teardown.ts         # DB 정리
├── seeds/
│   └── test-data.sql              # 테스트 시드 데이터
└── playwright.config.ts           # Playwright 설정
```

---

## 4. 테스트 대상 범위

### 4.1 1차 우선순위 (이번 SPEC)

| 페이지 | 테스트 케이스 | 우선순위 |
|-------|-------------|---------|
| 직원 관리 | CRUD 전체 흐름 | HIGH (버그 발생 영역) |
| 로그인 | 인증 성공/실패 | HIGH |
| 환자 관리 | 목록 조회, 상세 보기 | MEDIUM |

### 4.2 2차 우선순위 (후속 확장)

- 예약 시스템
- 결제/배송
- 설정 페이지

---

## 5. 의존성

### 5.1 내부 의존성

- `wrangler.toml`: D1 테스트 DB 바인딩 추가 필요
- `migrations/`: 테스트 DB 스키마 동기화
- `seeds/`: 테스트 시드 데이터 파일

### 5.2 외부 의존성

- `@playwright/test`: E2E 테스트 프레임워크
- Chromium: 헤드리스 브라우저

---

## 6. 위험 요소 및 완화 방안

| 위험 | 영향 | 완화 방안 |
|-----|-----|---------|
| 테스트 DB 격리 실패 | 프로덕션 데이터 손상 | 환경 변수로 DB 바인딩 강제 분리 |
| 느린 테스트 실행 | 개발 생산성 저하 | 병렬 실행, 선택적 테스트 지원 |
| 플레이키 테스트 | 신뢰성 저하 | 재시도 로직, 안정적 selector 사용 |
