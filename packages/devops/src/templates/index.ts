/**
 * packages/devops/src/templates/index.ts
 */
import { renderDevOpsReportShell, buildSubject } from "./reportShell.js";
import {
  renderMemberDailyBody,
  renderLeaderPeriodBody,
  renderManagerPeriodBody,
  type MemberDailyData,
  type LeaderPeriodData,
  type ManagerPeriodData,
} from "./profileReports.js";

export interface DevOpsComposeCommon {
  periodLabel: string;
  generatedAtLabel: string;
  contactLine: string;
  dateJst: string;
}

export function composeMemberDailyReport(
  common: DevOpsComposeCommon,
  data: MemberDailyData,
): { subject: string; html: string } {
  const bodyHtml = renderMemberDailyBody(data);
  const html = renderDevOpsReportShell({
    profileLabel: "メンバー",
    periodLabel: common.periodLabel,
    generatedAtLabel: common.generatedAtLabel,
    contactLine: common.contactLine,
    bodyHtml,
    title: "DevOpsレポート(メンバー日次)",
  });
  return { subject: buildSubject("メンバー日次", common.dateJst), html };
}

export function composeLeaderReport(
  common: DevOpsComposeCommon,
  data: LeaderPeriodData,
  projectId: string,
  frequency: "日次" | "週次",
): { subject: string; html: string } {
  const bodyHtml = renderLeaderPeriodBody(data, projectId);
  const html = renderDevOpsReportShell({
    profileLabel: "リーダー",
    periodLabel: common.periodLabel,
    generatedAtLabel: common.generatedAtLabel,
    contactLine: common.contactLine,
    bodyHtml,
    title: `DevOpsレポート(リーダー${frequency})`,
  });
  return { subject: buildSubject(`リーダー${frequency}`, common.dateJst), html };
}

export function composeManagerReport(
  common: DevOpsComposeCommon,
  data: ManagerPeriodData,
  frequency: "週次" | "月次",
): { subject: string; html: string } {
  const bodyHtml = renderManagerPeriodBody(data);
  const html = renderDevOpsReportShell({
    profileLabel: "マネージャー",
    periodLabel: common.periodLabel,
    generatedAtLabel: common.generatedAtLabel,
    contactLine: common.contactLine,
    bodyHtml,
    title: `DevOpsレポート(マネージャー${frequency})`,
  });
  return { subject: buildSubject(`マネージャー${frequency}`, common.dateJst), html };
}

export * from "./reportShell.js";
export * from "./profileReports.js";
