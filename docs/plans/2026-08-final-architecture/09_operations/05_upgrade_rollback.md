# Upgrade and Rollback Runbook

## Upgrade order

1. contracts/readers become backward compatible.
2. DB expand migration.
3. gateway/policy/config canary.
4. workers with versioning/replay evidence.
5. application traffic canary.
6. old writers disabled.
7. rollback window.
8. contract/DB cleanup in later release.

## Component-specific rules

- Temporal: replay all captured histories; breaking workflow changes get new type/version.
- LiteLLM: verify Messages/Bedrock/tool/streaming/headers; keep previous digest.
- agentgateway: conformance test all registered servers and OAuth flows.
- OPA: signed bundle; log-only comparison before enforce; last-known-good retained.
- Work IQ: GA supported version and tenant test; preview CRUD remains off unless separately approved.
- Claude/Droid CLI: exact pin; test repo E2E before runner rollout.

## Rollback

Rollback is a reviewed operational action. Restore prior immutable digest/config/policy bundle, switch feature flag, stop new workflow starts if needed, preserve running histories, reconcile external side effects, and document the decision. Never rollback by manually editing authoritative DB rows.
