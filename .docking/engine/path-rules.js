/**
 * Path classification rules for core:pull operations
 *
 * Single SOT for: which files are core, local, protected, special merge.
 * Loads from protection-manifest.yaml (SOT), falls back to hardcoded values.
 *
 * Extracted from fetch.js — B1: path config centralization.
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Load all path rules from protection-manifest.yaml
 * @param {string} projectRoot - Project root directory
 * @returns {Object} All path classification rules
 */
export function loadPathRules(projectRoot) {
    let CORE_PATHS, LOCAL_PREFIXES, PROTECTED_EXACT, PROTECTED_PREFIXES, SPECIAL_MERGE_FILES;

    try {
        const manifestPath = path.join(projectRoot, '.docking/protection-manifest.yaml');
        const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8'));
        CORE_PATHS = manifest.core_paths;
        LOCAL_PREFIXES = manifest.local_prefixes;
        PROTECTED_EXACT = new Set(manifest.protected_exact);
        PROTECTED_PREFIXES = manifest.protected_prefixes;
        SPECIAL_MERGE_FILES = new Set(manifest.special_merge);
    } catch (e) {
        // Fallback: bootstrap or manifest missing
        CORE_PATHS = [
            'src/pages/', 'src/components/', 'src/layouts/', 'src/styles/',
            'src/lib/', 'src/skins/', 'src/plugins/survey-tools/',
            'src/survey-tools/stress-check/', 'src/content/aeo/',
            'migrations/', 'seeds/', 'docs/',
            '.agent/README.md', '.agent/manifests/',
            '.agent/onboarding-registry.json', '.agent/workflows/',
            '.claude/commands/', '.claude/rules/',
            'scripts/', '.docking/engine/', 'package.json', 'astro.config.mjs',
            'tsconfig.json',
        ];
        LOCAL_PREFIXES = [
            'src/lib/local/', 'src/skins/local/', 'src/plugins/local/', 'src/pages/_local/',
            'src/survey-tools/local/', 'public/local/', 'docs/internal/',
        ];
        PROTECTED_EXACT = new Set([
            'wrangler.toml', 'clinic.json', '.docking/config.yaml',
            'src/config.ts', 'src/styles/global.css',
            '.agent/onboarding-state.json',
            '.claude/settings.json',
        ]);
        PROTECTED_PREFIXES = ['.env', '.core/', 'src/plugins/local/', 'src/plugins/custom-homepage/'];
        SPECIAL_MERGE_FILES = new Set(['package.json']);
    }

    // Dynamic protection: client config.yaml protected_pages/prefixes
    const CLIENT_PROTECTED_PAGES = new Set();
    const CLIENT_PROTECTED_PREFIXES = [];

    const configPath = path.join(projectRoot, '.docking/config.yaml');
    if (fs.existsSync(configPath)) {
        try {
            const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
            for (const page of (config?.protected_pages || [])) {
                CLIENT_PROTECTED_PAGES.add(page);
            }
            for (const prefix of (config?.protected_prefixes || [])) {
                CLIENT_PROTECTED_PREFIXES.push(prefix);
            }
            if (CLIENT_PROTECTED_PAGES.size > 0 || CLIENT_PROTECTED_PREFIXES.length > 0) {
                console.log(`   📋 클라이언트 보호 설정 로드: ${CLIENT_PROTECTED_PAGES.size}개 페이지, ${CLIENT_PROTECTED_PREFIXES.length}개 prefix`);
            }
        } catch (e) {
            console.log(`   ⚠️  config.yaml 로드 실패: ${e.message}`);
        }
    }

    return {
        CORE_PATHS,
        LOCAL_PREFIXES,
        PROTECTED_EXACT,
        PROTECTED_PREFIXES,
        SPECIAL_MERGE_FILES,
        CLIENT_PROTECTED_PAGES,
        CLIENT_PROTECTED_PREFIXES,

        isLocalPath(filePath) {
            return LOCAL_PREFIXES.some(prefix => filePath.startsWith(prefix));
        },

        isProtectedPath(filePath) {
            if (PROTECTED_EXACT.has(filePath)) return true;
            if (PROTECTED_PREFIXES.some(prefix => filePath.startsWith(prefix))) return true;
            if (CLIENT_PROTECTED_PAGES.has(filePath)) return true;
            return CLIENT_PROTECTED_PREFIXES.some(prefix => filePath.startsWith(prefix));
        },

        isSpecialMergeFile(filePath) {
            return SPECIAL_MERGE_FILES.has(filePath);
        },

        isCorePath(filePath) {
            return CORE_PATHS.some(corePath => filePath.startsWith(corePath));
        },
    };
}

/**
 * Detect if running in starter kit structure (core/ submodule)
 */
export function detectStarterKit(projectRoot) {
    const corePackageJson = path.join(projectRoot, 'core', 'package.json');
    const isStarterKit = fs.existsSync(corePackageJson);
    const coreDir = isStarterKit ? 'core/' : '';
    return { isStarterKit, coreDir };
}

/**
 * Convert upstream path to local path (starter kit: add core/ prefix for app paths)
 */
export function toLocalPath(upstreamPath, isStarterKit, coreDir) {
    if (!isStarterKit) return upstreamPath;

    const appPaths = ['src/', 'migrations/', 'seeds/', 'public/'];
    if (appPaths.some(p => upstreamPath.startsWith(p))) {
        return coreDir + upstreamPath;
    }

    const appConfigFiles = ['tsconfig.json', 'astro.config.mjs', 'package.json'];
    if (appConfigFiles.includes(upstreamPath)) {
        return coreDir + upstreamPath;
    }

    return upstreamPath;
}

/**
 * Convert local path back to upstream path
 */
export function toUpstreamPath(localPath, isStarterKit, coreDir) {
    if (!isStarterKit) return localPath;
    if (localPath.startsWith(coreDir)) {
        return localPath.slice(coreDir.length);
    }
    return localPath;
}

/**
 * Check if a file is binary (should use git show + pipe instead of text restore)
 */
export function isBinaryFile(filePath) {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        '.pdf', '.zip', '.tar', '.gz',
        '.mp3', '.mp4', '.wav', '.ogg', '.webm'
    ];
    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
}

/**
 * Suggest local safe path for a core file (for migration guidance)
 */
export function suggestLocalPath(filePath) {
    // 페이지는 _local/ 오버라이드 (Vite 플러그인 자동 적용)
    // 단, admin 페이지는 제외 (Core 버전을 항상 사용)
    if (filePath.startsWith('src/pages/')) {
        if (filePath.startsWith('src/pages/admin/')) {
            return null;
        }
        return filePath.replace('src/pages/', 'src/pages/_local/');
    }
    if (filePath.startsWith('src/components/')) {
        return filePath.replace('src/components/', 'src/plugins/local/components/');
    }
    if (filePath.startsWith('src/lib/')) {
        return filePath.replace('src/lib/', 'src/lib/local/');
    }
    if (filePath.startsWith('src/layouts/')) {
        return filePath.replace('src/layouts/', 'src/plugins/local/layouts/');
    }
    return `src/plugins/local/${filePath}`;
}
