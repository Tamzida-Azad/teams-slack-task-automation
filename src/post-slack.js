const fs = require('fs');
const path = require('path');
const config = require('./config');

function loadPlaywright() {
  const candidates = [
    path.join(config.rootDir, 'node_modules', 'playwright'),
    path.join(config.rootDir, '..', 'daily-head-start', 'node_modules', 'playwright'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // continue
    }
  }
  throw new Error('Playwright not found');
}

/** Keep <@U…> for API; browser paste often won't notify — map to @Name for readability. */
function mentionsForBrowser(payloadText) {
  let text = payloadText;
  for (const [name, id] of Object.entries(config.slackUserIds || {})) {
    text = text.split(`<@${id}>`).join(`@${name}`);
  }
  return text;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInlineHtml(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  out = out.replace(/^_([^_]+)_$/, '<em>$1</em>');
  return out;
}

/**
 * Build nested HTML lists so Slack composer keeps channel → task → priority hierarchy.
 * Spaces alone are collapsed by HTML/Slack and look flat.
 */
function payloadToNestedHtml(payloadText) {
  const lines = payloadText.split(/\r?\n/);
  let html = '';
  let inChannelOl = false;
  let channelLiOpen = false;
  let inTaskUl = false;
  let taskLiOpen = false;
  let inPriorityUl = false;
  let ownerCount = 0;

  function closePriorityUl() {
    if (inPriorityUl) {
      html += '</ul>';
      inPriorityUl = false;
    }
  }

  function closeTaskLi() {
    closePriorityUl();
    if (taskLiOpen) {
      html += '</li>';
      taskLiOpen = false;
    }
  }

  function closeTaskUl() {
    closeTaskLi();
    if (inTaskUl) {
      html += '</ul>';
      inTaskUl = false;
    }
  }

  function closeChannelLi() {
    closeTaskUl();
    if (channelLiOpen) {
      html += '</li>';
      channelLiOpen = false;
    }
  }

  function closeChannelOl() {
    closeChannelLi();
    if (inChannelOl) {
      html += '</ol>';
      inChannelOl = false;
    }
  }

  function addBlankLines(count) {
    for (let i = 0; i < count; i += 1) {
      html += '<div><br></div>';
    }
  }

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      // Keep channel numbering continuous under one owner (blank lines must not reset <ol>).
      if (!inChannelOl) {
        html += '<div><br></div>';
      }
      continue;
    }

    // Owner header: <@U…>: or @Name:
    if (/^(?:<@[A-Z0-9]+>|@[\w .'-]+):\s*$/i.test(trimmed)) {
      closeChannelOl();
      if (ownerCount > 0) {
        // Exactly 2 visual blank lines between team member sections
        addBlankLines(2);
      }
      ownerCount += 1;
      html += `<div><strong>${formatInlineHtml(trimmed)}</strong></div>`;
      continue;
    }

    const channelMatch = trimmed.match(/^\d+\.\s*Channel:\s*(.*)$/i);
    if (channelMatch) {
      if (!inChannelOl) {
        html += '<ol>';
        inChannelOl = true;
      } else {
        closeChannelLi();
      }
      html += `<li>Channel: ${formatInlineHtml(channelMatch[1])}`;
      channelLiOpen = true;
      continue;
    }

    const taskMatch = trimmed.match(/^(?:[-•]|\u2022)\s*(.*)$/);
    if (taskMatch && channelLiOpen) {
      closeTaskLi();
      if (!inTaskUl) {
        html += '<ul>';
        inTaskUl = true;
      }
      html += `<li>${formatInlineHtml(taskMatch[1])}`;
      taskLiOpen = true;
      continue;
    }

    const priorityMatch = trimmed.match(/^(?:◦|\u25e6)?\s*(Priority:\s*.+)$/i);
    if (priorityMatch && taskLiOpen) {
      if (!inPriorityUl) {
        html += '<ul>';
        inPriorityUl = true;
      }
      html += `<li>${formatInlineHtml(priorityMatch[1])}</li>`;
      continue;
    }

    // Italic footer — force 3 blank lines above it
    if (/^_?Tasks Synced from Microsoft Teams via Cursor Automation_?$/i.test(trimmed)) {
      closeChannelOl();
      addBlankLines(3);
      html += '<div><em>Tasks Synced from Microsoft Teams via Cursor Automation</em></div>';
      continue;
    }

    closeChannelOl();
    html += `<div>${formatInlineHtml(trimmed)}</div>`;
  }

  closeChannelOl();
  return html;
}

/** NBSP indent so plain/API text keeps nesting when Slack strips regular spaces. */
function payloadWithVisibleIndent(payloadText) {
  return payloadText
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\s*)(.*)$/);
      if (!m) return line;
      const indent = m[1].replace(/ /g, '\u00a0').replace(/\t/g, '\u00a0'.repeat(4));
      return indent + m[2];
    })
    .join('\n');
}

async function postViaSlackApi(payloadText) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  const channel = process.env.SLACK_CHANNEL_ID || config.slack.channelId;
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text: payloadWithVisibleIndent(payloadText),
      mrkdwn: true,
    }),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Slack API error: ${json.error || JSON.stringify(json)}`);
  }
  return { mode: 'api', channel, ts: json.ts };
}

async function postViaBrowser(payloadText, options = {}) {
  const { chromium } = loadPlaywright();
  const headed = options.headed === true || process.env.SLACK_HEADED === '1';

  if (!fs.existsSync(config.paths.browserProfile)) {
    throw new Error(`Missing browser profile: ${config.paths.browserProfile}`);
  }

  const context = await chromium.launchPersistentContext(config.paths.browserProfile, {
    headless: !headed,
    viewport: { width: 1400, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    const channelId = options.channelId || process.env.SLACK_CHANNEL_ID || config.slack.channelId;
    const clientUrl = `https://app.slack.com/client/${config.slack.teamId}/${channelId}`;
    await page.goto(config.slack.workspaceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeouts.navigation,
    });
    await page.waitForTimeout(2000);
    await page.goto(clientUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeouts.navigation,
    });
    await page.waitForTimeout(4000);

    const body = await page.locator('body').innerText().catch(() => '');
    if (/sign in to your workspace|enter your email|magic code/i.test(body.slice(0, 600))) {
      throw new Error('Slack login wall on project browser-profile — run npm run save-auth');
    }

    const composer = page.locator('[data-qa="message_input"]').first();
    await composer.waitFor({ state: 'visible', timeout: config.timeouts.navigation });
    await composer.click();
    await page.waitForTimeout(200);

    const browserText = mentionsForBrowser(payloadText);
    const html = payloadToNestedHtml(browserText);
    const plain = payloadWithVisibleIndent(browserText);

    const pasted = await page.evaluate(
      async ({ html, plain }) => {
        const el = document.querySelector('[data-qa="message_input"]');
        if (!el) return { ok: false };
        el.focus();
        try {
          if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([plain], { type: 'text/plain' }),
              }),
            ]);
            return { ok: true, mode: 'clipboard-html' };
          }
        } catch {
          // fall through
        }
        try {
          document.execCommand('insertHTML', false, html);
          return { ok: true, mode: 'insertHTML' };
        } catch (error) {
          return { ok: false, reason: String(error) };
        }
      },
      { html, plain }
    );

    if (pasted?.mode === 'clipboard-html') {
      await page.keyboard.press('Control+V');
    } else if (!pasted?.ok) {
      await page.evaluate(async (value) => {
        await navigator.clipboard.writeText(value);
      }, plain);
      await page.keyboard.press('Control+V');
    }

    await page.waitForTimeout(500);
    const send = page.locator('[data-qa="texty_send_button"], button[aria-label="Send now"]');
    if (await send.count()) {
      await send.first().click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);
    return { mode: 'browser', channel: channelId };
  } finally {
    await context.close();
  }
}

async function postToSlack(payloadText, options = {}) {
  if (!payloadText || !payloadText.trim()) {
    throw new Error('Empty Slack payload');
  }

  if (!options.browserOnly) {
    try {
      const apiResult = await postViaSlackApi(payloadText);
      if (apiResult) return apiResult;
    } catch (error) {
      if (process.env.SLACK_BOT_TOKEN) {
        throw error;
      }
    }
  }

  return postViaBrowser(payloadText, options);
}

module.exports = {
  postToSlack,
  postViaBrowser,
  postViaSlackApi,
  payloadToNestedHtml,
  payloadWithVisibleIndent,
};

if (require.main === module) {
  const text = fs.readFileSync(config.paths.payloadTxt, 'utf8');
  postToSlack(text, { headed: process.env.SLACK_HEADED === '1' })
    .then((r) => console.log(r))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
