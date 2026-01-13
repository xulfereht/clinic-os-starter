import fs from 'fs-extra';
import archiver from 'archiver';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist-packages');
const MANIFEST_FILENAME = 'manifest.yaml';

const EXCLUDE_LIST = [
    'node_modules',
    '.git',
    '.gitignore',
    '.env',
    '.docking',
    '.client',
    '.agent',
    'hq',
    'dist',
    'dist-packages',
    'archive',
    'data',
    '.wrangler',
    'tests',
    'wrangler.toml',
    'clinic_setup.yaml',
    'db_local.sqlite',
    'brd-clinic-db.sqlite',
    'migrations/skipped',
    'public/images/programs/diet/raw',
];

const DEV_ONLY_SCRIPTS = [
    'pack-docking.js',
    'create-starter-kit.js',
    'unpack-docking.js',
];

const getVersion = () => fs.readJsonSync(path.join(PROJECT_ROOT, 'package.json')).version;

const createFilter = () => (fullPath) => {
    const normalizedSrc = path.normalize(fullPath).replace(/\\/g, '/');

    const isExcluded = EXCLUDE_LIST.some(item => {
        const normalizedItem = item.replace(/\\/g, '/');
        return normalizedSrc.includes('/' + normalizedItem + '/') ||
            normalizedSrc.endsWith('/' + normalizedItem);
    });

    if (isExcluded) return false;

    const isTemp = ['.bak', '.tmp', '.DS_Store', 'node_modules', '.sqlite', '.db'].some(p =>
        normalizedSrc.includes(p)
    );
    if (isTemp) return false;

    return true;
};

async function addDirectoryRecursive(archive, dirPath, destPath, filter) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const srcPath = path.join(dirPath, file);
        const relativeDest = path.join(destPath, file);

        if (!filter(srcPath)) {
            // console.log(`   🚫 Skipped: ${srcPath}`);
            continue;
        }

        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            await addDirectoryRecursive(archive, srcPath, relativeDest, filter);
        } else {
            archive.file(srcPath, { name: relativeDest });
        }
    }
}

async function packRelease(type = 'full') {
    const version = getVersion();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const packageName = `clinic-os-v${version}-${type}-${timestamp}.zip`;

    await fs.ensureDir(OUTPUT_DIR);
    const outputPath = path.join(OUTPUT_DIR, packageName);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`✅ Package created: ${packageName} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
    });

    archive.pipe(output);
    const filter = createFilter();

    if (type === 'full') {
        console.log("   📂 Adding core files manually...");

        const directories = ['src', 'public', 'migrations', 'seeds'];
        for (const dir of directories) {
            const fullDir = path.join(PROJECT_ROOT, dir);
            if (fs.existsSync(fullDir)) {
                await addDirectoryRecursive(archive, fullDir, 'core/' + dir, filter);
            }
        }

        const scriptsDir = path.join(PROJECT_ROOT, 'scripts');
        const scriptFiles = fs.readdirSync(scriptsDir);
        for (const file of scriptFiles) {
            const fullPath = path.join(scriptsDir, file);
            if (!DEV_ONLY_SCRIPTS.includes(file) && filter(fullPath)) {
                archive.file(fullPath, { name: `core/scripts/${file}` });
            }
        }

        const rootFiles = ['package.json', 'GEMINI.md', 'astro.config.mjs', 'tsconfig.json'];
        for (const file of rootFiles) {
            const fullPath = path.join(PROJECT_ROOT, file);
            if (fs.existsSync(fullPath) && filter(fullPath)) {
                archive.file(fullPath, { name: `core/${file}` });
            }
        }
    }

    archive.append(await yaml.dump({
        version, type, release_date: new Date().toISOString(), required_base_version: "0.0.0"
    }), { name: 'manifest.yaml' });

    archive.append(`# Instructions for v${version}`, { name: 'instructions.md' });
    await archive.finalize();
}

const args = process.argv.slice(2);
const type = (args.find(a => a.startsWith('--type=')) || '--type=full').split('=')[1];
packRelease(type).catch(err => console.error(err));
