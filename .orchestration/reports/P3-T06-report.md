# P3-T06 report — JIT expiry and health workflows

- writer: `codex-deep-dot` / branch `agent/P3-T06-jit-health-workflows`
- implementation:
  - finite `jitExpiryWorkflow` and `healthEvaluationWorkflow` executions exported through the Temporal entry bundle
  - recurring Temporal Schedules preserve the one-minute JIT and 30-second health cadences with anchored offsets, overlap `SKIP`, and cadence-sized catch-up windows
  - deterministic workflow IDs and per-fire idempotency keys are fixed before activity scheduling from Temporal logical time
  - JIT candidates come from an authoritative read whose activity contract requires the existing `isGrantExpired` / `AGT_SEC.revokeExpiredGrants` authority
  - active JIT revoke uses the existing `runExternalSideEffect` single-attempt boundary plus preflight and lost-response reconciliation
  - health evaluation activity contract requires the existing pure `AGT_ORCH.evaluateFailsafe`; active application persists every observation, including `none`, so consecutive-failure state is not lost
  - unknown transport inputs and activity receipts are validated before use; three-or-more failures are normalized to `activate_failsafe` so an inconsistent activity decision cannot suppress the safety write, while malformed contracts terminate non-retryably as `E-CP-CONTRACT`
  - unresolved external revocation terminates non-retryably as `E-CP-EXTERNAL-UNRESOLVED` and is never blindly retried
- shadow coexistence:
  - existing server scheduler paths remain byte-unchanged
  - authoritative JIT reads and health evaluation continue, while revoke/apply writes are structurally unreachable in shadow mode
  - an existing revocation receipt is reconciled before either shadow suppression or an active write
- scope amendment:
  - `src/workflows/jitHealth.ts` is excluded from host V8 coverage because Temporal runs it in a VM bundle; pure `src/lib` code remains measured and recorded-history replay exercises the workflow file
  - coverage thresholds were not changed
- dependencies: no package manifest or lockfile changes; no new dependency

Runtime registration and active cutover remain outside P3-T06; the injected schedule registrar is ready for the later shadow-wiring task.
