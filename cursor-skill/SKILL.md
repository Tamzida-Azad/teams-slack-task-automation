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

**Skill YAML:** `skill.yaml` in repo root  
**Full process reference:** [reference.md](reference.md)  
**Scheduled Cursor Automation setup:** [automation-setup.md](automation-setup.md)

## Preconditions

- **Browser:** Playwright MCP (`user-playwright`). Persistent profile at `<repo>/browser-profile` (or your local copy) must be signed into Teams and Slack. See repo `README.md` and `config/.mcp.json.example`.
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

| Run day | Window |
|---------|--------|
| Tue–Fri | Messages/replies from **today** only |
| Monday | **Friday 18:00 → Monday run-time** (weekend consolidation) |
| Saturday / Sunday | **Do not run** — skip entirely |

Add weekend note to header when consolidating: `(weekend consolidation: Fri DD Mon - Mon DD Mon)`.

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

Tie-breakers: new capability → Request; alter existing → Change Request; billable/custom phrasing → Change Request; broken + blocking → Issue over Problem.

## Step 4 — Priority (apply in order; later overrides earlier)

1. **Base Medium** — Request, Change Request, Problem, Query.
2. **Base Low** — routine Support and already-resolved items.
3. **Keyword → High** — `urgent`, `ASAP`, `immediately`, `now`, "can't have issues", "need it by …", or equivalent time pressure.
4. **Author override → High** — author is **Hardik Soni** or **Aaron Yuen** (strongest rule).
5. **Churn-risk → High** — client signals cancellation/churn or serious financial/compliance exposure (note in review when used).
6. Otherwise keep base level.

## Step 5 — Owner mapping

| Signal | Owner |
|--------|-------|
| Explicit @mention | Named person |
| CRM behaviour, calls, reports, login | **Rajib** |
| EMR web, payment gateway, crons, membership, API keys, Google Cloud | **Ashik** |
| Test/verify/regression/QA estimate | **Tamzida** |
| Timeline, quote, approvals, client communication, coordination | **Pranav** (PM) |
| Live data fix (delete SMS, update setting) | **Tamzida** |
| Still unclear | **Pranav** (PM) |

**Akramol Hoque** is the **team Manager** — do not route routine client tasks to him. Include an Akramol section only when he is explicitly @mentioned or assigned in the thread.

One client ask may produce **parallel items** for multiple owners (e.g. QA estimate + PM communication).

**Owner order in payload:** Tamzida → Ashik → Rajib → Rezvi → Pranav.

## Step 6 — Output format

Post to Slack `#calystaproemr` using this structure (Slack bold for names/channels):

```
Date: <Do Month YYYY>
To-do list shared by client via Microsoft Teams[(weekend consolidation: <range>)]:


*Tamzida:*

1. Channel: *<channel>*
   - <Category>: <actionable one-line summary>. [Status: Done/Fixed.]

   Priority: <High|Medium|Low>


*Ashik:*
...


*Rajib:*
...


*Rezvi:*

1. No new client tasks assigned today.


*Pranav:*
...
```

Rules:
- Restate `Channel:` before each item (items may span channels).
- Summaries must be self-contained: facility/client name, specific ask, blockers.
- Empty owners: `1. No new client tasks assigned today.`
- Two blank lines between owner sections.

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
