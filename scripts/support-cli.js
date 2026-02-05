#!/usr/bin/env node

/**
 * Clinic-OS Support Agent CLI Tool
 *
 * Usage:
 *   pnpm support "your question"        - Ask a quick question
 *   pnpm support --deep "question"      - Get detailed analysis
 *   pnpm support --session              - Start interactive session
 *   pnpm support --status               - Check rate limit status
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_SUPPORT_AGENT_URL = 'https://clinic-os-support-agent.yeonseung-choe.workers.dev';

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return env;
}

// Get configuration
function getConfig() {
  const localEnv = loadEnv();

  return {
    supportAgentUrl: process.env.SUPPORT_AGENT_URL || localEnv.SUPPORT_AGENT_URL || DEFAULT_SUPPORT_AGENT_URL,
    licenseKey: process.env.LICENSE_KEY || localEnv.LICENSE_KEY,
    defaultMode: process.env.SUPPORT_AGENT_DEFAULT_MODE || localEnv.SUPPORT_AGENT_DEFAULT_MODE || 'basic'
  };
}

// Parse command line arguments
function parseArgs(args) {
  const flags = {
    deep: false,
    session: false,
    status: false,
    help: false
  };
  const questionParts = [];

  for (const arg of args) {
    if (arg === '--deep' || arg === '-d') {
      flags.deep = true;
    } else if (arg === '--session' || arg === '-s') {
      flags.session = true;
    } else if (arg === '--status') {
      flags.status = true;
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (!arg.startsWith('-')) {
      questionParts.push(arg);
    }
  }

  return {
    flags,
    question: questionParts.join(' ')
  };
}

// Display help message
function showHelp() {
  console.log(`
Clinic-OS Support Agent CLI

Usage:
  pnpm support "your question"        Ask a quick question (basic mode)
  pnpm support --deep "question"      Get detailed analysis (deep mode)
  pnpm support --session              Start interactive session
  pnpm support --status               Check rate limit status
  pnpm support --help                 Show this help message

Options:
  --deep, -d      Use deep mode for complex questions (uses more quota)
  --session, -s   Start an interactive conversation session
  --status        Show current rate limit status
  --help, -h      Show this help message

Examples:
  pnpm support "How do I add a custom field to patient form?"
  pnpm support --deep "D1 migration fails with constraint error"
  pnpm support --session

Environment Variables:
  SUPPORT_AGENT_URL    Support Agent endpoint (default: production URL)
  LICENSE_KEY          Your Clinic-OS license key (required)

Rate Limits:
  Free tier:  10 sessions/day, 20 messages/session, no deep mode
  Basic tier: 50 sessions/day, 50 messages/session, 5 deep/day
  Pro tier:   Unlimited
`);
}

// Start a new session
async function startSession(config) {
  const response = await fetch(`${config.supportAgentUrl}/support/session/start`, {
    method: 'POST',
    headers: {
      'X-License-Key': config.licenseKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Send a message to Support Agent
async function sendMessage(config, sessionId, question, mode) {
  const response = await fetch(`${config.supportAgentUrl}/support/chat`, {
    method: 'POST',
    headers: {
      'X-License-Key': config.licenseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session_id: sessionId,
      message: {
        type: 'troubleshoot_request',
        human_request: question
      },
      mode: mode
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Check rate limit status
async function checkStatus(config) {
  const response = await fetch(`${config.supportAgentUrl}/support/rate-limit`, {
    headers: {
      'X-License-Key': config.licenseKey
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Format and display response
function displayResponse(response, mode) {
  console.log('\n--- Support Agent Response ---\n');

  if (response.response) {
    console.log(response.response);
  }

  if (mode === 'deep' && response.diagnosis) {
    console.log('\n--- Diagnosis ---\n');
    console.log(response.diagnosis);
  }

  if (response.root_cause) {
    console.log('\n--- Root Cause ---\n');
    console.log(response.root_cause);
  }

  if (response.solution_steps && response.solution_steps.length > 0) {
    console.log('\n--- Solution Steps ---\n');
    response.solution_steps.forEach((step, i) => {
      console.log(`${i + 1}. ${step}`);
    });
  }

  if (response.code_suggestion) {
    console.log('\n--- Code Suggestion ---\n');
    console.log(response.code_suggestion);
  }

  if (response.prevention_tips && response.prevention_tips.length > 0) {
    console.log('\n--- Prevention Tips ---\n');
    response.prevention_tips.forEach(tip => {
      console.log(`  - ${tip}`);
    });
  }

  if (response.sources && response.sources.length > 0) {
    console.log('\n--- Sources ---\n');
    response.sources.forEach(source => {
      console.log(`  - ${source.title}: ${source.url}`);
    });
  }

  console.log('');
}

// Display rate limit status
function displayStatus(status) {
  console.log('\n--- Rate Limit Status ---\n');
  console.log(`Tier: ${status.tier || 'unknown'}`);
  console.log(`Sessions today: ${status.sessions_today || 0} / ${status.sessions_limit || '?'}`);
  console.log(`Sessions remaining: ${status.sessions_remaining || '?'}`);

  if (status.messages_this_session !== undefined) {
    console.log(`Messages this session: ${status.messages_this_session || 0} / ${status.messages_limit || '?'}`);
  }

  if (status.deep_mode_today !== undefined) {
    console.log(`Deep mode today: ${status.deep_mode_today || 0} / ${status.deep_mode_limit || '?'}`);
  }

  if (status.resets_at) {
    console.log(`Resets at: ${new Date(status.resets_at).toLocaleString()}`);
  }

  console.log('');
}

// Interactive session mode
async function runInteractiveSession(config) {
  console.log('\nStarting interactive Support Agent session...');
  console.log('Type your questions. Enter "exit" or "quit" to end the session.\n');

  const session = await startSession(config);
  console.log(`Session started (ID: ${session.session_id.substring(0, 12)}...)`);
  console.log(`Messages limit: ${session.messages_limit || 'unknown'}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\nSession ended. Goodbye!');
        rl.close();
        return;
      }

      // Check for mode switch
      let mode = config.defaultMode;
      let question = trimmed;
      if (trimmed.startsWith('--deep ')) {
        mode = 'deep';
        question = trimmed.substring(7);
      }

      try {
        const response = await sendMessage(config, session.session_id, question, mode);
        displayResponse(response, mode);
      } catch (error) {
        console.error(`\nError: ${error.message}\n`);

        if (error.message.includes('RATE_LIMIT') || error.message.includes('rate limit')) {
          console.log('Tip: You have reached your rate limit. Consider upgrading your tier.');
          rl.close();
          return;
        }
      }

      askQuestion();
    });
  };

  askQuestion();
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const { flags, question } = parseArgs(args);

  // Show help
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  // Get configuration
  const config = getConfig();

  // Check for license key
  if (!config.licenseKey) {
    console.error('\nError: LICENSE_KEY not found.');
    console.error('Run "npm run setup" first, or add LICENSE_KEY to your .env file.\n');
    process.exit(1);
  }

  try {
    // Check status
    if (flags.status) {
      const status = await checkStatus(config);
      displayStatus(status);
      process.exit(0);
    }

    // Interactive session
    if (flags.session) {
      await runInteractiveSession(config);
      return;
    }

    // Single question mode
    if (!question) {
      showHelp();
      process.exit(0);
    }

    const mode = flags.deep ? 'deep' : config.defaultMode;

    console.log(`\nAsking Support Agent (${mode} mode)...`);

    // Start session
    const session = await startSession(config);

    // Send question
    const response = await sendMessage(config, session.session_id, question, mode);

    // Display response
    displayResponse(response, mode);

  } catch (error) {
    console.error(`\nError: ${error.message}\n`);

    if (error.message.includes('RATE_LIMIT') || error.message.includes('rate limit')) {
      console.log('Tip: You have reached your rate limit. Consider upgrading your tier.');
      console.log('Check your status with: pnpm support --status\n');
    } else if (error.message.includes('INVALID_LICENSE') || error.message.includes('Invalid license')) {
      console.log('Tip: Your license key may be invalid or expired.');
      console.log('Check your license status at https://clinic-os-hq.pages.dev\n');
    } else if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.log('Tip: Could not connect to Support Agent.');
      console.log('Check your network connection and try again.\n');
    }

    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
