# SPEC-FIX-PLUGIN-UI-001: Acceptance Criteria

## Reference

- **SPEC**: `.moai/specs/SPEC-FIX-PLUGIN-UI-001/spec.md`
- **Plan**: `.moai/specs/SPEC-FIX-PLUGIN-UI-001/plan.md`

---

## AC-001: /api/plugins/local Filters HQ-Installed Plugins

### Scenario 1: HQ-installed plugin excluded from local API

```gherkin
Given a plugin "sample-plugin" exists in src/plugins/local/
  And the installed_plugins DB table has a row with id="sample-plugin" and source="hq"
When the GET /api/plugins/local endpoint is called
Then the response plugins array shall NOT contain "sample-plugin"
```

### Scenario 2: Self-developed plugin included in local API

```gherkin
Given a plugin "my-custom-plugin" exists in src/plugins/local/
  And the installed_plugins DB table has NO row with id="my-custom-plugin" and source="hq"
When the GET /api/plugins/local endpoint is called
Then the response plugins array shall contain "my-custom-plugin"
  And the plugin entry shall have invalid=false
```

### Scenario 3: Graceful fallback when DB is unavailable

```gherkin
Given a plugin "sample-plugin" exists in src/plugins/local/
  And the database is not available (DB is null)
When the GET /api/plugins/local endpoint is called
Then the response plugins array shall contain ALL plugins in src/plugins/local/
  And the response status shall be 200
```

---

## AC-002: "My Plugins" Tab Shows Only Self-Developed Plugins

### Scenario 1: HQ-installed plugin not shown in "My Plugins" tab

```gherkin
Given a plugin "hq-downloaded-plugin" is installed from HQ to src/plugins/local/
  And it has source="hq" in the installed_plugins DB table
When the user navigates to /admin/plugins and clicks the "내 플러그인" tab
Then "hq-downloaded-plugin" shall NOT appear in the tab content
```

### Scenario 2: Self-developed plugin shown in "My Plugins" tab

```gherkin
Given a plugin "my-dev-plugin" exists in src/plugins/local/
  And it does NOT have source="hq" in the installed_plugins DB table
When the user navigates to /admin/plugins and clicks the "내 플러그인" tab
Then "my-dev-plugin" shall appear in the tab content
  And it shall display the "내 플러그인" badge
```

---

## AC-003: HQ-Installed Plugins Appear in "Installed Plugins" Tab

### Scenario 1: HQ-installed local plugin shown with correct badge

```gherkin
Given a plugin "hq-theme" is installed from HQ to src/plugins/local/
  And it has source="hq" in the installed_plugins DB table
  And it is loaded by plugin-loader as source="local"
When the user navigates to /admin/plugins "설치된 플러그인" tab
Then "hq-theme" shall appear in the installed plugins list
  And it shall display an "HQ에서 설치됨" badge
```

### Scenario 2: Core plugin shown with correct badge

```gherkin
Given a plugin "core-seo" exists in src/plugins/ (core directory)
  And plugin-loader registers it with source="core"
When the user navigates to /admin/plugins "설치된 플러그인" tab
Then "core-seo" shall appear in the installed plugins list
  And it shall NOT display an "HQ에서 설치됨" badge
```

---

## AC-004: Submit Button Hidden for HQ-Downloaded Plugins

### Scenario 1: No submit button for HQ plugins

```gherkin
Given a plugin "hq-plugin" was downloaded from HQ
  And it has source="hq" in the installed_plugins DB table
When the "내 플러그인" tab content is rendered
Then "hq-plugin" shall NOT appear in the tab
  And therefore shall NOT have a "HQ에 제출" button visible
```

### Scenario 2: Submit button visible for self-developed plugins

```gherkin
Given a plugin "my-plugin" was developed locally
  And it does NOT have source="hq" in the installed_plugins DB table
When the "내 플러그인" tab content is rendered
Then "my-plugin" shall appear with a "HQ에 제출" button
```

---

## AC-005: Store Page Shows Correct Install Status

### Scenario 1: HQ-installed plugin shows "Installed" badge on store card

```gherkin
Given a plugin "marketplace-plugin" is available on the HQ marketplace
  And it was installed via HQ and has source="hq" in installed_plugins DB
When the user navigates to /admin/plugins/store
  And the checkInstallStatus() function completes
Then the marketplace card for "marketplace-plugin" shall show "Installed" state
  And the Install button shall be disabled with text "Installed"
```

### Scenario 2: Build-time registered plugin shows install status on store

```gherkin
Given a plugin "local-marketplace-plugin" exists in src/plugins/local/
  And it is registered in plugin-loader at build time
  And it has a matching entry in installed_plugins DB with source="hq"
When the store page checks install status via /api/plugins/install-status
Then the API response shall include the plugin with correct source="hq" and installed_version
  And the store card shall reflect the installed state
```

---

## AC-006: Source Attribution Is Accurate

### Scenario 1: Self-developed plugin shows correct attribution

```gherkin
Given a self-developed plugin with author="My Clinic" in manifest.json
When displayed in the "내 플러그인" tab
Then it shall show "My Clinic" as the author
  And it shall show the "내 플러그인" badge
  And it shall NOT show "HQ에서 설치됨" badge
```

### Scenario 2: HQ-installed plugin shows correct attribution in installed tab

```gherkin
Given an HQ-installed plugin with author="Plugin Developer" in manifest.json
  And it has source="hq" in the installed_plugins DB
When displayed in the "설치된 플러그인" tab
Then it shall show "Plugin Developer" as the author
  And it shall show "HQ에서 설치됨" badge
  And it shall NOT show "내 플러그인" badge
```

---

## AC-007: Install Status API Returns Correct Source

### Scenario 1: DB source takes precedence over registry source

```gherkin
Given a plugin "hq-plugin" exists in plugin-loader registry with source="local"
  And the installed_plugins DB has a row with id="hq-plugin" and source="hq"
When GET /api/plugins/install-status is called
Then the response for "hq-plugin" shall have source="hq"
  And it shall have the installed_version from the DB
```

### Scenario 2: Registry-only plugin retains registry source

```gherkin
Given a plugin "core-plugin" exists in plugin-loader registry with source="core"
  And the installed_plugins DB has NO row with id="core-plugin"
When GET /api/plugins/install-status is called
Then the response for "core-plugin" shall have source="core"
```

---

## Quality Gate Criteria

| Criteria | Threshold |
| -------- | --------- |
| All acceptance scenarios pass | 100% |
| No regression in plugin install/uninstall flow | Zero regressions |
| No regression in plugin enable/disable toggle | Zero regressions |
| Store page install status matches actual installed state | 100% accuracy |
| "내 플러그인" tab shows zero HQ-installed plugins | Zero false positives |
| "설치된 플러그인" tab shows all HQ-installed plugins with badge | 100% coverage |

---

## Verification Methods

1. **Manual Testing**: Navigate through all three pages (index installed tab, index "내 플러그인" tab, store page) with a mix of core, HQ-installed, and self-developed plugins
2. **API Testing**: Call `/api/plugins/local` and `/api/plugins/install-status` directly to verify response payloads
3. **DB Verification**: Query `installed_plugins` table to confirm `source` column values match expectations
4. **Cross-Reference**: Ensure filesystem state (src/plugins/local/) aligns with DB records and UI display

---

## Definition of Done

- [ ] `/api/plugins/local` excludes HQ-installed plugins from response
- [ ] "내 플러그인" tab shows only self-developed plugins
- [ ] "설치된 플러그인" tab shows HQ-installed plugins with "HQ에서 설치됨" badge
- [ ] "HQ에 제출" button does not appear for HQ-downloaded plugins
- [ ] Store page correctly shows "Installed" badge for all installed plugins
- [ ] Source attribution is accurate across all views
- [ ] `/api/plugins/install-status` prefers DB source over registry source
- [ ] No regressions in plugin install, uninstall, or toggle functionality
