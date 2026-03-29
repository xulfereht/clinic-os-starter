---
spec_id: SPEC-PLUGIN-INSTALL-001
version: "1.0.0"
created: "2026-02-06"
updated: "2026-02-06"
---

# SPEC-PLUGIN-INSTALL-001 Acceptance Criteria: Plugin Installation System

## 1. Overview

This document defines acceptance criteria for all requirements in SPEC-PLUGIN-INSTALL-001 using Given-When-Then (Gherkin) format.

---

## 2. Acceptance Criteria

### AC-PI-001: License Validation on Plugin Operations

**Related Requirement:** REQ-PI-001

```gherkin
Feature: License Validation on Plugin Operations

  Scenario: Valid Device Auth token accepted
    Given a user has completed Device Auth successfully
    And received a valid access_token
    When a plugin download request is made with the access_token
    Then the request should be processed
    And the plugin package should be returned

  Scenario: Missing Device Auth token rejected
    Given a user has not completed Device Auth
    When a plugin download request is made without an access_token
    Then the response status code should be 401
    And the response should contain "Unauthorized" error

  Scenario: Expired Device Auth token rejected
    Given a user has a Device Auth token that has expired
    When a plugin download request is made with the expired token
    Then the response status code should be 401
    And the script should prompt the user to re-authenticate

  Scenario: Access check for restricted plugin denied
    Given a user with valid Device Auth
    And the plugin "premium-tool" has access_type "restricted"
    And the user does not have access to "premium-tool"
    When check-access is called for "premium-tool"
    Then the response should indicate "Access denied"
    And the script should exit with an error message
```

### AC-PI-002: Package Integrity Verification

**Related Requirement:** REQ-PI-002

```gherkin
Feature: Package Integrity Verification

  Scenario: Valid package passes verification
    Given a downloaded plugin package "survey-tools-1.0.0.zip"
    And the file size is greater than 10KB
    And the file starts with ZIP magic bytes (PK\x03\x04)
    And the SHA-256 hash matches the expected hash from HQ
    When verification is performed
    Then the verification should pass
    And extraction should proceed

  Scenario: Corrupted package fails hash check
    Given a downloaded plugin package with a modified byte
    And the SHA-256 hash does not match the expected hash
    When verification is performed
    Then the script should display "Package hash mismatch! Download may be corrupted."
    And the script should exit with error code 1
    And the temp file should be cleaned up

  Scenario: Invalid ZIP file rejected
    Given a downloaded file that is not a valid ZIP
    And the file does not start with ZIP magic bytes
    When verification is performed
    Then the script should display "Invalid package file"
    And the script should exit with error code 1

  Scenario: Too-small file detected as error response
    Given a downloaded file that is less than 10KB
    When verification is performed
    Then the script should display "Download failed - response too small"
    And the file should be inspected for error text content
```

### AC-PI-003: Build-Time Plugin Loading Preserved

**Related Requirement:** REQ-PI-003

```gherkin
Feature: Build-Time Plugin Loading Preserved

  Scenario: Plugin loads via import.meta.glob after installation
    Given a plugin "survey-tools" has been installed to src/plugins/survey-tools/
    And the plugin contains manifest.json
    When npm run build is executed
    Then the build should succeed
    And the plugin should be included in the build output via import.meta.glob

  Scenario: No runtime dynamic import introduced
    Given the cos-plugin.sh script
    When the entire installation process completes
    Then no changes should be made to src/lib/plugin-loader.ts
    And no dynamic import() calls should be added to any source file

  Scenario: Plugin accessible after build
    Given a plugin "survey-tools" was installed and built
    When the application starts
    Then getInstalledPlugins() should include "survey-tools"
    And the plugin's manifest should be loaded
```

### AC-PI-004: Idempotent Installation

**Related Requirement:** REQ-PI-004

```gherkin
Feature: Idempotent Installation

  Scenario: Re-installation backs up existing plugin
    Given plugin "survey-tools" is already installed at src/plugins/survey-tools/
    When cos-plugin.sh is run for "survey-tools" again
    Then the existing directory should be renamed to survey-tools.backup.{timestamp}
    And the new version should be extracted to src/plugins/survey-tools/
    And the backup should remain for manual rollback

  Scenario: Re-installation updates DB metadata
    Given plugin "survey-tools" metadata exists in installed_plugins table
    When the plugin is re-installed
    Then the installed_version should be updated
    And the installed_version_code should be updated
    And a "reinstall" event should be logged in plugin_events_local

  Scenario: Fresh installation on clean system
    Given plugin "survey-tools" is not installed
    And no src/plugins/survey-tools/ directory exists
    When cos-plugin.sh is run for "survey-tools"
    Then the plugin should be installed normally
    And no backup directory should be created
```

### AC-PI-005: One-Liner Plugin Installation Script

**Related Requirement:** REQ-PI-005

```gherkin
Feature: One-Liner Plugin Installation Script

  Scenario: Successful full installation lifecycle
    Given a user is in a Clinic-OS project directory
    And the plugin "survey-tools" is approved on HQ marketplace
    When the user runs: curl -fsSL https://clinic-os-hq.pages.dev/cos-plugin.sh | bash -s survey-tools
    Then the script should:
      | Step | Action |
      | 1 | Print installation banner |
      | 2 | Verify curl, unzip, node, npm are available |
      | 3 | Detect project root via wrangler.toml |
      | 4 | Complete Device Auth flow |
      | 5 | Fetch plugin info from HQ |
      | 6 | Check client access |
      | 7 | Display permissions and prompt approval |
      | 8 | Download plugin package |
      | 9 | Verify package integrity |
      | 10 | Extract to src/plugins/survey-tools/ |
      | 11 | Execute migration.sql if present |
      | 12 | Run npm run build |
      | 13 | Restart dev server if running |
      | 14 | Report installation to HQ |
    And the final output should include "Plugin installed successfully!"
    And the final output should include the admin hub URL

  Scenario: Missing plugin ID argument
    Given a user is in a Clinic-OS project directory
    When the user runs: curl -fsSL .../cos-plugin.sh | bash
    Then the script should display usage instructions
    And the script should exit with error code 1

  Scenario: Version-specific installation
    Given a user wants to install version 1.2.0 of "survey-tools"
    When the user runs: curl ... | bash -s survey-tools --version 1.2.0
    Then the script should download version 1.2.0 specifically
    And the installed version should be 1.2.0

  Scenario: No-build flag skips build
    Given a user wants to install without building
    When the user runs: curl ... | bash -s survey-tools --no-build
    Then the script should skip the npm run build step
    And the output should indicate "Build skipped (--no-build)"
```

### AC-PI-006: Device Auth for Plugin Installation

**Related Requirement:** REQ-PI-006

```gherkin
Feature: Device Auth for Plugin Installation

  Scenario: Successful Device Auth flow
    Given the HQ server is reachable
    When the script calls POST /api/auth/device
    Then a device_code and user_code should be returned
    And the user_code should be displayed in a styled terminal box
    And the browser should attempt to open the verification URL
    And the script should poll every 5 seconds
    When the user verifies the code in the browser
    Then the poll should return status "complete" with access_token
    And the script should proceed with the access_token

  Scenario: Device Auth timeout after 15 minutes
    Given the Device Auth flow is initiated
    And the user does not verify within 15 minutes (180 poll attempts)
    When the timeout is reached
    Then the script should display "Authentication timed out"
    And the script should exit with error code 1

  Scenario: Device Auth server unreachable
    Given the HQ server is not reachable
    When the script calls POST /api/auth/device
    Then the script should display "Cannot reach HQ server"
    And the script should exit with error code 1
```

### AC-PI-007: Permission Approval in CLI

**Related Requirement:** REQ-PI-007

```gherkin
Feature: Permission Approval in CLI

  Scenario: High-risk permissions displayed and approved
    Given a plugin requests permissions:
      | Permission | Risk Level |
      | database:write | HIGH |
      | patients:read | MEDIUM |
      | settings:read | LOW |
    When the permissions are displayed in the terminal
    Then HIGH risk permissions should be highlighted in red/yellow
    And MEDIUM risk permissions should be in yellow
    And LOW risk permissions should be in default color
    When the user types "y"
    Then the installation should proceed

  Scenario: Permissions rejected by user
    Given a plugin requests HIGH risk permissions
    When the user types "n" or presses Enter (default)
    Then the script should display "Installation cancelled"
    And the script should exit with code 0

  Scenario: Auto-approve with --yes flag
    Given a plugin requests permissions
    When the user runs with --yes flag
    Then the permission prompt should be skipped
    And the installation should proceed automatically

  Scenario: Plugin with no special permissions
    Given a plugin requests no permissions
    When the installation proceeds
    Then the permission approval step should be skipped
    And the script should continue to download
```

### AC-PI-008: Auto-Migration Execution

**Related Requirement:** REQ-PI-008

```gherkin
Feature: Auto-Migration Execution

  Scenario: Migration file exists and executes successfully
    Given plugin "survey-tools" has been extracted
    And src/plugins/survey-tools/migration.sql exists
    And wrangler.toml contains database_name "my-clinic-db"
    When the migration step runs
    Then the command executed should be:
      npx wrangler d1 execute my-clinic-db --local --file="src/plugins/survey-tools/migration.sql" --yes
    And the output should include "Migration applied successfully"

  Scenario: Migration file does not exist
    Given plugin "simple-widget" has been extracted
    And src/plugins/simple-widget/migration.sql does not exist
    When the migration step runs
    Then the step should be skipped silently
    And the output should include "No migration found, skipping"

  Scenario: Migration fails
    Given plugin "broken-plugin" has an invalid migration.sql
    When the migration step runs
    Then the error should be displayed
    And the output should include "Migration failed"
    And the output should include the manual migration command
    And the installation should continue (not abort)
```

### AC-PI-009: Auto-Rebuild After Installation

**Related Requirement:** REQ-PI-009

```gherkin
Feature: Auto-Rebuild After Installation

  Scenario: Successful rebuild
    Given plugin code has been extracted to src/plugins/
    When npm run build is executed
    Then the build should complete successfully
    And the output should include build completion message
    And the build time should be displayed

  Scenario: Build failure
    Given plugin code has been extracted
    And the plugin contains a TypeScript error
    When npm run build is executed
    Then the build error should be displayed
    And the script should display "Build failed. You may need to fix the issue and run 'npm run build' manually."
    And the script should not roll back the extraction

  Scenario: Build skipped with --no-build flag
    Given the --no-build flag was provided
    When the build step is reached
    Then npm run build should not be executed
    And the output should indicate the build was skipped
```

### AC-PI-010: Auto-Restart Dev Server

**Related Requirement:** REQ-PI-010

```gherkin
Feature: Auto-Restart Dev Server

  Scenario: Dev server is running and gets restarted
    Given the build completed successfully
    And a process is listening on port 4321
    When the restart step executes
    Then the existing process on port 4321 should receive SIGTERM
    And the script should wait 3 seconds
    And npm run dev should be started in the background
    And the output should include "Dev server restarted"

  Scenario: Dev server is not running
    Given the build completed successfully
    And no process is listening on port 4321
    When the restart step executes
    Then no SIGTERM should be sent
    And the output should include "Start your dev server with: npm run dev"

  Scenario: Restart skipped with --no-restart flag
    Given the --no-restart flag was provided
    When the restart step is reached
    Then no restart should be attempted
    And the output should indicate restart was skipped
```

### AC-PI-011: Plugin Update Check

**Related Requirement:** REQ-PI-011

```gherkin
Feature: Plugin Update Check

  Scenario: Updates available for some plugins
    Given locally installed plugins:
      | Plugin ID | Local Version |
      | survey-tools | 1.0.0 |
      | homepage-hero | 2.1.0 |
    And HQ has latest versions:
      | Plugin ID | Latest Version |
      | survey-tools | 1.2.0 |
      | homepage-hero | 2.1.0 |
    When check-updates is executed
    Then the output should show:
      | Plugin ID | Local | Latest | Status |
      | survey-tools | 1.0.0 | 1.2.0 | Update available |
      | homepage-hero | 2.1.0 | 2.1.0 | Up to date |
    And the exit code should be 1 (updates available)

  Scenario: All plugins up to date
    Given all locally installed plugins match HQ latest versions
    When check-updates is executed
    Then the output should show "All plugins are up to date"
    And the exit code should be 0

  Scenario: No plugins installed
    Given no plugins are installed in src/plugins/
    When check-updates is executed
    Then the output should show "No plugins installed"
```

### AC-PI-012: Plugin Update Execution

**Related Requirement:** REQ-PI-012

```gherkin
Feature: Plugin Update Execution

  Scenario: Successful single plugin update
    Given plugin "survey-tools" version 1.0.0 is installed
    And version 1.2.0 is available on HQ
    When update is executed for "survey-tools"
    Then the current version should be backed up
    And version 1.2.0 should be downloaded and extracted
    And migrations should run if present
    And the project should be rebuilt
    And installed_plugins.installed_version should be "1.2.0"

  Scenario: Update all plugins
    Given multiple plugins have updates available
    When update is executed with --all flag
    Then each plugin with an update should be updated sequentially
    And a single rebuild should happen at the end (not per plugin)

  Scenario: Already up to date
    Given plugin "survey-tools" is at the latest version
    When update is executed for "survey-tools"
    Then the output should show "survey-tools is already up to date"
    And no download or extraction should occur
```

### AC-PI-013: HQ Install Command Generation

**Related Requirement:** REQ-PI-013

```gherkin
Feature: HQ Install Command Generation

  Scenario: Approved plugin shows install command
    Given plugin "survey-tools" is approved and published
    When an HQ admin views the plugin detail page
    Then the page should display the install command:
      curl -fsSL https://clinic-os-hq.pages.dev/cos-plugin.sh | bash -s survey-tools
    And a "Copy" button should be present
    And a version-specific install variant should be shown

  Scenario: Unapproved plugin does not show install command
    Given plugin "pending-plugin" has status "pending_review"
    When an HQ admin views the plugin detail page
    Then no install command should be displayed
```

### AC-PI-014: Project Root Detection

**Related Requirement:** REQ-PI-014

```gherkin
Feature: Project Root Detection

  Scenario: Script run from project root
    Given the current directory contains wrangler.toml
    And wrangler.toml references clinic-os
    When detect_project_root() is called
    Then the project root should be the current directory

  Scenario: Script run from subdirectory
    Given the current directory is src/plugins/
    And wrangler.toml exists 2 levels up
    When detect_project_root() is called
    Then the project root should be the grandparent directory

  Scenario: Script run outside project
    Given the current directory is /tmp/
    And no wrangler.toml exists in any parent directory (up to 5 levels)
    When detect_project_root() is called
    Then the script should display "This command must be run from within a Clinic-OS project directory."
    And the script should exit with error code 1
```

### AC-PI-015: Local Override Installation

**Related Requirement:** REQ-PI-015

```gherkin
Feature: Local Override Installation

  Scenario: Install to local override directory
    Given the --local flag is provided
    When plugin "survey-tools" is installed
    Then the plugin should be extracted to src/plugins/local/survey-tools/
    And the plugin should take precedence over src/plugins/survey-tools/

  Scenario: Default installation to core directory
    Given the --local flag is not provided
    When plugin "survey-tools" is installed
    Then the plugin should be extracted to src/plugins/survey-tools/
```

### AC-PI-016: Offline Plugin Installation

**Related Requirement:** REQ-PI-016

```gherkin
Feature: Offline Plugin Installation

  Scenario: Install from local ZIP file
    Given a valid plugin ZIP at /tmp/survey-tools-1.0.0.zip
    When the user runs: cos-plugin.sh install survey-tools --file /tmp/survey-tools-1.0.0.zip
    Then Device Auth should be skipped
    And the HQ download step should be skipped
    And the local ZIP should be verified and extracted
    And migration, build, and restart should proceed normally

  Scenario: Invalid local ZIP file
    Given a corrupt file at /tmp/bad-plugin.zip
    When the user runs with --file /tmp/bad-plugin.zip
    Then the verification should fail
    And the script should display an integrity error
```

### AC-PI-017: Production vs Development Mode

**Related Requirement:** REQ-PI-017

```gherkin
Feature: Production vs Development Mode

  Scenario: Production environment detected
    Given NODE_ENV is set to "production"
    When the installation completes successfully
    Then the auto-restart step should be skipped
    And the output should include "Production environment detected."
    And the output should include "Please redeploy your application to activate the plugin."

  Scenario: Development environment detected
    Given NODE_ENV is not "production"
    And a dev server is running on port 4321
    When the installation completes successfully
    Then the auto-restart step should execute
```

### AC-PI-018: No Runtime Dynamic Loading

**Related Requirement:** REQ-PI-018

```gherkin
Feature: No Runtime Dynamic Loading

  Scenario: Verify no dynamic imports introduced
    Given the full installation is complete
    When searching the codebase for changes
    Then no eval() calls should be added
    And no Function() constructor calls should be added
    And no dynamic import() calls for plugins should be added
    And src/lib/plugin-loader.ts should remain unchanged
```

### AC-PI-019: No HQ-Initiated Push

**Related Requirement:** REQ-PI-019

```gherkin
Feature: No HQ-Initiated Push

  Scenario: All installations are client-initiated
    Given the plugin installation system is in use
    Then no WebSocket connection to HQ should exist for installation
    And no SSE endpoint for push notifications should exist
    And all plugin downloads must be initiated by the client
```

### AC-PI-020: No Credential Storage

**Related Requirement:** REQ-PI-020

```gherkin
Feature: No Credential Storage

  Scenario: Access token not persisted after script completion
    Given the installation script completes (success or failure)
    When checking the filesystem
    Then no .cos-credentials file should exist
    And no .cos-token file should exist
    And no environment file should contain the access token
    And the access token should only exist in shell memory during execution
```

### AC-PI-021: No Plugin Code Execution During Installation

**Related Requirement:** REQ-PI-021

```gherkin
Feature: No Plugin Code Execution During Installation

  Scenario: Only migration SQL is executed
    Given a plugin package contains:
      | File | Type |
      | manifest.json | Data (JSON) |
      | migration.sql | Declarative SQL |
      | lib/hooks.ts | Code (TypeScript) |
      | pages/index.astro | Code (Astro) |
    When the installation process runs
    Then only migration.sql should be executed
    And no TypeScript or JavaScript files from the package should be executed
    And no postinstall scripts should be run
```

### AC-PI-022: Plugin Uninstall Script (Optional)

**Related Requirement:** REQ-PI-022

```gherkin
Feature: Plugin Uninstall

  Scenario: Successful plugin uninstall
    Given plugin "survey-tools" is installed
    When the user runs: cos-plugin.sh uninstall survey-tools
    And the user confirms the uninstall prompt
    Then src/plugins/survey-tools/ should be removed
    And the installed_plugins record should be deleted
    And npm run build should be executed
    And the output should include "Plugin uninstalled successfully"

  Scenario: Uninstall with rollback migration
    Given plugin "survey-tools" has a rollback.sql file
    When uninstall is executed
    Then rollback.sql should be executed against the local D1
    And the tables should be dropped/modified as per rollback
```

### AC-PI-023: Plugin Dependency Resolution (Optional)

**Related Requirement:** REQ-PI-023

```gherkin
Feature: Plugin Dependency Resolution

  Scenario: Dependencies satisfied
    Given plugin "advanced-reporting" requires "survey-tools"
    And "survey-tools" is already installed
    When installing "advanced-reporting"
    Then the dependency check should pass
    And installation should proceed

  Scenario: Missing dependencies
    Given plugin "advanced-reporting" requires "survey-tools"
    And "survey-tools" is not installed
    When installing "advanced-reporting"
    Then the output should display:
      "Missing required plugin: survey-tools"
      "Install it first: curl ... | bash -s survey-tools"
    And the installation should be aborted
```

### AC-PI-024: Installation Progress Bar (Optional)

**Related Requirement:** REQ-PI-024

```gherkin
Feature: Installation Progress Display

  Scenario: Step-by-step progress shown
    Given a plugin installation is in progress
    Then the output should show step numbers like:
      [1/12] Checking requirements...
      [2/12] Detecting project root...
      [3/12] Authenticating...
    And completed steps should show green checkmarks
    And failed steps should show red X marks
```

---

## 3. Quality Gate Criteria

### 3.1 Test Coverage

- Shell script functions: Manual testing on macOS, Ubuntu, WSL
- API endpoint (check-updates): Integration tests required
- `install.ts` upsert logic: Unit test for INSERT and UPDATE paths
- ZIP verification: Unit tests for valid, corrupt, small, and wrong-format files
- Hash verification: Unit tests for match and mismatch scenarios

### 3.2 Performance Criteria

| Operation | Target |
|-----------|--------|
| Script startup to auth prompt | < 2 seconds |
| Device Auth polling | 5-second intervals, 15-minute timeout |
| Plugin download (5MB) | < 30 seconds |
| Hash verification | < 1 second |
| ZIP extraction | < 5 seconds |
| Migration execution | < 10 seconds |
| Full build (npm run build) | 30-90 seconds (project dependent) |

### 3.3 Security Criteria

- HTTPS for all HQ API calls
- Device Auth for human-in-the-loop verification
- SHA-256 package hash verification
- ZIP path traversal prevention
- No credential persistence on filesystem
- No plugin code execution before build step
- Permission approval for high-risk permissions
- Input sanitization on all API parameters

### 3.4 Compatibility Criteria

| Platform | Minimum Version |
|----------|----------------|
| macOS | 12 (Monterey) |
| Ubuntu | 20.04 |
| Debian | 11 |
| WSL | WSL2 on Windows 10/11 |
| Node.js | 18.x |
| Bash | 4.x |

---

## 4. Definition of Done

- [ ] cos-plugin.sh script created and hosted at HQ
- [ ] Device Auth flow works end-to-end (terminal -> browser -> poll -> token)
- [ ] Plugin download with hash verification works
- [ ] ZIP extraction with path traversal prevention works
- [ ] Permission approval prompt displays correctly
- [ ] Auto-migration executes when migration.sql exists
- [ ] Auto-rebuild (npm run build) succeeds after extraction
- [ ] Auto-restart detects and restarts dev server
- [ ] Re-installation (idempotent) creates backup and updates DB
- [ ] Update check correctly compares local vs HQ versions
- [ ] Update execution downloads and installs new version
- [ ] HQ dashboard shows install command for approved plugins
- [ ] --local flag installs to src/plugins/local/ directory
- [ ] --file flag enables offline installation
- [ ] --no-build and --no-restart flags work correctly
- [ ] --yes flag bypasses permission approval
- [ ] Production mode skips restart and shows deployment message
- [ ] No credentials persisted after script completion
- [ ] Tested on macOS, Ubuntu, and WSL
- [ ] Installation reporting to HQ works (fire-and-forget)
- [ ] Error messages are clear and actionable

---

## 5. Traceability Matrix

| Acceptance Criteria | Requirement ID | plan.md Task |
|---------------------|----------------|--------------|
| AC-PI-001 | REQ-PI-001 | M1-T1, M2-T4 |
| AC-PI-002 | REQ-PI-002 | M1-T2 |
| AC-PI-003 | REQ-PI-003 | N/A (constraint) |
| AC-PI-004 | REQ-PI-004 | M1-T3 |
| AC-PI-005 | REQ-PI-005 | M1-T4, M1-T5 |
| AC-PI-006 | REQ-PI-006 | M1-T1 |
| AC-PI-007 | REQ-PI-007 | M1-T6 |
| AC-PI-008 | REQ-PI-008 | M2-T1 |
| AC-PI-009 | REQ-PI-009 | M2-T2 |
| AC-PI-010 | REQ-PI-010 | M2-T3 |
| AC-PI-011 | REQ-PI-011 | M3-T1 |
| AC-PI-012 | REQ-PI-012 | M3-T2 |
| AC-PI-013 | REQ-PI-013 | M4-T1 |
| AC-PI-014 | REQ-PI-014 | M1-T4 |
| AC-PI-015 | REQ-PI-015 | M1-T5 |
| AC-PI-016 | REQ-PI-016 | M1-T5 |
| AC-PI-017 | REQ-PI-017 | M2-T3 |
| AC-PI-018 | REQ-PI-018 | N/A (constraint) |
| AC-PI-019 | REQ-PI-019 | N/A (constraint) |
| AC-PI-020 | REQ-PI-020 | M1-T1 |
| AC-PI-021 | REQ-PI-021 | M1-T5 |
| AC-PI-022 | REQ-PI-022 | M5-T1 |
| AC-PI-023 | REQ-PI-023 | M5-T2 |
| AC-PI-024 | REQ-PI-024 | M1-T4 |
