<!-- 根拠: ADR-0014 / AUD-OPM-009 -->

# Report Delivery Runbook

This runbook covers ADR-0014 report ingest, Outlook delivery, Teams cards, dashboard deep links, and Graph subscription creation.

## Prerequisites

- PostgreSQL schema includes `recipients`, `standard_reports`, and `report_delivery_log`.
- Microsoft Graph app has the required mail and Teams message permissions for the configured tenant.
- Server env includes `PUBLIC_BASE_URL`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_STATE`, and `REPORT_INGEST_SECRET`.
- Delivery is intentionally disabled until `REPORT_DELIVERY_ENABLED=true` and `FROM_MAILBOX` are set.
- At least one active `recipients` row exists with `email`; optional `teams_channel_id` enables Teams cards.

## Enable Delivery

1. Set server env:

   ```sh
   REPORT_DELIVERY_ENABLED=true
   FROM_MAILBOX=reports@example.com
   REPORT_INGEST_SECRET=<32+ char random value>
   DEFAULT_TEAMS_CHANNEL_ID=<optional channel id>
   HEARTBEAT_URL=<optional external dead man's switch URL>
   ```

2. Set GitHub repository variable `REPORT_INGEST_URL` to the public server URL, without a trailing path.
3. Set GitHub repository secret `REPORT_INGEST_SECRET` to the same value used by the server.
4. Run `report-generation.yml`. If the URL or secret is missing, the workflow uploads `report.json` and logs an explicit skip instead of pretending delivery happened.

## Create Graph Subscription

Build the server package, then run:

```sh
node packages/server/dist/tools/createGraphSubscription.js \
  --resource "/teams/<team-id>/channels/<channel-id>/messages" \
  --notificationUrl "https://aiops.example.com/webhooks/graph" \
  --expiry "2026-07-09T06:00:00Z"
```

The CLI uses the same client-credentials token provider as the resident server and passes `GRAPH_CLIENT_STATE` as `clientState`.

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
