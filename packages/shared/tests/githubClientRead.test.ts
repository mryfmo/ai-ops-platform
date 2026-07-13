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
