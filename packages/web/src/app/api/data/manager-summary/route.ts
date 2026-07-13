/**
 * packages/web/src/app/api/data/manager-summary/route.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/manager-summary —
 * PrjOps PRF-03 または DevOps PRF-G 専用。本ファイルは本番用DIを組み立てて
 * server/reportData/managerSummaryHandler.ts へ委譲する薄い配線層。
 *
 * 集計期間: クエリパラメータ periodStart/periodEnd（ISO日付）を許容し、未指定時は
 * 直近28日間（4週間分のバーンダウン表示に十分な期間）を既定値とする。
 *
 * 残課題: PrjopsReportDataProviderの本番実装（prjops-dataリポジトリ連携）が無いため、
 * 現状は空データのInMemoryPrjopsReportDataProviderで暫定配線する。
 */
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import { getPool } from "../../../../server/db/pool";
import {
  CompositePersonaResolver,
  DevopsPersonaSource,
  InMemoryStakeholderMasterProvider,
  PrjopsPersonaSource,
} from "../../../../server/personaResolver";
import { handleManagerSummary } from "../../../../server/reportData/managerSummaryHandler";
import { InMemoryPrjopsReportDataProvider } from "../../../../server/reportData/prjopsReportData";
import { selectedPersonaFromRequest } from "../../../../server/authGuard";

export const dynamic = "force-dynamic";

function defaultPeriod(): { periodStart: string; periodEnd: string } {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 28 * 24 * 60 * 60 * 1000);
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
}

export async function GET(request: Request): Promise<Response> {
  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  const resolver = new CompositePersonaResolver(
    new DevopsPersonaSource(pool),
    new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
  );

  const url = new URL(request.url);
  const periodStartParam = url.searchParams.get("periodStart");
  const periodEndParam = url.searchParams.get("periodEnd");
  const { periodStart, periodEnd } =
    periodStartParam && periodEndParam ? { periodStart: periodStartParam, periodEnd: periodEndParam } : defaultPeriod();

  return handleManagerSummary({
    getSession: async () => auth(),
    resolver,
    prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
    devopsDb: pool,
    periodStart,
    periodEnd,
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
