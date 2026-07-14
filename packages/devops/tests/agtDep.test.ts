import { describe, it, expect } from "vitest";
import { buildHolidayCalendar } from "@aiops/shared/calendar/businessCalendar.js";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import {
  promoteToStagingIfEligible,
  executeProdDeploy,
  monitorAndRollbackIfNeeded,
  type DeployDependencies,
} from "../src/agents/AGT_DEP.js";

function makeDeps(): {
  deps: DeployDependencies;
  cardCount: { n: number };
  dispatchCalls: Array<{ ref: string; inputs: Record<string, string> }>;
  issuesCreated: number;
} {
  const cardCount = { n: 0 };
  const dispatchCalls: Array<{ ref: string; inputs: Record<string, string> }> = [];
  let issuesCreated = 0;
  const deps: DeployDependencies = {
    githubClient: {
      dispatchWorkflow: async (input) => {
        dispatchCalls.push({ ref: input.ref, inputs: input.inputs });
      },
      createIssue: async () => {
        issuesCreated += 1;
        return { number: issuesCreated, htmlUrl: `https://github.com/acme/x/issues/${issuesCreated}` };
      },
    },
    graphClient: {
      sendAdaptiveCard: async () => {
        cardCount.n += 1;
        return { messageId: "m1" };
      },
    },
    auditLog: new InMemoryAuditLog(),
    traceId: "trace-1",
    cal: buildHolidayCalendar([]),
  };
  return { deps, cardCount, dispatchCalls, issuesCreated };
}

describe("promoteToStagingIfEligible [DevOps:REQ-003, TH-001]", () => {
  it("TH-001充足時は昇格しTeams通知する", async () => {
    const { deps, cardCount } = makeDeps();
    const promoted = await promoteToStagingIfEligible(
      { ciAllJobsSuccess: true, unitTestCoveragePct: 85, staticAnalysisCriticalCount: 0 },
      { teamId: "team-1", channelId: "chan-1" },
      "abc1234",
      deps,
    );
    expect(promoted).toBe(true);
    expect(cardCount.n).toBe(1);
    const logs = await deps.auditLog.readAll();
    expect(logs.some((l) => l.action === "staging_promote")).toBe(true);
  });

  it("TH-001非充足時は昇格しない（AC-003a境界値: カバレッジ79%）", async () => {
    const { deps, cardCount } = makeDeps();
    const promoted = await promoteToStagingIfEligible(
      { ciAllJobsSuccess: true, unitTestCoveragePct: 79, staticAnalysisCriticalCount: 0 },
      { teamId: "team-1", channelId: "chan-1" },
      "abc1234",
      deps,
    );
    expect(promoted).toBe(false);
    expect(cardCount.n).toBe(0);
  });
});

describe("executeProdDeploy [DevOps:REQ-010, DevOps:SPEC-INT-020]", () => {
  it("approved状態からはprod_deployingへ遷移でき、workflow_dispatchを呼ぶ", async () => {
    const { deps, dispatchCalls } = makeDeps();
    await executeProdDeploy("approved", "acme", "devops-system", "deadbeef", deps);
    expect(dispatchCalls).toHaveLength(1);
    expect(dispatchCalls[0]?.ref).toBe("deadbeef");
  });

  it("staging_deployed状態からの直接デプロイは許可されない例外を投げる（承認スキップ防止, AC-010a）", async () => {
    const { deps } = makeDeps();
    await expect(executeProdDeploy("staging_deployed", "acme", "devops-system", "deadbeef", deps)).rejects.toThrow(
      /E-DEP02/,
    );
  });
});

describe("monitorAndRollbackIfNeeded [DevOps:REQ-012, AC-012a/b/c]", () => {
  const stableVersions = [
    { version: "v1.2.0", stableSince: "2026-07-01T00:00:00Z", stableDurationMinutesAsOfFailure: 100 },
  ];

  it("TH-003非該当ならロールバックしない", async () => {
    const { deps, dispatchCalls } = makeDeps();
    const result = await monitorAndRollbackIfNeeded(
      { samples: [{ atSecondsFromDeploy: 0, http5xxRatePct: 1, p95LatencyMs: 100 }], baselineP95Ms: 100 },
      stableVersions,
      "acme",
      "devops-system",
      "PRJ-001",
      { teamId: "team-1", channelId: "chan-1" },
      deps,
    );
    expect(result.rolledBack).toBe(false);
    expect(dispatchCalls).toHaveLength(0);
  });

  it("TH-003該当時はロールバックを実行し、Issue起票・Teams通知する", async () => {
    const { deps, dispatchCalls, cardCount } = makeDeps();
    const result = await monitorAndRollbackIfNeeded(
      {
        samples: [
          { atSecondsFromDeploy: 0, http5xxRatePct: 10, p95LatencyMs: 100 },
          { atSecondsFromDeploy: 60, http5xxRatePct: 10, p95LatencyMs: 100 },
        ],
        baselineP95Ms: 100,
      },
      stableVersions,
      "acme",
      "devops-system",
      "PRJ-001",
      { teamId: "team-1", channelId: "chan-1" },
      deps,
    );
    expect(result.rolledBack).toBe(true);
    expect(result.targetVersion).toBe("v1.2.0");
    expect(dispatchCalls[0]?.inputs.rollback).toBe("true");
    expect(cardCount.n).toBe(1);
  });

  it("適格なロールバック先がない場合は実行せずエスカレーション記録する（AC-012c）", async () => {
    const { deps, dispatchCalls } = makeDeps();
    const result = await monitorAndRollbackIfNeeded(
      {
        samples: [
          { atSecondsFromDeploy: 0, http5xxRatePct: 10, p95LatencyMs: 100 },
          { atSecondsFromDeploy: 60, http5xxRatePct: 10, p95LatencyMs: 100 },
        ],
        baselineP95Ms: 100,
      },
      [{ version: "v1.1.0", stableSince: "2026-07-01T00:00:00Z", stableDurationMinutesAsOfFailure: 5 }],
      "acme",
      "devops-system",
      "PRJ-001",
      { teamId: "team-1", channelId: "chan-1" },
      deps,
    );
    expect(result.rolledBack).toBe(false);
    expect(dispatchCalls).toHaveLength(0);
    const logs = await deps.auditLog.readAll();
    expect(logs.some((l) => l.action === "rollback_target_not_found")).toBe(true);
  });
});
