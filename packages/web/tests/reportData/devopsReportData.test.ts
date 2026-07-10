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
    subject_id?: string | null;
    action: string | null;
    occurred_at: string;
    normalized: unknown;
  }> = [],
): PgQueryable {
  const query = vi.fn(async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM project_channels")) {
      return { rows: projectIds.map((project_id) => ({ project_id })) };
    }
    if (text.includes("FROM incidents")) {
      return { rows: incidents };
    }
    if (text.includes("FROM deployments")) {
      const [start, end] = params as [string | undefined, string | undefined];
      return {
        rows:
          start && end
            ? deployments.filter((deployment) => deployment.updated_at >= start && deployment.updated_at < end)
            : deployments,
      };
    }
    if (text.includes("FROM pm_events")) {
      return { rows: pmEvents.map((event) => ({ subject_id: event.subject_id ?? null, ...event })) };
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
  });
});

describe("buildDevOpsManagerSummary（DORA 5 + coverage枠）", () => {
  it("DORA5を返し、データ源のないreworkを出さない", async () => {
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
    expect("deploymentReworkRatePct" in result.dora).toBe(false);
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
          subject_id: "I-1",
          action: "closed",
          occurred_at: "2026-01-06T00:00:00Z",
          normalized: {},
        },
        {
          project_id: "PRJ-0001",
          subject_type: "pull_request",
          subject_id: "PR-1",
          action: "closed",
          occurred_at: "2026-01-07T00:00:00Z",
          normalized: { merged: true },
        },
        {
          project_id: "PRJ-0001",
          subject_type: "pull_request",
          subject_id: "PR-2",
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
    expect(result.velocity).toEqual({ issueThroughput: 1, prThroughput: 1 });
  });

  it("throughputはsubject_idで二重closeを排除しnot_planned issueを除外する", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [],
      [],
      [
        {
          project_id: "PRJ-0001",
          subject_type: "issue",
          subject_id: "I-1",
          action: "closed",
          occurred_at: "2026-01-06T00:00:00Z",
          normalized: {},
        },
        {
          project_id: "PRJ-0001",
          subject_type: "issue",
          subject_id: "I-1",
          action: "closed",
          occurred_at: "2026-01-07T00:00:00Z",
          normalized: {},
        },
        {
          project_id: "PRJ-0001",
          subject_type: "issue",
          subject_id: "I-2",
          action: "closed",
          occurred_at: "2026-01-07T00:00:00Z",
          normalized: { state_reason: "not_planned" },
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
    expect(result.velocity.issueThroughput).toBe(1);
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

  it("窓外の古いデプロイをDORA集計へ混入しない", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [],
      [
        {
          project_id: "PRJ-0001",
          created_at: "2025-12-01T00:00:00Z",
          updated_at: "2025-12-01T12:00:00Z",
          state: "rolled_back",
        },
        {
          project_id: "PRJ-0001",
          created_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T12:00:00Z",
          state: "stable",
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
    expect(result.dora.changeFailureRatePct).toBe(0);
  });

  it("古いrollbackは後続incidentを変更起因にしない", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [
        {
          detected_at: "2026-01-04T12:00:00Z",
          resolved_at: "2026-01-04T14:00:00Z",
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
    expect(result.dora.failedDeploymentRecoveryTimeHours).toBeNull();
  });

  it("期間開始直前24h内のrollbackはincident因果判定に使うがCFR分母には混ぜない", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [
        {
          detected_at: "2026-01-01T06:00:00Z",
          resolved_at: "2026-01-01T08:00:00Z",
          affected_projects: ["PRJ-0001"],
        },
      ],
      [
        {
          project_id: "PRJ-0001",
          created_at: "2025-12-31T00:00:00Z",
          updated_at: "2025-12-31T18:00:00Z",
          state: "rolled_back",
        },
        {
          project_id: "PRJ-0001",
          created_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T12:00:00Z",
          state: "stable",
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
    expect(result.dora.changeFailureRatePct).toBe(0);
  });

  it("期間外検知incidentをfailed deployment recovery timeへ混入しない", async () => {
    const db = fakeDb(
      ["PRJ-0001"],
      [
        {
          detected_at: "2026-01-08T06:00:00Z",
          resolved_at: "2026-01-08T08:00:00Z",
          affected_projects: ["PRJ-0001"],
        },
      ],
      [
        {
          project_id: "PRJ-0001",
          created_at: "2026-01-07T00:00:00Z",
          updated_at: "2026-01-07T12:00:00Z",
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
    expect(result.dora.failedDeploymentRecoveryTimeHours).toBeNull();
  });

  it("横断CFRはサービス別率の中央値でなくデプロイ件数で加重したプール算出", async () => {
    const deployments = [
      {
        project_id: "A",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T01:00:00Z",
        state: "rolled_back",
      },
      ...Array.from({ length: 100 }, (_, i) => ({
        project_id: "B",
        created_at: `2026-01-02T${String(i % 24).padStart(2, "0")}:00:00Z`,
        updated_at: `2026-01-02T${String(i % 24).padStart(2, "0")}:30:00Z`,
        state: i === 0 ? "rolled_back" : "stable",
      })),
    ];
    const db = fakeDb(["A", "B"], [], deployments);
    const result = await buildDevOpsManagerSummary(
      db,
      "PRF-G",
      { recipientUserId: "U9", recipientAssignedProjectIds: [] },
      "2026-01-01",
      "2026-01-08",
    );
    expect(result.dora.changeFailureRatePct).toBeCloseTo((2 / 101) * 100);
  });

  it("multi-project incidentはプールrecovery中央値へincident単位で1回だけ寄与する", async () => {
    const db = fakeDb(
      ["A", "B", "C"],
      [
        {
          detected_at: "2026-01-01T02:00:00Z",
          resolved_at: "2026-01-01T04:00:00Z",
          affected_projects: ["A", "B", "C"],
        },
        {
          detected_at: "2026-01-02T02:00:00Z",
          resolved_at: "2026-01-06T06:00:00Z",
          affected_projects: ["A"],
        },
      ],
      [
        {
          project_id: "A",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T01:00:00Z",
          state: "rolled_back",
        },
        {
          project_id: "B",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T01:00:00Z",
          state: "rolled_back",
        },
        {
          project_id: "C",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T01:00:00Z",
          state: "rolled_back",
        },
        {
          project_id: "A",
          created_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T01:00:00Z",
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
    expect(result.dora.failedDeploymentRecoveryTimeHours).toBe(51);
    expect(result.doraByProject.find((row) => row.projectId === "B")?.dora.failedDeploymentRecoveryTimeHours).toBe(2);
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
