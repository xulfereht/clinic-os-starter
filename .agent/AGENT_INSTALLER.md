# Clinic-OS 에이전트 인스톨러 가이드

> 이 문서는 에이전트가 스타터킷을 자동으로 설치하는 방법을 설명합니다.

## 🚀 빠른 시작

사용자가 스타터킷을 다운로드하고 에이전트에게 "설치해줘"라고 하면:

```bash
# 완전 자동 모드
npm run setup:agent
```

에이전트가 알아서:
1. ✅ 현재 상태 감지
2. ✅ HQ 인증 (브라우저 열림)
3. ✅ 스타터킷 다운로드
4. ✅ 의존성 설치
5. ✅ 16단계 설치 자동 진행

---

## 📋 자동 감지 프로토콜 (First Contact)

에이전트가 프로젝트를 열었을 때, 이 파일(`.agent/AGENT_INSTALLER.md`)의 존재를 확인하면 **스타터킷 초기 상태**임을 인식합니다.

### 진입점 판별 트리

```
에이전트가 clinic-os 폴터 열기
    ↓
[체크] .agent/setup-progress.json 존재?
    ├── 있음 → 기존 설치 → Phase S (셋업 계속)
    └── 없음 → 신규 설치
        ↓
    [체크] .agent/AGENT_INSTALLER.md 존재?
        ├── 있음 → 스타터킷 초기 상태
        │           → npm run setup:agent 권장
        └── 없음 → 레거시 모드
```

---

## 🔧 명령어 레퍼런스

### `npm run setup:agent`
완전 자동 설치 모드
- 브라우저 인증 포함
- 16단계 설치 자동 진행
- 중단 시 재실행하면 이어서 진행

### `npm run setup:agent -- --token=xxx`
미리 발급받은 토큰으로 인증 우회
- CI/CD 환경에 적합
- 브라우저 없이 진행

### `npm run setup:agent -- --skip-auth`
인증 없이 로컬만 설정
- 오프라인/로컬 개발용
- 코어 다운로드 없음

### `npm run setup:agent -- --status`
현재 설치 상태 확인
- 어디까지 진행되었는지 표시
- 다음 단계 안내

---

## 📁 상태 파일 구조

### `.agent/agent-context.json`
에이전트 인스톨러의 상태 저장
```json
{
  "version": "1.0",
  "stage": "auth|download|install|setup|complete",
  "auth": {
    "method": "device-code|cli-token|none",
    "status": "pending|complete"
  },
  "setup": {
    "step": 0,
    "total": 16,
    "status": "pending|in_progress|complete"
  }
}
```

### `.agent/setup-progress.json`
setup:step의 상세 상태
```json
{
  "steps": [
    { "id": "check-system", "status": "done" },
    { "id": "device-register", "status": "pending" }
  ]
}
```

---

## 🔄 복구 절차

### 설치 중단 후 재시작
```bash
npm run setup:agent
```
자동으로 마지막 단계부터 이어서 진행

### 처음부터 다시 시작
```bash
rm .agent/agent-context.json
rm .agent/setup-progress.json
npm run setup:agent -- --reset
```

### 인증 재시도
```bash
npm run setup:agent -- --reauth
```

---

## ⚠️ 주의사항

1. **브라우저 인증**: `--token` 없이 실행하면 브라우저가 열립니다
2. **시간**: 전체 설치는 5-15분 소요
3. **네트워크**: HQ 서버와 통신 필요 (인증/코어 다운로드)
4. **Node.js**: v18+ 필요

---

## 🆘 문제 해결

| 문제 | 해결책 |
|------|--------|
| 인증 실패 | `npm run setup:agent -- --reauth` |
| 다운로드 실패 | 네트워크 확인 후 재시도 |
| 설치 중단 | 그대로 `npm run setup:agent` 재실행 |
| 권한 오류 | `sudo` 없이 실행 (권장) |

---

## 📝 사용자 대화 템플릿

### 사용자: "설치해줘"
> Clinic-OS 자동 설치를 시작하겠습니다. 브라우저가 열리면 인증 코드를 입력해주세요.
> ```bash
> npm run setup:agent
> ```

### 사용자: "어디까지 했지?"
> 현재 설치 상태를 확인하겠습니다.
> ```bash
> npm run setup:agent -- --status
> ```

### 사용자: "토큰 있어"
> 제공된 토큰으로 인증을 진행하겠습니다.
> ```bash
> npm run setup:agent -- --token=사용자가_제공한_토큰
> ```
