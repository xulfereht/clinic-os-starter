# /optimize-aeo — AEO/SEO 최적화

> **Role**: AEO/SEO Optimization Specialist
> **Cognitive mode**: Context-aware routing. Detect master vs local repo and provide appropriate AEO optimization for each context.

AI 검색 엔진 최적화(AEO) 및 SEO 설정을 통합 관리합니다.
마스터 레포에서는 워크샵/플랫폼 페이지용, 로컬 레포에서는 한의원 사이트용 최적화를 수행합니다.

## When to Use

- Onboarding Tier 5 (Advanced optimization)
- 신규 콘텐츠 발행 후 메타데이터 검증이 필요할 때
- "AI 검색에 뜨게 하려면", "구조화 데이터", "Schema.org"
- `/onboarding`의 "aeo-optimization" 단계

## Prerequisites

- `/setup-clinic-info` 완료 (병원 기본 정보)
- `/setup-homepage` 또는 블로그 콘텐츠 존재
- 마스터 모드: HQ 서버 배포 완료

## Context Detection

```bash
# Check repo context
if [ -d "hq" ] && [ -d "docs" ]; then
  MODE="master"
  echo "🎯 마스터 모드: 플랫폼/워크샵 페이지 AEO"
elif [ -d "core" ] || ([ -d "src/pages" ] && [ ! -d "hq" ]); then
  MODE="local"
  echo "🏥 로컬 모드: 한의원 사이트 AEO"
else
  echo "❌ 알 수 없는 컨텍스트입니다."
  exit 1
fi
```

## Procedure

### Step 1 — AEO Health Check

```bash
# Check existing AEO configuration
echo "=== AEO 현황 확인 ==="

# Check schema files
ls -la src/lib/aeo*.ts 2>/dev/null | head -5

# Check AI discovery endpoints
curl -s http://localhost:4321/.well-known/ai.json 2>/dev/null | head -20
curl -s http://localhost:4321/llms.txt 2>/dev/null | head -10

# Check DB tables (local mode)
npx wrangler d1 execute DB --local --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%aeo%';" 2>/dev/null

# Check content metadata coverage
npx wrangler d1 execute DB --local --command \
  "SELECT
    COUNT(*) as total_posts,
    SUM(CASE WHEN publish_ready = 1 THEN 1 ELSE 0 END) as ready_count
   FROM content_aeo_metadata;" 2>/dev/null
```

### Step 2 — Identify Gaps

**Master Mode (플랫폼):**
- 워크샵 랜딩 페이지 Schema.org
- 클래스 페이지 구조화 데이터
- llms.txt / ai.json 최신화
- HQ Topic/FAQ 구조화

**Local Mode (한의원):**
- 병원 Schema (MedicalClinic, Physician)
- OG 이미지 + 메타 태그
- 블로그 AEO 메타데이터
- 네이버/카카오 + AI 검색 동시 최적화

```bash
# Check what's missing
echo "=== 누락 항목 확인 ==="

# Check clinic schema components
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE category='contact';" 2>/dev/null

# Check OG setup
ls public/local/og-image.png 2>/dev/null || echo "⚠️ OG 이미지 없음"

# Check for schema injection
grep -r "json+ld" src/layouts/ 2>/dev/null | head -3 || echo "⚠️ Schema 주입 안 됨"
```

### Step 3 — Present Options

**마스터 모드 선택지:**

```
🤖 플랫폼 AEO 최적화 (마스터 모드)

현재 상태:
  ✅ ai.json — 설정됨
  ✅ llms.txt — 설정됨
  ⚠️  워크샵 페이지 Schema — 누락
  ⚠️  클래스 구조화 데이터 — 누락

선택지:
  [A] 전체 최적화 — 모든 AEO 컴포넌트 생성/업데이트
  [B] 워크샵 페이지만 — 랜딩 페이지 Schema 추가
  [C] HQ 콘텐츼 메타데이터 — Topic/FAQ 구조화
  [D] AI 디스커버리 — ai.json, llms.txt 갱신

어떤 걸로 할까요?
```

**로컬 모드 선택지:**

```
🏥 한의원 사이트 AEO 최적화 (로컬 모드)

현재 상태:
  ✅ 병원 기본 정보 — 설정됨
  ⚠️  Schema.org — MedicalClinic 누락
  ⚠️  OG 이미지 — 누락
  ⚠️  블로그 AEO 메타데이터 — 3개 중 0개 완료

선택지:
  [A] 전체 최적화 — Schema + OG + 메타데이터
  [B] Schema만 — MedicalClinic, Physician 구조화 데이터
  [C] 소셜 메타 — OG 이미지, 네이버/카카오 태그
  [D] 콘텐츠 메타데이터 — 블로그/토픽 AEO 메타데이터 백필
  [E] 검증 — 현재 AEO 설정 상태 진단

어떤 걸로 할까요?
```

### Step 4 — Execute (Local Mode Example: Full Optimization)

**4A. Schema.org Generation:**

```bash
# Verify clinic info is complete
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings
   WHERE category IN ('general', 'contact', 'info')
   AND key IN ('site_name', 'address', 'phone', 'representative');"

# If complete, schemas are auto-generated via src/lib/aeo.ts
# Just verify the AEOScript component is in layout
grep -r "AEOScript" src/layouts/BaseLayout.astro 2>/dev/null || echo "⚠️ AEOScript 컴포넌트 확인 필요"
```

**4B. OG Image Setup:**

```bash
# Delegate to /setup-og if needed
# Or create minimal OG if not exists
if [ ! -f "public/local/og-image.png" ]; then
  echo "OG 이미지가 없습니다. /setup-og 스킬을 먼저 실행하거나,"
  echo "간단한 텍스트 기반 OG를 생성할 수 있습니다."
fi
```

**4C. Content Metadata Backfill:**

```bash
# Run AEO backfill for existing content
echo "기존 콘텐츠 AEO 메타데이터 생성 중..."

# Check backfill script
node -e "const backfill = require('./src/lib/aeo-backfill.ts'); console.log('Backfill module exists');" 2>/dev/null || echo "Backfill via admin panel recommended"

# Trigger via API if available
curl -s -X POST http://localhost:4321/api/admin/aeo/backfill-metadata \
  -H "Content-Type: application/json" \
  -d '{"mode": "auto", "contentTypes": ["post", "topic"]}' 2>/dev/null || echo "API not available, use admin panel: /admin/aeo"
```

**4D. Validation:**

```bash
# Validate generated metadata
npx wrangler d1 execute DB --local --command \
  "SELECT
    content_type,
    COUNT(*) as total,
    SUM(CASE WHEN publish_ready = 1 THEN 1 ELSE 0 END) as ready,
    SUM(CASE WHEN validation_errors IS NOT NULL THEN 1 ELSE 0 END) as errors
   FROM content_aeo_metadata
   GROUP BY content_type;"
```

### Step 5 — Verification

```bash
echo "=== AEO 최적화 검증 ==="

# Build and check
npm run build 2>/dev/null || echo "Build needed for full verification"

# Check schema in built output
grep -o '<script type="application/ld+json">[^<]*</script>' dist/index.html 2>/dev/null | head -1 || echo "Schema not found in build"

# Check AI discovery endpoints
echo "AI Manifest:"
curl -s http://localhost:4321/.well-known/ai.json 2>/dev/null | head -5

echo ""
echo "LLMs.txt:"
curl -s http://localhost:4321/llms.txt 2>/dev/null | head -3
```

**완료 보고서:**

```
✅ AEO/SEO 최적화 완료

📊 스키마 상태:
   MedicalClinic: ✅ 설정됨
   Physician: ✅ 설정됨
   WebSite: ✅ 설정됨

🤖 AI 디스커버리:
   ai.json: ✅ 접근 가능
   llms.txt: ✅ 접근 가능
   /for-ai: ✅ 콘텐츠 팩 {N}개

📝 콘텐츠 메타데이터:
   블로그: {ready}/{total} 개 완료
   토픽: {ready}/{total} 개 완료

🔗 소셜 메타:
   OG 이미지: {status}
   네이버: ✅
   카카오: ✅

검증 도구:
  - Google Rich Results: https://search.google.com/test/rich-results
  - Kakao Sharing: https://developers.kakao.com/tool/debugger/sharing
```

## Master Mode Specifics

**HQ 플랫폼 AEO:**

```bash
# Master mode focuses on:
# 1. Workshop landing pages
echo "워크샵 페이지 Schema 확인..."
ls src/pages/workshops/ 2>/dev/null | head -5

# 2. Class pages structure
echo "클래스 페이지 구조 확인..."
ls src/pages/classes/ 2>/dev/null | head -5

# 3. Platform-level discovery
echo "플랫폼 AI 디스커버리 확인..."
cat public/.well-known/ai.json 2>/dev/null | head -10
```

**HQ Admin Integration:**
- `/admin/aeo` — AEO Health Check 패널
- `/api/admin/aeo/backfill-metadata` — 메타데이터 일괄 생성
- `/api/admin/aeo/rebuild-related-links` — 관련 링크 재구성

## Local Mode Specifics

**한의원 사이트 AEO:**

```bash
# Local mode focuses on:
# 1. Clinic-specific schemas (MedicalClinic, Physician)
# 2. Naver/Kakao meta tags
# 3. Blog AEO metadata
# 4. OG image for social sharing

# Check Naver-specific meta
grep -r "naver" src/layouts/ 2>/dev/null | head -3

# Check Kakao-specific meta
grep -r "kakao" src/layouts/ 2>/dev/null | head -3
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-og` | OG 이미지 설정 연동 (Local mode) |
| `/write-blog` | 블로그 작성 후 AEO 메타데이터 생성 |
| `/setup-homepage` | 홈페이지 Schema 연동 |
| `/onboarding` | Tier 5 "aeo-optimization" 단계 |
| `/hq-admin` | HQ 콘텐츠 관리 (Master mode) |

## Handoff

**To /setup-homepage:**
```json
{
  "from": "optimize-aeo",
  "to": "setup-homepage",
  "schemas_ready": true,
  "recommendations": [
    "Schema.org 마크업이 활성화되었습니다.",
    "홈페이지 섹션에 FAQPage 스키마를 추가하세요."
  ]
}
```

**To /write-blog:**
```json
{
  "from": "optimize-aeo",
  "to": "write-blog",
  "aeo_ready": true,
  "templates": {
    "citations": true,
    "supervisor": true,
    "key_claims": true
  }
}
```

## Triggers

- "AEO", "SEO", "AI 검색", "구조화 데이터", "Schema.org"
- "네이버에 뜨게", "구글 검색", "AI가 추천"
- "메타데이터", "llms.txt", "ai.json"
- "에이전트가 찾을 수 있게"

## Safety

- Read: DB 조회, 파일 확인 자유롭게 실행
- Write: 메타데이터 생성/수정 전 사용자 확인
- Production: `--remote` 플래그 명시적 확인
- Local only: 모든 생성 파일은 `local/` 또는 `_local/` 경로에 저장

## All user-facing output in Korean.
