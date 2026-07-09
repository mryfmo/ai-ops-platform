import { describe, it, expect } from "vitest";
import {
  decideOnJobFailure,
  nextJobInSequence,
  WEEKLY_JOB_DEPENDENCY_ORDER,
} from "../src/agents/AGT01_orchestrator.js";

describe("decideOnJobFailure [DOC-02 §5: 最大2回リトライ、3回目でエスカレーション]", () => {
  it("1回目の失敗はリトライ（10分間隔）", () => {
    const d = decideOnJobFailure({ jobName: "analyze-weekly", attemptNumber: 1 });
    expect(d).toEqual({ action: "retry", delayMinutes: 10 });
  });
  it("2回目の失敗もリトライ", () => {
    const d = decideOnJobFailure({ jobName: "analyze-weekly", attemptNumber: 2 });
    expect(d.action).toBe("retry");
  });
  it("3回目の失敗でPMO運用担当へエスカレーション", () => {
    const d = decideOnJobFailure({ jobName: "analyze-weekly", attemptNumber: 3 });
    expect(d).toEqual({ action: "escalate", notifyTarget: "pmo_operator" });
  });
});

describe("nextJobInSequence [SPEC-INT-040: analyze→report→verify→deliver]", () => {
  it("順序どおりに次のジョブを返す", () => {
    expect(nextJobInSequence("analyze-weekly")).toBe("report-weekly");
    expect(nextJobInSequence("report-weekly")).toBe("verify-weekly");
    expect(nextJobInSequence("verify-weekly")).toBe("deliver-weekly");
  });
  it("最後のジョブの次はnull", () => {
    expect(nextJobInSequence("deliver-weekly")).toBe(null);
  });
  it("依存順序は4ジョブで構成される", () => {
    expect(WEEKLY_JOB_DEPENDENCY_ORDER).toHaveLength(4);
  });
});
