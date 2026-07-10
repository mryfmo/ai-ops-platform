---
name: generate-report
description: Thin Factory skill for AI Ops standard report generation.
---

# generate-report

Delegate report shape, slot limits, and validation to:

- `packages/shared/src/reporting/reportSchema.ts`
- `packages/shared/src/reporting/reportPrompt.ts`
- `packages/shared/src/reporting/validateReportJson.ts`

This skill is intentionally thin so Claude Code and Droid use the same report contract.
