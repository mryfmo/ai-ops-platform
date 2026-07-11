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
