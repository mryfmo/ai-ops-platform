// 根拠: FinalArch:MCP-006 / FinalArch:FR-MCP-006 / ADR-0023 / WBS P4-T10
import type { GovernedInvocationContext, McpToolRisk } from "./mcpPolicy.js";

export interface BoundedInvocationProfile {
  readonly maxResultBytes: number;
  readonly timeoutMs: number;
  readonly maxDepth: number;
  readonly maxChainLength: number;
}

export type InvocationLimitErrorCode = "E-TOOL-DEPTH" | "E-TOOL-RECURSION";

// Higher-risk tools get monotonically tighter bounds. This single reviewed table is the change boundary.
export const BOUNDED_INVOCATION_PROFILES: Readonly<Record<McpToolRisk, BoundedInvocationProfile>> = {
  L0: { maxResultBytes: 1_048_576, timeoutMs: 30_000, maxDepth: 4, maxChainLength: 8 },
  L1: { maxResultBytes: 524_288, timeoutMs: 20_000, maxDepth: 3, maxChainLength: 6 },
  L2: { maxResultBytes: 262_144, timeoutMs: 10_000, maxDepth: 2, maxChainLength: 4 },
  L3: { maxResultBytes: 131_072, timeoutMs: 5_000, maxDepth: 1, maxChainLength: 2 },
};

export function resolveInvocationProfile(risk: McpToolRisk, policyMaxResultBytes?: unknown): BoundedInvocationProfile {
  const profile = BOUNDED_INVOCATION_PROFILES[risk];
  if (policyMaxResultBytes === undefined) return profile;
  if (!Number.isSafeInteger(policyMaxResultBytes) || (policyMaxResultBytes as number) < 1) {
    throw new TypeError("maxResultBytes obligation must be a positive safe integer");
  }
  return { ...profile, maxResultBytes: Math.min(profile.maxResultBytes, policyMaxResultBytes as number) };
}

export function invocationLimitError(
  profile: BoundedInvocationProfile,
  operationId: string,
  context: GovernedInvocationContext | undefined,
): InvocationLimitErrorCode | null {
  if (context === undefined) return "E-TOOL-DEPTH";
  if (
    !Number.isSafeInteger(context.depth) ||
    context.depth < 0 ||
    !Array.isArray(context.ancestorOperationIds) ||
    !context.ancestorOperationIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return "E-TOOL-DEPTH";
  }
  if (context.ancestorOperationIds.includes(operationId)) return "E-TOOL-RECURSION";
  if (context.depth > profile.maxDepth || context.ancestorOperationIds.length >= profile.maxChainLength) {
    return "E-TOOL-DEPTH";
  }
  return null;
}

export function deriveInvocationContext(input: {
  readonly operationId: string;
  readonly invocation: GovernedInvocationContext;
}): GovernedInvocationContext {
  return {
    depth: input.invocation.depth + 1,
    ancestorOperationIds: [...input.invocation.ancestorOperationIds, input.operationId],
  };
}

export function jsonResultByteLength(result: unknown): number {
  const serialized = JSON.stringify(result);
  return serialized === undefined ? 0 : new TextEncoder().encode(serialized).byteLength;
}
