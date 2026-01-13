# Clinic-OS 프로젝트 가이드

> ⚠️ **Antigravity**: 이 파일을 가장 먼저 읽고 프로젝트 맥락을 파악하세요.

---

## 🧭 프로젝트 철학

### 이 시스템의 핵심 원칙

```
┌─────────────────────────────────────────────────────────────┐
│  📋 문서(GEMINI.md)가 방향을 제시합니다                     │
│  🤖 Antigravity가 각 프로젝트에 맞게 미세조정합니다         │
│  🔧 하드코딩된 규칙 대신 유연한 적용이 핵심입니다           │
└─────────────────────────────────────────────────────────────┘
```

### 왜 이 방식인가?
- 각 클라이언트의 프로젝트는 **개인화**되어 있음
- 동일한 도킹 패키지도 **프로젝트마다 다르게 적용**될 수 있음
- Antigravity가 **현재 프로젝트 상태를 파악**하고 적절히 대응

---

## 📍 현재 프로젝트 정보

> **이 섹션은 각 클라이언트가 자신의 환경에 맞게 수정합니다**

| 항목 | 값 |
|------|-----|
| 프로젝트 유형 | clinic-os (한의원 웹플랫폼) |
| 기본 버전 | 1.0.0 |
| 한의원 이름 | (site_settings에서 로드) |
| 배포 환경 | Cloudflare Pages + D1 |
| 개발 권장 환경 | WSL + Antigravity App |
| 커스터마이징 | 기본 |

### 적용된 도킹 패키지
`.docking/.applied` 파일 참조

### 주요 커스터마이징 사항
- (클라이언트가 직접 수정한 부분을 여기에 기록)

### 환경 설정 (Node/NPM Path)
시스템 실행 시 Node/NPM 경로가 잡히지 않을 경우, 다음 명령어로 경로를 잡아주세요.
```bash
export PATH=/Users/amu/.nvm/versions/node/v24.11.0/bin:$PATH
```
---

## 🤖 Antigravity 작업 지침

### 도킹 패키지 적용 시

1. **현재 프로젝트 상태 파악**
   - 이 GEMINI.md 읽기
   - `.docking/.applied` 확인
   - 커스터마이징된 파일 파악

2. **패키지 분석**
   - `manifest.yaml` 읽기
   - `instructions.md` 확인
   - 충돌 가능성 사전 파악

3. **적응적 적용**
   - 프로젝트 구조에 맞게 조정
   - 기존 커스터마이징 보존
   - 충돌 시 사용자에게 설명 후 결정

### 버전 업그레이드 시

1. **글로벌 체크포인트 생성**: `.docking/checkpoints/`에 현재 상태 전체 백업
2. **패키지 백업**: 새로운 버전의 순수 소스코드를 `.docking/versions/`에 저장
3. **변경사항 분석**: 새 버전 vs 현재 소스 vs 이전 버전(Ancestor) 비교
4. **적응적 병합**: `GEMINI.md`의 맥락을 유지하며 지능적으로 코드 통합
5. **테스트 및 검증**: 작동 확인 후 사용자 승인

---

## 📂 프로젝트 구조

```
clinic-os/
├── GEMINI.md              # ⭐ 프로젝트 컨텍스트 (최우선 참조)
├── .agent/workflows/      # Antigravity 워크플로우
├── .docking/              # 🛰️ 도킹 시스템 및 히스토리
│   ├── versions/          # 📦 패키지 버전별 원본 (Common Ancestor)
│   ├── checkpoints/       # 🕒 로컬 코드 스냅샷 (작업 전/후 백업)
│   ├── logs/              # 📜 통합 및 결정 로그 (Integration Logs)
│   └── .applied           # 현재 적용된 패키지 메타데이터
├── src/
│   ├── pages/             # 웹페이지 (Integrated Layer)
│   ├── components/        # UI 컴포넌트
│   └── lib/               # 유틸리티
├── migrations/            # DB 스키마
├── seeds/                 # 초기 데이터
└── docs/                  # 운영 가이드
```

---

## 🎯 주요 워크플로우

### 처음 사용자용 퀵스타트
1.  **필수 환경 (Windows)**: 반드시 **WSL2**가 설치되어 있어야 합니다. (Node.js v20+)
    - *윈도우 네이티브(C:)에서의 실행은 권장하지 않습니다.*
2.  **프로젝트 열기**: **Antigravity 앱**에서 `\\wsl$\Ubuntu\home\...` 경로의 프로젝트를 엽니다.
3.  **초기 설정**: `/setup-clinic` (앱 내 채팅으로 요청)
    - Node.js(v20), 패키지 설치, DB 초기화가 자동으로 진행됩니다.
4.  **로컬 실행**: `npm run dev` (앱 내 터미널 사용)
    - 브라우저에서 `http://localhost:4321` 접속 확인

### 클라이언트 명령어

| 명령 | 용도 | 언제 사용 |
|------|------|----------|
| `npm run setup` | 초기 설정 마법사 | 프로젝트 처음 시작 시 |
| `npm run fetch` | 최신 앱 패키지 다운로드 | 업데이트 확인 시 |
| `npm run core:pull` | HQ에서 앱 패키지 업데이트 | 새 기능 적용 시 |
| `npm run update:starter` | Starter Kit 인프라 업데이트 | 인프라 변경 시 |
| `npm run upgrade` | 수동 zip 패키지 적용 | zip 파일로 받은 경우 |
| `npm run dev` | 로컬 개발 서버 | 개발/테스트 시 |
| `npm run deploy` | 프로덕션 배포 | Cloudflare 배포 |
| `npm run doctor` | 시스템 건전성 체크 | 문제 발생 시 |
| `/help` | 도움 요청 | 문제 발생 시 |

### 개발자 명령어 (HQ 전용)

| 명령 | 용도 |
|------|------|
| `npm run publish` | 전체 릴리스 (git + starter + core + HQ 배포) |
| `npm run starter:push` | Starter Kit 미러 저장소 푸시 |
| `npm run core:push` | Core 앱 미러 저장소 푸시 |
| `npm run hq:deploy` | HQ 서버 배포 |
| `npm run db:init` | DB 스키마 초기화 |
| `npm run db:seed` | 샘플 데이터 삽입 |

---

## 💡 자주 묻는 질문

### 도킹 패키지가 내 커스터마이징을 덮어쓰나요?
→ 아니요. Antigravity가 **현재 프로젝트 상태를 파악**하고 
   커스터마이징을 보존하면서 적용합니다.

### 같은 패키지도 다르게 적용되나요?
→ 네. 각 프로젝트의 **현재 상태에 맞게 적응적으로** 적용됩니다.

### 충돌이 발생하면?
→ Antigravity가 **설명하고 선택지를 제시**합니다.
   최종 결정은 사용자가 합니다.

---

## 🆘 문제 해결

| 상황 | 명령어 |
|------|------|
| 처음 설치 | `npm run setup` |
| 앱 업데이트 | `npm run core:pull` |
| 인프라 업데이트 | `npm run update:starter` |
| 수동 패키지 적용 | `npm run upgrade` |
| 시스템 진단 | `npm run doctor` |
| 오류 발생 | 오류 메시지와 함께 `/help` |
| 되돌리기 | `git checkout HEAD~1` |

---

## 📝 관리자 기능

| 경로 | 기능 |
|------|------|
| `/admin` | 대시보드 |
| `/admin/programs` | 진료 프로그램 |
| `/admin/patients` | 환자 관리 |
| `/admin/reservations` | 예약 관리 |
| `/admin/posts` | 블로그/칼럼 |
| `/admin/settings` | 설정 |
