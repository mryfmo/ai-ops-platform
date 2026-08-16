// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005
import { describe, expect, it } from "vitest";

import { classifyApprovedDeployClaim, planProdMonitorTarget } from "../src/lib/deploymentTaskState.js";

const claim = {
  approvalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  deployId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  projectId: "PJ-001",
  commitSha: "a".repeat(40),
  repositories: [{ owner: "acme", repo: "widget" }],
};

const target = {
  deployId: claim.deployId,
  projectId: claim.projectId,
  owner: "acme",
  repo: "widget",
  commitSha: claim.commitSha,
  channels: [{ teamId: "team", channelId: "channel" }],
};

const metrics = {
  samples: [{ atSecondsFromDeploy: 300, http5xxRatePct: 6, p95LatencyMs: 100 }],
  baselineP95Ms: 100,
};

const stable = [{ version: "v1", stableSince: "2026-08-08T00:00:00Z", stableDurationMinutesAsOfFailure: 20 }];

describe("P3-T13 approved deploy pure planning [DevOps:REQ-010]", () => {
  it("authoritative approved claim が無ければ dispatch target を捏造しない", () => {
    expect(classifyApprovedDeployClaim(null)).toEqual({ kind: "idle" });
  });

  it("valid claim は既存 deployment work item の identity をそのまま dispatch plan にする", () => {
    expect(classifyApprovedDeployClaim(claim)).toEqual({
      kind: "dispatch",
      target: {
        deployId: claim.deployId,
        projectId: claim.projectId,
        owner: "acme",
        repo: "widget",
        commitSha: claim.commitSha,
      },
    });
  });

  it.each([
    { ...claim, deployId: null },
    { ...claim, projectId: null },
    { ...claim, commitSha: "not-a-sha" },
    { ...claim, repositories: [] },
    {
      ...claim,
      repositories: [
        { owner: "a", repo: "one" },
        { owner: "b", repo: "two" },
      ],
    },
  ])("invalid/ambiguous claim は fail-closed plan: %#", (invalid) => {
    expect(classifyApprovedDeployClaim(invalid)).toMatchObject({ kind: "invalid" });
  });
});

describe("P3-T13 prod monitor pure planning [DevOps:REQ-012 / TH-003 / D-04]", () => {
  it("D-04: metrics 不在を zero に補完せず skip", () => {
    expect(planProdMonitorTarget(target, null, stable, true)).toEqual({
      kind: "skip",
      reason: "metrics-missing",
    });
  });

  it("D-04: stable history 不在は空候補で評価し rollback claim を作らない", () => {
    expect(planProdMonitorTarget(target, metrics, null, null)).toEqual({
      kind: "evaluate",
      rollbackCandidates: [],
      willDispatch: false,
      boundary: "stable-history-missing",
    });
  });

  it("D-04: workflow 不在は stable history を空にして rollback dispatch を遮断", () => {
    expect(planProdMonitorTarget(target, metrics, stable, false)).toEqual({
      kind: "evaluate",
      rollbackCandidates: [],
      willDispatch: false,
      boundary: "workflow-unavailable",
    });
  });

  it("TH-003 + stable target + workflow available のときだけ rollback CAS を要求", () => {
    expect(planProdMonitorTarget(target, metrics, stable, true)).toEqual({
      kind: "evaluate",
      rollbackCandidates: stable,
      willDispatch: true,
      boundary: null,
    });
  });

  it("channel mapping 非一意は activity/evaluation 前に fail-closed", () => {
    expect(planProdMonitorTarget({ ...target, channels: [] }, metrics, stable, true)).toEqual({
      kind: "skip",
      reason: "invalid-channel",
    });
  });
});
