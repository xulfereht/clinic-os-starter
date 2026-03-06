#!/usr/bin/env node
/**
 * Clinic-OS Core Repair Script
 *
 * core/ 폴더가 깨진 경우 (submodule 문제 등) 복구하는 스크립트
 *
 * Usage: npm run core:repair
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

async function repairCore() {
    console.log('\n🔧 Clinic-OS Core 복구 시작...\n');

    const corePath = path.join(PROJECT_ROOT, 'core');
    const gitModulesPath = path.join(PROJECT_ROOT, '.git', 'modules', 'core');
    const gitmodulesFile = path.join(PROJECT_ROOT, '.gitmodules');

    // 1. 현재 상태 진단
    console.log('📋 현재 상태 진단...');

    const coreExists = fs.existsSync(corePath);
    const coreIsEmpty = coreExists && fs.readdirSync(corePath).length === 0;
    const coreHasGit = coreExists && fs.existsSync(path.join(corePath, '.git'));
    const gitModulesExists = fs.existsSync(gitModulesPath);

    console.log(`   - core/ 폴더: ${coreExists ? (coreIsEmpty ? '비어있음 ⚠️' : '존재') : '없음'}`);
    console.log(`   - core/.git: ${coreHasGit ? '있음 (제거 필요)' : '없음 ✓'}`);
    console.log(`   - .git/modules/core: ${gitModulesExists ? '있음 (submodule 흔적)' : '없음 ✓'}`);

    // 2. Submodule 참조 제거
    if (gitModulesExists) {
        console.log('\n🧹 Submodule 참조 제거 중...');
        try {
            fs.removeSync(gitModulesPath);
            console.log('   ✓ .git/modules/core 제거됨');
        } catch (e) {
            console.log(`   ⚠️ 제거 실패: ${e.message}`);
        }
    }

    // 3. .gitmodules 파일에서 core 제거
    if (fs.existsSync(gitmodulesFile)) {
        try {
            let content = fs.readFileSync(gitmodulesFile, 'utf8');
            if (content.includes('[submodule "core"]')) {
                content = content.replace(/\[submodule "core"\][^\[]*/, '');
                fs.writeFileSync(gitmodulesFile, content.trim());
                console.log('   ✓ .gitmodules에서 core 참조 제거됨');
            }
        } catch (e) {
            // 무시
        }
    }

    // 4. Git index에서 core submodule 제거
    try {
        execSync('git rm --cached core 2>/dev/null || true', {
            cwd: PROJECT_ROOT,
            stdio: 'pipe'
        });
        console.log('   ✓ Git index에서 core 제거됨');
    } catch (e) {
        // 무시 - 이미 없을 수 있음
    }

    // 5. core 폴더 제거
    if (coreExists) {
        console.log('\n🗑️  기존 core/ 폴더 제거 중...');
        try {
            fs.removeSync(corePath);
            console.log('   ✓ core/ 폴더 제거됨');
        } catch (e) {
            console.log(`   ❌ 제거 실패: ${e.message}`);
            console.log('   수동으로 rm -rf core 실행 후 다시 시도해주세요.');
            process.exit(1);
        }
    }

    // 6. Setup 실행하여 core 재설치
    console.log('\n🚀 Core 재설치 중 (npm run setup)...\n');
    console.log('─'.repeat(50));

    try {
        execSync('npm run setup -- --auto', {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
        });
    } catch (e) {
        console.log('\n⚠️  Setup 중 오류가 발생했습니다.');
        console.log('수동으로 npm run setup을 실행해주세요.');
        process.exit(1);
    }

    console.log('\n─'.repeat(50));
    console.log('\n✅ Core 복구 완료!\n');
    console.log('다음 명령어로 개발 서버를 시작하세요:');
    console.log('   npm run dev\n');
}

repairCore().catch(err => {
    console.error('❌ 복구 실패:', err.message);
    process.exit(1);
});
