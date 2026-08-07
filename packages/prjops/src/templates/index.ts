/**
 * packages/prjops/src/templates/index.ts
 *
 * 根拠: PrjOps:REQ-010（自己完結型HTML）〜PrjOps:REQ-016（多言語生成。ja/en切り替えは
 *   common.lang の指定のみで全プロファイルが対応する）を満たす完成レポートHTMLを
 *   組み立てるエントリポイント。
 *   同一データから生成したja版とen版で数値・色判定が完全一致することは、
 *   reportTemplates.test.ts の「英語版レポート」テストで検証する。
 *
 * 注: 変更前は上記の検証対象を `AC-016-1` と記載していたが、このIDは PrjOps/DevOps いずれの
 *   spec-ids にも spec-id-catalog.md にも存在しない（PRD 03_PRD.md:109 にのみ定義がある）。
 *   実在しないIDを引くと「検証済みのAC」という誤った証跡になるため、ID参照を外して事実だけを残す。
 *   PRD 側のIDを登録するか否かは仕様側の裁定事項。
 */
import type { Lang } from "@aiops/shared/language.js";
import { renderReportShell, type ReportShellOptions } from "./reportShell.js";
import {
  renderMemberReportBody,
  renderLeaderReportBody,
  renderManagerReportBody,
  renderExecutiveReportBody,
  renderInvestorReportBody,
  type MemberReportData,
  type LeaderReportData,
  type ManagerReportData,
  type ExecutiveReportData,
  type InvestorReportData,
} from "./profileReports.js";

import type { Profile } from "../lib/reportJobStateMachine.js";
export type { Profile };

export interface ComposeCommonOptions {
  reportId: string;
  periodLabel: string;
  generatedAtLabel: string;
  dataSnapshotLabel: string;
  lang: Lang;
  contactLine: string;
}

const SYSTEM_NAME_JA = "PrjOps AI基盤";
const SYSTEM_NAME_EN = "PrjOps AI Hub";

function shellOptionsBase(
  common: ComposeCommonOptions,
  title: string,
  confidential: ReportShellOptions["confidential"],
): Omit<ReportShellOptions, "bodyHtml"> {
  return {
    systemNameJa: SYSTEM_NAME_JA,
    systemNameEn: SYSTEM_NAME_EN,
    reportId: common.reportId,
    periodLabel: common.periodLabel,
    generatedAtLabel: common.generatedAtLabel,
    dataSnapshotLabel: common.dataSnapshotLabel,
    lang: common.lang,
    contactLine: common.contactLine,
    title,
    confidential,
  };
}

export function composeMemberReport(common: ComposeCommonOptions, data: MemberReportData): string {
  const bodyHtml = renderMemberReportBody(data, common.lang);
  return renderReportShell({ ...shellOptionsBase(common, `${SYSTEM_NAME_JA} - PRF-01`, "internal"), bodyHtml });
}

export function composeLeaderReport(common: ComposeCommonOptions, data: LeaderReportData): string {
  const bodyHtml = renderLeaderReportBody(data, common.lang);
  return renderReportShell({ ...shellOptionsBase(common, `${SYSTEM_NAME_JA} - PRF-02`, "internal"), bodyHtml });
}

export function composeManagerReport(common: ComposeCommonOptions, data: ManagerReportData): string {
  const bodyHtml = renderManagerReportBody(data, common.lang);
  return renderReportShell({ ...shellOptionsBase(common, `${SYSTEM_NAME_JA} - PRF-03`, "internal"), bodyHtml });
}

export function composeExecutiveReport(common: ComposeCommonOptions, data: ExecutiveReportData): string {
  const bodyHtml = renderExecutiveReportBody(data, common.lang);
  return renderReportShell({ ...shellOptionsBase(common, `${SYSTEM_NAME_JA} - PRF-04`, "internal"), bodyHtml });
}

export function composeInvestorReport(common: ComposeCommonOptions, data: InvestorReportData): string {
  const bodyHtml = renderInvestorReportBody(data, common.lang);
  return renderReportShell({ ...shellOptionsBase(common, `${SYSTEM_NAME_JA} - PRF-05`, "investor"), bodyHtml });
}

export * from "./reportShell.js";
export * from "./svgCharts.js";
export * from "./profileReports.js";
export * from "./weeklySummaryReport.js";
