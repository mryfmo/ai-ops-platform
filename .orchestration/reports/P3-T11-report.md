# P3-T11 Chaos Suite Report

## Status

Ready for review. `P3-T11-001` was fixed by the orchestrator-authored commit `2e4cca363a6533abee4169c55b298aa8947f4c8e`; the chaos acceptance matrix now has zero wedges.

## Delivered

- Deterministic 14-workflow matrix covering restart, timeout, duplicate, and approval-flood dimensions.
- Cache-zero restart execution with shortened sticky timeout and explicit time-skipping sleeps.
- Live start-to-close and heartbeat fault injection, replay of the merged P3-T02–P3-T08 histories, and bounded retry verification.
- Canonical in-memory ledger mocks proving zero additional external writes for duplicate starts/signals/callbacks.
- Machine-readable `verification/chaos/chaos-evidence.json` plus a Vitest gate that requires byte-equivalent generated evidence and zero wedges/silent successes/duplicates.

## Evidence Summary

- Workflows: 14
- Scenarios: 56
- Recovered: 43
- Explicit failures: 13
- Duplicate side effects: 0
- Silent successes: 0
- Running wedges: 0
- Graph delta heartbeat fault: explicit failure after 5 attempts

## Finding P3-T11-001 — Fixed

The original chaos run found that `replayProbeWorkflow` remained RUNNING after `createExternalObject` exhausted its retry policy and reconciliation returned no object. The orchestrator-adjudicated fix now converts `ExternalSideEffectUnresolvedError` to non-retryable `ApplicationFailure` type `E-CP-EXTERNAL-UNRESOLVED`.

The live probe now requires that exact terminal failure type. The merged P3-T02 replay fixtures remain unchanged and replay successfully.

## Required Next Action

Run the full fresh-DB CI gate and publish the App-authored writer PR.
