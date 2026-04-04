export function buildLocalDbBootstrapReport(options = {}) {
    const {
        skipped = false,
        skipReason = null,
        hasMigrationFiles = true,
        migrationResult = null,
        schemaResult = null,
        seedResults = [],
    } = options;

    if (skipped) {
        return {
            ok: true,
            skipped: true,
            issues: [],
            warnings: skipReason ? [skipReason] : [],
        };
    }

    const issues = [];
    const warnings = [];

    if (!hasMigrationFiles) {
        issues.push('로컬 DB 마이그레이션 파일을 찾을 수 없습니다.');
    }

    if (!migrationResult) {
        issues.push('로컬 DB 마이그레이션 결과를 확인하지 못했습니다.');
    } else if (!migrationResult.success) {
        const applied = Number(migrationResult.applied || 0);
        const failed = Number(migrationResult.failed || 0);
        issues.push(`로컬 DB 마이그레이션 실패: ${applied}개 성공, ${failed}개 실패`);

        for (const entry of migrationResult.errors || []) {
            if (!entry) continue;
            const file = entry.file || 'unknown';
            const error = entry.error || 'unknown error';
            issues.push(`${file}: ${error}`);
        }
    }

    if (schemaResult && !schemaResult.ok) {
        const missingTables = schemaResult.missing?.tables?.length || 0;
        const missingColumns = schemaResult.missing?.columns?.length || 0;

        if (missingTables > 0 || missingColumns > 0) {
            issues.push(`로컬 DB 스키마 검증 실패: 테이블 ${missingTables}개, 컬럼 ${missingColumns}개 누락`);
        } else if (schemaResult.error) {
            issues.push(`로컬 DB 스키마 검증 실패: ${schemaResult.error}`);
        } else {
            issues.push('로컬 DB 스키마 검증 실패');
        }
    }

    for (const seed of seedResults) {
        if (!seed) continue;
        if (seed.ok || seed.required === false) {
            if (!seed.ok && seed.error) {
                warnings.push(`선택 시드 실패 (${seed.name}): ${seed.error}`);
            }
            continue;
        }

        if (seed.error) {
            issues.push(`시드 실패 (${seed.name}): ${seed.error}`);
        } else {
            issues.push(`시드 실패 (${seed.name})`);
        }
    }

    return {
        ok: issues.length === 0,
        skipped: false,
        issues,
        warnings,
    };
}
