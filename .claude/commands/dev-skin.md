# /dev-skin — 스킨 개발 파트너

> **Role**: Design System Architect
> **Cognitive mode**: Brand-first co-creation. Clinic personality → design tokens → skin manifest → DB activation.
> **Philosophy**: Agent as Producer — 에이전트가 구조화하고, 원장이 감성을 결정한다.

커스텀 스킨의 **유일한 1차 생산 경로**. 브랜드 분석 → 컬러/서체 → manifest + skin.css 생성 → DB 활성화까지 원샷.
관리자 UI(`/admin/design`)는 "선택/미세조정 전용" — 새 스킨 생성은 이 스킬에서만 가능합니다.

## When to Use

- Onboarding Tier 4 (Experience) — "우리 병원만의 디자인"
- "스킨 만들고 싶어" / "브랜드 컬러로 바꿔줘"
- 기존 9개 스킨으로 부족할 때
- 리브랜딩/리뉴얼 시

## Prerequisites

- `/setup-clinic-info` 완료 권장 (병원 특성)
- `/analyze-content` 권장 (톤앤매너)

## Guardrail Flow (4 Phases)

### Phase 1 — Brand Context

```
🎨 한의원 스킨을 함께 만들어보겠습니다.

몇 가지 여쭤볼게요:

1. 한의원 분위기는 어떤가요?
   (예: 모던, 전통, 프리미엄, 친근, 자연/힐링)

2. 타겟 환자층은?
   (예: 직장인, 가족, 시니어, 여성, 수험생)

3. 브랜드 색상이 있나요?
   (로고 색상, CI 컬러 등 — 없으면 함께 정합니다)

4. 기존 스킨 중 가장 가까운 것은?
   - clinicLight (밝고 깔끔)
   - wellnessWarm (따뜻한 웰니스)
   - editorialCalm (잡지형 차분)
   - hanbangClassic (전통 한방)
   - forestTherapy (숲/힐링)
   - 없음 (완전히 새로)

5. 리포트(검사결과지) 스타일도 함께 맞출까요?
```

### Phase 2 — Design (Agent + Clinician)

에이전트가 초안을 제안하고 원장이 검토합니다.

```
📋 디자인 초안입니다. 검토해주세요.

[스킨명]: {skin_name}
[기반]: {base_skin} 상속
[모드]: light / dark

--- 컬러 ---
  Primary (주):   {primary} ████
  Accent (강조):  {accent}  ████
  Surface (배경): {surface}
  Text (본문):    {text}

--- 서체 ---
  제목: {heading_font}
  본문: {body_font}

--- 섹션 스타일 ---
  Hero:     {tone} / {cardStyle}
  Solution: {tone}
  Pricing:  {tone}

수정하실 부분이 있으신가요?
- "색상 더 따뜻하게" → accent 조정
- "폰트를 명조로" → serif 계열 전환
- "좋아, 진행해"
```

### Phase 3 — Generate + Activate (Automated)

원장이 "좋아, 진행해"라고 하면:

**3.1. Skin ID 결정**
```
규칙: kebab-case, 영문
예: baekrokdam-warm, modern-blue-clinic
```

**3.2. skin.css 생성** (⚠️ 파일명 반드시 `skin.css`)

```css
/* src/skins/local/{id}/skin.css */
:root {
  --skin-hero-glow: {glow_color};
  --skin-panel-border: {border_style};
  --skin-band: {band_gradient};
  /* ... 스킨별 커스텀 변수 ... */
}
```

**3.3. manifest.json 생성**

```json
{
  "id": "{skin_id}",
  "name": "{display_name}",
  "version": "1.0.0",
  "description": "{description}",
  "author": "clinic-local",
  "source": "local",
  "status": "ready",
  "extends": "{base_skin}",
  "defaults": {
    "skin": "{skin_id}",
    "brandHue": "{hue}",
    "rounding": "md",
    "density": "normal",
    "mode": "light"
  },
  "tokens": {
    "bgBody": "{bg}",
    "bgSurface": "{surface}",
    "surfaceElevated": "{elevated}",
    "textMain": "{text}",
    "textMuted": "{muted}",
    "textSubtle": "{subtle}",
    "accent": "{accent}",
    "accentSoft": "{accent_soft}",
    "accentStrong": "{accent_strong}",
    "borderSubtle": "{border}",
    "fontDisplay": "{heading_font}",
    "fontBody": "{body_font}"
  },
  "sectionStyles": {
    "Hero": { "tone": "bold" },
    "Problem": { "tone": "neutral" },
    "Solution": { "tone": "accent" },
    "DoctorIntro": { "tone": "elevated" },
    "MiniDiagnosis": { "tone": "neutral" }
  },
  "stylesheet": "skin.css",
  "skinActivatedAt": "{ISO timestamp}"
}
```

**⚠️ 핵심 규칙:**
- `stylesheet` 필드는 반드시 `"skin.css"` (skin-loader가 이 이름으로 로드)
- `skinActivatedAt` 포함 (없으면 고급 스킨 기능 비활성)
- `extends`로 기존 스킨 상속 → 정의하지 않은 토큰은 부모에서 계승

**3.4. DB 활성화**

manifest 작성 후 DB에 theme_config를 업데이트해서 즉시 활성화:

```sql
UPDATE clinics SET theme_config = json('{
  "skin": "{skin_id}",
  "brandHue": "{hue}",
  "rounding": "md",
  "density": "normal",
  "mode": "light",
  "skinSystemVersion": 2,
  "skinActivatedAt": "{ISO timestamp}"
}'), updated_at = unixepoch()
WHERE id = 1;
```

`npx wrangler d1 execute my-clinic-db --local` 로 실행.

**3.5. 리포트 브랜드 연동 (선택)**

원장이 리포트 스타일도 맞추겠다고 하면:

```sql
UPDATE report_brand SET
  primary_color = '{primary}',
  accent_color = '{accent}',
  text_color = '{text}',
  muted_color = '{muted}',
  font_family = '{sans|serif}',
  updated_at = unixepoch()
WHERE id = 1;
```

### Phase 4 — Verify

```
✅ 커스텀 스킨 생성 및 활성화 완료

🎨 스킨 정보:
   ID: {skin_id}
   이름: {display_name}
   위치: src/skins/local/{skin_id}/
   기반: {base_skin} 상속

📁 생성 파일:
   manifest.json — 토큰, 섹션 스타일, 메타데이터
   skin.css — 커스텀 CSS 변수

🗄️ DB:
   clinics.theme_config 업데이트됨
   skinSystemVersion: 2, skinActivatedAt 설정됨
   {리포트 연동했으면: report_brand도 업데이트됨}

🔗 미리보기:
   npm run dev → 메인 페이지에서 확인
   /admin/design → 스킨 설정 페이지에서 미세조정

다음 할 수 있는 것:
- "색상 조금 더 진하게" → tokens 수정
- "히어로 스타일 바꿔줘" → sectionStyles 수정
- "리포트도 이 스타일로" → report_brand 업데이트
- "/setup-homepage" → 홈페이지 구성
```

## Reference: Manifest Token Fields

| Token | 용도 | 예시 |
|-------|------|------|
| `bgBody` | 페이지 배경 | `#ffffff` |
| `bgSurface` | 카드/패널 배경 | `#f9fafb` |
| `surfaceElevated` | 강조 영역 배경 | `#f3f4f6` |
| `textMain` | 주 텍스트 | `#1f2937` |
| `textMuted` | 보조 텍스트 | `#6b7280` |
| `accent` | 브랜드 강조색 | `#2563eb` |
| `accentSoft` | 연한 강조 | `#dbeafe` |
| `accentStrong` | 진한 강조 | `#1d4ed8` |
| `fontDisplay` | 제목 폰트 | `'Pretendard', sans-serif` |
| `fontBody` | 본문 폰트 | `'Noto Sans KR', sans-serif` |

## Safety

- 모든 생성 파일은 `src/skins/local/`에 저장 (core:pull 보호)
- 기존 코어 스킨은 절대 수정하지 않음
- `extends`로 기존 스킨 상속 가능
- manifest의 `stylesheet`는 반드시 `skin.css` (파일명 불일치 주의)

## Integration

| Skill | Relationship |
|-------|-------------|
| `/setup-skin` | 기존 스킨 선택/적용 (이 스킬은 새 스킨 개발) |
| `/setup-homepage` | 스킨 적용 후 홈페이지 구성 |
| `/frontend-code` | 커스텀 섹션 컴포넌트 구현 |

## Triggers

- "스킨 만들기", "커스텀 테마", "디자인 시스템"
- "우리 병원 색상으로", "브랜드 컬러"
- "테마 직접 만들기", "리브랜딩"

## All user-facing output in Korean.
