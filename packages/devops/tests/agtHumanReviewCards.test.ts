/**
 * packages/devops/tests/agtHumanReviewCards.test.ts
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-015 / AC-015c（Graphカードの人間レビュー導線）
 */
import { describe, expect, it } from "vitest";
import { InMemoryAuditLog, buildHolidayCalendar } from "@aiops/shared";
import type { AdaptiveCardPayload } from "@aiops/shared/clients/graphClient.js";
import { sendApprovalCard, type ChgDependencies } from "../src/agents/AGT_CHG.js";
import { triageAndNotify, type IncDependencies } from "../src/agents/AGT_INC.js";

const channel = { teamId: "team-1", channelId: "channel-1" };

function approvalPackage(decisionUrl: string) {
  return {
    projectName: "Sample",
    diffSummaryLines: ["one change"],
    testSummary: { successCount: 1, failureCount: 0, coveragePct: 90 },
    riskScore: { score: 10, factors: { A: 0, B: 0, C: 0, D: 0, E: 0 }, isHighRisk: false },
    rollbackSummary: "deploy previous version",
    approvalDeadlineLabel: "2026-07-11 18:00",
    decisionUrl,
  };
}

describe("sendApprovalCard [DevOps:SPEC-EXT-010]", () => {
  it("reviewed decision URLを唯一のOpenUrl actionとして送る", async () => {
    const cards: AdaptiveCardPayload[] = [];
    const deps: ChgDependencies = {
      llmClient: {} as ChgDependencies["llmClient"],
      graphClient: {
        sendAdaptiveCard: async (input) => {
          cards.push(input.card);
          return { messageId: "card-1" };
        },
        sendMail: async () => {},
      },
      auditLog: new InMemoryAuditLog(),
      traceId: "trace-1",
      cal: buildHolidayCalendar([]),
    };
    await sendApprovalCard(approvalPackage("https://example.test/decisions/release-1"), channel, deps);
    expect(cards[0]!.actions).toEqual([]);
    expect(cards[0]!.openUrlActions).toEqual([
      { title: "承認判断を開く", url: "https://example.test/decisions/release-1" },
    ]);
  });

  it.each([undefined, "", "   "])("missing/blank decision URLはGraph送信前に拒否する: %s", async (decisionUrl) => {
    let sent = false;
    const deps = {
      llmClient: {} as ChgDependencies["llmClient"],
      graphClient: {
        sendAdaptiveCard: async () => {
          sent = true;
          return { messageId: "unexpected" };
        },
        sendMail: async () => {},
      },
      auditLog: new InMemoryAuditLog(),
      traceId: "trace-2",
      cal: buildHolidayCalendar([]),
    } satisfies ChgDependencies;
    await expect(sendApprovalCard(approvalPackage(decisionUrl as unknown as string), channel, deps)).rejects.toThrow(
      /decision URL/i,
    );
    expect(sent).toBe(false);
  });

  it.each(["http://example.test/review", "javascript:alert(1)", "data:text/plain,unsafe"])(
    "non-HTTPS decision URLはGraph送信前に拒否する: %s",
    async (decisionUrl) => {
      let sent = false;
      const deps = {
        llmClient: {} as ChgDependencies["llmClient"],
        graphClient: {
          sendAdaptiveCard: async () => {
            sent = true;
            return { messageId: "unexpected" };
          },
          sendMail: async () => {},
        },
        auditLog: new InMemoryAuditLog(),
        traceId: "trace-unsafe",
        cal: buildHolidayCalendar([]),
      } satisfies ChgDependencies;
      await expect(sendApprovalCard(approvalPackage(decisionUrl), channel, deps)).rejects.toThrow(/decision URL/i);
      expect(sent).toBe(false);
    },
  );
});

describe("triageAndNotify [DevOps:REQ-015 AC-015c]", () => {
  it("Sev1候補は作成済みIssue URLを人間レビューOpenUrlに使う", async () => {
    const cards: AdaptiveCardPayload[] = [];
    const issueUrl = "https://github.com/acme/repo/issues/7";
    const deps: IncDependencies = {
      llmClient: {} as IncDependencies["llmClient"],
      githubClient: { createIssue: async () => ({ number: 7, htmlUrl: issueUrl }) },
      graphClient: {
        sendAdaptiveCard: async (input) => {
          cards.push(input.card);
          return { messageId: "card-2" };
        },
      },
      auditLog: new InMemoryAuditLog(),
      traceId: "trace-3",
    };
    await triageAndNotify(
      { severity_candidate: "sev1", affected_projects: ["PJ-1"], rationale: "production unavailable" },
      "acme",
      "repo",
      channel,
      deps,
    );
    expect(cards[0]!.actions).toEqual([]);
    expect(cards[0]!.openUrlActions).toEqual([{ title: "GitHub Issueで確認", url: issueUrl }]);
  });

  it.each(["", "http://github.example/issues/7", "javascript:alert(1)"])(
    "不正Issue URLではGraph送信せずfail closedする: %s",
    async (issueUrl) => {
      let sent = false;
      const deps: IncDependencies = {
        llmClient: {} as IncDependencies["llmClient"],
        githubClient: { createIssue: async () => ({ number: 7, htmlUrl: issueUrl }) },
        graphClient: {
          sendAdaptiveCard: async () => {
            sent = true;
            return { messageId: "unexpected" };
          },
        },
        auditLog: new InMemoryAuditLog(),
        traceId: "trace-invalid-issue",
      };
      await expect(
        triageAndNotify(
          { severity_candidate: "sev1", affected_projects: ["PJ-1"], rationale: "production unavailable" },
          "acme",
          "repo",
          channel,
          deps,
        ),
      ).rejects.toThrow(/issue URL/i);
      expect(sent).toBe(false);
    },
  );
});
