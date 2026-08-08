import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyGithubWebhookSignature, GitHubClient, type GhFetchLike } from "../src/clients/githubClient.js";

describe("verifyGithubWebhookSignature [DevOps:SPEC-INT-061 セキュリティ対策]", () => {
  const secret = "test-webhook-secret";
  const payload = JSON.stringify({ action: "completed", workflow_run: { conclusion: "failure" } });

  function sign(body: string, s: string): string {
    return "sha256=" + createHmac("sha256", s).update(body, "utf8").digest("hex");
  }

  it("正しい署名は検証成功する", () => {
    const sig = sign(payload, secret);
    expect(verifyGithubWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it("誤った署名は検証失敗する", () => {
    const wrongSig = sign(payload, "wrong-secret");
    expect(verifyGithubWebhookSignature(payload, wrongSig, secret)).toBe(false);
  });

  it("ペイロード改ざん時は検証失敗する", () => {
    const sig = sign(payload, secret);
    const tampered = payload.replace("failure", "success");
    expect(verifyGithubWebhookSignature(tampered, sig, secret)).toBe(false);
  });

  it("署名ヘッダがない場合はfalse", () => {
    expect(verifyGithubWebhookSignature(payload, null, secret)).toBe(false);
  });

  it("sha256=接頭辞がない場合はfalse", () => {
    expect(verifyGithubWebhookSignature(payload, "deadbeef", secret)).toBe(false);
  });
});

describe("GitHubClient [DevOps:SPEC-INT-061, REQ-025/033]", () => {
  function makeFakeFetch(responses: Array<{ status: number; body?: unknown }>): {
    fetch: GhFetchLike;
    calls: Array<{ url: string; init?: RequestInit }>;
  } {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let i = 0;
    const fetchImpl: GhFetchLike = async (url, init) => {
      calls.push({ url, init });
      const r = responses[Math.min(i, responses.length - 1)]!;
      i += 1;
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
    };
    return { fetch: fetchImpl, calls };
  }

  const tokenProvider = { getInstallationToken: async () => "fake-installation-token" };

  it("createIssueComment はPRコメントAPIをPOSTで呼ぶ（DevOps:SPEC-EXT-001）", async () => {
    const { fetch: fetchImpl, calls } = makeFakeFetch([{ status: 201 }]);
    const client = new GitHubClient(tokenProvider, fetchImpl);
    await client.createIssueComment({
      owner: "acme",
      repo: "prjops-system",
      issueOrPrNumber: 42,
      body: "## ビルド失敗の一次調査結果",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/repos/acme/prjops-system/issues/42/comments");
    expect(calls[0]!.init?.method).toBe("POST");
  });

  it("createIssue はSevNラベル付きIssueを作成する（SPEC-EXT-015）", async () => {
    const { fetch: fetchImpl } = makeFakeFetch([
      { status: 201, body: { number: 7, html_url: "https://github.com/acme/x/issues/7" } },
    ]);
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const result = await client.createIssue({
      owner: "acme",
      repo: "devops-system",
      title: "[Sev2][PRJ-001] p95レイテンシ悪化",
      body: "検知時刻...",
      labels: ["incident", "sev2", "auto-triaged"],
    });
    expect(result.number).toBe(7);
  });

  it("createMilestone はMilestone APIをPOSTで呼ぶ（REQ-037/PrjOps:SPEC-INT-063）", async () => {
    const { fetch: fetchImpl, calls } = makeFakeFetch([
      { status: 201, body: { number: 3, html_url: "https://github.com/acme/x/milestone/3", node_id: "M_3" } },
    ]);
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const result = await client.createMilestone({
      owner: "acme",
      repo: "prjops-system",
      title: "v1",
      dueOn: "2026-08-31",
      description: "初回リリース",
    });
    expect(result.nodeId).toBe("M_3");
    expect(calls[0]!.url).toContain("/repos/acme/prjops-system/milestones");
    expect(calls[0]!.init?.body).toContain("due_on");
  });

  it("Project v2 itemはadd→updateをGraphQLで呼べる（REQ-037/PrjOps:SPEC-INT-063）", async () => {
    const { fetch: fetchImpl, calls } = makeFakeFetch([
      { status: 200, body: { data: { addProjectV2ItemById: { item: { id: "PVTI_1" } } } } },
      { status: 200, body: { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: "PVTI_1" } } } } },
      { status: 200, body: { data: { rateLimit: { remaining: 123, resetAt: "2026-07-09T00:00:00Z" } } } },
    ]);
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const added = await client.addProjectV2ItemById({ projectNodeId: "P", contentNodeId: "I" });
    await client.updateProjectV2ItemFieldValue({
      projectNodeId: "P",
      itemNodeId: added.itemNodeId,
      fieldNodeId: "F",
      fieldType: "text",
      value: "Ready",
    });
    const limit = await client.getGraphqlRateLimit();
    expect(limit.remaining).toBe(123);
    expect(calls.every((call) => call.url.endsWith("/graphql"))).toBe(true);
    expect(JSON.parse(String(calls[1]!.init?.body)).variables.value).toEqual({ text: "Ready" });
  });

  it("Project v2 single select fieldはfield_typeに合わせたGraphQL valueで更新する", async () => {
    const { fetch: fetchImpl, calls } = makeFakeFetch([
      { status: 200, body: { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: "PVTI_1" } } } } },
    ]);
    const client = new GitHubClient(tokenProvider, fetchImpl);

    await client.updateProjectV2ItemFieldValue({
      projectNodeId: "P",
      itemNodeId: "PVTI_1",
      fieldNodeId: "F",
      fieldType: "single_select",
      value: "OPT_1",
    });

    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.query).toContain("$value: ProjectV2FieldValue!");
    expect(body.variables.value).toEqual({ singleSelectOptionId: "OPT_1" });
  });

  it("SPEC-INT-081: Projects v2 current snapshotをGraphQLで読む", async () => {
    const { fetch: fetchImpl } = makeFakeFetch([
      {
        status: 200,
        body: {
          data: {
            rateLimit: { remaining: 999, resetAt: "2026-07-09T00:00:00Z" },
            node: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    id: "PVTI_1",
                    content: {
                      __typename: "Issue",
                      id: "I_1",
                      number: 1,
                      title: "Issue",
                      state: "OPEN",
                      repository: { nameWithOwner: "acme/widget" },
                    },
                    fieldValues: {
                      nodes: [{ name: "Todo", field: { name: "Status" } }],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]);
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const page = await client.listCurrentProjectV2Snapshots({ projectNodeId: "PVT_1" });
    expect(page.snapshots[0]).toMatchObject({
      projectId: "PVT_1",
      repository: "acme/widget",
      sourceType: "issue",
      sourceId: "I_1",
      state: "Todo",
    });
  });

  it("dispatchWorkflow は失敗時にE-DEP01を投げる", async () => {
    const { fetch: fetchImpl } = makeFakeFetch([{ status: 403 }]);
    const client = new GitHubClient(tokenProvider, fetchImpl);
    await expect(
      client.dispatchWorkflow({
        owner: "acme",
        repo: "devops-system",
        workflowIdOrFileName: "deploy-prod.yml",
        ref: "main",
        inputs: {},
      }),
    ).rejects.toThrow(/E-DEP01/);
  });

  it("getWorkflowJobLog は1MB超のログを末尾優先で切り詰める（SPEC-INT-011）", async () => {
    const bigLog = `${"x".repeat(500_000)}${"y".repeat(1_000_000)}`;
    const fetchImpl: GhFetchLike = async () => new Response(bigLog, { status: 200 });
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const log = await client.getWorkflowJobLog("acme", "devops-system", 123);
    expect(log.length).toBe(1_000_000);
    expect(log).toBe("y".repeat(1_000_000));
  });

  it("getWorkflowRunFailureLog はfailed jobs APIと個別ログを結合する（DevOps:SPEC-INT-011）", async () => {
    const calls: string[] = [];
    const fetchImpl: GhFetchLike = async (url) => {
      calls.push(url);
      if (url.includes("/actions/runs/456/jobs")) {
        return new Response(
          JSON.stringify({
            total_count: 2,
            jobs: [
              {
                id: 11,
                name: "test",
                conclusion: "failure",
                steps: [{ name: "vitest", conclusion: "failure" }],
              },
              { id: 12, name: "lint", conclusion: "success", steps: [] },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("AssertionError: expected 1 to be 2", { status: 200 });
    };
    const client = new GitHubClient(tokenProvider, fetchImpl);

    const evidence = await client.getWorkflowRunFailureLog("acme", "devops-system", 456);

    expect(evidence).toContain("Failed job: test");
    expect(evidence).toContain("Failed step: vitest");
    expect(evidence).toContain("AssertionError");
    expect(calls).toEqual([
      expect.stringContaining("/repos/acme/devops-system/actions/runs/456/jobs"),
      expect.stringContaining("/repos/acme/devops-system/actions/jobs/11/logs"),
    ]);
  });

  it("getWorkflowRunFailureLog は100件上限で全jobを観測できない応答を拒否する（DevOps:SPEC-INT-011）", async () => {
    const fetchImpl: GhFetchLike = async () =>
      new Response(JSON.stringify({ total_count: 101, jobs: [{ id: 11, name: "test", conclusion: "failure" }] }), {
        status: 200,
      });
    const client = new GitHubClient(tokenProvider, fetchImpl);

    await expect(client.getWorkflowRunFailureLog("acme", "devops-system", 456)).rejects.toThrow(/incomplete/i);
  });
});
