/**
 * Error reporting for core:pull — .agent/last-error.json
 *
 * Agent detects this file on project open → auto recovery entry.
 * Extracted from fetch.js.
 */

import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Create error reporting context.
 * @param {Object} deps
 * @param {string} deps.projectRoot
 * @param {boolean} deps.isStarterKit
 */
export function createErrorReporting({ projectRoot, isStarterKit }) {
    let errorRecoveryModulePromise = null;

    async function loadErrorRecoveryModule() {
        if (!errorRecoveryModulePromise) {
            const moduleUrl = pathToFileURL(path.join(projectRoot, 'scripts', 'lib', 'error-recovery.mjs')).href;
            errorRecoveryModulePromise = import(moduleUrl).catch(() => null);
        }
        return errorRecoveryModulePromise;
    }

    async function reportError({ phase, error, recovery, version, command }) {
        try {
            const helpers = await loadErrorRecoveryModule();
            const resolvedCommand = command || `npm run core:pull -- ${process.argv.slice(2).join(' ')}`.trim();

            if (helpers?.recordStructuredError) {
                await helpers.recordStructuredError({
                    projectRoot,
                    phase: phase || 'unknown',
                    error,
                    command: resolvedCommand,
                    context: {
                        coreVersion: version || null,
                        isStarterKit: typeof isStarterKit !== 'undefined' ? isStarterKit : null,
                        projectRoot,
                    },
                    recovery: recovery || {
                        workflow: '.agent/workflows/troubleshooting.md',
                        commands: ['npm run health'],
                    },
                    source: 'core-pull',
                });
            } else {
                const errorReport = {
                    timestamp: new Date().toISOString(),
                    command: resolvedCommand,
                    phase: phase || 'unknown',
                    error: {
                        message: typeof error === 'string' ? error : error?.message || String(error),
                        stack: typeof error === 'object' ? error?.stack || null : null,
                        code: typeof error === 'object' ? error?.code || 'UNKNOWN' : 'UNKNOWN',
                    },
                    context: {
                        coreVersion: version || null,
                        isStarterKit: typeof isStarterKit !== 'undefined' ? isStarterKit : null,
                        projectRoot,
                    },
                    recovery: recovery || {
                        workflow: '.agent/workflows/troubleshooting.md',
                        commands: ['npm run health'],
                    },
                    attempts: [],
                };

                const errorPath = path.join(projectRoot, '.agent', 'last-error.json');
                fs.ensureDirSync(path.dirname(errorPath));
                fs.writeJsonSync(errorPath, errorReport, { spaces: 2 });
            }

            console.log('\n   ╔══════════════════════════════════════════════════╗');
            console.log('   ║  📋 에러 보고서: .agent/last-error.json         ║');
            console.log('   ║  🤖 에이전트는 이 파일을 읽고 자동 복구하세요   ║');
            console.log('   ║  📖 참조: .agent/workflows/troubleshooting.md   ║');
            console.log('   ╚══════════════════════════════════════════════════╝');
        } catch (e) {
            // 에러 보고서 저장 실패는 무시 (원래 에러가 더 중요)
        }
    }

    async function clearErrorReport() {
        try {
            const helpers = await loadErrorRecoveryModule();
            if (helpers?.clearLastError) {
                await helpers.clearLastError(projectRoot);
            } else {
                const errorPath = path.join(projectRoot, '.agent', 'last-error.json');
                if (fs.existsSync(errorPath)) {
                    fs.removeSync(errorPath);
                }
            }
        } catch (e) {
            // 삭제 실패는 무시
        }
    }

    return { reportError, clearErrorReport };
}
