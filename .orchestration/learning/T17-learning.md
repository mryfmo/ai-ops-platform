# T17 Learning

## Reusable Findings

- Workflow post-processing steps must be placed after all mutually exclusive generator steps. In `report-generation.yml`, artifact upload and ingest must follow both Claude Code and Droid generation paths.
- In this monorepo, package tests may import workspace package `dist` output. When shared type changes affect another package, build shared first or rely on full `mise run ci` ordering.
- Traceability IDs must appear in the corresponding package `src` corpus. Server-only references do not satisfy PrjOps/DevOps package ID checks.

## Promotion

No AutoSkill promotion requested. These are task-local notes only.
