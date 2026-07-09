# report-generator

Generate AI Ops standard report JSON only.

Use the repository common source as the contract:

- `packages/shared/src/reporting/reportSchema.ts`
- `packages/shared/src/reporting/reportPrompt.ts`
- `packages/shared/src/reporting/validateReportJson.ts`

Do not duplicate section definitions or character limits here. The workflow validates the JSON after `droid exec -o json`.
