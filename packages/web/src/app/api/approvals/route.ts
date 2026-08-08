/** 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / AUD-OPM-001。認証済みpending承認BFF。 */
import { auth } from "../../../auth";
import { handleListApprovals } from "../../../server/approvalsClient";
import { loadWebConfig } from "../../../server/config";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = loadWebConfig();
  return handleListApprovals({
    getSession: async () => auth(),
    serverBaseUrl: config.AIOPS_SERVER_INTERNAL_URL,
    publicBaseUrl: config.PUBLIC_BASE_URL,
    identitySecret: config.WEB_BFF_IDENTITY_SECRET,
  });
}
