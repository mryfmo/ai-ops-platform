# CLI Reference

Run commands from the repository root.

## Excel Import Template

Generate the current `.xlsx` template:

```bash
pnpm exec tsx packages/shared/src/xlsxImport/generateTemplate.ts aiops-import-template.xlsx
```

The CLI writes the output path passed as the first argument, or `aiops-import-template.xlsx` when omitted.

## Standard Report Schema

Print the full final report schema:

```bash
pnpm exec tsx packages/shared/src/reporting/printReportSchema.ts > standard-report.schema.json
```

Print the slots-only schema used for LLM generation:

```bash
pnpm exec tsx packages/shared/src/reporting/printReportSlotsSchema.ts > standard-report-slots.schema.json
```

Validate a final report JSON file:

```bash
pnpm exec tsx packages/shared/src/reporting/validateReportJson.ts report.json
```

Validate from stdin:

```bash
cat report.json | pnpm exec tsx packages/shared/src/reporting/validateReportJson.ts
```

## Report Metrics and Finalization

Generate code-calculated metrics from environment values:

```bash
REPORT_COMPLETED=8 REPORT_BLOCKED=2 pnpm exec tsx packages/shared/src/reporting/calculateReportMetrics.ts > standard-report.metrics.json
```

Finalize LLM-generated slots into the full report payload:

```bash
REPORT_EVIDENCE_IDS=REQ-040,SPEC-INT-067 \
PERIOD_LABEL=2026-W28 \
REPORT_TYPE=weekly-summary \
pnpm exec tsx packages/shared/src/reporting/finalizeReportJson.ts report-slots.json standard-report.metrics.json > report.json
```

If a slot exceeds its max length, `finalizeReportJson` truncates it and writes `standard-report.audit.json`.

## Traceability

Run the traceability verifier:

```bash
pnpm --filter @aiops/traceability run verify
```

The verifier writes `packages/traceability/output/traceability_matrix.md` and fails when required REQ/SPEC-INT/TH IDs are missing from implementation references, reporting headers are missing under `packages/shared/src/reporting`, or ADR references point to nonexistent ADR files.

## Database Migrations

Apply ordered SQL migrations to an existing PostgreSQL database:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/aiops pnpm --filter @aiops/devops db:migrate
```

Applied versions are recorded in `schema_migrations`. See [database migrations runbook](../../runbooks/database-migrations.md).
The command runs from the source checkout with `tsx`; compiled server startup does not auto-apply migrations.

## Graph Subscription

Create a Microsoft Graph change notification subscription with the server token provider:

```bash
node packages/server/dist/tools/createGraphSubscription.js \
  --resource "/teams/<team-id>/channels/<channel-id>/messages" \
  --notificationUrl "https://aiops.example.com/webhooks/graph" \
  --expiry "2026-07-09T06:00:00Z"
```

See [report delivery runbook](../../runbooks/report-delivery.md) for prerequisites and renewal expectations.

## Workspace Commands

The supported project tasks are in `AGENTS.md` and `.mise.toml`; the common path is:

```bash
mise run install
mise run ci
```
