/**
 * packages/devops/src/templates/reportShell.ts
 *
 * 根拠: SPEC-EXT-020 共通仕様
 *   件名書式 `[DevOpsレポート][種別] YYYY-MM-DD`。本文HTMLはインラインCSSのみ使用
 *   （外部CSS・JavaScript不可）、幅640px基準の単一カラム。
 *   ヘッダーに集計期間・生成時刻（JST）・宛先プロファイル名を表示。
 *   フッターに配信停止・宛先変更の問い合わせ先を表示。
 */

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSubject(kind: string, dateJst: string): string {
  return `[DevOpsレポート][${kind}] ${dateJst}`;
}

export interface DevOpsReportShellOptions {
  profileLabel: string;
  periodLabel: string;
  generatedAtLabel: string;
  contactLine: string;
  bodyHtml: string;
  title: string;
}

/** SPEC-EXT-020: インラインCSSのみ、幅640px基準の単一カラム、自己完結HTML */
export function renderDevOpsReportShell(opts: DevOpsReportShellOptions): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(opts.title)}</title>
<style>
  body { font-family: "Hiragino Kaku Gothic ProN","Yu Gothic",Arial,sans-serif; margin:0; padding:0; background:#f5f5f5; color:#212121; }
  .container { max-width:640px; margin:0 auto; background:#ffffff; }
  header { background:#263238; color:#ffffff; padding:14px 20px; }
  header h1 { margin:0; font-size:16px; }
  header .meta { font-size:11px; color:#b0bec5; margin-top:4px; }
  main { padding:14px 20px; }
  section { margin-bottom:20px; }
  section h2 { font-size:14px; border-bottom:2px solid #263238; padding-bottom:4px; }
  table { border-collapse:collapse; width:100%; font-size:12px; }
  th, td { border:1px solid #e0e0e0; padding:5px 7px; text-align:left; }
  th { background:#eceff1; }
  footer { padding:10px 20px; font-size:10px; color:#757575; border-top:1px solid #e0e0e0; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>DevOps運用基盤 - ${escapeHtml(opts.profileLabel)}向けレポート</h1>
    <div class="meta">集計期間: ${escapeHtml(opts.periodLabel)} | 生成時刻: ${escapeHtml(opts.generatedAtLabel)} | 宛先: ${escapeHtml(
      opts.profileLabel,
    )}</div>
  </header>
  <main>${opts.bodyHtml}</main>
  <footer>${escapeHtml(opts.contactLine)}</footer>
</div>
</body>
</html>`;
}
