# SPEC-MIGRATION-001: brd-clinic → clinic-os 기반 마이그레이션

---
id: SPEC-MIGRATION-001
version: "1.0.0"
status: draft
created: "2025-01-23"
updated: "2025-01-23"
author: "Claude"
priority: HIGH
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2025-01-23 | Claude | 초안 작성 |

---

## 1. 개요

### 1.1 배경

- **brd-clinic**: 단일 클라이언트(본래한의원) 기준으로 먼저 개발된 프로덕션 시스템
- **clinic-os**: brd-clinic을 기반으로 멀티테넌트 SaaS로 진화한 코어 시스템
  - 스타터킷 배포 체계
  - Core/Client 분리 아키텍처 (`.docking/engine/`)
  - HQ 기반 버전 관리 및 업데이트 시스템

현재 **brd-clinic은 clinic-os의 업데이트 체계에서 "외면"된 상태**로, HQ로부터 코어 업데이트를 받지 못하고 있음.

### 1.2 목표

1. **선순환 구조 확립**: clinic-os → brd-clinic 자동 상속 (core:pull)
2. **양방향 피드백**: brd-clinic 기능 → clinic-os 승격 경로 확보
3. **무중단 마이그레이션**: 프로덕션 서비스 및 데이터 손상 없음
4. **기존 기능 100% 유지**: brd-clinic의 모든 커스텀 기능 보존

### 1.3 비목표

- Git 히스토리 재작성 (리스크 과다)
- 기존 brd-clinic 레포 직접 개조 (손상 리스크)
- 프로덕션 DB 스키마 변경 (데이터 손실 리스크)

---

## 2. 현재 상태 분석

### 2.1 레포지토리 비교

| 항목 | clinic-os | brd-clinic | 차이점 |
|------|-----------|------------|--------|
| **migrations** | 35개 | 496개 | brd-clinic에 프로덕션 데이터 포함 |
| **src/lib/local/** | ✅ | ❌ | brd-clinic에 오버라이드 구조 없음 |
| **plugin 시스템** | ✅ | ❌ | hooks.ts, plugin-loader.ts 등 |
| **.docking/** | ✅ | ❌ | 코어 동기화 시스템 없음 |
| **.core/** | ✅ | ❌ | 버전 추적 없음 |

### 2.2 인프라 현황 (brd-clinic 프로덕션)

```yaml
Cloudflare Pages:
  project: brd-clinic
  domain: [프로덕션 도메인]

D1 Database:
  name: brd-clinic-db
  id: ebbde529-1432-4952-a3de-865ddb5783a3

R2 Bucket:
  name: brd-clinic-uploads
  binding: BUCKET
```

### 2.3 Core/Client 아키텍처 (clinic-os)

```
┌─────────────────────────────────────────────────────────────┐
│                     clinic-os (Core)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ CORE_PATHS  │  │   LOCAL_    │  │  PROTECTED  │        │
│  │ (upstream)  │  │  PREFIXES   │  │    (보호)   │        │
│  │             │  │ (클라이언트)│  │             │        │
│  │ src/pages/  │  │ src/lib/    │  │ wrangler.   │        │
│  │ src/lib/    │  │   local/    │  │   toml      │        │
│  │ migrations/ │  │ src/plugins/│  │ clinic.json │        │
│  │ ...         │  │   local/    │  │ .docking/   │        │
│  │             │  │ public/     │  │   config    │        │
│  │             │  │   local/    │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ core:pull (fetch.js)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   brd-clinic-2 (Client)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ CORE (동기화)│  │ LOCAL (보존)│  │ CONFIG (보호)│        │
│  │             │  │             │  │             │        │
│  │ HQ에서 받음 │  │ 테넌트 전용 │  │ 바인딩 설정 │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 마이그레이션 전략

### 3.1 핵심 원칙

> **"기존 레포/프로덕션을 건드리지 않고, 새 스타터킷에서 시작하여 커스텀만 이식한다"**

```
기존 brd-clinic ──────────────────────────────────────────────►  그대로 유지 (롤백 대비)
                                                                    │
                                                                    │ 커스텀 추출
                                                                    ▼
clinic-os ──► 스타터킷 생성 ──► brd-clinic-2 ◄─────── 커스텀 이식
                                     │
                                     │ 검증 완료 후
                                     ▼
                              프로덕션 전환 (도메인/바인딩)
```

### 3.2 데이터 전략

**DB를 새로 만들지 않고 기존 D1을 그대로 사용**

```yaml
# brd-clinic-2/wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "brd-clinic-db"
database_id = "ebbde529-1432-4952-a3de-865ddb5783a3"  # 기존 ID 그대로

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "brd-clinic-uploads"  # 기존 버킷 그대로
```

→ **데이터 마이그레이션 불필요**, 코드만 전환

### 3.3 커스텀 분류 체계

| 분류 | 설명 | 이동 경로 | 예시 |
|------|------|-----------|------|
| **CORE** | clinic-os와 동일한 코드 | 이동 불필요 (스킵) | src/lib/analytics.ts |
| **LOCAL_CODE** | brd-clinic 전용 로직 | `src/lib/local/` | 커스텀 비즈니스 로직 |
| **LOCAL_PAGES** | 테넌트 전용 페이지 | `src/plugins/local/pages/` | 특수 랜딩 페이지 |
| **LOCAL_ASSETS** | 테넌트 전용 리소스 | `public/local/` | 로고, OG 이미지 |
| **CONFIG** | 환경 설정 | PROTECTED (복사) | wrangler.toml |
| **DATA** | 프로덕션 데이터 | DB 공유로 해결 | 환자 데이터, 예약 등 |

---

## 4. 상세 실행 계획

### Phase 0: 사전 검증 (Day 1)

**목표**: 도킹 메커니즘이 안전하게 동작하는지 확인

#### Step 0.1: 스타터킷 생성 테스트

```bash
cd ~/dev/clinic-os
npm run create-starter-kit
# 출력: dist-packages/clinic-os-starter-v{VERSION}.zip
```

**검증 항목**:
- [ ] ZIP 파일 정상 생성
- [ ] 필수 파일 포함 확인: `.docking/`, `src/`, `migrations/`, `package.json`
- [ ] PROTECTED 파일 템플릿 상태 확인: `wrangler.toml`

#### Step 0.2: 테스트 환경에서 core:pull 검증

```bash
# 임시 디렉토리에서 테스트
mkdir -p ~/dev/test-starter
cd ~/dev/test-starter
unzip ~/dev/clinic-os/dist-packages/clinic-os-starter-v*.zip -d .

# upstream 설정
git init
git remote add upstream ~/dev/clinic-os

# .docking/config.yaml 설정 (HQ 없이 로컬 테스트)
cat > .docking/config.yaml << 'EOF'
hq_url: ""
device_token: ""
clinic_name: "test-clinic"
EOF

# .core/version 설정
mkdir -p .core
echo "v1.0.0" > .core/version

# core:pull 시뮬레이션 (dry-run)
git fetch upstream --tags
npm run core:pull -- --version=v1.2.0
```

**검증 항목**:
- [ ] CORE_PATHS 파일만 갱신되는가?
- [ ] LOCAL_PREFIXES 경로가 생성/보호되는가?
- [ ] PROTECTED 파일이 절대 변경되지 않는가?
- [ ] migrations가 정상 적용되는가?

#### Step 0.3: fetch.js 계약 검증

```javascript
// 확인해야 할 경로 계약
CORE_PATHS = [
    'src/pages/', 'src/components/', 'src/layouts/',
    'src/styles/', 'src/lib/', 'src/plugins/custom-homepage/',
    'src/plugins/survey-tools/', 'src/survey-tools/stress-check/',
    'migrations/', 'seeds/', 'docs/',
    'scripts/', '.docking/engine/',
    'package.json', 'astro.config.mjs', 'tsconfig.json'
];

LOCAL_PREFIXES = [
    'src/lib/local/',
    'src/plugins/local/',
    'src/survey-tools/local/',
    'public/local/'
];

PROTECTED_EXACT = [
    'wrangler.toml',
    'clinic.json',
    '.docking/config.yaml'
];
```

**검증 방법**: core:pull 실행 후 `git diff --stat`로 변경된 파일 목록 확인

---

### Phase 1: brd-clinic-2 초기화 (Day 2)

**목표**: 깨끗한 스타터킷 기반 새 프로젝트 생성

#### Step 1.1: 프로젝트 생성

```bash
# 새 디렉토리 생성
mkdir -p ~/dev/brd-clinic-2
cd ~/dev/brd-clinic-2

# 스타터킷 압축 해제
unzip ~/dev/clinic-os/dist-packages/clinic-os-starter-v*.zip -d .

# Git 초기화
git init
git add -A
git commit -m "Initial commit: clinic-os starter kit v{VERSION}"
```

#### Step 1.2: upstream 연결

```bash
# clinic-os를 upstream으로 설정
git remote add upstream https://github.com/xulfereht/clinic-os.git
# 또는 로컬: git remote add upstream ~/dev/clinic-os

git fetch upstream --tags
```

#### Step 1.3: 도킹 설정

```bash
# .docking/config.yaml 생성
cat > .docking/config.yaml << 'EOF'
hq_url: "https://clinic-os-hq.pages.dev"
device_token: ""  # HQ에서 발급 또는 빈 값 (로컬 모드)
clinic_name: "brd-clinic"
EOF

# .core/version 설정 (현재 스타터킷 버전)
mkdir -p .core
echo "v1.2.0" > .core/version
```

#### Step 1.4: core:pull 실행

```bash
npm install
npm run core:pull

# 검증
git status  # 변경된 파일 확인
npm run build  # 빌드 성공 확인
```

**체크포인트**:
- [ ] core:pull 성공
- [ ] npm run build 성공
- [ ] npm run dev 로컬 실행 성공

---

### Phase 2: 커스텀 코드 분류 (Day 3-4)

**목표**: brd-clinic의 커스텀 코드를 식별하고 분류

#### Step 2.1: 파일 차이 분석

```bash
# src/lib 비교
diff -rq ~/dev/clinic-os/src/lib ~/dev/brd-clinic/src/lib 2>/dev/null | grep -v ".DS_Store"

# src/pages 비교
diff -rq ~/dev/clinic-os/src/pages ~/dev/brd-clinic/src/pages 2>/dev/null | grep -v ".DS_Store"

# src/components 비교
diff -rq ~/dev/clinic-os/src/components ~/dev/brd-clinic/src/components 2>/dev/null | grep -v ".DS_Store"

# public 비교
diff -rq ~/dev/clinic-os/public ~/dev/brd-clinic/public 2>/dev/null | grep -v ".DS_Store"
```

#### Step 2.2: 커스텀 파일 목록 생성

**예상 커스텀 영역**:

| 경로 | 유형 | 이동 대상 | 비고 |
|------|------|-----------|------|
| `public/favicon.ico` | 리소스 | `public/local/favicon.ico` | 브랜드 파비콘 |
| `public/images/logo.png` | 리소스 | `public/local/images/logo.png` | 브랜드 로고 |
| `public/images/og-*.png` | 리소스 | `public/local/images/og-*.png` | OG 이미지 |
| `src/config.ts` | 설정 | 검토 필요 | 코어 vs 로컬 분리 |
| `wrangler.toml` | 설정 | 그대로 복사 | PROTECTED |

#### Step 2.3: migrations 분류

```bash
cd ~/dev/brd-clinic

# migrations 파일 유형 분류
ls migrations/ | while read f; do
    if [[ "$f" == 9999_* ]]; then
        echo "DATA: $f"  # 프로덕션 데이터 동기화
    elif [[ "$f" == *_sync_* ]]; then
        echo "DATA: $f"  # 데이터 동기화
    elif [[ "$f" == seed_* ]]; then
        echo "SEED: $f"  # 시드 데이터
    else
        echo "SCHEMA: $f"  # 스키마 변경
    fi
done | sort | uniq -c
```

**migrations 정책 결정**:

| 유형 | 개수 (추정) | 처리 방법 |
|------|-------------|-----------|
| SCHEMA (코어) | ~35 | clinic-os에서 자동 제공 |
| SCHEMA (테넌트) | ~10 | `src/lib/local/migrations/`로 이동 |
| DATA (동기화) | ~450 | **무시** (DB 공유로 해결) |

---

### Phase 3: 커스텀 이식 (Day 5-7)

**목표**: 분류된 커스텀 코드를 brd-clinic-2의 LOCAL 경로로 이식

#### Step 3.1: public 리소스 이식

```bash
cd ~/dev/brd-clinic-2

# local 디렉토리 생성
mkdir -p public/local/images

# brd-clinic에서 복사
cp ~/dev/brd-clinic/public/favicon.ico public/local/
cp ~/dev/brd-clinic/public/images/logo*.png public/local/images/
cp ~/dev/brd-clinic/public/images/og-*.png public/local/images/

# 커밋
git add public/local/
git commit -m "feat(local): Add brd-clinic brand assets"
```

#### Step 3.2: 설정 파일 복사

```bash
# wrangler.toml 복사 (PROTECTED)
cp ~/dev/brd-clinic/wrangler.toml ./wrangler.toml

# 커밋
git add wrangler.toml
git commit -m "config: Configure brd-clinic D1/R2 bindings"
```

#### Step 3.3: 커스텀 로직 이식 (가장 주의 필요)

```bash
# local 디렉토리 구조 생성
mkdir -p src/lib/local
mkdir -p src/plugins/local/pages
mkdir -p src/plugins/local/components

# 커스텀 파일 복사 (개별 검토 후)
# 예: brd-clinic 전용 유틸리티
# cp ~/dev/brd-clinic/src/lib/custom-util.ts src/lib/local/
```

**⚠️ 주의**: `src/lib/` 파일 대부분은 clinic-os와 동일하므로, **차이가 있는 파일만** 이식

#### Step 3.4: import 경로 수정

이식된 파일의 import 경로 수정:

```typescript
// 변경 전 (brd-clinic)
import { someUtil } from '@lib/custom-util';

// 변경 후 (brd-clinic-2)
import { someUtil } from '@lib/local/custom-util';
```

**alias 설정 확인** (`astro.config.mjs` 또는 `tsconfig.json`):

```json
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["./src/lib/*"],
      "@lib/local/*": ["./src/lib/local/*"]
    }
  }
}
```

---

### Phase 4: 검증 및 배포 전환 (Day 8-10)

**목표**: 기능 동등성 확인 후 프로덕션 전환

#### Step 4.1: 로컬 빌드 검증

```bash
cd ~/dev/brd-clinic-2

npm run build
npm run dev

# 브라우저에서 http://localhost:4321 접속
# 주요 기능 수동 테스트
```

**체크리스트**:
- [ ] 홈페이지 정상 로드
- [ ] 관리자 로그인 성공
- [ ] 예약 기능 동작
- [ ] 환자 목록 조회
- [ ] 이미지 업로드 (R2)
- [ ] SMS 발송 테스트

#### Step 4.2: 스테이징 배포

```bash
# 스테이징 환경으로 배포 (별도 Pages 프로젝트)
# wrangler.toml에서 name을 임시로 변경
sed -i '' 's/name = "brd-clinic"/name = "brd-clinic-staging"/' wrangler.toml

npm run build
npx wrangler pages deploy dist --project-name=brd-clinic-staging
```

**스테이징 검증**:
- [ ] 스테이징 URL에서 모든 기능 동작
- [ ] 프로덕션 D1 데이터 정상 조회 (읽기 전용 테스트)
- [ ] R2 이미지 정상 로드

#### Step 4.3: 프로덕션 전환

**방법 A: Pages 프로젝트 교체** (권장)

```bash
# 1. wrangler.toml 원복
sed -i '' 's/name = "brd-clinic-staging"/name = "brd-clinic"/' wrangler.toml

# 2. 기존 brd-clinic Pages 프로젝트에 새 코드 배포
npm run build
npx wrangler pages deploy dist --project-name=brd-clinic

# 3. 기존 brd-clinic 레포는 archive로 보관
```

**방법 B: 도메인 전환** (더 안전)

```bash
# 1. brd-clinic-2를 별도 Pages 프로젝트로 유지
# 2. 프로덕션 도메인을 brd-clinic-2로 전환
# 3. 문제 발생 시 도메인만 다시 brd-clinic으로 롤백
```

#### Step 4.4: 롤백 계획

```bash
# 즉시 롤백 (5분 이내)
# 방법 B 사용 시: 도메인을 기존 brd-clinic으로 재연결

# 코드 롤백 (방법 A 사용 시)
cd ~/dev/brd-clinic  # 기존 레포
npm run build
npx wrangler pages deploy dist --project-name=brd-clinic
```

---

## 5. 리스크 분석

### 5.1 리스크 매트릭스

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| core:pull이 LOCAL 파일 덮어씀 | 낮음 | 높음 | Phase 0에서 사전 검증 |
| import 경로 누락 | 중간 | 중간 | 빌드 시 TypeScript 에러로 감지 |
| DB 스키마 불일치 | 낮음 | 높음 | 동일 D1 사용으로 회피 |
| 프로덕션 다운타임 | 낮음 | 높음 | 스테이징 검증 + 즉시 롤백 준비 |
| 커스텀 코드 누락 | 중간 | 중간 | Phase 2 diff 분석으로 전수 조사 |

### 5.2 핵심 가정 검증

| 가정 | 검증 방법 | 검증 시점 |
|------|-----------|-----------|
| fetch.js가 CORE_PATHS만 갱신 | Phase 0 테스트 | Day 1 |
| LOCAL 경로가 보호됨 | Phase 0 테스트 | Day 1 |
| PROTECTED 파일 불변 | Phase 0 테스트 | Day 1 |
| 동일 D1 바인딩 동작 | Phase 4.1 로컬 테스트 | Day 8 |

---

## 6. 완료 기준

### 6.1 기능 동등성

- [ ] 모든 공개 페이지 정상 동작
- [ ] 관리자 대시보드 전 기능 동작
- [ ] 예약/결제/SMS 기능 동작
- [ ] 이미지 업로드/조회 정상

### 6.2 아키텍처 목표

- [ ] `core:pull` 명령으로 clinic-os 업데이트 수신 가능
- [ ] 커스텀 코드가 `LOCAL_PREFIXES` 경로에 분리
- [ ] `wrangler.toml`이 PROTECTED로 보호됨

### 6.3 운영 목표

- [ ] 프로덕션 전환 완료
- [ ] 기존 brd-clinic 레포 archive 처리
- [ ] brd-clinic-2 → brd-clinic으로 레포 이름 변경 (선택)

---

## 7. 일정 요약

| Phase | 기간 | 주요 산출물 |
|-------|------|-------------|
| Phase 0 | Day 1 | 도킹 메커니즘 검증 완료 |
| Phase 1 | Day 2 | brd-clinic-2 초기화 완료 |
| Phase 2 | Day 3-4 | 커스텀 분류 목록 |
| Phase 3 | Day 5-7 | 커스텀 이식 완료 |
| Phase 4 | Day 8-10 | 프로덕션 전환 완료 |

**총 예상 기간**: 10일 (보수적 추정)

---

## 8. 후속 작업

### 8.1 선순환 운영 체계

마이그레이션 완료 후 다음 프로세스 정립:

1. **코어 업데이트 수신**: 정기적으로 `npm run core:pull` 실행 (또는 CI 자동화)
2. **기능 승격**: brd-clinic-2에서 개발한 공통 기능을 clinic-os로 PR

### 8.2 CI/CD 통합

```yaml
# .github/workflows/core-sync.yml (예시)
name: Core Sync Check
on:
  schedule:
    - cron: '0 9 * * 1'  # 매주 월요일 9시
jobs:
  check-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          git fetch upstream --tags
          npm run core:pull -- --dry-run
```

---

## 부록 A: 명령어 요약

```bash
# 스타터킷 생성
cd ~/dev/clinic-os && npm run create-starter-kit

# brd-clinic-2 초기화
mkdir ~/dev/brd-clinic-2 && cd ~/dev/brd-clinic-2
unzip ~/dev/clinic-os/dist-packages/clinic-os-starter-v*.zip -d .
git init && git remote add upstream ~/dev/clinic-os

# 도킹 설정
mkdir -p .docking .core
echo "v1.2.0" > .core/version

# 코어 동기화
npm run core:pull

# 빌드 및 배포
npm run build
npx wrangler pages deploy dist
```

---

## 부록 B: 참고 파일

- `.docking/engine/fetch.js`: 코어 동기화 로직
- `.docking/engine/migrate.js`: 마이그레이션 실행기
- `.docking/config.yaml.template`: 도킹 설정 템플릿
