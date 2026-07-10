/**
 * packages/web/tests/reportData/devopsReportData.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。CLAUDE.md設計原則6（権限フィルタはデータ取得側で強制）の
 *   検証: モックPgQueryableにスコープ外プロジェクトのincidentsを含めても、
 *   buildDevOpsManagerSummary/listDevOpsScopedProjectSummariesの結果に
 *   スコープ外データが一切漏れないことを確認する。
 */
import { describe, it, expect, vi } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import type { DevOpsVisibilityContext } from "@aiops/devops";
import {
  buildDevOpsManagerSummary,
  listDevOpsScopedProjectSummaries,
} from "../../src/server/reportData/devopsReportData";

function fakeDb(
  projectIds: string[],
  incidents: Array<{ detected_at: string; resolved_at: string | null; affected_projects: string[] }>,
  deployments: Array<{ project_id: string; created_at: string; updated_at: string; state: string }> = [],
  pmEvents: Array<{
    project_id: string | null;
    subject_type: string;
    action: string | null;
    occurred_at: string;
    normalized: unknown;
  }> = [],
): PgQueryable {
  const query = vi.fn(async (text: string) => {
    if (text.includes("FROM project_channels")) {
      return { rows: projectIds.map((project_id) => ({ project_id })) };
    }
    if (text.includes("FROM incidents")) {
      return { rows: incidents };
    }
    if (text.includes("FROM deployments")) {
      return { rows: deployments };
    }
    if (text.includes("FROM pm_events")) {
      return { rows: pmEvents };
    }
    throw new Error(`unexpected query: ${text}`);
  });
  return { query };
}

// PRF-L: 担当プロジェクトのみが対象範囲（PRJ-0002は担当外）
const leaderCtx: DevOpsVisibilityContext = {
  recipientUserId: "U1",
  recipientAssignedProjectIds: ["PRJ-0001"],
};

describe("buildDevOpsManagerSummary（PRF-G: 全プロジェクト横断）", () => {
  it("PRF-Gは全プロジェクトが対象範囲になる", async () => {
    const db = fakeDb(
      ["PRJ-0001", "PRJ-0002"],
      [
        { detected_at: "2026-01-05T00:00:00Z", resolved_at: null, affected_projects: ["PRJ-0001"] },
        { detected_at: "2026-01-06T00:00:00Z", resolved_at: "2026-01-07T00:00:00Z", affected_projects: ["PRJ-0002"] },
      ],
    );
    const gCtx: DevOpsVisibilityContext = { recipientUserId: "U9", recipientAssignedProjectIds: [] };
    const result = await buildDevOpsManagerSummary(db, "PRF-G", gCtx, "2026-01-01", "2026-01-15");
    expect(result.totalProjectCount).toBe(2);
    expect(result.totalTicketCount).toBe(2);
    expect(result.remainingTicketCount).toBe(1);
    expect(result.dora.deploymentReworkRatePct).toBeNull();
  });
});

describe("buildDevOpsManagerSummary（DORA 5 + coverage枠）", () => {
  it("deployment rework rateを含むDORA5を返す", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [],
      [
        {
          project_id: "PRJ-0001",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T12:00:00Z",
          state: "rolled_back",
        },
      ],
    );
    const result = await buildDevOpsManagerSummary(
      db,
      "PRF-G",
      { recipientUserId: "U9", recipientAssignedProjectIds: [] },
      "2026-01-01",
      "2026-01-08",
    );
    expect(result.dora.deploymentReworkRatePct).toBe(0);
    expect(result.dora.changeFailureRatePct).toBe(100);
    expect(result.coveragePct).toBeNull();
    expect(result.doraByProject[0]?.projectId).toBe("PRJ-0001");
  });

  it("throughputはclosed issueとmerged PR由来で、incident流入数を混入しない", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [
        { detected_at: "2026-01-05T00:00:00Z", resolved_at: null, affected_projects: ["PRJ-0001"] },
        { detected_at: "2026-01-06T00:00:00Z", resolved_at: null, affected_projects: ["PRJ-0001"] },
      ],
      [],
      [
        {
          project_id: "PRJ-0001",
          subject_type: "issue",
          action: "closed",
          occurred_at: "2026-01-06T00:00:00Z",
          normalized: {},
        },
        {
          project_id: "PRJ-0001",
          subject_type: "pull_request",
          action: "closed",
          occurred_at: "2026-01-07T00:00:00Z",
          normalized: { merged: true },
        },
        {
          project_id: "PRJ-0001",
          subject_type: "pull_request",
          action: "closed",
          occurred_at: "2026-01-07T00:00:00Z",
          normalized: { merged: false },
        },
      ],
    );
    const result = await buildDevOpsManagerSummary(
      db,
      "PRF-G",
      { recipientUserId: "U9", recipientAssignedProjectIds: [] },
      "2026-01-01",
      "2026-01-08",
    );
    expect(result.totalTicketCount).toBe(2);
    expect(result.velocity).toMatchObject({ issueThroughput: 1, prThroughput: 1, wipCount: 2 });
  });

  it("未解決incidentはfailed deployment recovery timeへ0時間として混入しない", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [
        {
          detected_at: "2026-01-01T13:00:00Z",
          resolved_at: null,
          affected_projects: ["PRJ-0001"],
        },
        {
          detected_at: "2026-01-01T13:00:00Z",
          resolved_at: "2026-01-01T15:00:00Z",
          affected_projects: ["PRJ-0001"],
        },
      ],
      [
        {
          project_id: "PRJ-0001",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T12:00:00Z",
          state: "rolled_back",
        },
      ],
    );
    const result = await buildDevOpsManagerSummary(
      db,
      "PRF-G",
      { recipientUserId: "U9", recipientAssignedProjectIds: [] },
      "2026-01-01",
      "2026-01-08",
    );
    expect(result.dora.failedDeploymentRecoveryTimeHours).toBe(2);
  });
});

describe("buildDevOpsManagerSummary（PRF-L: 権限フィルタ適用確認）", () => {
  it("担当外プロジェクト（PRJ-0002）のincidentsがチケット数・バーンダウンに混入しない", async () => {
    const db = fakeDb(
      ["PRJ-0001", "PRJ-0002"],
      [
        { detected_at: "2026-01-05T00:00:00Z", resolved_at: null, affected_projects: ["PRJ-0001"] },
        { detected_at: "2026-01-06T00:00:00Z", resolved_at: null, affected_projects: ["PRJ-0002"] },
      ],
    );
    const result = await buildDevOpsManagerSummary(db, "PRF-L", leaderCtx, "2026-01-01", "2026-01-15");
    expect(result.totalProjectCount).toBe(1);
    expect(result.projectIds).toEqual(["PRJ-0001"]);
    expect(result.totalTicketCount).toBe(1);
    expect(result.remainingTicketCount).toBe(1);
  });

  it("複数プロジェクトに跨るincidentでも、スコープ内プロジェクトを1つでも含めば計上する", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [{ detected_at: "2026-01-05T00:00:00Z", resolved_at: null, affected_projects: ["PRJ-0001", "PRJ-0099"] }],
    );
    const result = await buildDevOpsManagerSummary(db, "PRF-L", leaderCtx, "2026-01-01", "2026-01-15");
    expect(result.totalTicketCount).toBe(1);
  });
});

describe("listDevOpsScopedProjectSummaries（全ペルソナ共通: id/nameのみ）", () => {
  it("スコープ内プロジェクトのidをid/name双方に用いて返す", async () => {
    const db = fakeDb(["PRJ-0001", "PRJ-0002"], []);
    const result = await listDevOpsScopedProjectSummaries(db, "PRF-L", leaderCtx);
    expect(result).toEqual([{ id: "PRJ-0001", name: "PRJ-0001" }]);
  });

  it("該当プロジェクトが無い場合は空配列を返す", async () => {
    const db = fakeDb(["PRJ-0002"], []);
    const result = await listDevOpsScopedProjectSummaries(db, "PRF-L", leaderCtx);
    expect(result).toEqual([]);
  });
});
