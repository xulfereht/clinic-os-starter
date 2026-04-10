/**
 * Conflict detection, resolution, and package.json merge for core:pull
 *
 * Handles: drift detection, real conflict filtering, file restore from upstream,
 * backup, migration guide, package.json policy-based merge.
 *
 * Extracted from fetch.js.
 */

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Create conflict detection context bound to a project.
 * @param {Object} deps
 * @param {string} deps.projectRoot
 * @param {boolean} deps.isStarterKit
 * @param {string[]} deps.CORE_PATHS
 * @param {Function} deps.runCommand - Bound runCommand(cmd, silent, timeout)
 * @param {Function} deps.toLocalPath
 * @param {Function} deps.isProtectedPath
 * @param {Function} deps.isLocalPath
 * @param {Function} deps.suggestLocalPath
 */
export function createConflictDetection({ projectRoot, isStarterKit, CORE_PATHS, runCommand, toLocalPath, isProtectedPath, isLocalPath, suggestLocalPath }) {

    function intersect(arr1, arr2) {
        const set2 = new Set(arr2);
        return arr1.filter(item => set2.has(item));
    }

    /**
     * Drift 감지: upstream과 로컬이 다른 파일 찾기
     */
    async function detectDriftedFiles(targetTag, alreadyInDiff) {
        const diffSet = new Set(alreadyInDiff);
        const drifted = [];

        const result = await runCommand(`git ls-tree -r --name-only ${targetTag}`, true);
        if (!result.success || !result.stdout) return drifted;

        const allUpstreamFiles = result.stdout.split('\n').filter(Boolean);

        const candidates = allUpstreamFiles.filter(f => {
            if (diffSet.has(f)) return false;
            if (isProtectedPath(f)) return false;
            if (isLocalPath(f)) return false;
            return CORE_PATHS.some(cp => f.startsWith(cp));
        });

        for (const upstreamPath of candidates) {
            const localPath = toLocalPath(upstreamPath);
            const fullLocalPath = path.join(projectRoot, localPath);

            if (!fs.existsSync(fullLocalPath)) {
                drifted.push(upstreamPath);
                continue;
            }

            if (/\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|svg|mp4|webm|pdf)$/i.test(upstreamPath)) continue;

            try {
                const { stdout: upstreamContent } = await execAsync(
                    `git show ${targetTag}:"${upstreamPath}"`,
                    { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }
                );

                const localContent = fs.readFileSync(fullLocalPath, 'utf8');
                if (localContent.trim() !== upstreamContent.trim()) {
                    drifted.push(upstreamPath);
                }
            } catch {
                continue;
            }
        }

        return drifted;
    }

    /**
     * 실제 내용이 다른 충돌만 필터링
     */
    async function filterRealConflicts(conflicts, targetTag) {
        const realConflicts = [];
        const alreadySynced = [];

        for (const upstreamPath of conflicts) {
            const localPath = toLocalPath(upstreamPath);
            const fullLocalPath = path.join(projectRoot, localPath);

            if (!fs.existsSync(fullLocalPath)) {
                continue;
            }

            const result = await runCommand(`git show ${targetTag}:"${upstreamPath}"`, true);
            if (!result.success) {
                realConflicts.push(upstreamPath);
                continue;
            }

            const upstreamContent = result.stdout;
            const localContent = fs.readFileSync(fullLocalPath, 'utf8');

            const normalizedUpstream = upstreamContent.replace(/\r\n/g, '\n').trim();
            const normalizedLocal = localContent.replace(/\r\n/g, '\n').trim();

            if (normalizedUpstream === normalizedLocal) {
                alreadySynced.push(upstreamPath);
            } else {
                realConflicts.push(upstreamPath);
            }
        }

        return { realConflicts, alreadySynced };
    }

    /**
     * upstream 태그에서 파일 내용을 가져와 로컬 경로에 저장
     */
    async function restoreFileFromUpstream(tag, upstreamPath) {
        const localPath = toLocalPath(upstreamPath);
        const fullLocalPath = path.join(projectRoot, localPath);

        try {
            const { stdout } = await execAsync(
                `git show ${tag}:"${upstreamPath}"`,
                { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }
            );

            fs.ensureDirSync(path.dirname(fullLocalPath));
            fs.writeFileSync(fullLocalPath, stdout);
            return true;
        } catch (e) {
            console.log(`   ⚠️  ${upstreamPath}: 파일 내용을 가져올 수 없음`);
            return false;
        }
    }

    /**
     * upstream 태그에서 바이너리 파일을 가져와 로컬 경로에 저장
     */
    async function restoreBinaryFromUpstream(tag, upstreamPath) {
        const localPath = toLocalPath(upstreamPath);
        const fullLocalPath = path.join(projectRoot, localPath);

        const result = await execAsync(
            `git show ${tag}:"${upstreamPath}"`,
            { cwd: projectRoot, encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }
        );

        fs.ensureDirSync(path.dirname(fullLocalPath));
        fs.writeFileSync(fullLocalPath, result.stdout);
        return true;
    }

    async function backupModifiedFiles(conflicts, currentVersion, targetVersion) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
        const backupDir = path.join(projectRoot, `.core-backup/${dateStr}_${timeStr}`);

        console.log(`\n📦 충돌 파일 백업 중... (${conflicts.length}개 파일)`);
        fs.ensureDirSync(backupDir);

        const manifest = {
            date: new Date().toISOString(),
            previousVersion: currentVersion,
            newVersion: targetVersion,
            files: [],
            migrationGuide: 'AI에게 "백업 확인하고 local로 이전해줘"라고 요청하세요.'
        };

        for (const file of conflicts) {
            const localFile = toLocalPath(file);
            const srcPath = path.join(projectRoot, localFile);
            const destPath = path.join(backupDir, file);

            if (fs.existsSync(srcPath)) {
                fs.ensureDirSync(path.dirname(destPath));
                fs.copySync(srcPath, destPath);
                manifest.files.push({
                    path: file,
                    localPath: localFile,
                    suggestedLocalPath: suggestLocalPath(file)
                });
                console.log(`   📄 ${localFile}`);
            }
        }

        fs.writeJsonSync(path.join(backupDir, 'manifest.json'), manifest, { spaces: 2 });
        console.log(`   📁 백업 완료: ${backupDir}`);

        return backupDir;
    }

    function printMigrationGuide(conflicts, backupDir) {
        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log('│  ⚠️  코어 파일 충돌 발생                                       │');
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log(`│  충돌 파일 ${conflicts.length}개가 백업되었습니다.`);
        console.log(`│  백업 위치: ${backupDir.replace(projectRoot, '.')}`);
        console.log('│                                                             │');
        console.log('│  💡 페이지(src/pages/) 충돌은 자동으로 _local/에 보존됩니다.  │');
        console.log('│  빌드 시 _local/ 버전이 우선 적용됩니다.                     │');
        console.log('│  ⚠️  단, admin 페이지는 Core 버전을 항상 사용합니다.          │');
        console.log('│                                                             │');
        console.log('│  기타 파일 충돌은 수동 이전이 필요합니다:                     │');
        console.log('│  1. .core-backup/*/manifest.json 확인                       │');
        console.log('│  2. 변경 내용을 src/lib/local/ 등으로 이동                   │');
        console.log('│  3. 백업 폴더 삭제                                          │');
        console.log('│                                                             │');
        console.log('│  또는 AI에게 "백업 확인하고 local로 이전해줘"                 │');
        console.log('└─────────────────────────────────────────────────────────────┘');
    }

    async function mergePackageJson(targetTag) {
        const localPkgPath = isStarterKit
            ? path.join(projectRoot, 'core', 'package.json')
            : path.join(projectRoot, 'package.json');

        const localPkg = fs.readJsonSync(localPkgPath);
        const localBackup = JSON.parse(JSON.stringify(localPkg));

        const result = await runCommand(`git show ${targetTag}:package.json`, true);
        if (!result.success) {
            console.log(`   ⚠️  upstream package.json을 읽을 수 없습니다. 스킵합니다.`);
            return;
        }

        let upstreamPkg;
        try {
            upstreamPkg = JSON.parse(result.stdout);
        } catch (e) {
            console.log(`   ⚠️  upstream package.json 파싱 실패. 스킵합니다.`);
            return;
        }

        const merged = { ...localPkg };

        // HQ 소유 필드: upstream 우선
        const hqOwnedFields = ['engines', 'packageManager', 'type', 'bin', 'version'];
        for (const field of hqOwnedFields) {
            if (upstreamPkg[field] !== undefined) {
                merged[field] = upstreamPkg[field];
            }
        }

        // Scripts 머지
        const upstreamScripts = upstreamPkg.scripts || {};
        const localScripts = localPkg.scripts || {};
        merged.scripts = { ...upstreamScripts };

        const preservedScripts = [];
        for (const [key, value] of Object.entries(localScripts)) {
            if (!(key in upstreamScripts)) {
                merged.scripts[key] = value;
                preservedScripts.push(key);
            }
        }

        if (preservedScripts.length > 0) {
            console.log(`   📌 클라이언트 스크립트 보존: ${preservedScripts.join(', ')}`);
            const nonPrefixed = preservedScripts.filter(s => !s.startsWith('local:'));
            if (nonPrefixed.length > 0) {
                console.log(`   💡 팁: 커스텀 스크립트는 'local:' 접두사 권장 (예: local:${nonPrefixed[0]})`);
            }
        }

        // HQ 전용 스크립트 제거
        const hqOnlyScripts = ['core:push', 'core:push:stable', 'starter:push', 'publish', 'hq:deploy', 'release'];
        for (const script of hqOnlyScripts) {
            delete merged.scripts[script];
        }

        // dependencies 머지
        merged.dependencies = mergeDeps(localPkg.dependencies || {}, upstreamPkg.dependencies || {});
        merged.devDependencies = mergeDeps(localPkg.devDependencies || {}, upstreamPkg.devDependencies || {});

        try {
            fs.writeJsonSync(localPkgPath, merged, { spaces: 4 });
            console.log(`   ✅ package.json 머지 완료`);

            const addedDeps = countNewDeps(localPkg.dependencies, merged.dependencies);
            const addedDevDeps = countNewDeps(localPkg.devDependencies, merged.devDependencies);
            if (addedDeps > 0 || addedDevDeps > 0) {
                console.log(`   📦 새 의존성: deps=${addedDeps}, devDeps=${addedDevDeps}`);
            }

            // 스타터킷: 루트 package.json 동기화
            if (isStarterKit && merged.version) {
                const rootPkgPath = path.join(projectRoot, 'package.json');
                if (fs.existsSync(rootPkgPath)) {
                    const rootPkg = fs.readJsonSync(rootPkgPath);
                    let rootUpdated = false;

                    if (rootPkg.version !== merged.version) {
                        rootPkg.version = merged.version;
                        rootUpdated = true;
                    }

                    if (merged.scripts) {
                        rootPkg.scripts = rootPkg.scripts || {};
                        for (const [key, value] of Object.entries(merged.scripts)) {
                            if (!(key in rootPkg.scripts)) {
                                rootPkg.scripts[key] = value;
                                rootUpdated = true;
                            }
                        }
                    }

                    if (rootUpdated) {
                        fs.writeJsonSync(rootPkgPath, rootPkg, { spaces: 4 });
                        console.log(`   🔄 루트 package.json 동기화: v${merged.version}`);
                    }
                }
            }
        } catch (e) {
            fs.writeJsonSync(localPkgPath, localBackup, { spaces: 4 });
            console.log(`   ❌ package.json 머지 실패, 원본 복구됨: ${e.message}`);
        }
    }

    function mergeDeps(localDeps, upstreamDeps) {
        const merged = { ...localDeps };
        for (const [pkg, version] of Object.entries(upstreamDeps)) {
            merged[pkg] = version;
        }
        return merged;
    }

    function countNewDeps(oldDeps = {}, newDeps = {}) {
        let count = 0;
        for (const pkg of Object.keys(newDeps)) {
            if (!(pkg in oldDeps)) count++;
        }
        return count;
    }

    return {
        intersect,
        detectDriftedFiles,
        filterRealConflicts,
        restoreFileFromUpstream,
        restoreBinaryFromUpstream,
        backupModifiedFiles,
        printMigrationGuide,
        mergePackageJson,
    };
}
