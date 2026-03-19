import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { buildNpmCommand } from './lib/npm-cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

function buildDependencyHash(packageJsonPath) {
    if (!fs.existsSync(packageJsonPath)) return null;

    const pkg = fs.readJsonSync(packageJsonPath);
    const depsStr = JSON.stringify({
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {}
    });

    return createHash('md5').update(depsStr).digest('hex');
}

export function resolveCoreDependencyState(projectRoot = PROJECT_ROOT) {
    const corePath = path.join(projectRoot, 'core');
    const corePkg = path.join(corePath, 'package.json');
    const coreModules = path.join(corePath, 'node_modules');
    const hashFile = path.join(coreModules, '.deps-hash');

    if (!fs.existsSync(corePkg)) {
        return {
            corePath,
            corePkg,
            coreModules,
            hashFile,
            needsInstall: false,
            reason: 'missing-core-package'
        };
    }

    if (!fs.existsSync(coreModules)) {
        return {
            corePath,
            corePkg,
            coreModules,
            hashFile,
            needsInstall: true,
            reason: 'missing-node_modules',
            dependencyHash: buildDependencyHash(corePkg)
        };
    }

    try {
        const dependencyHash = buildDependencyHash(corePkg);
        const savedHash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : '';

        if (dependencyHash && dependencyHash !== savedHash) {
            return {
                corePath,
                corePkg,
                coreModules,
                hashFile,
                needsInstall: true,
                reason: 'dependency-hash-changed',
                dependencyHash
            };
        }
    } catch {
        const pkgMtime = fs.statSync(corePkg).mtimeMs;
        const nmMtime = fs.statSync(coreModules).mtimeMs;
        if (pkgMtime > nmMtime) {
            return {
                corePath,
                corePkg,
                coreModules,
                hashFile,
                needsInstall: true,
                reason: 'package-newer-than-node_modules'
            };
        }
    }

    return {
        corePath,
        corePkg,
        coreModules,
        hashFile,
        needsInstall: false,
        reason: 'up-to-date'
    };
}

async function preflight() {
    const dependencyState = resolveCoreDependencyState(PROJECT_ROOT);
    const { corePath, corePkg, hashFile, dependencyHash, needsInstall } = dependencyState;
    const wranglerState = path.join(PROJECT_ROOT, '.wrangler/state/v3/d1');

    // 1. Core 코드 존재 확인 — 없으면 안내 후 중단
    if (!fs.existsSync(corePkg)) {
        console.log("\n❌ Core 코드가 없습니다.");
        console.log("   → npm run setup    (초기 설치)");
        console.log("   → npm run core:pull (코어 업데이트)\n");
        process.exit(1);
    }

    // 2. 의존성 확인 — 없으면 자동 설치
    if (needsInstall) {
        console.log("📦 의존성 설치 중...");
        try {
            execSync(buildNpmCommand('install'), { stdio: 'inherit', cwd: corePath });
            if (dependencyHash) {
                fs.ensureDirSync(path.dirname(hashFile));
                fs.writeFileSync(hashFile, dependencyHash);
            }
        } catch (e) {
            console.error("❌ npm install 실패:", e.message);
            process.exit(1);
        }
    }

    // 3. DB 존재 확인 — 없으면 안내만 (dev는 DB 없이도 시작 가능)
    if (!fs.existsSync(wranglerState)) {
        console.log("\n⚠️  로컬 데이터베이스가 없습니다.");
        console.log("   → npm run db:init && npm run db:seed\n");
    }

    // 4. Check-In (HQ 핑) — 실패해도 무시
    const checkInScript = path.join(PROJECT_ROOT, 'scripts', 'check-in.js');
    if (fs.existsSync(checkInScript)) {
        try {
            execSync(`node "${checkInScript}"`, { stdio: 'inherit', cwd: PROJECT_ROOT });
        } catch (e) {
            // Ignore check-in failures
        }
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    preflight().catch(err => {
        console.error("❌ Preflight error:", err.message);
        process.exit(1);
    });
}
