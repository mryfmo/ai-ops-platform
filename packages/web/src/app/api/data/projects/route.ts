/**
 * packages/web/src/app/api/data/projects/route.ts
 *
 * 根拠: P010-F02-T08 / ADR-0005（WebUIダッシュボード）。GET /api/data/projects — 全ペルソナ共通。
 * 本ファイルは本番用DIを組み立てて server/reportData/projectsHandler.ts へ委譲する薄い配線層。
 */
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import { getPool } from "../../../../server/db/pool";
import { CompositePersonaResolver, DevopsPersonaSource, PrjopsPersonaSource } from "../../../../server/personaResolver";
import { handleProjects } from "../../../../server/reportData/projectsHandler";
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

  return handleProjects({
    getSession: async () => auth(),
    resolver,
    prjopsProvider: provider,
    devopsDb: pool,
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
