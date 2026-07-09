import { describe, it, expect } from "vitest";
import { sanitizeSecrets, isFreeOfKnownSecrets } from "../src/secretSanitizer.js";

describe("sanitizeSecrets [REQ-032, DevOps REQ-030/SPEC-INT-070]", () => {
  it("GitHub personal access token を検出・マスキングする", () => {
    const input = "token: ghp_1234567890abcdefghijklmnopqrstuvwx を使ってください";
    const { sanitized, redactionCount, matchedPatterns } = sanitizeSecrets(input);
    expect(redactionCount).toBe(1);
    expect(matchedPatterns).toContain("github_pat");
    expect(sanitized).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwx");
  });

  it("Anthropic APIキーを検出する", () => {
    const input = "ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
    const { redactionCount, matchedPatterns } = sanitizeSecrets(input);
    expect(redactionCount).toBeGreaterThanOrEqual(1);
    expect(matchedPatterns).toContain("anthropic_api_key");
  });

  it("Authorizationヘッダを検出する", () => {
    const input = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345";
    const { redactionCount } = sanitizeSecrets(input);
    expect(redactionCount).toBeGreaterThanOrEqual(1);
  });

  it("秘密情報を含まないテキストはそのまま通過する", () => {
    const input = "進捗率62%、来週はテスト工程に着手予定です。";
    const { sanitized, redactionCount } = sanitizeSecrets(input);
    expect(redactionCount).toBe(0);
    expect(sanitized).toBe(input);
  });

  it("isFreeOfKnownSecrets: クリーンなテキストはtrue、混入テキストはfalse", () => {
    expect(isFreeOfKnownSecrets("hello world")).toBe(true);
    expect(isFreeOfKnownSecrets("key=" + "ghp_" + "a".repeat(36))).toBe(false);
  });
});
