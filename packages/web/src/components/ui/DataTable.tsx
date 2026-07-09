/**
 * packages/web/src/components/ui/DataTable.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード 共通UIキット）
 * columns/rows を受け取るジェネリック軽量テーブル。横幅超過時は overflow-x-auto。
 * 数値・色はコード算出済みの値を表示するのみ（LLMに数値を生成させない原則に従い、
 * 本コンポーネントは表示専任）。
 */
import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = "データがありません" }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-dashboard-border text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-semibold text-dashboard-muted ${col.className ?? ""}`.trim()}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-dashboard-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey(row, index)} className="border-b border-dashboard-border">
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2 ${col.className ?? ""}`.trim()}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
