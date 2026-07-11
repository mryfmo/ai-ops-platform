import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import {
  resolveActiveRecipients,
  deliverMemberDailyReport,
  deliverLeaderReport,
  buildAndDeliverManagerReport,
  type RptDependencies,
} from "../src/agents/AGT_RPT.js";
import type { RecipientRecord } from "../src/lib/reportPermissionFilter.js";

const EMAIL_ADDRESS = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;

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
      {
        openPrs: [],
        reviewRequests: [],
        unhandledAlerts: [{ id: "ALERT-1", summary: "BODY-MARKER", severity: "sev2" }],
      },
      "U-010",
      "a@example.com",
      deps,
    );
    expect(mails).toHaveLength(1);
    const logs = await deps.auditLog.readAll();
    expect(logs.some((l) => l.action === "deliver_member_daily")).toBe(true);
    const serialized = JSON.stringify(logs);
    expect(serialized).toContain("U-010");
    expect(serialized).not.toMatch(EMAIL_ADDRESS);
    expect(serialized).not.toMatch(/BODY-MARKER|メンバー日次/);
  });

  it("Graph失敗監査は固定code/statusとrecipient IDだけを残す", async () => {
    const { deps } = makeDeps();
    deps.graphClient.sendMail = async () => {
      throw Object.assign(new Error("E-DLV01: sendMail failed with status 503"), {
        recipientEmail: "a@example.com",
        subject: "SUBJECT-MARKER",
        body: "BODY-MARKER",
        clientState: "SECRET-MARKER",
      });
    };
    let thrown: unknown;
    try {
      await deliverMemberDailyReport(
        common,
        { openPrs: [], reviewRequests: [], unhandledAlerts: [] },
        "U-010",
        "a@example.com",
        deps,
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("E-DLV01: graph_delivery_failed status=503");
    expect("cause" in (thrown as Error)).toBe(false);
    expect(JSON.stringify({ ...(thrown as Error), message: (thrown as Error).message })).not.toMatch(
      /a@example\.com|SUBJECT-MARKER|BODY-MARKER|SECRET-MARKER/,
    );
    const serialized = JSON.stringify(await deps.auditLog.readAll());
    expect(serialized).toContain('"recipientId":"U-010"');
    expect(serialized).toContain('"code":"E-DLV01"');
    expect(serialized).toContain('"status":503');
    expect(serialized).not.toMatch(EMAIL_ADDRESS);
    expect(serialized).not.toMatch(/SUBJECT-MARKER|BODY-MARKER|SECRET-MARKER/);
  });

  it.each(["victim@example.com", "arbitrary unsafe id", "ST-AliceSmith", "U-JaneDoe"])(
    "unsafe recipientId %s は送信・監査前に固定errorで拒否する",
    async (recipientId) => {
      const { deps, mails } = makeDeps();
      await expect(
        deliverMemberDailyReport(
          common,
          { openPrs: [], reviewRequests: [], unhandledAlerts: [] },
          recipientId,
          "a@example.com",
          deps,
        ),
      ).rejects.toThrow("E-DLV03: invalid recipient ID");
      expect(mails).toEqual([]);
      expect(await deps.auditLog.readAll()).toEqual([]);
    },
  );

  it("任意Graph messageはstatus解析にも再throwにも使わない", async () => {
    const { deps } = makeDeps();
    deps.graphClient.sendMail = async () => {
      throw new Error("E-DLV01: sendMail failed with status 503 BODY-MARKER");
    };
    await expect(
      deliverMemberDailyReport(
        common,
        { openPrs: [], reviewRequests: [], unhandledAlerts: [] },
        "U-010",
        "a@example.com",
        deps,
      ),
    ).rejects.toThrow("E-DLV01: graph_delivery_failed status=unknown");
    const serialized = JSON.stringify(await deps.auditLog.readAll());
    expect(serialized).toContain('"status":null');
    expect(serialized).not.toContain("BODY-MARKER");
  });

  it("UUID recipientIdも非PII追跡IDとして受け入れる", async () => {
    const { deps } = makeDeps();
    const recipientId = "550e8400-e29b-41d4-a716-446655440000";
    await deliverMemberDailyReport(
      common,
      { openPrs: [], reviewRequests: [], unhandledAlerts: [] },
      recipientId,
      "a@example.com",
      deps,
    );
    expect(JSON.stringify(await deps.auditLog.readAll())).toContain(recipientId);
  });
});

describe("deliverLeaderReport [REQ-022]", () => {
  it("監査はproject/recipient IDで追跡でき、宛先や本文を含まない", async () => {
    const { deps } = makeDeps();
    await deliverLeaderReport(
      common,
      {
        ciSuccessRatePct: 100,
        failedWorkflows: ["BODY-MARKER"],
        deploymentsByEnv: { dev: 1, staging: 1, prod: 1 },
        openIncidentsBySeverity: { sev1: 0, sev2: 0, sev3: 0, sev4: 0 },
        pendingApprovals: [],
        staleTaskCounts: [],
      },
      "PRJ-001",
      "週次",
      "U-020",
      "leader@example.com",
      deps,
    );
    const serialized = JSON.stringify(await deps.auditLog.readAll());
    expect(serialized).toContain('"recipientId":"U-020"');
    expect(serialized).toContain('"projectId":"PRJ-001"');
    expect(serialized).not.toMatch(EMAIL_ADDRESS);
    expect(serialized).not.toMatch(/BODY-MARKER|リーダー週次/);
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
      "U-030",
      "manager@example.com",
      deps,
    );
    expect(mails).toHaveLength(1);
    const logs = await deps.auditLog.readAll();
    const record = logs.find((l) => l.action === "deliver_manager");
    const detail = record?.detail as { projectCount: number };
    expect(detail.projectCount).toBe(1);
    expect(detail).toMatchObject({ recipientId: "U-030" });
    expect(JSON.stringify(logs)).not.toMatch(EMAIL_ADDRESS);
    expect(JSON.stringify(logs)).not.toContain("マネージャー週次");
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
      "U-030",
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
