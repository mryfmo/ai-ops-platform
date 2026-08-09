# A048 report

## Status

Ready for review. Monitoring now has one Application Insights / Log Analytics contract, HTTP RED metrics are emitted with bounded route labels, all six Prometheus alerts are represented as declarative KQL rules, and the duplicate Prometheus rule source is retired.

## Outcome

- Updated the canonical `docs/DevOps.zip` first and re-extracted `04_内部仕様書.md`, `05_開発環境表.md`, and `06_運用環境表.md`; all changed monitoring assumptions carry the R-03-1 revision note. `docs/spec/**` now contains no Datadog references.
- Added Hono middleware for request count/status and latency histograms. Labels use the matched route pattern, never the raw path; `/healthz` and `/metrics` are excluded while `/readyz` remains observable.
- Added executable PromQL and AppMetrics KQL examples for 5xx, 99.9% availability, and p95.
- Migrated the six prior alerts to `ops/azure-monitor-alerts/alerts.yaml`, preserving thresholds and hold periods, and deleted `ops/prometheus-rules.yml` after parity validation.
- Materialized the 3-day and 7-day delivery failure ratios in-app because Azure log alerts cap query windows at two days. One read-only, seven-day-bounded audit query refreshes both gauges every 60 seconds; no-attempt windows export `-1` and are excluded by KQL.
- Wired delivery-cycle audit summaries for both scheduled and immediate report delivery so the rolling gauges cover both production send paths.
- Updated runbooks and regenerated the traceability matrix.

## Review

Independent review reported two findings. The apparent scope violation is covered by the orchestrator's explicit canonical-archive and five-file rolling-metric grants (including `index.ts` and both tests). The valid finding—KQL was prose rather than executable examples—was fixed and revalidated. No unresolved local finding remains. The repository does not define `make require-crit-review`; the command fails only with `No rule to make target`.

## Delivery

- Branch: `agent/a048-monitoring-unification`
- PR: pending creation
- State: ready for review; no merge performed

## Successor boundary

D-04 remains responsible for provisioning Application Insights metric ingestion, the Log Analytics workspace, action groups, and scheduled query rule resources. A048 supplies the code, data contract, declarative definitions, and application-side long-window materialization without claiming Azure resources already exist.
