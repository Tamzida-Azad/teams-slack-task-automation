const fs = require('fs');
const path = require('path');
const { Agent } = require('@cursor/sdk');

const rootDir = path.resolve(__dirname, '..');
const logsDir = path.join(rootDir, 'logs');
const browserProfile = path.join(rootDir, 'browser-profile');
const envPath = path.join(rootDir, '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createLogger() {
  fs.mkdirSync(logsDir, { recursive: true });
  const filePath = path.join(logsDir, `teams-slack-${stamp()}.log`);
  const write = (level, message, extra) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...(extra || {}),
    });
    fs.appendFileSync(filePath, `${line}\n`);
    const prefix = level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO';
    console.log(`[${prefix}] ${message}`);
  };
  return {
    filePath,
    info: (m, e) => write('info', m, e),
    warn: (m, e) => write('warn', m, e),
    error: (m, e) => write('error', m, e),
  };
}

function isWeekendInDhaka(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
  }).format(now);
  return weekday === 'Sat' || weekday === 'Sun';
}

function playwrightMcpConfig() {
  const nodeExe =
    process.env.DHS_NODE ||
    process.env.NODE_EXE ||
    process.execPath;
  // Prefer system npx via PATH when available; fall back to node+npx-cli if set.
  const npxCli = process.env.NPX_CLI;
  if (npxCli && fs.existsSync(npxCli)) {
    return {
      type: 'stdio',
      command: nodeExe,
      args: [
        npxCli,
        '-y',
        '@playwright/mcp@latest',
        '--user-data-dir',
        browserProfile,
      ],
    };
  }
  return {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest', '--user-data-dir', browserProfile],
  };
}

function buildPrompt() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return `Run the calysta-teams-slack-daily skill end-to-end.

Today's date (Asia/Dhaka): ${today}.
This is a CONFIRMED scheduled Windows Task Scheduler run with auto-send enabled.

Apply the correct date window (Asia/Dhaka): Tue–Fri = previous day 12:00 PM → today 12:10 PM; Monday = previous Friday 12:10 PM → Monday 12:10 PM.

Use Playwright MCP with ONLY this authenticated browser profile for Teams and Slack web:
Browser profile path: ${browserProfile}

HARD RULES:
- Do NOT use C:\\Users\\TAMZIDA\\claude-browser-profile or any Claude/Claude Code profile.
- Do NOT fall back to any other browser profile or user-data-dir.
- Use only the Cursor project profile above (teams-slack-task-automation\\browser-profile).
- If Teams or Slack shows a login wall on that profile, STOP and report — do not switch profiles and do not enter credentials.

Steps:
1. Scan all six Calysta Teams channels/chats listed in the skill.
2. Extract, categorize, prioritize, and assign owners per skill rules.
3. Format the daily to-do payload for #calystaproemr.
4. Post to Slack #calystaproemr in SJ Innovation workspace (auto-send — do not wait for chat approval).
5. Reply with run statistics (channels scanned, task counts by category/priority/owner).

If today is Saturday or Sunday, exit without posting.

If no actionable client tasks were found, still post a minimal digest (Date header + italic footer). Omit owner sections that have zero tasks — do not print "No new client tasks today" placeholders. Omit Akramol unless he was explicitly assigned.
`;
}

async function main() {
  loadEnvFile(envPath);
  const log = createLogger();

  if (isWeekendInDhaka()) {
    log.info('Weekend in Asia/Dhaka — skipping Teams → Slack run');
    return;
  }

  if (!fs.existsSync(browserProfile)) {
    throw new Error(`Missing browser profile at ${browserProfile}. Sign into Teams/Slack once using this profile.`);
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing CURSOR_API_KEY. Copy .env.example to .env and add your Cursor API key, then re-run.'
    );
  }

  const modelId = process.env.CURSOR_MODEL || 'composer-2.5';
  log.info('Starting Teams → Slack scheduled run', {
    cwd: rootDir,
    modelId,
    logFile: log.filePath,
  });

  const result = await Agent.prompt(buildPrompt(), {
    apiKey,
    model: { id: modelId },
    local: {
      cwd: rootDir,
      // Load user skills (calysta-teams-slack-daily) from ~/.cursor/skills
      settingSources: ['user', 'project'],
    },
    mcpServers: {
      playwright: playwrightMcpConfig(),
    },
  });

  log.info('Agent finished', {
    status: result.status,
    agentId: result.agentId,
    runId: result.runId,
  });

  if (result.result) {
    const summaryPath = path.join(logsDir, `result-${stamp()}.txt`);
    fs.writeFileSync(summaryPath, String(result.result), 'utf8');
    console.log(String(result.result).slice(0, 4000));
  }

  if (result.status === 'error') {
    process.exitCode = 2;
    throw new Error(`Agent run status=error (see ${log.filePath})`);
  }

  log.info('SUCCESS: Teams → Slack scheduled run completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(process.exitCode || 1);
});
