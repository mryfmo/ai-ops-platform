# P3-T09 report — Temporal scheduler shadow

- writer: codex-deep-dot / branch `agent/P3-T09-temporal-shadow`
- inventory: all 15 scheduler registrations in `packages/server/src/index.ts`, including the inline `capability-metrics-refresh-30s`; the conditional JIT registration is evaluated under the explicit shadow condition `githubPolicy.enabled=true` (and is mechanically absent under false)
- comparison:
  - P3-T05 Graph and P3-T06 JIT/health plans use their existing pure Temporal schedule builders in `executionMode: "shadow"`
  - P3-T07 report delivery and P3-T08 Plane sync workflow targets, complete call-expression multisets, and child selection are AST-verified without importing Temporal workflow runtime code
  - legacy action calls (AST-verified exactly once) and first-run/cadence timing come from task implementation/factory source plus index-level overrides; implemented Temporal action, workflow target, interval phase, first-run time, and cadence come from the actual schedule definitions
  - unimplemented counterparts use an explicit mapping table; Plane sync is recorded as not semantically equivalent to PM snapshot reconcile
  - P3-T05 Graph reconcile is reported as a Temporal-only plan with no separate legacy registration
  - fixed clock: `2026-05-31T14:59:00.000Z`; guarded jobs advance actual scheduler ticks under an explicit empty holiday calendar, and SHA-256 bindings to the production predicate AST make any predicate drift fail closed
  - `runOnStart` recurrence is recorded as completion-anchored rather than falsely equated with a fixed Temporal phase
  - result: 12 exact planned action/time/cadence matches, three exact reasoned differences, zero unreasoned differences
- safety: source and complete-bundle checks exclude Temporal/DB/network clients; an explicit preload denies network access and Node permissions deny filesystem writes, child processes, workers, and native addons
- completeness: TypeScript AST extraction classifies every actual `startScheduler` array element; exact full call-expression multisets reject added legacy write paths through dependencies or helpers, while mutation tests prove unknown additions, action/workflow removal, inline/composition/run-on-start retiming, and unrelated rationale-covered retiming fail CI
- runtime impact: none; `packages/server/src/index.ts` and every existing scheduler task remain byte-identical
- dependency impact: `packages/server` declares the already-used in-tree `esbuild` `0.28.1` as an exact devDependency so clean runners do not depend on hoisting

Deterministic evidence: `verification/temporal-shadow/shadow-evidence.json`.
