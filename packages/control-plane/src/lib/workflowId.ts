// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// Workflow ID は business key から決定的に構築する（正典 component spec 01 の Workflow rules）。
// 純粋関数のみ。時刻・乱数・I/O を使わない。

import type { WorkflowKind } from "../contracts/index.js";

const BUSINESS_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;

/**
 * business key から Temporal workflow ID を決定的に構築する。
 * 同一 (kind, businessKey) は常に同一 ID になり、重複起動防止の基盤となる。
 */
export function buildWorkflowId(kind: WorkflowKind, businessKey: string): string {
  if (!BUSINESS_KEY_PATTERN.test(businessKey)) {
    throw new RangeError(`business key must match ${BUSINESS_KEY_PATTERN.source} (got ${JSON.stringify(businessKey)})`);
  }
  return `${kind}/${businessKey}`;
}

/** workflow ID を (kind, businessKey) に分解する。buildWorkflowId の逆関数。 */
export function parseWorkflowId(workflowId: string): { kind: WorkflowKind; businessKey: string } {
  const separator = workflowId.indexOf("/");
  if (separator <= 0) {
    throw new RangeError(`workflow ID must be "<kind>/<businessKey>" (got ${JSON.stringify(workflowId)})`);
  }
  const kind = workflowId.slice(0, separator) as WorkflowKind;
  const businessKey = workflowId.slice(separator + 1);
  if (!BUSINESS_KEY_PATTERN.test(businessKey)) {
    throw new RangeError(`workflow ID has an invalid business key: ${JSON.stringify(workflowId)}`);
  }
  return { kind, businessKey };
}
