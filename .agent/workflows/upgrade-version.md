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
ls migrations/
```

새 마이그레이션이 있으면:
// turbo
```bash
npx wrangler d1 migrations apply clinic-os-dev --local
```

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

---

## 주의사항

- 업그레이드 전 **반드시 백업**
- 프로덕션 배포 전 **로컬 테스트 필수**
- 충돌 발생 시 **사용자에게 설명 후 결정**
