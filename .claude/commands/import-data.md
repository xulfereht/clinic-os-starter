# /import-data — Data Import

> **Role**: Data Migration Specialist
> **Cognitive mode**: Source-first migration. Analyze source format → map fields → validate → import → verify.

Migrates patient/appointment data from existing systems.
Source analysis → field mapping → validation → import → verification.

## When to Use

- Onboarding Tier 3 (Marketing)
- Migrating data from a previous clinic management program
- Importing patient lists from Excel or CSV files
- Switching from another clinic system

## Prerequisites

- `/setup-clinic-info` completed
- Data file prepared (CSV, Excel, JSON)
- (Recommended) Backup created

## Supported Sources

| Format | Extension | Notes |
|--------|-----------|-------|
| CSV | .csv | UTF-8 encoding recommended |
| Excel | .xlsx, .xls | Max 10,000 rows recommended |
| JSON | .json | Clinic-OS export format |
| SQL | .sql | mysqldump etc. |

## Procedure

### Step 1 — Source Analysis

```bash
# Check if data file exists
echo "데이터 파일 경로를 입력하세요:"
read DATA_FILE

if [ ! -f "$DATA_FILE" ]; then
  echo "❌ 파일을 찾을 수 없습니다: $DATA_FILE"
  exit 1
fi

# Detect file type
FILE_EXT="${DATA_FILE##*.}"
echo "파일 형식: $FILE_EXT"

# Analyze based on type
case "$FILE_EXT" in
  csv)
    echo "=== CSV 미리보기 ==="
    head -5 "$DATA_FILE"
    echo ""
    echo "컬럼 수: $(head -1 "$DATA_FILE" | tr ',' '\n' | wc -l)"
    echo "행 수: $(wc -l < "$DATA_FILE")"
    ;;
  xlsx|xls)
    echo "=== Excel 파일 ==="
    echo "Excel 파일은 csv로 변환 후 진행하세요:"
    echo "  1. Excel 열기"
    echo "  2. 파일 > 다른 이름으로 저장"
    echo "  3. CSV UTF-8 형식 선택"
    ;;
  json)
    echo "=== JSON 구조 ==="
    cat "$DATA_FILE" | python3 -m json.tool 2>/dev/null | head -50 || head -20 "$DATA_FILE"
    ;;
  *)
    echo "지원하지 않는 파일 형식입니다."
    exit 1
    ;;
esac
```

### Step 2 — Field Mapping

**Common Source Fields:**
```
📊 Field Mapping

Source File Columns → Clinic-OS Fields

Patient Information:
  [A] Patient Name     → name
  [B] Phone Number     → phone
  [C] Date of Birth    → birth_date
  [D] Gender           → gender
  [E] Address          → address
  [F] Email            → email
  [G] Notes/Remarks    → notes
  [H] First Visit Date → first_visit
  [I] Last Visit Date  → last_visit

Appointment Information:
  [J] Appointment Date → appointment_date
  [K] Status           → status
  [L] Treatment Item   → program_name
  [M] Staff            → staff_name

Unmapped columns can be 'ignored' or saved as 'notes'.
```

**Auto-detect Mapping:**
```bash
# Try auto-detect from CSV header
if [ "$FILE_EXT" = "csv" ]; then
  HEADER=$(head -1 "$DATA_FILE")

  echo ""
  echo "🤖 자동 매핑 제안:"
  echo ""

  # Common patterns
  if echo "$HEADER" | grep -qi "name\|이름\|성명"; then
    echo "  이름 필드 감지 → name"
  fi
  if echo "$HEADER" | grep -qi "phone\|전화\|휴대폰\|연락처"; then
    echo "  전화번호 필드 감지 → phone"
  fi
  if echo "$HEADER" | grep -qi "birth\|생년\|생일"; then
    echo "  생년월일 필드 감지 → birth_date"
  fi
  if echo "$HEADER" | grep -qi "gender\|성별"; then
    echo "  성별 필드 감지 → gender"
  fi
fi
```

**Manual Mapping Configuration:**
```bash
# Create mapping configuration
cat > /tmp/import-mapping.json << 'EOF'
{
  "source_format": "csv",
  "table": "patients",
  "mapping": {
    "환자명": { "field": "name", "required": true },
    "전화번호": { "field": "phone", "required": true, "transform": "phone_normalize" },
    "생년월일": { "field": "birth_date", "required": false, "transform": "date_normalize" },
    "성별": { "field": "gender", "required": false, "transform": "gender_normalize" },
    "주소": { "field": "address", "required": false },
    "메모": { "field": "notes", "required": false }
  },
  "skip_columns": ["등록일", "수정일"],
  "transforms": {
    "phone_normalize": "remove_non_numeric",
    "date_normalize": "yyyy-mm-dd",
    "gender_normalize": { "남": "male", "여": "female", "M": "male", "F": "female" }
  }
}
EOF

echo ""
echo "📋 매핑 설정:"
cat /tmp/import-mapping.json | python3 -m json.tool
```

### Step 3 — Validation

```bash
echo "=== Data Validation ==="

# Check for duplicates
if [ "$FILE_EXT" = "csv" ]; then
  echo "Checking duplicate phone numbers..."
  awk -F',' 'NR>1 {print $2}' "$DATA_FILE" | sort | uniq -d | head -10

  echo ""
  echo "Checking empty values..."
  awk -F',' 'NR>1 && $1=="" {print "Row "NR": name missing"}' "$DATA_FILE" | head -10

  echo ""
  echo "Checking phone number format..."
  awk -F',' 'NR>1 && $2!~/^[0-9]{10,11}$/ {print "Row "NR": " $2}' "$DATA_FILE" | head -10
fi

# Summary
echo ""
echo "📊 Validation Results:"
echo "  Total records: $(($(wc -l < "$DATA_FILE") - 1))"
echo "  Problem records: ${ERROR_COUNT}"
echo "  Valid records: ${VALID_COUNT}"
```

**Validation Report:**
```
📊 Data Validation Results

✅ Checks Performed:
   Total records: 150
   Duplicate phone numbers: 3 (action needed)
   Invalid dates: 0
   Missing required values: 5

⚠️  Issues Found:
   1. Phone 010-1234-5678 → 3 duplicates
   2. Phone 010-9999-8888 → invalid format
   3. Patient name (empty) → 5 records

Options:
  [A] Proceed excluding problem records
  [B] Manually fix problem records
  [C] Treat duplicates as updates (merge)
```

### Step 4 — Backup

```bash
echo "=== Creating Backup ==="

# Create backup before import
BACKUP_NAME="pre-import-$(date +%Y%m%d-%H%M%S).sql"

echo "Backing up current data: $BACKUP_NAME"
npx wrangler d1 export DB --local --output="./backups/$BACKUP_NAME"

echo "✅ Backup complete: ./backups/$BACKUP_NAME"
```

### Step 5 — Import Execution

**Generate Import SQL:**
```bash
echo "=== Generating Import SQL ==="

IMPORT_SQL="migrations/$(date +%Y%m%d)_import_data.sql"

cat > "$IMPORT_SQL" << 'EOF'
-- Data Import Migration
-- Source: $DATA_FILE
-- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

BEGIN TRANSACTION;

-- Import patients
-- Generated from CSV mapping

INSERT INTO patients (
  name,
  phone,
  birth_date,
  gender,
  address,
  notes,
  source,
  is_imported,
  created_at
) VALUES
EOF

# Convert CSV to INSERT statements
if [ "$FILE_EXT" = "csv" ]; then
  tail -n +2 "$DATA_FILE" | while IFS=',' read -r name phone birth gender address notes; do
    # Skip empty names
    [ -z "$name" ] && continue

    # Normalize phone
    phone=$(echo "$phone" | tr -cd '0-9')

    # Normalize date
    birth=$(echo "$birth" | sed 's/\//-/g; s/\./-/g')

    # Normalize gender
    gender=$(echo "$gender" | sed 's/남/male/i; s/여/female/i; s/M/male/i; s/F/female/i')

    cat >> "$IMPORT_SQL" << EOF
('$name', '$phone', '$birth', '$gender', '$address', '$notes', 'import', 1, datetime('now')),
EOF
  done
fi

# Remove trailing comma, add semicolon
sed -i '' '$ s/,$/;/' "$IMPORT_SQL" 2>/dev/null || sed -i '$ s/,$/;/' "$IMPORT_SQL"

cat >> "$IMPORT_SQL" << 'EOF'

COMMIT;

-- Update import statistics
UPDATE patients SET is_imported = 1 WHERE source = 'import';
EOF

echo "✅ Import SQL generated: $IMPORT_SQL"
```

**Execute Import:**
```bash
echo ""
echo "🚀 Executing import..."
echo "This operation is irreversible. Continue? (예/아니오)"
read CONFIRM

if [ "$CONFIRM" = "예" ] || [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
  npx wrangler d1 execute DB --local --file="$IMPORT_SQL"
  echo "✅ Import complete"
else
  echo "Cancelled."
  exit 0
fi
```

### Step 6 — Verification

```bash
echo "=== Import Verification ==="

# Count imported records
echo ""
echo "📊 Import Results:"
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as imported_count FROM patients WHERE is_imported = 1;"

# Show sample
echo ""
echo "📋 Sample Data:"
npx wrangler d1 execute DB --local --command \
  "SELECT id, name, phone, created_at FROM patients WHERE is_imported = 1 LIMIT 5;"

# Check for issues
echo ""
echo "🔍 Data Quality:"
npx wrangler d1 execute DB --local --command \
  "SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN phone IS NULL THEN 1 END) as missing_phone,
    COUNT(CASE WHEN birth_date IS NULL THEN 1 END) as missing_birth
   FROM patients WHERE is_imported = 1;"
```

**Verification Report:**
```
✅ Data Import Complete

📊 Results:
   Source records: 150
   Successfully imported: 145
   Failed/Skipped: 5

📋 Sample (latest 5):
   #1 홍길동 01012345678 2026-03-26
   #2 김철수 01023456789 2026-03-26
   ...

🔍 Data Quality:
   Missing phone: 3
   Missing birth date: 45

💾 Backup:
   ./backups/$BACKUP_NAME
   (To restore: npx wrangler d1 execute DB --local --file=./backups/$BACKUP_NAME)

📁 Management:
   Patient list: /admin/patients
   Imported data filter: is_imported = 1

Next steps:
  → /patient-cohort — Analyze imported patients
  → /setup-programs — Link treatment history
```

## Advanced: Incremental Import

```bash
# For updating existing records
# Use INSERT OR REPLACE or INSERT OR IGNORE

cat >> "$IMPORT_SQL" << 'EOF'

-- For upsert (update if exists, insert if not)
INSERT INTO patients (name, phone, birth_date, updated_at)
SELECT
  imported.name,
  imported.phone,
  imported.birth_date,
  datetime('now')
FROM imported_temp imported
ON CONFLICT(phone) DO UPDATE SET
  name = excluded.name,
  birth_date = excluded.birth_date,
  updated_at = datetime('now');
EOF
```

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-clinic-info` | Basic environment setup |
| `/patient-cohort` | Analyze imported patients |
| `/setup-programs` | Link treatment history |

## Common Issues

| Issue | Solution |
|-------|----------|
| Encoding issues | Save CSV as UTF-8 |
| Date format | Standardize to YYYY-MM-DD |
| Duplicate phone numbers | Choose merge strategy |
| Missing required values | Set defaults or exclude |

## Triggers

- "데이터 이전", "마이그레이션", "옮기기"
- "엑셀 가져오기", "CSV 가져오기"
- "환자 명단", "기존 데이터"

## Safety

- Always create backup first
- Test on local DB first
- Execute on production only after double confirmation
- Explicit confirmation for `--remote` flag

## Onboarding State Sync

After data import is verified, mark the onboarding feature as done.
This runs regardless of entry point (demo, delegated, onboarding, standalone).

```bash
npm run onboarding:done -- --feature=data-import --note="import-data completed"
```

> Skip silently if onboarding-state.json doesn't exist.

## All user-facing output in Korean.
