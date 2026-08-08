/** 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / AUD-OPM-001。認証済み承認判断BFF。 */
import { auth } from "../../../../auth";
import { handleApprovalDecision } from "../../../../server/approvalsClient";
import { loadWebConfig } from "../../../../server/config";

export async function POST(request: Request, context: { params: Promise<{ approvalId: string }> }): Promise<Response> {
  const config = loadWebConfig();
  const { approvalId } = await context.params;
  return handleApprovalDecision(request, approvalId, {
    getSession: async () => auth(),
    serverBaseUrl: config.AIOPS_SERVER_INTERNAL_URL,
    publicBaseUrl: config.PUBLIC_BASE_URL,
    identitySecret: config.WEB_BFF_IDENTITY_SECRET,
  });
}
