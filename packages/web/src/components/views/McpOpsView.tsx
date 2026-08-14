/** 根拠: FinalArch:MCP-001 / FinalArch:MCP-003 / FinalArch:MCP-004 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11 */
import type { McpInvocationAudit, McpOpsSummary } from "../../server/mcpOpsClient";
import { Card } from "../ui/Card";
import { DataTable, type DataTableColumn } from "../ui/DataTable";

export function McpOpsView({ summary, audit }: { summary: McpOpsSummary; audit: McpInvocationAudit | null }) {
  const usageColumns: DataTableColumn<McpOpsSummary["usage"][number]>[] = [
    { key: "server", header: "Server", render: (row) => row.serverId },
    { key: "tool", header: "Tool", render: (row) => row.toolName },
    { key: "risk", header: "Risk", render: (row) => row.riskLevel },
    { key: "status", header: "Result", render: (row) => row.status },
    { key: "count", header: "Count", render: (row) => <span className="tabular">{row.count}</span> },
  ];
  const distributionColumns: DataTableColumn<{ code: string; count: number }>[] = [
    { key: "code", header: "E-code", render: (row) => row.code },
    { key: "count", header: "Count", render: (row) => <span className="tabular">{row.count}</span> },
  ];
  const registryLabel =
    summary.registry.status === "match"
      ? "hash match"
      : summary.registry.status === "drift"
        ? "hash drift"
        : "hash unavailable";

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">MCP Operations</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card title={`Tool calls (${summary.window.hours}h)`}>
          <p className="tabular text-3xl font-bold">{summary.totalInvocations}</p>
        </Card>
        <Card title="Policy decisions">
          <p className="tabular text-3xl font-bold">{summary.policy.totalDecisions}</p>
        </Card>
        <Card title="Deny rate">
          <p className="tabular text-3xl font-bold">
            {summary.policy.denyRatePct === null ? "-" : `${summary.policy.denyRatePct.toFixed(1)}%`}
          </p>
        </Card>
        <Card title="Registry schema">
          <p>{registryLabel}</p>
        </Card>
      </div>
      <Card title="Tool usage">
        <DataTable
          columns={usageColumns}
          rows={summary.usage}
          rowKey={(row) => `${row.serverId}:${row.toolName}:${row.riskLevel}:${row.status}`}
        />
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Deny reasons">
          <DataTable columns={distributionColumns} rows={summary.denyReasons} rowKey={(row) => row.code} />
        </Card>
        <Card title="Error classes">
          <DataTable columns={distributionColumns} rows={summary.errors} rowKey={(row) => row.code} />
        </Card>
      </div>
      {audit ? (
        <Card title="Invocation audit metadata">
          <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <div>
              <dt>Invocation</dt>
              <dd>{audit.invocationId}</dd>
            </div>
            <div>
              <dt>Trace</dt>
              <dd>{audit.traceId}</dd>
            </div>
            <div>
              <dt>Actor</dt>
              <dd>{audit.actorId}</dd>
            </div>
            <div>
              <dt>Tool</dt>
              <dd>{`${audit.tool.serverId}/${audit.tool.name} (${audit.tool.riskLevel})`}</dd>
            </div>
            <div>
              <dt>Resource</dt>
              <dd>{audit.resource.id}</dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>{audit.resource.projectId ?? "-"}</dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>{`${audit.policy.decision} @ ${audit.policy.bundleVersion}`}</dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd>{`${audit.result.status} / ${audit.result.errorClass ?? "none"}`}</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>{audit.result.latencyMs === null ? "-" : `${audit.result.latencyMs} ms`}</dd>
            </div>
            <div>
              <dt>Action</dt>
              <dd>{audit.action ? `${audit.action.operationId} / ${audit.action.status}` : "-"}</dd>
            </div>
          </dl>
        </Card>
      ) : null}
    </section>
  );
}
