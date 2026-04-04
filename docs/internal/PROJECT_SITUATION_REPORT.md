---
schema: for-user-doc/v1
title: Clinic-OS 프로젝트 상황 종합 보고서
date: '2026-03-25T00:00:00+09:00'
created_at: '2026-03-25T14:00:00+09:00'
updated_at: '2026-03-25T15:00:00+09:00'
type: report
audience: human
lang: mixed
purpose: requested
canonical_id: reports/2026-03-25-clinic-os-project-situation-report
read_status: unread
inbox: true
aura_expose: true
labels:
- report
- requested
- human
- clinic-os
- workshop
- codebase-review
- direction-alignment
tags:
- clinic-os
- codebase-review
- architecture
- workshop
- vibe-coding
- agent-coding
- project-status
- direction-alignment
relates_to:
- reports/2026-03-24-clinic-os-workshop-2nd-planning
agent_meta:
  created_at: '2026-03-25T14:00:00+09:00'
  updated_at: '2026-03-25T14:00:00+09:00'
  mode: base
  source_command: report
---

# Clinic-OS 프로젝트 상황 종합 보고서

> **작성일**: 2026-03-25 | **버전**: v1.30.6 | **목적**: 프로젝트 전체 방향성 정렬을 위한 현황 파악
> **이전 문서**: [2차 워크숍 기획 리포트](./2026-03-24-clinic-os-workshop-2nd-planning.md)

---

## 1. 프로젝트 비전 — 에이전트 캐스케이드

### 1.1 본질

Clinic-OS는 소스코드가 아니라 **에이전트 시스템**이다. 배포하는 것은 웹사이트 코드가 아니라 **한의원 AI 에이전트**이며, 소스코드는 그 에이전트의 수단이다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    메타 에이전트 (마스터 레포)                      │
│     soul.md + 목적 매니페스트 → 모든 결정의 기준점                  │
│     배포, 소스관리, 클라이언트관리, 워크샵, HQ, 마케팅              │
├─────────────────────────────────────────────────────────────────┤
│                    core:push = 에이전트 이식                      │
│           소스코드 + soul + 스킬 + 데이터 커넥터 함께 배포          │
├──────────────┬──────────────┬───────────────────────────────────┤
│  로컬 에이전트 │  로컬 에이전트 │  로컬 에이전트 ...                  │
│  (한의원 A)   │  (한의원 B)   │  (한의원 C)                        │
│              │              │                                    │
│  웹사이트(겉) → 관리자(휴먼조작) → 데이터 축적 → 에이전트 연료      │
│              │              │                                    │
│  Claude Code + 하니스 스킬                                       │
│  블로그 생성 / 경영분석 / 데이터 조작 / API 연동                   │
└──────────────┴──────────────┴───────────────────────────────────┘
```

### 1.2 3-레이어 구조

| 레이어 | 역할 | 주체 |
|--------|------|------|
| **메타 에이전트** | 전체 오케스트레이션 — 배포, 클라이언트관리, 워크샵, 마케팅 | 개발자(AMU) + Claude Code |
| **코어 배포** | soul + 스킬 + 데이터 커넥터를 소스코드와 함께 배포 | core:push 파이프라인 |
| **로컬 에이전트** | 각 한의원에서 원장을 10x로 만드는 AI 파트너 | 원장 + Claude Code |

### 1.3 워크샵의 진짜 의미

| 참가자가 보는 것 | 실제로 일어나는 것 |
|-----------------|-------------------|
| "AI가 홈페이지 만들어줌" | 한의원 에이전트 이식 |
| "코딩 안 해도 됨" | 코드 대신 에이전트가 주도 |
| "Codespaces로 쉽게" | 진입장벽 제거 = 에이전트 접근성 |
| "관리자 페이지에서 운영" | 데이터 축적 → 에이전트 연료 |
| "계속 업데이트 받음" | soul + 스킬 지속 배포 |

워크샵의 겉 목적: **AI가 주도하는(코딩리스한) 홈페이지 및 Clinic-OS 구축.**
워크샵의 속 목적: **참가자가 에이전트와 협업하는 방식(AI AA)에 익숙해지는 것.**
워크샵의 결과: **한의원 에이전트가 이식되고, 이후 스킬 배포를 통해 계속 성장.**

### 1.4 1기 → 2기 패러다임 전환

| | 1기 (2026 Q1) | 2기 (계획중) |
|---|---|---|
| **래핑** | 바이브코딩으로 홈페이지 만들기 | AI가 만들어주는 홈페이지 + Clinic-OS |
| **실체** | 코드를 보면서 AI에게 지시 | 에이전트가 주도, 코드 최소 노출 |
| **진입** | WSL/Node/Git 직접 설치 | Codespaces (브라우저만) |
| **결과물** | 웹사이트 소스코드 소유 | **한의원 에이전트 이식 + 웹사이트** |
| **이후** | 코드를 직접 관리해야 함 | 에이전트가 관리, 스킬 업데이트 수신 |

---

## 2. 비즈니스 프레임 — EP91 "바닐라 전략"과의 정렬

> 참조: EP 91. 26.1Q 비즈니스 관점에서의 AI (노정석, 최승준)

### 2.1 Clinic-OS = 한의원의 "바닐라 전략" 구현체

EP91의 핵심 결론: **데이터 커넥터 + 프롬프트 + 프론티어 모델 = 효율화의 정답.**
미들웨어를 만들지 않는다. 프론티어 모델에 도메인 데이터를 연결하고 프롬프트로 지시하면 된다.

Clinic-OS가 하는 것이 정확히 이것이다:

```
┌─────────────────────────────────────────────────────────┐
│              바닐라 전략 = Clinic-OS 배포물               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  데이터 커넥터     프롬프트(스킬)     프론티어 모델        │
│  ─────────────    ──────────────    ──────────────      │
│  D1 DB (환자,     .claude/commands/  Claude Code        │
│  예약, CRM,       soul.md            (로컬 실행)         │
│  블로그, 분석)     하니스 스킬들                           │
│       │                │                  │             │
│       └────────────────┼──────────────────┘             │
│                        │                                │
│              원장의 10x 에이전트 파트너                    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 1/10x 효율 + 10x 혁신 — 둘 다 제공

EP91: 효율화와 혁신은 orthogonal(직교). 둘 다 해야 한다.

| 축 | Clinic-OS에서의 의미 | 예시 |
|----|---------------------|------|
| **1/10x 효율** | 원장의 반복 업무를 에이전트가 대체 | 블로그 자동 생성, 경영 리포트, 환자 코호트 분석, 예약 관리 |
| **10x 혁신** | 한의원이 기존에 못 하던 것을 가능하게 | AEO(AI 검색 최적화), 데이터 기반 CRM, AI 문진, 자동 마케팅 캠페인 |

워크샵은 이 두 축을 동시에 전달하는 매체:
- **효율**: "이 스킬을 쓰면 블로그 1시간 → 5분"
- **혁신**: "이런 것도 가능해진다"는 마인드 이식 (AI AA)

### 2.3 에이전트 캐스케이드 = Meta Cascading

EP91의 가재 가족 사례: 메타 레이어에서 하위로 task가 cascade되며 자율 해결 → 리포팅.

Clinic-OS의 동형 구조:
```
메타 에이전트 (마스터 레포)
  ├── 배포 task → core:push → 로컬 에이전트들에 전파
  ├── 클라이언트 관리 task → HQ API → 상태 모니터링
  ├── 마케팅 task → 콘텐츠 생성 → 배포
  └── 워크샵 task → 가이드 업데이트 → 참가자 안내
          │
          ▼
로컬 에이전트 (각 한의원)
  ├── 블로그 생성 task → D1 데이터 → 콘텐츠 작성 → API로 발행
  ├── 경영분석 task → D1 데이터 → 리포트 생성
  ├── 환자관리 task → 코호트 분석 → CRM 자동화
  └── 결과 리포팅 → 원장 확인 → 승인/수정
```

### 2.4 "비서 공급업" — 업의 본질 재정의

EP91: "수단을 제공하는 게 아니라 해결 완료를 팔아야 해요."

Clinic-OS가 파는 것:
- ~~소스코드~~ → **한의원 AI 비서**
- ~~홈페이지 템플릿~~ → **운영 자동화 시스템**
- ~~코딩 교육~~ → **에이전트 협업 역량**

참가자가 워크샵을 마치면 소유하게 되는 것:
1. 작동하는 웹사이트 (가시적 결과물)
2. 데이터가 축적되는 관리 시스템 (장기 자산)
3. 로컬 AI 에이전트 + 스킬 (지속 성장하는 비서)
4. 에이전트와 협업하는 방법 (AI AA 역량)

### 2.5 optimization 루프가 비즈니스 커뮤니티를 만든다

EP91: "이 루프를 자기 비즈니스에 올리는 자가 살아남는다."

```
워크샵 참가 → 에이전트 이식 → 데이터 축적 → 스킬 활용
     ↑                                          │
     │          비즈니스 커뮤니티                   │
     │    ┌──────────────────────┐               │
     │    │ 성공 사례 공유        │               │
     │    │ 스킬 요청/피드백      │               │
     │    │ 원장 간 네트워킹      │               │
     │    └──────────────────────┘               │
     │                                          ↓
     └──── 새 스킬 배포 (core:push) ←── 검증된 패턴 축적
```

각 한의원의 에이전트 활용 경험이 커뮤니티로 모이고, 검증된 패턴이 새 스킬로 배포되며, 이것이 다시 더 많은 참가를 이끄는 **optimization 루프**.

---

## 3. 코드베이스 현황 (v1.30.6) — 에이전트 관점에서

---

## 2. 코드베이스 현황 (v1.30.6)

### 2.1 에이전트 관점 — 이미 있는 것 vs 필요한 것

**이미 존재하는 씨앗:**

| 요소 | 현재 | 에이전트 캐스케이드에서의 역할 |
|------|------|-------------------------------|
| `.claude/rules/` (2개) | clinic-os-safety, support-agent | 로컬 에이전트 **행동 규칙** |
| `.claude/commands/` (10개) | /onboarding, /status 등 | 로컬 에이전트 **스킬 프리미티브** |
| `.agent/workflows/` (22개) | setup, onboarding, softgate | 로컬 에이전트 **자동화 플로우** |
| `CLAUDE.md` | 프로젝트 가이드 | **soul의 초안** (규칙 중심 → 목적 중심 전환 필요) |
| `src/pages/api/` (336파일) | REST API | **데이터 커넥터의 백본** |
| 관리자 페이지 (114파일) | 휴먼 조작 UI | 데이터 축적 → 에이전트 연료 |
| core:push/pull | 코드 배포 | soul + 스킬 배포 파이프라인 (확장 필요) |

**아직 없는 것 (갭):**

| 필요한 것 | 설명 |
|-----------|------|
| **soul.md** | 프로젝트 목적/의도 매니페스트 — 모든 결정의 기준점 |
| **하니스 스킬** | 블로그 생성, 경영분석, 데이터 조작 등 실무 Claude Code 스킬 |
| **데이터 커넥터 레이어** | Claude Code가 D1 데이터에 접속하는 표준 인터페이스 |
| **스킬 배포 메커니즘** | core:push에 .claude/commands/ 스킬도 포함 (현재 부분 포함) |
| **메타 에이전트 스킬** | 마스터 레포의 배포/클라이언트관리/마케팅 스킬 |
| **로컬 에이전트 부트스트랩** | `claude` 실행 시 자동으로 스킬+컨텍스트+데이터커넥터 로드 |

### 2.2 중첩 구조 — 하나의 레포에 4개 시스템

```
clinic-os/  (마스터 레포)
│
├── src/                    ← ① 메인 앱 (클라이언트가 받는 한의원 웹사이트)
│   ├── pages/      547파일   퍼블릭 + 어드민 + API(52그룹, 336파일)
│   ├── components/ 117파일   UI/어드민/31개 재사용 섹션
│   ├── lib/        116파일   인증, AEO, 분석, 알리고, 스킨, 플러그인SDK
│   ├── plugins/    3종       survey-tools, custom-homepage, local/
│   ├── skins/      9테마     hanbangClassic, editorialCalm 등
│   ├── middleware.ts 293줄   봇감지, 세션인증, RBAC, i18n
│   └── [총 827 소스파일, 9.5MB]
│
├── hq/                     ← ② HQ 서버 (중앙 관리 플랫폼)
│   ├── src/index.js  35,460줄  Workers 단일 파일 (224 라우트)
│   ├── guides/       39개 MD   워크샵 참가자용 가이드
│   ├── skins/        2개       HQ 큐레이션 스킨
│   ├── migrations/   20개      HQ 전용 D1 마이그레이션
│   ├── seeds/        119개     HQ 시드 데이터
│   └── schema*.sql   3파일     메인+플러그인+스킨 스키마
│
├── .docking/               ← ③ 배포 엔진 (코어 배포 인프라)
│   └── engine/     6,613줄   fetch.js, migrate.js, atomic-update.js 등 10모듈
├── .mirror-staging/        ← clinic-os-core 서브모듈
├── .starter-staging/       ← clinic-os-starter 서브모듈
├── scripts/        166개    릴리스, DB, 코어, 배포, 셋업, 헬스체크
├── migrations/     49 DDL   메인 앱 스키마 (4.8MB)
├── seeds/          56 DML   시드 데이터 (1.7MB)
│
├── support-agent-worker/   ← ④ 보조 시스템
├── mcp-worker/
├── .agent/                 ← 에이전트 워크플로우 (22개 MD)
└── openclaw-bridge/
```

### 2.3 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Astro 5 + React 18 + Tailwind 4 |
| 백엔드 | Cloudflare Workers (SSR) + D1 (SQLite) + R2 |
| HQ 서버 | Cloudflare Workers + D1 + R2 |
| 배포 | Cloudflare Pages + Git 서브모듈 기반 코어 배포 |
| 에이전트 | Claude Code (1순위) + 범용 AI 에이전트 지원 |
| i18n | 5개 언어 (ko, en, ja, zh-hans, vi) |

### 2.4 배포 아키텍처

```
개발 (마스터)
  │
  ├── npm run publish → 릴리스 태그 + core:push
  │     ├── .mirror-staging → GitHub clinic-os-core → latest-beta
  │     └── .starter-staging → GitHub clinic-os-starter
  │
  ├── 검증 후 → latest-stable 승격
  │
  └── HQ 서버가 스타터킷 ZIP을 R2에 호스팅
        │
        ▼
클라이언트 (워크샵 참가자 or 위임 클라이언트)
  │
  ├── cos-setup.sh 실행 → ZIP 다운로드 → 압축 해제
  ├── Claude Code → setup:step (17단계 자동 설치)
  ├── core:pull → 코어 업데이트 수신
  └── local/ 영역에서 커스터마이징
```

### 2.5 보호 계층 시스템

| 계층 | 경로 | core:pull 동작 |
|------|------|----------------|
| **코어** (덮어쓰기) | src/pages/, components/, lib/, layouts/, scripts/ 등 | 마스터에서 온 코드로 대체 |
| **로컬** (절대 보호) | src/pages/_local/, lib/local/, plugins/local/, skins/local/ | 건드리지 않음 |
| **보호** (클라이언트 보존) | wrangler.toml, clinic.json, .docking/config.yaml, src/config.ts | 양쪽 존재 시 클라이언트 것 유지 |
| **특수 병합** | package.json | 스마트 병합 |

### 2.6 핵심 수치

| 지표 | 값 |
|------|-----|
| 메인 앱 소스 | 827 파일 / 9.5MB |
| HQ 서버 | 35,460줄 단일 파일 / 224 API 라우트 |
| 스크립트 | 166개 / 1.6MB |
| DB 마이그레이션 | 49(메인) + 20(HQ) |
| 시드 데이터 | 56(메인) + 119(HQ) |
| 도킹 엔진 | 6,613줄 / 10 모듈 |
| 가이드 | 39개(HQ) + 54개(docs/) |
| 에이전트 워크플로우 | 22개 |
| 스킨 | 9(메인) + 2(HQ 큐레이션) |

---

## 4. 워크샵 히스토리 — 1기에서 2기로

### 3.1 1기 워크샵 (2026 Q1, 완료)

| 항목 | 내용 |
|------|------|
| **기간** | 2026-01-07 ~ 02-26 (4주 + 후속 2회) |
| **방식** | Zoom + LiveKlass |
| **접근법** | "바이브코딩" — 코드를 보면서 AI에게 지시 |
| **환경** | 각자 PC (Windows WSL / macOS 로컬) |
| **가격** | 250만원 (사전신청 200만원) / 대행 500만원 별도 |
| **커리큘럼** | 1주차(설치) → 2주차(콘텐츠) → 3주차(환자동선) → 4주차(CRM) |
| **참가자** | 한의원 원장 다수 (경희, 동국, 원광 등) |
| **핵심 병목** | Windows WSL 설치가 최대 장벽 |

**1차 자료 인벤토리** (현재 보유):
- 공고문 3버전 (사전모집, 정식, 간결)
- 프리 웨비나 자료 7건 (2025-12-10)
- 본 워크숍 4주 + 후속 2회 강의노트/녹화/트랜스크립트
- 랜딩페이지 HTML v1/v2 + 스크린샷
- 기획서 + 블로그 원고 4건
- KakaoTalk 채팅 기록 (666줄)

### 3.2 1기 → 2기 핵심 전환

| 항목 | 1기 | 2기 |
|------|-----|-----|
| **접근법** | 바이브코딩 (코드 직접 노출) | **에이전트 기반** (대화로 지시, 코드 최소 노출) |
| **환경** | 각자 PC (WSL 병목) | **GitHub Codespaces** (브라우저만) |
| **CF 인증** | wrangler login (OAuth) | **API 토큰 방식** (OAuth 불안정 확인) |
| **제공 형태** | 직접 설치 only | **직접 설치 + 위임 통합** |
| **사전 준비** | WSL/Node/Git/wrangler 전부 | **GitHub + Cloudflare + Claude 가입 3개** |

### 3.3 2기 기획 현황 (2026-03-24 기준)

**확정된 것:**
- 개발환경: GitHub Codespaces (Windows) / 로컬 (macOS)
- CF 인증: API 토큰 방식
- 사전 준비: 계정 3개만
- Codespaces 전체 플로우 테스트 완료 (2026-03-24)
- `github.com/xulfereht/clinic-os-workshop` public repo 생성 완료
- `.devcontainer/devcontainer.json` 설정 완료
- v1.30.6 풀 릴리즈 완료 (core/starter/HQ/baekrokdam)

**미결정:**
- 가격: 250만원 동결? 인상?
- 위임 트랙 가격
- 일정: 시작일, 요일, 시간
- 1기 성과/후기 데이터 수집
- macOS 참가자 로컬 가이드 정비

**미검증:**
- 동시 15명 사용 시 Codespaces 안정성
- 한국 낮 시간대 빌드 레이턴시 체감
- Codespace 재생성 시 디바이스 재등록 처리
- Claude Code Remote Control + Codespaces 조합

### 3.4 2기 워크샵 플로우 (확정)

```
사전 준비 (참가자)
  ① GitHub 가입
  ② Cloudflare 가입
  ③ Claude 가입 (Pro 구독 권장)

당일 진행
  ① github.com/xulfereht/clinic-os-workshop 접속
  ② Code → Codespaces → Create codespace (2~3분)
  ③ Node 22 + wrangler + Astro + Claude Code 자동 설치
  ④ 터미널에서 claude 실행
  ⑤ "HQ에서 스타터킷 받아서 설치해줘"
  ⑥ Claude Code 자동: curl → unzip → npm run setup:agent (17단계)
  ⑦ npm run dev → 포트 포워딩으로 브라우저에서 확인
  ⑧ CF 배포: API 토큰 발급 → 환경변수 설정

워크숍 후 (장기 운영)
  → 맥미니 전환 안내 (로컬 환경)
  → 또는 Codespaces 계속 사용 (무료~$18/월)
```

---

## 5. 참가자가 받는 것 — 스타터킷 구성

### 4.1 파일 구성

| 디렉토리 | 수량 | 역할 |
|----------|------|------|
| `.agent/workflows/` | 22 MD | 에이전트 자동 설치/온보딩/트러블슈팅 |
| `.agent/manifests/` | 4 JSON | 변경 전략, 워크스페이스, 안전규칙 |
| `.claude/commands/` | 10 MD | /onboarding, /status, /core-update 등 |
| `.claude/rules/` | 2 MD | clinic-os-safety, support-agent |
| `.docking/engine/` | 10 JS | 코어 동기화 엔진 (6,613줄) |
| `scripts/` | 65개 | 설치, 배포, 진단, 코어 관리 |
| `docs/` | 54 MD | 가이드, 커스터마이징, 스펙 |
| `core/` | (비어있음) | core:pull로 채워짐 |

### 4.2 설치 17단계

| Phase | 단계 | 내용 |
|-------|------|------|
| 1 | check-system, init-config, cf-login | 환경 확인, 설정 생성, CF 인증 |
| 2 | device-register | HQ에 디바이스 등록 |
| 3 | npm-install-root, npm-install-core | 의존성 설치 |
| 4 | git-init, core-pull | Git 초기화, 코어 다운로드 |
| 5 | db-migrate, db-seed (6종) | DDL 적용 + 시드 데이터 |
| 6 | onboarding-init | 온보딩 초기화 |

### 4.3 온보딩 시스템

설치 후 `.agent/onboarding-registry.json`에 정의된 53개 기능을 5 티어로 안내:
- **Tier 1** (배포 필수): 기본 정보, 도메인, 관리자 계정
- **Tier 2** (핵심 콘텐츠): 의료진, 프로그램, 블로그
- **Tier 3** (환자 서비스): 예약, 문진, 자가진단
- **Tier 4** (마케팅): CRM, 캠페인, 리뷰
- **Tier 5** (고도화): 분석, 자동화, VIP

---

## 6. HQ 가이드 — 워크샵 커리큘럼과의 매핑

### 5.1 현재 가이드 구조 (39개)

| 카테고리 | 가이드 | 워크샵 연관 |
|----------|--------|-------------|
| **01. 설치** | install-overview, codespaces-guide, macos-guide, windows-guide, wsl-guide, cloudflare-setup | 1주차 (환경 세팅) |
| **02. 시작** | overview, local-vs-production, when-to-use-what | 1주차 (개념 이해) |
| **03. 에이전트 워크플로** | vibe-start, vibe-prompting, vibe-screenshot, vibe-recipes, vibe-troubleshooting, vibe-layers, vibe-skins, vibe-history, vibe-plugins | **전 주차 (핵심)** |
| **04. 플러그인/스킨** | plugin-overview, plugin-sharing, skin-sharing | 3-4주차 |
| **미작성 계획** | 05~10 카테고리 (30개) | 환자관리, 콘텐츠, CRM, 분석, 설정, 고급 |

### 5.2 vibe 가이드 (9개) — 에이전트 기반 작업의 핵심

| 가이드 | 핵심 교육 내용 |
|--------|---------------|
| **vibe-start** | 에이전트 드리븐 시작, CLAUDE.md 읽기, 첫 대화 |
| **vibe-prompting** | 맥락의 3요소, 질문 템플릿, 피할 것 |
| **vibe-screenshot** | Mac/Windows 캡처, Console 탭 열기 |
| **vibe-recipes** | 텍스트/이미지/색상 변경, 예약, 배포 요청 모음 |
| **vibe-troubleshooting** | 에러 찾기, 3단계 문제 해결 |
| **vibe-layers** | 레이어 1(콘크리트) / 2(가구) / 3(가건물) 수정 범위 |
| **vibe-skins** | 스킨 생성/적용/미리보기 |
| **vibe-history** | Git 버전 관리 = 무한 되돌리기 |
| **vibe-plugins** | 플러그인 구조, custom_ 접두사, 훅 시스템 |

### 5.3 FAQ 계획 (6개 카테고리, 미작성)

1. 서비스 소개 — "Clinic-OS가 뭔가요?", "바이브코딩이 뭔가요?"
2. 가입/시작하기 — 시작 방법, 승인, 403 오류
3. 준비사항 — OS, 사양, 디바이스, Codespaces
4. 워크샵/교육 — 참석 못할 때, 녹화본, 추가 질문
5. 결제/라이선스 — 비용, 라이선스, Claude Pro
6. 도움/지원 — 막히면, 컴퓨터 안전, 커뮤니티

---

## 7. 운영 중인 클라이언트

### 바로한의원 (위임 클라이언트)

| 항목 | 상세 |
|------|------|
| 레포 | `~/projects/delegated-clients/baro-clinic/` (MBP) |
| CF 프로젝트 | `cos-42a90ec73470` |
| 홈페이지 | `core/src/pages/_local/index.astro` (editorial 프리셋 기반) |
| 에셋 | `core/public/homepage/optimized/` + `asset-metadata.json` |
| 현재 버전 | v1.30.6 |

### 백록담한의원 (개발자 자체 운영)

- 프로덕션 사이트 (baekrokdam.com)
- 릴리스 검증 거점: beta → baekrokdam 검증 → stable 승격

---

## 8. 현재 진행 상태 — 무엇이 완료되고 무엇이 남았나

### 완료된 것

**제품**
- v1.30.6 풀 릴리즈 (core + starter + HQ + baekrokdam)
- 메인 앱: 827 소스파일, 52개 API 그룹, 9 스킨, 3 플러그인
- HQ: 224 라우트, 39 가이드, 마켓플레이스, 서포트 에이전트
- 배포 인프라: 도킹 엔진, 17단계 자동 설치, 보호 계층 시스템
- editorial/classic 홈페이지 프리셋
- 바로한의원 위임 완성

**2기 워크샵 기반**
- 개발환경 확정 (Codespaces + API 토큰)
- Codespaces 전체 플로우 테스트 완료
- workshop repo + .devcontainer 설정
- vibe 가이드 9개 + Codespaces 가이드 작성 완료
- Windows/WSL 가이드 재구성 완료
- 1차 자료 인벤토리 정리

### 미완료 — 2기 워크샵 준비

**결정 필요**
- 가격 (250만원 동결/인상)
- 위임 트랙 가격
- 일정 (시작일, 요일, 시간)

**검증 필요**
- 동시 15명 Codespaces 안정성
- 한국 낮 시간대 레이턴시
- Codespace 재생성 시 디바이스 재등록
- Claude Code Remote Control + Codespaces 조합

**콘텐츠**
- 1기 성과/후기 데이터 수집
- 2기 공고문 작성 (1기 베이스)
- FAQ 6개 카테고리 작성
- HQ 가이드 05~10 카테고리 (30개 계획)
- macOS 참가자 로컬 가이드 정비

**인프라**
- cos-setup.sh에 CODESPACES 환경변수 감지 로직
- wsl-guide.md 레거시 배너 추가

### 미완료 — 제품 발전

- HQ index.js 35K줄 → 모듈 분리 (기술 부채)
- 플러그인 마켓플레이스 실제 운영
- 스킨 마켓플레이스 실제 운영
- HQ 가이드 05~10 카테고리 30개 작성
- 서포트 에이전트 고도화

---

## 9. 참고 문서 위치

### 프로젝트 내부 (clinic-os/)

| 문서 | 경로 |
|------|------|
| 아키텍처 개요 | `ARCHITECTURE.md` |
| 프로젝트 가이드 | `CLAUDE.md` |
| 파일 안전 규칙 | `.claude/rules/clinic-os-safety.md` |
| 릴리스 워크플로우 | `docs/internal/RELEASE_WORKFLOW.md` |
| 변경 로그 | `CHANGELOG.md` |
| HQ 가이드 계획 | `hq/GUIDE_PLAN.md` |
| HQ FAQ 계획 | `hq/FAQ_PLAN.md` |
| HQ 스타일 가이드 | `hq/STYLE_GUIDE.md` |
| 에이전트 워크플로우 | `.agent/workflows/` |

### 외부 기획 문서 (.openclaw/)

| 문서 | 경로 |
|------|------|
| 2차 기획 리포트 | `~/.openclaw/workspace/memory/for-user/docs/reports/2026-03-24-clinic-os-workshop-2nd-planning.md` |
| 환경 옵션 비교 | `~/.openclaw/workspace/data/vibe-coding-workshop-2nd-env-options.md` |
| 작업 핸드오프 | `~/.openclaw/workspace/data/clinic-os-workshop-2nd-handoff.md` |
| 1차 자료 인벤토리 | `~/.openclaw/workspace/data/vibe-coding-workshop-inventory.md` |

### 외부 자료 (Google Drive)

| 자료 | 위치 |
|------|------|
| 프리 웨비나 폴더 | `drive/바이브코딩-웨비나/` |
| 본 워크숍 폴더 | `drive/홈페이지-웨비나-2026Q1/` |
| 워크샵 자료 폴더 | `drive/바이브코딩 워크샵/` |
| 1차 공고 원본 | `drive/클리닉OS 공고 1.md` (384~850줄) |

---

## 10. 다음 단계 — 에이전트 캐스케이드 구현 로드맵

### 완료 (2026-03-25 세션)

| 작업 | 결과 |
|------|------|
| SOUL.md (마스터) | ✅ 생성 — 메타 에이전트 정체성, 부팅 시퀀스, SOT 계층, 행동 원칙 |
| MANIFEST.md (마스터) | ✅ 생성 — 10x/1÷10x 목표, 아키텍처, 스킬 시스템, 실행 원칙 |
| CLAUDE.md 재설계 | ✅ soul/manifest 참조 구조로 전환, v1.30.6 현행화 |
| SOUL.local.md (클라이언트) | ✅ 로컬 에이전트 정체성 (목적 튜닝 이식) |
| MANIFEST.local.md (클라이언트) | ✅ 스킬 카탈로그 (content-bootstrap 16스킬 매핑), API 커넥터 맵 |
| CLAUDE.md 재설계 | ✅ soul/manifest 참조, 스킬 섹션 추가 |
| 스킬 배포 파이프라인 검증 | ✅ .claude/commands/ → core:push 자동 배포 확인 |
| 데이터 커넥터 | ✅ 기존 API 336개 활용 (vanilla principle), MANIFEST.local.md에 맵 |
| P0 스킬 | ✅ /help (스킬 가이드), /setup-clinic-info (병원 기본 정보) 생성 |
| 기존 스킬 감사 | ✅ 16개 전수 감사 — 전부 well-defined orchestrator |

### 진행 중 — 스킬 고정 (content-bootstrap → atomic 스킬)

content-bootstrap.md 6 Phase를 16개 atomic 스킬로 분해. 하나씩 스킬로 고정 중:

| 스킬 | Phase | 상태 |
|------|-------|------|
| `/extract-content` | 1a+1b, 4a-d | ✅ 이미 존재 (Place+Blog 통합) |
| `/setup-clinic-info` | 5a | ✅ 신규 생성 |
| `/help` | — | ✅ 신규 생성 |
| `/style-card` | 2a | ⏳ 다음 |
| `/plan-programs` | 2b | ⏳ |
| `/plan-images` | 2c | ⏳ |
| `/generate-images` | 3 | ⏳ (스크립트 존재) |
| `/tag-posts` | 4c | ⏳ |
| `/setup-terms` | 5b | ⏳ |
| `/setup-programs` | 5c | ⏳ |
| `/setup-skin` | 5d | ⏳ |
| `/setup-features` | 5e | ⏳ |
| `/setup-homepage` | 6 | ⏳ |

### 남은 과제

**배포 파이프라인:**
- SOUL.local.md + MANIFEST.local.md를 core:push에 포함 (shared-file-lists.js 수정)

**스킬 검증:**
- 바로한의원 or 테스트 환경에서 스킬 실행 검증
- 워크샵 시뮬레이션 (Codespaces에서 전체 플로우)

**마케팅 자료 통합:**
- 1차 워크샵 공고문, 랜딩페이지, 웨비나 자료가 레포 외부(.openclaw/, Drive)에 존재
- 메타 에이전트가 참조할 수 있도록 레포 내 또는 연결 구조 필요

**2기 워크샵:**
- 가격/일정 확정
- 공고문 작성 (1기 베이스 + 에이전트 기반 전환 반영)
- FAQ 6개 카테고리 작성

**중기:**
- HQ index.js 35K줄 → 모듈 분리
- 스킬 라이브러리 20+ 확대
- 커뮤니티 플라이휠 구축
