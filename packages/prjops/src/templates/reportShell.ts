/**
 * packages/prjops/src/templates/reportShell.ts
 *
 * 根拠: PrjOps:REQ-010（共通要件）/ PrjOps:SPEC-EXT-020（共通仕様）
 *   - 自己完結型HTML（外部CSS/JS参照なし、1ファイル）。全レポートに生成日時、対象期間、
 *     レポートID、データ取得時点を明記。
 *   - 色: Green=#2e7d32, Yellow=#f9a825, Red=#c62828。色だけに依存せず文字ラベル併記。
 *   - フッター: 問い合わせ先、機密表示（PRF-05向けは "Confidential — for investor use only"）。
 *   - AC-010-1: ネットワーク遮断環境のブラウザで崩れなく表示される（インラインCSSのみで実装）。
 *   - AC-010-2: 1ファイルのサイズは2MB以下。
 *
 * data-src属性: `data-src="{path}#{field}"` を数値要素に付与し、AGT-07（PrjOps:SPEC-INT-051(a)）が
 * 正本データとの数値一致を機械検証できるようにする。
 */
import type { Lang } from "@aiops/shared/language.js";
import type { StatusColor } from "../lib/statusJudge.js";

export const STATUS_COLOR_HEX: Record<StatusColor, string> = {
  green: "#2e7d32",
  yellow: "#f9a825",
  red: "#c62828",
};

const STATUS_LABEL: Record<StatusColor, { ja: string; en: string }> = {
  green: { ja: "順調", en: "Green" },
  yellow: { ja: "注意", en: "Yellow" },
  red: { ja: "危険", en: "Red" },
};

/** XSS/レイアウト崩れ対策のための最低限のHTMLエスケープ（外部由来の自由文がテンプレートに埋め込まれるため必須） */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 色ラベル（色だけに依存しない文字表記併記。PrjOps:SPEC-EXT-020） */
export function statusBadge(color: StatusColor, lang: Lang): string {
  const hex = STATUS_COLOR_HEX[color];
  const label = STATUS_LABEL[color][lang];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${hex};color:#ffffff;font-weight:bold;font-size:12px;">${escapeHtml(
    label,
  )}</span>`;
}

/** 数値をdata-src属性付きで埋め込む（PrjOps:SPEC-INT-051(a)の検証対象） */
export function numericSpan(path: string, field: string, displayValue: string | number): string {
  return `<span data-src="${escapeHtml(path)}#${escapeHtml(field)}">${escapeHtml(String(displayValue))}</span>`;
}

export interface ReportShellOptions {
  systemNameJa: string;
  systemNameEn: string;
  reportId: string;
  periodLabel: string; // 例: "2026-06-30 〜 2026-07-06"
  generatedAtLabel: string; // 例: "2026-07-06 07:00 JST"
  dataSnapshotLabel: string; // データ取得時点
  lang: Lang;
  confidential?: "investor" | "internal" | "none";
  contactLine: string;
  bodyHtml: string; // 各プロファイルのセクション本体
  title: string;
}

const CONFIDENTIAL_LABEL: Record<"investor" | "internal", { ja: string; en: string }> = {
  investor: { ja: "機密 — 投資家限り", en: "Confidential — for investor use only" },
  internal: { ja: "社外秘", en: "Internal Use Only" },
};

/** PrjOps:REQ-010/PrjOps:SPEC-EXT-020: 自己完結HTMLシェル（インラインCSSのみ、外部参照なし） */
export function renderReportShell(opts: ReportShellOptions): string {
  const systemName = opts.lang === "ja" ? opts.systemNameJa : opts.systemNameEn;
  const confidentialHtml =
    opts.confidential && opts.confidential !== "none"
      ? `<p style="color:#616161;font-size:11px;margin:4px 0 0;">${escapeHtml(CONFIDENTIAL_LABEL[opts.confidential][opts.lang])}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(opts.title)}</title>
<style>
  body { font-family: "Hiragino Kaku Gothic ProN","Yu Gothic",Arial,sans-serif; margin:0; padding:0; background:#f5f5f5; color:#212121; }
  .container { max-width:800px; margin:0 auto; background:#ffffff; }
  header.report-header { background:#1a237e; color:#ffffff; padding:16px 24px; }
  header.report-header h1 { margin:0; font-size:18px; }
  header.report-header .meta { font-size:12px; color:#c5cae9; margin-top:6px; }
  main { padding:16px 24px; }
  section { margin-bottom:24px; }
  section h2 { font-size:15px; border-bottom:2px solid #1a237e; padding-bottom:4px; }
  table { border-collapse:collapse; width:100%; font-size:13px; }
  th, td { border:1px solid #e0e0e0; padding:6px 8px; text-align:left; }
  th { background:#eeeeee; }
  tr.overdue { background:#ffebee; }
  footer.report-footer { padding:12px 24px; font-size:11px; color:#757575; border-top:1px solid #e0e0e0; }
</style>
</head>
<body>
<div class="container">
  <header class="report-header">
    <h1>${escapeHtml(systemName)}</h1>
    <div class="meta">
      ${opts.lang === "ja" ? "レポートID" : "Report ID"}: ${escapeHtml(opts.reportId)} |
      ${opts.lang === "ja" ? "対象期間" : "Period"}: ${escapeHtml(opts.periodLabel)} |
      ${opts.lang === "ja" ? "生成日時" : "Generated"}: ${escapeHtml(opts.generatedAtLabel)} |
      ${opts.lang === "ja" ? "データ取得時点" : "Data as of"}: ${escapeHtml(opts.dataSnapshotLabel)}
    </div>
  </header>
  <main>
    ${opts.bodyHtml}
  </main>
  <footer class="report-footer">
    <p style="margin:0;">${escapeHtml(opts.contactLine)}</p>
    ${confidentialHtml}
  </footer>
</div>
</body>
</html>`;
}
