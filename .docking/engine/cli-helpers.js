/**
 * CLI helpers for core:pull — user interaction, auto-mode detection, version display
 *
 * Extracted from fetch.js.
 */

/**
 * Prompt user for yes/no confirmation (auto-yes in agent/CI mode)
 */
export async function promptUserConfirmation(message = '계속 진행하시겠습니까?', autoMode = false) {
    if (autoMode || isAutoMode(process.argv.slice(2))) {
        console.log(`   🤖 Auto 모드: "${message}" → 예`);
        return true;
    }

    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${message} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

/**
 * Auto 모드 감지 — --auto flag, CI env, agent environments
 */
export function isAutoMode(args) {
    if (args.includes('--auto') || args.includes('--yes') || args.includes('-y')) return true;
    if (process.env.CI === 'true' || process.env.CI === '1') return true;
    if (process.env.CLINIC_OS_AUTO === 'true' || process.env.CLINIC_OS_AUTO === '1') return true;
    if (process.env.CLAUDE_CODE || process.env.CURSOR_SESSION || process.env.CLINE_TASK) return true;
    return false;
}

/**
 * 버전 차이 계산
 */
export function calculateVersionDiff(currentVersion, targetVersion, migrationCount = 0) {
    const parse = (v) => {
        const cleaned = (v || '0.0.0').replace(/^v/, '');
        const parts = cleaned.split('.').map(Number);
        return {
            major: parts[0] || 0,
            minor: parts[1] || 0,
            patch: parts[2] || 0
        };
    };

    const current = parse(currentVersion);
    const target = parse(targetVersion);

    return {
        major: target.major - current.major,
        minor: target.minor - current.minor,
        patch: target.patch - current.patch,
        totalMigrations: migrationCount
    };
}
