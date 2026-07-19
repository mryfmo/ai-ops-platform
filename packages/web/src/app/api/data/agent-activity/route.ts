/**
 * packages/web/src/app/api/data/agent-activity/route.ts
 *
 * 根拠: P010-F02-T08 / ADR-0006（AIコーディングエージェント統合）決定4b。GET /api/data/agent-activity —
 * PRF-G（DevOpsマネージャー）専用。本ファイルは本番用DIを組み立てて
 * server/reportData/agentActivityHandler.ts へ委譲する薄い配線層。
 * ハンドラ本体のロジック・認可・エラー変換はハンドラ側のユニットテストで検証済み。
 */
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import { getPool } from "../../../../server/db/pool";
import { CompositePersonaResolver, DevopsPersonaSource, PrjopsPersonaSource } from "../../../../server/personaResolver";
import { handleAgentActivity } from "../../../../server/reportData/agentActivityHandler";
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
  return handleAgentActivity({
    getSession: async () => auth(),
    resolver,
    devopsDb: pool,
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
