# P3-T05 report — Graph subscription workflow

- writer: codex-gpt56-sol-high / branch `agent/P3-T05-graph-subscription-workflow`
- implementation:
  - `graphSubscriptionWorkflow`: one finite Temporal workflow for each renewal/delta/reconcile schedule tick
  - schedule registrar: creates phase-anchored recurring renewal/delta/reconcile Temporal Schedules with overlap `SKIP`; P3-T09 owns runtime shadow wiring
  - deterministic IDs: `graph-subscription/<operation>:<subscriptionId>:<sequence>` via `buildWorkflowId`
  - renewal: absolute deadline timer → authoritative preflight → `runExternalSideEffect` single-attempt write → lost-response reconcile
  - renewal failure: unresolved write switches to polling and runs idempotent delta backfill through a dedicated activity
  - recurring renewal: each Temporal fire derives a fresh idempotency key and 4,315-minute target expiry from replay-safe logical time
  - delta/reconcile: existing 5-minute cadence expressed as durable timers and DI activity ports
  - explicit `shadow` mode suppresses every workflow write; `active` mode is reserved for post-cutover execution
  - every activity input/output uses a schema-versioned envelope; malformed results terminate as non-retryable `E-CP-CONTRACT`
  - renewal activity payload omits the original expiry so recurring static Schedule arguments cannot forward an internally stale timestamp
  - renewal/delta activities permit long Graph `Retry-After` waits and enforce a one-minute heartbeat timeout so worker loss is detected promptly
  - renewal Schedule permits a six-hour catch-up window; delta/reconcile retain their five-minute windows
- shadow coexistence:
  - no server files changed; `subscriptionRenewalTask`, `channelPollingTask`, and `eventsPollingTask` remain intact
  - when the legacy scheduler has already renewed, authoritative preflight returns its receipt and the workflow schedules no Graph write
  - even when a legacy renewal races after preflight, shadow mode cannot dispatch a workflow write
  - shadow reconcile remains an authoritative read while every write path stays suppressed
- evidence:
  - time-skipping renewal deadline and delta cadence tests
  - lost-response and old-scheduler-first no-duplicate tests
  - four recorded histories with replay assertions
  - existing P3-T02..T04 recorded histories restored from `origin/main` and verified byte-identical

Graph tenant sandbox execution was intentionally skipped per task contract; all Graph activity ports use network-free DI mocks.
