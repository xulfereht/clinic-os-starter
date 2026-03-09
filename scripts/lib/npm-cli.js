import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';

function quoteForShell(value) {
    return JSON.stringify(value);
}

function parseMajor(version) {
    const major = Number.parseInt(String(version || '').trim().split('.')[0], 10);
    return Number.isFinite(major) ? major : null;
}

function getExecutionKey(execution) {
    return `${execution.command}::${execution.argsPrefix.join(' ')}`;
}

function getCandidateExecutions() {
    const candidates = [];
    const seen = new Set();

    const pushCandidate = (execution) => {
        const key = getExecutionKey(execution);
        if (!seen.has(key)) {
            seen.add(key);
            candidates.push(execution);
        }
    };

    const nodeDir = path.dirname(process.execPath);
    const bundledNpm = path.join(nodeDir, 'npm');
    if (fs.existsSync(bundledNpm)) {
        pushCandidate({
            command: bundledNpm,
            argsPrefix: [],
            source: 'node-bundled'
        });
    }

    const npmExecPath = process.env.npm_execpath;
    if (npmExecPath && fs.existsSync(npmExecPath)) {
        if (npmExecPath.endsWith('.js')) {
            pushCandidate({
                command: process.execPath,
                argsPrefix: [npmExecPath],
                source: 'npm_execpath'
            });
        } else {
            pushCandidate({
                command: npmExecPath,
                argsPrefix: [],
                source: 'npm_execpath'
            });
        }
    }

    pushCandidate({
        command: 'npm',
        argsPrefix: [],
        source: 'path'
    });

    return candidates;
}

function probeExecution(execution) {
    try {
        const version = execFileSync(execution.command, [...execution.argsPrefix, '-v'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();

        return {
            ...execution,
            version,
            major: parseMajor(version),
            ok: true
        };
    } catch {
        return {
            ...execution,
            version: null,
            major: null,
            ok: false
        };
    }
}

export function getPreferredNpmExecution(options = {}) {
    const minimumMajor = options.minimumMajor ?? 10;
    const candidates = getCandidateExecutions().map(probeExecution);
    const preferred = candidates.find(candidate => candidate.ok && candidate.major !== null && candidate.major >= minimumMajor);

    if (preferred) {
        return preferred;
    }

    const fallback = candidates.find(candidate => candidate.ok);
    if (fallback) {
        return fallback;
    }

    return {
        command: 'npm',
        argsPrefix: [],
        source: 'path',
        version: null,
        major: null,
        ok: false
    };
}

export function buildNpmCommand(args = '', options = {}) {
    const execution = getPreferredNpmExecution(options);
    const parts = [
        quoteForShell(execution.command),
        ...execution.argsPrefix.map(quoteForShell)
    ];

    if (args) {
        parts.push(args);
    }

    return parts.join(' ');
}

export function getNpmCommandParts(args = [], options = {}) {
    const execution = getPreferredNpmExecution(options);
    return {
        command: execution.command,
        args: [...execution.argsPrefix, ...args],
        info: execution
    };
}
