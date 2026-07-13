/**
 * packages/web/src/app/api/data/executive-summary/route.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/executive-summary — PRF-04（経営陣）専用。
 * 本ファイルは本番用DI（auth() + pg.Pool + InMemoryPrjopsReportDataProvider）を組み立てて
 * server/reportData/executiveSummaryHandler.ts へ委譲する薄い配線層。
 * ハンドラ本体のロジック・認可・エラー変換はハンドラ側のユニットテストで検証済み。
 *
 * 残課題: PrjopsReportDataProviderの本番実装（prjops-dataリポジトリ連携）が無いため、
 * 現状は空データのInMemoryPrjopsReportDataProviderで暫定配線する
 * （personaResolver.tsのInMemoryStakeholderMasterProviderと同じ暫定措置）。
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
import { handleExecutiveSummary } from "../../../../server/reportData/executiveSummaryHandler";
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
  return handleExecutiveSummary({
    getSession: async () => auth(),
    resolver,
    provider: new InMemoryPrjopsReportDataProvider([], []),
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
