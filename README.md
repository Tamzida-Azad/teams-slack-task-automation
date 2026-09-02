# Teams → Slack Task Automation (Claude Skill)

Convert Microsoft Teams client conversations into a categorized, prioritized daily to-do list posted to Slack `#calystaproemr`.

**Keep this repository private.** The `browser-profile/` folder contains live Teams and Slack session data (cookies, tokens).

## Repository contents

| Path | Purpose |
|------|---------|
| `skill.yaml` | Main skill definition — channels, team, categorization, output format |
| `docs/process-documentation.md` | Full process doc with worked example (31 Aug 2026) |
| `cursor-skill/` | Cursor Agent Skill — install to `~/.cursor/skills/calysta-teams-slack-daily/` |
| `browser-profile/` | Playwright persistent browser profile (Teams + Slack auth) |
| `config/.mcp.json.example` | Playwright MCP config template |

## Team member setup

### 1. Clone

```bash
git clone https://github.com/<your-github-user>/teams-slack-task-automation.git
cd teams-slack-task-automation
```

### 2. Browser profile path

Each person uses their **own** profile directory (recommended):

```bash
# Option A: use the included browser-profile folder in the clone
# Update config/.mcp.json with your absolute path to ./browser-profile

# Option B: copy browser-profile to a fixed location
cp -r browser-profile ~/claude-browser-profile
```

### 3. Playwright MCP config

Copy the example and set your profile path:

```bash
cp config/.mcp.json.example config/.mcp.json
# Edit user-data-dir to your absolute path (Windows: C:\\Users\\YOU\\...)
```

Place `.mcp.json` in your browser profile folder **or** configure Playwright MCP in Cursor Settings → MCP with the same `--user-data-dir` argument.

### 4. Sign in once

1. Launch Playwright MCP / open Teams Web and Slack Web using this profile.
2. Sign in manually to Microsoft Teams and Slack (SJ Innovation workspace).
3. Do **not** commit new cookies after signing in on a shared clone — each teammate maintains their own session locally.

### 5. Install Cursor skill

```bash
mkdir -p ~/.cursor/skills/calysta-teams-slack-daily
cp cursor-skill/* ~/.cursor/skills/calysta-teams-slack-daily/
```

### 6. Run manually

In Cursor Agent chat:

```
Run calysta-teams-slack-daily for today. Show me the draft before posting to Slack.
```

### 7. Schedule (optional)

See `cursor-skill/automation-setup.md` for Cursor Automations (weekdays 11:00 AM BST).

## Internal team (task owners)

| Role | Person | Payload name |
|------|--------|--------------|
| QA | Tamzida Azad | Tamzida |
| Developer | Md Ashikuzzaman | Ashik |
| Developer | Rajib Chowdhury | Rajib |
| Developer | Rezvi Alauddin | Rezvi |
| PM | Pranav Rivankar | Pranav |
| Manager | Akramol Hoque | Akramol *(only if explicitly assigned)* |

## Output

- **Slack:** `#calystaproemr` in SJ Innovation workspace
- **Cadence:** Weekdays 11:00 AM BST (Monday includes Fri 18:00 → Mon consolidation)

## Related files

- Original working profile: `%USERPROFILE%\claude-browser-profile` (Tamzida's machine)
- Skill name in Cursor: `calysta-teams-slack-daily`
