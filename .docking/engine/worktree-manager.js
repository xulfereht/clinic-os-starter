/**
 * Worktree Manager
 * Git worktree operations for atomic updates
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { getNpmCommandParts } from '../../scripts/lib/npm-cli.js';

export class WorktreeManager {
    constructor(projectRoot) {
        this.root = projectRoot || process.cwd();
        this.worktreesDir = path.join(this.root, '.core', 'atomic-update', 'green-worktree');
    }

    /**
     * Check if we're in a git repository
     */
    isGitRepo() {
        try {
            execSync('git rev-parse --git-dir', { cwd: this.root, stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get current git branch
     */
    getCurrentBranch() {
        try {
            return execSync('git branch --show-current', {
                cwd: this.root,
                encoding: 'utf-8'
            }).trim();
        } catch {
            return 'HEAD';
        }
    }

    /**
     * List all worktrees
     */
    listWorktrees() {
        try {
            const output = execSync('git worktree list --porcelain', {
                cwd: this.root,
                encoding: 'utf-8'
            });

            const worktrees = [];
            const blocks = output.trim().split('\n\n');

            for (const block of blocks) {
                const lines = block.split('\n');
                const worktree = {};

                for (const line of lines) {
                    if (line.startsWith('worktree ')) {
                        worktree.path = line.slice(9);
                    } else if (line.startsWith('HEAD ')) {
                        worktree.head = line.slice(5);
                    } else if (line.startsWith('branch ')) {
                        worktree.branch = line.slice(7).replace('refs/heads/', '');
                    } else if (line === 'detached') {
                        worktree.detached = true;
                    } else if (line.startsWith('locked ')) {
                        worktree.locked = line.slice(7) || true;
                    }
                }

                if (worktree.path) {
                    worktrees.push(worktree);
                }
            }

            return worktrees;
        } catch (error) {
            return [];
        }
    }

    /**
     * List only atomic update worktrees
     */
    listAtomicWorktrees() {
        const allWorktrees = this.listWorktrees();
        return allWorktrees.filter(wt => wt.path.includes('.core/atomic-update/green-worktree'));
    }

    /**
     * Create a new worktree
     * @param {string} [name] - Worktree name (auto-generated if not provided)
     * @param {string} [ref] - Git ref to checkout (branch, tag, commit)
     * @returns {string} Path to created worktree
     */
    createWorktree(name, ref = 'HEAD') {
        if (!this.isGitRepo()) {
            throw new Error('Not a git repository');
        }

        // Generate name if not provided
        if (!name) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            name = `wt-${timestamp}`;
        }

        const worktreePath = path.join(this.worktreesDir, name);

        // Ensure parent directory exists
        fs.mkdir(this.worktreesDir, { recursive: true });

        console.log(`🌲 Creating worktree: ${name}`);

        try {
            // Create worktree
            execSync(`git worktree add "${worktreePath}" "${ref}"`, {
                cwd: this.root,
                stdio: 'pipe'
            });

            console.log(`✅ Worktree created: ${worktreePath}`);
            return worktreePath;
        } catch (error) {
            throw new Error(`Failed to create worktree: ${error.message}`);
        }
    }

    /**
     * Create a detached worktree (no branch)
     * @param {string} [name] - Worktree name
     * @param {string} [ref] - Git ref to checkout
     * @returns {string} Path to created worktree
     */
    createDetachedWorktree(name, ref = 'HEAD') {
        if (!this.isGitRepo()) {
            throw new Error('Not a git repository');
        }

        // Generate name if not provided
        if (!name) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            name = `wt-${timestamp}`;
        }

        const worktreePath = path.join(this.worktreesDir, name);

        // Ensure parent directory exists
        fs.mkdir(this.worktreesDir, { recursive: true });

        console.log(`🌲 Creating detached worktree: ${name}`);

        try {
            // Create detached worktree
            execSync(`git worktree add --detach "${worktreePath}"`, {
                cwd: this.root,
                stdio: 'pipe'
            });

            // Checkout specific ref if not HEAD
            if (ref !== 'HEAD') {
                execSync(`git checkout "${ref}"`, {
                    cwd: worktreePath,
                    stdio: 'pipe'
                });
            }

            console.log(`✅ Detached worktree created: ${worktreePath}`);
            return worktreePath;
        } catch (error) {
            throw new Error(`Failed to create detached worktree: ${error.message}`);
        }
    }

    /**
     * Remove a worktree
     * @param {string} worktreePath - Path to worktree
     * @param {boolean} [force=false] - Force removal even if dirty
     */
    removeWorktree(worktreePath, force = false) {
        console.log(`🗑️  Removing worktree: ${worktreePath}`);

        try {
            const forceFlag = force ? '--force' : '';
            execSync(`git worktree remove "${worktreePath}" ${forceFlag}`, {
                cwd: this.root,
                stdio: 'pipe'
            });

            console.log(`✅ Worktree removed`);
        } catch (error) {
            // Try manual cleanup
            console.warn(`Git worktree remove failed, trying manual cleanup...`);
            this.forceRemoveWorktree(worktreePath);
        }
    }

    /**
     * Force remove a worktree (manual cleanup)
     * @param {string} worktreePath - Path to worktree
     */
    forceRemoveWorktree(worktreePath) {
        try {
            // Remove worktree entry from git
            try {
                execSync(`git worktree remove "${worktreePath}" --force`, {
                    cwd: this.root,
                    stdio: 'pipe'
                });
            } catch {
                // Try prune
                execSync('git worktree prune', { cwd: this.root, stdio: 'pipe' });
            }

            // Manual directory removal
            fs.rm(worktreePath, { recursive: true, force: true });

            console.log(`✅ Worktree force removed`);
        } catch (error) {
            console.error(`❌ Failed to remove worktree: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean up all atomic worktrees
     * @param {boolean} [force=false] - Force removal
     */
    cleanupAllWorktrees(force = false) {
        const worktrees = this.listAtomicWorktrees();

        console.log(`🧹 Cleaning up ${worktrees.length} atomic worktrees...`);

        for (const wt of worktrees) {
            this.removeWorktree(wt.path, force);
        }

        console.log('✅ All atomic worktrees cleaned up');
    }

    /**
     * Prune stale worktree references
     */
    pruneWorktrees() {
        try {
            execSync('git worktree prune', {
                cwd: this.root,
                stdio: 'pipe'
            });
            console.log('✅ Worktree references pruned');
        } catch (error) {
            console.warn(`Warning: Could not prune worktrees: ${error.message}`);
        }
    }

    /**
     * Run command in worktree
     * @param {string} worktreePath - Path to worktree
     * @param {string} command - Command to run
     * @param {string[]} args - Command arguments
     * @returns {Promise<{code: number, stdout: string, stderr: string}>}
     */
    runInWorktree(worktreePath, command, args = []) {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                cwd: worktreePath,
                stdio: 'pipe'
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                resolve({ code, stdout, stderr });
            });

            proc.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Install npm dependencies in worktree
     * @param {string} worktreePath - Path to worktree
     * @returns {Promise<void>}
     */
    async installDependencies(worktreePath) {
        console.log(`📦 Installing dependencies in ${worktreePath}...`);
        const npmCommand = getNpmCommandParts(['ci']);

        const { code, stdout, stderr } = await this.runInWorktree(
            worktreePath,
            npmCommand.command,
            npmCommand.args
        );

        if (code !== 0) {
            throw new Error(`npm ci failed:\n${stderr || stdout}`);
        }

        console.log('✅ Dependencies installed');
    }

    /**
     * Get worktree info
     * @param {string} worktreePath - Path to worktree
     */
    getWorktreeInfo(worktreePath) {
        try {
            const worktrees = this.listWorktrees();
            return worktrees.find(wt => wt.path === worktreePath);
        } catch {
            return null;
        }
    }

    /**
     * Check if worktree is clean (no uncommitted changes)
     * @param {string} worktreePath - Path to worktree
     */
    isWorktreeClean(worktreePath) {
        try {
            const output = execSync('git status --porcelain', {
                cwd: worktreePath,
                encoding: 'utf-8'
            });
            return output.trim() === '';
        } catch {
            return false;
        }
    }

    /**
     * Get temporary worktree path
     * @param {string} [prefix] - Prefix for directory name
     */
    getTempWorktreePath(prefix = 'temp') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return path.join(this.worktreesDir, `${prefix}-${timestamp}-${random}`);
    }
}

export default WorktreeManager;
