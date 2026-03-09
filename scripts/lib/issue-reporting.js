import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import {
  findProjectRoot,
  readClinicJsonLicenseKey,
  readCosLicenseFile,
} from './survey-tool-installer.js';

export { findProjectRoot };

const DEFAULT_SUPPORT_AGENT_URL = 'https://clinic-os-support-agent.yeonseung-choe.workers.dev';
const ISSUE_HISTORY_RELATIVE_PATH = path.join('.agent', 'issue-history.json');
const ISSUE_REPORT_STATUS_RELATIVE_PATH = path.join('.agent', 'issue-report-status.json');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function truncateText(value, maxLength = 4000) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function normalizeFingerprintText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\bv?\d+\.\d+\.\d+\b/g, '<version>')
    .replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z\b/gi, '<timestamp>')
    .replace(/\/Users\/[^\s)]+/g, '<path>')
    .replace(/line \d+/gi, 'line <n>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingV(value) {
  return typeof value === 'string' ? value.replace(/^v/, '') : value;
}

function readLastError(projectRoot) {
  return readJsonIfExists(path.join(projectRoot, '.agent', 'last-error.json'));
}

function readSupportStatus(projectRoot) {
  return readJsonIfExists(path.join(projectRoot, '.agent', 'support-status.json'));
}

function readRuntimeContext(projectRoot) {
  return readJsonIfExists(path.join(projectRoot, '.agent', 'runtime-context.json'));
}

function extractLastErrorMessage(lastError) {
  if (!lastError) return null;
  if (typeof lastError.error === 'string') {
    return lastError.error;
  }
  if (lastError.error?.message) {
    return lastError.error.message;
  }
  return null;
}

function extractLastErrorStack(lastError) {
  if (!lastError) return null;
  if (typeof lastError.error === 'object' && lastError.error?.stack) {
    return lastError.error.stack;
  }
  return null;
}

function deriveSeverity({ phase, message, lifecycle, attemptCount, occurrenceCount }) {
  const text = `${phase || ''} ${message || ''} ${lifecycle?.scenario || ''}`.toLowerCase();

  if (
    lifecycle?.scenario === 'production_binding_drift' ||
    text.includes('database_id') ||
    text.includes('bucket') ||
    text.includes('production') ||
    text.includes('restore') ||
    text.includes('data loss')
  ) {
    return 'critical';
  }

  if (
    phase === 'migration' ||
    phase === 'core-update' ||
    phase === 'git-fetch' ||
    text.includes('migration') ||
    text.includes('sqlite') ||
    text.includes('d1') ||
    text.includes('deploy') ||
    text.includes('rollback') ||
    attemptCount >= 3 ||
    occurrenceCount >= 3
  ) {
    return 'high';
  }

  if (
    phase === 'precondition' ||
    text.includes('license') ||
    text.includes('device') ||
    occurrenceCount >= 2 ||
    attemptCount >= 2
  ) {
    return 'medium';
  }

  return 'low';
}

function deriveIssueTitle({ phase, stepName, message }) {
  const headline = truncateText(String(message || '반복 오류가 감지되었습니다.').split('\n')[0], 96);
  const prefix = stepName || phase || 'issue';
  return `[${prefix}] ${headline}`;
}

function buildStepsToReproduce({ command, phase, stepName, supportStatus, lastError }) {
  const steps = [
    'Clinic-OS 설치본에서 문제 상황을 재현했습니다.',
  ];

  if (command) {
    steps.push(`에이전트가 \`${command}\` 또는 동등한 복구 명령을 실행했습니다.`);
  } else if (stepName || phase) {
    steps.push(`에이전트가 ${stepName || phase} 단계에서 작업을 진행했습니다.`);
  }

  const suggestedCommands = lastError?.recovery?.commands || supportStatus?.error?.suggestedCommands || [];
  if (Array.isArray(suggestedCommands) && suggestedCommands.length > 0) {
    steps.push(`제안된 복구 명령(${suggestedCommands.slice(0, 3).join(', ')})을 확인했지만 동일 계열 오류가 반복됩니다.`);
  }

  steps.push('동일 증상이 반복적으로 발생하는지 doctor/support 상태 파일을 다시 확인했습니다.');
  return steps;
}

function buildDescription({
  title,
  phase,
  stepName,
  message,
  command,
  lifecycle,
  supportStatus,
  runtimeContext,
  occurrenceCount,
  attemptCount,
}) {
  const lines = [
    '로컬 에이전트가 반복적으로 같은 계열의 오류를 감지했습니다.',
    '',
    `제목: ${title}`,
    `phase: ${phase || 'unknown'}`,
    `step: ${stepName || '-'}`,
    `error: ${message || '-'}`,
    `occurrence_count: ${occurrenceCount}`,
    `attempt_count: ${attemptCount}`,
    `command: ${command || '-'}`,
    `lifecycle: ${lifecycle?.scenario || '-'}`,
    `health_score: ${supportStatus?.health?.score ?? '-'}`,
    `core_version: ${supportStatus?.versions?.core_version || runtimeContext?.repo?.core_version || '-'}`,
    `starter_version: ${supportStatus?.versions?.starter_version || runtimeContext?.repo?.starter_version || '-'}`,
    `app_version: ${supportStatus?.versions?.app_package_version || runtimeContext?.repo?.app_package_version || '-'}`,
  ];

  if (supportStatus?.actions?.length) {
    lines.push('', 'doctor_actions:');
    for (const action of supportStatus.actions.slice(0, 5)) {
      lines.push(`- ${action.id}: ${action.command || action.title}`);
    }
  }

  return truncateText(lines.join('\n'), 6000);
}

function buildCodeSnippet({ lastError, supportStatus, runtimeContext }) {
  const sections = [];
  const stack = extractLastErrorStack(lastError);
  if (stack) {
    sections.push(`stack:\n${stack}`);
  }

  if (lastError?.context) {
    sections.push(`last_error_context:\n${JSON.stringify(lastError.context, null, 2)}`);
  }

  if (supportStatus?.error) {
    sections.push(`support_status_error:\n${JSON.stringify(supportStatus.error, null, 2)}`);
  }

  if (runtimeContext?.repo || runtimeContext?.state) {
    sections.push(`runtime_context_summary:\n${JSON.stringify({
      repo: runtimeContext.repo || null,
      state: runtimeContext.state || null,
    }, null, 2)}`);
  }

  return sections.length > 0 ? truncateText(sections.join('\n\n---\n\n'), 9000) : undefined;
}

function buildAdditionalInfo({ candidate, occurrenceCount, supportStatus, runtimeContext }) {
  const lines = [
    `추가 로컬 정보 (${new Date().toISOString()}):`,
    `- fingerprint: ${candidate.fingerprint}`,
    `- occurrence_count: ${occurrenceCount}`,
    `- phase: ${candidate.phase || 'unknown'}`,
    `- command: ${candidate.command || '-'}`,
    `- health_score: ${supportStatus?.health?.score ?? '-'}`,
    `- lifecycle: ${supportStatus?.lifecycle?.scenario || runtimeContext?.state?.last_error?.phase || '-'}`,
  ];

  if (supportStatus?.actions?.length) {
    lines.push('- recent_actions:');
    for (const action of supportStatus.actions.slice(0, 4)) {
      lines.push(`  - ${action.id}: ${action.command || action.title}`);
    }
  }

  return truncateText(lines.join('\n'), 2500);
}

function getIssueHistoryPath(projectRoot) {
  return path.join(projectRoot, ISSUE_HISTORY_RELATIVE_PATH);
}

function getIssueReportStatusPath(projectRoot) {
  return path.join(projectRoot, ISSUE_REPORT_STATUS_RELATIVE_PATH);
}

function loadIssueHistory(projectRoot) {
  return readJsonIfExists(getIssueHistoryPath(projectRoot)) || {
    version: 1,
    updated_at: null,
    records: {},
  };
}

function saveIssueHistory(projectRoot, history) {
  history.updated_at = new Date().toISOString();
  writeJson(getIssueHistoryPath(projectRoot), history);
}

function persistIssueReportStatus(projectRoot, status) {
  writeJson(getIssueReportStatusPath(projectRoot), {
    ...status,
    generated_at: new Date().toISOString(),
  });
}

export function getIssueSupportUrl(explicitUrl) {
  return explicitUrl
    || process.env.SUPPORT_API_URL
    || process.env.COS_SUPPORT_URL
    || process.env.SUPPORT_AGENT_URL
    || DEFAULT_SUPPORT_AGENT_URL;
}

export function getIssueSupportLicenseKey(projectRoot, explicitLicenseKey) {
  if (explicitLicenseKey) {
    return explicitLicenseKey;
  }

  return (
    readClinicJsonLicenseKey(projectRoot)
    || readCosLicenseFile(projectRoot)
    || process.env.SUPPORT_LICENSE_KEY
    || process.env.SUPPORT_AGENT_LICENSE_KEY
    || null
  );
}

export function collectIssueCandidate(projectRoot, options = {}) {
  const supportStatus = options.supportStatus || readSupportStatus(projectRoot);
  const runtimeContext = options.runtimeContext || readRuntimeContext(projectRoot);
  const lastError = options.lastError || readLastError(projectRoot);

  const message = options.description || extractLastErrorMessage(lastError) || supportStatus?.error?.error || null;
  if (!options.title && !message) {
    return null;
  }

  const phase = options.phase || lastError?.phase || supportStatus?.error?.phase || runtimeContext?.state?.last_error?.phase || 'unknown';
  const stepName = options.stepName || lastError?.context?.stepName || supportStatus?.install?.in_progress || lastError?.context?.step || null;
  const command = options.command || lastError?.command || null;
  const attemptCount = Number(options.attemptCount || lastError?.context?.attempt || supportStatus?.error?.attemptCount || 0);
  const title = options.title || deriveIssueTitle({ phase, stepName, message });
  const eventTimestamp = options.timestamp || lastError?.timestamp || supportStatus?.error?.occurredAt || new Date().toISOString();

  const fingerprintSeed = [
    phase,
    stepName || '',
    normalizeFingerprintText(title),
    normalizeFingerprintText(message),
    normalizeFingerprintText(command || ''),
  ].join('|');

  const fingerprint = sha256(fingerprintSeed).slice(0, 16);
  const eventKey = sha256(JSON.stringify({
    fingerprint,
    timestamp: eventTimestamp,
    command: command || '',
    message,
  }));

  return {
    source: options.source || (lastError ? 'last-error' : 'support-status'),
    title,
    message,
    phase,
    stepName,
    command,
    attemptCount,
    fingerprint,
    eventKey,
    eventTimestamp,
    supportStatus,
    runtimeContext,
    lastError,
  };
}

export function recordIssueOccurrence(projectRoot, candidate) {
  const history = loadIssueHistory(projectRoot);
  const current = history.records[candidate.fingerprint] || {
    fingerprint: candidate.fingerprint,
    title: candidate.title,
    phase: candidate.phase,
    step_name: candidate.stepName || null,
    first_seen_at: candidate.eventTimestamp,
    last_seen_at: candidate.eventTimestamp,
    occurrence_count: 0,
    attempt_count: candidate.attemptCount,
    last_event_key: null,
    last_message: candidate.message,
    last_command: candidate.command || null,
    last_reported_at: null,
    last_reported_bug_id: null,
    last_reported_event_key: null,
    last_report_mode: null,
  };

  let incremented = false;
  if (current.last_event_key !== candidate.eventKey) {
    current.occurrence_count += 1;
    current.last_seen_at = candidate.eventTimestamp;
    current.last_event_key = candidate.eventKey;
    current.last_message = candidate.message;
    current.last_command = candidate.command || null;
    current.attempt_count = candidate.attemptCount;
    incremented = true;
  }

  current.title = candidate.title;
  current.phase = candidate.phase;
  current.step_name = candidate.stepName || current.step_name || null;
  history.records[candidate.fingerprint] = current;
  saveIssueHistory(projectRoot, history);

  return { history, record: current, incremented };
}

export function summarizeIssueReporting(projectRoot, options = {}) {
  const candidate = options.candidate || collectIssueCandidate(projectRoot, options);
  if (!candidate) {
    return {
      available: false,
      reason: '현재 보고할 반복 오류 후보가 없습니다.',
      report_command: 'npm run agent:report-issue -- --auto --json',
      preview_command: 'npm run agent:report-issue -- --dry-run --json',
    };
  }

  const tracked = options.tracked || recordIssueOccurrence(projectRoot, candidate);
  const occurrenceCount = tracked.record.occurrence_count;
  const severity = options.severity || deriveSeverity({
    phase: candidate.phase,
    message: candidate.message,
    lifecycle: candidate.supportStatus?.lifecycle,
    attemptCount: candidate.attemptCount,
    occurrenceCount,
  });
  const recurring = occurrenceCount >= 2 || candidate.attemptCount >= 2;
  const eligible = recurring || severity === 'critical' || candidate.attemptCount >= 3;
  const alreadyReportedSameEvent = tracked.record.last_reported_event_key === candidate.eventKey;
  const licensePresent = Boolean(getIssueSupportLicenseKey(projectRoot, options.licenseKey));
  let reason = '아직 반복 오류로 보기엔 근거가 부족합니다.';

  if (occurrenceCount >= 2) {
    reason = `동일 fingerprint가 ${occurrenceCount}회 감지되었습니다.`;
  } else if (candidate.attemptCount >= 2) {
    const stepLabel = candidate.stepName || candidate.phase || '현재 단계';
    reason = `${stepLabel}${stepLabel.endsWith('단계') ? '' : ' 단계'}가 ${candidate.attemptCount}회 재시도되어 반복 오류로 판단했습니다.`;
  } else if (severity === 'critical') {
    reason = '프로덕션/데이터 안전성과 관련된 고위험 오류라 즉시 보고 후보로 분류했습니다.';
  }

  if (!licensePresent) {
    reason = `${reason} 다만 라이선스 키가 없어 현재 작업트리에서는 HQ 제출을 완료할 수 없습니다.`;
  }

  return {
    available: true,
    title: candidate.title,
    phase: candidate.phase,
    step_name: candidate.stepName || null,
    fingerprint: candidate.fingerprint,
    occurrence_count: occurrenceCount,
    attempt_count: candidate.attemptCount,
    severity,
    recurring,
    eligible,
    already_reported_same_event: alreadyReportedSameEvent,
    report_command: 'npm run agent:report-issue -- --auto --json',
    preview_command: 'npm run agent:report-issue -- --dry-run --json',
    support_url: getIssueSupportUrl(options.supportUrl),
    license_present: licensePresent,
    last_reported_bug_id: tracked.record.last_reported_bug_id || null,
    last_reported_at: tracked.record.last_reported_at || null,
    reason,
  };
}

export async function checkSimilarBugReports({ supportUrl, licenseKey, candidate }) {
  const url = new URL('/support/report-bug/check-similar', supportUrl);
  url.searchParams.set('title', candidate.title);
  url.searchParams.set('description', candidate.message || candidate.title);

  const response = await fetch(url, {
    headers: {
      'X-License-Key': licenseKey,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || '유사 이슈 조회에 실패했습니다.');
  }

  return payload;
}

export async function appendToExistingBug({ supportUrl, licenseKey, bugId, additionalInfo }) {
  const response = await fetch(`${supportUrl}/support/report-bug/${bugId}/append`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-License-Key': licenseKey,
    },
    body: JSON.stringify({
      additional_info: additionalInfo,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || '기존 bug report 업데이트에 실패했습니다.');
  }

  return payload;
}

export async function submitNewBugReport({ supportUrl, licenseKey, bugReport, force = false }) {
  const url = new URL('/support/report-bug', supportUrl);
  if (force) {
    url.searchParams.set('force', 'true');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-License-Key': licenseKey,
    },
    body: JSON.stringify({
      bug_report: bugReport,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'bug report 제출에 실패했습니다.');
  }

  return payload;
}

function buildBugReport(candidate, summary) {
  const supportStatus = candidate.supportStatus;
  const runtimeContext = candidate.runtimeContext;

  return {
    title: candidate.title,
    description: buildDescription({
      title: candidate.title,
      phase: candidate.phase,
      stepName: candidate.stepName,
      message: candidate.message,
      command: candidate.command,
      lifecycle: supportStatus?.lifecycle,
      supportStatus,
      runtimeContext,
      occurrenceCount: summary.occurrence_count,
      attemptCount: candidate.attemptCount,
    }),
    steps_to_reproduce: buildStepsToReproduce({
      command: candidate.command,
      phase: candidate.phase,
      stepName: candidate.stepName,
      supportStatus,
      lastError: candidate.lastError,
    }),
    expected_behavior: `Clinic-OS 에이전트가 ${candidate.command || candidate.stepName || candidate.phase} 작업을 정상적으로 완료해야 합니다.`,
    actual_behavior: `${candidate.message} 오류로 ${candidate.stepName || candidate.phase} 단계가 중단되며, 로컬 에이전트가 반복적으로 같은 문제를 다시 만납니다.`,
    error_message: candidate.message || undefined,
    code_snippet: buildCodeSnippet({
      lastError: candidate.lastError,
      supportStatus,
      runtimeContext,
    }),
    environment: {
      version: stripLeadingV(
        supportStatus?.versions?.core_version
        || supportStatus?.versions?.app_package_version
        || runtimeContext?.repo?.core_version
        || runtimeContext?.repo?.app_package_version
        || null,
      ) || undefined,
      browser: `agent-cli/node ${process.version}`,
      os: `${os.platform()} ${os.release()}`,
    },
    severity: summary.severity,
  };
}

function markIssueAsReported(projectRoot, candidate, summary, report) {
  const history = loadIssueHistory(projectRoot);
  const current = history.records[candidate.fingerprint];
  if (current) {
    current.last_reported_at = new Date().toISOString();
    current.last_reported_bug_id = report.internal_id || report.bugId || null;
    current.last_reported_event_key = candidate.eventKey;
    current.last_report_mode = report.mode || 'created';
    history.records[candidate.fingerprint] = current;
    saveIssueHistory(projectRoot, history);
  }

  persistIssueReportStatus(projectRoot, {
    fingerprint: candidate.fingerprint,
    occurrence_count: summary.occurrence_count,
    severity: summary.severity,
    title: candidate.title,
    phase: candidate.phase,
    mode: report.mode,
    internal_id: report.internal_id || report.bugId || null,
    github_issue_url: report.github_issue_url || null,
    support_url: report.support_url || null,
  });
}

export async function reportIssueToSupport(projectRoot, options = {}) {
  const candidate = collectIssueCandidate(projectRoot, options);
  if (!candidate) {
    return {
      mode: 'noop',
      success: false,
      reason: '보고할 에러 후보를 찾지 못했습니다.',
    };
  }

  const tracked = recordIssueOccurrence(projectRoot, candidate);
  const summary = summarizeIssueReporting(projectRoot, {
    ...options,
    candidate,
    tracked,
  });

  const licenseKey = getIssueSupportLicenseKey(projectRoot, options.licenseKey || options.license);
  const supportUrl = getIssueSupportUrl(options.supportUrl);
  const bugReport = buildBugReport(candidate, summary);

  const resultBase = {
    mode: 'preview',
    success: false,
    title: candidate.title,
    phase: candidate.phase,
    fingerprint: candidate.fingerprint,
    severity: summary.severity,
    occurrence_count: summary.occurrence_count,
    recurring: summary.recurring,
    eligible: summary.eligible,
    already_reported_same_event: summary.already_reported_same_event,
    support_url: supportUrl,
    has_license_key: Boolean(licenseKey),
    bug_report: bugReport,
  };

  if (options.dryRun) {
    return resultBase;
  }

  if (options.auto && !summary.eligible) {
    return {
      ...resultBase,
      mode: 'skipped',
      success: false,
      reason: summary.reason,
    };
  }

  if (summary.already_reported_same_event && !options.force) {
    return {
      ...resultBase,
      mode: 'already-reported',
      success: true,
      internal_id: summary.last_reported_bug_id || null,
      reason: '같은 이벤트는 이미 HQ에 보고되었습니다.',
    };
  }

  if (!licenseKey) {
    throw new Error('clinic.json, .cos-license, SUPPORT_LICENSE_KEY 중 어디에서도 라이선스 키를 찾지 못했습니다.');
  }

  const similar = await checkSimilarBugReports({ supportUrl, licenseKey, candidate });
  const duplicates = Array.isArray(similar.potential_duplicates) ? similar.potential_duplicates : [];

  if (duplicates.length > 0 && !options.force) {
    const primary = duplicates[0];
    if (options.appendDuplicate !== false) {
      const appendResult = await appendToExistingBug({
        supportUrl,
        licenseKey,
        bugId: primary.internal_id,
        additionalInfo: buildAdditionalInfo({
          candidate,
          occurrenceCount: summary.occurrence_count,
          supportStatus: candidate.supportStatus,
          runtimeContext: candidate.runtimeContext,
        }),
      });

      const report = {
        mode: 'append-duplicate',
        success: true,
        bugId: primary.internal_id,
        message: appendResult.message || '기존 이슈에 정보를 추가했습니다.',
        potential_duplicates: duplicates,
        trend_info: similar.trend_info || null,
        support_url: supportUrl,
      };
      markIssueAsReported(projectRoot, candidate, summary, report);
      return {
        ...resultBase,
        ...report,
      };
    }

    return {
      ...resultBase,
      mode: 'duplicate-detected',
      success: true,
      potential_duplicates: duplicates,
      trend_info: similar.trend_info || null,
    };
  }

  const submission = await submitNewBugReport({
    supportUrl,
    licenseKey,
    bugReport,
    force: Boolean(options.force),
  });

  const report = {
    mode: 'created',
    success: true,
    internal_id: submission.internal_id,
    github_issue_url: submission.github_issue_url || null,
    message: submission.message || 'Bug report submitted successfully',
    support_url: supportUrl,
  };
  markIssueAsReported(projectRoot, candidate, summary, report);

  return {
    ...resultBase,
    ...report,
    potential_duplicates: [],
  };
}
