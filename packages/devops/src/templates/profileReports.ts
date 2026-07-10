/**
 * packages/devops/src/templates/profileReports.ts
 *
 * 根拠: SPEC-EXT-021 PRF-M日次 / SPEC-EXT-022 PRF-L日次 / SPEC-EXT-023 PRF-L週次 /
 *       SPEC-EXT-024 PRF-G週次 / SPEC-EXT-025 PRF-G月次
 * 数値はすべて data-src 属性付きで埋め込み、AGT-RPT検証（REQ-020 AC-020b）の対象とする。
 */
import { escapeHtml } from "./reportShell.js";
import type { CodingTaskActivitySummary } from "../lib/codingTaskActivity.js";

function numericSpan(path: string, field: string, displayValue: string | number): string {
  return `<span data-src="${escapeHtml(path)}#${escapeHtml(field)}">${escapeHtml(String(displayValue))}</span>`;
}

const NONE_TODAY = "本日はありません";

// ---------- PRF-M 日次 ----------
export interface MemberDailyData {
  openPrs: Array<{ number: number; title: string; ciState: string; lastUpdated: string }>;
  reviewRequests: Array<{ prNumber: number; title: string; repo: string }>;
  unhandledAlerts: Array<{ id: string; summary: string; severity: string }>;
}

export function renderMemberDailyBody(data: MemberDailyData): string {
  const prRows = data.openPrs.length
    ? data.openPrs
        .map(
          (p) =>
            `<tr><td>#${p.number}</td><td>${escapeHtml(p.title)}</td><td>${escapeHtml(p.ciState)}</td><td>${numericSpan(
              `prs/${p.number}`,
              "last_updated",
              p.lastUpdated,
            )}</td></tr>`,
        )
        .join("\n")
    : `<tr><td colspan="4">${NONE_TODAY}</td></tr>`;

  const reviewRows = data.reviewRequests.length
    ? data.reviewRequests.map((r) => `<li>${escapeHtml(r.repo)} #${r.prNumber}: ${escapeHtml(r.title)}</li>`).join("\n")
    : `<li>${NONE_TODAY}</li>`;

  const alertRows = data.unhandledAlerts.length
    ? data.unhandledAlerts
        .map((a) => `<li>[${escapeHtml(a.severity)}] ${escapeHtml(a.id)}: ${escapeHtml(a.summary)}</li>`)
        .join("\n")
    : `<li>${NONE_TODAY}</li>`;

  return `
<section>
  <h2>本日のあなたのオープンPRとCI状態</h2>
  <table><thead><tr><th>PR</th><th>タイトル</th><th>CI状態</th><th>最終更新</th></tr></thead><tbody>${prRows}</tbody></table>
</section>
<section>
  <h2>あなた宛レビュー依頼</h2>
  <ul>${reviewRows}</ul>
</section>
<section>
  <h2>あなたが当番の未対応アラート</h2>
  <ul>${alertRows}</ul>
</section>`;
}

// ---------- PRF-L 日次/週次 ----------
export interface LeaderPeriodData {
  ciSuccessRatePct: number;
  failedWorkflows: string[];
  deploymentsByEnv: Record<"dev" | "staging" | "prod", number>;
  openIncidentsBySeverity: Record<"sev1" | "sev2" | "sev3" | "sev4", number>;
  pendingApprovals: Array<{ id: string; kind: "deploy" | "grant"; summary: string }>;
  staleTaskCounts: Array<{ taskType: string; count: number }>;
  weeklyTrend?: { ciSuccessRateDeltaPct: number; deploymentCountDelta: number };
}

export function renderLeaderPeriodBody(data: LeaderPeriodData, projectId: string): string {
  const failedList = data.failedWorkflows.length ? data.failedWorkflows.map(escapeHtml).join(", ") : "なし";
  const approvalRows = data.pendingApprovals.length
    ? data.pendingApprovals.map((a) => `<li>[${a.kind}] ${escapeHtml(a.id)}: ${escapeHtml(a.summary)}</li>`).join("\n")
    : `<li>${NONE_TODAY}</li>`;
  const staleRows = data.staleTaskCounts.length
    ? data.staleTaskCounts
        .map((s) => `<li>${escapeHtml(s.taskType)}: ${numericSpan("stale", s.taskType, s.count)}件</li>`)
        .join("\n")
    : `<li>${NONE_TODAY}</li>`;

  const trendHtml = data.weeklyTrend
    ? `<section><h2>週次トレンド</h2><p>CI成功率 前週比: ${numericSpan(
        `projects/${projectId}`,
        "ci_success_rate_delta",
        `${data.weeklyTrend.ciSuccessRateDeltaPct >= 0 ? "+" : ""}${data.weeklyTrend.ciSuccessRateDeltaPct}pt`,
      )} / デプロイ回数 前週比: ${numericSpan(
        `projects/${projectId}`,
        "deployment_count_delta",
        `${data.weeklyTrend.deploymentCountDelta >= 0 ? "+" : ""}${data.weeklyTrend.deploymentCountDelta}`,
      )}</p></section>`
    : "";

  return `
<section>
  <h2>プロジェクトCIサマリ</h2>
  <p>成功率: ${numericSpan(`projects/${projectId}`, "ci_success_rate_pct", `${data.ciSuccessRatePct}%`)} / 失敗ワークフロー: ${failedList}</p>
</section>
<section>
  <h2>直近デプロイ実績（環境別）</h2>
  <p>dev: ${numericSpan(`projects/${projectId}`, "deploy_count_dev", data.deploymentsByEnv.dev)} /
     staging: ${numericSpan(`projects/${projectId}`, "deploy_count_staging", data.deploymentsByEnv.staging)} /
     prod: ${numericSpan(`projects/${projectId}`, "deploy_count_prod", data.deploymentsByEnv.prod)}</p>
</section>
<section>
  <h2>オープンインシデント</h2>
  <p>Sev1: ${numericSpan(`projects/${projectId}`, "open_sev1", data.openIncidentsBySeverity.sev1)} /
     Sev2: ${numericSpan(`projects/${projectId}`, "open_sev2", data.openIncidentsBySeverity.sev2)} /
     Sev3: ${numericSpan(`projects/${projectId}`, "open_sev3", data.openIncidentsBySeverity.sev3)} /
     Sev4: ${numericSpan(`projects/${projectId}`, "open_sev4", data.openIncidentsBySeverity.sev4)}</p>
</section>
<section>
  <h2>あなたの承認待ち</h2>
  <ul>${approvalRows}</ul>
</section>
<section>
  <h2>滞留状況（タスク種別別。個人名は表示しません）</h2>
  <ul>${staleRows}</ul>
</section>
${trendHtml}`;
}

// ---------- PRF-G 週次/月次 ----------
export interface DoraDisplay {
  deploymentFrequencyPerWeek: number | null;
  medianLeadTimeHours: number | null;
  changeFailureRatePct: number | null;
  failedDeploymentRecoveryTimeHours: number | null;
  deltaVsPrevWeek: {
    deploymentFrequency: number;
    leadTime: number;
    changeFailureRate: number;
    mttr: number;
  };
}

export interface ManagerPeriodData {
  dora: DoraDisplay;
  sev1And2: Array<{ id: string; projectId: string; title: string; severity: string }>;
  topRiskProjects: Array<{ projectId: string; changeFailureRatePct: number; openSev2Count: number }>;
  expiredApprovalCount: number;
  permissionAudit?: { totalGrants: number; revokedThisMonth: number; externalAccountCount: number };
  /**
   * ADR-0006 4b: AIコーディングエージェント稼働状況（coding_tasks集計）。未指定時は本セクション自体を
   * 表示しない（後方互換。既存呼び出し元・既存テストへの影響なし）。
   */
  codingTaskActivity?: CodingTaskActivitySummary;
}

/** SPEC-EXT-024(3): 要注意プロジェクトTop5の選定基準は「変更失敗率降順、同率はオープンSev2件数降順」で固定 */
export function selectTopRiskProjects(
  projects: Array<{ projectId: string; changeFailureRatePct: number; openSev2Count: number }>,
  topN = 5,
): Array<{ projectId: string; changeFailureRatePct: number; openSev2Count: number }> {
  return [...projects]
    .sort((a, b) => {
      if (b.changeFailureRatePct !== a.changeFailureRatePct) return b.changeFailureRatePct - a.changeFailureRatePct;
      return b.openSev2Count - a.openSev2Count;
    })
    .slice(0, topN);
}

export function renderManagerPeriodBody(data: ManagerPeriodData): string {
  const metricCell = (path: string, metric: string, value: number | null | undefined, suffix = "") =>
    value === null || value === undefined ? "未取得" : numericSpan(path, metric, `${value.toFixed(1)}${suffix}`);
  const sevRows = data.sev1And2.length
    ? data.sev1And2
        .map(
          (s) =>
            `<li>[${escapeHtml(s.severity)}] ${escapeHtml(s.projectId)} ${escapeHtml(s.id)}: ${escapeHtml(s.title)}</li>`,
        )
        .join("\n")
    : `<li>${NONE_TODAY}</li>`;

  const topRiskRows = data.topRiskProjects
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(p.projectId)}</td><td>${numericSpan(
          `projects/${p.projectId}`,
          "change_failure_rate_pct",
          `${p.changeFailureRatePct}%`,
        )}</td><td>${numericSpan(`projects/${p.projectId}`, "open_sev2_count", p.openSev2Count)}</td></tr>`,
    )
    .join("\n");

  const auditHtml = data.permissionAudit
    ? `<section><h2>権限棚卸しサマリ</h2><p>総権限数: ${numericSpan(
        "portfolio",
        "total_grants",
        data.permissionAudit.totalGrants,
      )} / 当月失効数: ${numericSpan("portfolio", "revoked_this_month", data.permissionAudit.revokedThisMonth)} / 外部企業アカウント数: ${numericSpan(
        "portfolio",
        "external_account_count",
        data.permissionAudit.externalAccountCount,
      )}</p></section>`
    : "";

  // ADR-0006 4b: coding_tasks集計が渡された場合のみ簡潔な表示行を追加する（無ければ何も表示しない後方互換）
  const codingTaskActivityHtml = data.codingTaskActivity
    ? `<section><h2>AIコーディングエージェント稼働状況</h2><p>総タスク数: ${numericSpan(
        "portfolio",
        "coding_task_total_count",
        data.codingTaskActivity.totalCount,
      )} / PR作成: ${numericSpan(
        "portfolio",
        "coding_task_pr_created_count",
        data.codingTaskActivity.countsByStatus.pr_created,
      )} / 完了成功率: ${
        data.codingTaskActivity.completionSuccessRatePct === null
          ? "データなし"
          : numericSpan(
              "portfolio",
              "coding_task_completion_success_rate_pct",
              `${data.codingTaskActivity.completionSuccessRatePct.toFixed(1)}%`,
            )
      }</p></section>`
    : "";

  return `
<section>
  <h2>DORA 5指標（全プロジェクト横断）</h2>
  <table>
    <thead><tr><th>指標</th><th>今週値</th><th>前週比</th></tr></thead>
    <tbody>
      <tr><td>デプロイ頻度(週)</td><td>${metricCell("portfolio", "deploy_freq", data.dora.deploymentFrequencyPerWeek)}</td><td>${
        data.dora.deltaVsPrevWeek.deploymentFrequency
      }</td></tr>
      <tr><td>変更リードタイム(h)</td><td>${metricCell("portfolio", "lead_time", data.dora.medianLeadTimeHours)}</td><td>${
        data.dora.deltaVsPrevWeek.leadTime
      }</td></tr>
      <tr><td>変更失敗率(%)</td><td>${metricCell("portfolio", "change_failure_rate", data.dora.changeFailureRatePct, "%")}</td><td>${
        data.dora.deltaVsPrevWeek.changeFailureRate
      }</td></tr>
      <tr><td>Failed deployment recovery time(h)</td><td>${metricCell("portfolio", "failed_deployment_recovery_time", data.dora.failedDeploymentRecoveryTimeHours)}</td><td>${
        data.dora.deltaVsPrevWeek.mttr
      }</td></tr>
    </tbody>
  </table>
</section>
<section>
  <h2>Sev1/Sev2一覧</h2>
  <ul>${sevRows}</ul>
</section>
<section>
  <h2>要注意プロジェクトTop5</h2>
  <table><thead><tr><th>#</th><th>プロジェクト</th><th>変更失敗率</th><th>オープンSev2</th></tr></thead><tbody>${topRiskRows}</tbody></table>
</section>
<section>
  <h2>承認滞留</h2>
  <p>期限切れになった承認要求件数: ${numericSpan("portfolio", "expired_approval_count", data.expiredApprovalCount)}</p>
</section>
${auditHtml}
${codingTaskActivityHtml}`;
}
