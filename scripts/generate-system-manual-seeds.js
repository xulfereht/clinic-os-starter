import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// 카테고리별 매뉴얼 정의
const MANUAL_CONFIG = {
    '병원 운영 기초 설정': [
        'CLINIC_INFO_SETUP',
        'STAFF_MANAGEMENT'
    ],
    '핵심 기능 가이드': [
        'PATIENT_MANAGEMENT',
        'RESERVATION_MANAGEMENT',
        'RESERVATION_FLOW_GUIDE',
        'POST_MANAGEMENT',
        'REVIEW_MANAGEMENT',
        'PROGRAM_MANAGEMENT',
        'INTAKE_MANAGEMENT'
    ],
    '마케팅/캠페인': [
        'MESSAGE_CAMPAIGN_GUIDE',
        'MESSAGE_TEMPLATES',
        'CAMPAIGN_MANAGEMENT',
        'SEO_MARKETING_GUIDE'
    ],
    '콘텐츠/디자인': [
        'CONTENT_MANAGEMENT_GUIDE',
        'DESIGN_SYSTEM_GUIDE'
    ],
    '분석/운영': [
        'ANALYTICS_GUIDE',
        'OPERATIONS_GUIDE'
    ],
    'AI 기능': [
        'AI_FEATURE_GUIDE'
    ],
    '외부 서비스 연동': [
        'GOOGLE_AUTH_SETUP',
        'lightsail_proxy_setup',
        'ec2_proxy_setup'
    ],
    '시작 가이드': [
        'USER_GUIDE',
        'WINDOWS_GUIDE'
    ]
};

function extractTitle(content, filename) {
    const lines = content.split('\n');
    const h1Line = lines.find(line => line.trim().startsWith('# '));
    if (h1Line) {
        return h1Line.replace('#', '').trim();
    }
    return filename.replace(/_/g, ' ');
}

function escapeSQL(str) {
    return str.replace(/'/g, "''");
}

function generateSeeds() {
    const docsDir = path.join(PROJECT_ROOT, 'docs');
    let sql = `-- System Manuals Seed Data
-- Generated: ${new Date().toISOString()}
-- 고객용 시스템 매뉴얼 데이터

DELETE FROM system_manuals;

`;

    let sortOrder = 0;
    const categoryOrder = Object.keys(MANUAL_CONFIG);

    for (const category of categoryOrder) {
        const files = MANUAL_CONFIG[category];

        for (const fileId of files) {
            const filePath = path.join(docsDir, `${fileId}.md`);

            if (!fs.existsSync(filePath)) {
                console.warn(`Warning: ${filePath} not found, skipping...`);
                continue;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const title = extractTitle(content, fileId);

            sql += `INSERT INTO system_manuals (id, title, category, content, sort_order, is_active) VALUES (
'${fileId}',
'${escapeSQL(title)}',
'${escapeSQL(category)}',
'${escapeSQL(content)}',
${sortOrder},
1
);

`;
            sortOrder++;
            console.log(`✅ ${category} > ${title}`);
        }
    }

    // Write to seeds file
    const outputPath = path.join(PROJECT_ROOT, 'seeds', 'seed_system_manuals.sql');
    fs.writeFileSync(outputPath, sql);
    console.log(`\n📄 Generated: ${outputPath}`);
    console.log(`📊 Total: ${sortOrder} manuals`);
}

generateSeeds();
