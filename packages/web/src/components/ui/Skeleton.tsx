/**
 * packages/web/src/components/ui/Skeleton.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード 共通UIキット）
 * ローディングプレースホルダ。サイズは className（例: h-4 w-32）で指定する。
 */
export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`.trim()} aria-hidden="true" />
  );
}
