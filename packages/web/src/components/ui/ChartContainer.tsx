/**
 * packages/web/src/components/ui/ChartContainer.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード 共通UIキット）
 * チャート表示用コンテナ: タイトル + 説明 + children（チャート本体）。
 */
import type { ReactNode } from "react";

export interface ChartContainerProps {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

export function ChartContainer({ title, description, className = "", children }: ChartContainerProps) {
  return (
    <figure
      className={`rounded-lg border border-dashboard-border bg-dashboard-panel p-4 shadow-sm ${className}`.trim()}
    >
      <figcaption className="mb-3">
        <div className="text-sm font-semibold text-dashboard-ink">{title}</div>
        {description ? <p className="mt-0.5 text-xs text-dashboard-muted">{description}</p> : null}
      </figcaption>
      {children}
    </figure>
  );
}
