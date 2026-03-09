import fs from 'node:fs';
import path from 'node:path';

function toTitleCase(input) {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function buildManifest(toolId, title, mode, withReport) {
  const useCustomSurvey = mode === 'custom' || mode === 'hybrid';
  const useCustomResult = mode === 'custom';
  const useCustomReport = withReport && (mode === 'custom' || mode === 'hybrid');

  return {
    id: toolId,
    name: title,
    description: `${title} 검사도구`,
    version: '1.0.0',
    author: 'Local Clinic',
    source: 'local',
    questionCount: 4,
    scoringType: 'likert-5',
    estimatedTime: '2분',
    tags: ['자가진단'],
    useCustomSurvey,
    useCustomResult,
    useCustomReport,
    questions: [
      {
        id: 'intro',
        type: 'info',
        label: '시작',
        question: `${title} 검사를 시작합니다`,
        description: '최근 상태를 떠올리며 답변해 주세요.',
      },
      {
        id: 'q1',
        type: 'radio',
        label: '첫 번째 문항',
        question: '최근 상태를 가장 잘 설명하는 선택지를 골라주세요.',
        options: [
          { value: 0, label: '전혀 아니다' },
          { value: 1, label: '가끔 그렇다' },
          { value: 2, label: '자주 그렇다' },
          { value: 3, label: '거의 항상 그렇다' },
        ],
      },
      {
        id: 'q2',
        type: 'radio',
        label: '역채점 문항',
        question: '최근 컨디션이 안정적이라고 느꼈다.',
        reverseScored: true,
        options: [
          { value: 0, label: '전혀 아니다' },
          { value: 1, label: '가끔 그렇다' },
          { value: 2, label: '자주 그렇다' },
          { value: 3, label: '거의 항상 그렇다' },
        ],
      },
      {
        id: 'q3',
        type: 'nrs',
        label: '자기평가',
        question: '현재 불편감 정도를 0-10으로 표시해 주세요.',
        maxScore: 10,
      },
    ],
    scoring: {
      maxScore: 16,
      interpretation: [
        { min: 0, max: 4, level: 'low', label: '양호', description: '현재 상태가 비교적 안정적입니다.' },
        { min: 5, max: 9, level: 'mild', label: '주의', description: '생활 습관과 휴식을 점검해 보세요.' },
        { min: 10, max: 13, level: 'moderate', label: '관리 필요', description: '관리 계획을 세우는 것이 좋습니다.' },
        { min: 14, max: 16, level: 'high', label: '상담 권장', description: '전문가 상담을 권장합니다.' },
      ],
    },
  };
}

function buildSurveyTemplate(toolId, title) {
  return `---
import BaseLayout from "../../components/layout/BaseLayout.astro";

const { settings, tool, patientId } = Astro.props;
---

<BaseLayout title={tool.name} description={tool.description} settings={settings}>
  <main class="survey-shell">
    <section class="hero">
      <p class="eyebrow">Custom Survey</p>
      <h1>{tool.name}</h1>
      <p>{tool.description}</p>
    </section>

    <form id="survey-form" class="panel">
      <label class="field">
        <span>오늘의 불편감을 숫자로 적어주세요</span>
        <input type="number" min="0" max="10" name="q_custom" required />
      </label>

      <label class="field">
        <span>가장 불편한 순간을 적어주세요</span>
        <textarea name="memo" rows="4" placeholder="예: 오후 진료 전"></textarea>
      </label>

      <button type="submit">결과 보기</button>
    </form>
  </main>
</BaseLayout>

<style>
  .survey-shell { max-width: 720px; margin: 0 auto; padding: 48px 20px 96px; }
  .hero { margin-bottom: 24px; }
  .eyebrow { font-size: 0.8rem; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.08em; }
  .hero h1 { margin: 8px 0; font-size: 2rem; font-weight: 800; }
  .hero p { color: #475569; }
  .panel { display: grid; gap: 16px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 20px; background: white; }
  .field { display: grid; gap: 8px; }
  .field input, .field textarea { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; }
  button { border: none; border-radius: 14px; padding: 14px 18px; background: #0f172a; color: white; font-weight: 700; cursor: pointer; }
</style>

<script define:vars={{ toolId: "${toolId}", patientId }}>
  const form = document.getElementById('survey-form');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const numericScore = Number(data.get('q_custom') || 0);

    const response = await fetch('/api/survey-tools/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolId,
        answers: {
          q_custom: numericScore,
          memo: String(data.get('memo') || ''),
        },
        patientId: patientId || null,
      }),
    });

    const result = await response.json();
    if (result.resultId) {
      window.location.href = \`/ext/survey-tools/\${toolId}/result/\${result.resultId}\`;
    }
  });
</script>
`;
}

function buildResultTemplate(toolId, title) {
  return `---
import BaseLayout from "../../components/layout/BaseLayout.astro";
import { getSurveyToolInterpretation } from "../../lib/survey-tool-runtime";

const { settings, tool, result } = Astro.props;
const interpretation = getSurveyToolInterpretation(tool.scoring, result?.total_score || 0);
---

<BaseLayout title={\`\${tool.name} 결과\`} description={tool.description} settings={settings}>
  <main class="result-shell">
    <section class="card">
      <p class="eyebrow">${title}</p>
      <h1>{tool.name} 결과</h1>
      <p class="score">{result.total_score} / {result.max_score}</p>
      {interpretation && (
        <div class="tone">
          <strong>{interpretation.label}</strong>
          <p>{interpretation.description}</p>
        </div>
      )}
      <div class="actions">
        <a href={\`/ext/survey-tools/${toolId}\`}>다시 검사하기</a>
        <a href={\`/ext/survey-tools/${toolId}/report/\${result.id}\`}>결과지 보기</a>
      </div>
    </section>
  </main>
</BaseLayout>

<style>
  .result-shell { max-width: 720px; margin: 0 auto; padding: 56px 20px 96px; }
  .card { padding: 28px; border-radius: 24px; background: white; border: 1px solid #e2e8f0; }
  .eyebrow { font-size: 0.8rem; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.08em; }
  h1 { margin: 10px 0; font-size: 2rem; font-weight: 800; }
  .score { font-size: 2.5rem; font-weight: 800; margin: 12px 0 20px; }
  .tone { padding: 16px; border-radius: 16px; background: #f8fafc; }
  .tone p { margin: 6px 0 0; color: #475569; }
  .actions { display: flex; gap: 12px; margin-top: 24px; }
  .actions a { flex: 1; text-align: center; padding: 12px 14px; border-radius: 14px; background: #0f172a; color: white; text-decoration: none; font-weight: 700; }
</style>
`;
}

function buildReportTemplate(toolId) {
  return `---
const { tool, result, patient } = Astro.props;
---

<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>{tool.name} 결과지</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; color: #0f172a; }
      .sheet { max-width: 780px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
      .box { padding: 18px; border-radius: 18px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 18px; }
      .print { margin-top: 18px; }
      @media print { .print { display: none; } body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <h1>{tool.name} 결과지</h1>
          <p>결과 ID: {result.id}</p>
        </div>
        <div>
          {patient && <p>환자: {patient.name}</p>}
          <p>점수: {result.total_score} / {result.max_score}</p>
        </div>
      </div>

      <div class="box">
        <h2>요약</h2>
        <p>이 템플릿을 기준으로 병원 전용 결과지 레이아웃을 커스터마이징하세요.</p>
      </div>

      <button class="print" onclick="window.print()">인쇄하기</button>
      <a class="print" href={\`/ext/survey-tools/${toolId}/result/\${result.id}\`}>웹 결과로 돌아가기</a>
    </div>
  </body>
</html>
`;
}

export function getSurveyToolScaffoldPlan(options) {
  const {
    projectRoot,
    toolId,
    title,
    mode = 'manifest',
    withReport = false,
  } = options;

  const targetDir = path.join(projectRoot, 'src', 'survey-tools', 'local', toolId);
  const normalizedTitle = title || toTitleCase(toolId);
  const manifest = buildManifest(toolId, normalizedTitle, mode, withReport);
  const files = [
    {
      path: path.join(targetDir, 'manifest.json'),
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
  ];

  if (mode === 'custom' || mode === 'hybrid') {
    files.push({
      path: path.join(targetDir, 'survey.astro'),
      content: buildSurveyTemplate(toolId, normalizedTitle),
    });
  }

  if (mode === 'custom') {
    files.push({
      path: path.join(targetDir, 'result.astro'),
      content: buildResultTemplate(toolId, normalizedTitle),
    });
  }

  if (withReport) {
    files.push({
      path: path.join(targetDir, 'report.astro'),
      content: buildReportTemplate(toolId),
    });
  }

  return {
    toolId,
    title: normalizedTitle,
    mode,
    withReport,
    targetDir,
    files,
  };
}

export function writeSurveyToolScaffold(plan) {
  fs.mkdirSync(plan.targetDir, { recursive: true });

  for (const file of plan.files) {
    fs.mkdirSync(path.dirname(file.path), { recursive: true });
    fs.writeFileSync(file.path, file.content);
  }

  return plan;
}
