// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
import { describe, expect, it } from "vitest";

import { WORKFLOW_KINDS, buildWorkflowId, defineWorkflow, parseWorkflowId } from "../src/index.js";

describe("FinalArch:FR-CP-001 buildWorkflowId は business key から決定的に ID を構築する", () => {
  it("同一入力から常に同一 ID を返す（FinalArch:CON-001）", () => {
    expect(buildWorkflowId("meeting", "2026-08-11-standup")).toBe("meeting/2026-08-11-standup");
    expect(buildWorkflowId("meeting", "2026-08-11-standup")).toBe(buildWorkflowId("meeting", "2026-08-11-standup"));
  });

  it("全 workflow kind で往復（build→parse）が恒等になる", () => {
    for (const kind of WORKFLOW_KINDS) {
      const id = buildWorkflowId(kind, "key-1");
      expect(parseWorkflowId(id)).toEqual({ kind, businessKey: "key-1" });
    }
  });

  it("空・先頭記号・過長・制御文字の business key を拒否する（境界値）", () => {
    expect(() => buildWorkflowId("incident", "")).toThrow(RangeError);
    expect(() => buildWorkflowId("incident", "-leading")).toThrow(RangeError);
    expect(() => buildWorkflowId("incident", "a".repeat(201))).toThrow(RangeError);
    expect(() => buildWorkflowId("incident", "bad\nkey")).toThrow(RangeError);
    expect(buildWorkflowId("incident", "a".repeat(200))).toContain("incident/");
  });

  it("parseWorkflowId は区切りなし・空 kind・不正 key を拒否する", () => {
    expect(() => parseWorkflowId("no-separator")).toThrow(RangeError);
    expect(() => parseWorkflowId("/only-key")).toThrow(RangeError);
    expect(() => parseWorkflowId("meeting/bad key")).toThrow(RangeError);
  });

  it("defineWorkflow は kind を固定した ID 生成子を返す", () => {
    const wf = defineWorkflow("coding-task");
    expect(wf.kind).toBe("coding-task");
    expect(wf.workflowIdFor("PR-42")).toBe("coding-task/PR-42");
  });
});
