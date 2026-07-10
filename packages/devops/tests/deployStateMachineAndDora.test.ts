import { describe, it, expect } from "vitest";
import {
  canTransitionDeploy,
  assertDeployTransition,
  reachesProdDeployingWithoutApproval,
} from "../src/lib/deployStateMachine.js";
import {
  calcDeploymentFrequencyPerWeek,
  calcMedianLeadTimeHours,
  calcChangeFailureRatePct,
  calcDeploymentReworkRatePct,
  calcFailedDeploymentRecoveryTimeHours,
  classifyDoraBands,
  calculateDoraSummary,
} from "../src/lib/doraMetrics.js";

describe("deployStateMachine [SPEC-INT-020]", () => {
  it("正常な遷移列はすべて許可される", () => {
    expect(canTransitionDeploy("pending", "staging_deployed")).toBe(true);
    expect(canTransitionDeploy("staging_deployed", "approval_requested")).toBe(true);
    expect(canTransitionDeploy("approval_requested", "approved")).toBe(true);
    expect(canTransitionDeploy("approved", "prod_deploying")).toBe(true);
    expect(canTransitionDeploy("prod_deploying", "monitoring")).toBe(true);
    expect(canTransitionDeploy("monitoring", "stable")).toBe(true);
    expect(canTransitionDeploy("monitoring", "rolling_back")).toBe(true);
    expect(canTransitionDeploy("rolling_back", "rolled_back")).toBe(true);
  });

  it("承認をスキップしたprod_deployingへの遷移は禁止される", () => {
    expect(canTransitionDeploy("staging_deployed", "prod_deploying")).toBe(false);
    expect(canTransitionDeploy("pending", "prod_deploying")).toBe(false);
  });

  it("却下・期限切れは終端状態", () => {
    expect(canTransitionDeploy("rejected", "approved")).toBe(false);
    expect(canTransitionDeploy("expired", "prod_deploying")).toBe(false);
  });

  it("assertDeployTransitionは不正遷移で例外を投げる", () => {
    expect(() => assertDeployTransition("pending", "monitoring")).toThrow(/E-DEP02/);
  });

  it("reachesProdDeployingWithoutApproval: 承認前にprod_deployingへ到達した場合を検出する", () => {
    const log: Array<"pending" | "staging_deployed" | "prod_deploying" | "approved"> = [
      "pending",
      "staging_deployed",
      "prod_deploying",
    ];
    expect(reachesProdDeployingWithoutApproval(log)).toBe(true);
  });
  it("正常な順序なら検出しない", () => {
    const log: Array<"pending" | "staging_deployed" | "approval_requested" | "approved" | "prod_deploying"> = [
      "pending",
      "staging_deployed",
      "approval_requested",
      "approved",
      "prod_deploying",
    ];
    expect(reachesProdDeployingWithoutApproval(log)).toBe(false);
  });
});

describe("doraMetrics [REQ-023 AC-023b]", () => {
  const deployments = [
    {
      projectId: "PRJ-001",
      commitAt: "2026-07-01T00:00:00Z",
      deployedAt: "2026-07-01T10:00:00Z",
      causedFailure: false,
    },
    {
      projectId: "PRJ-001",
      commitAt: "2026-07-02T00:00:00Z",
      deployedAt: "2026-07-02T20:00:00Z",
      causedFailure: true,
      unplannedRework: false,
    },
    {
      projectId: "PRJ-001",
      commitAt: "2026-07-03T00:00:00Z",
      deployedAt: "2026-07-03T05:00:00Z",
      causedFailure: false,
      unplannedRework: true,
    },
  ];
  const incidents = [
    {
      projectId: "PRJ-001",
      detectedAt: "2026-07-02T20:00:00Z",
      resolvedAt: "2026-07-02T22:00:00Z",
      causedByDeployment: true,
    },
  ];

  it("デプロイ頻度: 3件/7日間 → 週あたり3件", () => {
    expect(calcDeploymentFrequencyPerWeek(deployments, 7)).toBe(3);
  });

  it("リードタイム中央値: [10h, 20h, 5h] → 中央値10h", () => {
    expect(calcMedianLeadTimeHours(deployments)).toBe(10);
  });

  it("変更失敗率: 3件中1件失敗 → 33.33...%", () => {
    const rate = calcChangeFailureRatePct(deployments);
    expect(Math.round(rate * 100) / 100).toBe(33.33);
  });

  it("failed deployment recovery time: 変更起因かつ解決済みのみを中央値で返す", () => {
    expect(
      calcFailedDeploymentRecoveryTimeHours([
        ...incidents,
        {
          projectId: "PRJ-001",
          detectedAt: "2026-07-03T00:00:00Z",
          resolvedAt: "2026-07-07T04:00:00Z",
          causedByDeployment: false,
        },
        {
          projectId: "PRJ-001",
          detectedAt: "2026-07-04T00:00:00Z",
          resolvedAt: null,
          causedByDeployment: true,
        },
      ]),
    ).toBe(2);
  });

  it("deployment rework rate: 計画外修正デプロイのみを数える [AC-023b]", () => {
    const rate = calcDeploymentReworkRatePct(deployments);
    expect(Math.round(rate * 100) / 100).toBe(33.33);
  });

  it("calculateDoraSummaryはDORA5指標すべてを返す（AC-023b）", () => {
    const summary = calculateDoraSummary(deployments, incidents, 7);
    expect(summary.deploymentFrequencyPerWeek).toBe(3);
    expect(summary.medianLeadTimeHours).toBe(10);
    expect(summary.failedDeploymentRecoveryTimeHours).toBe(2);
    expect(summary.changeFailureRatePct).toBeGreaterThanOrEqual(33);
    expect(summary.deploymentReworkRatePct).toBeGreaterThanOrEqual(33);
  });

  it("空データはエリート扱いに見える0ではなくnull/NAを返す", () => {
    const summary = calculateDoraSummary([], [], 7);
    expect(summary.deploymentFrequencyPerWeek).toBeNull();
    expect(summary.medianLeadTimeHours).toBeNull();
    expect(summary.changeFailureRatePct).toBeNull();
    expect(summary.deploymentReworkRatePct).toBeNull();
    expect(summary.failedDeploymentRecoveryTimeHours).toBeNull();
    expect(classifyDoraBands(summary).failedDeploymentRecoveryTime).toBe("na");
  });
});
