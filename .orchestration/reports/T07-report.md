# T07 Report

## Summary

- Implemented shared standard reporting foundation under `packages/shared/src/reporting/`:
  - schema and slot metadata
  - deterministic validation and evidence header rendering
  - retry once, then truncate wrapper for narrative slots
  - schema print and JSON validation CLIs
- Added thin report generation entrypoints:
  - `.claude/skills/generate-report/SKILL.md`
  - `.factory/droids/report-generator.md`
  - `.factory/skills/generate-report/SKILL.md`
- Added `.github/workflows/report-generation.yml` for headless Claude Code/Droid report generation and repository-side validation.
- Added PrjOps weekly summary report body example with code-computed metrics and narrative slots.
- Registered T07 spec IDs:
  - PrjOps: `REQ-040`, `SPEC-INT-067`, `AC-040-1`
  - DevOps: `SPEC-INT-082`, `AC-032a`

## GitHub

- PR: https://github.com/mryfmo/ai-ops-platform/pull/4
- Branch: `agent/T07`
- Commit: `3e4ee26 feat(reporting): add standard agent report generation`

## Notes

- No dependency additions.
- No real LLM calls were made.
- Full CI passed with `mise run -j 1 ci` to avoid the known parallel `format` / `traceability` generated-file race.
