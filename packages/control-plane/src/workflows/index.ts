// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// workflow 層 scaffold。workflow コードは決定的でなければならず、
// activities からは型（activities/types）だけを import する。
// 実 workflow 本体（Temporal SDK 依存）は P3-T01 以降で追加する。

import type { ActivityDefinition } from "../activities/types.js";
import type { WorkflowKind } from "../contracts/index.js";
import { buildWorkflowId } from "../lib/workflowId.js";

/** workflow 定義の scaffold。SDK 非依存で「kind と ID 規約」だけを固定する。 */
export interface WorkflowDefinition {
  readonly kind: WorkflowKind;
  workflowIdFor(businessKey: string): string;
}

export function defineWorkflow(kind: WorkflowKind): WorkflowDefinition {
  return {
    kind,
    workflowIdFor: (businessKey) => buildWorkflowId(kind, businessKey),
  };
}

// activity 型が workflow 層から参照可能であることの型レベル確認（実装は import しない）。
export type { ActivityDefinition };
