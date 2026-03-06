---
description: 에이전트가 스타터킷/프로젝트를 열었을 때 실행하는 최초 접촉 프로토콜 v2. 자동 감지 → 자동 진행.
---

# First Contact Protocol v2 — Agent-First 설치

> **이 문서를 읽고 즉시 판별하세요.** 사용자와 대화하지 말고, 상태를 감지해서 자동으로 진행하세요.

## 🎯 핵심 원칙

1. **자동 감지**: 파일 존재 여부로 상태 판별
2. **자동 진행**: 가능한 한 에이전트가 직접 실행
3. **최소 대화**: 꼭 필요한 경우에만 사용자에게 묻기
4. **진행 표시**: 각 단계마다 무엇을 하는지 보여주기

---

## ⚡ 즉시 판별 플로우

```
에이전트가 프로젝트 폴터 열기
    ↓
[체크 1] .agent/setup-progress.json 존재?
    ├── ✅ 있음 → 설치 진행중/완료됨 → Phase S
    └── ❌ 없음 → 신규 설치
        ↓
[체크 2] .agent/AGENT_INSTALLER.md 존재?
    ├── ✅ 있음 → 스타터킷 초기 상태 → Phase A (자동 설치)
    └── ❌ 없음 → 레거시/수동 모드 → Phase M
```

---

## Phase A: Agent-First 자동 설치 (신규 - 권장)

### 진입 조건
- `.agent/AGENT_INSTALLER.md` 파일 존재
- `.agent/setup-progress.json` 없음

### 에이전트 행동

**1단계: 컨텍스트 확인**
```javascript
// .agent/agent-context.json 확인
const ctx = readJSON('.agent/agent-context.json');
if (ctx && ctx.stage !== 'complete') {
  return '이전 설치 재개 → npm run setup:agent';
}
```

**2단계: 자동 설치 실행**
```bash
npm run setup:agent
```

**3단계: 사용자 안내 (최소한)**
```
"Clinic-OS 자동 설치를 시작합니다."
"브라우저가 열리면 인증 코드를 입력해주세요."
```

### 완료 조건
- `.agent/agent-context.json`의 `stage`가 `complete`
- `.agent/setup-progress.json`의 모든 단계가 `done`

---

## Phase S: 단계별 설치 진행 (기존 설치)

### 진입 조건
- `.agent/setup-progress.json` 파일 존재

### 에이전트 행동

```javascript
const progress = readJSON('.agent/setup-progress.json');
const pending = progress.steps.filter(s => s.status === 'pending');
const inProgress = progress.steps.find(s => s.status === 'in_progress');
const allDone = progress.steps.every(s => s.status === 'done');

if (allDone) {
  return '설치 완료 → Phase O (온볼딩)';
} else if (inProgress || pending.length > 0) {
  return `설치 진행중 → npm run setup:step -- --next (남은 단계: ${pending.length})`;
}
```

---

## Phase O: 온볼딩 (설치 완료 후)

### 진입 조건
- 설치 완료
- `.agent/onboarding-state.json` 존재

### 에이전트 행동
```
"✅ Clinic-OS 설치가 완료되었습니다!"
"
이제 한의원 홈페이지 개별 설정(온볼딩)을 시작하겠습니다.
"
"현재 진행률: Tier 1 (배포 필수) - 0/7 완료"
"다음: [관리자 계정 보안] 설정"
```

---

## Phase M: 수동/레거시 모드

### 진입 조건
- `AGENT_INSTALLER.md` 없음
- `setup-progress.json` 없음

### 에이전트 행동
레거시 first-contact.md 프로토콜 따르기

---

## Phase E: 에러 복구 (최우선)

### 진입 조건
- `.agent/last-error.json` 존재

### 에이전트 행동
```
"⚠️ 이전 설치에서 에러가 감지되었습니다."
"복구를 시도하겠습니다..."
```

```bash
npm run error:recover
```

---

## 📋 명령어 참조

| 명령어 | 용도 | 언제 사용 |
|--------|------|-----------|
| `npm run setup:agent` | 완전 자동 설치 | Phase A |
| `npm run setup:step -- --next` | 다음 단계 실행 | Phase S |
| `npm run setup:step -- --status` | 상태 확인 | 언제든 |
| `npm run error:recover` | 에러 복구 | Phase E |

---

## 🔄 상태 파일 우선순위

| 순위 | 파일 | 의미 | 행동 |
|------|------|------|------|
| 1 | `last-error.json` | 에러 발생 | Phase E |
| 2 | `setup-progress.json` | 설치 진행중 | Phase S |
| 3 | `AGENT_INSTALLER.md` | 스타터킷 초기 | Phase A |
| 4 | `onboarding-state.json` | 온볼딩 대기 | Phase O |

---

## 📝 사용자 대화 최소화 체크리스트

다음 경우에만 사용자에게 묻습니다:

- [ ] 인증 코드 입력이 필요할 때
- [ ] 여러 선택지 중 선택이 필요할 때
- [ ] 에러로 인해 진행 불가능할 때
- [ ] 온볼딩에서 병원 특정 정보가 필요할 때

그 외는 **에이전트가 직접 실행**합니다.

---

## 🆘 문제 해결

### "setup:agent가 없어요"
```bash
# 수동으로 setup-step 사용
npm run setup:step -- --reset
npm run setup:step -- --next  # 16번 반복
```

### "인증이 안돼요"
```bash
# 토큰 직접 제공
npm run setup:agent -- --token=YOUR_TOKEN
```

### "중간에 멈췄어요"
```bash
# 그대로 재실행
npm run setup:agent
```
