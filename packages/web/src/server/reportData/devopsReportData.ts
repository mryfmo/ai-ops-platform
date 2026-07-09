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
  calculateDoraSummary,
  type DoraSummary,
  type DeploymentRecord,
  type IncidentRecord,
} from "@aiops/devops";

interface ProjectChannelRow {
  project_id: string;
}

interface IncidentRow {
  detected_at: string;
  resolved_at: string | null;
  affected_projects: string[];
}

interface DeploymentRow {
  project_id: string;
  created_at: string | Date;
  updated_at: string | Date;
  state: string;
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

async function fetchDeployments(db: PgQueryable): Promise<DeploymentRow[]> {
  const res = await db.query(
    "SELECT project_id, created_at, updated_at, state FROM deployments WHERE env = 'prod'",
    [],
  );
  return res.rows as unknown as DeploymentRow[];
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
  velocity: { issueThroughput: number; prThroughput: number };
  coveragePct: number | null;
  dora: DoraSummary;
  doraByProject: Array<{ projectId: string; dora: DoraSummary }>;
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
  const allDeployments = await fetchDeployments(db);
  const scopedIncidents = allIncidents.filter((i) => (i.affected_projects ?? []).some((pid) => scopedSet.has(pid)));
  const scopedDeployments = allDeployments.filter((deployment) => scopedSet.has(deployment.project_id));

  const burndownInputs: IncidentBurndownInput[] = scopedIncidents.map((i) => ({
    detectedAt: toIsoString(i.detected_at),
    resolvedAt: i.resolved_at === null ? null : toIsoString(i.resolved_at),
  }));
  const doraIncidentInputs: IncidentRecord[] = scopedIncidents.flatMap((incident) =>
    (incident.affected_projects ?? [])
      .filter((projectId) => scopedSet.has(projectId))
      .map((projectId) => ({
        projectId,
        detectedAt: toIsoString(incident.detected_at),
        resolvedAt:
          incident.resolved_at === null ? toIsoString(incident.detected_at) : toIsoString(incident.resolved_at),
      })),
  );
  const doraInputs: DeploymentRecord[] = scopedDeployments.map((deployment) => ({
    projectId: deployment.project_id,
    commitAt: toIsoString(deployment.created_at),
    deployedAt: toIsoString(deployment.updated_at),
    causedFailure: deployment.state === "rolling_back" || deployment.state === "rolled_back",
    reworked: deployment.state === "rolling_back" || deployment.state === "rolled_back",
  }));
  const periodDays = Math.max(1, (Date.parse(periodEnd) - Date.parse(periodStart)) / (24 * 60 * 60 * 1000));

  return {
    totalProjectCount: projectIds.length,
    projectIds,
    totalTicketCount: countTotalIncidentsInPeriod(burndownInputs, periodStart, periodEnd),
    remainingTicketCount: countRemainingIncidents(burndownInputs),
    burndown: computeIncidentBurndown(burndownInputs, periodStart, periodEnd),
    velocity: { issueThroughput: countTotalIncidentsInPeriod(burndownInputs, periodStart, periodEnd), prThroughput: 0 },
    coveragePct: null,
    dora: calculateDoraSummary(doraInputs, doraIncidentInputs, periodDays),
    doraByProject: projectIds.map((projectId) => ({
      projectId,
      dora: calculateDoraSummary(
        doraInputs.filter((deployment) => deployment.projectId === projectId),
        doraIncidentInputs.filter((incident) => incident.projectId === projectId),
        periodDays,
      ),
    })),
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
