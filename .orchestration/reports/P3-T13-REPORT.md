<!-- 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005 / ADR-0021 -->

# P3-T13 Report

## Outcome

- Added finite `deployDispatchWorkflow` and `prodMonitorWorkflow` ticks and
  exported them from the Temporal worker entry point.
- Kept `deployments.state` as the only deployment state authority. The exact
  12-state set and transition meanings are unchanged.
- Converted the relevant deployment transitions to receipt-bound
  `created | stale` CAS operations. Only `created` may authorize an external
  deploy or rollback.
- Kept approval consumption on the existing transaction that CAS-updates
  `approvals.dispatched_at` and inserts the `approved` deployment row.
- Preserved D-04: unavailable workflow/stable history/metrics never becomes a
  positive dispatch decision, and shadow mode never consumes an approval.
- Preserved D-16 at its existing upstream TH-001 staging boundary: these new
  workflows accept only post-approval deploy/monitor operations and cannot
  synthesize a critical-count or staging-promotion decision.

## Temporal Safety

- External deploy and rollback use the existing `runExternalSideEffect`
  single-attempt plus reconcile contract.
- Ledger status remains tri-state: `absent` may execute, `sent` reconciles, and
  `pending` fails non-retryably without resend or success.
- Unknown activity envelopes are validated and converted to non-retryable
  `E-CP-CONTRACT` failures.
- Deterministic workflow and idempotency keys are fixed before activities.
- A legacy claimant and the Temporal workflow were run concurrently against
  one CAS authority; exactly one external dispatch occurred.

## Cutover and Replay

- The cutover inventory remains exactly 15 task names and still equals
  `TEMPORAL_CUTOVER_TASK_NAMES`.
- Replaced only the two prior placeholder mappings with the real
  `deployDispatchWorkflow` and `prodMonitorWorkflow` schedule plans.
- Regenerated shadow evidence: 15/15 inventory, 12 matches, 3 reasoned
  differences, 0 unreasoned differences.
- Added three recorded histories with unique sequences 7001-7003 and replayed
  dispatch reconciliation, cutover CAS stale, and monitor rollback.

## Non-goals Preserved

- No production/live enablement, schema or state-machine change, dependency,
  audit change, parallel state ledger, or direct main operation was added.
