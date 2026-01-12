# Clinic CRM SaaS - Feature-Based Pricing Strategy

## Core Philosophy

**모듈식 기능 활성화**: 클라이언트가 필요한 기능만 선택하여 비용 최적화

---

## Feature Modules & Pricing Tiers

### Tier 0: Static Website (무료 or 최소)
**목적**: 온라인 존재감만 필요한 소규모 한의원

**포함 기능**:
- ✅ 프로그램 소개 페이지 (정적)
- ✅ 의료진 소개
- ✅ 블로그/칼럼 (읽기 전용)
- ✅ 기본 문의 폼 (이메일 전송)

**제외 기능**:
- ❌ 후기 시스템
- ❌ 자가진단
- ❌ 환자 CRM
- ❌ 예약 시스템

**가격**: 무료 or 5만원/월

---

### Tier 1: Marketing Enhanced (기본)
**목적**: 온라인 마케팅 강화 필요

**추가 기능** (Tier 0 +):
- ✅ **후기 시스템** ← 로그인 필요
  - 웹회원 가입 (카카오/구글 소셜 로그인)
  - 후기 작성/열람
- ✅ **자가진단 도구**
  - 체질진단, 프로그램 추천
  - 결과 저장 (회원 전용)
- ✅ **간단 리드 관리**
  - 문의 목록 조회
  - 상태 관리 (신규/진행중/완료)

**가격**: +10만원/월 (총 15만원/월)

---

### Tier 2: Full CRM (프리미엄)
**목적**: 환자 관리 자동화 필요

**추가 기능** (Tier 1 +):
- ✅ **환자 데이터베이스**
  - 안정적 환자 ID (이름+전화4)
  - 온/오프라인 통합 관리
  - 연락처 변경 이력
- ✅ **예약 시스템**
  - 캘린더 뷰
  - 온라인 예약 접수
  - SMS/이메일 자동 리마인더
- ✅ **커뮤니케이션 허브**
  - SMS 발송 (건당 과금)
  - 이메일 캠페인
  - 대화 이력 추적
- ✅ **결제 추적**
  - 수납 기록
  - 미수금 관리
  - 매출 리포트
- ✅ **후속 관리**
  - 태스크 관리
  - 자동 후속 알림

**가격**: +20만원/월 (총 35만원/월)

---

### Tier 3: Enterprise (대형 한의원)
**목적**: 다점포, 복잡한 운영

**추가 기능** (Tier 2 +):
- ✅ **다점포 관리**
  - 지점별 데이터 분리
  - 통합 대시보드
- ✅ **고급 분석**
  - 환자 이탈 예측
  - 프로그램별 ROI
  - 의료진별 성과
- ✅ **화이트라벨**
  - 자체 브랜드 소셜 로그인
  - 커스텀 도메인
  - 브랜딩 제거
- ✅ **API 접근**
  - 외부 차트 시스템 연동
  - 커스텀 통합

**가격**: 개별 협의 (50만원+/월)

---

## Add-on Modules (선택 기능)

### 1. 소셜 로그인 (카카오/구글)
- **필요 티어**: Tier 1+
- **가격**: +5만원/월
- **포함**: 카카오/구글 OAuth 설정 및 유지보수

### 2. SMS 발송
- **필요 티어**: Tier 2+
- **가격**: 기본료 2만원/월 + 건당 15원
- **포함**: 
  - 예약 리마인더
  - 후속 관리 메시지
  - 마케팅 캠페인

### 3. 자가진단 커스터마이징
- **필요 티어**: Tier 1+
- **가격**: 일회성 30만원
- **포함**: 한의원 특화 진단 문항 설계 및 구현

### 4. 프로그램 빌더 (고급)
- **필요 티어**: Any
- **가격**: +3만원/월
- **포함**: 
  - JSON 대신 폼 기반 편집
  - 이미지 업로드
  - 섹션 드래그앤드롭

### 5. 미디어 관리자
- **필요 티어**: Any
- **가격**: +2만원/월
- **포함**: 
  - 이미지 갤러리
  - 업로드/삭제
  - 미디어 라이브러리

---

## Feature Toggle System

### Database: `clinic_features`
```sql
CREATE TABLE clinic_features (
    clinic_id TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 0,
    expires_at INTEGER,
    
    PRIMARY KEY (clinic_id, feature_key)
);
```

### Feature Keys
```typescript
const FEATURES = {
  // Marketing
  'review_system': 'Tier 1+',
  'self_diagnosis': 'Tier 1+',
  'social_login': 'Add-on',
  
  // CRM
  'patient_crm': 'Tier 2+',
  'appointments': 'Tier 2+',
  'sms_campaigns': 'Tier 2+ & Add-on',
  'payment_tracking': 'Tier 2+',
  'task_management': 'Tier 2+',
  
  // Advanced
  'multi_location': 'Tier 3',
  'analytics_advanced': 'Tier 3',
  'white_label': 'Tier 3',
  'api_access': 'Tier 3',
  
  // Add-ons
  'program_builder_pro': 'Add-on',
  'media_manager': 'Add-on',
  'custom_diagnosis': 'Add-on (one-time)'
};
```

### Usage in Code
```typescript
// Check feature access
async function hasFeature(clinicId: string, featureKey: string): Promise<boolean> {
  const feature = await db.query(
    'SELECT enabled FROM clinic_features WHERE clinic_id = ? AND feature_key = ?',
    [clinicId, featureKey]
  );
  return feature?.enabled || false;
}

// In UI
if (await hasFeature(clinicId, 'review_system')) {
  // Show review features
}

// In routes
if (!(await hasFeature(clinicId, 'appointments'))) {
  return redirect('/upgrade');
}
```

---

## Pricing Table Summary

| Tier | 월 요금 | 핵심 기능 |
|------|---------|-----------|
| **Static** | 무료-5만원 | 정적 웹사이트, 문의폼 |
| **Marketing** | 15만원 | + 후기, 자가진단, 간단 리드 |
| **Full CRM** | 35만원 | + 환자관리, 예약, 결제, 후속 |
| **Enterprise** | 50만원+ | + 다점포, 고급분석, 화이트라벨 |

**Add-ons**:
- 소셜 로그인: +5만원/월
- SMS: +2만원/월 + 건당 15원
- 프로그램 빌더: +3만원/월
- 미디어 관리: +2만원/월
- 커스텀 진단: 30만원 (일회성)

---

## Development Cost Estimation

### Initial Setup (One-time)
- 기본 시스템: 300만원
- Tier 1 기능: +150만원
- Tier 2 기능: +400만원
- Tier 3 기능: +300만원

### Per-Feature Development
- 소셜 로그인: 50만원
- SMS 통합: 80만원
- 예약 시스템: 200만원
- CRM 기본: 250만원
- 분석 대시보드: 150만원

---

## Migration Path (클라이언트 업그레이드)

```
Static → Marketing: 클릭 한 번으로 활성화
Marketing → CRM: 환자 데이터 마이그레이션 포함
CRM → Enterprise: 맞춤 온보딩 세션
```

---

## Competitive Analysis

| 경쟁사 | 월 요금 | 우리 차별점 |
|--------|---------|-------------|
| 병의원 CRM A | 고정 50만원 | ✅ 모듈식 (15만원~) |
| 예약 시스템 B | 30만원 | ✅ 통합 CRM |
| Shopify (참고) | $29-$299 | ✅ 한의원 특화 |

---

## Next Steps

1. **Feature Toggle 인프라 구축**
   - `clinic_features` 테이블
   - Middleware for feature checking
   - Admin panel for feature management

2. **Tier별 기능 분리**
   - 각 기능에 `@requiresFeature('review_system')` 데코레이터
   - UI 조건부 렌더링

3. **Pricing 페이지 제작**
   - 비교표
   - 기능 체크리스트
   - 업그레이드 플로우

4. **Billing 시스템 연동**
   - 결제 (토스페이먼츠 or 나이스페이)
   - 구독 관리
   - 자동 갱신

---

이 모델로 **소규모는 저렴하게**, **대형은 충분히** 수익화할 수 있습니다!
