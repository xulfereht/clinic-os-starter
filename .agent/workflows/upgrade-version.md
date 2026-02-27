---
description: Clinic-OS 버전 업그레이드 (Core/Starter 업데이트)
---

# Clinic-OS 버전 업그레이드

새 버전의 기능을 기존 시스템에 안전하게 적용합니다.

---

## 업데이트 유형

### 1. Core 업데이트 (앱 기능)
HQ 서버에서 최신 앱 패키지를 가져옵니다.
- 새로운 페이지/컴포넌트
- 버그 수정
- 기능 개선

### 2. Starter 업데이트 (인프라)
Starter Kit 저장소에서 최신 설정을 가져옵니다.
- 빌드 설정 변경
- 스크립트 업데이트
- 의존성 변경

---

## Phase 1: 백업 생성

// turbo
1. Git 상태 확인 및 현재 상태 저장
```bash
git status
git add -A && git commit -m "Backup before upgrade"
git branch backup-$(date +%Y%m%d)
```

---

## Phase 2: Core 업데이트

HQ에서 최신 앱 패키지를 가져옵니다.

// turbo
```bash
npm run core:pull
```

또는

```bash
npm run fetch
```

이 명령은:
- HQ 서버에서 최신 버전 확인
- 앱 패키지 다운로드
- `.docking/staging/`에 압축 해제
- 자동 적용

---

## Phase 3: Starter 업데이트 (필요시)

Starter Kit 인프라 변경이 있을 때 실행합니다.

// turbo
```bash
npm run update:starter
```

이 명령은:
- Git에서 최신 변경사항 pull
- npm install 자동 실행

---

## Phase 4: 도킹 패키지 적용 (수동 패키지)

외부에서 받은 `.zip` 패키지를 적용할 때:

// turbo
```bash
npm run upgrade
```

---

## Phase 5: DB 마이그레이션

새 버전에 DB 변경이 있는지 확인합니다.

```bash
ls migrations/    # 마스터 구조
ls core/migrations/  # 스타터킷 구조
```

새 마이그레이션이 있으면:
// turbo
```bash
npm run db:migrate
```

> v1.24.3부터:
> - `db:migrate`는 root의 `.docking/engine/migrate.js`를 직접 실행 (core:pull로 항상 최신 유지)
> - wrangler.toml 존재를 먼저 확인하며, 없으면 `npm run setup` 안내
> - `findProjectRoot()`가 `core/package.json`도 감지하여 스타터킷 구조 자동 지원
> - 마이그레이션 실패 시 seeds 실행을 자동으로 건너뜀
> - 에러 발생 시 `.agent/last-error.json`에 구조화된 보고서 저장

---

## Phase 6: 테스트

// turbo
```bash
npm run dev
```

주요 기능 테스트:
- [ ] 홈페이지 로드
- [ ] 관리자 로그인
- [ ] 기존 커스터마이징 유지 확인
- [ ] 새 기능 작동 확인

---

## Phase 7: 완료 처리

// turbo
```bash
git add -A && git commit -m "Upgrade to v[VERSION]"
```

배포가 필요하면:
```bash
npm run deploy
```

---

## 롤백 (문제 발생 시)

```bash
git checkout backup-[날짜]
git checkout -b main --force
```

---

## 명령어 요약

| 명령어 | 용도 |
|--------|------|
| `npm run core:pull` | HQ에서 앱 패키지 업데이트 |
| `npm run update:starter` | Starter Kit 업데이트 |
| `npm run upgrade` | 수동 도킹 패키지 적용 |
| `npm run setup` | 초기 설정 재실행 |
| `npm run db:init` | DB 스키마 마이그레이션 (root 엔진) |
| `npm run db:seed` | 샘플 데이터 삽입 |
| `npm run doctor` | DB 스키마 검증 + 자동 복구 |
| `npm run health` | 환경 건강 점수 (0-100) |

---

## 트러블슈팅

> 에러 발생 시 `.agent/last-error.json`이 자동 생성됩니다.
> 에이전트는 이 파일을 감지하면 `.agent/workflows/troubleshooting.md`를 참조하여 자동 복구하세요.

### core:pull 시 "깃 저장소가 아닙니다" 오류
스타터킷 구조에서 루트에 `.git`이 없을 때 발생합니다.
```bash
git init          # 루트에 .git 생성
npm run core:pull # 다시 시도
```
> v1.24.0부터 `update:starter`와 `fetch.js`가 자동으로 `git init`을 실행합니다.
> v1.24.3부터 git fetch 에러 메시지가 원인별로 구분됩니다 (not a git repo / No such remote / 네트워크).

### 디바이스 등록 한도 초과
v1.24.0부터 클라이언트당 최대 5대까지 등록 가능합니다.
기존 3대 제한에 걸렸다면 HQ에서 자동 상향되었습니다.

---

## 주의사항

- 업그레이드 전 **반드시 백업**
- 프로덕션 배포 전 **로컬 테스트 필수**
- 충돌 발생 시 **사용자에게 설명 후 결정**

---

## 관련 문서

| 상황 | 다음 문서 |
|------|-----------|
| 업데이트 중 오류 발생 | `.agent/workflows/troubleshooting.md` |
| 보호 규칙 확인 | `.claude/rules/clinic-os-safety.md` |
| 전체 문서 인덱스 | `.agent/README.md` |
