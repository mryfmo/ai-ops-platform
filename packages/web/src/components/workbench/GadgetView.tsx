/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 / UX-005 */
import type { ReactElement } from "react";

import type { WorkbenchWorkspace } from "../../server/workbenchClient.js";
import { parseGadgetViewSpec, type GadgetViewSpec } from "../../server/viewSpec.js";
import { Card } from "../ui/Card.js";
import { DataTable, type DataTableColumn } from "../ui/DataTable.js";

export interface GadgetViewProps {
  readonly spec: GadgetViewSpec;
  readonly workspace: WorkbenchWorkspace;
}

function scopeError(): never {
  throw new Error("E-GADGET-SCOPE: the view reference is outside the granted workspace projection");
}

function assertGrantedContext(spec: GadgetViewSpec, workspace: WorkbenchWorkspace): void {
  if (
    spec.workspaceId !== workspace.workspaceId ||
    spec.resource.resourceType !== workspace.grant.resourceType ||
    spec.resource.resourceId !== workspace.grant.resourceId
  ) {
    scopeError();
  }
}

function WorkflowTimeline({ spec, workspace }: GadgetViewProps): ReactElement {
  const runs =
    spec.component === "workflowTimeline" && spec.workflowId
      ? workspace.runs.filter((run) => run.workflowId === spec.workflowId)
      : workspace.runs;
  if (spec.component === "workflowTimeline" && spec.workflowId && runs.length === 0) scopeError();

  const columns: DataTableColumn<WorkbenchWorkspace["runs"][number]>[] = [
    { key: "workflow", header: "ワークフロー", render: (run) => run.workflowId },
    { key: "type", header: "種別", render: (run) => run.workflowType },
    { key: "status", header: "状態", render: (run) => run.status },
    { key: "step", header: "現在ステップ", render: (run) => run.currentStep ?? "—" },
    { key: "updated", header: "更新日時", render: (run) => run.updatedAt },
  ];
  return (
    <Card title="ワークフロー履歴" eyebrow="承認済み Gadget">
      <DataTable columns={columns} rows={[...runs]} rowKey={(run) => `${run.workflowId}:${run.runId}`} />
    </Card>
  );
}

function SourcePanel({ spec, workspace }: GadgetViewProps): ReactElement {
  const sources =
    spec.component === "sourcePanel" && spec.sourceRefId
      ? workspace.sources.filter((source) => source.sourceRefId === spec.sourceRefId)
      : workspace.sources;
  if (spec.component === "sourcePanel" && spec.sourceRefId && sources.length === 0) scopeError();

  return (
    <Card title="参照元" eyebrow="来歴参照">
      <ul className="space-y-3">
        {sources.map((source) => (
          <li key={source.sourceRefId} className="rounded border border-dashboard-border p-3 text-sm">
            <p className="font-semibold text-dashboard-ink">{source.externalId}</p>
            <p className="text-dashboard-muted">
              {source.sourceSystem} · {source.sourceType}
            </p>
            <a className="text-blue-700 underline" href={source.canonicalUrl} rel="noreferrer">
              参照元を開く
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PendingActions({ spec, workspace }: GadgetViewProps): ReactElement {
  const actions =
    spec.component === "pendingActions" && spec.approvalStatus
      ? workspace.pendingActions.filter((action) => action.approvalStatus === spec.approvalStatus)
      : workspace.pendingActions;
  const columns: DataTableColumn<WorkbenchWorkspace["pendingActions"][number]>[] = [
    { key: "workflow", header: "ワークフロー", render: (action) => action.workflowId },
    { key: "action", header: "アクション状態", render: (action) => action.actionStatus },
    { key: "approval", header: "承認状態", render: (action) => action.approvalStatus },
  ];
  return (
    <Card title="承認待ちアクション" eyebrow="承認前は副作用なし">
      <DataTable columns={columns} rows={[...actions]} rowKey={(action) => action.operationId} />
    </Card>
  );
}

function DecisionSummary({ workspace }: GadgetViewProps): ReactElement {
  return (
    <Card title="判断サマリー" eyebrow="Capability grant">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="font-semibold">リソース</dt>
        <dd className="min-w-0 break-all">{`${workspace.grant.resourceType}:${workspace.grant.resourceId}`}</dd>
        <dt className="font-semibold">Policy bundle</dt>
        <dd className="min-w-0 break-all">{workspace.grant.policyBundleVersion}</dd>
        <dt className="font-semibold">Decision ID</dt>
        <dd className="min-w-0 break-all">{workspace.grant.decisionId ?? "記録なし"}</dd>
      </dl>
    </Card>
  );
}

export function GadgetView({ spec: rawSpec, workspace }: GadgetViewProps): ReactElement {
  const spec = parseGadgetViewSpec(rawSpec);
  assertGrantedContext(spec, workspace);
  if (spec.component === "workflowTimeline") return <WorkflowTimeline spec={spec} workspace={workspace} />;
  if (spec.component === "sourcePanel") return <SourcePanel spec={spec} workspace={workspace} />;
  if (spec.component === "pendingActions") return <PendingActions spec={spec} workspace={workspace} />;
  return <DecisionSummary spec={spec} workspace={workspace} />;
}
