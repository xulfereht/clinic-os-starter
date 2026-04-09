# Admin Settings Tour Scenarios

Complete interactive tutorial tour specifications for all admin settings pages.

## Pages Covered

1. **Tags** (`/admin/settings/tags`) — 태그 관리
   - Patient tagging & categorization
   - Color-coded visual organization
   - 6 steps: Overview → Search → Add → Modal → Save → Edit/Delete

2. **Promotions** (`/admin/settings/promotions`) — 프로모션 관리
   - Discount rule management
   - Fixed & percentage discount types
   - 5 steps: Overview → Add → Input → Status → Save/Delete

3. **Navigation** (`/admin/settings/navigation`) — 메뉴 관리
   - Header & mobile menu structure
   - Drag-drop reordering + arrow buttons
   - Dropdown, link, dynamic program types
   - 7 steps: Overview → Add → Select → Edit → Dynamic Config → Reorder → Save

4. **Chat Widget** (`/admin/settings/widget`) — 채팅 위젯 설정
   - Customer support widget configuration
   - Colors, messages, business hours, form fields
   - 8 steps: Activate → Position → Color → Profile → Messages → Auto-reply → Hours → Share/Save

5. **SEO & Marketing** (`/admin/settings/seo`) — SEO 및 마케팅 설정
   - Search engine optimization
   - Open Graph (OG) tags for social media
   - Analytics tracking IDs (GA/Meta/Naver/Kakao)
   - Real-time SEO debugger & live preview
   - 8 steps: Sitemap → Title Suffix → Meta Desc → Region → OG → Tracking IDs → Debug → Save

6. **Integrations** (`/admin/settings/integrations`) — 통합 설정
   - Slack notifications
   - SMS providers (Aligo/Solapi)
   - Naver TalkTalk
   - Kakao Channel
   - 12 steps: Slack → SMS Provider → Aligo Config → Test → Solapi Config → Naver TalkTalk → Kakao → Test All

7. **API Keys** (`/admin/settings/api-keys`) — API Key 관리
   - Authentication key management for external tools
   - AI assistants + automation platforms (Zapier, Make, n8n)
   - 5 steps: Status → Generate → Copy → Usage Guide → Security

8. **AI Settings** (`/admin/settings/ai`) — AI 설정
   - AI provider management (OpenAI, Gemini, Claude, DeepSeek, Google Translate)
   - API key configuration + model selection
   - Feature routing (which AI for which function)
   - 7 steps: Providers → OpenAI → Gemini → Claude → DeepSeek/Translate → Feature Routing → Save

## Format Specification

Each scenario file follows this structure:

```markdown
# [Page Title] (/admin/[path]) — 투어 시나리오

## 페이지 목적
[1 sentence description]

## 시나리오 ([N] 스텝)

### Step N: [title]
- **title**: [Korean title]
- **text**: [Detailed Korean explanation — conversational, actionable]
- **highlight**: [CSS selector for element to highlight]
- **trigger**: [none/input/click/drag]
- **tips**: [Bulleted tips for this step]
- **buttons**: [Array of interactive elements]
  - `selector / label / description`
```

## Key Features

- **Interactive Elements**: Every button, toggle, input field, dropdown has dedicated step
- **Specific CSS Selectors**: Highlight exactly which element to focus on
- **Action Triggers**: Specify what user action triggers step completion (click, input, drag)
- **Korean Conversational**: Direct, conversational tone explaining "why" not just "what"
- **Button Documentation**: Every interactive element documented with selector, label, description
- **Progressive Disclosure**: Steps build on each other, starting simple → advanced

## Total Coverage

- **Pages**: 8 admin settings pages
- **Total Steps**: 51 interactive steps
- **Interactive Elements**: 120+ documented buttons/fields
- **Languages**: Korean (user-facing), English (technical specs)

## Usage

Import into onboarding pipeline or guided tour system:
1. User enters admin settings page
2. Trigger tour based on page route
3. Follow step-by-step with highlight + text overlay
4. Each step is completable (user confirms action or system detects trigger)
5. On completion, show success toast + advance to next step
