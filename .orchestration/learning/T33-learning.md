# T33 Learning Triage

## Reusable Observations

1. Expanding a finding set must update the terminal go-live ledger, not only task headings,
   coverage, and phase membership; otherwise the newly added tasks can bypass final evidence.
2. A validator may encode a known defect as an expected state. When a later task resolves the
   defect, use an explicit pending-or-integrated transition assertion rather than deleting the
   historical check.
3. Root specification findings belong as forward prerequisites of implementation findings.
   A phase label alone does not enforce order; the task-level dependency must carry it.
4. Coverage regeneration is reliable when the task headings, coverage rows, and phase union
   are compared against the same exact expected key set and duplicates are checked separately.
5. Counting dependencies and checking selected reverse edges is insufficient. Every executable
   plan validator needs dangling-edge detection, an explicit cycle path, and a phase-monotonic
   topological order; otherwise individually plausible edges can make tasks permanently blocked.

## Validation

All five observations were exercised by `.orchestration/validation/T33-validate.mjs` and
the post-integration T32 validator run.

## Promotion

No rule or skill was promoted. Review these observations with later remediation-plan work.
