/** 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。全dashboard分岐共通のExcel取込導線。 */
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav aria-label="ダッシュボード操作">
        <a className="text-sm underline" href="/app/dashboard/xlsx-import">
          Excel取込
        </a>
      </nav>
      {children}
    </div>
  );
}
