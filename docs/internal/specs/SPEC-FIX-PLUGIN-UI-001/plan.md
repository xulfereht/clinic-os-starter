# SPEC-FIX-PLUGIN-UI-001: Implementation Plan

## Reference

- **SPEC**: `.moai/specs/SPEC-FIX-PLUGIN-UI-001/spec.md`
- **Acceptance**: `.moai/specs/SPEC-FIX-PLUGIN-UI-001/acceptance.md`

---

## Technical Approach

### Root Cause

The `plugin-loader.ts` build-time registry assigns `source: 'local'` to ALL plugins in `src/plugins/local/`, including those originally downloaded from HQ. No downstream code (API endpoints or UI pages) cross-references the `installed_plugins` DB table's `source` column to distinguish HQ-installed plugins from self-developed ones.

### Solution Strategy

Add a DB cross-reference layer at the API level to correctly classify plugin origins, then propagate this classification through the UI rendering logic.

---

## Milestones

### Primary Goal: API Layer Fixes (REQ-001, REQ-007)

**Task 1.1**: Modify `/api/plugins/local.ts` to accept DB from locals

- Add `locals.runtime?.env?.DB` access
- Query `installed_plugins WHERE source = 'hq'` to build exclusion set
- Filter out HQ-installed plugins from filesystem scan results
- Add `isHqInstalled: false` field to response for clarity
- Handle DB unavailability gracefully (fall back to current behavior)

**Task 1.2**: Fix `/api/plugins/install-status.ts` registry merge logic

- In the build-time registry merge section (lines 103-122), check DB first for each registry plugin
- If plugin exists in DB with `source = 'hq'`, use the DB `source` value instead of registry's `'local'`
- This ensures store page correctly identifies HQ-installed plugins

### Secondary Goal: Plugin Management Page UI (REQ-002, REQ-003, REQ-004, REQ-006)

**Task 2.1**: Enhance "Installed Plugins" tab with source badges

- In `index.astro` frontmatter, query DB for `installed_plugins` with `source = 'hq'` to build a Set of HQ plugin IDs
- In the installed tab rendering (lines 82-147), add conditional badge:
  - If `plugin.source === 'core'`: show existing behavior
  - If `plugin.id` is in HQ set: show "HQ에서 설치됨" badge (blue/purple style)
  - Otherwise: show no special badge (self-developed, appears in "내 플러그인" tab)

**Task 2.2**: Fix "My Plugins" tab rendering logic

- The tab already fetches from `/api/plugins/local` which will now filter HQ plugins (Task 1.1)
- Verify the JavaScript rendering (line 836+) correctly shows only returned plugins
- No change needed to the rendering logic itself if the API response is correct

**Task 2.3**: Conditionally hide "HQ에 제출" submit button

- Since `/api/plugins/local` now excludes HQ plugins, the submit button will naturally only appear for self-developed plugins
- This is already handled by Task 1.1 (no additional UI logic needed)

**Task 2.4**: Fix source attribution display

- In the installed tab, show "HQ에서 설치됨" next to author for HQ-sourced plugins
- Ensure "내 플러그인" badge only appears in the "내 플러그인" tab

### Final Goal: Store Page Fix (REQ-005)

**Task 3.1**: Verify `checkInstallStatus()` ID matching

- Review that marketplace card `data-plugin-id` attributes match the IDs returned by `/api/plugins/install-status`
- The fix from Task 1.2 should resolve most status detection issues
- Verify "Installed" badge and disabled button appear correctly after API fix

---

## Architecture Design Direction

```
[Store Page]                    [Plugin Management Page]
     |                                |
     v                                v
/api/plugins/install-status     /api/plugins/local
     |                                |
     v                                v
installed_plugins DB            installed_plugins DB
  + plugin-loader registry        + filesystem scan
     |                                |
     v                                v
Correct source attribution      Exclude source='hq'
(DB source > registry source)   (Return only self-developed)
```

### Data Flow After Fix

1. **Build time**: `plugin-loader.ts` registers all plugins with `source: 'local'` for `local/*` (unchanged)
2. **Runtime - "Installed Plugins" tab**: `loadInstalledPlugins()` + DB query to add HQ badges
3. **Runtime - "My Plugins" tab**: `/api/plugins/local` scans filesystem, filters via DB, returns only self-developed
4. **Runtime - Store page**: `/api/plugins/install-status` merges DB (authoritative) + registry (fallback)

---

## Files to Modify

| File | Changes | Risk |
| ---- | ------- | ---- |
| `src/pages/api/plugins/local.ts` | Add DB access, query HQ plugin IDs, filter results | Low - dev-mode only, graceful fallback |
| `src/pages/api/plugins/install-status.ts` | Fix registry merge to prefer DB source | Low - additive change to existing logic |
| `src/pages/admin/plugins/index.astro` | Add HQ badge to installed tab, verify "내 플러그인" tab | Medium - UI rendering changes |
| `src/pages/admin/plugins/store.astro` | Verify install status detection after API fix | Low - may need no changes |

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| DB unavailable in dev mode | `/api/plugins/local` returns unfiltered results | Graceful fallback: if DB is null, return all plugins (current behavior) |
| Plugin ID mismatch between filesystem and DB | Some plugins not correctly classified | Use manifest `id` field as canonical ID, cross-reference with DB |
| Build-time vs runtime source inconsistency | Installed tab shows wrong badges | Query DB at page load time (SSR) to get authoritative source |
| Breaking existing toggle/install flow | Plugin enable/disable stops working | Only modify classification display, not functional endpoints |

---

## Expert Consultation Recommendations

- **expert-backend**: Recommended for DB query optimization and API endpoint modification patterns specific to Cloudflare D1
- **expert-frontend**: Recommended for Astro SSR rendering patterns and client-side JavaScript badge rendering
