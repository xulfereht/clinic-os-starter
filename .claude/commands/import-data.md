# /import-data — 데이터 가져오기

> **Role**: Data Migration Specialist
> **Cognitive mode**: Source-first migration. Analyze source format → map fields → validate → import → verify.

기존 시스템에서 환자/예약 데이터를 마이그레이션합니다.
소스 분석 → 필드 매핑 → 검증 → 가져오기 → 검증까지 진행합니다.

## When to Use

- Onboarding Tier 3 (Marketing)
- "이전 프로그램에서 데이터를 옮기고 싶어요"
- "엑셀 파일로 환자 명단이 있어요"
- "다른 병원 프로그램에서 전환"

## Prerequisites

- `/setup-clinic-info` 완료
- 데이터 파일 준비 (CSV, Excel, JSON)
- (권장) 백업 생성

## Supported Sources

| Format | Extension | Notes |
|--------|-----------|-------|
| CSV | .csv | UTF-8 인코딩 권장 |
| Excel | .xlsx, .xls | 최대 10,000행 권장 |
| JSON | .json | Clinic-OS export format |
| SQL | .sql | mysqldump 등 |

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
📊 필드 매핑

소스 파일 컬럼 → Clinic-OS 필드

환자 정보:
  [A] 환자명/이름    → name
  [B] 전화번호      → phone
  [C] 생년월일      → birth_date
  [D] 성별         → gender
  [E] 주소         → address
  [F] 이메일       → email
  [G] 메모/특이사항  → notes
  [H] 최초방문일    → first_visit
  [I] 최종방문일    → last_visit

예약 정보:
  [J] 예약일시      → appointment_date
  [K] 예약상태      → status
  [L] 진료항목      → program_name
  [M] 담당자       → staff_name

매핑되지 않는 컬럼은 '무시'하거나 '메모'로 저장 가능합니다.
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
echo "=== 데이터 검증 ==="

# Check for duplicates
if [ "$FILE_EXT" = "csv" ]; then
  echo "중복 전화번호 확인..."
  awk -F',' 'NR>1 {print $2}' "$DATA_FILE" | sort | uniq -d | head -10

  echo ""
  echo "빈 값 확인..."
  awk -F',' 'NR>1 && $1=="" {print "Row "NR": 이름 없음"}' "$DATA_FILE" | head -10

  echo ""
  echo "전화번호 형식 확인..."
  awk -F',' 'NR>1 && $2!~/^[0-9]{10,11}$/ {print "Row "NR": " $2}' "$DATA_FILE" | head -10
fi

# Summary
echo ""
echo "📊 검증 결과:"
echo "  총 레코드: $(($(wc -l < "$DATA_FILE") - 1))"
echo "  문제 레코드: ${ERROR_COUNT}"
echo "  정상 레코드: ${VALID_COUNT}"
```

**Validation Report:**
```
📊 데이터 검증 결과

✅ 검사 항목:
   전체 레코드: 150개
   중복 전화번호: 3개 (처리 필요)
   잘못된 날짜: 0개
   누락된 필수값: 5개

⚠️  발견된 문제:
   1. 전화번호 010-1234-5678 → 3건 중복
   2. 전화번호 010-9999-8888 → 형식 불량
   3. 환자명 (빈 값) → 5건

선택:
  [A] 문제 레코드 제외하고 진행
  [B] 문제 레코드 수동 수정
  [C] 중복은 업데이트로 처리 (merge)
```

### Step 4 — Backup

```bash
echo "=== 백업 생성 ==="

# Create backup before import
BACKUP_NAME="pre-import-$(date +%Y%m%d-%H%M%S).sql"

echo "현재 데이터를 백업합니다: $BACKUP_NAME"
npx wrangler d1 export DB --local --output="./backups/$BACKUP_NAME"

echo "✅ 백업 완료: ./backups/$BACKUP_NAME"
```

### Step 5 — Import Execution

**Generate Import SQL:**
```bash
echo "=== 가져오기 SQL 생성 ==="

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

echo "✅ Import SQL 생성: $IMPORT_SQL"
```

**Execute Import:**
```bash
echo ""
echo "🚀 가져오기 실행..."
echo "이 작업은 되돌릴 수 없습니다. 계속하시겠습니까? (예/아니오)"
read CONFIRM

if [ "$CONFIRM" = "예" ] || [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
  npx wrangler d1 execute DB --local --file="$IMPORT_SQL"
  echo "✅ 가져오기 완료"
else
  echo "취소되었습니다."
  exit 0
fi
```

### Step 6 — Verification

```bash
echo "=== 가져오기 검증 ==="

# Count imported records
echo ""
echo "📊 가져오기 결과:"
npx wrangler d1 execute DB --local --command \
  "SELECT COUNT(*) as imported_count FROM patients WHERE is_imported = 1;"

# Show sample
echo ""
echo "📋 샘플 데이터:"
npx wrangler d1 execute DB --local --command \
  "SELECT id, name, phone, created_at FROM patients WHERE is_imported = 1 LIMIT 5;"

# Check for issues
echo ""
echo "🔍 데이터 품질:"
npx wrangler d1 execute DB --local --command \
  "SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN phone IS NULL THEN 1 END) as missing_phone,
    COUNT(CASE WHEN birth_date IS NULL THEN 1 END) as missing_birth
   FROM patients WHERE is_imported = 1;"
```

**Verification Report:**
```
✅ 데이터 가져오기 완료

📊 결과:
   소스 레코드: 150개
   가져오기 성공: 145개
   실패/스킵: 5개

📋 샘플 (최근 5건):
   #1 홍길동 01012345678 2026-03-26
   #2 김철수 01023456789 2026-03-26
   ...

🔍 데이터 품질:
   전화번호 누락: 3건
   생년월일 누락: 45건

💾 백업:
   ./backups/$BACKUP_NAME
   (복원 필요시: npx wrangler d1 execute DB --local --file=./backups/$BACKUP_NAME)

📁 관리:
   환자 목록: /admin/patients
   가져온 데이터 필터: is_imported = 1

다음 단계:
  → /patient-cohort — 가져온 환자 분석
  → /setup-programs — 진료 이력 연동
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
| `/setup-clinic-info` | 기본 환경 설정 |
| `/patient-cohort` | 가져온 환자 분석 |
| `/setup-programs` | 진료 이력 연동 |

## Common Issues

| Issue | Solution |
|-------|----------|
| 인코딩 문제 | CSV를 UTF-8로 저장 |
| 날짜 형식 | YYYY-MM-DD로 통일 |
| 전화번호 중복 | merge 전략 선택 |
| 누락 필수값 | 기본값 설정 또는 제외 |

## Triggers

- "데이터 이전", "마이그레이션", "옮기기"
- "엑셀 가져오기", "CSV 가져오기"
- "환자 명단", "기존 데이터"

## Safety

- 반드시 백업 먼저 생성
- 테스트는 로컬 DB에서 먼저
- 프로덕션은 이중 확인 후 실행
- `--remote` 플래그 명시적 확인

## All user-facing output in Korean.
