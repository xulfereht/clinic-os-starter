# Atomic Update Manager

Blue-Green deployment implementation for clinic-os core updates.

## Concept

- **Blue**: Current stable version
- **Green**: New version being prepared
- Atomic swap only after all validations pass

## Files

- `atomic-update.js` - Core logic
- `worktree-manager.js` - Git worktree management
- `scripts/core-atomic-update.js` - CLI entry point
- `scripts/core-rollback.js` - Rollback CLI

## Usage

```bash
# Update to new version
npm run core:update v1.24.0

# With options
npm run core:update v1.24.0 -- --auto        # CI mode
npm run core:update v1.24.0 -- --validate-only # Validation only
npm run core:update v1.24.0 -- --dry-run      # Dry run

# Rollback
npm run core:rollback           # Rollback to last backup
npm run core:rollback -- --list # List available backups

# Status
npm run core:status             # Current version and history
```
