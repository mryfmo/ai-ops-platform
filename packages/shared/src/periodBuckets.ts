/**
 * packages/shared/src/periodBuckets.ts
 *
 * 根拠: ADR-0007 / PrjOps REQ-036 / SPEC-INT-062 / DevOps REQ-031 / SPEC-INT-081.
 * GitHub webhook/snapshot由来の時系列を、週/月/四半期/半年/年の表示期間へ決定的に集計する。
 */
import { isoWeekOf } from "./ids.js";

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

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parseJstDate(dateLike: string): Date {
  const datePart = dateLike.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!) - JST_OFFSET_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function addMonthsJst(date: Date, months: number): Date {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + months, 1) - JST_OFFSET_MS);
}

function toJstIso(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
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
  const jst = new Date(base.getTime() + JST_OFFSET_MS);
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
  const start = new Date(Date.UTC(year, startMonth, 1) - JST_OFFSET_MS);
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
