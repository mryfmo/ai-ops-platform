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
    const input = "進捗率62%、安全①、プロジェクトＡ、ﬃを維持します。";
    const { sanitized, redactionCount } = sanitizeSecrets(input);
    expect(redactionCount).toBe(0);
    expect(sanitized).toBe(input);
  });

  it("isFreeOfKnownSecrets: クリーンなテキストはtrue、混入テキストはfalse", () => {
    expect(isFreeOfKnownSecrets("hello world")).toBe(true);
    expect(isFreeOfKnownSecrets("key=" + "ghp_" + "a".repeat(36))).toBe(false);
  });

  it("REQ-032: compatibility文字をNFKC正規化してからsecretを除去する", () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const canonicalSecret = secret.normalize("NFKC");

    const result = sanitizeSecrets(`key=${secret}`);

    expect(result.redactionCount).toBe(1);
    expect(result.sanitized).not.toContain(secret);
    expect(result.sanitized).not.toContain(canonicalSecret);
    expect(result.sanitized).toContain("***REDACTED:github_pat***");
    expect(isFreeOfKnownSecrets(secret)).toBe(false);
  });

  it("REQ-032: compatibility secretだけを除去し、周囲の原文は正規化せず保持する", () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const input = `ﬃ/安全①:${secret}:プロジェクトＡ`;

    expect(sanitizeSecrets(input).sanitized).toBe("ﬃ/安全①:***REDACTED:github_pat***:プロジェクトＡ");
  });

  it("REQ-032: GitHub App tokenをgithub_patより先に固有分類する", () => {
    const secret = `ghs_${"a".repeat(24)}`;
    const result = sanitizeSecrets(secret);

    expect(result.sanitized).toBe("***REDACTED:github_app_token***");
    expect(result.matchedPatterns).toEqual(["github_app_token"]);
  });

  it("REQ-032: combining・surrogate・expanded glyphの周囲を保ったまま複数secretを除去する", () => {
    const compatSecret = `ｇｈｐ＿${"a".repeat(24)}`;
    const appSecret = `ghs_${"b".repeat(24)}`;
    const input = `😀e\u0301ﬃ/${compatSecret}/安全①/${appSecret}/𠮷`;

    expect(sanitizeSecrets(input)).toEqual({
      sanitized: "😀e\u0301ﬃ/***REDACTED:github_pat***/安全①/***REDACTED:github_app_token***/𠮷",
      redactionCount: 2,
      matchedPatterns: ["github_app_token", "github_pat"],
    });
  });

  it("REQ-032: 多数のcompatibility secretを実用的な短時間で線形処理する", () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const input = `😀e\u0301ﬃ|${Array.from({ length: 200 }, () => secret).join("|安全①|")}|プロジェクトＡ`;
    const result = sanitizeSecrets(input);

    expect(result.redactionCount).toBe(200);
    expect(result.sanitized.startsWith("😀e\u0301ﬃ|***REDACTED:github_pat***")).toBe(true);
    expect(result.sanitized.endsWith("***REDACTED:github_pat***|プロジェクトＡ")).toBe(true);
    expect(result.sanitized).not.toContain(secret);
  }, 1_000);
});
