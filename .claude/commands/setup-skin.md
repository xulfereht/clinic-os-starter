# /setup-skin — Skin/Theme Application

> **Role**: Design Manager
> **Cognitive mode**: Select and apply an existing skin. For creating new skins, use `/dev-skin`.

기존 9개 코어 스킨 + 로컬/스토어 스킨 중에서 선택하고 적용합니다.

## Procedure

### Step 1 — Check current skin

```bash
npx wrangler d1 execute my-clinic-db --local --command \
  "SELECT theme_config FROM clinics WHERE id = 1;"
```

Parse the JSON to find current `skin`, `brandHue`, `mode`.

### Step 2 — Present skin options

| Skin | Mood | Best For |
|------|------|----------|
| `clinicLight` | 밝고 깔끔한 클리닉 | 대부분의 한의원 (기본값) |
| `wellnessWarm` | 따뜻하고 자연적 | 한약/약침 중심 |
| `editorialCalm` | 잡지형, 차분한 | 프리미엄/전문 클리닉 |
| `forestTherapy` | 자연 숲 테라피 | 힐링/웰빙 중심 |
| `hanbangClassic` | 전통 한방 | 전통 지향 |
| `ivoryLedger` | 미니멀 프로페셔널 | 깔끔함 선호 |
| `scandiCare` | 스칸디나비안 미니멀 | 미니멀 선호 |
| `dataDark` | 다크 테마 | 특수 케이스 |
| `midnightSignal` | 모던 다크 | 특수 케이스 |

Also check for local skins:
```bash
ls src/skins/local/*/manifest.json 2>/dev/null
```

Reference `style-card.yaml` tone for recommendation.

### Step 3 — Apply skin (⚠️ SOT: clinics.theme_config)

```bash
npx wrangler d1 execute my-clinic-db --local --command \
  "UPDATE clinics SET theme_config = json_set(
    COALESCE(theme_config, '{}'),
    '$.skin', '{SKIN_ID}',
    '$.skinSystemVersion', 2,
    '$.skinActivatedAt', datetime('now')
  ), updated_at = unixepoch() WHERE id = 1;"
```

### Step 4 — Brand hue (optional)

```bash
# Options: gray, blue, green, teal, brown
npx wrangler d1 execute my-clinic-db --local --command \
  "UPDATE clinics SET theme_config = json_set(
    theme_config,
    '$.brandHue', '{HUE}'
  ), updated_at = unixepoch() WHERE id = 1;"
```

### Step 5 — Build + verify

```bash
npm run build && npm run dev
# Check /admin/design to verify
```

### Step 6 — Sync report brand (optional)

If the user wants report branding to match:

```bash
# Read skin tokens from manifest
cat src/skins/{SKIN_ID}/manifest.json | python3 -c "
import json,sys; m=json.load(sys.stdin)
t=m.get('tokens',{})
print(f\"primary: {t.get('accent','#0f172a')}\")
print(f\"text: {t.get('textMain','#1f2937')}\")
"

# Update report_brand to match
npx wrangler d1 execute my-clinic-db --local --command \
  "UPDATE report_brand SET
    primary_color = '{accent_from_skin}',
    text_color = '{text_from_skin}',
    font_family = '{sans_or_serif}',
    updated_at = unixepoch()
  WHERE id = 1;"
```

## Triggers

- "스킨 바꿔줘", "테마 변경", "디자인 바꾸고 싶어"
- "색상 변경", "분위기 바꾸기"

## All user-facing output in Korean.
