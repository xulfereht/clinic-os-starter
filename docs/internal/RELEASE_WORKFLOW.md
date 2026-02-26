# Clinic-OS Release Workflow

This document outlines the process for releasing new versions of Clinic-OS.

## Overview

The release process is semi-automated. It involves:
1. **Versioning**: Bumping the version number.
2. **Packaging**: Creating the distribution zip files.
3. **Publishing**: Uploading artifacts to HQ (R2) and updating the HQ Database (D1).

## Prerequisites

- **Wrangler**: You must be logged in to Cloudflare (`npx wrangler login`).
- **Permissions**: Access to the `clinic-hq-db` (D1) and `clinic-packages` (R2) on the `brd-clinic` Cloudflare account.

## Workflow

### 1. Bump Version
Update the version number in `package.json` and `manifest.yaml`.

```bash
# Example: 1.0.6 -> 1.0.7
vim package.json
vim manifest.yaml
```

### 2. Create Packages
Generate the `full` package and the `starter-kit`.

```bash
# Generates release artifacts in dist-packages/
npm run pack-docking -- --type=full
npm run create-starter-kit
```

### 3. Publish Release (Automated)
Run the release script to upload artifacts and update the HQ database.

```bash
# Uploads to R2 and inserts record into D1 (versions table)
npm run release
```

This script will:
- Detect the version from `package.json`.
- Find the matching zip files in `dist-packages/`.
- Upload `clinic-os-vX.X.X-full.zip` to R2 `clinic-packages`.
- Update `starter-kit/latest.zip` in R2 `clinic-packages`.
- Insert a new record into `clinic-hq-db` -> `versions` table.

## Deployment (Application)

To update the running instance of Clinic-OS (Core) and HQ:

```bash
# Deploy Core App
npm run deploy

# Deploy HQ App (if hq/ changed)
cd hq
npm run deploy
```
