# /setup-skin — Skin/Theme Application

> **Role**: Design Manager
> **Cognitive mode**: Select and apply a skin that matches the clinic's tone and manner.

## Procedure

### Step 1 — Check current skin

```bash
npx wrangler d1 execute DB_NAME --local --command \
  "SELECT value FROM site_settings WHERE category='branding' AND key='skin';"
```

### Step 2 — Present skin options

| Skin | Mood | Best For |
|------|--------|---------------|
| `clinicLight` | 밝고 깔끔한 클리닉 | 대부분의 한의원 (기본값) |
| `wellnessWarm` | 따뜻하고 자연적 | 한약/약침 중심 |
| `editorialCalm` | 잡지형, 차분한 | 프리미엄/전문 클리닉 |
| `forestTherapy` | 자연 숲 테라피 | 힐링/웰빙 중심 |
| `hanbangClassic` | 전통 한방 | 전통 지향 |
| `dataDark` | 다크 테마, 데이터 중심 | 특수 케이스 |
| `midnightSignal` | 모던 다크 | 특수 케이스 |
| `ivoryLedger` | 미니멀 프로페셔널 | 깔끔함 선호 |
| `scandiCare` | 스칸디나비안 미니멀 | 미니멀 선호 |

Reference style-card.yaml tone for recommendation:

```
🎨 스킨 추천

한의원 톤: 전문적이면서 따뜻한, 한방 전통과 현대적 시설 균형
추천: editorialCalm 또는 clinicLight

미리보기: npm run dev 후 /admin/design 또는 /demo/design-system
```

### Step 3 — Apply skin

Once user selects:

```bash
npx wrangler d1 execute DB_NAME --local --command \
  "INSERT OR REPLACE INTO site_settings (category, key, value) VALUES ('branding', 'skin', 'editorialCalm');"
```

### Step 4 — Brand color setting (optional)

```bash
# Brand hue options: teal, blue, green, brown, purple, red, orange
npx wrangler d1 execute DB_NAME --local --command \
  "INSERT OR REPLACE INTO site_settings (category, key, value) VALUES ('branding', 'brandHue', 'teal');"
```

### Step 5 — Build + verify

```bash
npm run build && npm run dev
# Check all pages in browser
```

## Triggers

- "스킨 바꿔줘", "테마 변경", "디자인 바꾸고 싶어"
- "색상 변경", "분위기 바꾸기"

## All user-facing output in Korean.
