# ADR-0014: Integration Delivery Runtime

## Status

Accepted

## Context

Outlook, Teams, GitHub Actions generated `report.json`, and Web dashboard links must share the same recipient source, delivery log, audit log, and Graph token provider. ADR-0003 described PrjOps scheduled delivery as GitHub Actions cron, but the remaining delivery path needs the resident server runtime because Actions does not hold the database-backed delivery log or the production Graph client composition.

## Decision

- Outbound report delivery runs in the resident server scheduler, not in PrjOps GitHub Actions cron. This supersedes ADR-0003 for delivery only.
- `REPORT_DELIVERY_ENABLED=false` or missing `FROM_MAILBOX` disables delivery and writes `report_delivery_disabled` audit records.
- `.github/workflows/report-generation.yml` always uploads `report.json` as an artifact. It posts to `POST /reports/ingest` only when `REPORT_INGEST_URL` and `REPORT_INGEST_SECRET` are configured.
- `/reports/ingest` verifies an HMAC signature over the raw body, validates the standard report schema, stores `standard_reports`, and hands newly created reports to the delivery pipeline.
- Delivery reads `recipients` for every request, filters inactive recipients with the existing DevOps recipient rule, renders recipient-specific report HTML, applies the PrjOps investor visibility filter, then uses existing idempotent delivery for Outlook and Teams cards.
- Teams cards and `/dashboard` replies include `Action.OpenUrl` deep links to `/app/dashboard?persona=...&period=...`.
- Obsolete package-local workflow YAML and the pseudo-MSAL `request-weekly.mjs` job are removed. Graph subscription creation uses `packages/server/src/tools/createGraphSubscription.ts` and the existing server token provider.

## Specification IDs

- `REQ-042`: Integrated outbound report delivery.
- `SPEC-INT-069`: PrjOps standard report ingest, recipient filtering, Outlook/Teams delivery, dashboard deep links, and Graph subscription CLI.
- DevOps `REQ-042` / `SPEC-INT-083` / `AC-042-1`: DevOps standard report ingest and delivery use the same server route, recipients table, and disabled+audit behavior.
- `AC-042-1`: Missing delivery configuration is disabled with audit; valid reports are ingested and delivered idempotently without investor data leaks.

## Consequences

The resident server is the single runtime for delivery-side Graph calls. Real delivery still requires Microsoft Graph app permissions, `FROM_MAILBOX`, recipient rows, and explicit `REPORT_DELIVERY_ENABLED=true`; otherwise the system is intentionally disabled and auditable.
