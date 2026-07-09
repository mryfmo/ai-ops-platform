import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import {
  resolveActiveRecipients,
  deliverMemberDailyReport,
  buildAndDeliverManagerReport,
  type RptDependencies,
} from "../src/agents/AGT_RPT.js";
import type { RecipientRecord } from "../src/lib/reportPermissionFilter.js";

function makeDeps(): { deps: RptDependencies; mails: Array<{ to: string; subject: string }> } {
  const mails: Array<{ to: string; subject: string }> = [];
  const deps: RptDependencies = {
    graphClient: {
      sendMail: async (input) => {
        mails.push({ to: input.toEmail, subject: input.subject });
      },
    },
    auditLog: new InMemoryAuditLog(),
    traceId: "trace-1",
    fromMailbox: "devops-system@example.com",
  };
  return { deps, mails };
}

const common = {
  periodLabel: "2026-07-06",
  generatedAtLabel: "2026-07-06 09:00 JST",
  contactLine: "support@example.com",
  dateJst: "2026-07-06",
};

describe("resolveActiveRecipients [REQ-024 AC-024a]", () => {
  const recipients: RecipientRecord[] = [
    { userId: "U-010", profile: "PRF-M", email: "a@example.com", active: true },
    { userId: "U-020", profile: "PRF-M", email: "b@example.com", active: false },
  ];
  it("非activeな宛先を除外する", () => {
    expect(resolveActiveRecipients(recipients, ["U-010", "U-020", "U-999"])).toEqual(["U-010"]);
  });
});

describe("deliverMemberDailyReport", () => {
  it("メール送信され監査ログに記録される", async () => {
    const { deps, mails } = makeDeps();
    await deliverMemberDailyReport(
      common,
      { openPrs: [], reviewRequests: [], unhandledAlerts: [] },
      "a@example.com",
      deps,
    );
    expect(mails).toHaveLength(1);
    const logs = await deps.auditLog.readAll();
    expect(logs.some((l) => l.action === "deliver_member_daily")).toBe(true);
  });
});

describe("buildAndDeliverManagerReport [AC-023a/b]", () => {
  it("DORA指標を計算し配信する", async () => {
    const { deps, mails } = makeDeps();
    const deployments = [
      {
        projectId: "PRJ-001",
        commitAt: "2026-07-01T00:00:00Z",
        deployedAt: "2026-07-01T05:00:00Z",
        causedFailure: false,
      },
    ];
    await buildAndDeliverManagerReport(
      common,
      deployments,
      [],
      7,
      [{ projectId: "PRJ-001", changeFailureRatePct: 10, openSev2Count: 0 }],
      [],
      0,
      "週次",
      "manager@example.com",
      deps,
    );
    expect(mails).toHaveLength(1);
    const logs = await deps.auditLog.readAll();
    const record = logs.find((l) => l.action === "deliver_manager");
    const detail = record?.detail as { projectCount: number };
    expect(detail.projectCount).toBe(1);
  });

  it("codingTaskActivityを渡すとメール送信が成功する（ADR-0006 4b: 後方互換のoptional引数）", async () => {
    const { deps, mails } = makeDeps();
    const deployments = [
      {
        projectId: "PRJ-001",
        commitAt: "2026-07-01T00:00:00Z",
        deployedAt: "2026-07-01T05:00:00Z",
        causedFailure: false,
      },
    ];
    await buildAndDeliverManagerReport(
      common,
      deployments,
      [],
      7,
      [{ projectId: "PRJ-001", changeFailureRatePct: 10, openSev2Count: 0 }],
      [],
      0,
      "週次",
      "manager@example.com",
      deps,
      undefined,
      {
        countsByStatus: { queued: 0, running: 0, pr_created: 2, failed: 1, cancelled: 0 },
        totalCount: 3,
        completionSuccessRatePct: (2 / 3) * 100,
        recentPullRequests: [],
      },
    );
    expect(mails).toHaveLength(1);
  });
});
