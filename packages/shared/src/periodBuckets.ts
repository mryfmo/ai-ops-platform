/**
 * packages/shared/src/periodBuckets.ts
 *
 * 根拠: ADR-0007 / PrjOps:REQ-036 / PrjOps:SPEC-INT-062 / DevOps:REQ-031 / SPEC-INT-081.
 * GitHub webhook/snapshot由来の時系列を、週/月/四半期/半年/年の表示期間へ決定的に集計する。
 */
import { isoWeekOf } from "./ids.js";
import { fromJstClock, toJstClock } from "./jst.js";

export type PeriodKind = "week" | "month" | "quarter" | "half" | "year";

export interface PeriodRange {
  start: string;
  end: string;
  label: string;
}

export interface PeriodBucket extends PeriodRange {
  id: string;
}

export type TimeseriesEventKind =
  "issue" | "pull_request" | "milestone" | "projects_v2_item" | "projects_v2_status_update" | "deployment";

export interface TimeseriesEventInput {
  occurredAt: string;
  kind: TimeseriesEventKind;
  projectId?: string | null;
  action?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  state?: string | null;
}

export interface TimeseriesSnapshotInput {
  capturedAt: string;
  sourceType: "issue" | "pull_request" | "milestone" | "project_item" | "project_status" | "deployment";
  projectId?: string | null;
  state?: string | null;
}

export interface TimeseriesBucketAggregate {
  bucket: PeriodBucket;
  opened: number;
  closed: number;
  statusTransitions: number;
  milestoneCompleted: number;
  burndownRemaining: number;
  deployments: number;
}

export interface TimeseriesAggregate {
  period: PeriodKind;
  baseDate: string;
  range: PeriodRange;
  buckets: TimeseriesBucketAggregate[];
  totals: {
    opened: number;
    closed: number;
    statusTransitions: number;
    milestoneCompleted: number;
    deployments: number;
  };
}

export type WeeklyMetricUnavailableReason = "missing_current" | "missing_previous" | "scope_mismatch" | "source_error";

export interface WeeklyMetricObservation {
  projectId: string | null;
  scope: string;
  key: string;
  value: number;
  observedAt: string;
  asOf?: string;
  source: string;
}

export interface WeeklyMetricSelector {
  projectId: string | null;
  scope: string;
  key: string;
  source: string;
}

export type WeeklyMetricValue =
  | { value: number; source: string; as_of: string }
  | { value: null; unavailable_reason: WeeklyMetricUnavailableReason; source: string; as_of: string };

export interface WeeklyMetricComparison {
  period: {
    current: Pick<PeriodRange, "start" | "end">;
    previous: Pick<PeriodRange, "start" | "end">;
  };
  current: WeeklyMetricValue;
  previous: WeeklyMetricValue;
  delta_vs_previous_week: WeeklyMetricValue;
}

export const DORA_WEEKLY_METRIC_CONTRACT = {
  scope: "global",
  source: "code:dora-summary",
  keys: {
    deploymentFrequency: "deployment_frequency_per_week",
    leadTime: "median_lead_time_hours",
    changeFailureRate: "change_failure_rate_pct",
    mttr: "failed_deployment_recovery_time_hours",
  },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseJstDate(dateLike: string): Date {
  const datePart = dateLike.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) throw new Error(`invalid date: ${dateLike}`);
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const roundTrip = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  if (roundTrip !== datePart) throw new Error(`invalid date: ${dateLike}`);
  return fromJstClock(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function addMonthsJst(date: Date, months: number): Date {
  const jst = toJstClock(date);
  return fromJstClock(jst.getUTCFullYear(), jst.getUTCMonth() + months, 1);
}

function toJstIso(date: Date): string {
  const jst = toJstClock(date);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00+09:00`;
}

function ymdJst(date: Date): string {
  return toJstIso(date).slice(0, 10);
}

export function resolvePeriodRange(period: PeriodKind, baseDate: string): PeriodRange {
  const base = parseJstDate(baseDate);
  const jst = toJstClock(base);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();

  if (period === "week") {
    const dayNum = (jst.getUTCDay() + 6) % 7;
    const start = addDays(base, -dayNum);
    const end = addDays(start, 7);
    const { isoYear, isoWeek } = isoWeekOf(ymdJst(start));
    return { start: toJstIso(start), end: toJstIso(end), label: `${isoYear}-W${String(isoWeek).padStart(2, "0")}` };
  }

  const startMonth =
    period === "month"
      ? month
      : period === "quarter"
        ? Math.floor(month / 3) * 3
        : period === "half"
          ? Math.floor(month / 6) * 6
          : 0;
  const length = period === "month" ? 1 : period === "quarter" ? 3 : period === "half" ? 6 : 12;
  const start = fromJstClock(year, startMonth, 1);
  const end = addMonthsJst(start, length);
  const label =
    period === "month"
      ? `${year}-${String(startMonth + 1).padStart(2, "0")}`
      : period === "quarter"
        ? `${year}-Q${Math.floor(startMonth / 3) + 1}`
        : period === "half"
          ? `${year}-H${Math.floor(startMonth / 6) + 1}`
          : String(year);
  return { start: toJstIso(start), end: toJstIso(end), label };
}

export function buildPeriodBuckets(period: PeriodKind, baseDate: string): PeriodBucket[] {
  const range = resolvePeriodRange(period, baseDate);
  const start = parseJstDate(range.start);
  const end = parseJstDate(range.end);
  const stepMonths = period === "week" ? 0 : period === "month" ? 0 : 1;
  const buckets: PeriodBucket[] = [];

  if (period === "week" || period === "month") {
    for (let cur = start; cur < end; cur = addDays(cur, 1)) {
      const next = addDays(cur, 1);
      const id = ymdJst(cur);
      buckets.push({ id, label: id.slice(5), start: toJstIso(cur), end: toJstIso(next) });
    }
    return buckets;
  }

  for (let cur = start; cur < end; cur = addMonthsJst(cur, stepMonths)) {
    const next = addMonthsJst(cur, stepMonths);
    const id = ymdJst(cur).slice(0, 7);
    buckets.push({ id, label: id, start: toJstIso(cur), end: toJstIso(next) });
  }
  return buckets;
}

function inRange(iso: string, start: string, end: string): boolean {
  const t = Date.parse(iso);
  return Date.parse(start) <= t && t < Date.parse(end);
}

function isOpenAction(action: string | null | undefined): boolean {
  return action === "opened" || action === "reopened" || action === "created";
}

function isClosedAction(action: string | null | undefined, state: string | null | undefined): boolean {
  return action === "closed" || action === "completed" || state === "closed" || state === "merged";
}

export function aggregateTimeseries(input: {
  period: PeriodKind;
  baseDate: string;
  events: TimeseriesEventInput[];
  snapshots: TimeseriesSnapshotInput[];
}): TimeseriesAggregate {
  const range = resolvePeriodRange(input.period, input.baseDate);
  const buckets = buildPeriodBuckets(input.period, input.baseDate).map((bucket) => {
    const events = input.events.filter((event) => inRange(event.occurredAt, bucket.start, bucket.end));
    const snapshots = input.snapshots.filter((snapshot) => inRange(snapshot.capturedAt, bucket.start, bucket.end));
    return {
      bucket,
      opened: events.filter((event) => isOpenAction(event.action)).length,
      closed: events.filter((event) => isClosedAction(event.action, event.state)).length,
      statusTransitions: events.filter((event) => event.fromStatus != null || event.toStatus != null).length,
      milestoneCompleted: events.filter(
        (event) => event.kind === "milestone" && isClosedAction(event.action, event.state),
      ).length,
      burndownRemaining: snapshots.filter((snapshot) => snapshot.state !== "closed" && snapshot.state !== "done")
        .length,
      deployments: events.filter((event) => event.kind === "deployment").length,
    };
  });
  return {
    period: input.period,
    baseDate: input.baseDate,
    range,
    buckets,
    totals: {
      opened: buckets.reduce((sum, bucket) => sum + bucket.opened, 0),
      closed: buckets.reduce((sum, bucket) => sum + bucket.closed, 0),
      statusTransitions: buckets.reduce((sum, bucket) => sum + bucket.statusTransitions, 0),
      milestoneCompleted: buckets.reduce((sum, bucket) => sum + bucket.milestoneCompleted, 0),
      deployments: buckets.reduce((sum, bucket) => sum + bucket.deployments, 0),
    },
  };
}

function unavailableWeeklyMetric(
  reason: WeeklyMetricUnavailableReason,
  source: string,
  asOf: string,
): WeeklyMetricValue {
  return { value: null, unavailable_reason: reason, source, as_of: asOf };
}

/** DEC-SPEC-007: JSTの各週[start,end)にある同一project/scope/key/sourceのlast valid finite値だけを比較する。 */
export function compareWeeklyMetric(input: {
  baseDate: string;
  selector: WeeklyMetricSelector;
  observations: WeeklyMetricObservation[];
  sourceError?: boolean;
}): WeeklyMetricComparison {
  const current = resolvePeriodRange("week", input.baseDate);
  const currentStart = parseJstDate(current.start);
  const previous = { start: toJstIso(addDays(currentStart, -7)), end: current.start };

  const valueInRange = (
    start: string,
    end: string,
    missingReason: "missing_current" | "missing_previous",
  ): WeeklyMetricValue => {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    const sameIdentity = input.observations.filter(
      (item) =>
        item.projectId === input.selector.projectId &&
        item.key === input.selector.key &&
        item.source === input.selector.source &&
        startMs <= Date.parse(item.observedAt) &&
        Date.parse(item.observedAt) < endMs,
    );
    const exact = sameIdentity.filter((item) => item.scope === input.selector.scope);
    const rankedValid = exact
      .filter(
        (item) =>
          Number.isFinite(item.value) &&
          Number.isFinite(Date.parse(item.observedAt)) &&
          (item.asOf === undefined || Number.isFinite(Date.parse(item.asOf))),
      )
      .sort(
        (a, b) =>
          Date.parse(b.observedAt) - Date.parse(a.observedAt) ||
          Date.parse(b.asOf ?? b.observedAt) - Date.parse(a.asOf ?? a.observedAt),
      );
    const lastValid = rankedValid[0];
    const topValues = lastValid
      ? new Set(
          rankedValid
            .filter(
              (item) =>
                Date.parse(item.observedAt) === Date.parse(lastValid.observedAt) &&
                Date.parse(item.asOf ?? item.observedAt) === Date.parse(lastValid.asOf ?? lastValid.observedAt),
            )
            .map((item) => item.value),
        )
      : new Set<number>();
    if (topValues.size > 1) {
      return unavailableWeeklyMetric("source_error", input.selector.source, lastValid?.asOf ?? end);
    }
    if (lastValid)
      return { value: lastValid.value, source: lastValid.source, as_of: lastValid.asOf ?? lastValid.observedAt };
    if (input.sourceError || exact.length > 0) {
      return unavailableWeeklyMetric("source_error", input.selector.source, end);
    }
    if (sameIdentity.length > 0) {
      return unavailableWeeklyMetric("scope_mismatch", input.selector.source, end);
    }
    return unavailableWeeklyMetric(missingReason, input.selector.source, end);
  };

  const currentValue = valueInRange(current.start, current.end, "missing_current");
  const previousValue = valueInRange(previous.start, previous.end, "missing_previous");
  let delta: WeeklyMetricValue;
  if ("unavailable_reason" in currentValue) {
    delta = unavailableWeeklyMetric(currentValue.unavailable_reason, currentValue.source, currentValue.as_of);
  } else if ("unavailable_reason" in previousValue) {
    delta = unavailableWeeklyMetric(previousValue.unavailable_reason, previousValue.source, previousValue.as_of);
  } else {
    const difference = currentValue.value - previousValue.value;
    delta = Number.isFinite(difference)
      ? { value: difference, source: input.selector.source, as_of: currentValue.as_of }
      : unavailableWeeklyMetric("source_error", input.selector.source, currentValue.as_of);
  }

  return {
    period: {
      current: { start: current.start, end: current.end },
      previous,
    },
    current: currentValue,
    previous: previousValue,
    delta_vs_previous_week: delta,
  };
}
