# 백록담한의원 웹사이트 아키텍처

## 기술 스택

| 분류 | 기술 |
|------|------|
| **프레임워크** | Astro 5.x (SSR) |
| **배포** | Cloudflare Pages + Workers |
| **데이터베이스** | Cloudflare D1 (SQLite) |
| **파일 스토리지** | Cloudflare R2 |
| **세션** | Cloudflare KV |
| **스타일링** | Tailwind CSS 4.0 |
| **언어** | TypeScript |

---

## 디렉토리 구조

```
src/
├── components/           # 재사용 가능한 컴포넌트
│   ├── admin/           # 관리자 페이지 컴포넌트
│   │   └── common/      # 공용 UI (PageContainer, SectionCard, ToastContainer)
│   ├── sections/        # 프로그램 페이지 섹션 컴포넌트 (HeroSection, FAQSection 등)
│   └── ui/              # 기본 UI 컴포넌트
├── layouts/
│   ├── AdminLayout.astro  # 관리자 레이아웃 (사이드바, 네비게이션, 토스트 시스템)
│   └── BaseLayout.astro   # 공개 페이지 레이아웃
├── lib/
│   ├── clinic.ts          # 클리닉 설정 유틸리티
│   ├── design-system/     # 테마/스킨 시스템
│   └── db.ts              # 데이터베이스 유틸리티
├── pages/
│   ├── admin/             # 관리자 페이지 (52개 파일)
│   │   ├── index.astro    # 대시보드
│   │   ├── patients/      # 환자 관리
│   │   ├── leads/         # 고객 문의
│   │   ├── messages/      # 내부 메신저
│   │   ├── documents/     # 사내 문서함
│   │   ├── settings/      # 설정
│   │   └── ...
│   ├── api/               # API 엔드포인트 (134개 파일)
│   │   ├── admin/         # 관리자 API
│   │   ├── auth/          # 인증 (로그인/로그아웃)
│   │   ├── upload.ts      # R2 파일 업로드
│   │   ├── files/         # R2 파일 프록시 (서명된 URL)
│   │   └── ...
│   ├── programs/          # 프로그램 상세 페이지
│   ├── surveys/           # 설문조사/자가진단
│   └── ...
├── scripts/               # 디버그/마이그레이션 스크립트 (비 API)
└── styles/
    └── global.css         # 글로벌 스타일
```

---

## 핵심 기능

### 1. 환자 관리 (CRM/EMR)
- **경로**: `/admin/patients/[id]`
- **기능**: 환자 정보, 상담 내역, 결제, 배송, 설문, 이미지 관리
- **레이아웃**: Flexbox 2단 (고정 사이드바 + 탭 컨텐츠)

### 2. 내부 메신저
- **경로**: `/admin/messages`
- **기능**: 직원 간 채팅, 파일 첨부, 읽음 확인

### 3. 사내 문서함 (Company Drive)
- **경로**: `/admin/documents`
- **저장소**: Cloudflare R2 (`documents/` prefix)
- **기능**: 파일 업로드/다운로드, 메신저에서 문서함 저장

### 4. 파일 스토리지
- **업로드 API**: `/api/upload`
- **프록시 API**: `/api/files/[...key]` (서명된 URL 검증)
- **구조**:
  - `messenger/` - 임시 파일 (30일 자동 삭제)
  - `patients/` - 환자 이미지 (영구)
  - `documents/` - 사내 문서 (영구)
  - `generated/` - AI 생성 이미지

### 5. 알림 시스템
- **컴포넌트**: `ToastContainer.astro`
- **함수**: `showToast(message, type)`, `showConfirm(message, options)`
- **위치**: 화면 우하단, 자동 사라짐 (5초)

---

## 데이터베이스 스키마 (주요 테이블)

| 테이블 | 설명 |
|--------|------|
| `patients` | 환자 정보 |
| `patient_events` | 환자 활동 타임라인 |
| `patient_images` | 환자 이미지 (R2 URL 참조) |
| `leads` | 고객 문의 |
| `staff` | 직원 정보 |
| `admin_channels` | 메신저 채널 |
| `admin_messages` | 메신저 메시지 |
| `documents` | 사내 문서 메타데이터 |
| `settings` | 사이트 설정 |
| `programs` | 진료 프로그램 |
| `surveys` | 설문조사 정의 |
| `survey_assignments` | 환자별 설문 할당 |

---

## 관리자 UI 컴포넌트

| 컴포넌트 | 경로 | 용도 |
|----------|------|------|
| `PageContainer` | `components/admin/common/` | 페이지 전체 래퍼 |
| `PageHeader` | `components/admin/common/` | 페이지 타이틀/액션 헤더 |
| `SectionCard` | `components/admin/common/` | 컨텐츠 카드 (`noPadding` prop 지원) |
| `ToastContainer` | `components/admin/common/` | 전역 알림 시스템 |
| `ChatWidget` | `components/admin/` | 내부 메신저 위젯 |

---

## 배포
```bash
# 프로덕션 배포
./deploy-production.sh

# 로컬 개발
npm run dev
```

**Production URL**: https://brd-clinic.pages.dev

---

## 환경 변수 (`.dev.vars`)
```
ADMIN_PASSWORD=xxxxx
```

## Wrangler 설정 (`wrangler.toml`)
```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "brd-clinic-files"
preview_bucket_name = "brd-clinic-files"

[[kv_namespaces]]
binding = "SESSION"
id = "..."
```
