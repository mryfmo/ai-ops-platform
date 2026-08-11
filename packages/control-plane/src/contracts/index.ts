// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / FinalArch:PRD-003 / ADR-0020
// 制御プレーンの versioned contract の最小形。activity input/output は
// schemaVersion を必ず持つ（正典 component spec 01 の Workflow rules）。

/** 正典 component spec 01 が定める 7 workflow。 */
export const WORKFLOW_KINDS = [
  "meeting",
  "coding-task",
  "incident",
  "report",
  "plane-sync",
  "graph-subscription",
  "knowledge-publication",
] as const;

export type WorkflowKind = (typeof WORKFLOW_KINDS)[number];

/** activity の入出力封筒。schema 進化は schemaVersion で管理する。 */
export interface VersionedPayload<T> {
  readonly schemaVersion: 1;
  readonly payload: T;
}

/** operation class ごとに固定の retry policy を引く鍵（値は P3 で確定）。 */
export type OperationClass = "read" | "idempotent-write" | "external-side-effect" | "approval";
