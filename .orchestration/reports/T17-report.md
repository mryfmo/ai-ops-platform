# T17 Report: Integration Delivery

## Summary

Status: ready for review

Implemented ADR-0014 integration delivery on branch `agent/T17` from `agent/T18`. No dependencies were added and no real Graph/GitHub/LLM calls were made. Missing delivery configuration is handled as disabled with explicit audit records.

## Gap Mapping

| Gap | Result | Notes |
| --- | --- | --- |
| 1 report.json consumer | fixed | `.github/workflows/report-generation.yml` uploads `report.json` and posts to `POST /reports/ingest` only when URL/secret are configured. Server validates the shared schema, persists `standard_reports`, and routes newly created reports to delivery. |
| 2 sendMail production wiring | fixed | `createReportDeliveryTask` and ingest-time delivery use existing `GraphClient.sendMail` through DI and require `FROM_MAILBOX`. Missing `REPORT_DELIVERY_ENABLED`/`FROM_MAILBOX` writes `report_delivery_disabled`. |
| 3 nonexistent job scripts | fixed | Confirmed PrjOps package-local workflow YAML is not shipped; updated README/runbooks/ADR-0014 to point delivery to server scheduler and report-generation workflow. |
| 4 workflow YAML under package src | fixed | Confirmed package-local workflow YAML is out of scope for the shipped PrjOps package and removed DevOps `devops-reports.yml`. Kept non-delivery DevOps workflows (`deploy-prod`, failure triage). |
| 5 Graph token duplication | fixed | Added `packages/server/src/tools/createGraphSubscription.ts` using existing `createClientCredentialsTokenProvider` and `GraphClient`; documented in runbook/CLI reference. |
| 6 adaptive card + deep link | fixed | `GraphClient.sendAdaptiveCard` accepts `openUrlActions`; `AGT05_distributor` sends dashboard URL cards; `teamsConversationAgent` supports `/dashboard`. |
| 7 recipients and permission filter | fixed | Added `recipients` schema expansion, `RecipientsRepo`, per-request active evaluation through existing DevOps `isActiveRecipient`, and PrjOps investor filtering before rendering delivery HTML. |
| 8 FROM_MAILBOX config | fixed | Added `FROM_MAILBOX`, `REPORT_DELIVERY_ENABLED`, `REPORT_INGEST_SECRET`, and default Teams config to `config.ts` and docs. |
| 9 dashboard reachability | fixed | Added `buildDashboardDeepLink` and card/reply links to `/app/dashboard?persona=...&period=...`. |
| 10 createSubscription | fixed | Added CLI helper and runbook instructions. |

## Review Notes

- No silent stub path remains for report delivery: disabled states are audited and no "created" or "sent" success is emitted.
- `report_generation.yml` artifact/upload and ingest steps run after either Claude Code or Droid generation.
- Package-local delivery workflows are not shipped as production wiring.

## PR

Created: https://github.com/mryfmo/ai-ops-platform/pull/14
