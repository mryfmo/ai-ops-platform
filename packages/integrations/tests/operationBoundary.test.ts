// 根拠: FinalArch:CON-002 / FinalArch:PRD-005 / ADR-0023 / ADR-0024
import { describe, expect, it } from "vitest";

import {
  ADAPTER_KINDS,
  WORKIQ_SURFACE_OPERATIONS,
  assertOperationAllowed,
  isOperationAllowed,
  type AdapterKind,
  type AdapterOperation,
} from "../src/index.js";

describe("FinalArch:CON-002 adapter 操作境界（register の承認境界と一致）", () => {
  it("Work IQ は delegated read/ask/fetch のみ許可（ADR-0024）", () => {
    expect(isOperationAllowed("workiq", "read")).toBe(true);
    expect(isOperationAllowed("workiq", "ask")).toBe(true);
    expect(isOperationAllowed("workiq", "fetch")).toBe(true);
    expect(isOperationAllowed("workiq", "draft")).toBe(false);
    expect(isOperationAllowed("workiq", "invoke")).toBe(false);
  });

  it("Wispr は read のみ、MCP gateway は invoke のみ（ADR-0023）", () => {
    expect(isOperationAllowed("wispr", "read")).toBe(true);
    expect(isOperationAllowed("wispr", "draft")).toBe(false);
    expect(isOperationAllowed("mcp-gateway", "invoke")).toBe(true);
    expect(isOperationAllowed("mcp-gateway", "read")).toBe(false);
  });

  it("Plane / Confluence は read + draft のみ（formal publish は不許可）", () => {
    for (const kind of ["plane", "confluence"] as const) {
      expect(isOperationAllowed(kind, "read")).toBe(true);
      expect(isOperationAllowed(kind, "draft")).toBe(true);
      expect(isOperationAllowed(kind, "invoke")).toBe(false);
      expect(isOperationAllowed(kind, "ask")).toBe(false);
    }
  });

  it("未知 adapter / 未知操作は default deny（FinalArch:CON-002）", () => {
    expect(isOperationAllowed("unknown" as AdapterKind, "read")).toBe(false);
    expect(isOperationAllowed("plane", "delete" as AdapterOperation)).toBe(false);
    expect(() => assertOperationAllowed("wispr", "draft")).toThrow(RangeError);
    expect(() => assertOperationAllowed("plane", "read")).not.toThrow();
  });

  it("WorkIq の公開表面（型レベル固定）は boundary でもすべて許可される", () => {
    for (const operation of WORKIQ_SURFACE_OPERATIONS) {
      expect(isOperationAllowed("workiq", operation)).toBe(true);
    }
    expect([...WORKIQ_SURFACE_OPERATIONS].sort()).toEqual(["ask", "fetch", "read"]);
  });

  it("全 adapter kind に境界が定義されている", () => {
    for (const kind of ADAPTER_KINDS) {
      expect(
        (["read", "ask", "fetch", "draft", "invoke"] as const).some((op) => isOperationAllowed(kind, op)),
        `${kind} に許可操作がない`,
      ).toBe(true);
    }
  });
});
