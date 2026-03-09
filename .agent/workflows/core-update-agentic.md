# Core 업데이트 Agent-First 워크플로우

> 에이전트가 변경사항을 분석하고, 사용자가 결정하는 안전한 업데이트 프로세스

---

## 위험도 평가

Core 업데이트는 **시스템 전체에 영향**을 주는 고위험 작업입니다.

| 위험 요소 | 영향 | 가드레일 |
|-----------|------|----------|
| 파일 덮어쓰기 | `_local/` 제외한 코어 파일 변경 | 변경 목록 사전 보고 |
| DB 스키마 변경 | 기존 데이터 마이그레이션 필요 | 자동 백업 + 롤백 준비 |
| 의존성 변경 | npm 패키지 버전 업데이트 | 테스트 환경 검증 |
| 설정 변경 | wrangler.toml 등 설정 변경 | diff 표시 + 사용자 확인 |

---

## 5단계 가드레일 프로세스

### Phase 1: 사전 분석 (Pre-Flight)

**에이전트가 먼저 실행:**

```bash
# 자동 실행
npm run agent:doctor -- --json     # 현재 상태/버전/권장 조치
npm run agent:lifecycle -- --json  # 재설치 이관이 필요한지 판별
npm run agent:snapshot -- --reason=pre-core-pull
npm run core:status                # 현재 버전 확인
```

**분석 결과 저장:**
```json
// .agent/core-update-state.json (생성)
{
  "phase": "analysis",
  "currentVersion": "1.24.5",
  "targetVersion": "1.25.0",
  "analysis": {
    "fileChanges": 12,
    "dbMigrations": 2,
    "dependencyChanges": 3,
    "breakingChanges": false
  },
  "backup": {
    "created": "2026-03-05T10:00:00Z",
    "path": ".backups/pre-update-20260305-100000"
  },
  "risk": "low",  // low, medium, high
  "ready": true
}
```

---

### Phase 2: 사용자 결정 게이트

**에이전트가 분석 결과 제시:**

```
[에이전트] "Core 업데이트를 준비했습니다."

┌─────────────────────────────────────────────┐
│  📦 업데이트 분석 결과                       │
├─────────────────────────────────────────────┤
│  현재: v1.24.5 → 대상: v1.25.0              │
│  위험도: 🟢 낮음                             │
├─────────────────────────────────────────────┤
│  📄 파일 변경: 12개                          │
│     - src/lib/PageService.ts (개선)          │
│     - src/pages/admin/dashboard.astro (신규)│
│     - ... (9개 더보기)                       │
├─────────────────────────────────────────────┤
│  🗄️  DB 마이그레이션: 2개                    │
│     - 0150_add_reservation_indexes.sql       │
│     - 0151_fix_patient_tags.sql              │
├─────────────────────────────────────────────┤
│  📦 의존성 변경: 3개                         │
│     - astro: ^5.15.0 → ^5.16.0              │
│     - wrangler: ^4.50.0 → ^4.61.0           │
├─────────────────────────────────────────────┤
│  ✅ 안전 확인:                               │
│     - 자동 백업 완료 (10:00)                 │
│     - _local/ 파일 충돌 없음                 │
│     - Breaking changes 없음                 │
├─────────────────────────────────────────────┤
│  [🚀 업데이트 진행] [🔍 상세 보기] [⏸️ 취소]  │
└─────────────────────────────────────────────┘
```

**사용자 선택:**
- `1` 또는 "진행해줘" → Phase 3
- `2` 또는 "상세 보기" → 변경사항 상세 표시 후 다시 질문
- `3` 또는 "취소" → 상태 저장, 나중에 재안내

---

### Phase 3: 단계별 실행 (Step-by-Step)

**에이전트가 단계별로 진행하며 보고:**

```
[에이전트] "업데이트를 시작합니다."

Step 1/5: 파일 다운로드
  ↳ git fetch --tags
  ↳ 12개 파일 변경사항 적용
  ✅ 완료

Step 2/5: 의존성 업데이트
  ↳ npm install (순차 설치)
  ↳ 3개 패키지 업데이트
  ✅ 완료

Step 3/5: DB 마이그레이션
  ↳ npx wrangler d1 migrations apply
  ↳ 0150_add_reservation_indexes.sql 적용
  ↳ 0151_fix_patient_tags.sql 적용
  ✅ 완료

Step 4/5: 로컬 테스트
  ↳ npm run build (테스트 빌드)
  ↳ 빌드 성공
  ✅ 완료

Step 5/5: 검증
  ↳ 핵심 기능 체크
  ↳ /admin 접속 테스트
  ✅ 완료

✅ 업데이트 완료: v1.25.0
```

**각 단계 실패 시:**
```
Step 3/5: DB 마이그레이션
  ↳ 0150_add_reservation_indexes.sql 적용
  ⚠️  오류: SQLITE_BUSY
  
  [자동 재시도 1/3...]
  [자동 재시도 2/3...]
  ❌ 실패
  
  에이전트: "DB 마이그레이션 중 문제가 발생했습니다.
           롤백하시겠습니까, 수동으로 진행하시겠습니까?"
           
           [🔄 롤백] [🔧 수동 진행] [⏸️ 중단]
```

---

### Phase 4: 검증 게이트

**업데이트 후 사용자 확인:**

```
[에이전트] "업데이트가 완료되었습니다. 검증해 주세요."

┌─────────────────────────────────────────────┐
│  ✅ 업데이트 완료: v1.25.0                   │
├─────────────────────────────────────────────┤
│  확인 사항:                                  │
│  1. 로컬 서버 실행: npm run dev             │
│  2. http://localhost:4321 접속              │
│  3. 주요 기능 확인                            │
├─────────────────────────────────────────────┤
│  변경사항 요약:                              │
│  - 예약 시스템 성능 개선 ✅                  │
│  - 새로운 대시보드 위젯 추가                 │
├─────────────────────────────────────────────┤
│  [✅ 정상 작동] [⚠️ 문제 있음]              │
└─────────────────────────────────────────────┘
```

**사용자 피드백:**
- "정상 작동" → Phase 5 (완료)
- "문제 있음" → 롤백 옵션 제시

---

### Phase 5: 완료 또는 롤백

**정상 완료:**
```
[에이전트] "✅ Core 업데이트가 성공적으로 완료되었습니다.
         
         백업은 7일간 보관됩니다.
         문제 발생 시 'npm run core:rollback'으로 복구 가능합니다."

→ .agent/core-update-state.json 삭제
→ .agent/onboarding-state.json에 버전 정보 업데이트
```

**롤백 필요:**
```
[에이전트] "⚠️  문제를 확인했습니다. 롤백하시겠습니까?"

┌─────────────────────────────────────────────┐
│  🔄 롤백 옵션                               │
├─────────────────────────────────────────────┤
│  [🔄 v1.24.5로 롤백]                        │
│    - 파일 복구                              │
│    - DB 복구 (백업: 10:00)                  │
│    - 의존성 복구                            │
├─────────────────────────────────────────────┤
│  [🔧 문제 해결 시도]                        │
│    - .agent/last-error.json 분석            │
│    - troubleshooting.md 참조                │
├─────────────────────────────────────────────┤
│  [📞 서포트 요청]                           │
│    - 원격 지원 요청                         │
└─────────────────────────────────────────────┘
```

---

## 위험도별 처리

### 🟢 Low Risk (자동 진행 가능)

- 파일 변경 < 10개
- DB 마이그레이션 없음 또는 간단한 ALTER
- Breaking changes 없음
- `_local/` 충돌 없음

**처리:**
```
에이전트: "낮은 위험도의 업데이트입니다. 자동으로 진행할까요?"
사용자: "응"
→ 에이전트가 전체 자동 진행
```

### 🟡 Medium Risk (단계별 확인)

- 파일 변경 10-30개
- DB 마이그레이션 있음
- Breaking changes 경고 있음
- `_local/` 파일 있음 (영향 없음)

**처리:**
```
에이전트: "중간 위험도의 업데이트입니다.
         각 단계마다 확인을 받으며 진행하겠습니다."
→ Phase 3의 각 Step 완료 후 "계속할까요?" 확인
```

### 🔴 High Risk (상세 검토 필수)

- 파일 변경 > 30개
- DB 스키마 대규모 변경
- Breaking changes 있음
- `_local/` 파일 충돌 가능성

**처리:**
```
에이전트: "⚠️  높은 위험도의 업데이트입니다.
         
         주의사항:
         - _local/ 폴더의 3개 파일이 영향받을 수 있습니다
         - DB 마이그레이션이 복잡합니다
         - 일부 기능이 변경될 수 있습니다
         
         상세 분석 후 진행하시겠습니까?"
→ 변경사항 상세 diff 표시
→ 사용자 확인 후 진행
```

---

## 자동 롤백 트리거

다음 상황에서 **자동 롤백** 제안:

```javascript
const ROLLBACK_TRIGGERS = [
  'db_migration_failed',
  'build_failed',
  'core_file_corrupted',
  'npm_install_failed',
  'user_reported_issue'
];
```

---

## 명령어 인터페이스

```bash
# 업데이트 전 진단
npm run agent:doctor -- --json
npm run agent:lifecycle -- --json

# 안전 스냅샷
npm run agent:snapshot -- --reason=pre-core-pull

# 업데이트 진행
npm run core:pull -- --auto
npm run core:pull -- --auto --stable

# 롤백
npm run core:rollback
```

---

## 상태 파일

```json
// .agent/core-update-state.json
{
  "phase": "analysis",  // analysis, decision, executing, verification, completed, rolled_back
  "currentVersion": "1.24.5",
  "targetVersion": "1.25.0",
  "startedAt": "2026-03-05T10:00:00Z",
  "completedAt": null,
  "risk": "low",
  "steps": [
    {"id": "download", "status": "done", "timestamp": "..."},
    {"id": "dependencies", "status": "done", "timestamp": "..."},
    {"id": "db_migration", "status": "in_progress", "timestamp": "..."},
    {"id": "test", "status": "pending"},
    {"id": "verify", "status": "pending"}
  ],
  "backup": {
    "path": ".backups/pre-update-20260305-100000",
    "created": "2026-03-05T10:00:00Z"
  },
  "error": null  // 실패 시 에러 정보
}
```
