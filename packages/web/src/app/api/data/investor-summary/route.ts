/**
 * packages/web/src/app/api/data/investor-summary/route.ts
 *
 * 根拠: P010-F02-T08 / REQ-039 / SPEC-INT-066 / AC-039-1 / ADR-0011。
 */
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import { getPool } from "../../../../server/db/pool";
import { CompositePersonaResolver, DevopsPersonaSource, PrjopsPersonaSource } from "../../../../server/personaResolver";
import { handleInvestorSummary } from "../../../../server/reportData/investorSummaryHandler";
import { selectedPersonaFromRequest } from "../../../../server/authGuard";
import { createPinnedPrjopsReportDataProvider } from "../../../../server/reportData/pinnedPrjopsReportDataProvider";
import { toErrorResponse } from "../../../../server/reportData/dataApiSupport";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  let provider;
  try {
    provider = createPinnedPrjopsReportDataProvider(config);
  } catch (error) {
    return toErrorResponse(error);
  }
  const resolver = new CompositePersonaResolver(new DevopsPersonaSource(pool), new PrjopsPersonaSource(provider));
  return handleInvestorSummary({
    getSession: async () => auth(),
    resolver,
    provider,
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
