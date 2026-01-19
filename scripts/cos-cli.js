#!/usr/bin/env node
/**
 * Clinic-OS CLI Tool
 *
 * Usage:
 *   npx cos-cli developer register --license KEY --name "Name" --email "email@example.com"
 *   npx cos-cli plugin submit --license KEY --path ./my-plugin
 *   npx cos-cli plugin install --license KEY --id plugin-id
 *   npx cos-cli plugin update --license KEY --id plugin-id --path ./my-plugin
 *   npx cos-cli plugin list --license KEY
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const HQ_URL = process.env.COS_HQ_URL || 'https://clinic-os-hq.pages.dev';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];
  const options = {};

  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++;
    }
  }

  return { command, subcommand, options };
}

// Read license key from options or .cos-license file
function getLicenseKey(options) {
  if (options.license) return options.license;

  // Try to read from .cos-license file
  const licensePaths = [
    join(process.cwd(), '.cos-license'),
    join(process.env.HOME || '', '.cos-license')
  ];

  for (const path of licensePaths) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8').trim();
    }
  }

  console.error('Error: License key required. Use --license KEY or create a .cos-license file');
  process.exit(1);
}

// Register as a developer
async function developerRegister(options) {
  const licenseKey = getLicenseKey(options);

  if (!options.name || !options.email) {
    console.error('Error: --name and --email are required');
    process.exit(1);
  }

  console.log('Registering developer...');

  const res = await fetch(`${HQ_URL}/api/plugins/developers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      name: options.name,
      email: options.email,
      organization: options.organization || null
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Error: ${data.error || 'Registration failed'}`);
    process.exit(1);
  }

  console.log('Developer registration successful!');
  console.log(`Developer ID: ${data.developer?.id || 'N/A'}`);
}

// Submit a plugin
async function pluginSubmit(options) {
  const licenseKey = getLicenseKey(options);

  if (!options.path) {
    console.error('Error: --path is required (path to plugin directory)');
    process.exit(1);
  }

  const pluginPath = join(process.cwd(), options.path);

  // Check if manifest.json exists
  const manifestPath = join(pluginPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`Error: manifest.json not found in ${pluginPath}`);
    process.exit(1);
  }

  // Read manifest
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (!manifest.id || !manifest.name || !manifest.version) {
    console.error('Error: manifest.json must have id, name, and version');
    process.exit(1);
  }

  console.log(`Submitting plugin: ${manifest.name} v${manifest.version}`);

  // Create zip file
  const zipPath = `/tmp/${manifest.id}-${manifest.version}.zip`;
  console.log('Creating package...');

  try {
    execSync(`cd "${pluginPath}" && zip -r "${zipPath}" . -x "*.git*" -x "node_modules/*" -x ".DS_Store"`, {
      stdio: 'pipe'
    });
  } catch (e) {
    console.error('Error creating zip file:', e.message);
    process.exit(1);
  }

  // Read zip file and encode as base64
  const zipData = readFileSync(zipPath);
  const packageData = zipData.toString('base64');
  const packageSize = zipData.length;

  // Calculate hash
  const hash = createHash('sha256').update(zipData).digest('hex');

  console.log(`Package size: ${(packageSize / 1024).toFixed(1)} KB`);
  console.log(`Package hash: ${hash.substring(0, 16)}...`);

  // Submit to HQ
  console.log('Uploading to HQ...');

  const res = await fetch(`${HQ_URL}/api/plugins/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      manifest,
      packageData,
      changelog: options.changelog || `Initial release v${manifest.version}`
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Error: ${data.error || 'Submission failed'}`);
    process.exit(1);
  }

  console.log('');
  console.log('Plugin submitted successfully!');
  console.log('Status: pending review');
  console.log('');
  console.log('Your plugin will be reviewed by the Clinic-OS team.');
  console.log('Once approved, it will be available in the plugin store.');

  // Cleanup
  execSync(`rm -f "${zipPath}"`);
}

// Find project root (where package.json is)
function findProjectRoot() {
  let dir = process.cwd();
  while (dir !== '/') {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return process.cwd();
}

// Update installed.json
function updateInstalledJson(pluginId, manifest, version) {
  const projectRoot = findProjectRoot();
  const installedPath = join(projectRoot, 'src/plugins/installed.json');

  let installed = [];
  if (existsSync(installedPath)) {
    try {
      installed = JSON.parse(readFileSync(installedPath, 'utf8'));
    } catch (e) {
      installed = [];
    }
  }

  // Remove existing entry if any
  installed = installed.filter(p => p.id !== pluginId);

  // Add new entry
  installed.push({
    id: pluginId,
    version,
    installedAt: Math.floor(Date.now() / 1000),
    source: 'hq'
  });

  // Ensure directory exists
  const pluginsDir = dirname(installedPath);
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
  }

  writeFileSync(installedPath, JSON.stringify(installed, null, 2));
}

// Install a plugin
async function pluginInstall(options) {
  const licenseKey = getLicenseKey(options);

  if (!options.id) {
    console.error('Error: --id is required (plugin ID)');
    process.exit(1);
  }

  console.log(`Installing plugin: ${options.id}`);

  // Check access first
  const accessRes = await fetch(`${HQ_URL}/api/plugins/${options.id}/check-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey })
  });

  const accessData = await accessRes.json();

  if (!accessData.hasAccess) {
    console.error(`Error: ${accessData.error || 'Access denied'}`);
    if (accessData.plugin?.price) {
      console.error(`This plugin requires purchase: ${accessData.plugin.price.toLocaleString()} KRW`);
    }
    process.exit(1);
  }

  // Get download info with package data
  console.log('Downloading plugin package...');
  const downloadRes = await fetch(`${HQ_URL}/api/plugins/${options.id}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      version: options.version || null,
      includePackage: true  // Request package data
    })
  });

  const downloadData = await downloadRes.json();

  if (!downloadRes.ok) {
    console.error(`Error: ${downloadData.error || 'Download failed'}`);
    process.exit(1);
  }

  const download = downloadData.download;

  console.log(`Version: ${download.version}`);
  console.log(`Permissions: ${download.permissions?.length || 0}`);

  // Show permissions
  if (download.permissions && download.permissions.length > 0) {
    console.log('');
    console.log('This plugin requires the following permissions:');
    for (const perm of download.permissions) {
      const permId = typeof perm === 'string' ? perm : perm.id;
      console.log(`  - ${permId}`);
    }
  }

  // Extract plugin code to src/plugins/{pluginId}/
  console.log('');
  console.log('Extracting plugin code...');

  const projectRoot = findProjectRoot();
  const pluginDir = join(projectRoot, 'src/plugins', options.id);

  // Remove existing plugin directory if exists
  if (existsSync(pluginDir)) {
    console.log(`Removing existing plugin at ${pluginDir}...`);
    rmSync(pluginDir, { recursive: true, force: true });
  }

  // Create plugin directory
  mkdirSync(pluginDir, { recursive: true });

  // Check if package data is included
  if (download.packageData) {
    // Decode base64 package data
    const zipPath = `/tmp/${options.id}-${download.version}.zip`;
    const zipData = Buffer.from(download.packageData, 'base64');
    writeFileSync(zipPath, zipData);

    // Verify hash if provided
    if (download.packageHash) {
      const calculatedHash = createHash('sha256').update(zipData).digest('hex');
      if (calculatedHash !== download.packageHash) {
        console.error('Error: Package hash mismatch! Download may be corrupted.');
        process.exit(1);
      }
      console.log('Package verified.');
    }

    // Extract zip to plugin directory
    try {
      execSync(`unzip -o "${zipPath}" -d "${pluginDir}"`, { stdio: 'pipe' });
      console.log(`Extracted to ${pluginDir}`);
    } catch (e) {
      console.error('Error extracting plugin:', e.message);
      process.exit(1);
    }

    // Cleanup
    execSync(`rm -f "${zipPath}"`);
  } else if (download.downloadUrl) {
    // Alternative: download from URL
    console.log(`Downloading from ${download.downloadUrl}...`);
    const pkgRes = await fetch(download.downloadUrl);
    if (!pkgRes.ok) {
      console.error('Error downloading package from URL');
      process.exit(1);
    }
    const zipPath = `/tmp/${options.id}-${download.version}.zip`;
    const zipData = Buffer.from(await pkgRes.arrayBuffer());
    writeFileSync(zipPath, zipData);

    // Extract
    try {
      execSync(`unzip -o "${zipPath}" -d "${pluginDir}"`, { stdio: 'pipe' });
      console.log(`Extracted to ${pluginDir}`);
    } catch (e) {
      console.error('Error extracting plugin:', e.message);
      process.exit(1);
    }

    execSync(`rm -f "${zipPath}"`);
  } else {
    console.warn('Warning: No package data available. Plugin code not installed.');
    console.warn('You may need to manually install the plugin code to src/plugins/' + options.id);
  }

  // Update installed.json
  console.log('Updating installed plugins registry...');
  const manifest = existsSync(join(pluginDir, 'manifest.json'))
    ? JSON.parse(readFileSync(join(pluginDir, 'manifest.json'), 'utf8'))
    : { id: options.id, name: options.id };
  updateInstalledJson(options.id, manifest, download.version);

  // Run migration if exists
  const migrationPath = join(pluginDir, 'migration.sql');
  if (existsSync(migrationPath)) {
    console.log('');
    console.log('Migration file found: migration.sql');
    console.log('Run the following command to apply migrations:');
    console.log(`  npx wrangler d1 execute clinic-os-db --file=${migrationPath}`);
  }

  // Call local API to update DB metadata (if server is running)
  console.log('');
  console.log('Updating local database...');

  try {
    const localRes = await fetch('http://localhost:4321/api/plugins/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pluginId: options.id,
        version: download.version,
        grantedPermissions: download.permissions?.map(p => typeof p === 'string' ? p : p.id)
      })
    });

    if (localRes.ok) {
      console.log('Local database updated.');
    } else {
      const localData = await localRes.json();
      if (localData.error?.includes('already installed')) {
        console.log('Plugin already registered in database.');
      } else {
        console.warn(`Warning: ${localData.error || 'Could not update local database'}`);
        console.warn('You may need to register the plugin manually or restart the server.');
      }
    }
  } catch (e) {
    console.warn('Warning: Could not connect to local server.');
    console.warn('Make sure to restart the server to load the new plugin.');
  }

  console.log('');
  console.log('Plugin installed successfully!');
  console.log(`Location: ${pluginDir}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Restart your Clinic-OS dev server: npm run dev');
  console.log('2. Run migrations if needed (see above)');
  console.log('3. Access the plugin at: /admin/hub/' + options.id);
}

// Update a plugin version
async function pluginUpdate(options) {
  const licenseKey = getLicenseKey(options);

  if (!options.id || !options.path) {
    console.error('Error: --id and --path are required');
    process.exit(1);
  }

  const pluginPath = join(process.cwd(), options.path);
  const manifestPath = join(pluginPath, 'manifest.json');

  if (!existsSync(manifestPath)) {
    console.error(`Error: manifest.json not found in ${pluginPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (manifest.id !== options.id) {
    console.error(`Error: manifest.json id (${manifest.id}) doesn't match --id (${options.id})`);
    process.exit(1);
  }

  console.log(`Updating plugin: ${manifest.name} to v${manifest.version}`);

  // Create zip
  const zipPath = `/tmp/${manifest.id}-${manifest.version}.zip`;
  execSync(`cd "${pluginPath}" && zip -r "${zipPath}" . -x "*.git*" -x "node_modules/*" -x ".DS_Store"`, {
    stdio: 'pipe'
  });

  const zipData = readFileSync(zipPath);
  const packageData = zipData.toString('base64');

  console.log('Uploading new version...');

  const res = await fetch(`${HQ_URL}/api/plugins/${options.id}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      version: manifest.version,
      packageData,
      changelog: options.changelog || `Update to v${manifest.version}`,
      manifest
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Error: ${data.error || 'Update failed'}`);
    process.exit(1);
  }

  console.log('');
  console.log(`Version ${manifest.version} submitted successfully!`);
  console.log('Status: pending review');

  execSync(`rm -f "${zipPath}"`);
}

// List installed plugins
async function pluginList(options) {
  const licenseKey = getLicenseKey(options);

  console.log('Fetching installed plugins...');

  const res = await fetch('http://localhost:4321/api/plugins/installed', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    console.error('Error fetching installed plugins');
    process.exit(1);
  }

  const data = await res.json();
  const plugins = data.plugins || [];

  if (plugins.length === 0) {
    console.log('No plugins installed.');
    return;
  }

  console.log('');
  console.log('Installed Plugins:');
  console.log('==================');

  for (const plugin of plugins) {
    const status = plugin.status === 'active' ? '[ACTIVE]' : '[DISABLED]';
    console.log(`${status} ${plugin.name} v${plugin.installed_version}`);
    console.log(`         ID: ${plugin.id}`);
    console.log(`         Type: ${plugin.plugin_type || 'community'}`);
    console.log('');
  }
}

// Show help
function showHelp() {
  console.log(`
Clinic-OS CLI Tool

Usage:
  npx cos-cli <command> <subcommand> [options]

Commands:
  developer register    Register as a plugin developer
    --license KEY       Your Clinic-OS license key
    --name NAME         Developer/organization name
    --email EMAIL       Contact email
    --organization ORG  Organization name (optional)

  plugin submit         Submit a new plugin
    --license KEY       Your Clinic-OS license key
    --path PATH         Path to plugin directory
    --changelog TEXT    Changelog for this version (optional)

  plugin install        Install a plugin from the store
    --license KEY       Your Clinic-OS license key
    --id PLUGIN_ID      Plugin ID to install
    --version VERSION   Specific version (optional)

  plugin update         Submit a new version
    --license KEY       Your Clinic-OS license key
    --id PLUGIN_ID      Plugin ID
    --path PATH         Path to plugin directory
    --changelog TEXT    Changelog for this version

  plugin list           List installed plugins

Environment Variables:
  COS_HQ_URL           HQ API URL (default: https://clinic-os-hq.pages.dev)

License Key:
  You can provide the license key via:
  1. --license option
  2. .cos-license file in current directory
  3. ~/.cos-license file
`);
}

// Main
async function main() {
  const { command, subcommand, options } = parseArgs();

  if (!command || command === 'help' || options.help) {
    showHelp();
    return;
  }

  try {
    if (command === 'developer' && subcommand === 'register') {
      await developerRegister(options);
    } else if (command === 'plugin' && subcommand === 'submit') {
      await pluginSubmit(options);
    } else if (command === 'plugin' && subcommand === 'install') {
      await pluginInstall(options);
    } else if (command === 'plugin' && subcommand === 'update') {
      await pluginUpdate(options);
    } else if (command === 'plugin' && subcommand === 'list') {
      await pluginList(options);
    } else {
      console.error(`Unknown command: ${command} ${subcommand || ''}`);
      console.error('Use "npx cos-cli help" for usage information');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
