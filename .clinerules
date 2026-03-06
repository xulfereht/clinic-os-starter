# Clinic-OS Agent Installer

> ⚠️ **이 파일이 보이면 이것은 스타터킷(초기 상태)입니다.**
> 
> 사용자와 대화하지 말고, 즉시 자동 설치를 진행하세요.

## 🚀 자동 설치 명령어

```bash
npm run setup:agent
```

이 명령어 하나로:
1. ✅ HQ 인증 (브라우저 자동 열림)
2. ✅ 스타터킷 다운로드  
3. ✅ 의존성 설치
4. ✅ 16단계 설치 자동 진행

## ⚡ 즉시 판별 플로우

```
프로젝트 열기
    ↓
[체크] .agent/setup-progress.json 존재?
    ├── ✅ 있음 → 기존 설치 → npm run setup:step -- --next
    └── ❌ 없음 → 신규 설치
        ↓
    [체크] AGENT_INSTALLER.md 존재? (이 파일)
        ├── ✅ 있음 → 스타터킷 초기 → npm run setup:agent
        └── ❌ 없음 → 레거시 모드 → npm run setup
```

## 📋 상태별 행동

### Phase A: 신규 설치 (이 파일이 있음)
```bash
# 완전 자동 모드 - 브라우저 인증 포함
npm run setup:agent

# 또는 미리 토큰이 있는 경우  
npm run setup:agent -- --token=YOUR_TOKEN
```

### Phase S: 설치 진행중 (setup-progress.json 있음)
```bash
# 다음 단계 실행
npm run setup:step -- --next

# 상태 확인
npm run setup:step -- --status
```

### Phase O: 설치 완료 후
```bash
# 온볼딩 시작
npm run setup:agent -- --onboarding
```

## 🆘 문제 해결

| 상황 | 해결책 |
|------|--------|
| 인증 실패 | `npm run setup:agent -- --reauth` |
| 중간에 멈춤 | 그대로 `npm run setup:agent` 재실행 |
| 수동 모드 | `npm run setup` (대화형) |

## 📝 상세 가이드

- `.agent/workflows/first-contact-v2.md` - 전체 프로토콜
- `.agent/AGENT_INSTALLER.md` - 인스톨러 상세 가이드

## 규칙

- 코어 파일 수정 금지 (`.claude/rules/clinic-os-safety.md` 참조)
- 모든 응답은 한국어로 작성
