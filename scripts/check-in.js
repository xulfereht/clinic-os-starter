import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import https from 'https';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, '.docking/config.yaml');

function readTextSafe(filePath) {
    try { return fs.readFileSync(filePath, 'utf8').trim(); } catch { return null; }
}

function readJsonSafe(filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

/**
 * 건강 텔레메트리 수집 (각 항목 개별 try/catch)
 */
function collectHealthTelemetry() {
    const health = {};

    try { health.package_version = readJsonSafe(path.join(PROJECT_ROOT, 'package.json'))?.version || null; } catch { health.package_version = null; }
    try { health.core_version = readTextSafe(path.join(PROJECT_ROOT, '.core', 'version')); } catch { health.core_version = null; }
    try { health.starter_version = readTextSafe(path.join(PROJECT_ROOT, '.core', 'starter-version')); } catch { health.starter_version = null; }
    try { health.node_version = process.version; } catch { health.node_version = null; }
    try { health.os = `${os.platform()}-${os.arch()}`; } catch { health.os = null; }

    // schema_hash: .core/last-health.json 캐시 사용
    try {
        const lastHealthPath = path.join(PROJECT_ROOT, '.core', 'last-health.json');
        if (fs.existsSync(lastHealthPath)) {
            const cached = readJsonSafe(lastHealthPath);
            if (cached) {
                health.schema_hash = cached.schemaHash || null;
                health.health_score = cached.score ?? null;
            }
        }
    } catch { /* ignore */ }

    return health;
}

async function checkIn() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return;
        }

        const config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
        const { hq_url, device_token } = config;

        if (!hq_url || !device_token) {
            return;
        }

        const health = collectHealthTelemetry();
        const payload = JSON.stringify({ device_token, health });
        const url = new URL('/api/v1/ping', hq_url);

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 3000
        };

        const req = https.request(options, (res) => {
            // Fire and forget
        });

        req.on('error', () => {});
        req.on('timeout', () => { req.destroy(); });

        req.write(payload);
        req.end();

        await new Promise(resolve => setTimeout(resolve, 100));

    } catch (e) {
        // Silently fail
    }
}

checkIn();
