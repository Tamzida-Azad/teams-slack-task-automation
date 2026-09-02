# Cursor Automation Setup — Calysta Teams → Slack Daily

Use this guide to create a **scheduled Cursor Automation** that runs the daily digest without manual prompting.

## Requirements

1. **Cloud Agent** enabled ([Cloud Agents dashboard](https://cursor.com/dashboard?tab=cloud-agents)).
2. **Playwright MCP** connected in Cursor Settings → MCP (dashboard-backed server required for Automations).
3. Browser profile at `<repo>/browser-profile` signed into Teams and Slack, **or** equivalent storage-state auth on the agent runtime.
4. Open the **Automations** editor from the **Agents Window** (Composer may not support the editor handoff).

## Create the automation

### 1. Trigger — Schedule

| Setting | Value |
|---------|-------|
| Type | On a schedule (cron) |
| Expression | `0 10 * * 1-5` |
| Meaning | Weekdays at 10:00 UTC (= 11:00 BST during British Summer Time) |

Adjust the hour when clocks change (BST vs GMT). The agent prompt also skips Saturday/Sunday as a safety net.

### 2. Tools

Enable:

- **Use MCP server** — Playwright (browser automation for Teams read + Slack post)
- **Post to Slack** *(optional)* — if you prefer the Slack action instead of browser paste for delivery; channel `#calystaproemr`

### 3. Instructions (prompt)

Paste this as the automation prompt:

```
Run the calysta-teams-slack-daily skill end-to-end.

Today is the run date. Apply the correct date window (weekday = today only; Monday = Fri 18:00 through now with weekend consolidation header).

Use Playwright MCP with the authenticated browser profile for Teams and Slack web.

Steps:
1. Scan all six Calysta Teams channels/chats listed in the skill.
2. Extract, categorize, prioritize, and assign owners per skill rules.
3. Format the daily to-do payload for #calystaproemr.
4. Post to Slack #calystaproemr in SJ Innovation workspace.
5. Reply with run statistics (channels scanned, task counts by category/priority/owner).

If today is Saturday or Sunday, exit without posting.

If Teams or Slack shows a login wall, stop and report — do not enter credentials.

If no actionable client tasks were found, still post a minimal digest noting "No new client tasks today" for each owner section (Tamzida, Ashik, Rajib, Rezvi, Pranav). Omit Akramol unless he was explicitly assigned.
```

### 4. Name and description

| Field | Suggested value |
|-------|-----------------|
| Name | Calysta Teams → Slack Daily |
| Description | Reads Calysta client Teams messages, builds prioritized to-do list, posts to #calystaproemr weekdays at 11 AM BST. |

### 5. Model

Use a capable model with browser tool access (e.g. Claude Sonnet or Opus with Cloud Agent).

## Manual runs (no schedule)

In any Agent chat:

```
Run calysta-teams-slack-daily for today. Show me the draft before posting to Slack.
```

## Verify after setup

1. Run once manually from the Automations editor (Test run).
2. Confirm a message appears in `#calystaproemr`.
3. Check run statistics in the agent output.
4. On Monday, verify weekend consolidation window includes Friday evening messages.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login wall on Teams/Slack | Sign in manually in the browser profile, then retry |
| Empty channel | Consumer Teams (`teams.live.com`) — chats may differ from work Teams channel names |
| Wrong timezone | Adjust cron hour (10 UTC = 11 BST) |
| Playwright MCP blocked in editor | Connect Playwright in Cursor Settings → MCP before saving the automation |
