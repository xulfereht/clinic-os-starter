---
description: 에이전트가 프로젝트를 열면 자동으로 실행하는 최초 접촉 프로토콜. 상태 기반으로 Phase를 판별하여 적절한 워크플로우로 위임합니다.
---

# First Contact — 최초 접촉 프로토콜

에이전트가 이 프로젝트를 처음 열었을 때, 파일 존재 여부로 현재 단계를 자동 판별하고 즉시 행동합니다.
중간에 끊겨도 다시 열면 동일한 판별 로직으로 이어서 진행됩니다.

---

## Phase 판별 흐름

```
프로젝트 열기
    ↓
[체크] .agent/last-error.json 존재?
    → 있으면: Phase E (에러 복구) ← 최우선!
    ↓
[체크] node_modules/ 존재?
    → 없으면: Phase 0 (환경 확인)
    ↓
[체크] .docking/config.yaml 존재?
    → 없으면: Phase 1 (시스템 초기화)
    ↓
[체크] .agent/softgate-state.json 존재하고 Gate 0 완료?
    → 아니면: Phase 2 (소프트게이트)
    ↓
[체크] .agent/onboarding-state.json에 pending 항목?
    → 있으면: Phase 3 (온보딩)
    ↓
Phase 4 (운영 모드)
```

---

## Phase E: 에러 자동 복구 (최우선)

### 진입 조건
- `.agent/last-error.json` 파일이 존재함
- 이전 `core:pull`, `db:init`, `db:migrate` 등에서 에러가 발생하여 자동 저장됨

### 에이전트 행동 (필수)

> **중요**: 이 Phase는 다른 모든 Phase보다 우선합니다. 에러 파일이 있으면 반드시 먼저 처리하세요.

1. `.agent/last-error.json` 읽기
2. 에러 내용과 복구 방법을 사용자에게 보고:
   ```
   "이전 작업에서 에러가 발생했습니다:
    - 명령: {command}
    - 단계: {phase}
    - 에러: {error}
    복구를 시도하겠습니다."
   ```
3. `.agent/workflows/troubleshooting.md`의 해당 섹션 참조
4. `recovery.commands` 순서대로 실행 시도
5. 복구 성공 시: `.agent/last-error.json` 삭제
6. 복구 실패 시: 사용자에게 수동 조치 안내, 서포트 에이전트 에스컬레이션 고려
   - `./scripts/cos-ask "에러 내용 + 시도한 복구"`

### 완료 조건
- `.agent/last-error.json`이 삭제됨 (복구 성공 또는 사용자가 인지)

### 실패 대응
- 2회 이상 복구 실패 → 서포트 에이전트에 에스컬레이션
- 사용자에게 `npm run health`로 전체 진단 안내

---

## Phase 0: 환경 확인

### 진입 조건
- `node_modules/` 디렉토리가 없음

### 에이전트 첫 마디
```
"안녕하세요! Clinic-OS 프로젝트를 감지했습니다.
 먼저 필요한 패키지를 설치하겠습니다."
```

### 행동
1. `npm install` 실행
2. 설치 완료 확인

### 완료 조건
- `node_modules/` 생성됨

### 실패 대응
- Node.js 미설치 → "Node.js v18 이상이 필요합니다. https://nodejs.org 에서 설치하세요."
- npm 에러 → 에러 메시지 안내 후 재시도

---

## Phase 1: 시스템 초기화

### 진입 조건
- `node_modules/` 있음
- `.docking/config.yaml` 없음

### 에이전트 첫 마디
```
"패키지 설치가 완료되었습니다.
 이제 초기 설정을 시작합니다. npm run setup을 실행하겠습니다."
```

### 행동
1. `npm run setup` 실행
   - 인터랙티브 스크립트이므로, 사용자 입력이 필요한 경우 안내
   - `clinic.json`에 `license_key`가 이미 있으면 대부분 자동 진행
2. 완료 후 결과 확인

### 완료 조건
- `.docking/config.yaml` 생성됨
- `.agent/onboarding-state.json` 생성됨 (또는 템플릿에서 생성)

### 실패 대응
- 인증 실패 → HQ 서버 접속 안내 (https://clinic-os-hq.pages.dev)
- Git 미설치 → "Git이 필요합니다. 설치 후 다시 시도하세요."
- 네트워크 에러 → 재시도 안내

---

## Phase 2: 소프트게이트

### 진입 조건
- `.docking/config.yaml` 있음
- `.agent/softgate-state.json` 없거나 Gate 0 미완료

### 에이전트 첫 마디
```
"시스템 설정이 완료되었습니다!
 이제 한의원 홈페이지를 만들어 드리겠습니다.
 먼저 한의원에 대해 알려주세요."
```

### 행동
- `.agent/workflows/softgate.md`에 위임
- Gate 0: 클리닉 프로파일링 ("한의원에 대해 알려주세요")
  - 기존 홈페이지 URL 또는 네이버 플레이스로 자동 수집
  - `.agent/clinic-profile.json`에 저장
- Gate 1: GitHub 연동 (소프트 — "나중에" 가능)
- Gate 2: D1 백업 (자동 실행)
- Gate 3: R2 스토리지 (소프트 — "나중에" 가능)

### 완료 조건
- Gate 0 필수 완료 (클리닉 프로필 수집)
- 나머지 Gate: 완료 또는 skip

### 실패/중단 대응
- 사용자가 대화 중단 → 다음 세션에서 softgate-state.json 읽고 이어서 진행
- Gate 0만 완료되면 Phase 3 진입 가능 (나머지는 나중에 재안내)

---

## Phase 3: 온보딩

### 진입 조건
- 소프트게이트 Gate 0 완료 (`.agent/softgate-state.json`의 gate0 status = "done")
- 또는 `.agent/onboarding-state.json` 존재하고 pending 항목 있음

### 에이전트 첫 마디 (처음 시작)
```
"한의원 정보를 확인했습니다.
 이제 홈페이지에 들어갈 내용을 하나씩 설정하겠습니다."
```

### 에이전트 첫 마디 (이어서 진행)
```
"이전에 진행하던 온보딩을 이어서 하겠습니다.
 현재 Tier X의 [기능명]부터 시작합니다."
```

### 행동
- `.agent/workflows/onboarding.md`에 위임
- `.agent/onboarding-registry.json` 참조하여 Tier 순서대로 진행
- `clinic-profile.json`의 사전 수집 데이터를 자동 반영
- Tier 1 → 2 → 3 순서 (4-5는 선택적)
- Tier 경계에서 배포 제안 (`npm run deploy`)

### 완료 조건
- Tier 3 주요 항목 완료
- 또는 사용자가 "충분합니다" / "이정도면 됐어요" 선언

### 실패/중단 대응
- 세션 끊김 → `onboarding-state.json` 읽어서 이어서 진행
- 사용자가 특정 기능 건너뛰기 → status를 "skipped"로 기록

---

## Phase 4: 운영 모드

### 진입 조건
- 온보딩 주요 항목(Tier 1~3) 완료 또는 사용자가 "충분" 선언

### 에이전트 첫 마디
```
"온보딩이 완료되었습니다!
 이제 자유롭게 요청해 주세요. 추가 기능, 수정, 배포 등 도와드리겠습니다."
```

### 행동
- 일반 어시스턴트 모드로 전환
- 사용자 요청에 따라 작업 수행
- 문제 발생 시 `.agent/workflows/troubleshooting.md` 참조
- Tier 4-5 기능은 사용자가 원할 때 안내

### 참조 문서
- 트러블슈팅: `.agent/workflows/troubleshooting.md`
- 커스터마이징: `docs/CUSTOMIZATION_GUIDE.md`
- 플러그인 개발: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- 코어 업데이트: `.agent/workflows/upgrade-version.md`

---

## 상태 파일 레퍼런스

| 파일 | Phase에서 사용 | 역할 |
|------|---------------|------|
| `.docking/config.yaml` | Phase 1 완료 판별 | 도킹 설정 (셋업 완료 증거) |
| `.agent/softgate-state.json` | Phase 2 진행/완료 | 소프트게이트 통과 상태 |
| `.agent/clinic-profile.json` | Phase 2에서 생성 | 한의원 프로필 데이터 |
| `.agent/onboarding-state.json` | Phase 3 진행/완료 | 온보딩 기능별 상태 |
| `.agent/onboarding-registry.json` | Phase 3 참조 | 전체 기능 목록 (SOT, 읽기 전용) |

---

## 핵심 원칙

1. **에이전트-불문**: Claude, Codex, Gemini, Cursor, Windsurf, Cline 모두 동일 프로토콜
2. **상태 기반 라우팅**: 파일 존재 여부로 Phase 자동 판별 — 중간에 끊겨도 이어서 진행
3. **기존 워크플로우 재사용**: 이 문서는 softgate.md, onboarding.md로 위임 (중복 없음)
4. **최소 사용자 개입**: 에이전트가 할 수 있는 건 자동, 사람에게는 꼭 필요한 것만 요청
5. **점진적 공개**: 에이전트 지시가 짧고 명확 → 상세는 워크플로우 파일로 분리
