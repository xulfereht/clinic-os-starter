# Clinic-OS HQ 개발 가이드

> ⚠️ **Claude Code**: 이 파일은 HQ 개발자용입니다. 클라이언트에게는 배포되지 않습니다.

---

## 📍 프로젝트 개요

| 항목 | 값 |
|------|-----|
| 프로젝트 | Clinic-OS (한의원 웹플랫폼) |
| 역할 | HQ - 코어 개발 및 배포 관리 |
| 배포 환경 | Cloudflare Pages + D1 |
| 프레임워크 | Astro + TypeScript |

---

## 🗺️ 전체 레포 구조

```
clinic-os/
│
├── CLAUDE.md                  # ⭐ HQ 개발 가이드 (지금 읽는 파일)
├── GEMINI.md                  # 클라이언트용 템플릿 (core 배포 시 동적 생성)
│
├── 📂 src/                    # 앱 소스코드 (Core로 배포됨)
│   ├── pages/                 # 코어 페이지
│   ├── components/            # UI 컴포넌트
│   ├── lib/
│   │   ├── plugin-loader.ts   # 플러그인 로딩 시스템
│   │   └── survey-tools-loader.ts
│   ├── plugins/               # 플러그인 시스템
│   │   ├── README.md          # 플러그인 빠른 시작
│   │   ├── custom-homepage/
│   │   └── survey-tools/
│   └── survey-tools/          # 검사도구 콘텐츠
│       └── stress-check/
│
├── 📂 hq/                     # 🔴 HQ 서버 (클라이언트 배포 안됨)
│   ├── src/index.js           # HQ API
│   ├── schema.sql             # HQ DB 스키마
│   └── seeds/                 # HQ 시드 데이터
│
├── 📂 scripts/                # 배포 자동화
│   ├── total-release.js       # npm run publish
│   ├── mirror-core.js         # core 미러링 + GEMINI.md 동적 생성
│   ├── mirror-starter.js      # starter kit 미러링
│   └── create-starter-kit.js
│
├── 📂 migrations/             # DB 마이그레이션
├── 📂 seeds/                  # 초기 데이터
├── 📂 docs/                   # 문서
│
├── 📂 .mirror-staging/        # core 미러 스테이징
└── 📂 .starter-staging/       # starter kit 스테이징
```

---

## 🚀 배포 아키텍처

### 패키지 흐름

```
HQ 레포 (clinic-os)
    │
    ├─→ Starter Kit (.starter-staging → GitHub)
    │     └─ 클라이언트가 처음 받는 "빈 껍데기"
    │
    ├─→ Core (.mirror-staging → GitHub)
    │     └─ 실제 앱 코드 (src/, plugins/, migrations/)
    │     └─ GEMINI.md 동적 생성 (클라이언트 AI 가이드)
    │
    └─→ HQ Server (Cloudflare Pages)
          └─ 버전 관리, 다운로드 API
```

### 주요 명령어

| 명령 | 용도 | 실행 위치 |
|------|------|----------|
| `npm run publish` | 전체 릴리스 | 루트 |
| `npm run core:push` | Core만 미러링 | 루트 |
| `npm run starter:push` | Starter Kit만 미러링 | 루트 |
| `npm run hq:deploy` | HQ 서버 배포 | 루트 (또는 hq/) |

### 릴리스 프로세스 (`npm run publish`)

1. 버전 범프 (package.json)
2. Git 커밋/푸시
3. Starter Kit 생성 및 미러링
4. **Core 미러링 + GEMINI.md 동적 생성**
5. HQ R2/D1 업데이트
6. HQ Pages 배포

---

## 📦 기존 시스템 인벤토리

### 플러그인 시스템

| 파일 | 역할 |
|------|------|
| `src/lib/plugin-loader.ts` | 플러그인 로딩/관리 |
| `docs/PLUGIN_DEVELOPMENT_GUIDE.md` | 플러그인 개발 규칙 (필독) |
| `src/pages/ext/[...path].astro` | Universal Router |

**설치된 플러그인:**
- `custom-homepage` (override) - 홈페이지 커스터마이징
- `survey-tools` (new-route) - 검사도구 라우터

### 검사도구 시스템

| 파일 | 역할 |
|------|------|
| `src/lib/survey-tools-loader.ts` | 검사도구 로딩 |
| `src/survey-tools/` | 검사도구 콘텐츠 |

**설치된 검사도구:**
- `stress-check` - 스트레스 자가진단

### Local Override 패턴

클라이언트 커스터마이징이 `core:pull`에 영향받지 않도록:
- `src/plugins/local/` - gitignore됨
- `src/survey-tools/local/` - gitignore됨
- mirror-core.js가 `.gitignore`에 이 폴더 보호 규칙 포함

---

## 🚫 금지 규칙

### 1. HQ 코드와 Core 코드 혼동 금지

```
hq/에서 npm run publish → ❌ 오류
루트에서 hq/ 시드 실행 → ❌ 경로 오류
```

### 2. Core 테이블 직접 수정 금지

```sql
-- ❌ NEVER
ALTER TABLE patients ADD COLUMN ...;
```
→ 플러그인에서 `custom_` 접두사 테이블 사용

### 3. 클라이언트 정보 HQ에 하드코딩 금지

---

## ✅ 작업 패턴

### 새 플러그인 추가

```bash
# 1. 플러그인 생성
mkdir -p src/plugins/my-plugin
# manifest.json, pages/ 등 작성

# 2. 마이그레이션 있으면
# migrations/XXXX_my_plugin.sql 작성

# 3. 테스트
npm run dev

# 4. 배포
npm run publish
```

### HQ 변경

```bash
# 1. hq/ 코드 수정
# 2. 테스트
cd hq && npm run dev

# 3. HQ만 배포
npm run hq:deploy

# 또는 전체 릴리스에 포함
npm run publish
```

### 클라이언트 GEMINI.md 수정

`scripts/mirror-core.js`의 `generateClientGeminiMd()` 함수 수정
→ 다음 `npm run publish` 시 자동 반영

---

## 📂 주요 파일 위치

| 목적 | 파일 |
|------|------|
| HQ 개발 가이드 | `CLAUDE.md` (이 파일) |
| 플러그인 규칙 | `docs/PLUGIN_DEVELOPMENT_GUIDE.md` |
| Core 미러링 | `scripts/mirror-core.js` |
| Starter 미러링 | `scripts/mirror-starter.js` |
| 전체 릴리스 | `scripts/total-release.js` |
| HQ API | `hq/src/index.js` |
| HQ DB 스키마 | `hq/schema.sql` |

---

> 최종 업데이트: 2026-01-21
