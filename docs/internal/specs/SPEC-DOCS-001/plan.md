# SPEC-DOCS-001: 구현 계획

> 커스터마이징 가이드 확장을 위한 구현 계획
>
> **범위**: 홈페이지 커스터마이징, 커스텀 페이지 추가, 플러그인 유형 비교, 업데이트 보존 프로세스, 안전 지침

---

## 1. 개요 (Overview)

### 1.1 목표

로컬 클라이언트가 LLM을 사용하여 홈페이지 및 커스텀 페이지를 커스터마이징할 수 있도록 돕는 포괄적인 가이드 문서를 생성합니다. 이 문서는 비기술적 사용자와 AI 어시스턴트 모두를 대상으로 합니다.

### 1.2 확장 범위

이 SPEC은 다음과 같은 확장 범위를 포함합니다:

1. **커스텀 페이지 추가**: new-route 플러그인을 사용한 추가 페이지 생성
2. **플러그인 유형 차이**: new-route vs override 비교 및 선택 가이드
3. **업데이트 보존 프로세스**: core:pull 후 보존되는 파일과 필터링 시스템
4. **안전 지침**: 안전/위험 작업 구분 및 롤백 방법

### 1.3 우선순위 기반 마일스톤

**1차 목표 (Priority High)**:
- HOMEPAGE_CUSTOMIZATION_GUIDE.md (또는 통합 문서) 생성
- SectionRenderer API 문서화
- 자연어 프롬프트 예시 10개 이상 제공
- 플러그인 유형 비교 문서 (REQ-DOCS-007)

**2차 목표 (Priority Medium)**:
- 테스트 및 검증 체크리스트 제공
- 문제 해결 가이드 작성
- 커스텀 페이지 추가 가이드 (REQ-DOCS-006)
- 업데이트 보존 프로세스 문서화 (REQ-DOCS-008)

**3차 목표 (Priority Low)**:
- 안전 지침 테이블 정교화 (REQ-DOCS-009)
- 비디오 튜토리얼 링크 (선택사항)
- 인터랙티브 프리뷰 도구 (선택사항)

---

## 2. 기술적 접근 (Technical Approach)

### 2.1 문서 아키텍처

```
docs/
├── HOMEPAGE_CUSTOMIZATION_GUIDE.md (신규 또는 통합 문서)
│   # 또는 확장된 단일 문서
│   ├── 홈페이지 커스터마이징
│   ├── 커스텀 페이지 추가 (REQ-DOCS-006)
│   ├── 플러그인 유형 비교 (REQ-DOCS-007)
│   └── 업데이트 보존 안내 (REQ-DOCS-008)
│
├── AI-QUICK-REFERENCE.md (업데이트: 확장된 가이드 링크)
├── ONBOARDING.md (업데이트: 커스터마이징 섹션 확장)
└── LOCAL_GIT_ARCHITECTURE.md (업데이트: 업데이트 보존 링크)

src/plugins/custom-homepage/
└── README.md (업데이트: 확장된 가이드 링크)
```

### 2.2 섹션 카테고리화

30개 이상의 섹션 타입을 카테고리별로 그룹화:

| 카테고리 | 섹션 타입 |
|----------|-----------|
| **Hero** | HeroSection, MainHeroSection, TelemedicineHeroSection, PageIntroSection |
| **Bridge** | HeroBridgeSection |
| **Narrative** | NarrativeFlowSection |
| **Content** | ProblemSection, SolutionSection, MechanismSection, ProcessSection, FeatureHighlightSection, SolutionTypesSection, PhilosophySection |
| **Listing** | ServiceTilesSection, ProgramListSection, DoctorListSection, DiagnosisListSection, TreatableConditionsSection |
| **Media** | GallerySection, YouTubeSection |
| **Info** | HomeInfoSection, FAQSection, PricingSection, LocationMapSection, TransportInfoSection, BusinessHoursSection |
| **Related** | RelatedDiagnosisSection, RelatedReviewsSection, RelatedPostsSection |
| **Guide** | StepGuideSection, AdaptationPeriodSection, SideEffectsGridSection, RulesChecklistSection |
| **CTA** | InquiryCTASection |
| **Doctor** | DoctorIntroSection |
| **Utility** | RawHtmlSection |

### 2.3 문서 형식 표준

**Markdown 형식**:
- GitHub Flavored Markdown (GFM) 사용
- 코드 블록에 syntax highlighting 적용
- 테이블 형식으로 Props 정리

**이중 언어 지원**:
- 주요 섹션은 한국어와 English 병행
- 코드 예시는 영문 주석 포함

**LLM 친화적 포맷**:
- 명확한 섹션 구조
- 코드 예시와 프롬프트 분리
- 테이블 형식의 참조 데이터

---

## 3. 구현 단계 (Implementation Steps)

### 3.1 1단계: 문서 구조 생성

**작업 항목**:
1. `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` 파일 생성
2. 문서 개요 작성 (6개 주요 섹션)
3. 빠른 시작 섹션 작성

**완료 기준**:
- [x] 파일 생성 완료
- [x] 문서 개요 작성 완료
- [x] 빠른 시작 섹션 작성 완료

### 3.2 2단계: SectionRenderer API 문서화

**작업 항목**:
1. 각 섹션 컴포넌트 분석 (`src/components/sections/*.astro`)
2. Props 추출 및 문서화
3. 카테고리별 그룹화
4. 사용 예시 작성

**섹션 분석 방법**:
```bash
# 각 섹션 컴포넌트의 interface Props 분석
grep -A 10 "interface Props" src/components/sections/*.astro
```

**완료 기준**:
- [x] 30개 이상의 섹션 타입 문서화
- [x] 각 섹션의 Props 명세
- [x] 최소 1개 이상의 사용 예시

### 3.3 3단계: 자연어 프롬프트 예시 작성

**작업 항목**:
1. 5개 카테고리별 프롬프트 작성
2. 각 프롬프트에 대해 예상 결과와 코드 예시 제공
3. LLM 응답 최적화 팁 추가

**프롬프트 카테고리**:
1. **텍스트 변경** (3개 예시)
   - 히어로 제목 변경
   - 섹션 설명 수정
   - CTA 버튼 텍스트 변경

2. **섹션 추가/삭제** (2개 예시)
   - ServiceTiles 섹션 삭제
   - 새로운 FAQSection 추가

3. **레이아웃 변경** (2개 예시)
   - 섹션 순서 변경
   - 섹션 간격 조정

4. **이미지 교체** (2개 예시)
   - 히어로 이미지 변경
   - 갤러리 이미지 추가

5. **다국어 추가** (1개 예시)
   - 새로운 언어 번역 추가

**완료 기준**:
- [x] 최소 10개의 프롬프트 예시
- [x] 각 프롬프트에 예상 결과 설명
- [x] 코드 예시 포함

### 3.4 4단계: 테스트 및 검증 체크리스트 작성

**작업 항목**:
1. 사전 테스트 체크리스트 작성
2. 반응형 테스트 가이드 작성
3. 기능 테스트 항목 정의
4. LLM 자동 검증 프롬프트 작성

**체크리스트 항목**:
- 필수 항목 (5개)
- 반응형 테스트 (3개)
- 기능 테스트 (3개)
- LLM 자동 검증 (3개)

**완료 기준**:
- [x] 14개 이상의 테스트 항목
- [x] 각 항목별 실행 방법 설명

### 3.5 5단계: 문제 해결 가이드 작성

**작업 항목**:
1. 공통 문제 10개 식별
2. 각 문제별 증상-원인-해결방법 작성
3. LLM 진단 프롬프트 작성

**문제 카테고리**:
1. 섹션 렌더링 오류
2. Props 누락
3. 다국어 텍스트 누락
4. 이미지 로딩 실패
5. 스타일 깨짐
6. 링크 작동 불가
7. 반응형 레이아웃 문제
8. 섹션 순서 문제
9. 번역 적용 안됨
10. 로컬 개발 서버 문제

**완료 기준**:
- [x] 10개 이상의 문제 시나리오
- [x] 각 문제별 해결 방법
- [x] LLM 진단 프롬프트

### 3.6 6단계: 커스텀 페이지 추가 가이드 작성 (REQ-DOCS-006)

**작업 항목**:
1. new-route 플러그인 생성 절차 문서화
2. 파일 구조 및 라우팅 설정 설명
3. 페이지 컴포넌트 작성 방법 제공
4. 실제 예시 시나리오 작성

**new-route 플러그인 구조**:
```bash
src/plugins/
└── {plugin-id}/                    # 플러그인 디렉토리
    ├── plugin.config.ts            # 플러그인 설정 (type="new-route")
    └── pages/
        └── {page-name}.astro       # 페이지 컴포넌트
```

**라우팅 설정 예시**:
```typescript
// plugin.config.ts
export default {
  id: '{plugin-id}',
  type: 'new-route',                 // 새로운 경로 추가
  priority: 5,                       // 기본 우선순위
  routes: [
    { path: '/ext/{plugin-id}/{page-name}', component: './pages/{page-name}.astro' }
  ]
}
```

**완료 기준**:
- [x] new-route 플러그인 생성 절차 문서화
- [x] URL 경로 구조 설명 (`/ext/{plugin-id}`)
- [x] 최소 2개의 실제 예시 시나리오
- [x] 페이지 컴포넌트 작성 가이드

### 3.7 7단계: 플러그인 유형 비교 문서 작성 (REQ-DOCS-007)

**작업 항목**:
1. new-route vs override 비교 테이블 작성
2. 각 유형별 사용 사례 정의
3. 선택 결정 트리 작성
4. 충돌 처리 방식 설명

**비교 테이블**:
| 항목 | new-route | override |
|------|-----------|----------|
| 목적 | 새로운 페이지 추가 | 기존 페이지 교체 |
| URL 경로 | `/ext/{plugin-id}` | 원본 경로 유지 |
| Priority | 5 (기본) | 10 (높음) |
| 충돌 처리 | 독립 경로로 충돌 없음 | 기존 페이지 대체 |
| 사용 사례 | 진료소 소개, 의사 프로필 | 홈페이지 완전히 변경 |

**선택 결정 트리**:
```
1. 새로운 페이지를 추가하나요?
   - YES → new-route 사용
   - NO → 2번으로

2. 기존 페이지를 완전히 교체하나요?
   - YES → override 사용
   - NO → new-route로 새 페이지 만들기
```

**완료 기준**:
- [x] 비교 테이블 작성 완료
- [x] 사용 사례별 예시 제공
- [x] 선택 결정 트리 포함
- [x] 충돌 처리 방식 설명

### 3.8 8단계: 업데이트 보존 프로세스 문서화 (REQ-DOCS-008)

**작업 항목**:
1. 보호된 위치 문서화
2. 4레벨 필터 시스템 설명
3. 업데이트 후 확인 체크리스트 작성
4. 보존 규칙 명시

**보호된 위치**:
```bash
# 다음 위치의 파일은 core:pull 시 절대 수정되지 않음
src/plugins/local/        # 로컬 클라이언트 플러그인
src/survey-tools/local/   # 로컬 설문 도구
src/lib/local/           # 로컬 유틸리티
public/local/            # 로컬 에셋
```

**필터 레벨 설명**:
1. **LOCAL_PREFIXES**: `local/` 접두사 파일은 항상 보존
2. **PROTECTED_EXACT**: 정확히 일치하는 파일은 백업 후 복원
3. **LOCAL_PATH_PARTS**: 경로에 `local`이 포함된 파일 보존
4. **CORE_REPLACEMENTS**: 코어 파일만 교체

**업데이트 후 확인 체크리스트**:
- [ ] `src/plugins/local/` 내 파일 확인
- [ ] 커스텀 홈페이지 정상 작동 확인
- [ ] 커스텀 페이지 접근 가능 확인
- [ ] 다국어 설정 유지 확인

**완료 기준**:
- [x] 보호된 위치 명시
- [x] 필터 레벨 설명
- [x] 업데이트 후 확인 체크리스트
- [x] 보존 규칙 문서화

### 3.9 9단계: 안전 지침 테이블 작성 (REQ-DOCS-009)

**작업 항목**:
1. 안전한 작업 목록 작성
2. 위험한 작업 목록 작성
3. 각 작업별 영향 및 롤백 방법 제공
4. 권장 패턴 정의

**안전 지침 테이블**:
| 작업 유형 | 위치 | 안전성 | 업데이트 영향 | 롤백 방법 |
|----------|------|--------|---------------|-----------|
| 섹션 데이터 수정 | `local/` 플러그인 | 안전 | 보존됨 | Git revert |
| 새 페이지 추가 | `local/` 플러그인 | 안전 | 보존됨 | 플러그인 삭제 |
| 다국어 추가 | `tr` 객체 | 안전 | 보존됨 | 번역 삭제 |
| 코어 파일 수정 | `src/` 코어 | 위험 | 덮어씌워짐 | 재설치 필요 |
| 빌드 결과 수정 | `dist/` | 위험 | 삭제됨 | 재빌드 필요 |

**권장 패턴**:
1. 항상 `local/` 디렉토리 내에서 작업
2. SectionRenderer의 선언적 구성 사용
3. 기존 섹션을 재사용하여 새 페이지 구성
4. Git을 사용한 변경 사항 추적

**완료 기준**:
- [x] 안전 지침 테이블 작성
- [x] 안전/위험 작업 구분
- [x] 롤백 방법 제공
- [x] 권장 패턴 정의

### 3.10 10단계: 기존 문서 업데이트

**작업 항목**:
1. `AI-QUICK-REFERENCE.md`에 확장된 가이드 링크 추가
2. `custom-homepage/README.md`에 상세 가이드 링크 추가
3. `ONBOARDING.md`에 커스터마이징 섹션 확장
4. `LOCAL_GIT_ARCHITECTURE.md`와 업데이트 보존 가이드 연계

**완료 기준**:
- [x] 모든 관련 문서에 확장된 가이드 링크 추가
- [x] 문서 간 참조 일관성 유지
- [x] 새로운 요구사항 반영

---

## 4. 위험 및 완화 계획 (Risks & Mitigation)

### 4.1 식별된 위험

| 위험 | 영향 | 확률 | 완화 계획 |
|------|------|------|-----------|
| 섹션 Props 문서화 누락 | 높음 | 중간 | 자동화 스크립트로 Props 추출 |
| 프롬프트 예시의 부족 | 중간 | 낮음 | 사용자 피드백으로 지속적 개선 |
| 문서 일관성 문제 | 중간 | 중간 | 템플릿 기반 문서화 |
| 다국어 지원 누락 | 낮음 | 낮음 | 이중 언어 표준 준수 |

### 4.2 완화 전략

**Props 추출 자동화**:
```bash
# 섹션별 Props 추출 스크립트
for file in src/components/sections/*.astro; do
    echo "=== $file ==="
    grep -A 20 "interface Props" "$file"
done
```

**문서 템플릿**:
- 각 섹션 문서에 표준 템플릿 적용
- 일관된 형식으로 Props, 예시, 주의사항 문서화

**지속적 개선**:
- 사용자 피드백 수집 메커니즘
- 정기적인 문서 업데이트

---

## 5. 리소스 및 의존성 (Resources & Dependencies)

### 5.1 필요한 리소스

- **개발 시간**: 4-6시간 (문서 작성 및 검토)
- **검토 시간**: 1-2시간 (QA 및 피드백)
- **총 예상 시간**: 5-8시간

### 5.2 의존 파일

| 파일 | 용도 |
|------|------|
| `src/components/common/SectionRenderer.astro` | 섹션 타입 목록 |
| `src/components/sections/*.astro` | 각 섹션의 Props 정의 |
| `src/plugins/custom-homepage/pages/index.astro` | 사용 예시 |
| `docs/AI-QUICK-REFERENCE.md` | 기존 문서 참조 |
| `src/plugins/custom-homepage/README.md` | 기존 플러그인 문서 |

---

## 6. 품질 기준 (Quality Standards)

### 6.1 문서 품질

**TRUST 5 준수**:
- **Tested**: 모든 코드 예시는 실행 가능해야 함
- **Readable**: 명확한 언어와 일관된 형식
- **Unified**: 기존 문서와 일관된 스타일
- **Secured**: 보안 관련 주의사항 포함
- **Trackable**: 변경 이력과 버전 관리

### 6.2 LLM 친화성

**구조화된 데이터**:
- 테이블 형식의 참조 데이터
- 명확한 코드 블록 구분
- 일관된 섹션 구조

**프롬프트 엔지니어링**:
- 명확한 명령어
- 구체적인 예시
- 예상 결과 명시

---

## 7. 다음 단계 (Next Steps)

### 7.1 즉시 실행

1. `/docs/HOMEPAGE_CUSTOMIZATION_GUIDE.md` 파일 생성
2. 빠른 시작 섹션 작성 시작
3. SectionRenderer 섹션 타입 분석

### 7.2 향후 계획

1. **Phase 1**: 문서 작성 (1-2일)
2. **Phase 2**: 내부 검토 (1일)
3. **Phase 3**: 사용자 테스트 및 피드백 (1주)
4. **Phase 4**: 최종 수정 및 배포 (1일)

---

**계획 버전**: 1.1.0
**마지막 업데이트**: 2026-02-08
**상태**: Planned
