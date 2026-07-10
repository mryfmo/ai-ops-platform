# GitHub Projects v2 Webhook Setup

## Purpose

ADR-0007 uses forward-only GitHub webhook events plus periodic snapshots for weekly/monthly/quarterly/half/year dashboards.

## Requirements

- Configure an organization-level webhook or GitHub App webhook.
- Subscribe to:
  - `projects_v2_item`
  - `projects_v2_status_update`
  - `issues`
  - `pull_request`
  - `milestone`
- Use the server route `POST /webhooks/github`.
- Set `GITHUB_WEBHOOK_SECRET` to the same secret configured in GitHub.

## Limits

- Projects v2 webhook events are organization-level only. User-owned Projects v2 are out of scope.
- GitHub does not provide complete historical per-item field changes. Data before webhook activation cannot be reconstructed exactly.
- Periodic snapshot reconcile is a safety net for missed webhooks; it is not a historical backfill.

## Validation

- Send a GitHub webhook ping and verify a `202` response.
- Confirm `events` receives `source='github'`.
- Confirm the dispatcher writes normalized rows to `pm_events`.
- Confirm the 6-hour reconcile task writes `pm_snapshots` or skips with `pm_snapshot_reconcile_skipped` when GraphQL rate limit remaining is low.
