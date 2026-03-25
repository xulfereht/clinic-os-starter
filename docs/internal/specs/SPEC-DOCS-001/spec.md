# SPEC-DOCS-001: 커스터마이징 가이드 확장

> 로컬 클라이언트가 LLM을 사용하여 홈페이지 및 커스텀 페이지를 커스터마이징할 수 있도록 돕는 가이드 문서 확장
>
> **범위**: 홈페이지 커스터마이징, 커스텀 페이지 추가, 플러그인 유형 차이, 업데이트 보존 프로세스, 안전 지침

---

## TAG BLOCK

```yaml
SPEC_ID: SPEC-DOCS-001
TITLE: 커스터마이징 가이드 확장 (홈페이지 + 커스텀 페이지 + 업데이트 보존)
STATUS: Completed
PRIORITY: High
DOMAIN: Documentation
ASSIGNED: manager-ddd
CREATED: 2026-02-08
UPDATED: 2026-02-08
VERSION: 1.2.0
LIFECYCLE: spec-anchored
```

---

## 1. 환경 (Environment)

### 1.1 프로젝트 컨텍스트

Clinic-OS는 한의원/진료소를 위한 웹사이트 빌더 플랫폼입니다. 로컬 클라이언트들은 자신의 병원 웹사이트를 커스터마이징해야 하며, 이를 위해 `custom-homepage` 플러그인과 AI 어시스턴트(Claude, ChatGPT 등)를 사용합니다.

### 1.2 현재 문서 현황

| 문서 | 위치 | 상태 |
|------|------|------|
| `ONBOARDING.md` | `/docs/` | 엔드투엔드 온보딩 가이드 |
| `PLUGIN_DEVELOPMENT_GUIDE.md` | `/docs/` | 플러그인 개발 가이드 |
| `AI-QUICK-REFERENCE.md` | `/docs/` | AI 어시스턴트 퀵 레퍼런스 |
| `LOCAL_GIT_ARCHITECTURE.md` | `/docs/` | 로컬 Git 아키텍처 |
| `custom-homepage/README.md` | `/src/plugins/` | 커스텀 홈페이지 플러그인 문서 |

### 1.3 기술 스택

- **프레임워크**: Astro 5.x + TypeScript
- **컴포넌트 시스템**: SectionRenderer (30+ 섹션 타입 지원)
- **스타일링**: Tailwind CSS 4.x
- **플러그인 타입**: `override` (priority=10)
- **다국어 지원**: ko, en, ja, zh, vi

### 1.4 타겟 사용자

- **1차 타겟**: 비기술적 배경을 가진 로컬 클라이언트 (병원 운영자, 관리자)
- **2차 타겟**: AI 어시스턴트 (Claude, ChatGPT, Gemini 등)
- **3차 타겟**: 프리랜서 개발자 (커스터마이징 지원)

---

## 2. 가정 (Assumptions)

### 2.1 사용자 가정

- [A1] 사용자는 HTML/CSS/JavaScript에 대한 깊은 지식이 없을 수 있습니다
- [A2] 사용자는 AI 어시스턴트에 자연어로 요청하여 코드를 수정하는 방식을 선호합니다
- [A3] 사용자는 LLM 도구 (Claude Code, GitHub Copilot, ChatGPT) 중 하나를 사용하고 있습니다
- [A4] 사용자는 코어 코드를 수정하지 않고 플러그인만 수정하여 커스터마이징하기를 원합니다

### 2.2 기술적 가정

- [A5] SectionRenderer는 30개 이상의 섹션 타입을 지원하지만, 일부 섹션의 Props가 문서화되어 있지 않습니다
- [A6] 각 섹션 컴포넌트는 `data`, `id`, `programId`, `settings` Props를 받습니다
- [A7] `tr` (translation) 객체와 `T()` 헬퍼 함수를 통해 다국어 텍스트를 관리합니다
- [A8] 플러그인은 코어 업데이트와 독립적으로 유지됩니다

### 2.3 검증 필요 가정

- [A9] 사용자는 섹션 타입별로 어떤 Props가 필요한지 알 필요가 있습니다
- [A10] 사용자는 자연어 프롬프트 예시를 통해 LLM과 상호작용하는 방법을 배워야 합니다
- [A11] 사용자는 변경 사항을 테스트하고 검증하는 체크리스트가 필요합니다

---

## 3. 요구사항 (Requirements) - EARS 형식

### 3.1 핵심 요구사항

#### REQ-DOCS-001: 전용 커스터마이징 가이드 생성
**[Ubiquitous]** 시스템은 로컬 클라이언트가 LLM을 사용하여 홈페이지 및 추가 페이지를 커스터마이징할 수 있는 전용 가이드 문서를 제공해야 한다.

- **위치**: `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` (또는 통합 문서)
- **형식**: Markdown, 이중 언어 (한국어/English)
- **대상**: 비기술적 사용자, AI 어시스턴트
- **범위**: 빠른 참조, 섹션 API, 프롬프트 예시, 테스트, 문제해결, 플러그인 유형

#### REQ-DOCS-002: SectionRenderer API 문서화
**[Ubiquitous]** 시스템은 SectionRenderer가 지원하는 모든 섹션 타입의 API를 문서화해야 한다.

- **섹션 타입**: 30개 이상 (MainHero, BridgeSection, NarrativeFlow, ServiceTiles, Philosophy, HomeInfo 등)
- **문서화 항목**: Props, 예시 코드, 렌더링 결과
- **조직**: 카테고리별 그룹화 (Hero, Content, Media, Info 등)

#### REQ-DOCS-003: 자연어 프롬프트 예시 제공
**[Event-Driven]** WHEN 사용자가 AI 어시스턴트에게 커스터마이징을 요청할 때, 시스템은 자연어 프롬프트 예시를 제공해야 한다.

- **예시 수량**: 최소 10개 이상의 실용적 프롬프트
- **카테고리**: 텍스트 변경, 섹션 추가/삭제, 레이아웃 변경, 이미지 교체, 다국어 추가
- **형식**: 프롬프트 → 예상 결과 → 코드 예시

#### REQ-DOCS-004: 테스트 및 검증 체크리스트 제공
**[Event-Driven]** WHEN 사용자가 커스터마이징 변경 후 사이트를 미리 볼 때, 시스템은 테스트 체크리스트를 제공해야 한다.

- **항목**: 로컬 개발 서버 실행, 렌더링 확인, 반응형 테스트, 링크 검증, 다국어 확인
- **자동화 가능**: 일부 항목은 LLM이 자동으로 검증
- **문제 해결**: 공통 이슈별 해결 방법 포함

#### REQ-DOCS-005: 문제 해결 가이드 제공
**[State-Driven]** IF 사용자가 커스터마이징 중 문제에 직면하면, 시스템은 문제 해결 가이드를 제공해야 한다.

- **문제 범주**: 섹션 렌더링 오류, Props 누락, 다국어 텍스트 누락, 이미지 로딩 실패, 스타일 깨짐
- **해결 패턴**: 증상 → 원인 → 해결 방법 → 예방 팁
- **LLM 활용**: AI가 자동으로 진단하고 해결 방법 제시

#### REQ-DOCS-006: 커스텀 페이지 추가 가이드 제공
**[Event-Driven]** WHEN 사용자가 홈페이지 외에 추가 페이지를 생성하려 할 때, 시스템은 new-route 플러그인 생성 방법을 문서화해야 한다.

- **플러그인 타입**: `type="new-route"`
- **URL 경로**: `/ext/{plugin-id}` 형식으로 자동 생성
- **문서화 항목**: 플러그in 생성 절차, 파일 구조, 라우팅 설정, 페이지 컴포넌트 작성 방법
- **예시 시나리오**: 진료소 소개 페이지, 의사 프로필 페이지, 상담 예약 페이지

#### REQ-DOCS-007: 플러그인 유형별 차이점 문서화
**[Ubiquitous]** 시스템은 두 가지 플러그인 유형(new-route vs override)의 차이점과 사용 사례를 문서화해야 한다.

- **비교 항목**: 목적, URL 경로, 우선순위(priority), 충돌 처리 방식, 사용 사례
- **new-route**: 새로운 경로 추가, `/ext/{plugin-id}`, priority=5, 독립 페이지
- **override**: 기존 페이지 교체, 원본 경로 유지, priority=10, 기존 페이지 대체
- **선택 가이드**: 어떤 유형을 선택해야 하는지 결정 트리 제공

#### REQ-DOCS-008: 업데이트 보존 프로세스 문서화
**[State-Driven]** IF 사용자가 `core:pull` 업데이트를 실행할 때, 시스템은 어떤 파일이 보존되는지 문서화해야 한다.

- **보호된 위치**: `src/plugins/local/`, `src/survey-tools/local/`, `src/lib/local/`, `public/local/`
- **필터 레벨 설명**: LOCAL_PREFIXES, PROTECTED_EXACT, LOCAL_PATH_PARTS, CORE_REPLACEMENTS
- **보존 규칙**: local 접두사 파일은 절대 수정되지 않음, PROTECTED_EXACT 파일은 백업 후 복원
- **업데이트 후 확인**: 커스터마이징이 유지되었는지 검증하는 체크리스트 제공

#### REQ-DOCS-009: 안전 지침 테이블 제공
**[Ubiquitous]** 시스템은 커스터마이징 시 안전 지침을 테이블 형식으로 제공해야 한다.

- **안전 카테고리**: 파일 위치 수정, 코드 패턴, 업데이트 영향, 롤백 방법
- **안전한 작업**: local 디렉토리 내 파일 수정, 섹션 데이터 변경, 다국어 텍스트 추가
- **위험한 작업**: 코어 파일 직접 수정, node_modules 수정, 빌드 결과물 수정
- **권장 패턴**: 플러그인 사용, SectionRenderer 선언적 구성, 기존 섹션 재사용

### 3.2 선택적 요구사항

#### REQ-DOCS-OPT-001: 비디오 튜토리얼 링크
**[Optional]** WHERE 가능하면, 시스템은 홈페이지 커스터마이징 비디오 튜토리얼 링크를 제공해야 한다.

#### REQ-DOCS-OPT-002: 인터랙티브 프리뷰 도구
**[Optional]** WHERE 가능하면, 시스템은 섹션 변경을 미리 볼 수 있는 인터랙티브 프리뷰 도구를 제공해야 한다.

### 3.3 바람직하지 않은 요구사항

#### REQ-DOCS-NEG-001: 코어 코드 수정 방법 문서화 금지
**[Unwanted]** 시스템은 코어 코드를 수정하는 방법을 문서화해서는 안 된다.

- **이유**: 코어 업데이트 시 충돌 방지
- **대안**: 모든 커스터마이징은 플러그인 내에서 수행

#### REQ-DOCS-NEG-002: 복잡한 JavaScript 로직 추가 금지
**[Unwanted]** 시스템은 복잡한 JavaScript 로직을 추가하는 방법을 문서화해서는 안 된다.

- **이유**: 비기술적 사용자의 복잡도 증가 방지
- **대안**: SectionRenderer의 선언적 섹션 구성 사용

---

## 4. 명세 (Specifications)

### 4.1 문서 구조

#### 4.1.1 HOMEPAGE_CUSTOMIZATION_GUIDE.md 구조

```markdown
# 홈페이지 커스터마이징 가이드
# Homepage Customization Guide

## 1. 빠른 시작 (Quick Start)
## 2. 섹션 레퍼런스 (Section Reference)
## 3. 자연어 프롬프트 예시 (Natural Language Prompts)
## 4. 테스트 및 검증 (Testing & Validation)
## 5. 문제 해결 (Troubleshooting)
## 6. 고급 커스터마이징 (Advanced)
```

### 4.2 섹션 API 문서화 형식

각 섹션 타입별로 다음 항목을 포함:

```markdown
### 섹션 이름 (Section Name)

**타입 ID**: `SectionTypeName`

**용도**: 섹션의 목적과 사용 시나리오

**필수 Props**:
| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| data | object | 섹션 데이터 | - |

**선택적 Props**:
| Prop | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| programId | string | 프로그램 ID | undefined |
| settings | object | 클리닉 설정 | {} |

**사용 예시**:
\`\`\`javascript
{
    type: "SectionTypeName",
    // props...
}
\`\`\`

**주의사항**:
- 섹션 사용 시 주의할 점
```

### 4.3 자연어 프롬프트 예시 카테고리

| 카테고리 | 예시 수량 | 예시 |
|----------|-----------|------|
| 텍스트 변경 | 3개 | "히어로 제목을 '환영합니다'로 변경" |
| 섹션 추가/삭제 | 2개 | "ServiceTiles 섹션 삭제" |
| 레이아웃 변경 | 2개 | "섹션 순서 변경: HomeInfo를 Philosophy 위로" |
| 이미지 교체 | 2개 | "히어로 이미지를 병원 사진으로 변경" |
| 다국어 추가 | 1개 | "베트남어 번역 추가" |

### 4.4 테스트 체크리스트

```markdown
## 사전 테스트 체크리스트

### 필수 항목
- [ ] 로컬 개발 서버 실행 (`npm run dev`)
- [ ] 브라우저에서 http://localhost:4321 접속
- [ ] 모든 섹션이 렌더링되는지 확인
- [ ] 콘솔에 에러가 없는지 확인

### 반응형 테스트
- [ ] 모바일 (375px)
- [ ] 태블릿 (768px)
- [ ] 데스크톱 (1024px+)

### 기능 테스트
- [ ] 링크가 정상 작동하는지 확인
- [ ] 다국어 전환이 작동하는지 확인
- [ ] 이미지가 로딩되는지 확인
```

### 4.5 문제 해결 가이드 형식

```markdown
## 문제 해결

### 섹션이 렌더링되지 않음
**증상**: 섹션이 화면에 보이지 않음

**원인**:
- 섹션 타입 오타
- 필수 Props 누락
- 섹션 컴포넌트 임포트 실패

**해결 방법**:
1. 섹션 타입 이름 확인 (대소문자 구분)
2. 필수 Props 확인
3. 브라우저 콘솔에서 에러 메시지 확인

**LLL 프롬프트**: "왜 섹션이 렌더링되지 않나요?"
```

---

## 5. 추적성 (Traceability)

### 5.1 요구사항-컴포넌트 매핑

| 요구사항 | 파일 | 컴포넌트/섹션 |
|----------|------|---------------|
| REQ-DOCS-001 | `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` 또는 통합 문서 | 전체 문서 |
| REQ-DOCS-002 | `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` | 섹션 2: 섹션 레퍼런스 |
| REQ-DOCS-003 | `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` | 섹션 3: 자연어 프롬프트 예시 |
| REQ-DOCS-004 | `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` | 섹션 4: 테스트 및 검증 |
| REQ-DOCS-005 | `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` | 섹션 5: 문제 해결 |
| REQ-DOCS-006 | `/docs/CUSTOM_PAGE_ADDITION_GUIDE.md` 또는 통합 | 커스텀 페이지 추가 섹션 |
| REQ-DOCS-007 | `/docs/PLUGIN_TYPE_COMPARISON.md` 또는 통합 | 플러그인 유형 비교 |
| REQ-DOCS-008 | `/docs/UPDATE_PRESERVATION_GUIDE.md` 또는 통합 | 업데이트 보존 프로세스 |
| REQ-DOCS-009 | 통합 가이드 또는 각 섹션 | 안전 지침 테이블 |

### 5.2 관련 SPEC

- **없음** (최초 문서화 SPEC)

### 5.3 종속성

| 문서 | 종속성 |
|------|--------|
| `HOMEPAGE_CUSTOMIZATION_GUIDE.md` 또는 통합 문서 | `AI-QUICK-REFERENCE.md`, `PLUGIN_DEVELOPMENT_GUIDE.md` |
| `CUSTOM_PAGE_ADDITION_GUIDE.md` (선택적 또는 통합) | `PLUGIN_DEVELOPMENT_GUIDE.md`, `HOMEPAGE_CUSTOMIZATION_GUIDE.md` |
| `custom-homepage/README.md` | `HOMEPAGE_CUSTOMIZATION_GUIDE.md` |
| `AI-QUICK-REFERENCE.md` | `HOMEPAGE_CUSTOMIZATION_GUIDE.md`, `UPDATE_PRESERVATION_GUIDE.md` |
| `LOCAL_GIT_ARCHITECTURE.md` | `UPDATE_PRESERVATION_GUIDE.md` |

---

## 6. 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0.0 | 2026-02-08 | 최초 작성 | manager-spec |
| 1.2.0 | 2026-02-08 | 구현 완료 - CUSTOMIZATION_GUIDE.md 생성 | manager-ddd |

---

**문서 버전**: 1.2.0
**마지막 업데이트**: 2026-02-08
**상태**: Completed
