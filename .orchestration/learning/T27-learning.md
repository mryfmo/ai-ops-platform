# T27 Learning

## What We Learned

- DORA's current public guide frames five metrics and separates throughput from instability. Failed deployment recovery time is a throughput metric and should not be computed from every incident.
- If a source table lacks exact linkage, adding an explicit typed linkage field at the metric boundary is cleaner than treating all incidents as change-caused.
- Period-end remaining counts and burndown series need the same window semantics; seeding opening backlog avoids negative remaining and hides less than clamping.
- Investor-facing metrics should not sum heterogeneous operational facts across companies. Use ownership-weighted financial aggregation and per-company operational detail.
- Web tests import workspace packages through built `dist`; after changing package source used by web, rebuild the dependent workspace package before running focused web tests.
- Unsupported metrics should be removed or shown as NA rather than wired as constants. A hard-coded zero is a fake calculation.
- Portfolio recovery medians need incident-unit pooling; expanding one incident per affected project is only valid for per-project summaries.
- Trend tests must prove recomputation from raw inputs. Passing precomputed aggregate history values only proves echo behavior.

## Where Applied

- `packages/devops/src/lib/doraMetrics.ts`
- `packages/web/src/server/reportData/devopsReportData.ts`
- `packages/prjops/src/lib/executiveSevenKeys.ts`
- `packages/prjops/src/lib/investorMetrics.ts`
- Burndown and risk-score tests.
- Provider seams in `prjopsReportData` for questionnaire and board-pack data.
- 第3巡 production wiring tests for multi-project incidents, left-edge causality, and per-company history snapshots.
