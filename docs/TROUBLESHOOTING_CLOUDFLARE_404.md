# Cloudflare Pages 404 오류 트러블슈팅 가이드

## 문제 상황

Clinic OS를 Cloudflare Pages에 배포했을 때 다음과 같은 증상이 발생하는 경우:

- **로컬 개발 환경** (`npm run dev`): `/programs/1` 접속 정상 ✅
- **Cloudflare Pages 프로덕션**: `/programs/1` 404 오류 ❌
- **홈페이지** (`/`): 정상 작동 ✅

## 원인 분석

### 주요 원인: 스타터킷 버전 문제

2026년 1월 30일 커밋 `a9a0320`에서 **404 routing fix**가 적용되었습니다. 이전 버전의 스타터킷을 사용하는 경우 다음 파일이 누락될 수 있습니다:

| 파일 | 역할 | 패치 이후 추가됨 |
|------|------|----------------|
| `src/middleware.ts` | 404 응답을 `/404` 페이지로 리라이트 | ✅ 2026-01-30 |
| `scripts/postbuild-local-override.js` | `_routes.json` 최적화 | ✅ 2026-01-30 |
| `src/pages/404.astro` | `prerender = false` 설정 | ✅ 2026-01-30 |

### 기술적 배경

Clinic OS는 **SSR (Server-Side Rendering)** 모드를 사용합니다:

```javascript
// astro.config.mjs
export default defineConfig({
  output: 'server',  // SSR 모드
  adapter: cloudflare(),  // Cloudflare Pages Functions 사용
})
```

동적 페이지(`/programs/[id].astro`)는 `prerender = false`로 설정되어 있어 빌드 시 정적 HTML이 생성되지 않고, Cloudflare Functions가 요청을 처리합니다.

**404가 발생하는 이유:**
1. Cloudflare Pages가 모든 경로(`/*`)를 Functions로 라우팅
2. Functions는 실행되지만 응답이 404로 처리됨
3. `middleware.ts`가 없으면 404 응답을 `/404` 페이지로 리라이트하지 못함

---

## 해결 방법

### ⚠️ 사전 준비: 데이터 백업

```bash
# 백업 폴터 생성
BACKUP_DIR=~/clinic-backup-$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 핵심 파일 백업
cp wrangler.toml $BACKUP_DIR/
cp clinic.json $BACKUP_DIR/ 2>/dev/null || true
cp -r data $BACKUP_DIR/ 2>/dev/null || true
cp -r public/local $BACKUP_DIR/ 2>/dev/null || true

echo "✅ 백업 완료: $BACKUP_DIR"
```

---

### 방법 1: 스타터킷 업데이트 (권장)

스타터킷 업데이트 스크립트를 실행하면 누락된 파일이 자동으로 복구됩니다:

```bash
npm run update:starter
```

**업데이트되는 파일:**
- `.docking/engine/fetch.js`
- `scripts/setup-clinic.js`
- `scripts/dev-preflight.js`
- `scripts/deploy-guard.js`
- `scripts/postbuild-local-override.js`

**보존 파일:**
- 🛡️ `wrangler.toml` (Cloudflare 설정)
- 🛡️ `data/` (로컬 데이터베이스)
- 🛡️ `clinic.json` (클리닉 설정)
- 🛡️ `public/local/` (커스텀 파일)

---

### 방법 2: 수동 파일 생성

스타터킷 업데이트가 실패하거나 선택적으로 파일만 업데이트하려는 경우:

#### 2.1 middleware.ts 생성

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

/**
 * Clinic OS Middleware
 * - 404 응답을 /404 페이지로 리라이트
 * - API 경로는 제외
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  
  // 404 응답 처리 (API 제외)
  if (response.status === 404 && !context.url.pathname.startsWith('/api/')) {
    console.log(`[Middleware] 404 detected: ${context.url.pathname} -> /404`);
    return context.rewrite('/404');
  }
  
  return response;
});
```

#### 2.2 404.astro 확인

`src/pages/404.astro` 파일 상단에 다음이 있는지 확인:

```astro
---
export const prerender = false;
---
```

#### 2.3 postbuild 스크립트 확인

`scripts/postbuild-local-override.js` 파일이 있는지 확인:

```bash
ls -la scripts/postbuild-local-override.js
```

없다면 [GitHub에서 다운로드](https://github.com/xulfereht/clinic-os/blob/main/scripts/postbuild-local-override.js)하거나 스타터킷 업데이트를 실행하세요.

---

## 빌드 및 검증

### 1. 의존성 재설치

```bash
npm install
```

### 2. 빌드 실행

```bash
npm run build
```

### 3. 빌드 결과 확인

```bash
# 핵심 파일 생성 여부 확인
ls -la dist/_routes.json      # ✅ 있어야 함
ls -la dist/_worker.js/       # ✅ 있어야함 (폴터 또는 파일)
```

### 4. 로컬 테스트

```bash
npm run preview:remote
```

브라우저에서 다음 URL 테스트:
- `http://localhost:4321/` → 200 OK
- `http://localhost:4321/programs/1` → 200 OK (404 아님!)
- `http://localhost:4321/admin` → 200 OK

### 5. 프로덕션 배포

```bash
npm run deploy
```

---

## 고급 디버깅

### Cloudflare Functions 로그 확인

배포 후에도 404가 지속되면 Functions 로그를 확인합니다:

```bash
# 실시간 로그 스트리밍
npx wrangler pages deployment tail --project-name=YOUR_PROJECT_NAME
```

또는 Cloudflare Dashboard에서 확인:
1. [dash.cloudflare.com](https://dash.cloudflare.com) 접속
2. Pages → 프로젝트 선택
3. Functions 탭 → Logs 확인

### D1 데이터베이스 연결 확인

SSR 페이지는 D1 데이터베이스가 필요합니다:

```bash
# 로컬 DB 테스트
npx wrangler d1 execute YOUR_DB_NAME --local --command="SELECT COUNT(*) FROM programs"

# 프로덕션 DB 테스트
npx wrangler d1 execute YOUR_DB_NAME --remote --command="SELECT COUNT(*) FROM programs"
```

### _routes.json 검증

`dist/_routes.json`이 다음 조건을 만족하는지 확인:

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/_astro/*",
    "/favicon.*",
    "/images/*"
    // ... (100개 규칙 제한 준수)
  ]
}
```

**참고:** `_routes.json`은 `postbuild-local-override.js`가 자동으로 최적화합니다.

---

## 문제 해결 체크리스트

- [ ] 백업 완료 (`~/clinic-backup-YYYYMMDD/`)
- [ ] 스타터킷 업데이트 완료 (`npm run update:starter`)
- [ ] `src/middleware.ts` 파일 생성됨
- [ ] `src/pages/404.astro`에 `prerender = false` 설정됨
- [ ] `scripts/postbuild-local-override.js` 파일 존재함
- [ ] 빌드 성공 (`npm run build`)
- [ ] 로컬 테스트 성공 (`npm run preview:remote`)
- [ ] 프로덕션 배포 완료 (`npm run deploy`)
- [ ] 프로덕션 404 해결 확인

---

## 자주 묻는 질문

### Q: `npm run update:starter`가 실패합니다

**A:** 수동 업데이트를 시도하세요:

```bash
# 임시 폴터에 최신 스타터킷 다운로드
cd /tmp
git clone --depth 1 https://github.com/xulfereht/clinic-os-starter.git

# 핵심 파일만 복사
cd ~/your-clinic-project
cp /tmp/clinic-os-starter/scripts/*.js scripts/
cp /tmp/clinic-os-starter/.docking/engine/fetch.js .docking/engine/

# 정리
rm -rf /tmp/clinic-os-starter
```

### Q: 완전 재설치 없이 해결할 수 있나요?

**A:** 네, 가능합니다. 이 가이드의 방법은 모두 **데이터 보존** 방식입니다:
- `wrangler.toml`은 건드리지 않습니다
- `data/` 폴터는 백업 후 복원됩니다
- `core/`는 `core:pull`로 업데이트만 합니다

### Q: 다른 페이지에서도 404가 발생합니다

**A:** 모든 동적 페이지에 `prerender = false`가 설정되어 있는지 확인하세요:

```bash
# prerender 설정 검색
grep -r "prerender" src/pages/ | grep -v "node_modules"
```

모든 `[id].astro`, `[slug].astro` 파일에 `export const prerender = false;`가 있어야 합니다.

### Q: 캐시 문제로 인한 404인가요?

**A:** Cloudflare 캐시를 purge핸보세요:

```bash
# Cloudflare Dashboard
# Caching → Configuration → Purge Everything
```

또는 배포 후 2-3분 기다리세요 (전파 시간 소요).

---

## 관련 문서

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Astro SSR Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Clinic OS Setup Guide](../README.md)

---

## 지원 요청

이 가이드를 따라도 문제가 해결되지 않으면 다음 정보를 수집하여 문의해주세요:

```bash
# 진단 정보 수집
cat > diagnostic.txt << EOF
=== 버전 정보 ===
$(cat package.json | grep '"version"' | head -1)
$(cat core/package.json | grep '"version"' 2>/dev/null | head -1)

=== 파일 존재 여부 ===
middleware.ts: $(ls src/middleware.ts 2>/dev/null && echo "있음" || echo "없음")
postbuild-local-override.js: $(ls scripts/postbuild-local-override.js 2>/dev/null && echo "있음" || echo "없음")

=== 빌드 산출물 ===
_routes.json: $(ls dist/_routes.json 2>/dev/null && echo "있음" || echo "없음")
_worker.js: $(ls dist/_worker.js 2>/dev/null && echo "있음" || echo "없음")

=== wrangler.toml 설정 ===
$(grep -E "^(name|compatibility)" wrangler.toml 2>/dev/null)
EOF

cat diagnostic.txt
```
