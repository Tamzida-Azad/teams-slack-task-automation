# Teams → Slack Task Automation — Process Documentation

**Purpose of this file:** a precise, reviewable description of the automation that reads client
messages from Microsoft Teams, converts them into categorized/prioritized tasks, and posts a
formatted daily to‑do list into Slack `#calystaproemr`. Written so the logic (categorization,
priority, assignment, formatting) can be analysed independently of any single run.

- **Skill source:** `calysta_skill.yaml` (working dir) + bundled skill
  `anthropic-skills:calysta-teams-messagetotask-processor`
- **Last executed:** 31 August 2026 (Monday) — full worked example in §10
- **Operator:** Claude Code, driving a browser via MCP

---

## 1. High-level flow

```
Microsoft Teams (Web)
      │  read messages in target channels, within the date window
      ▼
Extraction ──► Categorization ──► Priority scoring ──► Owner mapping ──► Formatting
      │                                                                     │
      └─────────────────────────────────────────────────────────────────────┘
      ▼
Slack Web  ─►  channel #calystaproemr  ─►  paste formatted payload  ─►  send
```

Ten concrete steps (from `calysta_skill.yaml > processing.steps`):

1. Launch a **persistent browser context** using profile `C:\Users\TAMZIDA\claude-browser-profile`
   and open Teams Web.
2. Iterate through each target channel.
3. Extract unread + recent messages/replies inside the target date window.
4. Analyse text for explicit assignments or relevant context for QA / Developers / PM.
5. Categorize into **Issues / Requests / Problems / Queries / Support / Change Request**.
6. Assign priority from urgency keywords (`urgent`, `ASAP`, `immediately`).
7. **Override:** force **High** priority for any message authored by **Hardik Soni** or **Aaron Yuen**.
8. Map structured tasks to internal team members.
9. Format the output payload using the daily template (§8).
10. Open Slack Web, go to `#calystaproemr`, paste the payload, send.

---

## 2. Inputs

### 2.1 Source
| Field | Value |
|---|---|
| Platform | Microsoft Teams (Web App) — `https://teams.microsoft.com` |
| Auth | Reuses cached tokens from the persistent browser profile (no credential entry) |

### 2.2 Target channels / chats
1. CalystaPro Support Team
2. CRM - Live
3. Calystapro EMR Web Dev
4. Calystapro EMR Feature Highlights
5. CalystaproEMR - CRM
6. *(also observed and used in practice:)* CalystaPro EMR | Rani's Requests

### 2.3 Incoming message types (what to look for)
`Issues`, `Requests`, `Problems`, `Queries`, `Support`, `Change Request`

### 2.4 Client team members (message authors on the client side)
Aaron Yuen · Hardik Soni · Lori Gobert · Rani Houlis · Rima Shah · Jhara Mae Infante · Lucian Lekaj

### 2.5 Internal team (task owners)
| Role | People | Short name used in payload |
|---|---|---|
| QA | Tamzida Azad | Tamzida |
| Developers | Md Ashikuzzaman | Ashik |
| | Rajib Chowdhury | Rajib |
| | Rezvi Alauddin | Rezvi |
| PM | Pranav Rivankar | Pranav |
| Manager | Akramol Hoque | Akramol *(only if explicitly @mentioned or assigned)* |

---

## 3. Output

| Field | Value |
|---|---|
| Platform | Slack (Web App) — `https://app.slack.com` |
| Workspace | SJ Innovation |
| Channel | `#calystaproemr` |
| Cadence | Daily at **11:00 AM BST** |
| Weekend rule | Skip Saturday/Sunday. Monday covers **Friday 12:10 PM → Monday 11:50 AM** Asia/Dhaka. |
| Tue–Fri window | **Previous day 12:00 PM → today 11:50 AM** Asia/Dhaka |

---

## 4. Environment & tooling

| Concern | Detail |
|---|---|
| Browser driver | Playwright MCP (`mcp__playwright__*`) |
| Persistent context | `--user-data-dir C:\Users\TAMZIDA\claude-browser-profile` — keeps Teams/Slack logins between sessions |
| Config location | `C:\Users\TAMZIDA\claude-browser-profile\.mcp.json`; enabled via `enabledMcpjsonServers: ["playwright"]` in `~/.claude.json` for this project |
| Why not the built-in browser | Its profile is not authenticated to Teams/Slack; Claude cannot type passwords, so a pre-authenticated profile is required |
| Credential boundary | Claude never enters passwords, MFA, or account numbers. If a login wall appears, the run pauses and the user signs in manually. |

---

## 5. Extraction rules

- **Date window:**
  - Normal weekday: messages/replies from *today*.
  - Monday (or first working day after a weekend/holiday): Friday 18:00 → Monday run-time.
- **Scope per channel:** unread messages **plus** recent read messages inside the window (threads
  and replies included, because client asks are frequently buried in reply chains).
- **What counts as a candidate task:** any client-authored message that states a problem, asks a
  question, requests a change/feature, or reports something needing action.
  - Pure acknowledgements ("thank you", "noted", reactions) → ignored.
  - Internal-only chatter with no client ask → ignored unless it assigns internal work tied to a
    client request.
- **Resolved-in-thread items:** still logged if they occurred in the window, with a
  `Status: Done` / `Status: Fixed` note and the root cause if stated. This preserves the audit trail.
- **De-duplication:** the same underlying ask appearing in multiple channels is logged once, under
  the most relevant channel, with the owner best positioned to act.

---

## 6. Categorization

| Category | Definition | Typical signals |
|---|---|---|
| **Issue** | Something is broken in production affecting users now | "can't log in", "not working", outage, error |
| **Problem** | Suspected defect / wrong behaviour, not a hard outage | "this number looks wrong", "seems inaccurate" |
| **Query** | Client asking for information or a decision/timeline | "how do we…", "what's the ETA", "is this possible" |
| **Request** | Ask for a new capability that doesn't exist yet | "can we have a view that…", "we'd like the ability to…" |
| **Change Request** | Modify existing behaviour / configurable feature, often billable/custom | "add a field for…", "customise X per facility" |
| **Support** | Operational assistance on existing features / data fixes | "delete this SMS", "reactivate this record", "update this setting" |

Tie-breakers:
- New capability that never existed → **Request**; altering something that exists → **Change Request**.
- A billable/custom-scoped ask → **Change Request** even if phrased as a question.
- Broken + blocking users → **Issue** over **Problem**.

---

## 7. Priority scoring

Applied in order; later rules override earlier ones.

1. **Base = Medium** for Requests / Change Requests / Problems / Queries.
   **Base = Low** for routine Support and anything already resolved.
2. **Keyword bump → High** if the message contains `urgent`, `ASAP`, `immediately`, `now`,
   "can't have issues", "need it by …", or equivalent time pressure.
3. **Author override → High** if the message author is **Hardik Soni** or **Aaron Yuen**
   (regardless of wording). This is the strongest rule.
4. **Business-risk judgement → High** if the client explicitly signals churn/cancellation
   ("they plan to cancel if…") or financial/compliance exposure, even without keywords or an
   override author. This is a documented deviation from the pure keyword rule and should be
   called out in review.
5. Otherwise keep the base level.

Priority is a triage signal for the team, not an SLA commitment.

---

## 8. Output format (template)

```
Date: <Do Month YYYY>
To-do list shared by client via Microsoft Teams[ (weekend consolidation: <range>)]:


<@U03JR0Q2AAG>:

1. Channel: *<Teams channel name>*
   - <Category>: <one-line actionable summary>. [Status: Done/Fixed.]
     Priority: <High|Medium|Low>
   - <Category>: <another task in same channel>
     Priority: <…>

2. Channel: *<other channel>*
   - <Category>: <…>
     Priority: <…>


<@U06CGT7VDH6>:
...
```

Rules:
- Group by **internal owner** (Tamzida, Ashik, Rajib, Rezvi, Pranav), in that order — headers are Slack `@mentions` (`<@U…>`), not bold names.
- **Akramol** (Manager) appears in the payload only when explicitly assigned in a thread.
- Under each owner, **group by channel**: one numbered `Channel:` line per distinct channel; nest multiple task bullets under that channel (do not restate Channel for every task).
- Nest `Priority:` under each task bullet.
- Summary must be **actionable and self-contained** — include facility/client name, the specific
  ask, and any blocker ("blocked pending Dr. Soni approval").
- Owners with nothing that day still get a line: `1. No new client tasks assigned today.`
- Prefer Slack Bot API posting so `<@U…>` resolves to real mentions.
- After the last owner section, leave three blank lines, then italic footer: `_Tasks Synced from Microsoft Teams via Cursor Automation_`

---

## 9. Owner-mapping heuristics

| Signal in thread | Likely owner |
|---|---|
| Explicit @mention / "X please assist…" | the named internal person |
| CRM behaviour, call records, CRM reports, CRM login | Rajib (CRM dev) |
| EMR web app, payment gateway, crons, membership, API keys, Google Cloud | Ashik (EMR dev) |
| Facility issues/problems/queries (often via Jhara), QA/test/verify, schedule meetings with Rani/Rima/Hardik, general issue assistance | Tamzida (QA) |
| Bulk export / any export, quote for a custom request | Pranav (PM) |
| Data fix / setting change on live (delete SMS, update urgent phone #) | Tamzida (QA, has DB access) |
| Unassigned in thread | infer from subsystem table above; if still unclear, **Tamzida** (not Pranav) |

**Pranav is not the catch-all PM** — timeline/approvals/coordination only if he was explicitly asked, or the ask is export/quote.

**Akramol Hoque** is the **team Manager** — do not route routine client tasks to him unless he is
explicitly @mentioned or assigned in the thread.

A single client ask can generate **parallel items for multiple owners** when genuinely needed —
e.g. a dev task to build it *and* a PM task to send a quote.

---

## 10. Worked example — run of 31 August 2026 (Monday)

**Window:** Fri 29 Aug 18:00 → Mon 31 Aug (weekend consolidation).
**Channels with actionable content:** CRM - Live (7), CalystaPro Support Team (2),
Calystapro EMR Web Dev (2), CalystaPro EMR | Rani's Requests (1).
Feature Highlights = "user added" only; CalystaproEMR - CRM = stale.

### 10.1 Source asks → classification table

| # | Channel | Author | Raw ask (paraphrased) | Category | Priority | Why that priority | Owner(s) |
|---|---|---|---|---|---|---|---|
| 1 | CRM - Live | Hardik Soni | "the girls cant sign onto cherry hill crm" / "urgent" — all users locked out; Rajib deployed fix (cause: parallel test deployment on live) | Issue | High | keyword `urgent` + author override; now Fixed | Rajib (fix), Tamzida (verify) |
| 2 | CRM - Live | Hardik Soni | "is this accurate. 50% miss rate" — calls show missed right after hang-up | Problem | High | author override | Rajib |
| 3 | CRM - Live | Lori Gobert | calls should ring to more than 2 reps | Change Request | Medium | base | Rajib |
| 4 | CRM - Live | Lori Gobert | want to see who is currently logged into CRM | Request | Medium | base | Rajib |
| 5 | CRM - Live | Lori Gobert | add time-of-day for missed calls in call record | Change Request | Medium | base | Rajib |
| 6 | CRM - Live | Hardik Soni | need a CRM report/pie chart by **real lead source**, not manual patient source | Change Request | High | author override | Rajib (build), Tamzida (verify) |
| 7 | CRM - Live | Lori Gobert | Agent / Call Center team-member activity view (GoHighLevel-style) | Request | Medium | base | Rajib |
| 8 | CalystaPro Support Team | Jhara Mae Infante | Alabaster Beauty wants product-specific sales-tax rates; "plan to cancel if we can't"; Ashik confirmed = custom request | Change Request | High | churn-risk judgement (§7.4) | Ashik (scope), Pranav (quote/timeline) |
| 9 | CalystaPro Support Team | Jhara Mae Infante | delete unwanted SMS for Rosa Cataldo / Sono Med Spa; patient Erin Barrett located, removed from DB (still on patient phone) | Support | Low | routine + resolved | Tamzida — Done |
| 10 | Calystapro EMR Web Dev | Hardik Soni | timeline for new payment gateway + how long QA takes (new crons + membership revamp) | Query | High | author override | Tamzida (estimate), Pranav (communicate) |
| 11 | Calystapro EMR Web Dev | Md Ashikuzzaman / Hardik Soni | rotate Google Calendar API key for webhook via `admin@calystaproemr.com` (approved by Dr. Soni) | Support | High | Dr. Soni involved / approval | Ashik |
| 12 | CalystaPro EMR \| Rani's Requests | Rima Shah | referral program: (a) one-tap "Tap to send" pre-filled SMS, (b) Ethos-branded shortened URL (spa.guru reads as spam); SMS copy + reward edits already self-serve | Change Request | Medium | base; blocked on Dr. Soni approval + Ethos domain | Ashik (build), Pranav (approval) |

### 10.2 Final payload posted to `#calystaproemr`

```
Date: 31st August 2026
To-do list shared by client via Microsoft Teams (weekend consolidation: Fri 29 Aug - Mon 31 Aug):


*Tamzida:*

1. Channel: *CRM - Live*
   - Issue: Regression-test Cherry Hill CRM login - all users were locked out this morning (cause: a parallel test deployment running on live); Rajib pushed a fix. Verify login stability across users.

   Priority: High

2. Channel: *Calystapro EMR Web Dev*
   - Query: Give Dr. Soni an estimate / test plan to verify the new payment gateway + new crons + membership revamp at the QA facility (~1 week live testing, can only start after live deployment).

   Priority: High

3. Channel: *CRM - Live*
   - Change Request: Support Rajib in validating the new CRM report/pie chart based on real lead source (not manually entered patient source) - requested by Dr. Soni.

   Priority: High

4. Channel: *CalystaPro Support Team*
   - Support: Delete unwanted SMS for Rosa Cataldo / Sono Med Spa - patient Erin Barrett located, message removed from DB (still shows on patient's own phone). Status: Done.

   Priority: Low


*Ashik:*

1. Channel: *Calystapro EMR Web Dev*
   - Support: Generate a new Google Calendar API key for the webhook in Google Cloud Console today via admin@calystaproemr.com (approved by Dr. Soni); not rotated in a long time.

   Priority: High

2. Channel: *CalystaPro Support Team*
   - Change Request: Scope the custom request for product-specific sales-tax rates for Alabaster Beauty (Sarah) - confirmed as a custom request; client may cancel without it. Prepare effort estimate for the quote.

   Priority: High

3. Channel: *CalystaPro EMR | Rani's Requests*
   - Change Request: Referral program - prepare (a) "Tap to send" one-tap pre-populated referral SMS and (b) Ethos-branded shortened referral URL (spa.guru links read as spam). Blocked pending Dr. Soni approval + dedicated Ethos domain.

   Priority: Medium


*Rajib:*

1. Channel: *CRM - Live*
   - Problem: Investigate missed-call rate accuracy (Dr. Soni flagged ~50% miss rate); calls sometimes show "missed" right after the agent hangs up.

   Priority: High

2. Channel: *CRM - Live*
   - Change Request: Build CRM report/pie chart based on the real lead source rather than manually entered patient source (Dr. Soni).

   Priority: High

3. Channel: *CRM - Live*
   - Change Request: Add a time-of-day field for missed calls in the call record section.

   Priority: Medium

4. Channel: *CRM - Live*
   - Request: Add a view of which team members are currently logged into the CRM.

   Priority: Medium

5. Channel: *CRM - Live*
   - Request: Add an Agent / Call Center team-member activity view (GoHighLevel-style per-user activity).

   Priority: Medium

6. Channel: *CRM - Live*
   - Request: Allow inbound CRM calls to ring more than 2 reps.

   Priority: Medium


*Rezvi:*

1. No new client tasks assigned today.


*Pranav:*

1. Channel: *Calystapro EMR Web Dev*
   - Query: Communicate the new payment gateway rollout timeline + ~1-week live QA cycle to Dr. Soni (coordinate with Tamzida's estimate).

   Priority: High

2. Channel: *CalystaPro Support Team*
   - Change Request: Send Alabaster Beauty (via Jhara) the quote and timeline for the product-specific sales-tax custom request - retention-sensitive.

   Priority: High

3. Channel: *CalystaPro EMR | Rani's Requests*
   - Change Request: Get Dr. Soni's approval for the referral "Tap to send" flow and a decision on a dedicated Ethos-branded URL domain.

   Priority: Medium
```

### 10.3 Run statistics (for analysis)

| Metric | Value |
|---|---|
| Channels scanned | 6 (2 had no window activity) |
| Raw messages reviewed | ~120 across channels |
| Candidate asks extracted | 12 |
| Dropped as acknowledgements/noise | ~15 reply messages |
| Tasks by category | Change Request 6 · Request 3 · Query 2 (listed twice: QA+PM) · Issue 1 · Problem 1 · Support 2 |
| Tasks by priority | High 8 · Medium 7 · Low 1 |
| High driven by author override (Hardik/Aaron) | 5 |
| High driven by keyword | 1 (also override) |
| High driven by churn-risk judgement | 1 |
| Tasks by owner | Rajib 6 · Tamzida 4 · Ashik 3 · Pranav 3 · Rezvi 0 |
| Already resolved in-thread | 2 (#1 fixed, #9 done) |

---

## 11. Known limitations / points to review

1. **Consumer vs. work Teams.** The session landed on `teams.live.com` (consumer Teams) where the
   "channels" are actually group chats. Message extraction worked, but there is no true channel
   structure, threading is shallower, and timestamps render as "Today / Friday" rather than dates.
2. **Priority rule §7.4 (churn-risk → High)** is a human-style judgement not written in the skill
   YAML. It fired once (item 8). Decide whether to keep it, formalise it, or drop it.
3. **"Query" items get duplicated across owners** (estimate = QA, communicate = PM). Counted once
   as a client ask but twice as tasks — affects any per-task metrics.
4. **No message links / permalinks** captured in the payload. Traceability back to the source
   message is by channel + paraphrase only.
5. **Weekend consolidation** currently uses Fri 18:00 as the cut-off; holidays are not handled.
6. **Owner mapping is heuristic.** CRM→Rajib, EMR→Ashik is inferred from subsystem, not from an
   explicit assignment in most threads. Rezvi received nothing — no routing rule currently sends
   work to Rezvi.
7. **Send step is irreversible.** The payload is posted with a single send; there is no draft/review
   gate in Slack itself. Review happens before paste.
8. **Time zone:** cadence is defined in BST; the run clock and Teams timestamps are local — verify
   alignment when analysing "was this posted at 11:00".

---

## 12. Change log

| Date | Change |
|---|---|
| 31 Aug 2026 | Initial documentation; first full run executed and posted to `#calystaproemr`. |
| 31 Aug 2026 | Browser automation moved from built-in browser to Playwright MCP with persistent profile `C:\Users\TAMZIDA\claude-browser-profile`. |
| 2 Sep 2026 | Corrected roles: **Pranav** = PM (daily digest owner); **Akramol** = Manager (included only when explicitly assigned). Cursor skill `calysta-teams-slack-daily` added. |
