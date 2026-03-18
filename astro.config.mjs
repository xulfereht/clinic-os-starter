// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

import { pathToFileURL } from 'node:url';

// Determine wrangler.toml path (Root vs Core/Client structure)
const getWranglerPath = () => {
  const rootWrangler = path.resolve(process.cwd(), 'wrangler.toml');
  if (fs.existsSync(rootWrangler)) return rootWrangler;

  const parentWrangler = path.resolve(process.cwd(), '..', 'wrangler.toml');
  if (fs.existsSync(parentWrangler)) return parentWrangler;

  return undefined;
};

const wranglerPath = getWranglerPath();
const persistencePath = wranglerPath ? path.join(path.dirname(wranglerPath), '.wrangler', 'state', 'v3') : undefined;

const readWranglerValue = (pattern) => {
  if (!wranglerPath || !fs.existsSync(wranglerPath)) return null;
  try {
    const content = fs.readFileSync(wranglerPath, 'utf-8');
    return content.match(pattern)?.[1] || null;
  } catch {
    return null;
  }
};

// Convert to file:// URL for Windows compatibility in @astrojs/cloudflare
// On Linux/WSL, we use the raw path because wrangler readFileSync doesn't support file:// strings there.
const configPath = wranglerPath ? (process.platform === 'win32' ? pathToFileURL(wranglerPath).href : wranglerPath) : undefined;

// Read clinic.json for license key (exists in client projects, not in template)
const getClinicConfig = () => {
  for (const dir of [process.cwd(), path.resolve(process.cwd(), '..')]) {
    const jsonPath = path.join(dir, 'clinic.json');
    if (fs.existsSync(jsonPath)) {
      try { return JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch { return null; }
    }
  }
  return null;
};
const clinicConfig = getClinicConfig();
const wranglerCloudflareUrl = readWranglerValue(/CLOUDFLARE_URL\s*=\s*"([^"]+)"/);
const wranglerProjectName = readWranglerValue(/name\s*=\s*"([^"]+)"/);
const resolvedSiteUrl = wranglerCloudflareUrl
  || (wranglerProjectName ? `https://${wranglerProjectName}.pages.dev` : null)
  || 'https://sample-clinic.com';

// Local page overrides: when src/pages/_local/{path} exists,
// its content replaces the core page at src/pages/{path} during build/dev.
// Astro's underscore convention excludes _local/ from routing.
// This allows clients to customize pages while keeping core updated via core:pull.
// Example: src/pages/_local/doctors/index.astro overrides src/pages/doctors/index.astro
function clinicLocalOverrides() {
  const pagesDir = path.resolve(process.cwd(), 'src', 'pages');
  const localDir = path.join(pagesDir, '_local');
  const warnedIgnoredOverrides = new Set();

  const isAdminRelativePage = (relative) => (
    relative === 'admin.astro'
    || relative.startsWith(`admin${path.sep}`)
  );

  const warnIgnoredOverride = (relative) => {
    if (warnedIgnoredOverrides.has(relative)) return;
    warnedIgnoredOverrides.add(relative);
    console.warn(`  ⚠️ Ignoring _local admin override: ${relative} (admin pages are core/plugin-only)`);
  };

  return {
    name: 'clinic-local-overrides',
    enforce: 'pre',
    load(id) {
      // Strip query parameters (Astro adds ?astro&type=script internally)
      const cleanId = id.split('?')[0];
      if (!cleanId.endsWith('.astro') || !cleanId.startsWith(pagesDir + path.sep)) return null;
      // Skip files already inside _local/ to avoid self-referencing
      if (cleanId.startsWith(localDir + path.sep)) return null;
      const relative = path.relative(pagesDir, cleanId);
      if (isAdminRelativePage(relative)) {
        const ignoredOverridePath = path.join(localDir, relative);
        if (fs.existsSync(ignoredOverridePath)) {
          warnIgnoredOverride(relative);
        }
        return null;
      }
      const overridePath = path.join(localDir, relative);
      if (fs.existsSync(overridePath)) {
        console.log(`  🔀 Local override: ${relative}`);
        return fs.readFileSync(overridePath, 'utf-8');
      }
      return null;
    },
    configureServer(server) {
      // Watch _local directory unconditionally (chokidar handles non-existent dirs)
      server.watcher.add(localDir);
      // Invalidate core module when its _local override changes
      server.watcher.on('change', (file) => {
        if (file.startsWith(localDir + path.sep)) {
          const relative = path.relative(localDir, file);
          if (isAdminRelativePage(relative)) {
            warnIgnoredOverride(relative);
            return;
          }
          const coreFile = path.join(pagesDir, relative);
          const mod = server.moduleGraph.getModuleById(coreFile);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: 'full-reload' });
          }
        }
      });
    }
  };
}

// https://astro.build/config
export default defineConfig({
  site: resolvedSiteUrl,
  output: 'server',

  // i18n Configuration
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en', 'ja', 'zh-hans', 'vi'],
    routing: {
      prefixDefaultLocale: false,
    }
  },

  vite: {
    plugins: [clinicLocalOverrides(), tailwindcss()],
    define: {
      '__CLINIC_LICENSE_KEY__': JSON.stringify(clinicConfig?.license_key || ''),
      '__CLINIC_CLIENT_ID__': JSON.stringify(clinicConfig?.client_id || ''),
    },
    optimizeDeps: {
      include: ['react', 'react-dom']
    },
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@lib': '/src/lib',
        '@layouts': '/src/layouts'
      }
    }
  },

  integrations: [react()],
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
      configPath: configPath,
      persist: persistencePath ? { path: persistencePath } : true
    },
  })
});
