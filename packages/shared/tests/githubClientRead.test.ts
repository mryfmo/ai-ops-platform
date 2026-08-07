/**
 * packages/shared/tests/githubClientRead.test.ts
 *
 * 根拠: ADR-0005（TeamsチャネルからのGitHub照会: gh_pr_list等の読み取り系API）
 */
import { describe, it, expect } from "vitest";
import { GitHubClient, type GhFetchLike, type GitHubTokenProvider } from "../src/clients/githubClient.js";

const tokenProvider: GitHubTokenProvider = { getInstallationToken: async () => "fake-installation-token" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const rawPr = {
  number: 42,
  title: "feat: リスクスコア係数の調整",
  state: "open",
  draft: false,
  user: { login: "dev-a" },
  head: { ref: "agent/task-123" },
  base: { ref: "main" },
  html_url: "https://github.com/acme/repo/pull/42",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-06T00:00:00Z",
  merged_at: null,
};

describe("GitHubClient.listPullRequests (ADR-0005)", () => {
  it("PR一覧をサマリ型に正規化して返す", async () => {
    const urls: string[] = [];
    const fetchImpl: GhFetchLike = async (url) => {
      urls.push(url);
      return jsonResponse([rawPr]);
    };
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const prs = await client.listPullRequests("acme", "repo");
    expect(urls[0]).toContain("/repos/acme/repo/pulls?state=open");
    expect(prs[0]!.number).toBe(42);
    expect(prs[0]!.headRef).toBe("agent/task-123");
    expect(prs[0]!.merged).toBe(false);
  });

  it("state=allを指定できる", async () => {
    const urls: string[] = [];
    const fetchImpl: GhFetchLike = async (url) => {
      urls.push(url);
      return jsonResponse([]);
    };
    const client = new GitHubClient(tokenProvider, fetchImpl);
    await client.listPullRequests("acme", "repo", { state: "all" });
    expect(urls[0]).toContain("state=all");
  });

  it("失敗時はE-GHR01例外", async () => {
    const fetchImpl: GhFetchLike = async () => jsonResponse({}, 500);
    const client = new GitHubClient(tokenProvider, fetchImpl, undefined, { retry: { maxRetries: 0 } });
    await expect(client.listPullRequests("acme", "repo")).rejects.toThrow("E-GHR01");
  });
});

describe("GitHubClient.getPullRequest (ADR-0005)", () => {
  it("詳細（差分規模・base）を含めて返す", async () => {
    const fetchImpl: GhFetchLike = async () =>
      jsonResponse({ ...rawPr, body: "説明", mergeable: true, changed_files: 3, additions: 120, deletions: 15 });
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const pr = await client.getPullRequest("acme", "repo", 42);
    expect(pr.baseRef).toBe("main");
    expect(pr.changedFiles).toBe(3);
    expect(pr.mergeable).toBe(true);
  });
});

describe("GitHubClient.listIssues (ADR-0005)", () => {
  it("PRを除外しIssueのみ返す（issues APIはPRも含むため）", async () => {
    const fetchImpl: GhFetchLike = async () =>
      jsonResponse([
        {
          number: 7,
          title: "インシデント: ビルド不安定",
          state: "open",
          labels: [{ name: "incident" }, { name: "sev3" }],
          user: { login: "agt-inc" },
          html_url: "https://github.com/acme/repo/issues/7",
          created_at: "2026-07-05T00:00:00Z",
          updated_at: "2026-07-05T01:00:00Z",
        },
        {
          number: 42,
          title: "PRはissues APIにも現れる",
          state: "open",
          pull_request: { url: "..." },
          labels: [],
          user: { login: "x" },
        },
      ]);
    const client = new GitHubClient(tokenProvider, fetchImpl);
    const issues = await client.listIssues("acme", "repo");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.number).toBe(7);
    expect(issues[0]!.labels).toEqual(["incident", "sev3"]);
  });

  it("labelsフィルタをクエリに反映する", async () => {
    const urls: string[] = [];
    const fetchImpl: GhFetchLike = async (url) => {
      urls.push(url);
      return jsonResponse([]);
    };
    const client = new GitHubClient(tokenProvider, fetchImpl);
    await client.listIssues("acme", "repo", { labels: ["incident", "sev1"] });
    expect(decodeURIComponent(urls[0]!)).toContain("labels=incident,sev1");
  });
});

describe("GitHubClient.listWorkflowRuns [DevOps:SPEC-INT-020 / ADR-0006]", () => {
  it("ワークフローファイル・event・created下限で問い合わせ、status/conclusionを正規化する [DevOps:SPEC-INT-020]", async () => {
    const urls: string[] = [];
    const fetchImpl: GhFetchLike = async (url) => {
      urls.push(url);
      return jsonResponse({
        total_count: 2,
        workflow_runs: [
          { id: 7, status: "completed", conclusion: "success" },
          { id: 8, status: "queued", conclusion: null },
        ],
      });
    };
    const client = new GitHubClient(tokenProvider, fetchImpl);

    const listing = await client.listWorkflowRuns("acme", "repo", {
      workflowFileName: "coding-task.yml",
      event: "workflow_dispatch",
      createdSince: "2026-08-04T00:00:00.000Z",
    });

    expect(urls[0]).toContain("/repos/acme/repo/actions/workflows/coding-task.yml/runs?");
    const query = decodeURIComponent(urls[0]!);
    expect(query).toContain("event=workflow_dispatch");
    expect(query).toContain("created=>=2026-08-04T00:00:00.000Z");
    expect(listing.complete).toBe(true);
    expect(listing.runs).toEqual([
      { id: 7, status: "completed", conclusion: "success" },
      { id: 8, status: "queued", conclusion: null },
    ]);
  });

  it("total_countに届くまでページを辿る（新しい順のため1ページ目だけでは古いrunを見落とす） [DevOps:SPEC-INT-020]", async () => {
    const pages: string[] = [];
    const fetchImpl: GhFetchLike = async (url) => {
      pages.push(url);
      const isFirst = url.includes("page=1");
      return jsonResponse({
        total_count: 3,
        workflow_runs: isFirst
          ? [
              { id: 1, status: "completed", conclusion: "success" },
              { id: 2, status: "completed", conclusion: "success" },
            ]
          : [{ id: 3, status: "queued", conclusion: null }],
      });
    };
    const client = new GitHubClient(tokenProvider, fetchImpl);

    const listing = await client.listWorkflowRuns("acme", "repo", {
      workflowFileName: "coding-task.yml",
      perPage: 2,
    });

    expect(pages).toHaveLength(2);
    expect(listing.complete).toBe(true);
    expect(listing.runs.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(listing.runs.some((r) => r.status !== "completed")).toBe(true);
  });

  it("ページ上限で打ち切ったときは complete=false を返す（黙って全件扱いにしない） [DevOps:SPEC-INT-020]", async () => {
    const client = new GitHubClient(tokenProvider, async () =>
      jsonResponse({
        total_count: 100,
        workflow_runs: [
          { id: 1, status: "completed", conclusion: "success" },
          { id: 2, status: "completed", conclusion: "success" },
        ],
      }),
    );

    const listing = await client.listWorkflowRuns("acme", "repo", {
      workflowFileName: "coding-task.yml",
      perPage: 2,
      maxPages: 2,
    });

    expect(listing.complete).toBe(false);
    expect(listing.runs).toHaveLength(4);
  });

  it("workflow_runsが欠落していても空配列を返す [DevOps:SPEC-INT-020]", async () => {
    const client = new GitHubClient(tokenProvider, async () => jsonResponse({}));

    expect(await client.listWorkflowRuns("acme", "repo", { workflowFileName: "coding-task.yml" })).toEqual({
      runs: [],
      complete: true,
    });
  });

  it("非2xxは黙って空を返さず例外にする [DevOps:SPEC-INT-020]", async () => {
    // 5xxはfetchWithBackoffが再試行するため、再試行対象外の404で終端挙動を検証する。
    const client = new GitHubClient(tokenProvider, async () => jsonResponse({ message: "not found" }, 404));

    await expect(client.listWorkflowRuns("acme", "repo", { workflowFileName: "coding-task.yml" })).rejects.toThrow(
      "E-ING05",
    );
  });
});
