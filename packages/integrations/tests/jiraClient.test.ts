// 根拠: 添付TEXT「Jira・GitHub・ai-ops-platform構成」
import { describe, expect, it, vi } from "vitest";
import { JiraRestClient, computeJiraFieldHash } from "../src/index.js";

const BASELINE = {
  updated: "2026-08-28T02:00:00.000Z",
  statusId: "10001",
  fieldHash: await computeJiraFieldHash({ assigneeAccountId: "acct-1", sprintId: "88" }),
};

function issue(key: string, statusId = "10001") {
  return {
    key,
    fields: {
      project: { id: "10000" },
      status: { id: statusId },
      assignee: { accountId: "acct-1" },
      updated: "2026-08-28T02:00:00.000Z",
      customfield_10020: [{ id: 88 }],
    },
  };
}

function client(fetchImpl: typeof fetch) {
  return new JiraRestClient({
    fetchImpl,
    tokenProvider: { getAccessToken: async () => "token" },
    siteBaseUrl: "https://example.atlassian.net",
    allowedStatusIds: ["10001", "10002"],
    protectedStatusIds: ["10002"],
    sprintFieldId: "customfield_10020",
  });
}

describe("JiraRestClient", () => {
  it("hashes field metadata canonically", async () => {
    await expect(
      computeJiraFieldHash({ additionalFields: { b: 2, a: 1 }, assigneeAccountId: null, sprintId: null }),
    ).resolves.toBe(
      await computeJiraFieldHash({ additionalFields: { a: 1, b: 2 }, assigneeAccountId: null, sprintId: null }),
    );
  });

  it("rejects unknown statuses fail-closed", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(issue("AICOE-1", "99999")), { status: 200 }));
    await expect(client(fetchImpl).readIssueMetadata("AICOE-1")).rejects.toThrow(/allowlist/);
  });

  it("captures every JQL page and rejects duplicate issues", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ issues: [issue("AICOE-1")], nextPageToken: "p2" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ issues: [issue("AICOE-2")], isLast: true }), { status: 200 }),
      );
    const snapshot = await client(fetchImpl).captureJqlSnapshot("project = AICOE", new Date("2026-08-28T03:00:00Z"));
    expect(snapshot).toMatchObject({ captureComplete: true, pageCount: 2 });
    expect(snapshot.issues.map((item) => item.issueKey)).toEqual(["AICOE-1", "AICOE-2"]);

    const duplicateFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ issues: [issue("AICOE-1")], nextPageToken: "p2" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ issues: [issue("AICOE-1")], isLast: true }), { status: 200 }),
      );
    await expect(client(duplicateFetch).captureJqlSnapshot("project = AICOE")).rejects.toThrow(/duplicate issue/);
  });

  it("rejects a JQL page unless isLast is true or a valid continuation token exists", async () => {
    for (const body of [{ issues: [] }, { issues: [], isLast: false }, { issues: [], nextPageToken: "" }]) {
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
      await expect(client(fetchImpl).captureJqlSnapshot("project = AICOE")).rejects.toThrow(/E-JIRA-MALFORMED/);
    }
  });

  it("does not POST a transition when baseline is stale", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(issue("AICOE-1", "10002")), { status: 200 }));
    const result = await client(fetchImpl).transitionIssue({
      issueKey: "AICOE-1",
      transitionId: "31",
      targetStatusId: "10002",
      expectedBaseline: BASELINE,
      approvalId: "9c6d3a1f-18cb-4b40-8ccd-66224aa2ab52",
    });
    expect(result.result).toBe("stale");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("accepts empty 204 for one-shot transition and development projection", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(issue("AICOE-1")), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const jira = client(fetchImpl);
    await expect(
      jira.transitionIssue({
        issueKey: "AICOE-1",
        transitionId: "31",
        targetStatusId: "10002",
        expectedBaseline: BASELINE,
        approvalId: "9c6d3a1f-18cb-4b40-8ccd-66224aa2ab52",
      }),
    ).resolves.toMatchObject({ result: "transitioned" });
    await expect(
      jira.projectDevelopmentInformation({
        cloudId: "9c6d3a1f-18cb-4b40-8ccd-66224aa2ab52",
        idempotencyKey: "key-1",
        payload: { repositories: [] },
      }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
