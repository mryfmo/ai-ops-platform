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
    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT 1"), ["acme", "widget", "a".repeat(40)]);
    expect(query.mock.calls[0]![0]).toContain("state = 'monitoring'");
  });
});
