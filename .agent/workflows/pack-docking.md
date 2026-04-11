---
description: Package current work into a docking package (.zip) for distribution
category: dev
---

# Docking Package Creation

Package developed features into a distributable `.zip` for client deployment.

## Prerequisites
- Feature complete and tested
- Changed file list known

## Steps

### 1. Collect Package Info
- Package ID: `DP-XXX` format (e.g., `DP-001`)
- Package name: English slug (e.g., `alimtalk-proxy`)
- Summary: one-line change description
- Changed files: added/modified/deleted

### 2. Create Structure
```bash
mkdir -p .docking/{DP-ID}-{NAME}/{files,migrations,patches}
```

### 3. Write manifest.yaml
```yaml
id: {DP-ID}
name: {NAME}
version: 1.0.0
created: {TODAY}
author: Clinic-OS Team
requires:
  base: ">=1.0.0"
  packages: []
summary: "{SUMMARY}"
files:
  - action: create|modify|delete
    path: {TARGET_PATH}
    source: files/{FILE_PATH}
migrations: []
env_vars: []
verification:
  - {VERIFICATION_STEP}
```

### 4. Copy Files
```bash
cp {SOURCE_PATH} .docking/{DP-ID}-{NAME}/files/{TARGET_PATH}
```

### 5. Write instructions.md
Step-by-step application guide for the receiving agent.

### 6. Package
```bash
cd .docking && zip -r {DP-ID}-{NAME}.zip {DP-ID}-{NAME}/ && mv -n {DP-ID}-{NAME}.zip ../
```

### 7. Verify
```bash
unzip -l {DP-ID}-{NAME}.zip
```

## Output
- `{DP-ID}-{NAME}.zip` in project root
- Client applies via `workflows/unpack-docking.md` (`npm run upgrade`)
