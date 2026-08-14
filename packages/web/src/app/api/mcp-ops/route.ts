/** 根拠: FinalArch:MCP-003 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11。認証済みMCP operations summary BFF。 */
import { auth } from "../../../auth";
import { loadWebConfig } from "../../../server/config";
import { handleMcpOpsSummary } from "../../../server/mcpOpsClient";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = loadWebConfig();
  return handleMcpOpsSummary({
    getSession: async () => auth(),
    serverBaseUrl: config.AIOPS_SERVER_INTERNAL_URL,
    identitySecret: config.WEB_BFF_IDENTITY_SECRET,
  });
}
