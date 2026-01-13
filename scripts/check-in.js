import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, '.docking/config.yaml');

async function checkIn() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            // Config not found implies setup hasn't run yet. Non-blocking.
            return;
        }

        const config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
        const { hq_url, device_token } = config;

        if (!hq_url || !device_token) {
            return;
        }

        const payload = JSON.stringify({ device_token });
        const url = new URL('/api/v1/ping', hq_url);

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 3000 // 3s timeout
        };

        const req = https.request(options, (res) => {
            // Fire and forget
        });

        req.on('error', (e) => {
            // Ignore errors (offline, etc)
        });

        req.on('timeout', () => {
            req.destroy();
        });

        req.write(payload);
        req.end();

        // Give a small delay for network I/O to flush, but don't wait for response
        await new Promise(resolve => setTimeout(resolve, 100));

    } catch (e) {
        // Silently fail
    }
}

checkIn();
