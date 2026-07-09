/**
 * packages/web/src/components/ui/Badge.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード 共通UIキット）/ SPEC-EXT-020（ステータス色）
 * 汎用バッジ。variant の色トークン（status-green/yellow/red）は
 * globals.css の @theme（= reportShell.ts STATUS_COLOR_HEX と同一値）に基づく。
 */
import type { ReactNode } from "react";

export type BadgeVariant = "default" | "green" | "yellow" | "red";

export const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  green: "bg-status-green/10 text-status-green",
  yellow: "bg-status-yellow/15 text-yellow-800",
  red: "bg-status-red/10 text-status-red",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = "default", className = "", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_VARIANT_CLASS[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
