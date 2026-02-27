# Clinic-OS AI 에이전트 가이드

> 이 프로젝트를 처음 만나면 이 파일을 먼저 읽으세요.
> 당신의 역할: 병원 웹사이트 구축 전 과정을 안내하는 가이드입니다.

---

## 전체 여정

이 프로젝트는 4단계 여정으로 구성됩니다. 당신은 각 단계를 순서대로 안내합니다.

| 단계 | 이름 | 하는 일 | 완료 조건 |
|------|------|---------|-----------|
| 1 | **기술 설정** | npm install → npm run setup | 로컬 서버 실행 가능 |
| 2 | **온보딩** | 병원 정보, 브랜딩, 콘텐츠, 예약 설정 | 환자가 사용 가능한 사이트 |
| 3 | **배포** | npm run deploy → Cloudflare | 실제 URL로 접속 가능 |
| 4 | **운영 확장** | SMS, SEO, 다국어, 마케팅 | 선택적, 필요 시 |

---

## 현재 상태 확인법

**기술 설정 전**: `.agent/onboarding-state.json` 파일이 없으면 아직 setup 전입니다.
**기술 설정 후**: `.agent/onboarding-state.json`을 읽어서 어디까지 진행했는지 확인합니다.

---

## 단계 1: 기술 설정

1. **필수 설치 확인**: Node.js (v18+), Git
2. **패키지 설치**: `npm install`
3. **시스템 초기화**: `npm run setup` (인증, DB, 코어 파일 자동 처리)
4. **확인**: `npm run dev` → http://localhost:4321

---

## 단계 2: 온보딩 (병원 개별화)

setup 완료 후, 병원의 개별 정보를 설정합니다. 다음 파일들이 당신의 도구입니다:

| 파일 | 역할 |
|------|------|
| `.agent/onboarding-registry.json` | 전체 기능 목록 + 우선순위 + 필요 정보 (SOT, 읽기 전용) |
| `.agent/onboarding-state.json` | 진행 상태 추적 (당신이 업데이트) |
| `.agent/workflows/onboarding.md` | 대화 흐름과 실행 패턴 |
| `docs/` 디렉토리 | 각 기능별 상세 가이드 |

**우선순위 (Tier)**:
- Tier 1: 배포 필수 (병원명, 연락처, 브랜딩, 약관)
- Tier 2: 핵심 콘텐츠 (의료진, 프로그램, 홈페이지)
- Tier 3: 환자 서비스 (접수, 예약, 블로그)
- Tier 4-5: 마케팅, 운영 고도화 (선택적)

**진행 원칙**:
- 사람에게는 에이전트가 스스로 알 수 없는 정보만 요청 (병원 이름, 로고, 진료 과목 등)
- 각 기능 완료 시 `onboarding-state.json` 업데이트
- Tier 경계에서 배포 제안
- 이전 세션에서 중단했으면 state.json 읽고 이어서 진행

---

## 단계 3: 배포

```bash
npm run deploy
```

---

## 단계 4: 운영 확장 (선택적)

Tier 4-5 기능은 사용자가 원할 때 안내합니다.

---

## 프로젝트 구조

```
clinic-os/
├── .agent/                # 에이전트 데이터 (registry, state, workflows)
├── .docking/engine/       # 코어 업데이트 엔진
├── src/                   # 앱 소스 (코어 — 수정 금지)
│   ├── pages/_local/      # 페이지 커스텀 (수정 안전)
│   ├── lib/local/         # 유틸리티 커스텀 (수정 안전)
│   └── plugins/local/     # 플러그인 커스텀 (수정 안전)
├── docs/                  # 기능별 가이드 문서
└── public/local/          # 로고, 파비콘 등 (수정 안전)
```

**코어 파일 수정 금지**: `src/pages/`, `src/components/`, `src/lib/` 등은 core:pull 시 덮어쓰기됨.
**커스텀은 local/ 사용**: `src/pages/_local/`, `src/lib/local/`, `src/plugins/local/`

---

## 명령어

| 명령 | 용도 |
|------|------|
| `npm run setup` | 초기 설정 마법사 |
| `npm run dev` | 로컬 개발 서버 |
| `npm run deploy` | 프로덕션 배포 |
| `npm run core:pull` | 코어 업데이트 |

---

## 한국어 응답

모든 사용자 대면 응답은 한국어로 작성하세요.
