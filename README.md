# Teams → Slack Daily Digest (optimized)

Convert Microsoft Teams client chats into a categorized to-do list posted to Slack `#calystaproemr`.

**Keep this repository private.** `browser-profile/`, `.env`, `auth/`, and `logs/` contain secrets/session data — never commit them.

## Pipeline (cheap)

1. **Node + Playwright (no LLM)** — scrape today’s messages from 6 Teams chats → `logs/teams-messages.json`
2. **Small Cursor SDK call (text only)** — categorize / prioritize / assign owners → `logs/slack-payload.txt`
3. **Slack post** — Bot API if `SLACK_BOT_TOKEN` is set, else Playwright paste into `#calystaproemr`

Scheduled task still calls `npm run run-daily` (same bat).

## Setup

```bash
cd C:\Users\TAMZIDA\qa-automation\teams-slack-task-automation
copy .env.example .env
npm install
```

Edit `.env`:

- `CURSOR_API_KEY` — required for step 2
- `CURSOR_MODEL` — optional (default `composer-2.5`)
- `SLACK_BOT_TOKEN` / `SLACK_CHANNEL_ID` — optional (skip browser paste)

Confirm `browser-profile\` is signed into Teams + Slack:

```bash
npm run save-auth
```

Register weekday task (11:50 AM Asia/Dhaka):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-task.ps1
```

## Commands

| Command | What it does |
|---------|----------------|
| `npm run scrape-teams` | Step 1 only |
| `npm run categorize` | Step 2 only (needs JSON) |
| `npm run post-slack` | Step 3 only (needs payload) |
| `npm run run-daily` | Full pipeline |
| `npm run run-daily:dry` | Scrape + categorize, preview only |
| `npm run run-daily:agent` | Legacy full-browser Cursor agent |

Dry-run:

```bash
set TEAMS_DRY_RUN=1
npm run run-daily
```

## Profile rule

Use **only** `.\browser-profile` for Teams and Slack. Never use `C:\Users\TAMZIDA\claude-browser-profile`.

## Channels

- CalystaPro Support Team
- CRM - Live
- Calystapro EMR Web Dev
- Calystapro EMR Feature Highlights
- CalystaproEMR - CRM
- CalystaPro EMR \| Rani's Requests

## Owners

Tamzida · Ashik · Rajib · Rezvi · Pranav (Akramol only if explicitly assigned)

Owner sections in Slack use member mentions (`<@U…>`). Pranav only for export/quote or explicit asks; facility issues and meeting scheduling go to Tamzida.

## Cadence

Mon–Fri **11:50 AM Asia/Dhaka** via Task Scheduler `SJ-Teams-Slack-Daily`. Mondays consolidate Fri 18:00 → Mon.
