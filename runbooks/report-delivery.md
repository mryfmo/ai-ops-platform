<!-- 根拠: ADR-0014 / AUD-OPM-009 -->

# Report Delivery Runbook

This runbook covers ADR-0014 report ingest, Outlook delivery, Teams cards, dashboard deep links, and Graph subscription creation.

## Prerequisites

- PostgreSQL schema includes `recipients`, `standard_reports`, and `report_delivery_log`.
- Microsoft Graph app has the required mail and Teams message permissions for the configured tenant.
- Server env includes `PUBLIC_BASE_URL`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_STATE`, `GRAPH_ALLOWED_TEAM_IDS`, `GRAPH_ALLOWED_FROM_MAILBOXES`, and `REPORT_INGEST_SECRET`.
- Delivery is intentionally disabled until `REPORT_DELIVERY_ENABLED=true` and `FROM_MAILBOX` are set.
- At least one active `recipients` row exists with `email`; Teams cards require both `teams_team_id` and `teams_channel_id`.
- The Teams app manifest requests team-scoped `ChannelMessage.Send.Group`; install the app and grant RSC consent in each target team before enabling cards. This runbook does not perform installation or consent.

## Enable Delivery

1. Set server env:

   ```sh
   REPORT_DELIVERY_ENABLED=true
   FROM_MAILBOX=reports@example.com
   GRAPH_ALLOWED_FROM_MAILBOXES=reports@example.com
   GRAPH_ALLOWED_TEAM_IDS=<comma-separated exact team ids>
   REPORT_INGEST_SECRET=<32+ char random value>
   DEFAULT_TEAMS_TEAM_ID=<optional team id; pair with channel id>
   DEFAULT_TEAMS_CHANNEL_ID=<optional channel id>
   HEARTBEAT_URL=<optional external dead man's switch URL>
   ```

2. Set GitHub repository variable `REPORT_INGEST_URL` to the public server URL, without a trailing path.
3. Set GitHub repository secret `REPORT_INGEST_SECRET` to the same value used by the server.
4. Run `report-generation.yml`. If the URL or secret is missing, the workflow uploads `report.json` and logs an explicit skip instead of pretending delivery happened.

The allowlists are mandatory, reject empty values and wildcards, and are enforced again by `GraphClient` before token acquisition. Every `recipients.teams_team_id` used for delivery must therefore already be present in `GRAPH_ALLOWED_TEAM_IDS`; database rows cannot add destinations.

## Create Graph Subscription

Build the server package, then run:

```sh
node packages/server/dist/tools/createGraphSubscription.js \
  --teamId "<team-id>" \
  --channelId "<channel-id>" \
  --notificationUrl "https://aiops.example.com/webhooks/graph"
```

The CLI supports only the canonical Teams channel-message resource, computes an expiry with a five-minute safety
buffer below the 4,320-minute maximum, sends `created,updated,deleted`, and uses the same HTTPS callback for
`notificationUrl` and `lifecycleNotificationUrl`. It passes explicit `GRAPH_CLIENT_STATE` and stores Graph's actual
returned expiration with the team and channel IDs.

Authority checked 2026-07-11: [subscription resource limits](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)
and [Teams chatMessage change notifications](https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage).

This local workflow does not prove tenant readiness. The app should receive only the least-privilege RSC/read consent
needed for the installed target team/channel. Real smoke remains blocked until a public sandbox HTTPS callback,
tenant credentials, consent, target installation, mailbox policy, and redacted evidence are supplied by an operator.

## Checks

- `/reports/ingest` returns `201` for a new valid report and `200` for a duplicate.
- Invalid HMAC returns `401`; invalid report schema returns `422`.
- Missing server ingest secret returns `503` and writes `report_ingest_disabled`.
- Missing delivery enablement or `FROM_MAILBOX` writes `report_delivery_disabled`.
- Sent reports create `report_delivery_log` rows and duplicate delivery is skipped per recipient.
- When `HEARTBEAT_URL` is configured, a scheduled delivery cycle with zero failed deliveries sends exactly one `GET`
  with a 10-second timeout. No request is sent when the setting is absent, the task is disabled, the day is not a
  scheduled delivery day, a delivery remains failed/pending, or the cycle exits with an exception. The monitor
  product, expected schedule, grace period, escalation destination, URL ownership, and any timeout override are
  `TBD(HUMAN)` before go-live.

## Permanent-failure resend

The current schema records only `pending` and `sent`; it has no retry counter, `failed` state, DLQ, or automatic
transient/permanent classification. Treat a delivery as a permanent-failure candidate only after an operator has
correlated a `report_delivery_log.status = 'pending'` row with repeated `deliver_failed` audit records and confirmed
that the underlying recipient, Graph permission, mailbox, or Teams channel problem will not recover without action.
The retry limit and who may declare a failure permanent are `TBD(HUMAN)`.

1. Identify pending deliveries without changing the append-only audit log:

   ```sql
   SELECT report_id, recipient_id, delivered_at
   FROM report_delivery_log
   WHERE status = 'pending'
   ORDER BY delivered_at;
   ```

2. Correlate the report and recipient with `audit_log` actions `deliver_failed` or `deliver_card_failed`. Preserve the
   `trace_id`, timestamps, and sanitized error text as incident evidence. Do not infer attempt count from the single
   `report_delivery_log` row because each attempt overwrites its `delivered_at`.
3. Correct the external cause. Confirm that the recipient is active, the email/channel target is current, the sending
   mailbox and Graph permissions are valid, and the server is not in failsafe. The owner for each external system and
   the required approval are `TBD(HUMAN)`.
4. Re-submit the exact validated `report.json` to `POST /reports/ingest` using the existing
   `x-aiops-signature-256` HMAC procedure in `.github/workflows/report-generation.yml`. A duplicate report is accepted;
   `pending` entries are retried with `(再送)` in the mail subject, while `sent` entries remain idempotently skipped.
   Do not edit or delete `report_delivery_log` to force a resend.
5. Verify the target row became `sent`, a `deliver` audit record was appended, the recipient received the report, and
   `aiops_report_delivery_total{result="sent"}` increased. If it remains `pending`, stop manual resubmission to avoid
   repeated recipient contact, attach the trace evidence to the incident, and escalate through the `TBD(HUMAN)` path.
