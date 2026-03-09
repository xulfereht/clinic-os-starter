/**
 * Atomic Update Manager
 * Blue-Green deployment for clinic-os core updates
 */

import { promises as fs, constants as fsConstants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { getNpmCommandParts } from '../../scripts/lib/npm-cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Validation results structure
 * @typedef {Object} ValidationResults
 * @property {boolean} build - Build test passed
 * @property {boolean} migrations - Migration dry-run passed
 * @property {boolean} tests - Unit tests passed
 * @property {boolean} schema - Schema validation passed
 */

/**
 * Update state structure
 * @typedef {Object} UpdateState
 * @property {string} id - Update ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} fromVersion - Current version before update
 * @property {string} toVersion - Target version
 * @property {string} status - 'preparing' | 'validating' | 'swapping' | 'completed' | 'failed' | 'rolled_back'
 * @property {string} worktreePath - Path to green worktree
 * @property {string} backupPath - Path to backup
 * @property {ValidationResults} validationResults - Validation results
 * @property {string} [error] - Error message if failed
 */

export class AtomicUpdateManager {
    constructor(projectRoot) {
        this.root = projectRoot || process.cwd();
        this.atomicDir = path.join(this.root, '.core', 'atomic-update');
        this.stateFile = path.join(this.atomicDir, 'state.json');
        this.greenDir = path.join(this.atomicDir, 'green-worktree');
        this.backupDir = path.join(this.atomicDir, 'backup');
    }

    /**
     * Initialize atomic update directories
     */
    async init() {
        await fs.mkdir(this.atomicDir, { recursive: true });
        await fs.mkdir(this.greenDir, { recursive: true });
        await fs.mkdir(this.backupDir, { recursive: true });
    }

    /**
     * Load current state
     */
    async loadState() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf-8');
            return JSON.parse(data);
        } catch {
            return { updates: [], current: null };
        }
    }

    /**
     * Save state
     */
    async saveState(state) {
        await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
        await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    }

    /**
     * Get current core version
     */
    async getCurrentVersion() {
        try {
            const versionFile = path.join(this.root, '.core', 'version');
            const version = await fs.readFile(versionFile, 'utf-8');
            return version.trim();
        } catch {
            return 'unknown';
        }
    }

    /**
     * Generate update ID
     */
    generateUpdateId() {
        const now = new Date();
        const date = now.toISOString().split('T')[0].replace(/-/g, '');
        const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
        return `upd-${date}-${time}`;
    }

    /**
     * Create Git worktree for new version
     * @param {string} version - Target version (tag or branch)
     * @returns {Promise<string>} Worktree path
     */
    async createWorktree(version) {
        const updateId = this.generateUpdateId();
        const worktreePath = path.join(this.greenDir, updateId);

        console.log(`🌲 Creating worktree: ${worktreePath}`);

        // Check if we're in a git repo
        try {
            execSync('git rev-parse --git-dir', { cwd: this.root, stdio: 'pipe' });
        } catch {
            throw new Error('Not a git repository. Atomic updates require git.');
        }

        // Create worktree
        try {
            execSync(`git worktree add --detach "${worktreePath}"`, {
                cwd: this.root,
                stdio: 'pipe'
            });
        } catch (error) {
            throw new Error(`Failed to create worktree: ${error.message}`);
        }

        // Checkout target version if specified
        if (version && version !== 'HEAD') {
            try {
                execSync(`git fetch origin`, { cwd: worktreePath, stdio: 'pipe' });
                execSync(`git checkout "${version}"`, { cwd: worktreePath, stdio: 'pipe' });
            } catch (error) {
                // Clean up worktree on failure
                await this.removeWorktree(worktreePath);
                throw new Error(`Failed to checkout ${version}: ${error.message}`);
            }
        }

        console.log(`✅ Worktree created at: ${worktreePath}`);
        return worktreePath;
    }

    /**
     * Remove a worktree
     */
    async removeWorktree(worktreePath) {
        try {
            execSync(`git worktree remove "${worktreePath}" --force`, {
                cwd: this.root,
                stdio: 'pipe'
            });
        } catch (error) {
            // Fallback: manual removal
            try {
                await fs.rm(worktreePath, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        }
    }

    /**
     * Install dependencies in worktree
     */
    async installDependencies(worktreePath) {
        console.log('📦 Installing dependencies...');

        return new Promise((resolve, reject) => {
            const npmCommand = getNpmCommandParts(['ci']);
            const npm = spawn(npmCommand.command, npmCommand.args, {
                cwd: worktreePath,
                stdio: 'pipe'
            });

            let output = '';
            npm.stdout.on('data', (data) => {
                output += data.toString();
            });
            npm.stderr.on('data', (data) => {
                output += data.toString();
            });

            npm.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`npm ci failed with code ${code}\n${output}`));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Validate the worktree (build, test, migrations)
     * @param {string} worktreePath - Path to green worktree
     * @param {Object} options - Validation options
     * @returns {Promise<ValidationResults>}
     */
    async validate(worktreePath, options = {}) {
        const results = {
            build: false,
            migrations: false,
            tests: false,
            schema: false
        };

        console.log('🧪 Starting validation...');

        // 1. Build test
        console.log('  🔨 Testing build...');
        try {
            await this.runBuild(worktreePath);
            results.build = true;
            console.log('  ✅ Build passed');
        } catch (error) {
            console.error('  ❌ Build failed:', error.message);
        }

        // 2. Migration dry-run
        console.log('  🗄️  Testing migrations (dry-run)...');
        try {
            await this.runMigrations(worktreePath, { dryRun: true });
            results.migrations = true;
            console.log('  ✅ Migrations passed');
        } catch (error) {
            console.error('  ❌ Migrations failed:', error.message);
        }

        // 3. Unit tests
        if (!options.skipTests) {
            console.log('  🧪 Running unit tests...');
            try {
                await this.runTests(worktreePath);
                results.tests = true;
                console.log('  ✅ Tests passed');
            } catch (error) {
                console.error('  ❌ Tests failed:', error.message);
            }
        } else {
            console.log('  ⏭️  Skipping tests (--skip-tests)');
            results.tests = true;
        }

        // 4. Schema validation
        console.log('  📋 Validating schema...');
        try {
            await this.validateSchema(worktreePath);
            results.schema = true;
            console.log('  ✅ Schema valid');
        } catch (error) {
            console.error('  ❌ Schema validation failed:', error.message);
        }

        const allPassed = Object.values(results).every(r => r);
        console.log(allPassed ? '\n✅ All validations passed' : '\n❌ Some validations failed');

        return results;
    }

    /**
     * Run build in worktree
     */
    async runBuild(worktreePath) {
        return new Promise((resolve, reject) => {
            const npm = spawn('npm', ['run', 'build'], {
                cwd: worktreePath,
                stdio: 'pipe',
                env: { ...process.env, CI: 'true' }
            });

            let output = '';
            npm.stdout.on('data', (data) => { output += data.toString(); });
            npm.stderr.on('data', (data) => { output += data.toString(); });

            npm.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Build failed with code ${code}`));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Run migrations in worktree
     */
    async runMigrations(worktreePath, options = {}) {
        const args = ['run', 'db:migrate'];
        if (options.dryRun) {
            args.push('--');
            args.push('--dry-run');
        }

        return new Promise((resolve, reject) => {
            const npm = spawn('npm', args, {
                cwd: worktreePath,
                stdio: 'pipe'
            });

            let output = '';
            npm.stdout.on('data', (data) => { output += data.toString(); });
            npm.stderr.on('data', (data) => { output += data.toString(); });

            npm.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Migration failed with code ${code}`));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Run tests in worktree
     */
    async runTests(worktreePath) {
        return new Promise((resolve, reject) => {
            const npm = spawn('npm', ['test'], {
                cwd: worktreePath,
                stdio: 'pipe',
                env: { ...process.env, CI: 'true' }
            });

            let output = '';
            npm.stdout.on('data', (data) => { output += data.toString(); });
            npm.stderr.on('data', (data) => { output += data.toString(); });

            npm.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Tests failed with code ${code}`));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Validate schema
     */
    async validateSchema(worktreePath) {
        const schemaPath = path.join(worktreePath, '.docking', 'schema.json');
        try {
            await fs.access(schemaPath, fsConstants.F_OK);
            const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
            if (!schema.version) {
                throw new Error('Schema missing version field');
            }
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                // No schema file - that's ok for some setups
                return true;
            }
            throw error;
        }
    }

    /**
     * Backup current state before update
     */
    async backupCurrentState() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `pre-update-${timestamp}`);

        console.log(`💾 Creating backup: ${backupPath}`);

        await fs.mkdir(backupPath, { recursive: true });

        // Backup critical directories
        const dirsToBackup = ['src', 'core', '.docking', 'scripts'];
        const filesToBackup = ['package.json', 'package-lock.json', 'astro.config.mjs'];

        for (const dir of dirsToBackup) {
            const srcPath = path.join(this.root, dir);
            const destPath = path.join(backupPath, dir);
            try {
                await this.copyDir(srcPath, destPath);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }

        for (const file of filesToBackup) {
            const srcPath = path.join(this.root, file);
            const destPath = path.join(backupPath, file);
            try {
                await fs.copyFile(srcPath, destPath);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }

        // Save version info
        const currentVersion = await this.getCurrentVersion();
        await fs.writeFile(
            path.join(backupPath, '.backup-meta.json'),
            JSON.stringify({
                timestamp: new Date().toISOString(),
                version: currentVersion
            }, null, 2)
        );

        console.log(`✅ Backup created at: ${backupPath}`);
        return backupPath;
    }

    /**
     * Copy directory recursively
     */
    async copyDir(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
                    await this.copyDir(srcPath, destPath);
                }
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    /**
     * Perform atomic swap between current (Blue) and new (Green)
     * @param {Object} params
     * @param {string} params.from - Current path (Blue)
     * @param {string} params.to - New path (Green)
     * @param {string} params.backup - Backup path
     */
    async atomicSwap({ from, to, backup }) {
        console.log('🔄 Performing atomic swap...');
        console.log(`   From: ${from}`);
        console.log(`   To: ${to}`);
        console.log(`   Backup: ${backup}`);

        // Validate paths exist
        await fs.access(from, fsConstants.F_OK);
        await fs.access(to, fsConstants.F_OK);

        // Directories to swap
        const swapDirs = ['src', 'core', '.docking', 'scripts'];
        const swapFiles = ['package.json', 'package-lock.json'];

        // Create swap staging area
        const swapId = `swap-${Date.now()}`;
        const stagingDir = path.join(this.atomicDir, 'staging', swapId);
        await fs.mkdir(stagingDir, { recursive: true });

        try {
            for (const dir of swapDirs) {
                const currentPath = path.join(from, dir);
                const newPath = path.join(to, dir);
                const stagingPath = path.join(stagingDir, dir);
                const backupPath = path.join(backup, dir);

                // Check if new version has this directory
                try {
                    await fs.access(newPath, fsConstants.F_OK);
                } catch {
                    console.log(`   ⏭️  ${dir} not in new version, skipping`);
                    continue;
                }

                // Step 1: Move current to staging
                try {
                    await fs.access(currentPath, fsConstants.F_OK);
                    await fs.rename(currentPath, stagingPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                }

                // Step 2: Move new to current location
                await fs.rename(newPath, currentPath);

                // Step 3: Move staging to backup
                try {
                    await fs.rename(stagingPath, backupPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Warning: Could not backup ${dir}: ${error.message}`);
                    }
                }

                console.log(`   ✅ Swapped: ${dir}`);
            }

            // Handle files
            for (const file of swapFiles) {
                const currentFile = path.join(from, file);
                const newFile = path.join(to, file);
                const backupFile = path.join(backup, file);

                try {
                    await fs.access(newFile, fsConstants.F_OK);

                    // Backup current if exists
                    try {
                        await fs.access(currentFile, fsConstants.F_OK);
                        await fs.copyFile(currentFile, backupFile);
                    } catch {
                        // Current doesn't exist
                    }

                    // Copy new version
                    await fs.copyFile(newFile, currentFile);
                    console.log(`   ✅ Updated: ${file}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Warning: Could not swap ${file}: ${error.message}`);
                    }
                }
            }

            // Cleanup staging
            await fs.rm(path.join(this.atomicDir, 'staging', swapId), { recursive: true, force: true });

            console.log('✅ Atomic swap completed successfully');
        } catch (error) {
            // Attempt emergency recovery
            console.error('❌ Swap failed:', error.message);
            throw error;
        }
    }

    /**
     * Rollback to a specific backup
     * @param {string} [backupPath] - Specific backup path, or latest if not specified
     */
    async rollback(backupPath) {
        console.log('⏮️  Starting rollback...');

        // Find backup if not specified
        if (!backupPath) {
            const backups = await this.listBackups();
            if (backups.length === 0) {
                throw new Error('No backups available for rollback');
            }
            backupPath = backups[backups.length - 1].path;
        }

        console.log(`📂 Rolling back to: ${backupPath}`);

        // Verify backup exists
        await fs.access(backupPath, fsConstants.F_OK);

        // Create emergency backup of current state
        const emergencyBackup = path.join(
            this.backupDir,
            `emergency-${new Date().toISOString().replace(/[:.]/g, '-')}`
        );

        try {
            console.log('💾 Creating emergency backup...');
            await this.backupCurrentState();
        } catch (error) {
            console.warn('Warning: Could not create emergency backup:', error.message);
        }

        // Restore from backup
        const dirsToRestore = ['src', 'core', '.docking', 'scripts'];
        const filesToRestore = ['package.json', 'package-lock.json'];

        for (const dir of dirsToRestore) {
            const srcPath = path.join(backupPath, dir);
            const destPath = path.join(this.root, dir);

            try {
                await fs.access(srcPath, fsConstants.F_OK);
                await fs.rm(destPath, { recursive: true, force: true });
                await this.copyDir(srcPath, destPath);
                console.log(`   ✅ Restored: ${dir}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`Warning: Could not restore ${dir}: ${error.message}`);
                }
            }
        }

        for (const file of filesToRestore) {
            const srcPath = path.join(backupPath, file);
            const destPath = path.join(this.root, file);

            try {
                await fs.access(srcPath, fsConstants.F_OK);
                await fs.copyFile(srcPath, destPath);
                console.log(`   ✅ Restored: ${file}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`Warning: Could not restore ${file}: ${error.message}`);
                }
            }
        }

        // Update state
        const state = await this.loadState();
        const backupMetaPath = path.join(backupPath, '.backup-meta.json');
        let backupVersion = 'unknown';
        try {
            const meta = JSON.parse(await fs.readFile(backupMetaPath, 'utf-8'));
            backupVersion = meta.version;
        } catch {
            // Ignore
        }

        state.current = {
            version: backupVersion,
            rolledBackAt: new Date().toISOString(),
            fromBackup: backupPath
        };
        await this.saveState(state);

        console.log('✅ Rollback completed successfully');
        return { success: true, version: backupVersion };
    }

    /**
     * List available backups
     */
    async listBackups() {
        try {
            const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
            const backups = [];

            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('pre-update-')) {
                    const backupPath = path.join(this.backupDir, entry.name);
                    let meta = { version: 'unknown', timestamp: entry.name.replace('pre-update-', '') };

                    try {
                        const metaContent = await fs.readFile(
                            path.join(backupPath, '.backup-meta.json'),
                            'utf-8'
                        );
                        meta = JSON.parse(metaContent);
                    } catch {
                        // Use defaults
                    }

                    backups.push({
                        name: entry.name,
                        path: backupPath,
                        version: meta.version,
                        timestamp: meta.timestamp
                    });
                }
            }

            return backups.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        } catch {
            return [];
        }
    }

    /**
     * Clean up old backups
     * @param {number} keepCount - Number of backups to keep
     */
    async cleanupOldBackups(keepCount = 5) {
        const backups = await this.listBackups();
        const toDelete = backups.slice(0, -keepCount);

        for (const backup of toDelete) {
            console.log(`🗑️  Removing old backup: ${backup.name}`);
            await fs.rm(backup.path, { recursive: true, force: true });
        }

        return toDelete.length;
    }

    /**
     * Get update status
     */
    async getStatus() {
        const state = await this.loadState();
        const currentVersion = await this.getCurrentVersion();
        const backups = await this.listBackups();

        return {
            currentVersion,
            lastUpdate: state.current,
            updateHistory: state.updates,
            availableBackups: backups.length,
            backups: backups.slice(-5) // Last 5 backups
        };
    }
}

export default AtomicUpdateManager;
