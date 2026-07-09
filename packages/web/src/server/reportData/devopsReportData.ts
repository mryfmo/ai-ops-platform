/**
 * packages/web/src/server/reportData/devopsReportData.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。DevOpsドメインのダッシュボード表示データ
 *   （マネージャーサマリ+バーンダウン）を実DB（packages/devops/src/db/schema.sql）から
 *   取得する結線層。
 *
 * 設計:
 *   - @aiops/shared の PgQueryable を注入する（pg.Pool / pg.Client と構造的に互換。
 *     personaResolver.ts / pgCostGuard.ts と同じ既存パターンを踏襲）。テストはネットワーク・
 *     実DBなしでモックPgQueryableを用いて実行できる。
 *   - project_channels テーブル（project_id列を持つ）をプロジェクト一覧のソースとする
 *     （DevOpsドメインには専用のプロジェクトマスタテーブルが無いため）。
 *   - incidents.affected_projects（TEXT[]）でプロジェクトへの紐付けを行う。
 *   - isProjectInScope（devops/lib/reportPermissionFilter.js）を必ずクエリ結果に適用してから
 *     返す（CLAUDE.md設計原則6: 権限フィルタはデータ取得側で強制。表示層での後付けマスキングは禁止）。
 */
import type { PgQueryable } from "@aiops/shared";
import {
  isProjectInScope,
  type Profile,
  type DevOpsVisibilityContext,
  computeIncidentBurndown,
  countTotalIncidentsInPeriod,
  countRemainingIncidents,
  type IncidentBurndownInput,
  type BurndownWeek,
} from "@aiops/devops";

interface ProjectChannelRow {
  project_id: string;
}

interface IncidentRow {
  detected_at: string;
  resolved_at: string | null;
  affected_projects: string[];
}

/** project_channelsから一意なプロジェクトID一覧を取得し、スコープ内のもののみへ絞り込む */
async function scopedProjectIds(db: PgQueryable, profile: Profile, ctx: DevOpsVisibilityContext): Promise<string[]> {
  const res = await db.query("SELECT DISTINCT project_id FROM project_channels", []);
  const allIds = (res.rows as unknown as ProjectChannelRow[]).map((r) => r.project_id);
  return allIds.filter((id) => isProjectInScope(profile, id, ctx));
}

async function fetchIncidents(db: PgQueryable): Promise<IncidentRow[]> {
  const res = await db.query("SELECT detected_at, resolved_at, affected_projects FROM incidents", []);
  return res.rows as unknown as IncidentRow[];
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export interface DevOpsManagerSummaryResult {
  totalProjectCount: number;
  projectIds: string[];
  totalTicketCount: number;
  remainingTicketCount: number;
  burndown: BurndownWeek[];
}

/**
 * PRF-G向けマネージャーサマリ（総プロジェクト数・チケット数・バーンダウン）を算出する。
 * チケットの定義: incidentsテーブルを用いる（総チケット数=期間内の全incidents件数、
 * 残チケット数=resolved_at IS NULLの件数。packages/devops/src/lib/incidentBurndown.ts参照）。
 * incidentsはaffected_projectsにスコープ内プロジェクトIDを1つでも含む場合に対象とする。
 */
export async function buildDevOpsManagerSummary(
  db: PgQueryable,
  profile: Profile,
  ctx: DevOpsVisibilityContext,
  periodStart: string,
  periodEnd: string,
): Promise<DevOpsManagerSummaryResult> {
  const projectIds = await scopedProjectIds(db, profile, ctx);
  const scopedSet = new Set(projectIds);

  const allIncidents = await fetchIncidents(db);
  const scopedIncidents = allIncidents.filter((i) => (i.affected_projects ?? []).some((pid) => scopedSet.has(pid)));

  const burndownInputs: IncidentBurndownInput[] = scopedIncidents.map((i) => ({
    detectedAt: toIsoString(i.detected_at),
    resolvedAt: i.resolved_at === null ? null : toIsoString(i.resolved_at),
  }));

  return {
    totalProjectCount: projectIds.length,
    projectIds,
    totalTicketCount: countTotalIncidentsInPeriod(burndownInputs, periodStart, periodEnd),
    remainingTicketCount: countRemainingIncidents(burndownInputs),
    burndown: computeIncidentBurndown(burndownInputs, periodStart, periodEnd),
  };
}

/** 全ペルソナ共通: スコープ内プロジェクト一覧（数値なし、id/nameのみ）。
 * DevOpsにはプロジェクト表示名マスタが無いため、id自体をnameとして返す。 */
export async function listDevOpsScopedProjectSummaries(
  db: PgQueryable,
  profile: Profile,
  ctx: DevOpsVisibilityContext,
): Promise<Array<{ id: string; name: string }>> {
  const projectIds = await scopedProjectIds(db, profile, ctx);
  return projectIds.map((id) => ({ id, name: id }));
}
