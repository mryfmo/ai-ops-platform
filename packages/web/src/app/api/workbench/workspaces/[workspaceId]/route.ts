/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003。 */
import { auth } from "../../../../../auth";
import { loadWebConfig } from "../../../../../server/config";
import { handleWorkbenchWorkspace } from "../../../../../server/workbenchClient";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string }> }): Promise<Response> {
  const config = loadWebConfig();
  const { workspaceId } = await context.params;
  return handleWorkbenchWorkspace(workspaceId, {
    getSession: async () => auth(),
    serverBaseUrl: config.AIOPS_SERVER_INTERNAL_URL,
    identitySecret: config.WEB_BFF_IDENTITY_SECRET,
  });
}
