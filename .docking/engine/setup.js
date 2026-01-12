#!/usr/bin/env node
/**
 * Clinic-OS Setup Script
 * 
 * This is a lightweight launcher that calls the main setup-clinic.js
 * if it exists, or provides instructions for first-time setup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

async function main() {
    console.log('🏥 Clinic-OS Setup\n');

    // Check if config already exists
    const configPath = path.join(PROJECT_ROOT, '.docking/config.yaml');
    if (fs.existsSync(configPath)) {
        console.log('✅ Configuration already exists.');
        console.log('   To fetch updates, run: npm run fetch');
        console.log('   To reconfigure, delete .docking/config.yaml first.');
        return;
    }

    // Check if core/scripts/setup-clinic.js exists (from full package)
    const fullSetupPath = path.join(PROJECT_ROOT, 'core/scripts/setup-clinic.js');
    const scriptsSetupPath = path.join(PROJECT_ROOT, 'scripts/setup-clinic.js');

    let setupScript = null;
    if (fs.existsSync(scriptsSetupPath)) {
        setupScript = scriptsSetupPath;
    } else if (fs.existsSync(fullSetupPath)) {
        setupScript = fullSetupPath;
    }

    if (setupScript) {
        console.log('📦 Running full setup script...\n');
        const child = spawn('node', [setupScript], {
            stdio: 'inherit',
            cwd: PROJECT_ROOT
        });
        child.on('close', (code) => process.exit(code));
    } else {
        // Starter kit mode - provide instructions
        console.log('📋 This is a Starter Kit. To complete setup:\n');
        console.log('   1. Ask Antigravity: "/setup-clinic"');
        console.log('   2. Or manually configure .docking/config.yaml');
        console.log('');
        console.log('   After configuration, run: npm run fetch');
        console.log('   to download the latest package.\n');
    }
}

main().catch(console.error);
