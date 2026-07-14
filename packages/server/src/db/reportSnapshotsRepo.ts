/**
 * packages/server/src/db/reportSnapshotsRepo.ts
 *
 * 根拠: DevOps REQ-031 / SPEC-INT-055 / SPEC-INT-081 / AC-031a.
 * report_snapshotsのコード算出metricをexact identityかつhalf-open期間で永続化・取得する。
 */
import { sanitizeSecrets, type PgQueryable, type WeeklyMetricObservation } from "@aiops/shared";

export type ReportSnapshotScope = "user" | "project" | "global";

export interface ReportMetricSnapshotInput {
  periodStart: string;
  periodEnd: string;
  scope: ReportSnapshotScope;
  projectId: string | null;
  source: string;
  metrics: Record<string, number>;
  generatedAt: string;
}

export interface WeeklyMetricReadInput {
  projectId: string | null;
  scope: string;
  keys: string[];
  source: string;
  after: string;
  before: string;
}

const STRICT_ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const SCOPES = new Set<ReportSnapshotScope>(["user", "project", "global"]);

function strictTimestamp(value: string): number | null {
  const match = STRICT_ISO_WITH_OFFSET.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function metricObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    throw new Error("invalid stored report snapshot metrics");
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error("invalid stored report snapshot metrics");
}

function validateMetricSnapshot(input: ReportMetricSnapshotInput): void {
  const start = strictTimestamp(input.periodStart);
  const end = strictTimestamp(input.periodEnd);
  const generatedAt = strictTimestamp(input.generatedAt);
  const keys = Object.keys(input.metrics);
  const projectIdentityValid =
    input.scope === "project"
      ? input.projectId !== null && input.projectId.length > 0 && input.projectId.trim() === input.projectId
      : input.projectId === null;
  if (
    !SCOPES.has(input.scope) ||
    input.source.length === 0 ||
    input.source.trim() !== input.source ||
    keys.length === 0 ||
    keys.some((key) => key.length === 0 || key.trim() !== key) ||
    Object.values(input.metrics).some((value) => !Number.isFinite(value)) ||
    start === null ||
    end === null ||
    generatedAt === null ||
    start >= end ||
    !projectIdentityValid
  ) {
    throw new Error("invalid report snapshot identity or non-finite metrics");
  }
}

function validateWeeklyMetricRead(input: WeeklyMetricReadInput): void {
  const scopeValid = SCOPES.has(input.scope as ReportSnapshotScope);
  const projectIdentityValid =
    input.scope === "project"
      ? input.projectId !== null && input.projectId.length > 0 && input.projectId.trim() === input.projectId
      : input.projectId === null;
  const sourceValid = input.source.length > 0 && input.source.trim() === input.source;
  const keysValid =
    input.keys.length > 0 &&
    input.keys.every((key) => key.length > 0 && key.trim() === key) &&
    new Set(input.keys).size === input.keys.length;
  const after = strictTimestamp(input.after);
  const before = strictTimestamp(input.before);
  if (
    !scopeValid ||
    !projectIdentityValid ||
    !sourceValid ||
    !keysValid ||
    after === null ||
    before === null ||
    after >= before
  ) {
    throw new Error("invalid weekly metric read identity or bounds");
  }
}

export class ReportSnapshotsRepo {
  constructor(private readonly db: PgQueryable) {}

  async recordMetricSnapshot(input: ReportMetricSnapshotInput): Promise<void> {
    validateMetricSnapshot(input);
    const metrics = sanitizeSecrets(JSON.stringify(input.metrics)).sanitized;
    await this.db.query(
      `INSERT INTO report_snapshots (
         period_start, period_end, scope, project_id, source, metrics, generated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [input.periodStart, input.periodEnd, input.scope, input.projectId, input.source, metrics, input.generatedAt],
    );
  }

  async listWeeklyMetricObservations(input: WeeklyMetricReadInput): Promise<WeeklyMetricObservation[]> {
    validateWeeklyMetricRead(input);
    const result = await this.db.query(
      `SELECT project_id, scope, source, metrics, period_start, generated_at
       FROM report_snapshots
       WHERE project_id IS NOT DISTINCT FROM $1
         AND scope = $2
         AND source = $3
         AND period_start >= $4
         AND period_start < $5
       ORDER BY period_start, generated_at`,
      [input.projectId, input.scope, input.source, input.after, input.before],
    );
    return result.rows.flatMap((row) => {
      const metrics = metricObject(row["metrics"]);
      return input.keys
        .filter((key) => Object.hasOwn(metrics, key))
        .map((key) => {
          const rawValue = metrics[key];
          return {
            projectId: row["project_id"] == null ? null : String(row["project_id"]),
            scope: String(row["scope"]),
            key,
            value: typeof rawValue === "number" ? rawValue : Number.NaN,
            source: String(row["source"]),
            observedAt:
              row["period_start"] instanceof Date ? row["period_start"].toISOString() : String(row["period_start"]),
            asOf: row["generated_at"] instanceof Date ? row["generated_at"].toISOString() : String(row["generated_at"]),
          };
        });
    });
  }
}
