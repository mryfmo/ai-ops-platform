/**
 * packages/server/tests/approvedDeployTask.test.ts
 *
 * 根拠: DevOps:REQ-010 / DevOps:SPEC-INT-020 / AC-010a / ADR-0014。
 */
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { ApprovalsRepo } from "../src/db/approvalsRepo.js";
import { createApprovedDeployTask } from "../src/scheduler/tasks/approvedDeployTask.js";

const claim = {
  approvalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  projectId: "PJ-001",
  commitSha: "a".repeat(40),
  repositories: [{ owner: "acme", repo: "widget" }],
};

describe("approved deploy polling [DevOps:REQ-010 / AC-010a]", () => {
  it("approved changeを一度claimし、workflow存在時だけprod_deployingを記録して実行する", async () => {
    const execute = vi.fn(async () => undefined);
    const createDispatch = vi.fn(async () => ({ deployId: "deploy-1" }));
    const task = createApprovedDeployTask({
      approvalsRepo: { claimNextApprovedChange: vi.fn(async () => claim) },
      deploymentsRepo: { createDispatch, markDispatchFailed: vi.fn() },
      workflowExists: vi.fn(async () => true),
      execute,
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-approved",
    });

    await task.run(new Date("2026-08-09T00:00:00Z"));

    expect(createDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "PJ-001", commitSha: "a".repeat(40), state: "prod_deploying" }),
    );
    expect(execute).toHaveBeenCalledWith("acme", "widget", "a".repeat(40), "trace-approved");
  });

  it("D-04 workflow不在ではdispatchを一度も試みずdispatch_failedを記録する", async () => {
    const execute = vi.fn();
    const createDispatch = vi.fn(async () => ({ deployId: "deploy-failed" }));
    const auditLog = new InMemoryAuditLog();
    const task = createApprovedDeployTask({
      approvalsRepo: { claimNextApprovedChange: vi.fn(async () => claim) },
      deploymentsRepo: { createDispatch, markDispatchFailed: vi.fn() },
      workflowExists: vi.fn(async () => false),
      execute,
      auditLog,
      traceIdProvider: () => "trace-workflow-missing",
    });

    await task.run(new Date("2026-08-09T00:00:00Z"));

    expect(execute).not.toHaveBeenCalled();
    expect(createDispatch).toHaveBeenCalledWith(expect.objectContaining({ state: "dispatch_failed" }));
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("prod_deploy_disabled");
  });

  it("workflow実在確認APIの失敗もdispatchせずconsumed claimをdispatch_failedで終端する", async () => {
    const execute = vi.fn();
    const createDispatch = vi.fn(async () => ({ deployId: "deploy-failed" }));
    const auditLog = new InMemoryAuditLog();
    const task = createApprovedDeployTask({
      approvalsRepo: { claimNextApprovedChange: vi.fn(async () => claim) },
      deploymentsRepo: { createDispatch, markDispatchFailed: vi.fn() },
      workflowExists: vi.fn(async () => {
        throw new Error("GitHub unavailable");
      }),
      execute,
      auditLog,
      traceIdProvider: () => "trace-observation-failure",
    });

    await task.run(new Date("2026-08-09T00:00:00Z"));

    expect(execute).not.toHaveBeenCalled();
    expect(createDispatch).toHaveBeenCalledWith(expect.objectContaining({ state: "dispatch_failed" }));
    expect((await auditLog.readAll()).map((record) => record.action)).toContain(
      "prod_deploy_workflow_observation_failed",
    );
  });

  it.each([
    { ...claim, commitSha: null },
    { ...claim, repositories: [] },
    {
      ...claim,
      repositories: [
        { owner: "a", repo: "one" },
        { owner: "b", repo: "two" },
      ],
    },
  ])("target SHA欠落またはrepo mapping非一意はfail closed: %#", async (invalidClaim) => {
    const execute = vi.fn();
    const auditLog = new InMemoryAuditLog();
    const task = createApprovedDeployTask({
      approvalsRepo: { claimNextApprovedChange: vi.fn(async () => invalidClaim) },
      deploymentsRepo: { createDispatch: vi.fn(), markDispatchFailed: vi.fn() },
      workflowExists: vi.fn(),
      execute,
      auditLog,
      traceIdProvider: () => "trace-invalid-target",
    });
    await task.run(new Date("2026-08-09T00:00:00Z"));
    expect(execute).not.toHaveBeenCalled();
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("prod_deploy_target_invalid");
  });

  it("repo claim queryはapproved changeだけをCAS consumedにする", async () => {
    const queries: string[] = [];
    const db = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [] };
      }),
    };
    const repo = new ApprovalsRepo(db, async (work) => work({ db, auditLog: new InMemoryAuditLog() }));
    await repo.claimNextApprovedChange("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    const sql = queries.join("\n");
    expect(sql).toContain("approval_type = 'change'");
    expect(sql).toContain("status = 'approved'");
    expect(sql).toContain("dispatched_at IS NULL");
    expect(sql).toMatch(/UPDATE approvals[\s\S]+dispatched_at = now\(\)/);
  });

  it("CAS claimと曖昧mappingの件数を同一transactionの監査へ残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const db = {
      query: vi.fn(async () => ({
        rows: [
          {
            approval_id: claim.approvalId,
            project_id: claim.projectId,
            target_sha: claim.commitSha,
            repo_mappings: [
              { owner: "acme", repo: "one" },
              { owner: "acme", repo: "two" },
            ],
          },
        ],
      })),
    };
    const repo = new ApprovalsRepo(db, async (work) => work({ db, auditLog }));

    await expect(repo.claimNextApprovedChange("cccccccc-cccc-4ccc-8ccc-cccccccccccc")).resolves.toMatchObject({
      repositories: [
        { owner: "acme", repo: "one" },
        { owner: "acme", repo: "two" },
      ],
    });
    expect(await auditLog.readAll()).toContainEqual(
      expect.objectContaining({
        action: "approval_dispatch_claim",
        detail: expect.objectContaining({ repositoryMappingCount: 2 }),
      }),
    );
  });
});
