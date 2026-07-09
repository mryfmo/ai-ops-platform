/**
 * packages/web/src/components/ui/StatusChip.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード 共通UIキット）/ SPEC-EXT-020（共通仕様）
 *   - ステータス色は reportShell.ts の STATUS_COLOR_HEX と同一
 *     （Green=#2e7d32, Yellow=#f9a825, Red=#c62828。globals.css の @theme で定義）。
 *   - 色だけに依存せず文字ラベル併記（ja: 順調/注意/危険）。
 */
export type StatusColor = "green" | "yellow" | "red";

export const STATUS_LABEL_JA: Record<StatusColor, string> = {
  green: "順調",
  yellow: "注意",
  red: "危険",
};

export const STATUS_CHIP_CLASS: Record<StatusColor, string> = {
  green: "bg-status-green text-white",
  yellow: "bg-status-yellow text-gray-900",
  red: "bg-status-red text-white",
};

export interface StatusChipProps {
  status: StatusColor;
  className?: string;
}

export function StatusChip({ status, className = "" }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP_CLASS[status]} ${className}`.trim()}
      data-status={status}
    >
      {STATUS_LABEL_JA[status]}
    </span>
  );
}
