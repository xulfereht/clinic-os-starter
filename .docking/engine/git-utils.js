/**
 * Git utilities for core:pull operations
 *
 * Extracted from fetch.js to reduce coupling.
 * All functions receive projectRoot as parameter (no global state).
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Run a shell command in the project root
 */
export async function runCommand(cmd, projectRoot, silent = false, timeoutMs = 120000) {
    if (!silent) console.log(`   > ${cmd}`);
    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: projectRoot,
            maxBuffer: 10 * 1024 * 1024,
            timeout: timeoutMs
        });
        return { success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' };
    } catch (error) {
        const stdout = error.stdout?.trim() || '';
        const stderr = error.stderr?.trim() || error.message || '';
        return { success: false, stdout, stderr };
    }
}

/**
 * AbortController-based fetch with timeout
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Check if working directory has uncommitted changes
 */
export async function isDirty(projectRoot) {
    const result = await runCommand('git status --porcelain', projectRoot, true);
    return result.stdout.length > 0;
}

/**
 * Check if upstream remote exists
 */
export async function hasUpstreamRemote(projectRoot) {
    const result = await runCommand('git remote get-url upstream', projectRoot, true);
    return result.success;
}

/**
 * Ensure upstream remote is configured (auto-register if missing)
 */
export async function ensureUpstreamRemote(gitUrl, projectRoot) {
    const hasUpstream = await hasUpstreamRemote(projectRoot);

    if (hasUpstream) {
        const updateResult = await runCommand(`git remote set-url upstream "${gitUrl}"`, projectRoot, true);
        if (updateResult.success) {
            console.log('   ✅ upstream URL 업데이트 완료');
        }
        return true;
    }

    console.log('   ⚠️  upstream remote가 없습니다. 자동 등록 중...');
    const addResult = await runCommand(`git remote add upstream "${gitUrl}"`, projectRoot, true);
    if (!addResult.success) {
        console.log(`   ❌ upstream 등록 실패: ${addResult.stderr}`);
        return false;
    }

    await runCommand('git remote set-url --push upstream DISABLE', projectRoot, true);
    console.log('   ✅ upstream remote 자동 등록 완료');
    return true;
}

/**
 * Check if there are staged changes
 */
export async function hasStagedChanges(projectRoot) {
    const result = await runCommand('git diff --cached --name-only', projectRoot, true);
    return result.stdout.length > 0;
}

/**
 * Create WIP snapshot commit before core:pull
 */
export async function createWipSnapshot(projectRoot) {
    console.log('📸 현재 상태 스냅샷(WIP) 저장 중...');
    await runCommand('git add -A', projectRoot, true);

    if (!(await hasStagedChanges(projectRoot))) {
        console.log('   ℹ️  staged 변경이 없어 WIP 커밋을 생략합니다.');
        return;
    }

    await runCommand('git commit -m "WIP: core:pull 전 자동 스냅샷" --no-verify', projectRoot, true);
    console.log('   ✅ WIP 스냅샷 저장 완료');
}

/**
 * Assert that a git tag exists
 */
export async function assertTagExists(tag, projectRoot) {
    const result = await runCommand(`git rev-parse --verify refs/tags/${tag}`, projectRoot, true);
    if (!result.success) {
        throw new Error(`코어 태그 ${tag}를 찾을 수 없습니다. upstream에 해당 태그가 있는지 확인하세요.`);
    }
}

/**
 * Get file changes between two git tags for given paths
 */
export async function gitDiffNameStatus(fromTag, toTag, corePaths, projectRoot) {
    const pathsArg = corePaths.map(p => `"${p}"`).join(' ');
    const result = await runCommand(
        `git diff --name-status ${fromTag} ${toTag} -- ${pathsArg}`,
        projectRoot, true
    );
    if (!result.stdout) return [];

    return result.stdout.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t');
        const status = parts[0].charAt(0); // M, A, D, R, C
        if (status === 'R' || status === 'C') {
            return { status, oldPath: parts[1], path: parts[2] };
        }
        return { status, path: parts.slice(1).join('\t') };
    });
}

/**
 * Get list of changed file names between two refs
 */
export async function gitDiffNameOnly(fromRef, toRef, paths, projectRoot) {
    const pathsArg = paths.map(p => `"${p}"`).join(' ');
    const result = await runCommand(
        `git diff --name-only ${fromRef}..${toRef} -- ${pathsArg}`,
        projectRoot, true
    );
    if (!result.success || !result.stdout) return [];
    return result.stdout.split('\n').filter(Boolean);
}
