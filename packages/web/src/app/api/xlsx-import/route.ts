/** 根拠: REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1 / ADR-0008。認証済みExcel取込プロキシ。 */
import { auth } from "../../../auth";
import { loadWebConfig } from "../../../server/config";
import { handleXlsxImport } from "../../../server/xlsxImportHandler";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = loadWebConfig();
  return handleXlsxImport(request, {
    getSession: async () => auth(),
    serverBaseUrl: config.AIOPS_SERVER_INTERNAL_URL,
    publicBaseUrl: config.PUBLIC_BASE_URL,
    importSecret: config.XLSX_IMPORT_SECRET,
  });
}
