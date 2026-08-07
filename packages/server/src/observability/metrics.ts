/**
 * packages/server/src/observability/metrics.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-010。Prometheus textでqueue/task/delivery/poolの運用指標を公開する。
 */
export interface EventQueueMetric {
  status: string;
  depth: number;
  oldestAgeSeconds: number;
}

type Labels = Record<string, string>;
const EVENT_QUEUE_STATUSES = ["queued", "delayed", "dispatched", "dead"];

function labelKey(labels: Labels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function renderLabels(labels: Labels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries.map(([k, v]) => `${k}="${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, { name: string; labels: Labels; value: number }>();
  private readonly gauges = new Map<string, { name: string; labels: Labels; value: number }>();
  private readonly histograms = new Map<
    string,
    { labels: Labels; buckets: Map<number, number>; sum: number; count: number }
  >();
  private readonly taskBuckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

  inc(name: string, labels: Labels = {}, amount = 1): void {
    const key = `${name}:${labelKey(labels)}`;
    const current = this.counters.get(key) ?? { name, labels, value: 0 };
    current.value += amount;
    this.counters.set(key, current);
  }

  setGauge(name: string, labels: Labels, value: number): void {
    this.gauges.set(`${name}:${labelKey(labels)}`, { name, labels, value });
  }

  observeTaskDuration(task: string, status: "success" | "failure", seconds: number): void {
    const labels = { task, status };
    const key = labelKey(labels);
    const histogram = this.histograms.get(key) ?? {
      labels,
      buckets: new Map(this.taskBuckets.map((bucket) => [bucket, 0])),
      sum: 0,
      count: 0,
    };
    for (const bucket of this.taskBuckets) {
      if (seconds <= bucket) histogram.buckets.set(bucket, (histogram.buckets.get(bucket) ?? 0) + 1);
    }
    histogram.sum += seconds;
    histogram.count += 1;
    this.histograms.set(key, histogram);
  }

  recordTaskFailure(task: string): void {
    this.inc("aiops_task_failures_total", { task });
  }

  recordDelivery(result: "sent" | "failed" | "skipped", amount = 1): void {
    if (amount > 0) this.inc("aiops_report_delivery_total", { result }, amount);
  }

  setEventQueue(metrics: EventQueueMetric[]): void {
    for (const status of EVENT_QUEUE_STATUSES) {
      this.setGauge("aiops_events_queue_depth", { status }, 0);
      this.setGauge("aiops_events_queue_oldest_age_seconds", { status }, 0);
    }
    for (const row of metrics) {
      this.setGauge("aiops_events_queue_depth", { status: row.status }, row.depth);
      this.setGauge("aiops_events_queue_oldest_age_seconds", { status: row.status }, row.oldestAgeSeconds);
    }
  }

  setDbPool(values: { total: number; idle: number; waiting: number }): void {
    this.setGauge("aiops_db_pool_connections", { state: "total" }, values.total);
    this.setGauge("aiops_db_pool_connections", { state: "idle" }, values.idle);
    this.setGauge("aiops_db_pool_connections", { state: "waiting" }, values.waiting);
  }

  setCalendarCoverageDays(days: number | null): void {
    // -1 はデータ空をalert可能な数値として表す。期限超過と同様に閾値未満として扱える。
    this.setGauge("aiops_calendar_coverage_days", {}, days ?? -1);
  }

  /**
   * 機能ごとの有効/無効を gauge にする（所見 ADV-INT-052 / ADV-INT-007）。
   *
   * 縮退の証跡が監査ログにしか無いと、「有効化されているはずの機能が無効」を監視から
   * 検知できない。無効そのものは異常ではないので、判定はせず事実だけを出す。
   */
  setCapabilities(state: Readonly<Record<string, boolean>>): void {
    for (const [capability, enabled] of Object.entries(state)) {
      this.setGauge("aiops_capability_enabled", { capability }, enabled ? 1 : 0);
    }
  }

  renderPrometheus(): string {
    const lines = [
      "# HELP aiops_events_queue_depth Current events queue depth by status.",
      "# TYPE aiops_events_queue_depth gauge",
      "# HELP aiops_events_queue_oldest_age_seconds Age in seconds of the oldest queued event by status.",
      "# TYPE aiops_events_queue_oldest_age_seconds gauge",
      "# HELP aiops_task_run_duration_seconds Scheduler task run duration.",
      "# TYPE aiops_task_run_duration_seconds histogram",
      "# HELP aiops_task_failures_total Scheduler task failures.",
      "# TYPE aiops_task_failures_total counter",
      "# HELP aiops_report_delivery_total Report delivery outcomes.",
      "# TYPE aiops_report_delivery_total counter",
      "# HELP aiops_capability_enabled 1 when an optional capability is configured and active, 0 when degraded.",
      "# TYPE aiops_capability_enabled gauge",
      "# HELP aiops_db_pool_connections PostgreSQL pool connection counts.",
      "# TYPE aiops_db_pool_connections gauge",
      "# HELP aiops_calendar_coverage_days Days until the last configured Japanese holiday.",
      "# TYPE aiops_calendar_coverage_days gauge",
    ];
    for (const metric of this.gauges.values()) {
      lines.push(`${metric.name}${renderLabels(metric.labels)} ${metric.value}`);
    }
    for (const metric of this.counters.values()) {
      lines.push(`${metric.name}${renderLabels(metric.labels)} ${metric.value}`);
    }
    for (const histogram of this.histograms.values()) {
      for (const [le, value] of histogram.buckets) {
        lines.push(
          `aiops_task_run_duration_seconds_bucket${renderLabels({ ...histogram.labels, le: String(le) })} ${value}`,
        );
      }
      lines.push(
        `aiops_task_run_duration_seconds_bucket${renderLabels({ ...histogram.labels, le: "+Inf" })} ${histogram.count}`,
      );
      lines.push(`aiops_task_run_duration_seconds_sum${renderLabels(histogram.labels)} ${histogram.sum}`);
      lines.push(`aiops_task_run_duration_seconds_count${renderLabels(histogram.labels)} ${histogram.count}`);
    }
    return `${lines.join("\n")}\n`;
  }
}
