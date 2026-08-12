/**
 * packages/web/tests/llmGatewayFitness.test.ts
 *
 * 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / ADR-0022（P2-T07）。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WEB_GATEWAY_MODEL_ALIASES } from "../src/server/config";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;
const WEB_SRC = join(REPO_ROOT, "packages/web/src");
const PROVIDER_FACTORY = join(WEB_SRC, "server/chat/provider.ts");

function walkRuntimeFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walkRuntimeFiles(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) files.push(full);
  }
  return files;
}

export function referencesDirectProvider(source: string): boolean {
  return (
    source.includes("@anthropic-ai/") || source.includes("ANTHROPIC_API_KEY") || source.includes("api.anthropic.com")
  );
}

describe("Web LLM gateway fitness [FinalArch:LLM-001]", () => {
  const files = walkRuntimeFiles(WEB_SRC);

  it("oracle は provider SDK/key/host の既知 bypass を raw ban する", () => {
    expect(referencesDirectProvider('import A from "@anthropic-ai/sdk"')).toBe(true);
    expect(referencesDirectProvider("const key = process.env.ANTHROPIC_API_KEY")).toBe(true);
    expect(referencesDirectProvider('const url = "https:" + "//" + "api.anthropic.com"')).toBe(true);
    expect(referencesDirectProvider('import { createAnthropic } from "@ai-sdk/anthropic"')).toBe(false);
  });

  it("web runtime は provider SDK/key/host を参照しない", () => {
    expect(files.filter((file) => referencesDirectProvider(readFileSync(file, "utf8")))).toEqual([]);
  });

  it("AI SDK Anthropic provider の構築点は gateway factory だけに置く", () => {
    const offenders = files.filter(
      (file) => file !== PROVIDER_FACTORY && readFileSync(file, "utf8").includes("@ai-sdk/anthropic"),
    );
    expect(offenders).toEqual([]);
  });

  it("Web alias 集合は LiteLLM manifest の application_aliases と一致する", () => {
    const manifest = readFileSync(join(REPO_ROOT, "deploy/litellm/model-aliases.yaml"), "utf8");
    const start = manifest.indexOf("application_aliases:");
    expect(start).toBeGreaterThan(-1);
    const aliases: string[] = [];
    for (const line of manifest.slice(start).split("\n").slice(1)) {
      const match = /^\s+-\s+([a-z0-9-]+)\s*$/u.exec(line);
      if (!match) break;
      aliases.push(match[1]!);
    }
    expect([...WEB_GATEWAY_MODEL_ALIASES].sort()).toEqual(aliases.sort());
  });
});
