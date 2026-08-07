# Observability and SLO Runbook

## Runtime Signals

The server exposes Prometheus text metrics at `GET /metrics`.

| Metric                                  | Type      | Labels           | Use                                                                   |
| --------------------------------------- | --------- | ---------------- | --------------------------------------------------------------------- |
| `aiops_events_queue_depth`              | gauge     | `status`         | Current events queue depth for `queued`, `delayed`, and `dispatched`. |
| `aiops_events_queue_oldest_age_seconds` | gauge     | `status`         | Oldest event age by queue status.                                     |
| `aiops_task_run_duration_seconds`       | histogram | `task`, `status` | Scheduler task runtime.                                               |
| `aiops_task_failures_total`             | counter   | `task`           | Scheduler task failures.                                              |
| `aiops_report_delivery_total`           | counter   | `result`         | Report delivery outcomes: `sent`, `failed`, `skipped`.                |
| `aiops_db_pool_connections`             | gauge     | `state`          | PostgreSQL pool counts for `total`, `idle`, and `waiting`.            |

OpenTelemetry auto-instrumentation starts only when `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is configured. When unset, startup writes a single structured `telemetry disabled` log entry.

## SLOs

| SLI                        | SLO                                                   | Alert condition                                                                               |
| -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Ingest to dispatch latency | 99% of queued events are dispatched within 5 minutes. | `aiops_events_queue_oldest_age_seconds{status="queued"} > 300` for 10 minutes.                |
| Report delivery success    | 99% of report delivery attempts succeed over 7 days.  | `failed / (sent + failed) > 0.01` for 30 minutes.                                             |
| Scheduler task success     | 99.5% of scheduler runs succeed over 24 hours.        | Any increase in `aiops_task_failures_total` for critical tasks, or success ratio below 99.5%. |

The machine-readable rule definitions live in `ops/prometheus-rules.yml`. The deployment owner is responsible for loading that file into Prometheus and verifying that Prometheus accepts it. Alertmanager destinations are outside this runbook.

**QUESTION / `TBD(HUMAN)`:** Which `task` label values are critical? Until that selector is approved, `ops/prometheus-rules.yml` does not encode the immediate critical-task-failure branch; it implements only the per-task 24-hour success-ratio condition below 99.5%.

`promtool` was unavailable when this rule file was added, so validation was limited to YAML parsing and structural checks. The deployment owner must run `promtool check rules ops/prometheus-rules.yml` (or the deployed Prometheus equivalent) before loading the rules.

## Checks

```sh
# /metrics requires METRICS_TOKEN. Without it the endpoint is disabled and returns 503;
# with it configured, a request without the header returns 401.
curl -fsS -H "Authorization: Bearer ${METRICS_TOKEN}" http://127.0.0.1:8080/metrics
curl -fsS http://127.0.0.1:8080/readyz
```

`/readyz` returns `503` while failsafe is active or graceful shutdown has begun.
