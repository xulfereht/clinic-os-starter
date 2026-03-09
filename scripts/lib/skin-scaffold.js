import fs from 'node:fs';
import path from 'node:path';

function toTitleCase(input) {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function buildManifest({ skinId, title, extendsSkin, withHero, withMainHero }) {
  const sectionOverrides = [];
  if (withHero) {
    sectionOverrides.push({
      type: 'Hero',
      file: 'sections/Hero.astro',
      description: '일반 Hero 섹션 오버라이드',
    });
  }
  if (withMainHero) {
    sectionOverrides.push({
      type: 'MainHero',
      file: 'sections/MainHero.astro',
      description: '홈페이지 MainHero 섹션 오버라이드',
    });
  }

  return {
    id: skinId,
    name: title,
    description: `${title} 스킨 팩`,
    version: '1.0.0',
    author: 'Local Clinic',
    source: 'local',
    status: 'ready',
    extends: extendsSkin,
    defaults: {
      skin: skinId,
      brandHue: 'teal',
      rounding: 'lg',
      density: 'spacious',
      mode: 'light',
    },
    preview: {
      badge: 'Local',
      accent: '#0f766e',
      surface: '#f8fffd',
      support: '#ccfbf1',
      fontHint: 'Custom',
      heroMode: withMainHero ? 'immersive' : 'editorial',
      surfaces: ['홈', '섹션', 'CTA'],
    },
    tokens: {
      accent: '#0f766e',
      accentSoft: 'rgba(15, 118, 110, 0.12)',
      accentStrong: '#115e59',
    },
    cssVars: {
      '--skin-hero-glow': 'rgba(15, 118, 110, 0.18)',
      '--skin-panel-noise': '0.06',
    },
    stylesheet: 'skin.css',
    sectionStyles: {
      Problem: {
        cardVariant: 'soft',
      },
      Pricing: {
        tone: 'elevated',
      },
    },
    componentRecipes: {
      stepCard: {
        sectionType: 'Process',
        layout: 'stack',
        density: 'normal',
        emphasis: 'balanced',
        motion: 'soft',
        cardVariant: 'soft',
        cardRadius: 'xl',
      },
      mediaFrame: {
        sectionType: 'YouTube',
        layout: 'media-frame',
        density: 'spacious',
        emphasis: 'bold',
        cardVariant: 'outlined',
        cardRadius: 'xl',
      },
      diagnosisPanel: {
        sectionType: 'MiniDiagnosis',
        layout: 'panel',
        density: 'normal',
        emphasis: 'balanced',
        cardVariant: 'soft',
        cardRadius: 'xl',
      },
    },
    pageTemplates: {
      homeLanding: {
        shell: withMainHero ? 'immersive' : 'stacked',
        heroVariant: withMainHero ? 'mainhero' : 'hero',
        contentWidth: 'wide',
        spacing: 'airy',
        sectionOrderStrategy: 'guided',
      },
      programDetail: {
        shell: 'stacked',
        heroVariant: 'program-hero',
        contentWidth: 'wide',
        spacing: 'normal',
        sectionOrderStrategy: 'data-driven',
      },
    },
    overrides: {
      sections: sectionOverrides,
    },
    documentation: {
      summary: '토큰, custom CSS, 섹션 override, component recipe, page template preset을 묶어서 퍼블릭 페이지 전체에 적용하는 로컬 스킨 팩입니다.',
      howToEdit: 'manifest.json의 defaults/tokens/cssVars를 먼저 조정하고, 그다음 sectionStyles, componentRecipes, pageTemplates를 채운 뒤 필요하면 sections/*.astro에서 Hero/MainHero를 바꿉니다.',
      riskyAreas: [
        '메인 히어로 CTA와 예약 링크는 기존 정보 구조를 유지하세요.',
        '섹션 오버라이드는 data prop 구조를 보존해야 합니다.',
      ],
    },
  };
}

function buildStylesheet(skinId) {
  return `:root[data-skin="${skinId}"] {
  --font-heading: "Outfit", "Pretendard", sans-serif;
  --font-body: "Pretendard", sans-serif;
}

:root[data-skin="${skinId}"] .section {
  position: relative;
}

:root[data-skin="${skinId}"] .section::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 15% 20%, var(--skin-hero-glow) 0, transparent 32%),
    radial-gradient(circle at 85% 10%, rgba(255,255,255,0.55) 0, transparent 28%);
  opacity: 0.7;
}

:root[data-skin="${skinId}"] .card {
  backdrop-filter: blur(10px);
}
`;
}

function buildHeroTemplate({ skinId, title }) {
  return `---
import { processNewlines } from "../../../lib/i18n";

const { data = {}, settings } = Astro.props;
const titleText = data.title || "${title}";
const subtitle = data.subtitle || "Local Skin Hero";
const description = data.description || "이 Hero 섹션은 skin pack override로 렌더링됩니다.";
const imageUrl = data.image || "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&w=1800&auto=format&fit=crop";
---

<section class="section relative overflow-hidden py-28 md:py-36 skin-pack-hero-${skinId}">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--skin-hero-glow),transparent_35%),linear-gradient(135deg,var(--bg-body),var(--bg-surface))]"></div>
  <div class="page-container relative z-10 grid gap-12 md:grid-cols-[1.1fr_0.9fr] items-center">
    <div class="space-y-8">
      <span class="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
        {subtitle}
      </span>
      <div class="space-y-5">
        <h1 class="text-[clamp(3rem,6vw,5.6rem)] font-black leading-[0.96] tracking-tight text-[color:var(--text-main)]" set:html={processNewlines(titleText)} />
        <p class="max-w-2xl text-lg md:text-xl leading-relaxed text-[color:var(--text-muted)]" set:html={processNewlines(description)} />
      </div>
      <div class="flex flex-wrap gap-4">
        <a href={data.ctaLink || "/intake"} class="btn btn--primary btn--lg">진료 예약</a>
        <a href={data.secondaryCtaLink || "#programs"} class="btn btn--secondary btn--lg">진료 과목</a>
      </div>
    </div>
    <div class="relative">
      <div class="absolute -inset-6 rounded-[2.25rem] bg-[color:var(--skin-hero-glow)] blur-3xl opacity-80"></div>
      <div class="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/70 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <img src={imageUrl} alt={titleText} class="aspect-[4/5] w-full object-cover" />
      </div>
    </div>
  </div>
</section>
`;
}

function buildMainHeroTemplate({ skinId, title }) {
  return `---
const { data = {} } = Astro.props;
const mainHeading = data.mainHeading || "${title}";
const subHeading = data.subHeading || "Local Skin Main Hero";
const description = data.description || "메인 히어로를 스킨 팩 단위로 바꾸기 위한 시작 템플릿입니다.";
---

<section class="relative min-h-[92vh] overflow-hidden bg-[color:var(--bg-body)] skin-pack-mainhero-${skinId}">
  <div class="absolute inset-0">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--skin-hero-glow),transparent_30%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.55),transparent_24%),linear-gradient(180deg,var(--bg-body),var(--bg-surface))]"></div>
    <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent)] to-transparent opacity-70"></div>
  </div>
  <div class="page-container relative z-10 flex min-h-[92vh] flex-col justify-center py-24">
    <div class="max-w-4xl space-y-8">
      <span class="inline-flex rounded-full border border-[color:var(--border-subtle)] bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
        {subHeading}
      </span>
      <h1 class="max-w-4xl text-[clamp(3.6rem,7vw,6.8rem)] font-black tracking-[-0.04em] leading-[0.9] text-[color:var(--text-main)] whitespace-pre-line">
        {mainHeading}
      </h1>
      <p class="max-w-2xl text-lg md:text-2xl leading-relaxed text-[color:var(--text-muted)] whitespace-pre-line">
        {description}
      </p>
      <div class="flex flex-wrap gap-4 pt-4">
        <a href={data.ctaLink || "/intake"} class="btn btn--primary btn--lg">예약 시작</a>
        <a href={data.secondaryCtaLink || "/programs"} class="btn btn--secondary btn--lg">프로그램 보기</a>
      </div>
    </div>
    <div class="mt-14 grid gap-4 md:grid-cols-3">
      {(data.highlights || [
        { label: "진단", value: "정밀 체크" },
        { label: "회복", value: "맞춤 플랜" },
        { label: "경험", value: "브랜드 무드" }
      ]).map((item) => (
        <div class="rounded-[1.6rem] border border-white/60 bg-white/70 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <p class="text-sm font-bold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">{item.label}</p>
          <p class="mt-3 text-2xl font-extrabold text-[color:var(--text-main)]">{item.value}</p>
        </div>
      ))}
    </div>
  </div>
</section>

<style>
  .skin-pack-mainhero-${skinId} {
    isolation: isolate;
  }

  .skin-pack-mainhero-${skinId}::after {
    content: "";
    position: absolute;
    inset: auto 6% 8% auto;
    width: 26rem;
    height: 26rem;
    border-radius: 999px;
    background: var(--skin-hero-glow);
    filter: blur(90px);
    animation: driftGlow 14s ease-in-out infinite alternate;
    opacity: 0.85;
    z-index: 0;
  }

  @keyframes driftGlow {
    from { transform: translate3d(-18px, 0, 0) scale(0.96); }
    to { transform: translate3d(18px, -14px, 0) scale(1.05); }
  }
</style>
`;
}

function buildReadme({ skinId, title }) {
  return `# ${title}

로컬 클라이언트용 skin pack입니다.

## 목적

- 퍼블릭 페이지를 스킨 단위로 묶어서 적용
- 토큰, CSS 변수, Hero/MainHero override를 한 폴더에서 관리
- core:pull에 영향받지 않는 로컬 작업 경로 유지

## 파일 구조

\`\`\`
src/skins/local/${skinId}/
├── manifest.json
├── skin.css
└── sections/
\`\`\`

## 권장 작업 순서

1. manifest.json의 \`defaults\`, \`tokens\`, \`cssVars\` 조정
2. \`skin.css\`로 카드/배경/버튼/섹션 분위기 조정
3. 히어로가 크게 달라져야 하면 \`sections/MainHero.astro\`, \`sections/Hero.astro\` 수정
4. 관리자 \`/admin/design\`에서 스킨 선택
5. \`/demo/design-system?skin=${skinId}\` 와 실제 퍼블릭 페이지 확인
`;
}

export function getSkinScaffoldPlan(options) {
  const {
    projectRoot,
    skinId,
    title,
    extendsSkin = 'clinicLight',
    withHero = true,
    withMainHero = true,
  } = options;

  const normalizedTitle = title || toTitleCase(skinId);
  const targetDir = path.join(projectRoot, 'src', 'skins', 'local', skinId);
  const manifest = buildManifest({
    skinId,
    title: normalizedTitle,
    extendsSkin,
    withHero,
    withMainHero,
  });

  const files = [
    {
      path: path.join(targetDir, 'manifest.json'),
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: path.join(targetDir, 'skin.css'),
      content: `${buildStylesheet(skinId)}\n`,
    },
    {
      path: path.join(targetDir, 'README.md'),
      content: `${buildReadme({ skinId, title: normalizedTitle })}\n`,
    },
  ];

  if (withHero) {
    files.push({
      path: path.join(targetDir, 'sections', 'Hero.astro'),
      content: buildHeroTemplate({ skinId, title: normalizedTitle }),
    });
  }

  if (withMainHero) {
    files.push({
      path: path.join(targetDir, 'sections', 'MainHero.astro'),
      content: buildMainHeroTemplate({ skinId, title: normalizedTitle }),
    });
  }

  return {
    skinId,
    title: normalizedTitle,
    extendsSkin,
    withHero,
    withMainHero,
    targetDir,
    files,
  };
}

export function writeSkinScaffold(plan) {
  fs.mkdirSync(plan.targetDir, { recursive: true });

  for (const file of plan.files) {
    fs.mkdirSync(path.dirname(file.path), { recursive: true });
    fs.writeFileSync(file.path, file.content);
  }

  return plan;
}
