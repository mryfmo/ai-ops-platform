<!-- 根拠: ADR-0016 / AUD-OPS-002 -->

# Azure Monitor alert definitions

根拠: ADR-0016 / AUD-OPS-002。

`alerts.yaml` は、旧 `ops/prometheus-rules.yml` の6ルールを Azure Monitor scheduled query ruleへ移すための宣言的な正本です。D-04でAzure IaCが導入されるまでは、リソースが作成済みであるとは扱いません。

## Ingestion contract

- workspace-based Application Insightsの [`AppMetrics`](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/appmetrics) を対象とする。
- `Name` はPrometheus名を変更せず保持し、ラベルを `Properties` へ保持する。
- counterとhistogram bucket/countは1観測区間のdeltaを `Sum` へ格納する。gaugeは観測値を `Sum` へ格納する。
- Azure log alertのquery範囲は最大2日なので、3日/7日の配信失敗率はサーバーが `audit_log` の配信周期を最大7日に限定して集計し、`aiops_report_delivery_failure_ratio_3d` / `_7d` gaugeとして60秒ごとに更新する。試行0件は健全な0と区別するため `-1` とし、KQLは負値を除外して直近1分の有効なgaugeだけを読む。
- D-04のcollector/IaCは、`METRICS_TOKEN` で保護された `/metrics` の収集、上記変換、Log Analytics workspace、action group、scheduled query ruleを一括管理する。
- 変換が未配備、または必要なmetric/labelが `AppMetrics` に無い環境ではルールを有効化しない。

## Apply guide for D-04

1. Application InsightsとLog Analytics workspaceのresource ID、action group ID、実行service identityをIaC入力へ設定する。
2. `alerts.yaml` の6ルールをAzure [`Microsoft.Insights/scheduledQueryRules`](https://learn.microsoft.com/en-us/azure/templates/microsoft.insights/2026-03-01/scheduledqueryrules)へ変換する。`query`、`criteria`、`evaluation_frequency`、`window_size`、`failing_periods`をそのまま対応付ける。
3. stagingで各metricの `Name`、`Sum`、`Properties` を照合し、counterがdelta temporalityであることを確認する。
4. 各queryをLog Analyticsで実行し、既知の正常値と閾値超過値で0/1件になることを確認する。
5. action groupをテスト通知先へ向けて有効化し、通知とrunbook linkを確認してからproductionへ昇格する。

## Prometheus parity

| Previous alert                 |               KQL lookback |          Threshold | Hold |
| ------------------------------ | -------------------------: | -----------------: | ---: |
| `AiOpsIngestToDispatchLatency` |                   1m gauge |           `> 300s` |  10m |
| `AiOpsDeadLetterQueueNotEmpty` |                   1m gauge |              `> 0` |   5m |
| `AiOpsReportDeliverySuccess`   | rolling 7d gauge（KQL 1m） |           `> 0.01` |  30m |
| `AiOpsSchedulerTaskSuccess`    |                        24h | `> 0.005` per task |   0m |
| `AiOpsReportDeliveryFastBurn`  |                         1h |           `> 0.06` |   0m |
| `AiOpsReportDeliverySlowBurn`  | rolling 3d gauge（KQL 1m） |           `> 0.01` |   0m |

`failing_periods` は1分評価の連続失敗数として旧 `for` を保存しています。critical task selectorは従来どおり未裁定であり、既存の24時間成功率条件だけを移行しています。
