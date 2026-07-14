/**
 * packages/prjops/src/templates/svgCharts.ts
 *
 * 根拠: PrjOps:SPEC-EXT-021 PRF-04: 「色分布ドーナツグラフ（インラインSVG）」
 *   PrjOps:REQ-010 AC-010-1: 外部ライブラリ参照禁止（グラフはインラインSVGをコード生成）。
 *
 * 依存ゼロの純粋関数として実装する（d3等の外部チャートライブラリを使わない）。
 */
import { STATUS_COLOR_HEX } from "./reportShell.js";

export interface ColorDistribution {
  green: number;
  yellow: number;
  red: number;
}

/**
 * ドーナツチャートをインラインSVGとして生成する。stroke-dasharrayによる円弧の積み上げ方式。
 * 外部ライブラリ・外部フォント参照は一切使用しない。
 */
export function renderDonutChartSvg(dist: ColorDistribution, size = 160): string {
  const total = dist.green + dist.yellow + dist.red;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) {
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#e0e0e0" stroke-width="16" />
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#616161">N/A</text>
</svg>`;
  }

  const segments: Array<{ key: keyof ColorDistribution; value: number }> = [
    { key: "red", value: dist.red },
    { key: "yellow", value: dist.yellow },
    { key: "green", value: dist.green },
  ];

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = s.value / total;
      const dash = fraction * circumference;
      const gap = circumference - dash;
      const circle = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${STATUS_COLOR_HEX[s.key]}" stroke-width="16" stroke-dasharray="${dash.toFixed(
        2,
      )} ${gap.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" />`;
      offset += dash;
      return circle;
    })
    .join("\n  ");

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  ${arcs}
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="20" font-weight="bold" fill="#212121">${total}</text>
</svg>`;
}

/** PRF-03向け 色×週 ヒートマップ（HTMLテーブル。メールクライアント互換性を優先しSVGではなくtd背景色で表現） */
export function renderColorHeatmapTable(
  rows: Array<{ projectId: string; projectName: string; weeklyColors: Array<"green" | "yellow" | "red" | "unknown"> }>,
  weekLabels: string[],
): string {
  const colorHex: Record<string, string> = { ...STATUS_COLOR_HEX, unknown: "#e0e0e0" };
  const header = `<tr><th>${"プロジェクト"}</th>${weekLabels.map((w) => `<th>${w}</th>`).join("")}</tr>`;
  const body = rows
    .map((r) => {
      const cells = r.weeklyColors
        .map((c) => `<td style="background:${colorHex[c]};width:28px;height:20px;" title="${c}"></td>`)
        .join("");
      return `<tr><td>${r.projectId} ${r.projectName}</td>${cells}</tr>`;
    })
    .join("\n");
  return `<table>${header}${body}</table>`;
}
