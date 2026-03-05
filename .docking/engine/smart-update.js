// ═══════════════════════════════════════════════════════════════
// Zero-Interaction Mode & Smart Update Strategy
// ═══════════════════════════════════════════════════════════════

/**
 * Auto 모드 감지
 * --auto 플래그 또는 CI/CLINIC_OS_AUTO 환경 변수
 */
function isAutoMode(args) {
    if (args.includes('--auto')) return true;
    if (process.env.CI === 'true' || process.env.CI === '1') return true;
    if (process.env.CLINIC_OS_AUTO === 'true' || process.env.CLINIC_OS_AUTO === '1') return true;
    return false;
}

/**
 * 버전 차이 계산
 * @returns {Object} { major, minor, patch, totalMigrations }
 */
function calculateVersionDiff(currentVersion, targetVersion, migrationCount = 0) {
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

/**
 * 업데이트 전략 선택
 * - major diff >= 1 또는 migrations > 10개: 'fresh-with-migration'
 * - 그 외: 'incremental'
 */
async function selectUpdateStrategy(currentVersion, targetVersion, currentTag, targetTag) {
    // 마이그레이션 개수 계산
    const migrationResult = await runCommand(
        `git diff --name-only ${currentTag} ${targetTag} -- migrations/`,
        true
    );
    const migrationCount = migrationResult.success
        ? migrationResult.stdout.split('\n').filter(f => f.endsWith('.sql')).length
        : 0;

    const diff = calculateVersionDiff(currentVersion, targetVersion, migrationCount);

    // 전략 결정
    const isMajorUpdate = diff.major >= 1;
    const isManyMigrations = migrationCount > 10;

    if (isMajorUpdate || isManyMigrations) {
        return {
            type: 'fresh-with-migration',
            backup: true,
            extractClientChanges: true,
            schemaReset: true,
            reason: isMajorUpdate
                ? `Major version diff (${diff.major})`
                : `Too many migrations (${migrationCount} > 10)`
        };
    }

    return {
        type: 'incremental',
        backup: false,
        extractClientChanges: false,
        schemaReset: false,
        reason: `Minor update (${diff.major}.${diff.minor}.${diff.patch}, migrations: ${migrationCount})`
    };
}

/**
 * 클라이언트 변경사항 추출
 * - git diff upstream/current HEAD --name-only로 변경 파일 목록 획득
 * - 코어 파일만 필터링 (isCorePath && !isLocalPath)
 * - 각 파일의 diff를 .core/client-changes/YYYYMMDD-HHMMSS/에 저장
 */
async function extractClientChanges(currentTag) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const changesDir = path.join(PROJECT_ROOT, '.core', 'client-changes', timestamp);

    console.log(`\n📦 클라이언트 변경사항 추출 중...`);

    // 변경 파일 목록 획득
    const diffResult = await runCommand(
        `git diff upstream/${currentTag} HEAD --name-only`,
        true
    );

    if (!diffResult.success || !diffResult.stdout) {
        console.log('   ⚠️  변경사항 추출 실패');
        return { changes: [], changesDir: null, timestamp };
    }

    const allFiles = diffResult.stdout.split('\n').filter(Boolean);

    // 코어 파일만 필터링
    const coreModifications = allFiles.filter(f =>
        isCorePath(f) && !isLocalPath(f) && !isProtectedPath(f)
    );

    if (coreModifications.length === 0) {
        console.log('   ℹ️  추출할 클라이언트 변경사항 없음');
        return { changes: [], changesDir: null, timestamp };
    }

    // 변경사항 저장 디렉토리 생성
    fs.ensureDirSync(changesDir);

    const changes = [];
    for (const file of coreModifications) {
        // diff 추출
        const diffResult = await runCommand(
            `git diff upstream/${currentTag} HEAD -- "${file}"`,
            true
        );

        if (diffResult.success && diffResult.stdout) {
            const diff = diffResult.stdout;
            const changeInfo = {
                file,
                diff,
                type: diff.startsWith('new file') ? 'add' : diff.includes('deleted file') ? 'delete' : 'modify',
                suggestedLocalPath: suggestLocalPath(file)
            };
            changes.push(changeInfo);

            // diff 파일로 저장
            const safeFileName = file.replace(/[\/\\]/g, '_');
            fs.writeFileSync(
                path.join(changesDir, `${safeFileName}.diff`),
                diff,
                'utf8'
            );
        }
    }

    // manifest.json 생성
    const manifest = {
        timestamp,
        extractedAt: new Date().toISOString(),
        currentTag,
        changes: changes.map(c => ({
            file: c.file,
            type: c.type,
            suggestedLocalPath: c.suggestedLocalPath
        }))
    };
    fs.writeJsonSync(path.join(changesDir, 'manifest.json'), manifest, { spaces: 2 });

    console.log(`   ✅ ${changes.length}개 파일 추출 완료: .core/client-changes/${timestamp}/`);

    return { changes, changesDir, timestamp };
}

/**
 * 백업 태그 생성
 */
async function createBackupTag(currentVersion) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    const tagName = `backup/pre-update-${currentVersion}-${timestamp}`;

    console.log(`\n🏷️  백업 태그 생성 중...`);

    const result = await runCommand(
        `git tag -a "${tagName}" -m "Auto backup before core update from ${currentVersion}"`,
        true
    );

    if (result.success) {
        console.log(`   ✅ 백업 태그: ${tagName}`);
        return tagName;
    } else {
        console.log(`   ⚠️  백업 태그 생성 실패: ${result.stderr}`);
        return null;
    }
}

/**
 * 추출된 변경사항을 local/* 경로로 마이그레이션
 */
async function migrateChangesToLocal(changes, autoMode = false) {
    if (!changes || changes.length === 0) return { migrated: [], skipped: [] };

    console.log(`\n🔄 변경사항을 local/* 경로로 마이그레이션...`);

    const migrated = [];
    const skipped = [];

    for (const change of changes) {
        const { file, suggestedLocalPath } = change;

        // 현재 파일 내용 가져오기
        const sourcePath = path.join(PROJECT_ROOT, toLocalPath(file));
        if (!fs.existsSync(sourcePath)) {
            skipped.push({ file, reason: 'Source file not found' });
            continue;
        }

        // 대상 경로
        const targetPath = path.join(PROJECT_ROOT, suggestedLocalPath);

        // 이미 존재하면 스킵 (덮어쓰기 방지)
        if (fs.existsSync(targetPath)) {
            skipped.push({ file, reason: 'Target already exists' });
            continue;
        }

        // 디렉토리 생성 및 파일 복사
        fs.ensureDirSync(path.dirname(targetPath));
        fs.copySync(sourcePath, targetPath);

        migrated.push({ file, localPath: suggestedLocalPath });
        console.log(`   ✅ ${file} → ${suggestedLocalPath}`);
    }

    console.log(`   → 마이그레이션: ${migrated.length}개, 스킵: ${skipped.length}개`);

    return { migrated, skipped };
}

/**
 * Fresh install with migration 전략 실행
 */
async function executeFreshWithMigration(currentVersion, targetVersion, options = {}) {
    const { dryRun = false, forceBootstrap = false, autoMode = false } = options;

    console.log('\n═══════════════════════════════════════════════');
    console.log('🔄 Fresh-with-Migration 전략 실행');
    console.log('═══════════════════════════════════════════════\n');

    // 1. 클라이언트 변경사항 추출
    const { changes, changesDir, timestamp } = await extractClientChanges(currentVersion);

    // 2. 현재 버전 백업 태그 생성
    let backupTag = null;
    if (!dryRun) {
        backupTag = await createBackupTag(currentVersion);
    }

    // 3. 새 버전 클린 설치
    console.log(`\n📥 새 버전 클린 설치: ${targetVersion}`);

    // core 파일들을 새 버전으로 복원
    const filesResult = await runCommand(
        `git ls-tree -r --name-only upstream/${targetVersion} -- ${CORE_PATHS.join(' ')}`,
        true
    );

    if (filesResult.success && filesResult.stdout) {
        const files = filesResult.stdout.split('\n').filter(Boolean);

        if (!dryRun) {
            let appliedCount = 0;
            for (const file of files) {
                if (isProtectedPath(file) || isLocalPath(file)) continue;

                try {
                    if (isBinaryFile(file)) {
                        await restoreBinaryFromUpstream(targetVersion, file);
                    } else {
                        await restoreFileFromUpstream(targetVersion, file);
                    }
                    appliedCount++;
                } catch (e) {
                    console.log(`   ⚠️  ${file}: ${e.message}`);
                }
            }
            console.log(`   ✅ ${appliedCount}개 파일 설치 완료`);
        } else {
            console.log(`   [DRY-RUN] ${files.length}개 파일 설치 예정`);
        }
    }

    // 4. 추출한 변경사항을 local/* 경로로 마이그레이션
    if (changes.length > 0 && !dryRun) {
        await migrateChangesToLocal(changes, autoMode);
    }

    // 5. package.json 머지
    if (!dryRun) {
        await mergePackageJson(targetVersion);
    }

    // 6. 마이그레이션 실행
    if (!dryRun) {
        await runAllMigrations(forceBootstrap);
        await runAllSeeds();
    }

    // 7. 버전 업데이트
    if (!dryRun) {
        await writeCoreVersion(targetVersion);
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ Fresh-with-Migration 완료');
    if (changesDir) {
        console.log(`📦 변경사항 백업: .core/client-changes/${timestamp}/`);
    }
    if (backupTag) {
        console.log(`🏷️  복구 태그: ${backupTag}`);
    }
    console.log('═══════════════════════════════════════════════\n');

    return { success: true, changes, backupTag };
}
