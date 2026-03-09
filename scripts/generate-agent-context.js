#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, '.agent', 'runtime-context.json');

function safeReadJson(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return fs.readJsonSync(filePath);
    } catch {
        return fallback;
    }
}

function safeReadText(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch {
        return fallback;
    }
}

function detectAppRoot() {
    const starterAppRoot = path.join(PROJECT_ROOT, 'core');
    if (fs.existsSync(path.join(starterAppRoot, 'package.json'))) {
        return starterAppRoot;
    }
    return PROJECT_ROOT;
}

function walkFiles(dir) {
    if (!fs.existsSync(dir)) return [];

    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

function toProjectRelative(filePath) {
    return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
}

function listRelativeFiles(dir) {
    return walkFiles(dir).map(toProjectRelative).sort();
}

function summarizeWorkspace(relativePath, files, workflow = null, guide = null) {
    return {
        path: relativePath,
        file_count: files.length,
        has_content: files.length > 0,
        workflow,
        guide,
    };
}

function summarizeSetup(progress) {
    if (!progress?.steps || !Array.isArray(progress.steps)) {
        return {
            exists: false,
            total: 0,
            done: 0,
            pending: 0,
            in_progress: null
        };
    }

    const done = progress.steps.filter((step) => step.status === 'done').length;
    const pending = progress.steps.filter((step) => step.status === 'pending').length;
    const inProgress = progress.steps.find((step) => step.status === 'in_progress')?.id || null;

    return {
        exists: true,
        total: progress.steps.length,
        done,
        pending,
        in_progress: inProgress
    };
}

function summarizeOnboarding(state) {
    if (!state?.features || typeof state.features !== 'object') {
        return {
            exists: false,
            current_tier: null,
            pending: 0,
            completed: 0
        };
    }

    const values = Object.values(state.features);
    return {
        exists: true,
        current_tier: state.current_tier || null,
        pending: values.filter((item) => item?.status === 'pending').length,
        completed: values.filter((item) => item?.status === 'done').length
    };
}

function summarizeLocalPlugins(pluginDir) {
    if (!fs.existsSync(pluginDir)) return [];

    return fs.readdirSync(pluginDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const manifestPath = path.join(pluginDir, entry.name, 'manifest.json');
            const manifest = safeReadJson(manifestPath, {});
            return {
                id: manifest.id || entry.name,
                name: manifest.name || entry.name,
                path: toProjectRelative(path.join(pluginDir, entry.name))
            };
        })
        .sort((a, b) => a.path.localeCompare(b.path));
}

function summarizeSkinPacks(skinDir) {
    if (!fs.existsSync(skinDir)) return [];

    return fs.readdirSync(skinDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const manifestPath = path.join(skinDir, entry.name, 'manifest.json');
            const manifest = safeReadJson(manifestPath, {});
            return {
                id: manifest.id || entry.name,
                name: manifest.name || entry.name,
                extends: manifest.extends || null,
                path: toProjectRelative(path.join(skinDir, entry.name))
            };
        })
        .sort((a, b) => a.path.localeCompare(b.path));
}

function summarizeProtection(manifest) {
    return {
        core_paths: manifest?.core_paths || [],
        local_prefixes: manifest?.local_prefixes || [],
        protected_exact: manifest?.protected_exact || [],
        protected_prefixes: manifest?.protected_prefixes || []
    };
}

function inferStage(setupSummary, onboardingSummary, hasLastError) {
    if (hasLastError) return 'error_recovery';
    if (setupSummary.exists && setupSummary.pending > 0) return 'setup_in_progress';
    if (setupSummary.exists && setupSummary.pending === 0 && onboardingSummary.exists && onboardingSummary.pending > 0) {
        return 'onboarding';
    }
    if (setupSummary.exists && setupSummary.pending === 0) return 'operational';
    return 'pre_setup';
}

function buildRuntimeContext() {
    const appRoot = detectAppRoot();
    const appPackage = safeReadJson(path.join(appRoot, 'package.json'), {});
    const rootPackage = safeReadJson(path.join(PROJECT_ROOT, 'package.json'), {});
    const protectionManifest = (() => {
        const manifestPath = path.join(PROJECT_ROOT, '.docking', 'protection-manifest.yaml');
        if (!fs.existsSync(manifestPath)) return null;
        return yaml.load(fs.readFileSync(manifestPath, 'utf8'));
    })();

    const setupProgress = safeReadJson(path.join(PROJECT_ROOT, '.agent', 'setup-progress.json'));
    const onboardingState = safeReadJson(path.join(PROJECT_ROOT, '.agent', 'onboarding-state.json'));
    const lastError = safeReadJson(path.join(PROJECT_ROOT, '.agent', 'last-error.json'));

    const setupSummary = summarizeSetup(setupProgress);
    const onboardingSummary = summarizeOnboarding(onboardingState);

    const pageOverrides = listRelativeFiles(path.join(appRoot, 'src', 'pages', '_local'));
    const localLibFiles = listRelativeFiles(path.join(appRoot, 'src', 'lib', 'local'));
    const localSkinPacks = summarizeSkinPacks(path.join(appRoot, 'src', 'skins', 'local'));
    const localPluginFiles = summarizeLocalPlugins(path.join(appRoot, 'src', 'plugins', 'local'));
    const localSurveyToolFiles = summarizeLocalPlugins(path.join(appRoot, 'src', 'survey-tools', 'local'));
    const localStaticAssets = listRelativeFiles(path.join(appRoot, 'public', 'local'));
    const internalDocs = listRelativeFiles(path.join(appRoot, 'docs', 'internal'));
    const appRootRelative = appRoot === PROJECT_ROOT ? '.' : toProjectRelative(appRoot);
    const resolvedPaths = {
        app_root: appRootRelative,
        page_overrides: toProjectRelative(path.join(appRoot, 'src', 'pages', '_local')),
        local_lib: toProjectRelative(path.join(appRoot, 'src', 'lib', 'local')),
        local_skins: toProjectRelative(path.join(appRoot, 'src', 'skins', 'local')),
        local_plugins: toProjectRelative(path.join(appRoot, 'src', 'plugins', 'local')),
        local_survey_tools: toProjectRelative(path.join(appRoot, 'src', 'survey-tools', 'local')),
        public_local_assets: toProjectRelative(path.join(appRoot, 'public', 'local')),
        internal_docs: toProjectRelative(path.join(appRoot, 'docs', 'internal')),
        admin_pages: toProjectRelative(path.join(appRoot, 'src', 'pages', 'admin')),
        public_pages: toProjectRelative(path.join(appRoot, 'src', 'pages'))
    };

    return {
        version: 1,
        generated_at: new Date().toISOString(),
        project_root: PROJECT_ROOT,
        app_root: appRoot,
        stage: inferStage(setupSummary, onboardingSummary, !!lastError),
        repo: {
            root_package_version: rootPackage.version || null,
            app_package_version: appPackage.version || null,
            core_version: safeReadText(path.join(PROJECT_ROOT, '.core', 'version')),
            starter_version: safeReadText(path.join(PROJECT_ROOT, '.core', 'starter-version')),
            is_starter_kit: appRoot !== PROJECT_ROOT,
            app_root_relative: appRootRelative
        },
        state: {
            has_node_modules: fs.existsSync(path.join(PROJECT_ROOT, 'node_modules')),
            setup: setupSummary,
            onboarding: onboardingSummary,
            last_error: lastError ? {
                phase: lastError.phase || null,
                command: lastError.command || null,
                timestamp: lastError.timestamp || null
            } : null
        },
        must_read: [
            'AGENTS.md',
            '.agent/workflows/first-contact.md',
            '.agent/manifests/change-strategy.json',
            '.agent/manifests/local-workspaces.json',
            '.agent/manifests/admin-public-bindings.json',
            '.agent/workflows/local-customization-agentic.md',
            '.claude/rules/clinic-os-safety.md'
        ],
        manifests: {
            change_strategy: '.agent/manifests/change-strategy.json',
            local_workspaces: '.agent/manifests/local-workspaces.json',
            admin_public_bindings: '.agent/manifests/admin-public-bindings.json'
        },
        workflows: {
            first_contact: '.agent/workflows/first-contact.md',
            local_customization: '.agent/workflows/local-customization-agentic.md',
            skins: '.agent/workflows/skins-agentic.md',
            plugins: '.agent/workflows/plugin-agentic.md',
            survey_tools: '.agent/workflows/survey-tools-agentic.md',
            troubleshooting: '.agent/workflows/troubleshooting.md'
        },
        resolved_paths: resolvedPaths,
        protection: summarizeProtection(protectionManifest),
        local_customizations: {
            page_overrides: pageOverrides,
            local_lib_files: localLibFiles,
            local_skin_packs: localSkinPacks,
            local_plugins: localPluginFiles,
            local_survey_tools: localSurveyToolFiles,
            local_static_assets: localStaticAssets,
            internal_docs: internalDocs
        },
        workspace_summary: {
            page_overrides: summarizeWorkspace(
                resolvedPaths.page_overrides,
                pageOverrides,
                '.agent/workflows/local-customization-agentic.md',
                'docs/LOCAL_WORKSPACES_GUIDE.md'
            ),
            local_lib: summarizeWorkspace(
                resolvedPaths.local_lib,
                localLibFiles,
                '.agent/workflows/local-customization-agentic.md',
                'docs/LOCAL_WORKSPACES_GUIDE.md'
            ),
            local_skins: summarizeWorkspace(
                resolvedPaths.local_skins,
                localSkinPacks.map((skin) => skin.path),
                '.agent/workflows/skins-agentic.md',
                'docs/SKIN_SYSTEM_GUIDE.md'
            ),
            local_plugins: summarizeWorkspace(
                resolvedPaths.local_plugins,
                localPluginFiles.map((plugin) => plugin.path),
                '.agent/workflows/plugin-agentic.md',
                'docs/PLUGIN_DEVELOPMENT_GUIDE.md'
            ),
            local_survey_tools: summarizeWorkspace(
                resolvedPaths.local_survey_tools,
                localSurveyToolFiles.map((tool) => tool.path),
                '.agent/workflows/survey-tools-agentic.md',
                'docs/SURVEY_TOOLS_GUIDE.md'
            ),
            public_local_assets: summarizeWorkspace(
                resolvedPaths.public_local_assets,
                localStaticAssets,
                '.agent/workflows/local-customization-agentic.md',
                'docs/LOCAL_WORKSPACES_GUIDE.md'
            ),
            internal_docs: summarizeWorkspace(
                resolvedPaths.internal_docs,
                internalDocs,
                '.agent/workflows/local-customization-agentic.md',
                'docs/LOCAL_WORKSPACES_GUIDE.md'
            )
        },
        agent_rules: {
            first_question: '이 요청이 로컬 커스터마이징인지 중앙 패치인지 먼저 분류한다.',
            local_workspace_selector: '.agent/manifests/local-workspaces.json',
            patch_shared_contracts_first: true,
            admin_pages_are_core_managed: true,
            if_runtime_context_is_stale: 'npm run agent:context'
        },
        high_signal_paths: {
            clinic_settings_loader: toProjectRelative(path.join(appRoot, 'src', 'lib', 'clinic.ts')),
            dynamic_pages_loader: toProjectRelative(path.join(appRoot, 'src', 'lib', 'dynamic-pages.ts')),
            translation_loader: toProjectRelative(path.join(appRoot, 'src', 'lib', 'i18n.ts')),
            skin_loader: toProjectRelative(path.join(appRoot, 'src', 'lib', 'skin-loader.ts')),
            skin_store_admin_page: toProjectRelative(path.join(appRoot, 'src', 'pages', 'admin', 'skins', 'store.astro')),
            skin_store_install_api: toProjectRelative(path.join(appRoot, 'src', 'pages', 'api', 'admin', 'skins', 'install.ts')),
            skin_store_uninstall_api: toProjectRelative(path.join(appRoot, 'src', 'pages', 'api', 'admin', 'skins', 'uninstall.ts')),
            skin_submit_cli: 'scripts/skin-submit.js',
            survey_tools_loader: toProjectRelative(path.join(appRoot, 'src', 'lib', 'survey-tools-loader.ts')),
            settings_api: toProjectRelative(path.join(appRoot, 'src', 'pages', 'api', 'admin', 'settings.ts')),
            middleware: toProjectRelative(path.join(appRoot, 'src', 'middleware.ts'))
        }
    };
}

function main() {
    const args = new Set(process.argv.slice(2));
    const context = buildRuntimeContext();
    const quiet = args.has('--quiet');

    if (args.has('--stdout')) {
        console.log(JSON.stringify(context, null, 2));
        return;
    }

    fs.ensureDirSync(path.dirname(OUTPUT_PATH));
    fs.writeJsonSync(OUTPUT_PATH, context, { spaces: 2 });
    if (!quiet) {
        console.log(`✅ Agent runtime context generated: ${toProjectRelative(OUTPUT_PATH)}`);
    }
}

main();
