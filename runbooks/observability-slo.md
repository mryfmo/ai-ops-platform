# Observability and SLO Runbook

根拠: ADR-0016 / DevOps:SPEC-INT-010 / AUD-OPS-002。

## Runtime Signals

Application InsightsとLog Analyticsを監視・アラートの正本とする。サーバーはcollector向けのexport surfaceとして、`GET /metrics` にPrometheus textも継続公開する。

| Metric                                           | Type      | Labels                      | Use                                                                              |
| ------------------------------------------------ | --------- | --------------------------- | -------------------------------------------------------------------------------- |
| `aiops_events_queue_depth`                       | gauge     | `status`                    | Current events queue depth for `queued`, `delayed`, and `dispatched`.            |
| `aiops_events_queue_oldest_age_seconds`          | gauge     | `status`                    | Oldest event age by queue status.                                                |
| `aiops_task_run_duration_seconds`                | histogram | `task`, `status`            | Scheduler task runtime.                                                          |
| `aiops_task_failures_total`                      | counter   | `task`                      | Scheduler task failures.                                                         |
| `aiops_report_delivery_total`                    | counter   | `result`                    | Report delivery outcomes: `sent`, `failed`, `skipped`.                           |
| `aiops_report_delivery_failure_ratio_7d` / `_3d` | gauge     | none                        | Persisted delivery-cycle outcomes over trailing 7d / 3d; `-1` means no attempts. |
| `aiops_http_requests_total`                      | counter   | `method`, `route`, `status` | HTTP request rate and 5xx ratio. `route` is the matched Hono pattern.            |
| `aiops_http_request_duration_seconds`            | histogram | `method`, `route`           | HTTP latency distribution and p95.                                               |
| `aiops_db_pool_connections`                      | gauge     | `state`                     | PostgreSQL pool counts for `total`, `idle`, and `waiting`.                       |

OpenTelemetry auto-instrumentation starts only when `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is configured. When unset, startup writes a single structured `telemetry disabled` log entry.

HTTP metricsは、個別IDや機密文字列をcardinality/labelへ持ち込まないようmatched route patternだけを記録する。`/healthz` はprobe trafficによるrequest-rate汚染を避け、`/metrics` はscrape自身の自己計測ループを避けるため除外する。`/readyz` は依存先障害を表す運用信号なので計測対象に残す。

## SLOs

| SLI                        | SLO                                                   | Alert condition                                                                               |
| -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Ingest to dispatch latency | 99% of queued events are dispatched within 5 minutes. | `aiops_events_queue_oldest_age_seconds{status="queued"} > 300` for 10 minutes.                |
| Report delivery success    | 99% of report delivery attempts succeed over 7 days.  | `failed / (sent + failed) > 0.01` for 30 minutes.                                             |
| Scheduler task success     | 99.5% of scheduler runs succeed over 24 hours.        | Any increase in `aiops_task_failures_total` for critical tasks, or success ratio below 99.5%. |

6本のmachine-readable KQL rule definitionsは `ops/azure-monitor-alerts/alerts.yaml` にある。D-04でApplication Insights `AppMetrics` へのmetric/label変換、Log Analytics workspace、action group、scheduled query rulesをIaC化するまでは、定義が配備済みとは扱わない。適用契約と段階的な検証手順は `ops/azure-monitor-alerts/README.md` を参照する。

**QUESTION / `TBD(HUMAN)`:** Which `task` label values are critical? Until that selector is approved, the KQL rules do not encode the immediate critical-task-failure branch; they preserve only the prior per-task 24-hour success-ratio condition below 99.5%.

適用前に、stagingのLog Analyticsで各queryを実行し、`AppMetrics.Sum` がcounter/histogramではinterval delta、gaugeでは観測値であること、必要なlabelが `Properties` にあることを確認する。3日/7日の配信失敗率はAzure log alertの2日query上限を避けるため、サーバーが永続化済み配信周期を60秒ごとにbounded集計したgaugeを使う。既知の正常値と閾値超過値でquery resultと通知先を検証してからproductionで有効化する。

HTTP availability 99.9%は `1 - 5xx / all requests`、p95は `aiops_http_request_duration_seconds_bucket` の累積bucketが全requestの95%へ初めて到達する上限として算出する。PromQL/KQLの導出例は `packages/server/src/observability/httpMetrics.ts` に記載する。

## Checks

```sh
# /metrics requires METRICS_TOKEN. Without it the endpoint is disabled and returns 503;
# with it configured, a request without the header returns 401.
curl -fsS -H "Authorization: Bearer ${METRICS_TOKEN}" http://127.0.0.1:8080/metrics
curl -fsS http://127.0.0.1:8080/readyz
```

`/readyz` returns `503` while failsafe is active or graceful shutdown has begun.
