const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rootDir = path.resolve(__dirname, '..');
const browserProfile = path.join(rootDir, 'browser-profile');

function loadPlaywright() {
  const candidates = [
    path.join(rootDir, 'node_modules', 'playwright'),
    path.join(rootDir, '..', 'daily-head-start', 'node_modules', 'playwright'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next
    }
  }
  throw new Error('Playwright not found. Install in daily-head-start or this project.');
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || '').trim());
    });
  });
}

async function main() {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(browserProfile, { recursive: true });

  console.log('Opening headed Chromium with the Teams→Slack profile.');
  console.log(`Profile: ${browserProfile}`);
  console.log('');
  console.log('1) Sign in to Microsoft Teams if prompted.');
  console.log('2) Sign in to Slack → SJ Innovation workspace.');
  console.log('3) Open #calystaproemr once.');
  console.log('4) Return here and press Enter.');
  console.log('');

  const context = await chromium.launchPersistentContext(browserProfile, {
    headless: false,
    viewport: { width: 1400, height: 900 },
  });

  const teams = context.pages()[0] || (await context.newPage());
  await teams
    .goto('https://teams.microsoft.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    .catch(() =>
      teams.goto('https://teams.live.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
    );

  const slack = await context.newPage();
  await slack.goto('https://sjinnovation.slack.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await ask('Press Enter after Teams and Slack are signed in... ');
  await context.close();
  console.log('Session saved in browser-profile. Next: npm run run-daily');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
