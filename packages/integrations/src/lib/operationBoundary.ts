// 根拠: FinalArch:CON-002 / FinalArch:PRD-005 / ADR-0023 / ADR-0024
// adapter ごとに許可された操作の境界（license register / P0 baseline gate §3-1 と対応）。
// 純粋関数のみ。境界の緩和は register の承認なしに変更しない。

import type { AdapterKind, AdapterOperation } from "../adapters/types.js";

/**
 * 製品ごとの許可操作。
 * - workiq: signed-in-user delegated/OBO の read/ask/fetch のみ（app-only 禁止、ADR-0024）
 * - mcp-gateway: allowlisted tool の invoke のみ（LLM routing なし、ADR-0023）
 * - wispr: read のみ
 * - jira: read + draft + project_development（開発情報投影のみ。承認・mergeは不可）
 * - plane / confluence: read + draft（formal publish は人間ゲート）
 */
const ALLOWED_OPERATIONS: Readonly<Record<AdapterKind, readonly AdapterOperation[]>> = {
  workiq: ["read", "ask", "fetch"],
  "mcp-gateway": ["invoke"],
  wispr: ["read"],
  jira: ["read", "draft", "project_development"],
  plane: ["read", "draft"],
  confluence: ["read", "draft"],
};

/** 未知の adapter / 未許可の操作は必ず拒否する（default deny）。 */
export function isOperationAllowed(kind: AdapterKind, operation: AdapterOperation): boolean {
  const allowed = ALLOWED_OPERATIONS[kind];
  return allowed !== undefined && allowed.includes(operation);
}

/** 拒否時に理由つきで throw する結線用ヘルパ。 */
export function assertOperationAllowed(kind: AdapterKind, operation: AdapterOperation): void {
  if (!isOperationAllowed(kind, operation)) {
    throw new RangeError(`operation ${operation} is not allowed for adapter ${kind}`);
  }
}
