import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import { InMemoryDeliveryLogStore } from "../src/lib/idempotentDelivery.js";
import {
  runDistributionCycle,
  distributeOne,
  sendProgressReportRequests,
  type DeliveryTarget,
  type DistributorDependencies,
} from "../src/agents/AGT05_distributor.js";

interface TestHarness {
  deps: DistributorDependencies;
  sentMails: Array<{ to: string; subject: string }>;
  cardCounter: { count: number };
}

function makeDeps(): TestHarness {
  const sentMails: Array<{ to: string; subject: string }> = [];
  const cardCounter = { count: 0 };
  const deps: DistributorDependencies = {
    graphClient: {
      sendMail: async (input) => {
        sentMails.push({ to: input.toEmail, subject: input.subject });
      },
      sendAdaptiveCard: async () => {
        cardCounter.count += 1;
        return { messageId: "m1" };
      },
    },
    deliveryLogStore: new InMemoryDeliveryLogStore(),
    auditLog: new InMemoryAuditLog(),
    traceId: "trace-1",
    fromMailbox: "prjops-system@example.com",
  };
  return { deps, sentMails, cardCounter };
}

const baseTarget: DeliveryTarget = {
  reportId: "RPT-PRF-02-PJ-001-2026-W27-ST-010",
  recipientId: "ST-010",
  recipientEmail: "pm@example.com",
  subject: "【週次レポート】サンプル案件",
  html: "<html></html>",
  postTeamsSummaryCard: true,
  teamsTarget: { teamId: "team-1", channelId: "chan-1" },
};

describe("distributeOne [REQ-018, SPEC-INT-052]", () => {
  it("初回配信は送信され、監査ログに記録される", async () => {
    const { deps, sentMails } = makeDeps();
    const outcome = await distributeOne(baseTarget, deps);
    expect(outcome).toBe("sent");
    expect(sentMails).toHaveLength(1);
    const logs = await deps.auditLog.readAll();
    expect(logs.some((l) => l.action === "deliver")).toBe(true);
  });

  it("同一レポート・同一受信者への再配信はスキップされる（AC-018-2: 重複配信防止）", async () => {
    const { deps, sentMails } = makeDeps();
    await distributeOne(baseTarget, deps);
    const outcome2 = await distributeOne(baseTarget, deps);
    expect(outcome2).toBe("skipped");
    expect(sentMails).toHaveLength(1);
  });

  it("送信済みだがsent確定前のpendingログが残る再試行は件名に再送を明示する", async () => {
    const { deps, sentMails } = makeDeps();
    await deps.deliveryLogStore.record({
      reportId: baseTarget.reportId,
      recipientId: baseTarget.recipientId,
      deliveredAt: "2026-07-09T00:00:00.000Z",
      status: "pending",
    } as Parameters<typeof deps.deliveryLogStore.record>[0]);
    const outcome = await distributeOne(baseTarget, deps);
    expect(outcome).toBe("sent");
    expect(sentMails[0]?.subject).toContain("(再送)");
  });

  it("PRF-02/03向けはTeamsへの要約カードも投稿される", async () => {
    const { deps, cardCounter } = makeDeps();
    await distributeOne(baseTarget, deps);
    expect(cardCounter.count).toBe(1);
  });

  it("メール成功後のカード失敗は部分失敗として伝播し、次回カードだけ再試行する", async () => {
    const sentMails: Array<{ subject: string }> = [];
    let cardCalls = 0;
    const deps: DistributorDependencies = {
      graphClient: {
        sendMail: async (input) => {
          sentMails.push({ subject: input.subject });
        },
        sendAdaptiveCard: async () => {
          cardCalls += 1;
          if (cardCalls === 1) throw new Error("card down");
          return { messageId: "card-2" };
        },
      },
      deliveryLogStore: new InMemoryDeliveryLogStore(),
      auditLog: new InMemoryAuditLog(),
      traceId: "trace-card",
      fromMailbox: "prjops-system@example.com",
    };

    await expect(distributeOne(baseTarget, deps)).rejects.toThrow("card down");
    await expect(distributeOne(baseTarget, deps)).resolves.toBe("sent");
    expect(sentMails).toHaveLength(1);
    expect(cardCalls).toBe(2);
    expect((await deps.auditLog.readAll()).some((record) => record.action === "deliver_card_failed")).toBe(true);
  });

  it("postTeamsSummaryCard=falseならカードは投稿されない", async () => {
    const { deps, cardCounter } = makeDeps();
    await distributeOne({ ...baseTarget, postTeamsSummaryCard: false }, deps);
    expect(cardCounter.count).toBe(0);
  });
});

describe("runDistributionCycle [AC-018-1]", () => {
  it("複数受信者に対して送信結果を集計する", async () => {
    const { deps } = makeDeps();
    const targets: DeliveryTarget[] = [
      { ...baseTarget, recipientId: "ST-010", recipientEmail: "a@example.com" },
      { ...baseTarget, recipientId: "ST-020", recipientEmail: "b@example.com" },
    ];
    const result = await runDistributionCycle(targets, deps);
    expect(result.sent).toEqual(["ST-010", "ST-020"]);
    expect(result.failed).toHaveLength(0);
  });

  it("同一サイクル内で同一reportId+recipientIdが重複していてもスキップされる", async () => {
    const { deps } = makeDeps();
    const targets: DeliveryTarget[] = [baseTarget, baseTarget];
    const result = await runDistributionCycle(targets, deps);
    expect(result.sent).toEqual(["ST-010"]);
    expect(result.skipped).toEqual(["ST-010"]);
  });
});

describe("sendProgressReportRequests [REQ-003, SPEC-EXT-010/030]", () => {
  it("日本語件名フォーマットで送信される", async () => {
    const { deps, sentMails } = makeDeps();
    await sendProgressReportRequests(
      [
        {
          projectId: "PJ-001",
          projectName: "サンプル案件",
          weekLabel: "2026-07-06",
          recipientEmail: "pm@example.com",
          lang: "ja",
          previousSummary3Lines: "前回は順調でした。",
        },
      ],
      deps,
    );
    expect(sentMails[0]?.subject).toBe("【進捗報告依頼】サンプル案件 (PJ-001) 2026-07-06週");
  });

  it("英語件名フォーマットで送信される", async () => {
    const { deps, sentMails } = makeDeps();
    await sendProgressReportRequests(
      [
        {
          projectId: "PJ-002",
          projectName: "Overseas Project",
          weekLabel: "2026-07-06",
          recipientEmail: "pm@example.com",
          lang: "en",
          previousSummary3Lines: "On track.",
        },
      ],
      deps,
    );
    expect(sentMails[0]?.subject).toBe("[Status Request] Overseas Project (PJ-002) week of 2026-07-06");
  });
});
