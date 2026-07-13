/**
 * packages/web/src/app/api/data/agent-activity/route.ts
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4b。GET /api/data/agent-activity —
 * PRF-G（DevOpsマネージャー）専用。本ファイルは本番用DIを組み立てて
 * server/reportData/agentActivityHandler.ts へ委譲する薄い配線層。
 * ハンドラ本体のロジック・認可・エラー変換はハンドラ側のユニットテストで検証済み。
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
import { handleAgentActivity } from "../../../../server/reportData/agentActivityHandler";
import { selectedPersonaFromRequest } from "../../../../server/authGuard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const config = loadWebConfig();
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  const resolver = new CompositePersonaResolver(
    new DevopsPersonaSource(pool),
    new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
  );
  return handleAgentActivity({
    getSession: async () => auth(),
    resolver,
    devopsDb: pool,
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
