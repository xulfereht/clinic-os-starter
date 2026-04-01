#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import {
    E2E_ADMIN_EMAIL,
    E2E_ADMIN_ID,
    E2E_ADMIN_NAME,
    E2E_ADMIN_PASSWORD,
    E2E_BLOG_ID,
    E2E_BLOG_SLUG,
    E2E_CONDITION_ID,
    E2E_CONDITION_SLUG,
    E2E_FAQ_ID,
    E2E_FAQ_SLUG,
    E2E_NOTICE_ID,
    E2E_PROGRAM_ID,
    E2E_STRESS_RESULT_ID,
    E2E_TOPIC_ID,
    E2E_TOPIC_SLUG,
} from './lib/e2e-admin-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const DEFAULT_DB_NAME = 'clinic-os-db';

function parseArgs(argv) {
    const options = {
        json: false,
        remote: false,
        includePublicFixtures: undefined,
        adminId: process.env.E2E_ADMIN_ID || E2E_ADMIN_ID,
        adminEmail: process.env.E2E_ADMIN_EMAIL || E2E_ADMIN_EMAIL,
        adminName: process.env.E2E_ADMIN_NAME || E2E_ADMIN_NAME,
        adminPassword: process.env.E2E_ADMIN_PASSWORD || E2E_ADMIN_PASSWORD,
    };

    for (const arg of argv) {
        if (arg === '--json') {
            options.json = true;
            continue;
        }
        if (arg === '--remote') {
            options.remote = true;
            continue;
        }
        if (arg === '--with-public-fixtures') {
            options.includePublicFixtures = true;
            continue;
        }
        if (arg === '--without-public-fixtures') {
            options.includePublicFixtures = false;
            continue;
        }
        if (arg.startsWith('--id=')) {
            options.adminId = arg.slice('--id='.length);
            continue;
        }
        if (arg.startsWith('--email=')) {
            options.adminEmail = arg.slice('--email='.length);
            continue;
        }
        if (arg.startsWith('--name=')) {
            options.adminName = arg.slice('--name='.length);
            continue;
        }
        if (arg.startsWith('--password=')) {
            options.adminPassword = arg.slice('--password='.length);
        }
    }

    return options;
}

function getDbName() {
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) {
            return match[1];
        }
    }
    return DEFAULT_DB_NAME;
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function runCommand(command) {
    return new Promise((resolve) => {
        exec(command, { cwd: PROJECT_ROOT, shell: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, stdout: stdout?.trim() || '', stderr: stderr?.trim() || error.message });
                return;
            }
            resolve({ success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' });
        });
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const json = options.json;
    const dbName = getDbName();
    const passwordHash = sha256(options.adminPassword);
    const includePublicFixtures =
        typeof options.includePublicFixtures === 'boolean'
            ? options.includePublicFixtures
            : !options.remote;
    const programSections = JSON.stringify([
        {
            type: 'Hero',
            data: {
                title: 'E2E 프로그램 미리보기',
                subtitle: '스킨 계약 테스트',
                description: '관리자 디자인 설정 저장 이후 programDetail 템플릿이 실제 프로그램 상세에 반영되는지 확인하기 위한 테스트 데이터입니다.',
                image: '/images/programs/pain/hero.png',
                ctaText: '예약 문의',
                ctaLink: '/intake',
                secondaryCtaText: '프로그램 더 보기',
                secondaryCtaLink: '#program-faq',
            },
        },
        {
            type: 'FAQ',
            data: {
                title: '자주 묻는 질문',
                items: [
                    {
                        q: 'E2E 프로그램은 무엇을 검증하나요?',
                        a: 'programDetail 템플릿과 skin data-skin 속성이 저장 후 실제 퍼블릭에 반영되는지 검증합니다.',
                    },
                ],
            },
        },
    ]).replace(/'/g, "''");
    const blogContent = [
        '# E2E 블로그 제목',
        '',
        '스킨 계약 테스트용 블로그 본문입니다.',
        '',
        '## 섹션 제목',
        '',
        '디자인 저장 이후 blogDetail 템플릿이 실제 블로그 상세에도 반영되는지 확인합니다.',
    ].join('\\n').replace(/'/g, "''");
    const publicFixturesSql = `
INSERT OR REPLACE INTO topics (
    id, slug, title, summary, seo_title, thumbnail_url, related_program_id, supervisor_id, created_at, updated_at
) VALUES (
    ${E2E_TOPIC_ID},
    '${E2E_TOPIC_SLUG}',
    'E2E 건강 가이드',
    '디자인 계약 테스트용 토픽입니다.',
    'E2E 건강 가이드',
    NULL,
    NULL,
    NULL,
    unixepoch(),
    unixepoch()
);

INSERT OR REPLACE INTO topic_conditions (
    id, topic_id, slug, name, name_en, description, icon, display_order, faq_count, created_at
) VALUES (
    ${E2E_CONDITION_ID},
    ${E2E_TOPIC_ID},
    '${E2E_CONDITION_SLUG}',
    'E2E 증상',
    'E2E Condition',
    '디자인 계약 테스트용 condition 입니다.',
    '🧪',
    1,
    1,
    unixepoch()
);

INSERT OR REPLACE INTO faq_items (
    id, topic_id, question, answer_short, answer_detail, tags, author_id, supervisor_id, status,
    view_count, created_at, updated_at, last_reviewed_at, category, condition_id, slug, cluster, is_sample
) VALUES (
    ${E2E_FAQ_ID},
    ${E2E_TOPIC_ID},
    'E2E FAQ 질문은 어떻게 노출되나요?',
    '스킨 변경 후 FAQ 상세에서도 같은 템플릿이 반영됩니다.',
    '<p>이 답변은 관리자 디자인 설정의 스킨 변경이 FAQ 상세에도 전달되는지 확인하기 위한 테스트 데이터입니다.</p>',
    '["e2e","skin-contract"]',
    NULL,
    NULL,
    'published',
    0,
    unixepoch(),
    unixepoch(),
    unixepoch(),
    'E2E 카테고리',
    ${E2E_CONDITION_ID},
    '${E2E_FAQ_SLUG}',
    '01. E2E Cluster',
    1
);

INSERT OR REPLACE INTO posts (
    id, title, slug, content, author_id, type, status, created_at, updated_at, doctor_id, patient_id,
    featured_image, excerpt, is_pinned, view_count, category, patient_name, deleted_at, is_sample
) VALUES (
    ${E2E_NOTICE_ID},
    'E2E 공지 제목',
    'e2e-notice',
    'E2E 공지 상세 본문입니다. 디자인 계약 테스트에서 noticeDetail 템플릿 반영을 확인합니다.',
    NULL,
    'notice',
    'published',
    unixepoch(),
    unixepoch(),
    NULL,
    NULL,
    NULL,
    '디자인 계약 테스트용 공지입니다.',
    1,
    0,
    'general',
    NULL,
    NULL,
    1
);

INSERT OR REPLACE INTO posts (
    id, title, slug, content, author_id, type, status, created_at, updated_at, doctor_id, patient_id,
    featured_image, excerpt, is_pinned, view_count, category, patient_name, deleted_at, is_sample
) VALUES (
    ${E2E_BLOG_ID},
    'E2E 블로그 제목',
    '${E2E_BLOG_SLUG}',
    '${blogContent}',
    NULL,
    'blog',
    'published',
    unixepoch(),
    unixepoch(),
    NULL,
    NULL,
    '/images/hero/zen_hero_2.png',
    '디자인 계약 테스트용 블로그입니다.',
    0,
    0,
    'wellness',
    NULL,
    NULL,
    1
);

INSERT OR REPLACE INTO programs (
    id, title, description, pricing, features, sections,
    doctor_id, doctor_ids, category, treatable_conditions,
    is_visible, order_index, updated_at
) VALUES (
    '${E2E_PROGRAM_ID}',
    'E2E 회복 프로그램',
    '디자인 계약 테스트용 프로그램 소개입니다.',
    NULL,
    NULL,
    '${programSections}',
    NULL,
    NULL,
    'wellness',
    NULL,
    1,
    999,
    unixepoch()
);`.trim();

    const baseSql = `
INSERT OR REPLACE INTO super_admins (
    id, email, password_hash, name, is_active, password_hash_format,
    failed_login_attempts, locked_until, password_change_required
) VALUES (
    '${options.adminId}', '${options.adminEmail}', '${passwordHash}', '${options.adminName}', 1, 'legacy_sha256',
    0, NULL, 0
);

DELETE FROM sessions WHERE staff_id = '${options.adminId}';

INSERT OR REPLACE INTO survey_tool_results (
    id, tool_id, answers, total_score, max_score, created_at
) VALUES (
    '${E2E_STRESS_RESULT_ID}',
    'stress-check',
    '{"q1":2,"q2":1,"q3":2,"q4":1,"q5":2,"q6":1,"q7":2,"q8":1,"q9":2,"q10":1}',
    15,
    40,
    datetime('now')
);
`.trim();
    const sql = includePublicFixtures
        ? `${baseSql}\n\n${publicFixturesSql}`
        : baseSql;

    const tmpFile = path.join(os.tmpdir(), `clinic-os-e2e-seed-${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, sql);

    const targetFlag = options.remote ? '--remote' : '--local';
    const result = await runCommand(`npx wrangler d1 execute ${dbName} ${targetFlag} --file="${tmpFile}" --yes`);
    fs.rmSync(tmpFile, { force: true });

    if (!result.success) {
        const error = result.stderr || 'E2E seed failed';
        if (json) {
            console.log(JSON.stringify({ success: false, dbName, error }, null, 2));
        } else {
            console.error(`❌ 관리자 E2E 시드 실패: ${error}`);
        }
        process.exit(1);
    }

    const payload = {
        success: true,
        dbName,
        admin: {
            id: options.adminId,
            email: options.adminEmail,
            password: options.adminPassword,
        },
        surveyResult: {
            id: E2E_STRESS_RESULT_ID,
            toolId: 'stress-check',
        },
        contentFixtures: {
            ...(includePublicFixtures
                ? {
                      topicSlug: E2E_TOPIC_SLUG,
                      conditionSlug: E2E_CONDITION_SLUG,
                      faqSlug: E2E_FAQ_SLUG,
                      noticeId: E2E_NOTICE_ID,
                      blogSlug: E2E_BLOG_SLUG,
                      programId: E2E_PROGRAM_ID,
                  }
                : {}),
        },
    };

    if (json) {
        console.log(JSON.stringify(payload, null, 2));
    } else {
        console.log('✅ 관리자 E2E 시드 완료');
        console.log(`   target: ${options.remote ? 'remote' : 'local'}`);
        console.log(`   admin: ${options.adminEmail}`);
        console.log(`   result: ${E2E_STRESS_RESULT_ID} (stress-check)`);
        console.log(`   public fixtures: ${includePublicFixtures ? 'enabled' : 'disabled'}`);
        if (includePublicFixtures) {
            console.log(`   topic: /topics/${E2E_TOPIC_SLUG}`);
            console.log(`   faq: /topics/${E2E_TOPIC_SLUG}/${E2E_CONDITION_SLUG}/${E2E_FAQ_SLUG}`);
            console.log(`   notice: /notices/${E2E_NOTICE_ID}`);
            console.log(`   blog: /blog/${E2E_BLOG_SLUG}`);
            console.log(`   program: /programs/${E2E_PROGRAM_ID}`);
        }
    }
}

main().catch((error) => {
    console.error('❌ 관리자 E2E 시드 오류:', error);
    process.exit(1);
});
