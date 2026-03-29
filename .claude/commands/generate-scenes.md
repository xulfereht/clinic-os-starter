# /generate-scenes — Scene Image Generation (Nanobanana)

> **Role**: Image Director
> **Cognitive mode**: Generate AI images for scenes lacking real source material to fill website image gaps.

## Prerequisites

- `/curate-images` completed (image gaps identified)
- `/analyze-content` completed (tone baseline established via style-card.yaml)
- `scripts/generate-image.js` available

## Procedure

### Step 1 — Identify gaps

```bash
cat public/local/assets/asset-metadata.json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  console.log('Gaps:', JSON.stringify(d.summary.needs_generation))"
```

Cross-reference with program candidates from style-card.yaml to build the needed scene list:

| Program | Hero (4:5) | Mechanism (4:3) | Solution (1:1) |
|---------|-----------|----------------|----------------|
| 추나/교정 | Available ✅ | Missing ❌ | Missing ❌ |
| 비염치료 | Missing ❌ | Missing ❌ | Missing ❌ |
| ... | ... | ... | ... |

### Step 2 — Prepare base references

Use real photos as `--ref` to maintain tone consistency across generated images:

```bash
# Use existing facility, doctor, equipment photos as references
REF_CLINIC="public/local/assets/raw/interior-treatment-room.jpg"
REF_DOCTOR="public/local/assets/enhanced/doctor-portrait-studio.png"
REF_EQUIP="public/local/assets/raw/equipment-acupuncture.jpg"
```

### Step 3 — Generate by scene type

```bash
GEN="node scripts/generate-image.js"

# Program Hero (4:5) — treatment scene
$GEN \
  --prompt "Korean medicine doctor performing chuna spinal therapy on patient lying on treatment bed, warm clinic room with wood tones, professional and caring atmosphere, natural lighting from window" \
  --ref "$REF_CLINIC" \
  --ref "$REF_DOCTOR" \
  --aspect "4:5" \
  --save-path "public/local/assets/generated/program-chuna-hero.png"

# Program Mechanism (4:3) — treatment close-up
$GEN \
  --prompt "Close-up of acupuncture treatment on patient back, precise needle placement near spine, clean medical setting, professional technique focus, shallow depth of field" \
  --ref "$REF_EQUIP" \
  --aspect "4:3" \
  --save-path "public/local/assets/generated/program-chuna-mechanism.png"

# Program Solution (1:1) — treatment tools flat-lay
$GEN \
  --prompt "Editorial flat-lay arrangement of Korean herbal medicine packs, moxa sticks, and warming equipment on clean linen surface, soft overhead natural light, minimalist composition" \
  --ref "$REF_EQUIP" \
  --aspect "1:1" \
  --save-path "public/local/assets/generated/program-chuna-solution.png"
```

**Prompt rules (per content-bootstrap.md):**
- Hero: Doctor + patient scene, warm tone, different angle per program
- Mechanism: Treatment close-up, different angle from Hero, tight crop
- Solution: Flat-lay/editorial, product/tool focused, not catalog-style
- Always use 2-3 `--ref` images for tone consistency
- Text/logo/watermark auto-prohibited (built into script)

### Step 4 — Quality review

Review each generated image:
- Does the tone match real photos?
- Are people natural-looking?
- Is the medical equipment appropriate for Korean medicine? (watch for Western medicine equipment leaking in)
- No text/logos present?

If rejected, adjust prompt and regenerate.

### Step 5 — Update asset-metadata.json + report

```
🎨 장면 이미지 생성 결과

생성: 9장 (3 프로그램 × 3 섹션)
  program-chuna-hero.png (4:5)
  program-chuna-mechanism.png (4:3)
  program-chuna-solution.png (1:1)
  program-rhinitis-hero.png (4:5)
  ...

이미지 쿼터 사용: 9/30 (누적 12/30)

이미지 원칙:
  실물 사진 > AI 생성 (실물이 있는 곳은 실물 우선)
  AI 생성은 갭 메우기 용도

추천 다음 단계:
  → /plan-content (전체 기획안 확정)
  → /setup-homepage (홈페이지 구성)
```

## Triggers

- "이미지 생성", "장면 만들어줘", "사진 부족"
- "나노바나나", "프로그램 이미지"

## All user-facing output in Korean.
