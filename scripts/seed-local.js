#!/usr/bin/env node
/**
 * Local Database Seeder
 *
 * 로컬 D1 데이터베이스에 샘플 데이터를 시딩합니다.
 * wrangler.toml에서 DB 이름을 동적으로 읽어 사용합니다.
 *
 * Usage:
 *   npm run db:seed              # 로컬 DB에 시드 적용
 *   npm run db:seed -- --remote  # 리모트 DB에 시드 적용 (주의!)
 *
 * @see ARCHITECTURE.md#4-데이터베이스
 * @see seeds/sample_clinic.sql - 메인 시드 파일
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// 기본 설정
const DEFAULT_DB_NAME = 'clinic-os-db';

/**
 * wrangler.toml에서 DB 이름 가져오기
 */
function getDbName() {
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) return match[1];
    }
    return DEFAULT_DB_NAME;
}

/**
 * 명령어 실행 헬퍼
 */
function runCommand(cmd) {
    return new Promise((resolve) => {
        exec(cmd, { cwd: PROJECT_ROOT, shell: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, stdout: '', stderr: stderr || error.message });
                return;
            }
            resolve({ success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' });
        });
    });
}

/**
 * 시드 파일 실행
 */
async function executeSeed(filePath, dbName, localFlag) {
    if (!fs.existsSync(filePath)) {
        return { success: false, error: `파일 없음: ${filePath}` };
    }

    const result = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} --file="${filePath}" --yes`
    );

    if (!result.success) {
        // UNIQUE constraint 오류는 무시 (이미 존재하는 데이터)
        if (result.stderr?.includes('UNIQUE constraint') || result.stderr?.includes('already exists')) {
            return { success: true, skipped: true };
        }
        return { success: false, error: result.stderr };
    }

    return { success: true };
}

/**
 * 시드 파일 경로 찾기 (PROJECT_ROOT → core 순서)
 */
function findSeedFile(relativePath) {
    const localPath = path.join(PROJECT_ROOT, relativePath);
    if (fs.existsSync(localPath)) return localPath;

    const corePath = path.join(PROJECT_ROOT, 'core', relativePath);
    if (fs.existsSync(corePath)) return corePath;

    return null;
}

async function main() {
    const args = process.argv.slice(2);
    const isLocal = !args.includes('--remote');
    const localFlag = isLocal ? '--local' : '--remote';
    const dbName = getDbName();

    console.log('🌱 Clinic-OS Local Seeder\n');
    console.log(`   DB: ${dbName}`);
    console.log(`   Mode: ${isLocal ? 'Local' : 'Remote'}`);
    console.log('');

    if (!isLocal) {
        console.log('⚠️  리모트 DB에 시드를 적용합니다. 10초 후 진행됩니다...');
        console.log('   취소하려면 Ctrl+C를 누르세요.\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // 메인 시드 파일
    const mainSeed = findSeedFile('seeds/sample_clinic.sql');

    // 추가 시드 파일 (setup-clinic.js와 동일한 순서)
    const additionalSeeds = [
        'seeds/terms_definitions.sql',
        'seeds/terms_versions.sql',
        'seeds/default_pages.sql',
        'seeds/prepare_samples.sql',
        'seeds/program_translations_sample.sql',
        'seeds/seed_manuals.sql',
        'seeds/seed_system_manuals.sql',
        'seeds/seed_templates.sql',
        'seeds/seed_patient_tags.sql',
        'seeds/sample_ops_data.sql',
        'seeds/sample_patients.sql',
        'seeds/sample_faqs.sql',
        'seeds/dummy_posts.sql',
        'seeds/dummy_reviews.sql',
        'seeds/sample_notices.sql',
        'seeds/knowledge_seed.sql'
    ];

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    // 메인 시드 실행
    if (mainSeed) {
        console.log('📦 메인 시드 적용 중...');
        const result = await executeSeed(mainSeed, dbName, localFlag);
        if (result.success) {
            if (result.skipped) {
                console.log(`   ⏭️  sample_clinic.sql (일부 스킵됨)`);
                skipCount++;
            } else {
                console.log(`   ✓ sample_clinic.sql`);
                successCount++;
            }
        } else {
            console.log(`   ✗ sample_clinic.sql: ${result.error}`);
            failCount++;
        }
    } else {
        console.log('⚠️  메인 시드 파일(seeds/sample_clinic.sql)을 찾을 수 없습니다.');
    }

    // 추가 시드 실행
    console.log('\n📦 추가 시드 적용 중...');
    for (const seedRelPath of additionalSeeds) {
        const seedPath = findSeedFile(seedRelPath);
        const fileName = path.basename(seedRelPath);

        if (!seedPath) {
            console.log(`   ⏭️  ${fileName} (파일 없음)`);
            continue;
        }

        const result = await executeSeed(seedPath, dbName, localFlag);
        if (result.success) {
            if (result.skipped) {
                console.log(`   ⏭️  ${fileName} (스킵됨)`);
                skipCount++;
            } else {
                console.log(`   ✓ ${fileName}`);
                successCount++;
            }
        } else {
            console.log(`   ✗ ${fileName}: ${result.error}`);
            failCount++;
        }
    }

    // 결과 요약
    console.log('\n' + '─'.repeat(40));
    console.log(`✅ 성공: ${successCount}  ⏭️ 스킵: ${skipCount}  ❌ 실패: ${failCount}`);

    if (failCount > 0) {
        console.log('\n⚠️  일부 시드가 실패했습니다. 위 오류를 확인하세요.');
        process.exit(1);
    } else {
        console.log('\n🎉 시딩 완료!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('❌ 오류:', err);
    process.exit(1);
});
