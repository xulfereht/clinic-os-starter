---
id: SPEC-PLUGIN-INSTALL-001
version: "1.0.0"
status: draft
created: "2026-02-06"
updated: "2026-02-06"
author: "Claude"
priority: P1
tags: [plugin, installation, device-auth, cli, automation, one-liner, rebuild]
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | Claude | Initial version created |

---

# SPEC-PLUGIN-INSTALL-001: Plugin Installation System - One-Liner CLI with Device Auth

## 1. Overview

### 1.1 Background

Clinic-OS has a plugin marketplace hosted on HQ where developers submit plugins (ZIP + manifest) and HQ admins approve them. Clients can browse the marketplace via the web UI and click "install," but this only saves metadata to the local D1 database. The actual plugin code must be installed separately via a manual CLI command (`npx cos-cli plugin install --id X`), followed by a manual build (`npm run build`) and server restart.

The project already has a proven one-liner installation pattern for the starter kit:
```
curl -fsSL https://clinic-os-hq.pages.dev/cos-setup.sh | bash
```
This uses Device Auth (code displayed in terminal, user verifies in browser, polling confirms) and works across macOS, Linux, and WSL.

**Problem Statement:**
- Plugin installation requires 4+ manual steps: CLI install, migration, build, restart
- No one-liner script exists for plugin installation (unlike the starter kit)
- Web-based install only saves metadata; actual code is not downloaded
- No auto-migration execution during installation
- No auto-rebuild or restart after plugin code extraction
- No plugin update mechanism for checking or applying new versions
- The CLI tool (`cos-cli.js`) requires the user to already have a license key configured

### 1.2 Solution Summary

Create a `cos-plugin.sh` one-liner shell script (modeled on `cos-setup.sh`) that automates the full plugin installation lifecycle: authenticate via Device Auth, download the plugin package from HQ, extract to `src/plugins/{pluginId}/`, execute migrations, rebuild the project, and restart the dev server. Additionally, add an HQ dashboard page that generates the install command for each approved plugin, and implement a plugin update checking and updating mechanism.

### 1.3 Goals

- Provide a one-liner plugin installation command: `curl -fsSL https://clinic-os-hq.pages.dev/cos-plugin.sh | bash -s <pluginId>`
- Reuse the existing Device Auth flow from `cos-setup.sh`
- Auto-execute plugin migrations after code extraction
- Auto-rebuild the project (`npm run build`) after plugin installation
- Auto-restart the dev server if running
- Implement plugin update check and update flow
- Generate install commands on the HQ marketplace page for each approved plugin
- Display permission approval prompt in CLI before proceeding

### 1.4 Non-Goals

- Runtime dynamic loading (keep build-time `import.meta.glob()` bundling)
- HQ push-to-client architecture (keep client-pull model)
- Plugin monetization or payment system
- Plugin rating or review submission system (separate SPEC)
- Changing the plugin manifest schema
- Modifying the existing web-based install API behavior

---

## 2. Requirements (EARS Format)

### 2.1 Ubiquitous Requirements (Always Active)

**REQ-PI-001: License Validation on Plugin Operations**

> The system shall **always** validate the client's authentication before downloading or updating any plugin.

- Device Auth flow must complete before any download
- Access token obtained from Device Auth is used for HQ API calls
- Invalid or expired tokens must be rejected with clear error messages
- Existing `POST /api/plugins/{pluginId}/check-access` endpoint is used for access verification

**REQ-PI-002: Package Integrity Verification**

> The system shall **always** verify the SHA-256 hash of downloaded plugin packages before extraction.

- Hash is provided by HQ in the download response (`packageHash` field)
- Mismatch aborts installation with clear error message
- ZIP magic bytes verified before hash check (PK\x03\x04)
- Minimum file size threshold (10KB) to detect error responses

**REQ-PI-003: Build-Time Plugin Loading Preserved**

> The system shall **always** maintain the build-time `import.meta.glob()` pattern for plugin loading.

- Plugin code extracted to `src/plugins/{pluginId}/` (core) or `src/plugins/local/{pluginId}/` (local override)
- `manifest.json` presence in plugin directory triggers automatic recognition
- `npm run build` required after any plugin code change for bundling
- No runtime dynamic import mechanism introduced

**REQ-PI-004: Idempotent Installation**

> The system shall **always** handle re-installation of an already-installed plugin gracefully.

- If plugin directory already exists, back up to `src/plugins/{pluginId}.backup.{timestamp}/`
- If plugin metadata already exists in DB, update rather than fail
- Re-installation follows the same flow as fresh installation
- Backup is preserved for manual rollback

### 2.2 Event-Driven Requirements (Trigger-Response)

**REQ-PI-005: One-Liner Plugin Installation Script**

> **WHEN** a user runs `curl -fsSL https://clinic-os-hq.pages.dev/cos-plugin.sh | bash -s <pluginId>` **THEN** the system shall execute the full plugin installation lifecycle.

Installation lifecycle:
1. Print banner and verify requirements (curl, unzip, node, npm)
2. Detect Clinic-OS project root (look for `wrangler.toml` or `package.json` with clinic-os)
3. Execute Device Auth flow (reuse pattern from `cos-setup.sh`)
4. Fetch plugin info from HQ: `GET /api/plugins/{pluginId}`
5. Check access: `POST /api/plugins/{pluginId}/check-access`
6. Display permission list and prompt for approval
7. Download package: `POST /api/plugins/{pluginId}/download`
8. Verify package integrity (hash + ZIP validation)
9. Extract to `src/plugins/{pluginId}/`
10. Execute migration if `migration.sql` exists
11. Run `npm run build`
12. Restart dev server if running (detect via port 4321)
13. Report installation to HQ
14. Print success message with admin hub URL

Script arguments:
- `$1` (required): Plugin ID
- `--version <ver>` (optional): Specific version to install
- `--no-build` (optional): Skip build step
- `--no-restart` (optional): Skip restart step
- `--local` (optional): Install to `src/plugins/local/{pluginId}/` instead

**REQ-PI-006: Device Auth for Plugin Installation**

> **WHEN** the plugin install script starts **THEN** the system shall authenticate the user via Device Auth flow.

- Call `POST /api/auth/device` to obtain device_code and user_code
- Display user_code in a styled terminal box
- Open browser to verification_uri automatically
- Poll `GET /api/auth/device/poll?device_code={code}` every 5 seconds
- Timeout after 15 minutes (180 attempts at 5-second intervals)
- On success, store access_token for subsequent API calls
- On expiry, display clear error and exit

**REQ-PI-007: Permission Approval in CLI**

> **WHEN** a plugin requests permissions during installation **THEN** the system shall display the permission list with risk levels and require explicit user approval before proceeding.

Display format:
```
This plugin requests the following permissions:

  [HIGH]   database:write    - Can write to the database
  [MEDIUM] patients:read     - Can read patient data
  [LOW]    settings:read     - Can read site settings

Do you approve these permissions? (y/N):
```

- Dangerous permissions (critical/high risk) are highlighted in red/yellow
- User must type `y` or `yes` to proceed
- Default is reject (N) on empty input
- `--yes` flag can bypass confirmation for CI/CD automation

**REQ-PI-008: Auto-Migration Execution**

> **WHEN** a plugin package contains `migration.sql` **THEN** the system shall automatically execute the migration against the local D1 database.

- Detect `migration.sql` in extracted plugin directory
- Read database name from `wrangler.toml` (`database_name` field)
- Execute: `npx wrangler d1 execute {dbName} --local --file="{migrationPath}" --yes`
- Log migration success or failure
- On failure: warn but continue installation (migration can be retried manually)

**REQ-PI-009: Auto-Rebuild After Installation**

> **WHEN** plugin code is extracted successfully **THEN** the system shall automatically run `npm run build` to rebundle the application.

- Execute `npm run build` from project root
- Display build output in real-time
- On build failure: display error, suggest manual retry, do not roll back extraction
- Skip if `--no-build` flag is provided

**REQ-PI-010: Auto-Restart Dev Server**

> **WHEN** build completes successfully **AND** a dev server is detected on port 4321 **THEN** the system shall restart the dev server.

- Check if port 4321 is in use (dev server running)
- If running: send SIGTERM to the process, wait 3 seconds, then start `npm run dev` in background
- If not running: print message suggesting manual start
- Skip if `--no-restart` flag is provided
- For production: print message indicating manual deployment needed

**REQ-PI-011: Plugin Update Check**

> **WHEN** a user runs `cos-plugin.sh check-updates` or `npx cos-cli plugin check-updates` **THEN** the system shall compare local plugin versions against HQ and display available updates.

- Read all installed plugin manifests from `src/plugins/*/manifest.json`
- Query HQ for latest versions: `GET /api/plugins?ids={comma-separated-ids}`
- Compare semver versions
- Display update table:
```
Plugin Updates Available:

  Plugin ID        Local    Latest   Status
  survey-tools     1.0.0    1.2.0    Update available
  homepage-hero    2.1.0    2.1.0    Up to date
```

**REQ-PI-012: Plugin Update Execution**

> **WHEN** a user runs `cos-plugin.sh update <pluginId>` **THEN** the system shall download and install the latest version following the same lifecycle as fresh installation.

- Authenticate via Device Auth
- Back up current plugin directory
- Download latest version from HQ
- Extract, migrate, build, restart (same as REQ-PI-005 steps 7-13)
- Update metadata in local DB (`installed_plugins.installed_version`)
- `--all` flag updates all plugins with available updates

**REQ-PI-013: HQ Install Command Generation**

> **WHEN** an HQ admin views an approved plugin detail page **THEN** the system shall display a copy-able one-liner install command.

- Display on HQ plugin detail page:
```
Install Command:
curl -fsSL https://clinic-os-hq.pages.dev/cos-plugin.sh | bash -s survey-tools
```
- Include version-specific install option
- "Copy" button for clipboard
- Display alongside existing marketplace listing

### 2.3 State-Driven Requirements (Conditional)

**REQ-PI-014: Project Root Detection**

> **IF** the script is run from within a Clinic-OS project directory **THEN** the system shall auto-detect the project root.

Detection strategy (in order):
1. Check current directory for `wrangler.toml` with `clinic-os` reference
2. Check parent directories (up to 5 levels) for `wrangler.toml`
3. Check for `package.json` with `name` containing `clinic-os`
4. If not found: display error with guidance

> **IF** the script is run from outside any Clinic-OS project **THEN** the system shall display an error and exit.

Error message: "This command must be run from within a Clinic-OS project directory."

**REQ-PI-015: Local Override Installation**

> **IF** the `--local` flag is provided **THEN** the system shall install the plugin to `src/plugins/local/{pluginId}/` instead of `src/plugins/{pluginId}/`.

- Local plugins override core plugins with the same ID
- Local plugin directory is protected from `core:pull` operations
- Useful for client-specific plugin customizations

**REQ-PI-016: Offline Plugin Installation**

> **IF** the user provides a `--file <path.zip>` flag **THEN** the system shall install from the local ZIP file instead of downloading from HQ.

- Still verify package integrity (hash check if manifest provides expected hash)
- Still execute migrations and rebuild
- Skip Device Auth and HQ download steps
- Useful for air-gapped environments or development

**REQ-PI-017: Production vs Development Mode**

> **IF** the environment is detected as production (via `NODE_ENV=production` or absence of dev server) **THEN** the system shall skip auto-restart and display deployment instructions instead.

- Production detection: `NODE_ENV=production` env var or no port 4321 listener
- Print: "Production environment detected. Please redeploy your application to activate the plugin."
- Build step still runs regardless of environment

### 2.4 Unwanted Requirements (Prohibitions)

**REQ-PI-018: No Runtime Dynamic Loading**

> The system shall **not** introduce runtime dynamic import or module federation for plugins.

- All plugin loading remains through `import.meta.glob()` at build time
- No `eval()`, `Function()`, or dynamic `import()` for plugin code
- Plugin activation requires a build step

**REQ-PI-019: No HQ-Initiated Push**

> The system shall **not** allow HQ to push plugin installations to client systems.

- All installations are client-initiated (pull model)
- HQ only serves packages on request
- No WebSocket, SSE, or push notification channel for installation triggers

**REQ-PI-020: No Credential Storage in Script**

> The system shall **not** store access tokens, license keys, or credentials on the filesystem after script completion.

- Device Auth access token exists only in shell variable during script execution
- No `.cos-credentials` or similar file created
- Each script invocation requires fresh authentication

**REQ-PI-021: No Plugin Code Execution During Installation**

> The system shall **not** execute any code from the plugin package during the installation process (before the build step).

- Only `migration.sql` (declarative SQL) is executed
- No `postinstall` scripts from plugins
- No Node.js code from the plugin package runs during extraction
- Plugin code only executes after being bundled by the build step

### 2.5 Optional Requirements (Nice-to-Have)

**REQ-PI-022: Plugin Uninstall Script**

> **Where possible**, the system shall provide an uninstall command: `cos-plugin.sh uninstall <pluginId>`.

- Remove plugin directory from `src/plugins/{pluginId}/`
- Remove metadata from `installed_plugins` table
- Execute rollback migration if `rollback.sql` exists
- Rebuild after removal

**REQ-PI-023: Plugin Dependency Resolution**

> **Where possible**, the system shall check plugin dependencies before installation.

- If plugin manifest declares `dependencies: ["other-plugin"]`, verify the dependency is installed
- Display missing dependencies and suggest installation order

**REQ-PI-024: Installation Progress Bar**

> **Where possible**, the system shall display a progress bar during download and extraction.

- Use `curl -#` for download progress
- Display step-by-step progress: `[3/8] Extracting plugin...`

---

## 3. Technical Specification

### 3.1 Architecture Overview

```
                    CLIENT MACHINE
┌─────────────────────────────────────────────────┐
│                                                   │
│  Terminal                                         │
│  ┌─────────────────────────────────────────────┐ │
│  │ $ curl ... cos-plugin.sh | bash -s my-plugin│ │
│  └──────────────┬──────────────────────────────┘ │
│                 │                                  │
│  cos-plugin.sh  │                                  │
│  ┌──────────────▼──────────────────────────────┐ │
│  │ 1. Requirements Check                       │ │
│  │ 2. Project Root Detection                   │ │
│  │ 3. Device Auth ──────────────────────┐      │ │
│  │ 4. Plugin Info Fetch                 │      │ │
│  │ 5. Access Check                      │      │ │
│  │ 6. Permission Approval ◄─── User     │      │ │
│  │ 7. Package Download + Verify         │      │ │
│  │ 8. Extract to src/plugins/           │      │ │
│  │ 9. Run migration.sql (wrangler d1)   │      │ │
│  │ 10. npm run build                    │      │ │
│  │ 11. Restart dev server               │      │ │
│  │ 12. Report to HQ                     │      │ │
│  └──────────────────────────────────────┘      │ │
│                                          │      │ │
│  Browser                                 │      │ │
│  ┌───────────────────────────────────────▼────┐ │
│  │ HQ Verification Page: Enter code ABCD-1234 │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                        │
            HTTPS API   │
                        ▼
              CLINIC-OS HQ
┌─────────────────────────────────────────────────┐
│                                                   │
│  Existing Endpoints:                              │
│  ┌─────────────────────────────────────────────┐ │
│  │ POST /api/auth/device          → Device Auth│ │
│  │ GET  /api/auth/device/poll     → Poll Auth  │ │
│  │ GET  /api/plugins/{id}         → Plugin Info│ │
│  │ POST /api/plugins/{id}/check-access         │ │
│  │ POST /api/plugins/{id}/download → Package   │ │
│  │ POST /api/plugins/{id}/install  → Report    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  New Endpoints:                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ GET  /api/plugins/check-updates → Versions  │ │
│  │ GET  /cos-plugin.sh            → Script     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  R2 Storage:                                      │
│  ┌─────────────────────────────────────────────┐ │
│  │ plugin-packages/{pluginId}/{version}.zip    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
1. Plugin Installation Flow

   User ────▶ curl cos-plugin.sh | bash -s {pluginId}
                │
                ▼
          Verify Requirements (curl, unzip, node, npm)
                │
                ▼
          Detect Project Root (wrangler.toml search)
                │
                ▼
          Device Auth ────▶ POST /api/auth/device
                │                    │
                │            Display code in terminal
                │                    │
                │            User verifies in browser
                │                    │
                │            Poll /api/auth/device/poll
                │                    │
                ◄────────────────────┘ (access_token)
                │
                ▼
          GET /api/plugins/{pluginId} ────▶ Plugin info
                │
                ▼
          POST /api/plugins/{pluginId}/check-access
                │
                ▼
          Display permissions, prompt y/N
                │
                ▼
          POST /api/plugins/{pluginId}/download
                │
                ▼
          Verify hash + Extract ZIP ────▶ src/plugins/{pluginId}/
                │
                ▼
          migration.sql exists? ────▶ wrangler d1 execute
                │
                ▼
          npm run build ────▶ Rebundle with import.meta.glob()
                │
                ▼
          Dev server running? ────▶ Restart
                │
                ▼
          POST /api/plugins/{pluginId}/install ────▶ Report to HQ
                │
                ▼
          Print success + admin hub URL


2. Plugin Update Check Flow

   User ────▶ cos-plugin.sh check-updates
                │
                ▼
          Read src/plugins/*/manifest.json (local versions)
                │
                ▼
          GET /api/plugins/check-updates?ids=a,b,c
                │
                ▼
          Compare semver ────▶ Display update table
```

### 3.3 File Changes Required

**New Files:**

| File | Description |
|------|-------------|
| `hq/public/cos-plugin.sh` | One-liner plugin installation script (served as static file) |
| `scripts/cos-plugin-update.js` | Plugin update check utility (Node.js, called by cos-plugin.sh) |

**Modified Files:**

| File | Changes |
|------|---------|
| `hq/src/index.js` | Add `GET /api/plugins/check-updates` endpoint; add install command display to plugin detail page HTML |
| `scripts/cos-cli.js` | Add `plugin update` and `plugin check-updates` subcommands; improve `plugin install` to call cos-plugin.sh logic |
| `src/pages/api/plugins/install.ts` | Handle re-installation (upsert instead of insert-only); add migration tracking |

**Unchanged Files (Reference Only):**

| File | Role |
|------|------|
| `src/lib/plugin-loader.ts` | Build-time `import.meta.glob()` loading (no changes needed) |
| `src/pages/api/plugins/run/[...path].ts` | Plugin API execution (no changes needed) |
| `hq/public/cos-setup.sh` | Reference pattern for Device Auth flow |

### 3.4 New HQ API Endpoint

**GET /api/plugins/check-updates**

Query Parameters:
- `ids` (required): Comma-separated plugin IDs
- `versions` (required): Comma-separated current versions (same order as ids)

Response:
```json
{
  "updates": [
    {
      "pluginId": "survey-tools",
      "currentVersion": "1.0.0",
      "latestVersion": "1.2.0",
      "hasUpdate": true,
      "changelog": "Added new question types, fixed export bug"
    },
    {
      "pluginId": "homepage-hero",
      "currentVersion": "2.1.0",
      "latestVersion": "2.1.0",
      "hasUpdate": false,
      "changelog": null
    }
  ]
}
```

### 3.5 cos-plugin.sh Script Structure

```
cos-plugin.sh
├── Configuration (HQ_URL, colors, helpers)
├── print_banner()
├── check_requirements()          # curl, unzip, node, npm
├── detect_project_root()         # Find wrangler.toml
├── device_auth()                 # Reuse from cos-setup.sh
├── open_browser()                # Platform-specific
├── verify_zip()                  # Reuse from cos-setup.sh
├── fetch_plugin_info()           # GET /api/plugins/{id}
├── check_access()                # POST check-access
├── show_permissions()            # Display + prompt y/N
├── download_plugin()             # POST download + verify
├── extract_plugin()              # Unzip + backup existing
├── run_migration()               # wrangler d1 execute
├── rebuild_project()             # npm run build
├── restart_dev_server()          # Signal + restart
├── report_to_hq()               # POST install report
├── check_updates()               # Compare versions
├── update_plugin()               # Download + install update
├── main()                        # Orchestrate all steps
└── parse_args() + main "$@"
```

---

## 4. Constraints

### 4.1 Performance Requirements

- Script startup to Device Auth prompt: < 2 seconds
- Plugin download (typical 1-5MB package): < 30 seconds
- Migration execution: < 10 seconds (typical plugin migrations)
- Build time: dependent on project size (typically 30-90 seconds)

### 4.2 Compatibility Requirements

- macOS 12+ (Monterey and later)
- Linux (Ubuntu 20.04+, Debian 11+)
- WSL2 (Windows 10/11)
- Node.js 18+ (project requirement)
- Bash 4+ (script requirement)

### 4.3 Security Requirements

- All communication over HTTPS
- Device Auth for human-in-the-loop verification
- Package hash verification (SHA-256)
- No credential persistence on filesystem
- No plugin code execution before build step
- Permission approval required for high-risk permissions
- ZIP path traversal prevention (no `../` in extracted paths)

### 4.4 Dependency Requirements

- Existing HQ endpoints: `/api/auth/device`, `/api/auth/device/poll`, `/api/plugins/*`
- Existing tools: `curl`, `unzip`, `node`, `npm`, `npx wrangler`
- Existing patterns: `cos-setup.sh` (Device Auth), `cos-cli.js` (plugin install)

---

## 5. Traceability

| Requirement ID | plan.md Reference | acceptance.md Reference |
|----------------|-------------------|------------------------|
| REQ-PI-001 | M1-T1 | AC-PI-001 |
| REQ-PI-002 | M1-T2 | AC-PI-002 |
| REQ-PI-003 | N/A (constraint) | AC-PI-003 |
| REQ-PI-004 | M1-T3 | AC-PI-004 |
| REQ-PI-005 | M1-T4, M1-T5 | AC-PI-005 |
| REQ-PI-006 | M1-T1 | AC-PI-006 |
| REQ-PI-007 | M1-T6 | AC-PI-007 |
| REQ-PI-008 | M2-T1 | AC-PI-008 |
| REQ-PI-009 | M2-T2 | AC-PI-009 |
| REQ-PI-010 | M2-T3 | AC-PI-010 |
| REQ-PI-011 | M3-T1 | AC-PI-011 |
| REQ-PI-012 | M3-T2 | AC-PI-012 |
| REQ-PI-013 | M4-T1 | AC-PI-013 |
| REQ-PI-014 | M1-T4 | AC-PI-014 |
| REQ-PI-015 | M1-T5 | AC-PI-015 |
| REQ-PI-016 | M1-T5 | AC-PI-016 |
| REQ-PI-017 | M2-T3 | AC-PI-017 |
| REQ-PI-018 | N/A (constraint) | AC-PI-018 |
| REQ-PI-019 | N/A (constraint) | AC-PI-019 |
| REQ-PI-020 | M1-T1 | AC-PI-020 |
| REQ-PI-021 | M1-T5 | AC-PI-021 |
| REQ-PI-022 | M5-T1 | AC-PI-022 |
| REQ-PI-023 | M5-T2 | AC-PI-023 |
| REQ-PI-024 | M1-T4 | AC-PI-024 |
