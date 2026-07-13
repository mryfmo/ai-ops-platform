/**
 * packages/web/src/app/api/data/investor-summary/route.ts
 *
 * 根拠: REQ-039 / SPEC-INT-066 / AC-039-1 / ADR-0011。
 */
import pg from "pg";
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import {
  CompositePersonaResolver,
  DevopsPersonaSource,
  InMemoryStakeholderMasterProvider,
  PrjopsPersonaSource,
} from "../../../../server/personaResolver";
import { handleInvestorSummary } from "../../../../server/reportData/investorSummaryHandler";
import { InMemoryPrjopsReportDataProvider } from "../../../../server/reportData/prjopsReportData";
import { selectedPersonaFromRequest } from "../../../../server/authGuard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const config = loadWebConfig();
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  const resolver = new CompositePersonaResolver(
    new DevopsPersonaSource(pool),
    new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
  );
  return handleInvestorSummary({
    getSession: async () => auth(),
    resolver,
    provider: new InMemoryPrjopsReportDataProvider([], []),
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
