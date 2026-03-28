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
```

### Step 2 — Show inventory and confirm

Present what will be removed:

```
🧹 삭제 대상 샘플 데이터

블로그/공지:
  - [sample] 한의원 블로그 예시 글 1 (blog, draft)
  - [sample] 개원 안내 예시 (notice, draft)
  - ... 총 {N}건

프로그램:
  - sample-chuna (추나 치료 예시)
  - sample-pain (통증 치료 예시)
  - ... 총 {N}건

의료진:
  - sample-doctor (예시 원장)

⚠️ 실제 데이터는 건드리지 않습니다.
   is_sample=1 또는 slug='sample-*' 인 것만 삭제합니다.

삭제를 진행할까요? [Y/n]
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
⚠️ 실제 프로그램이 아직 등록되지 않았습니다.
   샘플을 삭제하면 프로그램 페이지가 비어 보입니다.
   /setup-programs 를 먼저 실행하는 걸 권장합니다.

   그래도 삭제하시겠어요?
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
✅ 샘플 데이터 정리 완료

삭제:
  블로그/공지: {N}건
  프로그램: {N}건
  의료진: {N}건

남은 실제 데이터:
  블로그: {N}건 (published)
  프로그램: {N}개 (active)
  의료진: {N}명
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

## All user-facing output in Korean.
