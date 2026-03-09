#!/usr/bin/env node

import {
  buildPluginScaffold,
  writePluginScaffold,
} from './lib/plugin-scaffold.js';

function parseArgs(argv) {
  const options = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const inlineSeparator = arg.indexOf('=');
    if (inlineSeparator !== -1) {
      const key = arg.slice(2, inlineSeparator);
      const value = arg.slice(inlineSeparator + 1);
      options[key] = value;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? next : true;
    options[key] = value;
    if (value !== true) i += 1;
  }

  return options;
}

function printHelp() {
  console.log(`Clinic-OS Plugin Scaffold

Usage:
  npm run plugin:create -- --id vip-lounge
  npm run plugin:create -- --id vip-lounge --type new-route --with-api --with-admin --with-migration
  npm run plugin:create -- --id homepage-plus --type override --override-path /

Options:
  --id <plugin-id>            required
  --name <display name>       optional
  --desc <description>        optional
  --type <new-route|override|admin-page>
  --with-admin                add pages/manage.astro + manifest.pages
  --with-api                  add api/status.ts + manifest.apis
  --with-hooks                add lib/hooks.ts + manifest.hooks
  --with-migration            add migrations/*.sql + manifest.tables
  --permissions a,b,c         extra permissions
  --route-base /ext/foo       public base route for new-route
  --override-path /           override target path for override
  --dry-run                   print plan only
  --json                      print machine-readable result
  --force                     replace existing plugin directory
`);
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

try {
  const plan = buildPluginScaffold({
    id: args.id,
    name: args.name,
    desc: args.desc,
    description: args.description,
    type: args.type,
    author: args.author,
    category: args.category,
    permissions: args.permissions,
    withAdmin: args['with-admin'],
    withApi: args['with-api'],
    withHooks: args['with-hooks'],
    withMigration: args['with-migration'],
    routeBase: args['route-base'],
    overridePath: args['override-path'],
    dryRun: args['dry-run'],
    force: args.force,
    root: args.root,
  });

  const result = {
    success: true,
    pluginId: plan.options.pluginId,
    pluginDir: plan.pluginDir,
    dryRun: plan.options.dryRun,
    manifest: plan.manifest,
    files: plan.files.map((file) => file.relativePath),
    nextSteps: [
      `npm run build`,
      `관리자에서 /admin/hub/${plan.options.pluginId} 와 /ext/${plan.options.pluginId} 동작을 확인`,
    ],
  };

  if (!plan.options.dryRun) {
    writePluginScaffold(plan);
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n🧩 Plugin scaffold ${plan.options.dryRun ? 'planned' : 'created'}: ${plan.options.pluginId}`);
    console.log(`   Directory: ${plan.pluginDir}`);
    console.log(`   Files:`);
    for (const file of plan.files) {
      console.log(`   - ${file.relativePath}`);
    }
    console.log('\nNext steps:');
    for (const step of result.nextSteps) {
      console.log(`   - ${step}`);
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (args.json) {
    console.error(JSON.stringify({ success: false, error: message }, null, 2));
  } else {
    console.error(`❌ ${message}`);
  }
  process.exit(1);
}
