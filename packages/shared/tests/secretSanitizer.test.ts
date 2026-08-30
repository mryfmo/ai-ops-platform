import { describe, it, expect } from "vitest";
import { sanitizeSecrets, isFreeOfKnownSecrets } from "../src/secretSanitizer.js";

describe("sanitizeSecrets [PrjOps:REQ-032, DevOps:REQ-030/DevOps:SPEC-INT-070]", () => {
  it("GitHub personal access token を検出・マスキングする", () => {
    const input = "token: ghp_1234567890abcdefghijklmnopqrstuvwx を使ってください";
    const { sanitized, redactionCount, matchedPatterns } = sanitizeSecrets(input);
    expect(redactionCount).toBe(1);
    expect(matchedPatterns).toContain("github_pat");
    expect(sanitized).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwx");
  });

  it.each([
    ["github_fine_grained_pat", () => "github_pat_" + "a".repeat(22)],
    ["slack_token", () => "xoxb-" + "b".repeat(10)],
    ["url_credentials", () => "postgresql://worker:" + "c".repeat(16) + "@db.internal/app"],
    ["openai_api_key", () => "sk-" + "d".repeat(20)],
    ["gcp_api_key", () => "AIza" + "e".repeat(35)],
    ["azure_sas_signature", () => "https://blob.invalid/x?sig=" + "f".repeat(16)],
  ])("追加pattern %s を指定名でredactする [PrjOps:REQ-032 / DevOps:SPEC-INT-070]", (name, build) => {
    const secret = build();
    const result = sanitizeSecrets(`value=${secret}`);

    expect(result.sanitized).toContain(`***REDACTED:${name}***`);
    expect(result.sanitized).not.toContain(secret);
    expect(result.matchedPatterns).toContain(name);
  });

  it.each([
    () => "github_pat_" + "a".repeat(21),
    () => "xoxb-" + "b".repeat(9),
    () => "https://example.com/path",
    () => "sk-" + "d".repeat(19),
    () => "AIza" + "e".repeat(34),
    () => "https://blob.invalid/x?sig=" + "f".repeat(15),
  ])("追加patternの境界外は通常本文を壊さない %# [PrjOps:REQ-032 / DevOps:SPEC-INT-070]", (build) => {
    const input = build();
    expect(sanitizeSecrets(input)).toMatchObject({ sanitized: input, redactionCount: 0 });
  });

  it.each(["risk-based-access-control-policy", "task-based-deployment-flow"])(
    "OpenAI keyに似た通常語を壊さない: %s [PrjOps:REQ-032 / DevOps:SPEC-INT-070]",
    (input) => {
      expect(sanitizeSecrets(input)).toMatchObject({ sanitized: input, redactionCount: 0 });
    },
  );

  it("区切り文字直後のOpenAI keyは引き続きredactする [PrjOps:REQ-032 / DevOps:SPEC-INT-070]", () => {
    const secret = "sk-" + "z".repeat(20);
    const result = sanitizeSecrets(`key=${secret}`);

    expect(result.sanitized).toBe("key=***REDACTED:openai_api_key***");
    expect(result.matchedPatterns).toContain("openai_api_key");
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

  it("private-key block内のBearerよりblock全体を優先して1回でマスクする", () => {
    const input = [
      "-----BEGIN PRIVATE KEY-----",
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345",
      "-----END PRIVATE KEY-----",
    ].join("\n");

    expect(sanitizeSecrets(input)).toMatchObject({
      sanitized: "***REDACTED:private_key_block***",
      redactionCount: 1,
      matchedPatterns: ["private_key_block"],
    });
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

  it("PrjOps:REQ-032: compatibility文字をNFKC正規化してからsecretを除去する", () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const canonicalSecret = secret.normalize("NFKC");

    const result = sanitizeSecrets(`key=${secret}`);

    expect(result.redactionCount).toBe(1);
    expect(result.sanitized).not.toContain(secret);
    expect(result.sanitized).not.toContain(canonicalSecret);
    expect(result.sanitized).toContain("***REDACTED:github_pat***");
    expect(isFreeOfKnownSecrets(secret)).toBe(false);
  });

  it("PrjOps:REQ-032: compatibility secretだけを除去し、周囲の原文は正規化せず保持する", () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const input = `ﬃ/安全①:${secret}:プロジェクトＡ`;

    expect(sanitizeSecrets(input).sanitized).toBe("ﬃ/安全①:***REDACTED:github_pat***:プロジェクトＡ");
  });

  it("PrjOps:REQ-032: GitHub App tokenをgithub_patより先に固有分類する", () => {
    const secret = `ghs_${"a".repeat(24)}`;
    const result = sanitizeSecrets(secret);

    expect(result.sanitized).toBe("***REDACTED:github_app_token***");
    expect(result.matchedPatterns).toEqual(["github_app_token"]);
  });

  it("PrjOps:REQ-032: combining・surrogate・expanded glyphの周囲を保ったまま複数secretを除去する", () => {
    const compatSecret = `ｇｈｐ＿${"a".repeat(24)}`;
    const appSecret = `ghs_${"b".repeat(24)}`;
    const input = `😀e\u0301ﬃ/${compatSecret}/安全①/${appSecret}/𠮷`;

    expect(sanitizeSecrets(input)).toEqual({
      sanitized: "😀e\u0301ﬃ/***REDACTED:github_pat***/安全①/***REDACTED:github_app_token***/𠮷",
      redactionCount: 2,
      matchedPatterns: ["github_app_token", "github_pat"],
      warnings: [],
    });
  });

  it("PrjOps:REQ-032: 多数のcompatibility secretを実用的な短時間で線形処理する", () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const input = `😀e\u0301ﬃ|${Array.from({ length: 200 }, () => secret).join("|安全①|")}|プロジェクトＡ`;
    const result = sanitizeSecrets(input);

    expect(result.redactionCount).toBe(200);
    expect(result.sanitized.startsWith("😀e\u0301ﬃ|***REDACTED:github_pat***")).toBe(true);
    expect(result.sanitized.endsWith("***REDACTED:github_pat***|プロジェクトＡ")).toBe(true);
    expect(result.sanitized).not.toContain(secret);
  }, 1_000);

  it("運用固有のパターンを既定パターンに追加できる", () => {
    const input = "INTERNAL_TOKEN=corp_token_abcdefghijklmnopqrstuvwxyz";
    const result = sanitizeSecrets(input, {
      additionalPatterns: [{ name: "internal_token", regex: /corp_token_[a-z]{26}/g }],
    });
    expect(result).toMatchObject({
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
  });
});
