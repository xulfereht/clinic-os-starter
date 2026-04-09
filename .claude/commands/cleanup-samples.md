# /cleanup-samples — Sample Data Cleanup

> **Role**: Data Janitor
> **Cognitive mode**: Identify and safely remove seed/sample data without touching real production content. Always confirm before deleting.

Removes sample data (seeded during `setup-clinic.js`) so the site looks like a real operating clinic, not a demo.

## When to Use

- After onboarding Tier 2+ is complete (real content exists)
- Before first production deploy
- When sample programs/posts/staff are still visible on the live site

## Sample Data Markers

Sample data is identified by these patterns:

| Table | Marker | Example |
|-------|--------|---------|
| `posts` | `is_sample = 1` | Sample blog posts, notices |
| `programs` | `slug LIKE 'sample-%'` or seeded slugs | sample-chuna, sample-pain |
| `staff` | `id LIKE 'sample-%'` | sample-doctor |
| `page_translations` | Pages referencing sample content | Default section JSON |
| `site_settings` | Default placeholder values | "우리한의원", "02-000-0000" |
| `clinics` | Dummy clinic info | name="우리한의원", phone="02-000-0000" |
| `inventory_items` | `is_sample = 1` | Sample inventory |
| `leads` | `is_sample = 1` | Sample leads |
| `manual_pages` | `is_sample = 1` | Sample manual pages |
| `products` | `is_sample = 1` | Sample products |
| `tasks` | `is_sample = 1` | Sample tasks |
| `task_templates` | `is_sample = 1` | Sample task templates |
| `vendors` | `is_sample = 1` | Sample vendors |

## Procedure

### Step 1 — Inventory sample data

```bash
# Sample posts
npx wrangler d1 execute DB --local --command \
  "SELECT id, title, type, status FROM posts WHERE is_sample = 1;"

# Sample programs
npx wrangler d1 execute DB --local --command \
  "SELECT slug, name FROM programs WHERE slug LIKE 'sample-%';"

# Sample staff
npx wrangler d1 execute DB --local --command \
  "SELECT id, name FROM staff WHERE id LIKE 'sample-%';"

# Default site settings (still placeholder?)
npx wrangler d1 execute DB --local --command \
  "SELECT key, value FROM site_settings WHERE category='general' AND key='site_name';"

# Dummy clinic info (setup-clinic-info not yet run?)
npx wrangler d1 execute DB --local --command \
  "SELECT name, phone, address FROM clinics WHERE id='1';"

# Other sample-marked tables
npx wrangler d1 execute DB --local --command \
  "SELECT 'inventory_items' as tbl, COUNT(*) as cnt FROM inventory_items WHERE is_sample=1
   UNION ALL SELECT 'leads', COUNT(*) FROM leads WHERE is_sample=1
   UNION ALL SELECT 'manual_pages', COUNT(*) FROM manual_pages WHERE is_sample=1
   UNION ALL SELECT 'products', COUNT(*) FROM products WHERE is_sample=1
   UNION ALL SELECT 'tasks', COUNT(*) FROM tasks WHERE is_sample=1
   UNION ALL SELECT 'task_templates', COUNT(*) FROM task_templates WHERE is_sample=1
   UNION ALL SELECT 'vendors', COUNT(*) FROM vendors WHERE is_sample=1;"
```

### Step 2 — Show inventory and confirm

Present what will be removed:

```
🧹 Sample Data to Delete

Blog/notices:
  - [sample] Example blog post 1 (blog, draft)
  - [sample] Grand opening notice example (notice, draft)
  - ... total {N} items

Programs:
  - sample-chuna (Chuna therapy example)
  - sample-pain (Pain treatment example)
  - ... total {N} items

Staff:
  - sample-doctor (Example doctor)

Other samples:
  - inventory_items: {N} items
  - leads: {N} items
  - tasks/templates: {N} items
  - vendors: {N} items

⚠️ Dummy data detected:
  - clinics.name: "우리한의원" → /setup-clinic-info not yet run
  - clinics.phone: "02-000-0000" → placeholder phone number
  - logo: 1x1 transparent PNG (68 bytes) → needs /setup-skin or logo_url='none'

⚠️ Real data will NOT be touched.
   Only items with is_sample=1 or slug='sample-*' will be deleted.

Proceed with deletion? [Y/n]
```

### Step 3 — Verify real data exists

Before deleting samples, check that real replacements exist:

```bash
# Real posts exist?
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as real_posts FROM posts WHERE is_sample = 0 AND status = 'published';"

# Real programs exist?
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as real_programs FROM programs WHERE slug NOT LIKE 'sample-%' AND is_active = 1;"

# Real staff exist?
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as real_staff FROM staff WHERE id NOT LIKE 'sample-%';"
```

If no real data exists, warn:

```
⚠️ No real programs have been registered yet.
   Deleting samples will make the programs page appear empty.
   Recommend running /setup-programs first.

   Delete anyway?
```

### Step 4 — Delete (with safety)

```bash
# Delete sample posts
npx wrangler d1 execute DB --local --command \
  "DELETE FROM posts WHERE is_sample = 1;"

# Delete sample programs
npx wrangler d1 execute DB --local --command \
  "DELETE FROM programs WHERE slug LIKE 'sample-%';"

# Delete sample staff
npx wrangler d1 execute DB --local --command \
  "DELETE FROM staff WHERE id LIKE 'sample-%';"

# Delete other sample-marked data
npx wrangler d1 execute DB --local --command \
  "DELETE FROM inventory_items WHERE is_sample = 1;
   DELETE FROM leads WHERE is_sample = 1;
   DELETE FROM manual_pages WHERE is_sample = 1;
   DELETE FROM products WHERE is_sample = 1;
   DELETE FROM tasks WHERE is_sample = 1;
   DELETE FROM task_templates WHERE is_sample = 1;
   DELETE FROM vendors WHERE is_sample = 1;"
```

### Step 5 — Verify and report

```bash
npx wrangler d1 execute DB --local --command \
  "SELECT 'posts' as tbl, COUNT(*) as cnt FROM posts WHERE is_sample=1
   UNION ALL
   SELECT 'programs', COUNT(*) FROM programs WHERE slug LIKE 'sample-%'
   UNION ALL
   SELECT 'staff', COUNT(*) FROM staff WHERE id LIKE 'sample-%';"
```

```
✅ Sample data cleanup complete

Deleted:
  Blog/notices: {N} items
  Programs: {N} items
  Staff: {N} members

Remaining real data:
  Blog: {N} items (published)
  Programs: {N} (active)
  Staff: {N} members
```

## Safety

- **NEVER** delete rows where `is_sample = 0` or `is_sample IS NULL`
- **NEVER** delete by ID range or created_at — only by sample markers
- **NEVER** run on production (`--remote`) without explicit user approval
- If in doubt, show the SELECT first, get approval, then DELETE

## Integration

| Skill | Relationship |
|-------|-------------|
| `/onboarding` | Tier 3 "sample-data-cleanup" feature triggers this skill |
| `/setup-programs` | Should run before cleanup (ensure real programs exist) |
| `/setup-homepage` | Homepage may reference sample programs — check after cleanup |

## Triggers

- "샘플 삭제", "샘플 데이터 정리", "예시 데이터 지워"
- "cleanup", "sample data", "데모 데이터"

## Onboarding State Sync

After sample data is cleaned up and verified, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=sample-data-cleanup --note="cleanup-samples completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
