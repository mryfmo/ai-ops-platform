/**
 * packages/devops/src/agents/AGT_RPT.ts
 *
 * 根拠: REQ-020〜024 プロファイル別定期報告 / SPEC-INT-033 / ADR-0014 REQ-042 SPEC-INT-083 AC-042-1
 *   数値はスナップショットから直接埋め込み、LLMによる数値の再生成は行わない（AC-020bの捏造防止）。
 *   配信: プロファイル・担当範囲でデータをフィルタしてからレンダリングする（SPEC-EXT-026）。
 *   配信名簿はAGT-SEC管理の名簿を唯一のソースとし、配信直前に毎回読み直す（REQ-024）。
 *
 * DevOpsのプロファイル別レポート仕様（SPEC-EXT-020〜025）は構造化データの表示が中心で、
 * PrjOps PRF-04のような自由文の「結論」スロットを必須としないため、本エージェントは
 * 数値集計→権限フィルタ→テンプレート合成→配信 の完全に決定的なパイプラインとして実装する
 * （LLMを一切呼び出さない。これによりAGT-RPT自体はオフライン検証環境でも完全にテスト可能）。
 */
import type { GraphClient } from "@aiops/shared/clients/graphClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { isValidId } from "@aiops/shared/ids.js";
import {
  compareWeeklyMetric,
  DORA_WEEKLY_METRIC_CONTRACT,
  resolvePeriodRange,
  type WeeklyMetricObservation,
  type WeeklyMetricValue,
} from "@aiops/shared/periodBuckets.js";
import { calculateDoraSummary, type DeploymentRecord, type IncidentRecord } from "../lib/doraMetrics.js";
import { isActiveRecipient, type RecipientRecord } from "../lib/reportPermissionFilter.js";
import type { CodingTaskActivitySummary } from "../lib/codingTaskActivity.js";
import {
  composeMemberDailyReport,
  composeLeaderReport,
  composeManagerReport,
  selectTopRiskProjects,
  type DevOpsComposeCommon,
} from "../templates/index.js";
import type { MemberDailyData, LeaderPeriodData } from "../templates/profileReports.js";

export interface RptDependencies {
  graphClient: Pick<GraphClient, "sendMail">;
  auditLog: AuditLogWriter;
  traceId: string;
  fromMailbox: string;
  weeklyMetricReader?: {
    listWeeklyMetricObservations(input: {
      projectId: string | null;
      scope: string;
      keys: string[];
      source: string;
      after: string;
      before: string;
    }): Promise<WeeklyMetricObservation[]>;
  };
}

type DoraWeeklyMetricName = keyof typeof DORA_WEEKLY_METRIC_CONTRACT.keys;

export async function resolveWeeklyDoraDeltas(
  baseDate: string,
  deps: RptDependencies,
): Promise<Record<DoraWeeklyMetricName, WeeklyMetricValue>> {
  const { source, scope, keys } = DORA_WEEKLY_METRIC_CONTRACT;
  const projectId = null;
  const current = resolvePeriodRange("week", baseDate);
  const previousStart = new Date(Date.parse(current.start) - 7 * 24 * 60 * 60 * 1000).toISOString();
  let observations: WeeklyMetricObservation[] = [];
  let sourceError = deps.weeklyMetricReader === undefined;
  if (deps.weeklyMetricReader) {
    try {
      observations = await deps.weeklyMetricReader.listWeeklyMetricObservations({
        projectId,
        scope,
        keys: Object.values(keys),
        source,
        after: previousStart,
        before: current.end,
      });
    } catch {
      sourceError = true;
    }
  }
  return Object.fromEntries(
    Object.entries(keys).map(([name, key]) => [
      name,
      compareWeeklyMetric({
        baseDate,
        selector: { projectId, scope, key, source },
        observations,
        sourceError,
      }).delta_vs_previous_week,
    ]),
  ) as Record<DoraWeeklyMetricName, WeeklyMetricValue>;
}

const NUMERIC_USER_ID = /^U-\d{3,}$/;
const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[1-8][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

function isSafeRecipientId(value: string): boolean {
  return isValidId("stakeholder", value) || NUMERIC_USER_ID.test(value) || UUID.test(value);
}

function graphMailStatus(error: unknown): number | null {
  const match =
    error instanceof Error ? /^E-DLV01: sendMail failed with status ([1-5]\d{2})$/.exec(error.message) : null;
  return match ? Number(match[1]) : null;
}

function deliveryErrorDetail(error: unknown): { category: "graph_delivery"; code: "E-DLV01"; status: number | null } {
  return { category: "graph_delivery", code: "E-DLV01", status: graphMailStatus(error) };
}

async function sendAuditedReport(
  input: {
    recipientId: string;
    recipientEmail: string;
    subject: string;
    html: string;
    action: string;
    basis: string;
    detail?: Record<string, unknown>;
  },
  deps: RptDependencies,
): Promise<void> {
  if (!isSafeRecipientId(input.recipientId)) throw new Error("E-DLV03: invalid recipient ID");
  const detail = { recipientId: input.recipientId, ...input.detail };
  try {
    await deps.graphClient.sendMail({
      toEmail: input.recipientEmail,
      subject: input.subject,
      htmlBody: input.html,
      fromMailbox: deps.fromMailbox,
    });
  } catch (error) {
    const classified = deliveryErrorDetail(error);
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-RPT",
      action: `${input.action}_failed`,
      basis: input.basis,
      detail: { ...detail, error: classified },
      at: new Date().toISOString(),
    });
    throw new Error(`E-DLV01: graph_delivery_failed status=${classified.status ?? "unknown"}`);
  }
  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-RPT",
    action: input.action,
    basis: input.basis,
    detail,
    at: new Date().toISOString(),
  });
}

/** REQ-024 AC-024a: 配信直前に名簿を読み直し、非activeな宛先を除外する */
export function resolveActiveRecipients(recipients: RecipientRecord[], candidateUserIds: string[]): string[] {
  return candidateUserIds.filter((id) => isActiveRecipient(recipients, id));
}

/** PRF-M日次レポートの配信（REQ-021） */
export async function deliverMemberDailyReport(
  common: DevOpsComposeCommon,
  data: MemberDailyData,
  recipientId: string,
  recipientEmail: string,
  deps: RptDependencies,
): Promise<void> {
  const { subject, html } = composeMemberDailyReport(common, data);
  await sendAuditedReport(
    {
      recipientId,
      recipientEmail,
      subject,
      html,
      action: "deliver_member_daily",
      basis: "REQ-021",
    },
    deps,
  );
}

/** PRF-L日次/週次レポートの配信（REQ-022） */
export async function deliverLeaderReport(
  common: DevOpsComposeCommon,
  data: LeaderPeriodData,
  projectId: string,
  frequency: "日次" | "週次",
  recipientId: string,
  recipientEmail: string,
  deps: RptDependencies,
): Promise<void> {
  const { subject, html } = composeLeaderReport(common, data, projectId, frequency);
  await sendAuditedReport(
    {
      recipientId,
      recipientEmail,
      subject,
      html,
      action: "deliver_leader",
      basis: "REQ-022",
      detail: { projectId, frequency },
    },
    deps,
  );
}

/** PRF-G週次/月次レポートの配信（REQ-023, AC-023a/b: 全50プロジェクト横断・DORA指標表示） */
export async function buildAndDeliverManagerReport(
  common: DevOpsComposeCommon,
  deployments: DeploymentRecord[],
  incidents: IncidentRecord[],
  periodDays: number,
  projectRiskInputs: Array<{ projectId: string; changeFailureRatePct: number; openSev2Count: number }>,
  sev1And2: Array<{ id: string; projectId: string; title: string; severity: string }>,
  expiredApprovalCount: number,
  frequency: "週次" | "月次",
  recipientId: string,
  recipientEmail: string,
  deps: RptDependencies,
  permissionAudit?: { totalGrants: number; revokedThisMonth: number; externalAccountCount: number },
  /** ADR-0006 4b: AIコーディングエージェント稼働状況。省略時はレポートに表示しない（後方互換） */
  codingTaskActivity?: CodingTaskActivitySummary,
): Promise<void> {
  const doraSummary = calculateDoraSummary(deployments, incidents, periodDays);
  const deltaVsPrevWeek = await resolveWeeklyDoraDeltas(common.dateJst, deps);

  const { subject, html } = composeManagerReport(
    common,
    {
      dora: {
        deploymentFrequencyPerWeek: doraSummary.deploymentFrequencyPerWeek,
        medianLeadTimeHours: doraSummary.medianLeadTimeHours,
        changeFailureRatePct: doraSummary.changeFailureRatePct,
        failedDeploymentRecoveryTimeHours: doraSummary.failedDeploymentRecoveryTimeHours,
        deltaVsPrevWeek,
      },
      sev1And2,
      topRiskProjects: selectTopRiskProjects(projectRiskInputs),
      expiredApprovalCount,
      permissionAudit,
      codingTaskActivity,
    },
    frequency,
  );

  await sendAuditedReport(
    {
      recipientId,
      recipientEmail,
      subject,
      html,
      action: "deliver_manager",
      basis: "REQ-023 AC-023a/b",
      detail: { frequency, projectCount: projectRiskInputs.length },
    },
    deps,
  );
}
