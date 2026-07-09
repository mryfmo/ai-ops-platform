/**
 * packages/web/src/app/api/data/projects/route.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/projects — 全ペルソナ共通。
 * 本ファイルは本番用DIを組み立てて server/reportData/projectsHandler.ts へ委譲する薄い配線層。
 *
 * 残課題: PrjopsReportDataProviderの本番実装（prjops-dataリポジトリ連携）が無いため、
 * 現状は空データのInMemoryPrjopsReportDataProviderで暫定配線する。
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
import { handleProjects } from "../../../../server/reportData/projectsHandler";
import { InMemoryPrjopsReportDataProvider } from "../../../../server/reportData/prjopsReportData";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = loadWebConfig();
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  const resolver = new CompositePersonaResolver(
    new DevopsPersonaSource(pool),
    new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
  );

  return handleProjects({
    getSession: async () => auth(),
    resolver,
    prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
    devopsDb: pool,
  });
}
