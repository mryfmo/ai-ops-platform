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
