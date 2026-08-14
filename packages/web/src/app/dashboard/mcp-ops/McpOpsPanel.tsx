/** 根拠: FinalArch:MCP-001 / FinalArch:MCP-003 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11 */
"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { McpInvocationAudit, McpOpsSummary } from "../../../server/mcpOpsClient";
import { McpOpsView } from "../../../components/views/McpOpsView";

const INVOCATION_API = "/app/api/mcp-ops/invocations";

export function McpOpsPanel() {
  const [summary, setSummary] = useState<McpOpsSummary | null>(null);
  const [audit, setAudit] = useState<McpInvocationAudit | null>(null);
  const [invocationId, setInvocationId] = useState("");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void fetch("/app/api/mcp-ops")
      .then(async (response) => {
        const payload = (await response.json()) as McpOpsSummary & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "MCP operations を取得できませんでした");
        if (active) setSummary(payload);
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "MCP operations を取得できませんでした");
      });
    return () => {
      active = false;
    };
  }, []);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    setAudit(null);
    const response = await fetch(`${INVOCATION_API}/${encodeURIComponent(invocationId.trim())}`);
    const payload = (await response.json()) as McpInvocationAudit & { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "Invocation を取得できませんでした");
      return;
    }
    setAudit(payload);
  }

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void lookup(event)}>
        <label className="grid gap-1 text-sm" htmlFor="mcp-invocation-id">
          Invocation ID
          <input
            id="mcp-invocation-id"
            className="rounded border px-3 py-2"
            value={invocationId}
            onChange={(event) => setInvocationId(event.target.value)}
            required
          />
        </label>
        <button className="rounded border px-3 py-2" type="submit">
          監査検索
        </button>
      </form>
      {message ? <p aria-live="polite">{message}</p> : null}
      {summary ? <McpOpsView summary={summary} audit={audit} /> : null}
    </div>
  );
}
