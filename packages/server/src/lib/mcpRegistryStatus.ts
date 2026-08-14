/** 根拠: FinalArch:MCP-004 / ADR-0023 / WBS P4-T11。P4-T02 schema hash gate の metadata-only runtime view。 */
import { readFile } from "node:fs/promises";

export interface McpRegistryStatus {
  status: "match" | "drift" | "unavailable";
  declaredHash: string | null;
  approvedHash: string | null;
}

const HASH = /^[0-9a-f]{64}$/u;

export function registryStatusFromText(registry: string, approved: string): McpRegistryStatus {
  const approvedHash = approved.trim();
  if (!HASH.test(approvedHash)) return { status: "unavailable", declaredHash: null, approvedHash: null };
  const matches = [...registry.matchAll(/^schema_hash:\s*["']?([0-9a-f]{64})["']?\s*$/gmu)];
  const declaredHash = matches.length === 1 ? matches[0]![1]! : null;
  return {
    status: declaredHash === approvedHash ? "match" : "drift",
    declaredHash,
    approvedHash,
  };
}

const REGISTRY_URL = new URL("../../../../contracts/tools/mcp-registry.yaml", import.meta.url);
const APPROVED_HASH_URL = new URL("../../../../contracts/tools/mcp-registry.schema.sha256", import.meta.url);

export function createMcpRegistryStatusReader(
  readText: (path: URL) => Promise<string> = (path) => readFile(path, "utf8"),
) {
  return {
    async read(): Promise<McpRegistryStatus> {
      try {
        const [registry, approved] = await Promise.all([readText(REGISTRY_URL), readText(APPROVED_HASH_URL)]);
        return registryStatusFromText(registry, approved);
      } catch {
        return { status: "unavailable", declaredHash: null, approvedHash: null };
      }
    },
  };
}
