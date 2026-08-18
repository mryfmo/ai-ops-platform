/**
 * 根拠: FinalArch:COD-003 / ADR-0006 / WBS P8-T01 / ADV-FIX-04
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { issueCodingTaskManifest, verifyCodingTaskManifestAuthority } from "../src/lib/codingTaskManifest.js";
import { validateAgentTaskManifest as validateContractManifest } from "../../../contracts/agent-task/manifest-validator.mjs";

const TASK_ID = "11111111-1111-4111-8111-111111111111";

describe("coding task manifest authority (ADV-FIX-04)", () => {
  it("issues exact UTF-8 bytes accepted by the agent-task contract and hashes the raw bytes", () => {
    const authority = issueCodingTaskManifest({ taskId: TASK_ID, agent: "claude-code" });
    const manifest = JSON.parse(authority.manifest) as Record<string, unknown>;

    expect(() => validateContractManifest(manifest)).not.toThrow();
    expect(authority.manifest.endsWith("\n")).toBe(true);
    expect(authority.manifestSha256).toBe(createHash("sha256").update(authority.manifest, "utf8").digest("hex"));
    expect(authority.manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect((manifest.paths as { forbidden: string[] }).forbidden).toEqual(
      expect.arrayContaining([
        ".github/workflows/**",
        ".github/actions/**",
        "contracts/agent-task/**",
        "scripts/coding-agent-path-guard.mjs",
      ]),
    );
  });

  it("rejects missing, mismatched, malformed, and task-substituted authority", () => {
    const authority = issueCodingTaskManifest({ taskId: TASK_ID, agent: "claude-code" });
    expect(() =>
      verifyCodingTaskManifestAuthority({ taskId: TASK_ID, agent: "claude-code", ...authority }),
    ).not.toThrow();
    expect(() =>
      verifyCodingTaskManifestAuthority({ taskId: TASK_ID, agent: "claude-code", ...authority, manifestSha256: "" }),
    ).toThrow(/digest/u);
    expect(() =>
      verifyCodingTaskManifestAuthority({
        taskId: TASK_ID,
        agent: "claude-code",
        ...authority,
        manifestSha256: "0".repeat(64),
      }),
    ).toThrow(/digest/u);
    expect(() =>
      verifyCodingTaskManifestAuthority({ taskId: TASK_ID, agent: "claude-code", ...authority, manifest: "{}\n" }),
    ).toThrow(/digest/u);
    expect(() =>
      verifyCodingTaskManifestAuthority({
        taskId: "22222222-2222-4222-8222-222222222222",
        agent: "claude-code",
        ...authority,
      }),
    ).toThrow(/task manifest/u);
  });
});
