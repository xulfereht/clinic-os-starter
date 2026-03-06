# Project Structure & Packaging Rules

## 📁 전체 구조 맵

```
clinic-os/
│
├── 🔵 .docking/                 # Starter Kit에만 포함
│   ├── engine/                  # ✅ Starter Kit
│   ├── incoming/                # ✅ Starter Kit (빈 폴더)
│   ├── staging/                 # ✅ Starter Kit (빈 폴더)
│   └── config.yaml.template     # ✅ Starter Kit
│
├── 🔵 .client/                  # Starter Kit에만 포함
│   ├── CONTEXT.md.template      # ✅ Starter Kit
│   └── customizations/          # ✅ Starter Kit (빈 폴더)
│
├── 🔵 .agent/workflows/         # Starter Kit에만 포함
│   ├── setup-clinic.md          # ✅ Starter Kit
│   ├── unpack-docking.md        # ✅ Starter Kit
│   └── help.md                  # ✅ Starter Kit
│
├── 🟢 src/                      # Full Package에만 포함
│   ├── pages/                   # ✅ Full Package
│   ├── components/              # ✅ Full Package
│   ├── lib/                     # ✅ Full Package
│   └── ...                      # ✅ Full Package
│
├── 🟢 public/                   # Full Package에만 포함
│   ├── images/                  # ✅ Full Package
│   ├── admin/                   # ✅ Full Package
│   └── ...                      # ✅ Full Package
│
├── 🟢 migrations/               # Full Package에만 포함
│   └── *.sql                    # ✅ Full Package
│
├── 🟢 scripts/                  # Full Package (앱 관련만)
│   ├── db-sync.js               # ✅ Full Package
│   ├── seed-*.sql               # ✅ Full Package
│   ├── pack-docking.js          # ❌ 개발자 전용
│   ├── create-starter-kit.js    # ❌ 개발자 전용
│   └── unpack-docking.js        # ❌ (구버전, 이제 .docking/engine에 있음)
│
├── 🟢 seeds/                    # Full Package
│   └── *.sql                    # ✅ Full Package
│
├── 🟢 GEMINI.md                 # Full Package (앱용 가이드)
├── 🟢 package.json              # Full Package (앱 의존성)
├── 🟢 astro.config.mjs          # ✅ Full Package
├── 🟢 tsconfig.json             # ✅ Full Package
│
├── 🔴 hq/                       # 절대 패키징 안함 (개발자 전용)
│   └── ...                      # ❌ HQ 서버 코드
│
├── 🔴 node_modules/             # 패키징 안함
├── 🔴 dist/                     # 패키징 안함
├── 🔴 dist-packages/            # 패키징 안함 (출력 폴더)
├── 🔴 archive/                  # 패키징 안함
├── 🔴 .wrangler/                # 패키징 안함
├── 🔴 .git/                     # 패키징 안함
├── 🔴 wrangler.toml             # 패키징 안함 (클라이언트가 직접 생성)
├── 🔴 .env                      # 패키징 안함
└── 🔴 data/                     # 패키징 안함 (클라이언트 데이터)
```

## 📦 패키지별 포함 내용

### 🔵 Starter Kit (최초 1회 다운로드, ~12KB)
클라이언트가 처음 받는 "빈 껍데기"

| 포함 | 설명 |
|------|------|
| `.docking/engine/` | 도킹 엔진 (fetch.js 등) |
| `.docking/*.template` | 설정 템플릿 |
| `.client/` | 컨텍스트 템플릿 |
| `.agent/workflows/` | AI 에이전트 워크플로우 |
| `GEMINI.md` | 스타터용 가이드 |
| `package.json` | 루트 명령어 (minimal) |
| `README.md` | 시작 안내 |

### 🟢 Full Package (HQ 서버에서 다운로드, ~48MB)
실제 앱 코어

| 포함 | 설명 |
|------|------|
| `src/` | 전체 소스코드 |
| `public/` | 정적 파일 |
| `migrations/` | DB 스키마 |
| `seeds/` | 초기 데이터 |
| `scripts/` | 앱 관련 스크립트만 |
| `GEMINI.md` | 앱용 가이드 |
| `package.json` | 앱 의존성 |
| `astro.config.mjs` | Astro 설정 |

### 🔴 절대 패키징 안함

| 제외 | 이유 |
|------|------|
| `hq/` | 개발자 전용 (HQ 서버) |
| `node_modules/` | 의존성 (npm install로 설치) |
| `dist/`, `dist-packages/` | 빌드 결과물 |
| `wrangler.toml` | 클라이언트가 직접 생성 |
| `.env` | 클라이언트 환경변수 |
| `archive/` | 로컬 백업 |
| `.git/` | 버전 관리 |

## 🔄 패키징 스크립트 수정 필요

`scripts/pack-docking.js`에서 위 규칙을 반영해야 합니다:
- `hq/` 폴더 제외
- 개발자 전용 스크립트 제외
- Full Package용 GEMINI.md 사용
