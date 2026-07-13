/**
 * packages/web/src/components/PersonaSelector.tsx
 *
 * 根拠: ADR-0005 / AUD-IMP-006。サーバーが提示した保有ペルソナから選択し、
 * 検証用 API で保存した後にダッシュボード全体を再取得する。
 */
"use client";

import { useState } from "react";

export interface PersonaOption {
  key: string;
  label: string;
}

export function PersonaSelector({ options, selectedKey }: { options: PersonaOption[]; selectedKey?: string }) {
  const [error, setError] = useState<string | null>(null);

  async function selectPersona(key: string) {
    setError(null);
    const response = await fetch("/app/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: key }),
    });
    if (!response.ok) {
      setError("ペルソナを切り替えられませんでした");
      return;
    }
    window.location.reload();
  }

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-dashboard-border pb-4">
      <span className="text-lg font-semibold text-dashboard-ink">AI Ops Dashboard</span>
      <div>
        <label htmlFor="persona-selector" className="mr-2 text-sm font-medium text-dashboard-ink">
          表示ペルソナ
        </label>
        <select
          id="persona-selector"
          value={selectedKey ?? ""}
          onChange={(event) => void selectPersona(event.target.value)}
          className="rounded-md border border-dashboard-border bg-dashboard-panel px-3 py-2 text-sm"
        >
          {!selectedKey && <option value="">選択してください</option>}
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p role="alert" className="mt-1 text-sm text-status-red">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}
