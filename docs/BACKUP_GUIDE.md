---
hq_slug: backup-guide
hq_title: "백업 & 복원 가이드"
hq_category: "10. 시스템 설정"
hq_sort: 4
hq_active: true
---
# 백업 & 복원 가이드

Clinic-OS는 3중 안전망으로 데이터를 보호합니다. 이 가이드에서는 각 계층의 백업 방법과 복원 절차를 설명합니다.

> **소프트게이트 Gate 2** — DB 변경 전에 자동으로 백업이 실행됩니다.

---

## 3중 백업 구조

```
Layer 1: 로컬 자동 백업
├── ~/.clinic-os-backups/{project}/
├── 자동으로 최근 5개 유지
└── npm run db:backup

Layer 2: SQL 덤프 → Git
├── .backups/d1-snapshot-latest.sql
├── GitHub에 함께 백업
└── 디바이스 마이그레이션 시 활용

Layer 3: 프로덕션 D1 (Cloudflare)
├── 배포 시 자동 반영
├── Cloudflare 인프라가 관리
└── 별도 백업 불필요
```

---

## Layer 1: 로컬 자동 백업

### 기본 명령어

```bash
# 스마트 백업 (변경 없으면 건너뜀)
npm run db:backup

# 강제 백업 (변경 여부 무관)
npm run db:backup -- --force

# 백업 목록 보기
npm run db:backup -- --list

# 백업에서 복원 (대화형)
npm run db:backup -- --restore
```

### 저장 위치

```
~/.clinic-os-backups/{project-name}/
├── backup_2026-02-25_14-30-00/
│   ├── xxxxx.sqlite
│   ├── xxxxx.sqlite-wal
│   └── xxxxx.sqlite-shm
├── backup_2026-02-26_09-00-00/
└── ...  (최대 5개, 오래된 것 자동 삭제)
```

> **참고**: 백업은 프로젝트 폴더가 아닌 홈 디렉토리에 저장됩니다.
> 프로젝트를 삭제해도 백업은 남아있습니다.

### 자동 백업 시점

에이전트가 다음 상황에서 자동으로 `npm run db:backup`을 실행합니다:

| 시점 | 설명 |
|------|------|
| DB 구조 변경 전 | ALTER, DROP, 마이그레이션 실행 전 |
| 대량 데이터 삭제 전 | DELETE 쿼리 실행 전 |
| 배포 전 | `npm run deploy` 시 deploy-guard가 자동 실행 |
| 정기 | 마지막 백업 후 7일 경과 시 안내 |

### 복원 절차

```bash
npm run db:backup -- --restore
```

실행하면 백업 목록이 표시되고, 번호를 선택하면 복원됩니다:

```
   Backups in: ~/.clinic-os-backups/clinic-os/

   #  Timestamp             Files  Size
   ── ───────────────────── ────── ──────
   1  2026-02-26_14-30-00      3   2.1MB
   2  2026-02-25_09-00-00      3   1.8MB

   Enter backup number to restore (or q to quit): 1
   Restore from backup_2026-02-26_14-30-00? This will overwrite the current DB. (y/N): y

   Restored 3 files from backup_2026-02-26_14-30-00
   Restart dev server to apply: npm run dev
```

> **중요**: 복원 후 반드시 `npm run dev`를 다시 시작하세요.

---

## Layer 2: SQL 덤프 → Git

GitHub이 연결되어 있으면, DB 스냅샷을 Git에 포함하여 원격 백업합니다.

### SQL 덤프 생성

```bash
# 로컬 DB를 SQL 파일로 내보내기
npx wrangler d1 export {db-name} --local --output .backups/d1-snapshot-latest.sql
```

에이전트가 주요 데이터 변경 후 자동으로 실행하고, git commit에 포함합니다.

### SQL 덤프에서 복원

```bash
# SQL 파일로 DB 복원
npx wrangler d1 execute {db-name} --local --file .backups/d1-snapshot-latest.sql
```

> **활용**: 새 컴퓨터로 마이그레이션 시, GitHub에서 코드를 가져오면 이 파일로 로컬 DB를 복원합니다.

---

## Layer 3: 프로덕션 D1

Cloudflare D1은 클라우드 서비스이므로 별도 백업이 필요 없습니다.
다만 중요한 변경 전에는 프로덕션 DB도 백업할 수 있습니다.

### 프로덕션 DB 백업

```bash
# 프로덕션 → SQL 파일로 내보내기
npx wrangler d1 export {db-name} --remote --output backup_prod.sql
```

### 프로덕션 → 로컬 동기화

```bash
# 프로덕션 데이터를 로컬로 가져오기
npm run db:pull
```

---

## 에이전트 연동

### 에이전트에게 요청하는 방법

```
# 백업 관련
"DB 백업해줘"
"백업 목록 보여줘"
"어제 백업으로 복원해줘"

# 프로덕션 관련
"프로덕션 DB 백업해줘"
"프로덕션 데이터를 로컬로 가져와줘"
```

### 에이전트 자동 행동

- DB 변경 작업 전: "백업을 만들겠습니다" → 자동 실행
- 복원 필요 시: "방금 변경에 문제가 있으면 백업에서 복원할까요?"
- GitHub 미연결 시: "로컬 백업만 있습니다. GitHub 연결을 권장합니다."

---

## 명령어 요약

| 명령어 | 설명 |
|--------|------|
| `npm run db:backup` | 로컬 D1 스마트 백업 |
| `npm run db:backup -- --force` | 강제 백업 |
| `npm run db:backup -- --list` | 백업 목록 |
| `npm run db:backup -- --restore` | 대화형 복원 |
| `npm run db:pull` | 프로덕션 → 로컬 동기화 |
| `npm run db:doctor` | DB 상태 확인 |
| `npm run db:fix` | DB 문제 자동 수정 |

---

## 문제 해결

### "No local D1 database found"

로컬 DB가 아직 생성되지 않았습니다:

```bash
npm run db:init    # 테이블 생성
npm run db:seed    # 샘플 데이터
```

### 백업 파일이 너무 크다면

`.gitignore`에서 `.backups/` 디렉토리를 제외할 수 있습니다.
단, Layer 2 원격 백업 기능을 잃게 됩니다.

### 복원 후 데이터가 이상하다면

```bash
npm run db:doctor   # DB 상태 확인
npm run db:fix      # 자동 수정 시도
```

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [데이터베이스 관리](../hq/guides/database-management.md) | D1 설정 및 관리 |
| [GitHub 연동](GITHUB_SETUP_GUIDE.md) | Layer 2에 필요한 GitHub 설정 |
| [디바이스 마이그레이션](DEVICE_MIGRATION_GUIDE.md) | SQL 덤프를 활용한 DB 이전 |
| [안전한 작업 흐름](WORKFLOW_GUIDE.md) | 배포 전 확인 절차 |
