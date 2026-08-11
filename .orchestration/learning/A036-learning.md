# A036 learning triage

## Candidate

Microsoft Graph publishes no webhook request-size or batch-count maximum. Its documented 1 MB change-notification threshold is specific to Azure Event Hubs, where rich notification payloads can exceed that value. A webhook limit therefore needs an explicit project or infrastructure policy decision.

For this deployment, 1 MiB is a validated operational choice because subscription creation omits `includeResourceData`; metadata-only notification items are far smaller, and the cap leaves roughly 100x batching headroom while bounding unauthenticated request memory.

## Disposition

Not promoted. The transport distinction is reusable, but the 1 MiB policy depends on this repository's current subscription shape and orchestrator ruling. Revisit when rich notifications are enabled or LB/WAF limits are finalized.
