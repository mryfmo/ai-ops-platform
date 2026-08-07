/**
 * packages/devops/src/templates/index.ts
 *
 * 根拠: DevOps:SPEC-INT-033 AGT-RPT（DevOps:REQ-020〜023 / DevOps:SPEC-EXT-020〜026）。
 *   DevOps:REQ-020 共通要件: HTML形式で生成し、集計期間・生成時刻をヘッダーに明記する。
 *   DevOps:REQ-021 PRF-M（メンバー日次）/ DevOps:REQ-022 PRF-L（リーダー日次・週次）/
 *   DevOps:REQ-023 PRF-G（マネージャー週次・月次）の件名と本文HTMLを合成する。
 *   数値はプロファイル別データから直接埋め込み、LLMは呼び出さない決定的処理とする
 *   （CLAUDE.md 設計原則2）。
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
