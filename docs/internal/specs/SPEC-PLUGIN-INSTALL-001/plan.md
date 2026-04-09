---
spec_id: SPEC-PLUGIN-INSTALL-001
version: "1.0.0"
created: "2026-02-06"
updated: "2026-02-06"
---

# SPEC-PLUGIN-INSTALL-001 Implementation Plan: Plugin Installation System

## 1. Milestone Overview

### Phase 1: Core Installation Script (Priority: High)

Create the `cos-plugin.sh` one-liner script with Device Auth, project root detection, download, extraction, and integrity verification. This is the foundation for the entire feature.

### Phase 2: Post-Install Automation (Priority: High)

Implement auto-migration execution, auto-rebuild, and auto-restart capabilities. These steps convert the script from "download only" to a complete installation automation.

### Phase 3: Update System (Priority: Medium)

Add plugin update checking and update execution, enabling ongoing plugin lifecycle management.

### Phase 4: HQ Dashboard Integration (Priority: Medium)

Add install command generation to the HQ marketplace page and the new check-updates API endpoint.

### Phase 5: Optional Enhancements (Priority: Low)

Plugin uninstall, dependency resolution, and progress display improvements.

---

## 2. Detailed Implementation Plan

### Phase 1: Core Installation Script

**M1-T1: Device Auth Module (Reuse from cos-setup.sh)**

- File: `hq/public/cos-plugin.sh` (new)
- Content:
  - `device_auth()`: Reuse Device Auth flow from `cos-setup.sh`
  - `open_browser()`: Platform-specific browser launch (macOS/Linux/WSL)
  - Poll loop with 5-second interval, 15-minute timeout
  - Access token stored in shell variable (no file persistence)
- Reference: `hq/public/cos-setup.sh` lines 117-199
- Related Requirements: REQ-PI-001, REQ-PI-006, REQ-PI-020

**M1-T2: Package Integrity Verification**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `verify_zip()`: Reuse ZIP validation from `cos-setup.sh`
  - `verify_hash()`: SHA-256 hash comparison using `shasum -a 256` or `sha256sum`
  - Cross-platform hash utility detection (macOS vs Linux)
  - Minimum file size check (10KB threshold)
  - ZIP magic byte check (PK\x03\x04)
- Reference: `hq/public/cos-setup.sh` lines 201-230
- Related Requirements: REQ-PI-002

**M1-T3: Idempotent Installation Handler**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `backup_existing_plugin()`: Rename existing directory with timestamp suffix
  - `check_db_metadata()`: Detect if metadata already exists
  - Backup naming: `{pluginId}.backup.{YYYYMMDDHHMMSS}`
  - Preservation of backup for manual rollback
- File: `src/pages/api/plugins/install.ts` (modify)
- Content:
  - Change INSERT to INSERT OR REPLACE (upsert behavior)
  - Add `updated_at` timestamp on re-installation
  - Log re-installation event in `plugin_events_local`
- Related Requirements: REQ-PI-004

**M1-T4: Main Script Orchestration**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `print_banner()`: Plugin installation banner with plugin ID
  - `check_requirements()`: Verify curl, unzip, node, npm
  - `detect_project_root()`: Walk up directory tree for wrangler.toml
  - `parse_args()`: Parse --version, --no-build, --no-restart, --local, --file, --yes flags
  - `main()`: Orchestrate all steps in sequence
  - Step counter display: `[3/12] Checking access...`
  - Color-coded output: green for success, red for error, yellow for warning
- Related Requirements: REQ-PI-005, REQ-PI-014, REQ-PI-024

**M1-T5: Plugin Download and Extraction**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `fetch_plugin_info()`: GET /api/plugins/{pluginId} with auth header
  - `check_access()`: POST /api/plugins/{pluginId}/check-access with access_token
  - `download_plugin()`: POST /api/plugins/{pluginId}/download, save to temp file
  - `extract_plugin()`: Unzip to src/plugins/{pluginId}/ or src/plugins/local/{pluginId}/
  - ZIP path traversal prevention: reject entries with `../`
  - Temp file cleanup on exit (trap handler)
  - Support for `--file` flag (offline installation from local ZIP)
  - Support for `--local` flag (install to local override directory)
- Related Requirements: REQ-PI-005, REQ-PI-015, REQ-PI-016, REQ-PI-021

**M1-T6: Permission Approval Flow**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `show_permissions()`: Display permissions with risk levels
  - Color-coded risk: RED for critical/high, YELLOW for medium, GREEN for low
  - Interactive y/N prompt with default reject
  - `--yes` flag bypass for automation
  - Permission details fetched from plugin info response
- Related Requirements: REQ-PI-007

### Phase 2: Post-Install Automation

**M2-T1: Auto-Migration Execution**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `run_migration()`: Detect migration.sql in extracted plugin
  - Read database_name from wrangler.toml via grep
  - Execute: `npx wrangler d1 execute {dbName} --local --file="{path}" --yes`
  - Fallback: Print manual command on failure
  - Log migration result
- Reference: `scripts/cos-cli.js` lines 363-388 (existing migration logic)
- Related Requirements: REQ-PI-008

**M2-T2: Auto-Rebuild**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `rebuild_project()`: Execute `npm run build` from project root
  - Stream build output in real-time
  - Capture exit code for success/failure detection
  - Skip if `--no-build` flag is set
  - Display build time duration
- Related Requirements: REQ-PI-009

**M2-T3: Auto-Restart Dev Server**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `detect_dev_server()`: Check if port 4321 is in use
  - Platform-specific port check: `lsof -i :4321` (macOS/Linux)
  - `restart_dev_server()`: SIGTERM existing process, wait, start new
  - Production detection: check NODE_ENV or absence of dev server
  - Skip if `--no-restart` flag is set
  - Background process launch with `nohup npm run dev > /dev/null 2>&1 &`
- Related Requirements: REQ-PI-010, REQ-PI-017

**M2-T4: Installation Reporting**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `report_to_hq()`: POST /api/plugins/{pluginId}/install
  - Include: version, permissionsGranted, installMethod ("cli-oneliner")
  - Fire-and-forget: do not fail installation on report failure
  - Capture and log any errors silently
- Related Requirements: REQ-PI-001 (traceability)

### Phase 3: Update System

**M3-T1: Update Check**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `check_updates()`: Read local manifests, query HQ
  - Read plugin IDs and versions from `src/plugins/*/manifest.json`
  - Also check `src/plugins/local/*/manifest.json`
  - Call `GET /api/plugins/check-updates?ids={ids}&versions={versions}`
  - Display formatted table with colorized status
  - Return exit code 0 if no updates, 1 if updates available
- File: `hq/src/index.js` (modify)
- Content:
  - Add `GET /api/plugins/check-updates` route
  - Accept `ids` and `versions` query parameters
  - Query plugin_versions table for latest approved versions per plugin
  - Return comparison results with changelog
- Related Requirements: REQ-PI-011

**M3-T2: Update Execution**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `update_plugin()`: Download and install latest version
  - Reuse existing installation flow (steps 7-12 from main)
  - Back up current version before update
  - `--all` flag: iterate over all plugins with updates
  - Update metadata in local installed_plugins table
- File: `scripts/cos-cli.js` (modify)
- Content:
  - Add `plugin check-updates` subcommand (calls check_updates logic)
  - Add `plugin update <pluginId>` subcommand
  - Add `plugin update --all` for batch updates
- Related Requirements: REQ-PI-012

### Phase 4: HQ Dashboard Integration

**M4-T1: Install Command Display**

- File: `hq/src/index.js` (modify)
- Content:
  - Add install command section to plugin detail page HTML
  - Display: `curl -fsSL https://clinic-os-hq.pages.dev/cos-plugin.sh | bash -s {pluginId}`
  - Include version-specific variant
  - "Copy to clipboard" button with JavaScript
  - Style matching existing HQ admin UI
  - Only shown for approved/published plugins
- Related Requirements: REQ-PI-013

### Phase 5: Optional Enhancements

**M5-T1: Plugin Uninstall**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `uninstall_plugin()`: Remove plugin directory and DB metadata
  - Check for `rollback.sql` and execute if present
  - Confirmation prompt before deletion
  - Rebuild after removal
- Related Requirements: REQ-PI-022

**M5-T2: Dependency Resolution**

- File: `hq/public/cos-plugin.sh`
- Content:
  - `check_dependencies()`: Read dependencies from manifest.json
  - Verify each dependency is installed locally
  - Display missing dependencies with install commands
  - Block installation if critical dependencies are missing
- Related Requirements: REQ-PI-023

---

## 3. Technical Approach

### 3.1 Script Architecture

```
hq/public/cos-plugin.sh
├── CONFIGURATION
│   ├── HQ_URL="https://clinic-os-hq.pages.dev"
│   ├── Color definitions (RED, GREEN, YELLOW, BLUE, CYAN, NC, BOLD)
│   └── Default flags (BUILD=true, RESTART=true, LOCAL=false)
│
├── HELPER FUNCTIONS
│   ├── print_banner()
│   ├── print_step() / print_success() / print_error() / print_warning()
│   ├── parse_args()
│   └── cleanup() (trap handler for temp files)
│
├── DETECTION
│   ├── check_requirements()          # curl, unzip, node, npm, npx
│   └── detect_project_root()         # Walk up dirs for wrangler.toml
│
├── AUTHENTICATION
│   ├── device_auth()                 # Full Device Auth flow
│   └── open_browser()                # Platform-specific browser open
│
├── PLUGIN OPERATIONS
│   ├── fetch_plugin_info()           # GET plugin details
│   ├── check_access()                # Verify client access
│   ├── show_permissions()            # Display + approve
│   ├── download_plugin()             # Download + verify
│   ├── verify_zip()                  # ZIP integrity check
│   ├── verify_hash()                 # SHA-256 verification
│   └── extract_plugin()              # Unzip with safety checks
│
├── POST-INSTALL
│   ├── run_migration()               # D1 migration execution
│   ├── rebuild_project()             # npm run build
│   ├── restart_dev_server()          # Signal + restart
│   └── report_to_hq()               # Installation reporting
│
├── UPDATE SYSTEM
│   ├── check_updates()               # Compare local vs HQ versions
│   └── update_plugin()               # Download + install update
│
└── ENTRY POINT
    └── main()                        # Parse args + orchestrate
```

### 3.2 API Modifications

**`src/pages/api/plugins/install.ts` Changes:**

Current behavior: INSERT fails if plugin already exists (409 Conflict).

New behavior:
- If plugin exists AND request includes `force: true`: UPDATE existing record
- Update fields: `installed_version`, `installed_version_code`, `permissions`, `permissions_granted`, `package_hash`, `status`
- Set `updated_at` timestamp
- Log event as `reinstall` in `plugin_events_local`

**`hq/src/index.js` New Route:**

```
GET /api/plugins/check-updates?ids=survey-tools,homepage-hero&versions=1.0.0,2.1.0
```

Logic:
1. Split `ids` and `versions` by comma
2. For each plugin ID, query `plugin_versions` for latest approved version
3. Compare semver with provided version
4. Return array of update results

### 3.3 cos-setup.sh Code Reuse Strategy

The following functions from `cos-setup.sh` are reused with minimal changes:

| Function | Changes from cos-setup.sh |
|----------|--------------------------|
| `device_auth()` | None (exact copy) |
| `open_browser()` | None (exact copy) |
| `verify_zip()` | None (exact copy) |
| `check_requirements()` | Add `npx` check |
| `print_*()` helpers | None (exact copy) |

New functions unique to `cos-plugin.sh`:
- `detect_project_root()`
- `fetch_plugin_info()`
- `check_access()`
- `show_permissions()`
- `download_plugin()`
- `extract_plugin()`
- `run_migration()`
- `rebuild_project()`
- `restart_dev_server()`
- `report_to_hq()`
- `check_updates()`
- `update_plugin()`

---

## 4. Risk Assessment and Mitigation

### 4.1 Technical Risks

**Risk 1: Build Failure After Extraction**

- Description: Plugin code may be incompatible with current Clinic-OS version
- Impact: Application cannot build; existing plugins may also break
- Mitigation: Plugin packages are validated on HQ before approval; backup of existing plugin enables rollback
- Recovery: User removes plugin directory and re-runs build

**Risk 2: Migration Failure**

- Description: SQL migration may fail due to existing tables or version mismatch
- Impact: Plugin features may not work correctly
- Mitigation: Migration failure does not abort installation; manual retry possible
- Recovery: Print manual migration command for user to run

**Risk 3: Dev Server Restart Race Condition**

- Description: Killing dev server and restarting may leave port in TIME_WAIT state
- Impact: New dev server cannot bind to port 4321
- Mitigation: Wait 3 seconds after SIGTERM; retry start with 5-second delay
- Recovery: User can manually start dev server

**Risk 4: ZIP Path Traversal Attack**

- Description: Malicious ZIP could contain `../` paths to overwrite files outside plugin dir
- Impact: Arbitrary file overwrite on client machine
- Mitigation: Check all ZIP entries for `../` before extraction; use `unzip` with target directory
- Detection: Log and abort if traversal paths detected

### 4.2 Business Risks

**Risk 5: Script Download Failure**

- Description: User behind corporate proxy cannot download cos-plugin.sh
- Impact: Cannot use one-liner installation
- Mitigation: Provide manual installation instructions as fallback; `--file` flag for offline install
- Alternative: `npx cos-cli plugin install --id X` still works

**Risk 6: Device Auth Timeout**

- Description: User does not complete browser verification in 15 minutes
- Impact: Installation aborted, user must restart
- Mitigation: Clear timeout message; suggest retrying; extend timeout if feedback indicates it is too short

---

## 5. Verification Plan

### 5.1 Unit Tests

- ZIP verification function (valid ZIP, corrupt ZIP, too small, wrong magic bytes)
- Hash verification function (matching hash, mismatching hash, missing hash)
- Project root detection (from project root, from subdirectory, from outside project)
- Permission display formatting (all risk levels)
- Semver comparison for update checking

### 5.2 Integration Tests

- Full installation lifecycle: auth -> download -> extract -> migrate -> build
- Re-installation over existing plugin (idempotent behavior)
- Update check with mixed results (some up to date, some outdated)
- Local override installation (`--local` flag)
- Offline installation (`--file` flag)
- HQ check-updates API endpoint

### 5.3 Platform Tests

- macOS (ARM64, Intel)
- Ubuntu 22.04 (WSL and native)
- Debian 12
- Various bash versions (4.x, 5.x)

### 5.4 Security Tests

- ZIP with path traversal entries (must be rejected)
- Modified package (hash mismatch must be detected)
- Expired Device Auth token handling
- Invalid plugin ID handling
- Access denied for restricted plugins

---

## 6. Traceability Matrix

| Task ID | Related Requirements | Verification Items |
|---------|---------------------|-------------------|
| M1-T1 | REQ-PI-001, REQ-PI-006, REQ-PI-020 | AC-PI-001, AC-PI-006, AC-PI-020 |
| M1-T2 | REQ-PI-002 | AC-PI-002 |
| M1-T3 | REQ-PI-004 | AC-PI-004 |
| M1-T4 | REQ-PI-005, REQ-PI-014, REQ-PI-024 | AC-PI-005, AC-PI-014, AC-PI-024 |
| M1-T5 | REQ-PI-005, REQ-PI-015, REQ-PI-016, REQ-PI-021 | AC-PI-005, AC-PI-015, AC-PI-016, AC-PI-021 |
| M1-T6 | REQ-PI-007 | AC-PI-007 |
| M2-T1 | REQ-PI-008 | AC-PI-008 |
| M2-T2 | REQ-PI-009 | AC-PI-009 |
| M2-T3 | REQ-PI-010, REQ-PI-017 | AC-PI-010, AC-PI-017 |
| M2-T4 | REQ-PI-001 | AC-PI-001 |
| M3-T1 | REQ-PI-011 | AC-PI-011 |
| M3-T2 | REQ-PI-012 | AC-PI-012 |
| M4-T1 | REQ-PI-013 | AC-PI-013 |
| M5-T1 | REQ-PI-022 | AC-PI-022 |
| M5-T2 | REQ-PI-023 | AC-PI-023 |
