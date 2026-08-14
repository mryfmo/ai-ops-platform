# P3-T06 learning triage

- Candidate: Temporal workflow code executed inside the SDK VM bundle is invisible to host V8 coverage.
- Evidence: all 152 control-plane tests passed while the new workflow appeared at approximately 4% host coverage; recorded-history replay and time-skipping tests exercised it. The orchestrator approved the established narrow workflow-file exclusion, after which unchanged thresholds passed.
- Disposition: do not promote to project learn. This is already encoded next to the existing workflow exclusions in `packages/control-plane/vitest.config.ts`, and replay remains the executable guard.
- Plan impact: keep pure policy in directly measured `src/lib`; require time-skipping plus recorded replay for VM-only workflow orchestration.
