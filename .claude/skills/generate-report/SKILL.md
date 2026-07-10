---
name: generate-report
description: Generate AI Ops standard reports from the repository-owned schema and prompt source.
---

# generate-report

Use the common source only:

- Schema and slot limits: `packages/shared/src/reporting/reportSchema.ts`
- Prompt construction: `packages/shared/src/reporting/reportPrompt.ts`
- Validation CLI: `pnpm exec tsx packages/shared/src/reporting/validateReportJson.ts <report.json>`

Do not redefine report sections or character limits in this skill. Standard reports are produced by CI/headless workflows, not by interactive sessions.
