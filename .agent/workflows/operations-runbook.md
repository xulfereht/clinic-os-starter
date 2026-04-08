---
description: 설치 완료 후 일상 운영 절차의 SOT. 업데이트, 배포, 백업, 모니터링 시 참조.
category: ops
---

# 운영 런북

> 이 문서는 설치 완료 후 운영 시 에이전트와 사람이 참조하는 SOT입니다.
> 코어 업데이트, 배포, 백업, 일상 관리 절차를 다룹니다.

---

## 코어 업데이트 (core:pull)

### 절차

```bash
# 1. 현재 상태 확인
npm run core:status

# 2. 백업 (권장)
git commit -am "pre-update checkpoint"
npm run db:backup

# 3. 업데이트 수신
npm run core:pull
# → 코드 파일 업데이트
# → migrations/ DDL 자동 적용 (새 스키마)
# → seeds/ 미적용 시드 자동 실행 (새 기능 기본 데이터)
# → SOUL.local.md, MANIFEST.local.md 갱신
# → .claude/commands/ 스킬 갱신
# → .agent/workflows/ 런북 갱신

# 4. 빌드 확인
npm run build

# 5. 헬스 체크
npm run health
npm run doctor
```

### 업데이트 후 자동으로 일어나는 것

| 항목 | 동작 | 추적 방법 |
|------|------|----------|
| DDL 마이그레이션 | 새 ALTER TABLE/CREATE INDEX 적용 | `d1_migrations` 테이블 |
| 시드 데이터 | 미적용 시드만 실행 (d1_seeds 추적) | `d1_seeds` 테이블 |
| 스킬 업데이트 | .claude/commands/ 파일 교체 | skill-registry.json |
| 에이전트 문서 | SOUL/MANIFEST/런북 갱신 | core:pull 로그 |

### 업데이트 후 수동으로 해야 하는 것

- **프로덕션 배포**: `npm run deploy` (deploy-guard가 리모트 마이그레이션 자동 적용)
- **빌드 실패 시**: `npm run build` 에러 확인 → `npm install` → 재빌드
- **마이그레이션 충돌**: `npm run doctor` → 스키마 검증 → 수동 해결

---

## 배포 (deploy)

### 절차

```bash
# 1. 빌드
npm run build

# 2. 배포 (deploy-guard 자동 실행)
npm run deploy
# → deploy-guard.js:
#   - D1/R2 바인딩 확인
#   - 리모트 마이그레이션 갭 체크 → 자동 적용
#   - 보안 설정 검증
#   - Cloudflare Pages 배포
```

### deploy-guard가 체크하는 것

| 체크 | 실패 시 |
|------|---------|
| D1 database 접근 | 배포 차단 — wrangler.toml 확인 |
| R2 bucket 접근 | 경고 — 파일 업로드 불가 |
| 리모트 마이그레이션 갭 | 자동 적용 (non-interactive) |
| ADMIN_PASSWORD 기본값 | 경고 |
| 보안 설정 | 경고 |

### 배포 전 체크리스트

```
[ ] npm run build 성공
[ ] npm run health → score >= 80
[ ] git status → 변경사항 커밋됨
[ ] wrangler.toml database_id가 유효
```

---

## 백업

### DB 백업

```bash
npm run db:backup                    # D1 스냅샷
npm run db:backup -- --restore       # 복원
```

- 배포 전, core:pull 전, 위험한 DB 작업 전에 실행
- `.agent/protection-snapshots/`에 자동 스냅샷 저장

### 코드 백업

```bash
git commit -am "checkpoint before risky operation"
npm run agent:snapshot               # 전체 상태 스냅샷 (코드 + DB + 설정)
```

---

## 일상 운영 명령어

| 상황 | 명령어 |
|------|--------|
| 환경 상태 확인 | `npm run health` |
| DB 스키마 검증 | `npm run doctor` |
| 코어 버전 확인 | `npm run core:status` |
| 온보딩 진행 | `/onboarding` 스킬 |
| 블로그 작성 | `/write-blog` 스킬 |
| 시스템 대시보드 | `/status` 스킬 |
| 문제 해결 | `/troubleshoot` 스킬 |

---

## 문제 해결 빠른 참조

| 증상 | 원인 | 해결 |
|------|------|------|
| 빌드 실패 | 의존성 미설치 | `npm install && npm run build` |
| 페이지 500 에러 | DB 스키마 불일치 | `npm run doctor` → `npm run db:migrate` |
| 마이그레이션 실패 | 컬럼 이미 존재 | 정상 — PRAGMA 체크로 자동 스킵 |
| 시드 중복 | d1_seeds 미추적 | `npm run db:seed` (멱등, 안전) |
| 배포 후 데이터 없음 | 리모트 시드 미적용 | deploy-guard가 DDL만 적용, 시드는 초기 설치 전용 |
| core:pull 후 에러 | 새 의존성 필요 | `npm install` |

### 상세 문제 해결

→ `.agent/workflows/troubleshooting.md`

---

## 참조

- `scripts/deploy-guard.js` — 배포 가드
- `scripts/health-audit.js` — 헬스 체크
- `scripts/doctor.js` — DB 스키마 검증
- `scripts/db-backup.js` — DB 백업/복원
- `.docking/engine/fetch.js` — core:pull 엔진
- `.docking/engine/migrate.js` — 마이그레이션 엔진
- `.agent/workflows/setup-runbook.md` — 셋업 런북
- `.agent/workflows/troubleshooting.md` — 상세 문제 해결
