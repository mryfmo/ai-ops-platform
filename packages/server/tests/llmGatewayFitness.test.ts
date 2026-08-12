/**
 * packages/server/tests/llmGatewayFitness.test.ts
 *
 * 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / FinalArch:LLM-006 / ADR-0022（P2-T06）
 * fitness test: runtime の LLM 経路が gateway 契約から逸脱しないことを機械検証する。
 * - Anthropic SDK への参照（静的/動的 import・別名構築を含む）が runtime package に無い
 * - provider host の出現が無い（コメント含む raw ban — 字句除去の健全性問題を回避）
 * - config の alias 集合が正典 manifest（deploy/litellm/model-aliases.yaml）と一致する
 * スキャナ述語は本ファイル内の負サンプルで自己検証する（oracle の穴の再発防止）。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GATEWAY_MODEL_ALIASES } from "../src/config.js";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;
const RUNTIME_SRC_DIRS = ["packages/server/src", "packages/prjops/src", "packages/devops/src"];

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkTsFiles(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** SDK 参照検知（保守的 raw ban）: `@anthropic-ai/` の出現自体を違反とする
 *  （静的/動的 import・文字列分割・コメントを問わない。Agent SDK の許可 package も
 *  ここでは例外にしない — P2-T06-007 で server からの到達経路ごと遮断済み）。
 *  素の Anthropic コンストラクタ呼び出しも違反。 */
export function referencesAnthropicSdk(source: string): boolean {
  return source.includes("@anthropic-ai/") || /new\s+Anthropic\s*\(/u.test(source);
}

/** provider-native Agent SDK 経路（claudeAgentClient / diff suggestion）への
 *  server composition からの到達を禁止する（P2-T06-007 の回帰防止）。 */
export function referencesAgentSdkPath(source: string): boolean {
  return /claudeAgentClient|generateReadOnlyDiffSuggestion|generateFixSuggestionIfApplicable/u.test(source);
}

/** provider host 検知（保守的 raw ban）: コメント・文字列を問わず出現自体を違反とする。
 *  字句的なコメント除去は文字列連結や文字列内 `//` で健全性を失うため行わない。
 *  direct host を知ってよいのは shared の transport factory だけ（P2-T06-004）。 */
export function referencesProviderHost(source: string): boolean {
  return source.includes("api.anthropic.com");
}

describe("LLM gateway fitness [FinalArch:LLM-001]", () => {
  const files = RUNTIME_SRC_DIRS.flatMap((dir) => walkTsFiles(join(REPO_ROOT, dir)));

  it("スキャナ述語は既知のバイパス形を検知する（oracle 自己検証） [FinalArch:LLM-001 (P2-T06-004)]", () => {
    // 動的 import + 別名構築
    expect(referencesAnthropicSdk('const { default: ProviderClient } = await import("@anthropic-ai/sdk");')).toBe(true);
    // re-export / require 形
    expect(referencesAnthropicSdk('export * from "@anthropic-ai/sdk";')).toBe(true);
    expect(referencesAnthropicSdk('const A = require("@anthropic-ai/sdk");')).toBe(true);
    // 文字列分割による package 名の組み立て
    expect(referencesAnthropicSdk('const pkg = "@anthropic-ai/" + "sdk";')).toBe(true);
    // 素の構築
    expect(referencesAnthropicSdk("const c = new Anthropic({ apiKey });")).toBe(true);
    // Agent SDK も runtime package では raw ban（P2-T06-007）。無関係コードは通す
    expect(referencesAnthropicSdk('import { q } from "@anthropic-ai/claude-agent-sdk";')).toBe(true);
    expect(referencesAnthropicSdk('import { GraphClient } from "@aiops/shared";')).toBe(false);
    // provider-native 経路の到達検知（server composition 用）
    expect(
      referencesAgentSdkPath(
        'import { generateReadOnlyDiffSuggestion } from "@aiops/shared/clients/claudeAgentClient.js";',
      ),
    ).toBe(true);
    expect(referencesAgentSdkPath("generate: (c, p, d) => generateFixSuggestionIfApplicable(c, p, d)")).toBe(true);
    expect(referencesAgentSdkPath('import { loadConfig } from "./config.js";')).toBe(false);

    // raw ban: コメント・文字列連結を含め出現自体を違反とする
    expect(referencesProviderHost('/* migration note */ const provider = "api.anthropic.com";')).toBe(true);
    expect(referencesProviderHost('const direct = "https:" + "//" + "api.anthropic.com";')).toBe(true);
    expect(referencesProviderHost("// legacy allowlist: api.anthropic.com")).toBe(true);
    expect(referencesProviderHost('const gateway = "https://litellm.internal.example";')).toBe(false);
  });

  it("runtime package は Anthropic SDK を参照しない（transport factory 経由のみ） [FinalArch:LLM-001]", () => {
    const offenders = files.filter((file) => referencesAnthropicSdk(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("runtime package は provider host を参照しない（コメント含む raw ban） [FinalArch:LLM-001]", () => {
    const offenders = files.filter((file) => referencesProviderHost(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("server composition は provider-native Agent SDK 経路へ到達しない [FinalArch:LLM-001 (P2-T06-007)]", () => {
    const serverFiles = walkTsFiles(join(REPO_ROOT, "packages/server/src"));
    const offenders = serverFiles.filter((file) => referencesAgentSdkPath(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("GATEWAY_MODEL_ALIASES は正典 manifest の application_aliases と一致する [FinalArch:LLM-001]", () => {
    const manifest = readFileSync(join(REPO_ROOT, "deploy/litellm/model-aliases.yaml"), "utf8");
    const start = manifest.indexOf("application_aliases:");
    expect(start).toBeGreaterThan(-1);
    const aliases: string[] = [];
    for (const line of manifest.slice(start).split("\n").slice(1)) {
      const match = /^\s+-\s+([a-z0-9-]+)\s*$/u.exec(line);
      if (!match) break;
      aliases.push(match[1]);
    }
    expect([...GATEWAY_MODEL_ALIASES].sort()).toEqual([...aliases].sort());
    expect(aliases.length).toBeGreaterThan(0);
  });
});
