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

## Checks

```sh
curl -fsS http://127.0.0.1:8080/metrics
curl -fsS http://127.0.0.1:8080/readyz
```

`/readyz` returns `503` while failsafe is active or graceful shutdown has begun.
