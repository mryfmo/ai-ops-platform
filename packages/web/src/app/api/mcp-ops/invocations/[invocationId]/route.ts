/** 根拠: FinalArch:MCP-003 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11。認証済みinvocation audit BFF。 */
import { auth } from "../../../../../auth";
import { loadWebConfig } from "../../../../../server/config";
import { handleMcpOpsInvocation } from "../../../../../server/mcpOpsClient";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ invocationId: string }> },
): Promise<Response> {
  const config = loadWebConfig();
  return handleMcpOpsInvocation((await context.params).invocationId, {
    getSession: async () => auth(),
    serverBaseUrl: config.AIOPS_SERVER_INTERNAL_URL,
    identitySecret: config.WEB_BFF_IDENTITY_SECRET,
  });
}
