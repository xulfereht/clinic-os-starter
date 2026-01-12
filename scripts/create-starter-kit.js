import fs from 'fs-extra';
import archiver from 'archiver';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// --- Configuration ---
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist-packages');
const pkgJson = fs.readJsonSync(path.join(PROJECT_ROOT, 'package.json'));
const VERSION = pkgJson.version;

async function createStarterKit() {
    const packageName = `clinic-os-starter-v${VERSION}.zip`;

    await fs.ensureDir(OUTPUT_DIR);
    const outputPath = path.join(OUTPUT_DIR, packageName);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    console.log(`📦 Creating Starter Kit v${VERSION}...`);

    output.on('close', () => {
        console.log(`✅ Starter Kit created: ${packageName} (${archive.pointer()} bytes)`);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    // 1. .docking/ - Docking Engine (불변 레이어)
    archive.directory(path.join(PROJECT_ROOT, '.docking/engine'), '.docking/engine');
    archive.file(path.join(PROJECT_ROOT, '.docking/config.yaml.template'), { name: '.docking/config.yaml.template' });
    archive.append('', { name: '.docking/incoming/.gitkeep' });
    archive.append('', { name: '.docking/staging/.gitkeep' });
    archive.append('# Applied Packages Log\n', { name: '.docking/.applied' });

    // 2. .client/ - Client Layer (불변 레이어)
    archive.file(path.join(PROJECT_ROOT, '.client/CONTEXT.md.template'), { name: '.client/CONTEXT.md.template' });
    archive.append('', { name: '.client/customizations/.gitkeep' });

    // 3. .agent/workflows/ - Antigravity 워크플로우
    archive.directory(path.join(PROJECT_ROOT, '.agent/workflows'), '.agent/workflows');

    // 4. core/ - 빈 폴더 (패키지로 채워질 곳)
    archive.append('', { name: 'core/.gitkeep' });

    // 5. data/ - 사용자 데이터 폴더
    archive.append('', { name: 'data/.gitkeep' });

    // 6. Root files
    // GEMINI.md (스타터용)
    const geminiContent = `# Clinic-OS 프로젝트 가이드

> ⚠️ **Antigravity**: 이 파일과 함께 \`.client/CONTEXT.md\`도 읽어주세요.

---

## 🧭 현재 상태: Starter Kit

이 프로젝트는 아직 초기화되지 않았습니다.
\`npm install\` 후 \`node scripts/setup-clinic.js\`를 실행하여 설정을 시작하세요.

---

## 📂 프로젝트 구조

\`\`\`
clinic-os/
├── .docking/              # 도킹 엔진 (업데이트 안됨)
│   └── engine/            # fetch.js 등
├── .client/               # 클라이언트 컨텍스트 (업데이트 안됨)
│   ├── CONTEXT.md         # 이 환경에 대한 정보
│   └── customizations/    # 커스텀 파일 보관
├── .agent/workflows/      # Antigravity 워크플로우
├── core/                  # 앱 소스코드 (Git Sync로 업데이트됨)
├── data/                  # 설정 및 데이터 (업데이트 안됨)
└── GEMINI.md              # 이 파일
\`\`\`

---

## 🎯 주요 워크플로우

| 명령 | 용도 |
|------|------|
| \`npm run setup\` | 초기 설정 및 최신 코드 동기화 |
| \`npm run core:pull\` | 최신 코어 업데이트 (Git Sync) |
| \`npm run dev\` | 로컬 개발 서버 실행 |
| \`npm run deploy\` | Cloudflare 배포 |
| \`/help\` | 도움 요청 |

---

## 💡 시작하기 (Local-First Workflow)

1. **필수 설치**: Node.js (v18+) 및 **Git** 설치 (필수)
2. **패키지 설치**: 터미널에서 \`npm install\` 실행
3. **시스템 초기화**: \`node scripts/setup-clinic.js\` 실행
   - 최신 코드를 Git을 통해 가져오고, 로컬 DB를 설정합니다.
4. **로컬 실행**: \`npm run dev\` 실행 후 브라우저 확인
`;
    archive.append(geminiContent, { name: 'GEMINI.md' });

    // package.json (루트)
    const packageJson = {
        name: "clinic-os-client",
        version: VERSION,
        type: "module",
        description: "Clinic-OS 클라이언트",
        scripts: {
            "setup": "node scripts/setup-clinic.js",
            "fetch": "node core/scripts/fetch.js",
            "dev": "node scripts/dev-preflight.js && npm run dev --prefix core",
            "build": "npm run build --prefix core",
            "deploy": "node scripts/deploy-guard.js"
        },
        dependencies: {
            "fs-extra": "^11.2.0",
            "js-yaml": "^4.1.0"
        }
    };
    archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' });

    // 7. scripts/
    archive.file(path.join(PROJECT_ROOT, 'scripts/setup-clinic.js'), { name: 'scripts/setup-clinic.js' });
    archive.file(path.join(PROJECT_ROOT, 'scripts/check-system.js'), { name: 'scripts/check-system.js' });
    archive.file(path.join(PROJECT_ROOT, 'scripts/deploy-guard.js'), { name: 'scripts/deploy-guard.js' });
    archive.file(path.join(PROJECT_ROOT, 'scripts/check-in.js'), { name: 'scripts/check-in.js' });
    archive.file(path.join(PROJECT_ROOT, 'scripts/dev-preflight.js'), { name: 'scripts/dev-preflight.js' });

    // 7-1. fetch.js bootstrap (Since core/ isn't cloned yet, we need a way to run it)
    // Actually, setup-clinic.js handles the first clone.
    // But we might want a placeholder fetch.js in core/scripts/ so npm run fetch doesn't fail before setup.
    // Or just let it fail. Usually setup is the first step.

    // 7-1. WSL Helper (Legacy support, but generic setup works everywhere now)
    // We can keep specific helper but simpler.
    const setupSh = `#!/bin/bash
# Clinic-OS Setup Helper
echo "🚀 Starting Clinic-OS Setup..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v18+"
    exit 1
fi
node scripts/setup-clinic.js
`;
    archive.append(setupSh, { name: 'setup.sh', mode: 0o755 });

    // 8. docs/
    archive.directory(path.join(PROJECT_ROOT, 'docs'), 'docs');

    // README.md
    const readmeContent = `# Clinic-OS Starter Kit

## 로컬 우선 시작 가이드 (Local-First)

**복잡한 설정 없이 로컬에서 바로 개발을 시작하세요.**

1. **설치**: 이 폴더에서 터미널을 열고 \`npm install\` 을 실행합니다. (Node.js 18+ 및 **Git** 필수)
2. **초기화**: \`npm run setup\` 명령어를 실행합니다.
   - 최신 코드를 Git을 통해 자동으로 받아오고 설치합니다.
   - 로컬 데이터베이스(SQLite)를 자동으로 구성합니다.
   - Cloudflare 설정은 "나중에 하기"를 선택하고 건너뜁니다.
3. **실행**: \`npm run dev\` 를 입력하면 즉시 로컬 서버가 실행됩니다.

## 업데이트 (Update)

새로운 기능이 출시되면 다음 명령어로 코어만 업데이트할 수 있습니다:
\`\`\`bash
npm run core:pull
\`\`\`

## 배포하기 (Production)

로컬 개발이 완료되어 실제 서버(Cloudflare)에 올리고 싶다면:

1. \`node scripts/setup-clinic.js\`를 다시 실행하여 마지막 단계에서 **Cloudflare 설정**을 진행합니다.
2. 또는 \`npm run deploy\` 명령어를 통해 배포 가이드를 따릅니다.

## 요구사항

- **Node.js 18+** (Windows, macOS, Linux, WSL 모두 지원)
- **Git** (코드 동기화를 위해 필수)
- **Antigravity** 솔루션
- Cloudflare 계정 (배포 시에만 필요)

## 도움이 필요하면

Antigravity에게 "/help" 입력 또는 [온라인 가이드](https://clinic-os-hq.pages.dev/guide/setup) 확인
`;
    archive.append(readmeContent, { name: 'README.md' });

    // .gitignore
    const gitignoreContent = `node_modules/
.env
data/.env
data/wrangler.toml
.docking/incoming/*.zip
.docking/staging/
archive/
dist/
*.log
.DS_Store
`;
    archive.append(gitignoreContent, { name: '.gitignore' });

    await archive.finalize();
}

createStarterKit().catch(console.error);
