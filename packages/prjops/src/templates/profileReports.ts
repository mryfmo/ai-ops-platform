/**
 * packages/prjops/src/templates/profileReports.ts
 *
 * 根拠: PrjOps:REQ-011 / PrjOps:SPEC-EXT-021 プロファイル別レイアウト（DOC-03 §4.5が正）。
 * PrjOps:REQ-011のうち、PRF-01本人のアクション期限順・参加プロジェクト色表示を担当する。
 * 月曜08:00起動、受信者別データ取得、AGT-07検証・配信への本番結線は本モジュールの責務外。
 * 各関数はレポート本文(bodyHtml)のみを返す。ヘッダー/フッターはreportShell.tsが担当する。
 * 数値はすべて numericSpan() で data-src 属性を付与し、AGT-07の数値一致検証（PrjOps:SPEC-INT-051(a)）を
 * 成立させる。文章スロット（結論・トピック要約等）はLLM生成文字列を受け取るが、本モジュール自体は
 * 数値を一切生成しない（DOC-05 PrjOps:SPEC-INT-031の設計原則: 数値はコード算出、文章のみLLM）。
 */
import type { Lang } from "@aiops/shared/language.js";
import { statusBadge, numericSpan, escapeHtml } from "./reportShell.js";
import { renderDonutChartSvg, renderColorHeatmapTable, type ColorDistribution } from "./svgCharts.js";
import type { StatusColor } from "../lib/statusJudge.js";

const T = {
  yourActions: { ja: "あなたのアクション", en: "Your Actions" },
  yourProjects: { ja: "所属プロジェクトの状態", en: "Your Projects" },
  none: { ja: "本日はありません", en: "None today" },
  projectSummary: { ja: "プロジェクトサマリ", en: "Project Summary" },
  issueActionDetail: { ja: "課題・アクション詳細", en: "Issue / Action Detail" },
  heatmap: { ja: "色分布ヒートマップ（直近8週）", en: "Color Heatmap (last 8 weeks)" },
  redYellowList: { ja: "Red/Yellow プロジェクト一覧", en: "Red/Yellow Projects" },
  crossIssues: { ja: "横断課題・エスカレーション履歴", en: "Cross-Project Issues / Escalations" },
  changedThisWeek: { ja: "今週の変化", en: "Changed This Week" },
  conclusion: { ja: "結論", en: "Conclusion" },
  topTopics: { ja: "重要トピック（上位5件）", en: "Top Topics" },
  monthDiff: { ja: "前月差分", en: "Month-over-Month" },
  cover: { ja: "表紙", en: "Cover" },
  portfolioSummary: { ja: "ポートフォリオサマリ", en: "Portfolio Summary" },
  perProjectPages: { ja: "出資対象プロジェクト", en: "Invested Projects" },
  reportedNo: { ja: "未報告", en: "Not reported" },
  prevValueLabel: { ja: "(前回値)", en: "(previous value)" },
};

function tr(entry: { ja: string; en: string }, lang: Lang): string {
  return entry[lang];
}

// ---------- PRF-01 メンバー ----------
export interface MemberActionRow {
  id: string;
  content: string;
  due: string;
  status: "open" | "done";
  overdue: boolean;
}
export interface MemberProjectRow {
  id: string;
  name: string;
  color: StatusColor;
}
export interface MemberReportData {
  actions: MemberActionRow[];
  projects: MemberProjectRow[];
}

export function renderMemberReportBody(data: MemberReportData, lang: Lang): string {
  const actionRows = data.actions.length
    ? data.actions
        .sort((a, b) => a.due.localeCompare(b.due))
        .map(
          (a) =>
            `<tr class="${a.overdue ? "overdue" : ""}"><td>${escapeHtml(a.id)}</td><td>${escapeHtml(a.content)}</td><td>${numericSpan(
              `actions/${a.id}`,
              "due",
              a.due,
            )}</td><td>${escapeHtml(a.status)}</td></tr>`,
        )
        .join("\n")
    : `<tr><td colspan="4">${tr(T.none, lang)}</td></tr>`;

  const projectRows = data.projects
    .map((p) => `<li>${escapeHtml(p.name)} (${escapeHtml(p.id)}) ${statusBadge(p.color, lang)}</li>`)
    .join("\n");

  return `
<section>
  <h2>${tr(T.yourActions, lang)}</h2>
  <table>
    <thead><tr><th>ID</th><th>${lang === "ja" ? "内容" : "Content"}</th><th>${lang === "ja" ? "期限" : "Due"}</th><th>${
      lang === "ja" ? "状態" : "Status"
    }</th></tr></thead>
    <tbody>${actionRows}</tbody>
  </table>
</section>
<section>
  <h2>${tr(T.yourProjects, lang)}</h2>
  <ul>${projectRows}</ul>
</section>`;
}

// ---------- PRF-02 リーダー (PrjOps:REQ-012) ----------
export interface LeaderProjectRow {
  id: string;
  name: string;
  machineColor: StatusColor;
  selfColor: StatusColor;
  progressPct: number;
  planLinePct: number;
  reported: boolean;
  previousProgressPct?: number;
}
export interface LeaderIssueActionRow {
  id: string;
  type: "issue" | "action";
  title: string;
  status: string;
  severity?: string;
  due?: string;
}
export interface LeaderReportData {
  projects: LeaderProjectRow[];
  issuesAndActions: LeaderIssueActionRow[];
}

export function renderLeaderReportBody(data: LeaderReportData, lang: Lang): string {
  const projectRows = data.projects
    .map((p) => {
      const diverges = p.machineColor !== p.selfColor;
      const progressDisplay = p.reported
        ? numericSpan(`projects/${p.id}`, "progress_pct", `${p.progressPct}%`)
        : `${numericSpan(`projects/${p.id}`, "progress_pct_prev", `${p.previousProgressPct ?? "-"}%`)} ${tr(T.prevValueLabel, lang)}`;
      return `<tr>
        <td>${escapeHtml(p.id)} ${escapeHtml(p.name)}${p.reported ? "" : ` <em>(${tr(T.reportedNo, lang)})</em>`}</td>
        <td>${statusBadge(p.machineColor, lang)}${diverges ? ` / ${lang === "ja" ? "自己申告" : "self"}: ${statusBadge(p.selfColor, lang)}` : ""}</td>
        <td>${progressDisplay}</td>
        <td>${numericSpan(`projects/${p.id}`, "plan_line_pct", `${p.planLinePct.toFixed(1)}%`)}</td>
      </tr>`;
    })
    .join("\n");

  const itemRows = data.issuesAndActions
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.id)}</td><td>${i.type}</td><td>${escapeHtml(i.title)}</td><td>${escapeHtml(i.status)}</td><td>${escapeHtml(
          i.severity ?? i.due ?? "",
        )}</td></tr>`,
    )
    .join("\n");

  return `
<section>
  <h2>${tr(T.projectSummary, lang)}</h2>
  <table>
    <thead><tr><th>${lang === "ja" ? "プロジェクト" : "Project"}</th><th>${
      lang === "ja" ? "色（機械判定/自己申告）" : "Color (machine/self)"
    }</th><th>${lang === "ja" ? "進捗率" : "Progress"}</th><th>${lang === "ja" ? "計画線" : "Plan Line"}</th></tr></thead>
    <tbody>${projectRows}</tbody>
  </table>
</section>
<section>
  <h2>${tr(T.issueActionDetail, lang)}</h2>
  <table>
    <thead><tr><th>ID</th><th>${lang === "ja" ? "種別" : "Type"}</th><th>${lang === "ja" ? "件名" : "Title"}</th><th>${
      lang === "ja" ? "状態" : "Status"
    }</th><th>${lang === "ja" ? "重要度/期限" : "Severity/Due"}</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
</section>`;
}

// ---------- PRF-03 マネージャー (REQ-013) ----------
export interface ManagerReportData {
  heatmapRows: Array<{ projectId: string; projectName: string; weeklyColors: Array<StatusColor | "unknown"> }>;
  weekLabels: string[];
  redYellowProjects: Array<{ id: string; name: string; color: StatusColor; summaryLines: string[] }>;
  crossIssues: Array<{ id: string; title: string; projectIds: string[] }>;
  escalationHistory: Array<{ date: string; description: string }>;
  changedThisWeekProjectIds: string[];
}

export function renderManagerReportBody(data: ManagerReportData, lang: Lang): string {
  const changedNote = data.changedThisWeekProjectIds.length
    ? `<p><strong>${tr(T.changedThisWeek, lang)}:</strong> ${data.changedThisWeekProjectIds.map(escapeHtml).join(", ")}</p>`
    : "";

  const redYellowRows = data.redYellowProjects
    .sort((a, b) => (a.color === b.color ? 0 : a.color === "red" ? -1 : 1))
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.id)} ${escapeHtml(p.name)}</td><td>${statusBadge(p.color, lang)}</td><td>${p.summaryLines
          .map(escapeHtml)
          .join("<br>")}</td></tr>`,
    )
    .join("\n");

  const crossIssueRows = data.crossIssues
    .map((c) => `<li>${escapeHtml(c.id)}: ${escapeHtml(c.title)} (${c.projectIds.map(escapeHtml).join(", ")})</li>`)
    .join("\n");

  const escalationRows = data.escalationHistory
    .map((e) => `<li>${escapeHtml(e.date)}: ${escapeHtml(e.description)}</li>`)
    .join("\n");

  return `
<section>
  <h2>${tr(T.heatmap, lang)}</h2>
  ${changedNote}
  ${renderColorHeatmapTable(data.heatmapRows, data.weekLabels)}
</section>
<section>
  <h2>${tr(T.redYellowList, lang)}</h2>
  <table><tbody>${redYellowRows}</tbody></table>
</section>
<section>
  <h2>${tr(T.crossIssues, lang)}</h2>
  <ul>${crossIssueRows}</ul>
  <ul>${escalationRows}</ul>
</section>`;
}

// ---------- PRF-04 経営陣 (REQ-014) ----------
export interface ExecutiveReportData {
  conclusionLines: [string, string, string]; // LLM生成の要約文（数値を含まない）
  colorDistribution: ColorDistribution;
  topTopics: Array<{ title: string; lines: [string, string] }>; // 最大5件
  monthOverMonthDiffText: string;
}

export function renderExecutiveReportBody(data: ExecutiveReportData, lang: Lang): string {
  const conclusion = data.conclusionLines.map((l) => `<p>${escapeHtml(l)}</p>`).join("\n");
  const topics = data.topTopics
    .slice(0, 5)
    .map((t) => `<div><strong>${escapeHtml(t.title)}</strong><p>${t.lines.map(escapeHtml).join("<br>")}</p></div>`)
    .join("\n");
  const total = data.colorDistribution.green + data.colorDistribution.yellow + data.colorDistribution.red;

  return `
<section>
  <h2>${tr(T.conclusion, lang)}</h2>
  ${conclusion}
</section>
<section>
  <h2>${lang === "ja" ? "色分布" : "Color Distribution"}</h2>
  ${renderDonutChartSvg(data.colorDistribution)}
  <p>
    ${statusBadge("green", lang)} ${numericSpan("portfolio", "color_green_count", data.colorDistribution.green)} /
    ${statusBadge("yellow", lang)} ${numericSpan("portfolio", "color_yellow_count", data.colorDistribution.yellow)} /
    ${statusBadge("red", lang)} ${numericSpan("portfolio", "color_red_count", data.colorDistribution.red)}
    (${lang === "ja" ? "全" : "total"} ${numericSpan("portfolio", "color_total_count", total)})
  </p>
</section>
<section>
  <h2>${tr(T.topTopics, lang)}</h2>
  ${topics}
</section>
<section>
  <h2>${tr(T.monthDiff, lang)}</h2>
  <p>${escapeHtml(data.monthOverMonthDiffText)}</p>
</section>`;
}

// ---------- PRF-05 投資元 (PrjOps:REQ-015) ----------
export interface InvestorProjectPage {
  id: string;
  name: string;
  milestoneStatus: string;
  color: StatusColor;
  nextQuarterOutlook: string;
}
export interface InvestorReportData {
  coverPeriodLabel: string;
  portfolioSummaryLines: string[];
  projectPages: InvestorProjectPage[];
}

export function renderInvestorReportBody(data: InvestorReportData, lang: Lang): string {
  const summary = data.portfolioSummaryLines.map((l) => `<p>${escapeHtml(l)}</p>`).join("\n");
  const pages = data.projectPages
    .map(
      (p) => `<div style="page-break-after:always;border-top:1px solid #e0e0e0;padding-top:12px;">
        <h3>${escapeHtml(p.name)} (${escapeHtml(p.id)}) ${statusBadge(p.color, lang)}</h3>
        <p>${lang === "ja" ? "マイルストーン達成状況" : "Milestone Status"}: ${escapeHtml(p.milestoneStatus)}</p>
        <p>${lang === "ja" ? "次四半期の見通し" : "Next Quarter Outlook"}: ${escapeHtml(p.nextQuarterOutlook)}</p>
      </div>`,
    )
    .join("\n");

  return `
<section>
  <h2>${tr(T.cover, lang)}</h2>
  <p>${escapeHtml(data.coverPeriodLabel)}</p>
</section>
<section>
  <h2>${tr(T.portfolioSummary, lang)}</h2>
  ${summary}
</section>
<section>
  <h2>${tr(T.perProjectPages, lang)}</h2>
  ${pages}
</section>`;
}
