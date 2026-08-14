<!-- 根拠: FinalArch:FR-CP-008 / TMP-003 / ADR-0021 / DELTA-01 -->

# Temporal scheduler shadow

Deterministically compares all 15 scheduler registrations in
`packages/server/src/index.ts` with the P3-T05 through P3-T08 Temporal plan at
the fixed clock `2026-05-31T14:59:00.000Z`. For guarded jobs, the comparison
advances actual scheduler ticks until the existing pure due predicate allows
the next action, using an explicit empty holiday calendar.

```bash
pnpm exec esbuild verification/temporal-shadow/run.ts --bundle --platform=node --format=cjs --outfile=/private/tmp/p3t09-shadow.cjs
mise exec -- node --permission --allow-fs-read=. --allow-fs-read=/private/tmp/p3t09-shadow.cjs --import=./verification/temporal-shadow/deny-network.mjs /private/tmp/p3t09-shadow.cjs
pnpm --filter @aiops/server exec vitest run tests/temporalShadow.test.ts --maxWorkers=1
```

The harness parses the live scheduler array with the TypeScript AST, then reads
timing metadata and composition-level overrides from the task factory/index
source.
Temporal actions, first-run times, and recurring intervals come from independent
mappings or the P3-T05/P3-T06 schedule builders. A new, missing, duplicated,
reordered, or retimed task fails
the server test. It does not expose a Temporal client, database, HTTP client, or
file-write path. The evidence command bundles the TypeScript runner to a
temporary file, rejects network modules in the complete bundle, then executes it
with an explicit network-denial preload and Node permissions denying file writes,
child processes, workers, and native addons.

The fixed evidence is in `shadow-evidence.json`: 12 exact plan matches, three
documented timing differences for Graph renewal/startup polling and the
completion-anchored approved-deploy recurrence, one explicit
Temporal-only Graph reconcile plan, and zero external writes.
