# Calysta Teams → Slack — Full Process Reference

Canonical source: `docs/process-documentation.md` in the repo root.

## Environment

| Concern | Detail |
|---------|--------|
| Browser | Playwright MCP with profile at `<repo>/browser-profile` |
| Teams URL | `https://teams.microsoft.com` (may redirect to `teams.live.com`) |
| Slack URL | `https://app.slack.com` → SJ Innovation → `#calystaproemr` |
| Cadence | Daily 11:00 AM BST, weekdays only |
| MCP config | `config/.mcp.json.example` → copy to your profile path |

## Internal team

| Role | Person | Payload name |
|------|--------|--------------|
| QA | Tamzida Azad | Tamzida |
| Developer | Md Ashikuzzaman | Ashik |
| Developer | Rajib Chowdhury | Rajib |
| Developer | Rezvi Alauddin | Rezvi |
| PM | Pranav Rivankar | Pranav |
| Manager | Akramol Hoque | Akramol (only if explicitly assigned) |

## Worked example (31 Aug 2026)

See §10 in `docs/process-documentation.md` for the full classification table, final Slack payload, and run statistics from the first production run.

Key patterns from that run:
- Hardik/Aaron author override drove 5 of 8 High-priority items.
- Churn-risk judgement fired once (Alabaster Beauty sales-tax custom request).
- Query items duplicated across Tamzida (estimate) and Pranav (communicate to client).
- Two items resolved in-thread still logged (CRM login fix, SMS delete).

## Review points

1. Formalize or drop churn-risk → High rule (§7.4).
2. Add Teams message permalinks for traceability.
3. Rezvi has no default routing rule — only gets tasks via explicit mention.
4. Akramol is Manager (not PM); Pranav receives PM-routed tasks (quotes, timelines, approvals, client communication).
