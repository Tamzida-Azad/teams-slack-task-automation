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

function dhakaParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour12: parts.hour,
    minute: parts.minute,
    dayPeriod: parts.dayPeriod,
  };
}

function dhakaLocalToUtcMs(year, month, day, hour = 0, minute = 0) {
  // Asia/Dhaka is fixed UTC+6 (no DST).
  return Date.UTC(year, month - 1, day, hour - 6, minute, 0);
}

function addCalendarDays(parts, deltaDays) {
  const ms = Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays, 12, 0, 0);
  const dt = new Date(ms);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function getDateWindow(now = new Date()) {
  const d = dhakaParts(now);
  const isMonday = d.weekday === 'Mon';
  const isWeekend = d.weekday === 'Sat' || d.weekday === 'Sun';

  // Scheduled digest ends at 12:10 PM Asia/Dhaka on the run day.
  const end = {
    year: d.year,
    month: d.month,
    day: d.day,
    hour: 12,
    minute: 10,
  };

  let start;
  let label;
  if (isMonday) {
    // Previous Friday 12:10 PM → Monday 12:10 PM (Asia/Dhaka).
    const friday = addCalendarDays(d, -3);
    start = {
      year: friday.year,
      month: friday.month,
      day: friday.day,
      hour: 12,
      minute: 10,
    };
    label = `Monday consolidation (Fri ${friday.month}/${friday.day} 12:10 PM → Mon ${d.month}/${d.day} 12:10 PM Asia/Dhaka)`;
  } else {
    // Previous day 12:00 PM → today 12:10 PM (Asia/Dhaka).
    const prev = addCalendarDays(d, -1);
    start = {
      year: prev.year,
      month: prev.month,
      day: prev.day,
      hour: 12,
      minute: 0,
    };
    label = `${prev.month}/${prev.day} 12:00 PM → ${d.month}/${d.day} 12:10 PM Asia/Dhaka`;
  }

  return {
    timezone: 'Asia/Dhaka',
    isWeekend,
    isMonday,
    label,
    today: { year: d.year, month: d.month, day: d.day },
    start,
    end,
  };
}

function fromDate(date, raw) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    raw,
    iso: date.toISOString(),
  };
}

function parseTimestamp(text, isoDatetime) {
  if (isoDatetime) {
    const date = new Date(isoDatetime);
    if (!Number.isNaN(date.getTime())) {
      return fromDate(date, text || isoDatetime);
    }
  }

  if (!text) return null;
  const t = String(text).trim().replace(/\.$/, '');

  // M/D/YYYY H:MM AM/PM
  let m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m) {
    let hour = Number(m[4]) % 12;
    if (/pm/i.test(m[6])) hour += 12;
    return {
      year: Number(m[3]),
      month: Number(m[1]),
      day: Number(m[2]),
      hour,
      minute: Number(m[5]),
      raw: t,
    };
  }

  // Weekday name, Month D, YYYY H:MM AM/PM
  m = t.match(
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (m) {
    const months = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    let hour = Number(m[5]) % 12;
    if (/pm/i.test(m[7])) hour += 12;
    return {
      year: Number(m[4]),
      month: months[m[2].toLowerCase()],
      day: Number(m[3]),
      hour,
      minute: Number(m[6]),
      raw: t,
    };
  }

  // Today / Yesterday [at] H:MM AM/PM
  m = t.match(/(Today|Yesterday)(?:\s+at)?\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m) {
    const base = new Date();
    if (/yesterday/i.test(m[1])) base.setDate(base.getDate() - 1);
    const d = dhakaParts(base);
    let hour = Number(m[2]) % 12;
    if (/pm/i.test(m[4])) hour += 12;
    return {
      year: d.year,
      month: d.month,
      day: d.day,
      hour,
      minute: Number(m[3]),
      raw: t,
      relative: m[1].toLowerCase(),
    };
  }

  return { raw: t };
}

function inDateWindow(ts, window) {
  if (!ts || !ts.year) {
    // Keep undated messages that are currently visible — LLM will filter noise
    return true;
  }
  if (!window?.start || !window?.end) {
    return false;
  }

  const msgMs = dhakaLocalToUtcMs(
    ts.year,
    ts.month,
    ts.day,
    ts.hour ?? 0,
    ts.minute ?? 0
  );
  const startMs = dhakaLocalToUtcMs(
    window.start.year,
    window.start.month,
    window.start.day,
    window.start.hour,
    window.start.minute
  );
  const endMs = dhakaLocalToUtcMs(
    window.end.year,
    window.end.month,
    window.end.day,
    window.end.hour,
    window.end.minute
  );
  return msgMs >= startMs && msgMs <= endMs;
}

async function openChannel(page, channelName) {
  await page.keyboard.press('Escape').catch(() => {});

  // Prefer an accessible-name match so we don't click the parent "Chats" treeitem
  // (hasText matches descendants and can select the wrong node).
  const byName = page.getByRole('treeitem', {
    name: new RegExp(`^\\s*${escapeRegExp(channelName)}\\b`, 'i'),
  });
  if (await byName.count()) {
    await byName.first().click({ timeout: config.timeouts.action });
    await page.waitForTimeout(3000);
    return;
  }

  const matches = page
    .locator('[role="treeitem"]')
    .filter({ hasText: new RegExp(escapeRegExp(channelName), 'i') });
  const count = await matches.count();
  if (!count) {
    const textItem = page.getByText(channelName, { exact: false }).first();
    if (!(await textItem.count())) {
      throw new Error(`Channel not found in rail: ${channelName}`);
    }
    await textItem.click({ timeout: config.timeouts.action });
  } else {
    // Last match is usually the leaf chat row, not a parent group.
    await matches.nth(count - 1).click({ timeout: config.timeouts.action });
  }
  await page.waitForTimeout(3000);
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function extractMessages(page, channelName) {
  // Scroll up enough to cover prior-noon → today (and Monday Fri→Mon) history.
  const pane = page.locator('[data-tid="message-pane-list-viewport"]').first();
  if (await pane.count()) {
    for (let i = 0; i < 6; i += 1) {
      await pane
        .evaluate((el) => {
          el.scrollTop = Math.max(0, el.scrollTop - 1800);
        })
        .catch(() => {});
      await page.waitForTimeout(700);
    }
    await pane
      .evaluate((el) => {
        el.scrollTop = Math.max(0, el.scrollHeight - 4000);
      })
      .catch(() => {});
    await page.waitForTimeout(1000);
  }

  const raw = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-tid="chat-pane-message"]')];
    return nodes.map((el) => {
      const mid = el.getAttribute('data-mid') || '';
      const authorEl = mid ? document.getElementById(`author-${mid}`) : null;
      const tsEl = mid ? document.getElementById(`timestamp-${mid}`) : null;
      const contentEl = mid
        ? document.getElementById(`content-${mid}`)
        : el.querySelector('[data-message-content], [id^="content-"]');
      const author =
        (authorEl && authorEl.textContent.trim()) ||
        el.querySelector('[data-tid="message-author-name"]')?.textContent?.trim() ||
        null;
      const timestamp =
        (tsEl && (tsEl.getAttribute('aria-label') || tsEl.getAttribute('title') || tsEl.textContent || '').trim()) ||
        null;
      const datetime = (tsEl && tsEl.getAttribute('datetime')) || null;
      const body =
        (contentEl && (contentEl.innerText || contentEl.getAttribute('aria-label') || '').trim()) ||
        (el.innerText || '').trim();
      return {
        mid,
        author,
        timestamp,
        datetime,
        body,
      };
    });
  });

  return raw
    .map((m) => ({
      channel: channelName,
      author: m.author,
      timestamp: m.timestamp,
      datetime: m.datetime,
      parsedTimestamp: parseTimestamp(m.timestamp, m.datetime),
      body: cleanBody(m.body),
      mid: m.mid,
    }))
    .filter((m) => m.body && m.body.length > 2)
    .filter((m) => !/^\d+\s+\w+\s+reaction\.?$/i.test(m.body));
}

function cleanBody(body) {
  return String(body || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function scrapeTeams(options = {}) {
  const { chromium } = loadPlaywright();
  const headed = options.headed === true || process.env.TEAMS_HEADED === '1';
  const window = getDateWindow();
  if (window.isWeekend) {
    return {
      skipped: true,
      reason: 'weekend',
      window,
      channels: [],
      messages: [],
    };
  }

  if (!fs.existsSync(config.paths.browserProfile)) {
    throw new Error(`Missing browser profile: ${config.paths.browserProfile}`);
  }

  const context = await chromium.launchPersistentContext(config.paths.browserProfile, {
    headless: !headed,
    viewport: { width: 1400, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  const channelResults = [];
  const allMessages = [];

  try {
    await page.goto(config.urls.teams, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeouts.navigation,
    });
    await page.waitForTimeout(6000);

    const body = await page.locator('body').innerText().catch(() => '');
    if (/sign in|enter password|pick an account/i.test(body.slice(0, 800)) && !/Chat|Calysta/i.test(body)) {
      throw new Error('Teams login wall — run npm run save-auth and sign in');
    }

    for (const channelName of config.channels) {
      const result = { channel: channelName, status: 'PASS', messageCount: 0, error: null };
      try {
        await openChannel(page, channelName);
        const messages = await extractMessages(page, channelName);
        const filtered = messages.filter((m) => inDateWindow(m.parsedTimestamp, window));
        result.messageCount = filtered.length;
        allMessages.push(...filtered);
      } catch (error) {
        result.status = 'FAIL';
        result.error = String(error.message || error);
      }
      channelResults.push(result);
    }
  } finally {
    await context.close();
  }

  const payload = {
    scrapedAt: new Date().toISOString(),
    window,
    channels: channelResults,
    messages: allMessages,
    stats: {
      channelsScanned: channelResults.length,
      channelsFailed: channelResults.filter((c) => c.status === 'FAIL').length,
      messagesKept: allMessages.length,
    },
  };

  fs.mkdirSync(config.paths.logsDir, { recursive: true });
  fs.writeFileSync(config.paths.messagesJson, JSON.stringify(payload, null, 2));
  return payload;
}

module.exports = {
  scrapeTeams,
  getDateWindow,
  parseTimestamp,
  inDateWindow,
};

if (require.main === module) {
  scrapeTeams({ headed: process.env.TEAMS_HEADED === '1' })
    .then((result) => {
      console.log(JSON.stringify(result.stats || result, null, 2));
      console.log('Wrote', config.paths.messagesJson);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
