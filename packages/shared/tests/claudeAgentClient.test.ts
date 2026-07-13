/**
 * packages/shared/tests/claudeAgentClient.test.ts
 *
 * 根拠: REQ-002 AC-002b / SPEC-INT-011。Claude Agent SDKをread-onlyで使う安全契約を検証する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: queryMock }));

import { generateReadOnlyDiffSuggestion } from "../src/clients/claudeAgentClient.js";

const request = {
  repoCheckoutPath: "/read-only/repo",
  failedJob: "test",
  failedStep: "vitest",
  logExcerpt: "one test failed",
  classification: "test_failure" as const,
  promptVersion: "PROMPT-BLD-01-v1",
};

async function* sdkMessages(messages: unknown[]) {
  for (const message of messages) yield message;
}

describe("generateReadOnlyDiffSuggestion [AC-002b]", () => {
  beforeEach(() => queryMock.mockReset());

  it("mutating toolsをdisallowedToolsとcanUseToolの両方で拒否する", async () => {
    queryMock.mockReturnValue(sdkMessages([]));

    await generateReadOnlyDiffSuggestion(request);

    const options = queryMock.mock.calls[0]![0].options as {
      disallowedTools: string[];
      canUseTool(toolName: string): Promise<{ behavior: string }>;
    };
    expect(options.disallowedTools).toEqual(expect.arrayContaining(["Write", "Edit", "Bash", "NotebookEdit"]));
    for (const tool of ["Write", "Edit", "Bash", "NotebookEdit"]) {
      await expect(options.canUseTool(tool)).resolves.toMatchObject({ behavior: "deny" });
    }
    await expect(options.canUseTool("Read")).resolves.toEqual({ behavior: "allow" });
  });

  it("fenced unified diffを抽出する", async () => {
    queryMock.mockReturnValue(
      sdkMessages([
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "```diff\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n```" }],
          },
        },
      ]),
    );

    const result = await generateReadOnlyDiffSuggestion(request);

    expect(result.diffText).toBe("--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n");
  });

  it("resultの---/+++をコードフェンス無しdiffとして採用する", async () => {
    const fallback = "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new";
    queryMock.mockReturnValue(sdkMessages([{ type: "result", subtype: "success", result: fallback }]));

    await expect(generateReadOnlyDiffSuggestion(request)).resolves.toMatchObject({ diffText: fallback });
  });

  it("transcript summaryを4000文字で切り詰める", async () => {
    queryMock.mockReturnValue(
      sdkMessages([{ type: "assistant", message: { content: [{ type: "text", text: "x".repeat(4_001) }] } }]),
    );

    const result = await generateReadOnlyDiffSuggestion(request);

    expect(result.rawTranscriptSummary).toBe("x".repeat(4_000));
  });
});
