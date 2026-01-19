#!/usr/bin/env node
/**
 * Clinic-OS Feature Scaffolding Tool
 *
 * Creates a new feature in plugin-like structure, making it easy to
 * share or extract later.
 *
 * Usage:
 *   npm run create:feature -- --name vip-management --desc "VIP 회원 관리"
 *   npm run create:page -- --feature vip-management --name dashboard
 *   npm run create:widget -- --feature vip-management --name status-badge
 *   npm run create:api -- --feature vip-management --name members
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++;
    }
  }

  return options;
}

// Convert kebab-case to PascalCase
function toPascalCase(str) {
  return str.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
}

// Convert kebab-case to camelCase
function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Create directory if it doesn't exist
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Create feature structure
function createFeature(options) {
  const { name, desc } = options;

  if (!name) {
    console.error('Error: --name is required');
    console.error('Usage: npm run create:feature -- --name <feature-name> --desc "Description"');
    process.exit(1);
  }

  const featureDir = path.join(projectRoot, 'src', 'features', name);

  if (fs.existsSync(featureDir)) {
    console.error(`Error: Feature "${name}" already exists at ${featureDir}`);
    process.exit(1);
  }

  console.log(`\n🔧 Creating feature: ${name}\n`);

  // Create feature directories
  ensureDir(featureDir);
  ensureDir(path.join(featureDir, 'pages'));
  ensureDir(path.join(featureDir, 'components'));
  ensureDir(path.join(featureDir, 'api'));
  ensureDir(path.join(featureDir, 'lib'));

  // Create manifest.json
  const manifest = {
    id: name,
    name: toPascalCase(name),
    description: desc || `${name} feature`,
    version: '1.0.0',
    author: '',

    // Feature configuration
    routes: {
      admin: `/admin/${name}`,
      api: `/api/${name}`
    },

    // Database tables (use custom_ prefix)
    tables: [],

    // Hooks to core events
    hooks: [],

    // Widget slots
    widgets: [],

    // Required permissions
    permissions: [],

    // Feature settings schema
    settings: {}
  };

  fs.writeFileSync(
    path.join(featureDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Create index.ts (feature entry point)
  const indexContent = `/**
 * ${toPascalCase(name)} Feature
 * ${desc || ''}
 *
 * This is the entry point for the ${name} feature.
 * Export your components, hooks, and utilities here.
 */

// Export manifest
export { default as manifest } from './manifest.json';

// Export components
// export { default as StatusBadge } from './components/StatusBadge.astro';

// Export hooks/utilities
// export * from './lib/hooks';
`;

  fs.writeFileSync(path.join(featureDir, 'index.ts'), indexContent);

  // Create README
  const readmeContent = `# ${toPascalCase(name)}

${desc || `${name} feature for Clinic-OS`}

## Structure

\`\`\`
${name}/
├── manifest.json      # Feature configuration
├── index.ts          # Entry point
├── pages/            # Admin pages
├── components/       # UI components
├── api/              # API handlers
└── lib/              # Utilities & hooks
\`\`\`

## Installation

This feature is designed to be installable via:

\`\`\`bash
# Local development
# Files are symlinked to src/pages, src/components, etc.

# As a plugin (for sharing)
npm run feature:export -- --name ${name}
\`\`\`

## Database Tables

Tables should use \`custom_\` prefix to avoid conflicts:

\`\`\`sql
CREATE TABLE custom_${name.replace(/-/g, '_')}_items (
  id TEXT PRIMARY KEY,
  -- your fields here
  created_at INTEGER DEFAULT (unixepoch())
);
\`\`\`

## Hooks

Register hooks in manifest.json:

\`\`\`json
{
  "hooks": [
    { "event": "onPatientCreated", "handler": "onPatientCreated" }
  ]
}
\`\`\`

## Widgets

Register widgets for dashboard/patient detail:

\`\`\`json
{
  "widgets": [
    { "slot": "patient-detail-sidebar", "component": "StatusBadge" }
  ]
}
\`\`\`
`;

  fs.writeFileSync(path.join(featureDir, 'README.md'), readmeContent);

  // Create migration template
  const migrationContent = `-- ${toPascalCase(name)} Feature - Database Schema
-- Created: ${new Date().toISOString().split('T')[0]}
--
-- IMPORTANT: Use 'custom_' prefix for all tables to avoid conflicts with core schema.
-- This allows safe core updates without touching your custom tables.

-- Example table:
-- CREATE TABLE IF NOT EXISTS custom_${name.replace(/-/g, '_')}_items (
--   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
--   name TEXT NOT NULL,
--   description TEXT,
--   status TEXT DEFAULT 'active',
--   metadata TEXT DEFAULT '{}',
--   created_at INTEGER DEFAULT (unixepoch()),
--   updated_at INTEGER
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_custom_${name.replace(/-/g, '_')}_items_status
--   ON custom_${name.replace(/-/g, '_')}_items(status);
`;

  fs.writeFileSync(path.join(featureDir, 'migration.sql'), migrationContent);

  console.log('✅ Created feature structure:');
  console.log(`   ${featureDir}/`);
  console.log('   ├── manifest.json');
  console.log('   ├── index.ts');
  console.log('   ├── README.md');
  console.log('   ├── migration.sql');
  console.log('   ├── pages/');
  console.log('   ├── components/');
  console.log('   ├── api/');
  console.log('   └── lib/');

  console.log('\n📝 Next steps:');
  console.log(`   1. Edit manifest.json to configure your feature`);
  console.log(`   2. Add pages: npm run create:page -- --feature ${name} --name dashboard`);
  console.log(`   3. Add APIs: npm run create:api -- --feature ${name} --name items`);
  console.log(`   4. Add widgets: npm run create:widget -- --feature ${name} --name status-badge`);
  console.log(`   5. Edit migration.sql and run: npm run feature:migrate -- --name ${name}`);
  console.log('');
}

// Create page within a feature
function createPage(options) {
  const { feature, name } = options;

  if (!feature || !name) {
    console.error('Error: --feature and --name are required');
    console.error('Usage: npm run create:page -- --feature <feature-name> --name <page-name>');
    process.exit(1);
  }

  const featureDir = path.join(projectRoot, 'src', 'features', feature);

  if (!fs.existsSync(featureDir)) {
    console.error(`Error: Feature "${feature}" not found. Create it first with create:feature`);
    process.exit(1);
  }

  const pagePath = path.join(featureDir, 'pages', `${name}.astro`);
  const pascalName = toPascalCase(name);
  const featurePascal = toPascalCase(feature);

  const pageContent = `---
/**
 * ${featurePascal} - ${pascalName} Page
 * Feature: ${feature}
 */
import AdminLayout from '../../../../layouts/AdminLayout.astro';

// Get runtime env for DB access
const runtime = Astro.locals.runtime;
const db = runtime?.env?.DB;

// Example: Fetch data
// const { results } = await db.prepare('SELECT * FROM custom_${feature.replace(/-/g, '_')}_items').all();
---

<AdminLayout title="${pascalName} | ${featurePascal}">
  <div class="page-header">
    <h1>${pascalName}</h1>
  </div>

  <div class="page-content">
    <div class="card">
      <h2>Content</h2>
      <p>Add your page content here.</p>
    </div>
  </div>
</AdminLayout>

<style>
  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
</style>
`;

  fs.writeFileSync(pagePath, pageContent);

  // Also create symlink in src/pages/admin/
  const adminDir = path.join(projectRoot, 'src', 'pages', 'admin', feature);
  ensureDir(adminDir);

  const symlinkPath = path.join(adminDir, `${name}.astro`);
  const relativePath = path.relative(adminDir, pagePath);

  // Create symlink if it doesn't exist
  if (!fs.existsSync(symlinkPath)) {
    fs.symlinkSync(relativePath, symlinkPath);
    console.log(`✅ Created page: ${pagePath}`);
    console.log(`✅ Created symlink: ${symlinkPath} -> ${relativePath}`);
  } else {
    console.log(`✅ Created page: ${pagePath}`);
    console.log(`⚠️  Symlink already exists: ${symlinkPath}`);
  }

  console.log(`\n📍 Access at: /admin/${feature}/${name}`);
}

// Create API within a feature
function createApi(options) {
  const { feature, name } = options;

  if (!feature || !name) {
    console.error('Error: --feature and --name are required');
    console.error('Usage: npm run create:api -- --feature <feature-name> --name <endpoint-name>');
    process.exit(1);
  }

  const featureDir = path.join(projectRoot, 'src', 'features', feature);

  if (!fs.existsSync(featureDir)) {
    console.error(`Error: Feature "${feature}" not found. Create it first with create:feature`);
    process.exit(1);
  }

  const apiPath = path.join(featureDir, 'api', `${name}.ts`);
  const pascalName = toPascalCase(name);
  const featurePascal = toPascalCase(feature);
  const tableName = `custom_${feature.replace(/-/g, '_')}_${name.replace(/-/g, '_')}`;

  const apiContent = `import type { APIRoute } from 'astro';

/**
 * ${featurePascal} - ${pascalName} API
 * Feature: ${feature}
 * Endpoint: /api/${feature}/${name}
 */

// GET: List items
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // @ts-ignore
    const db = locals.runtime?.env?.DB;

    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Example query (adjust table name as needed)
    // const { results } = await db.prepare(\`
    //   SELECT * FROM ${tableName}
    //   ORDER BY created_at DESC
    // \`).all();

    return new Response(JSON.stringify({
      success: true,
      // items: results || []
      items: []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('${featurePascal} ${pascalName} API error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST: Create item
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // @ts-ignore
    const db = locals.runtime?.env?.DB;

    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Example insert (adjust as needed)
    // const id = crypto.randomUUID();
    // await db.prepare(\`
    //   INSERT INTO ${tableName} (id, name, ...)
    //   VALUES (?, ?, ...)
    // \`).bind(id, body.name, ...).run();

    return new Response(JSON.stringify({
      success: true,
      // id
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('${featurePascal} ${pascalName} API error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
`;

  fs.writeFileSync(apiPath, apiContent);

  // Also create symlink in src/pages/api/
  const apiDir = path.join(projectRoot, 'src', 'pages', 'api', feature);
  ensureDir(apiDir);

  const symlinkPath = path.join(apiDir, `${name}.ts`);
  const relativePath = path.relative(apiDir, apiPath);

  if (!fs.existsSync(symlinkPath)) {
    fs.symlinkSync(relativePath, symlinkPath);
    console.log(`✅ Created API: ${apiPath}`);
    console.log(`✅ Created symlink: ${symlinkPath} -> ${relativePath}`);
  } else {
    console.log(`✅ Created API: ${apiPath}`);
    console.log(`⚠️  Symlink already exists: ${symlinkPath}`);
  }

  console.log(`\n📍 Endpoint: /api/${feature}/${name}`);
}

// Create widget within a feature
function createWidget(options) {
  const { feature, name, slot } = options;

  if (!feature || !name) {
    console.error('Error: --feature and --name are required');
    console.error('Usage: npm run create:widget -- --feature <feature-name> --name <widget-name> [--slot dashboard]');
    process.exit(1);
  }

  const featureDir = path.join(projectRoot, 'src', 'features', feature);

  if (!fs.existsSync(featureDir)) {
    console.error(`Error: Feature "${feature}" not found. Create it first with create:feature`);
    process.exit(1);
  }

  const widgetPath = path.join(featureDir, 'components', `${toPascalCase(name)}.astro`);
  const pascalName = toPascalCase(name);
  const featurePascal = toPascalCase(feature);
  const widgetSlot = slot || 'dashboard';

  const widgetContent = `---
/**
 * ${featurePascal} - ${pascalName} Widget
 * Feature: ${feature}
 * Slot: ${widgetSlot}
 */

interface Props {
  patientId?: string;
  class?: string;
}

const { patientId, class: className } = Astro.props;

// Get runtime env for DB access
const runtime = Astro.locals.runtime;
const db = runtime?.env?.DB;

// Example: Fetch data
// let data = null;
// if (patientId && db) {
//   data = await db.prepare(\`
//     SELECT * FROM custom_${feature.replace(/-/g, '_')}_data WHERE patient_id = ?
//   \`).bind(patientId).first();
// }
---

<div class:list={["widget", "${feature}-${name}", className]}>
  <div class="widget-header">
    <h3>${pascalName}</h3>
  </div>
  <div class="widget-content">
    <p>Widget content here</p>
  </div>
</div>

<style>
  .widget {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .widget-header {
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .widget-header h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .widget-content {
    color: #6b7280;
    font-size: 0.875rem;
  }
</style>
`;

  fs.writeFileSync(widgetPath, widgetContent);

  // Update manifest.json with widget info
  const manifestPath = path.join(featureDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const existingWidget = manifest.widgets?.find(w => w.component === pascalName);
  if (!existingWidget) {
    if (!manifest.widgets) manifest.widgets = [];
    manifest.widgets.push({
      slot: widgetSlot,
      component: pascalName,
      description: `${pascalName} widget for ${widgetSlot}`
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  console.log(`✅ Created widget: ${widgetPath}`);
  console.log(`✅ Updated manifest.json with widget configuration`);
  console.log(`\n📍 Widget slot: ${widgetSlot}`);
  console.log('\nTo use this widget, import it in your page:');
  console.log(`   import ${pascalName} from '../../features/${feature}/components/${pascalName}.astro';`);
}

// Run migration for a feature
function migrateFeature(options) {
  const { name } = options;

  if (!name) {
    console.error('Error: --name is required');
    console.error('Usage: npm run feature:migrate -- --name <feature-name>');
    process.exit(1);
  }

  const featureDir = path.join(projectRoot, 'src', 'features', name);
  const migrationPath = path.join(featureDir, 'migration.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  console.log(`\n📦 Migrating feature: ${name}`);
  console.log(`   Migration file: ${migrationPath}`);
  console.log('\nRun the following command to apply:');
  console.log(`   npx wrangler d1 execute clinic-os-dev --local --file=${migrationPath}`);
  console.log('\nFor remote database:');
  console.log(`   npx wrangler d1 execute clinic-os-dev --file=${migrationPath}`);
}

// Export feature as plugin
function exportFeature(options) {
  const { name, output } = options;

  if (!name) {
    console.error('Error: --name is required');
    console.error('Usage: npm run feature:export -- --name <feature-name> [--output ./plugins]');
    process.exit(1);
  }

  const featureDir = path.join(projectRoot, 'src', 'features', name);

  if (!fs.existsSync(featureDir)) {
    console.error(`Error: Feature "${name}" not found at ${featureDir}`);
    process.exit(1);
  }

  const outputDir = output ? path.resolve(output) : path.join(projectRoot, 'plugins');
  const pluginDir = path.join(outputDir, name);

  ensureDir(pluginDir);

  // Copy feature files
  const copyRecursive = (src, dest) => {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      ensureDir(dest);
      fs.readdirSync(src).forEach(file => {
        copyRecursive(path.join(src, file), path.join(dest, file));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  };

  copyRecursive(featureDir, pluginDir);

  console.log(`\n✅ Exported feature to: ${pluginDir}`);
  console.log('\nYou can now:');
  console.log(`   1. Zip and share this directory`);
  console.log(`   2. Submit to plugin store: npx cos-cli plugin submit --path ${pluginDir}`);
}

// List all features
function listFeatures() {
  const featuresDir = path.join(projectRoot, 'src', 'features');

  if (!fs.existsSync(featuresDir)) {
    console.log('\n📦 No features directory found.');
    console.log('   Create your first feature with: npm run create:feature -- --name <name>');
    return;
  }

  const features = fs.readdirSync(featuresDir)
    .filter(f => fs.statSync(path.join(featuresDir, f)).isDirectory());

  if (features.length === 0) {
    console.log('\n📦 No features found.');
    console.log('   Create your first feature with: npm run create:feature -- --name <name>');
    return;
  }

  console.log('\n📦 Features:\n');

  for (const feature of features) {
    const manifestPath = path.join(featuresDir, feature, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      console.log(`   ${feature}`);
      console.log(`   ├─ Name: ${manifest.name}`);
      console.log(`   ├─ Version: ${manifest.version}`);
      console.log(`   ├─ Description: ${manifest.description}`);
      console.log(`   └─ Routes: ${manifest.routes?.admin || 'N/A'}`);
      console.log('');
    }
  }
}

// Show help
function showHelp() {
  console.log(`
Clinic-OS Feature Scaffolding Tool

Usage:
  npm run create:feature -- --name <name> --desc "Description"
  npm run create:page -- --feature <name> --name <page>
  npm run create:api -- --feature <name> --name <endpoint>
  npm run create:widget -- --feature <name> --name <widget> [--slot dashboard]
  npm run feature:list
  npm run feature:migrate -- --name <name>
  npm run feature:export -- --name <name> [--output ./plugins]

Commands:
  create:feature    Create a new feature with full structure
  create:page       Add a page to an existing feature
  create:api        Add an API endpoint to an existing feature
  create:widget     Add a widget component to an existing feature
  feature:list      List all features
  feature:migrate   Show migration commands for a feature
  feature:export    Export feature as a plugin package

Options:
  --name            Feature or component name (kebab-case)
  --feature         Parent feature name (for page/api/widget)
  --desc            Feature description
  --slot            Widget slot (dashboard, patient-detail, sidebar, etc.)
  --output          Output directory for export

Examples:
  npm run create:feature -- --name vip-management --desc "VIP 회원 관리"
  npm run create:page -- --feature vip-management --name dashboard
  npm run create:api -- --feature vip-management --name members
  npm run create:widget -- --feature vip-management --name status-badge --slot patient-detail
`);
}

// Main
const options = parseArgs();
const command = process.argv[2];

if (command === 'create:feature' || command === 'feature') {
  createFeature(options);
} else if (command === 'create:page' || command === 'page') {
  createPage(options);
} else if (command === 'create:api' || command === 'api') {
  createApi(options);
} else if (command === 'create:widget' || command === 'widget') {
  createWidget(options);
} else if (command === 'feature:list' || command === 'list') {
  listFeatures();
} else if (command === 'feature:migrate' || command === 'migrate') {
  migrateFeature(options);
} else if (command === 'feature:export' || command === 'export') {
  exportFeature(options);
} else if (command === 'help' || options.help) {
  showHelp();
} else {
  showHelp();
}
