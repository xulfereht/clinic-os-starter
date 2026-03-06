---
description: 에이전트가 프로젝트를 열자마자 실행하는 최초 접촉 프로토콜. setup-progress.json 우선, 없으면 레거시 판별.
---

# First Contact — 최초 접촉 프로토콜

> **이 문서를 읽고 즉시 실행하세요.** 판별에 시간을 쓰지 마세요.

에이전트가 이 프로젝트를 열었을 때, **`.agent/setup-progress.json` 파일을 먼저 확인**하고, 없으면 레거시 방식으로 판별합니다.

---

## Phase I: 에이전트가 직접 설치를 실행한 경우

사용자가 에이전트에게 `cos-setup.sh` 실행을 요청한 경우:

```bash
curl -fsSL https://clinic-os-hq.pages.dev/cos-setup.sh | bash
```

**스크립트 출력 끝에 `--- AGENT_NEXT_STEPS ---` 블록이 나옵니다.**
이 블록의 지시를 따르세요:

1. `cd clinic-os` (working_directory로 이동)
2. `CLAUDE.md` 읽기 (프로젝트 규칙 파악)
3. 이 문서(`first-contact.md`)의 Phase S로 진입
4. `npm run setup:step -- --next` 반복 실행

> **중요:** cos-setup.sh가 `setup-progress.json`을 이미 생성합니다.
> check-system과 npm-install-root는 done으로 표시되어 있으므로
> 에이전트는 나머지 14단계만 진행하면 됩니다.

---

## 즉시 판별 플로우

```
프로젝트 열기
    ↓
[체크] .agent/setup-progress.json 존재?
    ↓
    ├── 있음 → Phase S (단계별 설치 진행/완료 확인)
    │
    └── 없음 → 레거시 판별
        ↓
    [체크] .agent/last-error.json 존재?
        → 있으면: Phase E (에러 복구)
        ↓
    [체크] node_modules/ 존재?
        → 없으면: Phase 0 (환경 확인)
        ↓
    [체크] .docking/config.yaml 존재?
        → 없으면: Phase 1 (시스템 초기화)
        ↓
    [체크] .agent/onboarding-state.json에 pending?
        → 있으면: Phase 3 (온볼딩)
        ↓
    Phase 4 (운영 모드)
```

---

## Phase S: 단계별 설치 (신규 - 우선)

### 진입 조건
- `.agent/setup-progress.json` 파일 존재

### 즉시 판별
```javascript
const progress = readJSON('.agent/setup-progress.json');
const pending = progress.steps.filter(s => s.status === 'pending');
const inProgress = progress.steps.find(s => s.status === 'in_progress');
const allDone = progress.steps.every(s => s.status === 'done');

if (inProgress || pending.length > 0) {
  return '설치 진행중 → npm run setup:step -- --next';
} else if (allDone) {
  return '설치 완료 → Phase 3 (온볼딩)';
}
```

### 에이전트 행동

**항상 같은 명령어:**
```bash
npm run setup:step -- --next
```

**완료될 때까지 반복**

### 완료 조건
- `setup-progress.json`의 16개 단계 모두 `status: "done"`

---

## Phase E: 에러 복구 (최우선)

### 진입 조건
- `.agent/last-error.json` 존재

### 행동
1. 에러 파일 읽기
2. `.agent/workflows/troubleshooting.md` 참조
3. 복구 시도
4. 성공 시 `last-error.json` 삭제

---

## Phase 0: 환경 확인 (레거시)

### 진입 조건
- `setup-progress.json` 없음
- `node_modules/` 없음

### 행동
```bash
npm install
```

---

## Phase 1: 시스템 초기화 (레거시 → setup:step으로 통일)

### 진입 조건
- `setup-progress.json` 없음
- `.docking/config.yaml` 없음

### 행동

> **주의:** `npm run setup`(모놀리식)은 사용하지 마세요.
> 메모리 제한 환경에서 SIGKILL이 발생하고, 복구가 어렵습니다.

**항상 setup:step을 사용하세요:**
```bash
npm run setup:step -- --reset   # 상태 파일 초기화 (최초 1회)
npm run setup:step -- --next    # 다음 단계 실행 (완료까지 반복)
```

---

## Phase 3: 온볼딩 (셋업 완료 후 자동 진행)

### 진입 조건
- `setup-progress.json` **모든 단계 done** (신규)
- 또는 `.docking/config.yaml` 존재 (레거시)
- `.agent/onboarding-state.json` 존재

### 즉시 판별
```javascript
const state = readJSON('.agent/onboarding-state.json');
const pending = Object.entries(state.features).filter(([k, v]) => v.status === 'pending');

if (pending.length === 0) return 'Phase 4';
return `Phase 3: Tier ${state.current_tier}, ${pending.length}개 기능 남음`;
```

### 에이전트 행동

**온볼딩 시작 안내:**
```
"✅ Clinic-OS 설치가 완료되었습니다!

 이제 한의원 홈페이지 개별 설정(온볼딩)을 시작하겠습니다.

 📋 현재 진행률: Tier 1 (배포 필수) - 0/7 완료
 다음: [관리자 계정 보안] 설정"
```

**진행 방식:**
1. `.agent/onboarding-registry.json` + `.agent/onboarding-state.json` 읽기
2. **Tier 1 → Tier 2 → Tier 3** 순서로 진행
3. 각 기능별 `requires_human` 확인 → 필요 정보 요청
4. 설정 완료 후 상태 업데이트

**Tier 1 완료 후:**
```
"🎉 Tier 1 완료! 1차 배포가 가능합니다.
 지금 배포할까요, Tier 2도 먼저 진행할까요?"
```

### 참조
- 상세 가이드: `.agent/workflows/onboarding.md`
- 기능 목록: `.agent/onboarding-registry.json`
- 진행 상태: `.agent/onboarding-state.json`

---

## Phase 4: 운영 모드

### 진입 조건
- 온볼딩 완료 또는 사용자 "충분" 선언

### 행동
일반 어시스턴트 모드

---

## 상태 파일 우선순위

| 순위 | 파일 | 역할 |
|------|------|------|
| 1 | `.agent/setup-progress.json` | **신규 설치 상태 (SOT)** |
| 2 | `.agent/last-error.json` | 에러 복구 정보 |
| 3 | `.agent/onboarding-state.json` | 온볼딩 진행 상태 |
| 4 | `.docking/config.yaml` | 레거시 설치 완료 표시 |

---

## 핵심 원칙

1. **setup-progress.json 우선** - 있으면 무조건 Phase S
2. **명령어 하나** - `npm run setup:step -- --next`
3. **반복 실행** - 완료될 때까지
4. **한국어 응답**
