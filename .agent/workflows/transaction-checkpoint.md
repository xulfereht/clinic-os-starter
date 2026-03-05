# Transaction & Checkpoint System

> 모든 에이전트 작업은 **Git 기반 체크포인트**로 관리되고, **언제든지 롤백** 가능합니다.

---

## 핵심 원칙

### 1. 모든 작업은 트랜잭션

```
[작업 시작] → [체크포인트 생성] → [작업 실행] → [성공 시 커밋 / 실패 시 롤백]
```

### 2. Git 기반 이력 관리

- 모든 변경사항은 Git으로 추적
- 체크포인트 = Git 커밋
- 롤백 = Git checkout/reset

### 3. 잠금 기반 동시성 제어

- 한 번에 하나의 에이전트만 작업
- 타임아웃으로 교착상태 방지

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    에이전트 작업 요청                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  1. LOCK ACQUIRE                                            │
│     - .agent/work.lock 생성                                  │
│     - 타임아웃: 30분                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. CHECKPOINT CREATE                                       │
│     - git stash push (현재 상태 저장)                        │
│     - git commit -m "checkpoint: before [작업명]"           │
│     - .agent/audit.log에 기록                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. WORK EXECUTE                                            │
│     - 실제 작업 수행                                         │
│     - 중간 진행사항 .agent/progress.json에 저장              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌──────┴──────┐
                    ↓             ↓
              [성공]           [실패]
                  ↓               ↓
┌─────────────────┐   ┌─────────────────────────────┐
│ 4a. COMMIT      │   │ 4b. ROLLBACK                │
│ - git commit    │   │ - git checkout [checkpoint] │
│ - audit.log     │   │ - git stash pop             │
│ - lock 해제     │   │ - audit.log                 │
└─────────────────┘   │ - lock 해제                 │
                      └─────────────────────────────┘
```

---

## 컴포넌트 상세

### 1. 작업 잠금 (Work Lock)

**파일**: `.agent/work.lock`

```json
{
  "lockId": "claude-code-20260305-123456",
  "acquiredBy": "claude-code",
  "acquiredAt": "2026-03-05T12:34:56Z",
  "expiresAt": "2026-03-05T13:04:56Z",
  "currentTask": "onboarding:clinic-info",
  "checkpointRef": "checkpoint-before-clinic-info"
}
```

**획득 프로토콜:**

```bash
# 에이전트가 작업 시작 시
lock-acquire() {
  if [ -f .agent/work.lock ]; then
    # 이미 잠겨있음
    lockInfo=$(cat .agent/work.lock)
    expires=$(echo $lockInfo | jq -r '.expiresAt')
    now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    if [ "$now" < "$expires" ]; then
      echo "❌ 다른 에이전트가 작업 중: $(echo $lockInfo | jq -r '.acquiredBy')"
      echo "⏰ 만료 예정: $expires"
      echo "💡 강제로 획득하려면: --force-lock"
      exit 1
    else
      # 타임아웃 → 자동 해제 후 획득
      echo "⚠️  이전 잠금이 타임아웃됨. 자동 해제합니다."
    fi
  fi
  
  # 새 잠금 생성
  cat > .agent/work.lock << EOF
{
  "lockId": "$AGENT-$(date +%Y%m%d-%H%M%S)",
  "acquiredBy": "$AGENT",
  "acquiredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "expiresAt": "$(date -u -v+30M +%Y-%m-%dT%H:%M:%SZ)",
  "currentTask": "$TASK"
}
EOF
  
  echo "✅ Lock 획득: $TASK"
}
```

**주기적 갱신 (Heartbeat):**

```bash
# 5분마다 호출
lock-extend() {
  if [ -f .agent/work.lock ]; then
    jq '.expiresAt = "'$(date -u -v+30M +%Y-%m-%dT%H:%M:%SZ)'"' \
      .agent/work.lock > .agent/work.lock.tmp
    mv .agent/work.lock.tmp .agent/work.lock
  fi
}
```

---

### 2. 체크포인트 (Checkpoint)

**체크포인트 생성:**

```bash
create-checkpoint() {
  local name=$1
  local message=$2
  
  # 1. Git 상태 확인
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "⚠️  Git 저장소 없음. 초기화합니다."
    git init
    git config user.name "ClinicOS Agent"
    git config user.email "agent@clinic-os.local"
  fi
  
  # 2. 현재 변경사항 stash
  git stash push -m "checkpoint-stash-$name-$(date +%Y%m%d-%H%M%S)"
  
  # 3. 체크포인트 커밋 (변경사항 없어도 태그 생성)
  git add -A
  git commit --allow-empty -m "checkpoint: $message

- Agent: $AGENT
- Task: $TASK
- Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  
  # 4. 태그 생성 (롤백용)
  local tagName="checkpoint-$name-$(date +%Y%m%d-%H%M%S)"
  git tag -a "$tagName" -m "Checkpoint: $message"
  
  # 5. audit log 기록
  log-audit "CHECKPOINT_CREATED" "$tagName" "$message"
  
  echo "$tagName"
}
```

**체크포인트 태그 형식:**

```
checkpoint-before-setup-20260305-123456
checkpoint-before-onboarding-20260305-130000
checkpoint-before-core-update-20260305-140000
checkpoint-rollback-20260305-141500
```

---

### 3. Audit Trail (감사 로그)

**파일**: `.agent/audit.log` (JSON Lines)

```json
{"timestamp":"2026-03-05T12:00:00Z","agent":"claude-code","level":"INFO","event":"SESSION_START","message":"Claude Code session started"}
{"timestamp":"2026-03-05T12:00:05Z","agent":"claude-code","level":"INFO","event":"LOCK_ACQUIRED","task":"setup:step-4","lockId":"claude-code-20260305-120005"}
{"timestamp":"2026-03-05T12:00:10Z","agent":"claude-code","level":"INFO","event":"CHECKPOINT_CREATED","checkpoint":"checkpoint-before-npm-install-20260305-120010","message":"Before npm install"}
{"timestamp":"2026-03-05T12:03:15Z","agent":"claude-code","level":"INFO","event":"WORK_COMPLETED","task":"setup:step-4","duration":185,"result":"success"}
{"timestamp":"2026-03-05T12:03:16Z","agent":"claude-code","level":"INFO","event":"LOCK_RELEASED","task":"setup:step-4"}
```

**Audit 로거:**

```javascript
// scripts/lib/audit.js
const fs = require('fs').promises;
const path = require('path');

const AUDIT_LOG = path.join(process.cwd(), '.agent', 'audit.log');

async function logAudit(level, event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    agent: process.env.AGENT_NAME || 'unknown',
    level,
    event,
    ...data
  };
  
  await fs.appendFile(AUDIT_LOG, JSON.stringify(entry) + '\n');
}

// 사용
logAudit('INFO', 'CHECKPOINT_CREATED', {
  checkpoint: tagName,
  task: currentTask
});
```

---

### 4. 롤백 (Rollback)

**롤백 실행:**

```bash
rollback() {
  local target=$1  # checkpoint 이름, HEAD~N, 또는 "last"
  
  if [ "$target" = "last" ]; then
    # 마지막 체크포인트 찾기
    target=$(git tag -l "checkpoint-*" --sort=-creatordate | head -1)
  fi
  
  echo "🔄 롤백: $target"
  
  # 1. 현재 상태 stash
  git stash push -m "pre-rollback-$(date +%Y%m%d-%H%M%S)"
  
  # 2. 체크포인트로 이동
  git checkout "$target"
  
  # 3. stash 복원 (충돌 가능성 있음)
  git stash pop || echo "⚠️  stash 복원 충돌. 수동 확인 필요."
  
  # 4. audit log
  logAudit "WARN" "ROLLBACK_EXECUTED", {
    "from": "$(git rev-parse HEAD@{1})",
    "to": "$target"
  }
  
  echo "✅ 롤백 완료: $target"
}
```

**롤백 후 작업 재개:**

```bash
# 롤백 후 이어서 진행
resume-after-rollback() {
  # 작업 상태 파일 읽기
  local progress=$(cat .agent/setup-progress.json | jq -r '.steps[] | select(.status == "in_progress") | .id')
  
  echo "📋 롤백 후 재개: $progress"
  echo "   원인 확인 후 다시 실행하세요."
}
```

---

## 사용 예시

### 설치 과정에서의 트랜잭션

```bash
# setup-step.js의 각 단계

runStep() {
  local step=$1
  
  # 1. Lock 획득
  lock-acquire || exit 1
  
  # 2. 체크포인트 생성
  checkpoint=$(create-checkpoint "before-$step" "Before executing $step")
  echo "checkpoint:$checkpoint" > .agent/last-checkpoint.txt
  
  # 3. 작업 실행
  if execute-step $step; then
    # 성공
    logAudit "INFO" "STEP_COMPLETED", {"step": $step}
    
    # 성공 체크포인트 (옵션)
    git tag "success-$step-$(date +%Y%m%d-%H%M%S)"
  else
    # 실패
    logAudit "ERROR" "STEP_FAILED", {"step": $step, "error": $ERROR}
    
    # 자동 롤백 또는 사용자 선택
    echo "❌ $step 실패"
    echo "   [🔄 자동 롤백] [⏸️  상태 유지]"
    
    rollback "$checkpoint"
  fi
  
  # 4. Lock 해제
  rm -f .agent/work.lock
}
```

### 온볼딩 과정에서의 트랜잭션

```javascript
// 에이전트가 온볼딩 기능 설정 시

async function setupFeature(featureId) {
  const checkpoint = await createCheckpoint(`before-${featureId}`);
  
  try {
    // 사용자 입력 받기
    const userInput = await promptUser(featureId);
    
    // 설정 적용
    await applyFeature(featureId, userInput);
    
    // 성공 커밋
    await gitCommit(`feat: complete ${featureId}`, {
      featureId,
      userInput: sanitize(userInput)  // 감정보 제외
    });
    
    await logAudit('INFO', 'FEATURE_COMPLETED', { featureId });
    
  } catch (error) {
    await logAudit('ERROR', 'FEATURE_FAILED', { featureId, error: error.message });
    
    // 롤백
    await rollback(checkpoint);
    
    throw error;
  }
}
```

---

## 명령어 인터페이스 (실제 구현)

### Transaction System (`npm run tx:*`)

```bash
# Lock 관리
npm run tx:lock                      # 작업 Lock 획득
npm run tx:unlock                    # Lock 해제
npm run tx:lock-status               # 현재 Lock 상태 확인

# 체크포인트 관리
npm run tx:checkpoint                # 수동 체크포인트 생성
npm run tx:rollback                  # 마지막 체크포인트로 롤백
npm run tx:list                      # 모든 체크포인트 목록

# Audit 로그
npm run tx:audit                     # audit.log 보기
npm run tx:audit-summary             # 작업 요약
```

### Error Recovery (`npm run error:*`)

```bash
npm run error:status                 # 에러 상태 확인
npm run error:recover                # 자동 복구 시도
npm run error:recover -- --force     # 강제 복구
npm run error:resolve                # 수동 해결 표시
```

### 통합 상태

```bash
npm run status                       # 설치+온볼딩+건강도+Lock 한눈에
```

---

## 구현 예시 (참고용)

아래는 시스템 낮부 구현 예시입니다. 실제 사용은 위 `npm run tx:*` 명령어를 사용하세요.

---

## 상태 파일 통합

```json
// .agent/transaction-state.json
{
  "currentTransaction": {
    "id": "txn-20260305-123456",
    "startedAt": "2026-03-05T12:34:56Z",
    "agent": "claude-code",
    "task": "onboarding:clinic-info",
    "checkpoint": "checkpoint-before-clinic-info-20260305-123456",
    "status": "in_progress"
  },
  "history": [
    {
      "id": "txn-20260305-120000",
      "task": "setup:step-4",
      "status": "completed",
      "checkpoint": "checkpoint-before-npm-install-20260305-120010",
      "completedAt": "2026-03-05T12:03:15Z"
    }
  ]
}
```

---

## 복구 시나리오

### 시나리오 1: SIGKILL 발생

```
1. 에이전트가 npm install 중 SIGKILL
2. work.lock이 남아있음 (타임아웃까지)
3. 새 에이전트가 진입 → "이전 작업이 타임아웃됨" 감지
4. last-checkpoint.txt 확인 → 롤백 또는 재시도
```

### 시나리오 2: 사용자가 실수로 파일 삭제

```
사용자: "아까 파일을 잘못 지웠어"

에이전트: "마지막 체크포인트로 롤백하겠습니다."
         npm run checkpoint:rollback
         
         "복구 완료. 지워진 파일: src/lib/local/utils.js"
```

### 시나리오 3: 두 에이전트 충돌

```
Claude가 작업 중...
Cursor가 진입 → Lock 획득 시도 → 실패

Cursor: "⚠️  Claude Code가 2분 전부터 작업 중입니다.
         기다리시겠습니까, 강제로 진행하시겠습니까?"
```

---

## 보안 고려사항

1. **audit.log**는 민감정보(password, API key) 제외
2. **checkpoint**는 로컬 Git에만 저장 (원격 push 없음)
3. **lock**은 파일 기반으로 프로세스 독립적
4. **rollback**은 사용자 확인 후 실행 (자동 롤백은 선택적)
