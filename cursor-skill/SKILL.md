---
name: calysta-teams-slack-daily
description: >-
  Reads client messages from Microsoft Teams (web), categorizes and prioritizes
  them, maps owners, and posts a formatted daily to-do list to Slack
  #calystaproemr. Use when running the Calysta Teams-to-Slack daily task
  automation, weekday morning digest, weekend consolidation on Monday, or when
  the user mentions calysta_skill, Teams message-to-task, or #calystaproemr
  daily post.
---

# Calysta Teams → Slack Daily Task Automation

Automates intake of client Teams messages via browser, produces a prioritized to-do list, and posts to Slack `#calystaproemr` (SJ Innovation workspace).

**Preferred scheduled path (cheap):** repo `npm run run-daily` — Playwright scrape (no LLM) → text-only Cursor SDK categorize → Slack Bot API or browser paste. See repo `README.md`.

**Interactive / this skill path:** Playwright MCP browse + categorize in chat (higher token cost).

**Full process reference:** [reference.md](reference.md)  
**Scheduled Cursor Automation setup:** [automation-setup.md](automation-setup.md)

## Preconditions

- **Browser profile:** `C:\Users\TAMZIDA\qa-automation\teams-slack-task-automation\browser-profile` must already be signed into Teams and Slack.
- **Profile rule:** Use ONLY that Cursor project profile. Never use `C:\Users\TAMZIDA\claude-browser-profile` or any Claude fallback profile.
- **Credential boundary:** Never enter passwords, MFA, or account numbers. If a login wall appears, stop and ask the user to sign in manually, then resume.
- **Irreversible send:** Always show the full draft payload in chat and get explicit user approval before posting to Slack — unless the run is a confirmed scheduled automation with auto-send enabled.

## Run checklist

Copy and track progress:

```
- [ ] 1. Determine date window (weekday vs Monday consolidation)
- [ ] 2. Open Teams web with authenticated profile
- [ ] 3. Scan all target channels/chats
- [ ] 4. Extract candidate client asks (threads + replies)
- [ ] 5. De-duplicate cross-channel asks
- [ ] 6. Categorize, score priority, map owners
- [ ] 7. Format payload by owner
- [ ] 8. Present draft for review
- [ ] 9. Post to Slack #calystaproemr (after approval)
- [ ] 10. Report run statistics
```

## Step 1 — Date window

All times are **Asia/Dhaka (GMT+6)** (local PC timezone).

| Run day | Window |
|---------|--------|
| Tue–Fri | **Previous day 12:00 PM → today 12:10 PM** |
| Monday | **Previous Friday 12:10 PM → Monday 12:10 PM** |
| Saturday / Sunday | **Do not run** — skip entirely |

Example: Tuesday 12:10 PM run covers Monday 12:00 PM through Tuesday 12:10 PM.

## Step 2 — Teams extraction

1. Navigate to Teams web (`https://teams.microsoft.com` or `https://teams.live.com` if that is where the authenticated session lands).
2. Scan these channels/chats in order:
   - CalystaPro Support Team
   - CRM - Live
   - Calystapro EMR Web Dev
   - Calystapro EMR Feature Highlights
   - CalystaproEMR - CRM
   - CalystaPro EMR | Rani's Requests
3. For each channel: collect **unread** plus **recent read** messages inside the date window, including **thread replies**.
4. **Include** client-authored messages that state a problem, ask a question, request a change/feature, or need action.
5. **Exclude** pure acknowledgements ("thank you", "noted", reactions) and internal chatter with no client ask (unless it assigns internal work tied to a client request).
6. **Resolved-in-thread:** still log with `Status: Done` or `Status: Fixed` plus root cause if stated.
7. **De-duplicate:** same underlying ask in multiple channels → log once under the most relevant channel.

**Client authors (filter signal):** Aaron Yuen, Hardik Soni, Lori Gobert, Rani Houlis, Rima Shah, Jhara Mae Infante, Lucian Lekaj.

## Step 3 — Categorization

| Category | Use when |
|----------|----------|
| **Issue** | Broken in production, users blocked now |
| **Problem** | Suspected defect, not a hard outage |
| **Query** | Information, ETA, or decision request |
| **Request** | New capability that does not exist yet |
| **Change Request** | Modify existing behaviour; often billable/custom |
| **Support** | Operational help on live (data fix, setting change) |
| **Follow up** | Teammate named/asked to act (tagged or plain text) without a stronger category |

Tie-breakers: new capability → Request; alter existing → Change Request; billable/custom phrasing → Change Request; broken + blocking → Issue over Problem.

## Step 4 — Priority (apply in order; later overrides earlier)

1. **Base Medium** — Request, Change Request, Problem, Query, Follow up.
2. **Base Low** — routine Support and already-resolved items.
3. **Keyword → High** — `urgent`, `ASAP`, `immediately`, `now`, "this week", "can't have issues", "need it by …", or equivalent time pressure.
4. **Author override → High** — author is **Hardik Soni** or **Aaron Yuen** (strongest rule).
5. **Churn-risk → High** — client signals cancellation/churn or serious financial/compliance exposure (note in review when used).
6. Otherwise keep base level.

## Step 5 — Owner mapping

| Signal | Owner |
|--------|-------|
| @mention **or** untagged plain-text name ("Ashik you should…", "Tamzida do you know…") | Named person (`Follow up` if no stronger type) |
| CRM behaviour, calls, reports, login | **Rajib** |
| EMR web, payment gateway, crons, membership, API keys, Google Cloud, go-live keys | **Ashik** |
| Facility issues/problems/queries (via Jhara, not quote/custom-paid), live data fix, QA/test/verify, schedule meetings with Rani/Rima/Hardik | **Tamzida** |
| Jhara custom/paid request, implement X, quote/pricing/cost/estimate/deadline | **Pranav** (emails pricing + deadline with Jhara) |
| Bulk export / any export | **Pranav** |
| Still unclear | **Tamzida** (not Pranav) |

**Jhara** intakes user-base / call-center asks. Custom requests are billable — route quote/pricing/deadline to **Pranav**.

**Pranav is not the catch-all PM** for vague coordination unless named, or the ask is Jhara custom/quote/export.

**Akramol Hoque** is the **team Manager** — do not route routine client tasks to him. Include an Akramol section only when he is explicitly @mentioned or assigned in the thread.

One client ask may produce **parallel items** for multiple owners when genuinely needed (e.g. Ashik build + Pranav quote).

**Owner order in payload:** Tamzida → Ashik → Rajib → Rezvi → Pranav (omit any owner with zero tasks).

## Step 6 — Output format

Post to Slack `#calystaproemr` using this structure. Owner headers are Slack member mentions (`<@U…>`), not bold names. Bold channel names with `*asterisks*`.

Slack member IDs: Tamzida `U03JR0Q2AAG`, Ashik `U06CGT7VDH6`, Rajib `U084FG0542K`, Rezvi `U06GSPAEB8B`, Pranav `U07EVSP002F`.

```
Date: <Do Month YYYY>
To-do list shared by client via Microsoft Teams:


<@U03JR0Q2AAG>:

1. Channel: *<channel>*
   - <Category>: <actionable one-line summary>. [Status: Done/Fixed.]
     Priority: <High|Medium|Low>
   - Follow up: <named teammate ask>
     Priority: <High|Medium|Low>


<@U06CGT7VDH6>:
...


<@U07EVSP002F>:
...



_Tasks Synced from Microsoft Teams via Cursor Automation_
```

Rules:
- Group by **channel** under each owner: one numbered `Channel:` line per distinct channel; nest multiple task bullets under that channel.
- Do **not** restate `Channel:` for every task when they share a channel.
- Under each task bullet, nest `Priority:` as a sub-line.
- Summaries must be self-contained: facility/client name, specific ask, blockers.
- **Skip owners with no tasks** — do not show `No new client tasks assigned today.`
- Two blank lines between owner sections that are present.
- After the last owner section, leave exactly three blank lines, then the italic footer: `_Tasks Synced from Microsoft Teams via Cursor Automation_`

## Step 7 — Slack delivery

1. Navigate to `https://app.slack.com`, workspace **SJ Innovation**, channel **#calystaproemr**.
2. Paste formatted payload into the message composer.
3. Send only after user approval (manual runs) or when auto-send is explicitly configured (scheduled runs).

## Step 8 — Run report

After posting, summarize in chat:

| Metric | Value |
|--------|-------|
| Date window | … |
| Channels scanned | … |
| Candidate asks | … |
| Tasks by category | … |
| Tasks by priority | … |
| Tasks by owner | … |
| Resolved in-thread | … |

## Known limitations

- Consumer Teams (`teams.live.com`) may show group chats instead of true channels; extraction still works but threading is shallower.
- No Teams message permalinks in payload — traceability is channel + paraphrase.
- Holidays are not handled in weekend consolidation (Fri 18:00 cut-off only).
