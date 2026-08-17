# P8-T04 Learning

## Reusable Decisions

- Verify the platform-specific native package, not only a small wrapper package: the
  reviewed executable bytes are the relevant supply-chain boundary.
- Keep an execution-profile name as evidence metadata. Provider/model routing remains a
  gateway concern and should not be inferred from a label.
- Pair a broad built-in such as Bash with non-interactive fail-closed permissions, narrow
  allowed patterns, and explicit high-risk denies; any one control alone is insufficient.
- Validate composite-action shell bodies with `bash -n` because repository actionlint only
  scans workflow files.

## Follow-up Boundary

P8-T08/P8-T09 must connect the existing manifest/path guard to dispatch, persist callback
evidence, and define raw parallel tool-call accounting if it is required separately from
the CLI's bounded agentic turns.
