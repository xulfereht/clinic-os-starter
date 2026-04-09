import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED_PLUGIN_TYPES = ['new-route', 'override', 'admin-page'];
const DEFAULT_AUTHOR = 'Local Clinic';

function kebabToTitle(value) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugToTablePrefix(pluginId) {
  return pluginId.replace(/-/g, '_');
}

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function normalizePermissions(rawPermissions) {
  const values = ensureArray(rawPermissions)
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (value == null) return defaultValue;
  if (typeof value === 'string') {
    if (['1', 'true', 'yes', 'y'].includes(value.toLowerCase())) return true;
    if (['0', 'false', 'no', 'n'].includes(value.toLowerCase())) return false;
  }
  return defaultValue;
}

function buildDocumentation({ pluginId, name, description, type }) {
  const typeSummary = {
    'new-route': '새 공개 경로와 필요 시 관리자 탭을 추가하는 플러그인입니다.',
    override: '기존 코어 경로를 안전하게 대체하는 플러그인입니다.',
    'admin-page': '관리자 허브에 전용 운영 페이지를 추가하는 플러그인입니다.',
  };

  return {
    summary: `${description} ${typeSummary[type] || ''}`.trim(),
    features: [
      `${name} 전용 구조가 ${pluginId} 아래에 격리됩니다.`,
      '에이전트가 로컬에서 바로 수정하고 검증할 수 있습니다.',
    ],
    requirements: [
      '배포 전 npm run build 로 라우팅과 번들을 확인하세요.',
    ],
    howToEdit: `src/plugins/local/${pluginId}/ 안에서 manifest, pages, api, migrations 를 수정하세요.`,
    category: type === 'override' ? 'customization' : 'utility',
  };
}

function buildReadme({ pluginId, name, description, type, files }) {
  const fileList = files
    .map((file) => `- \`${file.relativePath}\``)
    .join('\n');

  return `# ${name}

> ${description}

## 개요

이 플러그인은 \`${pluginId}\` 로 생성된 에이전트-우선 스캐폴드입니다.
현재 타입은 \`${type}\` 이며, 코어를 직접 수정하지 않고 기능을 확장하는 용도로 사용합니다.

## 포함된 파일

${fileList}

## 개발 흐름

1. 에이전트가 \`manifest.json\` 과 라우트 구조를 점검합니다.
2. 필요하면 \`pages/\`, \`api/\`, \`lib/\`, \`migrations/\` 를 수정합니다.
3. \`npm run build\` 로 플러그인 라우팅과 번들을 검증합니다.
4. 필요하면 관리자 화면에서 설치/리빌드/활성화를 확인합니다.

## 제출 전 체크

- \`custom_\` 테이블만 사용했는지 확인
- README 와 documentation 을 최신 상태로 유지
- 위험 권한과 외부 API 사용 이유를 문서화

## 변경 이력

- v1.0.0: 에이전트 스캐폴드 생성
`;
}

function buildChangelog() {
  return `# Changelog

## 1.0.0

- 초기 스캐폴드 생성
`;
}

function buildPublicPage({ name, description, pluginId }) {
  return `---
const title = ${JSON.stringify(name)};
const description = ${JSON.stringify(description)};
---

<section class="mx-auto max-w-4xl px-6 py-16">
  <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
    <p class="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Plugin</p>
    <h1 class="mt-4 text-3xl font-bold text-slate-900">{title}</h1>
    <p class="mt-4 text-slate-600">{description}</p>

    <div class="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
      <p>이 화면은 \`src/plugins/local/${pluginId}/pages/index.astro\` 에서 렌더링됩니다.</p>
      <p class="mt-2">에이전트에게 필요한 섹션, 폼, 데이터 연결을 요청해서 이 페이지를 확장하세요.</p>
    </div>
  </div>
</section>
`;
}

function buildAdminPage({ name, pluginId }) {
  return `---
const title = ${JSON.stringify(name)};
---

<section class="space-y-6">
  <div>
    <p class="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Admin Plugin</p>
    <h2 class="mt-2 text-2xl font-bold text-slate-900">{title} 관리</h2>
    <p class="mt-3 text-slate-600">이 탭은 \`/admin/hub/${pluginId}/manage\` 에서 열립니다.</p>
  </div>

  <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
    <p>여기에 설정 폼, 점검 위젯, 운영 메모 등을 추가할 수 있습니다.</p>
    <p class="mt-2">에이전트에게 필요한 관리자 기능을 설명하면 이 파일과 필요한 API를 같이 확장하면 됩니다.</p>
  </div>
</section>
`;
}

function buildApiHandler({ pluginId }) {
  return `import type { APIRoute } from 'astro';
import { createSDKFromContext } from '../../../../lib/plugin-sdk';

export const GET: APIRoute = async ({ locals, plugin }) => {
  const sdk = createSDKFromContext(locals, plugin.id);
  const tables = await sdk.db.query(
    "SELECT name FROM sqlite_master WHERE type = ? ORDER BY name LIMIT 10",
    ['table'],
  );

  return new Response(JSON.stringify({
    success: true,
    pluginId: plugin.id,
    tables: tables.map((row: any) => row.name),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
`;
}

function buildHookHandler({ pluginId }) {
  return `import { createSDK } from '../../../../lib/plugin-sdk';

export async function handlePaymentCompleted(context) {
  const sdk = createSDK({
    db: context.db,
    pluginId: context.pluginId || ${JSON.stringify(pluginId)},
  });

  const clinicName = await sdk.settings.get('clinic_name').catch(() => null);

  console.log('[Plugin Hook] onPaymentCompleted', {
    pluginId: context.pluginId,
    patientId: context.data?.patientId,
    clinicName,
  });
}
`;
}

function buildMigrationSql({ pluginId }) {
  const tableName = `custom_${slugToTablePrefix(pluginId)}_items`;
  return `CREATE TABLE IF NOT EXISTS ${tableName} (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_${tableName}_status
  ON ${tableName}(status);
`;
}

function buildRollbackSql({ pluginId }) {
  const tableName = `custom_${slugToTablePrefix(pluginId)}_items`;
  return `DROP TABLE IF EXISTS ${tableName};
`;
}

function buildManifest(options) {
  const {
    pluginId,
    name,
    description,
    author,
    type,
    category,
    withAdmin,
    withApi,
    withHooks,
    withMigration,
    routeBase,
    overridePath,
    permissions,
  } = options;

  const manifest = {
    id: pluginId,
    name,
    description,
    version: '1.0.0',
    author,
    type,
    category,
    documentation: buildDocumentation({ pluginId, name, description, type }),
    permissions,
  };

  if (type === 'new-route') {
    manifest.routes = {
      base: routeBase,
      public: [
        { path: '/', file: 'pages/index.astro', title: name },
      ],
    };
  }

  if (type === 'override') {
    manifest.overrides = [
      {
        path: overridePath,
        file: 'pages/index.astro',
        priority: 10,
      },
    ];
  }

  if (withAdmin || type === 'admin-page') {
    manifest.pages = [
      {
        path: 'manage',
        title: '관리',
        description: `${name} 관리 화면`,
      },
    ];
  }

  if (withApi) {
    manifest.apis = [
      {
        path: 'status',
        methods: ['GET'],
        description: `${name} 상태 조회`,
      },
    ];
  }

  if (withHooks) {
    manifest.hooks = [
      {
        event: 'onPaymentCompleted',
        handler: 'handlePaymentCompleted',
        description: '결제 완료 이벤트 샘플 핸들러',
      },
    ];
  }

  if (withMigration) {
    manifest.tables = [`custom_${slugToTablePrefix(pluginId)}_items`];
  }

  return manifest;
}

export function normalizePluginScaffoldOptions(rawOptions = {}) {
  const pluginId = String(rawOptions.pluginId || rawOptions.id || '').trim();
  if (!pluginId) {
    throw new Error('--id is required');
  }
  if (!/^[a-z0-9_-]+$/.test(pluginId)) {
    throw new Error('Plugin ID must contain only lowercase letters, numbers, hyphens, and underscores');
  }

  const type = String(rawOptions.type || 'new-route').trim();
  if (!SUPPORTED_PLUGIN_TYPES.includes(type)) {
    throw new Error(`Unsupported plugin type: ${type}. Supported: ${SUPPORTED_PLUGIN_TYPES.join(', ')}`);
  }

  const withAdminDefault = type === 'new-route' || type === 'admin-page';
  const withApi = parseBoolean(rawOptions.withApi || rawOptions.api, false);
  const withHooks = parseBoolean(rawOptions.withHooks || rawOptions.hooks, false);
  const withMigration = parseBoolean(rawOptions.withMigration || rawOptions.migration, false);
  const withAdmin = parseBoolean(rawOptions.withAdmin || rawOptions.admin, withAdminDefault);

  const name = String(rawOptions.name || kebabToTitle(pluginId)).trim();
  const description = String(rawOptions.description || rawOptions.desc || `${name} 플러그인`).trim();
  const author = String(rawOptions.author || DEFAULT_AUTHOR).trim();
  const category = String(
    rawOptions.category ||
      (type === 'override' ? 'customization' : 'utility')
  ).trim();
  const routeBase = String(rawOptions.routeBase || `/ext/${pluginId}`).trim();
  const overridePath = String(rawOptions.overridePath || '/').trim();
  const permissions = normalizePermissions(rawOptions.permissions);

  if (withApi && !permissions.includes('database:read')) {
    permissions.push('database:read');
  }
  if (withMigration && !permissions.includes('database:write')) {
    permissions.push('database:write');
  }

  return {
    projectRoot: path.resolve(String(rawOptions.projectRoot || rawOptions.root || process.cwd())),
    pluginId,
    name,
    description,
    author,
    type,
    category,
    routeBase,
    overridePath,
    withAdmin,
    withApi,
    withHooks,
    withMigration,
    permissions: Array.from(new Set(permissions)),
    dryRun: parseBoolean(rawOptions.dryRun || rawOptions['dry-run'], false),
    force: parseBoolean(rawOptions.force, false),
  };
}

function validateSafePluginPath(pluginDir) {
  const normalizedPath = path.normalize(pluginDir);
  const forbiddenPatterns = [
    '/core/',
    '\\core\\',
    '/core\\',
    '\\core/',
  ];

  for (const pattern of forbiddenPatterns) {
    if (normalizedPath.includes(pattern)) {
      throw new Error(
        `❌ Plugins cannot be created inside core/ directory: ${pluginDir}\n` +
        `   core/ is a git submodule - changes cannot be committed.\n` +
        `   Use src/plugins/local/ instead (committed to main repo).`
      );
    }
  }

  // Ensure path is within safe plugin directories
  const isSafePath =
    normalizedPath.includes('/src/plugins/local/') ||
    normalizedPath.includes('\\src\\plugins\\local\\') ||
    normalizedPath.includes('/plugins/local/') ||
    normalizedPath.includes('\\plugins\\local\\');

  if (!isSafePath) {
    throw new Error(
      `❌ Plugins must be created in a safe location: ${pluginDir}\n` +
      `   Allowed paths:\n` +
      `   - src/plugins/local/{plugin-id}/\n` +
      `   - plugins/local/{plugin-id}/\n` +
      `   Avoid: src/plugins/{plugin-id}/ (core area, will be overwritten by core:pull)`
    );
  }
}

export function buildPluginScaffold(rawOptions = {}) {
  const options = normalizePluginScaffoldOptions(rawOptions);
  const pluginDir = path.join(options.projectRoot, 'src', 'plugins', 'local', options.pluginId);

  // Validate safe path before any file operations
  validateSafePluginPath(pluginDir);

  if (fs.existsSync(pluginDir) && !options.force) {
    throw new Error(`Plugin directory already exists: ${pluginDir}`);
  }

  const files = [];
  const manifest = buildManifest(options);

  files.push({
    relativePath: 'manifest.json',
    content: `${JSON.stringify(manifest, null, 2)}\n`,
  });
  files.push({
    relativePath: 'README.md',
    content: '',
  });
  files.push({
    relativePath: 'CHANGELOG.md',
    content: buildChangelog(),
  });

  if (options.type === 'new-route' || options.type === 'override') {
    files.push({
      relativePath: 'pages/index.astro',
      content: buildPublicPage(options),
    });
  }

  if (options.withAdmin || options.type === 'admin-page') {
    files.push({
      relativePath: 'pages/manage.astro',
      content: buildAdminPage(options),
    });
  }

  if (options.withApi) {
    files.push({
      relativePath: 'api/status.ts',
      content: buildApiHandler(options),
    });
  }

  if (options.withHooks) {
    files.push({
      relativePath: 'lib/hooks.ts',
      content: buildHookHandler(options),
    });
  }

  if (options.withMigration) {
    files.push({
      relativePath: 'migrations/0001_create_tables.sql',
      content: buildMigrationSql(options),
    });
    files.push({
      relativePath: 'migrations/0001_create_tables.rollback.sql',
      content: buildRollbackSql(options),
    });
  }

  const readmeFile = files.find((file) => file.relativePath === 'README.md');
  if (readmeFile) {
    readmeFile.content = buildReadme({ ...options, files });
  }

  return {
    options,
    pluginDir,
    manifest,
    files,
  };
}

export function writePluginScaffold(plan) {
  if (fs.existsSync(plan.pluginDir) && plan.options.force) {
    fs.rmSync(plan.pluginDir, { recursive: true, force: true });
  }

  fs.mkdirSync(plan.pluginDir, { recursive: true });

  for (const file of plan.files) {
    const targetPath = path.join(plan.pluginDir, file.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.content, 'utf-8');
  }

  return {
    pluginDir: plan.pluginDir,
    files: plan.files.map((file) => path.join(plan.pluginDir, file.relativePath)),
  };
}
