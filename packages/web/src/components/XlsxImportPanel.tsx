/**
 * packages/web/src/components/XlsxImportPanel.tsx
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008 / AUD-OPM-002 / AUD-OPM-015。
 */
"use client";

import { useState } from "react";
import { Card } from "./ui/Card";
import { XLSX_IMPORT_MAX_BYTES } from "../server/xlsxImportPolicy";

interface ImportError {
  sheet: string;
  row: number;
  column?: string;
  code?: string;
  message: string;
}

interface DryRunResult {
  ok: boolean;
  rowCount: number;
  errors: ImportError[];
  summary: string;
}

const API_URL = "/app/api/xlsx-import";

export function XlsxImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(operation: "dry-run" | "execute") {
    if (!file) return;
    if (file.size > XLSX_IMPORT_MAX_BYTES) {
      setMessage("ファイルは10 MiB以下にしてください。");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ operation });
      if (operation === "execute") {
        params.set("owner", owner);
        params.set("repo", repo);
      }
      const response = await fetch(`${API_URL}?${params}`, {
        method: "POST",
        headers: {
          "content-type": file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "x-aiops-filename": encodeURIComponent(file.name),
          ...(operation === "execute" ? { "x-confirm-import": "yes" } : {}),
        },
        body: file,
      });
      const result = (await response.json()) as DryRunResult & { error?: string; result?: { summary?: string } };
      if (!response.ok) throw new Error(result.error || "インポートに失敗しました");
      if (operation === "dry-run") {
        setDryRun(result);
        setConfirmed(false);
      } else {
        setMessage(result.result?.summary || "インポートを実行しました。");
        setConfirmed(false);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Excel取込" eyebrow="Authenticated import">
      <div className="space-y-4">
        <a className="text-sm underline" href="/app/api/xlsx-import/template">
          Excelテンプレートをダウンロード
        </a>
        <div>
          <label className="block text-sm font-medium" htmlFor="xlsx-file">
            Excelファイル（最大10 MiB）
          </label>
          <input
            id="xlsx-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setDryRun(null);
              setConfirmed(false);
              setMessage(null);
            }}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            GitHub owner
            <input
              type="text"
              className="block w-full rounded border p-2"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </label>
          <label className="text-sm">
            GitHub repository
            <input
              type="text"
              className="block w-full rounded border p-2"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </label>
        </div>
        <button
          className="rounded border px-3 py-2 text-sm"
          type="button"
          disabled={!file || busy}
          onClick={() => submit("dry-run")}
        >
          dry-runで検証
        </button>
        {dryRun ? (
          <div aria-live="polite" className="space-y-3">
            <p className="text-sm">{dryRun.summary}</p>
            {dryRun.errors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th scope="col">Sheet</th>
                      <th scope="col">Row</th>
                      <th scope="col">Column</th>
                      <th scope="col">Code</th>
                      <th scope="col">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRun.errors.map((error, index) => (
                      <tr key={`${error.sheet}-${error.row}-${error.column ?? ""}-${index}`}>
                        <td>{error.sheet}</td>
                        <td>{error.row}</td>
                        <td>{error.column ?? "-"}</td>
                        <td>{error.code ?? "-"}</td>
                        <td>{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
        {dryRun?.ok ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              dry-run結果を確認し、GitHubへの書き込みを実行します
            </label>
            <button
              className="rounded bg-dashboard-ink px-3 py-2 text-sm text-dashboard-panel"
              type="button"
              disabled={!confirmed || !owner || !repo || busy}
              onClick={() => submit("execute")}
            >
              取込を実行
            </button>
          </div>
        ) : null}
        {message ? (
          <p aria-live="polite" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
