const fs = require('fs');
const { Agent } = require('@cursor/sdk');
const config = require('./config');

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

function mention(owner) {
  const id = config.slackUserIds[owner];
  if (!id) throw new Error(`Missing slackUserIds.${owner}`);
  return `<@${id}>`;
}

function buildCategorizePrompt(scrape) {
  const compact = (scrape.messages || []).map((m, i) => ({
    id: i + 1,
    channel: m.channel,
    author: m.author,
    timestamp: m.timestamp,
    body: m.body.slice(0, 1200),
  }));

  const mTamzida = mention('Tamzida');
  const mAshik = mention('Ashik');
  const mRajib = mention('Rajib');
  const mRezvi = mention('Rezvi');
  const mPranav = mention('Pranav');

  return `You are categorizing Calysta client Teams messages into a Slack daily to-do list.

DATE WINDOW: ${scrape.window?.label || 'today'}
TODAY (Asia/Dhaka context): use the scrape metadata.

INPUT MESSAGES (JSON):
${JSON.stringify(compact, null, 2)}

RULES:
Client authors (strong signal): Aaron Yuen, Hardik Soni, Lori Gobert, Rani Houlis, Rima Shah, Jhara Mae Infante, Lucian Lekaj.
Include client asks: issues, problems, queries, requests, change requests, support.
Exclude pure acknowledgements ("thanks", "noted", reactions-only) and internal chatter with no client ask.
De-duplicate the same ask across channels.
Categories: Issue | Problem | Query | Request | Change Request | Support
Priority:
- Base Medium for Request/Change Request/Problem/Query
- Base Low for routine Support / already resolved
- High if urgent/ASAP/immediately/now/time pressure keywords
- High if author is Hardik Soni or Aaron Yuen
- High if churn/cancel/serious financial-compliance risk
Owners (apply in order; more specific wins):
- Explicit @mention / named ask ("Pranav please assist…") → that person
- CRM behaviour/calls/reports/login → Rajib
- EMR web/payment gateway/crons/membership/API keys/Google Cloud → Ashik
- Facility issues/problems/queries (often via Jhara), live data fixes, QA/test/verify/regression, scheduling meetings with Rani/Rima/Hardik, general issue assistance → Tamzida
- Bulk export / any export request, quote for a custom request → Pranav
- Pranav is NOT the default PM catch-all: do NOT assign timeline/approvals/client communication/coordination/unclear to Pranav unless he was explicitly mentioned or the ask is export/quote
- If still unclear after the above → Tamzida
- Rezvi only when explicitly assigned/mentioned
- Akramol only if explicitly assigned
One ask may create parallel items for multiple owners when genuinely needed (e.g. Ashik build + Pranav quote).
Resolved-in-thread: still include with Status: Done or Status: Fixed.

OUTPUT:
Return ONLY the Slack message text in this exact shape. Use Slack user mentions (<@U…>) for owner headers — do NOT bold owner names. Use *asterisks* only for channel names. No markdown fences. No commentary.

Date: <Do Month YYYY>
To-do list shared by client via Microsoft Teams:


${mTamzida}:

1. Channel: *<channel>*
   - <Category>: <one-line summary>. [Status: Done/Fixed if applicable]
     Priority: <High|Medium|Low>
   - <Category>: <another task in the same channel>
     Priority: <High|Medium|Low>

2. Channel: *<other channel>*
   - <Category>: <one-line summary>
     Priority: <High|Medium|Low>


${mAshik}:
...


${mRajib}:
...


${mRezvi}:
...


${mPranav}:
...



_Tasks Synced from Microsoft Teams via Cursor Automation_

Rules for output:
- Owner headers MUST be exactly these Slack mentions (with colon): ${mTamzida}: / ${mAshik}: / ${mRajib}: / ${mRezvi}: / ${mPranav}:
- Group by channel under each owner: one numbered Channel line per distinct channel; nest multiple tasks under that channel
- Do NOT restate Channel: for every task when they share a channel
- Under each channel, each task is a bullet "- <Category>: …" and Priority is nested under that task (indented)
- Empty owners must say: 1. No new client tasks assigned today.
- Two blank lines between owner sections
- Owner order: Tamzida → Ashik → Rajib → Rezvi → Pranav
- After the last owner section, leave exactly three blank lines, then this exact italic footer (Slack mrkdwn underscores): _Tasks Synced from Microsoft Teams via Cursor Automation_
`;
}

async function categorizeMessages(scrape, options = {}) {
  loadEnvFile(config.paths.envPath);
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CURSOR_API_KEY in .env');
  }

  if (scrape.skipped) {
    return {
      skipped: true,
      reason: scrape.reason,
      payloadText: '',
    };
  }

  const modelId = options.model || process.env.CURSOR_MODEL || 'composer-2.5';
  const prompt = buildCategorizePrompt(scrape);

  // Text-only: no Playwright / MCP tools — much cheaper than browser agent.
  const result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: modelId },
    local: {
      cwd: config.rootDir,
      settingSources: [],
    },
  });

  let payloadText = String(result.result || '').trim();
  // Strip accidental code fences
  payloadText = payloadText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  const footer = '_Tasks Synced from Microsoft Teams via Cursor Automation_';
  // Drop any prior footer variants, then force exactly 3 blank lines before footer.
  payloadText = payloadText
    .replace(/\n*_Tasks Synced from Microsoft Teams via Cursor Automation_\s*$/i, '')
    .replace(
      /\n*_Automated: team member tasks assigned from Microsoft Teams → Slack via Cursor\._\s*$/i,
      ''
    )
    .replace(/\s+$/, '');

  // Normalize to exactly 2 blank lines between owner mention sections.
  const ownerMentionRe = Object.values(config.slackUserIds)
    .map((id) => `<@${id}>:`)
    .join('|');
  if (ownerMentionRe) {
    payloadText = payloadText.replace(
      new RegExp(`\\n+(?=(?:${ownerMentionRe}))`, 'g'),
      '\n\n\n'
    );
  }

  payloadText = `${payloadText}\n\n\n\n${footer}`;

  const tamzidaMention = mention('Tamzida');
  if (
    !/^Date:/m.test(payloadText) ||
    !payloadText.includes(`${tamzidaMention}:`)
  ) {
    throw new Error(`Categorize output missing expected Slack template. status=${result.status}`);
  }

  fs.mkdirSync(config.paths.logsDir, { recursive: true });
  fs.writeFileSync(config.paths.payloadTxt, payloadText, 'utf8');

  return {
    skipped: false,
    status: result.status,
    agentId: result.agentId,
    runId: result.runId,
    payloadText,
    usage: result.usage || null,
  };
}

module.exports = {
  categorizeMessages,
  buildCategorizePrompt,
};

if (require.main === module) {
  const scrape = JSON.parse(fs.readFileSync(config.paths.messagesJson, 'utf8'));
  categorizeMessages(scrape)
    .then((r) => {
      console.log('status', r.status);
      console.log(r.payloadText);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
