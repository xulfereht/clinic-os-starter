/**
 * Engine Updater Module
 *
 * SPEC-CORE-001: Atomic Engine Update
 *
 * 기능:
 * - Staging 디렉토리에 새 엔진 파일 추출
 * - 필수 파일 검증
 * - Atomic Swap (backup -> swap -> cleanup)
 * - 실패 시 롤백
 * - 이전 실패 잔여 복구
 *
 * 디렉토리 구조:
 * .docking/
 * ├── engine/              # 실제 엔진 파일 (런타임)
 * ├── .engine-staging/     # 임시: 새 버전 추출 (업데이트 중에만 존재)
 * └── .engine-backup/      # 임시: 롤백용 백업 (업데이트 중에만 존재)
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

// 디렉토리 경로 상수
const ENGINE_DIR = '.docking/engine';
const STAGING_DIR = '.docking/.engine-staging';
const BACKUP_DIR = '.docking/.engine-backup';

// 필수 엔진 파일 목록
const REQUIRED_FILES = ['fetch.js'];

// ═══════════════════════════════════════════════════════════════
// TASK-009: 이전 실패 잔여 복구
// ═══════════════════════════════════════════════════════════════

/**
 * TASK-009: 이전 업데이트 실패 잔여 복구
 *
 * core:pull 시작 시 호출하여 이전 실패로 인한 불일치 상태를 복구합니다.
 *
 * 복구 시나리오:
 * 1. .engine-backup 존재 + engine 비어있음 -> backup에서 복원
 * 2. .engine-staging 존재 -> staging 삭제
 * 3. .engine-backup 존재 + engine 정상 -> backup 삭제
 *
 * @param {Function} runCommand - 명령어 실행 함수
 * @returns {Promise<Object>} - 복구 결과
 */
export async function recoverFromPreviousFailure(runCommand) {
    const stagingPath = path.join(PROJECT_ROOT, STAGING_DIR);
    const backupPath = path.join(PROJECT_ROOT, BACKUP_DIR);
    const enginePath = path.join(PROJECT_ROOT, ENGINE_DIR);

    const result = {
        recovered: false,
        actions: []
    };

    try {
        const hasStaging = fs.existsSync(stagingPath);
        const hasBackup = fs.existsSync(backupPath);
        const hasEngine = fs.existsSync(enginePath);
        const engineHasFiles = hasEngine && fs.readdirSync(enginePath).length > 0;

        // Case 1: backup 있고 engine 비어있음 -> 복원 필요
        if (hasBackup && (!hasEngine || !engineHasFiles)) {
            console.log('   \u26A0\uFE0F  \uC774\uC804 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 \uAC10\uC9C0: backup\uC5D0\uC11C \uBCF5\uC6D0 \uC911...');

            if (hasEngine && !engineHasFiles) {
                fs.removeSync(enginePath);
            }

            fs.moveSync(backupPath, enginePath);
            result.recovered = true;
            result.actions.push('backup\uC5D0\uC11C engine \uBCF5\uC6D0');
            console.log('   \u2705 \uC774\uC804 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328 \uC794\uC5EC \uBCF5\uAD6C\uB428');
        }

        // Case 2: staging 디렉토리 잔여 -> 삭제
        if (hasStaging) {
            fs.removeSync(stagingPath);
            result.actions.push('staging \uB514\uB809\uD1A0\uB9AC \uC815\uB9AC');
        }

        // Case 3: backup 있고 engine 정상 -> backup 정리
        if (hasBackup && engineHasFiles) {
            fs.removeSync(backupPath);
            result.actions.push('backup \uB514\uB809\uD1A0\uB9AC \uC815\uB9AC');
        }

    } catch (error) {
        result.error = error.message;
        console.log(`   \u274C \uC794\uC5EC \uBCF5\uAD6C \uC2E4\uD328: ${error.message}`);
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
// TASK-005: Staging 추출
// ═══════════════════════════════════════════════════════════════

/**
 * TASK-005: upstream 태그에서 엔진 파일을 staging 디렉토리로 추출
 *
 * @param {string} tag - Git 태그 (예: v1.0.93)
 * @param {Array<{status: string, path: string}>} engineFiles - 엔진 파일 목록
 * @param {string} stagingPath - staging 디렉토리 경로
 * @param {Function} runCommand - 명령어 실행 함수
 * @returns {Promise<void>}
 */
export async function extractToStaging(tag, engineFiles, stagingPath, runCommand) {
    // staging 디렉토리 초기화
    if (fs.existsSync(stagingPath)) {
        fs.removeSync(stagingPath);
    }
    fs.ensureDirSync(stagingPath);

    const extracted = [];
    const deleted = [];

    for (const { status, path: filePath } of engineFiles) {
        const fileName = path.basename(filePath);

        if (status === 'D') {
            // 삭제된 파일은 staging에 마커 파일 생성
            deleted.push(fileName);
            continue;
        }

        // upstream에서 파일 내용 가져오기
        const result = await runCommand(`git show ${tag}:"${filePath}"`, true);

        if (!result.success) {
            throw new Error(`\uD30C\uC77C \uCD94\uCD9C \uC2E4\uD328: ${filePath} - ${result.stderr}`);
        }

        // staging 디렉토리에 저장
        const targetPath = path.join(stagingPath, fileName);
        fs.writeFileSync(targetPath, result.stdout);
        extracted.push(fileName);
    }

    // 삭제 목록 저장 (나중에 처리)
    if (deleted.length > 0) {
        const deleteMarkerPath = path.join(stagingPath, '.delete-list');
        fs.writeFileSync(deleteMarkerPath, deleted.join('\n'));
    }

    console.log(`   \uD83D\uDCE6 Staging \uCD94\uCD9C: ${extracted.length}\uAC1C \uD30C\uC77C${deleted.length > 0 ? `, ${deleted.length}\uAC1C \uC0AD\uC81C \uC608\uC815` : ''}`);
}

// ═══════════════════════════════════════════════════════════════
// TASK-006: Staging 검증
// ═══════════════════════════════════════════════════════════════

/**
 * TASK-006: staging 디렉토리의 필수 파일 존재 여부 검증
 *
 * @param {string} stagingPath - staging 디렉토리 경로
 * @throws {Error} - 필수 파일이 누락된 경우
 */
export function validateStaging(stagingPath) {
    const missingFiles = [];

    for (const required of REQUIRED_FILES) {
        const filePath = path.join(stagingPath, required);
        if (!fs.existsSync(filePath)) {
            missingFiles.push(required);
        }
    }

    if (missingFiles.length > 0) {
        throw new Error(`\uD544\uC218 \uD30C\uC77C \uB204\uB77D: ${missingFiles.join(', ')}`);
    }

    // 기본 파일 크기 검증 (빈 파일 방지)
    for (const required of REQUIRED_FILES) {
        const filePath = path.join(stagingPath, required);
        const stat = fs.statSync(filePath);
        if (stat.size < 100) {
            throw new Error(`\uD30C\uC77C \uD06C\uAE30 \uBE44\uC815\uC0C1: ${required} (${stat.size} bytes)`);
        }
    }

    console.log('   \u2705 Staging \uAC80\uC99D \uC644\uB8CC');
}

// ═══════════════════════════════════════════════════════════════
// TASK-007: Atomic Swap
// ═══════════════════════════════════════════════════════════════

/**
 * TASK-007: 엔진 디렉토리 Atomic Swap
 *
 * 1. 기존 engine -> backup 이동
 * 2. staging -> engine 이동
 *
 * @param {string} enginePath - 엔진 디렉토리 경로
 * @param {string} stagingPath - staging 디렉토리 경로
 * @param {string} backupPath - backup 디렉토리 경로
 * @returns {Promise<void>}
 */
export async function atomicSwap(enginePath, stagingPath, backupPath) {
    // 이전 backup 정리
    if (fs.existsSync(backupPath)) {
        fs.removeSync(backupPath);
    }

    // 삭제 목록 처리를 위한 준비
    const deleteMarkerPath = path.join(stagingPath, '.delete-list');
    let filesToDelete = [];
    if (fs.existsSync(deleteMarkerPath)) {
        filesToDelete = fs.readFileSync(deleteMarkerPath, 'utf8')
            .split('\n')
            .filter(f => f.trim().length > 0);
        fs.removeSync(deleteMarkerPath);
    }

    // 기존 엔진의 모든 파일을 backup으로 이동하지 않고,
    // 파일 단위로 교체하여 실행 중인 스크립트 영향 최소화
    fs.ensureDirSync(backupPath);

    // 1. 기존 파일 백업
    const existingFiles = fs.readdirSync(enginePath);
    for (const file of existingFiles) {
        const srcPath = path.join(enginePath, file);
        const destPath = path.join(backupPath, file);
        fs.copySync(srcPath, destPath);
    }

    // 2. staging에서 engine으로 복사 (덮어쓰기)
    const stagingFiles = fs.readdirSync(stagingPath);
    for (const file of stagingFiles) {
        const srcPath = path.join(stagingPath, file);
        const destPath = path.join(enginePath, file);
        fs.copySync(srcPath, destPath);
    }

    // 3. 삭제 대상 파일 처리
    for (const file of filesToDelete) {
        const targetPath = path.join(enginePath, file);
        if (fs.existsSync(targetPath)) {
            fs.removeSync(targetPath);
        }
    }

    // 4. staging 정리
    fs.removeSync(stagingPath);

    console.log('   \uD83D\uDD04 Atomic Swap \uC644\uB8CC');
}

// ═══════════════════════════════════════════════════════════════
// TASK-008: 롤백
// ═══════════════════════════════════════════════════════════════

/**
 * TASK-008: 엔진 롤백 (실패 시 backup에서 복원)
 *
 * @param {string} enginePath - 엔진 디렉토리 경로
 * @param {string} backupPath - backup 디렉토리 경로
 * @param {string} stagingPath - staging 디렉토리 경로
 * @returns {Promise<void>}
 */
export async function rollbackEngine(enginePath, backupPath, stagingPath) {
    try {
        // backup에서 engine 복원
        if (fs.existsSync(backupPath)) {
            // 현재 engine의 파일을 backup으로 교체
            const backupFiles = fs.readdirSync(backupPath);
            for (const file of backupFiles) {
                const srcPath = path.join(backupPath, file);
                const destPath = path.join(enginePath, file);
                fs.copySync(srcPath, destPath);
            }

            fs.removeSync(backupPath);
            console.log('   \uD83D\uDD04 \uAE30\uC874 \uC5D4\uC9C4 \uBCF5\uC6D0 \uC644\uB8CC');
        }

        // staging 정리
        if (fs.existsSync(stagingPath)) {
            fs.removeSync(stagingPath);
        }

    } catch (error) {
        console.log(`   \u274C \uB864\uBC31 \uC2E4\uD328: ${error.message}`);
        console.log('   \u26A0\uFE0F  \uC218\uB3D9 \uBCF5\uAD6C\uAC00 \uD544\uC694\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
        console.log(`   \u26A0\uFE0F  backup \uC704\uCE58: ${backupPath}`);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════
// 메인 함수: Atomic Engine Update
// ═══════════════════════════════════════════════════════════════

/**
 * Atomic Engine Update
 *
 * 엔진 파일을 안전하게 업데이트합니다.
 * 실패 시 자동으로 이전 버전으로 롤백됩니다.
 *
 * @param {string} tag - Git 태그
 * @param {Array<{status: string, path: string}>} engineFiles - 엔진 파일 목록
 * @param {Function} runCommand - 명령어 실행 함수
 * @returns {Promise<Object>} - 업데이트 결과
 */
export async function atomicEngineUpdate(tag, engineFiles, runCommand) {
    const stagingPath = path.join(PROJECT_ROOT, STAGING_DIR);
    const backupPath = path.join(PROJECT_ROOT, BACKUP_DIR);
    const enginePath = path.join(PROJECT_ROOT, ENGINE_DIR);

    if (engineFiles.length === 0) {
        return { success: true, skipped: true };
    }

    console.log(`\n\u2699\uFE0F  \uC5D4\uC9C4 Atomic Update \uC2DC\uC791 (${engineFiles.length}\uAC1C \uD30C\uC77C)`);

    try {
        // Phase 1: Staging 추출
        await extractToStaging(tag, engineFiles, stagingPath, runCommand);

        // Phase 2: Staging 검증
        validateStaging(stagingPath);

        // Phase 3: Atomic Swap
        await atomicSwap(enginePath, stagingPath, backupPath);

        // Phase 4: Cleanup (backup 삭제)
        if (fs.existsSync(backupPath)) {
            fs.removeSync(backupPath);
        }

        console.log('   \u2705 \uC5D4\uC9C4 Atomic Update \uC644\uB8CC');

        return {
            success: true,
            filesUpdated: engineFiles.length
        };

    } catch (error) {
        console.log(`   \u26A0\uFE0F  \uC5D4\uC9C4 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328: ${error.message}`);

        // 롤백 시도
        try {
            await rollbackEngine(enginePath, backupPath, stagingPath);
        } catch (rollbackError) {
            // 롤백도 실패하면 심각한 상황
            return {
                success: false,
                error: error.message,
                rollbackError: rollbackError.message,
                requiresManualRecovery: true
            };
        }

        return {
            success: false,
            error: error.message,
            rolledBack: true
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════

export default {
    recoverFromPreviousFailure,
    extractToStaging,
    validateStaging,
    atomicSwap,
    rollbackEngine,
    atomicEngineUpdate
};
