/**
 * packages/web/src/components/ui/Card.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード 共通UIキット）
 * 枠 + padding + shadow のカード。サーバ/クライアント両用（状態なし純関数コンポーネント）。
 */
import type { ReactNode } from "react";

export interface CardProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, className = "", children }: CardProps) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`.trim()}>
      {title ? <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2> : null}
      {children}
    </section>
  );
}
