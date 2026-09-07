const fs = require('fs');
const path = require('path');
const config = require('./config');
const { scrapeTeams } = require('./scrape-teams');
const { categorizeMessages } = require('./categorize');
const { postToSlack } = require('./post-slack');

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createLogger() {
  fs.mkdirSync(config.paths.logsDir, { recursive: true });
  const filePath = path.join(config.paths.logsDir, `pipeline-${stamp()}.log`);
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

async function main() {
  loadEnvFile(config.paths.envPath);
  const log = createLogger();
  const dryRun = process.env.TEAMS_DRY_RUN === '1' || process.env.DHS_DRY_RUN === '1';

  log.info('Starting optimized Teams → Slack pipeline', {
    dryRun,
    profile: config.paths.browserProfile,
    logFile: log.filePath,
  });

  // 1) Scrape (no LLM)
  log.info('Step 1/3: scraping Teams (Playwright, no LLM)');
  const scrape = await scrapeTeams({
    headed: process.env.TEAMS_HEADED === '1',
  });

  if (scrape.skipped) {
    log.info(`Skipped: ${scrape.reason}`);
    return;
  }

  log.info('Teams scrape complete', scrape.stats);
  if (scrape.stats.channelsFailed) {
    log.warn('Some channels failed', {
      failed: scrape.channels.filter((c) => c.status === 'FAIL'),
    });
  }

  // 2) Categorize (text-only LLM)
  log.info('Step 2/3: categorizing messages (Cursor SDK text-only)');
  const categorized = await categorizeMessages(scrape);
  log.info('Categorize complete', {
    status: categorized.status,
    agentId: categorized.agentId,
    runId: categorized.runId,
    chars: categorized.payloadText.length,
  });

  if (dryRun) {
    console.log('\n----- SLACK PAYLOAD PREVIEW -----\n');
    console.log(categorized.payloadText);
    console.log('\n----- END PREVIEW -----\n');
    log.info('Dry run — skipped Slack post');
    return;
  }

  // 3) Post
  log.info('Step 3/3: posting to Slack #calystaproemr');
  const posted = await postToSlack(categorized.payloadText, {
    headed: process.env.SLACK_HEADED === '1',
  });
  log.info('Slack post complete', posted);

  console.log('\nSUCCESS: Teams → Slack optimized pipeline completed');
  console.log(`Mode: scrape(no LLM) → categorize(text SDK) → slack(${posted.mode})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
