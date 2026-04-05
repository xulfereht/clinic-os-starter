# SPEC-PLUGIN-STORE-001: Plugin Store Install Flow Fix & Enhancement

> Status: DRAFT
> Created: 2026-02-11
> Author: MoAI

## 1. Problem Statement

The Plugin Store page (`/plugins/store`) has critical issues preventing the plugin installation flow from working end-to-end on local client instances:

1. **Install button broken**: `Uncaught ReferenceError: installPlugin is not defined` - Astro processes `<script>` tags as ES modules, so functions aren't globally accessible for `onclick` handlers
2. **No installed-state awareness**: Install buttons don't reflect whether a plugin is already installed
3. **No version-based update flow**: No UI indication when a newer version is available on HQ
4. **Uninstall button also broken**: Same module scoping issue as install

## 2. Root Cause Analysis

### 2.1 `installPlugin is not defined`

**File**: `src/pages/plugins/store.astro`

- Line 581: `<script>` (Astro default = ES module, functions NOT on `window`)
- Line 134: `onclick={`installPlugin('${plugin.id}')`}` (expects global function)
- Line 582: `async function installPlugin(pluginId: string)` (module-scoped, invisible to onclick)

**Same issue affects**: `uninstallPlugin`, `triggerRebuild`, `checkInstallStatus`

### 2.2 Install Status Check Exists But May Not Execute

- `checkInstallStatus()` function exists (line 755) and queries `/api/plugins/install-status`
- Unclear if it's being called on page load due to the module scoping issue

### 2.3 Version Comparison is Simple String Match

- `install-status.ts` line 66-84: `latestVersion !== installedVersion` (not semver)
- Works for exact matches but will break for pre-release versions or inconsistent formatting

## 3. Requirements (EARS Format)

### REQ-1: Fix Script Scoping (Critical)
**When** the Plugin Store page loads, **the system shall** make all interactive functions (`installPlugin`, `uninstallPlugin`, `triggerRebuild`, `checkInstallStatus`) available to inline `onclick` handlers.

**Acceptance**: Clicking "Install" button calls `installPlugin()` without ReferenceError.

### REQ-2: Show Installed State on Page Load
**When** the Plugin Store page loads, **the system shall** check which plugins are already installed locally and update their button states accordingly:
- **Installed + same version**: Button shows "Installed" (disabled, gray style)
- **Installed + older version**: Button shows "Update" (enabled, update style)
- **Not installed**: Button shows "Install" (enabled, primary style)

**Acceptance**: Already-installed plugins display correct button state without user interaction.

### REQ-3: Update Flow
**When** a user clicks the "Update" button, **the system shall** reinstall the plugin with the newer version using `force: true` parameter, following the same download/extract/rebuild flow as fresh install.

**Acceptance**: Plugin version updates from 1.0.0 to 1.1.0 and DB records reflect new version.

### REQ-4: Uninstall Confirmation
**When** a user clicks "Uninstall" on an installed plugin, **the system shall** confirm and remove the plugin record from `installed_plugins`, then update the button back to "Install".

**Acceptance**: Uninstalled plugin shows "Install" button; DB record removed.

## 4. Technical Approach

### 4.1 Fix Script Scoping

Change `<script>` to `<script is:inline>` in `store.astro`. This tells Astro to NOT process the script as a module, keeping functions in global scope.

**Trade-off**: Loses TypeScript processing in the script block. Since the functions use simple DOM APIs and fetch, this is acceptable. Remove TypeScript type annotations from the inline script.

### 4.2 Install Status on Page Load

The existing `checkInstallStatus()` function already handles this. Ensure:
1. It's called on `DOMContentLoaded`
2. It passes `latest_versions` query param with HQ versions from the server-rendered plugin list
3. Button states update correctly (Installed/Update/Install)

### 4.3 Update Button Logic

Modify `installPlugin()` to accept an optional `isUpdate` parameter:
- If updating, send `{ pluginId, force: true }` to `/api/plugins/install`
- The existing install API already supports `force` parameter (line 105 of install.ts)

### 4.4 Button State CSS

Add CSS classes:
- `.btn-installed`: Gray, disabled state
- `.btn-update`: Amber/orange, indicates update available
- `.btn-install`: Green, primary install state (existing)

## 5. Files to Modify

| File | Change | Scope |
|------|--------|-------|
| `src/pages/plugins/store.astro` | `<script>` → `<script is:inline>`, remove TS types, ensure `checkInstallStatus()` runs on load, add update button logic | Major |
| `src/pages/api/plugins/install.ts` | Verify `force` param works for re-installation (update flow) | Verify |
| `src/pages/api/plugins/install-status.ts` | Verify endpoint returns correct data | Verify |

## 6. Out of Scope

- Semantic version comparison (simple string comparison is sufficient for now)
- Plugin file cleanup on uninstall (separate concern)
- Production mode install (Cloudflare Pages - no filesystem access)
- Plugin migration execution (separate flow, already works)
- HQ admin approval workflow
- Permission re-approval on update

## 7. Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Click Install on new plugin | Download from HQ, extract, show rebuild banner |
| 2 | Click Install on already-installed plugin | Button should show "Installed" (disabled) |
| 3 | Plugin has newer version on HQ | Button shows "Update" |
| 4 | Click Update | Re-installs with force, updates version in DB |
| 5 | Click Uninstall | Removes from DB, button returns to "Install" |
| 6 | Page load with mix of installed/not-installed | Correct button states for all plugins |
| 7 | Install fails (network error) | Error message, button re-enabled |
