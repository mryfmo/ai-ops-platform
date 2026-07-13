import { describe, it, expect } from "vitest";
import { SECRET_PATTERNS, sanitizeSecrets, isFreeOfKnownSecrets } from "../src/secretSanitizer.js";

describe("sanitizeSecrets [REQ-032, DevOps REQ-030/SPEC-INT-070]", () => {
  it("既定の10パターンを維持する", () => {
    expect(SECRET_PATTERNS).toHaveLength(10);
  });

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

  it("運用固有のパターンを既定パターンに追加できる", () => {
    const input = "INTERNAL_TOKEN=corp_token_abcdefghijklmnopqrstuvwxyz";

    expect(sanitizeSecrets(input).redactionCount).toBe(0);
    expect(
      sanitizeSecrets(input, {
        additionalPatterns: [{ name: "internal_token", regex: /corp_token_[a-z]{26}/g }],
      }),
    ).toMatchObject({
      sanitized: "INTERNAL_TOKEN=***REDACTED:internal_token***",
      redactionCount: 1,
      matchedPatterns: ["internal_token"],
      warnings: [],
    });
  });

  it("長さ32以上のbase64/hex連続文字列はopt-in時のみ警告付きでマスクする", () => {
    const hex = "0123456789abcdef".repeat(2);
    const base64 = "Z2l0bGVha3MtcHNldWRvLXNlY3JldC0xMjM0NTY=";
    const input = `${hex} ${base64}`;

    expect(sanitizeSecrets(input)).toMatchObject({ sanitized: input, redactionCount: 0, warnings: [] });

    const result = sanitizeSecrets(input, { maskSuspiciousSequences: true });
    expect(result.sanitized).not.toContain(hex);
    expect(result.sanitized).not.toContain(base64);
    expect(result.warnings).toEqual(["suspicious_hex", "suspicious_base64"]);
    expect(result.redactionCount).toBe(2);
  });
});
