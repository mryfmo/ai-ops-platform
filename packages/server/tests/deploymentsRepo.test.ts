/**
 * packages/server/tests/deploymentsRepo.test.ts
 *
 * 根拠: DevOps:SPEC-INT-020 / DevOps:REQ-010 / DevOps:REQ-012。
 */
import { describe, expect, it, vi } from "vitest";
import { DeploymentsRepo } from "../src/db/deploymentsRepo.js";

describe("DeploymentsRepo dispatch state [DevOps:SPEC-INT-020]", () => {
  const deployId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  it("owner/repo/commit provenanceとdispatch_failedを永続化する", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO deployments")) return { rows: [{ deploy_id: deployId }] };
      return { rows: [] };
    });
    const repo = new DeploymentsRepo({ query });
    await repo.createDispatch({
      projectId: "PJ-001",
      owner: "acme",
      repo: "widget",
      commitSha: "a".repeat(40),
      state: "dispatch_failed",
      traceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO deployments"), [
      "PJ-001",
      "acme",
      "widget",
      "a".repeat(40),
      "dispatch_failed",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
  });

  it("dispatch例外は同じdeployment rowをdispatch_failedへ遷移する", async () => {
    const query = vi.fn(async () => ({ rows: [{ deploy_id: deployId }] }));
    const repo = new DeploymentsRepo({ query });
    await repo.markDispatchFailed(deployId);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("state = 'dispatch_failed'"), [deployId]);
  });

  it("deploy-prod成功はrepo/commit一致の最古1 rowだけをmonitoringへCAS遷移する", async () => {
    const query = vi.fn(async () => ({ rows: [{ deploy_id: deployId }] }));
    const repo = new DeploymentsRepo({ query });
    await expect(repo.markMonitoring("acme", "widget", "a".repeat(40))).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT 1"), [
      "acme",
      "widget",
      "a".repeat(40),
      "monitoring",
    ]);
  });

  it("deploy-prod失敗はrepo/commit一致の最古1 rowだけをdispatch_failedへCAS遷移する", async () => {
    const query = vi.fn(async () => ({ rows: [{ deploy_id: deployId }] }));
    const repo = new DeploymentsRepo({ query });
    await expect(repo.markWorkflowFailed("acme", "widget", "a".repeat(40))).resolves.toBe(true);
    expect(query.mock.calls[0]![1]).toEqual(["acme", "widget", "a".repeat(40), "dispatch_failed"]);
    expect(query.mock.calls[0]![0]).toContain("LIMIT 1");
  });

  it("approved work itemをbounded取得しdispatchとrollbackをCAS遷移する", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("WHERE state = 'approved'")) {
        return {
          rows: [
            {
              deploy_id: deployId,
              project_id: "PJ-001",
              github_owner: "acme",
              github_repo: "widget",
              commit_sha: "a".repeat(40),
            },
          ],
        };
      }
      if (sql.includes("UPDATE deployments")) {
        const params = query.mock.calls.at(-1)?.[1] as string[];
        return {
          rows: [{ state: params[1] }],
        };
      }
      return { rows: [{ deploy_id: deployId }] };
    });
    const repo = new DeploymentsRepo({ query });
    await expect(repo.findNextApprovedDispatch()).resolves.toMatchObject({ deployId, owner: "acme" });
    await expect(repo.markDispatching(deployId)).resolves.toEqual({
      kind: "created",
      deployId,
      expectedState: "approved",
      observedState: "prod_deploying",
    });
    await expect(repo.markRollingBack(deployId)).resolves.toEqual({
      kind: "created",
      deployId,
      expectedState: "monitoring",
      observedState: "rolling_back",
    });
    await expect(repo.markRolledBack(deployId)).resolves.toEqual({
      kind: "created",
      deployId,
      expectedState: "rolling_back",
      observedState: "rolled_back",
    });
    expect(query.mock.calls.slice(1).map(([, params]) => params)).toEqual([
      [deployId, "prod_deploying", "approved"],
      [deployId, "rolling_back", "monitoring"],
      [deployId, "rolled_back", "rolling_back"],
    ]);
  });

  it("TMP-003: CAS loser は observed DB state を持つ stale receipt になり dispatch authority を得ない", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ state: "prod_deploying" }] });
    const repo = new DeploymentsRepo({ query });
    await expect(repo.markDispatching(deployId)).resolves.toEqual({
      kind: "stale",
      deployId,
      expectedState: "approved",
      observedState: "prod_deploying",
    });
    expect(query.mock.calls[0]![0]).toMatch(/UPDATE deployments[\s\S]+state = \$2[\s\S]+state = \$3/u);
    expect(query.mock.calls[1]).toEqual([expect.stringContaining("SELECT state FROM deployments"), [deployId]]);
  });
});
