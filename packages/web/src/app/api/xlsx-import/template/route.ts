/** 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。認証済みExcelテンプレート配信。 */
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import { handleXlsxTemplate } from "../../../../server/xlsxImportHandler";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = loadWebConfig();
  return handleXlsxTemplate({
    getSession: async () => auth(),
    serverBaseUrl: config.AIOPS_SERVER_INTERNAL_URL,
    publicBaseUrl: config.PUBLIC_BASE_URL,
    importSecret: config.XLSX_IMPORT_SECRET,
  });
}
