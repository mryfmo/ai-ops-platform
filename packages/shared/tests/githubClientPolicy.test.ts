/**
 * packages/shared/tests/githubClientPolicy.test.ts
 * 根拠: DevOps SPEC-INT-080
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubClient, type GhFetchLike } from "../src/clients/githubClient.js";

const tokenProvider = { getInstallationToken: async () => "test-token" };

function client(fetchImpl: GhFetchLike): GitHubClient {
  return new GitHubClient(tokenProvider, fetchImpl, undefined, { retry: { maxRetries: 1 }, timeoutMs: 1_000 });
}

describe("GitHubClient retry policy [DevOps SPEC-INT-080]", () => {
  afterEach(() => vi.useRealTimers());

  it("Retry-After付き403は指定時間後に再試行する", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const pending = client(async () =>
      ++calls === 1
        ? new Response("", { status: 403, headers: { "Retry-After": "1" } })
        : new Response("[]", { status: 200 }),
    ).listIssues("acme", "repo");

    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual([]);
    expect(calls).toBe(2);
  });

  it("Retry-Afterなし403は再試行しない", async () => {
    let calls = 0;
    await expect(
      client(async () => {
        calls += 1;
        return new Response("", { status: 403 });
      }).listIssues("acme", "repo"),
    ).rejects.toThrow("E-GHR03");
    expect(calls).toBe(1);
  });

  it("GETの5xxは指数バックオフ後に再試行する", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const pending = new GitHubClient(
      tokenProvider,
      async () => {
        calls += 1;
        return calls === 1 ? new Response("", { status: 500 }) : new Response("[]", { status: 200 });
      },
      undefined,
      { retry: { maxRetries: 1, initialDelayMs: 30_000, random: () => 0.5 } },
    ).listPullRequests("acme", "repo");

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(pending).resolves.toEqual([]);
    expect(calls).toBe(2);
  });

  it("POSTの5xxは二重作成を避けて再試行しない", async () => {
    let calls = 0;
    await expect(
      client(async () => {
        calls += 1;
        return new Response("", { status: 500 });
      }).createIssue({ owner: "acme", repo: "repo", title: "incident", body: "body", labels: [] }),
    ).rejects.toThrow("E-GEN03");
    expect(calls).toBe(1);
  });
});
